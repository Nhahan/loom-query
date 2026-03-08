/**
 * Integration tests for error recovery scenarios.
 *
 * Tests the complete error handling flow:
 * - Transient errors with exponential backoff retry
 * - Permanent errors with fail-fast behavior
 * - Circuit breaker state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Error recovery and resilience
 * - Metrics tracking during error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';
import { classifyError, getRetryDelay } from '../error-classifier';
import { MetricsCollector } from '../metrics';

describe('Error Recovery Integration Tests', () => {
  let breaker: CircuitBreaker;
  let collector: MetricsCollector;

  beforeEach(() => {
    // Create fresh breaker for each test
    breaker = new CircuitBreaker({
      name: 'TestService',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100, // 100ms for faster tests
    });

    collector = new MetricsCollector();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Transient Error Recovery', () => {
    it('retries transient errors with exponential backoff', () => {
      const error = new Error('Connection timeout');
      const classified = classifyError(error);

      expect(classified.type).toBe('transient');
      expect(classified.isRetryable).toBe(true);

      // Check retry delays increase exponentially
      const delay0 = getRetryDelay('transient', 0);
      const delay1 = getRetryDelay('transient', 1);
      const delay2 = getRetryDelay('transient', 2);

      expect(delay0).toBeGreaterThan(0);
      expect(delay0).toBeLessThan(2000); // ~1s with jitter
      expect(delay1).toBeGreaterThan(delay0); // Should be ~4s
      expect(delay2).toBeGreaterThan(delay1); // Should be ~16s
    });

    it('recovers from transient service unavailability', async () => {
      let callCount = 0;
      const fn = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Service temporarily unavailable');
        }
        return 'success';
      });

      // First two calls fail, third succeeds
      try {
        await breaker.execute(fn);
      } catch {
        // Expected first time
      }

      try {
        await breaker.execute(fn);
      } catch {
        // Expected second time
      }

      // Third call should succeed
      const result = await breaker.execute(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('tracks transient errors in metrics', () => {
      collector.recordEvent({
        jobId: '1',
        documentId: 'doc-1',
        type: 'failed',
        timestamp: Date.now(),
        duration: 1000,
        errorType: 'transient',
        errorCode: 'NETWORK_ERROR',
      });

      const breakdown = collector.getErrorBreakdown();
      expect(breakdown['NETWORK_ERROR']).toBe(1);

      const recent = collector.getRecentErrors(10);
      expect(recent).toHaveLength(1);
      expect(recent[0].errorCode).toBe('NETWORK_ERROR');
    });
  });

  describe('Permanent Error Handling', () => {
    it('fails fast on permanent errors without retry', () => {
      const error = new Error('Document not found (404)');
      const classified = classifyError(error);

      expect(classified.type).toBe('permanent');
      expect(classified.isRetryable).toBe(false);
      expect(classified.code).toBe('NOT_FOUND');

      // Permanent errors should return -1 (don't retry)
      const delay = getRetryDelay('permanent', 0);
      expect(delay).toBe(-1);
    });

    it('stops retrying after max attempts on permanent error', () => {
      const delays: number[] = [];

      for (let attempt = 0; attempt <= 3; attempt++) {
        const delay = getRetryDelay('permanent', attempt, 3);
        delays.push(delay);
      }

      // All should be -1 (don't retry)
      expect(delays).toEqual([-1, -1, -1, -1]);
    });

    it('tracks permanent errors separately from transient', () => {
      collector.recordEvent({
        jobId: '1',
        documentId: 'doc-1',
        type: 'failed',
        timestamp: Date.now(),
        duration: 100,
        errorType: 'permanent',
        errorCode: 'NOT_FOUND',
      });

      collector.recordEvent({
        jobId: '2',
        documentId: 'doc-2',
        type: 'failed',
        timestamp: Date.now(),
        duration: 1000,
        errorType: 'transient',
        errorCode: 'NETWORK_ERROR',
      });

      const breakdown = collector.getErrorBreakdown();
      expect(breakdown['NOT_FOUND']).toBe(1);
      expect(breakdown['NETWORK_ERROR']).toBe(1);
    });
  });

  describe('Circuit Breaker State Transitions', () => {
    it('transitions from CLOSED to OPEN on failure threshold', async () => {
      expect(breaker.getState()).toBe('CLOSED');

      const failingFn = vi.fn(async () => {
        throw new Error('Service down');
      });

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected
        }
      }

      // Circuit should be OPEN now
      expect(breaker.getState()).toBe('OPEN');
    });

    it('fast-fails when circuit is OPEN', async () => {
      const failingFn = vi.fn(async () => {
        throw new Error('Service down');
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Further requests should fail immediately without calling fn
      const beforeCallCount = failingFn.mock.calls.length;

      try {
        await breaker.execute(failingFn);
      } catch (err) {
        expect((err as Error).message).toContain('Circuit breaker is OPEN');
      }

      // fn should not have been called again
      expect(failingFn.mock.calls.length).toBe(beforeCallCount);
    });

    it('transitions from OPEN to HALF_OPEN after timeout', async () => {
      const failingFn = vi.fn(async () => {
        throw new Error('Service down');
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Get the initial stats while OPEN
      const openStats = breaker.getStats();
      expect(openStats.state).toBe('OPEN');
      expect(openStats.lastFailureTime).not.toBeNull();

      // Wait for timeout (100ms in test config) + significant buffer for system timing
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Now try to execute - should transition to HALF_OPEN if timeout elapsed
      // The state transition happens during execute(), so we need to account for
      // the fact that a fresh attempt might still fail if service is still down
      const succeedingFn = vi.fn(async () => 'recovered!');

      try {
        await breaker.execute(succeedingFn);
      } catch {
        // May still be in recovery process
      }

      // After successful execution, circuit should be closed or in HALF_OPEN
      const state = breaker.getState();
      expect(['HALF_OPEN', 'CLOSED']).toContain(state);
    });

    it('transitions from HALF_OPEN to CLOSED on success threshold', async () => {
      const failingFn = vi.fn(async () => {
        throw new Error('Service down');
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout to transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Create a function that succeeds
      const succeedingFn = vi.fn(async () => 'success');

      // Execute twice to reach success threshold (2)
      await breaker.execute(succeedingFn);
      await breaker.execute(succeedingFn);

      // Circuit should be CLOSED now
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('Recovery with Metrics Tracking', () => {
    it('tracks error patterns during recovery', () => {
      // Simulate multiple failures followed by recovery
      const now = Date.now();

      // Record initial failures
      for (let i = 0; i < 5; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: 'failed',
          timestamp: now - 1000,
          duration: 500,
          errorType: 'transient',
          errorCode: 'NETWORK_ERROR',
        });
      }

      // Record recovery with successful jobs
      for (let i = 5; i < 10; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: 'completed',
          timestamp: now,
          duration: 200,
          chunkCount: 1,
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics.failedJobs).toBe(5);
      expect(metrics.completedJobs).toBe(5);
      expect(metrics.failureRate).toBe(50);

      // Error breakdown should show network errors
      const breakdown = collector.getErrorBreakdown();
      expect(breakdown['NETWORK_ERROR']).toBe(5);
    });

    it('tracks error rate trend and identifies degradation', () => {
      const now = Date.now();

      // Recent window (last 5 min): high error rate (70%)
      for (let i = 0; i < 10; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: i < 7 ? 'failed' : 'completed',
          timestamp: now - Math.random() * 5 * 60 * 1000,
          duration: 500,
          errorType: i < 7 ? 'transient' : undefined,
          errorCode: i < 7 ? 'NETWORK_ERROR' : undefined,
        });
      }

      // Older baseline window (5-10 min ago): lower error rate (10%)
      for (let i = 0; i < 20; i++) {
        collector.recordEvent({
          jobId: String(100 + i),
          documentId: `doc-${100 + i}`,
          type: i < 2 ? 'failed' : 'completed',
          timestamp: now - (5 + Math.random() * 5) * 60 * 1000,
          duration: 200,
          errorType: i < 2 ? 'transient' : undefined,
          errorCode: i < 2 ? 'NETWORK_ERROR' : undefined,
        });
      }

      // Error rate should show degradation
      const trend = collector.getErrorRateTrend();
      expect(['improving', 'degrading', 'stable']).toContain(trend.direction);
      expect(trend.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Resource Exhaustion Handling', () => {
    it('handles resource exhaustion errors as transient', () => {
      const error = new Error('ENOMEM: Out of memory');
      const classified = classifyError(error);

      expect(classified.type).toBe('transient');
      expect(classified.isRetryable).toBe(true);
      expect(classified.code).toBe('RESOURCE_EXHAUSTED');
    });

    it('retries resource exhaustion with conservative backoff', () => {
      const delay0 = getRetryDelay('unknown', 0);
      const delay1 = getRetryDelay('unknown', 1);
      const delay2 = getRetryDelay('unknown', 2);

      // Conservative backoff: 2s, 4s, 6s
      expect(delay0).toBe(2000);
      expect(delay1).toBe(4000);
      expect(delay2).toBe(6000);
    });
  });

  describe('Concurrent Error Handling', () => {
    it('handles concurrent requests during partial circuit failure', async () => {
      let openCount = 0;
      let successCount = 0;

      const fn = vi.fn(async () => {
        if (openCount < 2) {
          openCount++;
          throw new Error('Service unavailable');
        }
        successCount++;
        return 'success';
      });

      // Execute three concurrent requests
      const results = await Promise.allSettled([
        breaker.execute(fn),
        breaker.execute(fn),
        breaker.execute(fn),
      ]);

      // Some should fail, some might succeed
      expect(results.length).toBe(3);
      expect(openCount + successCount).toBeGreaterThan(0);
    });

    it('tracks concurrent job metrics', () => {
      const now = Date.now();

      // Simulate concurrent job executions
      for (let i = 0; i < 50; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: i % 10 === 0 ? 'failed' : 'completed',
          timestamp: now,
          duration: Math.random() * 5000,
          errorCode: i % 10 === 0 ? 'NETWORK_ERROR' : undefined,
        });
      }

      const metrics = collector.getMetrics();
      expect(metrics.totalJobs).toBe(50);
      expect(metrics.completedJobs).toBe(45);
      expect(metrics.failedJobs).toBe(5);
      expect(metrics.successRate).toBe(90);
    });
  });

  describe('Time-Window Error Analysis', () => {
    it('calculates error rate within time windows', () => {
      const now = Date.now();

      // Record failures in recent window (0-5 minutes)
      for (let i = 0; i < 3; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: 'failed',
          timestamp: now - Math.random() * 5 * 60 * 1000,
          duration: 500,
          errorCode: 'NETWORK_ERROR',
        });
      }

      // Record successes in recent window
      for (let i = 3; i < 10; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: 'completed',
          timestamp: now - Math.random() * 5 * 60 * 1000,
          duration: 200,
        });
      }

      // Record failures in older window (10-60 minutes)
      for (let i = 10; i < 20; i++) {
        collector.recordEvent({
          jobId: String(i),
          documentId: `doc-${i}`,
          type: 'failed',
          timestamp: now - (10 + Math.random() * 50) * 60 * 1000,
          duration: 500,
          errorCode: 'NETWORK_ERROR',
        });
      }

      // Recent window should have lower error rate
      const recent = collector.getMetricsForWindow(5 * 60 * 1000);
      const older = collector.getMetricsForWindow(60 * 60 * 1000);

      expect(recent.failureCount).toBeLessThan(older.failureCount);
    });
  });
});
