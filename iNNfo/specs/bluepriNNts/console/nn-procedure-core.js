/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.nnProcedureCore = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  /*
   * The procedure fold, in the browser.
   *
   * `foldRun` is the same pure function nn-core runs at export time: given a graph and a
   * run model it returns the run's state, deriving nothing else. The console needs it live
   * so a view can answer "what would this run look like if the drafts I am holding were
   * applied?", which is a projection over the state it already has, not new truth.
   *
   * Projections apply directly over the RunModel (Step Run rows, Run Artifact rows and Step Requests)
   * without synthesizing or replaying deprecated historical events.
   *
   * The implementation is provided canonically by `nn-procedure-fold.generated.js` inside
   * `nn-console.bundle.js` (`globalThis.nnProcedureFold`).
   */

  var CORE_VERSION = '0.3.0'

  var fold = null
  var wired = false

  /** The console wiring hands the real nn-core fold in once, at boot. */
  function use(impl) {
    if (impl && typeof impl.foldRun === 'function') fold = impl.foldRun
    return typeof fold === 'function'
  }

  /**
   * Discovers the fold module either from canonical globals (nnProcedureFold / __nnFoldModule)
   * or, as a fallback, from any inline slot.
   */
  function useFromDocument(doc) {
    if (wired && available()) return true
    var mod =
      (typeof nnProcedureFold !== 'undefined' && nnProcedureFold) ||
      (typeof window !== 'undefined' && (window.nnProcedureFold || window.__nnFoldModule)) ||
      (typeof globalThis !== 'undefined' &&
        (globalThis.nnProcedureFold || globalThis.__nnFoldModule)) ||
      (doc &&
        doc.defaultView &&
        (doc.defaultView.nnProcedureFold || doc.defaultView.__nnFoldModule))
    if (mod && typeof mod.foldRun === 'function') {
      wired = true
      return use(mod)
    }
    if (!doc || typeof doc.getElementById !== 'function') return false
    var el = doc.getElementById('nn-procedure-core')
    var source = el && el.textContent ? el.textContent.trim() : ''
    if (!source) return false
    try {
      var code = source
      if (source.startsWith('"')) {
        try {
          var parsed = JSON.parse(source)
          if (typeof parsed === 'string') code = parsed
        } catch {
          code = source
        }
      }
      var factory = new Function(
        code +
          '\n; return (typeof nnProcedureFold !== "undefined" ? nnProcedureFold : typeof __nnFoldModule !== "undefined" ? __nnFoldModule : null)',
      )
      var res = use(factory())
      if (res) wired = true
      return res
    } catch {
      return false
    }
  }

  function available() {
    return typeof fold === 'function'
  }

  // Auto-wire on initialization if nnProcedureFold is in global scope
  var initialMod =
    (typeof nnProcedureFold !== 'undefined' && nnProcedureFold) ||
    (typeof window !== 'undefined' && (window.nnProcedureFold || window.__nnFoldModule)) ||
    (typeof globalThis !== 'undefined' && (globalThis.nnProcedureFold || globalThis.__nnFoldModule))
  if (initialMod && typeof initialMod.foldRun === 'function') {
    fold = initialMod.foldRun
    wired = true
  }

  function rowOf(row) {
    var out = {
      status: row.status || 'pending',
      attempt: row.attempt || 0,
      inputs: row.inputs || {},
    }
    if (row.outcome !== undefined) out.outcome = row.outcome
    if (row.next !== undefined) out.next = row.next
    if (row.waitingOn !== undefined) out.waitingOn = row.waitingOn
    if (row.failure !== undefined) out.failure = row.failure
    return out
  }

  function cloneRunModel(base) {
    var out = {
      state: (base && base.state) || 'open',
      seq: (base && base.seq) || 0,
      procedure: (base && base.procedure) || '',
      defRev: (base && base.defRev) || null,
      params: Object.assign({}, base && base.params),
      steps: {},
      artifacts: {},
      inputs: Object.assign({}, base && base.inputs),
      attempts: Object.assign({}, base && base.attempts),
    }
    if (base && base.steps) {
      Object.keys(base.steps).forEach(function (k) {
        out.steps[k] = rowOf(base.steps[k])
      })
    }
    if (base && base.artifacts) {
      Object.keys(base.artifacts).forEach(function (k) {
        out.artifacts[k] = Object.assign({}, base.artifacts[k])
      })
    }
    return out
  }

  function nextStepOf(graph, stepSlug, outcome) {
    if (!graph || !graph.steps || !graph.steps[stepSlug]) return undefined
    var def = graph.steps[stepSlug]
    var nextList = Array.isArray(def.next) ? def.next : []
    if (outcome && nextList.length) {
      for (var i = 0; i < nextList.length; i++) {
        var t = nextList[i]
        var targetStep = graph.steps[t]
        if (targetStep && targetStep.condition) {
          var m = /outcome\s*==\s*([\w-]+)/.exec(targetStep.condition)
          if (m && m[1] === outcome) return t
        }
      }
    }
    if (graph.edges && outcome) {
      for (var j = 0; j < graph.edges.length; j++) {
        var edge = graph.edges[j]
        if (
          edge &&
          edge.from === stepSlug &&
          edge.guard &&
          edge.guard.kind === 'outcome' &&
          edge.guard.token === outcome
        ) {
          return edge.to
        }
      }
    }
    if (nextList.length === 1) return nextList[0]
    return undefined
  }

  /**
   * Projects a RunModel directly by applying draft Step Requests or state updates onto it.
   */
  function projectModel(baseModel, requests, graph) {
    var model = cloneRunModel(baseModel)
    var reqs = Array.isArray(requests) ? requests : []
    reqs.forEach(function (r) {
      if (!r) return
      if (r.step) {
        var cur = model.steps[r.step] || { status: 'pending', attempt: 0, inputs: {} }
        if (r.action === 'complete') {
          var done = Object.assign({}, cur, { status: 'done' })
          if (r.outcome !== undefined) done.outcome = r.outcome
          var nxt = r.next || nextStepOf(graph, r.step, r.outcome)
          if (nxt) done.next = nxt
          model.steps[r.step] = done
        } else if (r.action === 'fail') {
          model.steps[r.step] = Object.assign({}, cur, {
            status: 'failed',
            failure: r.value || '',
          })
        } else if (r.action === 'wait') {
          model.steps[r.step] = Object.assign({}, cur, {
            status: 'waiting',
            waitingOn: r.value || '',
          })
        } else if (r.action === 'start') {
          model.steps[r.step] = Object.assign({}, cur, {
            status: 'active',
            attempt: (cur.attempt || 0) + 1,
          })
        }
      }
      if (r.artifact) {
        var prior = model.artifacts[r.artifact] || { kind: 'file' }
        var art = Object.assign({}, prior)
        if (r.action === 'produce' || r.status === 'produced') art.status = 'produced'
        else if (r.action === 'validate' || r.status === 'validated') art.status = 'validated'
        else if (r.action === 'reject' || r.status === 'rejected') art.status = 'rejected'
        if (r.value !== undefined) art.value = r.value
        model.artifacts[r.artifact] = art
      }
    })
    return model
  }

  /**
   * The run model a list of legacy events describes, applied on top of a base model's rows.
   * Kept for backwards compatibility with tests and older fixtures.
   */
  function modelOf(events, base) {
    var model = cloneRunModel(base)
    ;(Array.isArray(events) ? events : []).forEach(function (e) {
      if (e.kind === 'step_started') {
        model.steps[e.step] = { status: 'active', attempt: e.attempt || 1, inputs: e.inputs || {} }
      } else if (e.kind === 'step_waiting' && model.steps[e.step]) {
        model.steps[e.step] = Object.assign({}, model.steps[e.step], {
          status: 'waiting',
          waitingOn: e.value,
        })
      } else if (e.kind === 'step_completed' && model.steps[e.step]) {
        var done = Object.assign({}, model.steps[e.step], { status: 'done' })
        if (e.outcome !== undefined) done.outcome = e.outcome
        if (e.next !== undefined) done.next = e.next
        model.steps[e.step] = done
      } else if (e.kind === 'step_failed' && model.steps[e.step]) {
        model.steps[e.step] = Object.assign({}, model.steps[e.step], {
          status: 'failed',
          failure: e.value,
        })
      } else if (
        (e.kind === 'artifact_validated' ||
          e.kind === 'artifact_rejected' ||
          e.kind === 'artifact_produced') &&
        e.field
      ) {
        var prior = model.artifacts[e.field] || {}
        var art = { kind: prior.kind || 'file', status: e.kind.slice('artifact_'.length) }
        if (e.value !== undefined) art.value = e.value
        if (e.rev !== undefined) art.rev = e.rev
        if (e.step !== undefined) art.step = e.step
        model.artifacts[e.field] = art
      } else if (e.kind === 'input_recorded' && e.field) {
        var input = {}
        if (e.value !== undefined) input.value = e.value
        if (e.rev !== undefined) input.rev = e.rev
        model.inputs[e.field] = input
      } else if (e.kind === 'interrupted') {
        model.state = 'paused'
      } else if (e.kind === 'resumed') {
        model.state = 'open'
      } else if (e.kind === 'rebased') {
        model.defRev = e.value || model.defRev
      } else if (e.kind === 'completed' || e.kind === 'failed' || e.kind === 'cancelled') {
        model.state = e.kind
      }
    })
    return model
  }

  /**
   * The run state these events would produce. `null` when no fold is wired, so a caller
   * can tell "no projection" from "projected the same state".
   */
  function stateOf(graph, events, opts) {
    if (!available() || !graph) return null
    return fold(graph, modelOf(events, null), opts || {})
  }

  /**
   * The state a run would have if its pending requests or events were applied on top of what it
   * already recorded. Direct RunModel projection when requests are given; event translation if legacy events.
   */
  function project(run, pending, opts) {
    if (!run || !run.graph || !available()) return null
    var extra = Array.isArray(pending) ? pending : []
    var isLegacyEventList = extra.length > 0 && typeof extra[0].kind === 'string'
    var targetModel
    if (isLegacyEventList) {
      var base = run.model || modelOf(Array.isArray(run.events) ? run.events : [], null)
      targetModel = modelOf(extra, base)
    } else {
      var baseModel = run.model || (run.events ? modelOf(run.events, null) : null)
      targetModel = projectModel(baseModel, extra, run.graph)
    }
    return fold(run.graph, targetModel, opts || {})
  }

  if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
    useFromDocument(document)
  }

  return {
    version: CORE_VERSION,
    CORE_VERSION: CORE_VERSION,
    use: use,
    useFromDocument: useFromDocument,
    available: available,
    cloneRunModel: cloneRunModel,
    projectModel: projectModel,
    modelOf: modelOf,
    stateOf: stateOf,
    project: project,
  }
})
