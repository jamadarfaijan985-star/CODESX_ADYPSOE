import React from 'react';
import { Layers } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`p-10 rounded-lg border border-dashed border-slate-800 bg-[#080E19]/60 flex flex-col items-center justify-center text-center space-y-3 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
        {icon || <Layers className="w-5 h-5" />}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-200">{title}</h3>
        {description && <p className="text-[11px] text-slate-500 mt-1 max-w-sm">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};
