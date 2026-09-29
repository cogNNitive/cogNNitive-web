// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * DOM-level contract of the generated console, previously asserted by the
 * Playwright suite `innfo-editor/e2e/16-innfo-console.spec.ts` (deleted).
 *
 * That suite drove a real Chromium, so nothing ran it: Playwright was never
 * wired into CI. Most of what it checked was pure logic reached through
 * `page.evaluate` — `buildExportDoc`, `validateFeedback`,
 * `buildFeedbackFilename`, `parseFeedbackFilename`, `checkStaleness` — and all
 * of that already has gated coverage in `console-feedback.test.ts`,
 * `console-export-naming.test.ts`, `console-runtime.test.ts` and
 * nn-trannsform's `test-scanner.js`. Duplicating it here would add no signal.
 *
 * What had NO gated coverage is the DOM wiring below: that booting the runtime
 * against the shell's slots actually paints a banner, rail and cards, that
 * the search box filters the rendered cards (not just `filterElements`), and
 * that the export button refuses to emit a file until an identifier is typed.
 * The runtime is UMD and guards its own auto-boot, so happy-dom is enough —
 * no browser needed.
 */

const req = createRequire(import.meta.url)
const consoleDir = join(import.meta.dirname!, '..', '..', '..', 'specs', 'templates', 'console')

type ConsoleApi = {
  boot: (doc: Document) => void
  getDraftKey: (model: string, version: string) => string
}

const schemaFixture = { concepts: [{ name: 'Goal' }, { name: 'Metric' }] }
const modelFixture = {
  meta: { title: 'Acme', modelVersion: 'V_0-1-0' },
  elements: [
    {
      id: 'goal-grow',
      concept: 'Goal',
      name: 'Grow',
      description: 'Grow the business',
      fields: { owner: 'Reviewer' },
    },
    {
      id: 'metric-churn',
      concept: 'Metric',
      name: 'Churn',
      description: 'Monthly logo churn',
      fields: {},
    },
  ],
  matrices: [],
}

/**
 * Fills the shipped shell's JSON slots and drops its `<script src>` tags.
 * The runtime is loaded through `require` instead, so leaving the tags in only
 * makes happy-dom attempt (and fail) real network fetches.
 */
function renderShell(): void {
  const shell = readFileSync(join(consoleDir, 'artifact_shell.html'), 'utf8')
  const filled = shell
    .replace(
      /(<script type="application\/json" id="innfo-schema">)[\s\S]*?(<\/script>)/,
      `$1${JSON.stringify(schemaFixture)}$2`,
    )
    .replace(
      /(<script type="application\/json" id="innfo-model">)[\s\S]*?(<\/script>)/,
      `$1${JSON.stringify(modelFixture)}$2`,
    )
    .replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '')
  document.documentElement.innerHTML = filled
}

function bootConsole(): ConsoleApi {
  const api = req(join(consoleDir, 'innfo-runtime.js')) as ConsoleApi
  api.boot(document)
  return api
}

function typeInto(selector: string, value: string): void {
  const input = document.querySelector(selector) as HTMLInputElement
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('innfo-console — rendered DOM', () => {
  beforeEach(() => {
    renderShell()
  })

  it('paints the banner, concept rail and one card per element from the slots', () => {
    bootConsole()

    const banner = document.getElementById('innfo-banner')!.textContent ?? ''
    expect(banner).toContain('Acme')
    expect(banner).toContain('V_0-1-0')

    const rail = [...document.querySelectorAll('.innfo-rail-item')].map((n) => n.textContent ?? '')
    expect(rail.join(' ')).toContain('Goal')
    expect(rail.join(' ')).toContain('Metric')

    const titles = [...document.querySelectorAll('.innfo-card h3')].map((n) => n.textContent)
    expect(titles).toEqual(['Grow', 'Churn'])
  })

  it('filters the rendered cards as the reviewer types, and restores them when cleared', () => {
    bootConsole()

    typeInto('#innfo-search', 'grow')
    expect([...document.querySelectorAll('.innfo-card h3')].map((n) => n.textContent)).toEqual([
      'Grow',
    ])

    // Matching runs over description text too, not just the element name.
    typeInto('#innfo-search', 'monthly logo')
    expect([...document.querySelectorAll('.innfo-card h3')].map((n) => n.textContent)).toEqual([
      'Churn',
    ])

    typeInto('#innfo-search', 'zzz-no-match')
    expect(document.querySelectorAll('.innfo-card')).toHaveLength(0)

    typeInto('#innfo-search', '')
    expect(document.querySelectorAll('.innfo-card')).toHaveLength(2)
  })
})

describe('innfo-console — export gate', () => {
  let downloads: string[]
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    renderShell()
    downloads = []
    // The runtime downloads by creating an <a download=...> and clicking it.
    // Capturing the click is the only seam; `downloads` staying empty is what
    // "the gate held" looks like, so every test also asserts the positive case
    // below — otherwise a runtime that stopped using an anchor would make this
    // spy silently stop intercepting and the gate tests would pass vacuously.
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        if (this.download) downloads.push(this.download)
      })
    globalThis.URL.createObjectURL = () => 'blob:stub'
    globalThis.URL.revokeObjectURL = () => {}
  })

  afterEach(() => {
    clickSpy.mockRestore()
    localStorage.clear()
  })

  it('refuses to emit a file until an identifier is entered', () => {
    bootConsole()

    document.getElementById('innfo-export-open')!.dispatchEvent(new Event('click', { bubbles: true }))
    const download = document.querySelector('#innfo-export-modal [data-innfo="download"]')!

    download.dispatchEvent(new Event('click', { bubbles: true }))
    expect(downloads).toEqual([])

    // Whitespace is not an identifier either.
    typeInto('#innfo-export-modal [data-innfo="identifier"]', '   ')
    download.dispatchEvent(new Event('click', { bubbles: true }))
    expect(downloads).toEqual([])
  })

  it('emits a file named by the feedback contract once an identifier is entered', () => {
    const api = bootConsole()
    localStorage.setItem(
      api.getDraftKey('Acme', 'V_0-1-0'),
      JSON.stringify([
        {
          id: 'fb-001',
          kind: 'comment',
          target: { element_id: 'goal-grow' },
          comment: 'Clarify the owner field',
          status: 'pending',
        },
      ]),
    )

    document.getElementById('innfo-export-open')!.dispatchEvent(new Event('click', { bubbles: true }))
    typeInto('#innfo-export-modal [data-innfo="identifier"]', 'Reviewer, primera revisión')
    document
      .querySelector('#innfo-export-modal [data-innfo="download"]')!
      .dispatchEvent(new Event('click', { bubbles: true }))

    expect(downloads).toHaveLength(1)
    expect(downloads[0]).toMatch(
      /^Acme_V_0-1-0_reviewer-primera-revision_feedback_\d{8}-\d{6}\.json$/,
    )
  })

  it('reports the pending draft count in the modal instructions', () => {
    const api = bootConsole()
    localStorage.setItem(
      api.getDraftKey('Acme', 'V_0-1-0'),
      JSON.stringify([
        { id: 'fb-001', kind: 'comment', target: { element_id: 'goal-grow' }, status: 'pending' },
        { id: 'fb-002', kind: 'comment', target: { element_id: 'metric-churn' }, status: 'pending' },
      ]),
    )

    document.getElementById('innfo-export-open')!.dispatchEvent(new Event('click', { bubbles: true }))

    expect(
      document.querySelector('#innfo-export-modal [data-innfo="instructions"]')!.textContent,
    ).toContain('2 pending draft(s)')
  })
})
