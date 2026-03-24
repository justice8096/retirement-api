#!/usr/bin/env node
/**
 * CI/CD Pipeline Compliance Evidence Extractor
 *
 * Extracts compliance-relevant evidence from CI/CD pipeline configuration files
 * found in any git repository. Supports GitHub Actions, GitLab CI, Azure DevOps,
 * Bitbucket Pipelines, CircleCI, Jenkins, and Travis CI.
 *
 * Zero external dependencies — uses only Node.js built-ins.
 *
 * Usage:
 *   node ci-evidence.js [--repo <path>] [--output <path>]
 *
 * Serves as evidence for:
 *   T06  Testing & Validation
 *   T09  Human Oversight
 *   T12  Governance
 *   T15  Security
 *   T23  SLSA / Supply-chain (sections 8.1, 8.2, 8.3)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { repo: process.cwd(), output: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--repo' && argv[i + 1]) {
      args.repo = path.resolve(argv[++i]);
    } else if (argv[i] === '--output' && argv[i + 1]) {
      args.output = path.resolve(argv[++i]);
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      process.stderr.write(
        'Usage: node ci-evidence.js [--repo <path>] [--output <path>]\n' +
        '  --repo    Path to git repository (default: current directory)\n' +
        '  --output  Write JSON to file instead of stdout\n'
      );
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write('[ci-evidence] ' + msg + '\n');
}

function existsSync(p) {
  try { fs.statSync(p); return true; } catch (e) { return false; }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (e) { return false; }
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

/** List files under a directory, optionally filtered by extension. */
function listFiles(dir, opts) {
  var results = [];
  if (!isDir(dir)) return results;
  var recursive = opts && opts.recursive;
  var ext = opts && opts.ext;
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var full = path.join(dir, e.name);
    if (e.isFile()) {
      if (!ext || (Array.isArray(ext) && ext.some(function(x) { return e.name.endsWith(x); })) || (typeof ext === 'string' && e.name.endsWith(ext))) {
        results.push(full);
      }
    } else if (e.isDirectory() && recursive) {
      results = results.concat(listFiles(full, opts));
    }
  }
  return results;
}

/** Case-insensitive search for a keyword in text. */
function has(text, keyword) {
  return text.toLowerCase().indexOf(keyword.toLowerCase()) !== -1;
}

/** Return all matched keywords from a list that appear in text (case-insensitive). */
function findAll(text, keywords) {
  var lower = text.toLowerCase();
  return keywords.filter(function(k) { return lower.indexOf(k.toLowerCase()) !== -1; });
}

// ---------------------------------------------------------------------------
// CI system discovery
// ---------------------------------------------------------------------------

var CI_SYSTEMS = {
  'github-actions': {
    detect: function(repo) {
      return isDir(path.join(repo, '.github', 'workflows'));
    },
    files: function(repo) {
      return listFiles(path.join(repo, '.github', 'workflows'), { ext: ['.yml', '.yaml'] });
    }
  },
  'gitlab-ci': {
    detect: function(repo) { return existsSync(path.join(repo, '.gitlab-ci.yml')); },
    files: function(repo) { return [path.join(repo, '.gitlab-ci.yml')]; }
  },
  'azure-devops': {
    detect: function(repo) { return existsSync(path.join(repo, 'azure-pipelines.yml')); },
    files: function(repo) { return [path.join(repo, 'azure-pipelines.yml')]; }
  },
  'bitbucket-pipelines': {
    detect: function(repo) { return existsSync(path.join(repo, 'bitbucket-pipelines.yml')); },
    files: function(repo) { return [path.join(repo, 'bitbucket-pipelines.yml')]; }
  },
  'circleci': {
    detect: function(repo) { return existsSync(path.join(repo, '.circleci', 'config.yml')); },
    files: function(repo) { return [path.join(repo, '.circleci', 'config.yml')]; }
  },
  'jenkins': {
    detect: function(repo) { return existsSync(path.join(repo, 'Jenkinsfile')); },
    files: function(repo) { return [path.join(repo, 'Jenkinsfile')]; }
  },
  'travis-ci': {
    detect: function(repo) { return existsSync(path.join(repo, '.travis.yml')); },
    files: function(repo) { return [path.join(repo, '.travis.yml')]; }
  }
};

