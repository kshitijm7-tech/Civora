import { getDatabase } from '../db/database.js';
import { ClockService } from './clock.service.js';
import type { OperationalEvent } from '../../shared/types.js';

export class EventLogService {
  static record(event: Omit<OperationalEvent, 'id' | 'timestamp'> & { timestamp?: string }): OperationalEvent {
    const db = getDatabase();
    const id = 'EVT-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const timestamp = event.timestamp || ClockService.getNowIso();
    const metadataJson = event.metadata ? JSON.stringify(event.metadata) : null;

    db.prepare(`
      INSERT INTO events (id, timestamp, entity_type, entity_id, event_type, severity, trigger, reason, affected_quantity, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      timestamp,
      event.entityType,
      event.entityId,
      event.eventType,
      event.severity,
      event.trigger,
      event.reason,
      event.affectedQuantity ?? null,
      metadataJson
    );

    return {
      id,
      timestamp,
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      severity: event.severity,
      trigger: event.trigger,
      reason: event.reason,
      affectedQuantity: event.affectedQuantity,
      metadata: event.metadata,
    };
  }

  static getRecent(limit: number = 50, entityId?: string): OperationalEvent[] {
    const db = getDatabase();
    let rows: any[];
    if (entityId) {
      rows = db.prepare(`
        SELECT * FROM events WHERE entity_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?
      `).all(entityId, limit);
    } else {
      rows = db.prepare(`
        SELECT * FROM events ORDER BY timestamp DESC, rowid DESC LIMIT ?
      `).all(limit);
    }

    return rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      entityType: r.entity_type,
      entityId: r.entity_id,
      eventType: r.event_type,
      severity: r.severity,
      trigger: r.trigger,
      reason: r.reason,
      affectedQuantity: r.affected_quantity,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
    }));
  }
}
