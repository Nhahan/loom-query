import { logActivity } from './db/repositories/activity.repo';
import type { ActivityLog } from './db/schemas';

export interface LogUserActionParams {
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export function logUserAction(params: LogUserActionParams): ActivityLog {
  return logActivity({
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    details: params.details ? JSON.stringify(params.details) : null,
  });
}
