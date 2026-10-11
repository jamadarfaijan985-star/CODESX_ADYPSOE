import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
  XCircle,
  FileCode2,
  Database,
  Cpu,
  HelpCircle,
} from 'lucide-react';
import { useRailway } from '../../context/RailwayContext';
import { PageHeader } from '../common/PageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { MODEL_AUDIT_METADATA } from '../../server/forecast';

interface DemoForecastFixture {
  train_id: string;
  station_code: string;
  predicted_delay_minutes: number;
  ci_lower: number;
  ci_upper: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  dwell_impact: string;
}

const DEMO_FORECAST_FIXTURES: Record<string, DemoForecastFixture> = {
  '12624_ST01': {
    train_id: '12624',
    station_code: 'ST01',
    predicted_delay_minutes: 14.5,
    ci_lower: 10.2,
    ci_upper: 18.8,
    risk_level: 'MODERATE',
    dwell_impact: 'Estimated +4m turnaround dwell expansion at Central Junction.',
  },
};

import { api } from '../../services/api';
import { DelayForecastResult } from '../../types/railway';

export const DelayForecastView: React.FC = () => {
  const { selectedStation } = useRailway();

  const [forecastTrainId, setForecastTrainId] = useState('12624');
  const [forecastStationCode, setForecastStationCode] = useState(selectedStation);
  const [forecastSequence, setForecastSequence] = useState('14');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [hasEvaluated, setHasEvaluated] = useState(false);
  const [evaluatedResult, setEvaluatedResult] = useState<DelayForecastResult | null>(null);

  const handleRunForecast = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEvaluating(true);
    setHasEvaluated(true);

    try {
      const result = await api.predictArrivalDelay({
        train_id: forecastTrainId.trim(),
        station_code: forecastStationCode.trim(),
        seq: parseInt(forecastSequence, 10) || 14,
        service_date: serviceDate,
      });
      setEvaluatedResult(result);
    } catch {
      // Local fallback logic if offline
      const isTrainInScope = forecastTrainId.trim() === '12624';
      const isStationInScope = forecastStationCode.trim().toUpperCase() === 'ST01';

      if (isTrainInScope && isStationInScope) {
        setEvaluatedResult({
          supported: true,
          train_id: '12624',
          station_code: 'ST01',
          service_date: serviceDate,
          seq: parseInt(forecastSequence, 10) || 14,
          model_id: MODEL_AUDIT_METADATA.model_id,
          target_variable: MODEL_AUDIT_METADATA.target_variable,
          predicted_delay_minutes: 14.5,
          confidence_interval: [10.2, 18.8],
          risk_level: 'MODERATE',
          disclaimer: 'EXPERIMENTAL OPERATIONAL ADVISORY ONLY (Offline demo mode).',
          in_scope_explanation: 'Input verified within supported experimental scope.',
          model_metadata: MODEL_AUDIT_METADATA,
        });
      } else {
        const reasons: string[] = [];
        if (!isTrainInScope) {
          reasons.push(
            `Train ID "${forecastTrainId}" is outside the experimental training distribution. Weights are strictly calibrated to the historical speed profile of Train 12624.`
          );
        }
        if (!isStationInScope) {
          reasons.push(
            `Station code "${forecastStationCode}" is outside the verified training geography. Feature encoding tables only cover ST01 (Central Junction).`
          );
        }
        setEvaluatedResult({
          supported: false,
          train_id: forecastTrainId,
          station_code: forecastStationCode,
          model_id: MODEL_AUDIT_METADATA.model_id,
          target_variable: MODEL_AUDIT_METADATA.target_variable,
          in_scope_explanation: 'Input out of experimental model scope',
          error: 'Input out of experimental model scope',
          unsupported_reasons: reasons,
          disclaimer: 'Model predictions cannot be computed for out-of-scope inputs.',
          model_metadata: MODEL_AUDIT_METADATA,
        });
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Experimental Arrival Delay Forecast"
        subtitle="Historical gradient boosting experiment prototype with training distribution verification."
        stationCode={selectedStation}
        isDemo={true}
      />

      {/* Mandatory Model Scope Audit Disclosure */}
      <div className="bg-[#111D2D] border border-amber-900/60 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Model Scope Audit: {MODEL_AUDIT_METADATA.model_id}
            </h2>
          </div>
          <StatusBadge
            label="DEMO FORECAST — NOT A REAL PREDICTION"
            variant="demo"
            size="sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Training Distribution</span>
            <span className="text-sm font-mono font-bold text-cyan-400">
              Train {MODEL_AUDIT_METADATA.training_train_id}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Single corridor telemetry</span>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Verified Stations</span>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {MODEL_AUDIT_METADATA.training_stations.join(', ')} (Central Jct)
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Other stations out of scope</span>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Target Variable</span>
            <span className="text-sm font-mono font-bold text-white">
              arrival_delay (mins)
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">Continuous regression</span>
          </div>

          <div className="p-3 rounded bg-[#080E19] border border-slate-800">
            <span className="text-slate-400 text-[11px] block font-mono">Algorithm Family</span>
            <span className="text-sm font-mono font-bold text-slate-200">
              HistGradientBoosting
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">MAE: 4.2 mins on test split</span>
          </div>
        </div>

        {/* Feature schema and limitations */}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <div className="text-slate-300 font-semibold flex items-center gap-1.5">
            <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exact Training Features ({MODEL_AUDIT_METADATA.feature_count})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MODEL_AUDIT_METADATA.features.map((f, i) => (
              <span
                key={i}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#080E19] text-slate-300 border border-slate-800"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="mt-3 p-3 rounded bg-amber-950/20 border border-amber-900/50 text-[11px] text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Operational Disclaimer &amp; Limitations</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Model applicability and operational accuracy have NOT been established across all
              services or network junctions. Outputs are illustrative demonstration figures only and
              must never be used for real train movement authorization.
            </p>
          </div>
        </div>
      </div>

      {/* Forecast Testing Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form on the left */}
        <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Run Demonstration Forecast Probe
            </h2>
          </div>

          <form onSubmit={handleRunForecast} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 block mb-1 font-medium">Train ID</label>
              <input
                type="text"
                value={forecastTrainId}
                onChange={(e) => setForecastTrainId(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="e.g. 12624 (In-Scope) or T101"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Historical training data covers service <strong>12624</strong> only. Other train IDs will be rejected.
              </span>
            </div>

            <div>
              <label className="text-slate-300 block mb-1 font-medium">Station Code</label>
              <input
                type="text"
                value={forecastStationCode}
                onChange={(e) => setForecastStationCode(e.target.value)}
                className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="e.g. ST01 (In-Scope)"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Only station <strong>ST01</strong> (Central Junction) has verified encoding parameters.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Service Date</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Sequence Number</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={forecastSequence}
                  onChange={(e) => setForecastSequence(e.target.value)}
                  className="w-full bg-[#080E19] border border-slate-700 text-slate-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isEvaluating}
              className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Cpu className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
              <span>{isEvaluating ? 'Evaluating Model Scope...' : 'Evaluate Demonstration Forecast'}</span>
            </button>
          </form>
        </div>

        {/* Results on the right */}
        <div className="bg-[#111D2D] border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Demonstration Output Panel
            </h2>
          </div>

          {!hasEvaluated || !evaluatedResult ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Info className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
              <p>Configure parameters on the left and click Evaluate.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Tip: Use Train 12624 at ST01 for an in-distribution demonstration.
              </p>
            </div>
          ) : evaluatedResult.supported ? (
            /* In-Scope Supported Result */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-600/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>IN-DISTRIBUTION VERIFIED EVALUATION</span>
                  </span>
                  <StatusBadge
                    label={`RISK: ${evaluatedResult.risk_level || 'MODERATE'}`}
                    variant="pending"
                    size="sm"
                  />
                </div>

                <div className="pt-2">
                  <div className="text-3xl font-bold font-mono text-white tabular-nums">
                    +{evaluatedResult.predicted_delay_minutes ?? 14.5} min
                  </div>
                  <div className="text-xs text-slate-300 mt-1 font-mono">
                    Expected Arrival Delay Range (90% Interval: [
                    {evaluatedResult.confidence_interval?.[0] ?? 10.2}m,{' '}
                    {evaluatedResult.confidence_interval?.[1] ?? 18.8}m])
                  </div>
                </div>
              </div>

              <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-xs space-y-2 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Model Identifier:</span>
                  <span className="text-cyan-300">{evaluatedResult.model_id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Target Variable:</span>
                  <span className="text-slate-200">{evaluatedResult.target_variable}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Evaluated Train:</span>
                  <span className="text-white font-bold">{evaluatedResult.train_id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Station:</span>
                  <span className="text-white font-bold">{evaluatedResult.station_code}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sequence Index:</span>
                  <span className="text-white font-bold">#{evaluatedResult.seq ?? forecastSequence}</span>
                </div>
              </div>

              <div className="p-3 rounded bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-200">
                <span className="font-bold block mb-1">MANDATORY DEMO NOTICE:</span>
                {evaluatedResult.disclaimer || 'DEMO FORECAST — NOT A REAL PREDICTION.'}
              </div>
            </div>
          ) : (
            /* Explicit Out-of-Scope Rejection */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-600/70 space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs font-mono">
                  <ShieldAlert className="w-4 h-4" />
                  <span>PREDICTION REJECTED: OUT-OF-DISTRIBUTION SCOPE</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  The model artifact was trained specifically for Train 12624 at station ST01. Silent
                  substitution of surrogate trains or fabricated numbers is strictly prohibited by
                  system safety rules.
                </p>
              </div>

              {evaluatedResult.unsupported_reasons && (
                <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-xs space-y-2">
                  <span className="font-bold text-white block">Diagnostic Scope Failures:</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    {evaluatedResult.unsupported_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 rounded bg-[#080E19] border border-slate-800 text-[11px] text-slate-400 font-mono">
                System Rule: Transparent rejection preserves operational integrity over fabricated metrics.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
