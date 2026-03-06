import { ChromaClient } from 'chromadb';

let instance: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (instance) return instance;

  const path = process.env.CHROMA_URL ?? 'http://localhost:8000';
  instance = new ChromaClient({ path });

  return instance;
}

/**
 * Releases the ChromaDB client instance.
 * ChromaDB HTTP client has no explicit close method; nulling the instance
 * allows GC to reclaim the object and drop pending HTTP keep-alives.
 */
export function closeChroma(): void {
  instance = null;
}
