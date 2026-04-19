/**
 * Backfill healthcarePreMedicare + healthcare.acaMarketplace on every US
 * location. Uses state-level 2024/2025 benchmark silver pricing for a
 * 2-adult household age 60. Idempotent — re-running on already-backfilled
 * locations updates the values to match the latest STATE_PREMIUMS table.
 *
 * Run:   node tools/backfill-aca.mjs [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');
const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

/**
 * State → { silver2Adult, silverSingle, notes } for a 60yo couple. Numbers
 * pulled from KFF / healthcare.gov 2024/2025 benchmark silver averages.
 * ±10% location-to-location variation is expected; these are state midpoints.
 */
const STATE_PREMIUMS = {
  AL: { two: 2700, one: 1400, notes: 'Alabama marketplace — Blue Cross Blue Shield dominant insurer.' },
  AK: { two: 3200, one: 1650, notes: 'Alaska marketplace — limited insurers, high costs.' },
  AR: { two: 2500, one: 1300, notes: 'Arkansas marketplace.' },
  AZ: { two: 2300, one: 1200, notes: 'Arizona marketplace — multiple insurers.' },
  CA: { two: 2900, one: 1500, notes: 'Covered California — varies heavily by region.' },
  CO: { two: 2200, one: 1150, notes: 'Connect for Health Colorado — reinsurance program lowers premiums.' },
  CT: { two: 3000, one: 1550, notes: 'Access Health CT.' },
  DC: { two: 2400, one: 1250, notes: 'DC Health Link.' },
  DE: { two: 2700, one: 1400, notes: 'Delaware marketplace.' },
  FL: { two: 2400, one: 1250, notes: 'Florida marketplace — most competitive in Miami/Broward.' },
  GA: { two: 2500, one: 1300, notes: 'Georgia Access.' },
  HI: { two: 2200, one: 1150, notes: 'Hawaii marketplace.' },
  IA: { two: 2700, one: 1400, notes: 'Iowa marketplace — single insurer in many counties.' },
  ID: { two: 2300, one: 1200, notes: 'Your Health Idaho.' },
  IL: { two: 2400, one: 1250, notes: 'Get Covered Illinois.' },
  IN: { two: 2600, one: 1350, notes: 'Indiana marketplace.' },
  KS: { two: 2500, one: 1300, notes: 'Kansas marketplace.' },
  KY: { two: 2500, one: 1300, notes: 'Kynect.' },
  LA: { two: 2400, one: 1250, notes: 'Louisiana marketplace.' },
  MA: { two: 2000, one: 1050, notes: 'MA Health Connector — unique regulated marketplace, lowest premiums in US.' },
  MD: { two: 2150, one: 1075, notes: 'Maryland Health Connection — reinsurance reduces premiums.' },
  ME: { two: 2600, one: 1350, notes: 'CoverME.' },
  MI: { two: 2400, one: 1250, notes: 'Michigan marketplace.' },
  MN: { two: 2300, one: 1200, notes: 'MNsure — MinnesotaCare covers below 200% FPL separately.' },
  MO: { two: 2600, one: 1350, notes: 'Missouri marketplace.' },
  MS: { two: 2800, one: 1450, notes: 'Mississippi marketplace — limited competition.' },
  MT: { two: 2500, one: 1300, notes: 'Montana marketplace.' },
  NC: { two: 2500, one: 1300, notes: 'North Carolina marketplace.' },
  ND: { two: 2700, one: 1400, notes: 'North Dakota marketplace — limited insurers.' },
  NE: { two: 2700, one: 1400, notes: 'Nebraska marketplace.' },
  NH: { two: 2600, one: 1350, notes: 'New Hampshire marketplace.' },
  NJ: { two: 2500, one: 1300, notes: 'Get Covered NJ — state reinsurance program.' },
  NM: { two: 2400, one: 1250, notes: 'BeWellNM.' },
  NV: { two: 2300, one: 1200, notes: 'Nevada Health Link.' },
  NY: { two: 2100, one: 1100, notes: 'NY State of Health — NY Essential Plan covers 138-250% FPL free/low-cost.' },
  OH: { two: 2300, one: 1200, notes: 'Ohio marketplace.' },
  OK: { two: 2600, one: 1350, notes: 'Oklahoma marketplace.' },
  OR: { two: 2300, one: 1200, notes: 'Oregon Health Insurance Marketplace.' },
  PA: { two: 2400, one: 1250, notes: 'Pennie — PA state-based marketplace with reinsurance.' },
  RI: { two: 2500, one: 1300, notes: 'HealthSource RI.' },
  SC: { two: 2600, one: 1350, notes: 'South Carolina marketplace.' },
  SD: { two: 2800, one: 1450, notes: 'South Dakota marketplace — limited insurers.' },
  TN: { two: 2400, one: 1250, notes: 'Tennessee marketplace.' },
  TX: { two: 2300, one: 1200, notes: 'Texas marketplace — large metros are most competitive.' },
  UT: { two: 2300, one: 1200, notes: 'Utah marketplace.' },
  VA: { two: 2300, one: 1150, notes: 'Virginia Insurance Marketplace (state-based 2024+).' },
  VT: { two: 2800, one: 1450, notes: 'Vermont Health Connect.' },
  WA: { two: 2200, one: 1150, notes: 'Washington Healthplanfinder — state reinsurance.' },
  WI: { two: 2600, one: 1350, notes: 'Wisconsin marketplace.' },
  WV: { two: 2900, one: 1500, notes: 'West Virginia marketplace — rural premium heavy.' },
  WY: { two: 3000, one: 1550, notes: 'Wyoming marketplace — limited insurers, highest premiums in US.' },

  // Territories — NOT on federal ACA exchange. These use local health systems
  // (Puerto Rico Health Insurance, USVI BlueCross, Guam Regional Medical) and
  // typical private plan costs for a 2-adult household. No federal subsidy cap.
  PR: { two: 1600, one: 800,  notes: 'Puerto Rico — Mi Salud (ACA-like but state-run). Lower costs than mainland.', territory: true },
  VI: { two: 2400, one: 1250, notes: 'USVI BlueCross BlueShield — no federal ACA marketplace.', territory: true },
  GU: { two: 2200, one: 1150, notes: 'Guam — local private plans (TakeCare, NetCare). No ACA marketplace.', territory: true },
  MP: { two: 2300, one: 1200, notes: 'Northern Mariana Islands — limited private coverage.', territory: true },
  AS: { two: 2000, one: 1050, notes: 'American Samoa — LBJ Tropical Medical Center, limited private coverage.', territory: true },
};

