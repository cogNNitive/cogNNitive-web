/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.InnfoProcedureStepper = factory()
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
  var V = (GLOBAL.InnfoVisuals && typeof GLOBAL.InnfoVisuals === 'object') ? GLOBAL.InnfoVisuals : null

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

  function parseJSON(id) {
    var node = document.getElementById(id)
    if (!node) return null
    try {
      return JSON.parse(node.textContent.trim() || '{}')
    } catch (e) {
      console.error('Bad JSON in #' + id, e)
      return null
    }
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

  function boot() {
    if (typeof document === 'undefined' || !document.getElementById) {
      return { ok: false, reason: 'no-document' }
    }
    var schema = parseJSON('innfo-schema') || {}
    var model = parseJSON('innfo-model') || {}
    var elements = Array.isArray(model.elements) ? model.elements : []
    var matrices = Array.isArray(model.matrices) ? model.matrices : []
    var meta = model.meta || {}

    var byId = {}
    var byName = {}
    var elemsByConcept = {}
    elements.forEach(function (el) {
      if (!el) return
      if (el.id) byId[el.id] = el
      if (el.name) byName[el.name] = el
      if (el.concept) {
        ;(elemsByConcept[el.concept] = elemsByConcept[el.concept] || []).push(el)
      }
    })

    // Build Work tree: roots = procedures, children = steps.
    var heavies = elements
      .filter(function (el) {
        return el && el.concept === 'Work'
      })
      .map(function (el) {
        return {
          el: el,
          fields: isObject(el.fields) ? el.fields : {},
          relations: Array.isArray(el.relations) ? el.relations : [],
          children: [],
        }
      })
    var nodeById = {}
    heavies.forEach(function (n) {
      nodeById[n.el.id] = n
    })
    heavies.forEach(function (n) {
      var pid = resolveParentId(n)
      n.parentId = pid
      if (pid && nodeById[pid]) nodeById[pid].children.push(n)
    })
    var procedures = heavies.filter(function (n) {
      return !n.parentId || !nodeById[n.parentId]
    })
    procedures.forEach(function (p) {
      sortChildren(p.children)
    })

    // Header
    var titleEl = document.getElementById('doc-title')
    if (titleEl) titleEl.textContent = meta.title || 'Procedures Console'
    var metaEl = document.getElementById('doc-meta')
    if (metaEl) {
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
    }

    var rail = document.getElementById('rail')
    var tabsHost = document.getElementById('proc-tabs')
    var stepProgress = document.getElementById('progress')
    var stepBody = document.getElementById('step-body')
    var matrixPort = document.getElementById('matrix-port')
    var content = document.getElementById('content')
    var viewProcedures = document.getElementById('view-procedures')
    var viewMatrices = document.getElementById('view-matrices')
    var viewConcept = document.getElementById('view-concept')
    var mainTabs = document.querySelectorAll('.tabs .tab')

    if (!tabsHost || !stepBody || !matrixPort) {
      return { ok: false, reason: 'missing-shell' }
    }

    // ---- Execution Runtime State ----
    var activeProcedure = procedures[0] || null
    var currentStepIndex = 0
    var stepStates = {} // { [stepId]: 'pending' | 'active' | 'done' | 'skipped' }
    var auditLogs = []
    var timerSeconds = 0
    var timerInterval = null

    function initRuntimeState() {
      stepStates = {}
      if (activeProcedure) {
        var chain = chainOf(activeProcedure)
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
        var timerEl = document.getElementById('run-timer')
        if (timerEl) {
          var mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0')
          var secs = String(timerSeconds % 60).padStart(2, '0')
          timerEl.textContent = mins + ':' + secs
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
      var rt = GLOBAL.InnfoConsole
      if (rt && typeof rt.renderRefDialog === 'function') {
        rt.renderRefDialog(document, element)
        return
      }
      var dialog = document.getElementById('innfo-ref-dialog')
      if (!dialog) return
      dialog.innerHTML = ''
      var h = document.createElement('h2')
      h.textContent = element && element.name ? element.name : 'Element'
      dialog.appendChild(h)
      var tag = document.createElement('span')
      tag.className = 'innfo-ref-tag'
      tag.textContent = element && element.concept ? element.concept : 'Element'
      dialog.appendChild(tag)
      if (element && element.description) {
        var p = document.createElement('p')
        p.className = 'innfo-ref-desc'
        p.textContent = element.description
        dialog.appendChild(p)
      }
      if (typeof dialog.showModal === 'function') dialog.showModal()
    }

    function refButton(label, name) {
      var target = byName[name]
      if (!target) {
        var span = document.createElement('span')
        span.textContent = label
        return { node: span, ok: false }
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

    // ---- View switching ----
    function showView(name) {
      if (viewProcedures) viewProcedures.classList.toggle('active', name === 'procedures')
      if (viewMatrices) viewMatrices.classList.toggle('active', name === 'matrices')
      if (viewConcept) viewConcept.classList.toggle('active', name === 'concept')
      mainTabs.forEach(function (b) {
        var v = b.getAttribute('data-view')
        b.classList.toggle('active', v === name || (v === 'procedures' && name === 'concept'))
      })
    }

    function switchView(name) {
      showView(name)
      if (name === 'matrices') renderMatrices()
      else if (name === 'concept') renderConcept()
      else renderProcedures()
    }

    mainTabs.forEach(function (b) {
      b.addEventListener('click', function () {
        railSelection = 'procedures'
        renderRail()
        switchView(b.getAttribute('data-view'))
      })
    })

    // ---- Rail ----
    var concepts = (schema.concepts || []).slice()
    concepts.sort(function (a, b) {
      return (b.weight || 0) - (a.weight || 0)
    })
    var railSelection = 'procedures'

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

    function renderRail() {
      if (!rail) return
      var label = rail.querySelector('.rail-label')
      rail.innerHTML = ''
      if (label) rail.appendChild(label)
      var procsBtn = document.createElement('button')
      procsBtn.className = 'rail-item' + (railSelection === 'procedures' ? ' active' : '')
      procsBtn.innerHTML = '<span>Procedures</span><span class="count">' + procedures.length + '</span>'
      procsBtn.addEventListener('click', function () {
        railSelection = 'procedures'
        renderRail()
        switchView('procedures')
      })
      rail.appendChild(procsBtn)
      concepts.forEach(function (c) {
        var name = typeof c === 'string' ? c : c.name
        var col = conceptColor(name)
        var b = document.createElement('button')
        b.className = 'rail-item' + (railSelection === name ? ' active' : '')
        b.innerHTML =
          '<span class="rail-dot" style="background:' + col + '"></span>' +
          '<span class="rail-label-text">' + esc(name) + '</span>' +
          '<span class="count">' + (elemsByConcept[name] || []).length + '</span>'
        b.addEventListener('click', function () {
          railSelection = name
          renderRail()
          switchView('concept')
        })
        rail.appendChild(b)
      })
      // Matrices section
      var mLabel = document.createElement('div')
      mLabel.className = 'rail-label'
      mLabel.textContent = 'Matrices'
      rail.appendChild(mLabel)
      matrices.forEach(function (mx) {
        if (!mx || !mx.name) return
        var key = 'matrix:' + mx.name
        var b = document.createElement('button')
        b.className = 'rail-item' + (railSelection === key ? ' active' : '')
        b.innerHTML =
          '<span class="rail-dot" style="background:#171717"></span>' +
          '<span class="rail-label-text">' + esc(mx.name) + '</span>' +
          '<span class="count">' + (Array.isArray(mx.rows) ? mx.rows.length : 0) + '</span>'
        b.addEventListener('click', function () {
          railSelection = key
          renderRail()
          switchView('matrices')
        })
        rail.appendChild(b)
      })
    }

    // ---- Concept content ----
    function renderConcept() {
      if (!content) return
      content.innerHTML = ''
      if (!railSelection || railSelection === 'procedures' || railSelection === 'matrices' || railSelection.indexOf('matrix:') === 0) {
        content.innerHTML = '<div class="empty-state">Select a concept from the rail.</div>'
        return
      }
      var list = elemsByConcept[railSelection] || []
      if (!list.length) {
        content.innerHTML = '<div class="empty-state">No <code>' + esc(railSelection) + '</code> elements found.</div>'
        return
      }
      var wrap = document.createElement('div')
      wrap.className = 'concept-list'
      list.forEach(function (el) {
        var card = document.createElement('section')
        card.className = 'concept-card'
        var h = document.createElement('h3')
        h.textContent = el.name || '(unnamed)'
        card.appendChild(h)
        var tag = document.createElement('span')
        tag.className = 'concept-tag'
        tag.style.color = conceptColor(el.concept)
        tag.style.borderColor = conceptColor(el.concept) + '55'
        tag.style.background = conceptColor(el.concept) + '14'
        tag.textContent = el.concept || 'Element'
        card.appendChild(tag)
        if (el.description) {
          var p = document.createElement('p')
          p.textContent = el.description
          card.appendChild(p)
        }
        if (isObject(el.fields)) {
          var dl = document.createElement('dl')
          dl.className = 'field-list'
          Object.keys(el.fields).forEach(function (k) {
            var dt = document.createElement('dt')
            dt.textContent = k
            var dd = document.createElement('dd')
            dd.textContent = String(el.fields[k])
            dl.appendChild(dt)
            dl.appendChild(dd)
          })
          if (dl.children.length) card.appendChild(dl)
        }
        wrap.appendChild(card)
      })
      content.appendChild(wrap)
    }

    // ---- Procedure view mode: Document (default) | Wizard ----
    var proceduresMode = 'wizard'
    var docBody = document.getElementById('doc-body')
    var wizardBody = document.getElementById('wizard-body')
    var subTabs = document.querySelectorAll('.subtabs .subtab')

    function renderProcedures() {
      if (proceduresMode === 'wizard') {
        if (docBody) docBody.classList.add('hidden')
        if (wizardBody) wizardBody.classList.remove('hidden')
        renderExecutionWorkspace()
      } else {
        if (wizardBody) wizardBody.classList.add('hidden')
        if (docBody) docBody.classList.remove('hidden')
        renderDocument()
      }
      subTabs.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-mode') === proceduresMode)
      })
    }

    subTabs.forEach(function (b) {
      b.addEventListener('click', function () {
        proceduresMode = b.getAttribute('data-mode') === 'wizard' ? 'wizard' : 'document'
        renderProcedures()
      })
    })

    // Document view: full procedure as a readable document (presentational).
    function renderDocument() {
      if (!docBody) return
      docBody.innerHTML = ''
      if (!activeProcedure) {
        docBody.innerHTML = '<div class="empty-state">No procedures found.</div>'
        return
      }
      var chain = chainOf(activeProcedure)
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
        var stepColor = conceptColor('Work')
        h.style.color = stepColor
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
        if (!isRoot) {
          var chipsWrap = document.createElement('div')
          chipsWrap.className = 'chips'
          if (step.fields.condition) chipsWrap.appendChild(chip('IF ' + step.fields.condition, 'warning'))
          if (step.fields.step_type) chipsWrap.appendChild(chip(step.fields.step_type, 'active'))
          if (step.fields.output_status) chipsWrap.appendChild(chip(step.fields.output_status, 'done'))
          if (step.fields.tool) {
            var toolRef = refButton(step.fields.tool, step.fields.tool)
            chipsWrap.appendChild(chipWithNode(toolRef.node, 'active'))
          }
          if (chipsWrap.children.length) block.appendChild(chipsWrap)
          var io = document.createElement('div')
          io.className = 'io'
          if (step.fields.input) io.appendChild(ioPill('Input', step.fields.input, 'in'))
          if (step.fields.output) io.appendChild(ioPill('Output', step.fields.output, 'out'))
          if (io.childNodes.length) block.appendChild(io)
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

    // ---- Chain: procedure root -> steps ordered by next within same parent ----
    var RT = GLOBAL.InnfoConsole

    function chainOf(proc) {
      if (RT && typeof RT.chainOf === 'function') return RT.chainOf(proc, nodeById)
      var out = [proc]
      var step = firstChild(proc)
      var visited = {}
      visited[proc.el.id] = true
      while (step && !visited[step.el.id]) {
        visited[step.el.id] = true
        out.push(step)
        step = nextStep(step)
      }
      return out
    }

    function firstChild(proc) {
      if (RT && typeof RT.firstChild === 'function') return RT.firstChild(proc)
      return proc.children ? proc.children[0] : null
    }

    function nextStep(step) {
      if (RT && typeof RT.nextStep === 'function') return RT.nextStep(step, nodeById)
      var relation = (step.relations || []).filter(function (r) {
        return r.field === 'next' && r.target && byId[r.target]
      })
      if (relation.length) {
        var cand = nodeById[relation[0].target]
        if (cand && cand.parentId === step.parentId) return cand
      }
      var label = step.fields && step.fields.next
      if (label && label !== '-' && byName[label]) {
        var cand2 = nodeById[byName[label].id]
        if (cand2 && cand2.parentId === step.parentId) return cand2
      }
      return null
    }

    function sortChildren(children) {
      if (RT && typeof RT.sortChildren === 'function') return RT.sortChildren(children, nodeById)
      var nextOf = {}
      children.forEach(function (c) {
        var rel = (c.relations || []).filter(function (r) {
          return r.field === 'next' && r.target && byId[r.target]
        })
        if (rel.length) nextOf[c.el.id] = rel[0].target
      })
      children.sort(function (a, b) {
        if (nextOf[a.el.id] === b.el.id) return -1
        if (nextOf[b.el.id] === a.el.id) return 1
        return (a.el.name || '').localeCompare(b.el.name || '')
      })
    }

    function resolveParentId(node) {
      if (RT && typeof RT.resolveParentId === 'function') return RT.resolveParentId(node, nodeById)
      var field = node.fields && node.fields.parent
      if (field && field !== '-' && field !== '') {
        var targetEl = byName[field]
        return targetEl ? targetEl.id : null
      }
      var rels = node.relations || []
      for (var i = 0; i < rels.length; i++) {
        if (rels[i].field === 'parent' && rels[i].target && byId[rels[i].target]) {
          return rels[i].target
        }
      }
      return null
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
    function renderExecutionWorkspace() {
      if (!stepBody) return
      stepBody.innerHTML = ''
      if (!activeProcedure) {
        stepBody.innerHTML = '<div class="empty-state">No procedures found.</div>'
        return
      }

      var chain = chainOf(activeProcedure)
      if (!chain.length) {
        stepBody.innerHTML = '<div class="empty-state">No steps in this procedure.</div>'
        return
      }
      if (currentStepIndex >= chain.length) currentStepIndex = chain.length - 1

      // Workspace 3-pane layout
      var ws = document.createElement('div')
      ws.className = 'exec-workspace'

      // Left Column: Interactive SVG DAG
      var dagCol = document.createElement('div')
      dagCol.className = 'exec-dag-col'
      var dagHeader = document.createElement('div')
      dagHeader.className = 'exec-col-header'
      dagHeader.innerHTML = '<span>' + vIcon('workflow', 14) + ' Flow & Topology</span><span class="count-badge">' + chain.length + ' steps</span>'
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
      logHeader.innerHTML = '<span>' + vIcon('clipboard', 14) + ' Execution Log</span><button class="btn-xs" id="btn-export-log">' + vIcon('copy', 12) + ' Export</button>'
      logCol.appendChild(logHeader)

      var logView = document.createElement('div')
      logView.className = 'exec-log-view'
      logView.id = 'audit-log-container'
      logCol.appendChild(logView)
      ws.appendChild(logCol)

      stepBody.appendChild(ws)

      // Bind Export Log Button
      var exportBtn = document.getElementById('btn-export-log')
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
          '<span class="proc-timer">' + vIcon('clock', 13) + ' <span id="run-timer">' + formatTimer() + '</span></span>' +
        '</div>'
      stepProgress.appendChild(barWrap)
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

        var g = document.createElementNS(svgNS, 'g')
        g.setAttribute('class', 'dag-node ' + (isDecision ? 'decision ' : '') + state)
        g.addEventListener('click', function () {
          currentStepIndex = i
          renderExecutionWorkspace()
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
      card.className = 'exec-step-card'

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
        pDesc.textContent = cur.el.description
        card.appendChild(pDesc)
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
          '<label class="io-check-label"><input type="checkbox" ' + (isDone ? 'checked' : '') + ' id="chk-output-done" /> Status: <code>' + esc(cur.fields.output_status || 'verified') + '</code></label>'
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

        var cmdSnippet = 'innfo-cli run --step "' + esc(cur.el.name) + '" --tool "' + esc(cur.fields.tool) + '"'
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
            '<button class="btn-branch btn-primary" type="button" id="btn-branch-pass">Proceed Path (Standard) ▶</button>' +
            '<button class="btn-branch" type="button" id="btn-branch-alt">Rework / Alternate Path ↺</button>' +
          '</div>'

        decBox.querySelector('#btn-branch-pass').addEventListener('click', function () {
          addLog('Decision Gate: Passed standard branch on step "' + cur.el.name + '"', 'Operator', 'done')
          completeCurrentStep(chain)
        })
        decBox.querySelector('#btn-branch-alt').addEventListener('click', function () {
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
      var container = document.getElementById('audit-log-container')
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

    // ---- Export Modal ----
    function openExportModal(chain) {
      var dialog = document.getElementById('innfo-export-modal')
      if (!dialog) {
        dialog = document.createElement('dialog')
        dialog.id = 'innfo-export-modal'
        dialog.className = 'export-dialog'
        document.body.appendChild(dialog)
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

    // ---- Matrices ----
    function renderMatrices() {
      if (!matrixPort) return
      matrixPort.innerHTML = ''
      var selected = railSelection.indexOf('matrix:') === 0 ? railSelection.slice(7) : null
      var target = selected ? matrixByIdName(selected) : null
      if (!target) {
        matrixPort.innerHTML = '<div class="empty-state">Select a matrix from the rail.</div>'
        return
      }
      matrixPort.appendChild(renderMatrixBlock(target))
    }

    function renderMatrixBlock(mx) {
      var block = document.createElement('div')
      block.className = 'matrix-block'
      var h = document.createElement('h3')
      h.textContent = mx.name || 'Matrix'
      block.appendChild(h)
      var scroll = document.createElement('div')
      scroll.className = 'matrix-scroll'
      var rows = mx.rows || []
      var cols = mx.cols || []
      var cells = mx.cells || {}
      var html = "<table class='matrix'><thead><tr><th></th>"
      cols.forEach(function (c) {
        html += '<th>' + esc(c) + '</th>'
      })
      html += '</tr></thead><tbody>'
      rows.forEach(function (r) {
        html += '<tr><th>' + esc(r) + '</th>'
        cols.forEach(function (c) {
          var v = cells[r] && cells[r][c] != null ? cells[r][c] : ''
          html += '<td>' + esc(String(v)) + '</td>'
        })
        html += '</tr>'
      })
      html += '</tbody></table>'
      scroll.innerHTML = html
      block.appendChild(scroll)
      return block
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

    // ---- Boot ----
    initRuntimeState()
    renderRail()
    renderTabs()
    switchView('procedures')

    return {
      ok: true,
      procedures: procedures.length,
      steps: activeProcedure ? chainOf(activeProcedure).length : 0,
      matrices: matrices.length,
    }
  }

  function autoBoot() {
    try {
      if (typeof document === 'undefined' || !document.getElementById) return
      if (!document.getElementById('doc-title') || !document.getElementById('proc-tabs')) return
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          boot()
        })
      } else {
        boot()
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn)
        console.warn('innfo-procedure-stepper boot failed', err)
    }
  }

  autoBoot()

  return {
    version: RENDERER_VERSION,
    RENDERER_VERSION: RENDERER_VERSION,
    boot: boot,
  }
})