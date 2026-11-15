import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import registry from '../scripts/lib/field-registry.generated.json' with { type: 'json' }

const source = readFileSync(new URL('../../../assets/console-view-conntent.js', import.meta.url), 'utf8')

function fixture({ emptyEpisode = false } = {}) {
  const dom = new JSDOM('<div id="view"></div>', { runScripts: 'outside-only' })
  const { window } = dom
  window.HTMLMediaElement.prototype.pause = function () {}
  window.eval(readFileSync(new URL('../../../../console/ui-kit.js', import.meta.url), 'utf8'))
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')) }
  const views = []
  window.registerView = (view) => views.push(view)
  window.eval(source)
  const drafts = []
  const listeners = new Set()
  const episode = (slug) => ({
    slug, title: 'Episode ' + slug, status: 'draft', knowledgeId: slug,
    elementId: slug + '@video', recordFields: { title: 'Episode ' + slug, output_formats: ['1920x1920'] },
    fields: { voice: { value: 'episode-voice', source: 'video' } },
    sceneKinds: ['Libre', 'Explainer'], availablePresets: ['Studio Warm'],
    reviewGates: ['script'], gates: [{ gate: 'script', scene: 'shared', state: 'open' }],
    scenes: [{ slug: 'shared', name: 'Shared scene', elementId: slug + '@shared',
      narration: 'Narration for ' + slug, scriptHash: 'hash-' + slug,
      recordFields: { kind: 'Libre', voice_speed: '1.2', description: 'Narration for ' + slug },
      still: slug + '/still.png', video: slug + '/scene.mp4', audio: slug + '/voice.mp3',
      gates: [{ gate: 'script', state: 'open' }],
      layers: [{ slug: 'title', name: 'Title layer', type: 'text', elementId: slug + '@title', recordFields: { type: 'text', text: 'Caption' }, fields: {} }],
      sources: [], fields: { voice_speed: { value: '1.2', source: 'scene' } } }],
    deliveries: [],
  })
  const episodes = [episode('one'), episode('two')]
  if (emptyEpisode) episodes[0].scenes = []
  const container = window.document.getElementById('view')
  const mounted = views[0].mount({ container, ui: window.nnUI, payload: { model: { meta: {} } },
    viewData: { tree: { series: [{ slug: 'series', title: 'Test series', episodes }] },
      pending: episodes.map(e => ({ series: 'series', episode: e.slug, gate: 'script', scene: 'shared', state: 'open' })),
      fieldDefinitions: registry.fields },
    store: { drafts: () => drafts,
      propose: (draft) => { drafts.push(draft); listeners.forEach(fn => fn()) },
      onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn) } },
  })
  return { dom, container, drafts, listeners, mounted }
}

function click(container, label) {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === label)
  assert.ok(button, 'Missing button: ' + label)
  button.click()
}

test('dashboard selects an episode, filters the list and exposes scene media', () => {
  const { container, dom } = fixture()
  assert.match(container.textContent, /Your production at a glance/)
  assert.equal(container.querySelector('[data-nn-section="episode"]').hidden, true)
  click(container, 'Episodes')
  const search = container.querySelector('input[aria-label="Search episodes or series"]')
  search.value = 'two'
  search.dispatchEvent(new dom.window.Event('input'))
  const list = search.closest('section')
  assert.equal(list.querySelectorAll('.nn-pipeline-row').length, 1)
  click(list, 'Open episode')
  click(container, 'Script & review')
  const cards = container.querySelectorAll('[data-nn-episode-config]')
  assert.equal(cards[0].hidden, true)
  assert.equal(cards[1].hidden, false)
  assert.equal(cards[1].querySelector('.nn-review-media video'), null, 'scene media uses the thumbnail zoom only')
  const help = cards[1].querySelector('.nn-setting-help')
  assert.equal(help.open, false, 'field guidance starts collapsed')
  assert.ok(help.querySelector('summary[aria-label^="Information about"]'))
  assert.ok(cards[1].querySelector('.nn-source-from[data-nn-source-from]'))
  assert.equal(cards[1].querySelector('audio').getAttribute('src'), 'two/voice.mp3')
  assert.equal(cards[1].querySelector('[data-nn-subsection="config"]').hidden, true)
  container.querySelector('button[aria-pressed="false"]').parentNode.querySelectorAll('button')[2].click()
  assert.equal(cards[1].querySelector('[data-nn-subsection="script"]').hidden, true)
  assert.equal(cards[1].querySelector('[data-nn-subsection="config"]').hidden, false)
  dom.window.close()
})

