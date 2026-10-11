import {
  ConflictItem,
  DisruptionClosureRequest,
  DisruptionDelayRequest,
  DelayForecastRequest,
  DelayForecastResult,
  PlatformInfo,
  ReplanResult,
  ScheduleHistoryEntry,
  ScheduleValidationResult,
  StationProfile,
  TrainScheduleItem,
} from '../types/railway';

const configuredBase = String(import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000')
  .replace(/\/$/, '');
const BASE_URL = configuredBase.endsWith('/api') ? configuredBase : `${configuredBase}/api`;

export interface ApiHealthStatus {
  isOnline: boolean;
  version?: string;
  schedulerStatus?: string;
  independentValidator?: string;
  latencyMs?: number;
  lastChecked?: string;
  error?: string;
}

interface BackendPlatform {
  id: string;
  closed_intervals: Array<[number, number]>;
  availability_intervals: Array<[number, number]>;
  supported_train_ids: string[] | null;
}

interface BackendTrain {
  id: string;
  arrival: number;
  departure: number;
  platform_id: string;
  mandatory_platform_id?: string | null;
}

interface BackendTimetable {
  station_id: string;
  station_name: string;
  station_illustrative: boolean;
  minimum_gap_minutes: number;
  platforms: BackendPlatform[];
  trains: BackendTrain[];
  station?: { id: string; name: string; fictional?: boolean; illustrative?: boolean };
}

interface BackendValidation {
  status: 'PASS' | 'FAIL';
  valid: boolean;
  violations: Array<Record<string, any>>;
  violation_count: number;
}

interface BackendResult {
  status: 'VALID_FOUND' | 'INFEASIBLE_UNDER_MODEL' | 'ERROR';
  message: string;
  schedule: BackendTimetable | null;
  validation: BackendValidation | null;
  nodes_examined?: number;
  disruption?: Record<string, any>;
}

export interface StationSnapshot {
  profile: StationProfile;
  platforms: PlatformInfo[];
  timetable: TrainScheduleItem[];
  conflicts: ConflictItem[];
  validation: ScheduleValidationResult;
}

const minutesToTime = (minutes: number): string => {
  const normalized = Math.max(0, minutes) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
};

export const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return -1;
  return hours * 60 + minutes;
};

const mapPlatforms = (raw: BackendPlatform[], stationId: string): PlatformInfo[] =>
  raw.map((platform) => {
    const closure = platform.closed_intervals[0];
    return {
      platform_id: platform.id,
      station_code: stationId,
      name: `Platform ${platform.id}`,
      length_meters: 0,
      is_electrified: true,
      is_closed: platform.closed_intervals.length > 0,
      closure_reason: closure ? 'Backend platform closure' : undefined,
      closure_start: closure ? minutesToTime(closure[0]) : undefined,
      closure_end: closure ? minutesToTime(closure[1]) : undefined,
      track_type: 'MAIN',
    };
  });

const mapTimetable = (raw: BackendTimetable): TrainScheduleItem[] =>
  raw.trains.map((train) => ({
    train_id: train.id,
    train_name: train.id,
    station_code: raw.station_id,
    arrival_time: minutesToTime(train.arrival),
    departure_time: minutesToTime(train.departure),
    platform_id: train.platform_id,
    status: 'ON_TIME',
    delay_minutes: 0,
    direction: 'THROUGH',
    clearance_minutes: raw.minimum_gap_minutes,
    notes: train.mandatory_platform_id
      ? `Mandatory platform ${train.mandatory_platform_id}.`
      : undefined,
  }));

const mapProfile = (raw: any): StationProfile => ({
  station_code: raw.station_id,
  station_name: raw.display_name,
  code_type: 'FICTIONAL_PROFILE',
  total_platforms: raw.platforms.length,
  min_headway_minutes: raw.minimum_gap_minutes,
  platforms: mapPlatforms(raw.platforms, raw.station_id),
  description: raw.description || '',
});

const conflictType = (type: string): ConflictItem['conflict_type'] => {
  switch (type) {
    case 'MINIMUM_GAP':
      return 'MINIMUM_CLEARANCE_VIOLATION';
    case 'PLATFORM_CLOSED':
      return 'CLOSED_PLATFORM_ASSIGNMENT';
    default:
      return 'PLATFORM_OVERLAP';
  }
};

