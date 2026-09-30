import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const scriptPath = resolve(here, 'export-console.mjs')

function computeHash(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex')
}

async function runCli(args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env, ...opts.env },
    })
    return { code: 0, stdout, stderr }
  } catch (err) {
    return {
      code: err.code ?? (err.status || 1),
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    }
  }
}

describe('export-console CLI test suite', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nn-export-test-'))
    // Create models directory with fixtures
    await mkdir(join(tempDir, 'models'), { recursive: true })
    await mkdir(join(tempDir, 'subdomains'), { recursive: true })

    const modelA = `---
title: "Business Model"
knowledge_version: "V_0-2-5"
level: 3
---

# NN Market
## NN Stakeholders: Enterprise Customer
  budget:: "$50k"
  tagline:: "They REJECTED $1M. Today They're Bankrupt"

  Primary enterprise segment with annual subscription.
`
    const modelB = `---
title: "Procedures Model"
knowledge_version: "V_0-1-0"
level: 3
---

# NN Procedures
## NN Procedure: Onboarding
  duration:: "2 weeks"

  Standard customer onboarding procedure.
`
    const modelC = `---
title: "Metrics Model"
knowledge_version: "V_0-1-0"
level: 3
---

# NN Metrics
## NN Metric: ARR
  target:: "1M"

  Annual recurring revenue target.
`

    await writeFile(join(tempDir, 'models', 'business_V_0-2-5_NN.md'), modelA, 'utf-8')
    await writeFile(join(tempDir, 'models', 'procedures_V_0-1-0_NN.md'), modelB, 'utf-8')
    await writeFile(join(tempDir, 'subdomains', 'metrics_V_0-1-0_NN.md'), modelC, 'utf-8')
  })

  afterEach(async () => {
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  describe('Phase 1: Argument Parsing and Usage', () => {
    it('exits with code 2 when workspaceRoot is omitted', async () => {
      const res = await runCli([])
      assert.equal(res.code, 2)
      assert.match(res.stderr, /Usage:/)
    })

    it('lists all Level 3 models with --list and does not create export folder', async () => {
      const res = await runCli([tempDir, '--list'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md/)
      assert.match(res.stdout, /procedures_V_0-1-0_NN\.md/)
      assert.match(res.stdout, /metrics_V_0-1-0_NN\.md/)
      assert.match(res.stdout, /\(3 models\)/)
      assert.equal(existsSync(join(tempDir, 'export')), false)
    })

    it('exits with code 1 when no models match filter and not in read-only mode', async () => {
      const res = await runCli([tempDir, 'nonexistent_pattern'])
      assert.equal(res.code, 1)
      assert.match(res.stderr, /No models selected/i)
    })
  })

  describe('Phase 2: SHA-256 Hashing, Metadata Injection & Status Engine', () => {
    it('injects meta.sha256 matching source model content into compiled HTML', async () => {
      const res = await runCli([tempDir, 'business'])
      assert.equal(res.code, 0)

      const htmlPath = join(
        tempDir,
        'export',
        'business_V_0-2-5_console',
        'business_V_0-2-5_console.html',
      )
      assert.equal(existsSync(htmlPath), true)

      const htmlContent = await readFile(htmlPath, 'utf-8')
      const sourceContent = await readFile(
        join(tempDir, 'models', 'business_V_0-2-5_NN.md'),
        'utf-8',
      )
      const expectedHash = computeHash(sourceContent)

      const jsonMatch = htmlContent.match(
        /<script type="application\/json" id="innfo-model">([\s\S]*?)<\/script>/,
      )
      assert.ok(jsonMatch, 'innfo-model script slot exists in HTML')

      const modelJson = JSON.parse(jsonMatch[1])
      assert.equal(modelJson.meta.sha256, expectedHash)
      assert.equal(modelJson.meta.modelVersion, 'V_0-2-5')
    })

    it('emits embedded model JSON verbatim when fields contain $-sequences', async () => {
      const res = await runCli([tempDir, 'business'])
      assert.equal(res.code, 0)

      const htmlPath = join(
        tempDir,
        'export',
        'business_V_0-2-5_console',
        'business_V_0-2-5_console.html',
      )
      const htmlContent = await readFile(htmlPath, 'utf-8')
      const jsonMatch = htmlContent.match(
        /<script type="application\/json" id="innfo-model">([\s\S]*?)<\/script>/,
      )
      assert.ok(jsonMatch, 'innfo-model script slot exists in HTML')

      const modelJson = JSON.parse(jsonMatch[1])
      const element = modelJson.elements.find((e) => e.fields.tagline)
      assert.ok(element, 'fixture element with $-sequence survived injection')
      assert.equal(element.fields.tagline, "They REJECTED $1M. Today They're Bankrupt")
    })

    it('reports status tags correctly with --status in read-only mode', async () => {
      // Initially all are uncompiled
      let res = await runCli([tempDir, '--status'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md\s+\[uncompiled\]/)
      assert.match(res.stdout, /procedures_V_0-1-0_NN\.md\s+\[uncompiled\]/)
      assert.match(res.stdout, /metrics_V_0-1-0_NN\.md\s+\[uncompiled\]/)
      assert.equal(existsSync(join(tempDir, 'export')), false, 'Status check must not create export dir')

      // Compile business model
      const compileRes = await runCli([tempDir, 'business'])
      assert.equal(compileRes.code, 0)

      // Now business is fresh, others uncompiled
      res = await runCli([tempDir, '--status'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md\s+\[fresh\]/)
      assert.match(res.stdout, /procedures_V_0-1-0_NN\.md\s+\[uncompiled\]/)

      // Modify business model without updating version -> stale
      const currentContent = await readFile(join(tempDir, 'models', 'business_V_0-2-5_NN.md'), 'utf-8')
      await writeFile(
        join(tempDir, 'models', 'business_V_0-2-5_NN.md'),
        currentContent + '\n## NN Stakeholders: Partner\n  budget:: "$10k"\n',
        'utf-8',
      )

      res = await runCli([tempDir, '--status'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md\s+\[stale\]/)

      // Bump version in model frontmatter without recompiling -> version_mismatch
      const modifiedContent = await readFile(join(tempDir, 'models', 'business_V_0-2-5_NN.md'), 'utf-8')
      const bumpedContent = modifiedContent.replace('knowledge_version: "V_0-2-5"', 'knowledge_version: "V_0-3-0"')
      await writeFile(join(tempDir, 'models', 'business_V_0-2-5_NN.md'), bumpedContent, 'utf-8')

      res = await runCli([tempDir, '--status'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md\s+\[version_mismatch\]/)
    })
  })

  describe('Phase 3: Tree Hierarchy Visualization & Selective Export', () => {
    it('renders hierarchical directory tree with --tree in read-only mode', async () => {
      const res = await runCli([tempDir, '--tree'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /models\//)
      assert.match(res.stdout, /subdomains\//)
      assert.match(res.stdout, /business_V_0-2-5_NN\.md/)
      assert.match(res.stdout, /\[uncompiled\]/)
      assert.equal(existsSync(join(tempDir, 'export')), false)
    })

    it('exports all models with --all', async () => {
      const res = await runCli([tempDir, '--all'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /Exported 3 console artifact\(s\)/)
      assert.equal(
        existsSync(join(tempDir, 'export', 'business_V_0-2-5_console', 'business_V_0-2-5_console.html')),
        true,
      )
      assert.equal(
        existsSync(join(tempDir, 'export', 'procedures_V_0-1-0_console', 'procedures_V_0-1-0_console.html')),
        true,
      )
      assert.equal(
        existsSync(join(tempDir, 'export', 'metrics_V_0-1-0_console', 'metrics_V_0-1-0_console.html')),
        true,
      )
    })

    it('exports only stale or uncompiled models with --stale', async () => {
      // Compile all models first
      await runCli([tempDir, '--all'])

      // Running --stale now should do nothing because all are fresh
      let res = await runCli([tempDir, '--stale'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /fresh|nothing to export/i)

      // Modify procedures model
      const procFile = join(tempDir, 'models', 'procedures_V_0-1-0_NN.md')
      const content = await readFile(procFile, 'utf-8')
      await writeFile(procFile, content + '\n## NN Procedure: Offboarding\n', 'utf-8')

      // Now --stale should compile only procedures
      res = await runCli([tempDir, '--stale'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /procedures_V_0-1-0_console\.html/)
      assert.doesNotMatch(res.stdout, /business_V_0-2-5_console\.html/)
      assert.match(res.stdout, /Exported 1 console artifact\(s\)/)
    })

    it('filters models by pattern with --filter', async () => {
      const res = await runCli([tempDir, '--filter', 'metrics'])
      assert.equal(res.code, 0)
      assert.match(res.stdout, /metrics_V_0-1-0_console\.html/)
      assert.doesNotMatch(res.stdout, /business_V_0-2-5_console\.html/)
      assert.doesNotMatch(res.stdout, /procedures_V_0-1-0_console\.html/)
      assert.match(res.stdout, /Exported 1 console artifact\(s\)/)
    })
  })

  describe('Phase 4: Standalone exporter & CDN pin', () => {
    it('pins the runtime CDN to the vendored bundle version banner', async () => {
      const res = await runCli([tempDir, 'business'])
      assert.equal(res.code, 0)

      const htmlPath = join(
        tempDir,
        'export',
        'business_V_0-2-5_console',
        'business_V_0-2-5_console.html',
      )
      const htmlContent = await readFile(htmlPath, 'utf-8')
      const configMatch = htmlContent.match(
        /<script type="application\/json" id="innfo-config">([\s\S]*?)<\/script>/,
      )
      assert.ok(configMatch, 'innfo-config slot exists in HTML')
      const config = JSON.parse(configMatch[1])

      const bundle = await readFile(
        resolve(here, '..', 'iNNfo', 'specs', 'bluepriNNts', 'console', 'innfo-console.bundle.js'),
        'utf-8',
      )
      const version = bundle.match(/\bVersion (\d+\.\d+\.\d+)\./)[1]
      assert.equal(
        config.runtime.cdn,
        `https://cdn.jsdelivr.net/gh/cogNNitive/cogNNitive@innfo-console-v${version}/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js`,
      )
    })

    it('normalizes every console CDN ref in the output to the vendored bundle version', async () => {
      const res = await runCli([tempDir, 'business'])
      assert.equal(res.code, 0)

      const htmlPath = join(
        tempDir,
        'export',
        'business_V_0-2-5_console',
        'business_V_0-2-5_console.html',
      )
      const htmlContent = await readFile(htmlPath, 'utf-8')

      const bundle = await readFile(
        resolve(here, '..', 'iNNfo', 'specs', 'bluepriNNts', 'console', 'innfo-console.bundle.js'),
        'utf-8',
      )
      const version = bundle.match(/\bVersion (\d+\.\d+\.\d+)\./)[1]

      const refs = [...htmlContent.matchAll(/@innfo-console-v(\d+\.\d+\.\d+)/g)].map((m) => m[1])
      assert.ok(refs.length > 0, 'console CDN ref(s) present in output')
      assert.deepEqual(
        [...new Set(refs)],
        [version],
        'every console CDN ref must match the vendored bundle version',
      )
    })

    it('runs standalone next to the console assets without scripts/lib or manifest', async () => {
      const repoRoot = resolve(here, '..')
      const toolsDir = join(tempDir, 'tools')
      const consoleDir = join(tempDir, 'iNNfo', 'specs', 'bluepriNNts', 'console')
      await mkdir(toolsDir, { recursive: true })
      await mkdir(consoleDir, { recursive: true })
      await copyFile(resolve(here, 'export-console.mjs'), join(toolsDir, 'export-console.mjs'))
      for (const name of ['artifact_shell.html', 'innfo-console.bundle.js']) {
        await copyFile(
          join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console', name),
          join(consoleDir, name),
        )
      }
      assert.equal(existsSync(join(tempDir, 'manifest')), false)

      const { stdout } = await execFileAsync(
        process.execPath,
        [join(toolsDir, 'export-console.mjs'), tempDir, 'business'],
        { cwd: tempDir },
      )
      assert.match(stdout, /business_V_0-2-5_console\.html/)
      assert.equal(
        existsSync(join(tempDir, 'export', 'business_V_0-2-5_console', 'business_V_0-2-5_console.html')),
        true,
      )
    })

    it('falls back to the legacy artifact_blueprint.html name in an installed console dir', async () => {
      const repoRoot = resolve(here, '..')
      const consoleSrc = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')
      const assetsDir = join(tempDir, 'legacy-console')
      const toolsDir = join(tempDir, 'elsewhere', 'tools')
      await mkdir(assetsDir, { recursive: true })
      await mkdir(toolsDir, { recursive: true })
      await copyFile(resolve(here, 'export-console.mjs'), join(toolsDir, 'export-console.mjs'))
      // Installs made before the shell rename only carry the old filename.
      await copyFile(join(consoleSrc, 'artifact_shell.html'), join(assetsDir, 'artifact_blueprint.html'))
      await copyFile(join(consoleSrc, 'innfo-console.bundle.js'), join(assetsDir, 'innfo-console.bundle.js'))

      const { stdout } = await execFileAsync(
        process.execPath,
        [join(toolsDir, 'export-console.mjs'), tempDir, 'business'],
        { cwd: tempDir, env: { ...process.env, INNFO_CONSOLE_DIR: assetsDir } },
      )
      assert.match(stdout, /business_V_0-2-5_console\.html/)
      assert.equal(
        existsSync(join(tempDir, 'export', 'business_V_0-2-5_console', 'business_V_0-2-5_console.html')),
        true,
      )
    })

    it('prefers artifact_shell.html over the legacy name when both exist in a dir', async () => {
      const repoRoot = resolve(here, '..')
      const consoleSrc = join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console')
      const assetsDir = join(tempDir, 'both-console')
      const toolsDir = join(tempDir, 'elsewhere', 'tools')
      await mkdir(assetsDir, { recursive: true })
      await mkdir(toolsDir, { recursive: true })
      await copyFile(resolve(here, 'export-console.mjs'), join(toolsDir, 'export-console.mjs'))
      await copyFile(join(consoleSrc, 'artifact_shell.html'), join(assetsDir, 'artifact_shell.html'))
      const shell = await readFile(join(consoleSrc, 'artifact_shell.html'), 'utf-8')
      await writeFile(join(assetsDir, 'artifact_blueprint.html'), shell.replace('<title>', '<title>STALE-LEGACY '))
      await copyFile(join(consoleSrc, 'innfo-console.bundle.js'), join(assetsDir, 'innfo-console.bundle.js'))

      await execFileAsync(
        process.execPath,
        [join(toolsDir, 'export-console.mjs'), tempDir, 'business'],
        { cwd: tempDir, env: { ...process.env, INNFO_CONSOLE_DIR: assetsDir } },
      )
      const out = await readFile(
        join(tempDir, 'export', 'business_V_0-2-5_console', 'business_V_0-2-5_console.html'),
        'utf-8',
      )
      assert.equal(out.includes('STALE-LEGACY'), false)
    })

    it('resolves console assets from $INNFO_CONSOLE_DIR when no repo tree is present', async () => {
      const repoRoot = resolve(here, '..')
      const assetsDir = join(tempDir, 'installed-console')
      const toolsDir = join(tempDir, 'elsewhere', 'tools')
      await mkdir(assetsDir, { recursive: true })
      await mkdir(toolsDir, { recursive: true })
      await copyFile(resolve(here, 'export-console.mjs'), join(toolsDir, 'export-console.mjs'))
      for (const name of ['artifact_shell.html', 'innfo-console.bundle.js']) {
        await copyFile(
          join(repoRoot, 'iNNfo', 'specs', 'bluepriNNts', 'console', name),
          join(assetsDir, name),
        )
      }

      const { stdout } = await execFileAsync(
        process.execPath,
        [join(toolsDir, 'export-console.mjs'), tempDir, 'business'],
        { cwd: tempDir, env: { ...process.env, INNFO_CONSOLE_DIR: assetsDir } },
      )
      assert.match(stdout, /business_V_0-2-5_console\.html/)
      assert.equal(
        existsSync(join(tempDir, 'export', 'business_V_0-2-5_console', 'business_V_0-2-5_console.html')),
        true,
      )
    })
  })
})
