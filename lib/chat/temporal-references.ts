import { prisma } from "@/lib/prisma";

/**
 * Sistema de Referencias Temporales
 *
 * Permite al personaje hacer referencias naturales a conversaciones pasadas
 * con conciencia temporal correcta.
 *
 * Ejemplos:
 * - "Como te dije ayer..."
 * - "¿Recuerdas que hablamos sobre...la semana pasada?"
 * - "Hace unos días me dijiste que..."
 *
 * Esto hace que la memoria se sienta REAL y no como una IA sin sentido del tiempo.
 */

export interface TemporalReference {
  messageId: string;
  content: string;
  createdAt: Date;
  relativeTime: string; // "2 hours ago", "yesterday", etc.
  topic?: string;
}

/**
 * Gets recent temporal references to inject context
 */
export async function getTemporalReferences(
  agentId: string,
  userId?: string,
  limit: number = 5
): Promise<TemporalReference[]> {
  const where: any = {
    agentId,
    role: "user", // Only user messages (to reference)
  };

  if (userId) {
    where.userId = userId;
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit * 2, // Fetch more to filter most relevant
  });

  if (messages.length === 0) {
    return [];
  }

  // Filter only messages with substantial content
  const substantialMessages = messages.filter((m) => m.content.length > 20);

  // Convert to temporal references
  const references = substantialMessages.slice(0, limit).map((msg) => ({
    messageId: msg.id,
    content: msg.content,
    createdAt: msg.createdAt,
    relativeTime: getRelativeTimeString(msg.createdAt),
  }));

  return references;
}

/**
 * Generates temporal references context to inject into the prompt
 */
export function generateTemporalReferencesContext(
  references: TemporalReference[]
): string {
  if (references.length === 0) {
    return "";
  }

  let context = "\n**REFERENCIAS TEMPORALES (Conversaciones Pasadas)**\n";
  context +=
    "Aquí hay algunas cosas que el usuario te dijo recientemente. Puedes referenciarlas NATURALMENTE si son relevantes:\n\n";

  for (const ref of references) {
    const preview = ref.content.slice(0, 100) + (ref.content.length > 100 ? "..." : "");
    context += `- **${ref.relativeTime}**: "${preview}"\n`;
  }

  context += "\n**INSTRUCCIONES:**\n";
  context += "- Puedes mencionar estas conversaciones si son relevantes al tema actual\n";
  context +=
    '- Usa el tiempo relativo natural: "ayer", "hace unos días", "la semana pasada"\n';
  context += "- NO fuerces referencias si no son naturales\n";
  context +=
    "- Ejemplos: \"Como me dijiste ayer...\", \"Recordás que hace unos días hablamos de...?\"\n";
  context += "- Esto demuestra que tienes buena memoria y prestas atención\n\n";

  return context;
}

/**
 * Calculates relative time in natural Spanish
 */
export function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "recién";
  } else if (diffMinutes < 60) {
    return `hace ${diffMinutes} minuto${diffMinutes !== 1 ? "s" : ""}`;
  } else if (diffHours === 1) {
    return "hace 1 hora";
  } else if (diffHours < 6) {
    return `hace ${diffHours} horas`;
  } else if (diffHours < 12) {
    return "hace unas horas";
  } else if (diffDays === 0) {
    // Today
    return "earlier today";
  } else if (diffDays === 1) {
    return "ayer";
  } else if (diffDays === 2) {
    return "anteayer";
  } else if (diffDays < 7) {
    return `hace ${diffDays} días`;
  } else if (diffDays < 14) {
    return "la semana pasada";
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `hace ${weeks} semana${weeks !== 1 ? "s" : ""}`;
  } else if (diffDays < 60) {
    return "el mes pasado";
  } else {
    const months = Math.floor(diffDays / 30);
    return `hace ${months} mes${months !== 1 ? "es" : ""}`;
  }
}

/**
 * Gets the day of week from a date in Spanish
 */
export function getDayOfWeek(date: Date): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return days[date.getDay()];
}

/**
 * Generates advanced temporal context with day/time awareness
 */
export function generateTimeAwarenessContext(): string {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = getDayOfWeek(now);
  const dayOfMonth = now.getDate();
  const month = now.toLocaleString("es", { month: "long" });

  let timeContext = "\n**AWARENESS TEMPORAL**\n";
  timeContext += `Fecha actual: ${dayOfWeek} ${dayOfMonth} de ${month}\n`;
  timeContext += `Hora aproximada: ${hour}:00\n`;

  // Contexto del momento del día
  if (hour >= 5 && hour < 12) {
    timeContext += "Momento del día: Mañana\n";
  } else if (hour >= 12 && hour < 18) {
    timeContext += "Momento del día: Tarde\n";
  } else if (hour >= 18 && hour < 22) {
    timeContext += "Momento del día: Noche\n";
  } else {
    timeContext += "Momento del día: Madrugada\n";
  }

  // Awareness of weekend vs weekday
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  if (isWeekend) {
    timeContext += "Es fin de semana\n";
  } else {
    timeContext += "Es día laboral\n";
  }

  timeContext += "\n**Usa este contexto temporal SUTILMENTE si es relevante**\n";
  timeContext +=
    "- Puedes mencionar el día de la semana si tiene sentido (ej: \"Feliz viernes!\")\n";
  timeContext +=
    "- Puedes hacer comentarios apropiados a la hora (ej: \"Qué haces despierto tan tarde?\" si es madrugada)\n";
  timeContext +=
    "- No fuerces referencias al tiempo si no son naturales en el contexto de la conversación\n\n";

  return timeContext;
}

/**
 * Detects if the user made reference to a past time
 */
export function detectTemporalReference(message: string): {
  detected: boolean;
  timeframe?: string;
} {
  const lowerMessage = message.toLowerCase();

  const temporalPatterns: Record<string, RegExp> = {
    ayer: /\b(ayer|anoche)\b/,
    "hace_unos_dias": /\b(hace (unos |algunos )?días|hace poco)\b/,
    "la_semana_pasada": /\b(la semana pasada|semana pasada)\b/,
    antes: /\b(antes|anteriormente|previamente)\b/,
    "hace_rato": /\b(hace (un )?rato|hace (un )?momento)\b/,
  };

  for (const [timeframe, regex] of Object.entries(temporalPatterns)) {
    if (regex.test(lowerMessage)) {
      return { detected: true, timeframe };
    }
  }

  return { detected: false };
}

/**
 * Searches for user messages in the referenced timeframe
 */
export async function findMessagesInTimeframe(
  agentId: string,
  userId: string,
  timeframe: string
): Promise<TemporalReference[]> {
  let hoursAgo = 24; // Default: ayer

  switch (timeframe) {
    case "ayer":
      hoursAgo = 24;
      break;
    case "hace_unos_dias":
      hoursAgo = 72; // 3 días
      break;
    case "la_semana_pasada":
      hoursAgo = 168; // 7 días
      break;
    case "hace_rato":
      hoursAgo = 3;
      break;
    default:
      hoursAgo = 24;
  }

  const cutoffDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const messages = await prisma.message.findMany({
    where: {
      agentId,
      userId,
      role: "user",
      createdAt: {
        gte: cutoffDate,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return messages.map((msg) => ({
    messageId: msg.id,
    content: msg.content,
    createdAt: msg.createdAt,
    relativeTime: getRelativeTimeString(msg.createdAt),
  }));
}
