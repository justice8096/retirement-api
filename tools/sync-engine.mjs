#!/usr/bin/env node
/**
 * sync-engine.mjs — regenerate the server-side copy of the Monte Carlo
 * retirement engine from its canonical home in the dashboard repo.
 *
 * The engine is AUTHORED in retirement-dashboard-angular/src/app/lib/. The
 * API needs a server-side copy to back POST /api/simulate. Rather than
 * hand-maintain a second copy (which would silently drift — the exact bug
 * class we keep fixing), this script copies the canonical files verbatim,
 * rewrites their import specifiers for the flat `src/lib/engine/` layout,
 * and stamps a GENERATED header so nobody hand-edits the copy.
 *
 * Run:  npm run engine:sync
 * The dashboard repo must be a sibling of this repo (../retirement-dashboard-angular).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, '..');
const DASH_ROOT = resolve(API_ROOT, '..', 'retirement-dashboard-angular');
const OUT_DIR = join(API_ROOT, 'src', 'lib', 'engine');

const SRC_LIB = join(DASH_ROOT, 'src', 'app', 'lib');
const SRC_DATA = join(DASH_ROOT, 'src', 'app', 'data');

// Files to copy: [absolute source path, output filename].
const FILES = [
  [join(SRC_LIB, 'monte-carlo.ts'), 'monte-carlo.ts'],
  [join(SRC_LIB, 'rental-income.ts'), 'rental-income.ts'],
  [join(SRC_LIB, 'tax-sources.ts'), 'tax-sources.ts'],
  [join(SRC_LIB, 'aca-constants.ts'), 'aca-constants.ts'],
  [join(SRC_DATA, 'historical-returns.ts'), 'historical-returns.ts'],
];

// Import-specifier rewrites for the flat engine/ layout. The API compiles
// with moduleResolution: nodenext, so emitted relative imports need explicit
// `.js` extensions (the dashboard uses `bundler` resolution and omits them).
const REWRITES = [
  [/(['"])\.\.\/data\/historical-returns\1/g, "'./historical-returns.js'"],
  [/(['"])\.\/rental-income\1/g, "'./rental-income.js'"],
  [/(['"])\.\/tax-sources\1/g, "'./tax-sources.js'"],
  [/(['"])\.\/aca-constants\1/g, "'./aca-constants.js'"],
  [/(['"])@models\/api\.model\1/g, "'./types.js'"],
];

// `@ts-nocheck`: these are GENERATED copies, already type-checked + unit-tested
// at their canonical home in the dashboard repo. The API's tsconfig is stricter
// (noUncheckedIndexedAccess etc.); re-checking generated code there is noise.
// tsc still emits identical runtime JS regardless.
const HEADER = (src) =>
  `// ╔══════════════════════════════════════════════════════════════════╗
// ║  GENERATED FILE — DO NOT EDIT.                                      ║
// ║  Source of truth: retirement-dashboard-angular/${src}
// ║  Regenerate:      npm run engine:sync                               ║
// ╚══════════════════════════════════════════════════════════════════╝
// @ts-nocheck
`;

// Minimal local type shims — the engine only imports these two as types.
const TYPES_TS = `${HEADER('src/app/models/{shared,tax}.model.ts (Source, TaxBracket)')}
/** Citation source attached to a constant (title + URL + accessed date). */
export interface Source {
  title: string;
  url: string;
  accessed?: string;
}

/** One progressive tax bracket: tax \`rate\` on income in (min, max]. */
export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}
`;

function main() {
  if (!existsSync(DASH_ROOT)) {
    console.error(`[sync-engine] dashboard repo not found at ${DASH_ROOT}`);
    console.error('[sync-engine] clone retirement-dashboard-angular as a sibling and retry.');
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [srcPath, outName] of FILES) {
    if (!existsSync(srcPath)) {
      console.error(`[sync-engine] missing source: ${srcPath}`);
      process.exit(1);
    }
    let code = readFileSync(srcPath, 'utf8');
    for (const [re, repl] of REWRITES) code = code.replace(re, repl);
    const relSrc = srcPath.slice(DASH_ROOT.length + 1).replace(/\\/g, '/');
    writeFileSync(join(OUT_DIR, outName), HEADER(relSrc) + '\n' + code);
    console.log(`[sync-engine] wrote ${outName}`);
  }
  writeFileSync(join(OUT_DIR, 'types.ts'), TYPES_TS);
  console.log('[sync-engine] wrote types.ts');
  console.log('[sync-engine] done.');
}

main();
