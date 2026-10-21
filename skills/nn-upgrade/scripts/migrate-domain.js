#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/migrate-domain.js
 *
 * Domain utility CLI for iNNfo domains. There is no in-place migration of an old domain:
 * an old or broken domain is migrated by creating a NEW domain and importing the old one
 * as a Source.
 *
 * Modes:
 *   --freeze-slugs [--apply]                 freeze the element slugs of every Level 3 model
 *   --import-as-source --new-domain-dir <d>  scaffold a new domaiNN (planDomainScaffold, the same
 *                                            plan as the MCP init_domain tool) and import the old
 *                                            tree under sources/import/<old-domain-folder>/
 */

const fs = require('node:fs')
const path = require('node:path')

// Bundled core primitives (scripts/build-preflight-primitives.mjs), so the skill runs
// from an installed ~/.agents/skills/nn-upgrade without the iNNfo/ source tree.
async function loadInnfoCore() {
  return require('./lib/nn-core.generated.cjs')
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
}

/**
 * Creates the NEW domaiNN from the shared `planDomainScaffold` plan (the same plan the
 * MCP `init_domain` tool writes) and imports the old domain tree into
 * `sources/import/<old-domain-folder>/`, the canonical raw-import location. The old tree
 * is never touched. Migrating its content is the agent's job: `add_model` /
 * `add_element` changes whose `sources::` cite the imported files, proposed with
 * `propose_changeset` and applied after review.
 */
