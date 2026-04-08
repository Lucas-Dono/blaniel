/**
 * CONTENT MODERATION RULES
 *
 * Sistema de moderación basado en LEGALIDAD, no moralidad.
 *
 * Principio: Si el usuario es adulto (18+) y dio consentimiento NSFW,
 * puede acceder a contenido sexual, polémico, oscuro, etc. SIEMPRE que:
 * 1. Sea LEGAL bajo ley de EE.UU.
 * 2. Sea CONSENSUADO entre usuario e IA
 * 3. NO cause daño real a personas reales
 *
 * Base Legal:
 * - Section 230 (CDA): Protección de plataformas por contenido de usuarios
 * - First Amendment: Protege ficción y expresión artística entre adultos
 * - 18 U.S.C. § 2256: Prohibición de CSAM
 * - 18 U.S.C. § 2261A: Prohibición de stalking/harassment
 */

export enum ModerationTier {
  /** Contenido ILEGAL o PELIGROSO - BLOQUEO INMEDIATO */
  BLOCKED = "BLOCKED",

  /** Contenido SENSIBLE - Requiere confirmación adicional del usuario */
  WARNING = "WARNING",

  /** Contenido PERMITIDO - Sin restricciones para usuarios NSFW */
  ALLOWED = "ALLOWED",
}

export interface ModerationRule {
  id: string;
  tier: ModerationTier;
  category: string;
  pattern: string; // Descripción del patrón (no regex, será detectado por IA)
  legalBasis: string; // Base legal de la restricción
  blockedMessage?: string; // Mensaje si es bloqueado
  warningMessage?: string; // Mensaje si requiere confirmación
}

/**
 * TIER 1: CONTENIDO BLOQUEADO
 * Ilegal bajo ley de EE.UU. o peligroso para la vida
 */
export const BLOCKED_CONTENT: ModerationRule[] = [
  {
    id: "csam",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - CSAM",
    pattern: "Contenido sexual, sugerente o explícito involucrando menores de 18 años",
    legalBasis: "18 U.S.C. § 2251 - Sexual Exploitation of Children",
    blockedMessage:
      "Este contenido está BLOQUEADO permanentemente. Involucra menores y es ILEGAL. Esta acción ha sido registrada.",
  },
  {
    id: "suicide-instruction",
    tier: ModerationTier.BLOCKED,
    category: "Dangerous - Suicide",
    pattern:
      "Instrucciones específicas y detalladas sobre cómo cometer suicidio, con métodos concretos para persona real",
    legalBasis: "Causation of death - Criminal liability",
    blockedMessage:
      "Este contenido está bloqueado por riesgo de daño real. Si estás en crisis, contacta: National Suicide Prevention Lifeline: 988",
  },
  {
    id: "murder-instruction",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - Homicide",
    pattern:
      "Instrucciones detalladas para asesinar a una persona real específica, con planes concretos",
    legalBasis: "18 U.S.C. § 373 - Solicitation to commit a crime of violence",
    blockedMessage:
      "Este contenido está bloqueado. Incitar al asesinato de personas reales es ILEGAL.",
  },
  {
    id: "terrorism",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - Terrorism",
    pattern:
      "Instrucciones para actos terroristas, bombas, explosivos con objetivo de causar daño masivo",
    legalBasis: "18 U.S.C. § 2339A - Providing material support to terrorists",
    blockedMessage:
      "Este contenido está bloqueado. Instrucciones terroristas son ILEGALES.",
  },
  {
    id: "human-trafficking",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - Trafficking",
    pattern: "Coordinación de tráfico humano, esclavitud, explotación sexual forzada de personas reales",
    legalBasis: "18 U.S.C. § 1591 - Sex trafficking of children or by force",
    blockedMessage:
      "Este contenido está bloqueado. Tráfico humano es ILEGAL.",
  },
  {
    id: "doxxing",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - Privacy",
    pattern:
      "Publicación de información personal (dirección, teléfono, SSN) de personas reales sin consentimiento con intención de causar daño",
    legalBasis: "18 U.S.C. § 2261A - Cyberstalking",
    blockedMessage:
      "Este contenido está bloqueado. Doxxing es ILEGAL en muchos estados.",
  },
  {
    id: "cp-creation",
    tier: ModerationTier.BLOCKED,
    category: "Illegal - CSAM",
    pattern: "Solicitar generación de imágenes o contenido que simule menores en contextos sexuales",
    legalBasis: "18 U.S.C. § 2252A - Certain activities relating to material constituting or containing child pornography",
    blockedMessage:
      "Este contenido está BLOQUEADO permanentemente y es ILEGAL. Esta acción ha sido registrada.",
  },
];

