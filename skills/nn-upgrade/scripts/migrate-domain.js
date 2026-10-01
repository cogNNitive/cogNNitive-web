#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/migrate-domain.js
 *
 * Migration CLI for legacy iNNfo domains.
 *
 * Flow:
 *   1. detect -> dry-run (planMigration)
 *   2. consent & hash check (--apply --plan-hash <hash> [--yes])
 *   3. full-tree out-of-tree backup + sha256 manifest
 *   4. in-place op application + write-ahead journal.json
 *   5. restore (--restore <backupDir>)
 *   6. import-as-source exit (--import-as-source --new-domain-dir <dir>)
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { backupWorkspace, sha256 } = require('./backup-workspace.js')
const { detectLegacy, planMigration } = require('./lib/legacy-migrate.generated.cjs')

const OPAQUE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.zip',
  '.ico',
  '.woff',
  '.woff2',
  '.mp3',
  '.mp4',
])

/**
 * Determines whether a file is opaque (binary) and should be moved byte-for-byte
 * without parsing or text transformations.
 *
 * @param {Buffer} buf
 * @param {string} [relPath]
 * @returns {boolean}
 */
function isOpaqueFile(buf, relPath) {
  if (relPath) {
    const ext = path.extname(relPath).toLowerCase()
    if (OPAQUE_EXTENSIONS.has(ext)) return true
  }
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true })
    decoder.decode(buf)
    return false
  } catch {
    return true
  }
}

/**
 * Removes empty directories recursively bottom-up using rmdirSync.
 * Never deletes files. Returns any non-empty leftover file paths.
 *
 * @param {string} rootPath
 * @returns {string[]}
 */
function removeEmptyDirsBottomUp(rootPath) {
  if (!fs.existsSync(rootPath)) return []
  const leftovers = []

  function clean(dir, rel = '') {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        clean(full, relPath)
        try {
          fs.rmdirSync(full)
        } catch {}
      } else {
        leftovers.push(relPath)
      }
    }
  }

  clean(rootPath, '')
  try {
    fs.rmdirSync(rootPath)
  } catch {}

  return leftovers
}

function createFsDomainReader(baseDir) {
  return {
    async list(relDir) {
      const fullDir = relDir ? path.join(baseDir, relDir) : baseDir
      try {
        return fs.readdirSync(fullDir)
      } catch {
        return []
      }
    },
    async read(relPath) {
      const fullPath = path.join(baseDir, relPath)
      try {
        const stat = fs.statSync(fullPath)
        if (!stat.isFile()) return null
        const buf = fs.readFileSync(fullPath)
        if (isOpaqueFile(buf, relPath)) return null
        return buf.toString('utf8')
      } catch {
        return null
      }
    },
    async isOpaque(relPath) {
      const fullPath = path.join(baseDir, relPath)
      try {
        const stat = fs.statSync(fullPath)
        if (!stat.isFile()) return false
        const buf = fs.readFileSync(fullPath)
        return isOpaqueFile(buf, relPath)
      } catch {
        return false
      }
    },
  }
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null
}

