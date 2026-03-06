import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

const mockEmbed = vi.hoisted(() => vi.fn());
const mockQuery = vi.hoisted(() => vi.fn());
const mockGetCollection = vi.hoisted(() => vi.fn());
const mockGetUserDocumentIds = vi.hoisted(() => vi.fn());
const mockSearchFullText = vi.hoisted(() => vi.fn());

vi.mock('@/lib/mastra', () => ({
  getMastraClient: () => ({
    embed: mockEmbed,
  }),
}));

vi.mock('@/lib/chroma', () => ({
  getChromaClient: () => ({
    getCollection: mockGetCollection,
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/db/repositories/document.repo', () => ({
  getUserDocumentIds: mockGetUserDocumentIds,
}));

vi.mock('@/lib/db/repositories/search.repo', () => ({
  searchFullText: mockSearchFullText,
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET } from '../search/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(query?: string, mode?: string): Request {
  let url = query !== undefined
    ? `http://localhost/api/documents/search?q=${encodeURIComponent(query)}`
    : 'http://localhost/api/documents/search';
  if (mode) {
    url += (query ? '&' : '?') + `mode=${mode}`;
  }
  return new Request(url, { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/documents/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
    mockQuery.mockResolvedValue({
      documents: [['chunk 1 text', 'chunk 2 text']],
      distances: [[0.1, 0.3]],
      metadatas: [
        [
          { document_id: 'doc1', chunk_index: 0 },
          { document_id: 'doc2', chunk_index: 1 },
        ],
      ],
    });
    mockGetCollection.mockResolvedValue({ query: mockQuery });
    // Default: user has access to both docs
    mockGetUserDocumentIds.mockReturnValue(['doc1', 'doc2']);
    // Default: FTS returns no results (semantic-only for these tests)
    mockSearchFullText.mockReturnValue([]);
  });

  it('returns 200 with formatted results for a valid query', async () => {
    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<{ document_id: string; text: string; combined_score: number; metadata: Record<string, unknown> }>; mode: string; response_time: number };

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(body.mode).toBe('hybrid');
    expect(typeof body.response_time).toBe('number');
  });

  it('calculates combined_score as weighted average in hybrid mode', async () => {
    // FTS returns empty, so combined_score = semantic_score * 0.5
    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<{ combined_score: number }> };

    expect(body.results[0].combined_score).toBeCloseTo(0.45); // (1 - 0.1) * 0.5
    expect(body.results[1].combined_score).toBeCloseTo(0.35); // (1 - 0.3) * 0.5
  });

  it('includes document_id, text, combined_score, and metadata in each result', async () => {
    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<{ document_id: string; text: string; combined_score: number; metadata: Record<string, unknown> }> };

    const first = body.results[0];
    expect(first).toHaveProperty('document_id', 'doc1');
    expect(first).toHaveProperty('text', 'chunk 1 text');
    expect(first).toHaveProperty('combined_score');
    expect(first).toHaveProperty('metadata');
    expect(first.metadata).toMatchObject({ document_id: 'doc1', chunk_index: 0 });

    const second = body.results[1];
    expect(second).toHaveProperty('document_id', 'doc2');
    expect(second).toHaveProperty('text', 'chunk 2 text');
  });

  it('returns 400 when q param is absent', async () => {
    const req = makeRequest();
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Search query is required');
  });

  it('returns 400 when q param is empty string', async () => {
    const req = makeRequest('');
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Search query is required');
  });

  it('returns 400 when q param is whitespace only', async () => {
    const req = makeRequest('   ');
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Search query is required');
  });

  it('returns 500 when embedding generation fails in semantic mode', async () => {
    mockEmbed.mockRejectedValue(new Error('Embedding service unavailable'));
    const req = makeRequest('test', 'semantic');
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to generate embedding');
  });

  it('returns 500 when ChromaDB query fails in semantic mode', async () => {
    mockGetCollection.mockRejectedValue(new Error('ChromaDB connection error'));
    const req = makeRequest('test', 'semantic');
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe('Search query failed');
  });

  it('filters out results for documents the user cannot access', async () => {
    // User only owns doc1, not doc2
    mockGetUserDocumentIds.mockReturnValue(['doc1']);

    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<{ document_id: string }> };

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].document_id).toBe('doc1');
  });

  it('returns all results when user has access to all documents', async () => {
    // Default beforeEach: user has access to doc1 and doc2
    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<{ document_id: string }> };

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(2);
  });

  it('calls getUserDocumentIds with the mock user id', async () => {
    const req = makeRequest('test');
    await GET(req);

    expect(mockGetUserDocumentIds).toHaveBeenCalledWith('user-test-123');
  });

  it('returns empty results when user has no accessible documents', async () => {
    mockGetUserDocumentIds.mockReturnValue([]);

    const req = makeRequest('test');
    const res = await GET(req);
    const body = await res.json() as { results: Array<unknown> };

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(0);
  });
});
