#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/migrate-domain.test.js
 *
 * Test suite for migrate-domain.js and full-tree backup-workspace.js
 */

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const SCRIPT_DIR = __dirname
const MIGRATE_CLI = path.join(SCRIPT_DIR, 'migrate-domain.js')
const BACKUP_CLI = path.join(SCRIPT_DIR, 'backup-workspace.js')
const { isOpaqueFile, removeEmptyDirsBottomUp } = require('./migrate-domain.js')
const TARGETS_FIXTURE_DIR = path.resolve(
  SCRIPT_DIR,
  '../../../iNNfo/packages/innfo-core/tests/legacy/fixtures/targets',
)

function runCli(args) {
  return spawnSync(process.execPath, [MIGRATE_CLI, ...args], { encoding: 'utf-8' })
}

function runBackupCli(args) {
  return spawnSync(process.execPath, [BACKUP_CLI, ...args], { encoding: 'utf-8' })
}

function sha256File(file) {
  const content = fs.readFileSync(file)
  return crypto.createHash('sha256').update(content).digest('hex')
}

function populateLegacyDomain(dir) {
  fs.mkdirSync(path.join(dir, 'models'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'specs', 'templates', 'workspace'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'feedback'), { recursive: true })

  fs.writeFileSync(
    path.join(dir, 'workspace_NN.md'),
    '---\ntemplate_version: "0.1.0"\ntemplate_name: "workspace"\nmodels_dir: "models"\ntemplates_dir: "specs/templates"\nparent_spec:\n  name: "workspace"\n  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/templates/workspace/spec_NN.md"\n---\n# NN index\n\n* [[Workspace]]\n* [[Models]]\n\n# NN Workspace\n\n- Ref: path:: models/core_NN.md\n- Sources: fuentes:: ["models/core_NN.md"]\n- Link: [Core](./models/core_NN.md)\n- Wikilink: [[#Workspace]]\n\n## NN Models\n\n## NN Templates\n',
    'utf-8',
  )

  fs.writeFileSync(
    path.join(dir, 'models', 'core_NN.md'),
    '---\nmodel_version: "0.1.0"\nblueprint_name: "custom_app"\n---\n# Custom App Heading\n\n- Field:: value\n- Related: fuentes:: ["models/core_NN.md"]\n',
    'utf-8',
  )

  fs.writeFileSync(
    path.join(dir, 'feedback', 'core_feedback_20260929-120000.json'),
    JSON.stringify(
      {
        source_model: 'core',
        source_model_version: '0.1.0',
        target_template: 'custom_app',
      },
      null,
      2,
    ),
    'utf-8',
  )
}

