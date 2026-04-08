import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getVeniceClient } from '@/lib/emotional-system/llm/venice';
import { canUseResource, trackUsage } from '@/lib/usage/tracker';
import { z } from 'zod';

const RequestSchema = z.object({
  prompt: z.string().min(5).max(1000),
});

/**
 * POST /api/character-creation/enhance-prompt
 *
 * Mejora un prompt narrativo a keywords optimizadas para generación de imágenes.
 *
 * Límites por tier:
 * - FREE: 2/día
 * - PLUS: 10/día
 * - ULTRA: 30/día
 *
 * Usa Qwen 3 4B ($0.15/M output, $0.05/M input) - muy económico
 */
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

    const { prompt } = validation.data;

    // Check límites de uso por tier
    const usageCheck = await canUseResource(user.id, 'prompt_enhancement', 1);

    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Límite diario de mejoras de prompt alcanzado',
          current: usageCheck.current,
          limit: usageCheck.limit,
          plan: user.plan,
          upgradeMessage: user.plan === 'FREE'
            ? 'Actualiza a PLUS para 10 mejoras/día o ULTRA para 30 mejoras/día'
            : 'Límite diario alcanzado. Se reinicia en 24 horas.',
        },
        { status: 429 }
      );
    }

    console.log(`[Prompt Enhancer] User: ${user.id}, Plan: ${user.plan}, Limit: ${usageCheck.limit}/día`);
    console.log(`[Prompt Enhancer] Current usage: ${usageCheck.current}/${usageCheck.limit}`);
    console.log(`[Prompt Enhancer] Original prompt: ${prompt}`);

    const startTime = Date.now();

    // Mejorar prompt con Qwen 3 4B
    const veniceClient = getVeniceClient();
    const enhancedPrompt = await veniceClient.enhanceImagePrompt(prompt);

    const processingTime = (Date.now() - startTime) / 1000;

    // Trackear uso
    await trackUsage(user.id, 'prompt_enhancement', 1);

    console.log(`[Prompt Enhancer] ✅ Enhanced in ${processingTime.toFixed(2)}s`);
    console.log(`[Prompt Enhancer] Enhanced prompt: ${enhancedPrompt}`);

    return NextResponse.json({
      original: prompt,
      enhanced: enhancedPrompt,
      processingTime,
      usageInfo: {
        used: (usageCheck.current || 0) + 1,
        dailyLimit: usageCheck.limit,
        remaining: (usageCheck.limit || 0) - (usageCheck.current || 0) - 1,
        plan: user.plan,
      },
    });
  } catch (error: any) {
    console.error('Error enhancing prompt:', error);
    return NextResponse.json(
      { error: 'Error al mejorar el prompt', details: error.message },
      { status: 500 }
    );
  }
}
