/**
 * PII SANITIZATION SERVICE
 *
 * Detects and redacts Personally Identifiable Information (PII) from text
 *
 * Usage:
 * ```typescript
 * const sanitizer = new PIISanitizer();
 * const result = await sanitizer.sanitize(userMessage, PIIContexts.CHAT_MESSAGE);
 *
 * if (result.containsPII) {
 *   console.warn('PII detected:', result.detections);
 *   // Use result.sanitized instead of original
 * }
 * ```
 */

import {
  PIIType,
  type PIIPattern,
  type PIIContext,
  ALL_PII_PATTERNS,
  getPatternsForContext,
  PII_CONTEXTS,
} from "./detection-patterns";

export interface PIIDetection {
  type: PIIType;
  match: string; // The matched PII
  position: number; // Position in original text
  severity: "critical" | "high" | "medium" | "low";
  confidence: number; // 0-1, based on validator
}

export interface SanitizationResult {
  original: string; // Original text (truncated for privacy)
  sanitized: string; // Text with PII redacted
  containsPII: boolean;
  detections: PIIDetection[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface SanitizationOptions {
  context?: PIIContext;
  patterns?: PIIPattern[]; // Custom patterns to use
  redactAll?: boolean; // Redact even low-confidence matches
  preserveFormat?: boolean; // Keep original format (e.g., "XXX-XX-1234" for SSN)
  logDetections?: boolean; // Log PII detections for audit
}

/**
 * PII Sanitization Service
 */
export class PIISanitizer {
  private detectionLog: PIIDetection[] = [];

  /**
   * Sanitize text by detecting and redacting PII
   */
  async sanitize(
    text: string,
    options: SanitizationOptions = {}
  ): Promise<SanitizationResult> {
    const {
      context = PII_CONTEXTS.CHAT_MESSAGE,
      patterns = getPatternsForContext(context),
      redactAll = false,
      preserveFormat = false,
      logDetections = true,
    } = options;

    const detections: PIIDetection[] = [];
    let sanitized = text;

    // Process each pattern
    for (const pattern of patterns) {
      // Reset regex lastIndex to avoid issues with global flag
      pattern.regex.lastIndex = 0;

      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        const matchedText = match[0];
        const position = match.index || 0;

        // Skip false positives
        if (this.isFalsePositive(matchedText, pattern)) {
          continue;
        }

        // Validate match if validator exists
        let confidence = 1.0;
        if (pattern.validator) {
          const isValid = pattern.validator(matchedText);
          if (!isValid && !redactAll) {
            continue; // Skip low-confidence matches unless redactAll is true
          }
          confidence = isValid ? 1.0 : 0.5;
        }

        // Record detection
        const detection: PIIDetection = {
          type: pattern.type,
          match: matchedText,
          position,
          severity: pattern.severity,
          confidence,
        };

        detections.push(detection);

        // Redact in sanitized text
        const redaction = preserveFormat
          ? this.preserveFormatRedaction(matchedText, pattern)
          : pattern.redactionTemplate;

        sanitized = sanitized.replace(matchedText, redaction);
      }
    }

    // Generate summary
    const summary = this.generateSummary(detections);

    // Log if enabled
    if (logDetections && detections.length > 0) {
      this.logDetection(detections);
    }

    return {
      original: text.substring(0, 100), // Truncate for privacy
      sanitized,
      containsPII: detections.length > 0,
      detections,
      summary,
    };
  }

  /**
   * Check if text contains PII (quick check without sanitization)
   */
  async containsPII(
    text: string,
    context: PIIContext = PII_CONTEXTS.CHAT_MESSAGE
  ): Promise<boolean> {
    const patterns = getPatternsForContext(context);

    for (const pattern of patterns) {
      // Reset regex lastIndex to avoid issues with global flag
      pattern.regex.lastIndex = 0;

      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        const matchedText = match[0];

        // Skip false positives
        if (this.isFalsePositive(matchedText, pattern)) {
          continue;
        }

        // Validate if validator exists
        if (pattern.validator && !pattern.validator(matchedText)) {
          continue;
        }

        return true; // Found valid PII
      }
    }

    return false;
  }

  /**
   * Get specific PII types from text
   */
  async detectTypes(
    text: string,
    context: PIIContext = PII_CONTEXTS.CHAT_MESSAGE
  ): Promise<PIIType[]> {
    const result = await this.sanitize(text, { context, logDetections: false });
    return [...new Set(result.detections.map((d) => d.type))];
  }

  /**
   * Sanitize with warning (returns both sanitized + warning message)
   */
  async sanitizeWithWarning(
    text: string,
    options: SanitizationOptions = {}
  ): Promise<{
    sanitized: string;
    warning?: string;
    detections: PIIDetection[];
  }> {
    const result = await this.sanitize(text, options);

    if (!result.containsPII) {
      return {
        sanitized: result.sanitized,
        detections: result.detections,
      };
    }

    // Generate user-friendly warning
    const warning = this.generateWarningMessage(result.detections);

    return {
      sanitized: result.sanitized,
      warning,
      detections: result.detections,
    };
  }

