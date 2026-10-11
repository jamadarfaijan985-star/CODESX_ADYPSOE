import React, { useState } from 'react';
import {
  History,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Train,
  Eye,
  X,
  Search,
  Filter,
  Layers,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { ScheduleHistoryEntry } from '../../types/railway';

export const ScheduleHistoryView: React.FC = () => {
  const { history, selectedStation } = useRailway();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedSnapshot, setSelectedSnapshot] = useState<ScheduleHistoryEntry | null>(null);

  const filteredHistory = history.filter((entry) => {
    const matchesSearch =
      entry.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.schedule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.affected_target && entry.affected_target.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = filterType === 'ALL' || entry.action_type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Schedule Revision History &amp; Audit Trail"
        subtitle="Chronological log of demonstration events, disruption reports, candidate creations, and validator checks."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <StatusBadge
            label="DEMO AUDIT TRAIL — SIMULATION ONLY"
            variant="demo"
            size="sm"
          />
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-[#111D2D] border border-slate-800 rounded-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search events by keyword, train ID, or schedule ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#080E19] border border-slate-700/80 rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Action:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Event Types</option>
            <option value="BASELINE_LOAD">Baseline Load</option>
            <option value="DELAY_REGISTERED">Delay Registered</option>
            <option value="PLATFORM_CLOSURE_REGISTERED">Platform Closure</option>
            <option value="CANDIDATE_CREATED">Candidate Created</option>
            <option value="DEMO_VALIDATION_COMPLETED">Validation Completed</option>
            <option value="CANDIDATE_SELECTED">Candidate Adopted</option>
            <option value="CANDIDATE_REJECTED">Candidate Rejected</option>
            <option value="DEMO_RESET">Demo Reset</option>
          </select>
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No demonstration events found matching the query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#080E19] border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Event Type</th>
                  <th className="py-3 px-3">Target</th>
                  <th className="py-3 px-3">Description Summary</th>
                  <th className="py-3 px-3">Validation</th>
                  <th className="py-3 px-3">Conflicts</th>
                  <th className="py-3 px-3 text-right">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {filteredHistory.map((entry) => (
                  <tr key={entry.entry_id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-cyan-300 border border-slate-700 font-bold whitespace-nowrap">
                        {entry.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {entry.affected_target || '—'}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-200">
                      {entry.summary}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge
                        label={entry.validation_state}
                        variant={entry.validation_state === 'VALID' ? 'valid' : 'invalid'}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-3 text-slate-300 tabular-nums">
                      {entry.conflicts_count > 0 ? (
                        <span className="text-red-400 font-bold">
                          {entry.conflicts_count} active
                        </span>
                      ) : (
                        <span className="text-emerald-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedSnapshot(entry)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-[11px] transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snapshot Deep Inspection Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111D2D] border border-slate-700 rounded-lg max-w-3xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-mono">
                    Schedule Snapshot: {selectedSnapshot.schedule_id}
                  </h3>
                  <StatusBadge label={selectedSnapshot.action_type} variant="neutral" size="sm" />
                </div>
                <span className="text-xs text-slate-400 font-sans">
                  Captured: {new Date(selectedSnapshot.timestamp).toLocaleString()} · Station:{' '}
                  {selectedSnapshot.station_code}
                </span>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3">
              <div className="text-xs text-slate-300 bg-[#080E19] p-3 rounded border border-slate-800">
                <strong>Event Summary:</strong> {selectedSnapshot.summary}
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-[#080E19] border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 px-3">Train</th>
                      <th className="py-2 px-3">Service</th>
                      <th className="py-2 px-3">Platform</th>
                      <th className="py-2 px-3">Arrival</th>
                      <th className="py-2 px-3">Departure</th>
                      <th className="py-2 px-3">Delay</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedSnapshot.snapshot.map((t) => (
                      <tr key={t.train_id}>
                        <td className="py-2 px-3 text-cyan-400 font-bold">{t.train_id}</td>
                        <td className="py-2 px-3 text-slate-300 font-sans">{t.train_name}</td>
                        <td className="py-2 px-3 text-white font-semibold">{t.platform_id}</td>
                        <td className="py-2 px-3 text-slate-300">{t.arrival_time}</td>
                        <td className="py-2 px-3 text-slate-300">{t.departure_time}</td>
                        <td className="py-2 px-3 text-amber-400">+{t.delay_minutes}m</td>
                        <td className="py-2 px-3">
                          <StatusBadge
                            label={t.status}
                            variant={t.status === 'ON_TIME' ? 'on_time' : 'delayed'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 shrink-0">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