/**
 * Explicit mapping for location IDs that don't have a `-xx` state suffix
 * or where the suffix is ambiguous (e.g. `us-virginia` is Fairfax, not the
 * whole state). Keys are the full location id.
 */
const ID_TO_STATE = {
  'us-virginia': 'VA',
  'us-florida': 'FL',
  'us-atlanta': 'GA',
  'us-austin': 'TX',
  'us-raleigh': 'NC',
  'us-richmond': 'VA',
  'us-savannah': 'GA',
  'us-summerville': 'SC',
  'us-cherry-hill': 'NJ',
  'us-philadelphia': 'PA',
  'us-new-york-city': 'NY',
};

function stateFromId(id) {
  if (ID_TO_STATE[id]) return ID_TO_STATE[id];
  const match = id.match(/-([a-z]{2})$/);
  if (match) return match[1].toUpperCase();
  return null;
}

/**
 * Per-location ACA benchmark silver overrides keyed by full location id.
 * Values are estimated county/rating-area level pricing for a 2-adult
 * household both ~age 60, derived from 2024/2025 marketplace patterns.
 * ±15% accuracy vs. a real healthcare.gov quote — verify specific ZIP
 * before making a relocation decision based on the number.
 *
 * When a location id appears here, its values override the state default.
 */
const LOCATION_PREMIUMS = {
  // Virginia — state avg $2,300; Fairfax urban slightly above, rural below
  'us-virginia':          { two: 2300, one: 1150, county: 'Fairfax County',         notes: 'NOVA marketplace: Anthem HealthKeepers, CareFirst, Kaiser. Metro pricing.' },
  'us-annandale-va':      { two: 2300, one: 1150, county: 'Fairfax County',         notes: 'Same Fairfax County rating area as Fairfax City.' },
  'us-lorton-va':         { two: 2300, one: 1150, county: 'Fairfax County',         notes: 'Southern Fairfax County — same rating area as Fairfax.' },
  'us-manassas-va':       { two: 2250, one: 1125, county: 'Prince William County',  notes: 'PWC marketplace — similar to Fairfax with slightly more competition.' },
  'us-gainesville-va':    { two: 2250, one: 1125, county: 'Prince William County',  notes: 'PWC marketplace — similar to Fairfax with slightly more competition.' },
  'us-chesapeake-va':     { two: 2250, one: 1125, county: 'Chesapeake City',        notes: 'Hampton Roads — Sentara dominant, Optima Health available.' },
  'us-lynchburg-va':      { two: 2400, one: 1200, county: 'Lynchburg City',         notes: 'Central VA — limited insurer competition vs NOVA.' },
  'us-norfolk-va':        { two: 2250, one: 1125, county: 'Norfolk City',           notes: 'Hampton Roads marketplace.' },
  'us-portsmouth-va':     { two: 2300, one: 1150, county: 'Portsmouth City',        notes: 'Hampton Roads marketplace.' },
  'us-richmond':          { two: 2300, one: 1150, county: 'Henrico County',         notes: 'Richmond metro — Anthem, Sentara compete.' },
  'us-virginia-beach-va': { two: 2250, one: 1125, county: 'Virginia Beach City',    notes: 'Coastal VA — competitive marketplace.' },

  // Maryland — state reinsurance program lowers premiums; urban vs rural modest
  'us-annapolis-md':      { two: 2150, one: 1075, county: 'Anne Arundel County',    notes: 'MD Health Connection: CareFirst, Kaiser, UnitedHealthcare.' },
  'us-baltimore-md':      { two: 2050, one: 1025, county: 'Baltimore City',         notes: 'Baltimore metro — most competitive marketplace in MD.' },
  'us-bowie-md':          { two: 2200, one: 1100, county: 'Prince George\'s County', notes: 'MD Health Connection: CareFirst, Kaiser, UnitedHealthcare. PG County rating area.' },
  'us-elkridge-md':       { two: 2200, one: 1100, county: 'Howard County',          notes: 'MD Health Connection — Howard County rating area (competitive).' },
  'us-glen-burnie-md':    { two: 2150, one: 1075, county: 'Anne Arundel County',    notes: 'MD Health Connection — Anne Arundel rating area.' },
  'us-catonsville-md':    { two: 2100, one: 1050, county: 'Baltimore County',       notes: 'MD Health Connection — Baltimore County rating area (competitive).' },

  // Florida — statewide FL location is a weighted mix; metro/rural spread
  'us-florida':           { two: 2400, one: 1200, county: 'statewide',              notes: 'Statewide average; varies by county from ~$2,300 (Miami) to $2,500 (rural panhandle).' },
  'us-fort-lauderdale-fl':{ two: 2300, one: 1150, county: 'Broward County',         notes: 'Broward — Ambetter, Florida Blue, Molina compete.' },
  'us-miami-fl':          { two: 2300, one: 1150, county: 'Miami-Dade County',      notes: 'Miami-Dade — most competitive FL marketplace.' },
  'us-palm-bay-fl':       { two: 2400, one: 1200, county: 'Brevard County',         notes: 'Space Coast — moderate competition.' },
  'us-quincy-fl':         { two: 2500, one: 1250, county: 'Gadsden County',         notes: 'North FL panhandle — limited competition.' },
  'us-st-augustine-fl':   { two: 2400, one: 1200, county: 'St Johns County',        notes: 'NE FL — Florida Blue dominant.' },
  'us-st-petersburg-fl':  { two: 2350, one: 1175, county: 'Pinellas County',        notes: 'Tampa Bay metro — competitive.' },
  'us-tampa-fl':          { two: 2300, one: 1150, county: 'Hillsborough County',    notes: 'Tampa Bay metro — multiple insurers.' },
  'us-yulee-fl':          { two: 2450, one: 1225, county: 'Nassau County',          notes: 'Rural NE FL — fewer insurers than Jacksonville metro.' },

  // Pennsylvania — Pennie (state marketplace) + reinsurance
  'us-philadelphia':      { two: 2300, one: 1150, county: 'Philadelphia County',    notes: 'Pennie — Philadelphia metro most competitive in PA.' },
  'us-pittsburgh-pa':     { two: 2250, one: 1125, county: 'Allegheny County',       notes: 'Pennie — Pittsburgh metro, Highmark + UPMC.' },
  'us-armstrong-county-pa':{ two:2500, one: 1250, county: 'Armstrong County',       notes: 'Rural Western PA — higher premiums, fewer insurers.' },
  'us-williamsport-pa':   { two: 2500, one: 1250, county: 'Lycoming County',        notes: 'Rural North-Central PA — limited competition.' },

  // North Carolina
  'us-asheville-nc':      { two: 2550, one: 1275, county: 'Buncombe County',        notes: 'Western NC — Blue Cross NC dominant.' },
  'us-raleigh':           { two: 2400, one: 1200, county: 'Wake County',            notes: 'Raleigh-Durham — competitive metro marketplace.' },

  // South Carolina
  'us-summerville':       { two: 2550, one: 1275, county: 'Dorchester County',      notes: 'Charleston metro SC — BlueCross BlueShield SC dominant.' },

  // Georgia
  'us-atlanta':           { two: 2400, one: 1200, county: 'Fulton County',          notes: 'Atlanta metro — Ambetter, Anthem, Kaiser compete.' },
  'us-savannah':          { two: 2450, one: 1225, county: 'Chatham County',         notes: 'Coastal GA — moderate competition.' },

  // Alabama
  'us-birmingham-al':     { two: 2650, one: 1325, county: 'Jefferson County',       notes: 'BCBS Alabama dominant — limited marketplace competition.' },

  // Tennessee
  'us-nashville-tn':      { two: 2350, one: 1175, county: 'Davidson County',        notes: 'Nashville metro — Ambetter, BlueCross TN compete.' },

  // Texas — state avg $2,300; metros competitive
  'us-austin':            { two: 2250, one: 1125, county: 'Travis County',          notes: 'Austin metro — Ambetter, Oscar, Blue Cross TX.' },
  'us-dallas-tx':         { two: 2250, one: 1125, county: 'Dallas County',          notes: 'DFW — highly competitive marketplace.' },
  'us-fort-worth-tx':     { two: 2250, one: 1125, county: 'Tarrant County',         notes: 'DFW — same rating area as Dallas.' },
  'us-killeen-tx':        { two: 2350, one: 1175, county: 'Bell County',            notes: 'Central TX — moderate competition.' },
  'us-san-marcos-tx':     { two: 2300, one: 1150, county: 'Hays County',            notes: 'Austin-San Antonio corridor.' },

  // Arkansas
  'us-little-rock-ar':    { two: 2500, one: 1250, county: 'Pulaski County',         notes: 'Arkansas — single-insurer-dominant in many counties.' },

  // New Mexico
  'us-albuquerque-nm':    { two: 2350, one: 1175, county: 'Bernalillo County',      notes: 'BeWellNM — Albuquerque metro most competitive.' },

  // Illinois
  'us-chicago-il':        { two: 2350, one: 1175, county: 'Cook County',            notes: 'Chicago metro — Blue Cross IL dominant, Ambetter + Oscar compete.' },

  // Ohio
  'us-cleveland-oh':      { two: 2250, one: 1125, county: 'Cuyahoga County',        notes: 'Cleveland metro — Medical Mutual, Anthem, CareSource.' },
  'us-lorain-oh':         { two: 2300, one: 1150, county: 'Lorain County',          notes: 'NE Ohio — similar to Cleveland rating area.' },

  // Indiana
  'us-fort-wayne-in':     { two: 2550, one: 1275, county: 'Allen County',           notes: 'NE Indiana — Anthem dominant.' },

  // Michigan
  'us-lapeer-mi':         { two: 2400, one: 1200, county: 'Lapeer County',          notes: 'Thumb of MI — BCBSM dominant.' },
  'us-oakland-county-mi': { two: 2350, one: 1175, county: 'Oakland County',         notes: 'Metro Detroit — BCBSM + Priority Health + Molina.' },
  'us-port-huron-mi':     { two: 2450, one: 1225, county: 'St Clair County',        notes: 'Eastern MI — BCBSM dominant.' },

  // Wisconsin
  'us-milwaukee-wi':      { two: 2500, one: 1250, county: 'Milwaukee County',       notes: 'Milwaukee metro — Anthem, Quartz, Dean Health.' },

  // Minnesota
  'us-minneapolis-mn':    { two: 2250, one: 1125, county: 'Hennepin County',        notes: 'MNsure — Twin Cities most competitive in MN.' },
  'us-saint-paul-mn':     { two: 2300, one: 1150, county: 'Ramsey County',          notes: 'Twin Cities — similar to Hennepin.' },

  // North Dakota
  'us-grand-forks-nd':    { two: 2700, one: 1350, county: 'Grand Forks County',     notes: 'BCBS ND dominant — limited insurer competition.' },

  // Maine
  'us-skowhegan-me':      { two: 2700, one: 1350, county: 'Somerset County',        notes: 'Rural central ME — Harvard Pilgrim, Community Health Options.' },

  // New Jersey — Get Covered NJ with reinsurance
  'us-camden-nj':         { two: 2450, one: 1225, county: 'Camden County',          notes: 'Southern NJ — Ambetter, AmeriHealth, Oscar, Horizon.' },
  'us-cherry-hill':       { two: 2450, one: 1225, county: 'Camden County',          notes: 'Southern NJ — same rating area as Camden.' },

  // New York — Essential Plan covers 138-250% FPL; cheapest silver in US for higher earners
  'us-new-york-city':     { two: 2100, one: 1050, county: 'NYC metro',              notes: 'NY State of Health — Essential Plan covers low/mid income separately.' },

  // Colorado — reinsurance program
  'us-denver-co':         { two: 2100, one: 1050, county: 'Denver County',          notes: 'Connect for Health CO — reinsurance reduces premiums 20%+.' },

  // US Territories — not on federal ACA marketplace
  'us-charlotte-amalie-vi': { two: 2400, one: 1200, county: 'St Thomas',            notes: 'USVI BCBS — no federal ACA marketplace, no subsidies.', territory: true },
  'us-christiansted-vi':  { two: 2400, one: 1200, county: 'St Croix',               notes: 'USVI BCBS — no federal ACA marketplace, no subsidies.', territory: true },
  'us-dededo-gu':         { two: 2200, one: 1100, county: 'Guam',                   notes: 'Guam — TakeCare, NetCare local plans. No ACA marketplace.', territory: true },
  'us-hagatna-gu':        { two: 2200, one: 1100, county: 'Guam',                   notes: 'Guam local private plans.', territory: true },
  'us-pago-pago-as':      { two: 2000, one: 1000, county: 'American Samoa',         notes: 'LBJ Tropical Medical Center. Very limited private coverage.', territory: true },
  'us-ponce-pr':          { two: 1600, one: 800,  county: 'Ponce',                  notes: 'Mi Salud (PR state-run). Lower costs than mainland.', territory: true },
  'us-saipan-mp':         { two: 2300, one: 1150, county: 'Saipan',                 notes: 'Northern Marianas — limited private coverage.', territory: true },
  'us-san-juan-pr':       { two: 1600, one: 800,  county: 'San Juan',               notes: 'Mi Salud — better infrastructure than rural PR.', territory: true },
  'us-tafuna-as':         { two: 2000, one: 1000, county: 'American Samoa',         notes: 'LBJ Tropical Medical Center coverage.', territory: true },
  'us-tinian-mp':         { two: 2300, one: 1150, county: 'Tinian',                 notes: 'Remote NMI — limited medical infrastructure.', territory: true },
};

