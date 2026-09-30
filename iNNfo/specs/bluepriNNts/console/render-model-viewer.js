/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.InnfoModelViewer = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var RENDERER_VERSION = '0.1.0'

  var COLORS = {
    red: '#ef4444',
    orange: '#f97316',
    amber: '#f59e0b',
    yellow: '#eab308',
    green: '#22c55e',
    teal: '#14b8a6',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#6b7280',
    grey: '#6b7280',
  }

  function parseJSON(id) {
    var node = document.getElementById(id)
    if (!node) return null
    try {
      return JSON.parse(node.textContent.trim() || '{}')
    } catch (e) {
      console.error('Bad JSON in #' + id, e)
      return null
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  // ---- Citation icons (Console Citation Icons / Tanda C) ----
  var SOURCES_FAMILY = { sources: true, source: true }
  var ORIGIN_VARIANT_ORDER = ['error', 'agent', 'human', 'reviewer', 'document']
  var CITATION_ICON_LABELS = {
    error: 'Unresolved citation',
    agent: 'AI agent',
    human: 'Human author',
    reviewer: 'Reviewer feedback',
    document: 'Document',
  }

  function citationVariant(entry) {
    if (entry && entry.error) return 'error'
    var origin = entry && entry.origin
    return Object.prototype.hasOwnProperty.call(CITATION_ICON_LABELS, origin) ? origin : 'document'
  }

  // Returns a `span.cite-icons` of one button per distinct origin/error
  // variant present in `entries`, or null when there is nothing to show or
  // the shared runtime (icons + dialog) is not loaded. Degrading to null is
  // identical to pre-citations rendering — see design D7/D9.
  function citationButtons(fieldName, entries) {
    var rt = typeof window !== 'undefined' ? window.InnfoConsole : null
    if (!rt || typeof rt.renderCitationDialog !== 'function' || typeof rt.svgIcon !== 'function') {
      return null
    }
    var list = Array.isArray(entries) ? entries : []
    if (!list.length) return null

    var present = {}
    list.forEach(function (entry) {
      present[citationVariant(entry)] = true
    })

    var span = document.createElement('span')
    span.className = 'cite-icons'
    var any = false
    ORIGIN_VARIANT_ORDER.forEach(function (variant) {
      if (!present[variant]) return
      any = true
      var btn = document.createElement('button')
      btn.setAttribute('type', 'button')
      btn.className = 'cite-icon cite-' + variant
      var label = (CITATION_ICON_LABELS[variant] || variant) + ': ' + fieldName
      btn.setAttribute('aria-label', label)
      btn.setAttribute('title', label)
      btn.innerHTML = rt.svgIcon('cite-' + variant, 14)
      btn.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        rt.renderCitationDialog(document, fieldName, list)
      })
      span.appendChild(btn)
    })
    return any ? span : null
  }

  function boot() {
    if (typeof document === 'undefined' || !document.getElementById) {
      return { ok: false, reason: 'no-document' }
    }
    var schema = parseJSON('innfo-schema') || {}
    var model = parseJSON('innfo-model') || {}
    var concepts = Array.isArray(schema.concepts) ? schema.concepts.slice() : []
    var elements = Array.isArray(model.elements) ? model.elements : []
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var meta = model.meta || {}

    concepts.sort(function (a, b) {
      return (b.weight || 0) - (a.weight || 0)
    })

    var byId = {}
    elements.forEach(function (el) {
      if (el && el.id) byId[el.id] = el
    })

    var elementsByConcept = {}
    elements.forEach(function (el) {
      var k = el.concept || 'Uncategorized'
      ;(elementsByConcept[k] = elementsByConcept[k] || []).push(el)
    })

    // ---- Header ----
    document.getElementById('doc-title').textContent = meta.title || 'Model Viewer'
    var metaBits = []
    if (meta.template)
      metaBits.push('<span><strong>Template</strong> ' + esc(meta.template) + '</span>')
    if (meta.modelVersion)
      metaBits.push('<span><strong>Model</strong> ' + esc(meta.modelVersion) + '</span>')
    if (meta.generated)
      metaBits.push(
        '<span><strong>Generated</strong> ' +
          esc(String(meta.generated).replace('T', ' ').replace(/\..*/, '')) +
          '</span>',
      )
    if (meta.sourceUrl)
      metaBits.push(
        '<span><a href="' + esc(meta.sourceUrl) + '" target="_blank" rel="noopener">source</a></span>',
      )
    document.getElementById('doc-meta').innerHTML = metaBits.join('')

    var content = document.getElementById('content')
    var rail = document.getElementById('rail')

    if (!concepts.length && !elements.length) {
      content.innerHTML =
        '<div class="empty-state">No data injected. This is the empty reference shell — run the <code>Compile Model Viewer</code> procedure to populate it.</div>'
      return { ok: true, reason: 'empty-shell', elements: 0 }
    }

    // ---- Rail ----
    var railButtons = []
    addRailButton('__all', 'All concepts', elements.length)
    concepts.forEach(function (c) {
      addRailButton(c.name, c.name, (elementsByConcept[c.name] || []).length)
    })
    // concepts present in the model but absent from schema
    Object.keys(elementsByConcept).forEach(function (name) {
      if (
        !concepts.some(function (c) {
          return c.name === name
        })
      ) {
        addRailButton(name, name, elementsByConcept[name].length)
      }
    })

    function addRailButton(key, label, count) {
      var b = document.createElement('button')
      b.dataset.key = key
      b.innerHTML = '<span>' + esc(label) + '</span><span class="count">' + count + '</span>'
      b.addEventListener('click', function () {
        selectConcept(key)
      })
      rail.appendChild(b)
      railButtons.push(b)
    }

    var activeConcept = '__all'
    function selectConcept(key) {
      activeConcept = key
      railButtons.forEach(function (b) {
        b.classList.toggle('active', b.dataset.key === key)
      })
      render()
    }

    // ---- Content ----
    var searchInput = document.getElementById('search')
    searchInput.addEventListener('input', render)

    function render() {
      var q = searchInput.value.trim().toLowerCase()
      content.innerHTML = ''

      var order = concepts.map(function (c) {
        return c.name
      })
      Object.keys(elementsByConcept).forEach(function (n) {
        if (order.indexOf(n) < 0) order.push(n)
      })

      var shown = 0
      order.forEach(function (name) {
        if (activeConcept !== '__all' && activeConcept !== name) return
        var list = (elementsByConcept[name] || []).filter(function (el) {
          return matchesQuery(el, q)
        })
        if (!list.length) return
        shown += list.length
        content.appendChild(renderConceptSection(name, list))
      })

      if (!shown) {
        var d = document.createElement('div')
        d.className = 'empty-state'
        d.textContent = q
          ? 'No elements match "' + searchInput.value + '".'
          : 'No elements for this concept.'
        content.appendChild(d)
      }

      if (matrices.length && activeConcept === '__all') {
        var gt = document.createElement('h2')
        gt.className = 'group-title'
        gt.textContent = 'Matrices'
        content.appendChild(gt)
        matrices.forEach(function (mx) {
          content.appendChild(renderMatrix(mx))
        })
      }

      applyHash()
    }

    function matchesQuery(el, q) {
      if (!q) return true
      if ((el.name || '').toLowerCase().indexOf(q) >= 0) return true
      if ((el.description || '').toLowerCase().indexOf(q) >= 0) return true
      var f = el.fields || {}
      return Object.keys(f).some(function (k) {
        return (k + ' ' + f[k]).toLowerCase().indexOf(q) >= 0
      })
    }

    function conceptColor(name) {
      var c = concepts.filter(function (x) {
        return x.name === name
      })[0]
      return (
        (c && COLORS[c.color]) ||
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() ||
        '#1f2937'
      )
    }

    function renderConceptSection(name, list) {
      var sec = document.createElement('section')
      sec.className = 'concept'
      sec.id = 'concept-' + slug(name)
      var col = conceptColor(name)
      var h = document.createElement('h2')
      h.innerHTML = '<span class="dot" style="background:' + col + '"></span>' + esc(name)
      sec.appendChild(h)
      var sub = document.createElement('p')
      sub.className = 'concept-sub'
      sub.textContent = list.length + (list.length === 1 ? ' element' : ' elements')
      sec.appendChild(sub)
      list.forEach(function (el) {
        sec.appendChild(renderElement(el, col))
      })
      return sec
    }

    function renderElement(el, col) {
      void col
      var wrap = document.createElement('div')
      wrap.className = 'element'
      wrap.id = 'el-' + (el.id || slug(el.name || 'x'))

      var head = document.createElement('div')
      head.className = 'el-head'
      head.innerHTML = '<span class="el-name">' + esc(el.name || '(unnamed)') + '</span>'
      var markers = el.markers || {}
      Object.keys(markers).forEach(function (m) {
        var chip = document.createElement('span')
        chip.className = 'chip'
        chip.innerHTML = esc(m) + ' <b>' + esc(String(markers[m])) + '</b>'
        head.appendChild(chip)
      })
      var citations = el.citations || {}
      var sourcesEntries = []
      Object.keys(citations).forEach(function (k) {
        if (SOURCES_FAMILY[k] && Array.isArray(citations[k])) {
          sourcesEntries = sourcesEntries.concat(citations[k])
        }
      })
      var headerCite = citationButtons('sources', sourcesEntries)
      if (headerCite) head.appendChild(headerCite)

      var chev = document.createElement('span')
      chev.className = 'chevron'
      chev.textContent = '▸'
      head.appendChild(chev)
      head.addEventListener('click', function () {
        wrap.classList.toggle('open')
      })
      wrap.appendChild(head)

      var body = document.createElement('div')
      body.className = 'el-body'
      if (el.description) {
        var p = document.createElement('p')
        p.className = 'desc'
        p.textContent = el.description
        body.appendChild(p)
      }
      var fields = el.fields || {}
      var fkeys = Object.keys(fields)
      if (fkeys.length) {
        var t = document.createElement('table')
        t.className = 'fields'
        fkeys.forEach(function (k) {
          var tr = document.createElement('tr')
          tr.innerHTML = '<td>' + esc(k) + '</td><td>' + esc(String(fields[k])) + '</td>'
          if (!SOURCES_FAMILY[k] && Array.isArray(citations[k])) {
            var fieldCite = citationButtons(k, citations[k])
            if (fieldCite) tr.lastChild.appendChild(fieldCite)
          }
          t.appendChild(tr)
        })
        body.appendChild(t)
      }
      var rels = Array.isArray(el.relations) ? el.relations : []
      if (rels.length) {
        var ul = document.createElement('ul')
        ul.className = 'rel-list'
        rels.forEach(function (r) {
          var li = document.createElement('li')
          var label = esc(r.targetLabel || r.target || '?')
          var linked =
            r.target && byId[r.target]
              ? '<a href="#el-' + esc(r.target) + '">' + label + '</a>'
              : label
          li.innerHTML =
            '<span class="rel-field">' + esc(r.field || 'related') + '</span> → ' + linked
          ul.appendChild(li)
        })
        body.appendChild(ul)
      }
      if (!el.description && !fkeys.length && !rels.length) {
        body.innerHTML =
          '<p class="desc" style="color:var(--muted)">No fields, markers, or relationships.</p>'
      }
      wrap.appendChild(body)
      return wrap
    }

    function renderMatrix(mx) {
      var block = document.createElement('div')
      block.className = 'matrix-block'
      var h = document.createElement('h3')
      h.textContent = mx.name || 'Matrix'
      block.appendChild(h)
      var scroll = document.createElement('div')
      scroll.className = 'matrix-scroll'
      var rows = mx.rows || [],
        cols = mx.cols || [],
        cells = mx.cells || {}
      var html = "<table class='matrix'><thead><tr><th></th>"
      cols.forEach(function (c) {
        html += '<th>' + esc(c) + '</th>'
      })
      html += '</tr></thead><tbody>'
      rows.forEach(function (r) {
        html += '<tr><th>' + esc(r) + '</th>'
        cols.forEach(function (c) {
          var v = cells[r] && cells[r][c] != null ? cells[r][c] : ''
          html += '<td>' + esc(String(v)) + '</td>'
        })
        html += '</tr>'
      })
      html += '</tbody></table>'
      scroll.innerHTML = html
      block.appendChild(scroll)
      return block
    }

    function applyHash() {
      var h = location.hash
      if (!h || h.length < 2) return
      var target = document.getElementById(h.slice(1))
      if (target && target.classList.contains('element')) {
        target.classList.add('open')
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    window.addEventListener('hashchange', function () {
      // ensure the concept holding the target is visible
      var id = location.hash.slice(1)
      var el = byId[id.replace(/^el-/, '')]
      if (el && activeConcept !== '__all' && activeConcept !== el.concept) {
        selectConcept('__all')
      } else {
        applyHash()
      }
    })

    selectConcept('__all')
    return { ok: true, elements: elements.length }
  }

  function autoBoot() {
    try {
      if (typeof document === 'undefined' || !document.getElementById) return
      // Viewer-only gate: the model_viewer shell owns #doc-title + nav#rail + #search.
      // #search is exclusive to the model_viewer shell, so this renderer never
      // auto-boots inside other shells that share #doc-title/#rail (e.g. the
      // procedures console) when loaded through the shared console bundle.
      if (!document.getElementById('doc-title') || !document.getElementById('rail')) return
      if (!document.getElementById('search')) return
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          boot()
        })
      } else {
        boot()
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-model-viewer boot failed', err)
    }
  }

  autoBoot()

  return {
    version: RENDERER_VERSION,
    RENDERER_VERSION: RENDERER_VERSION,
    boot: boot,
  }
})
