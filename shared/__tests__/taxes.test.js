import { describe, it, expect, test } from 'vitest';
import { calcBracketTax, calcTaxesForLocation } from '../taxes.js';

describe('calcBracketTax', () => {
  const fedBrackets = [
    { min: 0, max: 23850, rate: 0.10 },
    { min: 23850, max: 96950, rate: 0.12 },
    { min: 96950, max: 206700, rate: 0.22 },
    { min: 206700, max: 394600, rate: 0.24 },
  ];

  it('returns $0 for zero income', () => {
    expect(calcBracketTax(0, fedBrackets)).toBe(0);
  });

  it('returns $0 for empty brackets array', () => {
    expect(calcBracketTax(50000, [])).toBe(0);
  });

  it('calculates tax within first bracket only', () => {
    expect(calcBracketTax(10000, fedBrackets)).toBeCloseTo(10000 * 0.10, 2);
  });

  it('calculates tax spanning two brackets', () => {
    const expected = 23850 * 0.10 + (50000 - 23850) * 0.12;
    expect(calcBracketTax(50000, fedBrackets)).toBeCloseTo(expected, 2);
  });

  it('calculates tax spanning all four brackets', () => {
    const income = 300000;
    const expected =
      23850 * 0.10 +
      (96950 - 23850) * 0.12 +
      (206700 - 96950) * 0.22 +
      (300000 - 206700) * 0.24;
    expect(calcBracketTax(income, fedBrackets)).toBeCloseTo(expected, 2);
  });

  it('calculates correctly at exact bracket boundary', () => {
    const expected = 23850 * 0.10;
    expect(calcBracketTax(23850, fedBrackets)).toBeCloseTo(expected, 2);
  });

  it('handles income above all bracket maxes', () => {
    const income = 500000;
    const expected =
      23850 * 0.10 +
      (96950 - 23850) * 0.12 +
      (206700 - 96950) * 0.22 +
      (394600 - 206700) * 0.24;
    // Income above 394600 is not taxed (no higher bracket)
    expect(calcBracketTax(income, fedBrackets)).toBeCloseTo(expected, 2);
  });

  test.each([
    [0, 0],
    [10000, 1000],
    [23850, 2385],
    [50000, 2385 + (50000 - 23850) * 0.12],
    [96950, 2385 + (96950 - 23850) * 0.12],
  ])('income $%d -> tax $%d', (income, expectedTax) => {
    expect(calcBracketTax(income, fedBrackets)).toBeCloseTo(expectedTax, 2);
  });
});

