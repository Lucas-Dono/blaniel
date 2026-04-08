/**
 * INTELLIGENT MEMORY STORAGE SYSTEM
 *
 * Multi-factor system that decides what memories to save based on:
 * 1. Emotional factor: High arousal/emotional intensity
 * 2. Informative factor: New information about the user
 * 3. Event factor: Significant events detected
 * 4. Temporal factor: Consistency/repetition (consolidation)
 *
 * SCORING SYSTEM:
 * - Arousal > 0.6: +30 points
 * - New personal information: +40 points
 * - Significant event: +50 points
 * - Mentioned 2+ times: +20 points
 * - Threshold to save: 50 points
 *
 * INTEGRATION:
 * - Integrates with Important Events/People services
 * - Replaces the simple importance system
 * - Avoids false positives with multiple factors
 */

import { createLogger } from "@/lib/logger";
import type { EmotionState } from "../../types";
import { ImportantEventsService } from "@/lib/services/important-events.service";
import { ImportantPeopleService } from "@/lib/services/important-people.service";

const log = createLogger("IntelligentStorage");

// Temporary type until Appraisal is properly defined
type Appraisal = any;

// Types for the system
export interface StorageDecision {
  shouldStore: boolean;
  finalScore: number;
  factors: {
    emotional: number;
    informative: number;
    eventBased: number;
    temporal: number;
  };
  detectedEntities: {
    personalInfo?: PersonalInfoDetection;
    significantEvent?: SignificantEventDetection;
    importantPerson?: ImportantPersonDetection;
  };
  importance: number; // 0-1 for compatibility with current system
}

export interface PersonalInfoDetection {
  type: 'name' | 'age' | 'location' | 'occupation' | 'preference' | 'relationship' | 'health' | 'goal';
  value: string;
  confidence: number; // 0-1
}

export interface SignificantEventDetection {
  type: 'birthday' | 'medical' | 'exam' | 'special' | 'anniversary' | 'job_change' | 'relationship_change' | 'achievement' | 'loss';
  description: string;
  confidence: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  date?: Date;
}

export interface ImportantPersonDetection {
  name: string;
  relationship?: string;
  mentionContext: string;
  confidence: number;
}

export class IntelligentStorageSystem {
  private readonly STORAGE_THRESHOLD = 50; // Minimum points to save
  private readonly WEIGHTS = {
    emotional: 30,     // High arousal
    informative: 40,   // New personal information
    eventBased: 50,    // Significant event
    temporal: 20,      // Repetition/consolidation
  };

