#!/usr/bin/env node
/**
 * scripts/export-console.mjs — `nn export`
 *
 * Unified console artifact export (backlog: feature/console-artifact-export-cli).
 *
 * Scans a workspace for iNNfo Level-3 models and compiles ONE self-contained
 * console (bundle, CSS, views and JSON slots inlined) against the canonical
 * console shell (`iNNfo/specs/bluepriNNts/console/artifact_shell.html`), filling
 * the `nn-config` / `nn-schema` / `nn-model` slots from a direct model
 * scan (no runtime dependency on nn-core, whose raw `dist/` barrel is not
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

import { readdir, readFile, writeFile, mkdir, rename, rm, stat, open } from 'node:fs/promises'
import {
  createReadStream,
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, basename, resolve, dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { StringDecoder } from 'node:string_decoder'
import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const req = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const repoConsoleDir = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')

/** Lazily loads the coNNtent layout checker, or null when that blueprint is not present. */
async function loadLayoutChecker() {
  const candidates = [
    new URL(
      '../iNNfo/specs/bluepriNNts/coNNtent/skills/nn-conntent/scripts/lib/layout.mjs',
      import.meta.url,
    ).href,
    new URL('../../coNNtent/skills/nn-conntent/scripts/lib/layout.mjs', import.meta.url).href,
    pathToFileURL(
      join(
        homedir(),
        '.agents',
        'bluepriNNts',
        'coNNtent',
        'skills',
        'nn-conntent',
        'scripts',
        'lib',
        'layout.mjs',
      ),
    ).href,
  ]
  for (const cand of candidates) {
    try {
      return await import(cand)
    } catch {}
  }
  return null
}

/** True when the filename is a coNNtent bluepriNNt instance document (from the naming contract). */
function isCoNNtentDoc(name) {
  const parsed = payloadHelper.parseName ? payloadHelper.parseName(name) : null
  return Boolean(parsed && parsed.kind === 'nn' && /_coNNtent$/i.test(parsed.stem))
}

const SHELL_FILENAME = 'artifact_shell.html'
/** Consoles installed before the shell rename still carry this file name: read, never written. */
const LEGACY_SHELL_FILENAME = 'artifact_blueprint.html'
/** Shell file names in resolution order: the current name first, the legacy one as the fallback. */
const SHELL_FILENAMES = [SHELL_FILENAME, LEGACY_SHELL_FILENAME]
const BUNDLE_FILENAME = 'nn-console.bundle.js'
const CSS_FILENAME = 'nn-ui.css'

/** A failure the caller can report: `code` is stable, `message` is human-readable. */
export class ConsoleExportError extends Error {
  constructor(message, code = 'CONSOLE_EXPORT_FAILED') {
    super(message)
    this.name = 'ConsoleExportError'
    this.code = code
  }
}

function findShell(dir) {
  return SHELL_FILENAMES.map((name) => join(dir, name)).find((p) => existsSync(p))
}

/** The console stylesheet every export inlines (the caller reports it when it is absent). */
function uiCssPathFor(consoleDir) {
  return join(consoleDir, CSS_FILENAME)
}

/**
 * Where bluepriNNt packages (and their console views) live. In a repo checkout the console
 * dir sits inside the packages folder; an installed set is flat in `~/.agents/console` and
 * the packages are installed beside it in `~/.agents/bluepriNNts`.
 */
function consolePackagesDir(consoleDir) {
  return (
    process.env.INNFO_BLUEPRINTS_DIR ||
    (consoleDir === repoConsoleDir
      ? dirname(consoleDir)
      : join(homedir(), '.agents', 'bluepriNNts'))
  )
}

// ---- Versions tab data (computed here: the console never goes online) -------------

