import { BLUEPRINT_VERSION } from './helpers/blueprint-version.mjs'

/**
 * nn-conntent/test/produce.test.mjs
 *
 * The `produce` state machine against a tmp domaiNN (capability video-produce-command):
 * intake dry-apply, the review stop (10), the budget stop (11), resume, and the engine
 * changesets written through the real apply engine.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { EXIT_BUDGET, EXIT_DONE, EXIT_ERROR, EXIT_REVIEW, produce, ProduceStop } from '../scripts/produce.mjs'
import { readEpisode } from '../scripts/lib/episode.mjs'
import { isAvatarLayer } from '../scripts/lib/avatar-jobs.mjs'
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs'
import { scriptSubjectsForEpisode } from '../scripts/lib/review-subject.mjs'

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER'])
  delete process.env[k]

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLUEPRINT = path.resolve(SKILL, '..', '..')

const SCENE = `# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

one two three four five six seven eight nine ten
`

const episodeDoc = ({
  status = 'draft',
  budget = '1.5',
  review = 'skip',
  scenes = SCENE,
  pin = BLUEPRINT_VERSION,
} = {}) => `---
level: 3
parent_spec:
  name: "coNNtent_${BLUEPRINT_VERSION}"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "${pin}"
title: "Probe episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: ${status}${budget === null ? '' : `\nbudget:: ${budget}`}
review_gates:: ${review === 'off' ? '[]' : review === 'preview' ? '[preview]' : review === 'skip' ? '[]' : '[script, preview]'}
output_formats:: [1920x1920]

${scenes}`

function workspace(doc = episodeDoc(), { series = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-produce-'))
  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n',
    'utf8',
  )
  // The package is laid out the way the resolver documents, both unversioned (Tier 1)
  // and versioned (Tier 1b): a CI runner has no global blueprint cache to fall back on,
  // so the fixture must not depend on one.
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent'), { recursive: true })
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent', BLUEPRINT_VERSION), { recursive: true })
  fs.copyFileSync(
    path.join(BLUEPRINT, 'spec_NN.md'),
    path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'spec_NN.md'),
  )
  fs.copyFileSync(
    path.join(BLUEPRINT, 'spec_NN.md'),
    path.join(root, 'specs', 'bluepriNNts', 'coNNtent', BLUEPRINT_VERSION, 'spec_NN.md'),
  )
  fs.copyFileSync(
    path.join(BLUEPRINT, 'defaults', 'video-defaults_NN.md'),
    path.join(root, 'video-defaults_NN.md'),
  )
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true })
  // The distributed blueprint chain resolves down to the level-0 leaf; there is no
  // network in tests, and the registry only covers a spec whose parent is a URL.
  fs.writeFileSync(
    path.join(root, 'specs', 'defiNNe_V_0-1-0_NN.md'),
    '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "L0"\n---\n\n# NN DefiNNition\n',
    'utf8',
  )
  const seriesDir = path.join(root, 'series', 's')
  const episode = path.join(seriesDir, 'episodes', 'e')
  fs.mkdirSync(episode, { recursive: true })
  if (series) {
    fs.writeFileSync(
      path.join(seriesDir, 's_coNNtent_NN.md'),
      '---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-15-1"\n  url: "https://example.invalid/coNNtent/spec_NN.md"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\nlanguage:: es\n',
      'utf8',
    )
  }
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md')
  fs.writeFileSync(scriptPath, doc, 'utf8')
  return { root, episode, scriptPath }
}

/** Temp cleanup; Windows can still hold a handle on a just-written render directory. */
const done = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    /* the OS reclaims the temp tree */
  }
}

