import React from 'react';
import {
  Train,
  Layers,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Wrench,
  Radio,
  Calendar,
  Flame,
  FileSpreadsheet,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { NavigationTab } from '../Sidebar';
import { KpiCard } from '../common/KpiCard';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { timeToMinutes } from '../../server/validator';

interface OverviewViewProps {
  onNavigate: (tab: NavigationTab) => void;
  onOpenReplanModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigate,
  onOpenReplanModal,
}) => {
  const {
    timetable,
    platforms,
    conflicts,
    validation,
    candidateReplan,
    selectedStation,
    currentStationProfile,
    disruptions,
    history,
    replanSchedule,
    isLoading,
  } = useRailway();

  const totalTrains = timetable.length;
  const delayedTrains = timetable.filter((t) => t.delay_minutes > 0).length;
  const closedPlatforms = platforms.filter((p) => p.is_closed).length;
  const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL').length;
  const latestDisruption = disruptions[0];
  const recentHistory = history.slice(0, 4);

  // Upcoming movements sorted by arrival time
  const upcomingTrains = [...timetable]
    .sort((a, b) => timeToMinutes(a.arrival_time) - timeToMinutes(b.arrival_time))
    .slice(0, 5);

  const handleQuickReplan = async () => {
    try {
      await replanSchedule();
      onOpenReplanModal();
    } catch (err: any) {
      alert(`Replanning error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Operations Control Center"
        subtitle="Real-time timetable monitoring, platform headway surveillance, and authoritative conflict resolution."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          conflicts.length > 0 ? (
            <button
              onClick={handleQuickReplan}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-cyan-900/40 cursor-pointer"
            >
              <Cpu className="w-4 h-4 stroke-[2.2]" />
              <span>Generate Replan Candidate ({conflicts.length} Conflicts)</span>
            </button>
          ) : candidateReplan ? (
            <button
              onClick={onOpenReplanModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600 font-bold text-xs transition-colors cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>Review Candidate Schedule ({candidateReplan.replan_id.slice(-6)})</span>
            </button>
          ) : null
        }
      />

      {/* 6 Primary Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Scheduled Trains */}
        <KpiCard
          label="Scheduled Trains"
          value={totalTrains}
          subtext={delayedTrains > 0 ? `${delayedTrains} delayed` : '100% on schedule'}
          icon={<Train className="w-4 h-4" />}
          variant={delayedTrains > 0 ? 'warning' : 'default'}
          onClick={() => onNavigate('timetable')}
        />

        {/* KPI 2: Total Platforms */}
        <KpiCard
          label="Platform Tracks"
          value={`${platforms.length - closedPlatforms} / ${platforms.length}`}
          subtext={closedPlatforms > 0 ? `${closedPlatforms} maintenance closure` : 'All tracks clear'}
          icon={<Layers className="w-4 h-4" />}
          variant={closedPlatforms > 0 ? 'alert' : 'default'}
          onClick={() => onNavigate('platforms')}
        />

        {/* KPI 3: Active Conflicts */}
        <KpiCard
          label="Active Conflicts"
          value={conflicts.length}
          subtext={
            conflicts.length > 0
              ? `${criticalConflicts} critical collision(s)`
              : 'Zero headway breaches'
          }
          icon={<AlertOctagon className="w-4 h-4" />}
          variant={conflicts.length > 0 ? 'alert' : 'default'}
          onClick={() => onNavigate('conflicts')}
        />

        {/* KPI 4: Open Disruptions */}
        <KpiCard
          label="Open Disruptions"
          value={disruptions.filter((d) => d.status === 'ACTIVE').length}
          subtext={latestDisruption ? `Latest: ${latestDisruption.entity_id}` : 'Normal operations'}
          icon={<Flame className="w-4 h-4" />}
          variant={disruptions.length > 0 ? 'warning' : 'default'}
          onClick={() => onNavigate('disruptions')}
        />

        {/* KPI 5: Latest Validation Result */}
        <KpiCard
          label="Validation Result"
          value={validation?.validation_state || 'UNRESOLVED'}
          subtext={
            validation?.validation_state === 'VALID'
              ? 'All 4 backend checks passed'
              : `${validation?.total_violations || 0} safety breaches`
          }
          icon={
            validation?.validation_state === 'VALID' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-400" />
            )
          }
          variant={
            validation?.validation_state === 'VALID'
              ? 'success'
              : validation?.validation_state === 'INVALID'
              ? 'alert'
              : 'warning'
          }
          onClick={() => onNavigate('conflicts')}
        />

        {/* KPI 6: Candidate Schedule Status */}
        <KpiCard
          label="Candidate Status"
          value={candidateReplan ? candidateReplan.status : 'STANDBY'}
          subtext={candidateReplan ? 'Click to inspect diff →' : 'Baseline timetable'}
          icon={<Cpu className="w-4 h-4" />}
          variant={candidateReplan ? 'info' : 'default'}
          onClick={() => (candidateReplan ? onOpenReplanModal() : onNavigate('timetable'))}
        />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Platform Occupancy Preview & Upcoming Movements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Station Profile & Platform Track Status */}
          <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Active Station Profile: {currentStationProfile?.station_name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {currentStationProfile?.description}
                </p>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Min Headway: {currentStationProfile?.min_headway_minutes || 5} min
              </span>
            </div>

            {/* Platform Track Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {platforms.map((plat) => {
                const assigned = timetable.filter((t) => t.platform_id === plat.platform_id);
                return (
                  <div
                    key={plat.platform_id}
                    onClick={() => onNavigate('platforms')}
                    className={`p-3 rounded border text-xs flex flex-col justify-between cursor-pointer transition-colors ${
                      plat.is_closed
                        ? 'bg-red-950/20 border-red-800/60 hover:bg-red-950/30'
                        : 'bg-[#080E19] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {plat.platform_id}
                        </span>
                        <span className="text-slate-300 font-medium">{plat.name}</span>
                      </div>
                      <StatusBadge
                        label={plat.is_closed ? 'CLOSED' : 'OPEN'}
                        variant={plat.is_closed ? 'closed' : 'on_time'}
                        size="sm"
                      />
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>
                        {plat.track_type} Track · {plat.length_meters}m
                      </span>
                      <span className="font-mono text-slate-200">
                        {assigned.length} trains scheduled
                      </span>
                    </div>

                    {plat.is_closed && (
                      <div className="mt-2 pt-2 border-t border-red-800/40 text-[10px] text-red-300 font-mono">
                        Blockade: {plat.closure_start} - {plat.closure_end} ({plat.closure_reason})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Movements Table */}
          <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Immediate Train Movements (Service Window: 08:00 - 10:00)</span>
              </h2>
              <button
                onClick={() => onNavigate('timetable')}
                className="text-cyan-400 hover:underline text-xs flex items-center gap-1"
              >
                <span>Full timetable</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#080E19] border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Train</th>
                    <th className="py-2.5 px-3">Platform</th>
                    <th className="py-2.5 px-3">Arrival</th>
                    <th className="py-2.5 px-3">Departure</th>
                    <th className="py-2.5 px-3">Delay</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {upcomingTrains.map((train) => (
                    <tr
                      key={train.train_id}
                      onClick={() => onNavigate('timetable')}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white">{train.train_id}</div>
                        <div className="text-[10px] text-slate-400 font-sans truncate">
                          {train.train_name}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-200 bg-[#080E19] border border-slate-700 px-2 py-0.5 rounded">
                          {train.platform_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{train.arrival_time}</td>
                      <td className="py-2.5 px-3 text-slate-200">{train.departure_time}</td>
                      <td className="py-2.5 px-3">
                        {train.delay_minutes > 0 ? (
                          <span className="text-amber-400 font-semibold">
                            +{train.delay_minutes} min
                          </span>
                        ) : (
                          <span className="text-emerald-400">On Time</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge
                          label={train.status}
                          variant={train.status === 'ON_TIME' ? 'on_time' : 'delayed'}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Actions, Recent Audit History, Candidate Review */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white">Primary Dispatcher Workflows</h2>
            <p className="text-xs text-slate-400">
              Protocol: DETECT → UNDERSTAND → REPLAN → VALIDATE → REVIEW
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => onNavigate('disruptions')}
                className="w-full flex items-center justify-between p-2.5 rounded bg-[#080E19] hover:bg-slate-800/60 border border-slate-800 text-xs text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span>Register Delay / Platform Closure</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => onNavigate('platforms')}
                className="w-full flex items-center justify-between p-2.5 rounded bg-[#080E19] hover:bg-slate-800/60 border border-slate-800 text-xs text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Inspect Platform Gantt Timeline</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => onNavigate('conflicts')}
                className="w-full flex items-center justify-between p-2.5 rounded bg-[#080E19] hover:bg-slate-800/60 border border-slate-800 text-xs text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <AlertOctagon className="w-4 h-4 text-red-400" />
                  <span>Run Backend Validation ({validation?.checks_run.length || 4} Checks)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={() => onNavigate('assistant')}
                className="w-full flex items-center justify-between p-2.5 rounded bg-[#080E19] hover:bg-slate-800/60 border border-slate-800 text-xs text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Operations Assistant (Rule Chat)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Candidate Schedule Review Card */}
          {candidateReplan ? (
            <div className="bg-cyan-950/30 border border-cyan-600/70 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>ILLUSTRATIVE CANDIDATE READY</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 border border-cyan-700">
                  {candidateReplan.status}
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                Replan generated {candidateReplan.change_summary.platform_changes} platform
                reallocation(s) and resolved {candidateReplan.change_summary.conflicts_resolved} conflict(s).
              </p>

              <button
                onClick={onOpenReplanModal}
                className="w-full py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span>Inspect Before/After Comparison</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 text-xs text-slate-400 space-y-2">
              <div className="text-white font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Timetable Nominal</span>
              </div>
              <p>
                Baseline timetable active. No replan candidate is currently under review. Register a
                delay or track blockade to simulate conflict resolution.
              </p>
            </div>
          )}

          {/* Recent Audit History Preview */}
          <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white">Recent Operational Events</h2>
              <button
                onClick={() => onNavigate('history')}
                className="text-cyan-400 hover:underline text-xs flex items-center gap-1"
              >
                <span>Full audit</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {recentHistory.map((item) => (
                <div
                  key={item.entry_id}
                  onClick={() => onNavigate('history')}
                  className="p-2.5 rounded bg-[#080E19] border border-slate-800 hover:border-slate-700 cursor-pointer text-xs space-y-1 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-cyan-400 font-semibold">{item.action_type}</span>
                    <span className="text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] truncate font-sans">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
