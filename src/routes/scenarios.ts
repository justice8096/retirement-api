import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import type { InputJsonValue } from '@prisma/client/runtime/library.js';

const scenarioSchema = z.object({
  name: z.string().min(1).max(200),
  scenarioData: safeJsonRecord, // Flexible JSON for Monte Carlo params, events, etc.
}).strict();

const MAX_SCENARIOS = 50;

export default async function scenarioRoutes(app: FastifyInstance): Promise<void> {
  // Read access for all tiers; write access requires basic+
  app.addHook('preHandler', requireAuth);

  // GET /api/me/scenarios — list all saved scenarios
  app.get('/', async (request, reply) => {
    const scenarios = await prisma.userScenario.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: 'desc' },
    });

    reply.header('Cache-Control', 'private, no-store');
    return scenarios;
  });

  // POST /api/me/scenarios — create new scenario (basic+ tier)
  app.post('/', { preHandler: requireTier('basic') }, async (request, reply) => {
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Enforce per-user limit
    const count = await prisma.userScenario.count({ where: { userId: request.userId } });
    if (count >= MAX_SCENARIOS) {
      return reply.code(409).send({ error: `Maximum ${MAX_SCENARIOS} scenarios reached` });
    }

    const scenario = await prisma.userScenario.create({
      data: {
        userId: request.userId,
        name: parsed.data.name,
        scenarioData: parsed.data.scenarioData as InputJsonValue,
      },
    });

    return reply.code(201).send(scenario);
  });

  // PUT /api/me/scenarios/:id — update existing scenario (basic+ tier)
  app.put('/:id', { preHandler: requireTier('basic') }, async (request, reply) => {
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    const { id } = request.params as { id: string };

    // Verify ownership
    const existing = await prisma.userScenario.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Scenario not found' });

    const scenario = await prisma.userScenario.update({
      where: { id },
      data: {
        name: parsed.data.name,
        scenarioData: parsed.data.scenarioData as InputJsonValue,
      },
    });

    return scenario;
  });

  // DELETE /api/me/scenarios/:id — delete scenario
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verify ownership
    const existing = await prisma.userScenario.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Scenario not found' });

    await prisma.userScenario.delete({ where: { id } });
    return { message: 'Scenario deleted' };
  });
}
