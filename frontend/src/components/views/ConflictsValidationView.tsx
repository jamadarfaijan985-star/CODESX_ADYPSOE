import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Layers,
  Train,
  Clock,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { TrainDetailDrawer } from '../common/TrainDetailDrawer';
import { TrainScheduleItem } from '../../types/railway';

export const ConflictsValidationView: React.FC = () => {
  const {
    conflicts,
    validation,
    selectedStation,
    timetable,
    runFrontendValidation,
  } = useRailway();

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedTrain, setSelectedTrain] = useState<TrainScheduleItem | null>(null);
  const [inspectingCheckTrainIds, setInspectingCheckTrainIds] = useState<string[] | null>(null);

  const filteredConflicts = conflicts.filter((c) => {
    const matchesSeverity = severityFilter === 'ALL' || c.severity === severityFilter;
    const matchesType = typeFilter === 'ALL' || c.conflict_type === typeFilter;
    return matchesSeverity && matchesType;
  });

  const handleRunDemoValidation = () => {
    runFrontendValidation();
  };

  const openTrainDetail = (trainId: string) => {
    const t = timetable.find((item) => item.train_id === trainId);
    if (t) {
      setSelectedTrain(t);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Conflict Detection &amp; Schedule Validation"
        subtitle="Separated conflict detection and 4-tier independent constraint verification engine."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <button
            onClick={handleRunDemoValidation}
            className="flex items-center gap-2 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors shadow-sm shadow-cyan-900/40 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Demo Validation</span>
          </button>
        }
      />

      {/* Prominent Demo Validation Banner */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Independent Schedule Validator Engine
              </h2>
              <StatusBadge
                label="DEMO VALIDATION — NOT AUTHORITATIVE"
                variant="demo"
                size="sm"
              />
              {validation?.validation_state === 'VALID' ? (
                <StatusBadge
                  label="VALID (ALL CHECKS PASSED)"
                  variant="valid"
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                />
              ) : validation?.validation_state === 'INVALID' ? (
                <StatusBadge
                  label={`INVALID (${validation.total_violations} VIOLATION${validation.total_violations > 1 ? 'S' : ''})`}
                  variant="invalid"
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
                />
              ) : (
                <StatusBadge label="PENDING VALIDATION" variant="pending" />
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-3 font-mono pt-1">
              <span>Schedule: {validation?.schedule_id || 'SCH-CURRENT'}</span>
              <span>·</span>
              <span>Validator: RailFlow-DemoValidator-Client-v1.0</span>
              <span>·</span>
              <span>
                Timestamp:{' '}
                {validation?.validated_at
                  ? new Date(validation.validated_at).toLocaleTimeString()
                  : 'Pending execution'}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold font-mono text-white tabular-nums">
              {validation?.total_violations || 0}
            </div>
            <div className="text-[11px] text-slate-400">Total Safety Breaches</div>
          </div>
        </div>

        {/* Four Explicit Validation Checks */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {validation?.checks_run.map((check) => {
            const hasFailed = check.status === 'FAIL';
            const hasPassed = check.status === 'PASS';

            return (
              <div
                key={check.name}
                className={`p-3.5 rounded-lg border text-xs flex flex-col justify-between ${
                  hasFailed
                    ? 'bg-red-950/25 border-red-700/70 text-red-200'
                    : hasPassed
                    ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-200'
                    : 'bg-slate-800/40 border-slate-700 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-[11px] truncate tracking-tight text-white">
                      {check.name}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        hasPassed
                          ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700'
                          : hasFailed
                          ? 'bg-red-900/60 text-red-300 border-red-700'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug mt-1">
                    {check.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Affected:</span>
                    <span
                      className={`font-bold ${
                        check.violations_count > 0 ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {check.violations_count} record(s)
                    </span>
                  </div>

                  {check.affected_train_ids && check.affected_train_ids.length > 0 && (
                    <button
                      onClick={() => setInspectingCheckTrainIds(check.affected_train_ids || [])}
                      className="w-full py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect {check.affected_train_ids.length} Train(s)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Safety Rule Banner */}
        <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-200">Validation Protocol:</strong> No schedule can be marked
            valid if any check reports FAIL. Demonstrations are calculated in-browser and clearly segregated
            from live train dispatching authorities.
          </p>
        </div>
      </div>

      {/* Confirmed Conflicts Registry */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <span>Detected Operational Conflicts ({conflicts.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specific track, time-interval, and train collisions identified by backend constraint analysis.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Conflict Types</option>
              <option value="PLATFORM_OVERLAP">Platform Overlap</option>
              <option value="MINIMUM_CLEARANCE_VIOLATION">Headway Buffer Violation</option>
              <option value="CLOSED_PLATFORM_ASSIGNMENT">Closed Platform Assignment</option>
              <option value="UNFEASIBLE_DWELL">Unfeasible Dwell</option>
            </select>
          </div>
        </div>

        {/* Conflicts List */}
        {filteredConflicts.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-slate-200">Zero Scheduling Conflicts Detected</p>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Current timetable assignments satisfy track separation and clearance buffers.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConflicts.map((c) => (
              <div
                key={c.conflict_id}
                className="p-3.5 rounded-lg bg-[#080E19] border border-red-900/60 hover:border-red-700 transition-colors space-y-2 text-xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={c.severity}
                      variant={c.severity === 'CRITICAL' ? 'conflict' : 'pending'}
                      size="sm"
                    />
                    <span className="font-mono font-bold text-white tracking-tight">
                      {c.conflict_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Platform {c.platform_id}</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        {c.time_interval.start} - {c.time_interval.end}
                      </span>
                    </span>
                  </div>
                </div>

                <p className="text-slate-200 text-xs leading-relaxed font-sans">{c.description}</p>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Train className="w-3.5 h-3.5 text-slate-400" />
                    <span>Involved Trains:</span>
                    {c.affected_trains.map((tid) => (
                      <button
                        key={tid}
                        onClick={() => openTrainDetail(tid)}
                        className="font-mono font-bold text-cyan-300 hover:underline bg-slate-800 px-1.5 py-0.5 rounded"
                      >
                        {tid}
                      </button>
                    ))}
                  </div>

                  <span className="font-mono text-red-400">
                    Status: {c.resolution_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Affected Trains Inspection Drawer / List */}
      {inspectingCheckTrainIds && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111D2D] border border-slate-700 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <Train className="w-4 h-4 text-cyan-400" />
                <span>Affected Trains in Check ({inspectingCheckTrainIds.length})</span>
              </h3>
              <button
                onClick={() => setInspectingCheckTrainIds(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {inspectingCheckTrainIds.map((tid) => {
                const train = timetable.find((t) => t.train_id === tid);
                if (!train) return null;
                return (
                  <div
                    key={tid}
                    onClick={() => {
                      setInspectingCheckTrainIds(null);
                      setSelectedTrain(train);
                    }}
                    className="p-3 rounded bg-[#080E19] border border-slate-800 hover:border-slate-700 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-white">{train.train_id}</div>
                      <div className="text-slate-400 text-[11px]">{train.train_name}</div>
                    </div>
                    <div className="text-right font-mono text-slate-300">
                      <div>Track {train.platform_id}</div>
                      <div className="text-[11px] text-slate-400">
                        {train.arrival_time} - {train.departure_time}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingCheckTrainIds(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Train Detail Modal */}
      <TrainDetailDrawer
        train={selectedTrain}
        conflicts={conflicts}
        onClose={() => setSelectedTrain(null)}
      />
    </div>
  );
};
