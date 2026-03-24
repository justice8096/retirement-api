#!/usr/bin/env node
/**
 * Git Evidence Extractor for AI Compliance Evidence Collection Kit
 *
 * Extracts compliance-relevant evidence from a git repository's history
 * and outputs JSON compatible with the compliance-config structure used
 * by autofill.js.
 *
 * Zero external dependencies — uses only Node.js built-ins and git CLI.
 *
 * Usage:
 *   node git-evidence.js [--repo <path>] [--output <path>] [--days <N>]
 *
 * Options:
 *   --repo <path>    Path to git repository (default: current directory)
 *   --output <path>  Output file path (default: stdout)
 *   --days <N>       Number of days of history to scan (default: 365)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(`[git-evidence] ${msg}\n`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { repo: process.cwd(), output: null, days: 365 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) {
      opts.repo = path.resolve(args[++i]);
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = path.resolve(args[++i]);
    } else if (args[i] === '--days' && args[i + 1]) {
      opts.days = parseInt(args[++i], 10) || 365;
    }
  }
  return opts;
}

/**
 * Run a git command in the given repository.
 *
 * Note: execSync is used intentionally here. All command strings are
 * constructed from hardcoded git sub-commands and the --repo path which
 * is supplied by the same user running this script. There is no
 * untrusted / remote input interpolated into the shell string.
 */
