/* metrics/assets/console-view-timeline.js — the Metrics Timeline, registered as a
   console view (bluepriNNt convention: flat under assets/, prefix console-view-).
   It reads the timeline projection the exporter derived into meta.models[] and
   renders it through the shared runtime; a row's edit action opens the console's
   one edit modal, so the proposed change lands in the single changeset (D8/D13). */
registerView({
  title: 'Timeline',
  icon: 'timeline',
  order: 10,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var models = Array.isArray(ctx.payload.models) ? ctx.payload.models : []
    var projections = models.filter(function (m) {
      return m && m.projection && Array.isArray(m.projection.rows) && m.projection.rows.length > 0
    })
    if (!projections.length) {
      var empty = doc.createElement('p')
      empty.className = 'empty-state'
      empty.textContent = 'No timeline projection in this domain.'
      ctx.container.appendChild(empty)
      return
    }
    projections.forEach(function (m) {
      var section = doc.createElement('section')
      section.className = 'innfo-timeline-view'
      if (projections.length > 1) {
        var heading = doc.createElement('h3')
        heading.className = 'innfo-timeline-title'
        heading.textContent = m.title || ''
        section.appendChild(heading)
      }
      ctx.container.appendChild(section)
      InnfoConsole.renderTimelineGrid(
        section,
        { rows: m.projection.rows },
        { months: m.projection.months },
        {
          onEditRow: function (elementId) {
            ctx.modal.edit({ elementId: elementId })
          },
        },
      )
    })
  },
})
