// Built-in "Changes" view shipped by the `changes` bluepriNNt. Lists the domain's
// changesets (proposed first) and their change blocks. Read-only: it never proposes
// drafts, so it carries no draft store.
registerView({
  title: 'Changes',
  icon: 'git-commit',
  order: 90,
  kind: 'readonly',
  mount(ctx) {
    const doc = ctx.doc
    const model = ctx.payload && ctx.payload.model ? ctx.payload.model : {}
    const changes = Array.isArray(model.changes) ? model.changes.slice() : []

    // Proposed changesets first (the S6 review flow points the user at them), then
    // newest first within each group.
    const rank = (status) => (status === 'proposed' ? 0 : 1)
    changes.sort(
      (a, b) =>
        rank(a && a.status) - rank(b && b.status) ||
        String((b && b.path) || '').localeCompare(String((a && a.path) || '')),
    )

    if (changes.length === 0) {
      const empty = doc.createElement('p')
      empty.className = 'innfo-changes-empty'
      empty.textContent = 'No changesets in this domain.'
      ctx.container.appendChild(empty)
      return
    }

    changes.forEach((cs) => {
      const card = doc.createElement('div')
      card.className = 'innfo-changes-changeset'
      const heading = doc.createElement('h3')
      heading.textContent = (cs.title || cs.path) + (cs.status ? ' — ' + cs.status : '')
      card.appendChild(heading)
      const list = doc.createElement('ul')
      const items = Array.isArray(cs.changes) ? cs.changes : []
      items.forEach((c) => {
        const li = doc.createElement('li')
        let text = (c.op || '') + ' ' + (c.target || '')
        if (c.notes) text += ' — ' + c.notes
        li.textContent = text
        list.appendChild(li)
      })
      card.appendChild(list)
      ctx.container.appendChild(card)
    })
  },
})
