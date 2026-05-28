#!/usr/bin/env node
/**
 * Backfill climate.humidityAvgPct, climate.drySeasonMonths, and top-level
 * coordinates for every location in data/locations/, using Open-Meteo.
 *
 * Method (reproducible):
 *   1. Geocode cities[0] + country via Open-Meteo geocoding API.
 *   2. Fetch 2014-2023 daily precip + daily-mean relative humidity (ERA5) via
 *      the Open-Meteo archive API.
 *   3. humidityAvgPct  = round(mean of daily-mean RH over the whole span).
 *      drySeasonMonths = calendar-ordered months whose 10-year precip normal
 *                        (monthly total averaged across years) is < 60 mm.
 *                        [] = no pronounced dry season (humid year-round).
 *
 * Fields are added additively (existing keys keep their order; new keys are
 * appended). Original EOL + trailing newline are preserved.
 *
 * Usage:
 *   node scripts/backfill-climate-normals.mjs --dry-run            # no writes
 *   node scripts/backfill-climate-normals.mjs --only=costa-rica    # id prefix filter
 *   node scripts/backfill-climate-normals.mjs                      # write all
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA = 'data';
const LOCS = join(DATA, 'locations');
const START_YEAR = 2014;
const END_YEAR = 2023;
const DRY_THRESHOLD_MM = 60;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Explicit coordinates for ambiguous names / territories where the geocoder
// picks the wrong country (or returns no country). City-center coords are
// stable facts and well within the ~25km ERA5 grid cell.
const OVERRIDES = {
  'malta-gozo': { lat: 36.046, lon: 14.239 },          // Victoria (Rabat), Gozo
  'panama-coronado': { lat: 8.533, lon: -79.933 },      // Playa Coronado, Panamá
  'us-ponce-pr': { lat: 18.011, lon: -66.614 },         // Ponce, Puerto Rico
  'us-st-augustine-fl': { lat: 29.901, lon: -81.313 },  // St. Augustine, FL
  'greece-corfu': { lat: 39.624, lon: 19.921 },         // Corfu Town
  'greece-rhodes': { lat: 36.434, lon: 28.217 },        // Rhodes Town
  'panama-el-valle': { lat: 8.612, lon: -80.126 },      // El Valle de Antón
  'ecuador-salinas': { lat: -2.214, lon: -80.958 },     // Salinas, Ecuador
  'us-charlotte-amalie-vi': { lat: 18.341, lon: -64.931 },
  'us-christiansted-vi': { lat: 17.747, lon: -64.703 },
  'us-dededo-gu': { lat: 13.518, lon: 144.838 },
  'us-hagatna-gu': { lat: 13.476, lon: 144.749 },
  'us-pago-pago-as': { lat: -14.279, lon: -170.700 },
  'us-tafuna-as': { lat: -14.351, lon: -170.760 },
  'us-saipan-mp': { lat: 15.178, lon: 145.751 },
  'us-tinian-mp': { lat: 14.954, lon: 145.620 },
  'us-san-juan-pr': { lat: 18.466, lon: -66.106 },
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyMissing = args.includes('--only-missing');
const onlyArg = args.find((a) => a.startsWith('--only='));
const onlyPrefix = onlyArg ? onlyArg.split('=')[1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, timeoutMs, tries = 25) {
  let lastErr;
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const j = await r.json();
      if (j && j.error) throw new Error(j.reason || 'api error');
      return j;
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || '');
      if (/Minutely/i.test(msg)) { console.log('   …minutely limit, sleeping 65s'); await sleep(65000); }
      else if (/Hourly|Daily/i.test(msg)) { console.log('   …hourly limit, sleeping 305s'); await sleep(305000); }
      else await sleep(800 * (t + 1));
    }
  }
  throw lastErr;
}

async function geocode(city, country) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`;
  const j = await fetchJson(url, 20000);
  const results = j.results || [];
  if (!results.length) return null;
  const match = results.find((r) => (r.country || '').toLowerCase() === (country || '').toLowerCase());
  const hit = match || results[0];
  return { lat: hit.latitude, lon: hit.longitude, gcCountry: hit.country, matched: !!match };
}

async function normals(lat, lon) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${START_YEAR}-01-01&end_date=${END_YEAR}-12-31` +
    `&daily=precipitation_sum,relative_humidity_2m_mean&timezone=auto`;
  const j = await fetchJson(url, 45000);
  const time = j.daily?.time || [];
  const rh = j.daily?.relative_humidity_2m_mean || [];
  const pr = j.daily?.precipitation_sum || [];

  const rhValid = rh.filter((x) => typeof x === 'number');
  const humidityAvgPct = Math.round(rhValid.reduce((s, x) => s + x, 0) / rhValid.length);

  const monthlyTotals = Array(12).fill(0);
  const yearsSeen = new Set();
  for (let i = 0; i < time.length; i++) {
    const d = new Date(time[i]);
    monthlyTotals[d.getUTCMonth()] += pr[i] || 0;
    yearsSeen.add(d.getUTCFullYear());
  }
  const numYears = yearsSeen.size || 1;
  const monthlyNormal = monthlyTotals.map((t) => t / numYears);
  const drySeasonMonths = [];
  for (let m = 0; m < 12; m++) if (monthlyNormal[m] < DRY_THRESHOLD_MM) drySeasonMonths.push(MONTHS[m]);

  return { humidityAvgPct, drySeasonMonths, monthlyNormal };
}

function writeLocation(id, mutate) {
  const path = join(LOCS, id, 'location.json');
  const raw = readFileSync(path, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const obj = JSON.parse(raw);
  mutate(obj);
  let out = JSON.stringify(obj, null, 2) + '\n';
  if (eol === '\r\n') out = out.replace(/\n/g, '\r\n');
  writeFileSync(path, out, 'utf-8');
}

async function main() {
  const index = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf-8'));
  let ids = index.locations.map((l) => l.id);
  if (onlyPrefix) ids = ids.filter((id) => id.startsWith(onlyPrefix));

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing ${ids.length} locations (${START_YEAR}-${END_YEAR}, dry<${DRY_THRESHOLD_MM}mm)\n`);

  const unresolved = [];
  const mismatched = [];
  let done = 0;

  let skipped = 0;
  for (const id of ids) {
    const path = join(LOCS, id, 'location.json');
    if (!existsSync(path)) { unresolved.push(`${id} (no location.json)`); continue; }
    const loc = JSON.parse(readFileSync(path, 'utf-8'));

    // Incremental: skip locations that already have the field, unless they
    // carry an explicit override (those may have been written with bad coords).
    if (onlyMissing && typeof loc.climate?.humidityAvgPct === 'number' && !OVERRIDES[id]) { skipped++; continue; }

    const city = (loc.cities && loc.cities[0]) || loc.name;
    const country = loc.country;

    try {
      let lat, lon;
      if (OVERRIDES[id]) {
        ({ lat, lon } = OVERRIDES[id]);
      } else {
        const geo = await geocode(city, country);
        if (!geo) { unresolved.push(`${id} (geocode: "${city}, ${country}")`); continue; }
        if (!geo.matched) { mismatched.push(`${id}: wanted ${country}, got ${geo.gcCountry} for "${city}" — SKIPPED (add override)`); continue; }
        lat = geo.lat; lon = geo.lon;
      }

      const n = await normals(lat, lon);
      const coords = { lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000 };

      if (dryRun) {
        console.log(`${id}\t(${coords.lat},${coords.lon}) ${country}\tRH=${n.humidityAvgPct}%\tdry=[${n.drySeasonMonths.join(',')}]`);
        console.log(`   monthly mm: ${n.monthlyNormal.map((x) => Math.round(x)).join(',')}`);
      } else {
        writeLocation(id, (o) => {
          o.coordinates = coords;
          o.climate = o.climate || {};
          o.climate.humidityAvgPct = n.humidityAvgPct;
          o.climate.drySeasonMonths = n.drySeasonMonths;
        });
        console.log(`  ✓ ${id}  RH=${n.humidityAvgPct}% dry=[${n.drySeasonMonths.join(',')}]`);
      }
      done++;
    } catch (e) {
      unresolved.push(`${id} (${e.message})`);
    }
    await sleep(200);
  }

  console.log(`\nDone: ${done} written, ${skipped} skipped (already had field), ${ids.length} total`);
  if (mismatched.length) {
    console.log(`\nCOUNTRY MISMATCH (verify these ${mismatched.length}):`);
    for (const m of mismatched) console.log(`  - ${m}`);
  }
  if (unresolved.length) {
    console.log(`\nUNRESOLVED (${unresolved.length}):`);
    for (const u of unresolved) console.log(`  - ${u}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
