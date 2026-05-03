import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';
import { toValidationErrorPayload, getLabelsFor } from '../lib/validation.js';
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

/**
 * RentalProperty shape (Todo #36, persistence for #29). Mirrors the
 * `RentalProperty` interface in the dashboard's `src/app/lib/rental-income.ts`.
 * Validated at the request boundary; persisted as JSONB on
 * `user_financial_settings.rental_properties`.
 *
 * Bounds chosen to match the dashboard input ranges:
 *   - depreciationStartYear can be negative (property placed in service
 *     before sim window) — see PR #118 fix for Codex P1.
 *   - sim-year fields are bounded to ±100 to catch fat-fingered input
 *     while still allowing realistic horizons.
 */
const rentalPropertySchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().max(200),
  monthlyGrossRent: num.min(0).max(1_000_000),
  vacancyRatePct: num.min(0).max(100),
  propertyTaxAnnual: num.min(0).max(1_000_000),
  otherOpExAnnual: num.min(0).max(1_000_000),
  mortgageInterestAnnual: num.min(0).max(10_000_000),
  depreciableBasis: num.min(0).max(100_000_000),
  depreciationStartYear: num.int().min(-50).max(100),
  ownedFromYear: num.int().min(0).max(100),
  ownedThroughYear: num.int().min(0).max(100).optional(),
}).strict();

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

  // Per-Account Load % and Fees % (whole-number percent on wire, e.g. 0.5 = 0.5%)
  traditionalLoadPct: num.min(0).max(10).optional(),
  rothLoadPct: num.min(0).max(10).optional(),
  taxableLoadPct: num.min(0).max(10).optional(),
  hsaLoadPct: num.min(0).max(10).optional(),
  traditionalFeesPct: num.min(0).max(10).optional(),
  rothFeesPct: num.min(0).max(10).optional(),
  taxableFeesPct: num.min(0).max(10).optional(),
  hsaFeesPct: num.min(0).max(10).optional(),

  // Rental property portfolio (Todo #36). Bounded array; passes through
  // to the rental_properties JSONB column on user_financial_settings.
  // Empty array on a PUT clears the user's portfolio.
  rentalProperties: z.array(rentalPropertySchema).max(50).optional(),
}).strict();  // SAST M-02: reject unknown keys

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
  rentalProperties: [],
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
  'traditionalLoadPct',
  'rothLoadPct',
  'taxableLoadPct',
  'hsaLoadPct',
  'traditionalFeesPct',
  'rothFeesPct',
  'taxableFeesPct',
  'hsaFeesPct',
] as const;

/** All numeric fields — ensures Prisma Decimals and encrypted Strings become JS numbers. */
const NUMERIC_FIELDS = new Set<string>([
  ...ENCRYPTED_FIELDS,
  ...PCT_FIELDS,
  'ssCola', 'ssCutYear', 'fireTargetAge', 'annualSavings',
]);

/** Decrypt sensitive fields and convert DB decimals to client percentages.
 *  Dyscalculia F-202 — when `apiVersion === 2` the percent → whole-number
 *  conversion is skipped, so clients get decimal fractions matching DB and
 *  the shared `pct()` helper in `shared/formatting.js`. */
function decryptSettings(settings: Record<string, unknown>, apiVersion: 1 | 2 = 1) {
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

  // v1 wire: DB decimal fractions → whole-number percentages. v2: leave as-is.
  if (apiVersion === 1) {
    for (const f of PCT_FIELDS) {
      if (out[f] !== undefined && out[f] !== null) {
        out[f] = (out[f] as number) * 100;
      }
    }
  }

  return out;
}

/** Fields that carry a client-readable label. Dyslexia F-013. */
const LABELED_FIELDS = [
  'portfolioBalance', 'traditionalBalance', 'rothBalance', 'taxableBalance', 'hsaBalance',
  'equityPct', 'bondPct', 'cashPct', 'intlPct',
  'expectedReturn', 'expectedInflation', 'fxDriftAnnualRate', 'fxDriftEnabled',
  'ssCola', 'ssCutYear', 'ssCutEnabled',
  'retirementPath', 'fireTargetAge', 'annualSavings', 'savingsRate',
  'traditionalLoadPct', 'rothLoadPct', 'taxableLoadPct', 'hsaLoadPct',
  'traditionalFeesPct', 'rothFeesPct', 'taxableFeesPct', 'hsaFeesPct',
] as const;

