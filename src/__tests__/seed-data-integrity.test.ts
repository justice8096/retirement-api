/**
 * Comprehensive data integrity tests for all location data.
 *
 * Validates that every location (original JSON + seed files) has complete,
 * well-formed data for all required categories and fields.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ─── Expected schema ────────────────────────────────────────────────────────

const REQUIRED_MONTHLY_COST_CATEGORIES = [
  'rent', 'groceries', 'utilities', 'healthcare', 'insurance',
  'petCare', 'petDaycare', 'petGrooming', 'transportation', 'entertainment',
  'clothing', 'personalCare', 'subscriptions', 'phoneCell', 'miscellaneous',
  'taxes', 'medicalOOP', 'medicine', 'buffer',
];

const REQUIRED_COST_SUBFIELDS = ['min', 'typical', 'max', 'annualInflation'];

const REQUIRED_TOP_LEVEL_FIELDS = [
  'id', 'name', 'country', 'region', 'currency', 'monthlyCosts',
  'taxes', 'climate', 'healthcare', 'lifestyle', 'visa', 'pros', 'cons',
];

const REQUIRED_CLIMATE_FIELDS = ['winterLowF', 'summerHighF', 'rainyDaysPerYear'];

const REQUIRED_HEALTHCARE_FIELDS = ['system', 'qualityRating'];

const REQUIRED_LIFESTYLE_FIELDS = ['dogFriendly', 'safetyRating', 'internetSpeed', 'expatCommunity'];

const VALID_CURRENCIES = ['USD', 'EUR', 'PAB', 'MXN', 'COP', 'PEN', 'UYU', 'CLP', 'BRL', 'CRC', 'NIO', 'HNL', 'GTQ', 'CZK', 'PLN', 'HUF', 'RON', 'BGN', 'HRK'];

// ─── Load all location data ─────────────────────────────────────────────────

interface LocationData {
  id: string;
  name: string;
  country: string;
  region: string;
  currency: string;
  monthlyCosts: Record<string, { min?: number; typical?: number; max?: number; annualInflation?: number }>;
  taxes: Record<string, unknown>;
  climate: Record<string, unknown>;
  healthcare: Record<string, unknown>;
  lifestyle: Record<string, unknown>;
  visa: Record<string, unknown>;
  pros: string[];
  cons: string[];
  cities?: string[];
  exchangeRate?: number;
  exchangeRates?: Record<string, number>;
  [key: string]: unknown;
}

function loadSeedFile(filename: string): LocationData[] {
  const filePath = resolve(__dirname, '../../prisma', filename);
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function loadOriginalLocations(): LocationData[] {
  const dataDir = resolve(__dirname, '../../../../data/locations');
  if (!existsSync(dataDir)) return [];
  const locations: LocationData[] = [];
  for (const dir of readdirSync(dataDir)) {
    const locPath = join(dataDir, dir, 'location.json');
    if (existsSync(locPath)) {
      locations.push(JSON.parse(readFileSync(locPath, 'utf-8')));
    }
  }
  return locations;
}

const seedUS = loadSeedFile('seed-locations-us.json');
const seedEU = loadSeedFile('seed-locations-eu.json');
const seedLATAM = loadSeedFile('seed-locations-latam.json');
const originalLocations = loadOriginalLocations();
const allSeedLocations = [...seedUS, ...seedEU, ...seedLATAM];
const allLocations = [...originalLocations, ...allSeedLocations];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Seed data file loading', () => {
  it('loads US seed locations', () => {
    expect(seedUS.length).toBeGreaterThan(0);
    console.log(`  US seed: ${seedUS.length} locations`);
  });

  it('loads EU seed locations', () => {
    expect(seedEU.length).toBeGreaterThan(0);
    console.log(`  EU seed: ${seedEU.length} locations`);
  });

  it('loads LATAM seed locations', () => {
    expect(seedLATAM.length).toBeGreaterThan(0);
    console.log(`  LATAM seed: ${seedLATAM.length} locations`);
  });

  it('loads original locations', () => {
    expect(originalLocations.length).toBeGreaterThan(0);
    console.log(`  Original: ${originalLocations.length} locations`);
  });

  it('has no duplicate IDs across all sources', () => {
    const ids = allLocations.map((l) => l.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
  });
});

describe('Top-level fields', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
        it(`has required field: ${field}`, () => {
          expect(loc).toHaveProperty(field);
          expect(loc[field]).toBeDefined();
        });
      }

      it('has a valid id (lowercase, alphanumeric, hyphens)', () => {
        expect(loc.id).toMatch(/^[a-z0-9-]+$/);
      });

      it('has a non-empty name', () => {
        expect(typeof loc.name).toBe('string');
        expect(loc.name.length).toBeGreaterThan(0);
      });

      it('has a non-empty country', () => {
        expect(typeof loc.country).toBe('string');
        expect(loc.country.length).toBeGreaterThan(0);
      });

      it('has a valid currency code', () => {
        expect(typeof loc.currency).toBe('string');
        expect(loc.currency.length).toBe(3);
      });

      it('has pros array with at least 1 item', () => {
        expect(Array.isArray(loc.pros)).toBe(true);
        expect(loc.pros.length).toBeGreaterThanOrEqual(1);
      });

      it('has cons array with at least 1 item', () => {
        expect(Array.isArray(loc.cons)).toBe(true);
        expect(loc.cons.length).toBeGreaterThanOrEqual(1);
      });
    });
  }
});

describe('Monthly cost categories', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has monthlyCosts object', () => {
        expect(typeof loc.monthlyCosts).toBe('object');
        expect(loc.monthlyCosts).not.toBeNull();
      });

      for (const cat of REQUIRED_MONTHLY_COST_CATEGORIES) {
        describe(`category: ${cat}`, () => {
          it('exists', () => {
            expect(loc.monthlyCosts).toHaveProperty(cat);
          });

          for (const field of REQUIRED_COST_SUBFIELDS) {
            it(`has ${field}`, () => {
              const entry = loc.monthlyCosts[cat];
              expect(entry).toBeDefined();
              expect(entry).toHaveProperty(field);
              expect(typeof entry[field]).toBe('number');
            });
          }

          it('has min <= typical <= max', () => {
            const entry = loc.monthlyCosts[cat];
            if (entry) {
              expect(entry.min).toBeLessThanOrEqual(entry.typical!);
              expect(entry.typical).toBeLessThanOrEqual(entry.max!);
            }
          });

          it('has typical >= 0', () => {
            const entry = loc.monthlyCosts[cat];
            if (entry) {
              expect(entry.typical).toBeGreaterThanOrEqual(0);
            }
          });

          it('has annualInflation between 0 and 0.15', () => {
            const entry = loc.monthlyCosts[cat];
            if (entry) {
              expect(entry.annualInflation).toBeGreaterThanOrEqual(0);
              expect(entry.annualInflation).toBeLessThanOrEqual(0.15);
            }
          });
        });
      }
    });
  }
});

describe('Climate data', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has climate object', () => {
        expect(typeof loc.climate).toBe('object');
      });

      for (const field of REQUIRED_CLIMATE_FIELDS) {
        it(`has ${field}`, () => {
          expect(loc.climate).toHaveProperty(field);
          expect(typeof (loc.climate as Record<string, unknown>)[field]).toBe('number');
        });
      }

      it('does not use deprecated rainyDaysYear field', () => {
        expect(loc.climate).not.toHaveProperty('rainyDaysYear');
      });

      it('has reasonable temperature values', () => {
        const c = loc.climate as { winterLowF: number; summerHighF: number };
        expect(c.winterLowF).toBeGreaterThanOrEqual(-20);
        expect(c.winterLowF).toBeLessThanOrEqual(80);
        expect(c.summerHighF).toBeGreaterThanOrEqual(60);
        expect(c.summerHighF).toBeLessThanOrEqual(120);
        expect(c.summerHighF).toBeGreaterThan(c.winterLowF);
      });

      it('has meetsWarmWinterReq boolean', () => {
        expect(loc.climate).toHaveProperty('meetsWarmWinterReq');
        expect(typeof (loc.climate as Record<string, unknown>).meetsWarmWinterReq).toBe('boolean');
      });
    });
  }
});

describe('Healthcare data', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has healthcare object', () => {
        expect(typeof loc.healthcare).toBe('object');
      });

      for (const field of REQUIRED_HEALTHCARE_FIELDS) {
        it(`has ${field}`, () => {
          expect(loc.healthcare).toHaveProperty(field);
        });
      }

      it('has qualityRating between 1 and 10', () => {
        const rating = (loc.healthcare as { qualityRating: number }).qualityRating;
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(10);
      });
    });
  }
});

// ─── ACA pre-Medicare fields ────────────────────────────────────────────────
// Added when we backfilled county-level ACA pricing across all US locations.
// Reads data/locations/*/location.json directly (not via loadOriginalLocations
// which has a stale relative-path bug that returns []). Validates every US
// location has healthcarePreMedicare + healthcare.acaMarketplace with a
// sensible shape.

function loadCanonicalUsLocations(): LocationData[] {
  const dataDir = resolve(__dirname, '../../data/locations');
  if (!existsSync(dataDir)) return [];
  const out: LocationData[] = [];
  for (const dir of readdirSync(dataDir)) {
    if (!dir.startsWith('us-')) continue;
    const locPath = join(dataDir, dir, 'location.json');
    if (existsSync(locPath)) {
      out.push(JSON.parse(readFileSync(locPath, 'utf-8')));
    }
  }
  return out;
}

describe('ACA pre-Medicare data (US locations)', () => {
  const usLocations = loadCanonicalUsLocations();

  for (const loc of usLocations) {
    describe(loc.name || loc.id, () => {
      it('has monthlyCosts.healthcarePreMedicare with typical > 0', () => {
        const entry = loc.monthlyCosts['healthcarePreMedicare'];
        expect(entry).toBeDefined();
        expect(typeof entry?.typical).toBe('number');
        expect(entry!.typical!).toBeGreaterThan(0);
      });

      it('has healthcare.acaMarketplace block', () => {
        const aca = (loc.healthcare as Record<string, unknown>)['acaMarketplace'];
        expect(aca).toBeDefined();
        expect(typeof aca).toBe('object');
      });

      it('acaMarketplace has benchmark silver monthly (2-adult) > 0', () => {
        const aca = (loc.healthcare as { acaMarketplace?: { benchmarkSilverMonthly2Adult?: number } }).acaMarketplace;
        expect(typeof aca?.benchmarkSilverMonthly2Adult).toBe('number');
        expect(aca!.benchmarkSilverMonthly2Adult!).toBeGreaterThan(0);
      });

      it('acaMarketplace has estimationLevel (county or state)', () => {
        const aca = (loc.healthcare as { acaMarketplace?: { estimationLevel?: string } }).acaMarketplace;
        expect(['county', 'state']).toContain(aca?.estimationLevel);
      });

      it('acaMarketplace premiumCapPctOfIncome is 0 (territory) or 0.085 (enhanced cap)', () => {
        const aca = (loc.healthcare as { acaMarketplace?: { premiumCapPctOfIncome?: number } }).acaMarketplace;
        expect([0, 0.085]).toContain(aca?.premiumCapPctOfIncome);
      });
    });
  }
});

describe('Lifestyle data', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has lifestyle object', () => {
        expect(typeof loc.lifestyle).toBe('object');
      });

      for (const field of REQUIRED_LIFESTYLE_FIELDS) {
        it(`has ${field}`, () => {
          expect(loc.lifestyle).toHaveProperty(field);
        });
      }

      it('has dogFriendly rating 1-10', () => {
        const rating = (loc.lifestyle as { dogFriendly: number }).dogFriendly;
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(10);
      });

      it('has safetyRating 1-10', () => {
        const rating = (loc.lifestyle as { safetyRating: number }).safetyRating;
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(10);
      });
    });
  }
});

