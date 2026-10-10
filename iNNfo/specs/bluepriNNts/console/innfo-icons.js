/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.InnfoIcons = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var ICONS = {
  "search": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <path d=\"m21 21-4.3-4.3\" />",
  "filter": "<polygon points=\"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3\" />",
  "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />",
  "minus": "<path d=\"M5 12h14\" />",
  "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />",
  "check": "<path d=\"M20 6 9 17l-5-5\" />",
  "chevron-down": "<path d=\"m6 9 6 6 6-6\" />",
  "chevron-up": "<path d=\"m18 15-6-6-6 6\" />",
  "chevron-left": "<path d=\"m15 18-6-6 6-6\" />",
  "chevron-right": "<path d=\"m9 18 6-6-6-6\" />",
  "arrow-left": "<path d=\"m12 19-7-7 7-7\" /> <path d=\"M19 12H5\" />",
  "arrow-right": "<path d=\"M5 12h14\" /> <path d=\"m12 5 7 7-7 7\" />",
  "arrow-up": "<path d=\"m5 12 7-7 7 7\" /> <path d=\"M12 19V5\" />",
  "arrow-down": "<path d=\"M12 5v14\" /> <path d=\"m19 12-7 7-7-7\" />",
  "external-link": "<path d=\"M15 3h6v6\" /> <path d=\"M10 14 21 3\" /> <path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\" />",
  "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" /> <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />",
  "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />",
  "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"7 10 12 15 17 10\" /> <line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  "upload": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"17 8 12 3 7 8\" /> <line x1=\"12\" x2=\"12\" y1=\"3\" y2=\"15\" />",
  "maximize-2": "<polyline points=\"15 3 21 3 21 9\" /> <polyline points=\"9 21 3 21 3 15\" /> <line x1=\"21\" x2=\"14\" y1=\"3\" y2=\"10\" /> <line x1=\"3\" x2=\"10\" y1=\"21\" y2=\"14\" />",
  "minimize-2": "<polyline points=\"4 14 10 14 10 20\" /> <polyline points=\"20 10 14 10 14 4\" /> <line x1=\"14\" x2=\"21\" y1=\"10\" y2=\"3\" /> <line x1=\"3\" x2=\"10\" y1=\"21\" y2=\"14\" />",
  "zoom-in": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\" /> <line x1=\"11\" x2=\"11\" y1=\"8\" y2=\"14\" /> <line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\" />",
  "zoom-out": "<circle cx=\"11\" cy=\"11\" r=\"8\" /> <line x1=\"21\" x2=\"16.65\" y1=\"21\" y2=\"16.65\" /> <line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\" />",
  "trash-2": "<path d=\"M3 6h18\" /> <path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\" /> <path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\" /> <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\" /> <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\" />",
  "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />",
  "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\" /> <path d=\"M3 5V19A9 3 0 0 0 21 19V5\" /> <path d=\"M3 12A9 3 0 0 0 21 12\" />",
  "table": "<path d=\"M12 3v18\" /> <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M3 9h18\" /> <path d=\"M3 15h18\" />",
  "layers": "<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\" /> <path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\" /> <path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\" />",
  "layout-dashboard": "<rect width=\"7\" height=\"9\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"14\" y=\"3\" rx=\"1\" /> <rect width=\"7\" height=\"9\" x=\"14\" y=\"12\" rx=\"1\" /> <rect width=\"7\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" />",
  "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />",
  "folder-tree": "<path d=\"M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z\" /> <path d=\"M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z\" /> <path d=\"M3 5a2 2 0 0 0 2 2h3\" /> <path d=\"M3 3v13a2 2 0 0 0 2 2h3\" />",
  "file": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" />",
  "file-text": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M10 9H8\" /> <path d=\"M16 13H8\" /> <path d=\"M16 17H8\" />",
  "boxes": "<path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\" /> <path d=\"m7 16.5-4.74-2.85\" /> <path d=\"m7 16.5 5-3\" /> <path d=\"M7 16.5v5.17\" /> <path d=\"M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\" /> <path d=\"m17 16.5-5-3\" /> <path d=\"m17 16.5 4.74-2.85\" /> <path d=\"M17 16.5v5.17\" /> <path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\" /> <path d=\"M12 8 7.26 5.15\" /> <path d=\"m12 8 4.74-2.85\" /> <path d=\"M12 13.5V8\" />",
  "box": "<path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\" /> <path d=\"m3.3 7 8.7 5 8.7-5\" /> <path d=\"M12 22V12\" />",
  "package": "<path d=\"m7.5 4.27 9 5.15\" /> <path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\" /> <path d=\"m3.3 7 8.7 5 8.7-5\" /> <path d=\"M12 22V12\" />",
  "workflow": "<rect width=\"8\" height=\"8\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M7 11v4a2 2 0 0 0 2 2h4\" /> <rect width=\"8\" height=\"8\" x=\"13\" y=\"13\" rx=\"2\" />",
  "git-branch": "<line x1=\"6\" x2=\"6\" y1=\"3\" y2=\"15\" /> <circle cx=\"18\" cy=\"6\" r=\"3\" /> <circle cx=\"6\" cy=\"18\" r=\"3\" /> <path d=\"M18 9a9 9 0 0 1-9 9\" />",
  "activity": "<path d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\" />",
  "calendar": "<path d=\"M8 2v4\" /> <path d=\"M16 2v4\" /> <rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /> <path d=\"M3 10h18\" />",
  "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <polyline points=\"12 6 12 12 16 14\" />",
  "tag": "<path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\" /> <circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
  "hash": "<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\" /> <line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\" /> <line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\" /> <line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\" />",
  "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /> <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />",
  "shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" />",
  "info": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 16v-4\" /> <path d=\"M12 8h.01\" />",
  "sparkles": "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /> <path d=\"M20 3v4\" /> <path d=\"M22 5h-4\" /> <path d=\"M4 17v2\" /> <path d=\"M5 18H3\" />",
  "eye": "<path d=\"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z\" /> <circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "eye-off": "<path d=\"M9.88 9.88a3 3 0 1 0 4.24 4.24\" /> <path d=\"M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68\" /> <path d=\"M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61\" /> <line x1=\"2\" x2=\"22\" y1=\"2\" y2=\"22\" />",
  "settings": "<path d=\"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z\" /> <circle cx=\"12\" cy=\"12\" r=\"3\" />",
  "play": "<polygon points=\"6 3 20 12 6 21 6 3\" />",
  "skip-forward": "<polygon points=\"5 4 15 12 5 20 5 4\" /> <line x1=\"19\" x2=\"19\" y1=\"5\" y2=\"19\" />",
  "clipboard": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" />",
  "terminal": "<polyline points=\"4 17 10 11 4 5\" /> <line x1=\"12\" x2=\"20\" y1=\"19\" y2=\"19\" />",
  "cpu": "<rect width=\"16\" height=\"16\" x=\"4\" y=\"4\" rx=\"2\" /> <rect width=\"6\" height=\"6\" x=\"9\" y=\"9\" rx=\"1\" /> <path d=\"M15 2v2\" /> <path d=\"M15 20v2\" /> <path d=\"M2 15h2\" /> <path d=\"M2 9h2\" /> <path d=\"M20 15h2\" /> <path d=\"M20 9h2\" /> <path d=\"M9 2v2\" /> <path d=\"M9 20v2\" />",
  "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\" /> <circle cx=\"9\" cy=\"7\" r=\"4\" /> <path d=\"M22 21v-2a4 4 0 0 0-3-3.87\" /> <path d=\"M16 3.13a4 4 0 0 1 0 7.75\" />",
  "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\" />",
  "gauge": "<path d=\"m12 14 4-4\" /> <path d=\"M3.34 19a10 10 0 1 1 17.32 0\" />",
  "list-ordered": "<line x1=\"10\" x2=\"21\" y1=\"6\" y2=\"6\" /> <line x1=\"10\" x2=\"21\" y1=\"12\" y2=\"12\" /> <line x1=\"10\" x2=\"21\" y1=\"18\" y2=\"18\" /> <path d=\"M4 6h1v4\" /> <path d=\"M4 10h2\" /> <path d=\"M6 18H4c0-1 2-2 2-3s-1-1.5-2-1\" />",
  "split": "<path d=\"M16 3h5v5\" /> <path d=\"M8 3H3v5\" /> <path d=\"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3\" /> <path d=\"m15 9 6-6\" />",
  "bar-chart-2": "<line x1=\"18\" x2=\"18\" y1=\"20\" y2=\"10\" /> <line x1=\"12\" x2=\"12\" y1=\"20\" y2=\"4\" /> <line x1=\"6\" x2=\"6\" y1=\"20\" y2=\"14\" />",
  "trending-up": "<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\" /> <polyline points=\"16 7 22 7 22 13\" />",
  "trending-down": "<polyline points=\"22 17 13.5 8.5 8.5 13.5 2 7\" /> <polyline points=\"16 17 22 17 22 11\" />",
  "dollar-sign": "<line x1=\"12\" x2=\"12\" y1=\"2\" y2=\"22\" /> <path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\" />",
  "pie-chart": "<path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" /> <path d=\"M22 12A10 10 0 0 0 12 2v10z\" />",
  "decision": "<polygon points=\"12 2 22 12 12 22 2 12\"></polygon>",
  "event": "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><circle cx=\"12\" cy=\"12\" r=\"3.5\" fill=\"currentColor\"></circle>",
  "task": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" />",
  "refresh": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />",
  "skip": "<polygon points=\"5 4 15 12 5 20 5 4\" /> <line x1=\"19\" x2=\"19\" y1=\"5\" y2=\"19\" />"
};

  function getIconPaths(name) {
    var key = String(name || '').toLowerCase().trim();
    return ICONS[key] || ICONS['help-circle'] || ICONS['box'] || '';
  }

  // The name lands in a class attribute: keep only slug characters.
  function safeClassName(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'default';
  }

  function getSvg(name, options) {
    var opts = options || {};
    var size = opts.size || 16;
    var cls = opts.class || opts.className || '';
    var strokeWidth = opts.strokeWidth || 2;
    var paths = getIconPaths(name);
    return '<svg class="lucide lucide-' + safeClassName(name) + (cls ? ' ' + cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  function Icon(props) {
    var p = props || {};
    var size = p.size || 16;
    var cls = p.class || p.className || '';
    var strokeWidth = p.strokeWidth || 2;
    var paths = getIconPaths(p.name);
    if (typeof window !== 'undefined' && window.html) {
      return window.html`<svg class=${"lucide lucide-" + safeClassName(p.name) + (cls ? " " + cls : "")} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${strokeWidth} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: paths }}></svg>`;
    }
    return getSvg(p.name, p);
  }

  return {
    ICONS: ICONS,
    getIconPaths: getIconPaths,
    getSvg: getSvg,
    Icon: Icon,
  };
});
