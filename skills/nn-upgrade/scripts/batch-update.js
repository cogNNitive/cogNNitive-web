#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/batch-update.js
 *
 * nn-upgrade Flow C orchestrator. READ-ONLY scanner + planner + selector, plus
 * the Work Unit 2 apply loop, aggregate journal, and reverse-order rollback over
 * sibling domaiNN workspaces.
 *
 * Reuses `migrate-domain.js` (`createFsDomainReader`) and the generated
 * migration planner (`planMigration`) so a batch never reimplements migration
 * logic and its `planHash` matches `migrate-domain.js --json` exactly. Mutation
 * is delegated by SPAWNING `migrate-domain.js --apply --plan-hash <hash> --yes`
 * per domain: the batch is an aggregator, never a fused transaction. Each domain
 * keeps its own backup + `journal.json`; an aggregate
 * `<parent>/batch-journal-<stamp>.json` references them (write-ahead,
 * `committed:false`, then `committed:true`) for reverse-order restore.
 *
 * Delivered: `--dir`, `--scan` (default), `--json`, `--only`, `--exclude`,
 * `--plan`, `--apply --yes`, `--rollback <journal> --yes` (alias `--restore`).
 * The advisory batch lock is Work Unit 3.
 */

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { createFsDomainReader } = require('./migrate-domain.js')
const { planMigration } = require('./lib/legacy-migrate.generated.cjs')

// Same tiny dependency stub as migrate-domain.js so planHash parity holds.
const DEPS = {
  targets: {
    domaiNN: { version: '0.1.0', spec: '# domaiNN Spec\n' },
  },
  validate() {
    return []
  },
}

const USAGE =
  'Usage: node batch-update.js [--dir <parent> ...] [--scan] [--only a,b] [--exclude x,y] [--plan <file>] [--json] [--apply --yes] [--rollback <journal> --yes]'

const PLAN_FILE = 'batch-plan.json'
const LOCK_FILE = '.nn-batch.lock'
const MIGRATE_CLI = path.join(__dirname, 'migrate-domain.js')
const APPLY_STATUSES = ['failed', 'drift', 'blocked']

/** Best-effort removal — the ONLY unlink in this module, used for the advisory lock. */
function safeUnlink(file) {
  try {
    fs.unlinkSync(file)
  } catch {
    /* lock may already be gone */
  }
}

/**
 * Acquire the per-parent soft advisory lock `<parent>/.nn-batch.lock` for
 * `--apply`/`--rollback`. `wx` is one syscall; the lock holds `{pid,startedAt}`.
 *
 * - `EEXIST` without `--force` ⇒ refused (caller exits 1, zero writes).
 * - `--force` ⇒ best-effort clears any existing lock and proceeds unheld.
 * - `EPERM`/`EACCES`/`ENOENT` (read-only or cloud parent) ⇒ warn and proceed.
 */
function acquireLock(parent, force, openLock, sink) {
  const lockPath = path.join(parent, LOCK_FILE)
  if (force) {
    safeUnlink(lockPath)
    return { acquired: true, lockPath, held: false, bypassed: true }
  }
  let fd
  try {
    fd = openLock(lockPath)
  } catch (err) {
    if (err.code === 'EEXIST') {
      sink.error(
        `Error: batch lock already held at ${lockPath}. Another batch may be running; re-run with --force to bypass.`,
      )
      return { acquired: false, lockPath, held: false, reason: 'EEXIST' }
    }
    if (err.code === 'EPERM' || err.code === 'EACCES' || err.code === 'ENOENT') {
      sink.error(
        `Warning: cannot create batch lock at ${lockPath} (${err.code}); proceeding without a lock.`,
      )
      return { acquired: true, lockPath, held: false, reason: err.code }
    }
    throw err
  }
  try {
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: toIso(new Date()) }))
  } finally {
    fs.closeSync(fd)
  }
  return { acquired: true, lockPath, held: true }
}

function releaseLock(lock) {
  if (!lock || !lock.held) return
  safeUnlink(lock.lockPath)
}

function normalizeOut(out) {
  if (!out) {
    return { log: (s) => console.log(s), error: (s) => console.error(s) }
  }
  if (typeof out === 'function') {
    return { log: (s) => out(s), error: (s) => console.error(s) }
  }
  return {
    log: out.log || ((s) => console.log(s)),
    error: out.error || ((s) => console.error(s)),
  }
}

