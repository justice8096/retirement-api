import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function log(msg) { process.stderr.write(msg + '\n'); }

// ===== CELL PHONE PLAN DATA PER LOCATION =====
// Requirements: 2 phones, US service + local service, 1.5GB+ high-speed data/phone, incl taxes
//
// US locations: single domestic plan (T-Mobile 55+ Essentials, 2 lines)
// Non-US locations: US number retention (Google Fi Flexible, 2 lines) + local carrier
//
// US taxes vary by state (8-16% on wireless). European prices include VAT.

const plans = {
  // ===== US LOCATIONS =====
  'us-virginia': {
    monthlyBudget: { min: 50, typical: 62, max: 80 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 7,
        monthlyTotal: 62,
        notes: '2 lines unlimited talk/text/data. VA wireless tax ~9% + federal USF. 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'VA Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },
  'us-cherry-hill': {
    monthlyBudget: { min: 52, typical: 65, max: 85 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 10,
        monthlyTotal: 65,
        notes: '2 lines unlimited talk/text/data. NJ wireless tax ~14% + surcharges. 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'NJ Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },
  'us-philadelphia': {
    monthlyBudget: { min: 55, typical: 68, max: 90 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 13,
        monthlyTotal: 68,
        notes: '2 lines unlimited talk/text/data. PA + Philadelphia wireless tax ~18% (highest in US). 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'PA Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },
  'us-richmond': {
    monthlyBudget: { min: 50, typical: 62, max: 80 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 7,
        monthlyTotal: 62,
        notes: '2 lines unlimited talk/text/data. VA wireless tax ~9% + federal USF. 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'VA Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },
  'us-savannah': {
    monthlyBudget: { min: 50, typical: 63, max: 82 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 8,
        monthlyTotal: 63,
        notes: '2 lines unlimited talk/text/data. GA wireless tax ~12% + federal USF. 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'GA Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },
  'us-florida': {
    monthlyBudget: { min: 50, typical: 63, max: 82 },
    plans: [
      {
        name: 'T-Mobile 55+ Essentials',
        type: 'US Domestic',
        lines: 2,
        dataPerLine: 'Unlimited (50GB priority)',
        baseCost: 55,
        taxesAndFees: 8,
        monthlyTotal: 63,
        notes: '2 lines unlimited talk/text/data. FL wireless tax ~13% + Communications Services Tax. 5G included.'
      }
    ],
    sources: [
      { title: 'T-Mobile 55+ Plans', url: 'https://www.t-mobile.com/cell-phone-plans/unlimited-55-plus' },
      { title: 'FL Wireless Tax Rates', url: 'https://taxfoundation.org/data/all/state/wireless-taxes-2024/' }
    ]
  },

  // ===== FRANCE =====
  'france-brittany': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in France at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'Free Mobile (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '110GB 5G',
        baseCost: 18,
        taxesAndFees: 0,
        monthlyTotal: 20,
        notes: 'Free Mobile €8.99/mo per line (20% TVA included). 110GB 5G data, unlimited calls in France + 35 destinations. ~$20/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'Free Mobile Plans', url: 'https://mobile.free.fr/forfaits' }
    ]
  },
  'france-lyon': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in France at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'Free Mobile (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '110GB 5G',
        baseCost: 18,
        taxesAndFees: 0,
        monthlyTotal: 20,
        notes: 'Free Mobile €8.99/mo per line (20% TVA included). 110GB 5G data, unlimited calls in France + 35 destinations. ~$20/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'Free Mobile Plans', url: 'https://mobile.free.fr/forfaits' }
    ]
  },
  'france-montpellier': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in France at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'Free Mobile (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '110GB 5G',
        baseCost: 18,
        taxesAndFees: 0,
        monthlyTotal: 20,
        notes: 'Free Mobile €8.99/mo per line (20% TVA included). 110GB 5G data, unlimited calls in France + 35 destinations. ~$20/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'Free Mobile Plans', url: 'https://mobile.free.fr/forfaits' }
    ]
  },
  'france-toulouse': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in France at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'Free Mobile (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '110GB 5G',
        baseCost: 18,
        taxesAndFees: 0,
        monthlyTotal: 20,
        notes: 'Free Mobile €8.99/mo per line (20% TVA included). 110GB 5G data, unlimited calls in France + 35 destinations. ~$20/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'Free Mobile Plans', url: 'https://mobile.free.fr/forfaits' }
    ]
  },

  // ===== SPAIN =====
  'spain-alicante': {
    monthlyBudget: { min: 68, typical: 82, max: 100 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in Spain at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'Digi Mobil (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '5GB 4G/5G',
        baseCost: 14,
        taxesAndFees: 0,
        monthlyTotal: 17,
        notes: 'Digi Mobil €7/mo per line (21% IVA included). 5GB data, unlimited calls in Spain. Cheapest quality option. ~$17/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'Digi Mobil Spain', url: 'https://www.digimobil.es/tarifas-movil' }
    ]
  },

  // ===== PORTUGAL =====
  'portugal-lisbon': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in Portugal at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: 'WTF by NOS (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '5GB 4G/5G',
        baseCost: 16,
        taxesAndFees: 0,
        monthlyTotal: 20,
        notes: 'WTF (NOS sub-brand) €8.99/mo per line (23% IVA included). 5GB data, unlimited calls in Portugal. ~$20/mo for 2 lines.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: 'WTF by NOS', url: 'https://www.nos.pt/particulares/tarifarios' }
    ]
  },

  // ===== PANAMA =====
  'panama-boquete': {
    monthlyBudget: { min: 68, typical: 83, max: 100 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in Panama at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: '+Movil Prepaid (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '2GB 4G',
        baseCost: 16,
        taxesAndFees: 2,
        monthlyTotal: 18,
        notes: '+Movil prepaid $8/mo per line + 7% ITBMS. 2GB data, unlimited local calls. Coverage good in Boquete town, limited in highlands.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: '+Movil Panama', url: 'https://www.masmovil.com.pa/' }
    ]
  },
  'panama-city': {
    monthlyBudget: { min: 70, typical: 85, max: 105 },
    plans: [
      {
        name: 'Google Fi Flexible (US Number)',
        type: 'US Service',
        lines: 2,
        dataPerLine: '1.5GB high-speed',
        baseCost: 35,
        taxesAndFees: 0,
        monthlyTotal: 65,
        notes: 'Line 1 $20 + Line 2 $15 = $35 base. Data $10/GB × 3GB = $30. Works in Panama at same rate. Keeps US number for banking/2FA.'
      },
      {
        name: '+Movil Postpaid (Local)',
        type: 'Local Service',
        lines: 2,
        dataPerLine: '3GB 4G/5G',
        baseCost: 18,
        taxesAndFees: 2,
        monthlyTotal: 20,
        notes: '+Movil postpaid $9/mo per line + 7% ITBMS. 3GB data, unlimited calls. Excellent 5G coverage in Panama City.'
      }
    ],
    sources: [
      { title: 'Google Fi Plans', url: 'https://fi.google.com/about/plans' },
      { title: '+Movil Panama', url: 'https://www.masmovil.com.pa/' }
    ]
  }
};

