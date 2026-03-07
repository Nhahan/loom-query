'use server';

import { MDocument } from '@mastra/rag';

import { getMastraClient } from '@/lib/mastra';
import { getChromaClient } from '@/lib/chroma';
import {
  getDocument,
  updateDocumentStatus,
} from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';

export type EmbedDocumentResult =
  | { success: true; chunkCount: number }
  | { success: false; error: string };

const MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS_LARGE = 5; // More retries for large files
const BASE_DELAY_MS = 1000;
const BASE_DELAY_LARGE_MS = 2000; // Longer initial delay for large files
const LARGE_FILE_SIZE_BYTES = 500 * 1024; // 500 KB
const VERY_LARGE_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB - use even longer delays

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLargeFile(content: string): boolean {
  const byteLength = Buffer.byteLength(content || '', 'utf8');
  return byteLength > LARGE_FILE_SIZE_BYTES;
}

async function attemptEmbedding(documentId: string, content: string): Promise<number> {
  // Chunk document text using Mastra recursive strategy
  const mdoc = MDocument.fromText(content, { source: documentId });
  const chunks = await mdoc.chunk({
    strategy: 'recursive',
    maxSize: 512,
    overlap: 50,
  });

  // Generate embeddings for each chunk
  const mastra = getMastraClient();
  const embeddings = await Promise.all(
    chunks.map((chunk) => mastra.embed(chunk.text)),
  );

  // Store in ChromaDB
  const chroma = getChromaClient();
  const collection = await chroma.getOrCreateCollection({ name: 'documents' });

  await collection.add({
    ids: chunks.map((_, i) => `${documentId}_chunk_${i}`),
    documents: chunks.map((chunk) => chunk.text),
    embeddings,
    metadatas: chunks.map((_, i) => ({
      document_id: documentId,
      chunk_index: i,
    })),
  });

  return chunks.length;
}

export async function embedDocument(
  documentId: string,
): Promise<EmbedDocumentResult> {
  const doc = getDocument(documentId);
  if (!doc) {
    logger.error('Document not found for embedding', { documentId });
    updateDocumentStatus(documentId, 'failed');
    return { success: false, error: `Document not found: ${documentId}` };
  }

  updateDocumentStatus(documentId, 'processing');

  let lastError: string = 'Unknown embedding error';

  // Use more retries for large files
  const contentSize = (doc.content || '').length;
  const isLarge = isLargeFile(doc.content || '');
  const maxAttempts = isLarge ? MAX_ATTEMPTS_LARGE : MAX_ATTEMPTS;

  logger.info('Starting document embedding', {
    documentId,
    contentSize,
    isLargeFile: isLarge,
    maxAttempts,
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const chunkCount = await attemptEmbedding(documentId, doc.content || '');

      // Update document status to done
      updateDocumentStatus(documentId, 'done', { chunk_count: chunkCount });

      logger.info('Document embedded successfully', {
        documentId,
        chunkCount,
        attempt,
      });

      return { success: true, chunkCount };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown embedding error';
      logger.warn('Embedding attempt failed', {
        documentId,
        attempt,
        maxAttempts,
        error: lastError,
      });

      if (attempt < maxAttempts) {
        // Use longer backoff delays for large files
        const baseDelay = isLarge ? BASE_DELAY_LARGE_MS : BASE_DELAY_MS;
        const delayMs = baseDelay * Math.pow(2, attempt - 1);
        logger.info('Retrying embedding after backoff', {
          documentId,
          attempt,
          delayMs,
          isLargeFile: isLarge,
        });
        await sleep(delayMs);
      }
    }
  }

  // All attempts exhausted
  logger.error('Document embedding failed after all retries', {
    documentId,
    maxAttempts,
    error: lastError,
  });
  updateDocumentStatus(documentId, 'failed', { error_message: lastError });
  return { success: false, error: lastError };
}
