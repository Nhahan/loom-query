import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the processor callback and event handlers
let capturedProcessor: ((job: unknown) => Promise<unknown>) | null = null;
const eventHandlers: Record<string, ((...args: unknown[]) => void)> = {};

const mockWorker = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    eventHandlers[event] = handler;
  }),
};

vi.mock('@/lib/queue', () => ({
  createWorker: vi.fn((_name: string, processor: (job: unknown) => Promise<unknown>) => {
    capturedProcessor = processor;
    return mockWorker;
  }),
}));

const mockEmbedDocument = vi.fn();
vi.mock('@/features/documents/actions/embed-document', () => ({
  embedDocument: (...args: unknown[]) => mockEmbedDocument(...args),
}));

const mockUpdateDocumentStatus = vi.fn();
vi.mock('@/lib/db/repositories/document.repo', () => ({
  updateDocumentStatus: (...args: unknown[]) => mockUpdateDocumentStatus(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('embedding-processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    Object.keys(eventHandlers).forEach((key) => delete eventHandlers[key]);
  });

  it('startEmbeddingProcessor creates a worker and returns it', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    const { createWorker } = await import('@/lib/queue');

    const worker = startEmbeddingProcessor();

    expect(createWorker).toHaveBeenCalledWith(
      'document-embedding',
      expect.any(Function),
    );
    expect(worker).toBe(mockWorker);
  });

  it('job processor calls embedDocument and returns result on success', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    startEmbeddingProcessor();

    expect(capturedProcessor).not.toBeNull();

    const successResult = { success: true, chunkCount: 5 };
    mockEmbedDocument.mockResolvedValue(successResult);

    const fakeJob = {
      id: 'job-1',
      data: { documentId: 'doc-abc' },
      attemptsMade: 0,
    };

    const result = await capturedProcessor!(fakeJob);

    expect(mockEmbedDocument).toHaveBeenCalledWith('doc-abc');
    expect(result).toEqual(successResult);
  });

  it('job processor throws when embedDocument returns failure', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    startEmbeddingProcessor();

    expect(capturedProcessor).not.toBeNull();

    mockEmbedDocument.mockResolvedValue({
      success: false,
      error: 'Document not found: doc-xyz',
    });

    const fakeJob = {
      id: 'job-2',
      data: { documentId: 'doc-xyz' },
      attemptsMade: 0,
    };

    await expect(capturedProcessor!(fakeJob)).rejects.toThrow(
      'Document not found: doc-xyz',
    );
  });

  it('failed event handler updates document status to failed', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    startEmbeddingProcessor();

    expect(eventHandlers['failed']).toBeDefined();

    const fakeJob = {
      id: 'job-3',
      data: { documentId: 'doc-fail' },
    };
    const fakeError = new Error('Embedding service unavailable');

    eventHandlers['failed'](fakeJob, fakeError);

    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith(
      'doc-fail',
      'failed',
      { error_message: 'Embedding service unavailable' },
    );
  });

  it('failed event handler does nothing when job is null', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    startEmbeddingProcessor();

    expect(eventHandlers['failed']).toBeDefined();

    const fakeError = new Error('some error');
    eventHandlers['failed'](null, fakeError);

    expect(mockUpdateDocumentStatus).not.toHaveBeenCalled();
  });

  it('registers completed event handler', async () => {
    const { startEmbeddingProcessor } = await import(
      '@/lib/queue/embedding-processor'
    );
    startEmbeddingProcessor();

    expect(mockWorker.on).toHaveBeenCalledWith(
      'completed',
      expect.any(Function),
    );
    expect(eventHandlers['completed']).toBeDefined();
  });
});
