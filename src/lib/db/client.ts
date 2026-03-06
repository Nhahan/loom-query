import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { runMigrations } from './schema';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'loomquery.db');

let instance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (instance) return instance;

  mkdirSync(DATA_DIR, { recursive: true });

  instance = new Database(DB_PATH);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  // Initialize all 5 tables (documents, api_keys, activity_log, feedback, settings)
  runMigrations(instance);

  return instance;
}

/**
 * Closes the SQLite database connection and flushes the WAL file.
 * Call this during graceful shutdown to prevent WAL file corruption.
 */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
