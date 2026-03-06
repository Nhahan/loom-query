import { NextResponse } from 'next/server';
import { getTopSearches } from '@/lib/db/repositories/search.repo';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse> {
  try {
    const topSearches = getTopSearches(10);
    logger.info('Analytics fetched', { topSearchCount: topSearches.length });
    return NextResponse.json({ top_searches: topSearches });
  } catch (err) {
    logger.error('Failed to fetch analytics', { error: String(err) });
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
