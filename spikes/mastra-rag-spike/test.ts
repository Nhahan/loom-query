/**
 * Mastra RAG Integration Spike — test.ts
 *
 * Validates @mastra/rag API against Korean text documents:
 *   1. MDocument chunking
 *   2. Embedding generation via Ollama (nomic-embed-text)
 *   3. ChromaDB storage
 *   4. Document retrieval
 *
 * Run:
 *   npx ts-node --esm spikes/mastra-rag-spike/test.ts
 *
 * Prerequisites:
 *   - Ollama running locally with nomic-embed-text pulled
 *   - ChromaDB running at http://localhost:8000
 */

import { MDocument } from '@mastra/rag';
import { ChromaClient } from 'chromadb';

// ---------------------------------------------------------------------------
// Sample Korean text (simulates PDF extract)
// ---------------------------------------------------------------------------
const SAMPLE_KOREAN_TEXT = `
이것은 테스트 문서입니다.
이 문서는 마스트라 RAG 파이프라인을 검증하기 위해 작성되었습니다.

첫 번째 단락: 한국어 자연어 처리는 형태소 분석, 품사 태깅, 의존 구문 분석 등
다양한 언어적 특성을 다룹니다. 한국어는 교착어이므로 어간과 어미의 결합이 복잡합니다.

두 번째 단락: 벡터 임베딩을 활용하면 의미론적 유사도를 측정할 수 있습니다.
대규모 언어 모델은 한국어 문장을 고차원 벡터 공간에 투영하여 의미를 보존합니다.

세 번째 단락: RAG(검색 증강 생성) 시스템은 외부 지식베이스에서 관련 문서를
검색하여 언어 모델의 응답 품질을 향상시킵니다.
`.trim();

const CHROMA_URL = process.env.CHROMA_URL ?? 'http://localhost:8000';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const COLLECTION_NAME = 'spike-test-korean';

// ---------------------------------------------------------------------------
// Minimal embedding function using Ollama HTTP API
// ---------------------------------------------------------------------------
async function embedTexts(
  texts: string[],
  model: string,
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { embedding: number[] };
    embeddings.push(json.embedding);
  }
  return embeddings;
}

// ---------------------------------------------------------------------------
// Test 1: Chunking
// ---------------------------------------------------------------------------
async function testChunking(): Promise<string[]> {
  console.log('\n=== Test 1: MDocument Chunking ===');

  const doc = MDocument.fromText(SAMPLE_KOREAN_TEXT, {
    source: 'spike-test',
    language: 'ko',
  });

  const chunks = await doc.chunk({
    strategy: 'recursive',
    maxSize: 200,
    overlap: 20,
  });

  console.log(`  Input length  : ${SAMPLE_KOREAN_TEXT.length} chars`);
  console.log(`  Chunks created: ${chunks.length}`);
  chunks.forEach((c, i) => {
    console.log(`  Chunk[${i}] (${c.text.length} chars): ${c.text.slice(0, 60)}...`);
  });

  if (chunks.length === 0) {
    throw new Error('Chunking produced 0 chunks');
  }

  return chunks.map((c) => c.text);
}

// ---------------------------------------------------------------------------
// Test 2: Embedding generation
// ---------------------------------------------------------------------------
async function testEmbedding(texts: string[]): Promise<number[][]> {
  console.log('\n=== Test 2: Embedding Generation (nomic-embed-text) ===');

  const t0 = Date.now();
  const embeddings = await embedTexts(texts, 'nomic-embed-text');
  const elapsed = Date.now() - t0;

  console.log(`  Texts embedded : ${embeddings.length}`);
  console.log(`  Dimensions     : ${embeddings[0].length}`);
  console.log(`  Time elapsed   : ${elapsed}ms`);
  console.log(`  Avg per text   : ${Math.round(elapsed / embeddings.length)}ms`);

  if (embeddings[0].length === 0) {
    throw new Error('Embedding returned empty vector');
  }

  return embeddings;
}

// ---------------------------------------------------------------------------
// Test 3: ChromaDB storage
// ---------------------------------------------------------------------------
async function testStorage(
  texts: string[],
  embeddings: number[][],
): Promise<void> {
  console.log('\n=== Test 3: ChromaDB Storage ===');

  const chroma = new ChromaClient({ path: CHROMA_URL });

  // Clean up any previous run
  try {
    await chroma.deleteCollection({ name: COLLECTION_NAME });
    console.log('  Deleted existing collection');
  } catch {
    // collection may not exist — ignore
  }

  const collection = await chroma.createCollection({
    name: COLLECTION_NAME,
    metadata: { description: 'Spike test — Korean documents' },
  });

  const ids = texts.map((_, i) => `doc-${i}`);
  const metadatas = texts.map((_, i) => ({ chunkIndex: i, source: 'spike-test' }));

  await collection.add({
    ids,
    embeddings,
    documents: texts,
    metadatas,
  });

  const count = await collection.count();
  console.log(`  Documents stored: ${count}`);

  if (count !== texts.length) {
    throw new Error(`Expected ${texts.length} docs in ChromaDB, got ${count}`);
  }
}

// ---------------------------------------------------------------------------
// Test 4: Document retrieval
// ---------------------------------------------------------------------------
async function testRetrieval(): Promise<void> {
  console.log('\n=== Test 4: Document Retrieval ===');

  const chroma = new ChromaClient({ path: CHROMA_URL });
  const collection = await chroma.getCollection({ name: COLLECTION_NAME });

  const queries = [
    '벡터 임베딩 의미론적 유사도',
    'RAG 검색 증강 생성',
    '한국어 형태소 분석',
  ];

  for (const query of queries) {
    const queryEmbedding = await embedTexts([query], 'nomic-embed-text');
    const results = await collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: 2,
    });

    const topDoc = results.documents[0][0] ?? '(none)';
    const topDistance = results.distances?.[0][0] ?? 'N/A';
    console.log(`\n  Query   : "${query}"`);
    console.log(`  Top hit : "${topDoc.slice(0, 80)}..."`);
    console.log(`  Distance: ${topDistance}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log('Mastra RAG Spike — test.ts');
  console.log('===========================');
  console.log(`Ollama   : ${OLLAMA_BASE_URL}`);
  console.log(`ChromaDB : ${CHROMA_URL}`);

  try {
    const texts = await testChunking();
    const embeddings = await testEmbedding(texts);
    await testStorage(texts, embeddings);
    await testRetrieval();

    console.log('\n=== All tests PASSED ===\n');
  } catch (err) {
    console.error('\n=== FAILED ===');
    console.error(err);
    process.exit(1);
  }
}

main();
