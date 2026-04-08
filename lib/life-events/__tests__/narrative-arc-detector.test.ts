/**
 * Tests for Narrative Arc Detector
 */

import { describe, it, expect } from 'vitest';
import { NarrativeArcDetector } from '../narrative-arc-detector';

describe('NarrativeArcDetector', () => {
  describe('detectNarrativeState', () => {
    it('should detect seeking state', () => {
      const messages = [
        'Estoy buscando trabajo como desarrollador',
        'Quiero encontrar un nuevo empleo',
        'Necesito conseguir una entrevista',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectNarrativeState(message);
        expect(result.state).toBe('seeking');
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should detect progress state', () => {
      const messages = [
        'Tengo entrevista mañana en Google',
        'Me llamaron para una segunda ronda',
        'Estoy en proceso de selección',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectNarrativeState(message);
        expect(result.state).toBe('progress');
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should detect conclusion state (positive)', () => {
      const messages = [
        'Conseguí el trabajo!',
        'Me aceptaron en la universidad',
        'Somos pareja ahora',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectNarrativeState(message);
        expect(result.state).toBe('conclusion');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.emotionalTone).toBe('positive');
      });
    });

    it('should detect conclusion state (negative)', () => {
      const messages = [
        'Me rechazaron en la entrevista',
        'No pasé el examen',
        'Terminamos la relación',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectNarrativeState(message);
        expect(result.state).toBe('conclusion');
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.emotionalTone).toBe('negative');
      });
    });

    it('should return null for irrelevant messages', () => {
      const messages = [
        'Hola cómo estás?',
        'El clima está lindo hoy',
        'Comí pizza anoche',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectNarrativeState(message);
        expect(result.state).toBeNull();
      });
    });
  });

  describe('detectCategory', () => {
    it('should detect work/career category', () => {
      const messages = [
        'Busco trabajo como programador',
        'Tengo entrevista en una empresa',
        'Me ofrecieron un ascenso',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectCategory(message);
        expect(result.category).toBe('work_career');
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    it('should detect relationships/love category', () => {
      const messages = [
        'Me gusta alguien de la universidad',
        'Vamos a tener nuestra primera cita',
        'Somos novios ahora',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectCategory(message);
        expect(result.category).toBe('relationships_love');
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    it('should detect education/learning category', () => {
      const messages = [
        'Empecé a estudiar Python',
        'Tengo examen de matemáticas',
        'Me gradué de la universidad',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectCategory(message);
        expect(result.category).toBe('education_learning');
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    it('should detect health/fitness category', () => {
      const messages = [
        'Empecé a ir al gimnasio',
        'Tengo consulta médica mañana',
        'Bajé 5 kilos!',
      ];

      messages.forEach((message) => {
        const result = NarrativeArcDetector.detectCategory(message);
        expect(result.category).toBe('health_fitness');
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });
  });

  describe('analyzeMessage', () => {
    it('should create a complete arc event for valid messages', () => {
      const message = 'Estoy buscando trabajo como desarrollador frontend';
      const timestamp = new Date();

      const result = NarrativeArcDetector.analyzeMessage(message, timestamp);

      expect(result).not.toBeNull();
      expect(result?.state).toBe('seeking');
      expect(result?.category).toBe('work_career');
      expect(result?.confidence).toBeGreaterThan(0.45);
      expect(result?.keywords).toContain('busco');
      expect(result?.keywords).toContain('trabajo');
    });

    it('should return null for low confidence messages', () => {
      const message = 'Me gusta el café';
      const timestamp = new Date();

      const result = NarrativeArcDetector.analyzeMessage(message, timestamp);

      expect(result).toBeNull();
    });
  });

  describe('extractTheme', () => {
    it('should extract main theme from message', () => {
      const message = 'Busco trabajo como desarrollador en empresa tecnológica';
      const theme = NarrativeArcDetector.extractTheme(message);

      expect(theme).toContain('trabajo');
      expect(theme).toContain('desarrollador');
    });
  });

  describe('calculateThemeSimilarity', () => {
    it('should return high similarity for related themes', () => {
      const theme1 = 'trabajo desarrollador programador';
      const theme2 = 'trabajo programador empresa';

      const similarity = NarrativeArcDetector.calculateThemeSimilarity(
        theme1,
        theme2
      );

      expect(similarity).toBeGreaterThan(0.4);
    });

    it('should return low similarity for unrelated themes', () => {
      const theme1 = 'trabajo desarrollador programador';
      const theme2 = 'amor pareja relación';

      const similarity = NarrativeArcDetector.calculateThemeSimilarity(
        theme1,
        theme2
      );

      expect(similarity).toBeLessThan(0.2);
    });
  });

  describe('areEventsRelated', () => {
    it('should link events of same category and similar theme', () => {
      const event1 = {
        timestamp: new Date('2024-01-01'),
        message: 'Busco trabajo como desarrollador',
        state: 'seeking' as const,
        category: 'work_career' as const,
        confidence: 0.8,
        keywords: ['busco', 'trabajo'],
      };

      const event2 = {
        timestamp: new Date('2024-01-15'),
        message: 'Tengo entrevista para desarrollador',
        state: 'progress' as const,
        category: 'work_career' as const,
        confidence: 0.8,
        keywords: ['entrevista', 'desarrollador'],
      };

      const related = NarrativeArcDetector.areEventsRelated(event1, event2);

      expect(related).toBe(true);
    });

    it('should not link events of different categories', () => {
      const event1 = {
        timestamp: new Date('2024-01-01'),
        message: 'Busco trabajo',
        state: 'seeking' as const,
        category: 'work_career' as const,
        confidence: 0.8,
        keywords: ['busco', 'trabajo'],
      };

      const event2 = {
        timestamp: new Date('2024-01-15'),
        message: 'Empecé a estudiar',
        state: 'progress' as const,
        category: 'education_learning' as const,
        confidence: 0.8,
        keywords: ['estudiar'],
      };

      const related = NarrativeArcDetector.areEventsRelated(event1, event2);

      expect(related).toBe(false);
    });

    it('should not link events too far apart in time', () => {
      const event1 = {
        timestamp: new Date('2024-01-01'),
        message: 'Busco trabajo',
        state: 'seeking' as const,
        category: 'work_career' as const,
        confidence: 0.8,
        keywords: ['busco', 'trabajo'],
      };

      const event2 = {
        timestamp: new Date('2024-06-01'), // 5 meses después
        message: 'Tengo entrevista',
        state: 'progress' as const,
        category: 'work_career' as const,
        confidence: 0.8,
        keywords: ['entrevista'],
      };

      const related = NarrativeArcDetector.areEventsRelated(event1, event2);

      expect(related).toBe(false);
    });
  });
});