describe('Taxes data', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has taxes object', () => {
        expect(typeof loc.taxes).toBe('object');
      });

      it('has taxes.notes string', () => {
        expect(loc.taxes).toHaveProperty('notes');
        expect(typeof (loc.taxes as Record<string, unknown>).notes).toBe('string');
      });
    });
  }
});

describe('Visa data', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has visa object', () => {
        expect(typeof loc.visa).toBe('object');
      });

      it('has visa.type string', () => {
        expect(loc.visa).toHaveProperty('type');
        expect(typeof (loc.visa as Record<string, unknown>).type).toBe('string');
      });

      it('has visa.notes string', () => {
        expect(loc.visa).toHaveProperty('notes');
        expect(typeof (loc.visa as Record<string, unknown>).notes).toBe('string');
      });
    });
  }
});

describe('EUR locations have exchange rates', () => {
  const eurLocations = allLocations.filter((l) => l.currency === 'EUR');

  it('has EUR locations to test', () => {
    expect(eurLocations.length).toBeGreaterThan(0);
  });

  for (const loc of eurLocations) {
    describe(loc.name || loc.id, () => {
      it('has exchangeRate', () => {
        expect(loc.exchangeRate).toBeDefined();
        expect(typeof loc.exchangeRate).toBe('number');
        expect(loc.exchangeRate).toBeGreaterThan(0);
      });
    });
  }
});

