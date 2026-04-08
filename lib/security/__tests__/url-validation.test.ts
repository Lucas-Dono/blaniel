/**
 * Tests para validación de URLs (Open Redirect Prevention)
 */

import { describe, it, expect } from 'vitest';
import { isValidRedirectUrl, sanitizeRedirectUrl, getSecureCallbackUrl } from '../url-validation';

describe('URL Validation Security', () => {
  const allowedOrigin = 'http://localhost:3000';

  describe('isValidRedirectUrl', () => {
    describe('should allow safe URLs', () => {
      it('should allow relative paths starting with /', () => {
        expect(isValidRedirectUrl('/dashboard', allowedOrigin)).toBe(true);
        expect(isValidRedirectUrl('/profile/settings', allowedOrigin)).toBe(true);
        expect(isValidRedirectUrl('/api/users?id=123', allowedOrigin)).toBe(true);
      });

      it('should allow same-origin absolute URLs', () => {
        expect(isValidRedirectUrl('http://localhost:3000/dashboard', allowedOrigin)).toBe(true);
        expect(isValidRedirectUrl('http://localhost:3000/profile', allowedOrigin)).toBe(true);
      });
    });

    describe('should block dangerous URLs', () => {
      it('should block javascript: protocol', () => {
        expect(isValidRedirectUrl('javascript:alert(1)', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl('JavaScript:alert(1)', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl('JAVASCRIPT:alert(1)', allowedOrigin)).toBe(false);
      });

      it('should block data: protocol', () => {
        expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>', allowedOrigin)).toBe(false);
      });

      it('should block vbscript: protocol', () => {
        expect(isValidRedirectUrl('vbscript:alert(1)', allowedOrigin)).toBe(false);
      });

      it('should block file: protocol', () => {
        expect(isValidRedirectUrl('file:///etc/passwd', allowedOrigin)).toBe(false);
      });

      it('should block protocol-relative URLs to external domains', () => {
        expect(isValidRedirectUrl('//evil.com', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl('//evil.com/phishing', allowedOrigin)).toBe(false);
      });

      it('should block external domains', () => {
        expect(isValidRedirectUrl('https://evil.com', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl('http://evil.com/phishing', allowedOrigin)).toBe(false);
      });

      it('should block empty or invalid URLs', () => {
        expect(isValidRedirectUrl('', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl('   ', allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl(null as any, allowedOrigin)).toBe(false);
        expect(isValidRedirectUrl(undefined as any, allowedOrigin)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle URLs with query parameters', () => {
        expect(isValidRedirectUrl('/dashboard?foo=bar&baz=qux', allowedOrigin)).toBe(true);
      });

      it('should handle URLs with fragments', () => {
        expect(isValidRedirectUrl('/profile#settings', allowedOrigin)).toBe(true);
      });

      it('should handle URLs with both query and fragment', () => {
        expect(isValidRedirectUrl('/page?id=1#section', allowedOrigin)).toBe(true);
      });
    });
  });

  describe('sanitizeRedirectUrl', () => {
    it('should return the URL if valid', () => {
      expect(sanitizeRedirectUrl('/dashboard', '/home', allowedOrigin)).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/profile', '/home', allowedOrigin)).toBe('/profile');
    });

    it('should return default URL if invalid', () => {
      expect(sanitizeRedirectUrl('https://evil.com', '/home', allowedOrigin)).toBe('/home');
      expect(sanitizeRedirectUrl('//evil.com', '/home', allowedOrigin)).toBe('/home');
      expect(sanitizeRedirectUrl('javascript:alert(1)', '/home', allowedOrigin)).toBe('/home');
    });

    it('should return default URL if input is null/undefined', () => {
      expect(sanitizeRedirectUrl(null, '/home', allowedOrigin)).toBe('/home');
      expect(sanitizeRedirectUrl(undefined, '/home', allowedOrigin)).toBe('/home');
    });

    it('should use /dashboard as default if not specified', () => {
      expect(sanitizeRedirectUrl(null)).toBe('/dashboard');
      expect(sanitizeRedirectUrl('https://evil.com')).toBe('/dashboard');
    });
  });

  describe('getSecureCallbackUrl', () => {
    it('should extract and validate callbackUrl from URLSearchParams', () => {
      const params1 = new URLSearchParams('?callbackUrl=/profile');
      expect(getSecureCallbackUrl(params1)).toBe('/profile');

      const params2 = new URLSearchParams('?callbackUrl=https://evil.com');
      expect(getSecureCallbackUrl(params2)).toBe('/dashboard');
    });

    it('should handle string input', () => {
      expect(getSecureCallbackUrl('?callbackUrl=/settings')).toBe('/settings');
      expect(getSecureCallbackUrl('?callbackUrl=//evil.com')).toBe('/dashboard');
    });

    it('should return default if callbackUrl not present', () => {
      const params = new URLSearchParams('?foo=bar');
      expect(getSecureCallbackUrl(params)).toBe('/dashboard');
    });

    it('should return default if searchParams is null/undefined', () => {
      expect(getSecureCallbackUrl(null)).toBe('/dashboard');
      expect(getSecureCallbackUrl(undefined)).toBe('/dashboard');
    });

    it('should accept custom default URL', () => {
      const params = new URLSearchParams('?foo=bar');
      expect(getSecureCallbackUrl(params, '/home')).toBe('/home');
    });

    it('should block XSS attempts in callbackUrl', () => {
      const params = new URLSearchParams('?callbackUrl=javascript:alert(1)');
      expect(getSecureCallbackUrl(params)).toBe('/dashboard');
    });
  });
});
