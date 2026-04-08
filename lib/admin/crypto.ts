/**
 * Encryption Utilities for Admin System
 * Encrypts TOTP secrets and other sensitive data
 */

import crypto from 'crypto';

// Encryption algorithm (AES-256-GCM - more secure than AES-256-CBC)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, the IV is 16 bytes
const _AUTH_TAG_LENGTH = 16; // GCM authentication tag
const SALT_LENGTH = 64; // Salt for key derivation

/**
 * Retrieves the master key from environment variables
 * IMPORTANT: This key must be in .env and NEVER in the code
 */
function getMasterKey(): string {
  const key = process.env.ADMIN_MASTER_KEY;

  if (!key) {
    throw new Error(
      'ADMIN_MASTER_KEY is not configured. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  if (key.length < 64) {
    throw new Error(
      'ADMIN_MASTER_KEY must be at least 64 characters (32 bytes hex). ' +
      'Generate a new one with: openssl rand -hex 32'
    );
  }

  return key;
}

/**
 * Derives an encryption key from the master key using PBKDF2
 * This adds an extra layer of security
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    100000, // 100,000 iterations (recommended by OWASP)
    32, // 32 bytes = 256 bits
    'sha512'
  );
}

/**
 * Encrypts a string using AES-256-GCM
 *
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:authTag:encrypted (all in base64)
 */
export function encrypt(text: string): string {
  try {
    const masterKey = getMasterKey();

    // 1. Generate random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // 2. Derive encryption key
    const key = deriveKey(masterKey, salt);

    // 3. Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // 4. Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // 5. Encrypt
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // 6. Get authentication tag (GCM mode)
    const authTag = cipher.getAuthTag();

    // 7. Return everything together separated by ':'
    // Format: salt:iv:authTag:encrypted
    return [
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted
    ].join(':');

  } catch (error) {
    console.error('Error encrypting:', error);
    throw new Error('Error encrypting sensitive data');
  }
}

/**
 * Decrypts a string encrypted with encrypt()
 *
 * @param encryptedText - Encrypted string in format: salt:iv:authTag:encrypted
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    const masterKey = getMasterKey();

    // 1. Separate components
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltB64, ivB64, authTagB64, encrypted] = parts;

    // 2. Convert from base64 to Buffer
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    // 3. Derive the same encryption key
    const key = deriveKey(masterKey, salt);

    // 4. Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // 5. Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    console.error('Error decrypting:', error);
    throw new Error('Error decrypting sensitive data');
  }
}

/**
 * Generates a secure hash of a string using SHA-256
 * Useful for certificate fingerprints
 */
export function hash(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
}

/**
 * Generates cryptographically secure random bytes
 * Useful for generating tokens, serials, etc.
 */
export function randomBytes(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Compares two strings safely against timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Generates a new master key
 * Run: node -e "console.log(require('./lib/admin/crypto').generateMasterKey())"
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
