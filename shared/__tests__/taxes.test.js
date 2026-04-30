import { describe, it, expect, test } from 'vitest';
import {
  calcBracketTax,
  calcTaxesForLocation,
  obbbaSeniorDeduction,
  FED_STD_DEDUCTION_2026,
  FED_BRACKETS_2026_MFJ,
  LTCG_BRACKETS_2026,
  NIIT_THRESHOLDS,
  NIIT_RATE,
  ltcgFederalTax,
  ltcgZeroBracketHeadroom,
  ltcgHarvestingSummary,
  niit,
} from '../taxes.js';

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

  it('uses 2026 MFJ default standard deduction ($32,200) when not specified', () => {
    const loc = { taxes: {} };
    const result = calcTaxesForLocation(loc, 0, 50000, 0);
    // AGI = 50000 - 32200 = 17800 (2026 MFJ std deduction per Rev Proc 2025-32)
    const expectedFed = 17800 * 0.10;
    expect(result.federal).toBeCloseTo(expectedFed, 2);
  });

  it('clamps AGI to zero when deduction exceeds income', () => {
    const result = calcTaxesForLocation(baseLoc, 0, 10000, 0);
    expect(result.federal).toBe(0);
  });

  it('calculates correct total and effective rate (2026 MFJ brackets)', () => {
    const result = calcTaxesForLocation(baseLoc, 0, 80000, 0);
    // baseLoc has standardDeduction: 30000 (explicit override).
    // AGI = 80000 - 30000 = 50000
    // 2026 MFJ brackets: 10% on first $24,800; 12% above.
    const expectedFed = 24800 * 0.10 + (50000 - 24800) * 0.12;
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

describe('2026 federal constants', () => {
  it('exposes 2026 MFJ standard deduction per Rev Proc 2025-32', () => {
    expect(FED_STD_DEDUCTION_2026.mfj).toBe(32200);
    expect(FED_STD_DEDUCTION_2026.single).toBe(16100);
    expect(FED_STD_DEDUCTION_2026.hoh).toBe(24150);
  });

  it('exposes 2026 MFJ bracket cutoffs per Rev Proc 2025-32', () => {
    expect(FED_BRACKETS_2026_MFJ[1].min).toBe(24800);   // 10/12 boundary
    expect(FED_BRACKETS_2026_MFJ[2].min).toBe(100800);  // 12/22
    expect(FED_BRACKETS_2026_MFJ[3].min).toBe(211400);  // 22/24
    expect(FED_BRACKETS_2026_MFJ[4].min).toBe(403550);  // 24/32
  });
});

describe('obbbaSeniorDeduction', () => {
  // OBBBA § 13301 — $6,000/yr for age 65+, tax years 2025-2028.
  // Phase-out: MFJ $150k–$250k; Single/HoH $75k–$175k.

  it('returns 0 for under-65', () => {
    expect(obbbaSeniorDeduction('mfj', 64, 100000)).toBe(0);
    expect(obbbaSeniorDeduction('mfj', undefined, 100000)).toBe(0);
  });

  it('returns the full $6,000 below the MFJ phase-out start', () => {
    expect(obbbaSeniorDeduction('mfj', 65, 150000)).toBe(6000);
    expect(obbbaSeniorDeduction('mfj', 70, 100000)).toBe(6000);
  });

  it('returns 0 at or above the MFJ phase-out end', () => {
    expect(obbbaSeniorDeduction('mfj', 65, 250000)).toBe(0);
    expect(obbbaSeniorDeduction('mfj', 70, 300000)).toBe(0);
  });

  it('phases linearly across the MFJ $150k-$250k band', () => {
    // Half-way: $200k MAGI → $3,000 remaining.
    expect(obbbaSeniorDeduction('mfj', 65, 200000)).toBe(3000);
  });

  it('uses the single/HoH band when filing status is single', () => {
    expect(obbbaSeniorDeduction('single', 65, 75000)).toBe(6000);
    expect(obbbaSeniorDeduction('single', 65, 125000)).toBe(3000);
    expect(obbbaSeniorDeduction('single', 65, 175000)).toBe(0);
  });

  it('is applied via calcTaxesForLocation when primaryAge >= 65', () => {
    const loc = { taxes: { federalIncomeTax: { standardDeduction: 30000 } } };
    // Both spouses 65+; MAGI 80k (below phase-out); $12k extra deduction.
    const with65 = calcTaxesForLocation(loc, 0, 80000, 0, {
      filingStatus: 'mfj', primaryAge: 70, spouseAge: 68,
    });
    const without = calcTaxesForLocation(loc, 0, 80000, 0, {
      filingStatus: 'mfj', primaryAge: 60, spouseAge: 58,
    });
    expect(with65.federal).toBeLessThan(without.federal);
    // Exact amount check: 2 × $6,000 = $12,000 additional deduction.
    // Income ($80k) - std deduction ($30k) = $50k AGI, which sits in the
    // 12% bracket. Reducing AGI by $12k keeps it in the 12% bracket, so
    // the savings are $12,000 × 12% = $1,440.
    expect(without.federal - with65.federal).toBeCloseTo(1440, 2);
  });
});

describe('LTCG_BRACKETS_2026', () => {
  it('matches Rev Proc 2025-32 thresholds for all 4 filing statuses', () => {
    expect(LTCG_BRACKETS_2026.single).toEqual({ zeroTop:  49450, fifteenTop: 545500 });
    expect(LTCG_BRACKETS_2026.mfj   ).toEqual({ zeroTop:  98900, fifteenTop: 613700 });
    expect(LTCG_BRACKETS_2026.mfs   ).toEqual({ zeroTop:  49450, fifteenTop: 306850 });
    expect(LTCG_BRACKETS_2026.hoh   ).toEqual({ zeroTop:  66200, fifteenTop: 579600 });
  });
});

describe('ltcgFederalTax', () => {
  it('returns 0 for non-positive LTCG', () => {
    expect(ltcgFederalTax(0, 80000, 'mfj')).toBe(0);
    expect(ltcgFederalTax(-100, 80000, 'mfj')).toBe(0);
  });

  it('all 0% when ordinary + LTCG fits in the 0% bracket', () => {
    // MFJ 0% top is $98,900. Ordinary $50k + LTCG $40k = $90k < $98.9k.
    expect(ltcgFederalTax(40000, 50000, 'mfj')).toBe(0);
  });

  it('all 15% when ordinary already exceeds 0% top and combined fits 15% top', () => {
    // MFJ: ordinary $120k > $98.9k → no 0% room. Combined $120k + $30k = $150k < $613.7k.
    // All $30k of LTCG taxed at 15% = $4,500.
    expect(ltcgFederalTax(30000, 120000, 'mfj')).toBeCloseTo(4500, 2);
  });

  it('split 0% / 15% when ordinary is below the 0% top but combined exceeds it', () => {
    // MFJ: ordinary $80k. 0% top $98.9k → first $18.9k of LTCG at 0%.
    // Remaining $11.1k at 15% = $1,665.
    expect(ltcgFederalTax(30000, 80000, 'mfj')).toBeCloseTo(1665, 2);
  });

  it('all 20% when ordinary already exceeds the 15% top', () => {
    // MFJ: ordinary $700k > $613.7k → all LTCG at 20%.
    // $50k × 0.20 = $10,000.
    expect(ltcgFederalTax(50000, 700000, 'mfj')).toBeCloseTo(10000, 2);
  });

  it('split 15% / 20% when ordinary is in the 15% range but combined exceeds 20% threshold', () => {
    // MFJ: ordinary $500k (above 0% top $98.9k, below 15% top $613.7k).
    // LTCG $200k stacks → combined $700k > $613.7k.
    // Dollars at 15%: from $500k up to $613.7k = $113.7k.
    // Dollars at 20%: $200k − $113.7k = $86.3k.
    // Tax = 113700 * 0.15 + 86300 * 0.20 = 17055 + 17260 = $34,315.
    expect(ltcgFederalTax(200000, 500000, 'mfj')).toBeCloseTo(34315, 2);
  });

  it('three-way split 0% / 15% / 20% when LTCG straddles all three brackets', () => {
    // MFJ: ordinary $80k (below 0% top $98.9k). LTCG $700k stacks.
    // 0% portion: $98.9k − $80k = $18.9k (taxed at 0%).
    // 20% portion: combined $780k − $613.7k = $166.3k (taxed at 20%).
    // 15% portion: $700k − $18.9k − $166.3k = $514.8k (taxed at 15%).
    // Tax = 514800 * 0.15 + 166300 * 0.20 = 77220 + 33260 = $110,480.
    expect(ltcgFederalTax(700000, 80000, 'mfj')).toBeCloseTo(110480, 2);
  });

  it('respects single filing status thresholds (lower than MFJ)', () => {
    // Single 0% top is $49,450. Ordinary $40k → first $9.45k of LTCG at 0%.
    // LTCG $20k → remaining $10.55k at 15% = $1,582.50.
    expect(ltcgFederalTax(20000, 40000, 'single')).toBeCloseTo(1582.5, 2);
  });

  it('treats negative ordinary income as 0 for bracket purposes', () => {
    // Carry-forward losses can produce negative taxable ordinary income;
    // for LTCG bracket placement we floor at 0 so all LTCG sees the full
    // 0% bracket headroom.
    expect(ltcgFederalTax(50000, -10000, 'mfj')).toBe(0); // $50k < $98.9k zeroTop
  });

  it('falls back to MFJ when filing status is unknown', () => {
    expect(ltcgFederalTax(30000, 120000, 'bogus')).toBeCloseTo(4500, 2);
  });
});

describe('NIIT_THRESHOLDS / niit', () => {
  it('matches statutory unindexed thresholds', () => {
    expect(NIIT_THRESHOLDS).toEqual({
      single: 200000,
      mfj:    250000,
      mfs:    125000,
      hoh:    200000,
    });
    expect(NIIT_RATE).toBe(0.038);
  });

  it('returns 0 when MAGI is at or below threshold', () => {
    expect(niit(50000, 250000, 'mfj')).toBe(0);
    expect(niit(50000, 100000, 'mfj')).toBe(0);
  });

  it('returns 0 for non-positive net investment income', () => {
    expect(niit(0,  300000, 'mfj')).toBe(0);
    expect(niit(-1, 300000, 'mfj')).toBe(0);
  });

  it('taxes the lesser of net investment income or MAGI excess', () => {
    // MFJ threshold $250k. MAGI $300k → excess $50k.
    // Net investment income $30k < $50k → tax $30k × 3.8% = $1,140.
    expect(niit(30000, 300000, 'mfj')).toBeCloseTo(1140, 2);

    // Net investment income $80k > $50k excess → tax $50k × 3.8% = $1,900.
    expect(niit(80000, 300000, 'mfj')).toBeCloseTo(1900, 2);
  });

  it('uses single threshold ($200k) for single filers', () => {
    // MAGI $250k single → excess $50k. Net investment $30k → tax $1,140.
    expect(niit(30000, 250000, 'single')).toBeCloseTo(1140, 2);
    // MAGI $200k single → at threshold, no tax.
    expect(niit(30000, 200000, 'single')).toBe(0);
  });

  it('uses MFS threshold ($125k)', () => {
    // MFS half of MFJ. MAGI $200k MFS → excess $75k. Net investment $40k → tax $1,520.
    expect(niit(40000, 200000, 'mfs')).toBeCloseTo(1520, 2);
  });

  it('falls back to MFJ when filing status is unknown', () => {
    expect(niit(30000, 300000, 'bogus')).toBeCloseTo(1140, 2);
  });
});

describe('calcTaxesForLocation — investComposition routing (#33 item 2)', () => {
  // Plain US-federal-only location for isolating the federal pipeline.
  const usFedOnly = { taxes: { federalIncomeTax: {} } };

  it('omitting investComposition matches pre-#33 behavior (back-compat)', () => {
    // 50k IRA + 20k investIncome + no SS, MFJ, both under 65
    const before = calcTaxesForLocation(usFedOnly, 0, 50000, 20000, {
      filingStatus: 'mfj',
    });
    // Same household passing investComposition with the entire amount
    // tagged as ordinary interest should produce the SAME federal tax.
    const after = calcTaxesForLocation(usFedOnly, 0, 50000, 20000, {
      filingStatus: 'mfj',
      investComposition: { ordinaryInterest: 20000 },
    });
    expect(after.federal).toBeCloseTo(before.federal, 2);
    expect(after.totalIncome).toBeCloseTo(before.totalIncome, 2);
  });

  it('all-LTCG composition routes through 0% bracket below threshold', () => {
    // MFJ, 0% LTCG bracket top is $98,900. 50k IRA + 30k LTCG.
    // Ordinary AGI = 50k − 32.2k = $17,800 (well under 98.9k).
    // LTCG sits on top: ordinaryFedTax on $17,800 + LTCG taxed at 0% on
    // the entire $30k (since $17,800 + $30,000 = $47,800 < $98,900).
    const result = calcTaxesForLocation(usFedOnly, 0, 50000, 30000, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 30000 },
    });
    const ordinaryAGI = 50000 - 32200; // $17,800
    const expectedOrdFed = ordinaryAGI * 0.10; // entirely in 10% bracket
    expect(result.federal).toBeCloseTo(expectedOrdFed, 2);
    // Detail row for LTCG should NOT appear (LTCG tax = 0)
    expect(result.details.some(d => d.label === 'US Federal LTCG / QDI Tax')).toBe(false);
  });

  it('split 0%/15% LTCG when ordinary AGI is below 0% top but stack exceeds it', () => {
    // MFJ, IRA $90k. Ordinary AGI = 90k − 32.2k = $57,800.
    // LTCG $80k stacks on top → combined $137,800. 0% top is $98,900.
    // First $98.9k − $57.8k = $41,100 of LTCG at 0%.
    // Remaining $80k − $41.1k = $38,900 at 15% = $5,835.
    const result = calcTaxesForLocation(usFedOnly, 0, 90000, 80000, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 80000 },
    });
    const ordinaryAGI = 90000 - 32200;
    // Ordinary fed tax on $57,800: 24800*0.10 + (57800-24800)*0.12
    const expectedOrdFed = 24800 * 0.10 + (ordinaryAGI - 24800) * 0.12;
    const expectedLtcg = 38900 * 0.15;
    expect(result.federal).toBeCloseTo(expectedOrdFed + expectedLtcg, 2);
    expect(result.details.some(d => d.label === 'US Federal LTCG / QDI Tax')).toBe(true);
  });

  it('mixed composition: ordinary interest + STCG taxed as ordinary, LTCG/QDI preferential', () => {
    // 40k IRA + 10k ordinary interest + 5k STCG + 8k QDI + 12k LTCG
    // Ordinary base = 40k + 10k + 5k = $55k. AGI = 55k − 32.2k = $22.8k.
    // Preferential = 8k + 12k = $20k.
    // AGI $22.8k < 0% top $98.9k, AGI + preferential = $42.8k < $98.9k →
    //   all $20k preferential at 0%.
    const result = calcTaxesForLocation(usFedOnly, 0, 40000, 35000, {
      filingStatus: 'mfj',
      investComposition: { ordinaryInterest: 10000, stcg: 5000, qdi: 8000, ltcg: 12000 },
    });
    const expectedOrdFed = 22800 * 0.10;
    expect(result.federal).toBeCloseTo(expectedOrdFed, 2); // LTCG = 0, NIIT = 0
  });

  it('NIIT applies above MAGI threshold', () => {
    // MFJ NIIT threshold $250k. Construct: IRA $250k + LTCG $50k.
    // MAGI ≈ ordinary federalTaxable ($250k) + LTCG ($50k) = $300k.
    // Excess $50k. NII $50k. NIIT = min(50k, 50k) * 3.8% = $1,900.
    const result = calcTaxesForLocation(usFedOnly, 0, 250000, 50000, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 50000 },
    });
    expect(result.details.some(d => d.label === 'US Net Investment Income Tax (NIIT)')).toBe(true);
    const niitDetail = result.details.find(d => d.label === 'US Net Investment Income Tax (NIIT)');
    expect(niitDetail.amount).toBeCloseTo(1900, 2);
  });

  it('NIIT does NOT apply below MAGI threshold', () => {
    // MAGI $150k MFJ < $250k → no NIIT, even with $50k investment income.
    const result = calcTaxesForLocation(usFedOnly, 0, 100000, 50000, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 50000 },
    });
    expect(result.details.some(d => d.label === 'US Net Investment Income Tax (NIIT)')).toBe(false);
  });

  it('seed-data fed-bracket override skips LTCG and NIIT (territorial systems etc.)', () => {
    // Some locations encode their own federal regime. Don't double-tax
    // by also applying LTCG/NIIT — those are US-federal-specific.
    const territorial = {
      taxes: {
        federalIncomeTax: { brackets: [{ min: 0, max: null, rate: 0.0 }] },
      },
    };
    const result = calcTaxesForLocation(territorial, 0, 100000, 200000, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 200000 },
    });
    expect(result.federal).toBe(0);
    expect(result.details.some(d => d.label === 'US Federal LTCG / QDI Tax')).toBe(false);
    expect(result.details.some(d => d.label === 'US Net Investment Income Tax (NIIT)')).toBe(false);
  });

  it('investIncome param is ignored when composition is provided (composition is authoritative)', () => {
    // Pass investIncome=99999 but composition with $30k → final totalInvest
    // should be $30k. Use this to confirm the composition wins.
    const r1 = calcTaxesForLocation(usFedOnly, 0, 50000, 99999, {
      filingStatus: 'mfj',
      investComposition: { ordinaryInterest: 30000 },
    });
    const r2 = calcTaxesForLocation(usFedOnly, 0, 50000, 30000, {
      filingStatus: 'mfj',
      investComposition: { ordinaryInterest: 30000 },
    });
    expect(r1.federal).toBeCloseTo(r2.federal, 2);
    expect(r1.totalIncome).toBeCloseTo(r2.totalIncome, 2);
  });

  it('state pipeline uses composition total (not the bogus investIncome param)', () => {
    const stateLoc = {
      taxes: {
        federalIncomeTax: {},
        stateIncomeTax: {
          label: 'Test State',
          brackets: [{ min: 0, max: null, rate: 0.05 }],
        },
      },
    };
    // Pass investIncome=99999 but composition $20k LTCG. State bracket
    // should tax against $20k (+ IRA + 85% SS), NOT $99,999.
    const result = calcTaxesForLocation(stateLoc, 0, 30000, 99999, {
      filingStatus: 'mfj',
      investComposition: { ltcg: 20000 },
    });
    // State income = IRA $30k + LTCG $20k = $50k → state tax $2,500.
    expect(result.state).toBeCloseTo(2500, 2);
  });

  it('NIIT detail row references the right threshold for the filing status', () => {
    // Single threshold $200k. MAGI $250k single → excess $50k.
    // NII $30k → NIIT = $1,140. Note should reference $200,000.
    const result = calcTaxesForLocation(usFedOnly, 0, 220000, 30000, {
      filingStatus: 'single',
      investComposition: { ordinaryInterest: 30000 },
    });
    const niitDetail = result.details.find(d => d.label === 'US Net Investment Income Tax (NIIT)');
    expect(niitDetail).toBeDefined();
    expect(niitDetail.note).toContain('200,000');
  });

  // ─── Regressions for Codex findings on PR #87 ────────────────────────

  describe('Codex P1: unused deduction applied to LTCG portion', () => {
    it('low-ordinary + large-LTCG: unused deduction offsets preferential before bracket math', () => {
      // MFJ ordinary $20k. Std deduction $32.2k → unused $12.2k.
      // LTCG $200k → preferentialTaxable = $200k − $12.2k = $187.8k.
      // ordinaryFedTax on AGI=0 → 0. LTCG stacked on AGI=0:
      //   inZero  = min(187.8k, 98.9k − 0) = 98.9k → 0%
      //   inFifteen = 187.8k − 98.9k = 88.9k → 15% = $13,335
      //   inTwenty = 0
      // Total federal = $13,335.
      const result = calcTaxesForLocation(usFedOnly, 0, 20000, 200000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 200000 },
      });
      expect(result.federal).toBeCloseTo(13335, 2);
    });

    it('regression: prior buggy behavior would have taxed full LTCG without deduction offset', () => {
      // Same input as the test above. Without the fix:
      //   ltcgFederalTax(200000, 0, mfj):
      //     inZero  = 98.9k → 0%
      //     inFifteen = 200k − 98.9k = 101.1k → 15% = $15,165
      //   Total = $15,165 (overstated by $1,830 vs the correct $13,335).
      // The current (post-fix) behavior must NOT be $15,165.
      const result = calcTaxesForLocation(usFedOnly, 0, 20000, 200000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 200000 },
      });
      expect(result.federal).not.toBeCloseTo(15165, 2);
    });

    it('LTCG row note surfaces the unused-deduction offset when it applies', () => {
      const result = calcTaxesForLocation(usFedOnly, 0, 20000, 200000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 200000 },
      });
      const ltcgDetail = result.details.find(d => d.label === 'US Federal LTCG / QDI Tax');
      expect(ltcgDetail).toBeDefined();
      expect(ltcgDetail.note).toContain('unused deduction offset');
    });

    it('no offset note when ordinary income fully absorbs the deduction', () => {
      // Ordinary $80k > $32.2k deduction → no unused. Note should NOT
      // mention "unused deduction offset".
      const result = calcTaxesForLocation(usFedOnly, 0, 80000, 30000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 30000 },
      });
      const ltcgDetail = result.details.find(d => d.label === 'US Federal LTCG / QDI Tax');
      // ltcgDetail may not exist if all LTCG fits in 0% bracket — but in
      // this case ordinary AGI = 80−32.2 = $47.8k, plus $30k LTCG stacks
      // to $77.8k, all under 0% top → LTCG tax = 0. So detail row is
      // absent. Just confirm no offset note ever surfaced.
      if (ltcgDetail) {
        expect(ltcgDetail.note).not.toContain('unused deduction offset');
      }
    });

    it('unused deduction can fully zero-out preferentialTaxable (no LTCG row at all)', () => {
      // MFJ, std deduction $32.2k, ordinary $0, LTCG $5k.
      // unused = $32.2k. preferentialTaxable = max(0, 5k − 32.2k) = 0.
      // → no LTCG row, no LTCG tax.
      const result = calcTaxesForLocation(usFedOnly, 0, 0, 5000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 5000 },
      });
      expect(result.federal).toBe(0);
      expect(result.details.some(d => d.label === 'US Federal LTCG / QDI Tax')).toBe(false);
    });
  });

  describe('Codex P2: foreign tax credit preserves federal detail breakdown', () => {
    it('FTC adds a separate negative detail row instead of mutating details[0]', () => {
      const loc = {
        taxes: {
          federalIncomeTax: { foreignTaxCredit: true },
          stateIncomeTax: { brackets: [{ min: 0, max: null, rate: 0.30 }] },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 0, 80000, {
        filingStatus: 'mfj',
      });
      expect(result.details.some(d => d.label === 'US Foreign Tax Credit')).toBe(true);
      const ftcRow = result.details.find(d => d.label === 'US Foreign Tax Credit');
      // Negative amount — it's a credit
      expect(ftcRow.amount).toBeLessThan(0);
    });

    it('detail rows reconcile to result.federal when investComposition + FTC both present', () => {
      // MFJ ordinary $50k IRA + $40k LTCG. Std deduction $32.2k.
      // ordinaryFedTax: AGI=$17.8k → $1,780.
      // preferentialTaxable: $40k (no unused deduction).
      // ltcgFedTax: stacked on $17.8k → all $40k at 0% (since $57.8k < $98.9k) = $0.
      // niitTax: MAGI $90k < $250k MFJ threshold → $0.
      // Pre-FTC federal = $1,780.
      // Foreign country charges 30% state-equivalent tax on (ssTaxable + ira + invest)
      //   = $0 + $50k + $40k = $90k → $27k state.
      // FTC = min($27k, $1,780) = $1,780.
      // Post-FTC federal = $0.
      const loc = {
        taxes: {
          federalIncomeTax: { foreignTaxCredit: true },
          stateIncomeTax: { brackets: [{ min: 0, max: null, rate: 0.30 }] },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 50000, 40000, {
        filingStatus: 'mfj',
        investComposition: { ltcg: 40000 },
      });
      // Detail rows that reflect *federal* tax components (ordinary, LTCG,
      // NIIT, FTC) — exclude state/social/vehicle.
      const fedComponents = result.details.filter((d) =>
        d.label === 'US Federal Income Tax' ||
        d.label === 'US Federal LTCG / QDI Tax' ||
        d.label === 'US Net Investment Income Tax (NIIT)' ||
        d.label === 'US Foreign Tax Credit'
      );
      const sumOfRows = fedComponents.reduce((s, d) => s + d.amount, 0);
      // Reconciliation: sum of federal rows must equal result.federal.
      expect(sumOfRows).toBeCloseTo(result.federal, 2);
    });

    it('does NOT mutate details[0] amount or note when FTC fires', () => {
      // The ordinary federal row (details[0] when no rows precede it)
      // must keep its original ordinaryFedTax amount and AGI note. The
      // FTC effect lives in the separate FTC row.
      const loc = {
        taxes: {
          federalIncomeTax: { foreignTaxCredit: true },
          stateIncomeTax: { brackets: [{ min: 0, max: null, rate: 0.30 }] },
        },
      };
      const result = calcTaxesForLocation(loc, 0, 0, 80000, {
        filingStatus: 'mfj',
      });
      const ordRow = result.details.find(d => d.label === 'US Federal Income Tax');
      expect(ordRow).toBeDefined();
      // Pre-FTC ordinary federal: AGI $80k − $32.2k = $47.8k.
      // 24800 * 0.10 + (47800 − 24800) * 0.12 = 2480 + 2760 = $5,240.
      expect(ordRow.amount).toBeCloseTo(5240, 2);
      // Note must NOT have been mutated to include "after $... foreign
      // tax credit" — that text is gone with the new approach.
      expect(ordRow.note).not.toContain('foreign tax credit');
    });
  });
});

