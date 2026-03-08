/**
 * Job processing metrics and monitoring for the embedding pipeline.
 * Tracks performance, reliability, and health of the queue system.
 *
 * Provides real-time visibility into:
 * - Job completion and failure rates
 * - Latency percentiles (p50, p95, p99) for SLA tracking
 * - Error breakdown by error code
 * - Queue depth and processing capacity
 *
 * @see MetricsCollector for the implementation
 * @see /api/queue/health endpoint for HTTP API
 */

/**
 * Aggregated metrics for job processing pipeline.
 *
 * @property totalJobs - Lifetime job count
 * @property completedJobs - Successfully processed jobs
 * @property failedJobs - Jobs that failed after all retries
 * @property retryCount - Total retry attempts across all jobs
 * @property avgDuration - Average processing time in milliseconds
 * @property minDuration - Minimum processing time observed
 * @property maxDuration - Maximum processing time observed
 * @property p50Duration - 50th percentile (median) latency in ms
 * @property p95Duration - 95th percentile latency in ms (SLA tracking)
 * @property p99Duration - 99th percentile latency in ms (tail latency)
 * @property successRate - Percentage of successful jobs (0-100)
 * @property failureRate - Percentage of failed jobs (0-100)
 * @property queueDepth - Pending jobs awaiting processing
 * @property activeJobs - Currently processing jobs
 */
export interface JobMetrics {
  // Counts
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  retryCount: number;

  // Timing (milliseconds)
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;

  // Rates
  successRate: number; // 0-100
  failureRate: number; // 0-100

  // Current state
  queueDepth: number; // Pending jobs
  activeJobs: number; // Currently processing
}

/**
 * Individual job processing event for metrics collection.
 * Used to track job lifecycle events and measure performance.
 *
 * @property jobId - BullMQ job ID
 * @property documentId - Document being processed
 * @property type - Event type (started, completed, failed, or retried)
 * @property timestamp - Event timestamp (milliseconds since epoch)
 * @property duration - Processing time in milliseconds (only for completed/failed)
 * @property errorType - Classification of failure (only for failed): transient, permanent, unknown
 * @property errorCode - Error code for observability (only for failed): NETWORK_ERROR, NOT_FOUND, etc.
 * @property chunkCount - Number of chunks created (only for completed)
 * @property attempt - Retry attempt number for retried events
 *
 * @example
 * // Job completion event
 * { jobId: "123", documentId: "doc-456", type: "completed", timestamp: 1709964000000, duration: 2500, chunkCount: 5 }
 *
 * @example
 * // Job failure event with error context
 * { jobId: "123", documentId: "doc-456", type: "failed", timestamp: 1709964005000, duration: 5000, errorType: "transient", errorCode: "NETWORK_ERROR" }
 */
export interface JobEvent {
  jobId: string;
  documentId: string;
  type: 'started' | 'completed' | 'failed' | 'retried';
  timestamp: number; // ISO string or timestamp
  duration?: number; // Only for completed/failed
  errorType?: string; // Only for failed
  errorCode?: string; // Only for failed
  chunkCount?: number; // Only for completed
  attempt?: number;
}

/**
 * Metrics aggregated within a specific time window.
 * Enables trend analysis and window-based SLA tracking.
 *
 * @property windowStart - Start timestamp of the window (ms since epoch)
 * @property windowEnd - End timestamp of the window (ms since epoch)
 * @property windowDuration - Length of the window in milliseconds
 * @property jobCount - Jobs processed in this window
 * @property successCount - Successful jobs in window
 * @property failureCount - Failed jobs in window
 * @property successRate - Percentage of successful jobs (0-100)
 * @property avgLatency - Average processing time in window
 * @property p95Latency - 95th percentile latency in window
 * @property errorBreakdown - Error code distribution in window
 *
 * @example
 * // Get metrics for last hour
 * const hourWindow = collector.getMetricsForWindow(3600000);
 * console.log(`Success rate (last hour): ${hourWindow.successRate}%`);
 */
export interface TimeWindowMetrics {
  windowStart: number;
  windowEnd: number;
  windowDuration: number;
  jobCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  errorBreakdown: Record<string, number>;
}

