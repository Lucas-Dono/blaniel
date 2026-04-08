/**
 * POST /api/auth/sdk-token
 *
 * Intercambia código de autorización por access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';
import * as crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, verifier, client_id, redirect_uri } = body;

    if (!code || !verifier || client_id !== 'sdk-cli') {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    // Buscar código de autorización
    const authCode = await prisma.authorizationCode.findFirst({
      where: {
        code,
        clientId: client_id,
        redirectUri: redirect_uri,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Verificar PKCE challenge
    const computedChallenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    if (computedChallenge !== authCode.codeChallenge) {
      return NextResponse.json(
        { error: 'Invalid code verifier' },
        { status: 400 }
      );
    }

    // Marcar código como usado
    await prisma.authorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });

    // Generar access token (válido por 30 días)
    const accessToken = nanoid(64);

    await prisma.sDKToken.create({
      data: {
        id: nanoid(),
        token: accessToken,
        userId: authCode.userId,
        clientId: client_id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      },
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 30 * 24 * 60 * 60, // 30 días en segundos
      user_id: authCode.userId,
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
