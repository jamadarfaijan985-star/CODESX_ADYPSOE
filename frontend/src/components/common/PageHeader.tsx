import React from 'react';
import { StatusBadge } from './StatusBadge';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  stationCode?: string;
  isDemo?: boolean;
  dataLabel?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  stationCode,
  isDemo = true,
  dataLabel = 'SIMULATED TIMETABLE',
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
          {stationCode && (
            <span className="text-xs font-mono font-normal text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              Station: {stationCode}
            </span>
          )}
          {isDemo && (
            <StatusBadge label={dataLabel} variant="demo" size="sm" />
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-2.5 self-start sm:self-auto">{actions}</div>}
    </div>
  );
};
