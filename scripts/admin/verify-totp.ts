#!/usr/bin/env ts-node
/**
 * Verifica un código TOTP contra la BD
 * Usage: node verify-totp.ts <email> <token>
 * Returns: "true" o "false"
 */

import * as speakeasy from 'speakeasy';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/admin/crypto';

async function verifyTOTP(email: string, token: string): Promise<boolean> {
  try {
    // 1. Obtener admin
    const admin = await prisma.user.findUnique({
      where: { email },
      include: { AdminAccess: true }
    });

    if (!admin?.AdminAccess) {
      return false;
    }

    if (!admin.AdminAccess.enabled) {
      return false;
    }

    if (!admin.AdminAccess.totpSecret) {
      return false;
    }

    // 2. Descifrar secret TOTP
    const secret = decrypt(admin.AdminAccess.totpSecret);

    // 3. Verificar token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Permite 1 step antes/después (30s margen total 90s)
    });

    return verified;

  } catch (error) {
    console.error('Error verificando TOTP:', error);
    return false;
  }
}

async function main() {
  const [email, token] = process.argv.slice(2);

  if (!email || !token) {
    console.log('false');
    process.exit(1);
  }

  const isValid = await verifyTOTP(email, token);
  console.log(isValid ? 'true' : 'false');
  process.exit(isValid ? 0 : 1);
}

main();
