import { describe, it, expect } from 'vitest';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '../../engine/monte-carlo.js';

/**
 * SS scheduled-cut support (spec 2026-08-29). The kernel previously modeled
 * SS inside the lump `monthlyIncome` with no way to express the ~23%
 * benefit reduction scheduled at trust-fund depletion (~2032). These tests
 * pin the new `ssMonthlyIncome` / `ssCutSimYear` / `ssCutFactor` params.
 *
 * All-zero rates + runs:1 + seeded RNG ⇒ fully deterministic arithmetic:
 * each year `bal += income*12 - baseCost*12`. Baseline drift is
 * 2000*12 - 3000*12 = -12,000/yr.
 */
function baseParams(overrides: Partial<MonteCarloParams> = {}): MonteCarloParams {
  return {
    portfolio: 500_000,
    monthlyIncome: 2_000,
    baseCost: 3_000,
    isForeign: false,
    fxDrift: 0,
    runs: 1,
    years: 1,
    meanReturn: 0,
    volReturn: 0,
    meanInflation: 0,
    volInflation: 0,
    currVol: 0,
    incGrowth: 0,
    seededRandom: mulberry32(1),
    ...overrides,
  };
}

describe('SS scheduled-cut (ssMonthlyIncome / ssCutSimYear / ssCutFactor)', () => {
  it('is a no-op when the fields are absent, zero, or lack a cut year', () => {
    const baseline = runMonteCarlo(baseParams());
    const zeroSlice = runMonteCarlo(baseParams({ ssMonthlyIncome: 0, ssCutSimYear: 0 }));
    const noYear = runMonteCarlo(baseParams({ ssMonthlyIncome: 1_000 }));
    expect(baseline.median).toBe(488_000);
    expect(zeroSlice.median).toBe(baseline.median);
    expect(noYear.median).toBe(baseline.median);
  });

  it('applies the default 23% cut to the SS slice from the cut year onward', () => {
    // income 2000 - 1000*0.23 = 1770 → 500000 + 1770*12 - 36000
    const r = runMonteCarlo(baseParams({ ssMonthlyIncome: 1_000, ssCutSimYear: 0 }));
    expect(r.median).toBe(485_240);
  });

  it('leaves years before the cut untouched', () => {
    // y0: -12000 → 488000; y1 (cut): 1770*12 - 36000 = -14760 → 473240
    const r = runMonteCarlo(baseParams({ years: 2, ssMonthlyIncome: 1_000, ssCutSimYear: 1 }));
    expect(r.median).toBe(473_240);
  });

  it('treats a negative cut year as already-cut at year 0', () => {
    const r = runMonteCarlo(baseParams({ ssMonthlyIncome: 1_000, ssCutSimYear: -3 }));
    expect(r.median).toBe(485_240);
  });

  it('honors a custom ssCutFactor', () => {
    // income 2000 - 1000*0.5 = 1500 → 500000 + 18000 - 36000
    const r = runMonteCarlo(baseParams({ ssMonthlyIncome: 1_000, ssCutSimYear: 0, ssCutFactor: 0.5 }));
    expect(r.median).toBe(482_000);
  });

  it('clamps the SS slice to monthlyIncome', () => {
    // slice clamped 5000→2000; income 2000*0.77 = 1540 → 500000 + 18480 - 36000
    const r = runMonteCarlo(baseParams({ ssMonthlyIncome: 5_000, ssCutSimYear: 0 }));
    expect(r.median).toBe(482_480);
  });

  it('grows the SS slice with incGrowth before the cut fires', () => {
    // y0: income 2000 → -12000 → 488000; growth: income 2200, ss 1100.
    // y1 cut: income 2200 - 1100*0.23 = 1947 → 488000 + 23364 - 36000
    const r = runMonteCarlo(
      baseParams({ years: 2, incGrowth: 0.1, ssMonthlyIncome: 1_000, ssCutSimYear: 1 }),
    );
    expect(r.median).toBeCloseTo(475_364, 6);
  });

  it('applies the cut to survivor income (treated as fully SS) when the cut precedes the death', () => {
    // Compare with-cut vs no-cut runs with identical survivor params so all
    // cost-side survivor effects cancel. Cut deltas: y0 pre-death
    // 1000*0.23*12 = 2760; y1,y2 survivor 1500*0.23*12 = 4140 each.
    const survivor = { years: 3, spouseDeathYear: 1, survivorMonthlyIncome: 1_500 };
    const noCut = runMonteCarlo(baseParams(survivor));
    const cut = runMonteCarlo(baseParams({ ...survivor, ssMonthlyIncome: 1_000, ssCutSimYear: 0 }));
    expect(noCut.median - cut.median).toBeCloseTo(2_760 + 4_140 + 4_140, 6);
  });

  it('cuts survivor income when the cut year lands after the death', () => {
    // Death y1 (ssIncome becomes the full survivor benefit), cut fires y2:
    // delta = 1500*0.23*12 = 4140 in y2 only.
    const survivor = { years: 3, spouseDeathYear: 1, survivorMonthlyIncome: 1_500 };
    const noCut = runMonteCarlo(baseParams(survivor));
    const cut = runMonteCarlo(baseParams({ ...survivor, ssMonthlyIncome: 1_000, ssCutSimYear: 2 }));
    expect(noCut.median - cut.median).toBeCloseTo(4_140, 6);
  });
});