  /**
   * Check if match is a false positive
   */
  private isFalsePositive(match: string, pattern: PIIPattern): boolean {
    if (!pattern.falsePositivePatterns) return false;

    for (const falsePattern of pattern.falsePositivePatterns) {
      if (falsePattern.test(match)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Redact while preserving format (e.g., XXX-XX-1234 for SSN)
   */
  private preserveFormatRedaction(match: string, pattern: PIIPattern): string {
    switch (pattern.type) {
      case PIIType.SSN:
        // Show last 4 digits: XXX-XX-1234
        const cleaned = match.replace(/-/g, "");
        const last4 = cleaned.slice(-4);
        return match.includes("-")
          ? `XXX-XX-${last4}`
          : `XXXXX${last4}`;

      case PIIType.CREDIT_CARD:
        // Show last 4 digits: **** **** **** 1234
        const last4cc = match.slice(-4);
        return `**** **** **** ${last4cc}`;

      case PIIType.PHONE:
        // Show area code: (555) XXX-XXXX
        const phoneDigits = match.replace(/\D/g, "");
        if (phoneDigits.length === 10) {
          return `(${phoneDigits.slice(0, 3)}) XXX-XXXX`;
        }
        return "[PHONE REDACTED]";

      default:
        return pattern.redactionTemplate;
    }
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(detections: PIIDetection[]): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const detection of detections) {
      // Count by severity
      bySeverity[detection.severity] =
        (bySeverity[detection.severity] || 0) + 1;

      // Count by type
      byType[detection.type] = (byType[detection.type] || 0) + 1;
    }

    return {
      total: detections.length,
      bySeverity,
      byType,
    };
  }

  /**
   * Generate user-friendly warning message
   */
  private generateWarningMessage(detections: PIIDetection[]): string {
    const criticalCount = detections.filter(
      (d) => d.severity === "critical"
    ).length;
    const highCount = detections.filter((d) => d.severity === "high").length;

    const types = [...new Set(detections.map((d) => this.getTypeName(d.type)))];

    if (criticalCount > 0) {
      return `⚠️ ALERTA: Detectamos información personal sensible (${types.join(", ")}). Esta información ha sido redactada por tu seguridad. Por favor, NUNCA compartas SSN, tarjetas de crédito, o información bancaria en chats.`;
    }

    if (highCount > 0) {
      return `⚠️ Detectamos información personal (${types.join(", ")}). Hemos redactado esta información para proteger tu privacidad.`;
    }

    return `ℹ️ Detectamos información que podría ser personal. La hemos redactado por precaución.`;
  }

  /**
   * Get user-friendly type name
   */
  private getTypeName(type: PIIType): string {
    const names: Record<PIIType, string> = {
      [PIIType.SSN]: "número de seguro social",
      [PIIType.CREDIT_CARD]: "tarjeta de crédito",
      [PIIType.BANK_ACCOUNT]: "cuenta bancaria",
      [PIIType.ROUTING_NUMBER]: "número de ruta bancaria",
      [PIIType.EMAIL]: "correo electrónico",
      [PIIType.PHONE]: "número de teléfono",
      [PIIType.ADDRESS]: "dirección física",
      [PIIType.PASSPORT]: "número de pasaporte",
      [PIIType.DRIVERS_LICENSE]: "licencia de conducir",
      [PIIType.TAX_ID]: "número de identificación fiscal",
      [PIIType.IP_ADDRESS]: "dirección IP",
      [PIIType.MAC_ADDRESS]: "dirección MAC",
      [PIIType.DATE_OF_BIRTH]: "fecha de nacimiento",
      [PIIType.FULL_NAME]: "nombre completo",
      [PIIType.MEDICAL_RECORD]: "registro médico",
      [PIIType.INSURANCE_NUMBER]: "número de seguro",
    };

    return names[type] || type;
  }

  /**
   * Log detection for audit
   */
  private logDetection(detections: PIIDetection[]): void {
    const critical = detections.filter((d) => d.severity === "critical");

    if (critical.length > 0) {
      console.error(
        `[PII CRITICAL] Detected ${critical.length} critical PII items:`,
        critical.map((d) => d.type).join(", ")
      );
    } else {
      console.warn(
        `[PII DETECTED] Found ${detections.length} PII items:`,
        detections.map((d) => d.type).join(", ")
      );
    }

    // Store for audit (in production, send to secure logging service)
    this.detectionLog.push(...detections);
  }

  /**
   * Get detection logs (for audit)
   */
  getDetectionLogs(): PIIDetection[] {
    return this.detectionLog;
  }

  /**
   * Clear detection logs
   */
  clearLogs(): void {
    this.detectionLog = [];
  }

  /**
   * Export logs for compliance reporting
   */
  exportLogs(): {
    timestamp: Date;
    totalDetections: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
  } {
    const summary = this.generateSummary(this.detectionLog);

    return {
      timestamp: new Date(),
      totalDetections: summary.total,
      bySeverity: summary.bySeverity,
      byType: summary.byType,
    };
  }
}

/**
 * Singleton instance
 */
export const piiSanitizer = new PIISanitizer();

/**
 * Helper: Quick sanitize with default options
 */
export async function sanitizeText(
  text: string,
  context: PIIContext = PII_CONTEXTS.CHAT_MESSAGE
): Promise<string> {
  const result = await piiSanitizer.sanitize(text, { context });
  return result.sanitized;
}

/**
 * Helper: Check if text contains critical PII
 */
export async function containsCriticalPII(text: string): Promise<boolean> {
  const result = await piiSanitizer.sanitize(text, {
    context: PII_CONTEXTS.STRICT_COMPLIANCE,
    logDetections: false,
  });

  return result.detections.some((d) => d.severity === "critical");
}

/**
 * Helper: Sanitize and return warning if PII found
 */
export async function sanitizeWithAlert(
  text: string,
  context: PIIContext = PII_CONTEXTS.CHAT_MESSAGE
): Promise<{
  text: string;
  alert?: string;
  hasPII: boolean;
}> {
  const result = await piiSanitizer.sanitizeWithWarning(text, { context });

  return {
    text: result.sanitized,
    alert: result.warning,
    hasPII: result.detections.length > 0,
  };
}
