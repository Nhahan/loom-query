import { type ConnectionOptions } from 'bullmq';

/**
 * Gets the Redis URL from environment or returns default.
 * Single source of truth for Redis connection configuration.
 */
export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

/**
 * Parses the Redis URL and returns connection options for BullMQ.
 * Single source of truth for Redis connection configuration.
 * Used by BullMQ (queue.ts).
 */
export function getRedisConfig(): ConnectionOptions {
  const url = getRedisUrl();

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}
