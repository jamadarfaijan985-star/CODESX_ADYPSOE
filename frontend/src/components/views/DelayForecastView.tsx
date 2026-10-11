import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cpu, Database, Info, TrendingUp } from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { api } from '../../services/api';
import { DelayForecastResult } from '../../types/railway';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';

export const DelayForecastView: React.FC = () => {
  const { selectedStation } = useRailway();
  const [serviceDate, setServiceDate] = useState('2026-08-15');
  const [sequence, setSequence] = useState('10');
  const [stationCode, setStationCode] = useState(selectedStation);
  const [result, setResult] = useState<DelayForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setStationCode(selectedStation);
  }, [selectedStation]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    setError(null);
    const seq = Number(sequence);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      setError('Enter a valid service date.');
      return;
    }
    if (!Number.isInteger(seq) || seq < 0) {
      setError('Sequence number must be a non-negative integer.');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(stationCode.trim())) {
      setError('Station code must contain uppercase letters and numbers only.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.predictArrivalDelay({
        service_date: serviceDate,
        seq,
        station_code: stationCode.trim(),
      });
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Prediction request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Experimental Arrival Delay Forecast"
        subtitle="A historical estimate from the backend model; it never changes the active timetable."
        stationCode={selectedStation}
        isDemo={true}
        dataLabel="EXPERIMENTAL ML"
      />

      <div className="bg-[#111D2D] border border-amber-900/60 rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Experimental model scope</h2>
          <StatusBadge label="EXPERIMENTAL" variant="demo" size="sm" />
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The backend model was trained only on historical data for train 12624. It is not validated
          across all trains or stations and is not a confirmed live delay or operational guarantee.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300">
          <div className="rounded bg-[#080E19] border border-slate-800 p-3">
            <div className="font-semibold text-cyan-300">Model</div>
            <div className="font-mono text-white mt-1">HistGradientBoosting · experiment v1</div>
            <div className="text-slate-500 mt-1">Features: seq, station_code, day_of_week, month</div>
          </div>
          <div className="rounded bg-[#080E19] border border-slate-800 p-3">
            <div className="font-semibold text-cyan-300">Historical evaluation</div>
            <div className="font-mono text-white mt-1">MAE 8.40 · RMSE 13.80 · R² 0.14</div>
            <div className="text-slate-500 mt-1">Final holdout: 2025-09-10 to 2026-08-31</div>
          </div>
          <div className="rounded bg-[#080E19] border border-slate-800 p-3">
            <div className="font-semibold text-cyan-300">System boundary</div>
            <div className="text-white mt-1">Predicts arrival delay only.</div>
            <div className="text-slate-500 mt-1">It does not assign platforms or replan schedules.</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Run forecast request</h2>
          </div>
          <label className="block text-xs text-slate-300">
            Service date
            <input type="date" value={serviceDate} onChange={(event) => { setServiceDate(event.target.value); setResult(null); }} required className="mt-1 w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 font-mono" />
          </label>
          <label className="block text-xs text-slate-300">
            Sequence number
            <input type="number" min="0" value={sequence} onChange={(event) => { setSequence(event.target.value); setResult(null); }} required className="mt-1 w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 font-mono" />
          </label>
          <label className="block text-xs text-slate-300">
            Station code
            <input type="text" value={stationCode} onChange={(event) => { setStationCode(event.target.value.toUpperCase()); setResult(null); }} required className="mt-1 w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 font-mono uppercase" />
          </label>
          {error && <div className="p-3 rounded bg-red-950/50 border border-red-800 text-red-200 text-xs">{error}</div>}
          <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer">
            <Cpu className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
            {isLoading ? 'Requesting backend model…' : 'Get experimental estimate'}
          </button>
        </form>

        <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 min-h-64">
          {!result ? (
            <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs">
              <div><Info className="w-8 h-8 text-cyan-400 mx-auto mb-2" /><p>Submit the form to request a live backend response.</p></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Backend estimate</h2>
                <StatusBadge label="EXPERIMENTAL" variant="demo" size="sm" />
              </div>
              <div className="p-4 rounded bg-cyan-950/30 border border-cyan-700/60 text-center">
                <div className="text-4xl font-mono font-bold text-cyan-300">{result.predicted_delay_minutes.toFixed(1)} min</div>
                <div className="text-xs text-slate-400 mt-1">Predicted arrival delay</div>
              </div>
              <div className="text-xs text-slate-300 space-y-1">
                <p><span className="text-slate-500">Model:</span> <span className="font-mono text-white">{result.model_id}</span></p>
                <p><span className="text-slate-500">Status:</span> {result.status}</p>
              </div>
              <div className="p-3 rounded bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{result.disclaimer}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
