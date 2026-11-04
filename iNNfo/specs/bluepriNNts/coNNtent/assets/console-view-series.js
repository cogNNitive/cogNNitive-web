/* coNNtent/assets/console-view-series.js — the Series view (change
   2026-11-02-video-script-v1, decisions D10 / A12 / A13).

   It lists the Series' episodes grouped by state, shows each episode's real cost from
   the ledger and its stage timings side by side across machine fingerprints, and flags
   a stale price without dropping the row.

   Everything numeric comes from `ctx.viewData`, collected at export time from the JSONL
   facts. The view computes nothing: it groups and formats. */
registerView({
  title: 'Series',
  icon: 'layers',
  order: 20,
  kind: 'readonly',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var model = ctx.payload.model || {}
    var elements = Array.isArray(model.elements) ? model.elements : []
    var facts = (ctx.viewData && ctx.viewData.episodes) || {}

    function el(tag, className, text) {
      var node = doc.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }

    var root = el('div')
    root.setAttribute('data-nn-series', '')
    ctx.container.appendChild(root)

    var episodes = elements.filter(function (e) {
      return e && e.concept === 'Video'
    })

    if (episodes.length === 0) {
      root.appendChild(el('p', 'empty-state', 'No episodes in this Series yet.'))
      return {}
    }

    // Group by state, in a fixed order: what shipped first, what is still moving after.
    var ORDER = ['produced', 'approved', 'draft', 'idea', 'published', 'archived']
    var groups = {}
    episodes.forEach(function (episode) {
      var state = String((episode.fields && episode.fields.status) || 'idea')
      if (!groups[state]) groups[state] = []
      groups[state].push(episode)
    })
    var states = Object.keys(groups).sort(function (a, b) {
      var ia = ORDER.indexOf(a)
      var ib = ORDER.indexOf(b)
      return (ia < 0 ? ORDER.length : ia) - (ib < 0 ? ORDER.length : ib)
    })

    var anyFacts = false
    states.forEach(function (state) {
      var group = el('section', 'nn-state-group')
      group.setAttribute('data-nn-state-group', state)
      var head = el('h3')
      head.appendChild(el('span', 'nn-badge', state))
      head.appendChild(el('span', 'nn-count', ' ' + groups[state].length))
      group.appendChild(head)

      groups[state].forEach(function (episode) {
        var slug = (episode.fields && episode.fields.slug) || episode.id
        var episodeFacts = facts[slug] || {}
        var row = el('article', 'nn-episode-row')
        row.setAttribute('data-nn-episode', slug)
        row.appendChild(el('h4', null, episode.name || slug))

        if (Number.isFinite(Number(episodeFacts.realUsd))) {
          anyFacts = true
          row.appendChild(el('p', 'nn-episode-cost', 'spent $' + Number(episodeFacts.realUsd).toFixed(4)))
        }

        // Timings: one cell per (stage, fingerprint) so two machines sit side by side.
        ;(episodeFacts.timings || []).forEach(function (timing) {
          anyFacts = true
          var cell = el('span', 'nn-timing')
          cell.setAttribute('data-nn-timing', timing.stage)
          cell.textContent =
            timing.stage + ' ' + timing.durationMs + ' ms · ' + (timing.fingerprint || 'unknown machine')
          row.appendChild(cell)
        })

        // A stale price is flagged and still counted.
        ;(episodeFacts.staleRows || []).forEach(function (stale) {
          anyFacts = true
          var warn = el('p', 'nn-stale-price')
          warn.setAttribute('data-nn-stale-price', '')
          warn.textContent =
            'Stale price (' +
            stale.priceDate +
            '): ' +
            (stale.model || 'unknown model') +
            ' · $' +
            Number(stale.usd || 0).toFixed(4)
          row.appendChild(warn)
        })

        group.appendChild(row)
      })

      root.appendChild(group)
    })

    if (!anyFacts) {
      var note = el('p', 'empty-state', 'No facts yet: no ledger or timing records for this Series.')
      note.setAttribute('data-nn-series-empty', '')
      root.appendChild(note)
    }

    return {}
  },
})
