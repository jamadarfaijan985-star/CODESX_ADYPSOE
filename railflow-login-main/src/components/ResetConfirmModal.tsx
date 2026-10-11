import React from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import { useRailway } from '../context/RailwayContext';

interface ResetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { resetSchedule, selectedStation } = useRailway();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await resetSchedule();
      onClose();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111D2D] border border-slate-700 rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Reset Timetable to Baseline
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Are you sure you want to restore the nominal baseline timetable for{' '}
          <strong className="text-cyan-400 font-mono">{selectedStation}</strong>?
        </p>

        <div className="p-3 rounded bg-amber-950/30 border border-amber-900/60 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            This will clear all registered train delays, reopen closed platforms, and discard any candidate schedules under review.
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-colors"
          >
            Confirm Timetable Reset
          </button>
        </div>
      </div>
    </div>
  );
};
