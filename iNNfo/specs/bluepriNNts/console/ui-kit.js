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
      // nn-shad-cn monochrome neutral preset: near-black #171717 primary on a
      // crisp white/zinc canvas, neutral #e5e5e5 borders, ink #0a0a0a / muted #666666.
      // Concept colors stay app-driven data; only brand + neutrals live here.
      '--innfo-bg': '#fafafa',
      '--innfo-surface': '#ffffff',
      '--innfo-surface-2': '#f4f4f5',
      '--innfo-text': '#0a0a0a',
      '--innfo-muted': '#666666',
      '--innfo-border': '#e5e5e5',
      '--innfo-accent': '#171717',
      '--innfo-link': '#171717',
      '--innfo-focus': '#52525b',
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
      '--innfo-concept-1-bg': '#eff6ff',
      '--innfo-concept-2-bg': '#f5f3ff',
      '--innfo-concept-3-bg': '#f0fdfa',
      '--innfo-concept-4-bg': '#fffbeb',
      '--innfo-concept-5-bg': '#fdf2f8',
      '--innfo-concept-6-bg': '#f0fdf4',
      '--innfo-concept-7-bg': '#fff7ed',
      '--innfo-concept-8-bg': '#eef2ff',
      '--innfo-concept-9-bg': '#fef2f2',
      '--innfo-concept-10-bg': '#fefce8',
      '--innfo-concept-11-bg': '#faf5ff',
      '--innfo-concept-12-bg': '#f9fafb',
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
      '--innfo-fs-hero': '1.5rem',
      '--innfo-fs-title': '1.25rem',
      '--innfo-fs-body': '0.9375rem',
      '--innfo-fs-caption': '0.8125rem',
      '--innfo-fs-min': '0.75rem',
      '--innfo-font':
        "Plus Jakarta Sans, Geist Sans, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      '--innfo-mono': "Geist Mono, 'JetBrains Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
      '--innfo-shadow': '0 1px 2px rgba(0, 0, 0, .06)',
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
    '.innfo-reviewed-toggle{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.75rem;padding:.1em .5em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em}',
    '.innfo-reviewed-toggle[data-state=reviewed]{color:var(--innfo-status-applied);background:var(--innfo-status-applied-bg)}',
    '.innfo-reviewed-toggle[data-state=changed]{color:var(--innfo-status-stale);background:var(--innfo-status-stale-bg)}',
    '.innfo-review-badges{display:inline-flex;gap:.3em;align-items:center;margin-left:.4em}',
    'html[data-innfo-filter=changed] [data-innfo-component=element-card]:not([data-innfo-changed]){display:none}',
    '.innfo-popover-comment,.innfo-popover-proposed{display:block;width:100%;font:inherit;box-sizing:border-box}',
    '@media (max-width:640px){.innfo-annotation-popover{width:100%}.innfo-review-toggle,.innfo-changed-filter{width:100%}}',
    '.innfo-edit-modal{border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-lg);padding:0;max-width:760px;width:100%;max-height:86vh;overflow:auto;background:var(--innfo-surface);color:var(--innfo-text);box-shadow:0 12px 40px rgba(0,0,0,.15)}',
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
    '.innfo-qud{display:inline-flex;align-items:center;gap:.35em;font-family:var(--innfo-mono);font-size:.75rem;color:var(--innfo-muted);background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);padding:.15em .3em .15em .6em;max-width:100%;min-width:0}',
    // The KU-detail chip holds a long mono id; the wrapper must be able to
    // shrink below its content so a long id never widens the page on narrow
    // viewports (only .innfo-qud-id itself truncates with an ellipsis).
    '.innfo-qud-wrap{display:inline-flex;min-width:0;max-width:100%}',
    '.innfo-qud-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
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
    '@media (max-width:640px){.innfo-edit-anchor,.innfo-edit-toggle,.innfo-qud-btn,.innfo-rel-act{min-width:32px;min-height:32px}.innfo-qud{font-size:.75rem}}',
    // Knowledge-unit badge family (KuBadge) + action cluster + change pip.
    '.innfo-ku-unit{display:inline-flex;align-items:center;gap:.25em;max-width:100%}',
    '.innfo-card-fields>.innfo-ku-unit,.innfo-card-fields>.innfo-ku-badge{flex:1 1 16rem;min-width:0}',
    '.innfo-card-fields>.innfo-ku-badge[data-field-wide=true],.innfo-card-fields>.innfo-ku-unit:has([data-field-wide=true]){flex-basis:100%}',
    '.innfo-ku-badge{position:relative;display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);padding:.1em .5em;background:var(--innfo-surface);color:var(--innfo-text);max-width:100%}',
    '.innfo-ku-badge[data-ku-kind=field],.innfo-ku-badge[data-ku-kind=cell]{background:var(--innfo-surface-2)}',
    // Element + concept/document badges read as card titles: slightly larger and
    // semibold so they anchor the hierarchy above their muted field rows.
    '.innfo-ku-badge[data-ku-kind=element],.innfo-ku-badge[data-ku-kind=concept],.innfo-ku-badge[data-ku-kind=document]{font-weight:600}',
    '.innfo-ku-badge[data-ku-kind=element]{font-size:.9rem}',
    '.innfo-ku-badge .innfo-ku-label{color:var(--innfo-muted)}',
    '.innfo-ku-badge .innfo-ku-value{color:var(--innfo-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.innfo-ku-badge .innfo-ku-icon{display:inline-flex;color:var(--innfo-muted);flex:0 0 auto}',
    // Field badges carry free text, so they read as full-width rows: the value
    // wraps and is never clipped, and the badge grows to fill the line while the
    // action cluster stays pinned beside it.
    '.innfo-ku-badge[data-ku-kind=field]{flex:1 1 16em;min-width:0;align-items:flex-start;font-size:.92rem;line-height:1.5;padding:.4em .6em;gap:.45em}',
    '.innfo-ku-badge[data-ku-kind=field] .innfo-ku-label{flex:0 0 auto;white-space:nowrap;font-weight:600}',
    '.innfo-ku-badge[data-ku-kind=field] .innfo-ku-value{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;text-align:left}',
    '.innfo-ku-badge[data-ku-kind=field] .innfo-ku-icon{margin-top:.18em}',
    '.innfo-ku-badge[data-ku-changes]{border-style:dashed}',
    '.innfo-ku-change-pip{position:absolute;top:-.5em;right:-.5em;min-width:1.2em;height:1.2em;padding:0 .25em;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;line-height:1;border-radius:999px;background:var(--innfo-status-pending-bg);color:var(--innfo-status-pending);border:1px solid var(--innfo-status-pending);cursor:pointer}',
    '.innfo-ku-actions{display:inline-flex;align-items:center;gap:.1em;flex:0 0 auto}',
    '.innfo-ku-action{appearance:none;border:1px solid transparent;background:transparent;color:var(--innfo-muted);font:inherit;padding:.1em .3em;border-radius:var(--innfo-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;min-height:1.5em;opacity:.55;transition:opacity .15s ease,color .15s ease,border-color .15s ease}',
    '.innfo-ku-unit:hover .innfo-ku-action,.innfo-ku-action:focus-visible{opacity:1}',
    '.innfo-ku-action:hover{color:var(--innfo-text);border-color:var(--innfo-border);background:var(--innfo-surface)}',
    '.innfo-ku-action[data-ku-action=edit]:hover{color:var(--innfo-link)}',
    '.innfo-ku-action:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px}',
    '.innfo-card-fields{display:flex;flex-direction:column;gap:.45em;align-items:stretch;margin:.6em 0 0}',
    '.innfo-card-desc-actions{margin-left:.4em}',
    // Element-card Dense Row (V01): a one-line bar (image chip, name, concept,
    // markers, field count, actions, chevron) over a collapsible body.
    // Scoped to the element-card so it wins over any shell-level card styles.
    '[data-innfo-component=element-card] .innfo-card-head{display:flex;align-items:center;gap:.5em;flex-wrap:wrap;cursor:pointer;min-width:0}',
    '[data-innfo-component=element-card] .innfo-card-thumb{width:40px;height:40px;border-radius:7px;object-fit:cover;border:1.5px solid var(--innfo-border);background:var(--innfo-surface-2);flex:0 0 auto;display:block}',
    '.innfo-field-image-wrap{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '[data-innfo-component=element-card] .innfo-card-thumb--empty,[data-innfo-component=element-card] .innfo-card-thumb--concept{display:inline-flex;align-items:center;justify-content:center;color:var(--card-concept-color,var(--innfo-accent));background:var(--card-concept-bg,var(--innfo-surface-2));border:1.5px solid var(--card-concept-color,var(--innfo-border))}',
    '[data-innfo-component=element-card] .innfo-card-count{font-size:.75rem;font-weight:600;color:var(--innfo-muted);background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:999px;padding:1px 8px;white-space:nowrap;flex:0 0 auto}',
    '[data-innfo-component=element-card] .innfo-card-toggle{appearance:none;border:1px solid transparent;background:transparent;color:var(--innfo-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:.15em;border-radius:var(--innfo-radius-sm);flex:0 0 auto}',
    '[data-innfo-component=element-card] .innfo-card-toggle:hover{color:var(--innfo-text);border-color:var(--innfo-border);background:var(--innfo-surface)}',
    '[data-innfo-component=element-card] .innfo-card-toggle .innfo-icon{transition:transform .15s ease}',
    '[data-innfo-component=element-card][data-open=true] .innfo-card-toggle .innfo-icon{transform:rotate(180deg)}',
    '[data-innfo-component=element-card][data-open=false] .innfo-card-body{display:none}',
    '[data-innfo-component=element-card][data-open=false] .innfo-card-path{display:none}',
    '[data-innfo-component=element-card][data-open=true] .innfo-card-collapsed-strip{display:none!important}',
    '[data-innfo-component=element-card][data-open=true] .innfo-card-summary-preview{display:none}',
    '[data-innfo-component=element-card] .innfo-card-summary-preview{font-size:.82rem;color:var(--innfo-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:34ch;margin-left:.25em}',
    '[data-innfo-component=element-card] .innfo-card-status-pill{display:inline-flex;align-items:center;gap:.28em;font-size:.72rem;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--innfo-status-applied-bg);color:var(--innfo-status-applied);border:1px solid rgba(22,101,52,.22);white-space:nowrap}',
    '[data-innfo-component=element-card] .innfo-card-status-pill[data-status=draft],[data-innfo-component=element-card] .innfo-card-status-pill[data-status=pending]{background:var(--innfo-status-pending-bg);color:var(--innfo-status-pending);border-color:rgba(180,83,9,.22)}',
    '[data-innfo-component=element-card] .innfo-card-collapsed-strip{display:flex;align-items:center;justify-content:space-between;gap:.65em;padding:7px 12px;margin:8px -12px -10px -12px;background:var(--innfo-surface-2);border-top:1px solid var(--innfo-border);border-radius:0 0 var(--innfo-radius) var(--innfo-radius);flex-wrap:wrap}',
    '.innfo-collapsed-strip-left,.innfo-collapsed-strip-right{display:inline-flex;align-items:center;gap:.4em;flex-wrap:wrap;min-width:0}',
    '.innfo-strip-group{display:inline-flex;align-items:center;gap:.35em;flex-wrap:wrap}',
    '.innfo-strip-key{font-family:var(--innfo-mono);font-size:.73rem;font-weight:600;color:var(--innfo-muted);margin-right:.15em}',
    '.innfo-obj-chips{display:inline-flex;align-items:center;gap:.35em;flex-wrap:wrap}',
    '.innfo-obj-chip{display:inline-flex;align-items:center;border:1px solid var(--innfo-border);border-radius:5px;overflow:hidden;font-family:var(--innfo-mono);font-size:.73rem;line-height:1.25;background:var(--innfo-surface)}',
    '.innfo-obj-chip-k{padding:2px 6px;background:var(--innfo-surface-2);color:var(--innfo-muted);border-right:1px solid var(--innfo-border);font-weight:500}',
    '.innfo-obj-chip-v{padding:2px 6px;color:var(--innfo-text);font-weight:600}',
    '.innfo-obj-chip-v[data-bool=true]{color:var(--innfo-status-applied)}',
    '.innfo-strip-rel{display:inline-flex;align-items:center;gap:.25em;font-size:.75rem;font-weight:600;color:var(--innfo-accent);background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:6px;padding:2px 8px;text-decoration:none;white-space:nowrap}',
    '.innfo-strip-rel:hover{border-color:var(--innfo-accent);background:var(--innfo-surface-2)}',
    '.innfo-file-pill{display:inline-flex;align-items:center;gap:.35em;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:6px;padding:2px 8px;font-family:var(--innfo-mono);font-size:.76rem;color:var(--innfo-text)}',
    '.innfo-file-pill-icon{display:inline-flex;color:var(--innfo-accent)}',
    '.innfo-file-pill-path{font-family:inherit;font-size:inherit;background:transparent;padding:0;border:none}',
    '.innfo-card-meta-strip{display:flex;align-items:center;justify-content:space-between;gap:.5em;flex-wrap:wrap;padding:6px 10px;margin:.55em 0;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:6px}',
    '.innfo-lineage-pill{display:inline-flex;align-items:center;gap:.3em;font-family:var(--innfo-mono);font-size:.73rem;color:var(--innfo-muted);background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:5px;padding:2px 7px}',
    '[data-innfo-component=element-card] .innfo-card-fields{display:flex;flex-direction:column;gap:0;align-items:stretch;margin:.6em 0 0;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);overflow:hidden;background:var(--innfo-surface)}',
  ]
  for (var slot = 1; slot <= 12; slot++) {
    COMPONENT_CSS.push(
      '[data-concept-slot="' + slot + '"] .innfo-concept-dot{background:var(--innfo-concept-' + slot + ')}',
    )
  }
  for (var kslot = 1; kslot <= 12; kslot++) {
    COMPONENT_CSS.push(
      '[data-innfo-component=element-card][data-concept-slot="' + kslot + '"]{--card-concept-color:var(--innfo-concept-' + kslot + ');--card-concept-bg:var(--innfo-concept-' + kslot + '-bg);border-left:4px solid var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=element]{border-color:var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=element] .innfo-ku-icon{color:var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=reference]{border-color:var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=reference] .innfo-ku-icon{color:var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=concept],[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=document]{border-color:var(--innfo-concept-' + kslot + ');background:var(--innfo-concept-' + kslot + '-bg)}',
      '[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=concept] .innfo-ku-icon,[data-innfo-component=ku-badge][data-concept-slot="' + kslot + '"][data-ku-kind=document] .innfo-ku-icon{color:var(--innfo-concept-' + kslot + ')}',
    )
  }
  var COMPONENT_CSS_TEXT = COMPONENT_CSS.join('\n')

  // Light-only theme: pins color-scheme: light and never switches on OS dark mode.
  function generateTokenCss(values) {
    var v = values || TOKEN_VALUES
    var light = v.light || v
    return (
      ':root, [data-theme=light] {\n' +
      '  color-scheme: light;\n' +
      declBlock(light) +
      '\n}\n' +
      COMPONENT_CSS_TEXT +
      '\n'
    )
  }

  var TOKENS_ATTR = 'data-innfo-tokens'

  function ensureTokens(doc) {
    var d = doc || (typeof document !== 'undefined' ? document : null)
    if (!d || !d.head) throw new Error('InnfoUI.ensureTokens: no document')
    if (d.documentElement && !d.documentElement.getAttribute('data-theme')) {
      d.documentElement.setAttribute('data-theme', 'light')
    }
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
    if (theme !== 'light' && theme !== null) {
      throw new TypeError('InnfoUI.setTheme: expected light|null')
    }
    if (theme === null) d.documentElement.removeAttribute('data-theme')
    else d.documentElement.setAttribute('data-theme', 'light')
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
    chevron: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline>',
    image: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>',
    sliders: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>',
    'message-square': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    'git-commit': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="1.05" y1="12" x2="7" y2="12"></line><line x1="17.01" y1="12" x2="22.96" y2="12"></line>',
    check: ' fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline>',
    'arrow-up-right': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>',
    box: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>',
    boxes: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"></path><path d="m7 16.5-4.74-2.85"></path><path d="m7 16.5 5-3"></path><path d="M7 16.5v5.17"></path><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"></path><path d="m17 16.5-5-3"></path><path d="m17 16.5 4.74-2.85"></path><path d="M17 16.5v5.17"></path><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"></path><path d="M12 8 7.26 5.15"></path><path d="m12 8 4.74-2.85"></path><path d="M12 13.5V8"></path>',
    layers: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"></path><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"></path><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"></path>',
    'flask-conical': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path><path d="M8.5 2h7"></path><path d="M7 16h10"></path>',
    cpu: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"></rect><rect width="6" height="6" x="9" y="9" rx="1"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path>',
    shield: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path>',
    wrench: ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
    'git-branch': ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path>',
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
    var slot = conceptSlot(data)
    var pill = makeEl(doc, interactive ? 'button' : 'span', 'innfo-concept-pill')
    pill.setAttribute('data-innfo-component', 'concept-pill')
    pill.setAttribute('data-concept-id', String(data.id == null ? '' : data.id))
    pill.setAttribute('data-concept-slot', String(slot))
    if (interactive) {
      pill.setAttribute('type', 'button')
      pill.addEventListener('click', function () {
        opts.onSelect(data)
      })
    }
    var cIcon = makeEl(doc, 'span', 'innfo-concept-pill-icon')
    cIcon.setAttribute('aria-hidden', 'true')
    cIcon.innerHTML = icon(resolveConceptIconName(data.label || data.id, { index: slot - 1, color: data.color, icon: data.icon }), 12)
    pill.appendChild(cIcon)
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
    var hasConceptMeta = !!(data.concept || data.color || data.index != null || data.slot != null || data.hexColor)
    if (hasConceptMeta) {
      var eSlot = Number(data.slot) || conceptSlot({ index: data.index, color: data.color })
      pill.setAttribute('data-concept-slot', String(eSlot))
      pill.classList.add('innfo-element-pill--concept')
      if (data.hexColor) pill.style.setProperty('--pill-concept-color', String(data.hexColor))
      var eIcon = makeEl(doc, 'span', 'innfo-element-concept-icon')
      eIcon.setAttribute('aria-hidden', 'true')
      eIcon.innerHTML = icon(resolveConceptIconName(data.concept, { index: eSlot - 1, color: data.color, icon: data.icon }), 12)
      pill.appendChild(eIcon)
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
      var relFieldChip = makeEl(doc, 'span', 'innfo-rel-field innfo-ku-field-chip', (r.field || 'related') + ' \u2192')
      li.appendChild(relFieldChip)
      var targetRec = r.target && byId[r.target] ? byId[r.target] : null
      var label = r.targetLabel || (targetRec && targetRec.name) || r.target || '?'
      if (r.target) {
        li.appendChild(
          ElementPill(
            {
              id: r.target,
              label: label,
              concept: r.targetConcept || (targetRec && targetRec.concept),
              color: r.targetColor || (targetRec && targetRec._conceptColor),
              hexColor: r.targetHexColor || (targetRec && targetRec._conceptHexColor),
              slot: r.targetSlot || (targetRec && targetRec._conceptSlot),
              index: targetRec && targetRec._conceptIndex,
            },
            { href: '#el-' + r.target, doc: doc },
          ),
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
    btn.innerHTML = icon('sliders', 14)
    return btn
  }

  function EditAnchor(data, opts) {
    var doc = resolveDoc(opts)
    var btn = makeEl(doc, 'button', 'innfo-edit-anchor')
    btn.setAttribute('data-innfo-component', 'edit-anchor')
    btn.setAttribute('type', 'button')
    var label = (data && data.label) || 'Edit'
    var iconName = (data && data.icon) || 'pencil'
    btn.setAttribute('aria-label', label)
    btn.setAttribute('title', label)
    btn.innerHTML = icon(iconName, 13)
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

  function normalizeAssetPath(v) {
    if (typeof v !== 'string') return ''
    var s = v.replace(/\\/g, '/')
    if (/^(data:|blob:|https?:|file:)/i.test(s)) return v
    // Already rebased to the rendered console location by export-console.mjs
    // (rebaseModelAssets); leave it alone or the prefix is stripped and the
    // stamped console 404s.
    if (/^\.{1,2}\//.test(s)) return s
    var m = s.match(/^.+?\/((?:sources|kNNowledge|assets|evidence)\/.+)$/)
    return m ? m[1] : v
  }

  // Type-aware read rendering for a field value. Returns a DOM node, or null
  // when the value should fall back to the plain KuBadge text (string, empty
  // select, etc.), so existing output is unchanged for the common case.
  //
  // FIELD_RENDERERS is keyed by the declared field type — the L1 set
  // (iNNfo_V_0-4-0 §Field Definition: string, select, reference, markdown_inline,
  // markdown_file, image, file, video, audio, url, knowledge, citation) plus the
  // legacy aliases older payloads still emit. reference/citation have no entry:
  // FieldRow resolves them to ElementPill / CitationIcon from data.ref and
  // data.citations. Value-shape renderers (boolean / list / object / url) and
  // shape heuristics (image / asset path) run regardless of the declared type,
  // matching the console's runtime-detected payloads.
  var FIELD_RENDERERS = {
    boolean: renderFieldBoolean,
    select: renderFieldSelect,
    markdown: renderFieldMarkdown,
    markdown_inline: renderFieldMarkdown,
    markdown_file: renderFieldFile,
    image: renderFieldImage,
    image_url: renderFieldImage,
    asset: renderFieldImage,
    file: renderFieldFile,
    video: renderFieldMedia,
    audio: renderFieldMedia,
    url: renderFieldUrl,
    code: renderFieldCode,
    knowledge: renderFieldFile,
  }

  function renderFieldBoolean(d, doc) {
    var b = makeEl(doc, 'span', 'innfo-field-bool', d.value ? 'Yes' : 'No')
    b.setAttribute('data-value', d.value ? 'true' : 'false')
    return b
  }

  function renderFieldSelect(d, doc) {
    var v = d.value == null ? '' : String(d.value)
    if (!v.trim()) return null
    var pill = makeEl(doc, 'span', 'innfo-field-select', v)
    pill.setAttribute('data-value', v)
    return pill
  }

  function renderFieldUrl(d, doc) {
    var a = makeEl(doc, 'a', 'innfo-field-url', d.value)
    a.setAttribute('href', d.value)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
    return a
  }

  function renderFieldCode(d, doc) {
    return makeEl(doc, 'code', 'innfo-field-code', d.value == null ? '' : String(d.value))
  }

  function renderFieldMarkdown(d, doc) {
    return makeEl(doc, 'span', 'innfo-field-markdown', d.value == null ? '' : String(d.value))
  }

  function renderFieldList(d, doc) {
    return makeEl(doc, 'span', 'innfo-ku-value innfo-field-list', d.value.map(String).join(', '))
  }

  function renderFieldObject(d, doc) {
    var chipWrap = makeEl(doc, 'span', 'innfo-ku-value innfo-obj-chips')
    Object.keys(d.value).forEach(function (k) {
      var chip = makeEl(doc, 'span', 'innfo-obj-chip')
      chip.appendChild(makeEl(doc, 'span', 'innfo-obj-chip-k', k))
      var rawV = d.value[k]
      var vNode = makeEl(doc, 'span', 'innfo-obj-chip-v', rawV == null ? '' : String(rawV))
      if (rawV === true || rawV === 'true') vNode.setAttribute('data-bool', 'true')
      else if (rawV === false || rawV === 'false') vNode.setAttribute('data-bool', 'false')
      chip.appendChild(vNode)
      chipWrap.appendChild(chip)
    })
    return chipWrap
  }

  function renderFieldImage(d, doc) {
    if (d.name === 'sources') return null
    if (typeof d.value !== 'string' || !looksLikeImageValue(d.value)) return null
    var normImgPath = normalizeAssetPath(d.value)
    var imgWrap = makeEl(doc, 'span', 'innfo-ku-value innfo-field-image-wrap')
    var img = makeEl(doc, 'img', 'innfo-field-image')
    img.setAttribute('src', normImgPath)
    img.setAttribute('alt', String(d.name || ''))
    img.setAttribute('loading', 'lazy')
    img.addEventListener('error', function () {
      var cur = img.getAttribute('src') || ''
      var relMatch = !img.getAttribute('data-retried') && cur.match(/^.+?\b((?:sources|kNNowledge|assets|evidence)\/.+)$/)
      if (relMatch) {
        img.setAttribute('data-retried', '1')
        img.setAttribute('src', relMatch[1])
        return
      }
      if (img.parentNode) img.parentNode.removeChild(img)
    })
    imgWrap.appendChild(img)
    imgWrap.appendChild(makeEl(doc, 'code', 'innfo-file-pill-path', normImgPath))
    return imgWrap
  }

  function renderFieldFile(d, doc) {
    var raw = String(d.value == null ? '' : d.value)
      .replace(/^\[\[\s*/, '')
      .replace(/\s*\]\]$/, '')
    var cleanPath = normalizeAssetPath(raw)
    var filePill = makeEl(doc, 'span', 'innfo-ku-value innfo-file-pill')
    var fileIcon = makeEl(doc, 'span', 'innfo-file-pill-icon')
    fileIcon.innerHTML = icon('cite-document', 12)
    filePill.appendChild(fileIcon)
    filePill.appendChild(makeEl(doc, 'code', 'innfo-file-pill-path', cleanPath))
    return filePill
  }

  function renderFieldMedia(d, doc) {
    if (typeof d.value !== 'string' || !d.value.trim()) return null
    var src = normalizeAssetPath(d.value)
    var tag = String(d.type || '').toLowerCase() === 'audio' ? 'audio' : 'video'
    var media = makeEl(doc, tag, 'innfo-field-media')
    media.setAttribute('controls', 'controls')
    media.setAttribute('src', src)
    media.setAttribute('preload', 'metadata')
    var wrap = makeEl(doc, 'span', 'innfo-ku-value innfo-field-media-wrap')
    wrap.appendChild(media)
    wrap.appendChild(makeEl(doc, 'code', 'innfo-file-pill-path', src))
    return wrap
  }

  function isAssetPath(value) {
    if (typeof value !== 'string') return false
    return /^(?:.+?\/)?(?:sources|kNNowledge|assets|evidence)\/[^\s]+\.[a-z0-9]{2,5}$/i.test(value.replace(/\\/g, '/'))
  }

  function FieldValue(data, opts) {
    var doc = resolveDoc(opts)
    var d = data && typeof data === 'object' ? data : {}
    var value = d.value
    var type = String(d.type || '').toLowerCase()

    // 1. Value-shape renderers, independent of the declared type.
    if (type === 'boolean' || typeof value === 'boolean') return renderFieldBoolean(d, doc)
    if (Array.isArray(value)) return renderFieldList(d, doc)
    if (value !== null && typeof value === 'object') return renderFieldObject(d, doc)
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return renderFieldUrl(d, doc)

    // 2. Declared-type renderer.
    var byType = FIELD_RENDERERS[type]
    if (byType) {
      var typed = byType(d, doc)
      if (typed) return typed
    }

    // 3. Shape heuristics for values with no declared (or recognized) type.
    if (typeof value === 'string') {
      if (d.name !== 'sources' && looksLikeImageValue(value)) return renderFieldImage(d, doc)
      if (isAssetPath(value)) return renderFieldFile(d, doc)
    }
    return null
  }

  function FieldRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.FieldRow: data required')
    var doc = resolveDoc(opts)
    var hasRef = !!(data.ref && data.ref.id)
    var valueNode = hasRef ? null : FieldValue(data, opts)
    var badge = KuBadge({
      kind: 'field',
      name: data.name,
      value: hasRef ? null : data.value,
      valueNode: valueNode,
    })
    var ftype = String(data.type || '').toLowerCase()
    if (
      ftype === 'markdown' ||
      ftype === 'markdown_inline' ||
      (typeof data.value === 'string' && data.value.length > 70)
    ) {
      badge.setAttribute('data-field-wide', 'true')
    }
    if (hasRef) {
      badge.appendChild(
        ElementPill(
          {
            id: data.ref.id,
            label: data.ref.label || data.ref.id,
            concept: data.ref.concept,
            color: data.ref.color,
            hexColor: data.ref.hexColor,
            slot: data.ref.slot,
            index: data.ref.index,
          },
          {
            doc: doc,
            onSelect: opts && opts.onRef ? function () { opts.onRef(data.ref.id) } : undefined,
          },
        ),
      )
    }
    if (Array.isArray(data.citations) && data.citations.length) {
      var seen = {}
      var variants = data.citations.map(originVariantOf)
      ;['error', 'agent', 'human', 'reviewer', 'document'].forEach(function (v) {
        if (seen[v]) return
        seen[v] = true
        if (variants.indexOf(v) === -1) return
        badge.appendChild(
          CitationIcon({ variant: v, field: data.name }, {
            onOpen: opts && opts.onCite ? opts.onCite : undefined,
          }),
        )
      })
    }
    return badge
  }

  // ---- Element-card Selected Hybrid (V1 + V4) ----
  //
  // Collapsed state: V1 header bar (thumbnail, name, status/markers, 1-line summary,
  // count & chevron) + Variant 4 bottom inline pill strip (structured object chips
  // such as photo_metadata and compact outgoing relation wikilink pills).
  // Expanded state: Full Variant 1 editorial layout (lineage/QUD meta bar, narrative
  // lead, 3-column structured property rows, and outgoing/incoming relations footer).

  var IMAGE_VALUE_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i

  function looksLikeImageValue(v) {
    if (typeof v !== 'string') return false
    var s = v.trim().toLowerCase()
    if (!s) return false
    if (s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0) return true
    return IMAGE_VALUE_RE.test(s)
  }

  // Last-resort prefix retry for payloads exported before the export-time
  // rebase (scripts/export-console.mjs rebaseModelAssets); a correctly exported
  // console loads the src on the first try.
  function retryImageSrc(img, fallback) {
    var cur = img.getAttribute('src') || ''
    if (/^(data:|blob:|https?:|file:)/i.test(cur)) {
      fallback()
      return
    }
    var tried = (img.getAttribute('data-retried') || '').split('|')
    var tail = cur.replace(/\\/g, '/')
    var m = tail.match(/^.+?\/(sources\/.+|kNNowledge\/.+|assets\/.+|evidence\/.+)$/)
    var candidates = []
    if (m) candidates.push(m[1])
    for (var i = 0; i < candidates.length; i++) {
      if (tried.indexOf(candidates[i]) === -1 && candidates[i] !== cur) {
        img.setAttribute('data-retried', (img.getAttribute('data-retried') || '') + '|' + candidates[i])
        img.setAttribute('src', candidates[i])
        return
      }
    }
    fallback()
  }

  function targetRecHex(rec) {
    return rec && rec._conceptHexColor ? rec._conceptHexColor : null
  }

  function imageFieldOf(fields) {
    var list = Array.isArray(fields) ? fields : []
    for (var i = 0; i < list.length; i++) {
      if (list[i] && looksLikeImageValue(list[i].value)) return list[i]
    }
    return null
  }

  var CONCEPT_SLOT_ICONS = ['box', 'boxes', 'flask-conical', 'git-branch', 'wrench', 'layers', 'cpu', 'shield', 'target', 'cite-document', 'cite-human', 'explorer']

  function resolveConceptIconName(conceptName, conceptOpts) {
    if (conceptOpts && conceptOpts.icon) return String(conceptOpts.icon)
    var s = String(conceptName || '').toLowerCase()
    if (/edge|probe|test|flask|case/i.test(s)) return 'flask-conical'
    if (/proc|workflow|flow|pipeline/i.test(s)) return 'git-branch'
    if (/work|task|step|action|tool/i.test(s)) return 'wrench'
    if (/doc|artifact|report|file/i.test(s)) return 'cite-document'
    if (/role|user|human|actor|team/i.test(s)) return 'cite-human'
    if (/agent|ai|model|bot/i.test(s)) return 'cite-agent'
    var slot = conceptSlot(conceptOpts)
    return CONCEPT_SLOT_ICONS[(slot - 1) % CONCEPT_SLOT_ICONS.length] || 'layers'
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

    var fields = Array.isArray(data.fields) ? data.fields : []
    var imageField = imageFieldOf(fields)
    var collapsible = !(opts && opts.collapsible === false)
    var byId = (opts && opts.byId) || {}

    var head = makeEl(doc, 'header', 'innfo-card-head')

    var conceptOpts = (opts && opts.concept) || {}
    if (data.conceptId || conceptOpts.index != null || conceptOpts.color) {
      card.setAttribute('data-concept-slot', String(conceptSlot(conceptOpts)))
    }
    var conceptIconName = resolveConceptIconName(data.conceptId, conceptOpts)

    function makeConceptThumb() {
      var ph = makeEl(doc, 'span', 'innfo-card-thumb innfo-card-thumb--concept innfo-card-thumb--empty')
      ph.setAttribute('data-concept-icon', conceptIconName)
      ph.setAttribute('title', String(data.conceptId || 'Element'))
      ph.setAttribute('aria-hidden', 'true')
      ph.innerHTML = icon(conceptIconName, 18)
      return ph
    }

    if (imageField) {
      var thumb = makeEl(doc, 'img', 'innfo-card-thumb')
      thumb.setAttribute('alt', String(data.name || data.id || ''))
      thumb.setAttribute('loading', 'lazy')
      thumb.setAttribute('src', normalizeAssetPath(String(imageField.value)))
      thumb.addEventListener('error', function () {
        retryImageSrc(thumb, function () {
          var ph = makeConceptThumb()
          if (thumb.parentNode) thumb.parentNode.replaceChild(ph, thumb)
        })
      })
      head.appendChild(thumb)
    } else {
      head.appendChild(makeConceptThumb())
    }
    head.appendChild(
      KuBadge({
        kind: 'element',
        id: data.id,
        label: data.name || data.id,
        index: conceptOpts.index,
        color: conceptOpts.color,
        icon: conceptOpts.icon,
      }),
    )

    // Surface semantic status pill in header if element has a status field
    var statusField = null
    var summaryField = null
    for (var fi = 0; fi < fields.length; fi++) {
      var fItem = fields[fi]
      if (!fItem) continue
      if (fItem.name === 'status' && typeof fItem.value === 'string' && fItem.value.trim()) {
        statusField = fItem.value.trim()
      } else if (fItem.name === 'summary' && typeof fItem.value === 'string' && fItem.value.trim()) {
        summaryField = fItem.value.trim()
      }
    }
    if (statusField) {
      var stPill = makeEl(doc, 'span', 'innfo-card-status-pill')
      var stNorm = statusField.toLowerCase()
      stPill.setAttribute('data-status', stNorm)
      if (stNorm === 'reviewed' || stNorm === 'applied' || stNorm === 'completed' || stNorm === 'verified') {
        var chk = makeEl(doc, 'span', 'innfo-status-pill-icon')
        chk.innerHTML = icon('check', 11)
        stPill.appendChild(chk)
      }
      stPill.appendChild(doc.createTextNode(statusField))
      head.appendChild(stPill)
    }

    if (Array.isArray(data.markers)) {
      data.markers.forEach(function (m) {
        if (m) head.appendChild(MarkerChip(m))
      })
    }

    if (summaryField) {
      var sumPrev = makeEl(doc, 'span', 'innfo-card-summary-preview', summaryField)
      sumPrev.setAttribute('title', summaryField)
      head.appendChild(sumPrev)
    }

    var qudNode = null
    if (data.qud && (data.qud.id || data.qud === true)) {
      var qudData = data.qud === true ? { id: data.id } : data.qud
      if (qudData && qudData.id == null) qudData.id = data.id
      qudNode = QudChip(qudData || { id: data.id })
    }
    if (Array.isArray(opts && opts.head)) {
      ;(opts.head || []).forEach(function (n) {
        if (n) head.appendChild(n)
      })
    }

    if (fields.length) {
      head.appendChild(
        makeEl(
          doc,
          'span',
          'innfo-card-count',
          fields.length + ' ' + (fields.length === 1 ? 'field' : 'fields'),
        ),
      )
    }

    function setOpen(next) {
      open = next
      card.setAttribute('data-open', open ? 'true' : 'false')
      var tg = head.querySelector('.innfo-card-toggle')
      if (tg) tg.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    if (collapsible) {
      var toggle = makeEl(doc, 'button', 'innfo-card-toggle')
      toggle.setAttribute('type', 'button')
      toggle.setAttribute('aria-label', 'Toggle details')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
      toggle.innerHTML = icon('chevron', 16)
      toggle.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        setOpen(!open)
      })
      head.appendChild(toggle)

      head.addEventListener('click', function (ev) {
        var t = ev && ev.target
        if (t && typeof t.closest === 'function' && t.closest('button, a, input, select, textarea')) {
          return
        }
        setOpen(!open)
      })
    }
    card.appendChild(head)

    var headline = String(data.name || data.id || '')
    var bodyFields = fields.filter(function (fr) {
      return fr && String(fr.value == null ? '' : fr.value) !== headline
    })
    var relations = Array.isArray(data.relations) ? data.relations : null

    // Variant 4 Bottom Inline Pill Strip for Collapsed State
    if (collapsible) {
      var stripLeft = makeEl(doc, 'div', 'innfo-collapsed-strip-left')
      var stripRight = makeEl(doc, 'div', 'innfo-collapsed-strip-right')

      // 1. Object fields (e.g., photo_metadata) rendered as inline key-value chip groups
      var objFields = bodyFields.filter(function (fr) {
        return fr && fr.value !== null && typeof fr.value === 'object' && !Array.isArray(fr.value)
      })
      objFields.forEach(function (fr) {
        var grp = makeEl(doc, 'span', 'innfo-strip-group')
        grp.appendChild(makeEl(doc, 'span', 'innfo-strip-key', fr.name + ':'))
        Object.keys(fr.value).forEach(function (k) {
          var chip = makeEl(doc, 'span', 'innfo-obj-chip')
          chip.appendChild(makeEl(doc, 'span', 'innfo-obj-chip-k', k))
          var rawV = fr.value[k]
          var vNode = makeEl(doc, 'span', 'innfo-obj-chip-v', rawV == null ? '' : String(rawV))
          if (rawV === true || rawV === 'true') vNode.setAttribute('data-bool', 'true')
          chip.appendChild(vNode)
          grp.appendChild(chip)
        })
        stripLeft.appendChild(grp)
      })

      // 2. If no object fields, surface up to 3 compact scalar fields when card has multiple fields
      var relFieldSet = {}
      if (relations) {
        relations.forEach(function (r) {
          if (r && r.field) relFieldSet[r.field] = true
        })
      }
      if (!objFields.length && bodyFields.length > 1) {
        var compactScalars = bodyFields.filter(function (fr) {
          if (!fr || fr.ref || fr.value == null || relFieldSet[fr.name]) return false
          if (fr.name === 'summary' || fr.name === 'long_description' || fr.name === 'description' || fr.name === 'status' || fr.name === 'sources') return false
          if (typeof fr.value === 'object') return false
          var sv = normalizeAssetPath(String(fr.value))
          if (!sv || sv.length > 36 || looksLikeImageValue(sv) || /^\[\[.*\]\]$/.test(sv)) return false
          return true
        }).slice(0, 3)
        compactScalars.forEach(function (fr) {
          var chip = makeEl(doc, 'span', 'innfo-obj-chip')
          chip.appendChild(makeEl(doc, 'span', 'innfo-obj-chip-k', fr.name))
          chip.appendChild(makeEl(doc, 'span', 'innfo-obj-chip-v', normalizeAssetPath(String(fr.value))))
          stripLeft.appendChild(chip)
        })
      }

      // 3. Outgoing relations rendered as Field KU chip + target-concept-colored Element KU pill
      if (relations && relations.length) {
        relations.slice(0, 3).forEach(function (r) {
          if (!r || typeof r !== 'object') return
          var tRec = r.target && byId[r.target] ? byId[r.target] : null
          var rLabel = r.targetLabel || (tRec && tRec.name) || r.target || '?'
          var relGroup = makeEl(doc, 'span', 'innfo-strip-rel-group')
          if (r.field) {
            var fChip = makeEl(doc, 'span', 'innfo-ku-field-chip innfo-strip-rel-field', '~ ' + r.field)
            relGroup.appendChild(fChip)
          }
          var pill = makeEl(doc, 'a', 'innfo-strip-rel')
          if (r.target) pill.setAttribute('href', '#el-' + r.target)
          var tConcept = r.targetConcept || (tRec && tRec.concept)
          var tSlot = r.targetSlot || (tRec && tRec._conceptSlot)
          var tHex = r.targetHexColor || (tRec && targetRecHex(tRec))
          if (tSlot) pill.setAttribute('data-concept-slot', String(tSlot))
          if (tHex) pill.style.setProperty('--pill-concept-color', String(tHex))
          if (tConcept || tSlot) {
            var tIco = makeEl(doc, 'span', 'innfo-strip-rel-icon')
            tIco.setAttribute('aria-hidden', 'true')
            tIco.innerHTML = icon(resolveConceptIconName(tConcept, { index: (Number(tSlot) || 1) - 1 }), 11)
            pill.appendChild(tIco)
          }
          pill.appendChild(doc.createTextNode((!r.field ? '' : '') + rLabel + ' ↗'))
          relGroup.appendChild(pill)
          stripRight.appendChild(relGroup)
        })
      }

      if (stripLeft.children.length || stripRight.children.length) {
        var collapsedStrip = makeEl(doc, 'div', 'innfo-card-collapsed-strip')
        collapsedStrip.appendChild(stripLeft)
        collapsedStrip.appendChild(stripRight)
        card.appendChild(collapsedStrip)
      }
    }

    var body = makeEl(doc, 'section', 'innfo-card-body')
    var hasHistory = Array.isArray(data.history) && data.history.length > 0
    if (qudNode || hasHistory) {
      var metaStrip = makeEl(doc, 'div', 'innfo-card-meta-strip')
      if (qudNode) metaStrip.appendChild(qudNode)
      if (hasHistory) {
        var firstHist = data.history[0] || {}
        var histText = data.history.length + (data.history.length === 1 ? ' applied change' : ' applied changes')
        if (firstHist.id || firstHist.author) {
          histText += ' (' + [firstHist.id, firstHist.author ? 'by ' + firstHist.author : null].filter(Boolean).join(' ') + ')'
        }
        var linPill = makeEl(doc, 'span', 'innfo-lineage-pill')
        var linIco = makeEl(doc, 'span', 'innfo-lineage-icon')
        linIco.innerHTML = icon('git-commit', 12)
        linPill.appendChild(linIco)
        linPill.appendChild(doc.createTextNode(histText))
        metaStrip.appendChild(linPill)
      }
      body.appendChild(metaStrip)
    }
    if (data.description) body.appendChild(makeEl(doc, 'p', 'innfo-card-desc', data.description))
    if (bodyFields.length) {
      var fieldRow = makeEl(doc, 'div', 'innfo-card-fields')
      bodyFields.forEach(function (fr) {
        fieldRow.appendChild(FieldRow(fr, { onRef: opts && opts.onRef, onCite: opts && opts.onCite }))
      })
      body.appendChild(fieldRow)
    }
    if (Array.isArray(opts && opts.body)) {
      ;(opts.body || []).forEach(function (n) {
        if (n) body.appendChild(n)
      })
    }
    var tags = Array.isArray(data.tags) ? data.tags : null
    if (tags) body.appendChild(TagRow({ tags: tags }))
    if (relations) {
      body.appendChild(RelList({ relations: relations, byId: byId }))
    }
    var incoming = Array.isArray(data.incomingRelations) ? data.incomingRelations : null
    if (incoming && incoming.length) {
      var incWrap = makeEl(doc, 'div', 'innfo-card-incoming')
      incWrap.appendChild(
        makeEl(doc, 'span', 'innfo-card-incoming-label', 'Referenced by (' + incoming.length + ')'),
      )
      incWrap.appendChild(RelList({ relations: incoming, byId: byId }))
      body.appendChild(incWrap)
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
      // The host passes the review module's staleness rule; the kit has no dependency on it.
      var changed =
        opts && typeof opts.isTargetChanged === 'function'
          ? opts.isTargetChanged(d, byId)
          : !el || el.hash !== d.base_hash
      // A stale draft whose proposed value already equals the current value was
      // applied out-of-band: 'already applied', not 'target changed'.
      var applied =
        changed && opts && typeof opts.isAlreadyApplied === 'function'
          ? opts.isAlreadyApplied(d, byId)
          : false
      var li = makeEl(doc, 'li', 'innfo-draft-row card bg-base-100 border border-base-200 shadow-xs')
      li.setAttribute('data-draft-id', String(d.id))
      if (changed && !applied) li.setAttribute('data-target-changed', 'true')
      if (applied) li.setAttribute('data-already-applied', 'true')

      var cardBody = makeEl(doc, 'div', 'card-body p-4 flex flex-row items-center justify-between gap-4')

      var left = makeEl(doc, 'div', 'flex items-center gap-3 flex-wrap')
      var badgeCls = d.kind === 'correction' ? 'badge badge-primary' : d.kind === 'comment' ? 'badge badge-neutral' : 'badge badge-ghost'
      var kindBadge = makeEl(doc, 'span', 'innfo-draft-kind ' + badgeCls, d.kind)
      left.appendChild(kindBadge)

      var targetLabel = el ? el.name || d.element_id : d.element || d.element_id
      var targetConcept = d.concept || (el && el.concept) || null
      var targetSpan = makeEl(doc, 'span', 'innfo-draft-target inline-flex items-center gap-1.5 font-semibold text-sm')
      if (targetConcept) {
        var cPill = ConceptPill(
          {
            id: targetConcept,
            label: targetConcept,
            index: el && el._conceptIndex != null ? el._conceptIndex : 0,
            color: el && el._conceptColor,
          },
          { doc: doc },
        )
        targetSpan.appendChild(cPill)
      }
      var ePill = ElementPill(
        {
          id: d.element_id || targetLabel,
          label: targetLabel,
          concept: targetConcept,
          color: el && el._conceptColor,
          hexColor: el && el._conceptHexColor,
          slot: el && el._conceptSlot,
          index: el && el._conceptIndex,
        },
        { doc: doc, href: d.element_id ? '#el-' + d.element_id : undefined },
      )
      targetSpan.appendChild(ePill)
      if (d.field) {
        var arrowSpan = makeEl(doc, 'span', 'innfo-draft-arrow text-xs opacity-60', '→')
        arrowSpan.setAttribute('aria-hidden', 'true')
        targetSpan.appendChild(arrowSpan)
        var fBadge = makeEl(doc, 'span', 'innfo-ku-field-chip', '~ ' + d.field)
        fBadge.setAttribute('data-ku-kind', 'field')
        targetSpan.appendChild(fBadge)
      }
      left.appendChild(targetSpan)

      var text = d.comment != null ? d.comment : d.proposed != null ? d.proposed : ''
      var textSpan = makeEl(doc, 'span', 'innfo-draft-text text-sm opacity-80', text)
      left.appendChild(textSpan)
      cardBody.appendChild(left)

      var right = makeEl(doc, 'div', 'flex items-center gap-2 shrink-0')
      if (applied) {
        var appliedBadge = makeEl(doc, 'span', 'innfo-draft-already-applied badge badge-neutral badge-sm', 'already applied')
        right.appendChild(appliedBadge)
      } else if (changed) {
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
    var tabBtnConnections = makeEl(doc, 'button', 'innfo-modal-tab-btn', 'Connections')
    tabBtnConnections.setAttribute('type', 'button')
    navTabs.appendChild(tabBtnEdit)
    navTabs.appendChild(tabBtnHistory)
    navTabs.appendChild(tabBtnConnections)
    modal.appendChild(navTabs)

    // Panel 1: Edit Form
    var panelEdit = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-edit-modal-body')
    panelEdit.setAttribute('data-tab', 'edit')

    // Mode Selector: Propose Value vs Comment (D15)
    var modeWrap = makeEl(doc, 'div', 'innfo-edit-mode-selector')
    // commentOnly: there is no value to propose, so the mode is fixed and the
    // toggle is not offered.
    var commentOnly = Boolean(data.commentOnly)
    var isComment = commentOnly || Boolean(data.isComment)
    var btnPropose = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (!isComment ? ' active' : ''), 'Propose value')
    var btnComment = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (isComment ? ' active' : ''), 'Comment')
    btnPropose.setAttribute('type', 'button')
    btnComment.setAttribute('type', 'button')
    modeWrap.appendChild(btnPropose)
    modeWrap.appendChild(btnComment)
    if (!commentOnly) panelEdit.appendChild(modeWrap)

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

    // Panel 3: Connections (Sankey-style relation flow)
    var panelConnections = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-connections-modal-body')
    panelConnections.setAttribute('data-tab', 'connections')
    panelConnections.style.display = 'none'
    panelConnections.appendChild(SankeyFlow(data.connections || {}, { doc: doc }))
    modal.appendChild(panelConnections)

    var actions = makeEl(doc, 'div', 'innfo-edit-modal-actions')
    var saveBtn = makeEl(doc, 'button', 'innfo-edit-btn innfo-edit-btn-save', 'Save draft')
    saveBtn.setAttribute('type', 'button')
    var saveError = makeEl(doc, 'p', 'innfo-edit-error')
    saveError.setAttribute('role', 'alert')
    saveError.style.display = 'none'

    // Tab switcher events
    var tabButtons = { edit: tabBtnEdit, history: tabBtnHistory, connections: tabBtnConnections }
    var tabPanels = { edit: panelEdit, history: panelHistory, connections: panelConnections }
    function showTab(name) {
      Object.keys(tabButtons).forEach(function (k) {
        tabButtons[k].className = 'innfo-modal-tab-btn' + (k === name ? ' active' : '')
        tabPanels[k].style.display = k === name ? 'block' : 'none'
      })
      actions.style.display = name === 'edit' ? '' : 'none'
      if (name !== 'edit') saveError.style.display = 'none'
    }
    tabBtnEdit.addEventListener('click', function () {
      showTab('edit')
    })
    tabBtnHistory.addEventListener('click', function () {
      showTab('history')
    })
    tabBtnConnections.addEventListener('click', function () {
      showTab('connections')
    })

    var startTab = data.startTab === 'history' ? 'history' : data.startTab === 'connections' ? 'connections' : 'edit'
    if (startTab !== 'edit') showTab(startTab)

    saveBtn.addEventListener('click', function () {
      if (isComment && String(commentTa.value).trim() === '') {
        saveError.textContent = 'Enter a comment before saving.'
        saveError.style.display = 'block'
        return
      }
      saveError.style.display = 'none'
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
    modal.appendChild(saveError)
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


  // A compact 3-column Sankey-style flow for a knowledge unit: incoming
  // relations flow into the centre node, outgoing relations flow out. Pure SVG,
  // no layout library. Data: { center, incoming: [{label, field}], outgoing: [...] }.
  function SankeyFlow(data, opts) {
    var doc = resolveDoc(opts)
    var d = data && typeof data === 'object' ? data : {}
    var incoming = Array.isArray(d.incoming) ? d.incoming : []
    var outgoing = Array.isArray(d.outgoing) ? d.outgoing : []
    var wrap = makeEl(doc, 'div', 'innfo-sankey')
    wrap.setAttribute('data-innfo-component', 'sankey')
    if (!incoming.length && !outgoing.length) {
      wrap.appendChild(makeEl(doc, 'p', 'innfo-sankey-empty', 'No relations recorded for this knowledge unit.'))
      return wrap
    }
    var NS = 'http://www.w3.org/2000/svg'
    var rowH = 34
    var gap = 12
    var pad = 18
    var width = 680
    var colW = 210
    var rows = Math.max(incoming.length, outgoing.length, 1)
    var height = pad * 2 + rows * rowH + (rows - 1) * gap
    var svg = doc.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
    svg.setAttribute('class', 'innfo-sankey-svg')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Knowledge unit relation flow')
    svg.setAttribute('preserveAspectRatio', 'xMidYMin meet')

    function nodeY(i) {
      return pad + i * (rowH + gap)
    }
    function rect(x, y, cls) {
      var r = doc.createElementNS(NS, 'rect')
      r.setAttribute('x', x)
      r.setAttribute('y', y)
      r.setAttribute('width', colW)
      r.setAttribute('height', rowH)
      r.setAttribute('rx', '6')
      r.setAttribute('class', cls)
      return r
    }
    function label(x, y, text, cls, anchor) {
      var t = doc.createElementNS(NS, 'text')
      t.setAttribute('x', x)
      t.setAttribute('y', y)
      t.setAttribute('class', cls)
      if (anchor) t.setAttribute('text-anchor', anchor)
      t.textContent = String(text == null ? '' : text)
      return t
    }
    function truncate(s, n) {
      s = String(s == null ? '' : s)
      return s.length > n ? s.slice(0, n - 1) + '\u2026' : s
    }
    function flow(x1, y1, x2, y2) {
      var p = doc.createElementNS(NS, 'path')
      var mx = (x1 + x2) / 2
      p.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2)
      p.setAttribute('class', 'innfo-sankey-link')
      return p
    }

    var leftX = 0
    var centerX = (width - colW) / 2
    var rightX = width - colW
    var centerRows = Math.max(incoming.length, outgoing.length, 1)
    var centerY = nodeY(Math.floor((centerRows - 1) / 2))
    var centerMidY = centerY + rowH / 2

    incoming.forEach(function (link, i) {
      svg.appendChild(flow(leftX + colW, nodeY(i) + rowH / 2, centerX, centerMidY))
    })
    outgoing.forEach(function (link, i) {
      svg.appendChild(flow(centerX + colW, centerMidY, rightX, nodeY(i) + rowH / 2))
    })

    function node(link, x, i) {
      var r = rect(x, nodeY(i), 'innfo-sankey-node')
      if (link && link.label) {
        var title = doc.createElementNS(NS, 'title')
        title.textContent = String(link.label) + (link.field ? ' (' + link.field + ')' : '')
        r.appendChild(title)
      }
      svg.appendChild(r)
      svg.appendChild(label(x + 10, nodeY(i) + 21, truncate(link && link.label, 20), 'innfo-sankey-label'))
      if (link && link.field) {
        svg.appendChild(label(x + colW - 8, nodeY(i) + 21, truncate(link.field, 12), 'innfo-sankey-field', 'end'))
      }
    }
    incoming.forEach(function (link, i) {
      node(link, leftX, i)
    })
    outgoing.forEach(function (link, i) {
      node(link, rightX, i)
    })

    svg.appendChild(rect(centerX, centerY, 'innfo-sankey-node innfo-sankey-center'))
    svg.appendChild(
      label(centerX + colW / 2, centerY + 22, truncate(d.center || 'This unit', 26), 'innfo-sankey-center-label', 'middle'),
    )

    wrap.appendChild(svg)
    return wrap
  }

  var REVIEW_STATES = ['none', 'reviewed', 'changed']
  var REVIEW_LABELS = { none: 'Mark reviewed', reviewed: 'Reviewed', changed: 'Changed' }

  function ReviewedToggle(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.ReviewedToggle: data required')
    }
    var state = REVIEW_STATES.indexOf(data.state) !== -1 ? data.state : 'none'
    var doc = resolveDoc(null)
    var b = makeEl(doc, 'button', 'innfo-reviewed-toggle', REVIEW_LABELS[state])
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

  // ---- Knowledge-unit badge family (KuBadge) ----
  //
  // One grammar for every knowledge unit: the badge shape encodes the unit kind,
  // the concept color encodes the concept, the slug is the identity. Actions (info
  // / edit) live OUTSIDE the badge in KuActions, never nested, and the pending-
  // change pip is a count badge child. The kit holds no mode state: the edit action
  // exists only because the caller passed onEdit.
  var KU_KINDS = ['document', 'element', 'concept', 'field', 'cell', 'marker', 'reference']
  var KU_KIND_ICON = {
    document: 'cite-document',
    concept: 'explorer',
    marker: 'star',
    field: 'derived',
    cell: 'calc',
  }

  function isInfoOrEditAction(opts) {
    return !!(
      opts &&
      (typeof opts.onInfo === 'function' ||
        typeof opts.onEdit === 'function' ||
        typeof opts.onChanges === 'function')
    )
  }

  function KuBadge(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.KuBadge: data required')
    var doc = resolveDoc(opts)
    var kind = KU_KINDS.indexOf(data.kind) !== -1 ? data.kind : 'element'
    var hasAction = isInfoOrEditAction(opts)
    var navigable = !!((opts && opts.href) || (opts && opts.onSelect))
    var interactive = navigable && !hasAction
    var tag = interactive ? (opts && opts.href ? 'a' : 'button') : 'span'
    var badge = makeEl(doc, tag, 'innfo-ku-badge')
    badge.setAttribute('data-innfo-component', 'ku-badge')
    badge.setAttribute('data-ku-kind', kind)
    if (interactive && opts.href) badge.setAttribute('href', String(opts.href))
    if (tag === 'button') {
      badge.setAttribute('type', 'button')
      badge.addEventListener('click', function () {
        if (opts && typeof opts.onSelect === 'function') opts.onSelect(data)
      })
    }

    if (kind === 'document' || kind === 'concept') {
      if (data.id != null) badge.setAttribute('data-concept-id', String(data.id))
      if (kind === 'concept' || data.index != null || data.color) {
        badge.setAttribute('data-concept-slot', String(conceptSlot(data)))
      }
    } else if (kind === 'element' || kind === 'reference') {
      if (data.id != null) badge.setAttribute('data-element-id', String(data.id))
      if (data.index != null || data.color) badge.setAttribute('data-concept-slot', String(conceptSlot(data)))
    } else if (kind === 'field') {
      badge.setAttribute('data-field', String(data.name == null ? '' : data.name))
      if (data.index != null || data.color) badge.setAttribute('data-concept-slot', String(conceptSlot(data)))
    } else if (kind === 'marker') {
      badge.setAttribute('data-marker-id', String(data.id == null ? '' : data.id))
      badge.setAttribute('data-kind', String(data.markerKind == null ? '' : data.markerKind))
      if (data.index != null || data.color) badge.setAttribute('data-concept-slot', String(conceptSlot(data)))
    }

    var iconName = data.icon || KU_KIND_ICON[kind]
    if (iconName) {
      var wrapIcon = makeEl(doc, 'span', 'innfo-ku-icon')
      wrapIcon.innerHTML = icon(iconName, 13)
      badge.appendChild(wrapIcon)
    }

    if (kind === 'field') {
      if (data.name != null) badge.appendChild(makeEl(doc, 'span', 'innfo-ku-label', data.name + ':'))
      if (data.valueNode) badge.appendChild(data.valueNode)
      else badge.appendChild(makeEl(doc, 'span', 'innfo-ku-value', data.value == null ? '' : String(data.value)))
    } else if (kind === 'cell') {
      badge.appendChild(makeEl(doc, 'span', 'innfo-ku-value', data.value == null ? '' : String(data.value)))
    } else if (kind === 'marker') {
      badge.appendChild(makeEl(doc, 'span', 'innfo-ku-value', String(data.label == null ? '' : data.label)))
      if (data.value != null) badge.appendChild(makeEl(doc, 'b', null, data.value))
    } else {
      var labelText = String(data.label == null ? '' : data.label)
      var labelEl = makeEl(doc, 'span', 'innfo-ku-value', labelText)
      if (labelText) labelEl.setAttribute('title', labelText)
      badge.appendChild(labelEl)
    }

    var changes = Number(data.changes) || 0
    if (changes > 0) {
      badge.setAttribute('data-ku-changes', String(changes))
      var pip = makeEl(doc, 'button', 'innfo-ku-change-pip', String(changes))
      pip.setAttribute('data-innfo-component', 'ku-change-pip')
      pip.setAttribute('type', 'button')
      pip.setAttribute('aria-label', changes + ' pending ' + (changes === 1 ? 'change' : 'changes'))
      pip.setAttribute('title', changes + ' pending ' + (changes === 1 ? 'change' : 'changes'))
      pip.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        if (opts && typeof opts.onChanges === 'function') opts.onChanges()
      })
      badge.appendChild(pip)
    }
    return badge
  }

  function KuActions(data, opts) {
    var doc = resolveDoc(opts)
    var cluster = makeEl(doc, 'span', 'innfo-ku-actions')
    cluster.setAttribute('data-innfo-component', 'ku-actions')
    if (opts && typeof opts.onInfo === 'function') {
      var info = makeEl(doc, 'button', 'innfo-ku-action')
      info.setAttribute('type', 'button')
      info.setAttribute('data-ku-action', 'info')
      info.setAttribute('aria-label', 'Knowledge unit info')
      info.setAttribute('title', 'Info')
      info.innerHTML = icon('info', 14)
      info.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        opts.onInfo(data)
      })
      cluster.appendChild(info)
    }
    if (opts && typeof opts.onEdit === 'function') {
      var edit = makeEl(doc, 'button', 'innfo-ku-action')
      edit.setAttribute('type', 'button')
      edit.setAttribute('data-ku-action', 'edit')
      edit.setAttribute('aria-label', 'Edit knowledge unit')
      edit.setAttribute('title', 'Edit')
      edit.innerHTML = icon('pencil', 14)
      edit.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        opts.onEdit(data)
      })
      cluster.appendChild(edit)
    }
    return cluster
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
        setTheme(document, 'light')
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
    resolveConceptIconName: resolveConceptIconName,
    ORIGIN_VARIANTS: ['error', 'agent', 'human', 'reviewer', 'document'],
    ConceptPill: ConceptPill,
    ElementPill: ElementPill,
    MarkerChip: MarkerChip,
    KuBadge: KuBadge,
    KuActions: KuActions,
    QudChip: QudChip,
    TagRow: TagRow,
    RelList: RelList,
    EditToggle: EditToggle,
    EditAnchor: EditAnchor,
    StatusBadge: StatusBadge,
    CitationIcon: CitationIcon,
    FieldRow: FieldRow,
    FieldValue: FieldValue,
    ElementCard: ElementCard,
    CITATION_ORIGIN_LABELS: CITATION_ORIGIN_LABELS,
    DraftList: DraftList,
    AnnotationPopover: AnnotationPopover,
    ReviewedToggle: ReviewedToggle,
    RailProgress: RailProgress,
    EditModal: EditModal,
    SankeyFlow: SankeyFlow,
    FieldStringWidget: FieldStringWidget,
    FieldNumberWidget: FieldNumberWidget,
    FieldBooleanWidget: FieldBooleanWidget,
    FieldSelectWidget: FieldSelectWidget,
    FieldMultiSelectWidget: FieldMultiSelectWidget,
    FieldReferenceWidget: FieldReferenceWidget,
    FieldMarkdownWidget: FieldMarkdownWidget,
  }
})
