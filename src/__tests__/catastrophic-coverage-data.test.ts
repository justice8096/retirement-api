/**
 * Catastrophic cover (accident + cancer) is a planning requirement: every
 * location must declare the pathway that carries it. This guards the data
 * written by scripts/add-catastrophic-coverage.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import {
  validateCatastrophicCoverage,
  resolveForeignHealthcare,
  catastrophicMonthly,
  type CatastrophicCoverage,
} from '../../shared/engine/catastrophic-coverage.js';

interface Loc {
  id: string;
  country: string;
  monthlyCosts: Record<string, { typical?: number }>;
  catastrophicCoverage?: CatastrophicCoverage;
}

function loadLocations(): Loc[] {
  const dataDir = resolve(__dirname, '../../data/locations');
  const out: Loc[] = [];
  for (const dir of readdirSync(dataDir)) {
    const p = join(dataDir, dir, 'location.json');
    if (existsSync(p)) out.push(JSON.parse(readFileSync(p, 'utf-8')));
  }
  return out;
}

const locations = loadLocations();

describe('catastrophicCoverage on every location', () => {
  it('loads the location set', () => {
    expect(locations.length).toBeGreaterThan(100);
  });

  it('every location declares a valid catastrophic pathway', () => {
    const problems = locations
      .map((l) => ({ id: l.id, errs: validateCatastrophicCoverage(l.catastrophicCoverage) }))
      .filter((x) => x.errs.length > 0);
    expect(problems).toEqual([]);
  });

  it('US locations use the ACA / Medicare model and foreign ones do not', () => {
    for (const l of locations) {
      const isUS = l.country === 'United States';
      expect(l.catastrophicCoverage?.pathway === 'us-aca-medicare', l.id).toBe(isUS);
    }
  });

  it('a private-required pathway is either priced or explicitly unpriced', () => {
    for (const l of locations.filter((x) => x.catastrophicCoverage?.pathway === 'private-required')) {
      expect(['priced', 'unpriced'], l.id).toContain(l.catastrophicCoverage!.priceStatus);
    }
  });

  it('priced locations keep the flat healthcare line equal to the entry band for two adults', () => {
    const priced = locations.filter((x) => x.catastrophicCoverage?.priceStatus === 'priced');
    expect(priced.length).toBeGreaterThan(0);
    for (const l of priced) {
      const r = resolveForeignHealthcare(l.monthlyCosts.healthcare?.typical ?? 0, l.catastrophicCoverage);
      expect(r.foreignHealthcareMonthly, l.id).toBe(0);
      expect(catastrophicMonthly(r.foreignCatastrophicAgeBands, [62, 62]), l.id).toBe(l.monthlyCosts.healthcare?.typical);
    }
  });

  it('Panama requires private cover with a premium that steps up at 70', () => {
    const panama = locations.filter((x) => x.country === 'Panama');
    expect(panama.length).toBeGreaterThan(0);
    for (const l of panama) {
      const c = l.catastrophicCoverage!;
      expect(c.pathway, l.id).toBe('private-required');
      expect(catastrophicMonthly(c.ageBands, [70, 70]), l.id).toBeGreaterThan(catastrophicMonthly(c.ageBands, [69, 69]));
    }
  });
});
