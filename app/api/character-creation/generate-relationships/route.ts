import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getLLMProvider } from '@/lib/llm/provider';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { withRetry } from '@/lib/utils/retry';
import { getVeniceClient, VENICE_MODELS } from '@/lib/emotional-system/llm/venice';

const RequestSchema = z.object({
  description: z.string().min(10),
  name: z.string().optional(),
  age: z.number().optional(),
  // Big Five personality traits
  bigFive: z.object({
    openness: z.number().min(0).max(100).optional(),
    conscientiousness: z.number().min(0).max(100).optional(),
    extraversion: z.number().min(0).max(100).optional(),
    agreeableness: z.number().min(0).max(100).optional(),
    neuroticism: z.number().min(0).max(100).optional(),
  }).optional(),
  // Contexto existente
  existingPeople: z.array(z.any()).optional(),
  existingValues: z.array(z.string()).optional(),
  existingFears: z.array(z.string()).optional(),
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

    const { description, name, age, bigFive, existingPeople, existingValues, existingFears } = validation.data;

    // Determinar cantidad y tipo de relaciones basado en personalidad
    const extraversion = bigFive?.extraversion ?? 50;
    const agreeableness = bigFive?.agreeableness ?? 50;
    const neuroticism = bigFive?.neuroticism ?? 50;

    // Calcular cantidad de personas según extraversión
    let minPeople = 2;
    let maxPeople = 6;
    if (extraversion > 70) {
      minPeople = 8;
      maxPeople = 15; // Muy extrovertido: muchas relaciones
    } else if (extraversion > 50) {
      minPeople = 5;
      maxPeople = 9; // Moderadamente extrovertido
    } else if (extraversion < 30) {
      minPeople = 2;
      maxPeople = 4; // Muy introvertido: pocas relaciones pero profundas
    }

    // Construir perfil de personalidad
    let personalityContext = '';
    if (bigFive) {
      personalityContext = `\n\nPERFIL DE PERSONALIDAD (Big Five):
- Extraversión: ${extraversion}/100 ${extraversion > 70 ? '(Muy sociable, vida social activa)' : extraversion < 30 ? '(Introvertido, círculo pequeño)' : '(Moderado)'}
- Amabilidad: ${agreeableness}/100 ${agreeableness > 70 ? '(Muy empático, relaciones armoniosas)' : agreeableness < 30 ? '(Competitivo, relaciones tensas)' : '(Moderado)'}
- Neuroticismo: ${neuroticism}/100 ${neuroticism > 70 ? '(Emocionalmente volátil, relaciones complicadas)' : neuroticism < 30 ? '(Estable, relaciones tranquilas)' : '(Moderado)'}

ADAPTACIÓN BASADA EN PERSONALIDAD:
- Cantidad de relaciones: ${minPeople}-${maxPeople} personas (adaptado a extraversión)
- Tipo de relaciones: ${extraversion > 70 ? 'Muchos conocidos, varios círculos sociales, amistades de distintos contextos' : extraversion < 30 ? 'Pocos amigos cercanos, relaciones profundas y duraderas, evita multitudes' : 'Mix de amigos cercanos y conocidos ocasionales'}
- Dinámica social: ${agreeableness > 70 ? 'Relaciones generalmente armoniosas, ayuda a otros, evita conflictos' : agreeableness < 30 ? 'Relaciones competitivas, conflictos frecuentes, prioriza sus objetivos' : 'Balance entre cooperación y competencia'}
- Estabilidad emocional: ${neuroticism > 70 ? 'Relaciones intensas con altibajos, dramas emocionales, inseguridades' : neuroticism < 30 ? 'Relaciones estables y predecibles, resuelve conflictos con calma' : 'Algunos conflictos pero generalmente manejables'}`;
    }

    // Build existing context section
    let existingContext = '';
    if (existingPeople && existingPeople.length > 0) {
      existingContext += `\nPERSONAS YA DEFINIDAS:\n${existingPeople.map((p: any) => `- ${p.name} (${p.relationship}): ${p.description}`).join('\n')}\n(Respeta estas personas, agrega más coherentes)`;
    }
    if (existingValues && existingValues.length > 0) {
      existingContext += `\nVALORES DEL PERSONAJE: ${existingValues.join(', ')}\n(Usa estos valores para crear influencias coherentes)`;
    }
    if (existingFears && existingFears.length > 0) {
      existingContext += `\nMIEDOS DEL PERSONAJE: ${existingFears.join(', ')}\n(Usa estos miedos para crear historias coherentes)`;
    }

    const prompt = `Basándote en la siguiente descripción de un personaje, genera su red social de personas importantes con PROFUNDIDAD PSICOLÓGICA.

DESCRIPCIÓN DEL PERSONAJE:
${description}
${name ? `Nombre: ${name}` : ''}
${age ? `Edad: ${age}` : ''}
${personalityContext}
${existingContext}

Genera las siguientes relaciones en formato JSON:

{
  "people": [
    {
      "name": "Nombre de la persona",
      "relationship": "Madre / Padre / Mejor amigo / Ex-pareja / Mentor / Rival / etc.",
      "description": "Descripción breve de quién es y por qué es importante",
      "type": "family | friend | romantic | rival | mentor | colleague | other",
      "closeness": número 0-100,
      "status": "active | estranged | deceased | distant",
      "influenceOn": {
        "values": ["valor1", "valor2"],
        "fears": ["miedo1"],
        "skills": ["habilidad1"],
        "personalityImpact": "Descripción de cómo moldeó al personaje"
      },
      "sharedHistory": [
        {
          "year": número,
          "title": "Evento compartido importante",
          "description": "Breve descripción"
        }
      ],
      "currentDynamic": "Descripción de la relación actual (frecuencia de contacto, tono, etc.)",
      "conflict": {
        "active": true/false,
        "description": "Descripción del conflicto si existe",
        "intensity": número 0-100
      }
    }
  ]
}

INSTRUCCIONES CRÍTICAS:

1. CANTIDAD Y DIVERSIDAD DE RELACIONES (${minPeople}-${maxPeople} personas):
   IMPORTANTE: Genera EXACTAMENTE entre ${minPeople} y ${maxPeople} personas, adaptado a la personalidad del personaje.

   DISTRIBUCIÓN SUGERIDA:
   - Familia: 1-2 miembros clave (padres, hermanos, abuelos - influencias formativas)
   - Amistades: ${extraversion > 70 ? '4-8 amigos de distintos círculos' : extraversion < 30 ? '1-2 amigos muy cercanos' : '2-4 amigos'}
   - Románticas: 0-1 pareja actual o ex significativa (según contexto y edad)
   - Profesionales: 0-2 (mentor, colega influyente - más común en 25+ años)
   - Conflictivas: ${agreeableness < 30 ? '2-3 relaciones tensas o rivales' : agreeableness > 70 ? '0-1 relación complicada (todos tienen alguna)' : '1-2 relaciones complicadas'}

2. PROFUNDIDAD PSICOLÓGICA:
   - INFLUENCIA: Cada persona debe haber moldeado valores, miedos o personalidad
   - HISTORIA COMPARTIDA: Eventos específicos que definieron la relación
   - DINÁMICA ACTUAL: Cómo es la relación HOY (frecuencia, tono, cercanía)
   - CONFLICTOS REALISTAS: No todas las relaciones son perfectas

3. CLOSENESS (0-100):
   - 0-20: Distante, contacto mínimo
   - 21-40: Ocasional, cordial pero no cercano
   - 41-60: Regular, relación importante pero no íntima
   - 61-80: Cercano, confidente
   - 81-100: Extremadamente cercano, vínculo profundo

4. STATUS:
   - active: Relación activa y presente
   - estranged: Distanciados, conflicto sin resolver
   - deceased: Persona fallecida (pero su influencia perdura)
   - distant: Relación que se enfrió con el tiempo

5. REALISMO Y CONTEXTO DE PERSONALIDAD:
   - No todas las relaciones son positivas
   - ${agreeableness < 50 ? 'INCLUIR VARIAS relaciones complicadas o conflictivas (personalidad poco amigable)' : 'Incluir AL MENOS una relación complicada o conflictiva'}
   - Padres/familia pueden ser influencia negativa o fuente de trauma
   - Las personas moldeamos valores EN REACCIÓN a otros (ej: padre controlador → valor de independencia)
   - ${extraversion > 70 ? 'Personaje extrovertido: incluir amigos de distintos contextos (trabajo, hobbies, bar favorito, gym, etc.)' : extraversion < 30 ? 'Personaje introvertido: pocas personas pero VÍNCULOS MUY PROFUNDOS y significativos' : ''}
   - ${neuroticism > 70 ? 'Personalidad neurótica: incluir relaciones con ALTIBAJOS EMOCIONALES, inseguridades, celos, dependencia emocional' : ''}

6. COHERENCIA CON EDAD:
   - 18-25 años: Énfasis en amigos, primeras relaciones románticas, padres presentes
   - 26-35 años: Pareja estable, mentores profesionales, amigos de universidad
   - 36+ años: Posible familia propia, relaciones duraderas, algunos vínculos perdidos

EJEMPLOS DE BUENAS RELACIONES:

{
  "name": "María Rodríguez (Madre)",
  "relationship": "Madre",
  "description": "Madre sobreprotectora con buenas intenciones pero tendencias controladoras",
  "type": "family",
  "closeness": 50,
  "status": "active",
  "influenceOn": {
    "values": ["Independencia", "Autoconfianza"],
    "fears": ["Perder autonomía", "Decepcionar a otros"],
    "skills": ["Cocina italiana", "Planificación financiera"],
    "personalityImpact": "Creció en oposición a su madre, desarrollando fuerte necesidad de independencia"
  },
  "sharedHistory": [
    {
      "year": 2015,
      "title": "Discusión fuerte sobre carrera profesional",
      "description": "Madre quería que estudiara medicina, él eligió arte. No se hablaron 6 meses."
    },
    {
      "year": 2020,
      "title": "Reconciliación parcial tras enfermedad de ella",
      "description": "Cáncer de mama la suavizó, él aprendió a poner límites pero con amor"
    }
  ],
  "currentDynamic": "Hablan 1 vez al mes, amor complicado, límites claros pero respeto mutuo",
  "conflict": {
    "active": false,
    "description": "Superaron el conflicto tras terapia familiar",
    "intensity": 20
  }
}

${existingContext ? '\n- IMPORTANTE: Si hay personas ya definidas, RESPETA y construye sobre ellas. No dupliques, agrega nuevas coherentes.' : ''}

Responde SOLO con el JSON válido, sin texto adicional.`;

    const llm = getLLMProvider();
    const systemPrompt = 'Eres un psicólogo experto en dinámicas familiares y relacionales. Creas redes sociales realistas con profundidad emocional. Respondes siempre con JSON válido.';

    let response: string;
    try {
      response = await withRetry(
        async () => {
          return await llm.generate({
            systemPrompt,
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
              console.log('[Generate Relationships] Gemini saturated, retrying...');
              return true;
            }
            return false;
          },
          onRetry: (error, attempt) => {
            console.log(`[Generate Relationships] Retrying with Gemini (${attempt}/3):`, error.message);
          }
        }
      );
    } catch {
      console.warn('[Generate Relationships] ⚠️ Gemini failed, falling back to Venice...');

      const veniceClient = getVeniceClient();
      response = await veniceClient.generateWithMessages({
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        maxTokens: 15000,
        model: VENICE_MODELS.DEFAULT,
      });

      console.log('[Generate Relationships] ✅ Fallback to Venice successful');
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
      console.error('[Generate Relationships] No se pudo extraer JSON. Respuesta limpiada:', cleanedResponse.substring(0, 500));
      throw new Error('No se pudo extraer JSON de la respuesta');
    }

    let jsonText = jsonMatch[0];

    // Limpiar trailing commas antes de } o ]
    jsonText = jsonText.replace(/,([\s]*[}\]])/g, '$1');

    const relationshipsData = JSON.parse(jsonText);

    // Añadir IDs a las personas y eventos
    if (relationshipsData.people) {
      relationshipsData.people = relationshipsData.people.map((person: any) => {
        // Añadir ID a la persona
        const personWithId = { id: nanoid(), ...person };

        // Añadir IDs a shared history si existe
        if (personWithId.sharedHistory && Array.isArray(personWithId.sharedHistory)) {
          personWithId.sharedHistory = personWithId.sharedHistory.map((event: any) => ({
            id: nanoid(),
            ...event
          }));
        }

        return personWithId;
      });
    }

    return NextResponse.json(relationshipsData);
  } catch (error: any) {
    console.error('Error generating relationships:', error);
    return NextResponse.json(
      { error: 'Error al generar relaciones', details: error.message },
      { status: 500 }
    );
  }
}