const mapConflicts = (raw: Array<Record<string, any>>): ConflictItem[] =>
  raw.map((violation, index) => {
    const trainIds = violation.train_ids || (violation.train_id ? [violation.train_id] : []);
    const type = String(violation.type || 'UNKNOWN_PLATFORM');
    return {
      conflict_id: `BACKEND-${index + 1}-${type}`,
      conflict_type: conflictType(type),
      affected_trains: trainIds,
      platform_id: violation.platform_id || 'UNKNOWN',
      time_interval: { start: '', end: '' },
      severity: type === 'OVERLAP' ? 'CRITICAL' : 'HIGH',
      description: violation.message || type,
      resolution_status: 'UNRESOLVED',
      detected_at: new Date().toISOString(),
    };
  });

const mapValidation = (
  raw: BackendValidation | null,
  stationCode: string,
  scheduleId = `BACKEND-${Date.now()}`
): ScheduleValidationResult => {
  const violations = raw?.violations || [];
  const total = raw?.violation_count ?? violations.length;
  const checks = [
    ['PLATFORM_ASSIGNMENTS', 'Checks platform references and mandatory assignments.'],
    ['PLATFORM_CONSTRAINTS', 'Checks closures, availability, and compatibility.'],
    ['PLATFORM_OCCUPANCY', 'Checks for overlapping occupancy on each platform.'],
    ['MINIMUM_SEPARATION', 'Checks the configured minimum platform separation.'],
  ].map(([name, description]) => {
    const affected = violations.filter((item) => {
      const type = String(item.type || '');
      if (name === 'PLATFORM_OCCUPANCY') return type === 'OVERLAP';
      if (name === 'MINIMUM_SEPARATION') return type === 'MINIMUM_GAP';
      return type !== 'OVERLAP' && type !== 'MINIMUM_GAP';
    });
    return {
      name,
      description,
      status: affected.length === 0 ? 'PASS' : 'FAIL',
      passed: affected.length === 0,
      violations_count: affected.length,
      details: affected.map((item) => item.message).join(' ') || 'No violations reported.',
      affected_train_ids: affected.flatMap((item) => item.train_ids || [item.train_id]).filter(Boolean),
    };
  });

  return {
    validation_state: raw?.valid ? 'VALID' : 'INVALID',
    schedule_id: scheduleId,
    station_code: stationCode,
    validated_at: new Date().toISOString(),
    validator_version: 'RailFlow-backend-validator',
    validator_type: 'AUTHORITATIVE_BACKEND',
    checks_run: checks,
    total_violations: total,
    violations: violations.map((item) => ({
      check_name: String(item.type || 'UNKNOWN'),
      train_ids: item.train_ids || (item.train_id ? [item.train_id] : []),
      platform_id: item.platform_id,
      reason: item.message || String(item.type || 'Unknown violation'),
    })),
    is_stale: false,
  };
};

const backendPayload = (
  stationCode: string,
  timetable: TrainScheduleItem[],
  platforms: PlatformInfo[],
  minimumGap = 5
): BackendTimetable => ({
  station_id: stationCode,
  station_name: stationCode,
  station_illustrative: stationCode !== 'ST01',
  minimum_gap_minutes: minimumGap,
  platforms: platforms.map((platform) => ({
    id: platform.platform_id,
    closed_intervals:
      platform.is_closed && platform.closure_start && platform.closure_end
        ? [[timeToMinutes(platform.closure_start), timeToMinutes(platform.closure_end)]]
        : [],
    availability_intervals: [],
    supported_train_ids: null,
  })),
  trains: timetable.map((train) => ({
    id: train.train_id,
    arrival: timeToMinutes(train.arrival_time),
    departure: timeToMinutes(train.departure_time),
    platform_id: train.platform_id,
  })),
});

