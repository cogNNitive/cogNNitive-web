/* global module: writable */
/* global echarts */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ui-kit.js'), require('./review.js'), require('./studio.js'))
  } else {
    root.nnConsole = factory(root.nnUI, root.nnReview, root.nnStudio)
  }
})(typeof self !== 'undefined' ? self : this, function (UI, Review, Studio) {
  'use strict'

  // D5: the kit is a hard dependency; fail loudly rather than degrade silently.
  if (!UI) throw new Error('nnUI missing: load ui-kit.js first')
  if (!Review) throw new Error('nnReview missing: load review.js first')
  if (!Studio) throw new Error('nnStudio missing: load studio.js first')

  // Release identity. `scripts/lib/console-bundle.js` injects the console package
  // version here at compose time, the same value that forms the bundle banner, so the
  // runtime and the release URL parsed from that banner cannot disagree. A
  // source-module load (tests, direct use) reads that same package file instead. The
  // marker below only exists in the source; it never reaches a composed bundle.
  var CONSOLE_VERSION = '__NN_CONSOLE_RELEASE_VERSION__'
  if (CONSOLE_VERSION === '__NN_CONSOLE_RELEASE_VERSION__' && typeof require === 'function') {
    try {
      CONSOLE_VERSION = String(require('./package.json').version)
    } catch {
      /* no injected version and no package file: a broken build, not a runtime path */
    }
  }

  var REVIEWER_STORAGE_KEY = 'nn_reviewer_name'
  // Fallback reviewer name used when none is stored. Treated as "no identifier"
  // by the export gate so the user must enter a real one before exporting.
  var DEFAULT_REVIEWER_NAME = 'reviewer'
  var MODEL_VERSION_PATTERN = /^V_\d+-\d+-\d+$/
  // `run_start` asks the domain owner's agent to start a procedure run (import_console calls
  // procedure_start); it is never a changeset change, so the export skips it.
  // `run_handoff` records the person's final choice for a completed run (import_console too).
  var ITEM_KINDS = ['correction', 'comment', 'new', 'delete', 'verdict', 'run_start', 'run_handoff']
  // Values the `is:` filter operator understands (see matchAtom).
  var KNOWN_IS_VALUES = ['draft', 'reviewed', 'changed']
  var activeState = null

  var CITATION_ORIGIN_LABELS = (UI && UI.CITATION_ORIGIN_LABELS) || {}

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  function getnnSlug() {
    if (typeof nnSlug !== 'undefined' && nnSlug && nnSlug.slugify) return nnSlug
    if (typeof globalThis !== 'undefined' && globalThis.nnSlug && globalThis.nnSlug.slugify)
      return globalThis.nnSlug
    if (typeof require === 'function') {
      try {
        var mod = require('./nn-slug.generated.js')
        if (mod && mod.slugify) return mod
      } catch {
        /* ignore */
      }
    }
    return null
  }

  function slugify(value) {
    var slugMod = getnnSlug()
    var raw = slugMod ? slugMod.slugify(String(value == null ? '' : value)) : ''
    return raw || 'feedback'
  }

  // D4: exports are named after the immutable knowledge_slug, never the human
  // title. An explicit slug wins; otherwise the model id (then title) is slugified.
  function modelSlugOf(state) {
    var s = isObject(state) ? state : {}
    var slugMod = getnnSlug()
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

  /**
   * Web storage access that survives a sandboxed document.
   *
   * In an iframe without `allow-same-origin` (IDE side panels, preview panes)
   * reading `localStorage` THROWS instead of returning undefined, so a
   * `typeof` guard on it never reaches its fallback: `typeof` still evaluates
   * the getter. Callers treat null as "unavailable", which keeps the console
   * working with an in-memory store.
   */
  function safeLocalStorage() {
    try {
      return localStorage || null
    } catch {
      return null
    }
  }

  function getReviewerName() {
    try {
      var store = safeLocalStorage()
      if (store) {
        var stored = store.getItem(REVIEWER_STORAGE_KEY)
        if (stored && typeof stored === 'string' && stored.trim()) {
          return stored.trim()
        }
      }
    } catch {
      /* storage read failed (private mode / file:// / sandboxed) - fall through to default */
    }
    return DEFAULT_REVIEWER_NAME
  }

  function setReviewerName(name) {
    var val = String(name || '').trim() || DEFAULT_REVIEWER_NAME
    try {
      var store = safeLocalStorage()
      if (store) {
        store.setItem(REVIEWER_STORAGE_KEY, val)
      }
    } catch {
      /* storage write failed (private mode / file:// / sandboxed) - name stays in-memory */
    }
    return val
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n
  }

  // A changeset name carries the runner's UTC stamp, `YYYYMMDDTHHMMSSZ` (nn-core
  // `formatUtcStamp`), so a download sorts beside the changesets the runner writes.
  function changesetStampOf(when) {
    var d = when instanceof Date ? when : new Date(when)
    if (isNaN(d.getTime())) throw new Error('nn-console: invalid date for filename stamp')
    return (
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      'T' +
      pad2(d.getUTCHours()) +
      pad2(d.getUTCMinutes()) +
      pad2(d.getUTCSeconds()) +
      'Z'
    )
  }

  function stampFromDate(when) {
    var d = when instanceof Date ? when : new Date(when)
    if (isNaN(d.getTime())) throw new Error('nn-console: invalid date for filename stamp')
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

  /**
   * The per-view facts the exporter collected (decision A12). Absent (an older shell or
   * a domain whose views ship no data module) means an empty map, never undefined; a
   * corrupt slot is loud, like every other slot.
   */
  function parseViewData(raw) {
    var text = String(raw == null ? '' : raw).trim()
    if (text === '') return {}
    var parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('nn-console: nn-view-data slot holds corrupt JSON')
    }
    if (!isObject(parsed)) {
      throw new Error('nn-console: the nn-view-data slot must decode to a JSON object')
    }
    return parsed
  }

  function parseSlots(schemaRaw, modelRaw) {
    var schema
    var model
    try {
      schema = JSON.parse(String(schemaRaw || '').trim() || '{}')
    } catch {
      throw new Error('nn-console: nn-schema slot holds corrupt JSON')
    }
    try {
      model = JSON.parse(String(modelRaw || '').trim() || '{}')
    } catch {
      throw new Error('nn-console: nn-model slot holds corrupt JSON')
    }
    if (!isObject(schema) || !isObject(model)) {
      throw new Error('nn-console: slots must decode to JSON objects')
    }
    return { schema: schema, model: model }
  }

  // The nn-model slot (`<script type="application/x-nn-deflate-base64">`) holds the
  // payload JSON compressed with deflate-raw and encoded as base64: one format, no plain
  // JSON reader. The browser decodes it once, asynchronously, before the synchronous
  // `boot`; the decoded text is kept per document so a snapshot save starts from it.
  // Drafts and UI state live in the plain JSON nn-drafts slot instead.
  var MODEL_SLOT_TYPE = 'application/x-nn-deflate-base64'
  var decodedModels = typeof WeakMap === 'function' ? new WeakMap() : null

  function base64ToBytes(text) {
    var binary = atob(String(text).replace(/\s+/g, ''))
    var bytes = new Uint8Array(binary.length)
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  function bytesToBase64(bytes) {
    var parts = []
    for (var i = 0; i < bytes.length; i += 0x8000) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)))
    }
    return btoa(parts.join(''))
  }

  function compressionUnsupported(api) {
    var err = new Error(
      'This console cannot open in this browser: it needs ' +
        api +
        ' to read its embedded data. ' +
        'Open the file in a current version of Chrome, Edge, Firefox or Safari.',
    )
    err.code = 'NN_COMPRESSION_UNSUPPORTED'
    return err
  }

  /** Decodes the text of an nn-model slot to the payload JSON text ('' for an empty slot). */
  function decodeModelText(encoded) {
    var text = String(encoded == null ? '' : encoded).trim()
    if (text === '') return Promise.resolve('')
    if (typeof DecompressionStream !== 'function' || typeof Response !== 'function') {
      return Promise.reject(compressionUnsupported('DecompressionStream'))
    }
    var corrupt = function () {
      return new Error('nn-console: nn-model slot holds corrupt compressed data')
    }
    var bytes
    try {
      bytes = base64ToBytes(text)
    } catch {
      return Promise.reject(corrupt())
    }
    return Promise.resolve()
      .then(function () {
        var stream = new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'))
        return new Response(stream).text()
      })
      .catch(function () {
        throw corrupt()
      })
  }

  /** Encodes payload JSON text the way the exporter writes the nn-model slot. */
  function encodeModelText(json) {
    if (typeof CompressionStream !== 'function' || typeof Response !== 'function') {
      return Promise.reject(compressionUnsupported('CompressionStream'))
    }
    return Promise.resolve().then(function () {
      var stream = new Response(String(json)).body.pipeThrough(new CompressionStream('deflate-raw'))
      return new Response(stream).arrayBuffer().then(function (buffer) {
        return bytesToBase64(new Uint8Array(buffer))
      })
    })
  }

  /** Decodes the document's nn-model slot and remembers the result for `boot`. */
  function decodeModelSlot(doc) {
    var active = doc || (typeof document !== 'undefined' ? document : null)
    if (!active) return Promise.reject(new Error('nn-console: no document to decode'))
    return decodeModelText(slotText(active, 'nn-model')).then(function (text) {
      if (decodedModels) decodedModels.set(active, text)
      return text
    })
  }

  /** The decoded payload JSON text of the document's nn-model slot ('' when the slot is empty). */
  function modelSlotText(doc) {
    if (decodedModels && decodedModels.has(doc)) return decodedModels.get(doc)
    if (slotText(doc, 'nn-model') === '') return ''
    throw new Error(
      'nn-console: the nn-model slot is compressed; await decodeModelSlot(document) before boot()',
    )
  }

  /** The nn-drafts slot: `{ drafts, uiState }` in plain JSON, `{}` when the console is fresh. */
  function parseDraftsSlot(raw) {
    var text = String(raw == null ? '' : raw).trim()
    if (text === '') return {}
    var parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('nn-console: nn-drafts slot holds corrupt JSON')
    }
    if (!isObject(parsed)) {
      throw new Error('nn-console: the nn-drafts slot must decode to a JSON object')
    }
    return parsed
  }

  /** A visible message in place of a blank page when the console cannot start. */
  function showBootError(doc, err) {
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null
    var box = doc.getElementById('nn-boot-error') || doc.createElement('div')
    box.id = 'nn-boot-error'
    box.className = 'nn-boot-error'
    box.setAttribute('role', 'alert')
    if (box.style) {
      box.style.cssText =
        'margin:24px;padding:16px 20px;border:1px solid #b91c1c;border-radius:8px;' +
        'background:#fef2f2;color:#7f1d1d;font:15px/1.5 system-ui,sans-serif'
    }
    var message = (err && err.message) || String(err)
    box.textContent =
      err && err.code === 'NN_COMPRESSION_UNSUPPORTED'
        ? message
        : 'The console could not start: ' + message
    if (!box.parentNode) doc.body.insertBefore(box, doc.body.firstChild)
    return box
  }

  function resolveElementId(concept, name) {
    return slugify(String(concept || '') + ' ' + String(name || ''))
  }

  function getElementEffectiveTags(element) {
    if (!element) return []
    if (Array.isArray(element.tags)) {
      return element.tags.map(function (t) {
        return String(t).toLowerCase()
      })
    }
    var tags = []
    if (element.fields && element.fields.tags) {
      if (Array.isArray(element.fields.tags)) tags = tags.concat(element.fields.tags)
      else if (typeof element.fields.tags === 'string')
        tags = tags.concat(
          element.fields.tags.split(',').map(function (s) {
            return s.trim()
          }),
        )
    }
    if (element.inherited && element.inherited.tags && element.inherited.tags.value) {
      var inh = element.inherited.tags.value
      if (Array.isArray(inh)) tags = tags.concat(inh)
      else if (typeof inh === 'string')
        tags = tags.concat(
          inh.split(',').map(function (s) {
            return s.trim()
          }),
        )
    }
    var seen = {}
    return tags
      .map(function (t) {
        return String(t).toLowerCase()
      })
      .filter(function (t) {
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

  // ponytail: flat boolean model by design. Reopen if someone needs (a AND b) OR c.
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
        var val = t
          .slice(colonIdx + 1)
          .replace(/^["']|["']$/g, '')
          .toLowerCase()
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
  // (trim + lowercase), mirroring nn-core schema/field-values.ts valueKey.
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
    if (
      (v === null || v === '' || v === undefined) &&
      el.inherited &&
      typeof el.inherited === 'object'
    ) {
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
        .filter(function (r) {
          return r && String(r.field || '').toLowerCase() === lkey
        })
        .map(function (r) {
          return r.targetLabel || r.target || ''
        })
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
      else if (opVal === 'changed')
        isMatch = !!(reviewedMap[el.id] && reviewedMap[el.id] !== el.hash)
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
      .map(function (s) {
        return s.trim()
      })
      .filter(function (s) {
        return s !== ''
      })
    if (anyTokens.length === 0) return true
    var isArrayValue = Array.isArray(actual)
    var actualStr = String(actual).toLowerCase()
    var matched = anyTokens.some(function (tok) {
      if (tok.length > 1 && (tok.charAt(0) === '>' || tok.charAt(0) === '<')) {
        var isGte = tok.slice(0, 2) === '>='
        var isLte = tok.slice(0, 2) === '<='
        var prefixLen = isGte || isLte ? 2 : 1
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
        return actual.some(function (v) {
          return valueKey(v) === tv
        })
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
    var hasExplicitLogic =
      parsed.groups.some(function (g) {
        return g.length > 1
      }) ||
      query.indexOf('(') !== -1 ||
      /\bOR\b/i.test(query)

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

  function cleanRefValue(raw) {
    var s = String(raw == null ? '' : raw).trim()
    if (s.slice(0, 2) === '[[' && s.slice(-2) === ']]') s = s.slice(2, -2).trim()
    // A typed reference is written as an address (`@<slug>`): the `@` names the
    // document itself and is not part of the slug. The wikilink strip above is
    // only tolerance for a payload already on disk (the validator rejects it).
    if (s.slice(0, 1) === '@') s = s.slice(1).trim()
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

  // The parent tree of a model's elements, children in document order. Procedure steps are
  // never walked here: their graph and run state come from nn-core `procedureGraph` /
  // `foldRun`, computed at export time (`model.procedureGraphs`, render-procedure-stepper.js).
  function buildTree(elements) {
    var nodes = {}
    var roots = []
    var rawList = Array.isArray(elements) ? elements : []
    rawList.forEach(function (el, idx) {
      if (!el || !el.id) return
      nodes[el.id] = {
        el: el,
        docOrder: idx,
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
    roots.sort(function (a, b) {
      return a.docOrder - b.docOrder
    })
    roots.forEach(function (root) {
      root.children.sort(function (a, b) {
        return a.docOrder - b.docOrder
      })
    })
    return { nodes: nodes, roots: roots }
  }

  function chainOf(root) {
    if (!root) return []
    return [root].concat(root.children || [])
  }

  // ---- Charts (shared console capability) ----
  // The runtime renders charts from pure-data series only: `compileChartSeries`
  // maps nn-model.series{chartId:number[]} into chart-ready xs/ys arrays and
  // never executes slot JavaScript. `monthAxis` derives the x-axis month window
  // from meta.months / historyMonths / startMonth / startYear. Missing series
  // for a declared chartId degrade to a console warning (chart skipped); the
  // rest of the sheet still renders.

  function compileChartSeries(series, meta) {
    return Studio.compileChartSeries(series, meta)
  }

  function monthAxis(meta, count) {
    return Studio.monthAxis(meta, count)
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

  // Transient message for feedback and notifications.
  // Replaces any previous toast instead of stacking them.
  function showToast(doc, message, tone) {
    if (!doc || !doc.body || typeof doc.createElement !== 'function') return null
    var old = doc.querySelector('[data-nn="toast"]')
    if (old && old.parentNode) old.parentNode.removeChild(old)
    var toast = doc.createElement('div')
    toast.setAttribute('data-nn', 'toast')
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status')
    toast.className = 'nn-toast'
    var bg = tone === 'error' ? '#7f1d1d' : '#171717'
    toast.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:10000;max-width:380px;padding:10px 16px;' +
      'border-radius:6px;background:' +
      bg +
      ';color:#ffffff;font-size:13px;font-weight:500;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;' +
      'font-family:var(--nn-font, sans-serif);line-height:1.4;'
    toast.textContent = String(message)
    doc.body.appendChild(toast)
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast)
    }, 4500)
    return toast
  }

  function notifyStoreError(doc, err) {
    showToast(
      doc,
      'Your change could not be saved (browser storage is full or blocked). It stays in this tab only: export your changes now.' +
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

  // The console header (`.nn-navbar`) carries the model identity: the title in
  // `#nn-domain-title` (the single model's title when scoped, else `meta.title`),
  // an optional `.nn-scope-label`, and an extra meta line in `#nn-navbar-extra`
  // (Template, Version, Generated). Every value is rendered as text, so a hostile
  // title stays inert; a field absent from `meta` is omitted, never a placeholder.
  function renderNavbarIdentity(doc, meta) {
    meta = meta || {}
    var models = Array.isArray(meta.models) ? meta.models : []
    var titleEl = doc.getElementById('nn-domain-title')
    if (titleEl) {
      var singleTitle =
        models.length === 1 && models[0] && models[0].title ? String(models[0].title) : ''
      var title = singleTitle || String(meta.title || meta.model || 'iNNfo Console')
      // A whole-domaiNN console titles itself "<model> Domain" (export-console).
      // The header reads better as just "<model>"; the domain record and the
      // changeset title keep the full "<model> Domain" elsewhere.
      var domainModel = meta.model != null ? String(meta.model) : ''
      if (
        !singleTitle &&
        domainModel &&
        title.toLowerCase() === (domainModel + ' domain').toLowerCase()
      ) {
        title = domainModel
      }
      titleEl.textContent = title
    }

    var label = meta.consoleScope && meta.consoleScope.label
    var labelEl = doc.querySelector('.nn-scope-label')
    if (label) {
      if (!labelEl) {
        labelEl = doc.createElement('span')
        labelEl.className = 'nn-scope-label'
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

    var host = doc.getElementById('nn-navbar-extra')
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
        var infoBtn = doc.createElement('button')
        infoBtn.className = 'nn-navbar-info-btn'
        infoBtn.type = 'button'
        infoBtn.setAttribute('aria-label', 'Domain info')
        infoBtn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'

        var popover = doc.createElement('div')
        popover.className = 'nn-navbar-info-popover'
        popover.style.display = 'none'

        var popoverLines = []
        if (template)
          popoverLines.push('<div><strong>Template:</strong> ' + String(template) + '</div>')
        if (version)
          popoverLines.push('<div><strong>Version:</strong> ' + String(version) + '</div>')
        if (meta.generated) {
          var stamp = String(meta.generated)
            .replace('T', ' ')
            .replace(/\..*/, '')
            .replace(/Z$/, '')
            .trim()
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

        var brand = doc.querySelector('.nn-brand')
        if (brand && !brand.querySelector('.nn-navbar-info-btn')) {
          brand.style.position = 'relative'
          brand.appendChild(infoBtn)
          brand.appendChild(popover)
        }
      }
      if (meta.sourceUrl) {
        var href = safeSourceHref(meta.sourceUrl)
        if (href) {
          var link = doc.createElement('a')
          link.className = 'nn-source-link'
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
    chip.className = 'nn-reviewer-chip'
    var label = doc.createElement('span')
    label.className = 'nn-reviewer-label'
    label.textContent = 'Reviewer'
    var input = doc.createElement('input')
    input.className = 'nn-reviewer-name'
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

  // A draft lives only in this console until it is exported: the count in the button
  // label was a quiet number, and the toast is transient by design. While the store
  // is non-empty the Changes button is the durable signal (red + pulse, the pulse is
  // decoration) and `beforeunload` asks before the tab takes those drafts with it.
  // Both read the store count, never a per-model flag, so every view that proposes
  // through `ctx.store` gets the same treatment.
  var UNSENT_GUARD_KEY = '__nnUnsentUnloadGuard'

  function applyUnsentSignal(doc, count) {
    var btn = doc && doc.getElementById ? doc.getElementById('nn-feedback-open') : null
    if (!btn) return
    if (count > 0) {
      btn.setAttribute('data-nn-unsent', 'true')
      btn.setAttribute(
        'title',
        count === 1
          ? '1 unsent change lives only in this console until you export it. Changes · opens the export.'
          : count +
              ' unsent changes live only in this console until you export them. Changes · opens the export.',
      )
    } else {
      btn.removeAttribute('data-nn-unsent')
      btn.removeAttribute('title')
    }
  }

  // Armed while the store is non-empty and released when it empties, so the warning
  // describes the current state instead of staying latched on a stale count.
  function setUnloadGuard(win, armed) {
    if (!win || typeof win.addEventListener !== 'function') return
    var current = win[UNSENT_GUARD_KEY]
    if (armed && !current) {
      current = function (ev) {
        if (!ev) return ''
        if (typeof ev.preventDefault === 'function') ev.preventDefault()
        // Engines read `returnValue`; a programmatic dispatch in a test reads neither.
        ev.returnValue = ''
        return ''
      }
      win[UNSENT_GUARD_KEY] = current
      win.addEventListener('beforeunload', current)
      return
    }
    if (!armed && current) {
      win.removeEventListener('beforeunload', current)
      win[UNSENT_GUARD_KEY] = null
    }
  }

  function renderBanner(doc, meta, needs, draftCount, onReviewerChange, state) {
    var banner = doc.getElementById('nn-feedback-banner') || doc.getElementById('nn-banner')
    if (!banner) return
    var existingOpen =
      doc.getElementById('nn-feedback-open') || doc.getElementById('nn-export-open')
    banner.innerHTML = ''
    var title = el('span', 'nn-banner-title', null)
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
    var version = el('span', 'nn-banner-version', ' ' + domainModelVersion(meta))
    var draftsBadge = el('span', 'nn-banner-drafts', ' unsent: ' + (draftCount || 0))
    draftsBadge.setAttribute('data-nn', 'draft-count')

    banner.appendChild(title)
    banner.appendChild(version)
    banner.appendChild(draftsBadge)

    // No store-level staleness: staleness is per draft (`base_hash`), surfaced by
    // the review tab, never by the banner.

    // Reviewer identity: an inline editable field in the header (no emoji, no
    // separate modal — the input itself signals editability).
    banner.appendChild(buildReviewerChip(doc))

    if (existingOpen) {
      existingOpen.textContent = 'Changes · ' + (draftCount || 0)
      if (!existingOpen.parentNode || existingOpen.parentNode === banner)
        banner.appendChild(existingOpen)
    } else if (banner.id === 'nn-feedback-banner') {
      var openBtn = el(
        'button',
        'nn-feedback-open nn-navbar-action-btn',
        'Changes · ' + (draftCount || 0),
      )
      if (openBtn) {
        openBtn.id = 'nn-feedback-open'
        openBtn.setAttribute('type', 'button')
        if (state) {
          openBtn.setAttribute('data-nn-bound', '1')
          openBtn.addEventListener('click', function () {
            openExportModal(doc, state)
          })
        }
        banner.appendChild(openBtn)
      }
    }
    applyUnsentSignal(doc, draftCount)
  }

  function renderFilterBar(doc, state, onQueryChange, activeQuery, sortState, onSortChange) {
    var host = doc.getElementById('nn-filter-facets')
    var activeHost = doc.getElementById('nn-active-filters')
    if (!host) return
    host.innerHTML = ''
    if (activeHost) activeHost.innerHTML = ''

    var models = state && state.meta && Array.isArray(state.meta.models) ? state.meta.models : []
    var filterModelId =
      (state && (state.modelId || (state.meta && (state.meta.modelId || state.meta.model)))) || ''
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
        if (
          (op.key === key || (key === 'model' && op.key === 'file')) &&
          op.val.toLowerCase() === lowerVal
        ) {
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
      var mWrap = el('div', 'nn-facet-dropdown')
      var mBtn = el('button', 'nn-facet-btn' + (activeModels.length > 0 ? ' active' : ''))
      mBtn.setAttribute('type', 'button')
      var mIcon = typeof nnIcons !== 'undefined' ? nnIcons.getSvg('file-text', { size: 14 }) : '📄'
      var mLabel = activeModels.length > 0 ? 'Models (' + activeModels.length + ')' : 'Models'
      mBtn.innerHTML =
        mIcon + ' <span>' + mLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var mMenu = el('div', 'nn-facet-menu')
      models.forEach(function (m) {
        var item = el('label', 'nn-facet-item')
        var cb = el('input', 'nn-facet-checkbox')
        cb.type = 'checkbox'
        var mMatchKey = (m.id || m.filePath || '').toLowerCase()
        var isChecked = activeModels.some(function (am) {
          return (
            am === mMatchKey ||
            (m.filePath && am === m.filePath.toLowerCase()) ||
            (m.id && am === m.id.toLowerCase())
          )
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
        var cntBadge = el(
          'span',
          'badge badge-xs badge-ghost font-mono',
          String(m.elementCount || 0),
        )

        item.appendChild(cb)
        item.appendChild(mUnit)
        item.appendChild(cntBadge)
        mMenu.appendChild(item)
      })

      mBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = mMenu.classList.contains('open')
        doc.querySelectorAll('.nn-facet-menu').forEach(function (menu) {
          menu.classList.remove('open')
        })
        if (!isOpen) mMenu.classList.add('open')
      })

      if (activeModels.length > 0) {
        var mClear = el('span', 'nn-facet-clear', '×')
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
      Object.keys(conceptCounts)
        .sort()
        .forEach(function (cName) {
          allConcepts.push({ name: cName, count: conceptCounts[cName] })
        })
    }

    if (allConcepts.length > 0) {
      var cWrap = el('div', 'nn-facet-dropdown')
      var cBtn = el('button', 'nn-facet-btn' + (activeConcepts.length > 0 ? ' active' : ''))
      cBtn.setAttribute('type', 'button')
      var cIcon = typeof nnIcons !== 'undefined' ? nnIcons.getSvg('layers', { size: 14 }) : '🏷️'
      var cLabel =
        activeConcepts.length > 0 ? 'Concepts (' + activeConcepts.length + ')' : 'Concepts'
      cBtn.innerHTML =
        cIcon + ' <span>' + cLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var cMenu = el('div', 'nn-facet-menu')
      allConcepts.forEach(function (c) {
        var item = el('label', 'nn-facet-item')
        var cb = el('input', 'nn-facet-checkbox')
        cb.type = 'checkbox'
        var isChecked = activeConcepts.indexOf(c.name.toLowerCase()) !== -1
        cb.checked = isChecked

        cb.addEventListener('change', function () {
          toggleFacet('concept', c.name, cb.checked)
        })

        var cMetaFacet = conceptMetaOf(
          (state && state.schema && state.schema.concepts) || (state && state.concepts),
          c.name,
        )
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
        doc.querySelectorAll('.nn-facet-menu').forEach(function (menu) {
          menu.classList.remove('open')
        })
        if (!isOpen) cMenu.classList.add('open')
      })

      if (activeConcepts.length > 0) {
        var cClear = el('span', 'nn-facet-clear', '×')
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
      if (ef && typeof ef === 'object' && !Array.isArray(ef) && ef[fName] !== undefined)
        return ef[fName]
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
        if (
          fieldCounts[normKey] ||
          fieldNames.some(function (fn) {
            return fn.toLowerCase() === normKey
          })
        ) {
          activeFieldCount++
        }
      })

      var fWrap = el('div', 'nn-facet-dropdown')
      var fBtn = el('button', 'nn-facet-btn' + (activeFieldCount > 0 ? ' active' : ''))
      fBtn.setAttribute('type', 'button')
      var fIcon =
        typeof nnIcons !== 'undefined'
          ? nnIcons.getSvg('sliders', { size: 14 }) || nnIcons.getSvg('tag', { size: 14 })
          : '🏷️'
      var fLabel = activeFieldCount > 0 ? 'Fields (' + activeFieldCount + ')' : 'Fields'
      fBtn.innerHTML =
        fIcon + ' <span>' + fLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var fMenu = el('div', 'nn-facet-menu')
      fMenu.style.minWidth = '240px'

      function fieldValueRows(fName) {
        var rows = el('div', 'nn-facet-values')
        var def = declaredFieldDef(fName)
        var observed = observedValues(fName)
        var declared =
          def && Array.isArray(def.options) && def.options.length ? def.options.map(String) : null
        var isBoolean = !!(def && String(def.type || '') === 'boolean')
        var options = isBoolean ? ['true', 'false'] : declared || Object.keys(observed).sort()
        var isChecked = function (valKey) {
          return parsed.operators.some(function (op) {
            var normKey = op.key.replace(/^[!-]/, '').toLowerCase()
            return (
              normKey === fName.toLowerCase() &&
              String(op.val).toLowerCase() === String(valKey).toLowerCase()
            )
          })
        }
        options.slice(0, 200).forEach(function (valKey) {
          var item = el('label', 'nn-facet-item')
          var cb = el('input', 'nn-facet-checkbox')
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
            item.appendChild(
              el('span', 'badge badge-xs badge-ghost font-mono', String(observed[valKey])),
            )
          }
          rows.appendChild(item)
        })
        if (!isBoolean && !declared) {
          // Free text covers values outside the declared vocabulary; the grammar takes
          // `a|b` for OR inside one token.
          var entry = el('div', 'nn-facet-item')
          var input = el('input', 'nn-facet-input')
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
        var back = el('button', 'nn-facet-back', '\u2190 Fields')
        back.setAttribute('type', 'button')
        back.addEventListener('click', function (ev) {
          ev.stopPropagation()
          renderFieldList()
        })
        fMenu.appendChild(back)
        fMenu.appendChild(
          el(
            'div',
            'text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1 border-b border-slate-100',
            fName,
          ),
        )
        fMenu.appendChild(fieldValueRows(fName))
      }

      function renderFieldList() {
        fMenu.innerHTML = ''
        fieldNames.forEach(function (fName) {
          var item = el('button', 'nn-facet-item')
          item.setAttribute('type', 'button')
          item.appendChild(el('span', 'flex-1 truncate font-medium text-slate-700', fName))
          item.appendChild(
            el('span', 'badge badge-xs badge-ghost font-mono', String(fieldCounts[fName] || 0)),
          )
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
        doc.querySelectorAll('.nn-facet-menu').forEach(function (menu) {
          menu.classList.remove('open')
        })
        if (!isOpen) {
          renderFieldList()
          fMenu.classList.add('open')
        }
      })

      if (activeFieldCount > 0) {
        var fClear = el('span', 'nn-facet-clear', '×')
        fClear.setAttribute('role', 'button')
        fClear.setAttribute('title', 'Clear fields filter')
        fClear.addEventListener('click', function (e) {
          e.stopPropagation()
          var newOps = parsed.operators.filter(function (op) {
            var normKey = op.key.replace(/^[!-]/, '').toLowerCase()
            return (
              !fieldCounts[normKey] &&
              !fieldNames.some(function (fn) {
                return fn.toLowerCase() === normKey
              })
            )
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
      var clearBtn = el(
        'button',
        'btn btn-ghost btn-xs text-xs text-slate-500 hover:text-error',
        'Clear filters',
      )
      clearBtn.setAttribute('type', 'button')
      clearBtn.addEventListener('click', function () {
        if (typeof onQueryChange === 'function') onQueryChange('')
      })
      host.appendChild(clearBtn)
    }

    // 5. Sort Dropdown (available across all explorer view modes)
    if (
      state &&
      Array.isArray(state.elements) &&
      state.elements.length > 0 &&
      typeof onSortChange === 'function'
    ) {
      var sWrap = el('div', 'nn-facet-dropdown nn-sort-dropdown')
      sWrap.style.marginLeft = 'auto'

      var isSorted = Boolean(sortState && sortState.key)
      var sBtn = el('button', 'nn-facet-btn' + (isSorted ? ' active' : ''))
      sBtn.setAttribute('type', 'button')
      sBtn.id = 'nn-sort-btn'

      var sortIconName = !isSorted
        ? 'arrow-up-down'
        : sortState.dir === 'desc'
          ? 'arrow-down'
          : 'arrow-up'
      var sIcon = typeof nnIcons !== 'undefined' ? nnIcons.getSvg(sortIconName, { size: 14 }) : '⇅'
      var sLabel = isSorted
        ? 'Sort: ' + sortState.key + (sortState.dir === 'desc' ? ' ↓' : ' ↑')
        : 'Sort'
      sBtn.innerHTML =
        sIcon + ' <span>' + sLabel + '</span> <span style="font-size: 10px;">▼</span>'

      var sMenu = el('div', 'nn-facet-menu nn-sort-menu')
      sMenu.style.right = '0'
      sMenu.style.left = 'auto'
      sMenu.style.minWidth = '220px'

      // Direction selector
      var dirHeader = el(
        'div',
        'text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-1 border-b border-slate-100 flex items-center justify-between',
      )
      var dirTitle = el('span', null, 'Direction')
      dirHeader.appendChild(dirTitle)

      var dirGroup = el('div', 'inline-flex gap-1')
      var ascBtn = el(
        'button',
        'btn btn-xs ' +
          (!sortState || sortState.dir !== 'desc' ? 'btn-primary' : 'btn-ghost text-slate-500'),
        '↑ Asc',
      )
      ascBtn.setAttribute('type', 'button')
      ascBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        onSortChange(sortState && sortState.key ? sortState.key : 'name', 'asc')
      })

      var descBtn = el(
        'button',
        'btn btn-xs ' +
          (sortState && sortState.dir === 'desc' ? 'btn-primary' : 'btn-ghost text-slate-500'),
        '↓ Desc',
      )
      descBtn.setAttribute('type', 'button')
      descBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        onSortChange(sortState && sortState.key ? sortState.key : 'name', 'desc')
      })

      dirGroup.appendChild(ascBtn)
      dirGroup.appendChild(descBtn)
      dirHeader.appendChild(dirGroup)
      sMenu.appendChild(dirHeader)

      // Section: Fields
      var fieldSectionHeader = el(
        'div',
        'text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-2 pb-1 border-b border-slate-100',
        'Sort By Field',
      )
      sMenu.appendChild(fieldSectionHeader)

      var baseSortOptions = [
        { key: '', label: 'Default (Document order)' },
        { key: 'name', label: 'Name' },
        { key: 'concept', label: 'Concept' },
        { key: 'tags', label: 'Tags' },
      ]

      var sortFields = []
      if (Array.isArray(fieldNames)) {
        fieldNames.forEach(function (fn) {
          if (fn !== 'name' && fn !== 'concept' && fn !== 'tags') {
            sortFields.push(fn)
          }
        })
      }

      var allSortOptions = baseSortOptions.concat(
        sortFields.map(function (fn) {
          return { key: fn, label: fn }
        }),
      )

      allSortOptions.forEach(function (opt) {
        var item = el('button', 'nn-facet-item w-full text-left flex items-center justify-between')
        item.setAttribute('type', 'button')
        var isCurrent =
          (sortState && sortState.key === opt.key) ||
          ((!sortState || !sortState.key) && opt.key === '')
        if (isCurrent) {
          item.classList.add('bg-slate-50', 'font-bold')
        }

        var labelSpan = el(
          'span',
          'flex-1 truncate ' + (isCurrent ? 'text-primary font-bold' : 'text-slate-700'),
          opt.label,
        )
        item.appendChild(labelSpan)

        if (isCurrent && opt.key !== '') {
          var checkSpan = el(
            'span',
            'text-xs text-primary font-bold ml-1',
            sortState.dir === 'desc' ? '↓' : '↑',
          )
          item.appendChild(checkSpan)
        }

        item.addEventListener('click', function (e) {
          e.stopPropagation()
          sMenu.classList.remove('open')
          if (opt.key === '') {
            onSortChange(null)
          } else {
            var newDir =
              sortState && sortState.key === opt.key && sortState.dir === 'asc'
                ? 'desc'
                : sortState && sortState.dir
                  ? sortState.dir
                  : 'asc'
            onSortChange(opt.key, newDir)
          }
        })
        sMenu.appendChild(item)
      })

      sBtn.addEventListener('click', function (e) {
        e.stopPropagation()
        var isOpen = sMenu.classList.contains('open')
        doc.querySelectorAll('.nn-facet-menu').forEach(function (menu) {
          menu.classList.remove('open')
        })
        if (!isOpen) sMenu.classList.add('open')
      })

      if (isSorted) {
        var sClear = el('span', 'nn-facet-clear', '×')
        sClear.setAttribute('role', 'button')
        sClear.setAttribute('title', 'Clear sorting')
        sClear.addEventListener('click', function (e) {
          e.stopPropagation()
          onSortChange(null)
        })
        sBtn.appendChild(sClear)
      }

      sWrap.appendChild(sBtn)
      sWrap.appendChild(sMenu)
      host.appendChild(sWrap)
    }

    // 4. Render Active Filter Pills grouped by Boolean Clause (with explicit AND / OR connectors)
    if (activeHost && (parsed.operators.length > 0 || parsed.textTokens.length > 0)) {
      var schemaConcepts =
        (state && state.concepts && state.concepts.length
          ? state.concepts
          : state && state.schema && state.schema.concepts) ||
        allConcepts.map(function (c) {
          return c.name
        })

      function renderAtomPill(atom) {
        var pill = el(
          'span',
          'nn-active-filter-pill badge badge-sm badge-outline gap-1.5 text-[11px] py-2 px-2.5 bg-base-100',
        )
        if (atom.type === 'text') {
          pill.classList.add('font-mono')
          pill.appendChild(el('span', null, '"' + atom.val + '"'))
          var removeBtn = el(
            'button',
            'nn-filter-pill-remove ml-1 hover:text-error cursor-pointer font-bold',
            '×',
          )
          removeBtn.setAttribute('type', 'button')
          removeBtn.addEventListener('click', function (e) {
            e.stopPropagation()
            var nextTokens = parsed.textTokens
              .filter(function (t) {
                return t !== atom.val
              })
              .map(function (t) {
                return t.indexOf(' ') !== -1 ? '"' + t + '"' : t
              })
            var nextQuery = nextTokens
              .concat(
                parsed.operators.map(function (o) {
                  return o.raw || formatFacetToken(o.key, o.val)
                }),
              )
              .join(' ')
            if (typeof onQueryChange === 'function') onQueryChange(nextQuery)
          })
          pill.appendChild(removeBtn)
          return pill
        }

        var op = atom
        pill.setAttribute('data-filter-key', String(op.key))
        if (op.key === 'concept' || op.key === '!concept') {
          var cMeta = conceptMetaOf(schemaConcepts, op.val)
          pill.classList.add('nn-active-filter-pill--concept')
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
          pill.classList.add('nn-active-filter-pill--model')
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
          if (
            String(op.key).replace(/^[!-]/, '').toLowerCase() === 'is' &&
            KNOWN_IS_VALUES.indexOf(String(op.val).toLowerCase()) === -1
          ) {
            pill.setAttribute('data-filter-invalid', 'true')
            pill.setAttribute(
              'title',
              'Unknown is: value "' +
                op.val +
                '" matches nothing (known: ' +
                KNOWN_IS_VALUES.join(', ') +
                ')',
            )
          }
        }
        var removeBtn = el(
          'button',
          'nn-filter-pill-remove ml-1 hover:text-error cursor-pointer font-bold',
          '×',
        )
        removeBtn.setAttribute('type', 'button')
        removeBtn.setAttribute('aria-label', 'Remove filter ' + op.key)
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation()
          toggleFacet(op.key, op.val, false)
        })
        pill.appendChild(removeBtn)
        return pill
      }

      var displayGroups =
        parsed.groups.length > 0
          ? parsed.groups
          : [
              parsed.operators.concat(
                parsed.textTokens.map(function (t) {
                  return { type: 'text', val: t }
                }),
              ),
            ]

      // ponytail: flat boolean model by design. Clauses join with AND, atoms with OR.
      function serializeGroups(groups) {
        return groups
          .map(function (clause) {
            var clauseStr = clause
              .map(function (atom) {
                return (
                  atom.raw ||
                  (atom.type === 'operator'
                    ? formatFacetToken(atom.key, atom.val)
                    : '"' + atom.val + '"')
                )
              })
              .join(' OR ')
            return clause.length > 1 ? '(' + clauseStr + ')' : clauseStr
          })
          .join(' AND ')
      }

      function createConnectorSelect(currentVal, onChange) {
        // A segmented control, matching the rest of the console (was a native <select>).
        var group = el('span', 'nn-op-toggle')
        group.setAttribute('role', 'group')
        group.setAttribute('aria-label', 'Combine with')
        // The AND/OR explanation, on hover only.
        group.setAttribute(
          'title',
          'Fields and text combine with AND; within one token a|b is OR. Model and Concept combine with OR. Inside one Field token, a|b matches any of the listed values.',
        )
        ;['AND', 'OR'].forEach(function (val) {
          var b = el('button', 'nn-op-btn' + (val === currentVal ? ' active' : ''), val)
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
          ? el(
              'span',
              'inline-flex items-center gap-1.5 p-1 bg-slate-50 border border-dashed border-slate-300 rounded-lg',
            )
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
        doc.querySelectorAll('.nn-facet-menu').forEach(function (m) {
          m.classList.remove('open')
        })
      })
    }
  }

  function formatFacetToken(key, val) {
    var s = String(val == null ? '' : val)
    return key + ':' + (s.indexOf(' ') !== -1 ? '"' + s + '"' : s)
  }

  // Flattens the domaiNN's models into rail entries grouped by blueprint, so the
  // Knowledge rail is never a flat dump of every model. The key is the payload's own
  // `blueprint` (derived from each model's parent_spec, so it always exists); nothing
  // here knows about a specific domaiNN. A group entry is emitted only when the
  // domaiNN has more than one blueprint, so a single-blueprint console keeps today's
  // flat list.
  // ponytail: one grouping level only. Ceiling — a domaiNN whose models all share one
  // blueprint still renders one long group; upgrade = a second nested axis (concept or
  // path) or a registered custom view.
  function flattenBlueprintGroups(models) {
    var input = Array.isArray(models) ? models : []
    var order = []
    var byKey = {}
    input.forEach(function (m) {
      var key = String((m && (m.blueprint || m.family)) || '').trim()
      if (!key) key = 'Other'
      if (!byKey[key]) {
        byKey[key] = []
        order.push(key)
      }
      byKey[key].push(m)
    })
    if (order.length <= 1) {
      return input.map(function (m) {
        return { kind: 'model', model: m }
      })
    }
    order.sort(function (a, b) {
      if (byKey[b].length !== byKey[a].length) return byKey[b].length - byKey[a].length
      return a < b ? -1 : a > b ? 1 : 0
    })
    var out = []
    order.forEach(function (key) {
      out.push({ kind: 'group', label: key, count: byKey[key].length })
      byKey[key].forEach(function (m) {
        out.push({ kind: 'model', model: m })
      })
    })
    return out
  }

  function renderRail(doc, concepts, counts, draftCountsByConcept, onSelect, state, activeQuery) {
    var rail = doc.getElementById('nn-rail')
    if (!rail) return
    rail.innerHTML = ''

    var queryStr =
      activeQuery !== undefined
        ? activeQuery
        : (doc.getElementById('nn-search') && doc.getElementById('nn-search').value) || ''
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
    // Per-model concept view: which concepts this model declares, and how many of its
    // own elements carry each one. The rail rows under a model must report that model's
    // numbers — the domaiNN-wide totals belong to the facet dropdown, not to a row that
    // hangs off one model.
    function conceptDataForModel(m) {
      var mid = String(m.id || m.filePath)
      var counts = {}
      var seen = {}
      var out = []
      ;(state && Array.isArray(state.elements) ? state.elements : []).forEach(function (e) {
        if (!e) return
        if (String(e.modelId || e.modelFile || '') !== mid) return
        if (!e.concept) return
        counts[e.concept] = (counts[e.concept] || 0) + 1
        if (!seen[e.concept]) {
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
      return { names: out, counts: counts }
    }

    var models =
      state && state.meta && Array.isArray(state.meta.models) && state.meta.models.length > 1
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
      // Each blueprint is an accordion section: collapsed at first, and (where the
      // browser honors <details name>) opening one closes the others, so a single
      // blueprint is on screen at a time. Without that support each section still
      // opens and closes on its own.
      var host = list
      flattenBlueprintGroups(models).forEach(function (entry) {
        if (entry.kind === 'group') {
          var groupLi = mk('li')
          var groupDetails = mk('details')
          if (groupDetails) {
            groupDetails.className = 'collapse collapse-arrow nn-rail-blueprint'
            if (groupDetails.setAttribute) groupDetails.setAttribute('name', 'nn-rail-blueprint')
            groupDetails.open = false
            var groupSummary = mk('summary')
            if (groupSummary) {
              groupSummary.className = 'collapse-title min-h-0 py-2 pr-8'
              groupSummary.textContent = entry.label + ' (' + entry.count + ')'
            }
            groupDetails.appendChild(groupSummary)
            var groupList = mk('ul')
            if (groupList) groupList.className = 'menu menu-xs p-2 w-full'
            groupDetails.appendChild(groupList)
            groupLi.appendChild(groupDetails)
            list.appendChild(groupLi)
            host = groupList
          }
          return
        }
        var m = entry.model
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
          el(
            'span',
            'nn-rail-count badge badge-ghost badge-xs',
            String(Number(m.elementCount) || 0),
          ),
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
        var modelConceptData = conceptDataForModel(m)
        var names = modelConceptData.names
        var modelConceptCounts = modelConceptData.counts
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
        var midLower = String(mid).toLowerCase()
        names.forEach(function (name) {
          var cli = mk('li')
          var a = mk('a')
          if (a) {
            a.setAttribute('data-concept', String(name))
            // A concept row hangs off ONE model, so it counts and filters WITHIN that
            // model. Reading the domaiNN-wide total here (and setting a bare
            // `concept:` facet on click) made every row show the same number and light
            // up every model's matching concept.
            var isActive =
              activeConcepts.indexOf(String(name).toLowerCase()) !== -1 &&
              (activeModels.length === 0 || activeModels.indexOf(midLower) !== -1)
            a.className = 'nn-rail-item' + (isActive ? ' active' : '')
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
              el(
                'span',
                'nn-rail-count badge badge-ghost badge-xs',
                String(Number(modelConceptCounts[name]) || 0),
              ),
            )
            a.addEventListener('click', function (e) {
              if (e && e.preventDefault) e.preventDefault()
              if (typeof onSelect === 'function') {
                // The row's model is a scope, not part of the toggle: add it only when
                // it is not selected yet, so clicking a sibling concept keeps the scope
                // and clearing the row never drops the model.
                var scoped = activeModels.indexOf(midLower) === -1
                onSelect(
                  (scoped ? formatFacetToken('model', mid) + ' ' : '') +
                    formatFacetToken('concept', name),
                )
              }
            })
          }
          cli.appendChild(a)
          sub.appendChild(cli)
        })
        details.appendChild(sub)

        li.appendChild(details)
        host.appendChild(li)
      })
      rail.appendChild(list)
      return
    }

    // Flat fallback (single-model console).
    var cHdr = el('div', 'nn-rail-header')
    cHdr.innerHTML = '<span>Concepts (' + (concepts ? concepts.length : 0) + ')</span>'
    rail.appendChild(cHdr)

    var list = mk('ul')
    if (list) list.className = 'menu menu-xs bg-base-100 p-2 w-full'
    var globalConcepts = Array.isArray(concepts) ? concepts : []
    var railModel =
      (state && (state.modelId || (state.meta && (state.meta.modelId || state.meta.model)))) || ''

    globalConcepts.forEach(function (concept, index) {
      var name = typeof concept === 'string' ? concept : concept.name
      var cli = mk('li')
      var a = mk('a')
      if (a) {
        var isActive = activeConcepts.indexOf(String(name).toLowerCase()) !== -1
        a.className = 'nn-rail-item' + (isActive ? ' active' : '')
        a.setAttribute('data-concept', String(name))
        var cMeta = conceptMetaOf(globalConcepts, name)
        var color = cMeta.hexColor
        a.setAttribute('data-concept-slot', String(cMeta.slot))
        if (color) a.style.setProperty('--rail-concept-color', color)
        a.appendChild(
          UI.Ku(
            'section',
            {
              model: railModel,
              concept: name,
              label: name,
              index: cMeta.index,
              color: cMeta.color,
            },
            { doc: doc },
          ),
        )
        a.appendChild(
          el(
            'span',
            'nn-rail-count badge badge-ghost badge-xs',
            String(Number(counts && counts[name]) || 0),
          ),
        )
        var draftCount = draftCountsByConcept ? draftCountsByConcept[name] || 0 : 0
        if (draftCount > 0) {
          var badge = el('span', 'nn-rail-badge badge badge-sm badge-neutral', String(draftCount))
          if (badge) {
            badge.setAttribute('title', draftCount + ' unsent change(s)')
            a.appendChild(badge)
          }
        }
        a.addEventListener('click', function (e) {
          if (e && e.preventDefault) e.preventDefault()
          if (typeof onSelect === 'function') onSelect(formatFacetToken('concept', name))
        })
      }
      cli.appendChild(a)
      list.appendChild(cli)
    })
    rail.appendChild(list)
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
      if (String(cname || '').toLowerCase() === target)
        return typeof c === 'string' ? { name: c } : c
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
        String(m.source || '').toLowerCase() === cname ||
        String(m.target || '').toLowerCase() === cname
      )
    })
  }

  function renderConceptGuide(doc, concept, schema, matrices, counts, modelId) {
    var layout = doc.getElementById('nn-layout')
    if (!layout) return
    var host = doc.getElementById('nn-concept-guide')
    if (!concept) {
      if (host && host.parentNode) host.parentNode.removeChild(host)
      return
    }
    if (!host) {
      host = el('aside', 'nn-guide')
      host.id = 'nn-concept-guide'
      host.setAttribute('aria-label', 'Concept guidance')
      layout.appendChild(host)
    }
    host.innerHTML = ''

    var name = concept.name || 'Concept'
    var gMeta = conceptMetaOf(schema && schema.concepts, name)
    var head = el('div', 'nn-guide-head')
    var badge =
      UI && typeof UI.Ku === 'function'
        ? UI.Ku(
            'section',
            {
              model: modelId || '',
              concept: name,
              label: name,
              index: gMeta.index,
              color: gMeta.color,
            },
            { doc: doc },
          )
        : el('span', 'nn-card-concept-badge badge badge-sm', name)
    head.appendChild(badge)

    var count = counts && counts[name] != null ? counts[name] : null
    if (count != null) {
      head.appendChild(
        el('span', 'nn-guide-meta', count + ' ' + (count === 1 ? 'element' : 'elements')),
      )
    }
    // Collapsible: the toggle lives in the head and survives re-renders because
    // the collapsed state is a class on the aside, not on the rebuilt children.
    var collapseBtn = el('button', 'nn-guide-collapse')
    collapseBtn.setAttribute('type', 'button')
    var setCollapsed = function (collapsed) {
      if (collapsed) host.classList.add('is-collapsed')
      else host.classList.remove('is-collapsed')
      collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      collapseBtn.setAttribute(
        'aria-label',
        collapsed ? 'Expand concept details' : 'Collapse concept details',
      )
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
    if (description) host.appendChild(el('p', 'nn-guide-desc', String(description)))

    var fields = guideFieldsFor(concept, schema)
    if (fields.length) {
      var fs = el('section', 'nn-guide-section')
      fs.appendChild(el('h4', 'nn-guide-title', 'Fields (' + fields.length + ')'))
      var fdl = el('dl', 'nn-guide-list nn-guide-field-list')
      fields.forEach(function (f) {
        if (!f) return
        var label = f.label || f.name
        if (label == null) return
        var dt = el('dt', 'nn-guide-field-dt')
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
        var dd = el('dd', 'nn-guide-field-dd')
        var fTypeStr = String(f.type || f.widget || 'string')
        var tBadge = el('span', 'nn-ku-field-type', fTypeStr)
        dd.appendChild(tBadge)
        if (f.multiple) dd.appendChild(el('span', 'nn-ku-field-multi', 'multi'))
        var targetC = f.target || f.targetConcept || null
        if (targetC) {
          var tcMeta = conceptMetaOf(schema && schema.concepts, targetC)
          dd.appendChild(
            UI.Ku(
              'section',
              {
                model: modelId || '',
                concept: targetC,
                label: targetC,
                index: tcMeta.index,
                color: tcMeta.color,
              },
              { doc: doc },
            ),
          )
        }
        if (f.description) dd.appendChild(el('p', 'nn-guide-field-desc', String(f.description)))
        fdl.appendChild(dt)
        fdl.appendChild(dd)
      })
      fs.appendChild(fdl)
      host.appendChild(fs)
    }

    var conceptVals =
      concept.conceptFields && typeof concept.conceptFields === 'object'
        ? concept.conceptFields
        : null
    if (!conceptVals && schema && schema.concepts) {
      var cMetaForVals = conceptMetaOf(schema.concepts, concept.name)
      if (cMetaForVals && cMetaForVals.conceptFields) conceptVals = cMetaForVals.conceptFields
    }
    if (conceptVals) {
      var cvKeys = Object.keys(conceptVals)
      if (cvKeys.length) {
        var cvs = el('section', 'nn-guide-section')
        cvs.appendChild(el('h4', 'nn-guide-title', 'Concept values'))
        var cvl = el('dl', 'nn-guide-list nn-guide-value-list')
        cvKeys.forEach(function (k) {
          var v = conceptVals[k]
          var cvDt = el('dt', 'nn-guide-field-dt')
          cvDt.appendChild(
            UI.Ku(
              'field',
              { family: modelId || '', concept: name, name: k, label: String(k) },
              { doc: doc },
            ),
          )
          var cvDd = el('dd', 'nn-guide-field-dd')
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
      var mts = el('section', 'nn-guide-section')
      mts.appendChild(el('h4', 'nn-guide-title', 'Matrices (' + matrixList.length + ')'))
      var mtl = el('ul', 'nn-guide-list nn-guide-matrix-list')
      matrixList.forEach(function (m) {
        if (!m) return
        var mli = el('li', 'nn-guide-matrix-item')
        var mLabel = String(m.name || m.source + ' \u2192 ' + m.target)
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
          var pairWrap = el('div', 'nn-guide-matrix-pair')
          var sMeta = conceptMetaOf(schema && schema.concepts, m.source)
          var tMeta = conceptMetaOf(schema && schema.concepts, m.target)
          pairWrap.appendChild(
            UI.Ku(
              'section',
              {
                model: modelId || '',
                concept: m.source,
                label: m.source,
                index: sMeta.index,
                color: sMeta.color,
              },
              { doc: doc },
            ),
          )
          pairWrap.appendChild(el('span', 'nn-guide-matrix-arrow', '⇄'))
          pairWrap.appendChild(
            UI.Ku(
              'section',
              {
                model: modelId || '',
                concept: m.target,
                label: m.target,
                index: tMeta.index,
                color: tMeta.color,
              },
              { doc: doc },
            ),
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
    var safeRaw =
      rawColor && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{2,20})$/.test(rawColor) ? rawColor : undefined
    var slot =
      UI && typeof UI.conceptSlot === 'function'
        ? UI.conceptSlot({ index: idx, color: safeRaw })
        : (idx % 12) + 1
    var hexColor =
      safeRaw && safeRaw.charAt(0) === '#'
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
        id: nd.element_id || 'new-' + nd.id,
        name: nd.element || 'New element',
        concept: nd.concept || 'New',
        description: nd.comment || 'New element, not applied yet',
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
    return s
      .replace(/_NN\.md$/i, '')
      .replace(/\.md$/i, '')
      .trim()
      .toLowerCase()
  }

  // The `meta.models[]` entry a knowledge value names (file stem, id or title), or
  // null. Full-path matches win over bare-name matches; a bare name shared by two
  // models is ambiguous and resolves to nothing rather than to the first match,
  // because guessing points the marker at a model the author never named.
  function resolveKnowledgeModel(meta, value) {
    var models = Array.isArray(meta && meta.models) ? meta.models : []
    var want = knowledgeStem(value)
    if (!want) return null
    var wantTail = want.split('/').pop()
    function keysOf(m) {
      return [m.id, m.title, m.filePath].map(knowledgeStem).filter(Boolean)
    }
    var exactHits = []
    for (var i = 0; i < models.length; i++) {
      if (
        models[i] &&
        keysOf(models[i]).indexOf(want) !== -1 &&
        exactHits.indexOf(models[i]) === -1
      ) {
        exactHits.push(models[i])
      }
    }
    if (exactHits.length > 1) return null
    if (exactHits.length === 1) return exactHits[0]
    var tailHits = []
    for (var j = 0; j < models.length; j++) {
      if (!models[j]) continue
      var tails = keysOf(models[j]).map(function (k) {
        return k.split('/').pop()
      })
      if (tails.indexOf(wantTail) !== -1) tailHits.push(models[j])
    }
    return tailHits.length === 1 ? tailHits[0] : null
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
        map[r.target].push({
          field: r.field,
          target: other.id,
          targetLabel: other.name || other.id,
        })
      })
    })
    return map
  }

  // Progressive render window shared by every element view: render RENDER_PAGE
  // items, then append the rest on demand, so a broad query never builds the
  // whole (100k-node) DOM in one synchronous pass.
  //
  // `focusIndex` keeps a deep link from defeating that window. The page that HOLDS
  // the focused item is mounted up front, so the link lands on a node that exists,
  // while the pages before it and the tail stay unmounted until the reader asks for
  // them. Everything else behaves exactly as the plain first-page window did.
  // ponytail: cap + "show more", not full virtualization (no row-height math);
  // upgrade to windowing only if this measurably falls short.
  var RENDER_PAGE = 100
  function chunked(host, items, renderSlice, page, buttonHost, focusIndex) {
    page = page || RENDER_PAGE
    buttonHost = buttonHost || host
    var total = items.length
    var windows = [] // mounted [start, end) ranges, ascending; `first` is the range's first node
    var btn = null

    // Append a page where it belongs in document order: before the first mounted
    // range that starts after it, else before the "show more" control, else last.
    function insertRange(frag, start) {
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i]
        if (w.start > start && w.first && w.first.parentNode === host) {
          host.insertBefore(frag, w.first)
          return
        }
      }
      if (btn && btn.parentNode === host) host.insertBefore(frag, btn)
      else host.appendChild(frag)
    }

    function renderRange(start, end) {
      var frag = renderSlice(items.slice(start, end), start)
      var first = frag ? frag.firstChild : null
      if (frag) insertRange(frag, start)
      windows.push({ start: start, end: end, first: first })
      windows.sort(function (a, b) {
        return a.start - b.start
      })
    }

    function mountedCount() {
      var n = 0
      windows.forEach(function (w) {
        n += w.end - w.start
      })
      return n
    }

    // The next unmounted page, always in document order: a gap left by the focused
    // page fills before the tail.
    function nextGap() {
      var cursor = 0
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i]
        if (w.start > cursor) return [cursor, Math.min(w.start, cursor + page)]
        if (w.end > cursor) cursor = w.end
      }
      if (cursor >= total) return null
      return [cursor, Math.min(total, cursor + page)]
    }

    function syncButton() {
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn)
      btn = null
      var shown = mountedCount()
      if (shown >= total) return
      btn = el('button', 'btn btn-ghost btn-sm nn-load-more')
      btn.setAttribute('type', 'button')
      btn.textContent = '\u25be Show more (' + shown + ' of ' + total + ')'
      btn.addEventListener('click', more)
      buttonHost.appendChild(btn)
    }

    function more() {
      var gap = nextGap()
      if (gap) renderRange(gap[0], gap[1])
      syncButton()
    }

    // Mount the page that holds item #index unless it is mounted already. Returns
    // false for an index the list does not carry, so a stale link stays inert.
    function reveal(index) {
      if (index == null || index < 0 || index >= total) return false
      for (var i = 0; i < windows.length; i++) {
        if (index >= windows[i].start && index < windows[i].end) return true
      }
      var start = Math.floor(index / page) * page
      renderRange(start, Math.min(total, start + page))
      syncButton()
      return true
    }

    more()
    if (focusIndex != null && focusIndex >= page) reveal(focusIndex)
    return { more: more, reveal: reveal }
  }

  // Cards project live changes: a correction patches its field value, a new
  // element is projected, and deleted elements are styled. The change STATE is
  // painted by the review controller as ONE badge per row.
  var EMPTY_FILTER_MESSAGE = 'No elements match the current filter.'

  // Shared empty state for the non-table explorer views (the table renders its own row).
  function mountEmptyFilterState(content) {
    var empty = el('div', 'nn-element-empty', EMPTY_FILTER_MESSAGE)
    empty.setAttribute('data-nn-component', 'element-empty')
    content.appendChild(empty)
  }

  // The compact storage form of a standalone console: every loaded element is a
  // member of its concept's collection, addressed `<model-id>@<slug>`. A console
  // exported with the index's collections slot never uses this.
  function collectionsFromElements(elements, meta) {
    var out = {}
    var fallbackModel = String((meta && (meta.modelId || meta.model)) || '')
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (!e || !e.concept) return
      var slug = String(e.id || e.slug || '')
      if (!slug) return
      var model = String(e.modelId || fallbackModel || '')
      // A domain export already qualifies the element id with its model id.
      var address = slug.indexOf('@') !== -1 ? slug : model ? model + '@' + slug : slug
      var concept = String(e.concept)
      if (!out[concept]) out[concept] = []
      if (out[concept].indexOf(address) === -1) out[concept].push(address)
    })
    return out
  }

  function mountElementCards(
    doc,
    elements,
    drafts,
    refs,
    concepts,
    schema,
    incomingById,
    focusId,
    actions,
    modelId,
    referenceIndex,
    sortState,
  ) {
    var content = doc.getElementById('nn-content')
    if (!content) return
    content.innerHTML = ''
    // Any view that replaces #nn-content drops the previous card window first, so a
    // stale window can never paint cards into a table or a badge list.
    content.__nnCardWindow = null

    var projectedElements = sortElements(projectElements(elements, drafts), sortState)
    if (!projectedElements.length) return mountEmptyFilterState(content)

    var visuals = typeof self !== 'undefined' && self.nnVisuals ? self.nnVisuals : null
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

    var buildElementCard = function (element) {
      var fields = []
      if (isObject(element.fields)) {
        Object.keys(element.fields).forEach(function (k) {
          if (k === 'sources' || k === 'source') return
          var val = element.fields[k]
          var cleanKey =
            typeof val === 'string' ? val.replace(/^\[\[|\]\]$/g, '').trim() : String(val)
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
                  : {
                      id: relMatch.target,
                      name: relMatch.targetLabel || cleanKey || relMatch.target,
                    }
            }
          }
          var targetCMeta =
            target && target.concept ? conceptMetaOf(concepts, target.concept) : null
          fields.push({
            name: k,
            value: val,
            type: fieldTypeOf(schema, element.concept, k),
            // Per-field citations drive the row's citation icon. The header still
            // shows the `sources::` group even though that field is never a row.
            citations:
              element.citations && Array.isArray(element.citations[k])
                ? element.citations[k]
                : undefined,
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
          citations:
            element.citations && typeof element.citations === 'object'
              ? element.citations
              : undefined,
          history:
            Array.isArray(element.history) && element.history.length ? element.history : undefined,
          historyTotal: typeof element.historyTotal === 'number' ? element.historyTotal : undefined,
          qud: {
            id: element.id,
            concept: element.concept,
            hash: element.hash,
            path: element.canonicalUnit || element.modelFile || element.modelTitle || null,
          },
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
          modelId: (element && element.modelId) || modelId || '',
          collapsible: true,
          open: focusId != null && String(element.id || '') === String(focusId),
          lazy: Array.isArray(elements) && elements.length > 20,
          byId: refs,
          concept: conceptMetaOf(concepts, element.concept),
          onTag: actions && actions.onTag,
          onKnowledge: actions && actions.onKnowledge,
          isKnowledgeBound: actions && actions.isKnowledgeBound,
          referenceIndex: referenceIndex,
          onReference: actions && actions.onReference,
          onRef: function (refId) {
            var target = refs && isObject(refs[String(refId)]) ? refs[String(refId)] : null
            if (target) renderRefDialog(doc, target)
          },
          onCite: function (citeData) {
            var fName = citeData && citeData.field
            var elCitations =
              element.citations && typeof element.citations === 'object' ? element.citations : {}
            var list = fName && Array.isArray(elCitations[fName]) ? elCitations[fName] : []
            if (citeData && citeData.entry) list = [citeData.entry]
            renderCitationDialog(doc, fName || element.name || element.id, list)
          },
        },
      )

      // Discrete concept color left border, perimeter tint & badge affordance
      var cMeta = conceptMetaOf(concepts, element.concept)
      var hexColor = cMeta.hexColor
      card.style.setProperty('--card-concept-color', hexColor)
      card.style.borderColor = 'color-mix(in srgb, ' + hexColor + ' 35%, var(--nn-border, #e5e5e5))'
      card.style.borderLeft = '4px solid ' + hexColor

      // The per-card change state is NOT a separate "Draft Edit" chip any more: the
      // review controller folds the local edit, the proposals and the applied history
      // into ONE change-state badge per row (see review.js decorateChangeState).

      // Wire the image thumbnail to the media lightbox when the element has
      // image fields (parity with the editor's NodeMedia gallery).
      var mediaItems = collectMediaItems(element)
      var thumbEl = card.querySelector('.nn-card-thumb')
      if (thumbEl && thumbEl.classList && thumbEl.classList.contains('nn-card-thumb--concept')) {
        thumbEl.style.color = hexColor
        thumbEl.style.borderColor =
          'color-mix(in srgb, ' + hexColor + ' 38%, var(--nn-border, #e5e5e5))'
        thumbEl.style.backgroundColor = 'color-mix(in srgb, ' + hexColor + ' 12%, #ffffff)'
      }
      if (mediaItems.length && thumbEl && thumbEl.tagName === 'IMG') {
        thumbEl.classList.add('nn-card-thumb--zoom')
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
        card.addEventListener('click', function (ev) {
          var t = ev && ev.target
          if (t && typeof t.closest === 'function') {
            var fImg = t.closest('.nn-field-image')
            if (fImg) {
              if (ev.stopPropagation) ev.stopPropagation()
              renderMediaDialog(doc, mediaItems, 0)
            }
          }
        })
      }

      return card
    }

    // A deep link names one card. Mount the page that holds it instead of every
    // card before it: a shared `#el-<id>` URL into a wide domain used to cost the
    // fully expanded page (214 MB / 21k nodes at boot vs 621 MB / 222k expanded,
    // measured on a 2,901-element domain).
    var focusIndex = null
    if (focusId != null) {
      for (var fi = 0; fi < projectedElements.length; fi++) {
        if (String(projectedElements[fi] && projectedElements[fi].id) === String(focusId)) {
          focusIndex = fi
          break
        }
      }
    }

    var cardWindow = chunked(
      content,
      projectedElements,
      function (pageElements) {
        var frag = doc.createDocumentFragment()
        pageElements.forEach(function (element) {
          frag.appendChild(buildElementCard(element))
        })
        return frag
      },
      RENDER_PAGE,
      undefined,
      focusIndex,
    )
    // Published so `focusElementCard` can mount the page of a card this window has
    // not reached yet, then focus and scroll it.
    content.__nnCardWindow = {
      revealElement: function (id) {
        for (var i = 0; i < projectedElements.length; i++) {
          if (String(projectedElements[i] && projectedElements[i].id) === String(id)) {
            return cardWindow.reveal(i)
          }
        }
        return false
      },
    }
  }

  function mountElementBadges(doc, elements, drafts, concepts, refs, modelId, sortState) {
    var content = doc.getElementById('nn-content')
    if (!content) return
    content.innerHTML = ''
    content.__nnCardWindow = null
    var wrap = el('div', 'nn-element-badges-wrap')
    wrap.setAttribute('data-nn-component', 'element-badges-view')
    var projectedElements = sortElements(projectElements(elements, drafts), sortState)
    if (!projectedElements.length) return mountEmptyFilterState(content)
    chunked(wrap, projectedElements, function (pageElements) {
      var frag = doc.createDocumentFragment()
      pageElements.forEach(function (element) {
        var cMeta = conceptMetaOf(concepts, element.concept)
        var pill = UI.Ku(
          'element',
          {
            model: (element && element.modelId) || modelId || '',
            id: element.id,
            label: element.name || element.id || '',
            concept: element.concept,
            color: cMeta && cMeta.color,
            index: cMeta && cMeta.index,
          },
          { doc: doc },
        )
        var pillBadge = pill.querySelector('[data-nn-component="ku-unit"]')
        if (pillBadge) {
          pillBadge.setAttribute('role', 'button')
          pillBadge.setAttribute('tabindex', '0')
          pillBadge.addEventListener('click', function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault()
            renderRefDialog(doc, element)
          })
        }
        frag.appendChild(pill)
      })
      return frag
    })
    content.appendChild(wrap)
  }

  function mountElementMiniCards(
    doc,
    elements,
    drafts,
    concepts,
    refs,
    incomingById,
    actions,
    modelId,
    sortState,
  ) {
    var content = doc.getElementById('nn-content')
    if (!content) return
    content.innerHTML = ''
    content.__nnCardWindow = null
    var grid = el('div', 'nn-element-minicards-grid')
    grid.setAttribute('data-nn-component', 'element-minicards-view')
    var projectedElements = sortElements(projectElements(elements, drafts), sortState)
    if (!projectedElements.length) return mountEmptyFilterState(content)
    chunked(grid, projectedElements, function (pageElements) {
      var frag = doc.createDocumentFragment()
      pageElements.forEach(function (element) {
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
            modelId: (element && element.modelId) || modelId || '',
            concept: cMeta,
            onClick: function () {
              renderRefDialog(doc, element)
            },
          },
        )
        frag.appendChild(mini)
      })
      return frag
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
    var sa = a == null ? '' : (Array.isArray(a) ? a.join(', ') : String(a)).trim()
    var sb = b == null ? '' : (Array.isArray(b) ? b.join(', ') : String(b)).trim()
    if (/^\s*-?\d+(\.\d+)?\s*$/.test(sa) && /^\s*-?\d+(\.\d+)?\s*$/.test(sb)) {
      return parseFloat(sa) - parseFloat(sb)
    }
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
  }

  function tableValueOf(element, key) {
    if (!element) return ''
    if (key === 'name') return element.name || ''
    if (key === 'concept') return element.concept || ''
    if (key === 'id') return element.id || ''
    if (key === 'description') return element.description || ''
    if (key === 'tags') return getElementEffectiveTags(element).join(', ')
    if (element.fields && element.fields[key] != null) return element.fields[key]
    if (element.inherited && element.inherited[key] != null) {
      var iv = element.inherited[key]
      return iv && typeof iv === 'object' && 'value' in iv ? iv.value : iv
    }
    return ''
  }

  function sortElements(projected, sortState) {
    if (!sortState || !sortState.key) return projected
    var key = sortState.key
    var dir = sortState.dir === 'desc' ? -1 : 1
    return (Array.isArray(projected) ? projected : []).slice().sort(function (a, b) {
      var valA = tableValueOf(a, key)
      var valB = tableValueOf(b, key)
      var hasA = valA != null && valA !== ''
      var hasB = valB != null && valB !== ''
      if (!hasA && !hasB) return 0
      if (!hasA) return 1
      if (!hasB) return -1
      var c = compareElementValues(valA, valB)
      if (c === 0) c = compareElementValues(a.name || a.id || '', b.name || b.id || '')
      return c * dir
    })
  }

  var sortTableElements = sortElements

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

  // Read-only table of the filtered elements: one row per element, one column
  // per field key, sortable by clicking a header. Mirrors the editor's
  // ConceptTableView (table view + header sort) inside the domain console.
  function mountElementTable(doc, elements, drafts, concepts, sortState, schema, onSort, modelId) {
    var content = doc.getElementById('nn-content')
    if (!content) return
    content.innerHTML = ''
    content.__nnCardWindow = null
    var projected = projectElements(elements, drafts)
    var table = el('table', 'nn-element-table')
    if (!table) return

    var visuals = typeof self !== 'undefined' && self.nnVisuals ? self.nnVisuals : null
    var conceptList = Array.isArray(concepts) ? concepts : []
    function conceptColor(name) {
      return conceptMetaOf(conceptList, name).hexColor
    }

    var fieldCols = elementFieldColumns(projected)
    var columns = [
      { key: 'name', label: 'Name' },
      { key: 'concept', label: 'Concept' },
    ]
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
      var th = el('th', 'nn-element-table-th')
      th.setAttribute('data-sort-key', col.key)
      th.setAttribute('scope', 'col')
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
        headerBadge.classList.add('nn-element-table-th-label')
        th.appendChild(headerBadge)
      } else {
        th.appendChild(el('span', 'nn-element-table-th-label', col.label))
      }
      // The sort control is the ONLY click target in the header, so the field
      // badge's own "+" flyout opens the field options instead of re-sorting.
      // The indicator is always shown: both triangles in a muted tone while the
      // column is unsorted, a single dark triangle once it is sorted.
      var isSorted = sortState && sortState.key === col.key
      var dir = isSorted ? (sortState.dir === 'desc' ? 'desc' : 'asc') : 'none'
      var sortBtn = el('button', 'nn-element-table-sort')
      sortBtn.setAttribute('type', 'button')
      sortBtn.setAttribute('data-dir', dir)
      sortBtn.setAttribute('aria-label', 'Sort by ' + col.label)
      sortBtn.appendChild(el('span', 'nn-element-table-sort-up', '\u25b2'))
      sortBtn.appendChild(el('span', 'nn-element-table-sort-down', '\u25bc'))
      sortBtn.addEventListener('click', function () {
        if (typeof onSort === 'function') onSort(col.key)
      })
      th.appendChild(sortBtn)
      if (isSorted) {
        th.classList.add('sorted')
        th.setAttribute('aria-sort', sortState.dir === 'desc' ? 'descending' : 'ascending')
      }
      headTr.appendChild(th)
    })
    thead.appendChild(headTr)
    table.appendChild(thead)

    var tbody = el('tbody')
    var sorted = sortTableElements(projected, sortState)
    if (!sorted.length) {
      var emptyTr = el('tr')
      var emptyTd = el('td', 'nn-element-table-empty', EMPTY_FILTER_MESSAGE)
      emptyTd.setAttribute('colspan', String(columns.length))
      emptyTr.appendChild(emptyTd)
      tbody.appendChild(emptyTr)
    }
    var buildRow = function (element) {
      var tr = el('tr')
      tr.setAttribute('data-element-id', String(element.id || ''))
      if (element._draft) tr.classList.add('nn-element-table-draft')

      var rowCMeta = conceptMetaOf(conceptList, element.concept)
      var rowModel = (element && element.modelId) || modelId || ''
      var nameTd = el('td', 'nn-element-table-name')
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
        // The local change reads with the same word as the card badge: "Unsent".
        if (UI && typeof UI.StatusBadge === 'function') {
          var draftState = UI.StatusBadge({
            status: 'local',
            label: 'Unsent',
            title:
              'This element has a change recorded in this console that has not been exported yet.',
          })
          draftState.classList.add('ml-2')
          nameTd.appendChild(draftState)
        } else {
          nameTd.appendChild(el('span', 'badge badge-sm badge-info ml-2', 'Unsent'))
        }
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
            .filter(function (r) {
              return r && r.field === k
            })
            .map(function (r) {
              return r.targetLabel || r.target || ''
            })
            .filter(Boolean)
          if (relMatches.length) rawVal = relMatches.join(', ')
        }
        var val = displayCellText(rawVal)
        var td = el('td', 'nn-element-table-cell')
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
      var tagsTd = el('td', 'nn-element-table-cell')
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

      return tr
    }
    table.appendChild(tbody)

    var wrap = el('div', 'nn-element-table-wrap')
    wrap.appendChild(table)
    content.appendChild(wrap)

    chunked(
      tbody,
      sorted,
      function (pageElements) {
        var frag = doc.createDocumentFragment()
        pageElements.forEach(function (element) {
          frag.appendChild(buildRow(element))
        })
        return frag
      },
      RENDER_PAGE,
      wrap,
    )
  }

  // Cards/Table toggle for the Model Explorer. Created once inside the explorer
  // panel and re-rendered on refresh; the active mode lives in the boot state.
  function renderExplorerToolbar(doc, mode, onChange) {
    var content = doc.getElementById('nn-content')
    if (!content || !content.parentNode) return
    var host = doc.getElementById('nn-explorer-toolbar')
    if (!host) {
      host = el('div', 'nn-explorer-toolbar')
      host.id = 'nn-explorer-toolbar'
      content.parentNode.insertBefore(host, content)
    }
    host.innerHTML = ''
    var group = el('div', 'nn-viewmode')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', 'Element view mode')
    ;[
      ['sheets', 'Sheets'],
      ['cards', 'Cards'],
      ['badges', 'Badges'],
      ['table', 'Table'],
    ].forEach(function (pair) {
      var b = el('button', 'nn-viewmode-btn', pair[1])
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
    var host = doc.getElementById('nn-matrices')
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
      var section = el('section', 'nn-matrix')
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
            Object.keys(r.cells).forEach(function (k) {
              colMap[k] = true
            })
          }
        })
        cols = Object.keys(colMap)
      }

      var headTr = el('tr', null, null)
      if (headTr) {
        var cornerTh = el('th', 'nn-matrix-corner', null)
        var srcConcept =
          matrix.source ||
          (rows.length &&
            headRows[isStructured ? rows[0].sourceId || rows[0].sourceLabel : rows[0]] &&
            headRows[isStructured ? rows[0].sourceId || rows[0].sourceLabel : rows[0]].concept) ||
          null
        var tgtConcept =
          matrix.target || (cols.length && headCols[cols[0]] && headCols[cols[0]].concept) || null
        if (cornerTh && srcConcept && tgtConcept) {
          var sMetaM = conceptMetaOf(conceptList, srcConcept)
          var tMetaM = conceptMetaOf(conceptList, tgtConcept)
          var cornerWrap = el('div', 'nn-matrix-corner-pills')
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
          cornerWrap.appendChild(el('span', 'nn-matrix-corner-sep', '×'))
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
        var rowKey = isStructured ? r.sourceId || r.sourceLabel || '' : String(r)
        var rowLabel = isStructured ? r.sourceLabel || r.sourceId || '' : String(r)
        var rowCells = isStructured ? r.cells || {} : cells[r] || cells[String(r)] || {}
        var rowTh = el('th', null, null)
        if (rowTh)
          rowTh.appendChild(
            headerBadge(headRows[rowKey] || headRows[rowLabel], rowLabel, matrixModel),
          )
        tr.appendChild(rowTh)
        cols.forEach(function (c) {
          var value = rowCells[c] != null ? String(rowCells[c]) : ''
          var isEmpty = value === '' || value === '-'
          var td = el('td', isEmpty ? 'nn-matrix-cell-empty' : 'nn-matrix-cell-filled', null)
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
            var cellUnit = cellBadge.querySelector('[data-nn-component="ku-unit"]')
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

  // Renders ECharts line charts from the pure-data series mapping (charts capability).
  // Delegates to Studio (studio.js).
  function renderCharts(host, model, meta) {
    return Studio.renderCharts(host, model, meta)
  }

  // Draws any ECharts option into `host` with the console defaults (white
  // background, palette) and returns the chart instance, or null without ECharts.
  // The chart entry point for custom views. Delegates to Studio (studio.js).
  function renderChart(host, option, opts) {
    return Studio.renderChart(host, option, opts)
  }

  // Delegates timeline grid and studio view to Studio (studio.js).
  function renderTimelineGrid(container, model, meta, hooks) {
    return Studio.renderTimelineGrid(container, model, meta, hooks)
  }

  /* View registry. A view is a classic script that calls the registerView
     bound by viewRegistrar(id, source); the id is the file slug. A rejected
     registration throws AND is recorded in registry.errors(), which boot
     renders as the #nn-view-errors notice (a throw inside a <script> is
     otherwise visible only in devtools). */
  var VIEW_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
  var RESERVED_VIEW_IDS = ['explorer', 'matrices', 'review']
  var ICON_NAME_RE = /^[a-z0-9-]+$/
  var VIEW_KINDS = ['editable', 'readonly']
  // The frame has no scripts and no same-origin access, so a meta-refresh
  // navigation inside it is accepted and out of scope here.
  var VIEW_CSP_META =
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; base-uri 'none'; form-action 'none'; img-src data: blob:; style-src 'unsafe-inline'\">"

  function nonEmptyString(v) {
    return typeof v === 'string' && v.trim() !== ''
  }

  // The Domain view and the views shown as its sub-tabs, in sub-tab order. The first one is
  // the Domain view itself (its "Overview" sub-tab).
  var DOMAIN_SUBVIEWS = ['domain', 'metamodel', 'map', 'versions']

  var TAB_ICONS = {
    chart: 'bar-chart-2',
    'chart-bar': 'bar-chart-2',
    matrices: 'table',
    explorer: 'boxes',
    review: 'edit',
    metamodel: 'boxes',
    timeline: 'clock',
    layout: 'layout-dashboard',
    network: 'workflow',
    columns: 'split',
    list: 'list-ordered',
    milestone: 'tag',
    'git-commit': 'git-branch',
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
    var iconKey = TAB_ICONS[def.icon] || def.icon
    if (typeof nnIcons !== 'undefined' && nnIcons && nnIcons.ICONS && !nnIcons.ICONS[iconKey]) {
      return (
        at +
        'icon "' +
        def.icon +
        '" is unknown (known icons: ' +
        Object.keys(nnIcons.ICONS).sort().join(', ') +
        ')'
      )
    }
    if (typeof def.order !== 'number' || !isFinite(def.order))
      return at + 'order must be a finite number'
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
          reject(
            id,
            [views[i].source, source],
            'view "' + id + '": duplicate id (already registered by ' + views[i].source + ')',
          )
        }
      }
      views.push(Object.assign({}, def, { source: source }))
      return id
    }

    // Binds the file slug and source; a declared id that differs is rejected.
    function registrar(id, source) {
      return function (def) {
        var viewId = def && def.id !== undefined ? def.id : id
        if (def && def.id !== undefined && def.id !== id && !def.id.startsWith(id + '-')) {
          reject(
            id,
            [source],
            'view "' + id + '": declared id "' + def.id + '" does not match the file slug',
          )
        }
        return register(Object.assign({}, def, { id: viewId, source: source }))
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
    var tabsNav = doc.getElementById('nn-view-tabs')
    if (!tabsNav && mainEl) {
      tabsNav = el('nav', 'nn-view-tabs')
      tabsNav.id = 'nn-view-tabs'
      tabsNav.style.display = 'none'
      var toolbar = mainEl.querySelector('.nn-toolbar')
      if (toolbar && toolbar.nextSibling) mainEl.insertBefore(tabsNav, toolbar.nextSibling)
      else if (mainEl.firstChild) mainEl.insertBefore(tabsNav, mainEl.firstChild)
      else mainEl.appendChild(tabsNav)
    }
    if (!tabsNav) return null

    var explorerPanel = doc.getElementById('nn-tab-explorer')
    if (!explorerPanel && mainEl) {
      explorerPanel = el('div', 'nn-tab-panel active')
      explorerPanel.id = 'nn-tab-explorer'
      var hosts = ['nn-doc', 'nn-content', 'nn-matrices']
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
    if (
      !doc.getElementById('nn-tab-matrices') &&
      hasMatrices &&
      explorerPanel &&
      explorerPanel.parentNode
    ) {
      var matricesPanel = el('div', 'nn-tab-panel')
      matricesPanel.id = 'nn-tab-matrices'
      var matricesHostEl = doc.getElementById('nn-matrices')
      if (!matricesHostEl) {
        matricesHostEl = el('div')
        matricesHostEl.id = 'nn-matrices'
      }
      matricesPanel.appendChild(matricesHostEl)
      explorerPanel.parentNode.insertBefore(matricesPanel, explorerPanel.nextSibling)
    }

    var reviewPanel = doc.getElementById('nn-tab-review')
    if (!reviewPanel && mainEl) {
      reviewPanel = el('div', 'nn-tab-panel')
      reviewPanel.id = 'nn-tab-review'
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

  // The full console scope: a view id, a model allow-list, a read-only flag and a
  // human label. `writeConsole` writes it into `meta.consoleScope` (console-scope).
  function consoleScopeMeta(meta) {
    var scope = isObject(meta && meta.consoleScope) ? meta.consoleScope : {}
    var models = Array.isArray(scope.models)
      ? scope.models
          .map(function (m) {
            return String(m == null ? '' : m).trim()
          })
          .filter(function (m) {
            return m !== ''
          })
      : []
    return {
      view: nonEmptyString(scope.view) ? String(scope.view) : '',
      models: models,
      readOnly: scope.readOnly === true,
      label: nonEmptyString(scope.label) ? String(scope.label) : '',
    }
  }

  // The draft store is keyed per scope so two scoped consoles sharing a domain id do
  // not share drafts (console-scope).
  function draftStoreId(baseId, scope) {
    var id = String(baseId == null ? '' : baseId)
    if (scope && scope.view) id += '::view:' + scope.view
    if (scope && Array.isArray(scope.models) && scope.models.length > 0) {
      id += '::models:' + scope.models.join(',')
    }
    return id
  }

  /** Read-only consoles never offer an edit control. */
  function applyReadOnlyControls(doc) {
    var selectors = [
      '#nn-review-dock button',
      '[data-nn-edit]',
      '.nn-card-edit',
      '[data-nn-propose]',
      '#nn-edit',
      '.nn-review-actions button',
    ]
    selectors.forEach(function (sel) {
      var nodes = doc.querySelectorAll(sel)
      for (var i = 0; i < nodes.length; i++) nodes[i].disabled = true
    })
  }

  // Built-in tabs, registered per boot (they are not in the registry).
  // The models a reader thinks of as the domaiNN's content: every model but the
  // synthetic change log, which the Summary counts as changes instead.
  function summaryModels(meta) {
    var models = meta && Array.isArray(meta.models) ? meta.models : []
    return models.filter(function (m) {
      return m && m.id !== 'changes'
    })
  }

  // One line under the tabs that translates the iNNfo vocabulary for a newcomer.
  var VOCABULARY_LEGEND = [
    ['bluepriNNt', 'the template a model follows'],
    ['concept', 'a type of card'],
    ['element', 'one card'],
    ['field', 'one piece of data on a card'],
  ]

  function ensureVocabularyLegend(doc, nav) {
    if (!nav || !nav.parentNode || doc.querySelector('.nn-vocab-legend')) return
    var legend = el('p', 'nn-vocab-legend')
    legend.setAttribute('aria-label', 'Vocabulary')
    VOCABULARY_LEGEND.forEach(function (pair, i) {
      if (i) legend.appendChild(doc.createTextNode(' · '))
      legend.appendChild(el('strong', null, pair[0]))
      legend.appendChild(doc.createTextNode(' = ' + pair[1]))
    })
    nav.parentNode.insertBefore(legend, nav.nextSibling)
  }

  // Switches to the Knowledge tab with `token` (a facet such as `concept:Deal`) in
  // the search box. Every "show me these" link in the console goes through here.
  function revealInKnowledge(doc, token) {
    var search = doc.getElementById('nn-search')
    if (search) {
      search.value = token
      if (typeof CustomEvent === 'function') {
        search.dispatchEvent(new CustomEvent('input', { bubbles: true }))
      }
    }
    var expBtn = doc.querySelector('.nn-view-tab[data-tab="explorer"]')
    if (expBtn && typeof expBtn.click === 'function') expBtn.click()
  }

  // A dashboard number: label, value and an optional line of context.
  function kpiCard(label, value, sub) {
    var card = el('div', 'nn-kpi-card')
    card.appendChild(el('div', 'kpi-label', label))
    card.appendChild(el('div', 'kpi-value', value))
    if (sub) card.appendChild(el('div', 'kpi-sub', sub))
    return card
  }

  function builtinViews(doc, config, model, meta, shell, schema) {
    var views = []
    // Files sits after the knowledge/changes band and only exists when the
    // payload carries a precomputed inventory.
    var filesPayload = model && model.files
    var hasFiles =
      !!filesPayload &&
      ((Array.isArray(filesPayload.inventory) && filesPayload.inventory.length > 0) ||
        (Array.isArray(filesPayload.origins) && filesPayload.origins.length > 0))
    var scoped = consoleScopeOf(meta)
    // A standalone --view artifact mounts that view alone.
    if (scoped) {
      if (scoped === 'files' && hasFiles) {
        views.push({
          id: 'files',
          title: 'Files',
          icon: 'folder',
          order: 25,
          tone: 'core',
          panelId: 'nn-tab-files',
        })
      }
      return views
    }
    if (summaryModels(meta).length > 0) {
      views.push({
        id: 'domain',
        title: 'Domain',
        icon: 'layout',
        order: 5,
        tone: 'core',
        panelId: 'nn-tab-domain',
      })
    }
    if (meta && meta.versions && typeof meta.versions === 'object') {
      views.push({
        id: 'versions',
        title: 'Versions',
        icon: 'milestone',
        order: 50,
        tone: 'core',
        panelId: 'nn-tab-versions',
      })
    }
    if (
      summaryModels(meta).length > 0 &&
      Array.isArray(model && model.elements) &&
      model.elements.length > 0
    ) {
      views.push({
        id: 'map',
        title: 'Map',
        icon: 'network',
        order: 15,
        tone: 'core',
        panelId: 'nn-tab-map',
      })
    }
    if (schema && Array.isArray(schema.concepts) && schema.concepts.length) {
      views.push({
        id: 'metamodel',
        title: 'Schema',
        icon: 'metamodel',
        order: 10,
        tone: 'core',
        panelId: 'nn-tab-metamodel',
      })
    }
    if ((Array.isArray(model && model.elements) && model.elements.length > 0) || shell.explorer) {
      views.push({
        id: 'explorer',
        title: 'Knowledge',
        icon: 'explorer',
        order: 20,
        tone: 'core',
        panelId: 'nn-tab-explorer',
      })
    }
    if (Array.isArray(model && model.matrices) && model.matrices.length > 0) {
      views.push({
        id: 'matrices',
        title: 'Matrices',
        icon: 'matrices',
        order: 30,
        tone: 'core',
        panelId: 'nn-tab-matrices',
      })
    }
    // Files sits right after the knowledge/changes band and only exists when the
    // payload carries a precomputed inventory.
    if (hasFiles) {
      views.push({
        id: 'files',
        title: 'Files',
        icon: 'folder',
        order: 25,
        tone: 'core',
        panelId: 'nn-tab-files',
      })
    }
    return views
  }

  function renderViewErrors(doc, errors, nav) {
    var host = doc.getElementById('nn-view-errors')
    if (!errors.length) {
      if (host && host.parentNode) host.parentNode.removeChild(host)
      return
    }
    if (!host) {
      host = el('div', 'nn-view-errors alert alert-error text-sm mb-3')
      host.id = 'nn-view-errors'
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
        } else if (part.indexOf('path=') === 0) {
          try {
            out.path = decodeURIComponent(part.slice(5))
          } catch {
            out.path = ''
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
    if (scopedView && shell.explorer) {
      shell.explorer.classList.remove('active')
      if (shell.explorer.parentNode) shell.explorer.parentNode.removeChild(shell.explorer)
    }
    registry.list().forEach(function (v) {
      if (scopedView && v.id !== scopedView) return
      if (!scopedView && v.kind === 'readonly' && v.id === 'conntent-delivery') return
      var clash = tabs.filter(function (t) {
        return t.id === v.id
      })[0]
      var panelId = 'nn-tab-' + v.id
      var existing = doc.getElementById(panelId)
      if (clash) {
        report(
          v.id,
          [clash.id + ' (built-in)', v.source],
          'view "' + v.id + '": duplicate id (a built-in tab already uses it)',
        )
      } else if (existing && existing.getAttribute('data-nn-view') !== v.id) {
        // The panel belongs to the shell or a built-in tab; never mount into it.
        report(
          v.id,
          [v.source],
          'view "' +
            v.id +
            '": panel #' +
            panelId +
            ' already exists and is not owned by this view',
        )
      } else {
        var isBlueprint = /bluepriNN?ts[\\/]/.test(String(v.source || ''))
        // The procedures blueprint view is promoted into the core band, right
        // after Matrices, and reads "Procedures" in the header.
        var isProcedure = v.id === 'procedure'
        tabs.push(
          Object.assign({}, v, {
            panelId: 'nn-tab-' + v.id,
            external: true,
            tone: isProcedure ? 'core' : isBlueprint ? 'blueprint' : 'custom',
            order: isProcedure ? 40 : v.order,
            title: isProcedure ? 'Procedures' : v.title,
          }),
        )
      }
    })
    // Band order is fixed: core (Domain · Knowledge · Matrices · Procedures) →
    // blueprint views → domain custom views; `order` only breaks ties in a band.
    var TONE_RANK = { core: 0, blueprint: 1, custom: 2 }
    tabs.sort(function (a, b) {
      var ra = TONE_RANK[a.tone] == null ? 2 : TONE_RANK[a.tone]
      var rb = TONE_RANK[b.tone] == null ? 2 : TONE_RANK[b.tone]
      return ra - rb || a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    })
    // Change B: the bespoke `Changes` tab is retired — the `changes` collection now
    // surfaces as an ordinary model (one unit per Change). The shell's review panel
    // still hosts the changeset bar; it is no longer a tab.

    tabs.forEach(function (t) {
      if (t.id === 'explorer' || t.id === 'review') return
      if (doc.getElementById(t.panelId) || !shell.main) return
      var panel = el('div', 'nn-tab-panel')
      panel.id = t.panelId
      if (t.external) panel.setAttribute('data-nn-view', t.id)
      shell.main.insertBefore(panel, shell.review)
    })

    // Schema, Map and Versions describe the domaiNN as a whole, so they live inside the
    // Domain view as its sub-tabs instead of beside it. Their ids, panels and hash routes
    // stay the same; only the button moves. Without a Domain view they stay top-level.
    var hasDomain = tabs.some(function (t) {
      return t.id === 'domain'
    })
    var inDomain = function (id) {
      return hasDomain && DOMAIN_SUBVIEWS.indexOf(id) > 0
    }
    var subnav = doc.getElementById('nn-domain-subtabs')
    if (subnav && subnav.parentNode) subnav.parentNode.removeChild(subnav)
    subnav = null

    function tabButton(t, title, extraClass) {
      var btn = el(
        'button',
        'nn-view-tab tab flex items-center gap-2' + (extraClass ? ' ' + extraClass : ''),
      )
      btn.setAttribute('type', 'button')
      btn.dataset.tab = t.id
      btn.classList.add('tone-' + (t.tone || 'custom'))
      var label = el('span', null, title)
      btn.innerHTML = UI.icon(TAB_ICONS[t.icon] || t.icon, 15)
      btn.appendChild(label)
      btn.addEventListener('click', function () {
        select(t.id, false)
      })
      return btn
    }

    nav.innerHTML = ''
    nav.style.display = 'flex'
    nav.className = 'nn-view-tabs tabs tabs-boxed bg-base-200 p-1 rounded-lg gap-1 mb-4 inline-flex'
    tabs.forEach(function (t) {
      if (t.id === 'review' || t.id === 'changes') return
      if (inDomain(t.id)) return
      nav.appendChild(tabButton(t, t.title))
    })
    var grouped = DOMAIN_SUBVIEWS.map(function (id) {
      return tabs.filter(function (t) {
        return t.id === id
      })[0]
    }).filter(Boolean)
    if (hasDomain && grouped.length > 1) {
      subnav = el('nav', 'nn-domain-subtabs tabs tabs-bordered gap-1 mb-3')
      subnav.id = 'nn-domain-subtabs'
      subnav.setAttribute('aria-label', 'Domain views')
      subnav.style.display = 'none'
      grouped.forEach(function (t) {
        subnav.appendChild(tabButton(t, t.id === 'domain' ? 'Overview' : t.title, 'nn-view-subtab'))
      })
      // Above the Domain view's own content, not in the header next to the main tabs.
      var firstPanel = shell.main && shell.main.querySelector('.nn-tab-panel')
      if (firstPanel) shell.main.insertBefore(subnav, firstPanel)
      else nav.parentNode.insertBefore(subnav, nav.nextSibling)
    }
    if (!scopedView) ensureVocabularyLegend(doc, nav)
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
      if (root.querySelectorAll)
        found = found.concat([].slice.call(root.querySelectorAll(FRAME_SELECTOR)))
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
          'view "' +
            t.id +
            '": views must not mount iframes, objects or embeds; use ctx.mountHtml (removed)',
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
        // One pass per delivery. A mount can add thousands of nodes at once, so each
        // candidate is visited once, and a leaf that cannot hold a frame is skipped
        // instead of paying a querySelectorAll over its (empty) subtree.
        var candidates = []
        for (var i = 0; i < records.length; i++) {
          var added = records[i].addedNodes
          for (var j = 0; j < added.length; j++) {
            var n = added[j]
            if (n.nodeType !== 1) continue
            if (!n.firstChild && FRAME_TAGS.indexOf(n.tagName) < 0) continue
            if (scope.contains(n)) candidates.push(n)
          }
        }
        if (candidates.length === 0) return
        for (var k = 0; k < candidates.length; k++) stripIframes(t, candidates[k])
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
        return { elementId: a.elementId, field: a.field, knowledge_id: a.knowledge_id }
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
                'cannot propose: kind must be one of ' +
                  ITEM_KINDS.join(', ') +
                  ' (got "' +
                  p.kind +
                  '")',
              )
            }
            // A run request names a procedure, not an element: it goes straight to the store,
            // which validates its contract (review.js addDraft).
            if (p.kind === 'run_start') {
              var started = opts.state.store.addDraft({
                kind: 'run_start',
                procedure: p.procedure,
                params: p.params,
                run: p.run,
                path: p.path,
              })
              var rc = opts.getController()
              if (rc) rc.refresh()
              else opts.onDraftsChanged()
              return started
            }
            if (p.kind === 'run_handoff') {
              var handed = opts.state.store.addDraft({
                kind: 'run_handoff',
                run: p.run,
                choice: p.choice,
              })
              var hc = opts.getController()
              if (hc) hc.refresh()
              else opts.onDraftsChanged()
              return handed
            }
            if (p.kind === 'comment' && !nonEmptyString(p.comment)) {
              throw new Error('cannot propose: a comment needs non-empty comment text')
            }
            if (p.kind === 'correction') {
              if (!nonEmptyString(p.field))
                throw new Error('cannot propose: a correction needs a field')
              if (p.proposed === undefined || p.proposed === null) {
                throw new Error('cannot propose: a correction needs a proposed value')
              }
            }
            // A verdict is a gate decision, not a field write: it names the gate, its
            // outcome and the content hash the reviewer saw (never computed here).
            if (p.kind === 'verdict') {
              if (!nonEmptyString(p.gate)) throw new Error('cannot propose: a verdict needs a gate')
              if (p.verdict !== 'approved' && p.verdict !== 'needs-change') {
                throw new Error('cannot propose: a verdict must be approved or needs-change')
              }
              if (!/^[0-9a-f]{64}$/.test(String(p.reviewed_hash || ''))) {
                throw new Error(
                  'cannot propose: a verdict needs the 64-hex reviewed_hash of the content it reviews',
                )
              }
              if (p.verdict === 'needs-change' && !nonEmptyString(p.notes)) {
                throw new Error('cannot propose: needs-change needs a reason')
              }
              if (
                p.plan_hash !== undefined &&
                p.plan_hash !== null &&
                p.plan_hash !== '' &&
                !/^[0-9a-f]{64}$/.test(String(p.plan_hash))
              ) {
                throw new Error('cannot propose: plan_hash must be 64 hex characters')
              }
            }
            var payload = { kind: p.kind, proposed: p.proposed, comment: p.comment }
            // A `new` draft names what it creates: review.js cannot look it up in the
            // model, because the instance does not exist yet.
            if (p.kind === 'new') {
              if (p.concept) payload.concept = p.concept
              if (p.element) payload.element = p.element
              if (p.element_slug) payload.element_slug = p.element_slug
            }
            if (p.kind === 'verdict') {
              payload.gate = p.gate
              payload.verdict = p.verdict
              payload.reviewed_hash = p.reviewed_hash
              payload.notes = p.notes
              if (p.plan_hash) payload.plan_hash = p.plan_hash
            }
            if (p.kind === 'correction') {
              // Same source the modal path uses (kuModalTarget): name and
              // description live on the element. Media paths in fields may be
              // rebased for display; preconditions must use the document value.
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
                      : src.rawFields &&
                          Object.prototype.hasOwnProperty.call(src.rawFields, p.field)
                        ? src.rawFields[p.field]
                        : src.fields
                          ? src.fields[p.field]
                          : undefined
              }
            }
            var saved = controller().propose(anchor(p), payload)
            if (!saved) {
              // A `new` draft supplies its own concept and element; anything else targets
              // an element the console must already hold.
              throw new Error(
                p.kind === 'new'
                  ? 'cannot propose: a new element needs `concept` and `element`'
                  : 'cannot propose: unknown element "' + p.elementId + '"',
              )
            }
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
              report(
                t.id,
                [t.source],
                'view "' +
                  t.id +
                  '": onChange listener failed: ' +
                  String(err && err.message ? err.message : err),
              )
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
          // The exporter's per-view facts (decision A12): `ctx.viewData` is this view's
          // entry, `ctx.payload.viewData` the whole map keyed by view id.
          viewData: (opts.viewData && opts.viewData[t.id]) || {},
          payload: {
            schema: opts.schema,
            model: opts.model,
            meta: opts.meta,
            models: Array.isArray(opts.meta && opts.meta.models) ? opts.meta.models : [],
            viewData: opts.viewData || {},
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
                : opts.model && opts.model.elements
                  ? opts.model.elements
                  : []
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
        panel.appendChild(
          el(
            'div',
            'nn-view-error alert alert-error text-sm',
            'View "' + t.id + '" failed to mount: ' + msg,
          ),
        )
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
          report(
            id,
            [],
            'view "' +
              id +
              '": ' +
              name +
              ' failed: ' +
              String(err && err.message ? err.message : err),
          )
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
                report(
                  t.id,
                  [t.source],
                  'view "' +
                    t.id +
                    '": filter listener failed: ' +
                    String(err && err.message ? err.message : err),
                )
                showErrors()
              }
            })
          }
          if (m.api && typeof m.api.onFilter === 'function') {
            try {
              m.api.onFilter(filteredElements, query)
            } catch (err) {
              report(
                t.id,
                [t.source],
                'view "' +
                  t.id +
                  '": onFilter failed: ' +
                  String(err && err.message ? err.message : err),
              )
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
      var domainOpen = tabId === 'domain' || inDomain(tabId)
      tabs.forEach(function (t) {
        var btn = nav.querySelector('.nn-view-tab[data-tab="' + t.id + '"]')
        var panel = doc.getElementById(t.panelId)
        // The Domain button stays lit while one of its sub-tabs is showing.
        var lit = t.id === tabId || (t.id === 'domain' && domainOpen)
        if (btn) {
          btn.classList.toggle('active', lit)
          btn.classList.toggle('tab-active', lit)
          btn.setAttribute('aria-current', lit ? 'page' : 'false')
        }
        var sub = subnav && subnav.querySelector('.nn-view-tab[data-tab="' + t.id + '"]')
        if (sub) {
          sub.classList.toggle('active', t.id === tabId)
          sub.classList.toggle('tab-active', t.id === tabId)
          sub.setAttribute('aria-current', t.id === tabId ? 'page' : 'false')
        }
        if (panel) panel.classList.toggle('active', t.id === tabId)
      })
      if (subnav) subnav.style.display = domainOpen ? 'flex' : 'none'
      var dockChangesBtn = doc.querySelector('[data-nn="dock-changes"]')
      if (dockChangesBtn) dockChangesBtn.classList.toggle('active', tabId === 'review')
      if (!scopedView && doc.querySelector) {
        var railAside = doc.querySelector('aside.nn-rail')
        if (railAside) {
          railAside.style.display = tabId === 'explorer' ? '' : 'none'
        }
      }
      if (prev) hook(prev, 'onHide')
      if (tabId === 'review' && opts.state)
        renderReviewTab(doc, opts.state, opts.config, opts.onRefresh)
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
    // default). A `config.defaultView` from #nn-config overrides it.
    function defaultTabId() {
      var has = function (id) {
        return tabs.some(function (t) {
          return t.id === id
        })
      }
      if (scopedView && has(scopedView)) return scopedView
      // A search in the URL is a question for the explorer: show its answer there
      // even when the console lands elsewhere by default.
      if (has('explorer') && parseViewHash(doc.location ? doc.location.hash : '').q)
        return 'explorer'
      var preferred = opts.config && opts.config.defaultView
      if (preferred && has(preferred)) return preferred
      if (has('explorer')) return 'explorer'
      return tabs.length > 0 ? tabs[0].id : ''
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
    var btn = doc.querySelector('.nn-view-tab[data-tab="review"]')
    var dockBtn = doc.querySelector('[data-nn="dock-changes"]')
    var n = state && state.store ? state.store.drafts().length : 0
    if (btn) {
      var old = btn.querySelector('.nn-rail-badge')
      if (old && old.parentNode) old.parentNode.removeChild(old)
      if (n > 0)
        btn.appendChild(el('span', 'nn-rail-badge badge badge-sm badge-neutral', String(n)))
    }
    if (dockBtn) {
      var oldDockBadge = dockBtn.querySelector('.nn-dock-badge')
      if (oldDockBadge && oldDockBadge.parentNode) oldDockBadge.parentNode.removeChild(oldDockBadge)
      if (n > 0)
        dockBtn.appendChild(
          el('span', 'nn-dock-badge badge badge-sm badge-neutral ml-1', String(n)),
        )
    }
  }

  function elementsByIdOf(state) {
    var byId = {}
    var concepts =
      (state && state.schema && state.schema.concepts) || (state && state.concepts) || []
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

  // Case/separator-insensitive match of a change target's element part against an
  // element's id, name or slug.
  function findElementForTarget(elements, target) {
    var t = String(target || '')
    var at = t.indexOf('@')
    var part = at === -1 ? t : t.slice(at + 1).split('&')[0]
    function key(v) {
      return String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
    }
    var want = key(part)
    if (!want) return null
    var list = Array.isArray(elements) ? elements : []
    for (var i = 0; i < list.length; i++) {
      var e = list[i]
      if (!e) continue
      if (key(e.id) === want || key(e.name) === want || key(e.slug) === want) return e
    }
    return null
  }

  function targetFieldOf(target) {
    var t = String(target || '')
    var at = t.indexOf('@')
    var rest = at === -1 ? t : t.slice(at + 1)
    var segs = rest.split('&')
    return segs.length > 1 ? segs[1].trim() : ''
  }

  /* ---------------------------------------------------------------------------
     Files view.
     Read-only inventory explorer over `model.files` (precomputed by
     export-console). Split Explorer (tree + detail) is the primary view; the
     5-stage Pipeline Flow is the secondary one. There is deliberately no
     mutation, edit or delete affordance anywhere in this view.
     ------------------------------------------------------------------------- */

  var FILES_CATEGORIES = [
    { id: 'source', title: 'Sources' },
    { id: 'asset', title: 'Assets' },
    { id: 'evidence', title: 'Evidence' },
    { id: 'artifact', title: 'Artifacts' },
    { id: 'unclassified', title: 'Unclassified' },
  ]

  var FILES_CATEGORY_LABEL = {
    source: 'source',
    asset: 'asset',
    evidence: 'evidence',
    artifact: 'artifact',
    unclassified: 'unclassified',
  }

  var FILES_PIPELINE_STAGES = [
    { id: 'origins', title: 'Origins' },
    { id: 'sources', title: 'Sources' },
    { id: 'changes', title: 'Changes' },
    { id: 'units', title: 'Units' },
    { id: 'artifacts', title: 'Artifacts' },
  ]

  function filesFmtBytes(bytes) {
    var n = Number(bytes) || 0
    if (n < 1024) return n + ' B'
    if (n < 1048576) return round1(n / 1024) + ' KB'
    if (n < 1073741824) return round1(n / 1048576) + ' MB'
    return round1(n / 1073741824) + ' GB'
  }

  function round1(n) {
    return Math.round(n * 10) / 10
  }

  function filesBaseName(p) {
    var s = String(p || '')
    var i = s.lastIndexOf('/')
    return i === -1 ? s : s.slice(i + 1)
  }

  function filesPct(rate) {
    return Math.round((Number(rate) || 0) * 100) + '%'
  }

  function renderFilesTab(doc, files, opts) {
    var host = doc.getElementById('nn-tab-files')
    if (!host || !files || !Array.isArray(files.inventory)) return
    opts = opts || {}
    host.removeAttribute('hidden')

    var sidebar = doc.getElementById('nn-files-sidebar')
    var detail = doc.getElementById('nn-files-detail')
    var pipeline = doc.getElementById('nn-files-pipeline')
    var split = host.querySelector('.nn-files-split')
    var statPill = doc.getElementById('nn-files-active-stat')
    var explorerBtn = doc.getElementById('nn-files-mode-explorer')
    var pipelineBtn = doc.getElementById('nn-files-mode-pipeline')
    var dialog = doc.getElementById('nn-file-preview-dialog')

    var inventory = files.inventory
    var stats = files.stats || {}
    var origins = Array.isArray(files.origins) ? files.origins : []
    // Origin ids that contributed each file, so tracing never matches by path prefix.
    var originIdsByPath = {}
    origins.forEach(function (o) {
      ;(Array.isArray(o.files) ? o.files : []).forEach(function (p) {
        if (!originIdsByPath[p]) originIdsByPath[p] = []
        originIdsByPath[p].push(o.id)
      })
    })
    function lightOrigins(out, path) {
      ;(originIdsByPath[path] || []).forEach(function (id) {
        out['origin:' + id] = true
      })
    }
    var lineage = files.lineage || {}
    var elements = Array.isArray(opts.elements) ? opts.elements : []
    var byPath = {}
    inventory.forEach(function (f) {
      if (f && f.path) byPath[f.path] = f
    })

    // Which units cite which file, matched the same way export does. A unit cites
    // the sidecar document, so the path is folded back to its subject file.
    // Changesets are materialized as `Change` pseudo-units (`<batch>#<id>`); they
    // are NOT knowledge units and get their own bucket and badge.
    var SIDECAR_SUFFIX = '_sidecar_NN.md'
    function citationSubject(raw) {
      var norm = String(raw).replace(/\\/g, '/').replace(/^\/+/, '').split('#')[0]
      if (
        norm.length > SIDECAR_SUFFIX.length &&
        norm.slice(-SIDECAR_SUFFIX.length) === SIDECAR_SUFFIX
      ) {
        return norm.slice(0, norm.length - SIDECAR_SUFFIX.length)
      }
      return norm
    }

    function isChangeUnit(e) {
      return !!(e && e.concept === 'Change' && String(e.id).indexOf('#') >= 0)
    }

    // `testlab_admin_intake_changes_NN#a-01` -> `testlab_admin_intake` (the
    // changeset node id the pipeline Changes column uses).
    function changeNodeIdOf(unitId) {
      return String(unitId)
        .split('#')[0]
        .replace(/_changes_NN$/, '')
    }

    var unitsByPath = {}
    var changesByPath = {}
    elements.forEach(function (e) {
      if (!e || !e.citations) return
      var asChange = isChangeUnit(e)
      Object.keys(e.citations).forEach(function (field) {
        var list = e.citations[field]
        if (!Array.isArray(list)) return
        list.forEach(function (cit) {
          var raw = cit && (cit.path || cit.href)
          if (!raw) return
          var norm = citationSubject(raw)
          inventory.forEach(function (f) {
            if (f.path === norm || f.path.endsWith('/' + norm) || norm.endsWith('/' + f.path)) {
              var bucket = asChange ? changesByPath : unitsByPath
              var key = asChange ? changeNodeIdOf(e.id) : e.id
              if (!bucket[f.path]) bucket[f.path] = []
              if (bucket[f.path].indexOf(key) < 0) bucket[f.path].push(key)
            }
          })
        })
      })
    })

    var state = { mode: 'explorer', selected: '', pipelineSelected: '', collapsed: {}, query: '' }

    var elementsById = {}
    elements.forEach(function (e) {
      if (!e) return
      if (e.id) elementsById[e.id] = e
      if (e.slug && !elementsById[e.slug]) elementsById[e.slug] = e
      if (typeof e.id === 'string') {
        var at = e.id.indexOf('@')
        if (at !== -1) {
          var bare = e.id.slice(at + 1)
          if (!elementsById[bare]) elementsById[bare] = e
        }
        var hash = e.id.indexOf('#')
        if (hash !== -1) {
          var bareHash = e.id.slice(hash + 1)
          if (!elementsById[bareHash]) elementsById[bareHash] = e
        }
      }
    })

    function kuBadge(unitId) {
      var target = elementsById[unitId]
      var ref = {
        id: target && target.id ? target.id : String(unitId),
        label: (target && (target.name || target.slug)) || String(unitId),
      }
      if (target && target.concept) ref.concept = target.concept
      // The address needs the owning model: without it the badge renders a bare
      // `@slug`, which is not a parseable unit address.
      if (target && target.modelId) ref.model = target.modelId
      if (!UI || typeof UI.Ku !== 'function') return el('span', 'nn-badge', ref.label)
      try {
        return UI.Ku('element', ref, {
          doc: doc,
          onReveal: function (descriptor) {
            if (typeof opts.onReveal === 'function') opts.onReveal(descriptor)
          },
        })
      } catch {
        return el('span', 'nn-badge', ref.label)
      }
    }

    // A non-KU node still reads like a console badge: same `nn-ku` shell and
    // nature grammar, custom icon, semantic colors, but no unit affordances.
    var NON_KU_BADGE = {
      origins: { kind: 'origin', nature: 'container', home: 'domain', icon: 'database' },
      origin: { kind: 'origin', nature: 'container', home: 'domain', icon: 'database' },
      sources: { kind: 'source', nature: 'content', home: 'source', icon: 'file-text' },
      source: { kind: 'source', nature: 'content', home: 'source', icon: 'file-text' },
      changes: { kind: 'change', nature: 'container', home: 'model', icon: 'git-branch' },
      change: { kind: 'change', nature: 'container', home: 'model', icon: 'git-branch' },
      artifacts: { kind: 'artifact', nature: 'content', home: 'source', icon: 'package' },
      artifact: { kind: 'artifact', nature: 'content', home: 'source', icon: 'package' },
    }

    function similarBadge(kindKey, label, title) {
      if (UI && typeof UI.ConceptBadge === 'function') {
        return UI.ConceptBadge(kindKey, label, { title: title, doc: doc })
      }
      var spec = NON_KU_BADGE[kindKey] || NON_KU_BADGE.sources
      var badge = el('span', 'nn-ku nn-concept-badge')
      badge.setAttribute('data-ku-kind', spec.kind)
      badge.setAttribute('data-ku-nature', spec.nature)
      badge.setAttribute('data-ku-home', spec.home)
      if (title) badge.setAttribute('title', title)
      if (spec.icon && typeof nnIcons !== 'undefined' && typeof nnIcons.getSvg === 'function') {
        var iconEl = el('span', 'nn-ku-icon')
        iconEl.setAttribute('aria-hidden', 'true')
        iconEl.innerHTML = nnIcons.getSvg(spec.icon, { size: 13 })
        badge.appendChild(iconEl)
      }
      badge.appendChild(el('span', 'nn-ku-label', String(label == null ? '' : label)))
      return badge
    }

    function matchesQuery(entry) {
      if (!state.query) return true
      return entry.path.toLowerCase().indexOf(state.query) >= 0
    }

    /* ---- sidebar ---------------------------------------------------------- */

    function renderSidebar() {
      if (!sidebar) return
      sidebar.innerHTML = ''

      var search = doc.createElement('input')
      search.type = 'search'
      search.className = 'nn-input'
      search.setAttribute('placeholder', 'Filter files by path\u2026')
      search.setAttribute('aria-label', 'Filter files by path')
      search.value = state.query
      search.addEventListener('input', function () {
        state.query = String(search.value || '')
          .toLowerCase()
          .trim()
        renderSidebar()
      })
      sidebar.appendChild(search)

      var anyGroup = false
      FILES_CATEGORIES.forEach(function (cat) {
        var members = inventory.filter(function (f) {
          return f.category === cat.id && matchesQuery(f)
        })
        if (!members.length) return
        anyGroup = true
        var collapsed = state.collapsed[cat.id] === true
        var group = el('div', 'nn-category-group')
        var head = el('div', 'nn-category-header' + (collapsed ? ' collapsed' : ''))
        head.setAttribute('role', 'button')
        head.setAttribute('tabindex', '0')
        head.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
        var headMain = el('span', 'nn-category-header-main')
        var chevron = el('span', 'chevron', collapsed ? '\u25B8' : '\u25BE')
        chevron.setAttribute('aria-hidden', 'true')
        headMain.appendChild(chevron)
        headMain.appendChild(el('span', null, cat.title))
        head.appendChild(headMain)
        head.appendChild(el('span', 'nn-category-badge', String(members.length)))
        function toggle() {
          state.collapsed[cat.id] = !collapsed
          renderSidebar()
        }
        head.addEventListener('click', toggle)
        head.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            toggle()
          }
        })
        group.appendChild(head)

        if (!collapsed) {
          var tree = el('div', 'nn-category-tree')
          members.forEach(function (entry) {
            var row = el('div', 'nn-file-row' + (state.selected === entry.path ? ' active' : ''))
            row.setAttribute('role', 'button')
            row.setAttribute('tabindex', '0')
            row.setAttribute('data-path', entry.path)
            row.setAttribute('title', entry.path)
            var icon = el(
              'span',
              'nn-file-icon',
              entry.category === 'artifact' ? '\u25A0' : '\u25A1',
            )
            icon.setAttribute('aria-hidden', 'true')
            row.appendChild(icon)
            row.appendChild(el('span', 'nn-file-name', filesBaseName(entry.path)))
            row.appendChild(el('span', 'nn-file-size', filesFmtBytes(entry.size)))
            if (entry.uncited || (entry.sidecar && entry.sidecar.exists === false)) {
              var warn = el('span', 'nn-badge-warning', '!')
              warn.setAttribute(
                'title',
                entry.uncited ? 'Not cited by any knowledge unit or change' : 'No sidecar',
              )
              row.appendChild(warn)
            }
            function open() {
              selectFile(entry.path)
            }
            row.addEventListener('click', open)
            row.addEventListener('keydown', function (ev) {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                open()
              }
            })
            tree.appendChild(row)
          })
          group.appendChild(tree)
        }
        sidebar.appendChild(group)
      })

      if (!anyGroup) sidebar.appendChild(el('p', 'nn-files-empty', 'No files match this filter.'))
    }

    /* ---- workspace dashboard ---------------------------------------------- */

    function renderDashboard() {
      if (!detail) return
      detail.innerHTML = ''
      var dash = el('div', 'nn-files-dashboard')

      var kpis = el('div', 'nn-files-kpis')
      function kpi(label, value, sub) {
        kpis.appendChild(kpiCard(label, value, sub))
      }
      kpi('Files', String(stats.totalFiles || inventory.length), 'indexed in this workspace')
      kpi('Footprint', filesFmtBytes(stats.totalBytes || 0), 'total bytes on disk')
      kpi(
        'Source coverage',
        filesPct(stats.sourceCoverageRate),
        (stats.uncitedSourceCount || 0) + ' uncited',
      )
      kpi(
        'Sidecars',
        String(
          (stats.sidecarMissingCount || 0) +
            (stats.sidecarInvalidCount || 0) +
            (stats.sidecarMismatchCount || 0),
        ),
        'missing, invalid or stale',
      )
      dash.appendChild(kpis)

      var byCategory = stats.storageByCategory || {}
      var segments = el('div', 'nn-storage-bar')
      var legend = el('div', 'nn-storage-legend')
      var palette = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444']
      FILES_CATEGORIES.forEach(function (cat, i) {
        var bytes = byCategory[cat.id] || 0
        if (!bytes) return
        var pct = stats.totalBytes ? (bytes / stats.totalBytes) * 100 : 0
        var seg = el('div', 'nn-storage-segment')
        seg.style.width = pct.toFixed(2) + '%'
        seg.style.background = palette[i % palette.length]
        seg.setAttribute('title', cat.title + ': ' + filesFmtBytes(bytes))
        segments.appendChild(seg)
        var item = el('span', 'nn-storage-legend-item')
        var dot = el('span', 'nn-storage-legend-dot')
        dot.style.background = palette[i % palette.length]
        item.appendChild(dot)
        item.appendChild(el('span', null, cat.title + ' ' + filesFmtBytes(bytes)))
        legend.appendChild(item)
      })
      var storageWrap = el('div', 'nn-storage-bar-wrap')
      storageWrap.appendChild(el('h3', 'nn-files-section-title', 'Storage distribution'))
      storageWrap.appendChild(segments)
      storageWrap.appendChild(legend)
      dash.appendChild(storageWrap)

      if (origins.length) {
        var table = doc.createElement('table')
        table.className = 'nn-origins-table'
        // Origin rows are filesystem facts, not knowledge-unit references, so
        // the Ku tree guard's exemption marker applies to the whole table.
        table.setAttribute('data-ku-exempt', '1')
        var thead = doc.createElement('thead')
        var hr = doc.createElement('tr')
        ;['Origin', 'State', 'Files'].forEach(function (h) {
          hr.appendChild(el('th', null, h))
        })
        thead.appendChild(hr)
        table.appendChild(thead)
        var tbody = doc.createElement('tbody')
        origins.forEach(function (o) {
          var tr = doc.createElement('tr')
          var tdOrigin = doc.createElement('td')
          tdOrigin.appendChild(el('code', null, String(o.alias || o.id)))
          if (o.origin) tdOrigin.appendChild(el('span', null, ' ' + String(o.origin)))
          tr.appendChild(tdOrigin)
          var tdState = doc.createElement('td')
          tdState.appendChild(el('span', 'nn-origin-state-dot ' + (o.state || 'adhoc')))
          tdState.appendChild(el('span', null, ' ' + String(o.state || 'adhoc')))
          tr.appendChild(tdState)
          tr.appendChild(el('td', null, String((o.files || []).length)))
          tbody.appendChild(tr)
        })
        table.appendChild(tbody)
        var originsWrap = el('div', 'nn-files-origins')
        originsWrap.appendChild(el('h3', 'nn-files-section-title', 'Origins'))
        originsWrap.appendChild(table)
        dash.appendChild(originsWrap)
      }

      var alerts = el('div', 'nn-files-alerts')
      function alert(count, one, many) {
        if (!count) return
        var card = el('div', 'nn-integrity-alert')
        card.appendChild(el('strong', null, String(count)))
        card.appendChild(el('span', null, ' ' + (count === 1 ? one : many)))
        alerts.appendChild(card)
      }
      alert(
        stats.uncitedSourceCount,
        'source file is never cited by a knowledge unit or a change',
        'source files are never cited by a knowledge unit or a change',
      )
      alert(stats.sidecarMissingCount, 'file has no sidecar', 'files have no sidecar')
      alert(
        stats.sidecarInvalidCount,
        'sidecar has an invalid frontmatter',
        'sidecars have an invalid frontmatter',
      )
      alert(
        stats.sidecarMismatchCount,
        'sidecar digest no longer matches its file',
        'sidecar digests no longer match their file',
      )
      if (alerts.childNodes.length) {
        var alertsWrap = el('div', 'nn-files-section')
        alertsWrap.appendChild(el('h3', 'nn-files-section-title', 'Integrity signals'))
        alertsWrap.appendChild(alerts)
        dash.appendChild(alertsWrap)
      }

      detail.appendChild(dash)
    }

    /* ---- per-file detail -------------------------------------------------- */

    function renderFileDetail(entry) {
      if (!detail) return
      detail.innerHTML = ''
      var card = el('div', 'nn-file-detail-card')

      var crumb = el('div', 'nn-file-detail-breadcrumb')
      var back = doc.createElement('a')
      back.setAttribute('href', '#files')
      back.textContent = 'Workspace overview'
      back.addEventListener('click', function (ev) {
        ev.preventDefault()
        selectFile('')
      })
      crumb.appendChild(back)
      crumb.appendChild(el('span', null, ' / ' + entry.path))
      card.appendChild(crumb)

      var header = el('div', 'nn-file-detail-header')
      header.appendChild(el('h2', 'nn-file-detail-title', filesBaseName(entry.path)))
      header.appendChild(
        el('span', 'nn-badge', FILES_CATEGORY_LABEL[entry.category] || entry.category),
      )
      card.appendChild(header)
      card.appendChild(el('p', 'nn-file-detail-path', entry.path))

      var attrs = el('div', 'nn-file-attrs-grid')
      function attr(label, value, extra) {
        var cell = el('div', 'nn-file-attr')
        cell.appendChild(el('span', 'nn-file-attr-label', label))
        var val = el('span', 'nn-file-attr-value', value)
        if (extra) val.appendChild(extra)
        cell.appendChild(val)
        attrs.appendChild(cell)
      }
      attr('Size', filesFmtBytes(entry.size))
      attr('Type', String(entry.mimeType || ''))
      attr('Modified', entry.mtime ? String(entry.mtime) : '\u2014')
      var copy = doc.createElement('button')
      copy.type = 'button'
      copy.className = 'nn-hash-copy'
      copy.textContent = String(entry.sha256 || '').slice(0, 16)
      copy.setAttribute('title', 'Copy full SHA-256')
      copy.addEventListener('click', function () {
        var text = String(entry.sha256 || '')
        var view = doc.defaultView
        if (view && view.navigator && view.navigator.clipboard) {
          try {
            view.navigator.clipboard.writeText(text)
          } catch {
            /* clipboard unavailable offline */
          }
        }
        copy.textContent = 'copied'
        if (view && view.setTimeout) {
          view.setTimeout(function () {
            copy.textContent = text.slice(0, 16)
          }, 1200)
        }
      })
      attr('SHA-256', '', copy)
      card.appendChild(attrs)

      if (entry.sidecar) {
        var side = el('div', 'nn-file-section')
        side.appendChild(el('h3', 'nn-files-section-title', 'Sidecar'))
        var status = el('p', 'nn-file-sidecar-status')
        if (!entry.sidecar.exists) {
          status.textContent = 'No sidecar for this file.'
        } else if (!entry.sidecar.valid) {
          status.textContent =
            'Sidecar is not valid: ' + String(entry.sidecar.error || 'unknown error')
        } else {
          status.textContent =
            'Sidecar ' +
            String(entry.sidecar.path || '') +
            (entry.sidecar.sha256Matches === false
              ? ' — digest does not match the file (stale sidecar).'
              : ' — digest matches the file.')
        }
        side.appendChild(status)
        card.appendChild(side)
      }

      var citedUnits = unitsByPath[entry.path] || []
      var citedChanges = changesByPath[entry.path] || []
      var citSection = el('div', 'nn-file-section')
      citSection.appendChild(
        el('h3', 'nn-files-section-title', 'Knowledge units (' + String(citedUnits.length) + ')'),
      )
      if (citedUnits.length) {
        var list = el('div', 'nn-lineage-units')
        citedUnits.forEach(function (uid) {
          list.appendChild(kuBadge(uid))
        })
        citSection.appendChild(list)
      } else {
        citSection.appendChild(
          el(
            'p',
            'nn-file-hint',
            citedChanges.length
              ? 'No knowledge unit cites this file directly; the changes below reference it.'
              : 'No knowledge unit cites this file, and no change uses it as evidence.',
          ),
        )
      }
      card.appendChild(citSection)

      if (citedChanges.length) {
        var changeSection = el('div', 'nn-file-section')
        changeSection.appendChild(
          el('h3', 'nn-files-section-title', 'Changes (' + String(citedChanges.length) + ')'),
        )
        var changeList = el('div', 'nn-lineage-units')
        citedChanges.forEach(function (csId) {
          changeList.appendChild(similarBadge('change', csId))
        })
        changeSection.appendChild(changeList)
        card.appendChild(changeSection)
      }

      var line = lineage[entry.path]
      if (line) {
        var tiers = el('div', 'nn-lineage-tier')
        tiers.appendChild(el('h3', 'nn-lineage-tier-title', 'Reverse lineage'))
        var chain = el('div', 'nn-lineage-units')
        ;(line.unitIds || []).forEach(function (uid) {
          chain.appendChild(kuBadge(uid))
        })
        tiers.appendChild(chain)
        if ((line.changesetIds || []).length) {
          tiers.appendChild(el('p', 'nn-lineage-sub', 'Changes: ' + line.changesetIds.join(', ')))
        }
        if ((line.sourcePaths || []).length) {
          tiers.appendChild(
            el('p', 'nn-lineage-sub', 'Original files: ' + line.sourcePaths.join(', ')),
          )
        }
        card.appendChild(tiers)
      }

      var actions = el('div', 'nn-file-actions')
      var openBtn = doc.createElement('button')
      openBtn.type = 'button'
      openBtn.className = 'nn-btn nn-btn-secondary'
      openBtn.textContent = 'Open / Preview'
      openBtn.addEventListener('click', function () {
        openPreview(entry)
      })
      actions.appendChild(openBtn)
      card.appendChild(actions)

      detail.appendChild(card)
    }

    /* ---- pipeline view ---------------------------------------------------- */

    function renderPipeline() {
      if (!pipeline) return
      pipeline.innerHTML = ''
      var sourcesStage = inventory.filter(function (f) {
        return f.category === 'source'
      })
      var artifactsStage = inventory.filter(function (f) {
        return f.category === 'artifact'
      })
      var unitSet = {}
      Object.keys(unitsByPath).forEach(function (p) {
        unitsByPath[p].forEach(function (uid) {
          unitSet[uid] = true
        })
      })
      Object.keys(lineage).forEach(function (k) {
        ;(lineage[k].unitIds || []).forEach(function (uid) {
          unitSet[uid] = true
        })
      })
      var unitIds = Object.keys(unitSet).sort()
      // Changes come from the domain's own changeset records; lineage only adds
      // the highlighting, so the column is never empty when changes exist.
      var changeRecords = Array.isArray(opts.changes) ? opts.changes : []
      var changeNode = {}
      changeRecords.forEach(function (cs) {
        var path = String((cs && cs.path) || '')
        var id = path
          .split('/')
          .pop()
          .replace(/_changes_NN\.md$/i, '')
        if (id)
          changeNode[id] = { name: (cs && cs.title) || id, sub: (cs && cs.status) || 'changeset' }
      })
      Object.keys(lineage).forEach(function (k) {
        ;(lineage[k].changesetIds || []).forEach(function (id) {
          if (!changeNode[id]) changeNode[id] = { name: id, sub: 'changeset' }
        })
      })
      var changeIds = Object.keys(changeNode).sort()

      var content = {
        origins: origins.map(function (o) {
          return {
            id: 'origin:' + o.id,
            name: o.alias || o.id,
            sub: (o.files || []).length + ' files · ' + (o.state || 'adhoc'),
          }
        }),
        sources: sourcesStage.map(function (f) {
          return {
            id: 'file:' + f.path,
            name: filesBaseName(f.path),
            sub: FILES_CATEGORY_LABEL[f.category] + ' · ' + filesFmtBytes(f.size),
          }
        }),
        changes: changeIds.map(function (id) {
          return { id: 'change:' + id, name: changeNode[id].name, sub: changeNode[id].sub }
        }),
        units: unitIds.map(function (id) {
          var target = elementsById[id]
          return {
            id: 'unit:' + id,
            unitId: id,
            name: (target && (target.name || target.slug)) || id,
            sub: 'knowledge unit',
          }
        }),
        artifacts: artifactsStage.map(function (f) {
          return { id: 'file:' + f.path, name: filesBaseName(f.path), sub: filesFmtBytes(f.size) }
        }),
      }

      FILES_PIPELINE_STAGES.forEach(function (stage) {
        // The Origins column exists only when something declares an origin.
        if (stage.id === 'origins' && !origins.length) return
        var col = el('div', 'nn-pipeline-stage')
        var head = el('div', 'nn-pipeline-stage-head')
        head.appendChild(el('span', null, stage.title))
        head.appendChild(el('span', 'nn-category-badge', String(content[stage.id].length)))
        col.appendChild(head)
        var nodes = el('div', 'nn-pipeline-nodes')
        content[stage.id].forEach(function (item) {
          nodes.appendChild(pipelineNode(stage.id, item))
        })
        col.appendChild(nodes)
        pipeline.appendChild(col)
      })

      // Clicking the empty area of the flow clears the pinned selection.
      pipeline.onclick = function (ev) {
        if (ev && ev.target === pipeline) clearPipelineSelection()
      }
    }

    function pipelineNode(stageId, item) {
      var node = el('div', 'nn-pipeline-node')
      node.setAttribute('data-node', item.id)
      node.setAttribute('role', 'button')
      node.setAttribute('tabindex', '0')
      node.setAttribute('aria-pressed', 'false')
      node.setAttribute('title', item.name + ' \u2014 ' + item.sub)
      // Units use the official console badge; every other stage is not a KU and
      // gets the matching non-unit badge.
      var badge =
        stageId === 'units' && item.unitId
          ? kuBadge(item.unitId)
          : similarBadge(stageId, item.name, item.sub)
      node.appendChild(badge)
      node.addEventListener('click', function (ev) {
        // Badge affordances (kebab, actions, change pip) belong to the KU
        // framework: do not swallow them, and do not select on their click.
        var target = ev && ev.target
        if (
          target &&
          typeof target.closest === 'function' &&
          target.closest(
            '[data-ku-more], .nn-ku-more, [data-ku-action], .nn-ku-action, .nn-ku-change-pip, [data-nn-component="ku-change-pip"]',
          )
        ) {
          return
        }
        selectPipelineNode(item.id)
      })
      node.addEventListener('keydown', function (ev) {
        var key = ev && ev.key
        if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return
        var target = ev && ev.target
        if (
          target &&
          typeof target.closest === 'function' &&
          target.closest(
            '[data-ku-more], .nn-ku-more, [data-ku-action], .nn-ku-action, .nn-ku-change-pip, [data-nn-component="ku-change-pip"]',
          )
        ) {
          return
        }
        if (ev.preventDefault) ev.preventDefault()
        selectPipelineNode(item.id)
      })
      return node
    }

    // Selection replaces the old hover trace: a click pins the node and its
    // connected chain; clicking the same node (or the empty column area) clears.
    function selectPipelineNode(nodeId) {
      state.pipelineSelected = state.pipelineSelected === nodeId ? '' : nodeId
      syncPipelineSelection()
      // A file node keeps its explorer detail in sync with the pinned node.
      var path = nodeId.indexOf('file:') === 0 ? nodeId.slice(5) : ''
      if (state.pipelineSelected && path && byPath[path]) selectFile(path)
    }

    function clearPipelineSelection() {
      state.pipelineSelected = ''
      syncPipelineSelection()
    }

    function syncPipelineSelection() {
      if (!pipeline) return
      if (state.pipelineSelected) highlight(state.pipelineSelected)
      else clearHighlight()
      var nodes = pipeline.querySelectorAll('.nn-pipeline-node')
      ;[].slice.call(nodes).forEach(function (node) {
        var on = node.getAttribute('data-node') === state.pipelineSelected
        node.classList.toggle('nn-pipeline-selected', on)
        node.setAttribute('aria-pressed', on ? 'true' : 'false')
      })
    }

    // Selection tracing: a source lights up the units that cite it, the changes
    // that use it as evidence, and the artifacts whose reverse lineage points
    // back at it. Tracing works bidirectionally from any stage (origins, sources,
    // changes, units, artifacts). Everything else dims.
    function connectedTo(nodeId) {
      var out = {}
      out[nodeId] = true

      if (nodeId.indexOf('file:') === 0) {
        var path = nodeId.slice(5)
        lightOrigins(out, path)
        var units = unitsByPath[path] || []
        units.forEach(function (uid) {
          out['unit:' + uid] = true
        })
        ;(changesByPath[path] || []).forEach(function (csId) {
          out['change:' + csId] = true
        })
        if (lineage[path]) {
          var entry = lineage[path]
          ;(entry.sourcePaths || []).forEach(function (sp) {
            out['file:' + sp] = true
            lightOrigins(out, sp)
          })
          ;(entry.unitIds || []).forEach(function (uid) {
            out['unit:' + uid] = true
          })
          ;(entry.changesetIds || []).forEach(function (csId) {
            out['change:' + csId] = true
          })
        }
        Object.keys(lineage).forEach(function (artifactPath) {
          var entry = lineage[artifactPath]
          var hit =
            (entry.sourcePaths || []).indexOf(path) >= 0 ||
            (entry.unitIds || []).some(function (uid) {
              return units.indexOf(uid) >= 0
            })
          if (hit) {
            out['file:' + artifactPath] = true
            ;(entry.changesetIds || []).forEach(function (id) {
              out['change:' + id] = true
            })
          }
        })
      } else if (nodeId.indexOf('unit:') === 0) {
        var uid = nodeId.slice(5)
        Object.keys(unitsByPath).forEach(function (p) {
          if ((unitsByPath[p] || []).indexOf(uid) >= 0) {
            out['file:' + p] = true
            lightOrigins(out, p)
            ;(changesByPath[p] || []).forEach(function (csId) {
              out['change:' + csId] = true
            })
          }
        })
        var targetEl = elementsById[uid]
        if (targetEl && Array.isArray(targetEl.history)) {
          targetEl.history.forEach(function (h) {
            if (h.batch) out['change:' + h.batch.replace(/_changes_NN$/, '')] = true
          })
        }
        Object.keys(lineage).forEach(function (artifactPath) {
          var entry = lineage[artifactPath]
          if ((entry.unitIds || []).indexOf(uid) >= 0) {
            out['file:' + artifactPath] = true
            ;(entry.changesetIds || []).forEach(function (id) {
              out['change:' + id] = true
            })
          }
        })
      } else if (nodeId.indexOf('change:') === 0) {
        var csId = nodeId.slice(7)
        Object.keys(changesByPath).forEach(function (p) {
          if ((changesByPath[p] || []).indexOf(csId) >= 0) {
            out['file:' + p] = true
            lightOrigins(out, p)
            ;(unitsByPath[p] || []).forEach(function (uid) {
              out['unit:' + uid] = true
            })
          }
        })
        Object.keys(lineage).forEach(function (artifactPath) {
          var entry = lineage[artifactPath]
          if ((entry.changesetIds || []).indexOf(csId) >= 0) {
            out['file:' + artifactPath] = true
          }
        })
      } else if (nodeId.indexOf('origin:') === 0) {
        var originId = nodeId.slice(7)
        inventory.forEach(function (f) {
          if ((originIdsByPath[f.path] || []).indexOf(originId) >= 0) {
            out['file:' + f.path] = true
            ;(unitsByPath[f.path] || []).forEach(function (uid) {
              out['unit:' + uid] = true
            })
            ;(changesByPath[f.path] || []).forEach(function (csId) {
              out['change:' + csId] = true
            })
          }
        })
      }

      return out
    }

    function highlight(nodeId) {
      var keep = connectedTo(nodeId)
      var nodes = pipeline.querySelectorAll('.nn-pipeline-node')
      ;[].slice.call(nodes).forEach(function (node) {
        var id = node.getAttribute('data-node')
        var isSelected = id === nodeId
        var isConnected = !!keep[id]
        node.classList.toggle('nn-pipeline-highlight', isSelected)
        node.classList.toggle('nn-pipeline-connected', isConnected && !isSelected)
        node.classList.toggle('dimmed', !isConnected)
        if (isSelected) {
          node.style.order = '-2'
        } else if (isConnected) {
          node.style.order = '-1'
        } else {
          node.style.order = '0'
        }
      })
      // Reset scroll to top on all stages so elevated items are immediately visible
      var cols = pipeline.querySelectorAll('.nn-pipeline-nodes')
      ;[].slice.call(cols).forEach(function (col) {
        col.scrollTop = 0
      })
    }

    function clearHighlight() {
      var nodes = pipeline.querySelectorAll('.nn-pipeline-node')
      ;[].slice.call(nodes).forEach(function (node) {
        node.classList.remove('dimmed')
        node.classList.remove('nn-pipeline-highlight')
        node.classList.remove('nn-pipeline-connected')
        node.style.order = ''
      })
    }

    /* ---- preview dialog --------------------------------------------------- */

    function openPreview(entry) {
      if (!dialog) return
      var title = doc.getElementById('nn-file-preview-title')
      var badge = doc.getElementById('nn-file-preview-badge')
      var size = doc.getElementById('nn-file-preview-size')
      var body = doc.getElementById('nn-file-preview-body')
      if (title) title.textContent = filesBaseName(entry.path)
      if (badge) badge.textContent = FILES_CATEGORY_LABEL[entry.category] || entry.category
      if (size) size.textContent = filesFmtBytes(entry.size)
      if (!body) return
      body.innerHTML = ''

      var mime = String(entry.mimeType || '')
      var truncated = entry.snippetTruncated === true
      if (typeof entry.snippet === 'string' && mime.indexOf('image/') !== 0) {
        var pre = el('pre', 'nn-file-preview-code')
        var code = doc.createElement('code')
        // textContent: file content is never parsed as markup (XSS invariant).
        code.textContent = entry.snippet
        pre.appendChild(code)
        body.appendChild(pre)
        if (truncated) {
          body.appendChild(
            el(
              'p',
              'nn-file-preview-note',
              'Preview truncated. The complete file stays in the workspace.',
            ),
          )
        }
      } else {
        var card = el('div', 'nn-file-binary-card')
        card.appendChild(el('p', null, 'This file is not inlined in the console payload.'))
        card.appendChild(el('p', 'nn-file-attr-value', 'SHA-256: ' + String(entry.sha256 || '')))
        card.appendChild(el('p', 'nn-file-attr-value', 'Workspace path: ' + entry.path))
        body.appendChild(card)
      }

      var copyBtn = doc.getElementById('nn-file-preview-copy')
      if (copyBtn) {
        copyBtn.onclick = function () {
          var view = doc.defaultView
          if (
            view &&
            view.navigator &&
            view.navigator.clipboard &&
            typeof entry.snippet === 'string'
          ) {
            try {
              view.navigator.clipboard.writeText(entry.snippet)
            } catch {
              /* clipboard unavailable */
            }
          }
        }
      }
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', 'open')
    }

    function closePreview() {
      if (!dialog) return
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }

    if (dialog && !dialog.getAttribute('data-nn-bound')) {
      dialog.setAttribute('data-nn-bound', '1')
      var closeBtn = doc.getElementById('nn-file-preview-close')
      var dismissBtn = doc.getElementById('nn-file-preview-dismiss')
      if (closeBtn) closeBtn.addEventListener('click', closePreview)
      if (dismissBtn) dismissBtn.addEventListener('click', closePreview)
      dialog.addEventListener('click', function (ev) {
        if (ev.target === dialog) closePreview()
      })
    }

    /* ---- state ------------------------------------------------------------ */

    function setMode(mode) {
      state.mode = mode === 'pipeline' ? 'pipeline' : 'explorer'
      if (explorerBtn) explorerBtn.classList.toggle('active', state.mode === 'explorer')
      if (pipelineBtn) pipelineBtn.classList.toggle('active', state.mode === 'pipeline')
      if (split) split.style.display = state.mode === 'explorer' ? 'flex' : 'none'
      if (pipeline) pipeline.style.display = state.mode === 'pipeline' ? 'flex' : 'none'
      if (statPill) {
        statPill.textContent =
          state.mode === 'explorer'
            ? String(inventory.length) + ' files'
            : String(FILES_PIPELINE_STAGES.length) + ' stages'
      }
    }

    function selectFile(path) {
      state.selected = path && byPath[path] ? path : ''
      if (state.selected) {
        renderFileDetail(byPath[state.selected])
        try {
          if (doc.location) doc.location.hash = '#files&path=' + encodeURIComponent(state.selected)
        } catch {
          /* file:// may refuse hash writes */
        }
      } else {
        renderDashboard()
        try {
          if (doc.location) doc.location.hash = '#files'
        } catch {
          /* ignore */
        }
      }
      renderSidebar()
    }

    if (explorerBtn)
      explorerBtn.addEventListener('click', function () {
        setMode('explorer')
      })
    if (pipelineBtn)
      pipelineBtn.addEventListener('click', function () {
        setMode('pipeline')
      })

    renderSidebar()
    renderDashboard()
    renderPipeline()
    setMode('explorer')

    // Deep link: #files&path=<encoded workspace path>
    function hashPath() {
      var h = doc.location ? String(doc.location.hash || '') : ''
      var mm = /(?:^#|&)path=([^&]+)/.exec(h)
      if (!mm) return ''
      try {
        return decodeURIComponent(mm[1])
      } catch {
        return ''
      }
    }

    var onHashPath = function () {
      var wanted = hashPath()
      if (wanted && byPath[wanted]) {
        if (wanted !== state.selected) selectFile(wanted)
        return
      }
      if (!wanted && state.selected && /^#files(?![&\w])/.test(String(doc.location.hash || ''))) {
        selectFile('')
      }
    }
    if (doc.defaultView) doc.defaultView.addEventListener('hashchange', onHashPath)

    var initial = hashPath()
    if (initial && byPath[initial]) selectFile(initial)
  }

  // One Changes tab: Unsent on top (the only change signal a model view carries),
  // the applied history below. The history reads the payload `changes` collection.
  function renderReviewTab(doc, state, config, onRefresh, container) {
    var host =
      container ||
      (doc && typeof doc.getElementById === 'function' ? doc.getElementById('nn-tab-review') : null)
    var inDialog = !!container
    if (!host) return
    host.innerHTML = ''

    var drafts = state && state.store ? state.store.drafts() : []
    var changes = state && Array.isArray(state.changes) ? state.changes : []
    var byId = elementsByIdOf(state)
    var root = el(
      'div',
      inDialog ? 'nn-review-tab-content' : 'nn-review-tab-content p-6 max-w-5xl mx-auto',
    )
    if (!root) return

    var head = el(
      'section',
      'nn-review-head flex justify-between items-center mb-6 pb-4 border-b border-base-200',
    )
    if (head) {
      var titleWrap = el('div')
      if (!inDialog)
        titleWrap.appendChild(el('h2', 'text-2xl font-bold tracking-tight', UI.COPY.changes))
      var count = el(
        'p',
        'nn-review-count text-sm opacity-70 mt-1',
        drafts.length + (drafts.length === 1 ? ' pending change' : ' pending changes'),
      )
      if (count) titleWrap.appendChild(count)
      var staleCount = drafts.filter(function (d) {
        return Review.isTargetChanged(d, byId) && !Review.isAlreadyApplied(d, byId)
      }).length
      if (staleCount > 0) {
        var staleNote = el(
          'p',
          'nn-review-stale text-sm mt-1',
          staleCount +
            (staleCount === 1 ? ' unsent change targets' : ' unsent changes target') +
            ' an element that changed since it was written: review before exporting.',
        )
        if (staleNote) {
          staleNote.setAttribute('data-nn', 'stale-drafts')
          staleNote.style.color = '#b45309'
          titleWrap.appendChild(staleNote)
        }
      }
      head.appendChild(titleWrap)

      if (drafts.length > 0 && !inDialog) {
        var exportBtn = el(
          'button',
          'nn-btn nn-tab-export-btn btn btn-primary btn-sm flex items-center gap-2 shadow-sm',
          'Export changes',
        )
        if (exportBtn) {
          exportBtn.setAttribute('type', 'button')
          if (typeof nnIcons !== 'undefined' && typeof nnIcons.getSvg === 'function') {
            exportBtn.innerHTML =
              nnIcons.getSvg('download', { size: 14 }) + '<span>Export changes</span>'
          }
          exportBtn.addEventListener('click', function () {
            openExportModal(doc, state)
          })
          head.appendChild(exportBtn)
        }
      }
      root.appendChild(head)
    }

    function goTo(rawElementId) {
      if (inDialog) {
        var dialog = host.closest('dialog')
        if (dialog && typeof dialog.close === 'function') dialog.close()
        else if (dialog) dialog.removeAttribute('open')
      }
      var elRec = findElementForTarget(state && state.elements, rawElementId)
      focusElementCard(doc, elRec ? elRec.id : rawElementId)
    }

    // Revert an applied update_field: one unsent change on the same element and
    // field, from the current value back to the change's `from` (or a clear).
    function revertChange(entry) {
      if (!state || !state.store || !entry) return
      var elRec = findElementForTarget(state.elements, entry.target)
      var field = entry.field || targetFieldOf(entry.target)
      if (!elRec || !field) return
      var current =
        field === 'name'
          ? elRec.name
          : field === 'description'
            ? elRec.description
            : elRec.fields
              ? elRec.fields[field]
              : undefined
      state.store.addDraft({
        element_id: elRec.id,
        concept: elRec.concept,
        element: elRec.name,
        kind: 'correction',
        field: field,
        original: current,
        proposed: entry.from != null ? entry.from : '',
        base_hash: elRec.hash,
      })
      if (typeof onRefresh === 'function') onRefresh()
    }

    function openSource(source) {
      openSourceCitation(doc, source)
    }

    var unsent = el('section', 'nn-changes-unsent mb-8')
    if (unsent) {
      unsent.appendChild(el('h3', 'text-lg font-semibold mb-2', UI.COPY.unsent))
      if (drafts.length > 0) {
        var banner = el('div', 'nn-changes-banner alert alert-info text-sm mb-3', UI.COPY.banner)
        if (banner) {
          banner.setAttribute('data-nn', 'publication-banner')
          unsent.appendChild(banner)
        }
        unsent.appendChild(
          UI.DraftList(
            { drafts: drafts, byId: byId },
            {
              doc: doc,
              isTargetChanged: Review.isTargetChanged,
              onDelete: function (id) {
                if (state && state.store) state.store.removeDraft(id)
                if (typeof onRefresh === 'function') onRefresh()
              },
              onGoTo: goTo,
              onCitation: openSource,
            },
          ),
        )
      } else {
        var note = el('p', 'nn-changes-banner-note text-sm opacity-70 mb-3', UI.COPY.bannerShort)
        if (note) note.setAttribute('data-nn', 'publication-note')
        unsent.appendChild(note)
        unsent.appendChild(
          el(
            'div',
            'empty-state nn-review-empty text-sm p-4 rounded-lg',
            'No unsent changes. Edit an element to record one.',
          ),
        )
      }
      root.appendChild(unsent)
    }

    var applied = el('section', 'nn-changes-applied')
    if (applied) {
      applied.appendChild(el('h3', 'text-lg font-semibold mb-2', UI.COPY.applied))
      var history = UI.ChangeHistory(
        { changes: changes, byId: byId },
        { doc: doc, onGoTo: goTo, onRevert: revertChange, onCitation: openSource },
      )
      if (history && history.children.length > 0) {
        applied.appendChild(history)
      } else {
        applied.appendChild(
          el(
            'div',
            'empty-state nn-review-empty text-sm p-4 rounded-lg',
            'No applied changes yet.',
          ),
        )
      }
      root.appendChild(applied)
    }

    host.appendChild(root)
  }

  function focusElementCard(doc, elementId) {
    if (!doc || !elementId) return
    // A scoped console has no explorer to focus a card in.
    if (doc.documentElement && doc.documentElement.hasAttribute('data-nn-scope')) return
    // 1. Switch active tab to explorer if view tabs exist
    var tabsNav = doc.getElementById('nn-view-tabs')
    if (tabsNav) {
      var explorerBtn = tabsNav.querySelector('.nn-view-tab[data-tab="explorer"]')
      if (explorerBtn && typeof explorerBtn.click === 'function') {
        explorerBtn.click()
      } else {
        var firstTab = tabsNav.querySelector('.nn-view-tab')
        if (firstTab && typeof firstTab.click === 'function') firstTab.click()
      }
    }
    // 2. Find card by id (cards carry the `el-` prefixed domId, matching `#el-` hrefs)
    var card = doc.getElementById('el-' + String(elementId))
    // The card can sit in a page the progressive render window has not mounted yet:
    // mount that one page first, then focus and scroll it. A card the current view
    // does not carry at all leaves the DOM untouched (stale link, wrong view).
    if (!card) {
      var content = doc.getElementById('nn-content')
      var cardWindow = content && content.__nnCardWindow
      if (
        cardWindow &&
        typeof cardWindow.revealElement === 'function' &&
        cardWindow.revealElement(elementId)
      ) {
        card = doc.getElementById('el-' + String(elementId))
      }
    }
    if (card) {
      if (typeof card.setOpen === 'function' && card.getAttribute('data-open') === 'false') {
        card.setOpen(true)
      }
      if (typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      card.classList.add('nn-highlight')
      setTimeout(function () {
        card.classList.remove('nn-highlight')
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
    var dialog = doc.getElementById('nn-ref-dialog')
    if (!dialog || typeof dialog.showModal !== 'function') return
    dialog.innerHTML = ''
    var head = el('div', 'nn-ref-head')
    var h = el('h2', null, String(element.name || 'Element'))
    var close = el('button', 'nn-ref-close', '×')
    if (close) {
      close.setAttribute('type', 'button')
      close.setAttribute('aria-label', 'Close')
      close.addEventListener('click', function () {
        if (typeof dialog.close === 'function') dialog.close()
      })
    }
    if (head && h) head.appendChild(h)
    if (head && close) head.appendChild(close)
    var body = el('div', 'nn-ref-body')
    var refModel = element.modelId || ''
    var tag =
      UI && typeof UI.Ku === 'function'
        ? UI.Ku(
            'section',
            {
              model: refModel,
              concept: element.concept || 'Element',
              label: String(element.concept || 'Element'),
            },
            { doc: doc },
          )
        : el('span', 'nn-ref-tag', String(element.concept || 'Element'))
    if (body && tag) body.appendChild(tag)
    if (body && element.description) {
      var p = el('p', 'nn-ref-desc', element.description)
      if (p) body.appendChild(p)
    }
    if (body && isObject(element.fields)) {
      var dl = el('dl', 'nn-ref-fields')
      Object.keys(element.fields).forEach(function (k) {
        if (!dl || k === 'sources' || k === 'source') return
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
    var dialog = doc.getElementById('nn-media-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'nn-media-dialog'
      dialog.setAttribute('aria-label', 'Media preview')
      if (doc.body) doc.body.appendChild(dialog)
    }
    var index = typeof start === 'number' && start >= 0 && start < items.length ? start : 0

    function render() {
      dialog.innerHTML = ''
      var item = items[index] || { name: '', value: '' }
      var head = el('div', 'nn-ref-head')
      var h = el('h2', null, item.name || 'Media')
      var close = el('button', 'nn-ref-close', '×')
      if (close) {
        close.setAttribute('type', 'button')
        close.setAttribute('aria-label', 'Close')
        close.addEventListener('click', function () {
          if (typeof dialog.close === 'function') dialog.close()
        })
      }
      if (head && h) head.appendChild(h)
      if (head && close) head.appendChild(close)

      var body = el('div', 'nn-media-body')
      var img = doc.createElement('img')
      var rawSrc = String(item.value || '')
      var normMatch = rawSrc
        .replace(/\\/g, '/')
        .match(/^.+?\/((?:sources|kNNowledge|assets|evidence)\/.+)$/)
      img.setAttribute('src', normMatch ? normMatch[1] : rawSrc)
      img.setAttribute('alt', item.name || '')
      img.className = 'nn-media-image'
      img.addEventListener('error', function () {
        var cur = img.getAttribute('src') || ''
        var relMatch = !img.getAttribute('data-retried') && cur.match(/^.+?(\bsources\/.+)$/)
        if (relMatch) {
          img.setAttribute('data-retried', '1')
          img.setAttribute('src', relMatch[1])
        }
      })
      if (body) body.appendChild(img)

      var bar = el('div', 'nn-media-bar')
      if (items.length > 1 && bar) {
        var prev = el('button', 'nn-media-nav', '‹')
        prev.setAttribute('type', 'button')
        prev.setAttribute('aria-label', 'Previous media')
        if (index === 0) prev.setAttribute('disabled', 'disabled')
        prev.addEventListener('click', function () {
          if (index > 0) {
            index -= 1
            render()
          }
        })
        var counter = el('span', 'nn-media-count', index + 1 + ' / ' + items.length)
        var next = el('button', 'nn-media-nav', '›')
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
      dl.className = 'nn-media-download'
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
    var dialog = doc.getElementById('nn-field-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'nn-field-dialog'
      dialog.setAttribute('aria-label', 'Field detail')
      if (doc.body) doc.body.appendChild(dialog)
    }
    dialog.innerHTML = ''
    var head = el('div', 'nn-ref-head')
    var h = el('h2', null, String(field.name || 'Field'))
    var close = el('button', 'nn-ref-close', '×')
    if (close) {
      close.setAttribute('type', 'button')
      close.setAttribute('aria-label', 'Close')
      close.addEventListener('click', function () {
        if (typeof dialog.close === 'function') dialog.close()
      })
    }
    if (head && h) head.appendChild(h)
    if (head && close) head.appendChild(close)
    var body = el('div', 'nn-field-detail-body')
    if (field.elementName)
      body.appendChild(el('p', 'nn-field-detail-meta', String(field.elementName)))
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
      body.appendChild(el('pre', 'nn-field-detail-value', textVal !== '' ? textVal : '(empty)'))
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

  // ---- Summary tab: the domaiNN at a glance -------------------------------------

  function fieldHasValue(value) {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim() !== ''
    if (Array.isArray(value)) return value.length > 0
    return true
  }

  function pct(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 100) : 0
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many)
  }

  // Declared vs filled fields over a set of elements. A field counts as declared
  // when the schema lists it for the element's concept.
  function fieldFill(elements, schema) {
    var declared = {}
    ;(schema && Array.isArray(schema.fields) ? schema.fields : []).forEach(function (f) {
      if (!f || !f.concept || !f.name) return
      ;(declared[f.concept] = declared[f.concept] || []).push(f.name)
    })
    var total = 0
    var filled = 0
    elements.forEach(function (e) {
      var names = declared[e.concept] || []
      var values = (e && e.fields) || {}
      total += names.length
      names.forEach(function (n) {
        if (fieldHasValue(values[n])) filled++
      })
    })
    return { total: total, filled: filled }
  }

  // A concept name that opens Knowledge filtered by that concept.
  function conceptLink(doc, concept, label) {
    var a = el('a', 'nn-concept-link', label || concept)
    a.setAttribute('href', '#explorer')
    a.setAttribute('data-concept', concept)
    a.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault()
      revealInKnowledge(doc, formatFacetToken('concept', concept))
    })
    return a
  }

  // A concept as the console's own concept badge: clicking its name opens the concept
  // window (the badge's details panel, the same one its ⋮ opens).
  function conceptBadge(doc, modelId, concept, schema) {
    var holder = el('span', 'nn-summary-concept-ref')
    holder.setAttribute('data-concept', concept)
    var meta = conceptMetaOf(schema && schema.concepts, concept)
    var badge = UI.Ku(
      'section',
      { model: modelId, concept: concept, label: concept, index: meta.index, color: meta.color },
      { doc: doc },
    )
    holder.appendChild(badge)
    var unit = holder.querySelector('.nn-ku')
    if (unit) {
      unit.style.cursor = 'pointer'
      unit.addEventListener('click', function () {
        openConceptWindow(holder)
      })
    }
    return holder
  }

  function openConceptWindow(holder) {
    var more = holder && holder.querySelector('[data-ku-more]')
    if (more && typeof more.click === 'function') more.click()
  }

  // Each model card: title, bluepriNNt, size, completeness and a stacked bar of its
  // elements by concept (ECharts; the card still reads without it).
  function renderSummaryModelCard(doc, m, elements, schema) {
    var own = elements.filter(function (e) {
      return e.modelId === m.id
    })
    var byConcept = {}
    own.forEach(function (e) {
      byConcept[e.concept] = (byConcept[e.concept] || 0) + 1
    })
    var concepts = Object.keys(byConcept)
    var fill = fieldFill(own, schema)
    var card = el('article', 'nn-summary-model')
    card.setAttribute('data-model', m.id)
    var head = el('header', 'nn-summary-model-head')
    head.appendChild(el('h3', 'nn-summary-model-title', m.title || m.id))
    head.appendChild(el('span', 'nn-summary-model-blueprint', m.blueprint || ''))
    card.appendChild(head)
    card.appendChild(
      el(
        'p',
        'nn-summary-model-stats',
        plural(own.length, 'element', 'elements') +
          ' · ' +
          plural(concepts.length, 'concept', 'concepts') +
          ' · ' +
          pct(fill.filled, fill.total) +
          '% fields filled',
      ),
    )
    var chartHost = el('div', 'nn-summary-model-chart')
    card.appendChild(chartHost)
    // Every concept the model's bluepriNNt declares, the empty ones too, then any
    // concept that only appears in the data.
    var listed = (Array.isArray(m.declaredConcepts) ? m.declaredConcepts.slice() : []).filter(
      function (c, i, all) {
        return all.indexOf(c) === i
      },
    )
    concepts.forEach(function (c) {
      if (listed.indexOf(c) < 0) listed.push(c)
    })
    var legend = el('ul', 'nn-summary-model-legend')
    listed.forEach(function (c) {
      var li = el('li')
      li.setAttribute('data-concept', c)
      var dot = el('span', 'nn-summary-dot')
      dot.style.background = conceptMetaOf(schema && schema.concepts, c).hexColor
      li.appendChild(dot)
      li.appendChild(conceptBadge(doc, m.id, c, schema))
      li.appendChild(el('span', 'nn-summary-count', String(byConcept[c] || 0)))
      legend.appendChild(li)
    })
    card.appendChild(legend)
    var open = el('button', 'nn-summary-model-open', 'Open in Knowledge')
    open.setAttribute('type', 'button')
    open.addEventListener('click', function () {
      revealInKnowledge(doc, formatFacetToken('model', m.id))
    })
    card.appendChild(open)
    if (concepts.length) {
      var chart = Studio.renderChart(chartHost, {
        animation: false,
        grid: { left: 4, right: 4, top: 4, bottom: 4 },
        tooltip: { trigger: 'item', formatter: '{a}: {c}' },
        xAxis: { type: 'value', show: false, max: own.length },
        yAxis: { type: 'category', show: false, data: [m.title || m.id] },
        series: concepts.map(function (c) {
          return {
            type: 'bar',
            name: c,
            stack: 'elements',
            barWidth: 18,
            data: [byConcept[c]],
            itemStyle: { color: conceptMetaOf(schema && schema.concepts, c).hexColor },
          }
        }),
      })
      if (chart) {
        chart.on('click', function (params) {
          var row = legend.querySelector(
            'li[data-concept="' + String(params.seriesName).replace(/"/g, '') + '"]',
          )
          openConceptWindow(row)
        })
      }
    }
    return card
  }

  function renderSummaryView(doc, model, schema, meta) {
    // Only into the panel of the built-in tab: a panel with this id that some other
    // shell or view owns is left alone.
    if (!summaryModels(meta).length) return
    var host = doc.getElementById('nn-tab-domain')
    if (!host) return
    host.innerHTML = ''
    var models = summaryModels(meta)
    var elements = (model && Array.isArray(model.elements) ? model.elements : []).filter(
      function (e) {
        return e && e.modelId !== 'changes'
      },
    )
    var conceptNames = metamodelConceptNames(schema, elements)
    var changes = model && Array.isArray(model.changes) ? model.changes : []
    var pending = changes.filter(function (c) {
      return c && c.status === 'proposed'
    }).length
    var fill = fieldFill(elements, schema)
    var domain = (meta && meta.domain) || {}
    // The model a concept belongs to, for its badge address: the first model that
    // holds or declares it.
    function conceptHome(c) {
      for (var i = 0; i < models.length; i++) {
        var mm = models[i]
        var names = (mm.declaredConcepts || []).concat(mm.conceptNames || [])
        if (names.indexOf(c) >= 0) return mm.id
      }
      return (meta && (meta.modelId || meta.model)) || ''
    }

    var root = el('div', 'nn-summary')
    if (domain.title) root.appendChild(el('h2', 'nn-summary-title', domain.title))

    var kpis = el('div', 'nn-files-kpis nn-summary-kpis')
    kpis.appendChild(kpiCard('Models', String(models.length), 'documents of kNNowledge'))
    kpis.appendChild(kpiCard('Concepts', String(conceptNames.length), 'types of card'))
    kpis.appendChild(kpiCard('Elements', String(elements.length), 'cards across all models'))
    kpis.appendChild(
      kpiCard('Sources', String(Number(domain.sourceCount) || 0), 'documents the models cite'),
    )
    kpis.appendChild(kpiCard('Pending changes', String(pending), 'proposed, not yet applied'))
    kpis.appendChild(
      kpiCard(
        'Fields filled',
        pct(fill.filled, fill.total) + '%',
        fill.filled + ' of ' + fill.total,
      ),
    )
    root.appendChild(kpis)

    // What to look at: the gaps a newcomer should know about, each a link.
    var hints = []
    var counts = {}
    elements.forEach(function (e) {
      counts[e.concept] = (counts[e.concept] || 0) + 1
    })
    var empty = conceptNames.filter(function (c) {
      return !counts[c]
    })
    if (empty.length === 1) hints.push({ concepts: empty, text: ' has no elements yet.' })
    else if (empty.length > 1) hints.push({ concepts: empty, text: ' have no elements yet.' })
    conceptNames.forEach(function (c) {
      if (!counts[c]) return
      var f = fieldFill(
        elements.filter(function (e) {
          return e.concept === c
        }),
        schema,
      )
      var p = pct(f.filled, f.total)
      if (f.total > 0 && p < 50)
        hints.push({ concepts: [c], text: ': only ' + p + '% of its fields are filled.' })
    })
    if (pending)
      hints.push({ text: plural(pending, 'change is', 'changes are') + ' waiting for review.' })
    if (hints.length) {
      var attention = el('section', 'nn-summary-attention')
      attention.appendChild(el('h3', null, 'What to look at'))
      var list = el('ul')
      hints.forEach(function (h) {
        var li = el('li')
        ;(h.concepts || []).forEach(function (c, i) {
          if (i) li.appendChild(doc.createTextNode(i === h.concepts.length - 1 ? ' and ' : ', '))
          li.appendChild(conceptBadge(doc, conceptHome(c), c, schema))
        })
        li.appendChild(doc.createTextNode(h.text))
        list.appendChild(li)
      })
      attention.appendChild(list)
      root.appendChild(attention)
    }

    root.appendChild(el('h3', 'nn-summary-section', 'Models'))
    var grid = el('div', 'nn-summary-models')
    root.appendChild(grid)
    host.appendChild(root)
    // Cards are drawn after they are in the document so the charts get a width.
    models.forEach(function (m) {
      grid.appendChild(renderSummaryModelCard(doc, m, elements, schema))
    })
  }

  // ---- Versions tab: which bluepriNNts, whether they are current, what is installed ----

  var VERSION_STATUS = {
    current: ['Up to date', 'ok'],
    'upgrade-available': ['Update available', 'warn'],
    ahead: ['Newer than the catalog', 'info'],
    unlisted: ['Not in the cogNNitive catalog', 'info'],
    unpinned: ['No version pinned', 'warn'],
    unknown: ['Not checked (catalog unavailable)', 'muted'],
  }

  function versionStatusLabel(row) {
    var entry = VERSION_STATUS[row.status] || VERSION_STATUS.unknown
    var gap = row.status === 'upgrade-available' && row.gap ? ' (' + row.gap + ')' : ''
    return { text: entry[0] + gap, tone: entry[1] }
  }

  function versionOrigin(row) {
    if (row.status === 'unlisted') return 'Local bluepriNNt'
    if (row.status === 'unknown' || row.status === 'unpinned') return '—'
    return 'Published by cogNNitive'
  }

  function versionsTable(cls, headers, rows) {
    var table = el('table', 'nn-versions-table ' + cls)
    // Software versions, not kNNowledge: no cell is an addressable unit.
    table.setAttribute('data-ku-exempt', '1')
    var thead = el('thead')
    var htr = el('tr')
    headers.forEach(function (h) {
      htr.appendChild(el('th', null, h))
    })
    thead.appendChild(htr)
    table.appendChild(thead)
    var tbody = el('tbody')
    rows.forEach(function (cells) {
      var tr = el('tr')
      cells.forEach(function (cell) {
        if (cell && cell.nodeType) {
          var td = el('td')
          td.appendChild(cell)
          tr.appendChild(td)
        } else {
          tr.appendChild(el('td', null, cell == null || cell === '' ? '—' : String(cell)))
        }
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    return table
  }

  var INSTALL_SCOPE_TEXT = {
    domain: "This domaiNN's own installation (.agents/bootstrap-state.json in the domaiNN).",
    user: 'The installation of the user who exported this console (~/.agents/bootstrap-state.json).',
    file: 'The installation record given at export time.',
  }

  function renderVersionsView(doc, meta) {
    if (!(meta && meta.versions && typeof meta.versions === 'object')) return
    var host = doc.getElementById('nn-tab-versions')
    if (!host) return
    host.innerHTML = ''
    var versions = (meta && meta.versions) || {}
    var root = el('div', 'nn-versions')
    var checked = meta && meta.generated ? String(meta.generated).slice(0, 10) : ''
    root.appendChild(
      el(
        'p',
        'nn-versions-checked',
        (checked ? 'Checked on ' + checked + ', when this console was exported. ' : '') +
          'The console never goes online: export it again to refresh these versions.',
      ),
    )

    var bp = el('section', 'nn-versions-section nn-versions-blueprints')
    bp.appendChild(el('h3', null, 'BluepriNNts used by this domaiNN'))
    bp.appendChild(
      el(
        'p',
        'nn-versions-hint',
        'Each model follows a bluepriNNt. "Pinned" is the version the model declares; "Latest" is the newest one cogNNitive publishes.',
      ),
    )
    var blueprints = Array.isArray(versions.blueprints) ? versions.blueprints : []
    var titleById = {}
    ;(meta && Array.isArray(meta.models) ? meta.models : []).forEach(function (m) {
      if (m && m.id) titleById[m.id] = m.title || m.id
    })
    bp.appendChild(
      versionsTable(
        'nn-versions-blueprints-table',
        ['BluepriNNt', 'Used by', 'Pinned', 'Latest', 'Status', 'Origin'],
        blueprints.map(function (row) {
          var label = versionStatusLabel(row)
          var badge = el('span', 'nn-versions-status nn-versions-status--' + label.tone, label.text)
          var usedBy = (row.models || []).map(function (id) {
            return titleById[id] || id
          })
          return [row.name, usedBy.join(', '), row.pinned, row.adopted, badge, versionOrigin(row)]
        }),
      ),
    )
    if (versions.catalog === 'unavailable') {
      bp.appendChild(
        el(
          'p',
          'nn-versions-hint',
          'The bluepriNNt catalog could not be read at export time, so no version was checked.',
        ),
      )
    }
    if (
      blueprints.some(function (row) {
        return row.status === 'upgrade-available'
      })
    ) {
      bp.appendChild(
        el(
          'p',
          'nn-versions-hint',
          'To move a model to a newer bluepriNNt, use the nn-update skill.',
        ),
      )
    }
    root.appendChild(bp)

    var inst = el('section', 'nn-versions-section nn-versions-installation')
    inst.appendChild(el('h3', null, 'Installed cogNNitive'))
    var record = versions.installation
    if (record && Array.isArray(record.components) && record.components.length) {
      inst.appendChild(el('p', 'nn-versions-hint', INSTALL_SCOPE_TEXT[record.scope] || ''))
      inst.appendChild(
        versionsTable(
          'nn-versions-installation-table',
          ['Component', 'Name', 'Version', 'Updated'],
          record.components.map(function (c) {
            return [c.kind, c.name, c.version, c.updatedAt]
          }),
        ),
      )
    } else {
      inst.appendChild(
        el(
          'p',
          'nn-versions-hint',
          'No installation record was found when this console was exported.',
        ),
      )
    }
    var check = el('p', 'nn-versions-hint')
    check.appendChild(
      doc.createTextNode(
        'Newer skills, MCP server and console versions cannot be checked offline. Run ',
      ),
    )
    check.appendChild(el('code', null, 'node skills-manager.js status'))
    check.appendChild(doc.createTextNode(' to compare with the latest cogNNitive release.'))
    inst.appendChild(check)
    root.appendChild(inst)
    host.appendChild(root)
  }

  // ---- Map tab: how the domaiNN is built and what one element is linked to -------
  // A treemap nests models, concepts and elements by size; below it, one element and
  // its links one hop away (never the whole element graph: a force layout with a
  // couple of thousand nodes blocks the page for many seconds).

  // Links between elements: `relations` from the payload, plus field values that
  // address another element (`model@slug`, a slug of the same model, or `[[Name]]`).
  function elementLinks(elements) {
    var byId = {}
    var byModelName = {}
    elements.forEach(function (e) {
      byId[e.id] = e
      byModelName[e.modelId + '\u0000' + String(e.name).toLowerCase()] = e
    })
    function resolve(from, raw) {
      if (typeof raw !== 'string') return null
      var v = raw.trim().replace(/^\[\[|\]\]$/g, '')
      if (!v) return null
      if (byId[v]) return byId[v]
      if (byId[from.modelId + '@' + v]) return byId[from.modelId + '@' + v]
      return byModelName[from.modelId + '\u0000' + v.toLowerCase()] || null
    }
    var out = {}
    var inc = {}
    var seen = {}
    function add(from, to, field) {
      if (!to || to.id === from.id) return
      var key = from.id + '\u0000' + to.id + '\u0000' + field
      if (seen[key]) return
      seen[key] = true
      ;(out[from.id] = out[from.id] || []).push({ id: to.id, field: field })
      ;(inc[to.id] = inc[to.id] || []).push({ id: from.id, field: field })
    }
    elements.forEach(function (e) {
      var fields = (e && e.fields) || {}
      Object.keys(fields).forEach(function (name) {
        var values = Array.isArray(fields[name]) ? fields[name] : [fields[name]]
        values.forEach(function (v) {
          add(e, resolve(e, v), name)
        })
      })
      ;(Array.isArray(e.relations) ? e.relations : []).forEach(function (r) {
        if (r && r.target) add(e, byId[r.target], r.field || '')
      })
    })
    return { byId: byId, out: out, inc: inc }
  }

  function renderMapTree(host, domainTitle, models, elements, schema, onPick) {
    var tree = models.map(function (m) {
      var own = elements.filter(function (e) {
        return e.modelId === m.id
      })
      var byConcept = {}
      own.forEach(function (e) {
        ;(byConcept[e.concept] = byConcept[e.concept] || []).push(e)
      })
      return {
        name: (m.title || m.id) + (m.blueprint ? ' · ' + m.blueprint : ''),
        children: Object.keys(byConcept).map(function (c) {
          var color = conceptMetaOf(schema && schema.concepts, c).hexColor
          return {
            name: c,
            value: byConcept[c].length,
            itemStyle: { color: color },
            label: { formatter: '{b} ({c})' },
            children: byConcept[c].map(function (e) {
              return {
                name: e.name || e.id,
                value: 1,
                elementId: e.id,
                itemStyle: { color: color },
              }
            }),
          }
        }),
      }
    })
    var chart = Studio.renderChart(host, {
      animation: false,
      tooltip: { formatter: '{b}: {c}' },
      series: [
        {
          type: 'treemap',
          name: domainTitle,
          data: tree,
          leafDepth: 2,
          roam: false,
          nodeClick: 'zoomToNode',
          breadcrumb: { show: true, bottom: 6 },
          upperLabel: { show: true, height: 24, color: '#111827', fontWeight: 'bold' },
          label: { show: true, color: '#ffffff', fontSize: 11 },
          levels: [
            { itemStyle: { borderColor: '#e5e7eb', borderWidth: 4, gapWidth: 4 } },
            { itemStyle: { borderColor: '#ffffff', borderWidth: 2, gapWidth: 2 } },
            { itemStyle: { borderColor: '#ffffff', borderWidth: 1, gapWidth: 1 } },
          ],
        },
      ],
    })
    if (chart) {
      chart.on('click', function (params) {
        if (params.data && params.data.elementId) onPick(params.data.elementId)
      })
    }
  }

  function renderMapView(doc, model, schema, meta) {
    if (
      !summaryModels(meta).length ||
      !(Array.isArray(model && model.elements) && model.elements.length)
    )
      return
    var host = doc.getElementById('nn-tab-map')
    if (!host) return
    host.innerHTML = ''
    var models = summaryModels(meta)
    var elements = (model && Array.isArray(model.elements) ? model.elements : []).filter(
      function (e) {
        return e && e.id && e.modelId !== 'changes'
      },
    )
    var titleOf = {}
    models.forEach(function (m) {
      titleOf[m.id] = m.title || m.id
    })
    var links = elementLinks(elements)
    function linkCount(id) {
      return (links.out[id] || []).length + (links.inc[id] || []).length
    }

    var root = el('div', 'nn-map')
    root.appendChild(el('h3', 'nn-map-title', 'How the domaiNN is built'))
    root.appendChild(
      el(
        'p',
        'nn-map-hint',
        'Each box is a model; inside it, its concepts; inside those, their elements. Bigger means more elements. Click a box to go in, the bar at the bottom to come back out, and an element to see its links below.',
      ),
    )
    var treeHost = el('div', 'nn-map-tree')
    root.appendChild(treeHost)

    root.appendChild(el('h3', 'nn-map-title', 'Around one element'))
    var picker = el('label', 'nn-map-picker', 'Element ')
    var select = el('select', 'nn-map-pick')
    models.forEach(function (m) {
      var group = el('optgroup')
      group.setAttribute('label', titleOf[m.id])
      elements
        .filter(function (e) {
          return e.modelId === m.id
        })
        .forEach(function (e) {
          var opt = el('option', null, (e.name || e.id) + ' (' + e.concept + ')')
          opt.value = e.id
          group.appendChild(opt)
        })
      select.appendChild(group)
    })
    picker.appendChild(select)
    root.appendChild(picker)
    var wordsHost = el('p', 'nn-map-words')
    root.appendChild(wordsHost)
    var egoHost = el('div', 'nn-map-ego')
    root.appendChild(egoHost)
    var open = el('button', 'nn-summary-model-open', 'Open in Knowledge')
    open.setAttribute('type', 'button')
    root.appendChild(open)
    host.appendChild(root)

    function nameOf(id) {
      var e = links.byId[id]
      return e ? e.name || e.id : id
    }

    function linkList(items) {
      var span = el('span')
      items.forEach(function (item, i) {
        if (i) span.appendChild(doc.createTextNode(', '))
        var a = el('a', 'nn-concept-link', nameOf(item.id))
        a.setAttribute('href', '#map')
        a.setAttribute('data-element', item.id)
        a.addEventListener('click', function (event) {
          if (event && event.preventDefault) event.preventDefault()
          show(item.id)
        })
        span.appendChild(a)
        if (item.field) span.appendChild(doc.createTextNode(' (' + item.field + ')'))
      })
      return span
    }

    function show(id) {
      var center = links.byId[id]
      if (!center) return
      select.value = id
      var outs = links.out[id] || []
      var ins = links.inc[id] || []
      wordsHost.innerHTML = ''
      wordsHost.appendChild(
        doc.createTextNode(
          nameOf(id) +
            ' (' +
            center.concept +
            ', ' +
            (titleOf[center.modelId] || center.modelId) +
            ') ',
        ),
      )
      if (outs.length) {
        wordsHost.appendChild(doc.createTextNode('points to: '))
        wordsHost.appendChild(linkList(outs))
        wordsHost.appendChild(doc.createTextNode('. '))
      } else {
        wordsHost.appendChild(doc.createTextNode('points to nothing. '))
      }
      if (ins.length) {
        wordsHost.appendChild(doc.createTextNode('Pointed to by: '))
        wordsHost.appendChild(linkList(ins))
        wordsHost.appendChild(doc.createTextNode('.'))
      } else {
        wordsHost.appendChild(doc.createTextNode('Nothing points to it.'))
      }

      var ids = [id]
      outs.concat(ins).forEach(function (n) {
        if (ids.indexOf(n.id) < 0) ids.push(n.id)
      })
      var chart = Studio.renderChart(
        egoHost,
        {
          animation: false,
          tooltip: { formatter: '{b}' },
          series: [
            {
              type: 'graph',
              layout: 'circular',
              circular: { rotateLabel: false },
              roam: true,
              top: 50,
              bottom: 60,
              left: 120,
              right: 120,
              edgeSymbol: ['none', 'arrow'],
              edgeSymbolSize: 9,
              label: { show: true, position: 'bottom', fontSize: 11, color: '#1f2937' },
              data: ids.map(function (nid) {
                var e = links.byId[nid]
                var isCenter = nid === id
                return {
                  id: nid,
                  name: nameOf(nid),
                  symbolSize: isCenter ? 46 : 26,
                  itemStyle: {
                    color: conceptMetaOf(schema && schema.concepts, e.concept).hexColor,
                    borderColor: isCenter ? '#111827' : '#ffffff',
                    borderWidth: isCenter ? 3 : 1,
                  },
                  label: { fontWeight: isCenter ? 'bold' : 'normal' },
                }
              }),
              links: outs
                .map(function (n) {
                  return { source: id, target: n.id, field: n.field }
                })
                .concat(
                  ins.map(function (n) {
                    return { source: n.id, target: id, field: n.field }
                  }),
                )
                .map(function (l) {
                  return {
                    source: l.source,
                    target: l.target,
                    lineStyle: { color: '#64748b', width: 1.5, curveness: 0.1 },
                    label: {
                      show: !!l.field,
                      formatter: l.field,
                      fontSize: 10,
                      color: '#334155',
                      backgroundColor: '#ffffff',
                    },
                  }
                }),
            },
          ],
        },
        { height: 340 },
      )
      if (chart) {
        chart.on('click', function (params) {
          if (params.dataType === 'node' && params.data && params.data.id !== id)
            show(params.data.id)
        })
      }
    }

    open.addEventListener('click', function () {
      if (select.value) focusElementCard(doc, select.value)
    })
    select.addEventListener('change', function () {
      show(select.value)
    })

    renderMapTree(
      treeHost,
      (meta && meta.domain && meta.domain.title) || 'domaiNN',
      models,
      elements,
      schema,
      show,
    )

    var start = elements.reduce(function (best, e) {
      return !best || linkCount(e.id) > linkCount(best.id) ? e : best
    }, null)
    if (start) show(start.id)
  }

  // ---- Schema tab: the concepts as an entity-relationship diagram ----------------
  // One box per concept with its fields, grouped by the bluepriNNt that declares it;
  // solid lines are matrices, dashed lines are fields that point to another concept.
  // The same schema is also told in words below the chart, so it reads without it.

  var SCHEMA_BOX_WIDTH = 230
  var SCHEMA_GAP_X = 100
  var SCHEMA_GAP_Y = 110
  var SCHEMA_MAX_COLS = 4
  var SCHEMA_MAX_FIELDS = 8
  var SCHEMA_LINE = 17
  var SCHEMA_HEADER = 34
  var SCHEMA_PAD = 20
  var SCHEMA_ANCHOR = '__nn-schema-anchor-'

  // The relationships between concepts: declared matrices, reference fields of the
  // schema, and references found in the data. One entry per source, target and label.
  function schemaEdges(schema, matrices, elements, conceptNames) {
    var known = {}
    conceptNames.forEach(function (c) {
      known[c] = true
    })
    var seen = {}
    var edges = []
    function add(kind, source, target, label) {
      if (!known[source] || !known[target]) return
      var key = kind + '\u0000' + source + '\u0000' + target + '\u0000' + label
      if (seen[key]) return
      seen[key] = true
      edges.push({ kind: kind, source: source, target: target, label: label })
    }
    var allMatrices = (Array.isArray(matrices) ? matrices : []).concat(
      schema && Array.isArray(schema.matrices) ? schema.matrices : [],
    )
    allMatrices.forEach(function (m) {
      if (m && m.source && m.target) add('matrix', m.source, m.target, m.name || '')
    })
    ;(schema && Array.isArray(schema.fields) ? schema.fields : []).forEach(function (f) {
      ;(Array.isArray(f && f.target_concepts) ? f.target_concepts : []).forEach(function (t) {
        add('reference', f.concept, t, f.name)
      })
    })
    var conceptOf = {}
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (e && e.id) conceptOf[e.id] = e.concept
    })
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      ;(Array.isArray(e && e.relations) ? e.relations : []).forEach(function (r) {
        var t = r && conceptOf[r.target]
        if (t) add('reference', e.concept, t, r.field || '')
      })
    })
    return edges
  }

  function schemaFamilyOf(schema, concept) {
    var list = schema && Array.isArray(schema.concepts) ? schema.concepts : []
    for (var i = 0; i < list.length; i++) {
      var c = list[i]
      if (c && typeof c === 'object' && c.name === concept)
        return (c.declaredBy && c.declaredBy.family) || 'Other'
    }
    return 'Other'
  }

  function renderSchemaInWords(doc, groups, fieldsOf, counts, edges) {
    var words = el('section', 'nn-schema-words')
    words.appendChild(el('h3', 'nn-schema-words-title', 'The schema in words'))
    groups.forEach(function (g) {
      var group = el('div', 'nn-schema-group')
      group.appendChild(el('h3', null, g.family))
      var list = el('ul')
      g.concepts.forEach(function (c) {
        var li = el('li', 'nn-schema-concept')
        li.appendChild(conceptLink(doc, c))
        var text = ' — ' + plural(counts[c] || 0, 'element', 'elements') + '.'
        var fields = fieldsOf[c] || []
        if (fields.length) {
          text +=
            ' Fields: ' +
            fields
              .map(function (f) {
                return f.name + ' (' + (f.type || 'text') + ')'
              })
              .join(', ') +
            '.'
        }
        var refs = edges.filter(function (e) {
          return e.kind === 'reference' && e.source === c
        })
        if (refs.length) {
          text +=
            ' Points to ' +
            refs
              .map(function (e) {
                return e.target + (e.label ? ' (' + e.label + ')' : '')
              })
              .join(', ') +
            '.'
        }
        var mats = edges.filter(function (e) {
          return e.kind === 'matrix' && e.source === c
        })
        if (mats.length) {
          text +=
            ' Matrix with ' +
            mats
              .map(function (e) {
                return e.target + (e.label ? ' (' + e.label + ')' : '')
              })
              .join(', ') +
            '.'
        }
        li.appendChild(doc.createTextNode(text))
        list.appendChild(li)
      })
      group.appendChild(list)
      words.appendChild(group)
    })
    return words
  }

  function renderMetamodelView(doc, schema, matrices, elements) {
    var host = doc.getElementById('nn-tab-metamodel')
    if (!host) return
    host.innerHTML = ''
    // A domaiNN schema keeps one concept per bluepriNNt, so a name can repeat; the
    // diagram shows it once (graph nodes are keyed by name).
    var conceptNames = metamodelConceptNames(schema, elements).filter(function (c, i, all) {
      return all.indexOf(c) === i
    })
    if (!conceptNames.length) {
      host.appendChild(el('p', 'empty-state', 'No concepts to map.'))
      return
    }
    var counts = {}
    ;(Array.isArray(elements) ? elements : []).forEach(function (e) {
      if (e && e.concept) counts[e.concept] = (counts[e.concept] || 0) + 1
    })
    var fieldsOf = {}
    ;(schema && Array.isArray(schema.fields) ? schema.fields : []).forEach(function (f) {
      if (f && f.concept && f.name) (fieldsOf[f.concept] = fieldsOf[f.concept] || []).push(f)
    })
    var groups = []
    var groupOf = {}
    conceptNames.forEach(function (c) {
      var family = schemaFamilyOf(schema, c)
      if (!groupOf[family]) {
        groupOf[family] = { family: family, concepts: [] }
        groups.push(groupOf[family])
      }
      groupOf[family].concepts.push(c)
    })
    var edges = schemaEdges(schema, matrices, elements, conceptNames)

    var root = el('div', 'nn-schema')
    var legend = el('p', 'nn-schema-legend')
    legend.textContent =
      'Each box is a concept with its fields, grouped by bluepriNNt. A solid line is a matrix; a dashed line is a field that points to another concept. Click a box to see its elements; drag or scroll to move around.'
    root.appendChild(legend)
    var chartHost = el('div', 'nn-schema-chart')
    root.appendChild(chartHost)
    root.appendChild(renderSchemaInWords(doc, groups, fieldsOf, counts, edges))
    host.appendChild(root)

    // Layout: each bluepriNNt starts a new band of rows; boxes keep their real size
    // because the chart is sized to the layout instead of squeezing it into the view.
    var nodes = []
    var y = 0
    var cols = 1
    groups.forEach(function (g) {
      for (var i = 0; i < g.concepts.length; i += SCHEMA_MAX_COLS) {
        var row = g.concepts.slice(i, i + SCHEMA_MAX_COLS)
        cols = Math.max(cols, row.length)
        var heights = row.map(function (c) {
          var lines = Math.min((fieldsOf[c] || []).length, SCHEMA_MAX_FIELDS)
          if ((fieldsOf[c] || []).length > SCHEMA_MAX_FIELDS) lines++
          return SCHEMA_HEADER + Math.max(lines, 1) * SCHEMA_LINE + 14
        })
        var rowHeight = Math.max.apply(null, heights)
        row.forEach(function (c, k) {
          nodes.push({
            name: c,
            h: heights[k],
            x: SCHEMA_PAD + SCHEMA_BOX_WIDTH / 2 + k * (SCHEMA_BOX_WIDTH + SCHEMA_GAP_X),
            y: SCHEMA_PAD + y + heights[k] / 2,
          })
        })
        y += rowHeight + SCHEMA_GAP_Y
      }
    })
    var width = cols * SCHEMA_BOX_WIDTH + (cols - 1) * SCHEMA_GAP_X + 2 * SCHEMA_PAD
    var height = Math.max(200, y - SCHEMA_GAP_Y + 2 * SCHEMA_PAD)
    // ECharts fits the node centres into the view. Two invisible anchors at the
    // canvas corners make that box the whole canvas, so the scale stays 1:1 and
    // no box is cut or squeezed.
    var anchors = [
      [SCHEMA_ANCHOR + 'start', 0, 0],
      [SCHEMA_ANCHOR + 'end', width, height],
    ].map(function (a) {
      return {
        name: a[0],
        x: a[1],
        y: a[2],
        symbolSize: 0,
        silent: true,
        label: { show: false },
        tooltip: { show: false },
      }
    })
    chartHost.style.height = height + 'px'
    chartHost.style.width = width + 'px'

    var chart = null
    try {
      chart = Studio.renderChart(
        chartHost,
        {
          animation: false,
          tooltip: { trigger: 'item', confine: true },
          series: [
            {
              type: 'graph',
              layout: 'none',
              roam: true,
              draggable: true,
              left: 0,
              top: 0,
              width: width,
              height: height,
              edgeSymbol: ['none', 'arrow'],
              edgeSymbolSize: 9,
              autoCurveness: true,
              data: anchors.concat(
                nodes.map(function (n) {
                  var color = conceptMetaOf(schema && schema.concepts, n.name).hexColor
                  var fields = fieldsOf[n.name] || []
                  var lines = fields.slice(0, SCHEMA_MAX_FIELDS).map(function (f) {
                    return '{f|' + f.name + '}  {k|' + (f.type || 'text') + '}'
                  })
                  if (fields.length > SCHEMA_MAX_FIELDS)
                    lines.push('{k|+' + (fields.length - SCHEMA_MAX_FIELDS) + ' more fields}')
                  if (!lines.length) lines.push('{k|no fields}')
                  return {
                    name: n.name,
                    x: n.x,
                    y: n.y,
                    symbol: 'rect',
                    symbolSize: [SCHEMA_BOX_WIDTH, n.h],
                    itemStyle: { color: '#ffffff', borderColor: color, borderWidth: 2 },
                    label: {
                      show: true,
                      position: [8, 8],
                      align: 'left',
                      verticalAlign: 'top',
                      width: SCHEMA_BOX_WIDTH - 16,
                      overflow: 'truncate',
                      formatter:
                        '{t|' +
                        n.name +
                        '  ·  ' +
                        plural(counts[n.name] || 0, 'element', 'elements') +
                        '}\n' +
                        lines.join('\n'),
                      rich: {
                        t: {
                          width: SCHEMA_BOX_WIDTH - 16,
                          backgroundColor: color,
                          color: '#ffffff',
                          fontWeight: 'bold',
                          fontSize: 12,
                          padding: [5, 6],
                          borderRadius: 3,
                        },
                        f: { fontSize: 11, color: '#1f2937', lineHeight: SCHEMA_LINE },
                        k: { fontSize: 10, color: '#6b7280', lineHeight: SCHEMA_LINE },
                      },
                    },
                    tooltip: {
                      formatter:
                        n.name +
                        ': ' +
                        (fields.length
                          ? fields
                              .map(function (f) {
                                return f.name
                              })
                              .join(', ')
                          : 'no fields'),
                    },
                  }
                }),
              ),
              links: edges.map(function (e) {
                return {
                  source: e.source,
                  target: e.target,
                  lineStyle: {
                    type: e.kind === 'matrix' ? 'solid' : 'dashed',
                    width: 1.5,
                    color: '#64748b',
                  },
                  label: {
                    show: !!e.label,
                    formatter: e.label,
                    fontSize: 10,
                    color: '#334155',
                    backgroundColor: '#ffffff',
                    padding: [1, 3],
                  },
                }
              }),
            },
          ],
        },
        { width: width, height: height },
      )
    } catch (err) {
      // The schema in words below still explains the domaiNN without the diagram.
      if (typeof console !== 'undefined' && console.warn)
        console.warn('nn-console: schema diagram failed', err)
    }
    if (chart) {
      chart.on('click', function (params) {
        if (params.dataType === 'node')
          revealInKnowledge(doc, formatFacetToken('concept', params.name))
      })
    }
  }

  // Citation detail dialog (Console Citation Icons / Tanda C). Reuses the
  // nn-ref-dialog markup/classes so no second stylesheet is needed. Unlike
  // renderRefDialog, it creates #nn-citation-dialog and appends it to
  // <body> when the shell does not already declare it, so old shells (built
  // before this change) still work once the runtime is updated.
  function renderCitationDialog(doc, fieldName, entries) {
    if (!doc || !Array.isArray(entries)) return
    var dialog = doc.getElementById('nn-citation-dialog')
    if (!dialog) {
      dialog = doc.createElement('dialog')
      dialog.id = 'nn-citation-dialog'
      dialog.setAttribute('aria-label', 'Citation details')
      var host = doc.body
      if (host) host.appendChild(dialog)
    }
    if (typeof dialog.showModal !== 'function') return
    dialog.innerHTML = ''

    var head = el('div', 'nn-ref-head')
    var h = el('h2', null, 'Citations: ' + String(fieldName || ''))
    var close = el('button', 'nn-ref-close', '×')
    if (close) {
      close.setAttribute('type', 'button')
      close.setAttribute('aria-label', 'Close')
      close.addEventListener('click', function () {
        if (typeof dialog.close === 'function') dialog.close()
      })
    }
    if (head && h) head.appendChild(h)
    if (head && close) head.appendChild(close)

    var body = el('div', 'nn-ref-body')
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
          : el('span', 'nn-ref-tag', tagText)
      var card = el('article', 'nn-cite-card')
      if (card) card.setAttribute('data-origin', variantKey)
      var head = el('div', 'nn-cite-head')
      if (head && tag) head.appendChild(tag)
      var prov = el('span', 'nn-cite-prov', labelText)
      if (
        prov &&
        typeof nnIcons !== 'undefined' &&
        nnIcons &&
        typeof nnIcons.getSvg === 'function'
      ) {
        prov.insertAdjacentHTML('afterbegin', nnIcons.getSvg('cite-' + variantKey, { size: 13 }))
      }
      if (head && prov) head.appendChild(prov)
      // An `unchecked` entry (a change source nothing has resolved) claims no status.
      var status = entry.unchecked
        ? null
        : el(
            'span',
            'nn-cite-status' + (entry.error ? ' is-bad' : ''),
            entry.error ? 'unresolved' : 'resolved',
          )
      if (head && status) head.appendChild(status)
      if (card && head) card.appendChild(head)
      // The card goes into the list first; its children are appended below.
      if (card) body.appendChild(card)

      var dl = el('dl', 'nn-ref-fields nn-cite-meta')
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
        var openHref =
          UI && typeof UI.safeHref === 'function'
            ? UI.safeHref(entry.href)
            : safeSourceHref(entry.href)
        var openLink = openHref ? el('a', 'nn-cite-open', 'Open original') : null
        if (openLink) {
          openLink.setAttribute('href', openHref)
          openLink.setAttribute('target', '_blank')
          openLink.setAttribute('rel', 'noopener noreferrer')
          card.appendChild(openLink)
        }
      }

      if (entry.excerpt && card) {
        var excerptText = entry.excerpt + (entry.truncated ? ' … (truncated)' : '')
        var pre = el('pre', 'nn-cite-excerpt', excerptText)
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
    var host = doc.getElementById('nn-doc')
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
    var host = doc.getElementById('nn-doc')
    if (!host) return
    var visuals = typeof self !== 'undefined' && self.nnVisuals ? self.nnVisuals : null
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
      renderDocument(doc, chainOf(root), {
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
    var config = parseConfig(slotText(active, 'nn-config'))
    if (!hasNeed(config, 'feedback-export')) return null

    var existing = active.querySelector('[data-nn-feedback-root]')
    if (existing) return existing

    var root = active.createElement('div')
    root.setAttribute('data-nn-feedback-root', '')

    // The modal shell and its list are styled by nn-ui.css (the stylesheet of
    // record) and by the shared dialog classes in the kit: no per-render <style>
    // and no second visual language to keep in sync.

    // Banner
    var banner = active.createElement('header')
    banner.id = 'nn-feedback-banner'
    banner.setAttribute('aria-label', 'Console review banner')

    var title = active.createElement('strong')
    title.textContent = state ? state.modelTitle : 'iNNfo Console'
    banner.appendChild(title)

    var version = active.createElement('span')
    version.className = 'nn-banner-version'
    version.textContent = ' ' + (state ? state.modelVersion : '')
    banner.appendChild(version)

    var draftsBadge = active.createElement('span')
    draftsBadge.className = 'nn-banner-drafts'
    draftsBadge.setAttribute('data-nn', 'draft-count')
    draftsBadge.textContent = ' unsent: 0'
    banner.appendChild(draftsBadge)

    root.appendChild(banner)

    // Modal: shared dialog chrome (head/body/actions) + one change sheet per
    // unsent draft inside it. The root keeps its OWN class, never .nn-edit-modal:
    // that class identifies the element edit dialog, and the export dialog is in
    // the DOM from boot, so sharing it would hijack every global
    // querySelector('.nn-edit-modal').
    var modal = active.createElement('dialog')
    modal.id = 'nn-feedback-modal'
    modal.className = 'nn-export-modal'
    modal.setAttribute('aria-label', 'Changes')
    modal.innerHTML =
      '<header class="nn-export-head">' +
      '<h2>Changes</h2>' +
      '<span class="nn-export-count" data-nn="draft-badge"></span>' +
      '<button class="nn-export-close" data-nn="close" type="button" aria-label="Close">\u00d7</button>' +
      '</header>' +
      '<div class="nn-export-body">' +
      '<p class="nn-export-flow">' +
      UI.COPY.exportFlow +
      '</p>' +
      '<div class="nn-export-field">' +
      '<label class="nn-edit-field-label" for="nn-export-identifier">Author / Reviewer identifier</label>' +
      '<input id="nn-export-identifier" class="nn-edit-input" data-nn="identifier" type="text" placeholder="e.g. round-2" />' +
      '</div>' +
      '<p>Copying or downloading keeps your pending changes here until they are applied or discarded.</p>' +
      '<div class="nn-change-sheets" data-nn="preview"></div>' +
      '<div data-nn="errors" style="display: none;"></div>' +
      '<details class="nn-modal-details">' +
      '<summary>View the generated change &amp; prompt</summary>' +
      '<h4>Change document (_changes_NN.md)</h4>' +
      '<textarea data-nn="changeset-preview" readonly></textarea>' +
      '<h4>Instructions</h4>' +
      '<pre data-nn="instructions"></pre>' +
      '<h4>Agent prompt</h4>' +
      '<pre data-nn="agent-prompt"></pre>' +
      '</details>' +
      '</div>' +
      '<footer class="nn-export-actions">' +
      '<button class="nn-export-btn nn-export-discard" data-nn="discard-all" type="button">Discard all</button>' +
      '<span class="nn-export-spacer"></span>' +
      '<span data-nn="copy-status" role="status" aria-live="polite"></span>' +
      '<button class="nn-export-btn nn-export-secondary" data-nn="copy-changeset-prompt" type="button" title="Copy the changeset document only: the same bytes Download changes writes, with no wrapper instructions">Copy changeset doc</button>' +
      '<button class="nn-export-btn nn-export-primary" data-nn="download-changeset" type="button">Download changes</button>' +
      '<button class="nn-navbar-action-btn nn-btn-save" data-nn="save-snapshot" type="button" title="Save a self-contained snapshot of this console">' +
      '<span class="nn-btn-icon" data-nn="save-snapshot-icon"></span><span>Save Snapshot</span>' +
      '<span class="nn-badge-count" data-nn="save-snapshot-count"></span>' +
      '</button>' +
      '</footer>'

    root.appendChild(modal)

    // Single-header layout: the feedback controls live inside the top navbar
    // (no second application header). Fall back to the body top for shells
    // that ship no navbar.
    var navbar = active.querySelector ? active.querySelector('.nn-navbar') : null
    if (navbar) {
      navbar.appendChild(root)
    } else if (active.body) {
      active.body.insertBefore(root, active.body.firstChild)
    }

    return root
  }

  var CHANGES_VERSION_MISSING =
    'The console payload carries no changes bluepriNNt version; regenerate the console.'

  function formatChangesetValue(val) {
    if (val === undefined || val === null) return '""'
    var str = typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (
      str.indexOf('"') !== -1 ||
      str.indexOf('\n') !== -1 ||
      str.indexOf(':') !== -1 ||
      str.indexOf(' ') !== -1
    ) {
      return JSON.stringify(str)
    }
    return str
  }

  // Builds the `## NN Change` blocks of one draft, addressed the way `apply_change`
  // resolves them: `<file stem>@<element slug>[&field]`. The draft carries
  // `knowledge_id` (the knowledge document's file stem) and `element_slug`;
  // `fallbackModel` only covers drafts that lack them. A `kind: 'new'` draft with
  // filled fields yields the `add_element` block plus ONE `set_fields` block (one
  // `update_field` when a single field is filled; a change carries no inline `fields`).
  function oneLine(v) {
    return String(v).replace(new RegExp('[\\r\\n\\u2028\\u2029]+', 'g'), ' ').trim()
  }

  // A one-line JSON value: JSON.stringify escapes CR/LF, and U+2028/U+2029 (which
  // it leaves raw) are escaped too, so no value can open a second line.
  function jsonLine(value) {
    var sep = [String.fromCharCode(0x2028), String.fromCharCode(0x2029)]
    return JSON.stringify(value).split(sep[0]).join('\\u2028').split(sep[1]).join('\\u2029')
  }

  /**
   * The canonical address a draft names, derived once so the summary table and the
   * normative changeset cannot disagree. The payload's element records are the authority
   * — each carries its own `modelId` and immutable `slug` — so a draft that records an
   * `element_id` but no `element_slug` (what the console UI itself does) still resolves.
   * A draft nothing resolves yields NO element part: the old `elem`/`unit` placeholders
   * looked like addresses an agent could apply, and pointed at nothing. `elementFound`
   * reports whether the slug came from a payload record or only from the draft's own text.
   */
  function draftIdentity(draft, fallbackModel, elements) {
    var d = isObject(draft) ? draft : {}
    var list = Array.isArray(elements) ? elements : []
    var elementId = String(d.element_id || '')
    var at = elementId.indexOf('@')
    var idModel = at > 0 ? elementId.slice(0, at) : ''
    var idSlug = at > 0 ? elementId.slice(at + 1).split('&')[0] : ''
    // A caller may hand over a ready-made canonical address instead of the parts.
    var address = String(d.address || '')
    var addressAt = address.indexOf('@')
    var addressModel = addressAt > 0 ? address.slice(0, addressAt) : ''
    var addressRest = addressAt > 0 ? address.slice(addressAt + 1) : ''
    var addressAmp = addressRest.indexOf('&')
    var addressSlug = addressAmp === -1 ? addressRest : addressRest.slice(0, addressAmp)
    var addressField = addressAmp === -1 ? '' : addressRest.slice(addressAmp + 1)
    var wantedSlug = String(d.element_slug || addressSlug || '')
    var rec = null
    var i
    if (elementId) {
      for (i = 0; i < list.length && !rec; i++) {
        if (list[i] && String(list[i].id || '') === elementId) rec = list[i]
      }
    }
    if (!rec && wantedSlug) {
      for (i = 0; i < list.length && !rec; i++) {
        var e = list[i]
        if (!e || String(e.slug || '') !== wantedSlug) continue
        if (idModel && e.modelId && String(e.modelId) !== idModel) continue
        rec = e
      }
    }
    if (!rec && elementId) rec = findElementForTarget(list, elementId)
    var model =
      (rec && rec.modelId) || idModel || addressModel || d.knowledge_id || fallbackModel || 'model'
    var slug = (rec && rec.slug) || wantedSlug || idSlug || ''
    var field = d.field || addressField
    return {
      model: oneLine(model),
      element: slug ? oneLine(slug) : '',
      field: field ? oneLine(field) : '',
      // Whether the payload actually holds the element this draft names. A slug the payload
      // does not carry still reaches the target verbatim (the console must not rewrite what
      // the reviewer typed), so callers get the fact instead of re-scanning `elements`.
      elementFound: !!rec,
    }
  }

  /** The operations that address one element, so their target must name one that exists. */
  function isElementScopedOp(op) {
    return (
      op === 'update_field' ||
      op === 'update_element_text' ||
      op === 'remove_element' ||
      op === 'rename_element' ||
      op === 'update_matrix_cell'
    )
  }

  // Why a draft cannot be exported as an applicable change, or '' when it can. Only the
  // operations that address one element are checked: a model-level comment/verdict has
  // no element by design.
  function draftTargetProblem(identity, op) {
    if (identity.element) return ''
    if (isElementScopedOp(op)) {
      return 'no element slug resolves for this draft, so its target names no element'
    }
    return ''
  }

  // Why an element-scoped draft names an element this console holds no record of, or '' when it
  // does. A changeset addressing a nonexistent element is rejected by `apply_change`, and the
  // reviewer only finds out after copying the export. Only a model the payload lists in
  // `meta.models` is checked: that list is what proves the payload carries the model's full
  // element set, so an absent record is real absence and never a partial payload. A `kind: 'new'`
  // draft creates its element (`add_element`), and a draft that resolves no element at all is
  // already reported by `draftTargetProblem`.
  function draftElementProblem(identity, op, coveredModels) {
    if (!isElementScopedOp(op)) return ''
    if (!identity.element || identity.elementFound) return ''
    var ids = Array.isArray(coveredModels) ? coveredModels : []
    if (ids.indexOf(identity.model) === -1) return ''
    return (
      'element `' +
      identity.element +
      '` is not one of the elements this console holds for `' +
      identity.model +
      '`, so `apply_change` rejects this target'
    )
  }

  /** A model's record in the console meta `models[]`, or null when it lists none by that id. */
  function modelRecordOf(meta, modelId) {
    var models = Array.isArray(meta && meta.models) ? meta.models : []
    for (var i = 0; i < models.length; i++) {
      if (models[i] && String(models[i].id || '') === String(modelId)) return models[i]
    }
    return null
  }

  // The one plan a draft becomes: its blocks, the canonical target they share, and the
  // reason it cannot be applied as-is ('' when it can). `draftToChanges` is the block list
  // of this same plan, so a caller that also renders a summary reads the identical target.
  // `coveredModels` (optional) names the models this console covers; the element-existence
  // check reads it, because only a covered model's payload is known to hold every element.
  function draftPlan(draft, index, fallbackModel, author, elements, coveredModels) {
    var d = isObject(draft) ? draft : {}
    // A run request is not a model change: the owner's agent starts the run (import_console).
    if (d.kind === 'run_start' || d.kind === 'run_handoff')
      return { id: '', model: '', blocks: [], target: '', problem: '' }
    var id = oneLine(d.id || 'c-' + String(index + 1).padStart(2, '0'))
    var identity = draftIdentity(d, fallbackModel, elements)
    var model = identity.model
    // A verdict is not a mutation: it records a human decision on a gate. It carries no
    // evidence (its authority is the changeset frontmatter) and never a base_hash.
    if (d.kind === 'verdict' || d.op === 'review_gate') {
      var gate = oneLine(d.gate || 'script')
      var verdict = oneLine(d.verdict || 'approved')
      var reviewedHash = oneLine(d.reviewed_hash || '')
      var planHash = d.plan_hash ? oneLine(d.plan_hash) : ''
      if (gate === 'budget' && !planHash) planHash = reviewedHash
      // A scene verdict targets `<file stem>@<scene slug>`; a budget verdict targets the
      // episode model itself (there is no element_slug).
      var verdictTarget = oneLine(
        d.target ||
          (identity.element
            ? model + '@' + identity.element
            : d.knowledge_id || fallbackModel || 'model'),
      )
      var verdictLines = [
        '## NN Change: ' + id,
        'op:: review_gate',
        'target:: ' + verdictTarget,
        'gate:: ' + gate,
        'verdict:: ' + verdict,
        'reviewed_hash:: ' + reviewedHash,
      ]
      if (planHash) verdictLines.push('plan_hash:: ' + planHash)
      if (d.notes) verdictLines.push('notes:: ' + oneLine(d.notes))
      return {
        id: id,
        model: model,
        blocks: [verdictLines.join('\n')],
        target: verdictTarget,
        problem: '',
      }
    }
    // The element part of a target is always the element slug: never the display name
    // or an element id. It is '' when the draft names no element this payload holds, so
    // the target stays visibly incomplete instead of pointing at a placeholder.
    var elementTarget = identity.element
    var elementPart = elementTarget ? '@' + elementTarget : ''
    var matrixName = d.matrix != null && d.matrix !== '' ? oneLine(d.matrix) : ''
    var isMatrix = !!matrixName
    var canUpdate =
      (!!d.field && d.proposed !== undefined) || (isMatrix && d.proposed !== undefined)
    var isRename = !isMatrix && canUpdate && String(d.field).toLowerCase() === 'name'
    var isProse = !isMatrix && canUpdate && String(d.field).toLowerCase() === 'description'
    var op = isMatrix ? 'update_matrix_cell' : 'update_field'
    var target = isMatrix
      ? model + '@' + matrixName + '&' + oneLine(d.row) + '&' + oneLine(d.col)
      : model + elementPart + (identity.field ? '&' + identity.field : '')
    if (isRename) {
      // Element display name is identity, not a field — the engine rejects
      // update_field on &name (PRECONDITION_FAILED). Emit rename_element.
      op = 'rename_element'
      target = model + elementPart
    } else if (isProse) {
      op = 'update_element_text'
      target = model + elementPart
    } else if (d.kind === 'delete') {
      op = 'remove_element'
      target = model + elementPart
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
    var problem = draftTargetProblem(identity, op)
    if (!problem) problem = draftElementProblem(identity, op, coveredModels)

    var lines = []
    lines.push('## NN Change: ' + id)
    lines.push('op:: ' + op)
    lines.push('target:: ' + target)
    // C: every change carries mandatory evidence. A draft may name a citation; a
    // reviewer correction that names none is an explicit `decision`.
    var ev = d.evidence || d.sources || d.source || 'decision'
    if (Array.isArray(ev)) ev = ev.join(', ')
    lines.push('evidence:: ' + oneLine(ev))
    // The engine rejects the change if the element's content hash moved on since the draft.
    if (
      (op === 'update_field' ||
        op === 'update_element_text' ||
        op === 'remove_element' ||
        op === 'rename_element') &&
      d.base_hash
    ) {
      lines.push('base_hash:: ' + oneLine(d.base_hash))
    }
    if (op === 'rename_element') {
      if (d.original !== undefined) lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('name:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'update_field' || op === 'update_element_text') {
      if (d.original !== undefined) lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('to:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'update_matrix_cell') {
      if (d.original !== undefined && d.original !== '')
        lines.push('from:: ' + formatChangesetValue(d.original))
      lines.push('to:: ' + formatChangesetValue(d.proposed))
    } else if (op === 'add_element') {
      lines.push('concept:: ' + oneLine(d.concept))
      lines.push('name:: ' + formatChangesetValue(d.element))
    }
    // Every exported block names its author so a field citing the applied change
    // resolves to a human author. `oneLine` folds CR/LF/U+2028 so a name cannot
    // inject a second `key:: value` line.
    lines.push('author:: ' + oneLine(author || 'reviewer'))
    if (d.comment) {
      lines.push('notes:: ' + formatChangesetValue(d.comment))
    }
    if (op !== 'add_element')
      return { id: id, model: model, blocks: [lines.join('\n')], target: target, problem: problem }
    // A caller that already holds the element's fields as one JSON value (the procedure
    // runner builds its `Execution Event` that way) emits them verbatim: `apply_change`
    // writes `to` in the same `add_element` mutation, so element and values are one change.
    if (!isObject(d.proposed)) {
      if (typeof d.proposed === 'string' && d.proposed.trim() !== '') {
        // The payload is already one JSON object (`apply_change` parses `to` as JSON). It
        // must reach the file as JSON, not quoted a second time, or the parser's
        // quote-stripping unwraps the object back into a string.
        var raw = d.proposed.trim()
        var asJson = null
        try {
          asJson = JSON.parse(raw)
        } catch {
          asJson = null
        }
        lines.push('to:: ' + (isObject(asJson) ? jsonLine(asJson) : formatChangesetValue(raw)))
        return {
          id: id,
          model: model,
          blocks: [lines.join('\n')],
          target: target,
          problem: problem,
        }
      }
      return { id: id, model: model, blocks: [lines.join('\n')], target: target, problem: problem }
    }
    if (Object.keys(d.proposed).length === 0)
      return { id: id, model: model, blocks: [lines.join('\n')], target: target, problem: problem }
    // A change carries no inline fields. The filled fields share the draft's one
    // evidence, so they are set by ONE `set_fields` (a single field stays an
    // `update_field`), with no `from`: the fields do not exist yet.
    var slug = oneLine(d.element_slug || slugify(d.element || '') || 'elem')
    var blocks = [lines.join('\n')]
    var filled = Object.keys(d.proposed).sort()
    var filledTarget = model + '@' + slug
    if (filled.length > 1) {
      var payload = {}
      filled.forEach(function (field) {
        var v = d.proposed[field]
        payload[oneLine(field)] =
          v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
      })
      blocks.push(
        [
          '## NN Change: ' + id + '-fields',
          'op:: set_fields',
          'target:: ' + filledTarget,
          'evidence:: ' + oneLine(ev),
          'to:: ' + jsonLine(payload),
          'author:: ' + oneLine(author || 'reviewer'),
        ].join('\n'),
      )
      return { id: id, model: model, blocks: blocks, target: filledTarget, problem: '' }
    }
    filled.forEach(function (field) {
      blocks.push(
        [
          '## NN Change: ' + id + '-' + slugify(field),
          'op:: update_field',
          'target:: ' + filledTarget + '&' + oneLine(field),
          'evidence:: ' + oneLine(ev),
          'to:: ' + formatChangesetValue(d.proposed[field]),
          'author:: ' + oneLine(author || 'reviewer'),
        ].join('\n'),
      )
    })
    return { id: id, model: model, blocks: blocks, target: filledTarget, problem: '' }
  }

  // The blocks of one draft; the plan's own target is what the summary table shows.
  function draftToChanges(draft, index, fallbackModel, author, elements, coveredModels) {
    return draftPlan(draft, index, fallbackModel, author, elements, coveredModels).blocks
  }

  /** The first reason a verdict draft cannot be exported, or null. */
  function verdictDraftProblem(drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i]
      if (!d || (d.kind !== 'verdict' && d.op !== 'review_gate')) continue
      var id = d.id || 'c-' + String(i + 1).padStart(2, '0')
      if (!d.reviewed_hash) return 'review_gate change "' + id + '" requires reviewed_hash'
      if (d.gate === 'preview' && !d.plan_hash) {
        return 'preview verdict "' + id + '" requires plan_hash (the scene slice hash)'
      }
      if (d.gate === 'budget' && !(d.plan_hash || d.reviewed_hash)) {
        return 'budget verdict "' + id + '" requires the episode plan hash'
      }
    }
    return null
  }

  /** Build a verdict draft the view hands to the store (console-side validation only). */
  function verdictDraft(input) {
    var d = isObject(input) ? input : {}
    return {
      kind: 'verdict',
      id: d.id,
      gate: String(d.gate || 'script'),
      target: String(d.target || d.knowledge_id || ''),
      verdict: String(d.verdict || 'approved'),
      reviewed_hash: String(d.reviewed_hash || ''),
      plan_hash: d.plan_hash ? String(d.plan_hash) : '',
      notes: d.notes ? String(d.notes) : '',
    }
  }

  function serializeChangesetMarkdown(meta, drafts, fallbackModel, elements) {
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
    ]
    // A file carrying a verdict needs the human markers the engine checks.
    var hasVerdict = drafts.some(function (d) {
      return d && (d.kind === 'verdict' || d.op === 'review_gate')
    })
    if (hasVerdict) {
      lines.push('author_kind: human', 'origin: console', 'reviewer: ' + JSON.stringify(author))
    }
    lines.push('---', '', '# NN index', '', '* [[Change]]', '', '# NN Change', '')
    var modelName = fallbackModel || meta.source_knowledge || 'model'
    var blocks = []
    drafts.forEach(function (d, i) {
      blocks = blocks.concat(draftToChanges(d, i, modelName, author, elements))
    })
    lines.push(blocks.join('\n\n'))
    lines.push('')
    return lines.join('\n')
  }

  function composeChangesetExport(state, identifier) {
    var reviewer =
      identifier && String(identifier).trim() ? String(identifier).trim() : getReviewerName()
    var drafts = state && state.store ? state.store.drafts() : []
    var model = state && state.modelTitle ? state.modelTitle : 'Model'
    var reviewerSlug = slugify(reviewer) || 'reviewer'
    var stamp = changesetStampOf(new Date())

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
    var verdictProblem = verdictDraftProblem(drafts)
    if (verdictProblem) {
      return { ok: false, errors: [verdictProblem] }
    }

    var text = serializeChangesetMarkdown(
      exportMeta,
      drafts,
      state && state.modelId,
      state && state.elements,
    )
    var filename = modelSlugOf(state) + '_' + reviewerSlug + '_' + stamp + '_changes_NN.md'
    return {
      ok: true,
      text: text,
      filename: filename,
      items: drafts.length,
    }
  }

  /**
   * The fields of a console's state that the changeset export reads, derived from the payload
   * meta alone. Boot builds its state from this, and composeSavedExport rebuilds it from a
   * saved console's slots, so the download and an agent's import share one derivation.
   * `scope` names a scoped console's view: `{ view, label }`, or null for the whole domain.
   */
  function exportStateOf(meta, scope) {
    meta = isObject(meta) ? meta : {}
    var baseTitle = String(meta.title || meta.model || 'Model')
    var baseId = String(meta.modelId || meta.model || meta.title || 'model')
    var scopedTitle = scope ? baseTitle + ' - ' + scope.label : baseTitle
    return {
      modelTitle: scopedTitle,
      // The displayed version comes from the domain meta `models[]` (D4), with no fallback.
      modelVersion: domainModelVersion(meta),
      artifactName: String(meta.title || 'console') + '_console.html',
      modelId: meta.modelId || meta.model || meta.title || 'model',
      modelSlug: scope
        ? modelSlugOf({
            modelSlug: meta.knowledge_slug || meta.modelSlug,
            modelId: baseId,
            modelTitle: baseTitle,
          }) +
          '-' +
          scope.view
        : meta.knowledge_slug || meta.modelSlug || meta.workspaceId || undefined,
      sourceSha256:
        (Array.isArray(meta.models) &&
          meta.models.length === 1 &&
          meta.models[0] &&
          meta.models[0].sha256) ||
        meta.sha256 ||
        meta.source_sha256,
      // The changeset title comes from meta.title; a scoped export names its view there.
      meta: scope ? Object.assign({}, meta, { title: scopedTitle }) : meta,
    }
  }

  /**
   * The "Download changes" export of a SAVED console, computed from its slots without a page:
   * `input.meta` is the decoded nn-model payload meta, `input.drafts` the nn-drafts list,
   * `input.reviewer` who signs it and `input.exportedAt` the save time (a stable filename).
   * It is composeExport over the state boot would have built, so the bytes match a download.
   */
  function composeSavedExport(input) {
    var i = isObject(input) ? input : {}
    var meta = isObject(i.meta) ? i.meta : {}
    var view = consoleScopeOf(meta)
    var state = exportStateOf(meta, view ? { view: view, label: view } : null)
    var drafts = Array.isArray(i.drafts) ? i.drafts : []
    state.store = {
      drafts: function () {
        return drafts
      },
    }
    if (nonEmptyString(i.exportedAt)) state.exportedAt = i.exportedAt
    // A saved console's slots carry its elements; when the caller supplies them the target
    // addresses resolve exactly as they do in the live page.
    if (Array.isArray(i.elements)) state.elements = i.elements
    return composeExport(state, nonEmptyString(i.reviewer) ? i.reviewer : DEFAULT_REVIEWER_NAME)
  }

  function composeExport(state, identifier) {
    var reviewer =
      identifier && String(identifier).trim() ? String(identifier).trim() : getReviewerName()
    var drafts = state && state.store ? state.store.drafts() : []
    var model = state && state.modelTitle ? state.modelTitle : 'Model'
    var reviewerSlug = slugify(reviewer) || 'reviewer'

    var exportMeta = Object.assign({}, (state && state.meta) || {}, {
      source_knowledge: model,
      artifact: (state && state.artifactName) || model + '_console.html',
      artifact_version: CONSOLE_VERSION,
      exported_at: (state && state.exportedAt) || new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      author: reviewer,
      feedback_slug: reviewerSlug,
      viewer: 'nn-console@' + CONSOLE_VERSION,
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
    var verdictProblem = verdictDraftProblem(drafts)
    if (verdictProblem) {
      return { ok: false, errors: [verdictProblem] }
    }

    var stamp = changesetStampOf(
      state && state.exportedAt ? new Date(state.exportedAt) : new Date(),
    )
    var changesetMd = serializeChangesetMarkdown(
      exportMeta,
      drafts,
      state && state.modelId,
      state && state.elements,
    )
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
    var errorContainer = doc.querySelector('#nn-feedback-modal [data-nn="errors"]')
    if (!errorContainer) return
    if (!errors || !errors.length) {
      errorContainer.innerHTML = ''
      errorContainer.style.display = 'none'
      return
    }
    errorContainer.innerHTML =
      '<strong>Validation errors:</strong><ul>' +
      errors
        .map(function (e) {
          return '<li>' + escapeHtml(e) + '</li>'
        })
        .join('') +
      '</ul>'
    errorContainer.style.display = 'block'
  }

  // Direct write to a connected domaiNN folder (console-changes-direct-write, D-C2).
  // The download path stays the fallback; these two calls are what the view wires to a
  // "Connect folder" control.
  function fsaWriter() {
    var root = typeof window !== 'undefined' ? window : null
    var api = root && root.nnFsa
    if (!api) return null
    return api.createWriter({ win: root, store: api.createIndexedDbStore() })
  }

  function connectFolder(workspaceId) {
    var writer = fsaWriter()
    if (!writer) return Promise.resolve({ ok: false, reason: 'fsa-unavailable' })
    return writer.connect(String(workspaceId || ''))
  }

  function writeChangesetToFolder(workspaceId, reviewer, changesetText) {
    var writer = fsaWriter()
    if (!writer) return Promise.resolve({ ok: false, reason: 'fsa-unavailable' })
    return writer.writeChangeset({
      workspaceId: String(workspaceId || ''),
      reviewer: reviewer,
      text: changesetText,
    })
  }

  function downloadChangesetExport(doc, state) {
    var identifierInput = doc.querySelector('#nn-feedback-modal [data-nn="identifier"]')
    var identifier =
      identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
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
    var modal = doc.getElementById('nn-feedback-modal')
    var status = modal && modal.querySelector('[data-nn="copy-status"]')
    var textarea = modal && modal.querySelector('[data-nn="changeset-preview"]')
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

  function copyTextToClipboard(doc, text) {
    var win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : null)
    var nav =
      win && win.navigator ? win.navigator : typeof navigator !== 'undefined' ? navigator : null
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      return nav.clipboard.writeText(text).catch(function () {
        return execCopyFallback(doc, text)
      })
    }
    return Promise.resolve(execCopyFallback(doc, text))
  }

  function execCopyFallback(doc, text) {
    if (!doc || !doc.body) return false
    var ta = doc.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    doc.body.appendChild(ta)
    ta.focus()
    ta.select()
    var ok = false
    try {
      ok = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : false
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }

  function composeAgentPrompt(state) {
    state =
      state || (typeof document !== 'undefined' && document.__nnConsoleState) || activeState || {}
    var meta = isObject(state && state.meta) ? state.meta : {}
    var models = Array.isArray(meta.models) ? meta.models : []
    var elements = state && state.elements
    var drafts = state && state.store ? state.store.drafts() : []
    var domainOrModel = (state && state.modelTitle) || 'Domain Model'
    // Only a resolved version is stated. A console covering several models has no single
    // version, and a fallback here reads to the agent as the domain's real one.
    var version = state && state.modelVersion ? String(state.modelVersion) : ''
    var reviewer = getReviewerName()

    // One plan per draft: the summary table and the normative changeset below are the same
    // resolution, so they cannot disagree about a target. The covered model ids are what makes
    // an absent element record prove absence instead of a partial payload.
    var coveredModelIds = models.map(function (m) {
      return String((m && m.id) || '')
    })
    var plans = drafts.map(function (d, i) {
      return draftPlan(d, i, state && state.modelId, reviewer, elements, coveredModelIds)
    })
    var targetAddresses = []
    var targetModels = []
    var problems = []
    plans.forEach(function (plan, i) {
      if (plan.target && targetAddresses.indexOf(plan.target) === -1) {
        targetAddresses.push(plan.target)
      }
      var record = modelRecordOf(meta, plan.model)
      if (record && targetModels.indexOf(plan.model) === -1) targetModels.push(plan.model)
      var label = '- `' + (plan.id || 'c-' + String(i + 1).padStart(2, '0')) + '`: '
      if (plan.problem) problems.push(label + plan.problem)
      if (plan.target && models.length > 0 && !record) {
        // The console lists its own models: a target outside that list is a change no
        // reader of this console can resolve, and `apply_change` rejects it.
        problems.push(
          label +
            'model `' +
            plan.model +
            '` is not one of the models this console covers, so the target resolves to nothing',
        )
      }
    })

    var lines = []
    lines.push('# AI Agent Instructions: Apply Domain Console Changeset')
    lines.push('')
    lines.push('## Target Domain & Entity')
    lines.push('- **Domain / Model**: ' + domainOrModel)
    // The declared `workspace_id` is the domain's own identity, readable in its
    // `domaiNN_NN.md`. The console's draft-store key (`meta.domainId`) is a local storage
    // name derived from the path, not a domain identifier, so it is never presented as one.
    if (nonEmptyString(meta.workspaceId))
      lines.push('- **Workspace ID**: `' + meta.workspaceId + '`')
    if (version) {
      lines.push('- **Version**: ' + version)
    } else if (models.length > 1) {
      lines.push(
        '- **Version**: not available — this console covers ' +
          models.length +
          " models, so it has no single version; use each target model's own `knowledge_version`",
      )
    }
    if (targetModels.length > 0) {
      lines.push('- **Target Models**:')
      targetModels.forEach(function (id) {
        var record = modelRecordOf(meta, id) || {}
        var file =
          record.filePath && String(record.filePath).charAt(0) !== '<'
            ? String(record.filePath)
            : ''
        var at = file ? ' — `' + file + '`' : ''
        var atVersion = record.version ? ' (' + record.version + ')' : ''
        lines.push('  - `' + id + '`' + at + atVersion)
      })
    }
    if (targetAddresses.length > 0) {
      lines.push('- **Target Canonical Addresses**:')
      targetAddresses.forEach(function (addr) {
        lines.push('  - `' + addr + '`')
      })
    }
    lines.push('')

    if (problems.length > 0) {
      lines.push('## Blocking Problems')
      lines.push(
        'These drafts name a target this console cannot resolve, so the changeset below cannot be applied as it stands:',
      )
      problems.forEach(function (line) {
        lines.push(line)
      })
      lines.push('')
    }

    lines.push(
      '## Changeset Summary (' +
        drafts.length +
        ' modification' +
        (drafts.length === 1 ? '' : 's') +
        ')',
    )
    if (drafts.length === 0) {
      lines.push(
        'No pending modifications recorded in the console snapshot. Domain state is current.',
      )
    } else {
      lines.push('| Kind | Target Address | Field | Proposed / Details | Notes |')
      lines.push('| :--- | :--- | :--- | :--- | :--- |')
      drafts.forEach(function (d, i) {
        var plan = plans[i] || {}
        var addr = plan.target || '(unresolved)'
        var field = plan.field || d.field || '-'
        var proposed =
          d.proposed !== undefined ? formatChangesetValue(d.proposed) : d.comment || '-'
        var note =
          d.comment && d.proposed !== undefined ? String(d.comment).replace(/\n/g, ' ') : '-'
        lines.push(
          '| `' +
            d.kind +
            '` | `' +
            addr +
            '` | `' +
            field +
            '` | ' +
            proposed +
            ' | ' +
            note +
            ' |',
        )
      })
    }
    lines.push('')

    // The placeholder names nobody: the engine refuses a changeset signed by it
    // (GATE_REVIEWER_REQUIRED), so no changeset is embedded until a name is set (#606).
    var unnamed = !reviewer || reviewer === DEFAULT_REVIEWER_NAME
    var exportMeta = {
      source_knowledge: domainOrModel,
      title: 'Review Changes: ' + domainOrModel,
      author: reviewer,
      changesBlueprintVersion: meta.changesBlueprintVersion || 'V_0-1-0',
    }
    if (unnamed && drafts.length > 0) {
      lines.push('### Normative Changeset Document')
      lines.push(
        'Not included: no reviewer name is set. Type your reviewer name in the console header, then copy this prompt again.',
      )
      lines.push('')
    }
    try {
      var changesetDoc = unnamed
        ? ''
        : serializeChangesetMarkdown(exportMeta, drafts, state && state.modelId, elements)
      if (changesetDoc && drafts.length > 0) {
        lines.push('### Normative Changeset Document (`_changes_NN.md`)')
        lines.push('```markdown')
        lines.push(changesetDoc.trim())
        lines.push('```')
        lines.push('')
      }
    } catch {
      /* ignore if markdown generation fails */
    }

    // The steps a domain workspace actually has: `apply_change` applies the document and
    // regenerates the console, and `regenerate_console` rebuilds it alone. A domain has no
    // package.json, `scripts/` or npm build, so naming one would send the agent nowhere.
    lines.push('## Actionable Instructions for AI Assistant')
    lines.push(
      '1. Inspect and validate the requested modifications against the target domain blueprints and schemas.',
    )
    lines.push(
      "2. Save the document above as a `_changes_NN.md` file and pass its path to the `nn-mcp` tool `apply_change` (`changeset`), or edit the target model's document in the domain directly.",
    )
    lines.push(
      "   - Preserve each element's canonical address and `base_hash`: a hash that moved on rejects the change.",
    )
    lines.push(
      '3. If you edited the documents directly, regenerate the console with `regenerate_console`; `apply_change` already regenerates it for the domain it applied to.',
    )

    return lines.join('\n')
  }

  function copyAgentPrompt(doc, state) {
    var active = doc || (typeof document !== 'undefined' ? document : null)
    state = state || (active && active.__nnConsoleState) || activeState || {}
    var promptText = composeAgentPrompt(state)
    var draftsCount = state && state.store ? state.store.drafts().length : 0

    return copyTextToClipboard(active, promptText).then(function () {
      showToast(active, 'Copied! Prompt for AI agent is ready in clipboard.', 'success')
      return { ok: true, prompt: promptText, items: draftsCount }
    })
  }

  function downloadFallback(doc, htmlContent, filename, draftsCount) {
    if (doc && doc.createElement && typeof Blob !== 'undefined') {
      var blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      var url =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(blob)
          : ''
      if (url) {
        var anchor = doc.createElement('a')
        anchor.href = url
        anchor.download = filename
        if (doc.body) doc.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(function () {
          URL.revokeObjectURL(url)
        }, 1000)
      }
    }
    showToast(doc, 'Snapshot downloaded: ' + filename, 'success')
    return {
      ok: true,
      method: 'download',
      filename: filename,
      html: htmlContent,
      draftsCount: draftsCount,
    }
  }

  function saveSnapshot(doc, state, options) {
    var opts = options || {}
    var active = doc || (typeof document !== 'undefined' ? document : null)
    if (!active) return Promise.resolve({ ok: false, error: 'Document unavailable' })
    state = state || (active && active.__nnConsoleState) || activeState || {}

    // 1. Synchronize state into the slots: the model (compressed) into nn-model, the
    // drafts and UI state (plain JSON an agent reads directly) into nn-drafts. The model
    // always starts from the decoded payload, never from the compressed slot text.
    var modelSlot = active.getElementById('nn-model')
    if (!modelSlot) {
      return Promise.resolve({ ok: false, error: 'Element #nn-model not found' })
    }

    var currentModel
    var savedDrafts
    try {
      currentModel = JSON.parse(modelSlotText(active) || '{}')
      savedDrafts = parseDraftsSlot(slotText(active, 'nn-drafts'))
    } catch (err) {
      return Promise.resolve({ ok: false, error: (err && err.message) || String(err) })
    }
    if (!isObject(currentModel)) {
      return Promise.resolve({
        ok: false,
        error: 'nn-console: the nn-model slot must decode to a JSON object',
      })
    }
    var savedUiState = isObject(savedDrafts.uiState) ? savedDrafts.uiState : {}

    var drafts =
      state && state.store
        ? state.store.drafts()
        : Array.isArray(savedDrafts.drafts)
          ? savedDrafts.drafts
          : []
    currentModel.meta = Object.assign({}, currentModel.meta || {}, (state && state.meta) || {})
    if (state && Array.isArray(state.elements))
      currentModel.elements = state.elements.map(withoutRuntimeKeys)
    if (state && Array.isArray(state.matrices)) currentModel.matrices = state.matrices
    if (state && Array.isArray(state.changes)) currentModel.changes = state.changes

    var searchEl = active.getElementById('nn-search')
    var currentQuery = searchEl ? searchEl.value : (state && state.activeSearchQuery) || ''
    var uiState = {
      activeTab:
        state && state.tabs && typeof state.tabs.current === 'function'
          ? state.tabs.current()
          : savedUiState.activeTab || 'explorer',
      searchQuery: currentQuery,
      reviewer: getReviewerName(),
      selectedElementId: (state && state.focusedElementId) || null,
      savedAt: new Date().toISOString(),
    }

    var modelJson = JSON.stringify(currentModel)
    var draftsJson = JSON.stringify({ drafts: drafts, uiState: uiState }).replace(/</g, '\\u003c')

    return encodeModelText(modelJson).then(
      function (encoded) {
        modelSlot.textContent = '\n' + encoded + '\n'
        if (decodedModels) decodedModels.set(active, modelJson)
        var draftsSlot = active.getElementById('nn-drafts')
        if (!draftsSlot) {
          draftsSlot = active.createElement('script')
          draftsSlot.setAttribute('type', 'application/json')
          draftsSlot.id = 'nn-drafts'
          modelSlot.parentNode.insertBefore(draftsSlot, modelSlot.nextSibling)
        }
        draftsSlot.textContent = '\n' + draftsJson + '\n'
        return writeSnapshot(active, state, opts, drafts)
      },
      function (err) {
        return { ok: false, error: (err && err.message) || String(err) }
      },
    )
  }

  // The `_concept*` decoration boot puts on each element (rail colour and slot) is
  // runtime-only: it is recomputed on every boot and never belongs in the saved model.
  function withoutRuntimeKeys(element) {
    if (!isObject(element)) return element
    var out = {}
    Object.keys(element).forEach(function (key) {
      if (key.indexOf('_concept') !== 0) out[key] = element[key]
    })
    return out
  }

  // The page as exported, captured once per document before the first boot renders into
  // it: a save writes this shell plus the current slots, never the rendered screen, which
  // the next boot rebuilds from nn-model anyway.
  var exportedShells = typeof WeakMap === 'function' ? new WeakMap() : null

  function captureExportedShell(active) {
    if (!exportedShells || !active || !active.documentElement) return
    if (exportedShells.has(active)) return
    exportedShells.set(active, active.documentElement.cloneNode(true))
  }

  // The data slots (non-executable scripts with an id) of the live document, written into
  // a copy of the exported shell; a slot the shell lacks (nn-drafts created by a save) goes
  // right after the slot that precedes it.
  function shellWithSlots(active) {
    var shell = exportedShells && exportedShells.get(active)
    if (!shell) return null
    var out = shell.cloneNode(true)
    out.removeAttribute('data-nn-console-booted')
    var previous = null
    Array.prototype.forEach.call(active.querySelectorAll('script[id][type]'), function (slot) {
      if (/javascript|module/i.test(slot.getAttribute('type') || '')) return
      var target = null
      Array.prototype.some.call(out.querySelectorAll('script[id]'), function (candidate) {
        if (candidate.id === slot.id) target = candidate
        return target !== null
      })
      if (target) {
        target.textContent = slot.textContent
      } else if (previous && previous.parentNode) {
        target = slot.cloneNode(true)
        previous.parentNode.insertBefore(target, previous.nextSibling)
      }
      if (target) previous = target
    })
    return out
  }

  // The file the console was opened from, when it was opened from disk. A `file:` page has
  // no writable handle for its own URL, but its NAME is what the save dialog must propose:
  // that is what makes the person overwrite this console instead of creating another one.
  function openedFileName(win) {
    var loc = win && win.location
    if (!loc || loc.protocol !== 'file:') return ''
    var path = String(loc.pathname || '')
    var name = path.slice(path.lastIndexOf('/') + 1)
    try {
      name = decodeURIComponent(name)
    } catch {
      /* a malformed escape keeps the raw name */
    }
    return /\.html?$/i.test(name) ? name : ''
  }

  // A separate database from the connected-folder handles: a snapshot is a file, never a
  // folder, and one entry exists per domaiNN and file name (nn-fsa `snapshotKey`).
  var SNAPSHOT_DB = 'nn-console-snapshot'

  function snapshotStore(win) {
    var api = win && win.nnFsa
    if (!api || typeof api.createIndexedDbStore !== 'function') return null
    try {
      return api.createIndexedDbStore(null, SNAPSHOT_DB)
    } catch {
      return null
    }
  }

  function consoleSnapshotKey(win, state, name) {
    var api = win && win.nnFsa
    if (!api || typeof api.snapshotKey !== 'function') return ''
    return api.snapshotKey({
      domainId: (state && state.meta && state.meta.domainId) || '',
      name: name,
    })
  }

  // The one save that asks: File System Access creates a handle only through a dialog. The
  // handle is remembered afterwards, so this runs at most once per console and file name.
  function writeThroughPicker(active, drafts, htmlContent, suggestedName, win, store, key) {
    return win
      .showSaveFilePicker({
        id: 'nn-console-snapshot',
        suggestedName: suggestedName,
        types: [
          {
            description: 'HTML Document',
            accept: { 'text/html': ['.html', '.htm'] },
          },
        ],
      })
      .then(
        function (handle) {
          return handle.createWritable().then(function (writable) {
            return writable.write(htmlContent).then(function () {
              return writable.close().then(function () {
                return rememberHandle(store, key, handle).then(function () {
                  showToast(active, 'Saved in place: ' + (handle.name || suggestedName), 'success')
                  return {
                    ok: true,
                    method: 'file-system-access',
                    inPlace: true,
                    filename: handle.name || suggestedName,
                    html: htmlContent,
                    draftsCount: drafts.length,
                  }
                })
              })
            })
          })
        },
        function (err) {
          if (err && (err.name === 'AbortError' || err.code === 20)) {
            return { ok: false, aborted: true }
          }
          return downloadFallback(active, htmlContent, suggestedName, drafts.length)
        },
      )
  }

  function rememberHandle(store, key, handle) {
    if (!store || !key) return Promise.resolve()
    try {
      return Promise.resolve(store.set(key, handle)).then(
        function () {},
        function () {},
      )
    } catch {
      return Promise.resolve()
    }
  }

  // Serializes the exported shell with the (already synchronized) slots and writes it in
  // place through the File System Access API, or downloads it when that API is unavailable.
  // "In place" means the file this console was opened from: the first save picks it, its
  // handle is remembered, and every later save overwrites it with no dialog at all.
  function writeSnapshot(active, state, opts, drafts) {
    // 2. Serializes the document: the exported shell when boot captured one, else the
    // live document without its boot marker.
    var rootEl = active.documentElement
    var shell = shellWithSlots(active)
    var htmlContent
    if (shell) {
      htmlContent = '<!DOCTYPE html>\n' + shell.outerHTML
    } else {
      var hadBooted = rootEl ? rootEl.getAttribute('data-nn-console-booted') : null
      if (rootEl && hadBooted !== null) rootEl.removeAttribute('data-nn-console-booted')
      htmlContent = '<!DOCTYPE html>\n' + (rootEl ? rootEl.outerHTML : '')
      if (rootEl && hadBooted !== null) rootEl.setAttribute('data-nn-console-booted', hadBooted)
    }

    var win = (active && active.defaultView) || (typeof window !== 'undefined' ? window : null)

    // 3. The opened file's own name first: a title-derived name would create a second
    // console beside the one the person is looking at, which is the bug this avoids.
    var suggestedName =
      openedFileName(win) ||
      (opts && opts.suggestedName) ||
      (state && state.artifactName) ||
      (state && state.meta && state.meta.domainId ? state.meta.domainId + '_console.html' : '') ||
      (active.title ? slugify(active.title) + '.html' : '') ||
      'domaiNN_console.html'

    if (!suggestedName.endsWith('.html') && !suggestedName.endsWith('.htm')) {
      suggestedName += '.html'
    }

    var canUsePicker =
      win && typeof win.showSaveFilePicker === 'function' && opts.forceDownload !== true
    if (!canUsePicker) {
      return Promise.resolve(downloadFallback(active, htmlContent, suggestedName, drafts.length))
    }

    var store = snapshotStore(win)
    var key = consoleSnapshotKey(win, state, suggestedName)
    var fsa = win.nnFsa
    if (store && key && fsa && typeof fsa.saveToRememberedFile === 'function') {
      return fsa
        .saveToRememberedFile({ store: store, key: key, text: htmlContent })
        .then(function (saved) {
          if (!saved || !saved.ok) {
            return writeThroughPicker(active, drafts, htmlContent, suggestedName, win, store, key)
          }
          showToast(active, 'Saved in place: ' + (saved.filename || suggestedName), 'success')
          return {
            ok: true,
            method: 'file-system-access',
            inPlace: true,
            filename: saved.filename || suggestedName,
            html: htmlContent,
            draftsCount: drafts.length,
          }
        })
    }

    return writeThroughPicker(active, drafts, htmlContent, suggestedName, win, store, key)
  }

  function mountNavbarActions(doc, state) {
    var active = doc || (typeof document !== 'undefined' ? document : null)
    if (!active) return null
    var target = active.getElementById('nn-navbar-actions')
    if (!target) {
      var navbar = active.querySelector ? active.querySelector('.nn-navbar') : null
      if (navbar) {
        target = active.createElement('div')
        target.id = 'nn-navbar-actions'
        target.className = 'nn-navbar-actions'
        navbar.appendChild(target)
      }
    }
    if (!target || !UI || typeof UI.TopBarActions !== 'function') return null
    var changesButton = active.getElementById('nn-feedback-open')
    if (changesButton && changesButton.parentNode === target) target.removeChild(changesButton)
    var newElementButton = active.querySelector('[data-nn="new-element"]')
    if (newElementButton && newElementButton.parentNode === target)
      target.removeChild(newElementButton)
    target.innerHTML = ''
    var draftsCount = state && state.store ? state.store.drafts().length : 0
    var actionsEl = UI.TopBarActions(
      { draftsCount: draftsCount },
      {
        doc: active,
        onSave: function () {
          saveSnapshot(active, state)
        },
        onCopyPrompt: function () {
          copyAgentPrompt(active, state)
        },
      },
    )
    if (actionsEl) {
      target.appendChild(actionsEl)
    }
    if (newElementButton) target.appendChild(newElementButton)
    if (changesButton) target.appendChild(changesButton)
    return target
  }

  // A change `sources` value is a path plus an optional `#anchor`. Nothing resolves it
  // here, so the entry is marked `unchecked` and the dialog claims no status for it.
  function openSourceCitation(doc, source) {
    var text = String(source)
    var hash = text.indexOf('#')
    var entry = {
      origin: 'document',
      unchecked: true,
      path: hash === -1 ? text : text.slice(0, hash),
    }
    if (hash !== -1 && hash < text.length - 1) entry.anchor = text.slice(hash + 1)
    renderCitationDialog(doc, 'sources', [entry])
  }

  // Renders the pending changes as change sheets — one ElementCard per draft,
  // collapsed except the newest — and refreshes the modal's counts.
  // The field citation widget reports the resolved entry (`{ entry, field, value }`);
  // every change list only needs its address to open the source dialog.
  function openCitePayload(doc, citeData) {
    var entry = citeData && citeData.entry
    var source = (entry && entry.path) || (citeData && citeData.value)
    if (!source) return
    if (entry && entry.anchor) source = source + '#' + entry.anchor
    openSourceCitation(doc, source)
  }

  function updateExportPreview(doc, state) {
    var modal = doc.getElementById('nn-feedback-modal')
    if (!modal) return { ok: false }
    var identifierInput = modal.querySelector('[data-nn="identifier"]')
    var identifier =
      identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
    var drafts = state && state.store ? state.store.drafts() : []
    var byId = elementsByIdOf(state)
    var modelId = (state && state.meta && (state.meta.modelId || state.meta.model)) || ''

    var badge = modal.querySelector('[data-nn="draft-badge"]')
    if (badge) {
      badge.textContent = drafts.length + ' unsent'
      badge.style.display = drafts.length ? '' : 'none'
    }
    var countLabel = modal.querySelector('[data-nn="draft-count"]')
    if (countLabel) {
      countLabel.textContent = drafts.length
        ? drafts.length + ' of ' + drafts.length + ' selected'
        : ''
    }
    var instructions = modal.querySelector('[data-nn="instructions"]')
    if (instructions) {
      instructions.textContent =
        'Review ' + drafts.length + ' unsent change(s), then download or copy the change document.'
    }
    var saveCount = modal.querySelector('[data-nn="save-snapshot-count"]')
    if (saveCount) {
      saveCount.textContent = drafts.length ? String(drafts.length) : ''
      saveCount.style.display = drafts.length ? '' : 'none'
    }

    var preview = modal.querySelector('[data-nn="preview"]')
    if (preview)
      renderReviewTab(
        doc,
        state,
        null,
        function () {
          if (state && typeof state.refreshUi === 'function') state.refreshUi()
          updateExportPreview(doc, state)
        },
        preview,
      )

    var composed = composeExport(state, identifier)
    var downloadCsBtn = modal.querySelector('[data-nn="download-changeset"]')
    var copyCsBtn = modal.querySelector('[data-nn="copy-changeset-prompt"]')
    var textarea = modal.querySelector('[data-nn="changeset-preview"]')

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
    var input = modal && modal.querySelector('[data-nn="identifier"]')
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
    var modal = doc.getElementById('nn-feedback-modal') || doc.getElementById('nn-export-modal')
    if (!modal) {
      downloadChangesetExport(doc, state)
      return
    }
    var identifierInput = modal.querySelector('[data-nn="identifier"]')
    var agentPrompt = modal.querySelector('[data-nn="agent-prompt"]')

    // One held exported_at per modal opening, so download and copy emit
    // byte-identical JSON.
    if (state) state.exportedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

    if (identifierInput) {
      var storedName = getReviewerName()
      identifierInput.value = storedName === DEFAULT_REVIEWER_NAME ? '' : storedName
    }
    if (agentPrompt) {
      var promptVersion = state && state.modelVersion ? String(state.modelVersion) : ''
      agentPrompt.textContent =
        'Apply the attached changeset to ' +
        (state ? state.modelTitle : 'Model') +
        (promptVersion ? ' (' + promptVersion + ')' : '') +
        '. ' +
        UI.COPY.agentPromptSkipped
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

    var closeBtn = modal.querySelector('[data-nn="close"]')
    if (closeBtn && !closeBtn.getAttribute('data-nn-bound')) {
      closeBtn.setAttribute('data-nn-bound', '1')
      closeBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation()
        closeModal()
      })
    }
    if (!modal.getAttribute('data-nn-dismiss-bound')) {
      modal.setAttribute('data-nn-dismiss-bound', '1')
      modal.addEventListener('click', function (ev) {
        if (ev && ev.target === modal) closeModal()
      })
      modal.addEventListener('cancel', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault()
        closeModal()
      })
    }

    if (identifierInput && !identifierInput.getAttribute('data-nn-bound')) {
      identifierInput.setAttribute('data-nn-bound', '1')
      identifierInput.addEventListener('input', function () {
        updateExportPreview(doc, state)
      })
    }

    var downloadCsBtn = modal.querySelector('[data-nn="download-changeset"]')
    if (downloadCsBtn && !downloadCsBtn.getAttribute('data-nn-bound')) {
      downloadCsBtn.setAttribute('data-nn-bound', '1')
      downloadCsBtn.addEventListener('click', function () {
        var identifier =
          identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (!identifier || identifier === DEFAULT_REVIEWER_NAME) return
        setReviewerName(identifier)
        var res = downloadChangesetExport(doc, state)
        if (res && res.ok) {
          if (typeof modal.close === 'function') modal.close()
          else modal.removeAttribute('open')
        }
      })
    }

    var copyCsBtn = modal.querySelector('[data-nn="copy-changeset-prompt"]')
    if (copyCsBtn && !copyCsBtn.getAttribute('data-nn-bound')) {
      copyCsBtn.setAttribute('data-nn-bound', '1')
      copyCsBtn.addEventListener('click', function () {
        var identifier =
          identifierInput && identifierInput.value ? String(identifierInput.value).trim() : ''
        if (identifier && identifier !== DEFAULT_REVIEWER_NAME) setReviewerName(identifier)
        copyChangesetPrompt(doc, state)
      })
    }

    // Discard all: the store already supports a bulk clear; the confirmation is
    // the only new bit, because the drafts are gone for good.
    var discardAllBtn = modal.querySelector('[data-nn="discard-all"]')
    if (discardAllBtn && !discardAllBtn.getAttribute('data-nn-bound')) {
      discardAllBtn.setAttribute('data-nn-bound', '1')
      discardAllBtn.addEventListener('click', function () {
        var pending = state && state.store ? state.store.drafts() : []
        if (!pending.length) return
        var win = doc.defaultView || (typeof window !== 'undefined' ? window : null)
        if (win && typeof win.confirm === 'function') {
          var ok = win.confirm(
            'Discard all ' + pending.length + ' unsent change(s)? This cannot be undone.',
          )
          if (!ok) return
        }
        var ids = pending
          .map(function (d) {
            return d && d.id
          })
          .filter(Boolean)
        if (state && state.store && typeof state.store.clearDrafts === 'function') {
          state.store.clearDrafts(ids)
        }
        if (state && typeof state.refreshUi === 'function') state.refreshUi()
        updateExportPreview(doc, state)
      })
    }

    // Save Snapshot: the same self-contained snapshot the navbar button writes.
    // Close first, so the saved document never bakes in the open dialog.
    var saveSnapshotBtn = modal.querySelector('[data-nn="save-snapshot"]')
    var saveIcon = modal.querySelector('[data-nn="save-snapshot-icon"]')
    if (saveIcon && !saveIcon.firstChild) {
      var iconMarkup =
        UI && typeof UI.icon === 'function'
          ? UI.icon('download', 14)
          : typeof nnIcons !== 'undefined' && typeof nnIcons.getSvg === 'function'
            ? nnIcons.getSvg('download', { size: 14 })
            : ''
      if (iconMarkup) saveIcon.innerHTML = iconMarkup
    }
    if (saveSnapshotBtn && !saveSnapshotBtn.getAttribute('data-nn-bound')) {
      saveSnapshotBtn.setAttribute('data-nn-bound', '1')
      saveSnapshotBtn.addEventListener('click', function () {
        closeModal()
        saveSnapshot(doc, state)
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
    captureExportedShell(active)
    if (active.documentElement) {
      active.documentElement.setAttribute('data-nn-console-booted', 'true')
    }
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

    // A console left open in a background tab must cost nothing. The class is the
    // single switch the stylesheet hangs `animation-play-state: paused` on, and it
    // parks every permanent `animation: ... infinite` (dock attention blink, ping,
    // skeleton, spinners) that would otherwise repaint a huge document forever.
    var rootEl = active.documentElement
    var activeWindow = active.defaultView
    if (rootEl && rootEl.classList && typeof rootEl.classList.toggle === 'function') {
      var applyPaused = function () {
        rootEl.classList.toggle('nn-paused', !!active.hidden)
      }
      applyPaused()
      if (activeWindow && activeWindow.addEventListener)
        listen(activeWindow, 'visibilitychange', applyPaused)
    }
    var config = parseConfig(slotText(active, 'nn-config'))
    // The nn-model slot is compressed: autoBoot decodes it before this synchronous boot,
    // and a caller that decoded it itself passes the JSON text as `opts.modelText`.
    if (opts && typeof opts.modelText === 'string' && decodedModels)
      decodedModels.set(active, opts.modelText)
    var modelText =
      opts && typeof opts.modelText === 'string' ? opts.modelText : modelSlotText(active)
    var slots = parseSlots(slotText(active, 'nn-schema'), modelText)
    var viewData = parseViewData(slotText(active, 'nn-view-data'))
    var savedDrafts = parseDraftsSlot(slotText(active, 'nn-drafts'))
    // Wire the procedure fold when the export shipped one, so a view can project a run from
    // the drafts it holds. Absent slot: views fall back to the exported state.
    if (
      typeof nnProcedureCore !== 'undefined' &&
      nnProcedureCore &&
      typeof nnProcedureCore.useFromDocument === 'function'
    ) {
      nnProcedureCore.useFromDocument(active)
    }
    var uiState = isObject(savedDrafts.uiState) ? savedDrafts.uiState : null
    var schema = slots.schema
    var model = slots.model
    var meta = isObject(model.meta) ? model.meta : {}
    var consoleScope = consoleScopeMeta(meta)
    if (consoleScope.readOnly && active.documentElement) {
      active.documentElement.setAttribute('data-nn-readonly', 'true')
    }
    // Change A: install the model-ownership resolver so a `derived` model's units
    // offer no edit pencil (ui-kit unitEditability). Keyed by model id and title.
    var ownershipByModel = {}
    var modelList = Array.isArray(meta.models) ? meta.models : []
    if (consoleScope.models.length > 0) {
      var wantedModels = consoleScope.models.map(function (m) {
        return m.toLowerCase()
      })
      modelList = modelList.filter(function (mm) {
        if (!mm) return false
        var key = String(
          mm.id != null ? mm.id : mm.slug != null ? mm.slug : mm.title || '',
        ).toLowerCase()
        return wantedModels.indexOf(key) !== -1
      })
      // Every downstream consumer (picker, reference index, banner) sees the scope.
      meta.models = modelList
    }
    modelList.forEach(function (mm) {
      if (!mm) return
      if (mm.id != null) ownershipByModel[String(mm.id)] = mm.ownership || 'authored'
      if (mm.title != null) ownershipByModel[String(mm.title)] = mm.ownership || 'authored'
    })
    if (typeof UI.setModelOwnership === 'function') {
      UI.setModelOwnership(function (id) {
        return ownershipByModel[String(id)]
      })
    }
    // The console's reference index: `collections` is the `collection(C)` slot the
    // exporter filled from the domain index, `meta.models` carries the titles. A
    // field storing an address renders the target's title from here. A standalone
    // console exported without the index slot falls back to the elements it
    // already holds, addressed the compact way (`<model-id>@<slug>`).
    var elements = Array.isArray(model.elements) ? model.elements : []
    var payloadCollections = isObject(model.collections) ? model.collections : {}
    if (!Object.keys(payloadCollections).length)
      payloadCollections = collectionsFromElements(elements, meta)
    var referenceIndex =
      UI && typeof UI.buildReferenceIndex === 'function'
        ? UI.buildReferenceIndex({
            models: modelList,
            collections: payloadCollections,
            elements: elements,
          })
        : null
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var concepts = (Array.isArray(schema.concepts) ? schema.concepts.slice() : []).map(
      function (c) {
        return typeof c === 'string' ? { name: c } : c
      },
    )
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
      ;['nn-rail'].forEach(function (id) {
        var node = active.getElementById(id)
        if (node && node.parentNode) node.parentNode.removeChild(node)
      })
      var scopedToolbar = active.querySelector('.nn-toolbar')
      if (scopedToolbar && scopedToolbar.parentNode)
        scopedToolbar.parentNode.removeChild(scopedToolbar)
      if (active.documentElement) active.documentElement.setAttribute('data-nn-scope', scopedView)
    }
    var baseId = String(meta.modelId || meta.model || meta.title || 'model')

    var state = Object.assign(
      exportStateOf(
        meta,
        scopedView ? { view: scopedView, label: scopedDef ? scopedDef.title : scopedView } : null,
      ),
      {
        elements: elements,
        // The domain's changesets, newest first (export-console sorts them): the
        // Changes tab's applied history.
        changes: Array.isArray(model.changes) ? model.changes : [],
        // Reference rendering/autocomplete index (collections + model titles).
        referenceIndex: referenceIndex,
        collections: payloadCollections,
        schema: schema,
        concepts: concepts,
        store: Review.createDraftStore(
          safeLocalStorage(),
          // A domain console keys its drafts by the stable domain id, never by content.
          String(meta.domainId || baseId) +
            (scopedView ? '::view:' + scopedView : '') +
            (consoleScope.models.length > 0 ? '::models:' + consoleScope.models.join(',') : ''),
          {
            initialDrafts: Array.isArray(savedDrafts.drafts) ? savedDrafts.drafts : [],
            onError: function (err) {
              notifyStoreError(active, err)
            },
            // Another tab changed the drafts: repaint from the merged store.
            onRemoteChange: function () {
              state.refreshUi()
            },
          },
        ),
      },
    )
    state.refreshUi = function () {
      refresh(activeSearchQuery)
      refreshDraftCounts()
    }
    cleanups.push(function () {
      if (state.store && typeof state.store.destroy === 'function') state.store.destroy()
      setUnloadGuard(activeWindow, false)
    })
    if (state.store && state.store.persistent === false) {
      showToast(
        active,
        'Browser storage is unavailable: drafts are kept in memory and will be lost on reload. Export your changes before leaving.',
      )
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
    if (uiState) {
      if (uiState.reviewer) {
        setReviewerName(uiState.reviewer)
      }
      if (uiState.searchQuery) {
        activeSearchQuery = String(uiState.searchQuery)
      }
      if (uiState.selectedElementId) {
        focusId = String(uiState.selectedElementId)
      }
    }
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
    //
    // A rail token may carry MORE than one facet: a concept row nested under a model
    // submits `model:<id> concept:<name>`, so the row narrows to its own model instead
    // of filtering the whole domaiNN by that concept alone. Each facet toggles on its
    // own, so re-clicking the row removes both.
    function selectRailToken(token) {
      var search = active.getElementById('nn-search')
      var current = activeSearchQuery !== undefined ? activeSearchQuery : search ? search.value : ''
      // Same operator grammar parseFilterQuery tokenizes with, kept as raw text so the
      // value's case survives into the search box.
      var incoming = String(token == null ? '' : token).match(
        /[^\s"':]+:(?:"[^"]*"|'[^']*'|[^\s()]+)/g,
      )
      if (!incoming || !incoming.length) {
        if (search) {
          search.value = token
          refresh(token)
        }
        return
      }
      var parsed = parseFilterQuery(current)
      var ops = parsed.operators.slice()
      var parsedIncoming = incoming.map(function (raw) {
        var at = raw.indexOf(':')
        return {
          key: raw.slice(0, at).toLowerCase(),
          val: raw.slice(at + 1).replace(/^["']|["']$/g, ''),
          raw: raw,
        }
      })
      function indexOfOp(op) {
        for (var i = 0; i < ops.length; i++) {
          if (ops[i].key === op.key && String(ops[i].val).toLowerCase() === op.val.toLowerCase()) {
            return i
          }
        }
        return -1
      }
      parsedIncoming.forEach(function (op) {
        var at = indexOfOp(op)
        if (at !== -1) ops.splice(at, 1)
        else ops.push({ key: op.key, val: op.val, raw: op.raw })
      })
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
      var search = active.getElementById('nn-search')
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
      // A reference link opens the instance it addresses: its first element card in
      // this console, or the model facet when the target is not loaded here.
      onReference: function (address) {
        var model = String(address || '').split('@')[0]
        var first = null
        for (var i = 0; i < elements.length; i++) {
          var e = elements[i]
          if (e && String(e.modelId || '') === model) {
            first = e
            break
          }
        }
        if (first) {
          focusElementCard(active, first.id)
          return
        }
        if (resolveKnowledgeModel(meta, model)) addFacetToken('model', model)
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
      var bannerCount = active.querySelector('.nn-banner-drafts')
      if (bannerCount) bannerCount.textContent = ' unsent: ' + n
      var dockCount = active.querySelector('#nn-review-dock .nn-dock-drafts')
      if (dockCount) dockCount.textContent = 'Unsent: ' + n
      var changesButton = active.getElementById('nn-feedback-open')
      if (changesButton) changesButton.textContent = 'Changes · ' + n
      var dialog = active.getElementById('nn-feedback-modal')
      if (dialog && dialog.hasAttribute('open')) updateExportPreview(active, state)
      updateTabBadges(active, state)
      mountNavbarActions(active, state)
      applyUnsentSignal(active, n)
      setUnloadGuard(activeWindow, n > 0)
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
        reviewed:
          state.store && typeof state.store.reviewed === 'function' ? state.store.reviewed() : {},
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
        mountElementTable(
          active,
          filteredElements,
          currentDrafts,
          concepts,
          sortState,
          schema,
          function (key) {
            if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
            else {
              sortState.key = key
              sortState.dir = 'asc'
            }
            refresh(activeSearchQuery)
          },
          (meta && (meta.modelId || meta.model)) || '',
        )
      } else if (explorerView === 'badges') {
        mountElementBadges(
          active,
          filteredElements,
          currentDrafts,
          concepts,
          refs,
          (meta && (meta.modelId || meta.model)) || '',
          sortState,
        )
      } else if (explorerView === 'cards') {
        mountElementMiniCards(
          active,
          filteredElements,
          currentDrafts,
          concepts,
          refs,
          incomingById,
          cardActions,
          (meta && (meta.modelId || meta.model)) || '',
          sortState,
        )
      } else {
        mountElementCards(
          active,
          filteredElements,
          currentDrafts,
          refs,
          concepts,
          schema,
          incomingById,
          focusId,
          cardActions,
          (meta && (meta.modelId || meta.model)) || '',
          state.referenceIndex,
          sortState,
        )
        focusId = null
      }
      renderFilterBar(
        active,
        state,
        function (nextQuery) {
          var sBox = active.getElementById('nn-search')
          if (sBox) sBox.value = nextQuery
          refresh(nextQuery)
        },
        activeSearchQuery,
        sortState,
        function (nextKey, nextDir) {
          if (nextKey === null) {
            sortState.key = ''
            sortState.dir = 'asc'
          } else {
            sortState.key = nextKey
            if (nextDir) sortState.dir = nextDir
            else if (!sortState.dir) sortState.dir = 'asc'
          }
          refresh(activeSearchQuery)
        },
      )
      renderBanner(
        active,
        meta,
        config.needs,
        currentDrafts.length,
        function () {
          refresh(activeSearchQuery)
        },
        state,
      )
      mountNavbarActions(active, state)
      applyUnsentSignal(active, currentDrafts.length)
      setUnloadGuard(activeWindow, currentDrafts.length > 0)
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
      var docHost = active.getElementById('nn-doc')
      if (docHost) {
        docHost.style.display = activeSearchQuery ? 'none' : ''
      }

      renderReviewTab(active, state, config, function () {
        refresh(activeSearchQuery)
      })
      updateTabBadges(active, state)

      var hist =
        active.defaultView && active.defaultView.history
          ? active.defaultView.history
          : typeof history !== 'undefined'
            ? history
            : null
      if (hist && hist.replaceState && active.location) {
        var shownTab = tabs ? tabs.current() || tabs.hashTab() : ''
        var nextHash = buildViewHash(shownTab, activeSearchQuery)
        if (activeSearchQuery || parseViewHash(active.location.hash).q) {
          if (nextHash !== active.location.hash) {
            hist.replaceState(
              null,
              '',
              nextHash || active.location.pathname + active.location.search,
            )
          }
        }
      }

      var content = active.getElementById('nn-content') || active.getElementById('content')
      if (content) {
        var Evt =
          (active.defaultView && active.defaultView.CustomEvent) ||
          (typeof CustomEvent !== 'undefined' ? CustomEvent : null)
        if (Evt) {
          active.dispatchEvent(new Evt('nn:rendered', { detail: { root: content } }))
        }
      }
    }

    if (hasNeed(config, 'feedback-export')) {
      ensureFeedbackUi(active, state)
    }

    var initialQuery = ''
    if (
      !scopedView &&
      typeof active.location !== 'undefined' &&
      active.location &&
      active.location.hash
    ) {
      initialQuery = parseViewHash(active.location.hash).q
    }
    if (!initialQuery && uiState && uiState.searchQuery) {
      initialQuery = String(uiState.searchQuery)
    }

    var searchBox = active.getElementById('nn-search')
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
      viewData: viewData,
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
    mountNavbarActions(active, state)
    active.__nnConsoleState = state
    activeState = state
    refresh(initialQuery, !!(tabs && tabs.hashTab()))

    if (uiState && uiState.activeTab && tabs) {
      var hasHashTab =
        typeof active.location !== 'undefined' && active.location && active.location.hash
          ? parseViewHash(active.location.hash).tab
          : ''
      if (!hasHashTab && typeof tabs.select === 'function') {
        tabs.select(uiState.activeTab)
      }
    }

    // C3: the controller builds the toggle into the (now rendered) banner and
    // listens for nn:rendered; created after the first paint so the banner
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
        needs: config.needs,
        store: state.store,
        schema: schema,
        referenceIndex: referenceIndex,
        getReviewer: getReviewerName,
        onDraftsChanged: refreshDraftCounts,
        // Change C: clicking a change's evidence opens the in-domain unit it points
        // at, or the citation dialog when it is an external file.
        onEvidence: function (citeData) {
          var entry = citeData && citeData.entry ? citeData.entry : null
          var ev = String(
            entry
              ? entry.path || ''
              : typeof citeData === 'string'
                ? citeData
                : (citeData && citeData.value) || '',
          ).trim()
          var at = ev.indexOf('@')
          var target = at === -1 ? ev : ev.slice(0, at)
          var list = Array.isArray(elements) ? elements : []
          var match = null
          if (target) {
            for (var i = 0; i < list.length; i++) {
              var cand = list[i]
              if (
                cand &&
                (cand.modelFile === target ||
                  cand.modelId === target ||
                  cand.canonicalUnit === target)
              ) {
                match = cand
                break
              }
            }
          }
          if (match) {
            focusElementCard(active, match.id)
            return
          }
          renderCitationDialog(active, 'evidence', [
            entry || {
              origin: 'document',
              path: ev,
              exists: true,
              field: 'evidence',
              ...(ev ? { href: ev } : {}),
            },
          ])
        },
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
          var handled = false
          var ctrl = state.controller
          if (ctrl && typeof ctrl.handleKuAction === 'function') {
            handled = ctrl.handleKuAction(action === 'changes' ? 'info' : action, descriptor)
          }
          if (!handled && (action === 'info' || action === 'changes')) {
            var withFacts = Object.assign({}, descriptor, {
              facts: Object.assign(
                {},
                (descriptor && descriptor.facts) || {},
                unitFacts(descriptor),
              ),
            })
            var panel = UI.KuInfoPanel(withFacts, {
              onReveal: function () {
                revealUnit(descriptor)
              },
            })
            if (active.body) active.body.appendChild(panel)
            if (panel && typeof panel.showModal === 'function') panel.showModal()
            else if (panel) panel.setAttribute('open', 'true')
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
        ? Array.isArray(elements)
          ? elements.filter(function (e) {
              return !e || e.concept !== 'Work'
            })
          : []
        : elements
      renderDocumentView(
        active,
        docElements,
        concepts,
        (meta && (meta.modelId || meta.model)) || '',
      )
    }
    renderMatrices(active, matrices, concepts, (meta && (meta.modelId || meta.model)) || '')
    renderFilesTab(active, model && model.files, {
      elements: elements,
      changes: model && Array.isArray(model.changes) ? model.changes : [],
      onReveal: function (descriptor) {
        revealUnit(descriptor)
      },
    })
    renderMetamodelView(active, schema, matrices, elements)
    renderSummaryView(active, model, schema, meta)
    renderVersionsView(active, meta)
    renderMapView(active, model, schema, meta)

    var searchBox = active.getElementById('nn-search')
    if (searchBox) {
      listen(searchBox, 'input', function (event) {
        refresh(event.target && event.target.value ? event.target.value : '')
      })
    }

    if (hasNeed(config, 'feedback-export')) {
      var exportBtn =
        active.getElementById('nn-feedback-open') || active.getElementById('nn-export-open')
      if (exportBtn && !exportBtn.getAttribute('data-nn-bound')) {
        exportBtn.setAttribute('data-nn-bound', '1')
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
      var box = active.getElementById('nn-search')
      if (box) box.value = address
      refresh(address)
      return false
    }

    // A deep link is honored for one render: `chunked()` mounts the page holding the
    // card, and every later refresh re-mounts the first page because the focus id is
    // consumed once by contract. Keeping `#el-<id>` in the address bar would then
    // name a card the DOM no longer holds, so the URL forgets it as soon as the boot
    // or the hashchange has revealed it. A query hash the refresh wrote is left alone.
    function forgetDeepLink() {
      var loc = active.location
      if (!loc || !/^#el-/.test(String(loc.hash || ''))) return
      var hist =
        active.defaultView && active.defaultView.history
          ? active.defaultView.history
          : typeof history !== 'undefined'
            ? history
            : null
      if (!hist || typeof hist.replaceState !== 'function') return
      hist.replaceState(null, '', loc.pathname + loc.search)
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
        var visible = filterElements([targetEl], activeSearchQuery, {
          draftsById: {},
          reviewed: {},
        })
        if (!visible.length) {
          query = 'concept:' + String(targetEl.concept || '')
          var searchInput = active.getElementById('nn-search')
          if (searchInput) searchInput.value = query
        }
        if (tabs) tabs.select('explorer', true)
        refresh(query, true)
        var card = active.getElementById('el-' + elemId)
        if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView()
        forgetDeepLink()
        return
      }
      var parsed = parseViewHash(active.location ? active.location.hash : '')
      if (!scopedView && parsed.q !== activeSearchQuery) {
        // Back/forward to an entry with a different query: follow it.
        var box = active.getElementById('nn-search')
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

    if (consoleScope.readOnly) applyReadOnlyControls(active)

    return {
      ok: true,
      needs: config.needs,
      elements: elements.length,
      controller: state.controller,
      registry: registry,
      state: state,
      scope: consoleScope,
    }
  }

  // Decodes the compressed nn-model slot, then runs the synchronous boot. A browser
  // without DecompressionStream (or a corrupt slot) gets a visible message, never a
  // blank page.
  function decodeAndBoot(doc) {
    return decodeModelSlot(doc)
      .then(function (modelText) {
        return boot(doc, { modelText: modelText })
      })
      .catch(function (err) {
        showBootError(doc, err)
        if (typeof console !== 'undefined' && console.warn)
          console.warn('nn-console boot failed', err)
        return { ok: false, reason: 'boot-failed', error: err }
      })
  }

  // The self-boot of this page, once autoBoot started it: resolves to the boot result.
  var autoBooted = null
  function whenBooted() {
    return autoBooted || Promise.resolve(null)
  }

  function autoBoot() {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.__innfoNoAutoBoot) return
      if (typeof document === 'undefined' || !document.getElementById) return
      if (
        document.documentElement &&
        document.documentElement.getAttribute('data-nn-console-booted') === 'true'
      )
        return
      if (!document.getElementById('nn-config')) return
      if (document.documentElement) {
        document.documentElement.setAttribute('data-nn-console-booted', 'true')
      }
      if (document.readyState === 'loading') {
        autoBooted = new Promise(function (resolve) {
          document.addEventListener('DOMContentLoaded', function () {
            resolve(decodeAndBoot(document))
          })
        })
      } else {
        autoBooted = decodeAndBoot(document)
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('nn-console boot failed', err)
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
    changesetStampOf: changesetStampOf,
    consoleScopeMeta: consoleScopeMeta,
    draftStoreId: draftStoreId,
    getReviewerName: getReviewerName,
    setReviewerName: setReviewerName,
    parseConfig: parseConfig,
    hasNeed: hasNeed,
    parseSlots: parseSlots,
    MODEL_SLOT_TYPE: MODEL_SLOT_TYPE,
    decodeModelText: decodeModelText,
    encodeModelText: encodeModelText,
    decodeModelSlot: decodeModelSlot,
    decodeAndBoot: decodeAndBoot,
    whenBooted: whenBooted,
    showBootError: showBootError,
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
    mountElementCards: mountElementCards,
    renderExplorerToolbar: renderExplorerToolbar,
    sortElements: sortElements,
    sortTableElements: sortTableElements,
    renderMediaDialog: renderMediaDialog,
    renderFieldDetailDialog: renderFieldDetailDialog,
    renderMetamodelView: renderMetamodelView,
    incomingRelationsMap: incomingRelationsMap,
    renderDocument: renderDocument,
    renderDocumentView: renderDocumentView,
    buildTree: buildTree,
    resolveParentId: resolveParentId,
    chainOf: chainOf,
    compileChartSeries: compileChartSeries,
    monthAxis: monthAxis,
    renderChart: renderChart,
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
    composeSavedExport: composeSavedExport,
    exportStateOf: exportStateOf,
    composeChangesetExport: composeChangesetExport,
    verdictDraft: verdictDraft,
    downloadChangesetExport: downloadChangesetExport,
    connectFolder: connectFolder,
    writeChangesetToFolder: writeChangesetToFolder,
    copyChangesetPrompt: copyChangesetPrompt,
    saveSnapshot: saveSnapshot,
    copyAgentPrompt: copyAgentPrompt,
    composeAgentPrompt: composeAgentPrompt,
    mountNavbarActions: mountNavbarActions,
    boot: boot,
    fieldDefOf: fieldDefOf,
    resolveKnowledgeModel: resolveKnowledgeModel,
  }

  return PUBLIC_API
})
