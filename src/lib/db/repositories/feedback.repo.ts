import { v4 as uuid } from 'uuid';
import { getDb } from '../client';
import {
  FeedbackSchema,
  CreateFeedbackSchema,
  type Feedback,
  type CreateFeedback,
} from '../schemas';

export function createFeedback(data: CreateFeedback): Feedback {
  const db = getDb();
  const parsed = CreateFeedbackSchema.parse(data);
  const record: Feedback = {
    ...parsed,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO feedback (id, message_id, document_id, helpful, created_at)
    VALUES (@id, @message_id, @document_id, @helpful, @created_at)
  `).run(record);
  return FeedbackSchema.parse(record);
}

export interface ListFeedbackOptions {
  message_id?: string;
  document_id?: string;
  limit?: number;
  offset?: number;
}

export function listFeedback(options: ListFeedbackOptions = {}): Feedback[] {
  const db = getDb();
  const { message_id, document_id, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (message_id) {
    conditions.push('message_id = ?');
    params.push(message_id);
  }
  if (document_id) {
    conditions.push('document_id = ?');
    params.push(document_id);
  }

  let sql = 'SELECT * FROM feedback';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map((row) => FeedbackSchema.parse(row));
}
