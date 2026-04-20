#!/usr/bin/env node
// Audit data completeness across every `data/locations/<id>/*.json` bundle.
// Produces two outputs:
//   1. Console summary (counts per field).
//   2. Markdown report at `audits/location-data-gaps-<date>.md`
//      with a per-location × per-field matrix so gap-fillers can tackle
//      the biggest missing surfaces first.
//
// Covers the fields surfaced by these acceptance-test follow-ups:
//   FU-015  neighborhoods missing / empty
//   FU-016  services only Healthcare / Connectivity populated
//   FU-017  livability-index tabs empty
//   FU-018  local-info resources/links partial, climate never populated
//   FU-001  region name normalization (reports distinct region strings)
//
// Read-only; never modifies the source JSONs.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');
const AUDITS_DIR = join(ROOT, 'audits');
const today = new Date().toISOString().slice(0, 10);
const REPORT_PATH = join(AUDITS_DIR, `location-data-gaps-${today}.md`);

/** Service categories the UI expects — mirrors what Community > Local Services
 *  renders. If a category has zero entries, it renders blank for the user. */
const SERVICE_CATEGORIES = [
  'hospital', 'pharmacy', 'grocery', 'bank',
  'hardware', 'vet', 'gym', 'shopping', 'transit',
];

const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

const ids = readdirSync(LOC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name)
  .sort();

/** Per-location row describing which fields are present / populated. */
const rows = [];
/** Global counts for the summary table. */
const present = {
  'location.climate': 0,
  'location.region': 0,
  'neighborhoods.file': 0,
  'neighborhoods.entries': 0,
  'services.file': 0,
  'services.entries': 0,
  'inclusion.file': 0,
  'inclusion.entries': 0,
  'local-info.file': 0,
  'local-info.climate': 0,
  'local-info.resources': 0,
  'local-info.links': 0,
  'local-info.webcams': 0,
  'local-info.officialSites': 0,
};

/** Distinct region strings → [locationId]. */
const regionIndex = new Map();

for (const id of ids) {
  const row = { id, missing: [] };
  const base = readJson(join(LOC_DIR, id, 'location.json'));
  if (!base) {
    row.name = '(location.json missing!)';
    row.missing.push('location.json');
    rows.push(row);
    continue;
  }
  row.name = base.name || id;
  row.region = base.region || '(missing)';
  if (base.region) {
    present['location.region']++;
    const list = regionIndex.get(base.region) ?? [];
    list.push(id);
    regionIndex.set(base.region, list);
  } else row.missing.push('location.region');
  if (base.climate) present['location.climate']++;
  else row.missing.push('location.climate');

  // neighborhoods.json
  const neigh = readJson(join(LOC_DIR, id, 'neighborhoods.json'));
  if (neigh) {
    present['neighborhoods.file']++;
    const entries = Array.isArray(neigh.neighborhoods) ? neigh.neighborhoods.length : 0;
    row.neighborhoods = entries;
    if (entries > 0) present['neighborhoods.entries']++;
    else row.missing.push('neighborhoods.empty');
  } else {
    row.neighborhoods = 0;
    row.missing.push('neighborhoods.file');
  }

  // services.json
  const services = readJson(join(LOC_DIR, id, 'services.json'));
  if (services) {
    present['services.file']++;
    const entries = Array.isArray(services.services) ? services.services : [];
    const populatedCats = new Set(entries.map(e => e.categoryId));
    row.servicesCount = entries.length;
    row.servicesCats = SERVICE_CATEGORIES.filter(c => populatedCats.has(c)).join(',');
    row.servicesMissingCats = SERVICE_CATEGORIES.filter(c => !populatedCats.has(c));
    if (entries.length > 0) present['services.entries']++;
    else row.missing.push('services.empty');
  } else {
    row.servicesCount = 0;
    row.servicesMissingCats = [...SERVICE_CATEGORIES];
    row.missing.push('services.file');
  }

  // inclusion.json (livability-index tabs)
  const incl = readJson(join(LOC_DIR, id, 'inclusion.json'));
  if (incl) {
    present['inclusion.file']++;
    const keys = Object.keys(incl).filter(k => k !== 'id');
    row.inclusionKeys = keys.length;
    if (keys.length > 0) present['inclusion.entries']++;
    else row.missing.push('inclusion.empty');
  } else {
    row.inclusionKeys = 0;
    row.missing.push('inclusion.file');
  }

  // local-info.json
  const info = readJson(join(LOC_DIR, id, 'local-info.json'));
  if (info) {
    present['local-info.file']++;
    if (info.climate) present['local-info.climate']++;
    else row.missing.push('local-info.climate');
    if (Array.isArray(info.resources) && info.resources.length) present['local-info.resources']++;
    else row.missing.push('local-info.resources');
    if ((Array.isArray(info.links) && info.links.length) ||
        (Array.isArray(info.bloggers) && info.bloggers.length)) present['local-info.links']++;
    else row.missing.push('local-info.links');
    if (Array.isArray(info.webcams) && info.webcams.length) present['local-info.webcams']++;
    if (Array.isArray(info.officialSites) && info.officialSites.length) present['local-info.officialSites']++;
  } else {
    row.missing.push('local-info.file');
  }

  rows.push(row);
}

