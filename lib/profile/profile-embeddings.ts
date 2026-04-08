/**
 * Pre-generación de Embeddings de Secciones del Profile
 *
 * Genera embeddings de cada sección del worldKnowledge una vez al crear el agente.
 * Esto permite búsqueda semántica rápida sin regenerar embeddings cada vez.
 */

import { prisma } from '@/lib/prisma';
import { generateOpenAIEmbedding } from '@/lib/memory/openai-embeddings';
import { KNOWLEDGE_COMMANDS } from './knowledge-retrieval';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProfileEmbeddings');

interface SectionEmbedding {
  command: string;
  embedding: number[];
  textSample: string; // Primeros 100 chars para debug
}

/**
 * Generar embeddings de todas las secciones del profile de un agente
 */
export async function generateProfileEmbeddings(agentId: string): Promise<void> {
  try {
    log.info({ agentId }, 'Generando embeddings de profile...');
    const startTime = Date.now();

    // Get semantic memory del agente
    const semanticMemory = await prisma.semanticMemory.findUnique({
      where: { agentId },
    });

    if (!semanticMemory?.worldKnowledge) {
      log.warn({ agentId }, 'No hay worldKnowledge para generar embeddings');
      return;
    }

    const worldKnowledge = semanticMemory.worldKnowledge as any;
    const embeddings: SectionEmbedding[] = [];

    // Generate embedding for each section
    for (const [commandKey, command] of Object.entries(KNOWLEDGE_COMMANDS)) {
      const sectionData = getSectionData(worldKnowledge, command);

      if (!sectionData || sectionData.trim().length === 0) {
        log.debug({ command }, 'Sección vacía, skipping');
        continue;
      }

      // Generate embedding
      const embedding = await generateOpenAIEmbedding(sectionData);

      embeddings.push({
        command,
        embedding,
        textSample: sectionData.substring(0, 100),
      });

      log.debug({ command, textLength: sectionData.length }, 'Embedding generado');
    }

    // Guardar embeddings en metadata de SemanticMemory
    await prisma.semanticMemory.update({
      where: { agentId },
      data: {
        metadata: {
          ...((semanticMemory.metadata as any) || {}),
          profileEmbeddings: embeddings,
          embeddingsGeneratedAt: new Date().toISOString(),
          embeddingModel: 'qwen3-0.6b-q8',
        },
      },
    });

    const totalTime = Date.now() - startTime;
    log.info(
      { agentId, count: embeddings.length, timeMs: totalTime },
      'Embeddings de profile generados exitosamente'
    );
  } catch (error) {
    log.error({ error, agentId }, 'Error generando embeddings de profile');
    throw error;
  }
}

/**
 * Obtener datos de una sección específica del worldKnowledge
 */
function getSectionData(worldKnowledge: any, command: string): string {
  switch (command) {
    case KNOWLEDGE_COMMANDS.FAMILY:
      return formatSectionText(worldKnowledge.family, 'familia');

    case KNOWLEDGE_COMMANDS.FRIENDS:
      return formatSectionText(worldKnowledge.socialCircle, 'amigos y relaciones');

    case KNOWLEDGE_COMMANDS.WORK:
      return formatSectionText(worldKnowledge.occupation, 'trabajo y estudios');

    case KNOWLEDGE_COMMANDS.INTERESTS:
      return formatSectionText(worldKnowledge.interests, 'intereses y gustos');

    case KNOWLEDGE_COMMANDS.PAST:
      return formatSectionText(worldKnowledge.lifeExperiences, 'experiencias pasadas');

    case KNOWLEDGE_COMMANDS.INNER:
      return formatSectionText(worldKnowledge.innerWorld, 'mundo interior');

    case KNOWLEDGE_COMMANDS.DAILY:
      return formatSectionText(
        { ...worldKnowledge.dailyRoutine, ...worldKnowledge.mundaneDetails },
        'rutina diaria'
      );

    case KNOWLEDGE_COMMANDS.MEMORIES:
      // For episodic memories, we would need to load them from the DB
      // For now, return general description
      return 'memories and important recollections of past events';

    default:
      return '';
  }
}

/**
 * Formatear sección a texto plano para embedding
 */
function formatSectionText(data: any, sectionName: string): string {
  if (!data) return '';

  // Convertir a JSON y luego a texto legible
  const jsonText = JSON.stringify(data, null, 2);

  // Agregar contexto para mejor embedding
  return `Información sobre ${sectionName}: ${jsonText}`;
}

/**
 * Verificar si un agente ya tiene embeddings generados
 */
export async function hasProfileEmbeddings(agentId: string): Promise<boolean> {
  const semanticMemory = await prisma.semanticMemory.findUnique({
    where: { agentId },
    select: { metadata: true },
  });

  const metadata = semanticMemory?.metadata as any;
  return !!(metadata?.profileEmbeddings && metadata.profileEmbeddings.length > 0);
}

/**
 * Obtener embeddings del profile de un agente
 */
export async function getProfileEmbeddings(agentId: string): Promise<SectionEmbedding[]> {
  const semanticMemory = await prisma.semanticMemory.findUnique({
    where: { agentId },
    select: { metadata: true },
  });

  const metadata = semanticMemory?.metadata as any;
  return metadata?.profileEmbeddings || [];
}

/**
 * Regenerar embeddings de profile (útil si se actualiza el profile)
 */
export async function regenerateProfileEmbeddings(agentId: string): Promise<void> {
  log.info({ agentId }, 'Regenerando embeddings de profile...');
  await generateProfileEmbeddings(agentId);
}
