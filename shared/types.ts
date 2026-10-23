export type CategoryType = 
  | 'COOKED_MEALS'
  | 'PERISHABLE_PRODUCE'
  | 'RATION_KITS'
  | 'BAKERY'
  | 'COLD_STORAGE_DAIRY';

export type AssignmentStatus = 
  | 'RESERVED'
  | 'ACKNOWLEDGED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'INTERVENTION_REQUIRED';

export type CargoCustody = 
  | 'AT_DONOR'
  | 'RIDER_CUSTODY'
  | 'DELIVERED_TO_SHELTER'
  | 'INTERVENTION_HELD';

export interface LocationCoord {
  name: string;
  address: string;
  x: number; // schematic percent X [0-100]
  y: number; // schematic percent Y [0-100]
  lat?: number;
  lng?: number;
}

export interface AidBatch {
  id: string;
  donorName: string;
  category: CategoryType;
  totalQuantity: number;
  unit: string;
  origin: LocationCoord;
  safeUseDeadline: string; // ISO UTC
  handlingRequirements: string[];
  status: 'AVAILABLE' | 'PARTIALLY_DISPATCHED' | 'FULLY_DISPATCHED' | 'EXPIRED' | 'COMPLETED';
  notes?: string;
  createdAt: string;
}

export interface Shelter {
  id: string;
  name: string;
  location: LocationCoord;
  active: boolean;
  capacityLimit: number;
  currentOccupancy: number;
  demandByCategory: Record<CategoryType | string, number>;
  resources: string[]; // e.g. ['CLEAN_WATER', 'COOKING_FUEL', 'COLD_STORAGE', 'HOT_HOLDING']
  priority: 'CRITICAL' | 'HIGH' | 'STANDARD';
  updatedAt: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicleType: 'CARGO_BIKE' | 'E_SCOOTER' | 'VAN' | 'MOTORCYCLE';
  capacity: number;
  currentLoad: number;
  available: boolean;
  location: LocationCoord;
  capabilities: string[]; // e.g. ['INSULATED_BAG', 'COLD_BOX', 'LARGE_RACK']
  status: 'IDLE' | 'RESERVED' | 'IN_TRANSIT' | 'OFFLINE';
  updatedAt: string;
}

export interface FallbackCandidate {
  shelterId: string;
  shelterName: string;
  estimatedMinutes: number;
  feasible: boolean;
  score: number;
  rejectionReason?: string;
  remainingDemand: number;
  missingResources: string[];
}

export interface Assignment {
  id: string;
  batchId: string;
  batchName: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  riderId: string;
  riderName: string;
  shelterId: string;
  shelterName: string;
  origin: LocationCoord;
  destination: LocationCoord;
  status: AssignmentStatus;
  custody: CargoCustody;
  leaseDeadline: string; // when unacknowledged reservation expires (ISO UTC)
  estimatedTravelMinutes: number;
  safetyMarginMinutes: number;
  safeUseDeadline: string; // original immutable safe-use window
  precomputedFallbacks: FallbackCandidate[];
  rejectionReason?: string;
  interventionReason?: string;
  acknowledgedAt?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchLedger {
  batchId: string;
  totalQty: number;
  unassignedQty: number;
  reservedQty: number;
  inTransitQty: number;
  deliveredQty: number;
  interventionQty: number;
  reconciled: boolean;
}

export interface OperationalEvent {
  id: string;
  timestamp: string; // simulated ISO UTC
  entityType: 'BATCH' | 'ASSIGNMENT' | 'RIDER' | 'SHELTER' | 'SIMULATION' | 'RESCUE';
  entityId: string;
  eventType: string;
  severity: 'INFO' | 'SUCCESS' | 'CAUTION' | 'CRITICAL';
  trigger: string;
  reason: string;
  affectedQuantity?: number;
  metadata?: Record<string, any>;
}

export interface DispatchCandidateEvaluation {
  riderId: string;
  riderName: string;
  riderCapacity: number;
  riderAvailableCapacity: number;
  shelterId: string;
  shelterName: string;
  shelterDemand: number;
  allocatedQty: number;
  estimatedTravelMinutes: number;
  feasible: boolean;
  rejectionReason?: string;
  score: number;
  missingRequirements: string[];
}

export interface DispatchPlanPreview {
  batchId: string;
  batchCategory: CategoryType;
  totalBatchQty: number;
  unassignedBefore: number;
  proposedAllocations: Array<{
    riderId: string;
    riderName: string;
    shelterId: string;
    shelterName: string;
    quantity: number;
    estimatedMinutes: number;
    score: number;
    fallbackCount: number;
  }>;
  rejectedCandidates: DispatchCandidateEvaluation[];
  allocatedTotalQty: number;
  remainingUnassignedQty: number;
  explanation: string;
}

export interface RescueEvaluationResult {
  assignmentId: string;
  currentStatus: AssignmentStatus;
  custody: CargoCustody;
  quantity: number;
  safeUseDeadline: string;
  minutesRemainingToDeadline: number;
  candidates: FallbackCandidate[];
  bestFeasibleCandidate?: FallbackCandidate;
  canAutoRecover: boolean;
  recommendation: string;
}

export interface DashboardSummary {
  simulatedTime: string;
  batchesCount: number;
  activeShipmentsCount: number;
  deliveredTodayCount: number;
  interventionRequiredCount: number;
  rescueQueue: Assignment[];
  ledgerSummary: {
    totalPerishableUnits: number;
    unassignedUnits: number;
    reservedUnits: number;
    inTransitUnits: number;
    deliveredUnits: number;
    interventionUnits: number;
  };
  riders: {
    total: number;
    available: number;
    inTransit: number;
  };
  shelters: {
    total: number;
    active: number;
    totalRemainingDemand: number;
  };
  criticalAlerts: Array<{
    id: string;
    assignmentId?: string;
    title: string;
    message: string;
    severity: 'CAUTION' | 'CRITICAL';
    timestamp: string;
  }>;
}
