import React, { useState, useEffect } from 'react';
import type { OperationalEvent } from '../../../shared/types.js';
import { api } from '../../lib/api.js';
import { 
  FileText, Filter, Search, RefreshCw, AlertTriangle, 
  CheckCircle2, Info, ShieldAlert, ChevronDown, ChevronRight
} from 'lucide-react';

interface EventLogViewProps {
  onRefreshTrigger?: number;
}

export const EventLogView: React.FC<EventLogViewProps> = ({ onRefreshTrigger }) => {
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await api.getEvents(100);
      setEvents(res);
    } catch (err: any) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [onRefreshTrigger]);

  const filteredEvents = events.filter(e => {
    if (severityFilter !== 'ALL' && e.severity !== severityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match =
        e.id.toLowerCase().includes(term) ||
        e.eventType.toLowerCase().includes(term) ||
        e.reason.toLowerCase().includes(term) ||
        e.entityId.toLowerCase().includes(term) ||
        e.trigger.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  const getSeverityBadge = (sev: OperationalEvent['severity']) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">CRITICAL</span>;
      case 'CAUTION':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-200">CAUTION</span>;
      case 'SUCCESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">SUCCESS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">INFO</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
            Operational Audit Trail & Decision Log
          </h2>
          <p className="text-xs text-slate-600">
            Immutable log tracing trigger &rarr; candidates evaluated &rarr; safety decision &rarr; resulting custody.
          </p>
        </div>

        <button
          onClick={loadEvents}
          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Trail
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by event, entity ID, trigger, or reason..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">Severity:</span>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg text-slate-900 bg-white"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Interventions</option>
            <option value="CAUTION">Caution / Overdue</option>
            <option value="SUCCESS">Success / Delivered</option>
            <option value="INFO">Info / Dispatched</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-3 w-10"></th>
                <th className="p-3">Simulated Time</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Event Type</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Reason & Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No operational events matching filters.
                  </td>
                </tr>
              ) : (
                filteredEvents.map(evt => {
                  const isExpanded = expandedId === evt.id;
                  return (
                    <React.Fragment key={evt.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="p-3 text-slate-400">
                          {evt.metadata ? (
                            isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                          ) : null}
                        </td>
                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="p-3">
                          {getSeverityBadge(evt.severity)}
                        </td>
                        <td className="p-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {evt.entityId}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                          {evt.eventType}
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                          {evt.trigger}
                        </td>
                        <td className="p-3 text-slate-700 font-normal">
                          {evt.reason}
                          {evt.affectedQuantity && (
                            <span className="ml-1.5 font-mono font-semibold text-teal-800">
                              ({evt.affectedQuantity} units)
                            </span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && evt.metadata && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="p-3.5 pl-10 border-t border-slate-100 font-mono text-[11px]">
                            <div className="text-slate-500 font-semibold mb-1">
                              Event Metadata Payload:
                            </div>
                            <pre className="bg-slate-900 text-teal-300 p-2.5 rounded overflow-x-auto">
                              {JSON.stringify(evt.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
