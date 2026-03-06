import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const memDb = new Database(':memory:');
memDb.pragma('journal_mode = WAL');
memDb.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );
`);

vi.mock('@/lib/db/client', () => ({
  getDb: () => memDb,
}));

type ActivityRepo = typeof import('@/lib/db/repositories/activity.repo');
let logActivity: ActivityRepo['logActivity'];
let listActivities: ActivityRepo['listActivities'];

beforeAll(async () => {
  const repo = await import('@/lib/db/repositories/activity.repo');
  logActivity = repo.logActivity;
  listActivities = repo.listActivities;
});

function makeEntry(overrides?: object) {
  return {
    action: 'upload',
    entity_type: 'document',
    entity_id: uuidv4(),
    details: null,
    ...overrides,
  };
}

describe('activity.repo', () => {
  beforeEach(() => {
    memDb.prepare('DELETE FROM activity_log').run();
  });

  it('logActivity inserts and returns the log entry', () => {
    const input = makeEntry();
    const result = logActivity(input);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeDefined();
    expect(result.action).toBe('upload');
  });

  it('logActivity auto-generates id (caller does not supply it)', () => {
    const r1 = logActivity(makeEntry());
    const r2 = logActivity(makeEntry());
    expect(r1.id).not.toBe(r2.id);
    expect(r1.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logActivity auto-generates created_at as ISO string', () => {
    const before = new Date().toISOString();
    const result = logActivity(makeEntry());
    const after = new Date().toISOString();
    expect(result.created_at >= before).toBe(true);
    expect(result.created_at <= after).toBe(true);
  });

  it('listActivities returns all entries ordered by created_at DESC', () => {
    logActivity(makeEntry());
    logActivity(makeEntry());
    const list = listActivities();
    expect(list.length).toBe(2);
    expect(list[0].created_at >= list[1].created_at).toBe(true);
  });

  it('listActivities filters by entity_type', () => {
    logActivity(makeEntry({ entity_type: 'document' }));
    logActivity(makeEntry({ entity_type: 'api_key' }));
    const docs = listActivities({ entity_type: 'document' });
    expect(docs.length).toBe(1);
    expect(docs[0].entity_type).toBe('document');
  });

  it('listActivities filters by entity_id', () => {
    const eid = uuidv4();
    logActivity(makeEntry({ entity_id: eid }));
    logActivity(makeEntry());
    const results = listActivities({ entity_id: eid });
    expect(results.length).toBe(1);
    expect(results[0].entity_id).toBe(eid);
  });

  it('listActivities respects limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      logActivity(makeEntry());
    }
    const page1 = listActivities({ limit: 2, offset: 0 });
    const page2 = listActivities({ limit: 2, offset: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });
});
