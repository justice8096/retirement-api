#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Italy pros/cons bullets (Todo #19, fourth country sweep
 * after Portugal #96, Spain #97, France #98).
 *
 * Same pattern as the prior three: per-bullet exact-string match,
 * idempotent, shared `Source` constants, optional `overwrite` flag.
 *
 * Italy has fewer program-fact-dense bullets than France/Spain/Portugal
 * (most pros are subjective: "iconic rolling hills", "stunning beaches",
 * "Renaissance culture"). This pass hits the 4 strongest falsifiable
 * claims; the rest stay as plain strings per the #19 strategy
 * ("don't try to cite every bullet — most are lifestyle subjectives").
 *
 * Bullets cited (4 across 4 cities):
 *   - Abruzzo con: "L'Aquila still recovering from 2009 earthquake"
 *   - Puglia pro:  "Stunning coastline and trulli houses..." (UNESCO 787)
 *   - Tuscany pro: "Iconic rolling hills, vineyards, and Renaissance
 *                   culture" (5 UNESCO sites in Tuscany)
 *   - Sicily con:  "Organized crime still present in some areas" (DIA reports)
 *
 * NOT covered (filed for follow-up):
 *   - 7% flat tax for retirees (Decreto Crescita 2019, Art. 24-ter TUIR)
 *     applies to Puglia, Sardinia, Sicily, Calabria, Abruzzo for new
 *     residents in towns <20k population. This is high-value retirement
 *     content but it's a NEW pro, not a citation to an existing one —
 *     belongs in a content-addition PR, not a citation pass.
 *
 * Run: node scripts/add-italy-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** INGV (Istituto Nazionale di Geofisica e Vulcanologia) — 2009
 *  L'Aquila earthquake event page. M6.3 on 2009-04-06 killed 309. */
const INGV_LAQUILA = {
  title: "INGV — Terremoto dell'Aquila del 6 aprile 2009 (M6.3)",
  url: 'https://terremoti.ingv.it/event/1895389',
  accessed: ACCESSED,
};

/** Italian Civil Protection (Protezione Civile) — official L'Aquila
 *  earthquake reconstruction page (still ongoing 15+ years later). */
const PROT_CIVILE_LAQUILA = {
  title: 'Protezione Civile — Terremoto Abruzzo 2009 reconstruction',
  url: 'https://www.protezionecivile.gov.it/it/notizia/terremoto-abruzzo-2009',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Trulli of Alberobello (listed 1996, ID 787). */
const UNESCO_TRULLI = {
  title: 'UNESCO World Heritage List — Trulli of Alberobello (787)',
  url: 'https://whc.unesco.org/en/list/787',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Tuscany has 5 listed sites: Florence Historic
 *  Centre (174), Pienza (798), San Gimignano (550), Siena (379),
 *  Val d'Orcia (1026). Citing the UNESCO Italy country page covers all. */
const UNESCO_TUSCANY_FLORENCE = {
  title: 'UNESCO World Heritage List — Historic Centre of Florence (174)',
  url: 'https://whc.unesco.org/en/list/174',
  accessed: ACCESSED,
};

const UNESCO_TUSCANY_SIENA = {
  title: 'UNESCO World Heritage List — Historic Centre of Siena (379)',
  url: 'https://whc.unesco.org/en/list/379',
  accessed: ACCESSED,
};

const UNESCO_TUSCANY_VALDORCIA = {
  title: "UNESCO World Heritage List — Val d'Orcia (1026)",
  url: 'https://whc.unesco.org/en/list/1026',
  accessed: ACCESSED,
};

/** Direzione Investigativa Antimafia (DIA) — semiannual report on
 *  Italian organized crime activity. Authoritative source on Cosa
 *  Nostra (Sicily), 'Ndrangheta (Calabria), and Camorra (Campania). */
const DIA_REPORTS = {
  title: 'Direzione Investigativa Antimafia (DIA) — Relazioni semestrali',
  url: 'https://direzioneinvestigativaantimafia.interno.gov.it/relazioni-semestrali/',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // Abruzzo — L'Aquila 2009 earthquake
  {
    city: 'italy-abruzzo',
    field: 'cons',
    match: "L'Aquila still recovering from 2009 earthquake",
    replacement: {
      text: "L'Aquila still recovering from the M6.3 2009 earthquake (309 fatalities; reconstruction ongoing 15+ years later)",
      sources: [INGV_LAQUILA, PROT_CIVILE_LAQUILA],
    },
  },
  // Puglia — UNESCO trulli of Alberobello
  {
    city: 'italy-puglia',
    field: 'pros',
    match: 'Stunning coastline and trulli houses in Ostuni/Alberobello',
    replacement: {
      text: 'Stunning coastline and trulli houses in Ostuni/Alberobello (Trulli of Alberobello are UNESCO World Heritage)',
      sources: [UNESCO_TRULLI],
    },
  },
  // Tuscany — multiple UNESCO sites
  {
    city: 'italy-tuscany',
    field: 'pros',
    match: 'Iconic rolling hills, vineyards, and Renaissance culture',
    replacement: {
      text: "Iconic rolling hills, vineyards, and Renaissance culture (Tuscany hosts 5 UNESCO World Heritage sites: Florence, Siena, Pienza, San Gimignano, Val d'Orcia)",
      sources: [UNESCO_TUSCANY_FLORENCE, UNESCO_TUSCANY_SIENA, UNESCO_TUSCANY_VALDORCIA],
    },
  },
  // Sicily — organized crime per DIA reports
  {
    city: 'italy-sicily',
    field: 'cons',
    match: 'Organized crime still present in some areas',
    replacement: {
      text: "Organized crime (Cosa Nostra) still present in some areas; activity tracked in the Italian DIA's semiannual reports",
      sources: [DIA_REPORTS],
    },
  },
];

// ─── Apply (same harness as Spain/France scripts) ──────────────────────

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