/**
 * Performance trend analysis showing degradation or improvement.
 * Used to identify patterns and anomalies.
 *
 * @property direction - Trend direction: 'improving', 'degrading', or 'stable'
 * @property changePercent - Percentage change from baseline (positive = improvement)
 * @property metric - Which metric is trending (errorRate, latency, etc.)
 * @property confidence - Confidence level 0-100 (higher = more data points)
 *
 * @example
 * // Check if latency is improving or degrading
 * const trend = collector.getLatencyTrend();
 * if (trend.direction === 'degrading') {
 *   console.warn('Latency degrading: ' + trend.changePercent + '%');
 * }
 */
export interface PerformanceTrend {
  direction: 'improving' | 'degrading' | 'stable';
  changePercent: number;
  metric: string;
  confidence: number;
}

/**
 * Collects and aggregates job processing metrics in memory.
 *
 * Maintains a ring buffer of recent events and durations to calculate:
 * - Job counts and success/failure rates
 * - Latency percentiles (p50, p95, p99)
 * - Error breakdown by error code
 * - Recent failures for troubleshooting
 *
 * Memory usage is bounded to ~100KB (1000 events + 1000 durations).
 *
 * @example
 * const collector = getMetricsCollector();
 * collector.recordEvent({ jobId: "123", documentId: "doc", type: "completed", duration: 2500 });
 * const metrics = collector.getMetrics();
 * console.log(`p95 latency: ${metrics.p95Duration}ms`);
 */
export class MetricsCollector {
  private events: JobEvent[] = [];
  private durations: number[] = [];

  /**
   * Record a job processing event.
   * Maintains ring buffers of recent events for bounded memory usage.
   *
   * @param event - The job event to record
   *
   * @example
   * collector.recordEvent({
   *   jobId: job.id,
   *   documentId: job.data.documentId,
   *   type: 'completed',
   *   timestamp: Date.now(),
   *   duration: 2500
   * });
   */
  recordEvent(event: JobEvent): void {
    this.events.push(event);

    // Keep only last 1000 events for efficiency
    if (this.events.length > 1000) {
      this.events.shift();
    }

    // Track durations for percentile calculations
    if (event.duration) {
      this.durations.push(event.duration);
      if (this.durations.length > 1000) {
        this.durations.shift();
      }
    }
  }

  /**
   * Get aggregated metrics snapshot.
   *
   * Calculates percentiles by sorting durations, which is O(n log n).
   * For best results, collect at least 100 events before using percentiles.
   *
   * @returns Current JobMetrics snapshot
   *
   * @example
   * const metrics = collector.getMetrics();
   * if (metrics.p95Duration > 5000) {
   *   console.warn(`High latency detected: p95=${metrics.p95Duration}ms`);
   * }
   */
  getMetrics(): JobMetrics {
    const completed = this.events.filter((e) => e.type === 'completed').length;
    const failed = this.events.filter((e) => e.type === 'failed').length;
    const total = completed + failed;

    const sortedDurations = [...this.durations].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      if (sortedDurations.length === 0) return 0;
      const index = Math.ceil((p / 100) * sortedDurations.length) - 1;
      return sortedDurations[Math.max(0, Math.min(index, sortedDurations.length - 1))];
    };

