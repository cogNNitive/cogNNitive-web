/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.nnProcedureStepper = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var GLOBAL =
    typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
          ? globalThis
          : this

  var RENDERER_VERSION = '0.2.0'

  var STATUS_COLORS = {
    done: '#16a34a',
    active: '#0284c7',
    pending: '#94a3b8',
    warning: '#d97706',
    error: '#dc2626',
    skipped: '#64748b',
  }

  // Reuse the shared visual vocabulary when loaded (visuals.js); fall back to
  // local literals when the module is absent.
  var V = (GLOBAL.nnVisuals && typeof GLOBAL.nnVisuals === 'object') ? GLOBAL.nnVisuals : null

  function vIcon(name, size) {
    return V && typeof V.iconSvg === 'function' ? V.iconSvg(name, size || 14) : ''
  }

  var STEP_TYPE_ICONS = {
    task: '▢',
    decision: '◇',
    event: '◉',
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for the FSM stepper's future state-icon rendering
  var STATE_ICONS = {
    done: '✓',
    active: '▶',
    skipped: '↷',
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function mount(container, payload, hooks) {
    if (!container || typeof container.querySelector !== 'function') {
      return { ok: false, reason: 'no-container' }
    }
    // `document` is shadowed with the container's own document, so every
    // `document.createElement` below stays inside this view's DOM tree.
    var document = container.ownerDocument || (typeof globalThis !== 'undefined' ? globalThis.document : null)
    var doc = document
    var schema = (payload && payload.schema) || {}
    var model = (payload && payload.model) || {}
    var elements = Array.isArray(model.elements) ? model.elements : []
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var meta = model.meta || {}

    var byId = {}
    var byName = {}
    elements.forEach(function (el) {
      if (!el) return
      if (el.id) byId[el.id] = el
      if (el.name) byName[el.name] = el
    })

    var RT = GLOBAL.nnConsole
    if (!RT || typeof RT.buildTree !== 'function' || typeof RT.chainOf !== 'function') {
      container.innerHTML = '<div class="nn-empty-state"><p>Procedure runtime is not available.</p></div>'
      return {
        ok: false,
        unmount: function () {
          container.innerHTML = ''
        },
      }
    }

    var tree = RT.buildTree(elements)
    var nodeById = tree.nodes
    var procedures = tree.roots.filter(function (r) {
      return r.children && r.children.length > 0
    })

    // Build the procedures view DOM inside the container (no shell, no global ids).
    container.innerHTML = ''
    var root = doc.createElement('div')
    root.className = 'nn-procedure-view'

    // Structure summary & diagnostics strip (D8)
    var strip = doc.createElement('div')
    strip.className = 'proc-structure-strip'
    var summaryEl = doc.createElement('div')
    summaryEl.className = 'proc-structure-summary'
    summaryEl.textContent = tree.summary && tree.summary.formatted
      ? tree.summary.formatted
      : (procedures.length + ' procedures \u00b7 ' + (tree.summary ? tree.summary.steps : 0) + ' steps \u00b7 ' + (tree.summary ? tree.summary.ungrouped : 0) + ' ungrouped')
    strip.appendChild(summaryEl)

    if (tree.defects && tree.defects.length > 0) {
      var defectsEl = doc.createElement('div')
      defectsEl.className = 'proc-structure-defects'
      tree.defects.forEach(function (d) {
        var item = doc.createElement('div')
        item.className = 'proc-defect-item'
        item.setAttribute('data-defect-kind', d.kind)
        item.textContent = d.message || (d.kind + ': ' + d.element)
        defectsEl.appendChild(item)
      })
      strip.appendChild(defectsEl)
    }
    root.appendChild(strip)

    if (procedures.length === 0) {
      var emptyEl = doc.createElement('div')
      emptyEl.className = 'empty-state proc-empty-ungrouped'
      emptyEl.textContent = 'No procedures found. ' + (tree.summary ? tree.summary.ungrouped : 0) + ' ungrouped steps detected.'
      root.appendChild(emptyEl)
      container.appendChild(root)
      return {
        ok: true,
        unmount: function () {
          container.innerHTML = ''
        },
      }
    }

    var header = doc.createElement('div')
    header.className = 'proc-view-header'
    header.style.display = 'none'
    var titleEl = doc.createElement('h1')
    titleEl.className = 'proc-title'
    titleEl.textContent = meta.title || 'Procedures Console'
    header.appendChild(titleEl)
    var metaEl = doc.createElement('div')
    metaEl.className = 'meta-line'
    header.appendChild(metaEl)
    root.appendChild(header)

    var tabsHost = doc.createElement('div')
    tabsHost.className = 'proc-tabs'
    root.appendChild(tabsHost)
    var subTabsNav = doc.createElement('nav')
    subTabsNav.className = 'subtabs'
    var docTab = doc.createElement('button')
    docTab.className = 'subtab nn-proc-toggle-btn'
    docTab.setAttribute('type', 'button')
    docTab.textContent = 'View Document'
    subTabsNav.appendChild(docTab)
    root.appendChild(subTabsNav)
    var docBody = doc.createElement('div')
    docBody.className = 'procedures-doc hidden'
    root.appendChild(docBody)
    var wizardBody = doc.createElement('div')
    var stepProgress = doc.createElement('div')
    var stepBody = doc.createElement('div')
    wizardBody.appendChild(stepProgress)
    wizardBody.appendChild(stepBody)
    root.appendChild(wizardBody)
    container.appendChild(root)

    var bits = []
    if (meta.template) bits.push('<span><strong>Template</strong> ' + esc(meta.template) + '</span>')
    if (meta.modelVersion) bits.push('<span><strong>Model</strong> ' + esc(meta.modelVersion) + '</span>')
    if (meta.generated)
      bits.push(
        '<span><strong>Generated</strong> ' +
          esc(String(meta.generated).replace('T', ' ').replace(/\..*/, '')) +
          '</span>',
      )
    metaEl.innerHTML = bits.join('')

    // Blueprint procedure catalog (parent + includes). `usage` reads first,
    // labelled "Getting started"; the rest keep their declared names.
    // The export carries shadowed same-id entries too (never dropped silently);
    // the list shows only the ones that won.
    var blueprintProcedures = Array.isArray(schema.procedures)
      ? schema.procedures.filter(function (p) {
          return !(p && p.status === 'shadowed')
        })
      : []
    if (blueprintProcedures.length > 0) {
      blueprintProcedures.sort(function (a, b) {
        if (a && a.id === 'usage') return -1
        if (b && b.id === 'usage') return 1
        return 0
      })
      var procListEl = doc.createElement('div')
      procListEl.className = 'proc-blueprint-list'
      procListEl.setAttribute('data-nn-procedures', 'blueprint')
      var procLabelEl = doc.createElement('span')
      procLabelEl.className = 'proc-blueprint-label'
      procLabelEl.textContent = 'Procedures'
      procListEl.appendChild(procLabelEl)
      blueprintProcedures.forEach(function (p) {
        if (!p) return
        var itemEl = doc.createElement('span')
        itemEl.className =
          'proc-blueprint-item' + (p.id === 'usage' ? ' proc-blueprint-usage' : '')
        itemEl.setAttribute('data-procedure-id', p.id)
        itemEl.textContent = p.id === 'usage' ? 'Getting started' : p.name || p.id
        procListEl.appendChild(itemEl)
      })
      header.appendChild(procListEl)
    }

    // ---- Execution Runtime State ----
    var activeProcedure = procedures[0] || null
    var currentStepIndex = 0
    var stepStates = {} // { [stepId]: 'pending' | 'active' | 'done' | 'skipped' }
    var auditLogs = []
    var timerSeconds = 0
    var timerInterval = null
    var timerElRef = null
    var auditLogView = null
    var logDialog = null
    var refDialog = null

    function initRuntimeState() {
      stepStates = {}
      if (activeProcedure) {
        var chain = RT.chainOf(activeProcedure, nodeById)
        chain.forEach(function (step, i) {
          stepStates[step.el.id] = i === 0 ? 'active' : 'pending'
        })
      }
      auditLogs = []
      addLog('Procedure "' + (activeProcedure ? activeProcedure.el.name : 'Unknown') + '" initialized.', 'System', 'active')
      startTimer()
    }

    function startTimer() {
      if (timerInterval) clearInterval(timerInterval)
      timerSeconds = 0
      timerInterval = setInterval(function () {
        timerSeconds++
        if (timerElRef) {
          var mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0')
          var secs = String(timerSeconds % 60).padStart(2, '0')
          timerElRef.textContent = mins + ':' + secs
        }
      }, 1000)
    }

    function addLog(text, author, status) {
      var now = new Date()
      var timeStr = now.toTimeString().split(' ')[0]
      auditLogs.unshift({ time: timeStr, text: text, author: author || 'Operator', status: status || 'active' })
      renderAuditLog()
    }

    // ---- Reference popup (shared runtime capability) ----
    function openRef(element) {
      var rt = GLOBAL.nnConsole
      if (rt && typeof rt.renderRefDialog === 'function') {
        rt.renderRefDialog(document, element)
        return
      }
      // Fallback ref dialog, scoped to this view's container (never a global id).
      if (!refDialog) {
        refDialog = doc.createElement('dialog')
        refDialog.className = 'nn-ref-dialog'
        root.appendChild(refDialog)
      }
      var dialog = refDialog
      dialog.innerHTML = ''
      var h = document.createElement('h2')
      h.textContent = element && element.name ? element.name : 'Element'
      dialog.appendChild(h)
      var tag = document.createElement('span')
      tag.className = 'nn-ref-tag'
      tag.textContent = element && element.concept ? element.concept : 'Element'
      dialog.appendChild(tag)
      if (element && element.description) {
        var p = document.createElement('p')
        p.className = 'nn-ref-desc'
        p.textContent = element.description
        dialog.appendChild(p)
      }
      if (typeof dialog.showModal === 'function') dialog.showModal()
    }

    function appendWithKuPills(hostEl, rawText) {
      var text = String(rawText == null ? '' : rawText)
      var names = Object.keys(byName).filter(function (n) { return n && n.length >= 3 }).sort(function (a, b) { return b.length - a.length })
      var escapedNames = names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })
      var patternParts = ['\\bfb-\\d+\\b']
      if (escapedNames.length) patternParts.push(escapedNames.join('|'))
      var re = new RegExp('(' + patternParts.join('|') + ')', 'g')
      var lastIdx = 0
      var match
      while ((match = re.exec(text)) !== null) {
        if (match.index > lastIdx) {
          hostEl.appendChild(document.createTextNode(text.slice(lastIdx, match.index)))
        }
        var token = match[0]
        if (/^fb-\d+$/.test(token)) {
          var UIc = GLOBAL.nnUI
          if (UIc && typeof UIc.Ku === 'function') {
            hostEl.appendChild(UIc.Ku('element', { model: meta.modelId || '', id: token, label: token }, { doc: document }))
          } else {
            var chg = document.createElement('span')
            chg.className = 'nn-ku-field-chip'
            chg.textContent = token
            hostEl.appendChild(chg)
          }
        } else if (byName[token]) {
          var rb = refButton(token, token)
          hostEl.appendChild(rb.node)
        } else {
          hostEl.appendChild(document.createTextNode(token))
        }
        lastIdx = re.lastIndex
      }
      if (lastIdx < text.length) {
        hostEl.appendChild(document.createTextNode(text.slice(lastIdx)))
      }
    }

    function refButton(label, name) {
      var target = byName[name]
      if (!target) {
        var span = document.createElement('span')
        span.textContent = label
        return { node: span, ok: false }
      }
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
        var pillBadge = pill.querySelector('[data-nn-component="ku-unit"]')
        if (pillBadge) {
          pillBadge.setAttribute('role', 'button')
          pillBadge.setAttribute('tabindex', '0')
          pillBadge.addEventListener('click', function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault()
            openRef(target)
          })
        }
        return { node: pill, ok: true }
      }
      var b = document.createElement('button')
      b.className = 'chip-ref'
      b.setAttribute('type', 'button')
      b.textContent = label
      b.addEventListener('click', function () {
        openRef(target)
      })
      return { node: b, ok: true }
    }

    // ---- Concepts (kept for step colouring; rail/matrices/concept views are dropped) ----
    var concepts = (schema.concepts || []).slice()
    concepts.sort(function (a, b) {
      return (b.weight || 0) - (a.weight || 0)
    })

    function conceptColor(name) {
      var c = null
      concepts.forEach(function (x) {
        if (x && x.name === name) c = x
      })
      if (c && c.color) {
        if (V && typeof V.getHexColor === 'function') return V.getHexColor(c.color)
        return c.color
      }
      return '#171717'
    }

    // ---- Procedure view mode: Document (default) | Wizard ----
    var proceduresMode = 'wizard'

    function renderProcedures() {
      if (proceduresMode === 'wizard') {
        if (docBody) docBody.classList.add('hidden')
        if (wizardBody) wizardBody.classList.remove('hidden')
        if (docTab) docTab.textContent = 'View Document'
        renderExecutionWorkspace()
      } else {
        if (wizardBody) wizardBody.classList.add('hidden')
        if (docBody) docBody.classList.remove('hidden')
        if (docTab) docTab.textContent = 'View Workflow'
        renderDocument()
      }
    }

    if (docTab) {
      docTab.addEventListener('click', function () {
        proceduresMode = proceduresMode === 'wizard' ? 'document' : 'wizard'
        renderProcedures()
      })
    }

    // Document view: full procedure as a readable document (presentational).
    function renderDocument() {
      if (!docBody) return
      docBody.innerHTML = ''
      if (!activeProcedure) {
        docBody.innerHTML = '<div class="empty-state">No procedures found.</div>'
        return
      }
      var chain = RT.chainOf(activeProcedure, nodeById)
      if (!chain.length) {
        docBody.innerHTML = '<div class="empty-state">No steps in this procedure.</div>'
        return
      }
      chain.forEach(function (step, i) {
        var isRoot = i === 0
        var block = document.createElement(isRoot ? 'article' : 'section')
        block.className = isRoot ? 'doc-root' : 'doc-step'
        var h = document.createElement(isRoot ? 'h2' : 'h3')
        var iconName = step.fields.step_type || 'task'
        var svg = vIcon(iconName, 16)
        h.style.color = 'var(--nn-accent, #171717)'
        h.innerHTML =
          '<span class="step-type-icon">' +
          (svg || STEP_TYPE_ICONS[step.fields.step_type] || '•') +
          '</span> ' +
          esc(step.el.name || 'Step')
        block.appendChild(h)
        if (step.el.description) {
          var p = document.createElement('p')
          p.className = 'desc'
          p.textContent = step.el.description
          block.appendChild(p)
        }
        var chipsWrap = document.createElement('div')
        chipsWrap.className = 'chips'
        if (step.fields.scope) chipsWrap.appendChild(chip('Scope: ' + step.fields.scope, 'active'))
        if (!isRoot) {
          if (step.fields.condition) chipsWrap.appendChild(chip('IF: ' + step.fields.condition, 'warning'))
          if (step.fields.step_type) chipsWrap.appendChild(chip(step.fields.step_type, 'active'))
          if (step.fields.output_status) chipsWrap.appendChild(chip(step.fields.output_status, 'done'))
          if (step.fields.tool) {
            var toolRef = refButton(step.fields.tool, step.fields.tool)
            chipsWrap.appendChild(chipWithNode(toolRef.node, 'active'))
          }
        }
        if (chipsWrap.children.length) block.appendChild(chipsWrap)
        if (!isRoot) {
          var io = document.createElement('div')
          io.className = 'io'
          if (step.fields.input) io.appendChild(ioPill('Input', step.fields.input, 'in'))
          if (step.fields.output) io.appendChild(ioPill('Output', step.fields.output, 'out'))
          if (io.childNodes.length) block.appendChild(io)
          if (step.fields.step_type === 'decision') {
            var branchTargets = RT.nextSteps(step, nodeById)
            if (branchTargets.length >= 2) {
              var branchWrap = document.createElement('div')
              branchWrap.className = 'branch-outcomes'
              branchTargets.forEach(function (t) {
                var outcomeEl = document.createElement('div')
                outcomeEl.className = 'branch-outcome'
                outcomeEl.innerHTML = '<strong>Outcome:</strong> ' + esc(t.el.name || t.el.id) + (t.fields.condition ? ' <em>(IF: ' + esc(t.fields.condition) + ')</em>' : '')
                branchWrap.appendChild(outcomeEl)
              })
              block.appendChild(branchWrap)
            }
          }
        }
        docBody.appendChild(block)
      })
    }

    // ---- Procedure tabs ----
    function renderTabs() {
      if (!tabsHost) return
      tabsHost.innerHTML = ''
      procedures.forEach(function (p) {
        var b = document.createElement('button')
        b.className = 'proc-tab' + (p === activeProcedure ? ' active' : '')
        b.textContent = p.el.name || 'Procedure'
        b.setAttribute('type', 'button')
        b.addEventListener('click', function () {
          activeProcedure = p
          currentStepIndex = 0
          initRuntimeState()
          renderTabs()
          renderProcedures()
        })
        tabsHost.appendChild(b)
      })
    }

    // ---- RACI lookup ----
    var matrixNameCache = {}
    function matrixByIdName(name) {
      if (name in matrixNameCache) return matrixNameCache[name]
      for (var i = 0; i < matrices.length; i++) {
        if (matrices[i] && matrices[i].name === name) {
          matrixNameCache[name] = matrices[i]
          return matrices[i]
        }
      }
      matrixNameCache[name] = null
      return null
    }

    function rolesForStep(workName) {
      var mx = matrixByIdName('work-roles matrix')
      if (!mx) return []
      var rows = mx.rows || []
      var idx = rows.indexOf(workName)
      if (idx < 0) return []
      var cols = mx.cols || []
      var cells = mx.cells || {}
      var row = cells[rows[idx]] || {}
      var out = []
      cols.forEach(function (c) {
        var v = row[c]
        if (v) out.push({ label: c, value: v })
      })
      return out
    }

    // ---- Enhanced Execution Workspace (DAG + Stepper + Audit) ----
    function getProcedureMetadata(p) {
      if (!p || !p.el) return null
      var fields = p.el.fields || {}
      var m = {
        summary: fields.summary || '',
        category: fields.category || '',
        executed_by: fields.executed_by || '',
        inputs_required: fields.inputs_required || '',
        outputs_expected: fields.outputs_expected || '',
      }

      // Check linked Procedure elements
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i]
        if (el && el.concept === 'Procedure') {
          var matches = false
          if (el.fields && (el.fields.procedure_model === p.el.name || el.fields.procedure_model === p.el.id)) {
            matches = true
          }
          if (Array.isArray(el.relations)) {
            for (var r = 0; r < el.relations.length; r++) {
              var rel = el.relations[r]
              if (rel && (rel.name === 'procedure_model' || rel.label === 'procedure_model') && (rel.target === p.el.id || rel.target === p.el.name)) {
                matches = true
                break
              }
            }
          }
          if (matches && el.fields) {
            m.summary = m.summary || el.fields.summary || ''
            m.category = m.category || el.fields.category || ''
            m.executed_by = m.executed_by || el.fields.executed_by || ''
            m.inputs_required = m.inputs_required || el.fields.inputs_required || ''
            m.outputs_expected = m.outputs_expected || el.fields.outputs_expected || ''
          }
        }
      }

      // Check schema.procedures catalog entries
      if (Array.isArray(schema.procedures)) {
        for (var j = 0; j < schema.procedures.length; j++) {
          var sp = schema.procedures[j]
          if (sp && (sp.id === p.el.id || sp.name === p.el.name || sp.id === p.el.name)) {
            m.summary = m.summary || sp.summary || ''
            m.category = m.category || sp.category || ''
            m.executed_by = m.executed_by || sp.executed_by || ''
            m.inputs_required = m.inputs_required || sp.inputs_required || ''
            m.outputs_expected = m.outputs_expected || sp.outputs_expected || ''
          }
        }
      }

      var hasAny = Boolean(m.summary || m.category || m.executed_by || m.inputs_required || m.outputs_expected)
      return hasAny ? m : null
    }

    function renderFichaHeader(p) {
      var ficha = doc.createElement('div')
      ficha.className = 'proc-ficha'
      var m = getProcedureMetadata(p)
      if (!m) {
        var note = doc.createElement('div')
        note.className = 'proc-no-catalog-note'
        note.textContent = 'No catalog entry linked.'
        ficha.appendChild(note)
        return ficha
      }

      if (m.summary) {
        var s = doc.createElement('div')
        s.className = 'proc-ficha-summary'
        s.textContent = m.summary
        ficha.appendChild(s)
      }

      var tags = doc.createElement('div')
      tags.className = 'proc-ficha-tags'
      if (m.category) {
        var c = doc.createElement('span')
        c.className = 'proc-ficha-category'
        c.innerHTML = '<strong>Category:</strong> ' + esc(m.category)
        tags.appendChild(c)
      }
      if (m.executed_by) {
        var ex = doc.createElement('span')
        ex.className = 'proc-ficha-executed-by'
        ex.innerHTML = '<strong>Executed by:</strong> ' + esc(m.executed_by)
        tags.appendChild(ex)
      }
      if (tags.childNodes.length > 0) ficha.appendChild(tags)

      var io = doc.createElement('div')
      io.className = 'proc-ficha-io'
      if (m.inputs_required) {
        var inp = doc.createElement('div')
        inp.className = 'proc-ficha-inputs'
        inp.innerHTML = '<strong>Inputs required:</strong> ' + esc(m.inputs_required)
        io.appendChild(inp)
      }
      if (m.outputs_expected) {
        var out = doc.createElement('div')
        out.className = 'proc-ficha-outputs'
        out.innerHTML = '<strong>Outputs expected:</strong> ' + esc(m.outputs_expected)
        io.appendChild(out)
      }
      if (io.childNodes.length > 0) ficha.appendChild(io)

      return ficha
    }

    function renderExecutionWorkspace() {
      if (!stepBody) return
      stepBody.innerHTML = ''
      if (!activeProcedure) {
        stepBody.innerHTML = '<div class="empty-state">No procedures found.</div>'
        return
      }

      var chain = RT.chainOf(activeProcedure, nodeById)
      if (!chain.length) {
        stepBody.innerHTML = '<div class="empty-state">No steps in this procedure.</div>'
        return
      }
      if (currentStepIndex >= chain.length) currentStepIndex = chain.length - 1

      var ficha = renderFichaHeader(activeProcedure)
      stepBody.appendChild(ficha)

      // Workspace 3-pane layout
      var ws = document.createElement('div')
      ws.className = 'exec-workspace'

      // Left Column: Interactive SVG DAG
      var dagCol = document.createElement('div')
      dagCol.className = 'exec-dag-col'
      var dagHeader = document.createElement('div')
      dagHeader.className = 'exec-col-header'
      dagHeader.innerHTML = '<span>' + vIcon('workflow', 14) + ' Workflow</span><span class="count-badge">' + chain.length + ' steps</span>'
      dagCol.appendChild(dagHeader)

      var dagView = document.createElement('div')
      dagView.className = 'exec-dag-view'
      dagView.appendChild(renderDAG(chain))
      dagCol.appendChild(dagView)
      ws.appendChild(dagCol)

      // Center Column: Active Step Card
      var activeCol = document.createElement('div')
      activeCol.className = 'exec-active-col'
      activeCol.appendChild(renderActiveStepCard(chain))
      ws.appendChild(activeCol)

      // Right Column: Live Audit Log
      var logCol = document.createElement('div')
      logCol.className = 'exec-log-col'
      var logHeader = document.createElement('div')
      logHeader.className = 'exec-col-header'
      logHeader.innerHTML = '<span>' + vIcon('clipboard', 14) + ' Execution Log</span><button class="btn-xs btn-export-log" type="button">' + vIcon('copy', 12) + ' Export</button>'
      logCol.appendChild(logHeader)

      var logView = document.createElement('div')
      logView.className = 'exec-log-view'
      auditLogView = logView
      logCol.appendChild(logView)
      ws.appendChild(logCol)

      stepBody.appendChild(ws)

      // Bind Export Log Button
      var exportBtn = logHeader.querySelector('.btn-export-log')
      if (exportBtn) {
        exportBtn.addEventListener('click', function () {
          openExportModal(chain)
        })
      }

      renderProgressHeader(chain)
      renderAuditLog()
    }

    function renderProgressHeader(chain) {
      if (!stepProgress) return
      stepProgress.innerHTML = ''
      var doneCount = 0
      Object.keys(stepStates).forEach(function (k) {
        if (stepStates[k] === 'done') doneCount++
      })
      var pct = Math.round((doneCount / chain.length) * 100)

      var barWrap = document.createElement('div')
      barWrap.className = 'proc-status-bar'
      barWrap.innerHTML =
        '<div class="proc-status-left">' +
          '<span class="proc-status-title">Execution Progress: <strong>Step ' + (currentStepIndex + 1) + ' of ' + chain.length + '</strong> (' + pct + '%)</span>' +
          '<div class="proc-progress-track"><div class="proc-progress-fill" style="width:' + pct + '%"></div></div>' +
        '</div>' +
        '<div class="proc-status-right">' +
          '<span class="proc-timer">' + vIcon('clock', 13) + ' <span data-nn-timer>' + formatTimer() + '</span></span>' +
        '</div>'
      stepProgress.appendChild(barWrap)
      timerElRef = stepProgress.querySelector('[data-nn-timer]')
    }

    function formatTimer() {
      var mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0')
      var secs = String(timerSeconds % 60).padStart(2, '0')
      return mins + ':' + secs
    }

    // ---- SVG DAG Renderer ----
    function renderDAG(chain) {
      var svgNS = 'http://www.w3.org/2000/svg'
      var svg = document.createElementNS(svgNS, 'svg')
      svg.setAttribute('class', 'dag-canvas')
      svg.setAttribute('viewBox', '0 0 320 ' + (chain.length * 84 + 20))

      var nodeW = 280
      var nodeH = 56
      var startX = 20
      var startY = 16
      var gapY = 84

      // Edges
      for (var i = 0; i < chain.length - 1; i++) {
        var x1 = startX + nodeW / 2
        var y1 = startY + i * gapY + nodeH
        var x2 = startX + nodeW / 2
        var y2 = startY + (i + 1) * gapY

        var edge = document.createElementNS(svgNS, 'path')
        edge.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2)
        edge.setAttribute('class', 'dag-edge ' + (i < currentStepIndex ? 'done' : i === currentStepIndex ? 'active' : ''))
        svg.appendChild(edge)
      }

      // Nodes
      chain.forEach(function (step, i) {
        var y = startY + i * gapY
        var state = stepStates[step.el.id] || (i === currentStepIndex ? 'active' : i < currentStepIndex ? 'done' : 'pending')
        var isDecision = step.fields.step_type === 'decision'
        var branchTargets = isDecision ? RT.nextSteps(step, nodeById) : []
        var isBranch = branchTargets.length >= 2

        var g = document.createElementNS(svgNS, 'g')
        g.setAttribute('class', 'dag-node ' + (isDecision ? 'decision ' : '') + (isBranch ? 'branch ' : '') + state)
        if (isBranch) {
          branchTargets.forEach(function (t) {
            var branchText = document.createElementNS(svgNS, 'text')
            branchText.setAttribute('class', 'branch-outcome')
            branchText.textContent = 'Outcome: ' + (t.el.name || t.el.id) + (t.fields.condition ? ' (IF: ' + t.fields.condition + ')' : '')
            g.appendChild(branchText)
          })
        }
        g.addEventListener('click', function () {
          currentStepIndex = i
          renderExecutionWorkspace()
          var activeCard = ws.querySelector('.exec-step-card')
          if (activeCard && typeof activeCard.scrollIntoView === 'function') {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        })

        var rect = document.createElementNS(svgNS, 'rect')
        rect.setAttribute('x', startX)
        rect.setAttribute('y', y)
        rect.setAttribute('width', nodeW)
        rect.setAttribute('height', nodeH)
        rect.setAttribute('rx', '8')
        g.appendChild(rect)

        // Status Indicator
        var dot = document.createElementNS(svgNS, 'circle')
        dot.setAttribute('cx', startX + 18)
        dot.setAttribute('cy', y + nodeH / 2)
        dot.setAttribute('r', '6')
        dot.setAttribute('class', 'node-dot')
        g.appendChild(dot)

        // Step Type Text
        var typeText = document.createElementNS(svgNS, 'text')
        typeText.setAttribute('x', startX + 34)
        typeText.setAttribute('y', y + 20)
        typeText.setAttribute('class', 'node-sub')
        typeText.textContent = (step.fields.step_type || 'TASK').toUpperCase() + (step.fields.condition ? ' • IF: ' + step.fields.condition : '')
        g.appendChild(typeText)

        // Step Name Text
        var nameText = document.createElementNS(svgNS, 'text')
        nameText.setAttribute('x', startX + 34)
        nameText.setAttribute('y', y + 38)
        nameText.setAttribute('class', 'node-title')
        var titleStr = step.el.name || 'Step ' + (i + 1)
        if (titleStr.length > 28) titleStr = titleStr.substring(0, 26) + '…'
        nameText.textContent = titleStr
        g.appendChild(nameText)

        svg.appendChild(g)
      })

      return svg
    }

    // ---- Active Step Card Renderer ----
    function renderActiveStepCard(chain) {
      var cur = chain[currentStepIndex]
      var state = stepStates[cur.el.id] || 'active'
      var card = document.createElement('article')
      card.className = 'exec-step-card nn-card'
      card.setAttribute('data-nn-component', 'element-card')

      // Step Header
      var headerRow = document.createElement('div')
      headerRow.className = 'exec-step-head'

      var typeName = cur.fields.step_type || 'task'
      var typePill = document.createElement('span')
      typePill.className = 'step-type-pill pill-' + typeName
      typePill.innerHTML = vIcon(typeName, 14) + ' ' + typeName.toUpperCase()

      var statusPill = document.createElement('span')
      statusPill.className = 'step-state-badge state-' + state
      statusPill.textContent = state === 'done' ? 'Completed' : state === 'active' ? 'In Progress' : 'Pending'

      headerRow.appendChild(typePill)
      if (cur.fields.condition) {
        var condPill = document.createElement('span')
        condPill.className = 'step-cond-pill'
        condPill.textContent = 'IF: ' + cur.fields.condition
        headerRow.appendChild(condPill)
      }
      if (cur.fields.scope) {
        var scopePill = document.createElement('span')
        scopePill.className = 'step-scope-pill'
        scopePill.textContent = 'Scope: ' + cur.fields.scope
        headerRow.appendChild(scopePill)
      }
      headerRow.appendChild(statusPill)
      card.appendChild(headerRow)

      // Title & Description
      var h2 = document.createElement('h2')
      h2.className = 'exec-step-title'
      h2.textContent = cur.el.name || 'Step ' + (currentStepIndex + 1)
      card.appendChild(h2)

      if (cur.el.description) {
        var pDesc = document.createElement('p')
        pDesc.className = 'exec-step-desc'
        appendWithKuPills(pDesc, cur.el.description)
        card.appendChild(pDesc)
      }

      if (cur.fields.step_type === 'decision') {
        var branchTargets = RT.nextSteps(cur, nodeById)
        if (branchTargets.length >= 2) {
          var branchWrap = document.createElement('div')
          branchWrap.className = 'branch-outcomes'
          branchTargets.forEach(function (t) {
            var outcomeEl = document.createElement('div')
            outcomeEl.className = 'branch-outcome'
            outcomeEl.innerHTML = '<strong>Outcome:</strong> ' + esc(t.el.name || t.el.id) + (t.fields.condition ? ' <em>(IF: ' + esc(t.fields.condition) + ')</em>' : '')
            branchWrap.appendChild(outcomeEl)
          })
          card.appendChild(branchWrap)
        }
      }

      // RACI Governance Bar
      var raci = rolesForStep(cur.el.name)
      if (raci.length) {
        var raciBox = document.createElement('div')
        raciBox.className = 'exec-raci-box'
        var raciHead = document.createElement('div')
        raciHead.className = 'exec-box-title'
        raciHead.innerHTML = vIcon('users', 13) + ' Governance & Roles (RACI)'
        raciBox.appendChild(raciHead)

        var raciList = document.createElement('div')
        raciList.className = 'exec-raci-list'
        raci.forEach(function (r) {
          var target = byName[r.label]
          var rPill = document.createElement('button')
          rPill.className = 'raci-item-btn'
          rPill.setAttribute('type', 'button')
          var badgeCls = 'raci-' + String(r.value || 'i').toLowerCase().charAt(0)
          rPill.innerHTML = '<span class="raci-badge ' + badgeCls + '">' + esc(r.value.charAt(0)) + '</span> <span>' + esc(r.label) + '</span>'
          if (target) {
            rPill.addEventListener('click', function () {
              openRef(target)
            })
          }
          raciList.appendChild(rPill)
        })
        raciBox.appendChild(raciList)
        card.appendChild(raciBox)
      }

      // Artifact I/O Pipeline Cards
      var ioBox = document.createElement('div')
      ioBox.className = 'exec-io-box'
      var ioGrid = document.createElement('div')
      ioGrid.className = 'exec-io-grid'

      if (cur.fields.input) {
        var inCard = document.createElement('div')
        inCard.className = 'io-panel io-panel-in'
        inCard.innerHTML =
          '<div class="io-panel-label">' + vIcon('arrow-right', 12) + ' Required Input</div>' +
          '<div class="io-panel-name">' + esc(cur.fields.input) + '</div>' +
          '<label class="io-check-label"><input type="checkbox" checked /> Ready & Verified</label>'
        ioGrid.appendChild(inCard)
      }

      if (cur.fields.output) {
        var outCard = document.createElement('div')
        outCard.className = 'io-panel io-panel-out'
        var isDone = state === 'done'
        outCard.innerHTML =
          '<div class="io-panel-label">' + vIcon('package', 12) + ' Produced Output</div>' +
          '<div class="io-panel-name">' + esc(cur.fields.output) + '</div>' +
          '<label class="io-check-label"><input type="checkbox" ' + (isDone ? 'checked' : '') + ' /> Status: <code>' + esc(cur.fields.output_status || 'verified') + '</code></label>'
        ioGrid.appendChild(outCard)
      }

      if (ioGrid.children.length) {
        ioBox.appendChild(ioGrid)
        card.appendChild(ioBox)
      }

      // Tooling & CLI Action Helper
      if (cur.fields.tool) {
        var toolBox = document.createElement('div')
        toolBox.className = 'exec-tool-box'
        var toolHead = document.createElement('div')
        toolHead.className = 'exec-box-title'
        toolHead.innerHTML = vIcon('wrench', 13) + ' Tooling & Execution: <strong>' + esc(cur.fields.tool) + '</strong>'
        toolBox.appendChild(toolHead)

        var cmdSnippet = 'nn-cli run --step "' + esc(cur.el.name) + '" --tool "' + esc(cur.fields.tool) + '"'
        var cliSnippet = document.createElement('div')
        cliSnippet.className = 'exec-cli-snippet'
        cliSnippet.innerHTML =
          '<code>' + vIcon('terminal', 12) + ' ' + cmdSnippet + '</code>' +
          '<button class="btn-copy" type="button">' + vIcon('copy', 12) + ' Copy</button>'

        cliSnippet.querySelector('.btn-copy').addEventListener('click', function () {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(cmdSnippet)
            addLog('Copied CLI command for step "' + cur.el.name + '"', 'Operator', 'active')
          }
        })
        toolBox.appendChild(cliSnippet)
        card.appendChild(toolBox)
      }

      // Decision Gate
      if (cur.fields.step_type === 'decision') {
        var decBox = document.createElement('div')
        decBox.className = 'exec-decision-box'
        decBox.innerHTML =
          '<div class="exec-box-title" style="color:var(--warning)">' + vIcon('decision', 13) + ' Decision Gate: Choose Branch Path</div>' +
          '<div class="decision-btn-row">' +
            '<button class="btn-branch btn-primary btn-branch-pass" type="button">Proceed Path (Standard) ▶</button>' +
            '<button class="btn-branch btn-branch-alt" type="button">Rework / Alternate Path ↺</button>' +
          '</div>'

        decBox.querySelector('.btn-branch-pass').addEventListener('click', function () {
          addLog('Decision Gate: Passed standard branch on step "' + cur.el.name + '"', 'Operator', 'done')
          completeCurrentStep(chain)
        })
        decBox.querySelector('.btn-branch-alt').addEventListener('click', function () {
          addLog('Decision Gate: Selected rework / alternative branch on step "' + cur.el.name + '"', 'Operator', 'warning')
          currentStepIndex = Math.max(0, currentStepIndex - 1)
          renderExecutionWorkspace()
        })
        card.appendChild(decBox)
      }

      // Stepper Navigation Actions
      var actionsRow = document.createElement('div')
      actionsRow.className = 'exec-actions-row'

      var prevBtn = document.createElement('button')
      prevBtn.className = 'btn'
      prevBtn.type = 'button'
      prevBtn.disabled = currentStepIndex === 0
      prevBtn.innerHTML = vIcon('arrow-left', 13) + ' Previous'
      prevBtn.addEventListener('click', function () {
        currentStepIndex = Math.max(0, currentStepIndex - 1)
        renderExecutionWorkspace()
      })
      actionsRow.appendChild(prevBtn)

      var rightGroup = document.createElement('div')
      rightGroup.className = 'btn-group-right'

      var skipBtn = document.createElement('button')
      skipBtn.className = 'btn'
      skipBtn.type = 'button'
      skipBtn.innerHTML = vIcon('skip', 13) + ' Skip Step'
      skipBtn.addEventListener('click', function () {
        stepStates[cur.el.id] = 'skipped'
        addLog('Skipped step "' + cur.el.name + '"', 'Operator', 'skipped')
        if (currentStepIndex < chain.length - 1) {
          currentStepIndex++
          stepStates[chain[currentStepIndex].el.id] = 'active'
        }
        renderExecutionWorkspace()
      })
      rightGroup.appendChild(skipBtn)

      var nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary'
      nextBtn.type = 'button'
      var isLast = currentStepIndex === chain.length - 1
      nextBtn.innerHTML = isLast ? vIcon('check', 13) + ' Finish Procedure' : vIcon('play', 13) + ' Complete & Advance'
      nextBtn.addEventListener('click', function () {
        completeCurrentStep(chain)
      })
      rightGroup.appendChild(nextBtn)

      actionsRow.appendChild(rightGroup)
      card.appendChild(actionsRow)

      return card
    }

    function completeCurrentStep(chain) {
      var cur = chain[currentStepIndex]
      stepStates[cur.el.id] = 'done'
      addLog('Step "' + cur.el.name + '" completed. Output verified: [' + (cur.fields.output || 'Complete') + ']', 'Lead Role', 'done')

      if (currentStepIndex < chain.length - 1) {
        currentStepIndex++
        stepStates[chain[currentStepIndex].el.id] = 'active'
        addLog('Advanced to step "' + chain[currentStepIndex].el.name + '"', 'System', 'active')
      } else {
        addLog('🎉 Procedure "' + (activeProcedure ? activeProcedure.el.name : 'Procedure') + '" fully executed!', 'System', 'done')
      }
      renderExecutionWorkspace()
    }

    // ---- Live Audit Log ----
    function renderAuditLog() {
      var container = auditLogView
      if (!container) return
      container.innerHTML = ''
      auditLogs.forEach(function (log) {
        var item = document.createElement('div')
        item.className = 'audit-item status-' + log.status
        item.innerHTML =
          '<div class="audit-time">' + esc(log.time) + ' • <span class="audit-author">' + esc(log.author) + '</span></div>' +
          '<div class="audit-text">' + esc(log.text) + '</div>'
        container.appendChild(item)
      })
    }

    // ---- Export Modal (scoped to this view; never a global id) ----
    function openExportModal(chain) {
      var dialog = logDialog
      if (!dialog) {
        dialog = doc.createElement('dialog')
        dialog.className = 'export-dialog'
        logDialog = dialog
        root.appendChild(dialog)
      }
      dialog.innerHTML = ''

      var doneCount = 0
      Object.keys(stepStates).forEach(function (k) {
        if (stepStates[k] === 'done') doneCount++
      })

      var md = '# Execution Audit Log: ' + (activeProcedure ? activeProcedure.el.name : 'Procedure') + '\n\n'
      md += '- **Model**: ' + (meta.title || 'iNNfo Model') + ' (' + (meta.modelVersion || 'V_0-1-0') + ')\n'
      md += '- **Timestamp**: ' + new Date().toISOString() + '\n'
      md += '- **Progress**: ' + doneCount + ' of ' + chain.length + ' steps completed\n'
      md += '- **Execution Time**: ' + formatTimer() + '\n\n'
      md += '## Chronological Events\n\n'
      auditLogs.slice().reverse().forEach(function (l) {
        md += '- `[' + l.time + ']` **' + l.author + '**: ' + l.text + '\n'
      })

      var box = document.createElement('div')
      box.className = 'export-modal-inner'
      box.innerHTML =
        '<h3>' + vIcon('clipboard', 16) + ' Execution Audit Report</h3>' +
        '<p class="export-modal-desc">Copy this structured Markdown summary for audit logs, release notes, or tickets.</p>' +
        '<textarea readonly class="export-textarea">' + esc(md) + '</textarea>' +
        '<div class="export-modal-actions">' +
          '<button class="btn btn-close" type="button">Close</button>' +
          '<button class="btn btn-primary btn-copy-all" type="button">' + vIcon('copy', 13) + ' Copy to Clipboard</button>' +
        '</div>'

      box.querySelector('.btn-close').addEventListener('click', function () {
        dialog.close()
      })
      box.querySelector('.btn-copy-all').addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(md)
          alert('Execution report copied to clipboard!')
          dialog.close()
        }
      })

      dialog.appendChild(box)
      if (typeof dialog.showModal === 'function') dialog.showModal()
    }

    // ---- helpers ----
    function chip(text, status) {
      var s = document.createElement('span')
      s.className = 'chip'
      var dot = document.createElement('span')
      dot.className = 'chip-dot'
      dot.style.background = STATUS_COLORS[status] || '#94a3b8'
      s.appendChild(dot)
      s.appendChild(document.createTextNode(' ' + esc(text)))
      return s
    }

    function chipWithNode(node, status) {
      var s = document.createElement('span')
      s.className = 'chip'
      var dot = document.createElement('span')
      dot.className = 'chip-dot'
      dot.style.background = STATUS_COLORS[status] || '#94a3b8'
      s.appendChild(dot)
      s.appendChild(document.createTextNode(' '))
      if (node) s.appendChild(node)
      return s
    }

    function ioPill(label, text, dir) {
      var d = document.createElement('div')
      d.className = 'io-pill io-' + dir
      var lab = document.createElement('span')
      lab.className = 'io-label'
      lab.textContent = label
      d.appendChild(lab)
      var target = byName[text]
      if (target) {
        var b = document.createElement('button')
        b.className = 'io-val'
        b.setAttribute('type', 'button')
        b.textContent = text
        b.addEventListener('click', function () {
          openRef(target)
        })
        d.appendChild(b)
      } else {
        var span = document.createElement('span')
        span.className = 'io-val'
        span.textContent = text
        d.appendChild(span)
      }
      return d
    }

    // ---- Initial render ----
    initRuntimeState()
    renderTabs()
    renderProcedures()

    return {
      ok: true,
      procedures: procedures.length,
      steps: activeProcedure ? RT.chainOf(activeProcedure, nodeById).length : 0,
      matrices: matrices.length,
      onHide: function () {
        if (timerInterval) clearInterval(timerInterval)
        timerInterval = null
      },
      onShow: function () {
        startTimer()
      },
      unmount: function () {
        if (timerInterval) clearInterval(timerInterval)
        timerInterval = null
        if (container) container.innerHTML = ''
      },
    }
  }

  return {
    version: RENDERER_VERSION,
    RENDERER_VERSION: RENDERER_VERSION,
    mount: mount,
  }
})