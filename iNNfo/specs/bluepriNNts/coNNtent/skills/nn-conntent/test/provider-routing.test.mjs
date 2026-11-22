/**
 * nn-conntent/test/provider-routing.test.mjs
 *
 * #752 step 1: a Model's Provider is declared data. The synthesizer routes each call by the
 * model it makes (not by which credential happens to be set), calls the model's own
 * `api_id`, and refuses an undeclared model or provider before any network call. Every
 * request goes to an injected fake fetch; no real key is read.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs'
import { CacheManager } from '../scripts/cache-manager.mjs'
import { SpendGuard, DEFAULT_GUARD, ModelBlockedError } from '../scripts/lib/video-guard.mjs'
import { loadMergedCatalog } from '../scripts/lib/catalog.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPTS = path.resolve(HERE, '..', 'scripts')
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom0000')])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function setup(allowed = []) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'provider-routing-')))
  const config = { ...structuredClone(DEFAULT_GUARD), budgetPerRunUsd: 50, dailyCapUsd: 50 }
  config.allowedModels = [...config.allowedModels, ...allowed]
  const guard = new SpendGuard({ config, root, approval: () => ({ ok: true }) })
  return { root, guard, cacheManager: new CacheManager({ baseDir: path.join(root, 'cache') }) }
}

function fakeFetch() {
  const calls = []
  const fetch = async (url, init = {}) => {
    const u = String(url)
    calls.push({
      url: u,
      method: init.method || 'GET',
      headers: init.headers || {},
      body: init.body ? JSON.parse(init.body) : null,
    })
    if (init.method === 'POST')
      return { ok: true, status: 200, json: async () => ({ data: { id: 'task-1' } }) }
    if (u.startsWith('https://cdn.fake/')) {
      const bytes = u.endsWith('.mp4') ? MP4 : PNG
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(bytes).buffer }
    }
    const out = u.includes('replicate') ? 'https://cdn.fake/out.png' : 'https://cdn.fake/out.mp4'
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { status: 'completed', outputs: [out] } }),
    }
  }
  return { calls, fetch }
}

const files = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-routing-files-'))
const file = (name) => {
  const p = path.join(files, name)
  if (!fs.existsSync(p)) fs.writeFileSync(p, 'x')
  return p
}

function synth(ctx, provider, extra = {}) {
  return new AssetSynthesizer({
    cacheManager: ctx.cacheManager,
    guard: ctx.guard,
    env: { WAVESPEED_API_KEY: 'fake-wavespeed', REPLICATE_API_TOKEN: 'fake-replicate' },
    fetch: provider.fetch,
    sleep: async () => {},
    ...extra,
  })
}

/** The reference catalog plus test-only models, so no reference price is touched. */
function catalogWith(models) {
  const base = loadMergedCatalog({ overlay: null })
  return { ...base, models: { ...base.models, ...models } }
}

