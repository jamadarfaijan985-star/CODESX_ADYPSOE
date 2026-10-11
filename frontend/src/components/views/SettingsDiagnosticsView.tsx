import React, { useState } from 'react';
import {
  Settings,
  Server,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Wifi,
  Terminal,
  ShieldCheck,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmationDialog } from '../common/ConfirmationDialog';
import { api } from '../../services/api';

export const SettingsDiagnosticsView: React.FC = () => {
  const {
    stations,
    selectedStation,
    changeStation,
    health,
    checkHealth,
    isFixtureMode,
    toggleFixtureMode,
    resetSchedule,
    theme,
    toggleTheme,
  } = useRailway();

  const [probingEndpoint, setProbingEndpoint] = useState<string | null>(null);
  const [probeResult, setProbeResult] = useState<{ endpoint: string; status: string; data: any } | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const testEndpoints = [
    { label: 'Health Status', path: '/api/health', fn: () => api.checkHealth() },
    { label: 'Station Profiles', path: '/api/stations', fn: () => api.getStations() },
    { label: 'Active Timetable', path: '/api/timetable', fn: () => api.getTimetable(selectedStation) },
    { label: 'Conflicts Registry', path: '/api/conflicts', fn: () => api.getConflicts(selectedStation) },
    { label: 'Authoritative Validation', path: '/api/schedule/validate', fn: () => api.validateSchedule(selectedStation) },
    { label: 'Schedule History', path: '/api/schedule/history', fn: () => api.getHistory(selectedStation) },
  ];

  const runManualProbe = async (test: typeof testEndpoints[0]) => {
    setProbingEndpoint(test.path);
    setProbeResult(null);
    try {
      const data = await test.fn();
      setProbeResult({ endpoint: test.path, status: '200 OK', data });
    } catch (err: any) {
      setProbeResult({
        endpoint: test.path,
        status: 'OFFLINE / UNREACHABLE',
        data: `Endpoint unreachable: ${err.message}. System functioning independently in client demo mode.`,
      });
    } finally {
      setProbingEndpoint(null);
    }
  };

  const handleConfirmReset = async () => {
    await resetSchedule();
    setConfirmResetOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Settings &amp; Demonstration Diagnostics"
        subtitle="Manage demonstration station profiles, visual workspace themes, and voluntary backend probes."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <StatusBadge
            label="DEMO MODE ACTIVE"
            variant="demo"
            size="sm"
          />
        }
      />

      {/* Theme & Display Settings */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400" />
          <span>Workspace Display &amp; Visual Theme</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded bg-[#080E19] border border-slate-800">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>Current Theme: {theme === 'dark' ? 'Dark Control Center' : 'Daylight Workspace'}</span>
              <StatusBadge label={theme.toUpperCase()} variant="neutral" size="sm" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Toggle between deep dark navy control-room styling and high-clarity daylight operations workspace.
            </p>
          </div>

          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-300" />
                <span>Switch to Daylight Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-cyan-300" />
                <span>Switch to Dark Theme</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Station Profile Selection */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Demonstration Station Profiles</span>
        </h2>
        <p className="text-xs text-slate-400">
          Strictly illustrative demonstration network profiles with realistic platform layouts and schedule patterns.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stations.map((st) => {
            const isSelected = st.station_code === selectedStation;
            return (
              <div
                key={st.station_code}
                onClick={() => changeStation(st.station_code)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/25 border-cyan-500/70 shadow-md shadow-cyan-950/40'
                    : 'bg-[#080E19] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-white text-sm">
                    {st.station_code}
                  </span>
                  <StatusBadge
                    label={isSelected ? 'ACTIVE PROFILE' : 'SELECT'}
                    variant={isSelected ? 'candidate' : 'neutral'}
                    size="sm"
                  />
                </div>

                <div className="text-xs font-semibold text-slate-200">{st.station_name}</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {st.description}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Tracks: {st.total_platforms}</span>
                  <span>Headway: {st.min_headway_minutes}m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backend Integration Diagnostics (Voluntary manual probing) */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Backend Integration Diagnostics (Voluntary)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Diagnostics are NOT executed automatically. The dashboard runs in autonomous client demo mode unless voluntarily tested.
            </p>
          </div>

          <button
            onClick={checkHealth}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>Probe Server Connection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Backend Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  health.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              <span className="text-sm font-bold text-white font-mono">
                {health.isOnline ? 'CONNECTED' : 'STANDALONE DEMO'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Application Version</span>
            <span className="text-sm font-bold text-cyan-400 font-mono mt-1 block">
              v1.4.0 (Enterprise)
            </span>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Scheduler Logic</span>
            <span className="text-sm font-bold text-emerald-400 font-mono mt-1 block">
              Deterministic Solver
            </span>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Measured Roundtrip</span>
            <span className="text-sm font-bold text-slate-200 font-mono mt-1 block">
              {health.latencyMs !== undefined ? `${health.latencyMs} ms` : 'Local memory'}
            </span>
          </div>
        </div>

        {/* Manual Endpoint Probers */}
        <div className="pt-2 space-y-3">
          <span className="text-xs font-semibold text-slate-300 block">
            Manual Route Diagnostics (Click to test individual route response):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {testEndpoints.map((test) => (
              <button
                key={test.path}
                onClick={() => runManualProbe(test)}
                disabled={probingEndpoint !== null}
                className="p-2.5 rounded bg-[#080E19] hover:bg-slate-800/80 border border-slate-800 text-left transition-colors text-xs flex flex-col justify-between cursor-pointer"
              >
                <div className="font-mono text-cyan-400 font-semibold truncate text-[11px]">
                  {test.label}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                  {test.path}
                </div>
              </button>
            ))}
          </div>

          {probeResult && (
            <div className="mt-3 p-3 rounded bg-[#080E19] border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-cyan-400 font-bold">{probeResult.endpoint}</span>
                <span
                  className={
                    probeResult.status === '200 OK'
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400 font-bold'
                  }
                >
                  {probeResult.status}
                </span>
              </div>
              <pre className="text-[11px] text-slate-300 bg-[#040810] p-2.5 rounded overflow-x-auto max-h-48 border border-slate-900 font-mono">
                {typeof probeResult.data === 'string'
                  ? probeResult.data
                  : JSON.stringify(probeResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Demo Reset Safety Controls */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-amber-400" />
          <span>Demonstration Data Reset</span>
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded bg-[#080E19] border border-slate-800">
          <div>
            <div className="text-xs font-bold text-white">Reset Operational State to Baseline</div>
            <p className="text-xs text-slate-400 mt-0.5">
              Restores initial nominal timetables, clears delays, reopens all platforms, and discards unadopted candidates.
            </p>
          </div>

          <button
            onClick={() => setConfirmResetOpen(true)}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            Reset Demo Data to Baseline
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmResetOpen}
        title="Confirm Demonstration Data Reset"
        description={`This will restore initial baseline schedules and reopen all platform tracks for station ${selectedStation}.`}
        variant="warning"
        confirmLabel="Confirm Full Reset"
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