/** A render seam: writes the master and reports cost/timing without touching a provider. */
function fakeRender({ indexHtml, overlayManifest } = {}) {
  const calls = []
  const render = async (opts) => {
    calls.push(opts)
    const dir = path.dirname(opts.scriptPath)
    const master = path.join(dir, 'probe_1920x1920.mp4')
    fs.writeFileSync(master, 'master-bytes')
    const hyperframesDir = path.join(dir, 'hyperframes', '1920x1920')
    fs.mkdirSync(hyperframesDir, { recursive: true })
    const manifest = {
      fps: 30,
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
        overlays: overlayManifest || [],
      },
      metadata: { scriptSource: opts.scriptPath },
    }
    fs.writeFileSync(path.join(hyperframesDir, 'manifest.json'), JSON.stringify(manifest))
    if (indexHtml !== null) {
      let html = indexHtml
      if (!html) {
        const overlayDivs = (manifest.tracks.overlays || [])
          .map((o) => `<div id="${o.id}" class="clip nn-overlay"></div>`)
          .join('\n')
        html = `<!doctype html><html><body><div id="root">\n${overlayDivs}\n</div></body></html>`
      }
      fs.writeFileSync(path.join(hyperframesDir, 'index.html'), html)
    }
    return { outputVideoPath: master, renderTimeMs: 1, linkMode: 'link', spentUsd: 0.25 }
  }
  return { render, calls }
}

/**
 * Writes an applied human console verdict for the episode's first scene, hashed against
 * the current script subject (so the state is `approved` or `needs-change`, never stale).
 */
function applyVerdict(
  ws,
  {
    gate = 'script',
    verdict = 'approved',
    notes = null,
    reviewedHash = null,
    planHash = null,
  } = {},
) {
  const model = readEpisode(ws.scriptPath).model
  const bags = withScriptPresets(loadCascadeBags(path.dirname(ws.scriptPath)), model, ws.scriptPath)
  const [subject] = scriptSubjectsForEpisode({
    model,
    bags,
    scriptDir: path.dirname(ws.scriptPath),
    language: 'es',
  })
  const hash = reviewedHash || subject.hash
  const doc = `---
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
reviewer: Ana
---

# NN index

* [[Change]]

# NN Change

## NN Change: c-01
op:: review_gate
target:: s/e@one
gate:: ${gate}
verdict:: ${verdict}
reviewed_hash:: ${hash}${planHash ? `\nplan_hash:: ${planHash}` : ''}${notes ? `\nnotes:: ${notes}` : ''}
`
  fs.writeFileSync(path.join(ws.root, 'changes', 'ws_ana_1_changes_NN.md'), doc, 'utf8')
  return hash
}

/** The thumbnail stage is render-dependent (live tier): stub it in every produce test.
 * Console regeneration after every exit has its own suite (`pipeline.test.mjs`). */
const thumbStubs = () => ({
  thumbnailBase: 'first-frame.png',
  renderThumbnails: async ({ episodeDir, slug }) => [
    { path: path.join(episodeDir, slug + '_thumbnail_stub.png') },
  ],
  writeConsole: async ({ rootDir, open }) => ({
    status: 'unchanged',
    path: path.join(rootDir, 'domaiNN_console.html'),
    opened: open === true,
  }),
  qa: {
    hyperframesCheck: async () => ({ ok: true }),
    qaOutput: async () => ({ ok: true, checks: [] }),
    qaOutputSet: async () => ({ ok: true, checks: [] }),
  },
})

const assertStop = async (promise, code, exitCode) => {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof ProduceStop, `expected ProduceStop, got ${err?.name}: ${err?.message}`)
    assert.equal(err.code, code)
    assert.equal(err.exitCode, exitCode)
    return true
  })
}

test('review required and no approval stops with exit 10 and spends nothing', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'required' }))
  const { render, calls } = fakeRender()
  try {
    await assertStop(
      produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, log: () => {} } }),
      'review-required',
      EXIT_REVIEW,
    )
    assert.equal(calls.length, 0, 'no render ran')
    assert.equal(readEpisode(ws.scriptPath).status, 'draft', 'the state did not move past draft')
  } finally {
    done(ws.root)
  }
})

test('a needs-change scene is listed with its reviewer notes', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'required' }))
  applyVerdict(ws, { verdict: 'needs-change', notes: 'too long' })
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      (err) => {
        assert.equal(err.code, 'review-required')
        assert.match(err.message, /one: needs-change — too long/)
        return true
      },
    )
  } finally {
    done(ws.root)
  }
})

