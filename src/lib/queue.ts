import { Queue, Worker, type Processor, type ConnectionOptions } from 'bullmq';
import { getRedisConfig } from './redis-config';

function getConnection(): ConnectionOptions {
  // Use centralized Redis config to avoid duplication
  return getRedisConfig();
}

export function createQueue<T>(name: string): Queue<T> {
  return new Queue<T>(name, {
    connection: getConnection(),
  });
}

export function createWorker<T, R>(
  name: string,
  processor: Processor<T, R>,
): Worker<T, R> {
  // Get concurrency from environment (default: 2 after embedBatch optimization)
  // Higher values may saturate Ollama; lower values underutilize resources
  const workerConcurrency = parseInt(
    process.env.WORKER_CONCURRENCY ?? '2',
    10,
  );

  return new Worker<T, R>(name, processor, {
    connection: getConnection(),
    concurrency: workerConcurrency,
    // Rate limiter: cap max jobs per time window to prevent Ollama saturation
    // Default: 10 jobs per second (tunable via env if needed)
    limiter: {
      max: parseInt(process.env.WORKER_RATE_LIMIT_MAX ?? '10', 10),
      duration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION ?? '1000', 10),
    },
  });
}
