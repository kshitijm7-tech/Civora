import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/database.js';
import { ClockService } from '../services/clock.service.js';
import { EventLogService } from '../services/event-log.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { RescueService } from '../services/rescue.service.js';
import { SeedService } from '../services/seed.service.js';
import type { DashboardSummary, AidBatch } from '../../shared/types.js';

export const apiRouter = Router();

// Ensure seeded on first request if empty
function ensureSeeded() {
  const batches = DispatchService.getAllBatches();
  if (batches.length === 0) {
    SeedService.resetDemo();
  }
}

// GET /api/health
apiRouter.get('/health', (req: Request, res: Response) => {
  ensureSeeded();
  res.json({
    status: 'ok',
    app: 'Civora — Resilient Aid Logistics',
    simulatedNow: ClockService.getNowIso(),
    database: 'sqlite-connected',
  });
});

// GET /api/dashboard
apiRouter.get('/dashboard', (req: Request, res: Response) => {
  ensureSeeded();
  const simulatedTime = ClockService.getNowIso();
  const batches = DispatchService.getAllBatches();
  const assignments = DispatchService.getAllAssignments();
  const shelters = DispatchService.getAllShelters();
  const riders = DispatchService.getAllRiders();

  // Trigger timeout check automatically on dashboard poll
  RescueService.processReservationTimeouts();

  let totalPerishableUnits = 0;
  let unassignedUnits = 0;
  let reservedUnits = 0;
  let inTransitUnits = 0;
  let deliveredUnits = 0;
  let interventionUnits = 0;

  for (const b of batches) {
    totalPerishableUnits += b.totalQuantity;
    const ledger = DispatchService.getBatchLedger(b.id);
    unassignedUnits += ledger.unassignedQty;
    reservedUnits += ledger.reservedQty;
    inTransitUnits += ledger.inTransitQty;
    deliveredUnits += ledger.deliveredQty;
    interventionUnits += ledger.interventionQty;
  }

  // Rescue Queue: assignments that are at-risk, in-transit, or intervention required
  const rescueQueue = assignments
    .filter(a => a.status === 'INTERVENTION_REQUIRED' || a.status === 'IN_TRANSIT' || a.status === 'RESERVED' || a.status === 'ACKNOWLEDGED' || a.status === 'PICKED_UP')
    .sort((a, b) => {
      // Urgent intervention first, then earliest deadline
      if (a.status === 'INTERVENTION_REQUIRED' && b.status !== 'INTERVENTION_REQUIRED') return -1;
      if (b.status === 'INTERVENTION_REQUIRED' && a.status !== 'INTERVENTION_REQUIRED') return 1;
      return new Date(a.safeUseDeadline).getTime() - new Date(b.safeUseDeadline).getTime();
    });

  const criticalAlerts: DashboardSummary['criticalAlerts'] = [];
  for (const a of assignments) {
    if (a.status === 'INTERVENTION_REQUIRED') {
      criticalAlerts.push({
        id: 'ALERT-' + a.id,
        assignmentId: a.id,
        title: `Intervention Needed: Shipment ${a.id}`,
        message: a.interventionReason || `No safe candidate reachable before safe-use deadline.`,
        severity: 'CRITICAL',
        timestamp: a.updatedAt,
      });
    } else {
      const minutesRemaining = ClockService.minutesDiff(a.safeUseDeadline, simulatedTime);
      if (minutesRemaining < 20 && a.status !== 'DELIVERED' && a.status !== 'EXPIRED' && a.status !== 'CANCELLED') {
        criticalAlerts.push({
          id: 'ALERT-WARN-' + a.id,
          assignmentId: a.id,
          title: `Tight Safe Window: Shipment ${a.id}`,
          message: `Only ${minutesRemaining} mins left before safe-use deadline (${a.quantity} ${a.unit} to ${a.shelterName}).`,
          severity: 'CAUTION',
          timestamp: simulatedTime,
        });
      }
    }
  }

  const activeShipmentsCount = assignments.filter(a => a.status === 'IN_TRANSIT' || a.status === 'PICKED_UP' || a.status === 'RESERVED' || a.status === 'ACKNOWLEDGED').length;
  const deliveredTodayCount = assignments.filter(a => a.status === 'DELIVERED').length;
  const interventionRequiredCount = assignments.filter(a => a.status === 'INTERVENTION_REQUIRED').length;

  const totalDemand = shelters.reduce((acc, s) => {
    if (!s.active) return acc;
    return acc + Object.values(s.demandByCategory).reduce((sum, val) => sum + val, 0);
  }, 0);

  const summary: DashboardSummary = {
    simulatedTime,
    batchesCount: batches.length,
    activeShipmentsCount,
    deliveredTodayCount,
    interventionRequiredCount,
    rescueQueue,
    ledgerSummary: {
      totalPerishableUnits,
      unassignedUnits,
      reservedUnits,
      inTransitUnits,
      deliveredUnits,
      interventionUnits,
    },
    riders: {
      total: riders.length,
      available: riders.filter(r => r.available && r.status === 'IDLE').length,
      inTransit: riders.filter(r => r.status === 'IN_TRANSIT').length,
    },
    shelters: {
      total: shelters.length,
      active: shelters.filter(s => s.active).length,
      totalRemainingDemand: totalDemand,
    },
    criticalAlerts,
  };

  res.json(summary);
});

