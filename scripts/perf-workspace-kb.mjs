#!/usr/bin/env node
/**
 * scripts/perf-workspace-kb.mjs
 *
 * Workspace KB performance probe (backlog: chore/workspace-kb-perf-limits).
 *
 * Generates a disposable scaled workspace under `temp/simulation-perf/` and
 * measures `check_workspace`, `validate_model`, and `query_units` latency vs
 * dimension size, so breaking points (timeouts, memory, false KU_* errors)
 * are recorded instead of guessed.
 *
 * Dimensions are scaled independently:
 *   --models N      number of Level-3 model files
 *   --rows N        rows per sources/*.csv knowledge unit
 *   --units N       knowledge-unit headings per source file
 *   --sources N     source files under sources/nn/
 *
 * Run:
 *   node scripts/perf-workspace-kb.mjs --models 20 --rows 500 --units 50 --sources 4
 *
 * Output is a markdown table of {dimension, value, check_ms, validate_ms, query_ms}.
 * Fixtures live under the repo-root temp/ directory (gitignored) and are
 * removed on exit.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const perfRoot = join(repoRoot, 'temp', 'simulation-perf')
const mcpEntry = join(repoRoot, 'iNNfo', 'packages', 'innfo-mcp', 'dist', 'server.js')

/** Retry a recursive rm; Windows MCP children may still hold handles briefly. */
function rmWithRetry(dir, attempts = 8, delayMs = 300) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch (err) {
      if (i === attempts - 1) throw err
      const end = Date.now() + delayMs
      while (Date.now() < end) {
        /* busy-wait: file handles must be released by the child before rmdir */
      }
    }
  }
}

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '')
    const val = Number(argv[i + 1])
    if (!Number.isFinite(val) || val < 1) {
      throw new Error(`Expected --${key} <positive integer>`)
    }
    args[key] = val
  }
  return {
    models: args.models ?? 10,
    rows: args.rows ?? 200,
    units: args.units ?? 20,
    sources: args.sources ?? 2,
  }
}

function generateWorkspace({ models, rows, units, sources }) {
  if (existsSync(perfRoot)) rmSync(perfRoot, { recursive: true, force: true })
  mkdirSync(join(perfRoot, 'models'), { recursive: true })
  mkdirSync(join(perfRoot, 'sources', 'nn'), { recursive: true })

  for (let s = 0; s < sources; s++) {
    const header = ['id', 'metric', 'owner', 'status']
    const lines = [header.join(',')]
    for (let r = 0; r < rows; r++) {
      lines.push([`k${s}-${r}`, `value_${r}`, `owner_${r % 7}`, 'active'].join(','))
    }
    writeFileSync(join(perfRoot, 'sources', 'nn', `kb_${s}.csv`), lines.join('\n'), 'utf8')

    let unitsMd = `# NN Sources\n`
    unitsMd += `## NN Source: KB ${s}\n`
    unitsMd += `  source_file:: "sources/nn/kb_${s}.csv"\n`
    for (let u = 0; u < units; u++) {
      unitsMd += `\n## NN Knowledge Unit: Unit ${s}-${u}\n  slug:: "unit-${s}-${u}"\n  metric:: "value_${u}"\n  description:: "Knowledge unit ${s}-${u} with a moderately long description so the parse has real work to do."\n`
    }
    writeFileSync(join(perfRoot, 'sources', 'nn', `kb_${s}_NN.md`), unitsMd, 'utf8')
  }

  for (let m = 0; m < models; m++) {
    const content = [
      '---',
      'spec_version: "V_0-2-0"',
      'spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md"',
      'level: 3',
      'parent_spec:',
      '  name: "business_V_0-2-0"',
    '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/spec_NN.md"',
    'knowledge_version: "V_0-0-1"',
      'title: "Perf Model"',
      '---',
      '',
      '> [!NOTE]',
      '> Generated performance fixture.',
      '',
      '# NN index',
      '* [[Item A]]',
      '* [[Item B]]',
      '',
      '# NN Problems',
      '',
      '## NN Problems: Item A',
      'severity:: high',
      'description:: Problem A of a generated perf model.',
      '',
      '## NN Problems: Item B',
      'severity:: medium',
      'description:: Problem B of a generated perf model.',
      '',
    ].join('\n')
    writeFileSync(join(perfRoot, 'models', `perf_model_${m}_V_0-0-1_business_NN.md`), content, 'utf8')
  }

  return perfRoot
}

/** One stdio JSON-RPC round trip against the innfo-mcp server. */
function mcpCall(rootDir, toolName, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [mcpEntry], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    let buf = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill()
        rejectPromise(new Error(`MCP timeout for ${toolName}`))
      }
    }, 120000)

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      let idx
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 1)
        if (!line) continue
        let msg
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (msg.id === 2) {
          settled = true
          clearTimeout(timer)
          child.kill()
          const result = msg.result
          const text = Array.isArray(result?.content) ? result.content.map((c) => c.text ?? '').join('') : ''
          resolvePromise(text)
        }
      }
    })

    const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n')

    send({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'perf-harness', version: '0.1.0' } } })
    send({ jsonrpc: '2.0', id: 1, method: 'notifications/initialized', params: {} })
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: toolName, arguments: args } })

    child.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        rejectPromise(err)
      }
    })
  })
}

async function measure(rootDir) {
  const out = {}
  const t0 = performance.now()
  await mcpCall(rootDir, 'check_workspace', {})
  out.check = performance.now() - t0

  const t1 = performance.now()
  await mcpCall(rootDir, 'validate_model', { id: 'perf_model_0_V_0-0-1_business_NN' })
  out.validate = performance.now() - t1

  const t2 = performance.now()
  await mcpCall(rootDir, 'query_units', { query: 'sources/nn/kb_0.csv?status=active' })
  out.query = performance.now() - t2

  return out
}

async function main() {
  const dims = parseArgs(process.argv)
  const rootDir = generateWorkspace(dims)

  console.log(`# Workspace KB perf probe — ${JSON.stringify(dims)}`)
  console.log(`Workspace: ${rootDir}`)
  console.log('')
  console.log('| tool | latency (ms) |')
  console.log('|---|---|')
  const { check, validate, query } = await measure(rootDir)
  console.log(`| check_workspace | ${Math.round(check)} |`)
  console.log(`| validate_model | ${Math.round(validate)} |`)
  console.log(`| query_units | ${Math.round(query)} |`)
  console.log('')

  rmWithRetry(perfRoot)
  console.log('Fixtures removed. Done.')
}

main().catch((err) => {
  console.error(err)
  rmWithRetry(perfRoot)
  process.exit(1)
})