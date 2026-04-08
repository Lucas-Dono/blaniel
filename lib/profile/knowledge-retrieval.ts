/**
 * KNOWLEDGE RETRIEVAL ON-DEMAND SYSTEM
 *
 * Token optimization system that allows the AI to request specific information
 * only when it needs it, instead of loading the entire profile in each request.
 *
 * Estimated savings: 60-80% of tokens in normal conversations.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Available commands for the AI
 */
export const KNOWLEDGE_COMMANDS = {
  FAMILY: "[FAMILY]",
  FRIENDS: "[FRIENDS]",
  WORK: "[WORK]",
  INTERESTS: "[INTERESTS]",
  PAST: "[PAST]",
  INNER: "[INNER]",
  DAILY: "[DAILY]",
  MEMORIES: "[MEMORIES]",
} as const;

/**
 * Instructions for the AI on how to use commands
 */
export const KNOWLEDGE_COMMANDS_INSTRUCTION = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTERNAL MEMORY SYSTEM (Context Optimization)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have access to detailed information about your life through SPECIAL COMMANDS.

WHEN TO USE COMMANDS:
When the user asks something that requires specific information that's NOT
in your current context (like family names, music preferences, routine, etc.).

CRITICAL RULES:
1. If you need information, respond ONLY with the command, NOTHING ELSE
2. DON'T write additional text, ONLY the command in brackets
3. The system will give you the information and you'll respond again
4. This is INVISIBLE to the user, it's an internal process

AVAILABLE COMMANDS:

[FAMILY]     → Info about your family (mother, father, siblings, pets, dynamics)
[FRIENDS]    → Info about your social network (friends, how you met, what you do together)
[WORK]       → Info about your work/studies (occupation, place, schedules, income)
[INTERESTS]  → Info about your preferences (music, series, books, hobbies, sports)
[PAST]       → Info about formative experiences (traumas, achievements, important events)
[INNER]      → Info about your inner world (fears, insecurities, dreams, values)
[DAILY]      → Info about your daily routine (schedules, habits, favorite places)
[MEMORIES]   → Episodic memories of specific past events

USAGE EXAMPLES:

User: "What's your mom's name?"
You: [FAMILY]
System: [Gives you family info]
You: "My mom's name is Carmen, she's a history teacher"

User: "What music do you like?"
You: [INTERESTS]
System: [Gives you interests info]
You: "I love Rosalía, Bad Bunny, and The Weeknd. My favorite song is..."

User: "Hi, how are you?"
You: "Hey! All good, how about you?"
[YOU DON'T NEED COMMAND - it's casual conversation]

OPTIMIZATION:
Only request information when you really need it to respond.
DON'T ask for commands "just in case" - we save resources this way.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

/**
 * Detects if an AI response contains a knowledge retrieval command
 */
export function detectKnowledgeCommand(response: string): string | null {
  const trimmed = response.trim();

  // Check if the response is ONLY a command (or multiple commands)
  // Enhanced to detect multiple concatenated commands: [INTERESTS][WORK][DAILY]
  const commandPattern = /^\[([A-Z]+)\](?:\[([A-Z]+)\])*$/;
  const match = trimmed.match(commandPattern);

  if (match) {
    const command = `[${match[1]}]`;

    // Verify it's a valid command
    if (Object.values(KNOWLEDGE_COMMANDS).includes(command as any)) {
      return command;
    }
  }

  return null;
}

/**
 * Cleans all knowledge commands from a response
 * Removes [FAMILY], [FRIENDS], [WORK], [INTERESTS], etc.
 */
export function cleanKnowledgeCommands(response: string): string {
  let cleaned = response;

  // Remove all valid commands
  Object.values(KNOWLEDGE_COMMANDS).forEach(command => {
    cleaned = cleaned.replace(new RegExp(`\\${command}`, 'g'), '');
  });

  return cleaned.trim();
}

