/** AutoMod Service - Automatic moderation with configurable rules */

import { prisma } from '@/lib/prisma';

interface AutoModCheckResult {
  passed: boolean;
  triggeredRules: Array<{
    ruleId: string;
    ruleName: string;
    action: string;
    reason: string;
  }>;
  finalAction: 'allow' | 'remove' | 'flag' | 'auto_report' | 'mute' | 'ban';
}

/** Validate rule configuration based on its type */
function validateRuleConfig(type: string, config: any): void {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be a valid object');
  }

  switch (type) {
    case 'banned_words':
      if (!Array.isArray(config.words)) {
        throw new Error('banned_words requires config.words as array');
      }
      if (config.words.length > 1000) {
        throw new Error('Maximum 1000 banned words');
      }
      break;

    case 'spam_filter':
      if (config.maxLinks !== undefined && (typeof config.maxLinks !== 'number' || config.maxLinks < 0 || config.maxLinks > 50)) {
        throw new Error('maxLinks must be a number between 0 and 50');
      }
      break;

    case 'karma_minimum':
      if (typeof config.minKarma !== 'number' || config.minKarma < 0) {
        throw new Error('minKarma must be a positive number');
      }
      break;

    case 'account_age':
      if (typeof config.minAge !== 'number' || config.minAge < 0 || config.minAge > 365) {
        throw new Error('minAge must be a number between 0 and 365 days');
      }
      break;

    case 'link_filter':
      if (config.whitelist && !Array.isArray(config.whitelist)) {
        throw new Error('whitelist must be an array');
      }
      if (config.blacklist && !Array.isArray(config.blacklist)) {
        throw new Error('blacklist must be an array');
      }
      break;

    case 'caps_filter':
      if (typeof config.maxCapsPercent !== 'number' || config.maxCapsPercent < 0 || config.maxCapsPercent > 100) {
        throw new Error('maxCapsPercent must be a number between 0 and 100');
      }
      break;

    default:
      throw new Error(`Unknown rule type: ${type}`);
  }
}