    return {
      totalJobs: this.events.length,
      completedJobs: completed,
      failedJobs: failed,
      retryCount: this.events.filter((e) => e.type === 'retried').length,
      avgDuration: sortedDurations.length ? Math.round(sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length) : 0,
      minDuration: sortedDurations[0] || 0,
      maxDuration: sortedDurations[sortedDurations.length - 1] || 0,
      p50Duration: getPercentile(50),
      p95Duration: getPercentile(95),
      p99Duration: getPercentile(99),
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      queueDepth: this.events.filter((e) => e.type === 'started').length - completed - failed,
      activeJobs: 0, // Requires real-time queue state
    };
  }

  /**
   * Get breakdown of failures by error code.
   * Used to identify patterns in failure modes.
   *
   * @returns Map of error code to count (e.g., { NETWORK_ERROR: 5, NOT_FOUND: 2 })
   *
   * @example
   * const breakdown = collector.getErrorBreakdown();
   * const networkErrors = breakdown['NETWORK_ERROR'] || 0;
   * if (networkErrors > 10) {
   *   console.error('High network error rate detected');
   * }
   */
  getErrorBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.events
      .filter((e) => e.type === 'failed')
      .forEach((event) => {
        const key = event.errorCode || 'UNKNOWN';
        breakdown[key] = (breakdown[key] || 0) + 1;
      });
    return breakdown;
  }

  /**
   * Get recent failure events in reverse chronological order.
   * Useful for troubleshooting and dashboards.
   *
   * @param limit - Maximum number of recent errors to return (default: 10)
   * @returns Array of failed JobEvent objects, newest first
   *
   * @example
   * const recentErrors = collector.getRecentErrors(5);
   * recentErrors.forEach(err => {
   *   console.log(`Job ${err.jobId} failed: ${err.errorCode}`);
   * });
   */
  getRecentErrors(limit: number = 10): JobEvent[] {
    return this.events
      .filter((e) => e.type === 'failed')
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear all recorded metrics.
   * Used for testing or manual reset.
   *
   * @example
   * collector.clear(); // Start fresh metrics collection
   */
  clear(): void {
    this.events = [];
    this.durations = [];
  }

  /**
   * Get metrics aggregated within a specific time window.
   * Useful for window-based SLA tracking and trend analysis.
   *
   * @param windowMs - Time window in milliseconds (e.g., 300000 for 5 minutes, 3600000 for 1 hour)
   * @returns TimeWindowMetrics with aggregated data for the window
   *
   * @example
   * // Get metrics for last 5 minutes
   * const metrics5m = collector.getMetricsForWindow(5 * 60 * 1000);
   * console.log(`p95 latency (5m): ${metrics5m.p95Latency}ms`);
   *
   * // Get metrics for last hour
   * const metrics1h = collector.getMetricsForWindow(60 * 60 * 1000);
   * console.log(`Success rate (1h): ${metrics1h.successRate}%`);
   */
  getMetricsForWindow(windowMs: number): TimeWindowMetrics {
    const now = Date.now();
    const windowStart = now - windowMs;

    const windowEvents = this.events.filter((e) => e.timestamp >= windowStart);
    const completed = windowEvents.filter((e) => e.type === 'completed').length;
    const failed = windowEvents.filter((e) => e.type === 'failed').length;
    const total = completed + failed;

    const windowDurations = windowEvents
      .filter((e) => e.duration !== undefined)
      .map((e) => e.duration as number);

    const sortedDurations = [...windowDurations].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      if (sortedDurations.length === 0) return 0;
      const index = Math.ceil((p / 100) * sortedDurations.length) - 1;
      return sortedDurations[Math.max(0, Math.min(index, sortedDurations.length - 1))];
    };

    const errorBreakdown: Record<string, number> = {};
    windowEvents
      .filter((e) => e.type === 'failed')
      .forEach((event) => {
        const key = event.errorCode || 'UNKNOWN';
        errorBreakdown[key] = (errorBreakdown[key] || 0) + 1;
      });

    return {
      windowStart,
      windowEnd: now,
      windowDuration: windowMs,
      jobCount: windowEvents.length,
      successCount: completed,
      failureCount: failed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgLatency: sortedDurations.length ? Math.round(sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length) : 0,
      p95Latency: getPercentile(95),
      errorBreakdown,
    };
  }

  /**
   * Analyze latency trend by comparing recent window to baseline.
   * Identifies if latency is improving, degrading, or stable.
   *
   * @returns PerformanceTrend indicating direction and magnitude of change
   *
   * @example
   * const trend = collector.getLatencyTrend();
   * if (trend.direction === 'degrading' && trend.changePercent > 20) {
   *   console.warn('Significant latency increase: ' + trend.changePercent + '%');
   * }
   */
  getLatencyTrend(): PerformanceTrend {
    // Compare last 5 minutes to previous 5 minutes
    const recentMetrics = this.getMetricsForWindow(5 * 60 * 1000);
    const baselineMetrics = this.getMetricsForWindow(10 * 60 * 1000);

    if (recentMetrics.jobCount < 10 || baselineMetrics.jobCount < 10) {
      return {
        direction: 'stable',
        changePercent: 0,
        metric: 'latency',
        confidence: Math.min(recentMetrics.jobCount, baselineMetrics.jobCount),
      };
    }

    const recentLatency = recentMetrics.avgLatency;
    const baselineLatency = baselineMetrics.avgLatency;

    if (baselineLatency === 0) {
      return {
        direction: 'stable',
        changePercent: 0,
        metric: 'latency',
        confidence: 0,
      };
    }

    const changePercent = Math.round(((recentLatency - baselineLatency) / baselineLatency) * 100);
    const direction = changePercent < -5 ? 'improving' : changePercent > 5 ? 'degrading' : 'stable';

    return {
      direction,
      changePercent: Math.abs(changePercent),
      metric: 'latency',
      confidence: Math.min(100, Math.round((recentMetrics.jobCount / 100) * 100)),
    };
  }

  /**
   * Analyze error rate trend comparing recent window to baseline.
   * Identifies if error rate is improving, degrading, or stable.
   *
   * @returns PerformanceTrend indicating error rate direction
   *
   * @example
   * const errorTrend = collector.getErrorRateTrend();
   * if (errorTrend.direction === 'degrading') {
   *   console.warn('Error rate increasing');
   * }
   */
  getErrorRateTrend(): PerformanceTrend {
    // Compare last 5 minutes to previous 5 minutes
    const recentMetrics = this.getMetricsForWindow(5 * 60 * 1000);
    const baselineMetrics = this.getMetricsForWindow(10 * 60 * 1000);

    if (recentMetrics.jobCount < 10 || baselineMetrics.jobCount < 10) {
      return {
        direction: 'stable',
        changePercent: 0,
        metric: 'errorRate',
        confidence: Math.min(recentMetrics.jobCount, baselineMetrics.jobCount),
      };
    }

    const recentErrorRate = recentMetrics.failureCount / recentMetrics.jobCount;
    const baselineErrorRate = baselineMetrics.failureCount / baselineMetrics.jobCount;

    if (baselineErrorRate === 0) {
      return {
        direction: recentErrorRate > 0 ? 'degrading' : 'stable',
        changePercent: 0,
        metric: 'errorRate',
        confidence: recentMetrics.jobCount,
      };
    }

    const changePercent = Math.round(((recentErrorRate - baselineErrorRate) / baselineErrorRate) * 100);
    const direction = changePercent < -5 ? 'improving' : changePercent > 5 ? 'degrading' : 'stable';

    return {
      direction,
      changePercent: Math.abs(changePercent),
      metric: 'errorRate',
      confidence: Math.min(100, Math.round((recentMetrics.jobCount / 100) * 100)),
    };
  }
}

