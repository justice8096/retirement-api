#!/usr/bin/env node
/**
 * Two related data updates (Todos #39 + #40):
 *
 * 1. Italy 7% retiree flat tax (#40)
 *    Adds a new pro to the 4 qualifying Italy locations (southern
 *    regions + municipalities <20K population per TUIR Art. 24-ter
 *    + Decreto Crescita 2019). Retirees electing this regime pay
 *    a flat 7% on foreign-source income (pensions, dividends, etc.)
 *    for 9 years from the year of relocation. Hugely retirement-
 *    relevant; surfaced during the #19 Italy citation pass but
 *    skipped because it's a NEW pro, not a citation to an existing
 *    one.
 *
 *    Qualifying cities in our dataset: italy-abruzzo, italy-puglia,
 *    italy-sardinia, italy-sicily.
 *    NOT qualifying: italy-tuscany, italy-lake-region (northern/
 *    central Italy — outside the eligible regions).
 *
 * 2. Pros/cons content rewords (#39)
 *    Two bullets surfaced during the #19 country sweep where the
 *    citation pass found the bullet text was imprecise or wrong:
 *
 *    a. Atenas (Costa Rica) pro: "Claimed 'best climate in the
 *       world' by National Geographic" — the NatGeo attribution
 *       is widely repeated but the original article isn't findable.
 *       Rewrite to factual climate stats + cite Climate-Data.org +
 *       IMN (Costa Rica's met office).
 *
 *    b. Alicante (Spain) con: "A2 Spanish required for permanent
 *       residency" — claim is wrong. Spanish long-term residence
 *       (residencia de larga duración) has NO language test per EU
 *       Directive 2003/109/EC + RD 557/2011. A2 + CCSE is required
 *       for *Spanish citizenship*, per Ley 19/2015 / RD 1004/2015.
 *       Rewrite to clarify the citizenship distinction + cite both
 *       sources.
 *
 * Run: node scripts/italy-7pct-and-procon-fixes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');
const ACCESSED = '2026-05-03';

// ─── Citation library ──────────────────────────────────────────────────

// Italy 7% flat tax sources
const ITALY_TUIR_24TER = {
  title: 'Italian TUIR Art. 24-ter (Normattiva — opzione per imposta sostitutiva 7% sui redditi di fonte estera)',
  url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1986-12-22;917!vig=',
  accessed: ACCESSED,
};

const ITALY_DECRETO_CRESCITA = {
  title: 'Decreto-Legge 30 aprile 2019, n. 34 (Decreto Crescita) — introduces 7% flat-tax regime for foreign retirees',
  url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2019-04-30;34',
  accessed: ACCESSED,
};

const ITALY_AGENZIA_ENTRATE_24TER = {
  title: 'Agenzia delle Entrate — Regime opzionale per pensionati esteri (TUIR Art. 24-ter)',
  url: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/agevolazioni/regimespecialepensionatiesteri/scheda-info-regime-pensionati-esteri',
  accessed: ACCESSED,
};

// Atenas climate rewrite sources
const CR_IMN = {
  title: 'Instituto Meteorológico Nacional Costa Rica (IMN) — Climate stations',
  url: 'https://www.imn.ac.cr/',
  accessed: ACCESSED,
};

const CLIMATE_DATA_ATENAS = {
  title: 'Climate-Data.org — Atenas, Costa Rica (avg highs 28-30°C / lows 18-20°C, dry season Dec-April)',
  url: 'https://en.climate-data.org/north-america/costa-rica/alajuela/atenas-22729/',
  accessed: ACCESSED,
};

// Alicante A2 fix sources
const ES_LEY_19_2015 = {
  title: 'Ley 19/2015 + Real Decreto 1004/2015 — A2 Spanish + CCSE required for nationality (not residency)',
  url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-7391',
  accessed: ACCESSED,
};

const ES_RD_557_2011 = {
  title: 'Real Decreto 557/2011 — long-term residence permit (no language test, per EU Directive 2003/109/EC)',
  url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2011-7703',
  accessed: ACCESSED,
};

const EU_DIRECTIVE_2003_109 = {
  title: 'Council Directive 2003/109/EC — long-term-resident third-country nationals (EU baseline)',
  url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32003L0109',
  accessed: ACCESSED,
};

// ─── #40: Italy 7% flat tax — APPEND new pro bullet ────────────────────

/** Cities where the 24-ter regime applies (qualifying southern regions). */
const ITALY_7PCT_CITIES = [
  'italy-abruzzo',
  'italy-puglia',
  'italy-sardinia',
  'italy-sicily',
];

