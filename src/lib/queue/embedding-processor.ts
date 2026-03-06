import { type Worker, type Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { embedDocument } from '@/features/documents/actions/embed-document';
import { updateDocumentStatus } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';

const QUEUE_NAME = 'document-embedding';

interface EmbeddingJobData {
  documentId: string;
}

export function startEmbeddingProcessor(): Worker<EmbeddingJobData, unknown> {
  const worker = createWorker<EmbeddingJobData, unknown>(
    QUEUE_NAME,
    async (job: Job<EmbeddingJobData>) => {
      const { documentId } = job.data;

      logger.info('Processing embedding job', {
        jobId: job.id,
        documentId,
        attempt: job.attemptsMade + 1,
      });

      const result = await embedDocument(documentId);

      if (!result.success) {
        throw new Error(result.error);
      }

      logger.info('Embedding job completed', {
        jobId: job.id,
        documentId,
        chunkCount: result.chunkCount,
      });

      return result;
    },
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    logger.error('Job failed permanently', {
      jobId: job.id,
      documentId: job.data.documentId,
      error: err.message,
    });
    updateDocumentStatus(job.data.documentId, 'failed', {
      error_message: err.message,
    });
  });

  return worker;
}

// If run directly, start the processor
if (require.main === module) {
  startEmbeddingProcessor();
  logger.info('Embedding processor started');
}
