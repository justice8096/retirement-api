#!/usr/bin/env node
/**
 * One-shot data migration: backfill `monthlyCosts.healthcare.notes` for
 * 14 countries × 61 locations (Todo #20 / #21 follow-up).
 *
 * Strategy: country-level templates applied to all sister cities. Uses
 * the same style as the 31 already-populated entries — public system
 * summary, residency requirement, private-insurance cost band,
 * pre-existing condition treatment, and condition-specific coverage
 * notes (anti-VEGF, GLP-1) for the user's planning context.
 *
 * Idempotent: skips locations that already have a `notes` field.
 *
 * Run: node scripts/backfill-healthcare-notes.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

/**
 * Country → healthcare notes template. Applied to ALL locations in the
 * country. Idempotent (skipped if a notes field already exists, so
 * partial-fill countries only get the missing cities).
 *
 * Sources for the cost / coverage figures:
 *   - National health system websites (SNS PT, SSN IT, ESY GR, etc.)
 *   - OECD Health at a Glance 2023 (cost-of-care comparisons)
 *   - International Living retirement-cost surveys (private insurance)
 *   - Drugs.com / Diabetesnet country availability for GLP-1
 *   - Retina Today / EuRetina for anti-VEGF injection availability
 *
 * All values are estimates; users should verify for their specific
 * city + carrier combination.
 */
