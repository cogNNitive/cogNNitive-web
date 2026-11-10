/**
 * nn-conntent/test/pipeline-modules.test.mjs
 *
 * Slice 7b: the engine's pipeline lives in `lib/compile.mjs` and `lib/render.mjs`,
 * `produce` drives it directly, and the legacy tools of the draft era are gone.
 *
 * The spend gate no longer depends on a plan-approval artifact: `produce` gates on
 * the Episode's `status::` and on `--approve <plan_hash>`, and `SpendGuard` enforces
 * the per-run budget. Nothing in the skill may resurrect `asset_plan.approved.json`
 * or the in-chat approval phrase.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(SKILL_DIR, 'scripts');

const read = (rel) => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(SKILL_DIR, rel));

/** Every text file of the skill that ships or documents behaviour (tests may name
 * retired tools to assert their absence). */
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    if (entry.name === 'test') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(mjs|js|cjs|md|json|html)$/i.test(entry.name)) out.push(full);
  }
}

function offenders(pattern, { allow = [] } = {}) {
  const files = [];
  walk(SKILL_DIR, files);
  return files
    .filter((f) => !allow.includes(path.basename(f)))
    .filter((f) => pattern.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(SKILL_DIR, f).split(path.sep).join('/'));
}

test('the pipeline primitives are modules, not one CLI file', () => {
  const compile = read('scripts/lib/compile.mjs');
  const render = read('scripts/lib/render.mjs');

  assert.match(compile, /export async function compileVideo/, 'lib/compile.mjs exports compileVideo');
  assert.match(render, /export async function renderVideo/, 'lib/render.mjs exports renderVideo');
  assert.equal(exists('scripts/video-engine-cli.mjs'), false, 'the split CLI file is gone');
});

test('produce drives the modules directly', () => {
  const cli = read('scripts/produce.mjs');
  const pipeline = read('scripts/lib/pipeline.mjs');

  assert.match(
    pipeline,
    /from '\.\/render\.mjs'/,
    'the pipeline imports the renderer from lib/render.mjs',
  );
  assert.match(
    cli,
    /from '\.\/lib\/pipeline\.mjs'/,
    'produce.mjs is a CLI over lib/pipeline.mjs',
  );
  assert.doesNotMatch(
    `${cli}${pipeline}`,
    /video-engine-cli/,
    'produce must not import the retired engine CLI',
  );
});

test('the draft-era tools are gone', () => {
  for (const rel of [
    'scripts/build-script-from-draft.mjs',
    'scripts/build-draft-html.mjs',
    'scripts/draft-template.html',
    'scripts/finalize-video.mjs',
    'scripts/approve-plan.mjs',
    'scripts/lib/legacy-draft-keys.mjs',
    'scripts/lib/plan-approval.mjs',
    'test/build-draft-html.test.mjs',
    'test/build-script-from-draft.test.mjs',
    'test/legacy-draft-keys.test.mjs',
    'test/finalize-video.test.mjs',
  ]) {
    assert.equal(exists(rel), false, `${rel} must be deleted`);
  }
});

test('nothing references the retired tools', () => {
  // This test file names them on purpose, twice over.
  const allow = ['pipeline-modules.test.mjs'];

  for (const name of [
    'build-draft-html',
    'build-script-from-draft',
    'draft-template',
    'finalize-video',
    'approve-plan',
    'legacy-draft-keys',
    'video-engine-cli',
  ]) {
    assert.deepEqual(offenders(new RegExp(name, 'i'), { allow }), [], `references to ${name} remain`);
  }
});

test('the spend gate carries no plan-approval artifact', () => {
  const allow = ['pipeline-modules.test.mjs'];

  assert.deepEqual(
    offenders(/asset_plan\.approved\.json|approve the plan/i, { allow }),
    [],
    'the approval artifact and its in-chat phrase are retired',
  );
});

test('the series document reader survives the draft-tool removal', () => {
  // render-thumbnail reads the series title from the series scope document; that
  // reader must outlive build-script-from-draft.mjs.
  const lib = read('scripts/lib/series-doc.mjs');

  assert.match(lib, /export function loadSeriesDocument/);
  assert.match(lib, /export function loadSeriesFor/);
  assert.match(
    read('scripts/render-thumbnail.mjs'),
    /from '\.\/lib\/series-doc\.mjs'/,
    'render-thumbnail reads the series document from the new module',
  );
});
