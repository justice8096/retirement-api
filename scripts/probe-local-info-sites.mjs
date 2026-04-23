#!/usr/bin/env node
/**
 * HEAD-check every officialSites URL in every location's local-info.json
 * and annotate each entry with:
 *
 *   linkStatus:       'ok' | 'redirect' | 'client-error' | 'server-error' | 'timeout' | 'dns' | 'tls' | 'other'
 *   linkHttpStatus:   final HTTP status code (when applicable)
 *   linkCheckedAt:    ISO date
 *   linkFinalUrl:     final URL after redirects (only when it differs from the seed URL)
 *
 * Also writes audits/local-info-link-probe-<date>.md — a human-readable
 * punch-list of dead / redirected / flaky links.
 *
 * Retries HEAD -> GET when a server returns 405 (Method Not Allowed).
 * Concurrency capped to 8 simultaneous requests to stay polite.
 *
 * Usage:
 *   node scripts/probe-local-info-sites.mjs
 *   node scripts/probe-local-info-sites.mjs --dry-run
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = 'data/locations';
const AUDIT_DIR = 'audits';
const TODAY = new Date().toISOString().slice(0, 10);
const CONCURRENCY = 8;
const TIMEOUT_MS = 12_000;
const DRY_RUN = process.argv.includes('--dry-run');

async function probeUrl(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'retirement-api-link-probe/1.0' },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'retirement-api-link-probe/1.0' },
      });
    }
    clearTimeout(to);
    const finalUrl = res.url;
    const st = res.status;
    let linkStatus;
    if (st >= 200 && st < 300) linkStatus = 'ok';
    else if (st >= 300 && st < 400) linkStatus = 'redirect';
    else if (st >= 400 && st < 500) linkStatus = 'client-error';
    else if (st >= 500) linkStatus = 'server-error';
    else linkStatus = 'other';
    return { linkStatus, linkHttpStatus: st, linkFinalUrl: finalUrl };
  } catch (err) {
    clearTimeout(to);
    const name = (err && err.name) || 'Error';
    let linkStatus = 'other';
    if (name === 'AbortError') linkStatus = 'timeout';
    else if (err.cause && (err.cause.code === 'ENOTFOUND' || err.cause.code === 'EAI_AGAIN')) linkStatus = 'dns';
    else if (err.cause && String(err.cause.code || '').startsWith('ERR_TLS')) linkStatus = 'tls';
    else if (err.cause && err.cause.code === 'CERT_HAS_EXPIRED') linkStatus = 'tls';
    return { linkStatus, linkHttpStatus: null, linkFinalUrl: null, error: err.message };
  }
}

const work = [];
for (const dir of readdirSync(DATA_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const p = join(DATA_DIR, dir.name, 'local-info.json');
  if (!existsSync(p)) continue;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  const sites = Array.isArray(data.officialSites) ? data.officialSites : [];
  for (let i = 0; i < sites.length; i++) {
    work.push({ locId: dir.name, filePath: p, data, entryIndex: i });
  }
}
console.log(`Probing ${work.length} officialSites URLs across ${new Set(work.map(w => w.locId)).size} locations...`);

let completed = 0;
const byStatus = { ok: 0, redirect: 0, 'client-error': 0, 'server-error': 0, timeout: 0, dns: 0, tls: 0, other: 0 };

async function runBatch(items) {
  await Promise.all(items.map(async w => {
    const entry = w.data.officialSites[w.entryIndex];
    const url = entry.url;
    const probe = await probeUrl(url);
    entry.linkStatus = probe.linkStatus;
    entry.linkHttpStatus = probe.linkHttpStatus;
    entry.linkCheckedAt = TODAY;
    if (probe.linkFinalUrl && probe.linkFinalUrl !== url) entry.linkFinalUrl = probe.linkFinalUrl;
    else delete entry.linkFinalUrl;
    byStatus[probe.linkStatus] = (byStatus[probe.linkStatus] || 0) + 1;
    completed++;
    if (completed % 25 === 0) {
      console.log(`[${completed}/${work.length}] ok=${byStatus.ok} redir=${byStatus.redirect} 4xx=${byStatus['client-error']} 5xx=${byStatus['server-error']} timeout=${byStatus.timeout} dns=${byStatus.dns}`);
    }
  }));
}

for (let i = 0; i < work.length; i += CONCURRENCY) {
  await runBatch(work.slice(i, i + CONCURRENCY));
}

if (!DRY_RUN) {
  const touchedFiles = new Set(work.map(w => w.filePath));
  for (const p of touchedFiles) {
    const w = work.find(ww => ww.filePath === p);
    writeFileSync(p, JSON.stringify(w.data, null, 2) + '\n', 'utf-8');
  }
}

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
const reportPath = join(AUDIT_DIR, `local-info-link-probe-${TODAY}.md`);
const lines = [];
lines.push(`# Local-info officialSites link probe — ${TODAY}\n`);
lines.push(`Probed **${work.length}** URLs across **${new Set(work.map(w => w.locId)).size}** locations.\n`);
lines.push(`## Summary\n`);
lines.push(`| Status | Count |\n|---|---|`);
for (const [k, v] of Object.entries(byStatus)) {
  if (v > 0) lines.push(`| \`${k}\` | ${v} |`);
}
lines.push('');

const problem = work
  .map(w => ({ ...w, entry: w.data.officialSites[w.entryIndex] }))
  .filter(w => w.entry.linkStatus !== 'ok' && w.entry.linkStatus !== 'redirect');

if (problem.length === 0) {
  lines.push(`## Problem links\n\n_None._\n`);
} else {
  lines.push(`## Problem links (${problem.length})\n`);
  lines.push(`| Location | Site | URL | Status | HTTP |\n|---|---|---|---|---|`);
  for (const w of problem) {
    const s = w.entry;
    lines.push(`| \`${w.locId}\` | ${s.name} | ${s.url} | \`${s.linkStatus}\` | ${s.linkHttpStatus ?? '—'} |`);
  }
  lines.push('');
}

const redirects = work
  .map(w => ({ ...w, entry: w.data.officialSites[w.entryIndex] }))
  .filter(w => w.entry.linkStatus === 'redirect' || w.entry.linkFinalUrl);

if (redirects.length) {
  lines.push(`\n## Redirects (${redirects.length})\n`);
  lines.push(`Consider updating the seed URL to avoid the redirect.\n`);
  lines.push(`| Location | Seed URL | Final URL |\n|---|---|---|`);
  for (const w of redirects) {
    const s = w.entry;
    lines.push(`| \`${w.locId}\` | ${s.url} | ${s.linkFinalUrl || '(same)'} |`);
  }
  lines.push('');
}

if (!DRY_RUN) writeFileSync(reportPath, lines.join('\n'), 'utf-8');

console.log(`\n=== SUMMARY ===`);
console.log(`Total probed:   ${work.length}`);
for (const [k, v] of Object.entries(byStatus)) {
  if (v > 0) console.log(`  ${k.padEnd(14)} ${v}`);
}
console.log(`\nReport: ${DRY_RUN ? '(dry-run — not written)' : reportPath}`);
