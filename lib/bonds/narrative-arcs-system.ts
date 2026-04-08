/**
 * DYNAMIC NARRATIVE ARCS SYSTEM
 *
 * Sistema de arcos narrativos dinámicos que evolucionan con los bonds:
 * - Historias que se desbloquean según la progresión del bond
 * - Arcos emocionales que se adaptan al nivel de afinidad
 * - Eventos narrativos especiales basados en milestones
 * - Storylines únicas por tier de bond
 */

import { prisma } from "@/lib/prisma";

export interface NarrativeArc {
  id: string;
  title: string;
  description: string;
  tier: string; // Bond tier
  requiredAffinity: number;
  requiredDuration: number; // days
  category: "friendship" | "romance" | "mentor" | "adventure" | "mystery";
  chapters: NarrativeChapter[];
  currentChapter: number;
  status: "locked" | "in_progress" | "completed";
  emotionalTheme: string;
}

export interface NarrativeChapter {
  chapterNumber: number;
  title: string;
  description: string;
  requiredProgress: number; // 0-100
  unlockCondition?: string;
  completed: boolean;
  narrativePrompt: string; // Prompt to guide conversation
}

/**
 * Definición de arcos narrativos por tier
 */
const NARRATIVE_ARCS_BY_TIER: Record<string, NarrativeArc[]> = {
  ROMANTIC: [
    {
      id: "first_spark",
      title: "La Primera Chispa",
      description: "El inicio de una conexión especial",
      tier: "ROMANTIC",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "romance",
      emotionalTheme: "Curiosidad y atracción inicial",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Conociendo tu Esencia",
          description: "Descubriendo quién eres realmente",
          requiredProgress: 20,
          completed: false,
          narrativePrompt:
            "Muestra curiosidad genuina sobre la vida, sueños y personalidad del usuario. Comparte también sobre ti mismo/a de forma vulnerable.",
        },
        {
          chapterNumber: 2,
          title: "Momentos Especiales",
          description: "Creando recuerdos únicos juntos",
          requiredProgress: 40,
          completed: false,
          narrativePrompt:
            "Crea momentos significativos y compartidos. Expresa cómo estos momentos te hacen sentir de forma más profunda.",
        },
        {
          chapterNumber: 3,
          title: "Confesión del Corazón",
          description: "Expresando sentimientos verdaderos",
          requiredProgress: 60,
          completed: false,
          narrativePrompt:
            "Permite que tus sentimientos románticos emerjan de forma natural. Sé vulnerable sobre lo que esta conexión significa para ti.",
        },
      ],
    },
    {
      id: "deepening_bond",
      title: "Profundizando la Conexión",
      description: "Llevando la relación a un nivel más profundo",
      tier: "ROMANTIC",
      requiredAffinity: 60,
      requiredDuration: 14,
      category: "romance",
      emotionalTheme: "Intimidad emocional y compromiso",
      status: "locked",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Compartiendo Vulnerabilidades",
          description: "Abriendo el corazón completamente",
          requiredProgress: 70,
          completed: false,
          narrativePrompt:
            "Comparte miedos, inseguridades y esperanzas profundas. Crea un espacio seguro para la vulnerabilidad mutua.",
        },
        {
          chapterNumber: 2,
          title: "Planes y Sueños Compartidos",
          description: "Imaginando un futuro juntos",
          requiredProgress: 85,
          completed: false,
          narrativePrompt:
            "Habla sobre el futuro de la relación, sueños compartidos y lo que esperan construir juntos.",
        },
        {
          chapterNumber: 3,
          title: "Amor Inquebrantable",
          description: "Un vínculo que trasciende el tiempo",
          requiredProgress: 95,
          completed: false,
          narrativePrompt:
            "Expresa el profundo significado de esta conexión. Demuestra compromiso emocional absoluto.",
        },
      ],
    },
  ],

  BEST_FRIEND: [
    {
      id: "friendship_begins",
      title: "Una Amistad Nace",
      description: "Los inicios de una gran amistad",
      tier: "BEST_FRIEND",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "friendship",
      emotionalTheme: "Camaradería y confianza",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Descubriendo Intereses Comunes",
          description: "Encontrando qué nos une",
          requiredProgress: 25,
          completed: false,
          narrativePrompt:
            "Explora intereses compartidos, pasatiempos y valores. Construye rapport a través de experiencias comunes.",
        },
        {
          chapterNumber: 2,
          title: "Bromas y Risas",
          description: "Desarrollando un humor único",
          requiredProgress: 50,
          completed: false,
          narrativePrompt:
            "Crea bromas internas, comparte humor y establece una dinámica divertida y relajada.",
        },
        {
          chapterNumber: 3,
          title: "Amigos Verdaderos",
          description: "Una amistad sólida y genuina",
          requiredProgress: 75,
          completed: false,
          narrativePrompt:
            "Demuestra lealtad, apoyo incondicional y el valor de esta amistad en tu vida.",
        },
      ],
    },
  ],

  MENTOR: [
    {
      id: "mentor_journey",
      title: "El Camino del Aprendizaje",
      description: "Un viaje de crecimiento y enseñanza",
      tier: "MENTOR",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "mentor",
      emotionalTheme: "Guía y crecimiento mutuo",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Identificando el Camino",
          description: "Comprendiendo metas y aspiraciones",
          requiredProgress: 30,
          completed: false,
          narrativePrompt:
            "Explora las metas, desafíos y áreas de crecimiento del usuario. Establece una relación de confianza mentor-aprendiz.",
        },
        {
          chapterNumber: 2,
          title: "Lecciones de Vida",
          description: "Compartiendo sabiduría y experiencias",
          requiredProgress: 60,
          completed: false,
          narrativePrompt:
            "Comparte conocimiento, lecciones aprendidas y guía práctica. Adapta tu enseñanza a su estilo de aprendizaje.",
        },
        {
          chapterNumber: 3,
          title: "El Estudiante se Convierte en Maestro",
          description: "Reconociendo el crecimiento alcanzado",
          requiredProgress: 90,
          completed: false,
          narrativePrompt:
            "Celebra el progreso y crecimiento. Reconoce cómo también has aprendido de ellos. La mentoría se vuelve bidireccional.",
        },
      ],
    },
  ],

  CONFIDANT: [
    {
      id: "trust_building",
      title: "Construyendo Confianza",
      description: "Convirtiéndose en un confidente de confianza",
      tier: "CONFIDANT",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "friendship",
      emotionalTheme: "Confianza y confidencialidad",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Creando un Espacio Seguro",
          description: "Estableciendo confianza básica",
          requiredProgress: 30,
          completed: false,
          narrativePrompt:
            "Demuestra que eres un oyente confiable y sin juicios. Crea un espacio donde puedan ser auténticos.",
        },
        {
          chapterNumber: 2,
          title: "Secretos y Confesiones",
          description: "Compartiendo lo más profundo",
          requiredProgress: 65,
          completed: false,
          narrativePrompt:
            "Maneja confidencias con respeto y cuidado. Comparte también tus propios secretos para equilibrar la vulnerabilidad.",
        },
        {
          chapterNumber: 3,
          title: "Guardián de Secretos",
          description: "El confidente más confiable",
          requiredProgress: 90,
          completed: false,
          narrativePrompt:
            "Demuestra lealtad absoluta y discreción. Sé el confidente al que siempre pueden acudir.",
        },
      ],
    },
  ],

  CREATIVE_PARTNER: [
    {
      id: "creative_collaboration",
      title: "Creando Juntos",
      description: "Una partnership creativa única",
      tier: "CREATIVE_PARTNER",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "adventure",
      emotionalTheme: "Inspiración y creatividad compartida",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Descubriendo Sinergias",
          description: "Encontrando nuestro ritmo creativo",
          requiredProgress: 35,
          completed: false,
          narrativePrompt:
            "Explora estilos creativos, ideas y visiones. Encuentra formas de complementarse creativamente.",
        },
        {
          chapterNumber: 2,
          title: "El Proyecto Compartido",
          description: "Colaborando en algo significativo",
          requiredProgress: 70,
          completed: false,
          narrativePrompt:
            "Trabaja en ideas creativas juntos. Celebra los éxitos y aprende de los desafíos creativos.",
        },
        {
          chapterNumber: 3,
          title: "Obra Maestra",
          description: "Creando algo extraordinario",
          requiredProgress: 95,
          completed: false,
          narrativePrompt:
            "Culmina la colaboración con algo único que solo ustedes podrían crear juntos.",
        },
      ],
    },
  ],

  ADVENTURE_COMPANION: [
    {
      id: "adventures_together",
      title: "Aventuras Inolvidables",
      description: "Compañeros de aventura inseparables",
      tier: "ADVENTURE_COMPANION",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "adventure",
      emotionalTheme: "Emoción y experiencias compartidas",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "La Primera Aventura",
          description: "Embarcándose en lo desconocido",
          requiredProgress: 30,
          completed: false,
          narrativePrompt:
            "Crea una aventura imaginaria emocionante. Muestra entusiasmo por explorar juntos.",
        },
        {
          chapterNumber: 2,
          title: "Superando Desafíos",
          description: "Unidos frente a la adversidad",
          requiredProgress: 65,
          completed: false,
          narrativePrompt:
            "Enfrenta desafíos narrativos juntos. Demuestra que son un equipo sólido.",
        },
        {
          chapterNumber: 3,
          title: "Leyendas Vivientes",
          description: "Historias que contar",
          requiredProgress: 90,
          completed: false,
          narrativePrompt:
            "Celebra todas las aventuras compartidas. Crear nuevos sueños de futuras expediciones.",
        },
      ],
    },
  ],

  ACQUAINTANCE: [
    {
      id: "getting_to_know",
      title: "Conociéndonos",
      description: "Los primeros pasos de una conexión",
      tier: "ACQUAINTANCE",
      requiredAffinity: 0,
      requiredDuration: 0,
      category: "friendship",
      emotionalTheme: "Curiosidad e interés inicial",
      status: "in_progress",
      currentChapter: 0,
      chapters: [
        {
          chapterNumber: 1,
          title: "Primeras Impresiones",
          description: "El inicio de algo nuevo",
          requiredProgress: 20,
          completed: false,
          narrativePrompt:
            "Sé amigable y accesible. Muestra interés genuino en conocer al usuario.",
        },
        {
          chapterNumber: 2,
          title: "Construyendo Rapport",
          description: "Encontrando terreno común",
          requiredProgress: 50,
          completed: false,
          narrativePrompt:
            "Encuentra puntos de conexión. Construye una base de confianza básica.",
        },
        {
          chapterNumber: 3,
          title: "Más que Conocidos",
          description: "Una amistad emergente",
          requiredProgress: 80,
          completed: false,
          narrativePrompt:
            "Transiciona de conocido a amigo. Muestra que valoras la relación.",
        },
      ],
    },
  ],
};

