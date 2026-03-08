import { describe, it, expect } from 'vitest';
import { classifyError, getRetryDelay } from '../error-classifier';

describe('error-classifier', () => {
  describe('classifyError', () => {
    it('classifies timeout errors as transient', () => {
      const error = new Error('Connection timeout');
      const classified = classifyError(error);
      expect(classified.type).toBe('transient');
      expect(classified.isRetryable).toBe(true);
    });

    it('classifies not-found errors as permanent', () => {
      const error = new Error('Document not found');
      const classified = classifyError(error);
      expect(classified.type).toBe('permanent');
      expect(classified.isRetryable).toBe(false);
    });

    it('classifies rate-limit errors as transient', () => {
      const error = new Error('Too many requests (429)');
      const classified = classifyError(error);
      expect(classified.type).toBe('transient');
      expect(classified.isRetryable).toBe(true);
      expect(classified.code).toBe('RATE_LIMITED');
    });

    it('classifies network errors as transient', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const classified = classifyError(error);
      expect(classified.type).toBe('transient');
      expect(classified.isRetryable).toBe(true);
      expect(classified.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('classifies auth errors as permanent', () => {
      const error = new Error('Unauthorized (403)');
      const classified = classifyError(error);
      expect(classified.type).toBe('permanent');
      expect(classified.isRetryable).toBe(false);
      expect(classified.code).toBe('AUTH_ERROR');
    });

    it('handles non-Error objects gracefully', () => {
      const classified = classifyError('just a string');
      expect(classified.type).toBe('unknown');
      expect(classified.isRetryable).toBe(true);
    });
  });

  describe('getRetryDelay', () => {
    it('returns exponential backoff for transient errors', () => {
      const delay0 = getRetryDelay('transient', 0);
      const delay1 = getRetryDelay('transient', 1);
      const delay2 = getRetryDelay('transient', 2);

      // Should increase: ~1s, ~4s, ~16s (with jitter)
      expect(delay0).toBeGreaterThan(800);
      expect(delay0).toBeLessThan(1200);
      expect(delay1).toBeGreaterThan(3600);
      expect(delay1).toBeLessThan(4400);
      expect(delay2).toBeGreaterThan(14400);
      expect(delay2).toBeLessThan(17600);
    });

    it('returns -1 for permanent errors (no retry)', () => {
      expect(getRetryDelay('permanent', 0)).toBe(-1);
      expect(getRetryDelay('permanent', 1)).toBe(-1);
      expect(getRetryDelay('permanent', 2)).toBe(-1);
    });

    it('returns -1 when max attempts exceeded', () => {
      expect(getRetryDelay('transient', 3)).toBe(-1);
    });

    it('returns increasing delays for unknown errors', () => {
      const delay0 = getRetryDelay('unknown', 0);
      const delay1 = getRetryDelay('unknown', 1);
      const delay2 = getRetryDelay('unknown', 2);

      expect(delay0).toBe(2000); // (0+1) * 2000
      expect(delay1).toBe(4000); // (1+1) * 2000
      expect(delay2).toBe(6000); // (2+1) * 2000
    });
  });
});