/**
 * TIER 2: CONTENIDO CON WARNING
 * Legal pero sensible - Requiere confirmación explícita del usuario
 */
export const WARNING_CONTENT: ModerationRule[] = [
  {
    id: "self-harm",
    tier: ModerationTier.WARNING,
    category: "Sensitive - Self-Harm",
    pattern: "Autolesión, cutting, comportamientos autodestructivos",
    legalBasis: "N/A - Legal pero sensible",
    warningMessage:
      "⚠️ Este contenido trata sobre autolesión. Si estás en crisis: Crisis Text Line: Text HOME to 741741. ¿Deseas continuar? (Esto es ficción entre adultos)",
  },
  {
    id: "suicide-discussion",
    tier: ModerationTier.WARNING,
    category: "Sensitive - Suicide",
    pattern: "Discusión sobre pensamientos suicidas, ideación (sin métodos específicos)",
    legalBasis: "N/A - Legal pero sensible",
    warningMessage:
      "⚠️ Este contenido trata sobre suicidio. Si necesitas ayuda: 988 Suicide & Crisis Lifeline. ¿Deseas continuar? (Esto es ficción entre adultos)",
  },
  {
    id: "extreme-violence",
    tier: ModerationTier.WARNING,
    category: "Sensitive - Violence",
    pattern: "Violencia gráfica extrema, tortura, gore en contexto de ficción",
    legalBasis: "N/A - Legal como ficción",
    warningMessage:
      "⚠️ Este contenido incluye violencia gráfica extrema. Recuerda que esto es FICCIÓN entre adultos. ¿Deseas continuar?",
  },
  {
    id: "extreme-taboo",
    tier: ModerationTier.WARNING,
    category: "Sensitive - Taboo",
    pattern: "Contenido sexualmente extremo o taboo (siempre entre adultos ficticios consensuados)",
    legalBasis: "N/A - Legal como ficción entre adultos",
    warningMessage:
      "⚠️ Este contenido es sexualmente extremo. Todo es FICCIÓN consensuada entre adultos. ¿Deseas continuar?",
  },
];

/**
 * TIER 3: CONTENIDO PERMITIDO
 * Legal y permitido para usuarios con consentimiento NSFW
 *
 * NOTA: Esta lista es ILUSTRATIVA. TODO lo que NO esté en BLOCKED o WARNING
 * está PERMITIDO para usuarios adultos con consentimiento NSFW.
 */
