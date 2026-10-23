import React, { useState } from 'react';
import { api } from '../../lib/api.js';
import { 
  Play, RotateCcw, Clock, ShieldCheck, CheckCircle2, 
  AlertTriangle, ShieldAlert, Cpu, Terminal, Sparkles
} from 'lucide-react';

interface SimulationLabViewProps {
  simulatedNow: string;
  onRefresh: () => void;
}

export const SimulationLabView: React.FC<SimulationLabViewProps> = ({
  simulatedNow,
  onRefresh,
}) => {
  const [runningScenario, setRunningScenario] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [executionLog, setExecutionLog] = useState<{
    scenarioName: string;
    summary: string;
    timestamp: string;
    assignments?: any[];
  } | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleRunScenario = async (key: string, name: string) => {
    try {
      setRunningScenario(key);
      const res = await api.runJudgeScenario(key);
      setExecutionLog({
        scenarioName: name,
        summary: res.summary,
        timestamp: new Date().toLocaleTimeString(),
        assignments: res.assignments,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Scenario execution failed: ${err.message}`);
    } finally {
      setRunningScenario(null);
    }
  };

  const handleAdvanceTime = async (mins: number) => {
    try {
      const res = await api.advanceSimulation(mins);
      setExecutionLog({
        scenarioName: `Time Warp: +${mins} minutes`,
        summary: `Advanced simulated time to ${res.simulatedNow}. Leases checked: ${res.timeoutResult.expiredCount} expired, ${res.timeoutResult.releasedQuantity} units released.`,
        timestamp: new Date().toLocaleTimeString(),
      });
      onRefresh();
    } catch (err: any) {
      alert(`Advance time failed: ${err.message}`);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all demo data to pristine baseline seed state?')) return;
    try {
      setResetting(true);
      await api.resetSimulation();
      setExecutionLog({
        scenarioName: 'System Reset to Pristine Baseline',
        summary: 'Database, riders, shelters, and 180-meal batch restored to pristine demonstration state. Simulation clock set to 2026-10-23 10:00:00 UTC.',
        timestamp: new Date().toLocaleTimeString(),
      });
      onRefresh();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const scenarios = [
    {
      key: 'scenario-a-split',
      title: 'Scenario A: Large Batch Capacity-Aware Split',
      tag: 'CAPACITY & DEMAND',
      badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
      description: 'Dispatches 180 cooked meals across five 40-capacity riders and shelters with limited individual demands (50, 60, 40).',
      expectedOutcome: 'No rider carries > 40 meals; no shelter receives more than declared demand; quantity is 100% reconciled in the ledger.',
    },
    {
      key: 'scenario-b-ghost',
      title: 'Scenario B: Ghost Reservation Lease Timeout',
      tag: 'EXACTLY-ONCE LEASE',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      description: 'A volunteer reserves 40 meals but goes unresponsive. Clock advances +18m past the 15-minute reservation lease deadline.',
      expectedOutcome: 'Timeout processor expires reservation; 40 meals are released back to available batch pool exactly once; rider capacity restored.',
    },
    {
      key: 'scenario-c-closure',
      title: 'Scenario C: Mid-Transit Destination Closure & Recovery',
      tag: 'CARGO CUSTODY & REROUTE',
      badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
      description: 'Cargo is in physical transit (RIDER_CUSTODY) when destination shelter closes or drops demand to zero.',
      expectedOutcome: 'In-transit cargo is NEVER returned to donor pool. AidFlow revalidates feasible alternatives and safely reroutes the rider.',
    },
    {
      key: 'scenario-d-resource',
      title: 'Scenario D: Resource Incompatibility Gate',
      tag: 'INFRASTRUCTURE GATES',
      badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
      description: 'Attempts allocation of dehydrated ration kits requiring Clean Water to Shelter E (Dry Creek Depot) where water lines are severed.',
      expectedOutcome: 'Hard compatibility gate deterministically rejects allocation with explicit reason: "Lacks required resource: CLEAN_WATER".',
    },
    {
      key: 'scenario-e-expiry',
      title: 'Scenario E: Expiry Infeasibility Gate',
      tag: 'SAFETY OVER UTILIZATION',
      badgeColor: 'bg-red-50 text-red-800 border-red-200',
      description: 'Time remaining to safe-use deadline (3 mins) is less than required travel time (14 mins) + 10m safety margin.',
      expectedOutcome: 'Safety-first rule blocks allocation. Zero spoiled food delivered; explicit human intervention requested instead of fabricated success.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase bg-teal-500 text-slate-950 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5" />
              Judge Verification Laboratory
            </span>
            <span className="text-xs text-slate-300 font-mono">
              Deterministic Scenario Rehearsal
            </span>
          </div>
          <h2 className="text-lg font-bold">
            Simulate Real-World Micro-Logistics Failures
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Every scenario below calls the actual backend domain services and SQLite database. Observe deterministic constraints, exactly-once lease timeouts, cargo custody preservation, and auditable event logs.
          </p>
        </div>

        <button
          disabled={resetting}
          onClick={handleResetDemo}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4 text-teal-400" />
          {resetting ? 'Resetting...' : 'Reset Demo Seed'}
        </button>
      </div>

      {/* Simulation Clock Controller */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Injectable Simulation Clock
            </h3>
            <span className="text-[11px] font-mono bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-bold">
              {new Date(simulatedNow).toUTCString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Advances trigger automatic lease timeout checks
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => handleAdvanceTime(5)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold font-mono transition-colors"
          >
            +5 mins
          </button>
          <button
            onClick={() => handleAdvanceTime(15)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold font-mono transition-colors"
          >
            +15 mins (Lease Window)
          </button>
          <button
            onClick={() => handleAdvanceTime(30)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold font-mono transition-colors"
          >
            +30 mins
          </button>
          <button
            onClick={() => handleAdvanceTime(60)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold font-mono transition-colors"
          >
            +60 mins
          </button>

          <div className="flex items-center gap-1.5 ml-auto">
            <input
              type="number"
              min={1}
              value={customMinutes}
              onChange={e => setCustomMinutes(Number(e.target.value))}
              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-mono text-center"
            />
            <button
              onClick={() => handleAdvanceTime(customMinutes)}
              className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-xs font-semibold"
            >
              Advance Custom
            </button>
          </div>
        </div>
      </div>

      {/* Execution Output Console */}
      {executionLog && (
        <div className="bg-slate-950 text-emerald-400 font-mono text-xs rounded-lg p-4 border border-slate-800 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-white font-bold">
              <Terminal className="w-4 h-4 text-teal-400" />
              Live Execution Output: {executionLog.scenarioName}
            </span>
            <span className="text-[11px] text-slate-500">{executionLog.timestamp}</span>
          </div>
          <p className="text-slate-200 leading-relaxed text-xs">
            {executionLog.summary}
          </p>
          {executionLog.assignments && executionLog.assignments.length > 0 && (
            <div className="text-[11px] text-slate-400 pt-1 space-y-0.5">
              <div className="text-slate-300 font-semibold">Created / Updated Assignment Records:</div>
              {executionLog.assignments.map((a: any) => (
                <div key={a.id} className="text-teal-300">
                  &bull; {a.id}: {a.quantity} {a.unit} &rarr; Rider {a.riderName} &rarr; Shelter {a.shelterName} [Status: {a.status}, Custody: {a.custody}]
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 gap-4">
        {scenarios.map(sc => (
          <div
            key={sc.key}
            className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sc.badgeColor}`}>
                    {sc.tag}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {sc.title}
                </h3>
              </div>

              <button
                disabled={runningScenario === sc.key}
                onClick={() => handleRunScenario(sc.key, sc.title)}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {runningScenario === sc.key ? 'Executing...' : 'Run Scenario'}
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {sc.description}
            </p>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 space-y-1">
              <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wider">
                Verifiable Acceptance Invariant:
              </span>
              <span>{sc.expectedOutcome}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
