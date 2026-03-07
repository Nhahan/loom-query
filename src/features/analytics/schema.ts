import { z } from 'zod';

export const DocumentStatsSchema = z.object({
  total_count: z.number().int().min(0),
  total_size: z.number().min(0),
  avg_size: z.number().min(0),
  format_distribution: z.record(z.string(), z.number().int().min(0)),
});
export type DocumentStats = z.infer<typeof DocumentStatsSchema>;

export const SearchTrendSchema = z.object({
  query: z.string(),
  count: z.number().int().min(0),
  unique_users: z.number().int().min(0),
});
export type SearchTrend = z.infer<typeof SearchTrendSchema>;

export const SearchTrendsSchema = z.array(SearchTrendSchema);
export type SearchTrends = z.infer<typeof SearchTrendsSchema>;

export const UserActivitySchema = z.object({
  documents_created: z.number().int().min(0),
  searches_performed: z.number().int().min(0),
  avg_search_time_ms: z.number().min(0),
});
export type UserActivity = z.infer<typeof UserActivitySchema>;

export const AnalyticsDocumentsResponseSchema = z.object({
  data: DocumentStatsSchema,
  response_time: z.number(),
});
export type AnalyticsDocumentsResponse = z.infer<typeof AnalyticsDocumentsResponseSchema>;

export const AnalyticsSearchTrendsResponseSchema = z.object({
  data: SearchTrendsSchema,
  response_time: z.number(),
});
export type AnalyticsSearchTrendsResponse = z.infer<typeof AnalyticsSearchTrendsResponseSchema>;

export const AnalyticsActivityResponseSchema = z.object({
  data: UserActivitySchema,
  response_time: z.number(),
});
export type AnalyticsActivityResponse = z.infer<typeof AnalyticsActivityResponseSchema>;

export const AnalyticsDataSchema = z.object({
  stats: DocumentStatsSchema,
  trends: SearchTrendsSchema,
  activity: UserActivitySchema,
});
export type AnalyticsData = z.infer<typeof AnalyticsDataSchema>;
