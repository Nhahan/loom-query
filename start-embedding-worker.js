#!/usr/bin/env node

/**
 * Start the embedding processor worker
 * This script must be run in the project root with Node.js
 *
 * Usage: node start-embedding-worker.js
 */

const path = require('path');

// Register Next.js environment
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Use dynamic import to load ESM module
(async () => {
  try {
    console.log('[Embedding Worker] Starting...');
    console.log('[Embedding Worker] Redis connection: redis://localhost:6379');

    // Import the embedding processor
    const { startEmbeddingProcessor } = await import('./dist/lib/queue/embedding-processor.js');

    // Start the worker
    const worker = startEmbeddingProcessor();

    console.log('[Embedding Worker] ✓ Worker started successfully');
    console.log('[Embedding Worker] Listening for embedding jobs...');

    // Keep the process alive
    process.on('SIGTERM', async () => {
      console.log('[Embedding Worker] SIGTERM received, gracefully shutting down...');
      await worker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[Embedding Worker] SIGINT received, gracefully shutting down...');
      await worker.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('[Embedding Worker] Failed to start:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
