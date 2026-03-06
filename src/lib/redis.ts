import Redis from 'ioredis';
import { getRedisUrl } from './redis-config';

let instance: Redis | null = null;

export function getRedisClient(): Redis {
  if (instance) return instance;

  const url = getRedisUrl();
  instance = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  return instance;
}

/**
 * Disconnects the Redis client and releases the connection.
 * Call this during graceful shutdown to prevent connection leaks.
 */
export async function closeRedis(): Promise<void> {
  if (instance) {
    await instance.disconnect();
    instance = null;
  }
}
