import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'default' | 'alert' | 'success' | 'warning' | 'info';
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  icon,
  badge,
  variant = 'default',
  onClick,
  className = '',
}) => {
  let borderBgClasses = 'bg-[#111D2D] border-slate-800 text-white';
  let valueColor = 'text-white';

  if (variant === 'alert') {
    borderBgClasses = 'bg-red-950/20 border-red-800/60';
    valueColor = 'text-red-400';
  } else if (variant === 'success') {
    borderBgClasses = 'bg-emerald-950/20 border-emerald-800/60';
    valueColor = 'text-emerald-400';
  } else if (variant === 'warning') {
    borderBgClasses = 'bg-amber-950/20 border-amber-800/60';
    valueColor = 'text-amber-400';
  } else if (variant === 'info') {
    borderBgClasses = 'bg-cyan-950/20 border-cyan-800/60';
    valueColor = 'text-cyan-300';
  }

  const cursorClass = onClick ? 'cursor-pointer hover:border-slate-700 transition-colors' : '';

  return (
    <div
      onClick={onClick}
      className={`border rounded-lg p-4 flex flex-col justify-between ${borderBgClasses} ${cursorClass} ${className}`}
    >
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-medium tracking-tight">{label}</span>
        {icon && <span className="text-cyan-400">{icon}</span>}
      </div>

      <div className="mt-3">
        <div className={`text-2xl font-bold font-mono tabular-nums ${valueColor}`}>
          {value}
        </div>
        {(subtext || badge) && (
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            {subtext && <span className="truncate">{subtext}</span>}
            {badge && <span className="shrink-0">{badge}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
