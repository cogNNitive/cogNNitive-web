/**
 * coNNtent/assets/console-view-episode-review.data.mjs
 *
 * Export-time data for the Episode review view (design A12/A13).
 *
 * Two jobs:
 *  1. Read the Episode documents with the real parser, so nested `### NN Layer:` elements
 *     keep their `parentSlug`. The console payload flattens elements and loses that link,
 *     and without it a review UI cannot show "the layers of this scene".
 *  2. Read the JSONL facts (`<domaiNN>/.cognnitive/video/*.jsonl`) for cost and timings.
 *
 * Nothing here runs in the browser: the console stays static and offline.
 */
import { readFile, readdir, mkdir, stat } from 'node:fs/promises'
import { join, basename, extname, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { parseKnowledgeDocument } from '../skills/nn-conntent/scripts/lib/knowledge-model.mjs'
import { loadCascadeBags, resolve as resolveParam } from '../skills/nn-conntent/scripts/lib/video-scope.mjs'
import { isPriceStale } from '../skills/nn-conntent/scripts/lib/catalog.mjs'

const execFileAsync = promisify(execFile)

// Which fields a Scene can override: read from the generated registry, never a hand list.
const FIELD_REGISTRY = JSON.parse(
  await readFile(new URL('../skills/nn-conntent/scripts/lib/field-registry.generated.json', import.meta.url), 'utf8'),
)
const SCENE_FIELDS = Object.entries(FIELD_REGISTRY.fields || {})
  .filter(([, field]) => (field.concepts || []).includes('Scene'))
  .map(([name]) => name)

// A Layer declares only the fields its behaviour type can use: an avatar Layer has an
// avatar model, a text overlay has a placement and a style, and nothing else is noise.
const LAYER_FIELDS_BY_TYPE = {
  avatar: ['asset', 'prompt', 'avatar_model', 'avatar_resolution'],
  media: ['asset', 'prompt', 'fit', 'placement'],
  text: ['text', 'text_from', 'style', 'position', 'z_index'],
  animation: ['asset', 'style', 'position', 'z_index', 'enter_animation', 'exit_animation', 'timing'],
}

/** An unknown legacy type still gets a usable field set instead of an empty card. */
function layerFieldsFor(type) {
  return LAYER_FIELDS_BY_TYPE[type] || LAYER_FIELDS_BY_TYPE.text
}

// A Scene field only shows when the scene can actually use it: no avatar Layer means no
// avatar model to choose, no narration means no voice parameters.
const SCENE_FIELD_NEEDS = {
  avatar_model: ['avatar'],
  image_model: ['media'],
  image_size: ['media'],
  voice: ['narration'],
  voice_model: ['narration'],
  voice_speed: ['narration'],
  voice_emotion: ['narration'],
}

/** Background Layers fill the frame; the rest are overlays painted on top of it. */
function layerKindOf(type, fields) {
  if (fields?.style) return 'overlay'
  return type === 'avatar' || type === 'media' ? 'background' : 'overlay'
}

const FACTS_DIR = ['.cognnitive', 'video']
const EPISODE_DIRS = ['episodes', 'assets']

// The console CSP is `img-src data: blob:` — a file path can never load, so every preview
// has to be embedded. A full still is far too heavy (the pilot holds a 6.3 MB avatar), so
// a reduced copy is generated once and cached, exactly what the retired `draft_thumbs/`
// used to be. The console only ever inlines the small copy.
const INLINE_LIMIT_BYTES = 160 * 1024
const THUMB_WIDTH = 480
const THUMB_QUALITY = 6
const INLINE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }

/** Cache dir for the review previews, inside the ignored `.cognnitive/cache/` tree. */
function thumbCacheDir(rootDir) {
  return join(String(rootDir || '.'), '.cognnitive', 'cache', 'console-thumbs')
}

/**
 * A reduced copy of `src` in the cache dir, or null when ffmpeg is unavailable.
 * The name hashes the source path and its mtime, so a re-rendered still gets a new thumb.
 */
async function reducedCopy(src, cacheDir) {
  const info = await stat(src).catch(() => null)
  if (!info) return null
  const key = createHash('sha256')
    .update(src + ':' + String(info.mtimeMs) + ':' + String(info.size))
    .digest('hex')
    .slice(0, 24)
  const dest = join(cacheDir, key + '.jpg')
  const cached = await stat(dest).catch(() => null)
  if (cached && cached.size > 0) return dest
  try {
    await mkdir(cacheDir, { recursive: true })
    await execFileAsync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-i',
      src,
      '-vf',
      `scale='min(${THUMB_WIDTH},iw)':-2`,
      '-q:v',
      String(THUMB_QUALITY),
      dest,
    ])
    return dest
  } catch {
    // No ffmpeg on this machine (or an unreadable source): the view names the asset instead.
    return null
  }
}