test('an unset budget always asks: exit 11 naming the estimate and the hash', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', budget: null }))
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      (err) => {
        assert.equal(err.exitCode, EXIT_BUDGET)
        assert.equal(err.code, 'budget-unset')
        assert.match(err.message, /plan [0-9a-f]{8}/)
        return true
      },
    )
  } finally {
    done(ws.root)
  }
})

test('an over-budget estimate with preview on asks for the budget gate before cheap spend (exit 10)', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', budget: '0.0001', review: 'skip' }))
  const { render, calls } = fakeRender()
  try {
    await assert.rejects(
      produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, log: () => {} } }),
      (err) => {
        assert.equal(err.exitCode, EXIT_REVIEW)
        assert.equal(err.code, 'budget-gate', 'the pre-preview subtotal alone is over budget (Q1)')
        assert.match(err.message, /plan [0-9a-f]{64}/)
        return true
      },
    )
    assert.equal(calls.length, 0, 'nothing was spent at the stop')
  } finally {
    done(ws.root)
  }
})

test('produce writes the e_description.md chapter block and never overwrites an authored body', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
    })
    assert.equal(result.code, EXIT_DONE)

    const desc = fs.readFileSync(path.join(ws.episode, 'e_description.md'), 'utf8')
    assert.match(desc, /^00:00 Opening$/m, 'the first scene starts at zero')
    assert.match(desc, /^00:03 Explaining$/m, 'the second scene starts at its frame time')

    // An authored body wins: a second run preserves authored prose while updating chapters.
    fs.writeFileSync(path.join(ws.episode, 'e_description.md'), 'Authored prose.\n', 'utf8')
    await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
    })
    const updated = fs.readFileSync(path.join(ws.episode, 'e_description.md'), 'utf8')
    assert.match(updated, /^Authored prose\./, 'the authored prose is preserved')
    assert.match(
      updated,
      /<!-- chapters:start -->\n00:00 Opening\n00:03 Explaining\n<!-- chapters:end -->/,
      'chapters are appended',
    )
  } finally {
    done(ws.root)
  }
})

test('produce applies a pending human console changeset before it reads the episode', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  try {
    fs.writeFileSync(
      path.join(ws.root, 'changes', 'ws_ana_1_changes_NN.md'),
      `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: proposed
title: "Human edit"
author_kind: human
origin: console
reviewer: Ana
---

# NN index

* [[Change]]

# NN Change

## NN Change: c-01
op:: update_field
target:: s/e@e&title
to:: Console title
evidence:: decision
`,
      'utf8',
    )
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.equal(
      readEpisode(ws.scriptPath).fields.title,
      'Console title',
      'the human edit landed first',
    )
  } finally {
    done(ws.root)
  }
})

test('the preview gate stops after cheap spend with exit 10, before any render', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'preview' }))
  const { render, calls } = fakeRender()
  let synthesized = false
  let animatic = 0
  try {
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: {
          ...thumbStubs(),
          render,
          synthesizeEpisodeAssets: async () => {
            synthesized = true
            return {}
          },
          renderAnimatic: async () => {
            animatic++
            return { outputVideoPath: 'probe_animatic_640x640.mp4' }
          },
          previewSubjects: () => [
            { scene: 'one', hash: 'a'.repeat(64), planHash: 'b'.repeat(64), subject: {} },
          ],
          log: () => {},
        },
      }),
      'preview-required',
      EXIT_REVIEW,
    )
    assert.equal(synthesized, true, 'cheap spend happened before the preview gate')
    assert.equal(animatic, 1, 'the animatic is the thing the reviewer approves')
    assert.equal(calls.length, 0, 'no render was reached')
  } finally {
    done(ws.root)
  }
})

test('a matching preview verdict lets the run continue to the render', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'preview' }))
  const hash = 'a'.repeat(64)
  const planHash = 'b'.repeat(64)
  applyVerdict(ws, { gate: 'preview', reviewedHash: hash, planHash })
  const { render, calls } = fakeRender()
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        render,
        synthesizeEpisodeAssets: async () => ({}),
        renderAnimatic: async () => ({ outputVideoPath: 'probe_animatic_640x640.mp4' }),
        previewSubjects: () => [{ scene: 'one', hash, planHash, subject: {} }],
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.equal(calls.length, 1)
    assert.equal(readEpisode(ws.scriptPath).status, 'delivered')
  } finally {
    done(ws.root)
  }
})

