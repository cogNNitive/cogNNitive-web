#!/usr/bin/env node

/**
 * nn-conntent/scripts/lib/pipeline.mjs
 *
 * The stage order of `produce` (capability video-produce-command): intake, the review
 * gate, the estimate, the budget gate, synthesis, captions, the animatic, preview, the
 * avatar stage, compile + render, QA, formats, thumbnails, description, delivery and the
 * lifecycle writes -- in one order, stopping only at a human gate (exit 10), before spend
 * (exit 11) or after failed QA (exit 12). `produce.mjs` is the CLI over this module.
 *
 * Every exit regenerates the domaiNN console through the one shared writer, in a
 * `finally` that runs after the engine's own writes (capability console-regeneration;
 * design D-C5). A regeneration failure is reported and never changes the exit code.
 *
 * Exit codes: 0 done, 10 awaiting review, 11 over budget / budget unset, 12 failed QA,
 * 1 error.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { findBlueprintPackage } from './video-scope.mjs'
import { loadCascadeBags, withScriptPresets } from './video-scope.mjs'
import { parseKnowledgeDocument } from './knowledge-model.mjs'
import {
  EpisodeError,
  assertProducible,
  readEpisode,
  resolveForEpisode,
  unknownKeys,
} from './episode.mjs'
import {
  ChangesetError,
  applyChanges,
  applyChangesetFile,
  applyPendingHumanChangesets,
  dryApply as defaultDryApply,
  fieldChange,
} from './changes.mjs'
import { evaluateGate, readAppliedVerdicts, writeReviewSnapshot } from './gates.mjs'
import { lowerEpisode, scriptGateStates, scriptSubjectsFromScenes } from './review-subject.mjs'
import { translationSourceHashes } from './translation-source.mjs'
import { previewGateStates, previewSubjectsFromScenes } from './preview-subject.mjs'
import { renderAnimatic as defaultRenderAnimatic } from './animatic.mjs'
import { deliver as defaultDeliver } from './delivery.mjs'
import { canonicalJson, sha256Hex } from './canonical.mjs'
import { firstFrameFrom, renderEpisodeThumbnails } from './thumbnails.mjs'
import { resolveLibrary } from './library.mjs'
import { loadGuardWithVoices } from './guard-config.mjs'
import { budgetGateTarget, spendPlan } from './spend-gate.mjs'
import { CacheManager } from '../cache-manager.mjs'
import { normalizeModelId, resolveDefaultCacheDir } from './video-guard.mjs'
import { resolve as cascadeResolve } from './cascade.mjs'
import { estimateScriptCost } from '../asset-cost-estimator.mjs'
import { randomUUID } from 'node:crypto'
import { readTimingRows, readLedgerRows } from './facts.mjs'
import { chapterLines, readManifestForFinalize, writeDescriptionFile } from './description.mjs'
import { DELIVERY_FORMATS, renderFormats } from '../render-formats.mjs'
import { renderVideo } from './render.mjs'
import { synthesizeAvatars } from '../synthesize-avatar.mjs'
import { isAvatarLayer } from './avatar-jobs.mjs'
import { resolveWorkspace } from './video-guard.mjs'
import {
  qaMaster as defaultQaMaster,
  qaOutputSet as defaultQaOutputSet,
  writeQaReport,
} from './qa.mjs'
import { recordStage, synthesizeEpisodeAssets } from './compile.mjs'
import { alignEpisodeCaptions } from './captions-stage.mjs'
import { NO_OPEN_ENV, resolveConsoleModulePath } from './nn-core.generated.cjs'

export const EXIT_DONE = 0
export const EXIT_REVIEW = 10
export const EXIT_BUDGET = 11
export const EXIT_QA = 12
export const EXIT_ERROR = 1

export const PROPOSAL_FILENAME = 'proposal_changes_NN.md'
const EPISODE_DOC_RE = /_coNNtent_NN\.md$/i

/** The exits that need a human in the console: a gate, a spend stop or failed QA. */
const HUMAN_EXITS = new Set([EXIT_REVIEW, EXIT_BUDGET, EXIT_QA])

