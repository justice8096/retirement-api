/**
 * Tests for the local-auth scrypt password lib.
 */
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../lib/passwords.js';

describe('passwords', () => {
  it('round-trips a password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('scrypt$32768$8$1$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('right');
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  it('salts: two hashes of the same password differ', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('rejects null / garbage / tampered stored values', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', undefined)).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$10$abc$def')).toBe(false);
    const stored = await hashPassword('x');
    const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(await verifyPassword('x', tampered)).toBe(false);
    // absurd cost parameter is refused rather than DoSing the server
    expect(await verifyPassword('x', 'scrypt$1073741824$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });
});
