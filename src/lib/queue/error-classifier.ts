/**
 * Error classification system for embedding pipeline.
 * Distinguishes between transient errors (retry worthy) and permanent errors (fail fast).
 */

/**
 * Error type classification for retry decisions.
 * - `transient`: Temporary failures that may recover (network, timeout, rate limit)
 * - `permanent`: Failures that won't recover without intervention (auth, not found, invalid data)
 * - `unknown`: Unclassified errors (defaults to retry for safety)
 */
export type ErrorType = 'transient' | 'permanent' | 'unknown';

/**
 * Classified error with type information for retry decision making.
 * @property type - The error classification (transient, permanent, or unknown)
 * @property message - The original error message
 * @property isRetryable - Whether the error should be retried
 * @property code - Optional error code for observability (e.g., NETWORK_ERROR, NOT_FOUND)
 */
export interface ClassifiedError {
  type: ErrorType;
  message: string;
  isRetryable: boolean;
  code?: string;
}

/**
 * Classify an error to determine if it should be retried.
 * Transient errors (network, timeouts, rate limits) -> retry
 * Permanent errors (not found, invalid data, auth) -> fail fast
 */
export function classifyError(error: unknown): ClassifiedError {
  if (!(error instanceof Error)) {
    return {
      type: 'unknown',
      message: String(error),
      isRetryable: true, // Unknown errors default to retry (safer)
    };
  }

  const message = error.message.toLowerCase();

  // Transient errors - retry worthy
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('connect econnrefused') ||
    message.includes('socket hang up') ||
    message.includes('connection refused') ||
    message.includes('temporarily unavailable')
  ) {
    return {
      type: 'transient',
      message: error.message,
      isRetryable: true,
      code: 'SERVICE_UNAVAILABLE',
    };
  }

  // Rate limiting - transient, retry with backoff
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return {
      type: 'transient',
      message: error.message,
      isRetryable: true,
      code: 'RATE_LIMITED',
    };
  }

  // Network/IO errors - transient
  if (
    message.includes('eio') ||
    message.includes('network') ||
    message.includes('broken pipe') ||
    message.includes('reset by peer')
  ) {
    return {
      type: 'transient',
      message: error.message,
      isRetryable: true,
      code: 'NETWORK_ERROR',
    };
  }

  // Memory/resource errors - transient (may recover)
  if (
    message.includes('enomem') ||
    message.includes('out of memory') ||
    message.includes('memory pressure')
  ) {
    return {
      type: 'transient',
      message: error.message,
      isRetryable: true,
      code: 'RESOURCE_EXHAUSTED',
    };
  }

  // Permanent errors - don't retry
  if (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('no such file') ||
    message.includes('enoent')
  ) {
    return {
      type: 'permanent',
      message: error.message,
      isRetryable: false,
      code: 'NOT_FOUND',
    };
  }

  // Auth/permission errors - permanent
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('403') ||
    message.includes('permission denied') ||
    message.includes('eacces')
  ) {
    return {
      type: 'permanent',
      message: error.message,
      isRetryable: false,
      code: 'AUTH_ERROR',
    };
  }

  // Validation/invalid data errors - permanent
  if (
    message.includes('invalid') ||
    message.includes('malformed') ||
    message.includes('parse error') ||
    message.includes('syntax error')
  ) {
    return {
      type: 'permanent',
      message: error.message,
      isRetryable: false,
      code: 'INVALID_DATA',
    };
  }

  // Default: unknown - retry (safer to retry unknown errors)
  return {
    type: 'unknown',
    message: error.message,
    isRetryable: true,
  };
}

/**
 * Determine retry strategy based on error type and attempt count.
 * Returns the delay in milliseconds before retrying, or -1 to skip retry.
 *
 * @param errorType - The classified error type (transient, permanent, or unknown)
 * @param attemptsMade - Number of failed attempts so far (0-indexed)
 * @param maxAttempts - Maximum number of retry attempts (default: 3)
 * @returns Delay in milliseconds before next retry, or -1 to skip retry
 *
 * @example
 * // Transient error: exponential backoff
 * getRetryDelay('transient', 0) // ~1000ms
 * getRetryDelay('transient', 1) // ~4000ms
 * getRetryDelay('transient', 2) // ~16000ms
 * getRetryDelay('transient', 3) // -1 (max attempts exceeded)
 *
 * @example
 * // Permanent error: fail fast
 * getRetryDelay('permanent', 0) // -1 (don't retry)
 *
 * @example
 * // Unknown error: conservative backoff
 * getRetryDelay('unknown', 0) // 2000ms
 * getRetryDelay('unknown', 1) // 4000ms
 * getRetryDelay('unknown', 2) // 6000ms
 */
export function getRetryDelay(
  errorType: ErrorType,
  attemptsMade: number,
  maxAttempts: number = 3,
): number {
  // Don't retry if max attempts exceeded
  if (attemptsMade >= maxAttempts) {
    return -1;
  }

  switch (errorType) {
    case 'transient': {
      // Exponential backoff: 1s, 4s, 16s (with jitter)
      const baseDelay = Math.pow(4, attemptsMade) * 1000;
      const jitter = Math.random() * 0.1 * baseDelay; // ±10% jitter
      return baseDelay + jitter;
    }

    case 'permanent':
      // Don't retry permanent errors
      return -1;

    case 'unknown':
    default:
      // Conservative backoff for unknown errors
      const unknownDelay = (attemptsMade + 1) * 2000; // 2s, 4s, 6s
      return unknownDelay;
  }
}
