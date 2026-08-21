import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates that every URL in every location's local-info.json is reachable (no 404).
 * Uses HEAD requests with GET fallback. Runs with a generous timeout since it hits
 * external servers.
 *
 * Adopted from the retirement-dashboard React repo (src/__tests__/localInfoLinks.test.ts)
 * as part of consolidation task C1. Repointed from the React repo's
 * public/data/locations mirror to the canonical data/locations/ this API serves.
 *
 * Run specifically:  npx vitest run data/__tests__/localInfoLinks.test.ts --testTimeout 300000
 */

const LOCATIONS_DIR = path.join(__dirname, '..', 'locations');
const REQUEST_TIMEOUT = 15000; // 15s per request
const CONCURRENCY = 10; // max parallel requests

interface LinkEntry {
  name: string;
  url: string;
  [key: string]: unknown;
}

interface LocalInfo {
  webcams?: LinkEntry[];
  youtubeChannels?: LinkEntry[];
  bloggers?: LinkEntry[];
  officialSites?: LinkEntry[];
}

interface LinkCheck {
  location: string;
  section: string;
  name: string;
  url: string;
}

function getLocationDirs(): string[] {
  return fs.readdirSync(LOCATIONS_DIR).filter((d) => {
    return fs.statSync(path.join(LOCATIONS_DIR, d)).isDirectory();
  });
}

function getAllLinks(): LinkCheck[] {
  const links: LinkCheck[] = [];
  const locationDirs = getLocationDirs();

  for (const locDir of locationDirs) {
    const liPath = path.join(LOCATIONS_DIR, locDir, 'local-info.json');
    if (!fs.existsSync(liPath)) continue;

    const info: LocalInfo = JSON.parse(fs.readFileSync(liPath, 'utf-8'));
    const sections: (keyof LocalInfo)[] = ['webcams', 'youtubeChannels', 'bloggers', 'officialSites'];

    for (const section of sections) {
      const entries = info[section];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry.url) {
          links.push({
            location: locDir,
            section,
            name: entry.name || '(unnamed)',
            url: entry.url,
          });
        }
      }
    }
  }

  return links;
}

/** Check a single URL — HEAD first, fallback to GET */
async function checkUrl(url: string): Promise<{ status: number; ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    // Try HEAD first (faster, less bandwidth)
    let res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // Some servers reject HEAD — retry with GET if 403/405/406
    if (res.status === 403 || res.status === 405 || res.status === 406) {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), REQUEST_TIMEOUT);
      try {
        res = await fetch(url, {
          method: 'GET',
          signal: controller2.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
      } finally {
        clearTimeout(timer2);
      }
    }

    clearTimeout(timer);
    return { status: res.status, ok: res.status < 400 };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { status: 0, ok: false, error: 'TIMEOUT' };
    }
    return { status: 0, ok: false, error: err.message || String(err) };
  }
}

/** Run checks with concurrency limit */
async function checkLinksWithConcurrency(
  links: LinkCheck[],
): Promise<Map<string, { status: number; ok: boolean; error?: string }>> {
  const results = new Map<string, { status: number; ok: boolean; error?: string }>();

  // Deduplicate URLs (same URL may appear in multiple locations)
  const uniqueUrls = [...new Set(links.map((l) => l.url))];

  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((url) => checkUrl(url)));
    batch.forEach((url, idx) => {
      results.set(url, batchResults[idx]!);
    });
  }

  return results;
}

// Collect all links before tests run
const allLinks = getAllLinks();
const uniqueUrls = [...new Set(allLinks.map((l) => l.url))];

describe('Local Info link validation', () => {
  let results: Map<string, { status: number; ok: boolean; error?: string }>;

  it(
    `should check all ${uniqueUrls.length} unique URLs across ${allLinks.length} link entries`,
    async () => {
      results = await checkLinksWithConcurrency(allLinks);
      expect(results.size).toBe(uniqueUrls.length);
    },
    300000,
  ); // 5 min timeout for the network sweep

  it('should report results', () => {
    if (!results) return;

    const broken: { location: string; section: string; name: string; url: string; status: number; error?: string }[] = [];
    const working: string[] = [];

    for (const link of allLinks) {
      const result = results.get(link.url);
      if (!result) continue;

      if (!result.ok) {
        broken.push({
          ...link,
          status: result.status,
          error: result.error,
        });
      } else {
        working.push(link.url);
      }
    }

    const uniqueWorking = new Set(working).size;
    const uniqueBroken = new Set(broken.map((b) => b.url)).size;

    console.log(`\n=== Local Info Link Check Results ===`);
    console.log(`Total link entries: ${allLinks.length}`);
    console.log(`Unique URLs: ${uniqueUrls.length}`);
    console.log(`Working: ${uniqueWorking}`);
    console.log(`Broken: ${uniqueBroken}`);

    if (broken.length > 0) {
      console.log(`\n--- Broken Links ---`);
      // Group by URL to avoid duplicate output
      const byUrl = new Map<string, typeof broken>();
      for (const b of broken) {
        if (!byUrl.has(b.url)) byUrl.set(b.url, []);
        byUrl.get(b.url)!.push(b);
      }
      for (const [url, entries] of byUrl) {
        const first = entries[0]!;
        const locs = entries.map((e) => e.location).join(', ');
        console.log(
          `  ${first.status || 'ERR'} | ${url}\n` +
            `      Name: ${first.name} | Section: ${first.section}\n` +
            `      Locations: ${locs}` +
            (first.error ? `\n      Error: ${first.error}` : ''),
        );
      }
    }

    // Fail the test if any links are 404
    // 403 = site blocks bots but exists; ERR/timeout = network issue, not broken content
    // Only 404 means the page truly doesn't exist
    const true404s = broken.filter((b) => b.status === 404);
    if (true404s.length > 0) {
      const urls404 = [...new Set(true404s.map((b) => `${b.url} (${b.location}/${b.section})`))];
      expect.fail(
        `Found ${urls404.length} URLs returning 404:\n${urls404.join('\n')}`,
      );
    }
  });
}, 600000); // 10 min overall suite timeout
