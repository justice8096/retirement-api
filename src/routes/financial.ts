import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import { defaultCurrencyFor } from '../lib/locale.js';

/**
 * Financial settings persistence (portfolio, allocation, return, FIRE).
 *
 * Rate encoding (Dyscalculia audit F-001):
 *   - All `*Pct` / `expectedReturn` / `expectedInflation` / `fxDriftAnnualRate`
 *     fields are **whole-number percentages on the wire** (60 = 60%, 7 = 7%).
 *     Internally they are converted to decimal fractions (0.60) for DB storage.
 *   - `withdrawalRate` (withdrawal.ts) uses decimal fractions. The schism is
 *     documented here and at the top of withdrawal.ts. See the
 *     `_units` envelope for machine-readable meta.
 */
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

/** Build the `_units` metadata block for a response. */
function unitsMeta(locale: string) {
  const currency = defaultCurrencyFor(locale);
  return {
    portfolioBalance: { encoding: 'amount', currency, periodicity: 'total' },
    traditionalBalance: { encoding: 'amount', currency, periodicity: 'total' },
    rothBalance: { encoding: 'amount', currency, periodicity: 'total' },
    taxableBalance: { encoding: 'amount', currency, periodicity: 'total' },
    hsaBalance: { encoding: 'amount', currency, periodicity: 'total' },
    annualSavings: { encoding: 'amount', currency, periodicity: 'year' },
    equityPct: { encoding: 'percent', meaning: '60 = 60%' },
    bondPct: { encoding: 'percent', meaning: '30 = 30%' },
    cashPct: { encoding: 'percent', meaning: '10 = 10%' },
    intlPct: { encoding: 'percent', meaning: '20 = 20%' },
    expectedReturn: { encoding: 'percent', meaning: '7 = 7% per year' },
    expectedInflation: { encoding: 'percent', meaning: '2.5 = 2.5% per year' },
    fxDriftAnnualRate: { encoding: 'percent', meaning: '1 = 1% per year' },
    savingsRate: { encoding: 'percent', meaning: '15 = 15% of income' },
  };
}

export default async function financialRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /**
   * GET /api/me/financial
   * @summary Portfolio, allocation, return, FIRE, and FX settings.
   * @returns Settings + `_units` metadata documenting that `*Pct` fields are
   *          whole-number percentages on the wire (Dyscalculia audit F-002).
   */
  app.get('/', async (request, reply) => {
    const settings = await prisma.userFinancialSettings.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    const base = settings
      ? decryptSettings(settings)
      : { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    return { ...base, _units: unitsMeta(request.locale ?? 'en-US') };
  });

  /**
   * PUT /api/me/financial
   * @summary Update financial parameters.
   * @errors 400 — plain-language validation envelope (field + fieldLabel + message).
   */
  app.put('/', async (request, reply) => {
    const parsed = financialSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
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

    return { ...decryptSettings(settings), _units: unitsMeta(request.locale ?? 'en-US') };
  });
}
