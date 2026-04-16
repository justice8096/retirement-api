import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptField, decryptField } from '../middleware/encryption.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import { defaultCurrencyFor } from '../lib/locale.js';

/**
 * Withdrawal strategy persistence + plain-language response decoration.
 *
 * Rate encoding (Dyscalculia audit F-001 / F-009):
 *   - `withdrawalRate`, `ceilingRate`, `floorRate`, `adjustmentPct`,
 *     `maxDiscretionaryRate` are all **decimal fractions**. 0.04 = 4%,
 *     0.05 = 5%, 0.25 = 25%. Documented below via Zod `.describe()` calls
 *     so the shape is discoverable from OpenAPI / source alike.
 *
 * Response units (Dyscalculia audit F-002 / F-005):
 *   - Numeric "amount" fields carry adjacent `*_unit`, `*_currency`, and
 *     `*_periodicity` metadata so downstream UIs don't have to guess.
 *   - An `explanation` field paraphrases the numbers in plain language.
 */

const STRATEGY_TYPES = ['fixed', 'constant', 'guardrails', 'vpw', 'bucket', 'floor-ceiling'] as const;
const SPENDING_MODELS = ['level', 'smile', 'declining', 'essential-first'] as const;

const withdrawalStrategySchema = z.object({
  strategyType: z.enum(STRATEGY_TYPES).optional()
    .describe('Withdrawal strategy type. See /api/glossary?key=vpw etc. for definitions.'),

  withdrawalRate: z.number().min(0.01).max(0.20).optional()
    .describe('Withdrawal rate as a decimal fraction. 0.04 = 4% (the "4% rule").'),

  ceilingRate: z.number().min(0.01).max(0.20).optional().nullable()
    .describe('Guardrails ceiling rate as a decimal fraction. 0.05 = 5%.'),

  floorRate: z.number().min(0.01).max(0.20).optional().nullable()
    .describe('Guardrails floor rate as a decimal fraction. 0.03 = 3%.'),

  adjustmentPct: z.number().min(0.01).max(0.50).optional().nullable()
    .describe('Guardrails spending adjustment as a decimal fraction. 0.10 = 10%.'),

  bucket1Years: z.number().int().min(1).max(50).optional().nullable()
    .describe('Short-term bucket sized in years of essential spending.'),

  bucket2Years: z.number().int().min(1).max(50).optional().nullable()
    .describe('Medium-term bucket sized in years of essential spending.'),

  refillThreshold: z.number().min(0).max(100).optional().nullable()
    .describe('Portfolio growth above target that triggers a bucket refill (percent, whole-number).'),

  essentialSpending: z.number().min(0).max(1_000_000).optional().nullable()
    .describe('Essential yearly spending in user currency, whole units (not cents).'),

  discretionaryBudget: z.number().min(0).max(1_000_000).optional().nullable()
    .describe('Discretionary yearly spending in user currency, whole units (not cents).'),

  maxDiscretionaryRate: z.number().min(0.01).max(1).optional().nullable()
    .describe('Maximum discretionary share of portfolio as a decimal fraction. 0.02 = 2%.'),

  spendingModel: z.enum(SPENDING_MODELS).optional()
    .describe('Lifetime spending pattern. See /api/glossary?key=blanchett_smile.'),

  declineRate: z.number().min(0).max(0.05).optional().nullable()
    .describe('Yearly spending decline as a decimal fraction. 0.01 = 1% per year.'),

  rothConversionEnabled: z.boolean().optional(),
  rothConversionAmount: z.number().min(0).max(500_000).optional().nullable()
    .describe('Yearly Roth conversion amount in user currency.'),
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

/**
 * Decorate a strategy with units + a plain-language explanation.
 * Dyscalculia audit F-002 / F-005 — clients shouldn't have to guess that
 * `withdrawalRate: 0.04` is a decimal fraction meaning "4% per year."
 */
interface StrategyLike {
  strategyType?: string | null;
  withdrawalRate?: number | null;
  ceilingRate?: number | null;
  floorRate?: number | null;
  adjustmentPct?: number | null;
  spendingModel?: string | null;
  declineRate?: number | null;
  [key: string]: unknown;
}

function decorate(strategy: StrategyLike, locale: string) {
  const currency = defaultCurrencyFor(locale);
  const rate = strategy.withdrawalRate ?? DEFAULTS.withdrawalRate;
  const strat = strategy.strategyType ?? DEFAULTS.strategyType;

  const rateAsPercent = Math.round((rate ?? 0) * 1000) / 10;
  const explanationPlain =
    `Your plan uses the ${strat} strategy with a ${rateAsPercent}% yearly withdrawal rate. ` +
    `On a $1,000,000 portfolio that is about $${Math.round((rate ?? 0) * 1_000_000).toLocaleString(locale)} per year.`;

  return {
    ...strategy,
    _units: {
      withdrawalRate: { encoding: 'fraction', meaning: '0.04 = 4%' },
      ceilingRate: { encoding: 'fraction', meaning: '0.05 = 5%' },
      floorRate: { encoding: 'fraction', meaning: '0.03 = 3%' },
      adjustmentPct: { encoding: 'fraction', meaning: '0.10 = 10%' },
      maxDiscretionaryRate: { encoding: 'fraction', meaning: '0.02 = 2%' },
      declineRate: { encoding: 'fraction', meaning: '0.01 = 1% per year' },
      essentialSpending: { encoding: 'amount', currency, periodicity: 'year' },
      discretionaryBudget: { encoding: 'amount', currency, periodicity: 'year' },
      rothConversionAmount: { encoding: 'amount', currency, periodicity: 'year' },
    },
    explanation: explanationPlain,
    glossary: `/api/glossary?key=${strat === 'vpw' ? 'vpw' : strat === 'guardrails' ? 'guardrails' : 'safe_withdrawal_rate'}`,
  };
}

export default async function withdrawalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /**
   * GET /api/me/withdrawal
   * @summary Current withdrawal strategy for the authenticated user.
   * @returns Strategy + `_units` metadata + plain-language `explanation`.
   *          If none stored, returns DEFAULTS (fixed 4%).
   */
  app.get('/', async (request, reply) => {
    const strategy = await prisma.userWithdrawalStrategy.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    const base = strategy
      ? decryptStrategy(strategy)
      : { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    return decorate(base as StrategyLike, request.locale ?? 'en-US');
  });

  /**
   * PUT /api/me/withdrawal
   * @summary Create or update the withdrawal strategy.
   * @bodyShape See `withdrawalStrategySchema`. All rate fields are decimal
   *            fractions (0.04 = 4%). Amount fields are whole currency units.
   * @errors    400 Validation failed — plain-language envelope with `field` +
   *            `fieldLabel` + `message` per issue.
   */
  app.put('/', async (request, reply) => {
    const parsed = withdrawalStrategySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

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

    return decorate(decryptStrategy(strategy) as StrategyLike, request.locale ?? 'en-US');
  });

  /**
   * DELETE /api/me/withdrawal
   * @summary Reset the strategy to platform defaults (fixed 4% rule).
   */
  app.delete('/', async (request, reply) => {
    await prisma.userWithdrawalStrategy.deleteMany({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    return decorate(
      { userId: request.userId, ...DEFAULTS, updatedAt: new Date() } as StrategyLike,
      request.locale ?? 'en-US',
    );
  });
}