async function runTests() {
  console.log('Running migrate-domain.js & backup-workspace.js unit tests...')
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-domain-test-'))

  try {
    // 1. backup-workspace.js full-tree backup test
    {
      const wsDir = path.join(tmpRoot, 'backup-test-ws')
      fs.mkdirSync(wsDir, { recursive: true })
      populateLegacyDomain(wsDir)
      fs.writeFileSync(path.join(wsDir, 'domaiNN_NN.md'), '# domaiNN Root\n', 'utf-8')

      const res = runBackupCli(['--workspace-dir', wsDir, '--json'])
      assert.strictEqual(res.status, 0, res.stderr)
      const data = JSON.parse(res.stdout)
      assert.ok(data.ok, 'backup succeeded')
      assert.ok(fs.existsSync(data.target), 'backup target created')
      assert.ok(
        fs.existsSync(path.join(data.target, 'workspace_NN.md')),
        'workspace_NN.md present in backup',
      )
      assert.ok(
        fs.existsSync(path.join(data.target, 'domaiNN_NN.md')),
        'domaiNN_NN.md present in backup',
      )
      assert.ok(
        fs.existsSync(path.join(data.target, 'models', 'core_NN.md')),
        'models/core_NN.md present in backup',
      )
      console.log('✔ backup-workspace performs full-tree backup including root docs')
    }

    // 2. Dry-run writes nothing
    {
      const domainDir = path.join(tmpRoot, 'dry-run-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)

      const beforeFiles = fs.readdirSync(domainDir)
      const res = runCli(['--domain-dir', domainDir])
      assert.strictEqual(res.status, 0, res.stderr)
      assert.ok(res.stdout.includes('Plan Hash:'), 'prints plan hash')
      assert.ok(res.stdout.includes('DRY RUN'), 'identifies dry run')

      const afterFiles = fs.readdirSync(domainDir)
      assert.deepStrictEqual(beforeFiles, afterFiles, 'dry-run modified no files')
      console.log('✔ dry-run outputs complete plan report and writes nothing to disk')
    }

    // 3. Plan hash mismatch aborts write run
    {
      const domainDir = path.join(tmpRoot, 'hash-mismatch-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)

      const dryRes = runCli(['--domain-dir', domainDir, '--json'])
      const plan = JSON.parse(dryRes.stdout)
      const planHash = plan.planHash

      // Modify tree after dry-run
      fs.writeFileSync(path.join(domainDir, 'models', 'new_NN.md'), '# New\n', 'utf-8')

      const applyRes = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', planHash, '--yes'])
      assert.strictEqual(applyRes.status, 1, 'apply must fail on hash mismatch')
      assert.ok(applyRes.stderr.includes('hash mismatch') || applyRes.stdout.includes('hash mismatch'))
      console.log('✔ --apply with stale --plan-hash aborts without write')
    }

    // 4. Successful apply migration
    let backupDirUsed = ''
    {
      const domainDir = path.join(tmpRoot, 'apply-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)

      const dryRes = runCli(['--domain-dir', domainDir, '--json'])
      const plan = JSON.parse(dryRes.stdout)
      const planHash = plan.planHash

      const applyRes = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', planHash, '--yes'])
      assert.strictEqual(applyRes.status, 0, applyRes.stderr)
      assert.ok(fs.existsSync(path.join(domainDir, 'domaiNN_NN.md')), 'domaiNN_NN.md exists')
      assert.ok(!fs.existsSync(path.join(domainDir, 'workspace_NN.md')), 'workspace_NN.md moved')
      assert.ok(fs.existsSync(path.join(domainDir, 'kNNowledge', 'core_NN.md')), 'kNNowledge/core_NN.md exists')
      assert.ok(!fs.existsSync(path.join(domainDir, 'models')), 'models/ moved')

      const domainnContent = fs.readFileSync(path.join(domainDir, 'domaiNN_NN.md'), 'utf-8')
      assert.ok(domainnContent.includes('# NN domaiNN'), 'NN Workspace renamed to NN domaiNN')
      assert.ok(domainnContent.includes('## NN kNNowledge'), 'NN Models renamed to NN kNNowledge')
      assert.ok(domainnContent.includes('path:: kNNowledge/core_NN.md'), 'path:: reference rewritten')
      assert.ok(domainnContent.includes('fuentes:: ["kNNowledge/core_NN.md"]'), 'fuentes array reference rewritten')
      assert.ok(domainnContent.includes('[Core](./kNNowledge/core_NN.md)'), 'markdown link rewritten')
      assert.ok(domainnContent.includes('name: "domaiNN"'), 'parent_spec name renamed to domaiNN')

      const coreContent = fs.readFileSync(path.join(domainDir, 'kNNowledge', 'core_NN.md'), 'utf-8')
      assert.ok(coreContent.includes('fuentes:: ["kNNowledge/core_NN.md"]'), 'model fuentes array reference rewritten')

      // Check feedback JSON
      const feedbackPath = path.join(domainDir, 'feedback', 'core_feedback_20260929-120000.json')
      assert.ok(fs.existsSync(feedbackPath), 'feedback file preserved')
      const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'))
      assert.strictEqual(feedback.source_knowledge, 'core')
      assert.strictEqual(feedback.target_blueprint, 'custom_app')
      assert.strictEqual(feedback.source_model, undefined)

      // Find backup dir
      const match = applyRes.stdout.match(/Backup created at: (.*)/)
      if (match) backupDirUsed = match[1].trim()

      console.log('✔ --apply successfully migrates domain layout, keys, and references in place')
    }

    // 5. Double run is noop
    {
      const domainDir = path.join(tmpRoot, 'apply-domain')
      const res = runCli(['--domain-dir', domainDir])
      assert.strictEqual(res.status, 0, res.stderr)
      assert.ok(res.stdout.includes('already up to date') || res.stdout.includes('noop'))
      console.log('✔ second run on migrated domain is a clean noop')
    }

    // 6. Interrupted run offering --restore and verified restore
    {
      const domainDir = path.join(tmpRoot, 'interrupted-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)

      const initialSha = sha256File(path.join(domainDir, 'workspace_NN.md'))

      const dryRes = runCli(['--domain-dir', domainDir, '--json'])
      const plan = JSON.parse(dryRes.stdout)
      const planHash = plan.planHash

      // Simulate fault injection with --fail-after 1
      const failRes = runCli([
        '--domain-dir',
        domainDir,
        '--apply',
        '--plan-hash',
        planHash,
        '--yes',
        '--fail-after',
        '1',
      ])
      assert.strictEqual(failRes.status, 1, 'fault injection stops process')

      // Next run detects interrupted run
      const nextRun = runCli(['--domain-dir', domainDir])
      assert.strictEqual(nextRun.status, 1)
      assert.ok(nextRun.stderr.includes('--restore') || nextRun.stdout.includes('--restore'))

      // Extract backup path from journal or stderr
      const backupDirMatch = (failRes.stdout + failRes.stderr + nextRun.stdout + nextRun.stderr).match(/Backup:\s*([^\r\n]+)/)
      assert.ok(backupDirMatch, 'backup directory found')
      const backupDir = backupDirMatch[1].trim()

      // Run restore
      const restoreRes = runCli(['--domain-dir', domainDir, '--restore', backupDir])
      assert.strictEqual(restoreRes.status, 0, restoreRes.stderr)
      assert.ok(fs.existsSync(path.join(domainDir, 'workspace_NN.md')))
      assert.ok(!fs.existsSync(path.join(domainDir, 'domaiNN_NN.md')))
      const restoredSha = sha256File(path.join(domainDir, 'workspace_NN.md'))
      assert.strictEqual(initialSha, restoredSha, 'restored file matches initial sha256')
      console.log('✔ interrupted run offers --restore and restores byte-identical state')
    }

    // 7. Malformed frontmatter blocks migration
    {
      const domainDir = path.join(tmpRoot, 'blocked-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)
      fs.writeFileSync(path.join(domainDir, 'models', 'broken_NN.md'), '---bad [yaml\n---\n', 'utf-8')

      const res = runCli(['--domain-dir', domainDir])
      assert.strictEqual(res.status, 1)
      assert.ok(res.stdout.includes('BLOCKED') || res.stderr.includes('BLOCKED'))
      console.log('✔ malformed document stops at dry-run and blocks write consent')
    }

    // 8. Import-as-source mode
    {
      const legacyDir = path.join(tmpRoot, 'source-legacy-domain')
      const newDomainDir = path.join(tmpRoot, 'imported-target-domain')
      fs.mkdirSync(legacyDir, { recursive: true })
      populateLegacyDomain(legacyDir)

      const initialLegacySha = sha256File(path.join(legacyDir, 'workspace_NN.md'))

      const res = runCli([
        '--domain-dir',
        legacyDir,
        '--import-as-source',
        '--new-domain-dir',
        newDomainDir,
      ])
      assert.strictEqual(res.status, 0, res.stderr)
      assert.ok(fs.existsSync(path.join(newDomainDir, 'domaiNN_NN.md')), 'new domaiNN created')
      assert.ok(
        fs.existsSync(path.join(newDomainDir, 'sources', 'legacy', 'workspace_NN.md')),
        'legacy tree copied under sources/legacy',
      )
      const importedLegacySha = sha256File(path.join(newDomainDir, 'sources', 'legacy', 'workspace_NN.md'))
      assert.strictEqual(initialLegacySha, importedLegacySha, 'imported legacy domain is byte-identical')
      console.log('✔ --import-as-source scaffolds domaiNN and imports legacy tree byte-identically')
    }

    // 9. isOpaqueFile seam tests
    {
      const invalidUtf8 = Buffer.from([0xff, 0xfe, 0x12, 0x34])
      assert.strictEqual(isOpaqueFile(invalidUtf8, 'data.bin'), true, 'invalid UTF-8 is opaque')

      const validPngUtf8 = Buffer.from('just some text')
      assert.strictEqual(isOpaqueFile(validPngUtf8, 'image.png'), true, '.png is always opaque')

      const mdText = Buffer.from('# Hello markdown', 'utf8')
      assert.strictEqual(isOpaqueFile(mdText, 'doc.md'), false, '.md is not opaque')
      console.log('✔ isOpaqueFile correctly classifies binary vs text files')
    }

    // 10. removeEmptyDirsBottomUp seam tests
    {
      const testDir = path.join(tmpRoot, 'clean-test')
      fs.mkdirSync(path.join(testDir, 'empty-sub', 'nested'), { recursive: true })
      fs.mkdirSync(path.join(testDir, 'non-empty'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'non-empty', 'keep.txt'), 'keep me', 'utf8')

      const leftovers = removeEmptyDirsBottomUp(testDir)
      assert.deepStrictEqual(leftovers, ['non-empty/keep.txt'])
      assert.ok(!fs.existsSync(path.join(testDir, 'empty-sub')), 'empty directory removed')
      assert.ok(fs.existsSync(path.join(testDir, 'non-empty', 'keep.txt')), 'non-empty file preserved')
      console.log('✔ removeEmptyDirsBottomUp prunes empty dirs without losing non-empty files')
    }

    // 11. Opaque binary file migration preserving sha256 byte-for-byte
    {
      const domainDir = path.join(tmpRoot, 'opaque-test-domain')
      fs.mkdirSync(domainDir, { recursive: true })
      populateLegacyDomain(domainDir)

      // Add a binary PNG file in models/
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02])
      fs.writeFileSync(path.join(domainDir, 'models', 'diagram.png'), pngBuffer)
      const origPngSha = sha256File(path.join(domainDir, 'models', 'diagram.png'))

      const dryRes = runCli(['--domain-dir', domainDir, '--json'])
      const plan = JSON.parse(dryRes.stdout)
      const planHash = plan.planHash

      const applyRes = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', planHash, '--yes'])
      assert.strictEqual(applyRes.status, 0, applyRes.stderr)
      assert.ok(fs.existsSync(path.join(domainDir, 'kNNowledge', 'diagram.png')), 'opaque file moved to kNNowledge')
      assert.ok(!fs.existsSync(path.join(domainDir, 'models', 'diagram.png')), 'old opaque file removed')

      const migratedPngSha = sha256File(path.join(domainDir, 'kNNowledge', 'diagram.png'))
      assert.strictEqual(origPngSha, migratedPngSha, 'opaque binary file matches sha256 byte-for-byte with no corruption')
      console.log('✔ opaque binary files are moved byte-for-byte without text corruption')
    }

    // 12. Leftover preservation via removeEmptyDirsBottomUp
    {
      const testModelsDir = path.join(tmpRoot, 'test-models-leftover')
      fs.mkdirSync(path.join(testModelsDir, 'empty-dir'), { recursive: true })
      fs.writeFileSync(path.join(testModelsDir, 'unmigrated.txt'), 'content', 'utf8')

      const leftovers = removeEmptyDirsBottomUp(testModelsDir)
      assert.deepStrictEqual(leftovers, ['unmigrated.txt'])
      assert.ok(fs.existsSync(path.join(testModelsDir, 'unmigrated.txt')), 'unmigrated file preserved')
      assert.ok(!fs.existsSync(path.join(testModelsDir, 'empty-dir')), 'empty subdir pruned')
      console.log('✔ removeEmptyDirsBottomUp preserves unmigrated files in legacy directories')
    }

    // 13. Restore refuses mismatching domain
    {
      const domainDir1 = path.join(tmpRoot, 'domain-1')
      const domainDir2 = path.join(tmpRoot, 'domain-2')
      fs.mkdirSync(domainDir1, { recursive: true })
      fs.mkdirSync(domainDir2, { recursive: true })
      populateLegacyDomain(domainDir1)
      populateLegacyDomain(domainDir2)

      const dryRes = runCli(['--domain-dir', domainDir1, '--json'])
      const planHash = JSON.parse(dryRes.stdout).planHash
      const applyRes = runCli(['--domain-dir', domainDir1, '--apply', '--plan-hash', planHash, '--yes'])
      const match = applyRes.stdout.match(/Backup created at: (.*)/)
      assert.ok(match, 'backup dir found')
      const backupDir = match[1].trim()

      const badRestoreRes = runCli(['--domain-dir', domainDir2, '--restore', backupDir])
      assert.strictEqual(badRestoreRes.status, 1, 'restore must fail when domain does not match journal')
      assert.ok(
        badRestoreRes.stderr.includes('Backup domain mismatch') || badRestoreRes.stdout.includes('Backup domain mismatch'),
      )
      console.log('✔ restore refuses backups created for different domain directories')
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }

  console.log('All migrate-domain unit tests passed successfully!\n')
}

runTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
