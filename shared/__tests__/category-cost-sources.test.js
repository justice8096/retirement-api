import { describe, it, expect } from 'vitest';
import {
  CATEGORY_COST_SOURCES,
  COUNTRY_CATEGORY_COST_SOURCES,
  costSourcesFor,
} from '../category-cost-sources.js';

describe('CATEGORY_COST_SOURCES (global default)', () => {
  it('has rent, groceries, utilities, healthcare entries', () => {
    expect(CATEGORY_COST_SOURCES.rent).toBeDefined();
    expect(CATEGORY_COST_SOURCES.groceries).toBeDefined();
    expect(CATEGORY_COST_SOURCES.utilities).toBeDefined();
    expect(CATEGORY_COST_SOURCES.healthcare).toBeDefined();
  });

  it('every category has at least one source with title + url', () => {
    for (const [cat, sources] of Object.entries(CATEGORY_COST_SOURCES)) {
      expect(sources.length, `${cat} should have at least one source`).toBeGreaterThan(0);
      for (const s of sources) {
        expect(s.title, `${cat} source missing title`).toBeTruthy();
        expect(s.url, `${cat} source missing url`).toBeTruthy();
        expect(s.url).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('COUNTRY_CATEGORY_COST_SOURCES (country-specific)', () => {
  it('registers United States with first-party BLS / EIA / CMS sources', () => {
    const us = COUNTRY_CATEGORY_COST_SOURCES['United States'];
    expect(us).toBeDefined();
    expect(us.rent[0].url).toContain('bls.gov');
    expect(us.utilities[0].url).toContain('eia.gov');
    expect(us.healthcare[0].url).toContain('cms.gov');
  });

  it('registers France with INSEE / Ameli / ARCEP sources', () => {
    const fr = COUNTRY_CATEGORY_COST_SOURCES['France'];
    expect(fr).toBeDefined();
    expect(fr.rent[0].url).toContain('insee.fr');
    expect(fr.healthcare[0].url).toContain('ameli.fr');
    expect(fr.phoneCell[0].url).toContain('arcep.fr');
  });

  it('registers Mexico with INEGI / IMSS / CFE sources', () => {
    const mx = COUNTRY_CATEGORY_COST_SOURCES['Mexico'];
    expect(mx).toBeDefined();
    expect(mx.rent[0].url).toContain('inegi.org.mx');
    expect(mx.utilities[0].url).toContain('cfe.mx');
    expect(mx.healthcare[0].url).toContain('imss.gob.mx');
  });

  it('every country source has title + url', () => {
    for (const [country, byCat] of Object.entries(COUNTRY_CATEGORY_COST_SOURCES)) {
      for (const [cat, sources] of Object.entries(byCat)) {
        for (const s of sources) {
          expect(s.title, `${country}.${cat} missing title`).toBeTruthy();
          expect(s.url, `${country}.${cat} missing url`).toBeTruthy();
          expect(s.url).toMatch(/^https?:\/\//);
        }
      }
    }
  });
});

describe('costSourcesFor() lookup', () => {
  it('returns global sources when no country supplied', () => {
    const result = costSourcesFor('rent');
    expect(result).toBe(CATEGORY_COST_SOURCES.rent);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns global sources when country not in COUNTRY_CATEGORY_COST_SOURCES', () => {
    const result = costSourcesFor('rent', 'Kazakhstan');
    expect(result).toBe(CATEGORY_COST_SOURCES.rent);
  });

  it('prepends country-specific sources, then appends global', () => {
    const usRent = costSourcesFor('rent', 'United States');
    expect(usRent.length).toBe(
      COUNTRY_CATEGORY_COST_SOURCES['United States'].rent.length +
        CATEGORY_COST_SOURCES.rent.length,
    );
    // First entry must be the country-specific one
    expect(usRent[0].url).toContain('bls.gov');
    // Last entry should be from the global default (Numbeo or Expatistan)
    expect(usRent[usRent.length - 1].url).toMatch(/numbeo|expatistan|oecd/i);
  });

  it('returns only global when country has no category override', () => {
    // Cyprus has rent + groceries + healthcare but not utilities in our map.
    const cyprusUtilities = costSourcesFor('utilities', 'Cyprus');
    expect(cyprusUtilities).toBe(CATEGORY_COST_SOURCES.utilities);
  });

  it('returns undefined for unknown category', () => {
    expect(costSourcesFor('nonexistent-category')).toBeUndefined();
    expect(costSourcesFor('nonexistent-category', 'France')).toBeUndefined();
  });

  it('handles null/undefined country gracefully', () => {
    expect(costSourcesFor('rent', null)).toBe(CATEGORY_COST_SOURCES.rent);
    expect(costSourcesFor('rent', undefined)).toBe(CATEGORY_COST_SOURCES.rent);
  });
});

describe('country coverage', () => {
  it('covers all countries that retirement-api tracks via taxSourcesFor', () => {
    // Smoke check: at minimum US + France + Spain + Italy + Portugal +
    // Ireland + Greece + Cyprus + Malta + Croatia + Mexico + Costa Rica
    // + Colombia + Ecuador + Panama + Uruguay (16 countries).
    const expected = [
      'United States', 'France', 'Spain', 'Italy', 'Portugal',
      'Ireland', 'Greece', 'Cyprus', 'Malta', 'Croatia',
      'Mexico', 'Costa Rica', 'Colombia', 'Ecuador', 'Panama', 'Uruguay',
    ];
    for (const c of expected) {
      expect(
        COUNTRY_CATEGORY_COST_SOURCES[c],
        `country ${c} should be in COUNTRY_CATEGORY_COST_SOURCES`,
      ).toBeDefined();
    }
  });

  it('every covered country has at least rent + groceries categories', () => {
    for (const [country, byCat] of Object.entries(COUNTRY_CATEGORY_COST_SOURCES)) {
      expect(byCat.rent, `${country} should cover rent`).toBeDefined();
      expect(byCat.groceries, `${country} should cover groceries`).toBeDefined();
    }
  });
});
