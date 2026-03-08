import { type Queue } from 'bullmq';
import { createQueue } from '@/lib/queue';
import type { EmbeddingJobData } from './types';

const QUEUE_NAME = 'document-embedding';

let queue: Queue<EmbeddingJobData> | null = null;

export function getEmbeddingQueue(): Queue<EmbeddingJobData> {
  if (!queue) {
    queue = createQueue<EmbeddingJobData>(QUEUE_NAME);
  }
  return queue;
}

export async function addEmbeddingJob(documentId: string): Promise<string | undefined> {
  const q = getEmbeddingQueue();
  const job = await q.add('embed', { documentId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
  return job.id;
}

export async function getJobStatus(jobId: string) {
  const q = getEmbeddingQueue();
  const job = await q.getJob(jobId);
  if (!job) {
    return null;
  }
  return {
    id: job.id,
    state: await job.getState(),
    progress: job.progress,
    data: job.data,
  };
}
