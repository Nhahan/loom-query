import { getDb } from '../client';
import { SettingSchema, type Setting } from '../schemas';

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
  if (!row) return null;
  return SettingSchema.parse(row).value;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  const updated_at = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, updated_at);
}

export function getAllSettings(): Setting[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings ORDER BY key ASC').all();
  return rows.map((row) => SettingSchema.parse(row));
}
