/**
 * Tests for POST /api/simulate — the server-side Monte Carlo endpoint that
 * backs the retirement MCP. Covers the route (validation, shape, caps) and
 * the engine's determinism + directional sanity.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import simulateRoutes from '../routes/simulate.js';
import { runMonteCarlo, mulberry32 } from '#shared/engine/monte-carlo.js';

describe('POST /api/simulate', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(simulateRoutes, { prefix: '/api/simulate' });
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    app.inject({ method: 'POST', url: '/api/simulate', payload: body });

  it('runs a scenario and returns success rate + ordered percentiles', async () => {
    const res = await post({ portfolio: 1_000_000, annualSpending: 50_000, years: 30, seed: 42 });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.successPct).toBeGreaterThanOrEqual(0);
    expect(b.successPct).toBeLessThanOrEqual(100);
    expect(b.p5).toBeLessThanOrEqual(b.p25);
    expect(b.p25).toBeLessThanOrEqual(b.median);
    expect(b.median).toBeLessThanOrEqual(b.p75);
    expect(b.p75).toBeLessThanOrEqual(b.p95);
    expect(b.sampleCount).toBe(2_000);
  });

  it('is deterministic for a fixed seed', async () => {
    const body = { portfolio: 1_000_000, annualSpending: 50_000, years: 30, seed: 7 };
    const a = (await post(body)).json();
    const b = (await post(body)).json();
    expect(a.successPct).toBe(b.successPct);
    expect(a.median).toBe(b.median);
    expect(a.p5).toBe(b.p5);
  });

  it('is deterministic for a fixed seed in bootstrap mode (Codex P2)', async () => {
    const body = { portfolio: 1_000_000, annualSpending: 50_000, years: 30, returnMode: 'bootstrap', seed: 7 };
    const a = (await post(body)).json();
    const b = (await post(body)).json();
    expect(a.successPct).toBe(b.successPct);
    expect(a.median).toBe(b.median);
    expect(a.p5).toBe(b.p5);
  });

  it('rejects a missing required field with 400', async () => {
    const res = await post({ annualSpending: 50_000, years: 30 }); // no portfolio
    expect(res.statusCode).toBe(400);
  });

  it('rejects runs above the cap with 400', async () => {
    const res = await post({ portfolio: 1_000_000, annualSpending: 50_000, years: 30, runs: 999_999 });
    expect(res.statusCode).toBe(400);
  });

  it('directional sanity: rich+frugal beats poor+spendy', async () => {
    const comfy = (await post({ portfolio: 2_000_000, annualSpending: 40_000, years: 30, seed: 1 })).json();
    const strained = (await post({ portfolio: 300_000, annualSpending: 60_000, years: 30, seed: 1 })).json();
    expect(comfy.successPct).toBeGreaterThan(strained.successPct);
    expect(comfy.successPct).toBeGreaterThan(90);
    expect(strained.successPct).toBeLessThan(50);
  });
});

describe('engine determinism (mulberry32)', () => {
  it('same seed → byte-identical ending balances', () => {
    const mk = (seed: number) => ({
      portfolio: 800_000, monthlyIncome: 0, baseCost: 45_000 / 12,
      isForeign: false, fxDrift: 0, runs: 500, years: 30,
      meanReturn: 0.06, volReturn: 0.12, meanInflation: 0.025, volInflation: 0.01,
      currVol: 0, incGrowth: 0, returnMode: 'normal' as const, seededRandom: mulberry32(seed),
    });
    const a = runMonteCarlo(mk(123));
    const b = runMonteCarlo(mk(123));
    expect(a.results).toEqual(b.results);
    expect(a.successRate).toBe(b.successRate);
  });
});

describe('POST /api/simulate — pet/dependent cost curves', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(simulateRoutes, { prefix: '/api/simulate' });
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    app.inject({ method: 'POST', url: '/api/simulate', payload: body });

  // Zero return / vol / inflation / income so balance arithmetic is exact.
  const flatBody = {
    portfolio: 100_000, annualSpending: 0, years: 3, runs: 3,
    meanReturn: 0, volReturn: 0, meanInflation: 0, volInflation: 0, seed: 42,
  };

  it('applies supplied curves to the simulation', async () => {
    const without = (await post(flatBody)).json();
    const res = await post({
      ...flatBody, petCostByYear: [1_200, 0, 600], dependentCostByYear: [0, 2_400, 0],
    });
    expect(res.statusCode).toBe(200);
    const withCurves = res.json();
    expect(without.median).toBe(100_000);
    expect(withCurves.median).toBe(100_000 - 4_200);
    expect(withCurves.inputs.petCurveYears).toBe(3);
    expect(withCurves.inputs.dependentCurveYears).toBe(3);
  });

  it('rejects negative entries and over-long arrays', async () => {
    const bad1 = await post({ portfolio: 1, annualSpending: 1, years: 1, petCostByYear: [-5] });
    expect(bad1.statusCode).toBe(400);
    const bad2 = await post({
      portfolio: 1, annualSpending: 1, years: 1,
      dependentCostByYear: new Array(101).fill(0),
    });
    expect(bad2.statusCode).toBe(400);
  });
});

describe('SS scheduled-cut fields (spec 2026-08-29)', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(simulateRoutes, { prefix: '/api/simulate' });
  });
  afterEach(async () => { await app.close(); });
  const post = (body: unknown) =>
    app.inject({ method: 'POST', url: '/api/simulate', payload: body });

  const deterministic = {
    portfolio: 500_000, annualSpending: 36_000, annualIncome: 24_000,
    years: 1, runs: 1, meanReturn: 0, volReturn: 0, meanInflation: 0,
    volInflation: 0, seed: 1,
  };

  it('models the cut from the calendar year, echoing the inputs', async () => {
    const thisYear = new Date().getFullYear();
    // Cut already active (calendar year = current): SS slice 12000/yr →
    // income 1000 non-SS + 1000*0.77 SS = 1770/mo → 500000 + 21240 - 36000.
    const res = await post({
      ...deterministic, ssAnnualIncome: 12_000, ssCutCalendarYear: thisYear,
    });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.median).toBe(485_240);
    expect(b.inputs.ssAnnualIncome).toBe(12_000);
    expect(b.inputs.ssCutCalendarYear).toBe(thisYear);
    expect(b.inputs.ssCutPct).toBe(0.23);
  });

  it('does not cut before the calendar year arrives', async () => {
    const nextYear = new Date().getFullYear() + 1;
    const res = await post({
      ...deterministic, ssAnnualIncome: 12_000, ssCutCalendarYear: nextYear,
    });
    // years:1 ends before the cut year → baseline math.
    expect(res.json().median).toBe(488_000);
  });

  it('defaults: no ssAnnualIncome ⇒ no cut, legacy result', async () => {
    const res = await post(deterministic);
    expect(res.json().median).toBe(488_000);
    expect(res.json().inputs.ssAnnualIncome).toBe(0);
  });

  it('rejects SS income above total income with a plain-language envelope', async () => {
    const res = await post({ ...deterministic, ssAnnualIncome: 30_000 });
    expect(res.statusCode).toBe(400);
    const d = res.json().details.find((x: { field: string }) => x.field === 'ssAnnualIncome');
    expect(d.fieldLabel).toBe('Social Security income');
    expect(d.message).toBe('Social Security income cannot exceed total income.');
  });
});
