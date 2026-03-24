import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const LOCATIONS_DIR = join(DATA_DIR, 'locations');

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function log(msg) { process.stderr.write(msg + '\n'); }

// ===== UTILITY BREAKDOWN DATA =====
// Separate line items: electricity (heating+cooling+general), gas, water, sewage, trash
// Internet is NOT included here — it's in the entertainment category (Cable + 1 Gig Internet)
//
// For each location:
//   - Items "includedInRent: true" are already in monthlyCosts.rent and should NOT be double-counted
//   - The utilities total = sum of items where includedInRent is false
//   - Tax notes indicate whether sales tax / VAT applies to residential utilities
//
// US: All utility bills are separate from rent for single-family house rentals.
//     Previous data had "trashWaterSewer" bundled in housing/rent — that is being moved to utilities.
//
// France: TEOM (garbage tax) stays in rent. Water includes sewage (assainissement).
//         No separate A/C needed in most areas.
//
// Spain: Basura (garbage) stays in rent. Water includes sewage (alcantarillado).
//
// Portugal: Trash included in municipal water bill. Condominio fees stay in rent.
//
// Panama: Garbage collection stays in rent. Water separate.

const UTILITY_DATA = {
  // ===== US LOCATIONS =====
  // Residential utilities generally not subject to state sales tax in VA, NJ, PA, GA, FL, NC
  // (some states tax electricity but exempt water/sewer; keeping it simple with the dominant rule)

  'us-virginia': {
    electricity: { typical: 155, notes: 'Dominion Energy. Avg across seasons — $100 winter, $220 summer A/C. Includes general household.' },
    gas: { typical: 65, notes: 'Washington Gas. Natural gas heating (Nov–Mar primary), cooking, water heater.' },
    water: { typical: 50, notes: 'Fairfax Water Authority. 2-adult household, ~6,000 gal/mo.' },
    sewage: { typical: 45, notes: 'Billed with water. Fairfax County sanitary sewer charge.' },
    trash: { typical: 30, notes: 'Fairfax County solid waste. Billed quarterly (~$90/qtr).' },
    annualInflation: 0.03,
    taxes: 'Virginia exempts residential utilities from state sales tax.',
    total: 345
  },
  'us-cherry-hill': {
    electricity: { typical: 130, notes: 'PSE&G/JCP&L. Moderate A/C needs; electric heat supplement.' },
    gas: { typical: 75, notes: 'PSE&G. Natural gas primary heat (cold NJ winters), cooking, water heater.' },
    water: { typical: 45, notes: 'NJ American Water. 2-adult household.' },
    sewage: { typical: 35, notes: 'Camden County MUA. Billed separately or with water.' },
    trash: { typical: 25, notes: 'Township municipal collection. Some areas included in property tax.' },
    annualInflation: 0.03,
    taxes: 'New Jersey exempts residential utilities from sales tax.',
    total: 310
  },
  'us-philadelphia': {
    electricity: { typical: 125, notes: 'PECO Energy. Moderate A/C; some electric heat in older homes.' },
    gas: { typical: 70, notes: 'PGW (Philadelphia Gas Works). Primary heating, cooking.' },
    water: { typical: 55, notes: 'Philadelphia Water Dept. Among highest water rates in US. Tiered pricing.' },
    sewage: { typical: 40, notes: 'Billed with water. Philadelphia stormwater + sewer charges.' },
    trash: { typical: 20, notes: 'City of Philadelphia Streets Dept. Included in city services for most residences.' },
    annualInflation: 0.03,
    taxes: 'Pennsylvania exempts residential utilities from 6% sales tax.',
    total: 310
  },
  'us-richmond': {
    electricity: { typical: 135, notes: 'Dominion Energy. A/C heavy in summer (Jun–Sep). Heat pump common.' },
    gas: { typical: 50, notes: 'Virginia Natural Gas or propane. Moderate heating needs.' },
    water: { typical: 45, notes: 'City of Richmond Dept of Public Utilities.' },
    sewage: { typical: 35, notes: 'Billed with water. Richmond wastewater charge.' },
    trash: { typical: 25, notes: 'City of Richmond solid waste. Weekly curbside collection.' },
    annualInflation: 0.03,
    taxes: 'Virginia exempts residential utilities from state sales tax.',
    total: 290
  },
  'us-savannah': {
    electricity: { typical: 145, notes: 'Georgia Power. Heavy A/C usage (Apr–Oct). Humid subtropical climate.' },
    gas: { typical: 30, notes: 'Atlanta Gas Light/SCANA. Minimal heating (Dec–Feb mild). Cooking, water heater.' },
    water: { typical: 45, notes: 'City of Savannah Water/Sewer. 2-adult household.' },
    sewage: { typical: 35, notes: 'Billed with water. City of Savannah wastewater.' },
    trash: { typical: 25, notes: 'City of Savannah Sanitation Dept. Weekly curbside pickup.' },
    annualInflation: 0.03,
    taxes: 'Georgia exempts residential water/sewer from sales tax. Electricity subject to 4% state + local.',
    total: 280
  },
  'us-florida': {
    electricity: { typical: 185, notes: 'FPL (Florida Power & Light). A/C runs 8+ months. Among highest US electricity costs. All-electric homes common.' },
    gas: { typical: 15, notes: 'Most FL homes all-electric. Propane for some cooking/grills only.' },
    water: { typical: 55, notes: 'Municipal water utility. Tiered rates; lawn irrigation can spike bills.' },
    sewage: { typical: 45, notes: 'Billed with water. Florida municipal wastewater charges.' },
    trash: { typical: 30, notes: 'County solid waste collection. Billed monthly or quarterly.' },
    annualInflation: 0.03,
    taxes: 'Florida: no sales tax on residential water/sewer. Electricity has gross receipts tax (~2.5%) built into rate.',
    total: 330
  },
  'us-atlanta': {
    electricity: { typical: 155, notes: 'Georgia Power. Heavy A/C (May–Sep), moderate electric heat supplement.' },
    gas: { typical: 45, notes: 'Atlanta Gas Light. Natural gas heating (Dec–Feb), cooking, water heater.' },
    water: { typical: 50, notes: 'City of Atlanta Dept of Watershed Mgmt / DeKalb County Water. Among higher US water rates.' },
    sewage: { typical: 35, notes: 'Billed with water. Atlanta/DeKalb sewer charges.' },
    trash: { typical: 25, notes: 'City of Atlanta Dept of Public Works. Weekly curbside collection included in city services.' },
    annualInflation: 0.03,
    taxes: 'Georgia exempts residential water/sewer from sales tax. Electricity subject to 4% state + local.',
    total: 310
  },
  'us-punta-gorda': {
    electricity: { typical: 175, notes: 'FPL. A/C runs most of year in SW Florida. All-electric homes standard.' },
    gas: { typical: 0, notes: 'All-electric area. No natural gas infrastructure in most of Charlotte County.' },
    water: { typical: 50, notes: 'Charlotte County Utilities. Tiered rates.' },
    sewage: { typical: 45, notes: 'Charlotte County Utilities. Billed with water.' },
    trash: { typical: 30, notes: 'Charlotte County Solid Waste. Mandatory curbside collection.' },
    annualInflation: 0.03,
    taxes: 'Florida: no sales tax on residential water/sewer. Electricity has gross receipts tax (~2.5%) built into rate.',
    total: 300
  },
  'us-raleigh': {
    electricity: { typical: 135, notes: 'Duke Energy Progress. A/C in summer, heat pump common. Moderate 4-season climate.' },
    gas: { typical: 55, notes: 'PSNC Energy (Dominion). Natural gas heating (Nov–Mar), cooking.' },
    water: { typical: 45, notes: 'Raleigh Public Utilities / Durham Water Mgmt.' },
    sewage: { typical: 30, notes: 'Billed with water. Wake County / Durham wastewater.' },
    trash: { typical: 25, notes: 'City of Raleigh Solid Waste. Weekly curbside collection.' },
    annualInflation: 0.03,
    taxes: 'North Carolina: 7% combined sales tax applies to electricity and gas. Water/sewer exempt.',
    total: 290
  },

  // ===== FRANCE =====
  // All utilities separate from rent. TEOM (garbage tax) stays in rent.
  // TVA: 5.5% on water/sewage (assainissement), 20% on electricity/gas — already in provider bills
  // Internet is NOT included here (it's in entertainment as Cable + 1 Gig)
  // French water bills include assainissement (sewage treatment) as a line item
  // Trash: TEOM (taxe d'enlèvement des ordures ménagères) is collected with property tax and
  //        passed to tenant — already included in rent as taxeOrduresMenageres

  'france-brittany': {
    electricity: { typical: 90, notes: 'EDF tarif bleu. ~8,000 kWh/yr. Electric radiator supplement in older homes. No A/C needed.' },
    gas: { typical: 60, notes: 'Engie/GRDF. Natural gas central heating (Oct–Apr primary). Cooking.' },
    water: { typical: 40, notes: 'Veolia/Suez. Includes assainissement (sewage treatment). ~120m³/yr for 2 adults.' },
    sewage: { typical: 0, notes: 'Included in water bill as assainissement collectif.' },
    trash: { typical: 0, notes: 'TEOM (taxe d\'enlèvement des ordures ménagères) included in rent — €18/mo.' },
    annualInflation: 0.025,
    taxes: 'TVA included in bills: 5.5% on water/assainissement, 20% on electricity/gas.',
    total: 190,
    currency: 'EUR'
  },
  'france-lyon': {
    electricity: { typical: 100, notes: 'EDF. ~9,000 kWh/yr. Cold winters increase heating load. Minimal A/C.' },
    gas: { typical: 70, notes: 'Engie/GRDF. Natural gas central heating (Oct–Apr). Lyon winters colder than south.' },
    water: { typical: 45, notes: 'Eau du Grand Lyon (Veolia). Includes assainissement. ~120m³/yr.' },
    sewage: { typical: 0, notes: 'Included in water bill as assainissement collectif.' },
    trash: { typical: 0, notes: 'TEOM included in rent — €22/mo.' },
    annualInflation: 0.025,
    taxes: 'TVA included in bills: 5.5% on water/assainissement, 20% on electricity/gas.',
    total: 215,
    currency: 'EUR'
  },
  'france-montpellier': {
    electricity: { typical: 95, notes: 'EDF. Moderate heating (mild winters). Some A/C use in summer (Jul–Aug hot).' },
    gas: { typical: 45, notes: 'Engie/GRDF. Less gas heating needed — Mediterranean climate milder.' },
    water: { typical: 40, notes: 'Suez/Veolia. Includes assainissement. Water slightly more expensive in south due to scarcity.' },
    sewage: { typical: 0, notes: 'Included in water bill as assainissement collectif.' },
    trash: { typical: 0, notes: 'TEOM included in rent — €20/mo.' },
    annualInflation: 0.025,
    taxes: 'TVA included in bills: 5.5% on water/assainissement, 20% on electricity/gas.',
    total: 180,
    currency: 'EUR'
  },
  'france-toulouse': {
    electricity: { typical: 90, notes: 'EDF. Moderate heating. Some A/C use (Toulouse summer highs 86°F).' },
    gas: { typical: 50, notes: 'Engie/GRDF. Natural gas heating (Nov–Mar). Toulouse has moderate winters.' },
    water: { typical: 40, notes: 'Veolia Eau. Includes assainissement. ~120m³/yr.' },
    sewage: { typical: 0, notes: 'Included in water bill as assainissement collectif.' },
    trash: { typical: 0, notes: 'TEOM included in rent — €19/mo.' },
    annualInflation: 0.025,
    taxes: 'TVA included in bills: 5.5% on water/assainissement, 20% on electricity/gas.',
    total: 180,
    currency: 'EUR'
  },

  // ===== SPAIN =====
  // All utilities separate from rent. Basura (garbage tax) stays in rent.
  // IVA: 10% on electricity (reduced rate), 10% on gas, 10% on water — already in bills
  // Sewage (alcantarillado) is included in the water bill
  // Basura (garbage collection tax) ~€90–110/yr is billed separately or with IBI — in rent

  'spain-alicante': {
    electricity: { typical: 85, notes: 'Iberdrola/Endesa. A/C significant May–Sep (90°F summers). Electric heating in winter mild.' },
    gas: { typical: 25, notes: 'Natural gas or butano (propane canister ~€15/refill). Mild winters, less heating needed.' },
    water: { typical: 35, notes: 'AMAEM (Alicante municipal water). Includes alcantarillado (sewage). Tiered rates, water scarcity surcharges.' },
    sewage: { typical: 0, notes: 'Included in water bill as alcantarillado.' },
    trash: { typical: 0, notes: 'Basura (garbage tax) included in rent — €8/mo.' },
    annualInflation: 0.03,
    taxes: 'IVA included in bills: 10% on electricity, 10% on gas, 10% on water/sewage.',
    total: 145,
    currency: 'EUR'
  },

  // ===== PORTUGAL =====
  // All utilities separate from rent. Trash is included in municipal water bill.
  // IVA: 6% on electricity (first 150 kWh/mo), 23% above; 6% on water (essential); 23% on gas
  // Sewage and trash included in municipal water bill as separate line items

  'portugal-lisbon': {
    electricity: { typical: 80, notes: 'EDP/Endesa. Moderate A/C in summer (Lisbon 85°F). Electric heating in winter. 6% IVA on first 150kWh, 23% above.' },
    gas: { typical: 30, notes: 'Galp/EDP. Natural gas or butano for cooking/water heater. Mild winters, less heating.' },
    water: { typical: 35, notes: 'EPAL (Lisbon) / municipal. Includes saneamento (sewage) and resíduos (waste) as line items. 6% IVA.' },
    sewage: { typical: 0, notes: 'Included in water bill as saneamento.' },
    trash: { typical: 0, notes: 'Included in water bill as taxa de resíduos sólidos.' },
    annualInflation: 0.03,
    taxes: 'IVA: 6% on electricity (≤150kWh), 23% above; 6% on water; 23% on gas. All included in bills.',
    total: 145,
    currency: 'EUR'
  },

  // ===== PANAMA =====
  // Electricity and water separate from rent. Garbage/municipal fee stays in rent.
  // ITBMS (7%) applies to electricity. Water is exempt for residential.
  // No heating needed (tropical). A/C is the dominant utility cost.
  // No natural gas infrastructure — all-electric + propane for some cooking.

  'panama-city': {
    electricity: { typical: 100, notes: 'Naturgy/ENSA. A/C is primary cost — runs year-round in tropical climate. 7% ITBMS applies.' },
    gas: { typical: 15, notes: 'Propane (tanque) for cooking only. No natural gas infrastructure.' },
    water: { typical: 25, notes: 'IDAAN (national water authority). Very affordable residential water. No ITBMS on residential water.' },
    sewage: { typical: 10, notes: 'Billed with water or included in municipal services.' },
    trash: { typical: 0, notes: 'Garbage collection included in rent — $15/mo.' },
    annualInflation: 0.03,
    taxes: 'ITBMS 7% on electricity (included in bill). Water/sewer exempt for residential.',
    total: 150,
    currency: 'USD'
  },
  'panama-boquete': {
    electricity: { typical: 50, notes: 'EDECHI. Much less A/C needed — Boquete at 3,900ft elevation, 55–78°F year-round. Fans sufficient most days.' },
    gas: { typical: 10, notes: 'Propane (tanque) for cooking. No natural gas.' },
    water: { typical: 15, notes: 'IDAAN or community water cooperative. Very affordable mountain water.' },
    sewage: { typical: 5, notes: 'Septic systems common in Boquete. Minimal municipal sewer.' },
    trash: { typical: 0, notes: 'Garbage collection included in rent — $10/mo.' },
    annualInflation: 0.025,
    taxes: 'ITBMS 7% on electricity. Water exempt for residential.',
    total: 80,
    currency: 'USD'
  }
};

