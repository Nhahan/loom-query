import { NextResponse } from 'next/server';
import { getUserDocuments } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';

// Phase 2: use hardcoded test user; replace with session lookup in Phase 3
const MOCK_USER_ID = 'user-test-123';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0);

    const docs = getUserDocuments(MOCK_USER_ID, limit, offset);
    return NextResponse.json(docs);
  } catch (err) {
    logger.error('Failed to list documents', { error: String(err), userId: MOCK_USER_ID });
    return NextResponse.json({ error: 'Failed to retrieve documents' }, { status: 500 });
  }
}
