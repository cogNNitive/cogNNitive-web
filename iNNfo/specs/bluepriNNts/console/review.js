/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ui-kit.js'))
  } else {
    root.InnfoReview = factory(root.InnfoUI)
  }
})(typeof self !== 'undefined' ? self : this, function (UI) {
  'use strict'

  // D5: the kit is a hard dependency; fail loudly rather than degrade silently.
  if (!UI) throw new Error('InnfoUI missing: load ui-kit.js first')

  var STORE_PREFIX = 'innfo-console:v2:'
  var STORE_VERSION = 2
  var BASE_HASH_PATTERN = /^[0-9a-f]{16}$/
  var REVIEW_STATES = ['none', 'reviewed', 'changed']
  var ITEM_KINDS = ['correction', 'comment', 'new', 'delete']

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value))
  }

  function nextDraftId(drafts) {
    var max = 0
    ;(Array.isArray(drafts) ? drafts : []).forEach(function (d) {
      var m = /^fb-(\d+)$/.exec(String((d && d.id) || ''))
      if (m && Number(m[1]) > max) max = Number(m[1])
    })
    return 'fb-' + String(max + 1).padStart(3, '0')
  }

  function normalizeDraft(raw, id) {
    var d = isObject(raw) ? raw : {}
    var draft = {
      id: id || (typeof d.id === 'string' ? d.id : ''),
      element_id: d.element_id != null ? String(d.element_id) : '',
      concept: d.concept != null ? String(d.concept) : '',
      element: d.element != null ? String(d.element) : '',
      base_hash: d.base_hash != null ? String(d.base_hash) : '',
      kind: ITEM_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'comment',
      created_at: d.created_at != null ? String(d.created_at) : null,
    }
    if (d.field !== undefined && d.field !== null) draft.field = String(d.field)
    if (d.original !== undefined) draft.original = d.original
    if (d.proposed !== undefined) draft.proposed = d.proposed
    if (d.comment !== undefined && d.comment !== null) draft.comment = String(d.comment)
    return draft
  }

  function createMemoryStorage() {
    var map = {}
    return {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null
      },
      setItem: function (k, v) {
        map[k] = String(v)
      },
      removeItem: function (k) {
        delete map[k]
      },
    }
  }

  function resolveStorage(storage) {
    if (!storage) return { storage: createMemoryStorage(), persistent: false }
    try {
      storage.getItem(STORE_PREFIX + '__probe__')
      return { storage: storage, persistent: true }
    } catch {
      return { storage: createMemoryStorage(), persistent: false }
    }
  }

  function createDraftStore(storage, modelId) {
    var resolved = resolveStorage(storage)
    var backing = resolved.storage
    var persistent = resolved.persistent
    var key = STORE_PREFIX + String(modelId == null ? '' : modelId)

    function read() {
      var raw
      try {
        raw = backing.getItem(key)
      } catch {
        return { v: STORE_VERSION, modelId: modelId, drafts: [], reviewed: {} }
      }
      if (!raw) return { v: STORE_VERSION, modelId: modelId, drafts: [], reviewed: {} }
      var parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return { v: STORE_VERSION, modelId: modelId, drafts: [], reviewed: {} }
      }
      if (!isObject(parsed) || parsed.v !== STORE_VERSION) {
        return { v: STORE_VERSION, modelId: modelId, drafts: [], reviewed: {} }
      }
      if (String(parsed.modelId) !== String(modelId)) {
        return { v: STORE_VERSION, modelId: modelId, drafts: [], reviewed: {} }
      }
      var drafts = Array.isArray(parsed.drafts)
        ? parsed.drafts.map(function (d) {
            return normalizeDraft(d)
          })
        : []
      var reviewed = isObject(parsed.reviewed) ? {} : {}
      if (isObject(parsed.reviewed)) {
        Object.keys(parsed.reviewed).forEach(function (id) {
          reviewed[id] = String(parsed.reviewed[id])
        })
      }
      return { v: STORE_VERSION, modelId: modelId, drafts: drafts, reviewed: reviewed }
    }

    function write(state) {
      try {
        backing.setItem(key, JSON.stringify(state))
      } catch {
        /* storage full or unavailable; keep the in-memory view */
      }
    }

    var state = read()

    return {
      persistent: persistent,
      key: key,
      drafts: function () {
        return deepCopy(state.drafts)
      },
      reviewed: function () {
        return deepCopy(state.reviewed)
      },
      addDraft: function (input) {
        var raw = isObject(input) ? input : {}
        if (!raw.element_id || !raw.base_hash) {
          throw new TypeError('InnfoReview.createDraftStore: element_id and base_hash required')
        }
        var draft = normalizeDraft(raw, raw.id || nextDraftId(state.drafts))
        state.drafts.push(draft)
        write(state)
        return deepCopy(draft)
      },
      removeDraft: function (id) {
        state.drafts = state.drafts.filter(function (d) {
          return d && d.id !== id
        })
        write(state)
        return deepCopy(state.drafts)
      },
      markReviewed: function (id, hash) {
        state.reviewed[String(id)] = String(hash)
        write(state)
      },
      unmarkReviewed: function (id) {
        delete state.reviewed[String(id)]
        write(state)
      },
    }
  }

  function reviewState(element, reviewed) {
    var el = isObject(element) ? element : {}
    var map = isObject(reviewed) ? reviewed : {}
    if (!Object.prototype.hasOwnProperty.call(map, el.id)) return 'none'
    return map[el.id] === el.hash ? 'reviewed' : 'changed'
  }

  function isTargetChanged(draft, elementsById) {
    var d = isObject(draft) ? draft : {}
    var byId = isObject(elementsById) ? elementsById : {}
    var el = byId[d.element_id]
    if (!el) return true
    return el.hash !== d.base_hash
  }

  function progressByConcept(elements, drafts, reviewed) {
    var list = Array.isArray(elements) ? elements : []
    var draftList = Array.isArray(drafts) ? drafts : []
    var map = isObject(reviewed) ? reviewed : {}
    var out = {}
    list.forEach(function (el) {
      if (!el || !el.concept) return
      if (!out[el.concept]) out[el.concept] = { reviewed: 0, total: 0, pending: 0 }
      out[el.concept].total++
      if (map[el.id] === el.hash) out[el.concept].reviewed++
    })
    draftList.forEach(function (d) {
      if (!d) return
      var concept = d.concept || (d.target && d.target.concept)
      if (!concept || !out[concept]) return
      out[concept].pending++
    })
    return out
  }

  function verdictsByElement(feedbackState, elementsById) {
    var entries = Array.isArray(feedbackState) ? feedbackState : []
    var byId = isObject(elementsById) ? elementsById : {}
    var out = {}
    entries.forEach(function (entry) {
      if (!isObject(entry)) return
      var elId = entry.element_id
      if (!elId || !byId[elId]) return
      var status = entry.status
      if (!status) return
      if (!out[elId]) out[elId] = {}
      out[elId][status] = (out[elId][status] || 0) + 1
    })
    return out
  }

  function changedIds(elements, reviewed) {
    var list = Array.isArray(elements) ? elements : []
    var map = isObject(reviewed) ? reviewed : {}
    var out = []
    list.forEach(function (el) {
      if (!el) return
      if (!Object.prototype.hasOwnProperty.call(map, el.id)) return
      if (map[el.id] !== el.hash) out.push(el.id)
    })
    return out
  }

  function canReview(meta, elements, needs) {
    var m = isObject(meta) ? meta : {}
    var list = Array.isArray(elements) ? elements : []
    var declared = Array.isArray(needs) ? needs.indexOf('feedback-export') !== -1 : false
    if (!declared) return false
    if (typeof m.modelId !== 'string' || !m.modelId.trim()) return false
    if (list.length === 0) return false
    var allHashed = list.every(function (el) {
      return el && typeof el.hash === 'string' && BASE_HASH_PATTERN.test(el.hash)
    })
    return allHashed
  }

  function draftToItem(draft) {
    var d = isObject(draft) ? draft : {}
    var target = {
      element_id: String(d.element_id || ''),
      concept: String(d.concept || ''),
      element: String(d.element || ''),
    }
    if (d.field !== undefined && d.field !== null) target.field = String(d.field)
    var item = {
      id: typeof d.id === 'string' && d.id ? d.id : 'fb-001',
      kind: ITEM_KINDS.indexOf(d.kind) !== -1 ? d.kind : 'comment',
      target: target,
    }
    if (d.original !== undefined) item.original = d.original
    if (d.proposed !== undefined) item.proposed = d.proposed
    if (d.comment !== undefined && d.comment !== null) item.comment = String(d.comment)
    item.base_hash = String(d.base_hash || '')
    return item
  }

  // ---- Review controller (Slice 2) ----

  function makeEl(doc, tag, cls, text) {
    var node = doc.createElement(tag)
    if (cls) node.className = cls
    if (text != null) node.textContent = String(text)
    return node
  }

  function createReviewController(doc, opts) {
    var options = isObject(opts) ? opts : {}
    var meta = isObject(options.meta) ? options.meta : {}
    var elements = Array.isArray(options.elements) ? options.elements : []
    var needs = Array.isArray(options.needs) ? options.needs : []
    var store = options.store
    var elementsById = {}
    elements.forEach(function (el) {
      if (el && el.id) elementsById[el.id] = el
    })

    var enabled = false
    var toggleEl = null
    var openPopover = null
    var lastAnchor = null

    function html() {
      return doc.documentElement
    }

    function closePopover() {
      if (openPopover && openPopover.parentNode) openPopover.parentNode.removeChild(openPopover)
      openPopover = null
    }

    function saveDraft(anchorData, payload) {
      if (!store) return
      var el = elementsById[anchorData.elementId]
      if (!el) return
      var draft = {
        element_id: anchorData.elementId,
        concept: el.concept,
        element: el.name || el.id,
        base_hash: el.hash,
        kind: payload.kind,
      }
      if (payload.field !== undefined || anchorData.field) {
        draft.field = payload.field !== undefined ? payload.field : anchorData.field
        draft.original =
          payload.original !== undefined
            ? payload.original
            : el.fields
              ? el.fields[anchorData.field]
              : undefined
        if (payload.proposed !== undefined) draft.proposed = payload.proposed
      }
      if (payload.comment !== undefined && payload.comment !== null) {
        draft.comment = String(payload.comment)
      }
      store.addDraft(draft)
      refreshCount()
    }

    function refreshCount() {
      if (!doc.querySelector) return
      var counter = doc.querySelector('[data-innfo="draft-count"]')
      if (counter && store) {
        var n = store.drafts().length
        counter.textContent = counter.textContent.replace(/drafts:\s*\d+/, 'drafts: ' + n)
      }
      applyDecorations()
    }

    // Resolve an anchor to a KU-modal target. Returns null when the anchor is
    // not modal-editable (card comments, tag/relation proposals use popovers
    // or immediate comment drafts instead).
    function kuModalTarget(anchorData) {
      var el = elementsById[anchorData.elementId]
      if (!el || typeof UI.EditModal !== 'function') return null
      var base = {
        citations: Array.isArray(el.citations) ? el.citations : [],
        history: Array.isArray(el.history) ? el.history : [],
      }
      if (anchorData.relRetarget) {
        return {
          title: 'Retarget ' + (el.name || anchorData.elementId) + ' \u2192 ' + anchorData.relField,
          fieldName: anchorData.relField,
          type: 'reference',
          value: anchorData.relTarget,
          candidates: elements,
          draftField: anchorData.relField,
          original: anchorData.relTarget,
          citations: base.citations,
          history: base.history,
        }
      }
      var field = anchorData.field
      if (!field) return null
      if (field === '__name') {
        return {
          title: 'Edit ' + (el.name || anchorData.elementId) + ' \u2192 name',
          fieldName: 'name',
          type: 'string',
          value: el.name,
          draftField: 'name',
          original: el.name,
          citations: base.citations,
          history: base.history,
        }
      }
      if (field === '__description') {
        return {
          title: 'Edit ' + (el.name || anchorData.elementId) + ' \u2192 description',
          fieldName: 'description',
          type: 'markdown',
          value: el.description,
          draftField: 'description',
          original: el.description,
          citations: base.citations,
          history: base.history,
        }
      }
      if (field.indexOf('marker:') === 0) {
        var markerId = field.slice('marker:'.length)
        var markers = el.markers || {}
        return {
          title: 'Edit ' + (el.name || anchorData.elementId) + ' \u2192 marker ' + markerId,
          fieldName: field,
          type: 'string',
          value: markers[markerId],
          draftField: field,
          original: markers[markerId],
          citations: base.citations,
          history: base.history,
        }
      }
      var fieldVal = el.fields ? el.fields[field] : undefined
      var schemaField = null
      if (options.schema && Array.isArray(options.schema.fields)) {
        schemaField = options.schema.fields.filter(function (f) {
          return f.name === field
        })[0]
      }
      var fieldType =
        schemaField && schemaField.type
          ? schemaField.type
          : typeof fieldVal === 'number'
            ? 'number'
            : typeof fieldVal === 'boolean'
              ? 'boolean'
              : 'string'
      return {
        title: 'Edit ' + (el.name || anchorData.elementId) + ' \u2192 ' + field,
        fieldName: field,
        type: fieldType,
        value: fieldVal,
        options: schemaField ? schemaField.options : undefined,
        candidates:
          schemaField && (schemaField.type === 'reference' || fieldType === 'reference')
            ? elements
            : undefined,
        draftField: field,
        original: fieldVal,
        citations: base.citations.filter(function (c) {
          return !c.field || c.field === field
        }),
        history: base.history,
      }
    }

    function openModalFor(anchorData, target) {
      var modal = UI.EditModal(
        {
          title: target.title,
          fieldName: target.fieldName,
          type: target.type,
          value: target.value,
          options: target.options,
          candidates: target.candidates,
          citations: target.citations,
          history: target.history,
          isComment: false,
        },
        {
          doc: doc,
          onSave: function (res) {
            if (res.isComment) {
              saveDraft(anchorData, { kind: 'comment', comment: res.comment })
            } else {
              saveDraft(anchorData, {
                kind: 'correction',
                field: target.draftField,
                original: target.original,
                proposed: res.proposed,
                comment: res.comment,
              })
            }
            closePopover()
          },
          onCancel: function () {
            closePopover()
            if (lastAnchor && typeof lastAnchor.focus === 'function') lastAnchor.focus()
          },
        },
      )
      doc.body.appendChild(modal)
      openPopover = modal
      if (typeof modal.showModal === 'function') {
        modal.showModal()
      } else {
        modal.setAttribute('open', 'open')
      }
    }

    function openFor(anchor, anchorData) {
      closePopover()
      lastAnchor = anchor

      // Tag / relation membership has no core draft op yet: record proposals
      // as comment drafts (never auto-applied corrections).
      if (anchorData.tagRemove) {
        saveDraft(anchorData, {
          kind: 'comment',
          field: 'tags',
          comment: 'Propose removing tag "' + anchorData.tagRemove + '"',
        })
        refreshCount()
        return
      }
      if (anchorData.relUnlink) {
        saveDraft(anchorData, {
          kind: 'comment',
          field: 'relations',
          comment:
            'Propose unlinking ' + anchorData.relField + ' \u2192 ' + anchorData.relUnlink,
        })
        refreshCount()
        return
      }

      var target = kuModalTarget(anchorData)
      if (target) {
        openModalFor(anchorData, target)
        return
      }

      var kinds = anchorData.field ? ['comment', 'correction'] : ['comment', 'delete']
      if (anchorData.tagAdd) kinds = ['comment']
      if (anchorData.relAdd) kinds = ['comment']
      var activeKind = kinds[0]
      var data = {
        kinds: kinds,
        label: anchorData.tagAdd
          ? 'Propose tag'
          : anchorData.relAdd
            ? 'Propose relation'
            : anchorData.field
              ? 'Annotate field'
              : 'Annotate element',
      }
      if (anchorData.field && elementsById[anchorData.elementId]) {
        var el = elementsById[anchorData.elementId]
        data.original = el.fields ? el.fields[anchorData.field] : undefined
      }
      var pop = UI.AnnotationPopover(data, {
        doc: doc,
        onSave: function () {
          var ta = pop.querySelector('textarea')
          var text = ta ? ta.value : ''
          if (anchorData.tagAdd) {
            saveDraft(anchorData, {
              kind: 'comment',
              field: 'tags',
              comment: 'Propose tag: ' + text,
            })
          } else if (anchorData.relAdd) {
            saveDraft(anchorData, {
              kind: 'comment',
              field: 'relations',
              comment: 'Propose relation: ' + text,
            })
          } else if (activeKind === 'delete') {
            saveDraft(anchorData, { kind: 'delete' })
          } else if (anchorData.field && activeKind === 'correction' && ta) {
            saveDraft(anchorData, { kind: 'correction', proposed: ta.value })
          } else if (ta) {
            saveDraft(anchorData, { kind: 'comment', comment: ta.value })
          }
          closePopover()
        },
        onCancel: function () {
          closePopover()
          if (lastAnchor && typeof lastAnchor.focus === 'function') lastAnchor.focus()
        },
      })
      // The kit adds a correction textarea when a correction is offered; for a
      // card we still need a comment box, and both kinds reuse the same input.
      if (!anchorData.field) {
        var ta = doc.createElement('textarea')
        ta.className = 'innfo-popover-comment'
        var saveBtn = pop.querySelector('.innfo-popover-save')
        pop.insertBefore(ta, saveBtn)
      }
      Array.prototype.forEach.call(pop.querySelectorAll('.innfo-popover-kind'), function (b) {
        b.addEventListener('click', function () {
          activeKind = b.getAttribute('data-kind')
        })
      })
      anchor.parentNode.insertBefore(pop, anchor.nextSibling)
      openPopover = pop
      var focusable = pop.querySelector('textarea, button')
      if (focusable && typeof focusable.focus === 'function') focusable.focus()
    }

    function annotateControl(anchorData, label) {
      var b =
        typeof UI.EditAnchor === 'function'
          ? UI.EditAnchor({ label: label || 'Annotate' })
          : makeEl(doc, 'button', 'innfo-review-anchor', label || '+')
      b.setAttribute('data-innfo-review-ctl', '1')
      b.setAttribute('data-innfo-ctl', anchorData.field ? 'field-anchor' : 'card-anchor')
      if (anchorData.field) b.setAttribute('data-field', String(anchorData.field))
      b.setAttribute('type', 'button')
      b.setAttribute('aria-label', anchorData.field ? 'Annotate field' : 'Annotate element')
      b.addEventListener('click', function () {
        openFor(b, anchorData)
      })
      return b
    }

    // Pencil toggle (card redesign): pins all hover-reveal edit anchors on one
    // card via [data-editing]. Rendered top-right by decorateCard; review-owned,
    // so disable() removes it with the other controls.
    function editToggleControl(card) {
      var t =
        typeof UI.EditToggle === 'function'
          ? UI.EditToggle()
          : makeEl(doc, 'button', 'innfo-review-anchor', '\u270e')
      t.setAttribute('data-innfo-review-ctl', '1')
      t.setAttribute('data-innfo-ctl', 'edit-toggle')
      t.setAttribute('type', 'button')
      t.setAttribute('aria-pressed', 'false')
      t.setAttribute('aria-label', 'Toggle edit controls on this card')
      t.setAttribute('title', 'Toggle edit controls on this card')
      t.addEventListener('click', function () {
        var on = card.getAttribute('data-editing') === 'true'
        card.setAttribute('data-editing', on ? 'false' : 'true')
        t.setAttribute('aria-pressed', on ? 'false' : 'true')
      })
      return t
    }

    // Pencils for name / description / marker KUs. They reuse openFor with a
    // virtual field so every editable KU funnels into the same KU modal.
    function kuEditControl(anchorData, label) {
      var b =
        typeof UI.EditAnchor === 'function'
          ? UI.EditAnchor({ label: label })
          : makeEl(doc, 'button', 'innfo-review-anchor', '\u270e')
      b.setAttribute('data-innfo-review-ctl', '1')
      b.setAttribute('data-innfo-ctl', anchorData.ctl || 'ku-anchor')
      b.setAttribute('type', 'button')
      b.setAttribute('aria-label', label)
      b.setAttribute('title', label)
      b.addEventListener('click', function () {
        openFor(b, anchorData)
      })
      return b
    }

    function onKeydown(event) {
      if (!enabled) return
      if (!event) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      var target = event.target
      var tag = target && target.tagName ? String(target.tagName).toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (target && target.isContentEditable) return
      if (openPopover) return

      var changedOn = html() && html().getAttribute('data-innfo-filter') === 'changed'
      var visible = []
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        function (card) {
          // Layout-free visibility: when the changed filter is on, only changed
          // cards are shown; otherwise every connected card is navigable.
          if (changedOn && !card.hasAttribute('data-innfo-changed')) return
          if (card.hidden) return
          visible.push(card)
        },
      )
      if (!visible.length) return

      var current = doc.activeElement
      var idx = visible.indexOf(current)
      if (event.key === 'j') {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        var next = visible[idx < 0 ? 0 : Math.min(idx + 1, visible.length - 1)]
        if (next && typeof next.focus === 'function') next.focus()
      } else if (event.key === 'k') {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        var prev = visible[idx <= 0 ? 0 : idx - 1]
        if (prev && typeof prev.focus === 'function') prev.focus()
      } else if (event.key === 'c') {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        var focused = idx >= 0 ? visible[idx] : visible[0]
        var fieldRow = focused.querySelector('[data-innfo-ctl="field-anchor"]')
        var anchor = focused.querySelector('[data-innfo-ctl="card-anchor"]')
        if (fieldRow && document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-innfo-component="field-row"]')) {
          fieldRow.dispatchEvent(new Event('click', { bubbles: true }))
        } else if (anchor) {
          anchor.dispatchEvent(new Event('click', { bubbles: true }))
        }
      }
    }

    function ensureCardFocusable(card) {
      if (!card.getAttribute('tabindex')) card.setAttribute('tabindex', '-1')
    }

    function decorateCard(card) {
      ensureCardFocusable(card)
      var elId = card.getAttribute('data-element-id')
      var head = card.querySelector('.innfo-card-head') || card
      if (!card.querySelector('[data-innfo-ctl="card-anchor"]')) {
        head.appendChild(annotateControl({ elementId: elId }, 'Annotate element'))
      }
      if (!card.querySelector('[data-innfo-ctl="edit-toggle"]')) {
        head.appendChild(editToggleControl(card))
      }
      var nameEl = card.querySelector('.innfo-card-name')
      if (nameEl && !nameEl.querySelector('[data-innfo-ctl="name-anchor"]')) {
        nameEl.appendChild(
          kuEditControl({ elementId: elId, field: '__name', ctl: 'name-anchor' }, 'Edit element name'),
        )
      }
      var descEl = card.querySelector('.innfo-card-desc')
      if (descEl && !descEl.querySelector('[data-innfo-ctl="desc-anchor"]')) {
        descEl.appendChild(
          kuEditControl(
            { elementId: elId, field: '__description', ctl: 'desc-anchor' },
            'Edit description',
          ),
        )
      }
      Array.prototype.forEach.call(
        card.querySelectorAll('[data-marker-id]'),
        function (chip) {
          if (chip.querySelector('[data-innfo-ctl="marker-anchor"]')) return
          var markerId = chip.getAttribute('data-marker-id')
          chip.appendChild(
            kuEditControl(
              { elementId: elId, field: 'marker:' + markerId, ctl: 'marker-anchor' },
              'Edit marker ' + markerId,
            ),
          )
        },
      )
      decorateTagRow(card, elId)
      decorateRelList(card, elId)
      if (!head.querySelector('[data-innfo-component="reviewed-toggle"]') && store) {
        var el = elementsById[elId]
        var state = el ? reviewState(el, store.reviewed()) : 'none'
        var rt = UI.ReviewedToggle({ state: state })
        rt.setAttribute('data-innfo-review-ctl', '1')
        rt.addEventListener('click', function () {
          var current = store.reviewed()
          if (Object.prototype.hasOwnProperty.call(current, elId)) {
            store.unmarkReviewed(elId)
          } else if (el) {
            store.markReviewed(elId, el.hash)
          }
          applyDecorations()
          refreshCount()
        })
        head.appendChild(rt)
      }
    }

    // Tags are not KUs (no sub-ID, no modal): membership is proposed with
    // +/x controls that record comment drafts. Marker chips keep pencils.
    function decorateTagRow(card, elId) {
      var row = card.querySelector('[data-innfo-component="tag-row"]')
      if (!row) return
      Array.prototype.forEach.call(row.querySelectorAll('.innfo-tag'), function (tag) {
        if (tag.querySelector('[data-innfo-ctl="tag-remove"]')) return
        var name = tag.getAttribute('data-tag') || tag.textContent
        var x = makeEl(doc, 'button', 'innfo-tag-remove', '\u00d7')
        x.setAttribute('data-innfo-review-ctl', '1')
        x.setAttribute('data-innfo-ctl', 'tag-remove')
        x.setAttribute('type', 'button')
        x.setAttribute('aria-label', 'Propose removing tag ' + name)
        x.setAttribute('title', 'Propose removing tag ' + name)
        x.addEventListener('click', function () {
          openFor(x, { elementId: elId, tagRemove: name })
        })
        tag.appendChild(x)
      })
      if (!row.querySelector('[data-innfo-ctl="tag-add"]')) {
        var add = makeEl(doc, 'button', 'innfo-tag-add', '+ tag')
        add.setAttribute('data-innfo-review-ctl', '1')
        add.setAttribute('data-innfo-ctl', 'tag-add')
        add.setAttribute('type', 'button')
        add.setAttribute('aria-label', 'Propose a new tag')
        add.addEventListener('click', function () {
          openFor(add, { elementId: elId, tagAdd: true })
        })
        row.appendChild(add)
      }
    }

    // Relations are reference-KUs: pencil = retarget (KU modal with a
    // reference widget), x = unlink proposal, link = navigate (kit-owned).
    function decorateRelList(card, elId) {
      var list = card.querySelector('[data-innfo-component="rel-list"]')
      if (!list) return
      Array.prototype.forEach.call(
        list.querySelectorAll('.innfo-rel-row'),
        function (rowItem) {
          var field = rowItem.getAttribute('data-rel-field') || 'related'
          var target = rowItem.getAttribute('data-rel-target') || ''
          if (!rowItem.querySelector('[data-innfo-ctl="rel-retarget"]')) {
            var re = kuEditControl(
              { elementId: elId, relRetarget: true, relField: field, relTarget: target, ctl: 'rel-retarget' },
              'Retarget relation ' + field,
            )
            rowItem.appendChild(re)
          }
          if (!rowItem.querySelector('[data-innfo-ctl="rel-unlink"]')) {
            var un = makeEl(doc, 'button', 'innfo-rel-act danger', '\u00d7')
            un.setAttribute('data-innfo-review-ctl', '1')
            un.setAttribute('data-innfo-ctl', 'rel-unlink')
            un.setAttribute('type', 'button')
            un.setAttribute('aria-label', 'Propose unlinking ' + field)
            un.setAttribute('title', 'Propose unlinking ' + field)
            un.addEventListener('click', function () {
              openFor(un, { elementId: elId, relUnlink: target, relField: field })
            })
            rowItem.appendChild(un)
          }
        },
      )
      if (!card.querySelector('[data-innfo-ctl="rel-add"]')) {
        var add = makeEl(doc, 'button', 'innfo-rel-add', '+ relation')
        add.setAttribute('data-innfo-review-ctl', '1')
        add.setAttribute('data-innfo-ctl', 'rel-add')
        add.setAttribute('type', 'button')
        add.setAttribute('aria-label', 'Propose a new relation')
        add.addEventListener('click', function () {
          openFor(add, { elementId: elId, relAdd: true })
        })
        list.appendChild(add)
      }
    }

    function decorateFieldRow(row) {
      if (row.querySelector('[data-innfo-ctl="field-anchor"]')) return
      var card = row.closest('[data-innfo-component="element-card"]')
      var elId = card ? card.getAttribute('data-element-id') : ''
      var field = row.getAttribute('data-field')
      row.appendChild(annotateControl({ elementId: elId, field: field }, 'Annotate field'))
    }

    function decorateBadges() {
      if (!doc.querySelectorAll) return
      var feedbackState = Array.isArray(meta.feedbackState) ? meta.feedbackState : []
      if (!feedbackState.length) return
      var verdicts = verdictsByElement(feedbackState, elementsById)
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        function (card) {
          var elId = card.getAttribute('data-element-id')
          var statuses = verdicts[elId]
          if (!statuses) return
          var head = card.querySelector('.innfo-card-head') || card
          var host = head.querySelector('[data-innfo-review-badges]')
          if (!host) {
            host = makeEl(doc, 'span', 'innfo-review-badges')
            host.setAttribute('data-innfo-review-badges', '')
            head.appendChild(host)
          }
          host.innerHTML = ''
          Object.keys(statuses).forEach(function (status) {
            host.appendChild(UI.StatusBadge({ status: status, count: statuses[status] }))
          })
        },
      )
    }

    function decorateRailProgress() {
      if (!doc.querySelectorAll || !store) return
      var progress = progressByConcept(elements, store.drafts(), store.reviewed())
      Array.prototype.forEach.call(
        doc.querySelectorAll('.innfo-rail-item, [data-key]'),
        function (btn) {
          var key = btn.getAttribute('data-concept') || btn.getAttribute('data-key')
          if (!key || key === '__all' || !progress[key]) return
          var existing = btn.querySelector('[data-innfo-component="rail-progress"]')
          if (existing) existing.parentNode.removeChild(existing)
          btn.appendChild(
            UI.RailProgress({
              reviewed: progress[key].reviewed,
              total: progress[key].total,
              pending: progress[key].pending,
            }),
          )
        },
      )
    }

    function applyChangedFilter() {
      if (!store) return
      var changed = changedIds(elements, store.reviewed())
      var changedSet = {}
      changed.forEach(function (id) {
        changedSet[id] = true
      })
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        function (card) {
          if (changedSet[card.getAttribute('data-element-id')]) {
            card.setAttribute('data-innfo-changed', '')
          } else {
            card.removeAttribute('data-innfo-changed')
          }
        },
      )
    }

    function buildChangedFilter() {
      var bar =
        doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
      if (!bar) return null
      var existing = bar.querySelector('[data-innfo="changed-filter"]')
      if (existing) return existing
      var b = makeEl(doc, 'button', 'innfo-changed-filter', 'Changed')
      b.setAttribute('data-innfo', 'changed-filter')
      b.setAttribute('type', 'button')
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () {
        var on = html() && html().getAttribute('data-innfo-filter') === 'changed'
        if (on) {
          html().removeAttribute('data-innfo-filter')
          b.setAttribute('aria-pressed', 'false')
        } else {
          html().setAttribute('data-innfo-filter', 'changed')
          b.setAttribute('aria-pressed', 'true')
          applyChangedFilter()
        }
      })
      var openBtn = bar.querySelector('#innfo-feedback-open')
      if (openBtn && openBtn.parentNode) openBtn.parentNode.insertBefore(b, openBtn)
      else bar.appendChild(b)
      return b
    }

    function applyDecorations() {
      decorateBadges()
      if (!enabled) return
      decorate(doc)
      decorateRailProgress()
      if (html() && html().getAttribute('data-innfo-filter') === 'changed') applyChangedFilter()
    }

    function decorate(root) {
      if (!enabled) return
      var host = root || doc
      if (!host.querySelectorAll) return
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        decorateCard,
      )
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-innfo-component="field-row"][data-field]'),
        decorateFieldRow,
      )
    }

    function onRendered(event) {
      var root = event && event.detail ? event.detail.root : null
      // The runtime rebuilds the banner innerHTML on every refresh, so the
      // toggle and changed filter are re-inserted here (idempotent).
      if (canReview(meta, elements, needs)) {
        toggleEl = buildToggle()
        if (enabled && toggleEl) buildChangedFilter()
      }
      if (toggleEl) toggleEl.setAttribute('aria-pressed', enabled ? 'true' : 'false')
      decorateCounter()
      decorateBadges()
      if (enabled) {
        decorate(root || doc)
        decorateRailProgress()
        if (html() && html().getAttribute('data-innfo-filter') === 'changed') applyChangedFilter()
      }
    }

    function buildToggle() {
      if (!canReview(meta, elements, needs)) return null
      var banner =
        doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
      if (!banner) return null
      if (banner.querySelector('[data-innfo="review-toggle"]')) {
        return banner.querySelector('[data-innfo="review-toggle"]')
      }
      var b = makeEl(doc, 'button', 'innfo-review-toggle', 'Review mode')
      b.setAttribute('data-innfo', 'review-toggle')
      b.setAttribute('type', 'button')
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () {
        if (enabled) disable()
        else enable()
      })
      var openBtn = banner.querySelector('#innfo-feedback-open')
      if (openBtn && openBtn.parentNode) openBtn.parentNode.insertBefore(b, openBtn)
      else banner.appendChild(b)
      return b
    }

    function enable() {
      enabled = true
      if (html()) html().setAttribute('data-innfo-review', 'on')
      if (toggleEl) toggleEl.setAttribute('aria-pressed', 'true')
      if (doc.addEventListener) doc.addEventListener('keydown', onKeydown)
      buildChangedFilter()
      applyDecorations()
    }

    function disable() {
      enabled = false
      closePopover()
      if (doc.removeEventListener) doc.removeEventListener('keydown', onKeydown)
      if (html()) {
        html().removeAttribute('data-innfo-review')
        html().removeAttribute('data-innfo-filter')
      }
      if (toggleEl) toggleEl.setAttribute('aria-pressed', 'false')
      Array.prototype.forEach.call(doc.querySelectorAll('[data-innfo-review-ctl]'), function (n) {
        if (n.parentNode) n.parentNode.removeChild(n)
      })
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-component="rail-progress"]'),
        function (n) {
          if (n.parentNode) n.parentNode.removeChild(n)
        },
      )
      var filterBtn = doc.querySelector('[data-innfo="changed-filter"]')
      if (filterBtn && filterBtn.parentNode) filterBtn.parentNode.removeChild(filterBtn)
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-changed]'),
        function (n) {
          n.removeAttribute('data-innfo-changed')
        },
      )
    }

    function destroy() {
      disable()
      if (doc.removeEventListener) doc.removeEventListener('innfo:rendered', onRendered)
      if (toggleEl && toggleEl.parentNode) toggleEl.parentNode.removeChild(toggleEl)
      toggleEl = null
    }

    // A11y: the draft counter is a polite live region (C13).
    function decorateCounter() {
      var counter = doc.querySelector('[data-innfo="draft-count"]')
      if (counter) {
        counter.setAttribute('role', 'status')
        counter.setAttribute('aria-live', 'polite')
      }
    }

    toggleEl = buildToggle()
    if (doc.addEventListener) doc.addEventListener('innfo:rendered', onRendered)
    // One initial pass: covers a render that preceded the controller's creation
    // (verdict badges show with review mode off).
    decorateCounter()
    decorateBadges()

    return {
      enable: enable,
      disable: disable,
      decorate: decorate,
      destroy: destroy,
      isEnabled: function () {
        return enabled
      },
    }
  }

  return {
    STORE_PREFIX: STORE_PREFIX,
    STORE_VERSION: STORE_VERSION,
    createDraftStore: createDraftStore,
    createReviewController: createReviewController,
    reviewState: reviewState,
    isTargetChanged: isTargetChanged,
    progressByConcept: progressByConcept,
    verdictsByElement: verdictsByElement,
    changedIds: changedIds,
    canReview: canReview,
    draftToItem: draftToItem,
  }
})
