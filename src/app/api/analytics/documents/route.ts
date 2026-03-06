import { NextResponse } from 'next/server';
import { getDocumentStats } from '@/lib/db/repositories/analytics.repo';
import { getQueryCache } from '@/lib/cache/query-cache';
import { logger } from '@/lib/logger';

const MOCK_USER_ID = 'user-test-123';
const CACHE_KEY = 'analytics:documents';

interface AnalyticsResponse {
  data: { total_count: number; total_size: number; avg_size: number; format_distribution: Record<string, number> };
  response_time: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const cache = getQueryCache();

    // Try to get from cache
    const cached = cache.get<AnalyticsResponse['data']>(CACHE_KEY);

    if (cached) {
      const responseTime = Date.now() - startTime;

      logger.debug('Analytics cache hit', {
        key: CACHE_KEY,
        responseTime,
      });

      const response: AnalyticsResponse = {
        data: cached,
        response_time: responseTime,
      };

      return NextResponse.json(response);
    }

    // Cache miss - fetch from database
    const stats = getDocumentStats(MOCK_USER_ID);

    // Store in cache (5-minute TTL)
    cache.set(CACHE_KEY, stats, 5 * 60 * 1000);

    const responseTime = Date.now() - startTime;

    logger.info('Document stats retrieved', {
      total_count: stats.total_count,
      response_time: responseTime,
      cached: false,
    });

    const response: AnalyticsResponse = {
      data: stats,
      response_time: responseTime,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('Failed to retrieve document stats', {
      error: String(err),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve document stats' },
      { status: 500 }
    );
  }
}
