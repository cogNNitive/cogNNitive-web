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
   * The widget stages its pending work as events (design §2.4 keeps its vocabulary until
   * it migrates to the row model); `modelOf` is the one translation between the two, the
   * inverse of the exporter's `eventsOfRunModel`.
   *
   * The implementation is injected, never re-implemented: `scripts/lib/console-bundle.js`
   * wires the nn-core build in, and a console that boots without it leaves `foldRun` null so
   * a view degrades to the exported state instead of guessing.
   */

  var CORE_VERSION = '0.2.0'

  var fold = null
  var wired = false

  /** The console wiring hands the real nn-core fold in once, at boot. */
  function use(impl) {
    if (impl && typeof impl.foldRun === 'function') fold = impl.foldRun
    return typeof fold === 'function'
  }

  /**
   * Boots from the `nn-procedure-core` slot the exporter writes: the source of nn-core's own
   * `foldRun`. Returns false when the console carries no slot, which is the honest state of
   * a console exported before this existed.
   */
  function useFromDocument(doc) {
    if (wired) return available()
    wired = true
    if (!doc || typeof doc.getElementById !== 'function') return false
    var el = doc.getElementById('nn-procedure-core')
    var source = el && el.textContent ? el.textContent.trim() : ''
    if (!source) return false
    try {
      // The slot holds an IIFE bundle of nn-core's procedure module, whose `globalName` is
      // `__nnFoldModule`. Evaluating it inside one function scope keeps everything it
      // defines out of the console's globals: the returned object is the only exit.
      var factory = new Function(JSON.parse(source) + '\n; return __nnFoldModule')
      return use(factory())
    } catch {
      return false
    }
  }

  function available() {
    return typeof fold === 'function'
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

  /**
   * The run model a list of events describes, applied on top of a base model's rows. The
   * recorded rows are the truth; the events are what a caller is holding as drafts.
   */
  function modelOf(events, base) {
    var model = {
      state: (base && base.state) || 'open',
      seq: (base && base.seq) || 0,
      procedure: (base && base.procedure) || '',
      defRev: (base && base.defRev) || null,
      params: (base && base.params) || {},
      steps: {},
      artifacts: {},
      inputs: {},
      attempts: {},
    }
    if (base && base.steps) {
      Object.keys(base.steps).forEach(function (slug) {
        model.steps[slug] = rowOf(base.steps[slug])
      })
    }
    if (base && base.artifacts) {
      Object.keys(base.artifacts).forEach(function (slug) {
        model.artifacts[slug] = Object.assign({}, base.artifacts[slug])
      })
    }
    if (base && base.inputs) model.inputs = Object.assign({}, base.inputs)
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
   * The state a run would have if its pending events were applied on top of what it
   * already recorded. Same fold, over the recorded rows plus the pending events.
   */
  function project(run, pendingEvents, opts) {
    if (!run || !run.graph || !available()) return null
    var extra = Array.isArray(pendingEvents) ? pendingEvents : []
    var base = run.model || modelOf(Array.isArray(run.events) ? run.events : [], null)
    return fold(run.graph, modelOf(extra, base), opts || {})
  }

  return {
    version: CORE_VERSION,
    CORE_VERSION: CORE_VERSION,
    use: use,
    useFromDocument: useFromDocument,
    available: available,
    modelOf: modelOf,
    stateOf: stateOf,
    project: project,
  }
})
