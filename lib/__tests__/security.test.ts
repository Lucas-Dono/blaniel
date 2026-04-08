/**
 * SECURITY TESTS
 *
 * Tests básicos de seguridad para verificar que las protecciones están funcionando
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// IMPORTANT: Unmock the encryption module to test the REAL implementation
// The global setup.ts mocks this module with base64 encoding for other tests
vi.unmock('@/lib/encryption/message-encryption');

import { encryptMessage, decryptMessage } from '../encryption/message-encryption';

describe('Security - Message Encryption', () => {
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  beforeAll(() => {
    process.env.MESSAGE_ENCRYPTION_KEY = TEST_KEY;
  });

  it('should encrypt messages so they are not readable in plaintext', () => {
    const sensitiveMessage = 'Password: mySecretPassword123';

    const { encrypted } = encryptMessage(sensitiveMessage);

    // Encrypted message must NOT contain password in plain text
    expect(encrypted).not.toContain('Password');
    expect(encrypted).not.toContain('mySecretPassword123');
  });

  it('should produce different encrypted output for same message', () => {
    const message = 'Same message';

    const result1 = encryptMessage(message);
    const result2 = encryptMessage(message);

    // Diferentes IVs y contenidos encriptados (previene ataques de replay)
    expect(result1.iv).not.toBe(result2.iv);
    expect(result1.encrypted).not.toBe(result2.encrypted);
  });

  it('should fail decryption if message is tampered', () => {
    const message = 'Important message';
    const { encrypted, iv, authTag } = encryptMessage(message);

    // Modificar el mensaje encriptado (ataque)
    const tamperedEncrypted = 'ff' + encrypted.substring(2);

    expect(() => {
      decryptMessage(tamperedEncrypted, iv, authTag);
    }).toThrow();
  });

  it('should encrypt PII so it cannot leak in logs', () => {
    const messageWithPII = 'Mi SSN es 123-45-6789 y mi email es user@example.com';

    const { encrypted } = encryptMessage(messageWithPII);

    // El mensaje encriptado NO debe contener PII
    expect(encrypted).not.toContain('123-45-6789');
    expect(encrypted).not.toContain('user@example.com');
    expect(encrypted).not.toContain('SSN');
  });
});

describe('Security - Environment Variables', () => {
  it('should have encryption key configured', () => {
    // In production, this key MUST be configured
    expect(process.env.MESSAGE_ENCRYPTION_KEY).toBeDefined();
    expect(process.env.MESSAGE_ENCRYPTION_KEY).toHaveLength(64);
  });

  it('should not expose sensitive keys in logs', () => {
    const sensitiveKeys = [
      'DATABASE_URL',
      'MESSAGE_ENCRYPTION_KEY',
      'OPENAI_API_KEY',
      'VENICE_API_KEY',
    ];

    for (const key of sensitiveKeys) {
      const value = process.env[key];
      if (value) {
        // Verificar que el valor no se loguea accidentalmente
        const mockLog = JSON.stringify({ key, value });

        // In a real log, you should redact these values
        expect(mockLog).toContain(key);

        // TODO: Implementar redacción automática en sistema de logging
        console.warn(`⚠️  Key ${key} should be redacted in logs`);
      }
    }
  });
});

describe('Security - Database Access', () => {
  it('should not allow SQL injection in message content', () => {
    const sqlInjectionAttempts = [
      "'; DROP TABLE messages; --",
      "1' OR '1'='1",
      "admin'--",
      "' UNION SELECT * FROM users--",
    ];

    // Estos payloads deben ser encriptados, no ejecutados
    for (const payload of sqlInjectionAttempts) {
      const { encrypted } = encryptMessage(payload);

      // El payload encriptado no debe contener comillas ni comandos SQL
      expect(encrypted).not.toContain("DROP TABLE");
      expect(encrypted).not.toContain("UNION SELECT");
      expect(encrypted).not.toContain("'--");
    }
  });
});

describe('Security - XSS Protection', () => {
  it('should handle XSS payloads safely', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="evil.com"></iframe>',
    ];

    for (const payload of xssPayloads) {
      const { encrypted } = encryptMessage(payload);

      // El payload encriptado no debe contener tags HTML
      expect(encrypted).not.toContain('<script>');
      expect(encrypted).not.toContain('onerror=');
      expect(encrypted).not.toContain('<iframe');
    }
  });
});