async function runImportAsSource(legacyDir, newDomainDir, options = {}) {
  const srcDir = path.resolve(legacyDir)
  const targetDir = path.resolve(newDomainDir)

  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    throw new Error(`Source legacy domain directory not found: ${srcDir}`)
  }

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`)
  }

  const { planDomainScaffold } = await loadInnfoCore()
  const plan = planDomainScaffold({
    name: options.name || path.basename(targetDir),
    ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
  })

  fs.mkdirSync(targetDir, { recursive: true })
  for (const dir of plan.dirs) fs.mkdirSync(path.join(targetDir, dir), { recursive: true })
  for (const file of plan.files) {
    const target = path.join(targetDir, file.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(`${target}.tmp`, file.content, 'utf-8')
    fs.renameSync(`${target}.tmp`, target)
  }

  // Copy the old domain tree under sources/import/<old-domain-folder> (excluding .git / node_modules)
  function copyTree(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      if (['.git', 'node_modules', 'dist', 'coverage', 'backups'].includes(entry.name)) continue
      const srcFull = path.join(src, entry.name)
      const destFull = path.join(dest, entry.name)
      if (entry.isDirectory()) {
        fs.mkdirSync(destFull, { recursive: true })
        copyTree(srcFull, destFull)
      } else if (entry.isFile()) {
        fs.copyFileSync(srcFull, destFull)
      }
    }
  }

  const importDir = path.join(targetDir, 'sources', 'import', path.basename(srcDir))
  fs.mkdirSync(importDir, { recursive: true })
  copyTree(srcDir, importDir)

  console.log('════════════════════════════════════════════════════════════')
  console.log('           Import Legacy Domain as Read-Only Source         ')
  console.log('════════════════════════════════════════════════════════════')
  console.log(`New Canonical domaiNN created at: ${targetDir}`)
  console.log(`Legacy domain imported into:      ${importDir}\n`)
  console.log('Your legacy files remain unchanged as an archival source.')
  console.log('Next: derive add_model / add_element changes that cite the import through sources::,')
  console.log('propose them with propose_changeset, review the console, then apply_change.')
}

/**
 * Scans a domain directory for Level 3 models and freezes any unfrozen element slugs.
 *
 * @param {string} domainDir
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ scanned: number, modified: number, frozenModels: Array<{ file: string, frozenCount: number, slugs: string[] }> }>}
 */
async function freezeDomainSlugs(domainDir, options = {}) {
  const dryRun = options.dryRun === true
  const { parseKnowledge, serializeKnowledge, freeze_slugs } = await loadInnfoCore()
  const ws = path.resolve(domainDir)
  const candidateDirs = [path.join(ws, 'kNNowledge'), path.join(ws, 'models'), ws]

  const markdownFiles = new Set()
  for (const d of candidateDirs) {
    if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      const entries = fs.readdirSync(d, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          if (d === ws && (entry.name.startsWith('domaiNN_') || entry.name.startsWith('workspace_'))) {
            continue
          }
          markdownFiles.add(path.join(d, entry.name))
        }
      }
    }
  }

  let scanned = 0
  let modified = 0
  const frozenModels = []

  for (const file of markdownFiles) {
    const rel = path.relative(ws, file).replace(/\\/g, '/')
    let content
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }

    let parsed
    try {
      parsed = parseKnowledge(content)
    } catch {
      continue
    }

    const fm = parsed.frontmatter || {}
    const isLevel3 = fm.level === 3 || fm.role === 'knowledge' || Boolean(fm.parent_spec)
    if (!isLevel3) continue

    scanned++
    let unfrozenCount = 0
    for (const [, elements] of parsed.elements.entries()) {
      for (const el of elements) {
        if (!el.slugExplicit) {
          unfrozenCount++
        }
      }
    }

    if (unfrozenCount > 0) {
      freeze_slugs(parsed)
      const frozenSlugs = []
      for (const [, elements] of parsed.elements.entries()) {
        for (const el of elements) {
          if (el.slug) frozenSlugs.push(el.slug)
        }
      }
      modified++
      frozenModels.push({ file: rel, frozenCount: unfrozenCount, slugs: frozenSlugs })
      if (!dryRun) {
        const serialized = serializeKnowledge(parsed)
        fs.writeFileSync(file, serialized, 'utf-8')
      }
    }
  }

  return { scanned, modified, frozenModels }
}

const USAGE =
  'Usage: node migrate-domain.js --domain-dir <dir> (--freeze-slugs [--apply] [--json] | --import-as-source --new-domain-dir <dir> [--name <title>] [--workspace-id <id>])'

/** Every option the CLI accepts; anything else starting with "--" is rejected. */
const OPTIONS_WITH_VALUE = new Set(['--domain-dir', '--workspace-dir', '--new-domain-dir', '--name', '--workspace-id'])
const OPTIONS_FLAG = new Set(['--freeze-slugs', '--import-as-source', '--json'])

/**
 * Returns the first unknown option in `argv`, or null. `--apply` is only valid with
 * `--freeze-slugs` (it is the write switch of that mode, not a migration apply).
 *
 * @param {string[]} argv
 * @returns {string | null}
 */
function findUnknownOption(argv) {
  const isFreeze = argv.includes('--freeze-slugs')
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    if (OPTIONS_WITH_VALUE.has(arg)) {
      i++
      continue
    }
    if (OPTIONS_FLAG.has(arg)) continue
    if (arg === '--apply' && isFreeze) continue
    return arg
  }
  return null
}

async function main() {
  const unknown = findUnknownOption(process.argv.slice(2))
  if (unknown) {
    console.error(`Error: unknown option: ${unknown}`)
    console.error(USAGE)
    process.exit(1)
  }

  const isJson = process.argv.includes('--json')
  const isApply = process.argv.includes('--apply')
  const domainDirArg = getArg('--domain-dir') || getArg('--workspace-dir')
  const importAsSourceArg = process.argv.includes('--import-as-source')
  const newDomainDirArg = getArg('--new-domain-dir')

  if (!domainDirArg) {
    console.error(USAGE)
    process.exit(1)
  }

  const ws = path.resolve(domainDirArg)
  if (!fs.existsSync(ws) || !fs.statSync(ws).isDirectory()) {
    console.error(`Error: Domain directory not found: ${ws}`)
    process.exit(1)
  }

  // Freeze slugs flow
  if (process.argv.includes('--freeze-slugs')) {
    const dryRun = !isApply
    const result = await freezeDomainSlugs(ws, { dryRun })
    if (isJson) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(dryRun ? 'Domain Slug Freezing (DRY RUN):' : 'Domain Slug Freezing (APPLIED):')
      console.log(`  Scanned: ${result.scanned} models`)
      console.log(`  Models with unfrozen slugs: ${result.modified}`)
      for (const m of result.frozenModels) {
        console.log(`    ${m.file}: froze ${m.frozenCount} slugs (${m.slugs.join(', ')})`)
      }
      if (dryRun && result.modified > 0) {
        console.log('\nRun with --apply to freeze slugs in place.')
      }
    }
    return
  }

  // Import as source flow
  if (importAsSourceArg) {
    if (!newDomainDirArg) {
      console.error('Error: --new-domain-dir <dir> is required when using --import-as-source.')
      process.exit(1)
    }
    await runImportAsSource(ws, newDomainDirArg, {
      name: getArg('--name') || undefined,
      workspaceId: getArg('--workspace-id') || undefined,
    })
    return
  }

  console.error(USAGE)
  process.exit(1)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = {
  main,
  freezeDomainSlugs,
  findUnknownOption,
}
