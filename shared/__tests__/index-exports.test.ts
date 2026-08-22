/**
 * Barrel-export guard for `shared/index.js` / `shared/index.d.ts`.
 *
 * `shared/index.js` re-exports each module's functions, and `shared/index.d.ts`
 * must declare them — when it doesn't, TypeScript consumers importing from
 * `@retirement/shared` (the barrel) can't see them (the gap the
 * `types(shared): declare withdrawalStrategies exports in index.d.ts`
 * commit closed for withdrawal strategies, and this file now also guards
 * for fire and spendingModels). This file imports them *with types* from
 * the barrel: the runtime assertions guard index.js, and running tsc over
 * this file guards index.d.ts (vitest itself transpiles without
 * type-checking):
 *
 *   npx tsc --ignoreConfig --noEmit --strict --module nodenext \
 *     --moduleResolution nodenext --skipLibCheck shared/__tests__/index-exports.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calcFixedPercentageWithdrawal,
  calcConstantPercentageWithdrawal,
  calcGuardrailsWithdrawal,
  calcVPWWithdrawal,
  calcBucketWithdrawal,
  calcFloorCeilingWithdrawal,
  calcCAPEWithdrawal,
  calcWithdrawal,
  VPW_DIVISORS,
  calcFIRENumber,
  calcFIREProgress,
  calcCoastFIRE,
  calcBaristaFIRE,
  calcTimeToFIRE,
  calcFIREVariants,
  calc72tSEPP,
  calcSpendingSmile,
  calcDecliningSpending,
  calcEssentialDiscretionary,
  applySpendingModel,
} from '../index.js';
import type {
  CAPEParams,
  CAPEResult,
  FIREProgress,
  FIREVariantsResult,
  ModelType,
  SpendingSmileResult,
} from '../index.js';

describe('shared barrel exports (withdrawal strategies)', () => {
  it('exports all seven strategy functions plus the dispatcher and VPW table', () => {
    expect(typeof calcFixedPercentageWithdrawal).toBe('function');
    expect(typeof calcConstantPercentageWithdrawal).toBe('function');
    expect(typeof calcGuardrailsWithdrawal).toBe('function');
    expect(typeof calcVPWWithdrawal).toBe('function');
    expect(typeof calcBucketWithdrawal).toBe('function');
    expect(typeof calcFloorCeilingWithdrawal).toBe('function');
    expect(typeof calcCAPEWithdrawal).toBe('function');
    expect(typeof calcWithdrawal).toBe('function');
    expect(typeof VPW_DIVISORS).toBe('object');
  });

  it('calcCAPEWithdrawal via the barrel matches the documented formula', () => {
    const params: CAPEParams = { currentPortfolio: 800_000, capeRatio: 25 };
    const result: CAPEResult = calcCAPEWithdrawal(params);
    expect(result.effectiveRate).toBeCloseTo(0.035, 6);
    expect(result.amount).toBeCloseTo(28_000, 2);
  });
});

describe('shared barrel exports (fire)', () => {
  it('exports all seven FIRE functions', () => {
    expect(typeof calcFIRENumber).toBe('function');
    expect(typeof calcFIREProgress).toBe('function');
    expect(typeof calcCoastFIRE).toBe('function');
    expect(typeof calcBaristaFIRE).toBe('function');
    expect(typeof calcTimeToFIRE).toBe('function');
    expect(typeof calcFIREVariants).toBe('function');
    expect(typeof calc72tSEPP).toBe('function');
  });

  it('calcFIRENumber and calcFIREProgress via the barrel match the 4% rule', () => {
    const fireNumber = calcFIRENumber(40_000);
    expect(fireNumber).toBe(1_000_000);
    const progress: FIREProgress = calcFIREProgress(500_000, fireNumber);
    expect(progress.progress).toBeCloseTo(0.5, 6);
    expect(progress.remaining).toBe(500_000);
    expect(progress.isReached).toBe(false);
    const variants: FIREVariantsResult = calcFIREVariants(40_000, 500_000);
    expect(variants.regularFIRE.number).toBe(fireNumber);
  });
});

describe('shared barrel exports (spending models)', () => {
  it('exports all four spending-model functions', () => {
    expect(typeof calcSpendingSmile).toBe('function');
    expect(typeof calcDecliningSpending).toBe('function');
    expect(typeof calcEssentialDiscretionary).toBe('function');
    expect(typeof applySpendingModel).toBe('function');
  });

  it('calcSpendingSmile and applySpendingModel via the barrel match the documented curves', () => {
    const smile: SpendingSmileResult = calcSpendingSmile(50_000, 5);
    expect(smile.phase).toBe('go-go');
    expect(smile.adjustedSpending).toBeCloseTo(50_000 * Math.pow(0.98, 5), 6);
    const level: ModelType = 'level';
    expect(applySpendingModel(level, 50_000, 5)).toBe(50_000);
  });
});
