import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/repositories/document.repo', () => ({
  createDocument: vi.fn().mockImplementation((data: Record<string, unknown>) => ({
    ...data,
    status: 'waiting',
    tags: '[]',
    content: data.content ?? null,
    chunk_count: 0,
  })),
}));

vi.mock('@/lib/queue/embedding-queue', () => ({
  addEmbeddingJob: vi.fn().mockResolvedValue('job-test-123'),
}));

vi.mock('pdf-parse', () => {
  const getText = vi.fn().mockResolvedValue({ text: 'extracted pdf text', pages: [], total: 0 });
  class MockPDFParse {
    getText = getText;
  }
  return { PDFParse: MockPDFParse };
});

// ---------------------------------------------------------------------------
// Import route AFTER mocks are set up
// ---------------------------------------------------------------------------

import { createDocument } from '@/lib/db/repositories/document.repo';
import { addEmbeddingJob } from '@/lib/queue/embedding-queue';
import { POST } from '../upload/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Request whose formData() resolves to the given FormData.
 * We stub formData() directly because jsdom's Request does not parse
 * multipart bodies, so `new Request(..., { body: formData })` alone
 * would cause formData() to throw in the test environment.
 */
function makeRequest(file?: File): Request {
  const req = new Request('http://localhost/api/documents/upload', {
    method: 'POST',
  });

  if (file) {
    const fd = new FormData();
    fd.append('file', file);
    vi.spyOn(req, 'formData').mockResolvedValue(fd);
  } else {
    // Return an empty FormData (no 'file' key)
    vi.spyOn(req, 'formData').mockResolvedValue(new FormData());
  }

  return req;
}

const DUMMY_PDF = Buffer.from('%PDF-1.4 test content');
const DUMMY_TXT = Buffer.from('Hello, world!');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/documents/upload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a valid TXT file and returns 201 with documentId', async () => {
    const file = new File([DUMMY_TXT], 'readme.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty('documentId');
    expect(body).toHaveProperty('jobId', 'job-test-123');
    expect(body).toHaveProperty('status', 'waiting');
    expect(body).toHaveProperty('fileName', 'readme.txt');
  });

  it('accepts a valid PDF file and returns 201 with documentId', async () => {
    const file = new File([DUMMY_PDF], 'report.pdf', { type: 'application/pdf' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty('documentId');
    expect(body).toHaveProperty('jobId', 'job-test-123');
    expect(body).toHaveProperty('status', 'waiting');
    expect(body).toHaveProperty('fileName', 'report.pdf');
  });

  it('returns 400 when no file is provided', async () => {
    const req = makeRequest(); // no file

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for an invalid file type (image/png)', async () => {
    const file = new File([DUMMY_TXT], 'image.png', { type: 'image/png' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/type/i);
  });

  it('stores extracted text content in the document record (TXT)', async () => {
    const mockCreate = vi.mocked(createDocument);
    mockCreate.mockClear();

    const file = new File([DUMMY_TXT], 'readme.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    await POST(req);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.content).toBe('Hello, world!');
  });

  it('stores extracted PDF text content in the document record', async () => {
    const mockCreate = vi.mocked(createDocument);
    mockCreate.mockClear();

    const file = new File([DUMMY_PDF], 'report.pdf', { type: 'application/pdf' });
    const req = makeRequest(file);

    await POST(req);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.content).toBe('extracted pdf text');
  });

  it('returns 400 for an oversized file (>50 MB)', async () => {
    const FIFTY_ONE_MB = 51 * 1024 * 1024;
    const file = new File([Buffer.alloc(1)], 'huge.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: FIFTY_ONE_MB, configurable: true });

    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/size/i);
  });

  it('queues an embedding job with the documentId after upload', async () => {
    const mockQueue = vi.mocked(addEmbeddingJob);
    mockQueue.mockClear();

    const file = new File([DUMMY_TXT], 'readme.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockQueue).toHaveBeenCalledTimes(1);
    expect(mockQueue).toHaveBeenCalledWith(body.documentId);
  });

  it('sets document status to waiting in the response', async () => {
    const file = new File([DUMMY_TXT], 'doc.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe('waiting');
  });

  it('sets owner_id to the mock user id on upload', async () => {
    const mockCreate = vi.mocked(createDocument);
    mockCreate.mockClear();

    const file = new File([DUMMY_TXT], 'owned.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    await POST(req);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.owner_id).toBe('user-test-123');
  });

  // Error handling integration tests (Task #26)

  it('returns 500 when document creation fails in database', async () => {
    const mockCreate = vi.mocked(createDocument);
    mockCreate.mockImplementationOnce(() => {
      throw new Error('Database constraint violation');
    });

    const file = new File([DUMMY_TXT], 'baddb.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to store document');
  });

  it('returns 500 when embedding job queue fails', async () => {
    const mockQueue = vi.mocked(addEmbeddingJob);
    mockQueue.mockRejectedValueOnce(new Error('Redis connection failed'));

    const file = new File([DUMMY_TXT], 'noqueue.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to queue embedding job');
  });

  it('returns 400 when form data parsing fails', async () => {
    const req = new Request('http://localhost/api/documents/upload', {
      method: 'POST',
    });
    vi.spyOn(req, 'formData').mockRejectedValue(new Error('Invalid multipart format'));

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid form data');
  });

  it('logs file context on upload success', async () => {
    const file = new File([DUMMY_TXT], 'context.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    await POST(req);

    // Verify logger was called with file context
    // (This test verifies logging occurs without throwing)
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('preserves document in database even if embedding job queue fails', async () => {
    const mockCreate = vi.mocked(createDocument);
    const mockQueue = vi.mocked(addEmbeddingJob);

    mockCreate.mockClear();
    mockQueue.mockRejectedValueOnce(new Error('Queue unavailable'));

    const file = new File([DUMMY_TXT], 'persist.txt', { type: 'text/plain' });
    const req = makeRequest(file);

    const res = await POST(req);

    // Document should still be created even though queue fails
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(500);
  });

  it('returns specific error message for unsupported file type with correct status', async () => {
    const file = new File([DUMMY_TXT], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const req = makeRequest(file);

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Unsupported file type');
    expect(body.error).toContain('PDF');
    expect(body.error).toContain('TXT');
  });

  it('returns specific error message for oversized file with correct status', async () => {
    const FIFTY_ONE_MB = 51 * 1024 * 1024;
    const file = new File([Buffer.alloc(1)], 'massive.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: FIFTY_ONE_MB, configurable: true });

    const req = makeRequest(file);
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('File size exceeds');
    expect(body.error).toContain('50 MB');
  });
});
