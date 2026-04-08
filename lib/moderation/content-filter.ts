/**
 * Content Filter System
 *
 * Detects inappropriate content, spam, prompt injection, and dangerous content
 * Performance target: < 10ms per message
 * False positive target: < 1%
 */

export interface FilterResult {
  passed: boolean;
  severity: 'low' | 'medium' | 'high';
  reason?: string;
  suggestion?: string;
  details?: string[];
  confidence: number; // 0-1
}

// ============================================
// SPAM DETECTION
// ============================================

/**
 * Detect spam in text
 */
export function checkSpam(text: string): FilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';
  let confidence = 0;

  // 1. Excessive repetition of characters (aaaaaaa)
  const repeatedChars = text.match(/(.)\1{5,}/g);
  if (repeatedChars) {
    violations.push('Repetición excesiva de caracteres');
    severity = 'low';
    confidence += 0.3;
  }

  // 2. EXCESIVE CAPS (>60% del texto)
  const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (upperCaseRatio > 0.6 && text.length > 20) {
    violations.push('Uso excesivo de mayúsculas');
    severity = 'low';
    confidence += 0.2;
  }

  // 3. URLs ON MASS (>3 URLs)
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|net|org|io|co|me|dev|app|xyz|link|site)[^\s]*)/gi;
  const urls = text.match(urlPattern) || [];
  if (urls.length > 3) {
    violations.push(`Demasiados enlaces (${urls.length})`);
    severity = 'medium';
    confidence += 0.4;
  }

  // 4. KEYWORD OF SPAM (case-insensitive)
  const spamKeywords = [
    /\b(free money|win now|act now|limited offer|special promotion)\b/i,
    /\b(click here|subscribe now|buy now|order now)\b/i,
    /\b(guaranteed|congratulations|you've won|winner|prize)\b/i,
    /\b(weight loss|viagra|cialis|pharmacy|pills)\b/i,
    /\b(earn \$|make money|work from home|get rich|financial freedom)\b/i,
    /\b(mlm|multi-level marketing|pyramid scheme)\b/i,
  ];

  let spamKeywordCount = 0;
  spamKeywords.forEach(pattern => {
    if (pattern.test(text)) {
      spamKeywordCount++;
    }
  });

  if (spamKeywordCount >= 2) {
    violations.push('Contiene palabras clave de spam');
    severity = 'medium';
    confidence += 0.5;
  }

  // 5. Excessive EMOJIS (>30% of content is emojis)
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiPattern) || []).length;
  const emojiRatio = emojiCount / text.length;
  if (emojiRatio > 0.3 && text.length > 10) {
    violations.push('Uso excesivo de emojis');
    severity = 'low';
    confidence += 0.2;
  }

  // 6. Short repetitive message  (< 5 characters)
  if (text.trim().length < 5 && text.trim().length > 0) {
    violations.push('Mensaje demasiado corto');
    severity = 'low';
    confidence += 0.3;
  }

  const passed = violations.length === 0;

  return {
    passed,
    severity,
    reason: passed ? undefined : 'Contenido marcado como spam',
    suggestion: passed ? undefined : 'Evita enlaces múltiples, mayúsculas excesivas y palabras clave de spam',
    details: violations,
    confidence: Math.min(confidence, 1),
  };
}

// ============================================
// PROMPT INJECTION DETECTION
// ============================================

/**
 * Detects prompt injection and bypass attempts
 */
