import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, resetCircuitBreakers } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    resetCircuitBreakers();
  });

  it('executes function normally when CLOSED', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });

    const fn = vi.fn().mockResolvedValue('success');
    const result = await cb.execute(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('transitions to OPEN after failure threshold', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      successThreshold: 2,
      timeout: 1000,
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // First failure
    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // Second failure - should open
    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');
  });

  it('rejects fast when OPEN', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 60000,
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trigger OPEN state
    await expect(cb.execute(fn)).rejects.toThrow();

    // Should immediately reject without calling fn
    const callCountBefore = fn.mock.calls.length;
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn.mock.calls.length).toBe(callCountBefore); // No new call
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      successThreshold: 2, // Need 2 successes to close
      timeout: 100, // Short timeout for testing
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trigger OPEN state
    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should try again and enter HALF_OPEN
    const successFn = vi.fn().mockResolvedValue('ok');
    const result = await cb.execute(successFn);

    expect(result).toBe('ok');
    expect(cb.getState()).toBe('HALF_OPEN');
    expect(successFn).toHaveBeenCalledTimes(1);
  });

  it('transitions from HALF_OPEN to CLOSED on success threshold', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 100,
    });

    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trigger OPEN state
    await expect(cb.execute(fn)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Wait and trigger HALF_OPEN
    await new Promise((resolve) => setTimeout(resolve, 150));

    const successFn = vi.fn().mockResolvedValue('ok');

    // First success - still HALF_OPEN
    await cb.execute(successFn);
    expect(cb.getState()).toBe('HALF_OPEN');

    // Second success - should close
    await cb.execute(successFn);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('resets to CLOSED on success when CLOSED', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 1000,
    });

    const failFn = vi.fn().mockRejectedValue(new Error('fail'));

    // One failure
    await expect(cb.execute(failFn)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // Success should reset failure count
    const successFn = vi.fn().mockResolvedValue('ok');
    await cb.execute(successFn);

    const stats = cb.getStats();
    expect(stats.failureCount).toBe(0);
  });

  it('returns stats correctly', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });

    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
  });
});