test('produce renders every declared thumbnail and delivers it', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  const seen = []
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        render: fakeRender().render,
        thumbnailBase: 'first-frame.png',
        renderThumbnails: async ({ episodeDir, slug, formats }) => {
          seen.push(formats)
          return ['2560x1440', '1080x1920'].map((size) => {
            const file = path.join(episodeDir, `${slug}_thumbnail_${size}.png`)
            fs.writeFileSync(file, 'png-bytes')
            return { path: file }
          })
        },
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.deepEqual(seen[0], ['2560x1440', '1080x1920'], 'the blueprint defaults')
    assert.ok(fs.existsSync(path.join(ws.episode, 'deliveries', 'v1', 'e_thumbnail_2560x1440.png')))
    assert.ok(fs.existsSync(path.join(ws.episode, 'deliveries', 'v1', 'e_thumbnail_1080x1920.png')))
  } finally {
    done(ws.root)
  }
})

test('daily_budget stops the run when the 24h window would be exceeded', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  try {
    // daily_budget is a domain-level ceiling (design A14).
    const defaultsPath = path.join(ws.root, 'video-defaults_NN.md')
    fs.appendFileSync(defaultsPath, '\ndaily_budget:: 0.001\n', 'utf8')

    // A row already spent inside the window leaves no headroom for this episode.
    const factsDir = path.join(ws.root, '.cognnitive', 'video')
    fs.mkdirSync(factsDir, { recursive: true })
    fs.writeFileSync(
      path.join(factsDir, 'ledger.jsonl'),
      JSON.stringify({
        v: 2,
        ts: new Date().toISOString(),
        episode: 'other',
        stage: 'tts',
        est_usd: 0.5,
      }) + '\n',
      'utf8',
    )

    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'daily-budget-exceeded',
      EXIT_BUDGET,
    )
  } finally {
    done(ws.root)
  }
})

test('daily_budget leaves a run alone when there is headroom', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  try {
    const defaultsPath = path.join(ws.root, 'video-defaults_NN.md')
    fs.appendFileSync(defaultsPath, '\ndaily_budget:: 100\n', 'utf8')
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
    })
    assert.equal(result.code, EXIT_DONE)
  } finally {
    done(ws.root)
  }
})

test('isAvatarLayer identifies avatar layers from model fields or type', () => {
  assert.equal(isAvatarLayer({ fields: { type: 'avatar' } }), true)
  assert.equal(isAvatarLayer({ type: 'avatar' }), true)
  assert.equal(isAvatarLayer({ fields: { type: 'media' } }), false)
})

test('produce runs the avatar stage before render when the episode has an avatar layer', async () => {
  const withAvatar = `${SCENE}
# NN Layer

## NN Layer: Avatar Intro
type:: avatar
asset:: media/face.png
`
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip', scenes: withAvatar }))
  try {
    const order = []
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        render: async (opts) => {
          order.push('render')
          return fakeRender().render(opts)
        },
        synthesizeAvatars: async () => {
          order.push('avatars')
          return { jobs: [] }
        },
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.deepEqual(order, ['avatars', 'render'], 'the avatar stage runs before the render, once')
  } finally {
    done(ws.root)
  }
})

test('produce runs TTS and image synthesis before avatar stage on cold cache with narrated avatar', async () => {
  const withAvatar = `${SCENE}
# NN Layer

## NN Layer: Avatar Intro
type:: avatar
asset:: media/face.png
`
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip', scenes: withAvatar }))
  try {
    const order = []
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        synthesizeEpisodeAssets: async () => {
          order.push('synthesize-assets')
          return { audioAssets: {} }
        },
        synthesizeAvatars: async () => {
          order.push('synthesize-avatars')
          return { jobs: [] }
        },
        render: async (opts) => {
          order.push('render')
          return fakeRender().render(opts)
        },
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.deepEqual(
      order,
      ['synthesize-assets', 'synthesize-avatars', 'render'],
      'synthesis runs before avatars and render on cold cache',
    )
  } finally {
    done(ws.root)
  }
})

