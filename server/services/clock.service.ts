import { getDatabase } from '../db/database.js';

export const DEFAULT_SIMULATION_START = '2026-10-23T10:00:00.000Z';

export class ClockService {
  private static memoryOverride: string | null = null;

  static setMemoryOverride(timeIso: string | null) {
    this.memoryOverride = timeIso;
  }

  static getNowIso(): string {
    if (this.memoryOverride) {
      return this.memoryOverride;
    }
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT value FROM simulation_state WHERE key = ?').get('simulated_now') as { value: string } | undefined;
      if (row && row.value) {
        return row.value;
      }
    } catch {
      // fallback
    }
    return DEFAULT_SIMULATION_START;
  }

  static getNowDate(): Date {
    return new Date(this.getNowIso());
  }

  static setNowIso(timeIso: string): string {
    const valid = new Date(timeIso).toISOString();
    if (this.memoryOverride !== null) {
      this.memoryOverride = valid;
    }
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO simulation_state (key, value) VALUES ('simulated_now', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(valid);
    } catch {
      // ignore if memory only
    }
    return valid;
  }

  static advanceMinutes(minutes: number): string {
    const current = this.getNowDate();
    const updated = new Date(current.getTime() + minutes * 60 * 1000).toISOString();
    return this.setNowIso(updated);
  }

  static advanceMinutesFrom(iso: string, minutes: number): string {
    const d = new Date(iso);
    return new Date(d.getTime() + minutes * 60 * 1000).toISOString();
  }

  static resetToDefault(): string {
    return this.setNowIso(DEFAULT_SIMULATION_START);
  }

  static minutesDiff(targetIso: string, fromIso?: string): number {
    const fromTime = fromIso ? new Date(fromIso).getTime() : this.getNowDate().getTime();
    const targetTime = new Date(targetIso).getTime();
    return Math.round((targetTime - fromTime) / (60 * 1000));
  }
}