// ===== UPDATE FILES =====
let updated = 0;

for (const [locId, cellData] of Object.entries(plans)) {
  const dcPath = join(DATA_DIR, locId, 'detailed-costs.json');
  const locPath = join(DATA_DIR, locId, 'location.json');

  if (!existsSync(dcPath)) { log('SKIP ' + locId + ' — no detailed-costs.json'); continue; }

  // Update detailed-costs.json
  const dc = readJSON(dcPath);
  dc.cellPhone = cellData;
  writeJSON(dcPath, dc);

  // Update location.json phoneCell
  if (existsSync(locPath)) {
    const loc = readJSON(locPath);
    if (loc.monthlyCosts) {
      const total = cellData.plans.reduce((s, p) => s + p.monthlyTotal, 0);
      loc.monthlyCosts.phoneCell = {
        min: cellData.monthlyBudget.min,
        max: cellData.monthlyBudget.max,
        typical: cellData.monthlyBudget.typical,
        annualInflation: 0.02,
        notes: cellData.plans.map(p => p.name).join(' + ') + '. 2 phones, 1.5GB+ high-speed data each, all taxes included.'
      };
      writeJSON(locPath, loc);
    }
  }

  updated++;
  log('Updated: ' + locId + ' ($' + cellData.monthlyBudget.typical + '/mo)');
}

log('\nDone. Updated ' + updated + ' locations.');
