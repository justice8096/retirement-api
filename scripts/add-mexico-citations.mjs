#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Mexico pros/cons bullets (Todo #19, fifth country sweep
 * after Portugal #96, Spain #97, France #98, Italy #99).
 *
 * Bullets cited (5 across 5 cities):
 *   - San Miguel pro: UNESCO World Heritage colonial architecture
 *   - Mérida pro:     "One of the safest cities in Mexico" (INEGI ENSU)
 *   - Querétaro pro:  "One of Mexico's safest and fastest-growing cities"
 *                      (INEGI ENSU + population stats)
 *   - Mazatlán con:   "Sinaloa state has security reputation issues"
 *                      (US State Dept travel advisory)
 *   - Playa del C. pro: "Convenient to Cancún airport" (ASUR stats)
 *
 * NOT cited (per the #19 strategy — subjective/vague):
 *   - "Largest US/Canadian expat community" (Lake Chapala) — vague
 *   - "Caribbean beaches with turquoise water" (Playa) — opinion
 *   - "World-renowned cuisine and mezcal culture" (Oaxaca) — opinion
 *   - "Periodic political protests and road blockades" (Oaxaca) —
 *     real but no single authoritative source for the pattern
 *   - "LGBTQ+-friendly with vibrant social scene" (Puerto Vallarta) —
 *     widely-acknowledged but no clean cite
 *
 * Run: node scripts/add-mexico-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** UNESCO World Heritage — Protective Town of San Miguel + Sanctuary
 *  of Jesús Nazareno de Atotonilco (listed 2008, ID 1274). */
const UNESCO_SMA = {
  title: 'UNESCO World Heritage List — Protective Town of San Miguel and the Sanctuary of Jesús Nazareno de Atotonilco (1274)',
  url: 'https://whc.unesco.org/en/list/1274',
  accessed: ACCESSED,
};

/** INEGI ENSU — Encuesta Nacional de Seguridad Pública Urbana.
 *  Quarterly perception-of-safety survey across Mexican urban areas.
 *  Mérida consistently ranks among the top 3 safest cities. */
const INEGI_ENSU = {
  title: 'INEGI — Encuesta Nacional de Seguridad Pública Urbana (ENSU)',
  url: 'https://www.inegi.org.mx/programas/ensu/',
  accessed: ACCESSED,
};

/** INEGI population statistics — Querétaro is among Mexico's
 *  fastest-growing metros (~3-4% annual population growth, well
 *  above national ~1%). */
const INEGI_QUERETARO_GROWTH = {
  title: 'INEGI — Querétaro population statistics (Censo de Población 2020)',
  url: 'https://www.inegi.org.mx/app/areasgeograficas/?ag=22',
  accessed: ACCESSED,
};

/** US Department of State — Mexico Travel Advisory. Sinaloa state is
 *  rated Level 3 ("Reconsider Travel") with specific cartel-violence
 *  warnings; Mazatlán's tourist zones are typically OK but the state-
 *  level reputation is the citation target. */
const US_STATE_DEPT_MEXICO = {
  title: 'US Department of State — Mexico Travel Advisory (Sinaloa state)',
  url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/mexico-travel-advisory.html',
  accessed: ACCESSED,
};

/** ASUR (Aeropuertos del Sureste) — Cancún International Airport
 *  operator. Cancún is Mexico's #2 airport by passenger volume after
 *  Mexico City; ~30M+ annual passengers. ~50 min drive to Playa del
 *  Carmen via Highway 307. */
const ASUR_CANCUN = {
  title: 'ASUR — Cancún International Airport (Mexico\'s #2 by passenger volume)',
  url: 'https://www.asur.com.mx/en/airports/cancun.html',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // San Miguel de Allende — UNESCO
  {
    city: 'mexico-san-miguel-de-allende',
    field: 'pros',
    match: 'UNESCO World Heritage colonial architecture',
    replacement: {
      text: 'UNESCO World Heritage colonial architecture (Protective Town of San Miguel + Sanctuary of Atotonilco, listed 2008)',
      sources: [UNESCO_SMA],
    },
  },
  // Mérida — safety
  {
    city: 'mexico-merida',
    field: 'pros',
    match: 'One of the safest cities in Mexico',
    replacement: {
      text: 'One of the safest cities in Mexico (consistently top-3 in INEGI ENSU perception-of-safety surveys)',
      sources: [INEGI_ENSU],
    },
  },
  // Querétaro — safety + growth
  {
    city: 'mexico-queretaro',
    field: 'pros',
    match: "One of Mexico's safest and fastest-growing cities",
    replacement: {
      text: "One of Mexico's safest and fastest-growing cities (INEGI ENSU; ~3-4% annual population growth vs national ~1%)",
      sources: [INEGI_ENSU, INEGI_QUERETARO_GROWTH],
    },
  },
  // Mazatlán — Sinaloa security
  {
    city: 'mexico-mazatlan',
    field: 'cons',
    match: 'Sinaloa state has security reputation issues',
    replacement: {
      text: 'Sinaloa state has security reputation issues (US State Dept Travel Advisory Level 3 — "Reconsider Travel"; tourist zones generally OK)',
      sources: [US_STATE_DEPT_MEXICO],
    },
  },
  // Playa del Carmen — Cancún airport
  {
    city: 'mexico-playa-del-carmen',
    field: 'pros',
    match: 'Convenient to Cancún airport for US flights',
    replacement: {
      text: 'Convenient to Cancún airport for US flights (~50 min via Hwy 307; ASUR-operated, Mexico\'s #2 airport by passenger volume with 30M+ annual)',
      sources: [ASUR_CANCUN],
    },
  },
];

// ─── Apply (same harness as prior scripts) ─────────────────────────────

let updated = 0;
let alreadyCited = 0;
let notFound = 0;

for (const u of UPDATES) {
  const path = join(DATA_DIR, u.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[u.field];
  if (!Array.isArray(list)) {
    console.warn(`SKIP ${u.city} — no ${u.field} array`);
    continue;
  }
  let found = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (text !== u.match) continue;
    found = true;
    if (typeof entry !== 'string' && entry?.sources?.length && !u.overwrite) {
      alreadyCited++;
      console.log(`-    ${u.city}.${u.field}: already cited — "${u.match}"`);
      break;
    }
    const wasOverwrite = !!u.overwrite && typeof entry !== 'string' && entry?.sources?.length;
    list[i] = u.replacement;
    updated++;
    console.log(
      `${wasOverwrite ? 'OVR ' : 'OK  '} ${u.city}.${u.field}: ` +
      `${wasOverwrite ? 'replaced low-quality citations' : 'cited'} "${u.match}"`,
    );
    break;
  }
  if (!found) {
    notFound++;
    console.warn(`MISS ${u.city}.${u.field}: bullet not found — "${u.match}"`);
    continue;
  }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
