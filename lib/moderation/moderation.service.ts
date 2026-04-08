/**
 * Moderation Service
 * 
 * Main content moderation service
 * Integrates content filters, rate limiting, and violation tracking
 */


import { moderateContent, quickModerate, type ContentModerationResult } from './content-filter';
import {
  checkMessageRate,
  checkPostCreation,
  checkCommentCreation,
  checkUserBan,
  banUser,
} from './rate-limiter';
import { apiLogger as log } from '@/lib/logging';

// ============================================
// TYPES
// ============================================

export interface ModerationResult {
  allowed: boolean;
  blocked: boolean;
  severity: 'low' | 'medium' | 'high';
  reason?: string;
  suggestion?: string;
  action?: 'warning' | 'blocked' | 'temp_ban' | 'permanent_ban';
  violationId?: string;
  details?: {
    contentFilter?: ContentModerationResult;
    rateLimit?: any;
    userHistory?: any;
  };
}

export interface FlagContentParams {
  contentType: 'message' | 'post' | 'comment' | 'agent' | 'world';
  contentId: string;
  userId: string;
  reason: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high';
}

// ============================================
// MODERATION LOGIC
// ============================================

/**
 * Moderate a message before sending
 */
export async function moderateMessage(
  userId: string,
  content: string,
  options: {
    agentId?: string;
    worldId?: string;
    quickCheck?: boolean;
  } = {}
): Promise<ModerationResult> {
  const { quickCheck = false } = options;

  try {
    // 1. CHECK USER BAN
    const banStatus = await checkUserBan(userId, 'message');
    if (banStatus.banned) {
      log.warn({ userId, reason: banStatus.reason }, 'Banned user attempted to send message');

      return {
        allowed: false,
        blocked: true,
        severity: 'high',
        reason: banStatus.reason || 'Tu cuenta está temporalmente suspendida',
        suggestion: banStatus.expiresAt
          ? `Podrás volver a enviar mensajes en ${Math.ceil((banStatus.expiresAt - Date.now()) / 1000 / 60)} minutos`
          : 'Contacta soporte para más información',
        action: 'temp_ban',
      };
    }

    // 2. CHECK RATE LIMIT
    const rateLimit = await checkMessageRate(userId);
    if (!rateLimit.allowed) {
      log.warn({ userId, rateLimit }, 'User exceeded message rate limit');

      return {
        allowed: false,
        blocked: true,
        severity: 'medium',
        reason: 'Estás enviando mensajes demasiado rápido',
        suggestion: `Espera ${rateLimit.retryAfter} segundos antes de enviar otro mensaje`,
        action: 'blocked',
        details: { rateLimit },
      };
    }

    // 3. CONTENT FILTERING
    let contentResult: ContentModerationResult | { allowed: boolean; reason?: string };

    if (quickCheck) {
      // Quick check - only critical filters
      contentResult = quickModerate(content);
    } else {
      // Full check - all filters
      contentResult = moderateContent(content, {
        checkSpam: true,
        checkInjection: true,
        checkDangerous: true,
        checkProfanity: false, // Disabled by default
      });
    }

    if (!contentResult.allowed) {
      // Get user violation history
      const violationCount = await getUserViolationCount(userId, 24); // Last 24 hours

      // Determine action based on severity and history
      let action: ModerationResult['action'] = 'warning';
      let severity: 'low' | 'medium' | 'high' = 'low';

      if ('severity' in contentResult) {
        severity = contentResult.severity;
      }

      // Auto-escalation based on violations
      if (violationCount >= 10) {
        action = 'permanent_ban';
        severity = 'high';
      } else if (violationCount >= 5) {
        action = 'temp_ban';
        severity = 'high';
        // Ban por 24 horas
        await banUser(userId, 86400, 'Múltiples violaciones de moderación', 'message');
      } else if (violationCount >= 3 || severity === 'high') {
        action = 'blocked';
        severity = 'high';
      } else if (severity === 'medium') {
        action = 'blocked';
      } else {
        action = 'warning';
      }

      // Log violation
      const violation = await logViolation({
        userId,
        contentType: 'message',
        contentId: null,
        reason: ('reason' in contentResult && contentResult.reason) ? contentResult.reason : 'Content filter violation',
        content,
        severity,
        action,
      });

      log.warn({
        userId,
        violationId: violation?.id,
        severity,
        action,
        violationCount,
      }, 'Message moderation violation');

      return {
        allowed: false,
        blocked: true,
        severity,
        reason: 'reason' in contentResult ? contentResult.reason : 'Contenido no permitido',
        suggestion: 'suggestion' in contentResult ? contentResult.suggestion : undefined,
        action,
        violationId: violation?.id || '',
        details: {
          contentFilter: 'violations' in contentResult ? contentResult : undefined,
          userHistory: { violationCount },
        },
      };
    }

    // All checks passed
    return {
      allowed: true,
      blocked: false,
      severity: 'low',
    };

  } catch (error) {
    log.error({ error, userId }, 'Error in message moderation');

    // En caso de error, permitir pero loggear
    return {
      allowed: true,
      blocked: false,
      severity: 'low',
      reason: 'Moderation check failed, allowing by default',
    };
  }
}

