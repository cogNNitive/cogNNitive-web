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

  var RENDERER_VERSION = '0.1.0'

  var STATUS_COLORS = {
    done: '#16a34a',
    active: '#171717',
    pending: '#a1a1a1',
    warning: '#d97706',
    error: '#e7000b',
  }

  // Reuse the shared visual vocabulary when loaded (visuals.js); fall back to
  // local literals when the module is absent (e.g. raw file:// single renderer).
  var V = (GLOBAL.InnfoVisuals && typeof GLOBAL.InnfoVisuals === 'object') ? GLOBAL.InnfoVisuals : null

  function vIcon(name) {
    return V && typeof V.iconSvg === 'function' ? V.iconSvg(name, 12) : ''
  }

  var STEP_TYPE_ICONS = {
    task: '▢',
    decision: '◇',
    event: '◉',
  }

  var STATE_ICONS = {
    done: '✓',
    active: '▶',
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

    // ---- Reference popup (shared runtime capability) ----
    function openRef(element) {
      var rt = GLOBAL.InnfoConsole
      if (rt && typeof rt.renderRefDialog === 'function') {
        rt.renderRefDialog(document, element)
        return
      }
      // Local fallback when the runtime did not boot (defensive; shell loads it).
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
      // returns {node, ok} — plain text when unresolvable
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
    // 'procedures' | 'matrices' | 'matrix:<name>' | <concept name>
    var railSelection = 'procedures'

    // Concept color comes from the ACTIVE TEMPLATE (innfo-schema.concepts[].color),
    // translated name->hex by the shared visuals module. Never the app's palette.
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
      // Matrices section below concepts: one item per matrix
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
        content.innerHTML = '<div class="empty-state">Select a concept.</div>'
        return
      }
      var list = elemsByConcept[railSelection] || []
      if (!list.length) {
        content.innerHTML =
          '<div class="empty-state">No <code>' + esc(railSelection) + '</code> elements.</div>'
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
    var proceduresMode = 'document'
    var docBody = document.getElementById('doc-body')
    var wizardBody = document.getElementById('wizard-body')
    var subTabs = document.querySelectorAll('.subtabs .subtab')

    function renderProcedures() {
      if (proceduresMode === 'wizard') {
        if (docBody) docBody.classList.add('hidden')
        if (wizardBody) wizardBody.classList.remove('hidden')
        renderStepper()
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
        var svg = vIcon(iconName)
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
    var activeProcedure = procedures[0] || null
    var currentStepIndex = 0

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
          renderTabs()
          renderProcedures()
        })
        tabsHost.appendChild(b)
      })
    }

    // ---- Chain: procedure root -> steps ordered by next within same parent ----
    // These are shared with the generic runtime (innfo-runtime.js). When the
    // runtime is loaded we delegate to it (single source of truth); otherwise
    // fall back to the local copies.
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

    // ---- Stepper ----
    function renderStepper() {
      if (!stepBody) return
      stepBody.innerHTML = ''
      if (stepProgress) stepProgress.innerHTML = ''
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

      // Progress rail: connected dots with state icons
      if (stepProgress) {
        var pw = document.createElement('div')
        pw.className = 'proc-progress'
        chain.forEach(function (step, i) {
          var isActive = i === currentStepIndex
          var isDone = i < currentStepIndex
          var cls = isActive ? 'active' : isDone ? 'done' : 'pending'
          var nodeHost = document.createElement('div')
          nodeHost.className = 'step-node ' + cls
          if (i > 0) {
            var link = document.createElement('span')
            link.className = 'step-link'
            nodeHost.appendChild(link)
          }
          var inner = document.createElement('div')
          inner.className = 'step-node-inner'
          var dot = document.createElement('button')
          dot.className = 'step-dot'
          dot.setAttribute('type', 'button')
          dot.setAttribute('aria-label', step.el.name || 'step')
          var stateName = isActive ? 'play' : isDone ? 'check' : step.fields.step_type
          var svg = vIcon(stateName)
          if (svg) {
            dot.innerHTML = svg
          } else {
            dot.textContent = isActive
              ? STATE_ICONS.active
              : isDone
                ? STATE_ICONS.done
                : STEP_TYPE_ICONS[step.fields.step_type] || '•'
          }
          dot.addEventListener('click', function () {
            currentStepIndex = i
            renderStepper()
          })
          var label = document.createElement('span')
          label.className = 'step-dot-label'
          label.textContent = step.el.name || 'Step'
          inner.appendChild(dot)
          inner.appendChild(label)
          nodeHost.appendChild(inner)
          pw.appendChild(nodeHost)
        })
        stepProgress.appendChild(pw)
      }

      // Detail card
      var cur = chain[currentStepIndex]
      var card = document.createElement('article')
      card.className = 'step-card'
      var h = document.createElement('h3')
      h.innerHTML =
        '<span class="step-type-icon">' + (STEP_TYPE_ICONS[cur.fields.step_type] || '•') + '</span> ' +
        esc(cur.el.name || 'Step')
      card.appendChild(h)
      if (cur.el.description) {
        var p = document.createElement('p')
        p.className = 'desc'
        p.textContent = cur.el.description
        card.appendChild(p)
      }

      var tags = []
      if (cur.fields.condition) tags.push(chip('IF ' + cur.fields.condition, 'warning'))
      if (cur.fields.step_type) tags.push(chip(cur.fields.step_type, 'active'))
      if (cur.fields.output_status) tags.push(chip(cur.fields.output_status, 'done'))
      if (cur.fields.tool) {
        var toolRef = refButton(cur.fields.tool, cur.fields.tool)
        tags.push(chipWithNode(toolRef.node, 'active'))
      }
      if (tags.length) {
        var chips = document.createElement('div')
        chips.className = 'chips'
        tags.forEach(function (t) {
          chips.appendChild(t)
        })
        card.appendChild(chips)
      }

      var io = document.createElement('div')
      io.className = 'io'
      if (cur.fields.input) io.appendChild(ioPill('Input', cur.fields.input, 'in'))
      if (cur.fields.output) io.appendChild(ioPill('Output', cur.fields.output, 'out'))
      if (io.childNodes.length) card.appendChild(io)

      var raci = rolesForStep(cur.el.name)
      if (raci.length) {
        var box = document.createElement('div')
        box.className = 'raci'
        box.innerHTML = '<h4>Roles</h4>'
        raci.forEach(function (r) {
          var target = byName[r.label]
          var pill = document.createElement('button')
          pill.className = 'raci-pill'
          pill.setAttribute('type', 'button')
          pill.textContent = r.label + ': ' + r.value
          if (target) {
            pill.addEventListener('click', function () {
              openRef(target)
            })
          } else {
            pill.setAttribute('disabled', 'disabled')
          }
          box.appendChild(pill)
        })
        card.appendChild(box)
      }

      stepBody.appendChild(card)

      var nav = document.createElement('div')
      nav.className = 'btn-row'
      var back = document.createElement('button')
      back.className = 'btn'
      back.textContent = '◀ Previous'
      back.setAttribute('type', 'button')
      back.disabled = currentStepIndex === 0
      back.addEventListener('click', function () {
        currentStepIndex = Math.max(0, currentStepIndex - 1)
        renderStepper()
      })
      var next = document.createElement('button')
      next.className = 'btn btn-primary'
      next.textContent = currentStepIndex === chain.length - 1 ? 'Finish ✓' : 'Next ▶'
      next.setAttribute('type', 'button')
      next.disabled = currentStepIndex === chain.length - 1
      next.addEventListener('click', function () {
        currentStepIndex = Math.min(chain.length - 1, currentStepIndex + 1)
        renderStepper()
      })
      nav.appendChild(back)
      nav.appendChild(next)
      stepBody.appendChild(nav)
    }

    // ---- Matrices ----
    function renderMatrices() {
      if (!matrixPort) return
      matrixPort.innerHTML = ''
      var selected = railSelection.indexOf('matrix:') === 0 ? railSelection.slice(7) : null
      var target = selected ? matrixByIdName(selected) : null
      if (!target) {
        matrixPort.innerHTML = '<div class="empty-state">Select a matrix.</div>'
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
      dot.style.background = STATUS_COLORS[status] || '#a1a1a1'
      s.appendChild(dot)
      s.appendChild(document.createTextNode(' ' + esc(text)))
      return s
    }

    function chipWithNode(node, status) {
      var s = document.createElement('span')
      s.className = 'chip'
      var dot = document.createElement('span')
      dot.className = 'chip-dot'
      dot.style.background = STATUS_COLORS[status] || '#a1a1a1'
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