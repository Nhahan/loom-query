import { NextResponse } from 'next/server';
import { getUserActivity } from '@/lib/db/repositories/analytics.repo';
import { getQueryCache } from '@/lib/cache/query-cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MOCK_USER_ID = 'user-test-123';
const CACHE_KEY = 'analytics:activity';

const UserActivitySchema = z.object({
  documents_created: z.number(),
  searches_performed: z.number(),
  avg_search_time_ms: z.number(),
});

interface AnalyticsResponse {
  data: z.infer<typeof UserActivitySchema>;
  response_time: number;
}

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const cache = getQueryCache();

    // Try to get from cache
    const cached = cache.get<z.infer<typeof UserActivitySchema>>(CACHE_KEY);

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
    const activity = getUserActivity(MOCK_USER_ID);
    const validated = UserActivitySchema.parse(activity);

    // Store in cache (5-minute TTL)
    cache.set(CACHE_KEY, validated, 5 * 60 * 1000);

    const responseTime = Date.now() - startTime;

    logger.info('User activity retrieved', {
      documents_created: validated.documents_created,
      searches_performed: validated.searches_performed,
      response_time: responseTime,
      cached: false,
    });

    const response: AnalyticsResponse = {
      data: validated,
      response_time: responseTime,
    };

    return NextResponse.json(response);
  } catch (err) {
    logger.error('Failed to retrieve user activity', {
      error: String(err),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve user activity' },
      { status: 500 }
    );
  }
}
