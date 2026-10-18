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

  var STORE_PREFIX = 'innfo-console:v3:'
  var STORE_VERSION = 4
  var BASE_HASH_PATTERN = /^[0-9a-f]{16}$/
  var REVIEW_STATES = ['none', 'reviewed', 'changed']
  var ITEM_KINDS = ['correction', 'comment', 'new', 'delete']

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  // The definition governing a matrix cell: the matrix definition of the same name.
  function matrixCellDef(schema, matrix, col, target) {
    if (!schema) return null
    var want = String(matrix).toLowerCase()
    return (
      (Array.isArray(schema.matrices) ? schema.matrices : []).filter(function (d) {
        return d && String(d.name).toLowerCase() === want
      })[0] || null
    )
  }

  // Declared definition of a field, keyed by (concept, field) so two concepts that
  // share a field name keep their own type/options. Case-insensitive on both parts.
  function fieldDefOf(schema, concept, field) {
    var fields = schema && Array.isArray(schema.fields) ? schema.fields : []
    var c = String(concept == null ? '' : concept).toLowerCase()
    var n = String(field == null ? '' : field).toLowerCase()
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i]
      if (
        f &&
        String(f.concept == null ? '' : f.concept).toLowerCase() === c &&
        String(f.name == null ? '' : f.name).toLowerCase() === n
      ) {
        return f
      }
    }
    return null
  }

  // The field value as written in the document: a console file rebases media paths
  // for display and keeps the document text in el.rawFields.
  function docFieldValue(el, key) {
    if (el && isObject(el.rawFields) && Object.prototype.hasOwnProperty.call(el.rawFields, key)) {
      return el.rawFields[key]
    }
    return el && el.fields ? el.fields[key] : undefined
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
    // Engine address of the target (file stem + element slug), captured with the draft
    // so a changeset export does not have to guess it from display titles.
    if (d.knowledge_id != null && d.knowledge_id !== '') draft.knowledge_id = String(d.knowledge_id)
    if (d.element_slug != null && d.element_slug !== '') draft.element_slug = String(d.element_slug)
    // Matrix-cell drafts target a matrix coordinate, not an element unit.
    if (d.matrix != null && d.matrix !== '') draft.matrix = String(d.matrix)
    if (d.row != null && d.row !== '') draft.row = String(d.row)
    if (d.col != null && d.col !== '') draft.col = String(d.col)
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

  // Options: `onError(err)` is called when a write fails (the draft stays in memory
  // only); `onRemoteChange()` is called after another tab changed this store.
  // The store is keyed by the console's stable store key only (the domain id for a
  // domain console, `::view:<id>` for a standalone view). It records no model or
  // domain version: staleness is per draft (`base_hash`), never at the store level.
  function createDraftStore(storage, modelId, options) {
    var opts = isObject(options) ? options : {}
    var resolved = resolveStorage(storage)
    var backing = resolved.storage
    var persistent = resolved.persistent
    var key = STORE_PREFIX + String(modelId == null ? '' : modelId)

    function emptyState() {
      return {
        v: STORE_VERSION,
        modelId: modelId,
        drafts: [],
        reviewed: {},
      }
    }

    function read() {
      var raw
      try {
        raw = backing.getItem(key)
      } catch {
        return emptyState()
      }
      if (!raw) return emptyState()
      var parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        return emptyState()
      }
      if (!isObject(parsed) || parsed.v !== STORE_VERSION) {
        return emptyState()
      }
      if (String(parsed.modelId) !== String(modelId)) {
        return emptyState()
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
      return {
        v: STORE_VERSION,
        modelId: modelId,
        drafts: drafts,
        reviewed: reviewed,
      }
    }

    // A failed write is reported, and the in-memory state then runs ahead of storage:
    // until a write succeeds again, mutations build on memory rather than on a re-read
    // that would silently drop the unsaved drafts.
    var memoryAhead = false

    function write(next) {
      try {
        backing.setItem(key, JSON.stringify(next))
        memoryAhead = false
      } catch (err) {
        memoryAhead = true
        if (typeof opts.onError === 'function') opts.onError(err)
      }
    }

    var state = read()

    // Read-merge-write: every mutation starts from what storage holds now, so a draft
    // saved in another tab since our last read is kept instead of overwritten.
    function mutate(change) {
      if (!memoryAhead) state = read()
      var result = change(state)
      write(state)
      return result
    }

    var onStorage = null
    var listenTarget = typeof window !== 'undefined' && window && window.addEventListener ? window : null
    if (listenTarget && persistent) {
      onStorage = function (event) {
        if (event && event.key !== null && event.key !== undefined && event.key !== key) return
        if (memoryAhead) return
        state = read()
        if (typeof opts.onRemoteChange === 'function') opts.onRemoteChange()
      }
      listenTarget.addEventListener('storage', onStorage)
    }

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
        var isMatrix = raw.matrix != null && raw.matrix !== '' && raw.row != null && raw.col != null
        if (raw.kind === 'new') {
          // A new element has no target in the model yet: it is addressed by its
          // model, concept and name instead of an element id and hash.
          var missing = ['knowledge_id', 'concept', 'element'].filter(function (key) {
            return raw[key] == null || raw[key] === ''
          })
          if (missing.length) {
            throw new TypeError('InnfoReview.createDraftStore: new draft requires ' + missing.join(', '))
          }
        } else if (!isMatrix && (!raw.element_id || !raw.base_hash)) {
          throw new TypeError('InnfoReview.createDraftStore: element_id and base_hash required')
        }
        return deepCopy(
          mutate(function (s) {
            var draft = normalizeDraft(raw, raw.id || nextDraftId(s.drafts))
            s.drafts.push(draft)
            return draft
          }),
        )
      },
      removeDraft: function (id) {
        return deepCopy(
          mutate(function (s) {
            s.drafts = s.drafts.filter(function (d) {
              return d && d.id !== id
            })
            return s.drafts
          }),
        )
      },
      // Removes the given drafts (all of them without arguments), e.g. once exported.
      clearDrafts: function (ids) {
        var drop = Array.isArray(ids) ? ids : null
        mutate(function (s) {
          s.drafts = drop
            ? s.drafts.filter(function (d) {
                return d && drop.indexOf(d.id) === -1
              })
            : []
        })
      },
      markReviewed: function (id, hash) {
        mutate(function (s) {
          s.reviewed[String(id)] = String(hash)
        })
      },
      unmarkReviewed: function (id) {
        mutate(function (s) {
          delete s.reviewed[String(id)]
        })
      },
      destroy: function () {
        if (listenTarget && onStorage) listenTarget.removeEventListener('storage', onStorage)
        onStorage = null
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
    // A proposed new element has no target in the model yet, so it cannot be stale.
    if (d.kind === 'new') return false
    // Matrix-cell drafts have no element hash to compare against.
    if (d.matrix) return false
    var el = byId[d.element_id]
    if (!el) return true
    return el.hash !== d.base_hash
  }

  function currentFieldValue(el, field) {
    if (!isObject(el) || field === undefined || field === null) return undefined
    var key = String(field)
    if (el.fields && isObject(el.fields) && el.fields[key] !== undefined) return docFieldValue(el, key)
    if (key === 'name') return el.name
    if (key === 'description') return el.description
    return el[key]
  }

  // A stale draft whose proposed value already equals the element's current
  // value has nothing to review: the change was applied out-of-band (e.g. an
  // engine-side changeset). It reads 'already applied' and is excluded from
  // export, instead of the misleading 'target changed'.
  function isAlreadyApplied(draft, elementsById) {
    var d = isObject(draft) ? draft : {}
    if (d.proposed === undefined || d.proposed === null) return false
    var byId = isObject(elementsById) ? elementsById : {}
    var el = byId[d.element_id]
    if (!el) return false
    if (!isTargetChanged(d, byId)) return false
    var current = currentFieldValue(el, d.field)
    if (current === undefined || current === null) return false
    return String(current) === String(d.proposed)
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

  function normalizeAddressKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  // Badges derive only from changesets: `applied` / `conflict` from each element's
  // changeset `history`, `proposed` from the domain payload's proposed changesets.
  // Local drafts and reviewer verdicts never produce a badge; entries whose element
  // no longer exists are dropped.
  function badgesByElement(elements, changes) {
    var list = Array.isArray(elements) ? elements : []
    var changesets = Array.isArray(changes) ? changes : []
    var out = {}
    function bump(elId, status) {
      if (!elId || !status) return
      if (!out[elId]) out[elId] = {}
      out[elId][status] = (out[elId][status] || 0) + 1
    }
    list.forEach(function (el) {
      if (!el || !el.id) return
      var history = Array.isArray(el.history) ? el.history : []
      history.forEach(function (h) {
        if (!isObject(h)) return
        if (h.status === 'applied' || h.status === 'conflict') bump(el.id, h.status)
      })
    })
    function keysOf(el) {
      var keys = {}
      if (el && el.id) {
        var id = String(el.id)
        keys[normalizeAddressKey(id)] = true
        var at = id.indexOf('@')
        if (at !== -1) keys[normalizeAddressKey(id.slice(at + 1))] = true
      }
      if (el && el.name) keys[normalizeAddressKey(el.name)] = true
      return keys
    }
    changesets.forEach(function (cs) {
      if (!isObject(cs) || cs.status !== 'proposed') return
      var items = Array.isArray(cs.changes) ? cs.changes : []
      items.forEach(function (c) {
        if (!isObject(c)) return
        var target = String(c.target || '')
        var at = target.indexOf('@')
        if (at === -1) return
        var modelPart = target.slice(0, at)
        var elementPart = target.slice(at + 1).split('&')[0].trim()
        if (!elementPart) return
        var forms = [normalizeAddressKey(elementPart), normalizeAddressKey(modelPart + elementPart)]
        for (var i = 0; i < list.length; i++) {
          var el = list[i]
          if (!el || !el.id) continue
          var keys = keysOf(el)
          var hit = false
          for (var f = 0; f < forms.length; f++) {
            if (forms[f] && keys[forms[f]]) {
              hit = true
              break
            }
          }
          if (hit) {
            bump(el.id, 'proposed')
            break
          }
        }
      })
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

  /**
   * (C) The predicate is SPLIT by what each condition protects:
   *  - `canPropose`: a draft can be RECORDED and later applied (the model is
   *    addressable and every element carries a `base_hash` precondition). It does
   *    NOT depend on the export surface: drafts are local, and applying them lives
   *    outside the console (the MCP owns `propose_changeset` / `apply_change`).
   *  - `canReview` (= canExport): additionally needs the `feedback-export` surface
   *    that produces the `_changes_NN.md` artifact.
   */
  function canPropose(meta, elements) {
    var m = isObject(meta) ? meta : {}
    var list = Array.isArray(elements) ? elements : []
    if (typeof m.modelId !== 'string' || !m.modelId.trim()) return false
    if (list.length === 0) return false
    return list.every(function (el) {
      return el && typeof el.hash === 'string' && BASE_HASH_PATTERN.test(el.hash)
    })
  }

  // The payload groups resolved citations by field (`{ field: [citation] }`), but
  // UI.EditModal renders a flat list of `{ origin, source, quote }`. Flatten and
  // map here so the modal's "Citations" section renders.
  function flattenCitations(citations) {
    if (Array.isArray(citations)) return citations
    if (!isObject(citations)) return []
    var out = []
    Object.keys(citations).forEach(function (field) {
      var list = citations[field]
      if (!Array.isArray(list)) return
      list.forEach(function (c) {
        if (!isObject(c)) return
        out.push({
          field: field,
          origin: c.error ? 'error' : (c.origin || 'document'),
          source: c.anchor ? String(c.path || '') + ' \u2192 ' + c.anchor : String(c.path || c.source || ''),
          quote: c.excerpt,
          exists: c.exists,
          error: c.error,
        })
      })
    })
    return out
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
    var changes = Array.isArray(options.changes) ? options.changes : []
    var needs = Array.isArray(options.needs) ? options.needs : []
    var store = options.store
    var elementsById = {}
    elements.forEach(function (el) {
      if (el && el.id) elementsById[el.id] = el
    })

    // No review mode: an edit only ever creates a draft, so there is nothing to
    // "arm". Decoration and the edit affordance are always live; the changeset bar
    // is driven by the DRAFTS (see syncChangesetBar), not by a mode switch.
    var enabled = true
    var toggleEl = null
    var structureEl = null
    var openPopover = null
    var lastAnchor = null

    function html() {
      return doc.documentElement
    }

    function closePopover() {
      if (openPopover && openPopover.parentNode) openPopover.parentNode.removeChild(openPopover)
      openPopover = null
    }

    function valueKeyOf(v) {
      return String(v == null ? '' : v).trim().toLowerCase()
    }

    // Effective tags = own `tags` Field values plus inherited concept-level
    // values, de-duplicated case-insensitively (mirrors the console runtime).
    function effectiveTagsOf(el) {
      var out = []
      if (el && Array.isArray(el.tags)) {
        out = out.concat(el.tags)
      } else if (el && el.fields && el.fields.tags != null) {
        var own = el.fields.tags
        out = out.concat(Array.isArray(own) ? own : [own])
      }
      if (el && el.inherited && el.inherited.tags) {
        var iv = el.inherited.tags.value
        if (iv != null) out = out.concat(Array.isArray(iv) ? iv : [iv])
      }
      var seen = {}
      return out.filter(function (t) {
        var k = valueKeyOf(t)
        if (!k || seen[k]) return false
        seen[k] = true
        return true
      })
    }

    function saveDraft(anchorData, payload) {
      if (!store) return null
      if (anchorData.matrixCell) {
        var matrixDraft = {
          matrix: anchorData.matrix,
          row: anchorData.row,
          col: anchorData.col,
          element: anchorData.matrix,
          kind: payload.kind,
          // The owning model, not the domain: the changeset target must resolve in
          // apply_change. Falls back to the domain id only for legacy anchors.
          knowledge_id: anchorData.modelId || meta.modelId,
          original: anchorData.original,
        }
        if (payload.proposed !== undefined) matrixDraft.proposed = payload.proposed
        if (payload.comment !== undefined && payload.comment !== null) {
          matrixDraft.comment = String(payload.comment)
        }
        var savedMatrix = store.addDraft(matrixDraft)
        refreshCount()
        return savedMatrix
      }
      var el = elementsById[anchorData.elementId]
      if (!el) return null
      var draft = {
        element_id: anchorData.elementId,
        concept: el.concept,
        element: el.name || el.id,
        base_hash: el.hash,
        kind: payload.kind,
        knowledge_id: el.modelId || meta.modelId,
        element_slug: el.slug,
      }
      if (payload.field !== undefined || anchorData.field) {
        draft.field = payload.field !== undefined ? payload.field : anchorData.field
        draft.original =
          payload.original !== undefined
            ? payload.original
            : docFieldValue(el, anchorData.field)
        if (payload.proposed !== undefined) draft.proposed = payload.proposed
      }
      if (payload.comment !== undefined && payload.comment !== null) {
        draft.comment = String(payload.comment)
      }
      // Canonical unit address of the draft target (element, or element&field).
      draft.address = draft.field ? `${draft.element_id}&${draft.field}` : draft.element_id
      var saved = store.addDraft(draft)
      refreshCount()
      return saved
    }

    // The host owns every draft-count surface (banner, Review tab badge,
    // pending text) and updates them through onDraftsChanged without
    // remounting the cards; decorations are re-applied here.
    function refreshCount() {
      if (typeof options.onDraftsChanged === 'function') options.onDraftsChanged()
      applyDecorations()
    }

    // Resolve an anchor to a KU-modal target. Returns null when the anchor is
    // not modal-editable (card comments, tag/relation proposals use popovers
    // or immediate comment drafts instead).
    // Candidates are the owner's own model only (a reference never crosses
    // models) and, when the definition declares target_concepts, only those concepts.
    function modelKeyOf(e) {
      return String(e.modelId || e.modelFile || '')
    }

    function referenceCandidates(def, owner) {
      var allowed = def && Array.isArray(def.target_concepts) ? def.target_concepts : []
      var set = allowed.map(function (c) {
        return String(c).toLowerCase()
      })
      return elements.filter(function (e) {
        if (!e || (owner && modelKeyOf(e) !== modelKeyOf(owner))) return false
        return !set.length || set.indexOf(String(e.concept).toLowerCase()) !== -1
      })
    }

    function kuModalTarget(anchorData) {
      // Matrix cells are edited through the same modal, addressed by coordinate.
      if (anchorData.matrixCell) {
        if (typeof UI.EditModal !== 'function') return null
        var cellDef = matrixCellDef(options.schema, anchorData.matrix, anchorData.col, anchorData.target)
        var cellValues = cellDef && Array.isArray(cellDef.values) ? cellDef.values : null
        var cellWidget = cellDef ? String(cellDef.widgetType || cellDef.widget || '') : ''
        var cellType = 'string'
        var cellValue = anchorData.original
        if (cellWidget === 'boolean') {
          cellType = 'boolean'
          // Any filled cell (a declared value, X, true) reads as checked.
          cellValue = anchorData.original !== '' && anchorData.original !== '-' && anchorData.original !== 'false'
        } else if (
          (cellWidget === 'set' || cellWidget === 'scale' || cellWidget === 'cycle') &&
          cellValues &&
          cellValues.length
        ) {
          cellType = 'select'
        }
        return {
          title: 'Edit ' + anchorData.matrix + ' → ' + anchorData.row + ' × ' + anchorData.col,
          fieldName: '__cell',
          type: cellType,
          options: cellType === 'select' ? cellValues : undefined,
          value: cellValue,
          draftField: '__cell',
          original: anchorData.original,
          citations: [],
          history: [],
        }
      }
      var el = elementsById[anchorData.elementId]
      if (!el || typeof UI.EditModal !== 'function') return null
      var base = {
        citations: flattenCitations(el.citations),
        history: Array.isArray(el.history) ? el.history : [],
      }
      if (anchorData.relRetarget) {
        var relTargetEl = elementsById[anchorData.relTarget]
        return {
          title: 'Retarget ' + (el.name || anchorData.elementId) + ' \u2192 ' + anchorData.relField,
          fieldName: anchorData.relField,
          type: 'reference',
          value: relTargetEl ? '[[' + (relTargetEl.name || relTargetEl.id) + ']]' : anchorData.relTarget,
          candidates: referenceCandidates(fieldDefOf(options.schema, el.concept, anchorData.relField), el),
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
      var fieldVal = docFieldValue(el, field)
      var schemaField = fieldDefOf(options.schema, el.concept, field)
      var fieldType =
        schemaField && schemaField.type
          ? schemaField.type
          : typeof fieldVal === 'number'
            ? 'number'
            : typeof fieldVal === 'boolean'
              ? 'boolean'
              : 'string'
      // A list or object value has no value editor: the modal opens comment-only
      // with Propose disabled (Edit Modal Value Type Safety, S3b P0-2).
      var valueIsContainer = fieldVal !== null && typeof fieldVal === 'object'
      return {
        title: 'Edit ' + (el.name || anchorData.elementId) + ' \u2192 ' + field,
        fieldName: field,
        type: fieldType,
        value: fieldVal,
        valueCommentOnly: valueIsContainer,
        options: schemaField ? schemaField.options : undefined,
        target_concepts: schemaField ? schemaField.target_concepts : undefined,
        candidates:
          schemaField && (schemaField.type === 'reference' || fieldType === 'reference')
            ? referenceCandidates(schemaField, el)
            : undefined,
        draftField: field,
        original: fieldVal,
        citations: base.citations.filter(function (c) {
          return !c.field || c.field === field
        }),
        history: base.history,
      }
    }

    // Incoming/outgoing relations for an element, for the modal's Connections
    // Sankey. Outgoing come from the element's own relations; incoming are the
    // relations of every other element that target it.
    function connectionsFor(el) {
      if (!el) return { center: '', incoming: [], outgoing: [] }
      var outgoing = []
      ;(Array.isArray(el.relations) ? el.relations : []).forEach(function (r) {
        if (!r) return
        var t = elementsById[r.target]
        outgoing.push({ id: r.target, label: r.targetLabel || (t && t.name) || r.target, field: r.field })
      })
      var incoming = []
      Object.keys(elementsById).forEach(function (id) {
        var other = elementsById[id]
        if (!other || id === el.id) return
        ;(Array.isArray(other.relations) ? other.relations : []).forEach(function (r) {
          if (r && r.target === el.id) {
            incoming.push({ id: other.id, label: other.name || other.id, field: r.field })
          }
        })
      })
      return { center: el.name || el.id || '', incoming: incoming, outgoing: outgoing }
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
          isComment: !!target.isComment,
          structure: !!target.structure,
          reviewer: typeof options.getReviewer === 'function' ? String(options.getReviewer() || '') : '',
          warning: (function () {
            var targetEl = elementsById[anchorData.elementId]
            var hasHash = !!(targetEl && typeof targetEl.hash === 'string' && BASE_HASH_PATTERN.test(targetEl.hash))
            if (targetEl && !hasHash) {
              return (
                'This element has no hash, so a proposal against it cannot be applied: ' +
                'the apply engine cannot verify the base_hash precondition.'
              )
            }
            return ''
          })(),
          commentOnly: !!target.commentOnly,
          valueCommentOnly: !!target.valueCommentOnly,
          connections: connectionsFor(elementsById[anchorData.elementId]),
          startTab: anchorData.info ? 'history' : 'edit',
        },
        {
          doc: doc,
          onSave: function (res) {
            if (res.isComment || target.commentOnly) {
              // Defence in depth: the kit already blocks an empty comment.
              if (String(res.comment == null ? '' : res.comment).trim() === '') return
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

    // Entry point for registered views: opens the one shared edit modal. With
    // anchorData.comment it opens in comment mode (an element-level comment
    // when there is no field). Returns false when the anchor has no modal.
    function openEdit(anchorData) {
      // Validate first: an invalid call must not close the open popover or
      // move the focus anchor.
      var target = kuModalTarget(anchorData)
      var el = elementsById[anchorData.elementId]
      if (!target && anchorData.comment && el) {
        target = {
          title: 'Comment on ' + (el.name || anchorData.elementId),
          fieldName: 'comment',
          type: 'string',
          value: '',
          commentOnly: true,
          citations: [],
          history: [],
        }
      }
      if (!target) return false
      // Cancel returns focus to whatever had it when the view asked; focus
      // inside the modal being replaced does not count.
      var focused = doc.activeElement
      if (openPopover && focused && openPopover.contains(focused)) focused = lastAnchor
      closePopover()
      lastAnchor = focused && focused !== doc.body ? focused : null
      if (anchorData.comment) target = Object.assign({}, target, { isComment: true })
      if (anchorData.structure) target = Object.assign({}, target, { structure: true })
      openModalFor(anchorData, target)
      return true
    }

    // Info entry point: the same single modal, opened on the Lineage
    // tab. Available in both review modes (it is not a review control).
    function openInfo(anchorData) {
      return openEdit(Object.assign({}, anchorData, { info: true }))
    }

    function openFor(anchor, anchorData) {
      closePopover()
      lastAnchor = anchor
      // Tag membership is a `correction` on the `tags` Field carrying the full
      // new array (applied as `update_field`), never a comment draft.
      if (anchorData.tagRemove) {
        var elTag = elementsById[anchorData.elementId]
        var curTags = effectiveTagsOf(elTag)
        var nextTags = curTags.filter(function (t) {
          return valueKeyOf(t) !== valueKeyOf(anchorData.tagRemove)
        })
        saveDraft(anchorData, {
          kind: 'correction',
          field: 'tags',
          original: curTags,
          proposed: nextTags,
        })
        return
      }
      if (anchorData.relUnlink) {
        saveDraft(anchorData, {
          kind: 'comment',
          field: 'relations',
          comment:
            'Propose unlinking ' + anchorData.relField + ' \u2192 ' + anchorData.relUnlink,
        })
        return
      }

      var target = kuModalTarget(anchorData)
      if (target) {
        openModalFor(anchorData, target)
        return
      }

      var kinds = anchorData.field ? ['comment', 'correction'] : ['comment', 'delete']
      if (anchorData.tagAdd) kinds = ['correction']
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
        data.original = docFieldValue(el, anchorData.field)
      }
      var pop = UI.AnnotationPopover(data, {
        doc: doc,
        onSave: function () {
          var ta = pop.querySelector('textarea')
          var text = ta ? ta.value : ''
          if (anchorData.tagAdd) {
            var elTagAdd = elementsById[anchorData.elementId]
            var curAdd = effectiveTagsOf(elTagAdd)
            var nextAdd = curAdd.concat([text])
            saveDraft(anchorData, {
              kind: 'correction',
              field: 'tags',
              original: curAdd,
              proposed: nextAdd,
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
          ? UI.EditAnchor({ label: label || 'Annotate', icon: anchorData.field ? 'pencil' : 'message-square' })
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

    // ---- New element (kind: 'new' draft) ----

    function schemaConcepts() {
      var list = options.schema && Array.isArray(options.schema.concepts) ? options.schema.concepts : []
      return list
        .map(function (c) {
          return typeof c === 'string' ? { name: c } : c
        })
        .filter(function (c) {
          return c && c.name
        })
    }

    // Fields the schema declares on one concept, from the flattened list the
    // payload carries (the same source the edit modal reads).
    function declaredFieldsOf(concept) {
      var all = options.schema && Array.isArray(options.schema.fields) ? options.schema.fields : []
      var key = String(concept).toLowerCase()
      return all.filter(function (f) {
        return f && f.name && String(f.concept == null ? '' : f.concept).toLowerCase() === key
      })
    }

    function openNew() {
      var concepts = schemaConcepts()
      if (!concepts.length || typeof UI.NewElementModal !== 'function') return false
      closePopover()
      var modal = UI.NewElementModal(
        {
          concepts: concepts.map(function (c) {
            return { name: c.name, fields: declaredFieldsOf(c.name) }
          }),
          candidates: elements,
          // meta.models[].id is the model id a changeset target resolves; in a domain
          // console meta.modelId is only the folder name.
          models: Array.isArray(meta.models) ? meta.models : [],
          defaultModel: meta.modelId,
        },
        {
          doc: doc,
          onSave: function (res) {
            if (!store) return
            var draft = {
              kind: 'new',
              knowledge_id: res.modelId || meta.modelId,
              concept: res.concept,
              element: res.name,
            }
            if (Object.keys(res.fields).length) draft.proposed = res.fields
            store.addDraft(draft)
            refreshCount()
            closePopover()
          },
          onCancel: function () {
            closePopover()
          },
        },
      )
      doc.body.appendChild(modal)
      openPopover = modal
      if (typeof modal.showModal === 'function') modal.showModal()
      else modal.setAttribute('open', 'open')
      return true
    }

    function buildNewElementButton() {
      var dock = doc.getElementById('innfo-review-dock')
      var banner = doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
      var host = dock || banner
      if (!host || !store || !canReview(meta, elements, needs)) return null
      var existing = doc.querySelector('[data-innfo="new-element"]')
      if (existing) return existing
      if (!schemaConcepts().length) return null
      var b = makeEl(doc, 'button', 'innfo-new-element innfo-dock-changes', '+ New element')
      b.setAttribute('data-innfo', 'new-element')
      b.setAttribute('type', 'button')
      b.addEventListener('click', openNew)
      var exportBtn = host.querySelector('#innfo-dock-export-btn') || host.querySelector('#innfo-feedback-open')
      if (exportBtn && exportBtn.parentNode) exportBtn.parentNode.insertBefore(b, exportBtn)
      else host.appendChild(b)
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
      // Focus may sit on a control INSIDE a card (a tag anchor, a pencil, the "+"),
      // so resolve the card by containment, not by identity.
      var idx = -1
      for (var vi = 0; vi < visible.length; vi++) {
        if (visible[vi] === current || (current && visible[vi].contains && visible[vi].contains(current))) {
          idx = vi
          break
        }
      }
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
        if (
          fieldRow &&
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest('[data-ku-kind="value"]')
        ) {
          fieldRow.dispatchEvent(new Event('click', { bubbles: true }))
        } else {
          // The card-level annotate popover was retired: `c` opens the shared KU
          // modal in comment mode for the focused element.
          openEdit({ elementId: focused.getAttribute('data-element-id'), comment: true })
        }
      }
    }

    function ensureCardFocusable(card) {
      if (!card.getAttribute('tabindex')) card.setAttribute('tabindex', '-1')
    }

    // A reviewed mark is LOCAL STATE, not a proposal: it is shown whenever a store
    // exists, independent of the capability gate (bearer rule: "Reviewed controls are
    // always shown"). This is the "badge/mark" half of the split.
    function decorateReviewedToggle(card) {
      ensureCardFocusable(card)
      var elId = card.getAttribute('data-element-id')
      var head = card.querySelector('.innfo-card-head') || card
      var headRightRef =
        head.querySelector('.innfo-card-count') || head.querySelector('.innfo-card-toggle') || null
      if (!head.querySelector('[data-innfo-component="reviewed-toggle"]') && store) {
        var elForRev = elementsById[elId]
        var stateForRev = elForRev ? reviewState(elForRev, store.reviewed()) : 'none'
        var rt = UI.ReviewedToggle({ state: stateForRev })
        rt.setAttribute('data-innfo-review-ctl', '1')
        rt.addEventListener('click', function () {
          var current = store.reviewed()
          if (Object.prototype.hasOwnProperty.call(current, elId)) {
            store.unmarkReviewed(elId)
          } else if (elForRev) {
            store.markReviewed(elId, elForRev.hash)
          }
          applyDecorations()
        })
        head.insertBefore(rt, headRightRef)
      }
    }

    // The proposal ANCHORS on a card (tag and relation controls) are gated by
    // `canPropose`; this is the "anchor" half of the split.
    function decorateCardAnchors(card) {
      var elId = card.getAttribute('data-element-id')
      // The element-name and description pencils used to be inserted INSIDE the badge
      // and the description block, so they were permanently visible. Editing now lives
      // in the badge's own `+` flyout: no permanent affordance on the card.
      decorateTagRow(card, elId)
      decorateRelList(card, elId)
    }

    // Tags are not KUs (no sub-ID, no modal): membership is proposed with
    // +/x controls that record comment drafts. Marker chips keep pencils.
    function decorateTagRow(card, elId) {
      var row = card.querySelector('[data-innfo-component="tag-row"]')
      if (!row) {
        // The card shows no row for an untagged element; the "+ tag" control still
        // needs one, and it goes away again when review mode is disabled.
        var cardBody = card.querySelector('.innfo-card-body')
        if (!cardBody || typeof UI.TagRow !== 'function') return
        row = UI.TagRow({ tags: [] }, { doc: doc })
        row.setAttribute('data-innfo-review-ctl', '1')
        var relList = cardBody.querySelector('[data-innfo-component="rel-list"]')
        var refChild = relList && relList.parentNode === cardBody ? relList : null
        cardBody.insertBefore(row, refChild)
      }
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

    function decorateFieldRow() {
        // The pencil in a value row used to be appended INSIDE the badge, so it was
        // permanently visible. Editing now lives in that badge's own `+` flyout.
      }

    // Matrix cells are not element units: each editable cell carries an anchor
    // that proposes an `update_matrix_cell` draft (row × col coordinate).
    function decorateMatrixCell(td) {
      if (!enabled || td.querySelector('[data-innfo-ctl="matrix-cell-anchor"]')) return
      var anchorData = {
        matrixCell: true,
        matrix: td.getAttribute('data-matrix'),
        target: td.getAttribute('data-matrix-target') || '',
        row: td.getAttribute('data-row'),
        col: td.getAttribute('data-col'),
        original: td.getAttribute('data-cell-raw') || '',
        // The model that owns the matrix (the draft's D5 target model part).
        modelId: td.getAttribute('data-matrix-model') || '',
        field: '__cell',
        ctl: 'matrix-cell-anchor',
      }
      var b = kuEditControl(
        anchorData,
        'Edit matrix cell ' + anchorData.row + ' \u00d7 ' + anchorData.col,
      )
      b.setAttribute('data-field', '__cell')
      td.appendChild(b)
    }

    // Pending-change pip: a count badge on the unit it targets, visible in both
    // review modes (it reflects stored drafts). Counts are keyed by canonical
    // address; the DOM update itself is owned by the kit (InnfoUI.setUnitChanges).
    function decorateChangePips(root) {
      if (!store || typeof store.drafts !== 'function') return
      if (!UI || typeof UI.setUnitChanges !== 'function') return
      var host = root || doc
      if (!host.querySelectorAll) return
      var drafts = store.drafts() || []
      var raw = {}
      drafts.forEach(function (d) {
        if (!d) return
        var fieldPart = d.field && d.field !== '__name' ? '&' + String(d.field) : ''
        var key = d.address || (d.element_id ? '@' + String(d.element_id) + fieldPart : '')
        if (!key) return
        raw[key] = (raw[key] || 0) + 1
      })
      // Resolve legacy keys (drafts without `address`) onto each badge's
      // canonical address through a suffix match, then let the kit paint.
      var counts = {}
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-innfo-component="ku-unit"][data-ku-address]'),
        function (badge) {
          var address = badge.getAttribute('data-ku-address') || ''
          if (raw[address] != null) {
            counts[address] = raw[address]
            return
          }
          var found = 0
          Object.keys(raw).forEach(function (key) {
            if (address && address.slice(-key.length) === key) found += raw[key]
          })
          if (found) counts[address] = found
        },
      )
      UI.setUnitChanges(host, counts, {
        onChanges: function (address) {
          if (typeof openInfo === 'function') openInfo(anchorFromDescriptor({ address: address }))
        },
      })
    }

    function decorateBadges() {
      if (!doc.querySelectorAll) return
      var badges = badgesByElement(elements, changes)
      if (!Object.keys(badges).length) return
      Array.prototype.forEach.call(
        doc.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        function (card) {
          var elId = card.getAttribute('data-element-id')
          var statuses = badges[elId]
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

    // The changeset bar is STATE-driven: it appears when there is at least one draft
    // and hides when there is none. There is no mode to enter or leave.
    function syncChangesetBar() {
      var dock = doc.getElementById('innfo-review-dock')
      if (!dock) return
      var count = store && typeof store.drafts === 'function' ? store.drafts().length : 0
      if (count > 0) {
        dock.style.removeProperty('display')
        dock.setAttribute('data-visible', 'true')
      } else {
        dock.style.setProperty('display', 'none', 'important')
        dock.removeAttribute('data-visible')
      }
    }

    function applyDecorations() {
      // Badge/mark decoration is capability-free: verdict badges, change pips, the
      // reviewed marks and the rail progress reflect state, not proposals, and are
      // always shown (there is no mode).
      decorateBadges()
      decorateChangePips()
      decorateMarks(doc)
      syncChangesetBar()
      if (!enabled) return
      decorateRailProgress()
      if (html() && html().getAttribute('data-innfo-filter') === 'changed') applyChangedFilter()
      // (C): the edit ANCHORS need a PROPOSABLE domain (modelId + every element has a
      // base_hash). The export surface is gated separately, by canReview.
      if (!canPropose(meta, elements)) return
      decorateAnchors(doc)
    }

    // One malformed node must never abort the whole decoration pass: a throw
    // here used to leave every later target (matrix cells in particular)
    // undecorated. Each node is decorated in isolation; failures are logged.
    function safeDecorate(fn) {
      return function (node) {
        try {
          fn(node)
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('innfo review: skipped decorating a node', err)
          }
        }
      }
    }

    // Marks (the reviewed toggle): local state, always decorated, no capability.
    function decorateMarks(root) {
      var host = root || doc
      if (!host || !host.querySelectorAll) return
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        safeDecorate(decorateReviewedToggle),
      )
    }

    // Proposal anchors (tag/relation controls, matrix-cell anchors): the caller gates
    // these on `canPropose`, the edit half of the split.
    function decorateAnchors(root) {
      if (!enabled) return
      var host = root || doc
      if (!host || !host.querySelectorAll) return
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-innfo-component="element-card"][data-element-id]'),
        safeDecorate(decorateCardAnchors),
      )
      Array.prototype.forEach.call(
        host.querySelectorAll('[data-ku-kind="value"][data-field]'),
        safeDecorate(decorateFieldRow),
      )
      Array.prototype.forEach.call(
        host.querySelectorAll('td[data-matrix][data-row][data-col]'),
        safeDecorate(decorateMatrixCell),
      )
    }

    // Retained public name: decorating an element covers its reviewed mark and its
    // proposal anchors (the badge/mark + anchor halves together).
    function decorate(root) {
      if (!enabled) return
      decorateMarks(root)
      decorateAnchors(root)
    }

    function onRendered(event) {
      var root = event && event.detail ? event.detail.root : null
      // The runtime rebuilds the banner innerHTML on every refresh, so the
      // toggle and changed filter are re-inserted here (idempotent).
      if (canReview(meta, elements, needs)) {
        // No review mode and no Edit-structure switch: there is no mode to enter, so
        // these controls are installed unconditionally. Adding the same listener
        // twice is a no-op, so a re-render stays idempotent.
        buildNewElementButton()
        buildChangedFilter()
        if (doc.addEventListener) doc.addEventListener('keydown', onKeydown)
      }
      decorateCounter()
      // Badge/mark decoration has always been unconditional; the CAPABILITY gate
      // applies to the edit anchors (where a proposal starts).
      decorateBadges()
      decorateChangePips(root || doc)
      if (enabled) {
        decorateMarks(root || doc)
        decorateRailProgress()
        if (html() && html().getAttribute('data-innfo-filter') === 'changed') applyChangedFilter()
      }
      if (enabled && canPropose(meta, elements)) {
        decorateAnchors(root || doc)
      }
    }

    function buildToggle() {
      if (!canReview(meta, elements, needs)) return null
      var actions = doc.getElementById('innfo-navbar-actions')
      var extra = doc.getElementById('innfo-navbar-extra')
      var banner =
        doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
      var host = actions || extra || banner
      if (!host) return null
      var existing = doc.querySelector('[data-innfo="review-toggle"]')
      if (existing) return existing
      var b = makeEl(doc, 'button', 'innfo-review-toggle', 'Review mode')
      b.setAttribute('data-innfo', 'review-toggle')
      b.setAttribute('type', 'button')
      b.setAttribute('aria-pressed', 'false')
      b.addEventListener('click', function () {
        if (enabled) disable()
        else enable()
      })
      host.appendChild(b)
      return b
    }

    function buildStructureSwitch() {
      var dock = doc.getElementById('innfo-review-dock')
      if (!dock) return null
      var existing = dock.querySelector('[data-innfo="structure-switch"]')
      if (existing) return existing
      var b = makeEl(doc, 'button', 'innfo-structure-switch', 'Edit structure')
      b.setAttribute('data-innfo', 'structure-switch')
      b.setAttribute('type', 'button')
      b.setAttribute('role', 'switch')
      b.setAttribute('aria-checked', 'false')
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-checked') === 'true'
        b.setAttribute('aria-checked', on ? 'false' : 'true')
        if (html()) {
          if (on) html().removeAttribute('data-innfo-structure')
          else html().setAttribute('data-innfo-structure', 'on')
        }
      })
      dock.appendChild(b)
      return b
    }

    function enable() {
      enabled = true
      if (html()) html().setAttribute('data-innfo-review', 'on')
      if (toggleEl) toggleEl.setAttribute('aria-pressed', 'true')
      /* no Edit-structure switch: the edit modal warns instead */
      if (doc.addEventListener) doc.addEventListener('keydown', onKeydown)
      buildChangedFilter()
      applyDecorations()
      var dock = doc.getElementById('innfo-review-dock')
      if (dock) {
        dock.style.removeProperty('display')
        dock.setAttribute('data-visible', 'true')
        dock.classList.add('active', 'innfo-dock-blinking')
        if (dock._blinkTimer) clearTimeout(dock._blinkTimer)
        dock._blinkTimer = setTimeout(function () {
          dock.classList.remove('innfo-dock-blinking')
          dock._blinkTimer = null
        }, 5000)
      }
    }

    function disable() {
      enabled = false
      closePopover()
      if (doc.removeEventListener) doc.removeEventListener('keydown', onKeydown)
      if (html()) {
        html().removeAttribute('data-innfo-review')
        html().removeAttribute('data-innfo-structure')
        html().removeAttribute('data-innfo-filter')
      }
      if (toggleEl) toggleEl.setAttribute('aria-pressed', 'false')
      if (structureEl && structureEl.parentNode) structureEl.parentNode.removeChild(structureEl)
      structureEl = null
      var dock = doc.getElementById('innfo-review-dock')
      if (dock) {
        dock.style.setProperty('display', 'none', 'important')
        dock.removeAttribute('data-visible')
        dock.classList.remove('active', 'innfo-dock-blinking')
        if (dock._blinkTimer) {
          clearTimeout(dock._blinkTimer)
          dock._blinkTimer = null
        }
      }
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

    function anchorFromDescriptor(descriptor) {
      var address = String((descriptor && descriptor.address) || '')
      var at = address.indexOf('@')
      var model = at === -1 ? address : address.slice(0, at)
      var rest = at === -1 ? '' : address.slice(at + 1)
      var segs = rest.split('&')
      var unit = segs[0] || ''
      var subs = segs.slice(1)
      if (!unit) return { elementId: '', modelId: model }
      if (unit.indexOf('concept:') === 0) {
        return { elementId: null, modelId: model, concept: unit.slice('concept:'.length), field: subs[0] }
      }
      if (subs.length === 2) {
        return { elementId: unit, modelId: model, field: '__cell', row: subs[0], col: subs[1] }
      }
      if (subs.length === 1) {
        return { elementId: unit, modelId: model, field: subs[0] }
      }
      return { elementId: unit, modelId: model, field: '__name' }
    }

    // One descriptor-driven entry point for every Ku action. `Ku` never knows
    // about review mode; the delegated listener forwards here and this function
    // decides whether the action is legal right now.
    function handleKuAction(action, descriptor) {
      if (!descriptor) return false
      var anchorData = anchorFromDescriptor(descriptor)
      if (action === 'info') {
        return openInfo(anchorData)
      }
      if (action !== 'edit') return false
      if (!enabled) return false
      if (descriptor.editability === 'structure') {
        if (!html() || html().getAttribute('data-innfo-structure') !== 'on') return false
        return openEdit(Object.assign({}, anchorData, { comment: true, structure: true }))
      }
      if (descriptor.editability === 'none') return false
      return openEdit(anchorData)
    }

    /* no review-mode toggle: there is no mode */
    if (doc.addEventListener) doc.addEventListener('innfo:rendered', onRendered)
    // One initial pass: covers the render that preceded the controller's creation.
    // With the model viewer retired (SCS) no second render follows boot, so the
    // initial paint must be decorated completely (badges, info actions, pips),
    // not just badges + counter.
    onRendered({ detail: { root: doc.getElementById('innfo-content') || doc } })

    return {
      enable: enable,
      disable: disable,
      decorate: decorate,
      openEdit: openEdit,
      handleKuAction: handleKuAction,
      openNew: openNew,
      propose: saveDraft,
      // Re-renders the host's count surfaces and re-applies decorations after
      // the store changed outside saveDraft (e.g. a draft removed by a view).
      refresh: refreshCount,
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
    fieldDefOf: fieldDefOf,
    reviewState: reviewState,
    isTargetChanged: isTargetChanged,
    isAlreadyApplied: isAlreadyApplied,
    progressByConcept: progressByConcept,
    badgesByElement: badgesByElement,
    changedIds: changedIds,
    canReview: canReview,
    flattenCitations: flattenCitations,
  }
})