const NOTES_BY_COUNTRY = {
  'Colombia': "EPS public system available to residents (Migration Visa M after 5 years for permanent residency). Private international plans ~$80-150/person/mo with pre-existing condition loadings; exclusions common first 6-12 months. Anti-VEGF injections available in Bogotá (Fundación Oftalmológica Nacional), Medellín, Cali. GLP-1 imported, ~$300-450/mo private. Hypertension/diabetes generics widely available at ~10-30% of US prices.",

  'Costa Rica': "CCSS (Caja) universal coverage after pensionado/rentista visa, ~7-11% of declared income (~$60-150/mo). Private (INS / international plans) ~$100-250/mo with pre-existing loadings. Anti-VEGF injections at CIMA and Hospital La Católica in San José. GLP-1 ~$300-400/mo private. Pensionado discount 10-25% on most medical services.",

  'Croatia': "HZZO (Croatian Health Insurance Fund) universal coverage after temporary residence permit. Private supplementary ~€70-130/mo for expat plans. Anti-VEGF injections available in Zagreb (KBC Zagreb) and Split; covered under HZZO with diagnosis. GLP-1 covered for diabetes indication via HZZO. English availability moderate in major hospitals; better in private sector.",

  'Cyprus': "GeSY (General Health System) universal coverage after residency, contributions ~2.65% of income (~€60-120/mo). Private supplementary ~€80-180/mo. Anti-VEGF injections available in Nicosia and Limassol; partial GeSY coverage. GLP-1 covered for diabetes via GeSY. Strong English-speaking healthcare workforce; both public and private widely accessible.",

  'Ecuador': "IESS public system affordable for residents with pensionado/visa, ~$70-90/person/mo. Private international plans ~$80-180/mo. Anti-VEGF injections available in Quito (Hospital Metropolitano), Cuenca, and Guayaquil; ~$1,200-2,000/injection at private clinics. GLP-1 limited availability, ~$300/mo private. Cuenca is a regional medical hub for retirees with strong specialist density.",

  'France': "PUMA universal coverage + Mutuelle complémentaire (~€55-80/person/mo, higher tier for chronic conditions). ALD (Affection Longue Durée) provides 100% coverage for hypertension and diabetes. Macular degeneration: anti-VEGF injections covered 100% at hospital. Hypothyroidism monitoring covered. GLP-1 covered for diabetes indication.",

  'Greece': "ESY (National Health System) universal coverage after residency permit. Private supplementary ~€80-180/mo. Anti-VEGF injections available in Athens (Hygeia, Metropolitan) and Thessaloniki; covered via ESY with prescription. GLP-1 covered for diabetes indication. Crisis-era underfunding means longer public waits — private picks up the gap. English availability moderate, better in private sector.",

  'Ireland': "Private insurance (VHI/Laya Healthcare) ~€220-280/person/mo for 2 adults with pre-existing conditions. Higher loading for macular degeneration, obesity, hypertension. GMS Medical Card may apply based on income. Anti-VEGF injections covered through public ophthalmology. DPS scheme caps drug costs at €80/mo.",

  'Italy': "SSN (Servizio Sanitario Nazionale) universal coverage after Elective Residence visa. Private supplementary ~€60-180/mo. Anti-VEGF injections available widely via SSN at hospital ophthalmology. GLP-1 covered for diabetes through SSN with prescription. Regional variation: Northern Italy has strongest public infrastructure; Southern regions thinner. English availability moderate in private sector.",

  'Malta': "National Health Service free at point of use for residents (EU after 3 months; non-EU after residence permit). Private (BUPA Malta, Atlas) ~€70-150/mo. Anti-VEGF injections at Mater Dei Hospital (sole tertiary public hospital). GLP-1 covered via NHS for diabetes. English is an official language — strong English-speaking workforce. Compact size means specialist access usually within 30 min.",

  'Mexico': "IMSS public system available to residents (~$500-700/yr fixed, varies by age). Private international plans ~$100-300/mo. Anti-VEGF injections widely available in Mexico City, Guadalajara, Monterrey, and San Miguel; ~$700-1,200/injection at private. GLP-1 via private prescription, ~$200-400/mo. Major retiree expat hubs (San Miguel, Lake Chapala, Mérida) have strong English-speaking specialist networks.",

  'Portugal': "SNS public healthcare after NHR/D7 visa residency. Private insurance optional (~€80-120/person/mo with pre-existing conditions). Anti-VEGF injections available through SNS hospitals. Pre-existing condition loading on private plans. GLP-1 covered through SNS for diabetes.",

  'Spain': "Sistema Nacional de Salud (SNS) universal coverage after residency permit. Private (Sanitas, Adeslas, ASISA) ~€60-150/mo with pre-existing condition loadings. Anti-VEGF injections available widely via SNS at public ophthalmology. GLP-1 covered for diabetes via SNS. Chronic-disease coverage is strong; regional variation — Catalonia and Madrid have densest infrastructure.",

  'Uruguay': "ASSE/FONASA universal coverage for residents (pensioner residency requires legal pension income proof). Private (Hospital Británico, Casa de Galicia, Asociación Española) ~$100-220/mo. Anti-VEGF injections available in Montevideo. GLP-1 partially covered through FONASA for diabetes. Strong public infrastructure; Montevideo is the medical hub.",
};

const TARGET_COUNTRIES = Object.keys(NOTES_BY_COUNTRY);

let updated = 0;
let skipped = 0;
let untouched = 0;

const dirs = readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const id of dirs) {
  const path = join(DATA_DIR, id, 'location.json');
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const loc = JSON.parse(raw);

  if (!TARGET_COUNTRIES.includes(loc.country)) {
    untouched++;
    continue;
  }

  const hcCost = loc.monthlyCosts?.healthcare;
  if (!hcCost) {
    console.warn(`SKIP ${id} — no monthlyCosts.healthcare block`);
    skipped++;
    continue;
  }

  if (typeof hcCost.notes === 'string' && hcCost.notes.length > 0) {
    // Already populated — idempotent skip.
    skipped++;
    continue;
  }

  hcCost.notes = NOTES_BY_COUNTRY[loc.country];
  // Preserve trailing newline if the original had one (most files do).
  const hadTrailingNewline = raw.endsWith('\n');
  const out = JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : '');
  writeFileSync(path, out);
  updated++;
  console.log(`OK   ${id} (${loc.country})`);
}

console.log(`\nDone. Updated ${updated}, already-had-notes ${skipped}, other-country ${untouched}`);
