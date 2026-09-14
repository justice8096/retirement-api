import { describe, it, expect } from 'vitest';
import { runMonteCarlo, mulberry32, type MonteCarloParams } from '../../engine/monte-carlo.js';

/**
 * RMD / Roth-conversion pass (rmdEnabled, traditionalBalance,
 * rmdEffectiveTaxRate, rmdWithdrawalOrder, rothConversionByYear).
 *
 * All-zero rates + runs:1 + seeded RNG => deterministic arithmetic.
 * Baseline drift per year: income*12 - baseCost*12 = 24,000 - 36,000 = -12,000.
 * simStartYear 2027 so an owner born 1950 attains 77 in year 0
 * (Uniform Lifetime divisor 22.9) and 78 in year 1 (divisor 22.0).
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
    ...overrides,
  };
}

describe('RMD pass (rmdEnabled / traditionalBalance / rothConversionByYear)', () => {
  it('is a no-op when disabled, or enabled without adultBirthYears', () => {
    const baseline = runMonteCarlo(baseParams());
    const off = runMonteCarlo(baseParams({ rmdEnabled: false, adultBirthYears: [1950] }));
    const noAdults = runMonteCarlo(baseParams({ rmdEnabled: true }));
    expect(baseline.median).toBe(488_000);
    expect(off.median).toBe(baseline.median);
    expect(noAdults.median).toBe(baseline.median);
    expect(baseline.rmd).toBeUndefined();
    expect(noAdults.rmd).toBeUndefined();
  });

  it('is bit-identical to baseline under stochastic returns when no RMD or conversion fires', () => {
    const stochastic = { runs: 200, years: 20, meanReturn: 0.07, volReturn: 0.13, meanInflation: 0.025, volInflation: 0.01 };
    const a = runMonteCarlo(baseParams({ ...stochastic, seededRandom: mulberry32(7) }));
    const b = runMonteCarlo(baseParams({ ...stochastic, seededRandom: mulberry32(7), rmdEnabled: true, adultBirthYears: [1990] }));
    expect(b.results).toEqual(a.results);
    expect(b.rmd?.meanGrossByYear.every((v) => v === 0)).toBe(true);
  });

  it('taxes only the forced excess over the voluntary pre-tax draw (traditional-first)', () => {
    // RMD = 500000 / 22.9 = 21834.06; voluntary draw 12000; excess 9834.06; tax 22% = 2163.49
    const r = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1950] }));
    expect(r.median).toBeCloseTo(500_000 - 12_000 - 9_834.06 * 0.22, 0);
    expect(r.rmd?.meanGrossByYear[0]).toBeCloseTo(21_834.06, 1);
    expect(r.rmd?.meanExcessByYear[0]).toBeCloseTo(9_834.06, 1);
    expect(r.rmd?.meanTaxByYear[0]).toBeCloseTo(2_163.49, 1);
    expect(r.rmd?.meanTraditionalEndByYear[0]).toBeCloseTo(500_000 - 12_000 - 9_834.06, 1);
  });

  it('honours the effective tax rate', () => {
    const r = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1950], rmdEffectiveTaxRate: 0.10 }));
    expect(r.median).toBeCloseTo(500_000 - 12_000 - 9_834.06 * 0.10, 0);
  });

  it('other-first order funds the shortfall from non-pre-tax money so the whole RMD is forced', () => {
    // trad 300000, other 200000. Draw 12000 from other. RMD = 300000/22.9 = 13100.44 all forced; tax 2882.10
    const r = runMonteCarlo(baseParams({
      rmdEnabled: true, adultBirthYears: [1950], traditionalBalance: 300_000, rmdWithdrawalOrder: 'other-first',
    }));
    expect(r.median).toBeCloseTo(500_000 - 12_000 - 13_100.44 * 0.22, 0);
    expect(r.rmd?.meanExcessByYear[0]).toBeCloseTo(13_100.44, 1);
    expect(r.rmd?.meanTraditionalEndByYear[0]).toBeCloseTo(300_000 - 13_100.44, 1);
  });

  it('applies a Roth conversion: bucket shrinks, tax leaves the balance, capped at the bucket', () => {
    const full = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1990], rothConversionByYear: [100_000] }));
    expect(full.median).toBe(500_000 - 12_000 - 22_000);
    expect(full.rmd?.meanConversionByYear[0]).toBe(100_000);
    expect(full.rmd?.meanTraditionalEndByYear[0]).toBe(500_000 - 12_000 - 100_000);

    // Only 50000 pre-tax; 12000 voluntary draw first leaves 38000 to convert at 15%
    const capped = runMonteCarlo(baseParams({
      rmdEnabled: true, adultBirthYears: [1990], traditionalBalance: 50_000,
      rothConversionByYear: [100_000], rothConversionTaxRate: 0.15,
    }));
    expect(capped.rmd?.meanConversionByYear[0]).toBe(38_000);
    expect(capped.median).toBeCloseTo(500_000 - 12_000 - 38_000 * 0.15, 6);
    expect(capped.rmd?.meanTraditionalEndByYear[0]).toBe(0);
  });

  it('shrinks later RMDs after a conversion', () => {
    // Year 0: age 77, RMD on 500000 = 21834.06, excess 9834.06. Convert 200000.
    // trad end y0 = 500000 - 12000 - 9834.06 - 200000 = 278165.94
    // Year 1: age 78, RMD = 278165.94 / 22.0 = 12643.91; excess 643.91
    const r = runMonteCarlo(baseParams({ years: 2, rmdEnabled: true, adultBirthYears: [1950], rothConversionByYear: [200_000] }));
    expect(r.rmd?.meanGrossByYear[1]).toBeCloseTo(12_643.91, 1);
    expect(r.rmd?.meanExcessByYear[1]).toBeCloseTo(643.91, 1);
  });

  it('rolls the deceased spouse bucket to the survivor and uses the survivor age', () => {
    const common = {
      years: 2, monthlyIncome: 3_000, rmdEnabled: true,
      adultBirthYears: [1950, 1960], traditionalBalance: [0, 400_000],
    } as Partial<MonteCarloParams>;
    // Younger owner (1960, age 67) dies in year 0: bucket rolls to the 1950 owner (age 78 in year 1, divisor 22.0)
    const olderSurvives = runMonteCarlo(baseParams({
      ...common, lifeEvents: [{ kind: 'spouseDeath', year: 0, deceasedIndex: 1 }],
    }));
    expect(olderSurvives.rmd?.meanGrossByYear[0]).toBe(0);
    expect(olderSurvives.rmd?.meanGrossByYear[1]).toBeCloseTo(400_000 / 22.0, 1);
    // Older owner dies instead: survivor born 1960 is under the 75 start age, no RMD
    const youngerSurvives = runMonteCarlo(baseParams({
      ...common, lifeEvents: [{ kind: 'spouseDeath', year: 0, deceasedIndex: 0 }],
    }));
    expect(youngerSurvives.rmd?.meanGrossByYear[1]).toBe(0);
  });
});
describe('RMD pass: bracket tax mode and after-tax ending balance', () => {
  it('flat mode reports the ending balance net of 22% on the remaining pre-tax bucket', () => {
    const r = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1950] }));
    // bal 485836.51, trad end 478165.94 -> deferred 105196.51
    expect(r.rmd?.afterTax.median).toBeCloseTo(485_836.51 - 478_165.94 * 0.22, 0);
    expect(r.rmd?.afterTax.successRate).toBe(1);
  });

  it('bracket mode stacks the forced excess on voluntary draws and Social Security', () => {
    // Single filer born 1950 (age 77 in 2027, 65+ deduction 2050), SS 24000/yr (all of monthlyIncome),
    // voluntary pre-tax draw 12000, RMD excess 9834.06.
    // Base: provisional 24000 < 25000, taxable 12000 - 18150 < 0 -> 0.
    // With excess: taxable SS 4417.03, taxable 8101.09 -> 810.11 at 10%.
    const r = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1950], rmdTaxMode: 'bracket' }));
    expect(r.rmd?.meanTaxByYear[0]).toBeCloseTo(810.11, 1);
    expect(r.median).toBeCloseTo(500_000 - 12_000 - 810.11, 0);
    // Deferred: 10-year drain of 478165.94 from the final position -> 9720.03/yr -> 97200.3
    expect(r.rmd?.afterTax.median).toBeCloseTo(500_000 - 12_000 - 810.11 - 97_200.3, 0);
  });

  it('bracket mode taxes a conversion at the stacked marginal rate and leaves flat mode untouched', () => {
    // Young owner, no RMD. SS 24000, 12000 voluntary. Convert 50000 single filer under 65 (deduction 16100).
    // With: provisional 74000 -> taxable SS 20400 (cap); taxable 62000+20400-16100 = 66300
    //   -> 1240 + 4560 + 15900*0.22 = 9298. Base tax 0. Delta 9298.
    const bracket = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1990], rmdTaxMode: 'bracket', rothConversionByYear: [50_000] }));
    expect(bracket.rmd?.meanConversionTaxByYear[0]).toBeCloseTo(9_298, 0);
    const flat = runMonteCarlo(baseParams({ rmdEnabled: true, adultBirthYears: [1990], rothConversionByYear: [50_000] }));
    expect(flat.rmd?.meanConversionTaxByYear[0]).toBe(11_000);
  });

  it('switches to single-filer brackets after spouse death', () => {
    const common = {
      years: 2, monthlyIncome: 3_000, rmdEnabled: true, rmdTaxMode: 'bracket' as const,
      adultBirthYears: [1950, 1960], traditionalBalance: [0, 400_000],
      lifeEvents: [{ kind: 'spouseDeath' as const, year: 0, deceasedIndex: 1 }],
    };
    const r = runMonteCarlo(baseParams(common));
    // Year 1: survivor born 1950 (age 78), RMD 400000/22 = 18181.82 all forced, single, 65+ deduction.
    // SS 36000: provisional 18181.82 + 18000 = 36181.82 > 34000: tier1 4500 + 0.85*2181.82 = 6354.55
    // taxable 18181.82 + 6354.55 - 18150 = 6386.37 -> 638.64
    expect(r.rmd?.meanTaxByYear[1]).toBeCloseTo(638.64, 1);
  });
});