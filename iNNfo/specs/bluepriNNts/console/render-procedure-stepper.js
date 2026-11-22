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

  var RENDERER_VERSION = '0.3.1'

  // The console draws icons from `nnIcons`, which renders each path once into a per-document
  // sprite and every instance as a `<use>`. `nnVisuals.iconSvg` was the older path and the
  // console no longer populates it, so a view that kept calling it drew nothing at all.
  // Looked up the same way nn-runtime does (`typeof nnIcons !== 'undefined'`), because the
  // sprite hangs off the document; a missing `document` falls back to inline paths.
  function vIcon(name, size) {
    var icons = typeof nnIcons !== 'undefined' ? nnIcons : GLOBAL.nnIcons
    if (icons && typeof icons.getSvg === 'function') return icons.getSvg(name, { size: size || 14 })
    return ''
  }

  var TERMINAL_RUN = { completed: true, failed: true, cancelled: true }

  function mount(container, payload, viewCtx) {
    if (!container || typeof container.querySelector !== 'function') {
      return { ok: false, reason: 'no-container' }
    }
    // `document` is shadowed with the container's own document, so every element below
    // stays inside this view's DOM tree.
    var document =
      container.ownerDocument || (typeof globalThis !== 'undefined' ? globalThis.document : null)
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
    var store =
      viewCtx && viewCtx.store && typeof viewCtx.store.propose === 'function' ? viewCtx.store : null
    var draftNote = null

    if (!GLOBAL.nnConsole) {
      container.innerHTML =
        '<div class="nn-empty-state"><p>Procedure runtime is not available.</p></div>'
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
    strip.appendChild(
      make('div', 'proc-structure-summary', entries.length + ' procedures · ' + runCount + ' runs'),
    )
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

    // ---- Step Requests: what a person asked the runner to record ----
    // A request is intent, never state (executions spec, "Requests, not writes"). This view
    // reads the `Step Request` rows the run model already holds and shows what happened to
    // each one; it never writes. Only procedure_record consumes a request.
    function requestsOf(run) {
      if (!run || !run.requests || typeof run.requests !== 'object') return []
      // The runner reads the rows as a map (slug -> row); the view lists them in slug order.
      return Object.keys(run.requests)
        .sort()
        .map(function (id) {
          var row = run.requests[id] || {}
          return {
            id: id,
            action: row.action,
            status: row.status,
            step: row.step,
            baseSeq: row.baseSeq,
            outcome: row.outcome,
            value: row.value,
            reason: row.reason,
            at: row.at,
          }
        })
        .filter(function (r) {
          return r && r.action && r.status
        })
    }

    /** The pending request for one step, if a person already asked for something there. */
    function pendingRequestFor(step) {
      return requestsOf(activeRun).filter(function (r) {
        return r.status === 'pending' && r.step === step
      })[0]
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
          {
            model: meta.modelId || '',
            id: target.id,
            label: target.name || label,
            concept: target.concept,
            color: cMeta && cMeta.color,
          },
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
        if (match.index > last)
          hostEl.appendChild(document.createTextNode(text.slice(last, match.index)))
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
        var b = make(
          'button',
          'proc-tab' + (entry === active ? ' active' : ''),
          entry.title || entry.file,
        )
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
      var list =
        active.graph && Array.isArray(active.graph.diagnostics) ? active.graph.diagnostics : []
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
        if (
          el &&
          el.concept === 'Procedure' &&
          el.fields &&
          el.fields.procedure_model === active.file
        )
          linked = linked || el
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
        if (f[pair[0]])
          ficha.appendChild(make('div', 'proc-ficha-' + pair[0], pair[1] + ': ' + f[pair[0]]))
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
      var def = make(
        'button',
        'proc-run proc-run-definition' + (activeRun ? '' : ' active'),
        'Definition',
      )
      def.setAttribute('type', 'button')
      def.addEventListener('click', function () {
        activeRun = null
        selectedStep = null
        render()
      })
      bar.appendChild(def)
      runs.forEach(function (run) {
        var b = make(
          'button',
          'proc-run' + (run === activeRun ? ' active' : ''),
          run.id + ' · ' + runStatus(run),
        )
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
          'dag-node ' +
            status +
            (step.stepType === 'decision' ? ' decision' : '') +
            (slug === current ? ' current' : '') +
            (slug === selectedStep ? ' selected' : ''),
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
        sub.textContent =
          (step.stepType || 'task').toUpperCase() +
          (step.executor ? ' · ' + step.executor : '') +
          (status !== 'definition' ? ' · ' + status : '')
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
      if (guard.kind === 'artifact')
        return guard.artifact + ' validated (' + (guard.holds ? 'holds' : 'not yet') + ')'
      return guard.text
    }

    /**
     * One artifact as a chip: its name, the state the fold gave it, and the file it lives in.
     * The chip is what a person can act on — the artifact is a file, not a model element, so
     * the useful affordances are "which step produced it" and "open the file".
     */
    function artifactChip(slug) {
      var def = active.graph.artifacts[slug] || {}
      var st = activeRun && activeRun.state ? activeRun.state.artifacts[slug] : null
      var chip = make('div', 'proc-artifact')
      chip.setAttribute('data-proc-artifact', slug)
      if (st) chip.setAttribute('data-status', st.status)
      chip.appendChild(make('span', 'proc-artifact-name', def.name || slug))

      var producer = (def.producers || [])[0] || (st && st.step) || null
      if (producer && stepsOf(active)[producer]) {
        var jump = make('button', 'proc-artifact-producer', 'produced by ' + stepName(producer))
        jump.setAttribute('type', 'button')
        jump.addEventListener('click', function () {
          selectedStep = producer
          render()
        })
        chip.appendChild(jump)
      }
      if (st) {
        chip.appendChild(
          make('span', 'proc-artifact-state', st.status + (st.rev ? ' · rev ' + st.rev : '')),
        )
      }
      var path = verifyPathOf(def)
      // An artifact the run has not produced yet has no file to open: offering one invites a
      // click that can only fail. The name and the state already say it is still expected.
      var exists = st && st.status !== 'expected' && st.status !== 'not_required'
      if (path && exists) {
        var open = make('button', 'proc-artifact-open', 'Open ' + path)
        open.setAttribute('type', 'button')
        open.setAttribute('title', 'Open ' + path + ' from the domain folder')
        open.addEventListener('click', function () {
          openArtifactFile(path, open)
        })
        chip.appendChild(open)
      } else if (path) {
        chip.appendChild(make('span', 'proc-artifact-pending', 'not produced yet'))
      }
      return chip
    }

    /** The file an artifact names, when its `verify` points at one. */
    function verifyPathOf(def) {
      if (!def || typeof def.verify !== 'string') return ''
      var m = /^file:\s*(.+)$/.exec(def.verify.trim())
      return m ? m[1].trim() : ''
    }

    /**
     * Opens the artifact's file. The console is static HTML, so it cannot read a local path on
     * its own: it opens the domain folder once through the same picker the changeset writer
     * uses, then reads and shows that one file. Nothing is written, and a refused permission
     * leaves the chip saying so.
     */
    function openArtifactFile(path, button) {
      // The page this view is mounted in owns the picker, not whatever global the module was
      // first loaded under: a view can be mounted into a different document.
      var host = (document && document.defaultView) || GLOBAL
      var fsa = host.nnFsa
      var rt = host.nnConsole
      var writer = null
      if (fsa && typeof fsa.createWriter === 'function') {
        writer = fsa.createWriter({ win: host })
      } else if (rt && typeof rt.fsaWriter === 'function') {
        writer = rt.fsaWriter()
      }
      if (!writer || typeof writer.connect !== 'function') {
        button.textContent = 'Open ' + path + ' — folder access is not available in this browser'
        button.disabled = true
        return
      }
      button.disabled = true
      button.textContent = 'Opening ' + path + '…'
      writer
        .connect(meta.domainId)
        .then(function (res) {
          if (!res || !res.ok) {
            button.textContent = 'Open ' + path + ' — ' + ((res && res.reason) || 'failed')
            button.disabled = false
            return
          }
          return readDomainFile(res.handle, path).then(function (text) {
            // The chip already knows which artifact this is; deriving it from the file name
            // would guess (a file `draft.md` can back an artifact named `draft-doc`).
            showArtifact(defOfArtifact(button) || null, path, text)
            button.textContent = 'Open ' + path
            button.disabled = false
          })
        })
        .catch(function () {
          button.textContent = 'Open ' + path + ' — could not read it'
          button.disabled = false
        })
    }

    /** The artifact definition the chip that owns this button was built for. */
    function defOfArtifact(button) {
      var chip = button.parentNode
      while (chip && chip.getAttribute && !chip.getAttribute('data-proc-artifact'))
        chip = chip.parentNode
      var slug = chip && chip.getAttribute('data-proc-artifact')
      return slug && active.graph.artifacts ? active.graph.artifacts[slug] : null
    }

    /** Reads one file under the connected domain folder, by its `/`-separated path. */
    function readDomainFile(handle, path) {
      var parts = String(path)
        .split('/')
        .filter(function (p) {
          return p && p !== '.'
        })
      var name = parts.pop()
      // The chain must thread the resolved directory through, not close over a mutated var:
      // a `var` in a `.then` callback reads its final value, so every hop would look at the
      // last path segment.
      var dir = parts.reduce(function (p, segment) {
        return p.then(function (d) {
          return d.getDirectoryHandle(segment)
        })
      }, Promise.resolve(handle))
      return dir
        .then(function (d) {
          return d.getFileHandle(name)
        })
        .then(function (f) {
          return f.getFile()
        })
        .then(function (file) {
          return file.text()
        })
    }

    /** Shows the file's content in a panel inside the view: it reads, it never writes. */
    function showArtifact(def, path, text) {
      var host = container.querySelector('.proc-artifact-view')
      if (!host) {
        host = make('div', 'proc-artifact-view')
        root.appendChild(host)
      }
      host.innerHTML = ''
      var head = make('div', 'proc-artifact-view-head')
      head.appendChild(make('span', 'proc-artifact-view-title', (def && def.name) || path))
      var close = make('button', 'proc-artifact-view-close', 'Close')
      close.setAttribute('type', 'button')
      close.addEventListener('click', function () {
        host.remove()
      })
      head.appendChild(close)
      host.appendChild(head)
      host.appendChild(make('div', 'proc-artifact-view-path', path))
      var body = make('pre', 'proc-artifact-view-body', text === '' ? '(empty file)' : text)
      host.appendChild(body)
    }

    /**
     * A labeled row of artifact chips. A step with no artifacts prints nothing, so the card
     * never shows an empty "Inputs:" line that reads like a missing value.
     */
    function renderArtifactRow(host, label, slugs) {
      if (!Array.isArray(slugs) || !slugs.length) return
      var row = make('div', 'proc-artifact-row')
      row.setAttribute('data-proc-artifact-row', label.toLowerCase())
      row.appendChild(make('div', 'proc-artifact-row-label', label))
      var list = make('div', 'proc-artifact-list')
      slugs.forEach(function (slug) {
        list.appendChild(artifactChip(slug))
      })
      row.appendChild(list)
      host.appendChild(row)
    }

    function renderStepCard(host) {
      var graph = active.graph
      var slug =
        selectedStep ||
        (activeRun && activeRun.state && activeRun.state.currentStep) ||
        graph.start ||
        Object.keys(graph.steps)[0]
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
      if (step.executor)
        head.appendChild(make('span', 'step-executor-pill', 'Executor: ' + step.executor))
      if (step.condition) head.appendChild(make('span', 'step-cond-pill', 'IF: ' + step.condition))
      head.appendChild(
        make(
          'span',
          'step-state-badge state-' + status,
          status === 'definition' ? 'Definition' : status,
        ),
      )
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
      renderArtifactRow(facts, 'Inputs', step.inputs)
      renderArtifactRow(facts, 'Outputs', step.outputs)
      if (st) {
        fact('Attempt', st.attempt ? String(st.attempt) : '')
        fact('Waiting on', st.waitingOn)
        fact('Failure', st.failure)
        if (st.outcome || st.next)
          fact('Outcome', (st.outcome || '—') + (st.next ? ' → ' + stepName(st.next) : ''))
      }
      if (facts.children.length) card.appendChild(facts)
      renderRequestBox(card, slug)
      if (step.next.length > 1) {
        var branches = make('div', 'branch-outcomes')
        step.next.forEach(function (t) {
          var target = graph.steps[t]
          branches.appendChild(
            make(
              'div',
              'branch-outcome',
              stepName(t) + ' — ' + ((target && target.condition) || 'no guard'),
            ),
          )
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

    /**
     * The request a person made on this step, and what became of it. A step with no request
     * prints nothing. The badge is the answer the runner gave: pending means nobody consumed
     * it, done means the action landed, stale and rejected carry the reason.
     */
    function renderRequestBox(card, slug) {
      var mine = requestsOf(activeRun).filter(function (r) {
        return r.step === slug
      })
      if (!mine.length) return
      var box = make('div', 'proc-request-box')
      box.setAttribute('data-proc-request', slug)
      mine.forEach(function (r) {
        var row = make('div', 'proc-request')
        row.setAttribute('data-proc-request-status', r.status)
        var head = make('div', 'proc-request-head')
        head.appendChild(make('span', 'proc-request-action', r.action))
        head.appendChild(make('span', 'proc-request-status status-' + r.status, r.status))
        row.appendChild(head)
        var bits = []
        if (r.value) bits.push(r.value)
        if (r.outcome) bits.push('outcome ' + r.outcome)
        if (r.baseSeq !== undefined) bits.push('seq ' + r.baseSeq)
        if (r.reason) bits.push(r.reason)
        if (bits.length) row.appendChild(make('div', 'proc-request-detail', bits.join(' · ')))
        box.appendChild(row)
      })
      card.appendChild(box)
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
    /**
     * Records a `Step Request` for the runner to consume. This is a proposal, not a write to
     * the run: the row is intent, and only `procedure_record` acts on it. The `base_seq` pins
     * the state the person saw, so a request that arrives late is marked stale, not applied.
     */
    function runRequest(run, fields) {
      var name = 'q-' + String(requestsOf(run).length + 1).padStart(3, '0')
      return store.propose({
        kind: 'new',
        knowledge_id: run.id,
        concept: 'Step Request',
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

    /** The run's write counter: the seq a request pins, 0 when the export carried none. */
    function runSeq() {
      return activeRun && typeof activeRun.seq === 'number' ? activeRun.seq : 0
    }

    function recordAction(action, state, errorEl, pickedOutcome, host) {
      if (errorEl) errorEl.textContent = ''
      var step = state.currentStep
      var fields = {
        request_status: 'pending',
        action: action,
        step: step,
        base_seq: runSeq(),
      }
      if (action === 'fail' || action === 'wait') {
        // The value the runner needs (who it waits on, why it failed) comes from the field the
        // action row renders. A missing one refuses the request instead of sending a blank one.
        var field = host && host.querySelector ? host.querySelector('[data-proc-request-value]') : null
        var given = field && field.value ? String(field.value).trim() : ''
        if (!given) {
          if (errorEl)
            errorEl.textContent =
              action === 'wait'
                ? 'A waiting step names who or what it waits on.'
                : 'A failed step names why it failed.'
          return
        }
        fields.requested_value = given
      }
      if (action === 'complete') {
        var targets = Array.isArray(state.allowedNext) ? state.allowedNext : []
        if (targets.length > 1) {
          if (!pickedOutcome) {
            if (errorEl)
              errorEl.textContent =
                'This step branches: choose which branch the outcome takes before completing it.'
            return
          }
          var chosen = outcomeChoices(state).filter(function (c) {
            return c.outcome === pickedOutcome
          })[0]
          if (!chosen) {
            if (errorEl)
              errorEl.textContent =
                '"' + pickedOutcome + '" does not select a known branch of this step.'
            return
          }
          fields.requested_outcome = chosen.outcome
        }
      }
      var saved
      try {
        saved = runRequest(activeRun, fields)
      } catch (err) {
        // The console refuses the proposal (a read-only export, a malformed draft). Say
        // so here: an exception thrown under a click is invisible otherwise, and the
        // person is left wondering why nothing happened.
        if (errorEl)
          errorEl.textContent =
            'The console refused this request: ' + String(err && err.message ? err.message : err)
        return
      }
      if (!saved) {
        if (errorEl) errorEl.textContent = 'The console did not accept this request.'
        return
      }
      draftNote = {
        run: activeRun.id,
        kind: 'request',
        name: 'q-' + String(requestsOf(activeRun).length + 1).padStart(3, '0'),
      }
      render()
    }

    function renderActions(host, state) {
      if (!store) return
      var list = allowedActionsOf(state, activeRun)
      if (!list.length) return
      var box = make('div', 'proc-actions')
      box.appendChild(make('div', 'proc-actions-title', 'Ask the runner'))
      var err = make('div', 'proc-action-error')
      box.appendChild(err)

      // A step a person already asked about shows the ask and stays disabled: a second
      // request on the same step would be a second intent for one decision.
      var waiting = state.currentStep ? pendingRequestFor(state.currentStep) : null
      if (waiting) {
        var note = make(
          'div',
          'proc-action-waiting',
          'Waiting for the agent: a "' +
            waiting.action +
            '" request on this step is pending. It acts on procedure_record.',
        )
        note.setAttribute('data-proc-waiting', waiting.action)
        box.appendChild(note)
        host.appendChild(box)
        return
      }

      // Only the actions a request can carry: the queue never closes a run.
      var askable = list.filter(function (a) {
        return a === 'wait' || a === 'complete' || a === 'fail'
      })
      if (!askable.length) {
        box.appendChild(
          make(
            'div',
            'proc-action-note',
            'This step is recorded by the runner; the console has nothing to ask here.',
          ),
        )
        host.appendChild(box)
        return
      }

      // A branching step needs the human to name the branch: completing it without one
      // would be the AMBIGUOUS_TRANSITION the runner refuses.
      var choices = outcomeChoices(state)
      var select = null
      if (choices.length > 1 && askable.indexOf('complete') !== -1) {
        select = make('select', 'proc-action-outcome')
        select.setAttribute('data-proc-outcome', '')
        var blank = make('option', null, 'Choose the branch.')
        blank.setAttribute('value', '')
        select.appendChild(blank)
        choices.forEach(function (c) {
          var o = make('option', null, c.label)
          o.setAttribute('value', c.outcome)
          select.appendChild(o)
        })
        box.appendChild(select)
      }

      // A wait or a fail needs a value: the field is rendered here, so the click reads it
      // instead of opening a blocking dialog.
      if (askable.indexOf('wait') !== -1 || askable.indexOf('fail') !== -1) {
        var valueField = make('input', 'proc-action-value')
        valueField.setAttribute('type', 'text')
        valueField.setAttribute('data-proc-request-value', '')
        valueField.setAttribute('placeholder', 'who it waits on, or why it failed')
        box.appendChild(valueField)
      }

      askable.forEach(function (action) {
        var b = make('button', 'proc-action', ACTION_LABEL[action] || action)
        b.setAttribute('type', 'button')
        b.setAttribute('data-proc-action', action)
        b.addEventListener('click', function () {
          recordAction(action, state, err, select ? select.value : '', box)
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
          'Draft created: ' +
            draftNote.name +
            ' (' +
            draftNote.kind +
            '). It is pending until apply_change runs; ' +
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
        panel.appendChild(
          make(
            'p',
            null,
            'No run selected: the procedure definition. An agent starts a run with procedure_start.',
          ),
        )
        return
      }
      var state = activeRun.state
      panel.appendChild(
        make(
          'div',
          'proc-run-title',
          'Run ' + activeRun.id + (activeRun.closed ? ' (closed)' : ''),
        ),
      )
      if (!state) {
        panel.appendChild(
          make(
            'p',
            null,
            'The definition of this procedure is not in this export; its state cannot be folded here.',
          ),
        )
        renderRequestQueue(col)
        return
      }
      panel.appendChild(make('div', 'proc-run-status', 'Status: ' + state.status))
      panel.appendChild(
        make(
          'div',
          'proc-run-current',
          'Current step: ' + (state.currentStep ? stepName(state.currentStep) : 'none'),
        ),
      )
      panel.appendChild(
        make('div', 'proc-run-path', 'Path: ' + state.path.map(stepName).join(' → ')),
      )
      if (state.blockedBy)
        panel.appendChild(make('div', 'proc-run-blocked', 'Blocked: ' + state.blockedBy))
      if (state.crashed)
        panel.appendChild(
          make(
            'div',
            'proc-run-crashed',
            'An engine step started and never reported: the run crashed.',
          ),
        )
      if (state.paused) panel.appendChild(make('div', 'proc-run-paused', 'Paused.'))
      if (state.drift) {
        panel.appendChild(
          make(
            'div',
            'proc-run-drift',
            'Definition changed: the run is pinned to ' +
              state.drift.pinned +
              ', the procedure is now ' +
              state.drift.current +
              '.',
          ),
        )
      }
      if (state.stale.length)
        panel.appendChild(
          make('div', 'proc-run-stale', 'Stale artifacts: ' + state.stale.join(', ')),
        )
      if (state.reopened.length)
        panel.appendChild(
          make(
            'div',
            'proc-run-reopened',
            'Reopened steps: ' + state.reopened.map(stepName).join(', '),
          ),
        )
      // "Allowed next" is what the step's guards permit, which is meaningless when the fold
      // says the run cannot advance. A blocked step would read as if its branches were open.
      if (
        state.allowedNext.length &&
        !state.blockedBy &&
        !state.drift &&
        !TERMINAL_RUN[state.status]
      ) {
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
      if (artifactSlugs.length) {
        var artBox = make('div', 'proc-run-artifacts')
        artBox.appendChild(make('div', 'proc-run-artifacts-label', 'Artifacts'))
        var artList = make('div', 'proc-artifact-list')
        artifactSlugs.forEach(function (slug) {
          artList.appendChild(artifactChip(slug))
        })
        artBox.appendChild(artList)
        panel.appendChild(artBox)
      }
      if (!activeRun.closed && !TERMINAL_RUN[state.status]) {
        var ref = JSON.stringify({ run: activeRun.id })
        panel.appendChild(
          make(
            'div',
            'proc-run-next',
            'Next action (agent): procedure_state ' +
              ref +
              ' lists the allowed actions; procedure_record ' +
              ref.slice(0, -1) +
              ', "action": …} records ' +
              (state.drift
                ? 'the rebase onto the new definition.'
                : state.currentStep
                  ? 'the next fact of step ' + stepName(state.currentStep) + '.'
                  : 'the terminal event.'),
          ),
        )
      }
      renderActions(col, state)
      renderDraftNote(col)
      renderRequestQueue(col)
    }

    /**
     * The queue of requests on this run, oldest first, with the status the runner gave each
     * one. It is the same list `procedure_pending` returns: an agent drains it, a person reads
     * what happened to what they asked for.
     */
    function renderRequestQueue(host) {
      var all = requestsOf(activeRun)
      if (!all.length) return
      var box = make('div', 'proc-run-requests')
      host.appendChild(make('div', 'exec-col-header', 'Requests'))
      all.forEach(function (r) {
        var item = make('div', 'request-item status-' + r.status)
        item.setAttribute('data-proc-request-id', r.id)
        item.setAttribute('data-proc-request-status', r.status)
        var text = make('div', 'request-text')
        text.appendChild(make('span', 'request-kind', r.action))
        item.appendChild(text)
        item.appendChild(make('span', 'request-status status-' + r.status, r.status))
        var bits = []
        if (r.step) bits.push(stepName(r.step))
        if (r.value) bits.push(r.value)
        if (r.outcome) bits.push('outcome ' + r.outcome)
        if (r.baseSeq !== undefined) bits.push('seq ' + r.baseSeq)
        if (bits.length) item.appendChild(make('div', 'request-detail', bits.join(' · ')))
        if (r.reason) item.appendChild(make('div', 'request-reason', r.reason))
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
        body.appendChild(
          make(
            'div',
            'empty-state',
            'The definition of ' + active.file + ' is not in this export.',
          ),
        )
        var ws0 = make('div', 'exec-workspace')
        body.appendChild(ws0)
        if (activeRun) renderRunPanel(ws0)
        return
      }
      var ws = make('div', 'exec-workspace')
      body.appendChild(ws)
      // The model is the state: the fold already ran when the run was read, so the graph, the
      // step card and the panel all read the same rows. Nothing is projected from drafts.
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
