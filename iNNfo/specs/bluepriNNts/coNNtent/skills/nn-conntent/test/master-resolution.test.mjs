/**
 * nn-conntent/test/master-resolution.test.mjs
 *
 * Declared output sizes (design D3/D5, spec S3): `output_formats` drives every manifest,
 * its first entry sizes the lowered model, the legacy `master_resolution` is still read as
 * a one-format list, nothing in engine code defaults to 1920x1080, the retired CLI flags
 * are refused, and the crop derivation of a square master is gone (V_0-26-0).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), 'utf8').replace(/\r\n/g, '\n');
/** Reads `<bps>/library/components/<name>/index.html`. */
const relToBps = (bps, name) => path.join('..', path.relative(SKILL, bps), 'library', 'components', name, 'index.html');

function model(sceneFields = {}, videoFields = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V', ...videoFields } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words here', fields: sceneFields }],
      Layer: [],
    },
  };
}

test('the compiler takes its size from the declared master_resolution', () => {
  const compiler = new SceneCompiler({ fps: 30 });
  const lowered = compiler.lowerKnowledgeModel(model(), { bags: { blueprint: { master_resolution: '1920x1920' } } });
  assert.equal(lowered.width, 1920);
  assert.equal(lowered.height, 1920);
  assert.equal(lowered.masterResolution, '1920x1920');
});

test('an unsupported master_resolution fails before any spend', () => {
  const compiler = new SceneCompiler({ fps: 30 });
  assert.throws(
    () => compiler.lowerKnowledgeModel(model(), { bags: { blueprint: { master_resolution: 'wide' } } }),
    /unsupported-master-resolution/,
  );
});

test('no width/height and no declaration is a named error, never a 1920x1080 assumption', () => {
  const compiler = new SceneCompiler({ fps: 30 });
  assert.throws(() => compiler.compile(model()), /missing-master-resolution/);
});

test('the retired format flags are gone from the CLI', () => {
  const cli = read('scripts/lib/render.mjs');
  assert.doesNotMatch(cli, /DELIVERY_FORMATS/);
  assert.doesNotMatch(cli, /resolveFormatSize/);
  assert.doesNotMatch(cli, /--format/);
  assert.doesNotMatch(cli, /--width/);
  assert.doesNotMatch(cli, /--height/);
});

test('the projector carries no 1920x1080 default and no orientation branch', () => {
  const project = read('scripts/scene-project.mjs');
  assert.doesNotMatch(project, /\|\| 1920/);
  assert.doesNotMatch(project, /\|\| 1080/);
  assert.doesNotMatch(project, /isHorizontal/);
  // The comment that explains the removal still names the retired offset, so the
  // assertion looks for the code, not the prose.
  assert.doesNotMatch(project, /objectPos = 'center 12%'/);
});

test('there is no derivation step: render-formats and its formats/ folder are retired', () => {
  assert.equal(fs.existsSync(path.join(SKILL, 'scripts', 'render-formats.mjs')), false);
  assert.doesNotMatch(read('scripts/lib/pipeline.mjs'), /render-formats|'formats'|DELIVERY_FORMATS/);
});

test('the compiler lists every declared output format, the first one sizing the model', () => {
  const compiler = new SceneCompiler();
  const lowered = compiler.lowerKnowledgeModel(model(), {
    bags: { blueprint: { output_formats: ['1920x1080', '1080x1920', '1080x1080'] } },
  });
  assert.equal(lowered.width, 1920);
  assert.equal(lowered.height, 1080);
  assert.deepEqual(lowered.outputFormats.map((f) => f.size), ['1920x1080', '1080x1920', '1080x1080']);
});

test('the overlay components carry no central-square inset (the safe area is per canvas)', () => {
  // Components live as `library/components/<name>/index.html` in the package; their
  // per-canvas layout is pinned by safe-area.test.mjs and safe-zone.test.mjs.
  const BPS = path.resolve(__dirname, '..', '..', '..'); // test -> nn-conntent -> skills -> coNNtent
  for (const name of ['lower-third', 'caption', 'title', 'quote', 'watermark', 'b-roll']) {
    const html = fs.readFileSync(path.join(BPS, 'library', 'components', name, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /inset: 21\.875%/, `${name} has no central-square inset`);
    assert.match(html, /var\(--safe-top/, `${name} reads the canvas safe area`);
  }
});