export function checkPromptInjection(text: string): FilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'medium';
  let confidence = 0;

  const textLower = text.toLowerCase();

  // CRITICAL PATTERNS (High Severity)
  const criticalPatterns = [
    { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i, desc: 'Attempt to ignore instructions', confidence: 0.9 },
    { pattern: /forget\s+(your\s+|all\s+)?(rules?|instructions?|guidelines?|constraints?)/i, desc: 'Attempt to forget rules', confidence: 0.9 },
    { pattern: /you\s+are\s+now\s+(in\s+)?(developer|admin|god|root)\s+mode/i, desc: 'Attempt to enable developer mode', confidence: 0.95 },
    { pattern: /\b(DAN|DUDE|STAN)\s+mode/i, desc: 'Known jailbreak attempt', confidence: 0.95 },
    { pattern: /repeat\s+(after\s+me|the\s+following|this):\s*system/i, desc: 'Prompt leak attempt', confidence: 0.8 },
    { pattern: /show\s+(me\s+)?(your\s+)?(system\s+prompt|instructions|rules)/i, desc: 'System prompt request', confidence: 0.85 },
    { pattern: /what\s+(are\s+|is\s+)?(your\s+)?(initial\s+)?(instructions?|prompts?|rules?)/i, desc: 'Initial instructions request', confidence: 0.85 },
  ];

  criticalPatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      severity = 'high';
      confidence = Math.max(confidence, conf);
    }
  });

  // MODERATE PATTERNS (Medium Severity)
  const moderatePatterns = [
    { pattern: /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|another|evil|bad)/i, desc: 'Role change attempt', confidence: 0.6 },
    { pattern: /\[SYSTEM\]|\[ADMIN\]|\[ROOT\]|\[DEVELOPER\]/i, desc: 'System command injection', confidence: 0.8 },
    { pattern: /sudo\s+\w+|chmod\s+777|rm\s+-rf|eval\(|exec\(/i, desc: 'Dangerous system commands', confidence: 0.9 },
    { pattern: /bypass\s+(your\s+)?(safety|filter|moderation|restrictions?)/i, desc: 'Security bypass attempt', confidence: 0.85 },
    { pattern: /disable\s+(your\s+)?(filter|safety|moderation|ethics)/i, desc: 'Filter disabling attempt', confidence: 0.85 },
  ];

  moderatePatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      severity = severity === 'high' ? 'high' : 'medium';
      confidence = Math.max(confidence, conf);
    }
  });

  // SUSPICIOUS PATTERNS (Low-Medium Severity)
  const suspiciousPatterns = [
    { pattern: /new\s+role|new\s+character|new\s+personality/i, desc: 'Possible personality change attempt', confidence: 0.4 },
    { pattern: /from\s+now\s+on|starting\s+now|new\s+instructions?/i, desc: 'Possible new instructions attempt', confidence: 0.5 },
    { pattern: /<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>/i, desc: 'Special model tokens', confidence: 0.9 },
  ];

  suspiciousPatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      if (severity === 'low') severity = 'medium';
      confidence = Math.max(confidence, conf * 0.7); // Reduce confidence for suspicious patterns
    }
  });

  // CONTEXT MANIPULATION DETECTION
  if (textLower.includes('system:') || textLower.includes('assistant:') || textLower.includes('user:')) {
    violations.push('Chat context manipulation attempt');
    severity = 'high';
    confidence = Math.max(confidence, 0.8);
  }

  const passed = violations.length === 0;

  return {
    passed,
    severity,
    reason: passed ? undefined : 'System manipulation attempt detected',
    suggestion: passed ? undefined : 'Do not attempt to modify system instructions or access internal rules',
    details: violations,
    confidence,
  };
}

// ============================================
// PROFANITY & OFFENSIVE CONTENT DETECTION (OPTIONAL)
// ============================================

/**
 * Detects offensive language (configurable)
 * NOTE: Use with caution to avoid false positives
 */
export function checkProfanity(text: string, strictMode: boolean = false): FilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'low';
  let confidence = 0;

  const _textLower = text.toLowerCase();

  // Offensive words in Spanish (sample - expand as needed)
  const offensiveWords = [
    // Basic insults
    /\b(imbecil|idiota|estupido|tonto|pendejo|boludo|pelotudo|tarado)\b/i,
    // Discrimination
    /\b(negro|chino|judio|marica|puto|trolo)\b/i,
  ];

  // Only in strict mode
  if (strictMode) {
    offensiveWords.forEach(pattern => {
      if (pattern.test(text)) {
        violations.push('Potentially offensive language');
        severity = 'medium';
        confidence = 0.6; // Low confidence to avoid false positives
      }
    });
  }

  // HATE SPEECH (always detect)
  const hateSpeechPatterns = [
    /\b(kill|murder|die|death)\s+(all\s+)?\w+s?\b/i,
    /\b(hate|despise)\s+(all\s+)?\w+s?\b/i,
  ];

  hateSpeechPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      violations.push('Hate speech detected');
      severity = 'high';
      confidence = 0.8;
    }
  });

  const passed = violations.length === 0;

  return {
    passed,
    severity,
    reason: passed ? undefined : 'Offensive content detected',
    suggestion: passed ? undefined : 'Use respectful language in your messages',
    details: violations,
    confidence,
  };
}