/** The derivation preset whose dimensions are exactly `size`, or null. */
function presetForSize(size) {
  return (
    Object.keys(DELIVERY_FORMATS).find(
      (name) => `${DELIVERY_FORMATS[name].width}x${DELIVERY_FORMATS[name].height}` === size,
    ) || null
  )
}

export class ProduceStop extends Error {
  constructor(code, message, extra = {}) {
    super(message)
    this.name = 'ProduceStop'
    this.code = code
    this.exitCode = extra.exitCode ?? EXIT_ERROR
    this.details = extra.details || {}
  }
}

/** The installed coNNtent blueprint version, read from the package spec. */
export function installedBlueprintVersion(pkgDir = null) {
  const dir = pkgDir || findBlueprintPackage()
  const model = parseKnowledgeDocument(fs.readFileSync(path.join(dir, 'spec_NN.md'), 'utf8'))
  return model.frontmatter?.blueprint_version
}

/** The episode document for an argument that may name the folder or the file. */
export function resolveEpisodePath(input) {
  const abs = path.resolve(input)
  if (!fs.existsSync(abs)) throw new ProduceStop('episode-not-found', `Episode not found: ${abs}`)
  if (fs.statSync(abs).isFile()) return abs
  const docs = fs.readdirSync(abs).filter((name) => EPISODE_DOC_RE.test(name))
  if (docs.length !== 1) {
    throw new ProduceStop(
      'episode-document-not-found',
      `Expected exactly one <slug>_coNNtent_NN.md in ${abs}, found ${docs.length}.`,
    )
  }
  return path.join(abs, docs[0])
}

/**
 * The model id the changeset target uses. `Video` is a distributed concept, so an
 * episode is an instance model addressed by its container chain and its own slug
 * (`<series>/<episode>`), never by its file stem (`e_coNNtent`). A document placed
 * under `<container>/episodes/<slug>/` keeps the distributed rule; anything else uses
 * the compact-model rule: the stem.
 */
export const modelIdOf = (scriptPath) => {
  const folder = path.dirname(scriptPath)
  const slug = path.basename(folder)
  const parent = path.basename(path.dirname(folder))
  if (parent === 'episodes') {
    const container = path.basename(path.dirname(path.dirname(folder)))
    if (container) return `${container}/${slug}`
  }
  return path.basename(scriptPath, '.md').replace(/_NN$/, '')
}

/**
 * The shared console writer, imported from the resolved console asset directory. One
 * trusted-location policy (nn-core `console/locate-writer`), never the domain path.
 */
async function loadSharedWriter() {
  const modulePath = resolveConsoleModulePath()
  if (!modulePath) {
    throw new Error(
      'Console assets not found: no export-console.mjs in INNFO_CONSOLE_DIR, ~/.agents/console or the cogNNitive dev checkout.',
    )
  }
  const mod = await import(pathToFileURL(modulePath).href)
  if (typeof mod.writeConsole !== 'function') {
    throw new Error(`${modulePath} does not export writeConsole; update the console assets.`)
  }
  return mod.writeConsole
}

/**
 * Regenerate the domaiNN console after an engine exit. `open` is true only for an exit
 * that needs the human (10, 11, 12), never with `--no-open` or `INNFO_CONSOLE_NO_OPEN=1`.
 * Never throws: a failure is reported with the console path and the error, and the exit
 * code stands.
 */
export async function regenerateOnExit({
  rootDir,
  exitCode,
  noOpen = false,
  deps = {},
  log = () => {},
}) {
  const consolePath = path.join(rootDir, 'domaiNN_console.html')
  const open = HUMAN_EXITS.has(exitCode) && !noOpen && process.env[NO_OPEN_ENV] !== '1'
  try {
    const writeConsole = deps.writeConsole || (await loadSharedWriter())
    const result = await writeConsole({
      rootDir,
      scope: 'domain',
      open,
      ...(deps.consoleLauncher ? { launcher: deps.consoleLauncher } : {}),
      log,
    })
    log(`console: ${result.status} ${result.path}`)
    return result
  } catch (err) {
    const message = String(err?.message || err)
    log(`console: regeneration failed for ${consolePath}: ${message}`)
    return { status: 'failed', path: consolePath, error: message }
  }
}

/**
 * Intake: validate the proposal on a throwaway copy, then apply it for real and set
 * `status:: draft` in a separate engine changeset (design A4).
 */
