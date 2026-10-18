#!/usr/bin/env node
/**
 * scripts/export-console.mjs — `nn export`
 *
 * Unified console artifact export (backlog: feature/console-artifact-export-cli).
 *
 * Scans a workspace for iNNfo Level-3 models and compiles ONE self-contained
 * console (bundle, CSS, views and JSON slots inlined) against the canonical
 * console shell (`iNNfo/specs/bluepriNNts/console/artifact_shell.html`), filling
 * the `innfo-config` / `innfo-schema` / `innfo-model` slots from a direct model
 * scan (no runtime dependency on innfo-core, whose raw `dist/` barrel is not
 * ESM-importable). There is no per-model console: every console is the domain
 * console, optionally scoped to a model subset or a single view.
 *
 * Usage:
 *   node scripts/export-console.mjs <workspaceRoot> --status
 *   node scripts/export-console.mjs <workspaceRoot> --tree
 *   node scripts/export-console.mjs <workspaceRoot> --list
 *   node scripts/export-console.mjs <workspaceRoot> --domain [--no-open]
 *   node scripts/export-console.mjs <workspaceRoot> --all [--no-open]
 *   node scripts/export-console.mjs <workspaceRoot> --stale [--no-open]
 *   node scripts/export-console.mjs <workspaceRoot> --filter <pattern> [--no-open]
 *   node scripts/export-console.mjs <workspaceRoot> <ModelNameSubstring> [--no-open]
 *
 * Output (single writer `writeConsole`, shared with the MCP):
 *   `--domain` (no selection) writes ONE fixed-name file at the domain root:
 *   <workspaceRoot>/domaiNN_console.html.
 *   A selection (`<ModelName>`, `--filter`, `--all`, `--stale`) writes ONE stable file
 *   <workspaceRoot>/artifacts/<scope>_console/<scope>_console.html; the scope key is
 *   the single model's stem or `<firstStem>-plus<N-1>-<hash6>`.
 *   Both are replaced through a temporary file and a rename, and only when their
 *   bytes move. A lone `--view` still writes a write-once family under
 *   `artifacts/<view>_view/` (or `artifacts/<view>-<scope>_view/`).
 * After a write the console is opened in a browser (detached) unless `--no-open`.
 *
 * Importing this module has no side effect: the CLI runs only as the entry point.
 */

import { readdir, readFile, writeFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { existsSync, realpathSync } from 'node:fs'
import { join, relative, basename, resolve, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const req = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const repoConsoleDir = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')

const SHELL_FILENAME = 'artifact_shell.html'
const LEGACY_SHELL_FILENAME = 'artifact_blueprint.html'

/** A failure the caller can report: `code` is stable, `message` is human-readable. */
export class ConsoleExportError extends Error {
  constructor(message, code = 'CONSOLE_EXPORT_FAILED') {
    super(message)
    this.name = 'ConsoleExportError'
    this.code = code
  }
}

function findShell(dir) {
  return [SHELL_FILENAME, LEGACY_SHELL_FILENAME]
    .map((name) => join(dir, name))
    .find((p) => existsSync(p))
}

/** Console asset folder: `$INNFO_CONSOLE_DIR`, the repo checkout, this script's own folder, then `~/.agents/console`. */
function resolveConsoleDir() {
  return (
    [process.env.INNFO_CONSOLE_DIR, repoConsoleDir, here, join(homedir(), '.agents', 'console')]
      .filter(Boolean)
      .find((dir) => findShell(dir)) || repoConsoleDir
  )
}

/** The console payload mirror (single innfo-core build shared by every producer). */
let payloadHelper = null

function loadPayloadHelper(consoleDir) {
  const candidates = process.env.INNFO_CONSOLE_DIR
    ? [join(consoleDir, 'console-payload.generated.cjs')]
    : [
        join(consoleDir, 'console-payload.generated.cjs'),
        join(repoConsoleDir, 'console-payload.generated.cjs'),
      ]
  for (const c of candidates) {
    if (existsSync(c)) {
      try {
        return req(c)
      } catch (err) {
        throw new ConsoleExportError(
          `Error loading console payload mirror from ${c}: ${err.message}`,
          'CONSOLE_ASSETS_NOT_FOUND',
        )
      }
    }
  }
  throw new ConsoleExportError(
    `Console payload mirror not found at ${candidates[0]}.\n` +
      'Build it with "node scripts/build-console-payload.mjs" or install console assets.',
    'CONSOLE_ASSETS_NOT_FOUND',
  )
}

/**
 * Resolve the console assets and load the payload mirror. Throws a
 * `ConsoleExportError` with code `CONSOLE_ASSETS_NOT_FOUND` when they are missing;
 * never exits the process.
 */
async function ensureAssets() {
  const consoleDir = resolveConsoleDir()
  const shellPath = findShell(consoleDir) || join(consoleDir, SHELL_FILENAME)
  const bundlePath = join(consoleDir, 'innfo-console.bundle.js')
  if (!existsSync(shellPath)) {
    throw new ConsoleExportError(
      `Console assets not found: ${shellPath}\n` +
        'Install the console assets (skills-manager install) or set INNFO_CONSOLE_DIR to ' +
        'the folder holding artifact_shell.html and innfo-console.bundle.js.',
      'CONSOLE_ASSETS_NOT_FOUND',
    )
  }
  payloadHelper = loadPayloadHelper(consoleDir)
  return { consoleDir, shellPath, bundlePath }
}

function computeSha256(content) {
  return payloadHelper?.computeSha256
    ? payloadHelper.computeSha256(content)
    : createHash('sha256').update(content, 'utf8').digest('hex')
}

function parseConsoleCdnRef(bundleText) {
  const m = bundleText && bundleText.match(/\bVersion (\d+\.\d+\.\d+)\./)
  return m ? `innfo-console-v${m[1]}` : null
}

/** @type {readonly ['table', 'kpi', 'dashboard', 'blank']} */
const VIEW_TEMPLATES = ['table', 'kpi', 'dashboard', 'blank']

function parseArgs(argv) {
  const args = {
    root: null,
    list: false,
    status: false,
    tree: false,
    all: false,
    stale: false,
    domain: false,
    view: null,
    viewMissing: false,
    newView: null,
    template: 'table',
    blueprint: null,
    title: null,
    filter: null,
    model: null,
    open: true,
  }
  const slice = argv.slice(2)
  for (let i = 0; i < slice.length; i++) {
    const a = slice[i]
    if (a === '--list') {
      args.list = true
    } else if (a === '--status') {
      args.status = true
    } else if (a === '--tree') {
      args.tree = true
    } else if (a === '--all') {
      args.all = true
    } else if (a === '--stale') {
      args.stale = true
    } else if (a === '--domain') {
      args.domain = true
    } else if (a === '--no-open') {
      args.open = false
    } else if (a === '--new-view') {
      i++
      if (i < slice.length && !slice[i].startsWith('--')) args.newView = slice[i]
    } else if (a === '--template') {
      i++
      if (i < slice.length && !slice[i].startsWith('--')) args.template = slice[i]
    } else if (a === '--blueprint') {
      i++
      if (i < slice.length && !slice[i].startsWith('--')) args.blueprint = slice[i]
    } else if (a === '--title') {
      i++
      if (i < slice.length && !slice[i].startsWith('--')) args.title = slice[i]
    } else if (a === '--view') {
      i++
      if (i < slice.length && !slice[i].startsWith('--')) args.view = slice[i]
      else {
        args.viewMissing = true
        if (i < slice.length) i--
      }
    } else if (a === '--filter') {
      i++
      if (i < slice.length) {
        args.filter = slice[i]
      }
    } else if (args.root === null) {
      args.root = a
    } else {
      args.model = a
    }
  }
  return args
}

/** Recursively find every non-sidecar `*_NN.md` file under `dir`, skipping heavy dirs. */
async function findModelFiles(dir) {
  const out = []
  const skip = new Set(['node_modules', '.git', '.cogNNitive', 'artifacts', 'dist', 'docs'])
  async function walk(d) {
    let entries
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skip.has(e.name)) await walk(join(d, e.name))
      } else if (
        e.isFile() &&
        payloadHelper.isNNName(e.name) &&
        !payloadHelper.isSidecarName(e.name)
      ) {
        out.push(join(d, e.name))
      }
    }
  }
  await walk(dir)
  return out
}

