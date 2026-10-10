/* metrics/assets/console-view-timeline.js — the Metrics Timeline, registered as a
   console view (bluepriNNt convention: flat under assets/, prefix console-view-).
   It derives the timeline projection from the metrics elements carried in the
   shared domaiNN payload (view-derived: the exporter stays generic) and renders
   it through the shared runtime; a row's edit action opens the console's one
   edit modal, so the proposed change lands in the single changeset (D8/D13). */
registerView({
  title: 'Timeline',
  icon: 'timeline',
  order: 10,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var elements = (ctx.payload && ctx.payload.model && ctx.payload.model.elements) || []
    var projections = deriveProjections(elements)
    if (!projections.length) {
      var empty = doc.createElement('p')
      empty.className = 'empty-state'
      empty.textContent = 'No timeline projection in this domain.'
      ctx.container.appendChild(empty)
      return
    }
    projections.forEach(function (p) {
      var section = doc.createElement('section')
      section.className = 'innfo-timeline-view'
      if (projections.length > 1) {
        var heading = doc.createElement('h3')
        heading.className = 'innfo-timeline-title'
        heading.textContent = p.title || ''
        section.appendChild(heading)
      }
      ctx.container.appendChild(section)
      InnfoConsole.renderTimelineGrid(
        section,
        { rows: p.rows },
        { months: p.months },
        {
          onEditRow: function (elementId) {
            ctx.modal.edit({ elementId: elementId })
          },
        },
      )
    })
  },
})

/* Groups the domaiNN's elements by model, then derives one timeline projection
   per metrics model: metric/variable rows plus the forecast horizon taken from
   the widest Scenario. A model without a Scenario horizon has no projection. */
function deriveProjections(elements) {
  if (!Array.isArray(elements)) return []
  var groups = []
  var byModel = {}
  elements.forEach(function (e) {
    if (!e) return
    var key = e.modelId || e.modelTitle || ''
    if (!byModel[key]) {
      byModel[key] = { title: e.modelTitle || '', elements: [] }
      groups.push(byModel[key])
    }
    byModel[key].elements.push(e)
  })
  var out = []
  groups.forEach(function (g) {
    var projection = deriveProjection(g.elements)
    if (projection) out.push({ title: g.title, rows: projection.rows, months: projection.months })
  })
  return out
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  var n = Number(String(value == null ? '' : value).trim())
  return Number.isFinite(n) ? n : null
}

function deriveProjection(elements) {
  if (!Array.isArray(elements)) return null
  var byId = {}
  elements.forEach(function (e) {
    if (e && e.id) byId[String(e.id).toLowerCase()] = e
  })
  var scenarioMonths = []
  elements.forEach(function (e) {
    if (e && e.concept === 'Scenario') {
      var m = finiteNumber(e.fields && e.fields.scenarioMonths)
      if (m != null) scenarioMonths.push(m)
    }
  })
  if (scenarioMonths.length === 0) return null
  var months = Math.max.apply(null, scenarioMonths)

  function growthOf(e) {
    var rel = (e.relations || []).filter(function (r) {
      return r.field === 'evolution'
    })[0]
    var target = rel ? byId[String(rel.target).toLowerCase()] : null
    var type = target && target.fields ? target.fields.evolutionType : null
    var factor = target && target.fields ? finiteNumber(target.fields.evolutionFactor) : null
    return { mode: typeof type === 'string' && type.trim() ? type.trim() : 'fixed', factor: factor != null ? factor : 0 }
  }

  var rows = []
  elements.forEach(function (e) {
    if (!e) return
    var f = e.fields || {}
    if (e.concept === 'Metrics') {
      var raw = typeof f.metricFormula === 'string' ? f.metricFormula.trim() : ''
      var formula = raw && !/^<.*>$/.test(raw) ? raw : ''
      var row = {
        id: e.id,
        label: e.name,
        grp: 'Metrics',
        metricType: typeof f.metricType === 'string' ? f.metricType : '',
        metricUnit: typeof f.metricUnit === 'string' ? f.metricUnit : '',
        growth: growthOf(e),
      }
      if (formula) row.formula = formula
      else row.variable = true
      var base = finiteNumber(f.metricValue)
      if (base != null) row.base = base
      rows.push(row)
    } else if (e.concept === 'Variables') {
      var vrow = {
        id: e.id,
        label: e.name,
        grp: 'Variables',
        variable: true,
        metricType: typeof f.variableType === 'string' ? f.variableType : '',
        metricUnit: typeof f.variableUnit === 'string' ? f.variableUnit : '',
        growth: { mode: 'fixed', factor: 0 },
      }
      var vbase = finiteNumber(f.variableValue)
      if (vbase != null) vrow.base = vbase
      rows.push(vrow)
    }
  })
  if (rows.length === 0) return null
  return { rows: rows, months: months }
}
