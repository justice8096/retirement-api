/**
 * Password hashing for local auth — Node built-in scrypt (no new crypto
 * deps), PHC-style encoding `scrypt$N$r$p$saltB64$hashB64`, timing-safe
 * comparison. Parameters follow OWASP scrypt guidance (N=2^15, r=8, p=1).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Hand-rolled promisification: util.promisify drops the 4-arg (options)
// overload from scrypt's type, and we need N/r/p control.
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 256 * SCRYPT_N * SCRYPT_R,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Cost-parameter sanity cap: a forged hash string must not be able to
  // make the server run an absurdly expensive scrypt (memory DoS).
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0) || n > 1 << 20 || r > 32 || p > 16) return false;
  const saltB64 = parts[4];
  const hashB64 = parts[5];
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (expected.length === 0) return false;
  try {
    const actual = await scrypt(password, salt, expected.length, {
      N: n, r, p, maxmem: 256 * n * r,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
