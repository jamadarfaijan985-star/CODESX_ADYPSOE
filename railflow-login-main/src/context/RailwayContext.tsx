import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  StationProfile,
  PlatformInfo,
  TrainScheduleItem,
  ConflictItem,
  ScheduleValidationResult,
  ReplanResult,
  DisruptionDelayRequest,
  DisruptionClosureRequest,
  ScheduleHistoryEntry,
  DisruptionRecord,
  AssistantMessage,
} from '../types/railway';
import { STATIONS, INITIAL_TIMETABLES } from '../server/data';
import { api, ApiHealthStatus } from '../services/api';
import { runDemoValidation } from '../services/demoValidator';
import {
  extractConflictsFromSchedule,
  timeToMinutes,
  minutesToTime,
} from '../server/validator';
import { generateReplanCandidate } from '../server/scheduler';

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

  // Actions
  changeStation: (stationCode: string) => void;
  refreshData: () => Promise<void>;
  submitDelay: (req: DisruptionDelayRequest) => Promise<{ success: boolean; message: string }>;
  submitClosure: (req: DisruptionClosureRequest) => Promise<{ success: boolean; message: string }>;
  reopenPlatform: (platformId: string) => Promise<{ success: boolean; message: string }>;
  replanSchedule: () => Promise<ReplanResult>;
  runFrontendValidation: (scheduleToValidate?: TrainScheduleItem[]) => ScheduleValidationResult;
  adoptCandidate: () => Promise<void>;
  discardCandidate: () => void;
  resetSchedule: () => Promise<void>;
  toggleFixtureMode: () => void;
  toggleTheme: () => void;
  checkHealth: () => Promise<void>;
  sendAssistantMessage: (text: string) => Promise<void>;
  executeAssistantPayload: (payload: NonNullable<AssistantMessage['quickActionPayload']>, messageId: string) => Promise<void>;
}

const RailwayContext = createContext<RailwayContextType | undefined>(undefined);

