/**
 * Narrative Arc Detector - Sistema de detección automática de arcos narrativos
 * Detecta patrones en conversaciones y los estructura como arcos narrativos
 */

export type NarrativeState = 'seeking' | 'progress' | 'conclusion' | 'ongoing';

export type NarrativeCategory =
  | 'work_career'
  | 'relationships_love'
  | 'education_learning'
  | 'health_fitness'
  | 'personal_projects'
  | 'family'
  | 'other';

export interface NarrativePattern {
  state: NarrativeState;
  keywords: string[];
  emotionalTone?: 'positive' | 'negative' | 'neutral' | 'anxious';
}

export interface DetectedArcEvent {
  timestamp: Date;
  message: string;
  state: NarrativeState;
  category: NarrativeCategory;
  confidence: number; // 0-1
  keywords: string[];
  emotionalTone?: string;
}

// Patrones de detección por estado narrativo
const NARRATIVE_PATTERNS: Record<NarrativeState, NarrativePattern[]> = {
  seeking: [
    {
      state: 'seeking',
      keywords: ['busco', 'buscando', 'quiero', 'necesito', 'estoy buscando', 'me gustaría', 'quisiera', 'ojalá'],
      emotionalTone: 'anxious',
    },
    {
      state: 'seeking',
      keywords: ['aplicar', 'postular', 'enviar cv', 'mandar solicitud', 'intentar conseguir'],
      emotionalTone: 'neutral',
    },
  ],
  progress: [
    {
      state: 'progress',
      keywords: ['tengo entrevista', 'me llamaron', 'tengo cita', 'vamos a salir', 'estoy en proceso', 'me contactaron'],
      emotionalTone: 'positive',
    },
    {
      state: 'progress',
      keywords: ['segunda ronda', 'otra entrevista', 'siguiendo con', 'continuamos', 'avanzando'],
      emotionalTone: 'neutral',
    },
    {
      state: 'progress',
      keywords: ['estudiando para', 'preparando', 'practicando', 'entrenando', 'trabajando en'],
      emotionalTone: 'neutral',
    },
  ],
  conclusion: [
    {
      state: 'conclusion',
      keywords: ['conseguí', 'logré', 'terminé', 'completé', 'aprobé', 'me gradué', 'ganamos', 'me aceptaron', 'aceptaron', 'fui aceptado', 'fui aceptada'],
      emotionalTone: 'positive',
    },
    {
      state: 'conclusion',
      keywords: ['somos pareja', 'somos novios', 'estamos saliendo', 'me aceptó', 'dijo que sí', 'aceptó salir'],
      emotionalTone: 'positive',
    },
    {
      state: 'conclusion',
      keywords: ['no funcionó', 'me rechazaron', 'no pasé', 'suspendí', 'fallé', 'terminamos', 'no resultó'],
      emotionalTone: 'negative',
    },
  ],
  ongoing: [
    {
      state: 'ongoing',
      keywords: ['sigo', 'continúo', 'todavía', 'aún', 'esperando respuesta', 'sin novedades'],
      emotionalTone: 'neutral',
    },
  ],
};

