#!/usr/bin/env node

/**
 * scripts/verify.js
 *
 * Deterministic workspace verification runner for cogNNitive tooling.
 * Enforces template inventory parity, scripts static type safety, orchestrator
 * line-count limits, and generated-manifest freshness.
 *
 * The live stable-manifest publication check (resolving pins to tags on
 * main-reachable commits over the GitHub API) depends on release state, so it
 * only runs with `--release` — CI on push to `main`, and the release flow after
 * tagging. Dev/pre-push runs skip it, because a release pin cannot exist before
 * its tag is cut (release order: merge -> tag -> pin).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure local node_modules/.bin is accessible on PATH for standalone node invocations
const binDir = path.join(__dirname, '..', 'node_modules', '.bin');
const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') || 'PATH';
if (fs.existsSync(binDir) && !(process.env[pathKey] || '').includes(binDir)) {
  process.env[pathKey] = `${binDir}${path.delimiter}${process.env[pathKey] || ''}`;
}

if (!process.env.GITHUB_TOKEN) {
  try {
    const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
    if (token) process.env.GITHUB_TOKEN = token;
  } catch (_) {
    // gh not installed or not logged in, fallback to unauthenticated
  }
}

function extractDeclaredTemplates(sourceText) {
  /** @type {Set<string>} */
  const declaredTemplates = new Set();
  const matchRegex = /-\s+name:\s+([^\s\n]+)/g;
  for (const block of ['templates:', 'frozen_templates:', 'seam_dirs:']) {
    const templatesMatch = sourceText.match(new RegExp(`(?:^|\\n)${block}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n[a-z_]+:|$)`));
    const templatesBlock = templatesMatch ? templatesMatch[1] : '';
    let match;
    while ((match = matchRegex.exec(templatesBlock)) !== null) {
      declaredTemplates.add(match[1]);
    }
  }
  return declaredTemplates;
}

function checkTemplateInventory(templatesDir, sourceYamlPath) {
  const sourceText = fs.readFileSync(sourceYamlPath, 'utf8');
  const declaredTemplates = extractDeclaredTemplates(sourceText);

  const diskFolders = fs.readdirSync(templatesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'assets')
    .map(d => d.name);

  const missing = diskFolders.filter(name => !declaredTemplates.has(name));
  return { ok: missing.length === 0, missing, diskFolders };
}

/**
 * Collects every self-contained Node test suite under `scripts/` and `skills/`
 * by shape (`*.test.js` / `*.test.mjs`), instead of an enumerated allowlist.
 *
 * The allowlist this replaces drifted twice: the `actioNN/` -> `skills/`
 * consolidation left skill suites ungated through a green CI run, and eight
 * further suites (export-console, guard-text-encoding, git-visible,
 * mcp-config-adapter, skills-manager, template-catalog, upgrade-check,
 * backup-workspace) were added afterwards and never wired in. Discovering them
 * by filename means a new suite is gated the moment it exists.
 *
 * Suites that do NOT match the pattern stay wired explicitly below
 * (`nn-trannsform/test/run.js`, `specs/scripts/test-vocabulary.js`), as do the
 * `--check` drift guards, whose ordering is load-bearing.
 *
 * @param {string} dir - Absolute directory to walk.
 * @param {string[]} [found] - Accumulator.
 * @returns {string[]} Repo-relative POSIX paths, sorted for a stable run order.
 */
function collectTestSuites(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // skills/nn-trannsform ships its own dependency tree; never walk into it.
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectTestSuites(full, found);
    else if (/\.test\.(js|mjs)$/.test(entry.name)) found.push(full);
  }
  return found.sort();
}

/**
 * Executes a verification step synchronously, tracking output and halting on error.
 * @param {string} cmd - CLI command string to execute.
 * @param {string} desc - Descriptive label for the verification step.
 * @returns {void}
 */
