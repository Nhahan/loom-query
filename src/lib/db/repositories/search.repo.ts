import { v4 as uuid } from 'uuid';
import { getDb } from '../client';
import { SearchSchema, type Search } from '../schemas';
import { DocumentSchema, type Document } from '../schemas';
import { z } from 'zod';

export function logSearch(query: string, resultCount: number): Search {
  const db = getDb();
  const record = {
    id: uuid(),
    query,
    result_count: resultCount,
    created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO search_logs (id, query, result_count, created_at)
    VALUES (@id, @query, @result_count, @created_at)
  `).run(record);
  return SearchSchema.parse(record);
}

export interface TopSearch {
  query: string;
  count: number;
  avg_result_count: number;
}

export function getTopSearches(limit = 10): TopSearch[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT query, COUNT(*) as count, AVG(result_count) as avg_result_count
       FROM search_logs
       GROUP BY query
       ORDER BY count DESC
       LIMIT ?`,
    )
    .all(limit) as { query: string; count: number; avg_result_count: number }[];
  return rows.map((r) => ({
    query: r.query,
    count: r.count,
    avg_result_count: Math.round(r.avg_result_count * 100) / 100,
  }));
}

export interface FTSResult {
  document_id: string;
  name: string;
  rank: number;
  relevance: number;
}

/**
 * Full-text search using FTS5 virtual table
 * Returns top 10 results sorted by BM25 relevance
 * Respects user permissions (owner_id and shared_users)
 */
export function searchFullText(query: string, userId: string): FTSResult[] {
  const db = getDb();

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

/**
 * Populate FTS table when document is created or updated
 */
export function indexDocumentForFullText(documentId: string, name: string, content: string | null): void {
  const db = getDb();
  const contentToIndex = content || '';

  // Delete existing entry and insert fresh (simpler than update-or-insert)
  db.prepare('DELETE FROM documents_fts WHERE id = ?').run(documentId);
  db.prepare(`
    INSERT INTO documents_fts (id, name, content)
    VALUES (?, ?, ?)
  `).run(documentId, name, contentToIndex);
}

/**
 * Remove document from FTS index
 */
export function removeDocumentFromFullText(documentId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM documents_fts WHERE id = ?').run(documentId);
}
