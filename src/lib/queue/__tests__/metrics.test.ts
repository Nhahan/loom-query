import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsCollector,
  getMetricsCollector,
  resetMetrics,
  type JobEvent,
  formatMetrics,
} from '../metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('records events and calculates basic metrics', () => {
    const collector = new MetricsCollector();

    const startEvent: JobEvent = {
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'started',
      timestamp: Date.now(),
    };

    const completeEvent: JobEvent = {
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'completed',
      timestamp: Date.now() + 1000,
      duration: 1000,
      chunkCount: 5,
    };

    collector.recordEvent(startEvent);
    collector.recordEvent(completeEvent);

    const metrics = collector.getMetrics();
    expect(metrics.totalJobs).toBe(2);
    expect(metrics.completedJobs).toBe(1);
    expect(metrics.failedJobs).toBe(0);
    expect(metrics.successRate).toBe(100);
  });

  it('calculates success and failure rates', () => {
    const collector = new MetricsCollector();

    // 7 completed, 3 failed
    for (let i = 0; i < 7; i++) {
      collector.recordEvent({
        jobId: `job-${i}`,
        documentId: `doc-${i}`,
        type: 'completed',
        timestamp: Date.now(),
        duration: 1000,
      });
    }

    for (let i = 0; i < 3; i++) {
      collector.recordEvent({
        jobId: `job-failed-${i}`,
        documentId: `doc-failed-${i}`,
        type: 'failed',
        timestamp: Date.now(),
        duration: 500,
        errorCode: 'NETWORK_ERROR',
      });
    }

    const metrics = collector.getMetrics();
    expect(metrics.totalJobs).toBe(10);
    expect(metrics.completedJobs).toBe(7);
    expect(metrics.failedJobs).toBe(3);
    expect(metrics.successRate).toBe(70);
    expect(metrics.failureRate).toBe(30);
  });

  it('calculates duration percentiles', () => {
    const collector = new MetricsCollector();

    // Create events with durations: 100, 200, 300, 400, 500
    const durations = [100, 200, 300, 400, 500];
    durations.forEach((duration, i) => {
      collector.recordEvent({
        jobId: `job-${i}`,
        documentId: `doc-${i}`,
        type: 'completed',
        timestamp: Date.now(),
        duration,
      });
    });

    const metrics = collector.getMetrics();
    expect(metrics.minDuration).toBe(100);
    expect(metrics.maxDuration).toBe(500);
    expect(metrics.avgDuration).toBe(300); // (100+200+300+400+500)/5
    expect(metrics.p50Duration).toBe(300); // median
    expect(metrics.p95Duration).toBeGreaterThanOrEqual(400);
    expect(metrics.p99Duration).toBe(500);
  });

  it('tracks retry count', () => {
    const collector = new MetricsCollector();

    collector.recordEvent({
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'started',
      timestamp: Date.now(),
    });

    collector.recordEvent({
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'retried',
      timestamp: Date.now(),
    });

    collector.recordEvent({
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'retried',
      timestamp: Date.now(),
    });

    const metrics = collector.getMetrics();
    expect(metrics.retryCount).toBe(2);
  });

  it('provides error breakdown', () => {
    const collector = new MetricsCollector();

    collector.recordEvent({
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'failed',
      timestamp: Date.now(),
      errorCode: 'NETWORK_ERROR',
    });

    collector.recordEvent({
      jobId: 'job-2',
      documentId: 'doc-2',
      type: 'failed',
      timestamp: Date.now(),
      errorCode: 'NETWORK_ERROR',
    });

    collector.recordEvent({
      jobId: 'job-3',
      documentId: 'doc-3',
      type: 'failed',
      timestamp: Date.now(),
      errorCode: 'NOT_FOUND',
    });

    const breakdown = collector.getErrorBreakdown();
    expect(breakdown['NETWORK_ERROR']).toBe(2);
    expect(breakdown['NOT_FOUND']).toBe(1);
  });

  it('returns recent errors', () => {
    const collector = new MetricsCollector();

    for (let i = 0; i < 5; i++) {
      collector.recordEvent({
        jobId: `job-${i}`,
        documentId: `doc-${i}`,
        type: 'failed',
        timestamp: Date.now() + i * 100,
        errorCode: 'ERROR_' + i,
      });
    }

    const recent = collector.getRecentErrors(3);
    expect(recent).toHaveLength(3);
    // Most recent first
    expect(recent[0].errorCode).toBe('ERROR_4');
    expect(recent[1].errorCode).toBe('ERROR_3');
    expect(recent[2].errorCode).toBe('ERROR_2');
  });

  it('uses singleton pattern', () => {
    const collector1 = getMetricsCollector();
    const collector2 = getMetricsCollector();

    expect(collector1).toBe(collector2);
  });

  it('formats metrics for display', () => {
    const collector = new MetricsCollector();

    collector.recordEvent({
      jobId: 'job-1',
      documentId: 'doc-1',
      type: 'completed',
      timestamp: Date.now(),
      duration: 1000,
    });

    const metrics = collector.getMetrics();
    const formatted = formatMetrics(metrics);

    expect(formatted).toContain('Queue Metrics');
    expect(formatted).toContain('Total Jobs');
    expect(formatted).toContain('Performance');
    expect(formatted).toContain('P95');
    expect(formatted).toContain('P99');
  });

  it('clears old events (max 1000)', () => {
    const collector = new MetricsCollector();

    // Add more than 1000 events
    for (let i = 0; i < 1500; i++) {
      collector.recordEvent({
        jobId: `job-${i}`,
        documentId: `doc-${i}`,
        type: 'completed',
        timestamp: Date.now(),
        duration: 100 + i,
      });
    }

    const metrics = collector.getMetrics();
    // Should only keep last 1000
    expect(metrics.totalJobs).toBeLessThanOrEqual(1000);
  });
});
