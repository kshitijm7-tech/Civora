import React from 'react';
import { 
  ShieldAlert, Clock, RotateCcw, Cpu, 
  Activity, Sparkles, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api.js';

interface HeaderProps {
  simulatedNow: string;
  onRefresh: () => void;
  onOpenSimulationLab: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  simulatedNow,
  onRefresh,
  onOpenSimulationLab,
}) => {
  const [advancing, setAdvancing] = React.useState(false);

  const handleAdvance = async (mins: number) => {
    try {
      setAdvancing(true);
      await api.advanceSimulation(mins);
      onRefresh();
    } catch (err: any) {
      alert(`Advance failed: ${err.message}`);
    } finally {
      setAdvancing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset AidFlow to pristine seed state?')) return;
    try {
      await api.resetSimulation();
      onRefresh();
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 select-none shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm">
            AF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                AIDFLOW
              </span>
              <span className="bg-teal-950 text-teal-300 border border-teal-700/60 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">
                SIMULATION / DEMO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Resilient Aid Logistics & Rescue Protocol
            </p>
          </div>
        </div>

        {/* Center: Simulation Clock & Quick Step Controls */}
        <div className="hidden md:flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 text-teal-400 font-mono font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(simulatedNow).toUTCString().slice(17, 25)} UTC</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              disabled={advancing}
              onClick={() => handleAdvance(5)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors disabled:opacity-50"
              title="Advance time 5 mins"
            >
              +5m
            </button>
            <button
              disabled={advancing}
              onClick={() => handleAdvance(15)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors disabled:opacity-50"
              title="Advance 15 mins (checks lease timeouts)"
            >
              +15m
            </button>
            <button
              disabled={advancing}
              onClick={() => handleAdvance(30)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors disabled:opacity-50"
              title="Advance time 30 mins"
            >
              +30m
            </button>
          </div>
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSimulationLab}
            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Judge Simulation Lab</span>
            <span className="sm:hidden">Lab</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset to Baseline Seed State"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
