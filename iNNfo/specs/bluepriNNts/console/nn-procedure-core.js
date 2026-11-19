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
   * list of events it returns the run's state, deriving nothing else. The console needs it
   * live so a view can answer "what would this run look like if the drafts I am holding
   * were applied?", which is a projection over the events it already has, not new truth.
   *
   * The implementation is injected, never re-implemented: `scripts/lib/console-bundle.js`
   * wires the nn-core build in, and a console that boots without it leaves `foldRun` null so
   * a view degrades to the exported state instead of guessing.
   */

  var CORE_VERSION = '0.1.0'

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

  /**
   * The run state these events would produce. `null` when no fold is wired, so a caller
   * can tell "no projection" from "projected the same state".
   */
  function stateOf(graph, events, opts) {
    if (!available() || !graph) return null
    return fold(graph, Array.isArray(events) ? events : [], opts || {})
  }

  /**
   * The state a run would have if its pending events were applied on top of what it
   * already recorded. Same fold, more events: nothing here decides what an event means.
   */
  function project(run, pendingEvents, opts) {
    if (!run || !run.graph) return null
    var recorded = Array.isArray(run.events) ? run.events : []
    var extra = Array.isArray(pendingEvents) ? pendingEvents : []
    return stateOf(run.graph, recorded.concat(extra), opts)
  }

  return {
    version: CORE_VERSION,
    CORE_VERSION: CORE_VERSION,
    use: use,
    useFromDocument: useFromDocument,
    available: available,
    stateOf: stateOf,
    project: project,
  }
})
