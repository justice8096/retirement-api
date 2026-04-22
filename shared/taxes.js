export function calcBracketTax(income, brackets) {
  var tax = 0;
  for (var i = 0; i < brackets.length; i++) {
    var b = brackets[i];
    if (income <= b.min) break;
    var taxable = Math.min(income, b.max || Infinity) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

// ─── 2026 tax constants (US) ────────────────────────────────────────────
//
// Sources: see structured arrays (FED_BRACKETS_2026_SOURCES,
// FED_STD_DEDUCTION_2026_SOURCES, OBBBA_SENIOR_SOURCES) below — these
// are what the dashboard surfaces through <app-source-tooltip>. The
// free-text summary:
//   - Federal income tax brackets + standard deduction:
//     IRS Rev Proc 2025-32 (2026 inflation adjustments).
//   - OBBBA senior bonus deduction:
//     One Big Beautiful Bill Act § 13301 ($6,000/yr for age 65+, tax years
//     2025–2028). Phases out between MAGI $75k–$175k (single) /
//     $150k–$250k (MFJ).
//
// Filing-status-specific brackets. The location seed data may override
// these via `taxes.federalIncomeTax.brackets`, so callers that want
// strict 2026 behaviour should NOT pass a `brackets` override.

/** Citations for the 2026 federal bracket tables (MFJ + Single). */
export var FED_BRACKETS_2026_SOURCES = [
  {
    title: 'IRS Rev. Proc. 2025-32 (2026 inflation adjustments)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    accessed: '2026-04-20',
  },
  {
    title: 'IRC § 1 — Tax imposed (statutory bracket structure)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1',
    accessed: '2026-04-20',
  },
];

/** Citations for the 2026 standard deduction (MFJ / Single / HoH). */
export var FED_STD_DEDUCTION_2026_SOURCES = [
  {
    title: 'IRS Rev. Proc. 2025-32 § 3.17 (2026 standard deduction)',
    url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    accessed: '2026-04-20',
  },
];

/** Citations for the OBBBA senior bonus deduction ($6,000, age 65+, 2025–2028). */
export var OBBBA_SENIOR_SOURCES = [
  {
    title: 'One Big Beautiful Bill Act § 13301 — Senior bonus deduction',
    url: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text',
    accessed: '2026-04-20',
  },
  {
    title: 'IRS summary: Additional senior deduction (IRC § 151(d)(5))',
    url: 'https://www.irs.gov/newsroom/additional-deduction-for-taxpayers-aged-65-and-older',
    accessed: '2026-04-20',
  },
];
export var FED_STD_DEDUCTION_2026 = {
  mfj: 32200,
  single: 16100,
  hoh: 24150,
};

export var FED_BRACKETS_2026_MFJ = [
  { min: 0,       max: 24800,  rate: 0.10 },
  { min: 24800,   max: 100800, rate: 0.12 },
  { min: 100800,  max: 211400, rate: 0.22 },
  { min: 211400,  max: 403550, rate: 0.24 },
  { min: 403550,  max: 512450, rate: 0.32 },
  { min: 512450,  max: 768700, rate: 0.35 },
  { min: 768700,  max: null,   rate: 0.37 },
];

export var FED_BRACKETS_2026_SINGLE = [
  { min: 0,       max: 12400,  rate: 0.10 },
  { min: 12400,   max: 50400,  rate: 0.12 },
  { min: 50400,   max: 105700, rate: 0.22 },
  { min: 105700,  max: 201775, rate: 0.24 },
  { min: 201775,  max: 256225, rate: 0.32 },
  { min: 256225,  max: 640600, rate: 0.35 },
  { min: 640600,  max: null,   rate: 0.37 },
];

// OBBBA senior bonus deduction — age 65+, stackable with standard deduction.
// Phase-out: $200/1,000 excess MAGI over threshold, until zeroed.
export var OBBBA_SENIOR_DEDUCTION_AMOUNT = 6000;
export var OBBBA_SENIOR_PHASEOUT = {
  mfj:    { start: 150000, end: 250000 },
  single: { start:  75000, end: 175000 },
  hoh:    { start:  75000, end: 175000 },
};

/** Phased-out amount of the OBBBA senior bonus deduction at a given MAGI. */
export function obbbaSeniorDeduction(filingStatus, age, magi, perAdult) {
  // `perAdult` = true when both MFJ spouses are 65+. Applied once per
  // qualifying adult. Caller is responsible for counting adults.
  if (age === undefined || age < 65) return 0;
  var band = OBBBA_SENIOR_PHASEOUT[filingStatus] || OBBBA_SENIOR_PHASEOUT.single;
  if (magi <= band.start) return OBBBA_SENIOR_DEDUCTION_AMOUNT;
  if (magi >= band.end)   return 0;
  var phaseRange = band.end - band.start;
  var excess = magi - band.start;
  var keep = Math.max(0, 1 - excess / phaseRange);
  return Math.round(OBBBA_SENIOR_DEDUCTION_AMOUNT * keep);
}

export function calcTaxesForLocation(loc, ssIncome, iraIncome, investIncome, opts) {
  var taxes = loc.taxes;
  if (!taxes) return null;
  var filingStatus = (opts && opts.filingStatus) || 'mfj';
  var primaryAge = opts && opts.primaryAge;
  var spouseAge = opts && opts.spouseAge;
  var totalIncome = ssIncome + iraIncome + investIncome;
  var result = { federal: 0, state: 0, socialCharges: 0, salesVat: 0, vehicleTax: 0, total: 0, details: [] };

  // Federal income tax (US citizens everywhere)
  // NOTE: 85% SS-taxable is a simplifying default. The real tiered rule
  // (0% / 50% / 85% at the $25k/$32k provisional-income thresholds) lives
  // in HealthcareService.computeMagi in the dashboard; this file is used
  // for location-comparison cost-of-living math where the heuristic is
  // acceptable. See docs/METHODOLOGY.md §2.
  var ssTaxable = ssIncome * 0.85;
  var federalTaxableIncome = ssTaxable + iraIncome + investIncome;
  var fedDeduction = (taxes.federalIncomeTax && taxes.federalIncomeTax.standardDeduction)
    || FED_STD_DEDUCTION_2026[filingStatus]
    || FED_STD_DEDUCTION_2026.mfj;

  // OBBBA senior bonus deduction (2025–2028). Applied once per qualifying
  // adult aged 65+, subject to MAGI phase-out. Uses federalTaxableIncome
  // as the MAGI approximation — exact OBBBA MAGI definition includes
  // foreign-income add-backs which this model doesn't carry.
  var seniorDeduction = 0;
  if (primaryAge && primaryAge >= 65) {
    seniorDeduction += obbbaSeniorDeduction(filingStatus, primaryAge, federalTaxableIncome);
  }
  if (filingStatus === 'mfj' && spouseAge && spouseAge >= 65) {
    seniorDeduction += obbbaSeniorDeduction(filingStatus, spouseAge, federalTaxableIncome);
  }
  fedDeduction += seniorDeduction;

  var fedAGI = Math.max(0, federalTaxableIncome - fedDeduction);
  var fedBrackets;
  if (taxes.federalIncomeTax && taxes.federalIncomeTax.brackets) {
    // Seed-data override — for locations that want to simulate a different
    // tax system entirely (territorial, no federal, etc.).
    fedBrackets = taxes.federalIncomeTax.brackets;
  } else {
    fedBrackets = filingStatus === 'single' ? FED_BRACKETS_2026_SINGLE : FED_BRACKETS_2026_MFJ;
  }
  result.federal = calcBracketTax(fedAGI, fedBrackets);
  var deductionNote = 'AGI $' + Math.round(fedAGI).toLocaleString() + ' after $' + fedDeduction.toLocaleString() + ' standard deduction';
  if (seniorDeduction > 0) {
    deductionNote += ' (includes $' + seniorDeduction.toLocaleString() + ' OBBBA senior bonus)';
  }
  result.details.push({
    label: 'US Federal Income Tax', amount: result.federal,
    note: deductionNote,
  });

  // State/country income tax
  var st = taxes.stateIncomeTax;
  if (st && st.brackets && st.brackets.length > 0) {
    var stateIncome = iraIncome + investIncome;
    if (!taxes.ssExempt && !taxes.ssTaxedInCountry) {
      stateIncome += ssTaxable;
    }
    var stDeduction = st.deduction || 0;
    var stateAGI = Math.max(0, stateIncome - stDeduction);

    if (taxes.retirementExempt) {
      stateAGI = Math.max(0, investIncome - stDeduction);
      result.state = calcBracketTax(stateAGI, st.brackets);
      result.details.push({
        label: (st.label || 'State Income Tax'), amount: result.state,
        note: 'Retirement income exempt. Only investment income taxed.',
      });
    } else {
      result.state = calcBracketTax(stateAGI, st.brackets);
      var stLabel = st.label || 'State/Local Income Tax';
      result.details.push({ label: stLabel, amount: result.state, note: st.exemptions || '' });
    }

    // Foreign tax credit
    if (taxes.federalIncomeTax && taxes.federalIncomeTax.foreignTaxCredit && result.state > 0) {
      var ftc = Math.min(result.state, result.federal);
      result.federal = Math.max(0, result.federal - ftc);
      result.details[0].amount = result.federal;
      result.details[0].note += ' (after $' + Math.round(ftc).toLocaleString() + ' foreign tax credit)';
    }
  } else if (st && st.type === 'none') {
    result.details.push({ label: 'State Income Tax', amount: 0, note: st.exemptions || 'No state income tax' });
  } else if (st && st.type === 'territorial') {
    result.details.push({ label: st.label || 'Local Income Tax', amount: 0, note: st.exemptions || 'Territorial system: foreign income not taxed' });
  }

  // Social charges (France CSM etc.)
  if (taxes.socialCharges && taxes.socialCharges.rate > 0) {
    var scBase = iraIncome + investIncome;
    var scThreshold = taxes.socialCharges.annualThreshold || 0;
    var scTaxable = Math.max(0, scBase - scThreshold);
    result.socialCharges = scTaxable * taxes.socialCharges.rate;
    result.details.push({
      label: taxes.socialCharges.name || 'Social Charges',
      amount: result.socialCharges,
      note: (taxes.socialCharges.rate * 100).toFixed(1) + '% on ' + taxes.socialCharges.basis,
    });
  }

  // Vehicle tax
  if (taxes.estVehicleTax > 0) {
    result.vehicleTax = taxes.estVehicleTax;
    result.details.push({ label: 'Vehicle Property Tax', amount: result.vehicleTax, note: 'Annual estimate' });
  }

  result.total = result.federal + result.state + result.socialCharges + result.vehicleTax;
  result.totalIncome = totalIncome;
  result.effectiveRate = totalIncome > 0 ? result.total / totalIncome : 0;
  return result;
}