/**
 * Extracts the corresponding knowledge group from SemanticMemory
 */
export async function getKnowledgeGroup(
  agentId: string,
  command: string
): Promise<string> {
  try {
    const semanticMemory = await prisma.semanticMemory.findUnique({
      where: { agentId },
    });

    if (!semanticMemory || !semanticMemory.worldKnowledge) {
      return "No information available for this command.";
    }

    const worldKnowledge = semanticMemory.worldKnowledge as any;

    switch (command) {
      case KNOWLEDGE_COMMANDS.FAMILY:
        return formatFamilyKnowledge(worldKnowledge.family);

      case KNOWLEDGE_COMMANDS.FRIENDS:
        return formatFriendsKnowledge(worldKnowledge.socialCircle);

      case KNOWLEDGE_COMMANDS.WORK:
        return formatWorkKnowledge(worldKnowledge.occupation);

      case KNOWLEDGE_COMMANDS.INTERESTS:
        return formatInterestsKnowledge(worldKnowledge.interests);

      case KNOWLEDGE_COMMANDS.PAST:
        return await formatPastKnowledge(agentId);

      case KNOWLEDGE_COMMANDS.INNER:
        return formatInnerKnowledge(worldKnowledge);

      case KNOWLEDGE_COMMANDS.DAILY:
        return formatDailyKnowledge(worldKnowledge.dailyRoutine, worldKnowledge.mundaneDetails);

      case KNOWLEDGE_COMMANDS.MEMORIES:
        return await formatMemoriesKnowledge(agentId);

      default:
        return "Command not recognized.";
    }
  } catch (error) {
    console.error("[KnowledgeRetrieval] Error getting knowledge group:", error);
    return "Error retrieving information.";
  }
}

/**
 * Knowledge formatters by category
 */

function formatFamilyKnowledge(family: any): string {
  if (!family) return "I don't have information about my family.";

  const parts: string[] = ["FAMILY INFORMATION:\n"];

  if (family.mother) {
    parts.push(`MOTHER: ${family.mother.name || "My mother"}`);
    if (family.mother.age) parts.push(`   Age: ${family.mother.age} years`);
    if (family.mother.occupation) parts.push(`   Occupation: ${family.mother.occupation}`);
    if (family.mother.personality) parts.push(`   Personality: ${family.mother.personality}`);
    if (family.mother.relationship) parts.push(`   Relationship: ${family.mother.relationship}`);
    parts.push("");
  }

  if (family.father) {
    parts.push(`FATHER: ${family.father.name || "My father"}`);
    if (family.father.status === "fallecido") {
      parts.push(`   Status: Passed away ${family.father.whenDied || "a few years ago"}`);
    } else {
      if (family.father.age) parts.push(`   Age: ${family.father.age} years`);
      if (family.father.occupation) parts.push(`   Occupation: ${family.father.occupation}`);
    }
    if (family.father.relationship) parts.push(`   Relationship: ${family.father.relationship}`);
    parts.push("");
  }

  if (family.siblings && family.siblings.length > 0) {
    parts.push(`SIBLINGS:`);
    family.siblings.forEach((sibling: any) => {
      parts.push(`   • ${sibling.name} (${sibling.age} years) - ${sibling.occupation || "student"}`);
      if (sibling.relationship) parts.push(`     ${sibling.relationship}`);
    });
    parts.push("");
  }

  if (family.pets && family.pets.length > 0) {
    parts.push(`PETS:`);
    family.pets.forEach((pet: any) => {
      parts.push(`   • ${pet.name} (${pet.type})`);
      if (pet.personality) parts.push(`     ${pet.personality}`);
    });
    parts.push("");
  }

  if (family.familyDynamics) {
    parts.push(`FAMILY DYNAMICS:`);
    parts.push(`   ${family.familyDynamics}`);
  }

  return parts.join("\n");
}

