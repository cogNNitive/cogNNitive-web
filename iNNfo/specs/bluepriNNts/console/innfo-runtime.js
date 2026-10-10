/* global module: writable */
/* global uPlot */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ui-kit.js'), require('./review.js'))
  } else {
    root.InnfoConsole = factory(root.InnfoUI, root.InnfoReview)
  }
})(typeof self !== 'undefined' ? self : this, function (UI, Review) {
  'use strict'

  // D5: the kit is a hard dependency; fail loudly rather than degrade silently.
  if (!UI) throw new Error('InnfoUI missing: load ui-kit.js first')
  if (!Review) throw new Error('InnfoReview missing: load review.js first')

  var CONSOLE_VERSION = '0.1.0'

  var REVIEWER_STORAGE_KEY = 'innfo_reviewer_name'
  // Fallback reviewer name used when none is stored. Treated as "no identifier"
  // by the export gate so the user must enter a real one before exporting.
  var DEFAULT_REVIEWER_NAME = 'reviewer'
  var MODEL_VERSION_PATTERN = /^V_\d+-\d+-\d+$/
  var EXPORTED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/
  var ITEM_ID_PATTERN = /^fb-\d{3,}$/
  var SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
  var FILENAME_PATTERN =
    /^([A-Za-z0-9-]+)_V_(\d+-\d+-\d+)_([a-z0-9-]+)_feedback_(\d{8}-\d{6})\.json$/
  var ITEM_KINDS = ['correction', 'comment', 'new', 'delete']
  var ITEM_STATUSES = ['pending', 'applied', 'rejected']

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  function getInnfoSlug() {
    if (typeof InnfoSlug !== 'undefined' && InnfoSlug && InnfoSlug.slugify) return InnfoSlug
    if (typeof globalThis !== 'undefined' && globalThis.InnfoSlug && globalThis.InnfoSlug.slugify)
      return globalThis.InnfoSlug
    if (typeof require === 'function') {
      try {
        var mod = require('./innfo-slug.generated.js')
        if (mod && mod.slugify) return mod
      } catch {
        /* ignore */
      }
    }
    return null
  }

  function slugify(value) {
    var slugMod = getInnfoSlug()
    var raw = slugMod ? slugMod.slugify(String(value == null ? '' : value)) : ''
    return raw || 'feedback'
  }

  // D4: exports are named after the immutable model_slug, never the human
  // title. An explicit slug wins; otherwise the model id (then title) is slugified.
  function modelSlugOf(state) {
    var s = isObject(state) ? state : {}
    var slugMod = getInnfoSlug()
    var candidates = [s.modelSlug, s.modelId, s.modelTitle]
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i]
      if (typeof c !== 'string' || !c.trim()) continue
      var out = slugMod ? slugMod.slugify(c) : ''
      if (out) return out
    }
    // Nothing slugifies (e.g. a non-Latin title with no ASCII id): derive a
    // stable suffix from the title so distinct models never share a filename.
    var seed = [s.modelTitle, s.modelId].filter(function (v) {
      return typeof v === 'string' && v.trim()
    })[0]
    return 'model-' + shortHash(seed || '')
  }

  // FNV-1a (32-bit) rendered as 8 lowercase hex digits; deterministic across runs.
  function shortHash(text) {
    var h = 0x811c9dc5
    var str = String(text)
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return ('00000000' + h.toString(16)).slice(-8)
  }

  function slugifyReviewer(value) {
    var text = String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]+/g, '')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_')
    return text || DEFAULT_REVIEWER_NAME
  }

  function getReviewerName() {
    try {
      if (typeof localStorage !== 'undefined') {
        var stored = localStorage.getItem(REVIEWER_STORAGE_KEY)
        if (stored && typeof stored === 'string' && stored.trim()) {
          return stored.trim()
        }
      }
    } catch {
      /* localStorage unavailable (private mode / file://) - fall through to default */
    }
    return DEFAULT_REVIEWER_NAME
  }

  function setReviewerName(name) {
    var val = String(name || '').trim() || DEFAULT_REVIEWER_NAME
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(REVIEWER_STORAGE_KEY, val)
      }
    } catch {
      /* localStorage unavailable (private mode / file://) - name stays in-memory */
    }
    return val
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n
  }

  function stampFromDate(when) {
    var d = when instanceof Date ? when : new Date(when)
    if (isNaN(d.getTime())) throw new Error('innfo-console: invalid date for filename stamp')
    return (
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      '-' +
      pad2(d.getUTCHours()) +
      pad2(d.getUTCMinutes()) +
      pad2(d.getUTCSeconds())
    )
  }

  function buildFeedbackFilename(model, version, slug, when) {
    if (!model || typeof model !== 'string' || !/^[A-Za-z0-9-]+$/.test(model)) {
      throw new Error('innfo-console: model must be a non-empty alphanumeric identifier')
    }
    if (!/^\d+-\d+-\d+$/.test(String(version))) {
      throw new Error('innfo-console: version must use hyphen separators (x-y-z)')
    }
    var cleanSlug = slugify(slug)
    if (!SLUG_PATTERN.test(cleanSlug)) {
      throw new Error('innfo-console: slug is not URL-safe after slugify')
    }
    var stamp = stampFromDate(when === undefined ? new Date() : when)
    return model + '_V_' + version + '_' + cleanSlug + '_feedback_' + stamp + '.json'
  }

  function parseFeedbackFilename(filename) {
    var m = FILENAME_PATTERN.exec(String(filename || ''))
    if (!m) return null
    return { model: m[1], version: m[2], slug: m[3], stamp: m[4] }
  }

  function isValidExportedAt(value) {
    return typeof value === 'string' && EXPORTED_AT_PATTERN.test(value)
  }

  function parseConfig(raw) {
    var fallback = { needs: [], runtime: {} }
    if (!raw || typeof raw !== 'string') return fallback
    try {
      var parsed = JSON.parse(raw)
      if (!isObject(parsed)) return fallback
      var needs = Array.isArray(parsed.needs)
        ? parsed.needs.filter(function (n) {
            return typeof n === 'string'
          })
        : []
      var runtime = isObject(parsed.runtime) ? parsed.runtime : {}
      return { needs: needs, runtime: runtime }
    } catch {
      return fallback
    }
  }

  function hasNeed(config, need) {
    if (!config || !Array.isArray(config.needs)) return false
    return config.needs.indexOf(need) !== -1
  }

  function slotText(doc, id) {
    if (!doc || typeof doc.getElementById !== 'function') return ''
    var el = doc.getElementById(id)
    if (!el) return ''
    return (el.textContent || '').trim()
  }

  function parseSlots(schemaRaw, modelRaw) {
    var schema
    var model
    try {
      schema = JSON.parse(String(schemaRaw || '').trim() || '{}')
    } catch {
      throw new Error('innfo-console: innfo-schema slot holds corrupt JSON')
    }
    try {
      model = JSON.parse(String(modelRaw || '').trim() || '{}')
    } catch {
      throw new Error('innfo-console: innfo-model slot holds corrupt JSON')
    }
    if (!isObject(schema) || !isObject(model)) {
      throw new Error('innfo-console: slots must decode to JSON objects')
    }
    return { schema: schema, model: model }
  }

  function resolveElementId(concept, name) {
    return slugify(String(concept || '') + ' ' + String(name || ''))
  }

  function elementHaystack(element) {
    var parts = [
      element.concept,
      element.name,
      element.description,
      element.modelId,
      element.modelFile,
      element.modelTitle,
      element.unitSlug,
      element.canonicalUnit,
    ]
    if (Array.isArray(element.tags)) {
      parts.push(element.tags.join(' '))
    }
    if (isObject(element.fields)) {
      parts.push(Object.keys(element.fields).join(' '))
      parts.push(
        Object.keys(element.fields)
          .map(function (k) {
            return String(element.fields[k])
          })
          .join(' '),
      )
    }
    return parts
      .filter(function (p) {
        return typeof p === 'string'
      })
      .join(' ')
      .toLowerCase()
  }

  function parseFilterQuery(query) {
    var raw = String(query == null ? '' : query).trim()
    if (!raw) return { textTokens: [], operators: [] }
    var parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || []
    var textTokens = []
    var operators = []

    parts.forEach(function (part) {
      var unquoted = part.replace(/^"|"$/g, '')
      var colonIdx = unquoted.indexOf(':')
      if (colonIdx > 0) {
        var key = unquoted.slice(0, colonIdx).toLowerCase()
        var val = unquoted.slice(colonIdx + 1).toLowerCase()
        operators.push({ key: key, val: val, raw: unquoted })
      } else {
        textTokens.push(unquoted.toLowerCase())
      }
    })
    return { textTokens: textTokens, operators: operators }
  }

  function filterElements(elements, query, context) {
    var list = Array.isArray(elements) ? elements : []
    var parsed = parseFilterQuery(query)
    if (!parsed.textTokens.length && !parsed.operators.length) return list.slice()

    var ctx = context && typeof context === 'object' ? context : {}
    var draftsById = ctx.draftsById || {}
    var reviewedMap = ctx.reviewed || {}

    // Group positive facets by key so multiple selections match using OR (e.g. model:A model:B matches A or B)
    var modelOps = []
    var conceptOps = []
    var tagOps = []
    var otherOps = []

    for (var k = 0; k < parsed.operators.length; k++) {
      var oper = parsed.operators[k]
      if (oper.key === 'model' || oper.key === 'file') {
        modelOps.push(oper)
      } else if (oper.key === 'concept') {
        conceptOps.push(oper)
      } else if (oper.key === 'tag') {
        tagOps.push(oper)
      } else {
        otherOps.push(oper)
      }
    }

    return list.filter(function (el) {
      if (!isObject(el)) return false
      var haystack = elementHaystack(el)

      for (var i = 0; i < parsed.textTokens.length; i++) {
        if (haystack.indexOf(parsed.textTokens[i]) === -1) return false
      }

      // Check model facet (OR across multiple model selections)
      if (modelOps.length > 0) {
        var modelHaystack = (
          String(el.modelId || '') +
          ' ' +
          String(el.modelFile || '') +
          ' ' +
          String(el.modelTitle || '')
        ).toLowerCase()
        var matchesAnyModel = modelOps.some(function (op) {
          return modelHaystack.indexOf(op.val) !== -1
        })
        if (!matchesAnyModel) return false
      }

      // Check concept facet (OR across multiple concept selections)
      if (conceptOps.length > 0) {
        var elConcept = String(el.concept || '').toLowerCase()
        var matchesAnyConcept = conceptOps.some(function (op) {
          return elConcept.indexOf(op.val) !== -1
        })
        if (!matchesAnyConcept) return false
      }

      // Check tag facet (OR across multiple tag selections)
      if (tagOps.length > 0) {
        var matchesAnyTag = tagOps.some(function (op) {
          var hasTag = false
          if (Array.isArray(el.tags)) {
            hasTag = el.tags.some(function (t) {
              return String(t).toLowerCase().indexOf(op.val) !== -1
            })
          }
          if (!hasTag && el.fields && isObject(el.fields)) {
            if (Array.isArray(el.fields.tags)) {
              hasTag = el.fields.tags.some(function (t) {
                return String(t).toLowerCase().indexOf(op.val) !== -1
              })
            } else if (typeof el.fields.tags === 'string') {
              hasTag = el.fields.tags.toLowerCase().indexOf(op.val) !== -1
            } else if (typeof el.fields.tag === 'string') {
              hasTag = el.fields.tag.toLowerCase().indexOf(op.val) !== -1
            }
          }
          return hasTag
        })
        if (!matchesAnyTag) return false
      }

      for (var j = 0; j < otherOps.length; j++) {
        var op = otherOps[j]
        if (op.key === '!concept') {
          var elConceptNot = String(el.concept || '').toLowerCase()
          if (elConceptNot.indexOf(op.val) !== -1) return false
        } else if (op.key === '!model' || op.key === '!file') {
          var modelHaystackNot = (
            String(el.modelId || '') +
            ' ' +
            String(el.modelFile || '') +
            ' ' +
            String(el.modelTitle || '')
          ).toLowerCase()
          if (modelHaystackNot.indexOf(op.val) !== -1) return false
        } else if (op.key === 'tag') {
          var hasTag = false
          if (Array.isArray(el.tags)) {
            hasTag = el.tags.some(function (t) {
              return String(t).toLowerCase().indexOf(op.val) !== -1
            })
          }
          if (!hasTag && el.fields && isObject(el.fields)) {
            if (Array.isArray(el.fields.tags)) {
              hasTag = el.fields.tags.some(function (t) {
                return String(t).toLowerCase().indexOf(op.val) !== -1
              })
            } else if (typeof el.fields.tags === 'string') {
              hasTag = el.fields.tags.toLowerCase().indexOf(op.val) !== -1
            } else if (typeof el.fields.tag === 'string') {
              hasTag = el.fields.tag.toLowerCase().indexOf(op.val) !== -1
            }
          }
          if (!hasTag) return false
        } else if (op.key === 'is') {
          if (op.val === 'draft') {
            if (!draftsById[el.id]) return false
          } else if (op.val === 'reviewed') {
            if (!reviewedMap[el.id]) return false
          } else if (op.val === 'changed') {
            if (!reviewedMap[el.id] || reviewedMap[el.id] === el.hash) return false
          }
        } else if (op.key === '!is') {
          if (op.val === 'draft') {
            if (draftsById[el.id]) return false
          } else if (op.val === 'reviewed') {
            if (reviewedMap[el.id]) return false
          }
        } else if (op.key === 'has') {
          if (!el.fields || el.fields[op.val] === undefined || el.fields[op.val] === null || el.fields[op.val] === '') {
            return false
          }
        } else if (op.key === '!has') {
          if (el.fields && el.fields[op.val] !== undefined && el.fields[op.val] !== null && el.fields[op.val] !== '') {
            return false
          }
        }
      }
      return true
    })
  }

  // ---- Generic tree / sequence helpers (DOM-free, concept-agnostic) ----
  // Any model whose elements carry `parent` / `next` reference fields can build
  // a Work-style tree: roots = elements without a parent; children = elements
  // whose parent points to the root; order = `next` chain within the same parent.

  function buildTree(elements) {
    var nodes = {}
    var roots = []
    ;(Array.isArray(elements) ? elements : []).forEach(function (el) {
      if (!el || !el.id) return
      nodes[el.id] = {
        el: el,
        fields: isObject(el.fields) ? el.fields : {},
        relations: Array.isArray(el.relations) ? el.relations : [],
        children: [],
        parentId: null,
      }
    })
    Object.keys(nodes).forEach(function (id) {
      var node = nodes[id]
      var parentId = resolveParentId(node, nodes)
      node.parentId = parentId
      if (parentId && nodes[parentId]) nodes[parentId].children.push(node)
    })
    Object.keys(nodes).forEach(function (id) {
      var node = nodes[id]
      if (!node.parentId || !nodes[node.parentId]) roots.push(node)
    })
    roots.forEach(function (root) {
      sortChildren(root.children, nodes)
    })
    return { nodes: nodes, roots: roots }
  }

  function resolveParentId(node, nodes) {
    if (!node) return null
    var field = node.fields && node.fields.parent
    if (field && field !== '-' && field !== '') {
      // field may hold the parent NAME; find a node by element name
      for (var id in nodes) {
        if (nodes[id].el && nodes[id].el.name === field) return id
      }
      return null
    }
    var rels = node.relations || []
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].field === 'parent' && rels[i].target && nodes[rels[i].target]) {
        return rels[i].target
      }
    }
    return null
  }

  function sortChildren(children, nodes) {
    var nextOf = {}
    children.forEach(function (c) {
      var rel = (c.relations || []).filter(function (r) {
        return r.field === 'next' && r.target && nodes[r.target]
      })
      if (rel.length) nextOf[c.el.id] = rel[0].target
    })
    children.sort(function (a, b) {
      if (nextOf[a.el.id] === b.el.id) return -1
      if (nextOf[b.el.id] === a.el.id) return 1
      return (a.el.name || '').localeCompare(b.el.name || '')
    })
  }

  function firstChild(node) {
    return node && node.children && node.children.length ? node.children[0] : null
  }

  function nextStep(node, nodes) {
    if (!node) return null
    var rel = (node.relations || []).filter(function (r) {
      return r.field === 'next' && r.target && nodes[r.target]
    })
    if (rel.length) {
      var cand = nodes[rel[0].target]
      if (cand && cand.parentId === node.parentId) return cand
    }
    var label = node.fields && node.fields.next
    if (label && label !== '-' && label !== '') {
      for (var id in nodes) {
        var n = nodes[id]
        if (n.el && n.el.name === label && n.parentId === node.parentId) return n
      }
    }
    return null
  }

  function chainOf(root, nodes) {
    var out = [root]
    var cursor = firstChild(root)
    var visited = {}
    visited[root.el.id] = true
    while (cursor && !visited[cursor.el.id]) {
      visited[cursor.el.id] = true
      out.push(cursor)
      cursor = nextStep(cursor, nodes)
    }
    return out
  }

  function checkStaleness(feedbackVersion, liveVersion) {
    var fb = String(feedbackVersion || '')
    var live = String(liveVersion || '')
    if (fb === live) return { stale: false, report: 'feedback matches live model ' + live }
    return {
      stale: true,
      report:
        'stale feedback: pinned to ' +
        (fb || '(unknown)') +
        ' but live model is ' +
        (live || '(unknown)') +
        ' — confirm before applying',
    }
  }

  // ---- Charts (shared console capability) ----
  // The runtime renders charts from pure-data series only: `compileChartSeries`
  // maps innfo-model.series{chartId:number[]} into uPlot-ready xs/ys arrays and
  // never executes slot JavaScript. `monthAxis` derives the x-axis month window
  // from meta.months / historyMonths / startMonth / startYear. Missing series
  // for a declared chartId degrade to a console warning (chart skipped); the
  // rest of the sheet still renders.

  function isPureSeriesValue(value) {
    return value === null || (typeof value === 'number' && Number.isFinite(value))
  }

  function compileChartSeries(series, meta) {
    var source = isObject(series) ? series : {}
    var chartsMeta = Array.isArray(meta && meta.charts) ? meta.charts : []
    var charts = []
    var missing = []
    var invalid = []
    chartsMeta.forEach(function (c) {
      var id = c && c.id
      var label = String((c && c.label) || id || '')
      var raw = source[id]
      if (raw === undefined || raw === null) {
        missing.push({ id: id, label: label })
        return
      }
      // Scenario compare: a chartId may hold an object of variants
      // { "<variantLabel>": number[] } for side-by-side comparison, or a flat
      // number[] (single neutral flow). Both are pure JSON data.
      var variants = []
      if (Array.isArray(raw)) {
        variants.push({ label: label, values: raw })
      } else if (isObject(raw)) {
        var keys = Object.keys(raw)
        if (keys.length === 0) {
          missing.push({ id: id, label: label })
          return
        }
        for (var k = 0; k < keys.length; k++) {
          var vLabel = String(keys[k])
          var v = raw[keys[k]]
          if (!Array.isArray(v)) {
            invalid.push({ id: id, label: label, detail: 'variant "' + vLabel + '" is not an array' })
            return
          }
          variants.push({ label: vLabel, values: v })
        }
      } else {
        invalid.push({ id: id, label: label, detail: 'series must be an array or a variants map' })
        return
      }
      for (var vi = 0; vi < variants.length; vi++) {
        var values = variants[vi].values
        for (var i = 0; i < values.length; i++) {
          if (!isPureSeriesValue(values[i])) {
            invalid.push({
              id: id,
              label: label,
              detail: 'non-pure series value at index ' + i + ' in variant "' + variants[vi].label + '"',
            })
            return
          }
        }
      }
      var n = Math.max.apply(null, variants.map(function (v) { return v.values.length }))
      var xs = []
      for (var xi = 0; xi < (Number.isFinite(n) ? n : 0); xi++) xs.push(xi)
      charts.push({
        id: id,
        label: label,
        xs: xs,
        variants: variants,
        count: Number.isFinite(n) ? n : 0,
      })
    })
    return { ok: missing.length === 0 && invalid.length === 0, charts: charts, missing: missing, invalid: invalid }
  }

  function monthAxis(meta, count) {
    var startMonth = Number(meta && meta.startMonth) || 1
    var startYear = Number(meta && meta.startYear) || 1970
    var n = Math.max(0, Number(count) || 0)
    var labels = []
    for (var i = 0; i < n; i++) {
      var m = ((startMonth - 1 + i) % 12) + 1
      var y = startYear + Math.floor((startMonth - 1 + i) / 12)
      labels.push(String(y) + '-' + pad2(m))
    }
    return labels
  }

  var FORBIDDEN_META_PROPERTIES = [
    'knowledge',
    'knowledge_version',
    'session_label',
    'source_model',
    'source_model_version',
  ]
  var FORBIDDEN_ITEM_PROPERTIES = [
    'status',
    'layer',
    'severity',
    'target_hash',
    'stale',
    'field',
  ]
  var BASE_HASH_PATTERN = /^[0-9a-f]{16}$/
  var SOURCE_SHA256_PATTERN = /^[0-9a-f]{64}$/

  function draftToItem(draft) {
    return Review.draftToItem(draft)
  }

  function buildExportDoc(args) {
    var input = isObject(args) ? args : {}
    var meta = isObject(input.meta) ? Object.assign({}, input.meta) : {}
    var drafts = Array.isArray(input.drafts)
      ? input.drafts
      : Array.isArray(input.items)
        ? input.items
        : []
    var items = drafts.map(function (d, index) {
      var item = draftToItem(d)
      var draftId = d && d.id ? d.id : 'fb-' + String(index + 1).padStart(3, '0')
      if (!d.id) {
        item.id = draftId
      }
      if (!item.base_hash) {
        throw new Error('innfo-console: draft "' + draftId + '" is missing required base_hash')
      }
      return item
    })
    return { meta: meta, items: items }
  }

  function serializeFeedback(doc) {
    return JSON.stringify(doc, null, 2) + '\n'
  }

  function validateFeedback(doc) {
    var errors = []
    if (!isObject(doc)) return { ok: false, errors: ['document: must be an object'] }

    var meta = doc.meta
    if (!isObject(meta)) {
      errors.push('meta: required object is missing')
    } else {
      FORBIDDEN_META_PROPERTIES.forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(meta, key)) {
          errors.push('meta.' + key + ': forbidden property is present')
        }
      })
      Object.keys(meta).forEach(function (key) {
        if (key.indexOf('source_model') === 0 && FORBIDDEN_META_PROPERTIES.indexOf(key) === -1) {
          errors.push('meta.' + key + ': forbidden property is present')
        }
      })
      if (!meta.source_knowledge || typeof meta.source_knowledge !== 'string') {
        errors.push('meta.source_knowledge: required non-empty string is missing')
      }
      if (!MODEL_VERSION_PATTERN.test(String(meta.source_knowledge_version || ''))) {
        errors.push(
          'meta.source_knowledge_version: must match V_x-y-z (got ' + meta.source_knowledge_version + ')',
        )
      }
      if (!meta.artifact || typeof meta.artifact !== 'string') {
        errors.push('meta.artifact: required non-empty string is missing')
      }
      if (!meta.artifact_version || typeof meta.artifact_version !== 'string') {
        errors.push('meta.artifact_version: required non-empty string is missing')
      }
      if (!isValidExportedAt(meta.exported_at)) {
        errors.push(
          'meta.exported_at: must be ISO-8601 with seconds (got ' + meta.exported_at + ')',
        )
      }
      if (!meta.author || typeof meta.author !== 'string') {
        errors.push('meta.author: required non-empty string is missing')
      }
      var slug = meta.feedback_slug
      if (typeof slug !== 'string' || !SLUG_PATTERN.test(slugify(slug))) {
        errors.push('meta.feedback_slug: required URL-safe slug is missing')
      }
      if (!meta.viewer || typeof meta.viewer !== 'string') {
        errors.push('meta.viewer: required non-empty string is missing')
      }
      if (meta.source_sha256 !== undefined) {
        if (typeof meta.source_sha256 !== 'string' || !SOURCE_SHA256_PATTERN.test(meta.source_sha256)) {
          errors.push('meta.source_sha256: must be a 64-character hex string')
        }
      }
    }

    if (!Array.isArray(doc.items)) {
      errors.push('items: required array is missing')
    } else {
      doc.items.forEach(function (item, index) {
        var where = isObject(item) && typeof item.id === 'string' ? item.id : '#' + index
        if (!isObject(item)) {
          errors.push(where + ': must be an object')
          return
        }
        FORBIDDEN_ITEM_PROPERTIES.forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            errors.push(where + '.' + key + ': forbidden property is present')
          }
        })
        if (!ITEM_ID_PATTERN.test(String(item.id || ''))) {
          errors.push(where + ': id must match fb-NNN (got ' + item.id + ')')
        }
        if (ITEM_KINDS.indexOf(item.kind) === -1) {
          errors.push(
            where + ': kind must be one of ' + ITEM_KINDS.join('|') + ' (got ' + item.kind + ')',
          )
        }
        if (!isObject(item.target) || Object.keys(item.target).length === 0) {
          errors.push(where + ': target must be a non-empty object')
        }
        if (item.base_hash !== undefined) {
          if (typeof item.base_hash !== 'string' || !BASE_HASH_PATTERN.test(item.base_hash)) {
            errors.push(where + '.base_hash: must match ^[0-9a-f]{16}$')
          }
        }
      })
    }

    return { ok: errors.length === 0, errors: errors }
  }

  /* Browser console: banner, rail, search, cards, matrices, drafts, export modal.
     Runs only where document/localStorage exist; pure helpers above stay DOM-free. */

  function el(tag, cls, text) {
    var node = typeof document !== 'undefined' ? document.createElement(tag) : null
    if (!node) return null
    if (cls) node.className = cls
    if (text != null) node.textContent = String(text)
    return node
  }

  function renderBanner(doc, meta, needs, draftCount, onReviewerChange, state) {
    var banner = doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
    if (!banner) return
    var existingOpen = banner.querySelector('#innfo-feedback-open') || banner.querySelector('#innfo-export-open')
    banner.innerHTML = ''
    var title = el('strong', null, String(meta.title || meta.model || 'iNNfo Console'))
    var version = el(
      'span',
      'innfo-banner-version',
      ' ' + String(meta.modelVersion || meta.knowledge_version || ''),
    )
    var needsBadge = el(
      'span',
      'innfo-banner-needs',
      ' needs: ' + (needs && needs.length ? needs.join(', ') : 'none'),
    )
    var draftsBadge = el('span', 'innfo-banner-drafts', ' drafts: ' + (draftCount || 0))
    draftsBadge.setAttribute('data-innfo', 'draft-count')

    banner.appendChild(title)
    banner.appendChild(version)
    banner.appendChild(needsBadge)
    banner.appendChild(draftsBadge)

    // Reviewer Profile Chip (Requirement: Reviewer Identity Profile Chip)
    var reviewerName = getReviewerName()
    var chip = el('div', 'innfo-reviewer-chip')
    if (chip) {
      var chipLabel = el('span', 'innfo-reviewer-label', 'Reviewer: ')
      var chipName = el('span', 'innfo-reviewer-name', reviewerName)
      var editBtn = el('button', 'innfo-reviewer-edit', '✏️')
      if (editBtn) {
        editBtn.setAttribute('type', 'button')
        editBtn.setAttribute('title', 'Edit reviewer identity')
        editBtn.setAttribute('aria-label', 'Edit reviewer identity')
      }
      function handleEdit() {
        // C5: the reviewer identifier is edited in the feedback modal's
        // identifier field, not a window.prompt.
        var modal = doc.getElementById('innfo-feedback-modal')
        if (!modal) return
        if (typeof modal.showModal === 'function' && !modal.open) {
          modal.showModal()
        } else {
          modal.setAttribute('open', 'open')
        }
        var input = modal.querySelector('[data-innfo="identifier"]')
        if (input && typeof input.focus === 'function') input.focus()
      }
      chip.addEventListener('click', function (e) {
        if (e.target === editBtn || editBtn.contains(e.target) || e.target === chipName) {
          handleEdit()
        }
      })
      if (chipLabel) chip.appendChild(chipLabel)
      if (chipName) chip.appendChild(chipName)
      if (editBtn) chip.appendChild(editBtn)
      banner.appendChild(chip)
    }

    if (existingOpen) {
      banner.appendChild(existingOpen)
    } else if (banner.id === 'innfo-feedback-banner') {
      var openBtn = el('button', 'innfo-feedback-open', 'Export changes')
      if (openBtn) {
        openBtn.id = 'innfo-feedback-open'
        openBtn.setAttribute('type', 'button')
        if (state) {
          openBtn.setAttribute('data-innfo-bound', '1')
          openBtn.addEventListener('click', function () {
            openExportModal(doc, state)
          })
        }
        banner.appendChild(openBtn)
      }
    }
  }

  function renderStatsBar(doc, elements, concepts, matrices, draftCount) {
    var host = doc.getElementById('innfo-stats-bar')
    if (!host) return
    host.innerHTML = ''

    var totalElements = Array.isArray(elements) ? elements.length : 0
    var totalConcepts = Array.isArray(concepts) ? concepts.length : 0
    var totalMatrices = Array.isArray(matrices) ? matrices.length : 0
    var pendingReviews = typeof draftCount === 'number' ? draftCount : 0

    var stats = [
      {
        label: 'Total Elements',
        value: totalElements,
        icon: 'boxes',
        color: '#3b82f6',
        bg: '#eff6ff',
      },
      {
        label: 'Active Concepts',
        value: totalConcepts,
        icon: 'layers',
        color: '#8b5cf6',
        bg: '#f5f3ff',
      },
      {
        label: 'Matrices',
        value: totalMatrices,
        icon: 'table',
        color: '#10b981',
        bg: '#ecfdf5',
      },
      {
        label: 'Review Notes',
        value: pendingReviews,
        icon: 'file-text',
        color: pendingReviews > 0 ? '#ef4444' : '#6b7280',
        bg: pendingReviews > 0 ? '#fef2f2' : '#f3f4f6',
      },
    ]

    stats.forEach(function (s) {
      var card = el('div', 'innfo-stat-card')
      var iconWrap = el('div', 'innfo-stat-icon')
      iconWrap.style.backgroundColor = s.bg
      iconWrap.style.color = s.color
      iconWrap.innerHTML = UI.icon(s.icon, 22)

      var body = el('div', 'innfo-stat-body')
      var label = el('div', 'innfo-stat-label', s.label)
      var val = el('div', 'innfo-stat-value', s.value)

      body.appendChild(label)
      body.appendChild(val)
      card.appendChild(iconWrap)
      card.appendChild(body)
      host.appendChild(card)
    })
  }

  function renderFilterBar(doc, state, onQueryChange, activeQuery) {
    var host = doc.getElementById('innfo-filter-facets')
    var activeHost = doc.getElementById('innfo-active-filters')
    if (!host) return
    host.innerHTML = ''
    if (activeHost) activeHost.innerHTML = ''

    var models = state && state.meta && Array.isArray(state.meta.models) ? state.meta.models : []
    var parsed = parseFilterQuery(activeQuery || '')

    // Extract active values for model and concept
    var activeModels = []
    var activeConcepts = []
    parsed.operators.forEach(function (op) {
      if (op.key === 'model' || op.key === 'file') activeModels.push(op.val.toLowerCase())
      else if (op.key === 'concept') activeConcepts.push(op.val.toLowerCase())
    })

    function toggleFacet(key, val, add) {
      var newOps = []
      var removed = false
      var lowerVal = String(val).toLowerCase()

      parsed.operators.forEach(function (op) {
        if ((op.key === key || (key === 'model' && op.key === 'file')) && op.val.toLowerCase() === lowerVal) {
          if (!add) removed = true
          else newOps.push(op)
        } else {
          newOps.push(op)
        }
      })

      if (add && !removed) {
        var needsQuote = String(val).indexOf(' ') !== -1
        var formattedVal = needsQuote ? '"' + val + '"' : val
        newOps.push({ key: key, val: val, raw: key + ':' + formattedVal })
      }

      var queryParts = parsed.textTokens.map(function (t) {
        return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
      })
      newOps.forEach(function (op) {
        if (op.raw) queryParts.push(op.raw)
        else {
          var nq = String(op.val).indexOf(' ') !== -1
          queryParts.push(op.key + ':' + (nq ? '"' + op.val + '"' : op.val))
        }
      })

      var nextQuery = queryParts.join(' ')
      if (typeof onQueryChange === 'function') onQueryChange(nextQuery)
    }

    // 1. Models Dropdown
    if (models.length > 1) {
      var mWrap = el('div', 'innfo-facet-dropdown')
      var mBtn = el('button', 'innfo-facet-btn' + (activeModels.length > 0 ? ' active' : ''))
      mBtn.setAttribute('type', 'button')
      var mIcon = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('file-text', { size: 14 }) : '📄'
      var mLabel = activeModels.length > 0 ? 'Models (' + activeModels.length + ')' : 'Models'
      mBtn.innerHTML = mIcon + ' <span>' + mLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var mMenu = el('div', 'innfo-facet-menu')
      models.forEach(function (m) {
        var item = el('label', 'innfo-facet-item')
        var cb = el('input', 'innfo-facet-checkbox')
        cb.type = 'checkbox'
        var mMatchKey = (m.id || m.filePath || '').toLowerCase()
        var isChecked = activeModels.some(function (am) {
          return am === mMatchKey || (m.filePath && am === m.filePath.toLowerCase()) || (m.id && am === m.id.toLowerCase())
        })
        cb.checked = isChecked

        cb.addEventListener('change', function () {
          toggleFacet('model', m.id || m.filePath, cb.checked)
        })

        var nameSpan = el('span', 'flex-1 truncate font-medium text-slate-700', m.title || m.filePath)
        nameSpan.title = m.filePath || m.title || ''
        var cntBadge = el('span', 'badge badge-xs badge-ghost font-mono', String(m.elementCount || 0))

        item.appendChild(cb)
        item.appendChild(nameSpan)
        item.appendChild(cntBadge)
        mMenu.appendChild(item)
      })

      mBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = mMenu.classList.contains('open')
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (menu) { menu.classList.remove('open') })
        if (!isOpen) mMenu.classList.add('open')
      })

      mWrap.appendChild(mBtn)
      mWrap.appendChild(mMenu)
      host.appendChild(mWrap)
    }

    // 2. Concepts Dropdown
    var allConcepts = []
    if (state && Array.isArray(state.elements)) {
      var conceptCounts = {}
      state.elements.forEach(function (e) {
        if (e && e.concept) {
          conceptCounts[e.concept] = (conceptCounts[e.concept] || 0) + 1
        }
      })
      Object.keys(conceptCounts).sort().forEach(function (cName) {
        allConcepts.push({ name: cName, count: conceptCounts[cName] })
      })
    }

    if (allConcepts.length > 0) {
      var cWrap = el('div', 'innfo-facet-dropdown')
      var cBtn = el('button', 'innfo-facet-btn' + (activeConcepts.length > 0 ? ' active' : ''))
      cBtn.setAttribute('type', 'button')
      var cIcon = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('layers', { size: 14 }) : '🏷️'
      var cLabel = activeConcepts.length > 0 ? 'Concepts (' + activeConcepts.length + ')' : 'Concepts'
      cBtn.innerHTML = cIcon + ' <span>' + cLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var cMenu = el('div', 'innfo-facet-menu')
      allConcepts.forEach(function (c) {
        var item = el('label', 'innfo-facet-item')
        var cb = el('input', 'innfo-facet-checkbox')
        cb.type = 'checkbox'
        var isChecked = activeConcepts.indexOf(c.name.toLowerCase()) !== -1
        cb.checked = isChecked

        cb.addEventListener('change', function () {
          toggleFacet('concept', c.name, cb.checked)
        })

        var nameSpan = el('span', 'flex-1 truncate font-medium text-slate-700', c.name)
        var cntBadge = el('span', 'badge badge-xs badge-ghost font-mono', String(c.count))

        item.appendChild(cb)
        item.appendChild(nameSpan)
        item.appendChild(cntBadge)
        cMenu.appendChild(item)
      })

      cBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = cMenu.classList.contains('open')
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (menu) { menu.classList.remove('open') })
        if (!isOpen) cMenu.classList.add('open')
      })

      cWrap.appendChild(cBtn)
      cWrap.appendChild(cMenu)
      host.appendChild(cWrap)
    }

    // 3. Clear button if any filter is active
    if (activeQuery) {
      var clearBtn = el('button', 'btn btn-ghost btn-xs text-xs text-slate-500 hover:text-error', 'Clear filters')
      clearBtn.setAttribute('type', 'button')
      clearBtn.addEventListener('click', function () {
        if (typeof onQueryChange === 'function') onQueryChange('')
      })
      host.appendChild(clearBtn)
    }

    // 4. Render Active Filter Pills below the bar
    if (activeHost && (parsed.operators.length > 0 || parsed.textTokens.length > 0)) {
      parsed.operators.forEach(function (op) {
        var pill = el('span', 'badge badge-sm badge-outline gap-1 font-mono text-[11px] py-2 px-2.5 bg-base-100')
        var labelText = op.key + ':' + op.val
        pill.innerHTML = '<span>' + labelText + '</span>'
        var removeBtn = el('button', 'ml-1 hover:text-error cursor-pointer font-bold', '×')
        removeBtn.setAttribute('type', 'button')
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          toggleFacet(op.key, op.val, false)
        })
        pill.appendChild(removeBtn)
        activeHost.appendChild(pill)
      })

      parsed.textTokens.forEach(function (token) {
        var pill = el('span', 'badge badge-sm badge-outline gap-1 font-mono text-[11px] py-2 px-2.5 bg-base-100')
        pill.innerHTML = '<span>"' + token + '"</span>'
        var removeBtn = el('button', 'ml-1 hover:text-error cursor-pointer font-bold', '×')
        removeBtn.setAttribute('type', 'button')
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          var nextTokens = parsed.textTokens.filter(function (t) { return t !== token })
          var nextQuery = nextTokens.concat(parsed.operators.map(function (o) { return o.raw || (o.key + ':' + o.val) })).join(' ')
          if (typeof onQueryChange === 'function') onQueryChange(nextQuery)
        })
        pill.appendChild(removeBtn)
        activeHost.appendChild(pill)
      })
    }

    // Close menus on outside click
    if (!doc.__facetOutsideListener) {
      doc.__facetOutsideListener = true
      doc.addEventListener('click', function () {
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (m) {
          m.classList.remove('open')
        })
      })
    }
  }

  function renderRail(doc, concepts, counts, draftCountsByConcept, onSelect, state) {
    var rail = doc.getElementById('innfo-rail')
    if (!rail) return
    rail.innerHTML = ''

    var models = state && state.meta && Array.isArray(state.meta.models) && state.meta.models.length > 1
      ? state.meta.models
      : null

    // 1. Domain blueprint cards (mockup-2 layout): one card per model with its
    //    blueprint tag, version, element/concept counts and a pending-changes badge.
    //    Clicking a card sets the `model:` facet, filtering the unified console.
    if (models) {
      models.forEach(function (m) {
        var card = (doc.createElement ? doc.createElement('div') : el('div'))
        if (!card) return
        card.className = 'innfo-bp-card'
        card.setAttribute('data-model', String(m.id || m.filePath))
        var tagText = m.blueprint || m.tag || ''
        var titleText = m.title || m.filePath || 'Model'
        var versionText = m.version || m.modelVersion || ''
        var conceptCount = Array.isArray(m.conceptNames) ? m.conceptNames.length : (m.conceptCount || 0)
        var changeCount = m.changeCount || m.draftCount || 0
        card.innerHTML =
          '<div class="bp-top"><span class="bp-tag">' + tagText + '</span><span class="bp-version">' + versionText + '</span></div>' +
          '<div class="bp-title">' + titleText + '</div>' +
          (changeCount > 0 ? '<span class="bp-changes">' + changeCount + ' pending</span>' : '') +
          '<div class="bp-meta"><span><strong>' + (m.elementCount || 0) + '</strong> elements</span><span><strong>' + conceptCount + '</strong> concepts</span></div>'

        card.addEventListener('click', function () {
          if (typeof onSelect === 'function') onSelect('model:' + (m.id || m.filePath))
        })
        rail.appendChild(card)
      })
    }

    // 2. Concepts list (clean, flat, and responsive)
    var cHdr = el('div', 'innfo-rail-header')
    cHdr.innerHTML = '<span>Concepts (' + (concepts ? concepts.length : 0) + ')</span>'
    rail.appendChild(cHdr)

    ;(Array.isArray(concepts) ? concepts : []).forEach(function (concept, index) {
      var name = typeof concept === 'string' ? concept : concept.name
      var count = counts[name] || 0
      var draftCount = draftCountsByConcept ? draftCountsByConcept[name] || 0 : 0
      var btn = (doc.createElement ? doc.createElement('button') : el('button'))
      if (!btn) return
      btn.className = 'innfo-rail-item'
      btn.setAttribute('data-concept', String(name))
      var pill = UI.ConceptPill({ id: name, label: name, index: index, count: count }, { document: doc })
      if (pill) btn.appendChild(pill)
      if (draftCount > 0) {
        var badge = el('span', 'innfo-rail-badge', String(draftCount))
        if (badge) {
          badge.setAttribute('title', draftCount + ' unexported draft note(s)')
          btn.appendChild(badge)
        }
      }
      btn.addEventListener('click', function () {
        if (typeof onSelect === 'function') onSelect('concept:' + String(name))
      })
      rail.appendChild(btn)
    })
  }

  // Cards project live drafts: active draft edits and notes are visually badged,
  // new draft elements are projected, and deleted elements are styled.
  function mountElementCards(doc, elements, drafts, refs, concepts) {
    var content = doc.getElementById('innfo-content')
    if (!content) return
    content.innerHTML = ''

    var draftsByElementId = {}
    var newDrafts = []
    ;(Array.isArray(drafts) ? drafts : []).forEach(function (d) {
      if (!d) return
      if (d.kind === 'new') {
        newDrafts.push(d)
      } else if (d.element_id) {
        draftsByElementId[String(d.element_id)] = d
      }
    })

    var projectedElements = (Array.isArray(elements) ? elements : []).map(function (el) {
      if (!isObject(el)) return el
      var clone = Object.assign({}, el)
      if (clone.fields && isObject(clone.fields)) {
        clone.fields = Object.assign({}, clone.fields)
      } else {
        clone.fields = {}
      }
      var draft = draftsByElementId[clone.id]
      if (draft) {
        clone._draft = draft
        if (draft.kind === 'correction' && draft.field && draft.proposed !== undefined) {
          clone.fields[draft.field] = draft.proposed
        }
      }
      return clone
    })

    newDrafts.forEach(function (nd) {
      projectedElements.push({
        id: nd.element_id || ('new-' + nd.id),
        name: nd.element || 'New Draft Element',
        concept: nd.concept || 'Draft',
        description: nd.comment || 'Draft element pending application',
        fields: nd.fields && isObject(nd.fields) ? nd.fields : {},
        _draft: nd,
      })
    })

    var visuals = typeof self !== 'undefined' && self.InnfoVisuals ? self.InnfoVisuals : null

    projectedElements.forEach(function (element) {
      var fields = []
      if (isObject(element.fields)) {
        Object.keys(element.fields).forEach(function (k) {
          var val = element.fields[k]
          var target = refs && isObject(refs[String(val)]) ? refs[String(val)] : null
          fields.push({
            name: k,
            value: val,
            ref: target ? { id: target.id || String(val), label: String(val) } : undefined,
          })
        })
      }

      var card = UI.ElementCard(
        {
          id: element.id,
          name: element.name || element.id || '',
          conceptId: element.concept,
          description: element.description,
          fields: fields,
        },
        {
          domId: String(element.id || ''),
          collapsible: false,
          onRef: function (refId) {
            var target = refs && isObject(refs[String(refId)]) ? refs[String(refId)] : null
            if (target) renderRefDialog(doc, target)
          },
        },
      )

      // Discrete concept color left border & badge affordance
      var cDef = (Array.isArray(concepts) ? concepts : []).find(function (c) {
        return c && (typeof c === 'string' ? c : c.name) === element.concept
      })
      var cColor = (cDef && cDef.color) || '#3b82f6'
      var hexColor = visuals && typeof visuals.getHexColor === 'function' ? visuals.getHexColor(cColor) : cColor
      card.style.borderLeft = '3px solid ' + hexColor

      var head = card.querySelector('.innfo-card-head, header')
      if (head) {
        var metaWrap = el('div', 'flex items-center gap-1.5 flex-wrap ml-auto mr-2')
        if (element.concept) {
          var cBadge = el('span', 'badge badge-outline badge-xs text-xs font-semibold')
          cBadge.style.borderColor = hexColor
          cBadge.style.color = hexColor
          cBadge.textContent = element.concept
          metaWrap.appendChild(cBadge)
        }
        if (element.modelFile) {
          var mBadge = el('span', 'badge badge-ghost badge-xs text-xs font-mono', element.modelFile)
          mBadge.setAttribute('title', 'Knowledge Unit: ' + (element.canonicalUnit || element.unitSlug || element.modelFile))
          metaWrap.appendChild(mBadge)

          var kuText = element.canonicalUnit || element.unitSlug || (element.modelFile + '@' + element.id)
          var copyBtn = el('button', 'btn btn-ghost btn-xs p-0.5 text-slate-400 hover:text-primary transition-colors cursor-pointer')
          copyBtn.setAttribute('type', 'button')
          copyBtn.setAttribute('title', 'Copy Knowledge Unit locator: ' + kuText)
          copyBtn.setAttribute('aria-label', 'Copy Knowledge Unit locator')
          copyBtn.innerHTML = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('copy', { size: 12 }) : '📋'
          copyBtn.addEventListener('click', function (ev) {
            ev.stopPropagation()
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(kuText)
              copyBtn.innerHTML = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('check', { size: 12, class: 'text-success' }) : '✓'
              setTimeout(function () {
                copyBtn.innerHTML = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('copy', { size: 12 }) : '📋'
              }, 2000)
            }
          })
          metaWrap.appendChild(copyBtn)
        }
        var insertBeforeNode = head.children && head.children.length > 1 ? head.children[1] : null
        head.insertBefore(metaWrap, insertBeforeNode)
      }

      if (element._draft) {
        var d = element._draft
        var badgeCls = 'badge badge-sm ' + (d.kind === 'correction' ? 'badge-warning' : d.kind === 'new' ? 'badge-info' : d.kind === 'delete' ? 'badge-error' : 'badge-neutral')
        var badgeText = d.kind === 'correction' ? 'Draft Edit' : d.kind === 'new' ? 'New Draft' : d.kind === 'delete' ? 'Delete Proposed' : 'Has Comment'
        var draftBadge = doc.createElement('span')
        draftBadge.className = 'innfo-card-draft-badge ' + badgeCls + ' ml-2'
        draftBadge.textContent = badgeText

        var titleEl = card.querySelector('.innfo-card-title, h3, header')
        if (titleEl) {
          titleEl.appendChild(draftBadge)
        }

        if (d.kind === 'delete') {
          card.classList.add('opacity-50', 'line-through')
        } else if (d.kind === 'correction') {
          card.classList.add('border-l-4', 'border-warning')
        } else if (d.kind === 'new') {
          card.classList.add('border-l-4', 'border-info')
        }
      }

      content.appendChild(card)
    })
  }

  function renderMatrices(doc, matrices) {
    var host = doc.getElementById('innfo-matrices')
    if (!host) return
    host.innerHTML = ''
    ;(Array.isArray(matrices) ? matrices : []).forEach(function (matrix) {
      if (!isObject(matrix)) return
      var section = el('section', 'innfo-matrix')
      if (!section) return
      section.appendChild(el('h3', null, String(matrix.name || 'Matrix')))
      var table = el('table', null, null)
      if (!table) return
      var rows = Array.isArray(matrix.rows) ? matrix.rows : []
      var cols = Array.isArray(matrix.cols) ? matrix.cols : []
      var cells = isObject(matrix.cells) ? matrix.cells : {}

      var isStructured = rows.length && isObject(rows[0])
      if (isStructured && !cols.length) {
        var colMap = {}
        rows.forEach(function (r) {
          if (r && isObject(r.cells)) {
            Object.keys(r.cells).forEach(function (k) { colMap[k] = true })
          }
        })
        cols = Object.keys(colMap)
      }

      var head = el('tr', null, null)
      if (head) {
        head.appendChild(el('th', null, ''))
        cols.forEach(function (c) {
          if (head) head.appendChild(el('th', null, String(c)))
        })
        table.appendChild(head)
      }
      rows.forEach(function (r) {
        var tr = el('tr', null, null)
        if (!tr) return
        var rowLabel = isStructured ? (r.sourceLabel || r.sourceId || '') : String(r)
        var rowCells = isStructured ? (r.cells || {}) : (cells[r] || cells[String(r)] || {})
        tr.appendChild(el('th', null, rowLabel))
        cols.forEach(function (c) {
          var value = rowCells[c] != null ? String(rowCells[c]) : ''
          tr.appendChild(el('td', null, value))
        })
        table.appendChild(tr)
      })
      section.appendChild(table)
      host.appendChild(section)
    })
  }

  // Renders uPlot charts from the pure-data series mapping (charts capability).
  // Called by a view with a host element; a missing/invalid series skips the
  // chart with a console warning; requires the vendored uPlot global that ships
  // inside innfo-console.bundle.js. Never evaluates slot JavaScript.
  function renderCharts(host, model, meta) {
    if (!host) return
    var compiled = compileChartSeries(isObject(model) ? model.series : {}, meta)
    compiled.missing.forEach(function (c) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-console: chart skipped — missing series for chart "' + c.id + '"')
    })
    compiled.invalid.forEach(function (c) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-console: chart skipped — ' + c.label + ' (' + c.detail + ')')
    })
    // uPlot is vendored into the single-file bundle (see build-console-bundle.mjs);
    // the runtime also tolerates standalone loads where it is absent.
    var U =
      typeof uPlot !== 'undefined'
        ? uPlot
        : typeof self !== 'undefined' && self.uPlot
          ? self.uPlot
          : null
    if (!U) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-console: uPlot unavailable — charts need the vendored console bundle')
      return
    }
    var windowCount =
      (Number(meta && meta.months) || 0) + (Number(meta && meta.historyMonths) || 0)
    compiled.charts.forEach(function (chart) {
      var section = el('section', 'innfo-chart')
      if (!section) return
      var heading = el('h3', 'innfo-chart-title', chart.label)
      if (heading) section.appendChild(heading)
      var canvas = el('div', 'innfo-chart-canvas')
      if (canvas) section.appendChild(canvas)
      host.appendChild(section)
      var labels = monthAxis(meta, windowCount || chart.count)
      // Scenario compare: one uPlot series per variant (single-variant charts
      // keep the neutral label); distinct colors come from a fixed palette.
      var palette = ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2']
      var seriesDefs = [{ label: 'Month' }]
      var dataSeries = []
      for (var v = 0; v < chart.variants.length; v++) {
        var variant = chart.variants[v]
        seriesDefs.push({
          label: variant.label,
          stroke: palette[v % palette.length],
          width: 2,
          nullGaps: true,
        })
        dataSeries.push(variant.values)
      }
      try {
        new U(
          {
            width: Math.max(320, host.clientWidth || 640),
            height: 240,
            legend: { show: true },
            scales: { x: { time: false } },
            series: seriesDefs,
            axes: [
              {
                values: function (_self, ticks) {
                  return ticks.map(function (t) {
                    return labels[Number(t)] != null ? labels[Number(t)] : String(t)
                  })
                },
              },
              {},
            ],
          },
          [chart.xs].concat(dataSeries),
          canvas,
        )
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn)
          console.warn('innfo-console: chart render failed for "' + chart.id + '"', err)
      }
    })
  }

  function formatGridNumber(v) {
    if (v == null || isNaN(v)) return '-'
    var abs = Math.abs(v)
    if (abs >= 1000000) return (v / 1000000).toFixed(1) + 'M'
    if (abs >= 10000) return Math.round(v).toLocaleString()
    if (abs >= 100) return (Math.round(v * 10) / 10).toLocaleString()
    return (Math.round(v * 100) / 100).toString()
  }

  function normalizeKey(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  // Theme synchronization for embedded iframes now lives in ui-kit.js
  // (InnfoUI.setTheme -> html[data-theme]); the class-based mechanism is gone.

  function baseValueOf(row) {
    return row.base != null
      ? Number(row.base)
      : row.metricValue != null
        ? Number(row.metricValue)
        : row.val != null
          ? Number(row.val)
          : 0
  }

  function growValue(base, growth, m) {
    var factor = Number(growth.factor) || 0
    if (growth.mode === 'compound' && factor) return base * Math.pow(1 + factor / 100, m)
    if (growth.mode === 'additive' && factor) return base + factor * m
    return base
  }

  function evaluateFormulaTree(row, m, rowMap, overrides, memo, growthState, historyCount) {
    var memoKey = row.id + '|' + m
    if (memo[memoKey] !== undefined) return memo[memoKey]
    if (memo[memoKey] === null) return 0 // cycle guard
    memo[memoKey] = null

    var val = 0
    var isVar = row.variable || (!row.formula && (row.base != null || row.metricValue != null || row.val != null))

    if (isVar) {
      var growth = growthState[row.id] || row.growth || { mode: 'fixed', factor: 0 }
      if (overrides[row.id] !== undefined) {
        if (typeof overrides[row.id] === 'number') {
          val = growValue(Number(overrides[row.id]) || 0, growth, m)
        } else if (overrides[row.id] && overrides[row.id][m] !== undefined) {
          val = Number(overrides[row.id][m]) || 0
        } else {
          val = growValue(baseValueOf(row), growth, m)
        }
      } else {
        val = growValue(baseValueOf(row), growth, m)
      }
    } else if (Array.isArray(row.history) && m < row.history.length && row.history[m] !== null) {
      val = Number(row.history[m]) || 0
    } else if (row.formula) {
      val = parseAndEvalFormula(String(row.formula).trim(), m, rowMap, overrides, memo, growthState, historyCount)
      var gRow = growthState[row.id] || row.growth || { mode: 'fixed', factor: 0 }
      var factorRow = Number(gRow.factor) || 0
      if (gRow.mode === 'compound' && factorRow) {
        val = val * Math.pow(1 + factorRow / 100, m)
      } else if (gRow.mode === 'additive' && factorRow) {
        val = val + factorRow * m
      }
    } else if (row.base != null) {
      val = Number(row.base)
    } else if (row.metricValue != null) {
      val = Number(row.metricValue)
    }

    memo[memoKey] = val
    return val
  }

  function parseAndEvalFormula(formula, m, rowMap, overrides, memo, growthState, historyCount) {
    if (!formula || /^<.*>$/.test(formula)) return 0
    var cleaned = formula.replace(/\s+[xX]\s+/g, ' * ')
    var tokens = cleaned.split(/(\s*[+\-*/]\s*)/).map(function (s) { return s.trim() }).filter(Boolean)
    if (!tokens.length) return 0

    function resolveOperand(token) {
      var num = Number(token)
      if (!isNaN(num)) return num
      var norm = normalizeKey(token)
      var targetRow = rowMap[norm]
      if (targetRow) {
        return evaluateFormulaTree(targetRow, m, rowMap, overrides, memo, growthState, historyCount)
      }
      return 0
    }

    var terms = []
    var ops = []
    var i = 0
    while (i < tokens.length) {
      var tok = tokens[i]
      if (tok === '+' || tok === '-') {
        ops.push(tok)
        i++
      } else {
        var currentVal = resolveOperand(tok)
        while (i + 1 < tokens.length && (tokens[i + 1] === '*' || tokens[i + 1] === '/')) {
          var op = tokens[i + 1]
          var nextOperand = resolveOperand(tokens[i + 2])
          if (op === '*') currentVal = currentVal * nextOperand
          else if (op === '/') currentVal = nextOperand !== 0 ? currentVal / nextOperand : 0
          i += 2
        }
        terms.push(currentVal)
        i++
      }
    }

    if (!terms.length) return 0
    var res = terms[0]
    for (var j = 0; j < ops.length; j++) {
      if (ops[j] === '+') res += terms[j + 1] || 0
      else if (ops[j] === '-') res -= terms[j + 1] || 0
    }
    return res
  }

  function exportTimelineCsv(meta, rows, totalMonths, labels, rowValues) {
    var lines = []
    lines.push('# Timeline & P&L Projection Export')
    lines.push('# Model: ' + (meta.model || ''))
    lines.push('# Version: ' + (meta.knowledge_version || meta.modelVersion || ''))
    lines.push('# Generated: ' + (meta.generated_at || meta.generated || ''))
    lines.push('')
    var header = ['Group', 'Metric', 'Type', 'Unit', 'Growth Rule']
    for (var m = 0; m < totalMonths; m++) {
      header.push(labels[m] != null ? labels[m] : 'Month ' + (m + 1))
    }
    header.push('Total')
    lines.push(header.map(function (s) { return '"' + String(s).replace(/"/g, '""') + '"' }).join(','))

    rows.forEach(function (r) {
      var g = r.growth || { mode: 'fixed', factor: 0 }
      var vals = rowValues[r.id] || []
      var sum = vals.reduce(function (a, b) { return a + b }, 0)
      var rowLine = [
        r.grp || '',
        r.label || r.id,
        r.metricType || '',
        r.metricUnit || '',
        g.mode + (g.factor ? ' (' + g.factor + ')' : '')
      ]
      for (var i = 0; i < totalMonths; i++) {
        rowLine.push(vals[i] != null ? Math.round(vals[i] * 100) / 100 : '')
      }
      rowLine.push(Math.round(sum * 100) / 100)
      lines.push(rowLine.map(function (s) { return '"' + String(s).replace(/"/g, '""') + '"' }).join(','))
    })

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = (meta.slug || 'timeline') + '_projection.csv'
      a.click()
      setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
    }
  }

  // Labels live in the kit now (single source of truth).
  var CITATION_ORIGIN_LABELS = UI.CITATION_ORIGIN_LABELS

  function getSemanticBarColor(val, minVal, maxVal, row) {
    if (row && row.colors && row.colors.gradient) {
      var grad = row.colors.gradient
      if (val <= minVal && grad.low) return grad.low
      if (val >= maxVal && grad.high) return grad.high
      if (grad.mid) return grad.mid
    }
    if (row && row.colors && row.colors.base) {
      return row.colors.base
    }

    if (val < 0) {
      return '#ef4444' // red for negative numbers
    }

    var metricType = (row && (row.metricType || row.type)) || ''
    var isCost = metricType === 'cost' || metricType === 'expense' || /cost|churn|cpa|cac|expense|churn/i.test((row && (row.id || row.label)) || '')

    var effectiveMin = Math.min(0, minVal)
    var effectiveMax = Math.max(0.0001, maxVal)
    var range = effectiveMax - effectiveMin
    var ratio = range > 0 ? (val - effectiveMin) / range : 1
    ratio = Math.max(0, Math.min(1, ratio))

    if (isCost) {
      // Cost metric: low is good (#86efac), mid is amber (#f59e0b), high is bad (#ef4444)
      if (ratio < 0.35) return '#86efac'
      if (ratio < 0.7) return '#f59e0b'
      return '#ef4444'
    } else {
      // Revenue / Profit / general: 0 is light neutral/gray (#cbd5e1), mid is mint (#6ee7b7), high is rich green (#059669)
      if (ratio < 0.25) return '#cbd5e1'
      if (ratio < 0.55) return '#6ee7b7'
      if (ratio < 0.85) return '#10b981'
      return '#059669'
    }
  }

  function renderStudioView(host, model, meta, rows, totalMonths, labels, rowMap, overrides, growthState, historyCount, onStateChange) {
    var studioHost = host
    if (!studioHost) return

    function computeValues() {
      var memo = {}
      var computed = {}
      rows.forEach(function (r) {
        var arr = []
        for (var m = 0; m < totalMonths; m++) {
          arr.push(evaluateFormulaTree(r, m, rowMap, overrides, memo, growthState, historyCount))
        }
        computed[r.id] = arr
      })
      return computed
    }

    var rowValues = computeValues()
    studioHost.innerHTML = ''

    var studioWrap = el('div', 'innfo-studio-layout')

    // Top Summary KPI Cards
    var kpisWrap = el('div', 'innfo-studio-kpis')
    
    var revRow = rows.filter(function (r) { return /revenue|ingreso/i.test(r.metricType || r.id || r.label) })[0]
    var costRow = rows.filter(function (r) { return /expense|cost|gasto/i.test(r.metricType || r.id || r.label) })[0]
    var netRow = rows.filter(function (r) { return /result|net|ebit|beneficio/i.test(r.metricType || r.id || r.label) })[0] || rows[0]

    var kpiList = []
    if (netRow && rowValues[netRow.id]) {
      var netSum = rowValues[netRow.id].reduce(function (a, b) { return a + b }, 0)
      kpiList.push({ label: 'Net Result (Year 1)', val: formatGridNumber(netSum), unit: netRow.metricUnit || 'USD', isHighlight: true })
    }
    if (revRow && rowValues[revRow.id]) {
      var revSum = rowValues[revRow.id].reduce(function (a, b) { return a + b }, 0)
      kpiList.push({ label: 'Total Revenue', val: formatGridNumber(revSum), unit: revRow.metricUnit || 'USD' })
    }
    if (costRow && rowValues[costRow.id]) {
      var costSum = rowValues[costRow.id].reduce(function (a, b) { return a + b }, 0)
      kpiList.push({ label: 'Total Expenses', val: formatGridNumber(costSum), unit: costRow.metricUnit || 'USD' })
    }

    kpiList.forEach(function (kpi) {
      var card = el('div', 'innfo-studio-kpi-card' + (kpi.isHighlight ? ' is-highlight' : ''))
      card.appendChild(el('div', 'innfo-studio-kpi-label', kpi.label))
      var valRow = el('div', 'innfo-studio-kpi-val-row')
      valRow.appendChild(el('span', 'innfo-studio-kpi-val', kpi.val))
      if (kpi.unit) valRow.appendChild(el('span', 'innfo-studio-kpi-unit', kpi.unit))
      card.appendChild(valRow)
      kpisWrap.appendChild(card)
    })
    studioWrap.appendChild(kpisWrap)

    // Main Studio Grid (Controls on Left, Scenario Curves on Right)
    var mainGrid = el('div', 'innfo-studio-grid')

    // Left Column: Interactive Variable Sliders
    var leftCol = el('div', 'innfo-studio-panel innfo-studio-controls')
    var leftHdr = el('div', 'innfo-studio-panel-hdr')
    leftHdr.appendChild(el('h4', 'innfo-studio-panel-title', 'Scenario Parameters & Sliders'))
    leftCol.appendChild(leftHdr)

    var varRows = rows.filter(function (r) {
      return r.variable || (!r.formula && (r.metricValue != null || r.val != null || r.base != null))
    })

    if (!varRows.length) {
      varRows = rows.slice(0, 4)
    }

    var sliderCardsWrap = el('div', 'innfo-studio-sliders-wrap')

    varRows.forEach(function (r) {
      var baseVal = r.metricValue !== undefined ? Number(r.metricValue) : (r.val !== undefined ? Number(r.val) : (r.base !== undefined ? Number(r.base) : 0))
      var currVal = overrides[r.id] !== undefined ? (typeof overrides[r.id] === 'number' ? overrides[r.id] : overrides[r.id][0]) : baseVal
      if (currVal === undefined || isNaN(currVal)) currVal = baseVal

      var minVal = baseVal > 0 ? Math.floor(baseVal * 0.2) : (baseVal < 0 ? Math.floor(baseVal * 2.5) : 0)
      var maxVal = baseVal > 0 ? Math.ceil(baseVal * 2.5) : (baseVal < 0 ? Math.ceil(baseVal * 0.2) : 100)
      if (minVal === maxVal) { minVal = 0; maxVal = 100; }
      var step = baseVal > 1000 ? 100 : (baseVal > 100 ? 10 : (baseVal > 10 ? 1 : 0.1))

      var card = el('div', 'innfo-slider-card')
      var cardTop = el('div', 'innfo-slider-card-top')
      cardTop.appendChild(el('span', 'innfo-slider-label', r.label || r.id))
      var numInput = el('input', 'innfo-slider-num-input')
      numInput.setAttribute('type', 'number')
      numInput.value = String(currVal)
      cardTop.appendChild(numInput)
      card.appendChild(cardTop)

      var sliderRow = el('div', 'innfo-slider-row')
      var slider = el('input', 'innfo-slider-range')
      slider.setAttribute('type', 'range')
      slider.setAttribute('min', String(minVal))
      slider.setAttribute('max', String(maxVal))
      slider.setAttribute('step', String(step))
      slider.value = String(currVal)

      function handleValChange(newVal) {
        var num = Number(newVal)
        if (isNaN(num)) return
        slider.value = String(num)
        numInput.value = String(num)
        overrides[r.id] = num
        onStateChange()
      }

      slider.addEventListener('input', function (e) {
        handleValChange(e.target.value)
      })
      numInput.addEventListener('change', function (e) {
        handleValChange(e.target.value)
      })

      sliderRow.appendChild(slider)
      card.appendChild(sliderRow)

      var cardMeta = el('div', 'innfo-slider-meta')
      cardMeta.appendChild(el('span', 'innfo-slider-range-hint', minVal + ' .. ' + maxVal + (r.metricUnit ? ' ' + r.metricUnit : '')))
      if (overrides[r.id] !== undefined && overrides[r.id] !== baseVal) {
        var resetLink = el('button', 'innfo-slider-reset', 'reset')
        resetLink.setAttribute('type', 'button')
        resetLink.addEventListener('click', function () {
          delete overrides[r.id]
          onStateChange()
        })
        cardMeta.appendChild(resetLink)
      }
      card.appendChild(cardMeta)
      sliderCardsWrap.appendChild(card)
    })

    leftCol.appendChild(sliderCardsWrap)
    mainGrid.appendChild(leftCol)

    // Right Column: Interactive Scenario Visualizer
    var rightCol = el('div', 'innfo-studio-panel innfo-studio-visualizer')
    var rightHdr = el('div', 'innfo-studio-panel-hdr')
    rightHdr.appendChild(el('h4', 'innfo-studio-panel-title', 'Scenario Projection Curves'))
    rightCol.appendChild(rightHdr)

    var chartBox = el('div', 'innfo-studio-chart-box')
    var svg = el('svg', 'innfo-studio-chart-svg')
    svg.setAttribute('viewBox', '0 0 700 300')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    var plotRows = [revRow, costRow, netRow].filter(Boolean)
    if (!plotRows.length) plotRows = rows.slice(0, 3)

    var allVals = []
    plotRows.forEach(function (pr) {
      if (rowValues[pr.id]) allVals = allVals.concat(rowValues[pr.id])
    })
    var minPlot = Math.min.apply(null, allVals) || 0
    var maxPlot = Math.max.apply(null, allVals) || 1
    if (minPlot > 0) minPlot = 0
    var rangePlot = (maxPlot - minPlot) || 1

    var padX = 60, padY = 30, plotW = 600, plotH = 220

    var zeroY = padY + plotH - ((0 - minPlot) / rangePlot) * plotH
    var zeroLine = el('line', 'innfo-chart-axis-line')
    zeroLine.setAttribute('x1', String(padX))
    zeroLine.setAttribute('y1', String(zeroY))
    zeroLine.setAttribute('x2', String(padX + plotW))
    zeroLine.setAttribute('y2', String(zeroY))
    svg.appendChild(zeroLine)

    var colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

    plotRows.forEach(function (pr, pidx) {
      var pVals = rowValues[pr.id] || []
      if (!pVals.length) return
      var pts = []
      for (var mi = 0; mi < totalMonths; mi++) {
        var vx = padX + (mi / Math.max(1, totalMonths - 1)) * plotW
        var vy = padY + plotH - (((pVals[mi] || 0) - minPlot) / rangePlot) * plotH
        pts.push(vx.toFixed(1) + ',' + vy.toFixed(1))
      }
      var poly = el('polyline', 'innfo-chart-curve')
      poly.setAttribute('points', pts.join(' '))
      poly.setAttribute('stroke', colors[pidx % colors.length])
      poly.setAttribute('fill', 'none')
      poly.setAttribute('stroke-width', '2.5')
      svg.appendChild(poly)

      var legendG = el('g', 'innfo-chart-legend-item')
      var legDot = el('circle')
      legDot.setAttribute('cx', String(padX + pidx * 160))
      legDot.setAttribute('cy', '15')
      legDot.setAttribute('r', '5')
      legDot.setAttribute('fill', colors[pidx % colors.length])
      var legTxt = el('text', 'innfo-chart-legend-text', pr.label || pr.id)
      legTxt.setAttribute('x', String(padX + pidx * 160 + 10))
      legTxt.setAttribute('y', '19')
      legendG.appendChild(legDot)
      legendG.appendChild(legTxt)
      svg.appendChild(legendG)
    })

    for (var ti = 0; ti < totalMonths; ti += Math.max(1, Math.floor(totalMonths / 6))) {
      var tx = padX + (ti / Math.max(1, totalMonths - 1)) * plotW
      var xTxt = el('text', 'innfo-chart-axis-text', labels[ti] || ('M' + (ti + 1)))
      xTxt.setAttribute('x', String(tx))
      xTxt.setAttribute('y', String(padY + plotH + 20))
      xTxt.setAttribute('text-anchor', 'middle')
      svg.appendChild(xTxt)
    }

    chartBox.appendChild(svg)
    rightCol.appendChild(chartBox)
    mainGrid.appendChild(rightCol)

    studioWrap.appendChild(mainGrid)
    studioHost.appendChild(studioWrap)
  }

  function renderTimelineGrid(container, model, meta, hooks) {
    if (!container) return
    var editRow = hooks && typeof hooks.onEditRow === 'function' ? hooks.onEditRow : null
    var host = el('div', 'innfo-timeline-grid-host')
    container.appendChild(host)
    var studioHost = el('div', 'innfo-studio-host')
    container.appendChild(studioHost)
    var rows = Array.isArray(model && model.rows) ? model.rows : []
    if (!rows.length) {
      host.innerHTML = ''
      return
    }

    var monthsCount = Number(meta && meta.months) || 12
    var historyCount = Number(meta && meta.historyMonths) || 0
    var totalMonths = monthsCount + historyCount
    var labels = monthAxis(meta, totalMonths)

    var rowMap = {}
    rows.forEach(function (r) {
      if (r) {
        if (r.id) rowMap[normalizeKey(r.id)] = r
        if (r.label) rowMap[normalizeKey(r.label)] = r
        if (r.name) rowMap[normalizeKey(r.name)] = r
      }
    })

    var growthState = {}
    rows.forEach(function (r) {
      var g = r.growth || { mode: 'fixed', factor: 0 }
      growthState[r.id] = { mode: g.mode || 'fixed', factor: g.factor != null ? g.factor : 0 }
    })
    var overrides = {}
    var pinnedRowIds = {}
    var expandedChartRowIds = {}
    var focusedDependencyRowId = null

    function extractDirectDependencyIds(r) {
      var depIds = []
      if (Array.isArray(r.dependencies)) {
        r.dependencies.forEach(function (d) {
          var norm = normalizeKey(d)
          if (rowMap[norm] && depIds.indexOf(rowMap[norm].id) === -1) {
            depIds.push(rowMap[norm].id)
          }
        })
      }
      if (r.formula) {
        var cleaned = String(r.formula).replace(/\s+[xX]\s+/g, ' * ')
        var tokens = cleaned.split(/(\s*[+\-*/]\s*)/).map(function (s) { return s.trim() }).filter(Boolean)
        tokens.forEach(function (tok) {
          if (!tok || !isNaN(Number(tok)) || tok === '+' || tok === '-' || tok === '*' || tok === '/') return
          var norm = normalizeKey(tok)
          var targetRow = rowMap[norm]
          if (targetRow && depIds.indexOf(targetRow.id) === -1) {
            depIds.push(targetRow.id)
          }
        })
      }
      return depIds
    }

    function getTransitiveDependencySet(startRowId) {
      var result = {}
      result[startRowId] = true
      var queue = [startRowId]
      var visited = {}
      var byId = {}
      rows.forEach(function (r) { if (r && r.id) byId[r.id] = r })

      while (queue.length > 0) {
        var currId = queue.shift()
        if (visited[currId]) continue
        visited[currId] = true
        var currRow = byId[currId]
        if (!currRow) continue
        var directDeps = extractDirectDependencyIds(currRow)
        directDeps.forEach(function (depId) {
          result[depId] = true
          if (!visited[depId]) {
            queue.push(depId)
          }
        })
      }
      return result
    }

    function recalculate() {
      var memo = {}
      var computedValues = {}
      rows.forEach(function (r) {
        var arr = []
        for (var m = 0; m < totalMonths; m++) {
          arr.push(evaluateFormulaTree(r, m, rowMap, overrides, memo, growthState, historyCount))
        }
        computedValues[r.id] = arr
      })
      return computedValues
    }

    function renderView() {
      var rowValues = recalculate()
      var activeDepSet = focusedDependencyRowId ? getTransitiveDependencySet(focusedDependencyRowId) : null
      host.innerHTML = ''

      // Header + Actions (KPI cards removed)
      var gridHeader = el('div', 'innfo-timeline-header')
      var gridTitle = el('h3', 'innfo-timeline-title', 'Timeline & P&L Projection')
      var gridActions = el('div', 'innfo-timeline-actions')
      var resetBtn = el('button', 'innfo-btn-reset', 'Reset Overrides')
      if (resetBtn) {
        resetBtn.setAttribute('type', 'button')
        resetBtn.addEventListener('click', function () {
          Object.keys(overrides).forEach(function (k) { delete overrides[k] })
          rows.forEach(function (r) {
            var g = r.growth || { mode: 'fixed', factor: 0 }
            growthState[r.id] = { mode: g.mode || 'fixed', factor: g.factor != null ? g.factor : 0 }
          })
          renderView()
        })
        gridActions.appendChild(resetBtn)
      }
      var exportCsvBtn = el('button', 'innfo-btn-csv', 'Download CSV')
      if (exportCsvBtn) {
        exportCsvBtn.setAttribute('type', 'button')
        exportCsvBtn.addEventListener('click', function () {
          exportTimelineCsv(meta, rows, totalMonths, labels, rowValues)
        })
        gridActions.appendChild(exportCsvBtn)
      }
      if (gridHeader && gridTitle) gridHeader.appendChild(gridTitle)
      if (gridHeader && gridActions) gridHeader.appendChild(gridActions)
      if (gridHeader) host.appendChild(gridHeader)

      if (focusedDependencyRowId) {
        var focusedRow = rows.filter(function (r) { return r.id === focusedDependencyRowId })[0]
        if (focusedRow) {
          var filterBanner = el('div', 'innfo-timeline-filter-banner')
          var bannerText = el('span', 'innfo-filter-banner-text')
          bannerText.innerHTML = UI.icon('target', 14) + ' <span>Showing dependency tree for: <strong>' + (focusedRow.label || focusedRow.id) + '</strong> (' + Object.keys(activeDepSet).length + ' items)</span>'
          var clearBtn = el('button', 'innfo-filter-banner-clear')
          clearBtn.setAttribute('type', 'button')
          clearBtn.innerHTML = UI.icon('close', 12) + ' <span>Clear Filter</span>'
          clearBtn.addEventListener('click', function () {
            focusedDependencyRowId = null
            renderView()
          })
          filterBanner.appendChild(bannerText)
          filterBanner.appendChild(clearBtn)
          host.appendChild(filterBanner)
        }
      }

      // Interactive Table
      var tableWrap = el('div', 'innfo-timeline-table-wrap')
      var table = el('table', 'innfo-timeline-table')
      var thead = el('thead')
      var trHead = el('tr')

      trHead.appendChild(el('th', 'th-sticky th-metric', 'Metric'))
      trHead.appendChild(el('th', 'th-rule', 'Growth Rule'))
      trHead.appendChild(el('th', 'th-unit', 'Unit'))
      for (var m = 0; m < totalMonths; m++) {
        var isHist = m < historyCount
        var thM = el('th', 'th-month' + (isHist ? ' hist-col' : ''), labels[m] != null ? labels[m] : 'M' + (m + 1))
        if (isHist) thM.setAttribute('title', 'Historical / Measured month')
        trHead.appendChild(thM)
      }
      trHead.appendChild(el('th', 'th-total', 'Total'))
      if (thead && trHead) thead.appendChild(trHead)
      if (table && thead) table.appendChild(thead)

      var tbody = el('tbody')

      function renderRowItem(r, isPinned) {
        var tr = el('tr', 'innfo-timeline-row' + (r.variable ? ' is-var' : '') + (isPinned ? ' is-pinned' : '') + (focusedDependencyRowId === r.id ? ' is-focus-root' : ''))
        var tdMetric = el('td', 'td-sticky td-metric')

        var actionsSpan = el('span', 'innfo-row-actions')
        var isPinnedThis = !!pinnedRowIds[r.id]
        var pinBtn = el('button', 'innfo-row-btn innfo-pin-btn' + (isPinnedThis ? ' pinned' : ''))
        pinBtn.setAttribute('type', 'button')
        pinBtn.setAttribute('title', isPinnedThis ? 'Unpin row' : 'Pin row to top')
        pinBtn.innerHTML = UI.icon('pin', 12)
        pinBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          pinnedRowIds[r.id] = !pinnedRowIds[r.id]
          renderView()
        })
        actionsSpan.appendChild(pinBtn)

        var isChartThis = !!expandedChartRowIds[r.id]
        var chartBtn = el('button', 'innfo-row-btn innfo-chart-btn' + (isChartThis ? ' active' : ''))
        chartBtn.setAttribute('type', 'button')
        chartBtn.setAttribute('title', isChartThis ? 'Hide inline monthly chart' : 'Show inline monthly chart')
        chartBtn.innerHTML = UI.icon('chart', 12)
        chartBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          expandedChartRowIds[r.id] = !expandedChartRowIds[r.id]
          renderView()
        })
        actionsSpan.appendChild(chartBtn)

        var directDeps = extractDirectDependencyIds(r)
        if (directDeps.length > 0 || r.formula || focusedDependencyRowId === r.id) {
          var isFocusThis = focusedDependencyRowId === r.id
          var filterBtn = el('button', 'innfo-row-btn innfo-filter-btn' + (isFocusThis ? ' active' : ''))
          filterBtn.setAttribute('type', 'button')
          filterBtn.setAttribute('title', isFocusThis ? 'Clear dependency tree filter' : 'Filter grid to show only dependencies of ' + (r.label || r.id))
          filterBtn.innerHTML = UI.icon('target', 12)
          filterBtn.addEventListener('click', function (e) {
            e.stopPropagation()
            focusedDependencyRowId = (focusedDependencyRowId === r.id ? null : r.id)
            renderView()
          })
          actionsSpan.appendChild(filterBtn)
        }
        if (editRow) {
          var editBtn = el('button', 'innfo-row-btn innfo-edit-btn')
          editBtn.setAttribute('type', 'button')
          editBtn.setAttribute('title', 'Propose a change to ' + (r.label || r.id))
          editBtn.innerHTML = UI.icon('edit', 12)
          editBtn.addEventListener('click', function (e) {
            e.stopPropagation()
            editRow(r.id)
          })
          actionsSpan.appendChild(editBtn)
        }
        tdMetric.appendChild(actionsSpan)

        var markerSvg = r.variable ? UI.icon('star', 11) : r.source === 'derived' ? UI.icon('derived', 11) : UI.icon('calc', 11)
        var markerSpan = el('span', 'innfo-row-marker marker-' + (r.variable ? 'var' : r.source === 'derived' ? 'der' : 'calc'))
        markerSpan.innerHTML = markerSvg
        var nameSpan = el('span', 'innfo-row-name', r.label || r.id)
        if (r.formula) nameSpan.setAttribute('title', 'Formula: ' + r.formula)
        tdMetric.appendChild(markerSpan)
        tdMetric.appendChild(nameSpan)
        tr.appendChild(tdMetric)

        var tdRule = el('td', 'td-rule')
        var g = growthState[r.id] || { mode: 'fixed', factor: 0 }
        var selGrow = el('select', 'innfo-grow-sel')
        var optFixed = el('option', null, 'Fixed')
        optFixed.value = 'fixed'
        if (g.mode === 'fixed') optFixed.selected = true
        var optComp = el('option', null, '% comp.')
        optComp.value = 'compound'
        if (g.mode === 'compound') optComp.selected = true
        var optAdd = el('option', null, '+delta')
        optAdd.value = 'additive'
        if (g.mode === 'additive') optAdd.selected = true
        selGrow.appendChild(optFixed)
        selGrow.appendChild(optComp)
        selGrow.appendChild(optAdd)
        selGrow.addEventListener('change', function (e) {
          growthState[r.id].mode = e.target.value
          if (inpFactor) inpFactor.disabled = (e.target.value === 'fixed')
          onStateChange()
        })
        tdRule.appendChild(selGrow)

        var inpFactor = el('input', 'innfo-grow-factor')
        inpFactor.type = 'number'
        inpFactor.step = 'any'
        inpFactor.value = g.factor != null ? String(g.factor) : '0'
        if (g.mode === 'fixed') inpFactor.disabled = true
        inpFactor.addEventListener('change', function (e) {
          growthState[r.id].factor = parseFloat(e.target.value) || 0
          onStateChange()
        })
        tdRule.appendChild(inpFactor)
        tr.appendChild(tdRule)

        tr.appendChild(el('td', 'td-unit', r.metricUnit || ''))

        var vals = rowValues[r.id] || []
        var sum = 0
        for (var mi = 0; mi < totalMonths; mi++) {
          var val = vals[mi] != null ? vals[mi] : 0
          sum += val
          var isHistCell = mi < historyCount
          var tdVal = el('td', 'td-num' + (isHistCell ? ' hist-cell' : ''))

          if (r.variable && !isHistCell) {
            var isOverridden = overrides[r.id] && (typeof overrides[r.id] === 'number' || overrides[r.id][mi] !== undefined)
            var inpVar = el('input', 'innfo-var-input' + (isOverridden ? ' overridden' : ''))
            inpVar.type = 'number'
            inpVar.step = 'any'
            inpVar.value = isOverridden ? (typeof overrides[r.id] === 'number' ? String(overrides[r.id]) : String(overrides[r.id][mi])) : String(Math.round(val * 100) / 100)
            inpVar.dataset.row = r.id
            inpVar.dataset.m = String(mi)
            inpVar.addEventListener('change', function (e) {
              var rowId = e.target.dataset.row
              var monthIdx = Number(e.target.dataset.m)
              if (!overrides[rowId] || typeof overrides[rowId] === 'number') overrides[rowId] = {}
              overrides[rowId][monthIdx] = parseFloat(e.target.value) || 0
              onStateChange()
            })
            tdVal.appendChild(inpVar)
          } else {
            tdVal.textContent = formatGridNumber(val)
          }
          tr.appendChild(tdVal)
        }

        var isResultOrRev = r.metricType === 'result' || r.metricType === 'revenue'
        var totalFormatted = r.growth && r.growth.mode === 'fixed' && !isResultOrRev && r.variable
          ? formatGridNumber(vals[0]) + ' (avg)'
          : formatGridNumber(sum)
        tr.appendChild(el('td', 'td-num td-total', totalFormatted))

        tbody.appendChild(tr)

        // Render inline monthly chart if toggled
        if (expandedChartRowIds[r.id]) {
          var trChart = el('tr', 'innfo-timeline-chart-row')
          var tdChartSticky = el('td', 'td-sticky')
          var chartLabel = el('span', 'innfo-chart-row-label')
          chartLabel.innerHTML = UI.icon('chart', 12) + ' <span>Monthly: ' + (r.label || r.id) + '</span>'
          tdChartSticky.appendChild(chartLabel)
          trChart.appendChild(tdChartSticky)

          var maxAbs = Math.max.apply(null, vals.map(function (v) { return Math.abs(v) })) || 1
          var minReal = Math.min.apply(null, vals)
          var maxReal = Math.max.apply(null, vals)

          var tdChartRule = el('td', 'td-rule')
          tdChartRule.appendChild(el('span', 'innfo-chart-range', 'Range: ' + formatGridNumber(minReal) + ' .. ' + formatGridNumber(maxReal)))
          trChart.appendChild(tdChartRule)

          trChart.appendChild(el('td', 'td-unit', r.metricUnit || ''))

          for (var ci = 0; ci < totalMonths; ci++) {
            var cVal = vals[ci] != null ? vals[ci] : 0
            var isHistCol = ci < historyCount
            var tdCell = el('td', 'td-chart-cell' + (isHistCol ? ' hist-cell' : ''))
            var barWrap = el('div', 'innfo-mini-bar-wrap')
            barWrap.setAttribute('title', (labels[ci] || ('M' + (ci + 1))) + ': ' + formatGridNumber(cVal) + (r.metricUnit ? ' ' + r.metricUnit : ''))

            var heightPct = Math.max(4, Math.round((Math.abs(cVal) / maxAbs) * 100))
            var bar = el('div', 'innfo-mini-bar' + (cVal < 0 ? ' negative' : ''))
            bar.style.height = heightPct + '%'
            bar.style.backgroundColor = getSemanticBarColor(cVal, minReal, maxReal, r)

            var valLabel = el('span', 'innfo-mini-bar-val', formatGridNumber(cVal))
            barWrap.appendChild(bar)
            barWrap.appendChild(valLabel)
            tdCell.appendChild(barWrap)
            trChart.appendChild(tdCell)
          }

          var tdChartTotal = el('td', 'td-total td-chart-total')
          var firstVal = vals[0] || 0
          var lastVal = vals[totalMonths - 1] || 0
          var deltaPct = firstVal !== 0 ? Math.round(((lastVal - firstVal) / Math.abs(firstVal)) * 100) : 0
          tdChartTotal.appendChild(el('div', 'innfo-mini-total', (deltaPct >= 0 ? '+' : '') + deltaPct + '% trend'))
          trChart.appendChild(tdChartTotal)

          tbody.appendChild(trChart)
        }
      }

      // 1. Render pinned section if any
      var pinnedRows = rows.filter(function (r) {
        if (!pinnedRowIds[r.id]) return false
        if (activeDepSet && !activeDepSet[r.id]) return false
        return true
      })
      if (pinnedRows.length > 0) {
        var trPinnedHdr = el('tr', 'innfo-timeline-grp innfo-pinned-grp')
        var tdPinnedHdr = el('td')
        tdPinnedHdr.setAttribute('colspan', String(totalMonths + 4))
        var pinnedBadge = el('span', 'innfo-grp-badge')
        pinnedBadge.innerHTML = UI.icon('pin', 12) + ' <span>PINNED METRICS (' + pinnedRows.length + ')</span>'
        tdPinnedHdr.appendChild(pinnedBadge)
        trPinnedHdr.appendChild(tdPinnedHdr)
        tbody.appendChild(trPinnedHdr)

        pinnedRows.forEach(function (r) {
          renderRowItem(r, true)
        })
      }

      // 2. Render normal groups
      var groups = []
      rows.forEach(function (r) {
        var grp = r.grp || 'GENERAL'
        if (groups.indexOf(grp) === -1) groups.push(grp)
      })

      groups.forEach(function (grp) {
        var grpRows = rows.filter(function (r) {
          if ((r.grp || 'GENERAL') !== grp) return false
          if (activeDepSet && !activeDepSet[r.id]) return false
          return true
        })
        if (!grpRows.length) return

        var trGrp = el('tr', 'innfo-timeline-grp')
        var tdGrp = el('td')
        tdGrp.setAttribute('colspan', String(totalMonths + 4))
        tdGrp.appendChild(el('span', 'innfo-grp-badge', grp + (activeDepSet ? ' (filtered)' : '')))
        trGrp.appendChild(tdGrp)
        tbody.appendChild(trGrp)

        grpRows.forEach(function (r) {
          renderRowItem(r, false)
        })
      })

      if (table && tbody) table.appendChild(tbody)
      if (tableWrap && table) tableWrap.appendChild(table)
      if (host && tableWrap) host.appendChild(tableWrap)
    }

    function onStateChange() {
      renderView()
      renderStudioView(studioHost, model, meta, rows, totalMonths, labels, rowMap, overrides, growthState, historyCount, onStateChange)
    }

    renderView()
    renderStudioView(studioHost, model, meta, rows, totalMonths, labels, rowMap, overrides, growthState, historyCount, onStateChange)
  }

  /* View registry. A view is a classic script that calls the registerView
     bound by viewRegistrar(id, source); the id is the file slug. A rejected
     registration throws AND is recorded in registry.errors(), which boot
     renders as the #innfo-view-errors notice (a throw inside a <script> is
     otherwise visible only in devtools). */
  var VIEW_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
  var RESERVED_VIEW_IDS = ['explorer', 'matrices', 'review']
  var ICON_NAME_RE = /^[a-z0-9-]+$/
  var VIEW_KINDS = ['editable', 'readonly']
  // The frame has no scripts and no same-origin access, so a meta-refresh
  // navigation inside it is accepted and out of scope here.
  var VIEW_CSP_META =
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'; img-src data: blob:; style-src \'unsafe-inline\'">'

  function nonEmptyString(v) {
    return typeof v === 'string' && v.trim() !== ''
  }

  // Returns '' when valid, otherwise a message naming the view id and field.
  function validateViewDef(def) {
    if (!def || typeof def !== 'object') return 'view "(missing id)": definition must be an object'
    var id = typeof def.id === 'string' ? def.id : ''
    var at = 'view "' + (id || '(missing id)') + '": '
    if (!VIEW_ID_RE.test(id)) return at + 'id must be a slug of lowercase alphanumerics and hyphens'
    if (RESERVED_VIEW_IDS.indexOf(id) >= 0) return at + 'id is reserved'
    if (!nonEmptyString(def.title)) return at + 'title must be a non-empty string'
    if (typeof def.icon !== 'string' || !ICON_NAME_RE.test(def.icon)) {
      return at + 'icon must be a slug of lowercase alphanumerics and hyphens'
    }
    if (typeof def.order !== 'number' || !isFinite(def.order)) return at + 'order must be a finite number'
    if (VIEW_KINDS.indexOf(def.kind) < 0) return at + 'kind must be "editable" or "readonly"'
    if (typeof def.mount !== 'function') return at + 'mount must be a function'
    return ''
  }

  function createViewRegistry() {
    var views = []
    var errors = []

    function report(id, sources, reason) {
      errors.push({ id: id, sources: sources, reason: reason })
    }

    function reject(id, sources, reason) {
      report(id, sources, reason)
      throw new Error(reason)
    }

    function register(def) {
      var id = def && typeof def.id === 'string' && def.id ? def.id : '(missing id)'
      var source = def && def.source ? String(def.source) : 'registerView'
      var reason = validateViewDef(def)
      if (reason) reject(id, [source], reason)
      for (var i = 0; i < views.length; i++) {
        if (views[i].id === id) {
          reject(id, [views[i].source, source], 'view "' + id + '": duplicate id (already registered by ' + views[i].source + ')')
        }
      }
      views.push(Object.assign({}, def, { source: source }))
      return id
    }

    // Binds the file slug and source; a declared id that differs is rejected.
    function registrar(id, source) {
      return function (def) {
        if (def && def.id !== undefined && def.id !== id) {
          reject(id, [source], 'view "' + id + '": declared id "' + def.id + '" does not match the file slug')
        }
        return register(Object.assign({}, def, { id: id, source: source }))
      }
    }

    return {
      register: register,
      registrar: registrar,
      report: report,
      list: function () {
        return views.slice()
      },
      errors: function () {
        return errors.slice()
      },
    }
  }

  var defaultViewRegistry = createViewRegistry()

  // Creates the nav, the explorer/matrices/review panels and moves the hosts
  // into them. Idempotent: existing nodes are reused.
  function ensureTabShell(doc, model) {
    var mainEl = doc && typeof doc.querySelector === 'function' ? doc.querySelector('main') : null
    var tabsNav = doc.getElementById('innfo-view-tabs')
    if (!tabsNav && mainEl) {
      tabsNav = el('nav', 'innfo-view-tabs')
      tabsNav.id = 'innfo-view-tabs'
      tabsNav.style.display = 'none'
      var toolbar = mainEl.querySelector('.innfo-toolbar')
      if (toolbar && toolbar.nextSibling) mainEl.insertBefore(tabsNav, toolbar.nextSibling)
      else if (mainEl.firstChild) mainEl.insertBefore(tabsNav, mainEl.firstChild)
      else mainEl.appendChild(tabsNav)
    }
    if (!tabsNav) return null

    var explorerPanel = doc.getElementById('innfo-tab-explorer')
    if (!explorerPanel && mainEl) {
      explorerPanel = el('div', 'innfo-tab-panel active')
      explorerPanel.id = 'innfo-tab-explorer'
      var hosts = ['innfo-doc', 'innfo-content', 'innfo-matrices']
        .map(function (id) {
          return doc.getElementById(id)
        })
        .filter(Boolean)
      if (hosts.length && hosts[0].parentNode === mainEl) {
        mainEl.insertBefore(explorerPanel, hosts[0])
        hosts.forEach(function (h) {
          explorerPanel.appendChild(h)
        })
      } else {
        mainEl.appendChild(explorerPanel)
      }
    }

    // Matrices get their own panel; the host must not stay inside the
    // explorer panel, which is hidden while the Matrices tab is active.
    var hasMatrices = Array.isArray(model && model.matrices) && model.matrices.length > 0
    if (!doc.getElementById('innfo-tab-matrices') && hasMatrices && explorerPanel && explorerPanel.parentNode) {
      var matricesPanel = el('div', 'innfo-tab-panel')
      matricesPanel.id = 'innfo-tab-matrices'
      var matricesHostEl = doc.getElementById('innfo-matrices')
      if (!matricesHostEl) {
        matricesHostEl = el('div')
        matricesHostEl.id = 'innfo-matrices'
      }
      matricesPanel.appendChild(matricesHostEl)
      explorerPanel.parentNode.insertBefore(matricesPanel, explorerPanel.nextSibling)
    }

    var reviewPanel = doc.getElementById('innfo-tab-review')
    if (!reviewPanel && mainEl) {
      reviewPanel = el('div', 'innfo-tab-panel')
      reviewPanel.id = 'innfo-tab-review'
      mainEl.appendChild(reviewPanel)
    }
    return { nav: tabsNav, main: mainEl, review: reviewPanel, explorer: explorerPanel }
  }

  // meta.consoleScope = { view: id } marks a standalone --view export: no built-in
  // tabs, only that view, and drafts kept apart from the domain console's.
  function consoleScopeOf(meta) {
    var scope = meta && meta.consoleScope
    return isObject(scope) && nonEmptyString(scope.view) ? scope.view : ''
  }

  // Built-in tabs, registered per boot (they are not in the registry).
  function builtinViews(doc, config, model, meta, shell) {
    var views = []
    // A standalone --view artifact mounts that view alone.
    if (consoleScopeOf(meta)) return views
    if ((Array.isArray(model && model.elements) && model.elements.length > 0) || shell.explorer) {
      views.push({ id: 'explorer', title: 'Model Explorer', icon: 'explorer', order: 100, panelId: 'innfo-tab-explorer' })
    }
    if (Array.isArray(model && model.matrices) && model.matrices.length > 0) {
      views.push({ id: 'matrices', title: 'Matrices', icon: 'matrices', order: 110, panelId: 'innfo-tab-matrices' })
    }
    return views
  }

  function renderViewErrors(doc, errors, nav) {
    var host = doc.getElementById('innfo-view-errors')
    if (!errors.length) {
      if (host && host.parentNode) host.parentNode.removeChild(host)
      return
    }
    if (!host) {
      host = el('div', 'innfo-view-errors alert alert-error text-sm mb-3')
      host.id = 'innfo-view-errors'
      host.setAttribute('role', 'alert')
      nav.parentNode.insertBefore(host, nav)
    }
    host.innerHTML = ''
    errors.forEach(function (e) {
      host.appendChild(el('p', null, e.reason + ' [' + e.sources.join(' | ') + ']'))
    })
  }

  /* The hash carries the active tab and the search query together:
     "#<tab>&q=<encoded query>", "#<tab>", "#q=<encoded query>" or empty. */
  function parseViewHash(hash) {
    var out = { tab: '', q: '' }
    String(hash || '')
      .replace(/^#/, '')
      .split('&')
      .forEach(function (part) {
        if (part.indexOf('q=') === 0) {
          try {
            out.q = decodeURIComponent(part.slice(2))
          } catch {
            out.q = ''
          }
        } else if (part && !out.tab) {
          out.tab = part
        }
      })
    return out
  }

  function buildViewHash(tab, query) {
    var parts = []
    if (tab) parts.push(tab)
    if (query) parts.push('q=' + encodeURIComponent(query))
    return parts.length ? '#' + parts.join('&') : ''
  }

  var TAB_ICONS = { chart: 'bar-chart-2', matrices: 'table', explorer: 'boxes', review: 'edit' }

  // Builds the tabs once from built-ins plus registered views. Panels are
  // created here; a registered view's mount runs on first activation only.
  function mountTabs(doc, opts) {
    var registry = opts.registry || defaultViewRegistry
    var shell = ensureTabShell(doc, opts.model)
    if (!shell) return null
    var nav = shell.nav
    var tabs = builtinViews(doc, opts.config, opts.model, opts.meta, shell)
    // Problems found while mounting belong to this boot; the registry only
    // keeps registration errors, so booting again never duplicates notices.
    var bootErrors = []
    function report(id, sources, reason) {
      bootErrors.push({ id: id, sources: sources, reason: reason })
    }
    var scopedView = consoleScopeOf(opts.meta)
    if (scopedView && shell.explorer) shell.explorer.classList.remove('active')
    registry.list().forEach(function (v) {
      if (scopedView && v.id !== scopedView) return
      var clash = tabs.filter(function (t) {
        return t.id === v.id
      })[0]
      var panelId = 'innfo-tab-' + v.id
      var existing = doc.getElementById(panelId)
      if (clash) {
        report(v.id, [clash.id + ' (built-in)', v.source], 'view "' + v.id + '": duplicate id (a built-in tab already uses it)')
      } else if (existing && existing.getAttribute('data-innfo-view') !== v.id) {
        // The panel belongs to the shell or a built-in tab; never mount into it.
        report(v.id, [v.source], 'view "' + v.id + '": panel #' + panelId + ' already exists and is not owned by this view')
      } else {
        tabs.push(Object.assign({}, v, { panelId: 'innfo-tab-' + v.id, external: true }))
      }
    })
    tabs.sort(function (a, b) {
      return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })
    tabs.push({ id: 'review', title: 'Changes', icon: 'review', panelId: 'innfo-tab-review' })

    tabs.forEach(function (t) {
      if (t.external && !doc.getElementById(t.panelId) && shell.main) {
        var panel = el('div', 'innfo-tab-panel')
        panel.id = t.panelId
        panel.setAttribute('data-innfo-view', t.id)
        shell.main.insertBefore(panel, shell.review)
      }
    })

    nav.innerHTML = ''
    nav.style.display = 'flex'
    nav.className = 'innfo-view-tabs tabs tabs-boxed bg-base-200 p-1 rounded-lg gap-1 mb-4 inline-flex'
    tabs.forEach(function (t) {
      var btn = el('button', 'innfo-view-tab tab flex items-center gap-2')
      btn.setAttribute('type', 'button')
      btn.dataset.tab = t.id
      var label = el('span', null, t.title)
      btn.innerHTML = UI.icon(TAB_ICONS[t.icon] || t.icon, 15)
      btn.appendChild(label)
      btn.addEventListener('click', function () {
        select(t.id, false)
      })
      nav.appendChild(btn)
    })
    updateTabBadges(doc, opts.state)

    var current = ''
    var mounted = {}

    function showErrors() {
      renderViewErrors(doc, registry.errors().concat(bootErrors), nav)
    }

    var observers = []

    // Embedding guard. Only ctx.mountHtml may create a frame: editable views
    // share the draft store, so an embedded document could try to reach it,
    // and a readonly view is limited to the sandboxed static frame. Any
    // iframe, object, embed or frame that mountHtml did not create is removed
    // and reported with the view id.
    //
    // This is an accident guard for trusted view code (a MutationObserver
    // reacts after insertion), NOT a security boundary. Shadow roots are out
    // of scope: the observer does not see into them.
    var FRAME_TAGS = ['IFRAME', 'OBJECT', 'EMBED', 'FRAME']
    var FRAME_SELECTOR = 'iframe, object, embed, frame'
    var ownFrames = []
    function stripIframes(t, root) {
      var found = FRAME_TAGS.indexOf(root.nodeName) >= 0 ? [root] : []
      if (root.querySelectorAll) found = found.concat([].slice.call(root.querySelectorAll(FRAME_SELECTOR)))
      found = found.filter(function (f) {
        return ownFrames.indexOf(f) < 0
      })
      found.forEach(function (f) {
        if (f.parentNode) f.parentNode.removeChild(f)
      })
      if (found.length) {
        report(
          t.id,
          [t.source],
          'view "' + t.id + '": views must not mount iframes, objects or embeds; use ctx.mountHtml (removed)',
        )
        showErrors()
      }
    }

    // scope: the subtree watched. Editable views are watched across the whole
    // body (they hold the draft store); readonly views inside their panel.
    function guardIframes(t, scope) {
      var View = doc.defaultView
      if (!View || typeof View.MutationObserver !== 'function') return
      var observer = new View.MutationObserver(function (records) {
        records.forEach(function (r) {
          ;[].slice.call(r.addedNodes).forEach(function (n) {
            if (n.nodeType === 1 && scope.contains(n)) stripIframes(t, n)
          })
        })
      })
      observer.observe(scope, { childList: true, subtree: true })
      observers.push(observer)
    }

    // The same facades for every editable view: one store, one modal slot
    // (the review controller's), one changeset. The controller exists only
    // with the feedback-export need.
    function editableParts(t) {
      function controller() {
        var c = opts.getController()
        if (!c) throw new Error('review is not enabled (feedback-export need missing)')
        return c
      }
      function anchor(a) {
        return { elementId: a.elementId, field: a.field }
      }
      return {
        store: {
          drafts: function () {
            return opts.state.store.drafts()
          },
          propose: function (p) {
            p = p && typeof p === 'object' ? p : {}
            if (ITEM_KINDS.indexOf(p.kind) < 0) {
              throw new Error(
                'cannot propose: kind must be one of ' + ITEM_KINDS.join(', ') + ' (got "' + p.kind + '")',
              )
            }
            if (p.kind === 'comment' && !nonEmptyString(p.comment)) {
              throw new Error('cannot propose: a comment needs non-empty comment text')
            }
            if (p.kind === 'correction') {
              if (!nonEmptyString(p.field)) throw new Error('cannot propose: a correction needs a field')
              if (p.proposed === undefined || p.proposed === null) {
                throw new Error('cannot propose: a correction needs a proposed value')
              }
            }
            var payload = { kind: p.kind, proposed: p.proposed, comment: p.comment }
            if (p.kind === 'correction') {
              // Same source the modal path uses (kuModalTarget): name and
              // description live on the element, other fields under fields.
              var src = (opts.state.elements || []).filter(function (e) {
                return e && e.id === p.elementId
              })[0]
              if (src) {
                payload.field = p.field
                payload.original =
                  p.field === 'name'
                    ? src.name
                    : p.field === 'description'
                      ? src.description
                      : src.fields
                        ? src.fields[p.field]
                        : undefined
              }
            }
            var saved = controller().propose(anchor(p), payload)
            if (!saved) throw new Error('cannot propose: unknown element "' + p.elementId + '"')
            return saved
          },
          remove: function (id) {
            opts.state.store.removeDraft(id)
            var c = opts.getController()
            if (c) c.refresh()
            else opts.onDraftsChanged()
          },
          onChange: function (fn) {
            return opts.subscribe(fn, function (err) {
              report(t.id, [t.source], 'view "' + t.id + '": onChange listener failed: ' + String(err && err.message ? err.message : err))
              showErrors()
            })
          },
        },
        modal: {
          edit: function (a) {
            return controller().openEdit(anchor(a))
          },
          comment: function (a) {
            return controller().openEdit(Object.assign(anchor(a), { comment: true }))
          },
        },
        changeset: {
          count: function () {
            return opts.state.store.drafts().length
          },
          compose: function (identifier) {
            return composeExport(opts.state, identifier)
          },
          openExport: function () {
            openExportModal(doc, opts.state)
          },
        },
      }
    }

    // Static HTML only: an opaque-origin sandbox without scripts, forms or
    // top navigation, and a CSP that keeps the document offline.
    function mountHtml(panel, html) {
      var frame = el('iframe')
      frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox')
      frame.setAttribute('referrerpolicy', 'no-referrer')
      frame.setAttribute('srcdoc', VIEW_CSP_META + String(html))
      ;[].slice.call(panel.querySelectorAll('iframe')).forEach(function (f) {
        f.parentNode.removeChild(f)
      })
      ownFrames = ownFrames.filter(function (f) {
        return f.parentNode
      })
      ownFrames.push(frame)
      panel.appendChild(frame)
      // No handle is returned: the view never holds the live frame.
    }

    function mountView(t) {
      var panel = doc.getElementById(t.panelId)
      if (!panel) {
        mounted[t.id] = { api: {}, failed: true }
        report(t.id, [t.source], 'view "' + t.id + '": no panel #' + t.panelId + ' to mount into')
        showErrors()
        return
      }
      panel.innerHTML = ''
      var editable = t.kind !== 'readonly'
      var scope = editable ? doc.body || panel : panel
      guardIframes(t, scope)
      try {
        var ctx = {
          id: t.id,
          container: panel,
          doc: doc,
          ui: UI,
          payload: {
            schema: opts.schema,
            model: opts.model,
            meta: opts.meta,
            models: Array.isArray(opts.meta && opts.meta.models) ? opts.meta.models : [],
          },
        }
        if (editable) Object.assign(ctx, editableParts(t))
        else
          ctx.mountHtml = function (html) {
            return mountHtml(panel, html)
          }
        mounted[t.id] = { api: t.mount(ctx) || {} }
      } catch (err) {
        var msg = String(err && err.message ? err.message : err)
        mounted[t.id] = { api: {}, failed: true }
        panel.appendChild(el('div', 'innfo-view-error alert alert-error text-sm', 'View "' + t.id + '" failed to mount: ' + msg))
        report(t.id, [t.source], 'view "' + t.id + '": mount failed: ' + msg)
        showErrors()
      }
      stripIframes(t, scope)
    }

    function hook(id, name) {
      var m = mounted[id]
      if (m && !m.failed && typeof m.api[name] === 'function') {
        try {
          m.api[name]()
        } catch (err) {
          report(id, [], 'view "' + id + '": ' + name + ' failed: ' + String(err && err.message ? err.message : err))
          showErrors()
        }
      }
    }

    function select(tabId, fromHash) {
      var next = tabs.filter(function (t) {
        return t.id === tabId
      })[0]
      if (!next || tabId === current) return
      var prev = current
      current = tabId
      tabs.forEach(function (t) {
        var btn = nav.querySelector('.innfo-view-tab[data-tab="' + t.id + '"]')
        var panel = doc.getElementById(t.panelId)
        btn.classList.toggle('active', t.id === tabId)
        btn.classList.toggle('tab-active', t.id === tabId)
        if (panel) panel.classList.toggle('active', t.id === tabId)
      })
      if (prev) hook(prev, 'onHide')
      if (tabId === 'review' && opts.state) renderReviewTab(doc, opts.state, opts.config, opts.onRefresh)
      if (next.external) {
        if (mounted[tabId]) hook(tabId, 'onShow')
        else mountView(next)
      }
      var nextHash = buildViewHash(tabId, opts.getQuery ? opts.getQuery() : '')
      if (!fromHash && doc.location && doc.location.hash !== nextHash) {
        try {
          doc.location.hash = nextHash
        } catch {
          // ignore navigation errors in iframe or file://
        }
      }
    }

    function tabFromHash() {
      var id = parseViewHash(doc.location ? doc.location.hash : '').tab
      return tabs.some(function (t) {
        return t.id === id
      })
        ? id
        : ''
    }

    var onHashChange = function () {
      var id = tabFromHash()
      if (id) select(id, true)
    }
    if (doc.defaultView) doc.defaultView.addEventListener('hashchange', onHashChange)
    showErrors()
    return {
      tabs: tabs,
      current: function () {
        return current
      },
      select: select,
      destroy: function () {
        if (doc.defaultView) doc.defaultView.removeEventListener('hashchange', onHashChange)
        observers.forEach(function (o) {
          o.disconnect()
        })
        observers = []
      },
      hashTab: tabFromHash,
      // Runs after the first refresh so a tab already chosen during boot (an
      // initial search) is kept and the default view is not mounted for
      // nothing, and after the review controller exists (ctx.modal needs it).
      activateInitial: function () {
        if (!current) select(tabFromHash() || tabs[0].id, true)
      },
    }
  }

  function updateTabBadges(doc, state) {
    var btn = doc.querySelector('.innfo-view-tab[data-tab="review"]')
    if (!btn) return
    var old = btn.querySelector('.innfo-rail-badge')
    if (old && old.parentNode) old.parentNode.removeChild(old)
    var n = state && state.store ? state.store.drafts().length : 0
    if (n > 0) btn.appendChild(el('span', 'innfo-rail-badge badge badge-sm badge-neutral', String(n)))
  }

  // C11: the review tab renders through the kit DraftList from the v2 store.
  function renderReviewTab(doc, state, config, onRefresh) {
    var host = doc && typeof doc.getElementById === 'function' ? doc.getElementById('innfo-tab-review') : null
    if (!host) return
    host.innerHTML = ''

    var drafts = state && state.store ? state.store.drafts() : []
    var root = el('div', 'innfo-review-tab-content p-6 max-w-5xl mx-auto')
    if (!root) return

    var head = el('section', 'innfo-review-head flex justify-between items-center mb-6 pb-4 border-b border-base-200')
    if (head) {
      var titleWrap = el('div')
      titleWrap.appendChild(el('h2', 'text-2xl font-bold tracking-tight', 'Proposed Changes'))
      var count = el(
        'p',
        'innfo-review-count text-sm opacity-70 mt-1',
        drafts.length + (drafts.length === 1 ? ' pending change' : ' pending changes'),
      )
      if (count) titleWrap.appendChild(count)
      head.appendChild(titleWrap)

      if (drafts.length > 0) {
        var exportBtn = el('button', 'innfo-btn innfo-tab-export-btn btn btn-primary btn-sm flex items-center gap-2 shadow-sm', 'Export changes')
        if (exportBtn) {
          exportBtn.setAttribute('type', 'button')
          if (typeof InnfoIcons !== 'undefined' && typeof InnfoIcons.getSvg === 'function') {
            exportBtn.innerHTML = InnfoIcons.getSvg('download', { size: 14 }) + '<span>Export changes</span>'
          }
          exportBtn.addEventListener('click', function () {
            openExportModal(doc, state)
          })
          head.appendChild(exportBtn)
        }
      }
      root.appendChild(head)
    }

    var listSection = el('section', 'innfo-review-list-section')
    if (listSection) {
      if (drafts.length === 0) {
        var empty = el('div', 'empty-state alert alert-info bg-base-100 border border-base-200 text-sm p-4 rounded-lg flex items-center gap-3')
        if (typeof InnfoIcons !== 'undefined' && typeof InnfoIcons.getSvg === 'function') {
          empty.innerHTML = InnfoIcons.getSvg('info', { size: 18 }) + '<span>No proposed changes yet. Annotate an element in review mode.</span>'
        } else {
          empty.textContent = 'No proposed changes yet. Annotate an element in review mode.'
        }
        listSection.appendChild(empty)
      } else {
        var byId = {}
        ;(state && state.elements ? state.elements : []).forEach(function (e) {
          if (e && e.id) byId[e.id] = e
        })
        listSection.appendChild(
          UI.DraftList({ drafts: drafts, byId: byId }, {
            doc: doc,
            onDelete: function (id) {
              if (state && state.store) state.store.removeDraft(id)
              if (typeof onRefresh === 'function') onRefresh()
            },
          }),
        )
      }
      root.appendChild(listSection)
    }

    host.appendChild(root)
  }

  function focusElementCard(doc, elementId) {
    if (!doc || !elementId) return
    // A scoped console has no explorer to focus a card in.
    if (doc.documentElement && doc.documentElement.hasAttribute('data-innfo-scope')) return
    // 1. Switch active tab to explorer if view tabs exist
    var tabsNav = doc.getElementById('innfo-view-tabs')
    if (tabsNav) {
      var explorerBtn = tabsNav.querySelector('.innfo-view-tab[data-tab="explorer"]')
      if (explorerBtn && typeof explorerBtn.click === 'function') {
        explorerBtn.click()
      } else {
        var firstTab = tabsNav.querySelector('.innfo-view-tab')
        if (firstTab && typeof firstTab.click === 'function') firstTab.click()
      }
    }
    // 2. Find card by id
    var card = doc.getElementById(String(elementId))
    if (card) {
      if (typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      card.classList.add('innfo-highlight')
      setTimeout(function () {
        card.classList.remove('innfo-highlight')
      }, 2500)
    }
  }

  // Build a name->element lookup used by the reference-popup need so field
  // values that match an element name render as pills (opens a detail dialog).
  function buildRefsByName(elements) {
    var refs = {}
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (e && e.name) refs[e.name] = e
    })
    return refs
  }

  function renderRefDialog(doc, element) {
    if (!doc || !element) return
    var dialog = doc.getElementById('innfo-ref-dialog')
    if (!dialog || typeof dialog.showModal !== 'function') return
    dialog.innerHTML = ''
    var head = el('div', 'innfo-ref-head')
    var h = el('h2', null, String(element.name || 'Element'))
    var close = el('button', 'innfo-ref-close', '×')
    if (close) {
      close.setAttribute('type', 'button')
      close.setAttribute('aria-label', 'Close')
      close.addEventListener('click', function () {
        if (typeof dialog.close === 'function') dialog.close()
      })
    }
    if (head && h) head.appendChild(h)
    if (head && close) head.appendChild(close)
    var body = el('div', 'innfo-ref-body')
    var tag = el('span', 'innfo-ref-tag', String(element.concept || 'Element'))
    if (body && tag) body.appendChild(tag)
    if (body && element.description) {
      var p = el('p', 'innfo-ref-desc', element.description)
      if (p) body.appendChild(p)
    }
    if (body && isObject(element.fields)) {
      var dl = el('dl', 'innfo-ref-fields')
      Object.keys(element.fields).forEach(function (k) {
        if (!dl) return
        var dt = el('dt', null, k)
        var dd = el('dd', null, String(element.fields[k]))
        if (dt) dl.appendChild(dt)
        if (dd) dl.appendChild(dd)
      })
      if (dl.children.length) body.appendChild(dl)
    }
    dialog.appendChild(head)
    dialog.appendChild(body)
    dialog.showModal()
  }

  // Citation detail dialog (Console Citation Icons / Tanda C). Reuses the
  // innfo-ref-dialog markup/classes so no second stylesheet is needed. Unlike
  // renderRefDialog, it creates #innfo-citation-dialog and appends it to
  // <body> when the shell does not already declare it, so old shells (built
  // before this change) still work once the runtime is updated.
  function renderCitationDialog(doc, fieldName, entries) {
    if (!doc || !Array.isArray(entries)) return
    var dialog = doc.getElementById('innfo-citation-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'innfo-citation-dialog'
      dialog.setAttribute('aria-label', 'Citation details')
      var host = doc.body
      if (host) host.appendChild(dialog)
    }
    if (typeof dialog.showModal !== 'function') return
    dialog.innerHTML = ''

    var head = el('div', 'innfo-ref-head')
    var h = el('h2', null, 'Citations: ' + String(fieldName || ''))
    var close = el('button', 'innfo-ref-close', '×')
    if (close) {
      close.setAttribute('type', 'button')
      close.setAttribute('aria-label', 'Close')
      close.addEventListener('click', function () {
        if (typeof dialog.close === 'function') dialog.close()
      })
    }
    if (head && h) head.appendChild(h)
    if (head && close) head.appendChild(close)

    var body = el('div', 'innfo-ref-body')
    entries.forEach(function (entry) {
      if (!entry || !body) return
      var variantKey = entry.error
        ? 'error'
        : Object.prototype.hasOwnProperty.call(CITATION_ORIGIN_LABELS, entry.origin)
          ? entry.origin
          : 'document'
      var labelText = CITATION_ORIGIN_LABELS[variantKey] || variantKey
      var tagText = labelText + (entry.author ? ' · ' + entry.author : '')
      var tag = el('span', 'innfo-ref-tag', tagText)
      if (tag) body.appendChild(tag)

      var dl = el('dl', 'innfo-ref-fields')
      function addField(label, value) {
        if (!dl) return
        if (value === null || value === undefined || value === '') return
        var dt = el('dt', null, label)
        var dd = el('dd', null, String(value))
        if (dt) dl.appendChild(dt)
        if (dd) dl.appendChild(dd)
      }
      addField('Path', entry.path)
      addField('Anchor', entry.anchor)
      addField('Version', entry.version)
      addField('SHA-256', entry.sha256)
      addField('Error', entry.error)
      if (dl && dl.children.length) body.appendChild(dl)

      if (entry.excerpt) {
        var excerptText = entry.excerpt + (entry.truncated ? ' … (truncated)' : '')
        var pre = el('pre', 'innfo-cite-excerpt', excerptText)
        if (pre) body.appendChild(pre)
      }
    })

    dialog.appendChild(head)
    dialog.appendChild(body)
    dialog.showModal()
  }

  // Generic readable-document renderer for a chain of elements (concept-agnostic).
  // `chain` is an array of tree nodes (from buildTree/chainOf) with .el/.fields.
  // The first element is treated as the root; the rest are rendered as steps.
  function renderDocument(doc, chain, opts) {
    if (!doc || !chain) return
    var host = doc.getElementById('innfo-doc')
    if (!host) return
    var append = opts && opts.append
    if (!append) host.innerHTML = ''
    var colorOf = opts && opts.colorOf ? opts.colorOf : null
    var iconOf = opts && opts.iconOf ? opts.iconOf : null
    chain.forEach(function (step, i) {
      var isRoot = i === 0
      var block = el(isRoot ? 'article' : 'section', isRoot ? 'doc-root' : 'doc-step')
      if (!block) return
      var h = el(isRoot ? 'h2' : 'h3', null, null)
      var col = colorOf ? colorOf(step.el.concept, step.el) : null
      var iconName = step.fields && step.fields.step_type ? step.fields.step_type : null
      var svg = iconOf ? iconOf(iconName) : ''
      if (col) h.style.color = col
      var iconSpan = el('span', 'doc-icon', null)
      if (iconSpan) iconSpan.innerHTML = svg || (isRoot ? '◆' : '·')
      h.appendChild(iconSpan)
      h.appendChild(document.createTextNode(' ' + String(step.el.name || (isRoot ? 'Root' : 'Step'))))
      block.appendChild(h)
      if (step.el.description) {
        var p = el('p', 'desc', step.el.description)
        if (p) block.appendChild(p)
      }
      if (!isRoot && isObject(step.fields)) {
        var dl = el('dl', 'doc-fields', null)
        Object.keys(step.fields).forEach(function (k) {
          if (k === 'parent' || k === 'next') return
          var dt = el('dt', null, k)
          var dd = el('dd', null, String(step.fields[k]))
          if (dt) dl.appendChild(dt)
          if (dd) dl.appendChild(dd)
        })
        if (dl && dl.children.length) block.appendChild(dl)
      }
      host.appendChild(block)
    })
  }

  // Renders the generic document view: builds the tree from all elements,
  // picks roots that have children (procedures/trees), and renders each chain.
  function renderDocumentView(doc, elements, concepts) {
    var host = doc.getElementById('innfo-doc')
    if (!host) return
    var visuals = typeof self !== 'undefined' && self.InnfoVisuals ? self.InnfoVisuals : null
    var conceptColorByName = {}
    ;(Array.isArray(concepts) ? concepts : []).forEach(function (c) {
      if (c && c.name) conceptColorByName[c.name] = c.color
    })
    function colorOf(conceptName) {
      var colorName = conceptColorByName[conceptName]
      if (colorName && visuals && typeof visuals.getHexColor === 'function') {
        return visuals.getHexColor(colorName)
      }
      return '#171717'
    }
    function iconOf(iconName) {
      if (iconName && visuals && typeof visuals.iconSvg === 'function') {
        return visuals.iconSvg(iconName, 14)
      }
      return ''
    }
    var tree = buildTree(elements)
    var roots = tree.roots.filter(function (r) {
      return r.children && r.children.length > 0
    })
    if (!roots.length) {
      host.innerHTML = ''
      return
    }
    roots.forEach(function (root) {
      renderDocument(doc, chainOf(root, tree.nodes), {
        colorOf: colorOf,
        iconOf: iconOf,
        append: true,
      })
    })
  }

  function ensureFeedbackUi(doc, state) {
    var active = doc || (typeof document !== 'undefined' ? document : null)
    if (!active) return null
    var config = parseConfig(slotText(active, 'innfo-config'))
    if (!hasNeed(config, 'feedback-export')) return null

    var existing = active.querySelector('[data-innfo-feedback-root]')
    if (existing) return existing

    var root = active.createElement('div')
    root.setAttribute('data-innfo-feedback-root', '')

    // Feedback CSS
    if (!active.querySelector('style[data-innfo-feedback]')) {
      var style = active.createElement('style')
      style.setAttribute('data-innfo-feedback', '')
      style.textContent =
        '[data-innfo-feedback-root]{display:block;position:sticky;top:0;z-index:40;background:var(--surface,#ffffff);}' +
        '#innfo-feedback-banner{padding:12px 24px;background:var(--surface,#ffffff);border-bottom:1px solid var(--border,#e5e7eb);display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 1px 2px rgba(0,0,0,0.03);}' +
        '#innfo-feedback-banner strong{font-size:1.05rem;font-weight:700;letter-spacing:-0.01em;}' +
        '#innfo-feedback-banner .innfo-banner-version,#innfo-feedback-banner .innfo-banner-needs,#innfo-feedback-banner .innfo-banner-drafts{color:var(--muted,#6b7280);font-size:0.8rem;}' +
        '#innfo-feedback-open{appearance:none;border:1px solid var(--border,#e5e7eb);background:var(--surface,#ffffff);color:var(--text,#111827);font:inherit;font-size:0.82rem;font-weight:600;padding:6px 14px;border-radius:var(--radius-sm,4px);cursor:pointer;margin-left:auto;}' +
        '#innfo-feedback-open:hover{background:var(--surface-2,#f3f4f6);}' +
        '#innfo-feedback-modal{border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-lg,8px);padding:20px;max-width:560px;width:100%;background:var(--surface,#ffffff);color:var(--text,#111827);}' +
        '#innfo-feedback-modal::backdrop{background:rgba(0,0,0,0.35);}' +
        '#innfo-feedback-modal input{width:100%;padding:8px 12px;margin:8px 0;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-sm,4px);box-sizing:border-box;}' +
        '#innfo-feedback-modal pre{background:var(--surface-2,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:12px;white-space:pre-wrap;font-size:0.8rem;}' +
        '[data-innfo="errors"]{color:#dc2626;font-size:0.85rem;margin:8px 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;}' +
        '#innfo-feedback-modal button[data-innfo="download"]{appearance:none;border:1px solid var(--primary,#2563eb);background:var(--primary,#2563eb);color:#ffffff;font:inherit;font-size:0.85rem;font-weight:600;padding:8px 16px;border-radius:var(--radius-sm,4px);cursor:pointer;}' +
        '#innfo-feedback-modal button[data-innfo="download"]:hover{background:var(--primary-hover,#1d4ed8);}' +
        '#innfo-feedback-modal [data-innfo="export-json"]{width:100%;min-height:140px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.78rem;border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:10px;box-sizing:border-box;}' +
        '#innfo-feedback-modal .innfo-feedback-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;}' +
        '#innfo-feedback-modal button[data-innfo="copy"]{appearance:none;border:1px solid var(--border,#e5e7eb);background:var(--surface,#ffffff);color:var(--text,#111827);font:inherit;font-size:0.85rem;font-weight:600;padding:8px 16px;border-radius:var(--radius-sm,4px);cursor:pointer;}' +
        '#innfo-feedback-modal button:disabled{opacity:0.5;cursor:not-allowed;}' +
        '#innfo-feedback-modal [data-innfo="copy-status"]{font-size:0.8rem;color:var(--muted,#6b7280);}'
      root.appendChild(style)
    }

    // Banner
    var banner = active.createElement('header')
    banner.id = 'innfo-feedback-banner'
    banner.setAttribute('aria-label', 'Console review banner')

    var title = active.createElement('strong')
    title.textContent = state ? state.modelTitle : 'iNNfo Console'
    banner.appendChild(title)

    var version = active.createElement('span')
    version.className = 'innfo-banner-version'
    version.textContent = ' ' + (state ? state.modelVersion : '')
    banner.appendChild(version)

    var needsBadge = active.createElement('span')
    needsBadge.className = 'innfo-banner-needs'
    needsBadge.textContent = ' needs: ' + (config.needs && config.needs.length ? config.needs.join(', ') : 'none')
    banner.appendChild(needsBadge)

    var draftsBadge = active.createElement('span')
    draftsBadge.className = 'innfo-banner-drafts'
    draftsBadge.setAttribute('data-innfo', 'draft-count')
    draftsBadge.textContent = ' drafts: 0'
    banner.appendChild(draftsBadge)

    // Reviewer chip
    var reviewerName = getReviewerName()
    var chip = active.createElement('div')
    chip.className = 'innfo-reviewer-chip'
    var chipLabel = active.createElement('span')
    chipLabel.className = 'innfo-reviewer-label'
    chipLabel.textContent = 'Reviewer: '
    var chipName = active.createElement('span')
    chipName.className = 'innfo-reviewer-name'
    chipName.textContent = reviewerName
    var editBtn = active.createElement('button')
    editBtn.className = 'innfo-reviewer-edit'
    editBtn.setAttribute('type', 'button')
    editBtn.setAttribute('title', 'Edit reviewer identity')
    editBtn.setAttribute('aria-label', 'Edit reviewer identity')
    editBtn.textContent = '✏️'
    chip.appendChild(chipLabel)
    chip.appendChild(chipName)
    chip.appendChild(editBtn)
    banner.appendChild(chip)

    // Open button
    var openBtn = active.createElement('button')
    openBtn.id = 'innfo-feedback-open'
    openBtn.setAttribute('type', 'button')
    openBtn.className = 'innfo-feedback-open'
    openBtn.textContent = 'Export feedback'
    banner.appendChild(openBtn)

    root.appendChild(banner)

    // Modal
    var modal = active.createElement('dialog')
    modal.id = 'innfo-feedback-modal'
    modal.setAttribute('aria-label', 'Export proposed changes')
    modal.innerHTML =
      '<h2>Export proposed changes</h2>' +
      '<div data-innfo="preview"></div>' +
      '<label>Author / Reviewer identifier (required)' +
      '<input data-innfo="identifier" type="text" placeholder="e.g. round-2" />' +
      '</label>' +
      '<div data-innfo="errors" style="display: none;"></div>' +
      '<h3>Proposed Changeset (_changes_NN.md)</h3>' +
      '<textarea data-innfo="export-json" data-innfo-changeset="true" readonly></textarea>' +
      '<div class="innfo-feedback-actions">' +
      '<button data-innfo="download-changeset" type="button">Download _changes_NN.md</button>' +
      '<button data-innfo="copy-changeset-prompt" type="button">Copy Changeset Prompt</button>' +
      '<button data-innfo="download" type="button" style="display: none;">Download feedback JSON</button>' +
      '<button data-innfo="copy" type="button" style="display: none;">Copy to clipboard</button>' +
      '<span data-innfo="copy-status" role="status" aria-live="polite"></span>' +
      '</div>' +
      '<h3>Instructions</h3>' +
      '<pre data-innfo="instructions"></pre>' +
      '<h3>Agent prompt</h3>' +
      '<pre data-innfo="agent-prompt"></pre>'

    root.appendChild(modal)

    if (active.body) {
      active.body.insertBefore(root, active.body.firstChild)
    }

    if (state && !openBtn.getAttribute('data-innfo-bound')) {
      openBtn.setAttribute('data-innfo-bound', '1')
      openBtn.addEventListener('click', function () {
        openExportModal(active, state)
      })
    }

    return root
  }

  function formatChangesetValue(val) {
    if (val === undefined || val === null) return '""'
    var str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf(':') !== -1 || str.indexOf(' ') !== -1) {
      return JSON.stringify(str)
    }
    return str
  }

  function draftToChange(draft, index, modelTitle) {
    var d = isObject(draft) ? draft : {}
    var id = d.id || 'c-' + String(index + 1).padStart(2, '0')
    var model = modelTitle || 'model'
    var elementTarget = d.element_id || d.element || 'elem'
    var target = d.field ? model + '@' + elementTarget + '&' + d.field : model + '@' + elementTarget
    var op = 'update_field'
    if (d.kind === 'delete') {
      op = 'remove_element'
      target = model + '@' + elementTarget
    } else if (d.kind === 'comment' || (!d.proposed && !d.field)) {
      op = 'comment'
    }

    var lines = []
    lines.push('## NN Change: ' + id)
    lines.push('op:: ' + op)
    lines.push('target:: ' + target)
    if (op === 'update_field') {
      if (d.original !== undefined) lines.push('from:: ' + formatChangesetValue(d.original))
      if (d.proposed !== undefined) lines.push('to:: ' + formatChangesetValue(d.proposed))
    }
    if (d.comment) {
      lines.push('notes:: ' + formatChangesetValue(d.comment))
    }
    return lines.join('\n')
  }

  function serializeChangesetMarkdown(meta, drafts) {
    var title = meta.title || meta.source_knowledge || 'Proposed Changes'
    var author = meta.author || 'reviewer'
    var lines = [
      '---',
      'spec_version: "V_0-4-0"',
      'parent_spec: "changes"',
      'blueprint_version: "0.1.0"',
      'status: proposed',
      'title: ' + JSON.stringify(title),
      'author: ' + JSON.stringify(author),
      '---',
      '',
      '> [!NOTE]',
      '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).',
      '',
      '# NN index',
      '',
      '* [[Change]]',
      '',
      '# NN Change',
      '',
    ]
    var modelName = meta.source_knowledge || 'model'
    var blocks = drafts.map(function (d, i) {
      return draftToChange(d, i, modelName)
    })
    lines.push(blocks.join('\n\n'))
    lines.push('')
    return lines.join('\n')
  }

  function composeChangesetExport(state, identifier) {
    var reviewer = identifier && String(identifier).trim() ? String(identifier).trim() : getReviewerName()
    var drafts = state && state.store ? state.store.drafts() : []
    var model = state && state.modelTitle ? state.modelTitle : 'Model'
    var version = state && state.modelVersion ? state.modelVersion : '1-0-0'
    var reviewerSlug = slugify(reviewer) || 'reviewer'
    var stamp = stampFromDate(new Date())

    var exportMeta = {
      source_knowledge: model,
      title: 'Review Changes: ' + model,
      author: reviewer,
    }

    if (!reviewer || reviewer === DEFAULT_REVIEWER_NAME) {
      return { ok: false, errors: ['Reviewer identifier is required.'] }
    }

    var text = serializeChangesetMarkdown(exportMeta, drafts)
    var filename = modelSlugOf(state) + '_' + reviewerSlug + '_' + stamp + '_changes_NN.md'
    return {
      ok: true,
      text: text,
      filename: filename,
      items: drafts.length,
    }
  }

  function composeExport(state, identifier) {
    var reviewer = identifier && String(identifier).trim() ? String(identifier).trim() : getReviewerName()
    var drafts = state && state.store ? state.store.drafts() : []
    var model = state && state.modelTitle ? state.modelTitle : 'Model'
    var version = state && state.modelVersion ? state.modelVersion : '1-0-0'

    var rawVersion = String(version || '1-0-0')
    var normVersion = MODEL_VERSION_PATTERN.test(rawVersion)
      ? rawVersion
      : 'V_' + rawVersion.replace(/^V_/, '').replace(/\./g, '-')
    var reviewerSlug = slugify(reviewer) || 'reviewer'

    var exportMeta = Object.assign({}, (state && state.meta) || {}, {
      source_knowledge: model,
      source_knowledge_version: normVersion,
      artifact: (state && state.artifactName) || (model + '_console.html'),
      artifact_version: CONSOLE_VERSION,
      exported_at:
        (state && state.exportedAt) || new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      author: reviewer,
      feedback_slug: reviewerSlug,
      viewer: 'innfo-console@' + CONSOLE_VERSION,
    })
    if (state && (state.sourceSha256 || (state.meta && state.meta.sha256))) {
      exportMeta.source_sha256 = state.sourceSha256 || state.meta.sha256
    }

    if (!reviewer || reviewer === DEFAULT_REVIEWER_NAME) {
      return { ok: false, errors: ['Reviewer identifier is required.'] }
    }

    var payload
    try {
      payload = buildExportDoc({ meta: exportMeta, drafts: drafts })
    } catch (err) {
      return { ok: false, errors: [err.message] }
    }

    var check = validateFeedback(payload)
    if (!check.ok) return { ok: false, errors: check.errors }

    var stamp = stampFromDate(state && state.exportedAt ? new Date(state.exportedAt) : new Date())
    var changesetMd = serializeChangesetMarkdown(exportMeta, drafts)
    var modelSlug = modelSlugOf(state)
    var changesetFilename = modelSlug + '_' + reviewerSlug + '_' + stamp + '_changes_NN.md'

    return {
      ok: true,
      payload: payload,
      text: serializeFeedback(payload),
      filename: buildFeedbackFilename(modelSlug, String(version).replace(/^V_/, ''), reviewer),
      changesetText: changesetMd,
      changesetFilename: changesetFilename,
      items: payload.items.length,
    }
  }

  function renderErrors(doc, errors) {
    var errorContainer = doc.querySelector('#innfo-feedback-modal [data-innfo="errors"]')
    if (!errorContainer) return
    if (!errors || !errors.length) {
      errorContainer.innerHTML = ''
      errorContainer.style.display = 'none'
      return
    }
    errorContainer.innerHTML =
      '<strong>Validation errors:</strong><ul>' +
      errors.map(function (e) {
        return '<li>' + e + '</li>'
      }).join('') +
      '</ul>'
    errorContainer.style.display = 'block'
  }

  function downloadChangesetExport(doc, state) {
    var identifierInput = doc.querySelector('#innfo-feedback-modal [data-innfo="identifier"]')
    var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
    var composed = composeExport(state, identifier)
    if (!composed.ok) {
      renderErrors(doc, composed.errors)
      return composed
    }
    renderErrors(doc, [])
    var blob = new Blob([composed.changesetText], { type: 'text/markdown;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var anchor = doc.createElement('a')
    anchor.href = url
    anchor.download = composed.changesetFilename
    doc.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(function () {
      URL.revokeObjectURL(url)
    }, 1000)
    return { ok: true, filename: composed.changesetFilename, items: composed.items }
  }

  function copyChangesetPrompt(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal')
    var status = modal && modal.querySelector('[data-innfo="copy-status"]')
    var textarea = modal && modal.querySelector('[data-innfo="export-json"]')
    function announce(msg) {
      if (status) status.textContent = msg
    }
    var composed = composeExport(state, _readIdentifier(modal))
    if (!composed.ok) {
      announce('Cannot copy: fix the validation errors first.')
      return composed
    }
    var promptText =
      'Please apply the following changeset to update ' +
      (state ? state.modelTitle : 'the model') +
      ':\n\n```markdown\n' +
      composed.changesetText +
      '```\n'
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard.writeText(promptText).then(
          function () {
            announce('Copied changeset prompt to clipboard.')
          },
          function () {
            announce(fallbackCopy(doc, textarea, promptText))
          },
        )
        return composed
      }
      announce(fallbackCopy(doc, textarea, promptText))
    } catch {
      announce('Copy failed. Select the text and press Ctrl+C.')
    }
    return composed
  }

  function downloadFeedbackExport(doc, state) {
    var identifierInput = doc.querySelector('#innfo-feedback-modal [data-innfo="identifier"]')
    var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
    var composed = composeExport(state, identifier)
    if (!composed.ok) {
      renderErrors(doc, composed.errors)
      return composed
    }
    renderErrors(doc, [])
    var blob = new Blob([composed.text], { type: 'application/json' })
    var url = URL.createObjectURL(blob)
    var anchor = doc.createElement('a')
    anchor.href = url
    anchor.download = composed.filename
    doc.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(function () {
      URL.revokeObjectURL(url)
    }, 1000)
    return { ok: true, filename: composed.filename, items: composed.items }
  }

  function updateExportPreview(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal')
    if (!modal) return { ok: false }
    var identifierInput = modal.querySelector('[data-innfo="identifier"]')
    var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
    var drafts = state && state.store ? state.store.drafts() : []

    var preview = modal.querySelector('[data-innfo="preview"]')
    if (preview) {
      preview.innerHTML = ''
      var byId = {}
      ;(state && state.elements ? state.elements : []).forEach(function (e) {
        if (e && e.id) byId[e.id] = e
      })
      preview.appendChild(UI.DraftList({ drafts: drafts, byId: byId }, { doc: doc }))
    }

    var composed = composeExport(state, identifier)
    var downloadBtn = modal.querySelector('[data-innfo="download"]')
    var downloadCsBtn = modal.querySelector('[data-innfo="download-changeset"]')
    var copyBtn = modal.querySelector('[data-innfo="copy"]')
    var copyCsBtn = modal.querySelector('[data-innfo="copy-changeset-prompt"]')
    var textarea = modal.querySelector('[data-innfo="export-json"]')

    if (composed.ok) {
      renderErrors(doc, [])
      if (textarea) textarea.value = composed.changesetText || composed.text
      if (downloadBtn) downloadBtn.disabled = false
      if (downloadCsBtn) downloadCsBtn.disabled = false
      if (copyBtn) copyBtn.disabled = false
      if (copyCsBtn) copyCsBtn.disabled = false
    } else {
      renderErrors(doc, composed.errors)
      if (textarea) textarea.value = ''
      if (downloadBtn) downloadBtn.disabled = true
      if (downloadCsBtn) downloadCsBtn.disabled = true
      if (copyBtn) copyBtn.disabled = true
      if (copyCsBtn) copyCsBtn.disabled = true
    }
    return composed
  }

  function copyExport(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal')
    var status = modal && modal.querySelector('[data-innfo="copy-status"]')
    var textarea = modal && modal.querySelector('[data-innfo="export-json"]')
    function announce(msg) {
      if (status) status.textContent = msg
    }
    var composed = composeExport(state, _readIdentifier(modal))
    if (!composed.ok) {
      announce('Cannot copy: fix the validation errors first.')
      return composed
    }
    var text = composed.text
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard.writeText(text).then(
          function () {
            announce('Copied feedback JSON to clipboard.')
          },
          function () {
            announce(fallbackCopy(doc, textarea, text))
          },
        )
        return composed
      }
      announce(fallbackCopy(doc, textarea, text))
    } catch {
      announce('Copy failed. Press Ctrl+C with the JSON selected.')
    }
    return composed
  }

  function _readIdentifier(modal) {
    var input = modal && modal.querySelector('[data-innfo="identifier"]')
    return input && input.value ? String(input.value) : ''
  }

  function fallbackCopy(doc, textarea, text) {
    try {
      if (textarea) {
        textarea.value = text
        if (typeof textarea.select === 'function') textarea.select()
      }
      var ok = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : false
      if (ok) return 'Copied feedback JSON to clipboard.'
      return 'Select the JSON and press Ctrl+C to copy.'
    } catch {
      return 'Copy failed. Select the JSON and press Ctrl+C.'
    }
  }

  function openExportModal(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal') || doc.getElementById('innfo-export-modal')
    if (!modal) {
      downloadFeedbackExport(doc, state)
      return
    }
    var identifierInput = modal.querySelector('[data-innfo="identifier"]')
    var instructions = modal.querySelector('[data-innfo="instructions"]')
    var agentPrompt = modal.querySelector('[data-innfo="agent-prompt"]')
    var drafts = state && state.store ? state.store.drafts() : []

    // One held exported_at per modal opening, so download and copy emit
    // byte-identical JSON.
    if (state) state.exportedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

    if (identifierInput) {
      var storedName = getReviewerName()
      identifierInput.value = storedName === DEFAULT_REVIEWER_NAME ? '' : storedName
    }
    if (instructions) {
      instructions.textContent =
        'Review ' +
        drafts.length +
        ' pending draft(s), then download or copy the feedback JSON or Changeset.'
    }
    if (agentPrompt) {
      agentPrompt.textContent =
        'Apply the attached feedback JSON or Changeset to ' +
        (state ? state.modelTitle : 'Model') +
        ' (' +
        (state ? state.modelVersion : '') +
        ').'
    }

    updateExportPreview(doc, state)

    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal()
    } else {
      modal.setAttribute('open', 'open')
    }

    if (identifierInput && !identifierInput.getAttribute('data-innfo-bound')) {
      identifierInput.setAttribute('data-innfo-bound', '1')
      identifierInput.addEventListener('input', function () {
        updateExportPreview(doc, state)
      })
    }

    var downloadBtn = modal.querySelector('[data-innfo="download"]')
    if (downloadBtn && !downloadBtn.getAttribute('data-innfo-bound')) {
      downloadBtn.setAttribute('data-innfo-bound', '1')
      downloadBtn.addEventListener('click', function () {
        var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (!identifier || identifier === DEFAULT_REVIEWER_NAME) return
        setReviewerName(identifier)
        var res = downloadFeedbackExport(doc, state)
        if (res && res.ok) {
          if (typeof modal.close === 'function') modal.close()
          else modal.removeAttribute('open')
        }
      })
    }

    var downloadCsBtn = modal.querySelector('[data-innfo="download-changeset"]')
    if (downloadCsBtn && !downloadCsBtn.getAttribute('data-innfo-bound')) {
      downloadCsBtn.setAttribute('data-innfo-bound', '1')
      downloadCsBtn.addEventListener('click', function () {
        var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (!identifier || identifier === DEFAULT_REVIEWER_NAME) return
        setReviewerName(identifier)
        var res = downloadChangesetExport(doc, state)
        if (res && res.ok) {
          if (typeof modal.close === 'function') modal.close()
          else modal.removeAttribute('open')
        }
      })
    }

    var copyBtn = modal.querySelector('[data-innfo="copy"]')
    if (copyBtn && !copyBtn.getAttribute('data-innfo-bound')) {
      copyBtn.setAttribute('data-innfo-bound', '1')
      copyBtn.addEventListener('click', function () {
        var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (identifier && identifier !== DEFAULT_REVIEWER_NAME) setReviewerName(identifier)
        copyExport(doc, state)
      })
    }

    var copyCsBtn = modal.querySelector('[data-innfo="copy-changeset-prompt"]')
    if (copyCsBtn && !copyCsBtn.getAttribute('data-innfo-bound')) {
      copyCsBtn.setAttribute('data-innfo-bound', '1')
      copyCsBtn.addEventListener('click', function () {
        var identifier = identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (identifier && identifier !== DEFAULT_REVIEWER_NAME) setReviewerName(identifier)
        copyChangesetPrompt(doc, state)
      })
    }
  }

  function downloadExport(doc, state, identifier) {
    if (identifier && String(identifier).trim()) {
      setReviewerName(String(identifier).trim())
    }
    return downloadFeedbackExport(doc, state)
  }

  // Listeners a boot adds to the document/window, removed when the same
  // document boots again so a re-boot never doubles them.
  var bootTeardowns = typeof WeakMap === 'function' ? new WeakMap() : null

  function boot(doc, opts) {
    var registry = (opts && opts.registry) || defaultViewRegistry
    var active = doc || (typeof document !== 'undefined' ? document : null)
    if (!active) return { ok: false, reason: 'no-document' }
    var cleanups = []
    if (bootTeardowns) {
      var previous = bootTeardowns.get(active)
      if (previous) previous()
      bootTeardowns.set(active, function () {
        cleanups.forEach(function (fn) {
          fn()
        })
        cleanups = []
      })
    }
    function listen(target, type, fn) {
      target.addEventListener(type, fn)
      cleanups.push(function () {
        target.removeEventListener(type, fn)
      })
    }
    var config = parseConfig(slotText(active, 'innfo-config'))
    var slots = parseSlots(slotText(active, 'innfo-schema'), slotText(active, 'innfo-model'))
    var schema = slots.schema
    var model = slots.model
    var meta = isObject(model.meta) ? model.meta : {}
    var elements = Array.isArray(model.elements) ? model.elements : []
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var concepts = Array.isArray(schema.concepts) && schema.concepts.length > 0
      ? schema.concepts
      : elements
          .map(function (e) {
            return e && e.concept
          })
          .filter(function (c, i, arr) {
            return typeof c === 'string' && arr.indexOf(c) === i
          })
          .map(function (c) {
            return { name: c }
          })

    var scopedView = consoleScopeOf(meta)
    var scopedDef = scopedView
      ? registry.list().filter(function (v) {
          return v.id === scopedView
        })[0]
      : null
    if (scopedView) {
      // The search toolbar, concept rail and stats bar only serve the explorer, which a
      // scoped console does not show. Removed, not hidden: their CSS would override [hidden].
      ;['innfo-rail', 'innfo-stats-bar'].forEach(function (id) {
        var node = active.getElementById(id)
        if (node && node.parentNode) node.parentNode.removeChild(node)
      })
      var scopedToolbar = active.querySelector('.innfo-toolbar')
      if (scopedToolbar && scopedToolbar.parentNode) scopedToolbar.parentNode.removeChild(scopedToolbar)
      if (active.documentElement) active.documentElement.setAttribute('data-innfo-scope', scopedView)
    }
    var baseTitle = String(meta.title || meta.model || 'Model')
    var baseId = String(meta.modelId || meta.model || meta.title || 'model')

    var state = {
      modelTitle: scopedView ? baseTitle + ' - ' + (scopedDef ? scopedDef.title : scopedView) : baseTitle,
      modelVersion: String(meta.modelVersion || meta.knowledge_version || 'V_0-0-0'),
      artifactName: String(meta.title || 'console') + '_console.html',
      modelId: meta.modelId || meta.model || meta.title || 'model',
      modelSlug: scopedView
        ? modelSlugOf({ modelSlug: meta.model_slug || meta.modelSlug, modelId: baseId, modelTitle: baseTitle }) + '-' + scopedView
        : meta.model_slug || meta.modelSlug || undefined,
      sourceSha256: meta.sha256 || meta.source_sha256,
      // The changeset title comes from meta.title; a scoped export names its view there.
      meta: scopedView ? Object.assign({}, meta, { title: baseTitle + ' - ' + (scopedDef ? scopedDef.title : scopedView) }) : meta,
      elements: elements,
      store: Review.createDraftStore(
        typeof localStorage !== 'undefined' ? localStorage : null,
        baseId + (scopedView ? '::view:' + scopedView : ''),
      ),
    }

    var counts = {}
    elements.forEach(function (e) {
      if (e && e.concept) counts[e.concept] = (counts[e.concept] || 0) + 1
    })

    var refs = hasNeed(config, 'reference-popup') ? buildRefsByName(elements) : null
    var activeSearchQuery = ''

    function draftCountsOf(currentDrafts) {
      var byConcept = {}
      currentDrafts.forEach(function (d) {
        if (d) {
          var c = d.concept || (d.target && d.target.concept)
          if (c) byConcept[c] = (byConcept[c] || 0) + 1
        }
      })
      return byConcept
    }

    function selectRailToken(token) {
      var search = active.getElementById('innfo-search')
      if (search) {
        search.value = token
        refresh(token)
      }
    }

    // Lightweight update after a draft is saved: refreshes only the draft-count
    // surfaces and leaves the mounted element cards (and their focus) intact.
    var draftListeners = []
    function subscribeDrafts(fn, onError) {
      var entry = { fn: fn, onError: onError }
      draftListeners.push(entry)
      return function () {
        draftListeners = draftListeners.filter(function (l) {
          return l !== entry
        })
      }
    }
    // A destroyed or re-booted console must never call its views again.
    cleanups.push(function () {
      draftListeners = []
    })

    function updateDraftSurfaces() {
      var currentDrafts = state.store.drafts()
      var n = currentDrafts.length
      var bannerCount = active.querySelector('.innfo-banner-drafts')
      if (bannerCount) bannerCount.textContent = ' drafts: ' + n
      updateTabBadges(active, state)
      renderReviewTab(active, state, config, function () {
        refresh(activeSearchQuery)
      })
      renderStatsBar(active, elements, concepts, matrices, n)
      renderRail(active, concepts, counts, draftCountsOf(currentDrafts), selectRailToken, state)
    }

    // A listener may propose or remove drafts, which re-enters this function.
    // Nested notifications are coalesced: at most one extra full pass runs,
    // and a last surfaces-only pass guarantees the counts show the final state.
    var refreshingDrafts = false
    var refreshQueued = false
    function refreshDraftCounts() {
      if (refreshingDrafts) {
        refreshQueued = true
        return
      }
      refreshingDrafts = true
      try {
        var extra = 0
        do {
          refreshQueued = false
          updateDraftSurfaces()
          draftListeners.slice().forEach(function (entry) {
            try {
              entry.fn()
            } catch (err) {
              // A listener must not break the host's draft surfaces; the
              // owning view reports it in the view error notice.
              if (entry.onError) entry.onError(err)
            }
          })
        } while (refreshQueued && ++extra <= 1)
        if (refreshQueued) updateDraftSurfaces()
      } finally {
        refreshingDrafts = false
        refreshQueued = false
      }
    }

    // keepTab: the caller already chose the tab (hash navigation), so a
    // changed query must not switch to Explorer.
    function refresh(query, keepTab) {
      var queryChanged = query !== undefined && query !== activeSearchQuery
      if (query !== undefined) activeSearchQuery = query
      var currentDrafts = state.store.drafts()
      var draftCountsByConcept = draftCountsOf(currentDrafts)

      var draftsById = {}
      currentDrafts.forEach(function (d) {
        if (d && d.element_id) draftsById[d.element_id] = true
      })
      var filterCtx = {
        draftsById: draftsById,
        reviewed: state.store && typeof state.store.reviewed === 'function' ? state.store.reviewed() : {},
      }

      mountElementCards(active, filterElements(elements, activeSearchQuery || '', filterCtx), currentDrafts, refs, concepts)
      renderFilterBar(active, state, function (nextQuery) {
        var sBox = active.getElementById('innfo-search')
        if (sBox) sBox.value = nextQuery
        refresh(nextQuery)
      }, activeSearchQuery)
      renderBanner(active, meta, config.needs, currentDrafts.length, function () {
        refresh(activeSearchQuery)
      }, state)
      renderRail(active, concepts, counts, draftCountsByConcept, selectRailToken, state)

      // Hide documentation overview tree when filtering elements so filtered cards are immediately visible
      var docHost = active.getElementById('innfo-doc')
      if (docHost) {
        docHost.style.display = activeSearchQuery ? 'none' : ''
      }

      // A new query moves to Explorer; the hash is rewritten below, so this
      // switch does not push a history entry.
      if (activeSearchQuery && queryChanged && !keepTab && tabs && !scopedView) {
        tabs.select('explorer', true)
      }

      renderReviewTab(active, state, config, function () {
        refresh(activeSearchQuery)
      })
      updateTabBadges(active, state)
      renderStatsBar(active, elements, concepts, matrices, currentDrafts.length)

      var hist = active.defaultView && active.defaultView.history ? active.defaultView.history : typeof history !== 'undefined' ? history : null
      if (hist && hist.replaceState && active.location) {
        var shownTab = tabs ? tabs.current() || tabs.hashTab() : ''
        var nextHash = buildViewHash(shownTab, activeSearchQuery)
        if (activeSearchQuery || parseViewHash(active.location.hash).q) {
          if (nextHash !== active.location.hash) {
            hist.replaceState(null, '', nextHash || active.location.pathname + active.location.search)
          }
        }
      }

      var content = active.getElementById('innfo-content') || active.getElementById('content')
      if (content) {
        active.dispatchEvent(new CustomEvent('innfo:rendered', { detail: { root: content } }))
      }
    }

    if (hasNeed(config, 'feedback-export')) {
      ensureFeedbackUi(active, state)
    }

    var initialQuery = ''
    if (!scopedView && typeof active.location !== 'undefined' && active.location.hash) {
      initialQuery = parseViewHash(active.location.hash).q
    }

    var searchBox = active.getElementById('innfo-search')
    if (searchBox && initialQuery) {
      searchBox.value = initialQuery
    }

    // Tabs are built once, before the first refresh, and never remounted.
    var tabs = mountTabs(active, {
      getQuery: function () {
        return activeSearchQuery
      },
      registry: registry,
      getController: function () {
        return state.controller
      },
      subscribe: subscribeDrafts,
      onDraftsChanged: refreshDraftCounts,
      config: config,
      schema: schema,
      model: model,
      meta: meta,
      state: state,
      onRefresh: function () {
        refresh(activeSearchQuery)
      },
    })

    if (tabs) cleanups.push(tabs.destroy)
    refresh(initialQuery, !!(tabs && tabs.hashTab()))

    // C3: the controller builds the toggle into the (now rendered) banner and
    // listens for innfo:rendered; created after the first paint so the banner
    // rebuild does not drop the toggle.
    if (hasNeed(config, 'feedback-export')) {
      state.controller = Review.createReviewController(active, {
        meta: meta,
        elements: elements,
        needs: config.needs,
        store: state.store,
        onDraftsChanged: refreshDraftCounts,
      })
    }

    // The first view mounts here, after the initial search had its say.
    if (tabs) tabs.activateInitial()

    if (hasNeed(config, 'document-view')) {
      renderDocumentView(active, elements, concepts)
    }
    renderMatrices(active, matrices)

    var searchBox = active.getElementById('innfo-search')
    if (searchBox) {
      listen(searchBox, 'input', function (event) {
        refresh(event.target && event.target.value ? event.target.value : '')
      })
    }

    if (hasNeed(config, 'feedback-export')) {
      var exportBtn = active.getElementById('innfo-feedback-open') || active.getElementById('innfo-export-open')
      if (exportBtn && !exportBtn.getAttribute('data-innfo-bound')) {
        exportBtn.setAttribute('data-innfo-bound', '1')
        exportBtn.addEventListener('click', function () {
          openExportModal(active, state)
        })
      }
    }

    function onHash() {
      var parsed = parseViewHash(active.location ? active.location.hash : '')
      if (!scopedView && parsed.q !== activeSearchQuery) {
        // Back/forward to an entry with a different query: follow it.
        var box = active.getElementById('innfo-search')
        if (box) box.value = parsed.q
        refresh(parsed.q, true)
      }
      var id = String(active.location ? active.location.hash || '' : '').replace(/^#/, '')
      if (!id) return
      var target = active.getElementById(id)
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView()
    }
    if (typeof active.defaultView !== 'undefined' && active.defaultView) {
      listen(active.defaultView, 'hashchange', onHash)
    } else if (typeof window !== 'undefined' && window.addEventListener) {
      listen(window, 'hashchange', onHash)
    }
    onHash()

    return { ok: true, needs: config.needs, elements: elements.length, controller: state.controller, registry: registry }
  }

  function autoBoot() {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.__innfoNoAutoBoot) return
      if (typeof document === 'undefined' || !document.getElementById) return
      if (document.documentElement && document.documentElement.getAttribute('data-innfo-console-booted') === 'true') return
      if (!document.getElementById('innfo-config')) return
      if (document.documentElement) {
        document.documentElement.setAttribute('data-innfo-console-booted', 'true')
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          boot(document)
        })
      } else {
        boot(document)
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-console boot failed', err)
    }
  }

  autoBoot()

  var PUBLIC_API = {
    version: CONSOLE_VERSION,
    CONSOLE_VERSION: CONSOLE_VERSION,
    FILENAME_PATTERN: FILENAME_PATTERN,
    REVIEWER_STORAGE_KEY: REVIEWER_STORAGE_KEY,
    ITEM_KINDS: ITEM_KINDS,
    ITEM_STATUSES: ITEM_STATUSES,
    slugify: slugify,
    slugifyReviewer: slugifyReviewer,
    stampFromDate: stampFromDate,
    getReviewerName: getReviewerName,
    setReviewerName: setReviewerName,
    buildFeedbackFilename: buildFeedbackFilename,
    parseFeedbackFilename: parseFeedbackFilename,
    isValidExportedAt: isValidExportedAt,
    validateFeedback: validateFeedback,
    parseConfig: parseConfig,
    hasNeed: hasNeed,
    parseSlots: parseSlots,
    resolveElementId: resolveElementId,
    filterElements: filterElements,
    buildRefsByName: buildRefsByName,
    renderRefDialog: renderRefDialog,
    renderCitationDialog: renderCitationDialog,
    renderBanner: renderBanner,
    renderFilterBar: renderFilterBar,
    renderRail: renderRail,
    renderDocument: renderDocument,
    renderDocumentView: renderDocumentView,
    buildTree: buildTree,
    resolveParentId: resolveParentId,
    sortChildren: sortChildren,
    firstChild: firstChild,
    nextStep: nextStep,
    chainOf: chainOf,
    checkStaleness: checkStaleness,
    compileChartSeries: compileChartSeries,
    monthAxis: monthAxis,
    renderCharts: renderCharts,
    renderTimelineGrid: renderTimelineGrid,
    createViewRegistry: createViewRegistry,
    registerView: defaultViewRegistry.register,
    viewRegistrar: defaultViewRegistry.registrar,
    mountTabs: mountTabs,
    updateTabBadges: updateTabBadges,
    renderReviewTab: renderReviewTab,
    focusElementCard: focusElementCard,
    ensureFeedbackUi: ensureFeedbackUi,
    draftToItem: draftToItem,
    downloadFeedbackExport: downloadFeedbackExport,
    composeExport: composeExport,
    composeChangesetExport: composeChangesetExport,
    downloadChangesetExport: downloadChangesetExport,
    copyChangesetPrompt: copyChangesetPrompt,
    serializeFeedback: serializeFeedback,
    downloadExport: downloadExport,
    buildExportDoc: buildExportDoc,
    boot: boot,
  }

  return PUBLIC_API
})
