import React from 'react';

export type StatusVariant =
  | 'demo'
  | 'on_time'
  | 'delayed'
  | 'conflict'
  | 'valid'
  | 'invalid'
  | 'pending'
  | 'neutral'
  | 'candidate'
  | 'closed';

interface StatusBadgeProps {
  label: string;
  variant: StatusVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant,
  size = 'md',
  icon,
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  switch (variant) {
    case 'demo':
      colorClasses = 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80 font-bold';
      break;
    case 'on_time':
      colorClasses = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80';
      break;
    case 'delayed':
      colorClasses = 'bg-amber-950/70 text-amber-300 border-amber-800/80';
      break;
    case 'conflict':
      colorClasses = 'bg-red-950/80 text-red-300 border-red-700/80 font-bold';
      break;
    case 'valid':
      colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-600 font-bold';
      break;
    case 'invalid':
      colorClasses = 'bg-red-950/80 text-red-300 border-red-600 font-bold';
      break;
    case 'pending':
      colorClasses = 'bg-amber-950/70 text-amber-300 border-amber-700/80';
      break;
    case 'candidate':
      colorClasses = 'bg-cyan-950/70 text-cyan-200 border-cyan-600/70';
      break;
    case 'closed':
      colorClasses = 'bg-red-950/90 text-red-200 border-red-800 font-semibold';
      break;
    case 'neutral':
    default:
      colorClasses = 'bg-slate-800/80 text-slate-300 border-slate-700';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono rounded border ${sizeClasses} ${colorClasses} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </span>
  );
};
