import type { Collection } from 'chromadb';
import { MDocument } from '@mastra/rag';

import { getMastraClient } from '@/lib/mastra';
import { getChromaClient } from '@/lib/chroma';
import {
  getDocument,
  updateDocumentStatus,
} from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';
import { getOllamaCircuitBreaker, getChromaCircuitBreaker } from '@/lib/queue/circuit-breaker';

export type EmbedDocumentResult =
  | { success: true; chunkCount: number }
  | { success: false; error: string };

// Cache the ChromaDB collection reference to avoid repeated HTTP calls
// The collection name is static, so caching is safe
let cachedDocumentsCollection: Collection | null = null;

/**
 * Embed a document: chunk it, generate embeddings, and store in ChromaDB.
 *
 * This function performs a single embedding attempt. Retry logic is handled
 * by BullMQ at the job level (embedding-queue.ts: attempts: 3, backoff: exponential).
 * If this function throws, BullMQ will retry the entire job.
 *
 * Note: Called from BullMQ Worker process, not from Client Components,
 * so it does not need the 'use server' directive.
 */
export async function embedDocument(
  documentId: string,
): Promise<EmbedDocumentResult> {
  const doc = getDocument(documentId);
  if (!doc) {
    logger.error('Document not found for embedding', { documentId });
    updateDocumentStatus(documentId, 'failed');
    return { success: false, error: `Document not found: ${documentId}` };
  }

  try {
    updateDocumentStatus(documentId, 'processing');

    // Chunk document text using Mastra recursive strategy
    const mdoc = MDocument.fromText(doc.content || '', { source: documentId });
    const chunks = await mdoc.chunk({
      strategy: 'recursive',
      maxSize: 512,
      overlap: 50,
    });

    // Generate embeddings for all chunks in a single batch request
    // Using embedBatch() instead of Promise.all(map(embed)) reduces N HTTP round-trips to 1
    // Expected improvement: 3-10x throughput for documents with many chunks
    // Protected by circuit breaker to prevent cascading Ollama failures
    const mastra = getMastraClient();
    const circuitBreaker = getOllamaCircuitBreaker();
    const embeddings = await circuitBreaker.execute(() =>
      mastra.embedBatch(chunks.map((chunk) => chunk.text))
    );

    // Store in ChromaDB (use cached collection reference to avoid network round-trip)
    // Protected by circuit breaker to handle ChromaDB failures gracefully
    if (!cachedDocumentsCollection) {
      const chroma = getChromaClient();
      const chromaCb = getChromaCircuitBreaker();
      cachedDocumentsCollection = await chromaCb.execute(() =>
        chroma.getOrCreateCollection({ name: 'documents' })
      );
    }
    const collection = cachedDocumentsCollection;

    const chromaCb = getChromaCircuitBreaker();
    await chromaCb.execute(() =>
      collection.add({
        ids: chunks.map((_, i) => `${documentId}_chunk_${i}`),
        documents: chunks.map((chunk) => chunk.text),
        embeddings,
        metadatas: chunks.map((_, i) => ({
          document_id: documentId,
          chunk_index: i,
        })),
      })
    );

    // Update document status to done
    updateDocumentStatus(documentId, 'done', { chunk_count: chunks.length });

    logger.info('Document embedded successfully', {
      documentId,
      chunkCount: chunks.length,
      embeddingDimensions: embeddings[0]?.length ?? 0,
    });

    return { success: true, chunkCount: chunks.length };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown embedding error';

    logger.error('Document embedding failed', {
      documentId,
      error: errorMsg,
    });

    // Note: Do NOT update status to 'failed' here. Let BullMQ retry.
    // Only update to 'failed' if all retries are exhausted.
    // The Worker's failed event handler will mark it as failed.

    // Throw error so BullMQ knows to retry
    throw err;
  }
}