const resultToReplan = (
  raw: BackendResult,
  original: TrainScheduleItem[],
  stationCode: string,
  originalConflictCount = 0
): ReplanResult => {
  const candidate = raw.schedule ? mapTimetable(raw.schedule) : [];
  const originalById = new Map(original.map((train) => [train.train_id, train]));
  const explanations = candidate.map((train) => {
    const before = originalById.get(train.train_id);
    const platformChanged = Boolean(before && before.platform_id !== train.platform_id);
    const timeChanged = Boolean(
      before &&
      (before.arrival_time !== train.arrival_time || before.departure_time !== train.departure_time)
    );
    return {
      train_id: train.train_id,
      original_platform: before?.platform_id || train.platform_id,
      candidate_platform: train.platform_id,
      original_arrival: before?.arrival_time || train.arrival_time,
      candidate_arrival: train.arrival_time,
      original_departure: before?.departure_time || train.departure_time,
      candidate_departure: train.departure_time,
      is_platform_changed: platformChanged,
      is_time_changed: timeChanged,
      primary_reason: platformChanged
        ? 'Platform reassigned by the backend constraint scheduler.'
        : timeChanged
          ? 'Timing changed by the disruption workflow.'
          : 'No assignment change reported.',
      reason_source: 'BACKEND_AUTHORITATIVE' as const,
    };
  });
  const platformChanges = explanations.filter((item) => item.is_platform_changed).length;
  const timeShifts = explanations.filter((item) => item.is_time_changed).length;
  const unchangedTrains = explanations.filter(
    (item) => !item.is_platform_changed && !item.is_time_changed
  ).length;
  const validation = mapValidation(raw.validation, stationCode, `BACKEND-${Date.now()}`);

  return {
    status: raw.status,
    replan_id: `BACKEND-${Date.now().toString(36).toUpperCase()}`,
    station_code: stationCode,
    generated_at: new Date().toISOString(),
    original_schedule_id: 'BACKEND-ACTIVE',
    candidate_schedule: candidate,
    change_summary: {
      total_trains: candidate.length,
      platform_changes: platformChanges,
      time_shifts: timeShifts,
      unchanged_trains: unchangedTrains,
      conflicts_resolved: Math.max(0, originalConflictCount - validation.total_violations),
      remaining_conflicts: validation.total_violations,
    },
    explanations,
    validation,
    message: raw.message,
    is_illustrative_candidate: false,
    selection_status: raw.status === 'VALID_FOUND' ? 'SELECTED' : 'REJECTED',
  };
};

class ApiService {
  private activeAbortControllers = new Map<string, AbortController>();

