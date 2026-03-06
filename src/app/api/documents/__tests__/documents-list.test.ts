import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

const mockGetUserDocuments = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/repositories/document.repo', () => ({
  getUserDocuments: mockGetUserDocuments,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET } from '../route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with documents owned by or shared with the user', async () => {
    const ownedDoc = {
      id: 'doc-1',
      name: 'owned.txt',
      format: 'text/plain',
      size: 100,
      status: 'done',
      tags: '[]',
      file_path: null,
      content: null,
      chunk_count: 2,
      owner_id: 'user-test-123',
      shared_users: '[]',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    };
    const sharedDoc = {
      id: 'doc-2',
      name: 'shared.txt',
      format: 'text/plain',
      size: 200,
      status: 'done',
      tags: '[]',
      file_path: null,
      content: null,
      chunk_count: 1,
      owner_id: 'other-user',
      shared_users: '["user-test-123"]',
      created_at: '2024-01-02T00:00:00.000Z',
      updated_at: '2024-01-02T00:00:00.000Z',
    };

    mockGetUserDocuments.mockReturnValue([ownedDoc, sharedDoc]);

    const req = new Request('http://localhost/api/documents', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json() as unknown[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(mockGetUserDocuments).toHaveBeenCalledWith('user-test-123', 20, 0);
  });

  it('returns 200 with empty array when user has no documents', async () => {
    mockGetUserDocuments.mockReturnValue([]);

    const req = new Request('http://localhost/api/documents', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json() as unknown[];

    expect(res.status).toBe(200);
    expect(body).toHaveLength(0);
  });

  it('returns 500 when getUserDocuments throws', async () => {
    mockGetUserDocuments.mockImplementation(() => {
      throw new Error('DB error');
    });

    const req = new Request('http://localhost/api/documents', { method: 'GET' });
    const res = await GET(req);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to retrieve documents');
  });

  it('calls getUserDocuments with the mock user id and pagination defaults', async () => {
    mockGetUserDocuments.mockReturnValue([]);

    const req = new Request('http://localhost/api/documents', { method: 'GET' });
    await GET(req);

    expect(mockGetUserDocuments).toHaveBeenCalledTimes(1);
    expect(mockGetUserDocuments).toHaveBeenCalledWith('user-test-123', 20, 0);
  });
});