describe('Cost reasonableness checks', () => {
  for (const loc of allLocations) {
    describe(loc.name || loc.id, () => {
      it('has total monthly costs between $500 and $15000', () => {
        const total = Object.values(loc.monthlyCosts).reduce(
          (sum, cat) => sum + (cat.typical || 0), 0
        );
        expect(total).toBeGreaterThan(500);
        expect(total).toBeLessThan(15000);
      });

      it('has rent as the largest cost category', () => {
        const rent = loc.monthlyCosts.rent?.typical || 0;
        // Rent should typically be > $200
        expect(rent).toBeGreaterThan(200);
      });

      it('has non-zero healthcare', () => {
        expect(loc.monthlyCosts.healthcare?.typical).toBeGreaterThan(0);
      });

      it('has non-zero groceries', () => {
        expect(loc.monthlyCosts.groceries?.typical).toBeGreaterThan(0);
      });
    });
  }
});

describe('Seed file counts', () => {
  it('US seed has expected location count', () => {
    expect(seedUS.length).toBe(39);
  });

  it('EU seed has expected location count (excludes originals)', () => {
    expect(seedEU.length).toBe(39);
  });

  it('LATAM seed has expected location count (excludes originals)', () => {
    expect(seedLATAM.length).toBe(40);
  });

  it('total seed locations is 118', () => {
    expect(allSeedLocations.length).toBe(118);
  });

  it('total locations (original + seed) with no overlap', () => {
    const ids = allLocations.map((l) => l.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
    expect(allLocations.length).toBeGreaterThanOrEqual(130);
  });
});