/**
 * A raster asset becomes a `data:` URI the console is allowed to render. Oversized stills
 * are reduced first. Anything else keeps its path, so the view can say "video, open it
 * separately" instead of rendering a broken <video> that the CSP blocks.
 * @param {{ episodeDir: string, cacheDir: string, relPath: string }} input
 */
async function inlineAsset({ episodeDir, cacheDir, relPath }) {
  const clean = String(relPath || '').trim()
  if (!clean) return { src: '', path: '', kind: '' }
  const type = INLINE_TYPES[extname(clean).toLowerCase()]
  if (!type) {
    const kind = /\.(mp4|webm|mov)$/i.test(clean) ? 'video' : 'other'
    return { src: '', path: clean, kind }
  }
  const file = resolve(episodeDir, clean)
  try {
    const bytes = await readFile(file)
    if (bytes.length <= INLINE_LIMIT_BYTES) {
      return { src: `data:${type};base64,${bytes.toString('base64')}`, path: clean, kind: 'image' }
    }
    const thumb = await reducedCopy(file, cacheDir)
    if (!thumb) return { src: '', path: clean, kind: 'image-too-large' }
    const small = await readFile(thumb)
    return { src: `data:image/jpeg;base64,${small.toString('base64')}`, path: clean, kind: 'image-reduced' }
  } catch {
    return { src: '', path: clean, kind: 'missing' }
  }
}

/** JSONL files in the facts folder whose name starts with `prefix`. */
async function factFiles(dir, prefix) {
  let entries
  try {
    entries = await readdir(dir)
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return []
    throw err
  }
  return entries
    .filter((name) => name.startsWith(prefix) && name.endsWith('.jsonl'))
    .sort()
    .map((name) => join(dir, name))
}

async function readRows(file) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const row = JSON.parse(trimmed)
      if (row && typeof row === 'object') rows.push(row)
    } catch {
      // A torn last line from an interrupted append is not a fact.
    }
  }
  return rows
}

async function readAll(dir, prefix) {
  const rows = []
  for (const file of await factFiles(dir, prefix)) rows.push(...(await readRows(file)))
  return rows
}

