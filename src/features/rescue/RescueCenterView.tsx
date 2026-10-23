import React, { useState } from 'react';
import type { Assignment } from '../../../shared/types.js';
import { RescueClock } from '../../components/RescueClock.js';
import { api } from '../../lib/api.js';
import { 
  ShieldAlert, RefreshCw, AlertTriangle, CheckCircle, 
  ArrowRight, Eye, ShieldCheck, MapPin, Building
} from 'lucide-react';

interface RescueCenterViewProps {
  assignments: Assignment[];
  simulatedNow: string;
  onRefresh: () => void;
  onOpenShipment: (id: string) => void;
}

export const RescueCenterView: React.FC<RescueCenterViewProps> = ({
  assignments,
  simulatedNow,
  onRefresh,
  onOpenShipment,
}) => {
  const [actingId, setActingId] = useState<string | null>(null);

  const atRiskShipments = assignments.filter(a => {
    if (a.status === 'DELIVERED' || a.status === 'EXPIRED' || a.status === 'CANCELLED') return false;
    if (a.status === 'INTERVENTION_REQUIRED') return true;
    const nowMs = new Date(simulatedNow).getTime();
    const deadlineMs = new Date(a.safeUseDeadline).getTime();
    const minsRemaining = (deadlineMs - nowMs) / (60 * 1000);
    return minsRemaining < 30 || a.status === 'IN_TRANSIT';
  });

  const handleAutoRescue = async (assignmentId: string) => {
    try {
      setActingId(assignmentId);
      await api.executeRescue(assignmentId);
      onRefresh();
    } catch (err: any) {
      alert(`Rescue failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-teal-500 text-slate-950">
              AidFlow Rescue Protocol
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Deterministic Rerouting & Cargo Accounting Engine
            </span>
          </div>
          <h2 className="text-lg font-bold">
            Live Contingency Monitoring & Human Intervention Center
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Every shipment maintains precomputed fallback candidates before departure. If destination demand drops or a shelter closes mid-transit, AidFlow verifies capacity, item compatibility, and remaining safe shelf-life before rerouting.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Revalidate All Corridors
        </button>
      </div>

      {/* At Risk List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Priority Shipments in Rescue Zone ({atRiskShipments.length})
          </h3>
          <span className="text-[11px] text-slate-500">
            Sorted by urgency and risk severity
          </span>
        </div>

        {atRiskShipments.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">All Active Shipments are Feasible</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No shipments currently require emergency rerouting or manual intervention. To simulate a disruption, use the Simulation Lab or close a receiving shelter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {atRiskShipments.map(item => {
              const isIntervention = item.status === 'INTERVENTION_REQUIRED';
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg border p-5 shadow-xs space-y-4 ${
                    isIntervention ? 'border-red-400 bg-red-50/30 ring-1 ring-red-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {item.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isIntervention ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {item.quantity} {item.unit} • {item.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Carried by <strong>{item.riderName}</strong> &rarr; Destination: <strong>{item.shelterName}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenShipment(item.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Workspace
                      </button>

                      <button
                        disabled={actingId === item.id}
                        onClick={() => handleAutoRescue(item.id)}
                        className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                      >
                        {actingId === item.id ? 'Revalidating...' : 'Auto Reroute'}
                      </button>
                    </div>
                  </div>

                  {/* Rescue Clock */}
                  <RescueClock
                    safeUseDeadline={item.safeUseDeadline}
                    simulatedNow={simulatedNow}
                    estimatedTravelMinutes={item.estimatedTravelMinutes}
                    safetyMarginMinutes={item.safetyMarginMinutes}
                  />

                  {/* Intervention Reason if flagged */}
                  {isIntervention && item.interventionReason && (
                    <div className="p-3 bg-red-100/70 border border-red-300 rounded text-xs text-red-900">
                      <strong>Intervention Alert:</strong> {item.interventionReason}
                    </div>
                  )}

                  {/* Precomputed Fallback Candidates */}
                  {item.precomputedFallbacks?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Precomputed Fallback Candidates ({item.precomputedFallbacks.filter(f => f.feasible).length} feasible):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {item.precomputedFallbacks.map(f => (
                          <div
                            key={f.shelterId}
                            className={`p-2 rounded border text-xs ${
                              f.feasible
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            <div className="font-semibold truncate">{f.shelterName}</div>
                            <div className="text-[11px] font-mono mt-0.5 flex justify-between">
                              <span>ETA: {f.estimatedMinutes}m</span>
                              <span>{f.feasible ? 'Feasible' : 'Blocked'}</span>
                            </div>
                            {f.rejectionReason && (
                              <div className="text-[10px] text-red-600 mt-1 truncate" title={f.rejectionReason}>
                                {f.rejectionReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
