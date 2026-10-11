import React, { useState } from 'react';
import {
  Flame,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ArrowRight,
  RotateCcw,
  History,
  Train,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

interface DisruptionManagementViewProps {
  onOpenReplanModal: () => void;
}

export const DisruptionManagementView: React.FC<DisruptionManagementViewProps> = ({
  onOpenReplanModal,
}) => {
  const {
    timetable,
    platforms,
    selectedStation,
    submitDelay,
    submitClosure,
    reopenPlatform,
    replanSchedule,
    candidateReplan,
    disruptions,
    isLoading,
  } = useRailway();

  // Train Delay Form State
  const [delayTrainId, setDelayTrainId] = useState(timetable[0]?.train_id || 'T102');
  const [delayMinutes, setDelayMinutes] = useState('15');
  const [delayReason, setDelayReason] = useState('Locomotive traction power loss upstream');
  const [delayNotes, setDelayNotes] = useState('Reported via corridor block dispatcher');
  const [delayFeedback, setDelayFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Platform Closure Form State
  const [closurePlatformId, setClosurePlatformId] = useState(platforms[0]?.platform_id || 'P2');
  const [closureStart, setClosureStart] = useState('08:30');
  const [closureEnd, setClosureEnd] = useState('10:00');
  const [closureReason, setClosureReason] = useState('Emergency track switch maintenance');
  const [closureNotes, setClosureNotes] = useState('Overhead line inspection crew on track');
  const [closureFeedback, setClosureFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Dialog States
  const [confirmDelayOpen, setConfirmDelayOpen] = useState(false);
  const [confirmClosureOpen, setConfirmClosureOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [promptReplan, setPromptReplan] = useState(false);

  // Pre-fill illustrative prompt requested by user (Train T102 - 15 mins)
  const loadIllustrativeExample = () => {
    setDelayTrainId('T102');
    setDelayMinutes('15');
    setDelayReason('Signal failure at junction interlocking');
    setDelayNotes('Standard illustrative scenario for conflict propagation demo');
  };

  const handleOpenDelayConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setDelayFeedback(null);
    const mins = parseInt(delayMinutes, 10);
    if (!delayTrainId) {
      setDelayFeedback({ type: 'error', message: 'Please select a scheduled train.' });
      return;
    }
    if (isNaN(mins) || mins <= 0) {
      setDelayFeedback({ type: 'error', message: 'Delay must be a positive integer.' });
      return;
    }
    setConfirmDelayOpen(true);
  };

  const executeDelaySubmission = async () => {
    setIsSubmitting(true);
    try {
      const res = await submitDelay({
        train_id: delayTrainId,
        delay_minutes: parseInt(delayMinutes, 10),
        reason: delayReason,
        station_code: selectedStation,
        notes: delayNotes,
      });
      setDelayFeedback({ type: 'success', message: res.message });
      setConfirmDelayOpen(false);
      setPromptReplan(true);
    } catch (err: any) {
      setDelayFeedback({ type: 'error', message: err.message || 'Delay submission failed' });
      setConfirmDelayOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenClosureConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setClosureFeedback(null);
    if (!closurePlatformId) {
      setClosureFeedback({ type: 'error', message: 'Please select a platform.' });
      return;
    }
    if (!closureStart || !closureEnd) {
      setClosureFeedback({ type: 'error', message: 'Start and end times are required.' });
      return;
    }
    setConfirmClosureOpen(true);
  };

  const executeClosureSubmission = async () => {
    setIsSubmitting(true);
    try {
      const res = await submitClosure({
        platform_id: closurePlatformId,
        closure_start: closureStart,
        closure_end: closureEnd,
        reason: closureReason,
        station_code: selectedStation,
        notes: closureNotes,
      });
      setClosureFeedback({ type: 'success', message: res.message });
      setConfirmClosureOpen(false);
      setPromptReplan(true);
    } catch (err: any) {
      setClosureFeedback({ type: 'error', message: err.message || 'Closure submission failed' });
      setConfirmClosureOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async (platformId: string) => {
    try {
      await reopenPlatform(platformId);
    } catch (err: any) {
      alert(`Failed to reopen platform: ${err.message}`);
    }
  };

  const handleTriggerReplan = async () => {
    if (candidateReplan) {
      onOpenReplanModal();
      setPromptReplan(false);
      return;
    }
    try {
      await replanSchedule();
      onOpenReplanModal();
      setPromptReplan(false);
    } catch (err: any) {
      alert(`Replanning error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Disruption Incident Registration"
        subtitle="Submit simulated train delays and platform track closures with confirmation summaries."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <button
            onClick={loadIllustrativeExample}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/50 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Illustrative Demo (T102 +15m)</span>
          </button>
        }
      />

      {/* Replan Prompt CTA if disruption just posted */}
      {promptReplan && (
        <div className="p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/70 flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-400 animate-spin" />
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Backend Revised Timetable Available</span>
                <StatusBadge label="VALIDATED RESULT" variant="valid" size="sm" />
              </div>
              <p className="text-xs text-cyan-200 mt-0.5">
                The backend scheduler has returned a revised timetable. Review its assignments and
                authoritative validation result before continuing the demonstration.
              </p>
            </div>
          </div>
          <button
            onClick={handleTriggerReplan}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm shadow-cyan-950"
          >
            <span>{candidateReplan ? 'Review Backend Result' : 'Launch Replanning Workflow'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Two Primary Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow A: Register Train Delay */}
        <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Register Train Delay
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-[#080E19] px-2 py-0.5 rounded border border-slate-800">
              Demo Disruption
            </span>
          </div>

          <form onSubmit={handleOpenDelayConfirm} className="space-y-3.5 text-xs">
            {/* Train selector */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Select Scheduled Train</label>
              <select
                value={delayTrainId}
                onChange={(e) => setDelayTrainId(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              >
                {timetable.map((t) => (
                  <option key={t.train_id} value={t.train_id}>
                    {t.train_id} — {t.train_name} (STA: {t.arrival_time}, Track: {t.platform_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Delay minutes */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">
                Delay Amount (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="240"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="e.g. 15"
                required
              />
            </div>

            {/* Reason */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Incident Justification</label>
              <input
                type="text"
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Locomotive power failure, signaling interlock fault"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-slate-400 block mb-1 font-medium text-[11px]">
                Incident Notes (Optional)
              </label>
              <input
                type="text"
                value={delayNotes}
                onChange={(e) => setDelayNotes(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                placeholder="Additional dispatcher context..."
              />
            </div>

            {/* Feedback */}
            {delayFeedback && (
              <div
                className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                  delayFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border border-red-800 text-red-300'
                }`}
              >
                {delayFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{delayFeedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Review &amp; Register Train Delay</span>
            </button>
          </form>
        </div>

        {/* Workflow B: Register Platform Closure */}
        <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Order Platform Closure
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-[#080E19] px-2 py-0.5 rounded border border-slate-800">
              Demo Blockade
            </span>
          </div>

          <form onSubmit={handleOpenClosureConfirm} className="space-y-3.5 text-xs">
            {/* Platform selector */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Select Platform Track</label>
              <select
                value={closurePlatformId}
                onChange={(e) => setClosurePlatformId(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
              >
                {platforms.map((p) => (
                  <option key={p.platform_id} value={p.platform_id}>
                    {p.platform_id} — {p.name} {p.is_closed ? '(Already Closed)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Time window */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Closure Start (HH:MM)</label>
                <input
                  type="text"
                  value={closureStart}
                  onChange={(e) => setClosureStart(e.target.value)}
                  className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="08:30"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Closure End (HH:MM)</label>
                <input
                  type="text"
                  value={closureEnd}
                  onChange={(e) => setClosureEnd(e.target.value)}
                  className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="10:00"
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Closure Reason</label>
              <input
                type="text"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Overhead electrical line fault, switch point inspection"
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-slate-400 block mb-1 font-medium text-[11px]">
                Safety Work Order Reference (Optional)
              </label>
              <input
                type="text"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Work permit WP-2026-99"
              />
            </div>

            {/* Feedback */}
            {closureFeedback && (
              <div
                className={`p-2.5 rounded text-xs flex items-center gap-2 ${
                  closureFeedback.type === 'success'
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                    : 'bg-red-950/60 border border-red-800 text-red-300'
                }`}
              >
                {closureFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{closureFeedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Review &amp; Submit Platform Closure</span>
            </button>
          </form>
        </div>
      </div>

      {/* Active Platforms Status & Reopen Controls */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Platform Status &amp; Reopen Controls ({platforms.length} Tracks)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {platforms.map((plat) => (
            <div
              key={plat.platform_id}
              className={`p-3 rounded-lg border text-xs flex flex-col justify-between ${
                plat.is_closed
                  ? 'bg-red-950/30 border-red-700/80 text-red-200'
                  : 'bg-[#080E19] border-slate-800 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white">{plat.platform_id}</span>
                  <StatusBadge
                    label={plat.is_closed ? 'CLOSED' : 'OPEN'}
                    variant={plat.is_closed ? 'closed' : 'on_time'}
                    size="sm"
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{plat.name}</div>

                {plat.is_closed && (
                  <div className="mt-2 text-[10px] text-red-300 font-mono">
                    Window: {plat.closure_start} - {plat.closure_end}
                    <div className="text-slate-400 text-[10px] mt-0.5">{plat.closure_reason}</div>
                  </div>
                )}
              </div>

              {plat.is_closed && (
                <button
                  onClick={() => handleReopen(plat.platform_id)}
                  className="mt-3 w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Reopen Platform Track
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Disruption Incident History Table */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          <span>Incident Audit Records</span>
        </h2>

        {disruptions.length === 0 ? (
          <div className="text-slate-500 text-xs py-6 text-center">
            No disruption incidents registered in this demonstration session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#080E19] border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Disruption ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Reported Time</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {disruptions.map((d) => (
                  <tr key={d.disruption_id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-cyan-400 font-semibold">{d.disruption_id}</td>
                    <td className="py-2.5 px-3 text-slate-200">{d.type}</td>
                    <td className="py-2.5 px-3 text-white font-bold">{d.entity_id}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(d.reported_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-sans">{d.reason}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge label={d.status} variant="pending" size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Train Delay */}
      <ConfirmationDialog
        isOpen={confirmDelayOpen}
        title="Confirm Train Delay Registration"
        description={`You are about to register an operational delay for ${delayTrainId} in the demonstration timetable.`}
        variant="warning"
        confirmLabel="Authorize Train Delay"
        isLoading={isSubmitting}
        details={
          <div className="space-y-1">
            <div>
              Train ID: <strong className="text-cyan-400">{delayTrainId}</strong>
            </div>
            <div>
              Delay: <strong className="text-amber-400">+{delayMinutes} minutes</strong>
            </div>
            <div>
              Reason: <span className="text-slate-300">{delayReason}</span>
            </div>
            {delayNotes && (
              <div>
                Notes: <span className="text-slate-400">{delayNotes}</span>
              </div>
            )}
          </div>
        }
        onConfirm={executeDelaySubmission}
        onCancel={() => setConfirmDelayOpen(false)}
      />

      {/* Confirmation Dialog: Platform Closure */}
      <ConfirmationDialog
        isOpen={confirmClosureOpen}
        title="Confirm Platform Closure Order"
        description={`You are ordering an operational blockade of Platform ${closurePlatformId}. Trains assigned to this platform during this window will be flagged as conflicts.`}
        variant="danger"
        confirmLabel="Authorize Platform Closure"
        isLoading={isSubmitting}
        details={
          <div className="space-y-1">
            <div>
              Platform: <strong className="text-cyan-400">{closurePlatformId}</strong>
            </div>
            <div>
              Window: <strong className="text-red-400">{closureStart} → {closureEnd}</strong>
            </div>
            <div>
              Reason: <span className="text-slate-300">{closureReason}</span>
            </div>
          </div>
        }
        onConfirm={executeClosureSubmission}
        onCancel={() => setConfirmClosureOpen(false)}
      />
    </div>
  );
};
