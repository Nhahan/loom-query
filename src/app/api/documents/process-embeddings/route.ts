import { NextResponse } from 'next/server';
import { listDocuments } from '@/lib/db/repositories/document.repo';
import { embedDocument } from '@/features/documents/actions/embed-document';
import { logger } from '@/lib/logger';

/**
 * Process all waiting documents for embedding (test endpoint)
 * POST /api/documents/process-embeddings
 */

export async function POST(): Promise<NextResponse> {
  try {
    // Get all documents (no limit - process all waiting documents)
    const allDocs = listDocuments({ limit: 10000 });

    // Filter documents that need processing
    const waitingDocs = allDocs.filter(
      (doc) => doc.status === 'waiting' && (!doc.chunk_count || doc.chunk_count === 0),
    );

    if (waitingDocs.length === 0) {
      return NextResponse.json(
        { message: 'No documents waiting for processing', processed: [] },
        { status: 200 },
      );
    }

    logger.info(`Processing ${waitingDocs.length} documents`);

    // Process each document
    const results = await Promise.all(
      waitingDocs.map(async (doc) => {
        try {
          const result = await embedDocument(doc.id);
          if (result.success) {
            return {
              documentId: doc.id,
              name: doc.name,
              success: true,
              chunkCount: result.chunkCount,
              error: null,
            };
          } else {
            return {
              documentId: doc.id,
              name: doc.name,
              success: false,
              chunkCount: 0,
              error: result.error,
            };
          }
        } catch (err) {
          return {
            documentId: doc.id,
            name: doc.name,
            success: false,
            chunkCount: 0,
            error: String(err),
          };
        }
      }),
    );

    return NextResponse.json(
      {
        message: 'Processed waiting documents',
        processed: results,
        summary: {
          total: results.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process embeddings', message: String(error) },
      { status: 500 },
    );
  }
}