describe('ltcgZeroBracketHeadroom (#27)', () => {
  it('returns full 0% bracket when no ordinary income (MFJ)', () => {
    expect(ltcgZeroBracketHeadroom(0, 'mfj')).toBe(98900);
  });

  it('returns headroom = zeroTop − ordinary when below the cap', () => {
    // MFJ: $98,900 − $40,000 = $58,900
    expect(ltcgZeroBracketHeadroom(40000, 'mfj')).toBe(58900);
  });

  it('returns 0 when ordinary alone equals the 0% top', () => {
    expect(ltcgZeroBracketHeadroom(98900, 'mfj')).toBe(0);
  });

  it('returns 0 (not negative) when ordinary exceeds the 0% top', () => {
    expect(ltcgZeroBracketHeadroom(150000, 'mfj')).toBe(0);
    expect(ltcgZeroBracketHeadroom(800000, 'mfj')).toBe(0);
  });

  it('subtracts already-realized preferential income from the headroom', () => {
    // MFJ: $98,900 − $40,000 ordinary − $20,000 already-LTCG = $38,900 left
    expect(ltcgZeroBracketHeadroom(40000, 'mfj', 20000)).toBe(38900);
  });

  it('caps at 0 when ordinary + already-preferential already fills the bracket', () => {
    // $80k ordinary + $25k already = $105k > $98.9k → no room
    expect(ltcgZeroBracketHeadroom(80000, 'mfj', 25000)).toBe(0);
  });

  it('respects single filing status (smaller 0% bracket)', () => {
    // Single 0% top is $49,450. $30k ordinary → $19,450 headroom.
    expect(ltcgZeroBracketHeadroom(30000, 'single')).toBe(19450);
  });

  it('treats negative ordinary income as 0 (carry-forward losses)', () => {
    // Net operating loss can produce negative taxable ordinary income;
    // for headroom we floor at 0 so the full bracket is available.
    expect(ltcgZeroBracketHeadroom(-10000, 'mfj')).toBe(98900);
  });

  it('falls back to MFJ for unknown filing status', () => {
    expect(ltcgZeroBracketHeadroom(40000, 'bogus')).toBe(58900);
  });
});

