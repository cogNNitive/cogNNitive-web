/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ui-kit.js'), require('./innfo-runtime.js'))
  } else {
    root.InnfoModelViewer = factory(root.InnfoUI, root.InnfoConsole)
  }
})(typeof self !== 'undefined' ? self : this, function (UI, InnfoConsole) {
  'use strict'

  // D5: the kit is a hard dependency; fail loudly rather than degrade silently.
  if (!UI) throw new Error('InnfoUI missing: load ui-kit.js first')

  var RENDERER_VERSION = '0.1.0'

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

  // ---- Citation icons (Console Citation Icons / Tanda C) ----
  var SOURCES_FAMILY = { sources: true, source: true }

  // One CitationIcon per distinct origin/error variant, in canonical order.
  // Returns an array of nodes (empty when there is nothing to show).
  function citationIcons(fieldName, entries) {
    var list = Array.isArray(entries) ? entries : []
    if (!list.length) return []
    var present = {}
    list.forEach(function (entry) {
      present[UI.CITATION_ORIGIN_LABELS[entry && entry.error ? 'error' : entry && entry.origin] ? (entry && entry.error ? 'error' : entry.origin) : 'document'] = true
    })
    var wrap = document.createElement('span')
    wrap.className = 'cite-icons'
    UI.ORIGIN_VARIANTS.forEach(function (variant) {
      if (!present[variant]) return
      wrap.appendChild(
        UI.CitationIcon(
          { variant: variant, field: fieldName },
          {
            onOpen: function () {
              var rt =
                (typeof window !== 'undefined' && window.InnfoConsole) || InnfoConsole
              if (rt && typeof rt.renderCitationDialog === 'function') {
                rt.renderCitationDialog(document, fieldName, list)
              }
            },
          },
        ),
      )
    })
    return wrap.children.length ? [wrap] : []
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
      if (key !== '__all') {
        b.appendChild(
          UI.ConceptPill({
            id: key,
            label: label,
            index: conceptIndex(key),
            color: conceptColorName(key),
            count: count,
          }),
        )
      } else {
        b.appendChild(document.createTextNode(String(label)))
        b.appendChild(makeCountSpan(count))
      }
      b.addEventListener('click', function () {
        selectConcept(key)
      })
      rail.appendChild(b)
      railButtons.push(b)
    }

    function makeCountSpan(count) {
      var span = document.createElement('span')
      span.className = 'count'
      span.textContent = String(count)
      return span
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

      // C2: one dispatch per card commit; the review controller (owned by
      // InnfoConsole) decorates the freshly rendered cards.
      document.dispatchEvent(new CustomEvent('innfo:rendered', { detail: { root: content } }))
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

    function conceptIndex(name) {
      // Slot index follows schema.concepts as declared (before the weight sort).
      var declared = Array.isArray(schema.concepts) ? schema.concepts : []
      for (var i = 0; i < declared.length; i++) {
        if (declared[i].name === name) return i
      }
      // Concepts absent from the schema continue in order of first appearance.
      var seen = Object.keys(elementsByConcept)
      var at = seen.indexOf(name)
      return at < 0 ? 0 : declared.length + at
    }

    function conceptColorName(name) {
      var c = concepts.filter(function (x) {
        return x.name === name
      })[0]
      return c && c.color
    }

    function renderConceptSection(name, list) {
      var sec = document.createElement('section')
      sec.className = 'concept'
      sec.id = 'concept-' + UI.slug(name)
      var h = document.createElement('h2')
      h.appendChild(
        UI.ConceptPill({
          id: name,
          label: name,
          index: conceptIndex(name),
          color: conceptColorName(name),
        }),
      )
      sec.appendChild(h)
      var sub = document.createElement('p')
      sub.className = 'concept-sub'
      sub.textContent = list.length + (list.length === 1 ? ' element' : ' elements')
      sec.appendChild(sub)
      list.forEach(function (el) {
        sec.appendChild(renderElement(el))
      })
      return sec
    }

    function renderElement(el) {
      var citations = el.citations || {}
      var sourcesEntries = []
      Object.keys(citations).forEach(function (k) {
        if (SOURCES_FAMILY[k] && Array.isArray(citations[k])) {
          sourcesEntries = sourcesEntries.concat(citations[k])
        }
      })
      var headerCite = citationIcons('sources', sourcesEntries)

      var markers = el.markers || {}
      var markerData = Object.keys(markers).map(function (m) {
        return { id: m, label: m, kind: 'marker', value: markers[m] }
      })

      var fields = el.fields || {}
      var fieldData = Object.keys(fields).map(function (k) {
        var cites = !SOURCES_FAMILY[k] && Array.isArray(citations[k]) ? citations[k] : undefined
        return { name: k, value: String(fields[k]), citations: cites }
      })

      var rels = Array.isArray(el.relations) ? el.relations : []
      var body = []
      if (rels.length) {
        var ul = document.createElement('ul')
        ul.className = 'rel-list'
        rels.forEach(function (r) {
          var li = document.createElement('li')
          li.appendChild(
            document.createTextNode(String(r.field || 'related') + ' \u2192 '),
          )
          if (r.target && byId[r.target]) {
            li.appendChild(
              UI.ElementPill(
                { id: r.target, label: r.targetLabel || r.target },
                { href: '#el-' + r.target },
              ),
            )
          } else {
            li.appendChild(document.createTextNode(String(r.targetLabel || r.target || '?')))
          }
          ul.appendChild(li)
        })
        body.push(ul)
      }

      return UI.ElementCard(
        {
          id: el.id,
          name: el.name || '(unnamed)',
          conceptId: el.concept,
          description: el.description,
          fields: fieldData,
          markers: markerData,
        },
        {
          domId: 'el-' + (el.id || UI.slug(el.name || 'x')),
          collapsible: true,
          head: headerCite,
          body: body,
        },
      )
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
      if (target && target.getAttribute('data-innfo-component') === 'element-card') {
        target.setAttribute('data-open', 'true')
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
