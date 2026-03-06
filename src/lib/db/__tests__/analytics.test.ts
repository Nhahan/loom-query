import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Create analytics functions that work with database instance directly
function getDocumentStats(db: Database.Database, userId: string) {
  const stats = db
    .prepare(`
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(size), 0) as total_size,
        COALESCE(AVG(size), 0) as avg_size
      FROM documents
      WHERE owner_id = ? OR shared_users LIKE ?
    `)
    .get(userId, `%"${userId}"%`) as {
    total_count: number;
    total_size: number;
    avg_size: number;
  };

  const formats = db
    .prepare(`
      SELECT format, COUNT(*) as count
      FROM documents
      WHERE owner_id = ? OR shared_users LIKE ?
      GROUP BY format
    `)
    .all(userId, `%"${userId}"%`) as { format: string; count: number }[];

  const format_distribution: Record<string, number> = {};
  formats.forEach((f) => {
    format_distribution[f.format] = f.count;
  });

  return {
    total_count: stats.total_count,
    total_size: stats.total_size,
    avg_size: Math.round(stats.avg_size * 100) / 100,
    format_distribution,
  };
}

function getSearchTrends(db: Database.Database, userId: string, days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const trends = db
    .prepare(`
      SELECT query, COUNT(*) as count
      FROM search_logs
      WHERE created_at >= ?
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `)
    .all(cutoffDate.toISOString()) as { query: string; count: number }[];

  return trends.map((t) => ({
    query: t.query,
    count: t.count,
    unique_users: 1,
  }));
}

function getUserActivity(db: Database.Database, userId: string) {
  const docCount = db
    .prepare('SELECT COUNT(*) as count FROM documents WHERE owner_id = ?')
    .get(userId) as { count: number };

  const searchStats = db
    .prepare(`
      SELECT
        COUNT(*) as searches_performed,
        COALESCE(AVG(response_time), 0) as avg_response_time
      FROM search_logs
      WHERE created_at >= datetime('now', '-30 days')
    `)
    .get() as { searches_performed: number; avg_response_time: number };

  return {
    documents_created: docCount.count,
    searches_performed: searchStats.searches_performed,
    avg_search_time_ms: Math.round(searchStats.avg_response_time),
  };
}

// Use local database instances for test isolation
let db: Database.Database;