  /**
   * Decide if a memory should be saved using multi-factor scoring
   */
  async decideStorage(params: {
    agentId: string;
    userId: string;
    userMessage: string;
    characterResponse: string;
    emotions: EmotionState;
    appraisal: Appraisal;
    conversationHistory?: Array<{ userMessage: string; timestamp: Date }>;
  }): Promise<StorageDecision> {
    log.info({ agentId: params.agentId }, "Analyzing storage decision...");

    const factors = {
      emotional: 0,
      informative: 0,
      eventBased: 0,
      temporal: 0,
    };

    const detectedEntities: StorageDecision['detectedEntities'] = {};

    // ============================================
    // FACTOR 1: EMOTIONAL (High Arousal)
    // ============================================
    const emotionalScore = this.calculateEmotionalFactor(params.emotions, params.appraisal);
    factors.emotional = emotionalScore;

    log.debug({ score: emotionalScore }, "Emotional factor calculated");

    // ============================================
    // FACTOR 2: INFORMATIVE (New Personal Info)
    // ============================================
    const personalInfo = this.detectPersonalInformation(params.userMessage);
    if (personalInfo) {
      factors.informative = this.WEIGHTS.informative * personalInfo.confidence;
      detectedEntities.personalInfo = personalInfo;
      log.debug({ type: personalInfo.type, value: personalInfo.value }, "Personal info detected");
    }

    // ============================================
    // FACTOR 3: SIGNIFICANT EVENTS
    // ============================================
    const significantEvent = this.detectSignificantEvent(params.userMessage, params.appraisal);
    if (significantEvent) {
      factors.eventBased = this.WEIGHTS.eventBased * significantEvent.confidence;
      detectedEntities.significantEvent = significantEvent;
      log.debug({ type: significantEvent.type }, "Significant event detected");
    }

    // ============================================
    // FACTOR 4: TEMPORAL (Consolidation)
    // ============================================
    if (params.conversationHistory) {
      const temporalScore = this.calculateTemporalFactor(
        params.userMessage,
        params.conversationHistory
      );
      factors.temporal = temporalScore;
      log.debug({ score: temporalScore }, "Temporal factor calculated");
    }

    // ============================================
    // DETECTION OF IMPORTANT PEOPLE
    // ============================================
    const importantPerson = this.detectImportantPerson(params.userMessage);
    if (importantPerson) {
      detectedEntities.importantPerson = importantPerson;
      // Important people increase the informative factor
      factors.informative += 15 * importantPerson.confidence;
      log.debug({ name: importantPerson.name }, "Important person detected");
    }

    // ============================================
    // FINAL SCORING
    // ============================================
    const finalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
    const shouldStore = finalScore >= this.STORAGE_THRESHOLD;

    // Calculate normalized importance (0-1) for compatibility
    const importance = Math.min(1, finalScore / 100);

    log.info(
      {
        shouldStore,
        finalScore,
        factors,
        importance,
        threshold: this.STORAGE_THRESHOLD,
      },
      "Storage decision made"
    );

    return {
      shouldStore,
      finalScore,
      factors,
      detectedEntities,
      importance,
    };
  }

  /**
   * FACTOR 1: Calculates emotional score based on arousal
   *
   * High arousal indicates emotional intensity → more important memory
   */
  private calculateEmotionalFactor(emotions: EmotionState, appraisal: Appraisal): number {
    // Calculate average arousal from active emotions
    const emotionValues = Object.entries(emotions)
      .filter(([key]) => key !== 'lastUpdated')
      .map(([_, value]) => value as number);

    const averageIntensity = emotionValues.reduce((sum, val) => sum + val, 0) / emotionValues.length;

    // Also consider extreme desirability (very positive or very negative)
    const extremeDesirability = Math.abs(appraisal.desirability);

    // Arousal = emotional intensity + extremity
    const arousal = (averageIntensity + extremeDesirability) / 2;

    // If arousal > 0.6, give points (scaled)
    if (arousal > 0.6) {
      const scaleFactor = (arousal - 0.6) / 0.4; // 0.6-1.0 → 0-1
      return this.WEIGHTS.emotional * scaleFactor;
    }

    return 0;
  }

  /**
   * FACTOR 2: Detects new personal information
   *
   * Looks for patterns of personal information:
   * - Name: "my name is X", "I am X"
   * - Age: "I am X years old", "I am X years old"
   * - Location: "I live in X", "I am from X"
   * - Occupation: "I work at X", "I am X (profession)"
   * - Preferences: "I like X", "I hate X", "I prefer X"
   * - Relationships: "my X (partner/brother/mother)", "I have a X"
   * - Health: "I am sick", "I have X", "I was diagnosed with X"
   * - Goals: "I want X", "my goal is X", "I plan to X"
   */
  private detectPersonalInformation(message: string): PersonalInfoDetection | null {
    const lowerMessage = message.toLowerCase();

    // NAME
    const namePatterns = [
      /(?:me llamo|mi nombre es|soy|pueden llamarme)\s+([a-záéíóúñ]+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'name',
          value: match[1],
          confidence: 0.9,
        };
      }
    }

    // AGE
    const agePatterns = [
      /tengo\s+(\d+)\s+años/i,
      /soy\s+de\s+(\d+)\s+años/i,
      /tengo\s+(\d+)/i,
    ];
    for (const pattern of agePatterns) {
      const match = message.match(pattern);
      if (match) {
        const age = parseInt(match[1]);
        if (age >= 10 && age <= 120) {
          return {
            type: 'age',
            value: match[1],
            confidence: 0.85,
          };
        }
      }
    }

