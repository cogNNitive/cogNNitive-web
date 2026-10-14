/* bluepriNNt innovation/assets/console-view-portfolio-timeline.js
   Innovation portfolio timeline — a blueprint console view (convention: flat
   under assets/, prefix console-view-; id = slug after the prefix).

   Places each Initiative on a shared time axis: a bar when it declares both a
   start and an end date, a point marker otherwise (falling back to the
   registration date). If no initiative carries a date at all, it degrades to a
   lane per phase instead of an empty frame.

   Labels reuse ctx.ui.ElementPill (so the row carries the same concept pill as
   the rest of the console). Editing is the console's generic mechanism — the
   runtime injects per-card EditToggle controls when Review mode is on — so this
   view wires no edit button. */

registerView({
  title: 'Portfolio Timeline',
  icon: 'timeline',
  order: 140,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = elementsOf(ctx)
    var initiatives = pick(elements, 'Initiative')
    if (!initiatives.length) {
      empty(ctx, 'No initiatives in this portfolio yet.')
      return
    }

    var rows = initiatives.map(toRow)
    var dated = rows.filter(function (r) {
      return r.start
    })
    injectStyle(doc, 'iv-timeline-style', CSS)

    if (!dated.length) {
      renderLanes(ctx, rows)
      return
    }
    renderTimeAxis(doc, ctx, rows, dated)
  },
})

/* ---- data helpers (payload element: {id,name,concept,fields,relations}) ---- */

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
function parseDate(value) {
  var s = String(value || '').trim()
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}
function toRow(initiative) {
  var start =
    parseDate(fieldOf(initiative, 'initiativeStartDate')) ||
    parseDate(fieldOf(initiative, 'initiativeDateRegistered'))
  var end = parseDate(fieldOf(initiative, 'initiativeEndDate')) || start
  if (start && end && end < start) {
    var t = start
    start = end
    end = t
  }
  return {
    element: initiative,
    start: start,
    end: end,
    phase: fieldOf(initiative, 'initiativePhase').trim(),
  }
}

/* ---- time-axis rendering ---- */

function renderTimeAxis(doc, ctx, rows, dated) {
  var min = dated[0].start
  var max = dated[0].end || dated[0].start
  dated.forEach(function (r) {
    if (r.start < min) min = r.start
    if (r.end && r.end > max) max = r.end
  })
  var span = Math.max(max - min, 86400000)
  var lo = min.getTime() - span * 0.05
  var hi = max.getTime() + span * 0.05
  var total = hi - lo
  var pos = function (d) {
    return ((d.getTime() - lo) / total) * 100
  }

  var wrap = doc.createElement('div')
  wrap.className = 'iv-tl'

  var axis = doc.createElement('div')
  axis.className = 'iv-tl-axis'
  axis.appendChild(axisLabel(doc, 'iv-tl-axis-start', isoDate(new Date(lo))))
  axis.appendChild(axisLabel(doc, 'iv-tl-axis-end', isoDate(new Date(hi))))
  wrap.appendChild(axis)

  var sorted = rows.slice().sort(function (a, b) {
    return (a.start ? a.start.getTime() : hi) - (b.start ? b.start.getTime() : hi)
  })
  sorted.forEach(function (r) {
    wrap.appendChild(renderRow(doc, ctx, r, pos, total))
  })
  ctx.container.appendChild(wrap)
}

function renderRow(doc, ctx, row, pos, total) {
  var line = doc.createElement('div')
  line.className = 'iv-tl-row'
  line.appendChild(labelFor(doc, ctx, row.element))

  var track = doc.createElement('div')
  track.className = 'iv-tl-track'

  if (!row.start) {
    var nodate = doc.createElement('span')
    nodate.className = 'iv-tl-nodate'
    nodate.textContent = 'no date'
    track.appendChild(nodate)
  } else {
    var bar = doc.createElement('div')
    bar.className = 'iv-tl-bar'
    bar.setAttribute('title', (row.element.name || '') + (row.phase ? ' — ' + row.phase : ''))
    var left = pos(row.start)
    var width = Math.max(pos(row.end || row.start) - left, (86400000 / total) * 100 * 3)
    bar.style.left = left + '%'
    bar.style.width = Math.min(width, Math.max(100 - left, 1.5)) + '%'
    track.appendChild(bar)
  }
  line.appendChild(track)
  return line
}

