#!/usr/bin/env node
/**
 * scripts/export-console.mjs — `nn export`
 *
 * Unified console artifact export (backlog: feature/console-artifact-export-cli).
 *
 * Scans a workspace for iNNfo Level-3 models and compiles a self-contained
 * `*_console.html` per model against the canonical console shell
 * (`iNNfo/specs/bluepriNNts/console/artifact_shell.html`), filling the
 * `innfo-config` / `innfo-schema` / `innfo-model` JSON slots from a direct
 * model scan (no runtime dependency on innfo-core, whose raw `dist/` barrel
 * is not ESM-importable). Vendors `innfo-console.bundle.js` next to each
 * artifact for offline `file://` use.
 *
 * Usage:
 *   node scripts/export-console.mjs <workspaceRoot> --status
 *   node scripts/export-console.mjs <workspaceRoot> --tree
 *   node scripts/export-console.mjs <workspaceRoot> --list
 *   node scripts/export-console.mjs <workspaceRoot> --all
 *   node scripts/export-console.mjs <workspaceRoot> --stale
 *   node scripts/export-console.mjs <workspaceRoot> --filter <pattern>
 *   node scripts/export-console.mjs <workspaceRoot> <ModelNameSubstring>
 *
 * Output (write-once, never overwritten):
 *   <workspaceRoot>/artifacts/<stem>_console/<stem>_console_<UTC stamp>.html
 *   <workspaceRoot>/artifacts/<stem>_console/innfo-console.bundle_<UTC stamp>.js
 * `--domain` additionally writes ONE self-contained, fixed-name file that is
 * overwritten on every export: <workspaceRoot>/domaiNN_console.html (bundle, CSS,
 * slots and the discovered views inlined; see scripts/console-views.mjs).
 * Re-running on an unchanged model writes nothing; a changed model adds a new
 * member and leaves earlier consoles byte-identical.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const repoConsoleDir = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')

const SHELL_FILENAME = 'artifact_shell.html'
const LEGACY_SHELL_FILENAME = 'artifact_blueprint.html'

function findShell(dir) {
  return [SHELL_FILENAME, LEGACY_SHELL_FILENAME]
    .map((name) => join(dir, name))
    .find((p) => existsSync(p))
}

const consoleDir =
  [process.env.INNFO_CONSOLE_DIR, repoConsoleDir, join(homedir(), '.agents', 'console')]
    .filter(Boolean)
    .find((dir) => findShell(dir)) || repoConsoleDir

const shellPath = findShell(consoleDir) || join(consoleDir, SHELL_FILENAME)
const bundlePath = join(consoleDir, 'innfo-console.bundle.js')

function loadPayloadHelper() {
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
        console.error(`Error loading console payload mirror from ${c}: ${err.message}`)
        process.exit(1)
      }
    }
  }
  const preferred = candidates[0]
  console.error(
    `Error: Console payload mirror not found at ${preferred}.\n` +
      'Build it with "node scripts/build-console-payload.mjs" or install console assets.',
  )
  process.exit(1)
}

const payloadHelper = loadPayloadHelper()

function computeSha256(content) {
  return payloadHelper?.computeSha256
    ? payloadHelper.computeSha256(content)
    : createHash('sha256').update(content, 'utf8').digest('hex')
}

function parseConsoleCdnRef(bundleText) {
  const m = bundleText && bundleText.match(/\bVersion (\d+\.\d+\.\d+)\./)
  return m ? `innfo-console-v${m[1]}` : null
}

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
    filter: null,
    model: null,
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

/** A model is an `_NN.md` document of role `knowledge` outside every excluded path. */
function isModelDocument(relPath, content) {
  if (payloadHelper.isExcludedPath(relPath)) return false
  const parentSpecName = payloadHelper.parentSpecNameOf(frontmatterOf(content))
  return payloadHelper.roleOf({ path: relPath, parentSpecName }) === 'knowledge'
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

const BUNDLE_KEY = 'innfo-console.bundle'
const UI_CSS_FILENAME = 'innfo-ui.css'
const consoleDirRel = (stem) => `artifacts/${stem}_console`

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

/** Latest console HTML for a stem (core `latestOfFamily`), or null when none exists. */
async function latestConsole(rootDir, stem) {
  const latest = payloadHelper.latestOfFamily(
    await familyMembers(rootDir, consoleDirRel(stem), `${stem}_console`, 'html'),
  )
  return latest ? latest.path : null
}

async function inspectModelStatus(model, rootDir) {
  const stem = model.name
  const latestRel = await latestConsole(rootDir, stem)

  if (!latestRel) {
    return { status: 'uncompiled', targetHtmlPath: join(rootDir, consoleDirRel(stem)) }
  }
  const targetHtmlPath = join(rootDir, latestRel)

  let htmlContent
  try {
    htmlContent = await readFile(targetHtmlPath, 'utf-8')
  } catch {
    return { status: 'stale', targetHtmlPath }
  }

  const embeddedMeta = extractModelMetaFromHtml(htmlContent)
  if (!embeddedMeta) {
    return { status: 'stale', targetHtmlPath }
  }

  const currentVersion = String(model.fm.knowledge_version ?? 'V_0-1-0')
  if (embeddedMeta.modelVersion && embeddedMeta.modelVersion !== currentVersion) {
    return { status: 'version_mismatch', targetHtmlPath, embeddedMeta }
  }

  const currentSha256 = computeSha256(model.content)
  if (embeddedMeta.sha256 && embeddedMeta.sha256 === currentSha256) {
    return { status: 'fresh', targetHtmlPath, embeddedMeta }
  }

  return { status: 'stale', targetHtmlPath, embeddedMeta }
}

async function renderTree(models, root) {
  const groups = new Map()
  for (const m of models) {
    const rel = relative(root, m.filePath).replace(/\\/g, '/')
    const dir = dirname(rel)
    const dirKey = dir === '.' ? '.' : dir + '/'
    if (!groups.has(dirKey)) groups.set(dirKey, [])
    const statusInfo = await inspectModelStatus(m, root)
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

/** Console HTML for one model: the bundle name is injected so each console loads its own pinned bundle. */
function renderConsole(shell, bundleName, config, payload) {
  const pinned = bundleName ? shell.replace('./innfo-console.bundle.js', `./${bundleName}`) : shell
  return injectSlots(pinned, config, payload.schema, payload.model)
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.root) {
    console.error(
      'Usage: node scripts/export-console.mjs <workspaceRoot> [--status] [--tree] [--list] [--all] [--stale] [--domain] [--view <id> (whole domain, one view; no model selection)] [--filter <pattern>] [<ModelName>]',
    )
    process.exit(2)
  }
  if (args.viewMissing) {
    console.error('Error: --view needs a view id.')
    process.exit(2)
  }
  if (args.view && args.domain) {
    console.error('Error: --view and --domain are mutually exclusive.')
    process.exit(2)
  }
  if (args.view && (args.all || args.stale || args.filter || args.model)) {
    console.error('Error: --view cannot be combined with --all, --stale, --filter or a model name; it always exports the whole domain.')
    process.exit(2)
  }
  const root = resolve(args.root)
  if (!existsSync(shellPath)) {
    console.error(
      `Console assets not found: ${shellPath}\n` +
        'Install the console assets (skills-manager install) or set INNFO_CONSOLE_DIR to ' +
        'the folder holding artifact_shell.html and innfo-console.bundle.js.',
    )
    process.exit(1)
  }
  const shell = await readFile(shellPath, 'utf-8')
  const bundle = existsSync(bundlePath) ? await readFile(bundlePath, 'utf-8') : null

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
  models.sort((a, b) => a.filePath.localeCompare(b.filePath))

  if (args.status) {
    console.log(`Status (${models.length} model(s)):`)
    for (const m of models) {
      const rel = relative(root, m.filePath).replace(/\\/g, '/')
      const info = await inspectModelStatus(m, root)
      console.log(`  ${rel} [${info.status}]`)
    }
    return
  }

  if (args.tree) {
    await renderTree(models, root)
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

  let selected = []
  if (args.stale) {
    for (const m of candidateModels) {
      const info = await inspectModelStatus(m, root)
      if (info.status !== 'fresh') {
        selected.push(m)
      }
    }
    if (selected.length === 0) {
      console.log('All models are fresh. Nothing to export.')
      return
    }
  } else if (args.all || args.filter || args.model || args.domain) {
    selected = candidateModels
  }

  if (selected.length === 0 && !args.domain && !args.view) {
    console.error(
      'No models selected. Use --all, --stale, --domain, --filter <pattern>, or pass a model name/id substring.',
    )
    process.exit(1)
  }

  const consoleCdnRef = parseConsoleCdnRef(bundle)
  if (!consoleCdnRef) {
    console.error(
      `Cannot derive console CDN pin: no "Version X.Y.Z." banner found in ${bundlePath}`,
    )
    process.exit(1)
  }

  // The shell ships a release-pinned CDN ref (e.g. @innfo-console-v0.1.0) in its
  // default config and static <script> tags. Those tags are not injectSlots targets, so
  // normalize every occurrence to the ref derived from the vendored bundle banner —
  // otherwise a generated console loads a stale bundle version first (#95).
  const resolvedShell = shell.replace(/@innfo-console-v\d+\.\d+\.\d+/g, `@${consoleCdnRef}`)

  // Views are discovered, validated and the inline assets read before anything is
  // written, so a bad view or a missing asset leaves the workspace untouched.
  let domainViews = []
  let uiCss = ''
  let viewsLib = null
  let preparedAssets = null
  if (args.domain || args.view) {
    // Loaded lazily: every other mode keeps running as a lone copy of this file, and
    // only --domain needs the sibling lib. The lib sits NEXT TO this script (not in a
    // lib/ folder) because the installer places every console asset flat by basename.
    const viewsLibUrl = new URL('./console-views.mjs', import.meta.url).href
    try {
      viewsLib = await import(viewsLibUrl)
    } catch (err) {
      // Only the lib itself being absent is reported here; a missing module imported
      // from inside it (err.url is that module) is a real fault and must surface.
      if (err.code !== 'ERR_MODULE_NOT_FOUND' || err.url !== viewsLibUrl) throw err
      console.error(`Error: --domain needs console-views.mjs next to this script (${fileURLToPath(viewsLibUrl)}).`)
      process.exit(1)
    }
    // Where bluepriNNt packages (and their console views) live. In a repo checkout the
    // console dir sits inside the packages folder; an installed set is flat in
    // ~/.agents/console and the packages are installed beside it in ~/.agents/bluepriNNts.
    const packagesDir =
      process.env.INNFO_BLUEPRINTS_DIR ||
      (consoleDir === repoConsoleDir ? dirname(consoleDir) : join(homedir(), '.agents', 'bluepriNNts'))
    const uiCssPath = join(consoleDir, 'innfo-ui.css')
    if (!existsSync(uiCssPath)) {
      console.error(`Error: ${uiCssPath} not found; --domain inlines the console CSS.`)
      process.exit(1)
    }
    uiCss = await readFile(uiCssPath, 'utf-8')
    try {
      domainViews = await viewsLib.discoverViews({
        domainRoot: root,
        specNames: candidateModels.map((m) => payloadHelper.parentSpecNameOf(m.fm)).filter(Boolean),
        packagesDir,
        onWarning: (message) => process.stderr.write(`WARNING: [export-console] ${message}
`),
      })
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
    if (args.view) {
      const wanted = domainViews.find((v) => v.id === args.view)
      if (!wanted) {
        const ids = domainViews.map((v) => v.id)
        console.error(`Error: unknown view "${args.view}"; available views: ${ids.length ? ids.join(', ') : '(none)'}`)
        process.exit(1)
      }
      domainViews = [wanted]
    }
    try {
      preparedAssets = viewsLib.assertInlinable(resolvedShell, { bundle, css: uiCss, views: domainViews })
    } catch (err) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
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

  let ledgerEntries = []
  const rootLedgerPath = join(
    root,
    payloadHelper.FEEDBACK_LEDGER_FILENAME || 'feedback-ledger.jsonl',
  )
  if (existsSync(rootLedgerPath)) {
    try {
      const rawLedger = await readFile(rootLedgerPath, 'utf-8')
      const parsed = payloadHelper.parseFeedbackLedger(rawLedger)
      ledgerEntries = parsed.entries
    } catch {
      // ignore parse error
    }
  }

  const resolver = payloadHelper.createFsSourceResolver
    ? payloadHelper.createFsSourceResolver(root)
    : undefined

  // Single shared schema path (innfo-core) — the MCP `build_console_payload`
  // tool calls the same helper, so both producers emit byte-identical slots.
  const resolveModelSchema = async (content) => {
    const fm = frontmatterOf(content)
    if (!fm?.parent_spec?.name) return undefined
    try {
      const resolution = await payloadHelper.resolveConsoleSchema({
        rootDir: root,
        parentName: fm.parent_spec.name,
        parentUrl: fm.parent_spec.url,
      })
      for (const warning of resolution.warnings) {
        process.stderr.write(`WARNING: [export-console] ${warning}\n`)
      }
      return resolution.schema
    } catch (err) {
      process.stderr.write(
        `WARNING: [export-console] Schema resolution failed: ${err?.message ?? err}\n`,
      )
      return undefined
    }
  }

  let standalone = null
  if (args.domain || args.view) {
    // Build combined payload aggregating all models in the workspace
    const allElements = []
    const allMatrices = []
    const allConcepts = []
    const seenConcepts = new Set()
    const modelSummaries = []

    for (const m of candidateModels) {
      const relPath = relative(root, m.filePath).replace(/\\/g, '/')
      const fileName = basename(relPath)
      const modelStem = fileName.replace(/\.[^/.]+$/, '')
      const payload = payloadHelper.buildConsolePayload({
        content: m.content,
        path: relPath,
        resolver,
        ledgerEntries,
      })
      if (payload && payload.model) {
        const mTitle = (payload.model.meta && (payload.model.meta.title || payload.model.meta.model)) || modelStem
        const mId = (payload.model.meta && payload.model.meta.modelId) || modelStem
        const modelConcepts = new Set()
        if (Array.isArray(payload.model.elements)) {
          for (const el of payload.model.elements) {
            if (el) {
              el.modelId = mId
              el.modelTitle = mTitle
              el.modelFile = fileName
              const cName = el.concept || 'Element'
              const eName = el.name || el.id || ''
              const cSlug = cName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
              const eSlug = eName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
              el.unitSlug = `${fileName}@${cSlug}--${eSlug}`
              el.canonicalUnit = `${fileName}@## ${cName}: ${eName}`
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
        modelSummaries.push({
          id: mId,
          title: mTitle,
          filePath: fileName,
          blueprint: blueprintName ? viewsLib.parseSpecName(blueprintName).base : null,
          conceptNames: Array.from(modelConcepts),
          elementCount: Array.isArray(payload.model.elements) ? payload.model.elements.length : 0,
        })
      }
      if (payload && payload.schema && Array.isArray(payload.schema.concepts)) {
        for (const c of payload.schema.concepts) {
          if (c && c.name && !seenConcepts.has(c.name)) {
            seenConcepts.add(c.name)
            allConcepts.push(c)
          }
        }
      }
    }

    const domainPayload = {
      schema: { concepts: allConcepts },
      model: {
        meta: {
          title: basename(root) + ' Domain',
          model: basename(root),
          modelId: basename(root),
          modelVersion: 'V_1-0-0',
          generated: new Date().toISOString(),
          models: modelSummaries,
        },
        elements: allElements,
        matrices: allMatrices,
      },
    }

    if (args.view) domainPayload.model.meta.consoleScope = { view: args.view }
    let domainHtml = viewsLib.inlineConsoleAssets(renderConsole(resolvedShell, null, config, domainPayload), preparedAssets)
    if (!domainHtml.includes('data-theme=')) {
      domainHtml = domainHtml.replace('<html lang="en">', '<html lang="en" data-theme="light">')
    }
    // Final size gate, before the first write of this run.
    const bytes = (text) => Buffer.byteLength(text, 'utf8')
    const budget = viewsLib.evaluateSizeBudget({
      bundle: bytes(preparedAssets.bundleScript) + bytes(preparedAssets.css),
      models: bytes(JSON.stringify(domainPayload.schema)) + bytes(JSON.stringify(domainPayload.model)),
      views: preparedAssets.viewScripts.reduce((sum, script) => sum + bytes(script), 0),
      total: bytes(domainHtml),
    })
    if (budget.status === 'fail') {
      console.error(`Error: ${budget.message}`)
      process.exit(1)
    }
    if (budget.status === 'warn') process.stderr.write(`WARNING: [export-console] ${budget.message}
`)
    console.log(budget.breakdown)
    standalone = { html: domainHtml, elements: allElements.length }
  }

  let written = 0
  let unchanged = 0
  for (const m of selected) {
    const stem = m.name
    const relPath = relative(root, m.filePath).replace(/\\/g, '/')

    const schema = await resolveModelSchema(m.content)

    const build = (generated) =>
      payloadHelper.buildConsolePayload({
        content: m.content,
        path: relPath,
        schema,
        resolver,
        ledgerEntries,
        generated,
      })

    const dir = consoleDirRel(stem)
    // The bundle is its own write-once family per folder; an unchanged bundle is deduplicated.
    let bundleName = null
    if (bundle) {
      const vendored = await payloadHelper.writeOnce(
        root,
        { dir, key: BUNDLE_KEY, ext: 'js' },
        bundle,
      )
      bundleName = basename(vendored.path)
    }

    // The shared stylesheet ships once per console folder (fixed name, like the domain export).
    const uiCssPath = join(consoleDir, UI_CSS_FILENAME)
    if (existsSync(uiCssPath)) {
      await mkdir(join(root, dir), { recursive: true })
      await writeFile(join(root, dir, UI_CSS_FILENAME), await readFile(uiCssPath, 'utf-8'), 'utf-8')
    }

    // Re-render with the previous `generated` stamp: identical bytes mean nothing changed.
    const latestRel = await latestConsole(root, stem)
    if (latestRel) {
      const previous = await readFile(join(root, latestRel), 'utf-8')
      const previousGenerated = extractModelMetaFromHtml(previous)?.generated
      if (
        previousGenerated &&
        renderConsole(resolvedShell, bundleName, config, build(previousGenerated)) === previous
      ) {
        unchanged++
        console.log(`= ${basename(latestRel)} unchanged`)
        continue
      }
    }

    const html = renderConsole(resolvedShell, bundleName, config, build(undefined))
    const result = await payloadHelper.writeOnce(
      root,
      { dir, key: `${stem}_console`, ext: 'html' },
      html,
      {
        inputs: [relPath],
      },
    )
    if (result.status === 'deduplicated') {
      unchanged++
      console.log(`= ${basename(result.path)} unchanged`)
    } else {
      written++
      console.log(`✔ ${basename(result.path)} → ./${result.path}`)
    }
  }

  if (args.domain) {
    const domainHtmlPath = join(root, 'domaiNN_console.html')
    await writeFile(domainHtmlPath, standalone.html, 'utf-8')
    console.log(
      `✔ domaiNN_console.html → ./domaiNN_console.html (${candidateModels.length} models, ${standalone.elements} elements, ${domainViews.length} views)`,
    )
    // Earlier exports wrote these beside the page; it inlines both now. Nothing is deleted.
    const leftovers = ['innfo-console.bundle.js', 'innfo-ui.css'].filter((name) => existsSync(join(root, name)))
    if (leftovers.length > 0) {
      process.stderr.write(
        `WARNING: [export-console] ${leftovers.join(' and ')} in the workspace root are leftover from an earlier export; domaiNN_console.html no longer uses them and they were not removed.\n`,
      )
    }
  }

  if (args.view) {
    // Write-once family per view; the bundle is inlined, so no sibling file exists.
    const result = await payloadHelper.writeOnce(
      root,
      { dir: `artifacts/${args.view}_view`, key: `${args.view}_view`, ext: 'html' },
      standalone.html,
      { inputs: candidateModels.map((m) => relative(root, m.filePath).replace(/\\/g, '/')) },
    )
    if (result.status === 'deduplicated') {
      unchanged++
      console.log(`= ${basename(result.path)} unchanged`)
    } else {
      written++
      console.log(`✔ ${basename(result.path)} → ./${result.path} (view ${args.view}, ${standalone.elements} elements)`)
    }
  }

  console.log(
    `Exported ${written} console artifact(s)${unchanged > 0 ? ` (${unchanged} unchanged)` : ''}.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
