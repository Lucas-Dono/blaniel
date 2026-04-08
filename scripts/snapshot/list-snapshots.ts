#!/usr/bin/env node
/**
 * Lista todos los snapshots disponibles
 *
 * Uso:
 *   npm run snapshot:list
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIG } from './config';

interface SnapshotInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
  age: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatAge(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `hace ${days} día${days !== 1 ? 's' : ''}`;
  if (hours > 0) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  return 'hace menos de 1 minuto';
}

function parseTimestampFromFilename(filename: string): Date | null {
  // snapshot-2025-01-30T14-30-45-123Z.tar.gz
  const match = filename.match(/snapshot-(.+)\.tar\.gz$/);
  if (!match) return null;

  try {
    // Convertir back to ISO format
    const isoString = match[1].replace(/-(\d{3})Z$/, '.$1Z').replace(/-/g, ':');
    return new Date(isoString);
  } catch {
    return null;
  }
}

async function listSnapshots(): Promise<void> {
  const snapshotDir = DEFAULT_CONFIG.snapshotDir;

  console.log('📦 Snapshots Disponibles\n');
  console.log(`Directorio: ${snapshotDir}\n`);

  if (!fs.existsSync(snapshotDir)) {
    console.log('⚠️  No hay snapshots disponibles (directorio no existe)');
    console.log('   Ejecuta "npm run snapshot:watch" para crear snapshots automáticos\n');
    return;
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
      size: stats.size,
      created,
      age: formatAge(created),
    });
  }

  if (snapshots.length === 0) {
    console.log('⚠️  No hay snapshots disponibles');
    console.log('   Ejecuta "npm run snapshot:watch" para crear snapshots automáticos\n');
    return;
  }

  // Ordenar por fecha (más reciente primero)
  snapshots.sort((a, b) => b.created.getTime() - a.created.getTime());

  // Calcular tamaño total
  const totalSize = snapshots.reduce((sum, s) => sum + s.size, 0);

  // Mostrar tabla
  console.log('┌────┬─────────────────────────────────────────────────┬────────────┬──────────────────────┐');
  console.log('│ #  │ Nombre                                          │ Tamaño     │ Creado               │');
  console.log('├────┼─────────────────────────────────────────────────┼────────────┼──────────────────────┤');

  snapshots.forEach((snapshot, index) => {
    const num = String(index + 1).padStart(2, ' ');
    const name = snapshot.name.padEnd(47, ' ').substring(0, 47);
    const size = formatBytes(snapshot.size).padStart(10, ' ');
    const age = snapshot.age.padEnd(20, ' ');

    console.log(`│ ${num} │ ${name} │ ${size} │ ${age} │`);
  });

  console.log('└────┴─────────────────────────────────────────────────┴────────────┴──────────────────────┘');
  console.log('');
  console.log(`Total: ${snapshots.length} snapshot${snapshots.length !== 1 ? 's' : ''}`);
  console.log(`Tamaño total: ${formatBytes(totalSize)}`);
  console.log('');
  console.log('💡 Para restaurar un snapshot, ejecuta:');
  console.log('   npm run snapshot:restore <número-o-nombre>\n');
}

// Ejecutar
listSnapshots().catch(console.error);