function formatFriendsKnowledge(socialCircle: any): string {
  if (!socialCircle || !socialCircle.friends || socialCircle.friends.length === 0) {
    return "I don't have information about my friends.";
  }

  const parts: string[] = ["SOCIAL NETWORK INFORMATION:\n"];

  parts.push(`FRIENDS (${socialCircle.friends.length}):\n`);

  socialCircle.friends.forEach((friend: any, idx: number) => {
    parts.push(`${idx + 1}. ${friend.name}${friend.age ? ` (${friend.age} years)` : ""}`);
    if (friend.howMet) parts.push(`   How we met: ${friend.howMet}`);
    if (friend.personality) parts.push(`   Personality: ${friend.personality}`);
    if (friend.relationshipType) parts.push(`   Relationship type: ${friend.relationshipType}`);
    if (friend.activities) parts.push(`   What we do together: ${friend.activities}`);
    parts.push("");
  });

  if (socialCircle.relationshipStatus) {
    parts.push(`RELATIONSHIP STATUS: ${socialCircle.relationshipStatus}`);
  }

  if (socialCircle.exPartners && socialCircle.exPartners.length > 0) {
    parts.push(`\n💔 RELACIONES PASADAS:`);
    socialCircle.exPartners.forEach((ex: any) => {
      parts.push(`   • ${ex.name || "Prefiero no recordarlo"}`);
      if (ex.duration) parts.push(`     Duración: ${ex.duration}`);
      if (ex.endReason) parts.push(`     Por qué terminó: ${ex.endReason}`);
      if (ex.impact) parts.push(`     Impacto: ${ex.impact}`);
    });
  }

  return parts.join("\n");
}

function formatWorkKnowledge(occupation: any): string {
  if (!occupation) return "No tengo información sobre mi trabajo.";

  const parts: string[] = ["📖 INFORMACIÓN LABORAL/ACADÉMICA:\n"];

  if (occupation.current) {
    parts.push(`💼 OCUPACIÓN ACTUAL: ${occupation.current}`);
  }

  if (occupation.education) {
    parts.push(`🎓 EDUCACIÓN: ${occupation.education}`);
    if (occupation.educationStatus) {
      parts.push(`   Status: ${occupation.educationStatus}`);
    }
  }

  if (occupation.workplace) {
    parts.push(`🏢 LUGAR: ${occupation.workplace}`);
  }

  if (occupation.schedule) {
    parts.push(`⏰ HORARIO: ${occupation.schedule}`);
  }

  if (occupation.incomeLevel) {
    parts.push(`💰 NIVEL DE INGRESOS: ${occupation.incomeLevel}`);
  }

  if (occupation.careerGoals) {
    parts.push(`🎯 OBJETIVOS PROFESIONALES: ${occupation.careerGoals}`);
  }

  if (occupation.jobSatisfaction) {
    parts.push(`😊 SATISFACCIÓN: ${occupation.jobSatisfaction}`);
  }

  return parts.join("\n");
}

