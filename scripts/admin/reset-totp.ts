#!/usr/bin/env ts-node
/**
 * Reset de TOTP para reconfiguración
 *
 * Usage: npm run admin:reset-totp -- <admin-email>
 */

import { prisma } from '@/lib/prisma';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Uso: npm run admin:reset-totp -- <admin-email>');
    process.exit(1);
  }

  const email = args[0];

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { AdminAccess: true }
    });

    if (!user || !user.AdminAccess) {
      console.error(`❌ Usuario ${email} no tiene acceso admin`);
      process.exit(1);
    }

    // Eliminar backup codes antiguos
    await prisma.adminBackupCode.deleteMany({
      where: { adminAccessId: user.AdminAccess.id }
    });

    // Eliminar TOTP secret
    await prisma.adminAccess.update({
      where: { id: user.AdminAccess.id },
      data: { totpSecret: null }
    });

    console.log('✅ TOTP reseteado exitosamente para:', email);
    console.log('📝 Ahora puedes ejecutar: npm run admin:setup-totp --', email);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
