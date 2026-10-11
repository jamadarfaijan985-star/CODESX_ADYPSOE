import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  Clock,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { StatusBadge } from '../common/StatusBadge';

interface ScheduleComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToDisruptions?: () => void;
}

export const ScheduleComparisonModal: React.FC<ScheduleComparisonModalProps> = ({
  isOpen,
  onClose,
  onReturnToDisruptions,
}) => {
  const {
    candidateReplan,
    originalScheduleSnapshot,
    adoptCandidate,
    discardCandidate,
    runFrontendValidation,
    selectedStation,
  } = useRailway();

  const [isAdopting, setIsAdopting] = useState(false);
  const [adoptFeedback, setAdoptFeedback] = useState<string | null>(null);

  if (!isOpen || !candidateReplan) return null;

  const candidate = candidateReplan.candidate_schedule;
  const original = originalScheduleSnapshot || [];
  const summary = candidateReplan.change_summary;
  const validation = candidateReplan.validation;
  const isValid = validation.validation_state === 'VALID';

  const handleRunDemoValidationOnCandidate = () => {
    runFrontendValidation(candidate);
  };

  const handleAdopt = async () => {
    if (!isValid) return;
    setIsAdopting(true);
    setAdoptFeedback(null);
    try {
      await adoptCandidate();
      onClose();
    } catch (err: any) {
      setAdoptFeedback(err.message || 'Adoption failed');
    } finally {
      setIsAdopting(false);
    }
  };

  const handleDiscard = () => {
    discardCandidate();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#111D2D] border border-slate-700 rounded-xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#080E19] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <span>Schedule Comparison &amp; Replan Review</span>
              </h2>
              <StatusBadge label="ILLUSTRATIVE CANDIDATE" variant="candidate" size="sm" />
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {candidateReplan.replan_id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Station: <strong className="text-white font-mono">{selectedStation}</strong> · Status:{' '}
              <span className="font-mono text-cyan-300 font-bold">{candidateReplan.status}</span> ·
              Deterministic constraint reallocation
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Change Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[11px]">Total Trains</span>
              <span className="text-lg font-mono font-bold text-white tabular-nums">
                {summary.total_trains}
              </span>
            </div>

            <div className="p-3 rounded bg-[#080E19] border border-cyan-900/60 text-xs">
              <span className="text-cyan-400 block text-[11px]">Platform Reallocations</span>
              <span className="text-lg font-mono font-bold text-cyan-300 tabular-nums">
                {summary.platform_changes}
              </span>
            </div>

            <div className="p-3 rounded bg-[#080E19] border border-amber-900/60 text-xs">
              <span className="text-amber-400 block text-[11px]">Dwell Time Shifts</span>
              <span className="text-lg font-mono font-bold text-amber-300 tabular-nums">
                {summary.time_shifts}
              </span>
            </div>

            <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-xs">
              <span className="text-slate-400 block text-[11px]">Unchanged Trains</span>
              <span className="text-lg font-mono font-bold text-slate-300 tabular-nums">
                {summary.unchanged_trains}
              </span>
            </div>

            <div className="p-3 rounded bg-[#080E19] border border-emerald-900/60 text-xs">
              <span className="text-emerald-400 block text-[11px]">Resolved Conflicts</span>
              <span className="text-lg font-mono font-bold text-emerald-300 tabular-nums">
                {summary.conflicts_resolved}
              </span>
            </div>

            <div
              className={`p-3 rounded border text-xs ${
                summary.remaining_conflicts === 0
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                  : 'bg-red-950/20 border-red-800/40 text-red-300'
              }`}
            >
              <span className="block text-[11px]">Remaining Conflicts</span>
              <span className="text-lg font-mono font-bold tabular-nums">
                {summary.remaining_conflicts}
              </span>
            </div>
          </div>

          {/* Validation Status Card */}
          <div
            className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isValid
                ? 'bg-emerald-950/30 border-emerald-600/70 text-emerald-200'
                : 'bg-red-950/30 border-red-600/70 text-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isValid ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider">
                    Candidate Validation: {validation.validation_state}
                  </span>
                  <StatusBadge
                    label="DEMO VALIDATION — NOT AUTHORITATIVE"
                    variant="demo"
                    size="sm"
                  />
                </div>
                <span className="text-xs text-slate-300 block mt-0.5">
                  {isValid
                    ? 'All 4 independent checks confirmed passed. Safe for demonstration adoption.'
                    : `Infeasible: ${validation.total_violations} safety checks failed. Adoption prohibited.`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRunDemoValidationOnCandidate}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Re-run Demo Validation</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Detailed Schedule Comparison Table */}
          <div className="bg-[#080E19] border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-3 bg-[#111D2D]/80 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>Side-by-Side Assignment Comparison</span>
                <span className="text-slate-400 font-normal">
                  (Original Schedule vs Illustrative Candidate)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                  <span>Platform Shift</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Time Shift</span>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0c1626] border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Train</th>
                    <th className="py-2.5 px-3">Original Schedule</th>
                    <th className="py-2.5 px-3">Proposed Candidate</th>
                    <th className="py-2.5 px-3">Assignment Shift</th>
                    <th className="py-2.5 px-3">Illustrative Change Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {candidate.map((cTrain) => {
                    const origTrain = original.find((t) => t.train_id === cTrain.train_id);
                    const explanation = candidateReplan.explanations.find(
                      (e) => e.train_id === cTrain.train_id
                    );

                    const platformChanged = origTrain && origTrain.platform_id !== cTrain.platform_id;
                    const timeChanged =
                      origTrain &&
                      (origTrain.arrival_time !== cTrain.arrival_time ||
                        origTrain.departure_time !== cTrain.departure_time);

                    const hasChanges = platformChanged || timeChanged;

                    return (
                      <tr
                        key={cTrain.train_id}
                        className={`transition-colors ${
                          hasChanges ? 'bg-cyan-950/20' : 'hover:bg-slate-800/20'
                        }`}
                      >
                        {/* Train ID & Name */}
                        <td className="py-3 px-3 font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span>{cTrain.train_id}</span>
                            {hasChanges && (
                              <span
                                className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"
                                title="Reallocated assignment"
                              />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans truncate">
                            {cTrain.train_name}
                          </div>
                        </td>

                        {/* Original Schedule */}
                        <td className="py-3 px-3 text-slate-400">
                          {origTrain ? (
                            <div>
                              <span className="text-slate-300 font-semibold">
                                Platform {origTrain.platform_id}
                              </span>{' '}
                              · {origTrain.arrival_time} - {origTrain.departure_time}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>

                        {/* Proposed Candidate */}
                        <td className="py-3 px-3">
                          <div>
                            <span
                              className={`font-semibold ${
                                platformChanged ? 'text-cyan-400' : 'text-slate-300'
                              }`}
                            >
                              Platform {cTrain.platform_id}
                            </span>{' '}
                            ·{' '}
                            <span className={timeChanged ? 'text-amber-400' : 'text-slate-300'}>
                              {cTrain.arrival_time} - {cTrain.departure_time}
                            </span>
                          </div>
                        </td>

                        {/* Shift Badges */}
                        <td className="py-3 px-3">
                          {hasChanges ? (
                            <div className="flex items-center gap-1.5">
                              {platformChanged && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                                  Track Shift
                                </span>
                              )}
                              {timeChanged && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                                  Time Shift
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 font-normal">Unchanged</span>
                          )}
                        </td>

                        {/* Explanation */}
                        <td className="py-3 px-3 font-sans text-xs">
                          {explanation ? (
                            <div className="space-y-0.5">
                              <p className="text-slate-200">{explanation.primary_reason}</p>
                              <span className="text-[10px] font-mono text-cyan-400/80">
                                [ILLUSTRATIVE CANDIDATE]
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">Nominal conflict-free dwell.</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {adoptFeedback && (
            <div className="p-3 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs">
              {adoptFeedback}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-[#080E19] border-t border-slate-800 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Discard Candidate &amp; Keep Original
            </button>
            {onReturnToDisruptions && (
              <button
                onClick={() => {
                  onClose();
                  onReturnToDisruptions();
                }}
                className="px-3 py-2 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
              >
                Return to Disruptions
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isValid && (
              <span className="text-xs text-red-400 flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Adoption disabled: Candidate invalid under safety model</span>
              </span>
            )}

            <button
              onClick={handleAdopt}
              disabled={!isValid || isAdopting}
              className={`px-5 py-2.5 rounded font-bold text-xs transition-colors flex items-center gap-2 ${
                isValid
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 cursor-pointer shadow-sm'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAdopting ? 'Adopting Schedule...' : 'Adopt Candidate Timetable (Demo)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
