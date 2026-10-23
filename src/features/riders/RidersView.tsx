import React, { useState } from 'react';
import type { Rider } from '../../../shared/types.js';
import { api } from '../../lib/api.js';
import { Bike, Truck, Check, X, Shield, Phone, RefreshCw } from 'lucide-react';

interface RidersViewProps {
  riders: Rider[];
  onRefresh: () => void;
}

export const RidersView: React.FC<RidersViewProps> = ({ riders, onRefresh }) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const toggleAvailability = async (rider: Rider) => {
    try {
      setUpdatingId(rider.id);
      await api.updateRider(rider.id, {
        available: !rider.available,
        status: !rider.available ? 'IDLE' : 'OFFLINE',
      });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update rider: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
            Volunteer Transport & Cargo Capacity Roster
          </h2>
          <p className="text-xs text-slate-600">
            Rider capacities are hard-constrained. Over-capacity assignments are mathematically blocked.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {riders.map(rider => {
          const availableCapacity = Math.max(0, rider.capacity - rider.currentLoad);
          const isBusy = rider.currentLoad > 0;

          return (
            <div
              key={rider.id}
              className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    rider.status === 'IN_TRANSIT' ? 'bg-amber-500 text-white' :
                    rider.status === 'RESERVED' ? 'bg-sky-600 text-white' :
                    rider.available ? 'bg-slate-800 text-white' :
                    'bg-slate-300 text-slate-600'
                  }`}>
                    {rider.vehicleType === 'VAN' ? <Truck className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {rider.id}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        rider.status === 'IN_TRANSIT' ? 'bg-amber-100 text-amber-900' :
                        rider.status === 'RESERVED' ? 'bg-sky-100 text-sky-900' :
                        rider.available ? 'bg-emerald-100 text-emerald-900' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {rider.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {rider.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {rider.phone}
                    </p>
                  </div>
                </div>

                <button
                  disabled={updatingId === rider.id}
                  onClick={() => toggleAvailability(rider)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                    rider.available
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-teal-700 hover:bg-teal-800 text-white'
                  }`}
                >
                  {updatingId === rider.id ? '...' : rider.available ? 'Go Offline' : 'Go Online'}
                </button>
              </div>

              {/* Capacity meter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Current Load: <strong className="font-mono text-slate-900">{rider.currentLoad} / {rider.capacity} units</strong></span>
                  <span>Available: <strong className="font-mono text-teal-700">{availableCapacity}</strong></span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-300 ${
                      rider.currentLoad >= rider.capacity ? 'bg-red-500' : 'bg-teal-600'
                    }`}
                    style={{ width: `${(rider.currentLoad / rider.capacity) * 100}%` }}
                  />
                </div>
              </div>

              {/* Capabilities */}
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 uppercase">
                  Carrier Equipment:
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {rider.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                      {cap.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