// Patrones de categorización
const CATEGORY_PATTERNS: Record<NarrativeCategory, string[]> = {
  work_career: [
    'trabajo', 'empleo', 'empresa', 'jefe', 'oficina', 'salario', 'carrera',
    'cv', 'currículum', 'entrevista laboral', 'postular', 'empleador', 'ascenso',
    'promoción', 'renuncia', 'despido', 'contrato', 'freelance', 'negocio'
  ],
  relationships_love: [
    'me gusta', 'amor', 'crush', 'cita', 'salir con', 'pareja', 'novio', 'novia',
    'enamorado', 'beso', 'romance', 'relación', 'corazón', 'amor de mi vida',
    'primer beso', 'declaración', 'cortejo', 'conquista', 'ruptura', 'ex'
  ],
  education_learning: [
    'estudiar', 'universidad', 'curso', 'examen', 'aprobar', 'materia', 'carrera',
    'título', 'graduación', 'tesis', 'profesor', 'clase', 'aprender', 'educación',
    'certificado', 'diplomado', 'maestría', 'doctorado', 'escuela', 'calificación',
    'gradué', 'graduado', 'graduada', 'empecé a estudiar', 'estudiando', 'matemáticas',
    'matemática', 'física', 'química', 'historia', 'inglés', 'idioma', 'alumno', 'estudiante'
  ],
  health_fitness: [
    'gym', 'gimnasio', 'ejercicio', 'dieta', 'adelgazar', 'músculo', 'entrenar',
    'salud', 'médico', 'hospital', 'tratamiento', 'terapia', 'enfermedad', 'recuperación',
    'peso', 'fitness', 'running', 'maratón', 'nutrición', 'bienestar', 'kilos', 'kilo',
    'kg', 'consulta', 'consulta médica', 'doctor', 'doctora', 'médica', 'bajar de peso',
    'subir de peso', 'engordar', 'grasa', 'cardio', 'yoga', 'pilates', 'deportes'
  ],
  personal_projects: [
    'proyecto', 'app', 'startup', 'emprendimiento', 'desarrollar', 'crear',
    'construir', 'diseñar', 'lanzar', 'producto', 'prototipo', 'idea de negocio',
    'portfolio', 'blog', 'canal', 'contenido', 'side project', 'hobby'
  ],
  family: [
    'familia', 'padres', 'hermano', 'hermana', 'hijo', 'hija', 'mamá', 'papá',
    'tío', 'tía', 'primo', 'abuela', 'abuelo', 'familiar', 'bebé', 'embarazo',
    'adopción', 'mascota', 'perro', 'gato', 'hogar', 'casa familiar'
  ],
  other: []
};

export class NarrativeArcDetector {
  /**
   * Normaliza keywords para incluir formas base de verbos
   */
  private static normalizeKeywords(keywords: string[]): string[] {
    const normalized = new Set(keywords);

    // Map de conjugaciones comunes a forma base
    const verbMappings: Record<string, string> = {
      'buscando': 'busco',
      'queriendo': 'quiero',
      'necesitando': 'necesito',
      'trabajando': 'trabajo',
      'estudiando': 'estudio',
      'graduando': 'gradúo',
    };

    keywords.forEach(keyword => {
      // Check if keyword contains any mapped verb
      for (const [conjugated, base] of Object.entries(verbMappings)) {
        if (keyword.includes(conjugated)) {
          normalized.add(base);
        }
      }
    });

    return Array.from(normalized);
  }

