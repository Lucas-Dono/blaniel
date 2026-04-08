import { describe, it, expect } from 'vitest';
import { EmotionalEngine } from './engine';

describe('EmotionalEngine', () => {
  describe('analyzeMessage', () => {
    it('should increase trust and affinity for positive messages', () => {
      const initialState = {
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        love: 0,
        curiosity: 0,
      };

      const newState = EmotionalEngine.analyzeMessage(
        'Muchas gracias por tu ayuda, eres genial!',
        initialState
      );

      expect(newState.trust).toBeGreaterThan(initialState.trust);
      expect(newState.affinity).toBeGreaterThan(initialState.affinity);
    });

    it('should decrease trust and affinity for negative messages', () => {
      const initialState = {
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        trust: 0.5,
        affinity: 0.5,
        respect: 0.5,
        love: 0,
        curiosity: 0,
      };

      const newState = EmotionalEngine.analyzeMessage(
        'Esto es terrible y horrible',
        initialState
      );

      expect(newState.trust).toBeLessThan(initialState.trust);
      expect(newState.affinity).toBeLessThan(initialState.affinity);
    });

    it('should keep values between 0 and 1', () => {
      const initialState = {
        valence: 0.9,
        arousal: 0.9,
        dominance: 0.9,
        trust: 0.9,
        affinity: 0.9,
        respect: 0.9,
        love: 0.9,
        curiosity: 0.9,
      };

      const newState = EmotionalEngine.analyzeMessage(
        'This is amazing! I love it so much!',
        initialState
      );

      expect(newState.trust).toBeLessThanOrEqual(1);
      expect(newState.trust).toBeGreaterThanOrEqual(0);
      expect(newState.affinity).toBeLessThanOrEqual(1);
      expect(newState.affinity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getVisibleEmotions', () => {
    it('should return appropriate emotions for high metrics', () => {
      const state = {
        valence: 0.8,
        arousal: 0.6,
        dominance: 0.5,
        trust: 0.8,
        affinity: 0.8,
        respect: 0.7,
        love: 0.5,
        curiosity: 0.3,
      };

      const emotions = EmotionalEngine.getVisibleEmotions(state);
      expect(emotions).toContain('Confianza');
      expect(emotions).toContain('Afinidad');
      expect(emotions).toContain('Respeto');
    });

    it('should return appropriate emotions for low metrics', () => {
      const state = {
        valence: 0.2,
        arousal: 0.6,
        dominance: 0.5,
        trust: 0.2,
        affinity: 0.2,
        respect: 0.4,
        love: 0.1,
        curiosity: 0.2,
      };

      const emotions = EmotionalEngine.getVisibleEmotions(state);
      expect(emotions).toContain('Desconfianza');
      expect(emotions).toContain('Distancia');
    });
  });

  describe('getRelationshipLevel', () => {
    it('should return "Conexión profunda" for very high metrics', () => {
      const state = {
        valence: 0.8,
        arousal: 0.6,
        dominance: 0.5,
        trust: 0.85,
        affinity: 0.9,
        respect: 0.8,
        love: 0.7,
        curiosity: 0.6,
      };

      const level = EmotionalEngine.getRelationshipLevel(state);
      expect(level).toBe('Conexión profunda');
    });

    it('should return "Buena relación" for high metrics', () => {
      const state = {
        valence: 0.6,
        arousal: 0.5,
        dominance: 0.5,
        trust: 0.6,
        affinity: 0.7,
        respect: 0.6,
        love: 0.3,
        curiosity: 0.2,
      };

      const level = EmotionalEngine.getRelationshipLevel(state);
      expect(level).toBe('Buena relación');
    });

    it('should return "Relación neutral" for medium metrics', () => {
      const state = {
        valence: 0.5,
        arousal: 0.5,
        dominance: 0.5,
        trust: 0.4,
        affinity: 0.4,
        respect: 0.4,
        love: 0,
        curiosity: 0,
      };

      const level = EmotionalEngine.getRelationshipLevel(state);
      expect(level).toBe('Relación neutral');
    });

    it('should return "Relación tensa" for low metrics', () => {
      const state = {
        valence: 0.2,
        arousal: 0.6,
        dominance: 0.5,
        trust: 0.25,
        affinity: 0.2,
        respect: 0.25,
        love: 0,
        curiosity: 0,
      };

      const level = EmotionalEngine.getRelationshipLevel(state);
      expect(level).toBe('Relación tensa');
    });
  });
});
