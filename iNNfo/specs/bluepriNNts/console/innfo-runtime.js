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
  var ITEM_KINDS = ['correction', 'comment', 'new', 'delete']

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

  // D4: exports are named after the immutable knowledge_slug, never the human
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
      var defaultView = typeof parsed.defaultView === 'string' ? parsed.defaultView : ''
      return { needs: needs, runtime: runtime, defaultView: defaultView }
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

  function getElementEffectiveTags(element) {
    if (!element) return []
    if (Array.isArray(element.tags)) {
      return element.tags.map(function (t) { return String(t).toLowerCase() })
    }
    var tags = []
    if (element.fields && element.fields.tags) {
      if (Array.isArray(element.fields.tags)) tags = tags.concat(element.fields.tags)
      else if (typeof element.fields.tags === 'string') tags = tags.concat(element.fields.tags.split(',').map(function (s) { return s.trim() }))
    }
    if (element.inherited && element.inherited.tags && element.inherited.tags.value) {
      var inh = element.inherited.tags.value
      if (Array.isArray(inh)) tags = tags.concat(inh)
      else if (typeof inh === 'string') tags = tags.concat(inh.split(',').map(function (s) { return s.trim() }))
    }
    var seen = {}
    return tags.map(function (t) { return String(t).toLowerCase() }).filter(function (t) {
      if (!t || seen[t]) return false
      seen[t] = true
      return true
    })
  }

  function elementHaystack(element) {
    var parts = [
      element.concept,
      element.name,
      element.description,
      element.modelId,
      element.modelFile,
      element.modelTitle,
      element.location,
    ]
    var effTags = getElementEffectiveTags(element)
    if (effTags.length) {
      parts.push(effTags.join(' '))
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
    if (!raw) return { textTokens: [], operators: [], groups: [] }

    // Tokenize: recognize '(', ')', OR / AND keywords, key:"val", and standalone text
    var tokenRegex = /\(|\)|[^\s"':]+:(?:"[^"]*"|'[^']*'|[^\s()]+)|"[^"]*"|'[^']*'|[^\s()]+/g
    var rawTokens = raw.match(tokenRegex) || []

    function parseAtom(t) {
      var colonIdx = t.indexOf(':')
      if (colonIdx > 0 && t.charAt(0) !== '(' && t.charAt(0) !== ')') {
        var key = t.slice(0, colonIdx).toLowerCase()
        var val = t.slice(colonIdx + 1).replace(/^["']|["']$/g, '').toLowerCase()
        return { type: 'operator', key: key, val: val, raw: t }
      }
      var unquoted = t.replace(/^["']|["']$/g, '')
      return { type: 'text', val: unquoted.toLowerCase(), raw: t }
    }

    // Convert tokens to CNF-like groups: top-level elements separated by AND (implicit or explicit)
    // Parenthesized expressions '( ... )' or sequences joined by 'OR' form disjunctive clauses
    var groups = [] // array of clauses; clause is array of atoms (atoms within a clause are OR'ed)
    var currentOrClause = []
    var textTokens = []
    var operators = []

    var inParen = false
    var parenClause = []

    for (var i = 0; i < rawTokens.length; i++) {
      var tok = rawTokens[i]
      var upper = tok.toUpperCase()

      if (tok === '(') {
        inParen = true
        parenClause = []
        continue
      }
      if (tok === ')') {
        inParen = false
        if (parenClause.length > 0) {
          groups.push(parenClause)
          parenClause = []
        }
        continue
      }

      if (inParen) {
        if (upper === 'OR') continue
        if (upper === 'AND') continue
        var atom = parseAtom(tok)
        if (atom.type === 'operator') operators.push(atom)
        else textTokens.push(atom.val)
        parenClause.push(atom)
        continue
      }

      if (upper === 'OR') {
        // Next atom attaches to current OR clause
        continue
      }
      if (upper === 'AND') {
        if (currentOrClause.length > 0) {
          groups.push(currentOrClause)
          currentOrClause = []
        }
        continue
      }

      var atom = parseAtom(tok)
      if (atom.type === 'operator') operators.push(atom)
      else textTokens.push(atom.val)

      // Look back: was previous token 'OR'?
      var prev = i > 0 ? rawTokens[i - 1].toUpperCase() : ''
      if (prev === 'OR') {
        currentOrClause.push(atom)
      } else {
        if (currentOrClause.length > 0) {
          groups.push(currentOrClause)
          currentOrClause = []
        }
        currentOrClause.push(atom)
      }
    }

    if (currentOrClause.length > 0) {
      groups.push(currentOrClause)
    }
    if (parenClause.length > 0) {
      groups.push(parenClause)
    }

    return { textTokens: textTokens, operators: operators, groups: groups }
  }

  // valueKey: the single normalization used for multi-valued field membership
  // (trim + lowercase), mirroring innfo-core schema/field-values.ts valueKey.
  function valueKey(v) {
    if (v === null || v === undefined) return ''
    return String(v).trim().toLowerCase()
  }

  function getElementFieldValue(el, key) {
    if (!el || !key) return null
    var lkey = String(key).toLowerCase()
    var v = null
    if (el.fields && typeof el.fields === 'object') {
      if (el.fields[key] !== undefined) {
        v = el.fields[key]
      } else {
        var fKeys = Object.keys(el.fields)
        for (var i = 0; i < fKeys.length; i++) {
          if (fKeys[i].toLowerCase() === lkey) {
            v = el.fields[fKeys[i]]
            break
          }
        }
      }
    }
    // Inherited concept-level values are effective values: fall back to them
    // when the element carries no own value for the field.
    if ((v === null || v === '' || v === undefined) && el.inherited && typeof el.inherited === 'object') {
      var iKeys = Object.keys(el.inherited)
      for (var j = 0; j < iKeys.length; j++) {
        if (iKeys[j].toLowerCase() === lkey) {
          var iv = el.inherited[iKeys[j]]
          if (iv && typeof iv === 'object' && 'value' in iv) iv = iv.value
          if (iv !== null && iv !== undefined) v = iv
          break
        }
      }
    }
    if ((v === null || v === '' || v === undefined) && Array.isArray(el.relations)) {
      var relMatches = el.relations
        .filter(function (r) { return r && String(r.field || '').toLowerCase() === lkey })
        .map(function (r) { return r.targetLabel || r.target || '' })
        .filter(Boolean)
      if (relMatches.length) v = relMatches.join(', ')
    }
    return v
  }

  function matchAtom(el, atom, draftsById, reviewedMap, selectFields) {
    if (!atom) return true
    if (atom.type === 'text') {
      return elementHaystack(el).indexOf(atom.val) !== -1
    }
    var op = atom
    var opVal = String(op.val == null ? '' : op.val).trim()
    var isNeg = op.key.charAt(0) === '!' || op.key.charAt(0) === '-'
    var key = isNeg ? op.key.slice(1) : op.key

    if (key === 'concept') {
      var elConcept = String(el.concept || '').toLowerCase()
      var mConcept = elConcept.indexOf(opVal) !== -1
      return isNeg ? !mConcept : mConcept
    }
    if (key === 'model' || key === 'file') {
      var modelHaystack = (
        String(el.modelId || '') +
        ' ' +
        String(el.modelFile || '') +
        ' ' +
        String(el.modelTitle || '')
      ).toLowerCase()
      var mModel = modelHaystack.indexOf(opVal) !== -1
      return isNeg ? !mModel : mModel
    }
    if (key === 'element' || key === 'id' || key === 'name') {
      var elHaystack = (String(el.id || '') + ' ' + String(el.name || '')).toLowerCase()
      var mEl = elHaystack.indexOf(opVal) !== -1
      return isNeg ? !mEl : mEl
    }
    if (key === 'is') {
      var isMatch = false
      if (opVal === 'draft') isMatch = !!draftsById[el.id]
      else if (opVal === 'reviewed') isMatch = !!reviewedMap[el.id]
      else if (opVal === 'changed') isMatch = !!(reviewedMap[el.id] && reviewedMap[el.id] !== el.hash)
      return isNeg ? !isMatch : isMatch
    }
    if (key === 'has') {
      var hasVal = getElementFieldValue(el, opVal)
      var exists = hasVal !== null && hasVal !== undefined && hasVal !== ''
      return isNeg ? !exists : exists
    }
    if (key === 'field') {
      var eqIdx = opVal.indexOf('=')
      if (eqIdx === -1) eqIdx = opVal.indexOf(':')
      if (eqIdx > 0) {
        var fName = opVal.slice(0, eqIdx).trim()
        var fVal = opVal.slice(eqIdx + 1).trim()
        var actual = getElementFieldValue(el, fName)
        if (actual === null || actual === undefined) return isNeg
        var actualStr = String(actual).toLowerCase()
        var mField = actualStr.indexOf(fVal) !== -1
        return isNeg ? !mField : mField
      }
      return true
    }

    var actual = getElementFieldValue(el, key)
    if (actual === null || actual === undefined) return isNeg
    if (!opVal) return true
    // Any-of: `<field>:a|b` matches an element carrying at least one of the listed
    // values (one OR group). Repeated tokens stay AND (handled by filterElements).
    var anyTokens = opVal
      .split('|')
      .map(function (s) { return s.trim() })
      .filter(function (s) { return s !== '' })
    if (anyTokens.length === 0) return true
    var isArrayValue = Array.isArray(actual)
    var actualStr = String(actual).toLowerCase()
    var matched = anyTokens.some(function (tok) {
      if (tok.length > 1 && (tok.charAt(0) === '>' || tok.charAt(0) === '<')) {
        var isGte = tok.slice(0, 2) === '>='
        var isLte = tok.slice(0, 2) === '<='
        var prefixLen = (isGte || isLte) ? 2 : 1
        var numTarget = parseFloat(tok.slice(prefixLen))
        var numActual = parseFloat(actualStr)
        if (isNaN(numTarget) || isNaN(numActual)) return false
        if (isGte) return numActual >= numTarget
        if (isLte) return numActual <= numTarget
        if (tok.charAt(0) === '>') return numActual > numTarget
        return numActual < numTarget
      }
      if (isArrayValue) {
        // Exact membership, case-insensitive (valueKey). Never substring.
        var tv = valueKey(tok)
        return actual.some(function (v) { return valueKey(v) === tv })
      }
      if (selectFields && selectFields[key]) {
        // A scalar select matches by exact, case-insensitive equality.
        return actualStr === tok.toLowerCase()
      }
      return actualStr.indexOf(tok.toLowerCase()) !== -1
    })
    return isNeg ? !matched : matched
  }

  function filterElements(elements, query, context) {
    var list = Array.isArray(elements) ? elements : []
    var parsed = parseFilterQuery(query)
    if (!parsed.textTokens.length && !parsed.operators.length) return list.slice()

    var ctx = context && typeof context === 'object' ? context : {}
    var draftsById = ctx.draftsById || {}
    var reviewedMap = ctx.reviewed || {}

    // Type-aware matching: a scalar `select` field matches by exact equality,
    // other scalar types by substring (arrays are always exact membership).
    var selectFields = {}
    if (ctx.schema && Array.isArray(ctx.schema.fields)) {
      ctx.schema.fields.forEach(function (f) {
        if (f && f.name && String(f.type || '').toLowerCase() === 'select') {
          selectFields[String(f.name).toLowerCase()] = true
        }
      })
    }

    // Check if query used explicit boolean groups (e.g. parentheses or OR keyword)
    var hasExplicitLogic = parsed.groups.some(function (g) { return g.length > 1 }) || query.indexOf('(') !== -1 || /\bOR\b/i.test(query)

    if (hasExplicitLogic) {
      return list.filter(function (el) {
        if (!isObject(el)) return false
        // Every group must match (AND across groups). Within each group, at least one atom must match (OR).
        return parsed.groups.every(function (group) {
          return group.some(function (atom) {
            return matchAtom(el, atom, draftsById, reviewedMap, selectFields)
          })
        })
      })
    }

    // Default facet rules: model/concept keep OR across selections; every other
    // facet combines with AND. A Field named `tags` is an ordinary facet source
    // (any-of is expressed with `|` inside one token, handled by matchAtom).
    var modelOps = []
    var conceptOps = []
    var otherOps = []

    for (var k = 0; k < parsed.operators.length; k++) {
      var oper = parsed.operators[k]
      if (oper.key === 'model' || oper.key === 'file') {
        modelOps.push(oper)
      } else if (oper.key === 'concept') {
        conceptOps.push(oper)
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
        var matchesAnyModel = modelOps.some(function (op) {
          return matchAtom(el, op, draftsById, reviewedMap, selectFields)
        })
        if (!matchesAnyModel) return false
      }

      // Check concept facet (OR across multiple concept selections)
      if (conceptOps.length > 0) {
        var matchesAnyConcept = conceptOps.some(function (op) {
          return matchAtom(el, op, draftsById, reviewedMap, selectFields)
        })
        if (!matchesAnyConcept) return false
      }

      // Other fields (AND by default; a Field named `tags` is an ordinary facet,
      // any-of lives inside one token as `tags:a|b`)
      for (var j = 0; j < otherOps.length; j++) {
        if (!matchAtom(el, otherOps[j], draftsById, reviewedMap, selectFields)) return false
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

  function cleanRefValue(raw) {
    var s = String(raw == null ? '' : raw).trim()
    if (s.slice(0, 2) === '[[' && s.slice(-2) === ']]') s = s.slice(2, -2).trim()
    var pipe = s.indexOf('|')
    if (pipe !== -1) s = s.slice(0, pipe).trim()
    var colon = s.lastIndexOf(':')
    if (colon !== -1) s = s.slice(colon + 1).trim()
    return s
  }

  function resolveParentId(node, nodes) {
    if (!node || !nodes) return null
    var field = node.fields && node.fields.parent
    if (field && field !== '-' && field !== '') {
      var cleaned = cleanRefValue(field)
      if (nodes[field]) return field
      if (cleaned && nodes[cleaned]) return cleaned
      for (var id in nodes) {
        if (nodes[id] && nodes[id].el) {
          var nm = nodes[id].el.name
          if (nm === field || (cleaned && nm === cleaned)) return id
        }
      }
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
    if (!node || !nodes) return null
    var rel = (node.relations || []).filter(function (r) {
      return r.field === 'next' && r.target && nodes[r.target]
    })
    if (rel.length) {
      var cand = nodes[rel[0].target]
      if (cand && cand.parentId === node.parentId) return cand
    }
    var label = node.fields && node.fields.next
    if (label && label !== '-' && label !== '') {
      var cleaned = cleanRefValue(label)
      if (nodes[label] && nodes[label].parentId === node.parentId) return nodes[label]
      if (cleaned && nodes[cleaned] && nodes[cleaned].parentId === node.parentId) return nodes[cleaned]
      for (var id in nodes) {
        var n = nodes[id]
        if (n && n.el && (n.el.name === label || (cleaned && n.el.name === cleaned)) && n.parentId === node.parentId) {
          return n
        }
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
    var fallbackYear = typeof Date !== 'undefined' ? new Date().getFullYear() : 2026
    var startYear = Number(meta && meta.startYear) || fallbackYear
    var n = Math.max(0, Number(count) || 0)
    var labels = []
    for (var i = 0; i < n; i++) {
      var m = ((startMonth - 1 + i) % 12) + 1
      var y = startYear + Math.floor((startMonth - 1 + i) / 12)
      labels.push(String(y) + '-' + pad2(m))
    }
    return labels
  }

  /* Browser console: banner, rail, search, cards, matrices, drafts, export modal.
     Runs only where document/localStorage exist; pure helpers above stay DOM-free. */

  // Escape untrusted text before it is concatenated into an innerHTML string.
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // Transient message for failures the reviewer must see (e.g. drafts not saved).
  // Replaces any previous toast instead of stacking them.
  function showToast(doc, message) {
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null
    var old = doc.querySelector('[data-innfo="toast"]')
    if (old && old.parentNode) old.parentNode.removeChild(old)
    var toast = doc.createElement('div')
    toast.setAttribute('data-innfo', 'toast')
    toast.setAttribute('role', 'alert')
    toast.className = 'innfo-toast'
    toast.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:10000;max-width:360px;padding:10px 14px;' +
      'border-radius:6px;background:#7f1d1d;color:#fff;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.25);'
    toast.textContent = String(message)
    doc.body.appendChild(toast)
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 8000)
    return toast
  }

  function notifyStoreError(doc, err) {
    showToast(
      doc,
      'Your draft could not be saved (browser storage is full or blocked). It stays in this tab only: export your changes now.' +
        (err && err.name ? ' [' + err.name + ']' : ''),
    )
  }

  function el(tag, cls, text) {
    var node = typeof document !== 'undefined' ? document.createElement(tag) : null
    if (!node) return null
    if (cls) node.className = cls
    if (text != null) node.textContent = String(text)
    return node
  }

  // Only http(s) and relative source URLs become links; any other scheme
  // (javascript:, data:, ...) is rejected. Returns '' when unsafe. Verbatim port
  // of the retired model viewer's predicate.
  function safeSourceHref(url) {
    var raw = String(url == null ? '' : url).trim()
    if (!raw) return ''
    var hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)
    var safe = hasScheme ? /^https?:/i.test(raw) : !/^[\s\\]|^\/\/\s*$/.test(raw)
    return safe ? raw : ''
  }

  // The version a console displays comes from the domain meta `models[]` (D4): the
  // real per-model `knowledge_version`. There is no `meta.modelVersion` fallback — a
  // domain with zero or several models has no single version to show. Staleness is
  // per draft (`base_hash`), never a store-level version.
  function domainModelVersion(meta) {
    var models = Array.isArray(meta && meta.models) ? meta.models : []
    return models.length === 1 && models[0] ? String(models[0].version || '') : ''
  }

  // The console header (`.innfo-navbar`) carries the model identity: the title in
  // `#innfo-domain-title` (the single model's title when scoped, else `meta.title`),
  // an optional `.innfo-scope-label`, and an extra meta line in `#innfo-navbar-extra`
  // (Template, Version, Generated). Every value is rendered as text, so a hostile
  // title stays inert; a field absent from `meta` is omitted, never a placeholder.
  function renderNavbarIdentity(doc, meta) {
    meta = meta || {}
    var models = Array.isArray(meta.models) ? meta.models : []
    var titleEl = doc.getElementById('innfo-domain-title')
    if (titleEl) {
      var title =
        models.length === 1 && models[0] && models[0].title
          ? models[0].title
          : meta.title || meta.model || 'iNNfo Console'
      titleEl.textContent = String(title)
    }

    var label = meta.consoleScope && meta.consoleScope.label
    var labelEl = doc.querySelector('.innfo-scope-label')
    if (label) {
      if (!labelEl) {
        labelEl = doc.createElement('span')
        labelEl.className = 'innfo-scope-label'
        if (titleEl && titleEl.parentNode) {
          titleEl.parentNode.insertBefore(labelEl, titleEl.nextSibling)
        } else if (titleEl) {
          titleEl.appendChild(labelEl)
        }
      }
      labelEl.textContent = String(label)
    } else if (labelEl && labelEl.parentNode) {
      labelEl.parentNode.removeChild(labelEl)
    }

    var host = doc.getElementById('innfo-navbar-extra')
    if (host) {
      var first = models[0] || null
      var parts = []
      var template = (first && first.blueprint) || meta.template
      var version = first && first.version
      if (template) parts.push('Template ' + String(template))
      if (version) parts.push('Version ' + String(version))
      if (meta.generated) {
        var stamp = String(meta.generated)
          .replace('T', ' ')
          .replace(/\..*/, '')
          .replace(/Z$/, '')
          .trim()
        parts.push('Generated ' + stamp + ' UTC')
      }
      host.textContent = ''
      if (parts.length) {
        host.appendChild(doc.createTextNode(parts.join(' \u00b7 ')))
        var infoBtn = doc.createElement('button')
        infoBtn.className = 'innfo-navbar-info-btn'
        infoBtn.type = 'button'
        infoBtn.setAttribute('aria-label', 'Domain info')
        infoBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'

        var popover = doc.createElement('div')
        popover.className = 'innfo-navbar-info-popover'
        popover.style.display = 'none'

        var popoverLines = []
        if (template) popoverLines.push('<div><strong>Template:</strong> ' + String(template) + '</div>')
        if (version) popoverLines.push('<div><strong>Version:</strong> ' + String(version) + '</div>')
        if (meta.generated) {
          var stamp = String(meta.generated).replace('T', ' ').replace(/\..*/, '').replace(/Z$/, '').trim()
          popoverLines.push('<div><strong>Generated:</strong> ' + stamp + ' UTC</div>')
        }
        popover.innerHTML = popoverLines.join('')

        infoBtn.addEventListener('click', function (ev) {
          ev.stopPropagation()
          popover.style.display = popover.style.display === 'none' ? 'block' : 'none'
        })

        doc.addEventListener('click', function (ev) {
          if (!popover.contains(ev.target) && ev.target !== infoBtn) {
            popover.style.display = 'none'
          }
        })

        var brand = doc.querySelector('.innfo-brand')
        if (brand && !brand.querySelector('.innfo-navbar-info-btn')) {
          brand.style.position = 'relative'
          brand.appendChild(infoBtn)
          brand.appendChild(popover)
        }
      }
      if (meta.sourceUrl) {
        if (parts.length) host.appendChild(doc.createTextNode(' \u00b7 '))
        var href = safeSourceHref(meta.sourceUrl)
        if (href) {
          var link = doc.createElement('a')
          link.className = 'innfo-source-link'
          link.setAttribute('href', href)
          link.setAttribute('target', '_blank')
          link.setAttribute('rel', 'noopener')
          link.textContent = 'source'
          host.appendChild(link)
        } else {
          // Unsafe or absent scheme: shown as plain text, never a link.
          host.appendChild(doc.createTextNode(String(meta.sourceUrl).trim()))
        }
      }
    }
  }

  // Inline reviewer identity field for the header: a labelled text input whose
  // editability is self-evident (no pencil emoji). Persists to localStorage.
  function buildReviewerChip(doc) {
    var chip = doc.createElement('label')
    chip.className = 'innfo-reviewer-chip'
    var label = doc.createElement('span')
    label.className = 'innfo-reviewer-label'
    label.textContent = 'Reviewer'
    var input = doc.createElement('input')
    input.className = 'innfo-reviewer-name'
    input.type = 'text'
    input.setAttribute('aria-label', 'Reviewer name')
    var current = getReviewerName()
      // Nudge: the default is a SHARED pseudonym, so several reviewers would collapse
      // into one author. Flag it until it is set.
      if (current === DEFAULT_REVIEWER_NAME) {
        chip.setAttribute('data-default', 'true')
        chip.setAttribute('title', 'Set your identifier so your proposals are attributed to you')
      }
    input.value = current === DEFAULT_REVIEWER_NAME ? '' : current
    input.placeholder = DEFAULT_REVIEWER_NAME
    input.addEventListener('change', function () {
      setReviewerName(input.value)
      input.value = getReviewerName() === DEFAULT_REVIEWER_NAME ? '' : getReviewerName()
    })
    chip.appendChild(label)
    chip.appendChild(input)
    return chip
  }

  function renderBanner(doc, meta, needs, draftCount, onReviewerChange, state) {
    var banner = doc.getElementById('innfo-feedback-banner') || doc.getElementById('innfo-banner')
    if (!banner) return
    var existingOpen = banner.querySelector('#innfo-feedback-open') || banner.querySelector('#innfo-export-open')
    banner.innerHTML = ''
    var title = el('span', 'innfo-banner-title', null)
    if (title) {
      title.appendChild(
        UI.Ku(
          'document',
          {
            id: meta.modelId || meta.model || 'model',
            label: String(meta.title || meta.model || 'iNNfo Console'),
          },
          { doc: doc },
        ),
      )
    }
    var version = el('span', 'innfo-banner-version', ' ' + domainModelVersion(meta))
    var draftsBadge = el('span', 'innfo-banner-drafts', ' drafts: ' + (draftCount || 0))
    draftsBadge.setAttribute('data-innfo', 'draft-count')
    var dockDrafts = doc.querySelector('#innfo-review-dock .innfo-dock-drafts')
    if (dockDrafts) dockDrafts.textContent = 'Drafts: ' + (draftCount || 0)

    banner.appendChild(title)
    banner.appendChild(version)
    banner.appendChild(draftsBadge)

    // No store-level staleness: staleness is per draft (`base_hash`), surfaced by
    // the review tab, never by the banner.

    // Reviewer identity: an inline editable field in the header (no emoji, no
    // separate modal — the input itself signals editability).
    banner.appendChild(buildReviewerChip(doc))

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

  function renderFilterBar(doc, state, onQueryChange, activeQuery) {
    var host = doc.getElementById('innfo-filter-facets')
    var activeHost = doc.getElementById('innfo-active-filters')
    if (!host) return
    host.innerHTML = ''
    if (activeHost) activeHost.innerHTML = ''

    var models = state && state.meta && Array.isArray(state.meta.models) ? state.meta.models : []
    var filterModelId = (state && (state.modelId || (state.meta && (state.meta.modelId || state.meta.model)))) || ''
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

        var mUnit =
          UI && typeof UI.Ku === 'function'
            ? UI.Ku(
                'document',
                { id: m.id || m.filePath || m.title, label: m.title || m.filePath || '' },
                { doc: doc },
              )
            : el('span', 'flex-1 truncate font-medium text-slate-700', m.title || m.filePath)
        var cntBadge = el('span', 'badge badge-xs badge-ghost font-mono', String(m.elementCount || 0))

        item.appendChild(cb)
        item.appendChild(mUnit)
        item.appendChild(cntBadge)
        mMenu.appendChild(item)
      })

      mBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = mMenu.classList.contains('open')
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (menu) { menu.classList.remove('open') })
        if (!isOpen) mMenu.classList.add('open')
      })

      if (activeModels.length > 0) {
        var mClear = el('span', 'innfo-facet-clear', '×')
        mClear.setAttribute('role', 'button')
        mClear.setAttribute('title', 'Clear models filter')
        mClear.addEventListener('click', function (e) {
          e.stopPropagation()
          var newOps = parsed.operators.filter(function (op) {
            return op['key'] !== 'model' && op['key'] !== 'file'
          })
          var queryParts = parsed.textTokens.map(function (t) {
            return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
          })
          newOps.forEach(function (op) {
            if (op.raw) queryParts.push(op.raw)
            else {
              var nq = String(op.val).indexOf(' ') !== -1
              queryParts.push(op['key'] + ':' + (nq ? '"' + op.val + '"' : op.val))
            }
          })
          if (typeof onQueryChange === 'function') onQueryChange(queryParts.join(' '))
        })
        mBtn.appendChild(mClear)
      }
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

        var cMetaFacet = conceptMetaOf((state && state.schema && state.schema.concepts) || (state && state.concepts), c.name)
        var cUnit =
          UI && typeof UI.Ku === 'function'
            ? UI.Ku(
                'section',
                {
                  model: filterModelId,
                  concept: c.name,
                  label: c.name,
                  index: cMetaFacet.index,
                  color: cMetaFacet.color,
                },
                { doc: doc },
              )
            : el('span', 'flex-1 truncate font-medium text-slate-700', c.name)
        var cntBadge = el('span', 'badge badge-xs badge-ghost font-mono', String(c.count))

        item.appendChild(cb)
        item.appendChild(cUnit)
        item.appendChild(cntBadge)
        cMenu.appendChild(item)
      })

      cBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = cMenu.classList.contains('open')
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (menu) { menu.classList.remove('open') })
        if (!isOpen) cMenu.classList.add('open')
      })

      if (activeConcepts.length > 0) {
        var cClear = el('span', 'innfo-facet-clear', '×')
        cClear.setAttribute('role', 'button')
        cClear.setAttribute('title', 'Clear concepts filter')
        cClear.addEventListener('click', function (e) {
          e.stopPropagation()
          var newOps = parsed.operators.filter(function (op) {
            return op['key'] !== 'concept' && op['key'] !== '!concept'
          })
          var queryParts = parsed.textTokens.map(function (t) {
            return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
          })
          newOps.forEach(function (op) {
            if (op.raw) queryParts.push(op.raw)
            else {
              var nq = String(op.val).indexOf(' ') !== -1
              queryParts.push(op['key'] + ':' + (nq ? '"' + op.val + '"' : op.val))
            }
          })
          if (typeof onQueryChange === 'function') onQueryChange(queryParts.join(' '))
        })
        cBtn.appendChild(cClear)
      }
      cWrap.appendChild(cBtn)
      cWrap.appendChild(cMenu)
      host.appendChild(cWrap)
    }

    // 3. Fields Dropdown — TWO-STEP: pick the FIELD first, then that field's VALUES.
    // The menu never again holds every value of every field (which is what made a
    // complex domain unusable). The value step offers the DECLARED vocabulary when the
    // schema declares it, and the observed values (bounded) otherwise.
    var fieldCounts = {}
    function rawFieldValue(e, fName) {
      if (!e) return undefined
      var ef = e.fields
      if (ef && typeof ef === 'object' && !Array.isArray(ef) && ef[fName] !== undefined) return ef[fName]
      var inh = e.inherited
      if (inh && typeof inh === 'object' && inh[fName] !== undefined) {
        var iv = inh[fName]
        return iv && typeof iv === 'object' && 'value' in iv ? iv.value : iv
      }
      return undefined
    }
    function declaredFieldDef(fName) {
      var s = state && state.schema
      var fields = s && Array.isArray(s.fields) ? s.fields : []
      for (var i = 0; i < fields.length; i++) {
        if (fields[i] && String(fields[i].name || '') === String(fName)) return fields[i]
      }
      return null
    }
    function observedValues(fName) {
      var out = {}
      var list = state && Array.isArray(state.elements) ? state.elements : []
      list.forEach(function (e) {
        var raw = rawFieldValue(e, fName)
        if (raw === undefined || raw === null || raw === '') return
        var vals = Array.isArray(raw) ? raw : [raw]
        vals.forEach(function (v) {
          if (v === undefined || v === null || v === '') return
          var s = typeof v === 'object' ? JSON.stringify(v) : String(v).trim()
          if (!s || s.length > 60) return
          out[s] = (out[s] || 0) + 1
        })
      })
      return out
    }
    if (state && Array.isArray(state.elements)) {
      state.elements.forEach(function (e) {
        if (!e) return
        var seen = {}
        var note = function (fName) {
          if (!fName || seen[fName]) return
          seen[fName] = true
          fieldCounts[fName] = (fieldCounts[fName] || 0) + 1
        }
        if (e.fields && typeof e.fields === 'object' && !Array.isArray(e.fields)) {
          Object.keys(e.fields).forEach(note)
        }
        if (e.inherited && typeof e.inherited === 'object') {
          Object.keys(e.inherited).forEach(note)
        }
      })
    }
    var fieldNames = Object.keys(fieldCounts).sort()
    if (fieldNames.length > 0) {
      // Find active field operators
      var activeFieldCount = 0
      parsed.operators.forEach(function (op) {
        var normKey = op.key.replace(/^[!-]/, '').toLowerCase()
        if (fieldCounts[normKey] || fieldNames.some(function (fn) { return fn.toLowerCase() === normKey })) {
          activeFieldCount++
        }
      })

      var fWrap = el('div', 'innfo-facet-dropdown')
      var fBtn = el('button', 'innfo-facet-btn' + (activeFieldCount > 0 ? ' active' : ''))
      fBtn.setAttribute('type', 'button')
      var fIcon = typeof InnfoIcons !== 'undefined' ? InnfoIcons.getSvg('sliders', { size: 14 }) || InnfoIcons.getSvg('tag', { size: 14 }) : '🏷️'
      var fLabel = activeFieldCount > 0 ? 'Fields (' + activeFieldCount + ')' : 'Fields'
      fBtn.innerHTML = fIcon + ' <span>' + fLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var fMenu = el('div', 'innfo-facet-menu')
      fMenu.style.minWidth = '240px'

      function fieldValueRows(fName) {
        var rows = el('div', 'innfo-facet-values')
        var def = declaredFieldDef(fName)
        var observed = observedValues(fName)
        var declared = def && Array.isArray(def.options) && def.options.length ? def.options.map(String) : null
        var isBoolean = !!(def && String(def.type || '') === 'boolean')
        var options = isBoolean ? ['true', 'false'] : (declared || Object.keys(observed).sort())
        var isChecked = function (valKey) {
          return parsed.operators.some(function (op) {
            var normKey = op.key.replace(/^[!-]/, '').toLowerCase()
            return normKey === fName.toLowerCase() && String(op.val).toLowerCase() === String(valKey).toLowerCase()
          })
        }
        options.slice(0, 200).forEach(function (valKey) {
          var item = el('label', 'innfo-facet-item')
          var cb = el('input', 'innfo-facet-checkbox')
          cb.type = 'checkbox'
          cb.checked = isChecked(valKey)
          cb.addEventListener('change', function () {
            toggleFacet(fName, valKey, cb.checked)
          })
          var nameSpan = el('span', 'flex-1 truncate font-medium text-slate-700', String(valKey))
          nameSpan.title = fName + ': ' + valKey
          item.appendChild(cb)
          item.appendChild(nameSpan)
          if (observed[valKey] != null) {
            item.appendChild(el('span', 'badge badge-xs badge-ghost font-mono', String(observed[valKey])))
          }
          rows.appendChild(item)
        })
        if (!isBoolean && !declared) {
          // Free text covers values outside the declared vocabulary; the grammar takes
          // `a|b` for OR inside one token.
          var entry = el('div', 'innfo-facet-item')
          var input = el('input', 'innfo-facet-input')
          input.type = 'text'
          input.placeholder = 'value  (a|b is OR)'
          input.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Enter') return
            ev.preventDefault()
            var v = String(input.value || '').trim()
            if (v) toggleFacet(fName, v, true)
            input.value = ''
          })
          entry.appendChild(input)
          rows.appendChild(entry)
        }
        return rows
      }

      function renderFieldStep(fName) {
        fMenu.innerHTML = ''
        var back = el('button', 'innfo-facet-back', '\u2190 Fields')
        back.setAttribute('type', 'button')
        back.addEventListener('click', function (ev) {
          ev.stopPropagation()
          renderFieldList()
        })
        fMenu.appendChild(back)
        fMenu.appendChild(el('div', 'text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1 border-b border-slate-100', fName))
        fMenu.appendChild(fieldValueRows(fName))
      }

      function renderFieldList() {
        fMenu.innerHTML = ''
        fieldNames.forEach(function (fName) {
          var item = el('button', 'innfo-facet-item')
          item.setAttribute('type', 'button')
          item.appendChild(el('span', 'flex-1 truncate font-medium text-slate-700', fName))
          item.appendChild(el('span', 'badge badge-xs badge-ghost font-mono', String(fieldCounts[fName] || 0)))
          item.addEventListener('click', function (ev) {
            ev.stopPropagation()
            renderFieldStep(fName)
          })
          fMenu.appendChild(item)
        })
      }

      renderFieldList()

      fBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = fMenu.classList.contains('open')
        doc.querySelectorAll('.innfo-facet-menu').forEach(function (menu) { menu.classList.remove('open') })
        if (!isOpen) {
          renderFieldList()
          fMenu.classList.add('open')
        }
      })

      if (activeFieldCount > 0) {
        var fClear = el('span', 'innfo-facet-clear', '×')
        fClear.setAttribute('role', 'button')
        fClear.setAttribute('title', 'Clear fields filter')
        fClear.addEventListener('click', function (e) {
          e.stopPropagation()
          var newOps = parsed.operators.filter(function (op) {
            var normKey = op.key.replace(/^[!-]/, '').toLowerCase()
            return !fieldCounts[normKey] && !fieldNames.some(function (fn) { return fn.toLowerCase() === normKey })
          })
          var queryParts = parsed.textTokens.map(function (t) {
            return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
          })
          newOps.forEach(function (op) {
            if (op.raw) queryParts.push(op.raw)
            else {
              var nq = String(op.val).indexOf(' ') !== -1
              queryParts.push(op['key'] + ':' + (nq ? '"' + op.val + '"' : op.val))
            }
          })
          if (typeof onQueryChange === 'function') onQueryChange(queryParts.join(' '))
        })
        fBtn.appendChild(fClear)
      }

      fWrap.appendChild(fBtn)
      fWrap.appendChild(fMenu)
      host.appendChild(fWrap)
    }
    // The AND/OR explanation is NOT visible UI: it lives on the connector tooltip.

    // 4. Clear button if any filter is active
    if (activeQuery) {
      var clearBtn = el('button', 'btn btn-ghost btn-xs text-xs text-slate-500 hover:text-error', 'Clear filters')
      clearBtn.setAttribute('type', 'button')
      clearBtn.addEventListener('click', function () {
        if (typeof onQueryChange === 'function') onQueryChange('')
      })
      host.appendChild(clearBtn)
    }

    // 4. Render Active Filter Pills grouped by Boolean Clause (with explicit AND / OR connectors)
    if (activeHost && (parsed.operators.length > 0 || parsed.textTokens.length > 0)) {
      var schemaConcepts = (state && state.concepts && state.concepts.length ? state.concepts : (state && state.schema && state.schema.concepts)) || allConcepts.map(function (c) { return c.name })

      function renderAtomPill(atom) {
        var pill = el('span', 'innfo-active-filter-pill badge badge-sm badge-outline gap-1.5 text-[11px] py-2 px-2.5 bg-base-100')
        if (atom.type === 'text') {
          pill.classList.add('font-mono')
          pill.appendChild(el('span', null, '"' + atom.val + '"'))
          var removeBtn = el('button', 'innfo-filter-pill-remove ml-1 hover:text-error cursor-pointer font-bold', '×')
          removeBtn.setAttribute('type', 'button')
          removeBtn.addEventListener('click', function (e) {
            e.stopPropagation()
            var nextTokens = parsed.textTokens.filter(function (t) { return t !== atom.val })
            var nextQuery = nextTokens.concat(parsed.operators.map(function (o) { return o.raw || formatFacetToken(o.key, o.val) })).join(' ')
            if (typeof onQueryChange === 'function') onQueryChange(nextQuery)
          })
          pill.appendChild(removeBtn)
          return pill
        }

        var op = atom
        pill.setAttribute('data-filter-key', String(op.key))
        if (op.key === 'concept' || op.key === '!concept') {
          var cMeta = conceptMetaOf(schemaConcepts, op.val)
          pill.classList.add('innfo-active-filter-pill--concept')
          pill.setAttribute('data-concept-slot', String(cMeta.slot))
          if (cMeta.hexColor) {
            pill.style.setProperty('--pill-concept-color', cMeta.hexColor)
            pill.style.borderColor = cMeta.hexColor
            pill.style.color = cMeta.hexColor
            pill.style.backgroundColor = 'color-mix(in srgb, ' + cMeta.hexColor + ' 10%, #ffffff)'
          }
          var matchedConcept = conceptByName(schemaConcepts, op.val)
          var cDisplay = (matchedConcept && matchedConcept.name) || op.val
          pill.appendChild(
            UI.Ku(
              'section',
              {
                model: filterModelId,
                concept: op.val,
                label: (op.key === '!concept' ? '!Concept: ' : 'Concept: ') + cDisplay,
                index: cMeta.index,
                color: cMeta.color,
              },
              { doc: doc },
            ),
          )
        } else if (op.key === 'model' || op.key === 'file') {
          pill.classList.add('innfo-active-filter-pill--model')
          var matchedModel = models.filter(function (m) {
            var mid = String(m.id || m.filePath || '').toLowerCase()
            return mid === String(op.val).toLowerCase()
          })[0]
          var mDisplay = (matchedModel && (matchedModel.title || matchedModel.id)) || op.val
          pill.appendChild(
            UI.Ku('document', { id: op.val, label: 'Model: ' + mDisplay }, { doc: doc }),
          )
        } else {
          var labelText = op.key + ':' + op.val
          pill.appendChild(el('span', 'font-mono', labelText))
        }
        var removeBtn = el('button', 'innfo-filter-pill-remove ml-1 hover:text-error cursor-pointer font-bold', '×')
        removeBtn.setAttribute('type', 'button')
        removeBtn.setAttribute('aria-label', 'Remove filter ' + op.key)
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          toggleFacet(op.key, op.val, false)
        })
        pill.appendChild(removeBtn)
        return pill
      }

      var displayGroups = parsed.groups.length > 0
        ? parsed.groups
        : [parsed.operators.concat(parsed.textTokens.map(function (t) { return { type: 'text', val: t } }))]

      function serializeGroups(groups) {
        return groups.map(function (clause) {
          var clauseStr = clause.map(function (atom) {
            return atom.raw || (atom.type === 'operator' ? formatFacetToken(atom.key, atom.val) : '"' + atom.val + '"')
          }).join(' OR ')
          return clause.length > 1 ? '(' + clauseStr + ')' : clauseStr
        }).join(' AND ')
      }

      function createConnectorSelect(currentVal, onChange) {
        // A segmented control, matching the rest of the console (was a native <select>).
        var group = el('span', 'innfo-op-toggle')
        group.setAttribute('role', 'group')
        group.setAttribute('aria-label', 'Combine with')
        // The AND/OR explanation, on hover only.
        group.setAttribute('title', "Fields and text combine with AND; within one token a|b is OR. Model and Concept combine with OR. Inside one Field token, a|b matches any of the listed values.")
        ;['AND', 'OR'].forEach(function (val) {
          var b = el('button', 'innfo-op-btn' + (val === currentVal ? ' active' : ''), val)
          b.setAttribute('type', 'button')
          b.setAttribute('aria-pressed', val === currentVal ? 'true' : 'false')
          b.addEventListener('click', function (e) {
            e.stopPropagation()
            if (val !== currentVal) onChange(val)
          })
          group.appendChild(b)
        })
        return group
      }

      displayGroups.forEach(function (clause, cIdx) {
        if (cIdx > 0) {
          var andSelect = createConnectorSelect('AND', function (newVal) {
            if (newVal === 'OR') {
              // Merge clause with previous clause into an OR group
              var newGroups = []
              for (var i = 0; i < displayGroups.length; i++) {
                if (i === cIdx - 1) {
                  newGroups.push(displayGroups[cIdx - 1].concat(displayGroups[cIdx]))
                } else if (i === cIdx) {
                  // already merged
                } else {
                  newGroups.push(displayGroups[i])
                }
              }
              if (typeof onQueryChange === 'function') onQueryChange(serializeGroups(newGroups))
            }
          })
          activeHost.appendChild(andSelect)
        }

        var isMulti = clause.length > 1
        var clauseContainer = isMulti
          ? el('span', 'inline-flex items-center gap-1.5 p-1 bg-slate-50 border border-dashed border-slate-300 rounded-lg')
          : null

        clause.forEach(function (atom, aIdx) {
          if (aIdx > 0) {
            var orSelect = createConnectorSelect('OR', function (newVal) {
              if (newVal === 'AND') {
                // Split clause into two separate AND clauses
                var newGroups = []
                for (var i = 0; i < displayGroups.length; i++) {
                  if (i === cIdx) {
                    newGroups.push(clause.slice(0, aIdx))
                    newGroups.push(clause.slice(aIdx))
                  } else {
                    newGroups.push(displayGroups[i])
                  }
                }
                if (typeof onQueryChange === 'function') onQueryChange(serializeGroups(newGroups))
              }
            })
            if (clauseContainer) clauseContainer.appendChild(orSelect)
            else activeHost.appendChild(orSelect)
          }
          var atomEl = renderAtomPill(atom)
          if (clauseContainer) clauseContainer.appendChild(atomEl)
          else activeHost.appendChild(atomEl)
        })

        if (clauseContainer) activeHost.appendChild(clauseContainer)
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

  function formatFacetToken(key, val) {
    var s = String(val == null ? '' : val)
    return key + ':' + (s.indexOf(' ') !== -1 ? '"' + s + '"' : s)
  }

  function renderRail(doc, concepts, counts, draftCountsByConcept, onSelect, state, activeQuery) {
    var rail = doc.getElementById('innfo-rail')
    if (!rail) return
    rail.innerHTML = ''

    var queryStr = activeQuery !== undefined
      ? activeQuery
      : (doc.getElementById('innfo-search') && doc.getElementById('innfo-search').value) || ''
    var parsedRailQuery = parseFilterQuery(queryStr)
    var activeModels = []
    var activeConcepts = []
    parsedRailQuery.operators.forEach(function (op) {
      if (op.key === 'model' || op.key === 'file') activeModels.push(String(op.val).toLowerCase())
      else if (op.key === 'concept') activeConcepts.push(String(op.val).toLowerCase())
    })

    function mk(tag) {
      return doc.createElement ? doc.createElement(tag) : el(tag)
    }
    function conceptButton(name, index) {
      var count = counts[name] || 0
      var draftCount = draftCountsByConcept ? draftCountsByConcept[name] || 0 : 0
      var btn = mk('button')
      if (!btn) return null
      var isActive = activeConcepts.indexOf(String(name).toLowerCase()) !== -1
      btn.className = 'innfo-rail-item' + (isActive ? ' active' : '')
      btn.setAttribute('data-concept', String(name))
      var railModel = (state && (state.modelId || (state.meta && (state.meta.modelId || state.meta.model)))) || ''
      var pill = UI.Ku(
        'section',
        {
          model: railModel,
          concept: name,
          label: name,
          index: index,
        },
        { doc: doc },
      )
      if (pill) btn.appendChild(pill)
      if (pill && count != null) btn.appendChild(el('span', 'innfo-rail-count', String(count)))
      if (draftCount > 0) {
        var badge = el('span', 'innfo-rail-badge', String(draftCount))
        if (badge) {
          badge.setAttribute('title', draftCount + ' unexported draft note(s)')
          btn.appendChild(badge)
        }
      }
      btn.addEventListener('click', function () {
        if (typeof onSelect === 'function') onSelect(formatFacetToken('concept', name))
      })
      return btn
    }
    function conceptNamesForModel(m) {
      var mid = String(m.id || m.filePath)
      var seen = {}
      var out = []
      ;(state && Array.isArray(state.elements) ? state.elements : []).forEach(function (e) {
        if (!e) return
        if (String(e.modelId || e.modelFile || '') !== mid) return
        if (e.concept && !seen[e.concept]) {
          seen[e.concept] = true
          out.push(e.concept)
        }
      })
      if (!out.length && Array.isArray(m.conceptNames)) {
        m.conceptNames.forEach(function (c) {
          if (c && !seen[c]) {
            seen[c] = true
            out.push(c)
          }
        })
      }
      return out
    }

    var models = state && state.meta && Array.isArray(state.meta.models) && state.meta.models.length > 1
      ? state.meta.models
      : null

    // Hierarchical rail: Level 1 = one <details> per model, Level 2 = its concepts
    // nested inside. Clicking a model sets the `model:` facet; clicking a concept
    // sets the `concept:` facet. Falls back to the flat concept list for single-model
    // consoles (models absent or length <= 1).
    if (models) {
      if (state && !state._collapsedModels) state._collapsedModels = {}
      var list = mk('ul')
      if (list) list.className = 'menu menu-xs bg-base-100 p-2 w-full'
      var globalIndex = 0
      var globalConcepts = Array.isArray(concepts) ? concepts : []
      function conceptColor(name) {
        var def = globalConcepts.filter(function (c) {
          return (typeof c === 'string' ? c : c.name) === name
        })[0]
        return (def && def.color) || null
      }
      models.forEach(function (m) {
        var mid = String(m.id || m.filePath)
        var li = mk('li')
        var details = mk('details')
        details.className = 'collapse collapse-arrow'
        details.open = !(state && state._collapsedModels && state._collapsedModels[mid])
        var summary = mk('summary')
        var isModelActive = activeModels.indexOf(mid.toLowerCase()) !== -1
        summary.className = 'collapse-title min-h-0 py-2 pr-8' + (isModelActive ? ' active' : '')
        summary.setAttribute('data-model', mid)
        summary.appendChild(
          UI.Ku(
            'document',
            { id: m.id || m.filePath || m.title, label: m.title || m.filePath || 'Model' },
            { doc: doc },
          ),
        )
        summary.appendChild(
          el('span', 'innfo-rail-count badge badge-ghost badge-xs', String(Number(m.elementCount) || 0)),
        )
        summary.addEventListener('click', function (e) {
          // Clicking the chevron zone on the right edge toggles accordion open/close
          // without clobbering the active search filter.
          var w = summary.clientWidth || 0
          var x = e && typeof e.offsetX === 'number' ? e.offsetX : 0
          if (w > 0 && x > w - 30) {
            if (state && state._collapsedModels) {
              setTimeout(function () {
                state._collapsedModels[mid] = !details.open
              }, 0)
            }
            return
          }
          if (e && typeof e.preventDefault === 'function') e.preventDefault()
          if (typeof onSelect === 'function') onSelect(formatFacetToken('model', mid))
        })
        details.appendChild(summary)

        var sub = mk('ul')
        var names = conceptNamesForModel(m)
        var modelSet = {}
        names.forEach(function (n) {
          modelSet[n] = true
        })
        if (!names.length) {
          globalConcepts.forEach(function (c) {
            var nm = typeof c === 'string' ? c : c.name
            if (nm && !modelSet[nm]) {
              modelSet[nm] = true
              names.push(nm)
            }
          })
        }
        names.forEach(function (name) {
          var cli = mk('li')
          var a = mk('a')
          if (a) {
            a.setAttribute('data-concept', String(name))
            if (activeConcepts.indexOf(String(name).toLowerCase()) !== -1) {
              a.className = 'active'
            }
            var cMeta = conceptMetaOf(globalConcepts, name)
            var color = cMeta.hexColor
            a.setAttribute('data-concept-slot', String(cMeta.slot))
            if (color) a.style.setProperty('--rail-concept-color', color)
            a.appendChild(
              UI.Ku(
                'section',
                { model: mid, concept: name, label: name, index: cMeta.index, color: cMeta.color },
                { doc: doc },
              ),
            )
            a.appendChild(
              el('span', 'innfo-rail-count badge badge-ghost badge-xs', String(Number(counts && counts[name]) || 0)),
            )
            a.addEventListener('click', function (e) {
              if (e && e.preventDefault) e.preventDefault()
              if (typeof onSelect === 'function') onSelect(formatFacetToken('concept', name))
            })
          }
          cli.appendChild(a)
          sub.appendChild(cli)
        })
        details.appendChild(sub)

        li.appendChild(details)
        list.appendChild(li)
      })
      rail.appendChild(list)
      return
    }

    // Flat fallback (single-model console).
    var cHdr = el('div', 'innfo-rail-header')
    cHdr.innerHTML = '<span>Concepts (' + (concepts ? concepts.length : 0) + ')</span>'
    rail.appendChild(cHdr)
    ;(Array.isArray(concepts) ? concepts : []).forEach(function (concept, index) {
      var name = typeof concept === 'string' ? concept : concept.name
      var btn = conceptButton(name, index)
      if (btn) rail.appendChild(btn)
    })
  }

  // ---- Concept guidance panel ----------------------------------------------
  // Parity with the editor's RightGuidanceSidebar: when a single concept is in
  // focus (selected through the rail, i.e. a `concept:` filter), show its
  // description, field schema, markers and matrices in a right sidebar.

  function conceptByName(concepts, name) {
    var target = String(name || '').toLowerCase()
    if (!target) return null
    var list = Array.isArray(concepts) ? concepts : []
    var i
    for (i = 0; i < list.length; i++) {
      var c = list[i]
      var cname = typeof c === 'string' ? c : c && c.name
      if (String(cname || '').toLowerCase() === target) return typeof c === 'string' ? { name: c } : c
    }
    for (i = 0; i < list.length; i++) {
      var c2 = list[i]
      var n2 = String((typeof c2 === 'string' ? c2 : c2 && c2.name) || '').toLowerCase()
      if (n2 && (n2.indexOf(target) !== -1 || target.indexOf(n2) !== -1)) {
        return typeof c2 === 'string' ? { name: c2 } : c2
      }
    }
    return null
  }

  function activeGuideConcept(query, concepts) {
    var parsed = parseFilterQuery(query)
    var op = null
    for (var i = 0; i < parsed.operators.length; i++) {
      var o = parsed.operators[i]
      if ((o.key === 'concept' || o.key === '!concept') && !op) op = o
    }
    if (!op) return null
    return conceptByName(concepts, op.val)
  }

  function guideFieldsFor(concept, schema) {
    if (Array.isArray(concept.fields) && concept.fields.length) return concept.fields
    var all = schema && Array.isArray(schema.fields) ? schema.fields : []
    var cname = String(concept.name).toLowerCase()
    return all.filter(function (f) {
      if (!f || !f.concept) return false
      var fc = String(f.concept).toLowerCase()
      return fc === cname || fc === '*'
    })
  }

  function guideMatricesFor(concept, matrices, schema) {
    var cname = String(concept.name).toLowerCase()
    var list =
      Array.isArray(matrices) && matrices.length
        ? matrices
        : schema && Array.isArray(schema.matrices)
          ? schema.matrices
          : []
    return list.filter(function (m) {
      if (!m) return false
      return (
        String(m.source || '').toLowerCase() === cname || String(m.target || '').toLowerCase() === cname
      )
    })
  }

  function renderConceptGuide(doc, concept, schema, matrices, counts, modelId) {
    var layout = doc.getElementById('innfo-layout')
    if (!layout) return
    var host = doc.getElementById('innfo-concept-guide')
    if (!concept) {
      if (host && host.parentNode) host.parentNode.removeChild(host)
      return
    }
    if (!host) {
      host = el('aside', 'innfo-guide')
      host.id = 'innfo-concept-guide'
      host.setAttribute('aria-label', 'Concept guidance')
      layout.appendChild(host)
    }
    host.innerHTML = ''

    var name = concept.name || 'Concept'
    var gMeta = conceptMetaOf(schema && schema.concepts, name)
    var head = el('div', 'innfo-guide-head')
    var badge =
      UI && typeof UI.Ku === 'function'
        ? UI.Ku('section', { model: modelId || '', concept: name, label: name, index: gMeta.index, color: gMeta.color }, { doc: doc })
        : el('span', 'innfo-card-concept-badge badge badge-sm', name)
    head.appendChild(badge)

    var count = counts && counts[name] != null ? counts[name] : null
    if (count != null) {
      head.appendChild(el('span', 'innfo-guide-meta', count + ' ' + (count === 1 ? 'element' : 'elements')))
    }
    // Collapsible: the toggle lives in the head and survives re-renders because
    // the collapsed state is a class on the aside, not on the rebuilt children.
    var collapseBtn = el('button', 'innfo-guide-collapse')
    collapseBtn.setAttribute('type', 'button')
    var setCollapsed = function (collapsed) {
      if (collapsed) host.classList.add('is-collapsed')
      else host.classList.remove('is-collapsed')
      collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      collapseBtn.setAttribute('aria-label', collapsed ? 'Expand concept details' : 'Collapse concept details')
      collapseBtn.setAttribute('title', collapsed ? 'Expand' : 'Collapse')
      collapseBtn.innerHTML = UI.icon(collapsed ? 'chevron-left' : 'chevron-right', 15)
    }
    setCollapsed(host.classList.contains('is-collapsed'))
    collapseBtn.addEventListener('click', function () {
      setCollapsed(!host.classList.contains('is-collapsed'))
    })
    head.appendChild(collapseBtn)
    host.appendChild(head)

    var description = concept.description || concept.summary || ''
    if (description) host.appendChild(el('p', 'innfo-guide-desc', String(description)))

    var fields = guideFieldsFor(concept, schema)
    if (fields.length) {
      var fs = el('section', 'innfo-guide-section')
      fs.appendChild(el('h4', 'innfo-guide-title', 'Fields (' + fields.length + ')'))
      var fdl = el('dl', 'innfo-guide-list innfo-guide-field-list')
      fields.forEach(function (f) {
        if (!f) return
        var label = f.label || f.name
        if (label == null) return
        var dt = el('dt', 'innfo-guide-field-dt')
        var declaredBy = f.declaredBy || {}
        dt.appendChild(
          UI.Ku(
            'field',
            {
              family: declaredBy.family || modelId || '',
              concept: f.concept || name,
              name: f.name || label,
              label: String(label),
              vtype: f.type || f.widget,
            },
            { doc: doc },
          ),
        )
        var dd = el('dd', 'innfo-guide-field-dd')
        var fTypeStr = String(f.type || f.widget || 'string')
        var tBadge = el('span', 'innfo-ku-field-type', fTypeStr)
        dd.appendChild(tBadge)
        if (f.multiple) dd.appendChild(el('span', 'innfo-ku-field-multi', 'multi'))
        var targetC = f.target || f.targetConcept || null
        if (targetC) {
          var tcMeta = conceptMetaOf(schema && schema.concepts, targetC)
          dd.appendChild(
            UI.Ku('section', { model: modelId || '', concept: targetC, label: targetC, index: tcMeta.index, color: tcMeta.color }, { doc: doc }),
          )
        }
        if (f.description) dd.appendChild(el('p', 'innfo-guide-field-desc', String(f.description)))
        fdl.appendChild(dt)
        fdl.appendChild(dd)
      })
      fs.appendChild(fdl)
      host.appendChild(fs)
    }

    var conceptVals = concept.conceptFields && typeof concept.conceptFields === 'object' ? concept.conceptFields : null
    if (!conceptVals && schema && schema.concepts) {
      var cMetaForVals = conceptMetaOf(schema.concepts, concept.name)
      if (cMetaForVals && cMetaForVals.conceptFields) conceptVals = cMetaForVals.conceptFields
    }
    if (conceptVals) {
      var cvKeys = Object.keys(conceptVals)
      if (cvKeys.length) {
        var cvs = el('section', 'innfo-guide-section')
        cvs.appendChild(el('h4', 'innfo-guide-title', 'Concept values'))
        var cvl = el('dl', 'innfo-guide-list innfo-guide-value-list')
        cvKeys.forEach(function (k) {
          var v = conceptVals[k]
          var cvDt = el('dt', 'innfo-guide-field-dt')
          cvDt.appendChild(
            UI.Ku(
              'field',
              { family: modelId || '', concept: name, name: k, label: String(k) },
              { doc: doc },
            ),
          )
          var cvDd = el('dd', 'innfo-guide-field-dd')
          cvDd.appendChild(
            UI.Ku(
              'value',
              {
                model: modelId || '',
                concept: name,
                scope: 'concept',
                field: k,
                label: Array.isArray(v) ? v.join(', ') : String(v),
              },
              { doc: doc },
            ),
          )
          cvl.appendChild(cvDt)
          cvl.appendChild(cvDd)
        })
        cvs.appendChild(cvl)
        host.appendChild(cvs)
      }
    }

    var matrixList = guideMatricesFor(concept, matrices, schema)
    if (matrixList.length) {
      var mts = el('section', 'innfo-guide-section')
      mts.appendChild(el('h4', 'innfo-guide-title', 'Matrices (' + matrixList.length + ')'))
      var mtl = el('ul', 'innfo-guide-list innfo-guide-matrix-list')
      matrixList.forEach(function (m) {
        if (!m) return
        var mli = el('li', 'innfo-guide-matrix-item')
        var mLabel = String(m.name || (m.source + ' \u2192 ' + m.target))
        var mDeclaredBy = m.declaredBy || {}
        mli.appendChild(
          UI.Ku(
            'matrix',
            {
              model: modelId || '',
              family: mDeclaredBy.family || modelId || '',
              name: m.slug || UI.slug(m.name || mLabel),
              label: mLabel,
            },
            { doc: doc },
          ),
        )
        if (m.source && m.target) {
          var pairWrap = el('div', 'innfo-guide-matrix-pair')
          var sMeta = conceptMetaOf(schema && schema.concepts, m.source)
          var tMeta = conceptMetaOf(schema && schema.concepts, m.target)
          pairWrap.appendChild(
            UI.Ku('section', { model: modelId || '', concept: m.source, label: m.source, index: sMeta.index, color: sMeta.color }, { doc: doc }),
          )
          pairWrap.appendChild(el('span', 'innfo-guide-matrix-arrow', '⇄'))
          pairWrap.appendChild(
            UI.Ku('section', { model: modelId || '', concept: m.target, label: m.target, index: tMeta.index, color: tMeta.color }, { doc: doc }),
          )
          mli.appendChild(pairWrap)
        }
        mtl.appendChild(mli)
      })
      mts.appendChild(mtl)
      host.appendChild(mts)
    }
  }

  var SLOT_HEX_PALETTE = [
    '#3b82f6', // 1: blue
    '#8b5cf6', // 2: violet
    '#14b8a6', // 3: teal
    '#f59e0b', // 4: amber
    '#ec4899', // 5: pink
    '#22c55e', // 6: green
    '#f97316', // 7: orange
    '#6366f1', // 8: indigo
    '#ef4444', // 9: red
    '#eab308', // 10: yellow
    '#a855f7', // 11: purple
    '#6b7280', // 12: grey
  ]

  function conceptMetaOf(concepts, name) {
    var list = Array.isArray(concepts) ? concepts : []
    var idx = -1
    var found = null
    var target = String(name || '').toLowerCase()
    for (var i = 0; i < list.length; i++) {
      var c = list[i]
      var cName = typeof c === 'string' ? c : c && c.name
      if (cName === name || (target && String(cName || '').toLowerCase() === target)) {
        idx = i
        found = typeof c === 'object' ? c : null
        break
      }
    }
    if (idx === -1) {
      var h = 0
      for (var j = 0; j < target.length; j++) h = (h * 31 + target.charCodeAt(j)) >>> 0
      idx = target ? h % 12 : 0
    }
    var rawColor = found && found.color ? String(found.color).trim() : undefined
    var safeRaw = rawColor && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{2,20})$/.test(rawColor) ? rawColor : undefined
    var slot = UI && typeof UI.conceptSlot === 'function' ? UI.conceptSlot({ index: idx, color: safeRaw }) : (idx % 12) + 1
    var hexColor = safeRaw && safeRaw.charAt(0) === '#'
      ? safeRaw
      : SLOT_HEX_PALETTE[(slot - 1) % SLOT_HEX_PALETTE.length]
    return {
      index: idx,
      slot: slot,
      color: safeRaw || hexColor,
      hexColor: hexColor,
      icon: found && found.icon,
    }
  }

  // Projects live drafts over the element list: a correction draft patches its
  // field value and a new draft becomes a projected element. Shared by the card
  // and table explorer views so both show the same pending state.
  function projectElements(elements, drafts) {
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

    return projectedElements
  }

  // A knowledge field names a model: strip `[[ ]]`, an alias or anchor, a leading
  // `kNNowledge/` path and the `_NN.md` / `.md` suffix, case-insensitively.
  function knowledgeStem(value) {
    var s = String(value == null ? '' : value).trim()
    s = s.replace(/^\[\[\s*/, '').replace(/\s*\]\]$/, '')
    s = s.split('|')[0].split('#')[0].replace(/\\/g, '/')
    s = s.replace(/^(?:.*\/)?kNNowledge\//i, '')
    return s.replace(/_NN\.md$/i, '').replace(/\.md$/i, '').trim().toLowerCase()
  }

  // The `meta.models[]` entry a knowledge value names (file stem, id or title), or
  // null. Full-path matches win over bare-name matches.
  function resolveKnowledgeModel(meta, value) {
    var models = Array.isArray(meta && meta.models) ? meta.models : []
    var want = knowledgeStem(value)
    if (!want) return null
    var wantTail = want.split('/').pop()
    function keysOf(m) {
      return [m.id, m.title, m.filePath].map(knowledgeStem).filter(Boolean)
    }
    for (var i = 0; i < models.length; i++) {
      if (models[i] && keysOf(models[i]).indexOf(want) !== -1) return models[i]
    }
    for (var j = 0; j < models.length; j++) {
      if (!models[j]) continue
      var tails = keysOf(models[j]).map(function (k) {
        return k.split('/').pop()
      })
      if (tails.indexOf(wantTail) !== -1) return models[j]
    }
    return null
  }

  // Resolves a field's declared type from the schema, for type-aware read
  // rendering (FieldValue). Falls back to '' (plain text).
  var fieldDefOf = Review.fieldDefOf

  function fieldTypeOf(schema, concept, name) {
    var def = fieldDefOf(schema, concept, name)
    return def ? def.type || def.widget || '' : ''
  }

  // Map of element id -> incoming relations (every other element that points at
  // it). RelList links to the target, so an incoming entry targets the *source*
  // element of the relation.
  function incomingRelationsMap(elements) {
    var map = {}
    ;(Array.isArray(elements) ? elements : []).forEach(function (other) {
      if (!other || !Array.isArray(other.relations)) return
      other.relations.forEach(function (r) {
        if (!r || !r.target) return
        if (!map[r.target]) map[r.target] = []
        map[r.target].push({ field: r.field, target: other.id, targetLabel: other.name || other.id })
      })
    })
    return map
  }

  // Cards project live drafts: active draft edits and notes are visually badged,
  // new draft elements are projected, and deleted elements are styled.
  function mountElementCards(doc, elements, drafts, refs, concepts, schema, incomingById, focusId, actions, modelId) {
    var content = doc.getElementById('innfo-content')
    if (!content) return
    content.innerHTML = ''

    var projectedElements = projectElements(elements, drafts)

    var visuals = typeof self !== 'undefined' && self.InnfoVisuals ? self.InnfoVisuals : null
    if (refs && isObject(refs)) {
      Object.keys(refs).forEach(function (rk) {
        var rEl = refs[rk]
        if (rEl && isObject(rEl) && rEl.concept) {
          var rMeta = conceptMetaOf(concepts, rEl.concept)
          rEl._conceptHexColor = rMeta.hexColor
          rEl._conceptSlot = rMeta.slot
          rEl._conceptColor = rMeta.color
          rEl._conceptIndex = rMeta.index
        }
      })
    }

    projectedElements.forEach(function (element) {
      var fields = []
      var elCitations = element && isObject(element.citations) ? element.citations : {}
      var sourcesEntries = []
      Object.keys(elCitations).forEach(function (k) {
        if ((k === 'sources' || k === 'source') && Array.isArray(elCitations[k])) {
          sourcesEntries = sourcesEntries.concat(elCitations[k])
        }
      })
      if (isObject(element.fields)) {
        Object.keys(element.fields).forEach(function (k) {
          var val = element.fields[k]
          var cleanKey = typeof val === 'string' ? val.replace(/^\[\[|\]\]$/g, '').trim() : String(val)
          var target =
            refs && isObject(refs[String(val)])
              ? refs[String(val)]
              : refs && isObject(refs[cleanKey])
                ? refs[cleanKey]
                : null
          if (!target && Array.isArray(element.relations)) {
            var relMatch = element.relations.find(function (r) {
              return r && r.field === k && r.target
            })
            if (relMatch) {
              target =
                refs && isObject(refs[relMatch.target])
                  ? refs[relMatch.target]
                  : { id: relMatch.target, name: relMatch.targetLabel || cleanKey || relMatch.target }
            }
          }
          var fieldCites = Array.isArray(elCitations[k]) && elCitations[k].length ? elCitations[k] : undefined
          var targetCMeta = target && target.concept ? conceptMetaOf(concepts, target.concept) : null
          fields.push({
            name: k,
            value: val,
            type: fieldTypeOf(schema, element.concept, k),
            ref: target
              ? {
                  id: target.id || String(val),
                  label: target.name || cleanKey || String(val),
                  concept: target.concept,
                  color: targetCMeta && targetCMeta.color,
                  hexColor: targetCMeta && targetCMeta.hexColor,
                  slot: targetCMeta && targetCMeta.slot,
                  index: targetCMeta && targetCMeta.index,
                }
              : undefined,
            citations: fieldCites,
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
          history: Array.isArray(element.history) && element.history.length ? element.history : undefined,
          qud: { id: element.id, concept: element.concept, hash: element.hash, path: element.canonicalUnit || element.modelFile || element.modelTitle || null },
          path: element.location || element.modelFile || element.modelTitle || null,
          tags: getElementEffectiveTags(element),
          relations:
            Array.isArray(element.relations) && element.relations.length ? element.relations : null,
          incomingRelations:
            incomingById && incomingById[element.id] && incomingById[element.id].length
              ? incomingById[element.id]
              : null,
        },
        {
          domId: 'el-' + String(element.id || ''),
          modelId: modelId || element.modelId || '',
          collapsible: true,
          open: focusId != null && String(element.id || '') === String(focusId),
          head:
            UI && typeof UI.CitationIcons === 'function'
              ? UI.CitationIcons('sources', sourcesEntries, {
                  onOpen: function () {
                    renderCitationDialog(doc, 'sources', sourcesEntries)
                  },
                })
              : undefined,
          byId: refs,
          concept: conceptMetaOf(concepts, element.concept),
          onTag: actions && actions.onTag,
          onKnowledge: actions && actions.onKnowledge,
          isKnowledgeBound: actions && actions.isKnowledgeBound,
          onRef: function (refId) {
            var target = refs && isObject(refs[String(refId)]) ? refs[String(refId)] : null
            if (target) renderRefDialog(doc, target)
          },
          onCite: function (citeData) {
            var fName = citeData && citeData.field
            var list = fName && Array.isArray(elCitations[fName]) ? elCitations[fName] : []
            renderCitationDialog(doc, fName || element.name || element.id, list)
          },
        },
      )

      // Discrete concept color left border, perimeter tint & badge affordance
      var cMeta = conceptMetaOf(concepts, element.concept)
      var hexColor = cMeta.hexColor
      card.style.setProperty('--card-concept-color', hexColor)
      card.style.borderColor = 'color-mix(in srgb, ' + hexColor + ' 35%, var(--innfo-border, #e5e5e5))'
      card.style.borderLeft = '4px solid ' + hexColor

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

      // Wire the image thumbnail to the media lightbox when the element has
      // image fields (parity with the editor's NodeMedia gallery).
      var mediaItems = collectMediaItems(element)
      var thumbEl = card.querySelector('.innfo-card-thumb')
      if (thumbEl && thumbEl.classList && thumbEl.classList.contains('innfo-card-thumb--concept')) {
        thumbEl.style.color = hexColor
        thumbEl.style.borderColor = 'color-mix(in srgb, ' + hexColor + ' 38%, var(--innfo-border, #e5e5e5))'
        thumbEl.style.backgroundColor = 'color-mix(in srgb, ' + hexColor + ' 12%, #ffffff)'
      }
      if (mediaItems.length && thumbEl && thumbEl.tagName === 'IMG') {
        thumbEl.classList.add('innfo-card-thumb--zoom')
        thumbEl.setAttribute('role', 'button')
        thumbEl.setAttribute('tabindex', '0')
        thumbEl.setAttribute('title', 'View media preview')
        thumbEl.setAttribute('aria-label', 'View media preview')
        thumbEl.addEventListener('click', function (ev) {
          if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
          renderMediaDialog(doc, mediaItems, 0)
        })
        thumbEl.addEventListener('keydown', function (ev) {
          if (ev && (ev.key === 'Enter' || ev.key === ' ')) {
            if (ev.preventDefault) ev.preventDefault()
            renderMediaDialog(doc, mediaItems, 0)
          }
        })
      }
      if (mediaItems.length) {
        var fieldImgs = card.querySelectorAll('.innfo-field-image')
        for (var fii = 0; fii < fieldImgs.length; fii++) {
          ;(function (fImg) {
            fImg.addEventListener('click', function (ev) {
              if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
              renderMediaDialog(doc, mediaItems, 0)
            })
          })(fieldImgs[fii])
        }
      }

      content.appendChild(card)
    })
  }

  function mountElementBadges(doc, elements, drafts, concepts, refs, modelId) {
    var content = doc.getElementById('innfo-content')
    if (!content) return
    content.innerHTML = ''
    var wrap = el('div', 'innfo-element-badges-wrap')
    wrap.setAttribute('data-innfo-component', 'element-badges-view')
    var projectedElements = projectElements(elements, drafts)
    projectedElements.forEach(function (element) {
      var cMeta = conceptMetaOf(concepts, element.concept)
      var pill = UI.Ku(
        'element',
        {
          model: modelId || element.modelId || '',
          id: element.id,
          label: element.name || element.id || '',
          concept: element.concept,
          color: cMeta && cMeta.color,
          index: cMeta && cMeta.index,
        },
        { doc: doc },
      )
      var pillBadge = pill.querySelector('[data-innfo-component="ku-unit"]')
      if (pillBadge) {
        pillBadge.setAttribute('role', 'button')
        pillBadge.setAttribute('tabindex', '0')
        pillBadge.addEventListener('click', function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault()
          renderRefDialog(doc, element)
        })
      }
      wrap.appendChild(pill)
    })
    content.appendChild(wrap)
  }

  function mountElementMiniCards(doc, elements, drafts, concepts, refs, incomingById, actions, modelId) {
    var content = doc.getElementById('innfo-content')
    if (!content) return
    content.innerHTML = ''
    var grid = el('div', 'innfo-element-minicards-grid')
    grid.setAttribute('data-innfo-component', 'element-minicards-view')
    var projectedElements = projectElements(elements, drafts)
    projectedElements.forEach(function (element) {
      var cMeta = conceptMetaOf(concepts, element.concept)
      var mini = UI.ElementMini(
        {
          id: element.id,
          name: element.name || element.id || '',
          conceptId: element.concept,
          description: element.description,
          fields: element.fields,
        },
        {
          doc: doc,
          modelId: modelId || element.modelId || '',
          concept: cMeta,
          onClick: function () {
            renderRefDialog(doc, element)
          },
        }
      )
      grid.appendChild(mini)
    })
    content.appendChild(grid)
  }

  // ---- Explorer element table (table view + header sort) -------------------

  // Union of field keys across the projected elements, alphabetical.
  function elementFieldColumns(projected) {
    var seen = {}
    ;(Array.isArray(projected) ? projected : []).forEach(function (e) {
      if (e && isObject(e.fields)) {
        Object.keys(e.fields).forEach(function (k) {
          seen[k] = true
        })
      }
    })
    return Object.keys(seen).sort(function (a, b) {
      return a.localeCompare(b)
    })
  }

  // Numeric-aware compare: pure-numeric strings sort as numbers, else locale.
  function compareElementValues(a, b) {
    var sa = a == null ? '' : String(a)
    var sb = b == null ? '' : String(b)
    if (/^\s*-?\d+(\.\d+)?\s*$/.test(sa) && /^\s*-?\d+(\.\d+)?\s*$/.test(sb)) {
      return parseFloat(sa) - parseFloat(sb)
    }
    return sa.localeCompare(sb)
  }

  function tableValueOf(element, key) {
    if (key === 'name') return element.name
    if (key === 'concept') return element.concept
    if (key === 'tags') return getElementEffectiveTags(element).join(', ')
    return element.fields ? element.fields[key] : ''
  }

  function sortTableElements(projected, sortState) {
    if (!sortState || !sortState.key) return projected
    var key = sortState.key
    var dir = sortState.dir === 'desc' ? -1 : 1
    return projected.slice().sort(function (a, b) {
      var c = compareElementValues(tableValueOf(a, key), tableValueOf(b, key))
      if (c === 0) c = compareElementValues(a.name, b.name)
      return c * dir
    })
  }

  function displayCellText(value) {
    if (value == null) return ''
    if (Array.isArray(value)) return value.join(', ')
    if (isObject(value)) {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  function draftBadgeClass(kind) {
    return kind === 'correction'
      ? 'badge-warning'
      : kind === 'new'
        ? 'badge-info'
        : kind === 'delete'
          ? 'badge-error'
          : 'badge-neutral'
  }

  function draftBadgeText(kind) {
    return kind === 'correction'
      ? 'Draft Edit'
      : kind === 'new'
        ? 'New Draft'
        : kind === 'delete'
          ? 'Delete Proposed'
          : 'Comment'
  }

  // Read-only table of the filtered elements: one row per element, one column
  // per field key, sortable by clicking a header. Mirrors the editor's
  // ConceptTableView (table view + header sort) inside the domain console.
  function mountElementTable(doc, elements, drafts, concepts, sortState, schema, onSort, modelId) {
    var content = doc.getElementById('innfo-content')
    if (!content) return
    content.innerHTML = ''
    var projected = projectElements(elements, drafts)
    var table = el('table', 'innfo-element-table')
    if (!table) return

    var visuals = typeof self !== 'undefined' && self.InnfoVisuals ? self.InnfoVisuals : null
    var conceptList = Array.isArray(concepts) ? concepts : []
    function conceptColor(name) {
      return conceptMetaOf(conceptList, name).hexColor
    }

    var fieldCols = elementFieldColumns(projected)
    var columns = [{ key: 'name', label: 'Name' }, { key: 'concept', label: 'Concept' }]
    fieldCols.forEach(function (k) {
      columns.push({ key: k, label: k })
    })
    columns.push({ key: 'tags', label: 'Tags' })

    var schemaFields = schema && Array.isArray(schema.fields) ? schema.fields : []
    function fieldDefOf(name) {
      for (var i = 0; i < schemaFields.length; i++) {
        if (schemaFields[i] && schemaFields[i].name === name && !schemaFields[i].inheritedFrom) {
          return schemaFields[i]
        }
      }
      return null
    }

    var thead = el('thead')
    var headTr = el('tr')
    columns.forEach(function (col) {
      var th = el('th', 'innfo-element-table-th')
      th.setAttribute('data-sort-key', col.key)
      th.setAttribute('scope', 'col')
      th.setAttribute('role', 'button')
      th.setAttribute('tabindex', '0')
      var fieldDef = fieldDefOf(col.key)
      // Every header is a knowledge unit too: a `field` badge, like the cells below.
      // The plain label stays only as the no-kit / unblessable fallback.
      var headerBadge = null
      if (UI && typeof UI.Ku === 'function') {
        try {
          var declaredBy = fieldDef && fieldDef.declaredBy ? fieldDef.declaredBy : {}
          headerBadge = UI.Ku(
            'field',
            {
              family: declaredBy.family || modelId || 'model',
              concept: (fieldDef && fieldDef.concept) || col.key,
              name: col.key,
              label: col.label,
              vtype: fieldDef && fieldDef.type,
            },
            { doc: doc },
          )
        } catch (e) {
          headerBadge = null
        }
      }
      if (headerBadge) {
        headerBadge.classList.add('innfo-element-table-th-label')
        th.appendChild(headerBadge)
      } else {
        th.appendChild(el('span', 'innfo-element-table-th-label', col.label))
      }
      if (sortState && sortState.key === col.key) {
        th.classList.add('sorted')
        th.setAttribute('aria-sort', sortState.dir === 'desc' ? 'descending' : 'ascending')
        th.appendChild(el('span', 'innfo-element-table-sort', sortState.dir === 'desc' ? '▼' : '▲'))
      }
      function trigger() {
        if (typeof onSort === 'function') onSort(col.key)
      }
      th.addEventListener('click', trigger)
      th.addEventListener('keydown', function (e) {
        if (e && (e.key === 'Enter' || e.key === ' ')) {
          if (e.preventDefault) e.preventDefault()
          trigger()
        }
      })
      headTr.appendChild(th)
    })
    thead.appendChild(headTr)
    table.appendChild(thead)

    var tbody = el('tbody')
    var sorted = sortTableElements(projected, sortState)
    if (!sorted.length) {
      var emptyTr = el('tr')
      var emptyTd = el('td', 'innfo-element-table-empty', 'No elements match the current filter.')
      emptyTd.setAttribute('colspan', String(columns.length))
      emptyTr.appendChild(emptyTd)
      tbody.appendChild(emptyTr)
    }
    sorted.forEach(function (element) {
      var tr = el('tr')
      tr.setAttribute('data-element-id', String(element.id || ''))
      if (element._draft) tr.classList.add('innfo-element-table-draft')

      var rowCMeta = conceptMetaOf(conceptList, element.concept)
      var rowModel = modelId || element.modelId || ''
      var nameTd = el('td', 'innfo-element-table-name')
      var elBadge =
        UI && typeof UI.Ku === 'function'
          ? UI.Ku(
              'element',
              {
                model: rowModel,
                id: element.id,
                label: element.name || element.id || '',
                index: rowCMeta.index,
                color: rowCMeta.color,
              },
              { doc: doc },
            )
          : el('span', null, element.name || element.id || '')
      nameTd.appendChild(elBadge)
      if (element._draft) {
        nameTd.appendChild(
          el(
            'span',
            'badge badge-sm ' + draftBadgeClass(element._draft.kind) + ' ml-2',
            draftBadgeText(element._draft.kind),
          ),
        )
      }
      tr.appendChild(nameTd)

      var conceptTd = el('td')
      var cBadge =
        UI && typeof UI.Ku === 'function'
          ? UI.Ku(
              'section',
              {
                model: rowModel,
                concept: element.concept || '',
                label: element.concept || '',
                index: rowCMeta.index,
                color: rowCMeta.color,
              },
              { doc: doc },
            )
          : el('span', null, element.concept || '')
      conceptTd.appendChild(cBadge)
      tr.appendChild(conceptTd)

      fieldCols.forEach(function (k) {
        var rawVal = element.fields && element.fields[k] !== undefined ? element.fields[k] : ''
        if ((rawVal === '' || rawVal == null) && Array.isArray(element.relations)) {
          var relMatches = element.relations
            .filter(function (r) { return r && r.field === k })
            .map(function (r) { return r.targetLabel || r.target || '' })
            .filter(Boolean)
          if (relMatches.length) rawVal = relMatches.join(', ')
        }
        var val = displayCellText(rawVal)
        var td = el('td', 'innfo-element-table-cell')
        if (val && UI && typeof UI.Ku === 'function') {
          td.appendChild(
            UI.Ku(
              'value',
              {
                model: rowModel,
                element: element.id,
                field: k,
                label: val,
                vtype: fieldTypeOf(schema, element.concept, k),
              },
              { doc: doc },
            ),
          )
        } else if (val) {
          td.appendChild(doc.createTextNode(val))
        }
        if (val) td.setAttribute('title', val)
        td.addEventListener('dblclick', function () {
          renderFieldDetailDialog(doc, {
            name: k,
            value: rawVal,
            type: fieldTypeOf(schema, element.concept, k),
            elementName: element.name || element.id || '',
            element: element.id,
            model: rowModel,
          })
        })
        tr.appendChild(td)
      })

      var tags = getElementEffectiveTags(element).join(', ')
      var tagsTd = el('td', 'innfo-element-table-cell')
      if (tags && UI && typeof UI.Ku === 'function') {
        tagsTd.appendChild(
          UI.Ku(
            'value',
            {
              model: rowModel,
              element: element.id,
              field: 'tags',
              label: tags,
              vtype: 'select',
            },
            { doc: doc },
          ),
        )
      } else if (tags) {
        tagsTd.appendChild(doc.createTextNode(tags))
      }
      if (tags) tagsTd.setAttribute('title', tags)
      tr.appendChild(tagsTd)

      tbody.appendChild(tr)
    })
    table.appendChild(tbody)

    var wrap = el('div', 'innfo-element-table-wrap')
    wrap.appendChild(table)
    content.appendChild(wrap)
  }

  // Cards/Table toggle for the Model Explorer. Created once inside the explorer
  // panel and re-rendered on refresh; the active mode lives in the boot state.
  function renderExplorerToolbar(doc, mode, onChange) {
    var content = doc.getElementById('innfo-content')
    if (!content || !content.parentNode) return
    var host = doc.getElementById('innfo-explorer-toolbar')
    if (!host) {
      host = el('div', 'innfo-explorer-toolbar')
      host.id = 'innfo-explorer-toolbar'
      content.parentNode.insertBefore(host, content)
    }
    host.innerHTML = ''
    var group = el('div', 'innfo-viewmode')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', 'Element view mode')
    ;[['sheets', 'Sheets'], ['cards', 'Cards'], ['badges', 'Badges'], ['table', 'Table']].forEach(function (pair) {
      var b = el('button', 'innfo-viewmode-btn', pair[1])
      b.setAttribute('type', 'button')
      b.setAttribute('data-mode', pair[0])
      b.setAttribute('aria-pressed', pair[0] === mode ? 'true' : 'false')
      if (pair[0] === mode) b.classList.add('active')
      b.addEventListener('click', function () {
        if (pair[0] !== mode && typeof onChange === 'function') onChange(pair[0])
      })
      group.appendChild(b)
    })
    host.appendChild(group)
  }

  function renderMatrices(doc, matrices, concepts, fallbackModelId) {
    var host = doc.getElementById('innfo-matrices')
    if (!host) return
    host.innerHTML = ''
    var conceptList = Array.isArray(concepts) ? concepts : []
    function conceptMeta(name) {
      for (var i = 0; i < conceptList.length; i++) {
        var c = conceptList[i]
        if ((typeof c === 'string' ? c : c.name) === name) return { meta: c, index: i }
      }
      return { meta: null, index: 0 }
    }
    function headerBadge(entry, key, modelId) {
      var e = entry || {}
      var cMetaFull = conceptMetaOf(conceptList, e.concept)
      return UI.Ku(
        'element',
        {
          model: modelId,
          id: e.slug || UI.slug(e.label || key || 'unit'),
          label: e.label || key,
          index: cMetaFull.index,
          color: cMetaFull.color,
        },
        { doc: doc },
      )
    }
    ;(Array.isArray(matrices) ? matrices : []).forEach(function (matrix) {
      if (!isObject(matrix)) return
      var section = el('section', 'innfo-matrix')
      if (!section) return
      var matrixModel = matrix.modelId || fallbackModelId || ''
      var matrixSlug = matrix.slug || UI.slug(matrix.name || 'matrix')
      var titleEl = el('h3', null, null)
      if (titleEl) {
        titleEl.appendChild(
          UI.Ku(
            'matrix',
            {
              model: matrixModel,
              family: matrixModel,
              name: matrixSlug,
              label: matrix.name || 'Matrix',
            },
            { doc: doc },
          ),
        )
        section.appendChild(titleEl)
      }
      var table = el('table', null, null)
      if (!table) return
      var rows = Array.isArray(matrix.rows) ? matrix.rows : []
      var cols = Array.isArray(matrix.cols) ? matrix.cols : []
      var cells = isObject(matrix.cells) ? matrix.cells : {}
      var head = isObject(matrix.head) ? matrix.head : {}
      var headCols = isObject(head.cols) ? head.cols : {}
      var headRows = isObject(head.rows) ? head.rows : {}

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

      var headTr = el('tr', null, null)
      if (headTr) {
        var cornerTh = el('th', 'innfo-matrix-corner', null)
        var srcConcept = matrix.source || (rows.length && headRows[isStructured ? (rows[0].sourceId || rows[0].sourceLabel) : rows[0]] && headRows[isStructured ? (rows[0].sourceId || rows[0].sourceLabel) : rows[0]].concept) || null
        var tgtConcept = matrix.target || (cols.length && headCols[cols[0]] && headCols[cols[0]].concept) || null
        if (cornerTh && srcConcept && tgtConcept) {
          var sMetaM = conceptMetaOf(conceptList, srcConcept)
          var tMetaM = conceptMetaOf(conceptList, tgtConcept)
          var cornerWrap = el('div', 'innfo-matrix-corner-pills')
          cornerWrap.appendChild(
            UI.Ku(
              'section',
              {
                model: matrixModel,
                concept: srcConcept,
                label: srcConcept + ' ↓',
                index: sMetaM.index,
                color: sMetaM.color,
              },
              { doc: doc },
            ),
          )
          cornerWrap.appendChild(el('span', 'innfo-matrix-corner-sep', '×'))
          cornerWrap.appendChild(
            UI.Ku(
              'section',
              {
                model: matrixModel,
                concept: tgtConcept,
                label: tgtConcept + ' →',
                index: tMetaM.index,
                color: tMetaM.color,
              },
              { doc: doc },
            ),
          )
          cornerTh.appendChild(cornerWrap)
        }
        headTr.appendChild(cornerTh)
        cols.forEach(function (c) {
          var th = el('th', null, null)
          if (th) th.appendChild(headerBadge(headCols[c], String(c), matrixModel))
          headTr.appendChild(th)
        })
        table.appendChild(headTr)
      }
      rows.forEach(function (r) {
        var tr = el('tr', null, null)
        if (!tr) return
        var rowKey = isStructured ? (r.sourceId || r.sourceLabel || '') : String(r)
        var rowLabel = isStructured ? (r.sourceLabel || r.sourceId || '') : String(r)
        var rowCells = isStructured ? (r.cells || {}) : (cells[r] || cells[String(r)] || {})
        var rowTh = el('th', null, null)
        if (rowTh) rowTh.appendChild(headerBadge(headRows[rowKey] || headRows[rowLabel], rowLabel, matrixModel))
        tr.appendChild(rowTh)
        cols.forEach(function (c) {
          var value = rowCells[c] != null ? String(rowCells[c]) : ''
          var isEmpty = value === '' || value === '-'
          var td = el('td', isEmpty ? 'innfo-matrix-cell-empty' : 'innfo-matrix-cell-filled', null)
          if (td) {
            td.setAttribute('data-matrix', String(matrix.name || 'matrix'))
            td.setAttribute('data-row', String(rowLabel))
            td.setAttribute('data-col', String(c))
            if (matrix.target) td.setAttribute('data-matrix-target', String(matrix.target))
            // The owning model address: a matrix-cell draft must target the model
            // that owns the matrix, never the domain id (apply_change resolves the
            // model by file stem / title, and `meta.modelId` is the domain).
            if (matrix.modelId) td.setAttribute('data-matrix-model', String(matrix.modelId))
            td.setAttribute('data-cell-raw', isEmpty ? '' : value)
            var rowEntry = headRows[rowKey] || headRows[rowLabel] || {}
            var colEntry = headCols[c] || {}
            var cellBadge = UI.Ku(
              'value',
              {
                model: matrixModel,
                matrix: matrixSlug,
                row: rowEntry.slug || UI.slug(rowLabel || 'row'),
                col: colEntry.slug || UI.slug(String(c) || 'col'),
                label: isEmpty ? '—' : value,
                vtype: matrix.widget,
              },
              { doc: doc },
            )
            var cellUnit = cellBadge.querySelector('[data-innfo-component="ku-unit"]')
            if (!isEmpty && cellUnit) cellUnit.setAttribute('data-cell-value', value.toLowerCase())
            td.appendChild(cellBadge)
          }
          tr.appendChild(td)
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
    // NFD + combining-mark strip so 'Facturación' and 'facturacion' share one key.
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  }

  var warnedUnresolvedOperands = {}
  function warnUnresolvedOperand(token, formula) {
    var key = formula + '::' + token
    if (warnedUnresolvedOperands[key]) return
    warnedUnresolvedOperands[key] = true
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[innfo] Timeline formula "' + formula + '": unresolved operand "' + token + '"')
    }
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
        var operandVal = evaluateFormulaTree(targetRow, m, rowMap, overrides, memo, growthState, historyCount)
        // A '%' variable is a rate: as an operand it is the fraction (35% -> 0.35),
        // consistent with growValue, which divides the growth factor by 100.
        // Scope: only plain variable rows (no formula) with unit '%' are scaled.
        // Formula rows already return a computed value (their operands were scaled
        // on the way in), so dividing again would double-scale the result.
        if (!targetRow.formula && String(targetRow.metricUnit || '').trim() === '%') operandVal = operandVal / 100
        return operandVal
      }
      // Unresolved: surface as NaN (rendered '-') instead of a silent 0.
      warnUnresolvedOperand(token, formula)
      return NaN
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
      var term = terms[j + 1] == null ? 0 : terms[j + 1]
      if (ops[j] === '+') res += term
      else if (ops[j] === '-') res -= term
    }
    return res
  }

  function exportTimelineCsv(meta, rows, totalMonths, labels, rowValues) {
    var lines = []
    lines.push('# Timeline & P&L Projection Export')
    lines.push('# Model: ' + (meta.model || ''))
    lines.push('# Version: ' + domainModelVersion(meta))
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
        // Unresolved operands yield NaN: write an empty cell, never a literal "NaN".
        rowLine.push(vals[i] != null && Number.isFinite(vals[i]) ? Math.round(vals[i] * 100) / 100 : '')
      }
      rowLine.push(Number.isFinite(sum) ? Math.round(sum * 100) / 100 : '')
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
          bannerText.innerHTML = UI.icon('target', 14) + ' <span>Showing dependency tree for: <strong>' + escapeHtml(focusedRow.label || focusedRow.id) + '</strong> (' + Object.keys(activeDepSet).length + ' items)</span>'
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
        tdMetric.appendChild(actionsSpan)

        var markerSvg = r.variable ? UI.icon('star', 11) : r.source === 'derived' ? UI.icon('derived', 11) : UI.icon('calc', 11)
        var markerSpan = el('span', 'innfo-row-marker marker-' + (r.variable ? 'var' : r.source === 'derived' ? 'der' : 'calc'))
        markerSpan.innerHTML = markerSvg
        var nameSpan =
          UI && typeof UI.Ku === 'function'
            ? UI.Ku(
                'element',
                {
                  model: r.modelId || '',
                  id: r.id || r.label,
                  label: r.label || r.id,
                },
                { doc: container.ownerDocument || document },
              )
            : el('span', 'innfo-row-name', r.label || r.id)
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
          chartLabel.innerHTML = UI.icon('chart', 12) + ' <span>Monthly: ' + escapeHtml(r.label || r.id) + '</span>'
          tdChartSticky.appendChild(chartLabel)
          trChart.appendChild(tdChartSticky)

          // Unresolved operands yield NaN months: scale and range use finite values only.
          var finiteVals = vals.filter(function (v) { return Number.isFinite(v) })
          var maxAbs = Math.max.apply(null, finiteVals.map(function (v) { return Math.abs(v) })) || 1
          var minReal = finiteVals.length ? Math.min.apply(null, finiteVals) : NaN
          var maxReal = finiteVals.length ? Math.max.apply(null, finiteVals) : NaN

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

            var cResolved = Number.isFinite(cVal)
            var heightPct = cResolved ? Math.max(4, Math.round((Math.abs(cVal) / maxAbs) * 100)) : 4
            var bar = el('div', 'innfo-mini-bar' + (cResolved && cVal < 0 ? ' negative' : ''))
            bar.style.height = heightPct + '%'
            bar.style.backgroundColor = cResolved ? getSemanticBarColor(cVal, minReal, maxReal, r) : '#cbd5e1'

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
          var trendLabel = Number.isFinite(deltaPct) ? (deltaPct >= 0 ? '+' : '') + deltaPct + '% trend' : '- trend'
          tdChartTotal.appendChild(el('div', 'innfo-mini-total', trendLabel))
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
  function builtinViews(doc, config, model, meta, shell, schema) {
    var views = []
    // A standalone --view artifact mounts that view alone.
    if (consoleScopeOf(meta)) return views
    if (schema && Array.isArray(schema.concepts) && schema.concepts.length) {
      views.push({ id: 'metamodel', title: 'domaiNN', icon: 'metamodel', order: 90, tone: 'core', panelId: 'innfo-tab-metamodel' })
    }
    if ((Array.isArray(model && model.elements) && model.elements.length > 0) || shell.explorer) {
      views.push({ id: 'explorer', title: 'kNNowledge', icon: 'explorer', order: 100, tone: 'core', panelId: 'innfo-tab-explorer' })
    }
    if (Array.isArray(model && model.matrices) && model.matrices.length > 0) {
      views.push({ id: 'matrices', title: 'Matrices', icon: 'matrices', order: 110, tone: 'core', panelId: 'innfo-tab-matrices' })
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

  var TAB_ICONS = { chart: 'bar-chart-2', matrices: 'table', explorer: 'boxes', review: 'edit', metamodel: 'boxes' }

  // Builds the tabs once from built-ins plus registered views. Panels are
  // created here; a registered view's mount runs on first activation only.
  function mountTabs(doc, opts) {
    var registry = opts.registry || defaultViewRegistry
    var shell = ensureTabShell(doc, opts.model)
    if (!shell) return null
    var nav = shell.nav
    var tabs = builtinViews(doc, opts.config, opts.model, opts.meta, shell, opts.schema)
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
        tabs.push(Object.assign({}, v, { panelId: 'innfo-tab-' + v.id, external: true, tone: /bluepriNN?ts[\\/]/.test(String(v.source || '')) ? 'blueprint' : 'custom' }))
      }
    })
    tabs.sort(function (a, b) {
      return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })
    tabs.push({ id: 'review', title: 'Changes', icon: 'review', panelId: 'innfo-tab-review' })

    tabs.forEach(function (t) {
      if (t.id === 'explorer' || t.id === 'review') return
      if (doc.getElementById(t.panelId) || !shell.main) return
      var panel = el('div', 'innfo-tab-panel')
      panel.id = t.panelId
      if (t.external) panel.setAttribute('data-innfo-view', t.id)
      shell.main.insertBefore(panel, shell.review)
    })

    nav.innerHTML = ''
    nav.style.display = 'flex'
    nav.className = 'innfo-view-tabs tabs tabs-boxed bg-base-200 p-1 rounded-lg gap-1 mb-4 inline-flex'
    tabs.forEach(function (t) {
      if (t.id === 'review' || t.id === 'changes') return
      var btn = el('button', 'innfo-view-tab tab flex items-center gap-2')
      btn.setAttribute('type', 'button')
      btn.dataset.tab = t.id
      btn.classList.add('tone-' + (t.tone || 'custom'))
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
        var filterListeners = []
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
        if (editable) {
          Object.assign(ctx, editableParts(t))
          ctx.filter = {
            getQuery: function () {
              return typeof opts.getQuery === 'function' ? opts.getQuery() : ''
            },
            getElements: function () {
              return typeof opts.getFilteredElements === 'function'
                ? opts.getFilteredElements()
                : (opts.model && opts.model.elements ? opts.model.elements : [])
            },
            onChange: function (fn) {
              if (typeof fn === 'function') {
                filterListeners.push(fn)
                return function () {
                  var idx = filterListeners.indexOf(fn)
                  if (idx >= 0) filterListeners.splice(idx, 1)
                }
              }
              return function () {}
            },
          }
        } else {
          ctx.mountHtml = function (html) {
            return mountHtml(panel, html)
          }
        }
        mounted[t.id] = { api: t.mount(ctx) || {}, filterListeners: filterListeners }
      } catch (err) {
        var msg = String(err && err.message ? err.message : err)
        mounted[t.id] = { api: {}, failed: true }
        panel.appendChild(el('div', 'innfo-view-error alert alert-error text-sm', 'View "' + t.id + '" failed to mount: ' + msg))
        report(t.id, [t.source], 'view "' + t.id + '": mount failed: ' + msg)
        showErrors()
      }
      stripIframes(t, scope)
    }

    function hook(id, name, args) {
      var m = mounted[id]
      if (m && !m.failed && typeof m.api[name] === 'function') {
        try {
          m.api[name].apply(m.api, args || [])
        } catch (err) {
          report(id, [], 'view "' + id + '": ' + name + ' failed: ' + String(err && err.message ? err.message : err))
          showErrors()
        }
      }
    }

    function notifyFilter(filteredElements, query) {
      tabs.forEach(function (t) {
        var m = mounted[t.id]
        if (m && !m.failed) {
          if (m.filterListeners && m.filterListeners.length) {
            m.filterListeners.slice().forEach(function (fn) {
              try {
                fn(filteredElements, query)
              } catch (err) {
                report(t.id, [t.source], 'view "' + t.id + '": filter listener failed: ' + String(err && err.message ? err.message : err))
                showErrors()
              }
            })
          }
          if (m.api && typeof m.api.onFilter === 'function') {
            try {
              m.api.onFilter(filteredElements, query)
            } catch (err) {
              report(t.id, [t.source], 'view "' + t.id + '": onFilter failed: ' + String(err && err.message ? err.message : err))
              showErrors()
            }
          }
        }
      })
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
        if (btn) {
          btn.classList.toggle('active', t.id === tabId)
          btn.classList.toggle('tab-active', t.id === tabId)
        }
        if (panel) panel.classList.toggle('active', t.id === tabId)
      })
      var dockChangesBtn = doc.querySelector('[data-innfo="dock-changes"]')
      if (dockChangesBtn) dockChangesBtn.classList.toggle('active', tabId === 'review')
      if (!scopedView && doc.querySelector) {
        var railAside = doc.querySelector('aside.innfo-rail')
        if (railAside) {
          railAside.style.display = tabId === 'explorer' ? '' : 'none'
        }
      }
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

    // First tab shown on a fresh load: the model explorer is the domain
    // console's primary content, so it wins over the registry order (a
    // blueprint's `procedure` view otherwise lands first and becomes the
    // default). A `config.defaultView` from #innfo-config overrides it.
    function defaultTabId() {
      var has = function (id) {
        return tabs.some(function (t) {
          return t.id === id
        })
      }
      if (scopedView && has(scopedView)) return scopedView
      var preferred = opts.config && opts.config.defaultView
      if (preferred && has(preferred)) return preferred
      if (has('explorer')) return 'explorer'
      return tabs[0].id
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
      notifyFilter: notifyFilter,
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
        if (!current) select(tabFromHash() || defaultTabId(), true)
      },
    }
  }

  function updateTabBadges(doc, state) {
    var btn = doc.querySelector('.innfo-view-tab[data-tab="review"]')
    var dockBtn = doc.querySelector('[data-innfo="dock-changes"]')
    var n = state && state.store ? state.store.drafts().length : 0
    if (btn) {
      var old = btn.querySelector('.innfo-rail-badge')
      if (old && old.parentNode) old.parentNode.removeChild(old)
      if (n > 0) btn.appendChild(el('span', 'innfo-rail-badge badge badge-sm badge-neutral', String(n)))
    }
    if (dockBtn) {
      var oldDockBadge = dockBtn.querySelector('.innfo-dock-badge')
      if (oldDockBadge && oldDockBadge.parentNode) oldDockBadge.parentNode.removeChild(oldDockBadge)
      if (n > 0) dockBtn.appendChild(el('span', 'innfo-dock-badge badge badge-sm badge-neutral ml-1', String(n)))
    }
  }

  function elementsByIdOf(state) {
    var byId = {}
    var concepts = (state && state.schema && state.schema.concepts) || (state && state.concepts) || []
    ;(state && state.elements ? state.elements : []).forEach(function (e) {
      if (e && e.id) {
        if (e.concept && !e._conceptHexColor) {
          var cm = conceptMetaOf(concepts, e.concept)
          e._conceptHexColor = cm.hexColor
          e._conceptSlot = cm.slot
          e._conceptColor = cm.color
          e._conceptIndex = cm.index
        }
        byId[e.id] = e
      }
    })
    return byId
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
      var byIdForStale = elementsByIdOf(state)
      var staleCount = drafts.filter(function (d) {
        return Review.isTargetChanged(d, byIdForStale) && !Review.isAlreadyApplied(d, byIdForStale)
      }).length
      if (staleCount > 0) {
        var staleNote = el(
          'p',
          'innfo-review-stale text-sm mt-1',
          staleCount + (staleCount === 1 ? ' draft targets' : ' drafts target') +
            ' an element that changed since it was written: review before exporting.',
        )
        if (staleNote) {
          staleNote.setAttribute('data-innfo', 'stale-drafts')
          staleNote.style.color = '#b45309'
          titleWrap.appendChild(staleNote)
        }
      }
      head.appendChild(titleWrap)

      var exportedIds = state && Array.isArray(state.exportedDraftIds) ? state.exportedDraftIds : []
      var exportedPending = drafts.filter(function (d) {
        return exportedIds.indexOf(d.id) !== -1
      })
      if (exportedPending.length > 0 && state.store && typeof state.store.clearDrafts === 'function') {
        var clearBtn = el('button', 'innfo-btn innfo-clear-exported btn btn-ghost btn-sm', 'Clear exported drafts (' + exportedPending.length + ')')
        if (clearBtn) {
          clearBtn.setAttribute('type', 'button')
          clearBtn.setAttribute('data-innfo', 'clear-exported')
          clearBtn.addEventListener('click', function () {
            state.store.clearDrafts(exportedPending.map(function (d) { return d.id }))
            state.exportedDraftIds = []
            if (typeof onRefresh === 'function') onRefresh()
          })
          head.appendChild(clearBtn)
        }
      }

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
        var empty = el('div', 'empty-state innfo-review-empty text-sm p-4 rounded-lg flex items-center gap-3')
        if (typeof InnfoIcons !== 'undefined' && typeof InnfoIcons.getSvg === 'function') {
          empty.innerHTML = InnfoIcons.getSvg('info', { size: 18 }) + '<span>No proposed changes yet. Annotate an element in review mode.</span>'
        } else {
          empty.textContent = 'No proposed changes yet. Annotate an element in review mode.'
        }
        listSection.appendChild(empty)
      } else {
        listSection.appendChild(
          UI.DraftList({ drafts: drafts, byId: elementsByIdOf(state) }, {
            doc: doc,
            isTargetChanged: Review.isTargetChanged,
            isAlreadyApplied: Review.isAlreadyApplied,
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
    // 2. Find card by id (cards carry the `el-` prefixed domId, matching `#el-` hrefs)
    var card = doc.getElementById('el-' + String(elementId))
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
    var refModel = element.modelId || ''
    var tag =
      UI && typeof UI.Ku === 'function'
        ? UI.Ku(
            'section',
            { model: refModel, concept: element.concept || 'Element', label: String(element.concept || 'Element') },
            { doc: doc },
          )
        : el('span', 'innfo-ref-tag', String(element.concept || 'Element'))
    if (body && tag) body.appendChild(tag)
    if (body && element.description) {
      var p = el('p', 'innfo-ref-desc', element.description)
      if (p) body.appendChild(p)
    }
    if (body && isObject(element.fields)) {
      var dl = el('dl', 'innfo-ref-fields')
      Object.keys(element.fields).forEach(function (k) {
        if (!dl) return
        var dt = el('dt', null, null)
        if (UI && typeof UI.Ku === 'function') {
          dt.appendChild(
            UI.Ku(
              'field',
              { family: refModel, model: refModel, concept: element.concept, name: k, label: k },
              { doc: doc },
            ),
          )
        } else {
          dt.textContent = k
        }
        var dd = el('dd', null, null)
        if (UI && typeof UI.Ku === 'function') {
          dd.appendChild(
            UI.Ku(
              'value',
              { model: refModel, element: element.id, field: k, label: String(element.fields[k]) },
              { doc: doc },
            ),
          )
        } else {
          dd.textContent = String(element.fields[k])
        }
        dl.appendChild(dt)
        dl.appendChild(dd)
      })
      if (dl.children.length) body.appendChild(dl)
    }
    dialog.appendChild(head)
    dialog.appendChild(body)
    dialog.showModal()
  }

  // ---- Media preview (lightbox) --------------------------------------------
  // The editor has a NodeMedia gallery with a lightbox; the console only showed
  // an inline thumbnail. Collect the image fields of an element and open them in
  // one dialog with prev/next, using the native <dialog> element.

  var IMAGE_REF_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i

  function isImageRefValue(v) {
    if (typeof v !== 'string') return false
    var s = v.trim().toLowerCase()
    if (!s) return false
    if (s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0) return true
    return IMAGE_REF_RE.test(s)
  }

  function collectMediaItems(element) {
    var items = []
    var fields = element && isObject(element.fields) ? element.fields : {}
    Object.keys(fields).forEach(function (name) {
      var val = fields[name]
      var list = Array.isArray(val) ? val : [val]
      list.forEach(function (v) {
        if (isImageRefValue(v)) items.push({ name: name, value: String(v) })
      })
    })
    return items
  }

  function renderMediaDialog(doc, items, start) {
    if (!doc || !Array.isArray(items) || !items.length) return
    var dialog = doc.getElementById('innfo-media-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'innfo-media-dialog'
      dialog.setAttribute('aria-label', 'Media preview')
      if (doc.body) doc.body.appendChild(dialog)
    }
    var index = typeof start === 'number' && start >= 0 && start < items.length ? start : 0

    function render() {
      dialog.innerHTML = ''
      var item = items[index] || { name: '', value: '' }
      var head = el('div', 'innfo-ref-head')
      var h = el('h2', null, item.name || 'Media')
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

      var body = el('div', 'innfo-media-body')
      var img = doc.createElement('img')
      var rawSrc = String(item.value || '')
      var normMatch = rawSrc.replace(/\\/g, '/').match(/^.+?\/((?:sources|kNNowledge|assets|evidence)\/.+)$/)
      img.setAttribute('src', normMatch ? normMatch[1] : rawSrc)
      img.setAttribute('alt', item.name || '')
      img.className = 'innfo-media-image'
      img.addEventListener('error', function () {
        var cur = img.getAttribute('src') || ''
        var relMatch = !img.getAttribute('data-retried') && cur.match(/^.+?(\bsources\/.+)$/)
        if (relMatch) {
          img.setAttribute('data-retried', '1')
          img.setAttribute('src', relMatch[1])
        }
      })
      if (body) body.appendChild(img)

      var bar = el('div', 'innfo-media-bar')
      if (items.length > 1 && bar) {
        var prev = el('button', 'innfo-media-nav', '‹')
        prev.setAttribute('type', 'button')
        prev.setAttribute('aria-label', 'Previous media')
        if (index === 0) prev.setAttribute('disabled', 'disabled')
        prev.addEventListener('click', function () {
          if (index > 0) {
            index -= 1
            render()
          }
        })
        var counter = el('span', 'innfo-media-count', index + 1 + ' / ' + items.length)
        var next = el('button', 'innfo-media-nav', '›')
        next.setAttribute('type', 'button')
        next.setAttribute('aria-label', 'Next media')
        if (index === items.length - 1) next.setAttribute('disabled', 'disabled')
        next.addEventListener('click', function () {
          if (index < items.length - 1) {
            index += 1
            render()
          }
        })
        bar.appendChild(prev)
        bar.appendChild(counter)
        bar.appendChild(next)
      }
      var dl = doc.createElement('a')
      dl.className = 'innfo-media-download'
      dl.setAttribute('href', item.value)
      dl.setAttribute('download', '')
      dl.textContent = 'Open / download'
      if (bar) bar.appendChild(dl)
      if (body) body.appendChild(bar)

      dialog.appendChild(head)
      dialog.appendChild(body)
    }

    if (!dialog.__innfoMediaKeys) {
      dialog.__innfoMediaKeys = true
      dialog.addEventListener('keydown', function (e) {
        if (!e) return
        if (e.key === 'ArrowLeft' && index > 0) {
          index -= 1
          render()
        } else if (e.key === 'ArrowRight' && index < items.length - 1) {
          index += 1
          render()
        }
      })
    }
    render()
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', 'open')
    } catch {
      dialog.setAttribute('open', 'open')
    }
  }

  // Read-only field-detail dialog, opened by double-clicking a table cell
  // (parity with the editor's FieldDetailModal). Renders the full value with the
  // type-aware FieldValue renderer.
  function renderFieldDetailDialog(doc, field) {
    if (!doc || !field) return
    var dialog = doc.getElementById('innfo-field-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'innfo-field-dialog'
      dialog.setAttribute('aria-label', 'Field detail')
      if (doc.body) doc.body.appendChild(dialog)
    }
    dialog.innerHTML = ''
    var head = el('div', 'innfo-ref-head')
    var h = el('h2', null, String(field.name || 'Field'))
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
    var body = el('div', 'innfo-field-detail-body')
    if (field.elementName) body.appendChild(el('p', 'innfo-field-detail-meta', String(field.elementName)))
    var valueNode =
      UI && typeof UI.FieldValue === 'function'
        ? UI.FieldValue({ value: field.value, type: field.type, name: field.name }, { doc: doc })
        : null
    if (UI && typeof UI.Ku === 'function' && field.model && field.element) {
      var detailUnit = UI.Ku(
        'value',
        {
          model: field.model,
          element: field.element,
          field: field.name,
          label: displayCellText(field.value),
          vtype: field.type,
        },
        { doc: doc, valueNode: valueNode || undefined },
      )
      body.appendChild(detailUnit)
    } else if (valueNode) {
      body.appendChild(valueNode)
    } else {
      var textVal = displayCellText(field.value)
      body.appendChild(el('pre', 'innfo-field-detail-value', textVal !== '' ? textVal : '(empty)'))
    }
    dialog.appendChild(head)
    dialog.appendChild(body)
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', 'open')
    } catch {
      dialog.setAttribute('open', 'open')
    }
  }

  // Lightweight metamodel map: concepts as circular nodes, matrices as edges.
  // Hand-built SVG (no Mermaid dependency) so it ships inside the single-file,
  // offline console bundle.
  function metamodelConceptNames(schema, elements) {
    if (schema && Array.isArray(schema.concepts) && schema.concepts.length) {
      return schema.concepts
        .map(function (c) {
          return typeof c === 'string' ? c : c && c.name
        })
        .filter(Boolean)
    }
    var seen = {}
    var out = []
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (e && e.concept && !seen[e.concept]) {
        seen[e.concept] = true
        out.push(e.concept)
      }
    })
    return out
  }

  function renderMetamodelView(doc, schema, matrices, elements) {
    var host = doc.getElementById('innfo-tab-metamodel')
    if (!host) return
    host.innerHTML = ''
    var nodes = metamodelConceptNames(schema, elements)
    if (!nodes.length) {
      host.appendChild(el('p', 'empty-state', 'No concepts to map.'))
      return
    }
    var NS = 'http://www.w3.org/2000/svg'
    var size = 680
    var mid = size / 2
    var r = nodes.length > 1 ? 235 : 0
    var nodeR = 36
    var pos = {}
    nodes.forEach(function (name, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length
      pos[name] = { x: mid + r * Math.cos(a), y: mid + r * Math.sin(a) }
    })
    var svg = doc.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size)
    svg.setAttribute('class', 'innfo-metamodel-svg')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Model metamodel map')

    var defs = doc.createElementNS(NS, 'defs')
    var marker = doc.createElementNS(NS, 'marker')
    marker.setAttribute('id', 'innfo-metamodel-arrow')
    marker.setAttribute('viewBox', '0 0 10 10')
    marker.setAttribute('refX', '9')
    marker.setAttribute('refY', '5')
    marker.setAttribute('markerWidth', '6')
    marker.setAttribute('markerHeight', '6')
    marker.setAttribute('orient', 'auto-start-reverse')
    var arrowPath = doc.createElementNS(NS, 'path')
    arrowPath.setAttribute('d', 'M 0 1 L 10 5 L 0 9 z')
    arrowPath.setAttribute('fill', 'var(--primary, #2563eb)')
    marker.appendChild(arrowPath)
    defs.appendChild(marker)
    svg.appendChild(defs)

    // Edges: matrices (explicit) + element field refs (implicit).
    var edges = []
    var seenEdge = {}
    var pairCounts = {}
    function pushEdge(source, target, name, kind) {
      if (!source || !target || !pos[source] || !pos[target]) return
      var key = source + '>' + target + '>' + (name || '')
      if (seenEdge[key]) return
      seenEdge[key] = true
      var pairKey = source < target ? source + '|' + target : target + '|' + source
      var slot = pairCounts[pairKey] || 0
      pairCounts[pairKey] = slot + 1
      edges.push({ source: source, target: target, name: name, kind: kind || 'matrix', pairKey: pairKey, slot: slot })
    }
    ;(Array.isArray(matrices) ? matrices : []).forEach(function (m) {
      if (m) pushEdge(m.source, m.target, m.name, 'matrix')
    })
    var byConcept = {}
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (e && e.concept) byConcept[e.id] = e.concept
    })
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (!e || !e.concept || !Array.isArray(e.relations)) return
      e.relations.forEach(function (r) {
        if (!r || !r.target) return
        var tc = byConcept[r.target]
        if (tc && tc !== e.concept) pushEdge(e.concept, tc, r.field || '', 'relation')
      })
    })
    var pendingEdgeLabels = []
    edges.forEach(function (m) {
      if (!m || !m.source || !m.target || !pos[m.source] || !pos[m.target]) return
      var sx = pos[m.source].x
      var sy = pos[m.source].y
      var tx = pos[m.target].x
      var ty = pos[m.target].y
      var dx = tx - sx
      var dy = ty - sy
      var dist = Math.sqrt(dx * dx + dy * dy) || 1
      var totalForPair = pairCounts[m.pairKey] || 1
      // Canonical normal vector so parallel edges between the same pair separate cleanly
      var canonDx = m.source < m.target ? dx : -dx
      var canonDy = m.source < m.target ? dy : -dy
      var nx = -canonDy / dist
      var ny = canonDx / dist
      var offsetIndex = m.slot - (totalForPair - 1) / 2
      var perpShift = offsetIndex * 24
      var x1 = (dist > nodeR * 2 ? sx + (dx / dist) * nodeR : sx) + nx * perpShift
      var y1 = (dist > nodeR * 2 ? sy + (dy / dist) * nodeR : sy) + ny * perpShift
      var x2 = (dist > nodeR * 2 ? tx - (dx / dist) * (nodeR + 4) : tx) + nx * perpShift
      var y2 = (dist > nodeR * 2 ? ty - (dy / dist) * (nodeR + 4) : ty) + ny * perpShift
      var line = doc.createElementNS(NS, 'line')
      line.setAttribute('x1', x1)
      line.setAttribute('y1', y1)
      line.setAttribute('x2', x2)
      line.setAttribute('y2', y2)
      line.setAttribute('class', 'innfo-metamodel-edge')
      line.setAttribute('data-edge-kind', m.kind || 'matrix')
      if (m.kind === 'relation') {
        line.setAttribute('stroke-dasharray', '5,4')
      }
      line.setAttribute('marker-end', 'url(#innfo-metamodel-arrow)')
      svg.appendChild(line)
      if (m.name) {
        var rawName = String(m.name)
        var shortName = rawName.length > 20 ? rawName.replace(/\s+Matrix$/i, '') : rawName
        var tFrac = 0.5
        var lx = x1 + (x2 - x1) * tFrac
        var ly = y1 + (y2 - y1) * tFrac
        pendingEdgeLabels.push({ x: lx, y: ly, text: shortName, fullText: rawName, kind: m.kind })
      }
    })

    nodes.forEach(function (name) {
      var c = doc.createElementNS(NS, 'circle')
      c.setAttribute('cx', pos[name].x)
      c.setAttribute('cy', pos[name].y)
      c.setAttribute('r', String(nodeR))
      c.setAttribute('class', 'innfo-metamodel-node')
      var nodeMeta = conceptMetaOf((schema && schema.concepts && schema.concepts.length ? schema.concepts : nodes), name)
      if (nodeMeta && nodeMeta.hexColor) {
        c.style.stroke = nodeMeta.hexColor
        c.style.strokeWidth = '2.5px'
        c.style.fill = 'color-mix(in srgb, ' + nodeMeta.hexColor + ' 10%, #ffffff)'
      }
      c.style.cursor = 'pointer'
      var title = doc.createElementNS(NS, 'title')
      title.textContent = String(name)
      c.appendChild(title)
      c.addEventListener('click', function () {
        var search = doc.getElementById('innfo-search')
        if (search) {
          search.value = formatFacetToken('concept', name)
          if (typeof CustomEvent === 'function') {
            search.dispatchEvent(new CustomEvent('input', { bubbles: true }))
          }
        }
        var expBtn = doc.querySelector('.innfo-view-tab[data-tab="explorer"]')
        if (expBtn && typeof expBtn.click === 'function') expBtn.click()
      })
      svg.appendChild(c)
      var t = doc.createElementNS(NS, 'text')
      t.setAttribute('x', pos[name].x)
      t.setAttribute('y', pos[name].y + 4)
      t.setAttribute('text-anchor', 'middle')
      t.setAttribute('class', 'innfo-metamodel-label')
      t.style.pointerEvents = 'none'
      t.textContent = name.length > 18 ? name.slice(0, 17) + '\u2026' : name
      svg.appendChild(t)
    })

    pendingEdgeLabels.forEach(function (lbl) {
      var padX = 7
      var boxW = Math.max(38, lbl.text.length * 6.8 + padX * 2)
      var boxH = 18
      var bg = doc.createElementNS(NS, 'rect')
      bg.setAttribute('x', lbl.x - boxW / 2)
      bg.setAttribute('y', lbl.y - boxH / 2 - 2)
      bg.setAttribute('width', boxW)
      bg.setAttribute('height', boxH)
      bg.setAttribute('rx', '9')
      bg.setAttribute('class', 'innfo-metamodel-edge-bg')
      svg.appendChild(bg)

      var lt = doc.createElementNS(NS, 'text')
      lt.setAttribute('x', lbl.x)
      lt.setAttribute('y', lbl.y + 2)
      lt.setAttribute('text-anchor', 'middle')
      lt.setAttribute('class', 'innfo-metamodel-edge-label')
      lt.textContent = lbl.text
      if (lbl.fullText && lbl.fullText !== lbl.text) {
        var lTitle = doc.createElementNS(NS, 'title')
        lTitle.textContent = lbl.fullText
        lt.appendChild(lTitle)
      }
      svg.appendChild(lt)
    })

    var wrap = el('div', 'innfo-metamodel')
    wrap.appendChild(svg)
    var legend = el('div', 'innfo-metamodel-legend')
    legend.innerHTML =
      '<span class="innfo-mm-legend-item"><span class="innfo-mm-line innfo-mm-line--matrix"></span> Matrix relationship</span>' +
      '<span class="innfo-mm-legend-item"><span class="innfo-mm-line innfo-mm-line--relation"></span> Element reference (relation)</span>' +
      '<span class="innfo-mm-legend-hint">Click any concept node to filter in Model Explorer</span>'
    wrap.appendChild(legend)
    host.appendChild(wrap)
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
      var tag =
        UI && typeof UI.Ku === 'function'
          ? UI.Ku(
              'source',
              { path: entry.path || entry.href || 'citation', label: tagText },
              { doc: doc },
            )
          : el('span', 'innfo-ref-tag', tagText)
      var card = el('article', 'innfo-cite-card')
      if (card) card.setAttribute('data-origin', variantKey)
      var head = el('div', 'innfo-cite-head')
      if (head && tag) head.appendChild(tag)
      var prov = el('span', 'innfo-cite-prov', labelText)
      if (prov && typeof InnfoIcons !== 'undefined' && InnfoIcons && typeof InnfoIcons.getSvg === 'function') {
        prov.insertAdjacentHTML('afterbegin', InnfoIcons.getSvg('cite-' + variantKey, { size: 13 }))
      }
      if (head && prov) head.appendChild(prov)
      var status = el(
        'span',
        'innfo-cite-status' + (entry.error ? ' is-bad' : ''),
        entry.error ? 'unresolved' : 'resolved',
      )
      if (head && status) head.appendChild(status)
      if (card && head) card.appendChild(head)
      // The card goes into the list first; its children are appended below.
      if (card) body.appendChild(card)

      var dl = el('dl', 'innfo-ref-fields innfo-cite-meta')
      function addField(label, value) {
        if (!dl) return
        if (value === null || value === undefined || value === '') return
        var dt = el('dt', null, label)
        var dd = el('dd', null, String(value))
        if (dt) dl.appendChild(dt)
        if (dd) dl.appendChild(dd)
      }
      addField('Anchor', entry.anchor)
      addField('Version', entry.version)
      addField('SHA-256', entry.sha256)
      addField('Error', entry.error)
      addField('Path', entry.path)
      if (dl && dl.children.length && card) card.appendChild(dl)

      if (entry.href && !entry.error && card) {
        var openHref = UI && typeof UI.safeHref === 'function' ? UI.safeHref(entry.href) : safeSourceHref(entry.href)
        var openLink = openHref ? el('a', 'innfo-cite-open', 'Open original') : null
        if (openLink) {
          openLink.setAttribute('href', openHref)
          openLink.setAttribute('target', '_blank')
          openLink.setAttribute('rel', 'noopener noreferrer')
          card.appendChild(openLink)
        }
      }

      if (entry.excerpt && card) {
        var excerptText = entry.excerpt + (entry.truncated ? ' … (truncated)' : '')
        var pre = el('pre', 'innfo-cite-excerpt', excerptText)
        if (pre) card.appendChild(pre)
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
      var docModel = (opts && opts.modelId) || step.el.modelId || ''
      if (UI && typeof UI.Ku === 'function') {
        var docUnit = UI.Ku(
          'element',
          {
            model: docModel,
            id: step.el.slug || step.el.id,
            label: String(step.el.name || (isRoot ? 'Root' : 'Step')),
          },
          { doc: doc },
        )
        h.appendChild(docUnit)
      } else {
        h.appendChild(doc.createTextNode(' ' + String(step.el.name || (isRoot ? 'Root' : 'Step'))))
      }
      block.appendChild(h)
      if (step.el.description) {
        var p = el('p', 'desc', step.el.description)
        if (p) block.appendChild(p)
      }
      if (!isRoot && isObject(step.fields)) {
        var dl = el('dl', 'doc-fields', null)
        Object.keys(step.fields).forEach(function (k) {
          if (k === 'parent' || k === 'next') return
          var dt = el('dt', null, null)
          var dd = el('dd', null, null)
          if (UI && typeof UI.Ku === 'function') {
            dt.appendChild(
              UI.Ku(
                'field',
                { family: docModel, model: docModel, concept: step.el.concept, name: k, label: k },
                { doc: doc },
              ),
            )
            dd.appendChild(
              UI.Ku(
                'value',
                {
                  model: docModel,
                  element: step.el.slug || step.el.id,
                  field: k,
                  label: String(step.fields[k]),
                },
                { doc: doc },
              ),
            )
          } else {
            dt.textContent = k
            dd.textContent = String(step.fields[k])
          }
          dl.appendChild(dt)
          dl.appendChild(dd)
        })
        if (dl && dl.children.length) block.appendChild(dl)
      }
      host.appendChild(block)
    })
  }

  // Renders the generic document view: builds the tree from all elements,
  // picks roots that have children (procedures/trees), and renders each chain.
  function renderDocumentView(doc, elements, concepts, modelId) {
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
        modelId: modelId || (elements[0] && elements[0].modelId) || '',
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
        '[data-innfo-feedback-root]{display:flex;align-items:center;gap:12px;margin-left:auto;position:relative;z-index:40;}' +
        '#innfo-feedback-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:transparent;border:none;box-shadow:none;padding:0;}' +
        '#innfo-feedback-banner strong{font-size:0.95rem;font-weight:700;letter-spacing:-0.01em;}' +
        '#innfo-feedback-banner .innfo-banner-version,#innfo-feedback-banner .innfo-banner-needs,#innfo-feedback-banner .innfo-banner-drafts{color:var(--muted,#6b7280);font-size:0.8rem;}' +
        '#innfo-feedback-banner .innfo-banner-stale{color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:4px;font-size:0.78rem;font-weight:600;padding:2px 8px;}' +
        '#innfo-feedback-banner .innfo-reviewer-chip{display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--muted,#6b7280);}' +
        '#innfo-feedback-banner .innfo-reviewer-name{width:9rem;padding:4px 8px;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-sm,4px);background:var(--surface,#ffffff);color:var(--text,#111827);font:inherit;font-size:0.8rem;}' +
        '#innfo-feedback-open{appearance:none;border:1px solid var(--border,#e5e7eb);background:var(--surface,#ffffff);color:var(--text,#111827);font:inherit;font-size:0.82rem;font-weight:600;padding:6px 14px;border-radius:var(--radius-sm,4px);cursor:pointer;}' +
        '#innfo-feedback-open:hover{background:var(--surface-2,#f3f4f6);}' +
        '#innfo-feedback-modal{border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-lg,8px);padding:20px;max-width:560px;width:100%;background:var(--surface,#ffffff);color:var(--text,#111827);}' +
        '#innfo-feedback-modal::backdrop{background:rgba(0,0,0,0.35);}' +
        '#innfo-feedback-modal input{width:100%;padding:8px 12px;margin:8px 0;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-sm,4px);box-sizing:border-box;}' +
        '#innfo-feedback-modal pre{background:var(--surface-2,#f3f4f6);border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:12px;white-space:pre-wrap;font-size:0.8rem;}' +
        '[data-innfo="errors"]{color:#dc2626;font-size:0.85rem;margin:8px 0;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;}' +
        '#innfo-feedback-modal button[data-innfo="download-changeset"]{appearance:none;border:1px solid var(--primary,#2563eb);background:var(--primary,#2563eb);color:#ffffff;font:inherit;font-size:0.85rem;font-weight:600;padding:8px 16px;border-radius:var(--radius-sm,4px);cursor:pointer;}' +
        '#innfo-feedback-modal button[data-innfo="download-changeset"]:hover{background:var(--primary-hover,#1d4ed8);}' +
        '#innfo-feedback-modal [data-innfo="changeset-preview"]{width:100%;min-height:140px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.78rem;border:1px solid var(--border,#e5e7eb);border-radius:6px;padding:10px;box-sizing:border-box;}' +
        '#innfo-feedback-modal .innfo-feedback-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0;}' +
        '#innfo-feedback-modal button[data-innfo="copy-changeset-prompt"]{appearance:none;border:1px solid var(--border,#e5e7eb);background:var(--surface,#ffffff);color:var(--text,#111827);font:inherit;font-size:0.85rem;font-weight:600;padding:8px 16px;border-radius:var(--radius-sm,4px);cursor:pointer;}' +
        '#innfo-feedback-modal button:disabled{opacity:0.5;cursor:not-allowed;}' +
        '#innfo-feedback-modal [data-innfo="copy-status"]{font-size:0.8rem;color:var(--muted,#6b7280);}' +
        '#innfo-feedback-modal .innfo-feedback-head{display:flex;align-items:center;gap:12px;}' +
        '#innfo-feedback-modal .innfo-feedback-head h2{margin:0;flex:1;}' +
        '#innfo-feedback-modal button[data-innfo="close"]{appearance:none;border:1px solid var(--border,#e5e7eb);background:transparent;font-size:1.2rem;line-height:1;padding:2px 10px;border-radius:6px;cursor:pointer;}' +
        '#innfo-feedback-modal .innfo-feedback-seal{font-size:0.8rem;color:var(--muted,#6b7280);margin:8px 0;}'
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

    var draftsBadge = active.createElement('span')
    draftsBadge.className = 'innfo-banner-drafts'
    draftsBadge.setAttribute('data-innfo', 'draft-count')
    draftsBadge.textContent = ' drafts: 0'
    banner.appendChild(draftsBadge)

    root.appendChild(banner)

    // Modal
    var modal = active.createElement('dialog')
    modal.id = 'innfo-feedback-modal'
    modal.setAttribute('aria-label', 'Export proposed changes')
    modal.innerHTML =
      '<div class="innfo-feedback-head"><h2>Export proposed changes</h2>' +
      '<button data-innfo="close" type="button" aria-label="Close">×</button></div>' +
      '<p class="innfo-feedback-seal">Sealed proposal: do not edit the file after download — any edit invalidates proposal_sha (PROPOSAL_TAMPERED). To retry, export a new file.</p>' +
      '<div data-innfo="preview"></div>' +
      '<label>Author / Reviewer identifier (required)' +
      '<input data-innfo="identifier" type="text" placeholder="e.g. round-2" />' +
      '</label>' +
      '<div data-innfo="errors" style="display: none;"></div>' +
      '<div class="innfo-feedback-actions">' +
      '<button data-innfo="download-changeset" type="button">Download _changes_NN.md</button>' +
      '<button data-innfo="copy-changeset-prompt" type="button">Copy changeset</button>' +
      '<span data-innfo="copy-status" role="status" aria-live="polite"></span>' +
      '</div>' +
      '<details class="innfo-modal-details">' +
      '<summary>View generated changeset &amp; prompt</summary>' +
      '<h4>Changeset content (_changes_NN.md)</h4>' +
      '<textarea data-innfo="changeset-preview" readonly></textarea>' +
      '<h4>Instructions</h4>' +
      '<pre data-innfo="instructions"></pre>' +
      '<h4>Agent prompt</h4>' +
      '<pre data-innfo="agent-prompt"></pre>' +
      '</details>'

    root.appendChild(modal)

    // Contextual Floating Review Dock
    var oldDock = active.getElementById('innfo-review-dock')
    if (oldDock && oldDock.parentNode) oldDock.parentNode.removeChild(oldDock)
    var dock = active.createElement('div')
    dock.id = 'innfo-review-dock'
    dock.className = 'innfo-review-dock'
    dock.setAttribute('data-innfo-component', 'review-dock')
    dock.setAttribute('aria-label', 'Review floating dock')
    dock.style.display = 'none'

    var dockStatus = active.createElement('div')
    dockStatus.className = 'innfo-dock-status'
    dockStatus.innerHTML = '<span class="innfo-dock-dot"></span><span>Changeset</span>'
    dock.appendChild(dockStatus)

    var sep1 = active.createElement('span')
    sep1.className = 'innfo-dock-sep'
    dock.appendChild(sep1)

    // Reviewer identity inside floating dock
    dock.appendChild(buildReviewerChip(active))

    var sep2 = active.createElement('span')
    sep2.className = 'innfo-dock-sep'
    dock.appendChild(sep2)

    // Changes view toggle button
    var changesBtn = active.createElement('button')
    changesBtn.type = 'button'
    changesBtn.className = 'innfo-dock-changes'
    changesBtn.setAttribute('data-innfo', 'dock-changes')
    changesBtn.textContent = 'Changes'
    changesBtn.addEventListener('click', function () {
      if (state && state.tabs) {
        if (state.tabs.current() === 'review') {
          state.tabs.select('explorer')
        } else {
          state.tabs.select('review')
        }
      }
    })
    dock.appendChild(changesBtn)

    var dockDraftsEl = active.createElement('span')
    dockDraftsEl.className = 'innfo-dock-drafts'
    dockDraftsEl.textContent = 'Drafts: 0'
    dock.appendChild(dockDraftsEl)

    // Open button (Export changes)
    var openBtn = active.createElement('button')
    openBtn.id = 'innfo-dock-export-btn'
    openBtn.setAttribute('type', 'button')
    openBtn.className = 'innfo-feedback-open innfo-dock-export'
    openBtn.textContent = 'Export changes'
    dock.appendChild(openBtn)

    var exitBtn = active.createElement('button')
    exitBtn.type = 'button'
    exitBtn.className = 'innfo-dock-exit'
    exitBtn.textContent = 'Hide'
    exitBtn.setAttribute('aria-label', 'Hide the changeset bar')
    exitBtn.addEventListener('click', function () {
      dock.style.setProperty('display', 'none', 'important')
      dock.removeAttribute('data-visible')
      dock.classList.remove('active', 'innfo-dock-blinking')
      if (dock._blinkTimer) {
        clearTimeout(dock._blinkTimer)
        dock._blinkTimer = null
      }
    })
    dock.appendChild(exitBtn)

    if (active.body) {
      active.body.appendChild(dock)
    } else {
      root.appendChild(dock)
    }

    // Single-header layout: the feedback controls live inside the top navbar
    // (no second application header). Fall back to the body top for shells
    // that ship no navbar.
    var navbar = active.querySelector ? active.querySelector('.innfo-navbar') : null
    if (navbar) {
      navbar.appendChild(root)
    } else if (active.body) {
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

  var CHANGES_VERSION_MISSING =
    'The console payload carries no changes bluepriNNt version; regenerate the console.'

  function formatChangesetValue(val) {
    if (val === undefined || val === null) return '""'
    var str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf(':') !== -1 || str.indexOf(' ') !== -1) {
      return JSON.stringify(str)
    }
    return str
  }

  // Builds one `## NN Change` block addressed the way `apply_change` resolves it:
  // `<file stem>@<element slug>[&field]`. The draft carries `knowledge_id` (the knowledge
  // document's file stem) and `element_slug`; `fallbackModel` only covers drafts that
  // lack them.
  function oneLine(v) {
    return String(v).replace(new RegExp('[\\r\\n\\u2028\\u2029]+', 'g'), ' ').trim()
  }

  function draftToChange(draft, index, fallbackModel) {
    var d = isObject(draft) ? draft : {}
    var id = oneLine(d.id || 'c-' + String(index + 1).padStart(2, '0'))
    var model = oneLine(d.knowledge_id || fallbackModel || 'model')
    // The element part of a target is always the element slug: never the display
    // name or the element id (the engine resolves slugs, and every payload element
    // carries one).
    var elementTarget = oneLine(d.element_slug || 'elem')
    var matrixName = d.matrix != null && d.matrix !== '' ? oneLine(d.matrix) : ''
    var isMatrix = !!matrixName
    var canUpdate = (!!d.field && d.proposed !== undefined) || (isMatrix && d.proposed !== undefined)
    var isRename = !isMatrix && canUpdate && String(d.field).toLowerCase() === 'name'
    var op = isMatrix ? 'update_matrix_cell' : 'update_field'
    var target = isMatrix
      ? model + '@' + matrixName + '&' + oneLine(d.row) + '&' + oneLine(d.col)
      : model + '@' + elementTarget + (d.field ? '&' + oneLine(d.field) : '')
    if (isRename) {
      // Element display name is identity, not a field — the engine rejects
      // update_field on &name (PRECONDITION_FAILED). Emit rename_element.
      op = 'rename_element'
      target = model + '@' + elementTarget
    } else if (d.kind === 'delete') {
      op = 'remove_element'
      target = model + '@' + elementTarget
    } else if (d.kind === 'new') {
      if (d.concept && d.element) {
        // A new element is addressed by its concept; the engine reads name/fields below.
        op = 'add_element'
        target = model + '@' + oneLine(d.concept)
      } else {
        op = 'comment'
      }
    } else if (d.kind === 'comment' || !canUpdate) {
      op = 'comment'
    }

    var lines = []
    lines.push('## NN Change: ' + id)
    lines.push('op:: ' + op)
    lines.push('target:: ' + target)
    // The engine rejects the change if the element's content hash moved on since the draft.
    if ((op === 'update_field' || op === 'remove_element' || op === 'rename_element') && d.base_hash) {
      lines.push('base_hash:: ' + oneLine(d.base_hash))
    }
    if (op === 'rename_element') {
      if (d.original !== undefined) lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('name:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'update_field') {
      if (d.original !== undefined) lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('to:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'update_matrix_cell') {
      if (d.original !== undefined && d.original !== '') lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('to:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'add_element') {
      lines.push('concept:: ' + oneLine(d.concept))
      lines.push('name:: ' + formatChangesetValue(d.element))
      if (isObject(d.proposed)) lines.push('fields:: ' + JSON.stringify(d.proposed))
    }
    if (d.comment) {
      lines.push('notes:: ' + formatChangesetValue(d.comment))
    }
    return lines.join('\n')
  }

  function serializeChangesetMarkdown(meta, drafts, fallbackModel) {
    // The stamped version is the changes bluepriNNt version the payload was built
    // against (core's canonical registry); composeExport refuses to export without it.
    var title = meta.title || meta.source_knowledge || 'Proposed Changes'
    var author = meta.author || 'reviewer'
    var lines = [
      '---',
      'spec_version: "V_0-4-0"',
      'level: 3',
      'parent_spec:',
      '  name: changes',
      '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/changes/spec_NN.md"',
      'blueprint_version: ' + JSON.stringify(String(meta.changesBlueprintVersion)),
      'status: proposed',
      'title: ' + JSON.stringify(title),
      'author: ' + JSON.stringify(author),
      '---',
      '',
      '> [!NOTE]',
      '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.',
      '',
      '# NN index',
      '',
      '* [[Change]]',
      '',
      '# NN Change',
      '',
    ]
    var modelName = fallbackModel || meta.source_knowledge || 'model'
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
    var reviewerSlug = slugify(reviewer) || 'reviewer'
    var stamp = stampFromDate(new Date())

    var exportMeta = {
      source_knowledge: model,
      title: 'Review Changes: ' + model,
      author: reviewer,
      changesBlueprintVersion: state && state.meta ? state.meta.changesBlueprintVersion : undefined,
    }
    if (!nonEmptyString(exportMeta.changesBlueprintVersion)) {
      return { ok: false, errors: [CHANGES_VERSION_MISSING] }
    }

    if (!reviewer || reviewer === DEFAULT_REVIEWER_NAME) {
      return { ok: false, errors: ['Reviewer identifier is required.'] }
    }

    var text = serializeChangesetMarkdown(exportMeta, drafts, state && state.modelId)
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
    // Already-applied drafts (stale hash, proposed == current value) carry no
    // change: exclude them from the export instead of shipping redundancies.
    var byId = elementsByIdOf(state)
    drafts = drafts.filter(function (d) {
      return !Review.isAlreadyApplied(d, byId)
    })
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
    if (!nonEmptyString(exportMeta.changesBlueprintVersion)) {
      return { ok: false, errors: [CHANGES_VERSION_MISSING] }
    }
    if (state && (state.sourceSha256 || (state.meta && state.meta.sha256))) {
      exportMeta.source_sha256 = state.sourceSha256 || state.meta.sha256
    }

    if (!reviewer || reviewer === DEFAULT_REVIEWER_NAME) {
      return { ok: false, errors: ['Reviewer identifier is required.'] }
    }

    var stamp = stampFromDate(state && state.exportedAt ? new Date(state.exportedAt) : new Date())
    var changesetMd = serializeChangesetMarkdown(exportMeta, drafts, state && state.modelId)
    var modelSlug = modelSlugOf(state)
    var changesetFilename = modelSlug + '_' + reviewerSlug + '_' + stamp + '_changes_NN.md'

    return {
      ok: true,
      changesetText: changesetMd,
      changesetFilename: changesetFilename,
      items: drafts.length,
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
        return '<li>' + escapeHtml(e) + '</li>'
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
    markDraftsExported(state)
    return { ok: true, filename: composed.changesetFilename, items: composed.items }
  }

  // Remembers which drafts just left in an export so the Review tab can offer to
  // clear them; drafts are never removed automatically (the file may be lost).
  function markDraftsExported(state) {
    if (!state || !state.store) return
    state.exportedDraftIds = state.store.drafts().map(function (d) {
      return d.id
    })
    if (typeof state.refreshUi === 'function') state.refreshUi()
  }

  function copyChangesetPrompt(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal')
    var status = modal && modal.querySelector('[data-innfo="copy-status"]')
    var textarea = modal && modal.querySelector('[data-innfo="changeset-preview"]')
    function announce(msg) {
      if (status) status.textContent = msg
    }
    var composed = composeExport(state, _readIdentifier(modal))
    if (!composed.ok) {
      announce('Cannot copy: fix the validation errors first.')
      return composed
    }
    // The clipboard receives exactly the changeset bytes the download would
    // contain — never a wrapper prompt.
    var changesetText = composed.changesetText
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        navigator.clipboard.writeText(changesetText).then(
          function () {
            announce('Copied changeset to clipboard.')
            markDraftsExported(state)
          },
          function () {
            announce(fallbackCopy(doc, textarea, changesetText))
          },
        )
        return composed
      }
      announce(fallbackCopy(doc, textarea, changesetText))
    } catch {
      announce('Copy failed. Select the text and press Ctrl+C.')
    }
    return composed
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
      preview.appendChild(
        UI.DraftList({ drafts: drafts, byId: elementsByIdOf(state) }, { doc: doc, isTargetChanged: Review.isTargetChanged, isAlreadyApplied: Review.isAlreadyApplied }),
      )
    }

    var composed = composeExport(state, identifier)
    var downloadCsBtn = modal.querySelector('[data-innfo="download-changeset"]')
    var copyCsBtn = modal.querySelector('[data-innfo="copy-changeset-prompt"]')
    var textarea = modal.querySelector('[data-innfo="changeset-preview"]')

    if (composed.ok) {
      renderErrors(doc, [])
      if (textarea) textarea.value = composed.changesetText
      if (downloadCsBtn) downloadCsBtn.disabled = false
      if (copyCsBtn) copyCsBtn.disabled = false
    } else {
      renderErrors(doc, composed.errors)
      if (textarea) textarea.value = ''
      if (downloadCsBtn) downloadCsBtn.disabled = true
      if (copyCsBtn) copyCsBtn.disabled = true
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
      if (ok) return 'Copied changeset to clipboard.'
      return 'Select the changeset and press Ctrl+C to copy.'
    } catch {
      return 'Copy failed. Select the changeset and press Ctrl+C.'
    }
  }

  function openExportModal(doc, state) {
    var modal = doc.getElementById('innfo-feedback-modal') || doc.getElementById('innfo-export-modal')
    if (!modal) {
      downloadChangesetExport(doc, state)
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
        ' pending draft(s), then download or copy the changeset.'
    }
    if (agentPrompt) {
      agentPrompt.textContent =
        'Apply the attached changeset to ' +
        (state ? state.modelTitle : 'Model') +
        ' (' +
        (state ? state.modelVersion : '') +
        ').'
    }

    updateExportPreview(doc, state)

    function closeModal() {
      if (typeof modal.close === 'function') {
        try {
          if (modal.open) modal.close()
          else modal.removeAttribute('open')
        } catch {
          modal.removeAttribute('open')
        }
      } else modal.removeAttribute('open')
    }

    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal()
    } else {
      modal.setAttribute('open', 'open')
    }

    var closeBtn = modal.querySelector('[data-innfo="close"]')
    if (closeBtn && !closeBtn.getAttribute('data-innfo-bound')) {
      closeBtn.setAttribute('data-innfo-bound', '1')
      closeBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation()
        closeModal()
      })
    }
    if (!modal.getAttribute('data-innfo-dismiss-bound')) {
      modal.setAttribute('data-innfo-dismiss-bound', '1')
      modal.addEventListener('click', function (ev) {
        if (ev && ev.target === modal) closeModal()
      })
      modal.addEventListener('cancel', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault()
        closeModal()
      })
    }

    if (identifierInput && !identifierInput.getAttribute('data-innfo-bound')) {
      identifierInput.setAttribute('data-innfo-bound', '1')
      identifierInput.addEventListener('input', function () {
        updateExportPreview(doc, state)
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
    var concepts = (Array.isArray(schema.concepts) ? schema.concepts.slice() : []).map(function (c) {
      return typeof c === 'string' ? { name: c } : c
    })
    var seenBootConceptNames = {}
    concepts.forEach(function (c) {
      if (c && c.name) seenBootConceptNames[c.name] = true
    })
    elements.forEach(function (e) {
      if (e && typeof e.concept === 'string' && e.concept && !seenBootConceptNames[e.concept]) {
        seenBootConceptNames[e.concept] = true
        concepts.push({ name: e.concept })
      }
    })

    var scopedView = consoleScopeOf(meta)
    var scopedDef = scopedView
      ? registry.list().filter(function (v) {
          return v.id === scopedView
        })[0]
      : null
    if (scopedView) {
      // The search toolbar and concept rail only serve the explorer, which a
      // scoped console does not show. Removed, not hidden: their CSS would override [hidden].
      ;['innfo-rail'].forEach(function (id) {
        var node = active.getElementById(id)
        if (node && node.parentNode) node.parentNode.removeChild(node)
      })
      var scopedToolbar = active.querySelector('.innfo-toolbar')
      if (scopedToolbar && scopedToolbar.parentNode) scopedToolbar.parentNode.removeChild(scopedToolbar)
      if (active.documentElement) active.documentElement.setAttribute('data-innfo-scope', scopedView)
    }
    var baseTitle = String(meta.title || meta.model || 'Model')
    var baseId = String(meta.modelId || meta.model || meta.title || 'model')
    // The displayed version comes from the domain meta `models[]` (D4), with no fallback.
    var liveModelVersion = domainModelVersion(meta)

    var state = {
      modelTitle: scopedView ? baseTitle + ' - ' + (scopedDef ? scopedDef.title : scopedView) : baseTitle,
      modelVersion: liveModelVersion,
      artifactName: String(meta.title || 'console') + '_console.html',
      modelId: meta.modelId || meta.model || meta.title || 'model',
      modelSlug: scopedView
        ? modelSlugOf({ modelSlug: meta.knowledge_slug || meta.modelSlug, modelId: baseId, modelTitle: baseTitle }) + '-' + scopedView
        : meta.knowledge_slug || meta.modelSlug || undefined,
      sourceSha256:
      (Array.isArray(meta.models) && meta.models.length === 1 && meta.models[0] && meta.models[0].sha256) ||
      meta.sha256 ||
      meta.source_sha256,
      // The changeset title comes from meta.title; a scoped export names its view there.
      meta: scopedView ? Object.assign({}, meta, { title: baseTitle + ' - ' + (scopedDef ? scopedDef.title : scopedView) }) : meta,
      elements: elements,
      schema: schema,
      concepts: concepts,
      store: Review.createDraftStore(
        typeof localStorage !== 'undefined' ? localStorage : null,
        // A domain console keys its drafts by the stable domain id, never by content.
        String(meta.domainId || baseId) + (scopedView ? '::view:' + scopedView : ''),
        {
          onError: function (err) {
            notifyStoreError(active, err)
          },
          // Another tab changed the drafts: repaint from the merged store.
          onRemoteChange: function () {
            state.refreshUi()
          },
        },
      ),
    }
    state.refreshUi = function () {
      refresh(activeSearchQuery)
      refreshDraftCounts()
    }
    cleanups.push(function () {
      if (state.store && typeof state.store.destroy === 'function') state.store.destroy()
    })
    if (state.store && state.store.persistent === false) {
      showToast(active, 'Browser storage is unavailable: drafts are kept in memory and will be lost on reload. Export your changes before leaving.')
    }

    var counts = {}
    elements.forEach(function (e) {
      if (e && e.concept) counts[e.concept] = (counts[e.concept] || 0) + 1
    })

    var refs = hasNeed(config, 'reference-popup') ? buildRefsByName(elements) : null
    var activeSearchQuery = ''
    // Deep-link focus: the element id a `#el-<id>` hash asked to open, consumed
    // once by the next card render and then cleared.
    var focusId = null
    // Model Explorer view mode ('cards' | 'table') and the table sort state.
    var explorerView = 'sheets'
    var sortState = { key: '', dir: 'asc' }

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

    // Rail selections accumulate (OR), matching the facet checkboxes: clicking a
    // concept/model toggles it in the query instead of replacing the whole filter,
    // so activating more than one concept unions the results.
    function selectRailToken(token) {
      var search = active.getElementById('innfo-search')
      var current = activeSearchQuery !== undefined ? activeSearchQuery : search ? search.value : ''
      var m = /^([!]?[a-z]+):(.*)$/.exec(String(token || ''))
      if (!m) {
        if (search) {
          search.value = token
          refresh(token)
        }
        return
      }
      var key = m[1]
      var val = m[2].replace(/^["']|["']$/g, '')
      var parsed = parseFilterQuery(current)
      var ops = parsed.operators.slice()
      var at = -1
      for (var i = 0; i < ops.length; i++) {
        if (ops[i].key === key && String(ops[i].val).toLowerCase() === val.toLowerCase()) {
          at = i
          break
        }
      }
      if (at !== -1) ops.splice(at, 1)
      else ops.push({ key: key, val: val })
      var queryParts = parsed.textTokens.map(function (t) {
        return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
      })
      ops.forEach(function (op) {
        queryParts.push(op.raw || formatFacetToken(op.key, op.val))
      })
      var next = queryParts.join(' ')
      if (search) search.value = next
      refresh(next)
    }

    // Click-throughs add a facet instead of toggling it: clicking a chip or a
    // knowledge pill twice must not silently drop the filter.
    function addFacetToken(key, val) {
      var search = active.getElementById('innfo-search')
      var current = activeSearchQuery !== undefined ? activeSearchQuery : search ? search.value : ''
      var present = parseFilterQuery(current).operators.some(function (op) {
        return op.key === key && String(op.val).toLowerCase() === String(val).toLowerCase()
      })
      if (!present) selectRailToken(formatFacetToken(key, val))
    }

    var cardActions = {
      onTag: function (tag) {
        addFacetToken('tags', tag)
      },
      isKnowledgeBound: function (value) {
        return !!resolveKnowledgeModel(meta, value)
      },
      onKnowledge: function (value) {
        var bound = resolveKnowledgeModel(meta, value)
        if (bound) addFacetToken('model', String(bound.id || bound.filePath))
      },
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
      var dockCount = active.querySelector('#innfo-review-dock .innfo-dock-drafts')
      if (dockCount) dockCount.textContent = 'Drafts: ' + n
      updateTabBadges(active, state)
      renderReviewTab(active, state, config, function () {
        refresh(activeSearchQuery)
      })
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
        schema: state.schema,
      }

      var filteredElements = filterElements(elements, activeSearchQuery || '', filterCtx)
      lastFilteredElements = filteredElements
      if (tabs && typeof tabs.notifyFilter === 'function') {
        tabs.notifyFilter(filteredElements, activeSearchQuery || '')
      }
      if (!scopedView && elements.length) {
        renderExplorerToolbar(active, explorerView, function (mode) {
          if (mode === explorerView) return
          explorerView = mode
          refresh(activeSearchQuery)
        })
      }
      var incomingById = incomingRelationsMap(elements)
      if (explorerView === 'table') {
        mountElementTable(active, filteredElements, currentDrafts, concepts, sortState, schema, function (key) {
          if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
          else {
            sortState.key = key
            sortState.dir = 'asc'
          }
          refresh(activeSearchQuery)
        }, (meta && (meta.modelId || meta.model)) || '')
      } else if (explorerView === 'badges') {
        mountElementBadges(active, filteredElements, currentDrafts, concepts, refs, (meta && (meta.modelId || meta.model)) || '')
      } else if (explorerView === 'cards') {
        mountElementMiniCards(active, filteredElements, currentDrafts, concepts, refs, incomingById, cardActions, (meta && (meta.modelId || meta.model)) || '')
      } else {
        mountElementCards(active, filteredElements, currentDrafts, refs, concepts, schema, incomingById, focusId, cardActions, (meta && (meta.modelId || meta.model)) || '')
        focusId = null
      }
      renderFilterBar(active, state, function (nextQuery) {
        var sBox = active.getElementById('innfo-search')
        if (sBox) sBox.value = nextQuery
        refresh(nextQuery)
      }, activeSearchQuery)
      renderBanner(active, meta, config.needs, currentDrafts.length, function () {
        refresh(activeSearchQuery)
      }, state)
      renderRail(active, concepts, counts, draftCountsByConcept, selectRailToken, state)
      if (!scopedView) {
        renderConceptGuide(
          active,
          activeGuideConcept(activeSearchQuery, concepts),
          schema,
          matrices,
          counts,
          (meta && (meta.modelId || meta.model)) || '',
        )
      }

      // Document overview tree remains hidden while filtering elements so filtered cards are immediately visible
      var docHost = active.getElementById('innfo-doc')
      if (docHost) {
        docHost.style.display = activeSearchQuery ? 'none' : ''
      }

      renderReviewTab(active, state, config, function () {
        refresh(activeSearchQuery)
      })
      updateTabBadges(active, state)

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
    var lastFilteredElements = []
    var tabs = mountTabs(active, {
      getQuery: function () {
        return activeSearchQuery
      },
      getFilteredElements: function () {
        return lastFilteredElements
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

    if (tabs) {
      state.tabs = tabs
      cleanups.push(tabs.destroy)
    }
    renderNavbarIdentity(active, meta)
    refresh(initialQuery, !!(tabs && tabs.hashTab()))

    // C3: the controller builds the toggle into the (now rendered) banner and
    // listens for innfo:rendered; created after the first paint so the banner
    // rebuild does not drop the toggle.
    // (C): create the controller whenever the domain is proposable OR exportable; it
    // gates its own decorations. Without this, a proposable domain without an export
    // surface would get no edit anchors at all.
    if (
      hasNeed(config, 'feedback-export') ||
      !!(meta && typeof meta.modelId === 'string' && meta.modelId.trim() && elements.length > 0)
    ) {
      state.controller = Review.createReviewController(active, {
        meta: meta,
        elements: elements,
        changes: Array.isArray(model.changes) ? model.changes : [],
        needs: config.needs,
        store: state.store,
        schema: schema,
        getReviewer: getReviewerName,
        onDraftsChanged: refreshDraftCounts,
      })
    }

    // DQ6 facts for the info panel: only what the runtime actually knows. Never
    // fabricated: if a count is not available, the row is omitted.
    function unitFacts(desc) {
      var facts = {}
      if (!desc) return facts
      var list = Array.isArray(elements) ? elements : []
      var kind = desc.kind
      if (kind === 'concept' || kind === 'section') {
        var used = list.filter(function (el) {
          return el && String(el.concept || '') === String(desc.label || '')
        }).length
        if (used) facts['Used by'] = used + (used === 1 ? ' element' : ' elements')
      } else if (kind === 'field') {
        var withField = list.filter(function (el) {
          return el && el.fields && el.fields[desc.label] != null
        }).length
        if (withField) facts['Used by'] = withField + (withField === 1 ? ' element' : ' elements')
      } else if (kind === 'document') {
        facts['Elements'] = String(list.length)
      } else if (kind === 'domain') {
        var models = meta && Array.isArray(meta.models) ? meta.models.length : 0
        if (models > 1) facts['Models'] = String(models)
      } else if (kind === 'matrix') {
        var defs = schema && Array.isArray(schema.matrices) ? schema.matrices : []
        var mdef = defs.filter(function (m) {
          return m && String(m.name || '') === String(desc.label || '')
        })[0]
        if (mdef) {
          var rows = Array.isArray(mdef.rows) ? mdef.rows.length : 0
          var cols = Array.isArray(mdef.cols) ? mdef.cols.length : 0
          if (rows && cols) facts['Cells'] = String(rows * cols)
        }
      }
      return facts
    }

    // Ku actions are delegated once per document, never per component.
    if (UI && typeof UI.createKu === 'function' && !state.kuDelegation) {
      state.kuDelegation = UI.createKu({
        doc: active,
        onAction: function (action, descriptor) {
          if (action === 'reveal') {
            revealUnit(descriptor)
            return
          }
          var ctrl = state.controller
          if (ctrl && typeof ctrl.handleKuAction === 'function') {
            ctrl.handleKuAction(action === 'changes' ? 'info' : action, descriptor)
            return
          }
          if (action === 'info' || action === 'changes') {
            var withFacts = Object.assign({}, descriptor, {
              facts: Object.assign({}, (descriptor && descriptor.facts) || {}, unitFacts(descriptor)),
            })
            var panel = UI.KuInfoPanel(withFacts)
            if (active.body) active.body.appendChild(panel)
            if (panel && typeof panel.showModal === 'function') panel.showModal()
          }
        },
      })
    }

    // The first view mounts here, after the initial search had its say.
    if (tabs) tabs.activateInitial()

    if (hasNeed(config, 'document-view')) {
      var hasProcTab = !!(
        tabs &&
        Array.isArray(tabs.tabs) &&
        tabs.tabs.some(function (t) {
          return t && t.id === 'procedure'
        })
      )
      var docElements = hasProcTab
        ? (Array.isArray(elements)
            ? elements.filter(function (e) {
                return !e || e.concept !== 'Work'
              })
            : [])
        : elements
      renderDocumentView(active, docElements, concepts, (meta && (meta.modelId || meta.model)) || '')
    }
    renderMatrices(active, matrices, concepts, (meta && (meta.modelId || meta.model)) || '')
    renderMetamodelView(active, schema, matrices, elements)

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

    // "Reveal in context": take the reviewer TO the unit instead of re-rendering it
    // in a modal. Reuses the deep-link mechanism (`#el-<id>`) wholesale, so the
    // filter broadening and the scroll come for free. No second renderer.
    function revealUnit(desc) {
      var address = String((desc && desc.address) || '')
      var kind = (desc && desc.kind) || ''
      var elId = kind === 'element' ? address : kind === 'value' ? address.split('&')[0] : ''
      var known = false
      for (var i = 0; i < elements.length; i++) {
        if (elements[i] && String(elements[i].id || '') === elId) {
          known = true
          break
        }
      }
      if (elId && known && active.location) {
        var hash = '#el-' + encodeURIComponent(elId)
        if (String(active.location.hash || '') === hash) onHash()
        else active.location.hash = hash
        return true
      }
      // No card of its own (document, section, matrix, source): narrow the view to
      // its canonical address instead.
      var box = active.getElementById('innfo-search')
      if (box) box.value = address
      refresh(address)
      return false
    }

    function onHash() {
      var raw = String(active.location ? active.location.hash || '' : '').replace(/^#/, '')
      // Deep link: #el-<model-qualified element id> opens that element's card.
      if (raw.indexOf('el-') === 0) {
        if (scopedView) return
        var elemId = raw.slice(3)
        try {
          elemId = decodeURIComponent(elemId)
        } catch {
          /* keep the raw id */
        }
        var targetEl = null
        for (var ei = 0; ei < elements.length; ei++) {
          if (elements[ei] && String(elements[ei].id || '') === elemId) {
            targetEl = elements[ei]
            break
          }
        }
        if (!targetEl) return
        focusId = elemId
        var query = activeSearchQuery
        var visible = filterElements([targetEl], activeSearchQuery, { draftsById: {}, reviewed: {} })
        if (!visible.length) {
          query = 'concept:' + String(targetEl.concept || '')
          var searchInput = active.getElementById('innfo-search')
          if (searchInput) searchInput.value = query
        }
        if (tabs) tabs.select('explorer', true)
        refresh(query, true)
        var card = active.getElementById('el-' + elemId)
        if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView()
        return
      }
      var parsed = parseViewHash(active.location ? active.location.hash : '')
      if (!scopedView && parsed.q !== activeSearchQuery) {
        // Back/forward to an entry with a different query: follow it.
        var box = active.getElementById('innfo-search')
        if (box) box.value = parsed.q
        refresh(parsed.q, true)
      }
      if (!raw) return
      var target = active.getElementById(raw)
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
    REVIEWER_STORAGE_KEY: REVIEWER_STORAGE_KEY,
    ITEM_KINDS: ITEM_KINDS,
    slugify: slugify,
    slugifyReviewer: slugifyReviewer,
    stampFromDate: stampFromDate,
    getReviewerName: getReviewerName,
    setReviewerName: setReviewerName,
    parseConfig: parseConfig,
    hasNeed: hasNeed,
    parseSlots: parseSlots,
    resolveElementId: resolveElementId,
    filterElements: filterElements,
    buildRefsByName: buildRefsByName,
    renderRefDialog: renderRefDialog,
    renderCitationDialog: renderCitationDialog,
    renderBanner: renderBanner,
    renderNavbarIdentity: renderNavbarIdentity,
    safeSourceHref: safeSourceHref,
    renderFilterBar: renderFilterBar,
    renderRail: renderRail,
    renderErrors: renderErrors,
    mountElementTable: mountElementTable,
    mountElementBadges: mountElementBadges,
    mountElementMiniCards: mountElementMiniCards,
    renderExplorerToolbar: renderExplorerToolbar,
    sortTableElements: sortTableElements,
    renderMediaDialog: renderMediaDialog,
    renderFieldDetailDialog: renderFieldDetailDialog,
    renderMetamodelView: renderMetamodelView,
    incomingRelationsMap: incomingRelationsMap,
    renderDocument: renderDocument,
    renderDocumentView: renderDocumentView,
    buildTree: buildTree,
    resolveParentId: resolveParentId,
    sortChildren: sortChildren,
    firstChild: firstChild,
    nextStep: nextStep,
    chainOf: chainOf,
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
    composeExport: composeExport,
    composeChangesetExport: composeChangesetExport,
    downloadChangesetExport: downloadChangesetExport,
    copyChangesetPrompt: copyChangesetPrompt,
    boot: boot,
    fieldDefOf: fieldDefOf,
  }

  return PUBLIC_API
})
