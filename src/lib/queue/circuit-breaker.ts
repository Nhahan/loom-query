import { logger } from '@/lib/logger';

/**
 * Circuit breaker pattern for external service failures (Ollama, ChromaDB).
 * Prevents cascading failures by rejecting requests when service is down.
 *
 * States:
 * - CLOSED: Service working normally, requests proceed
 * - OPEN: Service down, requests fail fast (circuit open)
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

/**
 * Circuit state transitions.
 * - `CLOSED`: Service working normally, requests proceed
 * - `OPEN`: Service down, requests fail fast (circuit open)
 * - `HALF_OPEN`: Testing recovery, limited requests allowed
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Configuration for circuit breaker behavior.
 * Controls when to open the circuit and how to recover.
 *
 * @property failureThreshold - Number of failures before opening circuit (default: 5)
 *   Set lower for faster failure detection, higher for tolerance of flaky services.
 * @property successThreshold - Number of successes in HALF_OPEN state before closing (default: 2)
 *   Higher values require more confidence that service has recovered.
 * @property timeout - Milliseconds to wait before attempting recovery (default: 60000ms = 1 minute)
 *   After this duration, circuit transitions from OPEN to HALF_OPEN.
 * @property name - Display name for logging and debugging (e.g., "Ollama", "ChromaDB")
 *
 * @example
 * const config: CircuitBreakerConfig = {
 *   name: 'Ollama',
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * };
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening circuit (default: 5)
  successThreshold: number; // Successes in HALF_OPEN before closing (default: 2)
  timeout: number; // Time in ms before trying to recover (default: 60000ms = 1min)
  name: string; // For logging
}

/**
 * Circuit breaker pattern implementation for external service failures.
 *
 * Prevents cascading failures by:
 * 1. Detecting rapid service failures and "opening" the circuit
 * 2. Fast-failing requests while service is down (OPEN state)
 * 3. Periodically testing recovery (HALF_OPEN state)
 * 4. Automatically closing when service recovers
 *
 * @example
 * const breaker = new CircuitBreaker({
 *   name: 'Ollama',
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 *
 * try {
 *   const result = await breaker.execute(() => ollama.embed(text));
 * } catch (err) {
 *   console.error('Circuit breaker is open, service unavailable');
 * }
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  // Performance optimizations
  private nextResetAttemptTime: number | null = null; // Pre-computed window for HALF_OPEN transition

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection.
   *
   * State machine behavior:
   * - **CLOSED**: Requests proceed normally. On failure, increment counter. When threshold reached, transition to OPEN.
   * - **OPEN**: Fast-fail all requests with error. After timeout, transition to HALF_OPEN for recovery test.
   * - **HALF_OPEN**: Allow limited requests. On success, accumulate successes. After successThreshold successes, transition to CLOSED.
   *
   * @template T - Return type of the function
   * @param fn - Async function to execute with protection
   * @returns Result of the function if successful
   * @throws Error if circuit is OPEN or function throws
   *
   * @example
   * // Successful execution in CLOSED state
   * const result = await breaker.execute(() => fetch(url));
   *
   * @example
   * // Fast-fail in OPEN state
   * try {
   *   await breaker.execute(() => fetch(url));
   * } catch (err) {
   *   // Circuit is OPEN, service unavailable
   * }
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if should transition from OPEN to HALF_OPEN
    // Performance: Use pre-computed nextResetAttemptTime to avoid repeated calculations
    if (this.state === 'OPEN') {
      const now = Date.now();
      // Fast-fail if reset window hasn't been reached yet
      if (this.nextResetAttemptTime !== null && now < this.nextResetAttemptTime) {
        throw new Error(
          `[${this.config.name}] Circuit breaker is OPEN. Service unavailable.`
        );
      }

      // Timeout has elapsed, transition to HALF_OPEN
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      this.nextResetAttemptTime = null;
      logger.info(`[CircuitBreaker:${this.config.name}] Entering HALF_OPEN state`);
    }

    try {
      const result = await fn();

      // Success
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.reset();
        }
      } else if (this.state === 'CLOSED') {
        // Reset failure count on success
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure and potentially open the circuit.
   * Performance: Pre-computes nextResetAttemptTime when opening circuit.
   * Private method called internally by execute().
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn(`[CircuitBreaker:${this.config.name}] Failure recorded (${this.failureCount}/${this.config.failureThreshold})`);

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      // Pre-compute when we should attempt recovery (performance optimization)
      this.nextResetAttemptTime = Date.now() + this.config.timeout;
      logger.error(
        `[CircuitBreaker:${this.config.name}] Circuit OPEN after ${this.failureCount} failures`
      );
    }
  }

  /**
   * Reset the circuit to CLOSED after successful recovery.
   * Performance: Clears pre-computed reset window.
   * Private method called internally when recovery is confirmed.
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextResetAttemptTime = null; // Clear pre-computed window
    logger.info(`[CircuitBreaker:${this.config.name}] Circuit CLOSED, service recovered`);
  }

  /**
   * Get the current circuit state.
   *
   * @returns Current state: CLOSED, OPEN, or HALF_OPEN
   *
   * @example
   * const state = breaker.getState();
   * if (state === 'OPEN') {
   *   console.log('Service unavailable, circuit is open');
   * }
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get detailed statistics about the circuit breaker.
   * Useful for monitoring and debugging.
   *
   * @returns Object with current state, failure count, success count, and last failure timestamp
   *
   * @example
   * const stats = breaker.getStats();
   * console.log(`Circuit state: ${stats.state}, failures: ${stats.failureCount}`);
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Singleton circuit breakers for external services.
 * Lazily initialized on first call.
 */
let ollamaCircuitBreaker: CircuitBreaker | null = null;
let chromaCircuitBreaker: CircuitBreaker | null = null;

/**
 * Get or create the Ollama circuit breaker singleton.
 *
 * Configuration:
 * - Threshold: 5 failures before opening
 * - Recovery: 60 seconds timeout before attempting recovery
 * - Success threshold: 2 consecutive successes to close
 *
 * @returns Singleton CircuitBreaker for Ollama service
 *
 * @example
 * const breaker = getOllamaCircuitBreaker();
 * const embedding = await breaker.execute(() => ollama.embed(text));
 */
export function getOllamaCircuitBreaker(): CircuitBreaker {
  if (!ollamaCircuitBreaker) {
    ollamaCircuitBreaker = new CircuitBreaker({
      name: 'Ollama',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
    });
  }
  return ollamaCircuitBreaker;
}

/**
 * Get or create the ChromaDB circuit breaker singleton.
 *
 * Configuration:
 * - Threshold: 5 failures before opening
 * - Recovery: 60 seconds timeout before attempting recovery
 * - Success threshold: 2 consecutive successes to close
 *
 * @returns Singleton CircuitBreaker for ChromaDB service
 *
 * @example
 * const breaker = getChromaCircuitBreaker();
 * const collection = await breaker.execute(() => chroma.getOrCreateCollection(name));
 */
export function getChromaCircuitBreaker(): CircuitBreaker {
  if (!chromaCircuitBreaker) {
    chromaCircuitBreaker = new CircuitBreaker({
      name: 'ChromaDB',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
    });
  }
  return chromaCircuitBreaker;
}

/**
 * Reset all circuit breakers to initial state.
 * Clears singleton references, forcing re-initialization on next call.
 * Useful for testing or manual recovery in development.
 *
 * @example
 * // In test teardown
 * afterEach(() => {
 *   resetCircuitBreakers();
 * });
 */
export function resetCircuitBreakers(): void {
  ollamaCircuitBreaker = null;
  chromaCircuitBreaker = null;
}
