import {
  TrainScheduleItem,
  ScheduleValidationResult,
  PlatformInfo,
  ValidationCheck,
  ConflictItem,
} from '../types/railway';

/**
 * Converts "HH:MM" string to minutes after midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return -1;
  const [h, m] = timeStr.split(':').map((val) => parseInt(val, 10));
  if (isNaN(h) || isNaN(m)) return -1;
  return h * 60 + m;
}

/**
 * Converts minutes after midnight back to "HH:MM"
 */
export function minutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export interface ValidationContext {
  station_code: string;
  platforms: PlatformInfo[];
  min_headway_minutes?: number;
  schedule_id?: string;
}

/**
 * Runs independent, authoritative validation against a schedule payload.
 * Evaluates:
 * 1. OVERLAPPING_OCCUPANCY - Checks if any two trains occupy the same platform simultaneously.
 * 2. MINIMUM_CLEARANCE_HEADWAY - Checks if buffer between successive trains on same platform >= headway buffer.
 * 3. CLOSED_PLATFORM_RESTRICTION - Checks if any train is assigned to a platform closed during its dwell window.
 * 4. DWELL_TIME_INTEGRITY - Checks that arrival time < departure time for every train.
 */
export function validateSchedule(
  schedule: TrainScheduleItem[],
  context: ValidationContext
): ScheduleValidationResult {
  const headway = context.min_headway_minutes ?? 5;
  const scheduleId = context.schedule_id || `SCH-${Date.now().toString(36).toUpperCase()}`;

  const violations: Array<{
    check_name: string;
    train_ids: string[];
    platform_id?: string;
    time_window?: string;
    reason: string;
  }> = [];

  // Group trains by platform
  const byPlatform: Record<string, TrainScheduleItem[]> = {};
  for (const item of schedule) {
    if (!byPlatform[item.platform_id]) {
      byPlatform[item.platform_id] = [];
    }
    byPlatform[item.platform_id].push(item);
  }

  // 1. Check DWELL_TIME_INTEGRITY
  let dwellViolations = 0;
  for (const item of schedule) {
    const arr = timeToMinutes(item.arrival_time);
    const dep = timeToMinutes(item.departure_time);
    if (arr < 0 || dep < 0 || dep <= arr) {
      dwellViolations++;
      violations.push({
        check_name: 'DWELL_TIME_INTEGRITY',
        train_ids: [item.train_id],
        platform_id: item.platform_id,
        time_window: `${item.arrival_time} - ${item.departure_time}`,
        reason: `Train ${item.train_id} (${item.train_name}) has invalid dwell: arrival (${item.arrival_time}) must be strictly earlier than departure (${item.departure_time}).`,
      });
    }
  }

  // 2. Check CLOSED_PLATFORM_RESTRICTION
  let closedViolations = 0;
  const platformMap = new Map<string, PlatformInfo>();
  context.platforms.forEach((p) => platformMap.set(p.platform_id, p));

  for (const item of schedule) {
    const plat = platformMap.get(item.platform_id);
    if (plat && plat.is_closed) {
      const trainArr = timeToMinutes(item.arrival_time);
      const trainDep = timeToMinutes(item.departure_time);

      if (plat.closure_start && plat.closure_end) {
        const cStart = timeToMinutes(plat.closure_start);
        const cEnd = timeToMinutes(plat.closure_end);

        // Check if train interval overlaps with closure interval
        if (Math.max(trainArr, cStart) < Math.min(trainDep, cEnd)) {
          closedViolations++;
          violations.push({
            check_name: 'CLOSED_PLATFORM_RESTRICTION',
            train_ids: [item.train_id],
            platform_id: item.platform_id,
            time_window: `${item.arrival_time} - ${item.departure_time}`,
            reason: `Train ${item.train_id} assigned to ${item.platform_id} which is closed between ${plat.closure_start} and ${plat.closure_end} (${plat.closure_reason || 'Maintenance'}).`,
          });
        }
      } else {
        // Platform is closed indefinitely
        closedViolations++;
        violations.push({
          check_name: 'CLOSED_PLATFORM_RESTRICTION',
          train_ids: [item.train_id],
          platform_id: item.platform_id,
          time_window: `${item.arrival_time} - ${item.departure_time}`,
          reason: `Train ${item.train_id} assigned to ${item.platform_id} which is marked as closed.`,
        });
      }
    }
  }

  // 3. Check OVERLAPPING_OCCUPANCY & 4. Check MINIMUM_CLEARANCE_HEADWAY
  let overlapViolations = 0;
  let headwayViolations = 0;

  for (const [platformId, items] of Object.entries(byPlatform)) {
    // Sort items by arrival time
    const sorted = [...items].sort(
      (a, b) => timeToMinutes(a.arrival_time) - timeToMinutes(b.arrival_time)
    );

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const t1 = sorted[i];
        const t2 = sorted[j];

        const arr1 = timeToMinutes(t1.arrival_time);
        const dep1 = timeToMinutes(t1.departure_time);
        const arr2 = timeToMinutes(t2.arrival_time);
        const dep2 = timeToMinutes(t2.departure_time);

        // Check direct overlap: arr2 < dep1
        if (arr2 < dep1) {
          overlapViolations++;
          violations.push({
            check_name: 'OVERLAPPING_OCCUPANCY',
            train_ids: [t1.train_id, t2.train_id],
            platform_id: platformId,
            time_window: `${t2.arrival_time} - ${t1.departure_time}`,
            reason: `Direct platform collision on ${platformId}: Train ${t2.train_id} arrives at ${t2.arrival_time} before Train ${t1.train_id} departs at ${t1.departure_time}.`,
          });
        } else if (arr2 - dep1 < headway) {
          // No direct overlap, but headway buffer violation: arr2 - dep1 < headway
          headwayViolations++;
          violations.push({
            check_name: 'MINIMUM_CLEARANCE_HEADWAY',
            train_ids: [t1.train_id, t2.train_id],
            platform_id: platformId,
            time_window: `${t1.departure_time} - ${t2.arrival_time}`,
            reason: `Clearance buffer breach on ${platformId}: Clearance between departure of ${t1.train_id} (${t1.departure_time}) and arrival of ${t2.train_id} (${t2.arrival_time}) is ${arr2 - dep1} min(s), below mandatory ${headway}-min minimum headway.`,
          });
        }
      }
    }
  }

  const getAffectedTrains = (checkName: string) => {
    const list = violations.filter((v) => v.check_name === checkName).flatMap((v) => v.train_ids);
    return Array.from(new Set(list));
  };

  const checks_run: ValidationCheck[] = [
    {
      name: 'OVERLAPPING_OCCUPANCY',
      description: 'Ensures no simultaneous track occupation by two trains on the same platform',
      status: overlapViolations === 0 ? 'PASS' : 'FAIL',
      passed: overlapViolations === 0,
      violations_count: overlapViolations,
      affected_train_ids: getAffectedTrains('OVERLAPPING_OCCUPANCY'),
      details:
        overlapViolations === 0
          ? 'Zero overlapping platform occupancies detected.'
          : `${overlapViolations} direct platform overlap conflict(s) detected.`,
    },
    {
      name: 'MINIMUM_CLEARANCE_HEADWAY',
      description: `Mandates safety turnaround and clearance buffer (minimum ${headway} minutes) between trains`,
      status: headwayViolations === 0 ? 'PASS' : 'FAIL',
      passed: headwayViolations === 0,
      violations_count: headwayViolations,
      affected_train_ids: getAffectedTrains('MINIMUM_CLEARANCE_HEADWAY'),
      details:
        headwayViolations === 0
          ? `All platform transitions satisfy the ${headway}-minute safety buffer.`
          : `${headwayViolations} clearance buffer breach(es) below ${headway} minutes.`,
    },
    {
      name: 'CLOSED_PLATFORM_RESTRICTION',
      description: 'Enforces that no train is assigned to a closed platform during active closure intervals',
      status: closedViolations === 0 ? 'PASS' : 'FAIL',
      passed: closedViolations === 0,
      violations_count: closedViolations,
      affected_train_ids: getAffectedTrains('CLOSED_PLATFORM_RESTRICTION'),
      details:
        closedViolations === 0
          ? 'No trains assigned to closed platforms.'
          : `${closedViolations} assignment(s) violate platform closures.`,
    },
    {
      name: 'MANDATORY_PLATFORM_ASSIGNMENTS',
      description: 'Verifies mandatory valid platform assignment and positive dwell duration for all trains',
      status: dwellViolations === 0 ? 'PASS' : 'FAIL',
      passed: dwellViolations === 0,
      violations_count: dwellViolations,
      affected_train_ids: getAffectedTrains('DWELL_TIME_INTEGRITY'),
      details:
        dwellViolations === 0
          ? 'All train dwell times have positive duration and valid assignments.'
          : `${dwellViolations} train(s) have invalid assignments or dwell times.`,
    },
  ];

  const total_violations = violations.length;
  const validation_state = total_violations === 0 ? 'VALID' : 'INVALID';

  return {
    validation_state,
    schedule_id: scheduleId,
    station_code: context.station_code,
    validated_at: new Date().toISOString(),
    validator_version: 'RailFlow-IndepVal-v1.4-Authoritative',
    checks_run,
    total_violations,
    violations,
    is_stale: false,
  };
}

