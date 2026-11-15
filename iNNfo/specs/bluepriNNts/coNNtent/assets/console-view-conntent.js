/* coNNtent/assets/console-view-conntent.js — the unified coNNtent view (design D-C3;
   capability conntent-domain-console). Pending is home, then Domain, Series and Episode.

   The Episode section is the review surface: a gate strip (each gate with its state and what
   it protects, plus the automatic QA cell that has no controls), one collapsible card per
   scene (still, narration audio, layer pills, inherited source line, narration), and the
   verdict controls. A verdict is a `review_gate` draft in the shared store: it names the
   gate, its outcome and the content hash the payload published — the view never computes a
   hash and never writes the `review::` field.

   Every number, hash and source level comes from `ctx.viewData` (collected at export time by
   console-view-conntent.data.mjs); the view only groups and formats. There is no Deliver
   button and no orphan cleanup.

   Styling: the console design system already shipped with the shell (`nn-episode-head`,
   `nn-scene-card`, `nn-narration`, `nn-params-grid`, `nn-verdict-controls`, `nn-badge`,
   `table`, `empty-state`); only the containers this view owns get a rule in
   `console/nn-ui.css`. */

/* global registerView, setTimeout */
registerView({
  title: 'Pipeline',
  icon: 'play',
  order: 15,
  kind: 'editable',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument
    var data = (ctx.viewData && ctx.viewData.tree) || { series: [] }
    var pending = (ctx.viewData && ctx.viewData.pending) || []
    var fieldDefinitions = (ctx.viewData && ctx.viewData.fieldDefinitions) || {}
    var fieldRefreshers = []
    var fieldModal = null

    // What each gate protects. The strip shows it so a reviewer knows what a click freezes.
    var GATE_INFO = {
      script: { label: 'Script', protects: 'before any spend' },
      preview: { label: 'Preview', protects: 'before avatar spend' },
      budget: { label: 'Budget', protects: 'before any spend' },
      qa: { label: 'Automatic QA', protects: 'always on, no approval' },
    }
    var GATE_ORDER = ['script', 'preview', 'budget']
    // The content a gate reviews, and the hash the payload published for it.
    function hashFor(scene, gate) {
      if (gate === 'preview') return scene.previewHash
      return scene.scriptHash
    }

    function el(tag, className, text) {
      var node = doc.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }

    function section(id, title) {
      var node = el('section', 'nn-conntent-section')
      node.setAttribute('data-nn-section', id)
      node.appendChild(el('h3', null, title))
      return node
    }

    function gateLabel(gate) {
      return gate.scene ? gate.gate + ' · ' + gate.scene : gate.gate
    }

    function badge(text, extra) {
      return el('span', 'nn-badge' + (extra ? ' ' + extra : ''), text)
    }

    function param(label, value, source) {
      var box = el('div', 'nn-param')
      box.appendChild(el('span', 'nn-param-label', label))
      box.appendChild(el('span', 'nn-param-value', value))
      if (source) box.appendChild(el('span', 'nn-src-badge', source))
      return box
    }

    function labelled(title) {
      var box = el('div', 'nn-form-section')
      box.appendChild(el('span', 'nn-section-label', title))
      return box
    }

    // The store already shows its own change toast on every saved draft (review.js,
    // UI.Toast); this view only surfaces failures, with the same component.
    function showMessage(title, body) {
      if (!(ctx.ui && typeof ctx.ui.Toast === 'function')) return
      var box = ctx.ui.Toast({ title: title, body: body }, { doc: doc, onClose: function () {} })
      doc.body.appendChild(box)
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box)
      }, 4000)
    }

    /** Every decision goes through the one shared store; the view keeps no private copy. */
    function propose(change) {
      try {
        if (!ctx.store) throw new Error('review is not enabled in this console')
        ctx.store.propose(change)
        return true
      } catch (err) {
        showMessage('Cannot save', err && err.message ? err.message : String(err))
        return false
      }
    }

    /** A verdict for one scene on one gate, with the hash the payload published. */
    function proposeVerdict(episode, scene, gate, verdict, notes) {
      var hash = hashFor(scene, gate)
      if (!hash) {
        showMessage('No ' + gate + ' hash', scene.slug + ' has no ' + gate + ' hash: regenerate the console')
        return false
      }
      var change = {
        kind: 'verdict',
        elementId: scene.elementId,
        gate: gate,
        verdict: verdict,
        reviewed_hash: hash,
        notes: notes,
      }
      if (gate === 'preview' && scene.planHash) change.plan_hash = scene.planHash
      return propose(change)
    }

    function settingGroup(name) {
      if (/^voice|^language$/.test(name)) return 'Voice & language'
      if (/^avatar|^image|^character$|^pose$|^background$|^frame$|^fit$/.test(name)) return 'Visuals'
      if (/^background_audio|^transition$|^sounds$|^components$|^position$|^placement$|^timing$|animation$|^z_index$/.test(name)) return 'Audio & composition'
      if (/^thumbnail|^output_formats$|^captions$|^caption_model$|^intro$/.test(name)) return 'Publishing'
      if (/^review|^budget$|^status$|^master$|^delivered_version$/.test(name)) return 'Workflow & outputs'
      return 'Content'
    }

    function closeFieldModal() {
      if (!fieldModal) return
      var modal = fieldModal
      fieldModal = null
      if (modal.open && typeof modal.close === 'function') modal.close()
      modal.remove()
    }

    // The registry supplies coverage; the exported schema supplies catalog picklists.
    function renderSettings(subject, concept, episode) {
      var host = el('div', 'nn-pipeline-settings')
      host.setAttribute('data-nn-settings', concept)
      host.setAttribute('data-nn-element-id', subject.elementId || '')
      var definitions = Object.assign({}, fieldDefinitions)
      ;((ctx.payload && ctx.payload.schema && ctx.payload.schema.fields) || []).forEach(function (field) {
        if (field.concept !== concept && field.concept !== '*') return
        definitions[field.name] = Object.assign({}, definitions[field.name], field,
          { concepts: [concept], cascade: !!(definitions[field.name] && definitions[field.name].cascade) })
      })
      definitions.name = { concepts: [concept], type: 'string', description: 'Display name. The stable address stays unchanged.' }
      if (concept !== 'Scene') definitions.description = { concepts: [concept], type: 'markdown', description: 'Element description.' }
      var groups = {}
      Object.keys(definitions).filter(function (name) {
        var concepts = definitions[name].concepts || []
        return concepts.indexOf(concept) !== -1 || concepts.indexOf('*') !== -1
      }).sort(function (a, b) {
        var first = ['kind', 'type', 'title', 'name', 'description', 'presets', 'tags']
        var left = first.indexOf(a), right = first.indexOf(b)
        return (left < 0 ? first.length : left) - (right < 0 ? first.length : right) || a.localeCompare(b)
      }).forEach(function (name) {
        var definition = definitions[name]
        var groupName = settingGroup(name)
        if (!groups[groupName]) {
          var group = el('details', 'nn-conntent-fields')
          group.open = groupName === 'Content'
          group.appendChild(el('summary', null, groupName))
          groups[groupName] = group
          host.appendChild(group)
        }
        var row = el('div', 'nn-pipeline-setting')
        row.setAttribute('data-nn-setting', name)
        var valueBox = el('div')
        row.appendChild(valueBox)
        var records = subject.recordFields || {}
        var effective = subject.fields && subject.fields[name]
        var local = Object.prototype.hasOwnProperty.call(records, name)
        var value = definition.cascade && name !== 'presets' && effective ? effective.value : records[name]
        var source = definition.cascade && name !== 'presets' && effective ? effective.source : local ? concept.toLowerCase() : null
        var engineManaged = name === 'review' || name === 'master' || name === 'delivered_version'
        var options = definition.options || []
        if (name === 'kind') options = episode.sceneKinds || options
        if (name === 'presets') options = episode.availablePresets || options
        var draftValue
        function refresh() {
          var drafts = ctx.store && ctx.store.drafts ? ctx.store.drafts() : []
          var matching = drafts.filter(function (draft) {
            return draft.kind === 'correction' && draft.field === name &&
              (draft.elementId || draft.element_id) === subject.elementId
          })
          var draft = matching[matching.length - 1]
          draftValue = draft ? draft.proposed : value
          valueBox.textContent = ''
          if (ctx.ui && ctx.ui.FieldRow) valueBox.appendChild(ctx.ui.FieldRow({
            name: name, value: draftValue == null ? '' : draftValue, type: definition.type,
            model: episode.knowledgeId, element: subject.slug,
          }, { doc: doc }))
          else valueBox.appendChild(el('span', null, name + ': ' + (draftValue == null ? 'Not set' : String(draftValue))))
          if (engineManaged || subject.editable === false) Array.prototype.forEach.call(valueBox.querySelectorAll('[data-ku-action="edit"]'), function (action) { action.remove() })
          var origin = draft ? 'proposed' : engineManaged ? 'engine' : source || 'unset'
          var originNames = { video: 'Episode', kind: 'Scene Kind', blueprint: 'Blueprint', mixed: 'Mixed origins', unset: 'Not set', engine: 'Engine managed', proposed: 'Proposed · not applied' }
          var originBadge = el('span', 'badge badge-sm nn-source-from', originNames[origin] || origin.charAt(0).toUpperCase() + origin.slice(1))
          originBadge.setAttribute('data-nn-source-from', origin)
          originBadge.title = draft ? 'Pending proposal' : source === concept.toLowerCase() ? 'Assigned on this ' + concept.toLowerCase() : source ? 'Value origin: ' + originBadge.textContent : 'No assigned value'
          valueBox.appendChild(originBadge)
          var helpText = definition.description || ''
          if (name === 'presets') helpText += ' Only presets assigned here. Inherited presets still apply.'
          if (!draft && effective && effective.origins) helpText += ' Origins: ' + Object.keys(effective.origins).map(function (key) { return key + ': ' + effective.origins[key] }).join(' · ')
          if (helpText) {
            var help = el('details', 'nn-setting-help')
            var helpToggle = el('summary', null, 'ⓘ')
            helpToggle.setAttribute('aria-label', 'Information about ' + name)
            helpToggle.title = 'Information about ' + name
            help.appendChild(helpToggle)
            help.appendChild(el('p', 'nn-setting-help-text', helpText))
            valueBox.appendChild(help)
          }
          if (name === 'components') renderComponentSlotButtons(valueBox, { value: Array.isArray(draftValue) ? draftValue.join(',') : draftValue }, subject, episode)
        }
        fieldRefreshers.push(refresh)
        refresh()
        if (!engineManaged && subject.editable !== false && ctx.ui && ctx.ui.EditModal) {
          var edit = button('Edit ' + name, function () {
            closeFieldModal()
            fieldModal = ctx.ui.EditModal({
              title: 'Edit ' + (subject.name || subject.title || subject.slug) + ' → ' + name,
              fieldName: name, type: options.length && !definition.multiple ? 'select' : definition.type,
              multiple: !!definition.multiple, options: options,
              value: draftValue == null ? (definition.multiple ? [] : '') : draftValue,
              startTab: 'edit', modelId: episode.knowledgeId,
            }, { doc: doc, onSave: function (result) {
              propose(result.isComment ? { kind: 'comment', elementId: subject.elementId, field: name, comment: result.comment } :
                { kind: 'correction', elementId: subject.elementId, field: name, proposed: result.proposed, comment: result.comment })
            }, onCancel: closeFieldModal })
            fieldModal.setAttribute('data-nn-setting-editor', name)
            var opened = fieldModal
            opened.addEventListener('close', function () {
              if (fieldModal === opened) fieldModal = null
              opened.remove()
            }, { once: true })
            doc.body.appendChild(fieldModal)
            if (typeof fieldModal.showModal === 'function') fieldModal.showModal()
            else fieldModal.setAttribute('open', '')
          })
          edit.setAttribute('data-nn-edit-setting', name)
          row.appendChild(edit)
        }
        groups[groupName].appendChild(row)
      })
      ;['Content', 'Voice & language', 'Visuals', 'Audio & composition', 'Publishing', 'Workflow & outputs'].forEach(function (name) {
        if (groups[name]) host.appendChild(groups[name])
      })
      host.appendChild(el('p', 'text-xs text-base-content/60', 'Edits are shared changeset proposals. Effective values and media refresh after applying changes and regenerating the console.'))
      return host
    }

    var episodeCards = []
    var root = el('div', 'nn-conntent-view nn-pipeline-dashboard')
    ctx.container.appendChild(root)

    /** The console's lightbox: the full still or the playable video of one scene. */
    function openLightbox(scene) {
      var overlay = el('div', 'nn-lightbox is-open')
      overlay.setAttribute('data-nn-lightbox', scene.slug)
      var card = el('div', 'nn-lightbox-card')
      var close = el('button', 'nn-lightbox-close', '×')
      close.type = 'button'
      close.setAttribute('data-nn-lightbox-close', '')
      close.addEventListener('click', function () {
        remove()
      })
      function remove() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
        doc.removeEventListener('keydown', onKey)
      }
      function onKey(event) {
        if (event && event.key === 'Escape') remove()
      }
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) remove()
      })
      doc.addEventListener('keydown', onKey)
      card.appendChild(close)
      card.appendChild(el('h3', null, scene.kind || scene.slug))
      if (scene.video) {
        var fullPlayer = doc.createElement('video')
        fullPlayer.className = 'nn-lightbox-shot'
        fullPlayer.src = scene.video
        if (scene.still) fullPlayer.poster = scene.still
        fullPlayer.controls = true
        fullPlayer.setAttribute('playsinline', '')
        card.appendChild(fullPlayer)
      } else if (scene.still) {
        var shot = doc.createElement('img')
        shot.className = 'nn-lightbox-shot'
        shot.src = scene.still
        shot.alt = ''
        card.appendChild(shot)
      }
      if (scene.narration) card.appendChild(el('p', 'nn-lightbox-storyboard', scene.narration))
      overlay.appendChild(card)
      doc.body.appendChild(overlay)
    }

    function parseComponentsMap(str) {
      var map = {}
      if (typeof str === 'string') {
        str.split(',').forEach(function (pair) {
          var eq = pair.indexOf('=')
          if (eq !== -1) {
            var k = pair.slice(0, eq).trim()
            var v = pair.slice(eq + 1).trim()
            if (k) map[k] = v
          }
        })
      }
      return map
    }

    function renderComponentSlotButtons(row, entry, scene, episode) {
      var slots = parseComponentsMap(entry.value)
      var slotKeys = Object.keys(slots)
      if (slotKeys.length === 0) return
      var btnGroup = el('div', 'nn-component-slot-btns flex gap-1 mt-1')
      slotKeys.forEach(function (slot) {
        var compName = slots[slot]
        var btn = el('button', 'nn-component-slot-btn btn btn-xs btn-outline', slot + ': ' + compName)
        btn.type = 'button'
        btn.setAttribute('data-nn-picker', 'components')
        btn.setAttribute('data-nn-slot', slot)
        btn.setAttribute('data-nn-component-slot', slot)
        btn.addEventListener('click', function (e) {
          e.preventDefault()
          openComponentPicker(slot, entry, scene, episode)
        })
        btnGroup.appendChild(btn)
      })
      row.appendChild(btnGroup)
    }

    function openComponentPicker(slot, entry, scene, episode) {
      var existing = doc.querySelector('[data-nn-component-picker]')
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing)

      var dialog = el('div', 'nn-component-picker modal modal-open')
      dialog.setAttribute('data-nn-component-picker', '')

      var modalBox = el('div', 'modal-box max-w-2xl')
      var header = el('div', 'flex justify-between items-center mb-4')
      header.appendChild(el('h3', 'font-bold text-lg', 'Pick component for slot: ' + slot))
      var closeBtn = el('button', 'btn btn-sm btn-circle btn-ghost', '✕')
      closeBtn.type = 'button'
      closeBtn.addEventListener('click', close)
      header.appendChild(closeBtn)
      modalBox.appendChild(header)

      function close() {
        doc.removeEventListener('keydown', onKey)
        if (dialog.parentNode) dialog.parentNode.removeChild(dialog)
      }
      function onKey(e) {
        if (e && e.key === 'Escape') {
          close()
        }
      }
      doc.addEventListener('keydown', onKey)

      var allComponents = (episode && episode.components) || []
      var matching = allComponents.filter(function (c) {
        return c.slot === slot
      })

      if (matching.length === 0) {
        modalBox.appendChild(el('p', 'empty-state text-sm opacity-70', 'No components available for slot "' + slot + '".'))
      } else {
        var list = el('div', 'nn-component-list flex flex-col gap-3 max-h-96 overflow-y-auto')
        matching.forEach(function (c) {
          var item = el('div', 'nn-component-item border p-3 rounded-lg flex flex-col gap-2')
          item.setAttribute('data-nn-component-item', '')
          item.setAttribute('data-nn-component', c.name)
          item.setAttribute('data-nn-level', c.level || 'domain')
          if (c.shadowed) {
            item.setAttribute('data-nn-shadowed', '')
            item.classList.add('opacity-50', 'bg-base-200')
          }

          var row1 = el('div', 'flex justify-between items-center')
          var titleGroup = el('div', 'flex items-center gap-2')
          titleGroup.appendChild(el('span', 'font-semibold', c.name))
          titleGroup.appendChild(badge(c.level || 'domain', 'badge-sm'))
          if (c.shadowed) {
            titleGroup.appendChild(badge('shadowed', 'badge-sm badge-warning'))
          }
          row1.appendChild(titleGroup)

          if (!c.shadowed) {
            var selectBtn = el('button', 'btn btn-xs btn-primary', 'Select')
            selectBtn.type = 'button'
            selectBtn.setAttribute('data-nn-select-component', '')
            selectBtn.addEventListener('click', function () {
              var slots = parseComponentsMap(entry.value)
              slots[slot] = c.name
              var proposed = Object.keys(slots).map(function (k) { return k + '=' + slots[k] })
              propose({
                kind: 'correction',
                elementId: (scene && scene.elementId) || (episode && episode.elementId),
                field: 'components',
                proposed: proposed,
              })
              close()
            })
            row1.appendChild(selectBtn)
          }
          item.appendChild(row1)

          var metaLine = el('div', 'text-xs text-base-content/70 flex gap-2 flex-wrap')
          metaLine.appendChild(el('span', null, 'Source: ' + c.source))
          metaLine.appendChild(el('span', null, 'Duration: ' + (c.duration ? c.duration + 's' : 'scene')))
          if (c.aspect && c.aspect.length) metaLine.appendChild(el('span', null, 'Aspect: ' + c.aspect.join(', ')))
          if (c.tokens && c.tokens.length) metaLine.appendChild(el('span', null, 'Tokens: ' + c.tokens.join(', ')))
          item.appendChild(metaLine)

          if (c.preview) {
            var video = doc.createElement('video')
            video.src = c.preview
            video.preload = 'none'
            video.controls = true
            video.className = 'w-full max-h-40 rounded bg-black'
            item.appendChild(video)
          } else {
            var placeholder = el('div', 'nn-preview-placeholder text-xs p-2 bg-base-200 rounded text-center opacity-60', 'No preview available')
            item.appendChild(placeholder)
          }

          list.appendChild(item)
        })
        modalBox.appendChild(list)
      }

      dialog.appendChild(modalBox)
      doc.body.appendChild(dialog)
    }

    /** A draft is a proposal, not an applied gate verdict. */
    function markApproved(episode, sceneSlug, gate) {
      var episodeCard = episodeCards.filter(function (item) { return item.episode === episode })[0]
      var card = episodeCard && Array.prototype.find.call(episodeCard.node.querySelectorAll('[data-nn-scene]'), function (node) { return node.getAttribute('data-nn-scene') === sceneSlug })
      if (!card) return
      var pill = card.querySelector('[data-nn-verdict-pill]')
      if (pill) {
        pill.textContent = 'Approval proposed'
        pill.setAttribute('data-nn-verdict-pill', 'proposed')
      }
      var box = card.querySelector('[data-nn-subsection="verdict"]')
      if (!box) return
      box.textContent = ''
      box.appendChild(el('p', 'nn-verdict-approved', 'Approval proposed for ' + gate + '. Apply the changeset to confirm it.'))
    }

    // 1. Pending inbox — home.
    var pendingSection = section('pending', 'Pending')
    pendingSection.setAttribute('data-nn-home', '')
    if (pending.length === 0) {
      pendingSection.appendChild(el('p', 'empty-state', 'Nothing waits for review.'))
    } else {
      var list = el('ul', 'nn-pending-list')
      pending.forEach(function (gate) {
        var item = el('li', 'nn-pending-item')
        item.setAttribute('data-nn-gate', gate.gate)
        item.setAttribute('data-nn-state', gate.state)
        var head = el('div', 'nn-pending-head')
        head.appendChild(el('strong', null, gate.episode + ' · ' + gateLabel(gate)))
        head.appendChild(badge(gate.state, 'nn-gate-state'))
        item.appendChild(head)
        if (gate.notes) item.appendChild(el('span', 'nn-gate-notes', gate.notes))
        if (gate.cause && gate.cause.detail) {
          item.appendChild(el('span', 'nn-gate-cause', gate.cause.kind + ': ' + gate.cause.detail))
        }
        list.appendChild(item)
      })
      pendingSection.appendChild(list)
    }
    root.appendChild(pendingSection)

    // 2. Domain.
    var domain = section('domain', 'Domain')
    var episodeCount = data.series.reduce(function (sum, s) {
      return sum + s.episodes.length
    }, 0)
    var meta = (ctx.payload && ctx.payload.model && ctx.payload.model.meta) || {}
    var config = el('div', 'nn-params-grid')
    config.appendChild(param('Domain', String((meta.domain && meta.domain.title) || meta.model || '—')))
    config.appendChild(param('Domain id', String(meta.domainId || '—')))
    config.appendChild(param('Series', String(data.series.length)))
    config.appendChild(param('Episodes', String(episodeCount)))
    domain.appendChild(config)
    var catalog = labelled('Catalog and voices')
    catalog.appendChild(el('p', 'empty-state', 'Catalog prices and registered voices are in the Catalog tab.'))
    domain.appendChild(catalog)
    root.appendChild(domain)

    // 3. Series.
    var seriesSection = section('series', 'Series')
    data.series.forEach(function (series) {
      var card = el('article', 'nn-series-card nn-scene-card')
      card.setAttribute('data-nn-series', series.slug)
      var head = el('div', 'nn-episode-head')
      head.appendChild(el('h2', null, series.title))
      head.appendChild(badge(series.episodes.length + ' episode' + (series.episodes.length === 1 ? '' : 's')))
      card.appendChild(head)
      var board = el('ul', 'nn-series-board')
      series.episodes.forEach(function (episode) {
        var row = el('li', 'nn-series-episode')
        row.setAttribute('data-nn-episode', episode.slug)
        row.appendChild(el('span', 'nn-episode-title', episode.title))
        row.appendChild(badge(episode.status || 'idea', 'nn-episode-status'))
        board.appendChild(row)
      })
      card.appendChild(board)
      seriesSection.appendChild(card)
    })
    if (data.series.length === 0) seriesSection.appendChild(el('p', 'empty-state', 'No series yet.'))
    root.appendChild(seriesSection)

    // 4. Episode.
    var episodeSection = section('episode', 'Episode')
    data.series.forEach(function (series) {
      series.episodes.forEach(function (episode) {
        var card = el('article', 'nn-episode-card nn-scene-card')
        card.setAttribute('data-nn-episode-config', episode.slug)

        var head = el('div', 'nn-episode-head')
        head.appendChild(el('h2', null, episode.title + ' (' + episode.slug + ')'))
        head.appendChild(badge(episode.status || 'idea'))
        if (episode.language) head.appendChild(badge(episode.language))
        if (episode.planHash) head.appendChild(el('span', 'nn-episode-cost', 'plan ' + episode.planHash.slice(0, 8)))
        // A translation whose original moved on: display only, no gate opens.
        if (episode.staleScenes && episode.staleScenes.length > 0) {
          card.setAttribute('data-nn-stale', '')
          head.appendChild(badge('stale · ' + episode.staleScenes.join(', '), 'nn-stale-badge'))
        }
        card.appendChild(head)

        var body = el('div', 'nn-conntent-body')

        // ── Review: the gate strip, then the scene cards ────────────────────────────
        var review = labelled('Review')
        review.setAttribute('data-nn-subsection', 'review')
        var strip = el('div', 'nn-gate-strip')
        var gates = (episode.reviewGates || []).slice()
        var hasBudget = (episode.gates || []).some(function (g) {
          return g.gate === 'budget'
        })
        if (hasBudget && gates.indexOf('budget') === -1) gates.push('budget')
        gates.sort(function (a, b) {
          return GATE_ORDER.indexOf(a) - GATE_ORDER.indexOf(b)
        })
        var currentGate = null
        gates.forEach(function (gate) {
          var states = (episode.gates || []).filter(function (g) {
            return g.gate === gate
          })
          var approvedAll = states.length > 0 && states.every(function (g) {
            return g.state === 'approved'
          })
          var approvedCount = states.filter(function (g) { return g.state === 'approved' }).length
          var state = approvedAll ? 'approved' : states.some(function (g) { return g.state === 'needs-change' }) ? 'needs-change' : 'open'
          if (!approvedAll && !currentGate) currentGate = gate
          var cell = el('div', 'nn-gate-cell')
          cell.setAttribute('data-nn-gate-cell', gate)
          cell.setAttribute('data-nn-gate-cell-state', state)
          cell.appendChild(el('strong', null, (GATE_INFO[gate] || {}).label || gate))
          var stateBadge = badge(states.length ? approvedCount + ' / ' + states.length + ' approved' : state, 'nn-gate-state')
          stateBadge.setAttribute('data-nn-gate-state', state)
          cell.appendChild(stateBadge)
          cell.appendChild(el('span', 'nn-gate-protects', (GATE_INFO[gate] || {}).protects || ''))
          strip.appendChild(cell)
        })
        // Automatic QA is always on and is never a human decision: a cell, no controls.
        var qaCell = el('div', 'nn-gate-cell')
        qaCell.setAttribute('data-nn-gate-cell', 'qa')
        qaCell.appendChild(el('strong', null, GATE_INFO.qa.label))
        qaCell.appendChild(el('span', 'nn-gate-protects', GATE_INFO.qa.protects))
        strip.appendChild(qaCell)
        review.appendChild(strip)

        if (gates.length === 0) {
          review.appendChild(el('p', 'empty-state', 'Autopilot: no gate waits on a person.'))
        } else if (currentGate) {
          var openScenes = (episode.scenes || []).filter(function (scene) {
            var g = (scene.gates || []).filter(function (x) {
              return x.gate === currentGate
            })[0]
            return !g || g.state !== 'approved'
          })
          var actions = el('div', 'nn-gate-actions')
          var info = el('p', 'nn-gate-hint')
          info.textContent =
            currentGate === 'script'
              ? 'Approving freezes the content hash. Editing a scene later re-opens the gate for that scene only.'
              : currentGate === 'preview'
                ? 'Approving the preview also approves the planned spend of each approved scene.'
                : 'Approving the budget authorises the episode plan.'
          actions.appendChild(info)
          if (openScenes.length > 0) {
            var approveAll = el('button', 'nn-btn nn-approve-gate', 'Approve ' + currentGate + ' for ' + openScenes.length + ' scene' + (openScenes.length === 1 ? '' : 's'))
            approveAll.type = 'button'
            approveAll.setAttribute('data-nn-approve-gate', currentGate)
            approveAll.addEventListener('click', function () {
              openScenes.forEach(function (scene) {
                if (proposeVerdict(episode, scene, currentGate, 'approved')) {
                  markApproved(episode, scene.slug, currentGate)
                }
              })

            })
            actions.appendChild(approveAll)
          }
          review.appendChild(actions)
        }
        body.appendChild(review)

        // ── Script: one card per scene ──────────────────────────────────────────────
        var scriptBox = labelled('Script')
        scriptBox.setAttribute('data-nn-subsection', 'script')
        // When every configured gate is approved there is no gate to act on; the scene still
        // reports the last one so an approved review does not read as autopilot.
        var displayGate = currentGate || (gates.length > 0 ? gates[gates.length - 1] : null)
        ;(episode.scenes || []).forEach(function (scene) {
          var sceneCard = el('article', 'nn-scene-script nn-scene-card')
          sceneCard.setAttribute('data-nn-scene', scene.slug)
          sceneCard.setAttribute('data-nn-scene-element', scene.elementId || '')

          var gate = (scene.gates || []).filter(function (g) {
            return g.gate === displayGate
          })[0]
          var gateState = gate ? gate.state : displayGate ? (currentGate ? 'open' : 'approved') : 'autopilot'

          var sceneHead = el('div', 'nn-scene-header')
          var titleGroup = el('div', 'nn-scene-title-group')
          titleGroup.appendChild(el('span', 'nn-scene-title', scene.slug + (scene.name ? ' · ' + scene.name : '')))
          var summary = scene.narration ? String(scene.narration).slice(0, 90) : 'No narration'
          titleGroup.appendChild(el('span', 'nn-scene-summary', summary))
          sceneHead.appendChild(titleGroup)
          if (scene.kind) sceneHead.appendChild(badge(scene.kind))
          if (scene.stale) {
            sceneCard.setAttribute('data-nn-stale', '')
            sceneHead.appendChild(badge('stale', 'nn-stale-badge'))
          }
          var pill = badge(gateState, 'nn-gate-state nn-verdict-pill')
          pill.setAttribute('data-nn-verdict-pill', gateState)
          sceneHead.appendChild(pill)
          if (scene.scriptHash) sceneHead.appendChild(badge('script ' + scene.scriptHash.slice(0, 8), 'nn-src-badge'))
          if (scene.previewHash) sceneHead.appendChild(badge('preview ' + scene.previewHash.slice(0, 8), 'nn-src-badge'))
          sceneCard.appendChild(sceneHead)

          var sceneBody = el('div', 'nn-scene-body is-open')
          sceneCard.appendChild(sceneBody)

          // Media: a thumbnail that opens the console lightbox with the full image or a
          // playable video. Reuses nn-visual-card/nn-visual-thumb/nn-visual-details and
          // nn-lightbox/nn-lightbox-card/nn-lightbox-shot.
          var media = el('div', 'nn-review-media')
          var visual = el('div', 'nn-visual-card')
          var thumb = el('button', 'nn-visual-thumb nn-media-open')
          thumb.type = 'button'
          thumb.setAttribute('data-nn-media-open', scene.slug)
          thumb.title = 'Open'
          if (scene.still) {
            var img = doc.createElement('img')
            img.src = scene.still
            img.alt = ''
            img.loading = 'lazy'
            thumb.appendChild(img)
          } else if (scene.video) {
            // The first frame is the thumbnail: no poster file needed.
            var thumbVideo = doc.createElement('video')
            thumbVideo.src = scene.video
            thumbVideo.muted = true
            thumbVideo.preload = 'metadata'
            thumbVideo.setAttribute('playsinline', '')
            thumb.appendChild(thumbVideo)
            thumb.appendChild(el('span', 'nn-visual-icon nn-media-play', '▶ video'))
          } else {
            thumb.appendChild(el('span', 'nn-visual-icon', 'no media'))
          }
          visual.appendChild(thumb)
          var visualDetails = el('div', 'nn-visual-details')
          visualDetails.appendChild(el('div', 'nn-visual-title', scene.kind || scene.slug))
          var mediaFile = scene.still || scene.video
          visualDetails.appendChild(el('div', 'nn-visual-sub', mediaFile ? mediaFile.split('/').pop() : (scene.layers || []).length + ' layer(s)'))
          visual.appendChild(visualDetails)
          media.appendChild(visual)
          if (scene.audio) {
            var audio = doc.createElement('audio')
            audio.className = 'nn-review-audio'
            audio.controls = true
            audio.preload = 'metadata'
            audio.src = scene.audio
            audio.setAttribute('data-nn-narration-audio', '')
            media.appendChild(audio)
          }
          sceneBody.appendChild(media)
          thumb.addEventListener('click', function () {
            openLightbox(scene)
          })

          // Narration: editable in place; saving is a correction draft.
          var nSection = labelled('Narration')
          var narration = el('textarea', 'nn-narration')
          narration.value = scene.narration || ''
          narration.disabled = scene.editable === false
          narration.setAttribute('aria-label', 'Narration for ' + (scene.name || scene.slug))
          narration.setAttribute('data-nn-scene-narration', '')
          narration.addEventListener('change', function () {
            if (scene.elementId) propose({ kind: 'correction', elementId: scene.elementId, field: 'description', proposed: narration.value })
          })
          nSection.appendChild(narration)
          sceneBody.appendChild(nSection)

          // Layers as pills, and the values inherited from above the scene.
          if ((scene.layers || []).length > 0) {
            var lSection = labelled('Layers')
            var pills = el('div', 'nn-cascade-chips')
            scene.layers.forEach(function (layer) {
              var label = layer.type + (layer.style ? ' · ' + layer.style : '')
              var chip = el('span', 'nn-cascade-chip', label)
              chip.setAttribute('data-nn-layer', layer.slug)
              chip.title = layer.text || layer.asset || layer.slug
              pills.appendChild(chip)
              var layerSettings = el('details', 'nn-conntent-fields nn-layer-settings')
              layerSettings.appendChild(el('summary', null, layer.name || layer.slug))
              layerSettings.appendChild(renderSettings(layer, 'Layer', episode))
              lSection.appendChild(layerSettings)
            })
            lSection.appendChild(pills)
            sceneBody.appendChild(lSection)
          }
          var sceneSettings = labelled('Scene settings')
          sceneSettings.appendChild(renderSettings(scene, 'Scene', episode))
          if (scene.editable === false) sceneSettings.appendChild(el('p', 'text-xs text-base-content/60', 'Generated scene. Change its Scene Kind in the series configuration.'))
          sceneBody.appendChild(sceneSettings)

          // Verdict: only for the current gate, and only while it is not approved.
          var verdictBox = el('div', 'nn-form-section nn-verdict-box')
          verdictBox.setAttribute('data-nn-subsection', 'verdict')
          if (!displayGate) {
            verdictBox.appendChild(el('p', 'empty-state', 'Autopilot: this scene needs no verdict.'))
          } else if (gateState === 'approved') {
            verdictBox.appendChild(el('p', 'nn-verdict-approved', 'Approved for ' + displayGate + '.'))
          } else {
            var line2 = el('div', 'nn-verdict-line')
            var approve = el('button', 'nn-verdict', 'Approve')
            approve.type = 'button'
            approve.setAttribute('data-nn-verdict', 'approved')
            approve.addEventListener('click', function () {
              if (!proposeVerdict(episode, scene, currentGate, 'approved')) return
              markApproved(episode, scene.slug, currentGate)
            })
            var needs = el('button', 'nn-verdict', 'Needs change')
            needs.type = 'button'
            needs.setAttribute('data-nn-verdict', 'needs-change')
            var reason = el('input', 'nn-comment')
            reason.type = 'text'
            reason.setAttribute('data-nn-verdict-reason', '')
            reason.placeholder = 'Reason (required for needs change)'
            needs.addEventListener('click', function () {
              if (!reason.value.trim()) {
                reason.classList.add('is-invalid')
                reason.focus()
                showMessage('Reason required', 'A needs-change verdict needs a reason')
                return
              }
              reason.classList.remove('is-invalid')
              if (!proposeVerdict(episode, scene, currentGate, 'needs-change', reason.value.trim())) return
              pill.textContent = 'needs-change'
              pill.setAttribute('data-nn-verdict-pill', 'needs-change')
            })
            line2.appendChild(approve)
            line2.appendChild(needs)
            line2.appendChild(reason)
            verdictBox.appendChild(line2)
            if (gate && gate.notes) verdictBox.appendChild(el('p', 'nn-gate-notes', gate.notes))
          }
          sceneBody.appendChild(verdictBox)

          scriptBox.appendChild(sceneCard)
        })
        if (!episode.scenes || episode.scenes.length === 0) {
          scriptBox.appendChild(el('p', 'empty-state', 'This episode has no scenes yet.'))
        }
        body.appendChild(scriptBox)

        // Episode values are resolved before scene overrides, even with no scenes.
        var configBox = labelled('Episode configuration')
        configBox.setAttribute('data-nn-subsection', 'config')
        configBox.appendChild(renderSettings(episode, 'Video', episode))
        body.appendChild(configBox)

        var status = labelled('Status')
        status.setAttribute('data-nn-subsection', 'status')
        status.appendChild(el('p', 'nn-episode-cost', episode.status || 'idea'))
        body.appendChild(status)

        var deliveries = labelled('Deliveries')
        deliveries.setAttribute('data-nn-subsection', 'deliveries')
        if (!episode.deliveries || episode.deliveries.length === 0) {
          deliveries.appendChild(
            el('p', 'empty-state', 'Not delivered yet. Delivery is automatic: QA passing lands a deliveries/v<N>/ folder.'),
          )
        } else {
          var deliveryList = el('div', 'nn-delivery-list')
          episode.deliveries.forEach(function (delivery) {
            var row = el('div', 'nn-delivery-row')
            row.setAttribute('data-nn-delivery', delivery.version)
            var isLatest = delivery.version === episode.latestDelivery
            if (!isLatest) row.setAttribute('data-nn-superseded', '')
            row.appendChild(el('span', 'nn-cascade-chip', delivery.version))
            row.appendChild(badge(isLatest ? 'latest' : 'superseded', 'nn-delivery-pill'))
            row.appendChild(el('code', 'nn-delivery-path', delivery.path))
            if (delivery.files && delivery.files.length > 0) {
              row.appendChild(el('span', 'nn-delivery-files', delivery.files.join(' · ')))
            }
            if (delivery.html) {
              var link = el('a', 'nn-delivery-link', 'Open delivery')
              link.setAttribute('href', delivery.html)
              link.setAttribute('target', '_blank')
              link.setAttribute('rel', 'noopener')
              row.appendChild(link)
            }
            deliveryList.appendChild(row)
          })
          deliveries.appendChild(deliveryList)
        }
        body.appendChild(deliveries)

        card.appendChild(body)
        episodeSection.appendChild(card)
        episodeCards.push({ episode: episode, series: series, node: card })
      })
    })
    if (episodeSection.childNodes.length <= 1) {
      episodeSection.appendChild(el('p', 'empty-state', 'No episodes yet.'))
    }
    root.appendChild(episodeSection)

    // Keep the canonical review controls; navigation selects which part is visible.
    var navigation = el('nav', 'nn-pipeline-nav')
    navigation.setAttribute('aria-label', 'Production workspace')
    var workspace = el('div', 'nn-pipeline-workspace')
    var home = el('section', 'nn-conntent-section')
    home.appendChild(el('h2', null, 'Your production at a glance'))
    home.appendChild(el('p', 'text-base-content/60', 'What needs attention and what to do next.'))
    var episodeList = el('section', 'nn-conntent-section')
    episodeList.appendChild(el('h2', null, 'Episodes'))
    var filters = el('div', 'flex gap-2 flex-wrap my-4')
    var search = el('input', 'input input-bordered input-sm')
    search.placeholder = 'Search episodes or series'
    search.setAttribute('aria-label', 'Search episodes or series')
    var seriesFilter = el('select', 'select select-bordered select-sm')
    seriesFilter.setAttribute('aria-label', 'Filter by series')
    seriesFilter.appendChild(el('option', null, 'All series'))
    seriesFilter.options[0].value = ''
    data.series.forEach(function (series) {
      var option = el('option', null, series.title)
      option.value = series.slug
      seriesFilter.appendChild(option)
    })
    filters.appendChild(search)
    filters.appendChild(seriesFilter)
    episodeList.appendChild(filters)
    var rows = el('div')
    episodeList.appendChild(rows)
    var deliveryPage = el('section', 'nn-conntent-section')
    deliveryPage.appendChild(el('h2', null, 'Deliveries'))
    var heading = el('div', 'nn-conntent-section')
    var activePage = 'Home'
    var activeEpisode = null
    var activeTab = 'Overview'
    var navButtons = {}
    function button(text, action, primary) {
      var b = el('button', 'btn btn-sm' + (primary ? ' btn-primary' : ' btn-outline'), text)
      b.type = 'button'
      b.addEventListener('click', action)
      return b
    }
    function showEpisode(item, tab, sceneSlug) {
      activeEpisode = item
      activeTab = tab || 'Overview'
      activePage = 'Episode'
      display()
      if (sceneSlug) {
        var scene = Array.prototype.find.call(item.node.querySelectorAll('[data-nn-scene]'), function (node) { return node.getAttribute('data-nn-scene') === sceneSlug })
        if (scene) scene.scrollIntoView({ block: 'nearest' })
      }
    }
    function episodeRow(item, target) {
      var row = el('article', 'nn-pipeline-row')
      var text = el('div')
      text.appendChild(el('p', 'text-xs text-base-content/60', item.series.title))
      var title = el('h3')
      title.appendChild(ctx.ui && ctx.ui.Ku ? ctx.ui.Ku('element', {
        model: item.episode.knowledgeId, id: item.episode.slug, label: item.episode.title,
        concept: 'Video',
      }, { doc: doc }) : el('span', null, item.episode.title))
      text.appendChild(title)
      text.appendChild(badge(item.episode.status || 'idea'))
      row.appendChild(text)
      row.appendChild(button(target === 'Deliveries' ? 'View delivery' : 'Open episode', function () { showEpisode(item, target) }))
      return row
    }
    function filterRows() {
      rows.textContent = ''
      episodeCards.filter(function (item) {
        return (!seriesFilter.value || item.series.slug === seriesFilter.value) &&
          (item.episode.title + ' ' + item.series.title).toLowerCase().includes(search.value.toLowerCase())
      }).forEach(function (item) { rows.appendChild(episodeRow(item)) })
      if (!rows.children.length) rows.appendChild(el('p', 'empty-state', 'No episodes match your filters.'))
    }
    search.addEventListener('input', filterRows)
    seriesFilter.addEventListener('change', filterRows)
    var waiting = episodeCards.filter(function (item) { return (item.episode.pending || item.episode.gates || []).some(function (g) { return g.state !== 'approved' }) })
    var delivered = episodeCards.filter(function (item) { return (item.episode.deliveries || []).length > 0 })
    var metrics = el('div', 'nn-pipeline-metrics')
    ;[[waiting.length, 'Need review', 'Home'], [episodeCards.length, 'Episodes', 'Episodes'], [delivered.length, 'With deliveries', 'Deliveries']].forEach(function (metric) {
      var box = button('', function () { activePage = metric[2]; display() })
      box.appendChild(el('strong', null, String(metric[0])))
      box.appendChild(el('span', null, metric[1]))
      metrics.appendChild(box)
    })
    if (ctx.ui && ctx.ui.KpiGrid) {
      home.appendChild(ctx.ui.KpiGrid({ items: [
        { label: 'Need review', value: waiting.length },
        { label: 'Episodes', value: episodeCards.length },
        { label: 'With deliveries', value: delivered.length },
      ] }, { doc: doc }))
    } else home.appendChild(metrics)
    home.appendChild(el('h3', null, 'Continue here'))
    waiting.forEach(function (item) {
      var row = episodeRow(item, 'Script & review')
      var gate = (item.episode.pending || item.episode.gates || []).filter(function (g) { return g.state !== 'approved' })[0]
      row.firstChild.appendChild(el('p', 'text-sm text-base-content/60', 'Next: review ' + gate.gate + (gate.scene ? ' · ' + gate.scene : '')))
      home.appendChild(row)
    })
    if (!waiting.length) home.appendChild(el('p', 'empty-state', 'No reviews are waiting for your decision.'))
    var pendingDetails = el('details', 'nn-conntent-section')
    pendingDetails.appendChild(el('summary', null, 'All review details (' + pending.length + ')'))
    pendingDetails.appendChild(pendingSection)
    home.appendChild(pendingDetails)
    Array.prototype.forEach.call(pendingSection.querySelectorAll('.nn-pending-item'), function (row, index) {
      var gate = pending[index]
      var item = episodeCards.filter(function (entry) { return entry.series.slug === gate.series && entry.episode.slug === gate.episode })[0]
      if (item) row.appendChild(button('Review scene', function () { showEpisode(item, 'Script & review', gate.scene) }))
    })
    var changesPage = el('section', 'nn-conntent-section')
    changesPage.appendChild(el('h2', null, 'Proposed changes'))
    changesPage.appendChild(el('p', 'text-base-content/60', 'Proposals are not applied to the domain yet. Export the shared changeset, then ask your agent to apply it.'))
    var changeList = el('div')
    changesPage.appendChild(changeList)
    if (ctx.changeset && ctx.changeset.openExport) {
      changesPage.appendChild(button('Export changeset', function () { ctx.changeset.openExport() }, true))
    }
    function updateChanges() {
      fieldRefreshers.forEach(function (refresh) { refresh() })
      changeList.textContent = ''
      var drafts = ctx.store && ctx.store.drafts ? ctx.store.drafts() : []
      if (!drafts.length) changeList.appendChild(el('p', 'empty-state', 'No changes proposed yet.'))
      drafts.forEach(function (draft) {
        var row = el('div', 'nn-pipeline-row')
        row.appendChild(el('span', null, (draft.kind || 'Change') + ' · ' + (draft.elementId || draft.element_id || draft.id || 'Domain')))
        row.appendChild(badge('Proposed · not applied'))
        changeList.appendChild(row)
      })
      if (navButtons.Changes) navButtons.Changes.textContent = 'Changes (' + drafts.length + ')'
    }
    delivered.forEach(function (item) { deliveryPage.appendChild(episodeRow(item, 'Deliveries')) })
    if (!delivered.length) deliveryPage.appendChild(el('p', 'empty-state', 'No deliveries yet.'))
    ;['Home', 'Episodes', 'Deliveries', 'Changes', 'Configuration'].forEach(function (name) {
      navButtons[name] = button(name, function () { activePage = name; display() })
      navigation.appendChild(navButtons[name])
    })
    root.insertBefore(navigation, root.firstChild)
    root.appendChild(workspace)
    ;[home, episodeList, deliveryPage, changesPage, heading, domain, episodeSection].forEach(function (node) { workspace.appendChild(node) })
    seriesSection.hidden = true
    // Move the existing episode cards between layouts; editors and drafts stay shared.
    var layout = 'Dashboard'
    var layoutTabs = el('div', 'nn-pipeline-layout-tabs flex gap-2')
    layoutTabs.setAttribute('role', 'tablist')
    layoutTabs.setAttribute('aria-label', 'Pipeline layout')
    var hierarchy = el('section', 'nn-pipeline-hierarchy')
    hierarchy.setAttribute('aria-label', 'Production hierarchy')
    hierarchy.appendChild(el('h2', null, 'Production hierarchy'))
    hierarchy.appendChild(el('p', 'text-base-content/60', 'Expand a series, then an episode to review its scenes and settings.'))
    var layoutButtons = {}
    ;['Dashboard', 'Hierarchy'].forEach(function (name) {
      var tab = button(name, function () { layout = name; display() })
      tab.setAttribute('role', 'tab')
      layoutButtons[name] = tab
      layoutTabs.appendChild(tab)
    })
    root.insertBefore(layoutTabs, root.firstChild)
    root.appendChild(hierarchy)
    data.series.forEach(function (series) {
      var branch = el('details', 'nn-hierarchy-card nn-hierarchy-series')
      branch.setAttribute('data-nn-hierarchy-series', series.slug)
      var summary = el('summary')
      summary.appendChild(el('strong', null, series.title))
      summary.appendChild(badge(series.episodes.length + ' episodes'))
      branch.appendChild(summary)
      var contents = el('div', 'nn-hierarchy-contents')
      episodeCards.filter(function (item) { return item.series === series }).forEach(function (item) {
        var episodeBranch = el('details', 'nn-hierarchy-card nn-hierarchy-episode')
        episodeBranch.setAttribute('data-nn-hierarchy-episode', item.episode.slug)
        var episodeSummary = el('summary')
        episodeSummary.appendChild(el('strong', null, item.episode.title))
        episodeSummary.appendChild(badge(item.episode.status || 'idea'))
        episodeSummary.appendChild(badge((item.episode.scenes || []).length + ' scenes'))
        episodeBranch.appendChild(episodeSummary)
        var episodeContents = el('div', 'nn-hierarchy-contents')
        var tabs = el('div', 'flex gap-2 flex-wrap my-4')
        item.hierarchyTab = 'Script & review'
        item.hierarchyButtons = {}
        ;['Overview', 'Script & review', 'Configuration', 'Deliveries'].forEach(function (name) {
          var tab = button(name, function () { item.hierarchyTab = name; display() })
          item.hierarchyButtons[name] = tab
          tabs.appendChild(tab)
        })
        episodeContents.appendChild(tabs)
        item.hierarchyHost = episodeContents
        episodeBranch.appendChild(episodeContents)
        episodeBranch.addEventListener('toggle', function () {
          if (!episodeBranch.open) Array.prototype.forEach.call(item.node.querySelectorAll('audio,video'), function (media) { media.pause() })
        })
        contents.appendChild(episodeBranch)
      })
      if (!series.episodes.length) contents.appendChild(el('p', 'empty-state', 'No episodes yet.'))
      branch.appendChild(contents)
      hierarchy.appendChild(branch)
    })
    if (!data.series.length) hierarchy.appendChild(el('p', 'empty-state', 'No series yet.'))
    function display() {
      var isHierarchy = layout === 'Hierarchy'
      navigation.hidden = workspace.hidden = !isHierarchy ? false : true
      hierarchy.hidden = !isHierarchy
      Object.keys(layoutButtons).forEach(function (name) { layoutButtons[name].setAttribute('aria-selected', String(layout === name)) })
      home.hidden = activePage !== 'Home'
      episodeList.hidden = activePage !== 'Episodes'
      deliveryPage.hidden = activePage !== 'Deliveries'
      changesPage.hidden = activePage !== 'Changes'
      domain.hidden = activePage !== 'Configuration'
      heading.hidden = episodeSection.hidden = activePage !== 'Episode'
      Object.keys(navButtons).forEach(function (name) { navButtons[name].setAttribute('aria-current', activePage === name || (activePage === 'Episode' && name === 'Episodes') ? 'page' : 'false') })
      heading.textContent = ''
      if (activePage === 'Episode' && activeEpisode) {
        heading.appendChild(button('← All episodes', function () { activePage = 'Episodes'; display() }))
        heading.appendChild(el('p', 'text-sm text-base-content/60 my-2', activeEpisode.series.title))
        var tabs = el('div', 'flex gap-2 flex-wrap my-4')
        ;['Overview', 'Script & review', 'Configuration', 'Deliveries'].forEach(function (name) {
          var b = button(name, function () { activeTab = name; display() }, name === activeTab)
          b.setAttribute('aria-pressed', String(name === activeTab))
          tabs.appendChild(b)
        })
        heading.appendChild(tabs)
      }
      episodeCards.forEach(function (item) {
        var parent = isHierarchy ? item.hierarchyHost : episodeSection
        if (item.node.parentNode !== parent) parent.appendChild(item.node)
        item.node.hidden = !isHierarchy && (activePage !== 'Episode' || item !== activeEpisode)
        var selectedTab = isHierarchy ? item.hierarchyTab : activeTab
        Object.keys(item.hierarchyButtons).forEach(function (name) { item.hierarchyButtons[name].setAttribute('aria-pressed', String(item.hierarchyTab === name)) })
        Array.prototype.forEach.call(item.node.querySelectorAll('.nn-conntent-body > [data-nn-subsection]'), function (section) {
          var id = section.getAttribute('data-nn-subsection')
          section.hidden = selectedTab === 'Overview' ? ['review', 'status'].indexOf(id) === -1 : selectedTab === 'Script & review' ? ['review', 'script'].indexOf(id) === -1 : selectedTab === 'Configuration' ? id !== 'config' : id !== 'deliveries'
        })
        if (item.node.hidden) Array.prototype.forEach.call(item.node.querySelectorAll('audio,video'), function (media) { media.pause() })
      })
    }
    filterRows()
    updateChanges()
    var unsubscribe = ctx.store && ctx.store.onChange ? ctx.store.onChange(updateChanges) : null
    display()

    return { unmount: function () { closeFieldModal(); if (typeof unsubscribe === 'function') unsubscribe() } }
  },
})

