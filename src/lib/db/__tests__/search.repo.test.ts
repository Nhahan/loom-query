import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '@/lib/db/schema';

const memDb = new Database(':memory:');
memDb.pragma('journal_mode = WAL');
runMigrations(memDb);

vi.mock('@/lib/db/client', () => ({
  getDb: () => memDb,
}));

type SearchRepo = typeof import('@/lib/db/repositories/search.repo');
let logSearch: SearchRepo['logSearch'];

beforeAll(async () => {
  const repo = await import('@/lib/db/repositories/search.repo');
  logSearch = repo.logSearch;
});

describe('search.repo', () => {
  beforeEach(() => {
    memDb.prepare('DELETE FROM search_logs').run();
  });

  it('logSearch inserts and returns the search log', () => {
    const result = logSearch('test query', 5);
    expect(result.query).toBe('test query');
    expect(result.result_count).toBe(5);
    expect(result.id).toBeTruthy();
    expect(result.created_at).toBeTruthy();
  });

  it('logSearch persists to database', () => {
    logSearch('hello world', 3);
    const row = memDb.prepare('SELECT * FROM search_logs WHERE query = ?').get('hello world') as {
      query: string;
      result_count: number;
    } | undefined;
    expect(row).not.toBeUndefined();
    expect(row!.result_count).toBe(3);
  });

  it('logSearch with zero results', () => {
    const result = logSearch('empty search', 0);
    expect(result.result_count).toBe(0);
  });

  it('logSearch multiple entries are all stored', () => {
    logSearch('query one', 1);
    logSearch('query two', 2);
    logSearch('query three', 3);
    const rows = memDb.prepare('SELECT COUNT(*) as count FROM search_logs').get() as {
      count: number;
    };
    expect(rows.count).toBe(3);
  });
});

describe('database indexes', () => {
  it('idx_documents_status_created index exists', () => {
    const row = memDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_documents_status_created'",
      )
      .get() as { name: string } | undefined;
    expect(row).not.toBeUndefined();
    expect(row!.name).toBe('idx_documents_status_created');
  });

  it('idx_search_logs_created index exists', () => {
    const row = memDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_search_logs_created'",
      )
      .get() as { name: string } | undefined;
    expect(row).not.toBeUndefined();
    expect(row!.name).toBe('idx_search_logs_created');
  });

  it('idx_documents_status index exists', () => {
    const row = memDb
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_documents_status'")
      .get() as { name: string } | undefined;
    expect(row).not.toBeUndefined();
  });

  it('idx_documents_created_at index exists', () => {
    const row = memDb
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_documents_created_at'",
      )
      .get() as { name: string } | undefined;
    expect(row).not.toBeUndefined();
  });
});
