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
  existingOrigin: z.string().optional(),
  existingPhysicalDescription: z.string().optional(),
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

    const { description, name, age, gender, existingOrigin, existingPhysicalDescription } = validation.data;

    // Build existing context section
    let existingContext = '';
    if (existingOrigin) {
      existingContext += `\nORIGEN YA DEFINIDO: ${existingOrigin}\n(Usa este origen, no lo cambies)`;
    }
    if (existingPhysicalDescription) {
      existingContext += `\nDESCRIPCIÓN FÍSICA YA DEFINIDA: "${existingPhysicalDescription}"\n(Refina y expande esta descripción, mantén la esencia)`;
    }

    // Detectar si hay un nombre en la descripción
    const nameMatch = description.match(/(?:se llama|llamad[oa]|nombre es|es)\s+([A-ZÀÁÈÉÌÍÒÓÙÚÑ][a-zàáèéìíòóùúñ]+(?:\s+[A-ZÀÁÈÉÌÍÒÓÙÚÑ][a-zàáèéìíòóùúñ]+)*)/i);
    const detectedName = nameMatch ? nameMatch[1].trim() : null;

    let nameInstruction = '';
    if (detectedName) {
      // Nombre detectado en la descripción
      const hasLastName = detectedName.split(' ').length > 1;
      if (hasLastName) {
        nameInstruction = `CRÍTICO: La descripción menciona el nombre "${detectedName}". Usa EXACTAMENTE este nombre sin modificarlo. NO agregues segundos nombres ni apellidos adicionales.`;
      } else {
        nameInstruction = `CRÍTICO: La descripción menciona el nombre "${detectedName}" sin apellido. Usa este nombre de pila y agrégale SOLO un apellido apropiado (sin segundos nombres). Ejemplo: "${detectedName} García" o "${detectedName} Rodriguez".`;
      }
    } else {
      nameInstruction = 'Genera un nombre completo apropiado basado en el origen y contexto del personaje.';
    }

    const prompt = `Basándote en la siguiente descripción de un personaje, genera los datos de identidad básicos y extrae la descripción física/visual.

DESCRIPCIÓN DEL PERSONAJE:
${description}
${existingContext}

Genera SOLO los siguientes campos en formato JSON válido:
{
  "name": "Nombre del personaje",
  "age": número (edad realista),
  "gender": "male" | "female" | "non-binary",
  "origin": "Ciudad, país de origen realista",
  "physicalDescription": "Descripción SOLO de la apariencia física extraída de la descripción original"
}

INSTRUCCIONES PARA EL NOMBRE:
${nameInstruction}

OTRAS INSTRUCCIONES:
- La edad debe ser realista según la descripción (usa la edad mencionada si existe)
- El género debe inferirse de la descripción si es posible
- El origen debe ser específico (ciudad y país)
- physicalDescription: Extrae SOLO las características visuales/físicas mencionadas (altura, complexión, color de ojos, cabello, rasgos faciales, vestimenta). Si no hay descripción física en el texto original, genera una coherente basada en el nombre, edad y origen. Máximo 150 palabras, enfócate en lo visual.
${existingContext ? '- IMPORTANTE: Si hay información previa (origen o descripción física), RESPÉTALA y construye sobre ella. No reemplaces lo que ya existe.' : ''}

Responde SOLO con el JSON, sin texto adicional.`;

    const llm = getLLMProvider();

    // Try with Gemini first, fallback to Venice if all retries fail
    let response: string;
    try {
      response = await withRetry(
        async () => {
          return await llm.generate({
            systemPrompt: 'Eres un generador de datos de personajes realistas. Respondes siempre con JSON válido y datos coherentes.',
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
              console.log('[Generate Identity] Gemini saturated, retrying...');
              return true;
            }
            return false;
          },
          onRetry: (error, attempt) => {
            console.log(`[Generate Identity] Retrying with Gemini (${attempt}/3):`, error.message);
          }
        }
      );
    } catch {
      // Fallback to Venice if Gemini fails
      console.warn('[Generate Identity] ⚠️ Gemini failed, falling back to Venice...');

      const veniceClient = getVeniceClient();
      response = await veniceClient.generateWithMessages({
        systemPrompt: 'Eres un generador de datos de personajes realistas. Respondes siempre con JSON válido y datos coherentes.',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 15000,
        model: VENICE_MODELS.DEFAULT,
      });

      console.log('[Generate Identity] ✅ Fallback to Venice successful');
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
      console.error('[Generate Identity] No se pudo extraer JSON. Respuesta limpiada:', cleanedResponse.substring(0, 500));
      throw new Error('No se pudo extraer JSON de la respuesta');
    }

    let jsonText = jsonMatch[0];

    // Limpiar trailing commas antes de } o ]
    jsonText = jsonText.replace(/,([\s]*[}\]])/g, '$1');

    const identityData = JSON.parse(jsonText);

    return NextResponse.json(identityData);
  } catch (error: any) {
    console.error('Error generating identity:', error);
    return NextResponse.json(
      { error: 'Error al generar identidad', details: error.message },
      { status: 500 }
    );
  }
}
