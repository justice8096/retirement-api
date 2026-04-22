/**
 * Input sanitization utilities for preventing prototype pollution
 * and ensuring safe JSON storage in JSONB fields.
 *
 * OWASP A03: Injection — blocks dangerous keys like __proto__, constructor, prototype.
 * SAST L-02 (2026-04-19) — depth + key-count caps to bound resource use.
 */
import { z } from 'zod';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Max nesting depth a JSONB input may have. Beyond this, recursion throws. */
const MAX_DEPTH = 32;
/** Max total keys across the whole input tree. */
const MAX_KEYS = 10_000;

export class SanitizeLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SanitizeLimitError';
  }
}

/**
 * Recursively strips dangerous keys from an object.
 * Returns a clean copy safe for JSONB storage.
 * Throws `SanitizeLimitError` if the input exceeds `MAX_DEPTH` or `MAX_KEYS`.
 */
function stripDangerousKeys(obj: unknown, depth = 0, counter = { n: 0 }): unknown {
  if (obj === null || obj === undefined) return obj;
  if (depth > MAX_DEPTH) throw new SanitizeLimitError(`Input exceeds max depth (${MAX_DEPTH})`);
  if (Array.isArray(obj)) return obj.map(v => stripDangerousKeys(v, depth + 1, counter));
  if (typeof obj !== 'object') return obj;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue; // silently strip
    counter.n++;
    if (counter.n > MAX_KEYS) {
      throw new SanitizeLimitError(`Input exceeds max key count (${MAX_KEYS})`);
    }
    clean[key] = stripDangerousKeys(value, depth + 1, counter);
  }
  return clean;
}

/**
 * Zod schema for safe JSON record storage.
 * Accepts any object but strips prototype-polluting keys.
 * Use in place of z.record(z.string(), z.unknown()) for JSONB fields.
 *
 * zod 4 requires an explicit key schema for z.record; v3's single-arg
 * form (z.record(valueSchema)) is removed.
 */
export const safeJsonRecord = z.record(z.string(), z.unknown()).transform((val) => {
  return stripDangerousKeys(val) as Record<string, unknown>;
});
