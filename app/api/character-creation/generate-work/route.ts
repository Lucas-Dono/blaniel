import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getLLMProvider } from '@/lib/llm/provider';
import { z } from 'zod';
import { withRetry } from '@/lib/utils/retry';
import { getVeniceClient, VENICE_MODELS } from '@/lib/emotional-system/llm/venice';

const RequestSchema = z.object({
  description: z.string().min(10),
  name: z.string().optional(),
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
  // Contexto existente (para refinar/expandir)
  existingOccupation: z.string().optional(),
  existingSkills: z.array(
    z.object({
      name: z.string(),
      level: z.number().min(0).max(100)
    })
  ).optional(),
  existingAchievements: z.array(z.string()).optional(),
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

    const { description, name, age, existingOccupation, existingSkills, existingAchievements } = validation.data;

    // Build existing context section
    let existingContext = '';
    if (existingOccupation) {
      existingContext += `\nOCUPACIÓN YA DEFINIDA: ${existingOccupation}\n(Usa esta ocupación, genera habilidades y logros coherentes)`;
    }
    if (existingSkills && existingSkills.length > 0) {
      const skillsList = existingSkills.map(s => `${s.name} (nivel ${s.level})`).join(', ');
      existingContext += `\nHABILIDADES YA DEFINIDAS: ${skillsList}\n(Respeta estas habilidades con sus niveles, puedes agregar más coherentes)`;
    }
    if (existingAchievements && existingAchievements.length > 0) {
      existingContext += `\nLOGROS YA DEFINIDOS: ${existingAchievements.join(', ')}\n(Respeta estos logros, agrega más coherentes)`;
    }

    const prompt = `Basándote en la siguiente descripción de un personaje, genera su perfil profesional.

DESCRIPCIÓN DEL PERSONAJE:
${description}
${name ? `Nombre: ${name}` : ''}
${age ? `Edad: ${age}` : ''}
${existingContext}

Genera el siguiente perfil profesional en formato JSON:

{
  "occupation": "Título profesional específico y realista",
  "skills": [
    {"name": "habilidad1", "level": 75},
    {"name": "habilidad2", "level": 60}
  ],
  "achievements": ["logro1", "logro2", "logro3"]
}

INSTRUCCIONES:
- Ocupación: Debe ser coherente con la edad y descripción
- Habilidades: 4-6 competencias específicas con niveles de proficiencia
  - level: 0-20 (Novato), 21-40 (Principiante), 41-60 (Intermedio), 61-80 (Avanzado), 81-100 (Experto)
  - Ajusta niveles según la edad y experiencia del personaje
- Logros: 2-4 logros profesionales concretos y medibles
${existingContext ? '- IMPORTANTE: Si hay información previa, REFINA y EXPANDE (no reemplaces). Mantén lo que el usuario ya definió y construye sobre ello.' : ''}

EJEMPLOS DE BUENAS HABILIDADES:
- "Gestión de proyectos ágiles"
- "Diseño UX/UI con Figma"
- "Análisis de datos con Python"

EJEMPLOS DE BUENOS LOGROS:
- "Lideró equipo que aumentó ventas 40% en 2023"
- "Publicó 3 artículos en revistas académicas"
- "Ganador del premio 'Innovación del Año 2022'"

Responde SOLO con el JSON válido, sin texto adicional.`;

    const llm = getLLMProvider();

    // Try with Gemini first, fallback to Venice if all retries fail
    let response: string;
    try {
      response = await withRetry(
        async () => {
          return await llm.generate({
            systemPrompt: 'Eres un experto en desarrollo profesional que crea perfiles de carrera realistas. Respondes siempre con JSON válido.',
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 15000,
            temperature: 0.7,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 2000,
          shouldRetry: (error) => {
            if (error.message?.includes('503') || error.message?.includes('500') || error.message?.includes('saturated')) {
              console.log('[Generate Work] Gemini saturated, retrying...');
              return true;
            }
            return false;
          },
          onRetry: (error, attempt) => {
            console.log(`[Generate Work] Retrying with Gemini (${attempt}/3):`, error.message);
          }
        }
      );
    } catch {
      // Fallback to Venice if Gemini fails
      console.warn('[Generate Work] ⚠️ Gemini failed, falling back to Venice...');

      const veniceClient = getVeniceClient();
      response = await veniceClient.generateWithMessages({
        systemPrompt: 'Eres un experto en desarrollo profesional que crea perfiles de carrera realistas. Respondes siempre con JSON válido.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 15000,
        model: VENICE_MODELS.DEFAULT,
      });

      console.log('[Generate Work] ✅ Fallback to Venice successful');
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
      console.error('[Generate Work] No se pudo extraer JSON. Respuesta limpiada:', cleanedResponse.substring(0, 500));
      throw new Error('No se pudo extraer JSON de la respuesta');
    }

    let jsonText = jsonMatch[0];

    // Limpiar trailing commas antes de } o ]
    jsonText = jsonText.replace(/,([\s]*[}\]])/g, '$1');

    const workData = JSON.parse(jsonText);

    return NextResponse.json(workData);
  } catch (error: any) {
    console.error('Error generating work profile:', error);
    return NextResponse.json(
      { error: 'Error al generar perfil profesional', details: error.message },
      { status: 500 }
    );
  }
}
