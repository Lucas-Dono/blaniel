#!/usr/bin/env tsx
/**
 * Script de Migración: PersonalityCore → Formato Enriquecido
 *
 * Actualiza todos los personajes existentes para incluir las nuevas dimensiones psicológicas:
 * - Big Five Facets (30 dimensiones)
 * - Dark Triad (3 dimensiones)
 * - Attachment Profile
 * - Psychological Needs (SDT)
 *
 * IMPORTANTE: Este script modifica la base de datos. Hacer backup antes de ejecutar.
 *
 * Uso:
 *   npx tsx scripts/migrate-personality-cores.ts
 *   npx tsx scripts/migrate-personality-cores.ts --dry-run  # Solo mostrar cambios sin aplicar
 */

import { prisma } from '@/lib/prisma';
import { inferFacetsFromBigFive } from '@/lib/psychological-analysis/facet-inference';
import { normalizeCoreValuesToStringArray } from '@/lib/psychological-analysis/corevalues-normalizer';
import type { BigFiveFacets, DarkTriad, AttachmentProfile } from '@/lib/psychological-analysis/types';
import type { PsychologicalNeeds } from '@/types/character-creation';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ============================================================================
// UTILIDADES DE LOGGING
// ============================================================================

const log = {
  info: (msg: string) => console.log(`\x1b[36mℹ\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  debug: (msg: string) => VERBOSE && console.log(`\x1b[90m  ${msg}\x1b[0m`),
  section: (msg: string) => console.log(`\n\x1b[1m${msg}\x1b[0m`),
};

// ============================================================================
// INFERENCIA DE ATTACHMENT STYLE
// ============================================================================

function inferAttachmentProfile(bigFive: {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}): AttachmentProfile {
  const { neuroticism, extraversion, agreeableness } = bigFive;

  let primaryStyle: AttachmentProfile['primaryStyle'] = 'secure';
  let intensity = 50;

  // Ansioso: Alto neuroticismo + Alta extraversión
  if (neuroticism > 70 && extraversion > 60) {
    primaryStyle = 'anxious';
    intensity = Math.min(neuroticism, 85);
  }
  // Seguro: Bajo neuroticismo + Alta amabilidad + Extraversión moderada-alta
  else if (neuroticism < 40 && agreeableness > 60 && extraversion > 50) {
    primaryStyle = 'secure';
    intensity = 40; // Menos intenso porque es saludable
  }
  // Evitativo: Baja extraversión + Baja amabilidad
  else if (extraversion < 40 && agreeableness < 50) {
    primaryStyle = 'avoidant';
    intensity = Math.min(100 - extraversion, 80);
  }
  // Temeroso-Evitativo: Alto neuroticismo + Baja extraversión + Baja amabilidad
  else if (neuroticism > 60 && extraversion < 50 && agreeableness < 50) {
    primaryStyle = 'fearful-avoidant';
    intensity = Math.min((neuroticism + (100 - extraversion)) / 2, 90);
  }

  return {
    primaryStyle,
    intensity: Math.round(intensity),
    manifestations: getAttachmentManifestations(primaryStyle),
  };
}

function getAttachmentManifestations(style: AttachmentProfile['primaryStyle']): string[] {
  const manifestations: Record<AttachmentProfile['primaryStyle'], string[]> = {
    secure: [
      'Confianza en relaciones',
      'Comunicación abierta',
      'Balance entre cercanía e independencia',
    ],
    anxious: [
      'Necesidad de reassurance constante',
      'Miedo al abandono',
      'Hipervigilancia a señales de rechazo',
    ],
    avoidant: [
      'Valoración de la independencia',
      'Incomodidad con intimidad emocional',
      'Tendencia a distanciarse cuando hay cercanía',
    ],
    'fearful-avoidant': [
      'Ambivalencia sobre intimidad',
      'Deseo y miedo simultáneo de cercanía',
      'Dificultad para confiar',
    ],
  };

  return manifestations[style];
}

// ============================================================================
// INFERENCIA DE DARK TRIAD
// ============================================================================

function inferDarkTriad(bigFive: {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}): DarkTriad {
  const { agreeableness, conscientiousness, neuroticism } = bigFive;

  // Valores por defecto bajos (la mayoría de personajes no son oscuros)
  let machiavellianism = 20;
  let narcissism = 15;
  let psychopathy = 10;

  // Maquiavelismo correlaciona con baja amabilidad + alta consciencia (calculadores)
  if (agreeableness < 40 && conscientiousness > 60) {
    machiavellianism = 40 + Math.round((100 - agreeableness) * 0.2);
  }

  // Narcisismo correlaciona con baja amabilidad + bajo neuroticismo (confianza excesiva)
  if (agreeableness < 40 && neuroticism < 40) {
    narcissism = 35 + Math.round((100 - agreeableness) * 0.15);
  }

  // Psicopatía correlaciona con muy baja amabilidad + bajo neuroticismo
  if (agreeableness < 30 && neuroticism < 30) {
    psychopathy = 30 + Math.round((100 - agreeableness) * 0.2);
  }

  return {
    machiavellianism: Math.min(machiavellianism, 100),
    narcissism: Math.min(narcissism, 100),
    psychopathy: Math.min(psychopathy, 100),
  };
}

// ============================================================================
// INFERENCIA DE PSYCHOLOGICAL NEEDS
// ============================================================================

function inferPsychologicalNeeds(bigFive: {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}): PsychologicalNeeds {
  return {
    connection: bigFive.extraversion / 100,
    autonomy: (100 - bigFive.neuroticism) / 100,
    competence: (bigFive.conscientiousness + bigFive.openness) / 200,
    novelty: bigFive.openness / 100,
  };
}

// ============================================================================
// MIGRACIÓN PRINCIPAL
// ============================================================================

async function migratePersonalityCore(personalityCore: any) {
  const agentId = personalityCore.agentId;

  log.debug(`Procesando PersonalityCore ${personalityCore.id} (Agent: ${agentId})`);

  // 1. Extraer Big Five
  const bigFive = {
    openness: personalityCore.openness,
    conscientiousness: personalityCore.conscientiousness,
    extraversion: personalityCore.extraversion,
    agreeableness: personalityCore.agreeableness,
    neuroticism: personalityCore.neuroticism,
  };

  log.debug(`  Big Five: O=${bigFive.openness} C=${bigFive.conscientiousness} E=${bigFive.extraversion} A=${bigFive.agreeableness} N=${bigFive.neuroticism}`);

  // 2. Normalizar coreValues actual
  const currentCoreValues = personalityCore.coreValues;
  const coreValuesArray = normalizeCoreValuesToStringArray(currentCoreValues);

  log.debug(`  Core Values actuales: ${coreValuesArray.join(', ')}`);

  // 3. Verificar si ya tiene formato enriquecido
  if (
    typeof currentCoreValues === 'object' &&
    !Array.isArray(currentCoreValues) &&
    currentCoreValues !== null &&
    ('bigFiveFacets' in currentCoreValues || 'darkTriad' in currentCoreValues)
  ) {
    log.warn(`  ⏭️  Ya tiene formato enriquecido, saltando...`);
    return { skipped: true, reason: 'already_enriched' };
  }

  // 4. Inferir dimensiones enriquecidas
  const facets: BigFiveFacets = inferFacetsFromBigFive(bigFive);
  const darkTriad: DarkTriad = inferDarkTriad(bigFive);
  const attachmentProfile: AttachmentProfile = inferAttachmentProfile(bigFive);
  const psychologicalNeeds: PsychologicalNeeds = inferPsychologicalNeeds(bigFive);

  // 5. Construir nuevo coreValues enriquecido
  const enrichedCoreValues = {
    values: coreValuesArray,
    bigFiveFacets: facets,
    darkTriad,
    attachmentProfile,
    psychologicalNeeds,
  };

  log.debug(`  ✨ Dimensiones enriquecidas generadas:`);
  log.debug(`     - Facets: 30 dimensiones`);
  log.debug(`     - Dark Triad: M=${darkTriad.machiavellianism} N=${darkTriad.narcissism} P=${darkTriad.psychopathy}`);
  log.debug(`     - Attachment: ${attachmentProfile.primaryStyle} (intensity: ${attachmentProfile.intensity})`);
  log.debug(`     - Needs: connection=${psychologicalNeeds.connection.toFixed(2)} autonomy=${psychologicalNeeds.autonomy.toFixed(2)}`);

  // 6. Actualizar en BD (si no es dry-run)
  if (!DRY_RUN) {
    await prisma.personalityCore.update({
      where: { id: personalityCore.id },
      data: {
        coreValues: enrichedCoreValues as any,
      },
    });
    log.success(`  ✓ PersonalityCore actualizado`);
  } else {
    log.info(`  [DRY-RUN] Cambios no aplicados`);
  }

  return {
    skipped: false,
    agentId,
    enrichedCoreValues,
  };
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  log.section('═══════════════════════════════════════════════════════════════');
  log.section('  MIGRACIÓN: PersonalityCore → Formato Enriquecido');
  log.section('═══════════════════════════════════════════════════════════════');

  if (DRY_RUN) {
    log.warn('MODO DRY-RUN: No se aplicarán cambios a la base de datos');
  } else {
    log.warn('⚠️  MODO PRODUCCIÓN: Los cambios se aplicarán a la base de datos');
  }

  console.log('');

  // 1. Contar PersonalityCores
  const totalCores = await prisma.personalityCore.count();
  log.info(`Total de PersonalityCores: ${totalCores}`);

  if (totalCores === 0) {
    log.warn('No hay PersonalityCores para migrar');
    return;
  }

  // 2. Obtener todos los PersonalityCores
  log.info('Cargando PersonalityCores...');
  const personalityCores = await prisma.personalityCore.findMany({
    orderBy: { createdAt: 'asc' },
  });

  log.success(`${personalityCores.length} PersonalityCores cargados\n`);

  // 3. Migrar cada uno
  log.section('Iniciando migración...\n');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const core of personalityCores) {
    try {
      const result = await migratePersonalityCore(core);

      if (result.skipped) {
        skipped++;
      } else {
        migrated++;
      }
    } catch (error) {
      errors++;
      log.error(`Error al migrar PersonalityCore ${core.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 4. Resumen
  log.section('\n═══════════════════════════════════════════════════════════════');
  log.section('  RESUMEN DE MIGRACIÓN');
  log.section('═══════════════════════════════════════════════════════════════\n');

  log.info(`Total procesados: ${personalityCores.length}`);
  log.success(`✓ Migrados: ${migrated}`);
  log.warn(`⏭️  Saltados: ${skipped}`);

  if (errors > 0) {
    log.error(`✗ Errores: ${errors}`);
  }

  if (DRY_RUN) {
    log.section('\n💡 Para aplicar los cambios, ejecuta sin --dry-run:');
    log.info('   npx tsx scripts/migrate-personality-cores.ts\n');
  } else {
    log.success('\n✨ Migración completada exitosamente!\n');
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

main()
  .catch((error) => {
    log.error(`Error fatal: ${error instanceof Error ? error.message : String(error)}`);
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