/**
 * Moderate a community post
 */
export async function moderatePost(
  userId: string,
  content: string,
  title?: string
): Promise<ModerationResult> {
  try {
    // 1. CHECK USER BAN
    const banStatus = await checkUserBan(userId, 'post');
    if (banStatus.banned) {
      return {
        allowed: false,
        blocked: true,
        severity: 'high',
        reason: banStatus.reason || 'No puedes crear posts en este momento',
        action: 'temp_ban',
      };
    }

    // 2. CHECK RATE LIMIT
    const rateLimit = await checkPostCreation(userId);
    if (!rateLimit.allowed) {
      return {
        allowed: false,
        blocked: true,
        severity: 'medium',
        reason: 'Has alcanzado el límite de posts',
        suggestion: `Espera ${Math.ceil((rateLimit.retryAfter || 3600) / 60)} minutos antes de crear otro post`,
        action: 'blocked',
      };
    }

    // 3. CONTENT FILTERING
    const fullContent = title ? `${title}\n\n${content}` : content;
    const contentResult = moderateContent(fullContent, {
      checkSpam: true,
      checkInjection: true,
      checkDangerous: true,
      checkProfanity: false,
    });

    if (!contentResult.allowed) {
      const violationCount = await getUserViolationCount(userId, 24);
      let action: ModerationResult['action'] = 'warning';
      let severity = contentResult.severity;

      if (violationCount >= 5 || severity === 'high') {
        action = 'temp_ban';
        await banUser(userId, 86400, 'Múltiples violaciones en posts', 'post');
      } else if (severity === 'medium') {
        action = 'blocked';
      }

      const violation = await logViolation({
        userId,
        contentType: 'post',
        contentId: null,
        reason: contentResult.overallReason || 'Content filter violation',
        content: fullContent,
        severity,
        action,
      });

      return {
        allowed: false,
        blocked: true,
        severity,
        reason: contentResult.overallReason,
        suggestion: contentResult.suggestion,
        action,
        violationId: violation?.id || '',
      };
    }

    return {
      allowed: true,
      blocked: false,
      severity: 'low',
    };

  } catch (error) {
    log.error({ error, userId }, 'Error in post moderation');
    return {
      allowed: true,
      blocked: false,
      severity: 'low',
    };
  }
}

/**
 * Moderate a comment
 */
