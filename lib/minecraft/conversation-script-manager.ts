/**
 * Gestor de Scripts de Conversaciones
 *
 * Registra scripts y hace tracking de listeners (sin auto-advance, eso lo hace el cliente)
 */

import { createLogger } from "@/lib/logger";
import { ConversationScript, ScriptMetadata } from "./conversation-script-types";

const log = createLogger("ConversationScriptManager");

/**
 * Información de listeners por grupo
 */
interface GroupListeners {
  groupHash: string;
  scriptId: string;
  listeners: Set<string>;
  lastActivityAt: Date;
}

export class ConversationScriptManager {
  /**
   * Scripts registrados
   * Key: scriptId
   */
  private static loadedScripts = new Map<string, ConversationScript>();

  /**
   * Mapeo de groupHash a scriptId
   * Key: groupHash
   */
  private static groupToScript = new Map<string, string>();

  /**
   * Listeners por grupo
   * Key: groupHash
   */
  private static groupListeners = new Map<string, GroupListeners>();

  /**
   * Registrar script para un grupo (sin auto-advance)
   */
  static registerScript(groupHash: string, script: ConversationScript): void {
    // Guardar script
    this.loadedScripts.set(script.scriptId, script);
    this.groupToScript.set(groupHash, script.scriptId);

    // Inicializar listeners
    this.groupListeners.set(groupHash, {
      groupHash,
      scriptId: script.scriptId,
      listeners: new Set(),
      lastActivityAt: new Date(),
    });

    log.info({
      groupHash,
      scriptId: script.scriptId,
      topic: script.topic,
      totalLines: script.lines.length,
    }, "Script registered");
  }

  /**
   * Obtener script por groupHash
   */
  static getScriptByGroupHash(groupHash: string): ConversationScript | null {
    const scriptId = this.groupToScript.get(groupHash);
    if (!scriptId) return null;
    return this.loadedScripts.get(scriptId) || null;
  }

  /**
   * Limpiar script de un grupo
   */
  static unregisterScript(groupHash: string): void {
    const scriptId = this.groupToScript.get(groupHash);
    if (scriptId) {
      this.loadedScripts.delete(scriptId);
    }
    this.groupToScript.delete(groupHash);
    this.groupListeners.delete(groupHash);

    log.info({ groupHash }, "Script unregistered");
  }

  /**
   * Registrar jugador como listener (para analytics)
   */
  static addListener(groupHash: string, playerId: string): void {
    const group = this.groupListeners.get(groupHash);
    if (!group) {
      log.warn({ groupHash, playerId }, "Cannot add listener, group not found");
      return;
    }

    group.listeners.add(playerId);
    group.lastActivityAt = new Date();

    log.debug({
      groupHash,
      playerId,
      totalListeners: group.listeners.size,
    }, "Listener added");
  }

  /**
   * Remover jugador como listener
   */
  static removeListener(groupHash: string, playerId: string): void {
    const group = this.groupListeners.get(groupHash);
    if (!group) return;

    group.listeners.delete(playerId);
    group.lastActivityAt = new Date();

    log.debug({
      groupHash,
      playerId,
      totalListeners: group.listeners.size,
    }, "Listener removed");
  }

  /**
   * Obtener script por ID
   */
  static getScript(scriptId: string): ConversationScript | null {
    return this.loadedScripts.get(scriptId) || null;
  }

  /**
   * Obtener metadata de script (sin las líneas completas)
   */
  static getScriptMetadata(groupHash: string): ScriptMetadata | null {
    const scriptId = this.groupToScript.get(groupHash);
    if (!scriptId) return null;

    const script = this.loadedScripts.get(scriptId);
    if (!script) return null;

    return {
      scriptId: script.scriptId,
      groupHash,
      version: script.version,
      topic: script.topic,
      totalLines: script.lines.length,
      updatedAt: script.updatedAt,
      generatedBy: script.generatedBy,
    };
  }

  /**
   * Verificar si hay una versión más nueva disponible
   */
  static hasNewerVersion(groupHash: string, clientVersion: number): boolean {
    const metadata = this.getScriptMetadata(groupHash);
    if (!metadata) return false;

    return metadata.version > clientVersion;
  }

  /**
   * Limpiar grupos inactivos (sin listeners por más de X tiempo)
   */
  static cleanupInactiveGroups(inactiveThresholdMinutes: number = 30): number {
    const now = Date.now();
    const threshold = inactiveThresholdMinutes * 60 * 1000;
    let cleaned = 0;

    for (const [groupHash, group] of this.groupListeners.entries()) {
      const inactive = now - group.lastActivityAt.getTime() > threshold;
      const noListeners = group.listeners.size === 0;

      if (inactive && noListeners) {
        this.unregisterScript(groupHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info({ count: cleaned }, "Cleaned up inactive groups");
    }

    return cleaned;
  }

  /**
   * Obtener estadísticas
   */
  static getStats() {
    const totalListeners = Array.from(this.groupListeners.values()).reduce(
      (sum, g) => sum + g.listeners.size,
      0
    );

    return {
      registeredGroups: this.groupListeners.size,
      loadedScripts: this.loadedScripts.size,
      totalListeners,
    };
  }

  /**
   * Limpiar todo (útil para tests)
   */
  static clearAll(): void {
    this.loadedScripts.clear();
    this.groupToScript.clear();
    this.groupListeners.clear();

    log.info("All scripts cleared");
  }
}