/** Episode documents under `series/<s>/assets/<slug>/`. */
async function episodeDocs(rootDir) {
  const seriesRoot = join(String(rootDir || '.'), 'series')
  let series
  try {
    series = await readdir(seriesRoot, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return []
    throw err
  }
  const docs = []
  for (const entry of series) {
    if (!entry.isDirectory()) continue
    for (const sub of EPISODE_DIRS) {
      const dir = join(seriesRoot, entry.name, sub)
      let episodes
      try {
        episodes = await readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const episode of episodes) {
        if (!episode.isDirectory()) continue
        const files = await readdir(join(dir, episode.name)).catch(() => [])
        const doc = files.find((f) => f.endsWith('_NN.md') && /_coNNtent_/.test(f))
        if (!doc) continue
        docs.push({
          file: join(dir, episode.name, doc),
          slug: episode.name,
          series: entry.name,
          dir: join(dir, episode.name),
        })
      }
    }
  }
  return docs
}

/** One document → the shape the review cards need, nesting preserved. */
function sceneOf(scene, layers) {
  const sceneSlug = String(scene.slug || scene.fields?.slug || '')
  const fields = scene.fields || {}
  return {
    slug: sceneSlug,
    name: String(scene.name || sceneSlug),
    kind: String(fields.kind || ''),
    narration: String(scene.description || '').trim(),
    review: String(fields.review || ''),
    // The scene's own declarations; the resolved view is computed in loadEpisode.
    declared: { ...fields },
    fields: {},
    // Nested elements declare their parent; that link is the whole point of parsing here.
    layers: layers
      .filter((l) => l.parentSlug === sceneSlug)
      .map((l) => ({
        slug: String(l.slug || ''),
        type: String(l.fields?.type || ''),
        asset: String(l.fields?.asset || ''),
        text: String(l.fields?.text || ''),
        kind: layerKindOf(String(l.fields?.type || ''), l.fields),
        declared: { ...(l.fields || {}) },
        fields: {},
      })),
  }
}

async function loadEpisode(doc, cacheDir) {
  const content = await readFile(doc.file, 'utf8')
  const model = parseKnowledgeDocument(content)
  const video = (model.elements.Video || [])[0] || {}
  const layers = model.elements.Layer || []
  const scenes = (model.elements.Scene || []).map((s) => sceneOf(s, layers))

  // Resolve every asset once, here, where the episode folder is known.
  for (const scene of scenes) {
    for (const layer of scene.layers) {
      const asset = await inlineAsset({ episodeDir: doc.dir, cacheDir, relPath: layer.asset })
      layer.assetSrc = asset.src
      layer.assetKind = asset.kind
    }
  }

  // The cascade, resolved the way the engine resolves it: a Scene may override any Scene
  // field, and a Layer may override any field its type can use.
  const bags = loadCascadeBags(doc.dir)
  const videoBag = video.fields || {}
  for (const scene of scenes) {
    const layerBag = {}
    for (const layer of scene.layers) layerBag[layer.slug] = layer.declared
    const sceneBag = { ...bags, video: videoBag, scene: scene.declared }

    const types = new Set(scene.layers.map((l) => l.type))
    const hasNarration = scene.narration.length > 0
    scene.fields = {}
    for (const name of SCENE_FIELDS) {
      const needs = SCENE_FIELD_NEEDS[name]
      if (needs && !needs.some((need) => (need === 'narration' ? hasNarration : types.has(need)))) continue
      const resolved = resolveParam(name, sceneBag)
      scene.fields[name] = { value: resolved.value, source: resolved.source, local: scene.declared[name] ?? null }
    }
    scene.relevantFields = Object.keys(scene.fields).sort()

    for (const layer of scene.layers) {
      const fields = layerFieldsFor(layer.type)
      for (const name of fields) {
        const resolved = resolveParam(name, { ...sceneBag, layer: layer.declared })
        layer.fields[name] = {
          value: resolved.value,
          source: resolved.source,
          local: layer.declared[name] ?? null,
        }
      }
    }
  }

  return {
    slug: doc.slug,
    // The console payload addresses an element as <modelId>@<elementSlug>, so the view
    // needs the document stem to build a target that cannot collide with another episode.
    modelId: basename(doc.file).replace(/_NN\.md$/, ''),
    series: doc.series,
    title: String(video.fields?.title || video.name || doc.slug),
    status: String(video.fields?.status || ''),
    budget: video.fields?.budget ?? null,
    presets: video.fields?.presets ?? null,
    components: video.fields?.components ?? null,
    scenes,
  }
}

export async function collect({ rootDir } = {}) {
  const root = String(rootDir || '.')
  const factsDir = join(root, ...FACTS_DIR)
  const cacheDir = thumbCacheDir(root)
  const [ledger, timings, docs] = await Promise.all([
    readAll(factsDir, 'ledger'),
    readAll(factsDir, 'timings'),
    episodeDocs(root),
  ])

  const episodes = {}
  for (const doc of docs) {
    const episode = await loadEpisode(doc, cacheDir)
    // Every media file of the episode, so the review can offer what is not used yet.
    const mediaDir = join(doc.dir, 'media')
    const files = await readdir(mediaDir).catch(() => [])
    const used = new Set()
    for (const scene of episode.scenes) {
      for (const layer of scene.layers) if (layer.asset) used.add(layer.asset)
    }
    episode.media = []
    for (const name of files.sort()) {
      const asset = await inlineAsset({ episodeDir: doc.dir, cacheDir, relPath: 'media/' + name })
      episode.media.push({
        name,
        path: 'media/' + name,
        src: asset.src,
        kind: asset.kind,
        used: used.has('media/' + name),
      })
    }
    const facts = (episodes[episode.slug] = episode)
    facts.realUsd = 0
    facts.staleRows = []
    facts.timings = []
  }

  for (const row of ledger) {
    const entry = episodes[String(row.episode || '')]
    if (!entry) continue
    const usd = Number(row.estUsd)
    if (Number.isFinite(usd) && usd > 0) entry.realUsd = Math.round((entry.realUsd + usd) * 1e6) / 1e6
    const priceDate = row.price_date ? String(row.price_date) : ''
    if (priceDate && isPriceStale(priceDate)) {
      entry.staleRows.push({ priceDate, model: String(row.model || ''), usd: Number(usd) || 0 })
    }
  }
  for (const row of timings) {
    const entry = episodes[String(row.episode || '')]
    if (!entry) continue
    entry.timings.push({
      stage: String(row.stage || ''),
      durationMs: Number(row.duration_ms) || 0,
      fingerprint: String((row.machine && row.machine.fp) || ''),
    })
  }

  return { episodes }
}
