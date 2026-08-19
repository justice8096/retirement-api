import { describe, it, expect, vi } from 'vitest';
import {
  computeAcaBridgeSavingsDraw,
  US_FPL_400_2026,
  ACA_APPLICABLE_PCT_2026,
} from '../aca-bridge.js';

// A deterministic stand-in for calcTaxesForLocation: flat 15% of the IRA
// (ordinary) income it is asked to tax. Keeps the unit tests independent of
// the real bracket engine (which has its own suite).
const flatTax = (rate = 0.15) =>
  vi.fn((_loc, _ss, ira, _invest, _opts) => ({ total: Math.round(rate * ira) }));

// Base US location: category typicals summing to $6,000/mo once the two
// healthcare keys are excluded, plus an ACA benchmark well above the cap.
function usLoc(overrides = {}) {
  return {
    country: 'United States',
    currency: 'USD',
    taxes: { federalIncomeTax: {} },
    monthlyCosts: {
      rent: { typical: 4000 },
      groceries: { typical: 1500 },
      medicalOOP: { typical: 500 },
      healthcare: { typical: 640 }, // Medicare — excluded from pre-65 base
      healthcarePreMedicare: { typical: 2150 }, // unsubsidized ACA — excluded
    },
    healthcare: {
      acaMarketplace: {
        benchmarkSilverMonthly2Adult: 2150,
        benchmarkSilverMonthlySingle: 1075,
      },
    },
    ...overrides,
  };
}

describe('constants', () => {
  it('exposes the 2026 400%-FPL ceilings and applicable percentage', () => {
    expect(US_FPL_400_2026).toEqual({ couple: 84600, single: 62600 });
    expect(ACA_APPLICABLE_PCT_2026).toBeCloseTo(0.0996, 4);
  });
});

describe('computeAcaBridgeSavingsDraw — US location', () => {
  it('computes tax-inclusive couple and single monthly draws (cap path)', () => {
    const field = computeAcaBridgeSavingsDraw(usLoc(), {
      calcTaxesForLocation: flatTax(0.15),
    });
    expect(field.applicable).toBe(true);
    // couple: base 6000 + subNet 702.18 = 6702.18/mo → 80426.16/yr
    //         netAtCeiling = 84600 - 12690 = 71910 → draw 8516.16/yr → 710/mo
    expect(field.couple).toBe(710);
    // single: base 6000 + subNet 519.58 = 6519.58/mo → 78234.96/yr
    //         netAtCeiling = 62600 - 9390 = 53210 → draw 25024.96/yr → 2085/mo
    expect(field.single).toBe(2085);
  });

  it('uses the benchmark premium when it is below the subsidy cap', () => {
    const field = computeAcaBridgeSavingsDraw(
      usLoc({
        healthcare: {
          acaMarketplace: {
            benchmarkSilverMonthly2Adult: 300, // below the ~702 cap
            benchmarkSilverMonthlySingle: 1075,
          },
        },
      }),
      { calcTaxesForLocation: flatTax(0.15) },
    );
    // couple base 6000 + 300 = 6300/mo → 75600/yr; net 71910 → 3690/yr → 308/mo
    expect(field.couple).toBe(308);
  });

  it('floors the draw at 0 when net income at the ceiling covers spending', () => {
    const field = computeAcaBridgeSavingsDraw(
      usLoc({
        monthlyCosts: {
          rent: { typical: 800 },
          groceries: { typical: 200 },
          healthcare: { typical: 640 },
          healthcarePreMedicare: { typical: 2150 },
        },
      }),
      { calcTaxesForLocation: flatTax(0.15) },
    );
    expect(field.couple).toBe(0);
    expect(field.applicable).toBe(true);
  });

  it('attaches units and meta describing the assumptions', () => {
    const field = computeAcaBridgeSavingsDraw(usLoc(), {
      calcTaxesForLocation: flatTax(0.15),
    });
    expect(field._units.couple).toMatchObject({
      encoding: 'amount',
      currency: 'USD',
      periodicity: 'month',
    });
    expect(field._meta).toMatchObject({
      ceilingCouple: 84600,
      ceilingSingle: 62600,
      applicablePct: ACA_APPLICABLE_PCT_2026,
      taxIncluded: true,
      regime: '2026-post-IRA-cliff',
    });
  });

  it('draws ceiling income as ordinary IRA at age 60 (no senior deduction)', () => {
    const tax = flatTax(0.15);
    computeAcaBridgeSavingsDraw(usLoc(), { calcTaxesForLocation: tax });
    // couple call: (loc, ss=0, ira=84600, invest=0, {filingStatus:'mfj', ages 60})
    expect(tax).toHaveBeenCalledWith(
      expect.any(Object),
      0,
      84600,
      0,
      expect.objectContaining({ filingStatus: 'mfj', primaryAge: 60, spouseAge: 60 }),
    );
    expect(tax).toHaveBeenCalledWith(
      expect.any(Object),
      0,
      62600,
      0,
      expect.objectContaining({ filingStatus: 'single', primaryAge: 60 }),
    );
  });
});

describe('computeAcaBridgeSavingsDraw — not applicable', () => {
  it('returns zeros for a non-US location without calling the tax engine', () => {
    const tax = flatTax(0.15);
    const field = computeAcaBridgeSavingsDraw(
      { country: 'Panama', currency: 'USD', monthlyCosts: { rent: { typical: 1200 } } },
      { calcTaxesForLocation: tax },
    );
    expect(field).toMatchObject({ applicable: false, couple: 0, single: 0 });
    expect(tax).not.toHaveBeenCalled();
  });

  it('returns not-applicable for a US location missing acaMarketplace data', () => {
    const field = computeAcaBridgeSavingsDraw(
      { country: 'United States', currency: 'USD', monthlyCosts: { rent: { typical: 3000 } }, healthcare: {} },
      { calcTaxesForLocation: flatTax(0.15) },
    );
    expect(field.applicable).toBe(false);
    expect(field.couple).toBe(0);
    expect(field.single).toBe(0);
  });
});