async function runRestore(domainDir, backupDir) {
  const ws = path.resolve(domainDir)
  const bkp = path.resolve(backupDir)

  if (!fs.existsSync(bkp)) {
    throw new Error(`Backup directory not found: ${bkp}`)
  }

  const manifestFile = path.join(bkp, 'manifest.sha256')
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`Backup manifest.sha256 missing at: ${manifestFile}`)
  }

  const journalFile = path.join(bkp, 'journal.json')
  if (!fs.existsSync(journalFile)) {
    throw new Error(`Backup journal.json missing at: ${journalFile}. Re-run migration backup or restore manually.`)
  }

  let journalData
  try {
    journalData = JSON.parse(fs.readFileSync(journalFile, 'utf8'))
  } catch {
    throw new Error(`Invalid journal.json in backup directory: ${journalFile}`)
  }

  if (!journalData.domainDir || path.resolve(journalData.domainDir) !== ws) {
    throw new Error(
      `Backup domain mismatch: journal domainDir "${journalData.domainDir}" does not match target "${ws}".`,
    )
  }

  const lines = fs.readFileSync(manifestFile, 'utf8').split(/\r?\n/).filter(Boolean)
  const expectedEntries = lines.map((l) => {
    const parts = l.trim().split(/\s+/)
    return { hash: parts[0], file: parts.slice(1).join(' ') }
  })

  // Step 1: Pre-verify all backup files BEFORE touching domainDir
  for (const { hash, file } of expectedEntries) {
    const src = path.join(bkp, file)
    if (!fs.existsSync(src)) {
      throw new Error(`Corrupted backup: missing file ${file} in ${bkp}`)
    }
    const currentHash = sha256(src)
    if (currentHash !== hash) {
      throw new Error(`Corrupted backup: SHA256 mismatch for ${file} in backup`)
    }
  }

  // Step 2: Copy-then-rename to <dest>.nn-restore-tmp
  for (const { hash, file } of expectedEntries) {
    const src = path.join(bkp, file)
    const dest = path.join(ws, file)
    const tmpDest = `${dest}.nn-restore-tmp`
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, tmpDest)
    const tmpHash = sha256(tmpDest)
    if (tmpHash !== hash) {
      fs.unlinkSync(tmpDest)
      throw new Error(`SHA256 verification failed during restore staging for ${file}`)
    }
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest)
    }
    fs.renameSync(tmpDest, dest)
  }

  // Step 3: Remove journaled created files that were not in original backup
  const originalFileSet = new Set(expectedEntries.map((e) => e.file))
  const createdFiles = journalData.created || []
  for (const created of createdFiles) {
    if (!originalFileSet.has(created)) {
      const full = path.join(ws, created)
      if (fs.existsSync(full)) {
        try {
          fs.unlinkSync(full)
        } catch {}
      }
    }
  }

  // Prune empty directories
  function pruneEmpty(dir) {
    if (!fs.existsSync(dir)) return
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (['.git', 'node_modules'].includes(entry.name)) continue
        pruneEmpty(path.join(dir, entry.name))
      }
    }
    try {
      if (fs.readdirSync(dir).length === 0 && dir !== ws) {
        fs.rmdirSync(dir)
      }
    } catch {}
  }
  pruneEmpty(ws)

  journalData.restored = true
  journalData.committed = true
  fs.writeFileSync(journalFile, JSON.stringify(journalData, null, 2), 'utf8')

  console.log(`▶ Restore completed successfully from: ${bkp}`)
  console.log(`  ${expectedEntries.length} files restored and verified with SHA-256 equality.`)
}

async function runImportAsSource(legacyDir, newDomainDir) {
  const srcDir = path.resolve(legacyDir)
  const targetDir = path.resolve(newDomainDir)

  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    throw new Error(`Source legacy domain directory not found: ${srcDir}`)
  }

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory is not empty: ${targetDir}`)
  }

  fs.mkdirSync(targetDir, { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'kNNowledge'), { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'sources', 'legacy'), { recursive: true })

  // Scaffold standard domaiNN_NN.md
  const scaffold = `---
blueprint_version: "0.1.0"
blueprint_name: "domaiNN"
knowledge_dir: "kNNowledge"
blueprints_dir: "specs/bluepriNNts"
parent_spec:
  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"
---
# domaiNN Definition

- Domain Type:: domaiNN
- Legacy Source:: sources/legacy

## kNNowledge

## Sources

