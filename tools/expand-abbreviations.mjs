#!/usr/bin/env node
// Dyslexia audit F-012 (2026-04-19) — expand regional abbreviations in
// Mid-Atlantic seed-data free-text fields so dyslexic readers outside the
// DMV region can decode them on first read.
//
// Runs once. Safe to re-run: each substitution rewrites `ABBR` to the
// expanded form only when it isn't already followed by `(` or a word.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));

const FILES = [
  'data/locations/us-annandale-va/location.json',
  'data/locations/us-lorton-va/location.json',
  'data/locations/us-manassas-va/location.json',
  'data/locations/us-bowie-md/location.json',
  'data/locations/us-elkridge-md/location.json',
  'data/locations/us-glen-burnie-md/location.json',
  'data/locations/us-catonsville-md/location.json',
];

// Replacement order matters — longer / more-specific patterns first.
// The regex pattern uses a negative lookahead on letters / '(' so we only
// rewrite the bare abbreviation, not one that already includes its expansion.
const SUBS = [
  // Rail / transit
  [/\bMARC Penn Line\b/g, 'MARC (Maryland Area Regional Commuter) Penn Line'],
  [/\bMARC Camden Line\b/g, 'MARC (Maryland Area Regional Commuter) Camden Line'],
  [/\bMARC (?![A-Za-z(])/g, 'MARC (Maryland commuter rail) '],
  [/\bVRE (?!\()/g, 'VRE (Virginia Railway Express) '],
  [/\bBWI Rail Station\b/g, 'BWI (Baltimore-Washington International) Rail Station'],
  [/\bBWI Airport\b/g, 'BWI (Baltimore-Washington International) Airport'],
  [/\bBWI (?![A-Za-z(])/g, 'BWI (Baltimore-Washington International airport) '],
  [/\bMTA (?!\()/g, 'MTA (Maryland Transit Administration) '],
  [/\bICC\b(?! \()/g, 'ICC (Intercounty Connector toll road)'],

  // Regions / counties
  [/\bNOVA (?!\()/g, 'Northern Virginia (NOVA) '],
  [/\bNOVA\./g, 'Northern Virginia (NOVA).'],
  [/\bNOVA,/g, 'Northern Virginia (NOVA),'],
  [/\bouter NOVA\b/g, 'outer Northern Virginia'],
  [/\binner NOVA\b/g, 'inner Northern Virginia'],
  [/\bPG County\b/g, "Prince George's County (PG County)"],
  [/\bPWC (?!\()/g, 'Prince William County (PWC) '],

  // Schools / hospitals
  [/\bUM BWMC\b/g, 'UM BWMC (University of Maryland Baltimore Washington Medical Center)'],
  [/\bUMBC (?!\()/g, 'UMBC (University of Maryland, Baltimore County) '],
  [/\bJHU (?!\()/g, 'JHU (Johns Hopkins University) '],

  // Roads
  [/\bI-495\b(?! \()/g, 'Interstate 495'],
  [/\bI-395\b(?! \()/g, 'Interstate 395'],
  [/\bI-295\b(?! \()/g, 'Interstate 295'],
  [/\bI-95\b(?! \()/g, 'Interstate 95'],
  [/\bI-97\b(?! \()/g, 'Interstate 97'],
  [/\bI-66\b(?! \()/g, 'Interstate 66'],
  [/\bI-695\b(?! \()/g, 'Interstate 695'],
  [/\bI-66 Express Lanes\b/g, 'Interstate 66 Express Lanes'],
  [/\bI-95 Express Lanes\b/g, 'Interstate 95 Express Lanes'],

  // Benefits / misc
  [/\bSS exempt\b/g, 'Social Security exempt'],
  [/\bHOA (?!\()/g, 'HOA (homeowners association) '],
  [/\bHOAs\b/g, 'HOAs (homeowners associations)'],
  [/\bHOA,/g, 'HOA (homeowners association),'],
  [/\bHOA\./g, 'HOA (homeowners association).'],
];

let totalChanges = 0;
for (const relPath of FILES) {
  const path = resolve(ROOT, relPath);
  const before = readFileSync(path, 'utf8');
  let after = before;
  let fileChanges = 0;
  for (const [re, rep] of SUBS) {
    const matches = after.match(re);
    if (matches) {
      fileChanges += matches.length;
      after = after.replace(re, rep);
    }
  }
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    console.log(`  ${relPath}: ${fileChanges} substitution(s)`);
    totalChanges += fileChanges;
  } else {
    console.log(`  ${relPath}: no changes (already expanded?)`);
  }
}
console.log(`\nTotal: ${totalChanges} substitutions across ${FILES.length} files.`);
