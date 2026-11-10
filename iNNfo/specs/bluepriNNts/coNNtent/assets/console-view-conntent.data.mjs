/**
 * coNNtent/assets/console-view-conntent.data.mjs
 *
 * Export-time facts for the unified `conntent` view (capability conntent-domain-console;
 * design D-C3; tasks 4b.1/4b.2). It calls the engine modules — layout, cascade, gates,
 * review-hash, library — and never re-implements them, so the console shows the same
 * effective value, source level and hash the engine uses.
 *
 * The exporter calls `collect({ rootDir, models })` and hands the JSON to the view as
 * `ctx.viewData`.
 */

import { readdir, readFile } from 'node:fs/promises'
import fs from 'node:fs'
import { join } from 'node:path'

import { loadKnowledgeModel } from '../skills/nn-conntent/scripts/lib/knowledge-model.mjs'
import { loadCascadeBags, withScriptPresets } from '../skills/nn-conntent/scripts/lib/video-scope.mjs'
import { createCascade } from '../skills/nn-conntent/scripts/lib/cascade.mjs'
import { lowerEpisode, scriptSubjectsFromScenes } from '../skills/nn-conntent/scripts/lib/review-subject.mjs'
import { previewSubjectsFromScenes } from '../skills/nn-conntent/scripts/lib/preview-subject.mjs'
import { evaluateGate, readAppliedVerdicts, reopenCause } from '../skills/nn-conntent/scripts/lib/gates.mjs'
import { CacheManager } from '../skills/nn-conntent/scripts/cache-manager.mjs'
import { resolveDefaultCacheDir } from '../skills/nn-conntent/scripts/lib/video-guard.mjs'
import { ttsCachePathFor } from '../skills/nn-conntent/scripts/lib/avatar-jobs.mjs'
import { loadGuardWithVoices } from '../skills/nn-conntent/scripts/lib/guard-config.mjs'
import registry from '../skills/nn-conntent/scripts/lib/field-registry.generated.json' with { type: 'json' }

const EPISODE_DOC = /_coNNtent_NN\.md$/i
/** Extensions a scene still can be shown from, in the order we prefer them. */
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif'])
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov'])

async function listDir(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return []
    throw err
  }
}

/** Series folders under `series/`: a folder holding `<slug>_coNNtent_NN.md`. */
async function seriesDirs(rootDir) {
  const out = []
  for (const entry of await listDir(join(rootDir, 'series'))) {
    if (!entry.isDirectory()) continue
    const docs = (await listDir(join(rootDir, 'series', entry.name))).filter(
      (f) => f.isFile() && EPISODE_DOC.test(f.name),
    )
    if (docs.length > 0) out.push({ slug: entry.name, dir: join(rootDir, 'series', entry.name), docs })
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug))
}

/** Episode folders under `series/<s>/episodes/<slug>/`. */
async function episodeDirs(seriesDir) {
  const out = []
  for (const entry of await listDir(join(seriesDir, 'episodes'))) {
    if (!entry.isDirectory()) continue
    const dir = join(seriesDir, 'episodes', entry.name)
    const doc = (await listDir(dir)).find((f) => f.isFile() && EPISODE_DOC.test(f.name))
    if (doc) out.push({ slug: entry.name, dir, scriptPath: join(dir, doc.name) })
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug))
}

async function readPlanHash(episodeDir) {
  try {
    const plan = JSON.parse(await readFile(join(episodeDir, 'plan.json'), 'utf8'))
    return typeof plan.plan_hash === 'string' ? plan.plan_hash : null
  } catch {
    return null
  }
}

/** Every cascade field's effective value and source at one position. */
function fieldsFor(cascade, scene, layer) {
  const out = {}
  const at = cascade.at(scene, layer)
  for (const [name, def] of Object.entries(registry.fields || {})) {
    if (!def || !def.cascade) continue
    const resolved = at.get(name)
    out[name] = { value: resolved.value, source: resolved.source }
  }
  return out
}

/** A path inside the domaiNN, addressed relative to the console at the domaiNN root. */
function rootRelative(rootDir, absPath) {
  const rel = path_relative(rootDir, absPath)
  return rel ? rel.split('\\').join('/') : null
}

function path_relative(from, to) {
  const f = String(from).replace(/\\/g, '/').replace(/\/+$/, '')
  const t = String(to).replace(/\\/g, '/')
  if (!t.startsWith(f)) return null
  return t.slice(f.length + 1)
}

