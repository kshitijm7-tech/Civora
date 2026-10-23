import type {
  DashboardSummary,
  AidBatch,
  Shelter,
  Rider,
  Assignment,
  DispatchPlanPreview,
  RescueEvaluationResult,
  OperationalEvent,
} from '../../shared/types.js';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  getDashboard: () => fetchApi<DashboardSummary>('/dashboard'),
  
  getBatches: () => fetchApi<(AidBatch & { ledger: any })[]>('/batches'),
  getBatch: (id: string) => fetchApi<AidBatch & { ledger: any }>(`/batches/${id}`),
  createBatch: (data: Partial<AidBatch>) =>
    fetchApi<AidBatch>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getShelters: () => fetchApi<Shelter[]>('/shelters'),
  updateShelter: (id: string, data: { active?: boolean; demandByCategory?: Record<string, number> }) =>
    fetchApi<Shelter>(`/shelters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getRiders: () => fetchApi<Rider[]>('/riders'),
  updateRider: (id: string, data: { available?: boolean; status?: string }) =>
    fetchApi<Rider>(`/riders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getAssignments: () => fetchApi<Assignment[]>('/assignments'),
  getAssignment: (id: string) => fetchApi<Assignment>(`/assignments/${id}`),

  previewDispatch: (batchId: string) =>
    fetchApi<DispatchPlanPreview>('/dispatch/preview', {
      method: 'POST',
      body: JSON.stringify({ batchId }),
    }),

  confirmDispatch: (batchId: string, allocations?: any[]) =>
    fetchApi<{ success: boolean; message: string; assignments: Assignment[]; ledger: any }>('/dispatch/confirm', {
      method: 'POST',
      body: JSON.stringify({ batchId, allocations }),
    }),

  acknowledgeAssignment: (id: string) =>
    fetchApi<Assignment>(`/assignments/${id}/acknowledge`, { method: 'POST' }),

  pickupAssignment: (id: string) =>
    fetchApi<Assignment>(`/assignments/${id}/pickup`, { method: 'POST' }),
  pickupCargo: (id: string) =>
    fetchApi<Assignment>(`/assignments/${id}/pickup`, { method: 'POST' }),

  transitAssignment: (id: string) =>
    fetchApi<Assignment>(`/assignments/${id}/transit`, { method: 'POST' }),

  deliverAssignment: (id: string) =>
    fetchApi<Assignment>(`/assignments/${id}/deliver`, { method: 'POST' }),

  evaluateRescue: (shipmentId: string) =>
    fetchApi<RescueEvaluationResult>(`/rescue/${shipmentId}/evaluate`, { method: 'POST' }),

  executeRescue: (shipmentId: string, targetShelterId?: string) =>
    fetchApi<Assignment>(`/rescue/${shipmentId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ targetShelterId }),
    }),

  advanceSimulation: (minutes: number) =>
    fetchApi<{ simulatedNow: string; advancedMinutes: number; timeoutResult: any }>('/simulation/advance', {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  runJudgeScenario: (name: string) =>
    fetchApi<{ scenario: string; summary: string; assignments: any[] }>(`/simulation/scenario/${name}`, {
      method: 'POST',
    }),

  resetSimulation: () =>
    fetchApi<{ success: boolean; message: string; simulatedNow: string }>('/simulation/reset', {
      method: 'POST',
    }),

  getEvents: (limit: number = 100, entityId?: string) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (entityId) query.append('entityId', entityId);
    return fetchApi<OperationalEvent[]>(`/events?${query.toString()}`);
  },
};
