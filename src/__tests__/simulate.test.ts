/**
 * Tests for POST /api/simulate — the server-side Monte Carlo endpoint that
 * backs the retirement MCP. Covers the route (validation, shape, caps) and
 * the engine's determinism + directional sanity.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import simulateRoutes from '../routes/simulate.js';
import { runMonteCarlo, mulberry32 } from '../lib/engine/monte-carlo.js';

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
