#!/usr/bin/env node
/**
 * Parse raw YouTube search-results text (from get_page_text) and write
 * the first channel result to a location's local-info.json as the
 * youtubeChannels[0] entry.
 *
 * Usage:
 *   node scripts/apply-youtube-auto.mjs <locationId> <path-to-text-file>
 *   node scripts/apply-youtube-auto.mjs <locationId> --stdin
 *
 * Expected text format (as produced by Chrome MCP get_page_text on a
 * YouTube search page filtered to channels):
 *
 *   ... Filters Search filters <Name> <Name> @<handle>•<N> subscribers<desc> Subscribe Subscribed <next> ...
 *
 * The channel name appears twice back-to-back (link text + heading).
 * We pick the first channel block.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const TODAY = new Date().toISOString().slice(0, 10);

function parseFirstChannel(txt) {
  // Strip everything up to and including "Filters Search filters"
  const marker = 'Filters Search filters';
  const i = txt.indexOf(marker);
  const body = i >= 0 ? txt.slice(i + marker.length) : txt;

  // Find first "@handle•<N> subscribers..." anchor
  const handleRe = /@([A-Za-z0-9_.-]+)•([\d.KM]+)\s+subscribers([^]*?)\s+Subscribe Subscribed/;
  const m = body.match(handleRe);
  if (!m) return null;
  const handle = m[1];
  const subs = m[2];
  const description = m[3].trim();

  // Before the @handle, the channel name appears twice back-to-back.
  const pre = body.slice(0, m.index).trim();
  // Take everything after any leading whitespace as "<Name> <Name>"
  // where Name can contain spaces. Use the fact that it repeats.
  // Strategy: walk back from the end of `pre` and find where it splits
  // into two equal halves.
  let name = pre;
  for (let len = Math.floor(pre.length / 2); len > 2; len--) {
    const a = pre.slice(pre.length - len * 2 - 1, pre.length - len - 1).trim();
    const b = pre.slice(pre.length - len).trim();
    if (a === b && a.length > 1) {
      name = a;
      break;
    }
  }
  // Fallback: use everything after the last newline or punctuation if dedup failed
  if (name === pre && pre.includes(' ')) {
    // If two halves aren't equal, just take the last N words (≤8)
    const words = pre.split(/\s+/);
    name = words.slice(-Math.min(8, Math.ceil(words.length / 2))).join(' ');
  }

  return { name: name.trim(), handle, subs, description };
}

const [, , locId, src] = process.argv;
if (!locId || !src) {
  console.error('Usage: node apply-youtube-auto.mjs <locId> <textFile|--stdin>');
  process.exit(1);
}

let txt;
if (src === '--stdin') {
  txt = readFileSync(0, 'utf-8');
} else {
  txt = readFileSync(src, 'utf-8');
}

const ch = parseFirstChannel(txt);
if (!ch) {
  console.error(`✗ ${locId}: no channel parsed from text (length=${txt.length})`);
  process.exit(2);
}

const entry = {
  name: ch.name,
  url: `https://www.youtube.com/@${ch.handle}`,
  accessed: TODAY,
};
if (ch.description) entry.description = ch.description.slice(0, 200);

const filePath = join('data/locations', locId, 'local-info.json');
const data = JSON.parse(readFileSync(filePath, 'utf-8'));
data.youtubeChannels = [entry];
writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✓ ${locId}: ${ch.name} (@${ch.handle}, ${ch.subs} subs)`);
