/* organization/assets/console-view-org-chart.js — the Organization roster,
   registered as a console view (bluepriNNt convention: flat under assets/,
   prefix console-view-). It groups the domaiNN payload's Person elements under
   their Position (via the `position_ref` relation) and renders one card per
   position, each element carrying an edit anchor into the console's shared
   changeset. */
registerView({
  title: 'Org Chart',
  icon: 'network',
  order: 20,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []
    var positions = elements.filter(function (e) {
      return e && e.concept === 'Position'
    })
    var persons = elements.filter(function (e) {
      return e && e.concept === 'Person'
    })
    if (!positions.length && !persons.length) {
      appendEmpty(ctx, 'No organization elements in this domain.')
      return
    }
    var byPosition = {}
    persons.forEach(function (p) {
      var rel = firstRelation(p, 'position_ref')
      var key = rel ? String(rel.target).toLowerCase() : ''
      if (!byPosition[key]) byPosition[key] = []
      byPosition[key].push(p)
    })
    var placed = {}
    var root = doc.createElement('div')
    root.className = 'innfo-org-chart'
    positions.forEach(function (pos) {
      var key = String(pos.id).toLowerCase()
      placed[key] = true
      root.appendChild(renderPosition(doc, ctx, pos, byPosition[key] || []))
    })
    var unassigned = byPosition[''] || []
    persons.forEach(function (p) {
      var rel = firstRelation(p, 'position_ref')
      var key = rel ? String(rel.target).toLowerCase() : ''
      if (key && !placed[key]) unassigned.push(p)
    })
    if (unassigned.length) root.appendChild(renderPosition(doc, ctx, { name: 'Unassigned' }, unassigned))
    ctx.container.appendChild(root)
  },
})

function firstRelation(element, field) {
  var rels = (element && element.relations) || []
  return rels.filter(function (r) {
    return r.field === field
  })[0]
}

function appendEmpty(ctx, message) {
  var p = ctx.container.ownerDocument.createElement('p')
  p.className = 'empty-state'
  p.textContent = message
  ctx.container.appendChild(p)
}

function unitModel(ctx) {
  var meta = (ctx && ctx.payload && ctx.payload.meta) || {}
  return meta.modelId || meta.model || ''
}

function elementUnit(doc, ctx, record, label) {
  if (ctx && ctx.ui && typeof ctx.ui.Ku === 'function') {
    return ctx.ui.Ku(
      'element',
      {
        model: unitModel(ctx),
        id: record.id || record.slug || label,
        label: String(label || record.name || record.id || ''),
        concept: record.concept,
      },
      { doc: doc },
    )
  }
  var fallback = doc.createElement('span')
  fallback.textContent = String(label || record.name || record.id || '')
  return fallback
}

function renderPosition(doc, ctx, pos, people) {
  var card = doc.createElement('section')
  card.className = 'innfo-org-position'
  var head = doc.createElement('div')
  head.className = 'innfo-org-position-head'
  head.appendChild(elementUnit(doc, ctx, pos, pos.name || '(position)'))
  card.appendChild(head)
  var list = doc.createElement('div')
  list.className = 'innfo-org-people'
  if (!people.length) {
    var none = doc.createElement('span')
    none.className = 'innfo-org-empty'
    none.textContent = 'No one assigned'
    list.appendChild(none)
  }
  people.forEach(function (p) {
    var row = doc.createElement('div')
    row.className = 'innfo-org-person'
    row.appendChild(elementUnit(doc, ctx, p, (p.fields && p.fields.role) || p.name || '(person)'))
    if (p.fields && p.fields.compensation) {
      var comp = doc.createElement('span')
      comp.className = 'innfo-org-comp'
      comp.textContent = p.fields.compensation
      row.appendChild(comp)
    }
    list.appendChild(row)
  })
  card.appendChild(list)
  return card
}