async function intake({ rootDir, episodePath, modelId, deps, log }) {
  const proposalPath = path.join(path.dirname(episodePath), PROPOSAL_FILENAME)
  if (!fs.existsSync(proposalPath)) {
    throw new ProduceStop(
      'no-proposal',
      `The episode is in "idea" and no script was proposed: expected ${PROPOSAL_FILENAME} in ${path.dirname(episodePath)}.`,
    )
  }
  const dry = await (deps.dryApply || defaultDryApply)({
    rootDir,
    episodePath,
    changesetPath: proposalPath,
  })
  if (!dry.ok) {
    const problem = dry.problem || {
      code: 'changeset-rejected',
      message: 'The proposal was rejected.',
    }
    throw new ProduceStop(problem.code, `The proposed changeset was refused: ${problem.message}`)
  }
  const applied = parseKnowledgeDocument(dry.text)
  const problems = unknownKeys(applied, deps.registry)
  if (problems.length > 0) {
    const named = problems.map((p) => `${p.element}.${p.key}`).join(', ')
    throw new ProduceStop(
      'unknown-key',
      `The proposed changeset introduces unknown field keys: ${named}. Nothing was applied.`,
    )
  }
  // Same seal, same body: the real apply runs the file the dry apply validated.
  const appliedReal = await (deps.applyFile || applyChangesetFile)(rootDir, proposalPath)
  log(`intake: applied ${PROPOSAL_FILENAME} (${appliedReal.changesetPath})`)
  const real = await (deps.apply || applyChanges)(
    rootDir,
    [
      {
        op: 'update_field',
        target: `${modelId}@${deps.videoSlug || appliedVideoSlug(applied)}&status`,
        to: 'draft',
      },
    ],
    { title: 'engine: intake' },
  )
  log(`intake: status:: draft (${real.changesetPath})`)
}

/** The Video slug of a parsed episode, used when the caller did not pass one. */
function appliedVideoSlug(model) {
  const video = (model.elements?.Video || [])[0]
  return String(video?.fields?.slug || video?.slug || '')
}

/**
 * Runs one produce pass.
 * @param {{ episodePath: string, dryRun?: boolean, noOpen?: boolean, deps?: object }} options
 * @returns {Promise<{ code: number, summary?: object, stop?: object }>}
 */
export async function produce(options) {
  const deps = options.deps || {}
  const log = deps.log || ((line) => console.log(line))
  const scriptPath = resolveEpisodePath(options.episodePath)
  const rootDir = resolveWorkspace(path.dirname(scriptPath)).root
  let exitCode = EXIT_ERROR
  try {
    const result = await runStages({ scriptPath, rootDir, options, deps, log })
    exitCode = result.code
    return result
  } catch (err) {
    exitCode = err instanceof ProduceStop ? err.exitCode : EXIT_ERROR
    throw err
  } finally {
    await regenerateOnExit({ rootDir, exitCode, noOpen: options.noOpen === true, deps, log })
  }
}

