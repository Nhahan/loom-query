import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const memDb = new Database(':memory:');
memDb.pragma('journal_mode = WAL');
memDb.pragma('foreign_keys = ON');
memDb.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    tags TEXT NOT NULL DEFAULT '[]',
    file_path TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
    helpful INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

vi.mock('@/lib/db/client', () => ({
  getDb: () => memDb,
}));

type FeedbackRepo = typeof import('@/lib/db/repositories/feedback.repo');
let createFeedback: FeedbackRepo['createFeedback'];
let listFeedback: FeedbackRepo['listFeedback'];

beforeAll(async () => {
  const repo = await import('@/lib/db/repositories/feedback.repo');
  createFeedback = repo.createFeedback;
  listFeedback = repo.listFeedback;
});

function makeEntry(overrides?: object) {
  return {
    message_id: uuidv4(),
    document_id: null,
    helpful: 1,
    ...overrides,
  };
}

describe('feedback.repo', () => {
  beforeEach(() => {
    memDb.prepare('DELETE FROM feedback').run();
  });

  it('createFeedback inserts and returns the feedback entry', () => {
    const input = makeEntry();
    const result = createFeedback(input);
    expect(result.message_id).toBe(input.message_id);
    expect(result.helpful).toBe(1);
  });

  it('createFeedback auto-generates id (caller does not supply it)', () => {
    const r1 = createFeedback(makeEntry());
    const r2 = createFeedback(makeEntry());
    expect(r1.id).toBeDefined();
    expect(r1.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r1.id).not.toBe(r2.id);
  });

  it('createFeedback auto-generates created_at as ISO string', () => {
    const before = new Date().toISOString();
    const result = createFeedback(makeEntry());
    const after = new Date().toISOString();
    expect(result.created_at >= before).toBe(true);
    expect(result.created_at <= after).toBe(true);
  });

  it('listFeedback returns all entries ordered by created_at DESC', () => {
    createFeedback(makeEntry());
    createFeedback(makeEntry());
    const list = listFeedback();
    expect(list.length).toBe(2);
    expect(list[0].created_at >= list[1].created_at).toBe(true);
  });

  it('listFeedback filters by message_id', () => {
    const mid = uuidv4();
    createFeedback(makeEntry({ message_id: mid }));
    createFeedback(makeEntry());
    const results = listFeedback({ message_id: mid });
    expect(results.length).toBe(1);
    expect(results[0].message_id).toBe(mid);
  });

  it('listFeedback filters by document_id', () => {
    const did = uuidv4();
    memDb.prepare(`
      INSERT INTO documents (id, name, format, size, created_at, updated_at)
      VALUES (?, 'test.pdf', 'pdf', 1024, datetime('now'), datetime('now'))
    `).run(did);
    createFeedback(makeEntry({ document_id: did }));
    createFeedback(makeEntry({ document_id: null }));
    const results = listFeedback({ document_id: did });
    expect(results.length).toBe(1);
    expect(results[0].document_id).toBe(did);
  });

  it('listFeedback respects limit and offset', () => {
    for (let i = 0; i < 5; i++) {
      createFeedback(makeEntry());
    }
    const page1 = listFeedback({ limit: 2, offset: 0 });
    const page2 = listFeedback({ limit: 2, offset: 2 });
    expect(page1.length).toBe(2);
    expect(page2.length).toBe(2);
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('FK constraint prevents invalid document_id', () => {
    const invalidDocId = uuidv4();
    const entry = makeEntry({ document_id: invalidDocId });
    expect(() => createFeedback(entry)).toThrow();
  });

  it('FK constraint allows NULL document_id', () => {
    const entry = makeEntry({ document_id: null });
    const result = createFeedback(entry);
    expect(result.document_id).toBeNull();
  });

  it('FK constraint allows valid document_id', () => {
    const docId = uuidv4();
    memDb.prepare(`
      INSERT INTO documents (id, name, format, size, created_at, updated_at)
      VALUES (?, 'test.pdf', 'pdf', 1024, datetime('now'), datetime('now'))
    `).run(docId);

    const entry = makeEntry({ document_id: docId });
    const result = createFeedback(entry);
    expect(result.document_id).toBe(docId);
  });

  it('FK constraint sets document_id to NULL on document deletion', () => {
    const docId = uuidv4();
    memDb.prepare(`
      INSERT INTO documents (id, name, format, size, created_at, updated_at)
      VALUES (?, 'test.pdf', 'pdf', 1024, datetime('now'), datetime('now'))
    `).run(docId);

    const entry = makeEntry({ document_id: docId });
    const feedbackRecord = createFeedback(entry);
    expect(feedbackRecord.document_id).toBe(docId);

    // Delete the document
    memDb.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    // Verify feedback.document_id is now NULL
    const updated = memDb.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackRecord.id) as { document_id: string | null } | undefined;
    expect(updated?.document_id).toBeNull();
  });
});
