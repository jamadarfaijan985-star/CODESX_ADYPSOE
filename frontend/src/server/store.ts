import {
  STATIONS,
  INITIAL_TIMETABLES,
} from './data';
import {
  TrainScheduleItem,
  PlatformInfo,
  DisruptionRecord,
  ScheduleHistoryEntry,
  ReplanResult,
  ScheduleValidationResult,
  ConflictItem,
} from '../types/railway';
import {
  validateSchedule,
  extractConflictsFromSchedule,
  timeToMinutes,
  minutesToTime,
} from './validator';
import { generateReplanCandidate } from './scheduler';

export class RailwayStore {
  private activeStationCode: string = 'ST01';
  private platforms: Record<string, PlatformInfo[]> = {};
  private timetables: Record<string, TrainScheduleItem[]> = {};
  private disruptions: DisruptionRecord[] = [];
  private history: ScheduleHistoryEntry[] = [];
  private latestCandidates: Record<string, ReplanResult | null> = {};

  constructor() {
    this.resetAll();
  }

  public resetAll() {
    this.platforms = {};
    for (const [code, station] of Object.entries(STATIONS)) {
      this.platforms[code] = JSON.parse(JSON.stringify(station.platforms));
    }

    this.timetables = {};
    for (const [code, list] of Object.entries(INITIAL_TIMETABLES)) {
      this.timetables[code] = JSON.parse(JSON.stringify(list));
    }

    this.disruptions = [];
    this.latestCandidates = {};

    // Seed baseline history for ST01
    const initialSchedule = this.timetables['ST01'] || [];
    const val = validateSchedule(initialSchedule, {
      station_code: 'ST01',
      platforms: this.platforms['ST01'],
      min_headway_minutes: 5,
    });

    this.history = [
      {
        entry_id: 'HIST-INIT-001',
        timestamp: new Date().toISOString(),
        schedule_id: 'SCH-BASELINE-ST01',
        station_code: 'ST01',
        action_type: 'BASELINE_LOAD',
        summary: 'Nominal operational timetable loaded for Central Junction (ST01)',
        validation_state: val.validation_state,
        conflicts_count: val.total_violations,
        train_count: initialSchedule.length,
        snapshot: JSON.parse(JSON.stringify(initialSchedule)),
      },
    ];
  }

  public getStationProfile(stationCode: string) {
    return STATIONS[stationCode] || STATIONS['ST01'];
  }

  public getAllStations() {
    return Object.values(STATIONS);
  }

  public getPlatforms(stationCode: string): PlatformInfo[] {
    return this.platforms[stationCode] || this.platforms['ST01'] || [];
  }

