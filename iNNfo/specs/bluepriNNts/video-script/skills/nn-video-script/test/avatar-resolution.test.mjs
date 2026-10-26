import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultResolutionFor, validResolutionsFor, normalizeAvatarResolution, collectAvatarJobs } from '../scripts/lib/avatar-jobs.mjs';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';

const PRUNA = 'pruna-ai/p-video-2-pro/avatar';
const INF = 'wavespeed-ai/infinitetalk-fast';

test('pruna accepts 480p/768p and defaults to 480p', () => {
  assert.deepEqual(validResolutionsFor(PRUNA), ['480p', '768p']);
  assert.equal(defaultResolutionFor(PRUNA), '480p');
  assert.equal(normalizeAvatarResolution('768p', PRUNA), '768p');
  assert.equal(normalizeAvatarResolution(undefined, PRUNA), '480p');
  assert.throws(() => normalizeAvatarResolution('720p', PRUNA), /not supported/);
});

test('infinitetalk keeps 720p', () => {
  assert.equal(defaultResolutionFor(INF), '720p');
  assert.equal(normalizeAvatarResolution(undefined, INF), '720p');
  assert.doesNotThrow(() => normalizeAvatarResolution('720p', INF));
});

test('the compiler lowers avatar_resolution onto the layer', () => {
  const model = {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'v' },
    elements: {
      Video: [{ type: 'Video', name: 'v', slug: 'v', fields: { title: 'v' } }],
      Scene: [{ type: 'Scene', name: 's', slug: 's', description: 'x', fields: {} }],
      Layer: [{ type: 'Layer', name: 'p', slug: 'p', parentSlug: 's', fields: { type: 'presenter', asset: 'a.png', model: PRUNA, avatar_resolution: '768p' } }],
    },
  };
  const lowered = new RemotionSceneCompiler().lowerKnowledgeModel(model);
  assert.equal(lowered.scenes[0].layers[0].properties.layer_avatar_resolution, '768p');
});

test('collectAvatarJobs honors the layer resolution and keys differ by resolution', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-'));
  try {
    const img = path.join(dir, 'a.png');
    fs.writeFileSync(img, Buffer.from('img'));
    const aud = path.join(dir, 'a.mp3');
    fs.writeFileSync(aud, Buffer.from('aud'));
    const cacheManager = { computeHash: (c, o) => JSON.stringify([c, o]) };
    const parsed = {
      scenes: [
        {
          id: 'scene_a',
          narration: 'hi',
          layers: [
            { name: 'p', type: 'presenter', properties: { layer_type: 'talking_avatar', layer_asset_source: img, layer_avatar_model: PRUNA, layer_avatar_resolution: '768p' } },
            { name: 'q', type: 'presenter', properties: { layer_type: 'talking_avatar', layer_asset_source: img, layer_avatar_model: PRUNA } },
          ],
        },
      ],
    };
    const { jobs } = collectAvatarJobs({ parsed, scriptDir: dir, cacheManager, resolveModel: (m) => m || PRUNA, audioFor: () => aud });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].resolution, '768p');
    assert.equal(jobs[1].resolution, '480p');
    assert.notEqual(jobs[0].cacheKey, jobs[1].cacheKey);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
