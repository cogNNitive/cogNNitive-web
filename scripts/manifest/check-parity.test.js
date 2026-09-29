#!/usr/bin/env node

/**
 * scripts/manifest/check-parity.test.js
 *
 * Unit tests for deterministic workspace parity checker.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { checkWorkspaceParity } = require('./check-parity.js');

function createTempWorkspace(sourceYaml, files = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-test-'));
  const manifestDir = path.join(tmpDir, 'manifest');
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(path.join(manifestDir, 'source.yaml'), sourceYaml, 'utf8');

  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  return tmpDir;
}

function main() {
  console.log('Running check-parity unit tests...');

  // 1. Live workspace passes parity check
  {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const result = checkWorkspaceParity(repoRoot);
    assert.strictEqual(result.ok, true, `Live workspace parity should be ok. Errors: ${result.errors.join('; ')}`);
    assert.strictEqual(result.stats.skillsCount > 0, true);
    assert.strictEqual(result.stats.blueprintsCount > 0, true);
    assert.strictEqual(result.stats.mcpCount, 1);
    console.log('✔ Live workspace parity test passed');
  }

  // 2. Missing SKILL.md is detected (presence check)
  {
    const sourceYaml = `
skills:
  - name: test-skill
    path: actioNN/skills/test-skill
    version: "1.0.0"
`;
    const tmpDir = createTempWorkspace(sourceYaml, {});
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.errors.some(e => e.includes("file not found")), true);
      console.log('✔ Missing SKILL.md presence check passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 3. Template version mismatch is detected
  {
    const sourceYaml = `
blueprints:
  - name: test-tmpl
    path: iNNfo/specs/bluepriNNts/test_spec.md
    version: "V_0-2-0"
`;
    const files = {
      'iNNfo/specs/bluepriNNts/test_spec.md': '---\nversion: "V_0-1-0"\n---\n# Spec',
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.errors.some(e => e.includes("version mismatch — manifest 'V_0-2-0' vs blueprint 'V_0-1-0'")), true);
      console.log('✔ Template version mismatch detection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 4. Missing MCP bundle is detected
  {
    const sourceYaml = `
skills:
  - name: nn-innfo
    path: actioNN/skills/nn-innfo
    version: "1.0.0"
    mcp:
      - name: innfo-mcp
        path: iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js
        version: "0.2.4"
`;
    const files = {
      'actioNN/skills/nn-innfo/SKILL.md': '---\nversion: "1.0.0"\n---\n# Innfo',
      'iNNfo/packages/innfo-mcp/package.json': JSON.stringify({ version: '0.2.4' }),
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.errors.some(e => e.includes("bundle file not found")), true);
      console.log('✔ Missing MCP bundle detection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 5. Template with body-only V_x-y-z does not cause spurious mismatch
  {
    const sourceYaml = `
blueprints:
  - name: test-tmpl
    path: iNNfo/specs/bluepriNNts/test_V_0-1-0_spec.md
    version: "V_0-1-0"
`;
    const files = {
      'iNNfo/specs/bluepriNNts/test_V_0-1-0_spec.md': '# Spec\nparent_spec: https://example.com/iNNfo_V_0-2-1_NN.md\n',
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, true, `Should not mismatch based on body URL. Errors: ${result.errors.join('; ')}`);
      console.log('✔ Body-only V_x-y-z ignored for version detection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 7. external_specs version/sha256 mismatch detection
  {
    const sourceYaml = `
skills:
  - name: nn-video-script
    path: skills/nn-video-script
    version: "V_0-1-0"
    external_specs:
      - name: vus
        repo: innV0/VidGeNN
        path: packages/core/specs/V_0-3-3.json
        version: "V_0-3-3"
        sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"
`;
    const files = {
      'skills/nn-video-script/SKILL.md': '---\nname: nn-video-script\nversion: "V_0-1-0"\nvus_spec:\n  version: "V_0-3-2"\n  sha256: "mismatch"\n---\n# Skill',
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.errors.some(e => e.includes("external_spec 'vus' mismatch")), true);
      console.log('✔ external_specs mismatch detection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 8. external_specs invalid path rejection (e.g. .agent/skills/...)
  {
    const sourceYaml = `
skills:
  - name: nn-video-script
    path: skills/nn-video-script
    version: "V_0-1-0"
    external_specs:
      - name: vus
        repo: innV0/VidGeNN
        path: .agent/skills/anydeo-script-builder/specs/V_0-3-3.json
        version: "V_0-3-3"
        sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"
`;
    const files = {
      'skills/nn-video-script/SKILL.md': '---\nname: nn-video-script\nversion: "V_0-1-0"\nvus_spec:\n  version: "V_0-3-3"\n  sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"\n---\n# Skill',
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.errors.some(e => e.includes("must match ^packages/core/specs/")), true);
      console.log('✔ external_specs invalid path rejection passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // 9. external_specs happy path without VIDGENN_ROOT
  {
    const oldEnv = process.env.VIDGENN_ROOT;
    delete process.env.VIDGENN_ROOT;
    const sourceYaml = `
skills:
  - name: nn-video-script
    path: skills/nn-video-script
    version: "V_0-1-0"
    external_specs:
      - name: vus
        repo: innV0/VidGeNN
        path: packages/core/specs/V_0-3-3.json
        version: "V_0-3-3"
        sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"
`;
    const files = {
      'skills/nn-video-script/SKILL.md': '---\nname: nn-video-script\nversion: "V_0-1-0"\nvus_spec:\n  version: "V_0-3-3"\n  sha256: "72630624f8fb35e6ca6124249663f4e58c2f4772474ed2162007a09eb2013642"\n---\n# Skill',
    };
    const tmpDir = createTempWorkspace(sourceYaml, files);
    try {
      const result = checkWorkspaceParity(tmpDir);
      assert.strictEqual(result.ok, true, `Should pass with matching spec and unset VIDGENN_ROOT: ${result.errors.join('; ')}`);
      console.log('✔ external_specs unset VIDGENN_ROOT pass passed');
    } finally {
      if (oldEnv !== undefined) process.env.VIDGENN_ROOT = oldEnv;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log('All check-parity unit tests passed successfully!');
}

main();