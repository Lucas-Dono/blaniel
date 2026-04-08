/**
 * Initialization of Intelligent Memory System
 *
 * With OpenAI embeddings, no need to pre-warm local models.
 * We just verify that the API key is configured.
 */

import { isOpenAIConfigured } from './openai-embeddings';
import { createLogger } from '@/lib/logger';

const log = createLogger('MemoryInit');

/**
 * Initialize memory system
 */
export async function initMemorySystem(): Promise<boolean> {
  try {
    log.info('Initializing intelligent memory system...');

    // Verify that OpenAI is configured
    if (!isOpenAIConfigured()) {
      log.error('OPENAI_API_KEY not configured');
      log.warn('Memory system will operate in degraded mode (keywords only, no embeddings)');
      return false;
    }

    log.info('Memory system initialized successfully');
    log.info('✅ Keyword search: ACTIVE');
    log.info('✅ Semantic search (OpenAI text-embedding-3-small): ACTIVE');
    log.info('✅ Selective storage: ACTIVE');

    return true;
  } catch (error) {
    log.error({ error }, 'Error initializing memory system');
    log.warn('System will operate in degraded mode (keywords only)');
    return false;
  }
}

/**
 * Display system statistics
 */
export function logMemorySystemStats(): void {
  const configured = isOpenAIConfigured();

  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info('📊 MEMORY SYSTEM STATUS');
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log.info(`OpenAI embeddings: ${configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
  log.info(`Model: text-embedding-3-small (1536 dimensions)`);
  log.info(`Keyword search: ✅ ACTIVE (PostgreSQL Full-Text Search)`);
  log.info(`Semantic search: ${configured ? '✅ ACTIVE' : '⚠️  DEGRADED MODE'}`);
  log.info(`Selective storage: ✅ ACTIVE`);
  log.info(`Cost: $0.02/M tokens (~$0.001 per average embedding)`);
  log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
