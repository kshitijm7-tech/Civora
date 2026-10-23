import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface RescueClockProps {
  safeUseDeadline: string;
  simulatedNow: string;
  estimatedTravelMinutes: number;
  safetyMarginMinutes?: number;
  compact?: boolean;
}

export const RescueClock: React.FC<RescueClockProps> = ({
  safeUseDeadline,
  simulatedNow,
  estimatedTravelMinutes,
  safetyMarginMinutes = 10,
  compact = false,
}) => {
  const nowMs = new Date(simulatedNow).getTime();
  const deadlineMs = new Date(safeUseDeadline).getTime();
  const minutesRemaining = Math.round((deadlineMs - nowMs) / (60 * 1000));
  const totalRequiredTime = estimatedTravelMinutes + safetyMarginMinutes;
  const safetyBuffer = minutesRemaining - totalRequiredTime;

  let state: 'SAFE' | 'CAUTION' | 'CRITICAL' | 'EXPIRED' = 'SAFE';
  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let barColor = 'bg-emerald-500';

  if (minutesRemaining <= 0) {
    state = 'EXPIRED';
    badgeColor = 'bg-red-50 text-red-900 border-red-300';
    barColor = 'bg-red-600';
  } else if (safetyBuffer < 0) {
    state = 'CRITICAL';
    badgeColor = 'bg-red-50 text-red-800 border-red-200';
    barColor = 'bg-red-500';
  } else if (safetyBuffer < 15) {
    state = 'CAUTION';
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    barColor = 'bg-amber-500';
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-medium border ${badgeColor}`}>
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{minutesRemaining > 0 ? `${minutesRemaining}m left` : 'EXPIRED'}</span>
        <span className="text-[10px] opacity-75">({safetyBuffer >= 0 ? `+${safetyBuffer}m buf` : `${safetyBuffer}m`})</span>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-lg border ${badgeColor} transition-all`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {state === 'SAFE' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {state === 'CAUTION' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
          {(state === 'CRITICAL' || state === 'EXPIRED') && <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />}
          <span className="text-xs font-semibold uppercase tracking-wider">
            Rescue Clock: {state}
          </span>
        </div>
        <div className="font-mono text-sm font-bold">
          {minutesRemaining > 0 ? `${minutesRemaining} mins to deadline` : 'EXPIRED'}
        </div>
      </div>

      {/* Progress / time breakdown */}
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Est. Travel: <strong className="font-mono text-slate-900">{estimatedTravelMinutes}m</strong></span>
          <span>Safety Margin: <strong className="font-mono text-slate-900">+{safetyMarginMinutes}m</strong></span>
          <span>Safety Buffer: <strong className={`font-mono font-semibold ${safetyBuffer < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{safetyBuffer}m</strong></span>
        </div>

        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.max(5, Math.min(100, (minutesRemaining / 75) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
