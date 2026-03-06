import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetDocument = vi.hoisted(() => vi.fn());
const mockShareDocument = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/repositories/document.repo', () => ({
  getDocument: mockGetDocument,
  shareDocument: mockShareDocument,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { POST } from '../[id]/share/route';

function makeRequest(documentId: string, email: string): Request {
  const url = `http://localhost/api/documents/${documentId}/share`;
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

describe('POST /api/documents/:id/share', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shares document with valid email', async () => {
    mockGetDocument.mockReturnValue({
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'user-test-123',
      shared_users: '[]',
    });

    const req = makeRequest('doc1', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockShareDocument).toHaveBeenCalledWith('doc1', 'alice@example.com');
    expect(typeof body.response_time).toBe('number');
  });

  it('returns 404 when document not found', async () => {
    mockGetDocument.mockReturnValue(null);

    const req = makeRequest('nonexistent', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Document not found');
  });

  it('returns 403 when user is not document owner', async () => {
    mockGetDocument.mockReturnValue({
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'other-user-456',
      shared_users: '[]',
    });

    const req = makeRequest('doc1', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('do not have permission');
  });

  it('returns 409 when already shared with user', async () => {
    mockGetDocument.mockReturnValue({
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'user-test-123',
      shared_users: JSON.stringify(['alice@example.com']),
    });

    const req = makeRequest('doc1', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already shared');
  });

  it('returns 400 for invalid email', async () => {
    mockGetDocument.mockReturnValue({
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'user-test-123',
      shared_users: '[]',
    });

    const req = makeRequest('doc1', 'invalid-email');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('email');
  });

  it('returns 500 on database error', async () => {
    mockGetDocument.mockImplementation(() => {
      throw new Error('Database error');
    });

    const req = makeRequest('doc1', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to share document');
  });

  it('returns updated document after sharing', async () => {
    const docBefore = {
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'user-test-123',
      shared_users: '[]',
    };

    const docAfter = {
      id: 'doc1',
      name: 'test.pdf',
      owner_id: 'user-test-123',
      shared_users: JSON.stringify(['alice@example.com']),
    };

    mockGetDocument
      .mockReturnValueOnce(docBefore)
      .mockReturnValueOnce(docAfter);

    const req = makeRequest('doc1', 'alice@example.com');
    const res = await POST(req, { params: Promise.resolve({ id: 'doc1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.document).toEqual(docAfter);
  });
});