  private async request<T>(endpoint: string, options: RequestInit = {}, cancelKey?: string): Promise<T> {
    const controller = cancelKey ? new AbortController() : undefined;
    const previous = cancelKey ? this.activeAbortControllers.get(cancelKey) : undefined;
    previous?.abort();
    if (cancelKey && controller) this.activeAbortControllers.set(cancelKey, controller);

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        signal: controller?.signal || options.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...options.headers },
      });
      if (!response.ok) {
        let message = `Backend request failed with HTTP ${response.status}.`;
        try {
          const body = await response.json();
          message = body.detail || body.message || body.error || message;
        } catch {
          // Keep the status-based message when the response is not JSON.
        }
        throw new Error(message);
      }
      return (await response.json()) as T;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('REQUEST_ABORTED');
      throw error;
    } finally {
      if (cancelKey && this.activeAbortControllers.get(cancelKey) === controller) {
        this.activeAbortControllers.delete(cancelKey);
      }
    }
  }

  public async checkHealth(): Promise<ApiHealthStatus> {
    const started = performance.now();
    try {
      const data = await this.request<{ status: string }>('/health', {}, 'health');
      return {
        isOnline: data.status === 'healthy',
        schedulerStatus: 'available',
        independentValidator: 'available',
        latencyMs: Math.round(performance.now() - started),
        lastChecked: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        isOnline: false,
        error: error?.message === 'REQUEST_ABORTED' ? 'Health request cancelled.' : error?.message || 'Backend unreachable.',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  public async getStations(): Promise<StationProfile[]> {
    const response = await this.request<{ profiles: any[] }>('/stations/profiles');
    return response.profiles.map(mapProfile);
  }

  public async getPlatforms(stationCode: string): Promise<PlatformInfo[]> {
    const profile = await this.request<any>(`/stations/profiles/${encodeURIComponent(stationCode)}`);
    return mapPlatforms(profile.platforms, profile.station_id);
  }

  public async getRawTimetable(): Promise<BackendTimetable> {
    return this.request<BackendTimetable>('/timetable', {}, 'timetable');
  }

  public async getTimetable(_stationCode?: string): Promise<TrainScheduleItem[]> {
    return mapTimetable(await this.getRawTimetable());
  }

  public async getConflicts(_stationCode?: string): Promise<ConflictItem[]> {
    const response = await this.request<{ conflicts: Array<Record<string, any>> }>('/conflicts', {}, 'conflicts');
    return mapConflicts(response.conflicts);
  }

  public async getSnapshot(stationCode?: string): Promise<StationSnapshot> {
    const raw = await this.getRawTimetable();
    if (stationCode && raw.station_id !== stationCode) {
      throw new Error(`Backend active station is ${raw.station_id}, not ${stationCode}. Select or replan that profile first.`);
    }
    const timetable = mapTimetable(raw);
    const platforms = mapPlatforms(raw.platforms, raw.station_id);
    const conflicts = mapConflicts((await this.request<{ conflicts: Array<Record<string, any>> }>('/conflicts')).conflicts);
    const validationRaw = await this.request<BackendValidation>('/schedule/validate', {
      method: 'POST',
      body: JSON.stringify(raw),
    });
    return {
      profile: {
        station_code: raw.station_id,
        station_name: raw.station_name,
        code_type: 'FICTIONAL_PROFILE',
        total_platforms: raw.platforms.length,
        min_headway_minutes: raw.minimum_gap_minutes,
        platforms,
        description: raw.station_illustrative ? 'Illustrative station profile.' : 'Fictional demonstration station.',
      },
      platforms,
      timetable,
      conflicts,
      validation: mapValidation(validationRaw, raw.station_id),
    };
  }

  public async validateSchedule(
    stationCode: string,
    schedule?: TrainScheduleItem[],
    platforms?: PlatformInfo[],
    minimumGap = 5
  ): Promise<ScheduleValidationResult> {
    if (!schedule || !platforms) {
      return (await this.getSnapshot(stationCode)).validation;
    }
    const raw = await this.request<BackendValidation>(
      `/schedule/validate?station_id=${encodeURIComponent(stationCode)}`,
      {
      method: 'POST',
      body: JSON.stringify(backendPayload(stationCode, schedule, platforms, minimumGap)),
      }
    );
    return mapValidation(raw, stationCode);
  }

  public async submitTrainDelay(req: DisruptionDelayRequest): Promise<BackendResult> {
    return this.request<BackendResult>('/disruptions/delay', {
      method: 'POST',
      body: JSON.stringify({ train_id: req.train_id, delay_minutes: req.delay_minutes }),
    });
  }

  public async submitPlatformClosure(req: DisruptionClosureRequest): Promise<BackendResult> {
    return this.request<BackendResult>('/disruptions/closure', {
      method: 'POST',
      body: JSON.stringify({
        platform_id: req.platform_id,
        start_minute: timeToMinutes(req.closure_start),
        end_minute: timeToMinutes(req.closure_end),
      }),
    });
  }

  public async replanSchedule(
    stationCode: string,
    schedule: TrainScheduleItem[],
    platforms: PlatformInfo[],
    minimumGap = 5,
    originalConflictCount = 0
  ): Promise<ReplanResult> {
    const raw = await this.request<BackendResult>(`/schedule/replan?station_id=${encodeURIComponent(stationCode)}`, {
      method: 'POST',
      body: JSON.stringify(backendPayload(stationCode, schedule, platforms, minimumGap)),
    });
    return resultToReplan(raw, schedule, stationCode, originalConflictCount);
  }

  public async predictArrivalDelay(req: DelayForecastRequest): Promise<DelayForecastResult> {
    return this.request<DelayForecastResult>('/predictions/arrival-delay', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  public async parseDisruptionText(text: string): Promise<any> {
    return this.request('/disruptions/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  public async getHistory(): Promise<ScheduleHistoryEntry[]> {
    const response = await this.request<{ runs: BackendResult[] }>('/schedule/history');
    return response.runs.map((run, index) => {
      const schedule = run.schedule ? mapTimetable(run.schedule) : [];
      const validation = mapValidation(run.validation, run.schedule?.station_id || 'ST01');
      return {
        entry_id: `BACKEND-HISTORY-${index}`,
        timestamp: new Date().toISOString(),
        schedule_id: validation.schedule_id,
        station_code: run.schedule?.station_id || 'ST01',
        action_type: run.disruption?.type === 'TRAIN_DELAY' ? 'DISRUPTION_DELAY' : 'REPLAN_GENERATED',
        summary: run.message,
        validation_state: validation.validation_state,
        conflicts_count: validation.total_violations,
        train_count: schedule.length,
        snapshot: schedule,
      };
    });
  }

  public toReplanResult(
    raw: BackendResult,
    original: TrainScheduleItem[],
    stationCode: string,
    originalConflictCount = 0
  ) {
    return resultToReplan(raw, original, stationCode, originalConflictCount);
  }
}

export const api = new ApiService();