// ============================================
// DANGEROUS CONTENT DETECTION
// ============================================

/**
 * Detects dangerous content: phishing, malware, scams
 */
export function checkDangerousContent(text: string): FilterResult {
  const violations: string[] = [];
  let severity: 'low' | 'medium' | 'high' = 'medium';
  let confidence = 0;

  const _textLower = text.toLowerCase();

  // 1. URL SHORTENERS (potential phishing)
  const shortenerPatterns = [
    /bit\.ly|tinyurl|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly/i,
    /t\.co|short\.link|tiny\.cc|cli\.gs|short\.io/i,
  ];

  shortenerPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      violations.push('Suspicious shortened URL detected');
      severity = 'medium';
      confidence = Math.max(confidence, 0.6);
    }
  });

  // 2. PHISHING KEYWORDS
  const phishingPatterns = [
    { pattern: /verify\s+(your\s+)?(account|identity|email|payment)/i, desc: 'Suspicious verification request', confidence: 0.7 },
    { pattern: /update\s+(your\s+)?(password|billing|payment\s+info)/i, desc: 'Suspicious update request', confidence: 0.7 },
    { pattern: /click\s+(here|now)\s+(to\s+)?(claim|verify|confirm|unlock)/i, desc: 'Suspicious call to action', confidence: 0.7 },
    { pattern: /account\s+(suspended|locked|expired|compromised)/i, desc: 'Urgency tactic', confidence: 0.75 },
    { pattern: /confirm\s+(your\s+)?(identity|email|card|payment)/i, desc: 'Suspicious confirmation request', confidence: 0.7 },
  ];

  phishingPatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      severity = 'high';
      confidence = Math.max(confidence, conf);
    }
  });

  // 3. MALWARE INDICATORS
  const malwarePatterns = [
    { pattern: /download\s+(this\s+)?(crack|keygen|patch|activator)/i, desc: 'Cracked software', confidence: 0.8 },
    { pattern: /\.exe\s+(file|download)|download\s+\.exe/i, desc: 'Executable download', confidence: 0.6 },
    { pattern: /install\s+(this\s+)?(trojan|virus|malware|keylogger)/i, desc: 'Malware mentioned', confidence: 0.9 },
  ];

  malwarePatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      severity = 'high';
      confidence = Math.max(confidence, conf);
    }
  });

  // 4. FINANCIAL SCAMS
  const scamPatterns = [
    { pattern: /send\s+(me\s+)?\$?\d+|wire\s+transfer|western\s+union/i, desc: 'Transfer request', confidence: 0.7 },
    { pattern: /bitcoin\s+address|crypto\s+wallet|send\s+(btc|eth|usdt)/i, desc: 'Cryptocurrency request', confidence: 0.6 },
    { pattern: /nigerian\s+prince|inheritance\s+money/i, desc: 'Known scam', confidence: 0.95 },
  ];

  scamPatterns.forEach(({ pattern, desc, confidence: conf }) => {
    if (pattern.test(text)) {
      violations.push(desc);
      severity = 'high';
      confidence = Math.max(confidence, conf);
    }
  });

  // 5. CREDENTIAL HARVESTING
  const credentialPatterns = [
    /enter\s+(your\s+)?(password|username|email|credit\s+card)/i,
    /provide\s+(your\s+)?(ssn|social\s+security|card\s+number)/i,
  ];

  credentialPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      violations.push('Credentials request');
      severity = 'high';
      confidence = Math.max(confidence, 0.8);
    }
  });

  const passed = violations.length === 0;

  return {
    passed,
    severity,
    reason: passed ? undefined : 'Dangerous content detected',
    suggestion: passed ? undefined : 'Do not share suspicious links or personal information requests',
    details: violations,
    confidence,
  };
}

// ============================================
// COMBINED CONTENT FILTER
// ============================================

