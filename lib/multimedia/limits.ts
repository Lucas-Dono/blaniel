/**
 * MULTIMEDIA LIMITS SYSTEM
 *
 * Configurable multimedia limits system with .env-based strategies
 * Allows switching between different business models without code refactoring
 *
 * Strategies:
 * - BLOCKED: Multimedia blocked for FREE (launch phase)
 * - TRIAL_LIFETIME: Limited non-renewable trial (growth phase)
 * - TRIAL_TIME: Time-based trial with unlimited usage (aggressive phase)
 */

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('MultimediaLimits');

export type MultimediaStrategy = 'BLOCKED' | 'TRIAL_LIFETIME' | 'TRIAL_TIME';
export type MultimediaType = 'image' | 'voice';

interface MultimediaLimitConfig {
  strategy: MultimediaStrategy;

  // For TRIAL_LIFETIME
  imageGenerationLifetime: number;
  voiceMessagesLifetime: number;

  // For TRIAL_TIME
  multimediaTrialDays: number;
}

/**
 * Load configuration from .env
 */
function loadConfig(): MultimediaLimitConfig {
  return {
    strategy: (process.env.FREE_MULTIMEDIA_STRATEGY || 'BLOCKED') as MultimediaStrategy,
    imageGenerationLifetime: parseInt(process.env.FREE_IMAGE_GENERATION_LIFETIME || '3'),
    voiceMessagesLifetime: parseInt(process.env.FREE_VOICE_MESSAGES_LIFETIME || '5'),
    multimediaTrialDays: parseInt(process.env.FREE_MULTIMEDIA_TRIAL_DAYS || '30'),
  };
}

const config = loadConfig();

/**
 * Check if FREE user can use multimedia
 */
export async function canUseFreeMultimedia(
  userId: string,
  type: MultimediaType,
  userPlan: string = 'free'
): Promise<{
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  upgradeMessage?: string;
}> {
  // If not free, always allow (Plus/Ultra)
  if (userPlan !== 'free') {
    return { allowed: true };
  }

  // Estrategia BLOCKED: Bloquear todo multimedia para free
  if (config.strategy === 'BLOCKED') {
    return {
      allowed: false,
      reason: 'MULTIMEDIA_BLOCKED_FOR_FREE',
      upgradeMessage: getBlockedUpgradeMessage(type),
    };
  }

  // Strategy TRIAL_LIFETIME: Fixed non-renewable limit
  if (config.strategy === 'TRIAL_LIFETIME') {
    return await checkLifetimeTrial(userId, type);
  }

  // Estrategia TRIAL_TIME: Trial por tiempo con uso ilimitado
  if (config.strategy === 'TRIAL_TIME') {
    return await checkTimeTrial(userId, type);
  }

  // Fallback: bloquear
  return {
    allowed: false,
    reason: 'UNKNOWN_STRATEGY',
    upgradeMessage: 'Actualiza a Plus para usar multimedia. /pricing',
  };
}

/**
 * Verificar trial lifetime (X generaciones totales, no renovable)
 */
async function checkLifetimeTrial(
  userId: string,
  type: MultimediaType
): Promise<{
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  upgradeMessage?: string;
}> {
  const limit = type === 'image'
    ? config.imageGenerationLifetime
    : config.voiceMessagesLifetime;

  // Contar uso total del usuario
  const current = await countMultimediaUsage(userId, type);

  if (current >= limit) {
    return {
      allowed: false,
      reason: 'TRIAL_LIFETIME_EXHAUSTED',
      current,
      limit,
      upgradeMessage: getTrialExhaustedMessage(type, current, limit),
    };
  }

  return {
    allowed: true,
    current,
    limit,
  };
}

/**
 * Verificar trial por tiempo (X días con uso ilimitado)
 */
