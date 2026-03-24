#!/usr/bin/env node
/**
 * Migrate monolithic data files to per-location partitioned structure.
 *
 * Current structure (monolithic):
 *   data/locations.json          — all locations in one array
 *   data/neighborhoods.json      — all neighborhoods keyed by location ID
 *   data/services-attractions.json — all services keyed by location ID
 *   data/inclusion-assessment.json — all inclusion data keyed by location ID
 *   data/detailed-costs.json     — all detailed costs keyed by location ID
 *
 * New structure (partitioned):
 *   data/index.json              — lightweight index with summary per location
 *   data/shared/                 — shared data (service categories, methodology, etc.)
 *     service-categories.json
 *     inclusion-methodology.json
 *     social-security.json
 *   data/locations/
 *     france-brittany/
 *       location.json            — core costs, visa, climate, lifestyle, pros/cons
 *       neighborhoods.json       — neighborhoods for this location
 *       services.json            — services & attractions
 *       inclusion.json           — inclusion assessment
 *       detailed-costs.json      — medicine, vision, dental, entertainment, transportation
 *     france-lyon/
 *       ...
 *
 * Benefits:
 *   - Adding a city = creating one folder with 5 small files
 *   - Dashboard lazy-loads per-location data on demand
 *   - Index.json stays small (~2KB) regardless of location count
 *   - Git diffs are clean (only changed location folder shows up)
 *   - Agents can generate one location at a time without token limits
 *   - Scales to 100+ locations without performance impact
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(import.meta.dirname, '..', 'data');

function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJSON(path, data) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  console.error(`  wrote ${path} (${Math.round(JSON.stringify(data).length / 1024)}KB)`);
}

// Load all current data
const locationsData = readJSON(join(DATA_DIR, 'locations.json'));
const neighborhoodsData = readJSON(join(DATA_DIR, 'neighborhoods.json'));
const servicesData = readJSON(join(DATA_DIR, 'services-attractions.json'));
const inclusionData = readJSON(join(DATA_DIR, 'inclusion-assessment.json'));
const detailedCostsData = readJSON(join(DATA_DIR, 'detailed-costs.json'));

if (!locationsData) { console.error('locations.json not found'); process.exit(1); }

// ===== Create shared data =====
const sharedDir = join(DATA_DIR, 'shared');

// Service categories (shared across all locations)
if (servicesData && servicesData.serviceCategories) {
  writeJSON(join(sharedDir, 'service-categories.json'), {
    serviceCategories: servicesData.serviceCategories
  });
}

// Inclusion methodology (shared)
if (inclusionData) {
  const shared = {};
  if (inclusionData.methodology) shared.methodology = inclusionData.methodology;
  if (inclusionData.comparativeAnalysis) shared.comparativeAnalysis = inclusionData.comparativeAnalysis;
  writeJSON(join(sharedDir, 'inclusion-methodology.json'), shared);
}

// Social security data (shared, from meta)
if (locationsData.socialSecurity) {
  writeJSON(join(sharedDir, 'social-security.json'), locationsData.socialSecurity);
}

// Detailed costs meta (shared)
if (detailedCostsData && detailedCostsData.meta) {
  writeJSON(join(sharedDir, 'detailed-costs-meta.json'), detailedCostsData.meta);
}

// ===== Create index.json =====
const index = {
  meta: {
    description: 'Retirement planning location index — lightweight summary for dashboard boot',
    lastUpdated: new Date().toISOString().split('T')[0],
    totalLocations: locationsData.locations.length,
    dataVersion: 2,
    note: 'Full location data loaded on demand from data/locations/{id}/'
  },
  householdProfile: locationsData.meta ? locationsData.meta.householdProfile : undefined,
  locations: []
};

// ===== Partition each location =====
for (const loc of locationsData.locations) {
  const locDir = join(DATA_DIR, 'locations', loc.id);

  // Build index entry (lightweight summary for overview/compare)
  const totalMonthly = Object.values(loc.monthlyCosts || {}).reduce((sum, cat) => sum + (cat.typical || 0), 0);
  const rate = loc.exchangeRate || 1;
  const totalUSD = loc.currency === 'EUR' ? Math.round(totalMonthly / rate) : totalMonthly;

  index.locations.push({
    id: loc.id,
    name: loc.name,
    country: loc.country,
    region: loc.region,
    currency: loc.currency,
    exchangeRate: loc.exchangeRate,
    monthlyCostUSD: totalUSD,
    climate: {
      winterLowF: loc.climate ? loc.climate.winterLowF : null,
      summerHighF: loc.climate ? loc.climate.summerHighF : null,
      meetsWarmWinterReq: loc.climate ? loc.climate.meetsWarmWinterReq : false
    },
    scores: {
      healthcare: loc.healthcare ? loc.healthcare.qualityRating : null,
      dogFriendly: loc.lifestyle ? loc.lifestyle.dogFriendly : null,
      expatCommunity: loc.lifestyle ? loc.lifestyle.expatCommunity : null,
      safety: loc.lifestyle ? loc.lifestyle.safetyRating : null,
      internetSpeed: loc.lifestyle ? loc.lifestyle.internetSpeed : null,
      englishPrevalence: loc.lifestyle ? loc.lifestyle.englishPrevalence : null
    },
    inclusionScore: inclusionData && inclusionData.locations && inclusionData.locations[loc.id]
      ? inclusionData.locations[loc.id].overallInclusionScore : null,
    neighborhoodCount: neighborhoodsData && neighborhoodsData[loc.id]
      ? (neighborhoodsData[loc.id].neighborhoods || []).length : 0,
    hasDetailedCosts: detailedCostsData && detailedCostsData.locations && !!detailedCostsData.locations[loc.id]
  });

  // Write full location data
  writeJSON(join(locDir, 'location.json'), loc);

  // Write neighborhoods
  if (neighborhoodsData && neighborhoodsData[loc.id]) {
    writeJSON(join(locDir, 'neighborhoods.json'), neighborhoodsData[loc.id]);
  }

  // Write services & attractions
  if (servicesData && servicesData.locations && servicesData.locations[loc.id]) {
    writeJSON(join(locDir, 'services.json'), servicesData.locations[loc.id]);
  }

  // Write inclusion
  if (inclusionData && inclusionData.locations && inclusionData.locations[loc.id]) {
    writeJSON(join(locDir, 'inclusion.json'), inclusionData.locations[loc.id]);
  }

  // Write detailed costs
  if (detailedCostsData && detailedCostsData.locations && detailedCostsData.locations[loc.id]) {
    writeJSON(join(locDir, 'detailed-costs.json'), detailedCostsData.locations[loc.id]);
  }

  console.error(`Migrated: ${loc.id} -> data/locations/${loc.id}/`);
}

writeJSON(join(DATA_DIR, 'index.json'), index);

console.error(`\nMigration complete:`);
console.error(`  ${index.locations.length} locations partitioned`);
console.error(`  Index: data/index.json (${Math.round(JSON.stringify(index).length / 1024)}KB)`);
console.error(`  Shared: data/shared/ (${existsSync(sharedDir) ? 'created' : 'skipped'})`);
console.error(`  Locations: data/locations/{id}/ (5 files each)`);
console.error(`\nOld monolithic files can be removed after verifying the migration.`);
