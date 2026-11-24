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

  /** The sentence an engine or agent step shows: the browser never runs it (S2). */
  var SYSTEM_STEP_NOTE = 'This step is run by the system when you send your response back.'

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

  var INBOX_RANK = { waiting: 0, active: 1, pending: 2 }

  /**
   * "Your turn": every open run whose current step is a human step nobody answered yet,
   * neither recorded nor drafted. Waiting steps first, then active, then not started; ties
   * by procedure file, then run id.
   */
  function inboxOf(entries, drafts) {
    var items = []
    ;(Array.isArray(entries) ? entries : []).forEach(function (entry) {
      if (!entry || !entry.graph) return
      ;(Array.isArray(entry.runs) ? entry.runs : []).forEach(function (run) {
        var state = run && run.state
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
        if (!passesFilter(run) && run !== activeRun) return
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
      if (startFormOpen && store) renderStartForm(hostEl)
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
      var fields = {}
      slots.forEach(function (s) {
        if (s.kind !== 'value') return
        var row = make('label', 'proc-start-field')
        row.appendChild(
          make(
            'span',
            'proc-start-label',
            labelOfToken(s.name) + (s.required ? '' : ' (optional)'),
          ),
        )
        var input = make('input', 'proc-start-input')
        input.setAttribute('type', 'text')
        input.setAttribute('name', s.name)
        input.setAttribute('data-proc-slot', s.name)
        if (s.default !== undefined) input.value = s.default
        if (s.description) input.setAttribute('placeholder', s.description)
        fields[s.name] = { input: input, slot: s }
        row.appendChild(input)
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
      if (blocked.length) submit.disabled = true
      form.addEventListener('submit', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault()
        err.textContent = ''
        var params = {}
        var missing = []
        Object.keys(fields).forEach(function (name) {
          var v = String(fields[name].input.value || '').trim()
          if (v) params[name] = v
          else if (fields[name].slot.required) missing.push(name)
        })
        if (missing.length) {
          err.textContent = 'Fill in ' + missing.join(', ') + ' to request the run.'
          return
        }
        try {
          store.propose({ kind: 'run_start', procedure: active.file, params: params })
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

    function renderGraph(hostEl) {
      var graph = active.graph
      var state = viewState()
      var svgNS = 'http://www.w3.org/2000/svg'
      var nodeW = 200
      var nodeH = 52
      var gapX = 24
      var gapY = 84
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
      var current = state ? state.currentStep : null
      Object.keys(graph.steps).forEach(function (slug) {
        graph.steps[slug].next.forEach(function (t) {
          if (!pos[t]) return
          var edge = document.createElementNS(svgNS, 'path')
          var x1 = pos[slug].x + nodeW / 2
          var y1 = pos[slug].y + nodeH
          var x2 = pos[t].x + nodeW / 2
          var y2 = pos[t].y
          var tStatus = stepStatus(t)
          var stepState = state && state.steps && state.steps[slug]
          var isTaken =
            (stepState && stepState.next === t) ||
            (isProjected(slug) &&
              stepStatus(slug) === 'done' &&
              ((stepState && stepState.next === t) || t === current))
          var isOff = tStatus === 'off_path'
          var isProj = isProjected(t) || (isProjected(slug) && isTaken)

          var edgeClasses = ['dag-edge', tStatus]
          if (isTaken) edgeClasses.push('taken')
          if (isOff) edgeClasses.push('off_path')
          if (isProj) edgeClasses.push('projected')
          edge.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2)
          edge.setAttribute('class', edgeClasses.join(' '))
          edge.setAttribute('data-from', slug)
          edge.setAttribute('data-to', t)
          svg.appendChild(edge)
          if (graph.steps[slug].next.length > 1) {
            // The token alone, just above the step it enters: every branch target has its
            // own column, so two labels never share a spot.
            var token = outcomeTokenOf(t) || graph.steps[t].condition
            if (token) {
              var label = document.createElementNS(svgNS, 'text')
              var labelClasses = ['dag-edge-label', tStatus]
              if (isTaken) labelClasses.push('taken')
              if (isOff) labelClasses.push('off_path')
              if (isProj) labelClasses.push('projected')
              label.setAttribute('class', labelClasses.join(' '))
              label.setAttribute('x', x2)
              label.setAttribute('y', y2 - 6)
              label.setAttribute('text-anchor', 'middle')
              label.textContent = token.length > 24 ? token.substring(0, 22) + '…' : token
              svg.appendChild(label)
            }
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
            (isProjected(slug) ? ' projected' : '') +
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
      var col = make('div', 'exec-dag-col flowcard card')
      var head = make('div', 'col-head exec-col-header')
      head.innerHTML = '<span>' + vIcon('workflow', 14) + ' Flow</span>'
      head.appendChild(
        make('span', 'count-badge count', Object.keys(graph.steps).length + ' steps'),
      )
      col.appendChild(head)
      var view = make('div', 'exec-dag-view graphbox')
      view.appendChild(svg)
      col.appendChild(view)
      col.appendChild(stepList(lay, current))
      var hint = make(
        'div',
        'rail-hint hint',
        !activeRun
          ? 'La forma del procedimiento. Se mantiene visible en todos los tabs.'
          : 'El nodo seleccionado es el que se abre abajo. Se mantiene visible en todos los tabs.',
      )
      col.appendChild(hint)
      hostEl.appendChild(col)
    }

    /** The same walk as a vertical list: what a phone shows instead of the graph. */
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
            selectedStep = slug
            render()
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
      return ol
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

    /** Shows the file's content in a panel inside the view: it reads, it never writes. */
    function showArtifact(def, path, embed) {
      var panel = container.querySelector('.proc-artifact-view')
      if (!panel) {
        panel = make('div', 'proc-artifact-view')
        root.appendChild(panel)
      }
      panel.innerHTML = ''
      var head = make('div', 'proc-artifact-view-head')
      head.appendChild(make('span', 'proc-artifact-view-title', (def && def.name) || path))
      head.appendChild(
        button('proc-artifact-view-close', 'Close', function () {
          panel.remove()
        }),
      )
      panel.appendChild(head)
      panel.appendChild(make('div', 'proc-artifact-view-path', path))
      panel.appendChild(embedBody(embed || { kind: 'text', text: '' }, path))
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
      if (isSystemStep(step) && running && status !== 'done' && status !== 'off_path') {
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

    function recordAction(action, state, errorEl, pickedOutcome, hostEl) {
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
      }
      var saved
      try {
        saved = runRequest(activeRun, fields)
      } catch (err) {
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

      var choices = askable.indexOf('complete') !== -1 ? outcomeChoices(state) : []
      var targets = Array.isArray(state.allowedNext) ? state.allowedNext : []
      var primary = make('div', 'proc-branches')
      if (choices.length > 1) {
        // One primary button per branch: the person answers the question in one click.
        choices.forEach(function (c) {
          var b = button(
            'proc-action proc-branch-choice',
            c.label,
            function () {
              recordAction('complete', state, err, c.outcome, box)
            },
            { 'data-proc-action': 'complete', 'data-proc-outcome': c.outcome },
          )
          b.setAttribute('title', c.label + ' → ' + stepName(c.next))
          primary.appendChild(b)
        })
      } else if (askable.indexOf('complete') !== -1 && targets.length <= 1) {
        primary.appendChild(
          button(
            'proc-action proc-branch-choice',
            ACTION_LABEL.complete,
            function () {
              recordAction('complete', state, err, '', box)
            },
            { 'data-proc-action': 'complete' },
          ),
        )
      }
      if (askable.indexOf('start') !== -1) {
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
    function renderRunPanel(hostEl) {
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
      panel.appendChild(
        make(
          'div',
          'proc-run-title',
          'Run ' + activeRun.id + (activeRun.closed ? ' (closed)' : ''),
        ),
      )
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
      if (projected) {
        var pending = make(
          'div',
          'proc-run-projected',
          'Showing the run with your answers applied. They are not sent yet.',
        )
        pending.setAttribute('data-proc-projected', '')
        panel.appendChild(pending)
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
      if (
        state.allowedNext.length &&
        !state.blockedBy &&
        !state.drift &&
        !TERMINAL_RUN[state.status]
      ) {
        details.appendChild(
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
      details.appendChild(make('div', 'proc-run-seq', 'Run seq: ' + runSeq()))
      if (!activeRun.closed && !TERMINAL_RUN[recorded.status]) {
        details.appendChild(make('div', 'proc-run-next', agentInstruction(recorded)))
      }
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
      bar.appendChild(
        make('span', 'path proc-run-path', 'Path: ' + state.path.map(stepName).join(' → ')),
      )
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
      var tabs = [
        { id: 'flow', label: 'Flow' },
        { id: 'steps', label: 'Steps' },
        { id: 'requests', label: 'Requests', count: requestsOf(activeRun).length },
        {
          id: 'artifacts',
          label: 'Artifacts',
          count: Object.keys((active.graph && active.graph.artifacts) || {}).length,
        },
      ]
      tabs.forEach(function (t) {
        var btn = button(
          'proc-tab-btn' + (activeTab === t.id ? ' on' : ''),
          t.label,
          function () {
            activeTab = t.id
            render()
          },
          { 'data-tab': t.id },
        )
        if (t.count !== undefined && t.count > 0) {
          btn.appendChild(make('span', 'faint count', ' ' + t.count))
        }
        if (t.id === 'requests' && !activeRun) {
          btn.hidden = true
        }
        bar.appendChild(btn)
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
      var padFlow = make('div', 'pad')
      var noteFlow = make(
        'div',
        'proc-flow-note path',
        def
          ? 'El documento tal como está definido: cada paso con sus instrucciones. Sin estado de run, sin secuencia ejecutada.'
          : 'Cadena lineal, sin ramas · el orden de avance. La topología vive en el rail de la derecha.',
      )
      padFlow.appendChild(noteFlow)

      var stepperBox = make('div', 'proc-stepper')
      if (def) {
        stepKeys.forEach(function (slug, i) {
          var s = steps[slug]
          var row = make(
            'div',
            'doc-step' + (slug === (selectedStep || graph.start || stepKeys[0]) ? ' on' : ''),
          )
          row.setAttribute('data-step', slug)
          var h3 = make('h3')
          h3.appendChild(make('span', 'idx', String(i + 1).padStart(2, '0')))
          h3.appendChild(document.createTextNode(' ' + (s.name || slug) + ' '))
          h3.appendChild(
            make(
              'span',
              'pill' + (s.stepType === 'decision' ? ' decision' : ''),
              s.stepType || 'task',
            ),
          )
          if (s.executor) h3.appendChild(make('span', 'pill', s.executor))
          if (s.outputs && s.outputs.length) {
            h3.appendChild(make('span', 'spacer'))
            h3.appendChild(make('span', 'sub', s.outputs.length + ' out'))
          }
          row.appendChild(h3)
          var el = elementOf(slug)
          if (el && el.description) {
            var inst = make('div', 'instructions')
            appendMarkdown(inst, fillSlots(el.description, values()))
            row.appendChild(inst)
          }
          row.addEventListener('click', function () {
            selectedStep = slug
            render()
          })
          stepperBox.appendChild(row)
        })
      } else {
        stepKeys.forEach(function (slug, i) {
          var s = steps[slug]
          var st = stepStatus(slug)
          var last = i === stepKeys.length - 1
          var lineCls = st === 'done' ? 'done' : st === 'failed' ? 'failed' : ''
          var row = make(
            'div',
            'step-row' +
              (slug === (selectedStep || current || graph.start || stepKeys[0]) ? ' on' : ''),
          )
          row.setAttribute('data-step', slug)
          var railCol = make('div', 'rail-col')
          var dot = make('div', 'dot ' + (st === 'pending' ? '' : st), MARK_SYMBOLS[st] || '○')
          railCol.appendChild(dot)
          if (!last) {
            var line = make('div', 'line ' + lineCls)
            railCol.appendChild(line)
          }
          row.appendChild(railCol)
          var bodyCol = make('div', 'body')
          var compact = make('div', 'compact')
          compact.appendChild(make('span', 't', s.name || slug))
          compact.appendChild(
            make(
              'span',
              'pill' + (s.stepType === 'decision' ? ' decision' : ''),
              s.stepType || 'task',
            ),
          )
          if (s.executor) compact.appendChild(make('span', 'pill', s.executor))
          compact.appendChild(make('span', 'spacer'))
          compact.appendChild(make('span', 'badge ' + st, st))
          bodyCol.appendChild(compact)
          row.appendChild(bodyCol)
          row.addEventListener('click', function () {
            selectedStep = slug
            render()
          })
          stepperBox.appendChild(row)
        })
      }
      padFlow.appendChild(stepperBox)
      pFlow.appendChild(padFlow)
      hostEl.appendChild(pFlow)

      // Panel 2: Steps (Master table)
      var pSteps = make(
        'section',
        'proc-panel panel panel-steps' + (activeTab === 'steps' ? ' on' : ''),
      )
      pSteps.setAttribute('data-tab-panel', 'steps')
      var padSteps = make('div', 'pad')
      var cardSteps = make('div', 'card')
      var headSteps = make('div', 'col-head')
      headSteps.appendChild(make('span', null, 'Steps'))
      headSteps.appendChild(
        make(
          'span',
          'count',
          def
            ? 'definición del documento · ' + stepKeys.length
            : 'orden de ejecución · ' + stepKeys.length,
        ),
      )
      cardSteps.appendChild(headSteps)
      var table = make('table', 'proc-steps-table')
      var thead = make('thead')
      var htr = make('tr')
      htr.appendChild(make('th', null))
      htr.appendChild(make('th', null, 'Step'))
      htr.appendChild(make('th', null, 'Type'))
      htr.appendChild(make('th', null, 'Executor'))
      if (def) {
        htr.appendChild(make('th', null, 'Inputs'))
        htr.appendChild(make('th', null, 'Outputs'))
      } else {
        var thDur = make('th', 'num', 'Attempt')
        thDur.style.textAlign = 'right'
        htr.appendChild(thDur)
        htr.appendChild(make('th', null, 'Artifacts'))
      }
      thead.appendChild(htr)
      table.appendChild(thead)
      var tbody = make('tbody')
      stepKeys.forEach(function (slug) {
        var s = steps[slug]
        var st = def ? 'definition' : stepStatus(slug)
        var tr = make('tr', slug === selectedStep ? 'on' : '')
        tr.setAttribute('data-step', slug)
        var td1 = make('td')
        var mark = make('span', 'dotmark ' + st, MARK_SYMBOLS[st] || '·')
        td1.appendChild(mark)
        tr.appendChild(td1)
        var td2 = make('td')
        if (slug === selectedStep) {
          td2.appendChild(make('b', null, s.name || slug))
        } else {
          td2.textContent = s.name || slug
        }
        tr.appendChild(td2)
        var td3 = make('td')
        td3.appendChild(
          make(
            'span',
            'pill' + (s.stepType === 'decision' ? ' decision' : ''),
            s.stepType || 'task',
          ),
        )
        tr.appendChild(td3)
        tr.appendChild(make('td', 'dim', s.executor || '—'))
        if (def) {
          var inText = s.inputs && s.inputs.length ? s.inputs.join(', ') : '—'
          var outText = s.outputs && s.outputs.length ? s.outputs.join(', ') : '—'
          tr.appendChild(make('td', s.inputs && s.inputs.length ? 'faint' : 'dim', inText))
          tr.appendChild(make('td', s.outputs && s.outputs.length ? 'faint' : 'dim', outText))
        } else {
          var stepState = state && state.steps ? state.steps[slug] : null
          var attText = stepState && stepState.attempt ? String(stepState.attempt) : '—'
          var artText = s.outputs && s.outputs.length ? s.outputs.length + ' out' : '—'
          var tdAtt = make('td', 'num', attText)
          tdAtt.style.textAlign = 'right'
          tr.appendChild(tdAtt)
          tr.appendChild(make('td', s.outputs && s.outputs.length ? 'faint' : 'dim', artText))
        }
        tr.addEventListener('click', function () {
          selectedStep = slug
          render()
        })
        tbody.appendChild(tr)
      })
      table.appendChild(tbody)
      cardSteps.appendChild(table)
      padSteps.appendChild(cardSteps)
      pSteps.appendChild(padSteps)
      hostEl.appendChild(pSteps)

      // Panel 3: Requests
      var pReqs = make(
        'section',
        'proc-panel panel panel-requests' + (activeTab === 'requests' ? ' on' : ''),
      )
      pReqs.setAttribute('data-tab-panel', 'requests')
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
      renderArtifactPanel(pArts)
      hostEl.appendChild(pArts)
    }

    // ---- Persistent Rail (Flow DAG + Step Detail + Run Panel) ----
    function renderBdeRail(hostEl) {
      renderGraph(hostEl)
      var detail = make('div', 'proc-detail-card detail')
      renderStepCard(detail)
      renderRunPanel(detail)
      hostEl.appendChild(detail)
    }

    // ---- Render ----
    function render() {
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

      // Column 1: Nav (Procedures + Runs)
      var nav = make('nav', 'proc-nav nav')
      renderBlueprintList(nav)
      renderTabs(nav)
      renderRunList(nav)
      ws.appendChild(nav)

      // Column 2: Main (Runbar + Tabbar + Panels)
      var main = make('div', 'proc-main main')
      renderBdeRunBar(main)
      renderBdeTabBar(main)
      renderBdePanels(main)
      ws.appendChild(main)

      // Column 3: Persistent Rail (Flow DAG + Step Detail + Run Panel)
      var rail = make('aside', 'proc-rail rail')
      renderBdeRail(rail)
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