async function checkTimeTrial(
  userId: string,
  type: MultimediaType
): Promise<{
  allowed: boolean;
  reason?: string;
  upgradeMessage?: string;
  daysRemaining?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    return {
      allowed: false,
      reason: 'USER_NOT_FOUND',
    };
  }

  // Calcular días desde registro
  const now = new Date();
  const registeredAt = new Date(user.createdAt);
  const daysSinceRegistration = Math.floor(
    (now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = config.multimediaTrialDays - daysSinceRegistration;

  if (daysSinceRegistration > config.multimediaTrialDays) {
    return {
      allowed: false,
      reason: 'TRIAL_TIME_EXPIRED',
      daysRemaining: 0,
      upgradeMessage: getTrialExpiredMessage(type),
    };
  }

  return {
    allowed: true,
    daysRemaining,
  };
}

/**
 * Contar uso total de multimedia por tipo
 */
async function countMultimediaUsage(
  userId: string,
  type: MultimediaType
): Promise<number> {
  if (type === 'image') {
    // Contar imágenes generadas (completadas + generando)
    // @deprecated - pendingImageGeneration model no longer exists in schema
    return 0;
    // return await prisma.pendingImageGeneration.count({
    //   where: {
    //     userId,
    //     status: { in: ['completed', 'generating'] },
    //   },
    // });
  } else {
    // Contar mensajes con audio generado
    return await prisma.message.count({
      where: {
        userId,
        role: 'assistant',
        metadata: {
          path: ['multimedia'],
          array_contains: [{ type: 'audio' }],
        },
      },
    });
  }
}

/**
 * Trackear uso de multimedia (para TRIAL_LIFETIME)
 */
export async function trackMultimediaUsage(
  userId: string,
  type: MultimediaType,
  resourceId: string
): Promise<void> {
  // Solo trackear si es estrategia TRIAL_LIFETIME
  if (config.strategy !== 'TRIAL_LIFETIME') {
    return;
  }

  log.info({ userId, type, resourceId }, 'Tracking multimedia usage');

  // Tracking is already done automatically:
  // - Imágenes: PendingImageGeneration con status completed
  // - Voces: Message con metadata.multimedia[].type === 'audio'
}

/**
 * Obtener estado de trial para usuario FREE
 */
export async function getFreeMultimediaStatus(userId: string): Promise<{
  strategy: MultimediaStrategy;
  images?: {
    current: number;
    limit: number;
    remaining: number;
  };
  voices?: {
    current: number;
    limit: number;
    remaining: number;
  };
  trialDaysRemaining?: number;
  isBlocked?: boolean;
}> {
  if (config.strategy === 'BLOCKED') {
    return {
      strategy: 'BLOCKED',
      isBlocked: true,
    };
  }

  if (config.strategy === 'TRIAL_LIFETIME') {
    const [imagesCurrent, voicesCurrent] = await Promise.all([
      countMultimediaUsage(userId, 'image'),
      countMultimediaUsage(userId, 'voice'),
    ]);

    return {
      strategy: 'TRIAL_LIFETIME',
      images: {
        current: imagesCurrent,
        limit: config.imageGenerationLifetime,
        remaining: Math.max(0, config.imageGenerationLifetime - imagesCurrent),
      },
      voices: {
        current: voicesCurrent,
        limit: config.voiceMessagesLifetime,
        remaining: Math.max(0, config.voiceMessagesLifetime - voicesCurrent),
      },
    };
  }

  if (config.strategy === 'TRIAL_TIME') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) {
      return {
        strategy: 'TRIAL_TIME',
        isBlocked: true,
      };
    }

    const now = new Date();
    const registeredAt = new Date(user.createdAt);
    const daysSinceRegistration = Math.floor(
      (now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysRemaining = Math.max(0, config.multimediaTrialDays - daysSinceRegistration);

    return {
      strategy: 'TRIAL_TIME',
      trialDaysRemaining: daysRemaining,
    };
  }

  return {
    strategy: config.strategy,
    isBlocked: true,
  };
}

/**
 * Mensajes de upgrade contextuales
 */
function getBlockedUpgradeMessage(type: MultimediaType): string {
  const feature = type === 'image' ? 'generación de imágenes' : 'mensajes de voz';

  return `La ${feature} está disponible solo para usuarios Plus y Ultra.

Con Plus ($10/mes) obtienes:
${type === 'image' ? '📸 10 imágenes/día' : '🎙️ 50 mensajes de voz/mes'}
💬 100 mensajes/día
🔥 Contenido NSFW
🎭 Personalidades avanzadas

Actualiza ahora: /pricing`;
}

function getTrialExhaustedMessage(type: MultimediaType, current: number, limit: number): string {
  const feature = type === 'image' ? 'fotos' : 'mensajes de voz';
  const emoji = type === 'image' ? '📸' : '🎙️';

  return `Ya usaste tus ${limit} ${feature} gratis del trial ${emoji} (${current}/${limit})

¡Te gustó? Con Plus ($10/mes) obtienes:
${type === 'image' ? '📸 10 imágenes/día' : '🎙️ 50 mensajes de voz/mes'}
💬 100 mensajes/día (vs 15 en free)
🔥 Contenido NSFW
🎭 Personalidades avanzadas (Yandere, BPD, etc.)

Actualiza ahora: /pricing`;
}

function getTrialExpiredMessage(type: MultimediaType): string {
  const feature = type === 'image' ? 'generación de imágenes' : 'mensajes de voz';

  return `Tu trial de ${config.multimediaTrialDays} días ha expirado 😢

Para seguir usando ${feature}, actualiza a Plus:
📸 10 imágenes/día
🎙️ 50 mensajes de voz/mes
💬 100 mensajes/día
🔥 Contenido NSFW

Actualiza ahora: /pricing`;
}

/**
 * Obtener información de la estrategia actual
 */
export function getMultimediaStrategyInfo(): {
  strategy: MultimediaStrategy;
  description: string;
  config: MultimediaLimitConfig;
} {
  const descriptions: Record<MultimediaStrategy, string> = {
    BLOCKED: 'Multimedia bloqueada para FREE (fase lanzamiento)',
    TRIAL_LIFETIME: 'Trial limitado no renovable (fase crecimiento)',
    TRIAL_TIME: `Trial de ${config.multimediaTrialDays} días con uso ilimitado (fase agresiva)`,
  };

  return {
    strategy: config.strategy,
    description: descriptions[config.strategy],
    config,
  };
}
