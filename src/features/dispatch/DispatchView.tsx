import React, { useState, useEffect } from 'react';
import type { AidBatch, DispatchPlanPreview } from '../../../shared/types.js';
import { api } from '../../lib/api.js';
import { 
  Zap, CheckCircle2, XCircle, ArrowRight, ShieldCheck, 
  RefreshCw, AlertTriangle, User, Building, Clock
} from 'lucide-react';

interface DispatchViewProps {
  batches: (AidBatch & { ledger: any })[];
  initialBatchId?: string;
  simulatedNow: string;
  onRefresh: () => void;
  onDispatchConfirmed: () => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  batches,
  initialBatchId,
  simulatedNow,
  onRefresh,
  onDispatchConfirmed,
}) => {
  const eligibleBatches = batches.filter(b => b.ledger?.unassignedQty > 0);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    initialBatchId || (eligibleBatches[0]?.id ?? batches[0]?.id ?? '')
  );
  const [preview, setPreview] = useState<DispatchPlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedBatch = batches.find(b => b.id === selectedBatchId);

  const loadPreview = async (batchId: string) => {
    if (!batchId) return;
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      const res = await api.previewDispatch(batchId);
      setPreview(res);
    } catch (err: any) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      loadPreview(selectedBatchId);
    }
  }, [selectedBatchId]);

  const handleConfirm = async () => {
    if (!preview || preview.proposedAllocations.length === 0) return;
    try {
      setConfirming(true);
      setError(null);
      const res = await api.confirmDispatch(selectedBatchId, preview.proposedAllocations);
      setSuccessMessage(`Dispatch Confirmed! Created ${res.assignments.length} allocations atomically.`);
      onRefresh();
      onDispatchConfirmed();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Selector Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
              Deterministic Feasibility Dispatch Engine
            </h2>
            <p className="text-xs text-slate-600">
              Evaluates capacity limits, shelter demands, resource compatibility, and safe deadlines before allocation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Select Batch:</label>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 bg-white"
            >
              {batches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.id} • {b.donorName} ({b.ledger?.unassignedQty} {b.unit} unassigned)
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedBatch && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Category:</span>{' '}
              <strong className="text-slate-900">{selectedBatch.category.replace('_', ' ')}</strong>
            </div>
            <div>
              <span className="text-slate-500">Unassigned:</span>{' '}
              <strong className="text-teal-800 font-mono font-bold">{selectedBatch.ledger?.unassignedQty} {selectedBatch.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500">Total Batch:</span>{' '}
              <strong className="text-slate-900 font-mono">{selectedBatch.totalQuantity} {selectedBatch.unit}</strong>
            </div>
            <div>
              <span className="text-slate-500">Safe Window:</span>{' '}
              <strong className="text-slate-900 font-mono">{new Date(selectedBatch.safeUseDeadline).toLocaleTimeString()}</strong>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {loading && (
        <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mx-auto mb-2" />
          <span className="text-xs font-medium">Computing multi-rider capacity split & candidate feasibility...</span>
        </div>
      )}

      {/* Dispatch Plan Preview */}
      {!loading && preview && (
        <div className="space-y-5">
          {/* Summary Box */}
          <div className="bg-slate-900 text-white rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-500 text-slate-900">
                  Pre-Dispatch Feasibility Check
                </span>
                <span className="text-xs font-mono opacity-80">
                  {preview.proposedAllocations.length} feasible allocation(s)
                </span>
              </div>
              <p className="text-xs text-slate-200">
                {preview.explanation}
              </p>
            </div>

            {preview.proposedAllocations.length > 0 && (
              <button
                disabled={confirming}
                onClick={handleConfirm}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-xs rounded-lg flex items-center gap-2 shadow transition-colors disabled:opacity-50 shrink-0"
              >
                {confirming ? 'Persisting...' : 'Confirm & Execute Atomic Dispatch'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Proposed Allocations Table */}
          {preview.proposedAllocations.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Proposed Multi-Rider Allocation Split
                </h3>
                <span className="text-xs font-mono font-semibold text-teal-800">
                  Total Allocated: {preview.allocatedTotalQty} / {preview.unassignedBefore}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Assigned Rider</th>
                      <th className="p-3">Destination Shelter</th>
                      <th className="p-3">Allocated Qty</th>
                      <th className="p-3">Travel ETA</th>
                      <th className="p-3">Rescue Protocol Status</th>
                      <th className="p-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.proposedAllocations.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{alloc.riderName}</span>
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-teal-600" />
                            <span>{alloc.shelterName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-teal-700">
                          {alloc.quantity} {selectedBatch?.unit || 'units'}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          {alloc.estimatedMinutes} mins
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            {alloc.fallbackCount} fallback candidate(s)
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-700">
                          +{alloc.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rejected Candidates & Safety Invariants Table */}
          {preview.rejectedCandidates.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Auditable Constraint Gating (Blocked Candidates)
                  </h3>
                  <span className="text-[11px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono font-medium">
                    {preview.rejectedCandidates.length} Rejected
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Every rejection is backed by deterministic rules, never arbitrary
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Rider Evaluated</th>
                      <th className="p-3">Candidate Shelter</th>
                      <th className="p-3">Dem / Cap</th>
                      <th className="p-3">Explicit Rejection Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rejectedCandidates.slice(0, 10).map((rej, idx) => (
                      <tr key={idx} className="bg-slate-50/50 hover:bg-slate-100/50">
                        <td className="p-3 text-slate-700 font-medium">
                          {rej.riderName}
                        </td>
                        <td className="p-3 text-slate-700">
                          {rej.shelterName}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          Dem: {rej.shelterDemand} | Cap: {rej.riderAvailableCapacity}
                        </td>
                        <td className="p-3 text-red-700 font-medium flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span>{rej.rejectionReason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
