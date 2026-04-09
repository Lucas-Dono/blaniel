/**
 * Tests para validación de CORS
 * Verifica que solo se permitan orígenes exactos, no wildcards
 */

import { describe, it, expect } from 'vitest';

// Simular función isOriginAllowed del middleware
function isOriginAllowed(origin: string | null, isDevelopment: boolean = false): boolean {
  if (!origin) return false;

  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://example.com',
  ];

  // SECURITY: Validación exacta de orígenes
  if (isDevelopment) {
    // Regex estricta: debe ser exactamente localhost o 127.0.0.1 con puerto opcional
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      return true;
    }
  }

  // Production: exact validation against whitelist
  return ALLOWED_ORIGINS.includes(origin);
}

describe('CORS Validation Security', () => {
  describe('Development Mode', () => {
    it('should allow exact localhost with any port', () => {
      expect(isOriginAllowed('http://localhost:3000', true)).toBe(true);
      expect(isOriginAllowed('http://localhost:3001', true)).toBe(true);
      expect(isOriginAllowed('http://localhost:8080', true)).toBe(true);
      expect(isOriginAllowed('https://localhost:3000', true)).toBe(true);
    });

    it('should allow exact 127.0.0.1 with any port', () => {
      expect(isOriginAllowed('http://127.0.0.1:3000', true)).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:8080', true)).toBe(true);
      expect(isOriginAllowed('https://127.0.0.1:3000', true)).toBe(true);
    });

    it('should BLOCK domains that contain localhost but are not localhost', () => {
      expect(isOriginAllowed('http://evil-localhost.com', true)).toBe(false);
      expect(isOriginAllowed('http://localhost.evil.com', true)).toBe(false);
      expect(isOriginAllowed('http://notlocalhost.com', true)).toBe(false);
      expect(isOriginAllowed('http://mylocalhost.com', true)).toBe(false);
    });

    it('should BLOCK malicious subdomains', () => {
      expect(isOriginAllowed('http://subdomain.localhost', true)).toBe(false);
      expect(isOriginAllowed('http://evil.127.0.0.1', true)).toBe(false);
    });

    it('should BLOCK localhost without protocol', () => {
      expect(isOriginAllowed('localhost:3000', true)).toBe(false);
      expect(isOriginAllowed('127.0.0.1:3000', true)).toBe(false);
    });
  });

  describe('Production Mode', () => {
    it('should allow only exact whitelisted origins', () => {
      expect(isOriginAllowed('https://example.com', false)).toBe(true);
    });

    it('should allow whitelisted localhost origins (for server-side requests)', () => {
      // localhost:3000 y 3001 están en whitelist para requests del servidor
      expect(isOriginAllowed('http://localhost:3000', false)).toBe(true);
      expect(isOriginAllowed('http://localhost:3001', false)).toBe(true);
    });

    it('should BLOCK non-whitelisted localhost ports', () => {
      expect(isOriginAllowed('http://localhost:8080', false)).toBe(false);
      expect(isOriginAllowed('http://127.0.0.1:3000', false)).toBe(false);
      expect(isOriginAllowed('http://127.0.0.1:8080', false)).toBe(false);
    });

    it('should BLOCK subdomains even if base domain is whitelisted', () => {
      expect(isOriginAllowed('https://evil.example.com', false)).toBe(false);
      expect(isOriginAllowed('https://subdomain.example.com', false)).toBe(false);
    });

    it('should BLOCK similar domains', () => {
      expect(isOriginAllowed('https://example.com.evil.com', false)).toBe(false);
      expect(isOriginAllowed('https://fake-example.com', false)).toBe(false);
    });

    it('should be case-sensitive (block case variations)', () => {
      // CORS debe ser case-sensitive en el dominio (según RFC)
      expect(isOriginAllowed('https://EXAMPLE.COM', false)).toBe(false);
      expect(isOriginAllowed('https://Example.Com', false)).toBe(false);
    });

    it('should BLOCK external domains', () => {
      expect(isOriginAllowed('https://evil.com', false)).toBe(false);
      expect(isOriginAllowed('https://google.com', false)).toBe(false);
      expect(isOriginAllowed('https://attacker.com', false)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should block null and undefined', () => {
      expect(isOriginAllowed(null, true)).toBe(false);
      expect(isOriginAllowed(null, false)).toBe(false);
    });

    it('should block empty string', () => {
      expect(isOriginAllowed('', true)).toBe(false);
      expect(isOriginAllowed('', false)).toBe(false);
    });

    it('should block origins with path', () => {
      // El origin no debe incluir path
      expect(isOriginAllowed('http://localhost:3000/evil-path', true)).toBe(false);
      expect(isOriginAllowed('https://example.com/admin', false)).toBe(false);
    });

    it('should block origins with query string', () => {
      expect(isOriginAllowed('http://localhost:3000?evil=param', true)).toBe(false);
    });

    it('should block origins with fragment', () => {
      expect(isOriginAllowed('http://localhost:3000#fragment', true)).toBe(false);
    });
  });

  describe('Protocol Variations', () => {
    it('should respect protocol differences', () => {
      // HTTP and HTTPS are different origins
      expect(isOriginAllowed('http://localhost:3000', true)).toBe(true);
      expect(isOriginAllowed('https://localhost:3000', true)).toBe(true);

      // In production, it must be exact
      expect(isOriginAllowed('http://example.com', false)).toBe(false);
      expect(isOriginAllowed('https://example.com', false)).toBe(true);
    });

    it('should block other protocols', () => {
      expect(isOriginAllowed('ftp://localhost:3000', true)).toBe(false);
      expect(isOriginAllowed('ws://localhost:3000', true)).toBe(false);
      expect(isOriginAllowed('wss://localhost:3000', true)).toBe(false);
    });
  });
});