export const AutoModService = {
  /**
   * Check content against AutoMod rules
   */
  async checkContent(data: {
    content: string;
    title?: string;
    authorId: string;
    communityId: string;
    type: 'post' | 'comment';
  }): Promise<AutoModCheckResult> {
    // Get active community rules
    // Note: autoModRule model may not exist in schema, returning empty array
    const rules: any[] = []; // TODO: Replace with actual query when autoModRule model is added
    /*
    const rules = await prisma.autoModRule.findMany({
      where: {
        communityId: data.communityId,
        isActive: true,
        OR: [
          { applyTo: data.type },
          { applyTo: 'both' },
        ],
      },
      orderBy: {
        action: 'desc', // Prioritize more severe actions
      },
    });
    */

    if (rules.length === 0) {
      return {
        passed: true,
        triggeredRules: [],
        finalAction: 'allow',
      };
    }

    const triggeredRules: Array<{
      ruleId: string;
      ruleName: string;
      action: string;
      reason: string;
    }> = [];

    // Verificar cada regla
    for (const rule of rules) {
      const violated = await this.checkRule(rule, data);

      if (violated) {
        triggeredRules.push({
          ruleId: rule.id,
          ruleName: rule.name,
          action: rule.action,
          reason: violated,
        });

        // Incrementar contador
        // TODO: Uncomment when autoModRule model is added
        /*
        await prisma.autoModRule.update({
          where: { id: rule.id },
          data: {
            triggeredCount: {
              increment: 1,
            },
          },
        });
        */
      }
    }

    // Determine final action (the most severe)
    let finalAction: AutoModCheckResult['finalAction'] = 'allow';

    if (triggeredRules.length > 0) {
      const actionSeverity = {
        flag: 1,
        auto_report: 2,
        mute: 3,
        remove: 4,
        ban: 5,
      };

      const mostSevere = triggeredRules.reduce((prev, curr) => {
        const prevSeverity = actionSeverity[prev.action as keyof typeof actionSeverity] || 0;
        const currSeverity = actionSeverity[curr.action as keyof typeof actionSeverity] || 0;
        return currSeverity > prevSeverity ? curr : prev;
      });

      finalAction = mostSevere.action as AutoModCheckResult['finalAction'];
    }

    return {
      passed: triggeredRules.length === 0,
      triggeredRules,
      finalAction,
    };
  },

  /** Verify a specific rule */
  async checkRule(
    rule: any,
    data: {
      content: string;
      title?: string;
      authorId: string;
      type: 'post' | 'comment';
    }
  ): Promise<string | null> {
    const config = rule.config as any;
    const fullText = (data.title ? data.title + ' ' : '') + data.content;

    switch (rule.type) {
      case 'banned_words':
        return this.checkBannedWords(fullText, config.words || []);

      case 'spam_filter':
        return this.checkSpam(fullText, config);

      case 'karma_minimum':
        return await this.checkKarma(data.authorId, config.minKarma || 0);

      case 'account_age':
        return await this.checkAccountAge(data.authorId, config.minAge || 0);

      case 'link_filter':
        return this.checkLinks(fullText, config);

      case 'caps_filter':
        return this.checkCaps(fullText, config.maxCapsPercent || 50);

      default:
        return null;
    }
  },

  /**
   * Verificar palabras prohibidas
   */
  checkBannedWords(text: string, bannedWords: string[]): string | null {
    if (!bannedWords || bannedWords.length === 0) return null;

    const lowerText = text.toLowerCase();
    const found = bannedWords.find(word => {
      // Escapar caracteres especiales de regex para prevenir ReDoS
      const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
      return pattern.test(lowerText);
    });

    if (found) {
      return `Contiene palabra prohibida: "${found}"`;
    }

    return null;
  },

  /** Detect spam (repetitive content, multiple links, etc.) */
  checkSpam(text: string, config: any): string | null {
    // Detect multiple links
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlPattern) || [];

    if (config.maxLinks && urls.length > config.maxLinks) {
      return `Demasiados links (${urls.length} de ${config.maxLinks} permitidos)`;
    }

    // Detectar caracteres repetidos
    const repeatedPattern = /(.)\1{10,}/g;
    if (repeatedPattern.test(text)) {
      return 'Contiene caracteres excesivamente repetidos';
    }

    // Detectar palabras repetidas
    const words = text.toLowerCase().split(/\s+/);
    const wordCounts: Record<string, number> = {};
    for (const word of words) {
      if (word.length > 3) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        if (wordCounts[word] > 10) {
          return `Palabra "${word}" repetida excesivamente`;
        }
      }
    }

    return null;
  },

  /** Verify minimum user karma */
  async checkKarma(userId: string, minKarma: number): Promise<string | null> {
    // Calculate user karma (posts upvotes - downvotes)
    const posts = await prisma.communityPost.findMany({
      where: { authorId: userId },
      select: { score: true },
    });

    const totalKarma = posts.reduce((sum, post) => sum + post.score, 0);

    if (totalKarma < minKarma) {
      return `Karma insuficiente (${totalKarma} de ${minKarma} requeridos)`;
    }

    return null;
  },

  /**
   * Verificar antigüedad de la cuenta
   */
  async checkAccountAge(userId: string, minAgeDays: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) return null;

    const accountAge = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (accountAge < minAgeDays) {
      return `Account too new (${Math.floor(accountAge)} days of ${minAgeDays} required)`;
    }

    return null;
  },

  /** Filter links (block specific domains or allow only whitelisted) */
  checkLinks(text: string, config: any): string | null {
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urls = text.match(urlPattern) || [];

    if (urls.length === 0) return null;

    // Whitelist mode
    if (config.whitelist && config.whitelist.length > 0) {
      const allowed = urls.every(url => {
        return config.whitelist.some((domain: string) => url.includes(domain));
      });

      if (!allowed) {
        return 'Links solo permitidos de dominios autorizados';
      }
    }

    // Blacklist mode
    if (config.blacklist && config.blacklist.length > 0) {
      const blocked = urls.find(url => {
        return config.blacklist.some((domain: string) => url.includes(domain));
      });

      if (blocked) {
        return `Link bloqueado: ${blocked}`;
      }
    }

    return null;
  },

  /** Check for excessive uppercase */
  checkCaps(text: string, maxPercent: number): string | null {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return null;

    const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
    const percent = (uppercaseCount / letters.length) * 100;

    if (percent > maxPercent) {
      return `Excessive caps (${Math.round(percent)}% of ${maxPercent}% allowed)`;
    }

    return null;
  },

  /**
   * Crear regla de AutoMod
   */
  async createRule(data: {
    communityId: string;
    name: string;
    description?: string;
    type: string;
    config: any;
    action?: string;
    applyTo?: string;
  }) {
    // Validate tipo de regla
    const validTypes = ['banned_words', 'spam_filter', 'karma_minimum', 'account_age', 'link_filter', 'caps_filter'];
    if (!validTypes.includes(data.type)) {
      throw new Error('Invalid rule type');
    }

    // Validate action
    const validActions = ['remove', 'flag', 'auto_report', 'mute', 'ban'];
    if (data.action && !validActions.includes(data.action)) {
      throw new Error('Invalid action');
    }

    // Validate applyTo
    const validApplyTo = ['post', 'comment', 'both'];
    if (data.applyTo && !validApplyTo.includes(data.applyTo)) {
      throw new Error('Invalid applyTo');
    }

    // Validate config based on type
    validateRuleConfig(data.type, data.config);

    // TODO: Uncomment when autoModRule model is added
    throw new Error('autoModRule model not available in schema');
    /*
    const rule = await prisma.autoModRule.create({
      data: {
        communityId: data.communityId,
        name: data.name,
        description: data.description,
        type: data.type,
        config: data.config,
        action: data.action || 'remove',
        applyTo: data.applyTo || 'both',
        isActive: true,
      },
    });

    return rule;
    */
  },

  /**
   * Actualizar regla
   */
  async updateRule(ruleId: string, updates: any) {
    // Prevent mass assignment - only allow specific fields
    const allowedFields = ['name', 'description', 'config', 'action', 'applyTo', 'isActive'];
    const sanitizedUpdates: any = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    // Get current rule to validate config
    // TODO: Uncomment when autoModRule model is added
    throw new Error('autoModRule model not available in schema');
    /*
    const currentRule = await prisma.autoModRule.findUnique({
      where: { id: ruleId },
    });

    if (!currentRule) {
      throw new Error('Regla no encontrada');
    }

    // Si se actualiza el config, validarlo
    if (sanitizedUpdates.config) {
      validateRuleConfig(currentRule.type, sanitizedUpdates.config);
    }

    // Validate action si se proporciona
    if (sanitizedUpdates.action) {
      const validActions = ['remove', 'flag', 'auto_report', 'mute', 'ban'];
      if (!validActions.includes(sanitizedUpdates.action)) {
        throw new Error('Invalid action');
      }
    }

    // Validate applyTo si se proporciona
    if (sanitizedUpdates.applyTo) {
      const validApplyTo = ['post', 'comment', 'both'];
      if (!validApplyTo.includes(sanitizedUpdates.applyTo)) {
        throw new Error('Invalid applyTo');
      }
    }

    const rule = await prisma.autoModRule.update({
      where: { id: ruleId },
      data: sanitizedUpdates,
    });

    return rule;
    */
  },

  /**
   * Eliminar regla
   */
  async deleteRule(_ruleId: string) {
    // TODO: Uncomment when autoModRule model is added
    throw new Error('autoModRule model not available in schema');
    /*
    await prisma.autoModRule.delete({
      where: { id: ruleId },
    });

    return { success: true };
    */
  },

  /**
   * Obtener reglas de una comunidad
   */
  async getRules(_communityId: string) {
    // TODO: Uncomment when autoModRule model is added
    return [];
    /*
    const rules = await prisma.autoModRule.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
    });

    return rules;
    */
  },

  /** Get AutoMod statistics */
  async getStats(_communityId: string) {
    // TODO: Uncomment when autoModRule model is added
    return {
      totalRules: 0,
      activeRules: 0,
      totalTriggers: 0,
      rules: [],
    };
    /*
    const rules = await prisma.autoModRule.findMany({
      where: { communityId },
      select: {
        id: true,
        name: true,
        type: true,
        triggeredCount: true,
        isActive: true,
      },
    });

    const totalTriggers = rules.reduce((sum: number, rule: any) => sum + rule.triggeredCount, 0);
    const activeRules = rules.filter((r: any) => r.isActive).length;

    return {
      totalRules: rules.length,
      activeRules,
      totalTriggers,
      rules,
    };
    */
  },
};
