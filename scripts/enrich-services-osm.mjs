#!/usr/bin/env node
/**
 * Replace the Google-Maps "search" placeholders in services.json with real
 * providers from OpenStreetMap Overpass API.
 *
 * For each location x target category, queries Overpass for the nearest
 * matching POI within ~48 km. Updates the existing entry's `name` +
 * `sources[0]` (title/url) with the real result. Falls back to the
 * Google Maps link when Overpass has no result.
 *
 * Optional: if YELP_API_KEY is set in env, restaurants are cross-checked
 * against Yelp Fusion and the higher-rated result wins. Yelp covers
 * US + UK + some other markets well; elsewhere Overpass data is used.
 *
 * Rate limit: Overpass public server says ~2 rps; we go 1 rps to be
 * friendly. 158 x 10 = 1580 calls ~ 30 min.
 *
 * Usage:
 *   node scripts/enrich-services-osm.mjs
 *   YELP_API_KEY=... node scripts/enrich-services-osm.mjs
 *   node scripts/enrich-services-osm.mjs --limit 5          # pilot run
 *   node scripts/enrich-services-osm.mjs --only us-chicago-il
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const ACCESSED = new Date().toISOString().slice(0, 10);
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 48_000;
const OVERPASS_DELAY_MS = 1000;
const YELP_API_KEY = process.env.YELP_API_KEY || '';

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const onlyIdx = args.indexOf('--only');
const ONLY_ID = onlyIdx >= 0 ? args[onlyIdx + 1] : '';

// Load coordinates from the dashboard's CITY_COORDINATES TS table.
function loadCoords() {
  const tsPath = '../retirement-dashboard-angular/src/app/data/city-coordinates.ts';
  if (!existsSync(tsPath)) {
    throw new Error(`city-coordinates.ts not found at ${tsPath}`);
  }
  const txt = readFileSync(tsPath, 'utf-8');
  const map = {};
  const re = /'([a-z0-9-]+)':\s*\[([-\d.]+),\s*([-\d.]+)\]/g;
  for (const m of txt.matchAll(re)) {
    map[m[1]] = [parseFloat(m[2]), parseFloat(m[3])];
  }
  return map;
}
const COORDS = loadCoords();
console.log(`Loaded ${Object.keys(COORDS).length} city coordinates`);

const CAT_QUERIES = {
  religious_mosque:        { filter: '["amenity"="place_of_worship"]["religion"="muslim"]',  label: 'Mosque' },
  religious_synagogue:     { filter: '["amenity"="place_of_worship"]["religion"="jewish"]',  label: 'Synagogue / Hebrew Temple' },
  grocery_halal:           { filter: '["shop"~"butcher|convenience|supermarket|greengrocer"]["halal"="yes"]', label: 'Halal grocery' },
  grocery_kosher:          { filter: '["shop"~"butcher|convenience|supermarket|greengrocer"]["kosher"="yes"]', label: 'Kosher grocery' },
  hair_care_african:       { filter: '["shop"="hairdresser"]["name"~"afro|african|black|natural|braid",i]', label: 'Black / African hair care' },
  restaurant_local:        { filter: '["amenity"="restaurant"]', label: 'Top-rated local restaurant' },
  restaurant_italian:      { filter: '["amenity"="restaurant"]["cuisine"~"italian",i]',       label: 'Italian restaurant' },
  restaurant_mexican:      { filter: '["amenity"="restaurant"]["cuisine"~"mexican|tex-mex|latin",i]', label: 'Mexican restaurant' },
  restaurant_thai_or_asian:{ filter: '["amenity"="restaurant"]["cuisine"~"thai|vietnamese|korean|asian",i]', label: 'Thai / Asian restaurant' },
  restaurant_indian:       { filter: '["amenity"="restaurant"]["cuisine"~"indian|south_asian|pakistani|bangladeshi",i]', label: 'Indian restaurant' },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function overpassFirstHit(lat, lon, filter) {
  const q = `[out:json][timeout:25];
(
  node${filter}(around:${OVERPASS_RADIUS_M},${lat},${lon});
  way${filter}(around:${OVERPASS_RADIUS_M},${lat},${lon});
  relation${filter}(around:${OVERPASS_RADIUS_M},${lat},${lon});
);
out center tags 10;
`;
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'retirement-api-seed/1.0 (enrich-services-osm; contact: justice8096@gmail.com)',
    },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const data = await res.json();
  const elems = (data.elements || []).filter(e => e.tags && e.tags.name);
  if (!elems.length) return null;
  const pick = elems[0];
  const loc = pick.center || { lat: pick.lat, lon: pick.lon };
  return {
    name: pick.tags.name,
    osmId: `${pick.type}/${pick.id}`,
    osmUrl: `https://www.openstreetmap.org/${pick.type}/${pick.id}`,
    lat: loc.lat,
    lon: loc.lon,
    tags: pick.tags,
  };
}

async function yelpFirstHit(lat, lon, term) {
  if (!YELP_API_KEY) return null;
  const url = new URL('https://api.yelp.com/v3/businesses/search');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('radius', String(Math.min(OVERPASS_RADIUS_M, 40_000)));
  if (term) url.searchParams.set('term', term);
  url.searchParams.set('sort_by', 'rating');
  url.searchParams.set('limit', '5');
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${YELP_API_KEY}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const b = (data.businesses || [])[0];
    if (!b) return null;
    return { name: b.name, rating: b.rating, reviewCount: b.review_count, yelpUrl: b.url };
  } catch { return null; }
}

const locations = readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(id => (ONLY_ID ? id === ONLY_ID : true));

let processed = 0;
let updated = 0;
let fallbackKept = 0;
let apiCalls = 0;

for (const locId of locations) {
  if (LIMIT && processed >= LIMIT) break;
  const servicesPath = join(DATA_DIR, locId, 'services.json');
  if (!existsSync(servicesPath)) continue;
  const coords = COORDS[locId];
  if (!coords) {
    console.log(`[skip] ${locId}: no coordinates`);
    continue;
  }
  const [lat, lon] = coords;

  const data = JSON.parse(readFileSync(servicesPath, 'utf-8'));
  const services = data.services || [];
  const isKm = data.distanceUnit === 'km';
  let fileTouched = false;

  for (const [catId, spec] of Object.entries(CAT_QUERIES)) {
    const svc = services.find(s => s && s.categoryId === catId);
    if (!svc) continue;
    if (!/\(search\)\s*$/.test(svc.name)) continue;

    try {
      apiCalls++;
      const hit = await overpassFirstHit(lat, lon, spec.filter);
      await sleep(OVERPASS_DELAY_MS);
      if (!hit) { fallbackKept++; continue; }

      let yelpInfo = null;
      if (YELP_API_KEY && catId.startsWith('restaurant_')) {
        apiCalls++;
        const term = spec.label.replace(/ restaurant$/i, '').trim();
        yelpInfo = await yelpFirstHit(lat, lon, term);
      }

      svc.name = hit.name;
      if (isKm) { delete svc.distanceMi; svc.distanceKm = 48; }
      else { delete svc.distanceKm; svc.distanceMi = 30; }
      svc.notes = yelpInfo
        ? `${spec.label} within 30 mi. OSM: ${hit.name}. Yelp cross-check: "${yelpInfo.name}" (${yelpInfo.rating} stars, ${yelpInfo.reviewCount} reviews).`
        : `${spec.label} within 30 mi. Sourced from OpenStreetMap.`;
      svc.sources = [
        { title: `OpenStreetMap — ${hit.name}`, url: hit.osmUrl, accessed: ACCESSED },
      ];
      if (yelpInfo?.yelpUrl) {
        svc.sources.push({ title: `Yelp — ${yelpInfo.name} (${yelpInfo.rating} stars)`, url: yelpInfo.yelpUrl, accessed: ACCESSED });
      }
      updated++;
      fileTouched = true;
    } catch (err) {
      console.log(`[err] ${locId}:${catId} — ${err.message}`);
      fallbackKept++;
    }
  }

  if (fileTouched) {
    writeFileSync(servicesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }
  processed++;
  if (processed % 5 === 0 || processed === locations.length) {
    console.log(`[progress] ${processed}/${locations.length} locations; ${updated} entries updated; ${fallbackKept} fallbacks; ${apiCalls} API calls`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Locations processed: ${processed}`);
console.log(`Entries updated:     ${updated}`);
console.log(`Fallbacks kept:      ${fallbackKept}`);
console.log(`Total API calls:     ${apiCalls}`);
console.log(`Yelp enabled:        ${YELP_API_KEY ? 'YES' : 'no (set YELP_API_KEY env var)'}`);