function git(cmd, repoPath) {
  return execSync(`git -C "${repoPath}" ${cmd}`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
}

function gitLines(cmd, repoPath) {
  const out = git(cmd, repoPath);
  if (!out) return [];
  return out.split('\n').filter(Boolean);
}

function sinceArg(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `--since="${d.toISOString().split('T')[0]}"`;
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function dirExists(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Evidence extraction functions
// ---------------------------------------------------------------------------

function extractCodeReview(repoPath, since) {
  log('Extracting code review evidence...');
  const result = {
    totalCommits: 0,
    mergeCommits: 0,
    mergePercentage: 0,
    reviewedCommits: 0,
    uniqueReviewers: [],
    prBasedWorkflow: false
  };

  try {
    // Total commits in period
    const allHashes = gitLines(`log ${since} --format=%H`, repoPath);
    result.totalCommits = allHashes.length;

    if (result.totalCommits === 0) return result;

    // Merge commits
    const mergeHashes = gitLines(`log ${since} --merges --format=%H`, repoPath);
    result.mergeCommits = mergeHashes.length;
    result.mergePercentage = Math.round((result.mergeCommits / result.totalCommits) * 100);

    // Reviewed commits — look for trailers
    const trailerPatterns = [
      /Approved-by:\s*(.+)/i,
      /Reviewed-by:\s*(.+)/i,
      /Acked-by:\s*(.+)/i
    ];
    const reviewers = new Set();
    let reviewedCount = 0;

    // Get full commit messages for trailer scanning
    const commitMessages = git(
      `log ${since} --format=COMMIT_SEP%n%B`,
      repoPath
    ).split('COMMIT_SEP\n').filter(Boolean);

    for (const msg of commitMessages) {
      let hasReview = false;
      for (const pattern of trailerPatterns) {
        const matches = msg.match(new RegExp(pattern.source, 'gim'));
        if (matches) {
          hasReview = true;
          for (const m of matches) {
            const match = m.match(pattern);
            if (match && match[1]) {
              reviewers.add(match[1].trim());
            }
          }
        }
      }
      if (hasReview) reviewedCount++;
    }

    result.reviewedCommits = reviewedCount;
    result.uniqueReviewers = [...reviewers];

    // PR-based workflow heuristic: >80% merge commits on the default branch
    result.prBasedWorkflow = result.mergePercentage > 80;
  } catch (e) {
    log(`  Warning: code review extraction partially failed: ${e.message}`);
  }

  return result;
}

function extractChangeManagement(repoPath, since, days) {
  log('Extracting change management evidence...');
  const result = {
    commitFrequency: { daily: 0, weekly: 0, monthly: 0 },
    releaseTags: [],
    releaseFrequencyDays: 0,
    conventionalCommits: { feat: 0, fix: 0, chore: 0, docs: 0, refactor: 0, test: 0, other: 0 },
    conventionalCommitPercentage: 0,
    hasChangelog: false,
    changelogLastUpdate: ''
  };

  try {
    // Commit frequency
    const totalCommits = gitLines(`log ${since} --format=%H`, repoPath).length;
    const weeksInPeriod = Math.max(1, Math.ceil(days / 7));
    const monthsInPeriod = Math.max(1, Math.ceil(days / 30));
    result.commitFrequency.daily = parseFloat((totalCommits / Math.max(1, days)).toFixed(2));
    result.commitFrequency.weekly = parseFloat((totalCommits / weeksInPeriod).toFixed(2));
    result.commitFrequency.monthly = parseFloat((totalCommits / monthsInPeriod).toFixed(2));
  } catch (e) {
    log(`  Warning: commit frequency extraction failed: ${e.message}`);
  }

  try {
    // Release tags with dates
    const tagLines = gitLines(
      `tag -l --sort=-creatordate --format="%(refname:short)|||%(creatordate:iso-strict)|||%(objectname:short)"`,
      repoPath
    );
    for (const line of tagLines) {
      const parts = line.split('|||');
      if (parts.length >= 3) {
        const tagDate = parts[1] ? parts[1].split('T')[0] : '';
        result.releaseTags.push({
          tag: parts[0],
          date: tagDate,
          commitHash: parts[2]
        });
      }
    }

    // Release frequency
    if (result.releaseTags.length >= 2) {
      const dates = result.releaseTags
        .map(t => t.date)
        .filter(Boolean)
        .map(d => new Date(d).getTime())
        .sort((a, b) => a - b);

      if (dates.length >= 2) {
        let totalInterval = 0;
        for (let i = 1; i < dates.length; i++) {
          totalInterval += dates[i] - dates[i - 1];
        }
        result.releaseFrequencyDays = Math.round(
          totalInterval / (dates.length - 1) / (1000 * 60 * 60 * 24)
        );
      }
    }
  } catch (e) {
    log(`  Warning: release tag extraction failed: ${e.message}`);
  }

  try {
    // Conventional commits analysis
    const subjects = gitLines(`log ${since} --format=%s`, repoPath);
    const conventionalRe = /^(feat|fix|chore|docs|refactor|test|ci|perf|style|build|revert)(\(.+?\))?[!]?:/i;
    let conventionalCount = 0;

    for (const subj of subjects) {
      const match = subj.match(conventionalRe);
      if (match) {
        conventionalCount++;
        const type = match[1].toLowerCase();
        if (type in result.conventionalCommits) {
          result.conventionalCommits[type]++;
        } else {
          result.conventionalCommits.other++;
        }
      } else {
        result.conventionalCommits.other++;
      }
    }

    result.conventionalCommitPercentage = subjects.length > 0
      ? Math.round((conventionalCount / subjects.length) * 100)
      : 0;
  } catch (e) {
    log(`  Warning: conventional commits analysis failed: ${e.message}`);
  }

  try {
    // Changelog presence
    const changelogNames = ['CHANGELOG.md', 'CHANGELOG', 'changelog.md', 'CHANGES.md', 'HISTORY.md'];
    for (const name of changelogNames) {
      const changelogPath = path.join(repoPath, name);
      if (fileExists(changelogPath)) {
        result.hasChangelog = true;
        const stat = fs.statSync(changelogPath);
        result.changelogLastUpdate = stat.mtime.toISOString().split('T')[0];
        break;
      }
    }
  } catch (e) {
    log(`  Warning: changelog detection failed: ${e.message}`);
  }

  return result;
}

function extractAiCodeGeneration(repoPath, since) {
  log('Extracting AI code generation attribution...');
  const result = {
    aiAttributedCommits: 0,
    aiAttributionPercentage: 0,
    aiToolsDetected: [],
    topAiModifiedFiles: []
  };

  try {
    // AI-related co-author patterns
    const aiPatterns = [
      { pattern: /Co-authored-by:\s*.*\bclaude\b/i, tool: 'Claude' },
      { pattern: /Co-authored-by:\s*.*\bcopilot\b/i, tool: 'GitHub Copilot' },
      { pattern: /Co-authored-by:\s*.*\bgpt\b/i, tool: 'ChatGPT' },
      { pattern: /Co-authored-by:\s*.*\bgemini\b/i, tool: 'Gemini' },
      { pattern: /Co-authored-by:\s*.*\bcodewhisperer\b/i, tool: 'Amazon CodeWhisperer' },
      { pattern: /Co-authored-by:\s*.*\bcursor\b/i, tool: 'Cursor' },
      { pattern: /Co-authored-by:\s*.*\btabnine\b/i, tool: 'Tabnine' },
      { pattern: /Co-authored-by:\s*.*\banthrop/i, tool: 'Claude' },
      { pattern: /Co-authored-by:\s*.*\bopenai\b/i, tool: 'ChatGPT' },
      { pattern: /Co-authored-by:\s*.*\bdeepseek\b/i, tool: 'DeepSeek' },
      { pattern: /Co-authored-by:\s*.*\bmistral\b/i, tool: 'Mistral' },
      { pattern: /Co-authored-by:\s*.*noreply@anthropic\.com/i, tool: 'Claude' },
      { pattern: /Co-authored-by:\s*.*noreply@github\.com.*copilot/i, tool: 'GitHub Copilot' }
    ];

    const toolCounts = {};
    const aiCommitHashes = [];

    // Get commit messages with hashes
    const commitData = git(
      `log ${since} --format=COMMIT_START%n%H%n%B`,
      repoPath
    ).split('COMMIT_START\n').filter(Boolean);

    const totalCommits = commitData.length;

    for (const block of commitData) {
      const lines = block.split('\n');
      const hash = lines[0];
      const body = lines.slice(1).join('\n');

      let isAi = false;
      for (const { pattern, tool } of aiPatterns) {
        if (pattern.test(body)) {
          isAi = true;
          toolCounts[tool] = (toolCounts[tool] || 0) + 1;
        }
      }

      if (isAi) {
        aiCommitHashes.push(hash);
      }
    }

    result.aiAttributedCommits = aiCommitHashes.length;
    result.aiAttributionPercentage = totalCommits > 0
      ? Math.round((aiCommitHashes.length / totalCommits) * 100)
      : 0;

    result.aiToolsDetected = Object.entries(toolCounts)
      .map(([tool, commits]) => ({ tool, commits }))
      .sort((a, b) => b.commits - a.commits);

    // Top files modified in AI-attributed commits
    if (aiCommitHashes.length > 0) {
      const fileCounts = {};
      // Process in batches to avoid command line length limits
      const batchSize = 50;
      for (let i = 0; i < aiCommitHashes.length; i += batchSize) {
        const batch = aiCommitHashes.slice(i, i + batchSize);
        for (const hash of batch) {
          try {
            const files = gitLines(`diff-tree --no-commit-id --name-only -r ${hash}`, repoPath);
            for (const f of files) {
              fileCounts[f] = (fileCounts[f] || 0) + 1;
            }
          } catch {
            // Skip commits that fail (e.g., initial commit)
          }
        }
      }

      result.topAiModifiedFiles = Object.entries(fileCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([file, count]) => ({ file, commits: count }));
    }
  } catch (e) {
    log(`  Warning: AI code generation extraction failed: ${e.message}`);
  }

  return result;
}

function extractSecurityPractices(repoPath, since) {
  log('Extracting security practices evidence...');
  const result = {
    gitignoreExcludesSecrets: false,
    gitignoreSecretPatterns: [],
    securityFiles: {
      'SECURITY.md': false,
      'CODEOWNERS': false,
      'dependabot.yml': false,
      '.github/security.yml': false,
      '.github/CODEOWNERS': false
    },
    securityWorkflows: [],
    hasPreCommitHooks: false,
    hookTools: [],
    signedCommits: 0,
    signedPercentage: 0
  };

  try {
    // .gitignore analysis
    const gitignorePath = path.join(repoPath, '.gitignore');
    if (fileExists(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const secretPatterns = [
        { pattern: /\.env/m, name: '.env' },
        { pattern: /\.env\.\*/m, name: '.env.*' },
        { pattern: /\.env\.local/m, name: '.env.local' },
        { pattern: /credentials/i, name: 'credentials' },
        { pattern: /\.key$/m, name: '*.key' },
        { pattern: /\.pem$/m, name: '*.pem' },
        { pattern: /secret/i, name: 'secrets' },
        { pattern: /\.p12$/m, name: '*.p12' },
        { pattern: /\.pfx$/m, name: '*.pfx' },
        { pattern: /id_rsa/m, name: 'id_rsa' },
        { pattern: /\.keystore/m, name: '.keystore' },
        { pattern: /token/i, name: 'tokens' },
        { pattern: /password/i, name: 'passwords' },
        { pattern: /\.aws/m, name: '.aws' }
      ];

      for (const { pattern, name } of secretPatterns) {
        if (pattern.test(content)) {
          result.gitignoreSecretPatterns.push(name);
        }
      }
      result.gitignoreExcludesSecrets = result.gitignoreSecretPatterns.length > 0;
    }
  } catch (e) {
    log(`  Warning: .gitignore analysis failed: ${e.message}`);
  }

  try {
    // Security-related files
    const filesToCheck = {
      'SECURITY.md': [
        path.join(repoPath, 'SECURITY.md'),
        path.join(repoPath, 'security.md'),
        path.join(repoPath, '.github', 'SECURITY.md')
      ],
      'CODEOWNERS': [
        path.join(repoPath, 'CODEOWNERS'),
        path.join(repoPath, '.github', 'CODEOWNERS'),
        path.join(repoPath, 'docs', 'CODEOWNERS')
      ],
      'dependabot.yml': [
        path.join(repoPath, '.github', 'dependabot.yml'),
        path.join(repoPath, '.github', 'dependabot.yaml')
      ],
      '.github/security.yml': [
        path.join(repoPath, '.github', 'security.yml'),
        path.join(repoPath, '.github', 'security.yaml')
      ],
      '.github/CODEOWNERS': [
        path.join(repoPath, '.github', 'CODEOWNERS')
      ]
    };

    for (const [key, paths] of Object.entries(filesToCheck)) {
      for (const p of paths) {
        if (fileExists(p)) {
          result.securityFiles[key] = true;
          break;
        }
      }
    }

    // Security workflows
    const workflowDir = path.join(repoPath, '.github', 'workflows');
    if (dirExists(workflowDir)) {
      try {
        const workflows = fs.readdirSync(workflowDir);
        result.securityWorkflows = workflows.filter(f =>
          /secur|codeql|snyk|trivy|scan|dependabot|audit|sast|dast/i.test(f)
        );
      } catch {
        // Ignore directory read failures
      }
    }
  } catch (e) {
    log(`  Warning: security file detection failed: ${e.message}`);
  }

  try {
    // Git hooks
    const hookToolNames = [];

    // Check .husky
    const huskyDir = path.join(repoPath, '.husky');
    if (dirExists(huskyDir)) {
      result.hasPreCommitHooks = true;
      hookToolNames.push('husky');
    }

    // Check .pre-commit-config.yaml
    if (fileExists(path.join(repoPath, '.pre-commit-config.yaml'))) {
      result.hasPreCommitHooks = true;
      hookToolNames.push('pre-commit');
    }

    // Check .lefthook.yml
    if (fileExists(path.join(repoPath, '.lefthook.yml')) || fileExists(path.join(repoPath, 'lefthook.yml'))) {
      result.hasPreCommitHooks = true;
      hookToolNames.push('lefthook');
    }

    // Check .git/hooks for non-sample hooks
    const gitHooksDir = path.join(repoPath, '.git', 'hooks');
    if (dirExists(gitHooksDir)) {
      try {
        const hooks = fs.readdirSync(gitHooksDir);
        const activeHooks = hooks.filter(f => !f.endsWith('.sample'));
        if (activeHooks.length > 0) {
          result.hasPreCommitHooks = true;
          if (!hookToolNames.length) hookToolNames.push('git-hooks');
        }
      } catch {
        // Ignore
      }
    }

    // Check package.json for lint-staged / husky config
    const pkgPath = path.join(repoPath, 'package.json');
    if (fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg['lint-staged']) {
          result.hasPreCommitHooks = true;
          if (!hookToolNames.includes('lint-staged')) hookToolNames.push('lint-staged');
        }
        if (pkg.husky) {
          result.hasPreCommitHooks = true;
          if (!hookToolNames.includes('husky')) hookToolNames.push('husky');
        }
      } catch {
        // Ignore parse failures
      }
    }

    result.hookTools = [...new Set(hookToolNames)];
  } catch (e) {
    log(`  Warning: hook detection failed: ${e.message}`);
  }

  try {
    // Signed commits
    const sigLines = gitLines(`log ${since} --format=%G?`, repoPath);
    const signed = sigLines.filter(s => s === 'G' || s === 'U' || s === 'E').length;
    result.signedCommits = signed;
    result.signedPercentage = sigLines.length > 0
      ? Math.round((signed / sigLines.length) * 100)
      : 0;
  } catch (e) {
    log(`  Warning: signed commit detection failed: ${e.message}`);
  }

  return result;
}

function extractIncidentResponse(repoPath, since) {
  log('Extracting incident response evidence...');
  const result = {
    hotfixBranches: [],
    revertCommits: 0,
    revertDetails: [],
    avgReleaseIntervalDays: 0
  };

  try {
    // Hotfix/emergency branches
    const branchLines = gitLines('branch -a', repoPath);
    const hotfixPatterns = /\b(hotfix|bugfix|emergency|patch|urgent)\b/i;
    for (const line of branchLines) {
      const name = line.replace(/^\*?\s+/, '').replace(/^remotes\/origin\//, '').trim();
      if (hotfixPatterns.test(name)) {
        result.hotfixBranches.push(name);
      }
    }
    // Deduplicate
    result.hotfixBranches = [...new Set(result.hotfixBranches)];
  } catch (e) {
    log(`  Warning: hotfix branch detection failed: ${e.message}`);
  }

  try {
    // Revert commits
    const revertLines = gitLines(`log ${since} --format=%H|||%s --grep="^Revert "`, repoPath);
    result.revertCommits = revertLines.length;
    result.revertDetails = revertLines.slice(0, 50).map(line => {
      const parts = line.split('|||');
      return { hash: parts[0], subject: parts[1] || '' };
    });
  } catch (e) {
    log(`  Warning: revert commit detection failed: ${e.message}`);
  }

  try {
    // Average release interval (from tags)
    const tagDateLines = gitLines(
      `tag -l --sort=-creatordate --format="%(creatordate:iso-strict)"`,
      repoPath
    );
    const tagDates = tagDateLines
      .map(d => new Date(d).getTime())
      .filter(d => !isNaN(d))
      .sort((a, b) => a - b);

    if (tagDates.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < tagDates.length; i++) {
        totalInterval += tagDates[i] - tagDates[i - 1];
      }
      result.avgReleaseIntervalDays = Math.round(
        totalInterval / (tagDates.length - 1) / (1000 * 60 * 60 * 24)
      );
    }
  } catch (e) {
    log(`  Warning: release interval calculation failed: ${e.message}`);
  }

  return result;
}

function extractGovernance(repoPath) {
  log('Extracting governance structure evidence...');
  const result = {
    codeowners: [],
    hasContributing: false,
    hasLicense: false,
    licenseType: '',
    uniqueContributors: 0,
    contributorList: []
  };

  try {
    // CODEOWNERS
    const codeownersPaths = [
      path.join(repoPath, 'CODEOWNERS'),
      path.join(repoPath, '.github', 'CODEOWNERS'),
      path.join(repoPath, 'docs', 'CODEOWNERS')
    ];

    for (const coPath of codeownersPaths) {
      if (fileExists(coPath)) {
        const content = fs.readFileSync(coPath, 'utf8');
        const lines = content.split('\n')
          .filter(l => l.trim() && !l.trim().startsWith('#'));

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            result.codeowners.push({
              pattern: parts[0],
              owners: parts.slice(1)
            });
          }
        }
        break;
      }
    }
  } catch (e) {
    log(`  Warning: CODEOWNERS parsing failed: ${e.message}`);
  }

  try {
    // Contributing guidelines
    const contributingNames = ['CONTRIBUTING.md', 'CONTRIBUTING', 'contributing.md', '.github/CONTRIBUTING.md'];
    for (const name of contributingNames) {
      if (fileExists(path.join(repoPath, name))) {
        result.hasContributing = true;
        break;
      }
    }
  } catch (e) {
    log(`  Warning: contributing file detection failed: ${e.message}`);
  }

  try {
    // License
    const licenseNames = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'license'];
    for (const name of licenseNames) {
      const lPath = path.join(repoPath, name);
      if (fileExists(lPath)) {
        result.hasLicense = true;
        // Try to detect license type from first few lines
        const content = fs.readFileSync(lPath, 'utf8').slice(0, 2000);
        const licensePatterns = [
          { pattern: /MIT License/i, type: 'MIT' },
          { pattern: /Apache License.*2\.0/i, type: 'Apache-2.0' },
          { pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 3/i, type: 'GPL-3.0' },
          { pattern: /GNU GENERAL PUBLIC LICENSE\s+Version 2/i, type: 'GPL-2.0' },
          { pattern: /GNU LESSER GENERAL PUBLIC/i, type: 'LGPL' },
          { pattern: /BSD 2-Clause/i, type: 'BSD-2-Clause' },
          { pattern: /BSD 3-Clause/i, type: 'BSD-3-Clause' },
          { pattern: /ISC License/i, type: 'ISC' },
          { pattern: /Mozilla Public License.*2\.0/i, type: 'MPL-2.0' },
          { pattern: /The Unlicense/i, type: 'Unlicense' },
          { pattern: /Creative Commons/i, type: 'CC' },
          { pattern: /AGPL/i, type: 'AGPL' },
          { pattern: /Boost Software License/i, type: 'BSL-1.0' }
        ];
        for (const { pattern, type } of licensePatterns) {
          if (pattern.test(content)) {
            result.licenseType = type;
            break;
          }
        }
        if (!result.licenseType) result.licenseType = 'Unknown';
        break;
      }
    }
  } catch (e) {
    log(`  Warning: license detection failed: ${e.message}`);
  }

  try {
    // Contributors
    const authorLines = gitLines('log --format=%aN|||%aE', repoPath);
    const contributors = new Map();
    for (const line of authorLines) {
      const parts = line.split('|||');
      const name = parts[0];
      const email = parts[1] || '';
      const key = email || name;
      if (!contributors.has(key)) {
        contributors.set(key, { name, email });
      }
    }
    result.uniqueContributors = contributors.size;
    result.contributorList = [...contributors.values()].slice(0, 100);
  } catch (e) {
    log(`  Warning: contributor extraction failed: ${e.message}`);
  }

  return result;
}