describe('per-model provider routing (#752 step 1)', () => {
  it('routes an image model and an avatar model of two providers in one run', async () => {
    const ctx = setup()
    const provider = fakeFetch()
    const s = synth(ctx, provider)
    await s.resolveMedia('a barn', { model: 'black-forest-labs/flux-schnell' })
    await s.resolveTalkingAvatar(file('face.png'), file('line.mp3'), {
      model: 'wavespeed-ai/infinitetalk-fast',
      durationSeconds: 3,
    })
    const posts = provider.calls.filter((c) => c.method === 'POST')
    assert.equal(posts.length, 2)
    assert.equal(posts[0].url, 'https://api.replicate.com/v1/predictions')
    assert.equal(posts[0].headers.Authorization, 'Token fake-replicate')
    assert.equal(posts[0].body.version, 'black-forest-labs/flux-schnell')
    assert.equal(posts[0].body.input.prompt, 'a barn')
    assert.equal(posts[1].url, 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk-fast')
    assert.equal(posts[1].headers.Authorization, 'Bearer fake-wavespeed')
    const polls = provider.calls.filter(
      (c) => c.method === 'GET' && !c.url.startsWith('https://cdn.fake/'),
    )
    assert.ok(polls.some((c) => c.url === 'https://api.replicate.com/v1/predictions/task-1'))
    assert.ok(
      polls.some((c) => c.url === 'https://api.wavespeed.ai/api/v3/predictions/task-1/result'),
    )
  })

  it("calls the catalog model's own api_id on Replicate (never a baked-in model)", async () => {
    const other = 'acme/other-image'
    const ctx = setup([other])
    const provider = fakeFetch()
    const catalog = catalogWith({
      'acme-other-image': {
        slug: 'acme-other-image',
        provider: 'replicate',
        api_id: other,
        capability: 'image',
        controls: ['size'],
        adapter: 'replicate-image',
        price: 0.001,
        price_unit: 'per_image',
        price_date: '2026-11-02',
        status: 'active',
      },
    })
    await synth(ctx, provider, {
      env: { REPLICATE_API_TOKEN: 'fake-replicate' },
      catalog,
    }).resolveMedia('a field', { model: other })
    const post = provider.calls.find((c) => c.method === 'POST')
    assert.equal(post.body.version, other)
  })

  it('routes by the model, not by which credential is set: a WaveSpeed model with only that key', async () => {
    const ctx = setup()
    const provider = fakeFetch()
    await synth(ctx, provider, { env: { WAVESPEED_API_KEY: 'fake-wavespeed' } }).resolveMedia(
      'a lake',
      { model: 'wavespeed-ai/z-image/turbo' },
    )
    const post = provider.calls.find((c) => c.method === 'POST')
    assert.equal(post.url, 'https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo')
  })
})

describe('fail closed before any network call', () => {
  it('refuses a model the guard allows but the catalog does not declare', async () => {
    const ctx = setup(['acme/undeclared'])
    const provider = fakeFetch()
    await assert.rejects(
      synth(ctx, provider).resolveMedia('x', { model: 'acme/undeclared' }),
      (err) => err.code === 'unknown-model',
    )
    assert.equal(provider.calls.length, 0)
  })

  it('refuses a declared model whose provider is not declared', async () => {
    const ctx = setup(['acme/orphan'])
    const provider = fakeFetch()
    const catalog = catalogWith({
      orphan: {
        slug: 'orphan',
        provider: 'nowhere',
        api_id: 'acme/orphan',
        capability: 'image',
        adapter: 'wavespeed-image',
        price: 0.001,
        price_unit: 'per_image',
        price_date: '2026-11-02',
        status: 'active',
      },
    })
    await assert.rejects(
      synth(ctx, provider, { catalog }).resolveMedia('x', { model: 'acme/orphan' }),
      (err) => err.code === 'unknown-provider',
    )
    assert.equal(provider.calls.length, 0)
  })

  it('keeps the guard first: a declared model outside the allowlist is still ModelBlockedError', async () => {
    const ctx = setup()
    ctx.guard.config.allowedModels = ctx.guard.config.allowedModels.filter(
      (m) => m !== 'black-forest-labs/flux-schnell',
    )
    const provider = fakeFetch()
    await assert.rejects(
      synth(ctx, provider).resolveMedia('x', { model: 'black-forest-labs/flux-schnell' }),
      ModelBlockedError,
    )
    assert.equal(provider.calls.length, 0)
  })

  it('refuses an image call that names no model instead of picking a provider default', async () => {
    const ctx = setup()
    const provider = fakeFetch()
    await assert.rejects(
      synth(ctx, provider, { env: { REPLICATE_API_TOKEN: 'fake-replicate' } }).resolveMedia(
        'x',
        {},
      ),
      /image_model:: <api_id>/,
    )
    assert.equal(provider.calls.length, 0)
  })
})

describe('the engine owns no provider constant', () => {
  it('no provider URL, credential-variable branch or process-wide provider switch survives in engine code', () => {
    const offenders = []
    for (const rel of ['asset-synthesizer.mjs', 'voice-clone.mjs', 'synthesize-avatar.mjs']) {
      const text = fs.readFileSync(path.join(SCRIPTS, rel), 'utf8')
      if (/api\.wavespeed\.ai|api\.replicate\.com/.test(text))
        offenders.push(`${rel} (provider URL)`)
      if (/MEDIA_PROVIDER|mediaProvider/.test(text))
        offenders.push(`${rel} (process-wide provider switch)`)
      if (/env\.(WAVESPEED_API_KEY|REPLICATE_API_TOKEN)/.test(text))
        offenders.push(`${rel} (credential variable branch)`)
    }
    assert.deepEqual(offenders, [])
  })
})
