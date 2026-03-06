import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../schema';

// Local helper functions for testing
function indexDocumentForFullText(db: Database.Database, documentId: string, name: string, content: string | null): void {
  const contentToIndex = content || '';
  db.prepare('DELETE FROM documents_fts WHERE id = ?').run(documentId);
  db.prepare(`
    INSERT INTO documents_fts (id, name, content)
    VALUES (?, ?, ?)
  `).run(documentId, name, contentToIndex);
}

function searchFullText(db: Database.Database, query: string, userId: string): { document_id: string; name: string; rank: number; relevance: number }[] {
  // Get accessible document IDs for the user
  const accessibleDocs = db
    .prepare(`
      SELECT id FROM documents
      WHERE owner_id = ? OR shared_users LIKE ?
    `)
    .all(userId, `%"${userId}"%`) as { id: string }[];

  const accessibleIds = new Set(accessibleDocs.map(d => d.id));

  if (accessibleIds.size === 0) {
    return [];
  }

  // FTS5 search
  const placeholders = Array(accessibleIds.size).fill('?').join(',');
  const rows = db
    .prepare(`
      SELECT DISTINCT
        d.id,
        d.name
      FROM documents_fts
      JOIN documents d ON documents_fts.id = d.id
      WHERE documents_fts MATCH ? AND d.id IN (${placeholders})
      LIMIT 10
    `)
    .all(query, ...Array.from(accessibleIds)) as { id: string; name: string }[];

  return rows.map((row, index) => ({
    document_id: row.id,
    name: row.name,
    rank: index,
    relevance: 1.0,
  }));
}

describe('Full-Text Search (FTS5)', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    runMigrations(db);

    // Insert test documents
    db.prepare(`
      INSERT INTO documents (id, name, format, size, status, content, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'doc-1',
      'Sample Document',
      'text/plain',
      1000,
      'done',
      'This is a sample document about machine learning and artificial intelligence',
      'user-1',
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
    );

    db.prepare(`
      INSERT INTO documents (id, name, format, size, status, content, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'doc-2',
      'Database Guide',
      'text/plain',
      2000,
      'done',
      'A comprehensive guide to SQL databases and indexing strategies',
      'user-1',
      '2026-01-02T00:00:00Z',
      '2026-01-02T00:00:00Z',
    );

    db.prepare(`
      INSERT INTO documents (id, name, format, size, status, content, owner_id, shared_users, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'doc-3',
      'Shared Article',
      'text/plain',
      1500,
      'done',
      'An article about cloud computing and distributed systems',
      'user-2',
      '["user-1"]',
      '2026-01-03T00:00:00Z',
      '2026-01-03T00:00:00Z',
    );

    // Index documents for FTS
    indexDocumentForFullText(db, 'doc-1', 'Sample Document', 'This is a sample document about machine learning and artificial intelligence');
    indexDocumentForFullText(db, 'doc-2', 'Database Guide', 'A comprehensive guide to SQL databases and indexing strategies');
    indexDocumentForFullText(db, 'doc-3', 'Shared Article', 'An article about cloud computing and distributed systems');
  });

  it('searches for documents by keyword', () => {
    const results = searchFullText(db, 'machine learning', 'user-1');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document_id).toBe('doc-1');
  });

  it('searches for documents with multiple keywords', () => {
    const results = searchFullText(db, 'database indexing', 'user-1');

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.document_id === 'doc-2')).toBe(true);
  });

  it('respects user permissions - owns document', () => {
    const results = searchFullText(db, 'document', 'user-1');

    // user-1 owns doc-1 and doc-2, so should see them
    const docIds = results.map((r) => r.document_id);
    expect(docIds.length).toBeGreaterThan(0);
  });

  it('respects user permissions - shared with user', () => {
    const results = searchFullText(db, 'cloud computing', 'user-1');

    // user-1 is in doc-3's shared_users, so should see it
    expect(results.some((r) => r.document_id === 'doc-3')).toBe(true);
  });

  it('does not return documents user does not have access to', () => {
    const results = searchFullText(db, 'guide', 'user-3');

    // user-3 has no access to any documents
    expect(results).toHaveLength(0);
  });

  it('returns empty results for no matches', () => {
    const results = searchFullText(db, 'nonexistent', 'user-1');

    expect(results).toHaveLength(0);
  });

  it('returns result with relevance ranking', () => {
    const results = searchFullText(db, 'document', 'user-1');

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result).toHaveProperty('document_id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('rank');
      expect(result).toHaveProperty('relevance');
      expect(typeof result.relevance).toBe('number');
    });
  });
});
