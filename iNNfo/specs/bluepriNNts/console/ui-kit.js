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
    '.innfo-review-anchor{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.75rem;padding:.05em .4em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em}',
    '.innfo-review-anchor:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px}',
    '.innfo-reviewed-toggle{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.72rem;padding:.1em .5em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em}',
    '.innfo-reviewed-toggle[data-state=reviewed]{color:var(--innfo-status-applied);background:var(--innfo-status-applied-bg)}',
    '.innfo-reviewed-toggle[data-state=changed]{color:var(--innfo-status-stale);background:var(--innfo-status-stale-bg)}',
    '.innfo-review-badges{display:inline-flex;gap:.3em;align-items:center;margin-left:.4em}',
    'html[data-innfo-filter=changed] [data-innfo-component=element-card]:not([data-innfo-changed]){display:none}',
    '.innfo-popover-comment,.innfo-popover-proposed{display:block;width:100%;font:inherit;box-sizing:border-box}',
    '@media (max-width:640px){.innfo-annotation-popover{width:100%}.innfo-review-toggle,.innfo-changed-filter{width:100%}}',
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
    if (!body) throw new TypeError('InnfoUI.icon: unknown icon "' + name + '"')
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
    card.appendChild(body)
    return card
  }

  function DraftList(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.DraftList: data required')
    var doc = resolveDoc(opts)
    var drafts = Array.isArray(data.drafts) ? data.drafts : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'innfo-draft-list')
    ul.setAttribute('data-innfo-component', 'draft-list')
    drafts.forEach(function (d) {
      if (!d || typeof d !== 'object') return
      var el = byId[String(d.element_id)]
      var changed = !el || el.hash !== d.base_hash
      var li = makeEl(doc, 'li', 'innfo-draft-row')
      li.setAttribute('data-draft-id', String(d.id))
      if (changed) li.setAttribute('data-target-changed', 'true')
      li.appendChild(makeEl(doc, 'span', 'innfo-draft-kind', d.kind))
      var targetLabel = el ? el.name || d.element_id : d.element || d.element_id
      li.appendChild(
        makeEl(doc, 'span', 'innfo-draft-target', targetLabel + (d.field ? '.' + d.field : '')),
      )
      var text = d.comment != null ? d.comment : d.proposed != null ? d.proposed : ''
      li.appendChild(makeEl(doc, 'span', 'innfo-draft-text', text))
      if (changed) li.appendChild(makeEl(doc, 'span', 'innfo-draft-target-changed', 'target changed'))
      var del = makeEl(doc, 'button', 'innfo-draft-delete', 'Delete')
      del.setAttribute('type', 'button')
      del.addEventListener('click', function () {
        if (opts && typeof opts.onDelete === 'function') opts.onDelete(d.id)
      })
      li.appendChild(del)
      ul.appendChild(li)
    })
    return ul
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
    StatusBadge: StatusBadge,
    CitationIcon: CitationIcon,
    FieldRow: FieldRow,
    ElementCard: ElementCard,
    CITATION_ORIGIN_LABELS: CITATION_ORIGIN_LABELS,
    DraftList: DraftList,
    AnnotationPopover: AnnotationPopover,
    ReviewedToggle: ReviewedToggle,
    RailProgress: RailProgress,
  }
})