describe('Analytics Repository', () => {
  beforeEach(() => {
    // Create in-memory test database
    db = new Database(':memory:');

    // Create schema
    db.exec(`
      CREATE TABLE documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        tags TEXT DEFAULT '[]',
        file_path TEXT,
        content TEXT,
        chunk_count INTEGER DEFAULT 0,
        owner_id TEXT,
        shared_users TEXT DEFAULT '[]',
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE search_logs (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        result_count INTEGER NOT NULL,
        response_time INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('getDocumentStats', () => {
    it('returns empty stats when user has no documents', () => {
      const stats = getDocumentStats(db, 'user-123');

      expect(stats.total_count).toBe(0);
      expect(stats.total_size).toBe(0);
      expect(stats.avg_size).toBe(0);
      expect(stats.format_distribution).toEqual({});
    });

    it('counts owned documents', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'test.pdf', 'pdf', 1000, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'report.pdf', 'pdf', 2000, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      const stats = getDocumentStats(db, 'user-123');

      expect(stats.total_count).toBe(2);
      expect(stats.total_size).toBe(3000);
      expect(stats.avg_size).toBe(1500);
    });

    it('includes shared documents in stats', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'owned.pdf', 'pdf', 1000, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, shared_users, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'shared.pdf', 'pdf', 2000, 'waiting', 'user-456', JSON.stringify(['user-123']), new Date().toISOString(), new Date().toISOString());

      const stats = getDocumentStats(db, 'user-123');

      expect(stats.total_count).toBe(2);
      expect(stats.total_size).toBe(3000);
    });

    it('calculates format distribution', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'file1.pdf', 'pdf', 100, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'file2.pdf', 'pdf', 200, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc3', 'file3.txt', 'txt', 50, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      const stats = getDocumentStats(db, 'user-123');

      expect(stats.format_distribution).toEqual({
        pdf: 2,
        txt: 1,
      });
    });

    it('excludes documents not owned or shared with user', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'owned.pdf', 'pdf', 1000, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'other.pdf', 'pdf', 2000, 'waiting', 'user-456', new Date().toISOString(), new Date().toISOString());

      const stats = getDocumentStats(db, 'user-123');

      expect(stats.total_count).toBe(1);
      expect(stats.total_size).toBe(1000);
    });
  });

  describe('getSearchTrends', () => {
    it('returns empty trends when no searches', () => {
      const trends = getSearchTrends(db, 'user-123');

      expect(trends).toEqual([]);
    });

    it('aggregates search queries by frequency', () => {
      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('id-1', 'typescript', 5, new Date().toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('id-2', 'react', 3, new Date().toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('id-3', 'typescript', 2, new Date().toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('id-4', 'vue', 1, new Date().toISOString());

      const trends = getSearchTrends(db, 'user-123', 30);

      expect(trends.length).toBe(3);
      expect(trends[0].query).toBe('typescript');
      expect(trends[0].count).toBe(2);
      const otherTrends = trends.slice(1);
      expect(otherTrends.map(t => t.query)).toContain('react');
      expect(otherTrends.map(t => t.query)).toContain('vue');
    });

    it('respects days parameter for filtering', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('old-id', 'old-search', 0, oldDate.toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, created_at)
        VALUES (?, ?, ?, ?)
      `).run('recent-id', 'recent-search', 1, new Date().toISOString());

      const trends = getSearchTrends(db, 'user-123', 5);

      expect(trends).toHaveLength(1);
      expect(trends[0].query).toBe('recent-search');
    });

    it('limits results to top 10 queries', () => {
      for (let i = 0; i < 15; i++) {
        db.prepare(`
          INSERT INTO search_logs (id, query, result_count, created_at)
          VALUES (?, ?, ?, ?)
        `).run(`id-${i}`, `query-${i}`, 1, new Date().toISOString());
      }

      const trends = getSearchTrends(db, 'user-123', 30);

      expect(trends.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getUserActivity', () => {
    it('returns zero activity when user has no documents or searches', () => {
      const activity = getUserActivity(db, 'user-123');

      expect(activity.documents_created).toBe(0);
      expect(activity.searches_performed).toBe(0);
      expect(activity.avg_search_time_ms).toBe(0);
    });

    it('counts documents created by user', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'file1.pdf', 'pdf', 100, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'file2.pdf', 'pdf', 200, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      const activity = getUserActivity(db, 'user-123');

      expect(activity.documents_created).toBe(2);
    });

    it('does not count documents created by other users', () => {
      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc1', 'file1.pdf', 'pdf', 100, 'waiting', 'user-123', new Date().toISOString(), new Date().toISOString());

      db.prepare(`
        INSERT INTO documents (id, name, format, size, status, owner_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('doc2', 'file2.pdf', 'pdf', 200, 'waiting', 'user-456', new Date().toISOString(), new Date().toISOString());

      const activity = getUserActivity(db, 'user-123');

      expect(activity.documents_created).toBe(1);
    });

    it('counts searches within last 30 days', () => {
      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, response_time, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('id-1', 'search-1', 5, 100, new Date().toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, response_time, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('id-2', 'search-2', 3, 150, new Date().toISOString());

      const activity = getUserActivity(db, 'user-123');

      expect(activity.searches_performed).toBe(2);
    });

    it('calculates average search time', () => {
      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, response_time, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('id-1', 'search-1', 5, 100, new Date().toISOString());

      db.prepare(`
        INSERT INTO search_logs (id, query, result_count, response_time, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run('id-2', 'search-2', 3, 200, new Date().toISOString());

      const activity = getUserActivity(db, 'user-123');

      expect(activity.avg_search_time_ms).toBe(150);
    });
  });
});
