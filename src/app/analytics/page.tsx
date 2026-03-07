import { logger } from '@/lib/logger';
import { AnalyticsDashboard } from '@/features/analytics/components/AnalyticsDashboard';
import type { AnalyticsData } from '@/features/analytics/schema';

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    const [statsRes, trendsRes, activityRes] = await Promise.all([
      fetch(`${baseUrl}/api/analytics/documents`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/analytics/search-trends?days=7`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/analytics/activity`, { cache: 'no-store' }),
    ]);

    if (!statsRes.ok || !trendsRes.ok || !activityRes.ok) {
      throw new Error('Failed to fetch analytics data');
    }

    const [statsData, trendsData, activityData] = await Promise.all([
      statsRes.json() as Promise<{ data: AnalyticsData['stats'] }>,
      trendsRes.json() as Promise<{ data: AnalyticsData['trends'] }>,
      activityRes.json() as Promise<{ data: AnalyticsData['activity'] }>,
    ]);

    return {
      stats: statsData.data,
      trends: trendsData.data,
      activity: activityData.data,
    };
  } catch (error) {
    logger.error('Error fetching analytics', { error: String(error) });
    throw error;
  }
}

function ErrorFallback() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Analytics</h2>
          <p className="text-red-700">
            There was an error fetching the analytics data. Please try refreshing the page.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  try {
    const data = await fetchAnalyticsData();
    return <AnalyticsDashboard data={data} />;
  } catch {
    return <ErrorFallback />;
  }
}
