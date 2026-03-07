import { logger } from './logger';

/**
 * MastraClient - Ollama-based RAG client for document embedding
 */
export interface MastraClient {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Implementation using Ollama HTTP API
 */
class OllamaClient implements MastraClient {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      // Use AbortController for fetch timeout (30 seconds per request)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { embeddings?: number[][] };

      if (!Array.isArray(data.embeddings)) {
        throw new Error('Invalid embedding response: missing embeddings array');
      }

      if (data.embeddings.length === 0) {
        throw new Error('Empty embedding received from Ollama');
      }

      // Ollama returns embeddings as an array, get the first one for single input
      return data.embeddings[0];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Embedding failed', {
        text: text.substring(0, 100),
        model: this.model,
        error: message,
      });
      throw new Error(`Failed to embed text: ${message}`);
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    try {
      // Use AbortController for fetch timeout (45 seconds for batch - longer than single)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { embeddings?: number[][] };

      if (!Array.isArray(data.embeddings)) {
        throw new Error('Invalid batch embedding response: missing embeddings array');
      }

      if (data.embeddings.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: expected ${texts.length}, got ${data.embeddings.length}`
        );
      }

      return data.embeddings;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Batch embedding failed', {
        textCount: texts.length,
        model: this.model,
        error: message,
      });
      throw new Error(`Failed to embed batch: ${message}`);
    }
  }
}

let instance: MastraClient | null = null;

/**
 * Get or create the Mastra/Ollama client singleton
 *
 * Environment variables:
 * - OLLAMA_BASE_URL: Ollama server URL (default: http://localhost:11434)
 * - OLLAMA_EMBEDDING_MODEL: Embedding model name (default: nomic-embed-text)
 */
export function getMastraClient(): MastraClient {
  if (instance) return instance;

  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

  instance = new OllamaClient(baseUrl, model);

  logger.info('Mastra client initialized', {
    type: 'Ollama',
    baseUrl,
    model,
  });

  return instance;
}

/**
 * Close the client (release resources)
 */
export function closeMastra(): void {
  instance = null;
}
