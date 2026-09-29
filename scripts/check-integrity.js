#!/usr/bin/env node

/**
 * scripts/check-integrity.js
 *
 * Deterministic post-change & pre-push integrity runner.
 * Unifies:
 * - Group 0 & 1: Git working tree & concurrency status
 * - Group 2: MCP version square alignment
 * - Group 3, 4, 7+: Full workspace verification suite (scripts/verify.js)
 * - Group 5 (optional): Complete CI mirror (lint, typecheck, core/app tests,
 *   innfo-mcp tests + coverage ratchet, spec-url resolution)
 *
 * Usage:
 *   node scripts/check-integrity.js            # Standard deterministic gate (Groups 0-4, 7+)
 *   node scripts/check-integrity.js --pre-push # Full pre-push gate (includes CI mirror)
 *   node scripts/check-integrity.js --release  # Release gate: pre-push + live stable-manifest validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { checkCdnBundleStaged } = require('./lib/cdn-bundle-staged.js');
const { checkTagPinFreshness } = require('./lib/tag-pin-freshness.js');
const { checkNodeEngines } = require('./lib/node-engine-check.js');
const { validateLegacyLedger } = require('./lib/legacy-ledger-guard.js');
const { runVerification } = require('./verify.js');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const isRelease = args.includes('--release') || args.includes('-r');
const isPrePush = args.includes('--pre-push') || args.includes('--all') || args.includes('-p') || isRelease;

console.log('🩺 [nn-dev-check-integrity] Running deterministic integrity gate...');

// Step 1: Git & Working Tree Hygiene (Group 0 & 1)
console.log('\n[Group 0 & 1] Working Tree & Git State:');
try {
  const branch = execSync('git branch --show-current', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const status = execSync('git status -sb', { cwd: repoRoot, encoding: 'utf8' }).trim();
  console.log(`  Current branch: ${branch}`);
  console.log(`  ${status.split('\n')[0]}`);

  const uncommitted = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (uncommitted) {
    console.log('  ⚠️ Uncommitted changes detected:');
    uncommitted.split('\n').slice(0, 5).forEach(l => console.log(`     ${l}`));
  } else {
    console.log('  ✅ Working tree clean.');
  }

  const stashes = execSync('git stash list', { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (stashes) {
    console.log(`  ℹ️ Stashes present: ${stashes.split('\n').length}`);
  }
} catch (e) {
  console.log(`  ℹ️ Git state check skipped: ${e.message}`);
}

// Step 1b: Tag/Pin Freshness for skills & templates changes (Group 1c)
console.log('\n[Group 1c] Tag/Pin Freshness (skills/templates changes must re-pin manifest/source.yaml):');
const tagPin = checkTagPinFreshness(repoRoot);
if (tagPin.skipped) {
  console.log('  ⚠️ Skipped — diff range not resolvable (e.g. origin/main not fetched, or a shallow/fresh repo).');
} else if (!tagPin.ok) {
  console.error('❌ Tag/pin freshness violation:');
  tagPin.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
} else {
  console.log('  ✅ No unpinned skills/template changes detected.');
}

// Step 2: CDN Bundle Staging (Group 2)
console.log('\n[Group 2] CDN Bundle Staging (docs/innfo/cdn/innfo-mcp-v<version>.bundle.js):');
const cdnBundle = checkCdnBundleStaged(repoRoot);
if (!cdnBundle.ok) {
  console.error('❌ CDN Bundle check failed:');
  cdnBundle.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
console.log(`  ✅ Staged CDN bundle present on disk (v${cdnBundle.version}).`);

// Step 2b: Version SSOT Guard (spec_NN.md & SKILL.md -> samples.ts + manifest/source.yaml)
console.log('\n[Group 2b] Version SSOT (spec_NN.md & SKILL.md <-> samples.ts <-> manifest/source.yaml):');
try {
  execSync('node scripts/sync-versions.mjs --check', { cwd: repoRoot, stdio: 'inherit' });
  console.log('  ✅ Versions are in sync with SSOT.');
} catch (e) {
  console.error('❌ Version drift detected. Run `npm run sync:versions` to regenerate the copies.');
  process.exit(1);
}

// Step 2c: Node Engine Compatibility (Group 9 — automated bullets)
console.log('\n[Group 9] Node Engine Compatibility (installed deps vs CI-pinned Node):');
const nodeEngines = checkNodeEngines(repoRoot);
if (nodeEngines.warnings && nodeEngines.warnings.length) {
  nodeEngines.warnings.forEach(w => console.log(`  ⚠️ ${w}`));
}
if (!nodeEngines.ok) {
  console.error('❌ Node engine compatibility violation:');
  nodeEngines.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
console.log('  ✅ All installed workspace dependencies are compatible with CI-pinned Node version(s).');

// Step 2d: Legacy Ledger & Quarantine Marker Guard
console.log('\n[Group 2d] Legacy Ledger & Quarantine Marker Guard:');
const legacyLedgerResult = validateLegacyLedger({ repoRoot });
if (!legacyLedgerResult.ok) {
  console.error('❌ Legacy Ledger check failed:');
  legacyLedgerResult.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}
console.log(`  ✅ Legacy ledger valid (${legacyLedgerResult.entries.length} entries, ${legacyLedgerResult.markers.length} code markers).`);

// Step 3: Full Deterministic Workspace Verification (verify.js)
console.log('\n[Groups 3, 4, 7+] Workspace Verification Suite:');
try {
  runVerification({ release: isRelease });
} catch (e) {
  console.error(`❌ Workspace verification failed: ${e.message}`);
  process.exit(1);
}

// Step 4: Full CI Mirror (Group 5, if --pre-push)
if (isPrePush) {
  console.log('\n[Group 5] Full CI Mirror (lint · typecheck · tests+coverage · spec-urls):');
  function runCmd(cmd, desc) {
    console.log(`\n▶ ${desc} (${cmd})...`);
    execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
  }

  try {
    runCmd('npm run lint', 'Lint');
    runCmd('npm run typecheck', 'Typecheck');
    runCmd('npm --workspace=@cognnitive/innfo-core test', 'Unit tests (core)');
    runCmd('npm --workspace=@cognnitive/innfo-mcp run test:coverage', 'Unit tests + coverage (innfo-mcp)');
    runCmd('npm --workspace=@cognnitive/innfo-editor test', 'Unit tests (app)');
    runCmd('node scripts/check-spec-version.mjs --check-urls', 'Check spec URLs resolve');
    console.log('\n✅ [Group 5] CI mirror passed.');
  } catch (err) {
    console.error(`\n❌ CI mirror failed.`);
    process.exit(1);
  }
}

console.log('\n🎉 [nn-dev-check-integrity] ALL INTEGRITY GATES PASSED.');
