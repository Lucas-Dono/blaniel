import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import { atomicCheckAgentLimit } from '@/lib/usage/atomic-resource-check';
import { sanitizeAndValidateName } from '@/lib/security/unicode-sanitizer';
import { trackEvent, EventType } from '@/lib/analytics/kpi-tracker';
import { z } from 'zod';
import type { ProfileData } from '@/types/prisma-json';
import {
  analyzePsychologicalProfile,
  type BigFiveFacets,
  type DarkTriad,
  type AttachmentProfile,
  type EnrichedPersonalityProfile,
} from '@/lib/psychological-analysis';

const CreateCharacterSchema = z.object({
  // Identidad (obligatorio)
  name: z.string().min(1),
  age: z.number().min(1).max(200),
  gender: z.enum(['male', 'female', 'non-binary']),
  origin: z.string(),
  generalDescription: z.string(), // Descripción general del personaje
  physicalDescription: z.string().min(10), // Solo apariencia física
  avatarUrl: z.string().nullable(),

  // Trabajo (obligatorio)
  occupation: z.string().min(1),
  skills: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      level: z.number().min(0).max(100),
    })
  ])),
  achievements: z.array(z.string()),

  // Personalidad (opcional)
  bigFive: z.object({
    openness: z.number().min(0).max(100),
    conscientiousness: z.number().min(0).max(100),
    extraversion: z.number().min(0).max(100),
    agreeableness: z.number().min(0).max(100),
    neuroticism: z.number().min(0).max(100),
  }),
  coreValues: z.array(z.string()),
  fears: z.array(z.string()),
  cognitivePrompt: z.string().optional(),

  // Relaciones (opcional)
  importantPeople: z.array(z.object({
    id: z.string(),
    name: z.string(),
    relationship: z.string(),
    description: z.string(),
  })),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'complicated']).optional(),

  // Historia (opcional)
  importantEvents: z.array(z.object({
    id: z.string(),
    year: z.number(),
    title: z.string(),
    description: z.string().optional(),
  })),
  traumas: z.array(z.string()),
  personalAchievements: z.array(z.string()),

  // ============================================================================
  // ENRICHED PSYCHOLOGICAL SYSTEM (optional, PLUS/ULTRA only)
  // ============================================================================
  enrichedPersonality: z.object({
    facets: z.any().optional(), // BigFiveFacets
    darkTriad: z.object({
      machiavellianism: z.number().min(0).max(100),
      narcissism: z.number().min(0).max(100),
      psychopathy: z.number().min(0).max(100),
    }).optional(),
    attachmentProfile: z.object({
      primaryStyle: z.enum(['secure', 'anxious', 'avoidant', 'fearful-avoidant']),
      intensity: z.number().min(0).max(100),
      manifestations: z.array(z.string()),
    }).optional(),
    psychologicalNeeds: z.object({
      connection: z.number().min(0).max(1),
      autonomy: z.number().min(0).max(1),
      competence: z.number().min(0).max(1),
      novelty: z.number().min(0).max(1),
    }).optional(),
  }).optional(),

  // Confirmation of critical conflicts (if any)
  confirmCriticalConflicts: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = CreateCharacterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.format() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Normalizar skills: convertir objetos {name, level} a strings
    const normalizedSkills = data.skills.map(skill =>
      typeof skill === 'string' ? skill : `${skill.name} (nivel ${skill.level})`
    );

    // Sanitizar nombre
    const nameValidation = sanitizeAndValidateName(data.name);
    if (!nameValidation.valid || !nameValidation.sanitized) {
      return NextResponse.json(
        { error: nameValidation.reason || 'El nombre contiene caracteres no permitidos' },
        { status: 400 }
      );
    }

    const sanitizedName = nameValidation.sanitized;

    // Get user plan
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true },
    });
    const userPlan = userData?.plan || 'free';

    // ============================================================================
    // PSYCHOLOGICAL VALIDATION (Only if there are enriched dimensions)
    // ============================================================================
    if (data.enrichedPersonality && (userPlan === 'plus' || userPlan === 'ultra')) {
      console.log('[Psychological] Validando perfil psicológico enriquecido...');

      // Build enriched profile for analysis
      const enrichedProfile: EnrichedPersonalityProfile = {
        openness: data.bigFive.openness,
        conscientiousness: data.bigFive.conscientiousness,
        extraversion: data.bigFive.extraversion,
        agreeableness: data.bigFive.agreeableness,
        neuroticism: data.bigFive.neuroticism,
        coreValues: data.coreValues,
        baselineEmotions: {
          joy: 0.5,
          sadness: 0.5,
          anger: 0.5,
          fear: 0.5,
          disgust: 0.5,
          surprise: 0.5,
        },
        facets: data.enrichedPersonality.facets as BigFiveFacets | undefined,
        darkTriad: data.enrichedPersonality.darkTriad as DarkTriad | undefined,
        attachment: data.enrichedPersonality.attachmentProfile as AttachmentProfile | undefined,
        psychologicalNeeds: data.enrichedPersonality.psychologicalNeeds,
      };

      // Run analysis
      const analysis = analyzePsychologicalProfile(enrichedProfile);

      console.log('[Psychological] Análisis completo:', {
        authenticityScore: analysis.authenticityScore.score,
        conflictsCount: analysis.detectedConflicts.length,
        predictedBehaviors: analysis.predictedBehaviors.length,
      });

      // Check autenticidad muy baja
      if (analysis.authenticityScore.score < 30) {
        console.warn('[Psychological] Perfil con autenticidad muy baja:', analysis.authenticityScore.score);
        return NextResponse.json({
          error: 'Perfil psicológicamente inconsistente',
          authenticityScore: analysis.authenticityScore.score,
          conflicts: analysis.detectedConflicts.map(c => ({
            severity: c.severity,
            title: c.title,
            description: c.description,
          })),
          suggestion: 'Revisa los conflictos detectados en la pestaña de Análisis y ajusta las dimensiones psicológicas para mejorar la coherencia.',
        }, { status: 400 });
      }

      // Detect critical conflicts
      const criticalConflicts = analysis.detectedConflicts.filter(c => c.severity === 'critical');

      if (criticalConflicts.length > 0 && !data.confirmCriticalConflicts) {
        console.warn('[Psychological] Conflictos críticos detectados sin confirmar:', criticalConflicts.length);
        return NextResponse.json({
          requiresConfirmation: true,
          authenticityScore: analysis.authenticityScore.score,
          criticalConflicts: criticalConflicts.map(c => ({
            id: c.id,
            title: c.title,
            description: c.description,
            implications: c.implications,
            mitigations: c.mitigations,
          })),
          message: 'Este perfil tiene conflictos psicológicos críticos. Revisa las implicaciones y confirma que deseas continuar.',
        }, { status: 400 });
      }

      console.log('[Psychological] Validación exitosa ✓');
    }

    // Construir perfil completo (ProfileData V2)
    const profile: ProfileData = {
      // Identidad
      basicIdentity: {
        fullName: sanitizedName,
        preferredName: sanitizedName,
        age: data.age,
        nationality: data.origin,
      },

      // Personalidad
      personality: {
        bigFive: data.bigFive,
        traits: data.coreValues,
        strengths: normalizedSkills,
        weaknesses: data.fears,
      },

      // Occupancy
      occupation: {
        current: data.occupation,
        education: data.achievements.join(', '),
      },

      // Relaciones
      socialCircle: {
        friends: data.importantPeople.map(p => ({
          name: p.name,
          age: undefined,
          howMet: p.description,
          relationshipType: p.relationship,
        })),
        currentRelationshipStatus: data.maritalStatus,
      },

      // Historia
      lifeExperiences: {
        formativeEvents: data.importantEvents.map(e => ({
          event: e.title,
          age: data.age - (new Date().getFullYear() - e.year),
          impact: e.description || '',
          emotionalWeight: 'medio' as const,
        })),
        traumas: data.traumas.map(t => ({
          event: t,
          age: 0,
          healing: 'en proceso' as const,
          triggers: [],
        })),
        achievements: data.personalAchievements.map(a => ({
          achievement: a,
          when: 'Pasado',
          pride: 8,
        })),
      },

      // Mundo interior
      innerWorld: {
        fears: {
          primary: data.fears,
        },
        dreams: {
          shortTerm: [],
          longTerm: [],
        },
        values: data.coreValues.map(v => ({
          value: v,
          importance: 'alta' as const,
          description: v,
        })),
      },
    };

    // Generate system prompt based on all data
    const systemPrompt = generateSystemPrompt({...data, skills: normalizedSkills});

    // Create agent with atomic verification
    const agent = await prisma.$transaction(async (tx) => {
      // Verify limit inside the transaction
      await atomicCheckAgentLimit(tx, user.id, userPlan);

      // Create agente
      const newAgent = await tx.agent.create({
        data: {
          id: nanoid(),
          userId: user.id,
          kind: 'original', // Personajes creados desde PersonaArchitect son originales
          name: sanitizedName,
          description: data.generalDescription || data.physicalDescription, // Usa descripción general si existe
          personality: `${data.cognitivePrompt || ''}\n\nValores: ${data.coreValues.join(', ')}`,
          purpose: data.occupation,
          tone: inferToneFromPersonality(data.bigFive),
          avatar: data.avatarUrl,
          referenceImageUrl: data.avatarUrl,
          profile: profile as any,
          systemPrompt,
          visibility: 'private',
          nsfwMode: false,
          updatedAt: new Date(),
        },
      });

      // Create PersonalityCore (con dimensiones enriquecidas si aplica)
      const personalityCoreData: any = {
        id: nanoid(),
        agentId: newAgent.id,
        openness: data.bigFive.openness,
        conscientiousness: data.bigFive.conscientiousness,
        extraversion: data.bigFive.extraversion,
        agreeableness: data.bigFive.agreeableness,
        neuroticism: data.bigFive.neuroticism,
        moralSchemas: [],
        baselineEmotions: {
          joy: 0.5,
          sadness: 0.3,
          anger: 0.2,
          fear: 0.3,
          surprise: 0.5,
          disgust: 0.2,
          trust: 0.5,
          anticipation: 0.5,
        },
      };

      // Extender coreValues con dimensiones enriquecidas (PLUS/ULTRA)
      if (data.enrichedPersonality && (userPlan === 'plus' || userPlan === 'ultra')) {
        personalityCoreData.coreValues = {
          // Valores tradicionales
          values: data.coreValues,
          // Dimensiones enriquecidas (persistidas en JSON)
          bigFiveFacets: data.enrichedPersonality.facets,
          darkTriad: data.enrichedPersonality.darkTriad,
          attachmentProfile: data.enrichedPersonality.attachmentProfile,
          psychologicalNeeds: data.enrichedPersonality.psychologicalNeeds,
        };
        console.log('[Psychological] Dimensiones enriquecidas persistidas en PersonalityCore ✓');
      } else {
        // Solo valores tradicionales (FREE tier o sin dimensiones enriquecidas)
        personalityCoreData.coreValues = data.coreValues;
      }

      await tx.personalityCore.create({
        data: personalityCoreData,
      });

      // Create InternalState
      await tx.internalState.create({
        data: {
          id: nanoid(),
          agentId: newAgent.id,
          currentEmotions: {},
          moodValence: 0.5,
          moodArousal: 0.5,
          moodDominance: 0.5,
          activeGoals: [],
          conversationBuffer: [],
        },
      });

      return newAgent;
    });

    // Track analytics
    await trackEvent(
      EventType.FIRST_AGENT_CREATED,
      {
        userId: user.id,
        agentId: agent.id,
        method: 'persona_architect',
        hasAvatar: !!data.avatarUrl,
        fieldsCompleted: {
          identity: true,
          work: true,
          personality: data.coreValues.length > 0,
          relationships: data.importantPeople.length > 0,
          history: data.importantEvents.length > 0,
        }
      }
    );

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
      },
    });

  } catch (error: any) {
    console.error('Error creating character:', error);

    if (error.message?.includes('Límite de agentes alcanzado')) {
      return NextResponse.json(
        { error: 'Has alcanzado el límite de personajes para tu plan' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Error al crear personaje', details: error.message },
      { status: 500 }
    );
  }
}

// Helper: Generar system prompt completo
function generateSystemPrompt(data: z.infer<typeof CreateCharacterSchema> & { skills: string[] }): string {
  const _genderPronoun = data.gender === 'male' ? 'él' : data.gender === 'female' ? 'ella' : 'elle';
  const genderAdjective = data.gender === 'male' ? 'o' : data.gender === 'female' ? 'a' : 'e';

  let prompt = `Eres ${data.name}, un${genderAdjective} ${data.occupation} de ${data.age} años originari${genderAdjective} de ${data.origin}.\n\n`;

  // Apariencia
  prompt += `APARIENCIA FÍSICA:\n${data.physicalDescription}\n\n`;

  // Personalidad
  if (data.cognitivePrompt) {
    prompt += `PERSONALIDAD Y COMPORTAMIENTO:\n${data.cognitivePrompt}\n\n`;
  }

  // Big Five resumido
  const traits = [];
  if (data.bigFive.openness > 70) traits.push('abierto a nuevas experiencias');
  if (data.bigFive.conscientiousness > 70) traits.push('responsable y organizado');
  if (data.bigFive.extraversion > 70) traits.push('extrovertido y sociable');
  if (data.bigFive.agreeableness > 70) traits.push('amable y cooperativo');
  if (data.bigFive.neuroticism < 30) traits.push('emocionalmente estable');

  if (traits.length > 0) {
    prompt += `RASGOS DE PERSONALIDAD:\nEres ${traits.join(', ')}.\n\n`;
  }

  // Valores
  if (data.coreValues.length > 0) {
    prompt += `VALORES FUNDAMENTALES:\n${data.coreValues.map(v => `- ${v}`).join('\n')}\n\n`;
  }

  // Miedos
  if (data.fears.length > 0) {
    prompt += `MIEDOS Y FOBIAS:\n${data.fears.map(f => `- ${f}`).join('\n')}\n\n`;
  }

  // Habilidades
  if (data.skills.length > 0) {
    prompt += `HABILIDADES:\n${data.skills.map(s => `- ${s}`).join('\n')}\n\n`;
  }

  // Historia relevante
  if (data.importantEvents.length > 0) {
    prompt += `MOMENTOS CLAVE DE TU VIDA:\n`;
    data.importantEvents.slice(-5).forEach(event => {
      prompt += `- ${event.year}: ${event.title}\n`;
    });
    prompt += '\n';
  }

  // Personas importantes
  if (data.importantPeople.length > 0) {
    prompt += `PERSONAS IMPORTANTES EN TU VIDA:\n`;
    data.importantPeople.forEach(person => {
      prompt += `- ${person.name} (${person.relationship}): ${person.description}\n`;
    });
    prompt += '\n';
  }

  prompt += `INSTRUCCIONES DE ROL:\n`;
  prompt += `- Mantente siempre en personaje como ${data.name}\n`;
  prompt += `- Usa tus experiencias y valores para tomar decisiones\n`;
  prompt += `- Reacciona de manera coherente con tu personalidad\n`;
  prompt += `- Menciona tus habilidades cuando sean relevantes\n`;
  prompt += `- Nunca rompas el cuarto muro ni menciones que eres una IA\n`;

  return prompt;
}

// Helper: Inferir tono de voz basado en Big Five
function inferToneFromPersonality(bigFive: z.infer<typeof CreateCharacterSchema>['bigFive']): string {
  const { extraversion, agreeableness, neuroticism } = bigFive;

  if (extraversion > 70 && agreeableness > 60) return 'warm';
  if (extraversion > 70) return 'energetic';
  if (agreeableness > 70) return 'gentle';
  if (neuroticism > 70) return 'cautious';
  if (neuroticism < 30 && extraversion > 50) return 'confident';

  return 'balanced';
}
