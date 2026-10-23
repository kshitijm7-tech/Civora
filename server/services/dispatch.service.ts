import { getDatabase } from '../db/database.js';
import { ClockService } from './clock.service.js';
import { EventLogService } from './event-log.service.js';
import type { 
  AidBatch, 
  Shelter, 
  Rider, 
  Assignment, 
  BatchLedger,
  DispatchPlanPreview, 
  DispatchCandidateEvaluation,
  FallbackCandidate,
  LocationCoord
} from '../../shared/types.js';

export function calculateTravelMinutes(from: LocationCoord, to: LocationCoord): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Base 8 minutes + 0.45 min per schematic unit, rounded
  return Math.max(8, Math.round(8 + dist * 0.45));
}

export class DispatchService {
  static getBatch(id: string): AidBatch | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapBatchRow(row);
  }

  static getAllBatches(): AidBatch[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all() as any[];
    return rows.map(r => this.mapBatchRow(r));
  }

  static getShelter(id: string): Shelter | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM shelters WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapShelterRow(row);
  }

  static getAllShelters(): Shelter[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM shelters ORDER BY name ASC').all() as any[];
    return rows.map(r => this.mapShelterRow(r));
  }

  static getRider(id: string): Rider | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM riders WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRiderRow(row);
  }

  static getAllRiders(): Rider[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM riders ORDER BY name ASC').all() as any[];
    return rows.map(r => this.mapRiderRow(r));
  }

  static getAssignment(id: string): Assignment | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapAssignmentRow(row);
  }

  static getAllAssignments(): Assignment[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM assignments ORDER BY created_at DESC').all() as any[];
    return rows.map(r => this.mapAssignmentRow(r));
  }

  static getBatchLedger(batchId: string): BatchLedger {
    const batch = this.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const db = getDatabase();
    const rows = db.prepare('SELECT quantity, status, custody FROM assignments WHERE batch_id = ?').all(batchId) as any[];

    let reservedQty = 0;
    let inTransitQty = 0;
    let deliveredQty = 0;
    let interventionQty = 0;

    for (const r of rows) {
      const q = r.quantity;
      if (r.status === 'INTERVENTION_REQUIRED') {
        interventionQty += q;
      } else if (r.status === 'DELIVERED') {
        deliveredQty += q;
      } else if (r.status === 'PICKED_UP' || r.status === 'IN_TRANSIT') {
        inTransitQty += q;
      } else if (r.status === 'RESERVED' || r.status === 'ACKNOWLEDGED') {
        reservedQty += q;
      }
    }

    const assignedTotal = reservedQty + inTransitQty + deliveredQty + interventionQty;
    const unassignedQty = Math.max(0, batch.totalQuantity - assignedTotal);
    const reconciled = (unassignedQty + reservedQty + inTransitQty + deliveredQty + interventionQty) === batch.totalQuantity;

    return {
      batchId,
      totalQty: batch.totalQuantity,
      unassignedQty,
      reservedQty,
      inTransitQty,
      deliveredQty,
      interventionQty,
      reconciled,
    };
  }

  static previewDispatch(batchId: string): DispatchPlanPreview {
    const batch = this.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const ledger = this.getBatchLedger(batchId);
    let unassignedRemaining = ledger.unassignedQty;
    const simulatedNow = ClockService.getNowIso();
    const minutesToSafeDeadline = ClockService.minutesDiff(batch.safeUseDeadline, simulatedNow);

    const riders = this.getAllRiders();
    const shelters = this.getAllShelters();

    const proposedAllocations: DispatchPlanPreview['proposedAllocations'] = [];
    const rejectedCandidates: DispatchCandidateEvaluation[] = [];

    // Track simulated local consumption during preview
    const riderRemainingCap: Record<string, number> = {};
    for (const r of riders) {
      riderRemainingCap[r.id] = (r.available && r.status !== 'OFFLINE') ? Math.max(0, r.capacity - r.currentLoad) : 0;
    }

    const shelterRemainingDemand: Record<string, number> = {};
    for (const s of shelters) {
      shelterRemainingDemand[s.id] = s.active ? (s.demandByCategory[batch.category] || 0) : 0;
    }

    // Check batch deadline
    if (minutesToSafeDeadline <= 0) {
      return {
        batchId,
        batchCategory: batch.category,
        totalBatchQty: batch.totalQuantity,
        unassignedBefore: ledger.unassignedQty,
        proposedAllocations: [],
        rejectedCandidates: [{
          riderId: 'ALL',
          riderName: 'All Riders',
          riderCapacity: 0,
          riderAvailableCapacity: 0,
          shelterId: 'ALL',
          shelterName: 'All Shelters',
          shelterDemand: 0,
          allocatedQty: 0,
          estimatedTravelMinutes: 0,
          feasible: false,
          rejectionReason: `Batch ${batch.id} expired at ${batch.safeUseDeadline}. Safe-use window elapsed.`,
          score: -999,
          missingRequirements: [],
        }],
        allocatedTotalQty: 0,
        remainingUnassignedQty: unassignedRemaining,
        explanation: 'Batch has expired past configured safe-use deadline. Dispatch blocked.',
      };
    }

    // Evaluate all rider-shelter pairs
    interface EvaluatedPair {
      rider: Rider;
      shelter: Shelter;
      estimatedMinutes: number;
      feasible: boolean;
      rejectionReason?: string;
      missingRequirements: string[];
      score: number;
      maxTransfer: number;
    }

    const candidatePairs: EvaluatedPair[] = [];

    for (const rider of riders) {
      for (const shelter of shelters) {
        const availCap = riderRemainingCap[rider.id] || 0;
        const dem = shelterRemainingDemand[shelter.id] || 0;
        const missingRequirements: string[] = [];

        // Travel time calculation: Donor -> Rider pickup -> Shelter
        const pickupTravel = calculateTravelMinutes(rider.location, batch.origin);
        const deliveryTravel = calculateTravelMinutes(batch.origin, shelter.location);
        const totalEstimatedTravelMinutes = pickupTravel + deliveryTravel;
        const safetyMargin = 10;
        const totalRequiredTime = totalEstimatedTravelMinutes + safetyMargin;

        let feasible = true;
        let rejectionReason = '';

        if (!shelter.active) {
          feasible = false;
          rejectionReason = `Shelter ${shelter.name} is closed / inactive.`;
        } else if (dem <= 0) {
          feasible = false;
          rejectionReason = `Shelter ${shelter.name} has 0 remaining demand for ${batch.category}.`;
        } else if (!rider.available || rider.status === 'OFFLINE') {
          feasible = false;
          rejectionReason = `Rider ${rider.name} is unavailable or offline.`;
        } else if (availCap <= 0) {
          feasible = false;
          rejectionReason = `Rider ${rider.name} has no remaining carrying capacity (current load ${rider.currentLoad}/${rider.capacity}).`;
        } else {
          // Check handling/resource requirements
          for (const req of batch.handlingRequirements) {
            if (req === 'CLEAN_WATER_AT_DESTINATION' && !shelter.resources.includes('CLEAN_WATER')) {
              feasible = false;
              missingRequirements.push('CLEAN_WATER');
              rejectionReason = `Shelter ${shelter.name} lacks required resource: CLEAN_WATER.`;
            }
            if (req === 'COOKING_FUEL_AT_DESTINATION' && !shelter.resources.includes('COOKING_FUEL')) {
              feasible = false;
              missingRequirements.push('COOKING_FUEL');
              rejectionReason = `Shelter ${shelter.name} lacks required resource: COOKING_FUEL.`;
            }
            if (req === 'COLD_STORAGE_AT_DESTINATION' && !shelter.resources.includes('COLD_STORAGE')) {
              feasible = false;
              missingRequirements.push('COLD_STORAGE');
              rejectionReason = `Shelter ${shelter.name} lacks required resource: COLD_STORAGE.`;
            }
            if (req === 'REFRIGERATED_CARRIER' && !rider.capabilities.includes('COLD_BOX') && !rider.capabilities.includes('INSULATED_BAG')) {
              feasible = false;
              missingRequirements.push('REFRIGERATED_CARRIER');
              rejectionReason = `Rider ${rider.name} lacks refrigerated insulated equipment.`;
            }
          }

          // Check feasibility window against original safe-use deadline
          if (feasible && totalRequiredTime > minutesToSafeDeadline) {
            feasible = false;
            rejectionReason = `Time infeasible: ETA (${totalEstimatedTravelMinutes}m) + 10m margin = ${totalRequiredTime}m exceeds safe-use window (${minutesToSafeDeadline}m remaining).`;
          }
        }

        // Deterministic ranking formula:
        // score = urgency * 2 + demand_priority * 30 - travel_minutes * 1.5
        const urgencyScore = Math.max(0, 100 - minutesToSafeDeadline);
        const priorityWeight = shelter.priority === 'CRITICAL' ? 50 : shelter.priority === 'HIGH' ? 30 : 15;
        const score = feasible 
          ? Math.round(urgencyScore * 0.4 + priorityWeight + dem * 0.5 - totalEstimatedTravelMinutes * 1.2)
          : -100;

        const maxTransfer = Math.min(availCap, dem);

        candidatePairs.push({
          rider,
          shelter,
          estimatedMinutes: totalEstimatedTravelMinutes,
          feasible,
          rejectionReason: rejectionReason || undefined,
          missingRequirements,
          score,
          maxTransfer,
        });

        if (!feasible) {
          rejectedCandidates.push({
            riderId: rider.id,
            riderName: rider.name,
            riderCapacity: rider.capacity,
            riderAvailableCapacity: availCap,
            shelterId: shelter.id,
            shelterName: shelter.name,
            shelterDemand: dem,
            allocatedQty: 0,
            estimatedTravelMinutes: totalEstimatedTravelMinutes,
            feasible: false,
            rejectionReason,
            score,
            missingRequirements,
          });
        }
      }
    }

    // Sort feasible pairs by highest score first
    const sortedFeasible = candidatePairs
      .filter(p => p.feasible && p.maxTransfer > 0)
      .sort((a, b) => b.score - a.score);

    // Greedy multi-rider split allocation respecting capacities and demands
    for (const pair of sortedFeasible) {
      if (unassignedRemaining <= 0) break;

      const availRiderCap = riderRemainingCap[pair.rider.id] || 0;
      const remShelterDem = shelterRemainingDemand[pair.shelter.id] || 0;

      if (availRiderCap <= 0 || remShelterDem <= 0) continue;

      const allocQty = Math.min(unassignedRemaining, availRiderCap, remShelterDem);
      if (allocQty <= 0) continue;

      // Deduct
      unassignedRemaining -= allocQty;
      riderRemainingCap[pair.rider.id] -= allocQty;
      shelterRemainingDemand[pair.shelter.id] -= allocQty;

      // Compute fallbacks for this candidate
      const otherShelters = shelters.filter(s => s.id !== pair.shelter.id && s.active);
      const fallbacks: FallbackCandidate[] = otherShelters.map(s => {
        const estMin = calculateTravelMinutes(pair.shelter.location, s.location) + 8;
        const hasReq = !batch.handlingRequirements.some(req => 
          (req === 'CLEAN_WATER_AT_DESTINATION' && !s.resources.includes('CLEAN_WATER')) ||
          (req === 'COOKING_FUEL_AT_DESTINATION' && !s.resources.includes('COOKING_FUEL'))
        );
        const dem = s.demandByCategory[batch.category] || 0;
        const isFeas = hasReq && dem > 0 && (estMin + 10) <= minutesToSafeDeadline;
        return {
          shelterId: s.id,
          shelterName: s.name,
          estimatedMinutes: estMin,
          feasible: isFeas,
          score: isFeas ? Math.round(dem * 0.5 - estMin) : -50,
          rejectionReason: !hasReq ? 'Lacks required resources' : dem <= 0 ? 'No remaining demand' : (!isFeas ? 'Arrival past safe-use deadline' : undefined),
          remainingDemand: dem,
          missingResources: !hasReq ? ['RESOURCES_UNMET'] : [],
        };
      }).sort((a, b) => b.score - a.score);

      proposedAllocations.push({
        riderId: pair.rider.id,
        riderName: pair.rider.name,
        shelterId: pair.shelter.id,
        shelterName: pair.shelter.name,
        quantity: allocQty,
        estimatedMinutes: pair.estimatedMinutes,
        score: pair.score,
        fallbackCount: fallbacks.filter(f => f.feasible).length,
      });
    }

    const allocatedTotalQty = ledger.unassignedQty - unassignedRemaining;

    return {
      batchId,
      batchCategory: batch.category,
      totalBatchQty: batch.totalQuantity,
      unassignedBefore: ledger.unassignedQty,
      proposedAllocations,
      rejectedCandidates,
      allocatedTotalQty,
      remainingUnassignedQty: unassignedRemaining,
      explanation: proposedAllocations.length > 0
        ? `Feasible split across ${proposedAllocations.length} rider(s) for ${allocatedTotalQty} ${batch.unit}. ${unassignedRemaining} ${batch.unit} remain unassigned.`
        : `No feasible rider/shelter allocation found meeting hard constraints (deadline, capacity, resources).`,
    };
  }

  static confirmDispatch(batchId: string, customAllocations?: DispatchPlanPreview['proposedAllocations']): Assignment[] {
    const db = getDatabase();
    const batch = this.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const preview = this.previewDispatch(batchId);
    const allocationsToApply = customAllocations || preview.proposedAllocations;

    if (allocationsToApply.length === 0) {
      throw new Error(`No feasible allocations to confirm for batch ${batchId}. Check rejection reasons in preview.`);
    }

    const nowIso = ClockService.getNowIso();
    const createdAssignments: Assignment[] = [];

    // Atomic transaction for reservations
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const alloc of allocationsToApply) {
        const rider = this.getRider(alloc.riderId);
        const shelter = this.getShelter(alloc.shelterId);
        if (!rider || !shelter) {
          throw new Error(`Rider or shelter not found for allocation: ${alloc.riderId} -> ${alloc.shelterId}`);
        }

        // Check availability
        const currentAvailCap = rider.capacity - rider.currentLoad;
        if (currentAvailCap < alloc.quantity) {
          throw new Error(`Rider ${rider.name} available capacity (${currentAvailCap}) exceeded by allocation (${alloc.quantity})`);
        }

        const assignId = 'SHIP-' + Math.floor(1000 + Math.random() * 9000);
        // Lease deadline is 15 minutes by default
        const leaseDeadline = ClockService.advanceMinutesFrom(nowIso, 15);

        // Precompute fallbacks
        const otherShelters = this.getAllShelters().filter(s => s.id !== shelter.id);
        const minutesToSafeDeadline = ClockService.minutesDiff(batch.safeUseDeadline, nowIso);
        const precomputedFallbacks: FallbackCandidate[] = otherShelters.map(s => {
          const estMin = calculateTravelMinutes(shelter.location, s.location) + 6;
          const dem = s.demandByCategory[batch.category] || 0;
          const hasReq = !batch.handlingRequirements.some(req => 
            (req === 'CLEAN_WATER_AT_DESTINATION' && !s.resources.includes('CLEAN_WATER')) ||
            (req === 'COOKING_FUEL_AT_DESTINATION' && !s.resources.includes('COOKING_FUEL'))
          );
          const isFeas = s.active && hasReq && dem >= alloc.quantity && (estMin + 10) <= minutesToSafeDeadline;
          return {
            shelterId: s.id,
            shelterName: s.name,
            estimatedMinutes: estMin,
            feasible: isFeas,
            score: isFeas ? Math.round(dem - estMin) : -50,
            rejectionReason: !s.active ? 'Shelter closed' : (!hasReq ? 'Lacks requirements' : (dem < alloc.quantity ? 'Insufficient demand' : (!isFeas ? 'Arrival past deadline' : undefined))),
            remainingDemand: dem,
            missingResources: !hasReq ? ['RESOURCES_UNMET'] : [],
          };
        });

        // Insert assignment
        db.prepare(`
          INSERT INTO assignments (
            id, batch_id, batch_name, category, quantity, unit,
            rider_id, rider_name, shelter_id, shelter_name,
            origin_json, destination_json, status, custody,
            lease_deadline, estimated_travel_minutes, safety_margin_minutes,
            safe_use_deadline, precomputed_fallbacks_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          assignId,
          batch.id,
          batch.donorName,
          batch.category,
          alloc.quantity,
          batch.unit,
          rider.id,
          rider.name,
          shelter.id,
          shelter.name,
          JSON.stringify(batch.origin),
          JSON.stringify(shelter.location),
          'RESERVED',
          'AT_DONOR',
          leaseDeadline,
          alloc.estimatedMinutes,
          10,
          batch.safeUseDeadline,
          JSON.stringify(precomputedFallbacks),
          nowIso,
          nowIso
        );

        // Update rider current load
        db.prepare(`
          UPDATE riders SET current_load = current_load + ?, status = 'RESERVED', updated_at = ? WHERE id = ?
        `).run(alloc.quantity, nowIso, rider.id);

        // Update shelter demand
        const currentDemand = shelter.demandByCategory[batch.category] || 0;
        const newDemand = Math.max(0, currentDemand - alloc.quantity);
        const updatedDemandObj = { ...shelter.demandByCategory, [batch.category]: newDemand };
        db.prepare(`
          UPDATE shelters SET demand_by_category_json = ?, updated_at = ? WHERE id = ?
        `).run(JSON.stringify(updatedDemandObj), nowIso, shelter.id);

        // Log event
        EventLogService.record({
          entityType: 'ASSIGNMENT',
          entityId: assignId,
          eventType: 'DISPATCH_RESERVED',
          severity: 'INFO',
          trigger: 'OPERATOR_DISPATCH',
          reason: `Reserved ${alloc.quantity} ${batch.unit} of ${batch.category} for Rider ${rider.name} to Shelter ${shelter.name} (Lease: 15m).`,
          affectedQuantity: alloc.quantity,
          metadata: {
            batchId: batch.id,
            riderId: rider.id,
            shelterId: shelter.id,
            estimatedTravelMinutes: alloc.estimatedMinutes,
            safeUseDeadline: batch.safeUseDeadline,
          },
        });

        const created = this.getAssignment(assignId);
        if (created) createdAssignments.push(created);
      }

      // Update batch status
      const updatedLedger = this.getBatchLedger(batchId);
      const batchStatus = updatedLedger.unassignedQty === 0 ? 'FULLY_DISPATCHED' : 'PARTIALLY_DISPATCHED';
      db.prepare('UPDATE batches SET status = ? WHERE id = ?').run(batchStatus, batchId);

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    return createdAssignments;
  }

  // Row mapping helpers
  private static mapBatchRow(r: any): AidBatch {
    return {
      id: r.id,
      donorName: r.donor_name,
      category: r.category,
      totalQuantity: r.total_quantity,
      unit: r.unit,
      origin: JSON.parse(r.origin_json),
      safeUseDeadline: r.safe_use_deadline,
      handlingRequirements: JSON.parse(r.handling_requirements_json),
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    };
  }

  private static mapShelterRow(r: any): Shelter {
    return {
      id: r.id,
      name: r.name,
      location: JSON.parse(r.location_json),
      active: Boolean(r.active),
      capacityLimit: r.capacity_limit,
      currentOccupancy: r.current_occupancy,
      demandByCategory: JSON.parse(r.demand_by_category_json),
      resources: JSON.parse(r.resources_json),
      priority: r.priority,
      updatedAt: r.updated_at,
    };
  }

  private static mapRiderRow(r: any): Rider {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      vehicleType: r.vehicle_type,
      capacity: r.capacity,
      currentLoad: r.current_load,
      available: Boolean(r.available),
      location: JSON.parse(r.location_json),
      capabilities: JSON.parse(r.capabilities_json),
      status: r.status,
      updatedAt: r.updated_at,
    };
  }

  private static mapAssignmentRow(r: any): Assignment {
    return {
      id: r.id,
      batchId: r.batch_id,
      batchName: r.batch_name,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      riderId: r.rider_id,
      riderName: r.rider_name,
      shelterId: r.shelter_id,
      shelterName: r.shelter_name,
      origin: JSON.parse(r.origin_json),
      destination: JSON.parse(r.destination_json),
      status: r.status,
      custody: r.custody,
      leaseDeadline: r.lease_deadline,
      estimatedTravelMinutes: r.estimated_travel_minutes,
      safetyMarginMinutes: r.safety_margin_minutes,
      safeUseDeadline: r.safe_use_deadline,
      precomputedFallbacks: JSON.parse(r.precomputed_fallbacks_json || '[]'),
      rejectionReason: r.rejection_reason,
      interventionReason: r.intervention_reason,
      acknowledgedAt: r.acknowledged_at,
      pickedUpAt: r.picked_up_at,
      inTransitAt: r.in_transit_at,
      deliveredAt: r.delivered_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
