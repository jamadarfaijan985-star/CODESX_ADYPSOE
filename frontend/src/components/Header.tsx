import React, { useState } from 'react';
import {
  Train,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Radio,
  Sun,
  Moon,
  ShieldCheck,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext.jsx';
import { useRailway } from '../context/RailwayContext';
import { StatusBadge } from './common/StatusBadge';

interface HeaderProps {
  onOpenResetConfirm: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenResetConfirm }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const {
    selectedStation,
    stations,
    currentStationProfile,
    changeStation,
    health,
    lastRefreshTime,
    refreshData,
    isLoading,
    candidateReplan,
    validation,
    conflicts,
    theme,
    toggleTheme,
  } = useRailway();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Just now';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Schedule status badge logic
  const renderScheduleStatus = () => {
    if (candidateReplan) {
      return (
        <StatusBadge
          label={`CANDIDATE UNDER REVIEW (${candidateReplan.replan_id.slice(-6)})`}
          variant="candidate"
          icon={<Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
        />
      );
    }
    if (conflicts.length > 0) {
      return (
        <StatusBadge
          label={`CONFLICT DETECTED (${conflicts.length})`}
          variant="conflict"
          icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
        />
      );
    }
    if (validation?.validation_state === 'VALID') {
      return (
        <StatusBadge
          label="SCHEDULE VALIDATED"
          variant="valid"
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        />
      );
    }
    if (validation?.validation_state === 'INVALID') {
      return (
        <StatusBadge
          label="VALIDATION FAILED"
          variant="invalid"
          icon={<ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
        />
      );
    }
    return (
      <StatusBadge
        label="PENDING VALIDATION"
        variant="pending"
        icon={<Radio className="w-3.5 h-3.5 text-amber-400" />}
      />
    );
  };

  return (
    <header className="h-16 bg-[#080E19] border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-30">
      {/* Brand & Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-md bg-gradient-to-br from-cyan-500/25 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/40">
          <Train className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              RailFlow
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.5 rounded">
              Control Center
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Railway Timetable &amp; Disruption Management
          </span>
        </div>
      </div>

      {/* Middle Controls: Station Selector, data-source badge & schedule status */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <StatusBadge
          label={currentStationProfile?.illustrative ? 'ILLUSTRATIVE PROFILE' : 'FICTIONAL PROFILE'}
          variant="demo"
          size="sm"
          className="hidden sm:inline-flex"
        />

        {/* Station Selector */}
        <div className="flex items-center gap-2 bg-[#111D2D] border border-slate-700/80 rounded px-2.5 py-1 text-xs">
          <span className="text-slate-400 font-medium">Station:</span>
          <select
            value={selectedStation}
            onChange={(e) => changeStation(e.target.value)}
            disabled={isLoading}
            className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer text-xs"
          >
            {stations.map((st) => (
              <option key={st.station_code} value={st.station_code} className="bg-[#111D2D] text-white">
                {st.station_code} — {st.station_name}
              </option>
            ))}
          </select>
        </div>

        {/* Schedule Operational Status */}
        <div className="hidden lg:block">
          {renderScheduleStatus()}
        </div>
      </div>

      {/* Right Controls: Real Health, Theme Toggle, Refresh, Reset */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Backend Connection Indicator (Truthful, non-decorative) */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border ${
            health.isOnline
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : 'bg-slate-800/60 border-slate-700 text-slate-400'
          }`}
          title={
            health.isOnline
              ? `Backend Connected (Latency: ${health.latencyMs}ms, v${health.version})`
              : 'Offline client fallback; authoritative backend data is unavailable'
          }
        >
          {health.isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-mono">Backend Live</span>
              {health.latencyMs !== undefined && (
                <span className="text-[10px] text-emerald-400/80 font-mono hidden md:inline">
                  {health.latencyMs}ms
                </span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-[11px]">Offline</span>
            </>
          )}
        </div>

        {/* Refresh timestamp */}
        <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
          {formatTime(lastRefreshTime)}
        </span>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title={theme === 'dark' ? 'Switch to Daylight Workspace' : 'Switch to Dark Control Center'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-cyan-300" />
          )}
        </button>

        {/* Refresh Button */}
        <button
          onClick={handleManualRefresh}
          disabled={isLoading || isRefreshing}
          className="p-1.5 rounded bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Refresh operational data"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin text-cyan-400' : ''}`}
          />
        </button>

        {/* Reset Baseline Button */}
        <button
          onClick={onOpenResetConfirm}
          className="p-1.5 rounded bg-slate-800/60 hover:bg-amber-950/40 border border-slate-700 hover:border-amber-700/50 text-slate-300 hover:text-amber-300 transition-colors"
          title="Reset timetable and platform closures to baseline"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Session Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800/60 hover:bg-red-950/40 border border-slate-700 hover:border-red-700/50 text-slate-300 hover:text-red-300 transition-colors text-xs font-medium"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
