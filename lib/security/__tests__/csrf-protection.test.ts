/**
 * Tests para CSRF Protection
 */

import { NextRequest } from 'next/server';
import { validateCSRFOrigin, checkCSRF } from '../csrf-protection';

describe('CSRF Protection', () => {
  const validOrigin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const invalidOrigin = 'https://evil.com';

  describe('validateCSRFOrigin', () => {
    it('debe permitir requests GET sin validar origin', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'GET',
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe bloquear PATCH sin origin header', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PATCH',
      });

      expect(validateCSRFOrigin(req)).toBe(false);
    });

    it('debe permitir PATCH con origin válido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PATCH',
        headers: {
          origin: validOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe bloquear PATCH con origin inválido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PATCH',
        headers: {
          origin: invalidOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(false);
    });

    it('debe permitir POST con origin válido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          origin: validOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe bloquear POST con origin inválido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          origin: invalidOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(false);
    });

    it('debe validar PUT con origin correcto', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PUT',
        headers: {
          origin: validOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe validar DELETE con origin correcto', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'DELETE',
        headers: {
          origin: validOrigin,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe usar referer como fallback cuando no hay origin', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          referer: `${validOrigin}/some/page`,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(true);
    });

    it('debe bloquear cuando referer es de origin inválido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          referer: `${invalidOrigin}/some/page`,
        },
      });

      expect(validateCSRFOrigin(req)).toBe(false);
    });
  });

  describe('checkCSRF', () => {
    it('debe retornar null para request válido', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PATCH',
        headers: {
          origin: validOrigin,
        },
      });

      expect(checkCSRF(req)).toBeNull();
    });

    it('debe retornar Response con error 403 para origin inválido', async () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        method: 'PATCH',
        headers: {
          origin: invalidOrigin,
        },
      });

      const result = checkCSRF(req);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);

      const body = await result?.json();
      expect(body).toEqual({
        error: 'Forbidden',
        message: 'Invalid origin - CSRF protection',
      });
    });
  });
});
