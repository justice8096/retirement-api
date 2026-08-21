/**
 * Withdrawal Strategies Tests — calcCAPEWithdrawal
 *
 * `calcCAPEWithdrawal` was ported into this canonical package from the
 * retired React app's divergent copy of this file
 * (`retirement-dashboard/shared/withdrawalStrategies.js`) — A4 parity port
 * #10 completeness. This file covers only that newly-ported function;
 * the other six strategies (`calcFixedPercentageWithdrawal`,
 * `calcConstantPercentageWithdrawal`, `calcGuardrailsWithdrawal`,
 * `calcVPWWithdrawal`, `calcBucketWithdrawal`, `calcFloorCeilingWithdrawal`)
 * had no dedicated test file in this package before this port either, and
 * remain out of scope here.
 *
 * Reference values below are hand-computed from the function's own
 * documented formula: rawRate = (1/capeRatio) * capeMultiplier +
 * fixedComponent, clamped to [floorRate, ceilingRate]; amount =
 * currentPortfolio * clampedRate. Defaults: capeMultiplier=0.5,
 * fixedComponent=0.015, floorRate=0.02, ceilingRate=0.06.
 */
import { describe, it, expect } from 'vitest';
import { calcCAPEWithdrawal, calcWithdrawal } from '../withdrawalStrategies.js';

describe('calcCAPEWithdrawal', () => {
  it('year-1 fixture: CAPE=25 (near-average market) produces an unclamped rate', () => {
    // rawRate = (1/25)*0.5 + 0.015 = 0.04*0.5 + 0.015 = 0.02 + 0.015 = 0.035
    // amount = 800,000 * 0.035 = 28,000
    const result = calcCAPEWithdrawal({ currentPortfolio: 800_000, capeRatio: 25 });

    expect(result.rawRate).toBeCloseTo(0.035, 6);
    expect(result.effectiveRate).toBeCloseTo(0.035, 6);
    expect(result.amount).toBeCloseTo(28_000, 2);
    expect(result.clamped).toBe(false);
  });

  it('clamps to the 6% ceiling when a low CAPE ratio implies a higher raw rate', () => {
    // rawRate = (1/8)*0.5 + 0.015 = 0.0625 + 0.015 = 0.0775 -> clamped to ceiling 0.06
    const result = calcCAPEWithdrawal({ currentPortfolio: 500_000, capeRatio: 8 });

    expect(result.rawRate).toBeCloseTo(0.0775, 6);
    expect(result.effectiveRate).toBeCloseTo(0.06, 6);
    expect(result.amount).toBeCloseTo(30_000, 2);
    expect(result.clamped).toBe(true);
  });

  it('clamps to the 2% floor when a high CAPE ratio implies a lower raw rate', () => {
    // rawRate = (1/150)*0.5 + 0.015 = 0.0033333... + 0.015 = 0.0183333... -> clamped to floor 0.02
    const result = calcCAPEWithdrawal({ currentPortfolio: 1_000_000, capeRatio: 150 });

    expect(result.rawRate).toBeCloseTo(0.018333, 6);
    expect(result.effectiveRate).toBeCloseTo(0.02, 6);
    expect(result.amount).toBeCloseTo(20_000, 2);
    expect(result.clamped).toBe(true);
  });

  it('honors custom capeMultiplier/fixedComponent/floorRate/ceilingRate knobs', () => {
    // rawRate = (1/20)*0.8 + 0.01 = 0.04 + 0.01 = 0.05 -> within custom [0.01, 0.10] band
    const result = calcCAPEWithdrawal({
      currentPortfolio: 400_000,
      capeRatio: 20,
      capeMultiplier: 0.8,
      fixedComponent: 0.01,
      floorRate: 0.01,
      ceilingRate: 0.10,
    });

    expect(result.rawRate).toBeCloseTo(0.05, 6);
    expect(result.effectiveRate).toBeCloseTo(0.05, 6);
    expect(result.amount).toBeCloseTo(20_000, 2);
    expect(result.clamped).toBe(false);
  });

  it('documented fallback: returns all-zero, unclamped result when currentPortfolio is absent/zero', () => {
    expect(calcCAPEWithdrawal({ currentPortfolio: 0, capeRatio: 25 })).toEqual({
      amount: 0,
      effectiveRate: 0,
      rawRate: 0,
      clamped: false,
    });
    expect(calcCAPEWithdrawal({ capeRatio: 25 })).toEqual({
      amount: 0,
      effectiveRate: 0,
      rawRate: 0,
      clamped: false,
    });
  });

  it('documented fallback: returns all-zero, unclamped result when capeRatio is absent/zero', () => {
    expect(calcCAPEWithdrawal({ currentPortfolio: 1_000_000, capeRatio: 0 })).toEqual({
      amount: 0,
      effectiveRate: 0,
      rawRate: 0,
      clamped: false,
    });
    expect(calcCAPEWithdrawal({ currentPortfolio: 1_000_000 })).toEqual({
      amount: 0,
      effectiveRate: 0,
      rawRate: 0,
      clamped: false,
    });
  });

  it('negative currentPortfolio or capeRatio also falls back to the zero result', () => {
    expect(calcCAPEWithdrawal({ currentPortfolio: -1, capeRatio: 25 }).amount).toBe(0);
    expect(calcCAPEWithdrawal({ currentPortfolio: 1_000_000, capeRatio: -5 }).amount).toBe(0);
  });
});

describe('calcWithdrawal dispatcher — cape case', () => {
  it('routes strategyType "cape" to calcCAPEWithdrawal', () => {
    const direct = calcCAPEWithdrawal({ currentPortfolio: 800_000, capeRatio: 25 });
    const viaDispatcher = calcWithdrawal('cape', { currentPortfolio: 800_000, capeRatio: 25 });
    expect(viaDispatcher).toEqual(direct);
  });

  it('still throws for an unknown strategy, and the error message now lists cape', () => {
    expect(() => calcWithdrawal('not-a-real-strategy', {})).toThrowError(/cape/);
  });
});
