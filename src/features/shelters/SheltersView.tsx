import React, { useState } from 'react';
import type { Shelter } from '../../../shared/types.js';
import { api } from '../../lib/api.js';
import { Building2, Droplets, Flame, Refrigerator, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';

interface SheltersViewProps {
  shelters: Shelter[];
  onRefresh: () => void;
}

export const SheltersView: React.FC<SheltersViewProps> = ({ shelters, onRefresh }) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const toggleShelterActive = async (shelter: Shelter) => {
    try {
      setUpdatingId(shelter.id);
      await api.updateShelter(shelter.id, { active: !shelter.active });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update shelter: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const zeroOutDemand = async (shelter: Shelter) => {
    try {
      setUpdatingId(shelter.id);
      const zeroedDemand: Record<string, number> = {};
      for (const k of Object.keys(shelter.demandByCategory)) {
        zeroedDemand[k] = 0;
      }
      await api.updateShelter(shelter.id, { demandByCategory: zeroedDemand });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to zero demand: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
            Receiving Shelters & Resource Infrastructure
          </h2>
          <p className="text-xs text-slate-600">
            Destination demand and resource capabilities (clean water, fuel) are actively verified before and during transit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shelters.map(shelter => {
          const hasCleanWater = shelter.resources.includes('CLEAN_WATER');
          const hasCookingFuel = shelter.resources.includes('COOKING_FUEL');
          const hasColdStorage = shelter.resources.includes('COLD_STORAGE');

          return (
            <div
              key={shelter.id}
              className={`rounded-lg border p-5 shadow-xs space-y-4 transition-all ${
                !shelter.active
                  ? 'bg-slate-100 border-slate-300 opacity-80'
                  : shelter.priority === 'CRITICAL'
                  ? 'bg-white border-teal-300 ring-1 ring-teal-100'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    !shelter.active ? 'bg-slate-300 text-slate-600' : 'bg-teal-700 text-white'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {shelter.id}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        shelter.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {shelter.active ? 'ACTIVE' : 'CLOSED'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        {shelter.priority} Priority
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {shelter.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {shelter.location.address}
                    </p>
                  </div>
                </div>

                <button
                  disabled={updatingId === shelter.id}
                  onClick={() => toggleShelterActive(shelter)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 ${
                    shelter.active
                      ? 'bg-red-700 hover:bg-red-800 text-white'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                >
                  {updatingId === shelter.id
                    ? 'Updating...'
                    : shelter.active
                    ? 'Close Shelter'
                    : 'Reopen Shelter'}
                </button>
              </div>

              {/* Resource capabilities */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Verified On-Site Resources:
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                    hasCleanWater
                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    <Droplets className="w-3 h-3" />
                    {hasCleanWater ? 'Clean Water Available' : 'NO CLEAN WATER'}
                  </span>

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                    hasCookingFuel
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    <Flame className="w-3 h-3" />
                    {hasCookingFuel ? 'Cooking Fuel' : 'No Fuel'}
                  </span>

                  {hasColdStorage && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                      <Refrigerator className="w-3 h-3" />
                      Cold Storage
                    </span>
                  )}
                </div>
              </div>

              {/* Demand by category */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Remaining Declared Demand:
                  </span>
                  {shelter.active && (
                    <button
                      onClick={() => zeroOutDemand(shelter)}
                      className="text-[10px] text-amber-800 hover:text-amber-900 underline font-medium"
                    >
                      Simulate Zero Demand
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(shelter.demandByCategory).map(([cat, dem]) => (
                    <div key={cat} className="p-2 bg-slate-50 border border-slate-200 rounded text-center">
                      <div className="text-[10px] text-slate-500 uppercase truncate font-medium">
                        {cat.replace('_', ' ')}
                      </div>
                      <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {dem} units
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capacity info */}
              <div className="text-xs text-slate-500 flex justify-between border-t border-slate-100 pt-2 font-mono">
                <span>Occupancy: {shelter.currentOccupancy} / {shelter.capacityLimit}</span>
                <span>Coordinates: ({shelter.location.x}, {shelter.location.y})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
