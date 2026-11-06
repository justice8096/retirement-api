#!/usr/bin/env node
/**
 * apply-cost-refresh.mjs - merge researched cost results into data/locations.
 *
 * Usage: node tools/apply-cost-refresh.mjs <resultsDir> [--date YYYY-MM-DD] [--dry-run]
 *
 * Each results file: {"locations":[{"id","currency","categories":{cat:{min,typical,max,verified,notes,sources}}}]}
 * Rules:
 *   - Only verified values are written (with their sources and lastVerified).
 *   - Unverified values never overwrite stored numbers, with one guarded exception:
 *     re-modeling an old-template insurance figure (health insurance stored as
 *     "insurance") down to a renters placeholder, and only when healthcare was
 *     verified in the same result so the health cost is not lost.
 *   - Results whose currency differs from the location's are skipped.
 *   - detailed-costs headline budgets (housing, transportation, entertainment,
 *     cellPhone) follow verified location values; index.json totals are recomputed.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const DATE = args.includes('--date') ? args[args.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10);
const DRY = args.includes('--dry-run');
if (!dir) { console.error('usage: apply-cost-refresh.mjs <resultsDir> [--date D] [--dry-run]'); process.exit(1); }

const CATS = new Set(['rent', 'groceries', 'utilities', 'healthcare', 'healthcarePreMedicare', 'insurance', 'petCare',
  'petDaycare', 'petGrooming', 'transportation', 'entertainment', 'clothing', 'personalCare', 'phoneCell', 'medicalOOP']);
const DC_MAP = { housing: 'rent', transportation: 'transportation', entertainment: 'entertainment', cellPhone: 'phoneCell' };
const rj = p => JSON.parse(readFileSync(p, 'utf8'));
const wj = (p, d) => { if (!DRY) writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); };
const total = mc => Math.round(Object.entries(mc).reduce((s, [k, v]) => k === 'healthcarePreMedicare' ? s : s + (typeof v?.typical === 'number' ? v.typical : 0), 0));
const ok = v => v && Number.isFinite(v.min) && Number.isFinite(v.typical) && Number.isFinite(v.max) && v.min <= v.typical && v.typical <= v.max;

const idxPath = join(ROOT, 'data', 'index.json');
const idx = rj(idxPath);
const report = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  let parsed;
  try { parsed = rj(join(dir, f)); } catch (e) { console.error(`skip ${f}: ${e.message}`); continue; }
  for (const r of parsed.locations || []) {
    const locPath = join(ROOT, 'data', 'locations', r.id, 'location.json');
    if (!existsSync(locPath)) { console.error(`skip ${r.id}: no location.json`); continue; }
    const loc = rj(locPath);
    if (r.currency && loc.currency && r.currency !== loc.currency) { console.error(`skip ${r.id}: currency ${r.currency} != ${loc.currency}`); continue; }
    const mc = loc.monthlyCosts;
    const before = total(mc);
    const changes = [];
    const hcVerified = !!r.categories?.healthcare?.verified && ok(r.categories.healthcare);
    for (const [cat, v] of Object.entries(r.categories || {})) {
      if (!CATS.has(cat) || !ok(v) || !mc[cat]) continue;
      const cur = mc[cat];
      const same = cur.min === v.min && cur.typical === v.typical && cur.max === v.max;
      if (v.verified) {
        const next = { ...cur, min: v.min, typical: v.typical, max: v.max, lastVerified: DATE };
        delete next.estimate;
        if (v.notes) next.notes = v.notes;
        if (Array.isArray(v.sources) && v.sources.length) next.sources = v.sources;
        mc[cat] = next;
        if (!same) changes.push(`${cat} ${cur.typical}->${v.typical}`);
      } else if (cat === 'insurance' && !same && cur.typical > 100 && v.typical < 100 && hcVerified) {
        mc[cat] = { ...cur, min: v.min, typical: v.typical, max: v.max, estimate: true, notes: v.notes || 'Renters/contents insurance placeholder (re-modeled from old template).' };
        changes.push(`insurance ${cur.typical}->${v.typical} (remodel est)`);
      }
    }
    wj(locPath, loc);
    const dcPath = join(ROOT, 'data', 'locations', r.id, 'detailed-costs.json');
    if (existsSync(dcPath)) {
      const dc = rj(dcPath);
      let touched = false;
      for (const [sec, cat] of Object.entries(DC_MAP)) {
        if (dc[sec]?.monthlyBudget && mc[cat]?.lastVerified === DATE) {
          dc[sec].monthlyBudget = { ...dc[sec].monthlyBudget, min: mc[cat].min, typical: mc[cat].typical, max: mc[cat].max };
          dc[sec].monthlyBudgetRefreshed = DATE;
          touched = true;
        }
      }
      if (touched) wj(dcPath, dc);
    }
    const after = total(mc);
    const ie = idx.locations.find(x => x.id === r.id);
    if (ie) ie.monthlyCostUSD = after;
    const verified = Object.values(mc).filter(v => v?.lastVerified === DATE).length;
    report.push({ id: r.id, before, after, verified, changes });
  }
}
idx.meta.lastUpdated = DATE;
wj(idxPath, idx);
for (const x of report) console.log(`${x.id}: ${x.before} -> ${x.after} (${x.after - x.before >= 0 ? '+' : ''}${x.after - x.before}), ${x.verified} verified | ${x.changes.join(', ')}`);