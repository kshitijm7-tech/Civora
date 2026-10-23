import { DatabaseSync } from 'node:sqlite';
import path from 'path';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const resolvedPath = dbPath || process.env.AIDFLOW_DB_PATH || path.join(process.cwd(), 'aidflow.db');
  const db = new DatabaseSync(resolvedPath);
  
  // Pragmas for performance and data integrity
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      donor_name TEXT NOT NULL,
      category TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      origin_json TEXT NOT NULL,
      safe_use_deadline TEXT NOT NULL,
      handling_requirements_json TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shelters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      capacity_limit INTEGER NOT NULL,
      current_occupancy INTEGER NOT NULL DEFAULT 0,
      demand_by_category_json TEXT NOT NULL,
      resources_json TEXT NOT NULL,
      priority TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS riders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      current_load INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      location_json TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      batch_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      rider_id TEXT NOT NULL,
      rider_name TEXT NOT NULL,
      shelter_id TEXT NOT NULL,
      shelter_name TEXT NOT NULL,
      origin_json TEXT NOT NULL,
      destination_json TEXT NOT NULL,
      status TEXT NOT NULL,
      custody TEXT NOT NULL,
      lease_deadline TEXT NOT NULL,
      estimated_travel_minutes REAL NOT NULL,
      safety_margin_minutes REAL NOT NULL,
      safe_use_deadline TEXT NOT NULL,
      precomputed_fallbacks_json TEXT NOT NULL,
      rejection_reason TEXT,
      intervention_reason TEXT,
      acknowledged_at TEXT,
      picked_up_at TEXT,
      in_transit_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      trigger TEXT NOT NULL,
      reason TEXT NOT NULL,
      affected_quantity INTEGER,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS simulation_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  if (!dbPath) {
    dbInstance = db;
  }
  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}
