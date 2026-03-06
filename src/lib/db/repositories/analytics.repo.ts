import { getDb } from '../client';

export interface DocumentStats {
  total_count: number;
  total_size: number;
  avg_size: number;
  format_distribution: Record<string, number>;
}

export interface SearchTrend {
  query: string;
  count: number;
  unique_users: number;
}

export interface UserActivity {
  documents_created: number;
  searches_performed: number;
  avg_search_time_ms: number;
}

/**
 * Get document statistics for a user
 * Returns: total count, total size, average size, and format distribution
 */
export function getDocumentStats(userId: string): DocumentStats {
  const db = getDb();

  // Get accessible documents for user (owned or shared)
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

  // Get format distribution
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

/**
 * Get search trends for a user in the last N days
 * Returns: top queries with count and unique_users
 */
export function getSearchTrends(userId: string, days = 7): SearchTrend[] {
  const db = getDb();
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
    unique_users: 1, // Single user app - placeholder for multi-user support
  }));
}

/**
 * Get user activity summary
 * Returns: documents created, searches performed, average search response time
 */
export function getUserActivity(userId: string): UserActivity {
  const db = getDb();

  // Count documents created by user
  const docCount = db
    .prepare('SELECT COUNT(*) as count FROM documents WHERE owner_id = ?')
    .get(userId) as { count: number };

  // Get search activity
  let searchStats: { searches_performed: number; avg_response_time: number };

  try {
    // Try to get average response time if column exists
    searchStats = db
      .prepare(`
        SELECT
          COUNT(*) as searches_performed,
          COALESCE(AVG(response_time), 0) as avg_response_time
        FROM search_logs
        WHERE created_at >= datetime('now', '-30 days')
      `)
      .get() as { searches_performed: number; avg_response_time: number };
  } catch {
    // Fallback if response_time column doesn't exist
    const result = db
      .prepare(`
        SELECT COUNT(*) as count
        FROM search_logs
        WHERE created_at >= datetime('now', '-30 days')
      `)
      .get() as { count: number };

    searchStats = {
      searches_performed: result.count,
      avg_response_time: 0,
    };
  }

  return {
    documents_created: docCount.count,
    searches_performed: searchStats.searches_performed,
    avg_search_time_ms: Math.round(searchStats.avg_response_time),
  };
}
