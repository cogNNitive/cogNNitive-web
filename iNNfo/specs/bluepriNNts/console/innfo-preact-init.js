/* global module: writable */
/* global preact, htm */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      typeof preact !== 'undefined' ? preact : require('./vendor/preact.umd.js'),
      typeof htm !== 'undefined' ? htm : require('./vendor/htm.umd.js')
    )
  } else {
    root.InnfoPreact = factory(root.preact, root.htm)
  }
})(typeof self !== 'undefined' ? self : this, function (preactMod, htmMod) {
  'use strict'

  var p = preactMod || (typeof preact !== 'undefined' ? preact : (typeof window !== 'undefined' ? window.preact : null))
  var h = htmMod || (typeof htm !== 'undefined' ? htm : (typeof window !== 'undefined' ? window.htm : null))

  if (!p || !h) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('InnfoPreact: preact or htm missing from runtime')
    }
    return {}
  }

  var html = h.bind(p.h)

  if (typeof window !== 'undefined') {
    window.html = html
    window.h = p.h
    window.render = p.render
    window.Component = p.Component
  }

  return {
    preact: p,
    htm: h,
    html: html,
    h: p.h,
    render: p.render,
    Component: p.Component,
  }
})
