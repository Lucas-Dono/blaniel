/**
 * Script para marcar una versión específica como "latest"
 *
 * Útil si quieres hacer rollback a una versión anterior.
 *
 * Uso:
 * ```bash
 * npx tsx scripts/minecraft/set-latest-version.ts --version 0.1.0
 * ```
 */

import { ModVersionService } from '@/lib/minecraft/mod-version-service';

async function main() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--version');

  if (versionIndex === -1 || versionIndex === args.length - 1) {
    console.error('❌ Error: --version es requerido');
    console.log('\nUso:');
    console.log('  npx tsx scripts/minecraft/set-latest-version.ts --version X.X.X');
    process.exit(1);
  }

  const version = args[versionIndex + 1];

  // Validar formato de versión
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
    console.error('❌ Error: Formato de versión inválido. Use semver (ej: 0.1.0)');
    process.exit(1);
  }

  try {
    console.log(`\n🔄 Obteniendo información actual...\n`);

    const currentLatest = await ModVersionService.getLatestVersion();

    if (currentLatest?.version === version) {
      console.log(`✅ La versión ${version} ya es la versión latest`);
      process.exit(0);
    }

    console.log('📋 Cambio de versión:');
    console.log(`   Actual:  ${currentLatest?.version || 'ninguna'}`);
    console.log(`   Nueva:   ${version}\n`);

    console.log('⚠️  ¿Continuar? Esto hará que todos los clientes descarguen esta versión. (y/n)');

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('', async (answer: string) => {
      readline.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('❌ Operación cancelada');
        process.exit(0);
      }

      try {
        console.log(`\n🔄 Marcando versión ${version} como latest...`);

        await ModVersionService.setLatestVersion(version);

        console.log(`✅ Versión ${version} es ahora la versión latest`);
        console.log('   Todos los clientes que verifiquen actualizaciones recibirán esta versión.\n');

        // Mostrar info actualizada
        const newLatest = await ModVersionService.getLatestVersion();

        if (newLatest) {
          console.log('📦 Información de la versión latest:');
          console.log(`   Versión:     ${newLatest.version}`);
          console.log(`   Fecha:       ${newLatest.releaseDate}`);
          console.log(`   Tamaño:      ${formatBytes(newLatest.fileSize)}`);
          console.log(`   Obligatoria: ${newLatest.required ? 'Sí' : 'No'}`);
        }

        process.exit(0);
      } catch (error) {
        console.error('\n❌ Error al marcar la versión:', error);

        if (error instanceof Error && error.message.includes('no existe')) {
          console.log(`\n💡 La versión ${version} no existe en el servidor.`);
          console.log('   Para ver las versiones disponibles, ejecuta:');
          console.log('   npx tsx scripts/minecraft/list-mod-versions.ts');
        }

        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
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

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