/**
 * Global singleton metrics collector instance.
 * Ensures all metrics collection routes through a single collector.
 */
let collector: MetricsCollector | null = null;

/**
 * Get or create the global metrics collector singleton.
 * Lazily initializes on first call.
 *
 * @returns The global MetricsCollector instance
 *
 * @example
 * // Record a metric
 * const collector = getMetricsCollector();
 * collector.recordEvent({ jobId: "123", ... });
 */
export function getMetricsCollector(): MetricsCollector {
  if (!collector) {
    collector = new MetricsCollector();
  }
  return collector;
}

/**
 * Reset the global metrics collector.
 * Clears all recorded metrics and recreates the collector on next call.
 * Useful for testing or manual reset in development.
 *
 * @example
 * // In test setup
 * beforeEach(() => {
 *   resetMetrics();
 * });
 */
export function resetMetrics(): void {
  collector = null;
}

/**
 * Format metrics as human-readable string for logging or HTTP responses.
 * Includes job counts, success rates, latency percentiles, and queue state.
 *
 * @param metrics - The JobMetrics to format
 * @returns Formatted string with line breaks and aligned columns
 *
 * @example
 * const metrics = collector.getMetrics();
 * console.log(formatMetrics(metrics));
 * // Outputs:
 * // === Queue Metrics ===
 * // Total Jobs: 100
 * // Completed: 95 (95%)
 * // ...
 */
export function formatMetrics(metrics: JobMetrics): string {
  return `
=== Queue Metrics ===
Total Jobs: ${metrics.totalJobs}
Completed: ${metrics.completedJobs} (${metrics.successRate}%)
Failed: ${metrics.failedJobs} (${metrics.failureRate}%)
Retries: ${metrics.retryCount}

=== Performance ===
Avg Duration: ${metrics.avgDuration}ms
Min Duration: ${metrics.minDuration}ms
Max Duration: ${metrics.maxDuration}ms
P50 (median): ${metrics.p50Duration}ms
P95: ${metrics.p95Duration}ms
P99: ${metrics.p99Duration}ms

=== Queue State ===
Pending Jobs: ${metrics.queueDepth}
Active Jobs: ${metrics.activeJobs}
`;
}