const dirs = readdirSync(DATA_DIR).filter(d => d.startsWith('us-'));
let updated = 0, skipped = 0, unknown = 0;
const touchedIds = [];

for (const dir of dirs) {
  const file = join(DATA_DIR, dir, 'location.json');
  if (!existsSync(file)) continue;
  const loc = JSON.parse(readFileSync(file, 'utf-8'));
  const state = stateFromId(loc.id);

  // Per-location (county-level) override takes priority over state avg.
  const override = LOCATION_PREMIUMS[loc.id];
  const premium = override ?? (state ? STATE_PREMIUMS[state] : null);
  const level = override ? 'county' : 'state';

  if (!premium) {
    console.log(`  ?  ${loc.id} — no premium data (state=${state ?? '—'})`);
    unknown++;
    continue;
  }

  const source = override
    ? `${override.county}, ${state}`
    : `${state} state average`;
  const disclaimer = 'Estimated ±15% vs healthcare.gov quote — verify for a specific ZIP before relying on the number.';

  // Ensure monthlyCosts.healthcarePreMedicare
  loc.monthlyCosts ??= {};
  loc.monthlyCosts.healthcarePreMedicare = {
    min: Math.round(premium.two * 0.82),
    max: Math.round(premium.two * 1.18),
    typical: premium.two,
    annualInflation: 0.06,
    notes: `ACA silver benchmark for 2-adult household both age ~60, before subsidies. ${level === 'county' ? 'County-level' : 'State-level'} estimate (${source}). ${premium.notes} ${disclaimer}`,
  };

  // Ensure healthcare.acaMarketplace
  loc.healthcare ??= {};
  loc.healthcare.acaMarketplace = {
    benchmarkSilverMonthly2Adult: premium.two,
    benchmarkSilverMonthlySingle: premium.one,
    premiumCapPctOfIncome: premium.territory ? 0 : 0.085,
    rateArea: override?.county ?? undefined,
    notes: premium.notes,
    estimationLevel: level,
    disclaimer,
  };

  if (!dryRun) {
    writeFileSync(file, JSON.stringify(loc, null, 2) + '\n', 'utf-8');
  }
  updated++;
  touchedIds.push(loc.id);
  console.log(`  ↻  ${loc.id}  (${level}, ${source}, $${premium.two}/mo)`);
}

