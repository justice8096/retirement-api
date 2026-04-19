#!/usr/bin/env node
// One-off migration: strip the 2025 federal tax-bracket overrides from
// location JSONs. Federal brackets are the same everywhere, so there's
// no per-location reason to carry them — deleting them lets
// `shared/taxes.js` fall through to its 2026 Rev Proc 2025-32 defaults.
//
// What this keeps: `applies`, `foreignTaxCredit` on `federalIncomeTax`
// (both are genuinely per-location — non-US places may set `applies:
// false` or `foreignTaxCredit: true`).
//
// What this removes: `brackets`, `standardDeduction` from
// `federalIncomeTax`. Run once; re-running is a no-op.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));
const LOC_DIR = join(ROOT, 'data', 'locations');

const entries = readdirSync(LOC_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => join(LOC_DIR, e.name, 'location.json'));

let stripped = 0;
let skipped = 0;

for (const path of entries) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { continue; }
  const parsed = JSON.parse(raw);
  const fit = parsed?.taxes?.federalIncomeTax;
  if (!fit || typeof fit !== 'object') { skipped++; continue; }
  const hadBrackets = Object.prototype.hasOwnProperty.call(fit, 'brackets');
  const hadStdDed = Object.prototype.hasOwnProperty.call(fit, 'standardDeduction');
  if (!hadBrackets && !hadStdDed) { skipped++; continue; }
  delete fit.brackets;
  delete fit.standardDeduction;
  // Preserve the existing formatting shape — the seed files are
  // pretty-printed with 2-space indents + trailing newline. Use
  // JSON.stringify with indent=2, then add the trailing newline.
  const serialized = JSON.stringify(parsed, null, 2) + '\n';
  writeFileSync(path, serialized, 'utf8');
  stripped++;
  console.log(`  ${path.replace(ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/')}`);
}

console.log(`\nStripped federal-bracket overrides from ${stripped} files; ${skipped} unaffected.`);
