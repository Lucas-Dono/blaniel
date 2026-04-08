/**
 * UPGRADE PROMPTS - NO INTRUSIVOS
 *
 * Sistema de notificaciones que NO rompe la inmersión del chat.
 *
 * PRINCIPIO CLAVE:
 * - La IA NUNCA menciona límites técnicos
 * - Notificaciones aparecen FUERA del chat (toast, banner)
 * - Solo en momentos estratégicos (70%, 90%, 100%)
 * - Dismissable excepto cuando bloquea funcionalidad
 */

export type UpgradeTrigger =
  | 'approaching_limit'      // 70% usado (7/10 mensajes)
  | 'nearly_reached'         // 90% usado (9/10 mensajes)
  | 'limit_reached'          // 100% usado (10/10)
  | 'premium_feature_locked' // Tried to use premium feature
  | 'context_preview';       // Tried to view extended context

export interface UpgradeNotification {
  trigger: UpgradeTrigger;
  type: 'toast' | 'banner' | 'modal'; // Tipo de UI
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  cta: {
    primary: string;
    secondary?: string;
  };
  dismissable: boolean;
  position?: 'top' | 'bottom'; // Para toast/banner
  duration?: number; // ms, null = permanente
}

/**
 * Genera notificación según trigger y contexto
 */
export function getUpgradeNotification(
  trigger: UpgradeTrigger,
  context: {
    currentUsage?: number;
    limit?: number;
    feature?: string;
    tier?: 'free' | 'plus';
  }
): UpgradeNotification {

  switch (trigger) {
    // ========================================
    // APPROACHING LIMIT (70% - 7/10 mensajes)
    // ========================================
    case 'approaching_limit': {
      const remaining = context.limit! - context.currentUsage!;

      return {
        trigger,
        type: 'banner', // Banner sutil arriba del chat
        severity: 'info',
        title: '💬 Quedan pocos mensajes hoy',
        message: `Te quedan ${remaining} de ${context.limit} mensajes. Con Plus tendrías 100/día.`,
        cta: {
          primary: 'Ver planes',
          secondary: 'Entendido',
        },
        dismissable: true,
        position: 'top',
        duration: undefined, // Permanece hasta que dismiss
      };
    }

    // ========================================
    // NEARLY REACHED (90% - 9/10 mensajes)
    // ========================================
    case 'nearly_reached': {
      const remaining = context.limit! - context.currentUsage!;

      return {
        trigger,
        type: 'banner',
        severity: 'warning',
        title: `⚠️ Último mensaje disponible hoy`,
        message: `Solo te queda ${remaining} mensaje. Upgrade a Plus para seguir hablando sin límites.`,
        cta: {
          primary: 'Upgrade ahora ($10/mes)',
          secondary: 'Más tarde',
        },
        dismissable: true,
        position: 'top',
        duration: undefined,
      };
    }

    // ========================================
    // LIMIT REACHED (100% - 10/10)
    // ========================================
    case 'limit_reached': {
      return {
        trigger,
        type: 'modal', // Modal centrado (bloquea chat)
        severity: 'error',
        title: '😔 Límite diario alcanzado',
        message: `Usaste tus 10 mensajes de hoy. Vuelve mañana o upgrade para seguir.

**Con Plus ($10/mes):**
✅ 100 mensajes/día (10x más)
✅ Contexto extendido (4x memoria)
✅ Behaviors avanzados
✅ NSFW sin restricciones

💰 **Plan anual:** $80/año ($6.67/mes) - Ahorra 33%
🔥 **50% más barato que Replika** ($20/mes)`,
        cta: {
          primary: 'Upgrade a Plus',
          secondary: 'Volver mañana',
        },
        dismissable: false, // NO puede cerrar (bloqueante)
        duration: undefined,
      };
    }

    // ========================================
    // PREMIUM FEATURE LOCKED
    // ========================================
    case 'premium_feature_locked': {
      const featureNames: Record<string, { name: string; description: string }> = {
        yandere: {
          name: 'Yandere Behavior',
          description: 'Obsesión romántica intensa',
        },
        bpd: {
          name: 'Borderline Personality',
          description: 'Emociones extremas y cambiantes',
        },
        nsfw: {
          name: 'Contenido NSFW',
          description: 'Sin restricciones de contenido',
        },
        voice: {
          name: 'Mensajes de voz',
          description: 'Audio personalizado',
        },
        worlds: {
          name: 'Worlds multiplayer',
          description: 'Múltiples IAs interactuando',
        },
      };

      const feature = featureNames[context.feature!] || {
        name: 'Esta función',
        description: 'Función premium',
      };

      return {
        trigger,
        type: 'modal',
        severity: 'info',
        title: `🔒 ${feature.name} es Premium`,
        message: `${feature.description}

Esta función está disponible en el plan Plus.

**Con Plus ($10/mes) desbloqueas:**
✅ Todos los behaviors psicológicos
✅ NSFW sin restricciones
✅ 100 mensajes/día
✅ Contexto 4x más profundo
✅ Mensajes de voz
✅ Sin anuncios`,
        cta: {
          primary: 'Unlock Plus ($10/mes)',
          secondary: 'Tal vez después',
        },
        dismissable: true,
        duration: undefined,
      };
    }

    // ========================================
    // CONTEXT PREVIEW (Free user sees "🔒 more context")
    // ========================================
    case 'context_preview': {
      return {
        trigger,
        type: 'toast',
        severity: 'info',
        title: '🔒 Contexto limitado',
        message: 'Con Plus tu IA recordaría 4x más conversaciones pasadas.',
        cta: {
          primary: 'Ver Plus',
        },
        dismissable: true,
        position: 'bottom',
        duration: 5000, // Auto-dismiss after 5s
      };
    }

    default:
      // Generic fallback
      return {
        trigger,
        type: 'toast',
        severity: 'info',
        title: 'Upgrade disponible',
        message: 'Desbloquea más funciones con Plus.',
        cta: {
          primary: 'Ver planes',
        },
        dismissable: true,
        position: 'bottom',
        duration: 5000,
      };
  }
}