export async function moderateComment(
  userId: string,
  content: string
): Promise<ModerationResult> {
  try {
    // 1. CHECK USER BAN
    const banStatus = await checkUserBan(userId, 'comment');
    if (banStatus.banned) {
      return {
        allowed: false,
        blocked: true,
        severity: 'high',
        reason: banStatus.reason || 'No puedes comentar en este momento',
        action: 'temp_ban',
      };
    }

    // 2. CHECK RATE LIMIT
    const rateLimit = await checkCommentCreation(userId);
    if (!rateLimit.allowed) {
      return {
        allowed: false,
        blocked: true,
        severity: 'medium',
        reason: 'Estás comentando demasiado rápido',
        suggestion: `Espera ${rateLimit.retryAfter} segundos`,
        action: 'blocked',
      };
    }

    // 3. CONTENT FILTERING (quick check for comments)
    const contentResult = quickModerate(content);

    if (!contentResult.allowed) {
      const violation = await logViolation({
        userId,
        contentType: 'comment',
        contentId: null,
        reason: contentResult.reason || 'Content filter violation',
        content,
        severity: 'high',
        action: 'blocked',
      });

      return {
        allowed: false,
        blocked: true,
        severity: 'high',
        reason: contentResult.reason,
        action: 'blocked',
        violationId: violation?.id,
      };
    }

    return {
      allowed: true,
      blocked: false,
      severity: 'low',
    };

  } catch (error) {
    log.error({ error, userId }, 'Error in comment moderation');
    return {
      allowed: true,
      blocked: false,
      severity: 'low',
    };
  }
}

/**
 * Flag content manually (user report)
 * @deprecated - contentViolation model no longer exists in schema
 */
export async function flagContent(_params: FlagContentParams): Promise<{
  success: boolean;
  flagId?: string;
  message: string;
}> {
  log.warn('flagContent called but contentViolation model no longer exists');
  return {
    success: false,
    message: 'Content flagging is currently disabled.',
  };
}

/**
 * Get user violation history
 * @deprecated - contentViolation model no longer exists in schema
 */
export async function getUserViolations(
  userId: string,
  options: {
    limit?: number;
    hoursBack?: number;
    severity?: 'low' | 'medium' | 'high';
  } = {}
): Promise<any[]> {
  return [];
}

/**
 * Get violation count for a user
 * @deprecated - contentViolation model no longer exists in schema
 */
async function getUserViolationCount(_userId: string, _hoursBack: number = 24): Promise<number> {
  return 0;
}

/**
 * Log a violation to database
 * @deprecated - contentViolation model no longer exists in schema
 */
async function logViolation(_params: {
  userId: string;
  contentType: string;
  contentId: string | null;
  reason: string;
  content: string;
  severity: 'low' | 'medium' | 'high';
  action: string;
}): Promise<{ id: string } | null> {
  return null;
}

/**
 * Get recent violations (admin)
 * @deprecated - contentViolation model no longer exists in schema
 */
export async function getRecentViolations(_options: {
  limit?: number;
  severity?: 'low' | 'medium' | 'high';
  action?: string;
  contentType?: string;
} = {}) {
  return [];
}

/**
 * Get moderation statistics
 * @deprecated - contentViolation model no longer exists in schema
 */
export async function getModerationStats(hoursBack: number = 24) {
  return {
    total: 0,
    bySeverity: [],
    byAction: [],
    byType: [],
    period: `Last ${hoursBack} hours`,
  };
}

/**
 * Check if user is banned
 * @deprecated - userBan model no longer exists in schema
 */
export async function isUserBanned(_userId: string): Promise<{
  banned: boolean;
  reason?: string;
  expiresAt?: Date;
}> {
  return { banned: false };
}

/**
 * Ban user permanently or temporarily
 * @deprecated - userBan model no longer exists in schema
 */
export async function banUserPermanent(
  userId: string,
  reason: string,
  expiresAt?: Date
): Promise<void> {
  log.warn({ userId, reason, expiresAt }, 'banUserPermanent called but userBan model no longer exists');
}

/**
 * Unban user
 * @deprecated - userBan model no longer exists in schema
 */
export async function unbanUserPermanent(userId: string): Promise<void> {
  log.info({ userId }, 'unbanUserPermanent called but userBan model no longer exists');
}

/**
 * Get top violators (admin)
 * @deprecated - contentViolation model no longer exists in schema
 */
export async function getTopViolators(_limit: number = 20, _hoursBack: number = 168) {
  return [];
}
