import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { toValidationErrorPayload } from '../lib/validation.js';

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
});

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

/** Convert DB record to client format. */
function toClient(record: Record<string, unknown>) {
  const out = { ...record };

  // Convert all numeric fields from Prisma Decimal -> JS number
  for (const f of NUMERIC_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = Number(out[f]);
    }
  }

  // Convert DB decimal fractions -> client whole-number percentages
  for (const f of PCT_FIELDS) {
    if (out[f] !== undefined && out[f] !== null) {
      out[f] = (out[f] as number) * 100;
    }
  }

  return out;
}

export default async function feesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  // GET /api/me/fees � brokerage, transfer, and FX fee settings
  app.get('/', async (request, reply) => {
    const record = await prisma.userBrokerageFees.findUnique({
      where: { userId: request.userId },
    });

    if (!record) {
      reply.header('Cache-Control', 'private, no-store');
      return { userId: request.userId, ...DEFAULTS, updatedAt: new Date() };
    }

    reply.header('Cache-Control', 'private, no-store');
    return toClient(record as unknown as Record<string, unknown>);
  });

  // PUT /api/me/fees � update fee settings
  app.put('/', async (request, reply) => {
    const parsed = feesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }

    const data: Record<string, unknown> = { ...parsed.data };

    // Convert client percentages (0.5) to DB decimals (0.005)
    for (const f of PCT_FIELDS) {
      if (data[f] !== undefined && data[f] !== null) {
        data[f] = Number(data[f]) / 100;
      }
    }

    const record = await prisma.userBrokerageFees.upsert({
      where: { userId: request.userId },
      update: data,
      create: { userId: request.userId, ...data },
    });

    return toClient(record as unknown as Record<string, unknown>);
  });
}