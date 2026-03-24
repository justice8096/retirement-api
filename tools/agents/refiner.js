#!/usr/bin/env node

/**
 * refiner.js — Analyze recent agent runs for quality issues and suggest improvements.
 *
 * CLI Usage:
 *   node tools/agents/refiner.js
 *
 * Reads run-history from the past 7 days, checks for:
 * - Source staleness (lastVerified vs updateLag)
 * - Low confidence agents across multiple runs
 * - Zero-change agents across multiple runs
 * - Schema instability (varying output structures)
 *
 * Outputs:
 * - tools/agents/refinement-report-YYYY-MM-DD.md
 * - Updated quality scores in registry/sources.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const HISTORY_DIR = resolve(PROJECT_ROOT, 'data', 'agents', 'run-history');
const SOURCES_PATH = resolve(__dirname, 'registry', 'sources.json');
const LOOKBACK_DAYS = 7;

// ── Load recent run history ─────────────────────────────────────────

function loadRecentRuns() {
  if (!existsSync(HISTORY_DIR)) return [];

  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const files = readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
  const runs = [];

  for (const file of files) {
    const filePath = resolve(HISTORY_DIR, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (data.timestamp && new Date(data.timestamp).getTime() >= cutoff) {
        runs.push(data);
      }
    } catch {
      // Skip unparseable files
    }
  }

  // Also check outputs/ directory for raw agent responses
  const outputsDir = resolve(HISTORY_DIR, '..', 'outputs');
  // We only use run-history JSONs for analysis

  return runs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// ── Check source staleness ──────────────────────────────────────────

function checkSourceStaleness() {
  const issues = [];

  if (!existsSync(SOURCES_PATH)) {
    issues.push({ type: 'info', message: 'No sources.json found — source staleness check skipped.' });
    return issues;
  }

  let sourcesData;
  try {
    sourcesData = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
  } catch {
    issues.push({ type: 'error', message: 'Could not parse sources.json.' });
    return issues;
  }

  const now = Date.now();
  const sources = sourcesData.sources || [];

  for (const source of sources) {
    if (!source.lastVerified) {
      issues.push({
        type: 'warning',
        source: source.id || source.name,
        message: `Source "${source.name || source.id}" has never been verified.`
      });
      continue;
    }

    const verifiedDate = new Date(source.lastVerified).getTime();
    const daysSince = (now - verifiedDate) / (1000 * 60 * 60 * 24);
    const maxLag = source.updateLagDays || 90;

    if (daysSince > maxLag) {
      issues.push({
        type: 'stale',
        source: source.id || source.name,
        daysSince: Math.round(daysSince),
        maxLag,
        message: `Source "${source.name || source.id}" last verified ${Math.round(daysSince)}d ago (threshold: ${maxLag}d).`
      });
    }
  }

  return issues;
}

// ── Check low confidence agents ─────────────────────────────────────

function checkLowConfidence(runs) {
  const issues = [];
  const agentConfidences = new Map(); // agentId -> confidence[]

  for (const run of runs) {
    for (const agent of run.agents || []) {
      if (agent.confidence != null) {
        if (!agentConfidences.has(agent.agentId)) {
          agentConfidences.set(agent.agentId, []);
        }
        agentConfidences.get(agent.agentId).push(agent.confidence);
      }
    }
  }

  for (const [agentId, confidences] of agentConfidences) {
    if (confidences.length < 2) continue;
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    if (avg < 0.7) {
      issues.push({
        type: 'low-confidence',
        agentId,
        avgConfidence: avg.toFixed(2),
        runs: confidences.length,
        message: `Agent "${agentId}" has avg confidence ${(avg * 100).toFixed(0)}% across ${confidences.length} runs.`
      });
    }
  }

  return issues;
}

// ── Check zero-change agents ────────────────────────────────────────

function checkZeroChanges(runs) {
  const issues = [];
  const agentChanges = new Map(); // agentId -> { runs, updatedRuns }

  for (const run of runs) {
    for (const agent of run.agents || []) {
      if (!agentChanges.has(agent.agentId)) {
        agentChanges.set(agent.agentId, { runs: 0, updatedRuns: 0 });
      }
      const entry = agentChanges.get(agent.agentId);
      entry.runs++;
      if (agent.locationsUpdated && agent.locationsUpdated.length > 0) {
        entry.updatedRuns++;
      }
    }
  }

  for (const [agentId, stats] of agentChanges) {
    if (stats.runs >= 3 && stats.updatedRuns === 0) {
      issues.push({
        type: 'zero-changes',
        agentId,
        runs: stats.runs,
        message: `Agent "${agentId}" had zero changes across ${stats.runs} consecutive runs — prompt or sources may need review.`
      });
    }
  }

  return issues;
}

// ── Check schema instability ────────────────────────────────────────

function checkSchemaInstability(runs) {
  const issues = [];
  const agentSchemas = new Map(); // agentId -> Set of field-signature strings

  for (const run of runs) {
    for (const agent of run.agents || []) {
      if (!agentSchemas.has(agent.agentId)) {
        agentSchemas.set(agent.agentId, new Set());
      }
      // Create a simple schema signature from the result keys
      const sig = Object.keys(agent).sort().join(',');
      agentSchemas.get(agent.agentId).add(sig);
    }
  }

  for (const [agentId, schemas] of agentSchemas) {
    if (schemas.size > 2) {
      issues.push({
        type: 'schema-instability',
        agentId,
        variants: schemas.size,
        message: `Agent "${agentId}" produced ${schemas.size} different output schemas across runs — consider tightening prompt constraints.`
      });
    }
  }

  return issues;
}

// ── Update source quality scores ────────────────────────────────────

function updateSourceQuality(stalenessIssues) {
  if (!existsSync(SOURCES_PATH)) return;

  let sourcesData;
  try {
    sourcesData = JSON.parse(readFileSync(SOURCES_PATH, 'utf-8'));
  } catch {
    return;
  }

  const staleSet = new Set(
    stalenessIssues.filter(i => i.type === 'stale').map(i => i.source)
  );

  let changed = false;
  for (const source of sourcesData.sources || []) {
    const id = source.id || source.name;
    if (staleSet.has(id)) {
      const oldQuality = source.quality ?? 1.0;
      // Decay quality by 10% for stale sources
      source.quality = Math.max(0.1, parseFloat((oldQuality * 0.9).toFixed(2)));
      if (source.quality !== oldQuality) changed = true;
    }
  }

  if (changed) {
    mkdirSync(dirname(SOURCES_PATH), { recursive: true });
    writeFileSync(SOURCES_PATH, JSON.stringify(sourcesData, null, 2) + '\n', 'utf-8');
    console.error('[refiner] Updated source quality scores in sources.json');
  }
}

// ── Generate report ─────────────────────────────────────────────────

function generateReport(runs, stalenessIssues, confidenceIssues, zeroChangeIssues, schemaIssues) {
  const runDate = new Date().toISOString().slice(0, 10);
  const allIssues = [...stalenessIssues, ...confidenceIssues, ...zeroChangeIssues, ...schemaIssues];
  const lines = [];

  lines.push(`# Refinement Report — ${runDate}`);
  lines.push('');
  lines.push(`**Runs analyzed**: ${runs.length} (past ${LOOKBACK_DAYS} days)`);
  lines.push(`**Issues found**: ${allIssues.length}`);
  lines.push('');

  // Source staleness
  lines.push('## Source Staleness');
  if (stalenessIssues.length === 0) {
    lines.push('No stale sources detected.');
  } else {
    for (const issue of stalenessIssues) {
      lines.push(`- ${issue.message}`);
    }
  }
  lines.push('');

  // Low confidence
  lines.push('## Low Confidence Agents');
  if (confidenceIssues.length === 0) {
    lines.push('All agents above 70% confidence threshold.');
  } else {
    for (const issue of confidenceIssues) {
      lines.push(`- ${issue.message}`);
      lines.push(`  - **Suggestion**: Review prompt for specificity; check if sources are still valid.`);
    }
  }
  lines.push('');

  // Zero changes
  lines.push('## Zero-Change Agents');
  if (zeroChangeIssues.length === 0) {
    lines.push('All agents producing changes when expected.');
  } else {
    for (const issue of zeroChangeIssues) {
      lines.push(`- ${issue.message}`);
      lines.push(`  - **Suggestion**: Verify sources have updated data; consider expanding source list.`);
    }
  }
  lines.push('');

  // Schema instability
  lines.push('## Schema Instability');
  if (schemaIssues.length === 0) {
    lines.push('Output schemas are stable across runs.');
  } else {
    for (const issue of schemaIssues) {
      lines.push(`- ${issue.message}`);
      lines.push(`  - **Suggestion**: Add explicit JSON schema example to the prompt template.`);
    }
  }
  lines.push('');

  // Run summary table
  if (runs.length > 0) {
    lines.push('## Recent Run Summary');
    lines.push('');
    lines.push('| Date | Agents | Succeeded | Failed | Skipped |');
    lines.push('|------|--------|-----------|--------|---------|');
    for (const run of runs) {
      const s = run.summary || {};
      lines.push(`| ${run.runDate} | ${run.agentCount || 0} | ${s.succeeded || 0} | ${s.failed || 0} | ${s.skipped || 0} |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*This report is auto-generated. Prompt files are NOT modified — only suggestions are provided above.*');
  lines.push('');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  console.error('[refiner] Analyzing recent agent runs...');

  const runs = loadRecentRuns();
  console.error(`[refiner] Found ${runs.length} runs in the past ${LOOKBACK_DAYS} days`);

  const stalenessIssues = checkSourceStaleness();
  const confidenceIssues = checkLowConfidence(runs);
  const zeroChangeIssues = checkZeroChanges(runs);
  const schemaIssues = checkSchemaInstability(runs);

  const totalIssues = stalenessIssues.length + confidenceIssues.length +
    zeroChangeIssues.length + schemaIssues.length;
  console.error(`[refiner] Issues found: ${totalIssues}`);

  // Update source quality scores
  updateSourceQuality(stalenessIssues);

  // Generate and write report
  const report = generateReport(runs, stalenessIssues, confidenceIssues, zeroChangeIssues, schemaIssues);
  const runDate = new Date().toISOString().slice(0, 10);
  const reportPath = resolve(__dirname, `refinement-report-${runDate}.md`);
  writeFileSync(reportPath, report, 'utf-8');
  console.error(`[refiner] Report written: ${reportPath}`);

  // Also print to stdout
  process.stdout.write(report);
}

main();