function discoverCISystems(repo) {
  var detected = [];
  var names = Object.keys(CI_SYSTEMS);
  for (var i = 0; i < names.length; i++) {
    if (CI_SYSTEMS[names[i]].detect(repo)) detected.push(names[i]);
  }
  return detected;
}

function gatherCIFiles(repo, systems) {
  var all = [];
  for (var i = 0; i < systems.length; i++) {
    var name = systems[i];
    var sys = CI_SYSTEMS[name];
    if (!sys) continue;
    var files = sys.files(repo).filter(function(f) { return existsSync(f); });
    for (var j = 0; j < files.length; j++) {
      all.push({ system: name, file: files[j], relPath: path.relative(repo, files[j]) });
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Security scanning detection  (T15, T23 s8.2)
// ---------------------------------------------------------------------------

var SECURITY_TOOLS = {
  sast: ['codeql', 'semgrep', 'bandit', 'sonarqube', 'sonar-scanner',
         'eslint-plugin-security', 'brakeman', 'gosec', 'clippy'],
  dast: ['zap', 'burp', 'nuclei', 'nikto'],
  dependencyScanning: ['npm audit', 'pip audit', 'cargo audit', 'snyk',
                        'dependabot', 'renovate', 'safety'],
  containerScanning: ['trivy', 'grype', 'clair', 'docker scout'],
  secretScanning: ['gitleaks', 'trufflehog', 'gitguardian', 'detect-secrets'],
  licenseScanning: ['fossa', 'license-checker', 'licensee', 'scancode'],
  sbomGeneration: ['cyclonedx', 'spdx', 'syft', 'sbom']
};

function detectSecurityScanning(ciFiles, repo) {
  // Combine all CI file contents
  var combined = ciFiles.map(function(f) { return readText(f.file) || ''; }).join('\n');

  // Also check for Dependabot / Renovate config files that live outside CI
  var extraFiles = [
    '.github/dependabot.yml',
    '.github/dependabot.yaml',
    'renovate.json',
    'renovate.json5',
    '.renovaterc',
    '.renovaterc.json'
  ];
  var extraContent = '';
  var extraDetected = [];
  for (var i = 0; i < extraFiles.length; i++) {
    var full = path.join(repo, extraFiles[i]);
    if (existsSync(full)) {
      extraContent += (readText(full) || '') + '\n';
      extraDetected.push(extraFiles[i]);
    }
  }

  var allText = combined + '\n' + extraContent;
  var result = {};

  var categories = Object.keys(SECURITY_TOOLS);
  for (var c = 0; c < categories.length; c++) {
    var category = categories[c];
    var tools = SECURITY_TOOLS[category];
    var found = findAll(allText, tools);

    // Track which CI files mention each tool
    var matchedFiles = [];
    for (var j = 0; j < ciFiles.length; j++) {
      var content = readText(ciFiles[j].file) || '';
      if (tools.some(function(t) { return has(content, t); })) {
        matchedFiles.push(ciFiles[j].relPath);
      }
    }
    // Also check extra config files
    for (var k = 0; k < extraDetected.length; k++) {
      var econtent = readText(path.join(repo, extraDetected[k])) || '';
      if (tools.some(function(t) { return has(econtent, t); })) {
        matchedFiles.push(extraDetected[k]);
      }
    }
    result[category] = {
      detected: found.length > 0,
      tools: arrayUnique(found),
      files: arrayUnique(matchedFiles)
    };
  }

  return result;
}

function arrayUnique(arr) {
  var seen = {};
  return arr.filter(function(item) {
    if (seen[item]) return false;
    seen[item] = true;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Test evidence  (T06)
// ---------------------------------------------------------------------------

var TEST_RUNNERS = [
  'jest', 'pytest', 'go test', 'cargo test', 'phpunit',
  'rspec', 'mocha', 'vitest', 'playwright', 'cypress'
];

var COVERAGE_TOOLS = [
  'coverage', 'codecov', 'coveralls', 'istanbul', 'c8', 'jacoco'
];

function detectTesting(ciFiles) {
  var combined = ciFiles.map(function(f) { return readText(f.file) || ''; }).join('\n');

  var testRunners = arrayUnique(findAll(combined, TEST_RUNNERS));
  var coverageTools = arrayUnique(findAll(combined, COVERAGE_TOOLS));

  // Count test-related jobs/steps
  var testJobCount = 0;
  var testNamePattern = /(?:^|\n)\s*[-]?\s*(?:name|stage|step)\s*:\s*[^\n]*\btest/gi;
  var runTestPattern = /(?:run|script|command)\s*:\s*[^\n]*\b(?:test|spec|check)\b/gi;
  for (var i = 0; i < ciFiles.length; i++) {
    var content = readText(ciFiles[i].file) || '';
    var nameMatches = content.match(testNamePattern) || [];
    var runMatches = content.match(runTestPattern) || [];
    testJobCount += nameMatches.length + runMatches.length;
  }

  // Detect if tests are required for PR merge
  var testsRequiredForMerge = false;

  return {
    testRunners: testRunners,
    coverageTools: coverageTools,
    testJobCount: testJobCount,
    testsRequiredForMerge: testsRequiredForMerge
  };
}

// ---------------------------------------------------------------------------
// Build provenance  (T23 s8.3)
// ---------------------------------------------------------------------------

var ATTESTATION_TOOLS = [
  'sigstore', 'cosign', 'slsa-verifier', 'slsa-generator',
  'provenance', 'attestation'
];

var PUBLISH_PATTERNS = ['npm publish', 'docker push', 'twine upload'];

function hasBuildSteps(text) {
  var buildKeywords = [
    'build', 'compile', 'make', 'npm run build', 'cargo build',
    'go build', 'mvn package', 'gradle build', 'docker build'
  ];
  return buildKeywords.some(function(k) { return has(text, k); });
}

function detectBuildProvenance(ciFiles) {
  var combined = ciFiles.map(function(f) { return readText(f.file) || ''; }).join('\n');

  var signingTools = arrayUnique(findAll(combined, ATTESTATION_TOOLS));
  var hasAttestation = signingTools.length > 0;
  var hasPublish = PUBLISH_PATTERNS.some(function(p) { return has(combined, p); });

  // Detect runner types
  var hostedRunners = false;
  var selfHostedRunners = false;

  for (var i = 0; i < ciFiles.length; i++) {
    var content = readText(ciFiles[i].file) || '';
    // GitHub Actions: runs-on: ubuntu-latest, windows-latest, macos-latest, etc.
    if (/runs-on\s*:\s*(?:ubuntu|windows|macos|buildjet)/i.test(content)) {
      hostedRunners = true;
    }
    if (/runs-on\s*:\s*self-hosted/i.test(content)) {
      selfHostedRunners = true;
    }
    // For non-GitHub systems, assume hosted if we detect the CI system
    if (ciFiles[i].system !== 'github-actions') {
      hostedRunners = true;
    }
  }

  // If we have CI files but couldn't determine runner type, default to hosted
  if (ciFiles.length > 0 && !hostedRunners && !selfHostedRunners) {
    hostedRunners = true;
  }

  // SLSA level estimation
  var estimatedSlsaLevel = 0;
  var slsaEvidence = '';

  if (ciFiles.length === 0) {
    slsaEvidence = 'No CI/CD configuration detected';
  } else if (hasAttestation && hostedRunners) {
    estimatedSlsaLevel = 3;
    slsaEvidence = 'Hosted CI with signing/attestation (' + signingTools.join(', ') + ')';
  } else if (hostedRunners && (hasPublish || hasBuildSteps(combined))) {
    estimatedSlsaLevel = 2;
    slsaEvidence = 'Hosted CI with artifact outputs';
    if (!hasAttestation) slsaEvidence += '; no attestation detected';
  } else {
    estimatedSlsaLevel = 1;
    slsaEvidence = 'CI exists with build steps; no attestation detected';
  }

  return {
    hasAttestation: hasAttestation,
    signingTools: signingTools,
    hostedRunners: hostedRunners,
    selfHostedRunners: selfHostedRunners,
    estimatedSlsaLevel: estimatedSlsaLevel,
    slsaEvidence: slsaEvidence
  };
}

// ---------------------------------------------------------------------------
// Code review enforcement  (T09, T12)
// ---------------------------------------------------------------------------

function detectCodeReview(ciFiles, repo) {
  var branchProtectionConfig = false;
  var requiredReviewers = 0;
  var prOnlyMerge = false;

  // Check for branch protection config files
  var protectionFiles = [
    '.github/settings.yml',
    '.github/settings.yaml',
    '.github/branch-protection.yml'
  ];

  for (var i = 0; i < protectionFiles.length; i++) {
    var full = path.join(repo, protectionFiles[i]);
    if (existsSync(full)) {
      branchProtectionConfig = true;
      var content = readText(full) || '';

      var reviewMatch = content.match(/required_approving_review_count\s*:\s*(\d+)/i);
      if (reviewMatch) {
        requiredReviewers = Math.max(requiredReviewers, parseInt(reviewMatch[1], 10));
      }
      if (has(content, 'required_pull_request_reviews') || has(content, 'require_pull_request')) {
        prOnlyMerge = true;
      }
    }
  }

  // Check workflow files for review-gated conditions
  for (var j = 0; j < ciFiles.length; j++) {
    var wcontent = readText(ciFiles[j].file) || '';
    if (has(wcontent, "review.state == 'approved'") || has(wcontent, 'review.state == "approved"')) {
      prOnlyMerge = true;
    }
    if (has(wcontent, 'required_reviewers') || has(wcontent, 'required-reviewers')) {
      branchProtectionConfig = true;
    }
  }

  return {
    branchProtectionConfig: branchProtectionConfig,
    requiredReviewers: requiredReviewers,
    prOnlyMerge: prOnlyMerge
  };
}

// ---------------------------------------------------------------------------
// Deployment controls  (T12)
// ---------------------------------------------------------------------------

function detectDeploymentControls(ciFiles) {
  var environments = {};
  var hasManualApproval = false;

  var envNames = ['staging', 'production', 'prod', 'stage', 'dev', 'development',
                  'qa', 'uat', 'preprod', 'pre-prod', 'canary'];

  for (var i = 0; i < ciFiles.length; i++) {
    var content = readText(ciFiles[i].file) || '';

    // Detect environment declarations
    var envPatternInline = /environment\s*:\s*(\S+)/gi;
    var m;
    while ((m = envPatternInline.exec(content)) !== null) {
      var env = m[1].replace(/['"]/g, '').toLowerCase();
      if (envNames.indexOf(env) !== -1) environments[env] = true;
    }

    // Generic: detect environment names mentioned in the file
    for (var n = 0; n < envNames.length; n++) {
      if (has(content, envNames[n])) environments[envNames[n]] = true;
    }

    // Manual approval gates
    if (has(content, 'required_reviewers') || has(content, 'required-reviewers')) {
      hasManualApproval = true;
    }
    // GitLab: when: manual
    if (/when\s*:\s*manual/i.test(content)) {
      hasManualApproval = true;
    }
    // Azure DevOps / generic: approval
    if (has(content, 'manual approval') || has(content, 'approvalRequired')) {
      hasManualApproval = true;
    }
  }

  var envList = Object.keys(environments);
  var hasStagingEnvironment = envList.some(function(e) {
    return e === 'staging' || e === 'stage' || e === 'uat' || e === 'preprod' || e === 'pre-prod';
  });
  var hasProductionEnvironment = envList.some(function(e) {
    return e === 'production' || e === 'prod';
  });

  return {
    environments: envList,
    hasManualApproval: hasManualApproval,
    hasStagingEnvironment: hasStagingEnvironment,
    hasProductionEnvironment: hasProductionEnvironment
  };
}

// ---------------------------------------------------------------------------
// AI code assistant controls  (T23 s8.1)
// ---------------------------------------------------------------------------

function detectAiCodeControls(ciFiles, repo) {
  var aiInstructionPatterns = [
    '.cursorrules',
    '.github/copilot-instructions.md',
    '.aider.conf.yml',
    '.continue/config.json',
    'CLAUDE.md',
    '.claude/settings.json'
  ];

  var aiInstructionFiles = [];
  for (var i = 0; i < aiInstructionPatterns.length; i++) {
    if (existsSync(path.join(repo, aiInstructionPatterns[i]))) {
      aiInstructionFiles.push(aiInstructionPatterns[i]);
    }
  }

  // Pre-commit hooks
  var preCommitConfigs = [
    '.pre-commit-config.yaml',
    '.husky/_/husky.sh',
    '.husky/pre-commit'
  ];
  var preCommitTools = [];
  var hasPreCommitHooks = false;

  for (var j = 0; j < preCommitConfigs.length; j++) {
    if (existsSync(path.join(repo, preCommitConfigs[j]))) {
      hasPreCommitHooks = true;
      if (preCommitConfigs[j].indexOf('.husky') === 0) {
        if (preCommitTools.indexOf('husky') === -1) preCommitTools.push('husky');
      } else {
        if (preCommitTools.indexOf('pre-commit') === -1) preCommitTools.push('pre-commit');
      }
    }
  }
  // Also check .husky directory existence
  if (isDir(path.join(repo, '.husky'))) {
    hasPreCommitHooks = true;
    if (preCommitTools.indexOf('husky') === -1) preCommitTools.push('husky');
  }

  // Detect if SAST runs on PRs (post-generation scanning control)
  var sastOnPRs = false;
  var sastTools = SECURITY_TOOLS.sast;
  for (var k = 0; k < ciFiles.length; k++) {
    var content = readText(ciFiles[k].file) || '';
    var hasPR = has(content, 'pull_request') || has(content, 'merge_request');
    var hasSAST = sastTools.some(function(t) { return has(content, t); });
    if (hasPR && hasSAST) {
      sastOnPRs = true;
      break;
    }
  }

  return {
    hasAiInstructionFiles: aiInstructionFiles.length > 0,
    aiInstructionFiles: aiInstructionFiles,
    hasPreCommitHooks: hasPreCommitHooks,
    preCommitTools: preCommitTools,
    sastOnPRs: sastOnPRs
  };
}

// ---------------------------------------------------------------------------
// Auto-fill fields computation
// ---------------------------------------------------------------------------

function computeAutoFillFields(security, testing, provenance, review, deployment, aiControls) {
  // Security scanning coverage: count how many of 7 categories are covered
  var categories = Object.keys(security);
  var coveredCount = 0;
  for (var i = 0; i < categories.length; i++) {
    if (security[categories[i]].detected) coveredCount++;
  }
  var totalCategories = categories.length;

  var securityCoverageLevel;
  if (coveredCount === 0) securityCoverageLevel = 'none';
  else if (coveredCount <= 2) securityCoverageLevel = 'basic';
  else if (coveredCount <= 4) securityCoverageLevel = 'moderate';
  else if (coveredCount <= 6) securityCoverageLevel = 'good';
  else securityCoverageLevel = 'comprehensive';

  // Testing maturity
  var testingMaturity;
  if (testing.testRunners.length === 0) {
    testingMaturity = 'no-tests';
  } else if (testing.coverageTools.length > 0 && testing.testRunners.length >= 2) {
    testingMaturity = 'comprehensive';
  } else {
    testingMaturity = 'basic';
  }

  // AI code gen controls
  var aiCodeGenControlsInPlace =
    aiControls.hasAiInstructionFiles ||
    aiControls.hasPreCommitHooks ||
    aiControls.sastOnPRs;

  return {
    securityScanningCoverage: coveredCount + '/' + totalCategories + ' categories',
    securityCoverageLevel: securityCoverageLevel,
    testingMaturity: testingMaturity,
    slsaComplianceLevel: 'L' + provenance.estimatedSlsaLevel,
    aiCodeGenControlsInPlace: aiCodeGenControlsInPlace,
    codeReviewEnforced: review.branchProtectionConfig || review.prOnlyMerge,
    deploymentGatesExist: deployment.hasManualApproval || (deployment.hasStagingEnvironment && deployment.hasProductionEnvironment)
  };
}

// ---------------------------------------------------------------------------
// Refine tests-required-for-merge with review data
// ---------------------------------------------------------------------------

function refineTestsRequiredForMerge(testing, review, ciFiles) {
  if (review.branchProtectionConfig && testing.testRunners.length > 0) {
    testing.testsRequiredForMerge = true;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  var args = parseArgs(process.argv);
  var repo = args.repo;

  log('Scanning repository: ' + repo);

  if (!isDir(repo)) {
    process.stderr.write('Error: ' + repo + ' is not a directory\n');
    process.exit(1);
  }

  // 1. Discover CI systems
  log('Discovering CI/CD systems...');
  var ciSystems = discoverCISystems(repo);
  if (ciSystems.length === 0) {
    log('No CI/CD configuration files detected.');
  } else {
    log('Found CI systems: ' + ciSystems.join(', '));
  }

  // 2. Gather all CI config files
  var ciFiles = gatherCIFiles(repo, ciSystems);
  log('Found ' + ciFiles.length + ' CI configuration file(s)');
  for (var i = 0; i < ciFiles.length; i++) {
    log('  ' + ciFiles[i].system + ': ' + ciFiles[i].relPath);
  }

  // 3. Extract evidence
  log('Analyzing security scanning controls...');
  var securityScanning = detectSecurityScanning(ciFiles, repo);

  log('Analyzing test evidence...');
  var testing = detectTesting(ciFiles);

  log('Analyzing build provenance...');
  var buildProvenance = detectBuildProvenance(ciFiles);

  log('Analyzing code review enforcement...');
  var codeReviewEnforcement = detectCodeReview(ciFiles, repo);

  // Refine tests-required-for-merge with review info
  refineTestsRequiredForMerge(testing, codeReviewEnforcement, ciFiles);

  log('Analyzing deployment controls...');
  var deploymentControls = detectDeploymentControls(ciFiles);

  log('Analyzing AI code assistant controls...');
  var aiCodeControls = detectAiCodeControls(ciFiles, repo);

  // 4. Compute auto-fill fields
  log('Computing auto-fill fields...');
  var autoFillFields = computeAutoFillFields(
    securityScanning, testing, buildProvenance,
    codeReviewEnforcement, deploymentControls, aiCodeControls
  );

  // 5. Build output
  var output = {
    _meta: {
      extractor: 'ci-evidence',
      version: '1.0.0',
      extractedAt: new Date().toISOString(),
      repoPath: repo,
      ciSystems: ciSystems
    },
    securityScanning: securityScanning,
    testing: testing,
    buildProvenance: buildProvenance,
    codeReviewEnforcement: codeReviewEnforcement,
    deploymentControls: deploymentControls,
    aiCodeControls: aiCodeControls,
    autoFillFields: autoFillFields
  };

  var json = JSON.stringify(output, null, 2);

  if (args.output) {
    var outDir = path.dirname(args.output);
    if (!isDir(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(args.output, json + '\n', 'utf8');
    log('Evidence written to: ' + args.output);
  } else {
    process.stdout.write(json + '\n');
  }

  log('Done.');
}

main();