  /**
   * Detecta el estado narrativo de un mensaje
   */
  static detectNarrativeState(message: string): {
    state: NarrativeState | null;
    confidence: number;
    keywords: string[];
    emotionalTone?: string;
  } {
    const messageLower = message.toLowerCase();

    let bestMatch: {
      state: NarrativeState | null;
      confidence: number;
      keywords: string[];
      emotionalTone?: string;
    } = {
      state: null,
      confidence: 0,
      keywords: [],
    };

    // Buscar patrones en cada estado
    for (const [state, patterns] of Object.entries(NARRATIVE_PATTERNS)) {
      for (const pattern of patterns) {
        const matchedKeywords = pattern.keywords.filter(keyword =>
          messageLower.includes(keyword.toLowerCase())
        );

        if (matchedKeywords.length > 0) {
          // Normalizar keywords para incluir formas base
          const normalizedKeywords = this.normalizeKeywords(matchedKeywords);

          // Calcular confianza basada en cantidad de keywords y longitud
          const confidence = Math.min(
            0.5 + (matchedKeywords.length * 0.2) + (matchedKeywords[0].length / 100),
            1.0
          );

          if (confidence > bestMatch.confidence) {
            bestMatch = {
              state: state as NarrativeState,
              confidence,
              keywords: normalizedKeywords,
              emotionalTone: pattern.emotionalTone,
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Detecta la categoría de un mensaje
   */
  static detectCategory(message: string): {
    category: NarrativeCategory;
    confidence: number;
    keywords: string[];
  } {
    const messageLower = message.toLowerCase();

    let bestMatch: {
      category: NarrativeCategory;
      confidence: number;
      keywords: string[];
    } = {
      category: 'other',
      confidence: 0,
      keywords: [],
    };

    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
      const matchedKeywords = keywords.filter(keyword =>
        messageLower.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        // Normalizar keywords para incluir formas base
        const normalizedKeywords = this.normalizeKeywords(matchedKeywords);

        const confidence = Math.min(
          0.4 + (matchedKeywords.length * 0.15),
          1.0
        );

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category: category as NarrativeCategory,
            confidence,
            keywords: normalizedKeywords,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Analiza un mensaje completo y extrae información de arco narrativo
   */
  static analyzeMessage(message: string, timestamp: Date): DetectedArcEvent | null {
    const stateResult = this.detectNarrativeState(message);
    const categoryResult = this.detectCategory(message);

    // Solo crear evento si tenemos suficiente confianza
    if (stateResult.state && stateResult.confidence >= 0.5 && categoryResult.confidence >= 0.4) {
      return {
        timestamp,
        message,
        state: stateResult.state,
        category: categoryResult.category,
        confidence: (stateResult.confidence + categoryResult.confidence) / 2,
        keywords: [...stateResult.keywords, ...categoryResult.keywords],
        emotionalTone: stateResult.emotionalTone,
      };
    }

    return null;
  }

  /**
   * Extrae el tema principal de un mensaje para linking
   */
  static extractTheme(message: string): string {
    const messageLower = message.toLowerCase();

    // Extraer sustantivos principales (simplificado)
    // In production, use a real NLP parser
    const commonWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'con', 'para', 'por', 'que', 'me', 'te', 'se', 'mi', 'tu', 'su', 'al', 'del', 'como', 'muy', 'más'];
    const words = messageLower
      .split(/\s+/)
      .filter(w => w.length > 2 && !commonWords.includes(w))
      .slice(0, 8); // Increased from 5 to 8 for better coverage

    return words.join(' ');
  }

  /**
   * Calcula similitud entre dos temas (0-1)
   */
  static calculateThemeSimilarity(theme1: string, theme2: string): number {
    const words1 = new Set(theme1.toLowerCase().split(/\s+/));
    const words2 = new Set(theme2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Determina si dos eventos podrían estar relacionados
   */
  static areEventsRelated(
    event1: DetectedArcEvent,
    event2: DetectedArcEvent,
    maxDaysBetween: number = 90
  ): boolean {
    // Misma categoría
    if (event1.category !== event2.category) return false;

    // Dentro del rango de tiempo
    const daysBetween = Math.abs(
      (event2.timestamp.getTime() - event1.timestamp.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysBetween > maxDaysBetween) return false;

    // Similitud temática
    const theme1 = this.extractTheme(event1.message);
    const theme2 = this.extractTheme(event2.message);
    const similarity = this.calculateThemeSimilarity(theme1, theme2);

    // Also check for keyword overlap from detected events
    const keywordOverlap = event1.keywords.some(k1 =>
      event2.keywords.some(k2 =>
        k1.toLowerCase().includes(k2.toLowerCase()) ||
        k2.toLowerCase().includes(k1.toLowerCase())
      )
    );

    return similarity >= 0.2 || keywordOverlap;
  }

  /**
   * Obtiene label legible para categoría
   */
  static getCategoryLabel(category: NarrativeCategory): string {
    const labels: Record<NarrativeCategory, string> = {
      work_career: 'Trabajo/Carrera',
      relationships_love: 'Relaciones/Amor',
      education_learning: 'Educación/Aprendizaje',
      health_fitness: 'Salud/Fitness',
      personal_projects: 'Proyectos Personales',
      family: 'Familia',
      other: 'Otro',
    };
    return labels[category];
  }

  /**
   * Obtiene label legible para estado
   */
  static getStateLabel(state: NarrativeState): string {
    const labels: Record<NarrativeState, string> = {
      seeking: 'Buscando',
      progress: 'En progreso',
      conclusion: 'Conclusión',
      ongoing: 'Continuando',
    };
    return labels[state];
  }
}