test('a review proposal updates only its episode and appears in shared Changes', () => {
  const { container, drafts, listeners, mounted, dom } = fixture()
  click(container, 'Episodes')
  const rows = container.querySelectorAll('.nn-pipeline-workspace > section .nn-pipeline-row')
  const target = [...rows].find(row => row.textContent.includes('Episode two') && [...row.querySelectorAll('button')].some(b => b.textContent === 'Open episode'))
  click(target, 'Open episode')
  click(container, 'Script & review')
  const cards = container.querySelectorAll('[data-nn-episode-config]')
  click(cards[1], 'Approve')
  assert.equal(drafts[0].elementId, 'two@shared')
  assert.equal(drafts[0].reviewed_hash, 'hash-two')
  assert.equal(cards[1].querySelector('[data-nn-verdict-pill]').textContent, 'Approval proposed')
  assert.equal(cards[0].querySelector('[data-nn-verdict-pill]').textContent, 'open')
  click(container, 'Changes (1)')
  assert.match(container.textContent, /Proposed · not applied/)
  mounted.unmount()
  assert.equal(listeners.size, 0)
  dom.window.close()
})

test('lightbox plays the scene video even when a still exists', () => {
  const { container, dom } = fixture()
  container.querySelector('[data-nn-media-open]').click()
  const lightbox = dom.window.document.querySelector('.nn-lightbox')
  assert.equal(lightbox.querySelector('video').getAttribute('src'), 'one/scene.mp4')
  assert.equal(lightbox.querySelector('video').getAttribute('poster'), 'one/still.png')
  lightbox.querySelector('button').click()
  assert.equal(dom.window.document.querySelector('.nn-lightbox'), null)
  dom.window.close()
})

test('every declared scene, layer and episode field is reachable, including unset fields', () => {
  const { container, dom } = fixture()
  for (const concept of ['Scene', 'Layer', 'Video']) {
    const settings = container.querySelector('[data-nn-settings="' + concept + '"]')
    const names = new Set([...settings.querySelectorAll('[data-nn-setting]')].map(row => row.getAttribute('data-nn-setting')))
    for (const [name, definition] of Object.entries(registry.fields)) {
      if (definition.concepts.includes(concept) || definition.concepts.includes('*')) {
        assert.ok(names.has(name), concept + ' is missing ' + name)
        assert.equal(!!settings.querySelector('[data-nn-edit-setting="' + name + '"]'),
          !['review', 'master', 'delivered_version'].includes(name), concept + ' editing policy for ' + name)
      }
    }
  }
  const scene = container.querySelector('[data-nn-settings="Scene"]')
  click(scene, 'Edit kind')
  const modal = dom.window.document.querySelector('[data-nn-setting-editor="kind"]')
  const select = modal.querySelector('select')
  assert.deepEqual([...select.options].map(o => o.value), ['', 'Libre', 'Explainer'])
  select.value = 'Explainer'
  click(modal, 'Save draft')
  assert.match(scene.querySelector('[data-nn-setting="kind"]').textContent, /Explainer.*Proposed/s)
  dom.window.close()
})