export interface ContentModerationResult {
  allowed: boolean;
  blocked: boolean;
  severity: 'low' | 'medium' | 'high';
  violations: {
    type: 'spam' | 'prompt_injection' | 'profanity' | 'dangerous';
    result: FilterResult;
  }[];
  highestConfidence: number;
  overallReason?: string;
  suggestion?: string;
}

/**
 * Runs all filters in a single step
 */
export function moderateContent(
  text: string,
  options: {
    checkSpam?: boolean;
    checkInjection?: boolean;
    checkProfanity?: boolean;
    strictProfanity?: boolean;
    checkDangerous?: boolean;
  } = {}
): ContentModerationResult {
  const {
    checkSpam: enableSpam = true,
    checkInjection = true,
    checkProfanity: enableProfanity = false, // Disabled by default to avoid false positives
    strictProfanity = false,
    checkDangerous = true,
  } = options;

  const violations: ContentModerationResult['violations'] = [];
  let highestSeverity: 'low' | 'medium' | 'high' = 'low';
  let highestConfidence = 0;

  // Run all checks
  if (enableSpam) {
    const spamResult = checkSpam(text);
    if (!spamResult.passed) {
      violations.push({ type: 'spam', result: spamResult });
      highestConfidence = Math.max(highestConfidence, spamResult.confidence);
      if (spamResult.severity === 'high' || (spamResult.severity === 'medium' && highestSeverity === 'low')) {
        highestSeverity = spamResult.severity;
      }
    }
  }

  if (checkInjection) {
    const injectionResult = checkPromptInjection(text);
    if (!injectionResult.passed) {
      violations.push({ type: 'prompt_injection', result: injectionResult });
      highestConfidence = Math.max(highestConfidence, injectionResult.confidence);
      if (injectionResult.severity === 'high' || (injectionResult.severity === 'medium' && highestSeverity === 'low')) {
        highestSeverity = injectionResult.severity;
      }
    }
  }

  if (enableProfanity) {
    const profanityResult = checkProfanity(text, strictProfanity);
    if (!profanityResult.passed) {
      violations.push({ type: 'profanity', result: profanityResult });
      highestConfidence = Math.max(highestConfidence, profanityResult.confidence);
      if (profanityResult.severity === 'high' || (profanityResult.severity === 'medium' && highestSeverity === 'low')) {
        highestSeverity = profanityResult.severity;
      }
    }
  }

  if (checkDangerous) {
    const dangerousResult = checkDangerousContent(text);
    if (!dangerousResult.passed) {
      violations.push({ type: 'dangerous', result: dangerousResult });
      highestConfidence = Math.max(highestConfidence, dangerousResult.confidence);
      if (dangerousResult.severity === 'high') {
        highestSeverity = 'high';
      }
    }
  }

  // Determine if content should be blocked
  // Block if: high severity OR (medium severity with high confidence)
  const shouldBlock = highestSeverity === 'high' || (highestSeverity === 'medium' && highestConfidence >= 0.7);

  // Generate overall reason and suggestion
  let overallReason: string | undefined;
  let suggestion: string | undefined;

  if (violations.length > 0) {
    const reasons = violations.map(v => v.result.reason).filter(Boolean);
    overallReason = reasons[0] || 'Content not allowed';

    const suggestions = violations.map(v => v.result.suggestion).filter(Boolean);
    suggestion = suggestions[0];
  }

  return {
    allowed: !shouldBlock,
    blocked: shouldBlock,
    severity: highestSeverity,
    violations,
    highestConfidence,
    overallReason,
    suggestion,
  };
}

/**
 * Quick check - optimized for performance
 * Only runs critical checks (injection + dangerous)
 */
export function quickModerate(text: string): { allowed: boolean; reason?: string } {
  const injectionResult = checkPromptInjection(text);
  if (!injectionResult.passed && injectionResult.severity === 'high') {
    return {
      allowed: false,
      reason: injectionResult.reason,
    };
  }

  const dangerousResult = checkDangerousContent(text);
  if (!dangerousResult.passed && dangerousResult.severity === 'high') {
    return {
      allowed: false,
      reason: dangerousResult.reason,
    };
  }

  return { allowed: true };
}