registerView({
  id: 'conntent-delivery',
  title: 'Delivery',
  icon: 'play',
  order: 16,
  kind: 'readonly',
  mount: function (ctx) {
    var doc = ctx.container.ownerDocument

    function el(tag, className, text) {
      var node = doc.createElement(tag)
      if (className) node.className = className
      if (text !== undefined) node.textContent = text
      return node
    }

    function badge(text, extra) {
      return el('span', 'nn-badge' + (extra ? ' ' + extra : ''), text)
    }

    var root = el('div', 'nn-conntent-view nn-delivery-view')
    root.setAttribute('data-nn-delivery-view', '')
    ctx.container.appendChild(root)

    var viewData = ctx.viewData || {}
    var data = viewData['conntent-delivery'] || viewData.conntent || viewData.tree || viewData
    var tree = data.tree || data
    var scope = (ctx.payload && ctx.payload.meta && ctx.payload.meta.consoleScope) || (ctx.model && ctx.model.meta && ctx.model.meta.consoleScope) || {}

    var episode = null
    if (tree && tree.series) {
      for (var si = 0; si < tree.series.length; si++) {
        var s = tree.series[si]
        if (s.episodes) {
          for (var ei = 0; ei < s.episodes.length; ei++) {
            var ep = s.episodes[ei]
            if (!episode) {
              episode = ep
            }
            if (scope.models && (scope.models.includes(ep.knowledgeId) || scope.models.includes(ep.modelId))) {
              episode = ep
              break
            }
          }
        }
        if (episode && scope.models) break
      }
    }

    if (!episode) {
      root.appendChild(el('p', 'empty-state p-4', 'No episode delivery data found.'))
      return {}
    }

    var labelMatch = scope.label && scope.label.match(/v\d+/)
    var deliveryVersion = labelMatch ? labelMatch[0] : (episode && episode.latestDelivery) || 'v1'
    var delivery = null
    if (episode.deliveries) {
      delivery = episode.deliveries.find(function (d) { return d.version === deliveryVersion }) || episode.deliveries[0]
    }

    function sibling(p) {
      if (!p) return ''
      var base = String(p).split(/[/\\]/).pop()
      return './' + base
    }

    // Episode header
    var head = el('header', 'nn-episode-head flex justify-between items-start mb-4 pb-3 border-b')
    var titleBox = el('div', null)
    var titleLine = el('div', 'flex items-center gap-2')
    titleLine.appendChild(el('h2', 'text-2xl font-bold', episode.title || episode.slug))
    titleLine.appendChild(el('span', 'nn-cascade-chip', deliveryVersion))
    if (episode.language) {
      titleLine.appendChild(badge(episode.language))
    }
    titleBox.appendChild(titleLine)
    if (episode.description) {
      titleBox.appendChild(el('p', 'text-sm text-base-content/80 mt-1', episode.description))
    }
    if (delivery && (delivery.time || delivery.deliveredAt)) {
      titleBox.appendChild(el('p', 'text-xs text-base-content/60 mt-1', 'Delivered at: ' + (delivery.time || delivery.deliveredAt)))
    }
    head.appendChild(titleBox)
    root.appendChild(head)

    // Players section (one per format delivered)
    var files = (delivery && delivery.files) || []
    var videoFiles = files.filter(function (f) { return /\.(mp4|webm|mov)$/i.test(f) })
    if (videoFiles.length === 0) {
      videoFiles = [episode.slug + '.mp4']
    }
    var playerSection = el('section', 'nn-delivery-players flex flex-col gap-4 my-4')
    videoFiles.forEach(function (file) {
      var box = el('div', 'nn-player-box')
      var video = doc.createElement('video')
      video.src = sibling(file)
      video.controls = true
      video.preload = 'metadata'
      video.className = 'w-full rounded bg-black'
      box.appendChild(video)
      playerSection.appendChild(box)
    })
    root.appendChild(playerSection)

    // Automatic QA result
    var qaSection = el('div', 'nn-delivery-qa my-3 flex items-center gap-2')
    var qaState = 'passed'
    if (episode.gates) {
      var qaGate = episode.gates.find(function (g) { return g.gate === 'qa' })
      if (qaGate && qaGate.state) qaState = qaGate.state
    }
    qaSection.appendChild(el('span', 'font-semibold text-sm', 'QA Gate:'))
    qaSection.appendChild(badge('Automatic QA: ' + qaState, 'badge-success'))
    root.appendChild(qaSection)

    // Review history
    var reviewSection = el('div', 'nn-delivery-review-history my-3')
    reviewSection.appendChild(el('h4', 'font-semibold text-sm mb-2', 'Review history'))
    var historyList = el('ul', 'list-disc pl-5 text-sm')
    var hasHistory = false
    if (episode.gates) {
      episode.gates.forEach(function (g) {
        if (g.gate !== 'qa') {
          var item = el('li', null, g.gate + (g.scene ? ' · ' + g.scene : '') + ': ' + g.state + (g.reviewer ? ' by ' + g.reviewer : ''))
          historyList.appendChild(item)
          hasHistory = true
        }
      })
    }
    if (!hasHistory) {
      historyList.appendChild(el('li', 'opacity-60', 'No manual review gates recorded.'))
    }
    reviewSection.appendChild(historyList)
    root.appendChild(reviewSection)

    // Script per scene
    var scriptBox = el('div', 'nn-form-section mt-4')
    scriptBox.appendChild(el('span', 'nn-section-label font-bold text-base', 'Script'))
    ;(episode.scenes || []).forEach(function (scene) {
      var sceneCard = el('div', 'nn-scene-card border rounded p-4 my-3')
      sceneCard.setAttribute('data-nn-scene', scene.slug)

      var sceneHead = el('div', 'flex justify-between items-center mb-2')
      sceneHead.appendChild(el('h4', 'font-semibold', (scene.kind ? scene.kind + ' · ' : '') + (scene.name || scene.slug)))
      sceneCard.appendChild(sceneHead)

      var mediaBox = el('div', 'flex gap-3 items-center my-2')
      if (scene.still) {
        var img = doc.createElement('img')
        img.src = sibling(scene.still)
        img.alt = scene.slug
        img.className = 'w-24 h-24 object-cover rounded'
        mediaBox.appendChild(img)
      }
      if (scene.audio) {
        var audio = doc.createElement('audio')
        audio.controls = true
        audio.src = sibling(scene.audio)
        mediaBox.appendChild(audio)
      }
      if (mediaBox.childNodes.length > 0) {
        sceneCard.appendChild(mediaBox)
      }

      var narration = el('p', 'nn-narration my-2 text-sm leading-relaxed', scene.narration || '')
      sceneCard.appendChild(narration)

      if (scene.layers && scene.layers.length > 0) {
        var layerBox = el('div', 'nn-cascade-chips flex gap-1 flex-wrap my-2')
        scene.layers.forEach(function (l) {
          var chip = el('span', 'nn-cascade-chip', l.type + (l.style ? ' · ' + l.style : ''))
          layerBox.appendChild(chip)
        })
        sceneCard.appendChild(layerBox)
      }

      scriptBox.appendChild(sceneCard)
    })
    root.appendChild(scriptBox)

    return {}
  },
})
