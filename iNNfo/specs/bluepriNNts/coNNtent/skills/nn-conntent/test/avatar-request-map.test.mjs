/**
 * nn-conntent/test/avatar-request-map.test.mjs
 *
 * #752 step 2: the avatar request body is the Model's own JSON, declared as data. A Model's
 * `request_map` renames the engine's inputs (`image`, `audio`, `resolution`) to the field
 * names its provider expects; a Model with no `request_map` gets today's body unchanged.
 * Every request goes to an injected fake fetch.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildAvatarRequest } from '../scripts/lib/avatar-request.mjs'
import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs'
import { CacheManager } from '../scripts/cache-manager.mjs'
import { SpendGuard, DEFAULT_GUARD } from '../scripts/lib/video-guard.mjs'
import { loadMergedCatalog } from '../scripts/lib/catalog.mjs'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-request-map-'))
const img = path.join(dir, 'face.png')
const aud = path.join(dir, 'line.mp3')
fs.writeFileSync(img, Buffer.from([1, 2, 3]))
fs.writeFileSync(aud, Buffer.from([4, 5, 6]))
const IMAGE = 'data:image/png;base64,' + Buffer.from([1, 2, 3]).toString('base64')
const AUDIO = 'data:audio/mpeg;base64,' + Buffer.from([4, 5, 6]).toString('base64')

describe('buildAvatarRequest request_map', () => {
  it("without a request_map builds today's body byte for byte", () => {
    const body = buildAvatarRequest({ imagePath: img, audioPath: aud, resolution: '720p' })
    assert.equal(
      JSON.stringify(body),
      JSON.stringify({ image: IMAGE, audio: AUDIO, resolution: '720p' }),
    )
    const empty = buildAvatarRequest({
      imagePath: img,
      audioPath: aud,
      resolution: '720p',
      requestMap: [],
    })
    assert.equal(JSON.stringify(empty), JSON.stringify(body))
  })

  it("renames the inputs to the Model's own field names and sends only the mapped ones", () => {
    const body = buildAvatarRequest({
      imagePath: img,
      audioPath: aud,
      resolution: '768p',
      requestMap: ['image=image_url', 'audio=speech'],
    })
    assert.deepEqual(body, { image_url: IMAGE, speech: AUDIO })
  })

  it('refuses a map that names an input the engine does not produce', () => {
    assert.throws(
      () => buildAvatarRequest({ imagePath: img, audioPath: aud, requestMap: ['video=clip'] }),
      (err) => err.code === 'unknown-request-input' && /video/.test(err.message),
    )
  })
})

describe('a catalog-only model with its own request shape (#752 acceptance)', () => {
  const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom0000')])
  const run = async (model, catalog) => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-map-run-')))
    const config = {
      ...structuredClone(DEFAULT_GUARD),
      allowedModels: [...DEFAULT_GUARD.allowedModels, 'acme/talker'],
    }
    const guard = new SpendGuard({ config, root, approval: () => ({ ok: true }) })
    const bodies = []
    const fetch = async (url, init = {}) => {
      if (init.method === 'POST') {
        bodies.push(JSON.parse(init.body))
        return { ok: true, status: 200, json: async () => ({ data: { id: 't1' } }) }
      }
      if (String(url).startsWith('https://cdn.fake/'))
        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(MP4).buffer }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'completed', outputs: ['https://cdn.fake/a.mp4'] } }),
      }
    }
    const synth = new AssetSynthesizer({
      cacheManager: new CacheManager({ baseDir: path.join(root, 'cache') }),
      guard,
      env: { WAVESPEED_API_KEY: 'fake-key' },
      fetch,
      sleep: async () => {},
      catalog,
    })
    await synth.resolveTalkingAvatar(img, aud, { model, resolution: '720p', durationSeconds: 2 })
    return bodies
  }

  it('is callable by editing the catalog only', async () => {
    const base = loadMergedCatalog({ overlay: null })
    const catalog = {
      ...base,
      models: {
        ...base.models,
        talker: {
          slug: 'talker',
          provider: 'wavespeed',
          api_id: 'acme/talker',
          capability: 'avatar',
          controls: ['resolution'],
          adapter: 'infinitetalk',
          price: 0.01,
          price_unit: 'per_second',
          price_date: '2026-11-02',
          status: 'active',
          request_map: ['image=image_url', 'audio=audio_file', 'resolution=output_resolution'],
        },
      },
    }
    assert.deepEqual(await run('acme/talker', catalog), [
      { image_url: IMAGE, audio_file: AUDIO, output_resolution: '720p' },
    ])
  })

  it("keeps today's body for the shipped default avatar model", async () => {
    const bodies = await run('wavespeed-ai/infinitetalk-fast', loadMergedCatalog({ overlay: null }))
    assert.equal(
      JSON.stringify(bodies[0]),
      JSON.stringify({ image: IMAGE, audio: AUDIO, resolution: '720p' }),
    )
  })
})
