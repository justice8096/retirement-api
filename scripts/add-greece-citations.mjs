#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Greece pros/cons bullets (Todo #19, seventh country
 * sweep after Portugal #96, Spain #97, France #98, Italy #99,
 * Mexico #100, Costa Rica #101).
 *
 * Greece's pros are dominated by ancient-history claims that map
 * cleanly to UNESCO World Heritage listings — strong cite density.
 *
 * Bullets cited (4 across 4 cities):
 *   - Athens pro:        "Rich ancient history at your doorstep"
 *                        (Acropolis UNESCO 404)
 *   - Corfu pro:         "Venetian and British architectural heritage"
 *                        (Old Town of Corfu UNESCO 978)
 *   - Peloponnese pro:   "Rich ancient history (Mycenae, Olympia,
 *                        Epidaurus)" — three UNESCO sites in one bullet
 *   - Rhodes pro:        "Medieval old town is a UNESCO World Heritage
 *                        site" (Medieval City of Rhodes UNESCO 493)
 *
 * NOT cited (per #19 strategy):
 *   - Climate / lifestyle subjectives ("warm climate", "beautiful
 *     beaches", "lush green island")
 *   - Affordability claims (covered by `monthlyCosts` fields)
 *   - "Excellent Cretan cuisine" — opinion
 *
 * Run: node scripts/add-greece-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** UNESCO World Heritage — Acropolis of Athens (listed 1987, ID 404). */
const UNESCO_ACROPOLIS = {
  title: 'UNESCO World Heritage List — Acropolis, Athens (404)',
  url: 'https://whc.unesco.org/en/list/404',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Old Town of Corfu (listed 2007, ID 978).
 *  Notable for blended Venetian, French, and British architectural
 *  heritage from successive periods of foreign rule. */
const UNESCO_CORFU = {
  title: 'UNESCO World Heritage List — Old Town of Corfu (978)',
  url: 'https://whc.unesco.org/en/list/978',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Archaeological Sites of Mycenae and Tiryns
 *  (listed 1999, ID 941). */
const UNESCO_MYCENAE = {
  title: 'UNESCO World Heritage List — Archaeological Sites of Mycenae and Tiryns (941)',
  url: 'https://whc.unesco.org/en/list/941',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Archaeological Site of Olympia
 *  (listed 1989, ID 517). Birthplace of the Olympic Games. */
const UNESCO_OLYMPIA = {
  title: 'UNESCO World Heritage List — Archaeological Site of Olympia (517)',
  url: 'https://whc.unesco.org/en/list/517',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Sanctuary of Asklepios at Epidaurus
 *  (listed 1988, ID 491). */
const UNESCO_EPIDAURUS = {
  title: 'UNESCO World Heritage List — Sanctuary of Asklepios at Epidaurus (491)',
  url: 'https://whc.unesco.org/en/list/491',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Medieval City of Rhodes (listed 1988,
 *  ID 493). Best-preserved medieval walled city in Europe. */
const UNESCO_RHODES = {
  title: 'UNESCO World Heritage List — Medieval City of Rhodes (493)',
  url: 'https://whc.unesco.org/en/list/493',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // Athens — Acropolis
  {
    city: 'greece-athens',
    field: 'pros',
    match: 'Rich ancient history at your doorstep',
    replacement: {
      text: 'Rich ancient history at your doorstep (Acropolis UNESCO World Heritage site, listed 1987)',
      sources: [UNESCO_ACROPOLIS],
    },
  },
  // Corfu — Old Town
  {
    city: 'greece-corfu',
    field: 'pros',
    match: 'Venetian and British architectural heritage',
    replacement: {
      text: 'Venetian, French, and British architectural heritage (Old Town of Corfu UNESCO World Heritage, listed 2007)',
      sources: [UNESCO_CORFU],
    },
  },
  // Peloponnese — Mycenae + Olympia + Epidaurus
  {
    city: 'greece-peloponnese',
    field: 'pros',
    match: 'Rich ancient history (Mycenae, Olympia, Epidaurus)',
    replacement: {
      text: 'Rich ancient history: Mycenae, Olympia, and Epidaurus are all UNESCO World Heritage sites',
      sources: [UNESCO_MYCENAE, UNESCO_OLYMPIA, UNESCO_EPIDAURUS],
    },
  },
  // Rhodes — Medieval Old Town
  {
    city: 'greece-rhodes',
    field: 'pros',
    match: 'Medieval old town is a UNESCO World Heritage site',
    replacement: {
      text: 'Medieval old town is a UNESCO World Heritage site (Medieval City of Rhodes, listed 1988 — best-preserved medieval walled city in Europe)',
      sources: [UNESCO_RHODES],
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
