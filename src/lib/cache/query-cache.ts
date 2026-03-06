import { logger } from '@/lib/logger';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats = {
    hits: 0,
    misses: 0,
  };

  private ttlMap = new Map<string, number>([
    ['analytics:documents', 5 * 60 * 1000], // 5 minutes
    ['analytics:search-trends', 10 * 60 * 1000], // 10 minutes
    ['analytics:activity', 5 * 60 * 1000], // 5 minutes
  ]);

  /**
   * Get a value from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Cache hit
    entry.hits++;
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const finalTtl = ttlMs || this.ttlMap.get(key) || 5 * 60 * 1000; // Default 5 minutes

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + finalTtl,
      hits: 0,
      createdAt: Date.now(),
    };

    this.cache.set(key, entry);

    logger.debug('Cache set', {
      key,
      ttlMs: finalTtl,
      cacheSize: this.cache.size,
    });
  }

  /**
   * Check if key exists and hasn't expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern (e.g., "analytics:*")
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(`^${pattern.replace('*', '.*')}`);
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    logger.debug('Cache pattern delete', {
      pattern,
      deleted,
      remainingSize: this.cache.size,
    });

    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();

    logger.debug('Cache cleared', {
      itemsCleared: size,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
    };

    logger.debug('Cache stats reset');
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache entries with metadata (for debugging)
   */
  getEntries(): Array<{
    key: string;
    expiresAt: number;
    hits: number;
    createdAt: number;
    ageMs: number;
    isExpired: boolean;
  }> {
    const now = Date.now();

    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      expiresAt: entry.expiresAt,
      hits: entry.hits,
      createdAt: entry.createdAt,
      ageMs: now - entry.createdAt,
      isExpired: now > entry.expiresAt,
    }));
  }

  /**
   * Invalidate analytics cache when documents change
   */
  invalidateOnDocumentChange(): void {
    this.deletePattern('analytics:*');

    logger.info('Analytics cache invalidated due to document change');
  }

  /**
   * Wrap a promise-based function with caching
   */
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    logger.debug('Cache miss - executing function', { key });

    try {
      const start = Date.now();
      const result = await fn();
      const elapsed = Date.now() - start;

      this.set(key, result, ttlMs);

      logger.debug('Cache result stored', {
        key,
        executionMs: elapsed,
      });

      return result;
    } catch (error) {
      logger.error('Error in cached function', {
        key,
        error: String(error),
      });

      throw error;
    }
  }
}

// Singleton instance
let instance: QueryCache | null = null;

export function getQueryCache(): QueryCache {
  if (!instance) {
    instance = new QueryCache();
  }

  return instance;
}

export function resetQueryCache(): void {
  if (instance) {
    instance.clear();
    instance = null;
  }
}
