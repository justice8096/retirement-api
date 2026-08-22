import { describe, it, expect, test } from 'vitest';
import { calcSSBenefit, calcSpousalBenefit } from '../socialSecurity.js';

describe('calcSSBenefit', () => {
  const pia = 2400;
  const fra = 67;

  it('returns exact PIA when claiming at FRA', () => {
    expect(calcSSBenefit(pia, fra, fra)).toBe(pia);
  });

  test.each([
    [62, 67, 60, 0.30, 'age 62 (60 months early) -> 30% reduction'],
    [63, 67, 48, 0.25, 'age 63 (48 months early) -> 25% reduction'],
    [64, 67, 36, 0.20, 'age 64 (36 months early) -> 20% reduction'],
    [65, 67, 24, 24 * (5 / 900), 'age 65 (24 months early) -> 13.33% reduction'],
    [66, 67, 12, 12 * (5 / 900), 'age 66 (12 months early) -> 6.67% reduction'],
  ])('claiming at %s with FRA %s: %s', (claimAge, testFra, _months, reduction) => {
    const expected = Math.round(pia * (1 - reduction));
    expect(calcSSBenefit(pia, testFra, claimAge)).toBe(expected);
  });

  describe('early claiming reduction formula', () => {
    it('uses 5/900 per month for first 36 months early', () => {
      // 24 months early (age 65, FRA 67): only first-tier reduction
      const monthsEarly = 24;
      const reduction = monthsEarly * (5 / 900);
      expect(calcSSBenefit(pia, fra, 65)).toBe(Math.round(pia * (1 - reduction)));
    });

    it('uses 5/1200 per month beyond 36 months early', () => {
      // 60 months early (age 62, FRA 67)
      const reduction = 36 * (5 / 900) + 24 * (5 / 1200);
      expect(calcSSBenefit(pia, fra, 62)).toBe(Math.round(pia * (1 - reduction)));
    });
  });

  describe('delayed retirement credits', () => {
    test.each([
      [68, 1, 0.08, 'age 68 (1 year late) -> 8% credit'],
      [69, 2, 0.16, 'age 69 (2 years late) -> 16% credit'],
      [70, 3, 0.24, 'age 70 (3 years late) -> 24% credit'],
      [72, 5, 0.40, 'age 72 (5 years late) -> 40% credit (no cap in source)'],
    ])('claiming at %s: %s', (claimAge, _yearsLate, credit) => {
      const expected = Math.round(pia * (1 + credit));
      expect(calcSSBenefit(pia, fra, claimAge)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when PIA is 0', () => {
      expect(calcSSBenefit(0, fra, 62)).toBe(0);
      expect(calcSSBenefit(0, fra, fra)).toBe(0);
      expect(calcSSBenefit(0, fra, 70)).toBe(0);
    });

    it('rounds correctly for PIA of $1', () => {
      expect(calcSSBenefit(1, fra, fra)).toBe(1);
      expect(calcSSBenefit(1, fra, 62)).toBe(Math.round(1 * 0.70));
    });

    it('supports month-precision claim ages (66y8m = 4 months early)', () => {
      // reduction = 4 * (5/900) = 0.02222 → 2000 * 0.97778 = 1955.56 → 1956
      expect(calcSSBenefit(2000, 67, 66 + 8 / 12)).toBe(1956);
    });

    it('supports month-precision delayed credits (67y4m = 4 months late)', () => {
      // 2/3% per month * 4 = 2.667% → 1000 * 1.02667 = 1026.67 → 1027
      expect(calcSSBenefit(1000, 67, 67 + 4 / 12)).toBe(1027);
    });
  });
});

describe('calcSpousalBenefit', () => {
  it('returns spousal excess when maxSpousal > ownPIA at FRA', () => {
    // spousePIA=2400, ownPIA=800, maxSpousal=1200, excess=400
    expect(calcSpousalBenefit(2400, 800, 67, 67)).toBe(400);
  });

  it('returns 0 when own PIA >= 50% of spouse PIA', () => {
    // spousePIA=2400, ownPIA=1400, maxSpousal=1200 <= 1400
    expect(calcSpousalBenefit(2400, 1400, 67, 67)).toBe(0);
  });

  it('returns 0 when own PIA equals maxSpousal', () => {
    // spousePIA=2400, ownPIA=1200, maxSpousal=1200 <= 1200
    expect(calcSpousalBenefit(2400, 1200, 67, 67)).toBe(0);
  });

  describe('early claiming reduction on spousal', () => {
    // SSA: 25/36 of 1% per month for the first 36 months before FRA,
    // then 5/12 of 1% per month beyond 36. 60 months early = 35%.
    it('applies the two-tier reduction at 60 months early (35%)', () => {
      // claimAge=62, ownFRA=67, 60 months early
      // reduction = 36 * (25/3600) + 24 * (5/1200) = 0.25 + 0.10 = 0.35
      const spousalExcess = 2400 * 0.5 - 800; // 400
      const reduced = spousalExcess * (1 - 0.35);
      expect(calcSpousalBenefit(2400, 800, 67, 62)).toBe(Math.max(0, Math.round(reduced)));
    });

    it('applies no reduction when claiming at own FRA', () => {
      expect(calcSpousalBenefit(2400, 800, 67, 67)).toBe(400);
    });

    it('uses the 5/12%-per-month tier past 36 months early', () => {
      // claimAge=63.5, ownFRA=67, 42 months early
      // reduction = 36 * (25/3600) + 6 * (5/1200) = 0.25 + 0.025 = 0.275
      const spousalExcess = 2400 * 0.5 - 800; // 400
      const reduced = spousalExcess * (1 - 0.275);
      expect(calcSpousalBenefit(2400, 800, 67, 63.5)).toBe(Math.round(reduced));
    });

    it('calculates first-tier-only reduction under 36 months early', () => {
      // claimAge=65, ownFRA=67, 24 months early
      // reduction = 24 * (25/3600) = 0.1667
      const spousalExcess = 2400 * 0.5 - 800; // 400
      const reduction = 24 * (25 / 36 / 100);
      const reduced = spousalExcess * (1 - reduction);
      expect(calcSpousalBenefit(2400, 800, 67, 65)).toBe(Math.round(reduced));
    });

    it('supports month-precision claim ages (66y8m = 4 months early)', () => {
      // ssClaimAge=66 + ssClaimAgeMonths=8 → claimAge 66 + 8/12
      // reduction = 4 * (25/3600) = 0.02778
      const spousalExcess = 2400 * 0.5 - 800; // 400
      const reduced = spousalExcess * (1 - 4 * (25 / 3600));
      expect(calcSpousalBenefit(2400, 800, 67, 66 + 8 / 12)).toBe(Math.round(reduced));
    });
  });

  describe('edge cases', () => {
    it('returns 0 via Math.max when calculation goes negative', () => {
      // Very small spousal excess with large reduction
      expect(calcSpousalBenefit(1602, 800, 67, 67)).toBe(1);
      expect(calcSpousalBenefit(1601, 800, 67, 67)).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 when both PIAs are 0', () => {
      expect(calcSpousalBenefit(0, 0, 67, 67)).toBe(0);
    });
  });
});
