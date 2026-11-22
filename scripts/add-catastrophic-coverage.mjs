#!/usr/bin/env node
/**
 * Adds the `catastrophicCoverage` block to every data/locations/<id>/location.json
 * from scripts/catastrophic-coverage-by-country.json.
 *
 * Catastrophic cover (accident + cancer) is a planning requirement: each
 * location declares the pathway that carries that risk for a non-working
 * retired household. Where a sourced private premium exists it is stored as
 * per-adult age bands and the flat monthlyCosts.healthcare line is set to
 * the entry band for two adults, so flat consumers and the banded Monte
 * Carlo kernel agree in year one.
 *
 * Usage:
 *   node scripts/add-catastrophic-coverage.mjs --check   # report only
 *   node scripts/add-catastrophic-coverage.mjs           # write
 *
 * Idempotent: re-running rewrites the block from the country table.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', 'data', 'locations');
const BY_COUNTRY = JSON.parse(readFileSync(join(HERE, 'catastrophic-coverage-by-country.json'), 'utf8'));
const AS_OF = '2026-11-16';
const CHECK = process.argv.includes('--check');
const MARKER = 'Catastrophic cover required';
const SEP = ' | Previous note: ';

function serialize(obj, eol, trailing = true) {
  return JSON.stringify(obj, null, 2).replace(/\n/g, eol) + (trailing ? eol : '');
}

let changed = 0;
let roundTripMismatch = 0;
const missingCountry = new Set();
const summary = {};

for (const dir of readdirSync(DATA_DIR).sort()) {
  const file = join(DATA_DIR, dir, 'location.json');
  if (!existsSync(file)) continue;
  const raw = readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const loc = JSON.parse(raw);
  const trailing = /\n$/.test(raw);
  if (serialize(loc, eol, trailing) !== raw) roundTripMismatch++;

  const t = BY_COUNTRY[loc.country];
  if (!t) {
    missingCountry.add(loc.country);
    continue;
  }

  const block = {
    pathway: t.pathway,
    plan: t.plan,
    coversAccident: t.coversAccident,
    coversCancer: t.coversCancer,
    priceStatus: t.priceStatus,
  };
  if (t.ageBands) block.ageBands = t.ageBands.map((b) => ({ ...b }));
  block.confidence = t.confidence;
  block.asOf = AS_OF;
  block.notes = t.notes;
  block.sources = [...t.sources];
  loc.catastrophicCoverage = block;

  if (t.priceStatus === 'priced' && t.ageBands) {
    // Keep the flat line equal to the entry band for two adults.
    const sorted = [...t.ageBands].sort((a, b) => a.fromAge - b.fromAge);
    const hc = loc.monthlyCosts.healthcare;
    const prior = hc.notes ?? '';
    const base = prior.startsWith(MARKER) ? (prior.split(SEP)[1] ?? '') : prior;
    hc.typical = sorted[0].monthlyPerAdult * 2;
    if (t.healthcareLine) {
      hc.min = t.healthcareLine.min;
      hc.max = t.healthcareLine.max;
    }
    const later = sorted.slice(1).map((b) => `$${(b.monthlyPerAdult * 2).toLocaleString('en-US')}/mo from ${b.fromAge}`).join(', ');
    hc.notes = `${MARKER}: private major-medical premium for two adults` + (later ? ` (${later}; see catastrophicCoverage.ageBands).` : '.') + (base ? `${SEP}${base}` : '');
  }

  summary[loc.country] = (summary[loc.country] ?? 0) + 1;
  const out = serialize(loc, eol, trailing);
  if (out !== raw) {
    changed++;
    if (!CHECK) writeFileSync(file, out, 'utf8');
  }
}

console.log(JSON.stringify({ mode: CHECK ? 'check' : 'write', changed, roundTripMismatch, missingCountry: [...missingCountry], summary }, null, 2));
if (missingCountry.size > 0) process.exitCode = 1;
