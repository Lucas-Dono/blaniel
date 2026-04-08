/**
 * Script para listar todas las versiones del mod almacenadas en R2/S3
 *
 * Uso:
 * ```bash
 * npx tsx scripts/minecraft/list-mod-versions.ts
 * ```
 */

import { ModVersionService } from '@/lib/minecraft/mod-version-service';

async function main() {
  try {
    console.log('📦 Obteniendo versiones del mod...\n');

    const versions = await ModVersionService.listVersions();
    const stats = await ModVersionService.getDownloadStats();

    if (versions.length === 0) {
      console.log('⚠️  No hay versiones del mod almacenadas en el servidor.');
      console.log('   Para subir la primera versión, ejecuta:');
      console.log('   npx tsx scripts/minecraft/upload-initial-version.ts');
      process.exit(0);
    }

    console.log('📊 Estadísticas Generales:');
    console.log(`   Total de versiones: ${stats.totalVersions}`);
    console.log(`   Total de descargas: ${stats.totalDownloads}`);
    console.log(`   Versión actual: ${stats.latestVersion}`);
    console.log(`   Descargas de la versión actual: ${stats.latestDownloads}\n`);

    console.log('📋 Versiones Disponibles:\n');
    console.log('┌─────────────┬──────────────────────┬─────────────┬────────────┬──────────┬──────────┐');
    console.log('│ Versión     │ Fecha de Lanzamiento │ Tamaño      │ Descargas  │ Latest   │ Required │');
    console.log('├─────────────┼──────────────────────┼─────────────┼────────────┼──────────┼──────────┤');

    for (const version of versions) {
      const versionStr = version.version.padEnd(11);
      const dateStr = new Date(version.releaseDate)
        .toISOString()
        .split('T')[0]
        .padEnd(20);
      const sizeStr = formatBytes(Number(version.fileSize)).padEnd(11);
      const downloadsStr = version.downloadCount.toString().padEnd(10);
      const latestStr = (version.isLatest ? '✓' : '').padEnd(8);
      const requiredStr = (version.required ? '✓' : '').padEnd(8);

      console.log(
        `│ ${versionStr} │ ${dateStr} │ ${sizeStr} │ ${downloadsStr} │ ${latestStr} │ ${requiredStr} │`
      );
    }

    console.log('└─────────────┴──────────────────────┴─────────────┴────────────┴──────────┴──────────┘');

    console.log('\n💡 Comandos útiles:');
    console.log('   Subir nueva versión:     npx tsx scripts/minecraft/upload-mod-version.ts --jar ... --version ...');
    console.log('   Eliminar versión:        npx tsx scripts/minecraft/delete-mod-version.ts --version X.X.X');
    console.log('   Marcar como latest:      npx tsx scripts/minecraft/set-latest-version.ts --version X.X.X');
  } catch (error) {
    console.error('❌ Error al obtener versiones:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

main();
