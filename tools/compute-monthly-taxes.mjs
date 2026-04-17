#!/usr/bin/env node
/**
 * Compute estimated monthly income tax for every location and write it into
 * `monthlyCosts.taxes.typical`. Recomputes the `monthlyCostUSD` summary in
 * `data/index.json` afterwards so the dashboard totals stay consistent.
 *
 * Assumptions:
 *   - Household: 2 adults, target annual income $72,000 (from index.json).
 *   - Federal MFJ with $30,000 standard deduction → $42,000 taxable.
 *   - State/territory/country effective rates applied on the taxable base
 *     (or the full income where retirement-specific flat regimes apply).
 *
 * Run: node tools/compute-monthly-taxes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA = 'data';
const LOC_DIR = join(DATA, 'locations');
const INDEX_PATH = join(DATA, 'index.json');

const idx = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
const ANNUAL_INCOME = idx.householdProfile?.targetAnnualIncome ?? 72000;
const STD_DEDUCTION = 30000;
const FED_TAXABLE = Math.max(0, ANNUAL_INCOME - STD_DEDUCTION);

// 2026 federal MFJ brackets
const FED_BRACKETS = [
  { max: 23850, rate: 0.10 },
  { max: 96950, rate: 0.12 },
  { max: 206700, rate: 0.22 },
  { max: 394600, rate: 0.24 },
  { max: 501050, rate: 0.32 },
  { max: 751600, rate: 0.35 },
  { max: Infinity, rate: 0.37 },
];

function progressive(taxable, brackets) {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    if (taxable <= lower) break;
    const slice = Math.min(taxable, b.max) - lower;
    tax += slice * b.rate;
    lower = b.max;
  }
  return tax;
}

const FEDERAL_TAX = progressive(FED_TAXABLE, FED_BRACKETS); // ~$4,563

// US state effective income-tax rate applied to the federal taxable base.
// Zeros are no-income-tax jurisdictions. Values are rough effective rates for
// a $72k MFJ household — not marginal top rates.
const STATE_RATE = {
  AL: 0.04, AK: 0, AZ: 0.025, AR: 0.04, CA: 0.04, CO: 0.044, CT: 0.05,
  DE: 0.04, FL: 0, GA: 0.0549, HI: 0.06, ID: 0.058, IL: 0.0495, IN: 0.031,
  IA: 0.038, KS: 0.047, KY: 0.04, LA: 0.03, ME: 0.058, MD: 0.045, MA: 0.05,
  MI: 0.0425, MN: 0.06, MS: 0.044, MO: 0.045, MT: 0.058, NE: 0.052,
  NV: 0, NH: 0, NJ: 0.045, NM: 0.044, NY: 0.055, NC: 0.045, ND: 0.015,
  OH: 0.025, OK: 0.045, OR: 0.075, PA: 0, RI: 0.045, SC: 0.05, SD: 0,
  TN: 0, TX: 0, UT: 0.0465, VT: 0.058, VA: 0.045, WA: 0, WV: 0.048,
  WI: 0.05, WY: 0, DC: 0.06,
};

// Extra local tax on top of state (NYC specifically).
const LOCAL_RATE = { 'us-new-york-city': 0.0309 };

// Map region strings (used when id doesn't encode the state) to abbrevs.
const REGION_TO_STATE = {
  'Georgia': 'GA', 'Texas': 'TX', 'Florida': 'FL', 'New York': 'NY',
  'Virginia': 'VA', 'North Carolina': 'NC', 'South Carolina': 'SC',
  'New Jersey': 'NJ', 'Pennsylvania': 'PA',
};

// US territory annual tax estimates on $72k MFJ.
const TERRITORY_TAX = {
  'Puerto Rico': 5040,           // PR income tax (~7% effective)
  'US Virgin Islands': 4563,     // mirror code of federal
  'Guam': 4563,                  // mirror code
  'Northern Mariana Islands': 4563, // mirror code
  'American Samoa': 3600,        // ASGEDA lower rates (~5% effective)
};

// Country-level effective annual tax on $72k for foreign retirees.
// Reflects common retiree regimes (territorial systems, flat-pension deals).
const COUNTRY_TAX = {
  'Colombia': 0,         // foreign pension generally exempt
  'Costa Rica': 0,       // territorial
  'Croatia': 8640,       // ~12%
  'Cyprus': 3600,        // 5% flat on foreign pension
  'Ecuador': 0,          // territorial
  'France': 8640,        // ~12% progressive
  'Greece': 5040,        // 7% flat retiree regime
  'Ireland': 8640,       // ~12% effective
  'Italy': 5040,         // 7% flat retiree regime (south)
  'Malta': 7500,         // 15% with minimums
  'Mexico': 0,           // foreign income generally exempt
  'Panama': 0,           // territorial
  'Portugal': 7200,      // 10% on foreign pensions
  'Spain': 10080,        // ~14% effective
  'Uruguay': 0,          // territorial + tax holiday
};

function stateFromId(id) {
  const m = id.match(/-([a-z]{2})$/);
  return m ? m[1].toUpperCase() : null;
}

function annualTaxFor(loc) {
  const { id, country, region } = loc;

  if (country === 'United States') {
    if (TERRITORY_TAX[region] !== undefined) return TERRITORY_TAX[region];

    const state = stateFromId(id) ?? REGION_TO_STATE[region] ?? null;
    const stateRate = state && STATE_RATE[state] !== undefined ? STATE_RATE[state] : 0.045;
    const stateTax = stateRate * FED_TAXABLE;
    const localTax = (LOCAL_RATE[id] ?? 0) * FED_TAXABLE;
    return FEDERAL_TAX + stateTax + localTax;
  }

  if (COUNTRY_TAX[country] !== undefined) return COUNTRY_TAX[country];
  return 0;
}

function sumMonthlyCosts(monthlyCosts) {
  let sum = 0;
  for (const v of Object.values(monthlyCosts ?? {})) {
    if (v && typeof v.typical === 'number') sum += v.typical;
  }
  return Math.round(sum);
}

// ─── Process each location ───────────────────────────────────────────
const ids = readdirSync(LOC_DIR).filter(name =>
  existsSync(join(LOC_DIR, name, 'location.json')),
);

let updated = 0;
const summaryById = new Map();

for (const id of ids) {
  const p = join(LOC_DIR, id, 'location.json');
  const loc = JSON.parse(readFileSync(p, 'utf8'));

  const annual = Math.round(annualTaxFor(loc));
  const typical = Math.round(annual / 12);
  const min = Math.round(typical * 0.9);
  const max = Math.round(typical * 1.1);

  if (!loc.monthlyCosts) loc.monthlyCosts = {};
  loc.monthlyCosts.taxes = {
    typical,
    min,
    max,
    annualInflation: 0.02,
    notes: `Estimated monthly income tax on $${ANNUAL_INCOME.toLocaleString()}/yr household income. Based on jurisdiction's effective retiree rate; excludes sales/VAT/property tax.`,
  };

  const total = sumMonthlyCosts(loc.monthlyCosts);
  summaryById.set(loc.id, total);

  writeFileSync(p, JSON.stringify(loc, null, 2) + '\n');
  updated++;
}

console.log(`Updated ${updated} location.json files.`);

// ─── Rewrite index.json monthlyCostUSD ───────────────────────────────
let indexChanged = 0;
for (const entry of idx.locations) {
  const total = summaryById.get(entry.id);
  if (total !== undefined && entry.monthlyCostUSD !== total) {
    entry.monthlyCostUSD = total;
    indexChanged++;
  }
}
idx.meta.lastUpdated = new Date().toISOString().slice(0, 10);
writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2) + '\n');
console.log(`Rewrote ${indexChanged} monthlyCostUSD entries in index.json.`);
