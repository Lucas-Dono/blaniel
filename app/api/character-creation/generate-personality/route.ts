import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getLLMProvider } from '@/lib/llm/provider';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { inferFacetsFromBigFive } from '@/lib/psychological-analysis';
import { withRetry } from '@/lib/utils/retry';
import { getVeniceClient, VENICE_MODELS } from '@/lib/emotional-system/llm/venice';

const RequestSchema = z.object({
  description: z.string().min(10),
  name: z.string().optional(),
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
  // Contexto existente (para refinar/expandir)
  existingValues: z.array(z.string()).optional(),
  existingFears: z.array(z.string()).optional(),
  existingCognitivePrompt: z.string().optional(),
  // Historia para personalityEvolution
  traumas: z.array(z.string()).optional(),
  importantEvents: z.array(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { description, name, age, gender, existingValues, existingFears, existingCognitivePrompt, traumas, importantEvents } = validation.data;

    // Build existing context section
    let existingContext = '';
    if (existingValues && existingValues.length > 0) {
      existingContext += `\nVALORES YA DEFINIDOS: ${existingValues.join(', ')}\n(Expande y refina estos valores, no los reemplaces)`;
    }
    if (existingFears && existingFears.length > 0) {
      existingContext += `\nMIEDOS YA DEFINIDOS: ${existingFears.join(', ')}\n(Expande y refina estos miedos, no los reemplaces)`;
    }
    if (existingCognitivePrompt) {
      existingContext += `\nESTILO COGNITIVO YA DEFINIDO: "${existingCognitivePrompt}"\n(Expande y profundiza esta descripción, mantén la esencia)`;
    }

    // Contexto de historia para personalityEvolution
    let historyContext = '';
    if (traumas && traumas.length > 0) {
      historyContext += `\nTRAUMAS: ${traumas.join(', ')}`;
    }
    if (importantEvents && importantEvents.length > 0) {
      historyContext += `\nEVENTOS IMPORTANTES:\n${importantEvents.map((e: any) => `- ${e.year}: ${e.title}`).join('\n')}`;
    }
    const shouldGenerateEvolution = age && age > 20 && (traumas?.length || importantEvents?.length);

    const prompt = `Basándote en la siguiente descripción de un personaje, genera un perfil psicológico completo y realista con CONTRADICCIONES INTERNAS (lo que hace humano al personaje).

DESCRIPCIÓN DEL PERSONAJE:
${description}
${name ? `Nombre: ${name}` : ''}
${age ? `Edad: ${age}` : ''}
${gender ? `Género: ${gender}` : ''}
${existingContext}

Genera el siguiente perfil psicológico en formato JSON:

{
  "bigFive": {
    "openness": número 0-100,
    "conscientiousness": número 0-100,
    "extraversion": número 0-100,
    "agreeableness": número 0-100,
    "neuroticism": número 0-100
  },
  "values": ["valor1", "valor2", "valor3"],
  "fears": ["miedo1", "miedo2"],
  "cognitivePrompt": "Descripción de 2-3 frases sobre cómo piensa, procesa información y se comporta este personaje",
  "moralAlignment": {
    "lawfulness": número 0-100,
    "morality": número 0-100
  },
  "internalContradictions": [
    {
      "trait": "Rasgo o comportamiento principal",
      "butAlso": "Rasgo o comportamiento contradictorio",
      "trigger": "Qué desencadena esta contradicción (opcional)",
      "manifestation": "Cómo se manifiesta esta contradicción en la vida real"
    }
  ],
  "situationalVariations": [
    {
      "context": "En el trabajo / Con familia / Con desconocidos / etc.",
      "personalityShift": {
        "extraversion": número (si es diferente del base),
        "conscientiousness": número (si es diferente del base)
      },
      "description": "Descripción de cómo cambia en este contexto"
    }
  ]${shouldGenerateEvolution ? `,
  "personalityEvolution": {
    "snapshots": [
      {
        "age": número (edad pasada),
        "bigFive": { "openness": número, "conscientiousness": número, etc. },
        "moment": "Descripción del momento (ej: 'Adolescencia - Pre-trauma')",
        "descriptor": "Estado mental en ese momento",
        "trigger": "Evento o razón del cambio (opcional para el primero)"
      }
    ],
    "currentTrajectory": "Descripción de la tendencia actual (ej: 'Recuperación ascendente')"
  }` : ''}
}

INSTRUCCIONES:
- Big Five debe ser coherente con la descripción (0=muy bajo, 50=promedio, 100=muy alto)
- Valores: 3-5 principios fundamentales que guían al personaje
- Miedos: 2-4 temores profundos realistas
- cognitivePrompt: Describe patrones de pensamiento, sesgos cognitivos, estilo de razonamiento
- moralAlignment:
  - lawfulness: 0 (Caótico) - 50 (Neutral) - 100 (Legal). Respeta reglas vs improvisa
  - morality: 0 (Malvado) - 50 (Neutral) - 100 (Bueno). Altruista vs egoísta
  - Ejemplos: Lawful Good (80, 85), Chaotic Neutral (20, 50), Neutral Evil (50, 15)

- CONTRADICCIONES INTERNAS (1-3): Las personas reales tienen paradojas
  - Ejemplos: "Organizado en trabajo, caótico en casa", "Extrovertido social pero ansioso en intimidad", "Racional pero toma decisiones emocionales"
  - Estas contradicciones NO son defectos, son lo que hace HUMANO al personaje
  - Deben ser realistas y coherentes con la descripción

- VARIACIONES SITUACIONALES (1-3): La personalidad cambia según contexto
  - Ejemplos: Extraversion alta en trabajo (75) pero baja con familia (30)
  - Solo incluye rasgos que REALMENTE cambian significativamente (diferencia de 20+ puntos)
  - Describe POR QUÉ cambia (necesidad profesional, compartimentalización, etc.)

${shouldGenerateEvolution ? `\n- EVOLUCIÓN DE PERSONALIDAD (CRÍTICO): Genera 2-4 snapshots temporales
  ${historyContext}
  - Crea snapshots en momentos clave de vida (adolescencia, post-trauma, actualidad, etc.)
  - Los traumas DEBEN afectar Neuroticism (+10 a +30 típicamente)
  - Eventos positivos pueden reducir Neuroticism o aumentar otros rasgos
  - La personalidad ACTUAL (en bigFive principal) debe ser el último snapshot
  - Ejemplo: trauma severo → Neuroticism de 40 a 75, Extraversion de 70 a 45
  - Ejemplo: terapia exitosa → Neuroticism de 80 a 50, recovery trajectory
  - Describe currentTrajectory: "Recuperación", "Estable", "Declive", etc.` : ''}

${existingContext ? '- IMPORTANTE: Si hay información previa, REFINA y EXPANDE (no reemplaces). Mantén la esencia de lo que el usuario ya definió.' : ''}

Responde SOLO con el JSON válido, sin texto adicional.`;

    const llm = getLLMProvider();

    // Try with Gemini first, fallback to Venice if all retries fail
    let response: string;
    try {
      response = await withRetry(
        async () => {
          return await llm.generate({
            systemPrompt: 'Eres un psicólogo experto que crea perfiles de personalidad realistas basados en el modelo Big Five. Respondes siempre con JSON válido.',
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 15000,
            temperature: 0.8,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => {
            if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('saturated')) {
              console.log('[Generate Personality] Gemini saturated, retrying...');
              return true;
            }
            return false;
          },
          onRetry: (error, attempt) => {
            console.log(`[Generate Personality] Retrying with Gemini (${attempt}/3):`, error.message);
          }
        }
      );
    } catch {
      // Fallback to Venice if Gemini fails
      console.warn('[Generate Personality] ⚠️ Gemini failed, falling back to Venice...');

      const veniceClient = getVeniceClient();
      response = await veniceClient.generateWithMessages({
        systemPrompt: 'Eres un psicólogo experto que crea perfiles de personalidad realistas basados en el modelo Big Five. Respondes siempre con JSON válido.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 15000,
        model: VENICE_MODELS.DEFAULT,
      });

      console.log('[Generate Personality] ✅ Fallback to Venice successful');
    }

    // Post-procesamiento: Limpiar artefactos del modelo antes de parsear JSON
    let cleanedResponse = response.trim();

    // Delete markdown code blocks si existen
    cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Delete comentarios de JavaScript (// y /* */)
    cleanedResponse = cleanedResponse.replace(/\/\/.*$/gm, ''); // Single-line comments
    cleanedResponse = cleanedResponse.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments

    // Parse JSON response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Generate Personality] No se pudo extraer JSON. Respuesta limpiada:', cleanedResponse.substring(0, 500));
      throw new Error('No se pudo extraer JSON de la respuesta');
    }

    let jsonText = jsonMatch[0];

    // Limpiar trailing commas antes de } o ]
    jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

    const personalityData = JSON.parse(jsonText);

    // Validate rangos de Big Five
    Object.keys(personalityData.bigFive).forEach(trait => {
      const value = personalityData.bigFive[trait];
      if (value < 0 || value > 100) {
        personalityData.bigFive[trait] = Math.max(0, Math.min(100, value));
      }
    });

    // Añadir IDs a contradicciones internas
    if (personalityData.internalContradictions) {
      personalityData.internalContradictions = personalityData.internalContradictions.map((contradiction: any) => ({
        id: nanoid(),
        ...contradiction
      }));
    }

    // Añadir IDs a snapshots de personalityEvolution
    if (personalityData.personalityEvolution?.snapshots) {
      personalityData.personalityEvolution.snapshots = personalityData.personalityEvolution.snapshots.map((snapshot: any) => ({
        id: nanoid(),
        ...snapshot
      }));
    }

    // ============================================================================
    // SISTEMA PSICOLÓGICO ENRIQUECIDO (Solo PLUS/ULTRA)
    // ============================================================================

    // Get plan del usuario para determinar tier
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true },
    });
    const userPlan = userData?.plan || 'free';

    // Solo generar dimensiones enriquecidas para PLUS y ULTRA
    if (userPlan === 'plus' || userPlan === 'ultra') {
      console.log(`[Psychological] Generando dimensiones enriquecidas para tier ${userPlan.toUpperCase()}`);

      // 1. Inferir facetas desde Big Five
      const facets = inferFacetsFromBigFive(personalityData.bigFive);
      personalityData.facets = facets;

      // 2. Inicializar Dark Triad en valores bajos (usuario puede ajustar)
      personalityData.darkTriad = {
        machiavellianism: 20,
        narcissism: 15,
        psychopathy: 10,
      };

      // 3. Inferir estilo de apego desde Big Five y Neuroticism
      let attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'fearful-avoidant' = 'secure';
      let attachmentIntensity = 50;

      const { neuroticism, extraversion, agreeableness } = personalityData.bigFive;

      if (neuroticism > 70 && extraversion > 60) {
        attachmentStyle = 'anxious';
        attachmentIntensity = Math.min(neuroticism, 85);
      } else if (neuroticism < 40 && agreeableness > 60 && extraversion > 50) {
        attachmentStyle = 'secure';
        attachmentIntensity = 40; // Seguro es menos "intenso"
      } else if (extraversion < 40 && agreeableness < 50) {
        attachmentStyle = 'avoidant';
        attachmentIntensity = Math.min(100 - extraversion, 80);
      } else if (neuroticism > 60 && extraversion < 50 && agreeableness < 50) {
        attachmentStyle = 'fearful-avoidant';
        attachmentIntensity = Math.min(neuroticism + (100 - extraversion), 90) / 2;
      }

      personalityData.attachmentProfile = {
        primaryStyle: attachmentStyle,
        intensity: Math.round(attachmentIntensity),
        manifestations: [],
      };

      // 4. Inicializar necesidades psicológicas SDT (valores balanceados)
      personalityData.psychologicalNeeds = {
        connection: extraversion / 100, // 0-1
        autonomy: (100 - neuroticism) / 100,
        competence: (personalityData.bigFive.conscientiousness + personalityData.bigFive.openness) / 200,
        novelty: personalityData.bigFive.openness / 100,
      };

      console.log('[Psychological] Dimensiones enriquecidas generadas:', {
        facets: '30 facetas inferidas',
        darkTriad: personalityData.darkTriad,
        attachment: `${attachmentStyle} (${attachmentIntensity})`,
        needs: personalityData.psychologicalNeeds,
      });
    } else {
      console.log('[Psychological] Tier FREE - Solo Big Five básico');
    }

    return NextResponse.json(personalityData);
  } catch (error: any) {
    console.error('Error generating personality:', error);
    return NextResponse.json(
      { error: 'Error al generar personalidad', details: error.message },
      { status: 500 }
    );
  }
}
