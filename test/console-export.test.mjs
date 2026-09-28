import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { JSDOM } from 'jsdom'

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const scriptPath = resolve(here, '..', 'scripts', 'export-console.mjs')

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

describe('Console Offline Contract & CLI Standalone Export', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nn-offline-test-'))
    await mkdir(join(tempDir, 'models'), { recursive: true })

    const modelContent = `---
title: "Offline Business Model"
model_version: "V_1-0-0"
level: 3
---

# NN Market
## NN Stakeholders: Enterprise
  budget:: "$100k"
  tagline:: "Mission critical"

  Leading enterprise tier offering.

## NN RevenueStream: Subscription
  pricing:: "$50k/yr"

  Annual recurring subscription stream.
`
    await writeFile(join(tempDir, 'models', 'business_V_1-0-0_NN.md'), modelContent, 'utf-8')
  })

  afterEach(async () => {
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('exports standalone 3-tier console artifact with embedded bundle and slots', async () => {
    const res = await runCli([tempDir, '--all'])
    assert.equal(res.code, 0)

    const exportDir = join(tempDir, 'export', 'business_V_1-0-0_console')
    const htmlPath = join(exportDir, 'business_V_1-0-0_console.html')
    const bundlePath = join(exportDir, 'innfo-console.bundle.js')

    assert.equal(existsSync(htmlPath), true, 'HTML artifact was generated')
    assert.equal(existsSync(bundlePath), true, 'innfo-console.bundle.js vendored alongside HTML')

    const htmlContent = await readFile(htmlPath, 'utf-8')
    assert.match(htmlContent, /<script type="application\/json" id="innfo-config">/)
    assert.match(htmlContent, /<script type="application\/json" id="innfo-schema">/)
    assert.match(htmlContent, /<script type="application\/json" id="innfo-model">/)
    assert.match(htmlContent, /id="innfo-tab-review"/)
  })

  it('hydrates Level 1 primitives and Review tab offline in JSDOM without remote network requests', async () => {
    await runCli([tempDir, '--all'])

    const htmlPath = join(
      tempDir,
      'export',
      'business_V_1-0-0_console',
      'business_V_1-0-0_console.html',
    )
    const bundlePath = join(
      tempDir,
      'export',
      'business_V_1-0-0_console',
      'innfo-console.bundle.js',
    )

    const html = await readFile(htmlPath, 'utf-8')
    const bundleJs = await readFile(bundlePath, 'utf-8')

    // Hydrate in isolated JSDOM simulating offline file:// load
    const dom = new JSDOM(html, {
      url: 'http://localhost',
      runScripts: 'outside-only',
    })

    // Execute vendored bundle directly in DOM window
    const mm = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    dom.window.matchMedia = mm
    dom.window.eval('var matchMedia = window.matchMedia;' + bundleJs)

    const doc = dom.window.document
    dom.window.InnfoConsole.boot(doc)

    // Verify banner and reviewer chip
    const banner = doc.getElementById('innfo-banner')
    assert.ok(banner)
    assert.match(banner.textContent, /Offline Business Model/)
    const reviewerChip = banner.querySelector('.innfo-reviewer-chip')
    assert.ok(reviewerChip, 'Reviewer profile chip rendered in banner')
    assert.match(reviewerChip.textContent, /reviewer/)

    // Verify concept rail
    const rail = doc.getElementById('innfo-rail')
    assert.ok(rail)
    const railItems = rail.querySelectorAll('.innfo-rail-item')
    assert.ok(railItems.length >= 2, 'Concept rail rendered concept items')

    // Verify element cards
    const content = doc.getElementById('innfo-content')
    assert.ok(content)
    const cards = content.querySelectorAll('.innfo-card')
    assert.ok(cards.length >= 2, 'Element cards rendered')

    // Verify tabs navigation
    const tabsNav = doc.getElementById('innfo-view-tabs')
    assert.ok(tabsNav)
    const reviewTabBtn = tabsNav.querySelector('[data-tab="review"]')
    assert.ok(reviewTabBtn, 'Review tab button rendered in view tabs navigation')
  })
})
