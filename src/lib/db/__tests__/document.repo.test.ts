import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const memDb = new Database(':memory:');
memDb.pragma('journal_mode = WAL');
memDb.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    format TEXT NOT NULL,
    size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    tags TEXT NOT NULL DEFAULT '[]',
    file_path TEXT,
    content TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    owner_id TEXT,
    shared_users TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

vi.mock('@/lib/db/client', () => ({
  getDb: () => memDb,
}));

type DocRepo = typeof import('@/lib/db/repositories/document.repo');
let createDocument: DocRepo['createDocument'];
let getDocument: DocRepo['getDocument'];
let listDocuments: DocRepo['listDocuments'];
let updateDocumentStatus: DocRepo['updateDocumentStatus'];
let deleteDocument: DocRepo['deleteDocument'];
let shareDocument: DocRepo['shareDocument'];
let getUserDocuments: DocRepo['getUserDocuments'];

beforeAll(async () => {
  const repo = await import('@/lib/db/repositories/document.repo');
  createDocument = repo.createDocument;
  getDocument = repo.getDocument;
  listDocuments = repo.listDocuments;
  updateDocumentStatus = repo.updateDocumentStatus;
  deleteDocument = repo.deleteDocument;
  shareDocument = repo.shareDocument;
  getUserDocuments = repo.getUserDocuments;
});

function makeDoc(overrides?: object) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: 'test.pdf',
    format: '.pdf',
    size: 1024,
    file_path: '/tmp/test.pdf',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('document.repo', () => {
  beforeEach(() => {
    memDb.prepare('DELETE FROM documents').run();
  });

  it('createDocument inserts and returns the document', () => {
    const input = makeDoc();
    const doc = createDocument(input);
    expect(doc.id).toBe(input.id);
    expect(doc.name).toBe('test.pdf');
    expect(doc.status).toBe('waiting');
    expect(doc.chunk_count).toBe(0);
  });

  it('getDocument returns null for unknown id', () => {
    expect(getDocument('nonexistent')).toBeNull();
  });

  it('getDocument returns the document after creation', () => {
    const input = makeDoc();
    createDocument(input);
    const doc = getDocument(input.id);
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe(input.id);
  });

  it('listDocuments returns all documents', () => {
    createDocument(makeDoc());
    createDocument(makeDoc());
    const docs = listDocuments();
    expect(docs.length).toBe(2);
  });

  it('listDocuments filters by status', () => {
    createDocument(makeDoc());
    const d2 = makeDoc();
    createDocument(d2);
    updateDocumentStatus(d2.id, 'done');
    const done = listDocuments({ status: 'done' });
    expect(done.length).toBe(1);
    expect(done[0].id).toBe(d2.id);
  });

  it('updateDocumentStatus changes status', () => {
    const input = makeDoc();
    createDocument(input);
    updateDocumentStatus(input.id, 'processing');
    const doc = getDocument(input.id);
    expect(doc!.status).toBe('processing');
  });

  it('updateDocumentStatus updates chunk_count when provided', () => {
    const input = makeDoc();
    createDocument(input);
    updateDocumentStatus(input.id, 'done', { chunk_count: 42 });
    const doc = getDocument(input.id);
    expect(doc!.chunk_count).toBe(42);
  });

  it('updateDocumentStatus rejects invalid status', () => {
    const input = makeDoc();
    createDocument(input);
    expect(() =>
      updateDocumentStatus(input.id, 'invalid' as never),
    ).toThrow();
  });

  it('deleteDocument removes the document', () => {
    const input = makeDoc();
    createDocument(input);
    deleteDocument(input.id);
    expect(getDocument(input.id)).toBeNull();
  });

  it('createDocument stores and retrieves content field', () => {
    const input = makeDoc({ content: 'This is the extracted PDF text content.' });
    const doc = createDocument(input);
    expect(doc.content).toBe('This is the extracted PDF text content.');
    const fetched = getDocument(input.id);
    expect(fetched!.content).toBe('This is the extracted PDF text content.');
  });

  it('createDocument defaults content to null when not provided', () => {
    const input = makeDoc();
    const doc = createDocument(input);
    expect(doc.content).toBeNull();
    const fetched = getDocument(input.id);
    expect(fetched!.content).toBeNull();
  });

  it('listDocuments with pagination boundaries - offset > total', () => {
    createDocument(makeDoc());
    createDocument(makeDoc());
    const docs = listDocuments({ offset: 10, limit: 50 });
    expect(docs.length).toBe(0);
  });

  it('listDocuments with pagination boundaries - offset at boundary', () => {
    createDocument(makeDoc());
    createDocument(makeDoc());
    createDocument(makeDoc());
    const docs = listDocuments({ offset: 2, limit: 50 });
    expect(docs.length).toBe(1);
  });

  it('listDocuments with pagination boundaries - limit < total', () => {
    for (let i = 0; i < 5; i++) {
      createDocument(makeDoc());
    }
    const docs = listDocuments({ offset: 0, limit: 2 });
    expect(docs.length).toBe(2);
  });

  describe('document permissions', () => {
    it('shareDocument adds userId to shared_users', () => {
      const doc = createDocument(makeDoc({ owner_id: 'user-1' }));
      shareDocument(doc.id, 'user-2');
      const updated = getDocument(doc.id);
      const sharedUsers = JSON.parse(updated!.shared_users as string);
      expect(sharedUsers).toContain('user-2');
    });

    it('shareDocument does not add duplicate userId', () => {
      const doc = createDocument(makeDoc({ owner_id: 'user-1' }));
      shareDocument(doc.id, 'user-2');
      shareDocument(doc.id, 'user-2');
      const updated = getDocument(doc.id);
      const sharedUsers = JSON.parse(updated!.shared_users as string);
      expect(sharedUsers.filter((u: string) => u === 'user-2').length).toBe(1);
    });

    it('getUserDocuments returns documents owned by user', () => {
      createDocument(makeDoc({ owner_id: 'owner-1' }));
      createDocument(makeDoc({ owner_id: 'owner-2' }));
      const docs = getUserDocuments('owner-1');
      expect(docs.length).toBe(1);
      expect(docs[0].owner_id).toBe('owner-1');
    });

    it('getUserDocuments returns shared documents', () => {
      const doc = createDocument(makeDoc({ owner_id: 'owner-1' }));
      shareDocument(doc.id, 'shared-user');
      const docs = getUserDocuments('shared-user');
      expect(docs.length).toBe(1);
      expect(docs[0].id).toBe(doc.id);
    });

    it('getUserDocuments does not return unshared documents for non-owner', () => {
      createDocument(makeDoc({ owner_id: 'owner-1' }));
      const docs = getUserDocuments('other-user');
      expect(docs.length).toBe(0);
    });
  });
});