function toIso(value) {
  const d = value instanceof Date ? value : new Date(value)
  return d.toISOString()
}

function isPlanArtifactName(name) {
  return name === PLAN_FILE || /^batch-journal-.*\.json$/.test(name)
}

/**
 * Directory-only discovery. Excludes dot-dirs, `-backup-*`, `_archive`,
 * `_templates`, and (defensively) plan/journal artifact names. Sorted so the
 * plan is deterministic and diffable.
 */
function discoverDomainDirs(parent) {
  let entries
  try {
    entries = fs.readdirSync(parent, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !name.includes('-backup-'))
    .filter((name) => name !== '_archive' && name !== '_templates')
    .filter((name) => !isPlanArtifactName(name))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/** A directory is a domaiNN candidate iff it carries a domain marker. */
function hasDomainMarker(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return false
  }
  for (const entry of entries) {
    if (entry === 'domaiNN_NN.md') return true
    if (/^workspace.*\.md$/i.test(entry)) return true
    if (/_base_[a-z0-9]+\.md$/i.test(entry)) return true
    if (entry === 'kNNowledge' || entry === 'models') return true
  }
  return false
}

async function classifyDomain(name, dir) {
  if (!hasDomainMarker(dir)) {
    return { name, path: dir, status: 'skipped', opsCount: 0, planHash: null, reason: 'not-a-domain' }
  }

  let plan
  try {
    plan = await planMigration(createFsDomainReader(dir), DEPS)
  } catch (err) {
    return { name, path: dir, status: 'blocked', opsCount: 0, planHash: null, reason: err.message }
  }

  const opsCount = Array.isArray(plan.ops) ? plan.ops.length : 0
  const planHash = plan.planHash || null

  if (plan.status === 'blocked') {
    const first =
      (plan.problems || []).find((p) => p.severity === 'error') || (plan.problems || [])[0]
    return { name, path: dir, status: 'blocked', opsCount, planHash, reason: first ? first.message : 'blocked' }
  }
  if (plan.status === 'noop') {
    return { name, path: dir, status: 'noop', opsCount: 0, planHash, reason: null }
  }
  return { name, path: dir, status: 'ready', opsCount, planHash, reason: null }
}

function countsFor(domains) {
  const counts = { ready: 0, noop: 0, blocked: 0, skipped: 0 }
  for (const d of domains) {
    if (counts[d.status] !== undefined) counts[d.status] += 1
  }
  return counts
}

/**
 * Explicit, non-interactive selection: intersect `ready` with `--only`, then
 * subtract `--exclude`. Unknown `--only` names warn but are not fatal.
 */
function selectReady(plan, only, exclude, sink) {
  const known = new Set(plan.domains.map((d) => d.name))
  for (const name of only) {
    if (!known.has(name)) {
      sink.error(`Warning: --only name not found in ${plan.parentDir}: ${name}`)
    }
  }
  let selected = plan.domains.filter((d) => d.status === 'ready').map((d) => d.name)
  if (only.length) selected = selected.filter((name) => only.includes(name))
  if (exclude.length) selected = selected.filter((name) => !exclude.includes(name))
  return selected
}

function atomicWriteJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

function renderTable(report) {
  const header = ['DOMAIN'.padEnd(14), 'STATUS'.padEnd(8), 'OPS'.padEnd(5), 'PLAN HASH'.padEnd(16), 'PATH'].join(' ')
  const rows = report.domains.map((d) =>
    [
      String(d.name).padEnd(14),
      String(d.status).padEnd(8),
      String(d.opsCount).padEnd(5),
      String(d.planHash || '-').padEnd(16),
      d.path,
    ].join(' '),
  )
  const c = report.counts
  const summary = `\n${report.parentDir}: ${report.domains.length} dir(s) — ready ${c.ready}, noop ${c.noop}, blocked ${c.blocked}, skipped ${c.skipped}`
  return [header, ...rows].join('\n') + summary
}

/**
 * In-process batch orchestrator. Pure seam: no process/console/fs globals beyond
 * the injected `spawn` (defaults to the real `spawnSync`), `now`, and `out`.
 *
 * @param {object} [opts]
 * @param {string[]} [opts.parents] Parent dirs (resolved) to process.
 * @param {'scan'|'apply'|'rollback'} [opts.command]
 * @param {{only?:string[], exclude?:string[]}} [opts.selection]
 * @param {string|null} [opts.planPath] Plan output (scan) or input (apply).
 * @param {string|null} [opts.journalPath] Aggregate journal input (rollback).
 * @param {boolean} [opts.consent] `--yes` consent token for apply/rollback.
 * @param {Function} [opts.spawn] Injectable child-process spawn (default spawnSync).
 * @param {Function} [opts.now] Injectable clock.
 * @param {object|Function} [opts.out] Output sink.
 * @param {boolean} [opts.json] Machine-readable output.
 *
 * @returns {Promise<{exitCode:number, command:string, parents:Array, selected:string[]}>}
 */
async function runBatch(opts = {}) {
  const {
    parents = [process.cwd()],
    command = 'scan',
    selection = {},
    planPath = null,
    journalPath = null,
    consent = false,
    force = false,
    spawn = spawnSync,
    openLock = (lockPath) => fs.openSync(lockPath, 'wx'),
    now = () => new Date(),
    out,
    json = false,
  } = opts

  const sink = normalizeOut(out)
  const only = Array.isArray(selection.only) ? selection.only : []
  const exclude = Array.isArray(selection.exclude) ? selection.exclude : []

  if (command === 'apply') {
    return runApply({
      parents,
      only,
      exclude,
      planPath,
      consent,
      force,
      spawn,
      openLock,
      now,
      out: sink,
      json,
    })
  }
  if (command === 'rollback') {
    return runRollback({
      journalPath: journalPath || planPath,
      consent,
      force,
      spawn,
      openLock,
      now,
      out: sink,
      json,
    })
  }
  if (command !== 'scan') {
    const message = `Unknown command: ${command}`
    sink.error(message)
    return { exitCode: 2, command, parents: [], selected: [], messages: [message] }
  }

  const generatedAt = toIso(now())

  const parentResults = []
  const allSelected = []
  let exitCode = 0

  for (const parentRaw of parents) {
    const parent = path.resolve(parentRaw)
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
      sink.error(`Error: parent directory not found: ${parent}`)
      exitCode = 1
      continue
    }

    const domains = []
    for (const name of discoverDomainDirs(parent)) {
      domains.push(await classifyDomain(name, path.join(parent, name)))
    }

    const plan = { version: 1, generatedAt, parentDir: parent, domains }
    const targetPlanPath = planPath ? path.resolve(planPath) : path.join(parent, PLAN_FILE)
    atomicWriteJson(targetPlanPath, plan)

    const selected = selectReady(plan, only, exclude, sink)
    allSelected.push(...selected)

    parentResults.push({
      parentDir: parent,
      planPath: targetPlanPath,
      plan,
      report: { parentDir: parent, scannedAt: generatedAt, counts: countsFor(domains), domains },
      selected,
    })

    if (domains.some((d) => d.status === 'blocked')) exitCode = 1
  }

  if (json) {
    if (parentResults.length === 1) {
      sink.log(JSON.stringify(parentResults[0].report, null, 2))
    } else {
      sink.log(JSON.stringify({ parents: parentResults.map((p) => p.report) }, null, 2))
    }
  } else {
    for (const p of parentResults) sink.log(renderTable(p.report))
  }

  return { exitCode, command, parents: parentResults, selected: allSelected }
}

