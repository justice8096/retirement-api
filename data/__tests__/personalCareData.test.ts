import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that every location has valid personalCare data in its detailed-costs.json.
 * Clients expect categories like blackHairCare, whiteHairCare, etc.
 * Each category should have providers with name, type, address, and pricing.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/personalCareData.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

// Schema A categories (US locations)
const SCHEMA_A_CATEGORIES = ['blackHairCare', 'whiteHairCare', 'mensBigTall', 'womensClothing', 'shoes'];
// Schema B categories (Latin American / international locations)
const SCHEMA_B_CATEGORIES = ['hairCare', 'fitness', 'spa'];
// All categories a client can render
const ALL_CATEGORIES = [...SCHEMA_A_CATEGORIES, ...SCHEMA_B_CATEGORIES];

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

const locationDirs = getLocationDirs();

describe('Personal Care data completeness', () => {
  const results: { loc: string; hasPC: boolean; categories: string[]; missingCategories: string[] }[] = [];

  describe.each(locationDirs)('%s', (locDir) => {
    const dcPath = path.join(LOCATIONS_DIR, locDir, 'detailed-costs.json');

    it('has personalCare section', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      expect(dc.personalCare).toBeDefined();
      expect(dc.personalCare).not.toBeNull();
      expect(typeof dc.personalCare).toBe('object');
    });

    it('has at least one category with data', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      const pc = dc.personalCare;
      const presentCategories = ALL_CATEGORIES.filter((cat) => pc[cat] != null);
      expect(presentCategories.length).toBeGreaterThan(0);

      // Track for summary
      const missingCategories = ALL_CATEGORIES.filter((cat) => pc[cat] == null);
      results.push({
        loc: locDir,
        hasPC: true,
        categories: presentCategories,
        missingCategories,
      });
    });

    it.each(ALL_CATEGORIES)('category %s has valid structure if present', (catKey) => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      const cat = dc.personalCare?.[catKey];
      if (!cat) return; // Skip if category not present (not all locations have all categories)

      // Schema A: has providers array, priceRange object, or items array
      const hasProviders = Array.isArray(cat.providers) && cat.providers.length > 0;
      const hasPriceRange = cat.priceRange != null;
      const hasItems = Array.isArray(cat.items) && cat.items.length > 0;

      // Schema B: has sub-items with min/typical/max (e.g., mensCut, gymMonthly)
      const subValues = Object.values(cat);
      const hasSchemaB = subValues.some(
        (v: any) => v && typeof v === 'object' && 'typical' in v,
      );

      expect(hasProviders || hasPriceRange || hasItems || hasSchemaB).toBe(true);

      // If providers exist (Schema A), each should have name
      if (hasProviders) {
        for (const provider of cat.providers) {
          expect(typeof provider.name).toBe('string');
          expect(provider.name.length).toBeGreaterThan(0);
        }
      }

      // If Schema B sub-items, each should have valid typical value
      if (hasSchemaB) {
        for (const v of subValues) {
          if (v && typeof v === 'object' && 'typical' in (v as any)) {
            expect(typeof (v as any).typical).toBe('number');
          }
        }
      }
    });
  });

  // Summary test at the end
  it('summary: all locations have personalCare data', () => {
    const missing = results.filter((r) => !r.hasPC);
    if (missing.length > 0) {
      console.warn('Locations missing personalCare:', missing.map((r) => r.loc));
    }
    expect(missing.length).toBe(0);
  });
});
