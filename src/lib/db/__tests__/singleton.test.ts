import { describe, it, expect } from 'vitest';

describe('singleton clients', () => {
  it('getDb returns the same instance on multiple imports', async () => {
    const { getDb: getDb1 } = await import('@/lib/db/client');
    const { getDb: getDb2 } = await import('@/lib/db/client');
    expect(getDb1()).toBe(getDb2());
  });

  it('getChromaClient returns the same instance on multiple imports', async () => {
    const { getChromaClient: c1 } = await import('@/lib/chroma');
    const { getChromaClient: c2 } = await import('@/lib/chroma');
    expect(c1()).toBe(c2());
  });

  it('getRedisClient returns the same instance on multiple imports', async () => {
    const { getRedisClient: r1 } = await import('@/lib/redis');
    const { getRedisClient: r2 } = await import('@/lib/redis');
    expect(r1()).toBe(r2());
  });
});
