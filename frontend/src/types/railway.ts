export type ScheduleStatus = 'ON_TIME' | 'DELAYED' | 'HELD' | 'CANCELLED' | 'COMPLETED';

export type ValidationState = 'VALID' | 'INVALID' | 'UNRESOLVED' | 'ERROR';

export type ConflictSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'WARNING';

export type ConflictType =
  | 'PLATFORM_OVERLAP'
  | 'MINIMUM_CLEARANCE_VIOLATION'
  | 'CLOSED_PLATFORM_ASSIGNMENT'
  | 'UNFEASIBLE_DWELL';

export type ReplanStatus = 'VALID_FOUND' | 'INFEASIBLE_UNDER_MODEL' | 'NO_CONFLICTS' | 'ERROR';

export interface TrainScheduleItem {
  train_id: string;
  train_name: string;
  station_code: string;
  arrival_time: string; // HH:MM
  departure_time: string; // HH:MM
  platform_id: string;
  status: ScheduleStatus;
  delay_minutes: number;
  direction: 'INBOUND' | 'OUTBOUND' | 'THROUGH';
  clearance_minutes: number;
  warnings?: string[];
  notes?: string;
}

export interface PlatformInfo {
  platform_id: string;
  station_code: string;
  name: string;
  length_meters: number;
  is_electrified: boolean;
  is_closed: boolean;
  closure_reason?: string;
  closure_start?: string;
  closure_end?: string;
  track_type: 'MAIN' | 'LOOP' | 'TERMINAL' | 'SIDING';
}

export interface StationProfile {
  station_code: string;
  station_name: string;
  code_type: 'FICTIONAL_PROFILE';
  total_platforms: number;
  min_headway_minutes: number;
  platforms: PlatformInfo[];
  description: string;
  illustrative?: boolean;
}

export interface ConflictItem {
  conflict_id: string;
  conflict_type: ConflictType;
  affected_trains: string[];
  platform_id: string;
  time_interval: {
    start: string;
    end: string;
  };
  severity: ConflictSeverity;
  description: string;
  resolution_status: 'UNRESOLVED' | 'RESOLVED' | 'IN_REVIEW';
  detected_at: string;
}

export interface ValidationCheck {
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN';
  passed: boolean;
  violations_count: number;
  details: string;
  affected_train_ids?: string[];
}

export interface ScheduleValidationResult {
  validation_state: ValidationState;
  schedule_id: string;
  station_code: string;
  validated_at: string;
  validator_version: string;
  validator_type?: 'DEMO_FRONTEND' | 'AUTHORITATIVE_BACKEND';
  checks_run: ValidationCheck[];
  total_violations: number;
  violations: Array<{
    check_name: string;
    train_ids: string[];
    platform_id?: string;
    time_window?: string;
    reason: string;
  }>;
  is_stale?: boolean;
}

export interface DisruptionDelayRequest {
  train_id: string;
  delay_minutes: number;
  reason?: string;
  station_code?: string;
  notes?: string;
}

export interface DisruptionClosureRequest {
  platform_id: string;
  closure_start: string; // HH:MM
  closure_end: string; // HH:MM
  reason?: string;
  station_code?: string;
  notes?: string;
}

export interface DisruptionRecord {
  disruption_id: string;
  type: 'TRAIN_DELAY' | 'PLATFORM_CLOSURE';
  station_code: string;
  entity_id: string; // train_id or platform_id
  parameters: Record<string, any>;
  reported_at: string;
  reason: string;
  notes?: string;
  status: 'ACTIVE' | 'RESOLVED';
}

export interface ChangeExplanation {
  train_id: string;
  original_platform: string;
  candidate_platform: string;
  original_arrival: string;
  candidate_arrival: string;
  original_departure: string;
  candidate_departure: string;
  is_platform_changed: boolean;
  is_time_changed: boolean;
  primary_reason: string;
  reason_source: 'BACKEND_AUTHORITATIVE' | 'INFERRED_FROM_CONSTRAINTS' | 'ILLUSTRATIVE_DEMO';
}

export interface ReplanResult {
  status: ReplanStatus;
  replan_id: string;
  station_code: string;
  generated_at: string;
  original_schedule_id: string;
  candidate_schedule: TrainScheduleItem[];
  change_summary: {
    total_trains: number;
    platform_changes: number;
    time_shifts: number;
    unchanged_trains: number;
    conflicts_resolved: number;
    remaining_conflicts: number;
  };
  explanations: ChangeExplanation[];
  validation: ScheduleValidationResult;
  message: string;
  is_illustrative_candidate?: boolean;
  selection_status?: 'UNDER_REVIEW' | 'SELECTED' | 'REJECTED';
}

export interface ParsedDisruption {
  parsed: boolean;
  disruption_type: 'TRAIN_DELAY' | 'PLATFORM_CLOSURE' | 'UNKNOWN';
  entities: {
    train_id?: string;
    delay_minutes?: number;
    platform_id?: string;
    closure_start?: string;
    closure_end?: string;
    reason?: string;
  };
  parser_type: string;
  confidence: 'EXACT_MATCH' | 'PARTIAL' | 'UNRECOGNIZED';
  ambiguities: string[];
  raw_input: string;
  executable_payload: {
    endpoint: string;
    body: Record<string, any>;
  } | null;
}

export interface DelayForecastRequest {
  service_date: string;
  seq: number;
  station_code: string;
}

export interface DelayForecastResult {
  predicted_delay_minutes: number;
  model_id: string;
  status: 'experimental';
  experimental: boolean;
  disclaimer: string;
}

export type HistoryActionType =
  | 'BASELINE_LOAD'
  | 'DISRUPTION_DELAY'
  | 'DISRUPTION_CLOSURE'
  | 'DELAY_REGISTERED'
  | 'PLATFORM_CLOSURE_REGISTERED'
  | 'CANDIDATE_CREATED'
  | 'REPLAN_GENERATED'
  | 'DEMO_VALIDATION_COMPLETED'
  | 'CANDIDATE_SELECTED'
  | 'CANDIDATE_ADOPTED'
  | 'CANDIDATE_REJECTED'
  | 'DEMO_RESET'
  | 'SCHEDULE_RESET';

export interface ScheduleHistoryEntry {
  entry_id: string;
  timestamp: string;
  schedule_id: string;
  station_code: string;
  action_type: HistoryActionType;
  summary: string;
  validation_state: ValidationState;
  conflicts_count: number;
  train_count: number;
  snapshot: TrainScheduleItem[];
  affected_target?: string;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  quickActionPayload?: {
    type: 'DELAY' | 'CLOSURE' | 'REPLAN' | 'VALIDATE';
    description: string;
    parameters: Record<string, any>;
  };
  actionCompleted?: boolean;
}
