#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Costa Rica pros/cons bullets (Todo #19, sixth country
 * sweep after Portugal #96, Spain #97, France #98, Italy #99, Mexico #100).
 *
 * Costa Rica is leaner on citable program facts than the prior five —
 * most pros are climate/lifestyle subjectives ("spring-like climate",
 * "stunning volcanic scenery", "laid-back coastal town"). This pass
 * hits the 3 strongest falsifiable claims; everything else stays as
 * plain strings per the #19 strategy.
 *
 * Bullets cited (3 across 3 cities):
 *   - Central Valley pro: "Best healthcare infrastructure in Central
 *                          America" (PAHO Country Profile)
 *   - Guanacaste pro:     "International airport in Liberia for easy
 *                          access" (Daniel Oduber Quirós LIR)
 *   - Grecia pro:         "Famous red metal church and charming town
 *                          center" (Iglesia de la Mercedes, designed
 *                          1894 by Charles Thirion)
 *
 * NOT cited:
 *   - Atenas: "Claimed 'best climate in the world' by National
 *     Geographic" — widely attributed to NatGeo but the original
 *     source is unclear / disputed. Flagged for rewording rather
 *     than ambiguous citation.
 *   - All climate / lifestyle subjectives (covered by `climate.*`
 *     fields elsewhere in the dataset).
 *   - Pensionado visa thresholds: high-value retirement fact NOT in
 *     any current bullet — content-addition work, separate PR.
 *
 * Run: node scripts/add-costa-rica-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** PAHO Country Profile — Costa Rica. Costa Rica's CCSS (Caja
 *  Costarricense de Seguro Social) consistently ranks at or near
 *  the top of Latin America in WHO/PAHO health-system metrics
 *  (life expectancy, infant mortality, universal coverage). */
const PAHO_COSTA_RICA = {
  title: 'PAHO — Costa Rica Country Profile (Health Indicators)',
  url: 'https://www.paho.org/en/countries/costa-rica',
  accessed: ACCESSED,
};

/** Costa Rica Ministerio de Salud — health system overview. */
const CR_MINISTERIO_SALUD = {
  title: 'Ministerio de Salud Costa Rica — Sistema de salud',
  url: 'https://www.ministeriodesalud.go.cr/',
  accessed: ACCESSED,
};

/** Aeropuerto Internacional Daniel Oduber Quirós (LIR) — Liberia,
 *  Guanacaste. Second-largest international airport in Costa Rica;
 *  direct flights to North America, Europe. Operated under
 *  concession by Coriport / VINCI Airports. */
const LIR_AIRPORT = {
  title: 'Aeropuerto Internacional Daniel Oduber Quirós (LIR) — Liberia, Guanacaste',
  url: 'https://www.liberiacostaricaairport.net/',
  accessed: ACCESSED,
};

/** Costa Rica Civil Aviation — official airport directory listing
 *  LIR alongside SJO (San José). */
const CR_AVIATION = {
  title: 'Dirección General de Aviación Civil Costa Rica — Aeropuertos internacionales',
  url: 'https://www.dgac.go.cr/',
  accessed: ACCESSED,
};

/** Iglesia de la Mercedes (Grecia) — designed 1894 by Belgian
 *  architect Charles Thirion, prefabricated in Belgium and
 *  shipped/assembled in Grecia. One of two prefab metal churches
 *  in Costa Rica. */
const GRECIA_CHURCH = {
  title: 'Sistema Nacional de Bibliotecas — Iglesia de la Mercedes (Grecia)',
  url: 'https://www.sinabi.go.cr/biblioteca_digital/atlas_de_costa_rica/',
  accessed: ACCESSED,
};

const GRECIA_TOURISM = {
  title: 'Visit Costa Rica — Grecia (Iglesia de la Mercedes red metal church)',
  url: 'https://www.visitcostarica.com/en/costa-rica/destinations/central-valley/grecia',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // Central Valley — healthcare infrastructure
  {
    city: 'costa-rica-central-valley',
    field: 'pros',
    match: 'Best healthcare infrastructure in Central America',
    replacement: {
      text: 'Best healthcare infrastructure in Central America (CCSS universal coverage; PAHO ranks Costa Rica at or near the top of Latin America in health-system indicators)',
      sources: [PAHO_COSTA_RICA, CR_MINISTERIO_SALUD],
    },
  },
  // Guanacaste — Liberia international airport
  {
    city: 'costa-rica-guanacaste',
    field: 'pros',
    match: 'International airport in Liberia for easy access',
    replacement: {
      text: 'International airport in Liberia (LIR — Daniel Oduber Quirós) with direct flights to North America and Europe; second-largest in Costa Rica after SJO',
      sources: [LIR_AIRPORT, CR_AVIATION],
    },
  },
  // Grecia — Iglesia de la Mercedes
  {
    city: 'costa-rica-grecia',
    field: 'pros',
    match: 'Famous red metal church and charming town center',
    replacement: {
      text: 'Famous red metal church (Iglesia de la Mercedes — designed 1894 by Belgian architect Charles Thirion, prefabricated in Belgium and assembled in Grecia)',
      sources: [GRECIA_CHURCH, GRECIA_TOURISM],
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
