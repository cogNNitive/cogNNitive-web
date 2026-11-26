/**
 * nn-conntent/test/avatar-model-agreement.test.mjs
 *
 * The Series declared an avatar model that the domain catalog priced, and the engine refused
 * it with three errors from three stages that each looked like a different problem:
 *
 *   1. "declares the resolution control but no resolutions"   (avatar-jobs)
 *   2. "not in allowedModels of video-guard.json"            (the guard allow list)
 *   3. "unpriced-model: ... has no price in the merged catalog" (the plan builder)
 *
 * Two of the three were engine defects: the guard allow list did not come from the catalog
 * that declared the model, and the estimator never loaded the domain overlay. The third was
 * the domain entry itself. These tests pin the agreement: the catalog authorizes, the plan
 * prices, and one up-front check names whatever is actually wrong.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { estimateScriptCost } from '../scripts/asset-cost-estimator.mjs'
import { assertAvatarModelRunnable } from '../scripts/lib/avatar-jobs.mjs'
import { loadMergedCatalog } from '../scripts/lib/catalog.mjs'
import { loadGuard } from '../scripts/lib/video-guard.mjs'

const AVATAR = 'acme/talker-avatar'

/** A complete avatar Model: the shape the engine can actually run. */
function overlayModel({
  resolutions = 'resolutions:: [720p, 480p]\n',
  allowed = 'allowed:: true\n',
} = {}) {
  return `---
level: 3
title: "Model Catalog"
---

# NN Model

## NN Model: acme-talker-avatar
slug:: acme-talker-avatar
provider:: acme
api_id:: ${AVATAR}
capability:: avatar
controls:: [resolution]
${resolutions}price:: 0.02
price_unit:: per_second
price_date:: 2026-11-02
${allowed}`
}

const DOMAIN_DEFAULTS = `---
level: 3
title: "Video Defaults"
---

# NN Video Defaults

## NN Video Defaults: Defaults
slug:: defaults
avatar_model:: ${AVATAR}
`

const AVATAR_LAYER = `
# NN Layer

## NN Layer: Host
slug:: host
type:: presenter
asset:: media/face.jpeg
`

const SCRIPT = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-1-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Avatar Demo"
---

# NN Video

## NN Video: Avatar Demo
slug:: avatar-demo

# NN Scene

## NN Scene: Opening
slug:: opening
voice:: demo-voice
voice_model:: minimax/speech-2.8-hd

The host speaks.
${AVATAR_LAYER}`

function setup(overlay) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-avatar-agree-'))
  fs.writeFileSync(path.join(dir, 'model-catalog_NN.md'), overlay, 'utf8')
  fs.writeFileSync(path.join(dir, 'video-defaults_NN.md'), DOMAIN_DEFAULTS, 'utf8')
  fs.mkdirSync(path.join(dir, 'media'))
  fs.writeFileSync(path.join(dir, 'media', 'face.jpeg'), Buffer.from('face'))
  const scriptPath = path.join(dir, 'script_NN.md')
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8')
  return { dir, scriptPath }
}

test('the catalog is the author of the allow list: an allowed overlay model needs no guard file', () => {
  const { dir, scriptPath } = setup(overlayModel())
  try {
    const guard = loadGuard(dir)
    assert.equal(guard.allowSource, 'catalog', 'no video-guard.json here, so the catalog decides')
    assert.ok(
      guard.config.allowedModels.includes(AVATAR),
      'the model the domain declares is allowed by the same catalog that prices it',
    )

    const estimate = estimateScriptCost(scriptPath)
    assert.equal(estimate.scenes[0].avatarModel, 'acme-talker-avatar')
    assert.ok(estimate.summary.totalAvatarCost > 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an incomplete avatar model is one error naming the missing field, not three', () => {
  const { dir, scriptPath } = setup(overlayModel({ resolutions: '' }))
  try {
    assert.throws(
      () => estimateScriptCost(scriptPath),
      (err) =>
        /^avatar-model-incomplete: "acme\/talker-avatar" is missing resolutions/.test(
          err.message,
        ) && !/video-guard\.json|unpriced-model/.test(err.message),
    )
    // The same verdict from the avatar stage itself, so the two never disagree.
    assert.throws(
      () =>
        assertAvatarModelRunnable(AVATAR, {
          catalog: loadMergedCatalog({ domainRoot: dir }),
          config: loadGuard(dir).config,
        }),
      /avatar-model-incomplete/,
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a blocked avatar model names the model and the one flag that unlocks it', () => {
  const { dir } = setup(overlayModel({ allowed: 'allowed:: false\n' }))
  try {
    const catalog = loadMergedCatalog({ domainRoot: dir })
    const config = loadGuard(dir).config
    assert.throws(
      () => assertAvatarModelRunnable(AVATAR, { catalog, config }),
      (err) =>
        /avatar-model-blocked: "acme\/talker-avatar"/.test(err.message) &&
        /--allow-model acme\/talker-avatar/.test(err.message),
    )
    // `--allow-model` is what the message promises: the same check passes with it.
    assert.doesNotThrow(() =>
      assertAvatarModelRunnable(AVATAR, { catalog, config, allowModels: [AVATAR] }),
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an unknown avatar model names the avatar models the catalog does declare', () => {
  const { dir } = setup(overlayModel())
  try {
    const catalog = loadMergedCatalog({ domainRoot: dir })
    assert.throws(
      () =>
        assertAvatarModelRunnable('acme/not-there', {
          catalog,
          config: { allowedModels: ['acme/not-there'] },
        }),
      (err) => /avatar-model-unknown/.test(err.message) && err.message.includes(AVATAR),
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
