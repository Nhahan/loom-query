import { type Worker } from 'bullmq';
import { startEmbeddingProcessor } from './embedding-processor';
import { logger } from '@/lib/logger';

let worker: Worker | null = null;
let isStarting = false;

/**
 * Start the embedding processor worker if not already running
 */
export async function ensureWorkerStarted(): Promise<void> {
  // Prevent race conditions
  if (isStarting) {
    return;
  }

  if (worker) {
    return;
  }

  try {
    isStarting = true;
    logger.info('Starting embedding processor worker...');

    worker = startEmbeddingProcessor();

    logger.info('Embedding processor worker started successfully');
  } catch (error) {
    logger.error('Failed to start embedding processor worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    worker = null;
    throw error;
  } finally {
    isStarting = false;
  }
}

/**
 * Get the current worker instance
 */
export function getWorker(): Worker | null {
  return worker;
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return worker !== null;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (!worker) {
    return;
  }

  try {
    logger.info('Stopping embedding processor worker...');
    await worker.close();
    worker = null;
    logger.info('Embedding processor worker stopped');
  } catch (error) {
    logger.error('Failed to stop embedding processor worker', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
