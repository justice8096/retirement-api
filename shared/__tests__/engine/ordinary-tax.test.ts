import { describe, it, expect } from 'vitest';
import {
  taxableSocialSecurity, ordinaryFederalTax, ordinaryTaxDelta,
} from '../../engine/ordinary-tax.js';

describe('taxableSocialSecurity (IRC 86 tiers)', () => {
  it('is zero below the base threshold', () => {
    expect(taxableSocialSecurity(30_000, 0, 'mfj')).toBe(0);
    expect(taxableSocialSecurity(0, 100_000, 'mfj')).toBe(0);
  });
  it('taxes half of the excess in the 50% tier', () => {
    // provisional 35000: 0.5 * (35000 - 32000) = 1500
    expect(taxableSocialSecurity(30_000, 20_000, 'mfj')).toBeCloseTo(1_500, 6);
  });
  it('stacks the 85% tier and caps at 85% of benefits', () => {
    // provisional 55000: tier1 6000 + 0.85 * 11000 = 15350
    expect(taxableSocialSecurity(30_000, 40_000, 'mfj')).toBeCloseTo(15_350, 6);
    expect(taxableSocialSecurity(30_000, 200_000, 'mfj')).toBeCloseTo(25_500, 6);
  });
  it('uses the single thresholds', () => {
    // provisional 33834.06 on 24000 SS single: 0.5 * (33834.06 - 25000)
    expect(taxableSocialSecurity(24_000, 21_834.06, 'single')).toBeCloseTo(4_417.03, 2);
  });
});

describe('ordinaryFederalTax', () => {
  it('applies the standard deduction and 2026 MFJ brackets', () => {
    // taxable 100000 - 32200 = 67800: 24800 * 0.10 + 43000 * 0.12
    expect(ordinaryFederalTax({ otherOrdinary: 100_000, ssAnnual: 0, filingStatus: 'mfj', filers65: 0 })).toBeCloseTo(7_640, 6);
  });
  it('adds the 65+ additional standard deduction per filer', () => {
    // deduction 32200 + 2 * 1650 = 35500: taxable 64500
    expect(ordinaryFederalTax({ otherOrdinary: 100_000, ssAnnual: 0, filingStatus: 'mfj', filers65: 2 })).toBeCloseTo(7_244, 6);
  });
  it('indexes brackets and deductions by indexFactor', () => {
    expect(ordinaryFederalTax({ otherOrdinary: 200_000, ssAnnual: 0, filingStatus: 'mfj', filers65: 0, indexFactor: 2 })).toBeCloseTo(15_280, 6);
  });
});

describe('ordinaryTaxDelta', () => {
  it('captures the SS tax torpedo: extra IRA income drags SS into taxable income', () => {
    const base = { otherOrdinary: 0, ssAnnual: 60_000, filingStatus: 'mfj' as const, filers65: 2 };
    expect(ordinaryFederalTax(base)).toBe(0);
    // with 100000 extra: taxable SS 51000 (cap), taxable 115500 -> 2480 + 9120 + 3234
    expect(ordinaryTaxDelta(base, 100_000)).toBeCloseTo(14_834, 6);
  });
  it('returns 0 for non-positive extra', () => {
    const base = { otherOrdinary: 50_000, ssAnnual: 0, filingStatus: 'single' as const, filers65: 0 };
    expect(ordinaryTaxDelta(base, 0)).toBe(0);
    expect(ordinaryTaxDelta(base, -5)).toBe(0);
  });
});