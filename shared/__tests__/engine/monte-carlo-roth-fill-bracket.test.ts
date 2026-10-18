import { describe, it, expect } from 'vitest';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '../../engine/monte-carlo.js';
import {
  ordinaryHeadroomToBracketTop,
  bracketTopTaxable,
  taxableSocialSecurity,
  ordinaryTaxDelta,
} from '../../engine/ordinary-tax.js';

/**
 * Fill-to-bracket Roth conversions (rothConversionMode: 'fill-bracket').
 *
 * Same deterministic harness as monte-carlo-rmd.test.ts: all-zero rates,
 * runs:1, seeded RNG, simStartYear 2027. Income 2000/mo is all Social
 * Security (no ssMonthlyIncome), cost 3000/mo, so the household draws
 * 12000/yr from the pre-tax bucket (traditional-first) before converting.
 *
 * Single filer under 65 (born 1990): standard deduction 16100, 12% bracket
 * tops out at 50400 taxable. With 12000 of voluntary draws and 24000 of SS,
 * the headroom to that line is 34100 (SS is 85% taxable once provisional
 * income clears 34000): 12000 + 34100 + 20400 - 16100 = 50400.
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
    simStartYear: 2027,
    seededRandom: mulberry32(1),
    rmdEnabled: true,
    adultBirthYears: [1990],
    ...overrides,
  };
}

const single1990 = { otherOrdinary: 12_000, ssAnnual: 24_000, filingStatus: 'single' as const, filers65: 0 };

describe('ordinaryHeadroomToBracketTop', () => {
  it('lands taxable income on the bracket top, including the SS torpedo', () => {
    const h = ordinaryHeadroomToBracketTop(single1990, 0.12);
    expect(h).toBeCloseTo(34_100, -1);
    const taxable = 12_000 + h + taxableSocialSecurity(24_000, 12_000 + h, 'single') - 16_100;
    expect(taxable).toBeCloseTo(bracketTopTaxable(0.12, 'single'), 0);
    // 1240 at 10% + 38000 at 12%
    expect(ordinaryTaxDelta(single1990, h)).toBeCloseTo(5_800, 0);
  });

  it('is zero when already past the target and infinite for the open top bracket', () => {
    expect(ordinaryHeadroomToBracketTop({ ...single1990, otherOrdinary: 200_000 }, 0.12)).toBe(0);
    expect(ordinaryHeadroomToBracketTop(single1990, 0.37)).toBe(Infinity);
    expect(ordinaryHeadroomToBracketTop(single1990, 0.13)).toBe(0); // not a bracket rate
  });

  it('scales the target with the index factor', () => {
    const base = ordinaryHeadroomToBracketTop(single1990, 0.12);
    const indexed = ordinaryHeadroomToBracketTop({ ...single1990, indexFactor: 1.5 }, 0.12);
    expect(indexed).toBeGreaterThan(base);
  });
});

describe('fill-bracket Roth conversions in the kernel', () => {
  it('converts exactly the headroom under the ceiling and taxes it by bracket', () => {
    const r = runMonteCarlo(baseParams({ rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12 }));
    expect(r.rmd?.meanConversionByYear[0]).toBeCloseTo(34_100, -1);
    expect(r.rmd?.meanConversionTaxByYear[0]).toBeCloseTo(5_800, 0);
    expect(r.median).toBeCloseTo(500_000 - 12_000 - 5_800, 0);
    expect(r.rmd?.meanTraditionalEndByYear[0]).toBeCloseTo(500_000 - 12_000 - 34_100, -1);
  });

  it('ignores rothConversionByYear in fill-bracket mode and is bracket-taxed even under rmdTaxMode flat', () => {
    const r = runMonteCarlo(baseParams({
      rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12,
      rothConversionByYear: [250_000], rmdTaxMode: 'flat', rothConversionTaxRate: 0.40,
    }));
    expect(r.rmd?.meanConversionByYear[0]).toBeCloseTo(34_100, -1);
    expect(r.rmd?.meanConversionTaxByYear[0]).toBeCloseTo(5_800, 0);
  });

  it('defaults to 22% ceiling and converts more under a higher ceiling', () => {
    const def = runMonteCarlo(baseParams({ rothConversionMode: 'fill-bracket' }));
    const c22 = runMonteCarlo(baseParams({ rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.22 }));
    const c12 = runMonteCarlo(baseParams({ rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12 }));
    expect(def.rmd?.meanConversionByYear[0]).toBe(c22.rmd?.meanConversionByYear[0]);
    expect(c22.rmd?.meanConversionByYear[0]).toBeGreaterThan(c12.rmd!.meanConversionByYear[0]);
  });

  it('is capped by the remaining pre-tax balance', () => {
    const r = runMonteCarlo(baseParams({
      rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12, traditionalBalance: 20_000,
    }));
    // 12000 voluntary draw first leaves 8000 to convert.
    expect(r.rmd?.meanConversionByYear[0]).toBe(8_000);
    expect(r.rmd?.meanTraditionalEndByYear[0]).toBe(0);
  });

  it('converts nothing in a year already above the ceiling', () => {
    const r = runMonteCarlo(baseParams({
      monthlyIncome: 20_000, baseCost: 3_000, rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.10,
    }));
    expect(r.rmd?.meanConversionByYear[0]).toBe(0);
    expect(r.rmd?.meanConversionTaxByYear[0]).toBe(0);
  });

  it('stops after rothConversionEndYear', () => {
    const r = runMonteCarlo(baseParams({
      years: 4, rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12, rothConversionEndYear: 1,
    }));
    const conv = r.rmd!.meanConversionByYear;
    expect(conv[0]).toBeGreaterThan(0);
    expect(conv[1]).toBeGreaterThan(0);
    expect(conv[2]).toBe(0);
    expect(conv[3]).toBe(0);
  });

  it('defaults the window to the year before the first owner reaches RMD start age', () => {
    // Born 1955: RMD start age 73 -> calendar 2028 -> sim year 1 (start 2027). Window = year 0 only.
    const r = runMonteCarlo(baseParams({
      years: 3, adultBirthYears: [1955], portfolio: 2_000_000, traditionalBalance: 2_000_000,
      rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.24,
    }));
    const conv = r.rmd!.meanConversionByYear;
    expect(conv[0]).toBeGreaterThan(0);
    expect(conv[1]).toBe(0);
    expect(conv[2]).toBe(0);
    // And the RMD fires from year 1 as before.
    expect(r.rmd!.meanGrossByYear[0]).toBe(0);
    expect(r.rmd!.meanGrossByYear[1]).toBeGreaterThan(0);
  });

  it('takes the forced RMD first, then fills only the remaining headroom on top of it', () => {
    // Owner born 1950 (age 77 in 2027, 65+ deduction 2050): RMD on 1,000,000 = 43,668.12,
    // voluntary draw 12,000, forced excess 31,668.12. Conversion sizes the headroom to the
    // 22% top AFTER that excess, so taxable income lands on 105,700 rather than above it.
    const r = runMonteCarlo(baseParams({
      adultBirthYears: [1950], portfolio: 1_000_000, traditionalBalance: 1_000_000,
      rmdTaxMode: 'bracket', rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.22,
      rothConversionEndYear: 0,
    }));
    const m = r.rmd!;
    expect(m.meanExcessByYear[0]).toBeCloseTo(31_668.12, 1);
    const other = 12_000 + 31_668.12 + m.meanConversionByYear[0];
    const taxable = other + taxableSocialSecurity(24_000, other, 'single') - 16_100 - 2_050;
    expect(taxable).toBeCloseTo(105_700, -1);
    // Conversion tax is the 22%-bracket marginal cost of the conversion alone.
    expect(m.meanConversionTaxByYear[0] / m.meanConversionByYear[0]).toBeLessThan(0.221);
  });

  it('never lets a conversion swallow the RMD when the bucket is small', () => {
    // 50,000 bucket, RMD 2,183.41 (50000/22.9), voluntary 12,000 already exceeds it: no
    // forced excess, remaining 38,000 converts. With a 15,000 bucket the 12,000 draw plus
    // the RMD excess (none: draw > RMD) leaves 3,000 to convert.
    const r = runMonteCarlo(baseParams({
      adultBirthYears: [1950], traditionalBalance: 15_000, rmdWithdrawalOrder: 'other-first',
      rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.24, rothConversionEndYear: 0,
    }));
    // other-first: nothing voluntary from pre-tax, so the whole RMD 655.02 (15000/22.9) is forced.
    const m = r.rmd!;
    expect(m.meanExcessByYear[0]).toBeCloseTo(15_000 / 22.9, 1);
    expect(m.meanConversionByYear[0]).toBeCloseTo(15_000 - 15_000 / 22.9, 1);
    expect(m.meanTraditionalEndByYear[0]).toBeCloseTo(0, 6);
  });

  it('default window skips an owner already past RMD age and ends before the younger one starts', () => {
    // 1950 is past start (73 in 2023); 1966 reaches 75 in 2041 = sim year 14. Window = 0..13.
    const r = runMonteCarlo(baseParams({
      years: 16, adultBirthYears: [1950, 1966], traditionalBalance: [1_500_000, 1_500_000],
      portfolio: 3_000_000, monthlyIncome: 3_000, rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.12,
    }));
    const conv = r.rmd!.meanConversionByYear;
    expect(conv.findLastIndex((v) => v > 0)).toBe(13);
    expect(conv[14]).toBe(0);
    expect(conv[15]).toBe(0);
  });

  it('with vs without: same seed, conversions lower the nominal balance but raise the after-tax one', () => {
    const stochastic = {
      runs: 300, years: 25, meanReturn: 0.06, volReturn: 0.12, meanInflation: 0.025, volInflation: 0.01,
      portfolio: 1_500_000, traditionalBalance: 1_500_000, monthlyIncome: 3_000, baseCost: 5_000,
      adultBirthYears: [1962], rmdTaxMode: 'bracket' as const,
    };
    const without = runMonteCarlo(baseParams({ ...stochastic, seededRandom: mulberry32(11) }));
    const withConv = runMonteCarlo(baseParams({
      ...stochastic, seededRandom: mulberry32(11), rothConversionMode: 'fill-bracket', rothConversionBracketCeiling: 0.22,
    }));
    expect(withConv.rmd!.meanConversionByYear.some((v) => v > 0)).toBe(true);
    expect(without.rmd!.meanConversionByYear.every((v) => v === 0)).toBe(true);
    // Paying tax early costs nominal balance...
    expect(withConv.median).toBeLessThan(without.median);
    // ...but the pre-tax bucket that remains to be taxed is much smaller.
    const lastY = stochastic.years - 1;
    expect(withConv.rmd!.meanTraditionalEndByYear[lastY]).toBeLessThan(without.rmd!.meanTraditionalEndByYear[lastY]);
    // Lifetime forced-RMD tax is lower with conversions.
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
    expect(sum(withConv.rmd!.meanTaxByYear)).toBeLessThan(sum(without.rmd!.meanTaxByYear));
  });
});
