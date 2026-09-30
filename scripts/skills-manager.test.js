#!/usr/bin/env node
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawnSync, spawn } = require('node:child_process');

const managerScript = path.join(__dirname, 'skills-manager.js');

function serveManifestOnce(content) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/markdown' });
      res.end(content);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/manifest.md`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

// spawnSync blocks this process's event loop, which would starve the
// in-process HTTP server used to serve a local manifest fixture (deadlock:
// the child waits for a response the parent can't produce while blocked).
// Use async spawn whenever a test needs the local server to stay live.
function spawnAsync(args, options) {
  return new Promise((resolve) => {
    const child = spawn('node', args, { ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function main() {
console.log('Running skills-manager unit tests...');

// 1. Manifest carrying `ref` parses without error; a version-only change does not
//    mark the skill outdated (update detection stays commit-only).
{
  const manifestWithRef = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-router
      repo: cogNNitive/actioNN
      path: skills/nn-router
      version: "3.2"
      ref: skills-v1.0.0
      commit: "d60a7109315820085ab127b70412992db6986c88"
---
# Manifest`;

  const server = await serveManifestOnce(manifestWithRef);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-'));
  const skillsDir = path.join(tmpDir, 'skills');
  const stateFile = path.join(tmpDir, 'bootstrap-state.json');
  fs.mkdirSync(path.join(skillsDir, 'nn-router'), { recursive: true });
  // Installed state: same commit as manifest, but a stale `version` string —
  // this must NOT be reported as outdated, since update detection is commit-only.
  fs.writeFileSync(stateFile, JSON.stringify({
    manifest: server.url,
    skills: { 'nn-router': { commit: 'd60a7109315820085ab127b70412992db6986c88', version: '2.9' } },
    blueprints: {},
  }, null, 2), 'utf-8');

  try {
    const res = await spawnAsync([managerScript, 'status', '--skills-dir', skillsDir, '--state', stateFile], {
      env: { ...process.env, SM_MANIFEST_URL: server.url },
    });
    assert.strictEqual(res.status, 0, `Manifest with ref should parse without error. stderr: ${res.stderr}`);
    assert.match(res.stdout, /up-to-date/, 'commit match with a stale version string must report up-to-date, not outdated');
    assert.doesNotMatch(res.stdout, /\boutdated\b/, 'a version-only difference must not mark the skill outdated');
    console.log('✔ Manifest ref passthrough + commit-only update detection test passed');
  } finally {
    await server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 2. TTY interactive decision gate (non-TTY without --yes exits code 2)
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-'));
  const skillsDir = path.join(tmpDir, 'skills');
  const stateFile = path.join(tmpDir, 'bootstrap-state.json');

  try {
    const res = spawnSync('node', [managerScript, 'install', '--skills-dir', skillsDir, '--state', stateFile], {
      encoding: 'utf-8',
      env: { ...process.env, SM_MANIFEST_URL: 'https://raw.githubusercontent.com/cogNNitive/eNNvironment/main/docs/use/manifest.md' },
    });
    assert.strictEqual(res.status, 2, `Non-TTY execution without --yes should exit code 2. Got: ${res.status}`);
    assert.match(res.stdout || res.stderr, /needs decision:/);
    console.log('✔ TTY consent gate (needs decision: / exit 2) test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 3. Legacy state file migration: skills-state.json -> bootstrap-state.json
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-'));
  const legacyStateFile = path.join(tmpDir, 'skills-state.json');
  const targetStateFile = path.join(tmpDir, 'bootstrap-state.json');

  const legacyContent = {
    manifest: 'https://raw.githubusercontent.com/cogNNitive/eNNvironment/main/docs/use/manifest.md',
    skills: {
      'nn-router': { commit: 'd60a7109315820085ab127b70412992db6986c88', version: '3.2' },
    },
  };
  fs.writeFileSync(legacyStateFile, JSON.stringify(legacyContent, null, 2), 'utf-8');

  try {
    const res = spawnSync('node', [managerScript, 'status', '--skills-dir', tmpDir, '--state', targetStateFile], {
      encoding: 'utf-8',
    });
    assert.strictEqual(res.status, 0, `Status execution should succeed. Got stderr: ${res.stderr}`);
    assert(fs.existsSync(targetStateFile), 'bootstrap-state.json should be created after loading legacy state');

    const migrated = JSON.parse(fs.readFileSync(targetStateFile, 'utf-8'));
    assert(migrated.skills['nn-router'], 'Migrated state should contain skills from legacy state');
    assert(migrated.blueprints, 'Migrated state should contain blueprints object');
    console.log('✔ Legacy state file migration test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 4. Local sync command with --yes
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-'));
  const targetSkillsDir = path.join(tmpDir, 'global-skills');
  fs.mkdirSync(targetSkillsDir, { recursive: true });

  try {
    const res = spawnSync('node', [managerScript, 'sync', '--skills-dir', targetSkillsDir, '--yes'], {
      encoding: 'utf-8',
    });
    assert.strictEqual(res.status, 0, `Sync command with --yes should succeed. Got: ${res.stderr || res.stdout}`);
    assert(fs.existsSync(path.join(targetSkillsDir, 'nn-innfo')), 'nn-innfo skill should be synchronized to destination');
    assert(fs.existsSync(path.join(targetSkillsDir, 'nn-innfo', 'templates', 'workspace_spec_NN.md')), 'Bundled template workspace_spec_NN.md should be synchronized');
    console.log('✔ Skill & bundled template sync test passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 5. Bootstrap command with --yes and custom scope
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-bootstrap-'));
  const targetSkillsDir = path.join(tmpDir, 'skills');
  const targetTemplatesDir = path.join(tmpDir, 'templates');
  const targetMcpDir = path.join(tmpDir, 'mcp');
  const targetStateFile = path.join(tmpDir, 'state.json');

  const manifestFixture = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints:
    - name: workspace
      repo: cogNNitive/cogNNitive
      path: iNNfo/specs/templates/workspace_V_0-3-0_spec_NN.md
      version: "V_0-2-1"
      commit: "27c79dc8c32375cd5db66e0782253716030e468c"
  workflows:
    - id: test-wf
      label: Test Workflow
      description: Just a test
      skill: nn-innfo
---
# Manifest`;

  const manifestServer = await serveManifestOnce(manifestFixture);

  try {
    const res = await spawnAsync(
      [
        managerScript,
        'bootstrap',
        '--skills-dir', targetSkillsDir,
        '--templates-dir', targetTemplatesDir,
        '--mcp-dir', targetMcpDir,
        '--state', targetStateFile,
        '--yes',
      ],
      {
        env: { ...process.env, SM_MANIFEST_URL: manifestServer.url },
      }
    );

    assert.strictEqual(res.status, 0, `Bootstrap command with --yes should succeed. Got: ${res.stderr || res.stdout}`);
    assert(res.stdout.includes('Bootstrap completed successfully!'), 'Output confirms completion');
    assert(res.stdout.includes('Test Workflow'), 'Output lists available workflows');

    const stateContent = fs.readFileSync(targetStateFile, 'utf-8');
    assert.strictEqual(stateContent.charCodeAt(0), 123, 'State file written without BOM');
    const parsedState = JSON.parse(stateContent);
    assert(parsedState.blueprints.workspace, 'State records bootstrapped template');

    console.log('✔ Bootstrap command with --yes test passed');
  } finally {
    await manifestServer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 6. projectSkillsToAgents multi-agent projection test
{
  const { projectSkillsToAgents } = require('./lib/skills-commands.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-project-'));
  const canonicalSkillsDir = path.join(tmpDir, '.agents', 'skills');
  const skillSample = path.join(canonicalSkillsDir, 'nn-sample');
  fs.mkdirSync(skillSample, { recursive: true });
  fs.writeFileSync(path.join(skillSample, 'SKILL.md'), '# Sample Skill', 'utf-8');

  const projections = projectSkillsToAgents({
    canonicalSkillsDir,
    homedir: tmpDir,
    targetAgent: 'all',
    silent: true,
  });

  assert(projections.some(p => p.agent === 'opencode' && p.skill === 'nn-sample'), 'Projected to OpenCode');
  assert(projections.some(p => p.agent === 'claude' && p.skill === 'nn-sample'), 'Projected to Claude');
  assert(projections.some(p => p.agent === 'antigravity' && p.skill === 'nn-sample'), 'Projected to Antigravity');

  assert(fs.existsSync(path.join(tmpDir, '.config', 'opencode', 'skills', 'nn-sample', 'SKILL.md')));
  assert(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'nn-sample', 'SKILL.md')));
  assert(fs.existsSync(path.join(tmpDir, '.gemini', 'config', 'skills', 'nn-sample', 'SKILL.md')));

  console.log('✔ projectSkillsToAgents multi-agent projection test passed');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// 7. cmdUpdate re-projects even when canonical is up to date
{
  const manifestRaw = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-sample
      repo: cogNNitive/actioNN
      path: skills/nn-sample
      version: "1.0.0"
      commit: "1111111111111111111111111111111111111111"
---
# Manifest`;

  const server = await serveManifestOnce(manifestRaw);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-update-proj-'));
  const skillsDir = path.join(tmpDir, '.agents', 'skills');
  const stateFile = path.join(tmpDir, 'bootstrap-state.json');
  const skillSample = path.join(skillsDir, 'nn-sample');
  fs.mkdirSync(skillSample, { recursive: true });
  fs.writeFileSync(path.join(skillSample, 'SKILL.md'), '# Canonical Sample', 'utf-8');

  fs.writeFileSync(stateFile, JSON.stringify({
    manifest: server.url,
    skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
    blueprints: {},
  }, null, 2), 'utf-8');

  try {
    const res = await spawnAsync([
      managerScript, 'update',
      '--skills-dir', skillsDir,
      '--state', stateFile,
      '--agent', 'claude',
      '--yes',
    ], {
      env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir, SM_MANIFEST_URL: server.url },
    });

    assert.strictEqual(res.status, 0, `cmdUpdate should succeed. Stderr: ${res.stderr}`);
    assert(res.stdout.includes('All skills, templates, and console assets up to date'), 'Reports up to date');
    assert(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'nn-sample', 'SKILL.md')), 'Projected to claude');

    const updatedState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    assert(updatedState.projections && updatedState.projections.claude, 'State records projections');
    assert(updatedState.projections.claude.skills['nn-sample'], 'State records projected skill');

    console.log('✔ cmdUpdate up-to-date projection test passed');
  } finally {
    await server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 8. --scope workspace skips projection
{
  const { projectSkillsToAgents } = require('./lib/skills-commands.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-workspace-'));
  const canonicalSkillsDir = path.join(tmpDir, '.agents', 'skills');
  const skillSample = path.join(canonicalSkillsDir, 'nn-sample');
  fs.mkdirSync(skillSample, { recursive: true });
  fs.writeFileSync(path.join(skillSample, 'SKILL.md'), '# Workspace Skill', 'utf-8');

  const projections = projectSkillsToAgents({
    canonicalSkillsDir,
    homedir: tmpDir,
    targetAgent: 'all',
    scope: 'workspace',
    silent: true,
  });

  assert.strictEqual(projections.length, 0, 'Workspace scope must not project');
  assert.strictEqual(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'nn-sample')), false);

  console.log('✔ --scope workspace skips projection test passed');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// 9. ADR-2 Ownership and unmanaged link/dir handling
{
  const { projectSkillsToAgents } = require('./lib/skills-commands.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actioNN-test-ownership-'));
  const canonicalSkillsDir = path.join(tmpDir, '.agents', 'skills');
  const skillSample = path.join(canonicalSkillsDir, 'nn-sample');
  fs.mkdirSync(skillSample, { recursive: true });
  fs.writeFileSync(path.join(skillSample, 'SKILL.md'), '# Canonical Skill', 'utf-8');

  // Pre-create an unmanaged foreign real dir with different content
  const foreignDir = path.join(tmpDir, '.claude', 'skills', 'nn-sample');
  fs.mkdirSync(foreignDir, { recursive: true });
  fs.writeFileSync(path.join(foreignDir, 'SKILL.md'), '# Foreign Content', 'utf-8');

  const state = { manifest: 'dummy', skills: { 'nn-sample': { version: '1.0' } }, blueprints: {}, projections: {} };

  const projections = projectSkillsToAgents({
    canonicalSkillsDir,
    homedir: tmpDir,
    targetAgent: 'claude',
    state,
    silent: true,
  });

  const proj = projections.find(p => p.agent === 'claude' && p.skill === 'nn-sample');
  assert(proj && proj.action === 'skip', 'Unmanaged foreign directory must be skipped');
  assert.strictEqual(fs.readFileSync(path.join(foreignDir, 'SKILL.md'), 'utf-8'), '# Foreign Content', 'Foreign content must not be overwritten');

  console.log('✔ ADR-2 unmanaged directory protection test passed');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('All skills-manager unit tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
