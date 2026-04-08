import { describe, it, expect } from 'vitest';
import { generateGradient, getInitials } from './utils';

describe('Utils', () => {
  describe('generateGradient', () => {
    it('should generate consistent gradients for the same name', () => {
      const gradient1 = generateGradient('Luna');
      const gradient2 = generateGradient('Luna');
      expect(gradient1).toBe(gradient2);
    });

    it('should generate different gradients for different names', () => {
      const gradient1 = generateGradient('Luna');
      const gradient2 = generateGradient('Nexus');
      expect(gradient1).not.toBe(gradient2);
    });

    it('should return a valid CSS gradient', () => {
      const gradient = generateGradient('Test');
      expect(gradient).toMatch(/^linear-gradient\(.+\)$/);
    });
  });

  describe('getInitials', () => {
    it('should extract initials from single word', () => {
      expect(getInitials('Luna')).toBe('LU');
    });

    it('should extract initials from multiple words', () => {
      expect(getInitials('Asistente Virtual')).toBe('AV');
    });

    it('should limit to 2 initials', () => {
      expect(getInitials('Asistente Virtual Pro')).toBe('AV');
    });

    it('should handle lowercase', () => {
      expect(getInitials('luna virtual')).toBe('LV');
    });
  });
});
