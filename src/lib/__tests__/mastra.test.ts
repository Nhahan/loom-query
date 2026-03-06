import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMastraClient, closeMastra } from '../mastra';

/**
 * Mastra + Ollama Integration Tests
 *
 * These tests verify that the MastraClient successfully connects to Ollama
 * and generates real embeddings. To run:
 *
 * 1. Start Ollama: ollama serve
 * 2. Pull embedding model: ollama pull nomic-embed-text
 * 3. Run test: pnpm test mastra
 *
 * Skip this test in CI/CD (no local Ollama available)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

// Skip tests if SKIP_OLLAMA_TESTS is set (for CI/CD)
const skipOllamaTests = process.env.SKIP_OLLAMA_TESTS === 'true';

describe.skipIf(skipOllamaTests)('MastraClient - Ollama Integration', () => {
  // Reset singleton after each test
  afterEach(() => {
    closeMastra();
  });

  it('getMastraClient returns a singleton instance', () => {
    const client1 = getMastraClient();
    const client2 = getMastraClient();
    expect(client1).toBe(client2);
  });

  it('embed() returns a number array from Ollama', async () => {
    const client = getMastraClient();
    const embedding = await client.embed('Hello world');

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
    embedding.forEach((value) => {
      expect(typeof value).toBe('number');
      expect(isNaN(value)).toBe(false);
    });
  });

  it('embed("안녕하세요") returns 768-dimensional vector (not empty, not zeros)', async () => {
    const client = getMastraClient();
    const embedding = await client.embed('안녕하세요');

    // nomic-embed-text produces 768-dimensional vectors
    if (EMBEDDING_MODEL === 'nomic-embed-text') {
      expect(embedding.length).toBe(768);
    } else {
      expect(embedding.length).toBeGreaterThanOrEqual(768);
    }

    // All values should be numbers
    embedding.forEach((value) => {
      expect(typeof value).toBe('number');
      expect(isNaN(value)).toBe(false);
    });

    // Vector should not be all zeros
    const hasNonZero = embedding.some((v) => v !== 0);
    expect(hasNonZero).toBe(true);

    // Should not be all the same value (sanity check)
    const uniqueValues = new Set(embedding);
    expect(uniqueValues.size).toBeGreaterThan(1);
  });

  it('embedBatch() returns array of embeddings for multiple texts', async () => {
    const client = getMastraClient();
    const texts = ['first text', 'second text', 'third text'];
    const embeddings = await client.embedBatch(texts);

    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBe(texts.length);

    embeddings.forEach((embedding, index) => {
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);

      // Each embedding should have valid numbers
      embedding.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(isNaN(value)).toBe(false);
      });

      // Each embedding should have non-zero values
      const hasNonZero = embedding.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });
  });

  it('embed() throws error for empty text', async () => {
    const client = getMastraClient();

    await expect(client.embed('')).rejects.toThrow('Text cannot be empty');
    await expect(client.embed('   ')).rejects.toThrow('Text cannot be empty');
  });

  it('embedBatch() throws error for empty array', async () => {
    const client = getMastraClient();

    await expect(client.embedBatch([])).rejects.toThrow('Texts array cannot be empty');
  });

  it('embed() performance is acceptable (<5 seconds)', async () => {
    const client = getMastraClient();
    const startTime = Date.now();

    await client.embed('Performance test text');

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });

  it('embedBatch() performance is acceptable (<30 seconds for 10 texts)', async () => {
    const client = getMastraClient();
    const texts = Array(10)
      .fill(null)
      .map((_, i) => `Text number ${i + 1}`);

    const startTime = Date.now();
    await client.embedBatch(texts);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(30000);
  });

  it('embed() returns meaningful error if Ollama unavailable', async () => {
    // Mock fetch to simulate Ollama unavailable
    const originalFetch = global.fetch;
    global.fetch = vi.fn(() =>
      Promise.reject(new Error('Connection refused'))
    );

    try {
      const client = getMastraClient();
      await expect(client.embed('test')).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
      closeMastra();
    }
  });

  it('closeMastra() clears the singleton instance', () => {
    const client1 = getMastraClient();
    expect(client1).toBeDefined();

    closeMastra();

    const client2 = getMastraClient();
    // After closing, a new instance should be created
    expect(client1).not.toBe(client2);
  });

  it('embed() handles different languages correctly', async () => {
    const client = getMastraClient();

    const texts = [
      'Hello world',      // English
      '안녕하세요',       // Korean
      'Bonjour le monde', // French
      '你好世界',        // Chinese
    ];

    const embeddings = await Promise.all(texts.map((text) => client.embed(text)));

    // All embeddings should be valid
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(768);
      const hasNonZero = embedding.some((v) => v !== 0);
      expect(hasNonZero).toBe(true);
    });

    // Different texts should produce different embeddings
    // (with very high probability)
    const embedding0 = embeddings[0];
    const embedding1 = embeddings[1];
    const isSame = embedding0.every((v, i) => v === embedding1[i]);
    expect(isSame).toBe(false);
  });
});