console.log(`\n${dryRun ? 'DRY RUN — ' : ''}${updated} updated, ${skipped} skipped, ${unknown} unknown-state.`);

if (!dryRun && touchedIds.length) {
  // Reseed DB via the AdminLocation upsert pattern (matches insert-new-locations.mjs).
  const ALTERNATE_KEYS = new Set(['healthcarePreMedicare']);
  function extractSearchFields(l) {
    let total = 0;
    for (const [key, val] of Object.entries(l.monthlyCosts ?? {})) {
      if (ALTERNATE_KEYS.has(key)) continue;
      if (val && typeof val.typical === 'number') total += val.typical;
    }
    return {
      name: l.name || '',
      country: l.country || '',
      region: l.region || '',
      currency: l.currency || 'USD',
      monthlyCostTotal: Math.round(total),
    };
  }

  console.log(`\nReseeding ${touchedIds.length} locations into DB...`);
  for (const id of touchedIds) {
    const loc = JSON.parse(readFileSync(join(DATA_DIR, id, 'location.json'), 'utf-8'));
    const search = extractSearchFields(loc);
    const existing = await prisma.adminLocation.findUnique({ where: { id } });
    if (existing) {
      const newVersion = existing.version + 1;
      await prisma.$transaction(async (tx) => {
        await tx.adminLocation.update({
          where: { id }, data: { locationData: loc, version: newVersion, ...search },
        });
        await tx.adminLocationHistory.create({
          data: { locationId: id, version: newVersion, locationData: loc, changedBy: 'backfill-aca' },
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.adminLocation.create({ data: { id, version: 1, locationData: loc, ...search } });
        await tx.adminLocationHistory.create({
          data: { locationId: id, version: 1, locationData: loc, changedBy: 'backfill-aca' },
        });
      });
    }
  }
  console.log(`✓ Reseed complete.`);
}

await prisma.$disconnect();
