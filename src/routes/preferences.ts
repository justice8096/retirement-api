import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import type { InputJsonValue } from '@prisma/client/runtime/client';

/**
 * User preferences (JSONB blob with a reserved `accessibility` sub-schema).
 *
 * Addresses:
 *   - Dyslexia audit F-009 (reserved accessibility shape for cross-device sync)
 *   - Dyscalculia audit F-011 (dyscalculia accommodation persistence)
 *
 * The JSONB stays flexible so future sub-sections can be added without a
 * migration. Known sub-schemas are validated per-shape when present. Unknown
 * top-level keys are preserved untouched. Patch body is capped at 16 KB
 * (SAST L-05) and passes through `safeJsonRecord` (SAST L-02 depth/key caps).
 *
 * Surfaces:
 *   - GET `/me/preferences` — full blob.
 *   - PATCH `/me/preferences` — shallow merge with validation of known shapes.
 */

/** Dyslexia accommodation shape — mirrors `DyslexiaSettings` in the dashboard. */
const dyslexiaPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  fontFamily: z.enum(['default', 'atkinson', 'open-dyslexic', 'lexie']).optional(),
  lineHeight: z.enum(['normal', 'relaxed', 'loose']).optional(),
  letterSpacing: z.enum(['normal', 'wide']).optional(),
  wordSpacing: z.enum(['normal', 'wide']).optional(),
  contrastMode: z.enum(['dark', 'softer-dark', 'cream', 'light']).optional(),
  readingAid: z.enum(['none', 'bionic', 'ruler']).optional(),
  readAloudEnabled: z.boolean().optional(),
  readAloudRate: z.enum(['slow', 'normal', 'fast']).optional(),
  showReadingProgress: z.boolean().optional(),
  showShortcutHints: z.boolean().optional(),
}).strict();

/** Dyscalculia accommodation shape — mirrors `DyscalculiaSettings`. */
const dyscalculiaPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  numberFormat: z.enum(['standard', 'spaced', 'words']).optional(),
  roundNumbers: z.boolean().optional(),
  showTextSummaries: z.boolean().optional(),
  percentageDisplay: z.enum(['standard', 'natural', 'proportion', 'none']).optional(),
  chartStyle: z.enum(['bar', 'bar-labeled']).optional(),
  magnitudeAnchors: z.boolean().optional(),
  numberSpacing: z.enum(['normal', 'wide', 'grouped']).optional(),
  progressStyle: z.enum(['bar', 'steps', 'checklist']).optional(),
  reduceAnimations: z.boolean().optional(),
}).strict();

const accessibilityPrefsSchema = z.object({
  locale: z.string().max(20).optional()
    .describe('BCP-47 locale tag, e.g. "en-US", "de-DE".'),
  dyslexia: dyslexiaPrefsSchema.optional(),
  dyscalculia: dyscalculiaPrefsSchema.optional(),
}).strict();

const preferencesPatchSchema = z.object({
  accessibility: accessibilityPrefsSchema.optional(),
  // All other top-level keys go through safeJsonRecord for safety without
  // losing flexibility (extends earlier contract).
}).passthrough();

export default async function preferencesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /**
   * GET /api/me/preferences
   * @summary Full JSONB preferences blob. May include `accessibility` sub-object.
   */
  app.get('/', async (request, reply) => {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return (prefs?.preferences as object) ?? {};
  });

  /**
   * PATCH /api/me/preferences
   * @summary Shallow-merge update. Validates the `accessibility` sub-object
   *          when present (Dyslexia F-009, Dyscalculia F-011).
   */
  app.patch('/', async (request, reply) => {
    // SAST L-05 — bound the patch body size before the sanitize/schema pass.
    // The global 1 MB `bodyLimit` is the outer backstop; this is the per-route
    // ceiling for a preferences blob (16 KB is generous for known shapes).
    const raw = JSON.stringify(request.body ?? {});
    if (raw.length > 16_384) {
      return reply.code(413).send({
        error: 'Preferences patch too large',
        maxBytes: 16_384,
      });
    }

    // First pass through the sanitize helper to strip prototype-pollution keys.
    const safe = safeJsonRecord.safeParse(request.body);
    if (!safe.success) {
      return reply.code(400).send(toValidationErrorPayload(safe.error));
    }

    // Second pass — validate known sub-schemas while passing unknown keys through.
    const shape = preferencesPatchSchema.safeParse(safe.data);
    if (!shape.success) {
      return reply.code(400).send(toValidationErrorPayload(shape.error));
    }

    const existing = await prisma.userPreferences.findUnique({
      where: { userId: request.userId },
    });

    const merged = { ...((existing?.preferences as object) ?? {}), ...shape.data };

    const result = await prisma.userPreferences.upsert({
      where: { userId: request.userId },
      update: { preferences: merged as InputJsonValue },
      create: { userId: request.userId, preferences: merged as InputJsonValue },
    });

    return result.preferences;
  });
}
