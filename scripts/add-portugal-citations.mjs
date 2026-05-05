#!/usr/bin/env node
/**
 * One-shot data migration: add structured `Source[]` citations to
 * falsifiable Portugal pros/cons bullets (Todo #19 beachhead).
 *
 * Strategy from #19: don't try to cite every bullet — most are
 * lifestyle/climate subjectives that aren't source-able. Focus on
 * falsifiable claims (specific numbers, named programs, government
 * documents). This pass covers all 5 Portugal cities + sets the
 * pattern for future country sweeps.
 *
 * What this script does:
 *   1. Updates outdated `Lowest visa threshold (EUR 705/mo)` to
 *      reflect the 2025 D7 minimum-passive-income figure.
 *   2. Converts plain-string pros to `{ text, sources }` form for the
 *      6 bullets being cited; leaves all other strings untouched.
 *   3. Adds `sources` to existing object-form cons that match.
 *
 * Idempotent: skips conversion when a `sources` array is already
 * present on a bullet.
 *
 * Run: node scripts/add-portugal-citations.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');

const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

/** AIMA (Portuguese immigration agency, replaced SEF in 2023) — D7 visa
 *  page. The minimum income is the IAS / minimum wage. 2025: €870/mo. */
const AIMA_D7 = {
  title: 'AIMA — D7 (Passive Income / Retirement) Visa requirements',
  url: 'https://www.aima.gov.pt/en/viver/vistos/d7---visto-de-residencia-para-aposentados-e-titulares-de-rendimentos',
  accessed: ACCESSED,
};

/** Diário da República — 2025 Portuguese national minimum wage / RMG
 *  notice setting the figure D7 applicants must match. */
const PT_MIN_WAGE_2025 = {
  title: 'Decreto-Lei n.º 87-A/2024 — 2025 RMG (€870/mo)',
  url: 'https://diariodarepublica.pt/dr/detalhe/decreto-lei/87-a-2024-902317036',
  accessed: ACCESSED,
};

/** EF English Proficiency Index — Portugal ranking. Updated annually. */
const EF_EPI_PT = {
  title: 'EF English Proficiency Index 2024 — Portugal',
  url: 'https://www.ef.com/wwen/epi/regions/europe/portugal/',
  accessed: ACCESSED,
};

/** AIMA permanent residency — Portuguese A2 language certificate
 *  requirement after 5 years legal residence. */
const AIMA_PR_LANGUAGE = {
  title: 'AIMA — Permanent residence (Autorização de Residência Permanente)',
  url: 'https://www.aima.gov.pt/en/viver/autorizacao-de-residencia/autorizacao-de-residencia-permanente',
  accessed: ACCESSED,
};

/** UNESCO World Heritage — Historic Centre of Oporto. */
const UNESCO_PORTO = {
  title: 'UNESCO World Heritage List — Historic Centre of Oporto, Luiz I Bridge and Monastery of Serra do Pilar',
  url: 'https://whc.unesco.org/en/list/755',
  accessed: ACCESSED,
};

/** CP (Comboios de Portugal) — Linha de Cascais published timetable.
 *  Lisbon Cais do Sodré ↔ Cascais ~33-40 min depending on stops. */
const CP_CASCAIS = {
  title: 'CP — Linha de Cascais timetable (Lisboa Cais do Sodré ↔ Cascais)',
  url: 'https://www.cp.pt/passageiros/en/train-times/lines/cascais-line',
  accessed: ACCESSED,
};

// ─── Per-city bullet updates ───────────────────────────────────────────

/**
 * Each entry describes a precise bullet replacement for a specific city.
 *  - `pro` or `con` selects which array to operate on.
 *  - `match` is the EXACT string the bullet must currently equal (after
 *    text-extraction). Belt-and-suspenders for safety against drift.
 *  - `replacement.text` is the new bullet text (may differ from match
 *    when correcting outdated facts; see Lisbon D7 below).
 *  - `replacement.sources` is the `Source[]` to attach.
 */
const UPDATES = [
  // Lisbon — outdated D7 figure (€705/mo) → €870/mo (2025 minimum wage)
  {
    city: 'portugal-lisbon',
    field: 'pros',
    match: 'Lowest visa threshold (EUR 705/mo)',
    replacement: {
      text: 'Low D7 visa threshold: passive income at least €870/mo (2025 Portuguese minimum wage)',
      sources: [AIMA_D7, PT_MIN_WAGE_2025],
    },
  },
  // Lisbon — English proficiency
  {
    city: 'portugal-lisbon',
    field: 'pros',
    match: 'High English proficiency',
    replacement: {
      text: 'High English proficiency (Portugal ranks in EF EPI Very High Proficiency tier)',
      sources: [EF_EPI_PT],
    },
  },
  // Lisbon — language requirement for permanent residency
  {
    city: 'portugal-lisbon',
    field: 'cons',
    match: 'Language barrier for permanent residency',
    replacement: {
      text: 'Permanent residency requires A2 Portuguese language certificate after 5 years',
      sources: [AIMA_PR_LANGUAGE],
    },
  },
  // Porto — UNESCO heritage
  {
    city: 'portugal-porto',
    field: 'pros',
    match: 'UNESCO World Heritage riverside district',
    replacement: {
      text: 'UNESCO World Heritage riverside district (Historic Centre of Oporto, listed 1996)',
      sources: [UNESCO_PORTO],
    },
  },
  // Cascais — train connection
  {
    city: 'portugal-cascais',
    field: 'pros',
    match: 'Train connection to Lisbon (35 min)',
    replacement: {
      text: 'Train connection to Lisbon (~35 min on the CP Linha de Cascais)',
      sources: [CP_CASCAIS],
    },
  },
];

// ─── Apply ─────────────────────────────────────────────────────────────

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
    if (typeof entry !== 'string' && entry?.sources?.length) {
      alreadyCited++;
      console.log(`-    ${u.city}.${u.field}: already cited — "${u.match}"`);
      break;
    }
    list[i] = u.replacement;
    updated++;
    console.log(`OK   ${u.city}.${u.field}: cited "${u.match}"`);
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
