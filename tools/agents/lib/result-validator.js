/**
 * result-validator.js — Validate and parse agent output.
 *
 * Usage:
 *   import { validateResult } from './result-validator.js';
 *   const { valid, errors, warnings, parsed } = validateResult(rawOutput, agentConfig);
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/** Reasonable numeric ranges for monthly cost fields (USD). */
const FIELD_RANGES = {
  rent:           { min: 200,  max: 10000 },
  groceries:      { min: 100,  max: 3000 },
  utilities:      { min: 30,   max: 1500 },
  healthcare:     { min: 0,    max: 3000 },
  insurance:      { min: 0,    max: 2000 },
  petCare:        { min: 0,    max: 1000 },
  petDaycare:     { min: 0,    max: 1500 },
  petGrooming:    { min: 0,    max: 500 },
  transportation: { min: 20,   max: 2000 },
  entertainment:  { min: 20,   max: 2000 },
  clothing:       { min: 10,   max: 1000 },
  personalCare:   { min: 10,   max: 500 },
  subscriptions:  { min: 0,    max: 500 },
  phoneCell:      { min: 10,   max: 500 },
  miscellaneous:  { min: 0,    max: 1000 },
  taxes:          { min: 0,    max: 5000 }
};

/**
 * Validate raw agent output string.
 *
 * @param {string} rawOutput — Raw text output from Claude CLI or manual paste
 * @param {object} agentConfig — Agent entry from tab-agents.json
 * @returns {{ valid: boolean, errors: string[], warnings: string[], parsed: object|null }}
 */
export function validateResult(rawOutput, agentConfig) {
  const errors = [];
  const warnings = [];

  // --- Step 1: Extract JSON from raw output ---
  const jsonStr = extractJson(rawOutput);
  if (!jsonStr) {
    errors.push('Could not find a JSON block in the agent output.');
    return { valid: false, errors, warnings, parsed: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    errors.push(`JSON parse error: ${err.message}`);
    return { valid: false, errors, warnings, parsed: null };
  }

  // --- Step 2: Required top-level fields ---
  if (!parsed.agentId) {
    errors.push('Missing required field: agentId');
  } else if (parsed.agentId !== agentConfig.id) {
    warnings.push(`agentId mismatch: expected "${agentConfig.id}", got "${parsed.agentId}"`);
  }

  if (!parsed.runDate) {
    errors.push('Missing required field: runDate');
  }

  // Some agents may use a top-level key instead of "updates"
  const hasUpdates = Array.isArray(parsed.updates);
  const hasAgentSpecific = agentConfig.id in parsed || parsed.data != null;
  if (!hasUpdates && !hasAgentSpecific) {
    errors.push('Missing required field: updates[] (or agent-specific top-level data)');
  }

  // --- Step 3: Validate location IDs ---
  const knownLocations = loadKnownLocations();
  if (hasUpdates) {
    for (const update of parsed.updates) {
      if (update.locationId && !knownLocations.includes(update.locationId)) {
        warnings.push(`Unknown locationId: "${update.locationId}"`);
      }
    }
  }

  // --- Step 4: Numeric range checks ---
  if (hasUpdates) {
    for (const update of parsed.updates) {
      const loc = update.locationId || 'unknown';
      if (update.monthlyCosts) {
        for (const [field, value] of Object.entries(update.monthlyCosts)) {
          const typical = typeof value === 'object' ? value.typical : value;
          if (typeof typical === 'number' && FIELD_RANGES[field]) {
            const range = FIELD_RANGES[field];
            if (typical < range.min || typical > range.max) {
              warnings.push(`${loc}: ${field} typical=$${typical} outside expected range $${range.min}–$${range.max}`);
            }
          }
        }
      }
    }
  }

  // --- Step 5: Source citation check ---
  if (hasUpdates) {
    for (const update of parsed.updates) {
      if (update.changed === true) {
        if (!Array.isArray(update.sources) || update.sources.length === 0) {
          warnings.push(`${update.locationId || 'unknown'}: changed=true but no sources cited`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: errors.length === 0 ? parsed : null
  };
}

/**
 * Extract JSON content from raw output — handles markdown fences and bare JSON.
 */
function extractJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Try markdown fenced block first: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find a JSON object/array directly
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return trimmed.slice(jsonStart, jsonEnd + 1);
  }

  // Array form
  const arrStart = trimmed.indexOf('[');
  const arrEnd = trimmed.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    return trimmed.slice(arrStart, arrEnd + 1);
  }

  return null;
}

/**
 * Load known location IDs from data/index.json.
 */
function loadKnownLocations() {
  try {
    const indexPath = resolve(PROJECT_ROOT, 'data', 'index.json');
    const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
    return (indexData.locations || []).map(l => l.id);
  } catch {
    return [];
  }
}
