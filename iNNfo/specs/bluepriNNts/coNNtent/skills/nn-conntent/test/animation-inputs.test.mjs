#!/usr/bin/env node

/**
 * nn-conntent/test/animation-inputs.test.mjs
 *
 * Data inputs for `animation` Layers (issue #612 item 4): `inputs:: [name=value, ...]` is
 * a validated Layer field. Its values reach the staged project as the mount host's
 * `data-variable-values`, are checked against the variables the project or the library
 * component declares before anything is spent, and feed the scene's review subject, so a
 * changed input reopens that scene and only that scene. `asset:: component:<name>` mounts
 * a library component (the `fit:: component:<name>` pattern) in place of an authored
 * project directory. A Layer without inputs keeps today's behavior.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { SceneCompiler } from '../scripts/scene-compiler.mjs'
import { buildProject } from '../scripts/scene-project.mjs'
import * as animationsLib from '../scripts/lib/animations.mjs'

const { resolveAnimations, AnimationInputError, AnimationProjectError } = animationsLib
import { scriptSubjectsFromScenes } from '../scripts/lib/review-subject.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nn-animation-inputs-'))

function model(scenes) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'Anim' },
    elements: {
      Video: [{ type: 'Video', name: 'Anim', slug: 'anim', fields: { title: 'Anim' } }],
      Scene: scenes.map(([name, slug]) => ({
        type: 'Scene',
        name,
        slug,
        description: 'hola mundo',
        fields: {},
      })),
      Layer: scenes.flatMap(([, slug, layers]) =>
        (layers || []).map(([name, fields]) => ({
          type: 'Layer',
          name,
          slug: `${slug}-${name.toLowerCase()}`,
          parentSlug: slug,
          fields,
        })),
      ),
    },
  }
}

const lower = (m, scriptDir) =>
  new SceneCompiler({ width: 1920, height: 1080 }).lowerKnowledgeModel(m, {
    scriptDir,
    grammar: { kinds: {}, chrome: {} },
  })
const hashes = (lowered) =>
  Object.fromEntries(scriptSubjectsFromScenes(lowered.scenes, 'es').map((s) => [s.scene, s.hash]))

/** An authored project root declaring the variables it accepts. */
function project(dir, id, variables) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html>\n<html data-composition-variables='${JSON.stringify(variables)}'>\n<body><div id="root" data-composition-id="${id}" data-duration="4"></div></body></html>\n`,
    'utf8',
  )
}

const RIG_VARIABLES = [
  { id: 'cues', type: 'string', label: 'Cues' },
  { id: 'gain', type: 'number', label: 'Gain', default: 1 },
  { id: 'loop', type: 'boolean', label: 'Loop', default: false },
  {
    id: 'mood',
    type: 'enum',
    label: 'Mood',
    default: 'calm',
    options: [
      { value: 'calm', label: 'Calm' },
      { value: 'loud', label: 'Loud' },
    ],
  },
]

const animScene = (inputs, asset = 'assets/rig') => [
  {
    id: 'scene_s',
    slug: 's',
    layers: [
      {
        type: 'animation',
        name: 'Rig',
        slug: 'rig',
        properties: { layer_asset_source: asset, ...(inputs ? { layer_inputs: inputs } : {}) },
      },
    ],
  },
]

// --- Lowering and the review subject -----------------------------------------------

test('inputs lower into the layer as a name -> value map; a layer without inputs carries none', () => {
  const lowered = lower(
    model([
      [
        'A',
        'a',
        [
          [
            'Rig',
            { type: 'animation', asset: 'assets/rig', inputs: ['cues=0.0 A, 0.4 O', 'gain=2'] },
          ],
        ],
      ],
      ['B', 'b', [['Rig', { type: 'animation', asset: 'assets/rig' }]]],
    ]),
  )
  assert.deepEqual(lowered.scenes[0].layers[0].properties.layer_inputs, {
    cues: '0.0 A, 0.4 O',
    gain: '2',
  })
  assert.equal(Object.hasOwn(lowered.scenes[1].layers[0].properties, 'layer_inputs'), false)
})

test('a file: input reads the file next to the script, so its content is the value', () => {
  const dir = tmp()
  try {
    fs.mkdirSync(path.join(dir, 'media'))
    fs.writeFileSync(path.join(dir, 'media', 'visemes.json'), '[{"t":0,"v":"A"}]\n', 'utf8')
    const m = model([
      [
        'A',
        'a',
        [
          [
            'Rig',
            { type: 'animation', asset: 'assets/rig', inputs: ['cues=file:media/visemes.json'] },
          ],
        ],
      ],
    ])
    assert.deepEqual(lower(m, dir).scenes[0].layers[0].properties.layer_inputs, {
      cues: '[{"t":0,"v":"A"}]\n',
    })
    const missing = model([
      [
        'A',
        'a',
        [
          [
            'Rig',
            { type: 'animation', asset: 'assets/rig', inputs: ['cues=file:media/none.json'] },
          ],
        ],
      ],
    ])
    assert.throws(
      () => lower(missing, dir),
      (err) => err.code === 'animation-input-file' && /media[\\/]none\.json/.test(err.message),
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a changed input changes that scene review hash and no other', () => {
  const build = (cues) =>
    hashes(
      lower(
        model([
          [
            'A',
            'a',
            [['Rig', { type: 'animation', asset: 'assets/rig', inputs: [`cues=${cues}`] }]],
          ],
          ['B', 'b', [['Rig', { type: 'animation', asset: 'assets/rig' }]]],
        ]),
      ),
    )
  const before = build('0.0 A')
  const after = build('0.0 O')
  assert.notEqual(after.a, before.a, 'the scene whose input changed is stale')
  assert.equal(after.b, before.b, 'the other scene keeps its approval')
})

test('a layer without inputs keeps its pre-inputs review hash', () => {
  // Pinned against the engine before inputs existed: the field must not move any hash it is absent from.
  const h = hashes(
    lower(model([['B', 'b', [['Rig', { type: 'animation', asset: 'assets/rig' }]]]])),
  )
  assert.equal(h.b, 'ffd08a12b943cd553299e28a292174ac943a21fb84095b8bc9b59c4eeba3d23b')
})

// --- The guard --------------------------------------------------------------------

test('inputs on a layer that is not an animation are rejected before spend', () => {
  const guard = new SceneCompiler({ width: 1920, height: 1080 }).checkScript(
    model([
      [
        'A',
        'a',
        [
          [
            'Pic',
            { type: 'media', placement: 'full', timing: 'scene', asset: 'a.png', inputs: ['x=1'] },
          ],
        ],
      ],
    ]),
  )
  const err = guard.errors.find((e) => e.code === 'inputs-not-animation')
  assert.ok(err, JSON.stringify(guard.errors))
  assert.match(err.message, /Layer "Pic" \(type:: media\) declares inputs::/)
})

test('a malformed inputs entry is rejected before spend', () => {
  const guard = new SceneCompiler({ width: 1920, height: 1080 }).checkScript(
    model([['A', 'a', [['Rig', { type: 'animation', asset: 'assets/rig', inputs: ['novalue'] }]]]]),
  )
  const err = guard.errors.find((e) => e.code === 'inputs-invalid')
  assert.ok(err, JSON.stringify(guard.errors))
  assert.match(err.message, /"novalue"/)
})

// --- Declared inputs, checked against the project -----------------------------------

test('inputs are checked against the declared variables and typed for the mount', () => {
  const dir = tmp()
  try {
    project(path.join(dir, 'assets', 'rig'), 'rig', RIG_VARIABLES)
    const ok = resolveAnimations({
      scenes: animScene({ cues: '0.0 A', gain: '2.5', loop: 'true', mood: 'loud' }),
      scriptDir: dir,
    })
    assert.deepEqual(ok.scene_s[0].values, { cues: '0.0 A', gain: 2.5, loop: true, mood: 'loud' })
    const bad = [
      [
        { cues: 'x', speed: '2' },
        /input "speed" is not declared .*declared: cues, gain, loop, mood/,
      ],
      [{ gain: '2' }, /required input "cues"/],
      [{ cues: 'x', gain: 'fast' }, /input "gain" must be a number/],
      [{ cues: 'x', loop: 'yes' }, /input "loop" must be true or false/],
      [{ cues: 'x', mood: 'sad' }, /input "mood" must be one of calm, loud/],
    ]
    for (const [inputs, message] of bad) {
      assert.throws(
        () => resolveAnimations({ scenes: animScene(inputs), scriptDir: dir }),
        (err) => err instanceof AnimationInputError && message.test(err.message),
        JSON.stringify(inputs),
      )
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('an authored project layer without inputs is not checked against its variables (previous behavior)', () => {
  const dir = tmp()
  try {
    project(path.join(dir, 'assets', 'rig'), 'rig', RIG_VARIABLES)
    const out = resolveAnimations({ scenes: animScene(null), scriptDir: dir })
    assert.equal(out.scene_s[0].id, 'rig')
    assert.equal(Object.hasOwn(out.scene_s[0], 'values'), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('asset:: component:<name> mounts a library component found by the library walk', () => {
  const root = tmp()
  try {
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8')
    const ep = path.join(root, 'series', 's', 'episodes', 'ep')
    fs.mkdirSync(ep, { recursive: true })
    const comp = path.join(root, 'library', 'components', 'rig')
    project(comp, 'rig', RIG_VARIABLES)
    const out = resolveAnimations({
      scenes: animScene({ cues: '0.0 A' }, 'component:rig'),
      scriptDir: ep,
      workspaceRoot: root,
    })
    assert.equal(out.scene_s[0].id, 'rig')
    assert.equal(out.scene_s[0].sourceDir, comp)
    assert.deepEqual(
      out.scene_s[0].values,
      { cues: '0.0 A', gain: 1, loop: false, mood: 'calm' },
      'declared defaults fill the unset inputs',
    )
    assert.throws(
      () =>
        resolveAnimations({
          scenes: animScene(null, 'component:rig'),
          scriptDir: ep,
          workspaceRoot: root,
        }),
      (err) => err instanceof AnimationInputError && /required input "cues"/.test(err.message),
      'a component is always checked: its required inputs must be given',
    )
    assert.throws(
      () =>
        resolveAnimations({
          scenes: animScene({ cues: 'x' }, 'component:nope'),
          scriptDir: ep,
          workspaceRoot: root,
        }),
      (err) =>
        err instanceof AnimationProjectError &&
        /component "nope" not found; searched:/.test(err.message),
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

// --- The values reach the staged project ---------------------------------------------

test('compile carries the values to the scene track and the mount host passes them to the project', () => {
  const compiler = new SceneCompiler({ fps: 30, width: 1080, height: 1080 })
  const values = { cues: "0.0 A, it's <b>", gain: 2 }
  const manifest = compiler.compile(
    {
      title: 'Anim',
      scenes: [
        {
          id: 'scene_a',
          slug: 'a',
          name: 'A',
          narration: 'uno dos tres',
          layers: [],
          properties: {},
        },
      ],
    },
    {
      width: 1080,
      height: 1080,
      animations: { scene_a: [{ id: 'rig', durationSeconds: 4, sourceDir: '/x', values }] },
    },
  )
  assert.deepEqual(manifest.tracks.scenes[0].animations[0].values, values)
  const { indexHtml } = buildProject(manifest)
  // A `>` inside the quoted attribute is legal HTML, so the host ends at its `</div>`.
  const host = indexHtml.match(/<div id="animation-a-rig[^"]*".*?><\/div>/)[0]
  const raw = host.match(/data-variable-values='([^']*)'/)[1]
  assert.deepEqual(
    JSON.parse(raw.replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&amp;/g, '&')),
    values,
  )
})

test('a mount without values carries no data-variable-values (previous behavior)', () => {
  const compiler = new SceneCompiler({ fps: 30, width: 1080, height: 1080 })
  const manifest = compiler.compile(
    {
      title: 'Anim',
      scenes: [
        {
          id: 'scene_a',
          slug: 'a',
          name: 'A',
          narration: 'uno dos tres',
          layers: [],
          properties: {},
        },
      ],
    },
    {
      width: 1080,
      height: 1080,
      animations: { scene_a: [{ id: 'rig', durationSeconds: 4, sourceDir: '/x' }] },
    },
  )
  assert.equal(Object.hasOwn(manifest.tracks.scenes[0].animations[0], 'values'), false)
  const host = buildProject(manifest).indexHtml.match(/<div id="animation-a-rig[^"]*"[^>]*>/)[0]
  assert.doesNotMatch(host, /data-variable-values/)
})
