import { z } from 'zod';
import { getDb } from '../client';
import {
  DocumentSchema,
  DocumentStatusSchema,
  CreateDocumentSchema,
  type Document,
  type CreateDocument,
  type DocumentStatus,
} from '../schemas';
import { indexDocumentForFullText, removeDocumentFromFullText } from './search.repo';

export function createDocument(data: CreateDocument): Document {
  const db = getDb();
  const parsed = CreateDocumentSchema.parse(data);
  const doc: Document = {
    ...parsed,
    status: parsed.status ?? 'waiting',
    tags: parsed.tags ?? '[]',
    content: parsed.content ?? null,
    chunk_count: parsed.chunk_count ?? 0,
    file_path: parsed.file_path,
    owner_id: parsed.owner_id ?? null,
    shared_users: parsed.shared_users ?? '[]',
  };
  db.prepare(`
    INSERT INTO documents (id, name, format, size, status, tags, file_path, content, chunk_count, owner_id, shared_users, created_at, updated_at)
    VALUES (@id, @name, @format, @size, @status, @tags, @file_path, @content, @chunk_count, @owner_id, @shared_users, @created_at, @updated_at)
  `).run(doc);

  // Index for full-text search (safe to fail if FTS table not available)
  try {
    indexDocumentForFullText(doc.id, doc.name ?? '', doc.content ?? null);
  } catch (err) {
    // FTS table may not exist in test environments, skip indexing
  }

  return doc;
}

export function getDocument(id: string): Document | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!row) return null;
  return DocumentSchema.parse(row);
}

export interface ListDocumentsOptions {
  status?: DocumentStatus;
  limit?: number;
  offset?: number;
}

export function listDocuments(options: ListDocumentsOptions = {}): Document[] {
  const db = getDb();
  const { status, limit = 50, offset = 0 } = options;

  let sql = 'SELECT * FROM documents';
  const params: unknown[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = db.prepare(sql).all(...params);
  return rows.map((row) => DocumentSchema.parse(row));
}

/**
 * Updates the status of a document by ID.
 * @param id - Document ID
 * @param status - Must be a valid DocumentStatus enum value
 * @param extra - Optional chunk_count and updated_at overrides
 * @throws {ZodError} if status is not a valid DocumentStatus value
 */
export function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  extra?: Partial<Pick<Document, 'chunk_count' | 'updated_at' | 'error_message'>>,
): void {
  DocumentStatusSchema.parse(status);
  const db = getDb();
  const updated_at = extra?.updated_at ?? new Date().toISOString();
  const chunk_count = extra?.chunk_count;
  const error_message = extra?.error_message;

  if (chunk_count !== undefined && error_message !== undefined) {
    db.prepare(
      'UPDATE documents SET status = ?, chunk_count = ?, error_message = ?, updated_at = ? WHERE id = ?',
    ).run(status, chunk_count, error_message, updated_at, id);
  } else if (chunk_count !== undefined) {
    db.prepare(
      'UPDATE documents SET status = ?, chunk_count = ?, updated_at = ? WHERE id = ?',
    ).run(status, chunk_count, updated_at, id);
  } else if (error_message !== undefined) {
    db.prepare(
      'UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
    ).run(status, error_message, updated_at, id);
  } else {
    db.prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?').run(
      status,
      updated_at,
      id,
    );
  }
}

export function deleteDocument(id: string): void {
  const db = getDb();
  // Remove from FTS index first (safe to fail if FTS table not available)
  try {
    removeDocumentFromFullText(id);
  } catch (err) {
    // FTS table may not exist in test environments, skip
  }
  // Then delete from documents table
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

export function shareDocument(documentId: string, userId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT shared_users FROM documents WHERE id = ?').get(documentId) as
    | { shared_users: string }
    | undefined;
  if (!row) return;
  const current: string[] = z.array(z.string()).parse(JSON.parse(row.shared_users));
  if (!current.includes(userId)) {
    current.push(userId);
  }
  db.prepare('UPDATE documents SET shared_users = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(current),
    new Date().toISOString(),
    documentId,
  );
}

export function getUserDocuments(userId: string, limit?: number, offset?: number): Document[] {
  const db = getDb();
  let sql = `SELECT * FROM documents WHERE owner_id = ? OR shared_users LIKE ? ORDER BY created_at DESC`;
  const params: unknown[] = [userId, `%"${userId}"%`];
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
    if (offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(offset);
    }
  }
  const rows = db.prepare(sql).all(...params);
  return rows.map((row) => DocumentSchema.parse(row));
}

export function getUserDocumentIds(userId: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id FROM documents WHERE owner_id = ? OR shared_users LIKE ?`,
    )
    .all(userId, `%"${userId}"%`) as { id: string }[];
  return rows.map((row) => row.id);
}

// Alias exports matching acceptance criteria API: create, list, getById, update, delete
export const create = createDocument;
export const list = listDocuments;
export const getById = getDocument;
export const update = (id: string, fields: { status: DocumentStatus }): void =>
  updateDocumentStatus(id, fields.status);
export { deleteDocument as delete };