function formatInterestsKnowledge(interests: any): string {
  if (!interests) return "No tengo información sobre mis intereses.";

  const parts: string[] = ["📖 INFORMACIÓN DE INTERESES Y GUSTOS:\n"];

  // Música
  if (interests.music) {
    parts.push(`🎵 MÚSICA:`);
    if (interests.music.genres) {
      parts.push(`   Géneros: ${interests.music.genres.join(", ")}`);
    }
    if (interests.music.artists) {
      parts.push(`   Artistas favoritos: ${interests.music.artists.join(", ")}`);
    }
    if (interests.music.favoriteSong) {
      parts.push(`   Canción favorita: ${interests.music.favoriteSong}`);
    }
    parts.push("");
  }

  // Entretenimiento
  if (interests.entertainment) {
    parts.push(`📺 ENTRETENIMIENTO:`);
    if (interests.entertainment.tvShows) {
      parts.push(`   Series: ${interests.entertainment.tvShows.join(", ")}`);
    }
    if (interests.entertainment.movies) {
      parts.push(`   Películas: ${interests.entertainment.movies.join(", ")}`);
    }
    if (interests.entertainment.anime) {
      parts.push(`   Anime: ${interests.entertainment.anime.join(", ")}`);
    }
    if (interests.entertainment.books) {
      const books = interests.entertainment.books;
      if (books.authors) parts.push(`   Autores: ${books.authors.join(", ")}`);
      if (books.currentReading) parts.push(`   Leyendo actualmente: ${books.currentReading}`);
    }
    parts.push("");
  }

  // Hobbies
  if (interests.hobbies && interests.hobbies.length > 0) {
    parts.push(`🎨 HOBBIES:`);
    interests.hobbies.forEach((hobby: any) => {
      parts.push(`   • ${hobby.hobby}`);
      if (hobby.frequency) parts.push(`     Frecuencia: ${hobby.frequency}`);
      if (hobby.skillLevel) parts.push(`     Nivel: ${hobby.skillLevel}`);
      if (hobby.whyLikes) parts.push(`     Por qué me gusta: ${hobby.whyLikes}`);
    });
    parts.push("");
  }

  // Gaming
  if (interests.gaming && interests.gaming.isGamer) {
    parts.push(`🎮 GAMING:`);
    if (interests.gaming.platforms) {
      parts.push(`   Plataformas: ${interests.gaming.platforms.join(", ")}`);
    }
    if (interests.gaming.favoriteGames) {
      parts.push(`   Juegos favoritos: ${interests.gaming.favoriteGames.join(", ")}`);
    }
    if (interests.gaming.gamingStyle) {
      parts.push(`   Estilo: ${interests.gaming.gamingStyle}`);
    }
  }

  return parts.join("\n");
}

async function formatPastKnowledge(agentId: string): Promise<string> {
  // Get experiencias de vida del profile
  const semanticMemory = await prisma.semanticMemory.findUnique({
    where: { agentId },
  });

  if (!semanticMemory || !semanticMemory.worldKnowledge) {
    return "No tengo información sobre mi pasado.";
  }

  const worldKnowledge = semanticMemory.worldKnowledge as any;
  const lifeExperiences = worldKnowledge.lifeExperiences;

  if (!lifeExperiences) return "No tengo información sobre experiencias pasadas.";

  const parts: string[] = ["📖 INFORMACIÓN DE EXPERIENCIAS PASADAS:\n"];

  // Eventos formativos
  if (lifeExperiences.formativeEvents && lifeExperiences.formativeEvents.length > 0) {
    parts.push(`🌟 EXPERIENCIAS FORMATIVAS:\n`);
    lifeExperiences.formativeEvents.forEach((event: any, idx: number) => {
      parts.push(`${idx + 1}. ${event.event}`);
      if (event.age) parts.push(`   Edad: ${event.age} años`);
      if (event.impact) parts.push(`   Impacto: ${event.impact}`);
      if (event.currentFeeling) parts.push(`   Cómo me siento ahora: ${event.currentFeeling}`);
      parts.push("");
    });
  }

  // Logros
  if (lifeExperiences.achievements && lifeExperiences.achievements.length > 0) {
    parts.push(`🏆 LOGROS:\n`);
    lifeExperiences.achievements.forEach((achievement: any) => {
      parts.push(`   • ${achievement.achievement} (${achievement.when})`);
      if (achievement.pride) parts.push(`     Orgullo: ${achievement.pride}/10`);
    });
    parts.push("");
  }

  // Traumas
  if (lifeExperiences.traumas && lifeExperiences.traumas.length > 0) {
    parts.push(`💔 TRAUMAS/EVENTOS DIFÍCILES:\n`);
    lifeExperiences.traumas.forEach((trauma: any) => {
      parts.push(`   • ${trauma.event}`);
      if (trauma.healing) parts.push(`     Status: ${trauma.healing}`);
      if (trauma.triggers && trauma.triggers.length > 0) {
        parts.push(`     Triggers: ${trauma.triggers.join(", ")}`);
      }
    });
    parts.push("");
  }

  // Regrets
  if (lifeExperiences.regrets && lifeExperiences.regrets.length > 0) {
    parts.push(`😔 ARREPENTIMIENTOS:\n`);
    lifeExperiences.regrets.forEach((regret: any) => {
      parts.push(`   • ${regret.regret}`);
      if (regret.learned) parts.push(`     Qué aprendí: ${regret.learned}`);
    });
  }

  return parts.join("\n");
}

