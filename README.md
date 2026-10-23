# Civora — Resilient Aid Logistics

> **Vibe-A-Thon • Social Impact & Civic Micro-Logistics Platform**  
> *Keeping perishable surplus and emergency aid moving when reservations fail, destinations close, or delivery becomes infeasible.*

---

## 1. Product Promise & The Civora Rescue Protocol

Civora coordinates surplus cooked food and emergency relief with **failure-aware dispatch**. Instead of treating matching as an unconstrained matchmaking algorithm or simple directory, every shipment is checked against **time, capacity, demand, and physical infrastructure compatibility**, and precomputes a verifiable recovery plan before departure.

### Core Architectural Differentiators
1. **Interactive Leaflet GPS Map**: Real-world geographical GPS tracking with custom markers, live en-route dashed polylines, layer switching (Voyager Light & OSM), and one-click auto-fit bounds.
2. **Precomputed Fallback Candidates**: Before departure, fallback destinations are evaluated without prematurely locking stock or capacity.
3. **Dynamic Rescue Clock**: Compares the remaining safe shelf-life window against estimated travel time plus a mandatory safety margin (+10m buffer).
4. **Physical Cargo Custody State Machine**: Explicit separation between donor-held stock, rider custody, shelter acceptance, and held intervention:
   $$\text{AVAILABLE} \rightarrow \text{RESERVED} \rightarrow \text{ACKNOWLEDGED} \rightarrow \text{PICKED\_UP} \rightarrow \text{IN\_TRANSIT} \rightarrow \text{DELIVERED}$$
   *Crucial Safety Rule*: In-transit cargo is **never** released back to donor stock upon shelter closure. Custody remains with the volunteer while the engine reroutes or flags an urgent human intervention.
5. **Reservation Leases & Exactly-Once Release**: Unacknowledged volunteer claims expire after a configurable lease deadline (15 mins), releasing stock back to the unassigned batch pool exactly once.
6. **Auditable Decision Log & Reconciled Ledger**: Every trigger, evaluated candidate, rejection reason, and state transition is committed to an append-only SQLite event log.

---

## 2. Technical Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Leaflet (`leaflet` + `@types/leaflet`)
- **Design Concept**: *Calm Command Center* (Navy `#102A43`, Teal `#176B68`, Cool Gray `#F5F7F8`, Rust Red alerts)
- **Backend**: Node.js 22, Express, TypeScript (`server.ts`)
- **Persistence**: Relational SQLite via Node's native `node:sqlite` (`DatabaseSync`), enforcing foreign keys and atomic transactions
- **Testing**: Vitest acceptance test suite (`server/tests/aidflow.test.ts`)
- **Clock**: Injectable, deterministic simulation clock with time-warp controls (`+5m`, `+15m`, `+30m`)

---

## 3. Judge Demonstration Scenarios

Use the **Judge Simulation Lab** in the top navigation or left sidebar to test any of the 5 reproducible judging scenarios with one click:

### Scenario A — Large Batch Capacity-Aware Split
- **Input**: 180 cooked meals with a 75-minute safe-use window (`BATCH-2026-180`).
- **Network**: Five volunteer riders (40-meal vehicle capacity each); receiving shelters with demands of 50, 60, 40 meals.
- **Observed Behavior**: The dispatch engine splits 180 meals across multiple riders without exceeding any rider's 40-meal capacity or any shelter's remaining demand. Unassigned stock is tracked transparently in the allocation ledger.

### Scenario B — Ghost Reservation Lease Timeout
- **Input**: A rider reserves 40 meals but goes unresponsive.
- **Trigger**: The simulation clock advances +18 minutes (past the 15-minute lease deadline).
- **Observed Behavior**: The timeout processor detects the overdue lease and expires the reservation. Exactly 40 meals are released back to the batch pool, and rider capacity is restored. Repeated sweeps have zero duplicate effect.

### Scenario C — Mid-Transit Shelter Closure & Recovery
- **Input**: 40 meals are in transit under active rider custody (`RIDER_CUSTODY`).
- **Trigger**: The destination shelter (`Hope Community Harbor`) unexpectedly closes.
- **Observed Behavior**: Cargo is **not** returned to the donor pool. AidFlow triggers the Rescue Protocol, live-revalidates candidate shelters for item compatibility, remaining demand, and safe arrival window, and safely reroutes the rider.

### Scenario D — Resource Incompatibility Gate
- **Input**: Dehydrated ration kits requiring clean water at destination (`BATCH-RATION-50`).
- **Target**: `Shelter E (Dry Creek Depot)`, where municipal water lines are severed.
- **Observed Behavior**: The deterministic dispatch engine blocks the allocation with an explicit rejection reason: `"Lacks required resource: CLEAN_WATER"`. Zero meals are misallocated to an incapable destination.

### Scenario E — Expiry Infeasibility Gate (Safety Over Utilization)
- **Input**: Perishable bakery batch with 3 minutes remaining to safe-use deadline.
- **Target**: Closest candidate requires 14 minutes travel time + 10m safety margin.
- **Observed Behavior**: The assignment is rejected because total arrival time exceeds the deadline. Rather than fabricating a false on-time delivery, AidFlow alerts the operator that human intervention is required.

---

## 4. Getting Started & Verification Commands

### Install Dependencies
```bash
npm install
```

### Run Automated Acceptance Tests
```bash
npm run test
```
*Runs 8 test suites covering capacity splitting, deadline enforcement, clean water gating, ghost reservation expiry, mid-transit rerouting, and cargo custody invariants.*

### Start Full-Stack Development Server
```bash
npm run dev
```
*Server launches on `http://0.0.0.0:3000` with Express backend API routes on `/api/*` and Vite React frontend.*

### Production Build
```bash
npm run build
```

---

## 5. Honest Claims & Prototype Boundaries

- **What is verified & implemented**: Relational persistence, deterministic feasibility constraints, resource gating (clean water/cooking fuel), capacity-aware batch splitting, reservation leases with exactly-once release, mid-transit rerouting preserving rider custody, and an append-only audit trail.
- **What is simulated**: Transit travel times are calculated based on simulated schematic topology coordinates; clock time is controlled via the injectable simulation clock for reproducible demonstration.
- **Safety notice**: Expiry limits are configured inputs supplied by donors and coordinators, not automated medical or biochemical certifications.
