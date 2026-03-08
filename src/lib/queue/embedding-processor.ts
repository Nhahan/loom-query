import { type Worker, type Job } from 'bullmq';
import { createWorker } from '@/lib/queue';
import { embedDocument } from '@/features/documents/actions/embed-document';
import { updateDocumentStatus } from '@/lib/db/repositories/document.repo';
import { logger } from '@/lib/logger';
import type { EmbeddingJobData } from './types';
import { classifyError } from './error-classifier';
import { getOllamaCircuitBreaker } from './circuit-breaker';
import { getMetricsCollector } from './metrics';

const QUEUE_NAME = 'document-embedding';

// Track job start times for duration metrics
// WeakMap would be ideal but Job objects may be GC'd, so use regular Map with cleanup
const jobStartTimes = new Map<string, number>();

export function startEmbeddingProcessor(): Worker<EmbeddingJobData, unknown> {
  const worker = createWorker<EmbeddingJobData, unknown>(
    QUEUE_NAME,
    async (job: Job<EmbeddingJobData>) => {
      const { documentId } = job.data;

      // Track job start time for metrics
      if (job.id) {
        jobStartTimes.set(job.id, Date.now());
      }

      logger.info('Processing embedding job', {
        jobId: job.id,
        documentId,
        attempt: job.attemptsMade + 1,
      });

      // Report job start
      await job.updateProgress(10);

      const result = await embedDocument(documentId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Report job near completion
      await job.updateProgress(90);

      logger.info('Embedding job completed', {
        jobId: job.id,
        documentId,
        chunkCount: result.chunkCount,
      });

      // Report 100% completion
      await job.updateProgress(100);

      return result;
    },
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });

    // Calculate duration for metrics
    const jobId = job.id || 'unknown';
    const startTime = jobStartTimes.get(jobId);
    const duration = startTime ? Date.now() - startTime : undefined;

    // Record metrics for observability
    getMetricsCollector().recordEvent({
      jobId,
      documentId: job.data.documentId,
      type: 'completed',
      timestamp: Date.now(),
      duration,
    });

    // Clean up job start time tracking
    if (job.id) {
      jobStartTimes.delete(job.id);
    }
  });

  worker.on('failed', (job, err) => {
    if (!job) return;

    // Classify error to provide context for debugging
    const classified = classifyError(err);
    const errorContext = {
      jobId: job.id,
      documentId: job.data.documentId,
      error: err.message,
      errorType: classified.type,
      errorCode: classified.code,
      attempts: job.attemptsMade + 1,
    };

    logger.error('Job failed permanently', errorContext);

    // Provide detailed error message including error classification
    // Note: Error type/code is logged above but not stored (database schema doesn't support yet)
    const errorDetails = `${err.message}${classified.code ? ` (${classified.code})` : ''}`;
    updateDocumentStatus(job.data.documentId, 'failed', {
      error_message: errorDetails,
    });

    // Calculate duration for metrics
    const jobId = job.id || 'unknown';
    const startTime = jobStartTimes.get(jobId);
    const duration = startTime ? Date.now() - startTime : undefined;

    // Record metrics for observability
    getMetricsCollector().recordEvent({
      jobId,
      documentId: job.data.documentId,
      type: 'failed',
      timestamp: Date.now(),
      duration,
      errorType: classified.type,
      errorCode: classified.code,
    });

    // Clean up job start time tracking
    if (job.id) {
      jobStartTimes.delete(job.id);
    }
  });

  return worker;
}