/** Build the `_units` metadata block for a response.
 *  Dyscalculia F-202 — v2 clients receive `encoding: 'fraction'` with a
 *  different `meaning` text so the schism is described accurately. */
function unitsMeta(locale: string, apiVersion: 1 | 2 = 1) {
  const currency = defaultCurrencyFor(locale);
  const pct = apiVersion === 2
    ? (meaning: string) => ({ encoding: 'fraction' as const, meaning })
    : (meaning: string) => ({ encoding: 'percent' as const, meaning });
  const ex = (whole: string, frac: string) => (apiVersion === 2 ? frac : whole);
  return {
    portfolioBalance: { encoding: 'amount', currency, periodicity: 'total' },
    traditionalBalance: { encoding: 'amount', currency, periodicity: 'total' },
    rothBalance: { encoding: 'amount', currency, periodicity: 'total' },
    taxableBalance: { encoding: 'amount', currency, periodicity: 'total' },
    hsaBalance: { encoding: 'amount', currency, periodicity: 'total' },
    annualSavings: { encoding: 'amount', currency, periodicity: 'year' },
    equityPct: pct(ex('60 = 60%', '0.6 = 60%')),
    bondPct: pct(ex('30 = 30%', '0.3 = 30%')),
    cashPct: pct(ex('10 = 10%', '0.1 = 10%')),
    intlPct: pct(ex('20 = 20%', '0.2 = 20%')),
    expectedReturn: pct(ex('7 = 7% per year', '0.07 = 7% per year')),
    expectedInflation: pct(ex('2.5 = 2.5% per year', '0.025 = 2.5% per year')),
    fxDriftAnnualRate: pct(ex('1 = 1% per year', '0.01 = 1% per year')),
    savingsRate: pct(ex('15 = 15% of income', '0.15 = 15% of income')),
    traditionalLoadPct: pct(ex('0.5 = 0.5% annual drag', '0.005 = 0.5% annual drag')),
    rothLoadPct: pct(ex('0.5 = 0.5% annual drag', '0.005 = 0.5% annual drag')),
    taxableLoadPct: pct(ex('0.5 = 0.5% annual drag', '0.005 = 0.5% annual drag')),
    hsaLoadPct: pct(ex('0.5 = 0.5% annual drag', '0.005 = 0.5% annual drag')),
    traditionalFeesPct: pct(ex('0.2 = 0.2% expense ratio', '0.002 = 0.2% expense ratio')),
    rothFeesPct: pct(ex('0.2 = 0.2% expense ratio', '0.002 = 0.2% expense ratio')),
    taxableFeesPct: pct(ex('0.2 = 0.2% expense ratio', '0.002 = 0.2% expense ratio')),
    hsaFeesPct: pct(ex('0.2 = 0.2% expense ratio', '0.002 = 0.2% expense ratio')),
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
    const version = request.apiVersion ?? 1;
    reply.header('X-API-Version', String(version));
    const base = settings
      ? decryptSettings(settings, version)
      : { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    return {
      ...base,
      _units: unitsMeta(request.locale ?? 'en-US', version),
      _labels: getLabelsFor(LABELED_FIELDS),
    };
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
    const version = request.apiVersion ?? 1;
    reply.header('X-API-Version', String(version));

    // Encrypt balance fields before writing
    const data: Record<string, unknown> = { ...parsed.data };
    for (const f of ENCRYPTED_FIELDS) {
      if (data[f] !== undefined && data[f] !== null) {
        data[f] = encryptField(data[f] as number);
      }
    }
    // v1 client sends whole-number percentages (60) — convert to DB decimal (0.60).
    // v2 client sends fractions already — pass through.
    if (version === 1) {
      for (const f of PCT_FIELDS) {
        if (data[f] !== undefined && data[f] !== null) {
          data[f] = Number(data[f]) / 100;
        }
      }
    }

    const settings = await prisma.userFinancialSettings.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return {
      ...decryptSettings(settings, version),
      _units: unitsMeta(request.locale ?? 'en-US', version),
      _labels: getLabelsFor(LABELED_FIELDS),
    };
  });
}
