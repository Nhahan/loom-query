import { describe, it, expect, afterEach, vi } from 'vitest';

describe('redis.ts - singleton cleanup', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('closeRedis() nullifies the instance', async () => {
    const { getRedisClient, closeRedis } = await import('@/lib/redis');
    const redis1 = getRedisClient();
    expect(redis1).toBeDefined();
    await closeRedis();
    const redis2 = getRedisClient();
    expect(redis2).toBeDefined();
    expect(redis1).not.toBe(redis2);
  });

  it('closeRedis() allows re-initialization on next getRedisClient() call', async () => {
    const { getRedisClient, closeRedis } = await import('@/lib/redis');
    const redis1 = getRedisClient();
    await closeRedis();
    const redis2 = getRedisClient();
    expect(redis2).not.toBe(redis1);
    expect(redis2).toBeDefined();
  });

  it('closeRedis() called multiple times does not error', async () => {
    const { getRedisClient, closeRedis } = await import('@/lib/redis');
    getRedisClient();
    await expect(
      (async () => {
        await closeRedis();
        await closeRedis();
        await closeRedis();
      })(),
    ).resolves.not.toThrow();
  });
});