/** Batch stamp `YYYY-MM-DD_HHMMSS` (UTC) used for the aggregate journal name. */
function batchStamp(date) {
  const iso = toIso(date)
  return `${iso.slice(0, 10)}_${iso.slice(11, 19).replace(/:/g, '')}`
}

/** Discover + classify a parent fresh (used only when no persisted plan exists). */
async function buildPlan(parent, now) {
  const domains = []
  for (const name of discoverDomainDirs(parent)) {
    domains.push(await classifyDomain(name, path.join(parent, name)))
  }
  return { version: 1, generatedAt: toIso(now()), parentDir: path.resolve(parent), domains }
}

/**
 * Apply one selected `ready` domain. Recomputes `planHash` in process first
 * (drift guard, no spawn on mismatch or absent hash), then delegates mutation to
 * `migrate-domain.js`. Never throws: failures are recorded as a status.
 */
async function applyOne({ entry, order, spawn }) {
  const rec = {
    name: entry.name,
    path: entry.path,
    order,
    status: null,
    planHash: entry.planHash || null,
    backupDir: null,
    journalPath: null,
    exitCode: null,
    error: null,
  }

  if (!entry.planHash) {
    rec.status = 'drift'
    rec.error = 'missing-plan-hash'
    return rec
  }

  let fresh
  try {
    fresh = await planMigration(createFsDomainReader(entry.path), DEPS)
  } catch (err) {
    rec.status = 'failed'
    rec.error = err.message
    return rec
  }

  // Idempotency: a domain already at canonical layout re-plans to `noop`. Skip it
  // (no spawn, no backup) instead of treating the expected hash change as drift.
  if (fresh.status === 'noop') {
    rec.status = 'skipped'
    rec.planHash = fresh.planHash || rec.planHash
    return rec
  }

  if ((fresh.planHash || null) !== entry.planHash) {
    rec.status = 'drift'
    rec.error = 'Plan hash mismatch'
    return rec
  }

  const res = spawn(
    process.execPath,
    [MIGRATE_CLI, '--domain-dir', entry.path, '--apply', '--plan-hash', entry.planHash, '--yes'],
    { encoding: 'utf-8' },
  )
  rec.exitCode = res.status
  const stdout = res.stdout || ''
  const stderr = res.stderr || ''

  if (res.status === 0) {
    const match = stdout.match(/Backup created at:\s*(.+)/)
    if (match) {
      rec.status = 'applied'
      rec.backupDir = match[1].trim()
      rec.journalPath = path.join(rec.backupDir, 'journal.json')
    } else {
      // Spawned migrate-domain.js reported "already up to date" (no backup).
      rec.status = 'skipped'
    }
  } else if (/Plan hash mismatch/.test(stderr)) {
    rec.status = 'drift'
    rec.error = 'Plan hash mismatch'
  } else {
    rec.status = 'failed'
    rec.error = stderr.trim() || stdout.trim() || `migrate-domain.js exited with ${res.status}`
  }
  return rec
}

