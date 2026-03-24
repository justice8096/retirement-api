#!/usr/bin/env node
/**
 * update-costs.js — Claude connector for fetching updated retirement cost data.
 *
 * Usage:
 *   Run this via Claude Code to update location costs with current data.
 *   Claude reads the current locations.json, researches updated costs,
 *   and writes back the updated file.
 *
 *   node tools/update-costs.js [--location <id>] [--category <cat>] [--dry-run]
 *
 * When run by Claude, it:
 *   1. Reads current locations.json
 *   2. Outputs a prompt for Claude to research updated costs
 *   3. Accepts updated data via stdin (JSON)
 *   4. Merges updates into locations.json
 *
 * For manual use, edit the locations.json directly or use the dashboard UI.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'locations.json');

function loadData() {
  return JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
}

function saveData(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getArgs() {
  const args = process.argv.slice(2);
  const opts = { location: null, category: null, dryRun: false, prompt: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--location' && args[i + 1]) opts.location = args[++i];
    else if (args[i] === '--category' && args[i + 1]) opts.category = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--prompt') opts.prompt = true;
    else if (args[i] === '--help') {
      console.log(`
update-costs.js — Update retirement cost data

Usage:
  node tools/update-costs.js --prompt                    Generate research prompt for Claude
  node tools/update-costs.js --location france-brittany   Update specific location
  node tools/update-costs.js --category healthcare       Update specific category across all
  node tools/update-costs.js --dry-run                   Show what would change without saving

Workflow with Claude Code:
  1. Run: node tools/update-costs.js --prompt
  2. Claude researches current costs for each location
  3. Claude updates data/locations.json with findings
  4. Dashboard automatically reflects new data on reload
`);
      process.exit(0);
    }
  }
  return opts;
}

function generatePrompt(data, locationId, category) {
  const locations = locationId
    ? data.locations.filter(l => l.id === locationId)
    : data.locations;

  const categories = category
    ? [category]
    : Object.keys(locations[0].monthlyCosts);

  console.error('=== RETIREMENT COST UPDATE PROMPT ===');
  console.error('');
  console.error('Please research and update the following costs (in USD/month):');
  console.error('');

  const output = { updates: [] };

  locations.forEach(loc => {
    console.error(`--- ${loc.name} (${loc.currency}, rate: ${loc.exchangeRate}) ---`);
    const locUpdate = { id: loc.id, name: loc.name, costs: {} };

    categories.forEach(cat => {
      const current = loc.monthlyCosts[cat];
      if (!current) return;
      console.error(`  ${cat}: min=${current.min} typical=${current.typical} max=${current.max} (inflation: ${((current.annualInflation || 0.025) * 100).toFixed(1)}%)`);
      locUpdate.costs[cat] = { min: current.min, typical: current.typical, max: current.max };
    });

    output.updates.push(locUpdate);
    console.error('');
  });

  // Output the template as JSON to stdout for Claude to fill in
  console.log(JSON.stringify(output, null, 2));
  console.error('');
  console.error('To update, modify the JSON above with current values and pipe back:');
  console.error('  node tools/update-costs.js < updated-costs.json');
}

function applyUpdates(data, updates, dryRun) {
  let changeCount = 0;

  updates.forEach(update => {
    const loc = data.locations.find(l => l.id === update.id);
    if (!loc) {
      console.error(`Warning: location "${update.id}" not found, skipping`);
      return;
    }

    Object.entries(update.costs).forEach(([cat, newVals]) => {
      if (!loc.monthlyCosts[cat]) {
        console.error(`  Warning: category "${cat}" not found in ${loc.name}, skipping`);
        return;
      }

      const old = loc.monthlyCosts[cat];
      const changes = [];

      if (newVals.min !== undefined && newVals.min !== old.min) {
        changes.push(`min: ${old.min} → ${newVals.min}`);
        if (!dryRun) old.min = newVals.min;
      }
      if (newVals.typical !== undefined && newVals.typical !== old.typical) {
        changes.push(`typical: ${old.typical} → ${newVals.typical}`);
        if (!dryRun) old.typical = newVals.typical;
      }
      if (newVals.max !== undefined && newVals.max !== old.max) {
        changes.push(`max: ${old.max} → ${newVals.max}`);
        if (!dryRun) old.max = newVals.max;
      }
      if (newVals.annualInflation !== undefined && newVals.annualInflation !== old.annualInflation) {
        changes.push(`inflation: ${old.annualInflation} → ${newVals.annualInflation}`);
        if (!dryRun) old.annualInflation = newVals.annualInflation;
      }

      if (changes.length > 0) {
        console.error(`  ${loc.name} > ${cat}: ${changes.join(', ')}`);
        changeCount += changes.length;
      }
    });
  });

  return changeCount;
}

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const opts = getArgs();
  const data = loadData();

  if (opts.prompt) {
    generatePrompt(data, opts.location, opts.category);
    return;
  }

  // Check for stdin input
  const stdinData = await readStdin();
  if (stdinData) {
    try {
      const parsed = JSON.parse(stdinData);
      const updates = parsed.updates || parsed;
      const changeCount = applyUpdates(data, Array.isArray(updates) ? updates : [updates], opts.dryRun);

      if (changeCount === 0) {
        console.error('No changes detected.');
      } else if (opts.dryRun) {
        console.error(`\nDry run: ${changeCount} change(s) would be applied.`);
      } else {
        data.meta.lastUpdated = new Date().toISOString().split('T')[0];
        saveData(data);
        console.error(`\nApplied ${changeCount} change(s). Updated ${DATA_PATH}`);
      }
    } catch (err) {
      console.error('Failed to parse input:', err.message);
      process.exit(1);
    }
    return;
  }

  // Default: show current summary
  console.error('Current locations and typical monthly costs:');
  console.error('');
  data.locations.forEach(loc => {
    const total = Object.values(loc.monthlyCosts).reduce((s, c) => s + (c.typical || 0), 0);
    console.error(`  ${loc.name}: $${total}/mo (${Object.keys(loc.monthlyCosts).length} categories)`);
  });
  console.error('');
  console.error('Use --prompt to generate a research template, or --help for options.');
}

main();