/** The ordered stages of one produce pass. Wrapped by `produce` for the exit regeneration. */
async function runStages({ scriptPath, rootDir, options, deps, log }) {
  const episodeDir = path.dirname(scriptPath)
  const installed = deps.installedVersion || installedBlueprintVersion(deps.packageDir)

  // 0. Apply the human console changesets that are waiting (download fallback). They
  // are the only input that can change the episode before this run reads it.
  const pendingHuman = await (deps.applyPending || applyPendingHumanChangesets)(rootDir)
  for (const outcome of pendingHuman) {
    log(`intake: applied pending ${outcome.changeset} (${outcome.status})`)
    // A rejection names its reason, so the author fixes the changeset instead of
    // retrying blind (#606).
    if (outcome.success === false) {
      const errors = Array.isArray(outcome.errors) ? outcome.errors : []
      if (errors.length === 0) {
        log('intake:   changeset-rejected: no rejection reason reached the intake')
      }
      for (const error of errors) {
        const code = error?.code || 'changeset-rejected'
        const where = error?.path ? ` [${error.path}]` : ''
        log(`intake:   ${code}: ${error?.message || String(error)}${where}`)
      }
    }
  }

  let episode = readEpisode(scriptPath, { model: deps.model })
  try {
    assertProducible(episode, installed)
  } catch (err) {
    if (err instanceof EpisodeError) throw new ProduceStop(err.code, err.message)
    throw err
  }
  const modelId = modelIdOf(scriptPath)

  const language = resolveForEpisode(episode.model, scriptPath, 'language').value
  if (!language) {
    throw new ProduceStop(
      'missing-language',
      `${path.basename(scriptPath)} resolves no language. Declare language:: in the episode, the Series or the domain defaults.`,
    )
  }

  // 1. Intake (idea only).
  if (episode.status === 'idea') {
    await intake({
      rootDir,
      episodePath: scriptPath,
      modelId,
      deps: { videoSlug: episode.slug, ...deps },
      log,
    })
    episode = readEpisode(scriptPath)
  }

  // 2. Script gate: derived from applied human verdicts and the current scene hashes.
  const gates = resolveForEpisode(episode.model, scriptPath, 'review_gates').value
  const gateList = Array.isArray(gates)
    ? gates.map(String)
    : gates
      ? [String(gates)]
      : ['script', 'preview']
  // A translation carries the original's scene hashes in its review subject, so the
  // console can tell the original moved on (capability conntent-domain-console).
  const sourceHashes = translationSourceHashes({ rootDir, scriptPath, model: episode.model })
  if (gateList.includes('script')) {
    const bags = withScriptPresets(
      loadCascadeBags(path.dirname(scriptPath)),
      episode.model,
      scriptPath,
    )
    const parsed = lowerEpisode({ model: episode.model, bags, scriptDir: path.dirname(scriptPath) })
    const subjects = scriptSubjectsFromScenes(parsed.scenes || [], language, {}, sourceHashes)
    const verdicts = readAppliedVerdicts(rootDir, modelId)
    const states = scriptGateStates(subjects, verdicts)
    // The snapshot is what a later run (and the console) compares against: the subject
    // each scene was approved with, recorded once the gate is satisfied.
    const approved = states.filter((state) => state.state === 'approved')
    if (approved.length > 0) {
      const records = Object.fromEntries(
        subjects
          .filter((entry) => approved.some((state) => state.scene === entry.scene))
          .map((entry) => [
            entry.scene,
            { script: { subject: entry.subject, sources: entry.sources || {} } },
          ]),
      )
      writeReviewSnapshot(rootDir, String(modelId).split('/')[0], episode.slug, records)
    }
    const pending = states.filter((state) => state.state !== 'approved')
    if (pending.length > 0) {
      const lines = pending.map((state) => {
        const cause = state.cause?.detail ? ` (${state.cause.kind}: ${state.cause.detail})` : ''
        const notes = state.notes ? ` — ${state.notes}` : ''
        return `  - ${state.scene}: ${state.state}${notes}${cause}`
      })
      const detail =
        `Review required: ${pending.length} scene(s) are not approved.\n${lines.join('\n')}\n` +
        `Open the console, approve the script gate, then run produce again.`
      throw new ProduceStop('review-required', detail, {
        exitCode: EXIT_REVIEW,
        details: { pending },
      })
    }
  }

  // 3. Lifecycle: approved (before any spend).
  if (episode.status !== 'approved' && episode.status !== 'produced') {
    await (deps.apply || applyChanges)(
      rootDir,
      [fieldChange(modelId, episode.slug, 'status', 'approved', episode.status)],
      { title: 'engine: approved' },
    )
    log('lifecycle: status:: approved')
    episode = readEpisode(scriptPath)
  }

  // 4. Estimate and the spend decision (before any provider call).
  const estimate = (deps.estimate || estimateScriptCost)(scriptPath)
  const planHash = estimate.planHash
  const total = estimate.summary.grandTotalCost
  const budget = resolveForEpisode(episode.model, scriptPath, 'budget').value
  const budgetUsd = budget === null || budget === undefined || budget === '' ? null : Number(budget)
  const spend = spendPlan({
    reviewGates: gateList,
    total,
    budget: budgetUsd,
    prePreviewSubtotal:
      (estimate.summary.totalImageCost || 0) + (estimate.summary.totalTtsCost || 0),
    planHash,
  })
  if (spend.stop) {
    throw new ProduceStop(spend.stop.code, spend.stop.message, {
      exitCode: spend.stop.exitCode,
      details: { planHash, total },
    })
  }
  if (spend.budgetGate) {
    // The inserted episode-level budget gate: a human verdict carries the plan hash.
    const verdicts = readAppliedVerdicts(rootDir, modelId)
    const state = evaluateGate({ ...budgetGateTarget({ modelId, planHash }), verdicts })
    if (state.state !== 'approved') {
      throw new ProduceStop(
        'budget-gate',
        `The estimate $${total.toFixed(4)} exceeds the budget $${Number(budgetUsd).toFixed(2)} ` +
          `(plan ${planHash}). Approve the budget gate in the console with this hash, or lower the script.`,
        { exitCode: EXIT_REVIEW, details: { planHash, total, budget: budgetUsd } },
      )
    }
  }

  // The rolling daily ceiling is a domain/blueprint declaration (design A14), not a
  // per-run knob: it is checked against what the facts ledger already charged in the
  // last 24h. `--approve` is about the episode's budget, never about the daily ceiling.
  const dailyBudget = resolveForEpisode(episode.model, scriptPath, 'daily_budget').value
  const dailyBudgetUsd =
    dailyBudget === null || dailyBudget === undefined || dailyBudget === ''
      ? null
      : Number(dailyBudget)
  if (dailyBudgetUsd !== null && Number.isFinite(dailyBudgetUsd)) {
    const now = Date.now()
    const spent24h = readLedgerRows(rootDir).reduce((sum, row) => {
      const ts = Date.parse(row.ts)
      if (!Number.isFinite(ts) || now - ts > 24 * 60 * 60 * 1000) return sum
      const usd = Number(row.est_usd)
      return sum + (Number.isFinite(usd) && usd > 0 ? usd : 0)
    }, 0)
    if (spent24h + total > dailyBudgetUsd + 1e-9) {
      throw new ProduceStop(
        'daily-budget-exceeded',
        `The 24h window already spent $${spent24h.toFixed(4)} and this run estimates $${total.toFixed(4)}, ` +
          `over the daily_budget $${dailyBudgetUsd.toFixed(2)} (plan ${planHash.slice(0, 8)}). ` +
          'Lower the script, or raise daily_budget at the domain level. --approve does not bypass this ceiling.',
        {
          exitCode: EXIT_BUDGET,
          details: { planHash, total, dailyBudget: dailyBudgetUsd, spent24h },
        },
      )
    }
  }

  if (options.dryRun) {
    log(
      `plan: $${total.toFixed(4)} of $${budgetUsd === null ? 'unset' : budgetUsd.toFixed(2)} (plan ${planHash.slice(0, 8)}); dry run, nothing spent.`,
    )
    return { code: EXIT_DONE, summary: { planHash, total, budget: budgetUsd, dryRun: true } }
  }

  const runId = deps.runId || randomUUID()
  const facts = { rootDir, runId, episode: episode.slug, planHash }
  const synthOptions = options.synthesizerOptions || deps.synthesizerOptions
  const cacheDir = deps.cacheDir || options.cacheDir

  // 4b. Synthesis of audio and images (before avatars so narration audio is cached for avatars)
  const synthAssets = deps.synthesizeEpisodeAssets || synthesizeEpisodeAssets
  const synth = await synthAssets({
    scriptPath,
    facts,
    recordSynthesisStages: true,
    ...(synthOptions ? { synthesizerOptions: synthOptions } : {}),
    ...(cacheDir ? { cacheDir } : {}),
  })

  const alignCaptions = deps.alignEpisodeCaptions || alignEpisodeCaptions
  await alignCaptions({
    scriptPath,
    facts,
    deps,
    audioAssets: synth?.audioAssets,
    ...(cacheDir ? { cacheDir } : {}),
    ...(synthOptions ? { synthesizerOptions: synthOptions } : {}),
  })

  // 4b. Preview gate: after the cheap spend (TTS, images, captions, animatic) and before
  // any avatar call. The hash covers what the reviewer heard and saw.
  if (gateList.includes('preview')) {
    // The animatic shows the reviewer the episode with real audio and the pose still.
    const declaredSizes = resolveForEpisode(episode.model, scriptPath, 'output_formats').value
    const masterSize =
      Array.isArray(declaredSizes) && declaredSizes.length > 0
        ? String(declaredSizes[0])
        : '1920x1920'
    const [masterWidth, masterHeight] = masterSize.split('x').map((value) => Number(value))
    const renderAnimatic = deps.renderAnimatic || defaultRenderAnimatic
    const animatic = await renderAnimatic({
      scriptPath,
      masterWidth: Number.isFinite(masterWidth) ? masterWidth : 1920,
      masterHeight: Number.isFinite(masterHeight) ? masterHeight : 1920,
      facts,
      stageDeps: deps.stageDeps,
      ...(deps.render ? { render: deps.render } : {}),
      ...(synthOptions ? { synthesizerOptions: synthOptions } : {}),
      ...(cacheDir ? { cacheDir } : {}),
    })
    log(`animatic: ${animatic.outputVideoPath}`)

    const bags = withScriptPresets(
      loadCascadeBags(path.dirname(scriptPath)),
      episode.model,
      scriptPath,
    )
    const parsed = lowerEpisode({ model: episode.model, bags, scriptDir: path.dirname(scriptPath) })
    const scriptEntries = scriptSubjectsFromScenes(parsed.scenes || [], language, {}, sourceHashes)
    const scriptByScene = Object.fromEntries(scriptEntries.map((entry) => [entry.scene, entry]))
    const cacheManager = new CacheManager({
      baseDir: deps.cacheDir || resolveDefaultCacheDir(path.dirname(scriptPath)),
      readOnly: true,
    })
    const models = deps.models || {
      image: normalizeModelId(cascadeResolve('image_model', bags).value),
      tts: normalizeModelId(cascadeResolve('voice_model', bags).value),
      avatar: normalizeModelId(cascadeResolve('avatar_model', bags).value),
    }
    const baseGuardConfig = deps.guardConfig || loadGuardWithVoices(path.dirname(scriptPath)).config
    const config = baseGuardConfig
    const build = deps.previewSubjects || previewSubjectsFromScenes
    const previewEntries = build(parsed.scenes || [], scriptByScene, {
      cacheManager,
      config,
      models,
      bags,
      alignmentKeys: deps.alignmentKeys,
      stills: deps.stills,
      planHashes:
        deps.planHashes ||
        Object.fromEntries((parsed.scenes || []).map((s) => [s.slug || s.id, planHash])),
    })
    const verdicts = readAppliedVerdicts(rootDir, modelId)
    const open = previewGateStates(previewEntries, verdicts).filter(
      (state) => state.state !== 'approved',
    )
    if (open.length > 0) {
      const lines = open.map((state) => {
        const notes = state.notes ? ` — ${state.notes}` : ''
        return `  - ${state.scene}: ${state.state}${notes}`
      })
      throw new ProduceStop(
        'preview-required',
        `Review required: ${open.length} scene(s) are not approved for preview.\n${lines.join('\n')}\n` +
          `Open the console, approve the preview gate, then run produce again.`,
        { exitCode: EXIT_REVIEW, details: { pending: open, planHash } },
      )
    }
  }

  // 4c. The avatar stage. Talking avatars are the costliest call and the only stage a
  // render cannot do itself: it refuses a layer with no cached clip. produce therefore runs
  // it here, before the render, whenever the episode actually has one.
  const avatarLayers = (episode.model.elements?.Layer || []).filter(isAvatarLayer)
  if (avatarLayers.length > 0 && !options.dryRun) {
    const sync = deps.synthesizeAvatars || synthesizeAvatars
    await sync({
      scriptPath,
      ...(cacheDir ? { cacheDir } : {}),
      ...(synthOptions?.env ? { env: synthOptions.env } : {}),
      ...(synthOptions?.fetch ? { fetch: synthOptions.fetch } : {}),
      ...(synthOptions?.sleep ? { sleep: synthOptions.sleep } : {}),
      ...(deps.synthesizeAvatarOptions || {}),
    })
    log(`avatars: ${avatarLayers.length} layer(s) synthesized or picked up from cache`)
  }

  // 5. Compile + render the master.
  const render = deps.render || renderVideo
  const rendered = await render({
    scriptPath,
    facts,
    gsapPath: deps.gsapPath,
    stageDeps: deps.stageDeps,
    recordSynthesisStages: false,
    ...(synthOptions ? { synthesizerOptions: synthOptions } : {}),
    ...(cacheDir ? { cacheDir } : {}),
  })
  const masterPath = rendered.outputVideoPath
  log(
    `render: ${masterPath} (${rendered.renderTimeMs} ms, link_mode=${rendered.linkMode || 'link'})`,
  )

  // 5b. Master QA gate: duration, size, audio stream and overlay emission (structural and visible)
  const qaMasterFn = deps.qa?.qaMaster || deps.qaMaster || defaultQaMaster
  const qaStart = Date.now()
  const { manifest } = readManifestForFinalize({ episodeDir, scriptPath })
  const declaredSizes = resolveForEpisode(episode.model, scriptPath, 'output_formats').value
  const declaredSize =
    Array.isArray(declaredSizes) && declaredSizes.length > 0
      ? String(declaredSizes[0])
      : '1920x1920'

  const masterQa = await qaMasterFn({
    episodeDir,
    manifest,
    masterPath,
    declaredSize,
    deps: deps.qaDeps || deps,
  })
  recordStage(facts, { stage: 'qa', start: qaStart, end: Date.now() })

  if (!masterQa.ok) {
    writeQaReport(episodeDir, masterQa)
    log(`qa: master checkpoint failed; report written to ${path.join(episodeDir, 'qa.json')}`)
    await (deps.apply || applyChanges)(
      rootDir,
      [fieldChange(modelId, episode.slug, 'status', 'failed_qa')],
      { title: 'engine: failed_qa' },
    )
    throw new ProduceStop(
      'qa-failed',
      `QA failed at master checkpoint: ${(masterQa.checks || [])
        .filter((c) => c.status === 'fail')
        .map((c) => c.id)
        .join(', ')}`,
      { exitCode: EXIT_QA, details: { checkpoint: 'master', checks: masterQa.checks } },
    )
  }

  // 6. Formats: every declared output after the first must exist.
  const declared = resolveForEpisode(episode.model, scriptPath, 'output_formats').value
  const sizes = Array.isArray(declared) ? declared.map(String) : []
  const derived = sizes.slice(1)
  const presets = []
  for (const size of derived) {
    const preset = presetForSize(size)
    if (!preset) {
      throw new ProduceStop(
        'unsupported-format',
        `output_formats declares ${size}, which the derivation has no preset for (known: ${Object.keys(DELIVERY_FORMATS).join(', ')}).`,
      )
    }
    presets.push(preset)
  }
  let formats = []
  if (presets.length > 0) {
    const made = await (deps.formats || renderFormats)({
      master: masterPath,
      outDir: path.join(episodeDir, 'formats'),
      formats: presets,
      force: true,
    })
    formats = made.variants || []
    log(
      `formats: ${formats.filter((v) => !v.skipped).length} derived under ${path.join(episodeDir, 'formats')}`,
    )
  }

  // 6a. Thumbnails: every declared size. Title, base and badge come from the cascade
  // fields (defaults: the Video title, the first scene still, no badge).
  const thumbnailFormats = resolveForEpisode(episode.model, scriptPath, 'thumbnail_formats').value
  const thumbnailTitle = String(
    resolveForEpisode(episode.model, scriptPath, 'thumbnail_title').value ||
      episode.fields.title ||
      episode.slug,
  )
  const badgeValue = resolveForEpisode(episode.model, scriptPath, 'thumbnail_badge').value
  const thumbnailBadge =
    badgeValue === null || badgeValue === undefined || badgeValue === '' ? null : String(badgeValue)
  const baseRef = resolveForEpisode(episode.model, scriptPath, 'thumbnail_base').value
  let thumbnailBase = deps.thumbnailBase
  if (!thumbnailBase && baseRef) {
    thumbnailBase = resolveLibrary({
      kind: 'media',
      ref: String(baseRef),
      fromDir: episodeDir,
    }).path
  }
  if (!thumbnailBase) {
    thumbnailBase = firstFrameFrom(
      masterPath,
      path.join(episodeDir, `${episode.slug}_thumbnail_base.png`),
    )
  }
  const thumbnails = await (deps.renderThumbnails || renderEpisodeThumbnails)({
    episodeDir,
    slug: episode.slug,
    title: thumbnailTitle,
    basePath: thumbnailBase,
    formats: thumbnailFormats,
    badge: thumbnailBadge,
    deps: deps.thumbnailDeps,
  })
  log(`thumbnails: ${thumbnails.length} size(s)`)

  // 6b. Chapters: the printable block comes from the manifest the render just wrote.
  // Authored prose is preserved, and chapters are written atomically inside markers.
  const chapters = chapterLines(manifest)
  const descriptionPath = path.join(episodeDir, `${episode.slug}_description.md`)
  writeDescriptionFile(descriptionPath, manifest)
  log(`description: chapters written to ${descriptionPath}\n${chapters.join('\n')}`)

  // 6c. Output-set QA checkpoint
  const qaOutputSetFn = deps.qa?.qaOutputSet || deps.qaOutputSet || defaultQaOutputSet
  const qaOutStart = Date.now()
  const outputQa = await qaOutputSetFn({
    episodeDir,
    slug: episode.slug,
    outputFormats: sizes,
    thumbnailFormats,
    deps: deps.qaDeps || deps,
  })
  recordStage(facts, { stage: 'qa', start: qaOutStart, end: Date.now() })

  const combinedReport = {
    ok: masterQa.ok && outputQa.ok,
    checks: [...(masterQa.checks || []), ...(outputQa.checks || [])],
  }
  writeQaReport(episodeDir, combinedReport)

  if (!outputQa.ok) {
    log(`qa: output-set checkpoint failed; report written to ${path.join(episodeDir, 'qa.json')}`)
    await (deps.apply || applyChanges)(
      rootDir,
      [fieldChange(modelId, episode.slug, 'status', 'failed_qa')],
      { title: 'engine: failed_qa' },
    )
    throw new ProduceStop(
      'qa-failed',
      `QA failed at output-set checkpoint: ${(outputQa.checks || [])
        .filter((c) => c.status === 'fail')
        .map((c) => c.id)
        .join(', ')}`,
      { exitCode: EXIT_QA, details: { checkpoint: 'output-set', checks: outputQa.checks } },
    )
  }

  // 7. Delivery: the last step after QA. A passing run lands `deliveries/v<N>/`; an
  // identical rerun is a no-op and earlier versions stay immutable.
  const deliveryOutputs = [
    masterPath,
    ...formats.map((variant) => variant.outputPath || variant.path).filter(Boolean),
    ...thumbnails.map((thumbnail) => thumbnail.path),
    descriptionPath,
  ].filter((file) => typeof file === 'string' && fs.existsSync(file))
  const inputFingerprint = sha256Hex(canonicalJson({ manifest, planHash }))
  const delivered = await (deps.deliver || defaultDeliver)({
    episodeDir,
    outputs: deliveryOutputs,
    inputFingerprint,
  })
  log(
    delivered.created
      ? `delivery: ${delivered.version} (${deliveryOutputs.length} file(s))`
      : `delivery: ${delivered.version} unchanged`,
  )

  // 8. Lifecycle: delivered, only after the delivery folder exists.
  if (episode.status !== 'delivered' || delivered.created) {
    await (deps.apply || applyChanges)(
      rootDir,
      [
        fieldChange(modelId, episode.slug, 'master', path.basename(masterPath)),
        fieldChange(modelId, episode.slug, 'status', 'delivered'),
        fieldChange(modelId, episode.slug, 'delivered_version', delivered.version),
      ],
      { title: 'engine: delivered' },
    )
    log(`lifecycle: status:: delivered (${delivered.version})`)
  }

  const timings = readTimingRows(rootDir).filter((row) => row.run_id === runId)
  const summary = {
    planHash,
    estimateUsd: total,
    budgetUsd,
    realUsd: rendered.spentUsd || 0,
    linkMode: rendered.linkMode || 'link',
    master: masterPath,
    formats,
    delivery: delivered,
    stages: timings.map((row) => ({
      stage: row.stage,
      durationMs: row.duration_ms,
      hits: row.cache?.hits || 0,
      misses: row.cache?.misses || 0,
    })),
  }
  return { code: EXIT_DONE, summary }
}

export { ChangesetError, EpisodeError }
