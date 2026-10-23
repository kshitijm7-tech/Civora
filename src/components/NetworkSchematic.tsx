import React from 'react';
import type { Shelter, Rider, Assignment, AidBatch } from '../../shared/types.js';
import { Home, Bike, Building2, AlertTriangle, Droplets, CheckCircle } from 'lucide-react';

interface NetworkSchematicProps {
  batches: AidBatch[];
  shelters: Shelter[];
  riders: Rider[];
  assignments: Assignment[];
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
  onSelectShelter?: (shelterId: string) => void;
}

export const NetworkSchematic: React.FC<NetworkSchematicProps> = ({
  batches,
  shelters,
  riders,
  assignments,
  selectedAssignmentId,
  onSelectAssignment,
  onSelectShelter,
}) => {
  const activeAssignments = assignments.filter(
    a => a.status === 'IN_TRANSIT' || a.status === 'PICKED_UP' || a.status === 'RESERVED' || a.status === 'INTERVENTION_REQUIRED'
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-800">
            Network Operations Schematic
          </span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            Simulated Topology & Live Corridors
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> In Transit
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Reserved
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> Intervention
          </span>
        </div>
      </div>

      {/* Schematic Map Container */}
      <div className="relative w-full h-80 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden select-none">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SVG Route Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>

          {activeAssignments.map(assign => {
            const isSelected = assign.id === selectedAssignmentId;
            const isIntervention = assign.status === 'INTERVENTION_REQUIRED';
            const isInTransit = assign.status === 'IN_TRANSIT' || assign.status === 'PICKED_UP';

            const strokeColor = isIntervention
              ? '#dc2626'
              : isInTransit
              ? '#f59e0b'
              : '#0284c7';

            return (
              <g key={assign.id}>
                <line
                  x1={`${assign.origin.x}%`}
                  y1={`${assign.origin.y}%`}
                  x2={`${assign.destination.x}%`}
                  y2={`${assign.destination.y}%`}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : 2}
                  strokeDasharray={isInTransit ? '6,4' : 'none'}
                  strokeOpacity={isSelected ? 1 : 0.75}
                  className={isInTransit ? 'animate-pulse' : ''}
                />
              </g>
            );
          })}
        </svg>

        {/* Donors */}
        {batches.map(b => (
          <div
            key={b.id}
            style={{ left: `${b.origin.x}%`, top: `${b.origin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
          >
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-900 border-2 border-white shadow-md flex items-center justify-center text-white text-xs hover:scale-110 transition-transform">
                <Home className="w-4 h-4 text-indigo-200" />
              </div>
              <span className="mt-1 px-1.5 py-0.5 bg-slate-900/85 text-white text-[10px] font-semibold rounded whitespace-nowrap shadow-xs pointer-events-none">
                {b.donorName.split(' ')[0]}
              </span>
            </div>
          </div>
        ))}

        {/* Shelters */}
        {shelters.map(s => {
          const hasCleanWater = s.resources.includes('CLEAN_WATER');
          const isClosed = !s.active;

          return (
            <div
              key={s.id}
              onClick={() => onSelectShelter?.(s.id)}
              style={{ left: `${s.location.x}%`, top: `${s.location.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20"
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-md border-2 border-white shadow-md flex items-center justify-center text-xs transition-transform hover:scale-110 ${
                    isClosed
                      ? 'bg-slate-400 text-slate-100'
                      : s.priority === 'CRITICAL'
                      ? 'bg-teal-700 text-white ring-2 ring-teal-400/50'
                      : 'bg-teal-600 text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 bg-white/90 border border-slate-200 text-slate-800 text-[10px] font-medium rounded shadow-xs whitespace-nowrap">
                  <span>{s.name.split(' ')[0]}</span>
                  {hasCleanWater ? (
                    <span title="Clean Water Available" className="text-sky-600">
                      <Droplets className="w-3 h-3 inline" />
                    </span>
                  ) : (
                    <span title="No Clean Water!" className="text-amber-600 font-bold">
                      !W
                    </span>
                  )}
                  {isClosed && <span className="text-red-600 font-bold ml-0.5">(CLOSED)</span>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Riders */}
        {riders.map(r => {
          const isBusy = r.status === 'IN_TRANSIT' || r.status === 'RESERVED';
          return (
            <div
              key={r.id}
              style={{ left: `${r.location.x}%`, top: `${r.location.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full border-2 border-white shadow flex items-center justify-center text-xs transition-transform ${
                    isBusy ? 'bg-amber-500 text-white ring-2 ring-amber-300' : 'bg-slate-800 text-white'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <span className="mt-0.5 px-1 bg-slate-800/80 text-white text-[9px] rounded font-mono">
                  {r.name.split(' ')[0]} ({r.currentLoad}/{r.capacity})
                </span>
              </div>
            </div>
          );
        })}

        {/* Active Shipments Badges Floating */}
        {activeAssignments.map(a => {
          const midX = (a.origin.x + a.destination.x) / 2;
          const midY = (a.origin.y + a.destination.y) / 2;
          const isSelected = a.id === selectedAssignmentId;

          return (
            <div
              key={`badge-${a.id}`}
              onClick={() => onSelectAssignment?.(a.id)}
              style={{ left: `${midX}%`, top: `${midY}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer transition-all hover:scale-105 ${
                isSelected ? 'scale-110 ring-2 ring-teal-500' : ''
              }`}
            >
              <div
                className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold shadow-md border flex items-center gap-1 ${
                  a.status === 'INTERVENTION_REQUIRED'
                    ? 'bg-red-600 text-white border-red-700 animate-bounce'
                    : a.status === 'IN_TRANSIT'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-sky-600 text-white border-sky-700'
                }`}
              >
                {a.status === 'INTERVENTION_REQUIRED' && <AlertTriangle className="w-3 h-3" />}
                {a.id} • {a.quantity} {a.unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
