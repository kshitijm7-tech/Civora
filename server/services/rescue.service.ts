import { getDatabase } from '../db/database.js';
import { ClockService } from './clock.service.js';
import { EventLogService } from './event-log.service.js';
import { DispatchService, calculateTravelMinutes } from './dispatch.service.js';
import type { 
  Assignment, 
  FallbackCandidate, 
  RescueEvaluationResult,
  Shelter 
} from '../../shared/types.js';

export class RescueService {
  /**
   * Rider acknowledges reservation before lease expires.
   */
  static acknowledgeReservation(assignmentId: string): Assignment {
    const db = getDatabase();
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status !== 'RESERVED') {
      throw new Error(`Cannot acknowledge assignment in status: ${assignment.status}`);
    }

    const nowIso = ClockService.getNowIso();
    // Check lease deadline
    if (new Date(nowIso).getTime() > new Date(assignment.leaseDeadline).getTime()) {
      // Lease has already expired! Run timeout processor
      this.processReservationTimeouts();
      throw new Error(`Reservation lease expired at ${assignment.leaseDeadline}. Stock has been released.`);
    }

    db.prepare(`
      UPDATE assignments 
      SET status = 'ACKNOWLEDGED', acknowledged_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nowIso, nowIso, assignmentId);

    EventLogService.record({
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      eventType: 'RESERVATION_ACKNOWLEDGED',
      severity: 'INFO',
      trigger: 'RIDER_ACTION',
      reason: `Rider ${assignment.riderName} acknowledged reservation of ${assignment.quantity} ${assignment.unit} to ${assignment.shelterName}.`,
      affectedQuantity: assignment.quantity,
    });

    return DispatchService.getAssignment(assignmentId)!;
  }

  /**
   * Rider confirms physical cargo pickup at donor.
   */
  static pickupCargo(assignmentId: string): Assignment {
    const db = getDatabase();
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status !== 'RESERVED' && assignment.status !== 'ACKNOWLEDGED') {
      throw new Error(`Cannot pick up cargo in status: ${assignment.status}`);
    }

    const nowIso = ClockService.getNowIso();

    db.prepare(`
      UPDATE assignments 
      SET status = 'PICKED_UP', custody = 'RIDER_CUSTODY', picked_up_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nowIso, nowIso, assignmentId);

    db.prepare(`
      UPDATE riders SET status = 'IN_TRANSIT', updated_at = ? WHERE id = ?
    `).run(nowIso, assignment.riderId);

    EventLogService.record({
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      eventType: 'CARGO_PICKED_UP',
      severity: 'SUCCESS',
      trigger: 'PHYSICAL_PICKUP',
      reason: `Cargo custody transferred from Donor (${assignment.batchName}) to Rider ${assignment.riderName}. Custody: RIDER_CUSTODY.`,
      affectedQuantity: assignment.quantity,
    });

