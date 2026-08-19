/**
 * ACA-bridge savings draw.
 *
 * For a pre-Medicare (under-65) household that wants the ACA premium-tax-credit
 * subsidy, MAGI must stay at/under the 400%-FPL cliff (reinstated for 2026 after
 * the enhanced-subsidy regime expired 2025-12-31). This module computes how many
 * dollars per month of spending must come from NON-MAGI savings (Roth
 * withdrawals, return-of-basis, cash) to hold MAGI at the ceiling — after paying
 * the tax owed on the MAGI income.
 *
 * It is a pure function: the tax engine is dependency-injected so it stays
 * independent of `taxes.js` and trivially unit-testable. The `/locations/:id`
 * route wires in the real `calcTaxesForLocation`.
 *
 * See docs/superpowers/specs/2026-07-30-aca-bridge-savings-draw-design.md.
 */

/** 2026 400%-of-Federal-Poverty-Level ceilings (48 contiguous states). */
export var US_FPL_400_2026 = { couple: 84600, single: 62600 };

/**
 * 2026 reverted top-band premium cap (net benchmark-silver premium as a
 * fraction of MAGI at the cliff). The enhanced-subsidy 8.5% cap expired
 * 2025-12-31; the stored `premiumCapPctOfIncome: 0.085` in seed data is stale
 * and intentionally NOT read here — this constant is authoritative for 2026.
 */
export var ACA_APPLICABLE_PCT_2026 = 0.0996;

/** Non-applicable result (non-US, or US without ACA marketplace data). */
function notApplicable() {
  return { applicable: false, couple: 0, single: 0 };
}

/** Sum the pre-65 non-healthcare monthly base: every category `typical`
 *  except the two healthcare keys. The stored `monthlyCostTotal` naively
 *  includes both, so we rebuild from categories. `medicalOOP` is retained. */
function baseNonHealthcareMonthly(monthlyCosts) {
  var excluded = { healthcare: true, healthcarePreMedicare: true };
  var sum = 0;
  for (var key in monthlyCosts) {
    if (!Object.prototype.hasOwnProperty.call(monthlyCosts, key)) continue;
    if (excluded[key]) continue;
    var cat = monthlyCosts[key];
    if (cat && typeof cat.typical === 'number') sum += cat.typical;
  }
  return sum;
}

/** One filing status's monthly savings draw. */
function drawForStatus(loc, deps, filingStatus, ceiling, benchmarkMonthly, baseMonthly) {
  // Subsidized net premium at the cliff = the smaller of the benchmark and the
  // applicable-percentage cap on MAGI.
  var capMonthly = (ACA_APPLICABLE_PCT_2026 * ceiling) / 12;
  var subsidizedNetMonthly = Math.min(benchmarkMonthly, capMonthly);

  // Tax on drawing the whole ceiling as ordinary (traditional-IRA) income at
  // age 60 — conservative/highest-tax case, no OBBBA senior deduction.
  var opts = { filingStatus: filingStatus, primaryAge: 60 };
  if (filingStatus === 'mfj') opts.spouseAge = 60;
  var taxResult = deps.calcTaxesForLocation(loc, 0, ceiling, 0, opts);
  var tax = taxResult && typeof taxResult.total === 'number' ? taxResult.total : 0;

  var netAtCeiling = ceiling - tax;
  var annualSpending = 12 * (baseMonthly + subsidizedNetMonthly);
  var drawAnnual = Math.max(0, annualSpending - netAtCeiling);
  return Math.round(drawAnnual / 12);
}

/**
 * Compute the ACA-bridge savings draw field for a location.
 *
 * @param {object} loc  — location data (country, monthlyCosts, healthcare, taxes)
 * @param {{calcTaxesForLocation: Function}} deps — injected tax engine
 * @returns field object (see spec); `applicable:false` + zeros when not a US
 *          ACA-marketplace location.
 */
export function computeAcaBridgeSavingsDraw(loc, deps) {
  if (!loc || loc.country !== 'United States') return notApplicable();
  var aca = loc.healthcare && loc.healthcare.acaMarketplace;
  if (!aca) return notApplicable();

  var baseMonthly = baseNonHealthcareMonthly(loc.monthlyCosts || {});
  var benchmarkCouple = aca.benchmarkSilverMonthly2Adult;
  var benchmarkSingle = aca.benchmarkSilverMonthlySingle;
  if (typeof benchmarkCouple !== 'number' || typeof benchmarkSingle !== 'number') {
    return notApplicable();
  }

  var couple = drawForStatus(loc, deps, 'mfj', US_FPL_400_2026.couple, benchmarkCouple, baseMonthly);
  var single = drawForStatus(loc, deps, 'single', US_FPL_400_2026.single, benchmarkSingle, baseMonthly);

  return {
    applicable: true,
    couple: couple,
    single: single,
    _units: {
      couple: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
      single: { encoding: 'amount', currency: 'USD', periodicity: 'month' },
    },
    _meta: {
      ceilingCouple: US_FPL_400_2026.couple,
      ceilingSingle: US_FPL_400_2026.single,
      applicablePct: ACA_APPLICABLE_PCT_2026,
      taxIncluded: true,
      regime: '2026-post-IRA-cliff',
      singleBasis: 'location household cost basis with single premium + ceiling (what-if)',
    },
  };
}
