#!/usr/bin/env ts-node
/**
 * Setup de TOTP (Time-based One-Time Password) para Admin
 * Configura Google Authenticator / Authy
 *
 * Usage: npm run admin:setup-totp -- <admin-email>
 */

import * as speakeasy from 'speakeasy';
import * as qrcodeTerminal from 'qrcode-terminal';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { encrypt, randomBytes } from '@/lib/admin/crypto';

async function generateBackupCodes(adminAccessId: string): Promise<string[]> {
  const codes: string[] = [];

  for (let i = 0; i < 5; i++) {
    // Generar código de 16 caracteres (4 grupos de 4)
    const code = `${randomBytes(2)}-${randomBytes(2)}-${randomBytes(2)}-${randomBytes(2)}`.toUpperCase();
    codes.push(code);

    // Guardar hash en BD
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.adminBackupCode.create({
      data: {
        id: nanoid(),
        adminAccessId,
        codeHash,
      }
    });
  }

  return codes;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Uso: npm run admin:setup-totp -- <admin-email>');
    console.error('   Ejemplo: npm run admin:setup-totp -- admin@ejemplo.com');
    process.exit(1);
  }

  const email = args[0];

  try {
    // 1. Buscar o crear AdminAccess
    let user = await prisma.user.findUnique({
      where: { email },
      include: { AdminAccess: true }
    });

    if (!user) {
      console.error(`❌ Usuario ${email} no existe`);
      process.exit(1);
    }

    let adminAccess = user.AdminAccess;

    // Si no tiene AdminAccess, crearlo
    if (!adminAccess) {
      console.log('📝 Creando acceso admin...');
      adminAccess = await prisma.adminAccess.create({
        data: {
          id: nanoid(),
          updatedAt: new Date(),
          userId: user.id,
          role: 'admin',
          enabled: true,
        }
      });
      console.log('✅ Acceso admin creado');
    }

    // Si ya tiene TOTP configurado, avisar
    if (adminAccess.totpSecret) {
      console.log('⚠️  TOTP ya está configurado para este usuario');
      console.log('   Si quieres reconfigurarlo, primero elimina el secret de la BD');
      process.exit(1);
    }

    console.log();
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         SETUP DE TOTP - AUTENTICACIÓN DE DOS FACTORES        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log();

    // 2. Generar secret TOTP
    console.log('🔐 Generando secret TOTP...');
    const secret = speakeasy.generateSecret({
      name: `Creador IA Admin (${email})`,
      issuer: 'Creador Inteligencias',
      length: 32,
    });

    // 3. Cifrar secret y guardar en BD
    const encryptedSecret = encrypt(secret.base32);
    await prisma.adminAccess.update({
      where: { id: adminAccess.id },
      data: { totpSecret: encryptedSecret }
    });

    // 4. Generar backup codes
    console.log('🔑 Generando backup codes...');
    const backupCodes = await generateBackupCodes(adminAccess.id);

    // 5. Log de auditoría
    await prisma.auditLog.create({
      data: {
        id: nanoid(),
        adminAccessId: adminAccess.id,
        action: 'totp.setup',
        targetType: 'AdminAccess',
        targetId: adminAccess.id,
        ipAddress: 'localhost',
        userAgent: 'setup-totp-cli',
      }
    });

    // 6. Mostrar información
    console.log();
    console.log('✅ TOTP CONFIGURADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log('📱 ESCANEA ESTE QR CON TU APLICACIÓN DE AUTENTICACIÓN:');
    console.log('   (Google Authenticator, Authy, etc.)');
    console.log();

    // Generar QR directamente en la terminal
    qrcodeTerminal.generate(secret.otpauth_url!, { small: true });

    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log('⌨️  O INTRODUCE MANUALMENTE:');
    console.log(`   Secret: ${secret.base32}`);
    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log('🔑 BACKUP CODES (Por si pierdes el móvil):');
    console.log('   ⚠️  Guárdalos en un lugar seguro (password manager, papel)');
    console.log('   ⚠️  Cada código solo se puede usar UNA VEZ');
    console.log();
    backupCodes.forEach((code, i) => {
      console.log(`   ${i + 1}. ${code}`);
    });
    console.log();
    console.log('═══════════════════════════════════════════════════════════════');
    console.log();
    console.log('✅ Setup completado para:', email);
    console.log();
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('   1. Escanear QR con tu app de autenticación');
    console.log('   2. Guardar backup codes en lugar seguro');
    console.log('   3. Generar certificado: npm run admin:generate-cert -- <email> <device>');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
