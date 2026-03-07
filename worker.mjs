#!/usr/bin/env node

/**
 * Embedding Worker - Process document embeddings via BullMQ
 * Run with: node worker.mjs
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
import('dotenv').then(({ config }) => {
  config({ path: path.join(__dirname, '.env.local') });
  config({ path: path.join(__dirname, '.env') });
});

// Dynamic import to handle TypeScript files
async function runWorker() {
  try {
    // Configure Node to handle .ts imports via tsx
    console.log('Embedding Worker starting...');

    // Try importing via ESM with proper setup
    const module = await import('./src/lib/queue/embedding-processor.ts');
    const { startEmbeddingProcessor } = module;

    const worker = startEmbeddingProcessor();
    console.log('✓ Embedding processor worker started');
    console.log('Listening for embedding jobs on Redis...');

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await worker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await worker.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error starting worker:', error.message);
    process.exit(1);
  }
}

runWorker();
