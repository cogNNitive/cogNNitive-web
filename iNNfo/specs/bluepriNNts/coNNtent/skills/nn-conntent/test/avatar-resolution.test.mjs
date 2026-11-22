import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  defaultResolutionFor,
  normalizeAvatarResolution,
  collectAvatarJobs,
} from '../scripts/lib/avatar-jobs.mjs'
import * as avatarJobs from '../scripts/lib/avatar-jobs.mjs'
import * as videoGuard from '../scripts/lib/video-guard.mjs'
import { loadMergedCatalog } from '../scripts/lib/catalog.mjs'
import { SceneCompiler } from '../scripts/scene-compiler.mjs'

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER'])
  delete process.env[k]

const PRUNA = 'pruna-ai/p-video-2-pro/avatar'
const PRUNA_PVIDEO = 'pruna-ai/p-video/avatar'
const avatarModel = (slug, apiId, resolutions, controls = ['resolution']) => ({
  slug,
  provider: 'wavespeed',
  api_id: apiId,
  capability: 'avatar',
  controls,
  resolutions,
  price: 0.02,
  price_unit: 'per_second',
  price_date: '2026-11-02',
  status: 'active',
})
// Two models of the same provider and family, declared as catalog data only (#752 step 3).
const reference = loadMergedCatalog({ overlay: null })
const catalog = {
  ...reference,
  models: {
    ...reference.models,
    'p-video-2-pro-avatar': avatarModel('p-video-2-pro-avatar', PRUNA, ['480p', '768p']),
    'p-video-avatar': avatarModel('p-video-avatar', PRUNA_PVIDEO, ['720p', '1080p']),
  },
}
const INF = reference.models['infinitetalk-fast']

test('the shipped infinitetalk model declares its resolutions and defaults to 720p', () => {
  assert.equal(defaultResolutionFor(INF), '720p')
  assert.equal(normalizeAvatarResolution(undefined, INF), '720p')
  for (const r of ['480p', '720p', '768p']) assert.equal(normalizeAvatarResolution(r, INF), r)
  assert.throws(() => normalizeAvatarResolution('1080p', INF), /not supported/)
})

test('p-video-2-pro and p-video are validated from their own declarations, with no vendor code', () => {
  const pro = catalog.models['p-video-2-pro-avatar']
  assert.equal(defaultResolutionFor(pro), '480p')
  assert.equal(normalizeAvatarResolution('768p', pro), '768p')
  assert.throws(() => normalizeAvatarResolution('720p', pro), /not supported/)
  const pvideo = catalog.models['p-video-avatar']
  assert.equal(defaultResolutionFor(pvideo), '720p')
  // 1080p is reachable: the select no longer has a global enum, the model decides.
  assert.equal(normalizeAvatarResolution('1080p', pvideo), '1080p')
  assert.throws(() => normalizeAvatarResolution('768p', pvideo), /not supported/)
})

test('a resolution for a model that does not declare the resolution control is refused', () => {
  const fixed = avatarModel('fixed', 'acme/fixed', [], [])
  assert.throws(() => normalizeAvatarResolution('720p', fixed), /unsupported-control/)
})

test('the engine holds no resolution table: validResolutionsFor and the profiles are gone', () => {
  assert.equal(avatarJobs.validResolutionsFor, undefined)
  assert.equal(videoGuard.AVATAR_RESOLUTION_PROFILES, undefined)
  assert.equal(videoGuard.avatarResolutionProfileFor, undefined)
})

test('the compiler lowers avatar_resolution onto the layer', () => {
  const model = {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'v' },
    elements: {
      Video: [{ type: 'Video', name: 'v', slug: 'v', fields: { title: 'v' } }],
      Scene: [{ type: 'Scene', name: 's', slug: 's', description: 'x', fields: {} }],
      Layer: [
        {
          type: 'Layer',
          name: 'p',
          slug: 'p',
          parentSlug: 's',
          fields: {
            type: 'presenter',
            asset: 'a.png',
            avatar_model: PRUNA,
            avatar_resolution: '768p',
          },
        },
      ],
    },
  }
  const lowered = new SceneCompiler({ width: 1920, height: 1920 }).lowerKnowledgeModel(model)
  assert.equal(lowered.scenes[0].layers[0].properties.layer_avatar_resolution, '768p')
})

