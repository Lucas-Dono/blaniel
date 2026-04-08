/**
 * Script para subir nuevas versiones del mod de Minecraft a R2/S3
 *
 * Uso:
 * ```bash
 * npx tsx scripts/minecraft/upload-mod-version.ts \
 *   --jar path/to/blaniel-mc-0.2.0.jar \
 *   --version 0.2.0 \
 *   --changelog "Nueva versión con mejoras..." \
 *   [--required] \
 *   [--minimum-version 0.1.0]
 * ```
 */

import { ModVersionService } from '@/lib/minecraft/mod-version-service';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);

  // Parsear argumentos
  const jarPath = getArg(args, '--jar');
  const version = getArg(args, '--version');
  const changelog = getArg(args, '--changelog');
  const required = args.includes('--required');
  const minimumVersion = getArg(args, '--minimum-version');

  // Validaciones
  if (!jarPath) {
    console.error('❌ Error: --jar es requerido');
    printUsage();
    process.exit(1);
  }

  if (!version) {
    console.error('❌ Error: --version es requerido');
    printUsage();
    process.exit(1);
  }

  if (!changelog) {
    console.error('❌ Error: --changelog es requerido');
    printUsage();
    process.exit(1);
  }

  // Validar que el archivo exista
  if (!fs.existsSync(jarPath)) {
    console.error(`❌ Error: El archivo ${jarPath} no existe`);
    process.exit(1);
  }

  // Validar que sea JAR
  if (!jarPath.endsWith('.jar')) {
    console.error('❌ Error: El archivo debe ser un JAR (.jar)');
    process.exit(1);
  }

  // Validar formato de versión
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
    console.error('❌ Error: Formato de versión inválido. Use semver (ej: 0.1.0)');
    process.exit(1);
  }

  // Leer archivo
  console.log(`\n📦 Leyendo archivo: ${jarPath}`);
  const jarBuffer = fs.readFileSync(jarPath);
  const fileSize = (jarBuffer.length / 1024).toFixed(2);
  console.log(`   Tamaño: ${fileSize} KB`);

  // Resumen
  console.log('\n📋 Resumen de la subida:');
  console.log(`   Versión: ${version}`);
  console.log(`   Tamaño: ${fileSize} KB`);
  console.log(`   Obligatoria: ${required ? 'Sí' : 'No'}`);
  if (minimumVersion) {
    console.log(`   Versión mínima: ${minimumVersion}`);
  }
  console.log(`\n   Changelog:`);
  console.log(`   ${changelog.split('\n').join('\n   ')}`);

  // Confirmar
  console.log('\n⚠️  ¿Continuar con la subida? (y/n)');
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question('', async (answer: string) => {
    readline.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Subida cancelada');
      process.exit(0);
    }

    try {
      console.log('\n🚀 Subiendo versión...');

      const result = await ModVersionService.uploadNewVersion({
        version,
        jarBuffer,
        changelog,
        required,
        minimumVersion,
      });

      console.log('\n✅ Versión subida exitosamente!');
      console.log(`   URL de descarga: ${result.downloadUrl}`);
      console.log(`   SHA-256: ${result.sha256}`);
      console.log(`   Fecha: ${result.releaseDate}`);
      console.log('\n📊 Estadísticas de descargas:');

      const stats = await ModVersionService.getDownloadStats();
      console.log(`   Total de versiones: ${stats.totalVersions}`);
      console.log(`   Total de descargas: ${stats.totalDownloads}`);

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error al subir la versión:', error);
      process.exit(1);
    }
  });
}

function getArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
}

function printUsage() {
  console.log(`
Uso:
  npx tsx scripts/minecraft/upload-mod-version.ts \\
    --jar path/to/blaniel-mc-X.X.X.jar \\
    --version X.X.X \\
    --changelog "Descripción de cambios..." \\
    [--required] \\
    [--minimum-version X.X.X]

Argumentos:
  --jar             Ruta al archivo JAR del mod (requerido)
  --version         Versión semver (ej: 0.1.0, 1.0.0-beta) (requerido)
  --changelog       Descripción de cambios en esta versión (requerido)
  --required        Marcar como actualización obligatoria (opcional)
  --minimum-version Versión mínima compatible (opcional)

Ejemplo:
  npx tsx scripts/minecraft/upload-mod-version.ts \\
    --jar Juego/Blaniel-MC/build/libs/blaniel-mc-0.2.0.jar \\
    --version 0.2.0 \\
    --changelog "Mejoras de rendimiento y corrección de bugs" \\
    --required
  `);
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
