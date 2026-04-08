/**
 * TESTS DE ENCRIPTACIÓN DE MENSAJES
 *
 * Verifica que:
 * - La encriptación funciona correctamente
 * - La desencriptación recupera el texto original
 * - Los IVs son únicos (no se repiten)
 * - La autenticación detecta mensajes modificados
 * - Soporta caracteres especiales y emojis
 */

import { vi, beforeAll, afterAll } from 'vitest';

// IMPORTANT: Unmock the encryption module to test the REAL implementation
// The global setup.ts mocks this module with base64 encoding for other tests
vi.unmock('@/lib/encryption/message-encryption');

import {
  encryptMessage,
  decryptMessage,
  isMessageEncrypted,
  encryptMessageIfNeeded,
  decryptMessageIfNeeded,
  generateEncryptionKey,
} from '../message-encryption';

// Mock de la clave de encriptación para tests
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Message Encryption', () => {
  beforeAll(() => {
    process.env.MESSAGE_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  describe('encryptMessage / decryptMessage', () => {
    it('should encrypt and decrypt a simple message', () => {
      const plaintext = 'Hola mundo';

      const { encrypted, iv, authTag } = encryptMessage(plaintext);

      expect(encrypted).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(authTag).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decryptMessage(encrypted, iv, authTag);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt messages with special characters', () => {
      const messages = [
        'Mensaje con ñ y acentós',
        'Message with "quotes" and \'apostrophes\'',
        'Emojis: 😀🎉🔒💬',
        'Line\nbreaks\nand\ttabs',
        'Unicode: 你好世界 مرحبا العالم',
      ];

      for (const plaintext of messages) {
        const { encrypted, iv, authTag } = encryptMessage(plaintext);
        const decrypted = decryptMessage(encrypted, iv, authTag);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should generate unique IVs for each encryption', () => {
      const plaintext = 'Same message';

      const result1 = encryptMessage(plaintext);
      const result2 = encryptMessage(plaintext);

      // Los IVs deben ser diferentes
      expect(result1.iv).not.toBe(result2.iv);
      // Los contenidos encriptados también deben ser diferentes
      expect(result1.encrypted).not.toBe(result2.encrypted);

      // Pero ambos deben desencriptar al mismo texto
      const decrypted1 = decryptMessage(result1.encrypted, result1.iv, result1.authTag);
      const decrypted2 = decryptMessage(result2.encrypted, result2.iv, result2.authTag);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should throw error if authTag is incorrect', () => {
      const plaintext = 'Mensaje secreto';

      const { encrypted, iv, authTag } = encryptMessage(plaintext);

      // Modificar el authTag significativamente (cambiar los primeros 2 caracteres)
      // Nota: Modificar solo el último carácter puede no detectarse en algunos casos de GCM
      const invalidAuthTag = 'ff' + authTag.substring(2);

      expect(() => {
        decryptMessage(encrypted, iv, invalidAuthTag);
      }).toThrow();
    });

    it('should throw error if encrypted content is modified', () => {
      const plaintext = 'Mensaje secreto';

      const { encrypted, iv, authTag } = encryptMessage(plaintext);

      // Modificar el contenido encriptado
      const tamperedEncrypted = 'ff' + encrypted.substring(2);

      expect(() => {
        decryptMessage(tamperedEncrypted, iv, authTag);
      }).toThrow();
    });

    it('should handle empty strings', () => {
      const plaintext = '';

      const { encrypted, iv, authTag } = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted, iv, authTag);

      expect(decrypted).toBe('');
    });

    it('should handle very long messages', () => {
      // Mensaje de 10KB
      const plaintext = 'a'.repeat(10000);

      const { encrypted, iv, authTag } = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted, iv, authTag);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isMessageEncrypted', () => {
    it('should detect encrypted messages', () => {
      const encrypted = {
        content: 'abc123',
        iv: 'def456',
        authTag: 'ghi789',
      };

      expect(isMessageEncrypted(encrypted)).toBe(true);
    });

    it('should detect non-encrypted messages', () => {
      const notEncrypted = {
        content: 'Texto plano',
        iv: null,
        authTag: null,
      };

      expect(isMessageEncrypted(notEncrypted)).toBe(false);
    });

    it('should return false if only iv is present', () => {
      const partial = {
        content: 'abc123',
        iv: 'def456',
        authTag: null,
      };

      expect(isMessageEncrypted(partial)).toBe(false);
    });
  });

  describe('encryptMessageIfNeeded', () => {
    it('should encrypt if not already encrypted', () => {
      const plaintext = 'Nuevo mensaje';

      const result = encryptMessageIfNeeded(plaintext);

      expect(result.encrypted).toBeTruthy();
      expect(result.iv).toBeTruthy();
      expect(result.authTag).toBeTruthy();
    });

    it('should not re-encrypt if already encrypted', () => {
      const encrypted = 'abc123';
      const iv = 'def456';
      const authTag = 'ghi789';

      const result = encryptMessageIfNeeded(encrypted, iv, authTag);

      // Debe devolver los mismos valores sin cambios
      expect(result.encrypted).toBe(encrypted);
      expect(result.iv).toBe(iv);
      expect(result.authTag).toBe(authTag);
    });
  });

  describe('decryptMessageIfNeeded', () => {
    it('should decrypt if encrypted', () => {
      const plaintext = 'Mensaje encriptado';

      const { encrypted, iv, authTag } = encryptMessage(plaintext);
      const decrypted = decryptMessageIfNeeded(encrypted, iv, authTag);

      expect(decrypted).toBe(plaintext);
    });

    it('should return as-is if not encrypted (legacy)', () => {
      const legacyPlaintext = 'Mensaje antiguo sin encriptar';

      const result = decryptMessageIfNeeded(legacyPlaintext, null, null);

      expect(result).toBe(legacyPlaintext);
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex key', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('Error handling', () => {
    it('should throw if encryption key is not set', () => {
      const originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
      delete process.env.MESSAGE_ENCRYPTION_KEY;

      expect(() => {
        encryptMessage('test');
      }).toThrow('MESSAGE_ENCRYPTION_KEY no está configurada');

      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    });

    it('should throw if encryption key has wrong length', () => {
      const originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
      process.env.MESSAGE_ENCRYPTION_KEY = 'tooshort';

      expect(() => {
        encryptMessage('test');
      }).toThrow('debe tener 64 caracteres');

      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Performance', () => {
    it('should encrypt 100 messages in < 1 second', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        encryptMessage(`Mensaje ${i}`);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it('should decrypt 100 messages in < 1 second', () => {
      // Preparar mensajes encriptados
      const encrypted = [];
      for (let i = 0; i < 100; i++) {
        encrypted.push(encryptMessage(`Mensaje ${i}`));
      }

      const start = Date.now();

      for (const msg of encrypted) {
        decryptMessage(msg.encrypted, msg.iv, msg.authTag);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
