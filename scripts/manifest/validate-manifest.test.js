#!/usr/bin/env node
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const validatorScript = path.join(__dirname, 'validate-manifest.js');

/**
 * Builds the minimal Response-like object github-client.js consumes:
 * `.status`, `.text()` and `.headers.get(name)`.
 *
 * @param {number} status
 * @param {string} body
 * @param {Record<string, string>} [headers={}]
 * @returns {{ status: number, text: () => Promise<string>, headers: { get: (n: string) => string | null } }}
 */
function fakeResponse(status, body, headers = {}) {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    status,
    text: async () => body,
    headers: { get: (name) => lower.get(String(name).toLowerCase()) ?? null },
  };
}

/**
 * Stubs the global `fetch` with a single canned response.
 *
 * github-client.js used to be built on `https.get`, and these helpers used to
 * monkeypatch that. Since the client moved to global `fetch`, stubbing
 * `https.get` intercepted nothing: the suite issued REAL network calls to
 * GitHub and asserted live SHAs against fixed fixtures. Stub what the code
 * under test actually calls.
 *
 * @param {number} statusCode
 * @param {string} body
 * @returns {{ restore: () => void, capturedOptions: () => RequestInit | null }}
 */
function stubFetchOnce(statusCode, body) {
  const originalFetch = globalThis.fetch;
  let capturedOptions = null;
  globalThis.fetch = async (url, options) => {
    capturedOptions = options;
    return fakeResponse(statusCode, body);
  };
  return {
    restore: () => { globalThis.fetch = originalFetch; },
    capturedOptions: () => capturedOptions,
  };
}

function freshValidatorModule() {
  delete require.cache[require.resolve(validatorScript)];
  try {
    delete require.cache[require.resolve('../lib/github-client.js')];
    delete require.cache[require.resolve('./lib/manifest-rules.js')];
  } catch (_) {}
  return require(validatorScript);
}

/**
 * Stubs the global `fetch` with an ordered list of canned responses; the last
 * entry is reused once the list is exhausted.
 *
 * @param {Array<{ status: number, body: string, headers?: Record<string, string> }>} responses
 * @returns {{ restore: () => void, urls: () => string[] }}
 */
function stubFetchSequence(responses) {
  const originalFetch = globalThis.fetch;
  let call = 0;
  const capturedUrls = [];
  globalThis.fetch = async (url, _options) => {
    capturedUrls.push(url);
    const { status, body, headers } = responses[Math.min(call, responses.length - 1)];
    call++;
    return fakeResponse(status, body, headers);
  };
  return {
    restore: () => { globalThis.fetch = originalFetch; },
    urls: () => capturedUrls,
  };
}

function createTempManifestDir(manifestContent) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eNNvironment-test-'));
  const docsUseDir = path.join(tmpDir, 'docs', 'use');
  fs.mkdirSync(docsUseDir, { recursive: true });
  fs.writeFileSync(path.join(docsUseDir, 'manifest.md'), manifestContent, 'utf-8');
  return tmpDir;
}

async function main() {
console.log('Running validate-manifest unit tests...');

// 1. Legacy manifest entry (no templates, no mcp) passes full stable-channel validation.
//    Stubbed API per design's testing strategy — a real tag is a Phase 0 precondition
//    this unit suite must not depend on.
{
  const mod = freshValidatorModule();
  const skill = {
    name: 'nn-router',
    repo: 'cogNNitive/actioNN',
    path: 'skills/nn-router',
    version: '3.2',
    ref: 'skills-v1.0.0',
    commit: 'd60a7109315820085ab127b70412992db6986c88',
  };
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ sha: skill.commit }) }, // checkCommitExists
    { status: 200, body: JSON.stringify({ object: { sha: skill.commit, type: 'commit' } }) }, // resolveRef tag lookup
    { status: 200, body: JSON.stringify({ status: 'identical' }) }, // checkReleaseProvenance
    { status: 200, body: JSON.stringify([{ name: 'SKILL.md' }]) }, // checkPathAtCommit
    { status: 200, body: '---\nversion: "3.2"\n---\n# SKILL' }, // checkVersionParity
  ]);
  try {
    const { violations } = await mod.validateSkill(skill, mod.CHANNELS.stable);
    assert.deepStrictEqual(violations, [], `Legacy manifest entry should pass validation. Violations: ${JSON.stringify(violations)}`);
    console.log('✔ Legacy manifest backward compatibility test passed');
  } finally {
    stub.restore();
  }
}

