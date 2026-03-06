import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/repositories/document.repo', () => ({
  getDocument: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import route AFTER mocks are set up
// ---------------------------------------------------------------------------

import { getDocument } from '@/lib/db/repositories/document.repo';
import { GET } from '../[id]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(id: string): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/documents/${id}`);
  const params = Promise.resolve({ id });
  return [req, { params }];
}

const MOCK_DOCUMENT = {
  id: 'doc-abc',
  name: 'readme.txt',
  format: 'text/plain',
  size: 13,
  status: 'waiting' as const,
  tags: '[]',
  file_path: null,
  content: 'Hello, world!',
  chunk_count: 0,
  error_message: null,
  owner_id: null,
  shared_users: '[]',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/documents/:id', () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockReset();
  });

  it('returns 200 with document fields when document exists', async () => {
    vi.mocked(getDocument).mockReturnValue(MOCK_DOCUMENT);

    const [req, ctx] = makeRequest('doc-abc');
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('doc-abc');
    expect(body.name).toBe('readme.txt');
    expect(body.status).toBe('waiting');
    expect(body.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(body.updated_at).toBe('2026-01-01T00:00:00.000Z');
    expect(body.content).toBe('Hello, world!');
  });

  it('returns 404 when document does not exist', async () => {
    vi.mocked(getDocument).mockReturnValue(null);

    const [req, ctx] = makeRequest('nonexistent-id');
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty('error');
  });

  it('calls getDocument with the correct id from params', async () => {
    vi.mocked(getDocument).mockReturnValue(MOCK_DOCUMENT);

    const [req, ctx] = makeRequest('doc-xyz');
    await GET(req, ctx);

    expect(vi.mocked(getDocument)).toHaveBeenCalledWith('doc-xyz');
  });

  it('integration: status remains waiting after upload, client can poll and get waiting status', async () => {
    vi.mocked(getDocument).mockReturnValue({ ...MOCK_DOCUMENT, status: 'waiting' });

    const [req, ctx] = makeRequest('doc-abc');
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('waiting');
  });
});
