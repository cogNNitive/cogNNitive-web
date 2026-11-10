/**
 * nn-conntent/test/frame.test.mjs
 *
 * RED→GREEN tests for the `frame` cascade parameter (design D14/D18/D21):
 * per-scene resolution, the `frames/<name>.md` walk, the missing-file rule and
 * the dry-run report line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { compileVideo, resolveFrame } from '../scripts/lib/compile.mjs';
import { MissingAssetError } from '../scripts/lib/missing-asset.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, '..', 'scripts', 'lib', 'compile.mjs');
const BP = path.resolve(__dirname, '..', '..', '..');

/** The scalar subset `{value, source}` of a resolved trace (the trace adds document). */
function pickScalar(r) {
  return { value: r.value, source: r.source };
}

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const FRAME_DOC = `---
name: Brand
colors:
  primary: "#1e2bfa"
  text: "#111111"
typography:
  body: { fontFamily: "Inter" }
---
`;

const SCRIPT = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "coNNtent_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
title: "Frame Demo"
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]

# NN Video

## NN Video: Frame Demo
slug:: frame-demo
title:: Frame Demo

# NN Scene

## NN Scene: Overview
slug:: overview

Learn how neural networks process multidimensional input vectors today
`;

/** A minimal L3 Series document declaring one field. */
function seriesDoc(fields = {}) {
  const lines = Object.entries(fields).map(([k, v]) => `${k}:: ${v}`);
  return [
    '---',
    'level: 3',
    'scope: true',
    'parent_spec:',
    '  name: "coNNtent_V_0-8-0"',
    'title: "Series A"',
    '---',
    '',
    '# NN Series',
    '',
    '## NN Series: Series A',
    'slug:: series-a',
    ...lines,
    '',
  ].join('\n');
}

test('the compiler resolves frame per scene through the cascade', () => {
  const model = {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [
        { type: 'Scene', name: 's1', slug: 's1', description: 'a', fields: { frame: 'night' } },
        { type: 'Scene', name: 's2', slug: 's2', description: 'b', fields: {} },
      ],
      Layer: [],
    },
  };
  const bags = { series: { frame: 'brand' }, blueprint: { frame: 'neutral' } };
  const parsed = new SceneCompiler({ width: 1920, height: 1920 }).lowerKnowledgeModel(model, { bags });
  assert.deepEqual(pickScalar(parsed.scenes[0].frame), { value: 'night', source: 'scene' });
  assert.deepEqual(pickScalar(parsed.scenes[1].frame), { value: 'brand', source: 'series' });
  assert.deepEqual(pickScalar(parsed.frame), { value: 'brand', source: 'series' });
});

test('the default package floor is the blueprint library, not the skill folder', () => {
  const root = tmp('nn-frame-floor-');
  const domain = path.join(root, 'domain');
  const episode = path.join(domain, 'series-a', 'episodes', 'ep-01');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  try {
    const res = resolveFrame({
      entries: [{ value: 'neutral', source: 'blueprint' }],
      scriptDir: episode,
      workspaceRoot: domain,
    });
    assert.equal(res.path, path.join(BP, 'library', 'frames', 'neutral', 'FRAME.md'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveFrame finds library/frames/<name>/FRAME.md episode > series > domain > skill', () => {
  const root = tmp('nn-frame-walk-');
  const domain = path.join(root, 'domain');
  const series = path.join(domain, 'series-a');
  const episode = path.join(series, 'episodes', 'ep-01');
  const skill = path.join(root, 'skill');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  for (const d of [series, domain]) fs.mkdirSync(path.join(d, 'library', 'frames'), { recursive: true });
  const entries = [{ value: 'brand', source: 'series' }];
  const opts = { entries, scriptDir: episode, workspaceRoot: domain, skillDir: skill };

  fs.mkdirSync(path.join(skill, 'library', 'frames', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'library', 'frames', 'brand', 'FRAME.md'), FRAME_DOC, 'utf8');
  assert.equal(resolveFrame(opts).path, path.join(skill, 'library', 'frames', 'brand', 'FRAME.md'));

  fs.mkdirSync(path.join(domain, 'library', 'frames', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(domain, 'library', 'frames', 'brand', 'FRAME.md'), FRAME_DOC, 'utf8');
  assert.equal(resolveFrame(opts).path, path.join(domain, 'library', 'frames', 'brand', 'FRAME.md'));

  fs.mkdirSync(path.join(series, 'library', 'frames', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(series, 'library', 'frames', 'brand', 'FRAME.md'), FRAME_DOC, 'utf8');
  assert.equal(resolveFrame(opts).path, path.join(series, 'library', 'frames', 'brand', 'FRAME.md'));

  fs.rmSync(root, { recursive: true, force: true });
});

test('a series frame.md is ignored: only frames/<name>.md resolves', () => {
  const root = tmp('nn-frame-ignore-');
  const domain = path.join(root, 'domain');
  const series = path.join(domain, 'series-a');
  const episode = path.join(series, 'ep-01');
  const skill = path.join(root, 'skill');
  fs.mkdirSync(episode, { recursive: true });
  fs.mkdirSync(skill, { recursive: true });
  // The old discovery location: a bare `frame.md` at the series root.
  fs.writeFileSync(path.join(series, 'frame.md'), FRAME_DOC, 'utf8');

  assert.throws(
    () =>
      resolveFrame({
        entries: [{ value: 'brand', source: 'series' }],
        scriptDir: episode,
        workspaceRoot: domain,
        skillDir: skill,
      }),
    MissingAssetError,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('a user-level frame name with no file fails pre-compile, nothing spent', async () => {
  const root = tmp('nn-frame-missing-');
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const ep = path.join(root, 'ep');
  fs.mkdirSync(ep, { recursive: true });
  const scriptPath = path.join(ep, 'script.md');
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8');

  await assert.rejects(
    compileVideo({
      scriptPath,
      synthesizeAssets: false,
      bags: { series: { frame: 'night' }, blueprint: { frame: 'neutral' } },
    }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /frame/);
      assert.match(err.message, /night/);
      assert.match(err.message, /series/);
      assert.match(err.message, /searched/i);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('compile --dry-run prints the resolved frame name, path and source', () => {
  const root = tmp('nn-frame-dry-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n');
  const series = path.join(root, 'series-a');
  const ep = path.join(series, 'episodes', 'ep-01');
  fs.mkdirSync(path.join(series, 'library', 'frames', 'brand'), { recursive: true });
  fs.mkdirSync(ep, { recursive: true });
  fs.writeFileSync(path.join(series, 'series-a_coNNtent_NN.md'), seriesDoc({ frame: 'brand' }), 'utf8');
  fs.writeFileSync(path.join(series, 'library', 'frames', 'brand', 'FRAME.md'), FRAME_DOC, 'utf8');
  const scriptPath = path.join(ep, 'ep-01_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8');

  const res = spawnSync('node', [cliPath, 'compile', scriptPath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /frame brand: .*frames[\\/]brand[\\/]FRAME\.md \(series\)/);
  fs.rmSync(root, { recursive: true, force: true });
});
