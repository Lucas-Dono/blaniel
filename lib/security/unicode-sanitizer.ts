/**
 * Unicode Sanitizer - Prevent visual confusion attacks
 *
 * Protects against:
 * 1. Homoglyph attacks (А vs A, Ο vs O)
 * 2. Zero-width characters (U+200B, U+200C, U+200D, U+FEFF)
 * 3. Invisible control characters
 * 4. Bidirectional text attacks (RLO, LRO)
 *
 * References:
 * - OWASP: https://owasp.org/www-community/attacks/Unicode_Encoding
 * - Unicode Security: https://unicode.org/reports/tr36/
 * - CWE-838: Inappropriate Encoding for Output Context
 */

// ============================================================================
// DANGEROUS CHARACTERS
// ============================================================================

/**
 * Zero-width characters that can be used for visual bypass
 */
const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\uFEFF', // Zero Width No-Break Space (BOM)
  '\u180E', // Mongolian Vowel Separator
];

/**
 * Bidirectional control characters that can cause confusion
 */
const BIDI_CONTROL_CHARS = [
  '\u202A', // Left-to-Right Embedding (LRE)
  '\u202B', // Right-to-Left Embedding (RLE)
  '\u202C', // Pop Directional Formatting (PDF)
  '\u202D', // Left-to-Right Override (LRO)
  '\u202E', // Right-to-Left Override (RLO)
  '\u2066', // Left-to-Right Isolate
  '\u2067', // Right-to-Left Isolate
  '\u2068', // First Strong Isolate
  '\u2069', // Pop Directional Isolate
];

/**
 * Other invisible control characters
 */
const INVISIBLE_CHARS = [
  '\u00AD', // Soft Hyphen
  '\u034F', // Combining Grapheme Joiner
  '\u061C', // Arabic Letter Mark
  '\u115F', // Hangul Choseong Filler
  '\u1160', // Hangul Jungseong Filler
  '\u17B4', // Khmer Vowel Inherent Aq
  '\u17B5', // Khmer Vowel Inherent Aa
  '\u180B', // Mongolian Free Variation Selector One
  '\u180C', // Mongolian Free Variation Selector Two
  '\u180D', // Mongolian Free Variation Selector Three
];

/**
 * All dangerous characters combined
 */
const DANGEROUS_CHARS = [
  ...ZERO_WIDTH_CHARS,
  ...BIDI_CONTROL_CHARS,
  ...INVISIBLE_CHARS,
];

/**
 * Regex to detect dangerous characters
 */
const DANGEROUS_CHARS_REGEX = new RegExp(
  `[${DANGEROUS_CHARS.map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('')}]`,
  'g'
);

// ============================================================================
// HOMOGLYPHS - Characters that look similar but are different
// ============================================================================

/**
 * Map of common homoglyphs to their ASCII equivalents
 * Only includes the most common to avoid false positives
 */
