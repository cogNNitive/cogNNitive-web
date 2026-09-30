#!/usr/bin/env node

/**
 * scripts/lib/legacy-write-guard.test.js
 *
 * Plain-node tests for the legacy-write guard. Token strings are built by
 * concatenation so this test file carries no live token (and test files are
 * out of scan scope anyway).
 */

const assert = require('node:assert');
const { checkLegacyWriteGuard, inScope, isExcluded, validateAllowlist } = require('./legacy-write-guard.js');

const TV = 'template' + '_version';
const TN = 'template' + '_name';
const MV = 'model' + '_version';
const TT = 'target' + '_template';
const TM = 'type:: ' + 'model';
const ST = 'specs/' + 'templates';
const WS = 'workspace' + '_NN.md';
const KL = 'knowledge' + '/';
const BL = 'blueprints' + '/';

function run(files, extra = {}) {
  return checkLegacyWriteGuard({ files: Object.keys(files), readFile: (f) => files[f], ...extra });
}

function main() {
  console.log('Running legacy-write-guard unit tests...');

  // 1. Each retired token fails inside scope
  for (const [token, id] of [[TV, 'template-version'], [TN, 'template-name'], [MV, 'model-version'], [TT, 'target-template'], [TM, 'type-model'], [ST, 'specs-templates'], [WS, 'workspace-entrypoint'], [KL, 'lowercase-knowledge-dir'], [BL, 'lowercase-blueprints-dir']]) {
    const r = run({ 'iNNfo/packages/innfo-core/src/foo.ts': `const x = '${token}';\n` });
    assert.strictEqual(r.ok, false, `${id} must fail`);
    assert.ok(r.errors.some((e) => e.includes(id)), `error must name ${id}`);
  }
  console.log('✔ every retired token fails inside runtime scope');

  // 2. Tokens inside a scripts/ file also fail
  {
    const r = run({ 'scripts/some-script.mjs': `export const a = '${ST}';\n` });
    assert.strictEqual(r.ok, false);
  }
  console.log('✔ scripts/ is in scope');

  // 3. Out of scope: docs, tests, openspec, cdn, frozen _V_ files
  {
    const r = run({
      'docs/x.md': TV,
      'scripts/a.test.js': TV,
      'scripts/b.spec.ts': ST,
      'openspec/x.md': TV,
      'docs/innfo/cdn/bundle.js': WS,
      'iNNfo/specs/bluepriNNts/business/spec_V_0-1-0_NN.md': TM,
    });
    assert.strictEqual(r.ok, true, r.errors.join('; '));
  }
  console.log('✔ docs/tests/openspec/cdn/frozen files are out of scope');

  // 4. Allowlisted quarantine path is ignored, but the allowlist entry carries a reason
  {
    const r = run({ 'iNNfo/packages/innfo-core/src/legacy/detect.ts': `const s = '${ST}';\n` });
    assert.strictEqual(r.ok, true, r.errors.join('; '));
  }
  console.log('✔ quarantine module is allowlisted');

  // 5. Pages path allowance vs an unrelated lowercase blueprints/ literal
  {
    const ok = run({ 'scripts/build-docs.mjs': `const p = 'innfo/${BL}catalog.json';\n` });
    assert.strictEqual(ok.ok, true, ok.errors.join('; '));
    const bad = run({ 'scripts/build-docs.mjs': `const p = '${BL}catalog.json';\n` });
    assert.strictEqual(bad.ok, false, 'an unrelated lowercase blueprints/ literal must fail');
  }
  console.log('✔ Pages path is allowed, other lowercase blueprints/ literals fail');

  // 6. An allowlist entry without a reason fails
  {
    const r = checkLegacyWriteGuard({ files: [], allowlist: [{ pattern: 'x/', reason: '' }] });
    assert.strictEqual(r.ok, false);
    assert.ok(r.errors.some((e) => e.includes('missing a reason')));
  }
  console.log('✔ allowlist entry without a reason fails');

  // 7. Clean input passes
  {
    const r = run({ 'iNNfo/packages/innfo-core/src/clean.ts': 'export const a = 1;\n' });
    assert.strictEqual(r.ok, true);
  }
  console.log('✔ clean runtime source passes');

  // Sanity: helpers
  assert.strictEqual(inScope('iNNfo/packages/innfo-core/src/layout.ts'), true);
  assert.strictEqual(inScope('docs/x.md'), false);
  assert.strictEqual(isExcluded('docs/innfo/cdn/x.js'), true);
  assert.deepStrictEqual(validateAllowlist(), []);

  console.log('All legacy-write-guard unit tests passed successfully!\n');
}

main();