test('produce never runs the avatar stage for an episode without avatar layers', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  try {
    let called = false
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        render: fakeRender().render,
        synthesizeAvatars: async () => {
          called = true
          return { jobs: [] }
        },
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.equal(called, false, 'no avatar layer means no avatar stage')
  } finally {
    done(ws.root)
  }
})

test('preview off and over budget asks for the episode budget gate (exit 10)', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', budget: '0.0001', review: 'off' }))
  try {
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'budget-gate',
      EXIT_REVIEW,
    )
  } finally {
    done(ws.root)
  }
})

test('an idea episode with no proposal fails naming that no script was proposed', async () => {
  const ws = workspace(episodeDoc({ status: 'idea' }))
  try {
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'no-proposal',
      1,
    )
  } finally {
    done(ws.root)
  }
})

test('a proposal with an unknown key is refused and the document is unchanged', async () => {
  const ws = workspace(episodeDoc({ status: 'idea', review: 'skip' }))
  const before = fs.readFileSync(ws.scriptPath, 'utf8')
  try {
    fs.writeFileSync(
      path.join(ws.episode, 'proposal_changes_NN.md'),
      `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "changes"
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "V_0-5-5"
status: proposed
title: "proposal"
author: "agent"
---

# NN Change

## NN Change: c-01
op:: update_field
target:: s/e@e&bogus_key
to:: "nope"
evidence:: decision
`,
      'utf8',
    )
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'unknown-key',
      1,
    )
    assert.equal(fs.readFileSync(ws.scriptPath, 'utf8'), before, 'nothing was applied')
  } finally {
    done(ws.root)
  }
})

test('a valid proposal is applied and intake sets status:: draft', async () => {
  const ws = workspace(episodeDoc({ status: 'idea', review: 'skip', budget: '1.5' }))
  try {
    fs.writeFileSync(
      path.join(ws.episode, 'proposal_changes_NN.md'),
      `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "changes"
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "V_0-5-5"
status: proposed
title: "proposal"
author: "agent"
---

# NN Change

## NN Change: c-01
op:: update_field
target:: s/e@one&kind
to:: "Libre"
evidence:: decision
`,
      'utf8',
    )
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.equal(
      readEpisode(ws.scriptPath).status,
      'delivered',
      'intake -> draft -> approved -> delivered',
    )
  } finally {
    done(ws.root)
  }
})

test('an archived episode is refused naming the state', async () => {
  const ws = workspace(episodeDoc({ status: 'archived' }))
  try {
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'refused-state',
      1,
    )
  } finally {
    done(ws.root)
  }
})

test('an episode outside series/<s>/episodes/ is refused before any spend, and the legacy assets/ layout is named', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'skip' }))
  const { render, calls } = fakeRender()
  try {
    // The layout the contract retired: an episode document under series/<s>/assets/<slug>/.
    const legacy = path.join(ws.root, 'series', 's', 'assets', 'e')
    fs.mkdirSync(legacy, { recursive: true })
    const scriptPath = path.join(legacy, 'e_coNNtent_NN.md')
    fs.renameSync(ws.scriptPath, scriptPath)
    await assert.rejects(
      produce({
        episodePath: scriptPath,
        deps: { ...thumbStubs(), render, log: () => {} },
      }),
      (err) => {
        assert.equal(err.code, 'episode-outside-contract')
        assert.equal(err.exitCode, EXIT_ERROR, 'a contract violation is an error, not a gate stop')
        assert.match(err.message, /series\/<series>\/episodes\/<slug>\//, 'names the contract location')
        assert.match(err.message, /series\/<s>\/assets\/<slug>\//, 'names the retired layout')
        return true
      },
    )
    assert.equal(calls.length, 0, 'nothing was spent')
    assert.equal(readEpisode(scriptPath).status, 'draft', 'the state did not move')
  } finally {
    done(ws.root)
  }
})

