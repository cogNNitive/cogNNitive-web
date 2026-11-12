#!/usr/bin/env node

/**
 * nn-conntent/test/produce-cold-cache.test.mjs
 *
 * Cold-cache E2E test for `produce` (Task 3b-2.8):
 * - Empty cache, fake providers via synthesizerOptions.
 * - Flow: stop 10 in script -> human changeset in changes/ -> stop 10 in preview with ZERO avatar calls -> approval -> delivered v1.
 * - TTS before avatar.
 * - Editing scene 2 reopens ONLY scene 2.
 * - Rerun = no-op.
 * - Stub QA (deps.qa) and render; fixture master must be real video or QA injected.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

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

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k]
}

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

function makeSyntheticAudio() {
  return MP3_BYTES
}

function buildEpisodeDoc({
  status = 'draft',
  budget = '10.0',
  review = '[script, preview]',
  scene2Narration = 'Second scene narration for testing',
} = {}) {
  return `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-19-0"
title: "Cold Cache E2E Episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: ${status}
budget:: ${budget}
review_gates:: ${review}
output_formats:: [1920x1920]

# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

Opening narration for scene one.

# NN Layer

## NN Layer: Presenter One
type:: avatar
asset:: media/face1.png

# NN Scene

## NN Scene: Two
slug:: two
kind:: Libre

${scene2Narration}

# NN Layer

## NN Layer: Presenter Two
type:: avatar
asset:: media/face2.png
`
}

function createWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-cold-cache-'))
  const cacheDir = path.join(root, 'cache')
  fs.mkdirSync(cacheDir, { recursive: true })

  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n',
    'utf8',
  )

  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-19-0'), { recursive: true })
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
  fs.writeFileSync(
    path.join(root, 'specs', 'defiNNe_V_0-1-0_NN.md'),
    '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "L0"\n---\n\n# NN DefiNNition\n',
    'utf8',
  )

  const seriesDir = path.join(root, 'series', 's')
  const episode = path.join(seriesDir, 'episodes', 'e')
  fs.mkdirSync(episode, { recursive: true })
  fs.writeFileSync(
    path.join(seriesDir, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-15-1"\n  url: "https://example.invalid/coNNtent/spec_NN.md"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\nlanguage:: es\n',
    'utf8',
  )

  const mediaDir = path.join(episode, 'media')
  fs.mkdirSync(mediaDir, { recursive: true })
  fs.writeFileSync(path.join(mediaDir, 'face1.png'), PNG_1x1)
  fs.writeFileSync(path.join(mediaDir, 'face2.png'), Buffer.concat([PNG_1x1, Buffer.from('face2')]))

  const scriptPath = path.join(episode, 'e_coNNtent_NN.md')
  fs.writeFileSync(scriptPath, buildEpisodeDoc(), 'utf8')
  return { root, episode, scriptPath, cacheDir }
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {}
}

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
    const master = path.join(dir, 'probe_1920x1920.mp4')
    fs.writeFileSync(master, MP4_BYTES)
    const hyperframesDir = path.join(dir, 'hyperframes')
    fs.mkdirSync(hyperframesDir, { recursive: true })
    const manifest = {
      fps: 30,
      totalDurationInFrames: 180,
      tracks: {
        scenes: [
          { id: 'scene_one', slug: 'one', fromFrame: 0, props: { title: 'Opening', layers: [] } },
          {
            id: 'scene_two',
            slug: 'two',
            fromFrame: 90,
            props: { title: 'Explaining', layers: [] },
          },
        ],
        overlays: [],
      },
      metadata: { scriptSource: opts.scriptPath, videoSlug: 'e', hyperframesDir },
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

function getScriptHashes(ws) {
  const model = readEpisode(ws.scriptPath).model
  const bags = withScriptPresets(loadCascadeBags(path.dirname(ws.scriptPath)), model, ws.scriptPath)
  const parsed = lowerEpisode({ model, bags, scriptDir: path.dirname(ws.scriptPath) })
  const subjects = scriptSubjectsFromScenes(parsed.scenes || [], 'es', {}, {})
  return Object.fromEntries(subjects.map((s) => [s.scene, s.hash]))
}

function getPreviewHashes(ws, cacheDir) {
  const model = readEpisode(ws.scriptPath).model
  const bags = withScriptPresets(loadCascadeBags(path.dirname(ws.scriptPath)), model, ws.scriptPath)
  const parsed = lowerEpisode({ model, bags, scriptDir: path.dirname(ws.scriptPath) })
  const scriptEntries = scriptSubjectsFromScenes(parsed.scenes || [], 'es', {}, {})
  const scriptByScene = Object.fromEntries(scriptEntries.map((e) => [e.scene, e]))
  const cacheManager = new CacheManager({ baseDir: cacheDir, readOnly: true })
  const models = {
    image: normalizeModelId(cascadeResolve('image_model', bags).value),
    tts: normalizeModelId(cascadeResolve('voice_model', bags).value),
    avatar: normalizeModelId(cascadeResolve('avatar_model', bags).value),
  }
  const config = loadGuardWithVoices(path.dirname(ws.scriptPath)).config
  const previewEntries = previewSubjectsFromScenes(parsed.scenes || [], scriptByScene, {
    cacheManager,
    config,
    models,
    bags,
  })
  return Object.fromEntries(previewEntries.map((p) => [p.scene, p.hash]))
}

function writeApprovalChangeset(ws, filename, changes) {
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
  fs.writeFileSync(path.join(ws.root, 'changes', filename), content, 'utf8')
}

test('3b-2.8 cold-cache E2E: script gate -> preview gate (0 avatars) -> delivery v1 -> rerun no-op -> scene 2 reopen', async () => {
  const ws = createWorkspace()
  const provider = createFakeProvider()
  const { render } = fakeRender()

  const synthOpts = {
    env: { WAVESPEED_API_KEY: 'fake-key' },
    fetch: provider.fetch,
    sleep: async () => {},
  }

  const baseDeps = {
    cacheDir: ws.cacheDir,
    render,
    thumbnailBase: 'first-frame.png',
    synthesizeAvatarOptions: {
      measureDuration: async () => 1.5,
    },
    qa: {
      qaMaster: async () => ({ ok: true, checks: [] }),
      qaOutputSet: async () => ({ ok: true, checks: [] }),
    },
    renderThumbnails: async ({ episodeDir, slug }) => [
      { path: path.join(episodeDir, `${slug}_thumbnail_2560x1440.png`) },
      { path: path.join(episodeDir, `${slug}_thumbnail_1080x1920.png`) },
    ],
    formats: async ({ outDir, formats }) => ({
      variants: (formats || []).map((f) => ({
        path: path.join(outDir, `probe_${f.name}.mp4`),
        outputPath: path.join(outDir, `probe_${f.name}.mp4`),
      })),
    }),
    writeConsole: async ({ rootDir }) => ({
      status: 'unchanged',
      path: path.join(rootDir, 'domaiNN_console.html'),
      opened: false,
    }),
    log: () => {},
  }

  try {
    // --- Step 1: Initial pass with empty cache -> stop 10 at script gate ---
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        synthesizerOptions: synthOpts,
        deps: baseDeps,
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop)
        assert.equal(err.exitCode, EXIT_REVIEW)
        assert.equal(err.code, 'review-required')
        return true
      },
    )

    // Verify 0 avatar calls and 0 TTS calls before script approval
    assert.equal(provider.log.filter((c) => c.kind === 'avatar').length, 0)
    assert.equal(provider.log.filter((c) => c.kind === 'tts').length, 0)

    // --- Step 2: Approve script gate for scene one and two via human changeset ---
    const scriptHashes = getScriptHashes(ws)
    writeApprovalChangeset(ws, 'ws_reviewer_script_changes_NN.md', [
      { target: 's/e@one', gate: 'script', hash: scriptHashes.one },
      { target: 's/e@two', gate: 'script', hash: scriptHashes.two },
    ])

    // Second pass -> stop 10 at preview gate with ZERO avatar calls
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        synthesizerOptions: synthOpts,
        deps: baseDeps,
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop)
        assert.equal(err.exitCode, EXIT_REVIEW)
        assert.equal(err.code, 'preview-required')
        return true
      },
    )

    const avatarCallsBeforePreview = provider.log.filter((c) => c.kind === 'avatar')
    const ttsCallsBeforePreview = provider.log.filter((c) => c.kind === 'tts')

    // Requirement: "stop 10 in preview with ZERO avatar calls"
    assert.equal(
      avatarCallsBeforePreview.length,
      0,
      'Must have ZERO avatar calls before preview gate approval',
    )

    // Requirement: "TTS before avatar"
    assert.ok(ttsCallsBeforePreview.length > 0, 'TTS must have run before preview gate')

    // --- Step 3: Approve preview gate for both scenes ---
    const planHash = estimateScriptCost(ws.scriptPath).planHash
    const previewHashes = getPreviewHashes(ws, ws.cacheDir)
    writeApprovalChangeset(ws, 'ws_reviewer_preview_changes_NN.md', [
      { target: 's/e@one', gate: 'preview', hash: previewHashes.one, planHash },
      { target: 's/e@two', gate: 'preview', hash: previewHashes.two, planHash },
    ])

    // Third pass -> reaches delivered v1
    const res1 = await produce({
      episodePath: ws.scriptPath,
      synthesizerOptions: synthOpts,
      deps: baseDeps,
    })

    assert.equal(res1.code, EXIT_DONE)
    assert.equal(res1.summary.delivery.version, 'v1')
    assert.equal(res1.summary.delivery.created, true)

    const metaV1 = JSON.parse(
      fs.readFileSync(path.join(ws.episode, 'deliveries', 'v1', 'delivery.json'), 'utf8'),
    )
    assert.equal(typeof metaV1.description, 'string')
    assert.ok(metaV1.description.includes('<!-- chapters:start -->'))

    const epDelivered = readEpisode(ws.scriptPath)
    assert.equal(epDelivered.status, 'delivered')
    assert.equal(epDelivered.fields.delivered_version, 'v1')

    // Avatars must have run now
    const avatarCallsAfterDelivery = provider.log.filter((c) => c.kind === 'avatar')
    assert.ok(
      avatarCallsAfterDelivery.length >= 2,
      'Avatars should have been synthesized for scenes',
    )

    // Requirement: "TTS before avatar"
    const firstTtsTime = Math.min(...ttsCallsBeforePreview.map((c) => c.time))
    const firstAvatarTime = Math.min(...avatarCallsAfterDelivery.map((c) => c.time))
    assert.ok(firstTtsTime <= firstAvatarTime, 'TTS synthesis must happen before avatar synthesis')

    // --- Step 4: Rerun = no-op ---
    const avatarCallsCountBeforeRerun = provider.log.filter((c) => c.kind === 'avatar').length
    const resRerun = await produce({
      episodePath: ws.scriptPath,
      synthesizerOptions: synthOpts,
      deps: baseDeps,
    })

    assert.equal(resRerun.code, EXIT_DONE)
    assert.equal(resRerun.summary.delivery.version, 'v1')
    assert.equal(
      resRerun.summary.delivery.created,
      false,
      'Rerun must not create a new delivery version',
    )
    const avatarCallsCountAfterRerun = provider.log.filter((c) => c.kind === 'avatar').length
    assert.equal(
      avatarCallsCountAfterRerun,
      avatarCallsCountBeforeRerun,
      'Rerun must not synthesize new avatars',
    )

    // --- Step 5: Editing scene 2 reopens ONLY scene 2 ---
    const editedDoc = buildEpisodeDoc({
      status: 'delivered',
      scene2Narration: 'Completely edited narration for scene two only.',
    })
    fs.writeFileSync(ws.scriptPath, editedDoc, 'utf8')

    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        synthesizerOptions: synthOpts,
        deps: baseDeps,
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop)
        assert.equal(err.exitCode, EXIT_REVIEW)
        assert.equal(err.code, 'review-required')
        // Pending list must contain scene two, but NOT scene one
        const pendingScenes = err.details?.pending?.map((p) => p.scene) || []
        assert.ok(pendingScenes.includes('two'), 'Scene two must be pending review')
        assert.ok(!pendingScenes.includes('one'), 'Scene one must remain approved')
        return true
      },
    )
  } finally {
    cleanup(ws.root)
  }
})
