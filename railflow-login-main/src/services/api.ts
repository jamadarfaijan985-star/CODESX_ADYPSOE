import {
  StationProfile,
  PlatformInfo,
  TrainScheduleItem,
  ConflictItem,
  ScheduleValidationResult,
  ReplanResult,
  DisruptionDelayRequest,
  DisruptionClosureRequest,
  DelayForecastRequest,
  DelayForecastResult,
  ParsedDisruption,
  ScheduleHistoryEntry,
  DisruptionRecord,
} from '../types/railway';

// Respect VITE_BACKEND_URL or default to same-origin /api
const BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '') + '/api';

export interface ApiHealthStatus {
  isOnline: boolean;
  version?: string;
  schedulerStatus?: string;
  independentValidator?: string;
  latencyMs?: number;
  lastChecked?: string;
  error?: string;
}

class ApiService {
  private activeAbortControllers = new Map<string, AbortController>();

  private getAbortSignal(key: string): AbortSignal {
    const existing = this.activeAbortControllers.get(key);
    if (existing) {
      existing.abort();
    }
    const controller = new AbortController();
    this.activeAbortControllers.set(key, controller);
    return controller.signal;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    cancelKey?: string
  ): Promise<T> {
    const signal = cancelKey ? this.getAbortSignal(cancelKey) : options.signal;
    const url = `${BASE_URL}${endpoint}`;

    try {
      const res = await fetch(url, {
        ...options,
        signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
      });

      if (!res.ok) {
        let errorMsg = `Server error ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body.error) errorMsg = body.error;
          else if (body.message) errorMsg = body.message;
        } catch {
          // ignore non-json error responses
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('REQUEST_ABORTED');
      }
      throw err;
    }
  }

  // Health check
  public async checkHealth(): Promise<ApiHealthStatus> {
    const t0 = performance.now();
    try {
      const data = await this.request<{
        status: string;
        version: string;
        scheduler_status: string;
        independent_validator: string;
      }>('/health', { method: 'GET' }, 'health');
      const latencyMs = Math.round(performance.now() - t0);

      return {
        isOnline: data.status === 'ok',
        version: data.version,
        schedulerStatus: data.scheduler_status,
        independentValidator: data.independent_validator,
        latencyMs,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      if (err.message === 'REQUEST_ABORTED') {
        return { isOnline: false, error: 'Probing aborted' };
      }
      return {
        isOnline: false,
        error: err.message || 'Cannot connect to backend server',
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Stations
  public async getStations(): Promise<StationProfile[]> {
    const res = await this.request<{ stations: StationProfile[] }>('/stations');
    return res.stations;
  }

  // Platforms
  public async getPlatforms(stationCode: string): Promise<PlatformInfo[]> {
    const res = await this.request<{ platforms: PlatformInfo[] }>(
      `/platforms?station_code=${encodeURIComponent(stationCode)}`,
      {},
      `platforms_${stationCode}`
    );
    return res.platforms;
  }

  // Timetable
  public async getTimetable(
    stationCode: string,
    platformId?: string,
    status?: string
  ): Promise<TrainScheduleItem[]> {
    const params = new URLSearchParams({ station_code: stationCode });
    if (platformId) params.append('platform_id', platformId);
    if (status && status !== 'ALL') params.append('status', status);

    const res = await this.request<{ timetable: TrainScheduleItem[] }>(
      `/timetable?${params.toString()}`,
      {},
      `timetable_${stationCode}`
    );
    return res.timetable;
  }

  // Conflicts
  public async getConflicts(
    stationCode: string,
    severity?: string
  ): Promise<ConflictItem[]> {
    const params = new URLSearchParams({ station_code: stationCode });
    if (severity && severity !== 'ALL') params.append('severity', severity);

    const res = await this.request<{ conflicts: ConflictItem[] }>(
      `/conflicts?${params.toString()}`,
      {},
      `conflicts_${stationCode}`
    );
    return res.conflicts;
  }

  // Independent Schedule Validation
  public async validateSchedule(
    stationCode: string,
    schedule?: TrainScheduleItem[]
  ): Promise<ScheduleValidationResult> {
    return await this.request<ScheduleValidationResult>(
      '/schedule/validate',
      {
        method: 'POST',
        body: JSON.stringify({
          station_code: stationCode,
          schedule,
        }),
      },
      `validate_${stationCode}`
    );
  }

  // Submit train delay
  public async submitTrainDelay(
    req: DisruptionDelayRequest
  ): Promise<{
    success: boolean;
    disruption_id: string;
    affected_train: TrainScheduleItem;
    conflicts_detected: number;
    message: string;
    needs_replan: boolean;
  }> {
    return await this.request('/disruptions/delay', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Submit platform closure
  public async submitPlatformClosure(
    req: DisruptionClosureRequest
  ): Promise<{
    success: boolean;
    closure_id: string;
    platform_id: string;
    interval: { start: string; end: string };
    affected_trains_count: number;
    affected_train_ids: string[];
    message: string;
    needs_replan: boolean;
  }> {
    return await this.request('/disruptions/closure', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Reopen platform
  public async reopenPlatform(
    platformId: string,
    stationCode: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.request('/platforms/reopen', {
      method: 'POST',
      body: JSON.stringify({ platform_id: platformId, station_code: stationCode }),
    });
  }

  // Replan schedule
  public async replanSchedule(stationCode: string): Promise<ReplanResult> {
    return await this.request<ReplanResult>('/schedule/replan', {
      method: 'POST',
      body: JSON.stringify({ station_code: stationCode }),
    });
  }

  // Adopt candidate schedule
  public async adoptCandidateSchedule(
    stationCode: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.request('/schedule/adopt', {
      method: 'POST',
      body: JSON.stringify({ station_code: stationCode }),
    });
  }

  // Reset timetable
  public async resetTimetable(
    stationCode: string
  ): Promise<{ success: boolean; message: string }> {
    return await this.request('/schedule/reset', {
      method: 'POST',
      body: JSON.stringify({ station_code: stationCode }),
    });
  }

  // Experimental Delay Forecast
  public async predictArrivalDelay(
    req: DelayForecastRequest
  ): Promise<DelayForecastResult> {
    return await this.request<DelayForecastResult>('/predictions/arrival-delay', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  // Parse natural language disruption text
  public async parseDisruptionText(
    text: string,
    stationCode: string
  ): Promise<ParsedDisruption> {
    return await this.request<ParsedDisruption>('/disruptions/parse', {
      method: 'POST',
      body: JSON.stringify({ text, station_code: stationCode }),
    });
  }

  // History
  public async getHistory(stationCode?: string): Promise<ScheduleHistoryEntry[]> {
    const url = stationCode
      ? `/schedule/history?station_code=${encodeURIComponent(stationCode)}`
      : '/schedule/history';
    const res = await this.request<{ history: ScheduleHistoryEntry[] }>(url);
    return res.history;
  }

  // Disruptions audit
  public async getDisruptions(stationCode?: string): Promise<DisruptionRecord[]> {
    const url = stationCode
      ? `/disruptions?station_code=${encodeURIComponent(stationCode)}`
      : '/disruptions';
    const res = await this.request<{ disruptions: DisruptionRecord[] }>(url);
    return res.disruptions;
  }
}

export const api = new ApiService();
