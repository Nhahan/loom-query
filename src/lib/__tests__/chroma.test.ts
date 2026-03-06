import { describe, it, expect, afterEach, vi } from 'vitest';

describe('chroma.ts - singleton cleanup', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('closeChroma() nullifies the instance', async () => {
    const { getChromaClient, closeChroma } = await import('@/lib/chroma');
    const chroma1 = getChromaClient();
    expect(chroma1).toBeDefined();
    closeChroma();
    const chroma2 = getChromaClient();
    expect(chroma2).toBeDefined();
    expect(chroma1).not.toBe(chroma2);
  });

  it('closeChroma() allows re-initialization on next getChromaClient() call', async () => {
    const { getChromaClient, closeChroma } = await import('@/lib/chroma');
    const chroma1 = getChromaClient();
    closeChroma();
    const chroma2 = getChromaClient();
    expect(chroma2).not.toBe(chroma1);
    expect(chroma2).toBeDefined();
  });

  it('closeChroma() called multiple times does not error', async () => {
    const { getChromaClient, closeChroma } = await import('@/lib/chroma');
    getChromaClient();
    expect(() => {
      closeChroma();
      closeChroma();
      closeChroma();
    }).not.toThrow();
  });
});
