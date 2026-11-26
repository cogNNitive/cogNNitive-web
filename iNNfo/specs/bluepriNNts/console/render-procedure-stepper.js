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
   * Procedure runner view. It shows what nn-core derived at export time: `payload.model.
   * procedureGraphs` holds one entry per procedure document, with the graph from
   * `procedureGraph` and every run of the domaiNN (`executions/<run>/`) folded by `foldRun`.
   *
   * A person runs the HUMAN steps from here (decide, complete, fail, ask for a new run). Each
   * answer is a draft (a `Step Request`, or a `run_start`), never a write to the run: the
   * console travels as a standalone file, the person saves it with the drafts inside and sends
   * it back, and the domain owner's agent imports it (`import_console`). Until then the view
   * projects the run "as if my answers were applied" with the same `foldRun` (the
   * `nnProcedureCore` slot), so the run visibly advances and every answer can be undone.
   * Engine and agent steps never run in the browser: the view says so.
   */

  var GLOBAL =
    typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? globalThis
          : this

  var RENDERER_VERSION = '0.4.0'

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

  var MARK_SYMBOLS = {
    done: '✓',
    failed: '✕',
    waiting: '◍',
    pending: '○',
    active: '▶',
    definition: '·',
    off_path: '—',
  }

  /** The slot types a start form can draw: the editor's own field types. */
  var START_TYPES = [
    'string',
    'number',
    'boolean',
    'select',
    'multiselect',
    'reference',
    'markdown',
    'markdown_inline',
  ]

  /** The sentence an engine or agent step shows: the browser never runs it (S2). */
  var SYSTEM_STEP_NOTE =
    'No action for you on this step. The agent or Runner handles it outside this HTML.'

  // ---- Pure helpers (exported for tests) ----

  /** A `{name}` placeholder in prose, a command or a path. */
  var SLOT_RE = /\{([A-Za-z_][\w-]*)\}/g

  /** The slot values of a run as strings; `{run}` is the built-in run id. */
  function slotValuesOf(run) {
    var out = {}
    var params = run && run.params && typeof run.params === 'object' ? run.params : {}
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) out[k] = String(params[k])
    })
    if (run && run.id) out.run = String(run.id)
    return out
  }

  /**
   * Replaces every `{name}` with the run's value. A placeholder with no value (the definition,
   * or a slot the run never set) is shown as `‹name›`, never as raw braces that read like a
   * broken template.
   */
  function fillSlots(text, values) {
    if (text === undefined || text === null) return ''
    var v = values || {}
    return String(text).replace(SLOT_RE, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(v, name) ? v[name] : '‹' + name + '›'
    })
  }

  /** A hash shown short (8 characters); the full value stays in the title. */
  function shortHash(value) {
    var s = String(value == null ? '' : value)
    return /^[0-9a-f]{12,}$/i.test(s) ? s.slice(0, 8) : s
  }

  /** "approve" -> "Approve", "needs-change" -> "Needs change". */
  function labelOfToken(token) {
    var s = String(token || '').replace(/[-_]+/g, ' ')
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  }

  function isSystemStep(step) {
    return !!step && (step.executor === 'engine' || step.executor === 'agent')
  }

  function isHumanStep(step) {
    return !!step && step.executor === 'human'
  }

  /** The proposed fields of a draft, parsed. */
  function draftFields(d) {
    var fields = d && d.proposed
    if (typeof fields === 'string') {
      try {
        fields = JSON.parse(fields)
      } catch {
        return null
      }
    }
    return fields && typeof fields === 'object' ? fields : null
  }

  /** The unsent Step Requests a draft list holds for one run, oldest first. */
  function draftRequestsFor(drafts, runId) {
    var out = []
    ;(Array.isArray(drafts) ? drafts : []).forEach(function (d) {
      if (!d || d.concept !== 'Step Request') return
      if (String(d.knowledge_id) !== String(runId)) return
      var fields = draftFields(d)
      if (!fields) return
      out.push({
        id: d.element_slug || d.element || 'draft',
        draftId: d.id,
        action: fields.action,
        status: fields.request_status || 'pending',
        step: fields.step,
        baseSeq: fields.base_seq,
        outcome: fields.requested_outcome,
        value: fields.requested_value,
        isDraft: true,
      })
    })
    return out
  }

  /** The recorded requests of a run, in slug order. */
  function recordedRequestsOf(run) {
    if (!run || !run.requests || typeof run.requests !== 'object') return []
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

  /** The step a completed request moves to: the branch its outcome selects, or the only one. */
  function nextOf(graph, state, step, outcome) {
    var targets =
      state && state.currentStep === step && Array.isArray(state.allowedNext)
        ? state.allowedNext
        : []
    if (outcome) {
      for (var i = 0; i < targets.length; i++) {
        var g = targets[i].guard
        if (g && g.kind === 'outcome' && g.token === outcome) return targets[i].to
      }
    }
    if (targets.length === 1) return targets[0].to
    var def = graph && graph.steps ? graph.steps[step] : null
    if (def && Array.isArray(def.next) && def.next.length === 1) return def.next[0]
    return undefined
  }

  /** The fold events an unsent request would cause once the runner records it. */
  function eventsOfRequests(graph, run, requests) {
    var events = []
    var rows = (run && run.model && run.model.steps) || {}
    ;(requests || []).forEach(function (r) {
      if (!r || !r.step) return
      if (r.action === 'complete') {
        var ev = { kind: 'step_completed', step: r.step }
        if (r.outcome) ev.outcome = r.outcome
        var next = nextOf(graph, run && run.state, r.step, r.outcome)
        if (next) ev.next = next
        events.push(ev)
      } else if (r.action === 'fail') {
        events.push({ kind: 'step_failed', step: r.step, value: r.value || '' })
      } else if (r.action === 'wait') {
        events.push({ kind: 'step_waiting', step: r.step, value: r.value || '' })
      } else if (r.action === 'start') {
        var row = rows[r.step]
        events.push({
          kind: 'step_started',
          step: r.step,
          attempt: ((row && row.attempt) || 0) + 1,
        })
      }
    })
    return events
  }

  /**
   * The run as it would be with these unsent requests applied: the same nn-core fold the
   * exporter ran, over the recorded rows plus the request events. Null when no fold is wired
   * (a console exported without the slot), so a caller can tell "no projection" apart.
   */
  function projectRun(core, graph, run, requests) {
    if (!core || typeof core.project !== 'function' || !graph || !run) return null
    if (typeof core.available === 'function' && !core.available()) return null
    if (!Array.isArray(requests) || !requests.length) return null
    try {
      return core.project(
        { graph: graph, model: run.model, events: run.events },
        requests,
        run.defRev ? { defRev: run.defRev } : {},
      )
    } catch {
      return null
    }
  }

  var INBOX_RANK = { waiting: 0, active: 1, pending: 2, handoff: 3 }

  /**
   * A completed run a person took part in (a human step done on its path) whose final
   * handoff nobody chose yet, neither recorded by an import nor drafted here: its last turn is
   * theirs.
   */
  function awaitsHandoff(entry, run, drafts) {
    var state = run && run.state
    if (!state || state.status !== 'completed' || run.handoff) return false
    var human = (state.path || []).some(function (slug) {
      var row = state.steps && state.steps[slug]
      return isHumanStep(entry.graph.steps[slug]) && !!row && row.status === 'done'
    })
    if (!human) return false
    return !(Array.isArray(drafts) ? drafts : []).some(function (d) {
      return d && d.kind === 'run_handoff' && String(d.run) === String(run.id)
    })
  }

  /**
   * "Your turn": every open run whose current step is a human step nobody answered yet,
   * neither recorded nor drafted, then every completed run waiting on the person's handoff.
   * Waiting steps first, then active, then not started, then handoffs; ties by procedure
   * file, then run id.
   */
  function inboxOf(entries, drafts) {
    var items = []
    ;(Array.isArray(entries) ? entries : []).forEach(function (entry) {
      if (!entry || !entry.graph) return
      ;(Array.isArray(entry.runs) ? entry.runs : []).forEach(function (run) {
        var state = run && run.state
        if (awaitsHandoff(entry, run, drafts)) {
          items.push({
            entry: entry,
            run: run,
            step: '',
            stepName: 'Hand off this run',
            status: 'handoff',
            question: 'The run is complete. Choose what happens with its result.',
          })
          return
        }
        if (!state || run.closed || TERMINAL_RUN[state.status] || state.drift || state.paused)
          return
        var slug = state.currentStep
        var step = slug ? entry.graph.steps[slug] : null
        if (!isHumanStep(step)) return
        var answered = recordedRequestsOf(run)
          .concat(draftRequestsFor(drafts, run.id))
          .some(function (r) {
            return r.status === 'pending' && r.step === slug
          })
        if (answered) return
        var row = state.steps && state.steps[slug]
        var status = row ? row.status : 'pending'
        var values = slotValuesOf(run)
        items.push({
          entry: entry,
          run: run,
          step: slug,
          stepName: step.name || slug,
          status: status,
          question: step.decision ? fillSlots(step.decision, values) : '',
        })
      })
    })
    items.sort(function (a, b) {
      var ra = INBOX_RANK[a.status] !== undefined ? INBOX_RANK[a.status] : 3
      var rb = INBOX_RANK[b.status] !== undefined ? INBOX_RANK[b.status] : 3
      if (ra !== rb) return ra - rb
      if (a.entry.file !== b.entry.file) return a.entry.file < b.entry.file ? -1 : 1
      return String(a.run.id) < String(b.run.id) ? -1 : String(a.run.id) > String(b.run.id) ? 1 : 0
    })
    return items
  }

  function mount(container, payload, viewCtx) {
    if (!container || typeof container.querySelector !== 'function') {
      return { ok: false, reason: 'no-container' }
    }
    // `document` is shadowed with the container's own document, so every element below
    // stays inside this view's DOM tree.
    var document =
      container.ownerDocument || (typeof globalThis !== 'undefined' ? globalThis.document : null)
    var host = (document && document.defaultView) || GLOBAL
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
    var changeset = viewCtx && viewCtx.changeset ? viewCtx.changeset : null

    var runtime = host.nnConsole || GLOBAL.nnConsole
    if (!runtime) {
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

    function button(className, text, onClick, attrs) {
      var b = make('button', className, text)
      b.setAttribute('type', 'button')
      Object.keys(attrs || {}).forEach(function (k) {
        b.setAttribute(k, attrs[k])
      })
      if (onClick) b.addEventListener('click', onClick)
      return b
    }

    function core() {
      var c = host.nnProcedureCore || GLOBAL.nnProcedureCore
      if (
        c &&
        typeof c.useFromDocument === 'function' &&
        typeof c.available === 'function' &&
        !c.available()
      ) {
        c.useFromDocument(document)
      }
      return c && typeof c.project === 'function' ? c : null
    }

    function allDrafts() {
      if (!store || typeof store.drafts !== 'function') return []
      var list = store.drafts()
      return Array.isArray(list) ? list : []
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

    var responseHost = make('div', 'proc-response-host')
    root.appendChild(responseHost)
    var inboxHost = make('div', 'proc-inbox-host')
    root.appendChild(inboxHost)
    var tabsHost = make('div', 'proc-tabs')
    var body = make('div', 'proc-body')
    root.appendChild(body)

    var active = entries[0]
    var activeRun = null
    var selectedStep = null
    var activeTab = 'flow'
    var runFilter = 'all'
    var startFormOpen = false
    var savedNote = null
    var actionError = ''
    // What the person wrote for a step's outputs, by run, step and artifact: render() rebuilds
    // the DOM, and an unsent deliverable must survive it.
    var outputDrafts = {}

    function selectEntry(entry, run) {
      active = entry
      var runs = Array.isArray(entry.runs) ? entry.runs : []
      activeRun = run || (runs.length ? runs[0] : null)
      selectedStep = null
      startFormOpen = false
    }

    function stepsOf(entry) {
      return entry && entry.graph && entry.graph.steps ? entry.graph.steps : {}
    }

    // ---- Requests: what a person asked the runner to record ----
    // A request is intent, never state (executions spec, "Requests, not writes"). The view
    // reads the `Step Request` rows the run model holds and the drafts this console holds, and
    // shows what happened to each one. Only procedure_record consumes a request.
    function requestsOf(run) {
      return recordedRequestsOf(run)
    }

    function draftRequestsOf(run) {
      if (!store || !run) return []
      return draftRequestsFor(allDrafts(), run.id)
    }

    /** The pending request for one step, if a person already asked for something there. */
    function pendingRequestFor(run, step) {
      var inRun = requestsOf(run).filter(function (r) {
        return r.status === 'pending' && r.step === step
      })[0]
      if (inRun) return inRun
      var inDrafts = draftRequestsOf(run).filter(function (r) {
        return r.status === 'pending' && r.step === step
      })[0]
      return inDrafts || null
    }

    /** The run as the person's unsent answers would leave it, or null when nothing is unsent. */
    function projectedStateOf(entry, run) {
      if (!run || !entry || !entry.graph) return null
      var drafts = draftRequestsOf(run)
      if (!drafts.length) return null
      return projectRun(core(), entry.graph, run, drafts)
    }

    /** The state every part of the view reads: the projection when there is one. */
    function viewState() {
      if (!activeRun) return null
      return projectedStateOf(active, activeRun) || activeRun.state || null
    }

    function stepName(slug) {
      var s = stepsOf(active)[slug]
      return s ? s.name || slug : slug
    }

    function values() {
      return slotValuesOf(activeRun)
    }

    function elementOf(slug) {
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i]
        if (el && el.slug === slug && el.modelFile === active.file) return el
      }
      return null
    }

    // ---- Blueprint procedure catalog (parent + includes): `usage` first, shadowed ones hidden ----
    /** The exported definition document a catalog procedure points at, when this export has it. */
    function entryForProcedure(p) {
      var key = String((p && p.id) || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
      if (!key) return null
      for (var i = 0; i < entries.length; i++) {
        var hay = (String(entries[i].file || '') + ' ' + String(entries[i].title || ''))
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
        if (hay.indexOf(key) !== -1) return entries[i]
      }
      return null
    }

    function renderBlueprintList(hostEl) {
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
        // A pill that looks selectable must select something: when this export carries the
        // definition document, clicking opens it; when it does not, the pill is a plain label
        // instead of a dead control.
        var target = entryForProcedure(p)
        var item = make(
          'span',
          'proc-blueprint-item' +
            (p.id === 'usage' ? ' proc-blueprint-usage' : '') +
            (target ? ' is-link' : ' is-orphan'),
          p.id === 'usage' ? 'Getting started' : p.name || p.id,
        )
        item.setAttribute('data-procedure-id', p.id)
        if (target) {
          var open = function () {
            selectEntry(target)
            render()
          }
          item.setAttribute('role', 'button')
          item.setAttribute('tabindex', '0')
          item.addEventListener('click', open)
          item.addEventListener('keydown', function (ev) {
            if (ev && (ev.key === 'Enter' || ev.key === ' ')) {
              if (ev.preventDefault) ev.preventDefault()
              open()
            }
          })
        } else {
          item.setAttribute(
            'title',
            'Listed by the bluepriNNt; this export carries no definition document for it.',
          )
        }
        listEl.appendChild(item)
      })
      hostEl.appendChild(listEl)
    }

    // ---- Reference pills ----
    function openRef(element) {
      var rt = host.nnConsole || GLOBAL.nnConsole
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
      return button('chip-ref', label, function () {
        openRef(target)
      })
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

    function appendMarkdown(hostEl, rawText, plainOnly) {
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
      if (!plainOnly) decorate(markdown)
      hostEl.appendChild(markdown)
    }

    // ---- "Save your response": the one way back (S1) ----
    function reviewerName() {
      var name =
        runtime && typeof runtime.getReviewerName === 'function' ? runtime.getReviewerName() : ''
      return name && name !== 'reviewer' ? name : ''
    }

    function renderResponseBar() {
      responseHost.innerHTML = ''
      if (!store) return
      var count = allDrafts().length
      if (!count && !savedNote) return
      var bar = make('section', 'proc-response')
      bar.setAttribute('data-proc-response', '')
      responseHost.appendChild(bar)
      if (!count && savedNote) {
        bar.appendChild(make('div', 'proc-response-saved', savedNote))
        return
      }
      var text = make('div', 'proc-response-text')
      text.appendChild(
        make(
          'strong',
          null,
          count === 1 ? '1 answer not sent yet' : count + ' answers not sent yet',
        ),
      )
      text.appendChild(
        make(
          'span',
          'proc-response-hint',
          'Save your response, then attach the saved file to your reply.',
        ),
      )
      bar.appendChild(text)

      var nameRow = make('div', 'proc-response-name')
      var current = reviewerName()
      var nameField = make('input', 'proc-response-name-input')
      nameField.setAttribute('type', 'text')
      nameField.setAttribute('data-proc-reviewer', '')
      nameField.setAttribute('aria-label', 'Your name')
      nameField.setAttribute('placeholder', 'Your name')
      nameField.value = current
      nameField.addEventListener('change', function () {
        if (runtime && typeof runtime.setReviewerName === 'function')
          runtime.setReviewerName(nameField.value)
      })
      nameRow.appendChild(make('label', 'proc-response-name-label', 'Answering as'))
      nameRow.appendChild(nameField)
      bar.appendChild(nameRow)

      var actions = make('div', 'proc-response-actions')
      var err = make('div', 'proc-response-error')
      var save = button(
        'proc-response-save',
        'Save your response',
        function () {
          var name = String(nameField.value || '').trim()
          if (!name) {
            err.textContent = 'Type your name first: the domain owner sees who answered.'
            nameField.focus()
            return
          }
          if (runtime && typeof runtime.setReviewerName === 'function')
            runtime.setReviewerName(name)
          if (!runtime || typeof runtime.saveSnapshot !== 'function') {
            err.textContent = 'This console cannot save itself in this browser.'
            return
          }
          save.disabled = true
          Promise.resolve(runtime.saveSnapshot(document))
            .then(function (res) {
              save.disabled = false
              if (res && res.ok) {
                savedNote =
                  'Saved' +
                  (res.filename ? ' as ' + res.filename : '') +
                  '. Attach this file to your reply.'
                renderResponseBar()
              } else if (!(res && res.aborted)) {
                err.textContent =
                  'The response could not be saved' + (res && res.error ? ': ' + res.error : '.')
              }
            })
            .catch(function (e) {
              save.disabled = false
              err.textContent = 'The response could not be saved: ' + String((e && e.message) || e)
            })
        },
        { 'data-proc-save-response': '' },
      )
      actions.appendChild(save)
      if (changeset && typeof changeset.openExport === 'function') {
        actions.appendChild(
          button(
            'proc-response-secondary',
            'Download changes',
            function () {
              changeset.openExport()
            },
            { 'data-proc-download-changes': '' },
          ),
        )
      }
      bar.appendChild(actions)
      bar.appendChild(err)
      if (savedNote) {
        var note = make('div', 'proc-response-saved', savedNote)
        note.setAttribute('data-proc-saved-note', '')
        bar.appendChild(note)
      }
    }

    // ---- "Your turn": runs waiting on a person (S9) ----
    function renderInbox() {
      inboxHost.innerHTML = ''
      if (!store) return
      var items = inboxOf(entries, allDrafts())
      if (!items.length) return
      var box = make('section', 'proc-inbox')
      box.setAttribute('data-proc-inbox', '')
      var head = make('div', 'proc-inbox-head')
      head.appendChild(make('span', 'proc-inbox-title', 'Your turn'))
      head.appendChild(make('span', 'proc-inbox-count', String(items.length)))
      box.appendChild(head)
      var list = make('ul', 'proc-inbox-list')
      items.forEach(function (item) {
        var li = make('li', 'proc-inbox-item' + (item.run === activeRun ? ' active' : ''))
        li.setAttribute('data-proc-inbox-item', '')
        li.setAttribute('data-run-id', item.run.id)
        li.setAttribute('data-step', item.step)
        var open = button('proc-inbox-open', null, function () {
          selectEntry(item.entry, item.run)
          render()
        })
        open.appendChild(make('span', 'proc-inbox-step', item.stepName))
        open.appendChild(
          make(
            'span',
            'proc-inbox-run',
            (item.entry.title || item.entry.file) + ' · ' + item.run.id,
          ),
        )
        if (item.question) open.appendChild(make('span', 'proc-inbox-question', item.question))
        li.appendChild(open)
        list.appendChild(li)
      })
      box.appendChild(list)
      inboxHost.appendChild(box)
    }

    // ---- Tabs: one per procedure document ----
    function renderTabs(hostEl) {
      var target = hostEl || tabsHost
      target.innerHTML = ''
      if (entries.length <= 1) return
      entries.forEach(function (entry) {
        target.appendChild(
          button(
            'proc-tab' + (entry === active ? ' active' : ''),
            entry.title || entry.file,
            function () {
              selectEntry(entry)
              render()
            },
          ),
        )
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
    function renderFicha(hostEl) {
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
        hostEl.appendChild(ficha)
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
      hostEl.appendChild(ficha)
    }

    // ---- Runs of the active procedure: filters, list, "Start a run" ----
    function runStatus(run) {
      return run.state ? run.state.status : 'unknown'
    }

    function waitsOnMe(run) {
      return inboxOf([active], allDrafts()).some(function (i) {
        return i.run === run
      })
    }

    var FILTERS = [
      ['all', 'All'],
      ['mine', 'Waiting for me'],
      ['open', 'In progress'],
      ['closed', 'Closed'],
    ]

    function passesFilter(run) {
      var closed = run.closed || TERMINAL_RUN[runStatus(run)]
      if (runFilter === 'closed') return !!closed
      if (runFilter === 'open') return !closed
      if (runFilter === 'mine') return waitsOnMe(run)
      return true
    }

    function runStartDrafts() {
      return allDrafts().filter(function (d) {
        return d && d.kind === 'run_start' && d.procedure === active.file
      })
    }

    function removeDraft(id) {
      if (store && typeof store.remove === 'function' && id !== undefined) store.remove(id)
      savedNote = null
      render()
    }

    function renderRunList(hostEl) {
      var runs = Array.isArray(active.runs) ? active.runs : []
      var bar = make('div', 'proc-runs')
      bar.appendChild(make('span', 'proc-runs-label', 'Runs'))
      if (runs.length) {
        var filters = make('div', 'proc-run-filters')
        FILTERS.forEach(function (f) {
          filters.appendChild(
            button(
              'proc-run-filter' + (runFilter === f[0] ? ' active' : ''),
              f[1],
              function () {
                runFilter = f[0]
                render()
              },
              { 'data-proc-filter': f[0] },
            ),
          )
        })
        bar.appendChild(filters)
      }
      var list = make('div', 'proc-run-list')
      list.appendChild(
        button(
          'proc-run proc-run-definition' + (activeRun ? '' : ' active'),
          'Definition',
          function () {
            activeRun = null
            selectedStep = null
            render()
          },
        ),
      )
      var shown = 0
      runs.forEach(function (run) {
        if (!passesFilter(run)) return
        shown++
        var label = run.id + ' · ' + runStatus(run)
        var b = button('proc-run' + (run === activeRun ? ' active' : ''), label, function () {
          activeRun = run
          selectedStep = null
          render()
        })
        b.setAttribute('data-run-id', run.id)
        b.setAttribute('data-status', runStatus(run))
        if (draftRequestsOf(run).length) {
          b.classList.add('proc-run-unsent')
          b.setAttribute('title', 'You answered this run; the answer is not sent yet')
        }
        list.appendChild(b)
      })
      runStartDrafts().forEach(function (d) {
        var chip = make('span', 'proc-run proc-run-requested')
        chip.setAttribute('data-proc-run-request', d.id || '')
        chip.appendChild(
          make('span', null, 'New run · Requested · starts when you send your response'),
        )
        chip.appendChild(
          button(
            'proc-undo',
            'Undo',
            function () {
              removeDraft(d.id)
            },
            { 'data-proc-undo': d.id || '' },
          ),
        )
        list.appendChild(chip)
      })
      if (!runs.length) list.appendChild(make('span', 'proc-runs-empty', 'No run recorded yet.'))
      else if (!shown) list.appendChild(make('span', 'proc-runs-empty', 'No run matches.'))
      // The filter also owns the selection: a panel that keeps showing the run the list just
      // hid is the same lie as a filter that does not filter.
      if (activeRun && !passesFilter(activeRun)) {
        activeRun = null
        selectedStep = null
      }
      bar.appendChild(list)
      if (store && active.graph && !/^bluepriNNt:/.test(active.file)) {
        bar.appendChild(
          button(
            'proc-start-run' + (startFormOpen ? ' active' : ''),
            'Start a run',
            function () {
              startFormOpen = !startFormOpen
              render()
            },
            { 'data-proc-start-run': '' },
          ),
        )
      }
      hostEl.appendChild(bar)
    }

    /** The slots a run of the active procedure needs, from its frontmatter declaration. */
    function slotsOfActive() {
      var declared = Array.isArray(active.slots) ? active.slots : []
      var names = {}
      declared.forEach(function (s) {
        if (s && s.name) names[s.name] = true
      })
      // A placeholder the frontmatter never declared still needs a value.
      var extra = (active.graph && Array.isArray(active.graph.slots) ? active.graph.slots : [])
        .filter(function (n) {
          return n !== 'run' && !names[n]
        })
        .map(function (n) {
          return { name: n, kind: 'value', required: true }
        })
      return declared.concat(extra)
    }

    function startUI() {
      return host.nnUI || GLOBAL.nnUI
    }

    /** The input widget for a slot: the editor's own widget for a typed one, plain text otherwise. */
    function startWidget(slot, options) {
      var ui = startUI()
      var value = slot.default
      if (!slot.type || !ui) {
        var plain = make('input', 'proc-start-input')
        plain.setAttribute('type', 'text')
        plain.setAttribute('name', slot.name)
        if (value !== undefined) plain.value = value
        return plain
      }
      var opts = { doc: document }
      if (slot.type === 'number') {
        var number = ui.FieldNumberWidget(value, opts)
        number.step = 'any'
        return number
      }
      if (slot.type === 'boolean') return ui.FieldBooleanWidget(value, opts)
      if (slot.type === 'select') return ui.FieldSelectWidget(value, options, opts)
      if (slot.type === 'multiselect') return ui.FieldMultiSelectWidget(value, options, opts)
      if (slot.type === 'reference') {
        var index = ui.buildReferenceIndex({
          models: meta.models,
          collections: model.collections,
          elements: elements,
        })
        return ui.FieldReferenceWidget(value, index.list, opts)
      }
      if (slot.type === 'markdown' || slot.type === 'markdown_inline')
        return ui.FieldMarkdownWidget(value, opts)
      return ui.FieldStringWidget(value, opts)
    }

    /** What a slot's widget holds, as the typed JSON value the run records; undefined when empty. */
    function startValue(widget, slot) {
      if (slot.type === 'boolean') {
        var checkbox = widget.querySelector('input')
        return checkbox ? checkbox.checked : undefined
      }
      if (slot.type === 'multiselect') {
        var selected = Array.from(widget.querySelectorAll('input:checked'), function (input) {
          return input.value
        })
        return selected.length ? selected : undefined
      }
      var control = slot.type === 'reference' ? widget.querySelector('input') : widget
      var raw = control && String(control.value == null ? '' : control.value).trim()
      if (!raw) return undefined
      if (slot.type === 'number') return Number.isFinite(Number(raw)) ? Number(raw) : undefined
      if (slot.output) {
        var slug = raw
          .normalize('NFKD')
          .toLowerCase()
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
        return slug ? slot.output.directory + '/' + slug + slot.output.suffix : undefined
      }
      return raw
    }

    /** True when a file or procedure of this export already sits at the path (case-insensitive). */
    function pathExistsInExport(path) {
      var lower = path.toLowerCase()
      var files = model.files && Array.isArray(model.files.inventory) ? model.files.inventory : []
      return (
        files.some(function (f) {
          return f && typeof f.path === 'string' && f.path.toLowerCase() === lower
        }) ||
        entries.some(function (entry) {
          return entry.file.toLowerCase() === lower
        })
      )
    }

    function renderStartForm(hostEl) {
      var form = make('form', 'proc-start-form')
      form.setAttribute('data-proc-start-form', '')
      form.appendChild(
        make('div', 'proc-start-title', 'Request a new run of ' + (active.title || active.file)),
      )
      var slots = slotsOfActive()
      var blocked = slots.filter(function (s) {
        return s.kind !== 'value' && s.required && s.default === undefined
      })
      var fields = Object.create(null)
      var inventory =
        model.files && Array.isArray(model.files.inventory) ? model.files.inventory : []
      var missingSources = false
      slots.forEach(function (s) {
        if (s.kind !== 'value') return
        if (s.type && (START_TYPES.indexOf(s.type) === -1 || !startUI())) {
          // A type this console cannot draw: the person cannot supply it here.
          if (s.required) blocked.push(s)
          return
        }
        var row = make('div', 'proc-start-field')
        var label = make(
          'span',
          'proc-start-label',
          (s.label || labelOfToken(s.name)) + (s.required ? '' : ' (optional)'),
        )
        row.appendChild(label)
        if (s.description) row.appendChild(make('small', 'proc-start-note', s.description))
        var files =
          s.source === 'markdown-files'
            ? inventory.filter(function (f) {
                return (
                  f &&
                  typeof f.path === 'string' &&
                  /\.md$/i.test(f.path) &&
                  !/_NN\.md$/i.test(f.path)
                )
              })
            : null
        var options = files
          ? files.map(function (f) {
              return f.path
            })
          : s.options
        var input = startWidget(s, options)
        input.setAttribute('data-proc-slot', s.name)
        input.setAttribute('aria-label', label.textContent)
        if (s.type !== 'multiselect')
          Array.from(input.querySelectorAll('input')).forEach(function (control) {
            control.setAttribute('aria-label', label.textContent)
          })
        fields[s.name] = { input: input, slot: s, options: options }
        row.appendChild(input)
        if (files) {
          var preview = make('details', 'proc-start-preview')
          preview.appendChild(make('summary', null, 'View excerpt'))
          var excerpt = make('pre', null)
          preview.appendChild(excerpt)
          row.appendChild(preview)
          var showExcerpt = function () {
            var file = files.find(function (f) {
              return f.path === input.value
            })
            preview.hidden = !file
            excerpt.textContent =
              file && file.snippet
                ? file.snippet + (file.snippetTruncated ? '…' : '')
                : 'No excerpt was included in this export.'
          }
          input.addEventListener('change', showExcerpt)
          showExcerpt()
          if (!files.length) {
            if (s.required) missingSources = true
            input.disabled = true
            row.appendChild(
              make(
                'p',
                'proc-start-note',
                'No compatible files were exported. Add a Markdown brief under sources/ and export again with files included.',
              ),
            )
          }
        }
        if (s.output) {
          var destination = make('p', 'proc-start-note')
          destination.setAttribute('aria-live', 'polite')
          var showDestination = function () {
            var path = startValue(input, s)
            destination.textContent = path
              ? 'Destination once the procedure runs: ' + path
              : 'Enter a name to see the destination.'
          }
          input.addEventListener('input', showDestination)
          showDestination()
          row.appendChild(destination)
        }
        form.appendChild(row)
      })
      if (!slots.length)
        form.appendChild(make('div', 'proc-start-note', 'This procedure needs no values to start.'))
      if (blocked.length) {
        form.appendChild(
          make(
            'div',
            'proc-start-note',
            'Only the domain owner can start this procedure: it needs ' +
              blocked
                .map(function (s) {
                  return s.name
                })
                .join(', ') +
              ', which this form cannot provide.',
          ),
        )
      }
      var err = make('div', 'proc-action-error')
      var submit = button('proc-start-submit', 'Request the run', null, {
        'data-proc-start-submit': '',
      })
      submit.setAttribute('type', 'submit')
      if (blocked.length || missingSources) submit.disabled = true
      form.addEventListener('submit', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault()
        err.textContent = ''
        if (blocked.length || missingSources) return
        var params = Object.create(null)
        var missing = []
        var conflicts = []
        Object.keys(fields).forEach(function (name) {
          var field = fields[name]
          var v = startValue(field.input, field.slot)
          if (
            field.slot.type === 'select' &&
            v !== undefined &&
            Array.isArray(field.options) &&
            field.options.indexOf(v) === -1
          )
            v = undefined
          // The export cannot see files created since, so this only catches what it knows;
          // the procedure itself must still check before it writes.
          if (field.slot.output && v && pathExistsInExport(v)) conflicts.push(v)
          if (v !== undefined) params[name] = v
          else if (field.slot.required) missing.push(field.slot.label || name)
        })
        if (conflicts.length) {
          err.textContent = 'Choose a different name: ' + conflicts.join(', ') + ' already exists.'
          return
        }
        if (missing.length) {
          err.textContent = 'Fill in ' + missing.join(', ') + ' to request the run.'
          return
        }
        try {
          store.propose({ kind: 'run_start', procedure: active.file, params: { ...params } })
        } catch (e) {
          err.textContent =
            'The console refused this request: ' + String(e && e.message ? e.message : e)
          return
        }
        startFormOpen = false
        savedNote = null
        render()
      })
      form.appendChild(err)
      var actions = make('div', 'proc-start-actions')
      actions.appendChild(submit)
      actions.appendChild(
        button('proc-start-cancel', 'Cancel', function () {
          startFormOpen = false
          render()
        }),
      )
      form.appendChild(actions)
      hostEl.appendChild(form)
    }

    /**
     * The loop back-edges of the graph: an edge into a step still open on the depth-first
     * walk from the start (a revise step returning to its review). The layout skips them, so
     * a loop never pushes its decision below the steps it branches to.
     */
    function backEdgesOf(graph) {
      var steps = graph.steps
      var back = {}
      var state = {}
      function visit(s) {
        state[s] = 'open'
        ;(steps[s].next || []).forEach(function (t) {
          if (!steps[t]) return
          if (state[t] === 'open') back[s + '>' + t] = true
          else if (state[t] === undefined) visit(t)
        })
        state[s] = 'done'
      }
      if (graph.start && steps[graph.start]) visit(graph.start)
      return back
    }

    // ---- Graph layout: a step's layer is its longest distance from the start, loops aside ----
    function layersOf(graph) {
      var steps = graph.steps
      var order = Object.keys(steps)
      var back = backEdgesOf(graph)
      var layer = {}
      var queue = graph.start ? [graph.start] : []
      if (graph.start) layer[graph.start] = 0
      var guard = order.length * order.length + 1
      while (queue.length && guard-- > 0) {
        var s = queue.shift()
        steps[s].next.forEach(function (t) {
          if (back[s + '>' + t]) return
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

    function stepStatusIn(state, slug) {
      if (!activeRun || !state) return 'definition'
      var st = state.steps[slug]
      return st ? st.status : 'pending'
    }

    function stepStatus(slug) {
      return stepStatusIn(viewState(), slug)
    }

    /** True when the projection moved this step away from what the run recorded. */
    function isProjected(slug) {
      var projected = activeRun ? projectedStateOf(active, activeRun) : null
      if (!projected || !activeRun.state) return false
      if (stepStatusIn(projected, slug) !== stepStatusIn(activeRun.state, slug)) return true
      return slug === projected.currentStep && slug !== activeRun.state.currentStep
    }

    /** The outcome token of the guard that enters a step, or '' when it has none. */
    function outcomeTokenOf(slug) {
      var c = stepsOf(active)[slug] && stepsOf(active)[slug].condition
      var m = c ? /outcome\s*==\s*([\w-]+)/.exec(c) : null
      return m ? m[1] : ''
    }

    /**
     * Picks a step for the card. The active step is followed (no pin), so the card moves on
     * when the Runner does; any other step is a manual inspection that stays put.
     */
    function selectStep(slug) {
      var state = viewState()
      selectedStep =
        state && !TERMINAL_RUN[state.status] && state.currentStep === slug ? null : slug
      render()
    }

    /** What the edge `slug -> t` looks like, shared by the chart and the native fallback. */
    function edgeFacts(state, current, slug, t) {
      var graph = active.graph
      var tStatus = stepStatus(t)
      var stepState = state && state.steps && state.steps[slug]
      var isTaken =
        (stepState && stepState.next === t) ||
        (isProjected(slug) &&
          stepStatus(slug) === 'done' &&
          ((stepState && stepState.next === t) || t === current))
      var token = ''
      if (graph.steps[slug].next.length > 1) {
        // The token alone: every branch target has its own column, so two never share a spot.
        token = outcomeTokenOf(t) || graph.steps[t].condition || ''
      }
      return {
        status: tStatus,
        taken: !!isTaken,
        off: tStatus === 'off_path',
        projected: isProjected(t) || (isProjected(slug) && !!isTaken),
        token: token,
      }
    }

    /** The sentence a screen reader gets for the whole graph (the chart itself is hidden). */
    function graphSummary(state, current) {
      var graph = active.graph
      var slugs = Object.keys(graph.steps)
      var branches = slugs.filter(function (s) {
        return graph.steps[s].next.length > 1
      }).length
      var text =
        'Procedure flow graph: ' +
        slugs.length +
        ' steps' +
        (branches ? ', ' + branches + (branches === 1 ? ' branch point' : ' branch points') : '') +
        '.'
      if (state && current && graph.steps[current]) {
        text += ' Current step: ' + stepName(current) + ' (' + stepStatus(current) + ').'
      } else if (!activeRun) {
        text += ' The definition, no run selected.'
      }
      return (
        text +
        ' Use the arrow keys to move between connected steps and Enter or Space to open the' +
        ' focused step. The same steps are listed below as a list.'
      )
    }

    /** One step said in words: the live-region text for the focused node. */
    function announceStep(slug) {
      var step = active.graph.steps[slug]
      var status = stepStatus(slug)
      var out = step.next.filter(function (t) {
        return !!active.graph.steps[t]
      })
      return (
        stepName(slug) +
        ', ' +
        (step.stepType || 'task') +
        ' step' +
        (step.executor ? ', ' + step.executor : '') +
        (status !== 'definition' ? ', ' + status : '') +
        (out.length ? '. Leads to ' + out.map(stepName).join(', ') : '. Last step') +
        '.'
      )
    }

    // ---- Flow graph: the shared ECharts API, with the native svg as the fallback ----
    var graphView = null
    var graphFocusSlug = null
    var refocusGraph = false

    function disposeGraph() {
      var g = graphView
      graphView = null
      if (!g) return
      g.disposed = true
      if (g.observer) g.observer.disconnect()
      if (g.host && g.host.__nnChartObserver) {
        g.host.__nnChartObserver.disconnect()
        g.host.__nnChartObserver = null
      }
      try {
        if (g.chart && typeof g.chart.dispose === 'function') g.chart.dispose()
      } catch (e) {
        /* already gone with its DOM */
      }
    }

    function parseColor(text) {
      var s = String(text || '').trim()
      var hex = /^#([0-9a-f]{6})$/i.exec(s)
      if (hex) {
        return [
          parseInt(hex[1].slice(0, 2), 16),
          parseInt(hex[1].slice(2, 4), 16),
          parseInt(hex[1].slice(4, 6), 16),
        ]
      }
      var rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s)
      return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null
    }

    /** `a` over `b` at `t`: ECharts cannot read `color-mix()`, so tints are blended here. */
    function blend(a, b, t) {
      var ca = parseColor(a)
      var cb = parseColor(b)
      if (!ca || !cb) return b
      var mix = [0, 1, 2].map(function (i) {
        return Math.round(ca[i] * t + cb[i] * (1 - t))
      })
      return 'rgb(' + mix.join(',') + ')'
    }

    /** The console's own theme colours, resolved to something ECharts can draw. */
    function chartPalette(parent) {
      function resolve(token, fallback) {
        try {
          var probe = make('span')
          probe.style.color = 'var(' + token + ')'
          parent.appendChild(probe)
          var c = host.getComputedStyle(probe).color
          parent.removeChild(probe)
          return parseColor(c) ? c : fallback
        } catch (e) {
          return fallback
        }
      }
      return {
        surface: resolve('--surface', '#ffffff'),
        text: resolve('--text', '#111827'),
        muted: resolve('--muted', '#6b7280'),
        border: resolve('--border-strong', '#9ca3af'),
        primary: resolve('--primary', '#2563eb'),
        success: resolve('--success', '#16a34a'),
        warning: resolve('--warning', '#d97706'),
        danger: resolve('--danger', '#dc2626'),
      }
    }

    function escapeHtml(text) {
      return String(text).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      })
    }

    /** Nodes get as wide as the host allows, up to the native 200, down to a readable 84. */
    function flowGeometry(lay, widthPx, steps) {
      var widest = lay.rows.reduce(function (n, r) {
        return Math.max(n, r.length)
      }, 1)
      var nodeW = Math.max(84, Math.min(200, Math.floor(widthPx / widest) - 10))
      var compact = nodeW < 140
      // The box has to hold the whole step name. Instead of cutting the name by a made-up
      // characters-per-line ratio, wrap it and let the tallest name set the height of every
      // box: rows stay aligned and no name is ever truncated on a short procedure.
      var titleSize = compact ? 11 : 13
      var inner = nodeW - 16
      var perLine = Math.max(8, Math.floor(inner / (titleSize * 0.54)))
      var lines = 1
      Object.keys(steps || {}).forEach(function (slug) {
        var name = String((steps[slug] && steps[slug].name) || slug)
        var need = Math.ceil(name.length / perLine)
        if (need > lines) lines = need
      })
      lines = Math.max(1, Math.min(4, lines))
      var subLineH = 15
      var titleLineH = 18
      var nodeH = 9 + subLineH + lines * titleLineH + 9
      var rowH = nodeH + 30
      var pos = {}
      lay.rows.forEach(function (row, r) {
        row.forEach(function (slug, i) {
          pos[slug] = { x: 0.5 + (i - (row.length - 1) / 2) / widest, y: r }
        })
      })
      return {
        nodeW: nodeW,
        nodeH: nodeH,
        lines: lines,
        compact: compact,
        pos: pos,
        rows: lay.rows.length,
        rowH: rowH,
        height: lay.rows.length * rowH,
      }
    }

    function flowOption(lay, current, geo, pal, focusSlug, pulse) {
      var graph = active.graph
      var state = viewState()
      var w = geo.nodeW
      var h = geo.nodeH
      var tint = function (c) {
        return blend(c, pal.surface, 0.14)
      }
      var data = Object.keys(graph.steps).map(function (slug) {
        var step = graph.steps[slug]
        var status = stepStatus(slug)
        var isCurrent = slug === current
        var isSelected = slug === selectedStep
        var projected = isProjected(slug)
        var border = step.stepType === 'decision' ? pal.warning : pal.border
        var fill = pal.surface
        var width = 1.5
        var type = 'solid'
        var opacity = 1
        if (status === 'done') {
          border = pal.success
          fill = tint(pal.success)
        } else if (status === 'failed') {
          border = pal.danger
          width = 2
          fill = tint(pal.danger)
        } else if (status === 'waiting') {
          border = pal.warning
          width = 2
          fill = tint(pal.warning)
        } else if (status === 'active') {
          border = pal.primary
          fill = tint(pal.primary)
        } else if (status === 'pending') {
          type = 'dashed'
        } else if (status === 'off_path') {
          type = 'dashed'
          opacity = 0.55
        }
        if (isCurrent) {
          border = pal.primary
          width = 3.5
          type = 'solid'
        }
        if (projected) type = 'dotted'
        var sub = [
          status !== 'definition' ? status : null,
          step.stepType || 'task',
          step.executor || null,
          projected ? 'projected' : null,
          isSelected ? 'open' : null,
        ]
          .filter(Boolean)
          .join(' · ')
        // Rich text reads braces as markup: a step name must not carry any.
        var clean = function (s) {
          return String(s).replace(/[{}]/g, ' ')
        }
        var inner = w - 16
        // Rich-text truncation does not hold in every renderer: measure what fits instead.
        var subSize = geo.compact ? 9 : 10
        var titleSize = geo.compact ? 11 : 13
        // Upper-case bold text is wider per character than the title's mixed case.
        var cut = function (text, size, em) {
          var fit = Math.max(6, Math.floor(inner / (size * (em || 0.54))))
          return text.length > fit ? text.slice(0, fit - 1) + '…' : text
        }
        // The title wraps by word. Cutting it by character count broke names mid-word, and
        // the box is already tall enough for `geo.lines` of them.
        var wrap = function (text) {
          var maxChars = Math.max(8, Math.floor(inner / (titleSize * 0.54)))
          var words = String(text).split(/\s+/).filter(Boolean)
          var out = []
          var line = ''
          words.forEach(function (word) {
            var candidate = line ? line + ' ' + word : word
            if (candidate.length <= maxChars) {
              line = candidate
              return
            }
            if (line) out.push(line)
            line = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word
          })
          if (line) out.push(line)
          if (out.length > geo.lines) {
            out = out.slice(0, geo.lines)
            out[geo.lines - 1] = out[geo.lines - 1].slice(0, Math.max(4, maxChars - 1)) + '…'
          }
          return out.length ? out : ['']
        }
        return {
          id: slug,
          name: step.name || slug,
          value: [geo.pos[slug].x, geo.pos[slug].y],
          symbol: 'roundRect',
          symbolSize: [w, h],
          status: status,
          current: isCurrent,
          selected: isSelected,
          focused: slug === focusSlug,
          tooltipText:
            escapeHtml(step.name || slug) +
            '<br/>' +
            escapeHtml(sub) +
            (step.decision ? '<br/>' + escapeHtml(fillSlots(step.decision, values())) : ''),
          label: {
            show: true,
            position: 'inside',
            formatter:
              '{sub|' +
              cut(clean(sub.toUpperCase()), subSize, 0.68) +
              '}\n' +
              wrap(clean(step.name || slug))
                .map(function (line) {
                  return '{title|' + line + '}'
                })
                .join('\n'),
            rich: {
              sub: {
                width: inner,
                align: 'left',
                overflow: 'truncate',
                ellipsis: '…',
                fontSize: subSize,
                lineHeight: 15,
                color: isCurrent ? pal.primary : pal.muted,
                fontWeight: 600,
              },
              title: {
                width: inner,
                align: 'left',
                overflow: 'truncate',
                ellipsis: '…',
                fontSize: titleSize,
                lineHeight: 18,
                color: isCurrent ? pal.primary : pal.text,
                fontWeight: isCurrent ? 700 : 600,
              },
            },
          },
          itemStyle: {
            color: fill,
            borderColor: border,
            borderWidth: width,
            borderType: type,
            opacity: opacity,
            shadowBlur: isSelected ? 8 : 0,
            shadowColor: pal.primary,
          },
        }
      })
      var links = []
      var strokes = []
      var half = h / 2 / geo.rowH
      Object.keys(graph.steps).forEach(function (slug) {
        graph.steps[slug].next.forEach(function (t) {
          if (!geo.pos[t]) return
          var f = edgeFacts(state, current, slug, t)
          var color = pal.border
          if (f.status === 'done') color = pal.success
          else if (f.status === 'failed') color = pal.danger
          else if (f.status === 'waiting') color = pal.warning
          else if (f.status === 'active') color = pal.primary
          if (f.taken) color = f.projected ? pal.warning : pal.success
          var dashed = f.off || f.projected || f.status === 'waiting' || f.status === 'pending'
          var stroke = {
            color: color,
            width: f.taken ? 3 : 1.5,
            type: dashed ? 'dashed' : 'solid',
            opacity: f.off ? 0.5 : 1,
          }
          // The visible line runs from the foot of one box to the head of the next.
          // ECharts trims a graph edge by the node's average half-size, which swallows it
          // when the boxes are wider than the rows are apart; so the graph's own links
          // carry the data and the labels, and an overlay series draws the strokes.
          strokes.push({
            coords: [
              [geo.pos[slug].x, geo.pos[slug].y + half],
              [geo.pos[t].x, geo.pos[t].y - half],
            ],
            lineStyle: stroke,
          })
          links.push({
            source: slug,
            target: t,
            lineStyle: { opacity: 0, curveness: 0 },
            label: f.token
              ? {
                  show: true,
                  formatter: f.token.length > 24 ? f.token.substring(0, 22) + '…' : f.token,
                  color: f.taken ? pal.success : pal.muted,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: pal.surface,
                  padding: [1, 4],
                  position: 'middle',
                }
              : { show: false },
          })
        })
      })
      var at = function (slug) {
        return [geo.pos[slug].x, geo.pos[slug].y]
      }
      var series = [
        {
          type: 'lines',
          coordinateSystem: 'cartesian2d',
          silent: true,
          z: 2,
          symbol: ['none', 'arrow'],
          symbolSize: 8,
          data: strokes,
        },
        {
          type: 'graph',
          coordinateSystem: 'cartesian2d',
          layout: 'none',
          roam: false,
          z: 3,
          cursor: 'pointer',
          data: data,
          links: links,
          emphasis: { focus: 'none', scale: false },
        },
      ]
      if (pulse && current && geo.pos[current]) {
        series.push({
          type: 'effectScatter',
          coordinateSystem: 'cartesian2d',
          silent: true,
          z: 1,
          symbol: 'roundRect',
          symbolSize: [w, h],
          showEffectOn: 'render',
          rippleEffect: { period: 3, scale: 1.2, brushType: 'stroke', color: pal.primary },
          itemStyle: { color: 'rgba(0,0,0,0)', borderColor: pal.primary, borderWidth: 0 },
          data: [{ id: current, value: at(current) }],
        })
      }
      if (focusSlug && geo.pos[focusSlug]) {
        series.push({
          type: 'scatter',
          coordinateSystem: 'cartesian2d',
          silent: true,
          z: 4,
          symbol: 'roundRect',
          symbolSize: [w + 12, h + 12],
          itemStyle: { color: 'rgba(0,0,0,0)', borderColor: pal.text, borderWidth: 3 },
          data: [{ id: focusSlug, value: at(focusSlug) }],
        })
      }
      return {
        animation: false,
        backgroundColor: pal.surface,
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        xAxis: { type: 'value', min: 0, max: 1, show: false },
        yAxis: { type: 'value', min: -0.5, max: geo.rows - 0.5, inverse: true, show: false },
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: function (p) {
            return p && p.data && p.data.tooltipText ? p.data.tooltipText : ''
          },
        },
        series: series,
      }
    }

    function reducedMotion() {
      return !!(host.matchMedia && host.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }

    /** One rule for both renderers: the current step pulses, whatever its status, unless motion is reduced. */
    function pulseOf(current) {
      return reducedMotion() || !current ? 'off' : 'on'
    }

    /**
     * Draws the flow through the console's shared chart API (`renderChart`). Returns false
     * when there is none (no ECharts in this page), so the caller draws the native svg.
     */
    function drawChartGraph(view, lay, current) {
      var rt = runtime
      if (!rt || typeof rt.renderChart !== 'function') return false
      var graph = active.graph
      var wrap = make('div', 'dag-graph')
      wrap.setAttribute('data-proc-graph', '')
      wrap.setAttribute('tabindex', '0')
      wrap.setAttribute('role', 'group')
      wrap.setAttribute('aria-label', graphSummary(viewState(), current))
      var chartHost = make('div', 'dag-chart')
      chartHost.setAttribute('aria-hidden', 'true')
      var live = make('div', 'dag-live')
      live.setAttribute('aria-live', 'polite')
      live.setAttribute('aria-atomic', 'true')
      wrap.appendChild(chartHost)
      wrap.appendChild(live)
      view.appendChild(wrap)

      var reduced = reducedMotion()
      wrap.setAttribute('data-pulse', pulseOf(current))
      var pal = chartPalette(view)
      var widthOf = function () {
        return chartHost.clientWidth || view.clientWidth || 320
      }
      var geo = flowGeometry(lay, widthOf(), active.graph.steps)
      var hasFocus = false
      var firstStep = function () {
        return selectedStep || current || graph.start || Object.keys(graph.steps)[0]
      }
      var focusSlug = function () {
        return graph.steps[graphFocusSlug] ? graphFocusSlug : firstStep()
      }
      var option = function () {
        return flowOption(lay, current, geo, pal, hasFocus ? focusSlug() : null, !reduced)
      }
      chartHost.style.height = geo.height + 'px'
      var chart = rt.renderChart(chartHost, option())
      if (!chart) {
        view.removeChild(wrap)
        return false
      }
      var g = { chart: chart, host: chartHost, observer: null, disposed: false }
      graphView = g
      var redraw = function () {
        if (g.disposed || (chart.isDisposed && chart.isDisposed())) return
        chart.setOption(option(), true)
      }
      if (typeof chart.on === 'function') {
        chart.on('click', function (params) {
          if (params && params.dataType === 'node' && params.data && params.data.id) {
            graphFocusSlug = params.data.id
            selectStep(params.data.id)
          }
        })
      }

      // The focus ring is painted inside the chart, so the browser cannot scroll it into view:
      // keep the focused step's row inside the flow box (`.exec-dag-view` scrolls at 580 px).
      var reveal = function (slug) {
        var p = geo.pos[slug]
        if (!p || !view.getBoundingClientRect || !chartHost.getBoundingClientRect) return
        var top =
          chartHost.getBoundingClientRect().top -
          view.getBoundingClientRect().top +
          view.scrollTop +
          p.y * geo.rowH
        var bottom = top + geo.rowH
        if (top < view.scrollTop) view.scrollTop = top
        else if (bottom > view.scrollTop + view.clientHeight)
          view.scrollTop = bottom - view.clientHeight
      }
      var moveTo = function (slug) {
        if (!slug || !graph.steps[slug]) return
        graphFocusSlug = slug
        hasFocus = true
        redraw()
        reveal(slug)
        live.textContent = announceStep(slug)
      }
      wrap.addEventListener('focus', function () {
        hasFocus = true
        redraw()
        reveal(focusSlug())
        live.textContent = announceStep(focusSlug())
      })
      wrap.addEventListener('blur', function () {
        hasFocus = false
        redraw()
      })
      wrap.addEventListener('keydown', function (ev) {
        var k = ev.key
        var slug = focusSlug()
        var target = null
        if (k === 'ArrowDown') {
          target = graph.steps[slug].next.filter(function (t) {
            return !!graph.steps[t]
          })[0]
        } else if (k === 'ArrowUp') {
          target = Object.keys(graph.steps).filter(function (s) {
            return graph.steps[s].next.indexOf(slug) !== -1
          })[0]
        } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
          var row =
            lay.rows.filter(function (r) {
              return r.indexOf(slug) !== -1
            })[0] || []
          target = row[row.indexOf(slug) + (k === 'ArrowRight' ? 1 : -1)]
        } else if (k === 'Enter' || k === ' ' || k === 'Spacebar') {
          if (ev.preventDefault) ev.preventDefault()
          graphFocusSlug = slug
          refocusGraph = true
          selectStep(slug)
          return
        } else {
          return
        }
        if (ev.preventDefault) ev.preventDefault()
        moveTo(target)
      })

      // The host is not as wide as it will be when this runs (a hidden tab, a layout still
      // settling): lay the nodes out again for the width it ends up with.
      var RO =
        host.ResizeObserver || (typeof ResizeObserver !== 'undefined' ? ResizeObserver : null)
      if (RO) {
        var lastWidth = Math.round(widthOf())
        g.observer = new RO(function () {
          var now = Math.round(widthOf())
          if (g.disposed || !now || now === lastWidth) return
          lastWidth = now
          geo = flowGeometry(lay, now, active.graph.steps)
          chartHost.style.height = geo.height + 'px'
          redraw()
          if (chart.resize) chart.resize({ width: 'auto', height: 'auto' })
        })
        g.observer.observe(chartHost)
      }
      if (refocusGraph) {
        refocusGraph = false
        if (wrap.focus) wrap.focus()
      }
      return true
    }

    /** The hand-drawn svg: what draws the flow when the page has no ECharts. */
    /**
     * The graph without a chart runtime: the same walk as a list of buttons. It used to be a
     * hand-drawn svg, which meant a second layout engine, a second truncation rule and a second
     * place for the node contract to drift. The list carries the same contract the svg did --
     * `.dag-node`, data-step, data-status, data-layer, current/selected, role=button,
     * Enter/Space -- so the view behaves the same either way, and the step name is never cut.
     */
    function buildNativeGraph(lay, current) {
      var graph = active.graph
      var state = viewState()
      var box = document.createElement('div')
      box.setAttribute('class', 'dag-canvas dag-list')
      box.setAttribute('data-proc-graph', '')
      box.setAttribute('data-pulse', pulseOf(current))
      box.setAttribute('role', 'group')
      box.setAttribute('aria-label', graphSummary(state, current))
      lay.rows.forEach(function (row, layer) {
        var rowEl = document.createElement('div')
        rowEl.setAttribute('class', 'dag-layer')
        row.forEach(function (slug) {
          var step = graph.steps[slug]
          var status = stepStatus(slug)
          var node = document.createElement('button')
          node.setAttribute('type', 'button')
          node.setAttribute(
            'class',
            'dag-node ' +
              status +
              (step.stepType === 'decision' ? ' decision' : '') +
              (slug === current ? ' current' : '') +
              (isProjected(slug) ? ' projected' : '') +
              (slug === selectedStep ? ' selected' : ''),
          )
          node.setAttribute('data-step', slug)
          node.setAttribute('data-status', status)
          node.setAttribute('data-layer', String(layer))
          node.setAttribute('aria-label', announceStep(slug))
          node.addEventListener('click', function () {
            selectStep(slug)
          })
          // jsdom does not turn Enter on a button into a click, so the key is handled here
          // exactly as it was for the svg.
          node.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
              if (ev.preventDefault) ev.preventDefault()
              selectStep(slug)
            }
          })
          var dot = document.createElement('span')
          dot.setAttribute('class', 'node-dot')
          node.appendChild(dot)
          var text = document.createElement('span')
          text.setAttribute('class', 'node-text')
          var sub = document.createElement('span')
          sub.setAttribute('class', 'node-sub')
          sub.textContent =
            (step.stepType || 'task').toUpperCase() +
            (step.executor ? ' · ' + step.executor : '') +
            (status !== 'definition' ? ' · ' + status : '')
          var title = document.createElement('span')
          title.setAttribute('class', 'node-title')
          title.textContent = step.name || slug
          text.appendChild(sub)
          text.appendChild(title)
          node.appendChild(text)
          rowEl.appendChild(node)
        })
        box.appendChild(rowEl)
      })
      return box
    }

    function renderGraph(hostEl) {
      disposeGraph()
      var graph = active.graph
      var state = viewState()
      var lay = layersOf(graph)
      var current = state ? state.currentStep : null
      var col = make('div', 'exec-dag-col flowcard card')
      var head = make('div', 'col-head exec-col-header')
      head.innerHTML = '<span>' + vIcon('workflow', 14) + ' Flow</span>'
      head.appendChild(
        make('span', 'count-badge count', Object.keys(graph.steps).length + ' steps'),
      )
      col.appendChild(head)
      var view = make('div', 'exec-dag-view graphbox')
      col.appendChild(view)
      col.appendChild(stepList(lay, current))
      var hint = make(
        'div',
        'rail-hint hint',
        !activeRun
          ? 'The shape of the procedure. It stays visible on every tab.'
          : 'The selected node is the one that opens below. It stays visible on every tab.',
      )
      col.appendChild(hint)
      // Attached before the chart is drawn, so the chart measures the width it really has.
      hostEl.appendChild(col)
      if (!drawChartGraph(view, lay, current)) {
        view.className += ' exec-dag-view-native'
        view.appendChild(buildNativeGraph(lay, current))
      }
    }

    /** The same walk as a vertical list: the graph's text alternative, with each status in words. */
    var stepListOpen = null

    function stepList(lay, current) {
      var ol = make('ol', 'proc-step-list')
      ol.setAttribute('data-proc-step-list', '')
      lay.rows.forEach(function (row) {
        row.forEach(function (slug) {
          var step = active.graph.steps[slug]
          var status = stepStatus(slug)
          var li = make(
            'li',
            'proc-step-item ' +
              status +
              (slug === current ? ' current' : '') +
              (slug === selectedStep ? ' selected' : ''),
          )
          li.setAttribute('data-step', slug)
          var b = button('proc-step-item-btn', null, function () {
            selectStep(slug)
          })
          b.appendChild(make('span', 'proc-step-item-name', step.name || slug))
          var token = outcomeTokenOf(slug)
          b.appendChild(
            make(
              'span',
              'proc-step-item-meta',
              (token ? 'if ' + token + ' · ' : '') +
                (status === 'definition' ? step.executor || 'task' : status),
            ),
          )
          li.appendChild(b)
          ol.appendChild(li)
        })
      })
      // A disclosure: in the tab order at every width, open by default only on a phone.
      var box = make('details', 'proc-step-list-box')
      var open =
        stepListOpen === null
          ? !!(host.matchMedia && host.matchMedia('(max-width: 640px)').matches)
          : stepListOpen
      if (open) box.setAttribute('open', '')
      box.appendChild(make('summary', 'proc-step-list-summary', 'Steps as a list'))
      box.addEventListener('toggle', function () {
        stepListOpen = box.open
      })
      box.appendChild(ol)
      return box
    }

    // ---- Step card ----
    function guardText(guard) {
      if (!guard || guard.kind === 'none') return 'always'
      if (guard.kind === 'outcome') return 'outcome == ' + guard.token
      if (guard.kind === 'artifact')
        return guard.artifact + ' validated (' + (guard.holds ? 'holds' : 'not yet') + ')'
      return guard.text
    }

    function embedOf(slug) {
      return activeRun && activeRun.embeds && activeRun.embeds[slug] ? activeRun.embeds[slug] : null
    }

    /**
     * One artifact as a chip: its name, the state the fold gave it, the step that produced it,
     * and a way to read it. The file travels inside the console when it fit; otherwise it is
     * on the domain owner's machine and the chip says so.
     */
    function artifactChip(slug) {
      var def = active.graph.artifacts[slug] || {}
      var state = viewState()
      var st = state ? state.artifacts[slug] : null
      var chip = make('div', 'proc-artifact')
      chip.setAttribute('data-proc-artifact', slug)
      if (st) chip.setAttribute('data-status', st.status)
      var top = make('div', 'proc-artifact-top')
      top.appendChild(make('span', 'proc-artifact-name', def.name || slug))
      if (st) {
        var stateEl = make(
          'span',
          'proc-artifact-state',
          st.status + (st.rev ? ' · rev ' + shortHash(st.rev) : ''),
        )
        if (st.rev) stateEl.setAttribute('title', 'rev ' + st.rev)
        top.appendChild(stateEl)
      }
      chip.appendChild(top)

      var links = make('div', 'proc-artifact-links')
      var producer = (def.producers || [])[0] || (st && st.step) || null
      if (producer && stepsOf(active)[producer]) {
        links.appendChild(
          button('proc-artifact-producer', 'produced by ' + stepName(producer), function () {
            selectedStep = producer
            render()
          }),
        )
      }
      var path = filePathOf(slug, def)
      var embed = embedOf(slug)
      // An artifact the run has not produced yet has no file to open: offering one invites a
      // click that can only fail. The name and the state already say it is still expected.
      var exists = st && st.status !== 'expected' && st.status !== 'not_required'
      if (path && exists) {
        var hasContent = embed && (embed.text !== undefined || embed.data !== undefined)
        var open = button('proc-artifact-open', 'Open ' + path, function () {
          if (hasContent) showArtifact(def, path, embed)
          else openArtifactFile(path, open)
        })
        open.setAttribute(
          'title',
          hasContent ? 'Open ' + path : 'Open ' + path + ' from the domain folder',
        )
        links.appendChild(open)
        if (embed && embed.omitted)
          links.appendChild(
            make('span', 'proc-artifact-remote', "Available on the domain owner's machine"),
          )
      } else if (path) {
        links.appendChild(make('span', 'proc-artifact-pending', 'not produced yet'))
      }
      if (links.children.length) chip.appendChild(links)
      return chip
    }

    /** The file an artifact names, when its `verify` points at one. */
    function verifyPathOf(def) {
      if (!def || typeof def.verify !== 'string') return ''
      var m = /^file:\s*(.+)$/.exec(def.verify.trim())
      return m ? m[1].trim() : ''
    }

    /** The artifact's file for this run: the path the run recorded, else its resolved verify. */
    function filePathOf(slug, def) {
      var embed = embedOf(slug)
      if (embed && embed.path) return embed.path
      var row =
        activeRun && activeRun.model && activeRun.model.artifacts
          ? activeRun.model.artifacts[slug]
          : null
      if (row && typeof row.value === 'string' && row.value && (!row.kind || row.kind === 'file'))
        return row.value
      var path = verifyPathOf(def)
      return path ? fillSlots(path, values()) : ''
    }

    /**
     * Opens the artifact's file from the domain folder. The console is static HTML, so it
     * cannot read a local path on its own: it opens the domain folder once through the same
     * picker the changeset writer uses, then reads and shows that one file. This is the domain
     * owner's path; a recipient reads the copy embedded at export time.
     */
    function openArtifactFile(path, btn) {
      // The page this view is mounted in owns the picker, not whatever global the module was
      // first loaded under: a view can be mounted into a different document.
      var fsa = host.nnFsa
      var rt = host.nnConsole
      var writer = null
      if (fsa && typeof fsa.createWriter === 'function') {
        writer = fsa.createWriter({ win: host })
      } else if (rt && typeof rt.fsaWriter === 'function') {
        writer = rt.fsaWriter()
      }
      if (!writer || typeof writer.connect !== 'function') {
        btn.textContent = 'Open ' + path + ' — folder access is not available in this browser'
        btn.disabled = true
        return
      }
      btn.disabled = true
      btn.textContent = 'Opening ' + path + '…'
      writer
        .connect(meta.domainId)
        .then(function (res) {
          if (!res || !res.ok) {
            btn.textContent = 'Open ' + path + ' — ' + ((res && res.reason) || 'failed')
            btn.disabled = false
            return
          }
          return readDomainFile(res.handle, path).then(function (text) {
            // The chip already knows which artifact this is; deriving it from the file name
            // would guess (a file `draft.md` can back an artifact named `draft-doc`).
            showArtifact(defOfArtifact(btn) || null, path, { kind: 'text', text: text })
            btn.textContent = 'Open ' + path
            btn.disabled = false
          })
        })
        .catch(function () {
          btn.textContent = 'Open ' + path + ' — could not read it'
          btn.disabled = false
        })
    }

    /** The artifact definition the chip that owns this button was built for. */
    function defOfArtifact(btn) {
      var chip = btn.parentNode
      while (chip && chip.getAttribute && !chip.getAttribute('data-proc-artifact'))
        chip = chip.parentNode
      var slug = chip && chip.getAttribute && chip.getAttribute('data-proc-artifact')
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

    /** A blob URL for embedded media: the console's CSP allows `blob:` media, not `data:`. */
    function blobUrlOf(embed) {
      try {
        var bin = host.atob(embed.data)
        var bytes = new Uint8Array(bin.length)
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        var blob = new host.Blob([bytes], { type: embed.mime || 'application/octet-stream' })
        return host.URL.createObjectURL(blob)
      } catch {
        return ''
      }
    }

    /** The embedded content itself: text, Markdown, an image or a player. */
    function embedBody(embed, path) {
      if (embed.text !== undefined) {
        if (/\.md$/i.test(path)) {
          var md = make('div', 'proc-artifact-view-body proc-embed-markdown')
          appendMarkdown(md, embed.text, true)
          return md
        }
        return make(
          'pre',
          'proc-artifact-view-body',
          embed.text === '' ? '(empty file)' : embed.text,
        )
      }
      if (embed.data !== undefined && embed.kind === 'image') {
        var img = make('img', 'proc-embed-image')
        img.setAttribute('alt', path)
        img.setAttribute('src', 'data:' + embed.mime + ';base64,' + embed.data)
        return img
      }
      if (embed.data !== undefined && (embed.kind === 'audio' || embed.kind === 'video')) {
        var player = make(embed.kind, 'proc-embed-media')
        player.setAttribute('controls', '')
        var url = blobUrlOf(embed)
        if (url) player.setAttribute('src', url)
        return player
      }
      return make(
        'div',
        'proc-artifact-remote',
        embed.omitted === 'too-large' || embed.omitted === 'budget'
          ? "Too large to travel in this console: available on the domain owner's machine."
          : "Available on the domain owner's machine.",
      )
    }

    /** Shows the file's content in a modal dialog: it reads, it never writes. */
    function showArtifact(def, path, embed) {
      var panel = container.querySelector('.proc-artifact-view')
      if (!panel) {
        panel = make('dialog', 'proc-artifact-view')
        root.appendChild(panel)
      }
      panel.innerHTML = ''
      var head = make('div', 'proc-artifact-view-head')
      head.appendChild(make('span', 'proc-artifact-view-title', (def && def.name) || path))
      head.appendChild(
        button('proc-artifact-view-close', 'Close', function () {
          if (typeof panel.close === 'function' && panel.open) panel.close()
          panel.remove()
        }),
      )
      panel.appendChild(head)
      panel.appendChild(make('div', 'proc-artifact-view-path', path))
      panel.appendChild(embedBody(embed || { kind: 'text', text: '' }, path))
      if (typeof panel.showModal === 'function' && !panel.open) panel.showModal()
      if (panel.scrollIntoView) {
        try {
          panel.scrollIntoView({ block: 'nearest' })
        } catch {
          /* jsdom */
        }
      }
    }

    /**
     * A labeled row of artifact chips. A step with no artifacts prints nothing, so the card
     * never shows an empty "Inputs:" line that reads like a missing value.
     */
    function renderArtifactRow(hostEl, label, slugs) {
      if (!Array.isArray(slugs) || !slugs.length) return
      var row = make('div', 'proc-artifact-row')
      row.setAttribute('data-proc-artifact-row', label.toLowerCase())
      row.appendChild(make('div', 'proc-artifact-row-label', label))
      var list = make('div', 'proc-artifact-list')
      slugs.forEach(function (slug) {
        list.appendChild(artifactChip(slug))
      })
      row.appendChild(list)
      hostEl.appendChild(row)
    }

    /** What the person reviews, shown in the card: the step's inputs that travel inline. */
    function renderReviewMaterial(card, step) {
      var slugs = Array.isArray(step.inputs) ? step.inputs : []
      slugs.forEach(function (slug) {
        var embed = embedOf(slug)
        if (!embed) return
        var def = active.graph.artifacts[slug] || {}
        var box = make('details', 'proc-embed')
        box.setAttribute('data-proc-embed', slug)
        if (embed.text !== undefined || embed.data !== undefined) box.setAttribute('open', '')
        box.appendChild(
          make('summary', 'proc-embed-title', (def.name || slug) + ' · ' + embed.path),
        )
        box.appendChild(embedBody(embed, embed.path))
        card.appendChild(box)
      })
    }

    /** Command and similar technical facts: collapsed, for whoever needs them. */
    function detailsBox(cls) {
      var d = make('details', 'proc-details' + (cls ? ' ' + cls : ''))
      d.appendChild(make('summary', 'proc-details-summary', 'Details'))
      return d
    }

    function renderStepCard(hostEl) {
      var graph = active.graph
      var state = viewState()
      if (activeRun && !selectedStep && state && TERMINAL_RUN[state.status]) {
        renderRunSummary(hostEl, state)
        return
      }
      var slug =
        selectedStep || (state && state.currentStep) || graph.start || Object.keys(graph.steps)[0]
      if (!slug || !graph.steps[slug]) {
        hostEl.appendChild(make('div', 'empty-state', 'No steps in this procedure.'))
        return
      }
      var step = graph.steps[slug]
      var status = stepStatus(slug)
      var st = state ? state.steps[slug] : null
      var vals = values()
      var card = make('article', 'exec-step-card nn-card')
      card.setAttribute('data-nn-component', 'element-card')
      card.setAttribute('data-step', slug)
      var head = make('div', 'exec-step-head')
      var type = make('span', 'step-type-pill pill-' + (step.stepType || 'task'))
      type.innerHTML = vIcon(step.stepType || 'task', 14) + ' '
      type.appendChild(document.createTextNode((step.stepType || 'task').toUpperCase()))
      head.appendChild(type)
      if (isSystemStep(step)) {
        var sys = make('span', 'step-system-pill', 'Runs on the system')
        sys.setAttribute('data-proc-system', step.executor)
        head.appendChild(sys)
      } else if (step.executor) {
        head.appendChild(
          make(
            'span',
            'step-executor-pill',
            step.executor === 'human' ? 'Your step' : 'Executor: ' + step.executor,
          ),
        )
      }
      var token = outcomeTokenOf(slug)
      if (step.condition)
        head.appendChild(
          make('span', 'step-cond-pill', token ? 'If ' + token : 'If: ' + step.condition),
        )
      head.appendChild(
        make(
          'span',
          'step-state-badge state-' + status,
          status === 'definition' ? 'Definition' : status,
        ),
      )
      card.appendChild(head)
      card.appendChild(make('h2', 'exec-step-title', step.name || slug))
      if (step.decision) {
        card.appendChild(make('p', 'exec-step-question', fillSlots(step.decision, vals)))
      }
      var el = elementOf(slug)
      if (el && el.description) {
        var desc = make('div', 'exec-step-desc')
        appendMarkdown(desc, fillSlots(el.description, vals))
        card.appendChild(desc)
      }
      var running = activeRun && state && !TERMINAL_RUN[state.status]
      // The step the person's unsent answer led to: the export itself is still at the previous one.
      var previewOnly =
        running &&
        !!activeRun.state &&
        slug === state.currentStep &&
        slug !== activeRun.state.currentStep
      if (
        !previewOnly &&
        isSystemStep(step) &&
        running &&
        status !== 'done' &&
        status !== 'off_path'
      ) {
        var note = make('div', 'proc-system-note', SYSTEM_STEP_NOTE)
        note.setAttribute('data-proc-system-note', '')
        card.appendChild(note)
      }
      if (activeRun) renderReviewMaterial(card, step)

      var facts = make('div', 'exec-step-facts')
      function fact(label, value, hostFacts) {
        if (value === undefined || value === null || value === '') return
        ;(hostFacts || facts).appendChild(make('div', 'exec-step-fact', label + ': ' + value))
      }
      fact('Produces', step.produces)
      renderArtifactRow(facts, 'Inputs', step.inputs)
      renderArtifactRow(facts, 'Outputs', step.outputs)
      if (st) {
        fact('Waiting on', st.waitingOn)
        fact('Failure', st.failure)
        if (st.outcome || st.next)
          fact('Outcome', (st.outcome || '—') + (st.next ? ' → ' + stepName(st.next) : ''))
      }
      if (facts.children.length) card.appendChild(facts)

      if (activeRun) renderDecided(card, slug)
      if (activeRun && slug === (activeRun.state && activeRun.state.currentStep)) {
        renderActions(card, activeRun.state)
      } else if (previewOnly) {
        renderPreviewHandoff(card)
      }
      renderRequestBox(card, slug)

      if (step.next.length > 1) {
        var branches = make('div', 'branch-outcomes')
        step.next.forEach(function (t) {
          var target = graph.steps[t]
          var tok = outcomeTokenOf(t)
          branches.appendChild(
            make(
              'div',
              'branch-outcome',
              (tok ? labelOfToken(tok) : (target && target.condition) || 'Otherwise') +
                ' → ' +
                stepName(t),
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
      var details = detailsBox()
      fact('Command', step.command ? fillSlots(step.command, vals) : '', details)
      if (st) fact('Attempt', st.attempt ? String(st.attempt) : '', details)
      if (details.children.length > 1) card.appendChild(details)
      hostEl.appendChild(card)
    }

    /**
     * What a step reached only through the person's unsent answers shows instead of actions:
     * nothing here can be completed until the Runner has recorded the answer before it. The
     * button is the response bar's own save control; this view writes nothing itself.
     */
    function renderPreviewHandoff(card) {
      var handoff = make('div', 'proc-actions proc-preview-handoff')
      handoff.setAttribute('data-proc-preview-handoff', '')
      handoff.appendChild(make('strong', null, 'Next action: save your previous response'))
      handoff.appendChild(
        make(
          'p',
          null,
          'Preview only: the Runner has not confirmed the previous response. Save it and send the saved file to the domain owner, who imports it; then open the updated export. There is nothing to complete on this step yet.',
        ),
      )
      if (responseHost.querySelector('[data-proc-save-response]')) {
        handoff.appendChild(
          button(
            'proc-action',
            'Save your response',
            function () {
              var save = responseHost.querySelector('[data-proc-save-response]')
              if (save) save.click()
            },
            { 'data-proc-preview-save': '' },
          ),
        )
      }
      card.appendChild(handoff)
    }

    /** "Decided: approve · not sent yet", with Undo, on a step the person answered. */
    function renderDecided(card, slug) {
      var mine = draftRequestsOf(activeRun).filter(function (r) {
        return r.step === slug
      })
      mine.forEach(function (r) {
        var box = make('div', 'proc-decided')
        box.setAttribute('data-proc-decided', r.action)
        var what =
          r.action === 'complete'
            ? r.outcome
              ? 'Decided: ' + r.outcome
              : 'Marked as done'
            : r.action === 'fail'
              ? 'Failed: ' + (r.value || '')
              : r.action === 'wait'
                ? 'Waiting on: ' + (r.value || '')
                : 'Asked to start'
        box.appendChild(make('span', 'proc-decided-what', what))
        box.appendChild(make('span', 'proc-decided-state', 'not sent yet'))
        if (r.action === 'complete' && r.value)
          box.appendChild(make('span', 'proc-decided-reason', r.value))
        box.appendChild(
          button(
            'proc-undo',
            'Undo',
            function () {
              removeDraft(r.draftId)
            },
            { 'data-proc-undo': r.draftId || '' },
          ),
        )
        card.appendChild(box)
      })
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

    // ---- Closed run: what came out of it ----
    function runDates(run) {
      var stamps = []
      var steps = (run.model && run.model.steps) || {}
      Object.keys(steps).forEach(function (s) {
        if (steps[s] && steps[s].claimedAt) stamps.push(String(steps[s].claimedAt))
      })
      stamps.sort()
      return stamps.length ? { first: stamps[0], last: stamps[stamps.length - 1] } : null
    }

    function dateText(iso) {
      var d = new Date(iso)
      if (isNaN(d.getTime())) return String(iso)
      return d
        .toISOString()
        .replace('T', ' ')
        .replace(/:\d\d\.\d+Z$|:\d\dZ$/, ' UTC')
    }

    function renderRunSummary(hostEl, state) {
      var card = make('article', 'exec-step-card nn-card proc-run-summary')
      card.setAttribute('data-proc-run-summary', state.status)
      var head = make('div', 'exec-step-head')
      head.appendChild(
        make('span', 'step-state-badge state-' + state.status, labelOfToken(state.status)),
      )
      card.appendChild(head)
      card.appendChild(make('h2', 'exec-step-title', 'Run ' + activeRun.id + ' · ' + state.status))
      var facts = make('div', 'exec-step-facts')
      var decisions = state.path
        .map(function (slug) {
          var row = state.steps[slug]
          return row && row.outcome ? stepName(slug) + ': ' + row.outcome : ''
        })
        .filter(Boolean)
      if (decisions.length)
        facts.appendChild(
          make(
            'div',
            'exec-step-fact proc-summary-decisions',
            'Decisions: ' + decisions.join(' · '),
          ),
        )
      facts.appendChild(
        make('div', 'exec-step-fact', 'Path: ' + state.path.map(stepName).join(' → ')),
      )
      var params = slotValuesOf(activeRun)
      var keys = Object.keys(params).filter(function (k) {
        return k !== 'run'
      })
      if (keys.length)
        facts.appendChild(
          make(
            'div',
            'exec-step-fact',
            'Values: ' +
              keys
                .map(function (k) {
                  return k + ' = ' + params[k]
                })
                .join(', '),
          ),
        )
      var dates = runDates(activeRun)
      if (dates) {
        facts.appendChild(make('div', 'exec-step-fact', 'Started: ' + dateText(dates.first)))
        facts.appendChild(make('div', 'exec-step-fact', 'Last step: ' + dateText(dates.last)))
      }
      card.appendChild(facts)
      var produced = Object.keys(state.artifacts).filter(function (slug) {
        var a = state.artifacts[slug]
        return a && a.status !== 'expected' && a.status !== 'not_required'
      })
      renderArtifactRow(card, 'Artifacts', produced)
      hostEl.appendChild(card)
      if (state.status === 'completed' && store) renderHandoff(hostEl)
    }

    // ---- Final handoff of a completed run (a DRAFT, like every answer) ----
    var HANDOFF_CHOICES = [
      ['administrator', 'Send to the administrator'],
      ['agent', 'Register with the agent'],
    ]

    function handoffDraftOf(run) {
      return (
        allDrafts().filter(function (d) {
          return d && d.kind === 'run_handoff' && d.run === run.id
        })[0] || null
      )
    }

    /** The ready-to-paste prompt for the person's AI agent. It says only what import_console does. */
    function handoffAgentPrompt(runId) {
      return [
        'Import the cogNNitive console I saved, with the import_console MCP tool and apply set to true, so the final handoff of run "' +
          runId +
          '" is registered.',
        'The saved console HTML file is at: (write the path of the saved file here)',
        'It carries one draft: { "kind": "run_handoff", "run": "' +
          runId +
          '", "choice": "agent" } (Register with the agent).',
        'import_console with apply records that choice once beside the run (executions/' +
          runId +
          '/handoff.json, which procedure_state shows as handoff). It adds nothing to the models of the domaiNN and does nothing else with the run.',
        'The outputs written in this run are private to it, under executions/' +
          runId +
          '/outputs/. After the choice is recorded, publish them where the procedure declares them (the location of each output artifact). If that folder holds nothing, there is nothing to publish.',
        'Then tell me what import_console returned for the handoff, including any refusal (for example RUN_NOT_COMPLETED or HANDOFF_CONFLICT). If it asks who signs the changes, ask me for my name.',
      ].join('\n\n')
    }

    var handoffDialog = null

    /**
     * Guidance for a handoff choice, in the console's own modal (a <dialog> with the kit's
     * nn-edit-modal classes). It explains what the person does next and writes nothing: the
     * choice itself is the `run_handoff` draft. Escape and Close dismiss it, and focus returns
     * to the handoff card the modal was opened from.
     */
    function openHandoffDialog(choice) {
      var entry = HANDOFF_CHOICES.filter(function (c) {
        return c[0] === choice
      })[0]
      if (!entry || !activeRun) return
      if (handoffDialog && handoffDialog.parentNode)
        handoffDialog.parentNode.removeChild(handoffDialog)
      var dialog = make('dialog', 'nn-edit-modal proc-handoff-dialog')
      handoffDialog = dialog
      dialog.setAttribute('data-proc-handoff-dialog', choice)
      dialog.setAttribute('role', 'dialog')
      dialog.setAttribute('aria-modal', 'true')
      dialog.setAttribute('aria-labelledby', 'proc-handoff-dialog-title')

      function restoreFocus() {
        var target =
          container.querySelector('[data-proc-handoff-open]') ||
          container.querySelector('[data-proc-handoff]')
        if (!target) return
        if (!/^(button|a|input)$/i.test(target.tagName)) target.setAttribute('tabindex', '-1')
        if (typeof target.focus === 'function') target.focus()
      }
      function dismiss() {
        if (!dialog.hasAttribute('open')) return
        if (typeof dialog.close === 'function') dialog.close()
        dialog.removeAttribute('open')
        restoreFocus()
      }
      dialog.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return
        ev.preventDefault()
        dismiss()
      })
      dialog.addEventListener('click', function (ev) {
        if (ev.target === dialog) dismiss()
      })
      // A native close (for example the browser's own Escape) still returns the focus.
      dialog.addEventListener('close', function () {
        if (dialog.hasAttribute('open')) return
        restoreFocus()
      })

      var head = make('div', 'nn-edit-modal-head')
      var title = make('h2', null, entry[1])
      title.id = 'proc-handoff-dialog-title'
      head.appendChild(title)
      var x = button('nn-edit-modal-close', '×', dismiss, { 'aria-label': 'Close dialog' })
      head.appendChild(x)
      dialog.appendChild(head)

      var bodyEl = make('div', 'nn-edit-modal-body proc-handoff-dialog-body')
      var copyBtn = null
      if (choice === 'administrator') {
        bodyEl.appendChild(
          make(
            'p',
            null,
            'Your choice is recorded as an answer in this console. Nothing has been sent yet. To hand this run to the administrator:',
          ),
        )
        var steps = make('ol', 'proc-handoff-steps')
        steps.appendChild(
          make(
            'li',
            null,
            'Use "Save your response" at the top of this view to save your response and your choice in the console file.',
          ),
        )
        steps.appendChild(
          make(
            'li',
            null,
            'Send or share the saved HTML file with the cogNNitive administrator, by whatever means you use.',
          ),
        )
        bodyEl.appendChild(steps)
        bodyEl.appendChild(
          make(
            'p',
            'proc-hint',
            'When the administrator imports the saved file, your choice is recorded with the run. Nothing else is added to the domaiNN.',
          ),
        )
        bodyEl.appendChild(
          make(
            'p',
            'proc-hint',
            'The outputs written in this run stay private to it, under executions/' +
              activeRun.id +
              '/outputs/: they travel with the run to the administrator.',
          ),
        )
      } else {
        bodyEl.appendChild(
          make(
            'p',
            null,
            'Your choice is recorded as an answer in this console. Nothing has been sent yet. To register this run with your AI agent:',
          ),
        )
        var agentSteps = make('ol', 'proc-handoff-steps')
        agentSteps.appendChild(
          make(
            'li',
            null,
            'Use "Save your response" at the top of this view to save your response and your choice in the console file.',
          ),
        )
        agentSteps.appendChild(
          make(
            'li',
            null,
            'Copy the prompt below and paste it to your AI agent, filling in where you saved the file.',
          ),
        )
        bodyEl.appendChild(agentSteps)
        var area = make('textarea', 'proc-handoff-prompt')
        area.value = handoffAgentPrompt(activeRun.id)
        area.readOnly = true
        area.setAttribute('rows', '10')
        area.setAttribute('aria-label', 'Prompt for the AI agent')
        area.setAttribute('data-proc-handoff-prompt', '')
        bodyEl.appendChild(area)
        var status = make('div', 'proc-hint')
        status.setAttribute('role', 'status')
        status.setAttribute('aria-live', 'polite')
        status.setAttribute('data-proc-handoff-status', '')
        bodyEl.appendChild(status)
        var selectToCopy = function () {
          area.focus()
          area.select()
          if (typeof area.setSelectionRange === 'function')
            area.setSelectionRange(0, area.value.length)
          var ok = false
          try {
            ok = typeof document.execCommand === 'function' && document.execCommand('copy') === true
          } catch (e) {
            ok = false
          }
          status.textContent = ok
            ? 'Copied to the clipboard.'
            : 'Select and copy: the prompt is selected, press Ctrl+C (Cmd+C on a Mac).'
        }
        copyBtn = button(
          'nn-edit-btn nn-edit-btn-save',
          'Copy prompt',
          function () {
            var win = document.defaultView || GLOBAL
            var clip = win.navigator && win.navigator.clipboard
            if (clip && typeof clip.writeText === 'function') {
              var pending
              try {
                pending = Promise.resolve(clip.writeText(area.value))
              } catch (e) {
                pending = Promise.reject(e)
              }
              pending.then(function () {
                status.textContent = 'Copied to the clipboard.'
              }, selectToCopy)
            } else {
              selectToCopy()
            }
          },
          { 'data-proc-handoff-copy': '' },
        )
      }
      dialog.appendChild(bodyEl)

      var actions = make('div', 'nn-edit-modal-actions')
      if (copyBtn) actions.appendChild(copyBtn)
      actions.appendChild(
        button('nn-edit-btn nn-edit-btn-cancel', 'Close', dismiss, {
          'data-proc-handoff-close': '',
        }),
      )
      dialog.appendChild(actions)

      ;(document.body || container).appendChild(dialog)
      try {
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', 'open')
      } catch (e) {
        dialog.setAttribute('open', 'open')
      }
      var first = copyBtn || actions.lastChild
      if (first && typeof first.focus === 'function') first.focus()
    }

    /**
     * The run is complete: the person chooses what happens to its result. The choice is one
     * draft; nothing is written until the saved response is imported, and what is recorded is
     * the choice itself. Each choice also opens a modal that says what to do next (guidance
     * only: it writes nothing).
     */
    function renderHandoff(hostEl) {
      var box = make('section', 'exec-step-card nn-card proc-handoff')
      box.setAttribute('data-proc-handoff', activeRun.id)
      box.appendChild(make('h3', 'exec-step-title', 'Hand off this run'))
      var recorded = activeRun.handoff
      var draft = handoffDraftOf(activeRun)
      if (recorded) {
        // An import already recorded the choice: it is done, and it is never offered again.
        var done = HANDOFF_CHOICES.filter(function (c) {
          return c[0] === recorded.choice
        })[0]
        box.appendChild(
          make(
            'div',
            'exec-step-fact',
            'Handed off: ' +
              (done ? done[1] : recorded.choice) +
              ' (recorded by ' +
              recorded.by +
              ', ' +
              dateText(recorded.at) +
              ').',
          ),
        )
      } else if (draft) {
        var label = HANDOFF_CHOICES.filter(function (c) {
          return c[0] === draft.choice
        })[0]
        var chosen = make('div', 'exec-step-fact')
        chosen.appendChild(
          make(
            'span',
            null,
            'Your choice: ' + (label ? label[1] : draft.choice) + ' (not sent yet). ',
          ),
        )
        chosen.appendChild(
          button(
            'proc-undo',
            'Undo',
            function () {
              removeDraft(draft.id)
            },
            { 'data-proc-undo': draft.id || '' },
          ),
        )
        chosen.appendChild(
          button(
            'proc-response-secondary',
            'Show instructions',
            function () {
              openHandoffDialog(draft.choice)
            },
            {
              'data-proc-handoff-open': draft.choice,
              'aria-label': 'Show instructions for: ' + (label ? label[1] : draft.choice),
            },
          ),
        )
        box.appendChild(chosen)
        box.appendChild(
          make('div', 'proc-hint', 'Save your response to send your choice with the rest of it.'),
        )
      } else {
        box.appendChild(
          make(
            'div',
            'proc-hint',
            'This run is complete. Choose what happens with its result. Nothing is added to the domaiNN until you save your response and the owner of the domaiNN imports it.',
          ),
        )
        var actions = make('div', 'proc-actions')
        HANDOFF_CHOICES.forEach(function (c) {
          actions.appendChild(
            button(
              'proc-action',
              c[1],
              function () {
                try {
                  store.propose({ kind: 'run_handoff', run: activeRun.id, choice: c[0] })
                } catch (e) {
                  savedNote =
                    'The console refused this choice: ' + String(e && e.message ? e.message : e)
                }
                render()
                if (handoffDraftOf(activeRun)) openHandoffDialog(c[0])
              },
              { 'data-proc-handoff-choice': c[0] },
            ),
          )
        })
        box.appendChild(actions)
      }
      hostEl.appendChild(box)
    }

    // ---- Actions a human may record (a DRAFT, never an apply) ----
    // This mirrors what `procedure_record` would accept for the step the fold points at.
    // It is a client-side guard only: it stops a draft that `apply_change` would reject.
    // `finish` and `cancel` are absent on purpose — closing a run needs `close_model`,
    // which a console draft cannot emit.
    var ACTION_LABEL = {
      start: 'Start this step',
      wait: 'Mark waiting',
      complete: 'Mark as done',
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

    /** The next free request id on a run: never reuses one a draft or the run holds. */
    function nextRequestId(run) {
      var max = 0
      requestsOf(run)
        .concat(draftRequestsOf(run))
        .forEach(function (r) {
          var m = /^q-(\d+)$/.exec(String(r.id))
          if (m) max = Math.max(max, Number(m[1]))
        })
      return 'q-' + String(max + 1).padStart(3, '0')
    }

    /**
     * Records a `Step Request` for the runner to consume. This is a proposal, not a write to
     * the run: the row is intent, and only `procedure_record` acts on it. The `base_seq` pins
     * the state the person saw, so a request that arrives late is marked stale, not applied.
     */
    function runRequest(run, fields) {
      var name = nextRequestId(run)
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
        choices.push({ outcome: t.guard.token, next: t.to, label: labelOfToken(t.guard.token) })
      })
      return choices
    }

    /** The run's write counter: the seq a request pins, 0 when the export carried none. */
    function runSeq() {
      if (activeRun && typeof activeRun.seq === 'number') return activeRun.seq
      if (activeRun && activeRun.model && typeof activeRun.model.seq === 'number')
        return activeRun.model.seq
      return 0
    }

    /**
     * Records the person's request. `startFirst` is for a manual step the Runner has not started
     * yet: the answer is then two requests saved together, the start and the completion, so
     * one response is enough. A refused completion takes its start back; nothing is left unsent.
     */
    function recordAction(action, state, errorEl, pickedOutcome, hostEl, startFirst) {
      actionError = ''
      if (errorEl) errorEl.textContent = ''
      var step = state.currentStep
      var fields = {
        request_status: 'pending',
        action: action,
        step: step,
        base_seq: runSeq(),
      }
      var field =
        hostEl && hostEl.querySelector ? hostEl.querySelector('[data-proc-request-value]') : null
      var given = field && field.value ? String(field.value).trim() : ''
      if (action === 'fail' || action === 'wait') {
        // The value the runner needs (who it waits on, why it failed) comes from the note
        // field. A missing one refuses the request instead of sending a blank one.
        if (!given) {
          if (errorEl)
            errorEl.textContent =
              action === 'wait'
                ? 'A waiting step names who or what it waits on: write it in the note.'
                : 'A failed step names why it failed: write it in the note.'
          if (field && field.focus) field.focus()
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
        // The note travels with the decision: it stays on the request row as its reason.
        if (given) fields.requested_value = given
        // The deliverables travel on the completion only, never on its start.
        var outs = requestedOutputsOf(state, step)
        if (outs.error) {
          if (errorEl) errorEl.textContent = outs.error
          return
        }
        if (outs.value) fields.requested_outputs = outs.value
      }
      var saved, startDraft
      try {
        if (startFirst) {
          startDraft = runRequest(activeRun, {
            request_status: 'pending',
            action: 'start',
            step: step,
            base_seq: fields.base_seq,
          })
        }
        saved = runRequest(activeRun, fields)
        if (!saved && startDraft) store.remove(startDraft.id)
      } catch (err) {
        if (startDraft) store.remove(startDraft.id)
        // The console refuses the proposal (a read-only export, a malformed draft). Say
        // so here: an exception thrown under a click is invisible otherwise, and the
        // person is left wondering why nothing happened.
        actionError =
          'The console refused this request: ' + String(err && err.message ? err.message : err)
        if (errorEl) errorEl.textContent = actionError
        return
      }
      if (!saved) {
        actionError = 'The console did not accept this request.'
        if (errorEl) errorEl.textContent = actionError
        return
      }
      selectedStep = null
      savedNote = null
      render()
    }

    // ---- Private run outputs: the deliverable a person writes for their step ----
    // The completion carries it as `requested_outputs` (executions spec): the runner stores it
    // under executions/<run>/outputs/ and validates it. Only `file` outputs can travel this way.
    var OUTPUT_MAX_BYTES = 256 * 1024

    function utf8Length(text) {
      var s = String(text)
      var n = 0
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
        if (c < 0x80) n += 1
        else if (c < 0x800) n += 2
        else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
          n += 4
          i++
        } else n += 3
      }
      return n
    }

    function outputDefOf(slug) {
      var defs = (active.graph && active.graph.artifacts) || {}
      return defs[slug] || null
    }

    function outputLabelOf(slug) {
      var def = outputDefOf(slug)
      return (def && def.name) || slug
    }

    /** The declared file outputs of a step that this step has not validated yet. */
    function pendingOutputsOf(state, slug) {
      var step = stepsOf(active)[slug]
      var rows = (state && state.artifacts) || {}
      return ((step && step.outputs) || []).filter(function (a) {
        var def = outputDefOf(a)
        if (!def || (def.kind && def.kind !== 'file')) return false
        var row = rows[a]
        return !(row && row.status === 'validated' && row.step === slug)
      })
    }

    function outputKey(step, artifact) {
      return [activeRun ? activeRun.id : '', step, artifact].join('\u0000')
    }

    function outputDraftOf(step, artifact) {
      return outputDrafts[outputKey(step, artifact)] || { text: '', name: '' }
    }

    function setOutputDraft(step, artifact, patch) {
      var key = outputKey(step, artifact)
      var cur = outputDrafts[key] || { text: '', name: '' }
      outputDrafts[key] = {
        text: patch.text !== undefined ? patch.text : cur.text,
        name: patch.name !== undefined ? patch.name : cur.name,
      }
    }

    /** The required outputs of the step still empty: they block the completion. */
    function missingOutputsOf(state, step) {
      return pendingOutputsOf(state, step).filter(function (a) {
        var def = outputDefOf(a)
        return def.required !== false && !outputDraftOf(step, a).text.trim()
      })
    }

    /**
     * The `requested_outputs` value of a completion: the one-line JSON of the non-empty
     * outputs, or an error that refuses the request. No output written means no field.
     */
    function requestedOutputsOf(state, step) {
      var missing = missingOutputsOf(state, step)
      if (missing.length) {
        return {
          error:
            'Write or load the required deliverable before completing: ' +
            missing.map(outputLabelOf).join(', ') +
            '.',
        }
      }
      var map = {}
      var any = false
      var tooBig = []
      pendingOutputsOf(state, step).forEach(function (a) {
        var draft = outputDraftOf(step, a)
        if (!draft.text.trim()) return
        if (utf8Length(draft.text) > OUTPUT_MAX_BYTES) tooBig.push(outputLabelOf(a))
        var entry = {}
        var name = draft.name.trim()
        if (name) entry.name = name
        entry.text = draft.text
        map[a] = entry
        any = true
      })
      if (tooBig.length) {
        return {
          error:
            'A deliverable is larger than 256 KiB and cannot be sent from the console: ' +
            tooBig.join(', ') +
            '. Shorten it, or ask your agent to record it.',
        }
      }
      return { value: any ? JSON.stringify(map) : null }
    }

    /**
     * One editor per output the step still has to produce: the text, a text file to load it
     * from, and an optional file name. What is typed lives in `outputDrafts`; `onChange` lets
     * the caller enable the completion once every required output has text.
     */
    function renderOutputEditors(hostEl, state, step, errorEl, onChange) {
      pendingOutputsOf(state, step).forEach(function (a) {
        var def = outputDefOf(a)
        var draft = outputDraftOf(step, a)
        var label = outputLabelOf(a)
        var box = make('div', 'proc-output proc-start-field')
        box.setAttribute('data-proc-output-box', a)
        box.appendChild(
          make(
            'div',
            'proc-start-label',
            'Your deliverable: ' + label + (def.required === false ? ' (optional)' : ''),
          ),
        )
        var area = make('textarea', 'proc-action-value proc-output-text')
        area.setAttribute('rows', '6')
        area.setAttribute('data-proc-output', a)
        area.setAttribute('aria-label', 'Your deliverable: ' + label)
        area.setAttribute('placeholder', 'Write the deliverable here, or load a text file.')
        area.value = draft.text
        area.addEventListener('input', function () {
          setOutputDraft(step, a, { text: area.value })
          onChange()
        })
        box.appendChild(area)

        var row = make('div', 'proc-output-file-row')
        var pickLabel = make('label', 'proc-output-file')
        pickLabel.appendChild(make('span', null, 'Load a text file '))
        var picker = make('input')
        picker.type = 'file'
        picker.setAttribute('accept', '.md,.txt,.csv,.json,.yaml,.yml,text/*')
        picker.setAttribute('data-proc-output-file', a)
        pickLabel.appendChild(picker)
        row.appendChild(pickLabel)
        var nameInput = make('input', 'proc-action-value proc-output-name')
        nameInput.type = 'text'
        nameInput.value = draft.name
        nameInput.setAttribute('data-proc-output-name', a)
        nameInput.setAttribute('aria-label', 'File name (optional) for ' + label)
        nameInput.setAttribute('placeholder', 'File name (optional), for example ' + a + '.md')
        nameInput.addEventListener('input', function () {
          setOutputDraft(step, a, { name: nameInput.value })
        })
        row.appendChild(nameInput)
        box.appendChild(row)

        picker.addEventListener('change', function () {
          var file = picker.files && picker.files[0]
          if (!file) return
          if (typeof file.size === 'number' && file.size > OUTPUT_MAX_BYTES) {
            if (errorEl)
              errorEl.textContent =
                'The file "' +
                file.name +
                '" is larger than 256 KiB and cannot be sent from the console.'
            return
          }
          var win = document.defaultView || GLOBAL
          var Reader = win && win.FileReader
          if (typeof Reader !== 'function') {
            if (errorEl)
              errorEl.textContent =
                'This browser cannot read the file here: paste its text instead.'
            return
          }
          var reader = new Reader()
          reader.onload = function () {
            var text = String(reader.result || '')
            area.value = text
            nameInput.value = file.name || ''
            setOutputDraft(step, a, { text: text, name: nameInput.value })
            if (errorEl) errorEl.textContent = ''
            onChange()
          }
          reader.onerror = function () {
            if (errorEl) errorEl.textContent = 'The file "' + file.name + '" could not be read.'
          }
          reader.readAsText(file)
        })
        hostEl.appendChild(box)
      })
    }

    function renderActions(hostEl, state) {
      if (!store) return
      var list = allowedActionsOf(state, activeRun)
      if (!list.length) return
      var box = make('div', 'proc-actions')
      var err = make('div', 'proc-action-error', actionError)

      // A step a person already asked about shows the ask: a second request on the same step
      // would be a second intent for one decision. An unsent answer is shown (and undone) by
      // the "Decided" line above; a recorded one waits for the agent.
      var waiting = state.currentStep ? pendingRequestFor(activeRun, state.currentStep) : null
      if (waiting) {
        var msg = waiting.isDraft
          ? 'Your answer on this step is not sent yet. Save your response to send it.'
          : 'Waiting for the agent: a "' +
            waiting.action +
            '" request on this step is pending. It acts on procedure_record.'
        var note = make('div', 'proc-action-waiting', msg)
        note.setAttribute('data-proc-waiting', waiting.action)
        box.appendChild(note)
        hostEl.appendChild(box)
        return
      }

      // Only the actions a request can carry: the queue never closes a run.
      // A manual step (`executor: human`) allows a person to ask for `start`.
      var stepDef = state.currentStep ? stepsOf(active)[state.currentStep] : null
      var isManual = isHumanStep(stepDef)
      var askable = list.filter(function (a) {
        if (a === 'start') return isManual
        return a === 'wait' || a === 'complete' || a === 'fail'
      })
      if (!askable.length || isSystemStep(stepDef)) {
        var hint = make('details', 'proc-agent-hint')
        hint.setAttribute('data-proc-agent-hint', '')
        hint.appendChild(make('summary', null, 'Copy instruction for the agent'))
        var instruction = agentInstruction(state)
        var pre = make('pre', 'proc-agent-hint-text', instruction)
        hint.appendChild(pre)
        hint.appendChild(
          button('proc-copy', 'Copy', function () {
            copyText(instruction)
          }),
        )
        box.appendChild(hint)
        hostEl.appendChild(box)
        return
      }
      box.appendChild(make('div', 'proc-actions-title', 'Your answer'))

      var targets = Array.isArray(state.allowedNext) ? state.allowedNext : []
      // A manual step not started yet is answered in one go: the start travels with the answer.
      var startFirst =
        askable.indexOf('start') !== -1 &&
        (outcomeChoices(state).length > 1 || (stepDef.stepType === 'task' && targets.length <= 1))
      var completes = startFirst || askable.indexOf('complete') !== -1
      var choices = completes ? outcomeChoices(state) : []
      // The completion waits for every required deliverable: these buttons stay disabled
      // until each one has text, and the hint names what is missing.
      var gated = []
      var outputHint = make('div', 'proc-hint proc-output-hint')
      outputHint.setAttribute('data-proc-output-hint', '')
      outputHint.setAttribute('aria-live', 'polite')
      var syncOutputs = function () {
        var missing = missingOutputsOf(state, state.currentStep)
        gated.forEach(function (b) {
          b.disabled = missing.length > 0
        })
        outputHint.textContent = missing.length
          ? 'Write or load the required deliverable before completing: ' +
            missing.map(outputLabelOf).join(', ') +
            '.'
          : ''
      }
      if (completes && pendingOutputsOf(state, state.currentStep).length) {
        renderOutputEditors(box, state, state.currentStep, err, syncOutputs)
        box.appendChild(outputHint)
      }
      var primary = make('div', 'proc-branches')
      if (choices.length > 1) {
        // One primary button per branch: the person answers the question in one click.
        choices.forEach(function (c) {
          var b = button(
            'proc-action proc-branch-choice',
            c.label,
            function () {
              recordAction('complete', state, err, c.outcome, box, startFirst)
            },
            { 'data-proc-action': 'complete', 'data-proc-outcome': c.outcome },
          )
          b.setAttribute('title', c.label + ' → ' + stepName(c.next))
          gated.push(b)
          primary.appendChild(b)
        })
      } else if (completes && targets.length <= 1) {
        var done = button(
          'proc-action proc-branch-choice',
          ACTION_LABEL.complete,
          function () {
            recordAction('complete', state, err, '', box, startFirst)
          },
          { 'data-proc-action': 'complete' },
        )
        gated.push(done)
        primary.appendChild(done)
      }
      syncOutputs()
      if (!startFirst && askable.indexOf('start') !== -1) {
        primary.appendChild(
          button(
            'proc-action proc-branch-choice',
            ACTION_LABEL.start,
            function () {
              recordAction('start', state, err, '', box)
            },
            { 'data-proc-action': 'start' },
          ),
        )
      }
      if (primary.children.length) box.appendChild(primary)

      if (askable.indexOf('wait') !== -1 || askable.indexOf('fail') !== -1 || choices.length) {
        var valueField = make('textarea', 'proc-action-value')
        valueField.setAttribute('rows', '2')
        valueField.setAttribute('data-proc-request-value', '')
        valueField.setAttribute('data-proc-reason', '')
        valueField.setAttribute('aria-label', 'Note')
        valueField.setAttribute(
          'placeholder',
          'Add a note (optional; required to fail or to mark waiting)',
        )
        box.appendChild(valueField)
      }

      var secondary = make('div', 'proc-actions-secondary')
      ;['wait', 'fail'].forEach(function (action) {
        if (askable.indexOf(action) === -1) return
        secondary.appendChild(
          button(
            'proc-action proc-action-secondary',
            ACTION_LABEL[action],
            function () {
              recordAction(action, state, err, '', box)
            },
            { 'data-proc-action': action },
          ),
        )
      })
      if (secondary.children.length) box.appendChild(secondary)
      box.appendChild(err)
      hostEl.appendChild(box)
    }

    function copyText(text) {
      try {
        var nav = host.navigator
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
          var p = nav.clipboard.writeText(text)
          if (p && typeof p.catch === 'function') p.catch(function () {})
        }
      } catch {
        /* the instruction stays visible to copy by hand */
      }
    }

    /** The runner call that records the next fact of this run, for the domain owner's agent. */
    function agentInstruction(state) {
      var ref = JSON.stringify({ run: activeRun.id })
      return (
        'Next action (agent): procedure_state ' +
        ref +
        ' lists the allowed actions; procedure_record ' +
        ref.slice(0, -1) +
        ', "action": …} records ' +
        (state.drift
          ? 'the rebase onto the new definition.'
          : state.currentStep
            ? 'the next fact of step ' + stepName(state.currentStep) + '.'
            : 'the terminal event.')
      )
    }

    // ---- Run panel ----
    function renderRunPanel(hostEl, headShown) {
      var col = make('div', 'exec-log-col')
      hostEl.appendChild(col)
      var panel = make('div', 'proc-run-state')
      col.appendChild(panel)
      if (!activeRun) {
        panel.appendChild(
          make(
            'p',
            null,
            'No run selected: this is the procedure definition.' +
              (store ? ' Use "Start a run" to request one.' : ''),
          ),
        )
        return
      }
      var recorded = activeRun.state
      // The run bar above already names the run, its status, its current step and the path
      // travelled. Only the degenerate path (the export carries no definition) has no bar,
      // and there this head is the only thing that says which run is on screen.
      if (!headShown) {
        panel.appendChild(
          make(
            'div',
            'proc-run-title',
            'Run ' + activeRun.id + (activeRun.closed ? ' (closed)' : ''),
          ),
        )
      }
      if (!recorded) {
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
      var state = viewState()
      var projected = state !== recorded
      if (!headShown && projected) {
        var pending = make(
          'div',
          'proc-run-projected',
          'Showing the run with your answers applied. They are not sent yet.',
        )
        pending.setAttribute('data-proc-projected', '')
        panel.appendChild(pending)
      }
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
      var artifactSlugs = Object.keys(state.artifacts).filter(function (slug) {
        // Only the artifacts this procedure declares: a stray row is not part of the run.
        return !active.graph || !active.graph.artifacts || active.graph.artifacts[slug]
      })
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
      var details = detailsBox('proc-run-details')
      // "Allowed next" is what the step's guards permit, which is meaningless when the fold
      // says the run cannot advance. A blocked step would read as if its branches were open.
      // It is the one line that answers "what happens next", so it stays outside the fold.
      var allowedEl = null
      if (
        state.allowedNext.length &&
        !state.blockedBy &&
        !state.drift &&
        !TERMINAL_RUN[state.status]
      ) {
        allowedEl = make(
          'div',
          'proc-run-allowed',
          'Allowed next: ' +
            state.allowedNext
              .map(function (tr) {
                return stepName(tr.to) + ' (' + guardText(tr.guard) + ')'
              })
              .join(', '),
        )
      }
      details.appendChild(make('div', 'proc-run-seq', 'Run seq: ' + runSeq()))
      // The path travelled is reference material, not a headline: it grows with the run and
      // used to push the status badge off the bar.
      details.appendChild(
        make('div', 'proc-run-path', 'Path: ' + state.path.map(stepName).join(' → ')),
      )
      if (!activeRun.closed && !TERMINAL_RUN[recorded.status]) {
        details.appendChild(make('div', 'proc-run-next', agentInstruction(recorded)))
      }
      if (allowedEl) panel.appendChild(allowedEl)
      panel.appendChild(details)
      renderRequestQueue(col)
    }

    /**
     * The queue of requests on this run, oldest first, with the status the runner gave each
     * one. It is the same list `procedure_pending` returns: an agent drains it, a person reads
     * what happened to what they asked for.
     */
    function renderRequestQueue(hostEl) {
      var all = requestsOf(activeRun)
      if (!all.length) return
      var box = make('div', 'proc-run-requests')
      hostEl.appendChild(make('div', 'exec-col-header', 'Requests'))
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
      hostEl.appendChild(box)
    }

    // ---- Artifacts panel (Tab 'artifacts') ----
    function renderArtifactPanel(hostEl) {
      var pad = make('div', 'pad')
      var artMap = (active.graph && active.graph.artifacts) || {}
      var slugs = Object.keys(artMap)
      var state = viewState()
      var table = make('table', 'proc-artifacts-table')
      var thead = make('thead')
      var htr = make('tr')
      ;['Artifact', 'Produced by', 'State', 'File'].forEach(function (h) {
        htr.appendChild(make('th', null, h))
      })
      thead.appendChild(htr)
      table.appendChild(thead)
      var tbody = make('tbody')
      slugs.forEach(function (slug) {
        var def = artMap[slug] || {}
        var st = state && state.artifacts ? state.artifacts[slug] : null
        var tr = make('tr')
        tr.setAttribute('data-proc-artifact-item', slug)
        var td1 = make('td')
        td1.appendChild(artifactChip(slug))
        tr.appendChild(td1)
        var td2 = make('td', 'dim')
        var producer = (def.producers || [])[0] || (st && st.step) || '—'
        td2.textContent =
          producer !== '—' && stepsOf(active)[producer] ? stepName(producer) : producer
        tr.appendChild(td2)
        var td3 = make('td')
        var status = st ? st.status : 'expected'
        td3.appendChild(
          make(
            'span',
            'badge ' + (status === 'validated' || status === 'produced' ? 'done' : status),
            status,
          ),
        )
        tr.appendChild(td3)
        var td4 = make('td', 'mono dim')
        td4.textContent =
          filePathOf(slug, def) || fillSlots(def.path || def.verify || '—', values())
        tr.appendChild(td4)
        tbody.appendChild(tr)
      })
      table.appendChild(tbody)
      pad.appendChild(table)
      if (slugs.length) {
        var artBox = make('div', 'proc-run-artifacts')
        artBox.appendChild(make('div', 'proc-run-artifacts-label', 'Artifacts'))
        var artList = make('div', 'proc-artifact-list')
        slugs.forEach(function (slug) {
          artList.appendChild(artifactChip(slug))
        })
        artBox.appendChild(artList)
        pad.appendChild(artBox)
      }
      hostEl.appendChild(pad)
    }

    // ---- BDE Run Bar ----
    function renderBdeRunBar(hostEl) {
      var bar = make('div', 'proc-runbar proc-run-state-bar')
      var stepsCount = Object.keys(stepsOf(active)).length
      var artCount = Object.keys((active.graph && active.graph.artifacts) || {}).length
      var defRev = (active.graph && active.graph.defRev) || 'v1'
      if (!activeRun) {
        bar.appendChild(make('span', 'mono id proc-run-title', active.file))
        bar.appendChild(make('span', 'badge pending proc-run-status', 'definition'))
        bar.appendChild(make('span', 'sep'))
        bar.appendChild(
          make(
            'span',
            'path proc-run-path',
            stepsCount + ' steps · ' + artCount + ' artifacts · pinned ' + defRev,
          ),
        )
        bar.appendChild(make('span', 'spacer'))
        bar.appendChild(
          make(
            'span',
            'mono faint',
            'No run selected: this is the procedure definition.' +
              (store ? ' Use "Start a run" to request one.' : ''),
          ),
        )
        if (store && active.graph && !/^bluepriNNt:/.test(active.file)) {
          bar.appendChild(
            button(
              'btn btn-sm proc-start-run' + (startFormOpen ? ' active' : ''),
              'Start a run',
              function () {
                startFormOpen = !startFormOpen
                render()
              },
              { 'data-proc-start-run': '' },
            ),
          )
        }
        hostEl.appendChild(bar)
        return
      }
      var recorded = activeRun.state
      bar.appendChild(
        make(
          'span',
          'mono id proc-run-title',
          'Run ' + activeRun.id + (activeRun.closed ? ' (closed)' : ''),
        ),
      )
      if (!recorded) {
        bar.appendChild(make('span', 'badge pending proc-run-status', 'pending'))
        bar.appendChild(make('span', 'spacer'))
        bar.appendChild(make('span', 'mono faint', 'The definition is not in this export.'))
        hostEl.appendChild(bar)
        return
      }
      var state = viewState()
      var projected = state !== recorded
      bar.appendChild(
        make('span', 'badge ' + state.status + ' proc-run-status', 'Status: ' + state.status),
      )
      bar.appendChild(make('span', 'sep'))
      bar.appendChild(
        make(
          'span',
          'proc-run-current',
          'Current step: ' + (state.currentStep ? stepName(state.currentStep) : 'none'),
        ),
      )
      bar.appendChild(make('span', 'sep'))
      if (projected) {
        var pending = make(
          'span',
          'badge warning proc-run-projected',
          'Showing the run with your answers applied. They are not sent yet.',
        )
        pending.setAttribute('data-proc-projected', '')
        bar.appendChild(pending)
      }
      if (state.drift) {
        bar.appendChild(
          make(
            'span',
            'proc-run-drift note warn',
            'Definition changed: the run is pinned to ' +
              state.drift.pinned +
              ', the procedure is now ' +
              state.drift.current +
              '.',
          ),
        )
      }
      bar.appendChild(make('span', 'spacer'))
      bar.appendChild(make('span', 'mono faint proc-run-seq', 'Run seq: ' + runSeq()))
      hostEl.appendChild(bar)
    }

    // ---- BDE Tab Bar ----
    function renderBdeTabBar(hostEl) {
      var bar = make('div', 'proc-tabbar tabbar')
      bar.setAttribute('role', 'tablist')
      var tabs = [
        { id: 'flow', label: 'Flow' },
        { id: 'requests', label: 'Requests', count: requestsOf(activeRun).length },
        {
          id: 'artifacts',
          label: 'Artifacts',
          count: Object.keys((active.graph && active.graph.artifacts) || {}).length,
        },
      ]
      tabs.forEach(function (t) {
        var isOn = activeTab === t.id
        var btn = button(
          'proc-tab-btn' + (isOn ? ' on' : ''),
          t.label,
          function () {
            activeTab = t.id
            render()
          },
          {
            'data-tab': t.id,
            role: 'tab',
            'aria-selected': isOn ? 'true' : 'false',
            // A tablist is one tab stop: the arrows move between tabs. No ids: the view
            // must be mountable twice on one page (`no global ids` in its test).
            tabindex: isOn ? '0' : '-1',
          },
        )
        if (t.count !== undefined && t.count > 0) {
          btn.appendChild(make('span', 'faint count', ' ' + t.count))
        }
        if (t.id === 'requests' && !activeRun) {
          btn.hidden = true
        }
        bar.appendChild(btn)
      })
      bar.addEventListener('keydown', function (ev) {
        var key = ev && ev.key
        if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return
        var items = Array.prototype.filter.call(bar.children, function (el) {
          return el && !el.hidden
        })
        var at = items.indexOf(document.activeElement)
        if (at < 0) return
        if (ev.preventDefault) ev.preventDefault()
        var nextIdx
        if (key === 'Home') nextIdx = 0
        else if (key === 'End') nextIdx = items.length - 1
        else if (key === 'ArrowRight') nextIdx = (at + 1) % items.length
        else nextIdx = (at - 1 + items.length) % items.length
        if (items[nextIdx] && items[nextIdx].focus) items[nextIdx].focus()
      })
      hostEl.appendChild(bar)
    }

    // ---- BDE Panels (Flow, Steps, Requests, Artifacts) ----
    function renderBdePanels(hostEl) {
      if (!activeRun && activeTab === 'requests') activeTab = 'flow'
      var graph = active.graph
      var state = viewState()
      var steps = graph && graph.steps ? graph.steps : {}
      var stepKeys = Object.keys(steps)
      var current = state ? state.currentStep : null
      var def = !activeRun

      // Panel 1: Flow
      var pFlow = make(
        'section',
        'proc-panel panel panel-flow' + (activeTab === 'flow' ? ' on' : ''),
      )
      pFlow.setAttribute('data-tab-panel', 'flow')
      pFlow.setAttribute('role', 'tabpanel')
      var padFlow = make('div', 'pad')
      var branches = stepKeys.some(function (slug) {
        return Array.isArray(steps[slug].next) && steps[slug].next.length > 1
      })
      var noteFlow = make(
        'div',
        'proc-flow-note path',
        def
          ? 'The document as defined: each step with its instructions. No run state, no executed sequence.'
          : branches
            ? 'Steps in the order of progress. The branches and where each one leads are drawn in the flow graph.'
            : 'A straight chain with no branches, in the order of progress. The flow graph shows the same steps.',
      )
      padFlow.appendChild(noteFlow)

      var stepperBox = make('div', 'proc-stepper')
      // One row per step: a marker, a toggle and, for the open step, its card in place. The
      // accordion keeps a single step open so the graph, the timeline and the card agree.
      var shown = selectedStep || (state ? state.currentStep : null) || graph.start || stepKeys[0]
      if (!shown || !steps[shown]) shown = stepKeys[0]
      stepKeys.forEach(function (slug, index) {
        var s = steps[slug]
        var st = def ? 'definition' : stepStatus(slug)
        var expanded = slug === shown
        var row = make('div', 'doc-step' + (expanded ? ' on' : ''))
        row.setAttribute('data-step', slug)
        var marker = make('span', 'proc-timeline-marker ' + st)
        marker.appendChild(make('span', 'proc-timeline-dot'))
        marker.appendChild(make('span', 'proc-timeline-number', String(index + 1).padStart(2, '0')))
        row.appendChild(marker)
        var content = make('div', 'proc-timeline-content')
        var toggle = button(
          'proc-step-toggle',
          s.name || slug,
          function () {
            selectedStep = slug
            render()
          },
          { 'aria-expanded': String(expanded), 'data-proc-step-toggle': slug },
        )
        toggle.appendChild(make('span', 'badge ' + st, st))
        content.appendChild(toggle)
        row.appendChild(content)
        if (expanded) {
          var detail = make('div', 'proc-detail-card detail')
          renderStepCard(detail)
          content.appendChild(detail)
        }
        stepperBox.appendChild(row)
      })
      padFlow.appendChild(stepperBox)
      pFlow.appendChild(padFlow)
      hostEl.appendChild(pFlow)

      // Panel 3: Requests
      var pReqs = make(
        'section',
        'proc-panel panel panel-requests' + (activeTab === 'requests' ? ' on' : ''),
      )
      pReqs.setAttribute('data-tab-panel', 'requests')
      pReqs.setAttribute('role', 'tabpanel')
      var padReqs = make('div', 'pad')
      renderRequestQueue(padReqs)
      pReqs.appendChild(padReqs)
      hostEl.appendChild(pReqs)

      // Panel 4: Artifacts
      var pArts = make(
        'section',
        'proc-panel panel panel-artifacts' + (activeTab === 'artifacts' ? ' on' : ''),
      )
      pArts.setAttribute('data-tab-panel', 'artifacts')
      pArts.setAttribute('role', 'tabpanel')
      renderArtifactPanel(pArts)
      hostEl.appendChild(pArts)
    }

    // ---- Persistent Rail (Flow DAG) ----
    // The graph keeps the column; the step card lives in the timeline row it belongs to, so
    // the person reads a step beside the graph instead of in a second scroll box.
    function renderBdeRail(hostEl) {
      renderGraph(hostEl)
    }

    // ---- Render ----
    function render() {
      // A rebuilt graph must hand the keyboard back to whoever was on it.
      var focusedNow = document.activeElement
      if (focusedNow && focusedNow.hasAttribute && focusedNow.hasAttribute('data-proc-graph'))
        refocusGraph = true
      disposeGraph()
      renderResponseBar()
      renderInbox()
      renderTabs()
      renderDiagnostics()
      body.innerHTML = ''
      renderFicha(body)
      if (!active.graph) {
        renderRunList(body)
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
      var ws = make('div', 'exec-workspace proc-bde-layout')
      body.appendChild(ws)

      // Right column: the flow graph, so the person reads what to do first and looks right
      // for where that step sits in the procedure.
      var rail = make('aside', 'proc-rail rail')
      renderBdeRail(rail)

      // Left column: the runs, the run state and the step timeline, whose rows open in place.
      // The start form takes the column while it is open, so preparing a run never competes
      // with the steps of a run the person is answering.
      var main = make('div', 'proc-main main')
      var nav = make('nav', 'proc-nav nav')
      renderBlueprintList(nav)
      renderTabs(nav)
      renderRunList(nav)
      main.appendChild(nav)
      if (startFormOpen && store) {
        renderStartForm(main)
      } else {
        renderBdeRunBar(main)
        renderBdeTabBar(main)
        renderBdePanels(main)
        renderRunPanel(main, true)
      }
      ws.appendChild(main)
      ws.appendChild(rail)
    }

    // The inbox is the front door: open on the first run that waits on this person.
    var firstTurn = store ? inboxOf(entries, allDrafts())[0] : null
    if (firstTurn) selectEntry(firstTurn.entry, firstTurn.run)
    else selectEntry(active)
    render()

    // Drafts change outside this view too (the Changes modal removes one): follow them.
    var unsubscribe = null
    if (store && typeof store.onChange === 'function') {
      try {
        unsubscribe = store.onChange(function () {
          render()
        })
      } catch {
        unsubscribe = null
      }
    }

    return {
      ok: true,
      procedures: entries.length,
      steps: Object.keys(stepsOf(active)).length,
      matrices: matrices.length,
      unmount: function () {
        if (typeof unsubscribe === 'function') unsubscribe()
        disposeGraph()
        container.innerHTML = ''
      },
    }
  }

  return {
    version: RENDERER_VERSION,
    RENDERER_VERSION: RENDERER_VERSION,
    SYSTEM_STEP_NOTE: SYSTEM_STEP_NOTE,
    mount: mount,
    fillSlots: fillSlots,
    slotValuesOf: slotValuesOf,
    shortHash: shortHash,
    inboxOf: inboxOf,
    eventsOfRequests: eventsOfRequests,
    projectRun: projectRun,
  }
})
