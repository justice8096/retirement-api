import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth, requireTier } from '../middleware/auth.js';
import { safeJsonRecord } from '../middleware/sanitize.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import type { InputJsonValue } from '@prisma/client/runtime/library.js';

/**
 * Scenario persistence (named what-if simulations).
 *
 * Dyscalculia audit F-006: the `scenarioData` JSONB accepts any shape for
 * forward compatibility, but when clients set `kind: "monte_carlo_v1"` we
 * validate that the payload has the canonical percentile + success-rate
 * fields so every downstream UI can render consistent plain-language
 * summaries without guessing structure.
 */

const percentileShape = z.object({
  value: z.number()
    .describe('Raw amount in user currency (whole units, not cents).'),
  currency: z.string().max(10).optional()
    .describe('ISO 4217 currency code (default USD when omitted).'),
  anchor: z.string().max(200).optional()
    .describe('Plain-language magnitude anchor, e.g. "about 18 years of planned spending".'),
}).strict();

/** Canonical Monte Carlo v1 result envelope. */
const monteCarloV1Schema = z.object({
  kind: z.literal('monte_carlo_v1'),
  successRate: z.object({
    value: z.number().min(0).max(1)
      .describe('Success rate as a decimal fraction. 0.72 = 72%.'),
    naturalFrequency: z.string().max(40).optional()
      .describe('Plain-language phrase like "7 out of 10 simulated futures".'),
  }).strict(),
  percentiles: z.object({
    p5: percentileShape.optional(),
    p25: percentileShape.optional(),
    p50: percentileShape.optional(),
    p75: percentileShape.optional(),
    p95: percentileShape.optional(),
  }).strict(),
  runs: z.number().int().positive().optional(),
  years: z.number().int().positive().optional(),
}).passthrough();

const scenarioDataSchema = z.union([monteCarloV1Schema, safeJsonRecord]);

const scenarioSchema = z.object({
  name: z.string().min(1).max(200),
  scenarioData: scenarioDataSchema,
}).strict();

const MAX_SCENARIOS = 50;

export default async function scenarioRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** GET /api/me/scenarios — list all saved scenarios. */
  app.get('/', async (request, reply) => {
    const scenarios = await prisma.userScenario.findMany({
      where: { userId: request.userId },
      orderBy: { updatedAt: 'desc' },
    });

    reply.header('Cache-Control', 'private, no-store');
    return scenarios;
  });

  /**
   * POST /api/me/scenarios
   * @summary Create a new named scenario (basic+ tier).
   * @bodyShape `{ name, scenarioData }` — `scenarioData` may be arbitrary JSON
   *            or a `monte_carlo_v1` envelope (validated when `kind` matches).
   */
  app.post('/', { preHandler: requireTier('basic') }, async (request, reply) => {
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

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

  /** PUT /api/me/scenarios/:id — update existing scenario (basic+ tier). */
  app.put('/:id', { preHandler: requireTier('basic') }, async (request, reply) => {
    const parsed = scenarioSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const { id } = request.params as { id: string };

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

  /** DELETE /api/me/scenarios/:id — delete scenario. */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const existing = await prisma.userScenario.findFirst({
      where: { id, userId: request.userId },
    });
    if (!existing) return reply.code(404).send({ error: 'Scenario not found' });

    await prisma.userScenario.delete({ where: { id } });
    return { message: 'Scenario deleted' };
  });
}
