#!/usr/bin/env node
/**
 * inject-cellphone.js
 *
 * Adds detailed cellPhone plans to all locations missing them.
 * US locations: T-Mobile 55+ (2 lines).
 * Non-US: Google Fi (US number) + local carrier (2 lines).
 * Also updates monthlyCosts.phoneCell if the typical value differs.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data/locations');

// ────────────────────────────────────────────────────────────────
// Country-specific cell phone plan templates
// ────────────────────────────────────────────────────────────────

// US: T-Mobile 55+ Essentials — 2 lines unlimited
function usPlans(state, taxRate) {
  const base = 55;
  const taxes = Math.round(base * taxRate);
  const total = base + taxes;
  return {
    monthlyBudget: { min: 50, typical: total, max: total + 15 },
    plans: [{
      name: 'T-Mobile 55+ Essentials',
      type: 'US Domestic',
      lines: 2,
      dataPerLine: 'Unlimited (50GB priority)',
      baseCost: base,
      taxesAndFees: taxes,
      monthlyTotal: total,
      notes: `2 lines unlimited talk/text/data. ${state} wireless tax ~${Math.round(taxRate * 100)}% + federal USF. 5G included.`,
    }],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
    ],
  };
}

// Non-US: Google Fi (US number) + local carrier
function intlPlans(country, localCarrier, localCost, localData, localNotes, currency, fxNote) {
  const fiBase = 35;
  const fiData = 30; // 3GB at $10/GB
  const fiTotal = fiBase + fiData;
  const localTotal = localCost;
  const typicalUSD = fiTotal + localTotal;
  return {
    monthlyBudget: { min: typicalUSD - 15, typical: typicalUSD, max: typicalUSD + 20 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: fiBase,
        taxesAndFees: 0,
        monthlyTotal: fiTotal,
        notes: `Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in ${country} at same rate. Keeps US number for banking/2FA.`,
      },
      {
        name: localCarrier,
        type: 'Local Service',
        lines: 2,
        dataPerLine: localData,
        baseCost: localCost,
        taxesAndFees: 0,
        monthlyTotal: localTotal,
        notes: localNotes,
      },
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
    ],
  };
}

// ── US state tax rates (wireless) ──
const US_TAX_RATES = {
  'us-albuquerque-nm': ['NM', 0.08], 'us-armstrong-county-pa': ['PA', 0.11],
  'us-asheville-nc': ['NC', 0.09], 'us-atlanta': ['GA', 0.10],
  'us-austin': ['TX', 0.12], 'us-austin-tx': ['TX', 0.12],
  'us-baltimore-md': ['MD', 0.09], 'us-birmingham-al': ['AL', 0.14],
  'us-cherry-hill': ['NJ', 0.10], 'us-chesapeake-va': ['VA', 0.12],
  'us-chicago-il': ['IL', 0.15], 'us-cleveland-oh': ['OH', 0.11],
  'us-dallas-tx': ['TX', 0.12], 'us-denver-co': ['CO', 0.10],
  'us-florida': ['FL', 0.08], 'us-fort-lauderdale-fl': ['FL', 0.08],
  'us-fort-wayne-in': ['IN', 0.10], 'us-fort-worth-tx': ['TX', 0.12],
  'us-grand-forks-nd': ['ND', 0.09], 'us-killeen-tx': ['TX', 0.12],
  'us-lapeer-mi': ['MI', 0.09], 'us-little-rock-ar': ['AR', 0.15],
  'us-lorain-oh': ['OH', 0.11], 'us-lynchburg-va': ['VA', 0.12],
  'us-miami-fl': ['FL', 0.08], 'us-milwaukee-wi': ['WI', 0.10],
  'us-minneapolis-mn': ['MN', 0.12], 'us-nashville-tn': ['TN', 0.11],
  'us-norfolk-va': ['VA', 0.12], 'us-oakland-county-mi': ['MI', 0.09],
  'us-palm-bay-fl': ['FL', 0.08], 'us-philadelphia': ['PA', 0.11],
  'us-pittsburgh-pa': ['PA', 0.11], 'us-port-huron-mi': ['MI', 0.09],
  'us-portsmouth-va': ['VA', 0.12], 'us-quincy-fl': ['FL', 0.08],
  'us-raleigh': ['NC', 0.09], 'us-richmond': ['VA', 0.12],
  'us-saint-paul-mn': ['MN', 0.12], 'us-san-marcos-tx': ['TX', 0.12],
  'us-savannah': ['GA', 0.10], 'us-skowhegan-me': ['ME', 0.08],
  'us-st-augustine-fl': ['FL', 0.08], 'us-st-petersburg-fl': ['FL', 0.08],
  'us-summerville': ['SC', 0.09], 'us-tampa-fl': ['FL', 0.08],
  'us-virginia': ['VA', 0.12], 'us-virginia-beach-va': ['VA', 0.12],
  'us-williamsport-pa': ['PA', 0.11], 'us-yulee-fl': ['FL', 0.08],
};

// ── International local carriers by country ──
const INTL_CARRIERS = {
  Colombia: ['Claro Colombia Postpaid', 15, '10GB 4G/5G', '2 lines ~30,000 COP/line (~$7.50). Claro is largest carrier. Taxes included.', 'COP'],
  'Costa Rica': ['Kolbi (ICE) Postpaid', 18, '5GB 4G', '2 lines ~₡5,000/line (~$9). Kolbi is state telecom. Taxes included.', 'CRC'],
  Croatia: ['A1 Croatia Postpaid', 20, '10GB 4G/5G', '2 lines ~€9/line. A1 has best coverage. EU roaming included.', 'EUR'],
  Cyprus: ['Cyta Postpaid', 22, '10GB 4G/5G', '2 lines ~€10/line. Cyta is incumbent carrier. EU roaming included.', 'EUR'],
  Ecuador: ['Claro Ecuador Prepaid', 12, '6GB 4G', '2 lines ~$6/line. Claro dominates market. Prices in USD (dollarized).', 'USD'],
  France: ['Free Mobile', 20, '110GB 5G', '2 lines €9.99/line (~$11). Free Mobile best value. EU roaming included.', 'EUR'],
  Greece: ['Cosmote Postpaid', 22, '8GB 4G/5G', '2 lines ~€10/line. Cosmote is largest carrier. EU roaming included.', 'EUR'],
  Ireland: ['Three Ireland SIM-Only', 25, 'Unlimited 5G', '2 lines €12/line (~$13). Three has best 5G coverage. EU roaming included.', 'EUR'],
  Italy: ['Iliad Italia', 16, '120GB 5G', '2 lines €7.99/line (~$8.50). Iliad disrupted Italian market with low prices. EU roaming included.', 'EUR'],
  Malta: ['GO Malta Postpaid', 22, '10GB 4G/5G', '2 lines ~€10/line. GO is largest carrier. EU roaming included.', 'EUR'],
  Mexico: ['Telcel Postpaid', 16, '5GB 4G/5G', '2 lines ~MX$150/line (~$8). Telcel has best coverage. IVA included.', 'MXN'],
  Panama: ['+Movil Postpaid', 20, '3GB 4G/5G', '2 lines ~$10/line. +Movil best coverage. ITBMS tax included.', 'USD'],
  Portugal: ['NOS Postpaid', 20, '10GB 5G', '2 lines ~€9/line (~$10). NOS or MEO best coverage. EU roaming included.', 'EUR'],
  Spain: ['Digi Mobil', 14, '5GB 4G/5G', '2 lines €3/line (~$3.25) + €4/line data. Digi is cheapest carrier. EU roaming included.', 'EUR'],
  Uruguay: ['Antel Postpaid', 22, '6GB 4G', '2 lines ~UY$450/line (~$11). Antel is state telecom, best coverage.', 'UYU'],
};

// ────────────────────────────────────────────────────────────────
// Process all locations
// ────────────────────────────────────────────────────────────────

const dirs = fs.readdirSync(DATA_DIR).filter(d =>
  fs.statSync(path.join(DATA_DIR, d)).isDirectory()
);

let created = 0;
let updated = 0;
let skipped = 0;

for (const dir of dirs) {
  const locPath = path.join(DATA_DIR, dir, 'location.json');
  const dcPath = path.join(DATA_DIR, dir, 'detailed-costs.json');

  if (!fs.existsSync(locPath)) continue;

  const loc = JSON.parse(fs.readFileSync(locPath, 'utf-8'));
  const country = loc.country;

  // Build cellPhone data
  let cellPhone;
  if (country === 'United States') {
    const entry = US_TAX_RATES[dir];
    if (!entry) {
      console.log(`  ⚠ ${dir}: no US tax rate entry — skipping`);
      skipped++;
      continue;
    }
    cellPhone = usPlans(entry[0], entry[1]);
  } else {
    const carrier = INTL_CARRIERS[country];
    if (!carrier) {
      console.log(`  ⚠ ${dir}: no carrier template for "${country}" — skipping`);
      skipped++;
      continue;
    }
    cellPhone = intlPlans(country, carrier[0], carrier[1], carrier[2], carrier[3], carrier[4]);
  }

  // Read or create detailed-costs.json
  let dc = {};
  if (fs.existsSync(dcPath)) {
    dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
    if (dc.cellPhone) {
      console.log(`  ✓ ${dir}: already has cellPhone data — skipping`);
      skipped++;
      continue;
    }
  }

  dc.cellPhone = cellPhone;
  fs.writeFileSync(dcPath, JSON.stringify(dc, null, 2) + '\n', 'utf-8');

  // Also update monthlyCosts.phoneCell if needed
  const currentTypical = loc.monthlyCosts?.phoneCell?.typical ?? 0;
  const newTypical = cellPhone.monthlyBudget.typical;
  if (currentTypical !== newTypical) {
    loc.monthlyCosts.phoneCell = {
      typical: newTypical,
      min: cellPhone.monthlyBudget.min,
      max: cellPhone.monthlyBudget.max,
      annualInflation: loc.monthlyCosts?.phoneCell?.annualInflation ?? 0.02,
    };
    fs.writeFileSync(locPath, JSON.stringify(loc, null, 2) + '\n', 'utf-8');
    console.log(`  + ${dir}: cellPhone $${currentTypical} → $${newTypical}/mo (${country === 'United States' ? 'T-Mobile 55+' : INTL_CARRIERS[country]?.[0] || 'local'})`);
    updated++;
  } else {
    console.log(`  + ${dir}: added cellPhone detail (typical $${newTypical}/mo unchanged)`);
  }
  created++;
}

console.log(`\nDone: ${created} created, ${updated} monthlyCosts updated, ${skipped} skipped`);
