import React, { useState, useEffect } from 'react';
import type { Assignment, RescueEvaluationResult } from '../../shared/types.js';
import { api } from '../lib/api.js';
import { RescueClock } from './RescueClock.js';
import { 
  X, Check, Truck, Package, ShieldAlert, ArrowRight, 
  MapPin, User, Building, AlertCircle, RefreshCw, Clock
} from 'lucide-react';

interface ShipmentDecisionModalProps {
  assignmentId: string;
  simulatedNow: string;
  onClose: () => void;
  onActionComplete: () => void;
}

export const ShipmentDecisionModal: React.FC<ShipmentDecisionModalProps> = ({
  assignmentId,
  simulatedNow,
  onClose,
  onActionComplete,
}) => {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [evaluation, setEvaluation] = useState<RescueEvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [a, evalRes] = await Promise.all([
        api.getAssignment(assignmentId),
        api.evaluateRescue(assignmentId).catch(() => null),
      ]);
      setAssignment(a);
      setEvaluation(evalRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const handleAction = async (actionFn: () => Promise<any>) => {
    try {
      setActing(true);
      setError(null);
      await actionFn();
      await loadData();
      onActionComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading && !assignment) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Loading shipment decision workspace...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

  const isIntervention = assignment.status === 'INTERVENTION_REQUIRED';
  const isDelivered = assignment.status === 'DELIVERED';
  const isExpired = assignment.status === 'EXPIRED';

  const custodyBadge = {
    AT_DONOR: { label: 'At Donor (Not Picked Up)', bg: 'bg-slate-100 text-slate-800 border-slate-200' },
    RIDER_CUSTODY: { label: 'In Rider Custody (Physical Handover Verified)', bg: 'bg-amber-100 text-amber-900 border-amber-300' },
    DELIVERED_TO_SHELTER: { label: 'Delivered & Accepted at Shelter', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    INTERVENTION_HELD: { label: 'Intervention Held (Rider Holding Cargo)', bg: 'bg-red-100 text-red-900 border-red-300' },
  }[assignment.custody] || { label: assignment.custody, bg: 'bg-slate-100 text-slate-800' };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                {assignment.id}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                isIntervention ? 'bg-red-600 text-white' :
                isDelivered ? 'bg-emerald-600 text-white' :
                isExpired ? 'bg-slate-600 text-white' :
                assignment.status === 'IN_TRANSIT' ? 'bg-amber-500 text-white' :
                'bg-sky-600 text-white'
              }`}>
                {assignment.status.replace('_', ' ')}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${custodyBadge.bg}`}>
                {custodyBadge.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {assignment.quantity} {assignment.unit} • {assignment.category.replace('_', ' ')}
            </h2>
            <p className="text-xs text-slate-600">
              Batch: {assignment.batchName} ({assignment.batchId})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Rescue Clock & Feasibility Card */}
          <RescueClock
            safeUseDeadline={assignment.safeUseDeadline}
            simulatedNow={simulatedNow}
            estimatedTravelMinutes={assignment.estimatedTravelMinutes}
            safetyMarginMinutes={assignment.safetyMarginMinutes}
          />

          {/* Route & Custody Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <User className="w-3.5 h-3.5" />
                <span>Assigned Rider:</span>
              </div>
              <div className="font-semibold text-slate-900 text-sm">
                {assignment.riderName} ({assignment.riderId})
              </div>
              <div className="text-[11px] text-slate-500">
                Lease expires: <span className="font-mono">{new Date(assignment.leaseDeadline).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Building className="w-3.5 h-3.5" />
                <span>Current Destination Shelter:</span>
              </div>
              <div className="font-semibold text-slate-900 text-sm">
                {assignment.shelterName} ({assignment.shelterId})
              </div>
              <div className="text-[11px] text-slate-500">
                Est. Travel: <span className="font-mono">{assignment.estimatedTravelMinutes} mins</span>
              </div>
            </div>
          </div>

          {/* Critical Intervention Banner if needed */}
          {isIntervention && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>Critical Human Intervention Required</span>
              </div>
              <p className="text-xs text-red-700 leading-relaxed">
                {assignment.interventionReason || 'Destination became unavailable and automated recovery could not find a safe alternative that meets capacity, resources, and deadline requirements.'}
              </p>
              <div className="text-[11px] text-red-900 font-medium">
                Cargo is currently held in safe custody by Rider <strong>{assignment.riderName}</strong>. Do not falsely mark delivered.
              </div>
            </div>
          )}

          {/* Primary Operations Actions */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Operator & Volunteer Actions
            </div>
            
            <div className="flex flex-wrap gap-2">
              {assignment.status === 'RESERVED' && (
                <button
                  disabled={acting}
                  onClick={() => handleAction(() => api.acknowledgeAssignment(assignment.id))}
                  className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Rider Acknowledge Reservation
                </button>
              )}

              {(assignment.status === 'RESERVED' || assignment.status === 'ACKNOWLEDGED') && (
                <button
                  disabled={acting}
                  onClick={() => handleAction(() => api.pickupAssignment(assignment.id))}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Package className="w-4 h-4" />
                  Confirm Cargo Pickup (Handover to Rider)
                </button>
              )}

              {assignment.status === 'PICKED_UP' && (
                <button
                  disabled={acting}
                  onClick={() => handleAction(() => api.transitAssignment(assignment.id))}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Truck className="w-4 h-4" />
                  Depart / Mark In Transit
                </button>
              )}

              {(assignment.status === 'IN_TRANSIT' || assignment.status === 'PICKED_UP') && (
                <button
                  disabled={acting}
                  onClick={() => handleAction(() => api.deliverAssignment(assignment.id))}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Complete & Verify Delivery
                </button>
              )}

              {/* Reroute / rescue trigger if not delivered */}
              {!isDelivered && !isExpired && (
                <button
                  disabled={acting}
                  onClick={() => handleAction(() => api.executeRescue(assignment.id))}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Rescue Protocol (Auto Reroute)
                </button>
              )}
            </div>
          </div>

          {/* Civora Rescue Protocol: Live Fallback Candidates */}
          {!isDelivered && !isExpired && evaluation && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Civora Rescue Protocol: Live Fallback Candidates
                </span>
                <span className="text-[11px] text-slate-500">
                  {evaluation.canAutoRecover ? 'Safe candidate available' : 'No safe fallback'}
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Candidate Shelter</th>
                      <th className="p-2.5">Est. ETA</th>
                      <th className="p-2.5">Demand</th>
                      <th className="p-2.5">Feasibility Status</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evaluation.candidates.map(c => (
                      <tr key={c.shelterId} className={c.feasible ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 text-slate-400'}>
                        <td className="p-2.5 font-medium text-slate-900">
                          {c.shelterName}
                        </td>
                        <td className="p-2.5 font-mono">
                          {c.estimatedMinutes}m
                        </td>
                        <td className="p-2.5 font-mono">
                          {c.remainingDemand} units
                        </td>
                        <td className="p-2.5">
                          {c.feasible ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Feasible (Score: {c.score})
                            </span>
                          ) : (
                            <span className="text-red-700 text-[11px]" title={c.rejectionReason}>
                              {c.rejectionReason || 'Ineligible'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            disabled={!c.feasible || acting}
                            onClick={() => handleAction(() => api.executeRescue(assignment.id, c.shelterId))}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-30 disabled:hover:bg-teal-600 text-white rounded text-[11px] font-semibold transition-colors"
                          >
                            Reroute
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Close Decision Workspace
          </button>
        </div>

      </div>
    </div>
  );
};
