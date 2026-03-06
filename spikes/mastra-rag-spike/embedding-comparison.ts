/**
 * Mastra RAG Integration Spike — embedding-comparison.ts
 *
 * Compares two embedding models for Korean text:
 *   - nomic-embed-text        (default, English-centric, 768-dim)
 *   - multilingual-e5-large   (multilingual, 1024-dim)
 *
 * Metrics:
 *   - Embedding dimensions
 *   - Latency per text
 *   - Intra-cluster similarity (positive pairs — semantically related)
 *   - Inter-cluster similarity (negative pairs — semantically unrelated)
 *   - Discrimination gap = intra - inter (higher = better)
 *
 * Run:
 *   npx ts-node --esm spikes/mastra-rag-spike/embedding-comparison.ts
 *
 * Prerequisites:
 *   - Ollama running locally with both models pulled:
 *       ollama pull nomic-embed-text
 *       ollama pull milkey-mouse/multilingual-e5:large
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';

// ---------------------------------------------------------------------------
// Test corpus: Korean sentences grouped by topic
// ---------------------------------------------------------------------------
const CORPUS = {
  // Topic A: RAG / vector search
  topicA: [
    '벡터 임베딩을 활용하면 의미론적 유사도를 측정할 수 있습니다.',
    'RAG 시스템은 외부 지식베이스에서 관련 문서를 검색합니다.',
    '검색 증강 생성은 언어 모델의 응답 품질을 향상시킵니다.',
  ],
  // Topic B: Korean linguistics
  topicB: [
    '한국어는 교착어이므로 어간과 어미의 결합이 복잡합니다.',
    '형태소 분석은 한국어 자연어 처리의 핵심 과정입니다.',
    '품사 태깅은 각 단어의 문법적 역할을 식별합니다.',
  ],
  // Topic C: Unrelated (weather)
  topicC: [
    '오늘 날씨가 매우 맑고 따뜻합니다.',
    '내일은 비가 올 예정입니다.',
  ],
};

const ALL_TEXTS = [
  ...CORPUS.topicA,
  ...CORPUS.topicB,
  ...CORPUS.topicC,
];

// ---------------------------------------------------------------------------
// Ollama embedding helper
// ---------------------------------------------------------------------------
async function embedTexts(
  texts: string[],
  model: string,
): Promise<{ embeddings: number[][]; latencyMs: number }> {
  const embeddings: number[][] = [];
  const t0 = Date.now();

  for (const text of texts) {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });

    if (!res.ok) {
      throw new Error(
        `Ollama embed failed for model "${model}": ${res.status} ${await res.text()}`,
      );
    }

    const json = (await res.json()) as { embedding: number[] };
    embeddings.push(json.embedding);
  }

  return { embeddings, latencyMs: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ---------------------------------------------------------------------------
// Compute average similarity within/across topic groups
// ---------------------------------------------------------------------------
function computeMetrics(embeddings: number[][]): {
  intraA: number;
  intraB: number;
  intraAvg: number;
  interAC: number;
  interBC: number;
  interAvg: number;
  discriminationGap: number;
} {
  const emA = embeddings.slice(0, 3); // topicA
  const emB = embeddings.slice(3, 6); // topicB
  const emC = embeddings.slice(6, 8); // topicC

  const pairwiseAvg = (xs: number[][], ys: number[][]): number => {
    let sum = 0;
    let count = 0;
    for (const x of xs) {
      for (const y of ys) {
        sum += cosine(x, y);
        count++;
      }
    }
    return count === 0 ? 0 : sum / count;
  };

  const intraA = pairwiseAvg(emA, emA);
  const intraB = pairwiseAvg(emB, emB);
  const intraAvg = (intraA + intraB) / 2;
  const interAC = pairwiseAvg(emA, emC);
  const interBC = pairwiseAvg(emB, emC);
  const interAvg = (interAC + interBC) / 2;
  const discriminationGap = intraAvg - interAvg;

  return { intraA, intraB, intraAvg, interAC, interBC, interAvg, discriminationGap };
}

// ---------------------------------------------------------------------------
// Per-model benchmark
// ---------------------------------------------------------------------------
interface ModelResult {
  model: string;
  displayName: string;
  dimensions: number;
  latencyMs: number;
  avgLatencyPerText: number;
  metrics: ReturnType<typeof computeMetrics>;
}

async function benchmarkModel(
  model: string,
  displayName: string,
): Promise<ModelResult> {
  console.log(`\n  Embedding with ${displayName}...`);

  let embedResult: { embeddings: number[][]; latencyMs: number };
  try {
    embedResult = await embedTexts(ALL_TEXTS, model);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Model "${displayName}" failed: ${message}\n  Is it pulled? Run: ollama pull ${model}`);
  }

  const { embeddings, latencyMs } = embedResult;
  const dimensions = embeddings[0].length;
  const avgLatencyPerText = Math.round(latencyMs / ALL_TEXTS.length);
  const metrics = computeMetrics(embeddings);

  return { model, displayName, dimensions, latencyMs, avgLatencyPerText, metrics };
}

// ---------------------------------------------------------------------------
// Print results table
// ---------------------------------------------------------------------------
function printResults(results: ModelResult[]): void {
  console.log('\n');
  console.log('='.repeat(70));
  console.log('EMBEDDING MODEL COMPARISON RESULTS');
  console.log('='.repeat(70));

  for (const r of results) {
    console.log(`\nModel: ${r.displayName}`);
    console.log(`  Ollama ID         : ${r.model}`);
    console.log(`  Dimensions        : ${r.dimensions}`);
    console.log(`  Total latency     : ${r.latencyMs}ms (${ALL_TEXTS.length} texts)`);
    console.log(`  Avg latency/text  : ${r.avgLatencyPerText}ms`);
    console.log(`  Intra-A similarity: ${r.metrics.intraA.toFixed(4)} (RAG topic)`);
    console.log(`  Intra-B similarity: ${r.metrics.intraB.toFixed(4)} (Korean NLP topic)`);
    console.log(`  Intra avg         : ${r.metrics.intraAvg.toFixed(4)}`);
    console.log(`  Inter A-C sim     : ${r.metrics.interAC.toFixed(4)} (RAG vs weather)`);
    console.log(`  Inter B-C sim     : ${r.metrics.interBC.toFixed(4)} (NLP vs weather)`);
    console.log(`  Inter avg         : ${r.metrics.interAvg.toFixed(4)}`);
    console.log(`  Discrimination gap: ${r.metrics.discriminationGap.toFixed(4)} (higher = better)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('WINNER ANALYSIS');
  console.log('='.repeat(70));

  // Sort by discrimination gap descending
  const sorted = [...results].sort(
    (a, b) => b.metrics.discriminationGap - a.metrics.discriminationGap,
  );

  const winner = sorted[0];
  console.log(`\nBest discrimination : ${winner.displayName} (gap=${winner.metrics.discriminationGap.toFixed(4)})`);

  const fastest = [...results].sort((a, b) => a.avgLatencyPerText - b.avgLatencyPerText)[0];
  console.log(`Fastest             : ${fastest.displayName} (${fastest.avgLatencyPerText}ms/text)`);

  console.log('\nRecommendation:');
  if (winner.model === fastest.model) {
    console.log(`  ${winner.displayName} wins on both accuracy and speed.`);
  } else {
    console.log(`  ${winner.displayName} wins on accuracy (discrimination gap).`);
    console.log(`  ${fastest.displayName} wins on speed.`);
    console.log('  For Korean documents, prefer the higher-discrimination model unless latency is critical.');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const MODELS = [
  { id: 'nomic-embed-text', display: 'nomic-embed-text (default)' },
  { id: 'milkey-mouse/multilingual-e5:large', display: 'multilingual-e5-large' },
];

async function main(): Promise<void> {
  console.log('Mastra RAG Spike — embedding-comparison.ts');
  console.log('==========================================');
  console.log(`Ollama: ${OLLAMA_BASE_URL}`);
  console.log(`Corpus: ${ALL_TEXTS.length} Korean sentences across 3 topics`);

  const results: ModelResult[] = [];

  for (const { id, display } of MODELS) {
    try {
      const result = await benchmarkModel(id, display);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`\n  SKIPPED: ${message}`);
    }
  }

  if (results.length === 0) {
    console.error('\nNo models could be benchmarked. Check Ollama is running and models are pulled.');
    process.exit(1);
  }

  printResults(results);
  console.log('\nComparison complete.\n');
}

main();