- Legacy Domain:: sources/legacy
`
  fs.writeFileSync(path.join(targetDir, 'domaiNN_NN.md'), scaffold, 'utf-8')

  // Copy legacy domain tree under sources/legacy (excluding .git / node_modules)
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

  copyTree(srcDir, path.join(targetDir, 'sources', 'legacy'))

  console.log('════════════════════════════════════════════════════════════')
  console.log('           Import Legacy Domain as Read-Only Source         ')
  console.log('════════════════════════════════════════════════════════════')
  console.log(`New Canonical domaiNN created at: ${targetDir}`)
  console.log(`Legacy domain imported into:      ${path.join(targetDir, 'sources', 'legacy')}\n`)
  console.log('Your legacy files remain unchanged as an archival source.')
}

async function main() {
  const isJson = process.argv.includes('--json')
  const isApply = process.argv.includes('--apply')
  const hasConsent = process.argv.includes('--yes')
  const planHashArg = getArg('--plan-hash')
  const domainDirArg = getArg('--domain-dir') || getArg('--workspace-dir')
  const restoreArg = getArg('--restore')
  const importAsSourceArg = process.argv.includes('--import-as-source')
  const newDomainDirArg = getArg('--new-domain-dir')
  const failAfterArg = getArg('--fail-after')
  const failAfter = failAfterArg !== null ? parseInt(failAfterArg, 10) : null

  if (!domainDirArg) {
    console.error(
      'Usage: node migrate-domain.js --domain-dir <dir> [--apply --plan-hash <hash> --yes] [--restore <backupDir>] [--import-as-source --new-domain-dir <dir>]',
    )
    process.exit(1)
  }

  const ws = path.resolve(domainDirArg)
  if (!fs.existsSync(ws) || !fs.statSync(ws).isDirectory()) {
    console.error(`Error: Domain directory not found: ${ws}`)
    process.exit(1)
  }

  // Restore flow
  if (restoreArg) {
    await runRestore(ws, restoreArg)
    return
  }

  // Import as source flow
  if (importAsSourceArg) {
    if (!newDomainDirArg) {
      console.error('Error: --new-domain-dir <dir> is required when using --import-as-source.')
      process.exit(1)
    }
    await runImportAsSource(ws, newDomainDirArg)
    return
  }

  // Check for interrupted migration in parent backups
  const parent = path.dirname(ws)
  try {
    const parentEntries = fs.readdirSync(parent)
    const backupCandidates = parentEntries
      .filter((e) => e.startsWith(`${path.basename(ws)}-backup-`))
      .map((e) => path.join(parent, e))

    for (const bkp of backupCandidates) {
      const jFile = path.join(bkp, 'journal.json')
      if (fs.existsSync(jFile)) {
        try {
          const jData = JSON.parse(fs.readFileSync(jFile, 'utf8'))
          if (jData && jData.committed === false) {
            console.error(`❌ Interrupted migration detected! Backup: ${bkp}`)
            console.error(`Please restore your domain before performing any further operations:`)
            console.error(`  node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "${ws}" --restore "${bkp}"`)
            process.exit(1)
          }
        } catch {}
      }
    }
  } catch {}

  const reader = createFsDomainReader(ws)

  // Injected dependency adapter for planMigration
  const deps = {
    targets: {
      domaiNN: { version: '0.1.0', spec: '# domaiNN Spec\n' },
    },
    validate(_tree, _targets) {
      return []
    },
  }

  const plan = await planMigration(reader, deps)

  if (isJson && !isApply) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }

  if (plan.status === 'noop') {
    console.log('Domain is already up to date with the canonical domaiNN/kNNowledge layout. No migration needed.')
    return
  }

  if (plan.status === 'blocked') {
    console.error('❌ MIGRATION BLOCKED:')
    plan.problems.forEach((p) => console.error(`  - [${p.severity}] ${p.message}`))
    console.error(
      '\nFix the issues above or consider using: node migrate-domain.js --import-as-source --new-domain-dir <dir>',
    )
    process.exit(1)
  }

  if (!isApply) {
    // DRY RUN
    console.log('════════════════════════════════════════════════════════════')
    console.log('           iNNfo Domain Migration Plan (DRY RUN)           ')
    console.log('════════════════════════════════════════════════════════════')
    console.log(`Domain: ${ws}`)
    console.log(`Plan Hash: ${plan.planHash}\n`)
    console.log('File Renames (Moves):')
    plan.report.renamedFiles.forEach((r) => console.log(`  ${r.from} -> ${r.to}`))
    console.log('\nFile Rewrites:')
    plan.report.rewrittenFiles.forEach((f) => console.log(`  ${f}`))
    if (plan.report.customBlueprints.length) {
      console.log('\nCustom Blueprints (Language Layer Only):')
      plan.report.customBlueprints.forEach((b) => console.log(`  ${b}`))
    }
    const specsTemplates = path.join(ws, 'specs', 'templates')
    if (fs.existsSync(specsTemplates)) {
      console.log('\nLegacy Specs/Templates Migration:')
      console.log('  specs/templates -> specs/bluepriNNts (will be migrated)')
    }
    console.log('\nTo execute this migration:')
    console.log(
      `  node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "${ws}" --apply --plan-hash "${plan.planHash}" --yes`,
    )
    return
  }

  // APPLY MODE
  if (!planHashArg) {
    console.error('❌ Flag --plan-hash <hash> is required when running with --apply.')
    process.exit(1)
  }

  if (plan.planHash !== planHashArg) {
    console.error(
      `❌ Plan hash mismatch: tree changed since dry-run.\nExpected: ${planHashArg}\nCurrent:  ${plan.planHash}`,
    )
    process.exit(1)
  }

  if (!hasConsent) {
    console.error('❌ Consent required: pass --yes to confirm domain migration write.')
    process.exit(1)
  }

  // 1. Create full-tree out-of-tree backup
  const backup = backupWorkspace(ws, { skipDirs: new Set(['.git', 'node_modules']) })
  const backupTarget = backup.target
  console.log(`Backup created at: ${backupTarget}`)

  const journalFile = path.join(backupTarget, 'journal.json')
  const journal = {
    domainDir: path.resolve(ws),
    backupTarget,
    committed: false,
    created: [],
    leftovers: [],
    appliedOps: [],
  }
  fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')

  try {
    let count = 0
    for (const op of plan.ops) {
      if (failAfter !== null && count >= failAfter) {
        throw new Error(`Fault injected after ${count} op(s). Process interrupted! Backup: ${backupTarget}`)
      }

      if (op.op === 'move') {
        const src = path.join(ws, op.from)
        const dest = path.join(ws, op.to)
        const destRel = op.to.replace(/\\/g, '/')
        if (!fs.existsSync(dest)) {
          journal.created.push(destRel)
          fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.renameSync(src, dest)
        journal.appliedOps.push({ op: 'move', from: op.from, to: op.to })
      } else if (op.op === 'write') {
        const dest = path.join(ws, op.path)
        const destRel = op.path.replace(/\\/g, '/')
        if (!fs.existsSync(dest)) {
          journal.created.push(destRel)
          fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, op.content, 'utf-8')
        journal.appliedOps.push({ op: 'write', path: op.path })
      }
      count++
      fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')
    }

    // Clean empty legacy dirs (models and templates only)
    for (const d of ['models', 'templates']) {
      const full = path.join(ws, d)
      const leftovers = removeEmptyDirsBottomUp(full)
      if (leftovers.length > 0) {
        journal.leftovers.push(...leftovers.map((l) => `${d}/${l}`))
      }
    }

    if (journal.leftovers.length > 0) {
      console.warn(`⚠ Leftover non-empty files preserved in legacy directories: ${journal.leftovers.join(', ')}`)
    }

    const specsTemplates = path.join(ws, 'specs', 'templates')
    if (fs.existsSync(specsTemplates)) {
      const destBlueprints = path.join(ws, 'specs', 'bluepriNNts')
      fs.mkdirSync(destBlueprints, { recursive: true })
      const entries = fs.readdirSync(specsTemplates, { withFileTypes: true })
      for (const entry of entries) {
        const src = path.join(specsTemplates, entry.name)
        const dest = path.join(destBlueprints, entry.name)
        if (!fs.existsSync(dest)) {
          fs.renameSync(src, dest)
          journal.appliedOps.push({ op: 'move', from: `specs/templates/${entry.name}`, to: `specs/bluepriNNts/${entry.name}` })
        }
      }
      const leftovers = removeEmptyDirsBottomUp(specsTemplates)
      if (leftovers.length > 0) {
        journal.leftovers.push(...leftovers.map((l) => `specs/templates/${l}`))
      }
      console.log('✔ specs/templates/ migrated to specs/bluepriNNts/.')
    }

    journal.committed = true
    fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')
    console.log(`✔ Migration applied successfully! (${plan.ops.length} ops)`)
  } catch (err) {
    console.error(`❌ Migration failed: ${err.message}`)
    console.error(`\nTo restore your domain to pre-migration state:`)
    console.error(`  node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "${ws}" --restore "${backupTarget}"`)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = {
  main,
  createFsDomainReader,
  isOpaqueFile,
  removeEmptyDirsBottomUp,
  runRestore,
}
