import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test encryption module (no database needed)
describe('encryption module', () => {
  const originalKey = process.env.ENCRYPTION_MASTER_KEY;

  afterAll(() => {
    // Restore original key
    if (originalKey) {
      process.env.ENCRYPTION_MASTER_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_MASTER_KEY;
    }
  });

  describe('with valid key', () => {
    beforeAll(() => {
      // Set a test 32-byte key (64 hex chars)
      process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
    });

    it('encrypts and decrypts a string', async () => {
      // Dynamic import to pick up env var
      const { encrypt, decrypt } = await import('../middleware/encryption.js');
      const { ciphertext, iv, tag } = encrypt('hello world');
      expect(ciphertext).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(tag).toBeTruthy();
      expect(ciphertext).not.toBe('hello world');

      const plain = decrypt(ciphertext, iv, tag);
      expect(plain).toBe('hello world');
    });

    it('encrypts and decrypts a number', async () => {
      const { encrypt, decrypt } = await import('../middleware/encryption.js');
      const { ciphertext, iv, tag } = encrypt(500000);
      const plain = decrypt(ciphertext, iv, tag);
      expect(plain).toBe('500000');
    });

    it('encryptField returns JSON envelope', async () => {
      const { encryptField } = await import('../middleware/encryption.js');
      const result = encryptField(72000);
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!);
      expect(parsed.__enc).toBe(true);
      expect(parsed.c).toBeTruthy();
      expect(parsed.iv).toBeTruthy();
      expect(parsed.t).toBeTruthy();
    });

    it('decryptField reverses encryptField', async () => {
      const { encryptField, decryptField } = await import('../middleware/encryption.js');
      const encrypted = encryptField(42000);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(42000);
    });

    it('decryptField handles null', async () => {
      const { decryptField } = await import('../middleware/encryption.js');
      expect(decryptField(null)).toBe(null);
      expect(decryptField(undefined)).toBe(null);
    });

    it('decryptField passes through unencrypted values', async () => {
      const { decryptField } = await import('../middleware/encryption.js');
      expect(decryptField('500000')).toBe('500000');
      expect(decryptField(12345)).toBe(12345);
    });

    it('encryptField handles null', async () => {
      const { encryptField } = await import('../middleware/encryption.js');
      expect(encryptField(null)).toBe(null);
    });

    it('produces different ciphertext each time (random IV)', async () => {
      const { encrypt } = await import('../middleware/encryption.js');
      const a = encrypt('same input');
      const b = encrypt('same input');
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);
    });
  });

  describe('without key (passthrough mode)', () => {
    beforeAll(() => {
      delete process.env.ENCRYPTION_MASTER_KEY;
    });

    it('isEncryptionEnabled returns false', async () => {
      const mod = await import('../middleware/encryption.js');
      // Need fresh module — vitest caches, so check the function behavior
      expect(mod.isEncryptionEnabled()).toBe(false);
    });

    it('encryptField returns plaintext string', async () => {
      const { encryptField } = await import('../middleware/encryption.js');
      const result = encryptField(500000);
      expect(result).toBe('500000');
    });

    it('decryptField returns input unchanged', async () => {
      const { decryptField } = await import('../middleware/encryption.js');
      expect(decryptField('500000')).toBe('500000');
    });
  });
});
