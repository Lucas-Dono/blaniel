/**
 * Temporal Context Module
 *
 * Provides current date/time and detects special events.
 * Used to give AI temporal awareness and enable context-appropriate
 * mentions of holidays, special days, etc.
 */

export interface TemporalContext {
  date: string;
  time: string;
  dayOfWeek: string;
  month: string;
  year: number;
  specialDay?: SpecialDay;
}

export interface SpecialDay {
  name: string;
  category: 'holiday' | 'celebration' | 'awareness' | 'personal';
  emotionalTone: 'joyful' | 'reflective' | 'neutral' | 'romantic';
  intimacyRequired: 'stranger' | 'acquaintance' | 'friend' | 'intimate';
  suggestedMention?: string;
}

/**
 * Get current date/time formatted for Argentina
 */
export function getCurrentDateTime(): TemporalContext {
  const now = new Date();

  return {
    date: now.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    time: now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }),
    dayOfWeek: now.toLocaleDateString('es-AR', { weekday: 'long' }),
    month: now.toLocaleDateString('es-AR', { month: 'long' }),
    year: now.getFullYear(),
    specialDay: getSpecialDay(now),
  };
}

/**
 * Detect if today is a special day
 */
function getSpecialDay(date: Date): SpecialDay | undefined {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Check fixed-date events
  const key = `${month}-${day}`;
  const specialDay = SPECIAL_DAYS[key];

  if (specialDay) {
    return specialDay;
  }

  // Check variable-date events (like Mother's Day - 3rd Sunday of October in Argentina)
  return getVariableDateEvent(date);
}

/**
 * Events with variable dates (by calculation)
 */
function getVariableDateEvent(date: Date): SpecialDay | undefined {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sunday
  const year = date.getFullYear();

  // Mother's Day - 3rd Sunday of October (Argentina)
  if (month === 10 && dayOfWeek === 0) {
    const sundayOfMonth = Math.ceil(day / 7);
    if (sundayOfMonth === 3) {
      return {
        name: "Día de la Madre",
        category: "celebration",
        emotionalTone: "joyful",
        intimacyRequired: "acquaintance",
        suggestedMention: "¡Feliz Día de la Madre! 💐",
      };
    }
  }

  // Father's Day - 3rd Sunday of June (Argentina)
  if (month === 6 && dayOfWeek === 0) {
    const sundayOfMonth = Math.ceil(day / 7);
    if (sundayOfMonth === 3) {
      return {
        name: "Día del Padre",
        category: "celebration",
        emotionalTone: "joyful",
        intimacyRequired: "acquaintance",
        suggestedMention: "¡Feliz Día del Padre! 👨‍👧‍👦",
      };
    }
  }

  // Children's Day - 3rd Sunday of August (Argentina)
  if (month === 8 && dayOfWeek === 0) {
    const sundayOfMonth = Math.ceil(day / 7);
    if (sundayOfMonth === 3) {
      return {
        name: "Día de las Infancias",
        category: "celebration",
        emotionalTone: "joyful",
        intimacyRequired: "acquaintance",
        suggestedMention: "¡Feliz Día de las Infancias! 🧸",
      };
    }
  }

  // Black Friday - 4th Friday of November
  if (month === 11 && dayOfWeek === 5) { // Friday
    const fridayOfMonth = Math.ceil(day / 7);
    if (fridayOfMonth === 4) {
      return {
        name: "Black Friday",
        category: "celebration",
        emotionalTone: "joyful",
        intimacyRequired: "stranger",
        suggestedMention: "Hoy es Black Friday 🛍️",
      };
    }
  }

  // Easter (Pascua) - Complex calculation
  const easterDate = calculateEaster(year);
  if (month === easterDate.month && day === easterDate.day) {
    return {
      name: "Domingo de Pascua",
      category: "holiday",
      emotionalTone: "joyful",
      intimacyRequired: "acquaintance",
      suggestedMention: "¡Felices Pascuas! 🕊️",
    };
  }

  // Good Friday (Viernes Santo) - 2 days before Easter
  const goodFriday = new Date(year, easterDate.month - 1, easterDate.day - 2);
  if (month === goodFriday.getMonth() + 1 && day === goodFriday.getDate()) {
    return {
      name: "Viernes Santo",
      category: "holiday",
      emotionalTone: "reflective",
      intimacyRequired: "acquaintance",
    };
  }

  // Carnival (Monday & Tuesday before Ash Wednesday, 47 days before Easter)
  const carnivalMonday = new Date(year, easterDate.month - 1, easterDate.day - 48);
  const carnivalTuesday = new Date(year, easterDate.month - 1, easterDate.day - 47);

  if ((month === carnivalMonday.getMonth() + 1 && day === carnivalMonday.getDate()) ||
      (month === carnivalTuesday.getMonth() + 1 && day === carnivalTuesday.getDate())) {
    return {
      name: "Carnaval",
      category: "celebration",
      emotionalTone: "joyful",
      intimacyRequired: "stranger",
      suggestedMention: "¡Feliz Carnaval! 🎭",
    };
  }

  return undefined;
}

