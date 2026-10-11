import React from 'react';
import {
  LayoutDashboard,
  Clock,
  Layers,
  AlertOctagon,
  Flame,
  TrendingUp,
  Bot,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useRailway } from '../context/RailwayContext';

export type NavigationTab =
  | 'overview'
  | 'timetable'
  | 'platforms'
  | 'conflicts'
  | 'disruptions'
  | 'forecast'
  | 'assistant'
  | 'history'
  | 'settings';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { conflicts, validation, candidateReplan } = useRailway();

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'timetable',
      label: 'Live Timetable',
      icon: Clock,
    },
    {
      id: 'platforms',
      label: 'Platform Operations',
      icon: Layers,
    },
    {
      id: 'conflicts',
      label: 'Conflicts & Validation',
      icon: conflicts.length > 0 ? AlertOctagon : ShieldCheck,
      badge: conflicts.length > 0 ? conflicts.length : undefined,
      badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
    },
    {
      id: 'disruptions',
      label: 'Disruption Mgmt',
      icon: Flame,
    },
    {
      id: 'forecast',
      label: 'Delay Forecast (Exp)',
      icon: TrendingUp,
    },
    {
      id: 'assistant',
      label: 'Operations Assistant',
      icon: Bot,
    },
    {
      id: 'history',
      label: 'Schedule History',
      icon: History,
      badge: candidateReplan ? 'Review' : undefined,
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    },
    {
      id: 'settings',
      label: 'Diagnostics & Profiles',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={`bg-[#080E19] border-r border-slate-800/80 transition-all duration-200 flex flex-col justify-between shrink-0 select-none z-20 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Navigation List */}
      <div className="py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-[#111D2D] text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />

              {!isCollapsed && (
                <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
              )}

              {!isCollapsed && item.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                    item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Status & Collapse Toggle */}
      <div className="p-2 border-t border-slate-800/80 space-y-2">
        {!isCollapsed && (
          <div className="p-2.5 rounded bg-[#111D2D]/60 border border-slate-800 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>Validation:</span>
              <span
                className={`font-mono font-semibold ${
                  validation?.validation_state === 'VALID'
                    ? 'text-emerald-400'
                    : validation?.validation_state === 'INVALID'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {validation?.validation_state || 'UNRESOLVED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Conflicts:</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {conflicts.length} confirmed
              </span>
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent hover:border-slate-800 text-xs transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px]">Collapse sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