// ===== US RENT ADJUSTMENTS =====
// Remove trashWaterSewer from rent (moving to utilities to avoid double-counting)
// Water, sewage, and trash are separate utility bills for single-family houses
const US_RENT_ADJUSTMENTS = {
  'us-virginia':     { trashWaterSewer: 115 },
  'us-cherry-hill':  { trashWaterSewer: 95 },
  'us-philadelphia': { trashWaterSewer: 90 },
  'us-richmond':     { trashWaterSewer: 85 },
  'us-savannah':     { trashWaterSewer: 70 },
  'us-florida':      { trashWaterSewer: 90 },
  'us-atlanta':      { trashWaterSewer: 85 },
  'us-punta-gorda':  { trashWaterSewer: 85 },
  'us-raleigh':      { trashWaterSewer: 90 }
};

// ===== UPDATE ALL LOCATIONS =====
let updated = 0;

for (const [locId, data] of Object.entries(UTILITY_DATA)) {
  const locPath = join(LOCATIONS_DIR, locId, 'location.json');
  if (!existsSync(locPath)) {
    log('SKIP ' + locId + ' — no location.json');
    continue;
  }

  const loc = readJSON(locPath);
  const oldUtilTotal = loc.monthlyCosts.utilities.typical;

  // Build new breakdown
  const breakdown = {
    electricity: { typical: data.electricity.typical, notes: data.electricity.notes },
    gas: { typical: data.gas.typical, notes: data.gas.notes },
    water: { typical: data.water.typical, notes: data.water.notes },
    sewage: { typical: data.sewage.typical, notes: data.sewage.notes },
    trash: { typical: data.trash.typical, notes: data.trash.notes }
  };

  // Calculate min/max as proportional to typical (±20%)
  const newTypical = data.total;
  const ratio = newTypical > 0 ? newTypical / (oldUtilTotal || newTypical) : 1;
  const oldMin = loc.monthlyCosts.utilities.min || Math.round(newTypical * 0.8);
  const oldMax = loc.monthlyCosts.utilities.max || Math.round(newTypical * 1.3);

  loc.monthlyCosts.utilities = {
    min: Math.round(newTypical * 0.8),
    max: Math.round(newTypical * 1.3),
    typical: newTypical,
    annualInflation: data.annualInflation,
    breakdown: breakdown,
    taxes: data.taxes,
    notes: 'Electricity (heating+cooling), gas, water, sewage, trash. Internet is in entertainment (Cable+1Gig). ' +
           (data.trash.typical === 0 ? 'Trash included in rent.' : '') +
           (data.sewage.typical === 0 && data.water.typical > 0 ? ' Sewage included in water bill.' : '')
  };

  // For US locations: adjust rent to remove trashWaterSewer (now in utilities)
  const rentAdj = US_RENT_ADJUSTMENTS[locId];
  if (rentAdj) {
    const oldRent = loc.monthlyCosts.rent.typical;
    const adj = rentAdj.trashWaterSewer;
    loc.monthlyCosts.rent.typical -= adj;
    loc.monthlyCosts.rent.min = Math.round(loc.monthlyCosts.rent.min - adj * 0.9);
    loc.monthlyCosts.rent.max = Math.round(loc.monthlyCosts.rent.max - adj * 1.1);
    loc.monthlyCosts.rent.notes = (loc.monthlyCosts.rent.notes || '') +
      ' Water, sewage, and trash are separate utility bills (not included in rent).';
    log('  ' + locId + ' rent: $' + oldRent + ' → $' + loc.monthlyCosts.rent.typical +
        ' (removed $' + adj + ' trashWaterSewer → now in utilities)');
  }

  writeJSON(locPath, loc);
  log('Updated ' + locId + ': utilities $' + oldUtilTotal + ' → $' + newTypical +
      ' (' + Object.entries(breakdown).filter(([k,v]) => v.typical > 0).map(([k,v]) => k + ':' + v.typical).join('+') + ')');
  updated++;
}

