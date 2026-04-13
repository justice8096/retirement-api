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

  // Asset Allocation (sent as whole-number percentages, e.g. 60 = 60%)
  equityPct: z.number().min(0).max(100).optional(),
  bondPct: z.number().min(0).max(100).optional(),
  cashPct: z.number().min(0).max(100).optional(),
  intlPct: z.number().min(0).max(100).optional(),

  // Return Assumptions (sent as whole-number percentages, e.g. 7 = 7%)
  expectedReturn: z.number().min(0).max(30).optional(),
  expectedInflation: z.number().min(0).max(20).optional(),

  // FIRE Settings
  retirementPath: z.enum(['traditional', 'fire', 'semi-retire', 'coast-fire', 'barista-fire']).optional(),
  fireTargetAge: z.number().int().min(25).max(90).nullable().optional(),
  annualSavings: z.number().min(0).max(10_000_000).nullable().optional(),
  savingsRate: z.number().min(0).max(100).nullable().optional(),

  // Multi-Account Balances
  traditionalBalance: z.number().min(0).max(100_000_000).nullable().optional(),
  rothBalance: z.number().min(0).max(100_000_000).nullable().optional(),
  taxableBalance: z.number().min(0).max(100_000_000).nullable().optional(),
  hsaBalance: z.number().min(0).max(100_000_000).nullable().optional(),
}).strict();

const DEFAULTS = {
  portfolioBalance: 500000,
  fxDriftEnabled: true,
  fxDriftAnnualRate: 0.01,
  ssCutEnabled: true,
  ssCutYear: 2033,
  ssCola: 2.5,
  equityPct: 60,
  bondPct: 30,
  cashPct: 10,
  intlPct: 20,
  expectedReturn: 7,
  expectedInflation: 2.5,
  retirementPath: 'traditional',
};

/** Encrypted balance field names. */
const ENCRYPTED_FIELDS = [
  'portfolioBalance',
  'traditionalBalance',
  'rothBalance',
  'taxableBalance',
  'hsaBalance',
] as const;

/** Decimal-fraction fields stored as 0.60 in DB but sent as 60 to client. */
const PCT_FIELDS = [
  'equityPct',
  'bondPct',
  'cashPct',
  'intlPct',
  'expectedReturn',
  'expectedInflation',
  'savingsRate',
] as const;

/** Decrypt sensitive fields and convert DB decimals to client percentages. */
function decryptSettings(settings: Record<string, unknown>) {
  const out = { ...settings };
  for (const f of ENCRYPTED_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = decryptField(out[f]);
    }
  }
  for (const f of PCT_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = Number(out[f]) * 100;
    }
  }
  return out;
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

    // Encrypt balance fields before writing
    const data: Record<string, unknown> = { ...parsed.data };
    for (const f of ENCRYPTED_FIELDS) {
      if (data[f] !== undefined && data[f] !== null) {
        data[f] = encryptField(data[f] as number);
      }
    }
    // Convert client percentages (60) to DB decimals (0.60)
    for (const f of PCT_FIELDS) {
      if (data[f] !== undefined && data[f] !== null) {
        data[f] = Number(data[f]) / 100;
      }
    }

    const settings = await prisma.userFinancialSettings.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return decryptSettings(settings);
  });
}
