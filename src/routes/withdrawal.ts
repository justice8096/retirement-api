import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';

const STRATEGY_TYPES = ['fixed', 'constant', 'guardrails', 'vpw', 'bucket', 'floor-ceiling'] as const;
const SPENDING_MODELS = ['level', 'smile', 'declining', 'essential-first'] as const;

const withdrawalStrategySchema = z.object({
  strategyType: z.enum(STRATEGY_TYPES).optional(),
  withdrawalRate: z.number().min(0.01).max(0.20).optional(),
  ceilingRate: z.number().min(0.01).max(0.20).optional().nullable(),
  floorRate: z.number().min(0.01).max(0.20).optional().nullable(),
  adjustmentPct: z.number().min(0.01).max(0.50).optional().nullable(),
  bucket1Years: z.number().int().min(1).max(50).optional().nullable(),
  bucket2Years: z.number().int().min(1).max(50).optional().nullable(),
  refillThreshold: z.number().min(0).max(100).optional().nullable(),
  essentialSpending: z.number().min(0).max(1_000_000).optional().nullable(),
  discretionaryBudget: z.number().min(0).max(1_000_000).optional().nullable(),
  maxDiscretionaryRate: z.number().min(0.01).max(1).optional().nullable(),
  spendingModel: z.enum(SPENDING_MODELS).optional(),
  declineRate: z.number().min(0).max(0.05).optional().nullable(),
  rothConversionEnabled: z.boolean().optional(),
  rothConversionAmount: z.number().min(0).max(500_000).optional().nullable(),
  rothConversionEndAge: z.number().int().min(50).max(100).optional().nullable(),
}).strict();

const DEFAULTS = {
  strategyType: 'fixed',
  withdrawalRate: 0.04,
  ceilingRate: null,
  floorRate: null,
  adjustmentPct: null,
  bucket1Years: null,
  bucket2Years: null,
  refillThreshold: null,
  essentialSpending: null,
  discretionaryBudget: null,
  maxDiscretionaryRate: null,
  spendingModel: 'level',
  declineRate: null,
  rothConversionEnabled: false,
  rothConversionAmount: null,
  rothConversionEndAge: null,
};

/** Decrypt sensitive fields before sending to client. */
function decryptStrategy(strategy: {
  essentialSpending?: unknown;
  discretionaryBudget?: unknown;
  rothConversionAmount?: unknown;
  [key: string]: unknown;
}) {
  return {
    ...strategy,
    essentialSpending: strategy.essentialSpending ? decryptField(strategy.essentialSpending) : null,
    discretionaryBudget: strategy.discretionaryBudget ? decryptField(strategy.discretionaryBudget) : null,
    rothConversionAmount: strategy.rothConversionAmount ? decryptField(strategy.rothConversionAmount) : null,
  };
}

export default async function withdrawalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/withdrawal — get current withdrawal strategy (create default if none exists)
  app.get('/', async (request, reply) => {
    const strategy = await prisma.userWithdrawalStrategy.findUnique({
      where: { userId: request.userId },
    });

    if (!strategy) {
      reply.header('Cache-Control', 'private, no-store');
      return { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    }

    reply.header('Cache-Control', 'private, no-store');
    return decryptStrategy(strategy);
  });

  // PUT /api/me/withdrawal — update withdrawal strategy
  app.put('/', async (request, reply) => {
    const parsed = withdrawalStrategySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
    }

    // Encrypt sensitive fields before writing
    const data: Record<string, unknown> = { ...parsed.data };
    if (data.essentialSpending !== undefined && data.essentialSpending !== null) {
      data.essentialSpending = encryptField(data.essentialSpending as number);
    }
    if (data.discretionaryBudget !== undefined && data.discretionaryBudget !== null) {
      data.discretionaryBudget = encryptField(data.discretionaryBudget as number);
    }
    if (data.rothConversionAmount !== undefined && data.rothConversionAmount !== null) {
      data.rothConversionAmount = encryptField(data.rothConversionAmount as number);
    }

    const strategy = await prisma.userWithdrawalStrategy.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return decryptStrategy(strategy);
  });

  // DELETE /api/me/withdrawal — reset to defaults
  app.delete('/', async (request, reply) => {
    await prisma.userWithdrawalStrategy.deleteMany({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
  });
}
