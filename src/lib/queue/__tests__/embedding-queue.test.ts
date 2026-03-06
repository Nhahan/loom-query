import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockGetJob = vi.fn();

// Mock bullmq with a proper constructor function
vi.mock('bullmq', () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Queue: function Queue(this: any) {
      this.add = mockAdd;
      this.getJob = mockGetJob;
    },
    Worker: function Worker() {},
  };
});

// Mock redis-config so no real Redis connection is attempted
vi.mock('@/lib/redis-config', () => ({
  getRedisConfig: vi.fn().mockReturnValue({ host: 'localhost', port: 6379 }),
  getRedisUrl: vi.fn().mockReturnValue('redis://localhost:6379'),
}));

describe('embedding-queue', () => {
  beforeEach(() => {
    vi.resetModules();
    mockAdd.mockReset();
    mockGetJob.mockReset();
  });

  it('addEmbeddingJob() creates a job and returns its id', async () => {
    mockAdd.mockResolvedValue({ id: 'job-123', data: { documentId: 'doc-abc' } });

    const { addEmbeddingJob } = await import('@/lib/queue/embedding-queue');
    const jobId = await addEmbeddingJob('doc-abc');

    expect(jobId).toBe('job-123');
  });

  it('addEmbeddingJob() calls queue.add with embed name and documentId', async () => {
    mockAdd.mockResolvedValue({ id: 'job-456', data: { documentId: 'doc-xyz' } });

    const { addEmbeddingJob } = await import('@/lib/queue/embedding-queue');
    await addEmbeddingJob('doc-xyz');

    expect(mockAdd).toHaveBeenCalledWith(
      'embed',
      { documentId: 'doc-xyz' },
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('getJobStatus() returns job state and data', async () => {
    const mockJob = {
      id: 'job-123',
      progress: 0,
      data: { documentId: 'doc-abc' },
      getState: vi.fn().mockResolvedValue('waiting'),
    };
    mockGetJob.mockResolvedValue(mockJob);

    const { getJobStatus } = await import('@/lib/queue/embedding-queue');
    const status = await getJobStatus('job-123');

    expect(status).not.toBeNull();
    expect(status?.id).toBe('job-123');
    expect(status?.state).toBe('waiting');
    expect(status?.data).toEqual({ documentId: 'doc-abc' });
  });

  it('getJobStatus() returns null when job not found', async () => {
    mockGetJob.mockResolvedValue(null);

    const { getJobStatus } = await import('@/lib/queue/embedding-queue');
    const status = await getJobStatus('nonexistent-job');

    expect(status).toBeNull();
  });
});
