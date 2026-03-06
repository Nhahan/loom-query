import { describe, it, expect, afterEach, vi } from 'vitest';

describe('client.ts - singleton cleanup', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('closeDb() nullifies the instance', async () => {
    const { getDb, closeDb } = await import('@/lib/db/client');
    const db1 = getDb();
    expect(db1).toBeDefined();
    closeDb();
    // Verify we can't use the closed db, but we need a new instance
    const db2 = getDb();
    expect(db2).toBeDefined();
    expect(db1).not.toBe(db2);
  });

  it('closeDb() allows re-initialization on next getDb() call', async () => {
    const { getDb, closeDb } = await import('@/lib/db/client');
    const db1 = getDb();
    closeDb();
    const db2 = getDb();
    expect(db2).not.toBe(db1);
    expect(db2).toBeDefined();
  });

  it('closeDb() called multiple times does not error', async () => {
    const { getDb, closeDb } = await import('@/lib/db/client');
    getDb();
    expect(() => {
      closeDb();
      closeDb();
      closeDb();
    }).not.toThrow();
  });
});