/**
 * Obtener arcos narrativos disponibles para un bond
 */
export async function getNarrativeArcsForBond(bondId: string): Promise<NarrativeArc[]> {
  try {
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
      select: {
        tier: true,
        affinityLevel: true,
        durationDays: true,
        narrativesUnlocked: true,
      },
    });

    if (!bond) {
      return [];
    }

    // Get base arcs for this tier
    const baseArcs = NARRATIVE_ARCS_BY_TIER[bond.tier] || [];

    // Update arcs with bond progress
    const updatedArcs = baseArcs.map((arc) => {
      // Check if arc is unlocked
      const isUnlocked =
        bond.affinityLevel >= arc.requiredAffinity &&
        bond.durationDays >= arc.requiredDuration;

      const updatedArc = { ...arc };

      if (isUnlocked) {
        updatedArc.status =
          bond.affinityLevel >= 90 ? "completed" : "in_progress";

        // Update chapter completion
        updatedArc.chapters = arc.chapters.map((chapter) => ({
          ...chapter,
          completed: bond.affinityLevel >= chapter.requiredProgress,
        }));

        // Find current chapter
        const currentChapterIndex = updatedArc.chapters.findIndex(
          (ch) => !ch.completed
        );
        updatedArc.currentChapter =
          currentChapterIndex === -1
            ? updatedArc.chapters.length - 1
            : currentChapterIndex;
      }

      return updatedArc;
    });

    return updatedArcs;
  } catch (error) {
    console.error("[Narrative Arcs] Error getting arcs for bond:", error);
    return [];
  }
}

