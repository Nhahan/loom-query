import { NextResponse } from 'next/server';
import { getMastraClient } from '@/lib/mastra';
import { getChromaClient } from '@/lib/chroma';
import { logger } from '@/lib/logger';
import { logSearch, searchFullText } from '@/lib/db/repositories/search.repo';
import { getUserDocumentIds } from '@/lib/db/repositories/document.repo';

// Phase 2: use hardcoded test user; replace with session lookup in Phase 3
const MOCK_USER_ID = 'user-test-123';

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const mode = (searchParams.get('mode') ?? 'hybrid') as 'fts' | 'semantic' | 'hybrid';

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
  }

  // Build set of accessible document IDs for the current user
  const accessibleIds = new Set(getUserDocumentIds(MOCK_USER_ID));

  // Full-text search results
  let ftsResults: Array<{ document_id: string; name: string; rank: number; relevance: number }> = [];
  if (mode === 'fts' || mode === 'hybrid') {
    try {
      ftsResults = searchFullText(query.trim(), MOCK_USER_ID);
    } catch (err) {
      logger.warn('FTS search failed, continuing', { error: String(err), query });
    }
  }

  // Semantic search results
  let semanticResults: Array<{ document_id: string | null; text: string; similarity: number; metadata: Record<string, unknown> }> = [];
  if (mode === 'semantic' || mode === 'hybrid') {
    let embedding: number[];
    try {
      const mastra = getMastraClient();
      embedding = await mastra.embed(query.trim());
    } catch (err) {
      logger.error('Failed to generate embedding', { error: String(err), query });
      if (mode === 'semantic') {
        return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
      }
      // Continue with FTS if semantic fails in hybrid mode
      embedding = [];
    }

    if (embedding.length > 0) {
      try {
        const chroma = getChromaClient();
        const collection = await chroma.getCollection({ name: 'documents' });
        const queryResult = await collection.query({
          queryEmbeddings: [embedding],
          nResults: 5,
        }) as {
          documents: (string | null)[][];
          distances: number[][];
          metadatas: (Record<string, unknown> | null)[][];
        };

        const docs = queryResult.documents[0] ?? [];
        const distances = queryResult.distances[0] ?? [];
        const metadatas = queryResult.metadatas[0] ?? [];

        semanticResults = docs.map((text, i) => {
          const meta = metadatas[i] ?? {};
          return {
            document_id: (meta.document_id as string | undefined) ?? null,
            text: text ?? '',
            similarity: 1 - (distances[i] ?? 0),
            metadata: meta,
          };
        });
      } catch (err) {
        logger.error('ChromaDB query failed', { error: String(err), query });
        if (mode === 'semantic') {
          return NextResponse.json({ error: 'Search query failed' }, { status: 500 });
        }
      }
    }
  }

  // Merge and deduplicate results
  interface MergedResult {
    document_id: string | null;
    name?: string;
    text?: string;
    fts_score?: number;
    semantic_score?: number;
    combined_score: number;
    metadata?: Record<string, unknown>;
  }

  const mergedMap = new Map<string, MergedResult>();

  // Add FTS results
  ftsResults.forEach(r => {
    mergedMap.set(r.document_id, {
      document_id: r.document_id,
      name: r.name,
      fts_score: r.relevance,
      combined_score: mode === 'hybrid' ? r.relevance * 0.5 : r.relevance,
    });
  });

  // Add semantic results (merge with existing or create new)
  semanticResults.forEach(r => {
    const key = r.document_id ?? 'null';
    const existing = mergedMap.get(key);
    if (existing) {
      existing.semantic_score = r.similarity;
      existing.combined_score = mode === 'hybrid'
        ? (existing.fts_score ?? 0) * 0.5 + r.similarity * 0.5
        : r.similarity;
      existing.text = r.text;
      existing.metadata = r.metadata;
    } else {
      mergedMap.set(key, {
        document_id: r.document_id,
        text: r.text,
        semantic_score: r.similarity,
        combined_score: mode === 'hybrid' ? r.similarity * 0.5 : r.similarity,
        metadata: r.metadata,
      });
    }
  });

  // Sort by combined score and limit to 10
  const results = Array.from(mergedMap.values())
    .filter(r => r.document_id === null || accessibleIds.has(r.document_id))
    .sort((a, b) => b.combined_score - a.combined_score)
    .slice(0, 10);

  const responseTime = Date.now() - startTime;

  logger.info('Search completed', {
    query,
    mode,
    fts_count: ftsResults.length,
    semantic_count: semanticResults.length,
    result_count: results.length,
    response_time: responseTime
  });

  try {
    logSearch(query.trim(), results.length);
  } catch (err) {
    logger.warn('Failed to log search analytics', { error: String(err), query });
  }

  return NextResponse.json({
    results,
    mode,
    response_time: responseTime
  });
}
