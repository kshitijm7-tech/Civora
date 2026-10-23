import React, { useState } from 'react';
import type { AidBatch, Shelter, Rider, Assignment } from '../../../shared/types.js';
import { GpsLeafletMap } from '../../components/GpsLeafletMap.js';
import { Map, Compass, RefreshCw, Building2, Home, Bike } from 'lucide-react';

const DEMO_CENTER_LAT = 18.5204;
const DEMO_CENTER_LNG = 73.8567;

const demoBatches: AidBatch[] = [
  {
    id: 'batch-demo-1',
    donorName: 'Green Kitchen Central',
    category: 'COOKED_MEALS',
    totalQuantity: 120,
    unit: 'meals',
    origin: { name: 'Green Kitchen Central', address: 'MG Road, Pune', x: 30, y: 45, lat: DEMO_CENTER_LAT + 0.008, lng: DEMO_CENTER_LNG - 0.01 },
    safeUseDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    handlingRequirements: ['INSULATED_BAG'],
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'batch-demo-2',
    donorName: 'Sunrise Bakery',
    category: 'BAKERY',
    totalQuantity: 80,
    unit: 'loaves',
    origin: { name: 'Sunrise Bakery', address: 'Fergusson College Rd, Pune', x: 70, y: 30, lat: DEMO_CENTER_LAT - 0.005, lng: DEMO_CENTER_LNG + 0.008 },
    safeUseDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    handlingRequirements: ['COLD_BOX'],
    status: 'AVAILABLE',
    createdAt: new Date().toISOString(),
  },
];

const demoShelters: Shelter[] = [
  {
    id: 'shelter-demo-1',
    name: 'City Relief Shelter North',
    location: { name: 'City Relief Shelter North', address: 'Shivaji Nagar, Pune', x: 20, y: 70, lat: DEMO_CENTER_LAT + 0.012, lng: DEMO_CENTER_LNG + 0.005 },
    active: true,
    capacityLimit: 200,
    currentOccupancy: 140,
    demandByCategory: { COOKED_MEALS: 60, BAKERY: 30 },
    resources: ['CLEAN_WATER', 'COLD_STORAGE'],
    priority: 'CRITICAL',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'shelter-demo-2',
    name: 'Community Haven East',
    location: { name: 'Community Haven East', address: 'Koregaon Park, Pune', x: 80, y: 75, lat: DEMO_CENTER_LAT - 0.009, lng: DEMO_CENTER_LNG + 0.012 },
    active: true,
    capacityLimit: 150,
    currentOccupancy: 90,
    demandByCategory: { COOKED_MEALS: 40, BAKERY: 50 },
    resources: ['CLEAN_WATER'],
    priority: 'HIGH',
    updatedAt: new Date().toISOString(),
  },
];

const demoRiders: Rider[] = [
  {
    id: 'rider-demo-1',
    name: 'Arjun Mehta',
    phone: '+91 98765 43210',
    vehicleType: 'CARGO_BIKE',
    capacity: 40,
    currentLoad: 20,
    available: true,
    location: { name: 'Rider Start Point', address: 'Camp, Pune', x: 50, y: 50, lat: DEMO_CENTER_LAT, lng: DEMO_CENTER_LNG },
    capabilities: ['INSULATED_BAG', 'COLD_BOX'],
    status: 'IDLE',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rider-demo-2',
    name: 'Priya Sharma',
    phone: '+91 91234 56789',
    vehicleType: 'VAN',
    capacity: 100,
    currentLoad: 60,
    available: true,
    location: { name: 'Van Hub', address: 'Swargate, Pune', x: 60, y: 40, lat: DEMO_CENTER_LAT + 0.006, lng: DEMO_CENTER_LNG - 0.004 },
    capabilities: ['LARGE_RACK', 'COLD_BOX'],
    status: 'IN_TRANSIT',
    updatedAt: new Date().toISOString(),
  },
];

const demoAssignments: Assignment[] = [
  {
    id: 'assign-demo-1',
    batchId: 'batch-demo-1',
    batchName: 'Green Kitchen Central',
    category: 'COOKED_MEALS',
    quantity: 60,
    unit: 'meals',
    riderId: 'rider-demo-1',
    riderName: 'Arjun Mehta',
    shelterId: 'shelter-demo-1',
    shelterName: 'City Relief Shelter North',
    origin: demoBatches[0].origin,
    destination: demoShelters[0].location,
    status: 'IN_TRANSIT',
    custody: 'RIDER_CUSTODY',
    leaseDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    estimatedTravelMinutes: 25,
    safetyMarginMinutes: 10,
    safeUseDeadline: demoBatches[0].safeUseDeadline,
    precomputedFallbacks: [],
    acknowledgedAt: new Date().toISOString(),
    pickedUpAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DemoMapView: React.FC = () => {
  const [refreshCount, setRefreshCount] = useState(0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-teal-600 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Demo Map
            </h2>
          </div>
          <button
            onClick={() => setRefreshCount(c => c + 1)}
            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded transition-colors"
            title="Regenerate demo positions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Standalone Leaflet demo map with sample donor, shelter, rider, and shipment data.
        </p>
        <GpsLeafletMap
          batches={demoBatches}
          shelters={demoShelters}
          riders={demoRiders}
          assignments={demoAssignments}
          selectedAssignmentId={null}
          key={refreshCount}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 uppercase">Demo Donors</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            {demoBatches.map(b => (
              <div key={b.id} className="flex justify-between">
                <span className="font-mono">{b.donorName}</span>
                <span className="font-bold">{b.totalQuantity} {b.unit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Home className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 uppercase">Demo Shelters</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            {demoShelters.map(s => (
              <div key={s.id} className="flex justify-between">
                <span className="font-mono">{s.name}</span>
                <span className={`font-bold ${s.active ? 'text-emerald-700' : 'text-red-700'}`}>{s.active ? 'Active' : 'Closed'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <Bike className="w-4 h-4 text-slate-600 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 uppercase">Demo Riders</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            {demoRiders.map(r => (
              <div key={r.id} className="flex justify-between">
                <span className="font-mono">{r.name}</span>
                <span className={`font-bold ${r.status === 'IN_TRANSIT' ? 'text-amber-700' : 'text-emerald-700'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
