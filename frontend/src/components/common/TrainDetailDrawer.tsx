import React from 'react';
import { Train, X, AlertTriangle, ShieldCheck, Clock, Layers, ArrowRight } from 'lucide-react';
import { TrainScheduleItem, ConflictItem } from '../../types/railway';
import { StatusBadge } from './StatusBadge';

interface TrainDetailDrawerProps {
  train: TrainScheduleItem | null;
  conflicts: ConflictItem[];
  onClose: () => void;
  onQuickDelay?: (trainId: string) => void;
}

export const TrainDetailDrawer: React.FC<TrainDetailDrawerProps> = ({
  train,
  conflicts,
  onClose,
  onQuickDelay,
}) => {
  if (!train) return null;

  const trainConflicts = conflicts.filter((c) => c.affected_trains.includes(train.train_id));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111D2D] border border-slate-700 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Train className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">{train.train_id}</span>
                <StatusBadge
                  label={train.status}
                  variant={train.status === 'ON_TIME' ? 'on_time' : 'delayed'}
                  size="sm"
                />
              </div>
              <span className="text-xs text-slate-400 font-sans">{train.train_name}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Schedule grid */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Assigned Platform</span>
            <span className="text-sm font-mono font-bold text-white">{train.platform_id}</span>
          </div>

          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Direction / Service</span>
            <span className="text-sm font-mono font-bold text-slate-200">{train.direction}</span>
          </div>

          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Scheduled Arrival (STA)</span>
            <span className="text-sm font-mono font-bold text-cyan-300">{train.arrival_time}</span>
          </div>

          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Scheduled Departure (STD)</span>
            <span className="text-sm font-mono font-bold text-cyan-300">{train.departure_time}</span>
          </div>

          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Current Delay</span>
            <span
              className={`text-sm font-mono font-bold ${
                train.delay_minutes > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {train.delay_minutes > 0 ? `+${train.delay_minutes} min` : '0 min (On Time)'}
            </span>
          </div>

          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Headway Clearance</span>
            <span className="text-sm font-mono font-bold text-slate-300">
              {train.clearance_minutes}m buffer
            </span>
          </div>
        </div>

        {train.notes && (
          <div className="p-2.5 rounded bg-[#080E19] border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px] block font-semibold mb-1">
              Dispatcher Operating Notes
            </span>
            <p className="text-slate-300">{train.notes}</p>
          </div>
        )}

        {/* Conflict warning */}
        {trainConflicts.length > 0 && (
          <div className="p-3 rounded bg-red-950/30 border border-red-800/60 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-red-300 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Active Conflicts Involving {train.train_id}</span>
            </div>
            {trainConflicts.map((c) => (
              <p key={c.conflict_id} className="text-red-200 text-[11px]">
                {c.description}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          {onQuickDelay && (
            <button
              onClick={() => {
                onClose();
                onQuickDelay(train.train_id);
              }}
              className="px-3 py-1.5 rounded bg-amber-600/80 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Register Delay for {train.train_id}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium ml-auto"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