/**
 * `--apply`: consent-gate, then per selected `ready` domain (ascending) drift-check
 * and spawn. Continue-on-failure; aggregate journal written incrementally.
 */
async function runApply({
  parents,
  only,
  exclude,
  planPath,
  consent,
  force,
  spawn,
  openLock,
  now,
  out,
  json,
}) {
  if (!consent) {
    const message = 'Consent required: pass --yes to apply domain migrations.'
    out.error(message)
    return { exitCode: 1, command: 'apply', parents: [], selected: [], messages: [message] }
  }

  const startedAt = toIso(now())
  const stamp = batchStamp(now())
  const parentResults = []
  const allSelected = []
  let exitCode = 0

  for (const parentRaw of parents) {
    const parent = path.resolve(parentRaw)
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
      out.error(`Error: parent directory not found: ${parent}`)
      exitCode = 1
      continue
    }

    // Per-parent advisory lock: acquired before any write, released in `finally`.
    const lock = acquireLock(parent, force, openLock, out)
    if (!lock.acquired) {
      exitCode = 1
      continue
    }

    try {
      let plan
      let resolvedPlanPath
      if (planPath) {
        resolvedPlanPath = path.resolve(planPath)
        if (!fs.existsSync(resolvedPlanPath)) {
          out.error(`Error: plan not found: ${resolvedPlanPath}`)
          exitCode = 1
          continue
        }
        try {
          plan = JSON.parse(fs.readFileSync(resolvedPlanPath, 'utf-8'))
        } catch (err) {
          out.error(`Error: cannot read plan ${resolvedPlanPath}: ${err.message}`)
          exitCode = 1
          continue
        }
      } else {
        resolvedPlanPath = path.join(parent, PLAN_FILE)
        if (fs.existsSync(resolvedPlanPath)) {
          try {
            plan = JSON.parse(fs.readFileSync(resolvedPlanPath, 'utf-8'))
          } catch (err) {
            out.error(`Error: cannot read plan ${resolvedPlanPath}: ${err.message}`)
            exitCode = 1
            continue
          }
        } else {
          // First-time apply: no persisted plan, take a fresh read-only scan.
          plan = await buildPlan(parent, now)
          atomicWriteJson(resolvedPlanPath, plan)
        }
      }

      const selected = selectReady(plan, only, exclude, out)
      allSelected.push(...selected)

      if (selected.length === 0) {
        out.log(`No candidates to apply in ${parent}`)
        parentResults.push({
          parentDir: parent,
          planPath: resolvedPlanPath,
          plan,
          selected,
          journalPath: null,
          journal: null,
          results: [],
        })
        continue
      }

      const journalPathForParent = path.join(parent, `batch-journal-${stamp}.json`)
      const journal = {
        version: 1,
        batchId: stamp,
        parentDir: parent,
        startedAt,
        finishedAt: null,
        committed: false,
        domains: [],
      }
      atomicWriteJson(journalPathForParent, journal)

      const results = []
      let order = 0
      for (const name of selected) {
        const entry = plan.domains.find((d) => d.name === name)
        const rec = await applyOne({ entry, order: order++, spawn })
        results.push(rec)
        journal.domains.push(rec)
        // Write-ahead after each domain so a killed batch leaves a recoverable journal.
        atomicWriteJson(journalPathForParent, journal)
        if (rec.status === 'applied') {
          out.log(`Applied ${entry.name} (backup: ${rec.backupDir})`)
        } else if (rec.status === 'skipped') {
          out.log(`Skipped ${entry.name} (already current)`)
        } else {
          out.error(`Domain ${entry.name}: ${rec.status}${rec.error ? ` — ${rec.error}` : ''}`)
        }
      }

      journal.finishedAt = toIso(now())
      journal.committed = true
      atomicWriteJson(journalPathForParent, journal)

      if (results.some((r) => APPLY_STATUSES.includes(r.status))) exitCode = 1

      parentResults.push({
        parentDir: parent,
        planPath: resolvedPlanPath,
        plan,
        selected,
        journalPath: journalPathForParent,
        journal,
        results,
      })
    } finally {
      releaseLock(lock)
    }
  }

  if (json) {
    out.log(
      JSON.stringify(
        {
          command: 'apply',
          parents: parentResults.map((p) => ({
            parentDir: p.parentDir,
            journalPath: p.journalPath,
            results: p.results,
          })),
        },
        null,
        2,
      ),
    )
  }

  return { exitCode, command: 'apply', parents: parentResults, selected: allSelected }
}