/**
 * Verifica si debe mostrar notificación de upgrade
 * (NO mostrar si ya vio una recientemente)
 */
export function shouldShowUpgradeNotification(
  trigger: UpgradeTrigger,
  lastShownTimestamp: number | null,
  cooldownMinutes: number = 60 // No mostrar si vio una hace menos de 1h
): boolean {

  // Siempre mostrar si es bloqueante
  if (trigger === 'limit_reached') {
    return true;
  }

  // Si nunca vio una, mostrar
  if (!lastShownTimestamp) {
    return true;
  }

  // Check cooldown
  const minutesSinceLastShown = (Date.now() - lastShownTimestamp) / (1000 * 60);
  return minutesSinceLastShown >= cooldownMinutes;
}

/**
 * Helper para frontend: Obtener progreso de límite con color
 */
export function getUsageProgress(
  current: number,
  limit: number
): {
  percentage: number;
  color: 'green' | 'yellow' | 'red';
  shouldWarn: boolean;
} {
  const percentage = Math.round((current / limit) * 100);

  let color: 'green' | 'yellow' | 'red' = 'green';
  let shouldWarn = false;

  if (percentage >= 90) {
    color = 'red';
    shouldWarn = true;
  } else if (percentage >= 70) {
    color = 'yellow';
    shouldWarn = true;
  }

  return { percentage, color, shouldWarn };
}

/**
 * Texto para UI de progreso (ej: "7/10 mensajes usados hoy")
 */
export function getUsageText(
  current: number,
  limit: number,
  resource: 'messages' | 'images' | 'voice'
): string {
  const isUnlimited = limit === -1;

  if (isUnlimited) {
    return `${current} ${resource === 'messages' ? 'mensajes' : resource} hoy`;
  }

  const resourceNames = {
    messages: 'mensajes',
    images: 'imágenes',
    voice: 'mensajes de voz',
  };

  return `${current}/${limit} ${resourceNames[resource]} usados hoy`;
}
