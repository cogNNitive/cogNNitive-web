#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/batch-update.test.js
 *
 * batch-update.js suite.
 *
 * Work Unit 1 (slice 1): READ-ONLY scanner + planner + selector. Covers tasks
 * 1.2/1.3 (exports), 2.1/2.2 (discovery + classification), 3.1/3.2 (persisted
 * plan shape), 3.3/3.4 (hash parity + --plan override) and 4.1/4.2 (selection
 * precedence, empty no-op).
 *
 * Work Unit 2 (slice 2): apply loop + aggregate journal + rollback. Covers tasks
 * 5.1 (consent), 5.3 (drift guard + missing planHash), 5.5 (per-domain atomicity,
 * continue-on-failure), 6.1 (aggregate journal shape/order/committed, incremental
 * write-ahead) and 6.3 (real apply + reverse-order rollback, --yes required).
 *
 * Work Unit 3 (slice 3): idempotency, soft lock, exit codes + scope guard, and
 * Flow C docs. Covers tasks 7.1/7.2 (re-run skips applied/noop, no backup-of-backup),
 * 7.3/7.4 (.nn-batch.lock wx, EEXIST refuses, --force bypasses, read-only warn),
 * 7.5/7.6 (exit 0/1/2, no legacy-deletion path) and 8.1 (SKILL.md Flow C).
 *
 * Style mirrors migrate-domain.test.js: node assert + spawnSync, fixtures under
 * repo-root temp/ (gitignored), removed in finally. Apply/rollback are exercised
 * through the injectable `spawn` seam (real spawnSync for the integration test).
 */

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const SCRIPT_DIR = __dirname
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../../')
const TEMP_ROOT = path.join(REPO_ROOT, 'temp')
const BATCH_CLI = path.join(SCRIPT_DIR, 'batch-update.js')
const MIGRATE_CLI = path.join(SCRIPT_DIR, 'migrate-domain.js')

const { runBatch, main } = require('./batch-update.js')

function runBatchCli(args) {
  return spawnSync(process.execPath, [BATCH_CLI, ...args], { encoding: 'utf-8' })
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

/** Recursive file-path -> sha256 map, used to prove scan writes nothing. */
function snapshotTree(dir) {
  const out = {}
  function walk(current, rel) {
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full, relPath)
      } else {
        out[relPath] = sha256File(full)
      }
    }
  }
  walk(dir, '')
  return out
}

function capturingOut() {
  const lines = []
  return {
    lines,
    log: (s) => lines.push(String(s)),
    error: (s) => lines.push(String(s)),
  }
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
}

function makeReadyDomain(parent, name) {
  const dir = path.join(parent, name)
  fs.mkdirSync(dir, { recursive: true })
  populateLegacyDomain(dir)
  return dir
}

function fixedNow() {
  return new Date('2026-10-01T12:00:00.000Z')
}

function findDomain(res, name) {
  return res.parents[0].plan.domains.find((d) => d.name === name)
}

/** All aggregate journal files currently present in a parent dir. */
function listJournals(parent) {
  return fs
    .readdirSync(parent)
    .filter((n) => /^batch-journal-.*\.json$/.test(n))
    .map((n) => path.join(parent, n))
}

/** A successful migrate-domain.js apply result carrying a backup line. */
function applyOk(backupDir) {
  return {
    status: 0,
    stdout: `Backup created at: ${backupDir}\n✔ Migration applied successfully! (6 ops)\n`,
    stderr: '',
  }
}

