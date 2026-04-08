/**
 * GET /api/auth/sdk-callback
 *
 * Callback después del login exitoso
 * Genera código de autorización y redirige al SDK
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const codeChallenge = searchParams.get('code_challenge');

  if (!redirectUri || !state || !codeChallenge) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Verificar que el usuario esté autenticado
  const user = await getAuthenticatedUser(req);

  if (!user?.id) {
    return NextResponse.redirect(new URL('/auth/login', req.url));
  }

  // Generar código de autorización
  const authCode = nanoid(32);

  // Guardar código en la base de datos (válido por 10 minutos)
  await prisma.authorizationCode.create({
    data: {
      id: nanoid(),
      code: authCode,
      userId: user.id,
      clientId: 'sdk-cli',
      redirectUri,
      codeChallenge,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
    },
  });

  // Redirigir al SDK con el código
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', authCode);
  callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl.toString());
}