describe('ltcgHarvestingSummary (#27)', () => {
  it('returns full 0% headroom and 15% headroom when no income (MFJ)', () => {
    const s = ltcgHarvestingSummary(0, 'mfj');
    expect(s.filingStatus).toBe('mfj');
    expect(s.zeroTop).toBe(98900);
    expect(s.fifteenTop).toBe(613700);
    expect(s.alreadyPreferential).toBe(0);
    expect(s.zeroBracketHeadroom).toBe(98900);
    // Fifteen-bracket headroom = $613,700 − $98,900 = $514,800
    expect(s.fifteenBracketHeadroom).toBe(514800);
    expect(s.currentMarginalRate).toBe(0);
  });

  it('shrinks both headrooms when ordinary income is in the 15% range', () => {
    // MFJ ordinary $200k. Already past the 0% top, so 0% headroom = 0.
    // 15% headroom = $613,700 − $200,000 = $413,700.
    // Marginal rate on next $1: 15%.
    const s = ltcgHarvestingSummary(200000, 'mfj');
    expect(s.zeroBracketHeadroom).toBe(0);
    expect(s.fifteenBracketHeadroom).toBe(413700);
    expect(s.currentMarginalRate).toBe(0.15);
  });

  it('reports 20% marginal rate when stack base exceeds the 15% top', () => {
    const s = ltcgHarvestingSummary(700000, 'mfj');
    expect(s.zeroBracketHeadroom).toBe(0);
    expect(s.fifteenBracketHeadroom).toBe(0);
    expect(s.currentMarginalRate).toBe(0.20);
  });

  it('subtracts already-preferential from BOTH headrooms (preferential stacks below new harvest)', () => {
    // MFJ ordinary $40k + already $30k LTCG = stack base $70k.
    // 0% head = $98.9k − $70k = $28,900.
    // 15% head = $613.7k − $98.9k = $514,800 (above 0% top, so unaffected
    // by stack base since 70k < 98.9k).
    const s = ltcgHarvestingSummary(40000, 'mfj', 30000);
    expect(s.zeroBracketHeadroom).toBe(28900);
    expect(s.fifteenBracketHeadroom).toBe(514800);
    expect(s.currentMarginalRate).toBe(0); // still in 0% range
  });

  it('handles the boundary case where stack base sits exactly at zeroTop', () => {
    // MFJ ordinary $98,900 → at the 0% top exactly. zeroBracketHeadroom = 0.
    // Next dollar is at 15%. fifteenHead = $613,700 − $98,900 = $514,800.
    const s = ltcgHarvestingSummary(98900, 'mfj');
    expect(s.zeroBracketHeadroom).toBe(0);
    expect(s.fifteenBracketHeadroom).toBe(514800);
    // Strictly greater-than for marginal: at the boundary, next dollar is 15%.
    expect(s.currentMarginalRate).toBe(0.15);
  });

  it('partial 15% bracket consumption: stack base above 0% top reduces 15% head', () => {
    // MFJ ordinary $400k. Above 0% top ($98.9k). 15% head = $613.7k − $400k
    // = $213,700.
    const s = ltcgHarvestingSummary(400000, 'mfj');
    expect(s.zeroBracketHeadroom).toBe(0);
    expect(s.fifteenBracketHeadroom).toBe(213700);
    expect(s.currentMarginalRate).toBe(0.15);
  });

  it('uses single filing-status thresholds correctly', () => {
    const s = ltcgHarvestingSummary(30000, 'single');
    expect(s.filingStatus).toBe('single');
    expect(s.zeroTop).toBe(49450);
    expect(s.fifteenTop).toBe(545500);
    expect(s.zeroBracketHeadroom).toBe(19450); // 49450 − 30000
    expect(s.fifteenBracketHeadroom).toBe(496050); // 545500 − 49450
  });

  it('falls back to MFJ on unknown filing status', () => {
    const s = ltcgHarvestingSummary(0, 'bogus');
    expect(s.filingStatus).toBe('mfj');
    expect(s.zeroTop).toBe(98900);
  });
});