function extractAccessControl(repoPath, since) {
  log('Extracting access control evidence...');
  const result = {
    uniqueCommitterEmails: [],
    authorCommitterMismatches: 0
  };

  try {
    // Unique committer emails
    const committerEmails = gitLines(`log ${since} --format=%cE`, repoPath);
    result.uniqueCommitterEmails = [...new Set(committerEmails)].filter(Boolean);
  } catch (e) {
    log(`  Warning: committer email extraction failed: ${e.message}`);
  }

  try {
    // Author vs committer mismatches
    const lines = gitLines(`log ${since} --format=%aE|||%cE`, repoPath);
    let mismatches = 0;
    for (const line of lines) {
      const parts = line.split('|||');
      if (parts[0] && parts[1] && parts[0] !== parts[1]) {
        mismatches++;
      }
    }
    result.authorCommitterMismatches = mismatches;
  } catch (e) {
    log(`  Warning: author/committer mismatch detection failed: ${e.message}`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// AutoFill field computation
// ---------------------------------------------------------------------------

function computeAutoFillFields(evidence) {
  log('Computing auto-fill fields...');
  const fields = {};

  // AI attribution supply chain risk
  if (evidence.aiCodeGeneration.aiAttributedCommits > 0) {
    const tools = evidence.aiCodeGeneration.aiToolsDetected
      .map(t => `${t.tool} (${t.commits} commits)`)
      .join(', ');
    fields['supplyChain.aiCodeGenerationDetected'] = true;
    fields['supplyChain.aiToolsUsed'] = tools;
    fields['supplyChain.aiAttributionPercentage'] = evidence.aiCodeGeneration.aiAttributionPercentage;
    fields['supplyChain.note'] = `AI-assisted code generation detected in ${evidence.aiCodeGeneration.aiAttributionPercentage}% of commits. Tools: ${tools}. Review supply chain documentation requirements.`;
  }

  // PR-based workflow as human oversight evidence
  if (evidence.codeReview.mergePercentage > 80) {
    fields['humanOversight.prBasedWorkflow'] = true;
    fields['humanOversight.mergePercentage'] = evidence.codeReview.mergePercentage;
    fields['humanOversight.note'] = `Repository uses PR-based workflow (${evidence.codeReview.mergePercentage}% merge commits). ${evidence.codeReview.uniqueReviewers.length} unique reviewers identified. This evidences human oversight of code changes.`;
  }

  // Commit signing as security control
  if (evidence.securityPractices.signedPercentage > 50) {
    fields['security.commitSigningEnabled'] = true;
    fields['security.signedPercentage'] = evidence.securityPractices.signedPercentage;
    fields['security.note'] = `${evidence.securityPractices.signedPercentage}% of commits are cryptographically signed, evidencing commit authenticity verification as a security control.`;
  }

  // CODEOWNERS as governance evidence
  if (evidence.governance.codeowners.length > 0) {
    const ownerSummary = evidence.governance.codeowners
      .slice(0, 10)
      .map(c => `${c.pattern}: ${c.owners.join(', ')}`)
      .join('; ');
    fields['governance.codeownersPresent'] = true;
    fields['governance.codeownersSummary'] = ownerSummary;
    fields['governance.note'] = `CODEOWNERS file defines ${evidence.governance.codeowners.length} ownership rule(s), evidencing code governance structure.`;
  }

  // Conventional commits as change management evidence
  if (evidence.changeManagement.conventionalCommitPercentage > 50) {
    fields['changeManagement.conventionalCommitsUsed'] = true;
    fields['changeManagement.conventionalCommitPercentage'] = evidence.changeManagement.conventionalCommitPercentage;
    fields['changeManagement.note'] = `${evidence.changeManagement.conventionalCommitPercentage}% of commits follow conventional commit format, evidencing structured change management practices.`;
  }

  // Gitignore secrets exclusion as security evidence
  if (evidence.securityPractices.gitignoreExcludesSecrets) {
    fields['security.secretsExcluded'] = true;
    fields['security.excludedPatterns'] = evidence.securityPractices.gitignoreSecretPatterns.join(', ');
  }

  // Pre-commit hooks as security/quality evidence
  if (evidence.securityPractices.hasPreCommitHooks) {
    fields['security.preCommitHooksEnabled'] = true;
    fields['security.hookTools'] = evidence.securityPractices.hookTools.join(', ');
  }

  // License as governance evidence
  if (evidence.governance.hasLicense) {
    fields['governance.licensePresent'] = true;
    fields['governance.licenseType'] = evidence.governance.licenseType;
  }

  // Contributing guidelines as governance evidence
  if (evidence.governance.hasContributing) {
    fields['governance.contributingGuidelinesPresent'] = true;
  }

  // Incident response from revert/hotfix history
  if (evidence.incidentResponse.revertCommits > 0 || evidence.incidentResponse.hotfixBranches.length > 0) {
    fields['incidentResponse.evidencePresent'] = true;
    fields['incidentResponse.revertCount'] = evidence.incidentResponse.revertCommits;
    fields['incidentResponse.hotfixBranchCount'] = evidence.incidentResponse.hotfixBranches.length;
    fields['incidentResponse.note'] = `${evidence.incidentResponse.revertCommits} revert commit(s) and ${evidence.incidentResponse.hotfixBranches.length} hotfix/emergency branch(es) detected, evidencing incident response processes.`;
  }

  // Release management evidence
  if (evidence.changeManagement.releaseTags.length > 0) {
    fields['changeManagement.releaseTagCount'] = evidence.changeManagement.releaseTags.length;
    fields['changeManagement.latestRelease'] = evidence.changeManagement.releaseTags[0]?.tag || '';
    if (evidence.changeManagement.releaseFrequencyDays > 0) {
      fields['changeManagement.releaseFrequencyDays'] = evidence.changeManagement.releaseFrequencyDays;
    }
  }

  // Contributor count as access control evidence
  fields['accessControl.uniqueContributors'] = evidence.governance.uniqueContributors;
  fields['accessControl.uniqueCommitters'] = evidence.accessControl.uniqueCommitterEmails.length;
  if (evidence.accessControl.authorCommitterMismatches > 0) {
    fields['accessControl.authorCommitterMismatches'] = evidence.accessControl.authorCommitterMismatches;
    fields['accessControl.note'] = `${evidence.accessControl.authorCommitterMismatches} commits have author/committer mismatches, indicating use of rebasing or merge policies.`;
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs();

  log(`Repository: ${opts.repo}`);
  log(`Days of history: ${opts.days}`);
  log(`Output: ${opts.output || 'stdout'}`);
  log('');

  // Verify this is a git repository
  try {
    git('rev-parse --git-dir', opts.repo);
  } catch {
    process.stderr.write(`Error: "${opts.repo}" is not a git repository.\n`);
    process.exit(1);
  }

  const since = sinceArg(opts.days);

  // Run all extractions
  const codeReview = extractCodeReview(opts.repo, since);
  const changeManagement = extractChangeManagement(opts.repo, since, opts.days);
  const aiCodeGeneration = extractAiCodeGeneration(opts.repo, since);
  const securityPractices = extractSecurityPractices(opts.repo, since);
  const incidentResponse = extractIncidentResponse(opts.repo, since);
  const governance = extractGovernance(opts.repo);
  const accessControl = extractAccessControl(opts.repo, since);

  const evidence = {
    codeReview,
    changeManagement,
    aiCodeGeneration,
    securityPractices,
    incidentResponse,
    governance,
    accessControl
  };

  const autoFillFields = computeAutoFillFields(evidence);

  const output = {
    _meta: {
      extractor: 'git-evidence',
      version: '1.0.0',
      extractedAt: new Date().toISOString(),
      repoPath: opts.repo,
      daysCovered: opts.days
    },
    ...evidence,
    autoFillFields
  };

  const json = JSON.stringify(output, null, 2);

  if (opts.output) {
    const outDir = path.dirname(opts.output);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(opts.output, json, 'utf8');
    log(`\nOutput written to: ${opts.output}`);
  } else {
    process.stdout.write(json + '\n');
  }

  // Summary to stderr
  log('');
  log('=== Extraction Summary ===');
  log(`Total commits scanned: ${codeReview.totalCommits}`);
  log(`Merge commits: ${codeReview.mergeCommits} (${codeReview.mergePercentage}%)`);
  log(`Reviewed commits: ${codeReview.reviewedCommits}`);
  log(`AI-attributed commits: ${aiCodeGeneration.aiAttributedCommits} (${aiCodeGeneration.aiAttributionPercentage}%)`);
  log(`Release tags: ${changeManagement.releaseTags.length}`);
  log(`Conventional commits: ${changeManagement.conventionalCommitPercentage}%`);
  log(`Signed commits: ${securityPractices.signedCommits} (${securityPractices.signedPercentage}%)`);
  log(`Unique contributors: ${governance.uniqueContributors}`);
  log(`Revert commits: ${incidentResponse.revertCommits}`);
  log(`Hotfix branches: ${incidentResponse.hotfixBranches.length}`);
  log(`CODEOWNERS rules: ${governance.codeowners.length}`);
  log(`Auto-fill fields generated: ${Object.keys(autoFillFields).length}`);
  log('=== Done ===');
}

main();