// 1b. Manifest entry omitting `ref` fails structural validation (ref is now mandatory)
{
  const noRefContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-router
      repo: cogNNitive/actioNN
      path: skills/nn-router
      version: "3.2"
      commit: "d60a7109315820085ab127b70412992db6986c88"
---
# Manifest`;

  const tmpDir = createTempManifestDir(noRefContent);
  try {
    const res = spawnSync('node', [validatorScript, tmpDir], { encoding: 'utf-8' });
    assert.notStrictEqual(res.status, 0, 'Manifest entry without ref should fail validation');
    assert.match(res.stderr, /missing field 'ref'/);
    console.log('✔ Mandatory ref field test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 2. Invalid commit SHA (not 40-char hex sha) fails validation
{
  const invalidShaContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-router
      repo: cogNNitive/actioNN
      path: skills/nn-router
      version: "3.2"
      commit: "invalid-sha"
---
# Manifest`;

  const tmpDir = createTempManifestDir(invalidShaContent);
  try {
    const res = spawnSync('node', [validatorScript, tmpDir], { encoding: 'utf-8' });
    assert.notStrictEqual(res.status, 0, 'Invalid commit SHA should fail validation');
    assert.match(res.stderr, /is not a 40-char hex sha/);
    console.log('✔ Structural validation (invalid SHA) test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 3. Missing dependency closure (workflow referencing undeclared template) fails
{
  const missingClosureContent = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
  workflows:
    - id: test-wf
      label: Test Workflow
      blueprint: missing_template_spec
---
# Manifest`;

  const tmpDir = createTempManifestDir(missingClosureContent);
  try {
    const res = spawnSync('node', [validatorScript, tmpDir], { encoding: 'utf-8' });
    assert.notStrictEqual(res.status, 0, 'Missing dependency closure should fail validation');
    assert.match(res.stderr, /references blueprint 'missing_template_spec' which is not declared/);
    console.log('✔ Dependency closure (missing blueprint) test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 4. GITHUB_TOKEN is sent as an Authorization: Bearer header by apiRequest and fetchString
{
  const previousToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'test-token-12345';
  const mod = freshValidatorModule();

  {
    const stub = stubFetchOnce(200, '{}');
    try {
      await mod.apiRequest('https://api.github.com/repos/cogNNitive/eNNvironment/commits/abc');
      const headers = stub.capturedOptions().headers;
      assert.strictEqual(headers.Authorization, 'Bearer test-token-12345', 'apiRequest should send Authorization: Bearer when GITHUB_TOKEN is set');
    } finally {
      stub.restore();
    }
  }

  {
    const stub = stubFetchOnce(200, 'raw body');
    try {
      await mod.fetchString('https://raw.githubusercontent.com/cogNNitive/eNNvironment/abc/README.md');
      const headers = stub.capturedOptions().headers;
      assert.strictEqual(headers.Authorization, 'Bearer test-token-12345', 'fetchString should send Authorization: Bearer when GITHUB_TOKEN is set');
    } finally {
      stub.restore();
    }
  }

  if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = previousToken;
  freshValidatorModule();
  console.log('✔ GITHUB_TOKEN Authorization header test passed');
}

// 5. Repo-scoped commit existence: 422 means "wrong repo", 200 means it exists
{
  const mod = freshValidatorModule();
  const item = {
    name: 'workspace_spec_NN',
    repo: 'cogNNitive/cogNNitive',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };

  {
    const stub = stubFetchOnce(422, JSON.stringify({ message: 'No commit found for SHA' }));
    try {
      const violation = await mod.checkCommitExists(item);
      assert.notStrictEqual(violation, null, '422 should be reported as a violation');
      assert.match(violation, /cogNNitive\/cogNNitive/, 'violation must name the declared repo');
      assert.match(violation, /wrong repo/i, '422 violation must be distinguishable as a wrong-repo error');
    } finally {
      stub.restore();
    }
  }

  {
    const stub = stubFetchOnce(200, JSON.stringify({ sha: item.commit }));
    try {
      const violation = await mod.checkCommitExists(item);
      assert.strictEqual(violation, null, '200 should pass repo-scoped existence check');
    } finally {
      stub.restore();
    }
  }

  console.log('✔ Repo-scoped commit existence (422 vs 200) test passed');
}

// 6. CHANNELS table: stable requires tag, preview requires branch; each has its own file
{
  const mod = freshValidatorModule();
  assert.strictEqual(mod.CHANNELS.stable.file, 'docs/use/manifest.md');
  assert.strictEqual(mod.CHANNELS.stable.requiredRefKind, 'tag');
  assert.strictEqual(mod.CHANNELS.stable.requireTagShape, true);
  assert.strictEqual(mod.CHANNELS.stable.requireProvenance, true);
  assert.strictEqual(mod.CHANNELS.preview.file, 'docs/use/manifest-next.md');
  assert.strictEqual(mod.CHANNELS.preview.requiredRefKind, 'branch');
  assert.strictEqual(mod.CHANNELS.preview.requireTagShape, false);
  assert.strictEqual(mod.CHANNELS.preview.requireProvenance, false);
  console.log('✔ CHANNELS policy table test passed');
}

// 7. resolveRef: lightweight tag resolves directly to its commit
{
  const mod = freshValidatorModule();
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ ref: 'refs/tags/skills-v1.0.0', object: { sha: 'd60a7109315820085ab127b70412992db6986c88', type: 'commit' } }) },
  ]);
  try {
    const result = await mod.resolveRef('cogNNitive/actioNN', 'skills-v1.0.0');
    assert.strictEqual(result.sha, 'd60a7109315820085ab127b70412992db6986c88');
    assert.strictEqual(result.kind, 'tag');
  } finally {
    stub.restore();
  }
  console.log('✔ resolveRef lightweight tag test passed');
}

// 8. resolveRef: annotated tag is peeled via git/tags/{sha} to the underlying commit
{
  const mod = freshValidatorModule();
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ ref: 'refs/tags/templates-v0.2.0', object: { sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', type: 'tag' } }) },
    { status: 200, body: JSON.stringify({ object: { sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', type: 'commit' } }) },
  ]);
  try {
    const result = await mod.resolveRef('cogNNitive/cogNNitive', 'templates-v0.2.0');
    assert.strictEqual(result.sha, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.strictEqual(result.kind, 'tag');
    assert.match(stub.urls()[1], /git\/tags\/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/, 'must peel via git/tags/{sha}');
  } finally {
    stub.restore();
  }
  console.log('✔ resolveRef annotated tag peel test passed');
}

// 9. resolveRef: falls back to a branch ref when no tag matches
{
  const mod = freshValidatorModule();
  const stub = stubFetchSequence([
    { status: 404, body: JSON.stringify({ message: 'Not Found' }) },
    { status: 200, body: JSON.stringify({ ref: 'refs/heads/feat/innfo-v0-2-0-adoption', object: { sha: 'cccccccccccccccccccccccccccccccccccccccc', type: 'commit' } }) },
  ]);
  try {
    const result = await mod.resolveRef('cogNNitive/actioNN', 'feat/innfo-v0-2-0-adoption');
    assert.strictEqual(result.sha, 'cccccccccccccccccccccccccccccccccccccccc');
    assert.strictEqual(result.kind, 'branch');
  } finally {
    stub.restore();
  }
  console.log('✔ resolveRef branch fallback test passed');
}

// 10. resolveRef: neither tag nor branch resolves -> error
{
  const mod = freshValidatorModule();
  const stub = stubFetchSequence([
    { status: 404, body: '{}' },
    { status: 404, body: '{}' },
  ]);
  try {
    const result = await mod.resolveRef('cogNNitive/cogNNitive', 'does-not-exist');
    assert.ok(result.error, 'unresolved ref must return an error');
  } finally {
    stub.restore();
  }
  console.log('✔ resolveRef unresolved ref test passed');
}

// 11. tagShapeViolation: enforces `<name>-vX.Y.Z`
{
  const mod = freshValidatorModule();
  assert.strictEqual(mod.tagShapeViolation({ name: 'x', ref: 'skills-v1.0.0' }), null);
  assert.notStrictEqual(mod.tagShapeViolation({ name: 'x', ref: 'v1.0.0' }), null);
  assert.notStrictEqual(mod.tagShapeViolation({ name: 'x', ref: 'feat/some-branch' }), null);
  console.log('✔ tagShapeViolation test passed');
}

// 12. refKindViolation: entry ref kind must match the channel policy's requiredRefKind
{
  const mod = freshValidatorModule();
  assert.strictEqual(mod.refKindViolation({ name: 'x', ref: 'skills-v1.0.0' }, 'tag', mod.CHANNELS.stable), null);
  assert.notStrictEqual(mod.refKindViolation({ name: 'x', ref: 'feat/branch' }, 'branch', mod.CHANNELS.stable), null);
  assert.strictEqual(mod.refKindViolation({ name: 'x', ref: 'feat/branch' }, 'branch', mod.CHANNELS.preview), null);
  console.log('✔ refKindViolation test passed');
}

// 13. checkReleaseProvenance: 'ahead' of main fails stable, 'identical'/'behind' pass
{
  const mod = freshValidatorModule();
  {
    const stub = stubFetchSequence([{ status: 200, body: JSON.stringify({ status: 'ahead' }) }]);
    try {
      const violation = await mod.checkReleaseProvenance('cogNNitive/cogNNitive', 'deadbeef00000000000000000000000000000000');
      assert.notStrictEqual(violation, null, 'ahead of main must fail release provenance');
    } finally {
      stub.restore();
    }
  }
  {
    const stub = stubFetchSequence([{ status: 200, body: JSON.stringify({ status: 'identical' }) }]);
    try {
      const violation = await mod.checkReleaseProvenance('cogNNitive/cogNNitive', 'deadbeef00000000000000000000000000000000');
      assert.strictEqual(violation, null, 'identical to main must pass release provenance');
    } finally {
      stub.restore();
    }
  }
  {
    const stub = stubFetchSequence([{ status: 200, body: JSON.stringify({ status: 'behind' }) }]);
    try {
      const violation = await mod.checkReleaseProvenance('cogNNitive/cogNNitive', 'deadbeef00000000000000000000000000000000');
      assert.strictEqual(violation, null, 'behind main must pass release provenance');
    } finally {
      stub.restore();
    }
  }
  console.log('✔ checkReleaseProvenance test passed');
}

// 14. mcp-url-pinned: url must embed the entry's own commit, /main/ must fail
{
  const mod = freshValidatorModule();
  const pinned = {
    name: 'innfo-mcp',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js',
    ref: 'innfo-mcp-v0.2.1',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
    url: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6/iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js',
  };
  assert.strictEqual(await mod.checkMcpUrlPinned(pinned), null, 'commit-pinned mcp url must pass');
  const unpinned = {
    ...pinned,
    url: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js',
  };
  const violation = await mod.checkMcpUrlPinned(unpinned);
  assert.notStrictEqual(violation, null, 'unpinned (/main/) mcp url must fail');
  assert.match(violation, /main/, 'violation should identify the unpinned branch segment');
  console.log('✔ mcp-url-pinned test passed');
}

// 14b. validateMcp: verifies commit existence, policy, url pin, and file existence at commit
{
  const mod = freshValidatorModule();
  const entry = {
    name: 'innfo-mcp',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js',
    version: '0.2.4',
    ref: 'innfo-mcp-v0.2.4',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
    url: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6/iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js',
  };

  // Passing case
  {
    const stub = stubFetchSequence([
      { status: 200, body: JSON.stringify({ sha: entry.commit }) }, // checkCommitExists
      { status: 200, body: JSON.stringify({ object: { sha: entry.commit, type: 'commit' } }) }, // resolveRef
      { status: 200, body: JSON.stringify({ status: 'identical' }) }, // checkReleaseProvenance
      { status: 200, body: JSON.stringify({ name: 'innfo-mcp.bundle.js' }) }, // contents check
    ]);
    try {
      const violations = await mod.validateMcp(entry, mod.CHANNELS.stable);
      assert.deepStrictEqual(violations, [], `Valid MCP entry should have no violations. Got: ${JSON.stringify(violations)}`);
      console.log('✔ validateMcp happy path test passed');
    } finally {
      stub.restore();
    }
  }

  // Failing case: path not found at commit
  {
    const stub = stubFetchSequence([
      { status: 200, body: JSON.stringify({ sha: entry.commit }) }, // checkCommitExists
      { status: 200, body: JSON.stringify({ object: { sha: entry.commit, type: 'commit' } }) }, // resolveRef
      { status: 200, body: JSON.stringify({ status: 'identical' }) }, // checkReleaseProvenance
      { status: 404, body: JSON.stringify({ message: 'Not Found' }) }, // contents check 404
    ]);
    try {
      const violations = await mod.validateMcp(entry, mod.CHANNELS.stable);
      assert.strictEqual(violations.some(v => v.includes('path iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js not found')), true);
      console.log('✔ validateMcp missing path violation test passed');
    } finally {
      stub.restore();
    }
  }
}

// 14c. console-assets: parser surfaces the block and validateConsoleAsset passes a valid pinned entry
{
  const mod = freshValidatorModule();
  const manifestText = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
  console-assets:
    - file: iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
      version: "0.1.0"
      ref: "innfo-console-v0.1.0"
      commit: "3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6"
      url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
---
# Manifest`;
  const parsed = mod.parseManifest(manifestText);
  assert.strictEqual(parsed.consoleAssets.length, 1, 'console-assets must be parsed');
  assert.strictEqual(parsed.consoleAssets[0].file, 'iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js');
  assert.strictEqual(parsed.consoleAssets[0].version, '0.1.0');

  // validateConsoleAsset happy path: commit exists, ref resolves, provenance identical, path present
  const entry = parsed.consoleAssets[0];
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ sha: entry.commit }) }, // checkCommitExists
    { status: 200, body: JSON.stringify({ object: { sha: entry.commit, type: 'commit' } }) }, // resolveRef
    { status: 200, body: JSON.stringify({ status: 'identical' }) }, // checkReleaseProvenance
    { status: 200, body: JSON.stringify({ name: 'innfo-console.bundle.js' }) }, // contents check
  ]);
  try {
    const violations = await mod.validateConsoleAsset(entry, mod.CHANNELS.stable);
    assert.deepStrictEqual(violations, [], `Valid console asset entry should have no violations. Got: ${JSON.stringify(violations)}`);
    console.log('✔ console-assets parser + validateConsoleAsset happy path test passed');
  } finally {
    stub.restore();
  }
}

// 15. --channel CLI flag selects a single channel file; unknown channel is rejected
{
  const tmpDir = createTempManifestDir('---\nagent-bootstrap:\n  version: "2.0"\n  skills: []\n---\n# Manifest');
  try {
    const res = spawnSync('node', [validatorScript, tmpDir, '--channel', 'bogus'], { encoding: 'utf-8' });
    assert.notStrictEqual(res.status, 0, 'unknown channel must fail fast');
    assert.match(res.stderr, /unknown channel/i);
    console.log('✔ --channel CLI flag validation test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Template pin <-> main coherence gate (checkBlueprintMainCoherence)

// 16. Identical pinned and main content: no coherence violation; fetch order is
//     pinned commit first, then main.
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const body = '---\nversion: "V_0-2-1"\n---\n# Workspace Template\n';
  const stub = stubFetchSequence([
    { status: 200, body }, // pinned commit
    { status: 200, body }, // main
  ]);
  try {
    const violations = await mod.checkBlueprintMainCoherence(template);
    assert.deepStrictEqual(violations, [], `Identical pin/main must be coherent. Got: ${JSON.stringify(violations)}`);
    assert.match(stub.urls()[0], new RegExp(`/${template.commit}/`), 'first fetch must be the pinned commit');
    assert.match(stub.urls()[1], /\/main\//, 'second fetch must be main');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (identical) test passed');
}

// 17. main-ahead drift: pinned body differs from main body -> one violation
//     naming the path, the pinned commit, and both revisions.
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const pinBody = '---\nversion: "V_0-2-1"\n---\n# Workspace Template (pinned)\n';
  const mainBody = '---\nversion: "V_0-2-1"\n---\n# Workspace Template (unreleased main work)\n';
  const stub = stubFetchSequence([
    { status: 200, body: pinBody },
    { status: 200, body: mainBody },
  ]);
  try {
    const violations = await mod.checkBlueprintMainCoherence(template);
    assert.strictEqual(violations.length, 1, `main-ahead drift must yield exactly 1 violation. Got: ${JSON.stringify(violations)}`);
    const violation = violations[0];
    assert.ok(violation.includes(template.path), 'violation must name the template path');
    assert.ok(violation.includes(template.commit), 'violation must name the pinned commit');
    assert.ok(violation.includes('main'), 'violation must name the main revision');
    assert.ok(violation.includes(template.repo), 'violation must name the repo');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (main-ahead drift) test passed');
}

// 18. tag-ahead drift: main body differs from pinned body (reverse fixture) ->
//     one violation with the same direction-agnostic message shape.
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const pinBody = '---\nversion: "V_0-2-1"\n---\n# Workspace Template (unreleased main work)\n';
  const mainBody = '---\nversion: "V_0-2-1"\n---\n# Workspace Template (pinned)\n';
  const stub = stubFetchSequence([
    { status: 200, body: pinBody },
    { status: 200, body: mainBody },
  ]);
  try {
    const violations = await mod.checkBlueprintMainCoherence(template);
    assert.strictEqual(violations.length, 1, `tag-ahead drift must yield exactly 1 violation. Got: ${JSON.stringify(violations)}`);
    const violation = violations[0];
    assert.ok(violation.includes(template.path), 'violation must name the template path');
    assert.ok(violation.includes(template.commit), 'violation must name the pinned commit');
    assert.ok(violation.includes('main'), 'violation must name the main revision');
    assert.ok(violation.includes(template.repo), 'violation must name the repo');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (tag-ahead drift) test passed');
}

// 19. Rate limit on the main fetch (403): violation carries RATE_LIMIT_HINT and
//     the rule never throws.
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const stub = stubFetchSequence([
    { status: 200, body: '---\nversion: "V_0-2-1"\n---\n# Workspace Template\n' },
    { status: 403, body: 'rate limited' },
  ]);
  try {
    const violations = await mod.checkBlueprintMainCoherence(template);
    assert.strictEqual(violations.length, 1, `rate limit must yield exactly 1 violation. Got: ${JSON.stringify(violations)}`);
    assert.match(violations[0], /set GITHUB_TOKEN to raise the rate limit/, 'rate-limited fetch must append RATE_LIMIT_HINT');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (rate limit) test passed');
}

// 20. CRLF + BOM on the pinned body, plain LF on main: normalized equality, so
//     no violation (whitespace/BOM-only diffs must not trip the gate).
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const crlfBomBody = '\uFEFF---\r\nversion: "V_0-2-1"\r\n---\r\n# Workspace Template\r\n';
  const lfBody = '---\nversion: "V_0-2-1"\n---\n# Workspace Template\n';
  const stub = stubFetchSequence([
    { status: 200, body: crlfBomBody },
    { status: 200, body: lfBody },
  ]);
  try {
    const violations = await mod.checkBlueprintMainCoherence(template);
    assert.deepStrictEqual(violations, [], `CRLF/BOM-only difference must normalize to coherence. Got: ${JSON.stringify(violations)}`);
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (CRLF/BOM normalization) test passed');
}

// 21. Preview channel: validateBlueprint with the preview policy must NOT run the
//     coherence gate (no /main/ fetch, no coherence violation).
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'feat/innfo-v0-2-0-adoption',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ sha: template.commit }) }, // checkCommitExists
    { status: 404, body: JSON.stringify({ message: 'Not Found' }) }, // resolveRef tag miss
    { status: 200, body: JSON.stringify({ ref: 'refs/heads/feat/innfo-v0-2-0-adoption', object: { sha: template.commit, type: 'commit' } }) }, // resolveRef branch
    { status: 200, body: JSON.stringify({ name: 'workspace_V_0-3-0_spec_NN.md' }) }, // contents@commit
    { status: 200, body: '---\nversion: "V_0-2-1"\n---\n# Workspace Template\n' }, // version parity raw
  ]);
  try {
    const violations = await mod.validateBlueprint(template, mod.CHANNELS.preview);
    assert.deepStrictEqual(violations, [], `Preview template must validate cleanly. Got: ${JSON.stringify(violations)}`);
    assert.ok(!stub.urls().some((u) => /\/main\//.test(u)), 'preview must never fetch the /main/ URL');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (preview not evaluated) test passed');
}

// 22. Stable wiring end-to-end: full stable sequence with identical bodies ->
//     validateBlueprint returns [] AND both coherence raw URLs (pin + main) are
//     fetched, proving the gate runs on the stable channel.
{
  const mod = freshValidatorModule();
  const template = {
    name: 'workspace',
    repo: 'cogNNitive/cogNNitive',
    path: 'iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md',
    version: 'V_0-2-1',
    ref: 'templates-v0.2.3',
    commit: '3f1a9c2b8e4d6f0a1b2c3d4e5f60718293a4b5c6',
  };
  const body = '---\nversion: "V_0-2-1"\n---\n# Workspace Template\n';
  const stub = stubFetchSequence([
    { status: 200, body: JSON.stringify({ sha: template.commit }) }, // checkCommitExists
    { status: 200, body: JSON.stringify({ object: { sha: template.commit, type: 'commit' } }) }, // resolveRef tag
    { status: 200, body: JSON.stringify({ status: 'identical' }) }, // checkReleaseProvenance
    { status: 200, body: JSON.stringify({ name: 'workspace_V_0-3-0_spec_NN.md' }) }, // contents@commit
    { status: 200, body }, // version parity raw
    { status: 200, body }, // coherence pin fetch
    { status: 200, body }, // coherence main fetch
  ]);
  try {
    const violations = await mod.validateBlueprint(template, mod.CHANNELS.stable);
    assert.deepStrictEqual(violations, [], `Stable template with coherent pin/main must pass. Got: ${JSON.stringify(violations)}`);
    const urls = stub.urls();
    const pinUrl = `https://raw.githubusercontent.com/${template.repo}/${template.commit}/${template.path}`;
    const mainUrl = `https://raw.githubusercontent.com/${template.repo}/main/${template.path}`;
    assert.ok(urls.includes(pinUrl), 'coherence pin fetch must run on stable');
    assert.ok(urls.includes(mainUrl), 'coherence main fetch must run on stable');
  } finally {
    stub.restore();
  }
  console.log('✔ template main coherence (stable wiring) test passed');
}

console.log('All validate-manifest unit tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
