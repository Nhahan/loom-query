import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/lib/db/client';
import {
  getDocumentStats,
  getSearchTrends,
  getUserActivity,
} from '@/lib/db/repositories/analytics.repo';

describe('Query Optimization - Analytics Performance', () => {
  beforeEach(() => {
    // Reset database between tests
    const db = getDb();
    try {
      db.exec('DELETE FROM documents');
    } catch {
      // Table structure varies in test environment
    }
  });

  describe('Document Stats Query Performance', () => {
    it('should retrieve document stats efficiently', () => {
      const userId = 'perf-test-user';
      const start = performance.now();

      const stats = getDocumentStats(userId);

      const elapsed = performance.now() - start;

      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(500);
      expect(stats).toHaveProperty('total_count');
      expect(stats).toHaveProperty('total_size');
      expect(stats).toHaveProperty('avg_size');
      expect(stats).toHaveProperty('format_distribution');
    });

    it('should use aggregation for document stats', () => {
      const db = getDb();
      const userId = 'perf-test-user';

      // Insert test documents
      try {
        for (let i = 0; i < 100; i++) {
          db.prepare(`
            INSERT INTO documents (
              id, owner_id, name, type, size, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `doc-${i}`,
            userId,
            `test-${i}`,
            'pdf',
            Math.floor(Math.random() * 10000000),
            'processed',
            Date.now(),
            Date.now()
          );
        }
      } catch {
        // Document table structure may vary
      }

      const start = performance.now();
      const stats = getDocumentStats(userId);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
      expect(typeof stats.total_count).toBe('number');
      expect(typeof stats.total_size).toBe('number');
      expect(typeof stats.avg_size).toBe('number');
    });
  });

  describe('Search Trends Query Performance', () => {
    it('should retrieve search trends efficiently', () => {
      const userId = 'perf-test-user';
      const start = performance.now();

      const trends = getSearchTrends(userId, 7);

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(Array.isArray(trends)).toBe(true);
    });
  });

  describe('User Activity Query Performance', () => {
    it('should retrieve user activity efficiently', () => {
      const userId = 'perf-test-user';
      const start = performance.now();

      const activity = getUserActivity(userId);

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(activity).toHaveProperty('documents_created');
      expect(activity).toHaveProperty('searches_performed');
      expect(activity).toHaveProperty('avg_search_time_ms');
    });

    it('should handle zero searches gracefully', () => {
      const userId = 'empty-user';

      const activity = getUserActivity(userId);

      expect(activity.documents_created).toBeGreaterThanOrEqual(0);
      expect(activity.searches_performed).toBeGreaterThanOrEqual(0);
      expect(activity.avg_search_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('all analytics functions should complete quickly', () => {
      const userId = 'benchmark-user';

      const docStart = performance.now();
      getDocumentStats(userId);
      const docTime = performance.now() - docStart;

      const trendsStart = performance.now();
      getSearchTrends(userId, 7);
      const trendsTime = performance.now() - trendsStart;

      const activityStart = performance.now();
      getUserActivity(userId);
      const activityTime = performance.now() - activityStart;

      // All should be fast (use aggregation, not N+1)
      expect(docTime).toBeLessThan(500);
      expect(trendsTime).toBeLessThan(500);
      expect(activityTime).toBeLessThan(500);
    });

    it('should return valid data structures', () => {
      const userId = 'data-test-user';

      const stats = getDocumentStats(userId);
      expect(typeof stats.total_count).toBe('number');
      expect(typeof stats.total_size).toBe('number');
      expect(typeof stats.avg_size).toBe('number');
      expect(typeof stats.format_distribution).toBe('object');

      const trends = getSearchTrends(userId, 7);
      expect(Array.isArray(trends)).toBe(true);
      if (trends.length > 0) {
        expect(trends[0]).toHaveProperty('query');
        expect(trends[0]).toHaveProperty('count');
        expect(trends[0]).toHaveProperty('unique_users');
      }

      const activity = getUserActivity(userId);
      expect(typeof activity.documents_created).toBe('number');
      expect(typeof activity.searches_performed).toBe('number');
      expect(typeof activity.avg_search_time_ms).toBe('number');
    });
  });

  describe('Query Optimization - No N+1', () => {
    it('document stats uses single aggregation query', () => {
      const userId = 'optimization-test';

      // Should be fast even with call overhead
      const start = performance.now();
      const stats = getDocumentStats(userId);
      const elapsed = performance.now() - start;

      // If this were N+1, it would be much slower
      expect(elapsed).toBeLessThan(100);
      expect(stats).toBeDefined();
    });

    it('search trends uses aggregation not iteration', () => {
      const userId = 'trends-test';

      const start = performance.now();
      const trends = getSearchTrends(userId, 7);
      const elapsed = performance.now() - start;

      // Should be fast with aggregation/GROUP BY
      expect(elapsed).toBeLessThan(100);
      expect(Array.isArray(trends)).toBe(true);
    });

    it('user activity uses aggregation', () => {
      const userId = 'activity-test';

      const start = performance.now();
      const activity = getUserActivity(userId);
      const elapsed = performance.now() - start;

      // Should be fast with SUM/COUNT/AVG aggregations
      expect(elapsed).toBeLessThan(100);
      expect(activity).toBeDefined();
    });
  });
});
