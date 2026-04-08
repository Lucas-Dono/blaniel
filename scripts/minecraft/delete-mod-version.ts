/**
 * Script para eliminar una versión del mod de R2/S3 y la base de datos
 *
 * Uso:
 * ```bash
 * npx tsx scripts/minecraft/delete-mod-version.ts --version 0.1.0
 * ```
 */

import { ModVersionService } from '@/lib/minecraft/mod-version-service';

async function main() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--version');

  if (versionIndex === -1 || versionIndex === args.length - 1) {
    console.error('❌ Error: --version es requerido');
    console.log('\nUso:');
    console.log('  npx tsx scripts/minecraft/delete-mod-version.ts --version X.X.X');
    process.exit(1);
  }

  const version = args[versionIndex + 1];

  // Validar formato de versión
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
    console.error('❌ Error: Formato de versión inválido. Use semver (ej: 0.1.0)');
    process.exit(1);
  }

  console.log(`\n⚠️  ¿Estás seguro de que quieres eliminar la versión ${version}?`);
  console.log('   Esto eliminará el archivo de R2/S3 y el registro de la base de datos.');
  console.log('   Esta acción NO SE PUEDE DESHACER.\n');
  console.log('   Escribe "ELIMINAR" para confirmar:');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  readline.question('', async (answer: string) => {
    readline.close();

    if (answer !== 'ELIMINAR') {
      console.log('❌ Eliminación cancelada');
      process.exit(0);
    }

    try {
      console.log(`\n🗑️  Eliminando versión ${version}...`);

      await ModVersionService.deleteVersion(version);

      console.log(`✅ Versión ${version} eliminada exitosamente`);
      console.log('   - Archivo eliminado de R2/S3');
      console.log('   - Registro eliminado de la base de datos\n');

      // Mostrar versiones restantes
      const versions = await ModVersionService.listVersions();
      console.log(`📊 Versiones restantes: ${versions.length}`);

      if (versions.length > 0) {
        console.log('\n📋 Versiones disponibles:');
        for (const v of versions) {
          const latest = v.isLatest ? ' (LATEST)' : '';
          console.log(`   - ${v.version}${latest}`);
        }
      } else {
        console.log('\n⚠️  No quedan versiones en el servidor.');
      }

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error al eliminar la versión:', error);

      if (error instanceof Error && error.message.includes('no existe')) {
        console.log(`\n💡 La versión ${version} no existe en el servidor.`);
        console.log('   Para ver las versiones disponibles, ejecuta:');
        console.log('   npx tsx scripts/minecraft/list-mod-versions.ts');
      }

      process.exit(1);
    }
  });
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
