import { describe, it, expect, beforeEach } from 'vitest';
import { SeedService } from '../services/seed.service.js';
import { DispatchService } from '../services/dispatch.service.js';
import { RescueService } from '../services/rescue.service.js';
import { ClockService } from '../services/clock.service.js';

describe('AidFlow Logistics & Rescue Protocol Acceptance Tests', () => {
  beforeEach(() => {
    SeedService.resetDemo();
  });

  describe('1. Dispatch Engine & Capacity-Aware Splitting', () => {
    it('splits a large 180-meal batch across multiple riders without exceeding 40-meal capacity or shelter demands', () => {
      const preview = DispatchService.previewDispatch('BATCH-2026-180');

      expect(preview.proposedAllocations.length).toBeGreaterThan(1);
      
      // Verify no rider is allocated > 40
      for (const alloc of preview.proposedAllocations) {
        expect(alloc.quantity).toBeLessThanOrEqual(40);
        expect(alloc.quantity).toBeGreaterThan(0);
      }

      // Confirm dispatch
      const created = DispatchService.confirmDispatch('BATCH-2026-180');
      expect(created.length).toBe(preview.proposedAllocations.length);

      // Verify ledger reconciliation
      const ledger = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledger.reconciled).toBe(true);
      expect(ledger.totalQty).toBe(180);
      expect(ledger.reservedQty + ledger.unassignedQty).toBe(180);
      expect(ledger.reservedQty).toBeGreaterThanOrEqual(140);
    });

    it('blocks dispatch when batch is past its safe-use deadline', () => {
      // Advance clock past 75 mins deadline
      ClockService.advanceMinutes(80);
      const preview = DispatchService.previewDispatch('BATCH-2026-180');

      expect(preview.proposedAllocations.length).toBe(0);
      expect(preview.explanation).toContain('expired');
    });

    it('blocks dispatch when estimated travel time + safety margin exceeds deadline', () => {
      // Batch BATCH-BAKERY-30 has only 25 min window.
      // Advance clock 22 minutes (leaving only 3 minutes)
      ClockService.advanceMinutes(22);
      const preview = DispatchService.previewDispatch('BATCH-BAKERY-30');

      expect(preview.proposedAllocations.length).toBe(0);
      expect(preview.rejectedCandidates.length).toBeGreaterThan(0);
      const timeInfeasibleCandidate = preview.rejectedCandidates.find(c => 
        c.rejectionReason && /safe-use window|exceeds safe-use/i.test(c.rejectionReason)
      );
      expect(timeInfeasibleCandidate).toBeDefined();
    });
  });

  describe('2. Compatibility & Resource Requirements', () => {
    it('blocks allocation to shelter lacking required resources (Clean Water)', () => {
      // BATCH-RATION-50 requires CLEAN_WATER_AT_DESTINATION
      // SHELTER-E (Dry Creek Depot) lacks CLEAN_WATER
      const preview = DispatchService.previewDispatch('BATCH-RATION-50');
      const dryCreekEvaluation = preview.rejectedCandidates.find(c => c.shelterId === 'SHELTER-E');

      expect(dryCreekEvaluation).toBeDefined();
      expect(dryCreekEvaluation?.feasible).toBe(false);
      expect(dryCreekEvaluation?.rejectionReason).toContain('CLEAN_WATER');
    });

    it('blocks allocation to inactive/closed shelter', () => {
      // Close Shelter B
      RescueService.handleShelterDisruption('SHELTER-B', false);
      const preview = DispatchService.previewDispatch('BATCH-2026-180');
      const shelterBEval = preview.rejectedCandidates.find(c => c.shelterId === 'SHELTER-B');

      expect(shelterBEval).toBeDefined();
      expect(shelterBEval?.feasible).toBe(false);
      expect(shelterBEval?.rejectionReason).toMatch(/closed|inactive/i);
    });
  });

  describe('3. Ghost Reservation Lease & Exactly-Once Stock Release', () => {
    it('expires overdue reservation lease and releases stock back to available pool exactly once', () => {
      const preview = DispatchService.previewDispatch('BATCH-2026-180');
      const firstAlloc = [preview.proposedAllocations[0]]; // 40 meals
      const assignments = DispatchService.confirmDispatch('BATCH-2026-180', firstAlloc);
      const target = assignments[0];

      const ledgerBefore = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledgerBefore.reservedQty).toBe(40);
      expect(ledgerBefore.unassignedQty).toBe(140);

      // Advance clock 20 minutes (exceeding 15m lease deadline)
      ClockService.advanceMinutes(20);

      // Run timeout processor
      const firstRun = RescueService.processReservationTimeouts();
      expect(firstRun.expiredCount).toBe(1);
      expect(firstRun.releasedQuantity).toBe(40);

      const updated = DispatchService.getAssignment(target.id);
      expect(updated?.status).toBe('EXPIRED');
      expect(updated?.custody).toBe('AT_DONOR');

      // Verify stock was restored to available
      const ledgerAfter = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledgerAfter.reservedQty).toBe(0);
      expect(ledgerAfter.unassignedQty).toBe(180);
      expect(ledgerAfter.reconciled).toBe(true);

      // Second run: must be idempotent (exactly-once release)
      const secondRun = RescueService.processReservationTimeouts();
      expect(secondRun.expiredCount).toBe(0);
      expect(secondRun.releasedQuantity).toBe(0);

      const ledgerSecond = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledgerSecond.unassignedQty).toBe(180);
    });
  });

  describe('4. Cargo Custody & In-Transit Failure Recovery', () => {
    it('preserves rider custody for in-transit cargo and safely reroutes when shelter closes', () => {
      const preview = DispatchService.previewDispatch('BATCH-2026-180');
      const firstAlloc = [preview.proposedAllocations[0]];
      const assignments = DispatchService.confirmDispatch('BATCH-2026-180', firstAlloc);
      const ship = assignments[0];
      const originalShelterId = ship.shelterId;

      // Rider acknowledges, picks up, and departs
      RescueService.acknowledgeReservation(ship.id);
      RescueService.pickupCargo(ship.id);
      RescueService.markInTransit(ship.id);

      const inTransitState = DispatchService.getAssignment(ship.id);
      expect(inTransitState?.status).toBe('IN_TRANSIT');
      expect(inTransitState?.custody).toBe('RIDER_CUSTODY');

      // Destination shelter closes unexpectedly
      RescueService.handleShelterDisruption(originalShelterId, false);

      const rerouted = DispatchService.getAssignment(ship.id);
      // Cargo must NOT be returned to donor pool!
      expect(rerouted?.custody).toBe('RIDER_CUSTODY');
      expect(rerouted?.shelterId).not.toBe(originalShelterId);
      expect(rerouted?.status).toBe('IN_TRANSIT');

      // Ledger check: inTransitQty preserved
      const ledger = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledger.inTransitQty).toBe(40);
      expect(ledger.unassignedQty).toBe(140);
      expect(ledger.reconciled).toBe(true);
    });

    it('raises explicit INTERVENTION_REQUIRED when no safe fallback destination exists', () => {
      // Close all other shelters except Shelter A
      RescueService.handleShelterDisruption('SHELTER-B', false);
      RescueService.handleShelterDisruption('SHELTER-C', false);
      RescueService.handleShelterDisruption('SHELTER-D', false);
      RescueService.handleShelterDisruption('SHELTER-E', false);

      const preview = DispatchService.previewDispatch('BATCH-2026-180');
      const alloc = [preview.proposedAllocations[0]]; // To Shelter A
      const assignments = DispatchService.confirmDispatch('BATCH-2026-180', alloc);
      const ship = assignments[0];

      RescueService.acknowledgeReservation(ship.id);
      RescueService.pickupCargo(ship.id);
      RescueService.markInTransit(ship.id);

      // Now close Shelter A as well: zero alternatives exist!
      RescueService.handleShelterDisruption('SHELTER-A', false);

      const intervened = DispatchService.getAssignment(ship.id);
      expect(intervened?.status).toBe('INTERVENTION_REQUIRED');
      expect(intervened?.interventionReason).toMatch(/NO SAFE RECOVERY OPTION|intervention/i);

      // Must never falsely mark delivered
      expect(intervened?.status).not.toBe('DELIVERED');

      // Ledger tracks intervention bucket accurately
      const ledger = DispatchService.getBatchLedger('BATCH-2026-180');
      expect(ledger.interventionQty).toBe(40);
      expect(ledger.deliveredQty).toBe(0);
      expect(ledger.reconciled).toBe(true);
    });
  });
});
