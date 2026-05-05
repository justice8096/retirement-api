#!/usr/bin/env node
/**
 * Cyprus citations (Todo #19, ninth country sweep).
 * 2 bullets across 2 cities, including a factual fix on Cyprus retiree
 * pension tax (the bullet conflated the 5% pension flat tax with the
 * 2.65% GeSY healthcare contribution).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'locations');
const ACCESSED = '2026-05-03';

/** Cyprus Tax Department — pension income special regime (Article 13
 *  of Income Tax Law). Retirees can elect 5% flat tax on foreign-source
 *  pension income above €3,420/yr, or use normal progressive brackets —
 *  whichever is lower. */
const CY_TAX_DEPT = {
  title: 'Cyprus Tax Department — Income Tax Law (foreign pension special regime, Art. 13)',
  url: 'https://www.mof.gov.cy/mof/tax/taxdep.nsf',
  accessed: ACCESSED,
};

const CY_INCOME_TAX_GUIDE = {
  title: 'PwC Cyprus — Pension income tax options for retirees',
  url: 'https://taxsummaries.pwc.com/cyprus/individual/income-determination',
  accessed: ACCESSED,
};

/** GeSY (General Health System) contribution rate — 2.65% of income
 *  for employees / pensioners. Separate from income tax. */
const GESY_RATES = {
  title: 'Health Insurance Organisation Cyprus — GeSY contribution rates (2.65% pensioner rate)',
  url: 'https://www.gesy.org.cy/en-gb/contributions',
  accessed: ACCESSED,
};

/** Larnaca International Airport (LCA) — Cyprus' main international
 *  gateway, ~7M annual passengers, operated by Hermes Airports. */
const LCA_AIRPORT = {
  title: 'Hermes Airports — Larnaca International Airport (LCA)',
  url: 'https://www.hermesairports.com/larnaka',
  accessed: ACCESSED,
};

const UPDATES = [
  {
    city: 'cyprus-larnaca',
    field: 'pros',
    match: 'International airport for easy travel',
    replacement: {
      text: "International airport for easy travel (Larnaca International — Cyprus' main gateway, ~7M annual passengers)",
      sources: [LCA_AIRPORT],
    },
  },
  {
    // FIX: bullet conflates GeSY (2.65%) with pension tax. Real pension
    // regime is optional 5% flat above €3,420/yr or normal progressive.
    city: 'cyprus-paphos',
    field: 'pros',
    match: 'Very favorable tax treatment for retirees (2.65% on pensions)',
    replacement: {
      text: 'Very favorable tax treatment for retirees: optional 5% flat tax on foreign pension income above €3,420/yr (or normal progressive brackets) + separate 2.65% GeSY health contribution',
      sources: [CY_TAX_DEPT, CY_INCOME_TAX_GUIDE, GESY_RATES],
    },
  },
];

let updated = 0, alreadyCited = 0, notFound = 0;

for (const u of UPDATES) {
  const path = join(DATA_DIR, u.city, 'location.json');
  const raw = readFileSync(path, 'utf8');
  const loc = JSON.parse(raw);
  const list = loc[u.field];
  if (!Array.isArray(list)) { console.warn(`SKIP ${u.city} — no ${u.field}`); continue; }
  let found = false;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const text = typeof entry === 'string' ? entry : entry?.text;
    if (text !== u.match) continue;
    found = true;
    if (typeof entry !== 'string' && entry?.sources?.length && !u.overwrite) {
      alreadyCited++;
      console.log(`-    ${u.city}.${u.field}: already cited`);
      break;
    }
    list[i] = u.replacement;
    updated++;
    console.log(`OK   ${u.city}.${u.field}: cited "${u.match}"`);
    break;
  }
  if (!found) { notFound++; console.warn(`MISS ${u.city}.${u.field}: "${u.match}"`); continue; }
  const hadTrailingNewline = raw.endsWith('\n');
  writeFileSync(path, JSON.stringify(loc, null, 2) + (hadTrailingNewline ? '\n' : ''));
}

console.log(`\nDone. Updated ${updated}, already-cited ${alreadyCited}, not-found ${notFound}`);
