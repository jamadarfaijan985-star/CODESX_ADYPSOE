import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AssistantMessage,
  ConflictItem,
  DisruptionClosureRequest,
  DisruptionDelayRequest,
  DisruptionRecord,
  PlatformInfo,
  ReplanResult,
  ScheduleHistoryEntry,
  ScheduleValidationResult,
  StationProfile,
  TrainScheduleItem,
} from '../types/railway';
import { api, ApiHealthStatus, StationSnapshot } from '../services/api';
import { INITIAL_TIMETABLES, STATIONS } from '../server/data';

interface RailwayContextType {
  selectedStation: string;
  stations: StationProfile[];
  currentStationProfile: StationProfile | undefined;
  platforms: PlatformInfo[];
  timetable: TrainScheduleItem[];
  conflicts: ConflictItem[];
  validation: ScheduleValidationResult | null;
  candidateReplan: ReplanResult | null;
  originalScheduleSnapshot: TrainScheduleItem[] | null;
  history: ScheduleHistoryEntry[];
  disruptions: DisruptionRecord[];
  health: ApiHealthStatus;
  isLoading: boolean;
  error: string | null;
  isFixtureMode: boolean;
  theme: 'dark' | 'light';
  lastRefreshTime: Date | null;
  assistantMessages: AssistantMessage[];
  changeStation: (stationCode: string) => void;
  refreshData: () => Promise<void>;
  submitDelay: (req: DisruptionDelayRequest) => Promise<{ success: boolean; message: string }>;
  submitClosure: (req: DisruptionClosureRequest) => Promise<{ success: boolean; message: string }>;
  reopenPlatform: (platformId: string) => Promise<{ success: boolean; message: string }>;
  replanSchedule: () => Promise<ReplanResult>;
  runFrontendValidation: (scheduleToValidate?: TrainScheduleItem[]) => Promise<ScheduleValidationResult>;
  adoptCandidate: () => Promise<void>;
  discardCandidate: () => void;
  resetSchedule: () => Promise<void>;
  toggleFixtureMode: () => void;
  toggleTheme: () => void;
  checkHealth: () => Promise<void>;
  sendAssistantMessage: (text: string) => Promise<void>;
  executeAssistantPayload: (
    payload: NonNullable<AssistantMessage['quickActionPayload']>,
    messageId: string
  ) => Promise<void>;
}

const RailwayContext = createContext<RailwayContextType | undefined>(undefined);

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const fixtureState = (stationCode: string): StationSnapshot => ({
  profile: STATIONS[stationCode],
  platforms: clone(STATIONS[stationCode]?.platforms || []),
  timetable: clone(INITIAL_TIMETABLES[stationCode] || []),
  conflicts: [],
  validation: null as unknown as ScheduleValidationResult,
});

