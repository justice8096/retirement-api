/**
 * Barrel-export guard for the withdrawal-strategy surface.
 *
 * `shared/index.js` exports all seven strategy functions, and (since the
 * `types(shared): declare withdrawalStrategies exports in index.d.ts`
 * commit) `shared/index.d.ts` declares them — before that, TypeScript
 * consumers importing from `@retirement/shared` (the barrel) couldn't see
 * them. This file imports them *with types* from the barrel: the runtime
 * assertions guard index.js, and running tsc over this file guards
 * index.d.ts (vitest itself transpiles without type-checking):
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
} from '../index.js';
import type { CAPEParams, CAPEResult } from '../index.js';

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
