import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const runtimePath = join(here, '..', 'iNNfo', 'specs', 'bluepriNNts', 'console', 'innfo-runtime.js')
const InnfoConsole = require(runtimePath)

describe('Console Review Workflow & 3-Tier Architecture', () => {
  let dom
  let window
  let document

  beforeEach(() => {
    dom = new JSDOM(`<!doctype html>
<html>
  <head></head>
  <body>
    <header id="innfo-banner"></header>
    <div id="innfo-layout">
      <nav id="innfo-rail"></nav>
      <main>
        <div class="innfo-toolbar">
          <input id="innfo-search" type="search" />
          <button id="innfo-export-open" type="button">Export feedback</button>
        </div>
        <nav id="innfo-view-tabs" class="innfo-view-tabs"></nav>
        <div id="innfo-tab-explorer" class="innfo-tab-panel active">
          <div id="innfo-doc"></div>
          <div id="innfo-content"></div>
          <div id="innfo-matrices"></div>
        </div>
        <div id="innfo-tab-domain" class="innfo-tab-panel"></div>
        <div id="innfo-tab-review" class="innfo-tab-panel"></div>
      </main>
    </div>
  </body>
</html>`, {
      url: 'http://localhost',
    })
    window = dom.window
    document = window.document
    global.window = window
    global.document = document
    global.localStorage = window.localStorage
    window.localStorage.clear()
  })

  afterEach(() => {
    if (window && window.localStorage) {
      window.localStorage.clear()
    }
  })

  describe('Phase 1: Reviewer Identity & UI Tokens', () => {
    it('defaults reviewer name to "reviewer" when localStorage is empty', () => {
      assert.equal(InnfoConsole.getReviewerName(), 'reviewer')
    })

    it('persists updated reviewer name in localStorage and retrieves it', () => {
      InnfoConsole.setReviewerName('Jane Doe')
      assert.equal(InnfoConsole.getReviewerName(), 'Jane Doe')
      assert.equal(window.localStorage.getItem(InnfoConsole.REVIEWER_STORAGE_KEY), 'Jane Doe')
    })

    it('slugifies reviewer name accurately with underscores', () => {
      assert.equal(InnfoConsole.slugifyReviewer('Jane Doe'), 'jane_doe')
      assert.equal(InnfoConsole.slugifyReviewer('  Dr. John--Smith  '), 'dr_john_smith')
      assert.equal(InnfoConsole.slugifyReviewer(''), 'reviewer')
      assert.equal(InnfoConsole.slugifyReviewer(null), 'reviewer')
    })

    it('generates standardized review filename with dot-to-hyphen version conversion', () => {
      const filename = InnfoConsole.buildReviewFilename('BusinessModel', '1.2.0', 'Jane Doe')
      assert.equal(filename, 'BusinessModel_V_1-2-0_jane_doe_review.json')

      const filenameV = InnfoConsole.buildReviewFilename('BusinessModel', 'V_0-2-5', 'alice')
      assert.equal(filenameV, 'BusinessModel_V_0-2-5_alice_review.json')
    })

    it('parses standardized review filename into parts', () => {
      const parsed = InnfoConsole.parseReviewFilename('BusinessModel_V_1-2-0_jane_doe_review.json')
      assert.deepEqual(parsed, {
        model: 'BusinessModel',
        version: '1-2-0',
        reviewer: 'jane_doe',
      })
      assert.equal(InnfoConsole.parseReviewFilename('invalid_file.json'), null)
    })

    it('renders Level 1 ConceptPill and ElementPill primitives', () => {
      const conceptPill = InnfoConsole.renderConceptPill('Problems', 5, '#ef4444')
      assert.ok(conceptPill)
      assert.equal(conceptPill.className, 'innfo-concept-pill')
      assert.match(conceptPill.textContent, /Problems/)
      assert.match(conceptPill.textContent, /5/)

      const elementPill = InnfoConsole.renderElementPill({ id: 'el-1', name: 'Ghost Trap' }, {}, [
        { origin: 'human' },
      ])
      assert.ok(elementPill)
      assert.match(elementPill.className, /innfo-element-pill/)
      assert.match(elementPill.textContent, /Ghost Trap/)
    })

    it('renders reviewer chip in header banner with inline edit support', () => {
      InnfoConsole.setReviewerName('Alice')
      InnfoConsole.renderBanner(document, { title: 'Ghostbusters', modelVersion: 'V_0-2-1' }, ['concept-rail'], 0)

      const banner = document.getElementById('innfo-banner')
      const chip = banner.querySelector('.innfo-reviewer-chip')
      assert.ok(chip, 'Reviewer chip exists in banner')
      assert.match(chip.querySelector('.innfo-reviewer-name').textContent, /Alice/)
      assert.ok(chip.querySelector('.innfo-reviewer-edit'), 'Edit trigger exists in reviewer chip')
    })

    it('renders visual review badges on cards and concept rail', () => {
      const elements = [
        { id: 'prob-1', name: 'Infestation', concept: 'Problems' },
        { id: 'sol-1', name: 'Proton Pack', concept: 'Solutions' },
      ]
      const drafts = [
        { id: 'fb-001', elementId: 'prob-1', concept: 'Problems', status: 'pending', note: 'Fix severity' },
        { id: 'fb-002', elementId: 'prob-1', concept: 'Problems', status: 'pending', note: 'Add citation' },
      ]

      InnfoConsole.renderCards(document, elements, drafts, () => {})
      const card = document.getElementById('prob-1')
      const cardBadge = card.querySelector('.innfo-card-badge')
      assert.ok(cardBadge, 'Card review badge rendered for element with draft comments')
      assert.equal(cardBadge.textContent, '2')

      const railCounts = { Problems: 1, Solutions: 1 }
      const railDraftCounts = { Problems: 2, Solutions: 0 }
      InnfoConsole.renderRail(document, [{ name: 'Problems' }, { name: 'Solutions' }], railCounts, railDraftCounts, () => {})

      const rail = document.getElementById('innfo-rail')
      const probItem = rail.querySelector('[data-concept="Problems"]')
      const railBadge = probItem.querySelector('.innfo-rail-badge')
      assert.ok(railBadge, 'Rail review badge rendered on concept with active draft comments')
      assert.equal(railBadge.textContent, '2')

      const solItem = rail.querySelector('[data-concept="Solutions"]')
      assert.equal(solItem.querySelector('.innfo-rail-badge'), null)
    })
  })

  describe('Phase 2: Review Tab & Draft State Management', () => {
    it('manages draft store lifecycle: add, status update, delete, summary', () => {
      const key = 'test-drafts-key'
      window.localStorage.clear()

      // Add comment
      const item1 = InnfoConsole.addDraft(key, {
        elementId: 'prob-1',
        concept: 'Problems',
        elementName: 'Infestation',
        kind: 'correction',
        field: 'severity',
        note: 'Change to high',
        status: 'pending',
      })
      assert.equal(item1.id, 'fb-001')
      assert.equal(item1.kind, 'correction')
      assert.equal(item1.status, 'pending')

      const item2 = InnfoConsole.addDraft(key, {
        elementId: 'sol-1',
        concept: 'Solutions',
        kind: 'comment',
        note: 'Review pricing',
        status: 'pending',
      })
      assert.equal(item2.id, 'fb-002')

      // Summary aggregation
      let drafts = JSON.parse(window.localStorage.getItem(key))
      let summary = InnfoConsole.getDraftSummary(drafts)
      assert.deepEqual(summary, {
        total: 2,
        corrections: 1,
        comments: 1,
        pending: 2,
        applied: 0,
        rejected: 0,
      })

      // Update status
      InnfoConsole.updateDraftStatus(key, 'fb-001', 'applied')
      drafts = JSON.parse(window.localStorage.getItem(key))
      summary = InnfoConsole.getDraftSummary(drafts)
      assert.equal(summary.applied, 1)
      assert.equal(summary.pending, 1)

      // Remove comment
      InnfoConsole.removeDraftItem(key, 'fb-002')
      drafts = JSON.parse(window.localStorage.getItem(key))
      assert.equal(drafts.length, 1)
      assert.equal(drafts[0].id, 'fb-001')
    })

    it('renders Universal Review Tab aggregating session notes and item counters', () => {
      const state = {
        modelTitle: 'BusinessModel',
        modelVersion: 'V_1-2-0',
        draftKey: 'test-review-tab-key',
      }
      InnfoConsole.addDraft(state.draftKey, {
        elementId: 'ent-tier',
        concept: 'RevenueStream',
        elementName: 'Enterprise Tier',
        kind: 'correction',
        field: 'pricing',
        note: 'Updated seat minimum to 50',
        status: 'pending',
      })
      InnfoConsole.addDraft(state.draftKey, {
        elementId: 'self-serve',
        concept: 'RevenueStream',
        elementName: 'Self Serve',
        kind: 'comment',
        note: 'Verify monthly billing option',
        status: 'pending',
      })

      InnfoConsole.renderReviewTab(document, state, { needs: [] })

      const reviewTab = document.getElementById('innfo-tab-review')
      assert.ok(reviewTab)
      assert.match(reviewTab.textContent, /Review Summary/)
      assert.match(reviewTab.textContent, /Total Notes/)

      const items = reviewTab.querySelectorAll('.innfo-review-item')
      assert.equal(items.length, 2)
      assert.match(items[0].textContent, /Updated seat minimum to 50/)
      assert.match(items[1].textContent, /Verify monthly billing option/)

      const linkBtn = items[0].querySelector('.innfo-review-card-link')
      assert.ok(linkBtn, 'Deep link button exists for review item')
      assert.match(linkBtn.textContent, /Enterprise Tier/)
    })

    it('deep-links from Review Tab to focus and highlight corresponding Element Card', () => {
      // Setup elements in explorer view
      const elements = [
        { id: 'ent-tier', name: 'Enterprise Tier', concept: 'RevenueStream' },
      ]
      InnfoConsole.renderCards(document, elements, [], () => {})
      const card = document.getElementById('ent-tier')
      let scrolled = false
      card.scrollIntoView = () => { scrolled = true }

      InnfoConsole.focusElementCard(document, 'ent-tier')

      assert.equal(scrolled, true, 'scrollIntoView was invoked on target card')
      assert.ok(card.classList.contains('innfo-highlight'), 'Card received highlight animation class')
    })

    it('dynamically injects review tab container when hydrating legacy shell lacking markup', () => {
      // Minimal shell without #innfo-tab-review or #innfo-view-tabs
      const legacyDom = new JSDOM(`<!doctype html><html><body><main><div id="innfo-content"></div></main></body></html>`)
      const legDoc = legacyDom.window.document

      InnfoConsole.renderViewTabs(legDoc, { needs: [] }, { elements: [{ id: 'a', name: 'A' }] }, { title: 'Legacy' }, { draftKey: 'k' })

      const injectedTabs = legDoc.getElementById('innfo-view-tabs')
      assert.ok(injectedTabs, 'dynamically injected view tabs nav into legacy shell')
      const injectedReview = legDoc.getElementById('innfo-tab-review')
      assert.ok(injectedReview, 'dynamically injected review tab panel into legacy shell')
    })
  })

  describe('Phase 3: Export & Filename Standard', () => {
    it('serializes review doc according to console-review-v1.json schema', () => {
      const doc = InnfoConsole.buildReviewDoc({
        model: 'BusinessModel',
        version: '1.2.0',
        reviewer: 'jane_doe',
        exportedAt: '2026-09-28T18:00:00Z',
        drafts: [
          {
            id: 'fb-001',
            elementId: 'enterprise-tier',
            concept: 'RevenueStream',
            kind: 'correction',
            field: 'pricing',
            note: 'Updated seat minimum to 50',
            status: 'pending',
          },
        ],
      })

      assert.equal(doc.$schema, 'https://cognntive.dev/schemas/console-review-v1.json')
      assert.equal(doc.model, 'BusinessModel')
      assert.equal(doc.version, '1-2-0')
      assert.equal(doc.reviewer, 'jane_doe')
      assert.equal(doc.exportedAt, '2026-09-28T18:00:00Z')
      assert.deepEqual(doc.summary, {
        total: 1,
        corrections: 1,
        comments: 0,
      })
      assert.equal(doc.items.length, 1)
      assert.equal(doc.items[0].id, 'fb-001')
      assert.equal(doc.items[0].elementId, 'enterprise-tier')
      assert.equal(doc.items[0].field, 'pricing')
      assert.equal(doc.items[0].note, 'Updated seat minimum to 50')

      const validation = InnfoConsole.validateReviewDoc(doc)
      assert.equal(validation.ok, true)
      assert.deepEqual(validation.errors, [])
    })

    it('rejects invalid review documents with descriptive errors', () => {
      const invalid = {
        model: '',
        version: '1-0-0',
        reviewer: 'jane',
        exportedAt: 'not-a-date',
        summary: null,
        items: [{ id: 'invalid-id', kind: 'unknown', status: 'unknown' }],
      }
      const validation = InnfoConsole.validateReviewDoc(invalid)
      assert.equal(validation.ok, false)
      assert.ok(validation.errors.length > 0)
    })
  })
})
