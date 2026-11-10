/**
 * Regression: every consumer builds the same TTS cache key.
 *
 * A domaiNN registers its voices in `model-catalog_NN.md`. The TTS cache key is
 * computed from the guard config (`ttsCacheKeyFor` -> `resolveRegisteredVoice`), so a
 * consumer that merged the catalog voices and one that did not wrote and looked up
 * two different keys for the same narration. `compile` merged; `synthesize-avatar`
 * did not, and the avatar job failed with "no TTS cache entry" for audio that was
 * already on disk.
 *
 * `loadGuardWithVoices` is now the only way to build that config.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { loadGuardWithVoices } from '../scripts/lib/guard-config.mjs'
import { loadGuard } from '../scripts/lib/video-guard.mjs'
import { CacheManager } from '../scripts/cache-manager.mjs'
import { ttsCacheKeyFor } from '../scripts/lib/avatar-jobs.mjs'

const CATALOG = `---
level: 3
title: "Probe catalog"
---

# NN index

* [[Voice]]

# NN Voice

## NN Voice: villabotijos

slug:: villabotijos
model:: minimax-speech-2-8-hd
voice_id:: Villabotijos01
language:: es
`

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-guard-voices-'))
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8')
  fs.writeFileSync(path.join(root, 'model-catalog_NN.md'), CATALOG, 'utf8')
  const episode = path.join(root, 'series', 's', 'episodes', 'e')
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true })
  return { root, episode }
}

test('loadGuardWithVoices merges the domaiNN catalog voices into the guard config', () => {
  const { root } = fixture()
  const merged = loadGuardWithVoices(root)
  assert.equal(merged.config.voices.villabotijos.voice_id, 'Villabotijos01')
  assert.equal(merged.config.voices.villabotijos.language, 'es')
  fs.rmSync(root, { recursive: true, force: true })
})

test('the bare guard config has no catalog voices: that was the divergence', () => {
  const { root } = fixture()
  assert.equal(loadGuard(root).config.voices.villabotijos, undefined)
  fs.rmSync(root, { recursive: true, force: true })
})

test('the avatar job and the compiler agree on the TTS cache key for a catalog voice', () => {
  const { root, episode } = fixture()
  const config = loadGuardWithVoices(episode).config
  const cacheManager = new CacheManager({ baseDir: path.join(root, 'cache'), readOnly: true })
  const scene = { id: 'scene-1', narration: 'hola', properties: { scene_voice: 'villabotijos' } }
  const bags = { series: { voice: 'villabotijos', voice_model: 'minimax/speech-2-8-hd' } }

  const key = ttsCacheKeyFor(scene, { cacheManager, config, models: { tts: 'minimax/speech-2-8-hd' }, bags })
  assert.match(key, /^[a-f0-9]{64}$/, 'a key is computed')
  // The same narration under the config without catalog voices is a different key,
  // which is exactly how the avatar job missed the audio compile had written.
  const bare = ttsCacheKeyFor(scene, { cacheManager, config: loadGuard(episode).config, models: { tts: 'minimax/speech-2-8-hd' }, bags })
  assert.notEqual(key, bare)
  fs.rmSync(root, { recursive: true, force: true })
})