function frontmatterOf(content) {
  if (payloadHelper?.parseFrontmatter) {
    try {
      return payloadHelper.parseFrontmatter(content)
    } catch {
      // fallback
    }
  }
  const normalized = content.replace(/\r\n/g, '\n')
  const fm = normalized.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) return {}
  const out = {}
  for (const line of fm[1].split('\n')) {
    const m = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/)
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').trim()
  }
  return out
}

/** A console model is a `knowledge` model or a `procedures` model (never a
 * `procedures/` submodel). See `isConsoleModel` in the naming contract. */
function isModelDocument(relPath, content) {
  return payloadHelper.isConsoleModel({ path: relPath, frontmatter: frontmatterOf(content) })
}

function isLevel3(content) {
  const fm = frontmatterOf(content)
  const lvl = fm.level
  return lvl === undefined || Number(lvl) === 3
}

function extractModelMetaFromHtml(htmlContent) {
  const match = htmlContent.match(
    /<script type="application\/json" id="innfo-model">([\s\S]*?)<\/script>/,
  )
  if (!match) return null
  try {
    const data = JSON.parse(match[1])
    return data?.meta ?? null
  } catch {
    return null
  }
}

/** Workspace-relative members of the family `(dir, key, ext)`, via the core name contract. */
async function familyMembers(rootDir, dir, key, ext) {
  let names
  try {
    names = await readdir(join(rootDir, dir))
  } catch {
    return []
  }
  return names
    .filter((n) => {
      const parsed = payloadHelper.parseName(n)
      return parsed.kind === 'file' && parsed.key === key && parsed.ext === ext
    })
    .map((n) => ({ path: `${dir}/${n}` }))
}

/** Deterministic hex slice of the SHA-256 of a string. */
const hashSlice = (text, len) =>
  createHash('sha256').update(text, 'utf8').digest('hex').slice(0, len)

/**
 * Every console HTML that can report model status: `domaiNN_console.html` plus the
 * stable file of every `artifacts/<key>_console/` folder. A console lists the models it
 * covers in `meta.models`; a folder without its stable file (old stamped leftovers) is inert.
 */
async function statusConsoles(rootDir) {
  const out = []
  const read = async (relPath) => {
    try {
      const meta = extractModelMetaFromHtml(await readFile(join(rootDir, relPath), 'utf-8'))
      if (meta) out.push({ path: relPath, meta })
    } catch {
      /* an unreadable console is ignored, never crashes status */
    }
  }
  if (existsSync(join(rootDir, 'domaiNN_console.html'))) await read('domaiNN_console.html')
  let entries = []
  try {
    entries = await readdir(join(rootDir, 'artifacts'), { withFileTypes: true })
  } catch {
    entries = []
  }
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.endsWith('_console')) continue
    const rel = `artifacts/${e.name}/${e.name}.html`
    if (existsSync(join(rootDir, rel))) await read(rel)
  }
  return out
}

/**
 * Status of one model against the newest console whose `meta.models` lists it (by
 * `filePath`), comparing the recorded `sha256` and `version`.
 */
async function inspectModelStatus(model, rootDir, consoles) {
  const relPath = relative(rootDir, model.filePath).replace(/\\/g, '/')
  const fileName = basename(relPath)
  const lists = (c) =>
    Array.isArray(c.meta.models) &&
    c.meta.models.some((mm) => mm && (mm.filePath === fileName || mm.filePath === relPath))
  const listing = (consoles || [])
    .filter(lists)
    .sort((a, b) => String(b.meta.generated || '').localeCompare(String(a.meta.generated || '')))

  if (listing.length === 0) {
    return { status: 'uncompiled', targetHtmlPath: join(rootDir, 'domaiNN_console.html') }
  }
  const newest = listing[0]
  const targetHtmlPath = join(rootDir, newest.path)
  const entry = newest.meta.models.find((mm) => mm.filePath === fileName || mm.filePath === relPath)

  const currentVersion = String(model.fm.knowledge_version ?? 'V_0-1-0')
  if (entry.version && entry.version !== currentVersion) {
    return { status: 'version_mismatch', targetHtmlPath, embeddedMeta: newest.meta }
  }
  if (entry.sha256 && entry.sha256 === computeSha256(model.content)) {
    return { status: 'fresh', targetHtmlPath, embeddedMeta: newest.meta }
  }
  return { status: 'stale', targetHtmlPath, embeddedMeta: newest.meta }
}

/**
 * Freshness of the domain console: `uncompiled` when the file is absent, `fresh` when
 * every live model appears in the embedded `meta.models` with the same
 * `knowledge_version` and content `sha256` (and nothing else is embedded), else `stale`.
 */
async function inspectDomainConsole(models, rootDir) {
  const file = join(rootDir, payloadHelper.consoleOutputPath('domain'))
  if (!existsSync(file)) return 'uncompiled'
  let embedded
  try {
    const fileStat = await stat(file)
    try {
      const { bundlePath, shellPath } = await ensureAssets()
      if (existsSync(bundlePath)) {
        const bundleStat = await stat(bundlePath)
        if (bundleStat.mtimeMs > fileStat.mtimeMs + 2000) return 'stale'
      }
      if (existsSync(shellPath)) {
        const shellStat = await stat(shellPath)
        if (shellStat.mtimeMs > fileStat.mtimeMs + 2000) return 'stale'
      }
    } catch {
      /* ignore asset stat failures */
    }
    embedded = extractModelMetaFromHtml(await readFile(file, 'utf-8'))?.models
  } catch {
    return 'stale'
  }
  if (!Array.isArray(embedded) || embedded.length !== models.length) return 'stale'
  for (const m of models) {
    const relPath = relative(rootDir, m.filePath).replace(/\\/g, '/')
    const fileName = basename(relPath)
    const entry = embedded.find((e) => e && (e.filePath === fileName || e.filePath === relPath))
    if (!entry) return 'stale'
    if ((entry.version ?? null) !== (m.fm.knowledge_version || null)) return 'stale'
    if (entry.sha256 !== computeSha256(m.content)) return 'stale'
  }
  return 'fresh'
}

