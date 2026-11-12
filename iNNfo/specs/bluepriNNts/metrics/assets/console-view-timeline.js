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
    var matrices = (ctx.payload && ctx.payload.model && ctx.payload.model.matrices) || []
    var projections = deriveProjections(elements, matrices)
    if (!projections.length) {
      var empty = doc.createElement('p')
      empty.className = 'empty-state'
      empty.textContent = 'No timeline projection in this domain.'
      ctx.container.appendChild(empty)
      return
    }
    if (projections.length > 1) ctx.container.appendChild(variantExportBar(doc, projections))
    projections.forEach(function (p) {
      var section = doc.createElement('section')
      section.className = 'nn-timeline-view'
      if (projections.length > 1) {
        var heading = doc.createElement('h3')
        heading.className = 'nn-timeline-title'
        heading.textContent = p.title || ''
        section.appendChild(heading)
        var summary = doc.createElement('p')
        summary.className = 'nn-timeline-summary'
        summary.textContent = seriesSummary(p, projections)
        section.appendChild(summary)
      }
      ctx.container.appendChild(section)
      var meta = { months: p.months }
      if (p.startYear) meta.startYear = p.startYear
      if (p.startMonth) meta.startMonth = p.startMonth
      nnConsole.renderTimelineGrid(section, { rows: p.rows }, meta)
    })
  },
})

/* The single export that puts every variant in one file, offered only when the
   model really has more than one. */
function variantExportBar(doc, projections) {
  var bar = doc.createElement('div')
  bar.className = 'nn-timeline-actions'
  var button = doc.createElement('button')
  button.setAttribute('type', 'button')
  button.className = 'nn-btn-csv'
  button.textContent = 'Download all variants CSV'
  button.addEventListener('click', function () {
    downloadCsv(doc, variantsCsv(projections), 'timeline_variants.csv')
  })
  bar.appendChild(button)
  return bar
}

/* One comparison card's text: what this variant is, how far it runs, how many
   rows it carries, and which rows no other variant carries. */
function seriesSummary(projection, projections) {
  var parts = []
  if (projection.scenarioType) parts.push(projection.scenarioType)
  parts.push(projection.months + (projection.months === 1 ? ' month' : ' months'))
  parts.push(projection.rows.length + (projection.rows.length === 1 ? ' row' : ' rows'))
  var exclusive = exclusiveRows(projection, projections)
  if (exclusive.length) parts.push('exclusive: ' + exclusive.join(', '))
  return parts.join(' · ')
}

/* Rows this variant carries and no other variant does. */
function exclusiveRows(projection, projections) {
  var elsewhere = {}
  projections.forEach(function (other) {
    if (other === projection) return
    other.rows.forEach(function (r) {
      elsewhere[String((r && r.label) || '').toLowerCase()] = true
    })
  })
  return projection.rows
    .filter(function (r) {
      return r && r.label && !elsewhere[String(r.label).toLowerCase()]
    })
    .map(function (r) {
      return r.label
    })
}

/* Every variant in one CSV: one row per variant and metric, carrying the model
   inputs the view owns (horizon, type, unit, base value, growth rule). */
function variantsCsv(projections) {
  var header = ['Scenario', 'Scenario Type', 'Months', 'Start Year', 'Start Month', 'Group', 'Metric', 'Type', 'Unit', 'Base Value', 'Growth Rule']
  var lines = [header.map(csvCell).join(',')]
  projections.forEach(function (p) {
    p.rows.forEach(function (r) {
      var g = r.growth || {}
      lines.push(
        [
          p.scenarioName || p.title || '',
          p.scenarioType || '',
          p.months,
          p.startYear == null ? '' : p.startYear,
          p.startMonth == null ? '' : p.startMonth,
          r.grp || '',
          r.label || r.id || '',
          r.metricType || '',
          r.metricUnit || '',
          r.base == null ? '' : r.base,
          (g.mode || 'fixed') + (g.factor ? ' (' + g.factor + ')' : ''),
        ]
          .map(csvCell)
          .join(','),
      )
    })
  })
  return lines.join('\r\n')
}

