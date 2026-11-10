import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultResolutionFor, validResolutionsFor, normalizeAvatarResolution, collectAvatarJobs } from '../scripts/lib/avatar-jobs.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) delete process.env[k];

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
      Layer: [{ type: 'Layer', name: 'p', slug: 'p', parentSlug: 's', fields: { type: 'presenter', asset: 'a.png', avatar_model: PRUNA, avatar_resolution: '768p' } }],
    },
  };
  const lowered = new SceneCompiler({ width: 1920, height: 1920 }).lowerKnowledgeModel(model);
  assert.equal(lowered.scenes[0].layers[0].properties.layer_avatar_resolution, '768p');
});

test('collectAvatarJobs honors the layer resolution and keys differ by resolution', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-'));
  try {
    const img = path.join(dir, 'a.png');
    fs.writeFileSync(img, Buffer.from('img'));
    const aud = path.join(dir, 'a.mp3');
    fs.writeFileSync(aud, Buffer.from('aud'));
    // The TTS cache entry for the narration is `aud`; every other lookup misses.
    const cacheManager = { computeHash: (c, o) => JSON.stringify([c, o]), getSync: (k, ext, cat) => (cat === 'tts' ? aud : undefined) };
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
    const { jobs } = collectAvatarJobs({ parsed, scriptDir: dir, cacheManager, config: {}, models: {}, bags: {} });
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].resolution, '768p');
    assert.equal(jobs[1].resolution, '480p');
    assert.notEqual(jobs[0].cacheKey, jobs[1].cacheKey);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('episode whose Series declares kind Gancho resolves without unknown-kind in synthesizeAvatars', async () => {
  const { synthesizeAvatars } = await import('../scripts/synthesize-avatar.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-gancho-'));
  try {
    fs.writeFileSync(path.join(dir, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
    const seriesDir = path.join(dir, 'series', 's');
    const episodeDir = path.join(seriesDir, 'assets', 'e');
    fs.mkdirSync(episodeDir, { recursive: true });

    fs.writeFileSync(
      path.join(seriesDir, 's_coNNtent_NN.md'),
      `---
level: 3
scope: true
title: "Series"
---

# NN Series
## NN Series: S
slug:: s
language:: es

# NN Scene Kind
## NN Scene Kind: Gancho
slug:: gancho
`,
      'utf8',
    );

    const facePath = path.join(episodeDir, 'media', 'face.png');
    fs.mkdirSync(path.dirname(facePath), { recursive: true });
    fs.writeFileSync(facePath, Buffer.from('img'));
    const audioPath = path.join(episodeDir, 'media', 'narration.mp3');
    fs.writeFileSync(audioPath, Buffer.from('audio'));

    const scriptPath = path.join(episodeDir, 'e_coNNtent_NN.md');
    fs.writeFileSync(
      scriptPath,
      `---
level: 3
title: "Episode"
---

# NN Video
## NN Video: E
slug:: e
language:: es

# NN Scene
## NN Scene: Hook
slug:: hook
kind:: Gancho

Narration text for hook.

# NN Layer
## NN Layer: Presenter
type:: avatar
asset:: media/face.png
`,
      'utf8',
    );

    const { synthesizeEpisodeAssets } = await import('../scripts/lib/compile.mjs');
    await synthesizeEpisodeAssets({ scriptPath });

    // Should not throw ScriptValidationError with unknown-kind
    const res = await synthesizeAvatars({
      scriptPath,
      dryRun: true,
      measureDuration: async () => 3,
    });
    assert.ok(res.jobs, 'synthesizeAvatars completes plan with jobs');
    assert.equal(res.jobs.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
