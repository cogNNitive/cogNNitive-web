#!/usr/bin/env node

/**
 * scripts/manifest/validate-manifest.js
 *
 * Orchestrator CLI for validating bootstrap manifests against source repositories
 * over the GitHub API. Delegates parsing, networking, and validation rules to modular libraries.
 *
 * Usage:
 *   node scripts/manifest/validate-manifest.js [repo-root] [--channel <stable|preview>]
 *
 * Zero dependencies. Requires Node >= 18.
 */

const fs = require('fs');
const path = require('path');
const {
  parseFocusedYaml,
  parseFrontmatter,
  parseManifest,
} = require('../lib/yaml-parser.js');
const {
  apiRequest,
  fetchString,
  authHeaders,
  rateLimited,
  resolveRef,
} = require('../lib/github-client.js');
const {
  COMMIT_RE,
  TAG_SHAPE_RE,
  CHANNELS,
  tagShapeViolation,
  refKindViolation,
  checkReleaseProvenance,
  checkRefResolvesInDeclaredRepo,
  checkReleaseAndRefPolicy,
  structuralViolations,
  checkCommitExists,
  checkPathAtCommit,
  checkVersionParity,
  checkMcpUrlPinned,
  checkTemplateMainCoherence,
  validateMcp,
  validateConsoleAsset,
  validateSkill,
  validateTemplate,
  checkClosureViolations,
  validateManifest,
} = require('./lib/manifest-rules.js');

/**
 * Parses CLI command line arguments.
 * @param {string[]} argv
 * @returns {{ repoRoot: string | null, channel: string | null }}
 */
function parseArgs(argv) {
  let repoRoot = null;
  let channel = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--channel') {
      channel = argv[++i];
    } else if (arg.startsWith('--channel=')) {
      channel = arg.slice('--channel='.length);
    } else if (!arg.startsWith('--') && repoRoot === null) {
      repoRoot = arg;
    }
  }
  return { repoRoot, channel };
}

/**
 * Validates an entire channel manifest file against policy rules and closures.
 * @param {string} repoRoot
 * @param {string} channelName
 * @returns {Promise<boolean>}
 */
async function validateChannel(repoRoot, channelName) {
  const policy = CHANNELS[channelName];
  const manifestFile = path.join(repoRoot, ...policy.file.split('/'));
  const prefix = `[${channelName}]`;
  if (!fs.existsSync(manifestFile)) {
    console.error(`FAIL: ${prefix} manifest not found at ${manifestFile}`);
    return false;
  }

  let manifestData;
  try {
    manifestData = parseManifest(fs.readFileSync(manifestFile, 'utf-8'));
  } catch (err) {
    console.error(`FAIL: ${prefix} could not parse manifest: ${err.message}`);
    return false;
  }

  const { violations, stats } = await validateManifest(manifestData, policy);

  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${prefix} ${violation}`);
    console.error(`\nFAIL: ${prefix} ${violations.length} violation(s) in manifest (${stats.skillsCount} skills, ${stats.blueprintsCount} blueprints, ${stats.mcpCount} mcp bundles, ${stats.consoleCount} console assets)`);
    return false;
  }

  console.log(`OK: ${prefix} ${stats.skillsCount} skills, ${stats.blueprintsCount} blueprints, ${stats.mcpCount} mcp bundles, and ${stats.consoleCount} console assets validated`);
  return true;
}

/**
 * Main execution entry point for manifest validator.
 * @returns {Promise<void>}
 */
async function main() {
  const { repoRoot: repoRootArg, channel: channelArg } = parseArgs(process.argv.slice(2));
  const repoRoot = repoRootArg ? path.resolve(repoRootArg) : process.cwd();

  if (channelArg && !CHANNELS[channelArg]) {
    console.error(`FAIL: unknown channel '${channelArg}' (expected 'stable' or 'preview')`);
    process.exit(1);
  }

  const channelsToRun = channelArg
    ? [channelArg]
    : Object.keys(CHANNELS).filter((name) => fs.existsSync(path.join(repoRoot, ...CHANNELS[name].file.split('/'))));

  if (channelsToRun.length === 0) {
    const expected = Object.values(CHANNELS).map((c) => c.file).join(', ');
    console.error(`FAIL: no channel manifest found under ${repoRoot} (looked for ${expected})`);
    process.exit(1);
  }

  let allOk = true;
  for (const channelName of channelsToRun) {
    const ok = await validateChannel(repoRoot, channelName);
    allOk = allOk && ok;
  }

  if (!allOk) process.exit(1);
}

module.exports = {
  // Re-exported from scripts/lib/github-client.js
  apiRequest,
  fetchString,
  authHeaders,
  rateLimited,
  resolveRef,
  // Re-exported from scripts/lib/yaml-parser.js
  parseFocusedYaml,
  parseFrontmatter,
  parseManifest,
  // Re-exported from scripts/manifest/lib/manifest-rules.js
  COMMIT_RE,
  TAG_SHAPE_RE,
  CHANNELS,
  tagShapeViolation,
  refKindViolation,
  checkReleaseProvenance,
  checkRefResolvesInDeclaredRepo,
  checkReleaseAndRefPolicy,
  structuralViolations,
  checkCommitExists,
  checkPathAtCommit,
  checkVersionParity,
  checkMcpUrlPinned,
  checkTemplateMainCoherence,
  validateMcp,
  validateConsoleAsset,
  validateSkill,
  validateTemplate,
  checkClosureViolations,
  validateManifest,
  // Orchestrator functions
  validateChannel,
  parseArgs,
  main,
};

if (require.main === module) {
  main();
}