test('an episode pinned to another blueprint version is refused naming both', async () => {
  const ws = workspace(episodeDoc({ pin: 'V_0-14-1' }))
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      (err) => {
        assert.equal(err.code, 'blueprint-version-mismatch')
        assert.match(err.message, /V_0-14-1/)
        assert.ok(err.message.includes(BLUEPRINT_VERSION))
        return true
      },
    )
  } finally {
    done(ws.root)
  }
})

test('an unset language is a validation error before the estimate', async () => {
  const ws = workspace(episodeDoc(), { series: false })
  try {
    await assertStop(
      produce({
        episodePath: ws.scriptPath,
        deps: { ...thumbStubs(), render: fakeRender().render, log: () => {} },
      }),
      'missing-language',
      1,
    )
  } finally {
    done(ws.root)
  }
})

test('the engine CLI refuses the retired model flags', () => {
  const cli = path.join(SKILL, 'scripts', 'produce.mjs')
  const run = spawnSync(process.execPath, [cli, 'x', '--avatar-model', 'm'], { encoding: 'utf8' })
  assert.equal(run.status, 1)
  assert.match(run.stderr, /Unknown option --avatar-model/)
  assert.doesNotMatch(
    run.stderr.split('\n').slice(1).join('\n'),
    /--avatar-model/,
    'the usage never lists it',
  )
})

test('an approved script gate records the review snapshot the console compares against', async () => {
  const ws = workspace(episodeDoc({ status: 'draft', review: 'required' }))
  applyVerdict(ws, { gate: 'script', verdict: 'approved' })
  try {
    // The script gate is satisfied, so the run proceeds to the preview stop (exit 10).
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        deps: {
          ...thumbStubs(),
          render: fakeRender().render,
          synthesizeEpisodeAssets: async () => ({}),
          renderAnimatic: async () => ({ outputVideoPath: 'probe_animatic_640x640.mp4' }),
          previewSubjects: () => [
            { scene: 'one', hash: 'a'.repeat(64), planHash: 'b'.repeat(64), subject: {} },
          ],
          log: () => {},
        },
      }),
      (err) => {
        assert.equal(err.exitCode, EXIT_REVIEW, String((err && err.stack) || err))
        return true
      },
    )
    const snapshot = JSON.parse(
      fs.readFileSync(path.join(ws.root, '.cognnitive', 'video', 'reviews', 's__e.json'), 'utf8'),
    )
    assert.ok(snapshot.scenes.one, 'the approved scene is recorded')
    assert.match(
      snapshot.scenes.one.script.subject.narration,
      /one two three/,
      'the subject is kept as approved',
    )
  } finally {
    done(ws.root)
  }
})

test('a second run on a produced episode is idempotent and keeps produced', async () => {
  const ws = workspace(episodeDoc({ status: 'produced', budget: '1.5' }))
  const { render, calls } = fakeRender()
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { ...thumbStubs(), render, log: () => {} },
    })
    assert.equal(result.code, EXIT_DONE)
    assert.equal(calls.length, 1, 'the master is rendered again (cache makes it free)')
    const after = readEpisode(ws.scriptPath)
    assert.equal(after.status, 'delivered')
  } finally {
    done(ws.root)
  }
})

// ---------------------------------------------------------------------------
// Native per-format outputs (spec S3, S7, S8, S9)
// ---------------------------------------------------------------------------

const THREE_FORMATS = ['1920x1080', '1080x1920', '1080x1080']

/**
 * A render seam for N formats: one MP4 per format at the episode root, and one project
 * `hyperframes/<W>x<H>/` with its own manifest (same timeline, own canvas) per format.
 * `durationOf(format)` lets a test break the shared timeline; `bytesOf(format)` the bytes.
 */