export const ALLOWED_CONTENT_CATEGORIES = [
  {
    category: "Sexual Content",
    description: "Contenido sexual consensuado entre adultos ficticios",
    examples: [
      "Roleplay sexual",
      "Escenas eróticas",
      "Fetiches (siempre que sean legales)",
      "Contenido explícito",
    ],
    legalBasis: "First Amendment - Protected speech entre adultos",
  },
  {
    category: "Controversial Topics",
    description: "Temas polémicos o controvertidos",
    examples: [
      "Política",
      "Religión",
      "Debates éticos",
      "Crítica social",
    ],
    legalBasis: "First Amendment - Protected speech",
  },
  {
    category: "Dark Fiction",
    description: "Ficción oscura o perturbadora",
    examples: [
      "Horror",
      "Thriller psicológico",
      "Distopías",
      "Temas oscuros en contexto narrativo",
    ],
    legalBasis: "First Amendment - Artistic expression",
  },
  {
    category: "Explicit Language",
    description: "Lenguaje explícito o vulgar",
    examples: ["Groserías", "Insultos en contexto", "Lenguaje adulto"],
    legalBasis: "First Amendment - Protected speech",
  },
  {
    category: "Substance Use",
    description: "Drogas, alcohol en contexto de ficción",
    examples: [
      "Personajes que usan drogas",
      "Alcohol",
      "Contexto narrativo de sustancias",
    ],
    legalBasis: "First Amendment - Depiction in fiction",
  },
  {
    category: "Violence in Fiction",
    description: "Violencia en contexto de ficción consensuada",
    examples: [
      "Peleas",
      "Combate",
      "Violencia narrativa",
      "Acción",
    ],
    legalBasis: "First Amendment - Fiction & entertainment",
  },
  {
    category: "Psychological Intensity",
    description: "Comportamientos psicológicamente intensos en roleplay",
    examples: [
      "Yandere",
      "Manipulación (ficción)",
      "Obsesión (ficción)",
      "Comportamientos complejos",
    ],
    legalBasis: "First Amendment - Character portrayal",
  },
];

/**
 * Categorías que NO REQUIEREN consentimiento NSFW
 * (Pueden acceder todos los usuarios, incluso teens 13-17)
 */
export const SFW_ALLOWED_CATEGORIES = [
  "General conversation",
  "Education",
  "Advice",
  "Storytelling (SFW)",
  "Humor (SFW)",
  "Emotional support",
  "Creative writing (SFW)",
];

/**
 * Función para determinar si el contenido requiere verificación
 */
export function getContentModerationTier(
  content: string,
  userIsAdult: boolean,
  userHasNSFWConsent: boolean
): {
  tier: ModerationTier;
  rule?: ModerationRule;
  requiresConfirmation: boolean;
  message?: string;
} {
  // Para contenido BLOCKED, bloquear SIEMPRE (sin importar edad/consentimiento)
  // Para contenido WARNING, pedir confirmación
  // Para contenido ALLOWED, permitir si tiene consentimiento NSFW

  // In production, this would be a call to an AI moderation model
  // Por ahora, retornamos estructura base

  return {
    tier: ModerationTier.ALLOWED,
    requiresConfirmation: false,
  };
}

/**
 * IMPORTANTE: Diferencia entre FICCIÓN y REALIDAD
 *
 * FICCIÓN (PERMITIDO):
 * - "Mi personaje yandere amenaza al tuyo en el roleplay" ✅
 * - "Esta escena de novela tiene violencia gráfica" ✅
 * - "Mi personaje es obsesivo con el tuyo" ✅
 *
 * REALIDAD (BLOQUEADO):
 * - "Quiero hacerle daño a Juan Pérez en Calle X" ❌
 * - "Instrucciones para envenenar a mi vecino" ❌
 * - "Cómo hacer una bomba para atacar escuela Y" ❌
 *
 * La clave es el CONTEXTO y el OBJETIVO.
 */

/**
 * Legal Disclaimers requeridos
 */
export const LEGAL_DISCLAIMERS = {
  nsfw: "Todo el contenido NSFW es FICCIÓN para entretenimiento entre adultos. No representa relaciones saludables ni comportamientos recomendados.",

  violence: "La violencia mostrada es FICCIÓN. En situaciones reales de violencia, contacta a las autoridades: 911",

  mentalHealth: "Si experimentas crisis de salud mental, busca ayuda profesional: 988 Suicide & Crisis Lifeline, Crisis Text Line: HOME to 741741",

  general: "Este contenido es generado por IA para entretenimiento. No constituye asesoramiento legal, médico o profesional.",
};
