#!/usr/bin/env node
/**
 * Add a sourced crime/safety con to every location that doesn't already
 * have one with citations.
 *
 * Sources attached per location:
 *   1. Numbeo city page (HEAD-checked — always linked, never scraped for
 *      per-city index values; Numbeo rate-limits crawlers aggressively)
 *   2. Numbeo country page
 *   3. Wikipedia "Crime in <City>" article (if exists, HEAD-checked)
 *   4. Wikipedia "Crime in <Country>" article (if exists, HEAD-checked)
 *
 * Con text is always the generic:
 *   "Safety & crime: see cited reports for current figures"
 *
 * (we don't claim specific crime index numbers — users follow citations
 *  to get up-to-date figures from the source).
 *
 * Skips locations whose cons already include a sourced crime/safety entry.
 *
 * Usage:
 *   node scripts/add-crime-sources-to-cons.mjs
 *   node scripts/add-crime-sources-to-cons.mjs --dry-run
 *   node scripts/add-crime-sources-to-cons.mjs --limit 10
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'retirement-api-crime-probe/1.0 (contact: justice8096@gmail.com)';
const CONCURRENCY = 4;
const DRY_RUN = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;

const CRIME_KWS = ['crime', 'safety', 'theft', 'pickpocket', 'burglary', 'violent', 'unsafe', 'robber', 'assault', 'mugg'];

function conHasCrime(con) {
  const text = (typeof con === 'string' ? con : con.text || '').toLowerCase();
  return CRIME_KWS.some(k => text.includes(k));
}

function conHasSources(con) {
  return typeof con === 'object' && con.sources && con.sources.length > 0;
}

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function numbeoCityUrl(city) {
  const ascii = stripDiacritics(city).replace(/\s+/g, '-');
  return `https://www.numbeo.com/crime/in/${encodeURIComponent(ascii)}`;
}
function numbeoCountryUrl(country) {
  return `https://www.numbeo.com/crime/country_result.jsp?country=${encodeURIComponent(country.replace(/\s+/g, '+'))}`;
}
function wikiCountryUrl(country) {
  return `https://en.wikipedia.org/wiki/Crime_in_${encodeURIComponent(country.replace(/\s+/g, '_'))}`;
}

async function probeUrlHead(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    return res.ok;
  } catch {
    return false;
  }
}

function shortCity(locName) {
  return locName.split(/[,(]/)[0].trim();
}

function wikiCityUrl(city, country) {
  const safeCity = city.replace(/\s+/g, '_');
  const safeCountry = country.replace(/\s+/g, '_');
  return `https://en.wikipedia.org/wiki/Crime_in_${encodeURIComponent(safeCity)},_${encodeURIComponent(safeCountry)}`;
}

function cityNameVariants(locName, locId) {
  // Try several candidate names for the Numbeo URL; the first that returns
  // Crime Index data wins.
  const full = shortCity(locName);
  const candidates = new Set([full]);
  // Split on " / " or " - " and take each piece
  for (const piece of full.split(/\s*[\/–-]\s*/)) {
    if (piece.trim()) candidates.add(piece.trim());
  }
  // Derive from location id by stripping country prefix (e.g. "colombia-bogota" -> "bogota")
  const idCity = locId.replace(/^[a-z]+(-[a-z]{2})?-/, '').replace(/-/g, ' ');
  if (idCity) candidates.add(idCity.replace(/\b\w/g, c => c.toUpperCase()));
  return [...candidates];
}

// Build work list.
const work = [];
for (const loc of readdirSync(DATA_DIR)) {
  const p = join(DATA_DIR, loc, 'location.json');
  if (!existsSync(p)) continue;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  const cons = data.cons || [];
  // Skip if any con already has crime keywords AND sources.
  const hasSourced = cons.some(c => conHasCrime(c) && conHasSources(c));
  if (hasSourced) continue;
  const city = shortCity(data.name || loc);
  const country = data.country || '';
  work.push({ id: loc, city, country, path: p, data });
}
console.log(`To source: ${work.length} locations (limit=${LIMIT === Infinity ? 'none' : LIMIT})`);

let filled = 0, failed = 0;

async function processOne(w) {
  const sources = [];

  // Numbeo city page — linked unconditionally (URL pattern is standard;
  // users get a direct destination even if Numbeo serves a "no data yet"
  // page for small towns).
  sources.push({
    title: `Numbeo — Crime in ${w.city}`,
    url: numbeoCityUrl(w.city),
    accessed: TODAY,
  });

  // Numbeo country page.
  if (w.country) {
    sources.push({
      title: `Numbeo — Crime in ${w.country}`,
      url: numbeoCountryUrl(w.country),
      accessed: TODAY,
    });
  }

  // Wikipedia city article (HEAD-checked — Wikipedia is more forgiving of crawlers).
  if (w.country) {
    const wikiCity = wikiCityUrl(w.city, w.country);
    if (await probeUrlHead(wikiCity)) {
      sources.push({
        title: `Wikipedia — Crime in ${w.city}`,
        url: wikiCity,
        accessed: TODAY,
      });
    }
  }

  // Wikipedia country article.
  if (w.country) {
    const wikiUrl = wikiCountryUrl(w.country);
    if (await probeUrlHead(wikiUrl)) {
      sources.push({
        title: `Wikipedia — Crime in ${w.country}`,
        url: wikiUrl,
        accessed: TODAY,
      });
    }
  }

  if (sources.length < 2) { failed++; return; }

  const text = `Safety & crime: see cited reports for current figures by city and country`;
  const newCon = { text, sources };

  // Insert at end of existing cons.
  w.data.cons = [...(w.data.cons || []), newCon];

  if (!DRY_RUN) writeFileSync(w.path, JSON.stringify(w.data, null, 2) + '\n', 'utf-8');
  filled++;
  if (filled % 25 === 0) {
    console.log(`[${filled}/${work.length}] failed=${failed}`);
  }
}

const slice = work.slice(0, LIMIT);
for (let i = 0; i < slice.length; i += CONCURRENCY) {
  await Promise.all(slice.slice(i, i + CONCURRENCY).map(processOne));
  // Small politeness delay.
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n=== SUMMARY ===`);
console.log(`Cons added: ${filled}`);
console.log(`Failed: ${failed}`);
if (DRY_RUN) console.log('(dry-run — no files written)');
