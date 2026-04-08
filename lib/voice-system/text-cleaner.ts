/**
 * Text Cleaner for TTS
 *
 * Cleans text before sending it to Eleven Labs to avoid reading
 * actions, laughs, etc. literally.
 */

/**
 * Cleans text for TTS by removing:
 * - Actions between asterisks: *sigh*, *laughs*, etc.
 * - Actions between brackets: [sighs], [laughs], etc.
 * - Actions between parentheses: (sighs), (laughs), etc.
 * - Written laughs: haha, hehehe, lol, etc.
 * - Onomatopoeia and sounds
 */
export function cleanTextForTTS(text: string): string {
  let cleaned = text;

  // 1. Remove actions between asterisks: *sigh*, *blushes*, etc.
  cleaned = cleaned.replace(/\*[^*]+\*/g, '');

  // 2. Remove actions between brackets: [sighs], [laughs], etc.
  cleaned = cleaned.replace(/\[[^\]]+\]/g, '');

  // 3. Remove actions between parentheses: (sighs), (laughs), etc.
  cleaned = cleaned.replace(/\([^)]+\)/g, '');

  // 4. Remove written laughs (common in Spanish)
  // jaja, jajaja, jejeje, hehe, hehehe, hihi, etc.
  cleaned = cleaned.replace(/\b(ja){2,}\b/gi, ''); // jaja, jajaja...
  cleaned = cleaned.replace(/\b(je){2,}\b/gi, ''); // jejeje...
  cleaned = cleaned.replace(/\b(he){2,}\b/gi, ''); // hehehe...
  cleaned = cleaned.replace(/\b(ji){2,}\b/gi, ''); // jijiji...
  cleaned = cleaned.replace(/\b(hi){2,}\b/gi, ''); // hihihi...

  // 5. Remove English laughs
  cleaned = cleaned.replace(/\blol\b/gi, '');
  cleaned = cleaned.replace(/\blmao\b/gi, '');
  cleaned = cleaned.replace(/\bhaha\b/gi, '');

  // 6. Remove common onomatopoeia
  cleaned = cleaned.replace(/\b(ah|oh|eh|uh|mm|mmm|hmm|pfft|uff|auch)\b/gi, '');

  // 7. Remove emojis and non-speakable special characters
  cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Face emojis
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Symbols and pictograms
  cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and maps
  cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Various symbols
  cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats

  // 8. Remove multiple spaces and leading/trailing spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 9. Remove multiple ellipses (keep only one or two)
  cleaned = cleaned.replace(/\.{4,}/g, '...');

  return cleaned;
}

/**
 * Detects if text has spoken content after cleaning
 */
export function hasSpokenContent(text: string): boolean {
  const cleaned = cleanTextForTTS(text);
  // Check that it has at least 3 alphabetic characters
  return /[a-zA-ZáéíóúñÁÉÍÓÚÑ]{3,}/.test(cleaned);
}

/**
 * Usage examples:
 *
 * cleanTextForTTS("*sigh* Hi, how are you? hahaha")
 * → "Hi, how are you?"
 *
 * cleanTextForTTS("Ah... *blushes* Y-y-you... hehehe")
 * → "Y-y-you..."
 *
 * cleanTextForTTS("[laughs nervously] I don't know what to say...")
 * → "I don't know what to say..."
 */
