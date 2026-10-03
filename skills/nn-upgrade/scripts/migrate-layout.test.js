#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/migrate-layout.test.js
 *
 * End-to-end test of the layout step of Flow A (migrate-domain.js): backup, dry run,
 * `--plan-hash` consent, preserved-body sidecars from staging/migration/, archive
 * citation warnings, and staging removal.
 */
// legacy:cognitivize-in-place/upgrade-flow

const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const MIGRATE_CLI = path.join(__dirname, 'migrate-domain.js')

function runCli(args) {
  return spawnSync(process.execPath, [MIGRATE_CLI, ...args], { encoding: 'utf-8' })
}

function write(root, rel, content) {
  const full = path.join(root, ...rel.split('/'))
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content)
}

function snapshot(root) {
  const out = {}
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, relPath)
      else out[relPath] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
    }
  }
  walk(root, '')
  return out
}

/** Old-layout domain: export/, sources/original/, an old local stamp, an archive citation. */
function seedLegacyLayoutDomain(domainDir) {
  write(
    domainDir,
    'domaiNN_NN.md',
    '---\nknowledge_version: "V_0-1-0"\n---\n# NN index\n\n* [[domaiNN]]\n\n# NN domaiNN\n\n## NN domaiNN: Demo\nknowledge_dir:: kNNowledge/\n',
  )
  write(
    domainDir,
    'kNNowledge/Plan_NN.md',
    [
      '---',
      'knowledge_version: "V_0-1-0"',
      '---',
      '# Plan',
      '',
      'sources:: ["export/Summary_20261002-101500.md@## Totals", "sources/archive/metrics/V1/metrics.md@## Totals"]',
      '',
    ].join('\n'),
  )
  write(domainDir, 'export/Summary_20261002-101500.md', '# Summary\n\n## Totals\n')
  write(domainDir, 'export/dup.md', '# Same\n')
  write(domainDir, 'artifacts/dup.md', '# Same\n')
  write(domainDir, 'sources/original/notes.md', '# Notes\n')
  fs.mkdirSync(path.join(domainDir, 'sources', 'original'), { recursive: true })
  fs.writeFileSync(
    path.join(domainDir, 'sources', 'original', 'scan.pdf'),
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x01]),
  )
  write(domainDir, 'sources/archive/metrics/V1/metrics.md', '# Archived metrics\n\n## Totals\n')
  write(
    domainDir,
    'staging/migration/sources/import/scan.pdf.md',
    '# Preserved body\n\n## Extracted\n\nBody kept from the old mirror.\n',
  )
}

