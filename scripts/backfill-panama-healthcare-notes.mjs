#!/usr/bin/env node
/**
 * One-shot data migration: backfill `monthlyCosts.healthcare.notes` for
 * 13 Panama locations missing it (the post-#37 follow-up surfaced when
 * #95 + #111 both landed without Panama coverage).
 *
 * Pattern mirrors retirement-api PR #95 + #111 — concise notes including
 * baseline insurance + system context + location-specific hospital
 * access + condition-specific availability.
 *
 * Common Panama baseline (all 13 share):
 *   - CSS (Caja del Seguro Social) public system available to
 *     Pensionado visa holders.
 *   - Private insurance ~$200-350/mo per person (ASSA, Mapfre,
 *     Bupa Latin America, international plans). Pensionado visa
 *     may unlock group rates.
 *   - Pre-existing condition exclusions common first 12-24 months.
 *   - Pensionado discount 15-25% on most medical services.
 *   - Farmacia Arrocha is the major national chain.
 *
 * Location-specific layers added per city: hospital access, distance
 * to tertiary care, anti-VEGF / GLP-1 availability, medevac
 * implications.
 *
 * Idempotent: skips locations that already have a notes field.
 *
 * Run: node scripts/backfill-panama-healthcare-notes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const PANAMA_BASELINE =
  "CSS public system available to Pensionado visa holders; private insurance ~$200-350/mo per person (ASSA / Mapfre / Bupa LatAm / international). Pre-existing exclusions common first 12-24 months. Pensionado 15-25% discount on most medical services. Farmacia Arrocha is the national chain.";

// Premier private hospitals in Panama City (shared across the 5 city
// neighborhoods). Punta Pacifica is JCI-accredited and Johns Hopkins-
// affiliated — the regional gold standard for retirees.
const PANAMA_CITY_HOSPITALS =
  "Excellent specialist access in Panama City: Hospital Punta Pacifica (JCI-accredited, Johns Hopkins-affiliated), Hospital Nacional, Pacifica Salud, Hospital Paitilla, Hospital San Fernando. Anti-VEGF + ophthalmology + cardiology + oncology widely available locally. GLP-1 (Ozempic/Wegovy) available via private prescription, ~$200-400/mo.";

const NOTES_BY_LOC = {
  // ─── Panama City neighborhoods (5) — same hospital access ──────
  'panama-city-bella-vista': PANAMA_BASELINE + ' ' + PANAMA_CITY_HOSPITALS,
  'panama-city-casco-viejo': PANAMA_BASELINE + ' ' + PANAMA_CITY_HOSPITALS,
  'panama-city-costa-del-este':
    PANAMA_BASELINE +
    ' ' +
    PANAMA_CITY_HOSPITALS +
    ' Costa del Este is adjacent to Hospital Punta Pacifica — closest neighborhood to JCI-accredited care.',
  'panama-city-el-cangrejo': PANAMA_BASELINE + ' ' + PANAMA_CITY_HOSPITALS,
  'panama-city-punta-pacifica':
    PANAMA_BASELINE +
    ' ' +
    PANAMA_CITY_HOSPITALS +
    ' Hospital Punta Pacifica is in this neighborhood — walking distance to JCI-accredited care.',

  // ─── Chiriquí Province (David + nearby) ────────────────────────
  'panama-david':
    PANAMA_BASELINE +
    ' Hospital Chiriquí is the regional anchor in David — the largest hospital in Western Panama, with cardiology + general surgery + maternity. Anti-VEGF and routine ophthalmology available locally; complex specialty care typically referred to Panama City (~5-6 hr drive east). David is also Boquete\'s referral hospital (~30 mi north).',
  'panama-volcan':
    PANAMA_BASELINE +
    ' Volcán has a small clinic; Hospital Chiriquí in David (~30 mi south) is the closest hospital. Tertiary care + anti-VEGF / advanced ophthalmology requires David or Panama City. Mountain location means weather can occasionally disrupt road access to David.',
  'panama-puerto-armuelles':
    PANAMA_BASELINE +
    ' Hospital Ciudad de Puerto Armuelles handles primary care; Hospital Chiriquí in David (~30 mi northeast) for advanced cases. Pacific-coast rural location — emergency transport via road to David is ~45 min.',

  // ─── Azuero Peninsula (Pedasí + Chitré) ────────────────────────
  'panama-chitre':
    PANAMA_BASELINE +
    ' Hospital Cecilio Castillero is the Azuero Peninsula\'s regional public hospital. Hospital Anita Moreno (private) and Centro Médico Paitilla satellite serve private patients. Tertiary care (cardiology, oncology, complex surgery) typically referred to Panama City (~3 hr northwest).',
  'panama-pedasi':
    PANAMA_BASELINE +
    ' Pedasí has a small Centro de Salud (public clinic); Hospital Cecilio Castillero in Chitré (~50 mi north) is the regional hospital. Tertiary care via Panama City (~4 hr northwest). Anti-VEGF + advanced ophthalmology only available in capital.',

  // ─── Coronado + El Valle (Cocle Province) ──────────────────────
  'panama-coronado':
    PANAMA_BASELINE +
    ' Centro Médico San Fernando-Coronado satellite + local clinics handle routine care. Panama City hospitals (~50 mi / ~1 hr east via the Pan-American Highway) for advanced specialty care, including JCI-accredited Punta Pacifica. Coronado is the closest beach community to top-tier Panama City medicine.',
  'panama-el-valle':
    PANAMA_BASELINE +
    ' El Valle de Antón is a small mountain town with a Centro de Salud (public clinic). Hospital Aquilino Tejeira in Penonomé (~40 min east) handles regional cases; Panama City (~75 mi east) for tertiary care. Anti-VEGF + advanced ophthalmology only in capital.',

  // ─── Bocas del Toro (Caribbean Archipelago) ────────────────────
  'panama-bocas-del-toro':
    PANAMA_BASELINE +
    ' Hospital Bocas del Toro on Isla Colón handles primary care and stabilization. Limited specialty services — medevac to David (~6 hr by boat-then-drive via Almirante) or Panama City flight for serious conditions. Anti-VEGF + advanced ophthalmology not available locally; planned trips to Panama City required for chronic eye conditions.',
};

let updated = 0;
let alreadyPopulated = 0;
let notFound = 0;

for (const [id, notes] of Object.entries(NOTES_BY_LOC)) {
  const path = join(DATA_DIR, id, 'location.json');
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch { notFound++; console.warn(`MISS ${id}: location.json not readable`); continue; }
  const loc = JSON.parse(raw);
  const hc = loc?.monthlyCosts?.healthcare;
  if (!hc) { notFound++; console.warn(`MISS ${id}: no monthlyCosts.healthcare`); continue; }
  if (typeof hc.notes === 'string' && hc.notes.trim().length > 0) {
    alreadyPopulated++;
    console.log(`-    ${id}: already has notes`);
    continue;
  }
  hc.notes = notes;
  const trail = raw.endsWith('\n') ? '\n' : '';
  writeFileSync(path, JSON.stringify(loc, null, 2) + trail);
  updated++;
  console.log(`OK   ${id}: notes populated (${notes.length} chars)`);
}

console.log(`\nDone. Updated ${updated}, already-populated ${alreadyPopulated}, not-found ${notFound}`);
