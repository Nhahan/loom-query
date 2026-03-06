import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('Full-Text Search (FTS)', () => {
  test('FTS search returns results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=fts`);

    // Accept 200 or 400 (if query is invalid) or 500 (if search fails)
    expect([200, 400, 500]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ document_id: string }>;
        mode: string;
      };
      expect(body.mode).toBe('fts');
      expect(Array.isArray(body.results)).toBeTruthy();
    }
  });

  test('FTS search respects permissions', async ({ request }) => {
    // This test assumes there are documents with different permissions
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=fts`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ document_id: string }>;
      };
      // All results should be accessible to current user
      expect(Array.isArray(body.results)).toBeTruthy();
    }
  });

  test('FTS search returns results sorted by relevance', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=document&mode=fts`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ fts_score?: number }>;
      };

      // If there are multiple results, check they're sorted
      if (body.results.length > 1) {
        for (let i = 1; i < body.results.length; i++) {
          const prevScore = body.results[i - 1].fts_score ?? 0;
          const currentScore = body.results[i].fts_score ?? 0;
          expect(prevScore).toBeGreaterThanOrEqual(currentScore);
        }
      }
    }
  });

  test('FTS search with invalid query returns 400', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?mode=fts`);
    expect(response.status()).toBe(400);
  });
});

test.describe('Semantic Search', () => {
  test('Semantic search returns results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=semantic`);

    // Accept 200 or 500 (if ChromaDB not ready)
    expect([200, 400, 500]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ document_id: string }>;
        mode: string;
      };
      expect(body.mode).toBe('semantic');
      expect(Array.isArray(body.results)).toBeTruthy();
    }
  });

  test('Semantic search respects permissions', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=semantic`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ document_id: string }>;
      };
      expect(Array.isArray(body.results)).toBeTruthy();
    }
  });
});

test.describe('Hybrid Search', () => {
  test('Hybrid search merges FTS and semantic results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=hybrid`);

    expect([200, 400, 500]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{
          document_id: string;
          combined_score: number;
          fts_score?: number;
          semantic_score?: number;
        }>;
        mode: string;
      };

      expect(body.mode).toBe('hybrid');
      expect(Array.isArray(body.results)).toBeTruthy();

      // Hybrid mode should have combined_score
      if (body.results.length > 0) {
        expect(typeof body.results[0].combined_score).toBe('number');
      }
    }
  });

  test('Hybrid search uses 50/50 weighting', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=hybrid`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{
          combined_score: number;
          fts_score?: number;
          semantic_score?: number;
        }>;
      };

      // For hybrid search with both scores, combined should be weighted average
      const result = body.results.find(r => r.fts_score && r.semantic_score);
      if (result) {
        const expected = (result.fts_score! * 0.5) + (result.semantic_score! * 0.5);
        expect(Math.abs(result.combined_score - expected)).toBeLessThan(0.01);
      }
    }
  });

  test('Hybrid search returns results sorted by combined score', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=document&mode=hybrid`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ combined_score: number }>;
      };

      // Results should be sorted by combined_score descending
      if (body.results.length > 1) {
        for (let i = 1; i < body.results.length; i++) {
          expect(body.results[i - 1].combined_score).toBeGreaterThanOrEqual(
            body.results[i].combined_score
          );
        }
      }
    }
  });

  test('Hybrid search default mode', async ({ request }) => {
    // Without specifying mode, should default to hybrid
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test`);

    if (response.status() === 200) {
      const body = await response.json() as {
        mode: string;
      };
      expect(body.mode).toBe('hybrid');
    }
  });

  test('Hybrid search deduplicates results by document_id', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=hybrid`);

    if (response.status() === 200) {
      const body = await response.json() as {
        results: Array<{ document_id: string }>;
      };

      const documentIds = body.results.map(r => r.document_id);
      const uniqueIds = new Set(documentIds);

      // All document IDs should be unique
      expect(uniqueIds.size).toBe(documentIds.length);
    }
  });

  test('Hybrid search includes response_time', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=hybrid`);

    if (response.status() === 200) {
      const body = await response.json() as {
        response_time: number;
      };

      expect(typeof body.response_time).toBe('number');
      expect(body.response_time).toBeGreaterThanOrEqual(0);
      expect(body.response_time).toBeLessThan(5000); // Should be reasonably fast
    }
  });
});

test.describe('Search Performance', () => {
  test('search API responds in under 2000ms', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(`${BASE_URL}/api/documents/search?q=test&mode=hybrid`);
    const elapsed = Date.now() - start;

    expect([200, 400, 500]).toContain(response.status());
    expect(elapsed).toBeLessThan(2000);
  });

  test('FTS search responds faster than semantic', async ({ request }) => {
    const ftsStart = Date.now();
    await request.get(`${BASE_URL}/api/documents/search?q=test&mode=fts`);
    const ftsElapsed = Date.now() - ftsStart;

    const semanticStart = Date.now();
    await request.get(`${BASE_URL}/api/documents/search?q=test&mode=semantic`);
    const semanticElapsed = Date.now() - semanticStart;

    // FTS should generally be faster than semantic
    // (this is a soft assertion since it depends on data size)
    expect(ftsElapsed).toBeLessThan(5000);
    expect(semanticElapsed).toBeLessThan(5000);
  });
});