    // LOCATION
    if (lowerMessage.includes('vivo en') || lowerMessage.includes('soy de')) {
      const locationMatch = message.match(/(?:vivo en|soy de)\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i);
      if (locationMatch) {
        return {
          type: 'location',
          value: locationMatch[1].trim(),
          confidence: 0.8,
        };
      }
    }

    // OCCUPATION
    const occupationPatterns = [
      /trabajo (?:en|como|de)\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i,
      /soy\s+(doctor|ingeniero|profesor|estudiante|programador|desarrollador|diseñador|artista|músico|escritor|chef|abogado|enfermero)/i,
    ];
    for (const pattern of occupationPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'occupation',
          value: match[1].trim(),
          confidence: 0.85,
        };
      }
    }

    // PREFERENCES
    if (lowerMessage.includes('me gusta') || lowerMessage.includes('me encanta') ||
        lowerMessage.includes('odio') || lowerMessage.includes('prefiero')) {
      const prefMatch = message.match(/(?:me gusta|me encanta|odio|prefiero)\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i);
      if (prefMatch) {
        return {
          type: 'preference',
          value: prefMatch[1].trim(),
          confidence: 0.7,
        };
      }
    }

    // RELACIONES
    const relationshipPatterns = [
      /mi\s+(novio|novia|pareja|esposo|esposa|hermano|hermana|madre|padre|hijo|hija|amigo|amiga|mascota|perro|gato)/i,
      /tengo\s+(?:un|una)\s+(novio|novia|pareja|esposo|esposa|hermano|hermana|hijo|hija|mascota|perro|gato)/i,
    ];
    for (const pattern of relationshipPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'relationship',
          value: match[1],
          confidence: 0.85,
        };
      }
    }

    // SALUD
    const healthPatterns = [
      /(?:estoy|me siento)\s+(enfermo|enferma|mal|deprimido|deprimida|ansioso|ansiosa)/i,
      /tengo\s+(ansiedad|depresión|diabetes|cáncer|asma)/i,
      /me diagnosticaron\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i,
    ];
    for (const pattern of healthPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'health',
          value: match[1].trim(),
          confidence: 0.9,
        };
      }
    }

    // METAS
    const goalPatterns = [
      /(?:quiero|deseo|planeo|mi objetivo es)\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i,
    ];
    for (const pattern of goalPatterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          type: 'goal',
          value: match[1].trim(),
          confidence: 0.75,
        };
      }
    }

    return null;
  }

  /**
   * FACTOR 3: Detects significant events
   * 
   * Events that must be remembered:
   * - Birthdays (own or of someone important)
   * - Medical appointments
   * - Exams/interviews
   * - Job changes
   * - Relationship changes
   * - Important achievements
   * - Losses/grief
   */
  private detectSignificantEvent(message: string, appraisal: Appraisal): SignificantEventDetection | null {
    const lowerMessage = message.toLowerCase();

    // BIRTHDAYS
    if (lowerMessage.includes('cumpleaños') || lowerMessage.includes('mi cumple')) {
      const dateMatch = this.extractDate(message);
      return {
        type: 'birthday',
        description: message,
        confidence: 0.9,
        priority: 'high',
        date: dateMatch || undefined,
      };
    }

    // MEDICAL
    const medicalKeywords = ['doctor', 'médico', 'consulta', 'cita médica', 'hospital', 'operación', 'cirugía'];
    if (medicalKeywords.some(kw => lowerMessage.includes(kw))) {
      const dateMatch = this.extractDate(message);
      return {
        type: 'medical',
        description: message,
        confidence: 0.85,
        priority: 'high',
        date: dateMatch || undefined,
      };
    }

    // EXAMS/INTERVIEWS
    const examKeywords = ['examen', 'prueba', 'entrevista', 'presentación importante'];
    if (examKeywords.some(kw => lowerMessage.includes(kw))) {
      const dateMatch = this.extractDate(message);
      return {
        type: 'exam',
        description: message,
        confidence: 0.8,
        priority: 'medium',
        date: dateMatch || undefined,
      };
    }

    // CAMBIO DE TRABAJO
    const jobChangeKeywords = ['nuevo trabajo', 'cambié de trabajo', 'renuncié', 'me despidieron', 'nuevo empleo'];
    if (jobChangeKeywords.some(kw => lowerMessage.includes(kw))) {
      return {
        type: 'job_change',
        description: message,
        confidence: 0.9,
        priority: 'high',
      };
    }

    // CAMBIOS EN RELACIONES
    const relationshipKeywords = ['terminamos', 'cortamos', 'me casé', 'me casé', 'me divorcié', 'me separé', 'nuevo novio', 'nueva novia'];
    if (relationshipKeywords.some(kw => lowerMessage.includes(kw))) {
      return {
        type: 'relationship_change',
        description: message,
        confidence: 0.9,
        priority: 'critical',
      };
    }

    // LOGROS
    const achievementKeywords = ['logré', 'conseguí', 'gané', 'terminé', 'completé', 'me gradué'];
    if (achievementKeywords.some(kw => lowerMessage.includes(kw)) && appraisal.desirability > 0.5) {
      return {
        type: 'achievement',
        description: message,
        confidence: 0.75,
        priority: 'medium',
      };
    }

    // LOSSES
    const lossKeywords = ['murió', 'falleció', 'perdí', 'se fue'];
    if (lossKeywords.some(kw => lowerMessage.includes(kw)) && appraisal.desirability < -0.5) {
      return {
        type: 'loss',
        description: message,
        confidence: 0.85,
        priority: 'critical',
      };
    }

    // ANIVERSARIOS
    if (lowerMessage.includes('aniversario')) {
      const dateMatch = this.extractDate(message);
      return {
        type: 'anniversary',
        description: message,
        confidence: 0.8,
        priority: 'medium',
        date: dateMatch || undefined,
      };
    }

    return null;
  }

  /**
   * FACTOR 4: Calculates temporal factor (repetition/consolidation)
   * 
   * If the user has mentioned something 2+ times, it is probably important
   */
  private calculateTemporalFactor(
    currentMessage: string,
    conversationHistory: Array<{ userMessage: string; timestamp: Date }>
  ): number {
    // Search for similar messages in history (last 20)
    const recentHistory = conversationHistory.slice(-20);

    // Extraer palabras clave del mensaje actual
    const keywords = this.extractKeywords(currentMessage);

    if (keywords.length === 0) return 0;

    // Contar menciones de keywords en historial
    let mentionCount = 0;
    for (const past of recentHistory) {
      const pastKeywords = this.extractKeywords(past.userMessage);
      const overlap = keywords.filter(kw => pastKeywords.includes(kw)).length;
      if (overlap >= 2) {
        mentionCount++;
      }
    }

    // If mentioned 2+ times, assign points
    if (mentionCount >= 2) {
      return this.WEIGHTS.temporal;
    }

    return 0;
  }

  /**
   * Detecta personas importantes mencionadas
   */
  private detectImportantPerson(message: string): ImportantPersonDetection | null {
    const _lowerMessage = message.toLowerCase();

    // Search for person mention patterns
    const relationshipPattern = /(?:mi|el|la)\s+(novio|novia|pareja|esposo|esposa|hermano|hermana|madre|padre|hijo|hija|amigo|amiga|jefe|colega|mascota)\s+([a-záéíóúñ]+)?/gi;

    const matches = [...message.matchAll(relationshipPattern)];

    if (matches.length > 0) {
      const match = matches[0];
      const relationship = match[1];
      const name = match[2] || relationship; // If no name, use relationship

      return {
        name,
        relationship,
        mentionContext: message,
        confidence: match[2] ? 0.9 : 0.7, // Mayor confidence si hay nombre
      };
    }

    // Search for proper nouns after certain verbs
    const nameIntroPattern = /(?:te presento a|conocí a|vi a|hablé con)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/g;
    const nameMatches = [...message.matchAll(nameIntroPattern)];

    if (nameMatches.length > 0) {
      const name = nameMatches[0][1];
      return {
        name,
        mentionContext: message,
        confidence: 0.85,
      };
    }

    return null;
  }

  /**
   * Extrae keywords significativas de un mensaje
   */
  private extractKeywords(message: string): string[] {
    const lowerMessage = message.toLowerCase();

    // Remover stopwords comunes
    const stopwords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'que', 'es', 'son', 'fue', 'ser', 'estar', 'he', 'ha', 'hay', 'a', 'y', 'o', 'pero', 'si', 'no', 'me', 'te', 'se', 'mi', 'tu', 'su'];

    const words = lowerMessage
      .replace(/[.,;:!?¿¡()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.includes(w));

    return words;
  }

  /**
   * Intenta extraer una fecha del mensaje
   */
  private extractDate(message: string): Date | null {
    // Patrones de fecha comunes
    const datePatterns = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,    // DD-MM-YYYY
      /(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        try {
          if (match[3]) {
            // Formato DD/MM/YYYY o DD-MM-YYYY
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
          } else {
            // Formato "DD de mes"
            const monthMap: Record<string, number> = {
              enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
              julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
            };
            const month = monthMap[match[2].toLowerCase()];
            const day = parseInt(match[1]);
            const year = new Date().getFullYear();
            return new Date(year, month, day);
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Persiste entidades detectadas en los servicios correspondientes
   */
  async persistDetectedEntities(params: {
    agentId: string;
    userId: string;
    detectedEntities: StorageDecision['detectedEntities'];
  }): Promise<void> {
    const { agentId, userId, detectedEntities } = params;

    // Persistir evento significativo
    if (detectedEntities.significantEvent) {
      const event = detectedEntities.significantEvent;
      try {
        await ImportantEventsService.createEvent(agentId, userId, {
          eventDate: event.date || new Date(),
          type: this.mapEventTypeToSchema(event.type),
          description: event.description,
          priority: event.priority || 'medium',
          emotionalTone: 'neutral',
        });
        log.info({ type: event.type }, "Significant event persisted to ImportantEvents");
      } catch (error) {
        log.error({ error }, "Failed to persist significant event");
      }
    }

    // Persistir persona importante
    if (detectedEntities.importantPerson) {
      const person = detectedEntities.importantPerson;
      try {
        // Verificar si ya existe
        const existing = await ImportantPeopleService.findPersonByName(agentId, userId, person.name);

        if (existing) {
          // Incrementar contador de menciones
          await ImportantPeopleService.incrementMentionCount(existing.id, userId);
          log.info({ name: person.name }, "Important person mention count incremented");
        } else {
          // Create nuevo
          await ImportantPeopleService.addPerson(agentId, userId, {
            name: person.name,
            relationship: person.relationship || 'unknown',
            importance: 'medium',
          });
          log.info({ name: person.name }, "New important person persisted");
        }
      } catch (error) {
        log.error({ error }, "Failed to persist important person");
      }
    }
  }

  /**
   * Mapea tipos de evento a schema de DB
   */
  private mapEventTypeToSchema(
    type: SignificantEventDetection['type']
  ): 'birthday' | 'medical' | 'exam' | 'special' | 'anniversary' | 'other' {
    const mapping: Record<string, 'birthday' | 'medical' | 'exam' | 'special' | 'anniversary' | 'other'> = {
      birthday: 'birthday',
      medical: 'medical',
      exam: 'exam',
      anniversary: 'anniversary',
      job_change: 'special',
      relationship_change: 'special',
      achievement: 'special',
      loss: 'special',
    };

    return mapping[type] || 'other';
  }
}

/**
 * Singleton instance
 */
export const intelligentStorageSystem = new IntelligentStorageSystem();
