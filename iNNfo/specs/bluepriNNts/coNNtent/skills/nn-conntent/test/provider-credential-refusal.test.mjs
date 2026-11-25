/**
 * nn-conntent/test/provider-credential-refusal.test.mjs
 *
 * A catalog that cannot name a credential must stop the run, not silently downgrade it.
 *
 * Observed: the installed nn-conntent skill resolved a sibling copy of the coNNtent catalog
 * (`~/.agents/catalog/model-catalog_coNNtent_NN.md`) whose three Providers declared no
 * `env_key`. No credential could resolve, every TTS call was replaced by the silent
 * placeholder, and the pipeline died far downstream at caption alignment ("match ratio 0.00")
 * after delivering a video with -91 dB audio. The blueprint spec's `Provider` element already
 * says a Model whose Provider "declares no complete transport, is refused before any call":
 * this suite pins that refusal for the two shapes a stale or empty catalog produces.
 *
 * The control case keeps the documented offline behaviour: a complete catalog with its key
 * simply unset still synthesizes the placeholder, and the warning names the variable.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs'
import { CacheManager } from '../scripts/cache-manager.mjs'
import { SpendGuard, DEFAULT_GUARD } from '../scripts/lib/video-guard.mjs'
import { REFERENCE_CATALOG, mergeCatalog, parseCatalog } from '../scripts/lib/catalog.mjs'

/** The TTS model the reference catalog declares, addressed by the api_id the engine sends. */
const TTS = 'minimax/speech-2.8-hd'

const REFERENCE_TEXT = fs.readFileSync(REFERENCE_CATALOG, 'utf8')

/** The reported stale copy: the same file, with no Provider naming a credential. */
function staleCatalog() {
  const text = REFERENCE_TEXT.replace(/^env_key::.*$/gm, '')
  assert.doesNotMatch(text, /env_key/, 'the stale fixture must declare no env_key')
  return parseCatalog(text)
}

function setup(parsed) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nn-credential-')))
  const guard = new SpendGuard({
    config: structuredClone(DEFAULT_GUARD),
    root,
    approval: () => ({ ok: true }),
  })
  const cacheManager = new CacheManager({ baseDir: path.join(root, 'cache') })
  const synthesizer = new AssetSynthesizer({
    guard,
    cacheManager,
    catalog: mergeCatalog(parsed, null),
    env: {},
    defaultModels: { tts: TTS },
  })
  return { root, cacheManager, synthesizer }
}

/** Every audio file a run left behind (a silent placeholder included). */
function audioFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return audioFiles(full)
    return /\.(mp3|aac|wav)$/i.test(entry.name) ? [full] : []
  })
}

test('a catalog whose Providers declare no env_key refuses instead of synthesizing silence', async () => {
  const { root, synthesizer } = setup(staleCatalog())
  await assert.rejects(synthesizer.synthesizeTTS('hola mundo', {}, {}), (err) => {
    assert.equal(err.code, 'catalog-no-provider-credential', 'the refusal has its own code')
    assert.match(err.message, /env_key/, 'it names the missing field')
    assert.ok(
      err.message.includes(path.basename(REFERENCE_CATALOG)),
      `it names the stale file, got: ${err.message}`,
    )
    assert.match(
      err.message,
      /bluepriNNts[\\/]coNNtent[\\/]catalog/,
      'it names the catalog to copy',
    )
    return true
  })
  assert.deepEqual(audioFiles(root), [], 'no placeholder was stored under any audio name')
})

test('a catalog that declares no Provider at all refuses the same way', async () => {
  const parsed = staleCatalog()
  const { root, synthesizer } = setup({ ...parsed, providers: {} })
  await assert.rejects(synthesizer.synthesizeTTS('hola mundo', {}, {}), (err) => {
    assert.equal(err.code, 'catalog-no-provider-credential')
    assert.match(err.message, /no Provider/, 'an empty provider set is named as such')
    return true
  })
  assert.deepEqual(audioFiles(root), [], 'no placeholder was stored')
})

test('an undeclared model with no key set says plainly that no credential resolved', async (t) => {
  const warnings = []
  t.mock.method(console, 'warn', (message) => warnings.push(String(message)))
  const { root, cacheManager, synthesizer } = setup(parseCatalog(REFERENCE_TEXT))
  synthesizer.defaultModels.tts = 'waveforms-ai/not-in-the-catalog'

  const result = await synthesizer.synthesizeTTS('hola mundo', {}, {})
  assert.ok(result.assetPath, 'the documented offline placeholder is still produced')
  assert.equal((await cacheManager.get(result.sha256 + '-offline', 'mp3', 'tts')) !== null, true)

  const text = warnings.join('\n')
  assert.doesNotMatch(text, /no provider credential is not set/, 'the double negative is gone')
  assert.match(text, /no provider credential is set/, 'it says plainly that none resolved')
  for (const key of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN']) {
    assert.ok(text.includes(key), `it names ${key} as a variable to set`)
  }
  fs.rmSync(root, { recursive: true, force: true })
})

test('a complete catalog with its key unset still synthesizes the documented offline placeholder', async (t) => {
  const warnings = []
  t.mock.method(console, 'warn', (message) => warnings.push(String(message)))
  const { synthesizer } = setup(parseCatalog(REFERENCE_TEXT))

  const result = await synthesizer.synthesizeTTS('hola mundo', {}, {})

  assert.ok(result.assetPath, 'the offline placeholder is returned')
  assert.equal(result.fromCache, false)
  const text = warnings.join('\n')
  assert.match(text, /WAVESPEED_API_KEY is not set/, 'the warning names the environment variable')
  assert.doesNotMatch(
    text,
    /no provider credential is not set/,
    'the old double-negative wording must be gone',
  )
})
