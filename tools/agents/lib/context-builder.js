/**
 * context-builder.js — Build context objects for agent prompt interpolation.
 *
 * Usage:
 *   import { buildContext } from './context-builder.js';
 *   const ctx = buildContext(agentConfig, ['us-virginia', 'france-lyon']);
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const AGENTS_ROOT = resolve(__dirname, '..');

/**
 * Build a context object for an agent's prompt template.
 *
 * @param {object} agentConfig — Agent entry from tab-agents.json
 * @param {string[]} locations — Array of location IDs to include in scope
 * @returns {object} Context object with interpolation variables
 */
export function buildContext(agentConfig, locations) {
  const runDate = new Date().toISOString().slice(0, 10);

  // --- Household profile ---
  const indexPath = resolve(PROJECT_ROOT, 'data', 'index.json');
  const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
  const hp = indexData.householdProfile;
  const householdBlock = formatHouseholdProfile(hp);

  // --- Current data for each location in scope ---
  const currentDataRows = [];
  for (const locId of locations) {
    const locDir = resolve(PROJECT_ROOT, 'data', 'locations', locId);
    if (!existsSync(locDir)) {
      console.error(`[context-builder] WARNING: Location directory not found: ${locId}`);
      continue;
    }
    for (const filePattern of agentConfig.targetFiles) {
      const fileName = filePattern.replace('data/locations/*/', '').replace('data/shared/', '');
      const filePath = filePattern.startsWith('data/shared/')
        ? resolve(PROJECT_ROOT, filePattern)
        : resolve(locDir, fileName);
      if (!existsSync(filePath)) continue;
      try {
        const fileData = JSON.parse(readFileSync(filePath, 'utf-8'));
        for (const jsonPath of agentConfig.targetPaths) {
          const extracted = extractPath(fileData, jsonPath);
          if (extracted !== undefined) {
            const displayValue = typeof extracted === 'object'
              ? JSON.stringify(extracted)
              : String(extracted);
            currentDataRows.push({ location: locId, field: jsonPath, value: displayValue });
          }
        }
      } catch {
        // Skip unparseable files
      }
    }
  }
  const currentDataBlock = formatCurrentData(currentDataRows);

  // --- Sources ---
  const sourcesPath = resolve(AGENTS_ROOT, 'registry', 'sources.json');
  let sourcesBlock = '_No sources registry found._';
  if (existsSync(sourcesPath)) {
    try {
      const sourcesData = JSON.parse(readFileSync(sourcesPath, 'utf-8'));
      const relevant = (sourcesData.sources || []).filter(
        s => s.agentIds && s.agentIds.includes(agentConfig.id)
      );
      sourcesBlock = formatSources(relevant);
    } catch {
      sourcesBlock = '_Could not parse sources.json._';
    }
  }

  // --- Locations scope description ---
  const locationsScope = locations.length > 0
    ? locations.join(', ')
    : agentConfig.locationsScope || 'none';

  return {
    AGENT_LABEL: agentConfig.label,
    TAB_IDS: agentConfig.tabIds.join(', '),
    RUN_DATE: runDate,
    LOCATIONS_SCOPE: locationsScope,
    HOUSEHOLD_PROFILE_BLOCK: householdBlock,
    CURRENT_DATA_BLOCK: currentDataBlock,
    SOURCES_BLOCK: sourcesBlock
  };
}

/**
 * Extract a value from an object using a simplified JSONPath-like expression.
 * Supports: $.key, $.key.subkey, $.key[*].subkey (returns first match).
 */
function extractPath(obj, path) {
  const parts = path.replace(/^\$\./, '').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    // Handle array wildcard notation like "locations[*]"
    const arrMatch = part.match(/^(.+)\[\*\]$/);
    if (arrMatch) {
      current = current[arrMatch[1]];
      if (Array.isArray(current) && current.length > 0) {
        current = current[0]; // Take first element for preview
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }
  return current;
}

function formatHouseholdProfile(hp) {
  const lines = [
    '| Field | Value |',
    '|-------|-------|',
    `| Adults | ${hp.adults} |`,
    `| Ages at start | ${hp.agesAtStart.join(', ')} |`,
    `| Target annual income | $${hp.targetAnnualIncome.toLocaleString()} |`,
    `| Planning horizon | ${hp.planningHorizon.startYear}–${hp.planningHorizon.endYear} |`,
    `| Requirements | ${hp.requirements.join(', ')} |`
  ];
  if (hp.pets && hp.pets.length > 0) {
    for (const pet of hp.pets) {
      lines.push(`| Pet | ${pet.breed} (${pet.type}), age ${pet.currentAge}, lifespan ${pet.expectedLifespan}y |`);
    }
  }
  return lines.join('\n');
}

function formatCurrentData(rows) {
  if (rows.length === 0) return '_No current data found for target paths._';
  const lines = [
    '| Location | Field | Current Value |',
    '|----------|-------|---------------|'
  ];
  for (const row of rows) {
    // Truncate long values for readability
    const val = row.value.length > 120 ? row.value.slice(0, 117) + '...' : row.value;
    lines.push(`| ${row.location} | ${row.field} | ${val} |`);
  }
  return lines.join('\n');
}

function formatSources(sources) {
  if (sources.length === 0) return '_No registered sources for this agent._';
  const lines = sources.map((s, i) =>
    `${i + 1}. **${s.name || s.id}** — ${s.url || 'No URL'} (quality: ${s.quality ?? 'N/A'}, lastVerified: ${s.lastVerified ?? 'never'})`
  );
  return lines.join('\n');
}
