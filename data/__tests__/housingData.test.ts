import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that every location has valid housing data in its detailed-costs.json.
 * This catches locations where the housing section is missing, malformed, or
 * missing required fields that clients need to render.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/housingData.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

describe('Housing data completeness', () => {
  const locationDirs = getLocationDirs();

  it('should find all 138 location directories', () => {
    expect(locationDirs.length).toBeGreaterThanOrEqual(138);
  });

  describe.each(locationDirs)('%s', (locDir) => {
    const dcPath = path.join(LOCATIONS_DIR, locDir, 'detailed-costs.json');

    it('has detailed-costs.json', () => {
      expect(fs.existsSync(dcPath)).toBe(true);
    });

    it('has valid JSON in detailed-costs.json', () => {
      const raw = fs.readFileSync(dcPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('has a housing section', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      expect(dc.housing).toBeDefined();
      expect(dc.housing).not.toBeNull();
    });

    it('has housing.propertyType', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      expect(typeof dc.housing.propertyType).toBe('string');
      expect(dc.housing.propertyType.length).toBeGreaterThan(0);
    });

    it('has housing.monthlyBudget with min/typical/max', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      const budget = dc.housing.monthlyBudget;
      expect(budget).toBeDefined();
      expect(typeof budget.min).toBe('number');
      expect(typeof budget.typical).toBe('number');
      expect(typeof budget.max).toBe('number');
      expect(budget.min).toBeGreaterThan(0);
      expect(budget.typical).toBeGreaterThanOrEqual(budget.min);
      expect(budget.max).toBeGreaterThanOrEqual(budget.typical);
    });

    it('has housing.breakdown with baseRent and total', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      const bd = dc.housing.breakdown;
      expect(bd).toBeDefined();
      // Must have at least baseRent (or baseRentEUR for EUR locations)
      const hasBaseRent = typeof bd.baseRent === 'number' || typeof bd.baseRentEUR === 'number';
      expect(hasBaseRent).toBe(true);
      // Must have a total
      const hasTotal = typeof bd.total === 'number' || typeof bd.totalUSD === 'number' || typeof bd.totalEUR === 'number';
      expect(hasTotal).toBe(true);
    });
  });
});