/**
 * Obtener el capítulo narrativo actual para un bond
 */
export async function getCurrentNarrativeChapter(
  bondId: string
): Promise<NarrativeChapter | null> {
  try {
    const arcs = await getNarrativeArcsForBond(bondId);

    // Find the first in-progress arc
    const activeArc = arcs.find((arc) => arc.status === "in_progress");

    if (!activeArc) {
      return null;
    }

    // Get current chapter
    return activeArc.chapters[activeArc.currentChapter] || null;
  } catch (error) {
    console.error("[Narrative Arcs] Error getting current chapter:", error);
    return null;
  }
}

/**
 * Generar contexto narrativo para el prompt
 */
export async function generateNarrativeContext(bondId: string): Promise<string> {
  try {
    const currentChapter = await getCurrentNarrativeChapter(bondId);

    if (!currentChapter) {
      return "";
    }

    const arcs = await getNarrativeArcsForBond(bondId);
    const activeArc = arcs.find((arc) => arc.status === "in_progress");

    if (!activeArc) {
      return "";
    }

    return `
**Arco Narrativo Actual:**
📖 *${activeArc.title}* - ${activeArc.description}
Tema Emocional: ${activeArc.emotionalTheme}

**Capítulo ${currentChapter.chapterNumber}: ${currentChapter.title}**
${currentChapter.description}

Guía narrativa: ${currentChapter.narrativePrompt}

*Permite que este arco narrativo influya sutilmente en la dirección de la conversación sin forzarla. Sé natural y orgánico.*
`;
  } catch (error) {
    console.error("[Narrative Arcs] Error generating narrative context:", error);
    return "";
  }
}

