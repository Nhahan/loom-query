import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockChunks = [
  { text: 'chunk-0', metadata: { source: 'test-doc-id' } },
  { text: 'chunk-1', metadata: { source: 'test-doc-id' } },
  { text: 'chunk-2', metadata: { source: 'test-doc-id' } },
];

const mockChunkFn = vi.fn().mockResolvedValue(mockChunks);
const mockFromText = vi.fn().mockReturnValue({ chunk: mockChunkFn });

vi.mock('@mastra/rag', () => ({
  MDocument: { fromText: mockFromText },
}));

const mockEmbedBatch = vi.fn().mockResolvedValue([
  [0.1, 0.2, 0.3],
  [0.4, 0.5, 0.6],
  [0.7, 0.8, 0.9],
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
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// --- Tests ---

describe('embedDocument', () => {
  const testDocId = 'test-doc-id';
  const testDoc = {
    id: testDocId,
    name: 'test.txt',
    format: 'text/plain',
    size: 100,
    status: 'waiting' as const,
    tags: '[]',
    file_path: '/tmp/test.txt',
    content: 'This is the actual document content for embedding.',
    chunk_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocument.mockReturnValue(testDoc);
    mockChunkFn.mockResolvedValue(mockChunks);
    mockEmbedBatch.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ]);
    mockAdd.mockResolvedValue(undefined);
    mockGetOrCreateCollection.mockResolvedValue({ add: mockAdd });
  });

  it('chunks document text, embeds, stores in ChromaDB, and updates status to done', async () => {
    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    const result = await embedDocument(testDocId);

    // Verify MDocument.fromText called with doc content (not filename)
    expect(mockFromText).toHaveBeenCalledWith(testDoc.content, {
      source: testDocId,
    });

    // Verify chunk called with recursive strategy
    expect(mockChunkFn).toHaveBeenCalledWith({
      strategy: 'recursive',
      maxSize: 512,
      overlap: 50,
    });

    // Verify embedBatch called with all chunk texts (single batch request)
    expect(mockEmbedBatch).toHaveBeenCalledTimes(1);
    expect(mockEmbedBatch).toHaveBeenCalledWith(['chunk-0', 'chunk-1', 'chunk-2']);

    // Verify ChromaDB collection created/retrieved
    expect(mockGetOrCreateCollection).toHaveBeenCalledWith({
      name: 'documents',
    });

    // Verify ChromaDB add called with correct shape
    expect(mockAdd).toHaveBeenCalledWith({
      ids: expect.arrayContaining([
        `${testDocId}_chunk_0`,
        `${testDocId}_chunk_1`,
        `${testDocId}_chunk_2`,
      ]),
      documents: ['chunk-0', 'chunk-1', 'chunk-2'],
      embeddings: [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ],
      metadatas: [
        { document_id: testDocId, chunk_index: 0 },
        { document_id: testDocId, chunk_index: 1 },
        { document_id: testDocId, chunk_index: 2 },
      ],
    });

    // Verify document status updated to done with chunk_count
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(testDocId, 'done', {
      chunk_count: 3,
    });

    // Verify return value
    expect(result).toEqual({ success: true, chunkCount: 3 });
  });

  it('returns error when document is not found', async () => {
    mockGetDocument.mockReturnValue(null);

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    const result = await embedDocument('nonexistent-id');

    expect(result).toEqual({
      success: false,
      error: 'Document not found: nonexistent-id',
    });
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(
      'nonexistent-id',
      'failed',
    );
  });

  it('uses empty string when doc.content is null', async () => {
    mockGetDocument.mockReturnValue({ ...testDoc, content: null });

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await embedDocument(testDocId);

    expect(mockFromText).toHaveBeenCalledWith('', {
      source: testDocId,
    });
  });

  it('throws when chunking fails (letting BullMQ handle retry)', async () => {
    mockChunkFn.mockRejectedValue(new Error('Chunking failed'));

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await expect(embedDocument(testDocId)).rejects.toThrow('Chunking failed');

    // Status should be set to 'processing' but NOT 'failed' (let BullMQ retry)
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(testDocId, 'processing');
    // Should NOT call updateDocumentStatus with 'failed' (Worker failed event handler does this)
    expect(mockUpdateDocumentStatus).not.toHaveBeenCalledWith(
      testDocId,
      'failed',
      expect.any(Object)
    );
  });

  it('throws when embedding fails (letting BullMQ handle retry)', async () => {
    mockEmbedBatch.mockRejectedValue(new Error('Embedding service down'));

    const { embedDocument } = await import(
      '@/features/documents/actions/embed-document'
    );

    await expect(embedDocument(testDocId)).rejects.toThrow('Embedding service down');

    // Status should be set to 'processing' but NOT 'failed' (let BullMQ retry)
    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(testDocId, 'processing');
    // Should NOT call updateDocumentStatus with 'failed' (Worker failed event handler does this)
    expect(mockUpdateDocumentStatus).not.toHaveBeenCalledWith(
      testDocId,
      'failed',
      expect.any(Object)
    );
  });
});