function csvCell(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'
}

function downloadCsv(doc, text, fileName) {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !doc) return
  var blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  var url = URL.createObjectURL(blob)
  var anchor = doc.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  if (typeof URL.revokeObjectURL === 'function') {
    setTimeout(function () {
      URL.revokeObjectURL(url)
    }, 1000)
  }
}

/* Groups the domaiNN's elements by model, then derives one series per Scenario
   of that model: the scenario's own horizon and the metric/variable rows its
   `scenario-metrics` cells include. A model without a Scenario horizon has no
   projection; a scenario the matrix does not cover keeps every row, so the grid
   is never narrower than the model by accident. */
function deriveProjections(elements, matrices) {
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
  var includes = scenarioIncludes(matrices)
  var out = []
  groups.forEach(function (g) {
    var series = []
    g.elements.forEach(function (e) {
      if (!e || e.concept !== 'Scenario') return
      var projection = deriveProjection(g.elements, e, includes)
      if (projection) series.push(projection)
    })
    if (!series.length) return
    var many = series.length > 1
    series.forEach(function (s) {
      out.push({
        title: many && g.title ? g.title + ' — ' + s.title : s.title || g.title,
        scenarioName: s.title,
        scenarioType: s.scenarioType,
        rows: s.rows,
        months: s.months,
        startYear: s.startYear,
        startMonth: s.startMonth,
      })
    })
  })
  return out
}

/* Index of the rows each scenario includes, read from every `scenario-metrics`
   matrix in the payload: row = scenario name, column = metric name, cell value
   `Includes`. Matrices of any other axis pair never filter a timeline. */
function scenarioIncludes(matrices) {
  var index = {}
  if (!Array.isArray(matrices)) return index
  matrices.forEach(function (m) {
    if (!m) return
    if (String(m.source || '').toLowerCase() !== 'scenario') return
    if (String(m.target || '').toLowerCase() !== 'metrics') return
    ;(m.rows || []).forEach(function (row) {
      var cells = (m.cells && m.cells[row]) || {}
      var included = []
      ;(m.cols || []).forEach(function (col) {
        if (String(cells[col] == null ? '' : cells[col]).trim().toLowerCase() === 'includes') included.push(col)
      })
      if (included.length) index[String(row).toLowerCase()] = included
    })
  })
  return index
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  var text = String(value == null ? '' : value).trim()
  if (text === '') return null
  var n = Number(text)
  return Number.isFinite(n) ? n : null
}

/* One series: the scenario's horizon plus the rows it includes. Returns null
   when the scenario declares no horizon, or when the model has no rows. */
function deriveProjection(elements, scenario, includes) {
  if (!Array.isArray(elements)) return null
  var f = (scenario && scenario.fields) || {}
  var months = finiteNumber(f.scenarioMonths)
  if (months == null) return null

  var rows = metricRows(elements)
  var include = includes[String((scenario && scenario.name) || '').toLowerCase()]
  if (include) {
    var wanted = {}
    include.forEach(function (name) {
      wanted[String(name).toLowerCase()] = true
    })
    var kept = rows.filter(function (r) {
      return r && r.label && wanted[String(r.label).toLowerCase()]
    })
    if (kept.length) rows = kept
  }
  if (rows.length === 0) return null

  return {
    title: (scenario && scenario.name) || '',
    scenarioType: typeof f.scenarioType === 'string' ? f.scenarioType.trim() : '',
    rows: rows,
    months: months,
    startYear: finiteNumber(f.startYear || f.scenarioStartYear),
    startMonth: finiteNumber(f.startMonth || f.scenarioStartMonth),
  }
}

/* The metric/variable rows of one model, with their evolution rule resolved
   through the `evolution` relation. */
function metricRows(elements) {
  var byId = {}
  elements.forEach(function (e) {
    if (e && e.id) byId[String(e.id).toLowerCase()] = e
  })

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
  return rows
}
