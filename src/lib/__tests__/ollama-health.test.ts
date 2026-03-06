import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Ollama health check test
 *
 * This test verifies that Ollama is running and accessible.
 * To run this test locally:
 *
 * 1. Start Ollama: ollama serve
 * 2. Pull embedding model: ollama pull nomic-embed-text
 * 3. Run test: pnpm test ollama-health
 *
 * Skip this test in CI/CD (no local Ollama available)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

// Skip tests if SKIP_OLLAMA_TESTS is set (for CI/CD)
const skipOllamaTests = process.env.SKIP_OLLAMA_TESTS === 'true';

describe.skipIf(skipOllamaTests)('Ollama Health Check', () => {
  it('Ollama server is running and accessible', async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/version`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('version');
    } catch (error) {
      throw new Error(
        `Ollama server not accessible at ${OLLAMA_BASE_URL}. ` +
        'Start Ollama with: ollama serve'
      );
    }
  });

  it(`Embedding model "${EMBEDDING_MODEL}" is available`, async () => {
    try {
      // Test embedding request
      const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: '테스트',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty('embedding');
      expect(Array.isArray(data.embedding)).toBe(true);
      expect(data.embedding.length).toBeGreaterThan(0);
    } catch (error) {
      throw new Error(
        `Embedding model "${EMBEDDING_MODEL}" not available. ` +
        `Pull it with: ollama pull ${EMBEDDING_MODEL}`
      );
    }
  });

  it('Embedding returns valid vector (768+ dimensions for nomic)', async () => {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: '안녕하세요',
      }),
    });

    const data = await response.json();
    const embedding = data.embedding as number[];

    // nomic-embed-text produces 768-dimensional vectors
    if (EMBEDDING_MODEL === 'nomic-embed-text') {
      expect(embedding.length).toBe(768);
    }

    // All values should be numbers
    embedding.forEach((value) => {
      expect(typeof value).toBe('number');
      expect(isNaN(value)).toBe(false);
    });

    // Vector should not be all zeros
    const hasNonZero = embedding.some((v) => v !== 0);
    expect(hasNonZero).toBe(true);
  });

  it('Batch embedding works (multiple inputs)', async () => {
    const inputs = ['첫 번째', '두 번째', '세 번째'];

    const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: inputs,
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('embeddings');
    expect(Array.isArray(data.embeddings)).toBe(true);
    expect(data.embeddings.length).toBe(inputs.length);
  });

  it('Embedding performance is acceptable (<5s for single text)', async () => {
    const startTime = Date.now();

    await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: '성능 테스트용 텍스트입니다.',
      }),
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete in <5 seconds
  });
});
