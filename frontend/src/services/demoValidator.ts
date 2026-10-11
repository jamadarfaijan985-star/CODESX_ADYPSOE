import {
  TrainScheduleItem,
  PlatformInfo,
  ScheduleValidationResult,
  ValidationCheck,
} from '../types/railway';
import { timeToMinutes } from '../server/validator';

export interface DemoValidationOptions {
  stationCode: string;
  schedule: TrainScheduleItem[];
  platforms: PlatformInfo[];
  minHeadwayMinutes?: number;
  scheduleId?: string;
}

/**
 * Frontend Demonstration Schedule Validator.
 * Evaluates the 4 explicit railway validation constraints locally.
 * Distinctly labeled: DEMO VALIDATION — NOT AUTHORITATIVE.
 */
export function runDemoValidation(options: DemoValidationOptions): ScheduleValidationResult {
  const {
    stationCode,
    schedule,
    platforms,
    minHeadwayMinutes = 5,
    scheduleId = `DEMO-VAL-${Date.now().toString(36).toUpperCase()}`,
  } = options;

  const violations: Array<{
    check_name: string;
    train_ids: string[];
    platform_id?: string;
    time_window?: string;
    reason: string;
  }> = [];

  // Group by platform
  const byPlatform: Record<string, TrainScheduleItem[]> = {};
  for (const item of schedule) {
    if (!byPlatform[item.platform_id]) {
      byPlatform[item.platform_id] = [];
    }
    byPlatform[item.platform_id].push(item);
  }

  // 1. Mandatory Platform Assignment & Dwell Time
  let dwellViolations = 0;
  for (const item of schedule) {
    const arr = timeToMinutes(item.arrival_time);
    const dep = timeToMinutes(item.departure_time);
    if (!item.platform_id || arr < 0 || dep < 0 || dep <= arr) {
      dwellViolations++;
      violations.push({
        check_name: 'MANDATORY_PLATFORM_ASSIGNMENTS',
        train_ids: [item.train_id],
        platform_id: item.platform_id || 'NONE',
        time_window: `${item.arrival_time} - ${item.departure_time}`,
        reason: `Train ${item.train_id} (${item.train_name}): invalid dwell window (${item.arrival_time} to ${item.departure_time}). Arrival must precede departure.`,
      });
    }
  }

  // 2. Closed-Platform Restrictions
  let closedViolations = 0;
  const platformMap = new Map<string, PlatformInfo>();
  platforms.forEach((p) => platformMap.set(p.platform_id, p));

  for (const item of schedule) {
    const plat = platformMap.get(item.platform_id);
    if (plat && plat.is_closed) {
      const trainArr = timeToMinutes(item.arrival_time);
      const trainDep = timeToMinutes(item.departure_time);

      if (plat.closure_start && plat.closure_end) {
        const cStart = timeToMinutes(plat.closure_start);
        const cEnd = timeToMinutes(plat.closure_end);

        if (Math.max(trainArr, cStart) < Math.min(trainDep, cEnd)) {
          closedViolations++;
          violations.push({
            check_name: 'CLOSED_PLATFORM_RESTRICTION',
            train_ids: [item.train_id],
            platform_id: item.platform_id,
            time_window: `${item.arrival_time} - ${item.departure_time}`,
            reason: `Train ${item.train_id} assigned to ${item.platform_id} during active maintenance closure (${plat.closure_start} - ${plat.closure_end}).`,
          });
        }
      } else {
        closedViolations++;
        violations.push({
          check_name: 'CLOSED_PLATFORM_RESTRICTION',
          train_ids: [item.train_id],
          platform_id: item.platform_id,
          time_window: `${item.arrival_time} - ${item.departure_time}`,
          reason: `Train ${item.train_id} assigned to closed platform ${item.platform_id}.`,
        });
      }
    }
  }

  // 3. Overlapping Train Occupancy & 4. Minimum Platform Clearance
  let overlapViolations = 0;
  let headwayViolations = 0;

  for (const [platformId, items] of Object.entries(byPlatform)) {
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

        if (arr2 < dep1) {
          overlapViolations++;
          violations.push({
            check_name: 'OVERLAPPING_OCCUPANCY',
            train_ids: [t1.train_id, t2.train_id],
            platform_id: platformId,
            time_window: `${t2.arrival_time} - ${t1.departure_time}`,
            reason: `Occupancy collision on ${platformId}: Train ${t2.train_id} arrives (${t2.arrival_time}) before Train ${t1.train_id} departs (${t1.departure_time}).`,
          });
        } else if (arr2 - dep1 < minHeadwayMinutes) {
          headwayViolations++;
          violations.push({
            check_name: 'MINIMUM_CLEARANCE_HEADWAY',
            train_ids: [t1.train_id, t2.train_id],
            platform_id: platformId,
            time_window: `${t1.departure_time} - ${t2.arrival_time}`,
            reason: `Headway breach on ${platformId}: Clearance between departure of ${t1.train_id} and arrival of ${t2.train_id} is ${arr2 - dep1}m (< ${minHeadwayMinutes}m mandatory headway).`,
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
      description: 'Detects overlapping train occupancy intervals on the same platform track',
      status: overlapViolations === 0 ? 'PASS' : 'FAIL',
      passed: overlapViolations === 0,
      violations_count: overlapViolations,
      affected_train_ids: getAffectedTrains('OVERLAPPING_OCCUPANCY'),
      details:
        overlapViolations === 0
          ? 'Zero overlapping platform occupancies detected.'
          : `${overlapViolations} track occupancy collision(s) detected.`,
    },
    {
      name: 'MINIMUM_CLEARANCE_HEADWAY',
      description: `Verifies mandatory ${minHeadwayMinutes}-minute safety turnaround gap between successive movements`,
      status: headwayViolations === 0 ? 'PASS' : 'FAIL',
      passed: headwayViolations === 0,
      violations_count: headwayViolations,
      affected_train_ids: getAffectedTrains('MINIMUM_CLEARANCE_HEADWAY'),
      details:
        headwayViolations === 0
          ? `All track transitions satisfy the ${minHeadwayMinutes}-minute headway buffer.`
          : `${headwayViolations} clearance gap violation(s) under ${minHeadwayMinutes} minutes.`,
    },
    {
      name: 'CLOSED_PLATFORM_RESTRICTION',
      description: 'Ensures trains are not scheduled during active platform maintenance blockades',
      status: closedViolations === 0 ? 'PASS' : 'FAIL',
      passed: closedViolations === 0,
      violations_count: closedViolations,
      affected_train_ids: getAffectedTrains('CLOSED_PLATFORM_RESTRICTION'),
      details:
        closedViolations === 0
          ? 'No trains assigned to closed platforms.'
          : `${closedViolations} train movement(s) violate platform track closures.`,
    },
    {
      name: 'MANDATORY_PLATFORM_ASSIGNMENTS',
      description: 'Ensures required platform assignments are present and dwell durations are positive',
      status: dwellViolations === 0 ? 'PASS' : 'FAIL',
      passed: dwellViolations === 0,
      violations_count: dwellViolations,
      affected_train_ids: getAffectedTrains('MANDATORY_PLATFORM_ASSIGNMENTS'),
      details:
        dwellViolations === 0
          ? 'All trains have valid platform assignments and positive dwell intervals.'
          : `${dwellViolations} train(s) have invalid assignments or zero dwell duration.`,
    },
  ];

  const total_violations = violations.length;

  return {
    validation_state: total_violations === 0 ? 'VALID' : 'INVALID',
    schedule_id: scheduleId,
    station_code: stationCode,
    validated_at: new Date().toISOString(),
    validator_version: 'RailFlow-DemoValidator-Client-v1.0',
    validator_type: 'DEMO_FRONTEND',
    checks_run,
    total_violations,
    violations,
    is_stale: false,
  };
}
