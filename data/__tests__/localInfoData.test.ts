import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests local-info.json data across all locations.
 * Coverage is partial by design — clients show a graceful empty state for
 * locations without local-info data.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/localInfoData.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');

const VALID_SECTIONS = ['webcams', 'youtubeChannels', 'bloggers', 'officialSites'];

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

const locationDirs = getLocationDirs();

describe('Local Info data', () => {
  const withData: string[] = [];
  const withoutData: string[] = [];

  describe.each(locationDirs)('%s', (locDir) => {
    const liPath = path.join(LOCATIONS_DIR, locDir, 'local-info.json');

    it('local-info.json has valid structure if present', () => {
      if (!fs.existsSync(liPath)) {
        withoutData.push(locDir);
        return; // Skip — no local-info.json for this location
      }

      const raw = fs.readFileSync(liPath, 'utf-8');
      const info = JSON.parse(raw);
      expect(typeof info).toBe('object');

      // Should have at least one section with data
      const presentSections = VALID_SECTIONS.filter(
        (s) => Array.isArray(info[s]) && info[s].length > 0,
      );
      expect(presentSections.length).toBeGreaterThan(0);

      // Validate each section's entries
      for (const section of presentSections) {
        for (const entry of info[section]) {
          expect(typeof entry.name).toBe('string');
          expect(entry.name.length).toBeGreaterThan(0);
          expect(typeof entry.url).toBe('string');
          expect(entry.url.length).toBeGreaterThan(0);
        }
      }

      withData.push(locDir);
    });
  });

  it('summary: reports local-info coverage', () => {
    const total = locationDirs.length;
    const covered = withData.length;
    const missing = withoutData.length;
    console.log(`\nLocal Info Coverage: ${covered}/${total} locations (${Math.round((covered / total) * 100)}%)`);
    console.log(`Missing (${missing}):`, withoutData.join(', '));
    // Not a hard failure — local info is optional, just track coverage
    expect(covered + missing).toBe(total);
  });
});
