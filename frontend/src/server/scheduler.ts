import {
  TrainScheduleItem,
  PlatformInfo,
  ReplanResult,
  ChangeExplanation,
} from '../types/railway';
import {
  validateSchedule,
  timeToMinutes,
  minutesToTime,
} from './validator';

export interface ReplanOptions {
  station_code: string;
  currentSchedule: TrainScheduleItem[];
  platforms: PlatformInfo[];
  min_headway_minutes?: number;
  strategy?: 'MINIMIZE_DELAY' | 'BALANCED_PLATFORMS';
}

/**
 * Generates an authoritative replanned candidate schedule to resolve conflicts,
 * computes exact before/after comparisons, and produces explicit causal explanations.
 */
export function generateReplanCandidate(options: ReplanOptions): ReplanResult {
  const {
    station_code,
    currentSchedule,
    platforms,
    min_headway_minutes = 5,
  } = options;

  const originalScheduleId = `ORIG-${Date.now().toString(36).toUpperCase()}`;
  const replanId = `REPLAN-${Date.now().toString(36).toUpperCase()}`;

  // Check initial validation on original schedule
  const originalValidation = validateSchedule(currentSchedule, {
    station_code,
    platforms,
    min_headway_minutes,
    schedule_id: originalScheduleId,
  });

  const availablePlatforms = platforms
    .filter((p) => !p.is_closed)
    .map((p) => p.platform_id);

  if (availablePlatforms.length === 0) {
    // All platforms are closed — mathematically infeasible
    return {
      status: 'INFEASIBLE_UNDER_MODEL',
      replan_id: replanId,
      station_code,
      generated_at: new Date().toISOString(),
      original_schedule_id: originalScheduleId,
      candidate_schedule: currentSchedule.map((t) => ({ ...t })),
      change_summary: {
        total_trains: currentSchedule.length,
        platform_changes: 0,
        time_shifts: 0,
        unchanged_trains: currentSchedule.length,
        conflicts_resolved: 0,
        remaining_conflicts: originalValidation.total_violations,
      },
      explanations: [],
      validation: originalValidation,
      message: 'All platforms at this station are marked closed. Feasible schedule cannot be found.',
    };
  }

  // Clone trains and attempt constraint satisfaction assignment
  const candidateSchedule: TrainScheduleItem[] = JSON.parse(
    JSON.stringify(currentSchedule)
  );

  // Identify all trains in violation or affected by closed platforms/overlaps
  const closedPlatformIds = new Set(
    platforms.filter((p) => p.is_closed).map((p) => p.platform_id)
  );

  // Sort candidate trains primarily by arrival time
  candidateSchedule.sort(
    (a, b) => timeToMinutes(a.arrival_time) - timeToMinutes(b.arrival_time)
  );

  // We assign platforms iteratively to minimize platform changes while ensuring 0 conflicts
  // Track occupancy intervals for each platform: Array of { start: number, end: number, train_id: string }
  const platformOccupancy: Record<
    string,
    Array<{ start: number; end: number; train_id: string }>
  > = {};

  for (const plat of platforms) {
    platformOccupancy[plat.platform_id] = [];
    if (plat.is_closed) {
      if (plat.closure_start && plat.closure_end) {
        platformOccupancy[plat.platform_id].push({
          start: timeToMinutes(plat.closure_start),
          end: timeToMinutes(plat.closure_end),
          train_id: 'CLOSURE_BLOCK',
        });
      } else {
        platformOccupancy[plat.platform_id].push({
          start: 0,
          end: 1440,
          train_id: 'CLOSURE_BLOCK',
        });
      }
    }
  }

  const explanations: ChangeExplanation[] = [];

  for (let i = 0; i < candidateSchedule.length; i++) {
    const train = candidateSchedule[i];
    const orig = currentSchedule.find((t) => t.train_id === train.train_id)!;

    const originalArr = timeToMinutes(orig.arrival_time);
    const originalDep = timeToMinutes(orig.departure_time);
    const dwell = originalDep - originalArr;

    let targetArr = timeToMinutes(train.arrival_time);
    let targetDep = timeToMinutes(train.departure_time);
    let assignedPlatform = train.platform_id;

    // Check if current platform is closed or has conflicts
    const isPlatformClosed = closedPlatformIds.has(assignedPlatform);

    // Test if assignedPlatform is free for [targetArr, targetDep + headway]
    const isSlotFree = (platId: string, arr: number, dep: number) => {
      const intervals = platformOccupancy[platId] || [];
      for (const occ of intervals) {
        // Buffer check: train interval plus min_headway
        const overlap = Math.max(arr, occ.start) < Math.min(dep + min_headway_minutes, occ.end);
        if (overlap) return false;
      }
      return true;
    };

    let platformChanged = false;
    let timeShifted = false;
    let reasonText = '';

    if (!isPlatformClosed && isSlotFree(assignedPlatform, targetArr, targetDep)) {
      // Keep on current platform
      platformOccupancy[assignedPlatform].push({
        start: targetArr,
        end: targetDep,
        train_id: train.train_id,
      });
      reasonText = 'Assignment maintained without constraint violation.';
    } else {
      // Try to find another open platform without changing time
      let candidatePlat: string | null = null;
      for (const altPlat of availablePlatforms) {
        if (isSlotFree(altPlat, targetArr, targetDep)) {
          candidatePlat = altPlat;
          break;
        }
      }

      if (candidatePlat) {
        assignedPlatform = candidatePlat;
        platformChanged = true;
        train.platform_id = assignedPlatform;

        if (isPlatformClosed) {
          reasonText = `Reassigned from closed ${orig.platform_id} to ${assignedPlatform} to honor platform closure restriction.`;
        } else {
          reasonText = `Reallocated from ${orig.platform_id} to ${assignedPlatform} to resolve occupancy collision and preserve headway buffer.`;
        }

        platformOccupancy[assignedPlatform].push({
          start: targetArr,
          end: targetDep,
          train_id: train.train_id,
        });
      } else {
        // Must find alternative platform with minor time delay adjustment
        let bestPlat: string | null = null;
        let bestShift = 9999;

        for (const altPlat of availablePlatforms) {
          // Look for earliest available slot after targetArr
          const intervals = (platformOccupancy[altPlat] || []).sort(
            (a, b) => a.start - b.start
          );
          let candidateStart = targetArr;

          for (const occ of intervals) {
            if (candidateStart < occ.end + min_headway_minutes) {
              candidateStart = Math.max(candidateStart, occ.end + min_headway_minutes);
            }
          }

          const shift = candidateStart - targetArr;
          if (shift < bestShift) {
            bestShift = shift;
            bestPlat = altPlat;
          }
        }

        if (bestPlat && bestShift < 180) {
          assignedPlatform = bestPlat;
          targetArr += bestShift;
          targetDep = targetArr + dwell;
          train.platform_id = assignedPlatform;
          train.arrival_time = minutesToTime(targetArr);
          train.departure_time = minutesToTime(targetDep);
          train.delay_minutes = (orig.delay_minutes || 0) + bestShift;
          train.status = 'DELAYED';

          platformChanged = assignedPlatform !== orig.platform_id;
          timeShifted = bestShift > 0;

          if (platformChanged && timeShifted) {
            reasonText = `Reassigned to ${assignedPlatform} and shifted +${bestShift}m to clear preceding train turnaround buffer.`;
          } else if (timeShifted) {
            reasonText = `Shifted dwell window by +${bestShift}m on ${assignedPlatform} to clear track occupancy conflict.`;
          } else {
            reasonText = `Reassigned to ${assignedPlatform} to resolve track bottleneck.`;
          }

          platformOccupancy[assignedPlatform].push({
            start: targetArr,
            end: targetDep,
            train_id: train.train_id,
          });
        } else {
          // Infeasible under current platform capacity
          reasonText = 'No open platform slot available within allowable delay window.';
        }
      }
    }

    if (platformChanged || timeShifted) {
      explanations.push({
        train_id: train.train_id,
        original_platform: orig.platform_id,
        candidate_platform: train.platform_id,
        original_arrival: orig.arrival_time,
        candidate_arrival: train.arrival_time,
        original_departure: orig.departure_time,
        candidate_departure: train.departure_time,
        is_platform_changed: platformChanged,
        is_time_changed: timeShifted,
        primary_reason: reasonText,
        reason_source: 'BACKEND_AUTHORITATIVE',
      });
    }
  }

  // Authoritative independent validation of the candidate schedule
  const candidateScheduleId = `CAND-${Date.now().toString(36).toUpperCase()}`;
  const candidateValidation = validateSchedule(candidateSchedule, {
    station_code,
    platforms,
    min_headway_minutes,
    schedule_id: candidateScheduleId,
  });

  const platformChanges = explanations.filter((e) => e.is_platform_changed).length;
  const timeShifts = explanations.filter((e) => e.is_time_changed).length;
  const unchangedTrains = candidateSchedule.length - explanations.length;

  const conflictsResolved = Math.max(
    0,
    originalValidation.total_violations - candidateValidation.total_violations
  );

  const status: ReplanResult['status'] =
    candidateValidation.validation_state === 'VALID'
      ? 'VALID_FOUND'
      : 'INFEASIBLE_UNDER_MODEL';

  const message =
    status === 'VALID_FOUND'
      ? `Candidate schedule generated successfully. 0 violations detected. ${conflictsResolved} conflicts resolved across ${platformChanges} platform changes and ${timeShifts} schedule shifts.`
      : `Replan candidate could not eliminate all constraints (${candidateValidation.total_violations} remaining violations). Model capacity reached.`;

  return {
    status,
    replan_id: replanId,
    station_code,
    generated_at: new Date().toISOString(),
    original_schedule_id: originalScheduleId,
    candidate_schedule: candidateSchedule,
    change_summary: {
      total_trains: candidateSchedule.length,
      platform_changes: platformChanges,
      time_shifts: timeShifts,
      unchanged_trains: unchangedTrains,
      conflicts_resolved: conflictsResolved,
      remaining_conflicts: candidateValidation.total_violations,
    },
    explanations,
    validation: candidateValidation,
    message,
  };
}
