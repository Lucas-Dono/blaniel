import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { getVeniceClient } from '@/lib/emotional-system/llm/venice';
import { z } from 'zod';
import { uploadImageFromDataUrl } from '@/lib/storage/cloud-storage';

const RequestSchema = z.object({
  description: z.string().min(10),
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary']).optional(),
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

    const { description, age, gender } = validation.data;

    // Mapear tier del usuario a formato de Venice
    const userTier = user.plan === 'FREE' ? 'free' : user.plan === 'PLUS' ? 'plus' : 'ultra';
    const model = userTier === 'free' ? 'z-image-turbo' : 'imagineart-1.5-pro';
    const cost = userTier === 'free' ? 0.01 : 0.05;

    console.log(`[Generate Avatar] Generating avatar with Venice (${model})...`);
    console.log(`[Generate Avatar] User tier: ${user.plan}, Cost: $${cost} per image`);

    // Generate avatar usando Venice AI con modelo tier-based
    const veniceClient = getVeniceClient();
    const result = await veniceClient.generateAvatar({
      description,
      age,
      gender,
      userTier,
    });

    console.log(`[Generate Avatar] ✅ Avatar generated in ${result.generationTime.toFixed(2)}s`);

    // Subir imagen al storage configurado (R2 en producción, local en desarrollo)
    const publicUrl = await uploadImageFromDataUrl(
      result.imageUrl,
      user.id,
      `avatar-${Date.now()}.png`
    );
    console.log(`[Generate Avatar] 💾 Stored at: ${publicUrl}`);

    return NextResponse.json({
      url: publicUrl,
      revisedPrompt: result.revisedPrompt,
      generationTime: result.generationTime,
      cost, // USD - tier-based ($0.01 FREE, $0.05 PLUS/ULTRA)
      model,
      userTier: user.plan,
    });
  } catch (error: any) {
    console.error('Error generating avatar:', error);
    return NextResponse.json(
      { error: 'Error al generar avatar', details: error.message },
      { status: 500 }
    );
  }
}
