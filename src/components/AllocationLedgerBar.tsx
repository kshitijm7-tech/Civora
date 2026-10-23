import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface AllocationLedgerBarProps {
  total: number;
  unassigned: number;
  reserved: number;
  inTransit: number;
  delivered: number;
  intervention: number;
  unit?: string;
  showTitle?: boolean;
}

export const AllocationLedgerBar: React.FC<AllocationLedgerBarProps> = ({
  total,
  unassigned,
  reserved,
  inTransit,
  delivered,
  intervention,
  unit = 'meals',
  showTitle = true,
}) => {
  const sum = unassigned + reserved + inTransit + delivered + intervention;
  const isReconciled = sum === total;

  const pct = (val: number) => (total > 0 ? (val / total) * 100 : 0);

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs">
      {showTitle && (
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 tracking-wider uppercase">
              Physical Cargo Accounting Ledger
            </span>
            {isReconciled ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                100% Reconciled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                <AlertCircle className="w-3 h-3 text-red-600" />
                Ledger Imbalance ({sum} vs {total})
              </span>
            )}
          </div>
          <span className="font-mono text-xs font-bold text-slate-800">
            Total Batch: {total} {unit}
          </span>
        </div>
      )}

      {/* Visual multi-colored bar */}
      <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 mb-3 border border-slate-200">
        <div
          title={`Unassigned: ${unassigned} ${unit}`}
          className="h-full bg-slate-300 transition-all duration-300"
          style={{ width: `${pct(unassigned)}%` }}
        />
        <div
          title={`Reserved: ${reserved} ${unit}`}
          className="h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${pct(reserved)}%` }}
        />
        <div
          title={`In Transit: ${inTransit} ${unit}`}
          className="h-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct(inTransit)}%` }}
        />
        <div
          title={`Delivered: ${delivered} ${unit}`}
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${pct(delivered)}%` }}
        />
        <div
          title={`Intervention Required: ${intervention} ${unit}`}
          className="h-full bg-red-600 transition-all duration-300"
          style={{ width: `${pct(intervention)}%` }}
        />
      </div>

      {/* Legend & quantities */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <span className="text-slate-600">Unassigned:</span>
          <span className="font-mono font-semibold text-slate-900">{unassigned}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
          <span className="text-slate-600">Reserved:</span>
          <span className="font-mono font-semibold text-sky-700">{reserved}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-slate-600">In Transit:</span>
          <span className="font-mono font-semibold text-amber-700">{inTransit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-600">Delivered:</span>
          <span className="font-mono font-semibold text-emerald-700">{delivered}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
          <span className="text-slate-600">Intervention:</span>
          <span className="font-mono font-semibold text-red-700">{intervention}</span>
        </div>
      </div>
    </div>
  );
};
