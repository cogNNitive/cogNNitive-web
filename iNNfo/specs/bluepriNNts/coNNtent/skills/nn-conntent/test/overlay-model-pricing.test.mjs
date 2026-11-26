/**
 * nn-conntent/test/overlay-model-pricing.test.mjs
 *
 * A Model declared only by the domaiNN overlay (`model-catalog_NN.md` at the domain root)
 * is the documented place for a domain model. The plan builder used to read the reference
 * catalog alone (`loadMergedCatalog({ overlay: null })`, cached for the process), so such a
 * model could be allowed and priced in the overlay and the estimate still refused it:
 *
 *   unpriced-model: "<id>" is allowed but has no price in the merged catalog.
 *
 * `mergeCatalog` already merges models, providers and voices per slug with the overlay
 * winning; what was missing was the overlay itself at the lookup. These tests price a
 * domain-only avatar model through `estimateScriptCost` and through the direct lookup.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { estimateScriptCost, findCatalogEntry } from '../scripts/asset-cost-estimator.mjs'
import { loadMergedCatalog, mergeCatalog } from '../scripts/lib/catalog.mjs'

const OVERLAY_MODEL = 'acme/talker-avatar'

/** The domain overlay: one avatar Model that exists nowhere in the reference catalog. */
const OVERLAY = `---
level: 3
title: "Model Catalog"
---

# NN Model

## NN Model: acme-talker-avatar
slug:: acme-talker-avatar
provider:: acme
api_id:: ${OVERLAY_MODEL}
capability:: avatar
controls:: [resolution]
resolutions:: [720p, 480p]
price:: 0.02
price_unit:: per_second
price_date:: 2026-11-02
allowed:: true
`

const DOMAIN_DEFAULTS = `---
level: 3
title: "Video Defaults"
---

# NN Video Defaults

## NN Video Defaults: Defaults
slug:: defaults
avatar_model:: ${OVERLAY_MODEL}
`

/** The retired guard file, still honoured as an explicit override. */
const GUARD = JSON.stringify({
  version: 1,
  budgetPerRunUsd: 10,
  dailyCapUsd: 10,
  allowedModels: ['minimax/speech-2.8-hd', OVERLAY_MODEL],
})

const SCRIPT = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-1-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Overlay Demo"
---

# NN Video

## NN Video: Overlay Demo
slug:: overlay-demo

# NN Scene

## NN Scene: Opening
slug:: opening
voice:: demo-voice
voice_model:: minimax/speech-2.8-hd

The host introduces the overlay model.

# NN Layer

## NN Layer: Host
slug:: host
type:: presenter
asset:: media/face.jpeg
`

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-overlay-price-'))
  fs.writeFileSync(path.join(dir, 'model-catalog_NN.md'), OVERLAY, 'utf8')
  fs.writeFileSync(path.join(dir, 'video-defaults_NN.md'), DOMAIN_DEFAULTS, 'utf8')
  fs.writeFileSync(path.join(dir, 'video-guard.json'), GUARD, 'utf8')
  fs.mkdirSync(path.join(dir, 'media'))
  fs.writeFileSync(path.join(dir, 'media', 'face.jpeg'), Buffer.from('face'))
  const scriptPath = path.join(dir, 'script_NN.md')
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8')
  return { dir, scriptPath }
}

test('an overlay-only model is priced by the estimate instead of refused as unpriced', () => {
  const { dir, scriptPath } = setup()
  try {
    const catalog = loadMergedCatalog({ domainRoot: dir })
    const entry = findCatalogEntry('avatar', OVERLAY_MODEL, catalog)
    assert.ok(entry, 'the merged catalog holds the overlay model')
    assert.equal(entry.unitPricePerSecond, 0.02)

    const estimate = estimateScriptCost(scriptPath)
    assert.equal(estimate.scenes[0].avatarModel, 'acme-talker-avatar')
    assert.ok(estimate.summary.totalAvatarCost > 0, 'the avatar is priced, not refused')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('the merged catalog keeps merging providers and voices, not only models', () => {
  const reference = {
    providers: { acme: { slug: 'acme', credential: 'REFERENCE_KEY' } },
    models: {},
    voices: { 'ref-voice': { slug: 'ref-voice', voice_id: 'a' } },
  }
  const overlay = {
    providers: { acme: { slug: 'acme', credential: 'DOMAIN_KEY' } },
    models: {},
    voices: { 'ref-voice': { slug: 'ref-voice', voice_id: 'b' } },
  }
  const merged = mergeCatalog(reference, overlay)
  assert.equal(merged.providers.acme.credential, 'DOMAIN_KEY', 'the overlay wins for providers')
  assert.equal(merged.voices['ref-voice'].voice_id, 'b', 'the overlay wins for voices')
})
