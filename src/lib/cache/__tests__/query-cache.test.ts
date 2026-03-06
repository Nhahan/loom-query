import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getQueryCache, resetQueryCache } from '../query-cache';

describe('QueryCache', () => {
  beforeEach(() => {
    resetQueryCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', () => {
      const cache = getQueryCache();
      const testData = { id: 1, name: 'test' };

      cache.set('test-key', testData);
      const result = cache.get('test-key');

      expect(result).toEqual(testData);
    });

    it('should return null for missing keys', () => {
      const cache = getQueryCache();

      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      const cache = getQueryCache();

      cache.set('exists', 'value');

      expect(cache.has('exists')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete keys', () => {
      const cache = getQueryCache();

      cache.set('to-delete', 'value');
      expect(cache.has('to-delete')).toBe(true);

      const deleted = cache.delete('to-delete');
      expect(deleted).toBe(true);
      expect(cache.has('to-delete')).toBe(false);
    });

    it('should return cache size', () => {
      const cache = getQueryCache();

      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);

      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });

    it('should clear all cache', () => {
      const cache = getQueryCache();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', () => {
      const cache = getQueryCache();

      cache.set('expires', 'value', 1000);
      expect(cache.get('expires')).toEqual('value');

      vi.advanceTimersByTime(1001);
      expect(cache.get('expires')).toBeNull();
    });

    it('should use default TTL for analytics keys', () => {
      const cache = getQueryCache();

      cache.set('analytics:documents', { count: 10 });
      expect(cache.get('analytics:documents')).toEqual({ count: 10 });

      // Advance 5 minutes (default TTL for analytics:documents)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);
      expect(cache.get('analytics:documents')).toBeNull();
    });

    it('should use 10-minute TTL for search trends', () => {
      const cache = getQueryCache();

      cache.set('analytics:search-trends', []);
      expect(cache.has('analytics:search-trends')).toBe(true);

      // Advance 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(cache.has('analytics:search-trends')).toBe(false);
    });

    it('should use custom TTL if provided', () => {
      const cache = getQueryCache();

      cache.set('custom-ttl', 'value', 500);
      expect(cache.get('custom-ttl')).toEqual('value');

      vi.advanceTimersByTime(501);
      expect(cache.get('custom-ttl')).toBeNull();
    });
  });

  describe('Cache Hit/Miss Tracking', () => {
    it('should track cache hits', () => {
      const cache = getQueryCache();

      cache.set('key', 'value');
      cache.get('key');
      cache.get('key');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      const cache = getQueryCache();

      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      const cache = getQueryCache();

      cache.set('key', 'value');

      // 3 hits, 2 misses = 60% hit rate
      cache.get('key');
      cache.get('key');
      cache.get('key');
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(60);
    });

    it('should reset statistics', () => {
      const cache = getQueryCache();

      cache.set('key', 'value');
      cache.get('key');
      cache.get('nonexistent');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Pattern Deletion', () => {
    it('should delete keys matching pattern', () => {
      const cache = getQueryCache();

      cache.set('analytics:documents', 'doc-data');
      cache.set('analytics:trends', 'trend-data');
      cache.set('analytics:activity', 'activity-data');
      cache.set('user:profile', 'profile-data');

      const deleted = cache.deletePattern('analytics:*');

      expect(deleted).toBe(3);
      expect(cache.has('user:profile')).toBe(true);
      expect(cache.has('analytics:documents')).toBe(false);
    });

    it('should delete analytics cache on document change', () => {
      const cache = getQueryCache();

      cache.set('analytics:documents', 'doc-data');
      cache.set('analytics:trends', 'trend-data');
      cache.set('other:key', 'other-data');

      cache.invalidateOnDocumentChange();

      expect(cache.has('analytics:documents')).toBe(false);
      expect(cache.has('analytics:trends')).toBe(false);
      expect(cache.has('other:key')).toBe(true);
    });
  });

  describe('Memoization', () => {
    it('should cache async function results', async () => {
      const cache = getQueryCache();
      const mockFn = vi.fn(async () => Promise.resolve({ result: 'data' }));

      const result1 = await cache.memoize('async-key', mockFn);
      const result2 = await cache.memoize('async-key', mockFn);

      expect(result1).toEqual({ result: 'data' });
      expect(result2).toEqual({ result: 'data' });
      expect(mockFn).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should use custom TTL in memoize', async () => {
      const cache = getQueryCache();
      const mockFn = vi.fn(async () => Promise.resolve('value'));

      await cache.memoize('memoized', mockFn, 500);
      expect(cache.has('memoized')).toBe(true);

      vi.advanceTimersByTime(501);
      expect(cache.has('memoized')).toBe(false);
    });

    it('should handle memoize errors', async () => {
      const cache = getQueryCache();
      const error = new Error('Test error');
      const mockFn = vi.fn(async () => Promise.reject(error));

      await expect(cache.memoize('error-key', mockFn)).rejects.toThrow('Test error');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const cache1 = getQueryCache();
      const cache2 = getQueryCache();

      expect(cache1).toBe(cache2);
    });

    it('should return new instance after reset', () => {
      const cache1 = getQueryCache();
      cache1.set('key', 'value');

      resetQueryCache();

      const cache2 = getQueryCache();
      expect(cache2.get('key')).toBeNull();
      expect(cache2.size()).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent gets', () => {
      const cache = getQueryCache();

      cache.set('key', { data: 'value' });

      const results = [
        cache.get('key'),
        cache.get('key'),
        cache.get('key'),
      ];

      expect(results).toEqual([
        { data: 'value' },
        { data: 'value' },
        { data: 'value' },
      ]);

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });

    it('should handle concurrent set operations', () => {
      const cache = getQueryCache();

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toEqual('value1');
      expect(cache.get('key2')).toEqual('value2');
      expect(cache.get('key3')).toEqual('value3');
    });
  });

  describe('Cache Entries Inspection', () => {
    it('should return cache entries with metadata', () => {
      const cache = getQueryCache();

      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 2000);

      const entries = cache.getEntries();

      expect(entries.length).toBe(2);
      expect(entries[0].key).toBeDefined();
      expect(typeof entries[0].hits).toBe('number');
      expect(typeof entries[0].ageMs).toBe('number');
      expect(typeof entries[0].isExpired).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const cache = getQueryCache();

      cache.set('null-key', null);
      const result = cache.get('null-key');

      // null should be considered as no value (returns null)
      expect(result).toBeNull();
    });

    it('should handle undefined values', () => {
      const cache = getQueryCache();

      cache.set('undefined-key', undefined);
      const result = cache.get('undefined-key');

      // undefined should be cached and returned
      expect(result).toBeUndefined();
    });

    it('should handle empty strings', () => {
      const cache = getQueryCache();

      cache.set('empty-string', '');
      const result = cache.get('empty-string');

      expect(result).toEqual('');
    });

    it('should handle zero values', () => {
      const cache = getQueryCache();

      cache.set('zero', 0);
      const result = cache.get('zero');

      expect(result).toEqual(0);
    });

    it('should handle false boolean', () => {
      const cache = getQueryCache();

      cache.set('false', false);
      const result = cache.get('false');

      expect(result).toEqual(false);
    });
  });
});
