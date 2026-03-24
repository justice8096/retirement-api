import { readFileSync, writeFileSync } from 'fs';

var idx = JSON.parse(readFileSync('data/index.json'));

// 2026 US Federal tax brackets (Married Filing Jointly)
var federalBrackets = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 }
];

var taxData = {
  "us-virginia": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0.0575, type: "top-marginal",
      brackets: [
        { min: 0, max: 3000, rate: 0.02 }, { min: 3000, max: 5000, rate: 0.03 },
        { min: 5000, max: 17000, rate: 0.05 }, { min: 17000, max: Infinity, rate: 0.0575 }
      ],
      deduction: 24000,
      exemptions: "Age 65+ deduction $12K/person. SS fully exempt from VA tax."
    },
    salesTax: { rate: 0.06, notes: "Fairfax County 6% (4.3% state + 0.7% regional + 1% NOVA transit)" },
    propertyTax: { rate: 0, notes: "Renters: no direct property tax. Vehicle personal property ~$4.57/$100 assessed." },
    socialCharges: null, vatRate: 0, estVehicleTax: 1200,
    ssExempt: true, notes: "Fairfax County sales tax 6%."
  },
  "us-florida": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: { rate: 0, type: "none", brackets: [], deduction: 0, exemptions: "No state income tax." },
    salesTax: { rate: 0.06, notes: "6% state, some counties add 0.5-1.5%" },
    propertyTax: { rate: 0, notes: "Renters: no direct property tax" },
    socialCharges: null, vatRate: 0, estVehicleTax: 0,
    ssExempt: true, notes: "No state income tax. Federal only."
  },
  "us-savannah": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0.0549, type: "graduated",
      brackets: [
        { min: 0, max: 7000, rate: 0.01 }, { min: 7000, max: 10000, rate: 0.02 },
        { min: 10000, max: Infinity, rate: 0.0549 }
      ],
      deduction: 6500,
      exemptions: "$65K retirement income exclusion per person (65+). SS partially exempt."
    },
    salesTax: { rate: 0.07, notes: "4% state + 3% Chatham County" },
    propertyTax: { rate: 0 }, socialCharges: null, vatRate: 0, estVehicleTax: 300,
    ssExempt: false, notes: "GA state income tax 1-5.49%."
  },
  "us-richmond": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0.0575, type: "top-marginal",
      brackets: [
        { min: 0, max: 3000, rate: 0.02 }, { min: 3000, max: 5000, rate: 0.03 },
        { min: 5000, max: 17000, rate: 0.05 }, { min: 17000, max: Infinity, rate: 0.0575 }
      ],
      deduction: 24000,
      exemptions: "Age 65+ deduction $12K/person. SS fully exempt from VA tax."
    },
    salesTax: { rate: 0.053, notes: "4.3% state + 1% local" },
    propertyTax: { rate: 0 }, socialCharges: null, vatRate: 0, estVehicleTax: 900,
    ssExempt: true, notes: "VA state income tax with age deductions."
  },
  "us-philadelphia": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0.0307, type: "flat",
      brackets: [{ min: 0, max: Infinity, rate: 0.0307 }],
      deduction: 0,
      exemptions: "SS and all retirement income exempt from PA tax. City wage tax 3.75% on earned income only (not retirement)."
    },
    salesTax: { rate: 0.08, notes: "6% state + 2% Philadelphia" },
    propertyTax: { rate: 0 }, socialCharges: null, vatRate: 0, estVehicleTax: 0,
    ssExempt: true, retirementExempt: true, notes: "PA exempts all retirement income from state tax."
  },
  "us-cherry-hill": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0.0637, type: "progressive",
      brackets: [
        { min: 0, max: 20000, rate: 0.014 }, { min: 20000, max: 35000, rate: 0.0175 },
        { min: 35000, max: 40000, rate: 0.035 }, { min: 40000, max: 75000, rate: 0.05525 },
        { min: 75000, max: 500000, rate: 0.0637 }
      ],
      deduction: 0,
      exemptions: "SS exempt. Retirement income exclusion up to $100K for couples (income <$150K)."
    },
    salesTax: { rate: 0.06625, notes: "6.625% state rate" },
    propertyTax: { rate: 0 }, socialCharges: null, vatRate: 0, estVehicleTax: 0,
    ssExempt: true, notes: "NJ progressive income tax."
  },
  "france-brittany": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.30, type: "progressive", label: "French Income Tax",
      brackets: [
        { min: 0, max: 11294, rate: 0 }, { min: 11294, max: 28797, rate: 0.11 },
        { min: 28797, max: 82341, rate: 0.30 }, { min: 82341, max: 177106, rate: 0.41 }
      ],
      deduction: 0,
      exemptions: "US-France treaty prevents double taxation. Foreign tax credit offsets. SS taxed only in France at 6.6% after allowance."
    },
    salesTax: { rate: 0, notes: "No separate sales tax (VAT included in prices)" },
    propertyTax: { rate: 0, notes: "Taxe d'habitation abolished for primary residence" },
    socialCharges: { rate: 0.065, name: "CSM", basis: "passive income above threshold", annualThreshold: 3660 },
    vatRate: 0.20, estVehicleTax: 0,
    ssExempt: false, ssTaxedInCountry: true,
    notes: "US-France tax treaty. Foreign tax credit offsets French tax against US federal."
  },
  "france-lyon": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.30, type: "progressive", label: "French Income Tax",
      brackets: [
        { min: 0, max: 11294, rate: 0 }, { min: 11294, max: 28797, rate: 0.11 },
        { min: 28797, max: 82341, rate: 0.30 }
      ],
      deduction: 0,
      exemptions: "US-France tax treaty. SS taxed only in France."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: { rate: 0.065, name: "CSM", basis: "passive income", annualThreshold: 3660 },
    vatRate: 0.20, estVehicleTax: 0, ssExempt: false, ssTaxedInCountry: true,
    notes: "US-France tax treaty applies."
  },
  "france-montpellier": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.30, type: "progressive", label: "French Income Tax",
      brackets: [
        { min: 0, max: 11294, rate: 0 }, { min: 11294, max: 28797, rate: 0.11 },
        { min: 28797, max: 82341, rate: 0.30 }
      ],
      deduction: 0, exemptions: "US-France tax treaty. SS taxed only in France."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: { rate: 0.065, name: "CSM", basis: "passive income", annualThreshold: 3660 },
    vatRate: 0.20, estVehicleTax: 0, ssExempt: false, ssTaxedInCountry: true,
    notes: "US-France tax treaty applies."
  },
  "france-toulouse": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.30, type: "progressive", label: "French Income Tax",
      brackets: [
        { min: 0, max: 11294, rate: 0 }, { min: 11294, max: 28797, rate: 0.11 },
        { min: 28797, max: 82341, rate: 0.30 }
      ],
      deduction: 0, exemptions: "US-France tax treaty. SS taxed only in France."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: { rate: 0.065, name: "CSM", basis: "passive income", annualThreshold: 3660 },
    vatRate: 0.20, estVehicleTax: 0, ssExempt: false, ssTaxedInCountry: true,
    notes: "US-France tax treaty applies."
  },
  "spain-alicante": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.245, type: "progressive", label: "Spanish Income Tax (IRPF)",
      brackets: [
        { min: 0, max: 12450, rate: 0.19 }, { min: 12450, max: 20200, rate: 0.24 },
        { min: 20200, max: 35200, rate: 0.30 }, { min: 35200, max: 60000, rate: 0.37 }
      ],
      deduction: 5550,
      exemptions: "US-Spain tax treaty. Beckham Law flat 24% possible for new residents. SS per treaty."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: null, vatRate: 0.21, estVehicleTax: 0,
    ssExempt: false, ssTaxedInCountry: true,
    notes: "US-Spain tax treaty. Valencia region may add surcharge."
  },
  "portugal-lisbon": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000, foreignTaxCredit: true },
    stateIncomeTax: {
      rate: 0.48, type: "progressive", label: "Portuguese Income Tax (IRS)",
      brackets: [
        { min: 0, max: 8704, rate: 0.125 }, { min: 8704, max: 13133, rate: 0.16 },
        { min: 13133, max: 18612, rate: 0.215 }, { min: 18612, max: 24090, rate: 0.244 },
        { min: 24090, max: 30672, rate: 0.314 }, { min: 30672, max: 44959, rate: 0.349 },
        { min: 44959, max: 48586, rate: 0.431 }, { min: 48586, max: 90393, rate: 0.446 },
        { min: 90393, max: Infinity, rate: 0.48 }
      ],
      deduction: 4432,
      exemptions: "NHR ended Jan 2024 (IFICI replacement excludes pensions). Foreign pensions/retirement income taxed at standard progressive rates 12.5-48%. US-Portugal treaty provides foreign tax credit."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: null, vatRate: 0.23, estVehicleTax: 0,
    ssExempt: false, ssTaxedInCountry: true,
    notes: "NHR ended 2024. Pensions taxed at standard rates 12.5-48%. US-Portugal tax treaty for foreign tax credit."
  },
  "panama-city": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0, type: "territorial", label: "Panama Income Tax",
      brackets: [], deduction: 0,
      exemptions: "Territorial system: foreign-sourced income (SS, 401k, investments) NOT taxed in Panama."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: null, vatRate: 0.07, estVehicleTax: 0,
    ssExempt: true, notes: "Territorial tax: only Panama-sourced income taxed."
  },
  "panama-boquete": {
    federalIncomeTax: { applies: true, brackets: federalBrackets, standardDeduction: 30000 },
    stateIncomeTax: {
      rate: 0, type: "territorial", label: "Panama Income Tax",
      brackets: [], deduction: 0,
      exemptions: "Territorial system: foreign-sourced income NOT taxed in Panama."
    },
    salesTax: { rate: 0 }, propertyTax: { rate: 0 },
    socialCharges: null, vatRate: 0.07, estVehicleTax: 0,
    ssExempt: true, notes: "Territorial tax: only Panama-sourced income taxed."
  }
};

idx.locations.forEach(function(entry) {
  var path = 'data/locations/' + entry.id + '/location.json';
  var loc = JSON.parse(readFileSync(path));
  if (taxData[entry.id]) {
    loc.taxes = taxData[entry.id];
    writeFileSync(path, JSON.stringify(loc, null, 2) + '\n');
    console.log('Updated: ' + entry.id);
  }
});
console.log('Done.');
