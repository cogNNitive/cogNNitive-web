#!/usr/bin/env node

/**
 * nn-conntent/test/layer-inheritance.test.mjs
 *
 * Layer inheritance (issue #612 item 3): a Scene Kind or a Preset contributes the Layer
 * elements nested under it to every scene that uses it. The contributions fold in
 * cascade order (domain, series, kind, video, scene; each level's Presets before its own
 * node), and a layer the scene declares itself overrides an inherited one of the same
 * slug. Everything goes through the public loaders and `lowerKnowledgeModel`/`checkScript`,
 * exactly as `produce` drives them.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { SceneCompiler } from '../scripts/scene-compiler.mjs'
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs'
import { loadKnowledgeModel } from '../scripts/lib/knowledge-model.mjs'

const SERIES = `---
level: 3
scope: true
title: "Series"
---

# NN Series

## NN Series: S
slug:: s
language:: es

# NN Scene Kind

## NN Scene Kind: Talk
slug:: talk
narration:: on

### NN Layer: PiP
slug:: pip
type:: media
placement:: inset
timing:: scene
asset:: media/pip-kind.png

## NN Scene Kind: Plain
slug:: plain
narration:: on

# NN Preset

## NN Preset: Studio
slug:: studio
voice:: es-host

### NN Layer: Logo
slug:: logo
type:: media
placement:: inset
timing:: scene
asset:: media/logo.png

## NN Preset: Override PiP
slug:: override-pip

### NN Layer: PiP
slug:: pip
type:: media
placement:: inset
timing:: scene
asset:: media/pip-preset.png
`

function episode(scenes) {
  return `---
level: 3
title: "Ep"
---

# NN Video

## NN Video: Ep
slug:: ep
title:: Ep

# NN Scene

${scenes}`
}

function fixture(scenesMarkdown, seriesDoc = SERIES) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer-inheritance-'))
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8')
  fs.writeFileSync(
    path.join(root, 'video-defaults_NN.md'),
    '# NN Video Defaults\n\n## NN Video Defaults: D\nslug:: d\noutput_formats:: [1920x1080]\n',
    'utf8',
  )
  const series = path.join(root, 'series', 's')
  fs.mkdirSync(series, { recursive: true })
  fs.writeFileSync(path.join(series, 's_coNNtent_NN.md'), seriesDoc, 'utf8')
  const ep = path.join(series, 'assets', 'ep')
  fs.mkdirSync(ep, { recursive: true })
  const scriptPath = path.join(ep, 'ep_NN.md')
  fs.writeFileSync(scriptPath, episode(scenesMarkdown), 'utf8')
  const model = loadKnowledgeModel(scriptPath)
  const bags = withScriptPresets(loadCascadeBags(ep), model, scriptPath)
  return { root, ep, model, bags }
}

function lower(scenesMarkdown, seriesDoc) {
  const fx = fixture(scenesMarkdown, seriesDoc)
  try {
    const lowered = new SceneCompiler().lowerKnowledgeModel(fx.model, {
      bags: fx.bags,
      scriptDir: fx.ep,
    })
    const guard = new SceneCompiler().checkScript(fx.model, { bags: fx.bags, scriptDir: fx.ep })
    return { lowered, guard }
  } finally {
    fs.rmSync(fx.root, { recursive: true, force: true })
  }
}

const layersOf = (lowered, name) =>
  lowered.scenes
    .find((s) => s.name === name)
    .layers.map((l) => [l.slug, l.properties.layer_asset_source])

test('a Scene Kind contributes its nested Layer to every scene of that kind, and to no other', () => {
  const { lowered, guard } = lower(`## NN Scene: One
slug:: one
kind:: Talk

Uno.

## NN Scene: Two
slug:: two
kind:: Talk

Dos.

## NN Scene: Three
slug:: three
kind:: Plain

Tres.

## NN Scene: Four
slug:: four
kind:: Libre

Cuatro.
`)
  assert.equal(guard.ok, true, JSON.stringify(guard.errors))
  assert.deepEqual(layersOf(lowered, 'One'), [['pip', 'media/pip-kind.png']])
  assert.deepEqual(layersOf(lowered, 'Two'), [['pip', 'media/pip-kind.png']])
  assert.deepEqual(layersOf(lowered, 'Three'), [], 'a kind with no nested Layer contributes none')
  assert.deepEqual(layersOf(lowered, 'Four'), [], 'a Libre scene has no kind and inherits nothing')
})

test('a Preset contributes its nested Layer to every scene whose cascade lists it', () => {
  const { lowered, guard } = lower(`## NN Scene: One
slug:: one
kind:: Plain
presets:: [Studio]

Uno.

## NN Scene: Two
slug:: two
kind:: Plain

Dos.
`)
  assert.equal(guard.ok, true, JSON.stringify(guard.errors))
  assert.deepEqual(layersOf(lowered, 'One'), [['logo', 'media/logo.png']])
  assert.deepEqual(
    layersOf(lowered, 'Two'),
    [],
    'a scene that does not use the Preset inherits nothing',
  )
  assert.equal(
    lowered.scenes[0].properties.scene_voice,
    'es-host',
    'the Preset still supplies its parameters',
  )
})

test('a layer the scene declares overrides an inherited one of the same slug; the others stay, first', () => {
  const { lowered, guard } = lower(`## NN Scene: One
slug:: one
kind:: Talk
presets:: [Studio]

Uno.

### NN Layer: PiP
slug:: pip
type:: media
placement:: full
timing:: scene
asset:: media/pip-own.png

### NN Layer: Title
slug:: title
type:: text
style:: title
text:: Hola
`)
  assert.equal(guard.ok, true, JSON.stringify(guard.errors))
  const one = lowered.scenes[0]
  assert.deepEqual(
    one.layers.map((l) => l.slug),
    ['logo', 'pip', 'title'],
    'inherited layers come first in cascade order, the scene layers follow, and the overridden one appears once',
  )
  const pip = one.layers.find((l) => l.slug === 'pip')
  assert.equal(pip.properties.layer_asset_source, 'media/pip-own.png', 'the scene layer wins whole')
  assert.equal(
    pip.properties.layer_placement,
    undefined,
    'no inherited field leaks into the override (full is the default)',
  )
})

test('the fold is cascade order: a kind layer beats its kind level Presets, a scene Preset beats the kind', () => {
  const series = SERIES.replace(
    '## NN Scene Kind: Plain\nslug:: plain\n',
    '## NN Scene Kind: Plain\nslug:: plain\npresets:: [Override PiP]\n',
  )
  const kindWins = lower(
    `## NN Scene: One
slug:: one
kind:: Talk

Uno.
`,
    series.replace(
      '## NN Scene Kind: Talk\nslug:: talk\n',
      '## NN Scene Kind: Talk\nslug:: talk\npresets:: [Override PiP]\n',
    ),
  )
  assert.deepEqual(
    layersOf(kindWins.lowered, 'One'),
    [['pip', 'media/pip-kind.png']],
    'the kind node follows its own Presets',
  )
  const presetWins = lower(`## NN Scene: One
slug:: one
kind:: Talk
presets:: [Override PiP]

Uno.
`)
  assert.deepEqual(
    layersOf(presetWins.lowered, 'One'),
    [['pip', 'media/pip-preset.png']],
    'a scene Preset is nearer than the kind',
  )
})

test('a Preset declared in the episode keeps its nested Layer out of the scenes that do not use it', () => {
  const { lowered, guard } = lower(`## NN Scene: One
slug:: one
kind:: Plain

Uno.

## NN Scene: Two
slug:: two
kind:: Plain
presets:: [Local]

Dos.

# NN Preset

## NN Preset: Local
slug:: local

### NN Layer: Badge
slug:: badge
type:: text
style:: watermark
text:: Local
`)
  assert.equal(guard.ok, true, JSON.stringify(guard.errors))
  assert.deepEqual(
    layersOf(lowered, 'One'),
    [],
    'the Preset-owned Layer is never assigned to a scene by position',
  )
  assert.deepEqual(
    lowered.scenes.find((s) => s.name === 'Two').layers.map((l) => l.slug),
    ['badge'],
  )
})

test('an inherited Layer is validated before spend like a scene Layer', () => {
  const series = SERIES.replace('asset:: media/pip-kind.png\n', '')
  const { guard } = lower(
    `## NN Scene: One
slug:: one
kind:: Talk

Uno.
`,
    series,
  )
  const err = guard.errors.find((e) => e.code === 'missing-conditional-field')
  assert.ok(err, JSON.stringify(guard.errors))
  assert.match(err.message, /Layer "PiP" \(type:: media\) requires one of: asset, prompt/)
})

test('a scene without inheritance keeps its own layers in their declared order', () => {
  const { lowered, guard } = lower(`## NN Scene: One
slug:: one
kind:: Plain

Uno.

### NN Layer: A
slug:: a
type:: media
placement:: full
timing:: scene
asset:: media/a.png

### NN Layer: B
slug:: b
type:: text
style:: title
text:: B
`)
  assert.equal(guard.ok, true, JSON.stringify(guard.errors))
  assert.deepEqual(
    lowered.scenes[0].layers.map((l) => l.slug),
    ['a', 'b'],
  )
})
