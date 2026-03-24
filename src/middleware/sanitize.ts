/**
 * Input sanitization utilities for preventing prototype pollution
 * and ensuring safe JSON storage in JSONB fields.
 *
 * OWASP A03: Injection — blocks dangerous keys like __proto__, constructor, prototype.
 */
import { z } from 'zod';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips dangerous keys from an object.
 * Returns a clean copy safe for JSONB storage.
 */
function stripDangerousKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripDangerousKeys);
  if (typeof obj !== 'object') return obj;

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue; // silently strip
    clean[key] = stripDangerousKeys(value);
  }
  return clean;
}

/**
 * Zod schema for safe JSON record storage.
 * Accepts any object but strips prototype-polluting keys.
 * Use in place of z.record(z.unknown()) for JSONB fields.
 */
export const safeJsonRecord = z.record(z.unknown()).transform((val) => {
  return stripDangerousKeys(val) as Record<string, unknown>;
});
