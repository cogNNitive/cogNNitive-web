/**
 * scripts/guard-template-immutability.test.js
 *
 * Plain-node tests for guard-template-immutability.js (canonical-template era).
 * Zero external test framework dependencies.
 *
 * The guard runs in --diff-file mode: it reads working-tree content from
 * <tmp>/iNNfo/specs/bluepriNNts (via --root) and base-revision content from
 * <tmp>/base-templates (via --base-root).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawn } = require('child_process');

const guardScript = path.join(__dirname, 'guard-template-immutability.js');

function runGuard(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn('node', [guardScript, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

const tpl = (version, body = 'Body.') =>
  `---\nspec_version: "V_0-2-1"\nlevel: 2\ntemplate_version: "${version}"\ntitle: "T"\n---\n\n# T\n\n${body}\n`;

async function runTests() {
  console.log('Running template immutability guard tests...');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-immutability-'));
  const workRoot = path.join(tmpDir, 'iNNfo', 'specs', 'bluepriNNts');
  const baseRoot = path.join(tmpDir, 'base-templates');

  const writeWork = (rel, content) => {
    const f = path.join(workRoot, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content, 'utf-8');
  };
  const writeBase = (rel, content) => {
    const f = path.join(baseRoot, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content, 'utf-8');
  };
  const writeFixture = (lines, name = 'diff.txt') => {
    const f = path.join(tmpDir, name);
    fs.writeFileSync(f, lines.join('\n') + '\n', 'utf-8');
    return f;
  };
  const args = (fixture) => [
    '--diff-file', fixture,
    '--root', workRoot,
    '--base-root', baseRoot,
    '--base', 'BASE',
  ];

  try {
    // 1. Modified template, content changed, template_version NOT bumped -> exit 1
    {
      writeBase('business/spec_NN.md', tpl('V_0-2-1', 'Old body.'));
      writeWork('business/spec_NN.md', tpl('V_0-2-1', 'New body.'));
      const fx = writeFixture(['M\tiNNfo/specs/bluepriNNts/business/spec_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 1, 'unbumped content change must exit 1');
      assert.ok(res.stdout.includes('business/spec_NN.md'), 'names the file');
      assert.ok(/template_version/.test(res.stdout), 'carries the bump remediation');
      console.log('✔ modified template without a template_version bump fails');
    }

    // 2. Modified template, content changed, template_version bumped -> exit 0
    {
      writeBase('projects/spec_NN.md', tpl('V_0-2-0', 'Old body.'));
      writeWork('projects/spec_NN.md', tpl('V_0-3-0', 'New body.'));
      const fx = writeFixture(['M\tiNNfo/specs/bluepriNNts/projects/spec_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'bumped content change must exit 0');
      console.log('✔ modified template with an incremented template_version passes');
    }

    // 2b. Modified frontmatter only (same body) with same version -> exit 0
    {
      writeBase('blank/spec_NN.md', tpl('V_0-2-0', 'Same body.'));
      writeWork('blank/spec_NN.md', tpl('V_0-2-0', 'Same body.'));
      const fx = writeFixture(['M\tiNNfo/specs/bluepriNNts/blank/spec_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'no content change must exit 0');
      console.log('✔ a no-op M entry (identical content) passes');
    }

    // 3. Added template with a valid semver template_version -> exit 0
    {
      writeWork('newthing/spec_NN.md', tpl('V_0-1-0'));
      const fx = writeFixture(['A\tiNNfo/specs/bluepriNNts/newthing/spec_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'valid added template must exit 0');
      console.log('✔ added template with a valid frontmatter template_version passes');
    }

    // 4. Added template with missing / invalid template_version -> exit 1
    {
      writeWork('broken/spec_NN.md', '---\nlevel: 2\ntitle: "T"\n---\n\n# T\n');
      const fx = writeFixture(['A\tiNNfo/specs/bluepriNNts/broken/spec_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 1, 'added template without a version must exit 1');
      assert.ok(res.stdout.includes('broken/spec_NN.md'));
      console.log('✔ added template without a valid template_version fails');
    }

    // 5. Deleted template -> exit 0
    {
      const fx = writeFixture(['D\tiNNfo/specs/bluepriNNts/organization/organization_V_0-1-0_NN.md']);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'deletion must exit 0');
      console.log('✔ deleted template passes (history lives in git tags)');
    }

    // 6. Pure rename with no content change -> exit 0
    {
      writeBase('procedures/procedures_V_0-2-0_NN.md', tpl('V_0-2-0', 'Identical.'));
      writeWork('procedures/spec_NN.md', tpl('V_0-2-0', 'Identical.'));
      const fx = writeFixture([
        'R100\tiNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md\tiNNfo/specs/bluepriNNts/procedures/spec_NN.md',
      ]);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'pure rename must exit 0');
      console.log('✔ pure rename (no content change) passes');
    }

    // 6b. Legacy-versioned -> canonical rename is the one-time migration: it
    //     may carry content edits (e.g. self-referential URLs) without a bump,
    //     but MUST still declare a valid template_version.
    {
      writeBase('analysis/analysis_V_0-2-0_NN.md', tpl('V_0-2-0', 'Old.'));
      writeWork('analysis/spec_NN.md', tpl('V_0-2-0', 'URLs rewritten during migration.'));
      const fx = writeFixture([
        'R090\tiNNfo/specs/bluepriNNts/analysis/analysis_V_0-2-0_NN.md\tiNNfo/specs/bluepriNNts/analysis/spec_NN.md',
      ]);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'canonical migration rename is exempt from the bump');
      console.log('✔ legacy->canonical migration rename is exempt from the version bump');
    }

    // 6c. ...but a migration rename that drops template_version entirely fails.
    {
      writeBase('innovation/innovation_V_0-2-0_NN.md', tpl('V_0-2-0'));
      writeWork('innovation/spec_NN.md', '---\nlevel: 2\ntitle: "T"\n---\n\n# T\n');
      const fx = writeFixture([
        'R100\tiNNfo/specs/bluepriNNts/innovation/innovation_V_0-2-0_NN.md\tiNNfo/specs/bluepriNNts/innovation/spec_NN.md',
      ]);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 1, 'migration rename without a valid version must exit 1');
      console.log('✔ migration rename that drops template_version still fails');
    }

    // 7. Clean diff -> exit 0
    {
      const fx = writeFixture([]);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'clean diff must exit 0');
      console.log('✔ clean diff exits zero');
    }

    // 8. Non-template edits (samples/, assets/, procedures/) -> exit 0
    {
      const fx = writeFixture([
        'M\tiNNfo/specs/bluepriNNts/business/samples/Ghostbusters_V_0-2-1_business_NN.md',
        'M\tiNNfo/specs/bluepriNNts/assets/people/egon_spengler.png',
        'M\tiNNfo/specs/bluepriNNts/business/procedures/compile_strategic_master_NN.md',
      ]);
      const res = await runGuard(args(fx), tmpDir);
      assert.strictEqual(res.status, 0, 'non-template edits must not fail the guard');
      console.log('✔ edits to samples/assets/procedures are not flagged');
    }

    console.log('All template immutability guard tests passed successfully!\n');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
