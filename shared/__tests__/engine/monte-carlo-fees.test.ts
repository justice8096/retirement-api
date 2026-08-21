import { describe, it, expect } from 'vitest';
import { runMonteCarlo, type MonteCarloParams } from '../../engine/monte-carlo.js';
import { HISTORICAL_RETURNS } from '../../engine/historical-returns.js';

/**
 * A3 drift item 1 — brokerage/account fee support in the Monte Carlo kernel.
 *
 * The kernel previously applied no brokerage/account fee at all, even though
 * `retirement-api/src/routes/fees.ts` persists `brokerageFeePct` (decimal
 * fraction of balance, e.g. 0.005 = 0.5%/yr) and `brokerageAnnualFee` (flat
 * USD/year) for exactly this purpose. These tests pin down the new fields'
 * behavior before they exist.
 *
 * All tests use `returnMode: 'historical-sequence'` starting at the first
 * year in HISTORICAL_RETURNS (1928) — a fully deterministic path (no RNG
 * calls at all in this mode) with `effectiveRuns` clamped to 1, so `median`
 * is just that single trial's ending balance. `isForeign: false` and
 * `currVol: 0` remove FX shocks from the picture entirely.
 */

const FIRST_YEAR = HISTORICAL_RETURNS[0];

function baseParams(overrides: Partial<MonteCarloParams> = {}): MonteCarloParams {
  return {
    portfolio: 500_000,
    monthlyIncome: 2_000,
    baseCost: 3_000,
    isForeign: false,
    fxDrift: 0,
    runs: 1,
    years: 10,
    meanReturn: 0,
    volReturn: 0,
    meanInflation: 0,
    volInflation: 0,
    currVol: 0,
    incGrowth: 0,
    returnMode: 'historical-sequence',
    historicalStartYear: FIRST_YEAR.year,
    ...overrides,
  };
}

describe('brokerage/account fee support (A3 drift item 1)', () => {
  it('zero/omitted fees produce the identical median ending balance', () => {
    const omitted = runMonteCarlo(baseParams());
    const explicitZero = runMonteCarlo(
      baseParams({ brokerageFeePct: 0, brokerageAnnualFee: 0 }),
    );

    expect(explicitZero.median).toBeCloseTo(omitted.median, 9);
  });

  it('a percentage fee strictly lowers the ending balance, matching the expected 1-year deduction', () => {
    const baseline = runMonteCarlo(baseParams({ years: 1 }));
    const withFee = runMonteCarlo(
      baseParams({ years: 1, brokerageFeePct: 0.01 }),
    );

    expect(withFee.median).toBeLessThan(baseline.median);

    // 1-year horizon: only one application of the return, so the fee base
    // is deterministic — portfolio * (1 + firstYearReturn).
    const balanceAfterReturn = baseParams().portfolio * (1 + FIRST_YEAR.sp500);
    const expectedFee = balanceAfterReturn * 0.01;
    expect(baseline.median - withFee.median).toBeCloseTo(expectedFee, 6);
  });

  it('a flat annual fee alone reduces a 1-year run by exactly the flat amount', () => {
    const baseline = runMonteCarlo(baseParams({ years: 1 }));
    const withFee = runMonteCarlo(
      baseParams({ years: 1, brokerageAnnualFee: 500 }),
    );

    // Year 0: cumInfl is still 1 regardless of whether the flat fee inflates
    // in later years, so this 1-year case is convention-agnostic.
    expect(baseline.median - withFee.median).toBeCloseTo(500, 6);
  });

  it('documents the chosen convention: the flat annual fee inflates like other recurring flat costs (e.g. LTC insurance premium)', () => {
    // Isolate the fee-inflation effect from investment-return compounding:
    // meanReturn/volReturn are 0 (no growth at all, so a fee taken out in an
    // early year doesn't also cost forgone growth in later years — the
    // balances would diverge by more than the fee itself if ret != 0). A
    // fixed, deterministic per-year inflation rate (volInflation: 0) drives
    // cumInfl predictably so the expected per-year fee is computable
    // independent of the engine's own internals.
    const years = 3;
    const noFeeParams: MonteCarloParams = {
      portfolio: 500_000,
      monthlyIncome: 0,
      baseCost: 0,
      isForeign: false,
      fxDrift: 0,
      runs: 1,
      years,
      meanReturn: 0,
      volReturn: 0,
      meanInflation: 0.03,
      volInflation: 0,
      currVol: 0,
      incGrowth: 0,
      returnMode: 'normal',
      // volReturn/volInflation are 0 so this value is mathematically inert,
      // but pin it anyway so the test can never flake on an unlucky
      // Math.random() edge value feeding the Box-Muller transform.
      seededRandom: () => 0.5,
    };
    const withFee = runMonteCarlo({ ...noFeeParams, brokerageAnnualFee: 500 });
    const noFee = runMonteCarlo(noFeeParams);

    // Expected: fee deducted each year at that year's cumInfl (accumulated
    // BEFORE the current year's own inflation is folded in), matching the
    // engine's `cumInfl *= (1 + inf)` update happening at the END of each
    // year's loop body (mirrors `ltcInsMonthly * 12 * cumInfl` treatment).
    let expectedTotalFee = 0;
    let infl = 1;
    for (let y = 0; y < years; y++) {
      expectedTotalFee += 500 * infl;
      infl *= 1.03;
    }

    // With ret == 0 and no income/cost, the fee subtraction never compounds
    // against forgone growth — the balance gap is exactly the fee sum.
    expect(noFee.median - withFee.median).toBeCloseTo(expectedTotalFee, 6);
  });
});