/**
 * `--rollback <batch-journal.json>` (alias `--restore`): restore `applied`
 * domains in reverse `order`, one spawned `migrate-domain.js --restore` each.
 */
async function runRollback({ journalPath, consent, force, spawn, openLock, now, out, json }) {
  if (!consent) {
    const message = 'Consent required: pass --yes to restore domains.'
    out.error(message)
    return { exitCode: 1, command: 'rollback', journalPath: journalPath || null, restored: [], messages: [message] }
  }
  if (!journalPath) {
    const message = 'Error: --rollback requires a batch journal path.'
    out.error(message)
    return { exitCode: 1, command: 'rollback', journalPath: null, restored: [], messages: [message] }
  }

  const resolved = path.resolve(journalPath)
  if (!fs.existsSync(resolved)) {
    const message = `Error: batch journal not found: ${resolved}`
    out.error(message)
    return { exitCode: 1, command: 'rollback', journalPath: resolved, restored: [], messages: [message] }
  }

  let journal
  try {
    journal = JSON.parse(fs.readFileSync(resolved, 'utf-8'))
  } catch (err) {
    const message = `Error: cannot read journal ${resolved}: ${err.message}`
    out.error(message)
    return { exitCode: 1, command: 'rollback', journalPath: resolved, restored: [], messages: [message] }
  }

  const applied = (journal.domains || [])
    .filter((d) => d.status === 'applied' && !d.restored)
    .sort((a, b) => b.order - a.order)

  const rollbackParent = journal.parentDir
    ? path.resolve(journal.parentDir)
    : path.dirname(resolved)
  const lock = acquireLock(rollbackParent, force, openLock, out)
  if (!lock.acquired) {
    return { exitCode: 1, command: 'rollback', journalPath: resolved, restored: [], messages: ['lock-held'] }
  }

  const restored = []
  let failed = false
  try {
    for (const d of applied) {
      const res = spawn(
        process.execPath,
        [MIGRATE_CLI, '--domain-dir', d.path, '--restore', d.backupDir],
        { encoding: 'utf-8' },
      )
      if (res.status === 0) {
        d.restored = true
        d.restoreError = null
        out.log(`Restored ${d.name} from ${d.backupDir}`)
      } else {
        failed = true
        d.restoreError = (res.stderr || '').trim() || `migrate-domain.js exited with ${res.status}`
        out.error(`Failed to restore ${d.name}: ${d.restoreError}`)
      }
      restored.push({
        name: d.name,
        order: d.order,
        status: res.status === 0 ? 'restored' : 'restore-failed',
        exitCode: res.status,
        error: d.restoreError || null,
      })
      atomicWriteJson(resolved, journal)
    }

    journal.lastRollbackAt = toIso(now())
    atomicWriteJson(resolved, journal)
  } finally {
    releaseLock(lock)
  }

  if (json) {
    out.log(JSON.stringify({ command: 'rollback', journalPath: resolved, restored }, null, 2))
  }

  return { exitCode: failed ? 1 : 0, command: 'rollback', journalPath: resolved, journal, restored }
}