/** The layers of one scene, in document order, with the pill data the view shows. */
function layersOf(model, sceneSlug, episodeDir, rootDir) {
  return (model.elements?.Layer || [])
    .filter((layer) => layer && layer.parentSlug === sceneSlug)
    .map((layer) => {
      const fields = layer.fields || {}
      const asset = fields.asset ? String(fields.asset) : ''
      const abs = asset ? join(episodeDir, asset) : null
      const ext = asset ? path_extname(asset) : ''
      const kind = IMAGE_EXT.has(ext) ? 'image' : VIDEO_EXT.has(ext) ? 'video' : fields.type ? String(fields.type) : ''
      const present = Boolean(abs && fs.existsSync(abs))
      return {
        slug: String(layer.slug || ''),
        name: String(layer.name || layer.slug || ''),
        type: fields.type ? String(fields.type) : '',
        style: fields.style ? String(fields.style) : '',
        text: fields.text ? String(fields.text) : '',
        asset,
        // The relative path the console can load, image or video, when the file exists.
        media: present ? rootRelative(rootDir, abs) : null,
        // Only an image can be a still; a video keeps its own thumbnail element.
        still: kind === 'image' && present ? rootRelative(rootDir, abs) : null,
        assetKind: kind,
        assetPresent: present,
      }
    })
}

function path_extname(p) {
  const m = /\.[^./\\]+$/.exec(String(p))
  return m ? m[0].toLowerCase() : ''
}

/** The fields whose origin a reviewer actually reads: render and delivery settings. */
const INHERIT_RELEVANT = new Set([
  'voice',
  'voice_model',
  'voice_speed',
  'voice_emotion',
  'language',
  'frame',
  'fit',
  'transition',
  'background_audio',
  'background_audio_volume',
  'character',
  'avatar_model',
  'avatar_resolution',
  'image_model',
  'image_size',
  'output_formats',
  'captions',
  'components',
])