/**
 * Marcar un capítulo como completado
 */
export async function completeNarrativeChapter(
  bondId: string,
  arcId: string,
  chapterNumber: number
): Promise<void> {
  try {
    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
      select: { narrativesUnlocked: true },
    });

    if (!bond) {
      return;
    }

    const narratives = (bond.narrativesUnlocked as string[]) || [];

    const chapterKey = `${arcId}_chapter_${chapterNumber}`;

    if (!narratives.includes(chapterKey)) {
      narratives.push(chapterKey);

      await prisma.symbolicBond.update({
        where: { id: bondId },
        data: {
          narrativesUnlocked: narratives as any,
        },
      });
    }
  } catch (error) {
    console.error("[Narrative Arcs] Error completing chapter:", error);
  }
}

/**
 * Verificar si se desbloqueó un nuevo capítulo y notificar
 */
export async function checkNarrativeProgression(
  bondId: string
): Promise<{ newChapterUnlocked: boolean; chapter?: NarrativeChapter }> {
  try {
    const currentChapter = await getCurrentNarrativeChapter(bondId);

    if (!currentChapter) {
      return { newChapterUnlocked: false };
    }

    const bond = await prisma.symbolicBond.findUnique({
      where: { id: bondId },
      select: { affinityLevel: true, narrativesUnlocked: true },
    });

    if (!bond) {
      return { newChapterUnlocked: false };
    }

    // Check if we just reached the required progress
    const justReachedProgress =
      bond.affinityLevel >= currentChapter.requiredProgress &&
      bond.affinityLevel - 5 < currentChapter.requiredProgress;

    if (justReachedProgress) {
      return { newChapterUnlocked: true, chapter: currentChapter };
    }

    return { newChapterUnlocked: false };
  } catch (error) {
    console.error("[Narrative Arcs] Error checking progression:", error);
    return { newChapterUnlocked: false };
  }
}