/** Scope family key: one model `<stem>`; several `<firstStem>-plus<N-1>-<hash6>`. */
function scopeKeyOf(selected, rootDir) {
  if (selected.length === 1) return selected[0].name
  const rels = selected.map((m) => relative(rootDir, m.filePath).replace(/\\/g, '/')).sort()
  return `${selected[0].name}-plus${selected.length - 1}-${hashSlice(rels.join('\n'), 6)}`
}

/** Human-readable scope label: `A, B` for a couple, `<first> + N more` beyond. */
function scopeLabelOf(selected) {
  const titles = selected.map((m) => String(m.fm.title || m.name))
  return titles.length <= 2 ? titles.join(', ') : `${titles[0]} + ${titles.length - 1} more`
}

async function renderTree(models, root, consoles) {
  const groups = new Map()
  for (const m of models) {
    const rel = relative(root, m.filePath).replace(/\\/g, '/')
    const dir = dirname(rel)
    const dirKey = dir === '.' ? '.' : dir + '/'
    if (!groups.has(dirKey)) groups.set(dirKey, [])
    const statusInfo = await inspectModelStatus(m, root, consoles)
    groups.get(dirKey).push({ model: m, rel, statusInfo })
  }

  console.log(`Workspace: . (${models.length} Level-3 models)`)
  const dirKeys = Array.from(groups.keys())
  for (let i = 0; i < dirKeys.length; i++) {
    const dirKey = dirKeys[i]
    const isLastDir = i === dirKeys.length - 1
    const dirPrefix = isLastDir ? '└── ' : '├── '
    const childIndent = isLastDir ? '    ' : '│   '

    if (dirKey === '.') {
      const items = groups.get(dirKey)
      for (let j = 0; j < items.length; j++) {
        const item = items[j]
        const isLastItem = j === items.length - 1
        const itemPrefix = isLastItem ? '└── ' : '├── '
        const fileIndent = isLastItem ? '    ' : '│   '
        console.log(`${itemPrefix}${basename(item.model.filePath)} [${item.statusInfo.status}]`)
        const targetRel = relative(root, item.statusInfo.targetHtmlPath).replace(/\\/g, '/')
        console.log(`${fileIndent}└── ${targetRel}`)
      }
    } else {
      console.log(`${dirPrefix}${dirKey}`)
      const items = groups.get(dirKey)
      for (let j = 0; j < items.length; j++) {
        const item = items[j]
        const isLastItem = j === items.length - 1
        const itemPrefix = isLastItem ? '└── ' : '├── '
        const fileIndent = isLastItem ? '    ' : '│   '
        console.log(
          `${childIndent}${itemPrefix}${basename(item.model.filePath)} [${item.statusInfo.status}]`,
        )
        const targetRel = relative(root, item.statusInfo.targetHtmlPath).replace(/\\/g, '/')
        console.log(`${childIndent}${fileIndent}└── ${targetRel}`)
      }
    }
  }
}

