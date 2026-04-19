import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { toValidationErrorPayload } from '../lib/validation.js';
import { defaultCurrencyFor } from '../lib/locale.js';

/**
 * Brokerage / transfer / FX fee persistence.
 *
 * Rate encoding (Dyscalculia audit F-001):
 *   - `*Pct` / `brokerageExpenseRatio` / `fxSpreadPct` are whole-number
 *     percentages on the wire (0.5 = 0.5%, 1.2 = 1.2%). Stored as decimal
 *     fractions (0.005, 0.012). Conversion happens in `toClient()` below.
 */
const num = z.coerce.number();

const feesSchema = z.object({
  // Brokerage fees
  brokerageFeePct: num.min(0).max(10).optional(),
  brokerageFeeFlat: num.min(0).max(1000).optional(),
  brokerageAnnualFee: num.min(0).max(100000).optional(),
  brokerageExpenseRatio: num.min(0).max(5).optional(),

  // Wire / ACH transfer fees
  wireTransferFeeUsd: num.min(0).max(500).optional(),
  wireTransferFeeLocal: num.min(0).max(500).optional(),
  achTransferFee: num.min(0).max(100).optional(),

  // Currency exchange fees
  fxSpreadPct: num.min(0).max(10).optional(),
  fxFixedFee: num.min(0).max(500).optional(),
  fxProvider: z.enum(['bank', 'wise', 'ofx', 'xe', 'other']).optional(),

  // Currency
  localCurrency: z.string().min(1).max(10).optional(),
  manualExchangeRate: num.min(0).max(100000).nullable().optional(),
}).strict();  // SAST M-02: reject unknown keys

/** Percentage fields stored as decimal fractions in DB but sent as whole numbers to client. */
const PCT_FIELDS = [
  'brokerageFeePct',
  'brokerageExpenseRatio',
  'fxSpreadPct',
] as const;

const NUMERIC_FIELDS = new Set<string>([
  ...PCT_FIELDS,
  'brokerageFeeFlat', 'brokerageAnnualFee',
  'wireTransferFeeUsd', 'wireTransferFeeLocal', 'achTransferFee',
  'fxFixedFee', 'manualExchangeRate',
]);

const DEFAULTS = {
  brokerageFeePct: 0.5,       // 0.5% � client format
  brokerageFeeFlat: 0,
  brokerageAnnualFee: 0,
  brokerageExpenseRatio: 0.2, // 0.2%
  wireTransferFeeUsd: 25,
  wireTransferFeeLocal: 0,
  achTransferFee: 0,
  fxSpreadPct: 1,             // 1%
  fxFixedFee: 0,
  fxProvider: 'bank',
  localCurrency: 'USD',
  manualExchangeRate: null,
};

/** Convert DB record to client format.
 *  Dyscalculia F-202 — v2 clients get decimal fractions; v1 clients get
 *  whole-number percentages (existing behaviour, no breaking change). */
function toClient(record: Record<string, unknown>, apiVersion: 1 | 2 = 1) {
  const out = { ...record };

  // Convert all numeric fields from Prisma Decimal -> JS number
  for (const f of NUMERIC_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = Number(out[f]);
    }
  }

  // v1: DB decimal fractions -> whole-number percentages. v2: pass through.
  if (apiVersion === 1) {
    for (const f of PCT_FIELDS) {
      if (out[f] !== undefined && out[f] !== null) {
        out[f] = (out[f] as number) * 100;
      }
    }
  }

  return out;
}

/**
 * Build the `_units` metadata block for a fees response. Closes Dyscalculia
 * audit F-201 (2026-04-19) — mirrors the unitsMeta() pattern in
 * `financial.ts:145-171` so every money-shaped route carries its own unit
 * semantics instead of relying on field-name conventions.
 */
function unitsMeta(record: Record<string, unknown>, locale: string, apiVersion: 1 | 2 = 1) {
  const usd = defaultCurrencyFor('en-US');
  const requestCurrency = defaultCurrencyFor(locale);
  const local = (record.localCurrency as string) || requestCurrency;
  const pct = apiVersion === 2
    ? (meaning: string) => ({ encoding: 'fraction' as const, meaning })
    : (meaning: string) => ({ encoding: 'percent' as const, meaning });
  return {
    brokerageFeePct:         pct(apiVersion === 2 ? '0.005 = 0.5% per trade' : '0.5 = 0.5% per trade'),
    brokerageFeeFlat:        { encoding: 'amount', currency: usd, periodicity: 'per-trade' },
    brokerageAnnualFee:      { encoding: 'amount', currency: usd, periodicity: 'year' },
    brokerageExpenseRatio:   pct(apiVersion === 2 ? '0.002 = 0.2% annual expense ratio' : '0.2 = 0.2% annual expense ratio'),
    wireTransferFeeUsd:      { encoding: 'amount', currency: usd, periodicity: 'per-transfer' },
    wireTransferFeeLocal:    { encoding: 'amount', currency: local, periodicity: 'per-transfer' },
    achTransferFee:          { encoding: 'amount', currency: usd, periodicity: 'per-transfer' },
    fxSpreadPct:             pct(apiVersion === 2 ? '0.01 = 1% spread on FX conversion' : '1 = 1% spread on FX conversion'),
    fxFixedFee:              { encoding: 'amount', currency: local, periodicity: 'per-transfer' },
    manualExchangeRate:      { encoding: 'rate', meaning: `1 USD = N ${local} (set to null for live rate)` },
    localCurrency:           { encoding: 'currency-code', meaning: 'ISO 4217 code for the user\'s local currency' },
  };
}

export default async function feesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/fees � brokerage, transfer, and FX fee settings
  app.get('/', async (request, reply) => {
    const record = await prisma.userBrokerageFees.findUnique({
      where: { userId: request.userId },
    });

    reply.header('Cache-Control', 'private, no-store');
    const version = request.apiVersion ?? 1;
    reply.header('X-API-Version', String(version));
    const base = record
      ? toClient(record as unknown as Record<string, unknown>, version)
      : { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    return { ...base, _units: unitsMeta(base, request.locale ?? 'en-US', version) };
  });

  // PUT /api/me/fees � update fee settings
  app.put('/', async (request, reply) => {
    const parsed = feesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const data: Record<string, unknown> = { ...parsed.data };
    const version = request.apiVersion ?? 1;
    reply.header('X-API-Version', String(version));

    // v1 clients send whole-number percentages; convert to DB fractions.
    // v2 clients already send fractions; pass through.
    if (version === 1) {
      for (const f of PCT_FIELDS) {
        if (data[f] !== undefined && data[f] !== null) {
          data[f] = Number(data[f]) / 100;
        }
      }
    }

    const record = await prisma.userBrokerageFees.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    const base = toClient(record as unknown as Record<string, unknown>, version);
    return { ...base, _units: unitsMeta(base, request.locale ?? 'en-US', version) };
  });
}