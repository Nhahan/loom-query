import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { PDFParse } from 'pdf-parse';
import { createDocument } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';
import { MAX_FILE_SIZE } from '@/lib/constants';
const ALLOWED_TYPES = new Set(['application/pdf', 'text/plain']);

export async function POST(request: Request): Promise<NextResponse> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const file = fileEntry;

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    logger.warn('Upload rejected: unsupported file type', {
      fileName: file.name,
      fileType: file.type,
      size: file.size,
    });
    return NextResponse.json(
      { error: 'Unsupported file type. Only PDF and TXT files are accepted' },
      { status: 400 },
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    logger.warn('Upload rejected: file too large', {
      fileName: file.name,
      size: file.size,
    });
    return NextResponse.json(
      { error: 'File size exceeds maximum allowed size of 50 MB' },
      { status: 400 },
    );
  }

  let extractedText: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === 'application/pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      extractedText = result.text;
    } else {
      extractedText = buffer.toString('utf-8');
    }
  } catch (err) {
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('Text extraction failed', {
      fileName: file.name,
      size: file.size,
      error: String(err),
      stack,
    });
    return NextResponse.json({ error: 'Failed to extract text from file' }, { status: 500 });
  }

  const now = new Date().toISOString();
  const documentId = uuidv4();

  // Phase 2: use hardcoded test user; replace with session lookup in Phase 3
  const MOCK_USER_ID = 'user-test-123';

  try {
    createDocument({
      id: documentId,
      name: file.name,
      format: file.type,
      size: file.size,
      status: 'waiting',
      file_path: null,
      content: extractedText,
      owner_id: MOCK_USER_ID,
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('Failed to persist document', {
      fileName: file.name,
      size: file.size,
      error: String(err),
      documentId,
      stack,
    });
    return NextResponse.json({ error: 'Failed to store document' }, { status: 500 });
  }

  let jobId: string | undefined;
  try {
    const { addEmbeddingJob } = await import('@/lib/queue/embedding-queue');
    jobId = await addEmbeddingJob(documentId);
  } catch (err) {
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error('Failed to queue embedding job', {
      fileName: file.name,
      documentId,
      error: String(err),
      stack,
    });
    return NextResponse.json({ error: 'Failed to queue embedding job' }, { status: 500 });
  }

  logger.info('Document uploaded and job queued', { documentId, jobId, fileName: file.name, size: file.size });

  return NextResponse.json(
    { documentId, jobId, status: 'waiting', fileName: file.name },
    { status: 201 },
  );
}