function injectSlots(shell, config, schema, model) {
  const serialize = payloadHelper?.serializeConsoleSlot
    ? (json) => payloadHelper.serializeConsoleSlot(json)
    : (json) => JSON.stringify(json, null, 2).replace(/</g, '\\u003c')
  const slot = (html, id, json) =>
    html.replace(
      new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`),
      (_m, open, close) => `${open}\n${serialize(json)}\n${close}`,
    )
  return slot(
    slot(slot(shell, 'innfo-config', config), 'innfo-schema', schema),
    'innfo-model',
    model,
  )
}

// Image fields hold asset paths relative to the domain (or repo) root, but a
// console is written at a different depth: the domain console sits at the root,
// a stamped console under artifacts/<stem>_console/. Each file therefore needs
// its own rebase, or the thumbnail 404s under file://.
const IMAGE_ASSET_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i

// Field types whose value is a local file the console opens or plays.
const FILE_FIELD_TYPES = new Set(['image', 'video', 'audio', 'file'])

// Each path segment is percent-encoded so spaces, '#' and '?' in a file name survive
// as a URL; the '/' separators stay.
function relativeToOutDir(abs, outDirAbs) {
  const rel = relative(outDirAbs, abs)
    .split(/[\/\\]/)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return rel.startsWith('.') ? rel : './' + rel
}

function lexicallyInside(abs, rootAbs) {
  const rel = relative(rootAbs, abs)
  return rel !== '' && !isAbsolute(rel) && !/^\.\.([\/\\]|$)/.test(rel)
}

// True when abs is inside the domain root (false across drives on Windows). An
// existing path is also checked by real path, so a link inside the root that points
// outside it does not count as inside.
function isInsideRoot(abs, rootAbs) {
  if (!lexicallyInside(abs, rootAbs)) return false
  if (!existsSync(abs)) return true
  try {
    return lexicallyInside(realpathSync(abs), realpathSync(rootAbs))
  } catch {
    return false
  }
}

// A declared file value that is not on disk is only rebased when it reads like a
// path: a file extension or an explicit relative prefix. Free text such as TBD or
// n/a stays untouched.
function looksLikePath(s) {
  return /\.[A-Za-z0-9]{1,8}$/.test(s) || /^\.{1,2}[\/\\]/.test(s)
}

// Element-relative values (e.g. a visual-catalog `image`) live under
// <modelDir>/assets/<element-slug>/; those bases are tried before the root ones.
function elementAssetBases(el, rootAbs) {
  const slug = el && (el.slug || (el.fields && el.fields.slug))
  if (!slug) return []
  const dirs = el.modelDir != null ? [String(el.modelDir)] : []
  dirs.push('kNNowledge', 'models')
  return dirs.map((d) => resolve(rootAbs, d, 'assets', String(slug)))
}

// `declared` is true for a field declared image/video/audio/file: any local value is
// rebased (to the domain root when no candidate exists on disk); undeclared values
// keep the image-shaped, must-exist rule.
function rebaseAssetValue(value, outDirAbs, rootAbs, declared = false, el = null) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || /^(data:|blob:|https?:|file:)/i.test(trimmed)) return value
  if (declared && (trimmed.startsWith('[[') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed))) return value
  if (!declared && !IMAGE_ASSET_RE.test(trimmed)) return value
  const elementBases = declared ? elementAssetBases(el, rootAbs) : []
  for (const base of [...elementBases, rootAbs, repoRoot, process.cwd()]) {
    const abs = resolve(base, trimmed)
    if (existsSync(abs) && isInsideRoot(abs, rootAbs)) return relativeToOutDir(abs, outDirAbs)
  }
  if (!declared || !looksLikePath(trimmed)) return value
  const fallback = resolve(rootAbs, trimmed)
  return isInsideRoot(fallback, rootAbs) ? relativeToOutDir(fallback, outDirAbs) : value
}

// Citation entries keep their domain-relative `path`; a resolved one (a path and no
// error) gains an `href` to the source file, relative to the console file.
function withCitationHrefs(citations, outDirAbs, rootAbs) {
  if (!citations || typeof citations !== 'object') return citations
  const next = {}
  for (const [field, list] of Object.entries(citations)) {
    next[field] = Array.isArray(list)
      ? list.map((c) =>
          c &&
          c.path &&
          !c.error &&
          !/^[a-z][a-z0-9+.-]*:/i.test(String(c.path)) &&
          isInsideRoot(resolve(rootAbs, String(c.path)), rootAbs)
            ? { ...c, href: relativeToOutDir(resolve(rootAbs, String(c.path)), outDirAbs) }
            : c,
        )
      : list
  }
  return next
}

function rebaseModelAssets(model, outDirAbs, rootAbs, schema) {
  if (!model || !Array.isArray(model.elements)) return model
  const declaredFile = new Set()
  for (const f of Array.isArray(schema && schema.fields) ? schema.fields : []) {
    if (f && FILE_FIELD_TYPES.has(String(f.type || '').toLowerCase())) {
      declaredFile.add(`${String(f.concept).toLowerCase()}\u0000${String(f.name).toLowerCase()}`)
    }
  }
  return {
    ...model,
    elements: model.elements.map((el) => {
      if (!el) return el
      let out = el
      if (el.fields && typeof el.fields === 'object') {
        const fields = { ...el.fields }
        // The document text of every rebased value, so a draft's original still
        // matches the file (the rebased one is a display value only).
        const rawFields = {}
        let changed = false
        for (const [k, v] of Object.entries(fields)) {
          const declared = declaredFile.has(
            `${String(el.concept).toLowerCase()}\u0000${k.toLowerCase()}`,
          )
          const next = rebaseAssetValue(v, outDirAbs, rootAbs, declared, el)
          if (next !== v) {
            fields[k] = next
            rawFields[k] = v
            changed = true
          }
        }
        if (changed) out = { ...out, fields, rawFields }
      }
      if (el.citations && typeof el.citations === 'object') {
        out = { ...out, citations: withCitationHrefs(el.citations, outDirAbs, rootAbs) }
      }
      return out
    }),
  }
}

/** Console HTML for one model: the bundle name is injected so each console loads its own pinned bundle. */
function renderConsole(shell, bundleName, config, payload, outDirAbs, rootAbs) {
  const pinned = bundleName ? shell.replace('./innfo-console.bundle.js', `./${bundleName}`) : shell
  const model =
    outDirAbs && rootAbs
      ? rebaseModelAssets(payload.model, outDirAbs, rootAbs, payload.schema)
      : payload.model
  return injectSlots(pinned, config, payload.schema, model)
}

/* ── Opening the console ───────────────────────────────────────── */

/** Platform command that opens `file` in the default browser, or null when unsupported. */
export function openCommandFor(platform, file) {
  if (platform === 'win32') return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', file] }
  if (platform === 'darwin') return { command: 'open', args: [file] }
  if (platform === 'linux') return { command: 'xdg-open', args: [file] }
  return null
}

/** Default launcher: a detached, unref-ed child that never keeps this process alive. */
async function defaultLauncher(command, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolvePromise()
    })
  })
}

/** Open `file` when `open` is true. Never throws: failures come back as `opened: false` + `openError`. */
async function openConsole(file, { open, launcher, platform }) {
  if (!open) return { opened: false }
  const cmd = openCommandFor(platform, file)
  if (!cmd) {
    return { opened: false, openError: `Opening a browser is not supported on platform "${platform}".` }
  }
  // Defence in depth: refuse shell-significant characters instead of launching.
  if (platform === 'win32' && /[&^%|<>"]/.test(file)) {
    return { opened: false, openError: `Refusing to open a path with shell-significant characters: ${file}` }
  }
  try {
    await (launcher ?? defaultLauncher)(cmd.command, cmd.args)
    return { opened: true }
  } catch (err) {
    return { opened: false, openError: String(err?.message ?? err) }
  }
}

/* ── Model discovery ───────────────────────────────────────────── */

async function loadModels(root) {
  const models = []
  for (const f of await findModelFiles(root)) {
    const content = await readFile(f, 'utf-8')
    if (isModelDocument(relative(root, f).replace(/\\/g, '/'), content) && isLevel3(content)) {
      const stem = payloadHelper.displayStem(basename(f))
      models.push({
        filePath: f,
        name: stem,
        content,
        fm: frontmatterOf(content),
      })
    }
  }
  models.sort((a, b) => (a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0))
  return models
}

/** Atomic replace: write `<file>.tmp`, then rename it over `file`. */
async function writeFileAtomic(file, text) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tmp, text, 'utf-8')
    await rename(tmp, file)
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

/** Per-model `knowledge_version` + content `sha256` embedded in the console meta, keyed by model id. */
function versionsOf(modelSummaries) {
  const out = {}
  for (const s of modelSummaries) out[s.id] = { knowledge_version: s.version, sha256: s.sha256 }
  return out
}

/**
 * The single console writer, shared by the CLI and the MCP.
 *
 * Options: rootDir (domain root); scope ("domain" by default, { model: id } for one
 * model, or { selected: models } for the CLI multi-model selection); view (a lone view
 * export, written as a write-once family); open (default true); launcher (injected
 * opener, for tests); platform (default process.platform); log (progress lines,
 * default silent so the MCP never writes to stdout); models (pre-scanned models).
 *
 * Resolves to { path, relativePath, status ("written" or "unchanged"),
 * knowledgeVersions, opened, openError, breakdown, summary }. Throws ConsoleExportError.
 */
export async function writeConsole(opts = {}) {
  const {
    rootDir,
    scope = 'domain',
    view = null,
    open = true,
    launcher,
    platform = process.platform,
    log = () => {},
  } = opts
  if (!rootDir) throw new ConsoleExportError('writeConsole needs a rootDir.', 'ROOT_REQUIRED')
  const root = resolve(rootDir)
  const { consoleDir, shellPath, bundlePath } = await ensureAssets()
  const shell = await readFile(shellPath, 'utf-8')
  const bundle = existsSync(bundlePath) ? await readFile(bundlePath, 'utf-8') : null

  const models = opts.models ?? (await loadModels(root))

  const wholeDomain = scope === 'domain'
  let selected = []
  if (!wholeDomain) {
    if (Array.isArray(scope.selected)) {
      selected = scope.selected
    } else if (typeof scope.model === 'string') {
      const wanted = scope.model
      selected = models.filter(
        (m) => m.name === wanted || basename(m.filePath).replace(/\.[^/.]+$/, '') === wanted,
      )
      if (selected.length === 0) {
        throw new ConsoleExportError(`No model "${wanted}" found in ${root}.`, 'MODEL_NOT_FOUND')
      }
    } else {
      throw new ConsoleExportError('Unsupported console scope.', 'SCOPE_INVALID')
    }
    if (selected.length === 0) {
      throw new ConsoleExportError('No models selected.', 'MODEL_NOT_FOUND')
    }
  }
  const scoped = !wholeDomain
  const payloadModels = wholeDomain ? models : selected

  const consoleCdnRef = parseConsoleCdnRef(bundle)
  if (!consoleCdnRef) {
    throw new ConsoleExportError(
      `Cannot derive console CDN pin: no "Version X.Y.Z." banner found in ${bundlePath}`,
      'CONSOLE_ASSETS_NOT_FOUND',
    )
  }

  // The shell ships a release-pinned CDN ref (e.g. @innfo-console-v0.1.0) in its
  // default config and static <script> tags. Those tags are not injectSlots targets, so
  // normalize every occurrence to the ref derived from the vendored bundle banner —
  // otherwise a generated console loads a stale bundle version first (#95).
  const resolvedShell = shell.replace(/@innfo-console-v\d+\.\d+\.\d+/g, `@${consoleCdnRef}`)

  // The single shell inlines its bundle, CSS and views, so every export — scoped or
  // whole-domaiNN — needs the sibling view lib and the CSS. A bad view or a missing
  // asset is reported before anything is written.
  const viewsLibUrl = new URL('./console-views.mjs', import.meta.url).href
  let viewsLib
  try {
    viewsLib = await import(viewsLibUrl)
  } catch (err) {
    // Only the lib itself being absent is reported here; a missing module imported
    // from inside it (err.url is that module) is a real fault and must surface.
    if (err.code !== 'ERR_MODULE_NOT_FOUND' || err.url !== viewsLibUrl) throw err
    throw new ConsoleExportError(
      `console-views.mjs must sit next to this script (${fileURLToPath(viewsLibUrl)}).`,
      'CONSOLE_ASSETS_NOT_FOUND',
    )
  }
  // Where bluepriNNt packages (and their console views) live. In a repo checkout the
  // console dir sits inside the packages folder; an installed set is flat in
  // ~/.agents/console and the packages are installed beside it in ~/.agents/bluepriNNts.
  const packagesDir =
    process.env.INNFO_BLUEPRINTS_DIR ||
    (consoleDir === repoConsoleDir ? dirname(consoleDir) : join(homedir(), '.agents', 'bluepriNNts'))
  const uiCssPath = join(consoleDir, 'innfo-ui.css')
  if (!existsSync(uiCssPath)) {
    throw new ConsoleExportError(
      `${uiCssPath} not found; the console inlines its CSS.`,
      'CONSOLE_ASSETS_NOT_FOUND',
    )
  }
  const uiCss = await readFile(uiCssPath, 'utf-8')

  // Changeset lineage: read changes/*_changes_NN.md so each element can carry its
  // history in the model slot, and the domain payload carries the changes
  // collection (the console is static/offline and never reads the files).
  const changesets = payloadHelper.loadChangesetRecords
    ? await payloadHelper.loadChangesetRecords(root)
    : []

  let domainViews
  try {
    domainViews = await viewsLib.discoverViews({
      domainRoot: root,
      // The domain's changesets are not payload models, but the changes blueprint
      // ships the read-only Changes view: include its spec name when a domain has any.
      specNames: [
        ...payloadModels.map((m) => payloadHelper.parentSpecNameOf(m.fm)),
        ...(Array.isArray(changesets) && changesets.length > 0 ? ['changes'] : []),
      ].filter(Boolean),
      packagesDir,
      onWarning: (message) => process.stderr.write(`WARNING: [export-console] ${message}\n`),
    })
  } catch (err) {
    throw new ConsoleExportError(err.message, 'VIEWS_INVALID')
  }
  if (view) {
    const wanted = domainViews.find((v) => v.id === view)
    if (!wanted) {
      const ids = domainViews.map((v) => v.id)
      throw new ConsoleExportError(
        `unknown view "${view}"; available views: ${ids.length ? ids.join(', ') : '(none)'}`,
        'VIEW_UNKNOWN',
      )
    }
    domainViews = [wanted]
  }
  let preparedAssets
  try {
    preparedAssets = viewsLib.assertInlinable(resolvedShell, { bundle, css: uiCss, views: domainViews })
  } catch (err) {
    throw new ConsoleExportError(err.message, 'VIEWS_INVALID')
  }

  const config = {
    needs: [
      'concept-rail',
      'fulltext-search',
      'matrix-grids',
      'hash-routing',
      'reference-popup',
      'document-view',
      'feedback-export',
    ],
    runtime: {
      cdn: `https://cdn.jsdelivr.net/gh/cogNNitive/cogNNitive@${consoleCdnRef}/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js`,
      fallback:
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js',
    },
  }

  const resolver = payloadHelper.createFsSourceResolver
    ? payloadHelper.createFsSourceResolver(root)
    : undefined

  // Single shared schema path (innfo-core) — the same helper the console payload
  // mirror uses, so every producer emits byte-identical slots.
  const resolveModelSchema = async (content) => {
    const fm = frontmatterOf(content)
    if (!fm?.parent_spec?.name) return { schema: undefined, procedures: [] }
    try {
      const resolution = await payloadHelper.resolveConsoleSchema({
        rootDir: root,
        parentName: fm.parent_spec.name,
        parentUrl: fm.parent_spec.url,
      })
      for (const warning of resolution.warnings) {
        process.stderr.write(`WARNING: [export-console] ${warning}\n`)
      }
      return { schema: resolution.schema, procedures: resolution.procedures }
    } catch (err) {
      process.stderr.write(
        `WARNING: [export-console] Schema resolution failed: ${err?.message ?? err}\n`,
      )
      return { schema: undefined, procedures: [] }
    }
  }

  // Aggregate the scoped (or whole-domaiNN) payload. The single shell keys drafts,
  // review marks and relations by id, so element ids are qualified with the model id.
  const allElements = []
  const allMatrices = []
  const allConcepts = []
  const seenConcepts = new Set()
  const allFields = []
  // Marker and matrix definitions (widgetType, values) so the matrix-cell editor can
  // constrain a cell; first declaration per name wins, like concepts.
  const allMarkers = []
  const allMatrixDecls = []
  const seenMarkers = new Set()
  const seenMatrixDecls = new Set()
  const fieldIndex = new Map()
  const allProcedures = []
  const seenProcedureIds = new Set()
  const modelSummaries = []
  const scopeModelIds = []
  // Distinct sources cited across every model in the domain (for `meta.domain.sourceCount`).
  const domainSources = new Set()
  // The changes bluepriNNt version every model payload was built against (identical across models).
  let changesBlueprintVersion = ''

  for (const m of payloadModels) {
    const relPath = relative(root, m.filePath).replace(/\\/g, '/')
    const fileName = basename(relPath)
    const modelStem = fileName.replace(/\.[^/.]+$/, '')
    const modelSchemaResolution = await resolveModelSchema(m.content)
    const payload = payloadHelper.buildConsolePayload({
      content: m.content,
      path: relPath,
      resolver,
      changesets,
      schema: modelSchemaResolution.schema,
      procedures: modelSchemaResolution.procedures,
    })
    if (payload && payload.model) {
      changesBlueprintVersion = (payload.model.meta && payload.model.meta.changesBlueprintVersion) || changesBlueprintVersion
      for (const s of (payload.model.meta && payload.model.meta.sources) || []) {
        if (typeof s === 'string' && s) domainSources.add(s)
      }
      const mTitle = (payload.model.meta && (payload.model.meta.title || payload.model.meta.model)) || modelStem
      const mId = (payload.model.meta && payload.model.meta.modelId) || modelStem
      const modelConcepts = new Set()
      // Element ids are only unique inside one model; the console keys drafts,
      // review marks and relations by id, so qualify them with the model id (the
      // model part of a changeset target), making the id the D5 element address.
      const qualifiedIds = new Map()
      if (Array.isArray(payload.model.elements)) {
        for (const el of payload.model.elements) {
          if (el) qualifiedIds.set(el.id, `${mId}@${el.id}`)
        }
        for (const el of payload.model.elements) {
          if (el) {
            el.id = qualifiedIds.get(el.id)
            if (Array.isArray(el.relations)) {
              for (const rel of el.relations) {
                if (rel && qualifiedIds.has(rel.target)) rel.target = qualifiedIds.get(rel.target)
              }
            }
            el.modelId = mId
            el.modelTitle = mTitle
            el.modelFile = fileName
            el.modelDir = dirname(relPath)
            const cName = el.concept || 'Element'
            const eName = el.name || el.id || ''
            el.location = `${fileName}@## ${cName}: ${eName}`
            allElements.push(el)
            if (el.concept) modelConcepts.add(el.concept)
          }
        }
      }
      if (Array.isArray(payload.model.matrices)) {
        for (const mat of payload.model.matrices) {
          if (mat) {
            mat.modelId = mId
            mat.modelTitle = mTitle
            mat.modelFile = fileName
            allMatrices.push(mat)
          }
        }
      }
      const blueprintName = payloadHelper.parentSpecNameOf(m.fm)
      const blueprintParsed = blueprintName ? viewsLib.parseSpecName(blueprintName) : null
      const blueprintFamily =
        blueprintParsed && blueprintParsed.base
          ? String(blueprintParsed.base)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
          : null
      // Per-model change count comes from the domain's changesets (the only change
      // record), matched by the model part of each change's D5 target.
      const modelKeys = [mTitle, mId, modelStem].map(function (v) {
        return String(v || '').toLowerCase()
      })
      const changeCount = (Array.isArray(changesets) ? changesets : []).reduce(function (n, cs) {
        const items = cs && Array.isArray(cs.changes) ? cs.changes : []
        return (
          n +
          items.filter(function (c) {
            if (!c || !c.target) return false
            const t = String(c.target)
            const at = t.indexOf('@')
            const modelPart = (at === -1 ? t : t.slice(0, at)).trim().toLowerCase()
            return modelPart !== '' && modelKeys.indexOf(modelPart) !== -1
          }).length
        )
      }, 0)
      modelSummaries.push({
        id: mId,
        title: mTitle,
        filePath: fileName,
        blueprint: blueprintParsed ? blueprintParsed.base : null,
        family: blueprintFamily,
        version: (m.fm && m.fm.knowledge_version) || null,
        sha256: (payload.model.meta && payload.model.meta.sha256) || computeSha256(m.content),
        citationsResolvedAt:
          (payload.model.meta && payload.model.meta.citationsResolvedAt) || null,
        sources: (payload.model.meta && payload.model.meta.sources) || [],
        changeCount: changeCount,
        conceptNames: Array.from(modelConcepts),
        elementCount: Array.isArray(payload.model.elements) ? payload.model.elements.length : 0,
      })
      scopeModelIds.push(mId)
    }
    if (payload && payload.schema) {
      if (Array.isArray(payload.schema.concepts)) {
        for (const c of payload.schema.concepts) {
          if (c && c.name) {
            const key = `${(c.declaredBy && c.declaredBy.family) || ''}\u0000${String(c.name).toLowerCase()}`
            if (!seenConcepts.has(key)) {
              seenConcepts.add(key)
              allConcepts.push(c)
            }
          }
        }
      }
      // Declared field definitions: one entry per (concept, name), first wins like
      // concepts; a conflicting redeclaration by a later blueprint is warned about.
      for (const f of Array.isArray(payload.schema.fields) ? payload.schema.fields : []) {
        if (!f || !f.concept || !f.name) continue
        const key = `${String(f.concept).toLowerCase()}\u0000${String(f.name).toLowerCase()}`
        const kept = fieldIndex.get(key)
        if (!kept) {
          fieldIndex.set(key, f)
          allFields.push(f)
        } else if (JSON.stringify(kept) !== JSON.stringify(f)) {
          process.stderr.write(
            `WARNING: [export-console] Field ${f.concept}.${f.name} is declared differently by more than one bluepriNNt; keeping the first declaration
`,
          )
        }
      }
    }
    if (payload && payload.schema) {
      for (const [list, seen, out] of [
        [payload.schema.markers, seenMarkers, allMarkers],
        [payload.schema.matrices, seenMatrixDecls, allMatrixDecls],
      ]) {
        for (const d of Array.isArray(list) ? list : []) {
          const key = d && d.name ? `${(d.declaredBy && d.declaredBy.family) || ''}\u0000${String(d.name).toLowerCase()}` : ''
          if (!key || seen.has(key)) continue
          seen.add(key)
          out.push(d)
        }
      }
    }
    // Aggregate the blueprint procedure catalog (parent + includes) across the
    // exported models, deduplicated by id; the stepper reads `usage` first.
    for (const p of modelSchemaResolution.procedures) {
      if (p && p.id && !seenProcedureIds.has(p.id)) {
        seenProcedureIds.add(p.id)
        allProcedures.push(p)
      }
    }
  }

  // No fabricated domain version: the domain meta carries `generated` plus the real
  // per-model `knowledge_version` / `sha256` in `models[]` (D4). The draft store key
  // (`domainId`) is deliberately NOT content-derived, or drafts would vanish on every
  // edit; a scoped console appends `::scope:<hash8 of sorted model ids>` so different
  // scopes never share a draft store (the runtime appends `::view:<id>`).
  const baseDomainId = `${basename(root)}-${hashSlice(resolve(root).toLowerCase(), 8)}`
  const domainId = scoped
    ? `${baseDomainId}::scope:${hashSlice([...scopeModelIds].sort().join('\n'), 8)}`
    : baseDomainId

  const domainPayload = {
    schema: {
      concepts: allConcepts,
      fields: allFields,
      markers: allMarkers,
      matrices: allMatrixDecls,
      procedures: allProcedures,
    },
    model: {
      meta: {
        title: basename(root) + ' Domain',
        model: basename(root),
        modelId: basename(root),
        domainId,
        generated: undefined,
        changesBlueprintVersion,
        models: modelSummaries,
        domain: {
          title: basename(root) + ' Domain',
          address: 'domaiNN_NN.md',
          modelCount: modelSummaries.length,
          sourceCount: domainSources.size,
        },
      },
      elements: allElements,
      matrices: allMatrices,
      // D2: the domain's changesets, newest first by file stamp. Read-only, never
      // written into a model.
      changes: (Array.isArray(changesets) ? changesets.slice() : []).sort((a, b) =>
        String(b.path).localeCompare(String(a.path)),
      ),
    },
  }

  if (scoped) {
    const scope = { models: [...scopeModelIds].sort(), label: scopeLabelOf(selected) }
    if (view) scope.view = view
    domainPayload.model.meta.consoleScope = scope
  } else if (view) {
    domainPayload.model.meta.consoleScope = { view: view }
  }

  // Output location. A console (whole-domaiNN or model-scoped) owns ONE stable file
  // from the shared path builder; only a lone view export keeps a write-once family
  // (<view>_view/, <view>-<key>_view/).
  const scopeKey = scoped ? scopeKeyOf(selected, root) : null
  let familyDir = null
  let familyKey = null
  let relativePath = null
  if (view) {
    familyKey = scoped ? `${view}-${scopeKey}_view` : `${view}_view`
    familyDir = `artifacts/${familyKey}`
  } else {
    relativePath = payloadHelper.consoleOutputPath(wholeDomain ? 'domain' : { model: scopeKey })
  }

  const outDirAbs = familyDir ? join(root, familyDir) : dirname(join(root, relativePath))
  const buildHtml = (generated) => {
    domainPayload.model.meta.generated = generated
    let html = viewsLib.inlineConsoleAssets(
      renderConsole(resolvedShell, null, config, domainPayload, outDirAbs, root),
      preparedAssets,
    )
    if (!html.includes('data-theme=')) {
      html = html.replace('<html lang="en">', '<html lang="en" data-theme="light">')
    }
    return html
  }
  const html = buildHtml(new Date().toISOString())

  // Final size gate, before the first write of this run.
  const bytes = (text) => Buffer.byteLength(text, 'utf8')
  const budget = viewsLib.evaluateSizeBudget({
    bundle: bytes(preparedAssets.bundleScript) + bytes(preparedAssets.css),
    models: bytes(JSON.stringify(domainPayload.schema)) + bytes(JSON.stringify(domainPayload.model)),
    views: preparedAssets.viewScripts.reduce((sum, script) => sum + bytes(script), 0),
    total: bytes(html),
  })
  if (budget.status === 'fail') throw new ConsoleExportError(budget.message, 'CONSOLE_TOO_LARGE')
  if (budget.status === 'warn') process.stderr.write(`WARNING: [export-console] ${budget.message}\n`)
  log(budget.breakdown)

  const inputs = payloadModels.map((m) => relative(root, m.filePath).replace(/\\/g, '/'))
  const knowledgeVersions = versionsOf(modelSummaries)
  let status
  let absPath
  let relPath

  if (!familyDir) {
    // Stable file: replaced through a temp file + rename, only when the bytes move.
    absPath = join(root, relativePath)
    relPath = relativePath
    let isUnchanged = false
    if (existsSync(absPath)) {
      const previous = await readFile(absPath, 'utf-8')
      const previousGenerated = extractModelMetaFromHtml(previous)?.generated
      // Re-render with the previous generated stamp: identical bytes mean nothing changed.
      if (previousGenerated && buildHtml(previousGenerated) === previous) isUnchanged = true
    }
    if (isUnchanged) {
      status = 'unchanged'
      log(`= ${basename(absPath)} unchanged`)
    } else {
      await writeFileAtomic(absPath, html)
      status = 'written'
      const detail = wholeDomain
        ? `${payloadModels.length} models, ${allElements.length} elements, ${domainViews.length} views`
        : `${allElements.length} elements`
      log(`✔ ${basename(absPath)} → ./${relPath} (${detail})`)
    }
    if (wholeDomain) {
      // Earlier exports wrote these beside the page; it inlines both now. Nothing is deleted.
      const leftovers = ['innfo-console.bundle.js', 'innfo-ui.css'].filter((name) => existsSync(join(root, name)))
      if (leftovers.length > 0) {
        process.stderr.write(
          `WARNING: [export-console] ${leftovers.join(' and ')} in the workspace root are leftover from an earlier export; domaiNN_console.html no longer uses them and they were not removed.\n`,
        )
      }
    }
  } else {
    // Lone view export: a write-once family member; assets are inlined, so no sibling file.
    const members = await familyMembers(root, familyDir, familyKey, 'html')
    const latest = payloadHelper.latestOfFamily(members)
    let isUnchanged = false
    if (latest) {
      const previous = await readFile(join(root, latest.path), 'utf-8')
      const previousGenerated = extractModelMetaFromHtml(previous)?.generated
      if (previousGenerated && buildHtml(previousGenerated) === previous) isUnchanged = true
    }
    if (isUnchanged) {
      status = 'unchanged'
      absPath = join(root, latest.path)
      relPath = latest.path
      log(`= ${basename(latest.path)} unchanged`)
    } else {
      const result = await payloadHelper.writeOnce(
        root,
        { dir: familyDir, key: familyKey, ext: 'html' },
        html,
        { inputs },
      )
      absPath = join(root, result.path)
      relPath = result.path
      if (result.status === 'deduplicated') {
        status = 'unchanged'
        log(`= ${basename(result.path)} unchanged`)
      } else {
        status = 'written'
        log(`✔ ${basename(result.path)} → ./${result.path} (view ${view}, ${allElements.length} elements)`)
      }
    }
  }

  const opening = await openConsole(absPath, { open, launcher, platform })
  return {
    path: absPath,
    relativePath: relPath,
    status,
    knowledgeVersions,
    opened: opening.opened,
    ...(opening.openError ? { openError: opening.openError } : {}),
  }
}