// ─── Console summary ─────────────────────────────────────────────────────────
const total = ids.length;
const fmtCount = (n) => `${n} / ${total} (${Math.round((n / total) * 100)}%)`;
console.log(`\nLocation Data Completeness — ${today}`);
console.log(`Total locations: ${total}\n`);
for (const [k, v] of Object.entries(present)) {
  console.log(`  ${k.padEnd(30)} ${fmtCount(v)}`);
}
console.log(`\nDistinct region strings: ${regionIndex.size}`);

// ─── Markdown report ─────────────────────────────────────────────────────────
if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true });

const lines = [];
lines.push(`# Location Data Completeness — ${today}`);
lines.push('');
lines.push(`Generated by \`tools/audit-location-data-completeness.mjs\`. Read-only audit.`);
lines.push('');
lines.push(`**Total locations:** ${total}`);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push('| Field | Populated |');
lines.push('|---|---|');
for (const [k, v] of Object.entries(present)) {
  lines.push(`| \`${k}\` | ${fmtCount(v)} |`);
}

lines.push('');
lines.push('## Region taxonomy (FU-001)');
lines.push('');
lines.push(`Distinct \`region\` values across all locations: **${regionIndex.size}**. A coherent taxonomy should split macro-region (continent / area) from subregion (state/province). Current strings mix both (e.g. "Southern Europe", "Virginia", "US Southeast", "Occitanie").`);
lines.push('');
lines.push('| Region | Count | Examples |');
lines.push('|---|---:|---|');
const sortedRegions = [...regionIndex.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [region, locs] of sortedRegions) {
  const sample = locs.slice(0, 3).join(', ') + (locs.length > 3 ? `, +${locs.length - 3} more` : '');
  lines.push(`| ${region} | ${locs.length} | ${sample} |`);
}

lines.push('');
lines.push('## Missing neighborhoods (FU-015)');
lines.push('');
const noNeigh = rows.filter(r => r.neighborhoods === 0);
lines.push(`**${noNeigh.length}** locations have zero neighborhood entries.`);
lines.push('');
lines.push('<details><summary>List</summary>');
lines.push('');
for (const r of noNeigh) lines.push(`- \`${r.id}\` — ${r.name}`);
lines.push('');
lines.push('</details>');

lines.push('');
lines.push('## Service categories (FU-016)');
lines.push('');
lines.push(`Expected categories per location: \`${SERVICE_CATEGORIES.join(', ')}\`.`);
lines.push('');
lines.push('| Location | Present | Missing |');
lines.push('|---|---|---|');
for (const r of rows) {
  if (!r.servicesMissingCats || r.servicesMissingCats.length === 0) continue;
  const presentCats = r.servicesCats || '—';
  const missingCats = r.servicesMissingCats.join(', ');
  lines.push(`| \`${r.id}\` | ${presentCats} | ${missingCats} |`);
}

lines.push('');
lines.push('## Livability-index coverage (FU-017)');
lines.push('');
const noIncl = rows.filter(r => r.inclusionKeys === 0);
lines.push(`**${noIncl.length}** locations have no \`inclusion.json\` tabs populated.`);
lines.push('');
lines.push('<details><summary>List</summary>');
lines.push('');
for (const r of noIncl) lines.push(`- \`${r.id}\` — ${r.name}`);
lines.push('');
lines.push('</details>');

lines.push('');
lines.push('## Local-info coverage (FU-018)');
lines.push('');
lines.push(`\`climate\` inside \`local-info.json\`: **${present['local-info.climate']} / ${total}** — effectively never populated; UI reads climate from here but the field is consistently missing. Either populate (NOAA API at build time) or switch the UI to read from \`location.json.climate\` where it exists.`);
lines.push('');
lines.push(`\`resources\`: ${fmtCount(present['local-info.resources'])}`);
lines.push(`\`links\` / \`bloggers\`: ${fmtCount(present['local-info.links'])}`);
lines.push(`\`webcams\`: ${fmtCount(present['local-info.webcams'])}`);
lines.push(`\`officialSites\`: ${fmtCount(present['local-info.officialSites'])}`);

writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
console.log(`\nReport: ${REPORT_PATH}\n`);
