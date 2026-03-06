import { v4 as uuid } from 'uuid';
import { getDb } from '../client';
import {
  ActivityLogSchema,
  CreateActivityLogSchema,
  type ActivityLog,
  type CreateActivityLog,
} from '../schemas';

export function logActivity(data: CreateActivityLog): ActivityLog {
  const db = getDb();
  const parsed = CreateActivityLogSchema.parse(data);
  const record: ActivityLog = {
    ...parsed,
    id: uuid(),
    created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO activity_log (id, action, entity_type, entity_id, details, created_at)
    VALUES (@id, @action, @entity_type, @entity_id, @details, @created_at)
  `).run(record);
  return ActivityLogSchema.parse(record);
}

export interface ListActivitiesOptions {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
  offset?: number;
}

export function listActivities(options: ListActivitiesOptions = {}): ActivityLog[] {
  const db = getDb();
  const { entity_type, entity_id, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (entity_type) {
    conditions.push('entity_type = ?');
    params.push(entity_type);
  }
  if (entity_id) {
    conditions.push('entity_id = ?');
    params.push(entity_id);
  }

  let sql = 'SELECT * FROM activity_log';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map((row) => ActivityLogSchema.parse(row));
}