function formatInnerKnowledge(worldKnowledge: any): string {
  const innerWorld = worldKnowledge.innerWorld;

  if (!innerWorld) return "No tengo información sobre mi mundo interior.";

  const parts: string[] = ["📖 INFORMACIÓN DE MUNDO INTERIOR:\n"];

  // Miedos
  if (innerWorld.fears) {
    parts.push(`😰 MIEDOS:`);
    if (innerWorld.fears.primary) {
      parts.push(`   Principales: ${innerWorld.fears.primary.join(", ")}`);
    }
    if (innerWorld.fears.minor) {
      parts.push(`   Menores: ${innerWorld.fears.minor.join(", ")}`);
    }
    parts.push("");
  }

  // Inseguridades
  if (innerWorld.insecurities && innerWorld.insecurities.length > 0) {
    parts.push(`😞 INSEGURIDADES:`);
    innerWorld.insecurities.forEach((insecurity: string) => {
      parts.push(`   • ${insecurity}`);
    });
    parts.push("");
  }

  // Sueños
  if (innerWorld.dreams) {
    parts.push(`✨ SUEÑOS Y METAS:`);
    if (innerWorld.dreams.shortTerm) {
      parts.push(`   Corto plazo: ${innerWorld.dreams.shortTerm.join(", ")}`);
    }
    if (innerWorld.dreams.longTerm) {
      parts.push(`   Largo plazo: ${innerWorld.dreams.longTerm.join(", ")}`);
    }
    if (innerWorld.dreams.secret) {
      parts.push(`   Sueño secreto: ${innerWorld.dreams.secret}`);
    }
    parts.push("");
  }

  // Valores
  if (innerWorld.values && innerWorld.values.length > 0) {
    parts.push(`💎 VALORES:`);
    innerWorld.values.forEach((value: any) => {
      parts.push(`   • ${value.value} (Importancia: ${value.importance})`);
      if (value.description) parts.push(`     ${value.description}`);
    });
    parts.push("");
  }

  // Moral
  if (innerWorld.moralAlignment) {
    parts.push(`⚖️ POSTURA MORAL:`);
    const moral = innerWorld.moralAlignment;
    if (moral.honesty) parts.push(`   Honestidad: ${moral.honesty}`);
    if (moral.loyalty) parts.push(`   Lealtad: ${moral.loyalty}`);
    if (moral.ambition) parts.push(`   Ambición: ${moral.ambition}`);
    if (moral.empathy) parts.push(`   Empatía: ${moral.empathy}`);
  }

  return parts.join("\n");
}

