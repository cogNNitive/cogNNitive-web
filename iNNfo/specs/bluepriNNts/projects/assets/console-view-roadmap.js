/* projects/assets/console-view-roadmap.js — the Project delivery roadmap,
   registered as a console view (bluepriNNt convention: flat under assets/,
   prefix console-view-). It groups the domaiNN payload's Task elements under
   their Milestone (via the `milestone` relation) and renders one column per
   milestone with each task's status, priority and duration; each element carries
   an edit anchor into the console's shared changeset. */
registerView({
  title: 'Roadmap',
  icon: 'milestone',
  order: 20,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []
    var milestones = elements.filter(function (e) {
      return e && e.concept === 'Milestone'
    })
    var tasks = elements.filter(function (e) {
      return e && e.concept === 'Task'
    })
    if (!milestones.length && !tasks.length) {
      appendEmpty(ctx, 'No project elements in this domain.')
      return
    }
    var byMilestone = {}
    tasks.forEach(function (t) {
      var rel = firstRelation(t, 'milestone')
      var key = rel ? String(rel.target).toLowerCase() : ''
      if (!byMilestone[key]) byMilestone[key] = []
      byMilestone[key].push(t)
    })
    var placed = {}
    var root = doc.createElement('div')
    root.className = 'innfo-roadmap'
    milestones.forEach(function (ms) {
      var key = String(ms.id).toLowerCase()
      placed[key] = true
      root.appendChild(renderMilestone(doc, ctx, ms, byMilestone[key] || []))
    })
    var unassigned = byMilestone[''] || []
    tasks.forEach(function (t) {
      var rel = firstRelation(t, 'milestone')
      var key = rel ? String(rel.target).toLowerCase() : ''
      if (key && !placed[key]) unassigned.push(t)
    })
    if (unassigned.length) root.appendChild(renderMilestone(doc, ctx, { name: 'Unassigned' }, unassigned))
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

function renderMilestone(doc, ctx, milestone, tasks) {
  var column = doc.createElement('section')
  column.className = 'innfo-roadmap-milestone'
  var head = doc.createElement('div')
  head.className = 'innfo-roadmap-head'
  var title = doc.createElement('h3')
  title.textContent = milestone.name || '(milestone)'
  head.appendChild(title)
  if (milestone.fields && milestone.fields.target_date) {
    var date = doc.createElement('span')
    date.className = 'innfo-roadmap-date'
    date.textContent = milestone.fields.target_date
    head.appendChild(date)
  }
  if (milestone.id) head.appendChild(editButton(doc, ctx, milestone.id, 'Edit milestone'))
  column.appendChild(head)
  var list = doc.createElement('div')
  list.className = 'innfo-roadmap-tasks'
  if (!tasks.length) {
    var none = doc.createElement('span')
    none.className = 'innfo-roadmap-empty'
    none.textContent = 'No tasks'
    list.appendChild(none)
  }
  tasks.forEach(function (t) {
    var row = doc.createElement('div')
    row.className = 'innfo-roadmap-task'
    var name = doc.createElement('strong')
    name.textContent = t.name || '(task)'
    row.appendChild(name)
    var meta = doc.createElement('span')
    meta.className = 'innfo-roadmap-meta'
    var f = t.fields || {}
    meta.textContent = [f.status, f.priority, f.duration].filter(Boolean).join(' · ')
    row.appendChild(meta)
    if (t.id) row.appendChild(editButton(doc, ctx, t.id, 'Edit'))
    list.appendChild(row)
  })
  column.appendChild(list)
  return column
}