/** Locale-free, case-insensitive ordering, so the artifact is byte-identical on every machine. */
function byCodeUnits(a, b) {
  const la = String(a).toLowerCase()
  const lb = String(b).toLowerCase()
  if (la !== lb) return la < lb ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The bluepriNNt version classifier the preflight already ships (`classifyAgainstCatalog`),
 * from the repo checkout or the installed skills. Null when neither is present.
 */
function loadVersionStatus() {
  const rel = join('skills', 'nn-preflight', 'scripts', 'lib', 'version-status.generated.cjs')
  for (const file of [join(repoRoot, rel), join(homedir(), '.agents', rel)]) {
    if (!existsSync(file)) continue
    try {
      return req(file)
    } catch {
      // A broken install reads as "no classifier": every bluepriNNt shows unknown.
    }
  }
  return null
}

/**
 * The bluepriNNt catalog: `$INNFO_CATALOG` when set (and nothing else), else the
 * domaiNN's own `specs/bluepriNNts/catalog.json` (the offline lookup nn-mcp uses too),
 * else the one beside the bluepriNNt packages.
 */
function loadBlueprintCatalog(consoleDir, root) {
  const files = process.env.INNFO_CATALOG
    ? [process.env.INNFO_CATALOG]
    : [
        join(root, 'specs', 'bluepriNNts', 'catalog.json'),
        join(consolePackagesDir(consoleDir), 'catalog.json'),
      ]
  for (const file of files) {
    if (!existsSync(file)) continue
    try {
      return JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}

/**
 * One row per bluepriNNt the exported models follow: the models that use it, the
 * pinned and latest versions and the catalog status. Only the versions of the
 * bluepriNNts in use are read, so the artifact changes only when one of them does.
 */
function blueprintVersionRows(uses, consoleDir, root) {
  const lib = loadVersionStatus()
  const catalog = lib ? loadBlueprintCatalog(consoleDir, root) : null
  const byName = new Map()
  for (const use of uses) {
    const c = catalog
      ? lib.classifyAgainstCatalog(use.url || null, catalog)
      : { status: 'unknown', template: null, pinned: null, adopted: null, gap: null }
    const name = c.template || use.name
    if (!name) continue
    const row = byName.get(name) || {
      name,
      models: [],
      pinned: c.pinned || null,
      adopted: c.adopted || null,
      status: c.status,
      gap: c.gap || null,
    }
    if (row.models.indexOf(use.modelId) < 0) row.models.push(use.modelId)
    byName.set(name, row)
  }
  return {
    catalog: catalog ? 'available' : 'unavailable',
    blueprints: Array.from(byName.values()).sort((a, b) => byCodeUnits(a.name, b.name)),
  }
}

/**
 * The bluepriNNt the domaiNN's changesets follow (normally `changes`), read from each
 * changeset's own frontmatter, so the Versions tab lists it like a model's bluepriNNt.
 */
function changesetBlueprintUses(root, changesets) {
  const uses = []
  for (const cs of Array.isArray(changesets) ? changesets : []) {
    let fm = null
    try {
      fm = frontmatterOf(readFileSync(join(root, cs.path), 'utf8'))
    } catch {
      continue
    }
    const spec = fm && fm.parent_spec
    const name =
      spec && typeof spec === 'object' ? spec.name : typeof spec === 'string' ? spec : null
    if (!name) continue
    uses.push({ modelId: 'changes', name: String(name), url: (spec && spec.url) || null })
  }
  return uses
}

const INSTALL_KINDS = [
  ['skills', 'skill'],
  ['blueprints', 'bluepriNNt'],
  ['mcp', 'MCP server'],
  ['console', 'console'],
  ['cli', 'CLI'],
]

/**
 * What is installed, from the skills-manager state: `$INNFO_STATE_FILE` when set (and
 * nothing else), else the domaiNN's own `.agents/bootstrap-state.json`, else the user's.
 */
function installationRecord(root) {
  const candidates = process.env.INNFO_STATE_FILE
    ? [['file', process.env.INNFO_STATE_FILE]]
    : [
        ['domain', join(root, '.agents', 'bootstrap-state.json')],
        ['user', join(homedir(), '.agents', 'bootstrap-state.json')],
      ]
  for (const [scope, file] of candidates) {
    if (!existsSync(file)) continue
    let state
    try {
      state = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const components = []
    for (const [key, kind] of INSTALL_KINDS) {
      const section = state && typeof state[key] === 'object' && state[key] ? state[key] : {}
      for (const name of Object.keys(section).sort(byCodeUnits)) {
        const entry = section[name] || {}
        components.push({
          kind,
          name,
          version: entry.version || (entry.commit ? String(entry.commit).slice(0, 7) : null),
          updatedAt: entry.updated_at ? String(entry.updated_at).slice(0, 10) : null,
        })
      }
    }
    return { scope, components }
  }
  return null
}

/** Console asset folder: `$INNFO_CONSOLE_DIR`, the repo checkout, this script's own folder, then `~/.agents/console`. */
function resolveConsoleDir() {
  return (
    [process.env.INNFO_CONSOLE_DIR, repoConsoleDir, here, join(homedir(), '.agents', 'console')]
      .filter(Boolean)
      .find((dir) => findShell(dir)) || repoConsoleDir
  )
}

/** The console payload mirror (single nn-core build shared by every producer). */
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
  const bundlePath = join(consoleDir, BUNDLE_FILENAME)
  if (!existsSync(shellPath)) {
    throw new ConsoleExportError(
      `Console assets not found: ${shellPath}\n` +
        'Install the console assets (skills-manager install) or set INNFO_CONSOLE_DIR to ' +
        'the folder holding artifact_shell.html and nn-console.bundle.js.',
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

/** The console view library, which must sit next to this script. */
async function loadViewsLib() {
  const viewsLibUrl = new URL('./console-views.mjs', import.meta.url).href
  try {
    return await import(viewsLibUrl)
  } catch (err) {
    // Only the lib itself being absent is reported here; a missing module imported
    // from inside it (err.url is that module) is a real fault and must surface.
    if (err.code !== 'ERR_MODULE_NOT_FOUND' || err.url !== viewsLibUrl) throw err
    throw new ConsoleExportError(
      `console-views.mjs must sit next to this script (${fileURLToPath(viewsLibUrl)}).`,
      'CONSOLE_ASSETS_NOT_FOUND',
    )
  }
}

/**
 * The views lib, loaded once per process. It also owns `compareCodeUnits`, the single
 * code-unit comparator every list in the exporter and the views lib is ordered with, so
 * the two modules can never drift apart on locale behaviour.
 */
let viewsLibModule = null
function viewsLibOnce() {
  return (viewsLibModule ??= loadViewsLib())
}

function parseConsoleCdnRef(bundleText) {
  const m = bundleText && bundleText.match(/\bVersion (\d+\.\d+\.\d+)\./)
  return m ? `nn-console-v${m[1]}` : null
}

/** @type {readonly ['table', 'kpi', 'dashboard', 'blank']} */
const VIEW_TEMPLATES = ['table', 'kpi', 'dashboard', 'blank']

/**
 * Every flag the CLI accepts, spelled the way the usage line shows it. The usage line
 * and the unknown-flag error both read this list, so a flag cannot be accepted without
 * being announced. A bare positional is never a flag error: it is the workspace root or
 * a model-name substring.
 */
const CLI_FLAGS = [
  '--list',
  '--status',
  '--tree',
  '--all',
  '--stale',
  '--domain',
  '--view <id>',
  '--new-view <slug>',
  '--template <table|kpi|dashboard|blank>',
  '--blueprint <name>',
  '--title <text>',
  '--filter <pattern>',
  '--no-open',
  '--no-files',
  '--no-changes',
]
const KNOWN_FLAG_NAMES = CLI_FLAGS.map((flag) => flag.split(' ')[0])
const USAGE =
  `Usage: node scripts/export-console.mjs <workspaceRoot> ` +
  `${CLI_FLAGS.map((flag) => `[${flag}]`).join(' ')} [<ModelName>]`

/** Flags that take the next token as their value. */
const VALUE_FLAGS = new Set([
  '--view',
  '--new-view',
  '--template',
  '--blueprint',
  '--title',
  '--filter',
])

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
    newView: null,
    template: 'table',
    blueprint: null,
    title: null,
    filter: null,
    model: null,
    open: true,
    files: true,
    changes: true,
    errors: [],
  }
  const slice = argv.slice(2)
  for (let i = 0; i < slice.length; i++) {
    const a = slice[i]
    if (VALUE_FLAGS.has(a)) {
      const value = slice[i + 1]
      // A value never starts with "-": a flag there means this one lost its value, and
      // swallowing it would run the command with a default instead of refusing.
      if (value === undefined || value.startsWith('-')) {
        args.errors.push(a === '--view' ? '--view needs a view id.' : `${a} needs a value.`)
        continue
      }
      i += 1
      if (a === '--view') args.view = value
      else if (a === '--new-view') args.newView = value
      else if (a === '--template') args.template = value
      else if (a === '--blueprint') args.blueprint = value
      else if (a === '--title') args.title = value
      else args.filter = value
    } else if (a === '--list') {
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
    } else if (a === '--no-files') {
      args.files = false
    } else if (a === '--no-changes') {
      args.changes = false
    } else if (a.startsWith('-')) {
      // Only flag-shaped tokens are refused: a bare word is still the root or a model.
      args.errors.push(`unknown option "${a}". Accepted flags: ${KNOWN_FLAG_NAMES.join(', ')}.`)
    } else if (args.root === null) {
      args.root = a
    } else {
      args.model = a
    }
  }
  return args
}

/* ── Output ────────────────────────────────────────────────────── */

/**
 * The export prints through ONE writer, `{ out(line), err(line), warn(message) }`, so
 * each caller decides where its lines land: `createProcessWriter()` writes exactly what
 * `console.log` / `console.error` / `process.stderr.write` write today (the CLI), and
 * `createBufferedWriter()` collects them (the programmatic entry point). One line per
 * call, no formatting: `out`/`err` write `line` plus a newline, which is what
 * `console.log(line)` writes, and `warn` owns the one warning prefix.
 *
 * This file must stay self-contained: the installer distributes it flat next to
 * `console-views.mjs` and the console assets, with no `scripts/lib` around it.
 */

const WARNING_PREFIX = 'WARNING: [export-console] '

/**
 * The export's one warning channel (`process.stderr.write`). Every scan diagnostic and
 * every `writeConsole` warning goes through an `onWarning`/`warn` sink that defaults to
 * this one, so the MCP, which passes neither, keeps printing where it always did.
 */
function writeExportWarning(message) {
  process.stderr.write(`${WARNING_PREFIX}${message}\n`)
}

/** The CLI's writer: the export prints exactly as it would through the globals. */
function createProcessWriter() {
  return {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    warn: writeExportWarning,
  }
}

/**
 * A writer that collects the export's lines in memory. `writeStderr` appends text that
 * already carries its own line breaks: an error message or a stack trace.
 */
function createBufferedWriter() {
  let stdout = ''
  let stderr = ''
  return {
    out: (line) => {
      stdout += `${line}\n`
    },
    err: (line) => {
      stderr += `${line}\n`
    },
    warn: (message) => {
      stderr += `${WARNING_PREFIX}${message}\n`
    },
    writeStderr: (text) => {
      stderr += text
    },
    read: () => ({ stdout, stderr }),
  }
}

/* ── Scan diagnostics ──────────────────────────────────────────── */

// Every scan and console diagnostic reaches `writeExportWarning` through the sink its
// function takes (`onWarning`, or `warn` on the console writer). There is no second
// channel.

/**
 * The message for a filesystem failure during a scan, or null when nothing
 * failed: `ENOENT`/`ENOTDIR` mean "this optional path is not there", which is a
 * normal workspace (a domain without `evidence/`, a folder that was never
 * created). Every other code means part of the workspace exists but could not be
 * read, so the inventory would shrink in silence; name the path and operation.
 */
function scanReadWarning(operation, target, err) {
  if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') return null
  return `cannot ${operation} ${target}: ${err?.code ?? err?.message ?? err}`
}

/** Recursively find every non-sidecar `*_NN.md` file under `dir`, skipping heavy dirs. */
async function findModelFiles(dir, onWarning = writeExportWarning) {
  const out = []
  const skip = new Set(['node_modules', '.git', '.cogNNitive', 'artifacts', 'dist', 'docs'])
  // A legacy episode layout under `series/<s>/assets/` is rejected by coNNtent `layout.mjs`,
  // not silently skipped (task 1a.4). Only a domaiNN that actually contains coNNtent
  // documents gets these coNNtent-specific warnings; unrelated blueprints never do. The
  // warnings are emitted lazily on the first coNNtent document, and the legacy folder is
  // still skipped so a legacy document is never listed as a real episode next to the real
  // `episodes/` ones.
  const layout = await loadLayoutChecker()
  let legacyFindings = null // computed lazily, only when a coNNtent document is seen
  let warnedLegacy = false
  const LEGACY_EPISODE = /(^|[\\/])series[\\/][^\\/]+[\\/]assets([\\/]|$)/
  async function walk(d) {
    let entries
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch (err) {
      // A subtree that cannot be read would silently drop every model under it.
      const problem = scanReadWarning('read directory', d, err)
      if (problem) onWarning(problem)
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        const next = join(d, e.name)
        if (skip.has(e.name)) continue
        if (LEGACY_EPISODE.test(relative(dir, next))) continue
        await walk(next)
      } else if (
        e.isFile() &&
        payloadHelper.isNNName(e.name) &&
        !payloadHelper.isSidecarName(e.name)
      ) {
        out.push(join(d, e.name))
        // Emit the coNNtent legacy findings only once a coNNtent document is actually seen.
        if (!warnedLegacy && layout && isCoNNtentDoc(e.name)) {
          warnedLegacy = true
          try {
            legacyFindings = layout.assertLayout(dir)
          } catch {
            legacyFindings = null
          }
          for (const f of legacyFindings ?? []) {
            onWarning(`${f.path}: ${f.message}`)
          }
        }
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

/**
 * Core-blueprint catalog documents the domain console surfaces as models for the
 * administrator: the Sources, Artifacts and Procedures catalogs. Expressed as an
 * EXPLICIT allowlist on purpose — the core blueprint set is a stable product
 * contract, so we do not key off the `catalog` role (which would also drag in
 * workspace documents). Add a name here only when a new core blueprint ships.
 *
 * The domain entrypoint (`domaiNN_NN.md`) is deliberately NOT included: its
 * structural elements (Workspace, Models) carry no `slug::`, and the console
 * model pipeline requires a frozen slug on every element — the same invariant
 * that governs every other model.
 */
const CONSOLE_CORE_BLUEPRINTS = new Set(['sources', 'artifacts', 'procedures'])

/** Blueprint name of a `parent_spec` name: trimmed, without a trailing `_V_x-y-z`, lowercased. */
export function coreBlueprintOf(parentSpecName) {
  // Deliberately a local copy of `parseSpecName`'s rule, not an import: the exporter
  // must keep loading when `console-views.mjs` is not next to it, which is the
  // distributed-asset-set case the CLI test pins. The parity with `parseSpecName` is
  // asserted by "one spec-name rule for both call sites" in test/console-views-lib.
  return String(parentSpecName || '')
    .trim()
    .replace(/_V_\d+-\d+-\d+$/i, '')
    .toLowerCase()
}

/**
 * A console model is a `knowledge` model or a `procedures` model (never a
 * `procedures/` submodel). See `isConsoleModel` in the naming contract.
 *
 * On top of that, the administrator's core-blueprint catalogs are surfaced too
 * (same console mechanism as any other model): the allowlisted `catalog`-role
 * documents (Sources, Artifacts, Procedures). The core predicate filters these
 * out by role, so the console opts them back in here.
 */
function isModelDocument(relPath, content, linkedProcedureModels) {
  const frontmatter = frontmatterOf(content)
  // Notes without a YAML header are not models.
  if (!frontmatter) return false
  if (payloadHelper.isConsoleModel({ path: relPath, frontmatter, linkedProcedureModels }))
    return true
  const parentName = payloadHelper.parentSpecNameOf(frontmatter)
  const role = payloadHelper.roleOf({ path: relPath, parentSpecName: parentName })
  if (role === 'catalog') return CONSOLE_CORE_BLUEPRINTS.has(coreBlueprintOf(parentName))
  return false
}

/**
 * Repo-relative targets of every `procedure_model::` a document declares for a DIFFERENT
 * file. An execution stepper is reached this way from a catalog `Procedure`; a custom
 * procedure that names itself is self-contained and is NOT added. Used to exclude steppers
 * from the console regardless of which folder holds them.
 */
function collectForeignProcedureTargets(root, files) {
  const targets = new Set()
  for (const f of files) {
    const rel = relative(root, f).replace(/\\/g, '/')
    let content
    try {
      content = readFileSync(f, 'utf-8')
    } catch {
      continue
    }
    const re = /^[ \t]*procedure_model::[ \t]*(\S+)[ \t]*$/gim
    let m
    while ((m = re.exec(content))) {
      const target = m[1].replace(/^"|"$/g, '').trim().replace(/\\/g, '/')
      if (target && target !== rel) targets.add(target)
    }
  }
  return targets
}

function isLevel3(content) {
  const fm = frontmatterOf(content)
  const lvl = fm.level
  return lvl === undefined || Number(lvl) === 3
}

/**
 * The nn-model slot holds the payload JSON compressed with deflate-raw (level 9) and
 * encoded as base64, in a non-executable script of this type. deflate-raw, not gzip: a
 * gzip header carries an OS byte, so the same input would not give the same bytes on
 * every platform, and the "unchanged" check compares whole renders byte for byte.
 * The codec lives here because this script ships flat, without `scripts/lib`.
 */
export const CONSOLE_MODEL_SLOT_TYPE = 'application/x-nn-deflate-base64'

/** The nn-model slot of a console page, whatever its type; group 1 is its text. */
const MODEL_SLOT_RE = /<script type="[^"]*" id="(?:innfo|nn)-model">([\s\S]*?)<\/script>/

/** The nn-model slot text for `model`: deterministic deflate-raw (level 9) + base64. */
export function encodeConsoleModel(model) {
  return deflateRawSync(Buffer.from(JSON.stringify(model), 'utf8'), { level: 9 }).toString('base64')
}

/** The payload JSON text an nn-model slot holds ('' for an empty slot). Throws on corrupt data. */
export function decodeConsoleModelText(slotText) {
  const text = String(slotText ?? '').trim()
  if (text === '') return ''
  return inflateRawSync(Buffer.from(text, 'base64')).toString('utf8')
}

/** The decoded model of a console page, or null when it has no readable nn-model slot. */
export function readConsoleModel(htmlContent) {
  const match = MODEL_SLOT_RE.exec(htmlContent)
  if (!match) return null
  try {
    return JSON.parse(decodeConsoleModelText(match[1]) || '{}')
  } catch {
    return null
  }
}

function extractModelMetaFromHtml(htmlContent) {
  // Dual read: a console exported before the `nn-` prefix migration carries
  // `id="innfo-model"`.
  return readConsoleModel(htmlContent)?.meta ?? null
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
 * The nearest ancestor of `dir` (itself included) that carries a `.git` entry, which is
 * how a project root is recognised. `.git` is a directory in a clone and a file in a
 * worktree, so both count. Null when the folder is not inside a project at all.
 */
function projectRootOf(dir) {
  let current = dir
  for (;;) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

/**
 * What `meta.domainId`'s short hash is derived from: the domain's path INSIDE its
 * project, never the absolute checkout path. Two differently named checkouts of the
 * same project place the same domain at the same project-relative path, so they derive
 * the same draft-store key and export byte-identical consoles; hashing the absolute path
 * made every worktree and every renamed copy a different domain (backlog
 * console-domain-id-path-hash). The remaining branches, in order: a domain that IS the
 * project root hashes `.`, so it stays distinct from a subfolder of the same name, and a
 * folder that is not inside a project falls back to its absolute path, which is the only
 * identity such a folder is guaranteed to have.
 *
 * The key is display-independent: lowercase, forward slashes, no trailing separator.
 *
 * @param {string} root - workspace root of the export
 * @returns {string}
 */
export function domainIdSourcePath(root) {
  const abs = resolve(root)
  const projectRoot = projectRootOf(abs)
  if (!projectRoot) return abs.split('\\').join('/').toLowerCase()
  const rel = relative(projectRoot, abs).split('\\').join('/')
  return (rel === '' ? '.' : rel).toLowerCase()
}

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
  const { compareCodeUnits } = await viewsLibOnce()
  const relPath = relative(rootDir, model.filePath).replace(/\\/g, '/')
  const fileName = basename(relPath)
  const lists = (c) =>
    Array.isArray(c.meta.models) &&
    c.meta.models.some((mm) => mm && (mm.filePath === fileName || mm.filePath === relPath))
  const listing = (consoles || [])
    .filter(lists)
    .sort((a, b) =>
      compareCodeUnits(String(b.meta.generated || ''), String(a.meta.generated || '')),
    )

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
 * Why the domain console does not reflect the workspace, or null when it does: `missing`
 * for an absent file, `assets` when the page inlines an asset that changed since the export
 * (shell, bundle, stylesheet or a view script), `models` when a model entry differs in
 * count, identity, `knowledge_version` or content `sha256`.
 */
async function domainConsoleStaleness(models, rootDir) {
  const file = join(rootDir, payloadHelper.consoleOutputPath('domain'))
  if (!existsSync(file)) return 'missing'
  let html
  let fileStat
  try {
    fileStat = await stat(file)
    html = await readFile(file, 'utf-8')
  } catch {
    return 'models'
  }
  // A view or a stylesheet edit leaves every model entry intact, so only the inlined
  // assets can tell that the page is out of date.
  let assetsMatch = true
  try {
    assetsMatch = await inlinedAssetsMatch(html, fileStat, rootDir, models)
  } catch {
    /* an asset that cannot be read is not evidence of staleness */
  }
  if (!assetsMatch) return 'assets'

  const embeddedMeta = extractModelMetaFromHtml(html)
  const embedded = embeddedMeta?.models
  if (!Array.isArray(embedded)) return 'models'
  // The synthetic changes summary is not a model document: it is compared by the hash of
  // the changeset records it was built from, so a changeset that touches no model still
  // makes the page stale. A page that omitted its changes (--no-changes or over budget)
  // never carried them, so there is nothing to compare.
  if (!embeddedMeta.changesOmitted) {
    const summary = embedded.find((e) => e && e.filePath === CHANGES_SUMMARY_FILE_PATH)
    const records = payloadHelper.loadChangesetRecords
      ? await payloadHelper.loadChangesetRecords(rootDir)
      : []
    if ((summary?.sha256 ?? null) !== changesSummarySha256(records)) return 'models'
  }
  const embeddedModels = embedded.filter((e) => e && e.filePath !== CHANGES_SUMMARY_FILE_PATH)
  if (embeddedModels.length !== models.length) return 'models'
  for (const m of models) {
    const relPath = relative(rootDir, m.filePath).replace(/\\/g, '/')
    const fileName = basename(relPath)
    const entry = embeddedModels.find((e) => e.filePath === fileName || e.filePath === relPath)
    if (!entry) return 'models'
    if ((entry.version ?? null) !== (m.fm.knowledge_version || null)) return 'models'
    if (entry.sha256 !== computeSha256(m.content)) return 'models'
  }
  return null
}

/**
 * The one `meta.models` entry that is not a model document: the exporter summarizes the
 * domain's changesets as a synthetic `<changes>` collection for the console's Changes
 * view. Its `sha256` is {@link changesSummarySha256} of the records it was built from.
 */
const CHANGES_SUMMARY_FILE_PATH = '<changes>'

/**
 * Content identity of the `<changes>` summary: the sha256 of the changeset records
 * (`loadChangesetRecords`, read in sorted file order and carrying no volatile field), or
 * null when they hold no change, which is when the export adds no summary entry.
 */
function changesSummarySha256(records) {
  const list = Array.isArray(records) ? records : []
  const count = list.reduce((n, cs) => n + (Array.isArray(cs.changes) ? cs.changes.length : 0), 0)
  return count > 0 ? computeSha256(JSON.stringify(list)) : null
}

/**
 * Freshness of the domain console: `uncompiled` when the file is absent, `fresh` when every
 * live model appears in the embedded `meta.models` with the same `knowledge_version` and
 * content `sha256` (and nothing else is embedded) and the page still inlines the current
 * assets, else `stale`.
 */
async function inspectDomainConsole(models, rootDir) {
  const why = await domainConsoleStaleness(models, rootDir)
  if (why === 'missing') return 'uncompiled'
  return why ? 'stale' : 'fresh'
}

/**
 * True when the page still inlines the assets on disk: the stylesheet byte for byte, every
 * view at the sha256 its header comment records, and neither the bundle nor the shell newer
 * than the page (an install that replaced an asset the page predates).
 */
async function inlinedAssetsMatch(html, fileStat, rootDir, models) {
  const { consoleDir, shellPath, bundlePath } = await ensureAssets()
  if (existsSync(bundlePath) && (await stat(bundlePath)).mtimeMs > fileStat.mtimeMs + 2000) {
    return false
  }
  if (existsSync(shellPath) && (await stat(shellPath)).mtimeMs > fileStat.mtimeMs + 2000) {
    return false
  }
  const viewsLib = await loadViewsLib()
  const css = await readFile(uiCssPathFor(consoleDir), 'utf-8')
  if (!html.includes(`<style>${viewsLib.escapeStyle(css)}</style>`)) return false

  const views = await viewsLib.discoverViews({
    domainRoot: rootDir,
    specNames: viewSpecNamesFor(models, html),
    packagesDir: consolePackagesDir(consoleDir),
    onWarning: () => {},
  })
  const recorded = viewsLib.parseViewsHeader(html)
  if (!recorded) return views.length === 0
  if (recorded.size !== views.length) return false
  const prefixLength = (recorded.values().next().value || '').length
  return views.every((v) => recorded.get(v.id) === v.sha256.slice(0, prefixLength))
}

/**
 * The view folders an export of these models reads: one per parent spec, plus the Changes
 * view when the page carries it (the export adds that spec name only with changesets).
 */
function viewSpecNamesFor(models, html) {
  const names = models.map((m) => payloadHelper.parentSpecNameOf(m.fm)).filter(Boolean)
  if (String(html).includes('bluepriNNt:changes/')) names.push('changes')
  return names
}

/**
 * Scope family key: one model `<stem>`; several `<firstStem>-plus<N-1>-<hash6>`.
 * The multi-model key is order-independent: both the prefix and the hashed list come from
 * the models sorted by their slash-normalized repository path, so any permutation of
 * `selected` names the same family (the raw OS-separator path order the caller may have
 * used never reaches the key).
 */
async function scopeKeyOf(selected, rootDir) {
  if (selected.length === 1) return selected[0].name
  const { compareCodeUnits } = await viewsLibOnce()
  const ordered = selected
    .map((m) => ({ name: m.name, rel: relative(rootDir, m.filePath).replace(/\\/g, '/') }))
    .sort((a, b) => compareCodeUnits(a.rel, b.rel))
  const rels = ordered.map((entry) => entry.rel)
  return `${ordered[0].name}-plus${selected.length - 1}-${hashSlice(rels.join('\n'), 6)}`
}

/** Human-readable scope label: `A, B` for a couple, `<first> + N more` beyond. */
function scopeLabelOf(selected) {
  const titles = selected.map((m) => String(m.fm.title || m.name))
  return titles.length <= 2 ? titles.join(', ') : `${titles[0]} + ${titles.length - 1} more`
}

async function renderTree(models, root, consoles, out) {
  const groups = new Map()
  for (const m of models) {
    const rel = relative(root, m.filePath).replace(/\\/g, '/')
    const dir = dirname(rel)
    const dirKey = dir === '.' ? '.' : dir + '/'
    if (!groups.has(dirKey)) groups.set(dirKey, [])
    const statusInfo = await inspectModelStatus(m, root, consoles)
    groups.get(dirKey).push({ model: m, rel, statusInfo })
  }

  out(`Workspace: . (${models.length} Level-3 models)`)
  const dirKeys = Array.from(groups.keys())
  for (let i = 0; i < dirKeys.length; i++) {
    const dirKey = dirKeys[i]
    const isLastDir = i === dirKeys.length - 1
    const dirPrefix = isLastDir ? '└── ' : '├── '
    // The root group needs no directory line (the header already names `.`) and no
    // indent; every other group prints its line and indents its children.
    const atRoot = dirKey === '.'
    const childIndent = atRoot ? '' : isLastDir ? '    ' : '│   '
    if (!atRoot) out(`${dirPrefix}${dirKey}`)

    const items = groups.get(dirKey)
    for (let j = 0; j < items.length; j++) {
      const item = items[j]
      const isLastItem = j === items.length - 1
      const itemPrefix = isLastItem ? '└── ' : '├── '
      const fileIndent = isLastItem ? '    ' : '│   '
      out(`${childIndent}${itemPrefix}${basename(item.model.filePath)} [${item.statusInfo.status}]`)
      const targetRel = relative(root, item.statusInfo.targetHtmlPath).replace(/\\/g, '/')
      out(`${childIndent}${fileIndent}└── ${targetRel}`)
    }
  }
}

/**
 * The body of the `nn-procedure-core` slot, or '' when the payload helper carries no fold.
 *
 * It ships the real `foldRun` as source rather than re-implementing it, so a console that
 * projects a run answers with the same function the exporter used. The slot is inert data:
 * `nnProcedureCore.use(...)` reads it at boot, and a view that never asks for a projection
 * costs nothing.
 */

/**
 * The body of the `nn-procedure-core` slot, or '' when the fold cannot be bundled.
 *
 * `foldRun` is not self-contained: `TERMINAL`, `ARTIFACT_STATUS`, `reachable` and `guardOf`
 * live in the same module, so shipping the function's source alone would throw on the first
 * artifact event. esbuild bundles the module instead, and the slot carries that bundle.
 *
 * Bundled once per process: `injectSlots` runs several times (the unchanged-console check
 * calls it again with a different timestamp), and re-bundling on every call would rebuild
 * the same bytes.
 */
let foldSlotCache = ''
async function loadProcedureFoldSlot() {
  // foldRun is now included canonically in nn-console.bundle.js via nn-procedure-fold.generated.js.
  // No dynamic script injection is needed into exported consoles.
  return ''
}

function injectSlots(shell, config, schema, model, viewData) {
  const serialize = payloadHelper?.serializeConsoleSlot
    ? (json) => payloadHelper.serializeConsoleSlot(json)
    : (json) => JSON.stringify(json).replace(/</g, '\\u003c')
  const slot = (html, id, json) =>
    html.replace(
      new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`),
      (_m, open, close) => `${open}\n${serialize(json)}\n${close}`,
    )
  // The model is always compressed, whatever type the shell's slot declares. A fresh
  // export carries no drafts, so nn-drafts is always `{}` (added when the shell lacks it).
  const modelSlot = `<script type="${CONSOLE_MODEL_SLOT_TYPE}" id="nn-model">\n${encodeConsoleModel(model)}\n</script>`
  let html = slot(slot(shell, 'nn-config', config), 'nn-schema', schema).replace(
    /<script type="[^"]*" id="nn-model">[\s\S]*?<\/script>/,
    () => modelSlot,
  )
  // The procedure fold, for a console that projects a run from drafts it has not applied.
  // The implementation is nn-core's own (through the payload helper the exporter already
  // loads), so the browser folds exactly what the exporter folded. It stays inert unless a
  // view calls `nnProcedureCore.use(...)`, and a console that ships without it degrades to
  // the exported state.
  const foldSource = foldSlotCache || ''
  if (foldSource) {
    // The shell ships the slot empty; fill it in place so no second, empty one survives.
    const foldSlot = new RegExp(`(<script[^>]*id="nn-procedure-core"[^>]*>)[\\s\\S]*?(</script>)`)
    if (foldSlot.test(html)) {
      html = html.replace(
        foldSlot,
        () => `<script type="text/javascript" id="nn-procedure-core">\n${foldSource}\n</script>`,
      )
    } else {
      html = html.replace(
        modelSlot,
        () =>
          `${modelSlot}\n    <script type="text/javascript" id="nn-procedure-core">\n${foldSource}\n</script>`,
      )
    }
  }
  if (!html.includes('<script type="application/json" id="nn-drafts">')) {
    html = html.replace(
      modelSlot,
      () => `${modelSlot}\n    <script type="application/json" id="nn-drafts">{}</script>`,
    )
  }
  return slot(slot(html, 'nn-drafts', {}), 'nn-view-data', viewData || {})
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
  const pinned = bundleName
    ? shell.replace(/\.\/(?:nn|innfo)-console\.bundle\.js/, `./${bundleName}`)
    : shell
  const model =
    outDirAbs && rootAbs
      ? rebaseModelAssets(payload.model, outDirAbs, rootAbs, payload.schema)
      : payload.model
  return injectSlots(pinned, config, payload.schema, model, payload.viewData)
}

/* ── Opening the console ───────────────────────────────────────── */

/** Platform command that opens `file` in the default browser, or null when unsupported. */
export function openCommandFor(platform, file) {
  if (platform === 'win32')
    return { command: 'rundll32', args: ['url.dll,FileProtocolHandler', file] }
  if (platform === 'darwin') return { command: 'open', args: [file] }
  if (platform === 'linux') return { command: 'xdg-open', args: [file] }
  return null
}

/**
 * Name of the marker written beside a console once it was opened in a browser.
 *
 * A regenerated console is rewritten IN PLACE at a stable path, so a tab that is
 * already showing it only needs a reload. Launching the browser again instead
 * adds a second instance of the same document, and a domain console is heavy
 * enough (hundreds of thousands of nodes) that a handful of copies exhausts RAM
 * and makes every renderer burn a core. The marker is what lets `open: true`
 * coalesce instead.
 */
const OPEN_MARKER = '.nn-console-opened.json'

/** Default coalescing window for `open: true`: at most one tab per console per window. */
const DEFAULT_OPEN_COOLDOWN_MINUTES = 30

/**
 * Coalescing window in milliseconds for `open: true`.
 * `INNFO_CONSOLE_OPEN_COOLDOWN_MINUTES=0` disables the coalescing entirely.
 */
export function openCooldownMs(env = process.env) {
  const raw = env.INNFO_CONSOLE_OPEN_COOLDOWN_MINUTES
  if (raw === undefined || raw === '') return DEFAULT_OPEN_COOLDOWN_MINUTES * 60 * 1000
  const minutes = Number(raw)
  if (!Number.isFinite(minutes) || minutes < 0) return DEFAULT_OPEN_COOLDOWN_MINUTES * 60 * 1000
  return minutes * 60 * 1000
}

function openMarkerPath(file) {
  return join(dirname(file), OPEN_MARKER)
}

/** True when this exact console was already opened inside the coalescing window. */
function openedRecently(file, cooldownMs, now) {
  if (cooldownMs <= 0) return false
  try {
    const marker = JSON.parse(readFileSync(openMarkerPath(file), 'utf-8'))
    if (marker.file !== file) return false
    const at = Date.parse(marker.at)
    return Number.isFinite(at) && now >= at && now - at < cooldownMs
  } catch {
    return false
  }
}

function recordOpened(file, now) {
  try {
    writeFileSync(openMarkerPath(file), JSON.stringify({ file, at: new Date(now).toISOString() }))
  } catch {
    // A marker that cannot be written only costs the coalescing: it never fails the export.
  }
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

/**
 * Open `file` when `open` is true. Never throws: failures come back as
 * `opened: false` + `openError`. A console already opened inside the coalescing
 * window comes back as `opened: false` + `alreadyOpen: true` instead of costing
 * a second heavyweight tab.
 */
async function openConsole(file, { open, launcher, platform, cooldownMs, now = Date.now() }) {
  if (!open) return { opened: false }
  if (openedRecently(file, cooldownMs ?? openCooldownMs(), now)) {
    return { opened: false, alreadyOpen: true }
  }
  const cmd = openCommandFor(platform, file)
  if (!cmd) {
    return {
      opened: false,
      openError: `Opening a browser is not supported on platform "${platform}".`,
    }
  }
  // Defence in depth: refuse shell-significant characters instead of launching.
  if (platform === 'win32' && /[&^%|<>"]/.test(file)) {
    return {
      opened: false,
      openError: `Refusing to open a path with shell-significant characters: ${file}`,
    }
  }
  try {
    await (launcher ?? defaultLauncher)(cmd.command, cmd.args)
    recordOpened(file, now)
    return { opened: true }
  } catch (err) {
    return { opened: false, openError: String(err?.message ?? err) }
  }
}

/** The `workspace_id` the domain manifest declares, or '' when it declares none. */
function declaredWorkspaceId(root) {
  const manifest = join(root, 'domaiNN_NN.md')
  if (!existsSync(manifest)) return ''
  try {
    const declared = frontmatterOf(readFileSync(manifest, 'utf8')).workspace_id
    return typeof declared === 'string' ? declared.trim() : ''
  } catch {
    return ''
  }
}

/* ── Procedure runs ────────────────────────────────────────────── */

/**
 * The procedure graphs and folded runs the console stepper shows (procedure-runner S2). The
 * graph and the state come from nn-core `procedureGraph` / `foldRun` through the payload
 * mirror, the same functions `procedure_state` calls; the browser only renders the result.
 *
 * One entry per procedure document: every exported `procedures` model, plus, in a whole-domaiNN
 * export, every other procedure a run names (read from its domain-relative path). A run whose
 * procedure lives in a bluepriNNt package (`bluepriNNt:<pkg>/<doc>`) or cannot be read keeps
 * an entry with a null graph and no state, so it is listed, never dropped. Runs are the
 * `executions` instance models of the domaiNN, ordered by id.
 *
 * @param {{ root: string, models: Array<{ filePath: string, content: string, fm: any }>,
 *   payloadModels: Array<{ filePath: string, content: string, fm: any }>, wholeDomain: boolean,
 *   helper: any, compare: (a: string, b: string) => number }} input
 */
export function collectProcedureRuns({
  root,
  models,
  payloadModels,
  wholeDomain,
  helper,
  compare,
}) {
  const relOf = (m) => relative(root, m.filePath).replace(/\\/g, '/')
  const blueprintOf = (m) => coreBlueprintOf(helper.parentSpecNameOf(m.fm))
  const entries = new Map()
  const embedBudget = { left: EMBED_TOTAL_CAP }
  const addEntry = (file, content) => {
    let graph = null
    let title = file
    if (content !== null) {
      const parsed = helper.parseKnowledge(content)
      graph = helper.procedureGraph(parsed)
      title = (parsed.frontmatter && parsed.frontmatter.title) || file
    }
    const entry = { file, title, graph, slots: [], runs: [] }
    if (content !== null)
      entry.slots = slotDeclarationsOf(helper.parseKnowledge(content).frontmatter)
    entries.set(file, entry)
    return entry
  }
  for (const m of payloadModels) {
    const file = relOf(m)
    if (
      helper.roleOf({ path: file, parentSpecName: helper.parentSpecNameOf(m.fm) }) === 'procedure'
    )
      addEntry(file, m.content)
  }
  const runs = models
    .filter((m) => blueprintOf(m) === 'executions')
    .map((m) => ({ file: relOf(m), record: helper.runModelOf(helper.parseKnowledge(m.content)) }))
    .filter((r) => r.record !== null)
    .map((r) => ({ ...r, id: r.file.split('/').slice(-2, -1)[0] || r.file }))
    .sort((a, b) => compare(a.id, b.id))
  for (const { file, record, id } of runs) {
    let entry = entries.get(record.procedure)
    if (!entry) {
      if (!wholeDomain) continue
      const abs = resolve(root, record.procedure)
      const inside =
        record.procedure !== '' &&
        !record.procedure.startsWith('bluepriNNt:') &&
        !relative(root, abs).startsWith('..')
      entry = addEntry(
        record.procedure,
        inside && existsSync(abs) ? readFileSync(abs, 'utf-8') : null,
      )
    }
    entry.runs.push({
      id,
      file,
      closed:
        record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled',
      defRev: record.defRev,
      params: record.params,
      // The write counter a Step Request pins (`base_seq`): the console must send the seq the
      // person saw, or the runner reads the request as made against an older state.
      seq: record.seq,
      // The requests the run already holds, so a person sees what became of what they asked.
      requests: record.requests ?? {},
      // The rows the fold read: the base the console projects its unsent drafts onto.
      model: runRowsOf(record),
      // The run's files the reviewer reads, carried inside the console (it is emailed alone).
      embeds: entry.graph ? embedRunArtifacts(root, entry.graph, record, embedBudget) : {},
      // The console stepper reads a run as a list of events (design §2.4 keeps the widget out
      // of the state-model change). The run model is state, not events, so these are derived
      // from its rows: the stepper keeps its contract and never sees a stale ledger.
      events: eventsOfRunModel(record),
      state: entry.graph
        ? helper.foldRun(entry.graph, record, {
            defRev: record.defRev,
            activeStepIsStale: (slug, row) => helper.crashProbe(row, { now: Date.now() }),
          })
        : null,
      // The person's final choice, once an import recorded it beside the run: the console then
      // shows it as done instead of offering the choice again.
      ...handoffOf(resolve(root, dirname(file), 'handoff.json'), id),
    })
  }
  return [...entries.values()].sort((a, b) => compare(a.file, b.file))
}

/**
 * The slots a procedure declares in its frontmatter (`slots: [{ name, kind, required,
 * default }]`), normalized for the console's "Start a run" form. A bare string is a required
 * value slot. Anything without a name is dropped. The presentation keys the form reads
 * (`type`, `label`, `options`, `source: markdown-files`, `output: { directory, suffix }`) pass
 * through when well-formed; core's slot parsing ignores them, so they never affect a run.
 */
export function slotDeclarationsOf(frontmatter) {
  const list = frontmatter && Array.isArray(frontmatter.slots) ? frontmatter.slots : []
  const out = []
  for (const raw of list) {
    const decl = typeof raw === 'string' ? { name: raw } : raw
    if (!decl || typeof decl !== 'object') continue
    const name = typeof decl.name === 'string' ? decl.name.trim() : ''
    if (!name) continue
    out.push({
      name,
      kind: typeof decl.kind === 'string' && decl.kind.trim() ? decl.kind.trim() : 'value',
      required: decl.required !== false,
      // A typed slot keeps its default as declared (a number, a list); an untyped one is text.
      ...(decl.default !== undefined && decl.default !== null
        ? { default: decl.type ? decl.default : String(decl.default) }
        : {}),
      ...(typeof decl.description === 'string' ? { description: decl.description } : {}),
      ...(typeof decl.type === 'string' ? { type: decl.type } : {}),
      ...(typeof decl.label === 'string' ? { label: decl.label } : {}),
      ...(Array.isArray(decl.options)
        ? { options: decl.options.filter((option) => typeof option === 'string') }
        : {}),
      ...(decl.source === 'markdown-files' ? { source: decl.source } : {}),
      ...(decl.output &&
      typeof decl.output.directory === 'string' &&
      typeof decl.output.suffix === 'string'
        ? { output: { directory: decl.output.directory, suffix: decl.output.suffix } }
        : {}),
    })
  }
  return out
}

/** The run rows the console projects onto: the header and one row per step and artifact. */
/**
 * The handoff an import recorded for a run (`executions/<run>/handoff.json`, written by nn-mcp
 * `run-handoff-record.ts`), as `{ handoff }`, or `{}` when there is none or it is not a valid
 * record. Read-only, like the rest of the export.
 */
function handoffOf(path, run) {
  if (!existsSync(path)) return {}
  try {
    const o = JSON.parse(readFileSync(path, 'utf-8'))
    if (
      !o ||
      !['administrator', 'agent'].includes(o.choice) ||
      typeof o.by !== 'string' ||
      typeof o.at !== 'string'
    )
      return {}
    return { handoff: { run, choice: o.choice, by: o.by, at: o.at } }
  } catch {
    return {}
  }
}

function runRowsOf(record) {
  return {
    state: record.state,
    seq: record.seq,
    procedure: record.procedure,
    defRev: record.defRev,
    params: record.params,
    steps: record.steps ?? {},
    artifacts: record.artifacts ?? {},
    inputs: record.inputs ?? {},
  }
}

/*
 * What a console carries of a run's files. It is emailed and opened with no server, so the
 * person deciding must see what they decide on inside the file itself. Caps keep one large
 * recording from making the console unsendable; anything over them stays on the owner's
 * machine and the console says so.
 */
const EMBED_TEXT_CAP = 200_000
const EMBED_IMAGE_CAP = 1_500_000
const EMBED_MEDIA_CAP = 3_000_000
const EMBED_TOTAL_CAP = 8_000_000
const EMBED_TEXT_EXT = new Set([
  'md',
  'txt',
  'csv',
  'tsv',
  'json',
  'yaml',
  'yml',
  'srt',
  'vtt',
  'log',
  'xml',
  'html',
])
const EMBED_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
}

/** Replaces each `{name}` with its run parameter; `{run}` is the run id. Unknown ones stay. */
function fillRunSlots(text, params, runId) {
  const values = { ...(params ?? {}) }
  if (runId) values.run = runId
  return String(text).replace(/\{([A-Za-z_][\w-]*)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(values, name) && values[name] !== null
      ? String(values[name])
      : whole,
  )
}

/**
 * A domain-relative file path that stays inside `root`, or null: the containment rule of
 * nn-mcp's `resolveArtifactPath` (relative, no escape, never a `*_NN.md` model), plus symlink
 * resolution. Kept local because this script carries no runtime dependency on nn-mcp.
 */
function insideRoot(root, path) {
  payloadHelper ??= loadPayloadHelper(resolveConsoleDir())
  if (
    typeof path !== 'string' ||
    !path.trim() ||
    isAbsolute(path) ||
    /\{[^}]*\}/.test(path) ||
    payloadHelper.isNNName(path.trim())
  )
    return null
  const abs = resolve(root, path)
  const rel = relative(root, abs)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  try {
    const real = realpathSync(abs)
    const realRoot = realpathSync(root)
    const realRel = relative(realRoot, real)
    if (!realRel || realRel.startsWith('..') || isAbsolute(realRel)) return null
    return real
  } catch {
    return null
  }
}

/**
 * The run's file artifacts the console embeds, by artifact slug: `{ path, kind, bytes }` plus
 * `text` (text files) or `data` (base64 of an image, audio or video), or `omitted` with the
 * reason it stayed on the owner's machine (`missing`, `too-large`, `budget`, `unsupported`).
 * Only artifacts the run produced are read, at the path the run recorded.
 */
export function embedRunArtifacts(root, graph, record, budget = { left: EMBED_TOTAL_CAP }) {
  const out = {}
  for (const [slug, def] of Object.entries(graph.artifacts ?? {})) {
    const row = record.artifacts?.[slug]
    if (!row || (row.status !== 'produced' && row.status !== 'validated')) continue
    if (row.kind && row.kind !== 'file') continue
    // The order nn-mcp's `artifactPathCandidate` resolves: the recorded value, the declared
    // `at`, then the file a `verify: file:` check names.
    const verify = typeof def.verify === 'string' ? /^file:\s*(.+)$/.exec(def.verify.trim()) : null
    const at =
      typeof def.at === 'string' ? fillRunSlots(def.at, record.params, record.id).trim() : ''
    const path =
      typeof row.value === 'string' && row.value.trim()
        ? row.value.trim()
        : at
          ? at
          : verify
            ? fillRunSlots(verify[1].trim(), record.params, record.id)
            : ''
    if (!path) continue
    const shown = path.replace(/\\/g, '/')
    const abs = insideRoot(root, path)
    if (!abs || !existsSync(abs)) {
      out[slug] = { path: shown, omitted: 'missing' }
      continue
    }
    let bytes
    try {
      bytes = readFileSync(abs)
    } catch {
      out[slug] = { path: shown, omitted: 'missing' }
      continue
    }
    const ext = (shown.split('.').pop() || '').toLowerCase()
    const mime = EMBED_MIME[ext]
    const kind = EMBED_TEXT_EXT.has(ext) ? 'text' : mime ? mime.split('/')[0] : 'unsupported'
    const cap =
      kind === 'text'
        ? EMBED_TEXT_CAP
        : kind === 'image'
          ? EMBED_IMAGE_CAP
          : kind === 'audio' || kind === 'video'
            ? EMBED_MEDIA_CAP
            : 0
    const actualRev = createHash('sha256').update(bytes).digest('hex')
    const revMismatch =
      typeof row.rev === 'string' && row.rev.trim() !== '' && row.rev.trim() !== actualRev
    const base = {
      path: shown,
      kind,
      bytes: bytes.length,
      ...(revMismatch ? { mismatch: true } : {}),
    }
    if (kind === 'unsupported') out[slug] = { ...base, omitted: 'unsupported' }
    else if (bytes.length > cap) out[slug] = { ...base, omitted: 'too-large' }
    else if (bytes.length > budget.left) out[slug] = { ...base, omitted: 'budget' }
    else {
      budget.left -= bytes.length
      out[slug] =
        kind === 'text'
          ? { ...base, text: bytes.toString('utf8') }
          : { ...base, mime, data: bytes.toString('base64') }
    }
  }
  return out
}

/**
 * The stepper's event view of a run model (design §2.4): every row that carries state becomes
 * the event that state implies, in a stable order (header, then steps, then artifacts). The
 * console widget reads events, and the run model is state; this is the one translation between
 * the two, so the widget keeps working without a second ledger in the domain.
 */
function eventsOfRunModel(record) {
  /** @type {Array<Record<string, unknown>>} */
  const events = [{ kind: 'started', actor: 'engine' }]
  for (const [slug, row] of Object.entries(record.steps ?? {})) {
    if (row.attempt > 0) events.push({ kind: 'step_started', step: slug, attempt: row.attempt })
    if (row.status === 'waiting')
      events.push({ kind: 'step_waiting', step: slug, value: row.waitingOn ?? '' })
    if (row.status === 'done')
      events.push({
        kind: 'step_completed',
        step: slug,
        ...(row.outcome !== undefined ? { outcome: row.outcome } : {}),
        ...(row.next !== undefined ? { next: row.next } : {}),
      })
    if (row.status === 'failed')
      events.push({ kind: 'step_failed', step: slug, value: row.failure ?? '' })
  }
  for (const [slug, row] of Object.entries(record.artifacts ?? {})) {
    if (row.status === 'validated' || row.status === 'rejected' || row.status === 'produced')
      events.push({
        kind: `artifact_${row.status}`,
        field: slug,
        ...(row.value !== undefined ? { value: row.value } : {}),
        ...(row.rev !== undefined ? { rev: row.rev } : {}),
      })
  }
  if (record.state === 'paused') events.push({ kind: 'interrupted' })
  if (record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled')
    events.push({ kind: record.state })
  return events
}

/* ── Model discovery ───────────────────────────────────────────── */

async function loadModels(root, onWarning = writeExportWarning) {
  const { compareCodeUnits } = await viewsLibOnce()
  const models = []
  const files = await findModelFiles(root, onWarning)
  const linkedProcedureModels = collectForeignProcedureTargets(root, files)
  for (const f of files) {
    const content = await readFile(f, 'utf-8')
    if (
      isModelDocument(relative(root, f).replace(/\\/g, '/'), content, linkedProcedureModels) &&
      isLevel3(content)
    ) {
      const stem = payloadHelper.displayStem(basename(f))
      models.push({
        filePath: f,
        name: stem,
        content,
        fm: frontmatterOf(content),
      })
    }
  }
  models.sort((a, b) => compareCodeUnits(a.filePath, b.filePath))
  return models
}

/**
 * The domain index of `root` (nn-core `discoverDomainModels` + `buildDomainIndex`, as
 * nn-mcp's `buildNodeDomainIndex`): the single source of model ids. The declared
 * storage of each bluepriNNt comes from the schemas the export already resolved; a
 * bluepriNNt no exported model pins reads as declaring no storage (compact), the
 * non-strict reading, so resolving never touches the network.
 */
async function buildExportDomainIndex(root, models, schemaResolutions) {
  const keyOf = (name, url) => `${name}\n${url ?? ''}`
  const declared = new Map()
  const declaredByName = new Map()
  for (const m of models) {
    const spec = (m.fm ?? frontmatterOf(m.content))?.parent_spec
    const name = typeof spec === 'string' ? spec : spec?.name
    if (typeof name !== 'string' || name === '') continue
    const url =
      spec && typeof spec === 'object' && typeof spec.url === 'string' ? spec.url : undefined
    const concepts = schemaResolutions.get(m)?.schema?.concepts || []
    const storage = new Map(concepts.filter((c) => c && c.storage).map((c) => [c.name, c.storage]))
    if (!declared.has(keyOf(name, url))) declared.set(keyOf(name, url), storage)
    if (!declaredByName.has(name)) declaredByName.set(name, storage)
  }
  const discovered = await payloadHelper.discoverDomainModels(root)
  return payloadHelper.buildDomainIndex(
    discovered.map((d) => d.input),
    ({ name, url }) => declared.get(keyOf(name, url)) ?? declaredByName.get(name) ?? new Map(),
  )
}

/**
 * Atomic replace: write `<file>.tmp`, then rename it over `file`.
 * On Windows, handles transient EPERM/EBUSY/EACCES locks with backoff retries (#188, Decision D23).
 * A copy fallback is deliberately refused: it abandons atomicity and can leave a half-written console.
 */
export async function writeFileAtomic(file, text, options = {}) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  const maxRetries = options.maxRetries ?? 5
  const renameFn = options.rename ?? rename
  const sleepFn = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  try {
    await writeFile(tmp, text, 'utf-8')
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {})
    throw err
  }
  let attempt = 0
  while (true) {
    try {
      await renameFn(tmp, file)
      return
    } catch (err) {
      const isLockError = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES'
      if (isLockError && attempt < maxRetries) {
        attempt++
        await sleepFn(attempt * 25)
        continue
      }
      await rm(tmp, { force: true }).catch(() => {})
      throw err
    }
  }
}

/** Per-model `knowledge_version` + content `sha256` embedded in the console meta, keyed by model id. */
function versionsOf(modelSummaries) {
  const out = {}
  for (const s of modelSummaries) out[s.id] = { knowledge_version: s.version, sha256: s.sha256 }
  return out
}

/** `<file>.<ext>_sidecar_NN.md` — detection and subject mapping come from the naming contract. */
function isSidecarRel(rel) {
  return payloadHelper && payloadHelper.isSidecarPath ? payloadHelper.isSidecarPath(rel) : false
}

/**
 * Console build outputs, sidecar documents and append-only `.jsonl` logs are not
 * workspace content: inventorying them would embed the console inside itself
 * (changing the payload on every export) or resurrect retired ledger surfaces.
 */
function isBuildOutputRel(rel) {
  const posix = String(rel || '').replace(/\\/g, '/')
  const base = posix.split('/').pop() || ''
  if (/\.(jsonl|ndjson)$/i.test(base)) return true
  if (/^domaiNN_console.*\.html$/i.test(base)) return true
  if (/\.html$/i.test(base) && /_(console|view)$/i.test(posix.split('/').slice(-2, -1)[0] || ''))
    return true
  return /^\w+_console\.html$/i.test(base)
}

// Preview budget. A preview is an EXCERPT, never a document body: it reuses the
// same cap the citation pipeline applies (EXCERPT_CHAR_CAP, 500 chars), so the
// console never embeds a source body it would not embed as a citation. The total
// preview weight is also capped because the payload is inlined in one HTML file.
const SNIPPET_TOTAL_BUDGET = 2 * 1024 * 1024

// Change history is the heaviest part of the payload: every change becomes an
// element and every element carries its history. Embed it only while it stays
// under this budget; above it the console omits the history and shows a notice
// with a copyable agent prompt.
const CHANGES_EMBED_MAX_BYTES = 20 * 1024 * 1024
const CHANGES_EMBED_MAX_COUNT = 5000

function injectChangesNotice(html, info) {
  const prompt = `This domain's console omits its change history because it is too large to embed (${info.count} changes, ${Math.round(info.bytes / 1e6)} MB). Use the agent to read the lineage and the change history for this domain (check_domain, read_lineage, query_units) and answer this: `
  const banner = `
<div id="nn-changes-omitted" style="position:fixed;right:16px;bottom:16px;z-index:99999;max-width:440px;background:#111827;color:#f9fafb;border:1px solid #374151;border-radius:10px;padding:12px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)">
  <div style="flex:1">
    <strong>Change history omitted</strong><br>
    This console embeds no change history (${info.count} changes) to keep it responsive. The history is in <code>changes/</code>; ask the agent to query it.
    <div style="margin-top:8px;display:flex;gap:8px">
      <button id="nn-copy-changes-prompt" type="button" style="cursor:pointer;border:0;border-radius:6px;padding:6px 10px;background:#3b82f6;color:#fff;font:inherit">Copy prompt</button>
      <button id="nn-dismiss-changes-notice" type="button" style="cursor:pointer;border:1px solid #4b5563;border-radius:6px;padding:6px 10px;background:transparent;color:#e5e7eb;font:inherit">Dismiss</button>
    </div>
  </div>
</div>
<script>
(function(){
  var prompt = ${JSON.stringify(prompt)};
  var b = document.getElementById('nn-copy-changes-prompt');
  var d = document.getElementById('nn-dismiss-changes-notice');
  var n = document.getElementById('nn-changes-omitted');
  if (b) b.addEventListener('click', function(){
    var done = function(){ b.textContent = 'Copied'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).then(done, done);
    else { var t=document.createElement('textarea'); t.value=prompt; document.body.appendChild(t); t.select(); try{document.execCommand('copy')}catch(e){} t.remove(); done(); }
  });
  if (d && n) d.addEventListener('click', function(){ n.remove(); });
})();
</script>`
  return html.replace(/<\/body>/i, () => banner + '\n</body>')
}

function snippetCharCap() {
  const fromHelper = payloadHelper && payloadHelper.EXCERPT_CHAR_CAP
  return Number.isFinite(fromHelper) && fromHelper > 0 ? fromHelper : 500
}

/** Streams a file through SHA-256 so multi-hundred-MB sources never load in memory. */
async function hashFileStream(filePath) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

/**
 * Scans workspace files across sources/, assets/, evidence/, artifacts/ and
 * conversations/; computes hashes, metadata, sidecar states, unit citations,
 * changeset evidence links, reverse lineage for artifacts, gap stats, and the
 * origins declared by the sources catalog or recorded in sidecars.
 *
 * @param {string} workspaceRoot
 * @param {{ elements?: Array<any>, changesets?: Array<any>, onWarning?: (message: string) => void }} [options]
 */
export async function collectWorkspaceFiles(workspaceRoot, options = {}) {
  const root = resolve(workspaceRoot)
  const elements = options.elements || []
  const changesets = options.changesets || []
  // The export's warning channel by default; a caller (or a test) may pass its own.
  const onWarning = options.onWarning ?? writeExportWarning

  const scanDirs = ['sources', 'assets', 'evidence', 'artifacts', 'conversations', 'entregables']
  const inventory = []
  const artifactsList = []
  const sourceFilesList = []

  async function walk(dirAbs) {
    // An optional scan folder that does not exist is a normal workspace, not a
    // failure: nothing to report and nothing to walk.
    if (!existsSync(dirAbs)) return []
    const results = []
    try {
      const entries = await readdir(dirAbs, { withFileTypes: true })
      for (const ent of entries) {
        const full = join(dirAbs, ent.name)
        if (ent.isDirectory()) {
          if (ent.name === 'node_modules' || ent.name === '.git') continue
          const sub = await walk(full)
          results.push(...sub)
        } else if (ent.isFile()) {
          results.push(full)
        }
      }
    } catch (err) {
      // Ignoring an unreadable directory silently shrinks the domain; report it.
      const problem = scanReadWarning('read directory', dirAbs, err)
      if (problem) onWarning(problem)
    }
    return results
  }

  const allFilePaths = new Set()
  for (const d of scanDirs) {
    const p = join(root, d)
    const files = await walk(p)
    for (const f of files) allFilePaths.add(f)
  }

  // Sweep file paths recorded in NN Run Artifact or declared in NN Artifact
  const declaredArtifactPaths = new Set()
  for (const el of elements) {
    if (!el || !el.concept) continue
    const c = el.concept.toLowerCase().replace(/[\s_]+/g, '')
    if (c === 'runartifact' || c === 'artifact') {
      const f = el.fields || {}
      const candidates = [f.value, f.at, el.value, el.at]
      for (const cand of candidates) {
        if (typeof cand === 'string' && cand.trim() && !cand.includes('{')) {
          const norm = cand.trim().replace(/\\/g, '/').replace(/^\/+/, '')
          const full = join(root, norm)
          if (existsSync(full)) {
            try {
              if (statSync(full).isFile()) {
                allFilePaths.add(full)
                declaredArtifactPaths.add(norm)
              }
            } catch {
              // ignore stat error on sweep
            }
          }
        }
      }
    }
  }

  const domainConsole = join(root, 'domaiNN_console.html')
  if (existsSync(domainConsole)) {
    allFilePaths.add(domainConsole)
  }

  // Pre-index sidecars. The workspace convention is `<file>.<ext>_sidecar_NN.md`
  // (naming/contract.ts `isSidecarName`), a markdown document with YAML frontmatter.
  const sidecarFilesMap = new Map()
  for (const f of allFilePaths) {
    const rel = relative(root, f).replace(/\\/g, '/')
    if (isSidecarRel(rel)) {
      sidecarFilesMap.set(payloadHelper.sidecarSubjectPath(rel), f)
    }
  }

  // Map elements citations and changeset evidence for fast lookup. A unit cites
  // the normalized sidecar document (`<file>.<ext>_sidecar_NN.md`); the inventory
  // entry is the subject file, so both sides are normalized to that path.
  function normalizeCitationPath(raw) {
    const norm = String(raw).replace(/\\/g, '/').replace(/^\/+/, '').split('#')[0]
    return payloadHelper && payloadHelper.isSidecarPath && payloadHelper.isSidecarPath(norm)
      ? payloadHelper.sidecarSubjectPath(norm)
      : norm
  }

  const citationPaths = []
  for (const el of elements) {
    if (el.citations && typeof el.citations === 'object') {
      for (const list of Object.values(el.citations)) {
        if (Array.isArray(list)) {
          for (const cit of list) {
            const raw = cit.path || cit.href
            if (raw) {
              citationPaths.push({
                norm: normalizeCitationPath(raw),
                excerpt: cit.excerpt,
                unitId: el.id,
              })
            }
          }
        }
      }
    }
  }

  const changeEvidencePaths = []
  for (const cs of changesets) {
    if (cs.evidence) changeEvidencePaths.push(normalizeCitationPath(cs.evidence))
    if (Array.isArray(cs.changes)) {
      for (const c of cs.changes) {
        if (c.evidence) changeEvidencePaths.push(normalizeCitationPath(c.evidence))
      }
    }
  }

  // Sort paths deterministically
  const sortedFilePaths = Array.from(allFilePaths).sort()

  // A reference resolves by path first: exact, then a suffix of one another. A
  // directory-less reference has no path to compare, so it resolves by basename
  // only when that name is unique among the inventory files; two same-named files
  // in different folders must never each receive the other's citation.
  const basenameCounts = new Map()
  for (const fullPath of sortedFilePaths) {
    const rel = relative(root, fullPath).replace(/\\/g, '/')
    if (isSidecarRel(rel) || isBuildOutputRel(rel)) continue
    const name = basename(rel)
    basenameCounts.set(name, (basenameCounts.get(name) ?? 0) + 1)
  }
  function referenceMatches(norm, rel) {
    if (norm.includes('/')) {
      return norm === rel || rel.endsWith('/' + norm) || norm.endsWith('/' + rel)
    }
    if (norm === rel) return true
    return basename(rel) === norm && basenameCounts.get(norm) === 1
  }

  let snippetBudget = SNIPPET_TOTAL_BUDGET

  for (const fullPath of sortedFilePaths) {
    const rel = relative(root, fullPath).replace(/\\/g, '/')

    // A sidecar is metadata for its subject, never an inventory entry of its own.
    if (isSidecarRel(rel)) continue

    // Console outputs and feedback ledgers are not workspace content.
    if (isBuildOutputRel(rel)) continue

    let st
    try {
      st = await stat(fullPath)
    } catch (err) {
      // `walk` listed this path and it then could not be stat'ed: a read failure
      // (permissions, I/O) must be named, not silently dropped from the inventory.
      const problem = scanReadWarning('stat', fullPath, err)
      if (problem) onWarning(problem)
      continue
    }

    let sha256 = ''
    try {
      sha256 = await hashFileStream(fullPath)
    } catch (err) {
      const problem = scanReadWarning('read file', fullPath, err)
      if (problem) onWarning(problem)
      continue
    }

    const mimeType =
      payloadHelper && payloadHelper.mimeTypeFromPath
        ? payloadHelper.mimeTypeFromPath(rel)
        : 'application/octet-stream'

    let category =
      payloadHelper && payloadHelper.classifyFileCategory
        ? payloadHelper.classifyFileCategory(rel)
        : 'source'

    if (category === 'unclassified' && declaredArtifactPaths.has(rel)) {
      category = 'artifact'
    }

    const isSourceLike =
      payloadHelper && payloadHelper.isSourceLike
        ? payloadHelper.isSourceLike(category)
        : category === 'source'

    // Sidecar detection: the canonical `<rel>_sidecar_NN.md` companion.
    let sidecar = undefined
    const companionSidecarRel =
      payloadHelper && payloadHelper.sidecarPathFor
        ? payloadHelper.sidecarPathFor(rel)
        : rel + '_sidecar_NN.md'
    const companionSidecarPath = sidecarFilesMap.get(rel)
    if (companionSidecarPath) {
      let sidecarContent = ''
      try {
        sidecarContent = await readFile(companionSidecarPath, 'utf8')
      } catch {
        // unreadable
      }
      sidecar =
        payloadHelper && payloadHelper.parseAndValidateSidecar
          ? payloadHelper.parseAndValidateSidecar(sidecarContent, companionSidecarRel, sha256)
          : {
              path: companionSidecarRel,
              exists: true,
              valid: false,
              error: 'Sidecar helpers unavailable',
            }
    } else if ((isSourceLike || category === 'asset') && !payloadHelper.isMirrorFile(rel)) {
      sidecar = { path: companionSidecarRel, exists: false, valid: false }
    }

    // Cross-reference citations
    let citationsCount = 0
    let excerptCount = 0
    for (const c of citationPaths) {
      if (referenceMatches(c.norm, rel)) {
        citationsCount++
        if (c.excerpt) excerptCount++
      }
    }

    // Cross-reference changes
    let changesCount = 0
    for (const ev of changeEvidencePaths) {
      if (referenceMatches(ev, rel)) {
        changesCount++
      }
    }

    const uncited = isSourceLike && citationsCount === 0 && changesCount === 0

    // Bounded text preview: an excerpt, capped like a citation excerpt. Binaries
    // are never inlined, and the whole payload shares one preview budget.
    let snippet = undefined
    let snippetTruncated = false
    const textMime =
      payloadHelper && payloadHelper.isTextMime
        ? payloadHelper.isTextMime(mimeType)
        : mimeType.startsWith('text/')
    if (textMime && st.size > 0 && snippetBudget > 0) {
      const want = Math.min(st.size, snippetCharCap(), snippetBudget)
      try {
        const buf = Buffer.alloc(want)
        const handle = await open(fullPath, 'r')
        try {
          await handle.read(buf, 0, want, 0)
        } finally {
          await handle.close()
        }
        // StringDecoder withholds an incomplete trailing sequence, so a cut that
        // lands inside a multi-byte code point never emits U+FFFD.
        snippet = new StringDecoder('utf8').write(buf)
        snippetTruncated = want < st.size
        snippetBudget -= want
      } catch {
        // unreadable preview: keep the metadata
      }
    }

    const entry = {
      id: rel,
      path: rel,
      category,
      size: st.size,
      sha256,
      mimeType,
      mtime: st.mtime.toISOString(),
      ...(sidecar ? { sidecar } : {}),
      citationsCount,
      excerptCount,
      changesCount,
      uncited,
      ...(snippet !== undefined ? { snippet, snippetTruncated } : {}),
    }

    inventory.push(entry)

    if (category === 'artifact') {
      artifactsList.push({ id: rel, path: rel, content: snippet })
    } else if (isSourceLike) {
      sourceFilesList.push({ id: rel, path: rel })
    }
  }

  // Origins: the Synchronization elements of the sources catalog plus the origin
  // keys recorded in sidecars. A folder name never makes one.
  let synchronizations = []
  const catalogPath = join(root, 'sources', 'sources_NN.md')
  if (existsSync(catalogPath)) {
    try {
      synchronizations = payloadHelper.readSynchronizations(
        await readFile(catalogPath, 'utf8'),
      ).synchronizations
    } catch {
      // an unreadable catalog declares nothing
    }
  }
  const origins = payloadHelper.buildOrigins(synchronizations, inventory)

  // Reverse lineage
  const lineage =
    payloadHelper && payloadHelper.resolveArtifactReverseLineage
      ? payloadHelper.resolveArtifactReverseLineage(
          artifactsList,
          elements,
          changesets,
          sourceFilesList,
        )
      : {}

  // Stats
  const stats =
    payloadHelper && payloadHelper.calculateFilesStats
      ? payloadHelper.calculateFilesStats(inventory)
      : {
          totalFiles: inventory.length,
          totalBytes: inventory.reduce((a, b) => a + (b.size || 0), 0),
          categoryCounts: { source: 0, asset: 0, evidence: 0, artifact: 0, unclassified: 0 },
          storageByCategory: { source: 0, asset: 0, evidence: 0, artifact: 0, unclassified: 0 },
          sourceCoverageRate: 1,
          uncitedSourceCount: 0,
          sidecarMissingCount: 0,
          sidecarInvalidCount: 0,
          sidecarMismatchCount: 0,
          excerptCount: 0,
        }

  return {
    inventory,
    origins,
    stats,
    lineage,
  }
}

/**
 * The single console writer, shared by the CLI and the MCP.
 *
 * Options: rootDir (domain root); scope ("domain" by default, { model: id } for one
 * model, or { selected: models } for the CLI multi-model selection); view (a lone view
 * export, written as a write-once family); open (default true); launcher (injected
 * opener, for tests); platform (default process.platform); log (progress lines,
 * default silent so the MCP never writes to stdout); warn (the
 * `WARNING: [export-console] …` stderr channel, default this process's stderr, which
 * is what the MCP gets); models (pre-scanned models);
 * stagingDir (write the page there instead of at its final path, for a caller that then
 * moves it into place); changes (false omits the changesets).
 *
 * A delivery page — a scope that carries `delivery`, an outFile under `deliveries/vN/`,
 * a stagingDir or the conntent-delivery view — carries no cost, budget, ledger or prompt
 * data, and it is immutable.
 *
 * Resolves to { path, relativePath, status ("written", "unchanged" or "error"),
 * knowledgeVersions, opened, alreadyOpen?, openError?, error? }. A status of "error" is
 * a refused write, the delivery page already existing: it is the only case that sets
 * error, and nothing was written. Throws ConsoleExportError.
 */
export async function writeConsole(opts = {}) {
  const {
    rootDir,
    scope = 'domain',
    open = true,
    launcher,
    platform = process.platform,
    openCooldownMinutes,
    log = () => {},
    warn = writeExportWarning,
  } = opts
  const scopeObj = typeof scope === 'object' && scope !== null ? scope : {}
  let view = opts.view ?? null
  if (!view && typeof scopeObj.view === 'string' && scopeObj.view) view = scopeObj.view
  if (!rootDir) throw new ConsoleExportError('writeConsole needs a rootDir.', 'ROOT_REQUIRED')
  const root = resolve(rootDir)
  const { consoleDir, shellPath, bundlePath } = await ensureAssets()
  const shell = await readFile(shellPath, 'utf-8')
  const bundle = existsSync(bundlePath) ? await readFile(bundlePath, 'utf-8') : null

  const models = opts.models ?? (await loadModels(root, warn))

  const wholeDomain = scope === 'domain'
  let selected = []
  if (!wholeDomain) {
    if (Array.isArray(scope.selected)) {
      selected = scope.selected
    } else if (Array.isArray(scopeObj.models)) {
      const wanted = new Set(scopeObj.models.map(String))
      selected = models.filter(
        (m) =>
          wanted.has(String(m.name)) ||
          wanted.has(basename(m.filePath).replace(/\.[^/.]+$/, '')) ||
          (m.id !== undefined && wanted.has(String(m.id))),
      )
      if (selected.length === 0) {
        throw new ConsoleExportError(
          `No model in ${JSON.stringify(scopeObj.models)} found in ${root}.`,
          'MODEL_NOT_FOUND',
        )
      }
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

  // The shell ships a release-pinned CDN ref (e.g. @nn-console-v0.1.0) in its
  // default config and static <script> tags. Those tags are not injectSlots targets, so
  // normalize every occurrence to the ref derived from the vendored bundle banner —
  // otherwise a generated console loads a stale bundle version first (#95).
  const resolvedShell = shell.replace(/@(?:nn|innfo)-console-v\d+\.\d+\.\d+/g, `@${consoleCdnRef}`)

  // The single shell inlines its bundle, CSS and views, so every export — scoped or
  // whole-domaiNN — needs the sibling view lib and the CSS. A bad view or a missing
  // asset is reported before anything is written.
  const viewsLib = await loadViewsLib()
  // Where bluepriNNt packages (and their console views) live, resolved once.
  const packagesDir = consolePackagesDir(consoleDir)
  const uiCssPath = uiCssPathFor(consoleDir)
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
  const changesBytes = Buffer.byteLength(JSON.stringify(changesets), 'utf8')
  const changeCount = (Array.isArray(changesets) ? changesets : []).reduce(
    (n, cs) => n + (Array.isArray(cs.changes) ? cs.changes.length : 0),
    0,
  )
  const omitChanges =
    opts.changes === false ||
    changesBytes > CHANGES_EMBED_MAX_BYTES ||
    changeCount > CHANGES_EMBED_MAX_COUNT
  const payloadChangesets = omitChanges ? [] : changesets

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
      onWarning: warn,
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
    preparedAssets = viewsLib.assertInlinable(resolvedShell, {
      bundle,
      css: uiCss,
      views: domainViews,
    })
  } catch (err) {
    throw new ConsoleExportError(err.message, 'VIEWS_INVALID')
  }

  // Views that ship a `console-view-<slug>.data.mjs` collect their facts here, at export
  // time (decision A12). The result reaches each view as `ctx.viewData`; nothing is read
  // from disk at runtime, so the console stays static and offline.
  let viewData
  try {
    viewData = await viewsLib.collectViewData({
      views: domainViews,
      rootDir: root,
      models: payloadModels,
    })
  } catch (err) {
    throw new ConsoleExportError(err.message, 'VIEW_DATA_INVALID')
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
      cdn: `https://cdn.jsdelivr.net/gh/cogNNitive/cogNNitive@${consoleCdnRef}/iNNfo/specs/bluepriNNts/console/nn-console.bundle.js`,
      fallback:
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/console/nn-console.bundle.js',
    },
  }
  // The whole-domaiNN console opens on the Domain tab; a single-model console keeps
  // Knowledge as its landing page.
  if (wholeDomain) config.defaultView = 'domain'

  const resolver = payloadHelper.createFsSourceResolver
    ? payloadHelper.createFsSourceResolver(root)
    : undefined

  // Single shared schema path (nn-core) — the same helper the console payload
  // mirror uses, so every producer emits byte-identical slots.
  const resolveModelSchema = async (content) => {
    const fm = frontmatterOf(content)
    if (!fm?.parent_spec?.name) return { schema: undefined, procedures: [], catalog: null }
    try {
      const resolution = await payloadHelper.resolveConsoleSchema({
        rootDir: root,
        parentName: fm.parent_spec.name,
        parentUrl: fm.parent_spec.url,
        // The library tier is where bluepriNNt packages live, and it defaults to the
        // machine's `~/.agents/bluepriNNts`. Pinning it to `consolePackagesDir` keeps a
        // checkout exporting against the blueprints it carries: otherwise the same commit
        // exports two consoles, one from the repository's `procedures` package and one from
        // whatever that machine installed (observed in batch b18: a domain with
        // `parent_spec: procedures_V_0-4-0` resolved a full Procedure/Work schema here and a
        // derived one on CI, 11 KB apart in the schema slot).
        globalDir: consolePackagesDir(consoleDir),
      })
      for (const warning of resolution.warnings) {
        warn(warning)
      }
      return {
        schema: resolution.schema,
        procedures: resolution.procedures,
        catalog: resolution.catalog,
      }
    } catch (err) {
      warn(`Schema resolution failed: ${err?.message ?? err}`)
      return { schema: undefined, procedures: [], catalog: null }
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
  const seenProcedureSources = new Set()
  const procedureWinners = new Map()
  const modelSummaries = []
  const blueprintUses = []
  const scopeModelIds = []
  // Distinct sources cited across every model in the domain (for `meta.domain.sourceCount`).
  const domainSources = new Set()
  // The changes bluepriNNt version every model payload was built against (identical across models).
  let changesBlueprintVersion = ''
  let blueprintCatalog = null

  // Each model's schema, resolved once in model order (the same warnings as before), so
  // the domain index can read the declared storage before any payload is built.
  const schemaResolutions = new Map()
  for (const m of payloadModels) schemaResolutions.set(m, await resolveModelSchema(m.content))
  const domainIndex = await buildExportDomainIndex(root, payloadModels, schemaResolutions)

  // A model no applied change names was written as a raw file and registered by
  // `sync_domain_manifest`, outside every changeset (#587): its elements carry no
  // history, so the console Changes tab opens empty. Report it on the warning
  // channel — the guard moves no exit code and no payload byte, and a recorded
  // model stays silent.
  if (payloadHelper.auditModelRecords && payloadHelper.buildChangeLogFromChangesets) {
    const exported = new Set(
      payloadModels.map((m) => relative(root, m.filePath).replace(/\\/g, '/')),
    )
    const log = payloadHelper.buildChangeLogFromChangesets(
      Array.isArray(changesets) ? changesets : [],
    )
    for (const diagnostic of payloadHelper.auditModelRecords(
      log,
      domainIndex.models
        .filter((m) => exported.has(m.path))
        .map((m) => ({ modelId: m.id, path: m.path })),
    )) {
      warn(diagnostic.message)
    }
  }

  // Change counts per model part, aggregated once: the per-model loop must not rescan
  // every changeset. A model named by its stem, its id and its title in different
  // changes is counted once per change, never once per alias.
  const changeCountByModelPart = new Map()
  for (const cs of Array.isArray(changesets) ? changesets : []) {
    for (const c of Array.isArray(cs?.changes) ? cs.changes : []) {
      if (!c || !c.target) continue
      const target = String(c.target)
      const at = target.indexOf('@')
      const modelPart = (at === -1 ? target : target.slice(0, at)).trim().toLowerCase()
      if (modelPart === '') continue
      changeCountByModelPart.set(modelPart, (changeCountByModelPart.get(modelPart) || 0) + 1)
    }
  }

  for (const m of payloadModels) {
    const relPath = relative(root, m.filePath).replace(/\\/g, '/')
    const fileName = basename(relPath)
    const modelStem = fileName.replace(/\.[^/.]+$/, '')
    const modelSchemaResolution = schemaResolutions.get(m)
    if (modelSchemaResolution.catalog) {
      if (!blueprintCatalog) {
        blueprintCatalog = { models: {}, voices: {} }
      }
      Object.assign(blueprintCatalog.models, modelSchemaResolution.catalog.models || {})
      Object.assign(blueprintCatalog.voices, modelSchemaResolution.catalog.voices || {})
    }
    const indexModelId = domainIndex.byPath(relPath)?.id
    const stem = payloadHelper.displayStem(fileName)
    const mTitle = m.fm && (m.fm.title || m.fm.name)
    const baseStem = (stem || modelStem).replace(/_V_[0-9].*$/i, '')
    const modelKeys = new Set(
      [
        baseStem,
        stem,
        mTitle,
        fileName,
        modelStem,
        modelStem.replace(/_NN$/i, ''),
        modelStem.replace(/_NN$/i, '').replace(/_V_[0-9].*$/i, ''),
        relPath,
        relPath.replace(/\.[^/.]+$/, ''),
        relPath.replace(/(_NN)?\.[^/.]+$/, ''),
        relPath.replace(/(_NN)?\.[^/.]+$/, '').replace(/_V_[0-9].*$/i, ''),
        indexModelId,
        indexModelId && indexModelId.includes('/') ? indexModelId.split('/').pop() : null,
        indexModelId && indexModelId.includes('/')
          ? indexModelId
              .split('/')
              .pop()
              .replace(/_V_[0-9].*$/i, '')
          : null,
      ]
        .filter(Boolean)
        .map(function (v) {
          return String(v).toLowerCase()
        }),
    )
    const payload = payloadHelper.buildConsolePayload({
      content: m.content,
      path: relPath,
      resolver,
      changesets: payloadChangesets,
      schema: modelSchemaResolution.schema,
      procedures: modelSchemaResolution.procedures,
      // The domain index id: `<container>/<slug>` for a distributed instance, the stem
      // for a compact model. A model the index cannot address keeps the stem (#606).
      modelId: indexModelId,
      modelKeys,
    })
    if (payload && payload.model) {
      changesBlueprintVersion =
        (payload.model.meta && payload.model.meta.changesBlueprintVersion) ||
        changesBlueprintVersion
      for (const s of (payload.model.meta && payload.model.meta.sources) || []) {
        if (typeof s === 'string' && s) domainSources.add(s)
      }
      const mTitle =
        (payload.model.meta && (payload.model.meta.title || payload.model.meta.model)) || modelStem
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
            el.modelFile = relPath
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
            mat.modelFile = relPath
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
      // record), matched by the model part of each change's D5 target. A repeated
      // spelling (title equal to stem) is one key, so it is not counted twice.
      const modelKeys = new Set(
        [mTitle, mId, modelStem].map(function (v) {
          return String(v || '').toLowerCase()
        }),
      )
      const changeCount = Array.from(modelKeys).reduce(function (n, key) {
        return n + (changeCountByModelPart.get(key) || 0)
      }, 0)
      blueprintUses.push({
        modelId: mId,
        name: blueprintParsed ? blueprintParsed.base : null,
        url: (m.fm && m.fm.parent_spec && m.fm.parent_spec.url) || null,
      })
      const rawStorage = domainIndex.byPath(relPath)?.storage
      const isMisplaced = domainIndex.diagnostics.some(
        (d) => d.code === 'PLACEMENT_MISMATCH' && d.paths.includes(relPath),
      )
      const isMixed = domainIndex.diagnostics.some(
        (d) => d.code === 'MIXED_INSTANCE_MODEL' && d.paths.includes(relPath),
      )
      const storage = rawStorage ? { ...rawStorage } : { kind: 'compact' }
      if (isMisplaced) storage.placement = 'PLACEMENT_MISMATCH'
      if (isMixed) storage.problem = 'mixed'

      modelSummaries.push({
        id: mId,
        title: mTitle,
        filePath: relPath,
        blueprint: blueprintParsed ? blueprintParsed.base : null,
        family: blueprintFamily,
        version: (m.fm && m.fm.knowledge_version) || null,
        sha256: (payload.model.meta && payload.model.meta.sha256) || computeSha256(m.content),
        citationsResolvedAt: (payload.model.meta && payload.model.meta.citationsResolvedAt) || null,
        sources: (payload.model.meta && payload.model.meta.sources) || [],
        changeCount: changeCount,
        ownership: (payload.model.meta && payload.model.meta.ownership) || 'authored',
        conceptNames: Array.from(modelConcepts),
        // Every concept the model's bluepriNNt declares, with or without elements.
        declaredConcepts: Array.from(
          new Set(
            (payload && payload.schema && Array.isArray(payload.schema.concepts)
              ? payload.schema.concepts
              : []
            )
              .map((c) => (typeof c === 'string' ? c : c && c.name))
              .filter(Boolean),
          ),
        ),
        elementCount: Array.isArray(payload.model.elements) ? payload.model.elements.length : 0,
        storage,
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
          warn(
            `Field ${f.concept}.${f.name} is declared differently by more than one bluepriNNt; keeping the first declaration`,
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
          const key =
            d && d.name
              ? `${(d.declaredBy && d.declaredBy.family) || ''}\u0000${String(d.name).toLowerCase()}`
              : ''
          if (!key || seen.has(key)) continue
          seen.add(key)
          out.push(d)
        }
      }
    }
    // Aggregate the blueprint procedure catalog (parent + includes) across the
    // exported models; the stepper reads `usage` first. A blueprint is aggregated
    // once (models sharing a parent_spec repeat the same catalog, which is not a
    // clash). When another blueprint (or an include) declares an id already taken,
    // the entry is kept and marked `shadowed` naming the winner's source, never
    // dropped (same `status` / `shadowed_by` shape as `list_blueprint_procedures`).
    const procSource = String(frontmatterOf(m.content)?.parent_spec?.name ?? '')
    if (!seenProcedureSources.has(procSource)) {
      seenProcedureSources.add(procSource)
      for (const p of modelSchemaResolution.procedures) {
        if (!p || !p.id) continue
        const winner = procedureWinners.get(p.id)
        if (winner === undefined) {
          procedureWinners.set(p.id, procSource)
          allProcedures.push({ ...p, status: 'selected' })
        } else {
          allProcedures.push({ ...p, status: 'shadowed', shadowed_by: winner })
        }
      }
    }
  }

  // Change B: materialize the `changes` collection (structure: members) — one unit per
  // `Change` across every batch document, the batch being the grouping. Read-only.
  if (Array.isArray(payloadChangesets) && payloadChangesets.length > 0) {
    const CHANGES_MODEL_ID = 'changes'
    const CHANGES_MODEL_TITLE = 'Changes'
    let changeUnitCount = 0
    for (const cs of payloadChangesets) {
      const batch = (String(cs.path).split('/').pop() || '').replace(/\.[^/.]+$/, '')
      for (const c of cs.changes) {
        const id = `${batch}#${c.id}`
        const name = `${c.op} ${c.target}`
        const description = c.notes || ''
        const fields = { op: c.op, target: c.target }
        // set_fields carries `from`/`to` as JSON objects: show one row per field
        // (`to.<field>`, `from.<field>`) instead of the raw JSON string.
        const payloadOf = (raw) => {
          if (c.op !== 'set_fields' || typeof raw !== 'string') return null
          try {
            const parsed = JSON.parse(raw)
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
          } catch {
            return null
          }
        }
        for (const key of ['from', 'to']) {
          if (c[key] === undefined) continue
          const payload = payloadOf(c[key])
          if (!payload) fields[key] = c[key]
          else
            for (const [field, value] of Object.entries(payload))
              fields[`${key}.${field}`] = String(value)
        }
        if (c.author) fields.author = c.author
        if (c.status) fields.status = c.status
        if (c.evidence) fields.evidence = c.evidence
        if (c.applied_at) fields.applied_at = c.applied_at
        const markers = {}
        // Resolve `evidence` (a citation) so the display shows the value plus the
        // clickable citation icon through the standard field renderer.
        const citations = {}
        if (c.evidence && resolver && payloadHelper.resolveEvidenceCitation) {
          citations.evidence = [
            payloadHelper.resolveEvidenceCitation(c.evidence, resolver, `changes/${batch}.md`),
          ]
        }
        allElements.push({
          id,
          slug: id,
          concept: 'Change',
          name,
          description,
          fields,
          markers,
          ...(Object.keys(citations).length ? { citations } : {}),
          hash: payloadHelper.computeElementHash({
            concept: 'Change',
            name,
            description,
            fields,
            markers,
          }),
          modelId: CHANGES_MODEL_ID,
          modelTitle: CHANGES_MODEL_TITLE,
          modelFile: '<changes>',
          modelDir: 'changes',
          ownership: 'derived',
          location: `${batch}@## NN Change: ${c.id}`,
        })
        changeUnitCount++
      }
    }
    if (changeUnitCount > 0) {
      modelSummaries.push({
        id: CHANGES_MODEL_ID,
        title: CHANGES_MODEL_TITLE,
        filePath: CHANGES_SUMMARY_FILE_PATH,
        blueprint: 'changes',
        family: 'changes',
        version: changesBlueprintVersion || null,
        sha256: changesSummarySha256(payloadChangesets),
        citationsResolvedAt: null,
        sources: [],
        changeCount: changeUnitCount,
        ownership: 'derived',
        conceptNames: ['Change'],
        elementCount: changeUnitCount,
        storage: { kind: 'compact' },
      })
      scopeModelIds.push(CHANGES_MODEL_ID)
    }
  }

  // A field may declare `options_from:: models:<capability>` or `options_from:: voices`: its
  // picklist is this domaiNN's own catalog (the Model/Voice elements the export already
  // carries), never a hard-coded tier list (conntent-domain-console, "Picklists come from
  // the catalog"). Models are offered by `api_id` -- what the engine documents, the plan
  // stamps and the cost ledger records -- filtered by the capability the field consumes;
  // Voices by slug, the registry key the TTS layer resolves, and only when the voice has a
  // provider id. An empty picklist leaves the field as free text: a select with no options
  // is worse than a text box.
  function catalogOptionValues(concept, capability) {
    const wanted = String(capability || '').toLowerCase()
    const out = new Set()
    for (const el of allElements) {
      if (!el || String(el.concept) !== concept) continue
      const fields = el.fields || {}
      const slug = String(fields.slug || el.slug || el.name || '').trim()

      let refEntry = null
      if (concept === 'Model' && blueprintCatalog?.models) {
        refEntry = blueprintCatalog.models[slug]
        if (!refEntry) {
          // Fallback matching if version infix differs (e.g. minimax-speech-hd vs minimax-speech-2-8-hd)
          const norm = slug.replace(/[-_.]/g, '').toLowerCase()
          for (const [k, v] of Object.entries(blueprintCatalog.models)) {
            if (k.replace(/[-_.]/g, '').toLowerCase() === norm) {
              refEntry = v
              break
            }
            const kNoVer = k
              .replace(/-\d+(?:-\d+)*-/, '-')
              .replace(/[-_.]/g, '')
              .toLowerCase()
            const slugNoVer = slug
              .replace(/-\d+(?:-\d+)*-/, '-')
              .replace(/[-_.]/g, '')
              .toLowerCase()
            if (kNoVer === slugNoVer) {
              refEntry = v
              break
            }
          }
        }
      } else if (concept === 'Voice' && blueprintCatalog?.voices) {
        refEntry = blueprintCatalog.voices[slug]
      } else if (blueprintCatalog) {
        const cat = blueprintCatalog[concept.toLowerCase() + 's'] || blueprintCatalog[concept]
        if (cat) refEntry = cat[slug]
      }

      // Merge: reference base, domain element overlay wins
      const mergedFields = { ...(refEntry || {}), ...fields }

      if (concept === 'Model') {
        if (!(mergedFields.allowed === true || mergedFields.allowed === 'true')) continue
        if (wanted && String(mergedFields.capability || '').toLowerCase() !== wanted) continue
      }
      if (concept === 'Voice' && !mergedFields.voice_id) continue
      const value =
        concept === 'Model'
          ? mergedFields.api_id || mergedFields.slug || el.slug || el.name
          : el.slug || mergedFields.slug || el.name
      if (value) out.add(String(value))
    }
    return [...out].sort()
  }
  for (const f of allFields) {
    if (!f || !f.options_from) continue
    const [kind, capability] = String(f.options_from).split(':')
    const trimmed = kind.trim()
    const concept =
      trimmed.toLowerCase() === 'models'
        ? 'Model'
        : trimmed.toLowerCase() === 'voices'
          ? 'Voice'
          : trimmed.endsWith('s')
            ? trimmed.slice(0, -1)
            : trimmed
    if (!concept) continue
    const options = catalogOptionValues(concept, capability)
    if (options.length > 0) {
      f.type = 'select'
      f.options = options
    }
  }

  // Drift is not computed here: the change log owns it (checkProvenance in
  // nn-core, wired into validate_knowledge and check_domain). The console export
  // carries the data; it does not re-implement the matching.

  // No fabricated domain version: the domain meta carries `generated` plus the real
  // per-model `knowledge_version` / `sha256` in `models[]` (D4). The draft store key
  // (`domainId`) is deliberately NOT content-derived, or drafts would vanish on every
  // edit; a scoped console appends `::scope:<hash8 of sorted model ids>` so different
  // scopes never share a draft store (the runtime appends `::view:<id>`).
  const baseDomainId = `${basename(root)}-${hashSlice(domainIdSourcePath(root), 8)}`
  const domainId = scoped
    ? `${baseDomainId}::scope:${hashSlice([...scopeModelIds].sort().join('\n'), 8)}`
    : baseDomainId
  // The domain's declared `workspace_id` names the changesets this console downloads, the
  // same name the runner gives its own (`<workspace_id>_<author>_<stamp>_changes_NN.md`).
  const workspaceId = scoped ? '' : declaredWorkspaceId(root)

  let filesData = null
  if (opts.files !== false && !opts.noFiles) {
    try {
      filesData = await collectWorkspaceFiles(root, {
        elements: allElements,
        changesets,
        onWarning: warn,
      })
    } catch (err) {
      warn(`error scanning files: ${err.message}`)
    }
  }

  const procedureGraphs = collectProcedureRuns({
    root,
    models,
    payloadModels,
    wholeDomain,
    helper: payloadHelper,
    compare: viewsLib.compareCodeUnits,
  })

  const domainPayload = {
    viewData,
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
        ...(workspaceId ? { workspaceId } : {}),
        generated: undefined,
        changesBlueprintVersion,
        models: modelSummaries,
        domain: {
          title: basename(root) + ' Domain',
          address: 'domaiNN_NN.md',
          modelCount: modelSummaries.length,
          sourceCount: domainSources.size,
        },
        ...(omitChanges ? { changesOmitted: { count: changeCount, bytes: changesBytes } } : {}),
        ...(wholeDomain
          ? {
              versions: {
                ...blueprintVersionRows(
                  blueprintUses.concat(changesetBlueprintUses(root, changesets)),
                  consoleDir,
                  root,
                ),
                installation: installationRecord(root),
              },
            }
          : {}),
      },
      elements: allElements,
      matrices: allMatrices,
      // D2: the domain's changesets, newest first by file stamp. Read-only, never
      // written into a model.
      changes: (Array.isArray(payloadChangesets) ? payloadChangesets.slice() : []).sort((a, b) =>
        viewsLib.compareCodeUnits(String(b.path), String(a.path)),
      ),
      ...(filesData ? { files: filesData } : {}),
      ...(procedureGraphs.length > 0 ? { procedureGraphs } : {}),
    },
  }

  // The conditional `changesOmitted` spread above closes the inferred meta type, so
  // widen it before adding the optional scope.
  /** @type {Record<string, unknown>} */
  const payloadMeta = domainPayload.model.meta
  const stagingDir =
    opts.stagingDir || opts.staging || scopeObj.stagingDir || scopeObj.staging || null
  const isDelivery =
    view === 'conntent-delivery' ||
    Boolean(scopeObj.delivery) ||
    Boolean(stagingDir) ||
    (typeof scopeObj.outFile === 'string' && /(?:^|\/)deliveries\/v\d+\//.test(scopeObj.outFile))

  // For delivery view, sanitize internal operating data (costs, budget, ledger, image prompts)
  if (isDelivery) {
    domainPayload.model.elements = domainPayload.model.elements.filter((el) => {
      const c = String(el.concept || '').toLowerCase()
      return !['ledger', 'cost', 'spend', 'budget'].some((k) => c.includes(k))
    })
    const STRIP_FIELD_RE =
      /^(cost|costs|budget|budgets|spend|ledger|prompt|image_prompt|prompts|negative_prompt)$/i
    for (const el of domainPayload.model.elements) {
      if (el.fields && typeof el.fields === 'object') {
        for (const k of Object.keys(el.fields)) {
          if (STRIP_FIELD_RE.test(k)) delete el.fields[k]
        }
      }
    }
    if (domainPayload.viewData) {
      const stripData = (obj) => {
        if (!obj || typeof obj !== 'object') return
        for (const k of Object.keys(obj)) {
          if (STRIP_FIELD_RE.test(k)) {
            delete obj[k]
          } else if (typeof obj[k] === 'object') {
            stripData(obj[k])
          }
        }
      }
      stripData(domainPayload.viewData)
    }
    if (domainPayload.model && domainPayload.model.meta) {
      const meta = /** @type {Record<string, any>} */ (domainPayload.model.meta)
      delete meta.ledger
      delete meta.costs
      delete meta.budget
    }
  }

  const readOnly = scopeObj.readOnly === true
  if (scoped) {
    const scopeMeta = { models: [...scopeModelIds].sort(), label: scopeLabelOf(selected) }
    if (view) scopeMeta.view = view
    if (readOnly) scopeMeta.readOnly = true
    payloadMeta.consoleScope = scopeMeta
  } else if (view || readOnly) {
    payloadMeta.consoleScope = {
      ...(view ? { view } : { view: '' }),
      ...(readOnly ? { readOnly: true } : {}),
    }
  }

  // Output location. A console (whole-domaiNN or model-scoped) owns ONE stable file
  // from the shared path builder; only a lone view export keeps a write-once family
  // (<view>_view/, <view>-<key>_view/).
  const scopeKey = scoped ? await scopeKeyOf(selected, root) : null
  let familyDir = null
  let familyKey = null
  let relativePath = null
  if (isDelivery) {
    familyDir = null
    familyKey = null
    if (typeof scopeObj.outFile === 'string' && scopeObj.outFile) {
      const abs = resolve(root, scopeObj.outFile)
      if (!isInsideRoot(abs, root)) {
        throw new ConsoleExportError(`outFile must resolve inside ${root}.`, 'OUTFILE_INVALID')
      }
      relativePath = relative(root, abs).replace(/\\/g, '/')
    } else {
      relativePath = payloadHelper.consoleOutputPath(
        scopeObj.delivery ? { delivery: scopeObj.delivery } : scope,
      )
    }
  } else if (view) {
    familyKey = scoped ? `${view}-${scopeKey}_view` : `${view}_view`
    familyDir = `artifacts/${familyKey}`
  } else {
    relativePath = payloadHelper.consoleOutputPath(wholeDomain ? 'domain' : { model: scopeKey })
  }
  // A caller may pin the exact file (for example the delivery HTML inside
  // deliveries/v<N>/); it must stay inside the domaiNN.
  if (typeof scopeObj.outFile === 'string' && scopeObj.outFile && !isDelivery) {
    const abs = resolve(root, scopeObj.outFile)
    if (!isInsideRoot(abs, root)) {
      throw new ConsoleExportError(`outFile must resolve inside ${root}.`, 'OUTFILE_INVALID')
    }
    familyDir = null
    familyKey = null
    relativePath = relative(root, abs).replace(/\\/g, '/')
  }

  const finalAbsPath = relativePath ? join(root, relativePath) : null
  // A delivery console is immutable, and this one rule governs both write shapes: a
  // staged export and one written straight to its final path. It runs before the page is
  // rendered, so a refused delivery costs nothing and leaves no staged copy behind.
  if (isDelivery && finalAbsPath && existsSync(finalAbsPath)) {
    return {
      path: finalAbsPath,
      relativePath,
      status: 'error',
      error: `Delivery console already exists at ${relativePath}; deliveries are immutable`,
      knowledgeVersions: versionsOf(modelSummaries),
      opened: false,
    }
  }

  const outDirAbs = familyDir ? join(root, familyDir) : dirname(join(root, relativePath))
  // Bundle the fold once, before any render needs it; `buildHtml` runs several times.
  await loadProcedureFoldSlot()
  const buildHtml = (generated) => {
    domainPayload.model.meta.generated = generated
    let rendered = renderConsole(resolvedShell, null, config, domainPayload, outDirAbs, root)
    if (omitChanges)
      rendered = injectChangesNotice(rendered, { count: changeCount, bytes: changesBytes })
    // The page theme is the shell's own `<html lang="en" data-theme="light">`: the inlined
    // stylesheet always contains the `data-theme=` literal, so patching the document after
    // inlining could never fire (backlog console-builder-d20).
    return viewsLib.inlineConsoleAssets(rendered, preparedAssets)
  }
  // Final size gate, before the first write of this run.
  const bytes = (text) => Buffer.byteLength(text, 'utf8')
  const slotBytes = (rendered, id) => {
    const match = new RegExp(`<script type="[^"]*" id="${id}">([\\s\\S]*?)</script>`).exec(rendered)
    return match ? bytes(match[1].trim()) : 0
  }

  // A domain declares its own thresholds in the manifest frontmatter; an
  // unusable declaration is reported and the shipped defaults stay.
  const manifestPath = join(root, 'domaiNN_NN.md')
  let manifestFrontmatter = null
  if (existsSync(manifestPath)) {
    try {
      manifestFrontmatter = frontmatterOf(await readFile(manifestPath, 'utf8'))
    } catch {
      manifestFrontmatter = null
    }
  }
  const sizeBudget = viewsLib.resolveSizeBudget(manifestFrontmatter)
  for (const problem of sizeBudget.problems) {
    warn(problem)
  }

  const budgetOf = (rendered, strategy = 'none') =>
    viewsLib.evaluateSizeBudget({
      bundle: bytes(preparedAssets.bundleScript) + bytes(preparedAssets.css),
      // What the payload costs in the page: the schema slot plus the compressed model slot.
      models: slotBytes(rendered, 'nn-schema') + slotBytes(rendered, 'nn-model'),
      // What it costs once the browser inflates it. The model slot is deflate-raw +
      // base64, so the file size alone cannot see a payload that compresses well and
      // explodes in memory; the gate takes the larger of the two.
      modelsRawBytes: bytes(JSON.stringify(domainPayload.model)),
      views:
        preparedAssets.viewScripts.reduce((sum, script) => sum + bytes(script), 0) +
        (preparedAssets.viewStyles || []).reduce((sum, style) => sum + bytes(style), 0),
      total: bytes(rendered),
      budget: sizeBudget,
      strategy,
    })

  let html = buildHtml(new Date().toISOString())
  let budget = budgetOf(html)

  // Degrade instead of refusing to write, in a fixed order: the resolved citation
  // payload first (the raw field values survive), then the per-element history
  // maps (the change log still holds the same facts). The strategy each step
  // applied travels in the gate's message.
  let strategy = 'none'
  if (budget.status === 'fail') {
    const strippedCitations = viewsLib.stripConsoleCitations(domainPayload)
    if (strippedCitations > 0) {
      strategy = 'strip-citations'
      html = buildHtml(new Date().toISOString())
      budget = budgetOf(html, strategy)
      let strippedHistory = 0
      if (budget.status === 'fail') {
        strippedHistory = viewsLib.stripConsoleHistory(domainPayload)
        if (strippedHistory > 0) {
          strategy = 'strip-citations+history'
          html = buildHtml(new Date().toISOString())
          budget = budgetOf(html, strategy)
        }
      }
      warn(
        `console exceeded ${sizeBudget.failBytes} B; ` +
          `exported degraded (${strategy}) — dropped the resolved citations of ${strippedCitations} elements` +
          (strippedHistory > 0 ? ` and the history of ${strippedHistory} elements` : '') +
          ` (their raw field values are untouched).`,
      )
    }
  }
  if (budget.status === 'fail') throw new ConsoleExportError(budget.message, 'CONSOLE_TOO_LARGE')
  if (budget.status === 'warn') warn(budget.message)
  log(budget.breakdown)

  const inputs = payloadModels.map((m) => relative(root, m.filePath).replace(/\\/g, '/'))
  const knowledgeVersions = versionsOf(modelSummaries)
  let status
  let absPath
  let relPath

  if (!familyDir) {
    // Stable file: replaced through a temp file + rename, only when the bytes move.
    const stagingDirAbs = stagingDir ? resolve(root, stagingDir) : null
    absPath = stagingDirAbs ? join(stagingDirAbs, basename(relativePath)) : finalAbsPath
    relPath = relativePath

    let isUnchanged = false
    if (strategy === 'none' && existsSync(absPath)) {
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
      const leftovers = [BUNDLE_FILENAME, CSS_FILENAME].filter((name) =>
        existsSync(join(root, name)),
      )
      if (leftovers.length > 0) {
        warn(
          `${leftovers.join(' and ')} in the workspace root are leftover from an earlier export; domaiNN_console.html no longer uses them and they were not removed.`,
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
        log(
          `✔ ${basename(result.path)} → ./${result.path} (view ${view}, ${allElements.length} elements)`,
        )
      }
    }
  }

  const opening = await openConsole(absPath, {
    open,
    launcher,
    platform,
    cooldownMs:
      openCooldownMinutes === undefined ? openCooldownMs() : openCooldownMinutes * 60 * 1000,
  })
  return {
    path: absPath,
    relativePath: relPath,
    status,
    knowledgeVersions,
    opened: opening.opened,
    ...(opening.alreadyOpen ? { alreadyOpen: true } : {}),
    ...(opening.openError ? { openError: opening.openError } : {}),
  }
}

/**
 * A `--blueprint` value becomes one folder name under `specs/bluepriNNts`, so it must be a
 * single path segment: no separator, no `..`, no absolute path.
 * @returns {Promise<string | null>} the refusal message, or null when the name is usable.
 */
async function blueprintNameError(blueprint) {
  if (blueprint === null || blueprint === undefined) return null
  const { SPEC_BASE_RE } = await viewsLibOnce()
  const text = String(blueprint)
  if (SPEC_BASE_RE.test(text)) return null
  return `Invalid --blueprint "${text}": expected one blueprint folder name, using letters, digits, "_" and "-" only.`
}

/**
 * A scaffolded title is display text, but it is written into source: inside a single-quoted
 * JS string and inside a block comment. Escape each in place — the template's quote style
 * is part of the pinned scaffold output, so it is never switched.
 */
function jsSingleQuoted(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** A block comment has no escape character: split its terminator so it cannot end early. */
function inBlockComment(value) {
  return String(value).replace(/\*\//g, '*\\/')
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
export async function scaffoldConsoleView({
  rootDir,
  slug,
  template = 'table',
  blueprint = null,
  title = null,
}) {
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
  // Before any path is built: the blueprint name is a path segment, not free text.
  const blueprintError = await blueprintNameError(blueprint)
  if (blueprintError) throw new ConsoleExportError(blueprintError, 'VIEWS_INVALID')

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
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${inBlockComment(viewTitle)} dashboard
   Declarative dashboard view using nnUI.KpiGrid with canonical KU badges. */
registerView({
  title: '${jsSingleQuoted(viewTitle)}',
  icon: 'dashboard',
  order: 25,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []

    var grid = nnUI.KpiGrid(
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
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${inBlockComment(viewTitle)} view */
registerView({
  title: '${jsSingleQuoted(viewTitle)}',
  icon: 'layout',
  order: 50,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var wrap = doc.createElement('div')
    wrap.className = 'empty-state'
    wrap.textContent = '${jsSingleQuoted(viewTitle)} view content.'
    ctx.container.appendChild(wrap)
  },
})
`
  } else {
    // Default: 'table'
    code = `/* ${blueprint ? `assets/${filename}` : `consoles/views/${filename}`} — ${inBlockComment(viewTitle)} table view
   Declarative table view using nnUI.DataTable with canonical KU badges. */
registerView({
  title: '${jsSingleQuoted(viewTitle)}',
  icon: 'layers',
  order: 20,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []

    var table = nnUI.DataTable(
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

/**
 * The CLI/worker body, without any `process.exit`. Resolves to
 * `{ exitCode, writtenFiles }`; throws `ConsoleExportError` for asset/model failures.
 * `argv` is the argument list after the script name (design D4 / console-export-cli spec).
 * Every line it prints goes through `options.out`, the export's writer
 * (`createProcessWriter`): the process writer by default, a buffered one when
 * `runExportConsole` calls it.
 * @param {string[]} argv
 * @param {{ open?: boolean, launcher?: Function, out?: { out: (line: string) => void, err: (line: string) => void, warn: (message: string) => void } }} [options]
 */
async function runMain(argv, options = {}) {
  const out = options.out ?? createProcessWriter()
  const args = parseArgs(['node', 'export-console.mjs', ...argv])
  if (options.launcher !== undefined) args.launcher = options.launcher
  if (typeof options.open === 'boolean') args.open = options.open
  if (args.errors.length > 0) {
    for (const message of args.errors) out.err(`Error: ${message}`)
    out.err(USAGE)
    return { exitCode: 2, writtenFiles: [] }
  }
  if (!args.root) {
    out.err(USAGE)
    return { exitCode: 2, writtenFiles: [] }
  }
  const root = resolve(args.root)

  if (args.newView) {
    const template = VIEW_TEMPLATES.find((t) => t === args.template)
    if (!template) {
      out.err(
        `Error: unknown --template "${args.template}" (expected ${VIEW_TEMPLATES.join(' | ')}).`,
      )
      return { exitCode: 2, writtenFiles: [] }
    }
    const blueprintError = await blueprintNameError(args.blueprint)
    if (blueprintError) {
      out.err(`Error: ${blueprintError}`)
      out.err(USAGE)
      return { exitCode: 2, writtenFiles: [] }
    }
    const created = await scaffoldConsoleView({
      rootDir: root,
      slug: args.newView,
      template,
      blueprint: args.blueprint,
      title: args.title,
    })
    out.out(`Created console view "${created.title}" (${created.slug}):\n  ${created.targetPath}`)
    out.out(
      `To compile the console with this view, run:\n  node scripts/export-console.mjs ${relative(process.cwd(), root) || '.'} --domain`,
    )
    return { exitCode: 0, writtenFiles: [created.targetPath] }
  }
  if (args.view && args.domain) {
    out.err('Error: --view and --domain are mutually exclusive.')
    return { exitCode: 2, writtenFiles: [] }
  }
  const hasSelection = Boolean(args.all || args.stale || args.filter || args.model)
  if (args.domain && hasSelection) {
    out.err(
      'Error: --domain exports the whole domaiNN and cannot select models; drop the model name, --filter, --all or --stale.',
    )
    return { exitCode: 2, writtenFiles: [] }
  }
  await ensureAssets()
  const models = await loadModels(root, out.warn)

  const consoles = await statusConsoles(root)

  if (args.status) {
    out.out(`Status (${models.length} model(s)):`)
    for (const m of models) {
      const rel = relative(root, m.filePath).replace(/\\/g, '/')
      const info = await inspectModelStatus(m, root, consoles)
      out.out(`  ${rel} [${info.status}]`)
    }
    out.out(
      `Domain console: ${payloadHelper.consoleOutputPath('domain')} [${await inspectDomainConsole(models, root)}]`,
    )
    return { exitCode: 0, writtenFiles: [] }
  }

  if (args.tree) {
    await renderTree(models, root, consoles, out.out)
    return { exitCode: 0, writtenFiles: [] }
  }

  if (args.list) {
    out.out('Models:')
    for (const m of models) out.out(`  ${relative(root, m.filePath).replace(/\\/g, '/')}`)
    out.out(`(${models.length} models)`)
    return { exitCode: 0, writtenFiles: [] }
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

  // A view or stylesheet edit leaves every model entry fresh while the console still inlines
  // the old assets, so `--stale` has to ask about the console itself. Its only repair is a
  // full export: a scoped console would leave the domain page stale.
  const staleAssets = Boolean(
    args.stale &&
    !args.filter &&
    !args.model &&
    !args.view &&
    (await domainConsoleStaleness(models, root)) === 'assets',
  )

  // No scope option narrows the model set: --domain and a lone --view cover the
  // whole domaiNN. Any selection (a model name, --filter, --all, --stale) only
  // narrows candidateModels and produces ONE scoped console over the selected set,
  // unless the console's own assets are what changed.
  const wholeDomain = args.domain || (args.view && !hasSelection) || staleAssets

  let selected = []
  if (hasSelection) {
    if (args.stale) {
      for (const m of candidateModels) {
        if ((await inspectModelStatus(m, root, consoles)).status !== 'fresh') selected.push(m)
      }
      if (selected.length === 0 && !staleAssets) {
        out.out('All models are fresh. Nothing to export.')
        return { exitCode: 0, writtenFiles: [] }
      }
    } else {
      selected = candidateModels
    }
  }

  if (!wholeDomain && selected.length === 0) {
    out.err(
      'No models selected. Use --all, --stale, --domain, --filter <pattern>, or pass a model name/id substring.',
    )
    return { exitCode: 1, writtenFiles: [] }
  }

  const result = await writeConsole({
    rootDir: root,
    scope: wholeDomain ? 'domain' : { selected },
    view: args.view,
    open: args.open,
    launcher: args.launcher,
    files: args.files,
    changes: args.changes,
    models,
    log: out.out,
    warn: out.warn,
  })
  const written = result.status === 'written' ? 1 : 0
  const unchanged = result.status === 'unchanged' ? 1 : 0
  if ('openError' in result && result.openError) {
    out.warn(`could not open the console: ${result.openError}`)
  }
  out.out(
    `Exported ${written} console artifact(s)${unchanged > 0 ? ` (${unchanged} unchanged)` : ''}.`,
  )
  return { exitCode: 0, writtenFiles: result.status === 'written' ? [result.path] : [] }
}

/**
 * Programmatic, in-process console export entry point: runs the CLI body with its
 * output written to a buffer instead of this process's stdout/stderr, and never calls
 * `process.exit`. It passes a buffered writer to the body, so `console` and
 * `process.stdout`/`process.stderr` are left exactly as the caller bound them, and two
 * exports running in one process never receive each other's lines.
 * @param {string[]} [argv] - args after the script name, e.g. `[root, '--no-open']`.
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, open?: boolean, launcher?: Function }} [options]
 * @returns {Promise<{ exitCode: number, code: number, stdout: string, stderr: string, writtenFiles: string[] }>}
 */
export async function runExportConsole(argv = [], options = {}) {
  const capture = createBufferedWriter()
  try {
    const result = await runMain(argv, { ...options, out: capture })
    const { stdout, stderr } = capture.read()
    return {
      exitCode: result.exitCode,
      code: result.exitCode,
      stdout,
      stderr,
      writtenFiles: result.writtenFiles,
    }
  } catch (err) {
    capture.writeStderr(
      err instanceof ConsoleExportError
        ? `Error: ${err.message}\n`
        : `${err && err.stack ? err.stack : err}\n`,
    )
    const { stdout, stderr } = capture.read()
    return { exitCode: 1, code: 1, stdout, stderr, writtenFiles: [] }
  }
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
  runMain(process.argv.slice(2)).then(
    ({ exitCode }) => process.exit(exitCode),
    (err) => {
      if (err instanceof ConsoleExportError) console.error(`Error: ${err.message}`)
      else console.error(err)
      process.exit(1)
    },
  )
}