// ===== UPDATE DETAILED-COSTS HOUSING BREAKDOWNS =====
// Remove trashWaterSewer from US housing breakdowns for consistency
log('');
log('Updating detailed-costs.json housing breakdowns...');

for (const [locId, adj] of Object.entries(US_RENT_ADJUSTMENTS)) {
  const dcPath = join(LOCATIONS_DIR, locId, 'detailed-costs.json');
  if (!existsSync(dcPath)) continue;

  const dc = readJSON(dcPath);
  if (dc.housing && dc.housing.breakdown && dc.housing.breakdown.trashWaterSewer !== undefined) {
    const oldTotal = dc.housing.breakdown.total;
    delete dc.housing.breakdown.trashWaterSewer;
    dc.housing.breakdown.total = dc.housing.breakdown.baseRent +
      (dc.housing.breakdown.rentersInsurance || 0) +
      (dc.housing.breakdown.localTaxesFees || 0);
    dc.housing.breakdown.notes = 'Water, sewage, and trash are separate utility bills — see utilities breakdown.';
    writeJSON(dcPath, dc);
    log('  ' + locId + ' housing breakdown: $' + oldTotal + ' → $' + dc.housing.breakdown.total +
        ' (removed trashWaterSewer)');
  }
}

log('');
log('Updated ' + updated + ' locations with utility breakdowns.');
log('');
log('Breakdown: electricity (heating+cooling) | gas | water | sewage | trash');
log('Internet excluded from utilities (already in entertainment as Cable + 1 Gig Internet)');
log('US locations: rent reduced (trashWaterSewer moved to utilities)');
log('Non-US: garbage/TEOM stays in rent where applicable');
log('');
log('IMPORTANT: Run "node tools/build-db.js" to rebuild the SQLite database.');
