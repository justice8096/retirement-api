import { describe, it, expect, test } from 'vitest';
import {
  getRMDStartAge,
  getDistributionPeriod,
  calcRMD,
  calcCoupleRMD,
  RMD_PENALTY_RATE,
  RMD_PENALTY_RATE_CORRECTED,
} from '../rmd.js';

describe('getRMDStartAge', () => {
  test.each([
    [1945, 72, 'born 1945 (<=1950) -> age 72'],
    [1950, 72, 'born 1950 (<=1950) -> age 72'],
    [1951, 73, 'born 1951 (1951-1959) -> age 73'],
    [1955, 73, 'born 1955 (1951-1959) -> age 73'],
    [1959, 73, 'born 1959 (1951-1959) -> age 73'],
    [1960, 75, 'born 1960 (>=1960) -> age 75'],
    [1966, 75, 'born 1966 (>=1960) -> age 75'],
    [1970, 75, 'born 1970 (>=1960) -> age 75'],
    [2000, 75, 'born 2000 (>=1960) -> age 75'],
  ])('birthYear %d -> %d: %s', (birthYear, expected) => {
    expect(getRMDStartAge(birthYear)).toBe(expected);
  });
});

describe('getDistributionPeriod', () => {
  it('returns 0 for age < 72', () => {
    expect(getDistributionPeriod(60)).toBe(0);
    expect(getDistributionPeriod(71)).toBe(0);
  });

  test.each([
    [72, 27.4],
    [73, 26.5],
    [75, 24.6],
    [80, 20.2],
    [85, 16.0],
    [90, 12.2],
    [95, 8.9],
    [100, 6.4],
    [110, 3.5],
    [115, 2.9],
    [120, 2.0],
  ])('age %d -> divisor %f', (age, expected) => {
    expect(getDistributionPeriod(age)).toBe(expected);
  });

  it('returns 2.0 for age > 120', () => {
    expect(getDistributionPeriod(121)).toBe(2.0);
    expect(getDistributionPeriod(130)).toBe(2.0);
  });
});

describe('calcRMD', () => {
  it('returns not required when age < start age', () => {
    const result = calcRMD(500000, 70, 1960);
    expect(result.rmd).toBe(0);
    expect(result.required).toBe(false);
    expect(result.startAge).toBe(75);
  });

  it('returns not required when balance <= 0', () => {
    const result = calcRMD(0, 75, 1960);
    expect(result.rmd).toBe(0);
    expect(result.required).toBe(false);
  });

  it('returns not required for negative balance', () => {
    const result = calcRMD(-10000, 75, 1960);
    expect(result.rmd).toBe(0);
    expect(result.required).toBe(false);
  });

  it('calculates RMD at start age for born 1960+', () => {
    const balance = 1000000;
    const result = calcRMD(balance, 75, 1960);
    expect(result.required).toBe(true);
    expect(result.divisor).toBe(24.6);
    expect(result.rmd).toBeCloseTo(balance / 24.6, 2);
    expect(result.startAge).toBe(75);
  });

  it('calculates RMD at start age for born 1951-1959', () => {
    const balance = 500000;
    const result = calcRMD(balance, 73, 1955);
    expect(result.required).toBe(true);
    expect(result.divisor).toBe(26.5);
    expect(result.rmd).toBeCloseTo(balance / 26.5, 2);
  });

  it('calculates large balance RMD', () => {
    const balance = 10000000;
    const result = calcRMD(balance, 75, 1960);
    expect(result.rmd).toBeCloseTo(balance / 24.6, 2);
  });

  it('return shape includes rmd, divisor, required, startAge', () => {
    const result = calcRMD(500000, 75, 1960);
    expect(result).toHaveProperty('rmd');
    expect(result).toHaveProperty('divisor');
    expect(result).toHaveProperty('required');
    expect(result).toHaveProperty('startAge');
  });
});

describe('calcCoupleRMD', () => {
  it('uses older spouse when both alive (husband older)', () => {
    const result = calcCoupleRMD(1000000, 78, 75, 1955, 1958, true, true);
    expect(result.rmdAge).toBe(78);
    expect(result.divisor).toBe(22.0);
    expect(result.rmd).toBeCloseTo(1000000 / 22.0, 2);
  });

  it('uses older spouse when both alive (wife older)', () => {
    const result = calcCoupleRMD(1000000, 73, 76, 1958, 1955, true, true);
    expect(result.rmdAge).toBe(76);
    expect(result.divisor).toBe(23.7);
    expect(result.rmd).toBeCloseTo(1000000 / 23.7, 2);
  });

  it('uses husband when only husband alive', () => {
    const result = calcCoupleRMD(1000000, 78, 75, 1955, 1958, true, false);
    expect(result.rmdAge).toBe(78);
  });

  it('uses wife when only wife alive', () => {
    const result = calcCoupleRMD(1000000, 78, 76, 1955, 1955, false, true);
    expect(result.rmdAge).toBe(76);
  });

  it('returns zero when neither alive', () => {
    const result = calcCoupleRMD(1000000, 78, 76, 1955, 1955, false, false);
    expect(result.rmd).toBe(0);
    expect(result.required).toBe(false);
  });

  it('returns zero when balance is zero', () => {
    const result = calcCoupleRMD(0, 78, 76, 1955, 1955, true, true);
    expect(result.rmd).toBe(0);
    expect(result.required).toBe(false);
  });

  it('return shape includes rmdAge field', () => {
    const result = calcCoupleRMD(1000000, 78, 75, 1955, 1958, true, true);
    expect(result).toHaveProperty('rmdAge');
  });
});

describe('RMD penalty constants', () => {
  it('RMD_PENALTY_RATE is 0.25', () => {
    expect(RMD_PENALTY_RATE).toBe(0.25);
  });

  it('RMD_PENALTY_RATE_CORRECTED is 0.10', () => {
    expect(RMD_PENALTY_RATE_CORRECTED).toBe(0.10);
  });
});