  public getTimetable(
    stationCode: string,
    platformId?: string,
    statusFilter?: string
  ): TrainScheduleItem[] {
    let list = this.timetables[stationCode] || [];
    if (platformId) {
      list = list.filter((t) => t.platform_id === platformId);
    }
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter((t) => t.status === statusFilter);
    }
    return list;
  }

  public getConflicts(stationCode: string, severityFilter?: string): ConflictItem[] {
    const list = this.timetables[stationCode] || [];
    const plat = this.platforms[stationCode] || [];
    const headway = STATIONS[stationCode]?.min_headway_minutes || 5;

    let conflicts = extractConflictsFromSchedule(list, plat, headway);
    if (severityFilter && severityFilter !== 'ALL') {
      conflicts = conflicts.filter((c) => c.severity === severityFilter);
    }
    return conflicts;
  }

  public validate(
    stationCode: string,
    scheduleToValidate?: TrainScheduleItem[]
  ): ScheduleValidationResult {
    const list = scheduleToValidate || this.timetables[stationCode] || [];
    const plat = this.platforms[stationCode] || [];
    const headway = STATIONS[stationCode]?.min_headway_minutes || 5;

    return validateSchedule(list, {
      station_code: stationCode,
      platforms: plat,
      min_headway_minutes: headway,
    });
  }

  public applyTrainDelay(
    trainId: string,
    delayMinutes: number,
    reason: string = 'Operational delay',
    stationCode: string = 'ST01'
  ) {
    const list = this.timetables[stationCode];
    if (!list) {
      throw new Error(`Station ${stationCode} not found`);
    }

    const train = list.find((t) => t.train_id === trainId);
    if (!train) {
      throw new Error(`Train ${trainId} not found in timetable for station ${stationCode}`);
    }

    if (delayMinutes < 0) {
      throw new Error('Delay minutes cannot be negative');
    }

    const origArr = timeToMinutes(train.arrival_time);
    const origDep = timeToMinutes(train.departure_time);
    const dwell = origDep - origArr;

    const newArr = origArr + delayMinutes;
    const newDep = newArr + dwell;

    train.delay_minutes += delayMinutes;
    train.arrival_time = minutesToTime(newArr);
    train.departure_time = minutesToTime(newDep);
    train.status = delayMinutes > 0 ? 'DELAYED' : train.status;

    if (!train.warnings) train.warnings = [];
    train.warnings.push(`Delay +${delayMinutes}m applied (${reason})`);

    // Invalidate stale replan candidate
    this.latestCandidates[stationCode] = null;

    // Log disruption record
    const disruptionId = `DISR-DELAY-${Date.now().toString(36).toUpperCase()}`;
    const record: DisruptionRecord = {
      disruption_id: disruptionId,
      type: 'TRAIN_DELAY',
      station_code: stationCode,
      entity_id: trainId,
      parameters: { delay_minutes: delayMinutes, new_arrival: train.arrival_time },
      reported_at: new Date().toISOString(),
      reason,
      status: 'ACTIVE',
    };
    this.disruptions.unshift(record);

    // Validate and record history
    const val = this.validate(stationCode);
    this.history.unshift({
      entry_id: `HIST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      schedule_id: `SCH-${Date.now().toString(36).toUpperCase()}`,
      station_code: stationCode,
      action_type: 'DISRUPTION_DELAY',
      summary: `Train ${trainId} delayed by +${delayMinutes} min (${reason})`,
      validation_state: val.validation_state,
      conflicts_count: val.total_violations,
      train_count: list.length,
      snapshot: JSON.parse(JSON.stringify(list)),
    });

    return {
      success: true,
      disruption_id: disruptionId,
      affected_train: train,
      conflicts_detected: val.total_violations,
      message: `Delay of ${delayMinutes} minutes registered for train ${trainId}. Updated arrival: ${train.arrival_time}.`,
      needs_replan: val.total_violations > 0,
    };
  }

  public applyPlatformClosure(
    platformId: string,
    closureStart: string,
    closureEnd: string,
    reason: string = 'Platform maintenance',
    stationCode: string = 'ST01'
  ) {
    const plats = this.platforms[stationCode];
    if (!plats) {
      throw new Error(`Station ${stationCode} not found`);
    }

    const plat = plats.find((p) => p.platform_id === platformId);
    if (!plat) {
      throw new Error(`Platform ${platformId} not found in station ${stationCode}`);
    }

    const startMin = timeToMinutes(closureStart);
    const endMin = timeToMinutes(closureEnd);

    if (startMin < 0 || endMin < 0 || endMin <= startMin) {
      throw new Error(`Invalid closure window: ${closureStart} - ${closureEnd}`);
    }

    plat.is_closed = true;
    plat.closure_start = closureStart;
    plat.closure_end = closureEnd;
    plat.closure_reason = reason;

    // Invalidate stale replan candidate
    this.latestCandidates[stationCode] = null;

    // Identify affected trains
    const list = this.timetables[stationCode] || [];
    const affectedTrains = list.filter((t) => {
      if (t.platform_id !== platformId) return false;
      const arr = timeToMinutes(t.arrival_time);
      const dep = timeToMinutes(t.departure_time);
      return Math.max(arr, startMin) < Math.min(dep, endMin);
    });

    affectedTrains.forEach((t) => {
      if (!t.warnings) t.warnings = [];
      t.warnings.push(`Platform ${platformId} closed between ${closureStart}-${closureEnd}`);
    });

    const closureId = `CLOS-${Date.now().toString(36).toUpperCase()}`;
    const record: DisruptionRecord = {
      disruption_id: closureId,
      type: 'PLATFORM_CLOSURE',
      station_code: stationCode,
      entity_id: platformId,
      parameters: { closure_start: closureStart, closure_end: closureEnd },
      reported_at: new Date().toISOString(),
      reason,
      status: 'ACTIVE',
    };
    this.disruptions.unshift(record);

    const val = this.validate(stationCode);
    this.history.unshift({
      entry_id: `HIST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      schedule_id: `SCH-${Date.now().toString(36).toUpperCase()}`,
      station_code: stationCode,
      action_type: 'DISRUPTION_CLOSURE',
      summary: `Platform ${platformId} closed from ${closureStart} to ${closureEnd} (${reason})`,
      validation_state: val.validation_state,
      conflicts_count: val.total_violations,
      train_count: list.length,
      snapshot: JSON.parse(JSON.stringify(list)),
    });

    return {
      success: true,
      closure_id: closureId,
      platform_id: platformId,
      interval: { start: closureStart, end: closureEnd },
      affected_trains_count: affectedTrains.length,
      affected_train_ids: affectedTrains.map((t) => t.train_id),
      message: `Platform ${platformId} closed from ${closureStart} to ${closureEnd}. ${affectedTrains.length} train(s) directly impacted.`,
      needs_replan: true,
    };
  }

  public reopenPlatform(platformId: string, stationCode: string = 'ST01') {
    const plats = this.platforms[stationCode] || [];
    const plat = plats.find((p) => p.platform_id === platformId);
    if (!plat) throw new Error(`Platform ${platformId} not found`);

    plat.is_closed = false;
    plat.closure_start = undefined;
    plat.closure_end = undefined;
    plat.closure_reason = undefined;

    this.latestCandidates[stationCode] = null;
    return { success: true, message: `Platform ${platformId} reopened.` };
  }

  public replan(stationCode: string = 'ST01'): ReplanResult {
    const currentSchedule = this.timetables[stationCode] || [];
    const plat = this.platforms[stationCode] || [];
    const headway = STATIONS[stationCode]?.min_headway_minutes || 5;

    const result = generateReplanCandidate({
      station_code: stationCode,
      currentSchedule,
      platforms: plat,
      min_headway_minutes: headway,
    });

    this.latestCandidates[stationCode] = result;

    this.history.unshift({
      entry_id: `HIST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      schedule_id: result.replan_id,
      station_code: stationCode,
      action_type: 'REPLAN_GENERATED',
      summary: `Replan generated (${result.status}): ${result.change_summary.conflicts_resolved} conflicts resolved, ${result.change_summary.platform_changes} platform changes`,
      validation_state: result.validation.validation_state,
      conflicts_count: result.validation.total_violations,
      train_count: result.candidate_schedule.length,
      snapshot: JSON.parse(JSON.stringify(result.candidate_schedule)),
    });

    return result;
  }

  public adoptCandidate(stationCode: string = 'ST01'): { success: boolean; message: string } {
    const candidateResult = this.latestCandidates[stationCode];
    if (!candidateResult) {
      throw new Error('No candidate schedule exists to adopt.');
    }

    if (candidateResult.validation.validation_state !== 'VALID') {
      throw new Error(
        `Safety policy violation: Cannot adopt candidate schedule with validation state "${candidateResult.validation.validation_state}". Only independently confirmed VALID schedules may be adopted.`
      );
    }

    this.timetables[stationCode] = JSON.parse(
      JSON.stringify(candidateResult.candidate_schedule)
    );

    const val = this.validate(stationCode);
    this.history.unshift({
      entry_id: `HIST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      schedule_id: `SCH-ACTIVE-${Date.now().toString(36).toUpperCase()}`,
      station_code: stationCode,
      action_type: 'CANDIDATE_ADOPTED',
      summary: `Candidate schedule ${candidateResult.replan_id} adopted into active operational timetable.`,
      validation_state: val.validation_state,
      conflicts_count: val.total_violations,
      train_count: this.timetables[stationCode].length,
      snapshot: JSON.parse(JSON.stringify(this.timetables[stationCode])),
    });

    this.latestCandidates[stationCode] = null;
    return {
      success: true,
      message: 'Candidate schedule successfully adopted as the authoritative timetable.',
    };
  }

  public resetTimetable(stationCode: string = 'ST01') {
    const initial = INITIAL_TIMETABLES[stationCode] || [];
    this.timetables[stationCode] = JSON.parse(JSON.stringify(initial));
    const plats = STATIONS[stationCode]?.platforms || [];
    this.platforms[stationCode] = JSON.parse(JSON.stringify(plats));
    this.latestCandidates[stationCode] = null;

    const val = this.validate(stationCode);
    this.history.unshift({
      entry_id: `HIST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      schedule_id: `SCH-RESET-${Date.now().toString(36).toUpperCase()}`,
      station_code: stationCode,
      action_type: 'SCHEDULE_RESET',
      summary: `Timetable and platform assignments reset to initial nominal baseline for ${stationCode}.`,
      validation_state: val.validation_state,
      conflicts_count: val.total_violations,
      train_count: initial.length,
      snapshot: JSON.parse(JSON.stringify(initial)),
    });

    return {
      success: true,
      message: `Timetable for ${stationCode} has been reset to baseline.`,
    };
  }

  public getHistory(stationCode?: string): ScheduleHistoryEntry[] {
    if (stationCode) {
      return this.history.filter((h) => h.station_code === stationCode);
    }
    return this.history;
  }

  public getDisruptions(stationCode?: string): DisruptionRecord[] {
    if (stationCode) {
      return this.disruptions.filter((d) => d.station_code === stationCode);
    }
    return this.disruptions;
  }

  public getLatestCandidate(stationCode: string): ReplanResult | null {
    return this.latestCandidates[stationCode] || null;
  }
}

export const railwayStore = new RailwayStore();
