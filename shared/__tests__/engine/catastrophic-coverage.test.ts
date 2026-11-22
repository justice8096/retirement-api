import { describe, it, expect } from 'vitest';
import {
  bandMonthlyForAge,
  catastrophicMonthly,
  medicareFallbackMonthly,
  resolveForeignHealthcare,
  validateCatastrophicCoverage,
  type CatastrophicAgeBand,
  type CatastrophicCoverage,
} from '../../engine/catastrophic-coverage.js';
import { runMonteCarlo, mulberry32, type MonteCarloParams, type LocationMove } from '../../engine/monte-carlo.js';

const BANDS: CatastrophicAgeBand[] = [
  { fromAge: 0, monthlyPerAdult: 375 },
  { fromAge: 70, monthlyPerAdult: 850 },
];

const PRICED: CatastrophicCoverage = {
  pathway: 'private-required',
  plan: 'Local private major-medical',
  coversAccident: true,
  coversCancer: true,
  priceStatus: 'priced',
  ageBands: BANDS,
  confidence: 'researched',
  asOf: '2026-11-16',
};

describe('catastrophic coverage bands', () => {
  it('picks the last band at or below the age', () => {
    expect(bandMonthlyForAge(BANDS, 62)).toBe(375);
    expect(bandMonthlyForAge(BANDS, 69)).toBe(375);
    expect(bandMonthlyForAge(BANDS, 70)).toBe(850);
    expect(bandMonthlyForAge(BANDS, 91)).toBe(850);
  });

  it('is order independent and falls back to the first band below it', () => {
    const shuffled = [BANDS[1], { fromAge: 60, monthlyPerAdult: 375 }];
    expect(bandMonthlyForAge(shuffled, 55)).toBe(375);
    expect(bandMonthlyForAge(shuffled, 72)).toBe(850);
  });

  it('sums per adult so a mixed-age couple straddles the step', () => {
    expect(catastrophicMonthly(BANDS, [63, 64])).toBe(750);
    expect(catastrophicMonthly(BANDS, [70, 69])).toBe(1225);
    expect(catastrophicMonthly(BANDS, [75, 74])).toBe(1700);
    expect(catastrophicMonthly(undefined, [75, 74])).toBe(0);
  });

  it('charges the Medicare fallback only from 65', () => {
    expect(medicareFallbackMonthly(210, [63, 64])).toBe(0);
    expect(medicareFallbackMonthly(210, [65, 64])).toBe(210);
    expect(medicareFallbackMonthly(210, [70, 69])).toBe(420);
    expect(medicareFallbackMonthly(undefined, [70, 69])).toBe(0);
  });
});

describe('resolveForeignHealthcare', () => {
  it('replaces the flat line when the pathway is priced', () => {
    const r = resolveForeignHealthcare(750, PRICED);
    expect(r.foreignHealthcareMonthly).toBe(0);
    expect(r.foreignCatastrophicAgeBands).toEqual(BANDS);
    expect(r.unpriced).toBe(false);
    expect(r.missing).toBe(false);
  });

  it('keeps the flat line for a national plan and flags unpriced or missing', () => {
    const national: CatastrophicCoverage = { ...PRICED, pathway: 'national-mandatory', priceStatus: 'in-healthcare-line', ageBands: undefined };
    expect(resolveForeignHealthcare(180, national)).toEqual({ foreignHealthcareMonthly: 180, unpriced: false, missing: false });
    const unpriced: CatastrophicCoverage = { ...PRICED, priceStatus: 'unpriced', ageBands: undefined };
    expect(resolveForeignHealthcare(120, unpriced).unpriced).toBe(true);
    expect(resolveForeignHealthcare(120, undefined).missing).toBe(true);
  });
});

describe('validateCatastrophicCoverage', () => {
  it('accepts a well-formed block', () => {
    expect(validateCatastrophicCoverage(PRICED)).toEqual([]);
  });
  it('rejects a missing block, bad pathway, and priced-without-bands', () => {
    expect(validateCatastrophicCoverage(undefined).length).toBeGreaterThan(0);
    expect(validateCatastrophicCoverage({ ...PRICED, pathway: 'none' })).toContain('invalid pathway');
    expect(validateCatastrophicCoverage({ ...PRICED, ageBands: [] })).toContain('priced coverage needs ageBands');
    expect(validateCatastrophicCoverage({ ...PRICED, pathway: 'us-aca-medicare' }).length).toBeGreaterThan(0);
  });
});

function foreignSegment(extra: Partial<LocationMove>): LocationMove {
  return {
    fromYear: 0,
    baseCost: 0,
    isForeign: true,
    isUS: false,
    nonHealthcareBase: 4_000,
    monthlyIncomeTax: 0,
    ...extra,
  };
}

function params(seg: LocationMove): MonteCarloParams {
  return {
    portfolio: 1_500_000,
    monthlyIncome: 4_000,
    baseCost: 4_000,
    isForeign: true,
    fxDrift: 0,
    runs: 300,
    years: 30,
    meanReturn: 0.05,
    volReturn: 0.10,
    meanInflation: 0.025,
    volInflation: 0.01,
    currVol: 0,
    incGrowth: 0.025,
    returnMode: 'normal',
    adultBirthYears: [1963, 1964],
    simStartYear: 2027,
    moveSchedule: [seg],
    seededRandom: mulberry32(7),
  };
}

describe('kernel: required catastrophic cover on a foreign segment', () => {
  it('age bands cost more than the same premium held flat at the entry band', () => {
    const flat = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 750 })));
    const banded = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 0, foreignCatastrophicAgeBands: BANDS })));
    expect(banded.median).toBeLessThan(flat.median);
  });

  it('bands with a single band equal the flat line exactly', () => {
    const flat = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 750 })));
    const single = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 0, foreignCatastrophicAgeBands: [{ fromAge: 0, monthlyPerAdult: 375 }] })));
    expect(single.median).toBeCloseTo(flat.median, 6);
  });

  it('the Medicare fallback lowers the outcome further', () => {
    const banded = runMonteCarlo(params(foreignSegment({ foreignCatastrophicAgeBands: BANDS })));
    const withB = runMonteCarlo(params(foreignSegment({ foreignCatastrophicAgeBands: BANDS, foreignMedicareFallbackMonthlyPerAdult: 210 })));
    expect(withB.median).toBeLessThan(banded.median);
  });

  it('segments without the new fields are unchanged', () => {
    const a = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 400 })));
    const b = runMonteCarlo(params(foreignSegment({ foreignHealthcareMonthly: 400, foreignCatastrophicAgeBands: [] })));
    expect(b.median).toBe(a.median);
  });
});