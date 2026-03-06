import { NextResponse } from 'next/server';
import { getDocument, deleteDocument } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  const doc = getDocument(id);

  if (!doc) {
    logger.warn('Document not found', { documentId: id });
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    status: doc.status,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
    content: doc.content,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
  }

  const doc = getDocument(id);

  if (!doc) {
    logger.warn('Document not found for deletion', { documentId: id });
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    deleteDocument(id);
    logger.info('Document deleted', { documentId: id });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error('Failed to delete document', { documentId: id, error: String(err) });
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
