import React, { useState } from 'react';
import {
  Layers,
  AlertTriangle,
  Clock,
  Info,
  Calendar,
  X,
  ShieldAlert,
  Ban,
  Train,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { TrainDetailDrawer } from '../common/TrainDetailDrawer';
import { TrainScheduleItem, PlatformInfo, ConflictItem } from '../../types/railway';
import { timeToMinutes } from '../../server/validator';

export const PlatformOperationsView: React.FC = () => {
  const {
    platforms,
    timetable,
    conflicts,
    candidateReplan,
    selectedStation,
    currentStationProfile,
  } = useRailway();

  const [selectedTrain, setSelectedTrain] = useState<TrainScheduleItem | null>(null);

  // Time window bounds: customizable with quick controls (07:30 to 11:30 default = 240 mins)
  const [windowOffset, setWindowOffset] = useState(0); // in minutes
  const baseStart = 450 + windowOffset; // 07:30 default
  const baseEnd = 690 + windowOffset; // 11:30 default
  const totalDuration = baseEnd - baseStart;

  // Generates 30-min time markers
  const timeMarkers = [
    { label: formatMinsToHHMM(baseStart), min: baseStart },
    { label: formatMinsToHHMM(baseStart + 30), min: baseStart + 30 },
    { label: formatMinsToHHMM(baseStart + 60), min: baseStart + 60 },
    { label: formatMinsToHHMM(baseStart + 90), min: baseStart + 90 },
    { label: formatMinsToHHMM(baseStart + 120), min: baseStart + 120 },
    { label: formatMinsToHHMM(baseStart + 150), min: baseStart + 150 },
    { label: formatMinsToHHMM(baseStart + 180), min: baseStart + 180 },
    { label: formatMinsToHHMM(baseStart + 210), min: baseStart + 210 },
    { label: formatMinsToHHMM(baseEnd), min: baseEnd },
  ];

  function formatMinsToHHMM(totalMins: number): string {
    const norm = ((totalMins % 1440) + 1440) % 1440;
    const h = Math.floor(norm / 60);
    const m = norm % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const getPositionPercent = (timeStr: string) => {
    const mins = timeToMinutes(timeStr);
    const clamped = Math.max(baseStart, Math.min(baseEnd, mins));
    return ((clamped - baseStart) / totalDuration) * 100;
  };

  const getWidthPercent = (startStr: string, endStr: string) => {
    const start = Math.max(baseStart, timeToMinutes(startStr));
    const end = Math.min(baseEnd, timeToMinutes(endStr));
    const duration = Math.max(0, end - start);
    return Math.max(3.5, (duration / totalDuration) * 100);
  };

  const getTrainConflicts = (trainId: string) => {
    return conflicts.filter((c) => c.affected_trains.includes(trainId));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Platform Track Occupancy Timeline"
        subtitle="Visual Gantt track schedule, turnaround headway clearances, and maintenance blockades."
        stationCode={selectedStation}
        isDemo={true}
        dataLabel="SIMULATED TIMETABLE"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWindowOffset((prev) => prev - 30)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Shift 30 minutes earlier"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-300 bg-[#111D2D] px-2.5 py-1 rounded border border-slate-700">
              {formatMinsToHHMM(baseStart)} - {formatMinsToHHMM(baseEnd)}
            </span>
            <button
              onClick={() => setWindowOffset((prev) => prev + 30)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Shift 30 minutes later"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Legend Bar */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-3 flex items-center justify-between flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400 inline-block" />
            <span className="text-slate-300">Nominal On-Time</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-amber-600 border border-amber-400 inline-block" />
            <span className="text-slate-300">Delayed / Disrupted</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-red-600 border border-red-400 inline-block" />
            <span className="text-slate-300">Conflict / Collision</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="w-3 h-3 rounded bg-[repeating-linear-gradient(45deg,#7f1d1d,#7f1d1d_4px,#991b1b_4px,#991b1b_8px)] border border-red-500 inline-block" />
            <span className="text-slate-300">Track Blockade</span>
          </div>
          {candidateReplan && (
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="w-3 h-3 rounded bg-cyan-600 border border-cyan-400 inline-block" />
              <span className="text-cyan-300 font-bold">Candidate Replan</span>
            </div>
          )}
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          Headway Buffer: {currentStationProfile?.min_headway_minutes || 5} min
        </span>
      </div>

      {/* Main Timeline Visualization Board */}
      <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-4 space-y-4 overflow-x-auto shadow-md">
        <div className="min-w-[850px]">
          {/* Time Axis Header */}
          <div className="grid grid-cols-12 gap-0 border-b border-slate-700/80 pb-2 mb-3">
            <div className="col-span-2 text-xs font-mono font-semibold text-slate-400">
              Platform Track
            </div>
            <div className="col-span-10 relative h-6">
              {timeMarkers.map((marker) => {
                const leftPos = ((marker.min - baseStart) / totalDuration) * 100;
                return (
                  <div
                    key={marker.label}
                    style={{ left: `${leftPos}%` }}
                    className="absolute -translate-x-1/2 flex flex-col items-center"
                  >
                    <span className="text-[11px] font-mono text-slate-400 font-medium">
                      {marker.label}
                    </span>
                    <span className="w-[1px] h-2 bg-slate-700" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Rows */}
          <div className="space-y-4">
            {platforms.map((plat) => {
              const assignedTrains = timetable.filter((t) => t.platform_id === plat.platform_id);
              const isClosed = plat.is_closed;

              const closureLeft = plat.closure_start ? getPositionPercent(plat.closure_start) : 0;
              const closureWidth =
                plat.closure_start && plat.closure_end
                  ? getWidthPercent(plat.closure_start, plat.closure_end)
                  : 100;

              return (
                <div key={plat.platform_id} className="grid grid-cols-12 gap-0 items-center">
                  {/* Platform Track Label */}
                  <div className="col-span-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">
                        Platform {plat.platform_id}
                      </span>
                      <StatusBadge
                        label={isClosed ? 'CLOSED' : plat.track_type}
                        variant={isClosed ? 'closed' : 'neutral'}
                        size="sm"
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {plat.length_meters}m · {plat.is_electrified ? '25kV AC' : 'Non-elec'}
                    </div>
                  </div>

                  {/* Timeline Track Field */}
                  <div className="col-span-10 relative h-14 bg-[#080E19] border border-slate-800/90 rounded overflow-hidden">
                    {/* Background Grid Lines */}
                    {timeMarkers.map((marker) => {
                      const leftPos = ((marker.min - baseStart) / totalDuration) * 100;
                      return (
                        <div
                          key={marker.label}
                          style={{ left: `${leftPos}%` }}
                          className="absolute top-0 bottom-0 w-[1px] bg-slate-800/60 pointer-events-none"
                        />
                      );
                    })}

                    {/* Platform Closure Block (Hatched safety stripes) */}
                    {isClosed && (
                      <div
                        style={{
                          left: `${closureLeft}%`,
                          width: `${closureWidth}%`,
                        }}
                        className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,rgba(153,27,27,0.4),rgba(153,27,27,0.4)_8px,rgba(185,28,28,0.55)_8px,rgba(185,28,28,0.55)_16px)] border-y border-red-600 flex items-center justify-center z-10 shadow"
                        title={`Track Blockade: Platform ${plat.platform_id} Closed ${plat.closure_start || '00:00'} - ${plat.closure_end || '23:59'} (${plat.closure_reason || 'Maintenance'})`}
                      >
                        <div className="bg-red-950/95 px-2.5 py-1 rounded border border-red-700/80 text-[10px] font-mono text-red-200 flex items-center gap-1.5 shadow">
                          <Ban className="w-3.5 h-3.5 text-red-400" />
                          <span>
                            BLOCKADE ({plat.closure_start} - {plat.closure_end})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Train Occupancy Blocks */}
                    {assignedTrains.map((train) => {
                      const trainConflicts = getTrainConflicts(train.train_id);
                      const hasConflict = trainConflicts.length > 0;
                      const isDelayed = train.delay_minutes > 0;

                      const left = getPositionPercent(train.arrival_time);
                      const width = getWidthPercent(train.arrival_time, train.departure_time);

                      let blockBg = 'bg-blue-600/95 border-blue-400 text-white';
                      if (hasConflict) {
                        blockBg = 'bg-red-600 border-red-200 text-white animate-pulse shadow-red-950';
                      } else if (isDelayed) {
                        blockBg = 'bg-amber-600 border-amber-300 text-slate-950 font-bold';
                      }

                      return (
                        <div
                          key={train.train_id}
                          onClick={() => setSelectedTrain(train)}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded px-2 flex flex-col justify-center cursor-pointer border shadow transition-all hover:scale-[1.03] hover:z-20 z-10 select-none ${blockBg}`}
                        >
                          <div className="flex items-center justify-between text-[11px] leading-tight font-mono">
                            <span className="font-bold truncate">{train.train_id}</span>
                            {hasConflict && (
                              <AlertTriangle className="w-3.5 h-3.5 text-white ml-1 shrink-0" />
                            )}
                          </div>
                          <div className="text-[9px] opacity-90 truncate font-mono">
                            {train.arrival_time}-{train.departure_time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Train Detail Inspection Modal */}
      <TrainDetailDrawer
        train={selectedTrain}
        conflicts={conflicts}
        onClose={() => setSelectedTrain(null)}
      />
    </div>
  );
};
