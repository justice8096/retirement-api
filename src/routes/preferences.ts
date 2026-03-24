import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';

// Preferences is a single JSONB blob — we validate it's an object but strip dangerous keys
const preferencesSchema = safeJsonRecord;

export default async function preferencesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/preferences — fetch the full JSONB preferences blob
  app.get('/', async (request, reply) => {
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return (prefs?.preferences as object) ?? {};
  });

  // PATCH /api/me/preferences — shallow merge update
  app.patch('/', async (request, _reply) => {
    const parsed = preferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      return { error: 'Validation failed', details: parsed.error.issues };
    }

    const existing = await prisma.userPreferences.findUnique({
      where: { userId: request.userId },
    });

    const merged = { ...((existing?.preferences as object) ?? {}), ...parsed.data };

    const result = await prisma.userPreferences.upsert({
      where: { userId: request.userId },
      update: { preferences: merged },
      create: { userId: request.userId, preferences: merged },
    });

    return result.preferences;
  });
}