// GET /api/batches
apiRouter.get('/batches', (req: Request, res: Response) => {
  ensureSeeded();
  const batches = DispatchService.getAllBatches();
  const batchesWithLedger = batches.map(b => ({
    ...b,
    ledger: DispatchService.getBatchLedger(b.id),
  }));
  res.json(batchesWithLedger);
});

// POST /api/batches
apiRouter.post('/batches', (req: Request, res: Response) => {
  ensureSeeded();
  const db = getDatabase();
  const nowIso = ClockService.getNowIso();
  const { donorName, category, totalQuantity, unit, origin, safeUseDeadline, handlingRequirements, notes } = req.body;

  if (!donorName || !category || !totalQuantity || !safeUseDeadline) {
    return res.status(400).json({ error: 'Missing required fields: donorName, category, totalQuantity, safeUseDeadline' });
  }

  const id = 'BATCH-' + Date.now().toString().slice(-6);
  const defaultOrigin = origin || { name: donorName, address: 'Civic Area', x: 50, y: 50 };

  db.prepare(`
    INSERT INTO batches (id, donor_name, category, total_quantity, unit, origin_json, safe_use_deadline, handling_requirements_json, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    donorName,
    category,
    Number(totalQuantity),
    unit || 'meals',
    JSON.stringify(defaultOrigin),
    safeUseDeadline,
    JSON.stringify(handlingRequirements || []),
    'AVAILABLE',
    notes || '',
    nowIso
  );

  EventLogService.record({
    entityType: 'BATCH',
    entityId: id,
    eventType: 'BATCH_OFFERED',
    severity: 'INFO',
    trigger: 'DONOR_INPUT',
    reason: `New batch ${id} created by ${donorName}: ${totalQuantity} ${unit || 'meals'} of ${category}. Safe deadline: ${safeUseDeadline}.`,
    affectedQuantity: Number(totalQuantity),
  });

  const created = DispatchService.getBatch(id);
  res.status(201).json(created);
});

// GET /api/batches/:id
apiRouter.get('/batches/:id', (req: Request, res: Response) => {
  const batch = DispatchService.getBatch(req.params.id);
  if (!batch) return res.status(404).json({ error: 'Batch not found' });
  const ledger = DispatchService.getBatchLedger(batch.id);
  res.json({ ...batch, ledger });
});

// GET /api/shelters
apiRouter.get('/shelters', (req: Request, res: Response) => {
  ensureSeeded();
  res.json(DispatchService.getAllShelters());
});

// PATCH /api/shelters/:id
apiRouter.patch('/shelters/:id', (req: Request, res: Response) => {
  const shelterId = req.params.id;
  const { active, demandByCategory } = req.body;
  const existing = DispatchService.getShelter(shelterId);
  if (!existing) return res.status(404).json({ error: 'Shelter not found' });

  const newActive = active !== undefined ? Boolean(active) : existing.active;
  const newDemand = demandByCategory || existing.demandByCategory;

  RescueService.handleShelterDisruption(shelterId, newActive, newDemand);
  res.json(DispatchService.getShelter(shelterId));
});

// GET /api/riders
apiRouter.get('/riders', (req: Request, res: Response) => {
  ensureSeeded();
  res.json(DispatchService.getAllRiders());
});

// PATCH /api/riders/:id
apiRouter.patch('/riders/:id', (req: Request, res: Response) => {
  const riderId = req.params.id;
  const { available, status } = req.body;
  const db = getDatabase();
  const rider = DispatchService.getRider(riderId);
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  const nowIso = ClockService.getNowIso();
  const newAvail = available !== undefined ? (available ? 1 : 0) : (rider.available ? 1 : 0);
  const newStatus = status || rider.status;

  db.prepare('UPDATE riders SET available = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(newAvail, newStatus, nowIso, riderId);

  EventLogService.record({
    entityType: 'RIDER',
    entityId: riderId,
    eventType: 'RIDER_STATUS_CHANGED',
    severity: 'INFO',
    trigger: 'DISPATCH_MONITOR',
    reason: `Rider ${rider.name} status updated: available=${newAvail}, status=${newStatus}.`,
  });

  res.json(DispatchService.getRider(riderId));
});

// GET /api/assignments
apiRouter.get('/assignments', (req: Request, res: Response) => {
  ensureSeeded();
  res.json(DispatchService.getAllAssignments());
});

// GET /api/assignments/:id
apiRouter.get('/assignments/:id', (req: Request, res: Response) => {
  const a = DispatchService.getAssignment(req.params.id);
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  res.json(a);
});

// POST /api/dispatch/preview
apiRouter.post('/dispatch/preview', (req: Request, res: Response) => {
  ensureSeeded();
  const { batchId } = req.body;
  if (!batchId) return res.status(400).json({ error: 'batchId required' });

  try {
    const preview = DispatchService.previewDispatch(batchId);
    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/dispatch/confirm
apiRouter.post('/dispatch/confirm', (req: Request, res: Response) => {
  ensureSeeded();
  const { batchId, allocations } = req.body;
  if (!batchId) return res.status(400).json({ error: 'batchId required' });

  try {
    const assignments = DispatchService.confirmDispatch(batchId, allocations);
    res.json({
      success: true,
      message: `Created ${assignments.length} dispatch assignment(s).`,
      assignments,
      ledger: DispatchService.getBatchLedger(batchId),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/acknowledge
apiRouter.post('/assignments/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const updated = RescueService.acknowledgeReservation(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/pickup
apiRouter.post('/assignments/:id/pickup', (req: Request, res: Response) => {
  try {
    const updated = RescueService.pickupCargo(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/transit
apiRouter.post('/assignments/:id/transit', (req: Request, res: Response) => {
  try {
    const updated = RescueService.markInTransit(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/assignments/:id/deliver
apiRouter.post('/assignments/:id/deliver', (req: Request, res: Response) => {
  try {
    const updated = RescueService.completeDelivery(req.params.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rescue/:shipmentId/evaluate
apiRouter.post('/rescue/:shipmentId/evaluate', (req: Request, res: Response) => {
  try {
    const evaluation = RescueService.evaluateRescue(req.params.shipmentId);
    res.json(evaluation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/rescue/:shipmentId/execute
apiRouter.post('/rescue/:shipmentId/execute', (req: Request, res: Response) => {
  const { targetShelterId, force } = req.body;
  try {
    const updated = RescueService.executeRescue(req.params.shipmentId, targetShelterId, force === true);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/simulation/advance
apiRouter.post('/simulation/advance', (req: Request, res: Response) => {
  const minutes = Number(req.body.minutes) || 15;
  const newTime = ClockService.advanceMinutes(minutes);
  const timeoutResult = RescueService.processReservationTimeouts();

  EventLogService.record({
    entityType: 'SIMULATION',
    entityId: 'CLOCK',
    eventType: 'TIME_ADVANCED',
    severity: 'INFO',
    trigger: 'SIMULATION_CONTROLLER',
    reason: `Advanced simulation time by +${minutes} mins to ${newTime}. Checked leases: ${timeoutResult.expiredCount} expired.`,
  });

  res.json({
    simulatedNow: newTime,
    advancedMinutes: minutes,
    timeoutResult,
  });
});

// POST /api/simulation/scenario/:name
apiRouter.post('/simulation/scenario/:name', (req: Request, res: Response) => {
  try {
    const result = SeedService.runScenario(req.params.name);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/simulation/reset
apiRouter.post('/simulation/reset', (req: Request, res: Response) => {
  try {
    SeedService.resetDemo();
    res.json({
      success: true,
      message: 'Restored pristine demonstration state.',
      simulatedNow: ClockService.getNowIso(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events
apiRouter.get('/events', (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 100;
  const entityId = req.query.entityId as string | undefined;
  const events = EventLogService.getRecent(limit, entityId);
  res.json(events);
});