test('scalar, list and layer edits target their own elements in the shared store', () => {
  const { container, dom, drafts } = fixture()
  const episode = container.querySelector('[data-nn-settings="Video"]')
  const scene = container.querySelector('[data-nn-settings="Scene"]')
  const layer = container.querySelector('[data-nn-settings="Layer"]')
  assert.match(episode.querySelector('[data-nn-setting="voice"]').textContent, /episode-voice/)
  click(scene, 'Edit image_size')
  let modal = dom.window.document.querySelector('[data-nn-setting-editor]')
  modal.querySelector('[data-nn-widget="string"]').value = '1536x1536'
  click(modal, 'Save draft')
  assert.equal(drafts.at(-1).elementId, 'one@shared')
  assert.equal(drafts.at(-1).proposed, '1536x1536')
  click(episode, 'Edit output_formats')
  modal = dom.window.document.querySelector('[data-nn-setting-editor]')
  const input = modal.querySelector('[data-nn="chip-input"]')
  input.value = '1080x1920'
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  click(modal, 'Save draft')
  assert.equal(drafts.at(-1).elementId, 'one@video')
  assert.deepEqual(Array.from(drafts.at(-1).proposed), ['1920x1920', '1080x1920'])
  click(layer, 'Edit text')
  modal = dom.window.document.querySelector('[data-nn-setting-editor]')
  modal.querySelector('textarea').value = 'New overlay'
  click(modal, 'Save draft')
  assert.equal(drafts.at(-1).elementId, 'one@title')
  assert.equal(drafts.at(-1).field, 'text')
  const narration = container.querySelector('[data-nn-scene-narration]')
  narration.value = 'Revised narration'
  narration.dispatchEvent(new dom.window.Event('change'))
  assert.equal(drafts.at(-1).field, 'description')
  dom.window.close()
})

test('declared list editors preserve arrays, allow clearing, and reject new invalid options', () => {
  const { container, dom, drafts } = fixture()
  const settings = container.querySelector('[data-nn-settings="Video"]')
  click(settings, 'Edit review_gates')
  const modal = dom.window.document.querySelector('[data-nn-setting-editor]')
  const input = modal.querySelector('[data-nn="chip-input"]')
  input.value = 'invalid-gate'
  input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter' }))
  click(modal, 'Save draft')
  assert.equal(drafts.length, 0)
  assert.match(modal.querySelector('[role="alert"]').textContent, /Choose a declared option/)
  modal.querySelector('button[aria-label="Remove invalid-gate"]').click()
  click(modal, 'Save draft')
  assert.deepEqual(Array.from(drafts.at(-1).proposed), [])
  dom.window.close()
})

test('an episode without scenes still exposes its own configuration', () => {
  const { container, dom } = fixture({ emptyEpisode: true })
  const card = container.querySelector('[data-nn-episode-config="one"]')
  const config = card.querySelector('[data-nn-subsection="config"]')
  assert.ok(config.querySelector('[data-nn-edit-setting="title"]'))
  assert.ok(config.querySelector('[data-nn-edit-setting="output_formats"]'))
  assert.match(config.querySelector('[data-nn-setting="voice"]').textContent, /episode-voice/)
  dom.window.close()
})


test('hierarchy nests the same editable episode cards under series and preserves layout state', () => {
  const { container, dom } = fixture()
  const cards = [...container.querySelectorAll('[data-nn-episode-config]')]
  click(container, 'Hierarchy')
  const hierarchy = container.querySelector('.nn-pipeline-hierarchy')
  assert.equal(hierarchy.hidden, false)
  assert.equal(container.querySelector('.nn-pipeline-workspace').hidden, true)
  for (const card of cards) {
    assert.ok(card.closest('[data-nn-hierarchy-episode]'))
    assert.ok(card.closest('[data-nn-hierarchy-series]'))
    assert.equal(card.hidden, false)
    assert.equal(card.querySelector('[data-nn-subsection="script"]').hidden, false)
  }
  const branch = cards[0].closest('[data-nn-hierarchy-episode]')
  branch.open = true
  click(branch, 'Configuration')
  assert.equal(cards[0].querySelector('[data-nn-subsection="config"]').hidden, false)
  click(container, 'Dashboard')
  assert.equal(hierarchy.hidden, true)
  assert.ok(cards.every(card => card.parentNode.getAttribute('data-nn-section') === 'episode'))
  click(container, 'Hierarchy')
  assert.equal(branch.open, true)
  assert.equal(cards[0].querySelector('[data-nn-subsection="config"]').hidden, false)
  assert.equal(container.querySelectorAll('[data-nn-episode-config]').length, cards.length)
  dom.window.close()
})
