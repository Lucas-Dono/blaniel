/**
 * Configuración del Sistema de Snapshots
 *
 * Sistema de respaldo automático que crea snapshots del proyecto
 * cada 30 minutos si detecta cambios, independiente de git.
 */

import * as path from 'path';
import * as fs from 'fs';

export interface SnapshotConfig {
  /** Directorio donde se almacenan los snapshots */
  snapshotDir: string;

  /** Intervalo de tiempo entre snapshots (en milisegundos) */
  interval: number;

  /** Número máximo de snapshots a mantener */
  maxSnapshots: number;

  /** Archivo con patrones de exclusión */
  ignoreFile: string;

  /** Directorio raíz del proyecto */
  projectRoot: string;

  /** Nivel de compresión (0-9, donde 9 es máxima compresión) */
  compressionLevel: number;

  /** Incluir timestamp en el nombre del snapshot */
  includeTimestamp: boolean;

  /** Tiempo mínimo entre cambios para considerar crear snapshot (ms) */
  debounceTime: number;
}

/**
 * Configuración por defecto del sistema de snapshots
 */
export const DEFAULT_CONFIG: SnapshotConfig = {
  snapshotDir: path.join(process.cwd(), '.snapshots'),
  interval: 30 * 60 * 1000, // 30 minutos
  maxSnapshots: 20, // Mantener últimos 20 snapshots
  ignoreFile: path.join(process.cwd(), '.snapshot-ignore'),
  projectRoot: process.cwd(),
  compressionLevel: 6, // Compresión balanceada (velocidad vs tamaño)
  includeTimestamp: true,
  debounceTime: 5000, // 5 segundos después del último cambio
};

/**
 * Lee y parsea el archivo .snapshot-ignore
 */
export function loadIgnorePatterns(ignoreFile: string): string[] {
  try {
    if (!fs.existsSync(ignoreFile)) {
      console.warn(`⚠️  Archivo .snapshot-ignore no encontrado: ${ignoreFile}`);
      return [];
    }

    const content = fs.readFileSync(ignoreFile, 'utf-8');

    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')) // Ignorar comentarios y líneas vacías
      .map(pattern => {
        // Convertir patrones simples a regex-friendly
        if (pattern.endsWith('/')) {
          return pattern.slice(0, -1); // Remover trailing slash
        }
        return pattern;
      });
  } catch (error) {
    console.error('❌ Error leyendo .snapshot-ignore:', error);
    return [];
  }
}

/**
 * Verifica si una ruta debe ser ignorada según los patrones
 */
export function shouldIgnore(filePath: string, ignorePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);

  // Normalizar path separators
  const normalizedPath = relativePath.split(path.sep).join('/');

  for (const pattern of ignorePatterns) {
    // Patrón exacto
    if (normalizedPath === pattern) {
      return true;
    }

    // Patrón de directorio (matches cualquier archivo dentro)
    if (normalizedPath.startsWith(pattern + '/')) {
      return true;
    }

    // Patrón con wildcard
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(normalizedPath)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Obtiene el espacio disponible en disco (en bytes)
 */
export async function getAvailableDiskSpace(): Promise<number> {
  try {
    const { execSync } = require('child_process');
    const output = execSync('df -k . | tail -1 | awk \'{print $4}\'', { encoding: 'utf-8' });
    const availableKB = parseInt(output.trim(), 10);
    return availableKB * 1024; // Convertir a bytes
  } catch (error) {
    console.warn('⚠️  No se pudo obtener espacio disponible:', error);
    return Infinity; // Asumir espacio ilimitado si no se puede verificar
  }
}

/**
 * Verifica si hay suficiente espacio para crear un snapshot
 * (Estima que necesitamos al menos 500MB libres)
 */
export async function hasEnoughDiskSpace(): Promise<boolean> {
  const availableSpace = await getAvailableDiskSpace();
  const minRequiredSpace = 500 * 1024 * 1024; // 500MB

  return availableSpace > minRequiredSpace;
}
