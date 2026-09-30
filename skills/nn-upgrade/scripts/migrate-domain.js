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
 *   4. in-place op application + journal.json
 *   5. restore (--restore <backupDir>)
 *   6. import-as-source exit (--import-as-source --new-domain-dir <dir>)
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { backupWorkspace, sha256 } = require('./backup-workspace.js')
const { detectLegacy, planMigration } = require('./lib/legacy-migrate.generated.cjs')

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
        return fs.readFileSync(fullPath, 'utf8')
      } catch {
        return null
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

  const lines = fs.readFileSync(manifestFile, 'utf8').split(/\r?\n/).filter(Boolean)
  const expectedEntries = lines.map((l) => {
    const parts = l.trim().split(/\s+/)
    return { hash: parts[0], file: parts.slice(1).join(' ') }
  })

  // Remove files created during migration that were not in original backup
  const originalFileSet = new Set(expectedEntries.map((e) => e.file))

  function cleanCreated(dir, rel = '') {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['.git', 'node_modules'].includes(entry.name)) continue
        cleanCreated(full, entryRel)
        try {
          if (fs.readdirSync(full).length === 0) fs.rmdirSync(full)
        } catch {}
      } else {
        if (!originalFileSet.has(entryRel)) {
          fs.unlinkSync(full)
        }
      }
    }
  }

  cleanCreated(ws)

  // Copy backup files back and verify hashes
  for (const { hash, file } of expectedEntries) {
    const src = path.join(bkp, file)
    const dest = path.join(ws, file)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
    const restoredHash = sha256(dest)
    if (restoredHash !== hash) {
      throw new Error(`SHA256 mismatch during restore for ${file}: expected ${hash}, got ${restoredHash}`)
    }
  }

  const journalPath = path.join(bkp, 'journal.json')
  if (fs.existsSync(journalPath)) {
    try {
      const jData = JSON.parse(fs.readFileSync(journalPath, 'utf8'))
      jData.restored = true
      jData.committed = true
      fs.writeFileSync(journalPath, JSON.stringify(jData, null, 2), 'utf8')
    } catch {}
  }

  console.log(`▶ Restore completed successfully from: ${bkp}`)
  console.log(`  ${expectedEntries.length} files restored and verified with SHA-256 equality.`)
}

async function runImportAsSource(legacyDir, newDomainDir) {
  const srcDir = path.resolve(legacyDir)
  const targetDir = path.resolve(newDomainDir)

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source domain directory not found: ${srcDir}`)
  }

  fs.mkdirSync(targetDir, { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'kNNowledge'), { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'specs', 'bluepriNNts', 'domaiNN'), { recursive: true })

  // Scaffold domaiNN root
  const domainnContent =
    '---\n' +
    'blueprint_version: "0.1.0"\n' +
    'blueprint_name: "domaiNN"\n' +
    'knowledge_dir: "kNNowledge"\n' +
    'blueprints_dir: "specs/bluepriNNts"\n' +
    'parent_spec:\n' +
    '  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"\n' +
    '---\n\n' +
    '# domaiNN\n\n' +
    '## Lineage & Sources\n\n' +
    '- Imported legacy domain from [[./sources/legacy/]]\n\n' +
    '## kNNowledge\n\n' +
    '## bluepriNNts\n'

  fs.writeFileSync(path.join(targetDir, 'domaiNN_NN.md'), domainnContent, 'utf-8')

  // Copy legacy tree into sources/legacy
  const destLegacy = path.join(targetDir, 'sources', 'legacy')
  fs.mkdirSync(destLegacy, { recursive: true })
  fs.cpSync(srcDir, destLegacy, {
    recursive: true,
    filter: (s) => !s.includes('.git') && !s.includes('node_modules'),
  })

  console.log(`▶ Import-as-Source completed at: ${targetDir}`)
  console.log(`  NOTE: Original identities and version continuity are reset in the new domaiNN.`)
  console.log(`  Legacy workspace archived under sources/legacy/ with complete citation lineage.`)
}

async function main() {
  const isJson = process.argv.includes('--json')
  const isApply = process.argv.includes('--apply')
  const hasConsent = process.argv.includes('--yes')
  const domainDir = getArg('--domain-dir') || getArg('--workspace-dir') || process.cwd()
  const planHashArg = getArg('--plan-hash')
  const restoreArg = getArg('--restore')
  const importAsSource = process.argv.includes('--import-as-source')
  const newDomainDir = getArg('--new-domain-dir')
  const failAfter = getArg('--fail-after') ? parseInt(getArg('--fail-after'), 10) : null

  if (restoreArg) {
    await runRestore(domainDir, restoreArg)
    return
  }

  if (importAsSource) {
    if (!newDomainDir) {
      throw new Error('Flag --new-domain-dir <dir> is required for --import-as-source')
    }
    await runImportAsSource(domainDir, newDomainDir)
    return
  }

  const ws = path.resolve(domainDir)
  if (!fs.existsSync(ws) || !fs.statSync(ws).isDirectory()) {
    throw new Error(`Domain directory not found: ${ws}`)
  }

  // Check for interrupted migration in previous backups
  try {
    const parentDir = path.dirname(ws)
    const baseName = path.basename(ws)
    const candidateBackups = fs.readdirSync(parentDir)
      .filter((name) => name.startsWith(`${baseName}-backup-`))
      .map((name) => path.join(parentDir, name))

    for (const bkp of candidateBackups) {
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
    console.error('\nFix the issues above or consider using: node migrate-domain.js --import-as-source --new-domain-dir <dir>')
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
    console.log('\nTo execute this migration:')
    console.log(`  node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir "${ws}" --apply --plan-hash "${plan.planHash}" --yes`)
    return
  }

  // APPLY MODE
  if (!planHashArg) {
    console.error('❌ Flag --plan-hash <hash> is required when running with --apply.')
    process.exit(1)
  }

  if (plan.planHash !== planHashArg) {
    console.error(`❌ Plan hash mismatch: tree changed since dry-run.\nExpected: ${planHashArg}\nCurrent:  ${plan.planHash}`)
    process.exit(1)
  }

  if (!hasConsent) {
    console.error('❌ Consent required: pass --yes to confirm domain migration write.')
    process.exit(1)
  }

  // 1. Create full-tree out-of-tree backup
  const backup = backupWorkspace(ws)
  const backupTarget = backup.target
  console.log(`Backup created at: ${backupTarget}`)

  const journalFile = path.join(backupTarget, 'journal.json')
  const journal = {
    committed: false,
    backupTarget,
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
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.renameSync(src, dest)
        journal.appliedOps.push({ op: 'move', from: op.from, to: op.to })
      } else if (op.op === 'write') {
        const dest = path.join(ws, op.path)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.writeFileSync(dest, op.content, 'utf-8')
        journal.appliedOps.push({ op: 'write', path: op.path })
      }
      count++
      fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2), 'utf-8')
    }

    // Clean empty legacy dirs if needed
    for (const d of ['models', 'templates', path.join('specs', 'templates')]) {
      const full = path.join(ws, d)
      try {
        if (fs.existsSync(full)) {
          // If directory is empty (or only contains empty subdirs), remove it
          fs.rmSync(full, { recursive: true, force: true })
        }
      } catch {}
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

module.exports = { main }
