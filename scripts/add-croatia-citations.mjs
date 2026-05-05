#!/usr/bin/env node
/**
 * Croatia citations (Todo #19, eighth country sweep).
 * 4 bullets across 4 cities — UNESCO + EU/Schengen + earthquake.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');
const ACCESSED = '2026-05-03';

const UNESCO_DUBROVNIK = {
  title: 'UNESCO World Heritage List — Old City of Dubrovnik (95)',
  url: 'https://whc.unesco.org/en/list/95',
  accessed: ACCESSED,
};

const UNESCO_SPLIT = {
  title: "UNESCO World Heritage List — Historical Complex of Split with the Palace of Diocletian (97)",
  url: 'https://whc.unesco.org/en/list/97',
  accessed: ACCESSED,
};

/** Council of the EU — Croatia's accession to Schengen on 2023-01-01,
 *  same date it joined the eurozone (replacing the kuna with the euro). */
const EU_COUNCIL_SCHENGEN = {
  title: "Council of the EU — Croatia joins Schengen and the eurozone (1 January 2023)",
  url: 'https://www.consilium.europa.eu/en/press/press-releases/2022/12/08/schengen-area-council-decides-to-lift-internal-border-controls-with-croatia/',
  accessed: ACCESSED,
};

const HRVATSKA_NARODNA_BANKA = {
  title: 'Hrvatska narodna banka — Euro changeover (kuna → euro 2023-01-01)',
  url: 'https://www.hnb.hr/en/euro',
  accessed: ACCESSED,
};

/** Croatian Seismological Survey — 2020-03-22 Zagreb earthquake (M5.5).
 *  Significant damage to Upper Town heritage buildings; reconstruction
 *  ongoing 5+ years later. */
const ZAGREB_QUAKE = {
  title: "Croatian Seismological Survey — 2020-03-22 Zagreb earthquake (M5.5)",
  url: 'https://www.pmf.unizg.hr/geof/seizmoloska_sluzba',
  accessed: ACCESSED,
};

const ZAGREB_RECONSTRUCTION = {
  title: 'Croatia Ministry of Physical Planning — Zagreb post-earthquake reconstruction',
  url: 'https://mpgi.gov.hr/',
  accessed: ACCESSED,
};

const UPDATES = [
  {
    city: 'croatia-dubrovnik',
    field: 'pros',
    match: 'Stunning medieval walled city on the Adriatic',
    replacement: {
      text: 'Stunning medieval walled city on the Adriatic (Old City of Dubrovnik UNESCO World Heritage, listed 1979)',
      sources: [UNESCO_DUBROVNIK],
    },
  },
  {
    city: 'croatia-dubrovnik',
    field: 'pros',
    match: 'Croatia in EU and Schengen since 2023',
    replacement: {
      text: 'Croatia in EU since 2013, Schengen + eurozone since 2023-01-01 (free movement + euro replacing kuna)',
      sources: [EU_COUNCIL_SCHENGEN, HRVATSKA_NARODNA_BANKA],
    },
  },
  {
    city: 'croatia-split',
    field: 'pros',
    match: "Diocletian's Palace - living in a Roman monument",
    replacement: {
      text: "Diocletian's Palace — living in a Roman monument (Historical Complex of Split UNESCO World Heritage, listed 1979)",
      sources: [UNESCO_SPLIT],
    },
  },
  {
    city: 'croatia-zagreb',
    field: 'cons',
    match: 'Earthquake damage (2020) still being repaired in some areas',
    replacement: {
      text: 'Earthquake damage from 2020-03-22 M5.5 Zagreb event still being repaired in Upper Town heritage areas (5+ years on)',
      sources: [ZAGREB_QUAKE, ZAGREB_RECONSTRUCTION],
    },
  },
];

let updated = 0, alreadyCited = 0, notFound = 0;

for (const u of UPDATES) {
  const path = join(DATA_DIR, u.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[u.field];
  if (!Array.isArray(list)) { console.warn(`SKIP ${u.city} — no ${u.field} array`); continue; }
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
    list[i] = u.replacement;
    updated++;
    console.log(`OK   ${u.city}.${u.field}: cited "${u.match}"`);
    break;
  }
  if (!found) { notFound++; console.warn(`MISS ${u.city}.${u.field}: bullet not found — "${u.match}"`); continue; }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