const ITALY_7PCT_PRO = {
  text: '7% flat tax on foreign-source income for 9 years for new residents in qualifying southern-region municipalities <20K population (TUIR Art. 24-ter / Decreto Crescita 2019)',
  sources: [ITALY_TUIR_24TER, ITALY_DECRETO_CRESCITA, ITALY_AGENZIA_ENTRATE_24TER],
};

let italyAdded = 0;
let italySkipped = 0;
for (const city of ITALY_7PCT_CITIES) {
  const path = join(DATA_DIR, city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const pros = loc.pros;
  if (!Array.isArray(pros)) {
    console.warn(`SKIP ${city} — no pros array`);
    continue;
  }
  // Idempotency: skip if a 24-ter / 7% bullet already exists.
  const already = pros.some(b => {
    const t = typeof b === 'string' ? b : b?.text ?? '';
    return /24-ter|7%\s+flat\s+tax|Decreto\s+Crescita/i.test(t);
  });
  if (already) {
    italySkipped++;
    console.log(`-    italy/${city.replace('italy-', '')}: 7% bullet already present`);
    continue;
  }
  pros.push(ITALY_7PCT_PRO);
  italyAdded++;
  console.log(`OK   italy/${city.replace('italy-', '')}: appended 7% flat tax pro`);
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

// ─── #39: Pros/cons content rewords ────────────────────────────────────

const REWORDS = [
  // Atenas climate — drop the unverified NatGeo attribution, replace with
  // factual climate stats + sources.
  {
    city: 'costa-rica-atenas',
    field: 'pros',
    match: "Claimed 'best climate in the world' by National Geographic",
    replacement: {
      text: 'Notably stable mild climate year-round (avg highs 28-30°C / 82-86°F, lows 18-20°C / 64-68°F; dry season Dec-April; ~700m elevation)',
      sources: [CLIMATE_DATA_ATENAS, CR_IMN],
    },
    reason: 'The "best climate by National Geographic" claim is widely repeated but the original NatGeo article is unverifiable. Replaced with factual climate stats from Climate-Data.org + IMN.',
  },
  // Alicante A2 — fix the citizenship-vs-residency conflation.
  {
    city: 'spain-alicante',
    field: 'cons',
    match: 'A2 Spanish required for permanent residency',
    replacement: {
      text: 'A2 Spanish + CCSE required for Spanish citizenship (after 10 years residency) — NOT for long-term-resident permit, which has no language test per EU Directive 2003/109/EC + RD 557/2011',
      sources: [ES_LEY_19_2015, ES_RD_557_2011, EU_DIRECTIVE_2003_109],
    },
    reason: 'Original bullet conflated citizenship with permanent residency. Spanish long-term residence has no language test; A2+CCSE is for nationality (citizenship) only.',
  },
];

let rewordCount = 0;
let rewordNotFound = 0;
for (const r of REWORDS) {
  const path = join(DATA_DIR, r.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[r.field];
  if (!Array.isArray(list)) {
    console.warn(`SKIP ${r.city} — no ${r.field} array`);
    continue;
  }
  let found = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (text !== r.match) continue;
    found = true;
    list[i] = r.replacement;
    rewordCount++;
    console.log(`OK   reword ${r.city}.${r.field}: "${r.match}"`);
    break;
  }
  if (!found) {
    rewordNotFound++;
    console.warn(`MISS ${r.city}.${r.field}: bullet not found — "${r.match}"`);
    continue;
  }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone.`);
console.log(`  Italy 7% flat tax: added ${italyAdded}, skipped ${italySkipped}`);
console.log(`  Rewords:           updated ${rewordCount}, not-found ${rewordNotFound}`);