function fakeFormatRender({ formats = THREE_FORMATS, durationOf = () => 180, bytesOf = (f) => `mp4 ${f}` } = {}) {
  const calls = []
  const render = async (opts) => {
    calls.push(opts)
    const dir = path.dirname(opts.scriptPath)
    const outputs = formats.map((format) => {
      const [width, height] = format.split('x').map(Number)
      const projectDir = path.join(dir, 'hyperframes', format)
      fs.mkdirSync(projectDir, { recursive: true })
      const manifest = {
        fps: 30,
        width,
        height,
        totalDurationInFrames: durationOf(format),
        tracks: {
          scenes: [{ id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: durationOf(format), props: { title: 'Opening', layers: [] } }],
          audio: [],
          overlays: [],
        },
        metadata: {
          scriptSource: opts.scriptPath,
          videoSlug: 'e',
          hyperframesDir: projectDir,
          generatedAt: new Date(Date.now() + calls.length).toISOString(),
        },
      }
      const manifestPath = path.join(projectDir, 'manifest.json')
      fs.writeFileSync(manifestPath, JSON.stringify(manifest))
      fs.writeFileSync(path.join(projectDir, 'index.html'), '<div id="root"></div>')
      const file = path.join(dir, `e_${format}.mp4`)
      fs.writeFileSync(file, bytesOf(format))
      return { format, width, height, path: file, manifestPath, projectDir }
    })
    return { outputVideoPath: outputs[0].path, outputs, renderTimeMs: 1, linkMode: 'link', spentUsd: 0 }
  }
  return { render, calls }
}

const formatsDoc = (formats = '[1920x1080, 1080x1920, 1080x1080]') =>
  episodeDoc({ status: 'draft', review: 'skip' }).replace('output_formats:: [1920x1920]', `output_formats:: ${formats}`)

/** QA and check seams that record what they were asked to judge. */
function recordingQa({ failCheck = null } = {}) {
  const seen = { checks: [], outputs: [], outputSet: null }
  return {
    seen,
    qa: {
      hyperframesCheck: async ({ projectDir, format }) => {
        seen.checks.push({ projectDir, format })
        return format === failCheck
          ? { ok: false, reason: 'hyperframes-check-exit-1', detail: 'outside_safe_zone' }
          : { ok: true }
      },
      qaOutput: async ({ outputPath, declaredSize, projectDir, manifest }) => {
        seen.outputs.push({ outputPath, declaredSize, projectDir, width: manifest.width, height: manifest.height })
        return { ok: true, checks: [{ id: 'duration', checkpoint: 'output', status: 'pass', format: declaredSize }] }
      },
      qaOutputSet: async ({ outputs }) => {
        seen.outputSet = outputs
        return { ok: true, checks: [] }
      },
    },
  }
}

test('produce renders every output format, checks and QAs each one, and delivers the whole set', async () => {
  const ws = workspace(formatsDoc())
  const { render } = fakeFormatRender()
  const { seen, qa } = recordingQa()
  let firstFrameOf = null
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        ...thumbStubs(),
        thumbnailBase: undefined,
        firstFrameFrom: (video, out) => {
          firstFrameOf = video
          return out
        },
        render,
        qa,
        log: () => {},
      },
    })
    assert.equal(result.code, EXIT_DONE)
    const rel = (p) => path.relative(ws.episode, p).split(path.sep).join('/')
    assert.deepEqual(
      seen.checks.map((c) => [c.format, rel(c.projectDir)]),
      THREE_FORMATS.map((f) => [f, `hyperframes/${f}`]),
      'hyperframes check runs once per format project',
    )
    assert.deepEqual(
      seen.outputs.map((o) => [o.declaredSize, rel(o.outputPath), rel(o.projectDir), `${o.width}x${o.height}`]),
      THREE_FORMATS.map((f) => [f, `e_${f}.mp4`, `hyperframes/${f}`, f]),
      'every output is judged against its own manifest and project',
    )
    assert.deepEqual(
      seen.outputSet.map((o) => [o.format, rel(o.path)]),
      THREE_FORMATS.map((f) => [f, `e_${f}.mp4`]),
      'the output set is the outputs of this run',
    )
    assert.equal(rel(firstFrameOf), 'e_1920x1080.mp4', 'the thumbnail fallback comes from the primary output')
    assert.equal(rel(result.summary.primary), 'e_1920x1080.mp4')
    const meta = JSON.parse(fs.readFileSync(path.join(ws.episode, 'deliveries', 'v1', 'delivery.json'), 'utf8'))
    const delivered = meta.files.map((f) => f.name)
    for (const f of THREE_FORMATS) assert.ok(delivered.includes(`e_${f}.mp4`), `delivery lists e_${f}.mp4`)
    for (const f of THREE_FORMATS) assert.ok(fs.existsSync(path.join(ws.episode, "deliveries", "v1", `e_${f}.mp4`)))
    assert.equal(readEpisode(ws.scriptPath).status, 'delivered')
    assert.doesNotMatch(fs.readFileSync(ws.scriptPath, 'utf8'), /^master::/m, 'no master field is written')
  } finally {
    done(ws.root)
  }
})

