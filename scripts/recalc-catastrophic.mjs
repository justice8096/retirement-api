#!/usr/bin/env node
/**
 * Recalculates retirement outcomes with catastrophic cover as a requirement.
 *
 * For each location it compares, on the shared Monte Carlo kernel:
 *   before  : the flat healthcare line as it stood before the requirement
 *   required: the age-banded catastrophic premium from catastrophicCoverage
 *   +PartB  : required, plus Medicare Part B kept as a US fallback from 65
 *
 * Usage: node scripts/recalc-catastrophic.mjs [locationId ...]
 * Household inputs come from env vars so no personal figures live in the repo:
 *   RP_PORTFOLIO, RP_MONTHLY_INCOME, RP_BIRTH_YEARS (comma list), RP_START_YEAR,
 *   RP_BASE_OVERRIDE (optional non-healthcare monthly base), RP_BEFORE_HEALTHCARE,
 *   RP_PART_B (per adult per month), RP_RUNS, RP_YEARS
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMonteCarlo, mulberry32 } from '../shared/engine/monte-carlo.js';
import { resolveForeignHealthcare } from '../shared/engine/catastrophic-coverage.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const num = (k, d) => (process.env[k] != null && process.env[k] !== '' ? Number(process.env[k]) : d);

const portfolio = num('RP_PORTFOLIO', 1_000_000);
const monthlyIncome = num('RP_MONTHLY_INCOME', 4_000);
const birthYears = (process.env.RP_BIRTH_YEARS ?? '1963,1964').split(',').map(Number);
const startYear = num('RP_START_YEAR', 2028);
const baseOverride = num('RP_BASE_OVERRIDE', NaN);
const beforeHealthcare = num('RP_BEFORE_HEALTHCARE', NaN);
const partB = num('RP_PART_B', 210);
const runs = num('RP_RUNS', 2000);
const years = num('RP_YEARS', 30);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['panama-boquete'];

function load(id) {
  return JSON.parse(readFileSync(join(HERE, '..', 'data', 'locations', id, 'location.json'), 'utf8'));
}

function nonHealthcareBase(loc) {
  let total = 0;
  for (const [k, v] of Object.entries(loc.monthlyCosts)) {
    if (k === 'healthcare' || k === 'taxes') continue;
    if (typeof v?.typical === 'number') total += v.typical;
  }
  return total;
}

function run(segment, returnMode) {
  const r = runMonteCarlo({
    portfolio,
    monthlyIncome,
    baseCost: segment.nonHealthcareBase,
    isForeign: true,
    fxDrift: 0,
    runs,
    years,
    meanReturn: 0.07,
    volReturn: 0.13,
    meanInflation: 0.025,
    volInflation: 0.01,
    currVol: 0,
    incGrowth: 0.025,
    returnMode,
    adultBirthYears: birthYears,
    simStartYear: startYear,
    moveSchedule: [segment],
    seededRandom: mulberry32(42),
  });
  const sorted = [...r.results].sort((a, b) => a - b);
  const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const success = sorted.filter((x) => x > 0).length / sorted.length;
  return { success: Math.round(success * 1000) / 10, median: Math.round(pct(0.5)), p5: Math.round(pct(0.05)) };
}

const out = [];
for (const id of ids) {
  const loc = load(id);
  const base = Number.isFinite(baseOverride) ? baseOverride : nonHealthcareBase(loc);
  const resolved = resolveForeignHealthcare(loc.monthlyCosts.healthcare?.typical ?? 0, loc.catastrophicCoverage);
  const seg = { fromYear: 0, baseCost: 0, isForeign: true, isUS: false, nonHealthcareBase: base, monthlyIncomeTax: 0 };
  const scenarios = {
    before: { ...seg, foreignHealthcareMonthly: Number.isFinite(beforeHealthcare) ? beforeHealthcare : (loc.monthlyCosts.healthcare?.typical ?? 0) },
    required: { ...seg, foreignHealthcareMonthly: resolved.foreignHealthcareMonthly, foreignCatastrophicAgeBands: resolved.foreignCatastrophicAgeBands },
    requiredPlusPartB: { ...seg, foreignHealthcareMonthly: resolved.foreignHealthcareMonthly, foreignCatastrophicAgeBands: resolved.foreignCatastrophicAgeBands, foreignMedicareFallbackMonthlyPerAdult: partB },
  };
  for (const mode of ['normal', 'bootstrap', 'regime']) {
    for (const [name, s] of Object.entries(scenarios)) {
      out.push({ id, nonHealthcareBase: base, mode, scenario: name, ...run(s, mode) });
    }
  }
}
console.table(out);
