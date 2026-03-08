/**
 * Queue health check endpoint.
 * Returns current metrics and health status of the embedding pipeline.
 * Used for: monitoring dashboards, alerting systems, health checks
 */

import { getMetricsCollector, formatMetrics } from '@/lib/queue/metrics';
import { getOllamaCircuitBreaker, getChromaCircuitBreaker } from '@/lib/queue/circuit-breaker';

export async function GET() {
  try {
    const collector = getMetricsCollector();
    const metrics = collector.getMetrics();
    const errorBreakdown = collector.getErrorBreakdown();
    const recentErrors = collector.getRecentErrors(5);

    // Time-window metrics for trend analysis
    const metrics5m = collector.getMetricsForWindow(5 * 60 * 1000); // 5 minutes
    const metrics1h = collector.getMetricsForWindow(60 * 60 * 1000); // 1 hour
    const metrics24h = collector.getMetricsForWindow(24 * 60 * 60 * 1000); // 24 hours

    // Trend analysis
    const latencyTrend = collector.getLatencyTrend();
    const errorRateTrend = collector.getErrorRateTrend();

    const ollamaState = getOllamaCircuitBreaker().getState();
    const chromaState = getChromaCircuitBreaker().getState();

    // Determine overall health status
    const isHealthy = ollamaState === 'CLOSED' && chromaState === 'CLOSED' && metrics.failureRate < 20;
    const status = isHealthy ? 'healthy' : ollamaState !== 'CLOSED' || chromaState !== 'CLOSED' ? 'degraded' : 'unhealthy';

    const response = {
      status,
      timestamp: new Date().toISOString(),
      metrics,
      timeWindows: {
        last5m: metrics5m,
        last1h: metrics1h,
        last24h: metrics24h,
      },
      trends: {
        latency: latencyTrend,
        errorRate: errorRateTrend,
      },
      circuitBreakers: {
        ollama: {
          state: ollamaState,
          stats: getOllamaCircuitBreaker().getStats(),
        },
        chroma: {
          state: chromaState,
          stats: getChromaCircuitBreaker().getStats(),
        },
      },
      errorBreakdown,
      recentErrors: recentErrors.map((e) => ({
        jobId: e.jobId,
        documentId: e.documentId,
        errorType: e.errorType,
        errorCode: e.errorCode,
        timestamp: e.timestamp,
      })),
      formattedMetrics: formatMetrics(metrics),
    };

    return Response.json(response, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