test('layout step: dry run changes nothing and prints a plan hash', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-dry-'))
  try {
    const domainDir = path.join(tmp, 'domain')
    seedLegacyLayoutDomain(domainDir)
    const before = snapshot(domainDir)

    const res = runCli(['--domain-dir', domainDir])
    assert.strictEqual(res.status, 0, res.stderr)
    assert.match(res.stdout, /Layout Migration Plan \(DRY RUN\)/)
    assert.match(res.stdout, /Plan Hash: [0-9a-f]{16}/)
    assert.match(res.stdout, /export\/dup\.md/)
    assert.deepStrictEqual(snapshot(domainDir), before, 'dry run must not touch the domain')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('layout step: apply requires the matching plan hash and consent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-consent-'))
  try {
    const domainDir = path.join(tmp, 'domain')
    seedLegacyLayoutDomain(domainDir)
    const before = snapshot(domainDir)
    const plan = JSON.parse(runCli(['--domain-dir', domainDir, '--json']).stdout)

    const noHash = runCli(['--domain-dir', domainDir, '--apply', '--yes'])
    assert.notStrictEqual(noHash.status, 0)
    const wrongHash = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', 'deadbeefdeadbeef', '--yes'])
    assert.notStrictEqual(wrongHash.status, 0)
    assert.match(wrongHash.stderr, /Plan hash mismatch/)
    const noConsent = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', plan.planHash])
    assert.notStrictEqual(noConsent.status, 0)
    assert.match(noConsent.stderr, /Consent required/)
    assert.deepStrictEqual(snapshot(domainDir), before, 'rejected applies must not touch the domain')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('layout step: apply migrates, backs up, writes preserved-body sidecars, and is idempotent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-apply-'))
  try {
    const domainDir = path.join(tmp, 'domain')
    seedLegacyLayoutDomain(domainDir)
    const archiveBefore = fs.readFileSync(path.join(domainDir, 'sources', 'archive', 'metrics', 'V1', 'metrics.md'))
    const pdfBytes = fs.readFileSync(path.join(domainDir, 'sources', 'original', 'scan.pdf'))

    const dry = runCli(['--domain-dir', domainDir, '--json'])
    const plan = JSON.parse(dry.stdout)
    assert.strictEqual(plan.status, 'ready')

    // The archive citation is a warning, never a blocker.
    const warned = plan.report.archiveCitations
    assert.deepStrictEqual(warned, [
      {
        file: 'kNNowledge/Plan_NN.md',
        citation: 'sources/archive/metrics/V1/metrics.md@## Totals',
        target: 'sources/archive/metrics/V1/metrics.md',
      },
    ])

    const res = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', plan.planHash, '--yes'])
    assert.strictEqual(res.status, 0, res.stderr + res.stdout)
    assert.match(res.stdout, /Backup created at:/)
    assert.match(res.stdout, /sources\/archive\/metrics\/V1\/metrics\.md@## Totals/)

    // Backup holds the pre-migration tree.
    const backups = fs.readdirSync(tmp).filter((name) => name.startsWith('domain-backup-'))
    assert.strictEqual(backups.length, 1)
    assert.ok(fs.existsSync(path.join(tmp, backups[0], 'export', 'dup.md')))

    // Moves, UTC-stamped rename, deleted duplicate, byte-identical binary move.
    const utc = new Date(2026, 9, 2, 10, 15, 0).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    assert.ok(fs.existsSync(path.join(domainDir, 'artifacts', `Summary_${utc}.md`)))
    assert.ok(!fs.existsSync(path.join(domainDir, 'export')))
    assert.ok(fs.existsSync(path.join(domainDir, 'artifacts', 'dup.md')))
    assert.ok(fs.existsSync(path.join(domainDir, 'sources', 'import', 'notes.md')))
    assert.ok(!fs.existsSync(path.join(domainDir, 'sources', 'original')))
    assert.ok(Buffer.compare(fs.readFileSync(path.join(domainDir, 'sources', 'import', 'scan.pdf')), pdfBytes) === 0)

    // Citations follow the move; the archive citation is untouched and the snapshot stays.
    const plan_md = fs.readFileSync(path.join(domainDir, 'kNNowledge', 'Plan_NN.md'), 'utf8')
    assert.ok(plan_md.includes(`artifacts/Summary_${utc}.md@## Totals`))
    assert.ok(plan_md.includes('sources/archive/metrics/V1/metrics.md@## Totals'))
    assert.ok(
      Buffer.compare(
        fs.readFileSync(path.join(domainDir, 'sources', 'archive', 'metrics', 'V1', 'metrics.md')),
        archiveBefore,
      ) === 0,
    )

    // Text policy.
    assert.ok(fs.readFileSync(path.join(domainDir, '.gitattributes'), 'utf8').split(/\r?\n/).includes('* -text'))

    // Sidecar for the binary subject carries the preserved body; staging is gone.
    const sidecar = fs.readFileSync(path.join(domainDir, 'sources', 'import', 'scan.pdf_sidecar_NN.md'), 'utf8')
    assert.ok(sidecar.includes('source_file: "sources/import/scan.pdf"') || sidecar.includes('source_file: sources/import/scan.pdf'))
    assert.ok(sidecar.includes('## Extracted'))
    assert.ok(sidecar.includes('Body kept from the old mirror.'))
    assert.ok(!fs.existsSync(path.join(domainDir, 'staging', 'migration')))

    // Idempotent: nothing left to propose.
    const again = runCli(['--domain-dir', domainDir, '--json'])
    assert.strictEqual(JSON.parse(again.stdout).status, 'noop')
    const text = runCli(['--domain-dir', domainDir])
    assert.strictEqual(text.status, 0)
    assert.match(text.stdout, /already up to date/i)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('layout step: retires the sources/nn mirror tree into co-located sidecars', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-mirrors-'))
  try {
    const domainDir = path.join(tmp, 'domain')
    write(domainDir, 'domaiNN_NN.md', '---\nknowledge_version: "V_0-1-0"\n---\n# NN index\n\n* [[domaiNN]]\n')
    write(
      domainDir,
      'kNNowledge/Plan_NN.md',
      'sources:: [sources/nn/scan.md@## Extracted, sources/nn/costs.csv@A, sources/nn/index.md]\n',
    )
    fs.mkdirSync(path.join(domainDir, 'sources', 'original'), { recursive: true })
    fs.writeFileSync(
      path.join(domainDir, 'sources', 'original', 'scan.pdf'),
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe]),
    )
    write(
      domainDir,
      'sources/nn/scan.md',
      '---\nsource_file: "sources/original/scan.pdf"\nsha256: "abc"\n---\n\n# Scan\n\n## Extracted\n\nBody of the old mirror.\n',
    )
    write(domainDir, 'sources/nn/costs.csv', 'sku,cost\nA,1\n')
    write(domainDir, 'sources/nn/index.md', '# Ingestion manifest\n')
    write(domainDir, 'sources/export/brief.md', '# Brief\n')

    const plan = JSON.parse(runCli(['--domain-dir', domainDir, '--json']).stdout)
    assert.strictEqual(plan.status, 'ready')
    assert.deepStrictEqual(plan.report.preservedBodies.sort(), [
      'sources/import/costs.csv',
      'sources/import/scan.pdf',
    ])

    const res = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', plan.planHash, '--yes'])
    assert.strictEqual(res.status, 0, res.stderr + res.stdout)

    for (const gone of ['sources/nn', 'sources/export', 'sources/original', 'staging']) {
      assert.ok(!fs.existsSync(path.join(domainDir, ...gone.split('/'))), `${gone} must be gone`)
    }
    assert.ok(fs.existsSync(path.join(domainDir, 'artifacts', 'brief.md')))
    const pdfSidecar = fs.readFileSync(path.join(domainDir, 'sources', 'import', 'scan.pdf_sidecar_NN.md'), 'utf8')
    assert.ok(pdfSidecar.includes('Body of the old mirror.'))
    assert.ok(!pdfSidecar.includes('sha256: "abc"'), 'the old mirror frontmatter is not carried over')
    const csvSidecar = fs.readFileSync(path.join(domainDir, 'sources', 'import', 'costs.csv_sidecar_NN.md'), 'utf8')
    assert.ok(csvSidecar.includes('source_file'))
    const plan_md = fs.readFileSync(path.join(domainDir, 'kNNowledge', 'Plan_NN.md'), 'utf8')
    assert.ok(plan_md.includes('sources/import/scan.pdf_sidecar_NN.md@## Extracted'))
    assert.ok(plan_md.includes('sources/import/costs.csv@A'))

    assert.strictEqual(JSON.parse(runCli(['--domain-dir', domainDir, '--json']).stdout).status, 'noop')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('layout step: a frozen sample workspace is skipped and left unchanged', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-frozen-'))
  try {
    const domainDir = path.join(tmp, 'docs', 'innfo', 'samples', 'lifecycle-demo', 'workspace')
    seedLegacyLayoutDomain(domainDir)
    const before = snapshot(domainDir)

    const res = runCli(['--domain-dir', domainDir, '--apply', '--plan-hash', 'anything', '--yes'])
    assert.strictEqual(res.status, 0, res.stderr)
    assert.match(res.stdout, /frozen/i)
    assert.deepStrictEqual(snapshot(domainDir), before)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})

test('layout step: --layout-only skips the nn-rename step and plans just the layout', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-layout-only-'))
  try {
    const domainDir = path.join(tmp, 'domain')
    seedLegacyLayoutDomain(domainDir)
    // Legacy concept names make the nn-rename step non-empty.
    write(
      domainDir,
      'domaiNN_NN.md',
      '---\nknowledge_version: "V_0-1-0"\n---\n# NN index\n\n* [[Workspace]]\n\n# NN Workspace\n\n## NN Workspace: Demo\nknowledge_dir:: kNNowledge/\n',
    )

    const renameFirst = JSON.parse(runCli(['--domain-dir', domainDir, '--json']).stdout)
    assert.strictEqual(renameFirst.step, undefined)
    assert.ok(renameFirst.report.rewrittenFiles.includes('domaiNN_NN.md'))

    const layoutOnly = JSON.parse(runCli(['--domain-dir', domainDir, '--layout-only', '--json']).stdout)
    assert.strictEqual(layoutOnly.step, 'layout')
    assert.ok(layoutOnly.report.moved.some((m) => m.from === 'export/dup.md' || m.from === 'export/Summary_20261002-101500.md'))

    const res = runCli(['--domain-dir', domainDir, '--layout-only', '--apply', '--plan-hash', layoutOnly.planHash, '--yes'])
    assert.strictEqual(res.status, 0, res.stderr + res.stdout)
    assert.ok(fs.existsSync(path.join(domainDir, 'artifacts', 'dup.md')))
    assert.ok(
      fs.readFileSync(path.join(domainDir, 'domaiNN_NN.md'), 'utf8').includes('[[Workspace]]'),
      'the nn-rename step must not have run',
    )
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
})
