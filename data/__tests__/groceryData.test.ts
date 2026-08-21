import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates grocery data across all locations.
 * Every location should have 9 categories with properly structured items.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/groceryData.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

const REQUIRED_CATEGORIES = [
  'produce', 'proteins', 'grains', 'dairy', 'pantry',
  'beverages', 'snacks', 'frozen', 'supplements',
];

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

const locationDirs = getLocationDirs();

describe('Grocery data', () => {
  describe.each(locationDirs)('%s', (locDir) => {
    const dcPath = path.join(LOCATIONS_DIR, locDir, 'detailed-costs.json');

    it('has groceries section with categories array', () => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      expect(dc.groceries).toBeDefined();
      expect(Array.isArray(dc.groceries.categories)).toBe(true);
      expect(dc.groceries.categories.length).toBeGreaterThanOrEqual(9);
    });

    it.each(REQUIRED_CATEGORIES)('has %s category with items', (catId) => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      const cat = dc.groceries.categories.find((c: any) => c.id === catId);
      expect(cat).toBeDefined();
      expect(cat.name).toBeTruthy();
      expect(Array.isArray(cat.items)).toBe(true);
      expect(cat.items.length).toBeGreaterThan(0);

      // Each item should have name and monthlyCost
      for (const item of cat.items) {
        expect(typeof item.name).toBe('string');
        expect(item.name.length).toBeGreaterThan(0);
        expect(typeof item.monthlyCost).toBe('number');
        expect(item.monthlyCost).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
