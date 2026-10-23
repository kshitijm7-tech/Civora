import React, { useState, useEffect, useCallback } from 'react';
import type { 
  DashboardSummary, 
  AidBatch, 
  Shelter, 
  Rider, 
  Assignment 
} from '../shared/types.js';
import { api } from './lib/api.js';
import { Header } from './components/Header.js';
import { ShipmentDecisionModal } from './components/ShipmentDecisionModal.js';
import { OperationsView } from './features/operations/OperationsView.js';
import { ShipmentsView } from './features/shipments/ShipmentsView.js';
import { DispatchView } from './features/dispatch/DispatchView.js';
import { RidersView } from './features/riders/RidersView.js';
import { SheltersView } from './features/shelters/SheltersView.js';
import { RescueCenterView } from './features/rescue/RescueCenterView.js';
import { SimulationLabView } from './features/simulation/SimulationLabView.js';
import { EventLogView } from './features/events/EventLogView.js';
import { DemoMapView } from './features/demo/DemoMapView.js';
import { LandingPage } from './components/LandingPage.js';
import { 
  Activity, Package, Zap, Bike, Building2, 
  ShieldAlert, Cpu, FileText, AlertCircle, RefreshCw, Map
} from 'lucide-react';

type NavTab = 
  | 'operations'
  | 'shipments'
  | 'dispatch'
  | 'riders'
  | 'shelters'
  | 'rescue'
  | 'simulation'
  | 'events'
  | 'demo';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('operations');
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [batches, setBatches] = useState<(AidBatch & { ledger: any })[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [dispatchBatchId, setDispatchBatchId] = useState<string | undefined>(undefined);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showLanding, setShowLanding] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [dashRes, batchRes, shelterRes, riderRes, assignRes] = await Promise.all([
        api.getDashboard(),
        api.getBatches(),
        api.getShelters(),
        api.getRiders(),
        api.getAssignments(),
      ]);

      setDashboard(dashRes);
      setBatches(batchRes);
      setShelters(shelterRes);
      setRiders(riderRes);
      setAssignments(assignRes);
      setError(null);
    } catch (err: any) {
      console.error('Data load error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Poll every 12 seconds to keep simulation / leases updated
    const interval = setInterval(loadAll, 12000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleRefresh = () => {
    loadAll();
    setRefreshTrigger(prev => prev + 1);
  };

  const navigateToDispatch = (batchId?: string) => {
    setDispatchBatchId(batchId);
    setActiveTab('dispatch');
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode; badge?: number | string }> = [
    { id: 'operations', label: 'Operations Center', icon: <Activity className="w-4 h-4" /> },
    { id: 'shipments', label: 'Surplus Batches', icon: <Package className="w-4 h-4" />, badge: batches.length },
    { id: 'dispatch', label: 'Dispatch Engine', icon: <Zap className="w-4 h-4" /> },
    { id: 'riders', label: 'Riders Roster', icon: <Bike className="w-4 h-4" />, badge: riders.length },
    { id: 'shelters', label: 'Shelters Network', icon: <Building2 className="w-4 h-4" />, badge: shelters.length },
    { 
      id: 'rescue', 
      label: 'Rescue Center', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      badge: dashboard?.interventionRequiredCount ? `${dashboard.interventionRequiredCount} alert` : undefined 
    },
    { id: 'simulation', label: 'Simulation Lab', icon: <Cpu className="w-4 h-4" /> },
    { id: 'events', label: 'Audit Event Log', icon: <FileText className="w-4 h-4" /> },
    { id: 'demo', label: 'Demo Map', icon: <Map className="w-4 h-4" /> },
  ];

  const simulatedNow = dashboard?.simulatedTime || new Date().toISOString();

  return (
    <div className="min-h-screen bg-[#F5F7F8] text-[#102A43] flex flex-col font-sans">
      {showLanding ? (
        <LandingPage onEnterApp={() => setShowLanding(false)} />
      ) : (
        <>
          {/* Top Header */}
          <Header
            simulatedNow={simulatedNow}
            onRefresh={handleRefresh}
            onOpenSimulationLab={() => setActiveTab('simulation')}
            onReturnToLanding={() => setShowLanding(true)}
          />

          <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Persistent Left Navigation Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-2 shadow-xs space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Logistics Navigation
            </div>
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-teal-800 text-teal-100'
                          : String(item.badge).includes('alert')
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Simulation Status Card */}
          <div className="bg-slate-900 text-white rounded-lg p-3.5 shadow-xs text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Simulation State</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="font-mono text-teal-300 text-[11px]">
              {new Date(simulatedNow).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-300 border-t border-slate-800 pt-1.5 flex justify-between">
              <span>Active Leases:</span>
              <span className="font-mono font-bold text-white">
                {assignments.filter(a => a.status === 'RESERVED').length}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Operational Workspace */}
        <main className="flex-1 min-w-0">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'operations' && (
            <OperationsView
              dashboard={dashboard}
              batches={batches}
              shelters={shelters}
              riders={riders}
              assignments={assignments}
              onRefresh={handleRefresh}
              onOpenShipment={id => setSelectedAssignmentId(id)}
              onNavigateToDispatch={navigateToDispatch}
            />
          )}

          {activeTab === 'shipments' && (
            <ShipmentsView
              batches={batches}
              simulatedNow={simulatedNow}
              onRefresh={handleRefresh}
              onDispatchBatch={navigateToDispatch}
            />
          )}

          {activeTab === 'dispatch' && (
            <DispatchView
              batches={batches}
              initialBatchId={dispatchBatchId}
              simulatedNow={simulatedNow}
              onRefresh={handleRefresh}
              onDispatchConfirmed={() => setActiveTab('operations')}
            />
          )}

          {activeTab === 'riders' && (
            <RidersView
              riders={riders}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'shelters' && (
            <SheltersView
              shelters={shelters}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'rescue' && (
            <RescueCenterView
              assignments={assignments}
              simulatedNow={simulatedNow}
              onRefresh={handleRefresh}
              onOpenShipment={id => setSelectedAssignmentId(id)}
            />
          )}

          {activeTab === 'simulation' && (
            <SimulationLabView
              simulatedNow={simulatedNow}
              onRefresh={handleRefresh}
            />
          )}

          {activeTab === 'events' && (
            <EventLogView
              onRefreshTrigger={refreshTrigger}
            />
          )}

          {activeTab === 'demo' && (
            <DemoMapView />
          )}
        </main>

      </div>

      {/* Decision Workspace Modal */}
      {selectedAssignmentId && (
        <ShipmentDecisionModal
          assignmentId={selectedAssignmentId}
          simulatedNow={simulatedNow}
          onClose={() => setSelectedAssignmentId(null)}
          onActionComplete={handleRefresh}
        />
      )}
      </>
  )}
</div>
  );
};

export default App;