export const RailwayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedStation, setSelectedStation] = useState<string>('ST01');
  const [stations] = useState<StationProfile[]>(Object.values(STATIONS));
  const [platforms, setPlatforms] = useState<PlatformInfo[]>(() =>
    JSON.parse(JSON.stringify(STATIONS['ST01'].platforms))
  );
  const [timetable, setTimetable] = useState<TrainScheduleItem[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_TIMETABLES['ST01']))
  );
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [validation, setValidation] = useState<ScheduleValidationResult | null>(null);
  const [candidateReplan, setCandidateReplan] = useState<ReplanResult | null>(null);
  const [originalScheduleSnapshot, setOriginalScheduleSnapshot] = useState<TrainScheduleItem[] | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([]);
  const [disruptions, setDisruptions] = useState<DisruptionRecord[]>([]);
  const [health, setHealth] = useState<ApiHealthStatus>({ isOnline: false });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFixtureMode, setIsFixtureMode] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(new Date());

  // Operations Assistant Chat Thread
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 'init-msg-1',
      sender: 'assistant',
      text: 'RailFlow Operations Assistant active. I can analyze timetable conflicts, forecast impacts of proposed delays, verify platform closures, and compare replan candidates. Select a prompt below or type your inquiry.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Evaluates conflicts and demo validation on local data
  const recomputeState = useCallback(
    (
      currentTimetable: TrainScheduleItem[],
      currentPlatforms: PlatformInfo[],
      stCode: string
    ) => {
      const headway = STATIONS[stCode]?.min_headway_minutes || 5;
      const detected = extractConflictsFromSchedule(currentTimetable, currentPlatforms, headway);
      setConflicts(detected);

      const val = runDemoValidation({
        stationCode: stCode,
        schedule: currentTimetable,
        platforms: currentPlatforms,
        minHeadwayMinutes: headway,
      });
      setValidation(val);
      return { detected, val };
    },
    []
  );

  // Initialize state on first mount
  useEffect(() => {
    const initialSchedule = JSON.parse(JSON.stringify(INITIAL_TIMETABLES['ST01']));
    const initialPlat = JSON.parse(JSON.stringify(STATIONS['ST01'].platforms));
    setTimetable(initialSchedule);
    setPlatforms(initialPlat);
    setOriginalScheduleSnapshot(JSON.parse(JSON.stringify(initialSchedule)));

    const { detected, val } = recomputeState(initialSchedule, initialPlat, 'ST01');

    setHistory([
      {
        entry_id: `HIST-INIT-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: 'SCH-BASELINE-ST01',
        station_code: 'ST01',
        action_type: 'BASELINE_LOAD',
        summary: 'Baseline nominal timetable loaded for Central Junction (ST01) in Demo Mode.',
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: initialSchedule.length,
        snapshot: JSON.parse(JSON.stringify(initialSchedule)),
      },
    ]);

    // Quietly probe backend health
    api.checkHealth().then((h) => {
      setHealth(h);
    }).catch(() => {
      setHealth({ isOnline: false, error: 'Backend unreachable - using autonomous client demo mode' });
    });
  }, [recomputeState]);

  const changeStation = useCallback(
    (stationCode: string) => {
      setSelectedStation(stationCode);
      const newSchedule = JSON.parse(JSON.stringify(INITIAL_TIMETABLES[stationCode] || []));
      const newPlatforms = JSON.parse(JSON.stringify(STATIONS[stationCode]?.platforms || []));

      setTimetable(newSchedule);
      setPlatforms(newPlatforms);
      setCandidateReplan(null);
      setOriginalScheduleSnapshot(JSON.parse(JSON.stringify(newSchedule)));
      setDisruptions([]);

      const { detected, val } = recomputeState(newSchedule, newPlatforms, stationCode);
      setLastRefreshTime(new Date());

      setHistory((prev) => [
        {
          entry_id: `HIST-STN-${Date.now().toString(36).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          schedule_id: `SCH-${stationCode}-LOAD`,
          station_code: stationCode,
          action_type: 'BASELINE_LOAD',
          summary: `Switched operational workspace to ${STATIONS[stationCode]?.station_name || stationCode}.`,
          validation_state: val.validation_state,
          conflicts_count: detected.length,
          train_count: newSchedule.length,
          snapshot: JSON.parse(JSON.stringify(newSchedule)),
        },
        ...prev,
      ]);
    },
    [recomputeState]
  );

  const refreshData = async () => {
    setIsLoading(true);
    try {
      if (health.isOnline) {
        try {
          const [platList, timeList, confList, valResult] = await Promise.all([
            api.getPlatforms(selectedStation),
            api.getTimetable(selectedStation),
            api.getConflicts(selectedStation),
            api.validateSchedule(selectedStation),
          ]);
          setPlatforms(platList);
          setTimetable(timeList);
          setConflicts(confList);
          setValidation(valResult);
        } catch {
          recomputeState(timetable, platforms, selectedStation);
        }
      } else {
        recomputeState(timetable, platforms, selectedStation);
      }
      setLastRefreshTime(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  const submitDelay = async (req: DisruptionDelayRequest) => {
    if (!originalScheduleSnapshot && timetable.length > 0) {
      setOriginalScheduleSnapshot(JSON.parse(JSON.stringify(timetable)));
    }

    const train = timetable.find((t) => t.train_id === req.train_id);
    if (!train) {
      throw new Error(`Train ${req.train_id} not found in timetable for ${selectedStation}`);
    }

    if (req.delay_minutes < 0) {
      throw new Error('Delay minutes cannot be negative');
    }

    const origArr = timeToMinutes(train.arrival_time);
    const origDep = timeToMinutes(train.departure_time);
    const dwell = origDep - origArr;

    const newArr = origArr + req.delay_minutes;
    const newDep = newArr + dwell;

    const updatedSchedule = timetable.map((t) => {
      if (t.train_id === req.train_id) {
        const warnings = t.warnings ? [...t.warnings] : [];
        warnings.push(`Delay +${req.delay_minutes}m applied (${req.reason || 'Operational delay'})`);
        return {
          ...t,
          delay_minutes: t.delay_minutes + req.delay_minutes,
          arrival_time: minutesToTime(newArr),
          departure_time: minutesToTime(newDep),
          status: 'DELAYED' as const,
          warnings,
          notes: req.notes ? `${t.notes || ''} | Incident: ${req.notes}` : t.notes,
        };
      }
      return t;
    });

    setTimetable(updatedSchedule);
    setCandidateReplan(null);

    const disruptionRecord: DisruptionRecord = {
      disruption_id: `DISR-DELAY-${Date.now().toString(36).toUpperCase()}`,
      type: 'TRAIN_DELAY',
      station_code: selectedStation,
      entity_id: req.train_id,
      parameters: { delay_minutes: req.delay_minutes, new_arrival: minutesToTime(newArr) },
      reported_at: new Date().toISOString(),
      reason: req.reason || 'Operational delay',
      notes: req.notes,
      status: 'ACTIVE',
    };
    setDisruptions((prev) => [disruptionRecord, ...prev]);

    const { detected, val } = recomputeState(updatedSchedule, platforms, selectedStation);

    setHistory((prev) => [
      {
        entry_id: `HIST-DEL-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: `SCH-${Date.now().toString(36).toUpperCase()}`,
        station_code: selectedStation,
        action_type: 'DELAY_REGISTERED',
        summary: `Train ${req.train_id} delayed by +${req.delay_minutes}m (${req.reason || 'Operational delay'}). Updated arrival: ${minutesToTime(newArr)}.`,
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: updatedSchedule.length,
        snapshot: JSON.parse(JSON.stringify(updatedSchedule)),
        affected_target: req.train_id,
      },
      ...prev,
    ]);

    // Forward to backend if online
    if (health.isOnline) {
      api.submitTrainDelay({ ...req, station_code: selectedStation }).catch(() => {});
    }

    return {
      success: true,
      message: `Delay of ${req.delay_minutes} minutes registered for train ${req.train_id}. Updated arrival: ${minutesToTime(newArr)}. ${detected.length} conflict(s) detected.`,
    };
  };

  const submitClosure = async (req: DisruptionClosureRequest) => {
    if (!originalScheduleSnapshot && timetable.length > 0) {
      setOriginalScheduleSnapshot(JSON.parse(JSON.stringify(timetable)));
    }

    const plat = platforms.find((p) => p.platform_id === req.platform_id);
    if (!plat) {
      throw new Error(`Platform ${req.platform_id} not found in station ${selectedStation}`);
    }

    const startMin = timeToMinutes(req.closure_start);
    const endMin = timeToMinutes(req.closure_end);

    if (startMin < 0 || endMin < 0 || endMin <= startMin) {
      throw new Error(`Invalid closure window: ${req.closure_start} - ${req.closure_end}. Start must precede end.`);
    }

    const updatedPlatforms = platforms.map((p) => {
      if (p.platform_id === req.platform_id) {
        return {
          ...p,
          is_closed: true,
          closure_start: req.closure_start,
          closure_end: req.closure_end,
          closure_reason: req.reason || 'Track maintenance',
        };
      }
      return p;
    });

    setPlatforms(updatedPlatforms);
    setCandidateReplan(null);

    const disruptionRecord: DisruptionRecord = {
      disruption_id: `CLOS-${Date.now().toString(36).toUpperCase()}`,
      type: 'PLATFORM_CLOSURE',
      station_code: selectedStation,
      entity_id: req.platform_id,
      parameters: { closure_start: req.closure_start, closure_end: req.closure_end },
      reported_at: new Date().toISOString(),
      reason: req.reason || 'Track maintenance closure',
      notes: req.notes,
      status: 'ACTIVE',
    };
    setDisruptions((prev) => [disruptionRecord, ...prev]);

    const { detected, val } = recomputeState(timetable, updatedPlatforms, selectedStation);

    setHistory((prev) => [
      {
        entry_id: `HIST-CLS-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: `SCH-${Date.now().toString(36).toUpperCase()}`,
        station_code: selectedStation,
        action_type: 'PLATFORM_CLOSURE_REGISTERED',
        summary: `Platform ${req.platform_id} closed from ${req.closure_start} to ${req.closure_end} (${req.reason || 'Maintenance'}).`,
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: timetable.length,
        snapshot: JSON.parse(JSON.stringify(timetable)),
        affected_target: req.platform_id,
      },
      ...prev,
    ]);

    if (health.isOnline) {
      api.submitPlatformClosure({ ...req, station_code: selectedStation }).catch(() => {});
    }

    return {
      success: true,
      message: `Platform ${req.platform_id} closed from ${req.closure_start} to ${req.closure_end}. Conflicts flagged: ${detected.length}.`,
    };
  };

  const reopenPlatform = async (platformId: string) => {
    const updatedPlatforms = platforms.map((p) => {
      if (p.platform_id === platformId) {
        return {
          ...p,
          is_closed: false,
          closure_start: undefined,
          closure_end: undefined,
          closure_reason: undefined,
        };
      }
      return p;
    });

    setPlatforms(updatedPlatforms);
    setCandidateReplan(null);

    const { detected, val } = recomputeState(timetable, updatedPlatforms, selectedStation);

    setHistory((prev) => [
      {
        entry_id: `HIST-REOPEN-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: `SCH-${Date.now().toString(36).toUpperCase()}`,
        station_code: selectedStation,
        action_type: 'DISRUPTION_CLOSURE',
        summary: `Platform track ${platformId} reopened for regular operational service.`,
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: timetable.length,
        snapshot: JSON.parse(JSON.stringify(timetable)),
        affected_target: platformId,
      },
      ...prev,
    ]);

    if (health.isOnline) {
      api.reopenPlatform(platformId, selectedStation).catch(() => {});
    }

    return { success: true, message: `Platform ${platformId} reopened.` };
  };

  const replanSchedule = async (): Promise<ReplanResult> => {
    if (!originalScheduleSnapshot) {
      setOriginalScheduleSnapshot(JSON.parse(JSON.stringify(timetable)));
    }

    const headway = STATIONS[selectedStation]?.min_headway_minutes || 5;

    // Use scheduler engine locally
    const result = generateReplanCandidate({
      station_code: selectedStation,
      currentSchedule: timetable,
      platforms,
      min_headway_minutes: headway,
    });

    result.is_illustrative_candidate = true;
    result.selection_status = 'UNDER_REVIEW';

    setCandidateReplan(result);

    setHistory((prev) => [
      {
        entry_id: `HIST-REPLAN-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: result.replan_id,
        station_code: selectedStation,
        action_type: 'CANDIDATE_CREATED',
        summary: `Illustrative candidate ${result.replan_id} created: ${result.change_summary.conflicts_resolved} conflicts resolved, ${result.change_summary.platform_changes} platform change(s).`,
        validation_state: result.validation.validation_state,
        conflicts_count: result.validation.total_violations,
        train_count: result.candidate_schedule.length,
        snapshot: JSON.parse(JSON.stringify(result.candidate_schedule)),
      },
      ...prev,
    ]);

    return result;
  };

  const runFrontendValidation = (scheduleToValidate?: TrainScheduleItem[]): ScheduleValidationResult => {
    const list = scheduleToValidate || timetable;
    const headway = STATIONS[selectedStation]?.min_headway_minutes || 5;
    const res = runDemoValidation({
      stationCode: selectedStation,
      schedule: list,
      platforms,
      minHeadwayMinutes: headway,
    });

    if (!scheduleToValidate) {
      setValidation(res);
      setHistory((prev) => [
        {
          entry_id: `HIST-VAL-${Date.now().toString(36).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          schedule_id: res.schedule_id,
          station_code: selectedStation,
          action_type: 'DEMO_VALIDATION_COMPLETED',
          summary: `Demo validation finished: ${res.validation_state} (${res.total_violations} violation(s) identified).`,
          validation_state: res.validation_state,
          conflicts_count: res.total_violations,
          train_count: list.length,
          snapshot: JSON.parse(JSON.stringify(list)),
        },
        ...prev,
      ]);
    }

    return res;
  };

  const adoptCandidate = async () => {
    if (!candidateReplan) {
      throw new Error('No candidate schedule exists to adopt.');
    }

    if (candidateReplan.validation.validation_state !== 'VALID') {
      throw new Error(
        `Safety policy violation: Cannot adopt candidate schedule with state "${candidateReplan.validation.validation_state}". Only independently confirmed VALID schedules may be adopted.`
      );
    }

    const adoptedSchedule = JSON.parse(JSON.stringify(candidateReplan.candidate_schedule));
    setTimetable(adoptedSchedule);

    const { detected, val } = recomputeState(adoptedSchedule, platforms, selectedStation);

    setHistory((prev) => [
      {
        entry_id: `HIST-ADOPT-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: candidateReplan.replan_id,
        station_code: selectedStation,
        action_type: 'CANDIDATE_SELECTED',
        summary: `Illustrative candidate ${candidateReplan.replan_id} adopted as authoritative timetable.`,
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: adoptedSchedule.length,
        snapshot: JSON.parse(JSON.stringify(adoptedSchedule)),
      },
      ...prev,
    ]);

    setCandidateReplan(null);
    setOriginalScheduleSnapshot(null);
  };

  const discardCandidate = () => {
    if (candidateReplan) {
      setHistory((prev) => [
        {
          entry_id: `HIST-DISC-${Date.now().toString(36).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          schedule_id: candidateReplan.replan_id,
          station_code: selectedStation,
          action_type: 'CANDIDATE_REJECTED',
          summary: `Candidate schedule ${candidateReplan.replan_id} rejected and discarded by operator.`,
          validation_state: candidateReplan.validation.validation_state,
          conflicts_count: candidateReplan.validation.total_violations,
          train_count: candidateReplan.candidate_schedule.length,
          snapshot: JSON.parse(JSON.stringify(timetable)),
        },
        ...prev,
      ]);
    }
    setCandidateReplan(null);
  };

  const resetSchedule = async () => {
    const baseline = JSON.parse(JSON.stringify(INITIAL_TIMETABLES[selectedStation] || []));
    const plats = JSON.parse(JSON.stringify(STATIONS[selectedStation]?.platforms || []));

    setTimetable(baseline);
    setPlatforms(plats);
    setCandidateReplan(null);
    setOriginalScheduleSnapshot(null);
    setDisruptions([]);

    const { detected, val } = recomputeState(baseline, plats, selectedStation);

    setHistory((prev) => [
      {
        entry_id: `HIST-RST-${Date.now().toString(36).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        schedule_id: `SCH-RESET-${Date.now().toString(36).toUpperCase()}`,
        station_code: selectedStation,
        action_type: 'DEMO_RESET',
        summary: `Timetable and platform tracks reset to initial nominal baseline for ${selectedStation}.`,
        validation_state: val.validation_state,
        conflicts_count: detected.length,
        train_count: baseline.length,
        snapshot: JSON.parse(JSON.stringify(baseline)),
      },
      ...prev,
    ]);

    if (health.isOnline) {
      api.resetTimetable(selectedStation).catch(() => {});
    }
  };

  const toggleFixtureMode = () => {
    setIsFixtureMode((prev) => !prev);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const checkHealth = async () => {
    const status = await api.checkHealth();
    setHealth(status);
  };

  // Assistant Chat Processing
  const sendAssistantMessage = async (userText: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: AssistantMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: timeStr,
    };

    setAssistantMessages((prev) => [...prev, userMsg]);

    const clean = userText.toLowerCase().trim();
    let replyText = '';
    let quickPayload: AssistantMessage['quickActionPayload'];

    if (clean.includes('conflict') || clean.includes('overlap')) {
      if (conflicts.length === 0) {
        replyText = `Nominal conditions: 0 active conflicts detected at ${selectedStation}. All ${timetable.length} scheduled trains satisfy headway and platform clearance constraints.`;
      } else {
        replyText = `Alert: ${conflicts.length} active conflict(s) detected at ${selectedStation}. \n` +
          conflicts.map((c, i) => `${i + 1}. [${c.severity}] ${c.description}`).join('\n') +
          `\n\nWould you like me to prepare an illustrative replan candidate to reallocate tracks?`;
        quickPayload = {
          type: 'REPLAN',
          description: `Generate replan candidate to resolve ${conflicts.length} conflict(s)`,
          parameters: { station_code: selectedStation },
        };
      }
    } else if (clean.includes('t102') && clean.includes('delay')) {
      replyText = `Impact analysis for Train T102 (+15m delay):\n- Scheduled arrival shifts from 08:35 to 08:50.\n- Platform P1 is occupied by T101 until 08:25.\n- Dwell window shifts to 08:50 - 09:10.\n- Ready to apply this delay to the local demonstration schedule?`;
      quickPayload = {
        type: 'DELAY',
        description: 'Register +15m delay for Train T102',
        parameters: { train_id: 'T102', delay_minutes: 15, reason: 'Locomotive power issue' },
      };
    } else if (clean.includes('closure') || clean.includes('close platform')) {
      const closed = platforms.filter((p) => p.is_closed);
      if (closed.length === 0) {
        replyText = `All ${platforms.length} platform tracks are currently OPEN at ${selectedStation}. \nYou can simulate a track blockade (e.g. Platform P2 from 08:30 to 10:00).`;
        quickPayload = {
          type: 'CLOSURE',
          description: 'Simulate Platform P2 maintenance closure (08:30 - 10:00)',
          parameters: { platform_id: 'P2', closure_start: '08:30', closure_end: '10:00', reason: 'Track maintenance' },
        };
      } else {
        replyText = `Active Closures at ${selectedStation}:\n` +
          closed.map((p) => `· Platform ${p.platform_id} (${p.closure_start} - ${p.closure_end}): ${p.closure_reason}`).join('\n');
      }
    } else if (clean.includes('compare') || clean.includes('replan')) {
      if (candidateReplan) {
        replyText = `Candidate schedule ${candidateReplan.replan_id} is ready for review:\n- Platform reallocations: ${candidateReplan.change_summary.platform_changes}\n- Time shifts: ${candidateReplan.change_summary.time_shifts}\n- Conflicts resolved: ${candidateReplan.change_summary.conflicts_resolved}\n- Validation state: ${candidateReplan.validation.validation_state}`;
      } else {
        replyText = `No candidate schedule is currently under review. If conflicts exist or disruptions occur, generate a replan candidate.`;
        quickPayload = {
          type: 'REPLAN',
          description: 'Generate new replan candidate',
          parameters: { station_code: selectedStation },
        };
      }
    } else if (clean.includes('validation') || clean.includes('validate')) {
      const vState = validation?.validation_state || 'UNRESOLVED';
      replyText = `Validation Status: ${vState} (${validation?.total_violations || 0} violations).\n` +
        (validation?.checks_run || []).map((c) => `· ${c.name}: ${c.status}`).join('\n');
      quickPayload = {
        type: 'VALIDATE',
        description: 'Run frontend demonstration validation',
        parameters: {},
      };
    } else {
      replyText = `Query received. You can ask about:\n1. "Show current platform conflicts"\n2. "What is affected by train T102 being delayed by 15 minutes?"\n3. "Show platforms affected by a closure"\n4. "Compare original and candidate schedules"\n5. "Show latest validation results"`;
    }

    const assistantMsg: AssistantMessage = {
      id: `ast-${Date.now()}`,
      sender: 'assistant',
      text: replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickActionPayload: quickPayload,
    };

    setAssistantMessages((prev) => [...prev, assistantMsg]);
  };

  const executeAssistantPayload = async (
    payload: NonNullable<AssistantMessage['quickActionPayload']>,
    messageId: string
  ) => {
    if (payload.type === 'DELAY') {
      await submitDelay({
        train_id: payload.parameters.train_id,
        delay_minutes: payload.parameters.delay_minutes,
        reason: payload.parameters.reason,
        station_code: selectedStation,
      });
    } else if (payload.type === 'CLOSURE') {
      await submitClosure({
        platform_id: payload.parameters.platform_id,
        closure_start: payload.parameters.closure_start,
        closure_end: payload.parameters.closure_end,
        reason: payload.parameters.reason,
        station_code: selectedStation,
      });
    } else if (payload.type === 'REPLAN') {
      await replanSchedule();
    } else if (payload.type === 'VALIDATE') {
      runFrontendValidation();
    }

    setAssistantMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, actionCompleted: true } : m))
    );
  };

  const currentStationProfile = stations.find((s) => s.station_code === selectedStation);

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
  if (!context) {
    throw new Error('useRailway must be used within a RailwayProvider');
  }
  return context;
};
