#!/usr/bin/env node
/**
 * Restaura un snapshot del proyecto
 *
 * ADVERTENCIA: Esto sobrescribirá los archivos actuales.
 * Se recomienda hacer commit de cambios importantes antes de restaurar.
 *
 * Uso:
 *   npm run snapshot:restore <número-o-nombre>
 *   npm run snapshot:restore 1
 *   npm run snapshot:restore snapshot-2025-01-30T14-30-45-123Z.tar.gz
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';
import { DEFAULT_CONFIG } from './config';

interface SnapshotInfo {
  name: string;
  path: string;
  created: Date;
}

function parseTimestampFromFilename(filename: string): Date | null {
  const match = filename.match(/snapshot-(.+)\.tar\.gz$/);
  if (!match) return null;

  try {
    const isoString = match[1].replace(/-(\d{3})Z$/, '.$1Z').replace(/-/g, ':');
    return new Date(isoString);
  } catch {
    return null;
  }
}

function getSnapshots(): SnapshotInfo[] {
  const snapshotDir = DEFAULT_CONFIG.snapshotDir;

  if (!fs.existsSync(snapshotDir)) {
    return [];
  }

  const files = fs.readdirSync(snapshotDir);
  const snapshots: SnapshotInfo[] = [];

  for (const file of files) {
    if (!file.startsWith('snapshot-') || !file.endsWith('.tar.gz')) {
      continue;
    }

    const filePath = path.join(snapshotDir, file);
    const stats = fs.statSync(filePath);
    const created = parseTimestampFromFilename(file) || stats.mtime;

    snapshots.push({
      name: file,
      path: filePath,
      created,
    });
  }

  // Ordenar por fecha (más reciente primero)
  return snapshots.sort((a, b) => b.created.getTime() - a.created.getTime());
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function restoreSnapshot(identifier: string): Promise<void> {
  console.log('🔄 Restaurador de Snapshots\n');

  // Obtener lista de snapshots
  const snapshots = getSnapshots();

  if (snapshots.length === 0) {
    console.error('❌ No hay snapshots disponibles');
    console.log('   Ejecuta "npm run snapshot:watch" para crear snapshots automáticos\n');
    process.exit(1);
  }

  // Encontrar snapshot
  let snapshot: SnapshotInfo | undefined;

  // Por número
  if (/^\d+$/.test(identifier)) {
    const index = parseInt(identifier, 10) - 1;
    snapshot = snapshots[index];

    if (!snapshot) {
      console.error(`❌ Snapshot #${identifier} no encontrado`);
      console.log(`   Hay ${snapshots.length} snapshots disponibles (1-${snapshots.length})\n`);
      process.exit(1);
    }
  }
  // Por nombre
  else {
    snapshot = snapshots.find(s => s.name === identifier);

    if (!snapshot) {
      console.error(`❌ Snapshot "${identifier}" no encontrado\n`);
      process.exit(1);
    }
  }

  // Mostrar información
  console.log('📦 Snapshot seleccionado:');
  console.log(`   Nombre: ${snapshot.name}`);
  console.log(`   Creado: ${snapshot.created.toLocaleString()}`);
  console.log(`   Tamaño: ${(fs.statSync(snapshot.path).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Advertencia
  console.log('⚠️  ADVERTENCIA: Esta operación sobrescribirá los archivos actuales.');
  console.log('   Se recomienda hacer commit de cambios importantes antes de continuar.');
  console.log('');

  // Confirmar
  const confirmed = await askConfirmation('¿Deseas continuar? (y/N): ');

  if (!confirmed) {
    console.log('\n❌ Restauración cancelada\n');
    process.exit(0);
  }

  console.log('\n🔄 Restaurando snapshot...\n');

  try {
    const projectRoot = DEFAULT_CONFIG.projectRoot;

    // Extraer snapshot
    console.log('📂 Extrayendo archivos...');
    execSync(`tar -xzf "${snapshot.path}" -C "${projectRoot}"`, {
      stdio: 'inherit',
    });

    console.log('✅ Snapshot restaurado exitosamente\n');
    console.log('💡 Próximos pasos:');
    console.log('   1. Verifica que todo esté correcto');
    console.log('   2. Si usas npm: npm install (para sincronizar dependencias)');
    console.log('   3. Si usas base de datos: npm run db:push (para sincronizar schema)\n');

  } catch (error) {
    console.error('❌ Error restaurando snapshot:', error);
    process.exit(1);
  }
}

// Ejecutar
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Error: Debes especificar un snapshot');
  console.log('\nUso:');
  console.log('   npm run snapshot:restore <número-o-nombre>');
  console.log('\nEjemplos:');
  console.log('   npm run snapshot:restore 1');
  console.log('   npm run snapshot:restore snapshot-2025-01-30T14-30-45-123Z.tar.gz');
  console.log('\n💡 Para ver snapshots disponibles:');
  console.log('   npm run snapshot:list\n');
  process.exit(1);
}

restoreSnapshot(identifier).catch(console.error);
