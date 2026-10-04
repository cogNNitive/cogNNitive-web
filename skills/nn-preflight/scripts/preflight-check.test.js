/**
 * skills/nn-preflight/scripts/preflight-check.test.js
 *
 * Unit tests for preflight-check.js.
 * Zero external test framework dependencies (runs with plain node).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { spawn } = require('child_process');
const crypto = require('crypto');
const {
  runCheck,
  printHumanReport,
  parseManifest,
  scanWorkspaceSources,
  validateBlueprintCompositions,
} = require('./preflight-check');

const preflightScript = path.join(__dirname, 'preflight-check.js');

function serveManifest(content) {
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

/** Serve different content per URL path (used for workspace spec freshness scenarios). */
function serveRoutes(routes) {
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests.push(req.url);
      const route = routes[req.url];
      if (route === undefined) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      if (typeof route === 'function') {
        route(req, res);
        return;
      }
      const isJson = typeof route === 'object' || (typeof route === 'string' && route.trim().startsWith('{'));
      res.writeHead(200, { 'Content-Type': isJson ? 'application/json' : 'text/markdown' });
      res.end(typeof route === 'object' ? JSON.stringify(route) : route);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        routes,
        requests,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function runScriptAsync(args, env = {}) {
  const finalArgs = [...args];
  if (!finalArgs.includes('--blueprints-dir') && !finalArgs.includes('--workspace')) {
    const tmpEmpty = path.join(os.tmpdir(), 'preflight-test-empty-blueprints');
    if (!fs.existsSync(tmpEmpty)) fs.mkdirSync(tmpEmpty, { recursive: true });
    finalArgs.push('--blueprints-dir', tmpEmpty);
  }
  return new Promise((resolve) => {
    const child = spawn('node', [preflightScript, ...finalArgs], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

async function runTests() {
  console.log('Running preflight-check unit tests...');

  // Test 1: parseManifest
  {
    const sampleManifest = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "a55a709cfd4482979547fda2b8633e6b8541a813"
      version: "V_0-1-0"
      mcp:
        - name: innfo-mcp
          version: "0.2.4"
  blueprints:
    - name: workspace_spec_NN
      commit: "3bd4501e75915e8f2365fd7c547d9384a3e0c837"
      version: "V_0-2-0"
---
# Manifest body
`;
    const parsed = parseManifest(sampleManifest);
    assert.strictEqual(parsed.version, '2.0');
    assert.strictEqual(parsed.skills.length, 1);
    assert.strictEqual(parsed.skills[0].name, 'nn-innfo');
    assert.strictEqual(parsed.skills[0].mcp[0].name, 'innfo-mcp');
    assert.strictEqual(parsed.blueprints.length, 1);
    console.log('✔ parseManifest extracts skills, mcp, and templates correctly');
  }

  // Test 2: Up-to-date execution (Exit code 0, status OK)
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      mcp:
        - name: innfo-mcp
          version: "0.2.4"
  blueprints:
    - name: workspace_spec_NN
      commit: "2222222222222222222222222222222222222222"
      version: "V_0-2-0"
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-test-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const blueprintsDir = path.join(tmpDir, 'templates');
      const mcpDir = path.join(tmpDir, 'mcp');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');

      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.mkdirSync(blueprintsDir, { recursive: true });
      fs.writeFileSync(path.join(blueprintsDir, 'workspace_spec_NN.md'), '# template');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'innfo-mcp.bundle.js'), '// bundle');

      const stateContent = {
        manifest: server.url,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
        blueprints: {
          workspace_spec_NN: { commit: '2222222222222222222222222222222222222222', version: 'V_0-2-0' },
        },
        mcp: {
          'innfo-mcp': { version: '0.2.4' },
        },
      };
      fs.writeFileSync(stateFile, JSON.stringify(stateContent));

      const res = await runScriptAsync(['--json'], {
        SM_MANIFEST_URL: server.url,
      });

      // Override dirs via flags if needed or verify JSON
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.node.ok, true);
      assert.strictEqual(parsedRes.manifest.reachable, true);
      console.log('✔ Up-to-date execution runs and reaches manifest');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 3: Outdated detection (Exit code 1, ACTION_REQUIRED)
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "latest-commit-sha-99999999999999999999999"
      version: "V_0-2-0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-outdated-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');

      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: {
          'nn-innfo': { commit: 'old-commit-sha-11111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 1, 'Expected exit code 1 for outdated component');
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsedRes.summary.skillsOutdated, 1);
      console.log('✔ Outdated component triggers exit code 1 and ACTION_REQUIRED');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 4: BOM in state file is stripped and parsed correctly
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-bom-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');

      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      const stateWithBom = '\uFEFF' + JSON.stringify({
        manifest: server.url,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      });
      fs.writeFileSync(stateFile, stateWithBom, 'utf-8');

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 0, `Expected exit code 0 despite BOM in state file. Got: ${res.stderr || res.stdout}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.skillsTotal, 1);
      assert.strictEqual(parsedRes.summary.skillsOutdated, 0);
      console.log('✔ BOM in state file is stripped and parsed correctly');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 5: Workspace scan — stale spec blocks preflight (exit 1 + ACTION_REQUIRED)
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/workspace_V_0-2-0_spec_NN.md': '# REMOTE CONTENT\n',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-stale-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'workspace_V_0-2-0_spec_NN.md'),
        `---\nspec_url: "${server.url}/workspace_V_0-2-0_spec_NN.md"\n---\n# LOCAL CONTENT\n`,
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 1, `Stale spec must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsedRes.summary.specsStale, 1);
      assert.strictEqual(parsedRes.summary.specsFresh, 0);
      const item = parsedRes.items.find((i) => i.type === 'spec-freshness');
      assert.ok(item, 'a spec-freshness item must be reported');
      assert.strictEqual(item.status, 'stale');
      assert.ok(item.name.includes('workspace_V_0-2-0_spec_NN.md'), 'item names the local file');
      assert.ok(item.url.includes('/workspace_V_0-2-0_spec_NN.md'), 'item carries the canonical remote URL');
      console.log('✔ Stale workspace spec triggers exit 1 + ACTION_REQUIRED');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 6: Workspace scan — all-fresh specs pass (exit 0)
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const localContent = `---\nspec_url: "${''}"\n---\n# IDENTICAL CONTENT\n`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/workspace_V_0-2-0_spec_NN.md': localContent,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-fresh-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      // The served copy and the local copy MUST be byte-identical (same URL line).
      const specContent = localContent.replace('""', `"${server.url}/workspace_V_0-2-0_spec_NN.md"`);
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'workspace_V_0-2-0_spec_NN.md'),
        specContent,
        'utf-8',
      );
      // Re-serve the exact local bytes so both hashes match.
      server.routes['/workspace_V_0-2-0_spec_NN.md'] = specContent;

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 0, `Fresh spec must exit 0. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.specsStale, 0);
      assert.strictEqual(parsedRes.summary.specsFresh, 1);
      console.log('✔ All-fresh workspace specs pass preflight');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 7: Workspace scan — spec without a canonical URL is skipped silently
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveManifest(emptyManifest);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-nourl-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'orphan_NN.md'),
        '---\ntitle: "No URL"\n---\n',
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 0, `No-URL spec must not block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.summary.specsStale, 0);
      assert.strictEqual(parsedRes.summary.specsFresh, 0);
      assert.strictEqual(parsedRes.summary.specsOffline, 0);
      assert.strictEqual(
        parsedRes.items.filter((i) => i.type === 'spec-freshness').length,
        0,
        'no spec-freshness item for a file without a canonical URL',
      );
      console.log('✔ Spec without canonical URL is skipped silently');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 7b: Derived specialization is NOT stale (parent_spec.url is not a self URL)
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/templates/business/business_V_0-1-0_NN.md': '# CANONICAL BUSINESS\n',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-spec-derived-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'arenzano_business_V_0-3-0_NN.md'),
        `---\nspecification_version: "V_0-1-0"\nlevel: 2\nparent_spec:\n  name: "business_V_0-1-0"\n  url: "${server.url}/templates/business/business_V_0-1-0_NN.md"\n---\n# ARENZANO SPECIALIZATION\n`,
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 0, `Derived spec must not block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.summary.specsStale, 0);
      assert.strictEqual(
        parsedRes.items.filter((i) => i.type === 'spec-freshness').length,
        0,
        'a specialization with only parent_spec.url must not be reported',
      );
      console.log('✔ Derived specialization (parent_spec.url only) is skipped, not stale');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 7c: A spec_url naming a different document is NOT stale
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/other_V_0-9-9_NN.md': '# OTHER DOCUMENT\n',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-spec-mislabeled-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'foo_V_0-1-0_NN.md'),
        `---\nspec_url: "${server.url}/other_V_0-9-9_NN.md"\n---\n# FOO CONTENT\n`,
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 0, `Mislabeled spec_url must not block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.summary.specsStale, 0);
      assert.strictEqual(
        parsedRes.items.filter((i) => i.type === 'spec-freshness').length,
        0,
        'a spec_url that names a different document must not be compared',
      );
      console.log('✔ Mislabeled spec_url (names another document) is skipped, not stale');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 7d: Canonical package-layout cache (generic spec_NN.md, matching dir) IS compared
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/templates/business/spec_NN.md': '# CANONICAL PACKAGE TEMPLATE\n',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-spec-package-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs', 'templates', 'business'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'templates', 'business', 'spec_NN.md'),
        `---\nspec_url: "${server.url}/templates/business/spec_NN.md"\n---\n# LOCAL EDITED COPY\n`,
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 1, `Diverged package cache must block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.summary.specsStale, 1);
      console.log('✔ Package-layout cache (matching dir) is compared and flagged stale');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 7e: Legacy versionless cache name still identifies against a versioned URL
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/procedures_V_0-1-0_NN.md': '# CANONICAL PROCEDURES\n',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-spec-versionless-'));
    try {
      const workspaceDir = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(workspaceDir, 'specs'), { recursive: true });
      fs.writeFileSync(
        path.join(workspaceDir, 'specs', 'procedures_NN.md'),
        `---\nspec_url: "${server.url}/procedures_V_0-1-0_NN.md"\n---\n# LOCAL PROCEDURES\n`,
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', workspaceDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 1, `Versionless legacy cache must still be compared. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.summary.specsStale, 1);
      console.log('✔ Legacy versionless cache name is compared against its versioned URL');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 8: No --workspace-dir → staleness fields default to zero (global-env audit unchanged)
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-ws-none-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 0, `No-flag run must stay exit 0. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.specsStale, 0);
      assert.strictEqual(parsedRes.summary.specsFresh, 0);
      assert.strictEqual(parsedRes.summary.specsOffline, 0);
      console.log('✔ No --workspace-dir run leaves global-env audit unchanged');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Helpers for the sidecar-based source audit (hand-written fixtures: the audit only reads).
  const sha256Of = (text) => crypto.createHash('sha256').update(text).digest('hex');
  const writeRaw = (ws, rel, text) => {
    const abs = path.join(ws, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  };
  const writeSidecar = (ws, rel, sourceText, hashOverride) => {
    writeRaw(
      ws,
      `${rel}_sidecar_NN.md`,
      `---\nlevel: 3\nparent_spec:\n  name: sidecar\nsource_file: "${rel}"\nsha256: "${hashOverride || sha256Of(sourceText)}"\nsize_bytes: ${Buffer.byteLength(sourceText)}\nsource_format: ${path.extname(rel).slice(1)}\nnormalized_at: "2026-10-02T10:00:00Z"\n---\n`,
    );
  };

  // Test 9: scanWorkspaceSources — Clean Workspace Baseline (every raw has an up-to-date co-located sidecar)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-clean-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/import/doc1.txt', 'Sample import content');
      writeSidecar(ws, 'sources/import/doc1.txt', 'Sample import content');
      writeRaw(ws, 'sources/import/specs/api.csv', 'a,b\n1,2\n');
      writeSidecar(ws, 'sources/import/specs/api.csv', 'a,b\n1,2\n');
      writeRaw(ws, 'sources/conversations/2026-09-06_planning_20260906T120000Z.md', '# Conversation');
      writeSidecar(ws, 'sources/conversations/2026-09-06_planning_20260906T120000Z.md', '# Conversation');
      // A file in staging is scratch and never audited.
      writeRaw(ws, 'sources/import/staging/draft.md', '# draft');

      const res = scanWorkspaceSources(ws);
      assert.strictEqual(res.total, 3, 'Total sources should be 3 (sidecars and staging are not raw files)');
      assert.strictEqual(res.normalized, 3, 'Normalized sources should be 3');
      assert.strictEqual(res.unnormalized, 0, 'Unnormalized sources should be 0');
      assert.strictEqual(res.dangling, 0, 'Dangling sources should be 0');
      assert.strictEqual(res.sources_integrity.ok, true, 'sources_integrity.ok should be true');
      assert.strictEqual(res.sources_integrity.unnormalized.length, 0);
      assert.strictEqual(res.sources_integrity.orphaned.length, 0);
      assert.strictEqual(res.sources_integrity.subtrees.import.total, 2);
      assert.strictEqual(res.sources_integrity.subtrees.conversations.total, 1);
      assert.strictEqual(res.sources_integrity.subtrees.export, undefined, 'export is no longer a source subtree');
      console.log('✔ scanWorkspaceSources passes the clean baseline across import and conversations');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 10: scanWorkspaceSources — a raw file with no sidecar is unnormalized (missing)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-unnorm-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/import/doc.pdf', 'PDF bytes');
      writeRaw(ws, 'sources/conversations/chat_20260906T120000Z.md', 'chat');
      // A retired folder is not an audited subtree even when it holds files.
      writeRaw(ws, 'sources/export/report.md', 'report deliverable');

      const res = scanWorkspaceSources(ws);
      assert.strictEqual(res.total, 2);
      assert.strictEqual(res.normalized, 0);
      assert.strictEqual(res.unnormalized, 2);
      assert.strictEqual(res.sources_integrity.ok, false);
      assert.strictEqual(res.sources_integrity.unnormalized.length, 2);

      const unnormPaths = res.sources_integrity.unnormalized.map((u) => u.path);
      assert.ok(unnormPaths.some((p) => p.includes('doc.pdf')));
      assert.ok(unnormPaths.some((p) => p.includes('chat_20260906T120000Z.md')));
      assert.ok(!unnormPaths.some((p) => p.includes('report.md')));
      assert.ok(res.sources_integrity.unnormalized.every((u) => u.reason === 'missing'));
      const item = res.items.find((i) => i.status === 'unnormalized' && i.name.includes('doc.pdf'));
      assert.ok(item && /--scan/.test(item.detail) && /--cognitivize/.test(item.detail), 'the finding suggests --scan or --cognitivize');
      assert.ok(!/sources\/nn/.test(item.detail), 'the finding never mentions sources/nn');
      console.log('✔ scanWorkspaceSources detects raw files without a sidecar');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 11: scanWorkspaceSources — hash guard: sidecar sha256 differs from the raw bytes
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-stale-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/import/doc.txt', 'Modified Content Version 2');
      writeSidecar(ws, 'sources/import/doc.txt', 'Original Content Version 1');

      const res = scanWorkspaceSources(ws);
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.unnormalized, 1);
      assert.strictEqual(res.sources_integrity.ok, false);
      assert.strictEqual(res.sources_integrity.unnormalized.length, 1);
      assert.strictEqual(res.sources_integrity.unnormalized[0].reason, 'hash_mismatch');
      assert.ok(res.items.some((i) => i.status === 'stale' && i.name.includes('doc.txt')));
      console.log('✔ scanWorkspaceSources detects a sidecar hash that no longer matches the raw bytes');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 12: scanWorkspaceSources — orphaned sidecar (raw file missing), never deleted
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-dangling-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeSidecar(ws, 'sources/import/old_notes.txt', 'gone');

      const res = scanWorkspaceSources(ws);
      assert.strictEqual(res.dangling, 1);
      assert.strictEqual(res.sources_integrity.ok, false);
      assert.strictEqual(res.sources_integrity.orphaned.length, 1);
      assert.strictEqual(res.sources_integrity.orphaned[0].path, 'sources/import/old_notes.txt_sidecar_NN.md');
      assert.strictEqual(res.sources_integrity.orphaned[0].missing_source, 'sources/import/old_notes.txt');
      assert.ok(res.items.some((i) => i.status === 'dangling'));
      assert.ok(fs.existsSync(path.join(ws, 'sources/import/old_notes.txt_sidecar_NN.md')), 'the orphan is reported, never deleted');
      console.log('✔ scanWorkspaceSources reports an orphaned sidecar and keeps it');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 13: scanWorkspaceSources — retired folders are not scanned (no fallback)
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-retired-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/original/retired.txt', 'Retired original document');
      writeRaw(ws, 'sources/nn/retired.md', '# mirror');
      writeRaw(ws, 'sources/archive/old/V1/old.md', '# archived');

      const res = scanWorkspaceSources(ws);
      assert.strictEqual(res.total, 0);
      assert.strictEqual(res.sources_integrity.subtrees.original, undefined);
      assert.strictEqual(res.sources_integrity.subtrees.nn, undefined);
      console.log('✔ scanWorkspaceSources ignores the retired sources/original, nn and archive folders');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 13b: scanWorkspaceSources — missing `* -text` policy is a warning, never a blocker
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-sources-policy-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/import/doc.txt', 'content');
      writeSidecar(ws, 'sources/import/doc.txt', 'content');

      const without = scanWorkspaceSources(ws);
      assert.strictEqual(without.sources_integrity.ok, true, 'the missing policy does not make the audit fail');
      assert.strictEqual(without.sources_integrity.text_policy_ok, false);
      assert.ok(without.items.some((i) => i.status === 'text-policy-missing' && /-text/.test(i.detail)), 'a warning item names the policy');

      fs.writeFileSync(path.join(ws, '.gitattributes'), '*.png binary\n* -text\n');
      const withPolicy = scanWorkspaceSources(ws);
      assert.strictEqual(withPolicy.sources_integrity.text_policy_ok, true);
      assert.ok(!withPolicy.items.some((i) => i.status === 'text-policy-missing'));
      console.log('✔ scanWorkspaceSources warns when .gitattributes lacks `* -text`');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 14: CLI integration — Unnormalized source triggers exit code 1 + ACTION_REQUIRED
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveManifest(emptyManifest);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cli-unnorm-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(ws, 'sources', 'import'), { recursive: true });
      fs.writeFileSync(path.join(ws, 'sources', 'import', 'contract.pdf'), 'contract bytes');

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', ws,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 1, `Unnormalized source must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsedRes.summary.sourcesTotal, 1);
      assert.strictEqual(parsedRes.summary.sourcesUnnormalized, 1);
      assert.strictEqual(parsedRes.sources_integrity.ok, false);
      assert.strictEqual(parsedRes.sources_integrity.unnormalized.length, 1);
      assert.strictEqual(parsedRes.sources_integrity.unnormalized[0].reason, 'missing');
      console.log('✔ CLI preflight with unnormalized sources exits 1 with ACTION_REQUIRED and sources_integrity');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 15: CLI integration — Fully normalized workspace exits 0 + OK
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveManifest(emptyManifest);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cli-clean-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(ws, 'sources', 'import'), { recursive: true });

      const content = 'clean file';
      writeRaw(ws, 'sources/import/doc.txt', content);
      writeSidecar(ws, 'sources/import/doc.txt', content);

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', ws,
        '--manifest-url', server.url,
      ]);

      assert.strictEqual(res.status, 0, `Clean sources must exit 0. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.sourcesTotal, 1);
      assert.strictEqual(parsedRes.summary.sourcesNormalized, 1);
      assert.strictEqual(parsedRes.summary.sourcesUnnormalized, 0);
      assert.strictEqual(parsedRes.summary.sourcesDangling, 0);
      assert.strictEqual(parsedRes.sources_integrity.ok, true);
      assert.strictEqual(parsedRes.sources_integrity.unnormalized.length, 0);
      console.log('✔ CLI preflight with normalized workspace exits 0 and reports sources_integrity.ok === true');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 15b: CLI integration — a missing `* -text` policy is printed as a warning and does not block
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveManifest(emptyManifest);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cli-policy-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      writeRaw(ws, 'sources/import/doc.txt', 'clean file');
      writeSidecar(ws, 'sources/import/doc.txt', 'clean file');

      const res = await runScriptAsync(['--workspace-dir', ws, '--manifest-url', server.url]);
      assert.strictEqual(res.status, 0, `A missing text policy must not block. Got: ${res.stdout} ${res.stderr}`);
      assert.ok(/\* -text/.test(res.stdout), `the warning names the policy: ${res.stdout}`);

      fs.writeFileSync(path.join(ws, '.gitattributes'), '* -text\n');
      const clean = await runScriptAsync(['--workspace-dir', ws, '--manifest-url', server.url]);
      assert.ok(!/no `\* -text` line/.test(clean.stdout), 'the warning disappears once the policy exists');
      console.log('✔ CLI preflight warns about a missing `* -text` policy without blocking');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 16: Tier 3 — upgrade-available model is reported without blocking (exit 0)
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const catalog = JSON.stringify({
      blueprints: {
        business: {
          name: 'business',
          adopted: 'V_0-2-0',
          versions: [{ blueprint_version: 'V_0-1-0' }, { blueprint_version: 'V_0-2-0' }],
        },
      },
    });
    const server = await serveRoutes({
      '/manifest.md': emptyManifest,
      '/catalog.json': catalog,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tier3-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
      fs.writeFileSync(
        path.join(ws, 'models', 'Old_V_0-1-0_business_NN.md'),
        '---\nlevel: 3\nparent_spec:\n  name: "business_V_0-1-0"\n  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-1-0_NN.md"\nknowledge_version: "V_0-1-0"\n---\n',
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', ws,
        '--manifest-url', `${server.url}/manifest.md`,
        '--template-catalog-url', `${server.url}/catalog.json`,
      ]);

      assert.strictEqual(res.status, 0, `Upgrade-available must not block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.blueprintModelsScanned, 1);
      assert.strictEqual(parsedRes.summary.templateUpgradesAvailable, 1);
      const item = parsedRes.items.find((i) => i.type === 'template-upgrade');
      assert.ok(item, 'a template-upgrade item must be reported');
      assert.strictEqual(item.status, 'upgrade-available');
      assert.strictEqual(item.kind, 'minor');
      console.log('✔ Tier 3 reports upgrade-available without flipping exit code');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 17: Tier 3 — offline catalog degrades to a non-blocking notice
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({ '/manifest.md': emptyManifest });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tier3-offline-'));
    try {
      const ws = path.join(tmpDir, 'ws');
      fs.mkdirSync(path.join(ws, 'models'), { recursive: true });
      fs.writeFileSync(
        path.join(ws, 'models', 'Old_V_0-1-0_business_NN.md'),
        '---\nlevel: 3\nparent_spec:\n  name: "business_V_0-1-0"\n  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/business_V_0-1-0_NN.md"\nknowledge_version: "V_0-1-0"\n---\n',
        'utf-8',
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', ws,
        '--manifest-url', `${server.url}/manifest.md`,
        '--template-catalog-url', `${server.url}/catalog.json`,
      ]);

      assert.strictEqual(res.status, 0, `Offline catalog must not block. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'OK');
      assert.strictEqual(parsedRes.summary.templateCatalogOffline, 1);
      assert.ok(parsedRes.items.some((i) => i.type === 'template-catalog' && i.status === 'offline'));
      console.log('✔ Tier 3 degrades to an offline notice without blocking');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 18: validateBlueprintCompositions passes cleanly on valid composite template
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tmpl-valid-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });

      fs.writeFileSync(
        path.join(specsDir, 'sub_a_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[ConceptA]]\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(specsDir, 'sub_b_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[ConceptB]]\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(specsDir, 'root_NN.md'),
        '---\nlevel: 2\nincludes:\n  - name: "sub_a"\n  - name: "sub_b"\n---\n# NN index\n* [[RootConcept]]\n\n## NN Matrix Definition: Sample Matrix\nsource:: ConceptA\ntarget:: ConceptB\n',
        'utf8'
      );

      const res = validateBlueprintCompositions({ workspaceDir: tmpDir });
      assert.strictEqual(res.blockerCount, 0, `Expected 0 blockers, got: ${JSON.stringify(res.items)}`);
      assert.ok(res.validCount >= 3, `Expected at least 3 valid templates, got ${res.validCount}`);
      console.log('✔ validateBlueprintCompositions passes cleanly on valid composite templates');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 19: validateBlueprintCompositions flags unresolvable matrix endpoints as blockers
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tmpl-broken-matrix-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });

      fs.writeFileSync(
        path.join(specsDir, 'broken_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[ExistingConcept]]\n\n## NN Matrix Definition: Broken Matrix\nsource:: ExistingConcept\ntarget:: NonExistentConcept\n',
        'utf8'
      );

      const res = validateBlueprintCompositions({ workspaceDir: tmpDir });
      assert.strictEqual(res.blockerCount, 1);
      const blocker = res.items.find((i) => i.status === 'blocker');
      assert.ok(blocker && blocker.detail.includes('NonExistentConcept'), 'Blocker must mention missing target');
      console.log('✔ validateBlueprintCompositions flags unresolvable matrix endpoints as blockers');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 20: validateBlueprintCompositions flags unresolved includes as blockers
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tmpl-missing-inc-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });

      fs.writeFileSync(
        path.join(specsDir, 'composite_missing_NN.md'),
        '---\nlevel: 2\nincludes:\n  - name: "non_existent_subtemplate"\n---\n# NN index\n* [[MyConcept]]\n',
        'utf8'
      );

      const res = validateBlueprintCompositions({ workspaceDir: tmpDir });
      assert.strictEqual(res.blockerCount, 1);
      const blocker = res.items.find((i) => i.status === 'blocker');
      assert.ok(blocker && blocker.detail.includes('non_existent_subtemplate'), 'Blocker must mention unresolved include');
      console.log('✔ validateBlueprintCompositions flags unresolved includes as blockers');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 21: validateBlueprintCompositions flags concept collisions across sub-templates as warnings
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tmpl-collision-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });

      fs.writeFileSync(
        path.join(specsDir, 'sub1_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[DuplicateNode]]\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(specsDir, 'sub2_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[DuplicateNode]]\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(specsDir, 'composite_collision_NN.md'),
        '---\nlevel: 2\nincludes:\n  - name: "sub1"\n  - name: "sub2"\n---\n# NN index\n* [[Root]]\n',
        'utf8'
      );

      const res = validateBlueprintCompositions({ workspaceDir: tmpDir });
      assert.strictEqual(res.blockerCount, 0);
      assert.strictEqual(res.warningCount, 1);
      const warn = res.items.find((i) => i.status === 'warning');
      assert.ok(warn && warn.detail.includes('DuplicateNode'), 'Warning must mention colliding concept');
      console.log('✔ validateBlueprintCompositions flags concept collisions across sub-templates as warnings');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 22: validateBlueprintCompositions skips a level:1 file during the template walk
  // (F4 / ADR-007 — this must be green BEFORE and AFTER the dead-numeric-comparison
  // deletion at preflight-check.js:546-547; that is the proof the deletion is dead code).
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-tmpl-level1-skip-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });

      // Would qualify for inclusion via `type: template` if the level check did not
      // short-circuit first — proves the skip, not just an unrelated non-match.
      fs.writeFileSync(
        path.join(specsDir, 'skip_me_NN.md'),
        '---\nlevel: 1\ntype: template\n---\n# NN index\n* [[SkippedConcept]]\n',
        'utf8'
      );
      fs.writeFileSync(
        path.join(specsDir, 'keep_me_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[KeptConcept]]\n',
        'utf8'
      );

      const res = validateBlueprintCompositions({ workspaceDir: tmpDir });
      assert.ok(
        !res.items.some((i) => i.name.includes('skip_me')),
        `level:1 file must be skipped, got: ${JSON.stringify(res.items)}`
      );
      assert.ok(
        res.items.some((i) => i.name.includes('keep_me')),
        `level:2 file must still be walked, got: ${JSON.stringify(res.items)}`
      );
      console.log('✔ validateBlueprintCompositions skips a level:1 file during the template walk');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 23: CLI preflight exits 1 with ACTION_REQUIRED when composition blocker is present
  {
    const emptyManifest = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveRoutes({ '/manifest.md': emptyManifest });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cli-comp-blocker-'));
    try {
      const specsDir = path.join(tmpDir, 'specs');
      fs.mkdirSync(specsDir, { recursive: true });
      fs.writeFileSync(
        path.join(specsDir, 'broken_NN.md'),
        '---\nlevel: 2\n---\n# NN index\n* [[ConceptX]]\n\n## NN Matrix Definition: Broken Matrix\nsource:: ConceptX\ntarget:: ConceptY_Missing\n',
        'utf8'
      );

      const res = await runScriptAsync([
        '--json',
        '--workspace-dir', tmpDir,
        '--manifest-url', `${server.url}/manifest.md`,
      ]);

      assert.strictEqual(res.status, 1, `Must exit with code 1 on template blocker. Got: ${res.stdout} ${res.stderr}`);
      const parsedRes = JSON.parse(res.stdout);
      assert.strictEqual(parsedRes.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsedRes.summary.templatesCompositionBlockers, 1);
      console.log('✔ CLI preflight exits 1 with ACTION_REQUIRED when composition blocker is present');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 24: (a) Freshness data present and pinnedTag matches manifest -> informational line printed, exitCode unchanged
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.0"
  blueprints: []
---
`;
    const freshnessContent = {
      generatedAt: '2026-09-22T10:00:00Z',
      head: '2465a8a',
      subsystems: {
        skills: {
          subsystem: 'skills',
          pinnedTag: 'skills-v2.0.0',
          pinnedTagDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          paths: ['skills/'],
          commitsSincePin: 9,
          filesTouched: ['skills/nn-router/SKILL.md'],
        },
      },
    };

    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': freshnessContent,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-match-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      // 1. Human readable output: verify printed line format and exitCode === 0
      const humanRes = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(humanRes.status, 0, 'Exit code must be 0 for up-to-date install with freshness');
      assert.ok(
        humanRes.stdout.includes('ℹ️  Channel freshness: skills pinned to skills-v2.0.0 (6 days old); main has 9 later commit(s) touching skills/nn-router/SKILL.md — informational, not a blocker.'),
        `Human output must include canonical freshness line sourced from filesTouched (not the legacy paths field). Got:\n${humanRes.stdout}`
      );
      assert.ok(humanRes.stdout.includes('Status: OK'), 'Human output must preserve Status: OK');

      // 2. JSON output: verify exitCode 0 and no error/warning/freshness blocking item added
      const jsonRes = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);
      assert.strictEqual(jsonRes.status, 0);
      const parsedJson = JSON.parse(jsonRes.stdout);
      assert.strictEqual(parsedJson.status, 'OK');
      assert.strictEqual(parsedJson.exitCode, 0);
      console.log('✔ (a) Freshness data present and matching tag prints informational line without affecting exitCode');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 25: (b) Freshness fetch fails / times out -> no line, no item, no notice, exitCode unchanged
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.0"
  blueprints: []