async function runTests() {
  fs.mkdirSync(TEMP_ROOT, { recursive: true })
  const tmpRoot = fs.mkdtempSync(path.join(TEMP_ROOT, 'batch-update-'))
  console.log('Running batch-update.js unit tests...')

  try {
    // 1. Exports smoke (tasks 1.2 / 1.3)
    {
      assert.strictEqual(typeof runBatch, 'function', 'runBatch is exported')
      assert.strictEqual(typeof main, 'function', 'main is exported')
      console.log('✔ runBatch + main exports present')
    }

    // 2. Discovery exclusions + classification + zero domain writes (tasks 2.1 / 2.2)
    {
      const parent = fs.mkdtempSync(path.join(TEMP_ROOT, 'discover-'))
      const acme = makeReadyDomain(parent, 'acme')
      // Decoys that MUST be excluded by discovery (name rules).
      makeReadyDomain(parent, 'acme-backup-20261001-120000')
      fs.mkdirSync(path.join(parent, '_archive'), { recursive: true })
      fs.mkdirSync(path.join(parent, '_templates'), { recursive: true })
      fs.mkdirSync(path.join(parent, '.hidden'), { recursive: true })
      // A plain directory that is discovered but is not a domain.
      fs.mkdirSync(path.join(parent, 'notes'), { recursive: true })

      const before = snapshotTree(acme)
      const out = capturingOut()
      const res = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out,
      })

      assert.strictEqual(res.exitCode, 0, 'scan exits 0 when nothing is blocked')
      const names = res.parents[0].plan.domains.map((d) => d.name)
      assert.ok(!names.includes('acme-backup-20261001-120000'), 'backup sibling excluded')
      assert.ok(!names.includes('_archive'), '_archive excluded')
      assert.ok(!names.includes('_templates'), '_templates excluded')
      assert.ok(!names.includes('.hidden'), 'dot-directory excluded')

      const notes = findDomain(res, 'notes')
      assert.ok(notes, 'plain dir is discovered')
      assert.strictEqual(notes.status, 'skipped', 'non-domain is skipped')
      assert.strictEqual(notes.reason, 'not-a-domain', 'non-domain reason recorded')

      const acmeEntry = findDomain(res, 'acme')
      assert.strictEqual(acmeEntry.status, 'ready', 'legacy domaiNN is ready')
      assert.ok(acmeEntry.opsCount > 0, 'ready domain has ops')
      assert.strictEqual(acmeEntry.path, acme, 'plan records absolute domain path')

      assert.deepStrictEqual(snapshotTree(acme), before, 'scan wrote zero domain files')
      console.log('✔ discovery excludes backups/archives/dot-dirs and scan writes nothing')
    }

    // 3. Persisted plan shape + plan/journal names never candidates (tasks 3.1 / 3.2)
    {
      const parent = fs.mkdtempSync(path.join(TEMP_ROOT, 'plan-'))
      makeReadyDomain(parent, 'acme')
      makeReadyDomain(parent, 'beta')
      // Defensive: file names that must never be discovered (they are files anyway).
      fs.writeFileSync(path.join(parent, 'batch-journal-2026.json'), '{}', 'utf-8')

      const res = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })

      const plan = res.parents[0].plan
      assert.strictEqual(plan.version, 1, 'plan version')
      assert.strictEqual(plan.generatedAt, '2026-10-01T12:00:00.000Z', 'plan generatedAt from injected now')
      assert.strictEqual(plan.parentDir, parent, 'plan parentDir')
      assert.ok(Array.isArray(plan.domains), 'plan domains array')

      for (const d of plan.domains) {
        assert.deepStrictEqual(
          Object.keys(d).sort(),
          ['name', 'opsCount', 'path', 'planHash', 'reason', 'status'].sort(),
          `domain keys for ${d.name}`,
        )
      }

      const names = plan.domains.map((d) => d.name)
      assert.ok(!names.includes('batch-plan.json'), 'plan file never a candidate')
      assert.ok(!names.includes('batch-journal-2026.json'), 'journal file never a candidate')

      const planFile = path.join(parent, 'batch-plan.json')
      assert.ok(fs.existsSync(planFile), 'batch-plan.json written')
      const onDisk = JSON.parse(fs.readFileSync(planFile, 'utf-8'))
      assert.deepStrictEqual(onDisk, plan, 'on-disk plan matches returned plan')

      // --plan override (task 3.4)
      const alt = path.join(parent, 'custom-plan.json')
      const resAlt = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        planPath: alt,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.ok(fs.existsSync(alt), '--plan override path written')
      assert.strictEqual(resAlt.parents[0].planPath, alt, 'result records override planPath')

      console.log('✔ plan shape/persistence correct and plan/journal names are never candidates')
    }

    // 4. Hash parity vs migrate-domain.js --json (task 3.3)
    {
      const parent = fs.mkdtempSync(path.join(TEMP_ROOT, 'parity-'))
      const acme = makeReadyDomain(parent, 'acme')

      const res = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      const batchHash = findDomain(res, 'acme').planHash

      const mig = spawnSync(process.execPath, [MIGRATE_CLI, '--domain-dir', acme, '--json'], {
        encoding: 'utf-8',
      })
      assert.strictEqual(mig.status, 0, mig.stderr)
      const migrateHash = JSON.parse(mig.stdout).planHash
      assert.strictEqual(batchHash, migrateHash, 'batch planHash matches migrate-domain --json planHash')
      console.log('✔ batch planHash is identical to migrate-domain.js --json planHash')
    }

    // 5. Selection precedence + empty selection no-op (tasks 4.1 / 4.2)
    {
      const parent = fs.mkdtempSync(path.join(TEMP_ROOT, 'select-'))
      makeReadyDomain(parent, 'acme')
      makeReadyDomain(parent, 'beta')

      const onlyRes = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: ['acme'], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.deepStrictEqual(onlyRes.parents[0].selected, ['acme'], '--only A selects only A')

      const excludeAll = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: ['acme', 'beta'] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.deepStrictEqual(excludeAll.parents[0].selected, [], 'exclude-all selects nothing')
      assert.strictEqual(excludeAll.exitCode, 0, 'empty selection exits 0 (no-op)')

      // Unknown --only name warns but is not fatal.
      const unknown = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: ['ghost'], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.deepStrictEqual(unknown.parents[0].selected, [], 'unknown only-name selects nothing')
      assert.strictEqual(unknown.exitCode, 0, 'unknown only-name is not fatal')

      // CLI wiring: --only/--exclude parse and exit 0 on empty selection.
      const cli = runBatchCli(['--dir', parent, '--scan', '--only', 'acme', '--exclude', 'acme'])
      assert.strictEqual(cli.status, 0, cli.stderr)
      console.log('✔ selection precedence and empty selection no-op')
    }

    // 6. Work Unit 2 acceptance: apply/rollback now implemented but consent-gated;
    //    unknown flags still exit 2.
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'cli-'))
      makeReadyDomain(parent, 'acme')

      const applyNoYes = runBatchCli(['--dir', parent, '--apply'])
      assert.strictEqual(applyNoYes.status, 1, '--apply without --yes exits 1')
      assert.ok(
        /--yes/.test(applyNoYes.stdout + applyNoYes.stderr),
        '--apply refusal mentions the --yes consent token',
      )
      assert.ok(
        !fs.existsSync(path.join(parent, 'batch-plan.json')),
        '--apply without --yes writes nothing (no plan)',
      )

      const rollbackNoYes = runBatchCli([
        '--dir',
        parent,
        '--rollback',
        path.join(parent, 'missing-journal.json'),
      ])
      assert.strictEqual(rollbackNoYes.status, 1, '--rollback without --yes exits 1')

      const badFlagRes = runBatchCli(['--dir', parent, '--nope'])
      assert.strictEqual(badFlagRes.status, 2, 'unknown flag exits 2')

      console.log('✔ apply/rollback require --yes (exit 1); unknown flags exit 2')
    }

    // 7. Consent: --apply without --yes exits 1 with zero writes (task 5.1)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'consent-'))
      const acme = makeReadyDomain(parent, 'acme')
      const before = snapshotTree(acme)
      let calls = 0
      const fake = () => {
        calls += 1
        return applyOk(path.join(parent, 'never-backup'))
      }

      const res = await runBatch({
        parents: [parent],
        command: 'apply',
        selection: { only: [], exclude: [] },
        consent: false,
        spawn: fake,
        now: fixedNow,
        out: capturingOut(),
      })

      assert.strictEqual(res.exitCode, 1, 'apply without consent exits 1')
      assert.strictEqual(calls, 0, 'no spawn without consent')
      assert.deepStrictEqual(snapshotTree(acme), before, 'zero domain writes without consent')
      assert.ok(
        !fs.existsSync(path.join(parent, 'batch-plan.json')),
        'no plan written without consent',
      )
      assert.deepStrictEqual(listJournals(parent), [], 'no journal written without consent')
      console.log('✔ --apply without --yes refuses (exit 1) with zero writes')
    }

    // 8. Drift guard + missing planHash refusal (task 5.3)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'drift-'))
      const acme = makeReadyDomain(parent, 'acme')
      const scan = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.ok(findDomain(scan, 'acme').planHash, 'scanned plan records planHash')

      // Mutate the tree after scan → recomputed hash differs → drift, no spawn.
      fs.writeFileSync(
        path.join(acme, 'models', 'extra_NN.md'),
        '---\nmodel_version: "0.1.0"\nblueprint_name: "custom_app"\n---\n# Extra App Heading\n\n- Field:: x\n',
        'utf-8',
      )
      const before = snapshotTree(acme)
      let driftCalls = 0
      const driftFake = () => {
        driftCalls += 1
        return applyOk(path.join(parent, 'never-backup'))
      }
      const drift = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        spawn: driftFake,
        now: fixedNow,
        out: capturingOut(),
      })

      assert.strictEqual(drift.exitCode, 1, 'drift exits 1')
      assert.strictEqual(driftCalls, 0, 'drift never spawns migrate-domain.js')
      const dentry = drift.parents[0].results.find((d) => d.name === 'acme')
      assert.strictEqual(dentry.status, 'drift', 'mutated domain classified as drift')
      assert.match(String(dentry.error), /mismatch/i, 'drift error mentions hash mismatch')
      assert.deepStrictEqual(snapshotTree(acme), before, 'drift leaves no partial write')

      // Hand-edited plan with an absent planHash → refused, never applied.
      const frozen = {
        version: 1,
        generatedAt: '2026-10-01T12:00:00.000Z',
        parentDir: parent,
        domains: [
          { name: 'acme', path: acme, status: 'ready', opsCount: 6, planHash: null, reason: null },
        ],
      }
      const frozenPath = path.join(parent, 'frozen-plan.json')
      fs.writeFileSync(frozenPath, JSON.stringify(frozen, null, 2), 'utf-8')
      let missingCalls = 0
      const missingFake = () => {
        missingCalls += 1
        return applyOk(path.join(parent, 'never-backup'))
      }
      const missing = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        planPath: frozenPath,
        spawn: missingFake,
        now: fixedNow,
        out: capturingOut(),
      })

      assert.strictEqual(missing.exitCode, 1, 'missing planHash exits 1')
      assert.strictEqual(missingCalls, 0, 'missing planHash never spawns apply')
      const mres = missing.parents[0].results[0]
      assert.strictEqual(mres.status, 'drift', 'missing planHash refused')
      assert.strictEqual(mres.error, 'missing-plan-hash', 'missing planHash reason recorded')
      console.log('✔ drift aborts without spawn; missing planHash is refused')
    }

    // 9. Per-domain atomicity: A applied then B fails; B never rolls back A (task 5.5)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'atomic-'))
      const aDir = makeReadyDomain(parent, 'a-domain')
      const bDir = makeReadyDomain(parent, 'b-domain')
      await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })

      const backupA = path.join(parent, 'a-domain-backup-2026-10-01_120000')
      const calls = []
      const fake = (cmd, args) => {
        calls.push(args.slice())
        const dd = args[args.indexOf('--domain-dir') + 1]
        if (dd === aDir) return applyOk(backupA)
        if (dd === bDir) return { status: 1, stdout: '', stderr: '❌ Migration failed: boom' }
        return { status: 0, stdout: '', stderr: '' }
      }

      const res = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        spawn: fake,
        now: fixedNow,
        out: capturingOut(),
      })

      assert.strictEqual(res.exitCode, 1, 'batch exits 1 when one domain fails')
      const ra = res.parents[0].results.find((d) => d.name === 'a-domain')
      const rb = res.parents[0].results.find((d) => d.name === 'b-domain')
      assert.strictEqual(ra.status, 'applied', 'A stays applied')
      assert.strictEqual(ra.backupDir, backupA, 'A records its own backup')
      assert.strictEqual(rb.status, 'failed', 'B is recorded failed')
      assert.strictEqual(rb.backupDir, null, 'B has no backup')
      assert.ok(
        !calls.some((a) => a.includes('--restore')),
        'no rollback is spawned when a sibling fails',
      )

      const journal = JSON.parse(fs.readFileSync(res.parents[0].journalPath, 'utf-8'))
      assert.strictEqual(
        journal.domains.find((d) => d.name === 'a-domain').status,
        'applied',
        'aggregate journal keeps A applied despite B failure',
      )
      console.log('✔ B failure leaves A applied with its own backup (no fused rollback)')
    }

    // 10. Aggregate journal shape/order/committed + incremental write-ahead (task 6.1)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'journal-'))
      makeReadyDomain(parent, 'a-domain')
      makeReadyDomain(parent, 'b-domain')
      await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })

      const snapshots = []
      const fake = (cmd, args) => {
        const dd = args[args.indexOf('--domain-dir') + 1]
        const jf = listJournals(parent)[0]
        if (jf) {
          snapshots.push({
            domain: path.basename(dd),
            journal: JSON.parse(fs.readFileSync(jf, 'utf-8')),
          })
        }
        const backup = path.join(parent, `${path.basename(dd)}-backup-2026-10-01_120000`)
        return applyOk(backup)
      }

      const res = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        spawn: fake,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(res.exitCode, 0, 'applying two ready domains exits 0')

      const journalPath = res.parents[0].journalPath
      assert.ok(
        /batch-journal-2026-10-01_120000\.json$/.test(journalPath),
        'journal filename uses the batch stamp',
      )
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
      assert.strictEqual(journal.version, 1, 'journal version')
      assert.strictEqual(journal.batchId, '2026-10-01_120000', 'journal batchId stamp')
      assert.strictEqual(journal.parentDir, parent, 'journal parentDir')
      assert.strictEqual(journal.startedAt, '2026-10-01T12:00:00.000Z', 'journal startedAt')
      assert.strictEqual(journal.finishedAt, '2026-10-01T12:00:00.000Z', 'journal finishedAt')
      assert.strictEqual(journal.committed, true, 'journal committed after the loop')
      assert.deepStrictEqual(
        journal.domains.map((d) => d.name),
        ['a-domain', 'b-domain'],
        'ascending (sorted) apply order',
      )
      assert.deepStrictEqual(
        journal.domains.map((d) => d.order),
        [0, 1],
        'order indices recorded',
      )
      for (const d of journal.domains) {
        for (const k of ['order', 'backupDir', 'journalPath']) {
          assert.ok(k in d, `journal domain records ${k}`)
        }
        assert.strictEqual(d.status, 'applied', 'journal domain applied')
        assert.ok(d.journalPath.endsWith('journal.json'), 'journalPath points at journal.json')
      }

      const duringB = snapshots.find((s) => s.domain === 'b-domain')
      assert.ok(duringB, 'journal is observable mid-loop')
      assert.strictEqual(duringB.journal.committed, false, 'mid-loop journal is uncommitted')
      assert.deepStrictEqual(
        duringB.journal.domains.map((d) => d.name),
        ['a-domain'],
        'journal is written incrementally after each domain',
      )
      console.log('✔ aggregate journal references per-domain backups in order with committed flag')
    }

    // 11. Integration: real migrate-domain apply + reverse-order rollback (task 6.3)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'rollback-'))
      const aDir = makeReadyDomain(parent, 'a-domain')
      const bDir = makeReadyDomain(parent, 'b-domain')
      const beforeA = snapshotTree(aDir)
      const beforeB = snapshotTree(bDir)
      await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })

      const applyCalls = []
      const applySpy = (cmd, args, options) => {
        applyCalls.push(args.slice())
        return spawnSync(cmd, args, options)
      }
      const applied = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        spawn: applySpy,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(applied.exitCode, 0, 'real apply of two ready domains exits 0')
      const results = applied.parents[0].results
      assert.deepStrictEqual(
        results.map((d) => d.status),
        ['applied', 'applied'],
        'both domains applied by the real migrate-domain.js',
      )
      for (const d of results) {
        assert.ok(d.backupDir && fs.existsSync(d.backupDir), 'per-domain backup exists on disk')
      }
      const journalPath = applied.parents[0].journalPath

      // Rollback requires --yes and must not touch the tree when refused.
      const noYes = await runBatch({
        parents: [parent],
        command: 'rollback',
        journalPath,
        consent: false,
        out: capturingOut(),
      })
      assert.strictEqual(noYes.exitCode, 1, 'rollback without --yes exits 1')

      const restoreCalls = []
      const restoreSpy = (cmd, args, options) => {
        restoreCalls.push(args.slice())
        return spawnSync(cmd, args, options)
      }
      const rolled = await runBatch({
        parents: [parent],
        command: 'rollback',
        journalPath,
        consent: true,
        spawn: restoreSpy,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(rolled.exitCode, 0, 'rollback exits 0')
      const restoreOrder = restoreCalls.map((a) =>
        path.basename(a[a.indexOf('--domain-dir') + 1]),
      )
      assert.deepStrictEqual(
        restoreOrder,
        ['b-domain', 'a-domain'],
        'rollback restores B before A (reverse order)',
      )
      assert.deepStrictEqual(snapshotTree(aDir), beforeA, 'A restored to its pre-apply tree')
      assert.deepStrictEqual(snapshotTree(bDir), beforeB, 'B restored to its pre-apply tree')
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
      assert.ok(
        journal.domains.every((d) => d.restored === true),
        'journal marks restored flags',
      )
      console.log('✔ real apply + reverse-order rollback (B→A); --yes required')
    }

    // 12. Idempotency: re-run over applied domains skips, no backup-of-backup; all-noop exits 0
    //     (tasks 7.1 / 7.2 / 7.5)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'idem-'))
      makeReadyDomain(parent, 'acme')
      const scan = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(findDomain(scan, 'acme').status, 'ready', 'fixture starts ready')
      // Freeze the pre-apply plan so the second apply still lists the domain as `ready`.
      const frozen = path.join(parent, 'frozen-plan.json')
      fs.copyFileSync(scan.parents[0].planPath, frozen)

      const applied = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(applied.exitCode, 0, 'real apply of a ready domain exits 0')
      assert.strictEqual(applied.parents[0].results[0].status, 'applied', 'domain applied')
      const backupsAfterApply = fs.readdirSync(parent).filter((n) => n.includes('-backup-'))
      assert.strictEqual(backupsAfterApply.length, 1, 'exactly one backup after the first apply')

      // Re-scan: the migrated domain is `noop`, exit 0, and the backup sibling is never a candidate.
      const rescan = await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(rescan.exitCode, 0, 'all-noop scan exits 0')
      assert.strictEqual(findDomain(rescan, 'acme').status, 'noop', 'migrated domain re-scans noop')
      assert.ok(
        rescan.parents[0].plan.domains.every((d) => !d.name.includes('-backup-')),
        'backup dirs are never recursed into as candidates',
      )
      assert.deepStrictEqual(rescan.parents[0].selected, [], 'a noop domain is not selectable')

      // Re-apply from the frozen (stale, still-`ready`) plan: already current ⇒ skipped, no new backup.
      const reapply = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        planPath: frozen,
        now: () => new Date('2026-10-01T13:00:00.000Z'),
        out: capturingOut(),
      })
      assert.strictEqual(reapply.exitCode, 0, 're-apply of an applied domain exits 0')
      assert.strictEqual(
        reapply.parents[0].results[0].status,
        'skipped',
        'already-applied domain is skipped, not drifted',
      )
      const backupsAfterReapply = fs.readdirSync(parent).filter((n) => n.includes('-backup-'))
      assert.strictEqual(
        backupsAfterReapply.length,
        backupsAfterApply.length,
        're-apply creates no new backup (no backup-of-backup chain)',
      )
      console.log('✔ re-run over applied domains skips; no backup-of-backup; all-noop exits 0')
    }

    // 13. Soft lock: per-parent .nn-batch.lock — EEXIST refuses, --force bypasses, read-only warns
    //     (tasks 7.3 / 7.4)
    {
      const parent = fs.mkdtempSync(path.join(tmpRoot, 'lock-'))
      const acme = makeReadyDomain(parent, 'acme')
      await runBatch({
        parents: [parent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      const lockPath = path.join(parent, '.nn-batch.lock')
      fs.writeFileSync(
        lockPath,
        JSON.stringify({ pid: 999999, startedAt: '2026-10-01T11:00:00.000Z' }),
        'utf-8',
      )
      const before = snapshotTree(acme)

      let calls = 0
      const fake = () => {
        calls += 1
        return applyOk(path.join(parent, 'never-backup'))
      }
      const refused = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        spawn: fake,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(refused.exitCode, 1, 'a held lock refuses apply (exit 1)')
      assert.strictEqual(calls, 0, 'lock refusal spawns nothing')
      assert.deepStrictEqual(snapshotTree(acme), before, 'lock refusal writes no domain files')
      assert.deepStrictEqual(listJournals(parent), [], 'lock refusal writes no aggregate journal')
      assert.ok(fs.existsSync(lockPath), 'a refused run does not remove the foreign lock')

      // Same refusal through the real CLI (--force plumbing of main()).
      const cliRefused = runBatchCli(['--dir', parent, '--apply', '--yes'])
      assert.strictEqual(cliRefused.status, 1, 'held lock refuses apply through the CLI too')

      const forced = await runBatch({
        parents: [parent],
        command: 'apply',
        consent: true,
        force: true,
        spawn: fake,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(forced.exitCode, 0, '--force bypasses the held lock')
      assert.strictEqual(calls, 1, '--force proceeds to apply')
      assert.ok(!fs.existsSync(lockPath), '--force clears the stale lock')

      // EPERM/EACCES (read-only/cloud parent): warn and proceed without a lock.
      const roParent = fs.mkdtempSync(path.join(tmpRoot, 'lock-ro-'))
      makeReadyDomain(roParent, 'acme')
      await runBatch({
        parents: [roParent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      const roOut = capturingOut()
      let roCalls = 0
      const roFake = () => {
        roCalls += 1
        return applyOk(path.join(roParent, 'never-backup'))
      }
      const ro = await runBatch({
        parents: [roParent],
        command: 'apply',
        consent: true,
        spawn: roFake,
        now: fixedNow,
        out: roOut,
        openLock: () => {
          const err = new Error('EPERM')
          err.code = 'EPERM'
          throw err
        },
      })
      assert.strictEqual(ro.exitCode, 0, 'EPERM lock warns and proceeds')
      assert.strictEqual(roCalls, 1, 'EPERM proceeds to apply')
      assert.ok(roOut.lines.some((l) => /warning/i.test(l)), 'EPERM emits a warning')
      console.log('✔ soft lock: EEXIST refuses, --force bypasses, EPERM warns + proceeds')
    }

    // 14. Exit codes + scope guard — no legacy/quarantine deletion path (tasks 7.5 / 7.6)
    {
      // Zero candidates: a parent with only a non-domain dir → scan/apply exit 0.
      const emptyParent = fs.mkdtempSync(path.join(tmpRoot, 'empty-'))
      fs.mkdirSync(path.join(emptyParent, 'notes'), { recursive: true })
      const emptyScan = await runBatch({
        parents: [emptyParent],
        command: 'scan',
        selection: { only: [], exclude: [] },
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(emptyScan.exitCode, 0, 'zero candidates scans exit 0')
      assert.deepStrictEqual(emptyScan.parents[0].selected, [], 'zero candidates selects nothing')
      const emptyApply = await runBatch({
        parents: [emptyParent],
        command: 'apply',
        consent: true,
        now: fixedNow,
        out: capturingOut(),
      })
      assert.strictEqual(emptyApply.exitCode, 0, 'zero candidates apply exits 0')

      // Invalid / incomplete flags exit 2 (CLI).
      assert.strictEqual(
        runBatchCli(['--dir', emptyParent, '--nope']).status,
        2,
        'invalid flag exits 2',
      )
      assert.strictEqual(
        runBatchCli(['--dir', emptyParent, '--only']).status,
        2,
        'missing --only value exits 2',
      )

      // Any failed domain exits 1.
      const failParent = fs.mkdtempSync(path.join(tmpRoot, 'exitfail-'))
      makeReadyDomain(failParent, 'acme')
      const fail = await runBatch({
        parents: [failParent],
        command: 'apply',
        consent: true,
        now: fixedNow,
        out: capturingOut(),
        spawn: () => ({ status: 1, stdout: '', stderr: '❌ Migration failed: boom' }),
      })
      assert.strictEqual(fail.exitCode, 1, 'a failed domain exits 1')

      // Scope guard: no code path deletes legacy/quarantine files. The only unlink
      // in the module is the advisory lock release, and it only ever targets a lock.
      const src = fs.readFileSync(BATCH_CLI, 'utf-8')
      assert.ok(
        !/\brmSync\b|\brmdirSync\b|\brmdir\b|\bfs\.rm\b/.test(src),
        'no recursive/directory deletion APIs in the batch tool',
      )
      const unlinks = src.match(/unlinkSync/g) || []
      assert.strictEqual(unlinks.length, 1, 'exactly one unlink exists — the lock release')
      assert.ok(/function safeUnlink[\s\S]*fs\.unlinkSync/.test(src), 'unlink is confined to safeUnlink')
      const safeUnlinkArgs = [...src.matchAll(/safeUnlink\(([^)]*)\)/g)]
        .map((m) => m[1].trim())
        .filter((arg) => arg !== 'file' && !arg.startsWith('lock'))
      assert.deepStrictEqual(
        safeUnlinkArgs,
        [],
        'safeUnlink only ever targets a lock path',
      )
      console.log('✔ exit codes (0/1/2) and no legacy-deletion code path')
    }

    // 15. SKILL.md Flow C docs (tasks 8.1 / 8.2)
    {
      const skillPath = path.join(REPO_ROOT, 'skills', 'nn-upgrade', 'SKILL.md')
      const doc = fs.readFileSync(skillPath, 'utf-8')
      assert.ok(/Supports three distinct flows/i.test(doc), 'SKILL.md announces three flows')
      assert.ok(/## Flow C: Batch Domain Update/.test(doc), 'Flow C section present')
      for (const phase of ['C0', 'C1', 'C2', 'C3']) {
        assert.ok(new RegExp(`${phase}\\s*[—-]`).test(doc), `Flow C documents phase ${phase}`)
      }
      assert.ok(/batch-update\.js/.test(doc), 'Flow C references batch-update.js')
      assert.ok(/migrate-domain\.js/.test(doc), 'Flow C notes reuse of migrate-domain.js')
      assert.ok(
        /v1[^\n]*Flow A/i.test(doc) || /Flow A[^\n]*v1/i.test(doc),
        'Flow C notes v1 = Flow A only',
      )
      assert.ok(
        /never delete|does not delete|no legacy\/quarantine|without deleting legacy/i.test(doc),
        'Flow C notes it never deletes legacy code',
      )
      console.log('✔ SKILL.md documents Flow C (C0–C3) with reuse + no-deletion notes')
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }

  console.log('All batch-update unit tests passed successfully!\n')
}

runTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
