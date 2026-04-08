/**
 * MESSAGE ENCRYPTION SERVICE
 * 
 * Encrypts and decrypts messages using AES-256-GCM
 * - Integrated authentication (GCM mode)
 * - Unique IV per message (prevents replay attacks)
 * - No external dependencies (uses native Node.js crypto)
 * 
 * IMPORTANT: The MESSAGE_ENCRYPTION_KEY must be:
 * - 32 bytes (64 hex characters) for AES-256
 * - Stored securely in .env
 * - Rotated every 6 months
 * - NEVER committed to Git
 */

import crypto from 'crypto';

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const _AUTH_TAG_LENGTH = 16; // 128 bits

/** Get encryption key from environment variables */
function getEncryptionKey(): Buffer {
  const key = process.env.MESSAGE_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      'MESSAGE_ENCRYPTION_KEY is not configured in .env. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (key.length !== 64) {
    throw new Error(
      `MESSAGE_ENCRYPTION_KEY must have 64 hex characters (32 bytes), has ${key.length}`
    );
  }

  return Buffer.from(key, 'hex');
}

/** Encryption result */
export interface EncryptionResult {
  encrypted: string;   // Encrypted content in hex
  iv: string;          // Initialization Vector in hex
  authTag: string;     // Authentication Tag in hex
}

/**
 * Encrypt message
 *
 * @param plaintext - Plain text to encrypt
 * @returns Object with encrypted content, IV and authTag
 *
 * @example
 * const { encrypted, iv, authTag } = encryptMessage('Hello world');
 * // Store the 3 values in the database
 */
export function encryptMessage(plaintext: string): EncryptionResult {
  try {
    // Generate unique random IV for this message
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (GCM mode)
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    console.error('[ENCRYPTION] Error encrypting message:', error);
    // Re-throw the original error if it comes from getEncryptionKey() to preserve the specific message
    if (error instanceof Error && (error.message.includes('MESSAGE_ENCRYPTION_KEY') || error.message.includes('debe tener'))) {
      throw error;
    }
    throw new Error('Error encrypting message');
  }
}

/**
 * Decrypt message
 *
 * @param encrypted - Encrypted content in hex
 * @param iv - Initialization Vector in hex
 * @param authTag - Authentication Tag in hex
 * @returns Decrypted plain text
 *
 * @example
 * const plaintext = decryptMessage(encrypted, iv, authTag);
 */
export function decryptMessage(
  encrypted: string,
  iv: string,
  authTag: string
): string {
  try {
    // Create decipher
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getEncryptionKey(),
      Buffer.from(iv, 'hex')
    );

    // Configure authentication tag
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[ENCRYPTION] Error decrypting message:', error);

    // If authentication fails, the message was modified
    if (error instanceof Error && error.message.includes('Unsupported state')) {
      throw new Error('Corrupt or modified message (authentication failed)');
    }

    throw new Error('Error decrypting message');
  }
}

/**
 * Check if a message is encrypted
 * (Has the fields iv and authTag)
 */
export function isMessageEncrypted(message: {
  content: string;
  iv?: string | null;
  authTag?: string | null;
}): boolean {
  return !!(message.iv && message.authTag);
}

/**
 * Encrypt message only if it is not already encrypted
 * Useful for gradual migration
 */
export function encryptMessageIfNeeded(
  content: string,
  iv?: string | null,
  authTag?: string | null
): EncryptionResult {
  // If it already has iv and authTag, it is already encrypted
  if (iv && authTag) {
    return {
      encrypted: content,
      iv,
      authTag,
    };
  }

  // Si no, encriptar
  return encryptMessage(content);
}

/**
 * Decrypt message only if it is encrypted
 * Useful for gradual migration (supports legacy unencrypted messages)
 */
export function decryptMessageIfNeeded(
  content: string,
  iv?: string | null,
  authTag?: string | null
): string {
  // If it has iv and authTag, it is encrypted -> decrypt
  if (iv && authTag) {
    return decryptMessage(content, iv, authTag);
  }

  // Si no, es texto plano (legacy)
  return content;
}

/**
 * Generate new encryption key
 * Only for key rotation
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Re-encrypt message with new key
 * Useful for key rotation
 */
export function reEncryptMessage(
  oldEncrypted: string,
  oldIv: string,
  oldAuthTag: string,
  newKey: string
): EncryptionResult {
  // Desencriptar con clave antigua
  const plaintext = decryptMessage(oldEncrypted, oldIv, oldAuthTag);

  // Temporalmente cambiar la clave
  const originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
  process.env.MESSAGE_ENCRYPTION_KEY = newKey;

  try {
    // Encriptar con clave nueva
    const result = encryptMessage(plaintext);
    return result;
  } finally {
    // Restaurar clave original
    process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
  }
}
