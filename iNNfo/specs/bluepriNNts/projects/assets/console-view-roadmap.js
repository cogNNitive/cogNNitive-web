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
    root.className = 'nn-roadmap'
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

function renderMilestone(doc, ctx, milestone, tasks) {
  var column = doc.createElement('section')
  column.className = 'nn-roadmap-milestone'
  var head = doc.createElement('div')
  head.className = 'nn-roadmap-head'
  head.appendChild(elementUnit(doc, ctx, milestone, milestone.name || '(milestone)'))
  if (milestone.fields && milestone.fields.target_date) {
    var date = doc.createElement('span')
    date.className = 'nn-roadmap-date'
    date.textContent = milestone.fields.target_date
    head.appendChild(date)
  }
  column.appendChild(head)
  var list = doc.createElement('div')
  list.className = 'nn-roadmap-tasks'
  if (!tasks.length) {
    var none = doc.createElement('span')
    none.className = 'nn-roadmap-empty'
    none.textContent = 'No tasks'
    list.appendChild(none)
  }
  tasks.forEach(function (t) {
    var row = doc.createElement('div')
    row.className = 'nn-roadmap-task'
    row.appendChild(elementUnit(doc, ctx, t, t.name || '(task)'))
    var meta = doc.createElement('span')
    meta.className = 'nn-roadmap-meta'
    var f = t.fields || {}
    meta.textContent = [f.status, f.priority, f.duration].filter(Boolean).join(' · ')
    row.appendChild(meta)
    list.appendChild(row)
  })
  column.appendChild(list)
  return column
}
