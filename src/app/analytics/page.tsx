import { Suspense } from 'react';
import { logger } from '@/lib/logger';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

interface DocumentStats {
  total_count: number;
  total_size: number;
  avg_size: number;
  format_distribution: Record<string, number>;
}

interface SearchTrend {
  query: string;
  count: number;
  unique_users: number;
}

interface UserActivity {
  documents_created: number;
  searches_performed: number;
  avg_search_time_ms: number;
}

interface AnalyticsData {
  stats: DocumentStats;
  trends: SearchTrend[];
  activity: UserActivity;
}

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
      statsRes.json(),
      trendsRes.json(),
      activityRes.json(),
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function StatsCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function AnalyticsDashboardContent({ data }: { data: AnalyticsData }) {
  const formatDistributionData = Object.entries(data.stats.format_distribution).map(
    ([format, count]) => ({
      name: format.toUpperCase(),
      value: count,
    })
  );

  const trendData = data.trends.slice(0, 10).map((trend) => ({
    name: trend.query.substring(0, 20) + (trend.query.length > 20 ? '...' : ''),
    count: trend.count,
    users: trend.unique_users,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of documents, searches, and activity</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Documents"
            value={data.stats.total_count.toString()}
            subtitle="Documents you own or have access to"
          />
          <StatsCard
            title="Total Size"
            value={formatBytes(data.stats.total_size)}
            subtitle="Total storage used"
          />
          <StatsCard
            title="Average Document Size"
            value={formatBytes(data.stats.avg_size)}
            subtitle="Mean document size"
          />
          <StatsCard
            title="Searches Performed"
            value={data.activity.searches_performed.toString()}
            subtitle={`Avg time: ${Math.round(data.activity.avg_search_time_ms)}ms`}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Format Distribution */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Document Format Distribution
            </h2>
            {formatDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={formatDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {formatDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No document format data available</p>
            )}
          </div>

          {/* Top Search Queries */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Search Queries (7 days)</h2>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#3b82f6" name="Search Count" />
                  <Bar dataKey="users" fill="#10b981" name="Unique Users" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">No search trend data available</p>
            )}
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600 mb-1">Documents Created</p>
              <p className="text-2xl font-bold text-gray-900">{data.activity.documents_created}</p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <p className="text-sm text-gray-600 mb-1">Total Searches</p>
              <p className="text-2xl font-bold text-gray-900">{data.activity.searches_performed}</p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <p className="text-sm text-gray-600 mb-1">Average Search Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(data.activity.avg_search_time_ms)}ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-2 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 animate-pulse" />
              <div className="h-8 bg-gray-200 rounded w-2/3 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4 animate-pulse" />
              <div className="h-64 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    return <AnalyticsDashboardContent data={data} />;
  } catch (error) {
    return <ErrorFallback />;
  }
}