test('a format project that fails hyperframes check stops at failed_qa and delivers nothing', async () => {
  const ws = workspace(formatsDoc())
  const { render } = fakeFormatRender()
  const { qa } = recordingQa({ failCheck: '1080x1920' })
  try {
    await assertStop(
      produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, qa, log: () => {} } }),
      'qa-failed',
      12,
    )
    const report = JSON.parse(fs.readFileSync(path.join(ws.episode, 'qa.json'), 'utf8'))
    const failed = report.checks.filter((c) => c.status === 'fail')
    assert.deepEqual(failed.map((c) => [c.id, c.format]), [['hyperframes-check-failed', '1080x1920']])
    assert.equal(readEpisode(ws.scriptPath).status, 'failed_qa')
    assert.equal(fs.existsSync(path.join(ws.episode, 'deliveries')), false, 'no delivery when one format fails')
  } finally {
    done(ws.root)
  }
})

test('formats whose timelines differ fail the cross-format check and deliver nothing', async () => {
  const ws = workspace(formatsDoc())
  const { render } = fakeFormatRender({ durationOf: (f) => (f === '1080x1080' ? 181 : 180) })
  const { qa } = recordingQa()
  try {
    await assertStop(
      produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, qa, log: () => {} } }),
      'qa-failed',
      12,
    )
    const report = JSON.parse(fs.readFileSync(path.join(ws.episode, 'qa.json'), 'utf8'))
    const failed = report.checks.filter((c) => c.status === 'fail')
    assert.deepEqual(failed.map((c) => [c.id, c.format]), [['cross-format-mismatch', '1080x1080']])
    assert.equal(fs.existsSync(path.join(ws.episode, 'deliveries')), false)
  } finally {
    done(ws.root)
  }
})

test('an unchanged rerun keeps the delivery and its fingerprint; changed bytes make a new version', async () => {
  const ws = workspace(formatsDoc())
  const { qa } = recordingQa()
  const run = (render) => produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, qa, log: () => {} } })
  try {
    const first = await run(fakeFormatRender().render)
    assert.equal(first.summary.delivery.version, 'v1')
    const again = await run(fakeFormatRender().render)
    assert.equal(again.summary.delivery.created, false, 'same bytes: no new version')
    assert.equal(
      again.summary.delivery.inputFingerprint,
      first.summary.delivery.inputFingerprint,
      'generatedAt does not move the fingerprint',
    )
    const changed = await run(fakeFormatRender({ bytesOf: (f) => (f === '1080x1920' ? 'new bytes' : `mp4 ${f}`) }).render)
    assert.equal(changed.summary.delivery.created, true, 'changed bytes: a new version')
    assert.equal(changed.summary.delivery.version, 'v2')
    assert.equal(changed.summary.delivery.inputFingerprint, first.summary.delivery.inputFingerprint, 'even with the same inputs')
  } finally {
    done(ws.root)
  }
})

test('an output format that is not <W>x<H> stops the run before any spend', async () => {
  const ws = workspace(formatsDoc('[1920x1080, vertical]'))
  const { render, calls } = fakeFormatRender()
  try {
    await assertStop(
      produce({ episodePath: ws.scriptPath, deps: { ...thumbStubs(), render, log: () => {} } }),
      'unsupported-output-format',
      1,
    )
    assert.equal(calls.length, 0, 'nothing rendered')
  } finally {
    done(ws.root)
  }
})
