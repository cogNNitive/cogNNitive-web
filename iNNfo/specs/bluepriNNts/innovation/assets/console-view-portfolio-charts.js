/* consoles/views/portfolio-charts.js
   Innovation portfolio charts — a domaiNN console view (discovery convention:
   <domainRoot>/consoles/views/<slug>.js, id = file slug, classic script).

   Read-only distribution charts derived from the payload: opportunities by
   status and by source, initiatives by phase and by type. Rendered as CSS bars
   over the console theme tokens (no external chart dependency, so the view can
   never fail to mount). uPlot is vendored in the bundle and can replace the
   bars later without touching the data derivation. */

registerView({
  title: 'Portfolio Charts',
  icon: 'chart-bar',
  order: 150,
  kind: 'readonly',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = elementsOf(ctx)
    var specs = [
      {
        title: 'Opportunities by status',
        elements: pick(elements, 'Opportunity'),
        key: 'opportunityStatus',
      },
      {
        title: 'Opportunities by source',
        elements: pick(elements, 'Opportunity'),
        key: 'opportunitySource',
      },
      {
        title: 'Initiatives by phase',
        elements: pick(elements, 'Initiative'),
        key: 'initiativePhase',
      },
      {
        title: 'Initiatives by type',
        elements: pick(elements, 'Initiative'),
        key: 'initiativeType',
      },
    ].filter(function (s) {
      return s.elements.length
    })
    if (!specs.length) {
      empty(ctx, 'No portfolio data to chart yet.')
      return
    }

    injectStyle(doc, 'iv-charts-style', CSS)
    var grid = doc.createElement('div')
    grid.className = 'iv-charts'
    specs.forEach(function (s) {
      grid.appendChild(renderChart(doc, s))
    })
    ctx.container.appendChild(grid)
  },
})

/* ---- data helpers (element shape: {id,name,concept,fields,relations}) ---- */

function elementsOf(ctx) {
  var m = ctx && ctx.payload && ctx.payload.model
  return (m && Array.isArray(m.elements) ? m.elements : []).filter(Boolean)
}
function pick(elements, concept) {
  return elements.filter(function (e) {
    return e.concept === concept
  })
}
function fieldOf(element, key) {
  var v = element && element.fields ? element.fields[key] : null
  if (Array.isArray(v)) return v.join(', ')
  return v == null ? '' : String(v)
}

/* Count by field value, sorted desc by count then label; "Unspecified" bucket
   keeps missing values visible instead of silently dropping them. */
function tally(elements, key) {
  var counts = {}
  elements.forEach(function (e) {
    var v = fieldOf(e, key).trim() || 'Unspecified'
    counts[v] = (counts[v] || 0) + 1
  })
  var rows = Object.keys(counts).map(function (k) {
    return { label: k, value: counts[k] }
  })
  rows.sort(function (a, b) {
    return b.value - a.value || a.label.localeCompare(b.label)
  })
  return rows
}

/* ---- render ---- */

function renderChart(doc, spec) {
  var rows = tally(spec.elements, spec.key)
  var max = rows.reduce(function (m, r) {
    return Math.max(m, r.value)
  }, 1)

  var card = doc.createElement('section')
  card.className = 'iv-chart'

  var head = doc.createElement('h3')
  head.className = 'iv-chart-title'
  head.textContent = spec.title
  card.appendChild(head)

  rows.forEach(function (r, i) {
    var line = doc.createElement('div')
    line.className = 'iv-bar-row'

    var label = doc.createElement('span')
    label.className = 'iv-bar-label'
    label.title = r.label
    label.textContent = r.label
    line.appendChild(label)

    var track = doc.createElement('span')
    track.className = 'iv-bar-track'
    var fill = doc.createElement('span')
    fill.className = 'iv-bar-fill'
    fill.style.width = Math.round((r.value / max) * 100) + '%'
    fill.style.background = 'var(--innfo-concept-' + ((i % 10) + 1) + ')'
    track.appendChild(fill)
    line.appendChild(track)

    var val = doc.createElement('span')
    val.className = 'iv-bar-value'
    val.textContent = String(r.value)
    line.appendChild(val)

    card.appendChild(line)
  })
  return card
}

function empty(ctx, message) {
  var doc = ctx.container.ownerDocument
  var p = doc.createElement('p')
  p.className = 'empty-state'
  p.textContent = message
  ctx.container.appendChild(p)
}
function injectStyle(doc, id, css) {
  if (doc.getElementById(id)) return
  var s = doc.createElement('style')
  s.id = id
  s.textContent = css
  doc.head.appendChild(s)
}

var CSS = [
  '.iv-charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(20rem,1fr));gap:1rem;padding:.25rem 0 1rem}',
  '.iv-chart{background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:10px;padding:.8rem 1rem}',
  '.iv-chart-title{margin:0 0 .7rem;font-size:.85rem;font-weight:600;color:var(--innfo-text)}',
  '.iv-bar-row{display:flex;align-items:center;gap:.6rem;padding:.18rem 0}',
  '.iv-bar-label{flex:0 0 9rem;font-size:.76rem;color:var(--innfo-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.iv-bar-track{flex:1 1 auto;height:.85rem;background:var(--innfo-surface-2);border-radius:999px;overflow:hidden}',
  '.iv-bar-fill{display:block;height:100%;border-radius:999px;opacity:.9}',
  '.iv-bar-value{flex:0 0 2rem;text-align:right;font-size:.76rem;color:var(--innfo-text);font-variant-numeric:tabular-nums}',
].join('\n')
