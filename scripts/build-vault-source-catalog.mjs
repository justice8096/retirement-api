#!/usr/bin/env node
/**
 * Scan Obsidian vault (D:/SecondBrainData/Retirement) for research notes
 * whose YAML frontmatter declares `locations: [...]`, and extract:
 *   - note title (from # heading or filename)
 *   - primary external URLs (from Markdown footnote refs, oldest first)
 *   - topic keywords (from tags + filename)
 *   - mapped dashboard location IDs
 *
 * Writes the result to audits/vault-source-catalog.json. Also prints a
 * per-location summary.
 *
 * Usage: node scripts/build-vault-source-catalog.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';

const VAULT_ROOT = 'D:/SecondBrainData/Retirement';
const OUT_DIR = 'audits';
const OUT_FILE = join(OUT_DIR, 'vault-source-catalog.json');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (entry.startsWith('.')) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

function parseFrontmatter(txt) {
  if (txt.charCodeAt(0) === 0xFEFF) txt = txt.slice(1);
  if (!txt.startsWith('---')) return {};
  const end = txt.indexOf('\n---', 3);
  if (end < 0) return {};
  const fm = txt.slice(4, end);
  const out = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (v.startsWith('[') && v.endsWith(']')) {
      out[k] = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      out[k] = v.trim().replace(/^"|"$/g, '');
    }
  }
  return out;
}

function extractTitle(txt, fallback) {
  const m = txt.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function extractFootnoteUrls(txt) {
  const urls = [];
  const re = /\[\^[^\]]+\]:\s*(https?:\/\/\S+)/g;
  for (const m of txt.matchAll(re)) {
    const u = m[1].replace(/[.,;)\]]+$/, '');
    if (!urls.includes(u)) urls.push(u);
  }
  return urls;
}

function inferTopics(filename, tags, title) {
  const ttl = (title || '').toLowerCase();
  const topics = new Set();

  const tagMap = {
    'cost-of-living': 'cost',
    food: 'cost',
    housing: 'housing',
    taxes: 'taxes',
    visa: 'visa',
    weather: 'climate',
    climate: 'climate',
    health: 'health',
    healthcare: 'health',
    crime: 'crime',
    safety: 'crime',
  };
  for (const t of tags) {
    const lc = t.toLowerCase();
    if (tagMap[lc]) topics.add(tagMap[lc]);
  }

  // Titles in this vault are the full question prompt — too noisy for
  // substring matching. Only add crime as a title-based override since the
  // vault's crime notes are tagged `housing` (not `crime`), and the title
  // explicitly says "Crime Statistics".
  if (/^give\s+crime\s+statistics/.test(ttl) || /\bhate\s+crimes?\b/.test(ttl)) topics.add('crime');

  return [...topics];
}

const files = walk(VAULT_ROOT);
const catalog = [];

for (const f of files) {
  const txt = readFileSync(f, 'utf-8');
  const fm = parseFrontmatter(txt);
  const locs = Array.isArray(fm.locations) ? fm.locations.filter(l => l && l.includes('-')) : [];
  if (!locs.length) continue;
  const title = extractTitle(txt, basename(f, '.md'));
  const urls = extractFootnoteUrls(txt);
  const tags = Array.isArray(fm.tags) ? fm.tags : [];
  const topics = inferTopics(basename(f), tags, title);
  catalog.push({
    path: relative(VAULT_ROOT, f).replace(/\\/g, '/'),
    title: title.slice(0, 140),
    locations: locs,
    topics,
    sourceUrls: urls.slice(0, 5),
    sourceCount: urls.length,
  });
}

const byLoc = {};
for (const c of catalog) {
  for (const l of c.locations) {
    (byLoc[l] ||= []).push({ title: c.title, topics: c.topics, sourceCount: c.sourceCount, path: c.path });
  }
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify({ catalog, byLocation: byLoc }, null, 2), 'utf-8');

console.log(`Vault notes indexed: ${catalog.length}`);
console.log(`Locations with vault sources: ${Object.keys(byLoc).length}`);
console.log(`\nPer-location summary:`);
for (const [loc, notes] of Object.entries(byLoc).sort()) {
  const topicSet = new Set(notes.flatMap(n => n.topics));
  console.log(`  ${loc}: ${notes.length} notes, topics=[${[...topicSet].join(', ')}]`);
}
console.log(`\nWritten: ${OUT_FILE}`);
