import { NextResponse } from 'next/server';
import { getDocument, shareDocument } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MOCK_USER_ID = 'user-test-123';

const ShareRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const parsed = ShareRequestSchema.safeParse(body);

    if (!parsed.success) {
      const error = parsed.error.issues[0];
      logger.warn('Invalid share request', { error: error?.message });
      return NextResponse.json({ error: error?.message || 'Invalid request' }, { status: 400 });
    }

    const { email } = parsed.data;

    const doc = getDocument(id);
    if (!doc) {
      logger.warn('Document not found for sharing', { documentId: id });
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (doc.owner_id !== MOCK_USER_ID) {
      logger.warn('User not authorized to share document', { documentId: id });
      return NextResponse.json(
        { error: 'You do not have permission to share this document' },
        { status: 403 }
      );
    }

    const sharedUsers = JSON.parse(doc.shared_users || '[]') as string[];
    if (sharedUsers.includes(email)) {
      logger.warn('Document already shared with user', { documentId: id, email });
      return NextResponse.json(
        { error: 'Document is already shared with this user' },
        { status: 409 }
      );
    }

    shareDocument(id, email);
    const responseTime = Date.now() - startTime;

    logger.info('Document shared successfully', { documentId: id, email, response_time: responseTime });

    const updatedDoc = getDocument(id);
    return NextResponse.json({ document: updatedDoc, response_time: responseTime });
  } catch (err) {
    logger.error('Failed to share document', { error: String(err) });
    return NextResponse.json({ error: 'Failed to share document' }, { status: 500 });
  }
}