function axisLabel(doc, cls, text) {
  var s = doc.createElement('span')
  s.className = cls
  s.textContent = text
  return s
}

/* ---- fallback: lanes grouped by phase (no dates present) ---- */

function renderLanes(ctx, rows) {
  var doc = ctx.container.ownerDocument
  var byPhase = {}
  var order = []
  rows.forEach(function (r) {
    var k = r.phase || 'Unassigned'
    if (!byPhase[k]) {
      byPhase[k] = []
      order.push(k)
    }
    byPhase[k].push(r)
  })
  var wrap = doc.createElement('div')
  wrap.className = 'iv-tl-lanes'
  order.forEach(function (k) {
    var lane = doc.createElement('div')
    lane.className = 'iv-tl-lane'
    var head = doc.createElement('div')
    head.className = 'iv-tl-lane-head'
    head.textContent = k
    lane.appendChild(head)
    byPhase[k].forEach(function (r) {
      lane.appendChild(labelFor(doc, ctx, r.element))
    })
    wrap.appendChild(lane)
  })
  ctx.container.appendChild(wrap)
}

/* ---- shared bits ---- */

/* A label that reuses the console's ElementPill (concept icon + element name).
   ElementPill reads data.label (NOT data.name) — passing name renders icon-only. */
function labelFor(doc, ctx, element) {
  var host = doc.createElement('div')
  host.className = 'iv-tl-label'
  host.title = element.name || ''
  var ui = ctx.ui
  if (ui && typeof ui.ElementPill === 'function') {
    try {
      var meta = conceptMeta(ctx, element.concept)
      host.appendChild(
        ui.ElementPill(
          {
            id: element.id,
            label: element.name || element.id,
            concept: element.concept,
            index: meta.index,
            color: meta.color,
          },
          { doc: doc },
        ),
      )
      return host
    } catch (err) {
      /* fall through to plain text */
    }
  }
  host.textContent = element.name || '(initiative)'
  return host
}

function conceptMeta(ctx, name) {
  var s = ctx && ctx.payload && ctx.payload.schema
  var list = s && Array.isArray(s.concepts) ? s.concepts : []
  for (var i = 0; i < list.length; i++) {
    var c = list[i]
    var cn = typeof c === 'string' ? c : c && c.name
    if (cn === name || String(cn || '').toLowerCase() === String(name || '').toLowerCase()) {
      return { index: i, color: c && c.color, icon: c && c.icon }
    }
  }
  return { index: 0 }
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
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
  '.iv-tl{padding:.25rem 0 1rem;overflow-x:auto}',
  '.iv-tl-axis{display:flex;justify-content:space-between;color:var(--innfo-muted);font-size:.72rem;border-bottom:1px solid var(--innfo-border);padding:0 0 .35rem;margin-left:14.6rem}',
  '.iv-tl-row{display:flex;align-items:center;gap:.6rem;min-width:34rem;padding:.28rem 0}',
  '.iv-tl-label{flex:0 0 14rem;display:flex;align-items:center;min-width:0;overflow:hidden}',
  '.iv-tl-label .innfo-element-pill{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.iv-tl-track{position:relative;flex:1 1 auto;height:1.2rem;background:var(--innfo-surface-2);border-radius:6px;border:1px solid var(--innfo-border)}',
  '.iv-tl-bar{position:absolute;top:0;bottom:0;background:var(--innfo-concept-1);border-radius:6px;opacity:.85}',
  '.iv-tl-nodate{position:absolute;right:.5rem;top:0;bottom:0;display:flex;align-items:center;color:var(--innfo-muted);font-size:.7rem}',
  '.iv-tl-lanes{display:flex;gap:1rem;align-items:flex-start;overflow-x:auto;padding:.25rem 0 1rem}',
  '.iv-tl-lane{flex:0 0 14rem;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:10px;padding:.6rem;display:flex;flex-direction:column;gap:.5rem}',
  '.iv-tl-lane-head{font-weight:600;font-size:.8rem;color:var(--innfo-text)}',
].join('\n')
