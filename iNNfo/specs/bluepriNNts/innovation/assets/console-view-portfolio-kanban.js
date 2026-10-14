/* bluepriNNt innovation/assets/console-view-portfolio-kanban.js
   Innovation portfolio Kanban — a blueprint console view (convention: flat under
   assets/, prefix console-view-; id = slug after the prefix, classic script).

   Groups the payload's Initiative elements into one column per lifecycle phase
   (column order from the Program's `programStages`). Each item is the console's
   own ctx.ui.ElementMini — the compact collection item (concept-color accent
   stripe + small thumb + name + one meta line), which fits a narrow board column
   without the field grid of a full ElementCard.

   Editing is the console's generic mechanism: the runtime injects per-card
   EditToggle controls once Review mode is enabled; this view wires no edit button. */

registerView({
  title: 'Portfolio Kanban',
  icon: 'columns',
  order: 130,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = elementsOf(ctx)
    var initiatives = pick(elements, 'Initiative')
    if (!initiatives.length) {
      empty(ctx, 'No initiatives in this portfolio yet.')
      return
    }

    var byId = byIdMap(elements)
    var columns = orderedColumns(elements, initiatives)
    var buckets = {}
    columns.forEach(function (c) {
      buckets[c.key] = []
    })
    initiatives.forEach(function (it) {
      var key = phaseKey(it)
      if (!buckets[key]) {
        buckets[key] = []
        columns.push({ key: key, label: key || 'Unassigned' })
      }
      buckets[key].push(it)
    })

    injectStyle(doc, 'iv-kanban-style', CSS)

    var board = doc.createElement('div')
    board.className = 'iv-kanban'
    columns.forEach(function (c) {
      board.appendChild(renderColumn(doc, ctx, byId, c, buckets[c.key] || []))
    })
    ctx.container.appendChild(board)
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
function phaseKey(initiative) {
  return fieldOf(initiative, 'initiativePhase').trim()
}

function orderedColumns(elements, initiatives) {
  var declared = []
  var program = pick(elements, 'Program')[0]
  if (program)
    fieldOf(program, 'programStages')
      .split(',')
      .forEach(function (s) {
        var t = s.trim()
        if (t) declared.push(t)
      })
  var seen = {},
    order = []
  initiatives.forEach(function (it) {
    var k = phaseKey(it)
    if (k !== '' && !seen[k]) {
      seen[k] = true
      order.push(k)
    }
  })
  var keys = []
  declared.forEach(function (d) {
    if (keys.indexOf(d) < 0) keys.push(d)
  })
  order.forEach(function (k) {
    if (keys.indexOf(k) < 0) keys.push(k)
  })
  if (
    initiatives.some(function (it) {
      return phaseKey(it) === ''
    })
  )
    keys.push('')
  return keys.map(function (k) {
    return { key: k, label: k || 'Unassigned' }
  })
}

function byIdMap(elements) {
  var map = {}
  elements.forEach(function (e) {
    if (e && e.id) map[String(e.id).toLowerCase()] = e
  })
  return map
}

function relationTarget(element, field) {
  var rels = (element && element.relations) || []
  var hit = rels.filter(function (r) {
    return r && r.field === field
  })[0]
  return hit ? String(hit.target || '') : ''
}

function conceptMeta(ctx, name) {
  var s = ctx && ctx.payload && ctx.payload.schema
  var list = s && Array.isArray(s.concepts) ? s.concepts : []
  for (var i = 0; i < list.length; i++) {
    var c = list[i]
    var cn = typeof c === 'string' ? c : c && c.name
    if (cn === name || String(cn || '').toLowerCase() === String(name || '').toLowerCase()) {
      return { name: cn, index: i, color: c && c.color, icon: c && c.icon }
    }
  }
  return { index: 0 }
}

/* ElementMini data: identity + a single meta line. NO fields (that is the whole
   point of the mini — it never becomes a card). */
function toMiniData(element, byId) {
  var owner = byId[relationTarget(element, 'initiativeManagerId').toLowerCase()]
  var meta = [fieldOf(element, 'initiativeType'), owner && owner.name].filter(Boolean).join(' · ')
  return {
    id: element.id,
    name: element.name || element.id || '',
    conceptId: element.concept,
    meta: meta || undefined,
    markers: toMarkers(element),
    // Full fields are carried so the hover/info preview can render the real
    // ElementCard (the mini itself never shows them).
    fields: toFieldArray(element),
  }
}

function toFieldArray(element) {
  var out = []
  if (element && element.fields && typeof element.fields === 'object') {
    Object.keys(element.fields).forEach(function (k) {
      out.push({ name: k, value: element.fields[k] })
    })
  }
  return out
}

function toMarkers(element) {
  if (
    element &&
    element.markers &&
    typeof element.markers === 'object' &&
    !Array.isArray(element.markers)
  ) {
    return Object.keys(element.markers).map(function (k) {
      var v = element.markers[k]
      return { id: k, label: k, kind: 'marker', value: Array.isArray(v) ? v.join(', ') : v }
    })
  }
  return Array.isArray(element && element.markers) ? element.markers : null
}

/* ---- render ---- */

function renderColumn(doc, ctx, byId, column, items) {
  var col = doc.createElement('section')
  col.className = 'iv-col'

  var head = doc.createElement('div')
  head.className = 'iv-col-head'
  var title = doc.createElement('span')
  title.className = 'iv-col-title'
  title.textContent = column.label
  var count = doc.createElement('span')
  count.className = 'iv-col-count'
  count.textContent = String(items.length)
  head.appendChild(title)
  head.appendChild(count)
  col.appendChild(head)

  var body = doc.createElement('div')
  body.className = 'iv-col-body'
  if (!items.length) {
    var none = doc.createElement('span')
    none.className = 'iv-col-empty'
    none.textContent = '—'
    body.appendChild(none)
  }
  items.forEach(function (it) {
    body.appendChild(renderItem(doc, ctx, byId, it))
  })
  col.appendChild(body)
  return col
}

function renderItem(doc, ctx, byId, initiative) {
  var ui = ctx.ui
  if (ui && typeof ui.ElementMini === 'function') {
    return ui.ElementMini(toMiniData(initiative, byId), {
      doc: doc,
      concept: conceptMeta(ctx, initiative.concept),
      byId: byId,
      preview: true,
      domId: 'iv-k-' + String(initiative.id || ''),
    })
  }
  // Fallback if the kit predates ElementMini.
  var fallback = doc.createElement('div')
  fallback.className = 'iv-mini-fallback'
  fallback.textContent = initiative.name || '(initiative)'
  return fallback
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
  '.iv-kanban{display:flex;gap:1rem;align-items:flex-start;overflow-x:auto;padding:.25rem 0 1rem}',
  '.iv-col{flex:0 0 17rem;min-width:0;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:10px;display:flex;flex-direction:column;max-height:72vh}',
  '.iv-col-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;padding:.6rem .75rem;border-bottom:1px solid var(--innfo-border)}',
  '.iv-col-title{font-weight:600;color:var(--innfo-text);font-size:.85rem}',
  '.iv-col-count{background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:999px;padding:0 .5rem;font-size:.72rem;color:var(--innfo-muted)}',
  '.iv-col-body{display:flex;flex-direction:column;gap:.4rem;padding:.6rem;overflow-y:auto;min-width:0}',
  '.iv-col-empty{color:var(--innfo-muted);text-align:center;padding:.5rem;font-size:.8rem}',
  '.iv-mini-fallback{background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:8px;padding:.4rem .5rem;font-size:.8rem}',
].join('\n')