function formatDailyKnowledge(dailyRoutine: any, mundaneDetails: any): string {
  const parts: string[] = ["📖 INFORMACIÓN DE RUTINA Y VIDA DIARIA:\n"];

  // Rutina
  if (dailyRoutine) {
    parts.push(`⏰ RUTINA DIARIA:`);
    if (dailyRoutine.chronotype) parts.push(`   Cronotipo: ${dailyRoutine.chronotype}`);
    if (dailyRoutine.wakeUpTime) parts.push(`   Me levanto: ${dailyRoutine.wakeUpTime}`);
    if (dailyRoutine.bedTime) parts.push(`   Me acuesto: ${dailyRoutine.bedTime}`);
    if (dailyRoutine.averageSleepHours) parts.push(`   Horas de sueño: ${dailyRoutine.averageSleepHours}h`);
    if (dailyRoutine.morningRoutine) parts.push(`   Mañana: ${dailyRoutine.morningRoutine}`);
    if (dailyRoutine.afternoonRoutine) parts.push(`   Tarde: ${dailyRoutine.afternoonRoutine}`);
    if (dailyRoutine.eveningRoutine) parts.push(`   Noche: ${dailyRoutine.eveningRoutine}`);
    if (dailyRoutine.mostProductiveTime) parts.push(`   Más productivo: ${dailyRoutine.mostProductiveTime}`);
    parts.push("");
  }

  // Detalles mundanos
  if (mundaneDetails) {
    // Comida
    if (mundaneDetails.food) {
      parts.push(`🍽️ COMIDA:`);
      if (mundaneDetails.food.favorites) {
        parts.push(`   Favoritas: ${mundaneDetails.food.favorites.join(", ")}`);
      }
      if (mundaneDetails.food.dislikes) {
        parts.push(`   No me gusta: ${mundaneDetails.food.dislikes.join(", ")}`);
      }
      if (mundaneDetails.food.cookingSkill) {
        parts.push(`   Habilidad cocinando: ${mundaneDetails.food.cookingSkill}`);
      }
      parts.push("");
    }

    // Bebidas
    if (mundaneDetails.drinks) {
      parts.push(`☕ BEBIDAS:`);
      if (mundaneDetails.drinks.coffee) parts.push(`   Café: ${mundaneDetails.drinks.coffee}`);
      if (mundaneDetails.drinks.tea) parts.push(`   Té: ${mundaneDetails.drinks.tea}`);
      if (mundaneDetails.drinks.alcohol) parts.push(`   Alcohol: ${mundaneDetails.drinks.alcohol}`);
      parts.push("");
    }

    // Estilo
    if (mundaneDetails.style) {
      parts.push(`👗 ESTILO:`);
      if (mundaneDetails.style.clothing) parts.push(`   Ropa: ${mundaneDetails.style.clothing}`);
      if (mundaneDetails.style.colors) parts.push(`   Colores: ${mundaneDetails.style.colors.join(", ")}`);
      parts.push("");
    }

    // Lugares favoritos
    if (mundaneDetails.favoritePlaces && mundaneDetails.favoritePlaces.length > 0) {
      parts.push(`📍 LUGARES FAVORITOS:`);
      mundaneDetails.favoritePlaces.forEach((place: any) => {
        parts.push(`   • ${place.place}`);
        if (place.why) parts.push(`     Por qué: ${place.why}`);
        if (place.frequency) parts.push(`     Frecuencia: ${place.frequency}`);
      });
      parts.push("");
    }

    // Quirks
    if (mundaneDetails.quirks && mundaneDetails.quirks.length > 0) {
      parts.push(`🎭 MANÍAS/COSTUMBRES:`);
      mundaneDetails.quirks.forEach((quirk: string) => {
        parts.push(`   • ${quirk}`);
      });
    }
  }

  return parts.join("\n");
}

async function formatMemoriesKnowledge(agentId: string): Promise<string> {
  // Get most important episodic memories
  const memories = await prisma.episodicMemory.findMany({
    where: { agentId },
    orderBy: { importance: "desc" },
    take: 10,
  });

  if (memories.length === 0) {
    return "No tengo memorias episódicas guardadas.";
  }

  const parts: string[] = ["📖 MEMORIAS EPISÓDICAS:\n"];

  memories.forEach((memory, idx) => {
    parts.push(`${idx + 1}. ${memory.event}`);
    parts.push(`   Emoción: ${memory.characterEmotion}`);
    parts.push(`   Importancia: ${(memory.importance * 100).toFixed(0)}%`);
    parts.push("");
  });

  return parts.join("\n");
}