---
`;
    // freshness route returns 500 error
    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': (_req, res) => {
        res.writeHead(500);
        res.end('Server Error');
      },
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-fail-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(res.status, 0, 'Exit code must remain 0 when freshness fetch fails');
      assert.ok(!res.stdout.includes('Channel freshness'), 'Must not print channel freshness on failure');
      assert.ok(!res.stdout.toLowerCase().includes('freshness error'), 'Must silently omit freshness errors');
      assert.ok(res.stdout.includes('Status: OK'), 'Must preserve Status: OK');
      console.log('✔ (b) Freshness fetch rejection/timeout silently degrades with no notice and exitCode 0');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 26: (c) pinnedTag mismatch (stale freshness file) -> no line, no warning
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.1"
  blueprints: []
---
`;
    const staleFreshnessContent = {
      generatedAt: '2026-09-22T10:00:00Z',
      head: '2465a8a',
      subsystems: {
        skills: {
          subsystem: 'skills',
          pinnedTag: 'skills-v2.0.0', // Mismatch vs manifest's skills-v2.0.1
          pinnedTagDate: '2026-09-16T08:41:12Z',
          paths: ['skills/'],
          commitsSincePin: 9,
          filesTouched: [],
        },
      },
    };

    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': staleFreshnessContent,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-mismatch-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(res.status, 0);
      assert.ok(!res.stdout.includes('Channel freshness'), 'Must not print freshness line on tag mismatch');
      assert.ok(!res.stdout.toLowerCase().includes('mismatch'), 'Must not print any warning about mismatch');
      console.log('✔ (c) Pinned tag mismatch silently drops freshness line with no warning');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 27: (d) malformed JSON -> no line, no throw, exitCode unchanged
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.0"
  blueprints: []
