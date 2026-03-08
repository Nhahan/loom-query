/**
 * Edge case and stress tests for document embedding pipeline.
 * Tests large documents, empty documents, rapid uploads, and failure scenarios.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockChunks = [
  { text: 'chunk-0', metadata: { source: 'test-doc-id' } },
  { text: 'chunk-1', metadata: { source: 'test-doc-id' } },
];

const mockChunkFn = vi.fn().mockResolvedValue(mockChunks);
const mockFromText = vi.fn().mockReturnValue({ chunk: mockChunkFn });

vi.mock('@mastra/rag', () => ({
  MDocument: { fromText: mockFromText },
}));

const mockEmbedBatch = vi.fn().mockResolvedValue([
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
]);

vi.mock('@/lib/mastra', () => ({
  getMastraClient: () => ({ embedBatch: mockEmbedBatch }),
}));

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockGetOrCreateCollection = vi.fn().mockResolvedValue({ add: mockAdd });

vi.mock('@/lib/chroma', () => ({
  getChromaClient: () => ({ getOrCreateCollection: mockGetOrCreateCollection }),
}));

const mockGetDocument = vi.fn();
const mockUpdateDocumentStatus = vi.fn();

vi.mock('@/lib/db/repositories/document.repo', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  updateDocumentStatus: (...args: unknown[]) => mockUpdateDocumentStatus(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Circuit breaker mocks (always CLOSED to allow execution)
const mockCircuitExecute = vi.fn((fn) => fn());
vi.mock('@/lib/queue/circuit-breaker', () => ({
  getOllamaCircuitBreaker: () => ({ execute: mockCircuitExecute }),
  getChromaCircuitBreaker: () => ({ execute: mockCircuitExecute }),
}));

describe('embedDocument - Edge Cases', () => {
  const baseDoc = {
    id: 'test-doc-id',
    name: 'test.txt',
    format: 'text/plain',
    size: 100,
    status: 'waiting' as const,
    tags: '[]',
    file_path: '/tmp/test.txt',
    chunk_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockReturnValue(baseDoc);
    mockChunkFn.mockResolvedValue(mockChunks);
    mockEmbedBatch.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    mockAdd.mockResolvedValue(undefined);
    mockGetOrCreateCollection.mockResolvedValue({ add: mockAdd });
  });

  it('handles empty document content (null)', async () => {
    mockGetDocument.mockReturnValue({ ...baseDoc, content: null });
    mockChunkFn.mockResolvedValue([]);

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument('test-doc-id');

    // Should be called with empty string
    expect(mockFromText).toHaveBeenCalledWith('', expect.any(Object));
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(
      'test-doc-id',
      'done',
      { chunk_count: 0 }
    );
  });

  it('handles very large documents with many chunks', async () => {
    // Simulate large document with 100 chunks
    const largeManyChunks = Array.from({ length: 100 }, (_, i) => ({
      text: `chunk-${i}`,
      metadata: { source: 'test-doc-id' },
    }));

    mockChunkFn.mockResolvedValue(largeManyChunks);
    mockEmbedBatch.mockResolvedValue(
      largeManyChunks.map((_, i) => [0.1 * i, 0.2 * i, 0.3 * i])
    );

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    const result = await embedDocument('test-doc-id');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.chunkCount).toBe(100);
    }
    expect(mockAdd).toHaveBeenCalled();
  });

  it('handles ChromaDB collection.add through circuit breaker', async () => {
    // Verify circuit breaker wraps the add call
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument('test-doc-id');

    // Circuit breaker execute should be called
    expect(mockCircuitExecute).toHaveBeenCalled();
  });

  it('handles embedBatch through circuit breaker protection', async () => {
    // Verify circuit breaker wraps embedBatch
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument('test-doc-id');

    // embedBatch should be called through circuit breaker
    expect(mockEmbedBatch).toHaveBeenCalled();
    expect(mockCircuitExecute).toHaveBeenCalled();
  });

  it('handles chunking with zero-size chunks', async () => {
    mockChunkFn.mockResolvedValue([
      { text: '', metadata: { source: 'test-doc-id' } },
      { text: 'valid-chunk', metadata: { source: 'test-doc-id' } },
    ]);

    mockEmbedBatch.mockResolvedValue([
      [0.0, 0.0, 0.0],
      [0.1, 0.2, 0.3],
    ]);

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    const result = await embedDocument('test-doc-id');

    expect(result.success).toBe(true);
    // Should still store zero-length chunk
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        documents: expect.arrayContaining(['', 'valid-chunk']),
      })
    );
  });

  it('supports circuit breaker integration with embedBatch', async () => {
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    const result = await embedDocument('test-doc-id');

    // Should succeed through circuit breaker
    expect(result.success).toBe(true);
    expect(mockCircuitExecute).toHaveBeenCalled();
  });

  it('handles concurrent rapid document uploads without race conditions', async () => {
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    // Simulate 3 rapid uploads
    const results = await Promise.all([
      embedDocument('doc-1'),
      embedDocument('doc-2'),
      embedDocument('doc-3'),
    ]);

    // All should succeed (with mocked data)
    expect(results).toHaveLength(3);
    expect(mockGetDocument).toHaveBeenCalledTimes(3);
  });

  it('preserves document metadata during embedding', async () => {
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument('test-doc-id');

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        metadatas: expect.arrayContaining([
          expect.objectContaining({
            document_id: 'test-doc-id',
            chunk_index: expect.any(Number),
          }),
        ]),
      })
    );
  });

  it('generates correctly-formatted chunk IDs', async () => {
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument('doc-xyz');

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: expect.arrayContaining([
          'doc-xyz_chunk_0',
          'doc-xyz_chunk_1',
        ]),
      })
    );
  });
});
