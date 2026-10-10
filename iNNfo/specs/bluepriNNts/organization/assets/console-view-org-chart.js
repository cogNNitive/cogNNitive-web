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

function editButton(doc, ctx, id, label) {
  var button = doc.createElement('button')
  button.className = 'innfo-edit-anchor'
  button.type = 'button'
  button.title = 'Propose an edit'
  button.textContent = label || 'Edit'
  button.addEventListener('click', function () {
    ctx.modal.edit({ elementId: id })
  })
  return button
}

function renderPosition(doc, ctx, pos, people) {
  var card = doc.createElement('section')
  card.className = 'innfo-org-position'
  var head = doc.createElement('div')
  head.className = 'innfo-org-position-head'
  var title = doc.createElement('h3')
  title.textContent = pos.name || '(position)'
  head.appendChild(title)
  if (pos.id) head.appendChild(editButton(doc, ctx, pos.id, 'Edit position'))
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
    var name = doc.createElement('strong')
    name.textContent = (p.fields && p.fields.role) || p.name || '(person)'
    row.appendChild(name)
    if (p.fields && p.fields.compensation) {
      var comp = doc.createElement('span')
      comp.className = 'innfo-org-comp'
      comp.textContent = p.fields.compensation
      row.appendChild(comp)
    }
    if (p.id) row.appendChild(editButton(doc, ctx, p.id, 'Edit'))
    list.appendChild(row)
  })
  card.appendChild(list)
  return card
}
