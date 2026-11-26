/**
 * nn-conntent/test/animation-mount-contract.test.mjs
 *
 * An authored project is mounted as a sub-composition, so the rules scoped to `#root` are
 * dropped in that mount. A project written as a standalone document that sizes `#root` in
 * pixels renders displaced and clipped, and the first diagnostic used to arrive after a full
 * render, from the QA layout check (`text_occluded` / `content_overlap`).
 *
 * `animationMountProblems` states the contract, and `resolveAnimations` refuses the shape
 * before anything is spent. The working shape is the documented one: a `<template>` wrapping
 * style, markup and scripts, with an explicit absolutely positioned stage inside it.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  AnimationProjectError,
  animationMountProblems,
  resolveAnimations,
} from '../scripts/lib/animations.mjs'

const STANDALONE = `<!doctype html><html><head><style>
  #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
  .title { position: absolute; left: 120px; top: 80px; }
</style></head><body>
  <div id="root" data-composition-id="sistema-autoriza" data-width="1920" data-height="1080" data-duration="6">
    <div class="title">Sistema autoriza</div>
  </div>
</body></html>`

const TEMPLATED = `<template>
  <style>
    .title { position: absolute; left: 120px; top: 80px; }
  </style>
  <div class="stage" style="position:absolute;left:0;top:0;width:1920px;height:1080px">
    <div id="root" data-composition-id="sistema-autoriza" data-width="1920" data-height="1080" data-duration="6">
      <div class="title">Sistema autoriza</div>
    </div>
  </div>
</template>`

test('a standalone document that sizes #root is a mount problem with the recipe in the message', () => {
  const problems = animationMountProblems(STANDALONE)
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no <template> wrapper and #root is sized in pixels/)
  assert.match(problems[0], /class="stage"/)
})

test('the templated stage shape is accepted, and so is a component-shaped project', () => {
  assert.deepEqual(animationMountProblems(TEMPLATED), [])
  // A component reads its canvas from --safe-* and sizes nothing: allowed.
  assert.deepEqual(
    animationMountProblems(
      '<div id="root" data-composition-id="x" data-duration="3"><div id="root-text"></div></div>',
    ),
    [],
  )
})

test('resolveAnimations refuses the standalone shape before anything is spent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-mount-'))
  try {
    const projectDir = path.join(dir, 'animations', 'sistema-autoriza')
    fs.mkdirSync(projectDir, { recursive: true })
    fs.writeFileSync(path.join(projectDir, 'index.html'), STANDALONE, 'utf8')
    const scenes = [
      {
        id: 'scene_a',
        layers: [
          {
            slug: 'rig',
            name: 'Rig',
            type: 'animation',
            properties: { layer_asset_source: 'animations/sistema-autoriza' },
          },
        ],
      },
    ]
    assert.throws(
      () => resolveAnimations({ scenes, scriptDir: dir }),
      (err) =>
        err instanceof AnimationProjectError &&
        /cannot be mounted/.test(err.message) &&
        /<template>/.test(err.message),
    )

    fs.writeFileSync(path.join(projectDir, 'index.html'), TEMPLATED, 'utf8')
    const animations = resolveAnimations({ scenes, scriptDir: dir })
    assert.equal(animations.scene_a[0].id, 'sistema-autoriza')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
