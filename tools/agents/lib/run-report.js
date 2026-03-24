/**
 * run-report.js — Generate run reports for agent pipeline executions.
 *
 * Usage:
 *   import { createReport } from './run-report.js';
 *   const { json, markdown } = createReport(results, startTime);
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Create a pipeline run report from collected agent results.
 *
 * @param {object[]} results — Array of per-agent result objects:
 *   { agentId, status, locationsUpdated[], locationsUnchanged[], confidence, duration, errors[], warnings[] }
 * @param {number} startTime — Date.now() timestamp when the pipeline started
 * @returns {{ json: object, markdown: string }}
 */
export function createReport(results, startTime) {
  const endTime = Date.now();
  const totalDuration = ((endTime - startTime) / 1000).toFixed(1);
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
  const runDate = now.toISOString().slice(0, 10);

  const report = {
    runDate,
    timestamp: now.toISOString(),
    totalDurationSec: parseFloat(totalDuration),
    agentCount: results.length,
    summary: {
      succeeded: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      skipped: results.filter(r => r.status === 'skipped').length
    },
    agents: results.map(r => ({
      agentId: r.agentId,
      status: r.status,
      locationsUpdated: r.locationsUpdated || [],
      locationsUnchanged: r.locationsUnchanged || [],
      confidence: r.confidence ?? null,
      durationSec: r.duration ? parseFloat((r.duration / 1000).toFixed(1)) : null,
      errors: r.errors || [],
      warnings: r.warnings || []
    }))
  };

  // Write JSON report
  const historyDir = resolve(PROJECT_ROOT, 'data', 'agents', 'run-history');
  mkdirSync(historyDir, { recursive: true });
  const jsonPath = resolve(historyDir, `${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  console.error(`[run-report] Written: ${jsonPath}`);

  // Generate markdown
  const md = generateMarkdown(report, totalDuration);

  return { json: report, markdown: md };
}

function generateMarkdown(report, totalDuration) {
  const lines = [];
  lines.push(`# Agent Pipeline Run — ${report.runDate}`);
  lines.push('');
  lines.push(`**Total duration**: ${totalDuration}s`);
  lines.push(`**Agents run**: ${report.agentCount} (${report.summary.succeeded} succeeded, ${report.summary.failed} failed, ${report.summary.skipped} skipped)`);
  lines.push('');
  lines.push('## Per-Agent Results');
  lines.push('');
  lines.push('| Agent | Status | Updated | Unchanged | Confidence | Duration | Errors |');
  lines.push('|-------|--------|---------|-----------|------------|----------|--------|');

  for (const a of report.agents) {
    const updated = a.locationsUpdated.length;
    const unchanged = a.locationsUnchanged.length;
    const conf = a.confidence != null ? `${(a.confidence * 100).toFixed(0)}%` : '—';
    const dur = a.durationSec != null ? `${a.durationSec}s` : '—';
    const errs = a.errors.length > 0 ? a.errors.length : '—';
    lines.push(`| ${a.agentId} | ${a.status} | ${updated} | ${unchanged} | ${conf} | ${dur} | ${errs} |`);
  }

  // Errors section
  const agentsWithErrors = report.agents.filter(a => a.errors.length > 0);
  if (agentsWithErrors.length > 0) {
    lines.push('');
    lines.push('## Errors');
    for (const a of agentsWithErrors) {
      lines.push(`\n### ${a.agentId}`);
      for (const err of a.errors) {
        lines.push(`- ${err}`);
      }
    }
  }

  // Warnings section
  const agentsWithWarnings = report.agents.filter(a => a.warnings.length > 0);
  if (agentsWithWarnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const a of agentsWithWarnings) {
      lines.push(`\n### ${a.agentId}`);
      for (const w of a.warnings) {
        lines.push(`- ${w}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}