function parseArgs(argv) {
  const opts = {
    parents: [],
    command: 'scan',
    json: false,
    only: [],
    exclude: [],
    planPath: null,
    yes: false,
    force: false,
  }
  const known = new Set([
    '--dir',
    '--scan',
    '--apply',
    '--rollback',
    '--restore',
    '--json',
    '--only',
    '--exclude',
    '--plan',
    '--yes',
    '--force',
  ])

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!known.has(arg)) return { error: `Unknown flag: ${arg}` }
    switch (arg) {
      case '--dir': {
        const value = argv[++i]
        if (value === undefined) return { error: '--dir requires a value' }
        opts.parents.push(value)
        break
      }
      case '--scan':
        opts.command = 'scan'
        break
      case '--apply':
        opts.command = 'apply'
        break
      case '--rollback':
      case '--restore': {
        opts.command = 'rollback'
        const value = argv[i + 1]
        if (value !== undefined && !value.startsWith('--')) {
          opts.journalPath = value
          i += 1
        }
        break
      }
      case '--json':
        opts.json = true
        break
      case '--only': {
        const value = argv[++i]
        if (value === undefined) return { error: '--only requires a value' }
        opts.only = value.split(',').map((s) => s.trim()).filter(Boolean)
        break
      }
      case '--exclude': {
        const value = argv[++i]
        if (value === undefined) return { error: '--exclude requires a value' }
        opts.exclude = value.split(',').map((s) => s.trim()).filter(Boolean)
        break
      }
      case '--plan': {
        const value = argv[++i]
        if (value === undefined) return { error: '--plan requires a value' }
        opts.planPath = value
        break
      }
      case '--yes':
        opts.yes = true
        break
      case '--force':
        opts.force = true
        break
      default:
        break
    }
  }
  return { opts }
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    console.error(`Error: ${parsed.error}`)
    console.error(USAGE)
    process.exitCode = 2
    return 2
  }

  const opts = parsed.opts
  const parents = opts.parents.length ? opts.parents.map((p) => path.resolve(p)) : [process.cwd()]
  if (opts.planPath && parents.length > 1) {
    console.error('Error: --plan can only be combined with a single --dir parent.')
    process.exitCode = 2
    return 2
  }

  const result = await runBatch({
    parents,
    command: opts.command,
    selection: { only: opts.only, exclude: opts.exclude },
    planPath: opts.planPath,
    journalPath: opts.journalPath,
    consent: opts.yes,
    force: opts.force,
    now: () => new Date(),
    json: opts.json,
  })

  process.exitCode = result.exitCode
  return result.exitCode
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}

module.exports = {
  runBatch,
  main,
  discoverDomainDirs,
  hasDomainMarker,
  atomicWriteJson,
}
