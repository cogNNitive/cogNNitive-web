#!/usr/bin/env node
/**
 * scripts/lib/legacy-write-guard.js
 *
 * Legacy-write guard: stops the retired vocabulary from coming back into runtime
 * source. It is token-based (never the word "legacy", which appears in legitimate
 * quarantine code), and it scans runtime source only.
 *
 * Scan scope:
 *   - iNNfo/packages/<pkg>/src/**
 *   - iNNfo/apps/<app>/src/**
 *   - scripts/** (test files excluded)
 *   - skills/<name>/scripts/**
 *
 * Out of scan scope: vocabulary files, docs, SKILL.md prose, tests, `openspec/**`,
 * `docs/innfo/cdn/**` and frozen `_V_` files.
 *
 * Allowlist entries each carry a reason; an entry without a reason fails the guard.
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Retired tokens. `id` is stable, `re` is the match, `label` names the replacement.
 */
const TOKENS = [
  { id: 'template-version', re: /template_version/g, label: 'blueprint_version' },
  { id: 'template-name', re: /template_name/g, label: 'blueprint_name' },
  { id: 'model-version', re: /model_version/g, label: 'knowledge_version' },
  { id: 'models-dir', re: /models_dir/g, label: 'knowledge_dir' },
  { id: 'templates-dir', re: /templates_dir/g, label: 'blueprints_dir' },
  { id: 'target-template', re: /target_template/g, label: 'target_blueprint' },
  { id: 'type-model', re: /type::\s*model\b/g, label: 'type:: knowledge' },
  // Legacy URL alias map carve-out: the offline registry keeps lowercase `innfo/specs/templates/...`
  // aliases as permanent history, so only the canonical capital-`iNNfo` path is flagged.
  { id: 'specs-templates', re: /(?<!innfo\/)specs\/templates/g, label: 'specs/bluepriNNts' },
  { id: 'workspace-entrypoint', re: /workspace_NN\.md/g, label: 'domaiNN_NN.md' },
  { id: 'lowercase-knowledge-dir', re: /\bknowledge\//g, label: 'kNNowledge/' },
  // Pages path allowance: the canonical Pages URL `innfo/blueprints/catalog.json` is a
  // lowercase runtime string by design (D1), so `innfo/blueprints/` is carved out by lookbehind.
  { id: 'lowercase-blueprints-dir', re: /(?<!innfo\/)\bblueprints\//g, label: 'bluepriNNts/' },
];

/**
 * Paths allowed to carry retired tokens, each with a mandatory reason.
 * @type {Array<{ pattern: string, reason: string }>}
 */
const ALLOWLIST = [
  { pattern: 'iNNfo/packages/innfo-core/src/legacy/', reason: 'legacy quarantine module (ledger: quarantine/detector/language-map/schema-maps)' },
  { pattern: 'skills/nn-upgrade/scripts/lib/legacy-migrate.generated.cjs', reason: 'generated legacy-migrate bundle (ledger: migrate-bundle)' },
  { pattern: 'skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs', reason: 'generated legacy-detect bundle (ledger: detect-bundle)' },
  { pattern: 'scripts/migrate-spec-urls.mjs', reason: 'historical one-time codemod (cogNNitive/iNNfo -> monorepo) that must match the pre-migration paths' },
  { pattern: 'iNNfo/packages/innfo-core/src/validator/content.ts', reason: 'V_0-3-0 gate: detects and rejects retired frontmatter keys / the retired `type:: model` keyword with an explicit migration message' },
  { pattern: 'iNNfo/packages/innfo-core/src/schema/canonical-registry.ts', reason: 'offline fallback registry: embeds canonical spec copies + the permanent lowercase legacy URL/alias maps' },
  { pattern: 'skills/nn-trannsform/scripts/provenance.js', reason: 'detects the legacy `_workspace_NN.md` lineage record by name for one-time in-place migration to `_cogNNitive_NN.md`' },
  { pattern: 'skills/nn-trannsform/scripts/lib/provenance-knowledge.js', reason: 'legacy `_workspace_NN.md` lineage-record suffix documented for one-time migration' },
  { pattern: 'scripts/lib/legacy-write-guard.js', reason: 'this guard carries the token table itself' },
  { pattern: 'scripts/guard-template-immutability.js', reason: 'reads the retired `template_version` key only as a fallback to recognize the composition-root templates (base/cogNNitive/workspace) whose frontmatter still uses it' },
];

const SCOPE_RE = [
  /^iNNfo\/packages\/[^/]+\/src\//,
  /^iNNfo\/apps\/[^/]+\/src\//,
  /^scripts\//,
  /^skills\/[^/]+\/scripts\//,
];

/**
 * @param {string} relPath posix-style relative path
 * @returns {boolean}
 */
function inScope(relPath) {
  return SCOPE_RE.some((re) => re.test(relPath));
}

/**
 * @param {string} relPath posix-style relative path
 * @returns {boolean}
 */
function isExcluded(relPath) {
  if (relPath.startsWith('openspec/')) return true;
  if (relPath.startsWith('docs/')) return true;
  if (relPath.includes('/cdn/')) return true;
  if (relPath.startsWith('temp/') || relPath.includes('/temp/')) return true;
  if (/\.(test|spec)\.(js|mjs|ts|tsx|vue)$/.test(relPath)) return true;
  if (/_V_\d+-\d+-\d+/.test(relPath)) return true;
  return false;
}

/**
 * @param {string} relPath
 * @returns {{ pattern: string, reason: string } | null}
 */
function allowlistEntry(relPath) {
  for (const entry of ALLOWLIST) {
    if (!entry.reason || !entry.reason.trim()) continue;
    if (relPath === entry.pattern || relPath.startsWith(entry.pattern)) return entry;
  }
  return null;
}

/**
 * Validates the allowlist itself: every entry must carry a reason.
 * @returns {string[]} errors
 */
function validateAllowlist(allowlist = ALLOWLIST) {
  const errors = [];
  for (const entry of allowlist) {
    if (!entry || typeof entry.pattern !== 'string' || !entry.pattern.trim()) {
      errors.push('Allowlist entry is missing a pattern');
      continue;
    }
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push(`Allowlist entry "${entry.pattern}" is missing a reason`);
    }
  }
  return errors;
}

/**
 * Scans the runtime source for retired tokens.
 * @param {object} [options]
 * @param {string} [options.repoRoot]
 * @param {string[]} [options.files]
 * @param {(file: string) => string} [options.readFile]
 * @param {Array<{ id: string, re: RegExp, label: string }>} [options.tokens]
 * @param {Array<{ pattern: string, reason: string }>} [options.allowlist]
 * @returns {{ ok: boolean, errors: string[], hits: Array<{ file: string, token: string, label: string, line: number }> }}
 */
function checkLegacyWriteGuard(options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, '..', '..');
  const readFile = options.readFile || ((f) => fs.readFileSync(f, 'utf8'));
  const tokens = options.tokens || TOKENS;
  const allowlist = options.allowlist || ALLOWLIST;
  const errors = validateAllowlist(allowlist);
  const hits = [];

  const injected = Array.isArray(options.files);
  let files = options.files;
  if (!files) {
    try {
      const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' });
      files = output.split(/\r?\n/).filter(Boolean);
    } catch (err) {
      errors.push(`Failed to list files: ${err.message}`);
      files = [];
    }
  }

  for (const raw of files) {
    const relPath = raw.split(path.sep).join('/');
    if (!inScope(relPath)) continue;
    if (isExcluded(relPath)) continue;
    if (allowlist.some((e) => e.reason && e.reason.trim() && (relPath === e.pattern || relPath.startsWith(e.pattern)))) continue;

    const fullPath = path.isAbsolute(raw) ? raw : path.join(repoRoot, raw);
    if (!injected && !fs.existsSync(fullPath)) continue;

    let content;
    try {
      content = readFile(injected ? raw : fullPath);
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (const token of tokens) {
      for (let i = 0; i < lines.length; i++) {
        token.re.lastIndex = 0;
        if (token.re.test(lines[i])) {
          hits.push({ file: relPath, token: token.id, label: token.label, line: i + 1 });
        }
      }
    }
  }

  for (const hit of hits) {
    errors.push(`Retired token '${hit.token}' (use ${hit.label}) in ${hit.file}:${hit.line}`);
  }

  return { ok: errors.length === 0, errors, hits };
}

if (require.main === module) {
  const result = checkLegacyWriteGuard();
  if (!result.ok) {
    console.error('❌ Legacy Write Guard failed:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }
  console.log('▶ Legacy Write Guard: no retired tokens in runtime source.');
}

module.exports = { checkLegacyWriteGuard, inScope, isExcluded, allowlistEntry, validateAllowlist, TOKENS, ALLOWLIST };