const COMMON_HOMOGLYPHS: Record<string, string> = {
  // Cyrillic that looks like Latin
  'А': 'A', // Cyrillic A
  'В': 'B', // Cyrillic B
  'Е': 'E', // Cyrillic E
  'К': 'K', // Cyrillic K
  'М': 'M', // Cyrillic M
  'Н': 'H', // Cyrillic H
  'О': 'O', // Cyrillic O
  'Р': 'P', // Cyrillic P
  'С': 'C', // Cyrillic C
  'Т': 'T', // Cyrillic T
  'Х': 'X', // Cyrillic X
  'а': 'a', // Cyrillic a
  'е': 'e', // Cyrillic e
  'о': 'o', // Cyrillic o
  'р': 'p', // Cyrillic p
  'с': 'c', // Cyrillic c
  'у': 'y', // Cirílico y
  'х': 'x', // Cirílico x

  // Griego que se ve como Latino
  'Α': 'A', // Griego Alpha
  'Β': 'B', // Griego Beta
  'Ε': 'E', // Griego Epsilon
  'Ζ': 'Z', // Griego Zeta
  'Η': 'H', // Griego Eta
  'Ι': 'I', // Griego Iota
  'Κ': 'K', // Griego Kappa
  'Μ': 'M', // Griego Mu
  'Ν': 'N', // Griego Nu
  'Ο': 'O', // Griego Omicron
  'Ρ': 'P', // Griego Rho
  'Τ': 'T', // Griego Tau
  'Υ': 'Y', // Griego Upsilon
  'Χ': 'X', // Griego Chi

  // Fullwidth (Japanese/Chinese)
  'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
  'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
  'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
  'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
  'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',

  // Números con aspecto similar
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

// ============================================================================
// FUNCIONES DE SANITIZACIÓN
// ============================================================================

/**
 * Reemplazar homoglyphs con equivalentes ASCII seguros
 */
function replaceHomoglyphs(text: string): string {
  let result = text;

  for (const [homoglyph, replacement] of Object.entries(COMMON_HOMOGLYPHS)) {
    result = result.replaceAll(homoglyph, replacement);
  }

  return result;
}

/**
 * Eliminar caracteres zero-width y de control
 */
function removeInvisibleChars(text: string): string {
  // Delete usando regex
  let result = text.replace(DANGEROUS_CHARS_REGEX, '');

  // Delete generic control characters (U+0000 to U+001F except tab, newline)
  result = result.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');

  return result;
}

/**
 * Normalizar unicode a forma canónica (NFC)
 *
 * Ejemplo: "é" puede ser U+00E9 (precompuesto) o U+0065 U+0301 (e + combinación)
 * Normalizamos a NFC (precompuesto) para consistencia
 */
function normalizeUnicode(text: string): string {
  return text.normalize('NFC');
}

/**
 * Detectar si un texto contiene caracteres sospechosos
 */
export function detectSuspiciousChars(text: string): {
  hasSuspicious: boolean;
  foundChars: string[];
  warnings: string[];
} {
  const foundChars: string[] = [];
  const warnings: string[] = [];

  // Detectar zero-width characters
  for (const char of ZERO_WIDTH_CHARS) {
    if (text.includes(char)) {
      foundChars.push(`U+${char.charCodeAt(0).toString(16).toUpperCase()}`);
      warnings.push(`Zero-width character detected: ${char.charCodeAt(0).toString(16)}`);
    }
  }

  // Detectar bidi control characters
  for (const char of BIDI_CONTROL_CHARS) {
    if (text.includes(char)) {
      foundChars.push(`U+${char.charCodeAt(0).toString(16).toUpperCase()}`);
      warnings.push(`Bidirectional control character detected: ${char.charCodeAt(0).toString(16)}`);
    }
  }

  // Detectar homoglyphs
  for (const homoglyph of Object.keys(COMMON_HOMOGLYPHS)) {
    if (text.includes(homoglyph)) {
      foundChars.push(homoglyph);
      warnings.push(`Homoglyph detected: ${homoglyph} (looks like ${COMMON_HOMOGLYPHS[homoglyph]})`);
    }
  }

  return {
    hasSuspicious: foundChars.length > 0,
    foundChars,
    warnings,
  };
}

/**
 * Sanitizar texto para nombres de usuario/grupos/agentes
 *
 * Aplica todas las protecciones:
 * 1. Normalización unicode
 * 2. Eliminación de caracteres invisibles
 * 3. Reemplazo de homoglyphs
 * 4. Trim de espacios
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let sanitized = name;

  // 1. Normalizar unicode (NFC)
  sanitized = normalizeUnicode(sanitized);

  // 2. Eliminar caracteres invisibles y de control
  sanitized = removeInvisibleChars(sanitized);

  // 3. Reemplazar homoglyphs comunes
  sanitized = replaceHomoglyphs(sanitized);

  // 4. Trim espacios
  sanitized = sanitized.trim();

  // 5. Collapse multiple spaces into one
  sanitized = sanitized.replace(/\s+/g, ' ');

  return sanitized;
}

/**
 * Validar que un nombre sea seguro (después de sanitizar)
 *
 * Retorna true si el nombre es válido, false si no
 */
export function isNameSafe(name: string): {
  valid: boolean;
  reason?: string;
} {
  if (!name || name.length === 0) {
    return { valid: false, reason: 'El nombre no puede estar vacío' };
  }

  if (name.length > 100) {
    return { valid: false, reason: 'El nombre no puede exceder 100 caracteres' };
  }

  // Detect if suspicious characters remain after sanitizing
  const detection = detectSuspiciousChars(name);
  if (detection.hasSuspicious) {
    return {
      valid: false,
      reason: `Caracteres sospechosos detectados: ${detection.warnings.join(', ')}`
    };
  }

  // Verificar que no sea solo espacios/puntuación
  const hasAlphanumeric = /[a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/.test(name);
  if (!hasAlphanumeric) {
    return { valid: false, reason: 'El nombre debe contener al menos un carácter alfanumérico' };
  }

  return { valid: true };
}

/**
 * Sanitizar y validar nombre en un solo paso
 *
 * Retorna el nombre sanitizado si es válido, o null si es inválido
 */
export function sanitizeAndValidateName(name: string): {
  sanitized: string | null;
  valid: boolean;
  reason?: string;
  detections?: string[];
} {
  // Detectar caracteres sospechosos ANTES de sanitizar (para logging)
  const detection = detectSuspiciousChars(name);

  // Sanitizar
  const sanitized = sanitizeName(name);

  // Validar
  const validation = isNameSafe(sanitized);

  if (!validation.valid) {
    return {
      sanitized: null,
      valid: false,
      reason: validation.reason,
      detections: detection.hasSuspicious ? detection.warnings : undefined,
    };
  }

  return {
    sanitized,
    valid: true,
    detections: detection.hasSuspicious ? detection.warnings : undefined,
  };
}

// ============================================================================
// UTILIDADES PARA TESTING/LOGGING
// ============================================================================

/**
 * Obtener información detallada de caracteres en un string (para debugging)
 */
export function getCharInfo(text: string): Array<{
  char: string;
  codePoint: string;
  name: string;
  isSuspicious: boolean;
}> {
  const chars: Array<{
    char: string;
    codePoint: string;
    name: string;
    isSuspicious: boolean;
  }> = [];

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) continue;

    const codePointHex = `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

    let name = 'Unknown';
    let isSuspicious = false;

    // Identify character type
    if (ZERO_WIDTH_CHARS.includes(char)) {
      name = 'Zero-Width Character';
      isSuspicious = true;
    } else if (BIDI_CONTROL_CHARS.includes(char)) {
      name = 'Bidirectional Control';
      isSuspicious = true;
    } else if (INVISIBLE_CHARS.includes(char)) {
      name = 'Invisible Control Character';
      isSuspicious = true;
    } else if (char in COMMON_HOMOGLYPHS) {
      name = `Homoglyph (looks like ${COMMON_HOMOGLYPHS[char]})`;
      isSuspicious = true;
    } else if (codePoint >= 0x20 && codePoint <= 0x7E) {
      name = 'ASCII';
    } else if (codePoint >= 0xC0 && codePoint <= 0x024F) {
      name = 'Latin Extended';
    } else if (codePoint >= 0x0400 && codePoint <= 0x04FF) {
      name = 'Cyrillic';
    } else if (codePoint >= 0x0370 && codePoint <= 0x03FF) {
      name = 'Greek';
    } else {
      name = 'Unicode';
    }

    chars.push({
      char,
      codePoint: codePointHex,
      name,
      isSuspicious,
    });
  }

  return chars;
}
