import { ParsedDisruption } from '../types/railway';

/**
 * Deterministic rule-based regex parser for railway operational commands.
 * Accurately identified as a rule-based parser.
 */
export function parseDisruptionText(
  text: string,
  stationCode: string = 'ST01'
): ParsedDisruption {
  const clean = text.trim();
  const ambiguities: string[] = [];

  // Match delay pattern:
  // e.g., "Train T102 is delayed by 15 minutes"
  // "Delay train 12624 by 25 mins due to signal failure"
  const delayRegex =
    /(?:train\s+)?([A-Za-z0-9_-]+)\s+(?:is\s+)?delayed(?:\s+by)?\s+(\d+)\s*(?:min|mins|minutes|m)?(?:\s+(?:due\s+to|because\s+of|reason:)\s+(.+))?/i;

  const delayAltRegex =
    /delay\s+(?:train\s+)?([A-Za-z0-9_-]+)\s+(?:by\s+)?(\d+)\s*(?:min|mins|minutes|m)?(?:\s+(?:due\s+to|because\s+of|reason:)\s+(.+))?/i;

  // Match platform closure pattern:
  // e.g., "Close platform 2 from 09:00 to 11:30"
  // "Platform P1 closure between 08:30 and 10:00 due to track maintenance"
  const closureRegex =
    /(?:close\s+)?platform\s+([A-Za-z0-9_-]+)\s+(?:closure\s+)?(?:from|between)\s+(\d{1,2}:\d{2})\s*(?:to|and|-)\s*(\d{1,2}:\d{2})(?:\s+(?:due\s+to|reason:)\s+(.+))?/i;

  const closureAltRegex =
    /close\s+platform\s+([A-Za-z0-9_-]+)(?:\s+(?:from|between)\s+(\d{1,2}:\d{2})\s*(?:to|and|-)\s*(\d{1,2}:\d{2}))?(?:\s+(?:due\s+to|reason:)\s+(.+))?/i;

  // Try delay match
  const delayMatch = clean.match(delayRegex) || clean.match(delayAltRegex);
  if (delayMatch) {
    let trainId = delayMatch[1].toUpperCase();
    const delayMinutes = parseInt(delayMatch[2], 10);
    const reason = delayMatch[3]?.trim() || 'Reported via Operations Assistant';

    // Normalize train ID prefix if operator wrote e.g. "102"
    if (!trainId.startsWith('T') && trainId !== '12624' && trainId.length === 3) {
      trainId = `T${trainId}`;
      ambiguities.push(`Train ID normalized to "${trainId}"`);
    }

    if (isNaN(delayMinutes) || delayMinutes <= 0) {
      ambiguities.push('Delay duration must be greater than 0 minutes.');
    }

    return {
      parsed: true,
      disruption_type: 'TRAIN_DELAY',
      entities: {
        train_id: trainId,
        delay_minutes: delayMinutes,
        reason,
      },
      parser_type: 'Rule-Based Regex Dispatcher (v1.2.0)',
      confidence: ambiguities.length === 0 ? 'EXACT_MATCH' : 'PARTIAL',
      ambiguities,
      raw_input: clean,
      executable_payload: {
        endpoint: '/api/disruptions/delay',
        body: {
          train_id: trainId,
          delay_minutes: delayMinutes,
          reason,
          station_code: stationCode,
        },
      },
    };
  }

  // Try closure match
  const closureMatch = clean.match(closureRegex) || clean.match(closureAltRegex);
  if (closureMatch) {
    let platformId = closureMatch[1].toUpperCase();
    // Normalize platform ID (e.g. "2" -> "P2")
    if (!platformId.startsWith('P')) {
      platformId = `P${platformId}`;
    }

    const startTime = closureMatch[2] || '';
    const endTime = closureMatch[3] || '';
    const reason = closureMatch[4]?.trim() || 'Track maintenance closure';

    if (!startTime || !endTime) {
      ambiguities.push('Missing explicit start or end time for platform closure.');
    }

    return {
      parsed: true,
      disruption_type: 'PLATFORM_CLOSURE',
      entities: {
        platform_id: platformId,
        closure_start: startTime,
        closure_end: endTime,
        reason,
      },
      parser_type: 'Rule-Based Regex Dispatcher (v1.2.0)',
      confidence: ambiguities.length === 0 ? 'EXACT_MATCH' : 'PARTIAL',
      ambiguities,
      raw_input: clean,
      executable_payload: startTime && endTime ? {
        endpoint: '/api/disruptions/closure',
        body: {
          platform_id: platformId,
          closure_start: startTime,
          closure_end: endTime,
          reason,
          station_code: stationCode,
        },
      } : null,
    };
  }

  // If unrecognized
  return {
    parsed: false,
    disruption_type: 'UNKNOWN',
    entities: {},
    parser_type: 'Rule-Based Regex Dispatcher (v1.2.0)',
    confidence: 'UNRECOGNIZED',
    ambiguities: [
      'Could not parse sentence structure. Please use formats like: "Train T102 is delayed by 15 minutes" or "Close platform P2 from 09:00 to 11:30".',
    ],
    raw_input: clean,
    executable_payload: null,
  };
}
