/**
 * file-writer.js — Write validated agent results back to data files.
 *
 * Usage:
 *   import { writeResults } from './file-writer.js';
 *   const { filesWritten, backups } = writeResults(parsed, agentConfig, { dryRun: false });
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Write parsed agent results to data files, creating backups first.
 *
 * @param {object} parsed — Validated parsed output from the agent
 * @param {object} agentConfig — Agent entry from tab-agents.json
 * @param {object} options — { dryRun: boolean }
 * @returns {{ filesWritten: string[], backups: string[] }}
 */
export function writeResults(parsed, agentConfig, options = {}) {
  const { dryRun = false } = options;
  const filesWritten = [];
  const backups = [];
  const dateStamp = new Date().toISOString().slice(0, 10);

  const updates = parsed.updates || [];

  for (const update of updates) {
    const locId = update.locationId;
    if (!locId) {
      console.error('[file-writer] Skipping update with no locationId');
      continue;
    }

    // Determine which target files to update for this location
    for (const filePattern of agentConfig.targetFiles) {
      const fileName = filePattern.startsWith('data/shared/')
        ? filePattern.replace('data/shared/', '')
        : filePattern.replace('data/locations/*/', '');

      const filePath = filePattern.startsWith('data/shared/')
        ? resolve(PROJECT_ROOT, filePattern)
        : resolve(PROJECT_ROOT, 'data', 'locations', locId, fileName);

      if (!existsSync(filePath)) {
        console.error(`[file-writer] File not found, skipping: ${filePath}`);
        continue;
      }

      // Read current data
      let currentData;
      try {
        currentData = JSON.parse(readFileSync(filePath, 'utf-8'));
      } catch (err) {
        console.error(`[file-writer] Could not parse ${filePath}: ${err.message}`);
        continue;
      }

      // Create backup
      const backupDir = filePattern.startsWith('data/shared/')
        ? resolve(PROJECT_ROOT, 'data', 'shared', '.backups')
        : resolve(PROJECT_ROOT, 'data', 'locations', locId, '.backups');
      const backupName = `${dateStamp}_${basename(filePath)}`;
      const backupPath = resolve(backupDir, backupName);

      if (!dryRun) {
        mkdirSync(backupDir, { recursive: true });
        copyFileSync(filePath, backupPath);
      }
      backups.push(backupPath);

      // Deep merge update data into current data
      const mergedData = deepMerge(currentData, buildMergePayload(update, agentConfig));
      mergedData.lastUpdated = dateStamp;

      // Log changes to stderr
      logChanges(locId, currentData, mergedData, agentConfig.targetPaths);

      if (!dryRun) {
        writeFileSync(filePath, JSON.stringify(mergedData, null, 2) + '\n', 'utf-8');
      }
      filesWritten.push(filePath);

      if (dryRun) {
        console.error(`[file-writer] DRY RUN — would write: ${filePath}`);
      }
    }
  }

  return { filesWritten, backups };
}

/**
 * Build a merge payload from the update object, mapping agent output fields
 * to the structure expected by the target file.
 */
function buildMergePayload(update, agentConfig) {
  const payload = {};

  // Merge monthlyCosts if present
  if (update.monthlyCosts) {
    payload.monthlyCosts = update.monthlyCosts;
  }

  // Merge any top-level keys that match known data patterns
  for (const key of Object.keys(update)) {
    if (['locationId', 'changed', 'sources', 'confidence', 'notes', 'monthlyCosts'].includes(key)) {
      continue; // Skip metadata fields
    }
    payload[key] = update[key];
  }

  return payload;
}

/**
 * Deep merge source into target. Arrays are replaced, not concatenated.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] != null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      result[key] != null
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Log field changes to stderr for visibility.
 */
function logChanges(locId, oldData, newData, targetPaths) {
  for (const path of targetPaths) {
    const parts = path.replace(/^\$\./, '').split('.').filter(p => !p.includes('[*]'));
    const oldVal = getNestedValue(oldData, parts);
    const newVal = getNestedValue(newData, parts);

    if (oldVal === undefined && newVal === undefined) continue;

    const oldStr = summarizeValue(oldVal);
    const newStr = summarizeValue(newVal);
    if (oldStr !== newStr) {
      console.error(`  ${locId}: ${parts.join('.')} ${oldStr} -> ${newStr}`);
    }
  }
}

function getNestedValue(obj, parts) {
  let current = obj;
  for (const p of parts) {
    if (current == null) return undefined;
    current = current[p];
  }
  return current;
}

function summarizeValue(val) {
  if (val === undefined) return '(missing)';
  if (val === null) return 'null';
  if (typeof val === 'object') {
    if (val.typical !== undefined) return `$${val.typical}`;
    return JSON.stringify(val).slice(0, 60);
  }
  return String(val);
}
