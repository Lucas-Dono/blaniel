#!/usr/bin/env node
/**
 * Servicio de Snapshots Automáticos
 *
 * Crea copias de seguridad automáticas del proyecto cada 30 minutos
 * si detecta cambios. Permite volver a cualquier punto sin usar git.
 *
 * Uso:
 *   npm run snapshot:watch
 */

import * as chokidar from 'chokidar';
import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_CONFIG,
  loadIgnorePatterns,
  shouldIgnore,
  hasEnoughDiskSpace,
  type SnapshotConfig
} from './config';

class SnapshotService {
  private config: SnapshotConfig;
  private ignorePatterns: string[];
  private watcher: chokidar.FSWatcher | null = null;
  private hasChanges: boolean = false;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isCreatingSnapshot: boolean = false;

  constructor(config: Partial<SnapshotConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ignorePatterns = loadIgnorePatterns(this.config.ignoreFile);

    // Crear directorio de snapshots si no existe
    if (!fs.existsSync(this.config.snapshotDir)) {
      fs.mkdirSync(this.config.snapshotDir, { recursive: true });
      console.log(`📁 Directorio de snapshots creado: ${this.config.snapshotDir}`);
    }
  }

  /**
   * Inicia el servicio de snapshots
   */
  public start(): void {
    console.log('🚀 Iniciando servicio de snapshots automáticos...');
    console.log(`📂 Directorio: ${this.config.snapshotDir}`);
    console.log(`⏱️  Intervalo: ${this.config.interval / 1000 / 60} minutos`);
    console.log(`📦 Máximo de snapshots: ${this.config.maxSnapshots}`);
    console.log(`🚫 Patrones de exclusión: ${this.ignorePatterns.length}`);
    console.log('');

    // Iniciar watcher de archivos
    this.startWatcher();

    // Programar snapshots periódicos
    this.scheduleSnapshots();

    // Manejar cierre graceful
    this.setupGracefulShutdown();
  }

