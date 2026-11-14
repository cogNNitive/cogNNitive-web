#!/usr/bin/env node

/**
 * nn-conntent/test/user-journeys-u1-u7.test.mjs
 *
 * End-to-end simulation of the seven user journeys (Task 5b.4):
 * - U1: setup domain
 * - U2: define character / frame
 * - U3: create series
 * - U4: plan
 * - U5: produce up to gates, approve in console (fixture changeset), deliver
 * - U6: edit & reopen
 * - U7: legacy layout rejection & autopilot with review_gates: []
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { detectState, PROCEDURE_NAMES } from '../scripts/lib/detect-state.mjs'
import { assertLayout, LAYOUT_LEGACY } from '../scripts/lib/layout.mjs'
import { EXIT_DONE, EXIT_REVIEW, produce, ProduceStop } from '../scripts/produce.mjs'
import { estimateScriptCost } from '../scripts/asset-cost-estimator.mjs'
import { readEpisode } from '../scripts/lib/episode.mjs'
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs'
import { lowerEpisode, scriptSubjectsFromScenes } from '../scripts/lib/review-subject.mjs'
import { previewSubjectsFromScenes } from '../scripts/lib/preview-subject.mjs'
import { CacheManager } from '../scripts/cache-manager.mjs'
import { normalizeModelId } from '../scripts/lib/video-guard.mjs'
import { loadGuardWithVoices } from '../scripts/lib/guard-config.mjs'
import { resolve as cascadeResolve } from '../scripts/lib/cascade.mjs'
import { computePlanHash } from '../scripts/lib/plan.mjs'

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k]
}

// `produce` stops at review gates with exit 10, which regenerates the console and opens it in
// a browser. This suite runs the real writer, so it must never open a tab on the desktop of
// whoever runs it, with or without `scripts/verify.js`.
process.env.INNFO_CONSOLE_NO_OPEN = '1'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLUEPRINT = path.resolve(SKILL, '..', '..')

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

const MP4_BYTES = Buffer.from(
  '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',
  'base64',
)

const MP3_BYTES = Buffer.from(
  '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',
  'base64',
)

function createFakeProvider() {
  const log = []
  const tasks = new Map()
  let pollId = 0

  const fetch = async (url, init = {}) => {
    const u = String(url)
    const method = init.method || 'GET'

    if (method === 'POST') {
      const body = init.body ? JSON.parse(init.body) : {}
      const id = `job-${++pollId}`
      if (u.includes('audio') || body.voice_id || body.text) {
        tasks.set(id, 'tts')
        log.push({ kind: 'tts', url: u, body, time: Date.now() })
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { id } }),
        }
      }
      if (u.includes('avatar') || u.includes('infinitetalk') || body.audio_url || body.image_url) {
        tasks.set(id, 'avatar')
        log.push({ kind: 'avatar', url: u, body, time: Date.now() })
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { id } }),
        }
      }
      tasks.set(id, 'generic')
      log.push({ kind: 'generic-post', url: u, body, time: Date.now() })
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id } }),
      }
    }

    if (u.includes('/predictions/') || u.includes('/result') || u.includes('/poll/')) {
      const match = u.match(/predictions\/([^/]+)/)
      const taskId = match ? match[1] : `task-${pollId}`
      const kind = tasks.get(taskId) || 'tts'
      const outputName = kind === 'avatar' ? `${taskId}.mp4` : `${taskId}.mp3`
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { status: 'completed', outputs: [`https://cdn.fake/${outputName}`] },
        }),
      }
    }

    if (u.endsWith('.mp3') || u.includes('mp3')) {
      const tag = u.split('/').pop() || 'tts'
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.concat([MP3_BYTES, Buffer.from(tag)]).buffer,
      }
    }

    if (u.endsWith('.mp4') || u.includes('mp4')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array(MP4_BYTES).buffer,
      }
    }

    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  }

  return { fetch, log }
}

function fakeRender() {
  const calls = []
  const render = async (opts) => {
    calls.push(opts)
    const dir = path.dirname(opts.scriptPath)
    const slug = path.basename(opts.scriptPath).replace(/_coNNtent_NN\.md$/, '')
    const master = path.join(dir, `${slug}_1920x1920.mp4`)
    fs.writeFileSync(master, MP4_BYTES)
    const hyperframesDir = path.join(dir, 'hyperframes')
    fs.mkdirSync(hyperframesDir, { recursive: true })
    const manifest = {
      fps: 30,
      totalDurationInFrames: 180,
      tracks: {
        scenes: [
          {
            id: 'scene_one',
            slug: 'one',
            fromFrame: 0,
            props: { title: 'Opening Scene', layers: [] },
          },
          {
            id: 'scene_two',
            slug: 'two',
            fromFrame: 90,
            props: { title: 'Closing Scene', layers: [] },
          },
        ],
        overlays: [],
      },
      metadata: { scriptSource: opts.scriptPath, videoSlug: slug, hyperframesDir },
    }
    fs.writeFileSync(path.join(hyperframesDir, 'manifest.json'), JSON.stringify(manifest))
    fs.writeFileSync(
      path.join(hyperframesDir, 'index.html'),
      '<!doctype html><html><body></body></html>',
    )
    return { outputVideoPath: master, renderTimeMs: 1, linkMode: 'link', spentUsd: 0.1 }
  }
  return { render, calls }
}

function thumbStubs() {
  return {
    thumbnailBase: 'first-frame.png',
    renderThumbnails: async ({ episodeDir, slug }) => {
      const p1 = path.join(episodeDir, `${slug}_thumbnail_2560x1440.png`)
      const p2 = path.join(episodeDir, `${slug}_thumbnail_1080x1920.png`)
      fs.writeFileSync(p1, PNG_1x1)
      fs.writeFileSync(p2, PNG_1x1)
      return [{ path: p1 }, { path: p2 }]
    },
    formats: async ({ outDir, formats }) => {
      fs.mkdirSync(outDir, { recursive: true })
      return {
        variants: (formats || []).map((f) => {
          const p = path.join(outDir, `ep_${f.name}.mp4`)
          fs.writeFileSync(p, MP4_BYTES)
          return { path: p, outputPath: p }
        }),
      }
    },
  }
}

function getScriptHashes(scriptPath) {
  const model = readEpisode(scriptPath).model
  const bags = withScriptPresets(loadCascadeBags(path.dirname(scriptPath)), model, scriptPath)
  const parsed = lowerEpisode({ model, bags, scriptDir: path.dirname(scriptPath) })
  const subjects = scriptSubjectsFromScenes(parsed.scenes || [], 'es', {}, {})
  return Object.fromEntries(subjects.map((s) => [s.scene, s.hash]))
}

function getPreviewHashes(scriptPath, cacheDir) {
  const model = readEpisode(scriptPath).model
  const bags = withScriptPresets(loadCascadeBags(path.dirname(scriptPath)), model, scriptPath)
  const parsed = lowerEpisode({ model, bags, scriptDir: path.dirname(scriptPath) })
  const scriptEntries = scriptSubjectsFromScenes(parsed.scenes || [], 'es', {}, {})
  const scriptByScene = Object.fromEntries(scriptEntries.map((e) => [e.scene, e]))
  const cacheManager = new CacheManager({ baseDir: cacheDir, readOnly: true })
  const models = {
    image: normalizeModelId(cascadeResolve('image_model', bags).value),
    tts: normalizeModelId(cascadeResolve('voice_model', bags).value),
    avatar: normalizeModelId(cascadeResolve('avatar_model', bags).value),
  }
  const config = loadGuardWithVoices(path.dirname(scriptPath)).config
  const previewEntries = previewSubjectsFromScenes(parsed.scenes || [], scriptByScene, {
    cacheManager,
    config,
    models,
    bags,
  })
  return Object.fromEntries(previewEntries.map((p) => [p.scene, p.hash]))
}

function writeApprovalChangeset(root, filename, changes) {
  const changeBlocks = changes
    .map(
      (c, i) => `## NN Change: c-0${i + 1}
op:: review_gate
target:: ${c.target}
gate:: ${c.gate}
verdict:: approved
reviewed_hash:: ${c.hash}
${c.planHash ? `plan_hash:: ${c.planHash}\n` : ''}`,
    )
    .join('\n')

  const content = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: applied
title: "Verdicts"
author_kind: human
origin: console
reviewer: TestReviewer
---

# NN index

* [[Change]]

# NN Change

${changeBlocks}
`
  fs.writeFileSync(path.join(root, 'changes', filename), content, 'utf8')
}

function buildEpisodeContent({
  status = 'draft',
  budget = '10.0',
  review = '[script, preview]',
  scene2Narration = 'Scene two narration explaining details',
} = {}) {
  return `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-19-0"
title: "User Journey Episode 1"
---

# NN Video

## NN Video: Episode 1
slug:: ep1
title:: Episode 1
status:: ${status}
budget:: ${budget}
review_gates:: ${review}
output_formats:: [1920x1920]

# NN Scene

## NN Scene: Scene One
slug:: one
kind:: Libre

Hello and welcome to user journey demonstration scene one.

# NN Layer

## NN Layer: Presenter One
type:: avatar
asset:: media/face1.png

# NN Scene

## NN Scene: Scene Two
slug:: two
kind:: Libre

${scene2Narration}

# NN Layer

## NN Layer: Presenter Two
type:: avatar
asset:: media/face2.png
`
}

test('User Journeys U1-U7 end to end simulation', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-u1-u7-journeys-'))
  const cacheDir = path.join(root, 'cache')
  fs.mkdirSync(cacheDir, { recursive: true })

  try {
    // -------------------------------------------------------------------------
    // U1: Setup domain
    // -------------------------------------------------------------------------
    await t.test('U1: setup domain on clean workspace', () => {
      // Empty directory -> asks to set up domain
      const emptyState = detectState(root)
      assert.equal(
        emptyState.procedure,
        PROCEDURE_NAMES.setupDomain,
        'empty workspace proposes setup domain',
      )

      // Setup domain artifacts
      fs.writeFileSync(
        path.join(root, 'domaiNN_NN.md'),
        '---\nname: "coNNtent Studio"\nworkspace_id: "conntent-studio"\n---\n\n# NN DomaiNN\n',
        'utf8',
      )

      // Copy blueprint spec and defaults
      fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-19-0'), {
        recursive: true,
      })
      fs.copyFileSync(
        path.join(BLUEPRINT, 'spec_NN.md'),
        path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'spec_NN.md'),
      )
      fs.copyFileSync(
        path.join(BLUEPRINT, 'spec_NN.md'),
        path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-19-0', 'spec_NN.md'),
      )
      fs.copyFileSync(
        path.join(BLUEPRINT, 'defaults', 'video-defaults_NN.md'),
        path.join(root, 'video-defaults_NN.md'),
      )
      fs.mkdirSync(path.join(root, 'changes'), { recursive: true })
      fs.mkdirSync(path.join(root, 'library'), { recursive: true })

      // Layout is clean
      const findings = assertLayout(root)
      assert.equal(findings.length, 0, 'layout contract holds with 0 findings after setup')

      // Next procedure is Define a Frame (skippable)
      const nextState = detectState(root)
      assert.equal(nextState.procedure, PROCEDURE_NAMES.defineFrame)
      assert.equal(nextState.skippable, true)
    })

    // -------------------------------------------------------------------------
    // U2: Define frame & character
    // -------------------------------------------------------------------------
    await t.test('U2: define frame and character', () => {
      // Define a Frame
      const frameDir = path.join(root, 'library', 'frames', 'neutral')
      fs.mkdirSync(frameDir, { recursive: true })
      fs.writeFileSync(
        path.join(frameDir, 'FRAME.md'),
        `---
name: neutral
colors:
  primary: "#111827"
  secondary: "#4F46E5"
  background: "#FFFFFF"
  surface: "#F3F4F6"
  text: "#111827"
  accent: "#E11D48"
typography:
  font_family: "Inter"
  heading_weight: "700"
  body_weight: "400"
spacing:
  margin: 40
  padding: 20
---

# Neutral Frame

Normative frame tokens for user journeys.
`,
        'utf8',
      )
      fs.writeFileSync(
        path.join(frameDir, 'caption-skin.html'),
        '<div class="caption">{{text}}</div>',
        'utf8',
      )

      // After frame, next procedure is Define a Character (skippable)
      const afterFrame = detectState(root)
      assert.equal(afterFrame.procedure, PROCEDURE_NAMES.defineCharacter)
      assert.equal(afterFrame.skippable, true)

      // Define a Character
      const charDir = path.join(root, 'library', 'characters', 'lucas')
      const charAvatars = path.join(charDir, 'avatars')
      fs.mkdirSync(charAvatars, { recursive: true })
      fs.writeFileSync(
        path.join(charDir, 'CHARACTER.md'),
        `---
name: lucas
voices:
  es: lucas-es
  en: lucas-en
default_pose: neutral
avatar_model: heygen
avatar_resolution: 1080p
---

# NN Character: Lucas

Professional presenter persona.
`,
        'utf8',
      )
      fs.writeFileSync(path.join(charAvatars, 'neutral.png'), PNG_1x1)

      // Layout remains clean
      assert.equal(assertLayout(root).length, 0)

      // Next procedure is Create a Series
      const afterChar = detectState(root)
      assert.equal(afterChar.procedure, PROCEDURE_NAMES.createSeries)
    })

    // -------------------------------------------------------------------------
    // U3: Create series
    // -------------------------------------------------------------------------
    const seriesSlug = 'show'
    const seriesDir = path.join(root, 'series', seriesSlug)
    await t.test('U3: create series', () => {
      fs.mkdirSync(seriesDir, { recursive: true })
      fs.writeFileSync(
        path.join(seriesDir, `${seriesSlug}_coNNtent_NN.md`),
        `---
level: 3
scope: true
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-19-0"
title: "The Main Show"
---

# NN Series

## NN Series: The Main Show
slug:: ${seriesSlug}
language:: es
character:: lucas
`,
        'utf8',
      )

      assert.equal(assertLayout(root).length, 0)

      // Once a series exists without episodes, next procedure is Plan an Episode
      const afterSeries = detectState(root)
      assert.equal(afterSeries.procedure, PROCEDURE_NAMES.planEpisode)
      assert.equal(afterSeries.series, seriesSlug)
    })

    // -------------------------------------------------------------------------
    // U4: Plan episode
    // -------------------------------------------------------------------------
    const episodeSlug = 'ep1'
    const episodeDir = path.join(seriesDir, 'episodes', episodeSlug)
    const scriptPath = path.join(episodeDir, `${episodeSlug}_coNNtent_NN.md`)
    await t.test('U4: plan episode and verify hash and cost', async () => {
      fs.mkdirSync(path.join(episodeDir, 'media'), { recursive: true })
      fs.writeFileSync(path.join(episodeDir, 'media', 'face1.png'), PNG_1x1)
      fs.writeFileSync(
        path.join(episodeDir, 'media', 'face2.png'),
        Buffer.concat([PNG_1x1, Buffer.from('scene2')]),
      )

      const docContent = buildEpisodeContent()
      fs.writeFileSync(scriptPath, docContent, 'utf8')

      // Verify plan hash computation
      const planHash = computePlanHash(docContent)
      assert.match(planHash, /^[0-9a-f]{64}$/, 'computed valid sha256 plan hash')

      // Verify script cost estimation
      const estimate = await estimateScriptCost(scriptPath)
      assert.ok(estimate.summary.grandTotalCost > 0, 'script cost estimated')
      assert.match(estimate.planHash, /^[0-9a-f]{64}$/, 'estimate carries planHash')

      // State advances to Produce an Episode
      const afterPlan = detectState(root)
      assert.equal(afterPlan.procedure, PROCEDURE_NAMES.produceEpisode)
      assert.equal(afterPlan.episode, episodeSlug)
    })

    // -------------------------------------------------------------------------
    // U5: Produce up to gates, approve via console changesets, deliver v1
    // -------------------------------------------------------------------------
    const fakeProv = createFakeProvider()
    const renderer = fakeRender()
    const synthOpts = {
      env: { WAVESPEED_API_KEY: 'test-key' },
      fetch: fakeProv.fetch,
      sleep: async () => {},
    }
    const scenePlanHashesV1 = {
      one: 'slice-hash-scene-one',
      two: 'slice-hash-scene-two-v1',
    }
    const commonDeps = {
      ...thumbStubs(),
      synthesizerOptions: synthOpts,
      synthesizeAvatarOptions: { measureDuration: async () => 3.0 },
      render: renderer.render,
      planHashes: scenePlanHashesV1,
      cacheDir,
      qa: {
        qaMaster: async () => ({ ok: true, checks: [] }),
        qaOutputSet: async () => ({ ok: true, checks: [] }),
      },
      log: () => {},
    }

    await t.test('U5: produce flow, gate approvals, and deliver v1', async () => {
      // Step 1: initial run stops at script review gate (exit 10)
      let stop = null
      try {
        await produce({ episodePath: scriptPath, synthesizerOptions: synthOpts, deps: commonDeps })
      } catch (err) {
        if (err instanceof ProduceStop) stop = err
        else throw err
      }
      assert.ok(stop, 'produce stopped at gate')
      assert.equal(stop.exitCode, EXIT_REVIEW)
      assert.equal(stop.code, 'review-required')
      assert.equal(
        fakeProv.log.filter((l) => l.kind === 'avatar').length,
        0,
        'zero avatar calls before script gate',
      )

      // Step 2: approve script gate in console fixture changeset
      const scriptHashes = getScriptHashes(scriptPath)
      writeApprovalChangeset(root, 'ws_rev_01_script_changes_NN.md', [
        { target: `${seriesSlug}/${episodeSlug}@one`, gate: 'script', hash: scriptHashes.one },
        { target: `${seriesSlug}/${episodeSlug}@two`, gate: 'script', hash: scriptHashes.two },
      ])

      // Step 3: second produce run stops at preview gate (exit 10)
      stop = null
      try {
        await produce({ episodePath: scriptPath, synthesizerOptions: synthOpts, deps: commonDeps })
      } catch (err) {
        if (err instanceof ProduceStop) stop = err
        else throw err
      }
      assert.ok(stop, 'produce stopped at preview gate')
      assert.equal(stop.exitCode, EXIT_REVIEW)
      assert.equal(stop.code, 'preview-required')
      // ZERO avatar calls before preview gate approval
      assert.equal(
        fakeProv.log.filter((l) => l.kind === 'avatar').length,
        0,
        'ZERO avatar calls executed before preview approval',
      )
      assert.ok(
        fakeProv.log.filter((l) => l.kind === 'tts').length > 0,
        'TTS voiceover synthesized for preview',
      )

      // Step 4: approve preview gate in console fixture changeset
      const previewHashes = getPreviewHashes(scriptPath, cacheDir)
      writeApprovalChangeset(root, 'ws_rev_02_preview_changes_NN.md', [
        {
          target: `${seriesSlug}/${episodeSlug}@one`,
          gate: 'preview',
          hash: previewHashes.one,
          planHash: scenePlanHashesV1.one,
        },
        {
          target: `${seriesSlug}/${episodeSlug}@two`,
          gate: 'preview',
          hash: previewHashes.two,
          planHash: scenePlanHashesV1.two,
        },
      ])

      // Step 5: third produce run completes all the way to delivered v1
      const res = await produce({
        episodePath: scriptPath,
        synthesizerOptions: synthOpts,
        deps: commonDeps,
      })
      assert.equal(res.code, EXIT_DONE, 'completed with EXIT_DONE (0)')

      // Verify v1 delivery
      const v1Dir = path.join(episodeDir, 'deliveries', 'v1')
      assert.ok(fs.existsSync(v1Dir), 'deliveries/v1/ exists')
      const deliveryMeta = JSON.parse(fs.readFileSync(path.join(v1Dir, 'delivery.json'), 'utf8'))
      assert.equal(deliveryMeta.version, 'v1')
      assert.ok(deliveryMeta.outputs_hash, 'outputs_hash recorded')
      assert.ok(deliveryMeta.description, 'description recorded in delivery.json')
      assert.match(
        deliveryMeta.description,
        /<!-- chapters:start -->/,
        'description contains chapter block',
      )

      // Check episode document reflects delivered status
      const epRecord = readEpisode(scriptPath)
      assert.equal(epRecord.status, 'delivered')
      assert.equal(epRecord.fields.delivered_version, 'v1')

      // Step 6: rerun is idempotent no-op
      const rerunRes = await produce({
        episodePath: scriptPath,
        synthesizerOptions: synthOpts,
        deps: commonDeps,
      })
      assert.equal(rerunRes.code, EXIT_DONE)
      assert.equal(
        fs.existsSync(path.join(episodeDir, 'deliveries', 'v2')),
        false,
        'rerun creates no v2',
      )
    })

    // -------------------------------------------------------------------------
    // U6: Edit scene 2 and reopen
    // -------------------------------------------------------------------------
    await t.test('U6: edit scene 2, reopen only scene 2, deliver v2', async () => {
      // Edit scene 2 narration
      const editedDoc = buildEpisodeContent({
        status: 'delivered',
        scene2Narration: 'Brand new updated narration for scene two only.',
      })
      fs.writeFileSync(scriptPath, editedDoc, 'utf8')

      const scenePlanHashesV2 = {
        one: scenePlanHashesV1.one, // scene one slice hash is stable
        two: 'slice-hash-scene-two-v2', // scene two slice hash changed
      }
      const v2Deps = {
        ...commonDeps,
        planHashes: scenePlanHashesV2,
      }

      // Produce run: detects content change in scene 2
      let stop = null
      try {
        await produce({ episodePath: scriptPath, synthesizerOptions: synthOpts, deps: v2Deps })
      } catch (err) {
        if (err instanceof ProduceStop) stop = err
        else throw err
      }
      assert.ok(stop, 'produce stopped on edit')
      assert.equal(stop.exitCode, EXIT_REVIEW)
      assert.equal(stop.code, 'review-required')
      const pendingScenes = stop.details?.pending?.map((p) => p.scene) || []
      assert.ok(pendingScenes.includes('two'), 'Scene two must be pending review')
      assert.ok(!pendingScenes.includes('one'), 'Scene one must remain approved')

      // Approve script gate for scene 2
      const scriptHashes = getScriptHashes(scriptPath)
      writeApprovalChangeset(root, 'ws_rev_03_edit_script_changes_NN.md', [
        { target: `${seriesSlug}/${episodeSlug}@two`, gate: 'script', hash: scriptHashes.two },
      ])

      // Produce run to preview gate: scene one still approved, scene two needs preview approval
      stop = null
      try {
        await produce({ episodePath: scriptPath, synthesizerOptions: synthOpts, deps: v2Deps })
      } catch (err) {
        if (err instanceof ProduceStop) stop = err
        else throw err
      }
      assert.ok(stop, 'produce stopped at preview gate for scene two')
      assert.equal(stop.code, 'preview-required')

      // Approve preview gate for scene 2
      const previewHashes = getPreviewHashes(scriptPath, cacheDir)
      writeApprovalChangeset(root, 'ws_rev_04_edit_preview_changes_NN.md', [
        {
          target: `${seriesSlug}/${episodeSlug}@two`,
          gate: 'preview',
          hash: previewHashes.two,
          planHash: scenePlanHashesV2.two,
        },
      ])

      const avatarCallsBefore = fakeProv.log.filter((l) => l.kind === 'avatar').length

      // Produce run delivers v2 with new render output
      const res = await produce({
        episodePath: scriptPath,
        synthesizerOptions: synthOpts,
        deps: {
          ...v2Deps,
          render: async (opts) => {
            const out = await renderer.render(opts)
            fs.writeFileSync(out.outputVideoPath, Buffer.concat([MP4_BYTES, Buffer.from('v2')]))
            return out
          },
        },
      })
      assert.equal(res.code, EXIT_DONE)

      const avatarCallsAfter = fakeProv.log.filter((l) => l.kind === 'avatar').length
      assert.ok(avatarCallsAfter > avatarCallsBefore, 'scene two synthesized new avatar')

      // Both v1 and v2 exist, v1 bytes intact
      assert.ok(fs.existsSync(path.join(episodeDir, 'deliveries', 'v1')), 'v1 remains')
      assert.ok(fs.existsSync(path.join(episodeDir, 'deliveries', 'v2')), 'v2 was created')

      const v2Meta = JSON.parse(
        fs.readFileSync(path.join(episodeDir, 'deliveries', 'v2', 'delivery.json'), 'utf8'),
      )
      assert.equal(v2Meta.version, 'v2')
    })

    // -------------------------------------------------------------------------
    // U7: Legacy layout rejection & autopilot with review_gates: []
    // -------------------------------------------------------------------------
    await t.test('U7a: legacy layout rejection', () => {
      const legacyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-u7-legacy-'))
      try {
        fs.writeFileSync(
          path.join(legacyWs, 'domaiNN_NN.md'),
          '---\nworkspace_id: "leg"\n---\n',
          'utf8',
        )
        fs.writeFileSync(path.join(legacyWs, 'video-defaults_NN.md'), '# Defaults\n', 'utf8')
        // Old layout: assets folder instead of episodes
        const oldEp = path.join(legacyWs, 'series', 'old', 'assets', 'e1')
        fs.mkdirSync(oldEp, { recursive: true })
        fs.writeFileSync(path.join(oldEp, 'e1_coNNtent_NN.md'), '# Video\n', 'utf8')
        fs.writeFileSync(path.join(legacyWs, 'video-guard.json'), '{}', 'utf8')

        // assertLayout reports legacy findings
        const findings = assertLayout(legacyWs)
        assert.ok(findings.some((f) => f.code === LAYOUT_LEGACY))

        // detectState reports legacy-layout reason
        const state = detectState(legacyWs)
        assert.equal(state.reason, 'legacy-layout')
        assert.ok(state.legacy.length >= 1)
      } finally {
        fs.rmSync(legacyWs, { recursive: true, force: true })
      }
    })

    await t.test('U7b: autopilot with review_gates: [] delivers in one single run', async () => {
      const autoSlug = 'ep2'
      const autoDir = path.join(seriesDir, 'episodes', autoSlug)
      fs.mkdirSync(path.join(autoDir, 'media'), { recursive: true })
      fs.writeFileSync(path.join(autoDir, 'media', 'face1.png'), PNG_1x1)
      fs.writeFileSync(
        path.join(autoDir, 'media', 'face2.png'),
        Buffer.concat([PNG_1x1, Buffer.from('auto')]),
      )

      const autoContent = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-19-0"
title: "Autopilot Episode"
---

# NN Video

## NN Video: Episode 2
slug:: ep2
title:: Autopilot Episode
status:: draft
budget:: 10.0
review_gates:: []
output_formats:: [1920x1920]

# NN Scene

## NN Scene: Intro
slug:: one
kind:: Libre

Autopilot scene one without manual review gates.

# NN Layer

## NN Layer: Presenter One
type:: avatar
asset:: media/face1.png

# NN Scene

## NN Scene: Outro
slug:: two
kind:: Libre

Autopilot scene two ending without stops.

# NN Layer

## NN Layer: Presenter Two
type:: avatar
asset:: media/face2.png
`
      const autoScriptPath = path.join(autoDir, `${autoSlug}_coNNtent_NN.md`)
      fs.writeFileSync(autoScriptPath, autoContent, 'utf8')

      // Single produce execution: runs straight through WITHOUT any exit 10 stops!
      const autoRes = await produce({
        episodePath: autoScriptPath,
        synthesizerOptions: synthOpts,
        deps: {
          ...commonDeps,
          render: async (opts) => {
            const master = path.join(path.dirname(opts.scriptPath), 'ep2_1920x1920.mp4')
            fs.writeFileSync(master, MP4_BYTES)
            const hyperframesDir = path.join(path.dirname(opts.scriptPath), 'hyperframes')
            fs.mkdirSync(hyperframesDir, { recursive: true })
            const manifest = {
              fps: 30,
              totalDurationInFrames: 180,
              tracks: {
                scenes: [
                  { id: 's1', slug: 'one', fromFrame: 0, props: { title: 'Intro', layers: [] } },
                  { id: 's2', slug: 'two', fromFrame: 90, props: { title: 'Outro', layers: [] } },
                ],
                overlays: [],
              },
              metadata: { scriptSource: opts.scriptPath, videoSlug: autoSlug, hyperframesDir },
            }
            fs.writeFileSync(path.join(hyperframesDir, 'manifest.json'), JSON.stringify(manifest))
            fs.writeFileSync(
              path.join(hyperframesDir, 'index.html'),
              '<!doctype html><html><body></body></html>',
            )
            return { outputVideoPath: master, renderTimeMs: 1, linkMode: 'link', spentUsd: 0.1 }
          },
        },
      })

      assert.equal(autoRes.code, EXIT_DONE, 'autopilot finished in one single run with exit code 0')
      assert.ok(
        fs.existsSync(path.join(autoDir, 'deliveries', 'v1')),
        'deliveries/v1 created directly',
      )

      const autoEp = readEpisode(autoScriptPath)
      assert.equal(autoEp.status, 'delivered')
      assert.equal(autoEp.fields.delivered_version, 'v1')
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
