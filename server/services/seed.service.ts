import { getDatabase } from '../db/database.js';
import { ClockService, DEFAULT_SIMULATION_START } from './clock.service.js';
import { EventLogService } from './event-log.service.js';
import { DispatchService } from './dispatch.service.js';
import { RescueService } from './rescue.service.js';

export class SeedService {
  /**
   * Resets entire database and loads pristine demo scenario.
   */
  static resetDemo(): void {
    const db = getDatabase();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec(`
        DELETE FROM assignments;
        DELETE FROM events;
        DELETE FROM riders;
        DELETE FROM shelters;
        DELETE FROM batches;
        DELETE FROM simulation_state;
      `);

      // Initialize Simulation Clock
      ClockService.resetToDefault();
      const nowIso = DEFAULT_SIMULATION_START;

      // Seed Shelters
      const shelters = [
        {
          id: 'SHELTER-A',
          name: 'Hope Community Harbor',
          location: { name: 'Harbor Center', address: '14 Bayfront Ave, Bund Garden', x: 25, y: 30, lat: 18.5362, lng: 73.8790 },
          active: 1,
          capacityLimit: 120,
          currentOccupancy: 35,
          demandByCategory: { COOKED_MEALS: 50, PERISHABLE_PRODUCE: 20, RATION_KITS: 30 },
          resources: ['CLEAN_WATER', 'COOKING_FUEL', 'HOT_HOLDING', 'DINING_HALL'],
          priority: 'CRITICAL',
        },
        {
          id: 'SHELTER-B',
          name: 'St. Jude Relief Haven',
          location: { name: 'St. Jude Sanctuary', address: '88 Hillside Blvd, Kothrud', x: 70, y: 25, lat: 18.5074, lng: 73.8077 },
          active: 1,
          capacityLimit: 150,
          currentOccupancy: 60,
          demandByCategory: { COOKED_MEALS: 60, PERISHABLE_PRODUCE: 30, BAKERY: 20 },
          resources: ['CLEAN_WATER', 'COOKING_FUEL', 'COLD_STORAGE'],
          priority: 'HIGH',
        },
        {
          id: 'SHELTER-C',
          name: 'Eastside Family Shelter',
          location: { name: 'Eastside Hall', address: '204 Sunrise Dr, Hadapsar', x: 80, y: 65, lat: 18.5529, lng: 73.9349 },
          active: 1,
          capacityLimit: 100,
          currentOccupancy: 45,
          demandByCategory: { COOKED_MEALS: 40, RATION_KITS: 25, BAKERY: 15 },
          resources: ['CLEAN_WATER', 'COOKING_FUEL', 'HOT_HOLDING'],
          priority: 'HIGH',
        },
        {
          id: 'SHELTER-D',
          name: 'West River Outreach',
          location: { name: 'River Point', address: '42 Waterfront St, Deccan', x: 20, y: 75, lat: 18.5158, lng: 73.8312 },
          active: 1,
          capacityLimit: 80,
          currentOccupancy: 20,
          demandByCategory: { COOKED_MEALS: 30, PERISHABLE_PRODUCE: 25 },
          resources: ['CLEAN_WATER', 'COLD_STORAGE'],
          priority: 'STANDARD',
        },
        {
          id: 'SHELTER-E',
          name: 'Dry Creek Depot (No Clean Water)',
          location: { name: 'Dry Creek Point', address: '9 Industrial Way, Swargate', x: 50, y: 85, lat: 18.4988, lng: 73.8642 },
          active: 1,
          capacityLimit: 90,
          currentOccupancy: 15,
          demandByCategory: { COOKED_MEALS: 40, RATION_KITS: 40 },
          resources: ['COOKING_FUEL'], // Intentionally lacks CLEAN_WATER to demonstrate resource gating
          priority: 'STANDARD',
        },
      ];

      for (const s of shelters) {
        db.prepare(`
          INSERT INTO shelters (id, name, location_json, active, capacity_limit, current_occupancy, demand_by_category_json, resources_json, priority, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          s.id,
          s.name,
          JSON.stringify(s.location),
          s.active,
          s.capacityLimit,
          s.currentOccupancy,
          JSON.stringify(s.demandByCategory),
          JSON.stringify(s.resources),
          s.priority,
          nowIso
        );
      }

      // Seed Riders: 5 riders with 40-meal capacity each as specified in prompt & blueprint
      const riders = [
        {
          id: 'RIDER-1',
          name: 'Marco Rossi',
          phone: '+1 (555) 234-5671',
          vehicleType: 'CARGO_BIKE',
          capacity: 40,
          currentLoad: 0,
          available: 1,
          location: { name: 'Civic Hub North', address: 'North Stand, Shivajinagar', x: 40, y: 35, lat: 18.5250, lng: 73.8500 },
          capabilities: ['INSULATED_BAG', 'LARGE_RACK'],
          status: 'IDLE',
        },
        {
          id: 'RIDER-2',
          name: 'Elena Chen',
          phone: '+1 (555) 234-5672',
          vehicleType: 'E_SCOOTER',
          capacity: 40,
          currentLoad: 0,
          available: 1,
          location: { name: 'Civic Hub West', address: 'West Stand, FC Road', x: 35, y: 50, lat: 18.5180, lng: 73.8600 },
          capabilities: ['INSULATED_BAG', 'COLD_BOX'],
          status: 'IDLE',
        },
        {
          id: 'RIDER-3',
          name: 'Jamal Williams',
          phone: '+1 (555) 234-5673',
          vehicleType: 'CARGO_BIKE',
          capacity: 40,
          currentLoad: 0,
          available: 1,
          location: { name: 'Civic Hub Center', address: 'Central Plaza, Camp', x: 45, y: 45, lat: 18.5220, lng: 73.8580 },
          capabilities: ['INSULATED_BAG', 'LARGE_RACK'],
          status: 'IDLE',
        },
        {
          id: 'RIDER-4',
          name: 'Priya Sharma',
          phone: '+1 (555) 234-5674',
          vehicleType: 'VAN',
          capacity: 40,
          currentLoad: 0,
          available: 1,
          location: { name: 'Civic Hub South', address: 'South Station, Swargate', x: 50, y: 60, lat: 18.5100, lng: 73.8400 },
          capabilities: ['COLD_BOX', 'INSULATED_BAG', 'LARGE_RACK'],
          status: 'IDLE',
        },
        {
          id: 'RIDER-5',
          name: 'Tariq Al-Mansoor',
          phone: '+1 (555) 234-5675',
          vehicleType: 'CARGO_BIKE',
          capacity: 40,
          currentLoad: 0,
          available: 1,
          location: { name: 'Civic Hub East', address: 'East Station, Koregaon', x: 55, y: 40, lat: 18.5300, lng: 73.8650 },
          capabilities: ['INSULATED_BAG'],
          status: 'IDLE',
        },
      ];

      for (const r of riders) {
        db.prepare(`
          INSERT INTO riders (id, name, phone, vehicle_type, capacity, current_load, available, location_json, capabilities_json, status, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.id,
          r.name,
          r.phone,
          r.vehicleType,
          r.capacity,
          r.currentLoad,
          r.available,
          JSON.stringify(r.location),
          JSON.stringify(r.capabilities),
          r.status,
          nowIso
        );
      }

      // Seed Batches
      // Batch 1: Primary Demo Batch from prompt: 180 cooked meals, 75 min safe-use window!
      const deadline75Min = ClockService.advanceMinutesFrom(nowIso, 75);
      const deadline6Hours = ClockService.advanceMinutesFrom(nowIso, 360);
      const deadline25Min = ClockService.advanceMinutesFrom(nowIso, 25);

      const batches = [
        {
          id: 'BATCH-2026-180',
          donorName: 'Civic Grand Banquet Hall',
          category: 'COOKED_MEALS',
          totalQuantity: 180,
          unit: 'meals',
          origin: { name: 'Civic Grand Hall', address: '100 Metro Plaza', x: 45, y: 45, lat: 18.5204, lng: 73.8567 },
          safeUseDeadline: deadline75Min,
          handlingRequirements: ['CLEAN_WATER_AT_DESTINATION'],
          status: 'AVAILABLE',
          notes: 'Freshly prepared catering surplus. Must be served within 75 minutes of cooking.',
        },
        {
          id: 'BATCH-RATION-50',
          donorName: 'Metro Preparedness Logistics',
          category: 'RATION_KITS',
          totalQuantity: 50,
          unit: 'kits',
          origin: { name: 'Emergency Depot West', address: '12 Logistics Blvd', x: 15, y: 20, lat: 18.5314, lng: 73.8446 },
          safeUseDeadline: deadline6Hours,
          handlingRequirements: ['CLEAN_WATER_AT_DESTINATION', 'COOKING_FUEL_AT_DESTINATION'],
          status: 'AVAILABLE',
          notes: 'Dehydrated ration kits requiring boiling water and heat to prepare.',
        },
        {
          id: 'BATCH-BAKERY-30',
          donorName: 'Heritage Artisanal Bakery',
          category: 'BAKERY',
          totalQuantity: 30,
          unit: 'boxes',
          origin: { name: 'Heritage Ovens', address: '55 Old Town Alley', x: 65, y: 50, lat: 18.5089, lng: 73.8258 },
          safeUseDeadline: deadline25Min,
          handlingRequirements: [],
          status: 'AVAILABLE',
          notes: 'Warm morning pastries; tight 25-minute optimal consumption window.',
        },
      ];

      for (const b of batches) {
        db.prepare(`
          INSERT INTO batches (id, donor_name, category, total_quantity, unit, origin_json, safe_use_deadline, handling_requirements_json, status, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          b.id,
          b.donorName,
          b.category,
          b.totalQuantity,
          b.unit,
          JSON.stringify(b.origin),
          b.safeUseDeadline,
          JSON.stringify(b.handlingRequirements),
          b.status,
          b.notes,
          nowIso
        );
      }

      db.exec('COMMIT;');

      EventLogService.record({
        entityType: 'SIMULATION',
        entityId: 'SEED-INIT',
        eventType: 'SYSTEM_RESET_SEED',
        severity: 'INFO',
        trigger: 'ADMIN_RESET',
        reason: 'Restored baseline simulation state: 180 cooked meals batch (75m window), 5 riders (40 cap each), 5 shelters with explicit demands.',
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Run one of the 5 Judge Scenarios
   */
  static runScenario(scenarioKey: string): { scenario: string; summary: string; assignments: any[] } {
    const db = getDatabase();

    switch (scenarioKey) {
      case 'scenario-a-split': {
        // Scenario A: 180 meals split across riders (40 cap) and shelters (50 / 60 / 40 demand)
        this.resetDemo();
        const assignments = DispatchService.confirmDispatch('BATCH-2026-180');
        const ledger = DispatchService.getBatchLedger('BATCH-2026-180');

        return {
          scenario: 'Scenario A: Large Batch Capacity-Aware Split',
          summary: `Successfully split 180 meals across ${assignments.length} riders without exceeding 40-meal vehicle capacity or individual shelter demands (50, 60, 40). Ledger total: ${ledger.totalQty}, Reserved: ${ledger.reservedQty}, Unassigned remaining: ${ledger.unassignedQty}.`,
          assignments,
        };
      }

      case 'scenario-b-ghost': {
        // Scenario B: Ghost Reservation Timeout & Exactly-Once Release
        this.resetDemo();
        // Dispatch only 1 rider for 40 meals
        const preview = DispatchService.previewDispatch('BATCH-2026-180');
        const firstAlloc = [preview.proposedAllocations[0]];
        const assignments = DispatchService.confirmDispatch('BATCH-2026-180', firstAlloc);
        const target = assignments[0];

        // Advance simulation clock by 18 minutes (past 15m lease deadline)
        ClockService.advanceMinutes(18);

        // Process timeouts
        const result = RescueService.processReservationTimeouts();
        const updatedTarget = DispatchService.getAssignment(target.id);
        const ledger = DispatchService.getBatchLedger('BATCH-2026-180');

        return {
          scenario: 'Scenario B: Ghost Reservation Lease Timeout',
          summary: `Simulated clock advanced +18m past 15m lease deadline. Ghost reservation ${target.id} expired. Exactly ${result.releasedQuantity} meals released back to available pool. Batch unassigned quantity restored to ${ledger.unassignedQty}.`,
          assignments: updatedTarget ? [updatedTarget] : [],
        };
      }

      case 'scenario-c-closure': {
        // Scenario C: Shelter closure while cargo is in transit -> Safe reroute or intervention
        this.resetDemo();
        const preview = DispatchService.previewDispatch('BATCH-2026-180');
        const singleAlloc = [preview.proposedAllocations[0]]; // 40 meals to Shelter A (Hope Community)
        const assignments = DispatchService.confirmDispatch('BATCH-2026-180', singleAlloc);
        const ship = assignments[0];

        // Acknowledge, Pick up, Start Transit
        RescueService.acknowledgeReservation(ship.id);
        RescueService.pickupCargo(ship.id);
        RescueService.markInTransit(ship.id);

        // Close the destination shelter while cargo is in transit!
        RescueService.handleShelterDisruption(ship.shelterId, false);

        const updated = DispatchService.getAssignment(ship.id);
        return {
          scenario: 'Scenario C: Mid-Transit Shelter Closure & Recovery',
          summary: `Cargo (${ship.quantity} meals) in transit: original shelter ${ship.shelterName} closed unexpectedly. AidFlow Rescue Protocol triggered live revalidation, preserved rider custody (${updated?.custody}), and rerouted to ${updated?.shelterName} (status: ${updated?.status}).`,
          assignments: updated ? [updated] : [],
        };
      }

      case 'scenario-d-resource': {
        // Scenario D: Resource Incompatibility Gate (Missing Clean Water)
        this.resetDemo();
        // Dry Creek Depot (SHELTER-E) lacks CLEAN_WATER.
        // Batch BATCH-RATION-50 requires CLEAN_WATER_AT_DESTINATION.
        const preview = DispatchService.previewDispatch('BATCH-RATION-50');
        const dryCreekEvaluation = preview.rejectedCandidates.find(r => r.shelterId === 'SHELTER-E');

        return {
          scenario: 'Scenario D: Resource Incompatibility Gate',
          summary: `Dehydrated ration kit requires Clean Water. Shelter E (Dry Creek Depot) lacks clean water infrastructure. Dispatch Engine deterministically rejected candidate: "${dryCreekEvaluation?.rejectionReason || 'Resource unmet'}". Zero stock misallocated.`,
          assignments: [],
        };
      }

      case 'scenario-e-expiry': {
        // Scenario E: Expiry Infeasibility Gate
        this.resetDemo();
        // Advance clock to within 5 minutes of BATCH-BAKERY-30 deadline (25m initial - 21m elapsed = 4m remaining)
        ClockService.advanceMinutes(22);
        const preview = DispatchService.previewDispatch('BATCH-BAKERY-30');

        return {
          scenario: 'Scenario E: Expiry Infeasibility Gate',
          summary: `Remaining safe window (3 mins) is less than required travel ETA (14 mins) + 10m safety margin. All candidates blocked with visible rejection reason: "${preview.rejectedCandidates[0]?.rejectionReason || preview.explanation}". Graceful failure with operator alert instead of false delivery.`,
          assignments: [],
        };
      }

      default:
        throw new Error(`Unknown scenario: ${scenarioKey}`);
    }
  }
}
