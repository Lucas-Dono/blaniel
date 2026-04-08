/**
 * Script para subir la versión inicial 0.1.0 del mod a R2/S3
 *
 * Esto debe ejecutarse UNA SOLA VEZ para migrar del sistema
 * de GitHub al servidor propio.
 */

import { ModVersionService } from '@/lib/minecraft/mod-version-service';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function main() {
  console.log('🔍 Buscando JAR de la versión 0.1.0...\n');

  // Buscar el JAR en el directorio de build
  const jarPattern = 'Juego/Blaniel-MC/build/libs/blaniel-mc-0.1.0*.jar';
  const matches = await glob(jarPattern, { cwd: process.cwd() });

  if (matches.length === 0) {
    console.error('❌ No se encontró el JAR de la versión 0.1.0');
    console.error('   Asegúrate de haber compilado el mod primero:');
    console.error('   cd Juego/Blaniel-MC && ./gradlew build');
    process.exit(1);
  }

  // Filtrar archivo sources
  const jarPath = matches.find((m) => !m.includes('sources'));

  if (!jarPath) {
    console.error('❌ No se encontró el JAR principal (sin sources)');
    process.exit(1);
  }

  const fullPath = path.join(process.cwd(), jarPath);
  console.log(`✅ Encontrado: ${jarPath}\n`);

  // Leer archivo
  const jarBuffer = fs.readFileSync(fullPath);
  const fileSize = (jarBuffer.length / 1024).toFixed(2);

  console.log('📋 Información de la versión:');
  console.log(`   Versión: 0.1.0`);
  console.log(`   Archivo: ${jarPath}`);
  console.log(`   Tamaño: ${fileSize} KB\n`);

  const changelog = `# Versión 0.1.0 - Lanzamiento Inicial

## Nuevas Características
- ✨ Sistema de conversation scripts con versionado automático
- 🎭 Detección automática de grupos sociales
- 💾 Caché persistente de guiones conversacionales
- 🔄 Auto-actualización de scripts sin reiniciar
- 🗣️ Conversaciones estructuradas completas (saludo → despedida)
- 🔄 Sistema de auto-actualización del mod desde el servidor

## Mejoras
- ⚡ Timers locales para reproducción de guiones (sin HTTP requests)
- 📦 Sistema de caché en disco + memoria
- 🎯 Detección inteligente de NPCs cercanos

## Correcciones
- 🐛 Corrección de memory leaks en conversation players
- 🔧 Mejora de rendimiento en detección de grupos

## Infraestructura
- 🌐 Descarga de actualizaciones desde servidor propio (Cloudflare R2)
- 🔒 Verificación SHA-256 de integridad del archivo
- 📊 Tracking de descargas y estadísticas

---
**Nota:** Esta actualización requiere reiniciar Minecraft.`;

  console.log('📝 Changelog:');
  console.log(changelog.split('\n').map(line => `   ${line}`).join('\n'));

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
      console.log('\n🚀 Subiendo versión 0.1.0 a R2/S3...');

      const result = await ModVersionService.uploadNewVersion({
        version: '0.1.0',
        jarBuffer,
        changelog,
        required: false,
        minimumVersion: '0.1.0',
      });

      console.log('\n✅ Versión 0.1.0 subida exitosamente!');
      console.log(`   URL de descarga: ${result.downloadUrl}`);
      console.log(`   SHA-256: ${result.sha256}`);
      console.log(`   Tamaño: ${result.fileSize} bytes (${fileSize} KB)`);
      console.log(`   Fecha: ${result.releaseDate}`);

      console.log('\n📊 Estadísticas:');
      const stats = await ModVersionService.getDownloadStats();
      console.log(`   Total de versiones: ${stats.totalVersions}`);
      console.log(`   Total de descargas: ${stats.totalDownloads}`);

      console.log('\n✅ Migración completada!');
      console.log('   El mod ahora se descargará desde tu servidor en lugar de GitHub.');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error al subir la versión:', error);

      if (error instanceof Error && error.message.includes('ya existe')) {
        console.log('\n💡 La versión 0.1.0 ya existe en el servidor.');
        console.log('   Si quieres reemplazarla, primero elimínala:');
        console.log('   npx tsx scripts/minecraft/delete-mod-version.ts --version 0.1.0');
      }

      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
