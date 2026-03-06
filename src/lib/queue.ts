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
  return new Worker<T, R>(name, processor, {
    connection: getConnection(),
    concurrency: 3,
  });
}
