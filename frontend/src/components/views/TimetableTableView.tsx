import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Train,
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  RotateCcw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { TrainDetailDrawer } from '../common/TrainDetailDrawer';
import { EmptyState } from '../common/EmptyState';
import { TrainScheduleItem } from '../../types/railway';

export const TimetableTableView: React.FC = () => {
  const {
    timetable,
    platforms,
    conflicts,
    refreshData,
    isLoading,
    selectedStation,
  } = useRailway();

  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [delayFilter, setDelayFilter] = useState<'ALL' | 'ON_TIME' | 'DELAYED'>('ALL');
  const [sortField, setSortField] = useState<'arrival_time' | 'train_id' | 'platform_id' | 'delay_minutes'>('arrival_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedTrain, setSelectedTrain] = useState<TrainScheduleItem | null>(null);

  const filteredAndSortedTrains = useMemo(() => {
    return timetable
      .filter((train) => {
        const matchesSearch =
          train.train_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          train.train_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlatform = platformFilter === 'ALL' || train.platform_id === platformFilter;
        const matchesStatus = statusFilter === 'ALL' || train.status === statusFilter;
        const matchesDelay =
          delayFilter === 'ALL' ||
          (delayFilter === 'ON_TIME' && train.delay_minutes === 0) ||
          (delayFilter === 'DELAYED' && train.delay_minutes > 0);

        return matchesSearch && matchesPlatform && matchesStatus && matchesDelay;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'arrival_time') {
          cmp = a.arrival_time.localeCompare(b.arrival_time);
        } else if (sortField === 'train_id') {
          cmp = a.train_id.localeCompare(b.train_id);
        } else if (sortField === 'platform_id') {
          cmp = a.platform_id.localeCompare(b.platform_id);
        } else if (sortField === 'delay_minutes') {
          cmp = a.delay_minutes - b.delay_minutes;
        }
        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [timetable, searchQuery, platformFilter, statusFilter, delayFilter, sortField, sortDirection]);

  const resetFilters = () => {
    setSearchQuery('');
    setPlatformFilter('ALL');
    setStatusFilter('ALL');
    setDelayFilter('ALL');
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getTrainConflicts = (trainId: string) => {
    return conflicts.filter((c) => c.affected_trains.includes(trainId));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Live Operational Timetable"
        subtitle="Real-time train schedules, platform assignments, dwell windows, and conflict annotations."
        stationCode={selectedStation}
        isDemo={true}
        actions={
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh Timetable</span>
          </button>
        }
      />

      {/* Summary Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111D2D] p-3.5 rounded-lg border border-slate-800 text-xs">
        <div>
          <span className="text-slate-400 text-[11px] block">Total Services</span>
          <span className="font-mono font-bold text-white text-base tabular-nums">
            {timetable.length}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">On Time</span>
          <span className="font-mono font-bold text-emerald-400 text-base tabular-nums">
            {timetable.filter((t) => t.delay_minutes === 0).length}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">Delayed</span>
          <span className="font-mono font-bold text-amber-400 text-base tabular-nums">
            {timetable.filter((t) => t.delay_minutes > 0).length}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[11px] block">Active Conflicts</span>
          <span className="font-mono font-bold text-red-400 text-base tabular-nums">
            {conflicts.length}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-[#111D2D] border border-slate-800 rounded-lg">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Train ID or Name (e.g. T101, 12624, Capitol Express)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#080E19] border border-slate-700/80 rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Platforms</option>
            {platforms.map((p) => (
              <option key={p.platform_id} value={p.platform_id}>
                {p.platform_id} {p.is_closed ? '(Closed)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ON_TIME">On Time</option>
            <option value="DELAYED">Delayed</option>
          </select>
        </div>

        {/* Delay filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Delay:</span>
          <select
            value={delayFilter}
            onChange={(e) => setDelayFilter(e.target.value as any)}
            className="bg-[#080E19] border border-slate-700 text-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Delays</option>
            <option value="ON_TIME">0 min Delay</option>
            <option value="DELAYED">&gt; 0 min Delay</option>
          </select>
        </div>

        {/* Reset filter button */}
        {(searchQuery || platformFilter !== 'ALL' || statusFilter !== 'ALL' || delayFilter !== 'ALL') && (
          <button
            onClick={resetFilters}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#080E19] border-b border-slate-800 text-slate-400 font-mono uppercase text-[11px]">
                <th
                  onClick={() => toggleSort('train_id')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Train ID / Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('platform_id')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Platform</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('arrival_time')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Arrival (STA)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">Departure (STD)</th>
                <th className="py-3 px-4 font-semibold">Dwell Window</th>
                <th
                  onClick={() => toggleSort('delay_minutes')}
                  className="py-3 px-4 font-semibold cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Delay</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Operational Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAndSortedTrains.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      title="No Trains Matching Filter"
                      description="Try adjusting your search terms or clearing selected platform and delay filters."
                      action={
                        <button
                          onClick={resetFilters}
                          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white"
                        >
                          Clear Filters
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredAndSortedTrains.map((train) => {
                  const trainConflicts = getTrainConflicts(train.train_id);
                  const isDisrupted = train.delay_minutes > 0;
                  const hasConflict = trainConflicts.length > 0;

                  return (
                    <tr
                      key={train.train_id}
                      onClick={() => setSelectedTrain(train)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        hasConflict
                          ? 'bg-red-950/20'
                          : isDisrupted
                          ? 'bg-amber-950/15'
                          : ''
                      }`}
                    >
                      {/* Train ID & Name */}
                      <td className="py-3 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          <Train className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div>
                            <div className="font-mono font-bold text-white tracking-tight">
                              {train.train_id}
                            </div>
                            <div className="text-[11px] text-slate-400 font-sans">
                              {train.train_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Platform */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold text-slate-200 bg-[#080E19] border border-slate-700/80 px-2 py-0.5 rounded">
                          {train.platform_id}
                        </span>
                      </td>

                      {/* Arrival */}
                      <td className="py-3 px-4 font-mono text-slate-200 tabular-nums">
                        {train.arrival_time}
                      </td>

                      {/* Departure */}
                      <td className="py-3 px-4 font-mono text-slate-200 tabular-nums">
                        {train.departure_time}
                      </td>

                      {/* Dwell Window */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {train.arrival_time} → {train.departure_time}
                      </td>

                      {/* Delay */}
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {train.delay_minutes > 0 ? (
                          <span className="text-amber-400 font-bold">
                            +{train.delay_minutes} min
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-medium">On Time</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          label={train.status}
                          variant={train.status === 'ON_TIME' ? 'on_time' : 'delayed'}
                          size="sm"
                        />
                      </td>

                      {/* Warnings / Conflicts */}
                      <td className="py-3 px-4">
                        {hasConflict ? (
                          <div className="flex items-center gap-1.5 text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[220px]">
                              {trainConflicts[0].description}
                            </span>
                          </div>
                        ) : train.warnings && train.warnings.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-amber-400">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[220px] text-[11px]">
                              {train.warnings[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-[11px]">Nominal</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Train Detail Modal */}
      <TrainDetailDrawer
        train={selectedTrain}
        conflicts={conflicts}
        onClose={() => setSelectedTrain(null)}
      />
    </div>
  );
};
