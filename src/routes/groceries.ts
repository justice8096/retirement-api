import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';

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
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const result = await prisma.userGroceryData.upsert({
      where: { userId: request.userId },
      update: parsed.data,
      create: { userId: request.userId, ...parsed.data },
    });

    return result;
  });
}
