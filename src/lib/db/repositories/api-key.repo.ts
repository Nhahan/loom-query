import { getDb } from '../client';
import {
  ApiKeySchema,
  CreateApiKeySchema,
  type ApiKey,
  type CreateApiKey,
} from '../schemas';

export function createApiKey(data: CreateApiKey): ApiKey {
  const db = getDb();
  const parsed = CreateApiKeySchema.parse(data);
  const key: ApiKey = {
    ...parsed,
    rate_limit: parsed.rate_limit ?? 100,
  };
  db.prepare(`
    INSERT INTO api_keys (id, name, key_hash, prefix, rate_limit, created_at, last_used_at, revoked_at)
    VALUES (@id, @name, @key_hash, @prefix, @rate_limit, @created_at, @last_used_at, @revoked_at)
  `).run(key);
  return key;
}

export function getApiKey(id: string): ApiKey | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  if (!row) return null;
  return ApiKeySchema.parse(row);
}

export function listApiKeys(): ApiKey[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC').all();
  return rows.map((row) => ApiKeySchema.parse(row));
}

export function revokeApiKey(id: string): void {
  const db = getDb();
  db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id,
  );
}

export function updateApiKeyLastUsed(id: string): void {
  const db = getDb();
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id,
  );
}