    return DispatchService.getAssignment(assignmentId)!;
  }

  /**
   * Mark shipment in transit towards destination shelter.
   */
  static markInTransit(assignmentId: string): Assignment {
    const db = getDatabase();
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status !== 'PICKED_UP' && assignment.status !== 'ACKNOWLEDGED') {
      throw new Error(`Cannot start transit from status: ${assignment.status}`);
    }

    const nowIso = ClockService.getNowIso();

    // Live revalidate destination shelter before departure
    const destinationShelter = DispatchService.getShelter(assignment.shelterId);
    if (!destinationShelter || !destinationShelter.active) {
      // Destination closed! Trigger recovery immediately
      return this.handleInTransitDisruption(assignmentId, 'Destination shelter closed before departure.');
    }

    db.prepare(`
      UPDATE assignments 
      SET status = 'IN_TRANSIT', custody = 'RIDER_CUSTODY', in_transit_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nowIso, nowIso, assignmentId);

    db.prepare(`
      UPDATE riders SET status = 'IN_TRANSIT', updated_at = ? WHERE id = ?
    `).run(nowIso, assignment.riderId);

    EventLogService.record({
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      eventType: 'TRANSIT_DEPARTED',
      severity: 'INFO',
      trigger: 'DISPATCH_TRACKER',
      reason: `Rider ${assignment.riderName} departed towards ${assignment.shelterName}. Estimated travel: ${assignment.estimatedTravelMinutes} mins.`,
      affectedQuantity: assignment.quantity,
    });

    return DispatchService.getAssignment(assignmentId)!;
  }

  /**
   * Complete delivery at shelter.
   */
  static completeDelivery(assignmentId: string): Assignment {
    const db = getDatabase();
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    if (assignment.status !== 'IN_TRANSIT' && assignment.status !== 'PICKED_UP') {
      throw new Error(`Cannot deliver cargo in status: ${assignment.status}`);
    }

    const shelter = DispatchService.getShelter(assignment.shelterId);
    if (!shelter || !shelter.active) {
      // Shelter is closed! Do NOT deliver!
      return this.handleInTransitDisruption(assignmentId, `Shelter ${assignment.shelterName} is closed. Delivery rejected.`);
    }

    const nowIso = ClockService.getNowIso();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE assignments 
        SET status = 'DELIVERED', custody = 'DELIVERED_TO_SHELTER', delivered_at = ?, updated_at = ?
        WHERE id = ?
      `).run(nowIso, nowIso, assignmentId);

      // Free rider capacity
      db.prepare(`
        UPDATE riders 
        SET current_load = MAX(0, current_load - ?),
            status = CASE WHEN current_load - ? <= 0 THEN 'IDLE' ELSE 'IN_TRANSIT' END,
            updated_at = ?
        WHERE id = ?
      `).run(assignment.quantity, assignment.quantity, nowIso, assignment.riderId);

      // Increase shelter occupancy
      db.prepare(`
        UPDATE shelters 
        SET current_occupancy = current_occupancy + ?, updated_at = ?
        WHERE id = ?
      `).run(assignment.quantity, nowIso, shelter.id);

      // Check if entire batch is completed
      const ledger = DispatchService.getBatchLedger(assignment.batchId);
      if (ledger.unassignedQty === 0 && ledger.reservedQty === 0 && ledger.inTransitQty === 0 && ledger.interventionQty === 0) {
        db.prepare('UPDATE batches SET status = ? WHERE id = ?').run('COMPLETED', assignment.batchId);
      }

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    EventLogService.record({
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      eventType: 'DELIVERY_CONFIRMED',
      severity: 'SUCCESS',
      trigger: 'SHELTER_RECEIPT',
      reason: `Successfully delivered and verified ${assignment.quantity} ${assignment.unit} to ${assignment.shelterName}. Cargo custody: DELIVERED_TO_SHELTER.`,
      affectedQuantity: assignment.quantity,
    });

    return DispatchService.getAssignment(assignmentId)!;
  }

  /**
   * Timeout Processor: Checks overdue reservation leases and releases stock exactly once.
   */
  static processReservationTimeouts(): { expiredCount: number; releasedQuantity: number } {
    const db = getDatabase();
    const nowIso = ClockService.getNowIso();

    // Query active unacknowledged reservations past lease deadline
    const overdueRows = db.prepare(`
      SELECT * FROM assignments 
      WHERE status = 'RESERVED' AND lease_deadline < ?
    `).all(nowIso) as any[];

    if (overdueRows.length === 0) {
      return { expiredCount: 0, releasedQuantity: 0 };
    }

    let expiredCount = 0;
    let releasedQuantity = 0;

    for (const r of overdueRows) {
      const assignmentId = r.id;
      const quantity = r.quantity;
      const riderId = r.rider_id;
      const shelterId = r.shelter_id;
      const category = r.category;
      const batchId = r.batch_id;

      // CRITICAL SAFETY RULE: Never expire cargo that was already physically picked up!
      if (r.custody !== 'AT_DONOR') {
        continue;
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        // Mark assignment as EXPIRED
        db.prepare(`
          UPDATE assignments 
          SET status = 'EXPIRED', updated_at = ?, rejection_reason = 'Reservation lease expired without acknowledgement (ghost reservation).'
          WHERE id = ?
        `).run(nowIso, assignmentId);

        // Release rider capacity
        db.prepare(`
          UPDATE riders 
          SET current_load = MAX(0, current_load - ?),
              status = CASE WHEN current_load - ? <= 0 THEN 'IDLE' ELSE status END,
              updated_at = ?
          WHERE id = ?
        `).run(quantity, quantity, nowIso, riderId);

        // Release shelter reserved demand back
        const shelterRow = db.prepare('SELECT demand_by_category_json FROM shelters WHERE id = ?').get(shelterId) as any;
        if (shelterRow) {
          const demandObj = JSON.parse(shelterRow.demand_by_category_json || '{}');
          demandObj[category] = (demandObj[category] || 0) + quantity;
          db.prepare('UPDATE shelters SET demand_by_category_json = ?, updated_at = ? WHERE id = ?')
            .run(JSON.stringify(demandObj), nowIso, shelterId);
        }

        // Update batch status if needed
        const ledger = DispatchService.getBatchLedger(batchId);
        const batchStatus = ledger.unassignedQty > 0 ? 'PARTIALLY_DISPATCHED' : 'AVAILABLE';
        db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(batchStatus, batchId);

        db.exec('COMMIT;');

        expiredCount++;
        releasedQuantity += quantity;

        EventLogService.record({
          entityType: 'ASSIGNMENT',
          entityId: assignmentId,
          eventType: 'LEASE_EXPIRED_RELEASED',
          severity: 'CAUTION',
          trigger: 'LEASE_TIMEOUT_PROCESSOR',
          reason: `Ghost reservation expired for Assignment ${assignmentId}. Released ${quantity} units back to available pool. Capacity restored for Rider ${r.rider_name}.`,
          affectedQuantity: quantity,
          metadata: {
            leaseDeadline: r.lease_deadline,
            simulatedNow: nowIso,
            releasedBackToBatch: batchId,
          },
        });
      } catch (err) {
        db.exec('ROLLBACK;');
        console.error(`Failed to process timeout for ${assignmentId}:`, err);
      }
    }

    return { expiredCount, releasedQuantity };
  }

  /**
   * Handle shelter closure or demand reduction.
   */
  static handleShelterDisruption(shelterId: string, newActive: boolean, newDemand?: Record<string, number>): void {
    const db = getDatabase();
    const shelter = DispatchService.getShelter(shelterId);
    if (!shelter) return;

    const nowIso = ClockService.getNowIso();

    // Update shelter status
    db.prepare(`
      UPDATE shelters 
      SET active = ?, demand_by_category_json = COALESCE(?, demand_by_category_json), updated_at = ?
      WHERE id = ?
    `).run(newActive ? 1 : 0, newDemand ? JSON.stringify(newDemand) : null, nowIso, shelterId);

    EventLogService.record({
      entityType: 'SHELTER',
      entityId: shelterId,
      eventType: newActive ? 'SHELTER_DEMAND_UPDATED' : 'SHELTER_CLOSED',
      severity: newActive ? 'INFO' : 'CRITICAL',
      trigger: 'NETWORK_COORDINATOR',
      reason: newActive 
        ? `Shelter ${shelter.name} demand adjusted.` 
        : `Shelter ${shelter.name} has been CLOSED. Emergency revalidation triggered for all incoming shipments.`,
    });

    // Find incoming assignments
    const incoming = db.prepare(`
      SELECT id, status, custody FROM assignments 
      WHERE shelter_id = ? AND status IN ('RESERVED', 'ACKNOWLEDGED', 'PICKED_UP', 'IN_TRANSIT')
    `).all(shelterId) as any[];

    for (const inc of incoming) {
      if (inc.status === 'RESERVED' || inc.status === 'ACKNOWLEDGED') {
        // Cargo still at donor! Cancel reservation cleanly and return stock to batch pool
        this.cancelReservation(inc.id, `Shelter ${shelter.name} became unavailable before cargo was picked up.`);
      } else {
        // Cargo in transit / rider custody: Must rescue or request intervention
        this.handleInTransitDisruption(inc.id, `Shelter ${shelter.name} closed while ${inc.quantity || 'cargo'} was in transit.`);
      }
    }
  }

  /**
   * Evaluates live recovery options for an assignment without mutating.
   */
  static evaluateRescue(assignmentId: string): RescueEvaluationResult {
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment ${assignmentId} not found`);
    }

    const batch = DispatchService.getBatch(assignment.batchId);
    const simulatedNow = ClockService.getNowIso();
    const minutesToSafeDeadline = ClockService.minutesDiff(assignment.safeUseDeadline, simulatedNow);

    const shelters = DispatchService.getAllShelters().filter(s => s.id !== assignment.shelterId);
    const candidateResults: FallbackCandidate[] = [];

    // Current location: if in transit, approximate mid-point or rider location; if at donor, batch origin
    const currentLocation = assignment.custody === 'RIDER_CUSTODY'
      ? {
          name: `In Transit near ${assignment.shelterName}`,
          address: 'En route coordinates',
          x: (assignment.origin.x + assignment.destination.x) / 2,
          y: (assignment.origin.y + assignment.destination.y) / 2,
        }
      : assignment.origin;

    for (const s of shelters) {
      const travelMins = calculateTravelMinutes(currentLocation, s.location);
      const safetyMargin = 10;
      const totalArrivalMinutes = travelMins + safetyMargin;

      const remainingDemand = s.demandByCategory[assignment.category] || 0;
      const missingResources: string[] = [];

      let feasible = true;
      let rejectionReason = '';

      if (!s.active) {
        feasible = false;
        rejectionReason = 'Shelter closed';
      } else if (remainingDemand < assignment.quantity) {
        feasible = false;
        rejectionReason = `Insufficient demand (${remainingDemand} available, need ${assignment.quantity})`;
      } else {
        // Resource requirements
        if (batch) {
          for (const req of batch.handlingRequirements) {
            if (req === 'CLEAN_WATER_AT_DESTINATION' && !s.resources.includes('CLEAN_WATER')) {
              feasible = false;
              missingResources.push('CLEAN_WATER');
              rejectionReason = 'Lacks required resource: CLEAN_WATER';
            }
            if (req === 'COOKING_FUEL_AT_DESTINATION' && !s.resources.includes('COOKING_FUEL')) {
              feasible = false;
              missingResources.push('COOKING_FUEL');
              rejectionReason = 'Lacks required resource: COOKING_FUEL';
            }
          }
        }

        // Safe-use deadline
        if (feasible && totalArrivalMinutes > minutesToSafeDeadline) {
          feasible = false;
          rejectionReason = `Cannot arrive before deadline: ETA (${travelMins}m + 10m margin = ${totalArrivalMinutes}m) exceeds remaining safe window (${minutesToSafeDeadline}m).`;
        }
      }

      const score = feasible
        ? Math.round(remainingDemand * 0.5 + (s.priority === 'CRITICAL' ? 40 : 20) - travelMins * 1.5)
        : -100;

      candidateResults.push({
        shelterId: s.id,
        shelterName: s.name,
        estimatedMinutes: travelMins,
        feasible,
        score,
        rejectionReason: rejectionReason || undefined,
        remainingDemand,
        missingResources,
      });
    }

    candidateResults.sort((a, b) => b.score - a.score);
    const bestFeasible = candidateResults.find(c => c.feasible);

    return {
      assignmentId,
      currentStatus: assignment.status,
      custody: assignment.custody,
      quantity: assignment.quantity,
      safeUseDeadline: assignment.safeUseDeadline,
      minutesRemainingToDeadline: minutesToSafeDeadline,
      candidates: candidateResults,
      bestFeasibleCandidate: bestFeasible,
      canAutoRecover: Boolean(bestFeasible),
      recommendation: bestFeasible
        ? `Safe fallback verified: Reroute ${assignment.quantity} ${assignment.unit} to ${bestFeasible.shelterName} (ETA: ${bestFeasible.estimatedMinutes}m, demand: ${bestFeasible.remainingDemand}).`
        : `NO SAFE RECOVERY OPTION: All alternative shelters either lack required resources, have insufficient demand, or cannot be reached before safe-use deadline (${minutesToSafeDeadline}m remaining). Critical human intervention required.`,
    };
  }

  /**
   * Executes recovery: reroutes to a feasible alternative shelter or transitions to INTERVENTION_REQUIRED.
   * When force is true, operator override allows rerouting to any active shelter even if strict feasibility gates fail.
   */
  static executeRescue(assignmentId: string, targetShelterId?: string, force = false): Assignment {
    const db = getDatabase();
    const evaluation = this.evaluateRescue(assignmentId);
    const assignment = DispatchService.getAssignment(assignmentId)!;
    const nowIso = ClockService.getNowIso();

    const chosenCandidate = targetShelterId
      ? evaluation.candidates.find(c => c.shelterId === targetShelterId)
      : evaluation.bestFeasibleCandidate;

    // Operator override: bypass strict feasibility when no safe candidate exists
    if (!chosenCandidate || (!chosenCandidate.feasible && !force)) {
      // No safe option or target is infeasible -> MUST trigger intervention!
      const reason = chosenCandidate?.rejectionReason || evaluation.recommendation;
      db.prepare(`
        UPDATE assignments 
        SET status = 'INTERVENTION_REQUIRED', 
            custody = 'INTERVENTION_HELD',
            intervention_reason = ?,
            updated_at = ?
        WHERE id = ?
      `).run(reason, nowIso, assignmentId);

      EventLogService.record({
        entityType: 'ASSIGNMENT',
        entityId: assignmentId,
        eventType: 'INTERVENTION_RAISED',
        severity: 'CRITICAL',
        trigger: 'RESCUE_PROTOCOL_SAFETY_GATE',
        reason: `CRITICAL SAFETY INTERVENTION: Shipment ${assignmentId} has no feasible alternative destination. ${reason}. Operator intervention requested.`,
        affectedQuantity: assignment.quantity,
        metadata: {
          originalShelter: assignment.shelterName,
          safeUseDeadline: assignment.safeUseDeadline,
          minutesRemaining: evaluation.minutesRemainingToDeadline,
        },
      });

      return DispatchService.getAssignment(assignmentId)!;
    }

    // Force override path: target may be infeasible by strict rules but operator authorizes reroute
    let chosenShelter: Shelter;
    let finalTravelMinutes: number;
    let finalScore: number;

    if (force && chosenCandidate && !chosenCandidate.feasible) {
      const shelter = DispatchService.getShelter(chosenCandidate.shelterId);
      if (!shelter || !shelter.active) {
        throw new Error(`Cannot force-reroute: shelter ${chosenCandidate.shelterId} is not active.`);
      }
      chosenShelter = shelter;
      finalTravelMinutes = chosenCandidate.estimatedMinutes;
      finalScore = chosenCandidate.score;
    } else if (chosenCandidate) {
      chosenShelter = DispatchService.getShelter(chosenCandidate.shelterId)!;
      finalTravelMinutes = chosenCandidate.estimatedMinutes;
      finalScore = chosenCandidate.score;
    } else {
      throw new Error(`No target shelter available for rescue of ${assignmentId}.`);
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // Update destination on assignment
      db.prepare(`
        UPDATE assignments 
        SET shelter_id = ?, shelter_name = ?,
            destination_json = ?,
            estimated_travel_minutes = ?,
            status = 'IN_TRANSIT',
            updated_at = ?
        WHERE id = ?
      `).run(
        chosenShelter.id,
        chosenShelter.name,
        JSON.stringify(chosenShelter.location),
        finalTravelMinutes,
        nowIso,
        assignmentId
      );

      // Deduct demand from new shelter (allow going negative on force override to reflect operator decision)
      const newShelterDemand = { ...chosenShelter.demandByCategory };
      newShelterDemand[assignment.category] = Math.max(0, (newShelterDemand[assignment.category] || 0) - assignment.quantity);
      db.prepare('UPDATE shelters SET demand_by_category_json = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(newShelterDemand), nowIso, chosenShelter.id);

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    EventLogService.record({
      entityType: 'ASSIGNMENT',
      entityId: assignmentId,
      eventType: force ? 'SHIPMENT_FORCE_REROUTED' : 'SHIPMENT_REROUTED',
      severity: force ? 'CAUTION' : 'SUCCESS',
      trigger: force ? 'OPERATOR_FORCE_OVERRIDE' : 'RESCUE_PROTOCOL_AUTO_RECOVERY',
      reason: force
        ? `OPERATOR FORCE OVERRIDE: Rerouted in-transit cargo (${assignment.quantity} ${assignment.unit}) from ${assignment.shelterName} to ${chosenShelter.name} despite feasibility gate (${chosenCandidate?.rejectionReason || 'strict rules failed'}). ETA: ${finalTravelMinutes}m.`
        : `Successfully rerouted in-transit cargo (${assignment.quantity} ${assignment.unit}) from ${assignment.shelterName} to ${chosenShelter.name}. ETA: ${finalTravelMinutes}m. Safe-use window preserved.`,
      affectedQuantity: assignment.quantity,
      metadata: {
        previousShelter: assignment.shelterName,
        newShelter: chosenShelter.name,
        estimatedTravelMinutes: finalTravelMinutes,
        forceOverride: force,
      },
    });

    return DispatchService.getAssignment(assignmentId)!;
  }

  /**
   * Internal handler when in-transit disruption occurs
   */
  private static handleInTransitDisruption(assignmentId: string, triggerReason: string): Assignment {
    const evaluation = this.evaluateRescue(assignmentId);
    if (evaluation.canAutoRecover && evaluation.bestFeasibleCandidate) {
      return this.executeRescue(assignmentId, evaluation.bestFeasibleCandidate.shelterId);
    } else {
      return this.executeRescue(assignmentId);
    }
  }

  /**
   * Cancel unpicked reservation cleanly
   */
  private static cancelReservation(assignmentId: string, reason: string): void {
    const db = getDatabase();
    const assignment = DispatchService.getAssignment(assignmentId);
    if (!assignment) return;

    const nowIso = ClockService.getNowIso();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE assignments 
        SET status = 'CANCELLED', updated_at = ?, rejection_reason = ?
        WHERE id = ?
      `).run(nowIso, reason, assignmentId);

      // Free rider load
      db.prepare(`
        UPDATE riders 
        SET current_load = MAX(0, current_load - ?),
            status = CASE WHEN current_load - ? <= 0 THEN 'IDLE' ELSE status END,
            updated_at = ?
        WHERE id = ?
      `).run(assignment.quantity, assignment.quantity, nowIso, assignment.riderId);

      // Reconcile batch
      const ledger = DispatchService.getBatchLedger(assignment.batchId);
      const batchStatus = ledger.unassignedQty > 0 ? 'PARTIALLY_DISPATCHED' : 'AVAILABLE';
      db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(batchStatus, assignment.batchId);

      db.exec('COMMIT;');

      EventLogService.record({
        entityType: 'ASSIGNMENT',
        entityId: assignmentId,
        eventType: 'RESERVATION_CANCELLED',
        severity: 'CAUTION',
        trigger: 'SHELTER_DISRUPTION',
        reason: `Cancelled unpicked reservation for Assignment ${assignmentId}: ${reason}. Stock returned to available batch pool.`,
        affectedQuantity: assignment.quantity,
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}
