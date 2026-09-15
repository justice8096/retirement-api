import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { toValidationErrorPayload } from '../lib/validation.js';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '#shared/engine/monte-carlo.js';
import { digestRmdSummary } from '#shared/engine/rmd-summary.js';

/**
 * POST /api/simulate — run the canonical Monte Carlo retirement engine
 * server-side and return success rate + ending-balance percentiles.
 *
 * This is the SAME engine the dashboard runs client-side, imported from the
 * shared `shared/engine/` package (`#shared/engine/...`), so remote callers
 * — notably the retirement MCP on a thin client — get results identical to
 * the app without reimplementing the kernel.
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

    // Scheduled Social Security reduction (spec 2026-08-29). Decimal-
    // fraction rate per API style: ssCutPct 0.23 = 23% cut at trust-fund
    // depletion. ssAnnualIncome is the SS portion of annualIncome.
    ssAnnualIncome: num.min(0).max(100_000_000).default(0),
    ssCutCalendarYear: z.coerce.number().int().min(2026).max(2100).default(2032),
    ssCutPct: num.min(0).max(1).default(0.23),

    // Per-year household cost curves — annual USD in today's dollars,
    // index = sim year (sparse; shorter than `years` is fine). Build them
    // via GET /api/me/household/cost-curves or shared/engine/household-costs.ts.
    // NOTE: petCostByYear replaces the location's petCare/petDaycare/
    // petGrooming categories — exclude those from annualSpending when set.
    petCostByYear: z.array(num.min(0).max(10_000_000)).max(100).optional(),
    dependentCostByYear: z.array(num.min(0).max(10_000_000)).max(100).optional(),

    // Required Minimum Distributions, Roth conversions and Medicare IRMAA
    // (engine PRs #177, #179, #180). Off unless rmdEnabled; then adultBirthYears
    // is required. traditionalBalance is a scalar or one entry per adult.
    // rothConversionByYear is nominal USD per sim year (index = sim year).
    // irmaaPriorMagi is household MAGI for the two tax years before simStartYear.
    rmdEnabled: z.coerce.boolean().default(false),
    adultBirthYears: z.array(z.coerce.number().int().min(1900).max(2100)).max(4).optional(),
    simStartYear: z.coerce.number().int().min(2000).max(2100).optional(),
    // Array branch first: z.coerce.number() would turn [1] into 1.
    traditionalBalance: z.union([z.array(num.min(0).max(1_000_000_000)).max(4), z.number().min(0).max(1_000_000_000)]).optional(),
    rmdEffectiveTaxRate: num.min(0).max(1).optional(),
    rmdWithdrawalOrder: z.enum(['traditional-first', 'other-first']).optional(),
    rmdTaxMode: z.enum(['flat', 'bracket']).optional(),
    rothConversionByYear: z.array(num.min(0).max(100_000_000)).max(100).optional(),
    rothConversionTaxRate: num.min(0).max(1).optional(),
    irmaaEnabled: z.coerce.boolean().default(false),
    irmaaPartD: z.coerce.boolean().optional(),
    irmaaFromAge: z.coerce.number().int().min(60).max(100).optional(),
    irmaaPriorMagi: z.array(num.min(0).max(100_000_000)).max(2).optional(),

    // Reproducibility: integer seed → mulberry32. Omit for fresh randomness.
    seed: z.coerce.number().int().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.rmdEnabled && !(v.adultBirthYears && v.adultBirthYears.length)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adultBirthYears'],
        message: 'adultBirthYears is required when rmdEnabled is true.',
      });
    }
    if (v.rmdEnabled && Array.isArray(v.traditionalBalance) && v.adultBirthYears
        && v.traditionalBalance.length !== v.adultBirthYears.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traditionalBalance'],
        message: 'traditionalBalance array must have one entry per adultBirthYears entry.',
      });
    }
    if (v.ssAnnualIncome > v.annualIncome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ssAnnualIncome'],
        message: 'Social Security income cannot exceed total income.',
      });
    }
  });

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
      // Calendar → sim-year translation; negative means already cut and the
      // engine applies it at year 0. Slice of 0 keeps the engine no-op.
      ssMonthlyIncome: i.ssAnnualIncome / 12,
      ssCutSimYear: i.ssAnnualIncome > 0 ? i.ssCutCalendarYear - new Date().getFullYear() : undefined,
      ssCutFactor: 1 - i.ssCutPct,
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
      petCostByYear: i.petCostByYear,
      dependentCostByYear: i.dependentCostByYear,
      adultBirthYears: i.adultBirthYears,
      simStartYear: i.simStartYear,
      rmdEnabled: i.rmdEnabled,
      traditionalBalance: i.traditionalBalance,
      rmdEffectiveTaxRate: i.rmdEffectiveTaxRate,
      rmdWithdrawalOrder: i.rmdWithdrawalOrder,
      rmdTaxMode: i.rmdTaxMode,
      rothConversionByYear: i.rothConversionByYear,
      rothConversionTaxRate: i.rothConversionTaxRate,
      irmaaEnabled: i.irmaaEnabled,
      irmaaPartD: i.irmaaPartD,
      irmaaFromAge: i.irmaaFromAge,
      irmaaPriorMagi: i.irmaaPriorMagi,
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
      ...(r.rmd ? { rmd: digestRmdSummary(r.rmd) } : {}),
      inputs: {
        portfolio: i.portfolio,
        annualSpending: i.annualSpending,
        annualIncome: i.annualIncome,
        ssAnnualIncome: i.ssAnnualIncome,
        ssCutCalendarYear: i.ssCutCalendarYear,
        ssCutPct: i.ssCutPct,
        years: i.years,
        runs: i.runs,
        meanReturn: i.meanReturn,
        volReturn: i.volReturn,
        returnMode: i.returnMode,
        petCurveYears: i.petCostByYear?.length ?? 0,
        dependentCurveYears: i.dependentCostByYear?.length ?? 0,
        rmdEnabled: i.rmdEnabled,
        rmdTaxMode: i.rmdTaxMode ?? (i.rmdEnabled ? 'flat' : null),
        conversionYears: i.rothConversionByYear?.filter((v) => v > 0).length ?? 0,
        irmaaEnabled: i.irmaaEnabled,
        seed: i.seed ?? null,
      },
    });
  });
}