test('collectAvatarJobs honors the layer resolution and keys differ by resolution', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-'))
  try {
    const img = path.join(dir, 'a.png')
    fs.writeFileSync(img, Buffer.from('img'))
    const aud = path.join(dir, 'a.mp3')
    fs.writeFileSync(aud, Buffer.from('aud'))
    // The TTS cache entry for the narration is `aud`; every other lookup misses.
    const cacheManager = {
      computeHash: (c, o) => JSON.stringify([c, o]),
      getSync: (k, ext, cat) => (cat === 'tts' ? aud : undefined),
    }
    const parsed = {
      scenes: [
        {
          id: 'scene_a',
          narration: 'hi',
          layers: [
            {
              name: 'p',
              type: 'presenter',
              properties: {
                layer_type: 'talking_avatar',
                layer_asset_source: img,
                layer_avatar_model: PRUNA,
                layer_avatar_resolution: '768p',
              },
            },
            {
              name: 'q',
              type: 'presenter',
              properties: {
                layer_type: 'talking_avatar',
                layer_asset_source: img,
                layer_avatar_model: PRUNA,
              },
            },
          ],
        },
      ],
    }
    const { jobs } = collectAvatarJobs({
      parsed,
      scriptDir: dir,
      cacheManager,
      config: {},
      models: {},
      bags: {},
      catalog,
    })
    assert.equal(jobs.length, 2)
    assert.equal(jobs[0].resolution, '768p')
    assert.equal(jobs[1].resolution, '480p')
    assert.notEqual(jobs[0].cacheKey, jobs[1].cacheKey)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('episode whose Series declares kind Gancho resolves without unknown-kind in synthesizeAvatars', async () => {
  const { synthesizeAvatars } = await import('../scripts/synthesize-avatar.mjs')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-gancho-'))
  try {
    fs.writeFileSync(path.join(dir, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8')
    // The blueprint pins no vendor model: the domain defaults plug the avatar model in.
    fs.writeFileSync(
      path.join(dir, 'video-defaults_NN.md'),
      '---\nlevel: 3\ntitle: "Video Defaults"\n---\n\n# NN Video Defaults\n\n## NN Video Defaults: Defaults\nslug:: defaults\navatar_model:: wavespeed-ai/infinitetalk-fast\n',
      'utf8',
    )
    const seriesDir = path.join(dir, 'series', 's')
    const episodeDir = path.join(seriesDir, 'assets', 'e')
    fs.mkdirSync(episodeDir, { recursive: true })

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
    )

    const facePath = path.join(episodeDir, 'media', 'face.png')
    fs.mkdirSync(path.dirname(facePath), { recursive: true })
    fs.writeFileSync(facePath, Buffer.from('img'))
    const audioPath = path.join(episodeDir, 'media', 'narration.mp3')
    fs.writeFileSync(audioPath, Buffer.from('audio'))

    const scriptPath = path.join(episodeDir, 'e_coNNtent_NN.md')
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
    )

    const { synthesizeEpisodeAssets } = await import('../scripts/lib/compile.mjs')
    await synthesizeEpisodeAssets({ scriptPath })

    // Should not throw ScriptValidationError with unknown-kind
    const res = await synthesizeAvatars({
      scriptPath,
      dryRun: true,
      measureDuration: async () => 3,
    })
    assert.ok(res.jobs, 'synthesizeAvatars completes plan with jobs')
    assert.equal(res.jobs.length, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a model with the resolution control but no declared resolutions is refused before spend (B1)', () => {
  // An overlay written before resolutions existed: the control is declared, its values are not.
  const legacy = avatarModel('p-video-avatar', PRUNA_PVIDEO, undefined)
  const refusal = (err) =>
    /p-video\/avatar/.test(err.message) && /resolutions:: \[/.test(err.message)
  assert.throws(() => normalizeAvatarResolution(undefined, legacy), refusal)
  assert.throws(() => normalizeAvatarResolution('480p', legacy), refusal)
  assert.throws(() => normalizeAvatarResolution('1080p', legacy), refusal)
  assert.throws(() => defaultResolutionFor(legacy), refusal)
})