/**
 * Scaffolds a new console view in a domain (`consoles/views/<slug>.js`)
 * or a blueprint (`<pkg>/assets/console-view-<slug>.js`).
 *
 * @param {{
 *   rootDir: string,
 *   slug: string,
 *   template?: 'table' | 'kpi' | 'dashboard' | 'blank',
 *   blueprint?: string | null,
 *   title?: string | null,
 * }} options
 */
export async function scaffoldConsoleView({ rootDir, slug, template = 'table', blueprint = null, title = null }) {
  if (!slug || typeof slug !== 'string') {
    throw new ConsoleExportError('View slug is required (--new-view <slug>)', 'VIEWS_INVALID')
  }
  const cleanSlug = slug.trim().toLowerCase()
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)) {
    throw new ConsoleExportError(
      `Invalid view slug "${cleanSlug}": must use lowercase alphanumeric characters and hyphens only.`,
      'VIEWS_INVALID',
    )
  }
  if (['explorer', 'matrices', 'review'].includes(cleanSlug)) {
    throw new ConsoleExportError(`View slug "${cleanSlug}" is reserved.`, 'VIEWS_INVALID')
  }

  const viewTitle =
    title ||
    cleanSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  let targetDir
  let filename
  if (blueprint) {
    const isRepo = existsSync(join(rootDir, 'iNNfo', 'specs', 'bluepriNNts'))
    targetDir = isRepo
      ? join(rootDir, 'iNNfo', 'specs', 'bluepriNNts', blueprint, 'assets')
      : join(rootDir, 'specs', 'bluepriNNts', blueprint, 'assets')
    filename = `console-view-${cleanSlug}.js`
  } else {
    targetDir = join(rootDir, 'consoles', 'views')
    filename = `${cleanSlug}.js`
  }

  const targetPath = join(targetDir, filename)
  if (existsSync(targetPath)) {
    throw new ConsoleExportError(`View file already exists at ${targetPath}`, 'VIEW_ALREADY_EXISTS')
  }

  await mkdir(targetDir, { recursive: true })

  let code
  if (template === 'kpi' || template === 'dashboard') {
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${viewTitle} dashboard
   Declarative dashboard view using InnfoUI.KpiGrid with canonical KU badges. */
registerView({
  title: '${viewTitle}',
  icon: 'dashboard',
  order: 25,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []

    var grid = InnfoUI.KpiGrid(
      {
        items: [
          { label: 'Total', value: elements.length, hint: 'Elementos en este dominio' },
        ],
      },
      { doc: doc },
    )
    ctx.container.appendChild(grid)
  },
})
`
  } else if (template === 'blank') {
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${viewTitle} view */
registerView({
  title: '${viewTitle}',
  icon: 'layout',
  order: 50,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var wrap = doc.createElement('div')
    wrap.className = 'empty-state'
    wrap.textContent = '${viewTitle} view content.'
    ctx.container.appendChild(wrap)
  },
})
`
  } else {
    // Default: 'table'
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${viewTitle} table view
   Declarative table view using InnfoUI.Table with canonical KU badges. */
registerView({
  title: '${viewTitle}',
  icon: 'layers',
  order: 20,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []

    var table = InnfoUI.Table(
      {
        columns: [
          { key: 'name', label: 'Nombre', kind: 'element' },
          // Agrega aquí los campos de tu modelo que quieras mostrar en la tabla:
          // { key: 'mi_campo', label: 'Mi Campo', kind: 'field' },
        ],
        rows: elements,
        emptyText: 'No hay elementos para mostrar en esta vista.',
      },
      {
        doc: doc,
        onEdit: function (elementId) {
          ctx.modal.edit({ elementId: elementId })
        },
      },
    )
    ctx.container.appendChild(table)
  },
})
`
  }

  await writeFile(targetPath, code, 'utf8')
  return { targetPath, slug: cleanSlug, title: viewTitle, blueprint: Boolean(blueprint) }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.root) {
    console.error(
      'Usage: node scripts/export-console.mjs <workspaceRoot> [--status] [--tree] [--list] [--all] [--stale] [--domain] [--view <id>] [--new-view <slug>] [--filter <pattern>] [--no-open] [<ModelName>]',
    )
    process.exit(2)
  }
  const root = resolve(args.root)

  if (args.newView) {
    const template = VIEW_TEMPLATES.find((t) => t === args.template)
    if (!template) {
      console.error(`Error: unknown --template "${args.template}" (expected ${VIEW_TEMPLATES.join(' | ')}).`)
      process.exit(2)
    }
    const created = await scaffoldConsoleView({
      rootDir: root,
      slug: args.newView,
      template,
      blueprint: args.blueprint,
      title: args.title,
    })
    console.log(`Created console view "${created.title}" (${created.slug}):\n  ${created.targetPath}`)
    console.log(`To compile the console with this view, run:\n  node scripts/export-console.mjs ${relative(process.cwd(), root) || '.'} --domain`)
    return
  }
  if (args.viewMissing) {
    console.error('Error: --view needs a view id.')
    process.exit(2)
  }
  if (args.view && args.domain) {
    console.error('Error: --view and --domain are mutually exclusive.')
    process.exit(2)
  }
  const hasSelection = Boolean(args.all || args.stale || args.filter || args.model)
  if (args.domain && hasSelection) {
    console.error(
      'Error: --domain exports the whole domaiNN and cannot select models; drop the model name, --filter, --all or --stale.',
    )
    process.exit(2)
  }
  await ensureAssets()
  const models = await loadModels(root)

  const consoles = await statusConsoles(root)

  if (args.status) {
    console.log(`Status (${models.length} model(s)):`)
    for (const m of models) {
      const rel = relative(root, m.filePath).replace(/\\/g, '/')
      const info = await inspectModelStatus(m, root, consoles)
      console.log(`  ${rel} [${info.status}]`)
    }
    console.log(`Domain console: ${payloadHelper.consoleOutputPath('domain')} [${await inspectDomainConsole(models, root)}]`)
    return
  }

  if (args.tree) {
    await renderTree(models, root, consoles)
    return
  }

  if (args.list) {
    console.log('Models:')
    for (const m of models) console.log(`  ${relative(root, m.filePath).replace(/\\/g, '/')}`)
    console.log(`(${models.length} models)`)
    return
  }

  let candidateModels = models

  if (args.filter) {
    candidateModels = candidateModels.filter(
      (m) =>
        m.name.toLowerCase().includes(args.filter.toLowerCase()) ||
        m.filePath.toLowerCase().includes(args.filter.toLowerCase()),
    )
  }

  if (args.model) {
    candidateModels = candidateModels.filter(
      (m) =>
        m.name.toLowerCase().includes(args.model.toLowerCase()) ||
        m.filePath.toLowerCase().includes(args.model.toLowerCase()),
    )
  }

  // No scope option narrows the model set: --domain and a lone --view cover the
  // whole domaiNN. Any selection (a model name, --filter, --all, --stale) only
  // narrows candidateModels and produces ONE scoped console over the selected set.
  const wholeDomain = args.domain || (args.view && !hasSelection)

  let selected = []
  if (hasSelection) {
    if (args.stale) {
      for (const m of candidateModels) {
        if ((await inspectModelStatus(m, root, consoles)).status !== 'fresh') selected.push(m)
      }
      if (selected.length === 0) {
        console.log('All models are fresh. Nothing to export.')
        return
      }
    } else {
      selected = candidateModels
    }
  }

  if (!wholeDomain && selected.length === 0) {
    console.error(
      'No models selected. Use --all, --stale, --domain, --filter <pattern>, or pass a model name/id substring.',
    )
    process.exit(1)
  }

  const result = await writeConsole({
    rootDir: root,
    scope: wholeDomain ? 'domain' : { selected },
    view: args.view,
    open: args.open,
    models,
    log: (line) => console.log(line),
  })
  const written = result.status === 'written' ? 1 : 0
  const unchanged = result.status === 'unchanged' ? 1 : 0
  if (result.openError) {
    process.stderr.write(`WARNING: [export-console] could not open the console: ${result.openError}\n`)
  }
  console.log(
    `Exported ${written} console artifact(s)${unchanged > 0 ? ` (${unchanged} unchanged)` : ''}.`,
  )
}

/** True when this module is the process entry point, so importing it never runs the CLI. */
function isEntryPoint() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    if (err instanceof ConsoleExportError) console.error(`Error: ${err.message}`)
    else console.error(err)
    process.exit(1)
  })
}
