import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';

const financialSchema = z.object({
  portfolioBalance: z.number().min(0).max(100_000_000).optional(),
  fxDriftEnabled: z.boolean().optional(),
  fxDriftAnnualRate: z.number().min(-0.1).max(0.2).optional(),
  ssCutEnabled: z.boolean().optional(),
  ssCutYear: z.number().int().min(2025).max(2050).optional(),
  ssCola: z.number().min(0).max(10).optional(),
}).strict();

const DEFAULTS = {
  portfolioBalance: 500000,
  fxDriftEnabled: true,
  fxDriftAnnualRate: 0.01,
  ssCutEnabled: true,
  ssCutYear: 2033,
  ssCola: 2.5,
};

/** Decrypt sensitive fields before sending to client. */
function decryptSettings(settings: { portfolioBalance: unknown; [key: string]: unknown }) {
  return {
    ...settings,
    portfolioBalance: decryptField(settings.portfolioBalance),
  };
}

export default async function financialRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/financial — portfolio, FX drift, SS cut settings
  app.get('/', async (request, reply) => {
    const settings = await prisma.userFinancialSettings.findUnique({
      where: { userId: request.userId },
    });

    if (!settings) {
      reply.header('Cache-Control', 'private, no-store');
      return { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    }

    reply.header('Cache-Control', 'private, no-store');
    return decryptSettings(settings);
  });

  // PUT /api/me/financial — update financial parameters
  app.put('/', async (request, reply) => {
    const parsed = financialSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Encrypt sensitive fields before writing
    const data: Record<string, unknown> = { ...parsed.data };
    if (data.portfolioBalance !== undefined) {
      data.portfolioBalance = encryptField(data.portfolioBalance as number);
    }

    const settings = await prisma.userFinancialSettings.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return decryptSettings(settings);
  });
}