describe('calcTaxesForLocation', () => {
  const baseLoc = {
    taxes: {
      federalIncomeTax: { standardDeduction: 30000 },
    },
  };

  it('returns null when location has no taxes', () => {
    expect(calcTaxesForLocation({}, 0, 0, 0)).toBeNull();
  });

  it('returns all zeros for zero income', () => {
    const result = calcTaxesForLocation(baseLoc, 0, 0, 0);
    expect(result.federal).toBe(0);
    expect(result.state).toBe(0);
    expect(result.socialCharges).toBe(0);
    expect(result.vehicleTax).toBe(0);
    expect(result.total).toBe(0);
    expect(result.effectiveRate).toBe(0);
  });

  it('treats 85% of SS income as taxable at federal level', () => {
    const ssIncome = 40000;
    const ssTaxable = ssIncome * 0.85; // 34000
    const fedAGI = Math.max(0, ssTaxable - 30000); // 4000
    const expectedFed = 4000 * 0.10;
    const result = calcTaxesForLocation(baseLoc, ssIncome, 0, 0);
    expect(result.federal).toBeCloseTo(expectedFed, 2);
  });

  it('uses default $30,000 standard deduction when not specified', () => {
    const loc = { taxes: {} };
    const result = calcTaxesForLocation(loc, 0, 50000, 0);
    // AGI = 50000 - 30000 = 20000
    const expectedFed = 20000 * 0.10;
    expect(result.federal).toBeCloseTo(expectedFed, 2);
  });

  it('clamps AGI to zero when deduction exceeds income', () => {
    const result = calcTaxesForLocation(baseLoc, 0, 10000, 0);
    expect(result.federal).toBe(0);
  });

  it('calculates correct total and effective rate', () => {
    const result = calcTaxesForLocation(baseLoc, 0, 80000, 0);
    // AGI = 80000 - 30000 = 50000
    const expectedFed = 23850 * 0.10 + (50000 - 23850) * 0.12;
    expect(result.federal).toBeCloseTo(expectedFed, 2);
    expect(result.total).toBeCloseTo(expectedFed, 2);
    expect(result.totalIncome).toBe(80000);
    expect(result.effectiveRate).toBeCloseTo(expectedFed / 80000, 6);
  });

  describe('state income tax', () => {
    it('handles state with brackets', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          stateIncomeTax: {
            brackets: [{ min: 0, max: 100000, rate: 0.05 }],
            deduction: 5000,
          },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 0, 50000);
      // state income = investIncome + ssTaxable (since no ssExempt) = 0 + 50000
      // stateAGI = 50000 - 5000 = 45000
      expect(result.state).toBeCloseTo(45000 * 0.05, 2);
    });

    it('excludes SS from state when ssExempt is true', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          ssExempt: true,
          stateIncomeTax: {
            brackets: [{ min: 0, max: 100000, rate: 0.05 }],
          },
        },
      };
      const result = calcTaxesForLocation(loc, 30000, 20000, 10000);
      // stateIncome = ira + invest = 30000 (SS excluded)
      expect(result.state).toBeCloseTo(30000 * 0.05, 2);
    });

    it('handles retirementExempt - only investment income taxed', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          retirementExempt: true,
          stateIncomeTax: {
            brackets: [{ min: 0, max: 100000, rate: 0.05 }],
            deduction: 2000,
          },
        },
      };
      const result = calcTaxesForLocation(loc, 20000, 30000, 15000);
      // stateAGI = max(0, investIncome - deduction) = 15000 - 2000 = 13000
      expect(result.state).toBeCloseTo(13000 * 0.05, 2);
    });

    it('handles type=none (no state income tax)', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          stateIncomeTax: { type: 'none' },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 50000, 0);
      expect(result.state).toBe(0);
      expect(result.details.some(d => d.label === 'State Income Tax')).toBe(true);
    });

    it('handles type=territorial', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          stateIncomeTax: { type: 'territorial', label: 'Panama Tax' },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 50000, 0);
      expect(result.state).toBe(0);
      expect(result.details.some(d => d.label === 'Panama Tax')).toBe(true);
    });
  });

  describe('foreign tax credit', () => {
    it('reduces federal by min(stateTax, federalTax)', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000, foreignTaxCredit: true },
          stateIncomeTax: {
            brackets: [{ min: 0, max: 200000, rate: 0.30 }],
          },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 0, 80000);
      // Federal AGI = 80000 - 30000 = 50000
      const rawFed = 23850 * 0.10 + (50000 - 23850) * 0.12;
      // State = 80000 * 0.30 = 24000
      const stateTax = 80000 * 0.30;
      const ftc = Math.min(stateTax, rawFed);
      expect(result.federal).toBeCloseTo(Math.max(0, rawFed - ftc), 2);
      expect(result.state).toBeCloseTo(stateTax, 2);
    });
  });

  describe('social charges', () => {
    it('applies social charges when defined', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          socialCharges: {
            rate: 0.066,
            name: 'CSM',
            basis: 'investment income',
          },
        },
      };
      const result = calcTaxesForLocation(loc, 20000, 30000, 10000);
      // scBase = ira + invest = 40000, no threshold
      expect(result.socialCharges).toBeCloseTo(40000 * 0.066, 2);
    });

    it('subtracts annual threshold from social charges base', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          socialCharges: {
            rate: 0.066,
            annualThreshold: 10000,
            basis: 'investment income',
          },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 30000, 10000);
      // scBase = 40000, taxable = 40000 - 10000 = 30000
      expect(result.socialCharges).toBeCloseTo(30000 * 0.066, 2);
    });
  });

  describe('vehicle tax', () => {
    it('adds vehicle tax to total', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { standardDeduction: 30000 },
          estVehicleTax: 500,
        },
      };
      const result = calcTaxesForLocation(loc, 0, 0, 0);
      expect(result.vehicleTax).toBe(500);
      expect(result.total).toBe(500);
    });
  });

  describe('return shape', () => {
    it('has correct fields', () => {
      const result = calcTaxesForLocation(baseLoc, 10000, 20000, 5000);
      expect(result).toHaveProperty('federal');
      expect(result).toHaveProperty('state');
      expect(result).toHaveProperty('socialCharges');
      expect(result).toHaveProperty('salesVat');
      expect(result).toHaveProperty('vehicleTax');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('totalIncome');
      expect(result).toHaveProperty('effectiveRate');
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('details entries have label, amount, note', () => {
      const result = calcTaxesForLocation(baseLoc, 10000, 20000, 5000);
      result.details.forEach(d => {
        expect(d).toHaveProperty('label');
        expect(d).toHaveProperty('amount');
        expect(d).toHaveProperty('note');
      });
    });
  });
});
