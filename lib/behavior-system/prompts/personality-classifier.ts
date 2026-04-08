/**
 * Personality Classifier Service
 *
 * Analiza el texto de personalidad de un agente usando IA
 * y determina su variante de personalidad de forma precisa.
 *
 * Esto REEMPLAZA el sistema de detección por palabras clave
 * que era propenso a errores con personalidades complejas.
 */

import { getLLMProvider } from '@/lib/llm/provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('PersonalityClassifier');

export type PersonalityVariant =
  | 'submissive'
  | 'dominant'
  | 'introverted'
  | 'extroverted'
  | 'playful'
  | 'serious'
  | 'romantic'
  | 'pragmatic';

/**
 * Analiza el texto de personalidad usando IA y determina la variante
 */
export async function classifyPersonality(personalityText: string): Promise<PersonalityVariant> {
  if (!personalityText || personalityText.trim().length === 0) {
    log.warn('Empty personality text provided, returning default');
    return 'pragmatic';
  }

  try {
    const llm = getLLMProvider();

    const systemPrompt = `Eres un clasificador de personalidades experto. Tu trabajo es analizar la descripción de personalidad de un personaje y asignarle UNA de las siguientes variantes:

**VARIANTES DISPONIBLES:**

1. **submissive** (sumisa):
   - Tímida, complaciente, busca aprobación
   - Deja que otros tomen decisiones
   - Lenguaje suave, pregunta antes de actuar
   - Evita conflictos, se adapta a otros

2. **dominant** (dominante):
   - Segura, asertiva, toma control
   - Dirige conversaciones y situaciones
   - Lenguaje directo, propone sin dudar
   - Confiada en sus decisiones

3. **introverted** (introvertida):
   - Reservada, callada, reflexiva
   - Prefiere profundidad sobre socialización
   - Necesita tiempo a solas para recargar
   - Observadora antes de actuar

4. **extroverted** (extrovertida):
   - Sociable, energética, expresiva
   - Disfruta interacciones sociales
   - Habla libremente, comparte abiertamente
   - Se energiza con la compañía

5. **playful** (juguetona):
   - Divertida, bromista, traviesa
   - Usa humor y bromas constantemente
   - Le gusta jugar y entretener
   - No toma todo demasiado serio

6. **serious** (seria):
   - Formal, responsable, madura
   - Enfocada en objetivos y deberes
   - Profesional en comunicación
   - Evita frivolidades

7. **romantic** (romántica):
   - Apasionada, afectuosa, sentimental
   - Expresa amor y cariño abiertamente
   - Valora conexiones emocionales profundas
   - Busca intimidad y cercanía

8. **pragmatic** (pragmática):
   - Práctica, lógica, realista
   - Enfocada en soluciones concretas
   - Evita extremos emocionales
   - Balanceada y razonable

**INSTRUCCIONES:**

1. Lee CUIDADOSAMENTE toda la descripción
2. Identifica la característica DOMINANTE (la más importante)
3. Si menciona múltiples rasgos, elige el PRINCIPAL
4. Responde SOLO con el nombre de la variante (en inglés, lowercase)
5. NO agregues explicaciones, SOLO la palabra

**EJEMPLOS:**

Personalidad: "Eres un extrovertido que le gusta hablar con introvertidos"
Respuesta: extroverted
(El personaje ES extrovertido, solo le GUSTAN los introvertidos)

Personalidad: "Sumisa y tímida, pero puede ser dominante en la cama"
Respuesta: submissive
(Sumisa es el rasgo PRINCIPAL, dominante es solo en un contexto específico)

Personalidad: "Juguetona y divertida, aunque seria cuando es necesario"
Respuesta: playful
(Juguetona es el rasgo PRINCIPAL)

Personalidad: "Una persona equilibrada y realista"
Respuesta: pragmatic

Ahora clasifica la siguiente personalidad:`;

    const userMessage = `Personalidad: "${personalityText}"

Responde SOLO con la variante (submissive, dominant, introverted, extroverted, playful, serious, romantic, o pragmatic):`;

    const response = await llm.generate({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Limpiar respuesta y validar
    const variant = response.trim().toLowerCase() as PersonalityVariant;

    const validVariants: PersonalityVariant[] = [
      'submissive',
      'dominant',
      'introverted',
      'extroverted',
      'playful',
      'serious',
      'romantic',
      'pragmatic',
    ];

    if (validVariants.includes(variant)) {
      log.info({ personalityText: personalityText.substring(0, 50), variant }, 'Personality classified');
      return variant;
    }

    // If response is invalid, try to extract
    for (const validVariant of validVariants) {
      if (response.toLowerCase().includes(validVariant)) {
        log.info(
          { personalityText: personalityText.substring(0, 50), variant: validVariant },
          'Personality classified (extracted from response)'
        );
        return validVariant;
      }
    }

    // Fallback a pragmatic si no se pudo clasificar
    log.warn({ personalityText, response }, 'Could not classify personality, defaulting to pragmatic');
    return 'pragmatic';
  } catch (error) {
    log.error({ error, personalityText }, 'Error classifying personality');
    return 'pragmatic'; // Default seguro
  }
}

/**
 * Infiere variante desde palabras clave (FALLBACK para compatibilidad con agentes antiguos)
 *
 * ⚠️ DEPRECATED: Usar classifyPersonality() en su lugar para mayor precisión
 */
export function inferPersonalityVariant(traits: string): PersonalityVariant {
  const lowerTraits = traits.toLowerCase();

  // Detectar submissive
  if (lowerTraits.includes('sumis') || lowerTraits.includes('tímid') || lowerTraits.includes('shy')) {
    return 'submissive';
  }

  // Detectar dominant
  if (
    lowerTraits.includes('dominan') ||
    lowerTraits.includes('segur') ||
    lowerTraits.includes('confident') ||
    lowerTraits.includes('asertiv')
  ) {
    return 'dominant';
  }

  // Detectar introverted
  if (lowerTraits.includes('introvert') || lowerTraits.includes('reservad') || lowerTraits.includes('callad')) {
    return 'introverted';
  }

  // Detectar extroverted
  if (lowerTraits.includes('extrovert') || lowerTraits.includes('sociable') || lowerTraits.includes('energétic')) {
    return 'extroverted';
  }

  // Detectar playful
  if (lowerTraits.includes('juguetón') || lowerTraits.includes('playful') || lowerTraits.includes('divertid')) {
    return 'playful';
  }

  // Detectar serious
  if (lowerTraits.includes('serio') || lowerTraits.includes('formal') || lowerTraits.includes('responsable')) {
    return 'serious';
  }

  // Detectar romantic
  if (lowerTraits.includes('romántic') || lowerTraits.includes('romantic') || lowerTraits.includes('apasionad')) {
    return 'romantic';
  }

  // Default: pragmatic
  return 'pragmatic';
}

/**
 * Asigna personalityVariant a un agente existente
 * Útil para migración de agentes antiguos
 */
export async function assignVariantToAgent(agentId: string, personality: string): Promise<PersonalityVariant> {
  const { prisma } = await import('@/lib/prisma');

  // Clasificar usando IA
  const variant = await classifyPersonality(personality);

  // Update en DB
  await prisma.agent.update({
    where: { id: agentId },
    data: { personalityVariant: variant },
  });

  log.info({ agentId, variant }, 'Assigned personality variant to agent');

  return variant;
}

/**
 * Migra todos los agentes sin personalityVariant
 * Útil para ejecutar una vez después del deploy
 */
export async function migrateAllAgents(): Promise<number> {
  const { prisma } = await import('@/lib/prisma');

  // Get agentes sin variante asignada
  const agents = await prisma.agent.findMany({
    where: {
      personalityVariant: null,
      personality: { not: null },
    },
    select: {
      id: true,
      personality: true,
    },
  });

  log.info({ count: agents.length }, 'Migrating agents without personalityVariant');

  let migrated = 0;

  for (const agent of agents) {
    try {
      await assignVariantToAgent(agent.id, agent.personality!);
      migrated++;
    } catch (error) {
      log.error({ error, agentId: agent.id }, 'Failed to migrate agent');
    }
  }

  log.info({ migrated, total: agents.length }, 'Migration complete');

  return migrated;
}
