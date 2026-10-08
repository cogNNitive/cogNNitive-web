/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.InnfoUI = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var UI_VERSION = '0.1.0'

  // ---- Design tokens (single source of truth) ----
  //
  // Status fg values are the lightest Tailwind step whose ratio against its own
  // -bg is >= 5.0 in light mode (0.5 margin over the 4.5 floor). See the design
  // contrast table; the contrast suite recomputes these independently.
  var TOKEN_VALUES = {
    light: {
      '--innfo-bg': '#f9fafb',
      '--innfo-surface': '#ffffff',
      '--innfo-surface-2': '#f3f4f6',
      '--innfo-text': '#111827',
      '--innfo-muted': '#6b7280',
      '--innfo-border': '#e5e7eb',
      '--innfo-accent': '#1f2937',
      '--innfo-link': '#2563eb',
      '--innfo-focus': '#2563eb',
      '--innfo-concept-1': '#3b82f6',
      '--innfo-concept-2': '#8b5cf6',
      '--innfo-concept-3': '#14b8a6',
      '--innfo-concept-4': '#f59e0b',
      '--innfo-concept-5': '#ec4899',
      '--innfo-concept-6': '#22c55e',
      '--innfo-concept-7': '#f97316',
      '--innfo-concept-8': '#6366f1',
      '--innfo-concept-9': '#ef4444',
      '--innfo-concept-10': '#eab308',
      '--innfo-concept-11': '#a855f7',
      '--innfo-concept-12': '#6b7280',
      '--innfo-status-pending': '#92400e',
      '--innfo-status-applied': '#166534',
      '--innfo-status-rejected': '#b91c1c',
      '--innfo-status-stale': '#4b5563',
      '--innfo-status-pending-bg': '#fef3c7',
      '--innfo-status-applied-bg': '#dcfce7',
      '--innfo-status-rejected-bg': '#fee2e2',
      '--innfo-status-stale-bg': '#f3f4f6',
      '--innfo-origin-agent': '#7c3aed',
      '--innfo-origin-human': '#2563eb',
      '--innfo-origin-reviewer': '#b45309',
      '--innfo-origin-document': '#4b5563',
      '--innfo-origin-error': '#dc2626',
      '--innfo-radius-sm': '6px',
      '--innfo-radius': '8px',
      '--innfo-radius-lg': '10px',
      '--innfo-font':
        "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      '--innfo-mono': "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
      '--innfo-shadow': '0 1px 2px rgba(0, 0, 0, .06)',
    },
    dark: {
      '--innfo-bg': '#0f172a',
      '--innfo-surface': '#1e293b',
      '--innfo-surface-2': '#263549',
      '--innfo-text': '#e2e8f0',
      '--innfo-muted': '#94a3b8',
      '--innfo-border': '#334155',
      '--innfo-accent': '#cbd5e1',
      '--innfo-link': '#60a5fa',
      '--innfo-focus': '#60a5fa',
      '--innfo-concept-1': '#60a5fa',
      '--innfo-concept-2': '#a78bfa',
      '--innfo-concept-3': '#2dd4bf',
      '--innfo-concept-4': '#fbbf24',
      '--innfo-concept-5': '#f472b6',
      '--innfo-concept-6': '#4ade80',
      '--innfo-concept-7': '#fb923c',
      '--innfo-concept-8': '#818cf8',
      '--innfo-concept-9': '#f87171',
      '--innfo-concept-10': '#facc15',
      '--innfo-concept-11': '#c084fc',
      '--innfo-concept-12': '#9ca3af',
      '--innfo-status-pending': '#fbbf24',
      '--innfo-status-applied': '#4ade80',
      '--innfo-status-rejected': '#f87171',
      '--innfo-status-stale': '#94a3b8',
      '--innfo-status-pending-bg': '#451a03',
      '--innfo-status-applied-bg': '#052e16',
      '--innfo-status-rejected-bg': '#450a0a',
      '--innfo-status-stale-bg': '#1e293b',
      '--innfo-origin-agent': '#a78bfa',
      '--innfo-origin-human': '#60a5fa',
      '--innfo-origin-reviewer': '#fbbf24',
      '--innfo-origin-document': '#9ca3af',
      '--innfo-origin-error': '#f87171',
      '--innfo-radius-sm': '6px',
      '--innfo-radius': '8px',
      '--innfo-radius-lg': '10px',
      '--innfo-font':
        "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      '--innfo-mono': "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
      '--innfo-shadow': '0 1px 2px rgba(0, 0, 0, .4)',
    },
  }

  var TOKENS = Object.keys(TOKEN_VALUES.light)

  function declBlock(values) {
    return TOKENS.map(function (name) {
      return '  ' + name + ': ' + values[name] + ';'
    }).join('\n')
  }

  // Component CSS: every rule is scoped to a [data-innfo-component] root so it
  // never leaks into a shell. C appends the review components here.
  var COMPONENT_CSS = [
    '[data-innfo-component]{box-sizing:border-box}',
    '.innfo-concept-pill,.innfo-element-pill,.innfo-marker-chip,.innfo-status-badge{display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2}',
    '.innfo-concept-dot{width:.6em;height:.6em;border-radius:50%;background:var(--innfo-muted);flex:0 0 auto}',
    '.innfo-concept-count{color:var(--innfo-muted)}',
    '.innfo-element-origin{display:inline-flex;align-items:center;color:var(--innfo-origin-document)}',
    '.innfo-element-origin[data-origin=error]{color:var(--innfo-origin-error)}',
    '.innfo-element-origin[data-origin=agent]{color:var(--innfo-origin-agent)}',
    '.innfo-element-origin[data-origin=human]{color:var(--innfo-origin-human)}',
    '.innfo-element-origin[data-origin=reviewer]{color:var(--innfo-origin-reviewer)}',
    '.innfo-status-badge{border-radius:var(--innfo-radius-sm);padding:.05em .5em;font-weight:600}',
    '.innfo-status-badge[data-status=pending]{color:var(--innfo-status-pending);background:var(--innfo-status-pending-bg)}',
    '.innfo-status-badge[data-status=applied]{color:var(--innfo-status-applied);background:var(--innfo-status-applied-bg)}',
    '.innfo-status-badge[data-status=rejected]{color:var(--innfo-status-rejected);background:var(--innfo-status-rejected-bg)}',
    '.innfo-status-badge[data-status=stale]{color:var(--innfo-status-stale);background:var(--innfo-status-stale-bg)}',
    '.innfo-draft-list{list-style:none;margin:0;padding:0}',
    '.innfo-draft-row{display:flex;align-items:baseline;gap:.5em;padding:.3em 0;border-bottom:1px solid var(--innfo-border)}',
    '.innfo-draft-kind{font-weight:600;color:var(--innfo-muted)}',
    '.innfo-draft-text{flex:1 1 auto}',
    '.innfo-draft-target-changed{color:var(--innfo-status-stale);font-size:.8rem}',
    '.innfo-annotation-popover{border:1px solid var(--innfo-border);border-radius:var(--innfo-radius);background:var(--innfo-surface);padding:.75em;box-shadow:var(--innfo-shadow)}',
    '.innfo-popover-original{color:var(--innfo-muted)}',
    '.innfo-popover-proposed{display:block;width:100%;font:inherit}',
    '.innfo-rail-progress{color:var(--innfo-muted);font-size:.75rem}',
    '.innfo-review-toggle,.innfo-changed-filter{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface);color:var(--innfo-text);font:inherit;font-size:.82rem;font-weight:600;padding:6px 14px;border-radius:var(--innfo-radius-sm);cursor:pointer}',
    '.innfo-review-toggle[aria-pressed=true],.innfo-changed-filter[aria-pressed=true]{background:var(--innfo-accent);color:var(--innfo-surface)}',
    '.innfo-review-anchor{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease}',
    '.innfo-review-anchor:hover{opacity:1;background:var(--innfo-surface);border-color:var(--innfo-focus)}',
    '[data-innfo-component=element-card]:hover .innfo-review-anchor,[data-innfo-component=field-row]:hover .innfo-review-anchor{opacity:.85}',
    '.innfo-review-anchor:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px;opacity:1}',
    '.innfo-reviewed-toggle{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.72rem;padding:.1em .5em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em}',
    '.innfo-reviewed-toggle[data-state=reviewed]{color:var(--innfo-status-applied);background:var(--innfo-status-applied-bg)}',
    '.innfo-reviewed-toggle[data-state=changed]{color:var(--innfo-status-stale);background:var(--innfo-status-stale-bg)}',
    '.innfo-review-badges{display:inline-flex;gap:.3em;align-items:center;margin-left:.4em}',
    'html[data-innfo-filter=changed] [data-innfo-component=element-card]:not([data-innfo-changed]){display:none}',
    '.innfo-popover-comment,.innfo-popover-proposed{display:block;width:100%;font:inherit;box-sizing:border-box}',
    '@media (max-width:640px){.innfo-annotation-popover{width:100%}.innfo-review-toggle,.innfo-changed-filter{width:100%}}',
    '.innfo-edit-modal{border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-lg);padding:0;max-width:540px;width:100%;background:var(--innfo-surface);color:var(--innfo-text);box-shadow:0 12px 40px rgba(0,0,0,.15)}',
    '.innfo-edit-modal::backdrop{background:rgba(0,0,0,.35)}',
    '.innfo-edit-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--innfo-border)}',
    '.innfo-edit-modal-head h2{margin:0;font-size:1.05rem;font-weight:700}',
    '.innfo-edit-modal-close{border:1px solid var(--innfo-border);background:var(--innfo-surface);color:var(--innfo-muted);border-radius:var(--innfo-radius-sm);width:28px;height:28px;cursor:pointer;font-size:1.1rem;font-weight:700;display:flex;align-items:center;justify-content:center}',
    '.innfo-edit-modal-body{padding:20px}',
    '.innfo-edit-mode-selector{display:flex;gap:8px;margin-bottom:16px}',
    '.innfo-edit-mode-btn{padding:6px 14px;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);border-radius:var(--innfo-radius-sm);cursor:pointer;font:inherit;font-size:.85rem;font-weight:600}',
    '.innfo-edit-mode-btn.active{background:var(--innfo-accent);color:var(--innfo-bg);border-color:var(--innfo-accent)}',
    '.innfo-edit-field-label{display:block;font-size:.82rem;font-weight:600;color:var(--innfo-muted);margin-bottom:6px}',
    '.innfo-edit-input,.innfo-edit-select,.innfo-edit-textarea{width:100%;padding:8px 10px;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);background:var(--innfo-surface);color:var(--innfo-text);font:inherit;font-size:.88rem}',
    '.innfo-edit-input:focus,.innfo-edit-select:focus,.innfo-edit-textarea:focus{outline:none;border-color:var(--innfo-focus);box-shadow:0 0 0 2px rgba(37,99,235,.2)}',
    '.innfo-edit-checkbox-label{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer}',
    '.innfo-edit-multiselect{display:flex;flex-direction:column;gap:6px}',
    '.innfo-edit-modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--innfo-border);background:var(--innfo-surface-2);border-radius:0 0 var(--innfo-radius-lg) var(--innfo-radius-lg)}',
    '.innfo-edit-btn{padding:7px 16px;border-radius:var(--innfo-radius-sm);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer}',
    '.innfo-edit-btn-save{background:var(--innfo-accent);color:var(--innfo-bg);border:1px solid var(--innfo-accent)}',
    '.innfo-edit-btn-cancel{background:var(--innfo-surface);color:var(--innfo-text);border:1px solid var(--innfo-border)}',
    '.innfo-modal-tabs{display:flex;border-bottom:1px solid var(--innfo-border);background:var(--innfo-surface-2);padding:0 12px;gap:4px}',
    '.innfo-modal-tab-btn{padding:8px 16px;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--innfo-muted);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer}',
    '.innfo-modal-tab-btn.active{color:var(--innfo-text);border-bottom-color:var(--innfo-accent);background:var(--innfo-surface)}',
    '.innfo-modal-tab-panel{padding:20px}',
    '.innfo-history-section{margin-bottom:16px}',
    '.innfo-history-title{font-size:.85rem;font-weight:700;margin:0 0 8px;color:var(--innfo-text)}',
    '.innfo-history-item{padding:8px 10px;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);background:var(--innfo-surface-2);margin-bottom:6px;font-size:.82rem}',
    '.innfo-history-meta{color:var(--innfo-muted);font-size:.75rem;margin-bottom:3px}',
    '.innfo-history-notes{font-weight:500;color:var(--innfo-text)}',
    '.innfo-history-empty{color:var(--innfo-muted);font-size:.82rem;font-style:italic}',
    // Element-card redesign: hover-reveal edit anchors (same pattern as
    // .innfo-review-anchor), per-card edit toggle, QKUD chip, tags, relations.
    '.innfo-edit-anchor{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease;display:inline-flex;align-items:center;justify-content:center;min-width:1.9em;min-height:1.6em}',
    '.innfo-edit-anchor:hover{opacity:1;background:var(--innfo-surface);border-color:var(--innfo-focus)}',
    '[data-innfo-component=element-card]:hover .innfo-edit-anchor,[data-innfo-component=field-row]:hover .innfo-edit-anchor{opacity:.85}',
    '.innfo-edit-anchor:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px;opacity:1}',
    '[data-innfo-component=element-card][data-editing] .innfo-edit-anchor,[data-innfo-component=element-card][data-editing] .innfo-review-anchor{opacity:.9}',
    '.innfo-edit-toggle{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-muted);font:inherit;padding:.25em .5em;border-radius:var(--innfo-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-left:auto}',
    '.innfo-edit-toggle:hover{color:var(--innfo-text);border-color:var(--innfo-focus)}',
    '[data-innfo-component=element-card][data-editing] .innfo-edit-toggle{color:var(--innfo-link);border-color:var(--innfo-link);background:var(--innfo-surface)}',
    '.innfo-edit-toggle:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px}',
    '.innfo-qud{display:inline-flex;align-items:center;gap:.35em;font-family:var(--innfo-mono);font-size:.75rem;color:var(--innfo-muted);background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);padding:.15em .3em .15em .6em;max-width:100%}',
    '.innfo-qud-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.innfo-qud-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--innfo-muted);font:inherit;padding:.1em .35em;border-radius:var(--innfo-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.innfo-qud-btn:hover{color:var(--innfo-text);border-color:var(--innfo-border);background:var(--innfo-surface)}',
    '.innfo-qud-detail{display:none;font-family:var(--innfo-mono);font-size:.75rem;color:var(--innfo-muted);background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);padding:.5em .7em;margin:.5em 0 0;word-break:break-all}',
    '[data-qud-open] .innfo-qud-detail{display:block}',
    '.innfo-card-path{font-family:var(--innfo-mono);font-size:.75rem;color:var(--innfo-muted);border-top:1px solid var(--innfo-border);padding:.5em 0 0;margin:.7em 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.innfo-tag-row{display:flex;gap:.4em;flex-wrap:wrap;align-items:center;margin:.6em 0 0}',
    '.innfo-tag{display:inline-flex;align-items:center;gap:.3em;font-size:.78rem;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);padding:.1em .3em .1em .55em}',
    '.innfo-tag-remove{appearance:none;border:none;background:none;color:var(--innfo-muted);font:inherit;cursor:pointer;display:inline-flex;padding:.1em;border-radius:4px}',
    '.innfo-tag-remove:hover{color:var(--innfo-status-rejected)}',
    '.innfo-tag-add{appearance:none;border:1px dashed var(--innfo-border);background:none;color:var(--innfo-muted);font:inherit;font-size:.78rem;border-radius:var(--innfo-radius-sm);padding:.1em .55em;cursor:pointer}',
    '.innfo-tag-add:hover{color:var(--innfo-link);border-color:var(--innfo-link)}',
    '.innfo-rel-list{list-style:none;margin:.6em 0 0;padding:0;display:flex;flex-direction:column;gap:.35em}',
    '.innfo-rel-row{display:flex;align-items:center;gap:.5em;font-size:.85rem}',
    '.innfo-rel-field{color:var(--innfo-muted);font-size:.78rem;min-width:5em}',
    '.innfo-rel-act{appearance:none;border:1px solid transparent;background:none;color:var(--innfo-muted);font:inherit;cursor:pointer;display:inline-flex;padding:.15em;border-radius:4px;opacity:.45}',
    '.innfo-rel-row:hover .innfo-rel-act,.innfo-rel-act:focus-visible{opacity:1}',
    '.innfo-rel-act:hover{color:var(--innfo-link);border-color:var(--innfo-border)}',
    '.innfo-rel-act.danger:hover{color:var(--innfo-status-rejected)}',
    '.innfo-rel-add{appearance:none;border:1px dashed var(--innfo-border);background:none;color:var(--innfo-muted);font:inherit;font-size:.78rem;border-radius:var(--innfo-radius-sm);padding:.1em .55em;cursor:pointer;align-self:flex-start}',
    '.innfo-rel-add:hover{color:var(--innfo-link);border-color:var(--innfo-link)}',
    '@media (max-width:640px){.innfo-edit-anchor,.innfo-edit-toggle,.innfo-qud-btn,.innfo-rel-act{min-width:32px;min-height:32px}.innfo-qud{font-size:.7rem}}',
  ]
  for (var slot = 1; slot <= 12; slot++) {
    COMPONENT_CSS.push(
      '[data-concept-slot="' + slot + '"] .innfo-concept-dot{background:var(--innfo-concept-' + slot + ')}',
    )
  }
  var COMPONENT_CSS_TEXT = COMPONENT_CSS.join('\n')

  // D2: light is the default; an OS dark preference applies unless the author
  // pinned light; an explicit [data-theme=dark] always wins.
  function generateTokenCss(values) {
    var v = values || TOKEN_VALUES
    return (
      ':root, [data-theme=light] {\n' +
      declBlock(v.light) +
      '\n}\n' +
      '@media (prefers-color-scheme: dark) {\n' +
      '  :root:not([data-theme=light]) {\n' +
      declBlock(v.dark)
        .split('\n')
        .map(function (l) {
          return '  ' + l
        })
        .join('\n') +
      '\n  }\n' +
      '}\n' +
      '[data-theme=dark] {\n' +
      declBlock(v.dark) +
      '\n}\n' +
      COMPONENT_CSS_TEXT +
      '\n'
    )
  }

  var TOKENS_ATTR = 'data-innfo-tokens'

  function ensureTokens(doc) {
    var d = doc || (typeof document !== 'undefined' ? document : null)
    if (!d || !d.head) throw new Error('InnfoUI.ensureTokens: no document')
    var existing = d.querySelector('style[' + TOKENS_ATTR + ']')
    if (existing && existing.getAttribute(TOKENS_ATTR) === UI_VERSION) return existing
    var css = generateTokenCss()
    if (existing) {
      existing.textContent = css
      existing.setAttribute(TOKENS_ATTR, UI_VERSION)
      return existing
    }
    var style = d.createElement('style')
    style.setAttribute(TOKENS_ATTR, UI_VERSION)
    style.textContent = css
    if (d.head.firstChild) d.head.insertBefore(style, d.head.firstChild)
    else d.head.appendChild(style)
    return style
  }

  function setTheme(doc, theme) {
    var d = doc || (typeof document !== 'undefined' ? document : null)
    if (!d || !d.documentElement) throw new Error('InnfoUI.setTheme: no document')
    if (theme !== 'light' && theme !== 'dark' && theme !== null) {
      throw new TypeError('InnfoUI.setTheme: expected light|dark|null')
    }
    if (theme === null) d.documentElement.removeAttribute('data-theme')
    else d.documentElement.setAttribute('data-theme', theme)
  }

  // ---- Shared helpers ----

  function slug(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // The palette order doubles as the named-color index (spec order, grey -> 12).
  var COLOR_INDEX = {
    blue: 1,
    violet: 2,
    purple: 2,
    teal: 3,
    amber: 4,
    orange: 4,
    pink: 5,
    green: 6,
    red: 9,
    yellow: 10,
    indigo: 8,
    slate: 12,
    grey: 12,
    gray: 12,
    black: 12,
  }

  // D7: explicit color wins; otherwise (index mod 12) + 1.
  function conceptSlot(data) {
    if (data && data.color && COLOR_INDEX[String(data.color).toLowerCase()]) {
      return COLOR_INDEX[String(data.color).toLowerCase()]
    }
    var index = Number(data && data.index) || 0
    return (index % 12) + 1
  }

  function makeEl(doc, tag, cls, text) {
    var node = doc.createElement(tag)
    if (cls) node.className = cls
    if (text != null) node.textContent = String(text)
    return node
  }

  function resolveDoc(opts) {
    return (opts && opts.doc) || (typeof document !== 'undefined' ? document : null)
  }

  // SVG bodies (everything after viewBox="0 0 24 24", before </svg>). Moved out
  // of innfo-runtime.js's former svgIcon.
  var ICON_PATHS = {
    pencil: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path>',
    pin: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>',
    chart: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>',
    target: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
    explorer: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>',
    matrices: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>',
    timeline: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path>',
    star: ' fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    calc: ' fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="9" x2="19" y2="9"></line><line x1="5" y1="15" x2="19" y2="15"></line>',
    derived: ' fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a4 4 0 0 1 8 0 4 4 0 0 0 8 0"></path>',
    close: ' fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    review: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path>',
    'cite-agent': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="11" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><line x1="12" y1="7" x2="12" y2="9"></line><line x1="8" y1="14" x2="8" y2="15"></line><line x1="16" y1="14" x2="16" y2="15"></line>',
    'cite-human': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-7 8-7s8 3 8 7"></path>',
    'cite-reviewer': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="m9 10 2 2 4-4"></path>',
    'cite-document': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line>',
    'cite-error': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
  }

  function icon(name, size, cls) {
    var s = size || 14
    var c = cls ? ' ' + cls : ''
    var body = ICON_PATHS[name]
    if (!body) {
      if (typeof InnfoIcons !== 'undefined' && typeof InnfoIcons.getSvg === 'function') {
        return InnfoIcons.getSvg(name, { size: s, class: 'innfo-icon' + c })
      }
      return (
        '<svg class="innfo-icon' +
        c +
        '" width="' +
        s +
        '" height="' +
        s +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
      )
    }
    return (
      '<svg class="innfo-icon' +
      c +
      '" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 24 24"' +
      body +
      '</svg>'
    )
  }

  // ---- Components ----

  function ConceptPill(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.ConceptPill: data required')
    var doc = resolveDoc(opts)
    var interactive = !!(opts && opts.onSelect)
    var pill = makeEl(doc, interactive ? 'button' : 'span', 'innfo-concept-pill')
    pill.setAttribute('data-innfo-component', 'concept-pill')
    pill.setAttribute('data-concept-id', String(data.id == null ? '' : data.id))
    pill.setAttribute('data-concept-slot', String(conceptSlot(data)))
    if (interactive) {
      pill.setAttribute('type', 'button')
      pill.addEventListener('click', function () {
        opts.onSelect(data)
      })
    }
    var dot = makeEl(doc, 'i', 'innfo-concept-dot')
    pill.appendChild(dot)
    pill.appendChild(doc.createTextNode(String(data.label == null ? '' : data.label)))
    if (data.count != null) pill.appendChild(makeEl(doc, 'span', 'innfo-concept-count', ' (' + data.count + ')'))
    return pill
  }

  function ElementPill(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.ElementPill: data required')
    var doc = resolveDoc(opts)
    var tag = opts && opts.href ? 'a' : opts && opts.onSelect ? 'button' : 'span'
    var pill = makeEl(doc, tag, 'innfo-element-pill')
    pill.setAttribute('data-innfo-component', 'element-pill')
    pill.setAttribute('data-element-id', String(data.id == null ? '' : data.id))
    if (opts && opts.href) pill.setAttribute('href', String(opts.href))
    if (tag === 'button') {
      pill.setAttribute('type', 'button')
      pill.addEventListener('click', function () {
        if (opts && opts.onSelect) opts.onSelect(data)
      })
    }
    if (data.origin) {
      var wrap = makeEl(doc, 'span', 'innfo-element-origin')
      wrap.setAttribute('data-origin', String(data.origin))
      wrap.innerHTML = icon('cite-' + data.origin, 12)
      pill.appendChild(wrap)
    }
    pill.appendChild(doc.createTextNode(String(data.label == null ? '' : data.label)))
    return pill
  }

  function MarkerChip(data) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.MarkerChip: data required')
    var doc = resolveDoc(null)
    var chip = makeEl(doc, 'span', 'innfo-marker-chip')
    chip.setAttribute('data-innfo-component', 'marker-chip')
    chip.setAttribute('data-marker-id', String(data.id == null ? '' : data.id))
    chip.setAttribute('data-kind', String(data.kind == null ? '' : data.kind))
    chip.appendChild(doc.createTextNode(String(data.label == null ? '' : data.label)))
    if (data.value != null) chip.appendChild(makeEl(doc, 'b', null, data.value))
    return chip
  }

  // ---- Element-card redesign: QKUD chip, tags, relations, edit toggle ----
  //
  // Rule: the QKUD (unique knowledge-unit id) is READ-ONLY — copy + info only,
  // never a pencil. Pencils live on editable KUs (name, description, markers,
  // fields) and are owned by the review controller, not the kit.

  function copyText(text) {
    var value = String(text == null ? '' : text)
    try {
      if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        var pending = navigator.clipboard.writeText(value)
        if (pending && typeof pending.catch === 'function') {
          pending.catch(function () {
            /* clipboard denied; the id stays visible for manual copy */
          })
        }
        return
      }
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        var ta = document.createElement('textarea')
        ta.value = value
        ta.setAttribute('readonly', '')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    } catch {
      /* copy is best-effort; never break the card */
    }
  }

  function QudChip(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.QudChip: data required')
    var doc = resolveDoc(opts)
    var wrap = makeEl(doc, 'span', 'innfo-qud-wrap')
    wrap.setAttribute('data-innfo-component', 'qud-chip')
    wrap.setAttribute('data-qud', String(data.id == null ? '' : data.id))

    var chip = makeEl(doc, 'span', 'innfo-qud')
    var id = makeEl(doc, 'span', 'innfo-qud-id', data.id)
    id.setAttribute('title', String(data.id == null ? '' : data.id))
    chip.appendChild(id)

    var copy = makeEl(doc, 'button', 'innfo-qud-btn')
    copy.setAttribute('type', 'button')
    copy.setAttribute('aria-label', 'Copy knowledge unit ID')
    copy.setAttribute('title', 'Copy knowledge unit ID')
    copy.innerHTML = icon('copy', 13)
    copy.addEventListener('click', function (ev) {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
      copyText(data.id)
    })
    chip.appendChild(copy)

    var info = makeEl(doc, 'button', 'innfo-qud-btn')
    info.setAttribute('type', 'button')
    info.setAttribute('aria-label', 'Knowledge unit ID details')
    info.setAttribute('title', 'Knowledge unit ID details')
    info.setAttribute('aria-expanded', 'false')
    info.innerHTML = icon('info', 13)
    info.addEventListener('click', function (ev) {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
      var host = wrap.closest
        ? wrap.closest('[data-innfo-component="element-card"]') || wrap
        : wrap
      var open = host.getAttribute('data-qud-open') === 'true'
      host.setAttribute('data-qud-open', open ? 'false' : 'true')
      info.setAttribute('aria-expanded', open ? 'false' : 'true')
    })
    chip.appendChild(info)
    wrap.appendChild(chip)

    var detail = makeEl(doc, 'div', 'innfo-qud-detail')
    var lines = []
    if (data.id != null) lines.push(['id', String(data.id)])
    if (data.concept != null) lines.push(['concept', String(data.concept)])
    if (data.path != null) lines.push(['path', String(data.path)])
    if (data.hash != null) lines.push(['hash', String(data.hash)])
    lines.forEach(function (pair, i) {
      if (i > 0) detail.appendChild(doc.createElement('br'))
      detail.appendChild(doc.createTextNode(pair[0] + ': ' + pair[1]))
    })
    wrap.appendChild(detail)
    return wrap
  }

  function TagRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.TagRow: data required')
    var doc = resolveDoc(opts)
    var tags = Array.isArray(data.tags) ? data.tags : []
    var row = makeEl(doc, 'div', 'innfo-tag-row')
    row.setAttribute('data-innfo-component', 'tag-row')
    tags.forEach(function (t) {
      var tag = makeEl(doc, 'span', 'innfo-tag')
      tag.setAttribute('data-tag', String(t))
      tag.appendChild(doc.createTextNode(String(t)))
      row.appendChild(tag)
    })
    return row
  }

  function RelList(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.RelList: data required')
    var doc = resolveDoc(opts)
    var rels = Array.isArray(data.relations) ? data.relations : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'innfo-rel-list')
    ul.setAttribute('data-innfo-component', 'rel-list')
    rels.forEach(function (r) {
      if (!r || typeof r !== 'object') return
      var li = makeEl(doc, 'li', 'innfo-rel-row')
      if (r.field) li.setAttribute('data-rel-field', String(r.field))
      if (r.target) li.setAttribute('data-rel-target', String(r.target))
      li.appendChild(makeEl(doc, 'span', 'innfo-rel-field', (r.field || 'related') + ' \u2192'))
      var label = r.targetLabel || (byId[r.target] && byId[r.target].name) || r.target || '?'
      if (r.target) {
        li.appendChild(
          ElementPill({ id: r.target, label: label }, { href: '#el-' + r.target }),
        )
      } else {
        li.appendChild(doc.createTextNode(String(label)))
      }
      ul.appendChild(li)
    })
    return ul
  }

  function EditToggle(data, opts) {
    var doc = resolveDoc(opts)
    var btn = makeEl(doc, 'button', 'innfo-edit-toggle')
    btn.setAttribute('data-innfo-component', 'edit-toggle')
    btn.setAttribute('type', 'button')
    btn.setAttribute('aria-pressed', 'false')
    btn.setAttribute('aria-label', 'Toggle edit controls on this card')
    btn.setAttribute('title', 'Toggle edit controls on this card')
    btn.innerHTML = icon('pencil', 14)
    return btn
  }

  function EditAnchor(data, opts) {
    var doc = resolveDoc(opts)
    var btn = makeEl(doc, 'button', 'innfo-edit-anchor')
    btn.setAttribute('data-innfo-component', 'edit-anchor')
    btn.setAttribute('type', 'button')
    var label = (data && data.label) || 'Edit'
    btn.setAttribute('aria-label', label)
    btn.setAttribute('title', label)
    btn.innerHTML = icon('pencil', 13)
    return btn
  }

  var STATUSES = ['pending', 'applied', 'rejected', 'stale']
  function StatusBadge(data) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.StatusBadge: data required')
    if (STATUSES.indexOf(data.status) === -1) {
      throw new TypeError('InnfoUI.StatusBadge: unknown status "' + data.status + '"')
    }
    var doc = resolveDoc(null)
    var badge = makeEl(doc, 'span', 'innfo-status-badge')
    badge.setAttribute('data-innfo-component', 'status-badge')
    badge.setAttribute('data-status', String(data.status))
    var text = data.count != null ? String(data.count) : String(data.status)
    badge.textContent = text
    badge.setAttribute('aria-label', data.count != null ? data.count + ' ' + data.status : data.status)
    return badge
  }

  // Canonical citation-origin order + labels (moved out of the runtime).
  var CITATION_ORIGIN_LABELS = {
    agent: 'AI agent',
    human: 'Human author',
    reviewer: 'Reviewer feedback',
    document: 'Document',
    error: 'Unresolved citation',
  }

  function originVariantOf(entry) {
    if (entry && entry.error) return 'error'
    var o = entry && entry.origin
    return CITATION_ORIGIN_LABELS[o] ? o : 'document'
  }

  function CitationIcon(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.CitationIcon: data required')
    var doc = resolveDoc(opts)
    var variant = data.variant || 'document'
    var btn = makeEl(doc, 'button', 'cite-icon')
    btn.setAttribute('data-innfo-component', 'citation-icon')
    btn.setAttribute('type', 'button')
    btn.setAttribute('data-origin', String(variant))
    btn.setAttribute('data-field', String(data.field == null ? '' : data.field))
    var label = (CITATION_ORIGIN_LABELS[variant] || variant) + ': ' + (data.field == null ? '' : data.field)
    btn.setAttribute('aria-label', label)
    btn.setAttribute('title', label)
    btn.innerHTML = icon('cite-' + variant, 14)
    btn.addEventListener('click', function (ev) {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
      if (opts && typeof opts.onOpen === 'function') opts.onOpen(data)
    })
    return btn
  }

  function FieldRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.FieldRow: data required')
    var doc = resolveDoc(opts)
    var row = makeEl(doc, 'div', 'innfo-field-row')
    row.setAttribute('data-innfo-component', 'field-row')
    row.setAttribute('data-field', String(data.name == null ? '' : data.name))
    var dt = makeEl(doc, 'dt', null, data.name)
    var dd = makeEl(doc, 'dd')
    if (data.ref && data.ref.id) {
      dd.appendChild(
        ElementPill({ id: data.ref.id, label: data.ref.label || data.ref.id }, {
          onSelect: opts && opts.onRef ? function () { opts.onRef(data.ref.id) } : undefined,
        }),
      )
    } else {
      dd.appendChild(doc.createTextNode(String(data.value == null ? '' : data.value)))
    }
    if (Array.isArray(data.citations) && data.citations.length) {
      var seen = {}
      var variants = data.citations.map(originVariantOf)
      ;['error', 'agent', 'human', 'reviewer', 'document'].forEach(function (v) {
        if (seen[v]) return
        seen[v] = true
        if (variants.indexOf(v) === -1) return
        dd.appendChild(
          CitationIcon({ variant: v, field: data.name }, {
            onOpen: opts && opts.onCite ? opts.onCite : undefined,
          }),
        )
      })
    }
    row.appendChild(dt)
    row.appendChild(dd)
    return row
  }

  function ElementCard(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.ElementCard: data required')
    var doc = resolveDoc(opts)
    var card = makeEl(doc, 'article', 'innfo-card')
    card.setAttribute('data-innfo-component', 'element-card')
    card.setAttribute('data-element-id', String(data.id == null ? '' : data.id))
    if (data.conceptId) card.setAttribute('data-concept-id', String(data.conceptId))
    var open = !(opts && opts.open === false)
    card.setAttribute('data-open', open ? 'true' : 'false')
    if (opts && opts.domId) card.setAttribute('id', String(opts.domId))

    var head = makeEl(doc, 'header', 'innfo-card-head')
    head.appendChild(makeEl(doc, 'h3', 'innfo-card-name', data.name || data.id))
    if (Array.isArray(data.markers)) {
      data.markers.forEach(function (m) {
        if (m) head.appendChild(MarkerChip(m))
      })
    }
    if (data.qud && (data.qud.id || data.qud === true)) {
      var qudData = data.qud === true ? { id: data.id } : data.qud
      if (qudData && qudData.id == null) qudData.id = data.id
      head.appendChild(QudChip(qudData || { id: data.id }))
    }
    if (Array.isArray(opts && opts.head)) {
      ;(opts.head || []).forEach(function (n) {
        if (n) head.appendChild(n)
      })
    }
    if (opts && opts.collapsible) {
      var toggle = makeEl(doc, 'button', 'innfo-card-toggle')
      toggle.setAttribute('type', 'button')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      toggle.addEventListener('click', function () {
        open = !open
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        card.setAttribute('data-open', open ? 'true' : 'false')
      })
      head.appendChild(toggle)
    }
    card.appendChild(head)

    var body = makeEl(doc, 'section', 'innfo-card-body')
    if (data.description) body.appendChild(makeEl(doc, 'p', 'innfo-card-desc', data.description))
    var fields = Array.isArray(data.fields) ? data.fields : []
    if (fields.length) {
      var dl = makeEl(doc, 'dl', 'innfo-card-fields')
      fields.forEach(function (f) {
        if (f) dl.appendChild(FieldRow(f, { onRef: opts && opts.onRef, onCite: opts && opts.onCite }))
      })
      body.appendChild(dl)
    }
    if (Array.isArray(opts && opts.body)) {
      ;(opts.body || []).forEach(function (n) {
        if (n) body.appendChild(n)
      })
    }
    var tags = Array.isArray(data.tags) ? data.tags : null
    if (tags) body.appendChild(TagRow({ tags: tags }))
    var relations = Array.isArray(data.relations) ? data.relations : null
    if (relations) {
      body.appendChild(RelList({ relations: relations, byId: (opts && opts.byId) || {} }))
    }
    card.appendChild(body)
    if (data.path) card.appendChild(makeEl(doc, 'footer', 'innfo-card-path', data.path))
    return card
  }

  function DraftList(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.DraftList: data required')
    var doc = resolveDoc(opts)
    var drafts = Array.isArray(data.drafts) ? data.drafts : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'innfo-draft-list flex flex-col gap-3 list-none p-0 m-0')
    ul.setAttribute('data-innfo-component', 'draft-list')
    drafts.forEach(function (d) {
      if (!d || typeof d !== 'object') return
      var el = byId[String(d.element_id)]
      var changed = !el || el.hash !== d.base_hash
      var li = makeEl(doc, 'li', 'innfo-draft-row card bg-base-100 border border-base-200 shadow-xs')
      li.setAttribute('data-draft-id', String(d.id))
      if (changed) li.setAttribute('data-target-changed', 'true')

      var cardBody = makeEl(doc, 'div', 'card-body p-4 flex flex-row items-center justify-between gap-4')

      var left = makeEl(doc, 'div', 'flex items-center gap-3 flex-wrap')
      var badgeCls = d.kind === 'correction' ? 'badge badge-primary' : d.kind === 'comment' ? 'badge badge-neutral' : 'badge badge-ghost'
      var kindBadge = makeEl(doc, 'span', 'innfo-draft-kind ' + badgeCls, d.kind)
      left.appendChild(kindBadge)

      var targetLabel = el ? el.name || d.element_id : d.element || d.element_id
      var targetSpan = makeEl(
        doc,
        'span',
        'innfo-draft-target font-semibold text-sm',
        targetLabel + (d.field ? '.' + d.field : '')
      )
      left.appendChild(targetSpan)

      var text = d.comment != null ? d.comment : d.proposed != null ? d.proposed : ''
      var textSpan = makeEl(doc, 'span', 'innfo-draft-text text-sm opacity-80', text)
      left.appendChild(textSpan)
      cardBody.appendChild(left)

      var right = makeEl(doc, 'div', 'flex items-center gap-2 shrink-0')
      if (changed) {
        var warnBadge = makeEl(doc, 'span', 'innfo-draft-target-changed badge badge-error badge-sm', 'target changed')
        right.appendChild(warnBadge)
      }

      var del = makeEl(doc, 'button', 'innfo-draft-delete btn btn-sm btn-ghost text-error', 'Delete')
      del.setAttribute('type', 'button')
      if (typeof InnfoIcons !== 'undefined' && typeof InnfoIcons.getSvg === 'function') {
        del.innerHTML = InnfoIcons.getSvg('trash-2', { size: 14 }) + '<span>Delete</span>'
      }
      del.addEventListener('click', function () {
        if (opts && typeof opts.onDelete === 'function') opts.onDelete(d.id)
      })
      right.appendChild(del)
      cardBody.appendChild(right)

      li.appendChild(cardBody)
      ul.appendChild(li)
    })
    return ul
  }

  // ---- Core Edit Widgets (D13 / S3) ----

  function FieldInput(type, value, opts) {
    var doc = resolveDoc(opts)
    var input = makeEl(doc, 'input', 'innfo-edit-input')
    input.setAttribute('type', type)
    if (value != null) input.value = String(value)
    input.setAttribute('data-innfo-widget', type)
    return input
  }

  function FieldStringWidget(value, opts) {
    var inp = FieldInput('text', value, opts)
    inp.setAttribute('data-innfo-widget', 'string')
    return inp
  }

  function FieldNumberWidget(value, opts) {
    return FieldInput('number', value, opts)
  }

  function FieldBooleanWidget(value, opts) {
    var doc = resolveDoc(opts)
    var label = makeEl(doc, 'label', 'innfo-edit-checkbox-label')
    var input = makeEl(doc, 'input', 'innfo-edit-checkbox')
    input.setAttribute('type', 'checkbox')
    input.setAttribute('data-innfo-widget', 'boolean')
    input.checked = Boolean(value === true || value === 'true')
    label.appendChild(input)
    label.appendChild(doc.createTextNode(input.checked ? ' true' : ' false'))
    input.addEventListener('change', function () {
      label.lastChild.textContent = input.checked ? ' true' : ' false'
    })
    return label
  }

  function FieldSelectWidget(value, options, opts) {
    var doc = resolveDoc(opts)
    var select = makeEl(doc, 'select', 'innfo-edit-select')
    select.setAttribute('data-innfo-widget', 'select')
    var list = Array.isArray(options) ? options : []
    list.forEach(function (opt) {
      var op = makeEl(doc, 'option', null, opt)
      op.value = opt
      if (String(opt) === String(value)) op.selected = true
      select.appendChild(op)
    })
    return select
  }

  function FieldMultiSelectWidget(values, options, opts) {
    var doc = resolveDoc(opts)
    var wrap = makeEl(doc, 'div', 'innfo-edit-multiselect')
    wrap.setAttribute('data-innfo-widget', 'multiselect')
    var current = Array.isArray(values) ? values.map(String) : []
    var list = Array.isArray(options) ? options : []
    list.forEach(function (opt) {
      var label = makeEl(doc, 'label', 'innfo-edit-checkbox-label')
      var input = makeEl(doc, 'input')
      input.setAttribute('type', 'checkbox')
      input.value = opt
      if (current.indexOf(String(opt)) !== -1) input.checked = true
      label.appendChild(input)
      label.appendChild(doc.createTextNode(' ' + opt))
      wrap.appendChild(label)
    })
    return wrap
  }

  function FieldReferenceWidget(value, candidates, opts) {
    var doc = resolveDoc(opts)
    var wrap = makeEl(doc, 'div', 'innfo-edit-reference')
    wrap.setAttribute('data-innfo-widget', 'reference')
    var input = makeEl(doc, 'input', 'innfo-edit-input')
    input.setAttribute('type', 'text')
    input.setAttribute('placeholder', 'target-slug or [[slug]]')
    if (value != null) input.value = String(value)
    wrap.appendChild(input)

    var datalistId = 'innfo-ref-list-' + Math.random().toString(36).slice(2, 8)
    input.setAttribute('list', datalistId)
    var dl = makeEl(doc, 'datalist')
    dl.id = datalistId
    var list = Array.isArray(candidates) ? candidates : []
    list.forEach(function (c) {
      var op = makeEl(doc, 'option')
      var slugVal = typeof c === 'string' ? c : c.slug || c.id || c.name
      var labelVal = typeof c === 'string' ? c : (c.name ? c.name + ' (' + slugVal + ')' : slugVal)
      op.value = slugVal
      op.textContent = labelVal
      dl.appendChild(op)
    })
    wrap.appendChild(dl)
    return wrap
  }

  function FieldMarkdownWidget(value, opts) {
    var doc = resolveDoc(opts)
    var ta = makeEl(doc, 'textarea', 'innfo-edit-textarea')
    ta.setAttribute('data-innfo-widget', 'markdown')
    ta.setAttribute('rows', '6')
    if (value != null) ta.value = String(value)
    return ta
  }

  function EditModal(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.EditModal: data required')
    var doc = resolveDoc(opts)
    var modal = makeEl(doc, 'dialog', 'innfo-edit-modal')
    modal.setAttribute('data-innfo-component', 'edit-modal')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')

    var head = makeEl(doc, 'div', 'innfo-edit-modal-head')
    var title = makeEl(doc, 'h2', null, data.title || 'Edit Component')
    head.appendChild(title)
    var closeBtn = makeEl(doc, 'button', 'innfo-edit-modal-close', '\u00D7')
    closeBtn.setAttribute('type', 'button')
    closeBtn.addEventListener('click', function () {
      if (typeof modal.close === 'function') modal.close()
      else modal.removeAttribute('open')
      if (opts && typeof opts.onCancel === 'function') opts.onCancel()
    })
    head.appendChild(closeBtn)
    modal.appendChild(head)

    // Unified Modal Navigation: Tabs (Edit vs History & Provenance)
    var navTabs = makeEl(doc, 'div', 'innfo-modal-tabs')
    var tabBtnEdit = makeEl(doc, 'button', 'innfo-modal-tab-btn active', 'Edit')
    tabBtnEdit.setAttribute('type', 'button')
    var tabBtnHistory = makeEl(doc, 'button', 'innfo-modal-tab-btn', 'History & Provenance')
    tabBtnHistory.setAttribute('type', 'button')
    navTabs.appendChild(tabBtnEdit)
    navTabs.appendChild(tabBtnHistory)
    modal.appendChild(navTabs)

    // Panel 1: Edit Form
    var panelEdit = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-edit-modal-body')
    panelEdit.setAttribute('data-tab', 'edit')

    // Mode Selector: Propose Value vs Comment (D15)
    var modeWrap = makeEl(doc, 'div', 'innfo-edit-mode-selector')
    var isComment = Boolean(data.isComment)
    var btnPropose = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (!isComment ? ' active' : ''), 'Propose value')
    var btnComment = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (isComment ? ' active' : ''), 'Comment')
    btnPropose.setAttribute('type', 'button')
    btnComment.setAttribute('type', 'button')
    modeWrap.appendChild(btnPropose)
    modeWrap.appendChild(btnComment)
    panelEdit.appendChild(modeWrap)

    var formPropose = makeEl(doc, 'div', 'innfo-edit-form-propose')
    formPropose.style.display = isComment ? 'none' : 'block'

    var formComment = makeEl(doc, 'div', 'innfo-edit-form-comment')
    formComment.style.display = isComment ? 'block' : 'none'
    var commentLabel = makeEl(doc, 'label', 'innfo-edit-field-label', 'Reviewer Notes / Comment')
    var commentTa = makeEl(doc, 'textarea', 'innfo-edit-textarea')
    commentTa.setAttribute('placeholder', 'Enter review comment or note...')
    if (data.comment != null) commentTa.value = String(data.comment)
    formComment.appendChild(commentLabel)
    formComment.appendChild(commentTa)

    btnPropose.addEventListener('click', function () {
      isComment = false
      btnPropose.className = 'innfo-edit-mode-btn active'
      btnComment.className = 'innfo-edit-mode-btn'
      formPropose.style.display = 'block'
      formComment.style.display = 'none'
    })
    btnComment.addEventListener('click', function () {
      isComment = true
      btnComment.className = 'innfo-edit-mode-btn active'
      btnPropose.className = 'innfo-edit-mode-btn'
      formPropose.style.display = 'none'
      formComment.style.display = 'block'
    })

    // Field Editor in Propose mode
    var fieldsContainer = makeEl(doc, 'div', 'innfo-edit-fields')
    var widgetRef = null
    var fieldType = data.type || 'string'
    var fieldLabel = makeEl(doc, 'label', 'innfo-edit-field-label', data.fieldName ? data.fieldName : 'Value')
    fieldsContainer.appendChild(fieldLabel)

    if (fieldType === 'number') {
      widgetRef = FieldNumberWidget(data.value, opts)
    } else if (fieldType === 'boolean') {
      widgetRef = FieldBooleanWidget(data.value, opts)
    } else if (fieldType === 'select') {
      widgetRef = FieldSelectWidget(data.value, data.options, opts)
    } else if (fieldType === 'multiselect') {
      widgetRef = FieldMultiSelectWidget(data.value, data.options, opts)
    } else if (fieldType === 'reference') {
      widgetRef = FieldReferenceWidget(data.value, data.candidates, opts)
    } else if (fieldType === 'markdown' || fieldType === 'markdown_inline') {
      widgetRef = FieldMarkdownWidget(data.value, opts)
    } else {
      widgetRef = FieldStringWidget(data.value, opts)
    }
    fieldsContainer.appendChild(widgetRef)
    formPropose.appendChild(fieldsContainer)

    panelEdit.appendChild(formPropose)
    panelEdit.appendChild(formComment)
    modal.appendChild(panelEdit)

    // Panel 2: History & Provenance
    var panelHistory = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-history-modal-body')
    panelHistory.setAttribute('data-tab', 'history')
    panelHistory.style.display = 'none'

    // History section
    var histSection = makeEl(doc, 'div', 'innfo-history-section')
    histSection.appendChild(makeEl(doc, 'h3', 'innfo-history-title', 'Changeset Lineage & Revision History'))
    var historyItems = Array.isArray(data.history) ? data.history : []
    if (historyItems.length) {
      historyItems.forEach(function (h) {
        var item = makeEl(doc, 'div', 'innfo-history-item')
        var metaStr = (h.author ? 'Author: ' + h.author : '') + (h.timestamp ? ' \u2022 ' + h.timestamp : '')
        item.appendChild(makeEl(doc, 'div', 'innfo-history-meta', metaStr))
        if (h.notes) item.appendChild(makeEl(doc, 'div', 'innfo-history-notes', h.notes))
        histSection.appendChild(item)
      })
    } else {
      histSection.appendChild(makeEl(doc, 'div', 'innfo-history-empty', 'No recorded prior changesets.'))
    }
    panelHistory.appendChild(histSection)

    // Provenance & Citations section
    var citeSection = makeEl(doc, 'div', 'innfo-history-section')
    citeSection.appendChild(makeEl(doc, 'h3', 'innfo-history-title', 'Source Provenance & Citations'))
    var citeItems = Array.isArray(data.citations) ? data.citations : []
    if (citeItems.length) {
      citeItems.forEach(function (c) {
        var item = makeEl(doc, 'div', 'innfo-history-item')
        var srcStr = (c.origin ? '[' + c.origin + '] ' : '') + (c.source || '')
        item.appendChild(makeEl(doc, 'div', 'innfo-history-meta', srcStr))
        if (c.quote) item.appendChild(makeEl(doc, 'div', 'innfo-history-notes', '"' + c.quote + '"'))
        citeSection.appendChild(item)
      })
    } else {
      citeSection.appendChild(makeEl(doc, 'div', 'innfo-history-empty', 'No origin citations linked.'))
    }
    panelHistory.appendChild(citeSection)
    modal.appendChild(panelHistory)

    // Tab switcher events
    tabBtnEdit.addEventListener('click', function () {
      tabBtnEdit.className = 'innfo-modal-tab-btn active'
      tabBtnHistory.className = 'innfo-modal-tab-btn'
      panelEdit.style.display = 'block'
      panelHistory.style.display = 'none'
    })
    tabBtnHistory.addEventListener('click', function () {
      tabBtnHistory.className = 'innfo-modal-tab-btn active'
      tabBtnEdit.className = 'innfo-modal-tab-btn'
      panelEdit.style.display = 'none'
      panelHistory.style.display = 'block'
    })

    var actions = makeEl(doc, 'div', 'innfo-edit-modal-actions')
    var saveBtn = makeEl(doc, 'button', 'innfo-edit-btn innfo-edit-btn-save', 'Save draft')
    saveBtn.setAttribute('type', 'button')
    saveBtn.addEventListener('click', function () {
      var result = {
        isComment: isComment,
        comment: commentTa.value,
      }
      if (!isComment) {
        if (fieldType === 'boolean') {
          var cb = widgetRef.querySelector('input[type="checkbox"]')
          result.proposed = cb ? cb.checked : false
        } else if (fieldType === 'multiselect') {
          var checkedBoxes = widgetRef.querySelectorAll('input[type="checkbox"]:checked')
          result.proposed = Array.prototype.map.call(checkedBoxes, function (b) { return b.value })
        } else if (fieldType === 'reference') {
          var refInp = widgetRef.querySelector('input')
          result.proposed = refInp ? refInp.value : ''
        } else {
          result.proposed = widgetRef.value
        }
      }
      if (opts && typeof opts.onSave === 'function') opts.onSave(result)
      if (typeof modal.close === 'function') modal.close()
      else modal.removeAttribute('open')
    })
    var cancelBtn = makeEl(doc, 'button', 'innfo-edit-btn innfo-edit-btn-cancel', 'Cancel')
    cancelBtn.setAttribute('type', 'button')
    cancelBtn.addEventListener('click', function () {
      if (typeof modal.close === 'function') modal.close()
      else modal.removeAttribute('open')
      if (opts && typeof opts.onCancel === 'function') opts.onCancel()
    })
    actions.appendChild(saveBtn)
    actions.appendChild(cancelBtn)
    modal.appendChild(actions)

    return modal
  }

  function AnnotationPopover(data, opts) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.AnnotationPopover: data required')
    }
    var doc = resolveDoc(opts)
    var kinds = Array.isArray(data.kinds) && data.kinds.length ? data.kinds : ['comment']
    var hasCorrection = kinds.indexOf('correction') !== -1
    var pop = makeEl(doc, 'div', 'innfo-annotation-popover')
    pop.setAttribute('data-innfo-component', 'annotation-popover')
    pop.setAttribute('role', 'dialog')
    pop.setAttribute('aria-modal', 'true')
    pop.setAttribute('tabindex', '-1')
    pop.appendChild(makeEl(doc, 'p', 'innfo-popover-label', data.label))
    kinds.forEach(function (k) {
      var b = makeEl(doc, 'button', 'innfo-popover-kind', k)
      b.setAttribute('type', 'button')
      b.setAttribute('data-kind', k)
      pop.appendChild(b)
    })
    if (hasCorrection) {
      if (data.original != null) {
        pop.appendChild(makeEl(doc, 'span', 'innfo-popover-original', String(data.original)))
      }
      pop.appendChild(makeEl(doc, 'textarea', 'innfo-popover-proposed'))
    }
    var save = makeEl(doc, 'button', 'innfo-popover-save', 'Save')
    save.setAttribute('type', 'button')
    save.addEventListener('click', function () {
      var payload = { kind: hasCorrection ? 'correction' : kinds[0] }
      if (hasCorrection) {
        var ta = pop.querySelector('textarea')
        payload.proposed = ta ? ta.value : ''
      }
      if (opts && typeof opts.onSave === 'function') opts.onSave(payload)
    })
    var cancel = makeEl(doc, 'button', 'innfo-popover-cancel', 'Cancel')
    cancel.setAttribute('type', 'button')
    cancel.addEventListener('click', function () {
      if (opts && typeof opts.onCancel === 'function') opts.onCancel()
    })
    pop.appendChild(save)
    pop.appendChild(cancel)
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (typeof e.preventDefault === 'function') e.preventDefault()
        if (opts && typeof opts.onCancel === 'function') opts.onCancel()
        return
      }
      if (e.key === 'Tab') {
        var f = pop.querySelectorAll('button, textarea, input, [tabindex]')
        if (!f.length) return
        var first = f[0]
        var last = f[f.length - 1]
        if (e.shiftKey && doc.activeElement === first) {
          if (typeof e.preventDefault === 'function') e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && doc.activeElement === last) {
          if (typeof e.preventDefault === 'function') e.preventDefault()
          first.focus()
        }
      }
    })
    return pop
  }


  var REVIEW_STATES = ['none', 'reviewed', 'changed']

  function ReviewedToggle(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.ReviewedToggle: data required')
    }
    var state = REVIEW_STATES.indexOf(data.state) !== -1 ? data.state : 'none'
    var doc = resolveDoc(null)
    var b = makeEl(doc, 'button', 'innfo-reviewed-toggle', state)
    b.setAttribute('data-innfo-component', 'reviewed-toggle')
    b.setAttribute('type', 'button')
    b.setAttribute('data-state', String(state))
    b.setAttribute('aria-pressed', state === 'reviewed' ? 'true' : 'false')
    return b
  }

  function RailProgress(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.RailProgress: data required')
    }
    var reviewed = Number(data.reviewed)
    var total = Number(data.total)
    var pending = Number(data.pending)
    if (!isFinite(reviewed) || !isFinite(total) || !isFinite(pending)) {
      throw new TypeError('InnfoUI.RailProgress: numeric reviewed, total and pending required')
    }
    var doc = resolveDoc(null)
    var span = makeEl(doc, 'span', 'innfo-rail-progress')
    span.setAttribute('data-innfo-component', 'rail-progress')
    span.setAttribute('data-reviewed', String(reviewed))
    span.setAttribute('data-total', String(total))
    span.setAttribute('data-pending', String(pending))
    span.appendChild(doc.createTextNode(reviewed + '/' + total))
    span.appendChild(makeEl(doc, 'span', 'innfo-rail-progress-pending', String(pending)))
    return span
  }

  // Token injection at load when a document exists. The bundle loads up to 3
  // times per shell; ensureTokens is idempotent, so this is safe.
  if (typeof document !== 'undefined' && document.head) {
    try {
      ensureTokens(document)
    } catch {
      /* ignore */
    }
  }

  // D3: the innfo:theme-change listener lives here (killed the runtime's
  // class-toggling version). Uses setTheme -> html[data-theme].
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.type === 'innfo:theme-change') {
        setTheme(document, e.data.theme === 'dark' ? 'dark' : 'light')
      }
    })
  }

  return {
    VERSION: UI_VERSION,
    TOKEN_VALUES: TOKEN_VALUES,
    TOKENS: TOKENS,
    generateTokenCss: generateTokenCss,
    ensureTokens: ensureTokens,
    setTheme: setTheme,
    icon: icon,
    slug: slug,
    conceptSlot: conceptSlot,
    ORIGIN_VARIANTS: ['error', 'agent', 'human', 'reviewer', 'document'],
    ConceptPill: ConceptPill,
    ElementPill: ElementPill,
    MarkerChip: MarkerChip,
    QudChip: QudChip,
    TagRow: TagRow,
    RelList: RelList,
    EditToggle: EditToggle,
    EditAnchor: EditAnchor,
    StatusBadge: StatusBadge,
    CitationIcon: CitationIcon,
    FieldRow: FieldRow,
    ElementCard: ElementCard,
    CITATION_ORIGIN_LABELS: CITATION_ORIGIN_LABELS,
    DraftList: DraftList,
    AnnotationPopover: AnnotationPopover,
    ReviewedToggle: ReviewedToggle,
    RailProgress: RailProgress,
    EditModal: EditModal,
    FieldStringWidget: FieldStringWidget,
    FieldNumberWidget: FieldNumberWidget,
    FieldBooleanWidget: FieldBooleanWidget,
    FieldSelectWidget: FieldSelectWidget,
    FieldMultiSelectWidget: FieldMultiSelectWidget,
    FieldReferenceWidget: FieldReferenceWidget,
    FieldMarkdownWidget: FieldMarkdownWidget,
  }
})
