import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { toValidationErrorPayload } from '../lib/validation.js';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '../lib/engine/monte-carlo.js';

/**
 * POST /api/simulate — run the canonical Monte Carlo retirement engine
 * server-side and return success rate + ending-balance percentiles.
 *
 * This is the SAME engine the dashboard runs client-side (generated into
 * `src/lib/engine/` from the dashboard repo via `npm run engine:sync`), so
 * remote callers — notably the retirement MCP on a thin client — get
 * results identical to the app without reimplementing the kernel.
 *
 * Public + stateless: no auth, no persistence. Inputs are capped (runs,
 * years) so a single call can't pin a CPU. Annual dollar figures at the
 * boundary (annualSpending / annualIncome) are converted to the engine's
 * monthly `baseCost` / `monthlyIncome` internally.
 */

const num = z.coerce.number();

const regimeSchema = z
  .object({
    bullMean: num,
    bullVol: num.min(0),
    bearMean: num,
    bearVol: num.min(0),
    pBullToBear: num.min(0).max(1),
    pBearToBull: num.min(0).max(1),
  })
  .strict();

const simulateSchema = z
  .object({
    // Required core
    portfolio: num.min(0).max(1_000_000_000),
    annualSpending: num.min(0).max(100_000_000),
    years: z.coerce.number().int().min(1).max(100),

    // Optional knobs (sane retirement-planning defaults)
    annualIncome: num.min(0).max(100_000_000).default(0),
    runs: z.coerce.number().int().min(1).max(50_000).default(2_000),
    meanReturn: num.min(-1).max(1).default(0.07),
    volReturn: num.min(0).max(2).default(0.13),
    meanInflation: num.min(-1).max(1).default(0.025),
    volInflation: num.min(0).max(1).default(0.01),
    isForeign: z.coerce.boolean().default(false),
    fxDrift: num.min(-1).max(1).default(0),
    currVol: num.min(0).max(1).default(0),
    incGrowth: num.min(-1).max(1).default(0),
    returnMode: z.enum(['normal', 'regime', 'bootstrap', 'historical-sequence']).default('normal'),
    regime: regimeSchema.optional(),
    historicalStartYear: z.coerce.number().int().min(1900).max(2100).optional(),

    // Reproducibility: integer seed → mulberry32. Omit for fresh randomness.
    seed: z.coerce.number().int().optional(),
  })
  .strict();

export default async function simulateRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request, reply) => {
    const parsed = simulateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(toValidationErrorPayload(parsed.error));
    }
    const i = parsed.data;

    const params: MonteCarloParams = {
      portfolio: i.portfolio,
      monthlyIncome: i.annualIncome / 12,
      baseCost: i.annualSpending / 12,
      isForeign: i.isForeign,
      fxDrift: i.fxDrift,
      runs: i.runs,
      years: i.years,
      meanReturn: i.meanReturn,
      volReturn: i.volReturn,
      meanInflation: i.meanInflation,
      volInflation: i.volInflation,
      currVol: i.currVol,
      incGrowth: i.incGrowth,
      returnMode: i.returnMode,
      regime: i.regime,
      historicalStartYear: i.historicalStartYear,
      // Deterministic when a seed is supplied; Math.random otherwise.
      seededRandom: i.seed != null ? mulberry32(i.seed) : undefined,
    };

    const r = runMonteCarlo(params);

    return reply.send({
      successRate: r.successRate,
      successPct: Math.round(r.successRate * 100),
      median: Math.round(r.median),
      p5: Math.round(r.p5),
      p25: Math.round(r.p25),
      p75: Math.round(r.p75),
      p95: Math.round(r.p95),
      sampleCount: r.results.length,
      inputs: {
        portfolio: i.portfolio,
        annualSpending: i.annualSpending,
        annualIncome: i.annualIncome,
        years: i.years,
        runs: i.runs,
        meanReturn: i.meanReturn,
        volReturn: i.volReturn,
        returnMode: i.returnMode,
        seed: i.seed ?? null,
      },
    });
  });
}
