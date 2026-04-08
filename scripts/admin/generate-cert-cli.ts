#!/usr/bin/env ts-node
/**
 * CLI para generar certificados admin
 * Usage: npm run admin:generate-cert -- <email> <device-name> [validity-hours]
 */

import { generateClientCertificate } from './cert-manager';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Uso: npm run admin:generate-cert -- <email> <device-name> [validity-hours]');
    console.error('   Ejemplo: npm run admin:generate-cert -- admin@ejemplo.com "MacBook Pro" 48');
    process.exit(1);
  }

  const [email, deviceName, validityHours = '48'] = args;

  try {
    const cert = await generateClientCertificate(
      email,
      deviceName,
      parseInt(validityHours, 10),
      false
    );

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ CERTIFICADO GENERADO EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log();
    console.log(`📁 Archivo PKCS12: ${cert.p12Path}`);
    console.log(`🔑 Password:       ${cert.p12Password}`);
    console.log(`⏰ Expira:         ${cert.expiresAt.toISOString()}`);
    console.log();

    // Detectar modo desarrollo
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
      console.log('🚀 MODO DESARROLLO - ACCESO SIMPLIFICADO');
      console.log('─────────────────────────────────────────────────────────');
      console.log();
      console.log('✅ Certificado guardado en la base de datos');
      console.log('✅ NO necesitas importar el .p12 en el navegador');
      console.log();
      console.log('📋 PRÓXIMOS PASOS:');
      console.log();
      console.log('1. Agrega a tu .env:');
      console.log(`   NEXT_PUBLIC_DEV_ADMIN_EMAIL="${email}"`);
      console.log('   NODE_ENV="development"');
      console.log();
      console.log('2. Inicia el servidor:');
      console.log('   npm run dev');
      console.log();
      console.log('3. Accede al admin:');
      console.log('   http://localhost:3000/admin');
      console.log();
      console.log('💡 El sistema detectará automáticamente tu certificado activo');
      console.log();
    } else {
      console.log('🔒 MODO PRODUCCIÓN - INSTALACIÓN REQUERIDA');
      console.log('─────────────────────────────────────────────────────────');
      console.log();
      console.log('📋 INSTRUCCIONES DE INSTALACIÓN:');
      console.log();
      console.log('1. Importar en Chrome/Edge:');
      console.log('   • chrome://settings/certificates');
      console.log('   • Pestaña "Tus certificados" → Importar');
      console.log(`   • Seleccionar: ${cert.p12Path}`);
      console.log(`   • Password: ${cert.p12Password}`);
      console.log();
      console.log('2. Importar en Firefox:');
      console.log('   • about:preferences#privacy');
      console.log('   • Ver certificados → Sus certificados → Importar');
      console.log(`   • Seleccionar: ${cert.p12Path}`);
      console.log(`   • Password: ${cert.p12Password}`);
      console.log();
      console.log('3. Acceder al admin:');
      console.log('   • https://tu-dominio.com:8443/admin');
      console.log();
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