/** The values a scene inherits, grouped by the level they come from. */
function inheritedSources(fields) {
  const out = []
  for (const [name, field] of Object.entries(fields || {})) {
    if (!INHERIT_RELEVANT.has(name)) continue
    if (!field || field.value === null || field.value === undefined || field.value === '') continue
    if (field.source === 'scene' || field.source === 'video' || field.source === 'layer') continue
    const def = registry.fields?.[name] || {}
    out.push({
      name,
      source: String(field.source),
      value: field.value,
      // The declared type drives the read-only widget the view renders.
      type: String(def.type || 'string'),
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

async function episodeFacts({ rootDir, series, episode, sourceHashes = {} }) {
  const model = loadKnowledgeModel(episode.scriptPath)
  // The console payload addresses elements as `<knowledge stem>@<slug>`; the stem is the
  // episode document's file name without `_NN.md`, not the `<series>/<slug>` pair.
  const knowledgeId = String(episode.scriptPath).replace(/\\/g, '/').split('/').pop().replace(/_NN\.md$/i, '')
  const video = (model.elements?.Video || [])[0] || {}
  const fields = video.fields || {}
  const slug = String(fields.slug || video.slug || episode.slug)
  const modelId = `${series.slug}/${slug}`
  const bags = withScriptPresets(loadCascadeBags(series.dir), model, episode.scriptPath)
  // The Video element's own fields are the innermost explicit level of the cascade.
  const videoBag = (model.elements?.Video || [])[0]?.fields || {}
  const cascadeBags = { ...bags, video: { ...(bags.video || {}), ...videoBag } }
  const cascade = createCascade({ model, scriptPath: episode.scriptPath, bags: cascadeBags })
  const language = cascade.at().get('language').value
  const reviewGates = cascade.at().get('review_gates').value
  const gateList = Array.isArray(reviewGates) ? reviewGates.map(String) : reviewGates ? [String(reviewGates)] : ['script', 'preview']

  const parsed = lowerEpisode({ model, bags, scriptDir: episode.dir })
  const scriptEntries = scriptSubjectsFromScenes(parsed.scenes || [], language, {}, sourceHashes)
  const verdicts = readAppliedVerdicts(rootDir, modelId)
  const planHash = await readPlanHash(episode.dir)

  const cacheManager = new CacheManager({ baseDir: resolveDefaultCacheDir(episode.dir), readOnly: true })
  // The same guard config every engine consumer uses, so the narration audio the view
  // offers is the cache entry `produce` will read (and not a look-alike key).
  const guardConfig = loadGuardWithVoices(episode.dir).config
  const previewEntries = previewSubjectsFromScenes(parsed.scenes || [], Object.fromEntries(scriptEntries.map((e) => [e.scene, e])), {
    cacheManager,
    config: {},
    models: {},
    bags,
    planHashes: {},
  })

  const snapshot = { scenes: {} }
  try {
    const raw = JSON.parse(await readFile(join(rootDir, '.cognnitive', 'video', 'reviews', `${series.slug}__${slug}.json`), 'utf8'))
    if (raw && raw.scenes) snapshot.scenes = raw.scenes
  } catch {
    /* no record: the cause is unknown, the state is the same */
  }

  const gates = []
  if (gateList.includes('script')) {
    for (const entry of scriptEntries) {
      const state = evaluateGate({ gate: 'script', scene: entry.scene, currentHash: entry.hash, verdicts })
      const previous = snapshot.scenes[entry.scene]?.script
      const cause = state.state === 'reopened' && previous ? reopenCause({ previous: previous.subject, current: entry.subject, sources: previous.sources }) : null
      gates.push({ gate: 'script', scene: entry.scene, ...state, cause: cause || state.cause })
    }
  }
  if (gateList.includes('preview')) {
    for (const entry of previewEntries) {
      const state = evaluateGate({ gate: 'preview', scene: entry.scene, currentHash: entry.hash, planHash: entry.planHash, verdicts })
      gates.push({ gate: 'preview', scene: entry.scene, ...state })
    }
  }
  if (gateList.includes('budget') || (!gateList.includes('preview') && planHash)) {
    gates.push({ gate: 'budget', scene: null, ...evaluateGate({ gate: 'budget', scene: null, currentHash: planHash || '', planHash: planHash || null, verdicts }) })
  }

  const sceneViews = (parsed.scenes || []).map((scene) => {
    const sceneSlug = scene.slug || scene.id
    const entry = scriptEntries.find((e) => e.scene === sceneSlug)
    const preview = previewEntries.find((e) => e.scene === sceneSlug)
    const fields = fieldsFor(cascade, sceneSlug)
    const sceneEl = (model.elements?.Scene || []).find((s) => s.slug === sceneSlug) || {}
    const layers = layersOf(model, sceneSlug, episode.dir, rootDir)
    // The narration audio the reviewer hears is the exact TTS cache entry the engine will
    // use; the same builder as compile/avatar keeps the key identical.
    let audio = null
    try {
      const audioPath = ttsCachePathFor({ ...scene, id: sceneSlug }, {
        cacheManager,
        config: guardConfig,
        models: {},
        bags,
      })
      audio = audioPath && fs.existsSync(audioPath) ? rootRelative(rootDir, audioPath) : null
    } catch {
      audio = null
    }
    return {
      slug: sceneSlug,
      knowledgeId,
      elementId: knowledgeId + '@' + sceneSlug,
      name: scene.name,
      kind: String(sceneEl.fields?.kind || ''),
      narration: scene.narration || '',
      scriptHash: entry ? entry.hash : null,
      previewHash: gateList.includes('preview') && preview ? preview.hash : null,
      planHash: preview ? preview.planHash || null : null,
      fields,
      sources: inheritedSources(fields),
      layers,
      still: (layers.find((l) => l.still) || {}).still || null,
      // The first playable asset of the scene (a video layer), for the thumbnail and lightbox.
      video: (layers.find((l) => l.assetKind === 'video' && l.media) || {}).media || null,
      audio,
      gates: gates.filter((g) => g.scene === sceneSlug),
    }
  })

  // Deliveries: one record per `deliveries/v<N>/` folder, newest first. Display only --
  // nothing here deletes or supersedes a folder (conntent-domain-console, "Episode
  // Deliveries section").
  const episodeRel = rootRelative(rootDir, episode.dir)
  const deliveries = []
  for (const entry of await listDir(join(episode.dir, 'deliveries'))) {
    if (!entry.isDirectory() || !/^v\d+$/.test(entry.name)) continue
    const dir = join(episode.dir, 'deliveries', entry.name)
    const files = (await listDir(dir)).filter((f) => f.isFile()).map((f) => f.name).sort()
    const htmlName = files.find((name) => /_delivery\.html$/i.test(name)) || null
    const folder = `${episodeRel}/deliveries/${entry.name}`
    deliveries.push({
      version: entry.name,
      path: folder,
      files,
      html: htmlName ? `${folder}/${htmlName}` : null,
    })
  }
  deliveries.sort((a, b) => Number(b.version.slice(1)) - Number(a.version.slice(1)))

  return {
    slug,
    modelId,
    knowledgeId,
    elementId: knowledgeId + '@' + (video.slug || slug),
    title: String(fields.title || slug),
    status: String(fields.status || ''),
    language: language || null,
    translationOf: fields.translation_of ? String(fields.translation_of) : null,
    reviewGates: gateList,
    planHash,
    scenes: sceneViews,
    gates,
    pending: gates.filter((g) => g.state !== 'approved'),
    deliveries,
    latestDelivery: deliveries.length > 0 ? deliveries[0].version : null,
    thumbnail: fields.thumbnail ? String(fields.thumbnail) : null,
  }
}

export async function collect({ rootDir } = {}) {
  const root = String(rootDir || '.')
  const groups = []
  for (const s of await seriesDirs(root)) {
    const seriesDoc = s.docs[0] ? loadKnowledgeModel(join(s.dir, s.docs[0].name)) : null
    const seriesFields = (seriesDoc?.elements?.Series || [])[0]?.fields || {}
    groups.push({ series: s, seriesDoc, seriesFields, episodeDirs: await episodeDirs(s.dir) })
  }
  // Two passes: a translation's subject carries the original's scene hashes, and the
  // original is never itself a translation (spec `translation_of`). Everything else is
  // hashed once, untouched.
  const factsByKey = new Map()
  const pendingTranslations = []
  for (const group of groups) {
    for (const entry of group.episodeDirs) {
      const facts = await episodeFacts({ rootDir: root, series: group.series, episode: entry })
      const key = `${group.series.slug}/${entry.slug}`
      if (facts.translationOf) pendingTranslations.push({ group, entry, key })
      else factsByKey.set(key, facts)
    }
  }
  for (const { group, entry, key } of pendingTranslations) {
    const before = await episodeFacts({ rootDir: root, series: group.series, episode: entry })
    const ref = before.translationOf
    const originalKey = String(ref).includes('/') ? String(ref) : `${group.series.slug}/${ref}`
    const original = factsByKey.get(originalKey) || null
    const sourceHashes = original
      ? Object.fromEntries(original.scenes.map((scene) => [scene.slug, scene.scriptHash]))
      : {}
    const facts = await episodeFacts({ rootDir: root, series: group.series, episode: entry, sourceHashes })
    markStaleTranslation({ rootDir: root, seriesSlug: group.series.slug, facts, original })
    factsByKey.set(key, facts)
  }

  const series = groups.map((group) => ({
    slug: group.series.slug,
    title: String(group.seriesFields.title || group.seriesDoc?.frontmatter?.title || group.series.slug),
    episodes: group.episodeDirs.map(
      (entry) => factsByKey.get(`${group.series.slug}/${entry.slug}`) || null,
    ).filter(Boolean),
  }))
  const pending = series.flatMap((s) =>
    s.episodes.flatMap((e) => e.pending.map((gate) => ({ series: s.slug, episode: e.slug, ...gate }))),
  )
  return { tree: { domain: root, series }, pending }
}

/**
 * Marks the scenes whose original changed since the translation was last approved. The
 * recorded hash is the original scene's hash the translation was reviewed with; a scene
 * without a record was never reviewed, so it cannot be stale. Display only: no gate opens.
 */
function markStaleTranslation({ rootDir, seriesSlug, facts, original }) {
  let snapshot = { scenes: {} }
  try {
    const raw = JSON.parse(fs.readFileSync(join(rootDir, '.cognnitive', 'video', 'reviews', `${seriesSlug}__${facts.slug}.json`), 'utf8'))
    if (raw && raw.scenes) snapshot.scenes = raw.scenes
  } catch {
    return
  }
  const staleScenes = []
  for (const scene of facts.scenes) {
    const recorded = snapshot.scenes[scene.slug]?.script?.subject?.source?.hash || null
    const current = original ? (original.scenes.find((s) => s.slug === scene.slug) || {}).scriptHash || null : null
    if (recorded && current && recorded !== current) {
      scene.stale = true
      staleScenes.push(scene.slug)
    }
  }
  if (staleScenes.length > 0) facts.staleScenes = staleScenes
}
