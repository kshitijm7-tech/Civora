import React, { useState } from 'react';
import type { DashboardSummary, Assignment, Shelter, Rider, AidBatch } from '../../../shared/types.js';
import { RescueClock } from '../../components/RescueClock.js';
import { AllocationLedgerBar } from '../../components/AllocationLedgerBar.js';
import { NetworkSchematic } from '../../components/NetworkSchematic.js';
import { GpsLeafletMap } from '../../components/GpsLeafletMap.js';
import { 
  AlertTriangle, ArrowRight, Truck, CheckCircle2, 
  Clock, Package, RefreshCw, Eye, Map, Compass
} from 'lucide-react';
import { api } from '../../lib/api.js';

interface OperationsViewProps {
  dashboard: DashboardSummary | null;
  batches: (AidBatch & { ledger: any })[];
  shelters: Shelter[];
  riders: Rider[];
  assignments: Assignment[];
  onRefresh: () => void;
  onOpenShipment: (id: string) => void;
  onNavigateToDispatch: (batchId?: string) => void;
}

export const OperationsView: React.FC<OperationsViewProps> = ({
  dashboard,
  batches,
  shelters,
  riders,
  assignments,
  onRefresh,
  onOpenShipment,
  onNavigateToDispatch,
}) => {
  const [actingId, setActingId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<'leaflet' | 'schematic'>('leaflet');

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-teal-600" />
        <span>Loading operational command center...</span>
      </div>
    );
  }

  const handleQuickAction = async (assignment: Assignment) => {
    try {
      setActingId(assignment.id);
      if (assignment.status === 'RESERVED') {
        await api.acknowledgeAssignment(assignment.id);
      } else if (assignment.status === 'ACKNOWLEDGED') {
        await api.pickupCargo(assignment.id);
      } else if (assignment.status === 'PICKED_UP') {
        await api.transitAssignment(assignment.id);
      } else if (assignment.status === 'IN_TRANSIT') {
        await api.deliverAssignment(assignment.id);
      } else if (assignment.status === 'INTERVENTION_REQUIRED') {
        onOpenShipment(assignment.id);
        return;
      }
      onRefresh();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActingId(null);
    }
  };

  const getQuickActionLabel = (status: Assignment['status']) => {
    switch (status) {
      case 'RESERVED': return 'Acknowledge';
      case 'ACKNOWLEDGED': return 'Pick Up';
      case 'PICKED_UP': return 'Depart';
      case 'IN_TRANSIT': return 'Deliver';
      case 'INTERVENTION_REQUIRED': return 'Resolve';
      default: return 'View';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Operations KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Active Perishable Supply
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {dashboard.ledgerSummary.totalPerishableUnits}
            </div>
            <span className="text-xs text-slate-500">
              {dashboard.batchesCount} donor batch(es)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 flex justify-between border-t border-slate-100 pt-1.5">
            <span>Unassigned: <strong className="font-mono text-slate-800">{dashboard.ledgerSummary.unassignedUnits}</strong></span>
            <span>Reserved: <strong className="font-mono text-sky-700">{dashboard.ledgerSummary.reservedUnits}</strong></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            In Transit / On Route
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-amber-600">
              {dashboard.ledgerSummary.inTransitUnits}
            </div>
            <span className="text-xs text-slate-500">
              {dashboard.riders.inTransit} rider(s) carrying
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
            Physical cargo in volunteer custody
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Safely Delivered
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {dashboard.ledgerSummary.deliveredUnits}
            </div>
            <span className="text-xs text-slate-500">
              {dashboard.deliveredTodayCount} verified drop(s)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
            Zero spoilage across delivered cargo
          </div>
        </div>

        <div className={`p-4 rounded-lg border shadow-xs ${
          dashboard.interventionRequiredCount > 0
            ? 'bg-red-50 border-red-300'
            : 'bg-white border-slate-200'
        }`}>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Intervention Required
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <div className={`text-2xl font-bold font-mono ${
              dashboard.interventionRequiredCount > 0 ? 'text-red-700' : 'text-slate-900'
            }`}>
              {dashboard.interventionRequiredCount}
            </div>
            <span className="text-xs text-slate-500">
              {dashboard.ledgerSummary.interventionUnits} units held
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-600 border-t border-slate-100 pt-1.5">
            {dashboard.interventionRequiredCount > 0
              ? 'Immediate operator recovery needed'
              : 'All active shipments on safe path'}
          </div>
        </div>
      </div>

      {/* Physical Cargo Accounting Ledger Bar */}
      <AllocationLedgerBar
        total={dashboard.ledgerSummary.totalPerishableUnits}
        unassigned={dashboard.ledgerSummary.unassignedUnits}
        reserved={dashboard.ledgerSummary.reservedUnits}
        inTransit={dashboard.ledgerSummary.inTransitUnits}
        delivered={dashboard.ledgerSummary.deliveredUnits}
        intervention={dashboard.ledgerSummary.interventionUnits}
      />

      {/* Rescue Queue (Signature UX feature) */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Priority Rescue Queue
            </h2>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
              {dashboard.rescueQueue.length} Active Shipments
            </span>
          </div>
          <button
            onClick={() => onNavigateToDispatch()}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            + Dispatch New Surplus &rarr;
          </button>
        </div>

        {dashboard.rescueQueue.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
            No active shipments in the rescue queue. All batches are either unassigned or safely delivered.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dashboard.rescueQueue.map(item => {
              const isIntervention = item.status === 'INTERVENTION_REQUIRED';
              return (
                <div
                  key={item.id}
                  className={`py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                    isIntervention ? 'bg-red-50/50 p-2 rounded' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {item.id}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        isIntervention ? 'bg-red-600 text-white' :
                        item.status === 'IN_TRANSIT' ? 'bg-amber-500 text-white' :
                        'bg-sky-600 text-white'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {item.quantity} {item.unit} ({item.category.replace('_', ' ')})
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>Rider: <strong className="text-slate-800">{item.riderName}</strong></span>
                      <span>&rarr;</span>
                      <span>Destination: <strong className="text-slate-800">{item.shelterName}</strong></span>
                      <span className="text-slate-400">•</span>
                      <span>Custody: <strong className="text-slate-700">{item.custody}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <RescueClock
                      compact
                      safeUseDeadline={item.safeUseDeadline}
                      simulatedNow={dashboard.simulatedTime}
                      estimatedTravelMinutes={item.estimatedTravelMinutes}
                    />

                    <button
                      disabled={actingId === item.id}
                      onClick={() => handleQuickAction(item)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 ${
                        isIntervention
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-teal-700 hover:bg-teal-800 text-white'
                      }`}
                    >
                      {actingId === item.id ? 'Updating...' : getQuickActionLabel(item.status)}
                    </button>

                    <button
                      onClick={() => onOpenShipment(item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                      title="Open Decision Workspace"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Section with Mode Toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Network Routing & Fleet Corridors
            </h3>
            <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded">
              {mapView === 'leaflet' ? 'Leaflet GPS Mode' : 'Topological Schematic'}
            </span>
          </div>

          <div className="flex items-center bg-slate-200 p-0.5 rounded-lg border border-slate-300 text-xs">
            <button
              onClick={() => setMapView('leaflet')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                mapView === 'leaflet'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Leaflet GPS Map</span>
            </button>
            <button
              onClick={() => setMapView('schematic')}
              className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                mapView === 'schematic'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Schematic View</span>
            </button>
          </div>
        </div>

        {mapView === 'leaflet' ? (
          <GpsLeafletMap
            batches={batches}
            shelters={shelters}
            riders={riders}
            assignments={assignments}
            selectedAssignmentId={null}
            onSelectAssignment={onOpenShipment}
          />
        ) : (
          <NetworkSchematic
            batches={batches}
            shelters={shelters}
            riders={riders}
            assignments={assignments}
            onSelectAssignment={onOpenShipment}
          />
        )}
      </div>
    </div>
  );
};
