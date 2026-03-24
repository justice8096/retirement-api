import { describe, it, expect } from 'vitest';
import {
  getFxMultiplier,
  getInflationMultiplier,
  getInflationFxMultiplier,
  getAvgInflationMultiplier,
  getTypicalMonthly,
  getProjectedMonthly,
  projectCosts,
} from '../inflation.js';
import { CURRENT_YEAR } from '../constants.js';

// Mock location fixtures
const mockLocUSD = {
  currency: 'USD',
  monthlyCosts: {
    rent: { typical: 2000, annualInflation: 0.035 },
    groceries: { typical: 600, annualInflation: 0.03 },
    healthcare: { typical: 500, annualInflation: 0.05 },
  },
};

const mockLocEUR = {
  currency: 'EUR',
  monthlyCosts: {
    rent: { typical: 1500, annualInflation: 0.035 },
    groceries: { typical: 400, annualInflation: 0.03 },
    healthcare: { typical: 300, annualInflation: 0.05 },
  },
};

const mockLocNoInflation = {
  currency: 'USD',
  monthlyCosts: {
    rent: { typical: 1000 },
    groceries: { typical: 500 },
  },
};

describe('getFxMultiplier', () => {
  it('returns 1 for USD locations', () => {
    expect(getFxMultiplier(mockLocUSD, 5, 0.02)).toBe(1);
  });

  it('returns 1 when fxDrift is 0', () => {
    expect(getFxMultiplier(mockLocEUR, 5, 0)).toBe(1);
  });

  it('returns 1 when fxDrift is null', () => {
    expect(getFxMultiplier(mockLocEUR, 5, null)).toBe(1);
  });

  it('returns 1 when fxDrift is undefined', () => {
    expect(getFxMultiplier(mockLocEUR, 5, undefined)).toBe(1);
  });

  it('returns 1 when loc is null', () => {
    expect(getFxMultiplier(null, 5, 0.02)).toBe(1);
  });

  it('compounds fxDrift for foreign location', () => {
    const result = getFxMultiplier(mockLocEUR, 5, 0.01);
    expect(result).toBeCloseTo(Math.pow(1.01, 5), 6);
  });

  it('handles negative fxDrift (USD strengthens)', () => {
    const result = getFxMultiplier(mockLocEUR, 3, -0.02);
    expect(result).toBeCloseTo(Math.pow(0.98, 3), 6);
  });
});

describe('getInflationMultiplier', () => {
  it('returns 1 when targetYear <= CURRENT_YEAR', () => {
    expect(getInflationMultiplier(mockLocUSD, 'rent', CURRENT_YEAR)).toBe(1);
    expect(getInflationMultiplier(mockLocUSD, 'rent', CURRENT_YEAR - 1)).toBe(1);
  });

  it('returns 1 when targetYear is falsy', () => {
    expect(getInflationMultiplier(mockLocUSD, 'rent', null)).toBe(1);
    expect(getInflationMultiplier(mockLocUSD, 'rent', 0)).toBe(1);
  });

  it('uses category-specific inflation rate', () => {
    const years = 10;
    const result = getInflationMultiplier(mockLocUSD, 'rent', CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.035, years), 6);
  });

  it('uses default 0.025 when category has no annualInflation', () => {
    const years = 5;
    const result = getInflationMultiplier(mockLocNoInflation, 'rent', CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.025, years), 6);
  });

  it('uses default 0.025 when category not in monthlyCosts', () => {
    const years = 5;
    const result = getInflationMultiplier(mockLocUSD, 'nonexistent', CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.025, years), 6);
  });

  it('uses default 0.025 when loc is null', () => {
    const years = 3;
    const result = getInflationMultiplier(null, 'rent', CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.025, years), 6);
  });
});

describe('getInflationFxMultiplier', () => {
  it('returns product of inflation and FX multipliers', () => {
    const years = 5;
    const target = CURRENT_YEAR + years;
    const fxDrift = 0.01;
    const inflMult = getInflationMultiplier(mockLocEUR, 'rent', target);
    const fxMult = getFxMultiplier(mockLocEUR, years, fxDrift);
    const result = getInflationFxMultiplier(mockLocEUR, 'rent', target, fxDrift);
    expect(result).toBeCloseTo(inflMult * fxMult, 6);
  });

  it('returns just inflation multiplier for USD location', () => {
    const years = 5;
    const target = CURRENT_YEAR + years;
    const inflMult = getInflationMultiplier(mockLocUSD, 'rent', target);
    const result = getInflationFxMultiplier(mockLocUSD, 'rent', target, 0.02);
    expect(result).toBeCloseTo(inflMult, 6);
  });

  it('returns 1 when targetYear <= CURRENT_YEAR', () => {
    expect(getInflationFxMultiplier(mockLocEUR, 'rent', CURRENT_YEAR, 0.02)).toBe(1);
  });
});