/**
 * Extracts formal ConflictItems from violations list for conflict registry.
 */
export function extractConflictsFromSchedule(
  schedule: TrainScheduleItem[],
  platforms: PlatformInfo[],
  headwayMinutes: number = 5
): ConflictItem[] {
  const val = validateSchedule(schedule, {
    station_code: schedule[0]?.station_code || 'ST01',
    platforms,
    min_headway_minutes: headwayMinutes,
  });

  return val.violations.map((v, idx) => {
    let conflict_type: ConflictItem['conflict_type'] = 'PLATFORM_OVERLAP';
    let severity: ConflictItem['severity'] = 'CRITICAL';

    if (v.check_name === 'OVERLAPPING_OCCUPANCY') {
      conflict_type = 'PLATFORM_OVERLAP';
      severity = 'CRITICAL';
    } else if (v.check_name === 'CLOSED_PLATFORM_RESTRICTION') {
      conflict_type = 'CLOSED_PLATFORM_ASSIGNMENT';
      severity = 'CRITICAL';
    } else if (v.check_name === 'MINIMUM_CLEARANCE_HEADWAY') {
      conflict_type = 'MINIMUM_CLEARANCE_VIOLATION';
      severity = 'HIGH';
    } else {
      conflict_type = 'UNFEASIBLE_DWELL';
      severity = 'CRITICAL';
    }

    const times = v.time_window ? v.time_window.split(' - ') : ['00:00', '00:00'];

    return {
      conflict_id: `CONF-${idx + 1}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      conflict_type,
      affected_trains: v.train_ids,
      platform_id: v.platform_id || 'UNKNOWN',
      time_interval: {
        start: times[0] || '08:00',
        end: times[1] || '08:30',
      },
      severity,
      description: v.reason,
      resolution_status: 'UNRESOLVED',
      detected_at: new Date().toISOString(),
    };
  });
}
