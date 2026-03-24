#!/usr/bin/env node
/**
 * AI Compliance Evidence Collection Kit — Evidence Extractor Runner
 * Runs all three extractors against a target repo and merges results
 * into compliance-config.json for autofill.js consumption.
 *
 * Usage: node extract-evidence.js --repo /path/to/repo [--config path/to/config.json] [--days 365]
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS_DIR = __dirname;
const EXTRACTORS_DIR = path.join(TOOLS_DIR, 'extractors');

function runExtractor(scriptPath, repoPath, extraArgs) {
  const args = [scriptPath, '--repo', repoPath].concat(extraArgs);
  return execFileSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function main() {
  const args = process.argv.slice(2);
  let repoPath = process.cwd();
  let configPath = path.join(TOOLS_DIR, 'compliance-config.json');
  let days = 365;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) repoPath = path.resolve(args[i + 1]);
    if (args[i] === '--config' && args[i + 1]) configPath = path.resolve(args[i + 1]);
    if (args[i] === '--days' && args[i + 1]) days = parseInt(args[i + 1], 10);
    if (args[i] === '--help') {
      console.log('Usage: node extract-evidence.js --repo <path> [--config <path>] [--days <N>]');
      console.log('  --repo     Target repository path (default: cwd)');
      console.log('  --config   Config file to merge into (default: tools/compliance-config.json)');
      console.log('  --days     Days of git history to analyze (default: 365)');
      process.exit(0);
    }
  }

  console.log('Extracting compliance evidence from: ' + repoPath);
  console.log('Config file: ' + configPath);
  console.log('History: ' + days + ' days\n');

  // Load existing config or create minimal one
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Loaded existing config.\n');
  } else {
    console.log('No existing config found. Creating new one.\n');
  }

  config.extractedEvidence = config.extractedEvidence || {};

  // Run each extractor
  const extractors = [
    { name: 'git-evidence', file: 'git-evidence.cjs', extraArgs: ['--days', String(days)] },
    { name: 'package-evidence', file: 'package-evidence.cjs', extraArgs: [] },
    { name: 'ci-evidence', file: 'ci-evidence.cjs', extraArgs: [] }
  ];

  for (const ext of extractors) {
    const script = path.join(EXTRACTORS_DIR, ext.file);
    if (!fs.existsSync(script)) {
      console.log('  SKIP ' + ext.name + ' -- ' + ext.file + ' not found');
      continue;
    }

    console.log('  Running ' + ext.name + '...');
    try {
      const output = runExtractor(script, repoPath, ext.extraArgs);
      const result = JSON.parse(output);
      config.extractedEvidence[ext.name] = result;
      console.log('  OK ' + ext.name);

      // Merge autoFillFields into top-level config
      if (result.autoFillFields) {
        config.extractedAutoFill = config.extractedAutoFill || {};
        Object.assign(config.extractedAutoFill, result.autoFillFields);
      }
    } catch (err) {
      var msg = err.message ? err.message.split('\n')[0] : String(err);
      console.error('  FAIL ' + ext.name + ': ' + msg);
      config.extractedEvidence[ext.name] = { error: msg };
    }
  }

  // Write summary
  config.extractedEvidence._meta = {
    extractedAt: new Date().toISOString(),
    repoPath: repoPath,
    daysCovered: days
  };

  // Save updated config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('\nEvidence extracted and saved to: ' + configPath);

  // Print summary
  var ge = config.extractedEvidence['git-evidence'] || {};
  var pe = config.extractedEvidence['package-evidence'] || {};
  var ce = config.extractedEvidence['ci-evidence'] || {};

  console.log('\n--- Evidence Summary ---');
  if (ge.codeReview) {
    console.log('  Git: ' + ge.codeReview.totalCommits + ' commits, ' + ge.codeReview.mergePercentage + '% via PR');
  }
  if (ge.aiCodeGeneration) {
    console.log('  AI attribution: ' + ge.aiCodeGeneration.aiAttributedCommits + ' commits (' + ge.aiCodeGeneration.aiAttributionPercentage + '%)');
    if (ge.aiCodeGeneration.aiToolsDetected && ge.aiCodeGeneration.aiToolsDetected.length) {
      console.log('  AI tools: ' + ge.aiCodeGeneration.aiToolsDetected.map(function(t) { return t.tool; }).join(', '));
    }
  }
  if (pe.inventory) {
    console.log('  Packages: ' + pe.inventory.directDependencies + ' direct, ' + pe.inventory.transitiveDependencies + ' transitive');
  }
  if (pe.licenses) {
    var copyleft = (pe.licenses.copyleftPackages || []).length;
    if (copyleft > 0) console.log('  LICENSE WARNING: ' + copyleft + ' copyleft package(s) detected');
  }
  if (pe.vulnerabilities && pe.vulnerabilities.auditResults) {
    var v = pe.vulnerabilities.auditResults;
    if (v.critical + v.high > 0) {
      console.log('  VULN WARNING: ' + v.critical + ' critical, ' + v.high + ' high vulnerabilities');
    }
  }
  if (ce.securityScanning) {
    var cats = ['sast', 'dast', 'dependencyScanning', 'containerScanning', 'secretScanning', 'licenseScanning', 'sbomGeneration'];
    var covered = cats.filter(function(c) { return ce.securityScanning[c] && ce.securityScanning[c].detected; }).length;
    console.log('  CI security: ' + covered + '/' + cats.length + ' scanning categories covered');
  }
  if (ce.buildProvenance) {
    console.log('  SLSA level: L' + ce.buildProvenance.estimatedSlsaLevel);
  }

  console.log('\nRun `node autofill.js` to apply this evidence to templates.');
}

main();