describe('getAvgInflationMultiplier', () => {
  it('returns 1 when targetYear <= CURRENT_YEAR', () => {
    expect(getAvgInflationMultiplier(mockLocUSD, CURRENT_YEAR)).toBe(1);
  });

  it('averages all category inflation rates then compounds', () => {
    const years = 10;
    const avgRate = (0.035 + 0.03 + 0.05) / 3;
    const expected = Math.pow(1 + avgRate, years);
    const result = getAvgInflationMultiplier(mockLocUSD, CURRENT_YEAR + years);
    expect(result).toBeCloseTo(expected, 6);
  });

  it('uses default 0.025 when no annualInflation in any category', () => {
    const years = 5;
    const result = getAvgInflationMultiplier(mockLocNoInflation, CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.025, years), 6);
  });

  it('uses default 0.025 when loc has no monthlyCosts', () => {
    const years = 5;
    const result = getAvgInflationMultiplier({}, CURRENT_YEAR + years);
    expect(result).toBeCloseTo(Math.pow(1.025, years), 6);
  });
});

describe('getTypicalMonthly', () => {
  it('sums all typical values', () => {
    expect(getTypicalMonthly(mockLocUSD)).toBe(2000 + 600 + 500);
  });

  it('treats missing typical as 0', () => {
    const loc = {
      monthlyCosts: {
        rent: { typical: 1000 },
        groceries: {},
      },
    };
    expect(getTypicalMonthly(loc)).toBe(1000);
  });
});

describe('getProjectedMonthly', () => {
  it('returns typical monthly when targetYear <= CURRENT_YEAR', () => {
    expect(getProjectedMonthly(mockLocUSD, CURRENT_YEAR)).toBe(3100);
    expect(getProjectedMonthly(mockLocUSD, null)).toBe(3100);
  });

  it('projects each category independently for future year', () => {
    const years = 5;
    const target = CURRENT_YEAR + years;
    const expected =
      2000 * Math.pow(1.035, years) +
      600 * Math.pow(1.03, years) +
      500 * Math.pow(1.05, years);
    const result = getProjectedMonthly(mockLocUSD, target);
    expect(result).toBeCloseTo(expected, 2);
  });

  it('applies FX multiplier for foreign location', () => {
    const years = 5;
    const target = CURRENT_YEAR + years;
    const fxDrift = 0.01;
    const inflated =
      1500 * Math.pow(1.035, years) +
      400 * Math.pow(1.03, years) +
      300 * Math.pow(1.05, years);
    const expected = inflated * Math.pow(1.01, years);
    const result = getProjectedMonthly(mockLocEUR, target, fxDrift);
    expect(result).toBeCloseTo(expected, 2);
  });
});

describe('projectCosts', () => {
  it('returns empty array for zero years', () => {
    expect(projectCosts(mockLocUSD, CURRENT_YEAR, 0)).toEqual([]);
  });

  it('returns correct number of rows', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 5);
    expect(rows).toHaveLength(5);
  });

  it('year 0 uses base typical costs (no inflation)', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 1);
    const row = rows[0];
    expect(row.year).toBe(CURRENT_YEAR);
    expect(row.rent).toBeCloseTo(2000, 2);
    expect(row.groceries).toBeCloseTo(600, 2);
    expect(row.healthcare).toBeCloseTo(500, 2);
    expect(row.total).toBeCloseTo(3100, 2);
    expect(row.annual).toBeCloseTo(3100 * 12, 2);
  });

  it('year 1 inflates each category by its rate', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 2);
    const row = rows[1];
    expect(row.rent).toBeCloseTo(2000 * 1.035, 2);
    expect(row.groceries).toBeCloseTo(600 * 1.03, 2);
    expect(row.healthcare).toBeCloseTo(500 * 1.05, 2);
  });

  it('cumulative is running sum of annual values', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 3);
    let cumulative = 0;
    rows.forEach(row => {
      cumulative += row.annual;
      expect(row.cumulative).toBeCloseTo(cumulative, 2);
    });
  });

  it('includes fxMultiplier in each row', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 3);
    rows.forEach(row => {
      expect(row).toHaveProperty('fxMultiplier');
    });
  });

  it('fxMultiplier is 1 for USD location regardless of fxDrift', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 2, 0.02);
    expect(rows[0].fxMultiplier).toBe(1);
    expect(rows[1].fxMultiplier).toBe(1);
  });

  it('applies FX drift for foreign location', () => {
    const fxDrift = 0.02;
    const rows = projectCosts(mockLocEUR, CURRENT_YEAR, 3, fxDrift);
    expect(rows[0].fxMultiplier).toBeCloseTo(1, 6); // year 0: pow(1.02, 0) = 1
    expect(rows[1].fxMultiplier).toBeCloseTo(1.02, 6);
    expect(rows[2].fxMultiplier).toBeCloseTo(Math.pow(1.02, 2), 6);

    // Verify category cost includes FX
    const y1Rent = 1500 * Math.pow(1.035, 1) * Math.pow(1.02, 1);
    expect(rows[1].rent).toBeCloseTo(y1Rent, 2);
  });

  it('row shape has expected fields', () => {
    const rows = projectCosts(mockLocUSD, CURRENT_YEAR, 1);
    const row = rows[0];
    expect(row).toHaveProperty('year');
    expect(row).toHaveProperty('rent');
    expect(row).toHaveProperty('groceries');
    expect(row).toHaveProperty('healthcare');
    expect(row).toHaveProperty('total');
    expect(row).toHaveProperty('annual');
    expect(row).toHaveProperty('fxMultiplier');
    expect(row).toHaveProperty('cumulative');
  });
});