function run(cmd, desc) {
  console.log(`\n▶ ${desc} (${cmd})...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`❌ ${desc} failed.`);
    process.exit(1);
  }
}

/**
 * @param {{ release?: boolean }} [options] - `release: true` also runs the live
 *   stable-manifest publication check (network + tags). Defaults to dev mode.
 * @returns {void}
 */
function runVerification(options = {}) {
  const release = options.release === true;
  console.log('🔍 [cogNNitive Verify] Running workspace verification...');

  // 0. CDN Bundle Staging: asserts the staged CDN bundle for the current innfo-mcp
  //    version exists on disk. Build-ordering check covering CI and local gates.
  const { checkCdnBundleStaged } = require('./lib/cdn-bundle-staged.js');
  const bundleCheck = checkCdnBundleStaged(path.join(__dirname, '..'));
  if (!bundleCheck.ok) {
    console.error('❌ CDN Bundle check failed:');
    bundleCheck.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log(`▶ CDN Bundle Staged: v${bundleCheck.version} bundle present on disk.`);

  // 0b. Every `*.test.js` / `*.test.mjs` suite under scripts/ and skills/,
  //     discovered by shape rather than enumerated. These are self-contained
  //     unit suites with no ordering dependency on each other or on the drift
  //     guards below, so they run first: a broken tester should fail before the
  //     slower network- and git-dependent steps. Ordering-sensitive checks
  //     (every `--check` invocation) stay in their numbered positions.
  const repoRoot = path.join(__dirname, '..');
  const suites = [
    ...collectTestSuites(path.join(repoRoot, 'scripts')),
    ...collectTestSuites(path.join(repoRoot, 'skills')),
    ...collectTestSuites(path.join(repoRoot, 'test')),
  ];
  console.log(`
▶ Discovered ${suites.length} script/skill test suites.`);
  for (const suite of suites) {
    const rel = path.relative(repoRoot, suite).split(path.sep).join('/');
    run(`node ${rel}`, `Test ${rel}`);
  }

  // 0c. Suites whose filenames do not match the `*.test.*` shape, so the
  //     discovery above cannot find them. Keep them explicit.
  run('node skills/nn-trannsform/test/run.js', 'Test nn-trannsform Skill Suite');
  run('node iNNfo/specs/scripts/test-vocabulary.js', 'Test Canonical Vocabulary Guard');

// 1. Template Inventory Guard: ensure every template folder is declared in manifest/source.yaml
  const templatesDir = path.join(__dirname, '..', 'iNNfo', 'specs', 'templates');
  const sourceYamlPath = path.join(__dirname, '..', 'manifest', 'source.yaml');

  if (fs.existsSync(templatesDir) && fs.existsSync(sourceYamlPath)) {
    const { ok, missing, diskFolders } = checkTemplateInventory(templatesDir, sourceYamlPath);
    if (!ok) {
      console.error(`❌ Template Inventory Mismatch! Folders exist in specs/templates/ but are missing from manifest/source.yaml: ${missing.join(', ')}`);
      process.exit(1);
    }
    console.log(`▶ Template Inventory Guard: all ${diskFolders.length} template folders are registered in manifest.`);
  }

  // 2. Orchestrator Line-Count Guard: enforce strictly < 200 physical lines per orchestrator
  const ORCHESTRATORS = [
    'scripts/manifest/validate-manifest.js',
    'scripts/manifest/check-parity.js',
    'scripts/skills-manager.js',
    'skills/nn-trannsform/scripts/scanner.js',
    'skills/nn-trannsform/scripts/provenance.js',
  ];

  const MAX_LINES = 200;
  let lineCountFailed = false;

  for (const relPath of ORCHESTRATORS) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (fs.existsSync(fullPath)) {
      const lineCount = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      if (lineCount >= MAX_LINES) {
        console.error(`❌ Line-Count Guard Violation: ${relPath} has ${lineCount} lines (limit: strictly < ${MAX_LINES}).`);
        lineCountFailed = true;
      } else {
        console.log(`▶ Line-Count Guard: ${relPath} (${lineCount} lines < ${MAX_LINES}).`);
      }
    }
  }

  if (lineCountFailed) {
    process.exit(1);
  }

  // 3. Workspace Parity Guard: ensure all local skills, templates, and MCP bundles match manifest/source.yaml
  run('node scripts/manifest/check-parity.js', 'Check Workspace Parity');

  // 4. Script static type checking
  run('tsc --noEmit -p tsconfig.scripts.json', 'Typecheck Scripts');

  // 5. Preflight Primitives Drift Guard: the committed version-status.generated.cjs
  //    must match the innfo-core source it is bundled from (single classifier, no
  //    hand-maintained copy). Its unit tests run in step 0b with the rest; this is
  //    the drift check against the real bundle. Runs BEFORE the stable-manifest
  //    validation (step 9), which halts on pre-existing pinned-tag drift and would
  //    otherwise make this unreachable in CI (W2/W3, slice-1 verify report).
  run('node scripts/build-preflight-primitives.mjs --check', 'Check Preflight Primitives Bundle Fresh');

  // 7. Template Catalog Drift Guard: the committed iNNfo/specs/templates/catalog.json
  //    must match the on-disk templates tree (workspace-template-upgrade, shared
  //    classifier input for check_workspace and the preflight CLI).
  run('node scripts/template-catalog.mjs --check', 'Check Template Catalog Fresh');

  // 7b. nn-trannsform slug mirror drift guard: the committed generated mirror must
  //     match a fresh esbuild render of innfo-core's slug primitives (single
  //     shared implementation, no hand-maintained copy).
  run('node scripts/build-trannsform-slug-mirror.mjs --check', 'Check Trannsform Slug Mirror Fresh');

  // 7c. Samples SSOT Drift Guard: ensure template sample files match _samples_nn/models/ SSOT
  run('node scripts/sync-samples.mjs --check', 'Check Samples Parity with _samples_nn');

  // 7d. Version SSOT Drift Guard: ensure SHIPPED_TEMPLATE_VERSIONS and
  //     manifest/source.yaml versions match specs and SKILL.md.
  //     Runs before step 8 so a stale manifest/source.yaml fails here first,
  //     not as a confusing rendered-doc diff.
  run('node scripts/sync-versions.mjs --check', 'Check Version Parity with Specs and Skills');

  // 8. Rendered stable manifest doc must be in sync with manifest/source.yaml.
  //    Deterministic (renders source.yaml and compares bytes). Runs BEFORE the
  //    live validation so a hand-edited generated manifest fails fast with a
  //    drift message instead of a misleading 404 from the tag check.
  run('node scripts/manifest/generate-manifest.js --channel stable --check', 'Check Stable Manifest Doc Fresh');

  // 9. Live stable-manifest publication check: every pin must resolve to a tag on
  //    a main-reachable commit. Release-state dependent (network + existing tags),
  //    so it only runs with --release (CI on push to main, and the release flow
  //    after tagging). Dev/pre-push skips it, because a release pin cannot exist
  //    before its tag is cut (release order: merge -> tag -> pin).
  if (release) {
    run('node scripts/manifest/validate-manifest.js --channel stable', 'Validate Stable Manifest');
  } else {
    console.log('\n▶ Skipping live stable-manifest validation (dev mode; run with --release after tagging).');
  }

  // 12. Template Immutability Guard (against real git state)
  run('node scripts/guard-template-immutability.js', 'Template Immutability Guard');

  // 13. Tracked-text encoding guard: fail on U+FFFD or undecodable UTF-8 bytes in
  //     any git-visible text file (binary and generated bundles skipped by rule).
  run('node scripts/guard-text-encoding.js', 'Guard Tracked Text Encoding');

  console.log('\n✅ [cogNNitive Verify] All deterministic pre-checks passed.');
}

if (require.main === module) {
  runVerification({ release: process.argv.includes('--release') });
}

module.exports = {
  checkTemplateInventory,
  runVerification,
  extractDeclaredTemplates,
};