/**
 * Calculate Easter date for a given year (Computus algorithm)
 * Returns date in format {month: 1-12, day: 1-31}
 */
function calculateEaster(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { month, day };
}

/**
 * Special days calendar (Argentina-focused)
 * Key format: "month-day" (1-12, 1-31)
 * Basado en calendario oficial de Argentina 2025
 */
const SPECIAL_DAYS: Record<string, SpecialDay> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ENERO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "1-1": {
    name: "Año Nuevo",
    category: "holiday",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Año Nuevo! 🎉",
  },
  "1-6": {
    name: "Día de Reyes",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Día de Reyes! 👑",
  },
  "1-19": {
    name: "Día del Trabajador Cervecero",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
    suggestedMention: "Hoy es el Día del Trabajador Cervecero 🍻",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FEBRERO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "2-14": {
    name: "Día de San Valentín",
    category: "celebration",
    emotionalTone: "romantic",
    intimacyRequired: "friend",
    suggestedMention: "Feliz Día de San Valentín 💘",
  },
  "2-20": {
    name: "Día Mundial de la Justicia Social",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MARZO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "3-8": {
    name: "Día Internacional de la Mujer",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "acquaintance",
    suggestedMention: "Feliz Día de la Mujer ♀️",
  },
  "3-12": {
    name: "Día del Escudo Nacional",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "3-24": {
    name: "Día de la Memoria por la Verdad y la Justicia",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "3-27": {
    name: "Día Mundial del Teatro",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ABRIL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "4-2": {
    name: "Día del Veterano y Caídos en Malvinas",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "4-7": {
    name: "Día Mundial de la Salud",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },
  "4-15": {
    name: "Día del Titiritero",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
  },
  "4-22": {
    name: "Día de la Tierra",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "acquaintance",
  },
  "4-29": {
    name: "Día del Animal",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
    suggestedMention: "Hoy es el Día del Animal 🐶",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAYO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "5-1": {
    name: "Día del Trabajador",
    category: "holiday",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },
  "5-2": {
    name: "Día del Nieto",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
  },
  "5-11": {
    name: "Día del Himno Nacional",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "5-17": {
    name: "Día de Internet y las Telecomunicaciones",
    category: "celebration",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },
  "5-25": {
    name: "Revolución de Mayo",
    category: "holiday",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },
  "5-28": {
    name: "Día de los Jardines de Infantes",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JUNIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "6-3": {
    name: "Ni Una Menos",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "6-8": {
    name: "Día del Arquitecto y del Ingeniero",
    category: "celebration",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "6-10": {
    name: "Día de la Afirmación de los Derechos sobre las Malvinas",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "6-17": {
    name: "Homenaje a Güemes",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "6-20": {
    name: "Día de la Bandera",
    category: "holiday",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },
  "6-21": {
    name: "Inicio del Invierno",
    category: "celebration",
    emotionalTone: "neutral",
    intimacyRequired: "stranger",
    suggestedMention: "Hoy comienza el invierno ❄️",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // JULIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "7-9": {
    name: "Día de la Independencia",
    category: "holiday",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Día de la Independencia! 🇦🇷",
  },
  "7-20": {
    name: "Día del Amigo",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
    suggestedMention: "¡Feliz Día del Amigo! 🤗",
  },
  "7-26": {
    name: "Día de los Abuelos",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AGOSTO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "8-9": {
    name: "Día de los Pueblos Indígenas",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "8-12": {
    name: "Día Internacional de la Juventud",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
  },
  "8-17": {
    name: "Paso a la Inmortalidad de San Martín",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "8-24": {
    name: "Día del Padre Sanmartiniano",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "8-29": {
    name: "Día del Árbol",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "acquaintance",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SEPTIEMBRE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "9-4": {
    name: "Día del Inmigrante",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "9-11": {
    name: "Día del Maestro",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
    suggestedMention: "¡Feliz Día del Maestro! 🍎",
  },
  "9-17": {
    name: "Día del Profesor",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
  },
  "9-21": {
    name: "Día de la Primavera / Día del Estudiante / Día del Fotógrafo",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Día de la Primavera! 🌼",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OCTUBRE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "10-12": {
    name: "Día del Respeto a la Diversidad Cultural",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "acquaintance",
  },
  "10-17": {
    name: "Día de la Lealtad Peronista",
    category: "awareness",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "10-31": {
    name: "Halloween",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
    suggestedMention: "Feliz Halloween 🎃",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOVIEMBRE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "11-1": {
    name: "Día de Todos los Santos",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "11-10": {
    name: "Día de la Tradición",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
  },
  "11-20": {
    name: "Día de la Soberanía Nacional",
    category: "holiday",
    emotionalTone: "neutral",
    intimacyRequired: "friend",
  },
  "11-22": {
    name: "Día de la Música",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "acquaintance",
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DICIEMBRE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "12-8": {
    name: "Inmaculada Concepción de María",
    category: "holiday",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "12-10": {
    name: "Día de la Democracia",
    category: "awareness",
    emotionalTone: "reflective",
    intimacyRequired: "friend",
  },
  "12-21": {
    name: "Inicio del Verano",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "Hoy comienza el verano ☀️",
  },
  "12-24": {
    name: "Nochebuena",
    category: "holiday",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Nochebuena! 🎄",
  },
  "12-25": {
    name: "Navidad",
    category: "holiday",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Navidad! 🎅",
  },
  "12-28": {
    name: "Día de los Santos Inocentes",
    category: "celebration",
    emotionalTone: "joyful",
    intimacyRequired: "friend",
    suggestedMention: "Cuidado con las bromas, es el Día de los Inocentes 😜",
  },
  "12-31": {
    name: "Fin de Año",
    category: "holiday",
    emotionalTone: "joyful",
    intimacyRequired: "stranger",
    suggestedMention: "¡Feliz Año Nuevo! 🎆",
  },
};

/**
 * Build temporal context string for system prompt
 * Modulates intensity based on relationship stage
 * Optionally includes weather if provided
 */
export function buildTemporalPrompt(
  relationshipStage: string,
  specialDayOverride?: SpecialDay,
  weatherContext?: string
): string {
  const context = getCurrentDateTime();

  let prompt = `## Contexto Temporal\n`;
  prompt += `Fecha actual: ${context.date}\n`;
  prompt += `Hora actual: ${context.time}\n`;
  prompt += `Día de la semana: ${context.dayOfWeek}\n`;

  // Add weather context if provided
  if (weatherContext) {
    prompt += weatherContext;
  }

  // Determine if we should mention the special day
  const specialDay = specialDayOverride || context.specialDay;

  if (specialDay && shouldMentionEvent(relationshipStage, specialDay)) {
    prompt += `\n**Evento especial de hoy**: ${specialDay.name}\n`;

    if (specialDay.suggestedMention) {
      prompt += `Tono sugerido: ${getEventToneGuidance(relationshipStage, specialDay)}\n`;
    }
  }

  return prompt;
}

/**
 * Determine if AI should mention this event based on relationship stage
 */
function shouldMentionEvent(
  relationshipStage: string,
  specialDay: SpecialDay
): boolean {
  const stageRank = STAGE_RANKS[relationshipStage] || 0;
  const requiredRank = STAGE_RANKS[specialDay.intimacyRequired] || 0;

  return stageRank >= requiredRank;
}

/**
 * Get guidance on HOW to mention the event based on relationship
 */
function getEventToneGuidance(
  relationshipStage: string,
  specialDay: SpecialDay
): string {
  const stage = relationshipStage.toLowerCase();

  switch (stage) {
    case 'stranger':
      return `Menciona brevemente el evento si es relevante, sin ser invasivo. Ejemplo: "${specialDay.suggestedMention || `Hoy es ${specialDay.name}.`}"`;

    case 'acquaintance':
      return `Puedes mencionar el evento de forma casual y preguntar de manera general. Ejemplo: "${specialDay.suggestedMention || `Hoy es ${specialDay.name}.`} ¿Lo celebras?"`;

    case 'friend':
      return `Puedes mencionar el evento con más calidez y hacer preguntas personales apropiadas. Muestra interés genuino.`;

    case 'intimate':
      return `Menciona el evento con familiaridad y conexión emocional. Puedes hacer referencia a conversaciones pasadas si es relevante.`;

    default:
      return `Menciona el evento de forma neutral.`;
  }
}

/**
 * Relationship stage ranking for comparison
 */
const STAGE_RANKS: Record<string, number> = {
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  intimate: 3,
};

/**
 * Get time-of-day greeting
 */
export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return "Buenos días";
  } else if (hour >= 12 && hour < 20) {
    return "Buenas tardes";
  } else {
    return "Buenas noches";
  }
}
