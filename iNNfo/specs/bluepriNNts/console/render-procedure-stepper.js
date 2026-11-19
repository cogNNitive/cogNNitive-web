/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.nnProcedureStepper = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  /*
   * Procedure viewer. It shows what nn-core derived at export time and never derives anything
   * itself: `payload.model.procedureGraphs` holds one entry per procedure document, with the
   * graph from `procedureGraph` and every run of the domaiNN (`executions/<run>/`) folded by
   * `foldRun`. It writes nothing: runs are recorded by the nn-mcp runner tools
   * (`procedure_start` / `procedure_state` / `procedure_record`).
   */

  var GLOBAL =
    typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? globalThis
          : this

  var RENDERER_VERSION = '0.3.0'

  var V = GLOBAL.nnVisuals && typeof GLOBAL.nnVisuals === 'object' ? GLOBAL.nnVisuals : null

  function vIcon(name, size) {
    return V && typeof V.iconSvg === 'function' ? V.iconSvg(name, size || 14) : ''
  }

  var TERMINAL_RUN = { completed: true, failed: true, cancelled: true }

  function mount(container, payload, viewCtx) {
    if (!container || typeof container.querySelector !== 'function') {
      return { ok: false, reason: 'no-container' }
    }
    // `document` is shadowed with the container's own document, so every element below
    // stays inside this view's DOM tree.
    var document = container.ownerDocument || (typeof globalThis !== 'undefined' ? globalThis.document : null)
    var schema = (payload && payload.schema) || {}
    var model = (payload && payload.model) || {}
    var elements = Array.isArray(model.elements) ? model.elements : []
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var meta = model.meta || {}
    var entries = Array.isArray(model.procedureGraphs) ? model.procedureGraphs : []

    var byName = {}
    elements.forEach(function (el) {
      if (el && el.name) byName[el.name] = el
    })

    // The console hands an editable view a `store` facade when a human may propose. A
    // console without it is read-only: the view renders, and offers no write.
    var store = viewCtx && viewCtx.store && typeof viewCtx.store.propose === 'function' ? viewCtx.store : null
    var draftNote = null

    if (!GLOBAL.nnConsole) {
      container.innerHTML = '<div class="nn-empty-state"><p>Procedure runtime is not available.</p></div>'
      return {
        ok: false,
        unmount: function () {
          container.innerHTML = ''
        },
      }
    }

    var concepts = (schema.concepts || []).slice()

    function make(tag, className, text) {
      var n = document.createElement(tag)
      if (className) n.className = className
      if (text !== undefined && text !== null) n.textContent = String(text)
      return n
    }

    container.innerHTML = ''
    var root = make('div', 'nn-procedure-view')
    container.appendChild(root)

    var runCount = entries.reduce(function (n, e) {
      return n + (Array.isArray(e.runs) ? e.runs.length : 0)
    }, 0)
    var strip = make('div', 'proc-structure-strip')
    strip.appendChild(make('div', 'proc-structure-summary', entries.length + ' procedures · ' + runCount + ' runs'))
    root.appendChild(strip)
    var defectsEl = make('div', 'proc-structure-defects')
    strip.appendChild(defectsEl)

    renderBlueprintList(root)

    if (entries.length === 0) {
      root.appendChild(make('div', 'empty-state', 'No procedures in this export.'))
      return {
        ok: true,
        procedures: 0,
        steps: 0,
        matrices: matrices.length,
        unmount: function () {
          container.innerHTML = ''
        },
      }
    }

    var tabsHost = make('div', 'proc-tabs')
    root.appendChild(tabsHost)
    var body = make('div', 'proc-body')
    root.appendChild(body)

    var active = entries[0]
    var activeRun = null
    var selectedStep = null

    function selectEntry(entry) {
      active = entry
      var runs = Array.isArray(entry.runs) ? entry.runs : []
      activeRun = runs.length ? runs[0] : null
      selectedStep = null
    }

    function stepsOf(entry) {
      return entry && entry.graph && entry.graph.steps ? entry.graph.steps : {}
    }

    function stepName(slug) {
      var s = stepsOf(active)[slug]
      return s ? s.name || slug : slug
    }

    function elementOf(slug) {
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i]
        if (el && el.slug === slug && el.modelFile === active.file) return el
      }
      return null
    }

    // ---- Blueprint procedure catalog (parent + includes): `usage` first, shadowed ones hidden ----
    function renderBlueprintList(host) {
      var list = Array.isArray(schema.procedures)
        ? schema.procedures.filter(function (p) {
            return p && p.status !== 'shadowed'
          })
        : []
      if (!list.length) return
      list.sort(function (a, b) {
        if (a.id === 'usage') return -1
        if (b.id === 'usage') return 1
        return 0
      })
      var listEl = make('div', 'proc-blueprint-list')
      listEl.setAttribute('data-nn-procedures', 'blueprint')
      listEl.appendChild(make('span', 'proc-blueprint-label', 'Procedures'))
      list.forEach(function (p) {
        var item = make(
          'span',
          'proc-blueprint-item' + (p.id === 'usage' ? ' proc-blueprint-usage' : ''),
          p.id === 'usage' ? 'Getting started' : p.name || p.id,
        )
        item.setAttribute('data-procedure-id', p.id)
        listEl.appendChild(item)
      })
      host.appendChild(listEl)
    }

    // ---- Reference pills ----
    function openRef(element) {
      var rt = GLOBAL.nnConsole
      if (rt && typeof rt.renderRefDialog === 'function') rt.renderRefDialog(document, element)
    }

    function refPill(target, label) {
      var UI = GLOBAL.nnUI
      if (UI && typeof UI.Ku === 'function' && target.id) {
        var cMeta = null
        concepts.forEach(function (x) {
          if (x && x.name === target.concept) cMeta = x
        })
        var pill = UI.Ku(
          'element',
          { model: meta.modelId || '', id: target.id, label: target.name || label, concept: target.concept, color: cMeta && cMeta.color },
          { doc: document },
        )
        var badge = pill.querySelector('[data-nn-component="ku-unit"]')
        if (badge) {
          badge.setAttribute('role', 'button')
          badge.setAttribute('tabindex', '0')
          badge.addEventListener('click', function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault()
            openRef(target)
          })
        }
        return pill
      }
      var b = make('button', 'chip-ref', label)
      b.setAttribute('type', 'button')
      b.addEventListener('click', function () {
        openRef(target)
      })
      return b
    }

    function appendWithKuPills(hostEl, rawText) {
      var text = String(rawText == null ? '' : rawText)
      var names = Object.keys(byName)
        .filter(function (n) {
          return n && n.length >= 3
        })
        .sort(function (a, b) {
          return b.length - a.length
        })
      if (!names.length) {
        hostEl.appendChild(document.createTextNode(text))
        return
      }
      var re = new RegExp(
        '(' +
          names
            .map(function (n) {
              return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            })
            .join('|') +
          ')',
        'g',
      )
      var last = 0
      var match
      while ((match = re.exec(text)) !== null) {
        if (match.index > last) hostEl.appendChild(document.createTextNode(text.slice(last, match.index)))
        hostEl.appendChild(refPill(byName[match[0]], match[0]))
        last = re.lastIndex
      }
      if (last < text.length) hostEl.appendChild(document.createTextNode(text.slice(last)))
    }

    function appendMarkdown(hostEl, rawText) {
      var UI = GLOBAL.nnUI
      if (!UI || typeof UI.Markdown !== 'function') {
        appendWithKuPills(hostEl, rawText)
        return
      }
      var markdown = UI.Markdown(rawText, { doc: document })
      function decorate(node) {
        if (node.nodeType === 3) {
          var fragment = document.createDocumentFragment()
          appendWithKuPills(fragment, node.nodeValue)
          node.parentNode.replaceChild(fragment, node)
          return
        }
        if (/^(CODE|PRE|A|BUTTON)$/.test(node.tagName || '')) return
        Array.prototype.slice.call(node.childNodes || []).forEach(decorate)
      }
      decorate(markdown)
      hostEl.appendChild(markdown)
    }

    // ---- Tabs: one per procedure document ----
    function renderTabs() {
      tabsHost.innerHTML = ''
      entries.forEach(function (entry) {
        var b = make('button', 'proc-tab' + (entry === active ? ' active' : ''), entry.title || entry.file)
        b.setAttribute('type', 'button')
        b.addEventListener('click', function () {
          selectEntry(entry)
          render()
        })
        tabsHost.appendChild(b)
      })
    }

    function renderDiagnostics() {
      defectsEl.innerHTML = ''
      var list = active.graph && Array.isArray(active.graph.diagnostics) ? active.graph.diagnostics : []
      list.forEach(function (d) {
        var item = make('div', 'proc-defect-item', d.code + ': ' + d.detail)
        item.setAttribute('data-defect-kind', d.code)
        item.setAttribute('data-severity', d.severity)
        defectsEl.appendChild(item)
      })
    }

    // ---- Ficha: the Procedure element that links this document ----
    function renderFicha(host) {
      var linked = null
      elements.forEach(function (el) {
        if (el && el.concept === 'Procedure' && el.fields && el.fields.procedure_model === active.file) linked = linked || el
      })
      var ficha = make('div', 'proc-ficha')
      if (!linked) {
        ficha.appendChild(make('div', 'proc-no-catalog-note', 'No catalog entry linked.'))
        host.appendChild(ficha)
        return
      }
      var f = linked.fields
      if (f.summary) ficha.appendChild(make('div', 'proc-ficha-summary', f.summary))
      ;[
        ['category', 'Category'],
        ['executed_by', 'Executed by'],
        ['inputs_required', 'Inputs required'],
        ['outputs_expected', 'Outputs expected'],
      ].forEach(function (pair) {
        if (f[pair[0]]) ficha.appendChild(make('div', 'proc-ficha-' + pair[0], pair[1] + ': ' + f[pair[0]]))
      })
      host.appendChild(ficha)
    }

    // ---- Runs of the active procedure ----
    function runStatus(run) {
      return run.state ? run.state.status : 'unknown'
    }

    function renderRunList(host) {
      var runs = Array.isArray(active.runs) ? active.runs : []
      var bar = make('div', 'proc-runs')
      bar.appendChild(make('span', 'proc-runs-label', 'Runs'))
      var def = make('button', 'proc-run proc-run-definition' + (activeRun ? '' : ' active'), 'Definition')
      def.setAttribute('type', 'button')
      def.addEventListener('click', function () {
        activeRun = null
        selectedStep = null
        render()
      })
      bar.appendChild(def)
      runs.forEach(function (run) {
        var b = make('button', 'proc-run' + (run === activeRun ? ' active' : ''), run.id + ' · ' + runStatus(run))
        b.setAttribute('type', 'button')
        b.setAttribute('data-run-id', run.id)
        b.setAttribute('data-status', runStatus(run))
        b.addEventListener('click', function () {
          activeRun = run
          selectedStep = null
          render()
        })
        bar.appendChild(b)
      })
      if (!runs.length) bar.appendChild(make('span', 'proc-runs-empty', 'No run recorded yet.'))
      host.appendChild(bar)
    }

    // ---- Graph layout: a step's layer is its longest distance from the start ----
    function layersOf(graph) {
      var steps = graph.steps
      var order = Object.keys(steps)
      var layer = {}
      var queue = graph.start ? [graph.start] : []
      if (graph.start) layer[graph.start] = 0
      var guard = order.length * order.length + 1
      while (queue.length && guard-- > 0) {
        var s = queue.shift()
        steps[s].next.forEach(function (t) {
          if (layer[t] === undefined || layer[t] < layer[s] + 1) {
            // A cycle never settles; its depth is capped at the step count.
            if (layer[s] + 1 >= order.length) return
            layer[t] = layer[s] + 1
            queue.push(t)
          }
        })
      }
      var max = -1
      order.forEach(function (s) {
        if (layer[s] !== undefined && layer[s] > max) max = layer[s]
      })
      order.forEach(function (s) {
        if (layer[s] === undefined) layer[s] = ++max
      })
      var rows = []
      order.forEach(function (s) {
        ;(rows[layer[s]] = rows[layer[s]] || []).push(s)
      })
      return { layer: layer, rows: rows.filter(Boolean) }
    }

    function stepStatus(slug) {
      if (!activeRun || !activeRun.state) return 'definition'
      var st = activeRun.state.steps[slug]
      return st ? st.status : 'pending'
    }

    function renderGraph(host) {
      var graph = active.graph
      var svgNS = 'http://www.w3.org/2000/svg'
      var nodeW = 200
      var nodeH = 52
      var gapX = 24
      var gapY = 76
      var lay = layersOf(graph)
      var widest = lay.rows.reduce(function (n, r) {
        return Math.max(n, r.length)
      }, 1)
      var width = widest * (nodeW + gapX) + gapX
      var svg = document.createElementNS(svgNS, 'svg')
      svg.setAttribute('class', 'dag-canvas')
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + (lay.rows.length * gapY + 20))
      var pos = {}
      lay.rows.forEach(function (row, r) {
        var offset = (width - row.length * (nodeW + gapX) + gapX) / 2
        row.forEach(function (slug, i) {
          pos[slug] = { x: offset + i * (nodeW + gapX), y: 16 + r * gapY, layer: r }
        })
      })
      var current = activeRun && activeRun.state ? activeRun.state.currentStep : null
      Object.keys(graph.steps).forEach(function (slug) {
        graph.steps[slug].next.forEach(function (t) {
          if (!pos[t]) return
          var edge = document.createElementNS(svgNS, 'path')
          var x1 = pos[slug].x + nodeW / 2
          var y1 = pos[slug].y + nodeH
          var x2 = pos[t].x + nodeW / 2
          var y2 = pos[t].y
          edge.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2)
          edge.setAttribute('class', 'dag-edge ' + stepStatus(t))
          edge.setAttribute('data-from', slug)
          edge.setAttribute('data-to', t)
          svg.appendChild(edge)
          var guard = graph.steps[t].condition
          if (guard && graph.steps[slug].next.length > 1) {
            var label = document.createElementNS(svgNS, 'text')
            label.setAttribute('class', 'dag-edge-label')
            label.setAttribute('x', (x1 + x2) / 2)
            label.setAttribute('y', (y1 + y2) / 2)
            label.textContent = guard
            svg.appendChild(label)
          }
        })
      })
      Object.keys(graph.steps).forEach(function (slug) {
        var step = graph.steps[slug]
        var p = pos[slug]
        var status = stepStatus(slug)
        var g = document.createElementNS(svgNS, 'g')
        g.setAttribute(
          'class',
          'dag-node ' + status + (step.stepType === 'decision' ? ' decision' : '') + (slug === current ? ' current' : '') + (slug === selectedStep ? ' selected' : ''),
        )
        g.setAttribute('data-step', slug)
        g.setAttribute('data-status', status)
        g.setAttribute('data-layer', String(p.layer))
        g.addEventListener('click', function () {
          selectedStep = slug
          render()
        })
        var rect = document.createElementNS(svgNS, 'rect')
        rect.setAttribute('x', p.x)
        rect.setAttribute('y', p.y)
        rect.setAttribute('width', nodeW)
        rect.setAttribute('height', nodeH)
        rect.setAttribute('rx', '8')
        g.appendChild(rect)
        var dot = document.createElementNS(svgNS, 'circle')
        dot.setAttribute('cx', p.x + 16)
        dot.setAttribute('cy', p.y + nodeH / 2)
        dot.setAttribute('r', '6')
        dot.setAttribute('class', 'node-dot')
        g.appendChild(dot)
        var sub = document.createElementNS(svgNS, 'text')
        sub.setAttribute('x', p.x + 30)
        sub.setAttribute('y', p.y + 20)
        sub.setAttribute('class', 'node-sub')
        sub.textContent = (step.stepType || 'task').toUpperCase() + (step.executor ? ' · ' + step.executor : '') + (status !== 'definition' ? ' · ' + status : '')
        g.appendChild(sub)
        var title = document.createElementNS(svgNS, 'text')
        title.setAttribute('x', p.x + 30)
        title.setAttribute('y', p.y + 38)
        title.setAttribute('class', 'node-title')
        var name = step.name || slug
        title.textContent = name.length > 24 ? name.substring(0, 22) + '…' : name
        g.appendChild(title)
        svg.appendChild(g)
      })
      var col = make('div', 'exec-dag-col')
      var head = make('div', 'exec-col-header')
      head.innerHTML = '<span>' + vIcon('workflow', 14) + ' Workflow</span>'
      head.appendChild(make('span', 'count-badge', Object.keys(graph.steps).length + ' steps'))
      col.appendChild(head)
      var view = make('div', 'exec-dag-view')
      view.appendChild(svg)
      col.appendChild(view)
      host.appendChild(col)
    }

    // ---- Step card ----
    function guardText(guard) {
      if (!guard || guard.kind === 'none') return 'always'
      if (guard.kind === 'outcome') return 'outcome == ' + guard.token
      if (guard.kind === 'artifact') return guard.artifact + ' validated (' + (guard.holds ? 'holds' : 'not yet') + ')'
      return guard.text
    }

    function artifactLine(slug) {
      var def = active.graph.artifacts[slug]
      var name = def ? def.name : slug
      var st = activeRun && activeRun.state ? activeRun.state.artifacts[slug] : null
      return name + (st ? ': ' + st.status + (st.rev ? ' (rev ' + st.rev + ')' : '') : '')
    }

    function renderStepCard(host) {
      var graph = active.graph
      var slug = selectedStep || (activeRun && activeRun.state && activeRun.state.currentStep) || graph.start || Object.keys(graph.steps)[0]
      var col = make('div', 'exec-active-col')
      host.appendChild(col)
      if (!slug || !graph.steps[slug]) {
        col.appendChild(make('div', 'empty-state', 'No steps in this procedure.'))
        return
      }
      var step = graph.steps[slug]
      var status = stepStatus(slug)
      var st = activeRun && activeRun.state ? activeRun.state.steps[slug] : null
      var card = make('article', 'exec-step-card nn-card')
      card.setAttribute('data-nn-component', 'element-card')
      card.setAttribute('data-step', slug)
      var head = make('div', 'exec-step-head')
      var type = make('span', 'step-type-pill pill-' + (step.stepType || 'task'))
      type.innerHTML = vIcon(step.stepType || 'task', 14) + ' '
      type.appendChild(document.createTextNode((step.stepType || 'task').toUpperCase()))
      head.appendChild(type)
      if (step.executor) head.appendChild(make('span', 'step-executor-pill', 'Executor: ' + step.executor))
      if (step.condition) head.appendChild(make('span', 'step-cond-pill', 'IF: ' + step.condition))
      head.appendChild(make('span', 'step-state-badge state-' + status, status === 'definition' ? 'Definition' : status))
      card.appendChild(head)
      card.appendChild(make('h2', 'exec-step-title', step.name || slug))
      var el = elementOf(slug)
      if (el && el.description) {
        var desc = make('div', 'exec-step-desc')
        appendMarkdown(desc, el.description)
        card.appendChild(desc)
      }
      var facts = make('div', 'exec-step-facts')
      function fact(label, value) {
        if (value === undefined || value === null || value === '') return
        facts.appendChild(make('div', 'exec-step-fact', label + ': ' + value))
      }
      fact('Decision', step.decision)
      fact('Command', step.command)
      fact('Produces', step.produces)
      fact('Inputs', step.inputs.map(artifactLine).join(', '))
      fact('Outputs', step.outputs.map(artifactLine).join(', '))
      if (st) {
        fact('Attempt', st.attempt ? String(st.attempt) : '')
        fact('Waiting on', st.waitingOn)
        fact('Failure', st.failure)
        if (st.outcome || st.next) fact('Outcome', (st.outcome || '—') + (st.next ? ' → ' + stepName(st.next) : ''))
      }
      if (facts.children.length) card.appendChild(facts)
      if (step.next.length > 1) {
        var branches = make('div', 'branch-outcomes')
        step.next.forEach(function (t) {
          var target = graph.steps[t]
          branches.appendChild(make('div', 'branch-outcome', stepName(t) + ' — ' + ((target && target.condition) || 'no guard')))
        })
        card.appendChild(branches)
      }
      var raci = rolesForStep(step.name)
      if (raci.length) {
        var raciBox = make('div', 'exec-raci-box')
        raciBox.appendChild(make('div', 'exec-box-title', 'Governance & Roles (RACI)'))
        raci.forEach(function (r) {
          raciBox.appendChild(make('span', 'raci-item', r.value + ' ' + r.label))
        })
        card.appendChild(raciBox)
      }
      col.appendChild(card)
    }

    function rolesForStep(workName) {
      var mx = null
      matrices.forEach(function (m) {
        if (m && m.name === 'work-roles matrix') mx = m
      })
      if (!mx) return []
      var row = (mx.cells || {})[workName]
      if (!row) return []
      return (mx.cols || [])
        .filter(function (c) {
          return row[c]
        })
        .map(function (c) {
          return { label: c, value: row[c] }
        })
    }

    // ---- Actions a human may record (a DRAFT, never an apply) ----
    // This mirrors what `procedure_record` would accept for the step the fold points at.
    // It is a client-side guard only: it stops a draft that `apply_change` would reject,
    // and it never re-folds the run. `finish` and `cancel` are absent on purpose — closing
    // a run needs `close_model`, which a console draft cannot emit.
    var ACTION_LABEL = {
      start: 'Start step',
      wait: 'Mark waiting',
      complete: 'Complete step',
      fail: 'Fail step',
      pause: 'Pause run',
      resume: 'Resume run',
      rebase: 'Rebase onto current definition',
    }

    function allowedActionsOf(state, run) {
      if (!state || run.closed || TERMINAL_RUN[state.status]) return []
      if (state.drift) return ['rebase']
      if (state.paused) return ['resume']
      var out = []
      var current = state.currentStep
      if (current && stepsOf(active)[current]) {
        var status = state.steps[current] ? state.steps[current].status : 'pending'
        if (status === 'active' || status === 'waiting') {
          if (status === 'active') out.push('wait')
          out.push('complete', 'fail')
        }
        if (status !== 'active' && status !== 'waiting') out.push('start')
      }
      if (!state.paused) out.push('pause')
      return out
    }

    /** The event fields for one action, matching the facts `procedure_record` records. */
    function eventFor(action, state) {
      var step = state.currentStep
      var st = step && state.steps ? state.steps[step] : null
      // Run-level facts: `procedure_record` records these with no `step` (`plan()`).
      if (action === 'pause') return { kind: 'interrupted' }
      if (action === 'resume') return { kind: 'resumed' }
      if (action === 'rebase') return { kind: 'rebased', value: state.drift ? state.drift.current : '' }
      if (action === 'start') return { kind: 'step_started', step: step, attempt: String((st ? st.attempt : 0) + 1) }
      if (action === 'wait') return { kind: 'step_waiting', step: step }
      if (action === 'fail') return { kind: 'step_failed', step: step }
      return { kind: 'step_completed', step: step }
    }

    function runDraft(run, fields) {
      var n = (Array.isArray(run.events) ? run.events.length : 0) + 1
      var name = 'e-' + String(n).padStart(3, '0')
      return store.propose({
        kind: 'new',
        knowledge_id: run.id,
        concept: 'Execution Event',
        element: name,
        proposed: JSON.stringify(fields),
        element_slug: name,
      })
    }

    /** The outcome choices a branching step offers, one per guard that can be evaluated. */
    function outcomeChoices(state) {
      var targets = Array.isArray(state.allowedNext) ? state.allowedNext : []
      var choices = []
      targets.forEach(function (t) {
        if (!t.guard || t.guard.kind !== 'outcome') return
        var token = guardText(t.guard).replace(/^outcome == /, '')
        choices.push({ outcome: token, next: t.to, label: stepName(t.to) + ' (' + token + ')' })
      })
      return choices
    }

    function recordAction(action, state, errorEl, pickedOutcome) {
      if (errorEl) errorEl.textContent = ''
      var fields = eventFor(action, state)
      if (action === 'complete') {
        var targets = Array.isArray(state.allowedNext) ? state.allowedNext : []
        if (targets.length === 1) {
          fields.next = targets[0].to
        } else if (pickedOutcome) {
          var chosen = outcomeChoices(state).filter(function (c) {
            return c.outcome === pickedOutcome
          })[0]
          if (!chosen) {
            if (errorEl) errorEl.textContent = '"' + pickedOutcome + '" does not select a known branch of this step.'
            return
          }
          fields.outcome = chosen.outcome
          fields.next = chosen.next
        } else {
          if (errorEl) errorEl.textContent = 'This step branches: choose which branch the outcome takes before completing it.'
          return
        }
      }
      runDraft(activeRun, fields)
      draftNote = { run: activeRun.id, kind: fields.kind, name: 'e-' + String((activeRun.events || []).length + 1).padStart(3, '0') }
      render()
    }

    function renderActions(host, state) {
      if (!store) return
      var list = allowedActionsOf(state, activeRun)
      if (!list.length) return
      var box = make('div', 'proc-actions')
      box.appendChild(make('div', 'proc-actions-title', 'Record an event'))
      var err = make('div', 'proc-action-error')
      box.appendChild(err)

      // A branching step needs the human to name the branch: completing it without one
      // would be the AMBIGUOUS_TRANSITION the runner refuses.
      var choices = outcomeChoices(state)
      var select = null
      if (choices.length > 1 && list.indexOf('complete') !== -1) {
        select = make('select', 'proc-action-outcome')
        select.setAttribute('data-proc-outcome', '')
        var blank = make('option', null, 'Choose the branch…')
        blank.setAttribute('value', '')
        select.appendChild(blank)
        choices.forEach(function (c) {
          var o = make('option', null, c.label)
          o.setAttribute('value', c.outcome)
          select.appendChild(o)
        })
        box.appendChild(select)
      }

      list.forEach(function (action) {
        var b = make('button', 'proc-action', ACTION_LABEL[action] || action)
        b.setAttribute('type', 'button')
        b.setAttribute('data-proc-action', action)
        b.addEventListener('click', function () {
          recordAction(action, state, err, select ? select.value : '')
        })
        box.appendChild(b)
      })
      host.appendChild(box)
    }

    function renderDraftNote(host) {
      if (!draftNote || !activeRun || draftNote.run !== activeRun.id) return
      host.appendChild(
        make(
          'div',
          'proc-draft-pending',
          'Draft created: ' + draftNote.name + ' (' + draftNote.kind + '). It is pending until apply_change runs; ' +
            'this view keeps showing the exported state until then.',
        ),
      )
    }

    // ---- Run panel ----
    function renderRunPanel(host) {
      var col = make('div', 'exec-log-col')
      host.appendChild(col)
      var panel = make('div', 'proc-run-state')
      col.appendChild(panel)
      if (!activeRun) {
        panel.appendChild(make('p', null, 'No run selected: the procedure definition. An agent starts a run with procedure_start.'))
        return
      }
      var state = activeRun.state
      panel.appendChild(make('div', 'proc-run-title', 'Run ' + activeRun.id + (activeRun.closed ? ' (closed)' : '')))
      if (!state) {
        panel.appendChild(make('p', null, 'The definition of this procedure is not in this export; its state cannot be folded here.'))
        renderEvents(col)
        return
      }
      panel.appendChild(make('div', 'proc-run-status', 'Status: ' + state.status))
      panel.appendChild(make('div', 'proc-run-current', 'Current step: ' + (state.currentStep ? stepName(state.currentStep) : 'none')))
      panel.appendChild(make('div', 'proc-run-path', 'Path: ' + state.path.map(stepName).join(' → ')))
      if (state.blockedBy) panel.appendChild(make('div', 'proc-run-blocked', 'Blocked: ' + state.blockedBy))
      if (state.crashed) panel.appendChild(make('div', 'proc-run-crashed', 'An engine step started and never reported: the run crashed.'))
      if (state.paused) panel.appendChild(make('div', 'proc-run-paused', 'Paused.'))
      if (state.drift) {
        panel.appendChild(
          make(
            'div',
            'proc-run-drift',
            'Definition changed: the run is pinned to ' + state.drift.pinned + ', the procedure is now ' + state.drift.current + '.',
          ),
        )
      }
      if (state.stale.length) panel.appendChild(make('div', 'proc-run-stale', 'Stale artifacts: ' + state.stale.join(', ')))
      if (state.reopened.length) panel.appendChild(make('div', 'proc-run-reopened', 'Reopened steps: ' + state.reopened.map(stepName).join(', ')))
      if (state.allowedNext.length) {
        panel.appendChild(
          make(
            'div',
            'proc-run-allowed',
            'Allowed next: ' +
              state.allowedNext
                .map(function (tr) {
                  return stepName(tr.to) + ' (' + guardText(tr.guard) + ')'
                })
                .join(', '),
          ),
        )
      }
      var artifactSlugs = Object.keys(state.artifacts)
      if (artifactSlugs.length) panel.appendChild(make('div', 'proc-run-artifacts', 'Artifacts: ' + artifactSlugs.map(artifactLine).join(', ')))
      if (!activeRun.closed && !TERMINAL_RUN[state.status]) {
        var ref = JSON.stringify({ run: activeRun.id })
        panel.appendChild(
          make(
            'div',
            'proc-run-next',
            'Next action (agent): procedure_state ' + ref + ' lists the allowed actions; procedure_record ' + ref.slice(0, -1) + ', "action": …} records ' +
              (state.drift ? 'the rebase onto the new definition.' : state.currentStep ? 'the next fact of step ' + stepName(state.currentStep) + '.' : 'the terminal event.'),
          ),
        )
      }
      renderActions(col, state)
      renderDraftNote(col)
      renderEvents(col)
    }

    function renderEvents(host) {
      var box = make('div', 'proc-run-events exec-log-view')
      host.appendChild(make('div', 'exec-col-header', 'Events'))
      ;(activeRun.events || []).forEach(function (e) {
        var item = make('div', 'audit-item status-' + e.kind)
        var top = make('div', 'audit-time', (e.at || '') + (e.actor ? ' • ' + e.actor : ''))
        item.appendChild(top)
        var text = make('div', 'audit-text')
        text.appendChild(make('span', 'audit-kind', e.kind))
        var bits = []
        if (e.step) bits.push(stepName(e.step))
        if (e.outcome) bits.push('outcome ' + e.outcome)
        if (e.next) bits.push('→ ' + stepName(e.next))
        if (e.field) bits.push(e.field)
        if (e.value) bits.push(e.value)
        if (bits.length) text.appendChild(document.createTextNode(' ' + bits.join(' · ')))
        item.appendChild(text)
        box.appendChild(item)
      })
      host.appendChild(box)
    }

    // ---- Render ----
    function render() {
      renderTabs()
      renderDiagnostics()
      body.innerHTML = ''
      renderFicha(body)
      renderRunList(body)
      if (!active.graph) {
        body.appendChild(make('div', 'empty-state', 'The definition of ' + active.file + ' is not in this export.'))
        var ws0 = make('div', 'exec-workspace')
        body.appendChild(ws0)
        if (activeRun) renderRunPanel(ws0)
        return
      }
      var ws = make('div', 'exec-workspace')
      body.appendChild(ws)
      renderGraph(ws)
      renderStepCard(ws)
      renderRunPanel(ws)
    }

    selectEntry(active)
    render()

    return {
      ok: true,
      procedures: entries.length,
      steps: Object.keys(stepsOf(active)).length,
      matrices: matrices.length,
      unmount: function () {
        container.innerHTML = ''
      },
    }
  }

  return {
    version: RENDERER_VERSION,
    RENDERER_VERSION: RENDERER_VERSION,
    mount: mount,
  }
})