---
`;
    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': '<html>Not JSON</html>',
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-malformed-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(res.status, 0, 'Malformed JSON must not throw or change exit code');
      assert.ok(!res.stdout.includes('Channel freshness'), 'Must not print freshness line on malformed JSON');
      console.log('✔ (d) Malformed freshness JSON is silently ignored without throwing');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 28: (e) commitsSincePin: 0 -> line still prints (spec: "Zero drift still
  // prints the line"); commitsSincePin: null (unresolved pin) -> stays silent.
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.0"
  blueprints:
    - name: workspace_spec_NN
      commit: "2222222222222222222222222222222222222222"
      version: "V_0-2-0"
      ref: "templates-v0.10.0"
---
`;
    const zeroDriftFreshness = {
      generatedAt: '2026-09-22T10:00:00Z',
      head: '2465a8a',
      subsystems: {
        skills: {
          subsystem: 'skills',
          pinnedTag: 'skills-v2.0.0',
          pinnedTagDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          paths: ['skills/'],
          commitsSincePin: 0,
          filesTouched: [],
        },
        blueprints: {
          subsystem: 'templates',
          pinnedTag: 'templates-v0.10.0',
          pinnedTagDate: '2026-09-16T08:41:12Z',
          paths: ['iNNfo/specs/bluepriNNts/'],
          commitsSincePin: null,
          reason: 'unresolved',
          filesTouched: [],
        },
      },
    };

    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': zeroDriftFreshness,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-zero-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const blueprintsDir = path.join(tmpDir, 'templates');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      fs.mkdirSync(blueprintsDir, { recursive: true });
      fs.writeFileSync(path.join(blueprintsDir, 'workspace_spec_NN.md'), '# template');
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
        blueprints: {
          workspace_spec_NN: { commit: '2222222222222222222222222222222222222222', version: 'V_0-2-0' },
        },
      }));

      const res = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--blueprints-dir', blueprintsDir,
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(res.status, 0, `Expected exit code 0. Got stdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
      assert.ok(
        res.stdout.includes('ℹ️  Channel freshness: skills pinned to skills-v2.0.0 (6 days old); main has 0 later commit(s) touching skills/ — informational, not a blocker.'),
        `Zero drift must still print the freshness line per spec. Got:\n${res.stdout}`
      );
      assert.ok(
        !res.stdout.includes('Channel freshness: templates'),
        'A null (unresolved) commitsSincePin must stay silent, not print as zero'
      );
      console.log('✔ (e) Zero drift still prints the line; unresolved (null) drift stays silent');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 29: (f) manifest itself unreachable -> freshness fetch never attempted
  {
    const server = await serveRoutes({
      '/manifest.md': (_req, res) => {
        res.writeHead(500);
        res.end('Manifest Unreachable');
      },
      '/use/freshness.json': { subsystems: {} },
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-manifest-unreachable-'));
    try {
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.writeFileSync(stateFile, JSON.stringify({ manifest: `${server.url}/manifest.md` }));

      const res = await runScriptAsync([
        '--state-file', stateFile,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.ok(res.stdout.includes('Remote manifest unreachable'), 'Must indicate manifest unreachable');
      assert.ok(
        !server.requests.includes('/use/freshness.json'),
        `Freshness URL must NEVER be requested when manifest is unreachable. Requests: ${JSON.stringify(server.requests)}`
      );
      console.log('✔ (f) Unreachable manifest skips freshness fetch completely');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 30: (g) All four published subsystems are reported (skills, templates,
  // innfo-mcp, innfo-console), not just the first two; a long filesTouched list
  // is truncated for readability instead of being joined in full.
  {
    const manyFiles = Array.from({ length: 23 }, (_, i) => `skills/nn-router/file-${i}.md`);
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-innfo
      commit: "1111111111111111111111111111111111111111"
      version: "V_0-1-0"
      ref: "skills-v2.0.0"
      mcp:
        - name: innfo-mcp
          version: "0.9.0"
          ref: "innfo-mcp-v0.9.0"
  blueprints: []
  console-assets:
    - file: "iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js"
      version: "0.2.0"
      ref: "innfo-console-v0.2.0"
---
`;
    const freshnessContent = {
      generatedAt: '2026-09-22T10:00:00Z',
      head: '2465a8a',
      subsystems: {
        skills: {
          subsystem: 'skills',
          pinnedTag: 'skills-v2.0.0',
          pinnedTagDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          commitsSincePin: 23,
          filesTouched: manyFiles,
        },
        'innfo-mcp': {
          subsystem: 'innfo-mcp',
          pinnedTag: 'innfo-mcp-v0.9.0',
          pinnedTagDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          commitsSincePin: 7,
          filesTouched: ['iNNfo/packages/innfo-mcp/src/path-containment.ts'],
        },
        'innfo-console': {
          subsystem: 'innfo-console',
          pinnedTag: 'innfo-console-v0.2.0',
          pinnedTagDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          commitsSincePin: 1,
          filesTouched: ['iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js'],
        },
      },
    };

    const server = await serveRoutes({
      '/manifest.md': manifestContent,
      '/use/freshness.json': freshnessContent,
    });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-freshness-all-subsystems-'));
    try {
      const skillsDir = path.join(tmpDir, 'skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.mkdirSync(path.join(skillsDir, 'nn-innfo'), { recursive: true });
      // This fixture is the only freshness case whose manifest declares an MCP
      // entry, so it is the only one that reaches the bundle-on-disk probe. That
      // probe defaults to ~/.agents/mcp, which exists on a maintainer's machine
      // and not on CI — so without an explicit --mcp-dir the run exits 0 locally
      // and 1 on CI. Isolate it inside tmpDir to keep the fixture hermetic.
      const mcpDir = path.join(tmpDir, 'mcp');
      fs.mkdirSync(mcpDir, { recursive: true });
      fs.writeFileSync(path.join(mcpDir, 'innfo-mcp.bundle.js'), '// fixture bundle\n');
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: `${server.url}/manifest.md`,
        skills: {
          'nn-innfo': { commit: '1111111111111111111111111111111111111111', version: 'V_0-1-0' },
        },
      }));

      const res = await runScriptAsync([
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--mcp-dir', mcpDir,
        '--manifest-url', `${server.url}/manifest.md`,
        '--freshness-url', `${server.url}/use/freshness.json`,
      ]);

      assert.strictEqual(res.status, 0);
      assert.ok(
        res.stdout.includes('Channel freshness: innfo-mcp pinned to innfo-mcp-v0.9.0'),
        `innfo-mcp drift must be reported, not silently dropped. Got:\n${res.stdout}`
      );
      assert.ok(
        res.stdout.includes('Channel freshness: innfo-console pinned to innfo-console-v0.2.0'),
        `innfo-console drift must be reported, not silently dropped. Got:\n${res.stdout}`
      );
      assert.ok(
        res.stdout.includes('Channel freshness: skills pinned to skills-v2.0.0'),
        'skills drift must still be reported alongside the newly added subsystems'
      );
      assert.ok(
        !res.stdout.includes('file-22.md') || res.stdout.includes('more'),
        'A long filesTouched list must be truncated for readability, not joined in full'
      );
      assert.ok(
        !manyFiles.every((f) => res.stdout.includes(f)),
        'Not every one of the 23 touched files should appear verbatim in the printed line'
      );
      console.log('✔ (g) All four published subsystems reported; long filesTouched lists are truncated');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 31: Recorded symlink projection in-sync exits 0
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-sample
      commit: "1111111111111111111111111111111111111111"
      version: "1.0.0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-proj-insync-'));
    try {
      const skillsDir = path.join(tmpDir, 'canonical-skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      const canonicalSkill = path.join(skillsDir, 'nn-sample');
      fs.mkdirSync(canonicalSkill, { recursive: true });
      fs.writeFileSync(path.join(canonicalSkill, 'SKILL.md'), '# Canonical');

      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      fs.mkdirSync(claudeSkillsDir, { recursive: true });
      const projectedSkill = path.join(claudeSkillsDir, 'nn-sample');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(canonicalSkill, projectedSkill, linkType);

      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
        blueprints: {},
        projections: {
          claude: {
            dir: claudeSkillsDir,
            skills: {
              'nn-sample': {
                method: 'symlink',
                source: canonicalSkill,
                projected_at: new Date().toISOString(),
              },
            },
          },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 0, `In-sync symlink must exit 0. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.status, 'OK');
      assert.strictEqual(parsed.summary.projectionsDrift, 0);
      assert.strictEqual(parsed.summary.projectionsInSync, 1);
      console.log('✔ Recorded symlink projection in-sync exits 0');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 32: Stale copy projection triggers exit 1 and ACTION_REQUIRED
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-sample
      commit: "1111111111111111111111111111111111111111"
      version: "1.0.0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-proj-stale-'));
    try {
      const skillsDir = path.join(tmpDir, 'canonical-skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      const canonicalSkill = path.join(skillsDir, 'nn-sample');
      fs.mkdirSync(canonicalSkill, { recursive: true });
      fs.writeFileSync(path.join(canonicalSkill, 'SKILL.md'), '# Canonical New');

      const opencodeSkillsDir = path.join(tmpDir, '.config', 'opencode', 'skills');
      fs.mkdirSync(opencodeSkillsDir, { recursive: true });
      const projectedSkill = path.join(opencodeSkillsDir, 'nn-sample');
      fs.mkdirSync(projectedSkill, { recursive: true });
      fs.writeFileSync(path.join(projectedSkill, 'SKILL.md'), '# Stale Copy Content');

      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
        blueprints: {},
        projections: {
          opencode: {
            dir: opencodeSkillsDir,
            skills: {
              'nn-sample': {
                method: 'copy',
                source: canonicalSkill,
                projected_at: new Date().toISOString(),
              },
            },
          },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 1, `Stale copy projection must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsed.summary.projectionsDrift, 1);
      const item = parsed.items.find(i => i.type === 'skill-projection');
      assert(item && item.status === 'stale', 'Item status must be stale');
      console.log('✔ Stale copy projection triggers exit 1 and ACTION_REQUIRED');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 33: Dangling projection link triggers exit 1
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-sample
      commit: "1111111111111111111111111111111111111111"
      version: "1.0.0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-proj-dangling-'));
    try {
      const skillsDir = path.join(tmpDir, 'canonical-skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      const canonicalSkill = path.join(skillsDir, 'nn-sample');
      fs.mkdirSync(canonicalSkill, { recursive: true });
      fs.writeFileSync(path.join(canonicalSkill, 'SKILL.md'), '# Canonical');

      const doomedTarget = path.join(tmpDir, 'doomed');
      fs.mkdirSync(doomedTarget, { recursive: true });

      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      fs.mkdirSync(claudeSkillsDir, { recursive: true });
      const projectedSkill = path.join(claudeSkillsDir, 'nn-sample');
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(doomedTarget, projectedSkill, linkType);
      fs.rmSync(doomedTarget, { recursive: true, force: true });

      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
        blueprints: {},
        projections: {
          claude: {
            dir: claudeSkillsDir,
            skills: {
              'nn-sample': {
                method: 'symlink',
                source: canonicalSkill,
                projected_at: new Date().toISOString(),
              },
            },
          },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 1, `Dangling projection link must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsed.summary.projectionsDrift, 1);
      const item = parsed.items.find(i => i.type === 'skill-projection');
      assert(item && item.status === 'dangling', 'Item status must be dangling');
      console.log('✔ Dangling projection link triggers exit 1 and ACTION_REQUIRED');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 34: Missing projection destination triggers exit 1
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills:
    - name: nn-sample
      commit: "1111111111111111111111111111111111111111"
      version: "1.0.0"
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-proj-missing-'));
    try {
      const skillsDir = path.join(tmpDir, 'canonical-skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      const canonicalSkill = path.join(skillsDir, 'nn-sample');
      fs.mkdirSync(canonicalSkill, { recursive: true });
      fs.writeFileSync(path.join(canonicalSkill, 'SKILL.md'), '# Canonical');

      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');

      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: server.url,
        skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
        blueprints: {},
        projections: {
          claude: {
            dir: claudeSkillsDir,
            skills: {
              'nn-sample': {
                method: 'symlink',
                source: canonicalSkill,
                projected_at: new Date().toISOString(),
              },
            },
          },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', server.url,
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 1, `Missing projection must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsed.summary.projectionsDrift, 1);
      const item = parsed.items.find(i => i.type === 'skill-projection');
      assert(item && item.status === 'missing', 'Item status must be missing');
      console.log('✔ Missing projection destination triggers exit 1 and ACTION_REQUIRED');
    } finally {
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 35: Offline manifest fetch with projection drift still triggers exit 1
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-proj-offline-'));
    try {
      const skillsDir = path.join(tmpDir, 'canonical-skills');
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      const canonicalSkill = path.join(skillsDir, 'nn-sample');
      fs.mkdirSync(canonicalSkill, { recursive: true });
      fs.writeFileSync(path.join(canonicalSkill, 'SKILL.md'), '# Canonical');

      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');

      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: 'http://127.0.0.1:9999/manifest.md',
        skills: { 'nn-sample': { commit: '1111111111111111111111111111111111111111', version: '1.0.0' } },
        blueprints: {},
        projections: {
          claude: {
            dir: claudeSkillsDir,
            skills: {
              'nn-sample': {
                method: 'symlink',
                source: canonicalSkill,
                projected_at: new Date().toISOString(),
              },
            },
          },
        },
      }));

      const res = await runScriptAsync([
        '--json',
        '--skills-dir', skillsDir,
        '--state-file', stateFile,
        '--manifest-url', 'http://127.0.0.1:9999/manifest.md',
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 1, `Offline manifest with projection drift must exit 1. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.status, 'ACTION_REQUIRED');
      assert.strictEqual(parsed.summary.projectionsDrift, 1);
      console.log('✔ Offline manifest fetch with projection drift triggers exit 1 and ACTION_REQUIRED');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 36: Manifest fallback resolution handles unreachable primary endpoint gracefully
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const fallbackServer = await serveManifest(manifestContent);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-fallback-'));
    try {
      const stateFile = path.join(tmpDir, 'bootstrap-state.json');
      fs.writeFileSync(stateFile, JSON.stringify({
        manifest: fallbackServer.url,
        skills: {},
        blueprints: {},
      }));

      // Test default fallback chain when primary is offline
      const res = await runScriptAsync([
        '--json',
        '--state-file', stateFile,
        '--manifest-url', fallbackServer.url,
      ], {
        env: { ...process.env, USERPROFILE: tmpDir, HOME: tmpDir },
      });

      assert.strictEqual(res.status, 0, `Fallback manifest fetch must succeed. Got: ${res.stdout} ${res.stderr}`);
      const parsed = JSON.parse(res.stdout);
      assert.strictEqual(parsed.manifest.reachable, true);
      assert.strictEqual(parsed.manifest.url, fallbackServer.url);
      console.log('✔ Manifest fallback resolution reaches active endpoint cleanly');
    } finally {
      await fallbackServer.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Test 37: Manifest source is reported (primary | fallback | override), keeping the primary error
  {
    const manifestContent = `---
agent-bootstrap:
  version: "2.0"
  skills: []
  blueprints: []
---
`;
    const server = await serveManifest(manifestContent);
    const deadUrl = 'http://127.0.0.1:9/manifest.md';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-source-'));
    const savedEnv = process.env.SM_MANIFEST_URL;
    const savedLog = console.log;
    try {
      const baseOptions = {
        json: true,
        skillsDir: path.join(tmpDir, 'skills'),
        blueprintsDir: path.join(tmpDir, 'blueprints'),
        mcpDir: path.join(tmpDir, 'mcp'),
        stateFile: path.join(tmpDir, 'bootstrap-state.json'),
        freshnessUrl: server.url,
      };

      // primary succeeds
      process.env.SM_MANIFEST_URL = server.url;
      let results = await runCheck({ ...baseOptions, fallbackManifestUrl: deadUrl });
      assert.strictEqual(results.manifest.source, 'primary');
      assert.strictEqual(results.manifest.url, server.url);
      assert.strictEqual(results.manifest.primaryError, null);

      // primary fails, fallback succeeds: the primary error is kept
      process.env.SM_MANIFEST_URL = deadUrl;
      results = await runCheck({ ...baseOptions, fallbackManifestUrl: server.url });
      assert.strictEqual(results.manifest.source, 'fallback');
      assert.strictEqual(results.manifest.url, server.url);
      assert.strictEqual(results.manifest.reachable, true);
      assert.ok(results.manifest.primaryError, 'primaryError must be recorded when the fallback was used');

      const lines = [];
      console.log = (...args) => lines.push(args.join(' '));
      printHumanReport(results);
      console.log = savedLog;
      const sourceLine = lines.find((l) => l.startsWith('Manifest:'));
      assert.ok(sourceLine, 'text report must print a Manifest line');
      assert.ok(sourceLine.includes('fallback') && sourceLine.includes(server.url), sourceLine);
      assert.ok(sourceLine.includes(deadUrl), 'fallback line must name the failed primary URL');

      // explicit override
      delete process.env.SM_MANIFEST_URL;
      results = await runCheck({ ...baseOptions, manifestUrl: server.url });
      assert.strictEqual(results.manifest.source, 'override');
      assert.strictEqual(results.manifest.url, server.url);
      assert.strictEqual(results.manifest.primaryError, null);
      console.log('✔ Manifest source (primary/fallback/override) and primary error are reported');
    } finally {
      console.log = savedLog;
      if (savedEnv === undefined) delete process.env.SM_MANIFEST_URL;
      else process.env.SM_MANIFEST_URL = savedEnv;
      await server.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('All preflight-check unit tests passed successfully!\n');
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});

