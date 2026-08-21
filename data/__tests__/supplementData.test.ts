import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that every location has all expected sections in detailed-costs.json.
 * Catches missing supplement data that would cause clients to show empty states.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/supplementData.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

const REQUIRED_SECTIONS = [
  'housing',
  'entertainment',
  'transportation',
  'groceries',
  'visionDental',
  'personalCare',
  'healthcare',
  'medicine',
  'cellPhone',
  'seniorDiscounts',
];

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

describe('Supplement data completeness', () => {
  const locationDirs = getLocationDirs();

  it('should find all 138 location directories', () => {
    expect(locationDirs.length).toBeGreaterThanOrEqual(138);
  });

  describe.each(locationDirs)('%s', (locDir) => {
    const dcPath = path.join(LOCATIONS_DIR, locDir, 'detailed-costs.json');

    it('has detailed-costs.json with valid JSON', () => {
      expect(fs.existsSync(dcPath)).toBe(true);
      const raw = fs.readFileSync(dcPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it.each(REQUIRED_SECTIONS)('has %s section', (section) => {
      const dc = JSON.parse(fs.readFileSync(dcPath, 'utf-8'));
      expect(dc[section]).toBeDefined();
      expect(dc[section]).not.toBeNull();
      expect(typeof dc[section]).toBe('object');
    });
  });
});
