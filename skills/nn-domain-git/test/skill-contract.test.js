#!/usr/bin/env node

/**
 * skills/nn-domain-git/test/skill-contract.test.js
 *
 * Persisted fixture checks for the nn-domain-git skill contract
 * (change 2026-09-09-nn-domain-git-plus-collaboration-git-docs).
 *
 * Zero external test framework deps (repo convention: skills-manager.test.js,
 * backup-workspace.test.js). Uses the repo's yaml-lite subset parser for
 * frontmatter. Run with:
 *
 *   node skills/nn-domain-git/test/skill-contract.test.js
 *
 * Covers the spec scenarios that are mechanically testable:
 *   1. SKILL.md frontmatter contract (Explicit Invocation Gate)
 *   2. Step 3a .gitignore patterns (Private Repository Default)
 *   3. Step 3c two-layer version->commit map format (Two-Layer Version Map)
 *   4. documentation_NN.md Page block + _sidebar.md entry (Guide Page)
 *   5. English-only scan of skill + docs page (non-ASCII = emoji/typography only)
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter, parseFocusedYaml } = require('../../../scripts/lib/yaml-lite.js');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'nn-domain-git', 'SKILL.md');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'innfo', 'documentation', 'collaboration-git.md');
const MODEL_PATH = path.join(REPO_ROOT, 'docs', 'innfo', 'documentation', 'documentation_NN.md');
const SIDEBAR_PATH = path.join(REPO_ROOT, 'docs', 'innfo', 'documentation', '_sidebar.md');

// Step 3a contract: opinionated .gitignore emitted at workspace root.
const GITIGNORE_PATTERNS = [
  'staging/',
  'specs/',
  '*.env',
  '*.token',
  '*.pem',
  '*.key',
  'secrets/',
];

// English-only rule: non-ASCII is allowed ONLY for emoji and typography
// (dashes, arrows, smart quotes, variation selectors). Anything else is a
// language violation (e.g. accented Latin, CJK, Cyrillic).
function isAllowedNonAscii(cp) {
  // Emoji blocks: Misc Symbols + Dingbats (U+2600..U+27BF),
  // Emoticons + Supplemental Symbols & Pictographs (U+1F000..U+1FAFF).
  if (cp >= 0x2600 && cp <= 0x27bf) return true;
  if (cp >= 0x1f000 && cp <= 0x1faff) return true;
  // Typography: en/em dashes, smart quotes, arrows (incl. U+2194), variation selectors.
  if (cp >= 0x2013 && cp <= 0x2015) return true;
  if (cp >= 0x2018 && cp <= 0x201d) return true;
  if (cp >= 0x2190 && cp <= 0x21ff) return true;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  return false;
}

function findNonAsciiViolations(text) {
  const violations = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f) continue;
    if (!isAllowedNonAscii(cp)) {
      violations.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} (${ch})`);
    }
  }
  return violations;
}

function extractGitignoreBlock(text) {
  const match = text.match(/```gitignore\n([\s\S]*?)```/);
  assert.ok(match, 'gitignore code block must be present');
  return match[1];
}

function assertGitignoreBlock(block, sourceLabel) {
  for (const pattern of GITIGNORE_PATTERNS) {
    assert.ok(
      block.split('\n').map((l) => l.trim()).includes(pattern),
      `${sourceLabel}: .gitignore must contain pattern "${pattern}"`
    );
  }
}

function main() {
  console.log('Running nn-domain-git skill-contract tests...');

  // ---------- 1. SKILL.md frontmatter contract (Explicit Invocation Gate) ----------
  {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const fm = parseFocusedYaml(parseFrontmatter(skill));

    assert.strictEqual(fm.name, 'nn-domain-git', 'frontmatter name');
    assert.match(fm.description, /\/nn-domain-git/, 'description must name the explicit trigger');
    assert.strictEqual(fm['disable-model-invocation'], true, 'disable-model-invocation must be true');
    assert.strictEqual(fm.version, 'V_0-1-0', 'version must be V_0-1-0');
    assert.strictEqual(fm.metadata.source_type, 'original', 'source_type must be original');
    assert.strictEqual(fm.license, 'MIT', 'license must be MIT');
    assert.strictEqual(fm.compatibility, 'opencode, claude-code, cursor', 'compatibility list');
    assert.deepStrictEqual(fm.bundled_blueprints, [], 'bundled_blueprints must be empty');

    // Alpha warning + abort-with-zero-side-effects + double-confirm contract text.
    assert.match(skill, /ALPHA[\s\S]*technicians with prior Git experience/, 'alpha warning must gate to technicians');
    assert.match(skill, /no repo created, no branch cut, no remote touched/, 'abort text must promise zero side effects');
    assert.match(skill, /REQUIRE two explicit confirmations/, 'double-confirm rule must be present');
    assert.match(skill, /activates ONLY via explicit user invocation/, 'explicit-invocation-only text');
    console.log('✔ frontmatter contract: 10 fields + gate text match');
  }

  // ---------- 2. Step 3a .gitignore patterns (Private Repository Default) ----------
  {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const doc = fs.readFileSync(DOC_PATH, 'utf8');

    assert.match(skill, /Create the remote repository as \*\*private\*\*/, 'private default must be documented');
    assertGitignoreBlock(extractGitignoreBlock(skill), 'SKILL.md Step 3a');
    assertGitignoreBlock(extractGitignoreBlock(doc), 'collaboration-git.md');

    // Secret file stays untracked: git-status confirmation is mandated.
    assert.match(skill, /ignored paths MUST NOT appear as staged/, 'secret-untracked rule in skill');
    assert.match(doc, /must never appear as staged/, 'secret-untracked rule in docs');
    console.log('✔ .gitignore: all 8 patterns present in skill + docs; secret-untracked rule');
  }

  // ---------- 3. Two-layer version->commit map format (Two-Layer Version Map) ----------
  {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const doc = fs.readFileSync(DOC_PATH, 'utf8');

    // Format template from Step 3c: `| V_0-2-0 | <sha> | <date> |` under the map header.
    assert.match(skill, /\| Model version \| Git commit \| Date \|/, 'map header in skill');
    assert.match(skill, /\| V_0-2-0 \| <sha> \| <date> \|/, 'map row format template in skill');
    assert.match(skill, /\| V_0-2-0 \| `a1b2c3d` \| 2026-09-09 \|/, 'map example row in skill');
    assert.match(skill, /A version NEVER equals a commit/, 'no-conflation statement in skill');

    assert.match(doc, /\| Model version \| Git commit \| Date \|/, 'map header in docs');
    assert.match(doc, /\| V_0-2-0 \| `a1b2c3d` \| 2026-09-09 \|/, 'map example row in docs');
    assert.match(doc, /A version never equals a commit/, 'no-conflation statement in docs');

    // Triangulation: every map row must have the 3-cell `| V_x-y-z | value | value |`
    // shape. Rows carrying <placeholder> cells are the format template (asserted
    // separately above); concrete rows must resolve the third cell to an ISO date.
    const rowRe = /^\| V_\d+-\d+-\d+ \| .+ \| .+ \|$/;
    const concreteRe = /^\| V_\d+-\d+-\d+ \| .+ \| \d{4}-\d{2}-\d{2} \|$/;
    for (const line of skill.split('\n')) {
      if (line.trim().startsWith('| V_')) {
        assert.match(line.trim(), rowRe, `skill map row shape: ${line.trim()}`);
        if (!line.includes('<')) {
          assert.match(line.trim(), concreteRe, `skill concrete row must carry an ISO date: ${line.trim()}`);
        }
      }
    }
    for (const line of doc.split('\n')) {
      if (line.trim().startsWith('| V_')) {
        assert.match(line.trim(), rowRe, `docs map row shape: ${line.trim()}`);
        if (!line.includes('<')) {
          assert.match(line.trim(), concreteRe, `docs concrete row must carry an ISO date: ${line.trim()}`);
        }
      }
    }
    console.log('✔ two-layer map: header + format template + ISO-date row shape in skill + docs');
  }

  // ---------- 4. documentation_NN.md Page block + sidebar entry (Guide Page) ----------
  {
    const model = fs.readFileSync(MODEL_PATH, 'utf8');
    const sidebar = fs.readFileSync(SIDEBAR_PATH, 'utf8');

    const pageBlock = model.match(/## NN Page: Collaboration with Git[\s\S]*?description::[^\n]*/);
    assert.ok(pageBlock, 'Collaboration with Git Page block must exist in documentation_NN.md');
    const block = pageBlock[0];
    assert.match(block, /source:: collaboration-git\.md/, 'Page source must point at collaboration-git.md');
    assert.match(block, /route:: collaboration-git/, 'Page route must be collaboration-git');
    assert.match(block, /order:: 50/, 'Page order must be 50 (next free under Guides)');
    assert.match(block, /parent:: \[\[Guides\]\]/, 'Page parent must be [[Guides]]');

    assert.match(sidebar, /- \[Collaboration with Git\]\(collaboration-git\)/, 'sidebar must list the guide');
    console.log('✔ docs page: NN Page block fields + sidebar entry present');
  }

  // ---------- 5. English-only scan (non-ASCII = emoji/typography only) ----------
  {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8');
    const doc = fs.readFileSync(DOC_PATH, 'utf8');

    const skillViolations = findNonAsciiViolations(skill);
    const docViolations = findNonAsciiViolations(doc);
    assert.deepStrictEqual(skillViolations, [], `SKILL.md non-ASCII violations: ${skillViolations.join(', ')}`);
    assert.deepStrictEqual(docViolations, [], `collaboration-git.md non-ASCII violations: ${docViolations.join(', ')}`);

    // Negative triangulation: the scanner must actually catch language violations.
    assert.ok(findNonAsciiViolations('café — revisión').length > 0, 'scanner must flag accented Latin (é)');
    assert.ok(findNonAsciiViolations('日本語テキスト').length > 0, 'scanner must flag CJK');
    // And must NOT flag allowed emoji/typography.
    assert.deepStrictEqual(findNonAsciiViolations('🔧 — ↔ ⚠️'), [], 'scanner must allow emoji + typography');
    console.log('✔ english-only: zero violations in skill + docs; scanner sensitivity verified');
  }

  console.log('All nn-domain-git skill-contract tests passed successfully!');
}

main();