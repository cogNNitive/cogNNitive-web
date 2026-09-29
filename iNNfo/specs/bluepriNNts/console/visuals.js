/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.InnfoVisuals = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var VISUALS_VERSION = '0.1.0'

  // ---- Color vocabulary (single source of truth, mirrors app utils) ----

  var COLOR_HEX = {
    blue: '#3b82f6',
    green: '#22c55e',
    red: '#ef4444',
    grey: '#94a3b8',
    slate: '#94a3b8',
    orange: '#f97316',
    amber: '#f59e0b',
    purple: '#a855f7',
    teal: '#14b8a6',
    yellow: '#eab308',
    indigo: '#6366f1',
    pink: '#ec4899',
    black: '#0f172a',
  }

  var FALLBACK_HEX = '#94a3b8'

  function getHexColor(colorName) {
    return COLOR_HEX[String(colorName || '').toLowerCase()] || FALLBACK_HEX
  }

  function getHexColorLight(hex) {
    return hex + '18' // 10% alpha background
  }

  function getHexColorMedium(hex) {
    return hex + '30' // 19% alpha
  }

  function yiqLuminance(hex) {
    var clean = String(hex || '').length > 7 ? String(hex).slice(0, 7) : String(hex || '')
    if (!/^#([0-9a-f]{6})$/i.test(clean)) return 0
    var r = parseInt(clean.slice(1, 3), 16) / 255
    var g = parseInt(clean.slice(3, 5), 16) / 255
    var b = parseInt(clean.slice(5, 7), 16) / 255
    return 0.299 * r + 0.587 * g + 0.114 * b
  }

  function textColor(hex) {
    return yiqLuminance(hex) > 0.55 ? '#1e293b' : '#ffffff'
  }

  // ---- Inline SVG icons (Lucide-style, stroke-based, 16px) ----

  var ICON_SVG = {
    play: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
    task: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/></svg>',
    decision: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l9 9-9 9-9-9z"/></svg>',
    event: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/></svg>',
    package: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 9.4L7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    users: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'list-ordered': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
    file: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  }

  function icon(name) {
    var key = String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
    return ICON_SVG[key] || ICON_SVG.file
  }

  function iconSvg(name, size) {
    var svg = icon(name)
    if (size) {
      return svg
        .replace(/width="14"/g, 'width="' + size + '"')
        .replace(/width="12"/g, 'width="' + size + '"')
    }
    return svg
  }

  return {
    version: VISUALS_VERSION,
    VISUALS_VERSION: VISUALS_VERSION,
    COLOR_HEX: COLOR_HEX,
    FALLBACK_HEX: FALLBACK_HEX,
    getHexColor: getHexColor,
    getHexColorLight: getHexColorLight,
    getHexColorMedium: getHexColorMedium,
    yiqLuminance: yiqLuminance,
    textColor: textColor,
    ICON_SVG: ICON_SVG,
    icon: icon,
    iconSvg: iconSvg,
  }
})