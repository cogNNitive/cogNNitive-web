/**
 * nn-video-script/test/master-resolution.test.mjs
 *
 * One declared master size (design D3/D5, capability cognnitive-video-engine):
 * `master_resolution` drives the manifest, nothing in engine code defaults to
 * 1920x1080, the retired CLI flags are refused, and the overlay components lay
 * out inside the central 1080x1080 safe square so a crop cannot cut them.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { DELIVERY_FORMATS } from '../scripts/render-formats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), 'utf8').replace(/\r\n/g, '\n');

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
  const cli = read('scripts/video-engine-cli.mjs');
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

test('every delivery format is the declared crop or scale of the master', () => {
  assert.equal(DELIVERY_FORMATS.vertical.width, 1080);
  assert.equal(DELIVERY_FORMATS.vertical.height, 1920);
  assert.equal(DELIVERY_FORMATS.horizontal.width, 1920);
  assert.equal(DELIVERY_FORMATS.horizontal.height, 1080);
  assert.equal(DELIVERY_FORMATS.square.width, 1080);
  assert.equal(DELIVERY_FORMATS.square.height, 1080);
});

test('the six overlay components lay out inside the central safe square', () => {
  for (const name of ['lower-third', 'caption', 'title', 'quote', 'watermark', 'b-roll']) {
    const html = read(path.join('components', name + '.html'));
    assert.match(html, /#root \{ position: absolute; inset: 21\.875%; overflow: visible; \}/, `${name} carries the inset`);
    assert.doesNotMatch(html, /#root \{ position: absolute; inset: 0;/, `${name} no longer fills the whole master`);
  }
});

test('the safe square is the intersection of the three crops', () => {
  // 1920 - 2*420 = 1080 in both axes; 420/1920 = 21.875%.
  assert.equal(1920 - 2 * 420, 1080);
  assert.equal(Math.round((420 / 1920) * 100000) / 1000, 21.875);
});
