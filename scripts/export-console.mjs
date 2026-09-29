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
 * Output: <workspaceRoot>/export/<Model>_V_<version>_console/<Model>_V_<version>_console.html
 */

import { readdir, readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, basename, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

// CDN pin comes from the vendored bundle's generated version banner, not from
// manifest/source.yaml, so this file stays runnable standalone in a workspace
// (issue #91). build-console-bundle.mjs stamps the banner from the manifest.
function parseConsoleCdnRef(bundleText) {
  const m = bundleText && bundleText.match(/\bVersion (\d+\.\d+\.\d+)\./)
  return m ? `innfo-console-v${m[1]}` : null
}

// The console assets (artifact_shell.html + innfo-console.bundle.js) live in
// this repo at iNNfo/specs/bluepriNNts/console/ and are also distributed to
// ~/.agents/console by skills-manager. Resolve them from the first location that
// actually holds the shell, so the exporter runs both from a checkout and
// from a workspace where only the installed console assets exist (issue #94).
// $INNFO_CONSOLE_DIR overrides every candidate.
//
// The shell was called artifact_blueprint.html before the "blueprint" name was
// reserved for level-2 templates. Installs made before the rename still carry the
// old filename, so each candidate dir is probed for the new name first and the
// legacy name second.
const SHELL_FILENAME = 'artifact_shell.html'
const LEGACY_SHELL_FILENAME = 'artifact_blueprint.html'
const repoConsoleDir = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')

function findShell(dir) {
  return [SHELL_FILENAME, LEGACY_SHELL_FILENAME]
    .map((name) => join(dir, name))
    .find((p) => existsSync(p))
}

const consoleDir =
  [process.env.INNFO_CONSOLE_DIR, join(homedir(), '.agents', 'console'), repoConsoleDir]
    .filter(Boolean)
    .find((dir) => findShell(dir)) || repoConsoleDir

const shellPath = findShell(consoleDir) || join(consoleDir, SHELL_FILENAME)
const bundlePath = join(consoleDir, 'innfo-console.bundle.js')

function computeSha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function parseArgs(argv) {
  const args = {
    root: null,
    list: false,
    status: false,
    tree: false,
    all: false,
    stale: false,
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

/** Recursively find every `*_NN.md` file under `dir`, skipping heavy dirs. */
async function findModelFiles(dir) {
  const out = []
  const skip = new Set(['node_modules', '.git', '.cogNNitive', 'export', 'dist', 'docs'])
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
      } else if (e.isFile() && /_NN\.md$/i.test(e.name)) {
        out.push(join(d, e.name))
      }
    }
  }
  await walk(dir)
  return out
}

function frontmatterOf(content) {
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

function isLevel3(content) {
  const fm = frontmatterOf(content)
  const lvl = fm.level
  return lvl === undefined || Number(lvl) === 3
}

function parseElements(text) {
  const elements = []
  let concept = null
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    const block = line.match(/^## NN ([^:]+): (.+)$/)
    if (block) {
      concept = block[1].trim()
      elements.push({
        id: block[2].trim(),
        concept,
        name: block[2].trim(),
        description: '',
        fields: {},
        markers: {},
      })
      continue
    }
    if (!concept || elements.length === 0) continue
    const last = elements[elements.length - 1]
    const fld = line.match(/^\s{2}([a-zA-Z_][a-zA-Z0-9_]*)::\s*(.+)$/)
    if (fld) {
      last.fields[fld[1]] = fld[2].replace(/^"|"$/g, '').trim()
    } else if (!line.trim().startsWith('#') && line.trim().length >= 12 && !last.description) {
      last.description = line.trim()
    }
  }
  return elements
}

function elSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
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

async function inspectModelStatus(model, rootDir) {
  const stem = model.name
  const targetHtmlPath = join(rootDir, 'export', `${stem}_console`, `${stem}_console.html`)

  if (!existsSync(targetHtmlPath)) {
    return { status: 'uncompiled', targetHtmlPath }
  }

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
        console.log(`${childIndent}${itemPrefix}${basename(item.model.filePath)} [${item.statusInfo.status}]`)
        const targetRel = relative(root, item.statusInfo.targetHtmlPath).replace(/\\/g, '/')
        console.log(`${childIndent}${fileIndent}└── ${targetRel}`)
      }
    }
  }
}

function injectSlots(shell, config, schema, model) {
  const slot = (html, id, json) =>
    html.replace(
      new RegExp(`(<script type="application/json" id="${id}">)[\\s\\S]*?(</script>)`),
      (_m, open, close) => `${open}\n${JSON.stringify(json, null, 2)}\n${close}`,
    )
  return slot(slot(slot(shell, 'innfo-config', config), 'innfo-schema', schema), 'innfo-model', model)
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.root) {
    console.error(
      'Usage: node scripts/export-console.mjs <workspaceRoot> [--status] [--tree] [--list] [--all] [--stale] [--filter <pattern>] [<ModelName>]',
    )
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
    if (isLevel3(content)) {
      const stem = basename(f).replace(/(_NN)?\.md$/i, '')
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
  } else if (args.all || args.filter || args.model) {
    selected = candidateModels
  }

  if (selected.length === 0) {
    console.error(
      'No models selected. Use --all, --stale, --filter <pattern>, or pass a model name/id substring.',
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
  const resolvedShell = shell.replace(
    /@innfo-console-v\d+\.\d+\.\d+/g,
    `@${consoleCdnRef}`,
  )

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
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js',
    },
  }

  for (const m of selected) {
    const stem = m.name
    const modelVersion = String(m.fm.knowledge_version ?? 'V_0-1-0')
    const elements = parseElements(m.content)
    const sourceSha256 = computeSha256(m.content)
    const meta = {
      model: relative(root, m.filePath).replace(/\\/g, '/'),
      title: m.fm.title ?? stem,
      modelVersion,
      template: m.fm['parent_spec'] ? m.fm['parent_spec'] : undefined,
      sha256: sourceSha256,
      generated: new Date().toISOString(),
      slug: elSlug(stem),
    }
    const model = { meta, elements, matrices: [] }
    const conceptNames = Array.from(new Set(elements.map((e) => e.concept).filter(Boolean)))
    const schema = {
      concepts: conceptNames.map((name) => ({ name })),
      markers: [],
      matrices: [],
    }

    const outDir = join(root, 'export', `${stem}_console`)
    await mkdir(outDir, { recursive: true })
    const outFile = join(outDir, `${stem}_console.html`)
    const html = injectSlots(resolvedShell, config, schema, model)
    await writeFile(outFile, html, 'utf-8')
    if (bundle) await cp(bundlePath, join(outDir, 'innfo-console.bundle.js'))
    console.log(`✔ ${stem}_console.html → ${outFile.replace(root, '.')}`)
  }
  console.log(`Exported ${selected.length} console artifact(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})