/**
 * AES-256-GCM encryption for sensitive financial fields.
 *
 * Environment:
 *   ENCRYPTION_MASTER_KEY — 32-byte hex string (64 hex chars)
 *
 * Usage:
 *   import { encrypt, decrypt } from '../middleware/encryption.js';
 *   const { ciphertext, iv, tag } = encrypt('sensitive data');
 *   const plain = decrypt(ciphertext, iv, tag);
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce recommended for GCM

interface EncryptResult {
  ciphertext: string;
  iv: string;
  tag: string;
  passthrough?: boolean;
}

interface EncryptedEnvelope {
  __enc: true;
  c: string;
  iv: string;
  t: string;
}

let _keyWarned = false;

/**
 * Validate encryption configuration on startup.
 * In production, warn loudly if key is missing (financial data would be unencrypted).
 */
export function validateEncryptionConfig(): void {
  const key = getMasterKey();
  if (!key && process.env.NODE_ENV === 'production') {
    console.error('[encryption] ⚠ ENCRYPTION_MASTER_KEY not set in production — financial data will be stored UNENCRYPTED. Set a 32-byte hex key (64 chars).');
  }
}

function getMasterKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_MASTER_KEY;
  if (!hex || hex.length !== 64) {
    return null; // No key — encryption disabled
  }
  return Buffer.from(hex, 'hex');
}

/** Returns true if encryption is configured. */
export function isEncryptionEnabled(): boolean {
  return getMasterKey() !== null;
}

function warnOnce(): void {
  if (!_keyWarned && !isEncryptionEnabled()) {
    console.warn('[encryption] ENCRYPTION_MASTER_KEY not set — financial data stored unencrypted');
    _keyWarned = true;
  }
}

/**
 * Encrypt a plaintext value.
 */
export function encrypt(plaintext: string | number): EncryptResult {
  const key = getMasterKey();
  if (!key) { warnOnce(); return { ciphertext: String(plaintext), iv: '', tag: '', passthrough: true }; }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const text = String(plaintext);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt a ciphertext.
 */
export function decrypt(ciphertext: string, iv: string, tag: string): string {
  const key = getMasterKey();
  if (!key) { warnOnce(); return ciphertext; }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Encrypt a numeric value and return a JSON string for Prisma JSONB storage.
 * Stores as: { __enc: true, c: ciphertext, iv: iv, t: tag }
 */
export function encryptField(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const result = encrypt(value);
  if (result.passthrough) return String(value); // No key — store plaintext
  return JSON.stringify({ __enc: true, c: result.ciphertext, iv: result.iv, t: result.tag });
}

/**
 * Decrypt a field from JSONB storage.
 * Returns the original numeric value, or the raw value if not encrypted.
 */
export function decryptField(stored: unknown): string | number | null {
  if (stored == null) return null;

  let obj = stored as Record<string, unknown>;
  if (typeof stored === 'string') {
    try { obj = JSON.parse(stored) as Record<string, unknown>; } catch { return stored; }
  }

  if (obj && (obj as unknown as EncryptedEnvelope).__enc === true) {
    const envelope = obj as unknown as EncryptedEnvelope;
    const plain = decrypt(envelope.c, envelope.iv, envelope.t);
    const num = Number(plain);
    return isNaN(num) ? plain : num;
  }

  return stored as string | number;
}
