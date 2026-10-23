import React, { useState } from 'react';
import type { AidBatch } from '../../../shared/types.js';
import { AllocationLedgerBar } from '../../components/AllocationLedgerBar.js';
import { api } from '../../lib/api.js';
import { Plus, Package, Clock, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ShipmentsViewProps {
  batches: (AidBatch & { ledger: any })[];
  simulatedNow: string;
  onRefresh: () => void;
  onDispatchBatch: (batchId: string) => void;
}

export const ShipmentsView: React.FC<ShipmentsViewProps> = ({
  batches,
  simulatedNow,
  onRefresh,
  onDispatchBatch,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [category, setCategory] = useState<'COOKED_MEALS' | 'PERISHABLE_PRODUCE' | 'RATION_KITS' | 'BAKERY' | 'COLD_STORAGE_DAIRY'>('COOKED_MEALS');
  const [totalQuantity, setTotalQuantity] = useState(100);
  const [unit, setUnit] = useState('meals');
  const [safeWindowMinutes, setSafeWindowMinutes] = useState(75);
  const [handlingReqs, setHandlingReqs] = useState<string[]>(['CLEAN_WATER_AT_DESTINATION']);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleReq = (req: string) => {
    setHandlingReqs(prev =>
      prev.includes(req) ? prev.filter(r => r !== req) : [...prev, req]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const safeUseDeadline = new Date(new Date(simulatedNow).getTime() + safeWindowMinutes * 60 * 1000).toISOString();

      await api.createBatch({
        donorName,
        category,
        totalQuantity: Number(totalQuantity),
        unit,
        safeUseDeadline,
        handlingRequirements: handlingReqs,
        notes,
        origin: { name: donorName, address: 'Metro Logistics Point', x: 45, y: 45 },
      });

      setShowCreateModal(false);
      setDonorName('');
      setNotes('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
            Surplus Aid Batches & Custody Ledgers
          </h2>
          <p className="text-xs text-slate-600">
            Every donor batch tracks physical cargo across unassigned, reserved, in-transit, delivered, and intervention states.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Offer New Surplus Batch
        </button>
      </div>

      {/* Batches List */}
      <div className="grid grid-cols-1 gap-4">
        {batches.map(batch => {
          const nowMs = new Date(simulatedNow).getTime();
          const deadlineMs = new Date(batch.safeUseDeadline).getTime();
          const minsRemaining = Math.round((deadlineMs - nowMs) / (60 * 1000));
          const isExpired = minsRemaining <= 0;

          return (
            <div key={batch.id} className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {batch.id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                      {batch.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {batch.category.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {batch.donorName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Origin: {batch.origin.name} ({batch.origin.address})
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {minsRemaining > 0 ? `${minsRemaining} mins remaining` : 'EXPIRED'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Safe Window: {new Date(batch.safeUseDeadline).toLocaleTimeString()}
                    </div>
                  </div>

                  {batch.ledger.unassignedQty > 0 && !isExpired && (
                    <button
                      onClick={() => onDispatchBatch(batch.id)}
                      className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <span>Dispatch ({batch.ledger.unassignedQty} {batch.unit})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Handling Requirements tags */}
              {batch.handlingRequirements.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-slate-500 font-medium">Handling Gates:</span>
                  {batch.handlingRequirements.map(req => (
                    <span key={req} className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-mono">
                      {req}
                    </span>
                  ))}
                </div>
              )}

              {/* Per-batch Allocation Ledger */}
              <AllocationLedgerBar
                showTitle={false}
                total={batch.totalQuantity}
                unassigned={batch.ledger.unassignedQty}
                reserved={batch.ledger.reservedQty}
                inTransit={batch.ledger.inTransitQty}
                delivered={batch.ledger.deliveredQty}
                intervention={batch.ledger.interventionQty}
                unit={batch.unit}
              />
            </div>
          );
        })}
      </div>

      {/* Modal: Register Surplus Batch */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Register Perishable Surplus Batch
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter donor, safe shelf-life deadline, and hard handling requirements.
            </p>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Donor Name / Origin</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Convention Catering, Harvest Bakery"
                  value={donorName}
                  onChange={e => setDonorName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aid Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="COOKED_MEALS">Cooked Meals</option>
                    <option value="RATION_KITS">Ration Kits</option>
                    <option value="PERISHABLE_PRODUCE">Perishable Produce</option>
                    <option value="BAKERY">Bakery Goods</option>
                    <option value="COLD_STORAGE_DAIRY">Dairy & Cold Goods</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity & Unit</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      value={totalQuantity}
                      onChange={e => setTotalQuantity(Number(e.target.value))}
                      className="w-2/3 px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={e => setUnit(e.target.value)}
                      className="w-1/3 px-2 py-2 border border-slate-300 rounded-lg text-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Safe-Use Window (Minutes from current simulated time)
                </label>
                <input
                  type="number"
                  required
                  min={5}
                  value={safeWindowMinutes}
                  onChange={e => setSafeWindowMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900"
                />
                <span className="text-[11px] text-slate-500">
                  e.g. 75 minutes for cooked meals, 25 minutes for bakery. AidFlow enforces this as an immutable hard constraint.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Required Resource Handling Gates
                </label>
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handlingReqs.includes('CLEAN_WATER_AT_DESTINATION')}
                      onChange={() => toggleReq('CLEAN_WATER_AT_DESTINATION')}
                      className="rounded text-teal-600"
                    />
                    <span>Clean Water Required at Destination</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handlingReqs.includes('COOKING_FUEL_AT_DESTINATION')}
                      onChange={() => toggleReq('COOKING_FUEL_AT_DESTINATION')}
                      className="rounded text-teal-600"
                    />
                    <span>Cooking Fuel Required at Destination</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handlingReqs.includes('COLD_STORAGE_AT_DESTINATION')}
                      onChange={() => toggleReq('COLD_STORAGE_AT_DESTINATION')}
                      className="rounded text-teal-600"
                    />
                    <span>Cold Storage Required at Destination</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create & Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