  /**
   * Inicia el watcher de archivos
   */
  private startWatcher(): void {
    const watchPaths = [
      'app/**/*',
      'components/**/*',
      'lib/**/*',
      'scripts/**/*',
      'prisma/**/*',
      'public/**/*',
      'types/**/*',
      'package.json',
      'tsconfig.json',
      'next.config.ts',
      'tailwind.config.ts',
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: (filePath: string) => {
        // Ignorar archivos según .snapshot-ignore
        return shouldIgnore(filePath, this.ignorePatterns);
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (path) => this.onFileChange('añadido', path))
      .on('change', (path) => this.onFileChange('modificado', path))
      .on('unlink', (path) => this.onFileChange('eliminado', path))
      .on('ready', () => {
        console.log('👀 Vigilando cambios en el proyecto...\n');
      })
      .on('error', (error) => {
        console.error('❌ Error en watcher:', error);
      });
  }

  /**
   * Maneja cambios en archivos
   */
  private onFileChange(action: string, filePath: string): void {
    const relativePath = path.relative(this.config.projectRoot, filePath);
    console.log(`📝 Archivo ${action}: ${relativePath}`);

    this.hasChanges = true;

    // Debounce: esperar a que dejen de haber cambios
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      console.log('✅ Cambios detectados y estabilizados\n');
    }, this.config.debounceTime) as unknown as NodeJS.Timeout;
  }

  /**
   * Programa snapshots periódicos
   */
  private scheduleSnapshots(): void {
    this.snapshotTimer = setInterval(async () => {
      if (this.hasChanges && !this.isCreatingSnapshot) {
        await this.createSnapshot();
        this.hasChanges = false;
      } else if (!this.hasChanges) {
        console.log('⏭️  No hay cambios, omitiendo snapshot...\n');
      }
    }, this.config.interval) as unknown as NodeJS.Timeout;

    console.log('⏰ Snapshots programados\n');
  }

  /**
   * Crea un nuevo snapshot
   */
  private async createSnapshot(): Promise<void> {
    this.isCreatingSnapshot = true;
    const startTime = Date.now();

    try {
      // Verificar espacio en disco
      const hasSpace = await hasEnoughDiskSpace();
      if (!hasSpace) {
        console.error('❌ Espacio insuficiente en disco para crear snapshot');
        return;
      }

      // Generar nombre del snapshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const snapshotName = `snapshot-${timestamp}.tar.gz`;
      const snapshotPath = path.join(this.config.snapshotDir, snapshotName);

      console.log('📦 Creando snapshot...');
      console.log(`   Nombre: ${snapshotName}`);

      // Crear archivo comprimido
      const output = fs.createWriteStream(snapshotPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: {
          level: this.config.compressionLevel,
        },
      });

      // Manejar eventos
      let totalBytes = 0;
      let fileCount = 0;

      archive.on('entry', (entry) => {
        if (entry.stats && !entry.stats.isDirectory()) {
          totalBytes += entry.stats.size;
          fileCount++;
        }
      });

      output.on('close', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const size = (archive.pointer() / 1024 / 1024).toFixed(2);

        console.log(`✅ Snapshot creado exitosamente`);
        console.log(`   Tamaño: ${size} MB`);
        console.log(`   Archivos: ${fileCount}`);
        console.log(`   Duración: ${duration}s`);
        console.log('');

        // Limpiar snapshots antiguos
        this.cleanupOldSnapshots();
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(output);

      // Agregar archivos al snapshot
      const addFile = (filePath: string) => {
        if (!shouldIgnore(filePath, this.ignorePatterns)) {
          const relativePath = path.relative(this.config.projectRoot, filePath);
          archive.file(filePath, { name: relativePath });
        }
      };

      const addDirectory = (dirPath: string) => {
        if (shouldIgnore(dirPath, this.ignorePatterns)) {
          return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (shouldIgnore(fullPath, this.ignorePatterns)) {
            continue;
          }

          if (entry.isDirectory()) {
            addDirectory(fullPath);
          } else if (entry.isFile()) {
            addFile(fullPath);
          }
        }
      };

      // Agregar todo el proyecto (excepto lo ignorado)
      addDirectory(this.config.projectRoot);

      await archive.finalize();

    } catch (error) {
      console.error('❌ Error creando snapshot:', error);
    } finally {
      this.isCreatingSnapshot = false;
    }
  }

  /**
   * Limpia snapshots antiguos manteniendo solo los más recientes
   */
  private cleanupOldSnapshots(): void {
    try {
      const snapshots = fs.readdirSync(this.config.snapshotDir)
        .filter(file => file.startsWith('snapshot-') && file.endsWith('.tar.gz'))
        .map(file => ({
          name: file,
          path: path.join(this.config.snapshotDir, file),
          time: fs.statSync(path.join(this.config.snapshotDir, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // Más reciente primero

      if (snapshots.length > this.config.maxSnapshots) {
        const toDelete = snapshots.slice(this.config.maxSnapshots);

        console.log(`🧹 Limpiando ${toDelete.length} snapshots antiguos...`);

        for (const snapshot of toDelete) {
          fs.unlinkSync(snapshot.path);
          console.log(`   🗑️  Eliminado: ${snapshot.name}`);
        }

        console.log('');
      }
    } catch (error) {
      console.error('❌ Error limpiando snapshots:', error);
    }
  }

  /**
   * Detiene el servicio
   */
  public async stop(): Promise<void> {
    console.log('\n⏸️  Deteniendo servicio de snapshots...');

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
    }

    if (this.watcher) {
      await this.watcher.close();
    }

    // Crear snapshot final si hay cambios
    if (this.hasChanges && !this.isCreatingSnapshot) {
      console.log('📦 Creando snapshot final...');
      await this.createSnapshot();
    }

    console.log('✅ Servicio detenido correctamente\n');
  }

  /**
   * Configura manejo de cierre graceful
   */
  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    for (const signal of signals) {
      process.on(signal, async () => {
        await this.stop();
        process.exit(0);
      });
    }
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const service = new SnapshotService();
  service.start();
}

export default SnapshotService;
