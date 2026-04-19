#!/usr/bin/env node
// WCAG 2.1 AA remediation pass for compliance/ + tools/ HTML surfaces.
//
// Covers:
//   - 1.4.3 Contrast — replace four low-contrast colors documented in
//     audits/WCAG-AA-API-Audit-2026-04-10.md with the audit's recommended
//     high-contrast replacements.
//   - 2.4.1 Skip navigation — insert a visually-hidden "Skip to content"
//     link as the first child of <body> if missing, plus the matching CSS.
//   - 3.1.1 Language — ensure <html> carries `lang="en"` (most already do).
//
// Safe to re-run — every edit is idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:'));

const PATTERNS = [
  'compliance/docs/*.html',
  'compliance/tools/interactive/*.html',
  'compliance/regulations/*.html',
  'tools/dashboard.html',
];

// Color substitutions per audits/WCAG-AA-API-Audit-2026-04-10.md table.
const COLOR_SUBS = [
  [/#8A9BAD\b/gi, '#D8DCE4'], // paragraph text
  [/#6B7B8D\b/gi, '#9FC8FF'], // nav / footer links
  [/#3A4A5A\b/gi, '#8A9BAD'], // footer text
  [/#8B9DC3\b/gi, '#C9D6E8'], // dashboard labels
];

// Skip-nav affordance. Renders a focusable link that becomes visible when
// keyboard users tab into the page.
const SKIP_NAV_CSS = `
/* WCAG 2.4.1 — skip-to-content (added by tools/wcag-fix-html.mjs). */
.skip-nav {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.skip-nav:focus {
  left: 16px;
  top: 16px;
  width: auto;
  height: auto;
  padding: 8px 12px;
  background: #0B1426;
  color: #E8ECF4;
  border: 2px solid #4DBFBF;
  z-index: 10000;
  text-decoration: underline;
}
`;
const SKIP_NAV_LINK = `<a class="skip-nav" href="#main">Skip to content</a>\n`;

async function collectFiles() {
  const out = [];
  for (const pattern of PATTERNS) {
    const full = resolve(ROOT, pattern);
    try {
      // glob from node:fs/promises supports star-expansion and returns paths.
      for await (const p of glob(full)) {
        out.push(p);
      }
    } catch {
      // Pattern may match a single file path directly (e.g. tools/dashboard.html).
      try {
        const stat = await import('node:fs/promises').then(m => m.stat(full));
        if (stat.isFile()) out.push(full);
      } catch { /* missing */ }
    }
  }
  return out;
}

let filesChanged = 0;
let totalSubs = 0;
const files = await collectFiles();

for (const path of files) {
  let src;
  try { src = readFileSync(path, 'utf8'); } catch { continue; }
  const before = src;

  // Color fixes
  for (const [re, rep] of COLOR_SUBS) {
    const matches = src.match(re);
    if (matches) {
      totalSubs += matches.length;
      src = src.replace(re, rep);
    }
  }

  // Skip-nav CSS — append to first <style> block if not already present.
  if (!src.includes('.skip-nav')) {
    src = src.replace(/<\/style>/, SKIP_NAV_CSS + '\n</style>');
  }

  // Skip-nav link as first element after <body …>. Only insert if missing.
  if (!src.includes('class="skip-nav"')) {
    src = src.replace(/<body([^>]*)>/, (_, attrs) => `<body${attrs}>\n${SKIP_NAV_LINK}`);
  }

  // Ensure lang="en" on <html>
  src = src.replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html$1 lang="en">');

  if (src !== before) {
    writeFileSync(path, src, 'utf8');
    filesChanged++;
    console.log(`  ${path.replace(ROOT, '').replace(/^\//, '')}`);
  }
}

console.log(`\nWCAG pass: ${filesChanged} file(s) updated, ${totalSubs} color fix(es).`);
