#!/usr/bin/env node

/**
 * orchestrator.js — Agent pipeline orchestrator for the retirement dashboard.
 *
 * CLI Usage:
 *   node tools/agents/orchestrator.js [options]
 *
 * Options:
 *   --agent <id>         Run a single agent by ID
 *   --wave <n>           Run only wave N from the dependency graph
 *   --location <id>      Limit to a single location
 *   --locations <ids>    Comma-separated location IDs
 *   --dry-run            Validate and preview without writing files
 *   --force              Ignore schedule frequency (run even if not due)
 *   --serial             Run agents sequentially (default)
 *   --parallel           Run agents in parallel within each wave
 *   --concurrency <n>    Max parallel agents (default: 4)
 *   --report             Generate run report at end
 *   --skip-db-rebuild    Skip build-db.js at the end
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

import { loadPrompt } from './lib/prompt-loader.js';
import { buildContext } from './lib/context-builder.js';
import { validateResult } from './lib/result-validator.js';
import { writeResults } from './lib/file-writer.js';
import { createReport } from './lib/run-report.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ── Parse CLI arguments ─────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    agent: null,
    wave: null,
    location: null,
    locations: null,
    dryRun: false,
    force: false,
    serial: true,
    parallel: false,
    concurrency: 4,
    report: false,
    skipDbRebuild: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--agent':       opts.agent = args[++i]; break;
      case '--wave':        opts.wave = parseInt(args[++i], 10); break;
      case '--location':    opts.location = args[++i]; break;
      case '--locations':   opts.locations = args[++i].split(',').map(s => s.trim()); break;
      case '--dry-run':     opts.dryRun = true; break;
      case '--force':       opts.force = true; break;
      case '--serial':      opts.serial = true; opts.parallel = false; break;
      case '--parallel':    opts.parallel = true; opts.serial = false; break;
      case '--concurrency': opts.concurrency = parseInt(args[++i], 10); break;
      case '--report':      opts.report = true; break;
      case '--skip-db-rebuild': opts.skipDbRebuild = true; break;
      default:
        if (args[i].startsWith('-')) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }

  return opts;
}

// ── Load configs ────────────────────────────────────────────────────

function loadConfigs() {
  const configDir = resolve(__dirname, 'configs');
  const tabAgents = JSON.parse(readFileSync(resolve(configDir, 'tab-agents.json'), 'utf-8'));
  const depGraph = JSON.parse(readFileSync(resolve(configDir, 'dependency-graph.json'), 'utf-8'));
  const schedule = JSON.parse(readFileSync(resolve(configDir, 'schedule.json'), 'utf-8'));
  const indexData = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'data', 'index.json'), 'utf-8'));
  const allLocationIds = indexData.locations.map(l => l.id);

  return { tabAgents, depGraph, schedule, allLocationIds };
}

// ── Determine which locations are in scope ──────────────────────────

function resolveLocations(agentConfig, opts, allLocationIds) {
  // Explicit CLI override
  if (opts.locations) return opts.locations;
  if (opts.location) return [opts.location];

  // Agent-level scope
  const scope = agentConfig.locationsScope;
  if (scope === 'none') return [];
  if (scope === 'all') return allLocationIds;
  if (scope === 'eur-all') return allLocationIds.filter(id => !id.startsWith('us-'));

  // Fallback
  return allLocationIds;
}

// ── Check if agent is due per schedule ──────────────────────────────

function isDue(agentId, schedule, force) {
  if (force) return true;

  const lastRun = schedule.lastRun[agentId];
  if (!lastRun) return true; // Never run before

  const agentFreq = findFrequency(agentId, schedule);
  if (!agentFreq || agentFreq.intervalDays === 0) return true; // "always" frequency

  const daysSince = (Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= agentFreq.intervalDays;
}

function findFrequency(agentId, schedule) {
  // Look up the agent's updateFrequency from tab-agents config (loaded separately)
  // This is checked at call site with the agent config
  return null; // Caller passes frequency name
}

function getFrequencyInterval(frequencyName, schedule) {
  const freq = schedule.frequencies[frequencyName];
  return freq ? freq.intervalDays : 0;
}

function isDueByFrequency(agentId, frequencyName, schedule, force) {
  if (force) return true;
  const lastRun = schedule.lastRun[agentId];
  if (!lastRun) return true;
  const intervalDays = getFrequencyInterval(frequencyName, schedule);
  if (intervalDays === 0) return true;
  const daysSince = (Date.now() - new Date(lastRun).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= intervalDays;
}

// ── Build execution plan ────────────────────────────────────────────

function buildExecutionPlan(opts, tabAgents, depGraph, schedule) {
  const agentMap = new Map(tabAgents.agents.map(a => [a.id, a]));
  const plan = []; // Array of waves, each wave is an array of agent configs

  for (const waveDef of depGraph.waves) {
    if (opts.wave != null && waveDef.wave !== opts.wave) continue;

    const waveAgents = [];
    for (const agentId of waveDef.agents) {
      if (opts.agent && opts.agent !== agentId) continue;

      const config = agentMap.get(agentId);
      if (!config) {
        console.error(`[orchestrator] WARNING: Agent "${agentId}" in dependency-graph but not in tab-agents.json`);
        continue;
      }

      // Skip agents not yet due (unless --force)
      if (!isDueByFrequency(agentId, config.updateFrequency, schedule, opts.force)) {
        console.error(`[orchestrator] Skipping ${agentId} — not due yet (frequency: ${config.updateFrequency})`);
        continue;
      }

      // Skip prompt-less agents (like index-sync — handled separately)
      if (config.promptFile === null) continue;

      waveAgents.push(config);
    }

    if (waveAgents.length > 0) {
      plan.push({ wave: waveDef.wave, label: waveDef.label, agents: waveAgents });
    }
  }

  return plan;
}

// ── Run a single agent ──────────────────────────────────────────────

async function runAgent(agentConfig, opts, allLocationIds) {
  const startTime = Date.now();
  const locations = resolveLocations(agentConfig, opts, allLocationIds);
  const agentResult = {
    agentId: agentConfig.id,
    status: 'skipped',
    locationsUpdated: [],
    locationsUnchanged: [],
    confidence: null,
    duration: null,
    errors: [],
    warnings: []
  };

  try {
    // Phase 2: Build context
    console.error(`\n[orchestrator] ── ${agentConfig.label} (${agentConfig.id}) ──`);
    console.error(`[orchestrator] Locations: ${locations.length > 0 ? locations.join(', ') : 'none'}`);
    const context = buildContext(agentConfig, locations);

    // Phase 3: Load prompt
    const prompt = loadPrompt(agentConfig.promptFile, context);

    // Phase 4: Execute — print prompt for manual use (default mode)
    // To invoke Claude CLI automatically, set AGENT_AUTO_INVOKE=1
    const autoInvoke = process.env.AGENT_AUTO_INVOKE === '1';

    if (autoInvoke) {
      console.error(`[orchestrator] Invoking Claude CLI for ${agentConfig.id}...`);
      let rawOutput;
      try {
        rawOutput = execFileSync('claude', ['-p', prompt, '--output-format', 'text'], {
          encoding: 'utf-8',
          timeout: 300000, // 5 minute timeout
          maxBuffer: 10 * 1024 * 1024
        });
      } catch (err) {
        agentResult.status = 'error';
        agentResult.errors.push(`Claude CLI failed: ${err.message}`);
        agentResult.duration = Date.now() - startTime;
        return agentResult;
      }

      // Phase 5: Validate and write
      const validation = validateResult(rawOutput, agentConfig);
      agentResult.warnings.push(...validation.warnings);

      if (!validation.valid) {
        agentResult.status = 'error';
        agentResult.errors.push(...validation.errors);
        agentResult.duration = Date.now() - startTime;
        return agentResult;
      }

      const writeOpts = { dryRun: opts.dryRun };
      const { filesWritten } = writeResults(validation.parsed, agentConfig, writeOpts);

      // Collect stats from parsed updates
      if (validation.parsed.updates) {
        for (const u of validation.parsed.updates) {
          if (u.changed) {
            agentResult.locationsUpdated.push(u.locationId);
          } else {
            agentResult.locationsUnchanged.push(u.locationId);
          }
        }
      }
      agentResult.confidence = validation.parsed.confidence ?? null;
      agentResult.status = 'success';
      console.error(`[orchestrator] ${agentConfig.id}: ${filesWritten.length} files written`);
    } else {
      // Manual mode: print prompt to stdout for copy/paste
      const separator = '═'.repeat(72);
      process.stdout.write(`\n${separator}\n`);
      process.stdout.write(`AGENT: ${agentConfig.label} (${agentConfig.id})\n`);
      process.stdout.write(`${separator}\n\n`);
      process.stdout.write(prompt);
      process.stdout.write(`\n\n${separator}\n`);
      agentResult.status = 'prompt-printed';
    }
  } catch (err) {
    agentResult.status = 'error';
    agentResult.errors.push(err.message);
  }

  agentResult.duration = Date.now() - startTime;
  return agentResult;
}

// ── Concurrency limiter ─────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const promise = task().then(result => {
      executing.delete(promise);
      return result;
    });
    executing.add(promise);
    results.push(promise);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

// ── Index sync ──────────────────────────────────────────────────────

function runIndexSync(allLocationIds, dryRun) {
  console.error('\n[orchestrator] ── Index Sync ──');
  const indexPath = resolve(PROJECT_ROOT, 'data', 'index.json');
  const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));

  let changed = 0;
  for (const locEntry of indexData.locations) {
    const locPath = resolve(PROJECT_ROOT, 'data', 'locations', locEntry.id, 'location.json');
    if (!existsSync(locPath)) continue;

    try {
      const locData = JSON.parse(readFileSync(locPath, 'utf-8'));
      const costs = locData.monthlyCosts || {};
      const rate = locData.exchangeRate || 1;

      // Sum all typical costs and convert to USD
      let totalLocal = 0;
      for (const [, val] of Object.entries(costs)) {
        if (typeof val === 'object' && val.typical != null) {
          totalLocal += val.typical;
        } else if (typeof val === 'number') {
          totalLocal += val;
        }
      }
      const totalUSD = Math.round(totalLocal / rate);

      if (locEntry.monthlyCostUSD !== totalUSD) {
        console.error(`  ${locEntry.id}: monthlyCostUSD ${locEntry.monthlyCostUSD} -> ${totalUSD}`);
        locEntry.monthlyCostUSD = totalUSD;
        changed++;
      }
    } catch {
      console.error(`  WARNING: Could not read ${locPath}`);
    }
  }

  indexData.meta.lastUpdated = new Date().toISOString().slice(0, 10);

  if (!dryRun && changed > 0) {
    writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n', 'utf-8');
    console.error(`[orchestrator] Index sync: ${changed} location(s) updated`);
  } else if (changed === 0) {
    console.error('[orchestrator] Index sync: no changes');
  } else {
    console.error(`[orchestrator] DRY RUN — index sync would update ${changed} location(s)`);
  }
}

// ── Build database ──────────────────────────────────────────────────

function runBuildDb() {
  console.error('\n[orchestrator] ── Rebuilding SQLite database ──');
  try {
    execFileSync('node', [resolve(PROJECT_ROOT, 'tools', 'build-db.js')], {
      encoding: 'utf-8',
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'inherit']
    });
    console.error('[orchestrator] Database rebuild complete');
  } catch (err) {
    console.error(`[orchestrator] WARNING: Database rebuild failed: ${err.message}`);
  }
}

// ── Update schedule timestamps ──────────────────────────────────────

function updateSchedule(agentResults) {
  const schedulePath = resolve(__dirname, 'configs', 'schedule.json');
  const schedule = JSON.parse(readFileSync(schedulePath, 'utf-8'));
  const now = new Date().toISOString();

  for (const result of agentResults) {
    if (result.status === 'success') {
      schedule.lastRun[result.agentId] = now;
    }
  }

  writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n', 'utf-8');
  console.error('[orchestrator] Schedule timestamps updated');
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  const startTime = Date.now();
  const { tabAgents, depGraph, schedule, allLocationIds } = loadConfigs();

  console.error('[orchestrator] Retirement Dashboard Agent Pipeline');
  console.error(`[orchestrator] Mode: ${opts.parallel ? 'parallel' : 'serial'}, dryRun: ${opts.dryRun}, force: ${opts.force}`);

  // Phase 1: Build execution plan
  const plan = buildExecutionPlan(opts, tabAgents, depGraph, schedule);

  if (plan.length === 0) {
    console.error('[orchestrator] No agents to run (all up to date or filtered out).');
    if (!opts.skipDbRebuild) runBuildDb();
    return;
  }

  console.error(`[orchestrator] Execution plan: ${plan.length} wave(s)`);
  for (const wave of plan) {
    console.error(`  Wave ${wave.wave} (${wave.label}): ${wave.agents.map(a => a.id).join(', ')}`);
  }

  // Phase 2–5: Execute waves
  const allResults = [];

  for (const wave of plan) {
    console.error(`\n[orchestrator] ═══ Wave ${wave.wave}: ${wave.label} ═══`);

    if (opts.parallel && wave.agents.length > 1) {
      const tasks = wave.agents.map(agent => () => runAgent(agent, opts, allLocationIds));
      const waveResults = await runWithConcurrency(tasks, opts.concurrency);
      allResults.push(...waveResults);

      // Check for critical failures
      for (const result of waveResults) {
        if (result.status === 'error' && depGraph.critical.includes(result.agentId)) {
          console.error(`[orchestrator] CRITICAL agent "${result.agentId}" failed — downstream waves may have stale data`);
        }
      }
    } else {
      // Serial execution
      for (const agent of wave.agents) {
        const result = await runAgent(agent, opts, allLocationIds);
        allResults.push(result);

        if (result.status === 'error' && depGraph.critical.includes(result.agentId)) {
          console.error(`[orchestrator] CRITICAL agent "${result.agentId}" failed — downstream waves may have stale data`);
        }
      }
    }
  }

  // Always run index sync
  runIndexSync(allLocationIds, opts.dryRun);

  // Always run build-db last (unless skipped)
  if (!opts.skipDbRebuild && !opts.dryRun) {
    runBuildDb();
  }

  // Update schedule timestamps
  if (!opts.dryRun) {
    updateSchedule(allResults);
  }

  // Generate report
  if (opts.report) {
    const { markdown } = createReport(allResults, startTime);
    process.stdout.write(markdown);
  }

  // Summary
  const succeeded = allResults.filter(r => r.status === 'success').length;
  const failed = allResults.filter(r => r.status === 'error').length;
  const printed = allResults.filter(r => r.status === 'prompt-printed').length;
  console.error(`\n[orchestrator] Done. ${succeeded} succeeded, ${failed} failed, ${printed} prompts printed.`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(`[orchestrator] Fatal error: ${err.message}`);
  process.exit(1);
});
