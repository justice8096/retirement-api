/**
 * User grocery customizations — per-user overrides + shopping lists.
 *
 * Stored as JSONB so the shape can evolve without migration. Sanitized via
 * `safeJsonRecord` (prototype-pollution + depth/key caps from SAST L-02).
 */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import type { InputJsonValue } from '@prisma/client/runtime/library.js';

const grocerySchema = z.object({
  overrides: safeJsonRecord.optional(),
  lists: safeJsonRecord.optional(),
}).strict();

export default async function groceryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/groceries — fetch overrides and custom lists
  app.get('/', async (request, reply) => {
    const data = await prisma.userGroceryData.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return data ?? { overrides: {}, lists: {} };
  });

  // PUT /api/me/groceries — update grocery customizations
  app.put('/', async (request, reply) => {
    const parsed = grocerySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    // Cast optional fields to InputJsonValue
    const data: Record<string, InputJsonValue> = {};
    if (parsed.data.overrides !== undefined) {
      data.overrides = parsed.data.overrides as InputJsonValue;
    }
    if (parsed.data.lists !== undefined) {
      data.lists = parsed.data.lists as InputJsonValue;
    }

    const result = await prisma.userGroceryData.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return result;
  });
}
