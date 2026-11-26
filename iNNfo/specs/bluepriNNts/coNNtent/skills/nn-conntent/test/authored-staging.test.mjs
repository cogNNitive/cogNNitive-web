/**
 * nn-conntent/test/authored-staging.test.mjs
 *
 * An authored animation project is staged into `<project>/authored/<id>/` on every render
 * (`stageAuthoredProjects` -> `copyDir`), never cached. That is only useful if the staged
 * tree is provably the source: these tests pin the two halves of the invariant.
 *
 * 1. Editing the source between two builds reaches the staged copy (the copy is not a
 *    one-time snapshot).
 * 2. When the staged copy CANNOT be the source (the source directory no longer resolves,
 *    or a staged file was left behind by an earlier compile), the build stops with a named
 *    `authored-stale` refusal instead of handing the old bytes to `hyperframes render`.
 *    Before the fix, case 2 rendered whatever was on disk: the video, and the QA that
 *    follows it, described code that no longer existed.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  AuthoredStaleError,
  assertAuthoredStaged,
  buildHyperframesProject,
  stageAuthoredProjects,
  tryHyperframesRender,
} from '../scripts/hyperframes-render.mjs'

const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix))

function writeProject(dir, body) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), body, 'utf8')
}

function manifestFor(sourceDir) {
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    totalDurationInFrames: 90,
    totalDurationInSeconds: 3,
    compositionId: 'demo',
    tracks: {
      scenes: [
        {
          id: 'scene_one',
          slug: 'one',
          fromFrame: 0,
          durationInFrames: 90,
          props: { layers: [] },
          animations: [{ id: 'rig', durationInFrames: 60, sourceDir }],
        },
      ],
    },
    metadata: {},
  }
}

/** A staged build needs the vendored GSAP copy, never a network fetch. */
function gsapFile(dir) {
  const file = path.join(dir, 'gsap.min.js')
  fs.writeFileSync(file, '/* gsap */', 'utf8')
  return file
}

test('an edited authored project reaches the staged copy on the next build', () => {
  const root = tmp('nn-authored-edit-')
  const source = path.join(root, 'animations', 'rig')
  const projectDir = path.join(root, 'hyperframes', '1920x1080')
  const gsap = gsapFile(root)
  try {
    writeProject(
      source,
      '<template><div id="stage" data-composition-id="rig" data-duration="4">v1</div></template>',
    )
    buildHyperframesProject(manifestFor(source), projectDir, { gsapPath: gsap })
    const staged = path.join(projectDir, 'authored', 'rig', 'index.html')
    assert.match(fs.readFileSync(staged, 'utf8'), /v1/)
    assert.deepEqual(assertAuthoredStaged(manifestFor(source), projectDir), [])

    // The edit the production run made between two `produce` invocations.
    writeProject(
      source,
      '<template><div id="stage" data-composition-id="rig" data-duration="4">v2-edited</div></template>',
    )
    buildHyperframesProject(manifestFor(source), projectDir, { gsapPath: gsap })
    assert.match(fs.readFileSync(staged, 'utf8'), /v2-edited/)
    assert.deepEqual(assertAuthoredStaged(manifestFor(source), projectDir), [])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a declared authored project whose source disappeared is refused, not rendered stale', async () => {
  const root = tmp('nn-authored-gone-')
  const source = path.join(root, 'animations', 'rig')
  const projectDir = path.join(root, 'hyperframes', '1920x1080')
  const gsap = gsapFile(root)
  try {
    writeProject(
      source,
      '<template><div id="stage" data-composition-id="rig" data-duration="4">old</div></template>',
    )
    buildHyperframesProject(manifestFor(source), projectDir, { gsapPath: gsap })

    // The source no longer resolves: staging skips it, and the previous copy is still there.
    fs.rmSync(source, { recursive: true, force: true })

    const problems = assertAuthoredStaged(manifestFor(source), projectDir)
    assert.equal(problems.length, 1)
    assert.match(
      problems[0],
      /^"rig": declared by the manifest but its source directory is missing/,
    )

    assert.throws(
      () =>
        buildHyperframesProject(manifestFor(source), projectDir, { gsapPath: gsap, cliPath: 'x' }),
      (err) => err instanceof AuthoredStaleError && /authored-stale/.test(err.message),
    )

    let rendered = 0
    const result = await tryHyperframesRender(
      {
        manifest: manifestFor(source),
        outputPath: path.join(root, 'out.mp4'),
        projectDir,
        gsapPath: gsap,
      },
      {
        run: () => {
          rendered += 1
          return { status: 0, stdout: '', stderr: '' }
        },
      },
    )
    assert.equal(rendered, 0, 'the CLI is never asked to render a project that is not the source')
    assert.equal(result.rendered, false)
    assert.match(result.reason, /^emit-failed: authored-stale:/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a staged file left by an earlier compile is refused instead of rendered', () => {
  const root = tmp('nn-authored-drift-')
  const source = path.join(root, 'animations', 'rig')
  const projectDir = path.join(root, 'hyperframes', '1920x1080')
  try {
    writeProject(
      source,
      '<template><div id="stage" data-composition-id="rig" data-duration="4">v2</div></template>',
    )
    stageAuthoredProjects(manifestFor(source), projectDir)
    const staged = path.join(projectDir, 'authored', 'rig', 'index.html')
    fs.writeFileSync(
      staged,
      '<template><div id="stage" data-composition-id="rig" data-duration="4">v1</div></template>',
      'utf8',
    )

    const problems = assertAuthoredStaged(manifestFor(source), projectDir)
    assert.equal(problems.length, 1)
    assert.match(problems[0], /"rig\/index\.html": the staged copy is not the source/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
