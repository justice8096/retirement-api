import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';

// Validates client-side values (percentages as whole numbers, balances in dollars).
// Uses z.coerce.number() because Prisma returns Decimal fields as strings and
// encrypted String fields as strings — the client round-trips these as-is.
// Unknown fields (e.g. userId, updatedAt) are silently stripped by Zod defaults.
const num = z.coerce.number();

const financialSchema = z.object({
  portfolioBalance: num.min(0).max(100_000_000).optional(),
  fxDriftEnabled: z.boolean().optional(),
  fxDriftAnnualRate: num.min(-10).max(20).optional(), // client sends %, e.g. 1 = 1%/yr
  ssCutEnabled: z.boolean().optional(),
  ssCutYear: num.int().min(2025).max(2050).optional(),
  ssCola: num.min(0).max(10).optional(),

  // Asset Allocation (sent as whole-number percentages, e.g. 60 = 60%)
  equityPct: num.min(0).max(100).optional(),
  bondPct: num.min(0).max(100).optional(),
  cashPct: num.min(0).max(100).optional(),
  intlPct: num.min(0).max(100).optional(),

  // Return Assumptions (sent as whole-number percentages, e.g. 7 = 7%)
  expectedReturn: num.min(0).max(30).optional(),
  expectedInflation: num.min(0).max(20).optional(),

  // FIRE Settings
  retirementPath: z.enum(['traditional', 'fire', 'semi-retire', 'coast-fire', 'barista-fire']).optional(),
  fireTargetAge: num.int().min(25).max(90).nullable().optional(),
  annualSavings: num.min(0).max(10_000_000).nullable().optional(),
  savingsRate: num.min(0).max(100).nullable().optional(),

  // Multi-Account Balances
  traditionalBalance: num.min(0).max(100_000_000).nullable().optional(),
  rothBalance: num.min(0).max(100_000_000).nullable().optional(),
  taxableBalance: num.min(0).max(100_000_000).nullable().optional(),
  hsaBalance: num.min(0).max(100_000_000).nullable().optional(),
});

// Defaults sent to client when no DB record exists (client-side format).
const DEFAULTS = {
  portfolioBalance: 500000,
  fxDriftEnabled: true,
  fxDriftAnnualRate: 1,    // 1% — client format
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
  'fxDriftAnnualRate',
  'savingsRate',
] as const;

/** All numeric fields — ensures Prisma Decimals and encrypted Strings become JS numbers. */
const NUMERIC_FIELDS = new Set<string>([
  ...ENCRYPTED_FIELDS,
  ...PCT_FIELDS,
  'ssCola', 'ssCutYear', 'fireTargetAge', 'annualSavings',
]);

/** Decrypt sensitive fields and convert DB decimals to client percentages. */
function decryptSettings(settings: Record<string, unknown>) {
  const out = { ...settings };

  // Decrypt encrypted balance fields
  for (const f of ENCRYPTED_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = decryptField(out[f]);
    }
  }

  // Convert all numeric fields from Prisma Decimal/String → JS number
  for (const f of NUMERIC_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = Number(out[f]);
    }
  }

  // Convert DB decimal fractions → client whole-number percentages
  for (const f of PCT_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = (out[f] as number) * 100;
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