export const RailwayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = fixtureState('ST01');
  const [selectedStation, setSelectedStation] = useState('ST01');
  const [stations, setStations] = useState<StationProfile[]>(Object.values(STATIONS));
  const [platforms, setPlatforms] = useState<PlatformInfo[]>(initial.platforms);
  const [timetable, setTimetable] = useState<TrainScheduleItem[]>(initial.timetable);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [validation, setValidation] = useState<ScheduleValidationResult | null>(null);
  const [candidateReplan, setCandidateReplan] = useState<ReplanResult | null>(null);
  const [originalScheduleSnapshot, setOriginalScheduleSnapshot] = useState<TrainScheduleItem[] | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([]);
  const [disruptions] = useState<DisruptionRecord[]>([]);
  const [health, setHealth] = useState<ApiHealthStatus>({ isOnline: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFixtureMode, setIsFixtureMode] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-msg-1',
      sender: 'assistant',
      text: 'RailFlow Operations Assistant connected to the backend. Ask about conflicts, delays, closures, validation, or replanning.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const applySnapshot = useCallback((snapshot: StationSnapshot) => {
    setPlatforms(snapshot.platforms);
    setTimetable(snapshot.timetable);
    setConflicts(snapshot.conflicts);
    setValidation(snapshot.validation);
    setSelectedStation(snapshot.profile.station_code);
    setIsFixtureMode(false);
    setLastRefreshTime(new Date());
  }, []);

  const loadBackendState = useCallback(async (stationCode?: string) => {
    const snapshot = await api.getSnapshot(stationCode);
    applySnapshot(snapshot);
    try {
      setHistory(await api.getHistory());
    } catch {
      setHistory([]);
    }
    setError(null);
  }, [applySnapshot]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setIsLoading(true);
      const status = await api.checkHealth();
      if (!active) return;
      setHealth(status);
      if (!status.isOnline) {
        setError(`Backend unavailable at the configured local API. Start FastAPI to load authoritative timetable data.`);
        setIsLoading(false);
        return;
      }
      try {
        const availableStations = await api.getStations();
        if (active && availableStations.length) setStations(availableStations);
        await loadBackendState();
      } catch (err: any) {
        if (active) setError(err.message || 'Unable to load the backend timetable.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [loadBackendState]);

  const checkHealth = async () => {
    const status = await api.checkHealth();
    setHealth(status);
    if (status.isOnline) setError(null);
  };

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await api.checkHealth();
      setHealth(status);
      if (!status.isOnline) throw new Error(status.error || 'Backend is unreachable.');
      const availableStations = await api.getStations();
      if (availableStations.length) setStations(availableStations);
      await loadBackendState(selectedStation);
    } catch (err: any) {
      setError(err.message || 'Unable to refresh authoritative backend state.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const changeStation = (stationCode: string) => {
    if (stationCode === selectedStation || isLoading) return;
    const seed = fixtureState(stationCode);
    setIsLoading(true);
    setError(null);
    void api
      .replanSchedule(stationCode, seed.timetable, seed.platforms, seed.profile?.min_headway_minutes || 5)
      .then(async (result) => {
        if (result.status !== 'VALID_FOUND') throw new Error(result.message);
        setOriginalScheduleSnapshot(seed.timetable);
        setCandidateReplan(result);
        await loadBackendState(stationCode);
      })
      .catch((err: any) => setError(err.message || `Unable to select station ${stationCode}.`))
      .finally(() => setIsLoading(false));
  };

  const applyServerResult = async (result: ReplanResult, original: TrainScheduleItem[]) => {
    if (result.status !== 'VALID_FOUND' || result.validation.validation_state !== 'VALID') {
      throw new Error(result.message || 'The backend did not produce an independently valid schedule.');
    }
    setOriginalScheduleSnapshot(clone(original));
    setCandidateReplan(result);
    await loadBackendState(result.station_code);
  };

  const submitDelay = async (req: DisruptionDelayRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!health.isOnline) throw new Error('Backend is offline; no disruption was applied.');
      const raw = await api.submitTrainDelay(req);
      const result = api.toReplanResult(raw, timetable, selectedStation, conflicts.length);
      await applyServerResult(result, timetable);
      setTimetable((current) => current.map((train) =>
        train.train_id === req.train_id
          ? { ...train, status: 'DELAYED', delay_minutes: req.delay_minutes }
          : train
      ));
      return { success: true, message: `${result.message} The revised timetable passed the authoritative backend validator.` };
    } catch (err: any) {
      setError(err.message || 'Delay request failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const submitClosure = async (req: DisruptionClosureRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!health.isOnline) throw new Error('Backend is offline; no closure was applied.');
      const raw = await api.submitPlatformClosure(req);
      const result = api.toReplanResult(raw, timetable, selectedStation, conflicts.length);
      await applyServerResult(result, timetable);
      return { success: true, message: `${result.message} The revised timetable passed the authoritative backend validator.` };
    } catch (err: any) {
      setError(err.message || 'Closure request failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reopenPlatform = async (platformId: string) => {
    throw new Error(`Platform reopening is not supported by the backend API (${platformId}).`);
  };

  const replanSchedule = async (): Promise<ReplanResult> => {
    setIsLoading(true);
    setError(null);
    try {
      if (!health.isOnline) throw new Error('Backend is offline; no replan was requested.');
      const profile = stations.find((station) => station.station_code === selectedStation);
      const result = await api.replanSchedule(
        selectedStation,
        timetable,
        platforms,
        profile?.min_headway_minutes || 5,
        conflicts.length
      );
      await applyServerResult(result, timetable);
      return result;
    } catch (err: any) {
      setError(err.message || 'Replanning failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const runFrontendValidation = async (scheduleToValidate?: TrainScheduleItem[]) => {
    const result = await api.validateSchedule(
      selectedStation,
      scheduleToValidate || timetable,
      platforms,
      stations.find((station) => station.station_code === selectedStation)?.min_headway_minutes || 5
    );
    setValidation(result);
    return result;
  };

  const adoptCandidate = async () => {
    if (!candidateReplan || candidateReplan.validation.validation_state !== 'VALID') {
      throw new Error('Only an independently validated backend result can be acknowledged.');
    }
    setCandidateReplan(null);
    setOriginalScheduleSnapshot(null);
  };

  const discardCandidate = () => {
    // The backend commits VALID_FOUND schedules immediately. This only closes the local review panel;
    // it never pretends that the active backend timetable was rolled back.
    setCandidateReplan(null);
    setOriginalScheduleSnapshot(null);
  };

  const resetSchedule = async () => {
    throw new Error('Reset is not supported by the backend API. Restart the local server to reset in-memory state.');
  };

  const toggleFixtureMode = () => setIsFixtureMode((current) => !current);
  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  const sendAssistantMessage = async (text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setAssistantMessages((messages) => [...messages, { id: `user-${Date.now()}`, sender: 'user', text, timestamp: now }]);
    let reply = 'Ask about current conflicts, a train delay, a platform closure, validation, or a backend replan.';
    if (text.toLowerCase().includes('conflict')) reply = `${conflicts.length} backend conflict(s) are currently reported for ${selectedStation}.`;
    if (text.toLowerCase().includes('validation')) reply = `Authoritative backend validation is ${validation?.validation_state || 'not loaded'}.`;
    setAssistantMessages((messages) => [...messages, { id: `assistant-${Date.now()}`, sender: 'assistant', text: reply, timestamp: now }]);
  };

  const executeAssistantPayload = async () => {
    // The backend parser is available through the API service; assistant quick actions remain explicit UI actions.
  };

  const currentStationProfile = stations.find((station) => station.station_code === selectedStation);

  return (
    <RailwayContext.Provider
      value={{
        selectedStation,
        stations,
        currentStationProfile,
        platforms,
        timetable,
        conflicts,
        validation,
        candidateReplan,
        originalScheduleSnapshot,
        history,
        disruptions,
        health,
        isLoading,
        error,
        isFixtureMode,
        theme,
        lastRefreshTime,
        assistantMessages,
        changeStation,
        refreshData,
        submitDelay,
        submitClosure,
        reopenPlatform,
        replanSchedule,
        runFrontendValidation,
        adoptCandidate,
        discardCandidate,
        resetSchedule,
        toggleFixtureMode,
        toggleTheme,
        checkHealth,
        sendAssistantMessage,
        executeAssistantPayload,
      }}
    >
      {children}
    </RailwayContext.Provider>
  );
};

export const useRailway = (): RailwayContextType => {
  const context = useContext(RailwayContext);
  if (!context) throw new Error('useRailway must be used within a RailwayProvider');
  return context;
};
