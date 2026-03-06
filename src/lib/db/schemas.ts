import { z } from 'zod';

// Document
export const DocumentStatusSchema = z.enum(['waiting', 'processing', 'done', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.string(),
  size: z.number().int(),
  status: DocumentStatusSchema.default('waiting'),
  tags: z.string().default('[]'),
  file_path: z.string().nullable(),
  content: z.string().nullable().optional(),
  chunk_count: z.number().int().default(0),
  error_message: z.string().nullable().optional(),
  owner_id: z.string().nullable().optional(),
  shared_users: z.string().default('[]'),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentPermissionSchema = z.object({
  owner_id: z.string(),
  shared_user_ids: z.array(z.string()),
});
export type DocumentPermission = z.infer<typeof DocumentPermissionSchema>;

export const CreateDocumentSchema = DocumentSchema.omit({
  status: true,
  tags: true,
  chunk_count: true,
  shared_users: true,
}).extend({
  status: DocumentStatusSchema.optional(),
  tags: z.string().optional(),
  chunk_count: z.number().int().optional(),
  shared_users: z.string().optional(),
});
export type CreateDocument = z.infer<typeof CreateDocumentSchema>;

// ApiKey
export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  key_hash: z.string(),
  prefix: z.string(),
  rate_limit: z.number().int().default(100),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const CreateApiKeySchema = ApiKeySchema.omit({ rate_limit: true }).extend({
  rate_limit: z.number().int().optional(),
});
export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;

// ActivityLog
export const ActivityLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string(),
  details: z.string().nullable(),
  created_at: z.string(),
});
export type ActivityLog = z.infer<typeof ActivityLogSchema>;

export const CreateActivityLogSchema = ActivityLogSchema.omit({ id: true, created_at: true });
export type CreateActivityLog = z.infer<typeof CreateActivityLogSchema>;

// Feedback
export const FeedbackSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  document_id: z.string().nullable(),
  helpful: z.number().int(),
  created_at: z.string(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const CreateFeedbackSchema = FeedbackSchema.omit({ id: true, created_at: true });
export type CreateFeedback = z.infer<typeof CreateFeedbackSchema>;

// Settings
export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
  updated_at: z.string(),
});
export type Setting = z.infer<typeof SettingSchema>;

// Search
export const SearchSchema = z.object({
  id: z.string(),
  query: z.string(),
  result_count: z.number().int(),
  created_at: z.string(),
});
export type Search = z.infer<typeof SearchSchema>;
