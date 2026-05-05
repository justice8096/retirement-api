#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable France pros/cons bullets (Todo #19, third country sweep
 * after Portugal #96 and Spain #97).
 *
 * Same pattern as the prior two:
 *   - Per-city, per-bullet exact-string match (defensive)
 *   - Idempotent (skips bullets that already have sources, unless
 *     `overwrite: true` is set)
 *   - Shared `Source` constants reusable across cities
 *
 * Falsifiable bullets targeted (5 + a shared cite applied to 2 cities):
 *   - Brittany pro:  "Excellent healthcare (PUMA)"
 *   - Brittany con:  "Complex tax situation with US" (shared US-FR tax cite)
 *   - Toulouse con:  "Complex French tax situation with US" (same shared cite)
 *   - Toulouse pro:  "Aerospace hub (Airbus HQ) with international community"
 *   - Paris pro:     "World-class public transit (metro, RER, buses)"
 *   - Languedoc pro: "Montpellier is a vibrant university city with tram system"
 *
 * Run: node scripts/add-france-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** Code de la sécurité sociale Article L160-1 — establishes PUMA
 *  (Protection Universelle Maladie). Universal access for residents
 *  with stable residence, regardless of work status. */
const FR_PUMA_CSS = {
  title: 'Code de la sécurité sociale — Article L160-1 (Protection Universelle Maladie)',
  url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031672250',
  accessed: ACCESSED,
};

/** service-public.fr — citizen-facing PUMA explainer. */
const FR_PUMA_EXPLAINER = {
  title: 'service-public.fr — Protection Universelle Maladie (PUMA)',
  url: 'https://www.service-public.fr/particuliers/vosdroits/F34307',
  accessed: ACCESSED,
};

/** US-France income tax treaty. The 1994 convention + 2004 + 2009
 *  protocols govern dual-tax situations for US persons in France
 *  (saving clause, foreign earned income, retirement accounts, etc.). */
const US_FR_TAX_TREATY = {
  title: 'Convention fiscale franco-américaine du 31 août 1994 (with 2004/2009 protocols)',
  url: 'https://www.impots.gouv.fr/sites/default/files/media/10_conventions/etats_unis/etats-unis_convention-avec-les-etats-unis_fd_3160.pdf',
  accessed: ACCESSED,
};

const US_FR_IRS_TREATY_PAGE = {
  title: 'IRS — France Tax Treaty Documents',
  url: 'https://www.irs.gov/businesses/international-businesses/france-tax-treaty-documents',
  accessed: ACCESSED,
};

/** Airbus Group — corporate HQ in Toulouse-Blagnac (final assembly
 *  lines for A320/A330/A350 also in Toulouse). */
const AIRBUS_HQ = {
  title: 'Airbus — Toulouse-Blagnac corporate headquarters',
  url: 'https://www.airbus.com/en/about-us/our-locations/france',
  accessed: ACCESSED,
};

/** Île-de-France Mobilités — Paris transit network operator. RATP
 *  + SNCF Transilien combined network statistics. */
const PARIS_IDFM = {
  title: 'Île-de-France Mobilités — Paris regional transit network',
  url: 'https://www.iledefrance-mobilites.fr/en/discover/transport-network',
  accessed: ACCESSED,
};

const PARIS_RATP = {
  title: 'RATP — Métro de Paris (16 lines, ~225 km, ~1.5 billion annual riders)',
  url: 'https://www.ratp.fr/en/metro',
  accessed: ACCESSED,
};

/** TaM (Transports de l'agglomération de Montpellier) — Montpellier
 *  tram network. 4 lines, ~83 km — among the largest French tram
 *  systems outside Paris. */
const MONTPELLIER_TAM = {
  title: "TaM — Tramway de Montpellier (4 lines, ~83 km)",
  url: 'https://www.tam-voyages.com/le-reseau/tramway',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

const UPDATES = [
  // Brittany — PUMA universal healthcare
  {
    city: 'france-brittany',
    field: 'pros',
    match: 'Excellent healthcare (PUMA)',
    replacement: {
      text: 'Excellent healthcare via PUMA (Protection Universelle Maladie) — universal access for residents under Code SS Art. L160-1',
      sources: [FR_PUMA_CSS, FR_PUMA_EXPLAINER],
    },
  },
  // Brittany — US-France tax treaty
  {
    city: 'france-brittany',
    field: 'cons',
    match: 'Complex tax situation with US',
    replacement: {
      text: 'Complex tax situation: US persons remain subject to US tax under the 1994 US-France treaty (saving clause); FBAR/FATCA reporting still required',
      sources: [US_FR_TAX_TREATY, US_FR_IRS_TREATY_PAGE],
    },
  },
  // Toulouse — Airbus HQ
  {
    city: 'france-toulouse',
    field: 'pros',
    match: 'Aerospace hub (Airbus HQ) with international community',
    replacement: {
      text: 'Aerospace hub: Airbus corporate HQ in Toulouse-Blagnac (final assembly for A320/A330/A350)',
      sources: [AIRBUS_HQ],
    },
  },
  // Toulouse — same US-FR tax treaty cite, slightly different bullet wording
  {
    city: 'france-toulouse',
    field: 'cons',
    match: 'Complex French tax situation with US',
    replacement: {
      text: 'Complex French tax situation: US persons remain subject to US tax under the 1994 US-France treaty (saving clause); FBAR/FATCA reporting still required',
      sources: [US_FR_TAX_TREATY, US_FR_IRS_TREATY_PAGE],
    },
  },
  // Paris — public transit
  {
    city: 'france-paris',
    field: 'pros',
    match: 'World-class public transit (metro, RER, buses)',
    replacement: {
      text: 'World-class public transit: 16-line métro + RER + bus network operated under Île-de-France Mobilités (~1.5 billion annual métro riders)',
      sources: [PARIS_IDFM, PARIS_RATP],
    },
  },
  // Languedoc — Montpellier tram
  {
    city: 'france-languedoc',
    field: 'pros',
    match: 'Montpellier is a vibrant university city with tram system',
    replacement: {
      text: 'Montpellier is a vibrant university city with the TaM tram (4 lines, ~83 km — among the largest French tram networks outside Paris)',
      sources: [MONTPELLIER_TAM],
    },
  },
];

// ─── Apply (same harness as Spain script — idempotent, overwrite-aware) ──

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
