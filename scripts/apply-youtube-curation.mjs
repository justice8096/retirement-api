#!/usr/bin/env node
/**
 * Replace the youtubeChannels[0] entry in one location's local-info.json
 * with a curated channel.
 *
 * Usage:
 *   node scripts/apply-youtube-curation.mjs <locationId> <channelName> <channelHandle> [description]
 *
 * channelHandle must start with '@' (e.g. @TheAmericano). If the caller
 * supplies a plain channel URL instead, that is accepted too.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [, , locId, channelName, channelRef, ...descParts] = process.argv;
if (!locId || !channelName || !channelRef) {
  console.error('Usage: node apply-youtube-curation.mjs <locId> <channelName> <@handle|url> [description...]');
  process.exit(1);
}

const TODAY = new Date().toISOString().slice(0, 10);
const url = channelRef.startsWith('http')
  ? channelRef
  : `https://www.youtube.com/${channelRef.startsWith('@') ? channelRef : '@' + channelRef}`;

const description = descParts.join(' ').trim() || undefined;
const filePath = join('data/locations', locId, 'local-info.json');
const data = JSON.parse(readFileSync(filePath, 'utf-8'));

const entry = { name: channelName, url, accessed: TODAY };
if (description) entry.description = description;

data.youtubeChannels = [entry];
writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✓ ${locId}: ${channelName} -> ${url}`);
