import { NextResponse } from 'next/server';
import { getSearchTrends } from '@/lib/db/repositories/analytics.repo';
import { getQueryCache } from '@/lib/cache/query-cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MOCK_USER_ID = 'user-test-123';

const SearchTrendSchema = z.object({
  query: z.string(),
  count: z.number(),
  unique_users: z.number(),
});

const SearchTrendsSchema = z.array(SearchTrendSchema);

interface AnalyticsResponse {
  data: z.infer<typeof SearchTrendsSchema>;
  response_time: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  const daysStr = searchParams.get('days');
  let days = 7;
  if (daysStr) {
    const parsed = parseInt(daysStr, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 90) {
      return NextResponse.json(
        { error: 'days parameter must be between 1 and 90' },
        { status: 400 }
      );
    }
    days = parsed;
  }

  try {
    const cache = getQueryCache();
    const cacheKey = `analytics:search-trends:${days}`;

    // Try to get from cache
    const cached = cache.get<z.infer<typeof SearchTrendsSchema>>(cacheKey);

    if (cached) {
      const responseTime = Date.now() - startTime;

      logger.debug('Analytics cache hit', {
        key: cacheKey,
        responseTime,
      });

      const response: AnalyticsResponse = {
        data: cached,
        response_time: responseTime,
      };

      return NextResponse.json(response);
    }

    // Cache miss - fetch from database
    const trends = getSearchTrends(MOCK_USER_ID, days);
    const validated = SearchTrendsSchema.parse(trends);

    // Store in cache (10-minute TTL for search trends)
    cache.set(cacheKey, validated, 10 * 60 * 1000);

    const responseTime = Date.now() - startTime;

    logger.info('Search trends retrieved', {
      trend_count: validated.length,
      days,
      response_time: responseTime,
      cached: false,
    });

    const response: AnalyticsResponse = {
      data: validated,
      response_time: responseTime,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('Failed to retrieve search trends', {
      error: String(err),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve search trends' },
      { status: 500 }
    );
  }
}
