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
      '--innfo-status-unsent': '#1e3a8a',
      '--innfo-status-pending-bg': '#fef3c7',
      '--innfo-status-applied-bg': '#dcfce7',
      '--innfo-status-rejected-bg': '#fee2e2',
      '--innfo-status-stale-bg': '#f3f4f6',
      '--innfo-status-unsent-bg': '#dbeafe',
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
    '.innfo-status-badge{display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2}',
    '.innfo-concept-dot{width:.6em;height:.6em;border-radius:50%;background:var(--innfo-muted);flex:0 0 auto}',
    '.innfo-concept-count{color:var(--innfo-muted)}',
    '.innfo-element-origin{display:inline-flex;align-items:center;color:var(--innfo-origin-document)}',
    '.innfo-element-origin[data-origin=error]{color:var(--innfo-origin-error)}',
    '.innfo-element-origin[data-origin=agent]{color:var(--innfo-origin-agent)}',
    '.innfo-element-origin[data-origin=human]{color:var(--innfo-origin-human)}',
    '.innfo-element-origin[data-origin=reviewer]{color:var(--innfo-origin-reviewer)}',
    '.innfo-status-badge{border-radius:var(--innfo-radius-sm);padding:.05em .5em;font-weight:600}',
    // The single per-row change-state signal: blue means a change that lives only
    // in this console and has not been submitted yet.
    '.innfo-status-badge[data-status=local]{color:var(--innfo-status-unsent);background:var(--innfo-status-unsent-bg)}',
    '.innfo-draft-list{list-style:none;margin:0;padding:0}',
    '.innfo-draft-row{display:flex;align-items:baseline;gap:.5em;padding:.3em 0;border-bottom:1px solid var(--innfo-border)}',
    '.innfo-draft-kind{font-weight:600;color:var(--innfo-muted)}',
    '.innfo-draft-text{flex:1 1 auto}',
    '.innfo-draft-target-changed{color:var(--innfo-status-stale);font-size:.8rem}',
    '.innfo-annotation-popover{border:1px solid var(--innfo-border);border-radius:var(--innfo-radius);background:var(--innfo-surface);padding:.75em;box-shadow:var(--innfo-shadow)}',
    '.innfo-popover-original{color:var(--innfo-muted)}',
    '.innfo-popover-proposed{display:block;width:100%;font:inherit}',
    '.innfo-rail-progress{color:var(--innfo-muted);font-size:.75rem}',
    '.innfo-new-element{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface);color:var(--innfo-text);font:inherit;font-size:.82rem;font-weight:600;padding:6px 14px;border-radius:var(--innfo-radius-sm);cursor:pointer}',
    '.innfo-review-anchor{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease}',
    '.innfo-review-anchor:hover{opacity:1;background:var(--innfo-surface);border-color:var(--innfo-focus)}',
    '[data-innfo-component=element-card]:hover .innfo-review-anchor{opacity:.85}',
    '.innfo-review-anchor:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px;opacity:1}',
    '.innfo-review-badges{display:inline-flex;gap:.3em;align-items:center;margin-left:.4em}',
    // The single change-state signal collapses every per-row change signal (the
    // local edit, the proposed changesets and the applied history) into one badge.
    // The per-state counts live in the badge tooltip.
    '.innfo-change-state{font-size:.76rem;font-weight:700;border-radius:999px;padding:.05em .6em}',
    // Change toast: the feedback that a change was recorded but NOT applied. Fixed
    // to the bottom-right, temporary, dismissable; it never blocks the page. The
    // class is `innfo-change-toast` so it never collides with the runtime's inline
    // error toast (`.innfo-toast`, `[data-innfo="toast"]`).
    '.innfo-change-toast{position:fixed;right:1rem;bottom:1rem;z-index:90;display:flex;align-items:flex-start;gap:.6rem;max-width:22rem;padding:.75rem .9rem;background:var(--innfo-surface);color:var(--innfo-text);border:1px solid var(--innfo-border);border-left:3px solid var(--innfo-status-unsent);border-radius:var(--innfo-radius);box-shadow:0 10px 32px rgba(0,0,0,.18)}',
    '.innfo-change-toast-icon{flex:0 0 auto;display:inline-flex;color:var(--innfo-status-unsent);margin-top:.1rem}',
    '.innfo-change-toast-body{min-width:0}',
    '.innfo-change-toast-title{display:block;font-weight:700;font-size:.85rem;margin-bottom:.15rem}',
    '.innfo-change-toast-text{display:block;font-size:.8rem;line-height:1.4;color:var(--innfo-muted)}',
    '.innfo-change-toast-close{flex:0 0 auto;margin-left:auto;appearance:none;border:0;background:transparent;color:var(--innfo-muted);font:inherit;font-size:1rem;line-height:1;cursor:pointer;padding:.05rem .2rem;border-radius:var(--innfo-radius-sm)}',
    '.innfo-change-toast-close:hover{color:var(--innfo-text);background:var(--innfo-surface-2)}',
    '@media (max-width:640px){.innfo-change-toast{left:1rem;right:1rem;max-width:none}}',
    '.innfo-popover-comment,.innfo-popover-proposed{display:block;width:100%;font:inherit;box-sizing:border-box}',
    '@media (max-width:640px){.innfo-annotation-popover{width:100%}.innfo-new-element{width:100%}}',
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
    // .innfo-review-anchor), QKUD chip, tags, relations.
    '.innfo-edit-anchor{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface-2);color:var(--innfo-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--innfo-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease;display:inline-flex;align-items:center;justify-content:center;min-width:1.9em;min-height:1.6em}',
    '.innfo-edit-anchor:hover{opacity:1;background:var(--innfo-surface);border-color:var(--innfo-focus)}',
    '[data-innfo-component=element-card]:hover .innfo-edit-anchor{opacity:.85}',
    '.innfo-edit-anchor:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px;opacity:1}',
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
    '@media (max-width:640px){.innfo-edit-anchor,.innfo-qud-btn,.innfo-rel-act{min-width:32px;min-height:32px}.innfo-qud{font-size:.75rem}}',
    // Knowledge-unit badge family (Ku) + action cluster + change pip.
    '.innfo-ku-unit{display:inline-flex;align-items:center;gap:.25em;max-width:100%}',
    '.innfo-card-fields>.innfo-ku-unit,.innfo-card-fields>.innfo-ku{flex:1 1 16rem;min-width:0}',
    '.innfo-card-fields>.innfo-ku[data-field-wide=true],.innfo-card-fields>.innfo-ku-unit:has([data-field-wide=true]){flex-basis:100%}',
    '.innfo-ku{position:relative;display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2;border:0;border-radius:var(--innfo-radius-sm);padding:.12em .5em;background:var(--innfo-surface-2);color:var(--innfo-text);max-width:100%;--c:var(--innfo-concept-1);--cb:var(--innfo-concept-1-bg)}',
    // Nature grammar (approved 2026-10-18): container = ONE border at 2x the line
    // width (no double border); structure = SOLID concept-coloured border + mono
    // (no dashed); content = NO border, the concept colour rides on the label and
    // the concept icon.
    '.innfo-ku[data-ku-nature=container]{border:2px solid var(--innfo-accent);background:var(--innfo-surface)}',
    '.innfo-ku[data-ku-nature=structure]{border:1.5px solid var(--c);font-family:ui-monospace,monospace;color:var(--innfo-muted);background:var(--innfo-surface)}',
    '.innfo-ku[data-ku-nature=content]{border:0;background:var(--innfo-surface-2)}',
    '.innfo-ku-wrap{display:inline-flex;align-items:center;gap:.2em;position:relative;vertical-align:middle;max-width:100%}',
    '.innfo-ku[data-ku-kind=field],.innfo-ku[data-ku-kind=cell]{background:var(--innfo-surface-2)}',
    // Element + concept/document badges read as card titles: slightly larger and
    // semibold so they anchor the hierarchy above their muted field rows.
    '.innfo-ku[data-ku-kind=element],.innfo-ku[data-ku-kind=concept],.innfo-ku[data-ku-kind=document]{font-weight:600}',
    '.innfo-ku[data-ku-kind=element]{font-size:.9rem}',
    '.innfo-ku .innfo-ku-label{color:var(--innfo-muted)}',
    '.innfo-ku .innfo-ku-value{color:var(--innfo-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.innfo-ku .innfo-ku-icon{display:inline-flex;color:var(--innfo-muted);flex:0 0 auto}',
    // Content badges: NO border; the concept colour rides on the label/value and on
    // the concept icon (the icon of the concept the unit belongs to).
    '.innfo-ku[data-ku-nature=content]>.innfo-ku-label,.innfo-ku[data-ku-nature=content]>.innfo-ku-value{color:var(--c)}',
    '.innfo-ku[data-ku-nature=content]>.innfo-ku-icon{color:var(--c)}',
    // A Source is cited evidence: paper fill and neutral ink. It is never tinted by
    // the concept colour, even though it is a content unit.
    '.innfo-ku[data-ku-home=source]>.innfo-ku-label{color:var(--innfo-muted)}',
    '.innfo-ku[data-ku-home=source]>.innfo-ku-value{color:var(--innfo-text)}',
    '.innfo-ku[data-ku-home=source] .innfo-ku-icon{color:var(--innfo-muted)}',
    // Field badges carry free text: under card fields they grow to fill the row,
    // while in tables/grids they remain compact inline-flex elements.
    '.innfo-card-fields>.innfo-ku-unit>.innfo-ku[data-ku-kind=field],.innfo-card-fields>.innfo-ku[data-ku-kind=field]{flex:1 1 16em;align-items:flex-start;font-size:.92rem;line-height:1.5;padding:.4em .6em;gap:.45em}',
    '.innfo-ku[data-ku-kind=field]{min-width:0;align-items:center;line-height:1.3}',
    '.innfo-ku[data-ku-kind=field] .innfo-ku-label{flex:0 0 auto;white-space:nowrap;font-weight:600}',
    '.innfo-ku[data-ku-kind=field] .innfo-ku-value{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;text-align:left}',
    '.innfo-ku[data-ku-kind=field] .innfo-ku-icon{margin-top:.18em}',
    '.innfo-ku .innfo-ku-values{display:inline-flex;flex-wrap:wrap;gap:.25em}',
    '.innfo-ku .innfo-ku-value-chip{display:inline-flex;align-items:center;border:1px solid var(--innfo-border);border-radius:999px;padding:0 .5em;font-size:.85em}',
    '.innfo-ku[data-ku-changes]{border-style:dashed}',
    '.innfo-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px}',
    '.innfo-kpi-card{background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius);padding:14px 16px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--innfo-shadow)}',
    '.innfo-kpi-header{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.innfo-kpi-value{font-size:1.4rem;font-weight:700;color:var(--innfo-text);line-height:1.2}',
    '.innfo-kpi-hint{font-size:.78rem;color:var(--innfo-muted)}',
    // Data surfaces (Table / MatrixGrid / Timeline): one token-driven grid. The
    // scroll wrapper is the ONLY horizontal scroll port, so a wide matrix never
    // widens the page (the old bug: a missing Tailwind `overflow-x-auto`).
    '.innfo-grid-scroll{max-width:100%;min-width:0;overflow:auto;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius);background:var(--innfo-surface)}',
    '.innfo-grid-scroll+.innfo-grid-scroll{margin-top:.6rem}',
    '.innfo-grid{border-collapse:separate;border-spacing:0;width:100%;font-size:.82rem;color:var(--innfo-text)}',
    '.innfo-grid th,.innfo-grid td{padding:.4em .65em;border-bottom:1px solid var(--innfo-border);text-align:left;vertical-align:middle}',
    '.innfo-grid thead th{position:sticky;top:0;z-index:2;background:var(--innfo-surface-2);color:var(--innfo-muted);font-weight:600;font-size:.75rem;white-space:nowrap}',
    '.innfo-grid tbody tr:last-child>th,.innfo-grid tbody tr:last-child>td{border-bottom:0}',
    '.innfo-grid tbody tr:hover>td,.innfo-grid tbody tr:hover>.innfo-grid-rowhead{background:var(--innfo-surface-2)}',
    '.innfo-grid-cell--center{text-align:center}',
    '.innfo-grid-cell--end{text-align:right}',
    '.innfo-grid-corner,.innfo-grid-rowhead{text-align:left;font-weight:600;color:var(--innfo-text)}',
    '.innfo-grid-empty{padding:1em .8em;color:var(--innfo-muted);text-align:center}',
    // Pinned first column: the corner + every row header stick to the left edge
    // and rise above the horizontally scrolled cells.
    '.innfo-grid-scroll[data-pin-first=true] .innfo-grid-corner{position:sticky;left:0;z-index:3;background:var(--innfo-surface-2)}',
    '.innfo-grid-scroll[data-pin-first=true] .innfo-grid-rowhead{position:sticky;left:0;z-index:1;background:var(--innfo-surface)}',
    '.innfo-grid-scroll[data-pin-first=true] .innfo-grid tbody tr:nth-child(even)>.innfo-grid-rowhead{background:var(--innfo-surface-2)}',
    '.innfo-grid-scroll[data-pin-first=true] .innfo-grid tbody tr:hover>.innfo-grid-rowhead{background:var(--innfo-surface-2)}',
    // FilterSelect: the shared multi-select facet (state, months, tags).
    '.innfo-filter{position:relative;display:inline-block}',
    '.innfo-filter-summary{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;font:inherit;font-size:.8rem;font-weight:600;color:var(--innfo-text);background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);cursor:pointer;list-style:none}',
    '.innfo-filter[open] .innfo-filter-summary{border-color:var(--innfo-link)}',
    '.innfo-filter-summary::-webkit-details-marker{display:none}',
    '.innfo-filter-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:50;min-width:220px;max-height:340px;overflow-y:auto;background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius);box-shadow:0 10px 25px -5px rgba(0,0,0,.15);padding:6px}',
    '.innfo-filter-quick{display:flex;flex-wrap:wrap;gap:4px;padding:2px 4px 6px;margin-bottom:4px;border-bottom:1px solid var(--innfo-border)}',
    '.innfo-filter-quick button{appearance:none;border:1px solid var(--innfo-border);background:var(--innfo-surface);color:var(--innfo-text);font:inherit;font-size:.72rem;padding:2px 8px;border-radius:999px;cursor:pointer}',
    '.innfo-filter-quick button:hover{border-color:var(--innfo-link);color:var(--innfo-link)}',
    '.innfo-filter-option{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--innfo-radius-sm);font-size:.82rem;cursor:pointer}',
    '.innfo-filter-option:hover{background:var(--innfo-surface-2)}',
    '.innfo-filter-option input{flex:0 0 auto}',
    '.innfo-filter-option-label{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.innfo-filter-option-count{font-family:var(--innfo-mono);font-size:.72rem;color:var(--innfo-muted)}',
    '.innfo-ku-change-pip{position:absolute;top:-.5em;right:-.5em;min-width:1.2em;height:1.2em;padding:0 .25em;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;line-height:1;border-radius:999px;background:var(--innfo-status-pending-bg);color:var(--innfo-status-pending);border:1px solid var(--innfo-status-pending);cursor:pointer}',
    // ONE affordance sits beside the badge: a borderless "+". The actions float
    // BELOW it on demand, so they take no inline space and never push a neighbour.
    '.innfo-ku-more{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--innfo-muted);cursor:pointer;flex:0 0 auto}',
    '.innfo-ku-more:hover,.innfo-ku-more[aria-expanded=true]{color:var(--innfo-text);background:var(--innfo-surface-2)}',
    '.innfo-ku-more:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px}',
    '.innfo-ku-actions{position:fixed;z-index:60;display:none;align-items:center;gap:.1em;padding:.2em;background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap}',
    '.innfo-ku-wrap[data-ku-open=true]>.innfo-ku-actions{display:inline-flex}',
    '.innfo-ku-action{appearance:none;border:1px solid transparent;background:transparent;color:var(--innfo-muted);font:inherit;padding:.1em .3em;border-radius:var(--innfo-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px}',
    '.innfo-ku-action:hover{color:var(--innfo-text);border-color:var(--innfo-border);background:var(--innfo-surface-2)}',
    '.innfo-ku-action[data-ku-action=edit]:hover{color:var(--innfo-link)}',
    '.innfo-ku-action:focus-visible{outline:2px solid var(--innfo-focus);outline-offset:1px}',
    // Citation dialog: ONE CARD per cited source (was a flat list of siblings, so
    // you could not tell where one citation ended and the next began).
    '.innfo-cite-list{display:grid;gap:.7rem}',
    '.innfo-cite-card+.innfo-cite-card{margin-top:.7rem}',
    '.innfo-cite-card{border:1px solid var(--innfo-border);border-left:4px solid var(--innfo-origin-document);border-radius:var(--innfo-radius);padding:.7rem .8rem;display:grid;gap:.5rem;background:var(--innfo-surface)}',
    '.innfo-cite-card[data-origin=agent]{border-left-color:var(--innfo-origin-agent)}',
    '.innfo-cite-card[data-origin=human]{border-left-color:var(--innfo-origin-human)}',
    '.innfo-cite-card[data-origin=reviewer]{border-left-color:var(--innfo-origin-reviewer)}',
    '.innfo-cite-card[data-origin=error]{border-left-color:var(--innfo-origin-error)}',
    '.innfo-cite-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}',
    '.innfo-cite-prov{display:inline-flex;align-items:center;gap:.3rem;font-size:.76rem;color:var(--innfo-muted)}',
    '.innfo-cite-prov svg{width:13px;height:13px}',
    '.innfo-cite-status{margin-left:auto;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.15em .5em;border-radius:999px;background:var(--innfo-surface-2);color:var(--innfo-muted)}',
    '.innfo-cite-status.is-bad{background:var(--innfo-origin-error);color:#fff}',
    '.innfo-cite-meta{margin:0;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.25rem .6rem;font-size:.78rem}',
    '.innfo-cite-meta dt{color:var(--innfo-muted)}',
    '.innfo-cite-meta dd{margin:0;overflow-wrap:anywhere;font-family:ui-monospace,monospace;font-size:.74rem}',
    '.innfo-cite-excerpt{margin:0;padding:.5rem .6rem;background:var(--innfo-surface-2);border-radius:var(--innfo-radius-sm);font-family:ui-monospace,monospace;font-size:.74rem;line-height:1.45;white-space:pre-wrap;max-height:9em;overflow:auto}',
    '.innfo-cite-open{justify-self:start;font-size:.78rem;font-weight:600;color:var(--innfo-link)}',
    // Filter: the AND/OR segmented control and the two-step field facet.
    '.innfo-op-toggle{display:inline-flex;align-items:center;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);overflow:hidden}',
    '.innfo-op-btn{appearance:none;border:0;background:transparent;color:var(--innfo-muted);font:inherit;font-size:.68rem;font-weight:800;letter-spacing:.04em;padding:.1em .5em;cursor:pointer;text-transform:uppercase}',
    '.innfo-op-btn:hover{background:var(--innfo-surface-2);color:var(--innfo-text)}',
    '.innfo-op-btn.active{background:var(--innfo-accent);color:var(--innfo-surface)}',
    '.innfo-facet-back{appearance:none;border:0;background:transparent;color:var(--innfo-muted);font:inherit;font-size:.72rem;padding:.3em .5em;cursor:pointer;text-align:left;width:100%}',
    '.innfo-facet-back:hover{color:var(--innfo-text);background:var(--innfo-surface-2)}',
    '.innfo-facet-input{font:inherit;font-size:.78rem;padding:.25em .4em;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);background:var(--innfo-surface);color:var(--innfo-text);width:100%}',
    // View tabs carry a TONE by where the view comes from: the three core views are
    // purple, a bluepriNNt view is blue, a domaiNN/user view is black.
    '.innfo-view-tabs .innfo-view-tab.tone-core{color:#6d28d9}',
    '.innfo-view-tabs .innfo-view-tab.tone-blueprint{color:#2563eb}',
    '.innfo-view-tabs .innfo-view-tab.tone-custom{color:var(--innfo-text,#0a0a0a)}',
    // Structure warning inside the edit modal (the structure pencil is ungated).
    '.innfo-edit-warn{display:flex;align-items:flex-start;gap:.6rem;padding:.7rem 1.25rem;border-bottom:1px solid var(--innfo-status-pending);background:var(--innfo-status-pending-bg);color:var(--innfo-status-pending);font-size:.82rem;line-height:1.45}',
    '.innfo-edit-warn-icon{flex:0 0 auto;display:inline-flex;margin-top:.1rem}',
    '.innfo-edit-warn strong{display:block;margin-bottom:.15rem}',
    // "Proposing as ..." inside the edit modal (just-in-time identity).
    '.innfo-propose-as{padding:.45rem 1.25rem;border-bottom:1px solid var(--innfo-border);font-size:.78rem;color:var(--innfo-muted)}',
    '.innfo-propose-as[data-default=true]{color:var(--innfo-status-pending);background:var(--innfo-status-pending-bg)}',
    '.innfo-card-fields{display:flex;flex-direction:column;gap:.45em;align-items:stretch;margin:.6em 0 0}',
    '.innfo-card-desc-actions{margin-left:.4em}',
    // Element-card Dense Row (V01): a one-line bar (image chip, name, concept,
    // markers, field count, actions, chevron) over a collapsible body.
    // Scoped to the element-card so it wins over any shell-level card styles.
    '[data-innfo-component=element-card] .innfo-card-head{display:flex;align-items:center;gap:.5em;flex-wrap:wrap;cursor:pointer;min-width:0}',
    '[data-innfo-component=element-card] .innfo-card-badges{display:inline-flex;align-items:center;gap:.35em;min-width:0}',
    '[data-innfo-component=element-card] .innfo-card-badges .innfo-ku{display:inline-flex;align-items:center}',
    '[data-innfo-component=element-card] .innfo-card-thumb{width:40px;height:40px;border-radius:7px;object-fit:cover;border:1.5px solid var(--innfo-border);background:var(--innfo-surface-2);flex:0 0 auto;display:block}',
    '.innfo-field-image-wrap{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '[data-innfo-component=element-card] .innfo-card-thumb--empty,[data-innfo-component=element-card] .innfo-card-thumb--concept{display:inline-flex;align-items:center;justify-content:center;color:var(--card-concept-color,var(--innfo-accent));background:var(--card-concept-bg,var(--innfo-surface-2));border:1.5px solid var(--card-concept-color,var(--innfo-border))}',
    '[data-innfo-component=element-card] .innfo-card-count{font-size:.75rem;font-weight:600;color:var(--innfo-muted);background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:999px;padding:1px 8px;white-space:nowrap;flex:0 0 auto}',
    '[data-innfo-component=element-card] .innfo-card-toggle{appearance:none;border:1px solid transparent;background:transparent;color:var(--innfo-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:.15em;border-radius:var(--innfo-radius-sm);flex:0 0 auto}',
    '[data-innfo-component=element-card] .innfo-card-toggle:hover{color:var(--innfo-text);border-color:var(--innfo-border);background:var(--innfo-surface)}',
    '[data-innfo-component=element-card] .innfo-card-toggle .innfo-icon{transition:transform .15s ease}',
    '[data-innfo-component=element-card][data-open=true] .innfo-card-toggle .innfo-icon{transform:rotate(180deg)}',
    '[data-innfo-component=element-card][data-open=false] .innfo-card-body{display:none}',
    '[data-innfo-component=element-card][data-open=false] .innfo-card-footer{display:none}',
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
    '.innfo-markdown{display:block;font-size:.88rem;line-height:1.5;color:var(--innfo-text);overflow-wrap:anywhere}',
    '.innfo-markdown>:first-child{margin-top:0}',
    '.innfo-markdown>:last-child{margin-bottom:0}',
    '.innfo-markdown p{margin:.4em 0}',
    '.innfo-markdown ul,.innfo-markdown ol{margin:.4em 0;padding-left:1.4em}',
    '.innfo-markdown .innfo-md-heading{margin:.6em 0 .3em;font-size:1rem;font-weight:700}',
    '.innfo-markdown code{font-family:var(--innfo-mono);font-size:.82em;background:var(--innfo-surface-2);border-radius:4px;padding:0 .3em}',
    '.innfo-markdown a{color:var(--innfo-link);text-decoration:underline}',
    '.innfo-markdown .innfo-md-quote{margin:.5em 0;padding:.2em .8em;border-left:1px solid var(--innfo-border);color:var(--innfo-muted)}',
    '.innfo-markdown .innfo-md-quote[data-callout]{border-left-color:var(--innfo-accent);background:var(--innfo-surface-2)}',
    '.innfo-markdown .innfo-md-callout-title{display:block;font-size:.72rem;letter-spacing:.04em;color:var(--innfo-accent)}',
    '.innfo-file-pill[data-knowledge-bound=true]{cursor:pointer}',
    '.innfo-file-pill[data-knowledge-bound=true]:hover{border-color:var(--innfo-accent)}',
    '.innfo-tag[role=button]{cursor:pointer}',
    '.innfo-tag[role=button]:hover{border-color:var(--innfo-link)}',
    '.innfo-card-meta-strip{display:flex;align-items:center;justify-content:space-between;gap:.5em;flex-wrap:wrap;padding:6px 10px;margin:.55em 0;background:var(--innfo-surface-2);border:1px solid var(--innfo-border);border-radius:6px}',
    '.innfo-lineage-pill{display:inline-flex;align-items:center;gap:.3em;font-family:var(--innfo-mono);font-size:.73rem;color:var(--innfo-muted);background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:5px;padding:2px 7px}',
    '[data-innfo-component=element-card] .innfo-card-fields{display:flex;flex-direction:column;gap:0;align-items:stretch;margin:.6em 0 0;border:1px solid var(--innfo-border);border-radius:var(--innfo-radius-sm);overflow:hidden;background:var(--innfo-surface)}',
    // ElementMini (collection item): accent stripe + small thumb + name + optional meta. No fields.
    '.innfo-mini{display:flex;align-items:center;gap:.5em;background:var(--innfo-surface);border:1px solid var(--innfo-border);border-left:1px solid var(--innfo-border);border-radius:8px;padding:.32em .55em .32em .45em;min-width:0;max-width:100%;text-align:left}',
    'button.innfo-mini,a.innfo-mini{font:inherit;color:inherit;cursor:pointer;text-decoration:none}',
    '.innfo-mini:hover{border-color:var(--innfo-mini-accent,var(--innfo-focus))}',
    '.innfo-mini-thumb{width:20px;height:20px;border-radius:5px;flex:0 0 auto}',
    '.innfo-mini-text{display:flex;flex-direction:column;min-width:0;flex:1 1 auto}',
    '.innfo-mini-name{font-size:.8rem;font-weight:600;color:var(--innfo-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.innfo-mini-meta{font-size:.68rem;color:var(--innfo-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.innfo-mini>.innfo-card-status-pill{flex:0 0 auto}',
    // ElementPreview (generic floating detail) + the mini's info affordance.
    '.innfo-preview{position:fixed;z-index:60;width:clamp(26rem,60vw,52rem);max-width:calc(100vw - 1.5rem);max-height:calc(100vh - 1.5rem);overflow:auto;overscroll-behavior:contain;background:var(--innfo-surface);border:1px solid var(--innfo-border);border-radius:var(--innfo-radius,10px);box-shadow:0 12px 32px rgba(0,0,0,.16);padding:.6rem .8rem}',
    '.innfo-preview[hidden]{display:none}',
    '.innfo-preview .innfo-card{border:none;box-shadow:none;margin:0}',
    '.innfo-mini-info{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;background:transparent;color:var(--innfo-muted);cursor:pointer;border-radius:50%}',
    '.innfo-mini-info:hover,.innfo-mini-info[aria-expanded=true]{color:var(--innfo-text);background:var(--innfo-surface-2)}',
  ]
  for (var slot = 1; slot <= 12; slot++) {
    COMPONENT_CSS.push(
      '[data-concept-slot="' + slot + '"] .innfo-concept-dot{background:var(--innfo-concept-' + slot + ')}',
    )
  }
  for (var kslot = 1; kslot <= 12; kslot++) {
    COMPONENT_CSS.push(
      '[data-innfo-component=element-card][data-concept-slot="' + kslot + '"]{--card-concept-color:var(--innfo-concept-' + kslot + ');--card-concept-bg:var(--innfo-concept-' + kslot + '-bg);border-left:4px solid var(--innfo-concept-' + kslot + ')}',
      // The concept slot drives --c/--cb on the badge: content text + icon, the
      // structure border, and the concept/document tint all read from it.
      '[data-innfo-component=ku-unit][data-concept-slot="' + kslot + '"]{--c:var(--innfo-concept-' + kslot + ');--cb:var(--innfo-concept-' + kslot + '-bg)}',
      '[data-innfo-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=concept],[data-innfo-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=document]{background:var(--innfo-concept-' + kslot + '-bg);border-color:var(--innfo-concept-' + kslot + ')}',
      '[data-innfo-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=concept] .innfo-ku-icon,[data-innfo-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=document] .innfo-ku-icon{color:var(--innfo-concept-' + kslot + ')}',
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

  // Tag color derivation: FNV-1a 32-bit over valueKey(name), then slot = (h >>> 0) % 12 + 1
  function tagSlot(name) {
    var key = String(name == null ? '' : name).trim().toLowerCase()
    var h = 0x811c9dc5
    for (var i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return ((h >>> 0) % 12) + 1
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

  function TagRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.TagRow: data required')
    var doc = resolveDoc(opts)
    var tags = Array.isArray(data.tags) ? data.tags : []
    var onTag = opts && typeof opts.onTag === 'function' ? opts.onTag : null
    var row = makeEl(doc, 'div', 'innfo-tag-row')
    row.setAttribute('data-innfo-component', 'tag-row')
    tags.forEach(function (t) {
      var tag = makeEl(doc, 'span', 'innfo-tag')
      tag.setAttribute('data-tag', String(t))
      tag.setAttribute('data-concept-slot', String(tagSlot(t)))
      tag.appendChild(doc.createTextNode(String(t)))
      if (onTag) {
        tag.setAttribute('role', 'button')
        tag.setAttribute('tabindex', '0')
        tag.setAttribute('title', 'Filter by tag ' + String(t))
        tag.addEventListener('click', function (ev) {
          // The review +/x controls live inside the chip and keep their own action.
          var inner = ev && ev.target && typeof ev.target.closest === 'function' && ev.target.closest('[data-innfo-ctl]')
          if (inner) return
          onTag(String(t))
        })
        tag.addEventListener('keydown', function (ev) {
          if (ev && ev.target === tag && (ev.key === 'Enter' || ev.key === ' ')) {
            if (ev.preventDefault) ev.preventDefault()
            onTag(String(t))
          }
        })
      }
      row.appendChild(tag)
    })
    return row
  }

  function RelList(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.RelList: data required')
    var doc = resolveDoc(opts)
    var rels = Array.isArray(data.relations) ? data.relations : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var relModel = data.model || (opts && (opts.modelId || opts.model)) || 'model'
    var ul = makeEl(doc, 'ul', 'innfo-rel-list')
    ul.setAttribute('data-innfo-component', 'rel-list')
    rels.forEach(function (r) {
      if (!r || typeof r !== 'object') return
      var li = makeEl(doc, 'li', 'innfo-rel-row')
      if (r.field) li.setAttribute('data-rel-field', String(r.field))
      if (r.target) li.setAttribute('data-rel-target', String(r.target))
      li.appendChild(
        Ku(
          'field',
          {
            family: relModel,
            model: relModel,
            concept: r.sourceConcept || 'relations',
            name: r.field || 'related',
            label: r.field || 'related',
          },
          { doc: doc },
        ),
      )
      var targetRec = r.target && byId[r.target] ? byId[r.target] : null
      var label = r.targetLabel || (targetRec && targetRec.name) || r.target || '?'
      if (r.target) {
        li.appendChild(
          Ku(
            'element',
            {
              model: relModel,
              id: r.target,
              label: label,
              concept: r.targetConcept || (targetRec && targetRec.concept),
              color: r.targetColor || (targetRec && targetRec._conceptColor),
              index: targetRec && targetRec._conceptIndex,
            },
            { doc: doc },
          ),
        )
      } else {
        li.appendChild(doc.createTextNode(String(label)))
      }
      ul.appendChild(li)
    })
    return ul
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

  // Provisional user-facing copy ([P] at plan time): ONE table so the provisional
  // terminology can be renamed in a single place. Internal identifiers, storage
  // keys and payload shapes are never renamed here.
  var COPY = {
    unsent: 'Unsent',
    applied: 'Applied',
    notApplied: 'Not applied',
    changes: 'Changes',
    discard: 'Discard',
    revert: 'Revert',
    goToElement: 'Go to element',
    unsentHelp: 'Only in your browser. Export it and give it to the agent.',
    appliedHelp: 'Recorded in the domain.',
    toastTitle: 'Change recorded',
    toastBody:
      'It lives only in this console until you export it and give it to the agent to apply.',
    exportFlow:
      'Export the file and give it to the agent. The agent applies what it can and reports every skipped change and its reason. To retry, export a new file with only the skipped changes.',
    agentPromptSkipped:
      'Apply the attached changeset and report every change you skipped and the reason it was skipped.',
    banner:
      'Applied changes become part of every console generated from this domain. Do not include private data or content that is not meant for everyone.',
    bannerShort: 'Applied changes become part of every console generated from this domain.',
  }

  // Model views show ONE change state: `local` (Unsent), read from the browser's
  // unsent store. Applied and Not applied are card text inside the Changes tab,
  // never a badge.
  var STATUSES = ['local']
  var STATUS_HELP = { local: COPY.unsentHelp }
  var STATUS_LABELS = { local: COPY.unsent }

  function statusHelp(status) {
    return STATUS_HELP[status] || String(status)
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || String(status)
  }

  // `label` (a human word) is optional: with it the badge reads as a state, without
  // it the badge reads as a bare count (the legacy shape). `title` overrides the
  // generated help so a collapsed badge can enumerate every state it stands for.
  function StatusBadge(data) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.StatusBadge: data required')
    if (STATUSES.indexOf(data.status) === -1) {
      throw new TypeError('InnfoUI.StatusBadge: unknown status "' + data.status + '"')
    }
    var doc = resolveDoc(null)
    var badge = makeEl(doc, 'span', 'innfo-status-badge')
    badge.setAttribute('data-innfo-component', 'status-badge')
    badge.setAttribute('data-status', String(data.status))
    var text =
      data.label != null
        ? String(data.label)
        : data.count != null
          ? String(data.count)
          : String(data.status)
    badge.textContent = text
    badge.setAttribute('aria-label', String(data.label != null ? data.label : text))
    badge.setAttribute(
      'title',
      data.title != null ? String(data.title) : COPY.unsentHelp,
    )
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
    var label = 'Origin: ' + (data.field == null ? '' : data.field)
    btn.setAttribute('aria-label', label)
    btn.setAttribute('title', label)
    btn.innerHTML = icon('cite-' + variant, 14)
    btn.addEventListener('click', function (ev) {
      if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
      if (opts && typeof opts.onOpen === 'function') opts.onOpen(data)
    })
    return btn
  }

  // Header-level citation icons: one CitationIcon per distinct origin/error
  // variant, in canonical order. Returns an array of nodes (empty when nothing to
  // show), so `ElementCard` can append it to `.innfo-card-head` via `opts.head`.
  function CitationIcons(fieldName, entries, opts) {
    var list = Array.isArray(entries) ? entries : []
    if (!list.length) return []
    var doc = resolveDoc(opts)
    var present = {}
    list.forEach(function (entry) {
      var raw = entry && entry.error ? 'error' : entry && entry.origin
      present[CITATION_ORIGIN_LABELS[raw] ? raw : 'document'] = true
    })
    var wrap = makeEl(doc, 'span', 'cite-icons')
    var order = ['error', 'agent', 'human', 'reviewer', 'document']
    order.forEach(function (variant) {
      if (!present[variant]) return
      wrap.appendChild(
        CitationIcon(
          { variant: variant, field: fieldName },
          { doc: doc, onOpen: opts && typeof opts.onOpen === 'function' ? opts.onOpen : undefined },
        ),
      )
    })
    return wrap.children.length ? [wrap] : []
  }

  // ---- Markdown (safe subset) ----
  // Builds DOM nodes only: every piece of text goes through createTextNode or
  // textContent and every URL through setAttribute, so no markup in the input is
  // ever parsed. Anything outside the subset stays literal text.

  // http(s) and relative targets only. Control characters are refused outright
  // (browsers strip tabs and newlines inside a scheme), as are protocol-relative
  // and backslash-leading values.
  function safeHref(url) {
    var raw = String(url == null ? '' : url)
    if (/[\u0000-\u001f\u007f]/.test(raw)) return ''
    raw = raw.trim()
    if (!raw) return ''
    if (/^[\\/]{2}/.test(raw) || raw.charAt(0) === '\\') return ''
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return /^https?:/i.test(raw) ? raw : ''
    return raw
  }

  var MD_INLINE =
    /`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]*)\)|\*\*([^*\n]+?)\*\*|\*([^*\s][^*\n]*?)\*|_([^_\s][^_\n]*?)_/
  var MD_HEADING = /^(#{1,6})\s+(.*)$/
  var MD_LIST = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/
  var MD_QUOTE = /^\s{0,3}>\s?(.*)$/
  var MD_CALLOUTS = ['note', 'tip', 'important', 'warning', 'caution']

  function mdInline(doc, parent, text) {
    var re = new RegExp(MD_INLINE.source, 'g')
    var last = 0
    var m
    function addText(s) {
      if (s) parent.appendChild(doc.createTextNode(s))
    }
    function wrap(tag, inner) {
      var node = makeEl(doc, tag)
      mdInline(doc, node, inner)
      parent.appendChild(node)
    }
    while ((m = re.exec(text)) !== null) {
      addText(text.slice(last, m.index))
      last = m.index + m[0].length
      if (m[1] !== undefined) {
        parent.appendChild(makeEl(doc, 'code', null, m[1]))
      } else if (m[2] !== undefined) {
        var href = safeHref(m[3])
        if (!href) {
          addText(m[0])
          continue
        }
        var a = makeEl(doc, 'a', null, m[2])
        a.setAttribute('href', href)
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener noreferrer')
        parent.appendChild(a)
      } else if (m[4] !== undefined) {
        wrap('strong', m[4])
      } else if (m[5] !== undefined) {
        wrap('em', m[5])
      } else if (/\w/.test(m.index > 0 ? text.charAt(m.index - 1) : '')) {
        addText(m[0]) // snake_case_word, not emphasis
      } else {
        wrap('em', m[6])
      }
    }
    addText(text.slice(last))
  }

  function mdParagraph(doc, parent, lines) {
    var p = makeEl(doc, 'p')
    lines.forEach(function (line, idx) {
      if (idx) p.appendChild(doc.createElement('br'))
      mdInline(doc, p, line)
    })
    parent.appendChild(p)
  }

  function Markdown(text, opts) {
    var doc = resolveDoc(opts)
    var root = makeEl(doc, 'div', 'innfo-markdown')
    root.setAttribute('data-innfo-component', 'markdown')
    var lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')
    var i = 0
    function blank(l) {
      return !/\S/.test(l)
    }
    while (i < lines.length) {
      var line = lines[i]
      if (blank(line)) {
        i++
        continue
      }
      var hm = MD_HEADING.exec(line)
      if (hm) {
        var h = makeEl(doc, 'h' + hm[1].length, 'innfo-md-heading')
        mdInline(doc, h, hm[2])
        root.appendChild(h)
        i++
        continue
      }
      var lm = MD_LIST.exec(line)
      if (lm) {
        var ordered = /\d/.test(lm[1].charAt(0))
        var list = makeEl(doc, ordered ? 'ol' : 'ul')
        while (i < lines.length && (lm = MD_LIST.exec(lines[i])) && /\d/.test(lm[1].charAt(0)) === ordered) {
          var li = makeEl(doc, 'li')
          mdInline(doc, li, lm[2])
          list.appendChild(li)
          i++
        }
        root.appendChild(list)
        continue
      }
      var qm = MD_QUOTE.exec(line)
      if (qm) {
        var quoted = []
        while (i < lines.length && (qm = MD_QUOTE.exec(lines[i]))) {
          quoted.push(qm[1])
          i++
        }
        var bq = makeEl(doc, 'blockquote', 'innfo-md-quote')
        var co = /^\[!([A-Za-z]+)\]\s*$/.exec(quoted[0])
        if (co && MD_CALLOUTS.indexOf(co[1].toLowerCase()) !== -1) {
          bq.setAttribute('data-callout', co[1].toLowerCase())
          bq.appendChild(makeEl(doc, 'strong', 'innfo-md-callout-title', co[1].toUpperCase()))
          quoted.shift()
        }
        var group = []
        quoted.concat(['']).forEach(function (ql) {
          if (blank(ql)) {
            if (group.length) mdParagraph(doc, bq, group)
            group = []
          } else {
            group.push(ql)
          }
        })
        root.appendChild(bq)
        continue
      }
      var para = []
      while (
        i < lines.length &&
        !blank(lines[i]) &&
        !MD_HEADING.test(lines[i]) &&
        !MD_LIST.test(lines[i]) &&
        !MD_QUOTE.test(lines[i])
      ) {
        para.push(lines[i])
        i++
      }
      mdParagraph(doc, root, para)
    }
    return root
  }
  // ---- end Markdown ----

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
  // when the value should fall back to the plain Ku text (string, empty
  // select, etc.), so existing output is unchanged for the common case.
  //
  // FIELD_RENDERERS is keyed by the declared field type — the L1 set
  // (iNNfo_V_0-4-0 §Field Definition: string, select, reference, markdown_inline,
  // markdown_file, image, file, video, audio, url, knowledge, citation) plus the
  // legacy aliases older payloads still emit. reference/citation have no entry:
  // FieldRow resolves them to Ku / CitationIcon from data.ref and
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
    knowledge: renderFieldKnowledge,
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
    var node = Markdown(d.value, { doc: doc })
    node.className = 'innfo-markdown innfo-field-markdown'
    return node
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
    // Only a relative path or an http(s) URL may become a media src; anything else
    // (javascript:, data:, ...) falls back to the plain text value.
    if (!safeHref(src)) return null
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

  // A knowledge field names a model. The pill is clickable only when the caller
  // can bind it (opts.onKnowledge, and opts.isKnowledgeBound when given); an
  // unbound pill is inert.
  function renderFieldKnowledge(d, doc, opts) {
    var pill = renderFieldFile(d, doc)
    pill.setAttribute('data-field-type', 'knowledge')
    var raw = String(d.value == null ? '' : d.value)
    var bound =
      !!opts &&
      typeof opts.onKnowledge === 'function' &&
      (typeof opts.isKnowledgeBound !== 'function' || !!opts.isKnowledgeBound(raw))
    if (bound) {
      pill.setAttribute('data-knowledge-bound', 'true')
      pill.setAttribute('role', 'button')
      pill.setAttribute('tabindex', '0')
      pill.addEventListener('click', function (ev) {
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
        opts.onKnowledge(raw)
      })
      pill.addEventListener('keydown', function (ev) {
        if (ev && (ev.key === 'Enter' || ev.key === ' ')) {
          if (ev.preventDefault) ev.preventDefault()
          opts.onKnowledge(raw)
        }
      })
    }
    return pill
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
    if (typeof value === 'string' && /^https?:\/\//i.test(value) && type !== 'video' && type !== 'audio') {
      return renderFieldUrl(d, doc)
    }

    // 2. Declared-type renderer.
    var byType = FIELD_RENDERERS[type]
    if (byType) {
      var typed = byType(d, doc, opts)
      if (typed) return typed
    }

    // 3. Shape heuristics for values with no declared (or recognized) type.
    if (typeof value === 'string') {
      if (d.name !== 'sources' && looksLikeImageValue(value)) return renderFieldImage(d, doc)
      if (isAssetPath(value)) return renderFieldFile(d, doc)
    }
    return null
  }

  function fieldValueText(value) {
    if (value == null) return ''
    if (Array.isArray(value)) return value.map(String).join(', ')
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch (e) {
        return ''
      }
    }
    return String(value)
  }

  // A field VALUE on an element: one `value` knowledge unit. The field's
  // definition unit lives in the table header / concept section, never here.
  function FieldRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.FieldRow: data required')
    var doc = resolveDoc(opts)
    var hasRef = !!(data.ref && data.ref.id)
    var inherited = data.inherited && data.inherited.from ? data.inherited : null
    var model = data.model || (opts && (opts.modelId || opts.model)) || 'model'
    var element = data.element || (opts && opts.element) || data.elementId || 'unit'
    var valueNode = hasRef ? null : FieldValue(data, opts)
    if (!valueNode) {
      valueNode = makeEl(doc, 'span', 'innfo-ku-value-text', fieldValueText(data.value))
    }
    if (hasRef) {
      valueNode = makeEl(doc, 'span', 'innfo-ku-value-text')
      var refUnit = Ku(
        'element',
        {
          model: model,
          id: data.ref.id,
          label: data.ref.label || data.ref.id,
          concept: data.ref.concept,
          color: data.ref.color,
          index: data.ref.index,
        },
        { doc: doc },
      )
      if (opts && opts.onRef) {
        var refBadge = refUnit.querySelector('[data-innfo-component="ku-unit"]')
        if (refBadge) {
          refBadge.setAttribute('role', 'button')
          refBadge.setAttribute('tabindex', '0')
          refBadge.addEventListener('click', function () {
            opts.onRef(data.ref.id)
          })
        }
      }
      valueNode.appendChild(refUnit)
    }
    var label = inherited
      ? 'inherited from ' + inherited.from
      : String(data.name == null ? '' : data.name)
    var wrap = Ku(
      'value',
      {
        model: model,
        element: element,
        field: data.name,
        label: label,
        vtype: data.type,
        inherited: !!inherited,
        inheritedFrom: inherited ? inherited.from : undefined,
        concept: inherited ? inherited.from : undefined,
      },
      { doc: doc, valueNode: valueNode },
    )
    var badge = wrap.querySelector('[data-innfo-component="ku-unit"]')
    if (badge) {
      badge.setAttribute('data-field', String(data.name == null ? '' : data.name))
      if (inherited) {
        badge.setAttribute('data-ku-inherited', String(inherited.from))
        badge.setAttribute('aria-label', 'content, inherited from ' + inherited.from + ': ' + label)
      }
      var ftype = String(data.type || '').toLowerCase()
      if (
        ftype === 'markdown' ||
        ftype === 'markdown_inline' ||
        (typeof data.value === 'string' && data.value.length > 70)
      ) {
        badge.setAttribute('data-field-wide', 'true')
      }
    }
    if (Array.isArray(data.citations) && data.citations.length) {
      var seen = {}
      var variants = data.citations.map(originVariantOf)
      ;['error', 'agent', 'human', 'reviewer', 'document'].forEach(function (v) {
        if (seen[v]) return
        seen[v] = true
        if (variants.indexOf(v) === -1) return
        wrap.appendChild(
          CitationIcon({ variant: v, field: data.name }, {
            onOpen: opts && opts.onCite ? opts.onCite : undefined,
          }),
        )
      })
    }
    return wrap
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

  /* Shared identity thumb: the element's image if it declares one, otherwise a
     concept-icon placeholder. Reused by ElementCard and ElementMini so a
     knowledge unit's identity is rendered by a single code path. */
  function elementThumb(doc, data, conceptIconName, iconSize) {
    var imageField = imageFieldOf(Array.isArray(data.fields) ? data.fields : [])
    function makeConceptThumb() {
      var ph = makeEl(doc, 'span', 'innfo-card-thumb innfo-card-thumb--concept innfo-card-thumb--empty')
      ph.setAttribute('data-concept-icon', conceptIconName)
      ph.setAttribute('title', String(data.conceptId || 'Element'))
      ph.setAttribute('aria-hidden', 'true')
      ph.innerHTML = icon(conceptIconName, iconSize || 18)
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
      return thumb
    }
    return makeConceptThumb()
  }

  /* ElementPreview — a generic floating detail popover anchored to any trigger.
     It reveals a detail node (by default the full ElementCard) on hover, on focus
     and, when pinned, on click. The host is fixed-positioned so it escapes
     scrollable/overflow containers (e.g. a board column). Any compact
     representation (mini, pill, marker, timeline row) can reuse it. */
  var _previewHost = null
  function previewHostEl(doc) {
    if (_previewHost && _previewHost.ownerDocument === doc && _previewHost.parentNode) return _previewHost
    _previewHost = makeEl(doc, 'div', 'innfo-preview')
    _previewHost.setAttribute('data-innfo-component', 'element-preview')
    _previewHost.setAttribute('role', 'dialog')
    _previewHost.hidden = true
    ;(doc.body || doc.documentElement).appendChild(_previewHost)
    return _previewHost
  }
  function placePreview(host, anchor) {
    var doc = host.ownerDocument
    var r = anchor.getBoundingClientRect()
    host.hidden = false
    host.style.visibility = 'hidden'
    var w = host.offsetWidth || 0
    var h = host.offsetHeight || 0
    var vw = doc.documentElement.clientWidth
    var vh = doc.documentElement.clientHeight
    host.style.left = Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8)) + 'px'
    var top = r.bottom + 8
    if (top + h > vh - 8) top = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.max(8, vh - h - 8)
    host.style.top = top + 'px'
    host.style.visibility = ''
  }
  function ElementPreview(trigger, data, opts) {
    if (!trigger) return null
    var doc = resolveDoc(opts)
    var openDelay = opts && typeof opts.openDelay === 'number' ? opts.openDelay : 220
    var timer = null
    var pinned = false
    function buildContent() {
      if (opts && typeof opts.render === 'function') return opts.render(data)
      if (opts && opts.content) return opts.content
      return ElementCard(data, {
        doc: doc,
        byId: opts && opts.byId,
        concept: opts && opts.concept,
        collapsible: false,
        open: true,
      })
    }
    function open() {
      clearTimeout(timer)
      var host = previewHostEl(doc)
      host.innerHTML = ''
      host.appendChild(buildContent())
      placePreview(host, trigger)
      trigger.setAttribute('aria-expanded', 'true')
    }
    function close() {
      clearTimeout(timer)
      if (pinned) doc.removeEventListener('click', onDocClick, true)
      pinned = false
      if (_previewHost) {
        _previewHost.hidden = true
        _previewHost.innerHTML = ''
      }
      trigger.setAttribute('aria-expanded', 'false')
    }
    function schedule() {
      if (pinned) return
      clearTimeout(timer)
      timer = setTimeout(open, openDelay)
    }
    function onLeave() { if (!pinned) close() }
    function onKey(e) { if (e && e.key === 'Escape') close() }
    function onDocClick(e) {
      var t = e && e.target
      if (t && (trigger.contains(t) || (_previewHost && _previewHost.contains(t)))) return
      close()
    }
    trigger.addEventListener('mouseenter', schedule)
    trigger.addEventListener('mouseleave', onLeave)
    trigger.addEventListener('focus', schedule)
    trigger.addEventListener('blur', onLeave)
    trigger.addEventListener('keydown', onKey)
    return {
      open: open,
      close: close,
      togglePin: function () {
        if (pinned) { close() } else { pinned = true; doc.addEventListener('click', onDocClick, true); open() }
      },
      destroy: function () {
        close()
        trigger.removeEventListener('mouseenter', schedule)
        trigger.removeEventListener('mouseleave', onLeave)
        trigger.removeEventListener('focus', schedule)
        trigger.removeEventListener('blur', onLeave)
        trigger.removeEventListener('keydown', onKey)
      },
    }
  }

  /* ElementMini — the collection item: identity only (concept-color accent stripe
     + small thumb + name + one optional meta line), NEVER the field grid. This is
     the middle representation between Ku (inline token) and ElementCard
     (detail surface); it fits narrow board columns, related lists and search hits.
     With `opts.preview` it reveals the full ElementCard on hover/focus and, via a
     small info affordance, on click. */
  function ElementMini(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.ElementMini: data required')
    var doc = resolveDoc(opts)
    var tag = opts && opts.href ? 'a' : opts && opts.onSelect ? 'button' : 'div'
    var mini = makeEl(doc, tag, 'innfo-mini')
    mini.setAttribute('data-innfo-component', 'element-mini')
    mini.setAttribute('data-element-id', String(data.id == null ? '' : data.id))
    if (data.conceptId) mini.setAttribute('data-concept-id', String(data.conceptId))
    var conceptOpts = (opts && opts.concept) || {}
    var slot = conceptSlot({
      index: data.index != null ? data.index : conceptOpts.index,
      color: data.color || conceptOpts.color,
    })
    mini.setAttribute('data-concept-slot', String(slot))
    mini.style.setProperty('--innfo-mini-accent', 'var(--innfo-concept-' + slot + ')')
    if (opts && opts.domId) mini.setAttribute('id', String(opts.domId))
    if (tag === 'a' && opts && opts.href) mini.setAttribute('href', String(opts.href))
    if (tag === 'button') {
      mini.setAttribute('type', 'button')
      mini.addEventListener('click', function () {
        if (opts && opts.onSelect) opts.onSelect(data)
      })
    }
    var iconName = resolveConceptIconName(data.conceptId, conceptOpts)
    var thumb = elementThumb(doc, data, iconName, 18)
    thumb.classList.add('innfo-mini-thumb')
    mini.appendChild(thumb)
    var badgesWrap = makeEl(doc, 'div', 'innfo-card-badges')
    var miniModel = (opts && (opts.modelId || opts.model)) || data.modelId || data.model || 'model'
    var conceptId = data.concept || data.conceptId
    if (conceptId) {
      badgesWrap.appendChild(
        Ku('section', {
          model: miniModel,
          concept: conceptId,
          label: conceptId,
          index: conceptOpts.index,
          color: conceptOpts.color,
        }),
      )
    }
    badgesWrap.appendChild(
      Ku('element', {
        model: miniModel,
        id: data.id,
        label: data.name || data.id,
        index: conceptOpts.index,
        color: conceptOpts.color,
      }),
    )
    mini.appendChild(badgesWrap)
    if (data.meta) {
      var metaEl = makeEl(doc, 'span', 'innfo-mini-meta', String(data.meta))
      mini.appendChild(metaEl)
    }
    if (data.status) {
      var st = makeEl(doc, 'span', 'innfo-card-status-pill')
      st.setAttribute('data-status', String(data.status).toLowerCase())
      st.appendChild(doc.createTextNode(String(data.status)))
      mini.appendChild(st)
    }
    if (opts && opts.preview) {
      var previewOpts = typeof opts.preview === 'object' && opts.preview !== null ? opts.preview : {}
      var ctl = ElementPreview(mini, data, {
        doc: doc,
        concept: conceptOpts,
        byId: opts && opts.byId,
        render: previewOpts.render,
        content: previewOpts.content,
        openDelay: previewOpts.openDelay,
      })
      // Info affordance for touch/keyboard. Only on a non-interactive container:
      // nesting a button inside a link/button is invalid.
      if (previewOpts.affordance !== false && tag === 'div') {
        var info = makeEl(doc, 'button', 'innfo-mini-info')
        info.setAttribute('type', 'button')
        info.setAttribute('data-innfo-component', 'mini-info')
        info.setAttribute('aria-label', 'Show details')
        info.setAttribute('aria-expanded', 'false')
        info.innerHTML = icon('info', 13)
        info.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation()
          if (ctl) ctl.togglePin()
          var host = doc.querySelector('[data-innfo-component=element-preview]')
          info.setAttribute('aria-expanded', host && !host.hidden ? 'true' : 'false')
        })
        mini.appendChild(info)
      }
    }
    return mini
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
    var collapsible = !(opts && opts.collapsible === false)
    var byId = (opts && opts.byId) || {}

    var head = makeEl(doc, 'header', 'innfo-card-head')

    var conceptOpts = (opts && opts.concept) || {}
    if (data.conceptId || conceptOpts.index != null || conceptOpts.color) {
      card.setAttribute('data-concept-slot', String(conceptSlot(conceptOpts)))
    }
    var conceptIconName = resolveConceptIconName(data.conceptId, conceptOpts)

    head.appendChild(elementThumb(doc, data, conceptIconName, 18))
    var badgesWrap = makeEl(doc, 'div', 'innfo-card-badges')
    var unitModel = (opts && (opts.modelId || opts.model)) || data.modelId || data.model || 'model'
    var conceptId = data.concept || data.conceptId
    if (conceptId) {
      badgesWrap.appendChild(
        Ku('section', {
          model: unitModel,
          concept: conceptId,
          label: conceptId,
          index: conceptOpts.index,
          color: conceptOpts.color,
        }),
      )
    }
    badgesWrap.appendChild(
      Ku('element', {
        model: unitModel,
        id: data.id,
        label: data.name || data.id,
        index: conceptOpts.index,
        color: conceptOpts.color,
      }),
    )
    head.appendChild(badgesWrap)

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

    if (summaryField) {
      var sumPrev = makeEl(doc, 'span', 'innfo-card-summary-preview', summaryField)
      sumPrev.setAttribute('title', summaryField)
      head.appendChild(sumPrev)
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
      if (open) mountBody()
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

    var lazy = opts && opts.lazy === true
    var bodyMounted = false
    function mountBody() {
      if (bodyMounted) return
      bodyMounted = true

      var body = makeEl(doc, 'section', 'innfo-card-body')
      // Model views show no change signal except the Unsent marker (added by the
      // review controller from the draft store). The applied history stays in the
      // card's Lineage tab, never as a meta-strip pill.
      if (data.description) body.appendChild(makeEl(doc, 'p', 'innfo-card-desc', data.description))
      if (bodyFields.length) {
        var fieldRow = makeEl(doc, 'div', 'innfo-card-fields')
        var inherited = data.inherited && typeof data.inherited === 'object' ? data.inherited : {}
        bodyFields.forEach(function (fr) {
          var inheritedInfo = fr && fr.inherited ? fr.inherited : inherited[fr && fr.name]
          fieldRow.appendChild(
            FieldRow(
              {
                name: fr.name,
                value: fr.value,
                type: fr.type,
                ref: fr.ref,
                citations: fr.citations,
                model: unitModel,
                element: data.id,
                inherited: inheritedInfo,
              },
              {
                onRef: opts && opts.onRef,
                onCite: opts && opts.onCite,
                onKnowledge: opts && opts.onKnowledge,
                isKnowledgeBound: opts && opts.isKnowledgeBound,
              },
            ),
          )
        })
        body.appendChild(fieldRow)
      }
      if (Array.isArray(opts && opts.body)) {
        ;(opts.body || []).forEach(function (n) {
          if (n) body.appendChild(n)
        })
      }
      // No tag row without tags (the review controller adds its own for "+ tag").
      var tags = Array.isArray(data.tags) ? data.tags : []
      if (tags.length) body.appendChild(TagRow({ tags: tags }, { doc: doc, onTag: opts && opts.onTag }))
      if (relations && relations.length) {
        var outWrap = makeEl(doc, 'div', 'innfo-card-outgoing')
        outWrap.appendChild(
          makeEl(doc, 'span', 'innfo-card-outgoing-label', 'Outgoing relations (' + relations.length + ')'),
        )
        outWrap.appendChild(RelList({ relations: relations, byId: byId, model: unitModel }, { doc: doc }))
        body.appendChild(outWrap)
      }
      var incoming = Array.isArray(data.incomingRelations) ? data.incomingRelations : null
      if (incoming && incoming.length) {
        var incWrap = makeEl(doc, 'div', 'innfo-card-incoming')
        incWrap.appendChild(
          makeEl(doc, 'span', 'innfo-card-incoming-label', 'Incoming relations (' + incoming.length + ')'),
        )
        incWrap.appendChild(RelList({ relations: incoming, byId: byId, model: unitModel }, { doc: doc }))
        body.appendChild(incWrap)
      }
      card.appendChild(body)
      if (data.path) {
        var cardFooter = makeEl(doc, 'footer', 'innfo-card-footer')
        if (data.path) cardFooter.appendChild(makeEl(doc, 'span', 'innfo-card-path', data.path))
        card.appendChild(cardFooter)
      }
      var win = doc && (doc.defaultView || (doc.ownerDocument && doc.ownerDocument.defaultView))
      var CustomEv = (win && win.CustomEvent) || (typeof CustomEvent !== 'undefined' ? CustomEvent : null)
      if (CustomEv && typeof doc.dispatchEvent === 'function') {
        try {
          doc.dispatchEvent(new CustomEv('innfo:rendered', { detail: { root: card } }))
        } catch (_) {}
      }
    }

    card.setOpen = setOpen
    card.__mountBody = mountBody

    if (open || !lazy) {
      mountBody()
    }
    return card
  }

  // ---- Change cards (one anatomy for unsent and applied history) ----

  /** Splits a D5 address `model@element&field` into its element and field parts. */
  function cardTargetParts(target) {
    var t = String(target || '')
    var at = t.indexOf('@')
    var rest = at === -1 ? t : t.slice(at + 1)
    var segs = rest.split('&')
    return { element: (segs[0] || '').trim(), field: (segs[1] || '').trim() }
  }

  /** Human-language title for a change op (provisional copy, [P]). */
  function cardTitle(op, entry) {
    var e = entry || {}
    var parts = cardTargetParts(e.target)
    var element = e.element || parts.element
    var field = e.field || parts.field
    switch (op) {
      case 'update_field':
        return 'Edit `' + (field || 'field') + '` of `' + (element || 'element') + '`'
      case 'update_matrix_cell':
        return 'Edit cell `' + (e.row || '') + '` \u00d7 `' + (e.col || '') + '`'
      case 'add_element':
        return 'Add element `' + (e.name || element || '') + '`'
      case 'remove_element':
        return 'Delete `' + (element || e.name || '') + '`'
      case 'rename_element':
        return 'Rename `' + (element || '') + '`'
      case 'rename_concept':
        return 'Rename concept `' + (e.concept || '') + '`'
      case 'comment':
        return 'Comment on `' + (element || '') + '`'
      default:
        return String(op || 'Change')
    }
  }

  /** The `previous -> new` line; add shows the fields, delete the element name. */
  function cardDiff(op, entry) {
    var e = entry || {}
    if (op === 'add_element') {
      var fields = e.fields && typeof e.fields === 'object' ? e.fields : e.proposed
      if (fields && typeof fields === 'object') {
        return Object.keys(fields)
          .map(function (k) {
            return k + ': ' + String(fields[k])
          })
          .join(', ')
      }
      return e.element || e.name || ''
    }
    if (op === 'remove_element' || op === 'rename_element' || op === 'rename_concept') {
      return String(e.from != null ? e.from : e.element || e.name || '')
    }
    if (op === 'comment') return ''
    var from = e.from != null ? e.from : e.original
    var to = e.to != null ? e.to : e.proposed
    if (from == null && to == null) return ''
    return String(from == null ? '' : from) + ' \u2192 ' + String(to == null ? '' : to)
  }

  function changeCard(state, opts) {
    var doc = (opts && opts.doc) || resolveDoc(opts)
    var s = state || {}
    var li = makeEl(doc, 'li', 'innfo-change-card card bg-base-100 border border-base-200 shadow-xs')
    li.setAttribute('data-innfo-component', 'change-card')
    li.setAttribute('data-change-state', s.stateKind || 'unsent')
    if (s.draftId) li.setAttribute('data-draft-id', String(s.draftId))
    if (s.targetChanged) li.setAttribute('data-target-changed', 'true')

    var body = makeEl(doc, 'div', 'innfo-change-card-body card-body p-4 flex flex-col gap-2')

    var head = makeEl(doc, 'div', 'innfo-change-card-head flex items-center justify-between gap-3')
    head.appendChild(makeEl(doc, 'span', 'innfo-change-card-title font-semibold text-sm', s.title || ''))
    if (s.stateKind === 'unsent' && typeof StatusBadge === 'function') {
      var badge = StatusBadge({ status: 'local', label: COPY.unsent })
      badge.classList.add('innfo-change-card-badge')
      head.appendChild(badge)
    } else {
      var stateEl = makeEl(doc, 'span', 'innfo-change-card-state text-xs font-semibold', s.stateText || '')
      if (s.stateKind === 'applied') stateEl.setAttribute('title', COPY.appliedHelp)
      head.appendChild(stateEl)
    }
    body.appendChild(head)

    if (s.targetNode) {
      var targetWrap = makeEl(doc, 'div', 'innfo-change-card-target inline-flex items-center gap-1.5 flex-wrap text-sm')
      targetWrap.appendChild(s.targetNode)
      body.appendChild(targetWrap)
    }

    if (s.diff) body.appendChild(makeEl(doc, 'div', 'innfo-change-card-diff text-sm', s.diff))

    var context = [s.author, s.date, s.stateText].filter(Boolean).join(' \u00b7 ')
    body.appendChild(makeEl(doc, 'div', 'innfo-change-card-context text-xs opacity-70', context))

    if (s.note) body.appendChild(makeEl(doc, 'p', 'innfo-change-card-note text-sm', s.note))
    if (s.resolution) body.appendChild(makeEl(doc, 'p', 'innfo-change-card-resolution text-xs', s.resolution))
    if (s.sources) {
      var sourceList = Array.isArray(s.sources) ? s.sources : [s.sources]
      sourceList.forEach(function (src) {
        if (src == null || src === '') return
        var srcText = String(src)
        var srcEl = makeEl(doc, 'span', 'innfo-change-card-source text-xs inline-flex items-center gap-1', srcText)
        // A citation icon only exists when the host can open it: never a dead control.
        if (opts && typeof opts.onCitation === 'function') {
          srcEl.appendChild(
            CitationIcon(
              { variant: 'document', field: srcText },
              {
                doc: doc,
                onOpen: function () {
                  opts.onCitation(srcText)
                },
              },
            ),
          )
        }
        body.appendChild(srcEl)
      })
    }

    if (s.targetChanged) {
      body.appendChild(makeEl(doc, 'span', 'innfo-change-card-stale text-xs', 'target changed'))
    }

    var actions = makeEl(doc, 'div', 'innfo-change-card-actions flex items-center gap-2')
    if (s.elementId && opts && typeof opts.onGoTo === 'function') {
      var go = makeEl(doc, 'button', 'innfo-change-goto btn btn-sm btn-ghost', COPY.goToElement)
      go.setAttribute('type', 'button')
      go.addEventListener('click', function () {
        opts.onGoTo(s.elementId)
      })
      actions.appendChild(go)
    }
    if (s.revertable && opts && typeof opts.onRevert === 'function') {
      var rev = makeEl(doc, 'button', 'innfo-change-revert btn btn-sm btn-ghost', COPY.revert)
      rev.setAttribute('type', 'button')
      rev.addEventListener('click', function () {
        opts.onRevert(s.entry)
      })
      actions.appendChild(rev)
    }
    if (s.draftId && opts && typeof opts.onDiscard === 'function') {
      var dis = makeEl(doc, 'button', 'innfo-change-discard btn btn-sm btn-ghost text-error', COPY.discard)
      dis.setAttribute('type', 'button')
      dis.addEventListener('click', function () {
        opts.onDiscard(s.draftId)
      })
      actions.appendChild(dis)
    }
    if (actions.children.length) body.appendChild(actions)

    li.appendChild(body)
    return li
  }

  function draftOp(d) {
    if (d.matrix != null && d.matrix !== '') return 'update_matrix_cell'
    var canUpdate = !!d.field && d.proposed !== undefined
    if (canUpdate && String(d.field).toLowerCase() === 'name') return 'rename_element'
    if (d.kind === 'delete') return 'remove_element'
    if (d.kind === 'new') return d.concept && d.element ? 'add_element' : 'comment'
    if (d.kind === 'comment' || !canUpdate) return 'comment'
    return 'update_field'
  }

  function DraftList(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.DraftList: data required')
    var doc = resolveDoc(opts)
    var drafts = Array.isArray(data.drafts) ? data.drafts : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'innfo-draft-list innfo-change-list flex flex-col gap-3 list-none p-0 m-0')
    ul.setAttribute('data-innfo-component', 'draft-list')
    drafts.forEach(function (d) {
      if (!d || typeof d !== 'object') return
      var el = byId[String(d.element_id)]
      // The host passes the review module's staleness rule; the kit has no dependency on it.
      var changed =
        opts && typeof opts.isTargetChanged === 'function'
          ? opts.isTargetChanged(d, byId)
          : !el || el.hash !== d.base_hash
      var op = draftOp(d)
      var elementName = (el && el.name) || d.element || d.element_id || ''
      // Target chips are knowledge units built by Ku, keyed by canonical address
      // (the published console-ui-kit contract, kept).
      var targetConcept = d.concept || (el && el.concept) || null
      var draftModel = (opts && (opts.modelId || opts.model)) || d.model || (el && el.modelId) || 'model'
      var targetNode = makeEl(doc, 'span', 'innfo-draft-target inline-flex items-center gap-1.5')
      if (targetConcept) {
        targetNode.appendChild(
          Ku(
            'section',
            {
              model: draftModel,
              concept: targetConcept,
              label: targetConcept,
              index: el && el._conceptIndex != null ? el._conceptIndex : 0,
              color: el && el._conceptColor,
            },
            { doc: doc },
          ),
        )
      }
      var unitKind = d.field ? 'value' : 'element'
      targetNode.appendChild(
        Ku(
          unitKind,
          {
            address: d.address || undefined,
            model: draftModel,
            element: d.element_id || elementName,
            field: d.field || undefined,
            id: d.element_id || elementName,
            label: elementName,
            concept: targetConcept,
            color: el && el._conceptColor,
            index: el && el._conceptIndex,
          },
          { doc: doc },
        ),
      )
      if (d.field) {
        var arrowSpan = makeEl(doc, 'span', 'innfo-draft-arrow text-xs opacity-60', '\u2192')
        arrowSpan.setAttribute('aria-hidden', 'true')
        targetNode.appendChild(arrowSpan)
        targetNode.appendChild(
          Ku(
            'field',
            {
              family: draftModel,
              model: draftModel,
              concept: targetConcept || 'relations',
              name: d.field,
              label: '~ ' + d.field,
            },
            { doc: doc },
          ),
        )
      }
      ul.appendChild(
        changeCard(
          {
            draftId: d.id,
            op: op,
            title: cardTitle(op, d),
            diff: cardDiff(op, d),
            targetNode: targetNode,
            author: d.author,
            date: d.created_at,
            stateKind: 'unsent',
            stateText: COPY.unsent,
            note: d.comment != null ? d.comment : '',
            sources: d.sources,
            elementId: d.element_id || elementName,
            targetChanged: changed,
          },
          {
            doc: doc,
            onDiscard:
              opts && typeof opts.onDelete === 'function'
                ? function (id) {
                    opts.onDelete(id)
                  }
                : null,
            onGoTo: opts && typeof opts.onGoTo === 'function' ? opts.onGoTo : null,
            onCitation: opts && typeof opts.onCitation === 'function' ? opts.onCitation : null,
          },
        ),
      )
    })
    return ul
  }

  // Renders the payload `changes` collection: one card per applied block (with
  // Revert for an `update_field`) and one muted card per not-applied block, with
  // the engine's reason. Holds no state, reads no storage.
  function ChangeHistory(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.ChangeHistory: data required')
    var doc = resolveDoc(opts)
    var changesets = Array.isArray(data.changes) ? data.changes : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'innfo-change-history flex flex-col gap-3 list-none p-0 m-0')
    ul.setAttribute('data-innfo-component', 'change-history')
    changesets.forEach(function (cs) {
      var items = Array.isArray(cs && cs.changes) ? cs.changes : []
      items.forEach(function (c) {
        if (!c || typeof c !== 'object') return
        var status = c.status || (cs && cs.status)
        if (status !== 'applied' && status !== 'conflict' && status !== 'rejected') return
        var applied = status === 'applied'
        var op = c.op
        var parts = cardTargetParts(c.target)
        var elementName = parts.element
        var el = byId[elementName] || byId[c.element_id]
        ul.appendChild(
          changeCard(
            {
              op: op,
              entry: c,
              title: cardTitle(op, el && el.name ? Object.assign({}, c, { element: el.name }) : c),
              diff: cardDiff(op, c),
              author: c.author || (cs && cs.author),
              date: cs && cs.appliedAt,
              stateKind: applied ? 'applied' : 'not-applied',
              stateText: applied ? COPY.applied : COPY.notApplied,
              note: c.notes,
              resolution: applied ? '' : c.resolution || (cs && cs.resolution),
              sources: c.sources,
              elementId: elementName || (el && el.id),
              revertable: applied && op === 'update_field',
            },
            {
              doc: doc,
              onRevert: opts && typeof opts.onRevert === 'function' ? opts.onRevert : null,
              onGoTo: opts && typeof opts.onGoTo === 'function' ? opts.onGoTo : null,
              onCitation: opts && typeof opts.onCitation === 'function' ? opts.onCitation : null,
            },
          ),
        )
      })
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

  // A long or multi-line string has no single-line editor: it is edited in a
  // textarea and proposed verbatim (Edit Modal Value Type Safety, S3b P0-2).
  function FieldStringWidget(value, opts) {
    var str = value == null ? '' : String(value)
    if (str.indexOf('\n') !== -1 || str.length > 70) {
      var doc = resolveDoc(opts)
      var ta = makeEl(doc, 'textarea', 'innfo-edit-textarea')
      ta.setAttribute('data-innfo-widget', 'string')
      ta.setAttribute('rows', '4')
      ta.value = str
      return ta
    }
    var inp = FieldInput('text', value, opts)
    inp.setAttribute('data-innfo-widget', 'string')
    return inp
  }

  function FieldNumberWidget(value, opts) {
    var inp = FieldInput('number', value, opts)
    inp.setAttribute('data-innfo-widget', 'number')
    return inp
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

  // A select never loses the value it edits: it always carries a blank option,
  // and when the current value is not among the declared options one extra
  // option carrying it is added (marked) and selected, so an unchanged save
  // proposes the original value (Edit Modal Value Type Safety, S3b P0-2).
  function FieldSelectWidget(value, options, opts) {
    var doc = resolveDoc(opts)
    var select = makeEl(doc, 'select', 'innfo-edit-select')
    select.setAttribute('data-innfo-widget', 'select')
    var list = Array.isArray(options) ? options : []
    var current = value == null ? '' : String(value)
    var blank = makeEl(doc, 'option', null, '')
    blank.value = ''
    if (current === '') blank.selected = true
    select.appendChild(blank)
    var found = false
    list.forEach(function (opt) {
      var op = makeEl(doc, 'option', null, opt)
      op.value = String(opt)
      if (String(opt) === current) {
        op.selected = true
        found = true
      }
      select.appendChild(op)
    })
    if (!found && current !== '') {
      var extra = makeEl(doc, 'option', null, current)
      extra.value = current
      extra.selected = true
      extra.setAttribute('data-not-in-options', 'true')
      select.appendChild(extra)
    }
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

  // Candidates are the elements the caller allows. The datalist offers display
  // names; the proposal is always the exact reference grammar `[[Display Name]]`
  // (see refProposal), never a slug.
  function FieldReferenceWidget(value, candidates, opts) {
    var doc = resolveDoc(opts)
    var wrap = makeEl(doc, 'div', 'innfo-edit-reference')
    wrap.setAttribute('data-innfo-widget', 'reference')
    var input = makeEl(doc, 'input', 'innfo-edit-input')
    input.setAttribute('type', 'text')
    input.setAttribute('placeholder', 'Element name, e.g. [[Display Name]]')
    if (value != null) input.value = String(value)
    wrap.appendChild(input)

    var datalistId = 'innfo-ref-list-' + Math.random().toString(36).slice(2, 8)
    input.setAttribute('list', datalistId)
    var dl = makeEl(doc, 'datalist')
    dl.id = datalistId
    var list = Array.isArray(candidates) ? candidates : []
    list.forEach(function (c) {
      var label = typeof c === 'string' ? c : c && (c.name || c.id)
      if (!label) return
      var op = makeEl(doc, 'option')
      op.value = String(label)
      op.textContent = c && typeof c === 'object' && c.concept ? label + ' (' + c.concept + ')' : String(label)
      dl.appendChild(op)
    })
    wrap.appendChild(dl)
    return wrap
  }

  // `[[Name]]` stays as is, a bare name is wrapped, blank stays blank.
  function refProposal(raw) {
    var v = String(raw == null ? '' : raw).trim()
    if (!v) return ''
    return /^\[\[[^\]]*\]\]$/.test(v) ? v : '[[' + v + ']]'
  }

  // The display name a typed reference resolves to among the candidates
  // (case-insensitive), or null: an unknown name or one holding a bracket is not a
  // valid reference target.
  function refCandidateName(raw, candidates) {
    var v = String(raw == null ? '' : raw).trim()
    var m = /^\[\[([^\]]*)\]\]$/.exec(v)
    var name = (m ? m[1] : v).trim()
    if (!name || /[\[\]]/.test(name)) return null
    var want = name.toLowerCase()
    var list = Array.isArray(candidates) ? candidates : []
    for (var i = 0; i < list.length; i++) {
      var c = list[i]
      var label = typeof c === 'string' ? c : c && (c.name || c.id)
      if (label && String(label).toLowerCase() === want) return String(label)
    }
    return null
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

    // A structure edit is a different ACT: it proposes against the bluepriNNt (and is
    // comment-only today). Warn HERE, at the moment of the action, instead of hiding
    // the pencil behind a switch you must remember to turn on.
    if (data.structure === true) {
      var structureWarn = makeEl(doc, 'div', 'innfo-edit-warn')
      structureWarn.setAttribute('role', 'alert')
      var warnIcon = makeEl(doc, 'span', 'innfo-edit-warn-icon')
      warnIcon.setAttribute('aria-hidden', 'true')
      warnIcon.innerHTML = icon('cite-error', 16)
      structureWarn.appendChild(warnIcon)
      var warnText = makeEl(doc, 'span')
      warnText.innerHTML =
        '<strong>Attention: you are proposing a STRUCTURE change</strong>' +
        'You are proposing a change to the <b>structure</b> of this domain (the bluepriNNt), not to its data. ' +
        'It affects every element that uses it, and today it is filed as a <b>comment</b> for the blueprint ' +
        'maintainer: it will not be applied automatically.'
      structureWarn.appendChild(warnText)
      modal.appendChild(structureWarn)
    }

    // (C) banner: a proposal that cannot be APPLIED (no base_hash precondition) warns
    // here instead of the affordance being hidden.
    if (!data.structure && data.warning) {
      var cannotApply = makeEl(doc, 'div', 'innfo-edit-warn')
      cannotApply.setAttribute('role', 'alert')
      var caIcon = makeEl(doc, 'span', 'innfo-edit-warn-icon')
      caIcon.setAttribute('aria-hidden', 'true')
      caIcon.innerHTML = icon('cite-error', 16)
      cannotApply.appendChild(caIcon)
      cannotApply.appendChild(makeEl(doc, 'span', data.warning))
      modal.appendChild(cannotApply)
    }

    // Who is proposing. The identity is remembered (localStorage) and required at
    // export; showing it here is the just-in-time half, so several reviewers do not
    // silently collapse into the default pseudonym.
    if (data.reviewer && String(data.reviewer).trim()) {
      var proposeAs = makeEl(doc, 'div', 'innfo-propose-as')
      proposeAs.textContent = 'Proposing as ' + String(data.reviewer)
      if (data.reviewer === 'reviewer') {
        proposeAs.textContent = 'Proposing as "reviewer" (default) - set your identifier'
        proposeAs.setAttribute('data-default', 'true')
      }
      modal.appendChild(proposeAs)
    }

    // Unified Modal Navigation: Tabs (Edit vs Lineage)
    var navTabs = makeEl(doc, 'div', 'innfo-modal-tabs')
    var tabBtnEdit = makeEl(doc, 'button', 'innfo-modal-tab-btn active', 'Edit')
    tabBtnEdit.setAttribute('type', 'button')
    var tabBtnHistory = makeEl(doc, 'button', 'innfo-modal-tab-btn', 'Lineage')
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
    // toggle is not offered. A list/object value keeps the toggle visible but
    // disables Propose: there is no list editor, only a comment (S3b P0-2).
    var commentOnly = Boolean(data.commentOnly)
    var valueIsContainer =
      Boolean(data.valueCommentOnly) || (data.value !== null && typeof data.value === 'object')
    var isComment = commentOnly || valueIsContainer || Boolean(data.isComment)
    var btnPropose = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (!isComment ? ' active' : ''), 'Propose value')
    var btnComment = makeEl(doc, 'button', 'innfo-edit-mode-btn' + (isComment ? ' active' : ''), 'Comment')
    btnPropose.setAttribute('type', 'button')
    btnComment.setAttribute('type', 'button')
    modeWrap.appendChild(btnPropose)
    modeWrap.appendChild(btnComment)
    if (!commentOnly) panelEdit.appendChild(modeWrap)
    if (valueIsContainer) {
      btnPropose.disabled = true
      btnPropose.setAttribute('aria-disabled', 'true')
      panelEdit.appendChild(
        makeEl(doc, 'p', 'innfo-edit-note', 'List and object values are proposed as a comment.'),
      )
    }

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
      if (valueIsContainer) return
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

    if (valueIsContainer) {
      // No value editor: a list or object is proposed as a comment only, never
      // String()-coerced into a text control (S3b P0-2).
      widgetRef = null
    } else if (fieldType === 'number') {
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
    if (widgetRef) fieldsContainer.appendChild(widgetRef)
    formPropose.appendChild(fieldsContainer)

    panelEdit.appendChild(formPropose)
    panelEdit.appendChild(formComment)
    modal.appendChild(panelEdit)

    // Panel 2: Lineage
    var panelHistory = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-history-modal-body')
    panelHistory.setAttribute('data-tab', 'history')
    panelHistory.style.display = 'none'

    // History section
    var histSection = makeEl(doc, 'div', 'innfo-history-section')
    histSection.appendChild(makeEl(doc, 'h3', 'innfo-history-title', 'History'))
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

    // Citations section
    var citeSection = makeEl(doc, 'div', 'innfo-history-section')
    citeSection.appendChild(makeEl(doc, 'h3', 'innfo-history-title', 'Citations'))
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
        if (fieldType === 'number') {
          var raw = widgetRef ? widgetRef.value : ''
          var num = Number(raw)
          if (String(raw).trim() === '' || !isFinite(num)) {
            saveError.textContent = 'Enter a valid number.'
            saveError.style.display = 'block'
            return
          }
          result.proposed = num
        } else if (fieldType === 'boolean') {
          var cb = widgetRef.querySelector('input[type="checkbox"]')
          result.proposed = cb ? cb.checked : false
        } else if (fieldType === 'multiselect') {
          var checkedBoxes = widgetRef.querySelectorAll('input[type="checkbox"]:checked')
          result.proposed = Array.prototype.map.call(checkedBoxes, function (b) { return b.value })
        } else if (fieldType === 'reference') {
          var refInp = widgetRef.querySelector('input')
          var refRaw = refInp ? refInp.value : ''
          // Unchanged input proposes the original value as is.
          if (refRaw === String(data.value == null ? '' : data.value) || String(refRaw).trim() === '') {
            result.proposed = refRaw === String(data.value == null ? '' : data.value) ? refRaw : refProposal(refRaw)
          } else {
            var refName = refCandidateName(refRaw, data.candidates)
            if (refName === null) {
              saveError.textContent = 'Pick an existing element name; brackets are not allowed.'
              saveError.style.display = 'block'
              return
            }
            result.proposed = '[[' + refName + ']]'
          }
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

  // New element: concept picker, a name, and one widget per field the schema
  // declares on the picked concept. Built on the same dialog shell and widgets as
  // EditModal. onSave receives { concept, name, fields } where fields holds only
  // the filled values (a blank input is not a value).
  function NewElementModal(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('InnfoUI.NewElementModal: data required')
    var doc = resolveDoc(opts)
    var concepts = Array.isArray(data.concepts) ? data.concepts : []
    var modal = makeEl(doc, 'dialog', 'innfo-edit-modal')
    modal.setAttribute('data-innfo-component', 'new-element-modal')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')

    function dismiss() {
      if (typeof modal.close === 'function') modal.close()
      else modal.removeAttribute('open')
    }
    function cancel() {
      dismiss()
      if (opts && typeof opts.onCancel === 'function') opts.onCancel()
    }

    var head = makeEl(doc, 'div', 'innfo-edit-modal-head')
    head.appendChild(makeEl(doc, 'h2', null, data.title || 'New element'))
    var closeBtn = makeEl(doc, 'button', 'innfo-edit-modal-close', '\u00D7')
    closeBtn.setAttribute('type', 'button')
    closeBtn.addEventListener('click', cancel)
    head.appendChild(closeBtn)
    modal.appendChild(head)

    var body = makeEl(doc, 'div', 'innfo-modal-tab-panel innfo-edit-modal-body')

    var conceptLabel = makeEl(doc, 'label', 'innfo-edit-field-label', 'Concept')
    var picker = makeEl(doc, 'select', 'innfo-edit-select')
    picker.setAttribute('data-innfo-role', 'concept')
    picker.appendChild(makeEl(doc, 'option', null, ''))
    picker.firstChild.value = ''
    concepts.forEach(function (c) {
      var op = makeEl(doc, 'option', null, c.name)
      op.value = String(c.name)
      picker.appendChild(op)
    })
    // Model picker: only when the console holds several models. A model-scoped
    // console has exactly one, so the draft targets it without asking.
    var models = Array.isArray(data.models)
      ? data.models.filter(function (m) {
          return m && m.id
        })
      : []
    var modelPicker = null
    if (models.length > 1) {
      modelPicker = makeEl(doc, 'select', 'innfo-edit-select')
      modelPicker.setAttribute('data-innfo-role', 'model')
      models.forEach(function (m) {
        var mo = makeEl(doc, 'option', null, m.title || m.id)
        mo.value = String(m.id)
        modelPicker.appendChild(mo)
      })
      var preset = models.filter(function (m) {
        return String(m.id) === String(data.defaultModel)
      })[0]
      if (preset) modelPicker.value = String(preset.id)
      body.appendChild(makeEl(doc, 'label', 'innfo-edit-field-label', 'Model'))
      body.appendChild(modelPicker)
    }
    body.appendChild(conceptLabel)
    body.appendChild(picker)

    var nameLabel = makeEl(doc, 'label', 'innfo-edit-field-label', 'Name')
    var nameInput = FieldInput('text', '', opts)
    nameInput.setAttribute('data-innfo-role', 'name')
    body.appendChild(nameLabel)
    body.appendChild(nameInput)

    var fieldsHost = makeEl(doc, 'div', 'innfo-edit-fields')
    body.appendChild(fieldsHost)
    modal.appendChild(body)

    // [{ name, type, node }] for the currently picked concept.
    var current = []

    function widgetFor(def) {
      var type = def.type || 'string'
      var node
      if (type === 'number') node = FieldNumberWidget('', opts)
      else if (type === 'boolean') node = FieldBooleanWidget(false, opts)
      else if (type === 'select') node = FieldSelectWidget('', def.options, opts)
      else if (type === 'multiselect') node = FieldMultiSelectWidget([], def.options, opts)
      else if (type === 'reference') node = FieldReferenceWidget('', data.candidates, opts)
      else if (type === 'markdown' || type === 'markdown_inline') node = FieldMarkdownWidget('', opts)
      else node = FieldStringWidget('', opts)
      node.setAttribute('data-innfo-field', def.name)
      return { name: def.name, type: type, node: node }
    }

    // The filled value of one widget, or undefined when it is blank.
    function valueOf(w) {
      var node = w.node
      if (w.type === 'boolean') {
        var cb = node.querySelector('input[type="checkbox"]')
        return cb && cb.checked ? true : undefined
      }
      if (w.type === 'multiselect') {
        var boxes = node.querySelectorAll('input[type="checkbox"]:checked')
        var picked = Array.prototype.map.call(boxes, function (b) {
          return b.value
        })
        return picked.length ? picked : undefined
      }
      if (w.type === 'reference') {
        var ref = node.querySelector('input')
        return ref && String(ref.value).trim() !== '' ? ref.value : undefined
      }
      var raw = String(node.value == null ? '' : node.value)
      if (raw.trim() === '') return undefined
      if (w.type === 'number') {
        var num = Number(raw)
        return isFinite(num) ? num : undefined
      }
      return raw
    }

    function renderFields() {
      fieldsHost.innerHTML = ''
      current = []
      var chosen = concepts.filter(function (c) {
        return c.name === picker.value
      })[0]
      if (!chosen) return
      var defs = Array.isArray(chosen.fields) ? chosen.fields : []
      defs.forEach(function (def) {
        if (!def || !def.name) return
        var w = widgetFor(def)
        current.push(w)
        fieldsHost.appendChild(makeEl(doc, 'label', 'innfo-edit-field-label', def.name))
        fieldsHost.appendChild(w.node)
      })
    }
    picker.addEventListener('change', renderFields)

    var saveError = makeEl(doc, 'p', 'innfo-edit-error')
    saveError.setAttribute('role', 'alert')
    saveError.style.display = 'none'
    modal.appendChild(saveError)

    var actions = makeEl(doc, 'div', 'innfo-edit-modal-actions')
    var saveBtn = makeEl(doc, 'button', 'innfo-edit-btn innfo-edit-btn-save', 'Save draft')
    saveBtn.setAttribute('type', 'button')
    saveBtn.addEventListener('click', function () {
      var name = String(nameInput.value == null ? '' : nameInput.value).trim()
      if (!picker.value) {
        saveError.textContent = 'Pick a concept before saving.'
        saveError.style.display = 'block'
        return
      }
      if (!name) {
        saveError.textContent = 'Enter a name before saving.'
        saveError.style.display = 'block'
        return
      }
      saveError.style.display = 'none'
      var fields = {}
      current.forEach(function (w) {
        var v = valueOf(w)
        if (v !== undefined) fields[w.name] = v
      })
      if (opts && typeof opts.onSave === 'function') {
        opts.onSave({
          concept: picker.value,
          name: name,
          fields: fields,
          modelId: modelPicker ? modelPicker.value : models.length === 1 ? String(models[0].id) : undefined,
        })
      }
      dismiss()
    })
    var cancelBtn = makeEl(doc, 'button', 'innfo-edit-btn innfo-edit-btn-cancel', 'Cancel')
    cancelBtn.setAttribute('type', 'button')
    cancelBtn.addEventListener('click', cancel)
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

  // Rail progress reads the change, not a review mark: `pending` is how many of the
  // concept's `total` elements carry a change that lives only in this console.
  function RailProgress(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.RailProgress: data required')
    }
    var total = Number(data.total)
    var pending = Number(data.pending)
    if (!isFinite(total) || !isFinite(pending)) {
      throw new TypeError('InnfoUI.RailProgress: numeric total and pending required')
    }
    var doc = resolveDoc(null)
    var span = makeEl(doc, 'span', 'innfo-rail-progress')
    span.setAttribute('data-innfo-component', 'rail-progress')
    span.setAttribute('data-total', String(total))
    span.setAttribute('data-pending', String(pending))
    span.setAttribute(
      'title',
      pending + ' of ' + total + ' elements have unsent changes',
    )
    span.appendChild(doc.createTextNode(pending + '/' + total))
    return span
  }

  // Toast: explicit feedback that an edit was RECORDED, not applied. It never
  // claims a network call or a write; it points at the step still missing (export).
  function Toast(data, opts) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('InnfoUI.Toast: data required')
    }
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('InnfoUI.Toast: doc is required')
    var toast = makeEl(doc, 'div', 'innfo-change-toast')
    toast.setAttribute('data-innfo-component', 'toast')
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    var ico = makeEl(doc, 'span', 'innfo-change-toast-icon')
    ico.setAttribute('aria-hidden', 'true')
    if (typeof icon === 'function') ico.innerHTML = icon('git-commit', 16)
    toast.appendChild(ico)
    var body = makeEl(doc, 'div', 'innfo-change-toast-body')
    body.appendChild(makeEl(doc, 'strong', 'innfo-change-toast-title', data.title || ''))
    body.appendChild(makeEl(doc, 'span', 'innfo-change-toast-text', data.body || ''))
    toast.appendChild(body)
    var close = makeEl(doc, 'button', 'innfo-change-toast-close', '\u00d7')
    close.setAttribute('type', 'button')
    close.setAttribute('aria-label', 'Dismiss')
    close.addEventListener('click', function () {
      if (typeof opts.onClose === 'function') opts.onClose()
    })
    toast.appendChild(close)
    return toast
  }

  /**
   * Registers <innfo-ku> custom element in window.customElements when available.
   */
  function KpiGrid(data, opts) {
    if (!data || !Array.isArray(data.items)) {
      throw new TypeError('InnfoUI.KpiGrid: data.items must be an array')
    }
    var doc = (opts && opts.doc) || (typeof document !== 'undefined' ? document : null)
    if (!doc) throw new TypeError('InnfoUI.KpiGrid: doc is required')
    var grid = makeEl(doc, 'div', 'innfo-kpi-grid')
    grid.setAttribute('data-innfo-component', 'kpi-grid')
    data.items.forEach(function (item) {
      if (!item) return
      var card = makeEl(doc, 'div', 'innfo-kpi-card')
      var header = makeEl(doc, 'div', 'innfo-kpi-header')
      header.appendChild(
        Ku(
          'element',
          {
            model: item.modelId || (opts && opts.modelId) || 'model',
            id: item.id || item.label || item.concept,
            label: item.label || item.concept || '',
            concept: item.concept,
            index: item.index,
            color: item.color,
          },
          { doc: doc },
        ),
      )
      card.appendChild(header)
      var val = makeEl(doc, 'div', 'innfo-kpi-value', item.value != null ? String(item.value) : '0')
      card.appendChild(val)
      if (item.hint) card.appendChild(makeEl(doc, 'div', 'innfo-kpi-hint', item.hint))
      grid.appendChild(card)
    })
    return grid
  }

  // ---- Data surfaces: Table / MatrixGrid / Timeline ----
  //
  // The three are the SAME object seen at three zoom levels: a grid of cells
  // addressed by (row, column), with a sticky header row and an optional sticky
  // first column. ONE builder paints them; the three exports only adapt their
  // input shape, so there is a single place to fix layout, sticky behaviour,
  // empty state or cell coercion.
  //
  // Why they exist: custom views used to hand-roll `<table>` markup and lean on
  // Tailwind utility classes (`overflow-x-auto`, `flex`, ...) that the console
  // bundle does NOT ship, so the page scrolled horizontally forever. These
  // components own their CSS (token-driven, in COMPONENT_CSS) and never depend
  // on a utility class being present.

  function gridCellClass(align) {
    if (align === 'center') return 'innfo-grid-cell innfo-grid-cell--center'
    if (align === 'end' || align === 'right') return 'innfo-grid-cell innfo-grid-cell--end'
    return 'innfo-grid-cell'
  }

  // A cell value may already be a DOM node (a renderer returned one) or a
  // primitive. Never innerHTML: every string is text.
  function coerceCellNode(doc, value) {
    if (value == null) return doc.createTextNode('')
    if (value && value.nodeType) return value
    return doc.createTextNode(String(value))
  }

  function resolveRowHeader(row, ri) {
    var h = row && row.header
    return typeof h === 'function' ? h(row, ri) : h
  }

  function resolveRowCell(row, col, ri, ci) {
    if (typeof row.cell === 'function') return row.cell(col, ri, ci)
    if (row.cells && row.cells[col.key] != null) return row.cells[col.key]
    return null
  }

  function buildGrid(spec) {
    var doc = spec.doc
    var columns = Array.isArray(spec.columns) ? spec.columns : []
    var rows = Array.isArray(spec.rows) ? spec.rows : []
    var hasRowHeader = spec.rowHeader != null

    var scroll = makeEl(doc, 'div', 'innfo-grid-scroll')
    scroll.setAttribute('data-innfo-component', spec.component)
    if (spec.pinFirstColumn) scroll.setAttribute('data-pin-first', 'true')

    var table = makeEl(doc, 'table', 'innfo-grid')
    if (hasRowHeader) table.setAttribute('data-has-row-header', 'true')

    var thead = doc.createElement('thead')
    var htr = doc.createElement('tr')
    if (hasRowHeader) {
      var corner = makeEl(doc, 'th', 'innfo-grid-corner')
      corner.setAttribute('scope', 'col')
      corner.textContent = spec.rowHeader.label != null ? String(spec.rowHeader.label) : ''
      htr.appendChild(corner)
    }
    columns.forEach(function (col) {
      var th = doc.createElement('th')
      th.setAttribute('scope', 'col')
      if (col.key != null) th.setAttribute('data-col', String(col.key))
      if (col.align) th.className = gridCellClass(col.align)
      th.textContent = col.label != null ? String(col.label) : String(col.key == null ? '' : col.key)
      htr.appendChild(th)
    })
    thead.appendChild(htr)
    table.appendChild(thead)

    var tbody = doc.createElement('tbody')
    if (!rows.length) {
      var er = doc.createElement('tr')
      var ec = makeEl(doc, 'td', 'innfo-grid-empty')
      ec.colSpan = Math.max(1, columns.length + (hasRowHeader ? 1 : 0))
      ec.textContent = spec.emptyText != null ? String(spec.emptyText) : ''
      er.appendChild(ec)
      tbody.appendChild(er)
    } else {
      rows.forEach(function (row, ri) {
        if (!row) row = {}
        var tr = doc.createElement('tr')
        if (row.key != null) tr.setAttribute('data-row', String(row.key))
        var headerValue = resolveRowHeader(row, ri)
        if (headerValue != null) {
          var rth = makeEl(doc, 'th', 'innfo-grid-rowhead')
          rth.setAttribute('scope', 'row')
          rth.appendChild(coerceCellNode(doc, headerValue))
          tr.appendChild(rth)
        }
        columns.forEach(function (col, ci) {
          var td = doc.createElement('td')
          td.className = gridCellClass(col.align)
          if (col.key != null) td.setAttribute('data-col', String(col.key))
          td.appendChild(coerceCellNode(doc, resolveRowCell(row, col, ri, ci)))
          tr.appendChild(td)
        })
        tbody.appendChild(tr)
      })
    }
    table.appendChild(tbody)
    scroll.appendChild(table)
    return scroll
  }

  // DataTable columns describe an element: `kind` picks the cell renderer.
  //   'element' -> an element knowledge-unit badge (canonical KU)
  //   'field' / 'value' -> the declared field value via FieldValue, else its text
  //   anything else (default) -> plain text
  function tableCellNode(doc, el, col, modelId, opts) {
    var kind = col.kind || 'text'
    if (kind === 'element') {
      var badge = Ku(
        'element',
        {
          model: modelId,
          id: el && el.id,
          label: (el && (el.name || el.id)) || '',
          concept: el && el.concept,
          color: el && el.color,
          index: el && el.index,
        },
        { doc: doc },
      )
      var activate = opts && (opts.onEdit || opts.onSelect)
      if (activate && el && el.id) {
        badge.setAttribute('role', 'button')
        badge.setAttribute('tabindex', '0')
        badge.setAttribute('aria-label', 'Open ' + ((el && (el.name || el.id)) || el.id))
        badge.addEventListener('click', function () {
          if (opts.onEdit) opts.onEdit(el.id, el)
          else if (opts.onSelect) opts.onSelect(el.id, el)
        })
      }
      return badge
    }
    var value = typeof col.value === 'function' ? col.value(el, col) : fieldLookup(el, col.key)
    if (typeof col.render === 'function') return coerceCellNode(doc, col.render(value, el, col))
    if (kind === 'field' || kind === 'value') {
      var typed = FieldValue(
        { name: col.key, value: value, type: col.type },
        { doc: doc, modelId: modelId, elementId: el && el.id },
      )
      if (typed) return typed
    }
    return coerceCellNode(doc, value)
  }

  function fieldLookup(el, key) {
    if (!el || key == null) return null
    var fields = el.fields
    if (fields && typeof fields === 'object' && fields[key] != null) return fields[key]
    return el[key]
  }

  function DataTable(data, opts) {
    if (!data || !Array.isArray(data.columns)) throw new TypeError('InnfoUI.DataTable: data.columns must be an array')
    if (!Array.isArray(data.rows)) throw new TypeError('InnfoUI.DataTable: data.rows must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('InnfoUI.DataTable: doc is required')
    var modelId = (opts && (opts.modelId || opts.model)) || data.modelId || 'model'
    var columns = data.columns.map(function (c) {
      return { key: c.key, label: c.label, align: c.align, kind: c.kind || 'text', type: c.type, value: c.value, render: c.render }
    })
    var rows = data.rows.map(function (el) {
      return {
        key: el && el.id,
        cell: function (col) {
          return tableCellNode(doc, el, col, modelId, opts)
        },
      }
    })
    return buildGrid({
      doc: doc,
      component: 'data-table',
      columns: columns,
      rows: rows,
      emptyText: data.emptyText,
    })
  }

  function MatrixGrid(data, opts) {
    if (!data || !Array.isArray(data.columns)) throw new TypeError('InnfoUI.MatrixGrid: data.columns must be an array')
    if (!Array.isArray(data.rows)) throw new TypeError('InnfoUI.MatrixGrid: data.rows must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('InnfoUI.MatrixGrid: doc is required')
    return buildGrid({
      doc: doc,
      component: 'matrix-grid',
      columns: data.columns.map(function (c) { return { key: c.key, label: c.label, align: c.align } }),
      rows: data.rows,
      rowHeader: data.rowHeader || { label: '' },
      pinFirstColumn: data.pinFirstColumn !== false,
      emptyText: data.emptyText,
    })
  }

  // A timeline is a matrix whose columns ARE periods; identical to MatrixGrid
  // apart from the component name (styling) and a centre-aligned axis default.
  function Timeline(data, opts) {
    if (!data || !Array.isArray(data.periods)) throw new TypeError('InnfoUI.Timeline: data.periods must be an array')
    if (!Array.isArray(data.lanes)) throw new TypeError('InnfoUI.Timeline: data.lanes must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('InnfoUI.Timeline: doc is required')
    return buildGrid({
      doc: doc,
      component: 'timeline',
      columns: data.periods.map(function (p) { return { key: p.key, label: p.label, align: p.align || 'center' } }),
      rows: data.lanes,
      rowHeader: data.rowHeader || { label: data.laneLabel || '' },
      pinFirstColumn: data.pinFirstColumn !== false,
      emptyText: data.emptyText,
    })
  }

  // ---- FilterSelect: the shared multi-select facet ----
  //
  // A token-styled dropdown of checkboxes with an optional quick-action row — the
  // same control the console filter bar uses for Models / Concepts / Fields, now
  // reusable from any view (state, months, tags). It owns its open + selected
  // state; the caller subscribes with opts.onChange(values, option).
  function normalizeFilterOptions(options) {
    if (!Array.isArray(options)) return []
    return options.map(function (o) {
      if (o && typeof o === 'object') {
        return {
          value: o.value != null ? o.value : o.label,
          label: o.label != null ? String(o.label) : String(o.value),
          count: o.count,
          selected: !!o.selected,
        }
      }
      return { value: o, label: String(o) }
    })
  }

  function filterSummary(label, options, selected) {
    var total = options.length
    var chosen = options.filter(function (o) { return selected[o.value] })
    if (!total) return label
    if (chosen.length === total) return label + ': todos (' + total + ')'
    if (!chosen.length) return label + ': ninguno'
    if (chosen.length === 1) return label + ': ' + chosen[0].label
    return label + ': ' + chosen.length + '/' + total
  }

  function FilterSelect(data, opts) {
    if (!data || !Array.isArray(data.options)) {
      throw new TypeError('InnfoUI.FilterSelect: data.options must be an array')
    }
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('InnfoUI.FilterSelect: doc is required')
    var options = normalizeFilterOptions(data.options)
    var selected = {}
    if (data.selected && !Array.isArray(data.selected) && typeof data.selected === 'object') {
      Object.keys(data.selected).forEach(function (k) { if (data.selected[k]) selected[k] = true })
    } else if (Array.isArray(data.selected)) {
      data.selected.forEach(function (v) { selected[v] = true })
    }
    options.forEach(function (o) { if (o.selected) selected[o.value] = true })
    var label = data.label != null ? String(data.label) : ''

    var root = makeEl(doc, 'details', 'innfo-filter')
    root.setAttribute('data-innfo-component', 'filter-select')
    var summary = makeEl(doc, 'summary', 'innfo-filter-summary')
    summary.setAttribute('aria-label', label || 'Filter')
    root.appendChild(summary)
    var menu = makeEl(doc, 'div', 'innfo-filter-menu')
    root.appendChild(menu)

    var cbByValue = {}
    function selectedValues() {
      return options.filter(function (o) { return selected[o.value] }).map(function (o) { return o.value })
    }
    function syncSummary() { summary.textContent = filterSummary(label, options, selected) }
    function notify() {
      if (typeof opts.onChange === 'function') opts.onChange(selectedValues())
    }
    function setSelection(values, silent) {
      var allow = null
      if (values !== 'all') {
        allow = {}
        ;(Array.isArray(values) ? values : [values]).forEach(function (v) { allow[v] = true })
      }
      options.forEach(function (o) {
        var on = values === 'all' ? true : !!(allow && allow[o.value])
        selected[o.value] = on
        if (cbByValue[o.value]) cbByValue[o.value].checked = on
      })
      syncSummary()
      if (!silent) notify()
    }

    if (Array.isArray(data.quick) && data.quick.length) {
      var quick = makeEl(doc, 'div', 'innfo-filter-quick')
      data.quick.forEach(function (q) {
        if (!q) return
        var b = makeEl(doc, 'button', null, q.label != null ? String(q.label) : '')
        b.type = 'button'
        b.addEventListener('click', function (ev) {
          ev.preventDefault()
          setSelection(q.values == null ? 'all' : q.values)
        })
        quick.appendChild(b)
      })
      menu.appendChild(quick)
    }

    options.forEach(function (o) {
      var row = makeEl(doc, 'label', 'innfo-filter-option')
      var cb = doc.createElement('input')
      cb.type = 'checkbox'
      cb.checked = !!selected[o.value]
      cb.addEventListener('change', function () {
        selected[o.value] = cb.checked
        syncSummary()
        notify()
      })
      cbByValue[o.value] = cb
      row.appendChild(cb)
      row.appendChild(makeEl(doc, 'span', 'innfo-filter-option-label', o.label))
      if (o.count != null) row.appendChild(makeEl(doc, 'span', 'innfo-filter-option-count', String(o.count)))
      menu.appendChild(row)
    })

    syncSummary()
    root.getSelection = selectedValues
    root.setSelection = setSelection
    return root
  }

  function defineCustomElements() {
    if (typeof window === 'undefined' || !window.customElements || window.customElements.get('innfo-ku')) return
    try {
      function InnfoKu() {
        return Reflect.construct(HTMLElement, [], InnfoKu)
      }
      Object.setPrototypeOf(InnfoKu.prototype, HTMLElement.prototype)
      Object.setPrototypeOf(InnfoKu, HTMLElement)
      InnfoKu.prototype.connectedCallback = function () {
        var kind = this.getAttribute('kind') || 'field'
        var name = this.getAttribute('name')
        var value = this.getAttribute('value')
        var label = this.getAttribute('label') || name
        var id = this.getAttribute('id')
        var badge = Ku(
          kind === 'field' ? 'value' : kind,
          {
            model: this.getAttribute('model') || 'model',
            id: id,
            element: id,
            field: name,
            label: label || value,
          },
          { doc: this.ownerDocument },
        )
        this.innerHTML = ''
        this.appendChild(badge)
      }
      window.customElements.define('innfo-ku', InnfoKu)
    } catch {
      /* ignore */
    }
  }

  if (typeof window !== 'undefined' && window.customElements) {
    defineCustomElements()
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

  // ---- Unified knowledge-unit badges (S3): describeUnit + Ku + KuInfoPanel ----
  var KU_NATURE = {
    domain: 'container',
    document: 'container',
    section: 'container',
    concept: 'structure',
    field: 'structure',
    matrix: 'structure',
    element: 'content',
    value: 'content',
    source: 'content',
  }

  function addrApi() {
    return typeof window !== 'undefined' && window.InnfoAddress ? window.InnfoAddress : null
  }

  function valueBaseAddress(ref) {
    var api = addrApi()
    var scope = ref.scope || (ref.inherited || ref.inheritedFrom ? 'concept' : 'element')
    if (scope === 'concept') {
      return api && api.unitAddress
        ? api.unitAddress.section(ref.model, ref.concept || ref.inheritedFrom || ref.name)
        : String(ref.model || '') + '@concept:' + slug(ref.concept || ref.inheritedFrom || ref.name)
    }
    return api && api.unitAddress
      ? api.unitAddress.element(ref.model, ref.element || ref.id)
      : String(ref.model || '') + '@' + slug(ref.element || ref.id)
  }

  function unitAddressFor(kind, ref) {
    var api = addrApi()
    ref = ref || {}
    if (ref.address) return String(ref.address)
    if (kind === 'source') return ref.path || String(ref.model || 'source') + '@source'
    if (api && api.unitAddress) {
      try {
        switch (kind) {
          case 'domain':
            return api.unitAddress.domain()
          case 'document':
            return api.unitAddress.document(ref.id || ref.model)
          case 'section':
            return api.unitAddress.section(ref.model, ref.concept || ref.name)
          case 'element':
            return api.unitAddress.element(ref.model, ref.id || ref.element)
          case 'value':
            if (ref.row && ref.col) {
              return api.unitAddress.cell(
                ref.model,
                ref.matrix || ref.element,
                ref.row,
                ref.col,
              )
            }
            return api.unitAddress.value(valueBaseAddress(ref), ref.field)
          case 'concept':
            return api.unitAddress.concept(ref.family || ref.model, ref.concept || ref.name)
          case 'field':
            return api.unitAddress.field(ref.family || ref.model, ref.concept, ref.name)
          case 'matrix':
            return api.unitAddress.matrix(ref.family || ref.model, ref.name)
        }
      } catch (e) {
        /* fall through to the local grammar */
      }
    }
    var m = ref.model || ''
    switch (kind) {
      case 'domain':
        return 'domaiNN_NN.md'
      case 'document':
        return ref.id || m
      case 'section':
        return m + '@concept:' + slug(ref.concept || ref.name)
      case 'element':
        return m + '@' + slug(ref.id || ref.element)
      case 'value':
        if (ref.row && ref.col) {
          return (
            String(m) +
            '@' +
            slug(ref.matrix || ref.element) +
            '&' +
            slug(ref.row) +
            '&' +
            slug(ref.col)
          )
        }
        return valueBaseAddress(ref) + '&' + (ref.field || '')
      case 'concept':
        return 'specs/' + (ref.family || m) + '@concept:' + slug(ref.concept || ref.name)
      case 'field':
        return 'specs/' + (ref.family || m) + '@concept:' + slug(ref.concept) + '&' + (ref.name || '')
      case 'matrix':
        return 'specs/' + (ref.family || m) + '@matrix:' + slug(ref.name)
    }
    return ''
  }

  function unitHomeFor(address) {
    var api = addrApi()
    if (api && api.unitHome) {
      try {
        return api.unitHome(address)
      } catch (e) {
        /* ignore */
      }
    }
    if (/^specs\//.test(address)) return 'blueprint'
    return address.indexOf('@') === -1 && /\.md$/.test(address) ? 'domain' : 'knowledge'
  }

  function unitEditability(kind, ref) {
    var nature = KU_NATURE[kind]
    if (nature === 'container' || kind === 'source') return 'none'
    if (kind === 'concept' || kind === 'field' || kind === 'matrix') return 'structure'
    if (ref && ref.scope === 'concept') return 'review'
    if (ref && (ref.inherited || ref.inheritedFrom)) return 'none'
    return 'review'
  }

  function describeUnit(kind, ref, index) {
    if (!KU_NATURE[kind]) throw new TypeError('describeUnit: unknown kind "' + kind + '"')
    ref = ref || {}
    var address = unitAddressFor(kind, ref)
    if (!address) throw new TypeError('describeUnit: missing address for "' + kind + '"')
    var nature = KU_NATURE[kind]
    var label =
      ref.label != null
        ? ref.label
        : ref.name != null
          ? ref.name
          : ref.id != null
            ? ref.id
            : ref.value != null
              ? ref.value
              : address
    var slot =
      kind === 'value' && ref.field === 'tags'
        ? tagSlot(String(label))
        : conceptSlot({ index: index, color: ref.color, id: ref.concept || ref.conceptId })
    var desc = {
      kind: kind,
      nature: nature,
      home: kind === 'source' ? 'source' : unitHomeFor(address),
      address: address,
      label: String(label == null ? '' : label),
      slot: slot,
      editability: unitEditability(kind, ref),
      facts: ref.facts && typeof ref.facts === 'object' ? ref.facts : {},
    }
    if (ref.vtype) desc.vtype = String(ref.vtype)
    if (ref.parentLabel) desc.parentLabel = String(ref.parentLabel)
    if (ref.location) desc.location = String(ref.location)
    // Content badges carry the ICON of the concept the unit belongs to (tinted by
    // that concept's colour through --c in CSS).
    if (nature === 'content') {
      desc.icon = resolveConceptIconName(ref.concept || ref.conceptId, {
        index: index,
        color: ref.color,
        id: ref.concept || ref.conceptId,
      })
    }
    return desc
  }

  var KU_CSS_INJECTED = {}
  function ensureKuCss(doc) {
    if (!doc || !doc.head || KU_CSS_INJECTED[doc]) return
    KU_CSS_INJECTED[doc] = true
    var style = doc.createElement('style')
    style.setAttribute('data-innfo-ku-css', '1')
    style.textContent = [
      ':root{--innfo-source-paper:#fff7e6}',
      '.innfo-ku-wrap{display:inline-flex;align-items:center;gap:.2em;position:relative;vertical-align:middle}',
      '.innfo-ku{display:inline-flex;align-items:center;gap:.3em;border-radius:.4em;padding:.12em .5em;font-size:.82rem;line-height:1.4;background:var(--innfo-surface-2,#f1f5f9);--c:var(--innfo-concept-1,#3b82f6);--cb:var(--innfo-concept-1-bg,#eff6ff)}',
      '.innfo-ku[data-ku-nature=container]{border:2px solid var(--innfo-accent,#0f172a);background:var(--innfo-surface,#fff)}',
      '.innfo-ku[data-ku-nature=structure]{border:1.5px solid var(--c);font-family:ui-monospace,monospace;color:var(--innfo-muted,#64748b);background:var(--innfo-surface,#fff)}',
      '.innfo-ku[data-ku-nature=content]{border:0;background:var(--innfo-surface-2,#f1f5f9)}',
      '.innfo-ku[data-ku-nature=content]>.innfo-ku-label,.innfo-ku[data-ku-nature=content]>.innfo-ku-value{color:var(--c)}',
      '.innfo-ku[data-ku-nature=content]>.innfo-ku-icon{color:var(--c)}',
      '.innfo-ku[data-ku-home=source]{background:var(--innfo-source-paper,#fff7e6)}',
      '.innfo-ku[data-ku-home=source]>.innfo-ku-label,.innfo-ku[data-ku-home=source] .innfo-ku-icon{color:var(--innfo-muted,#64748b)}',
      '.innfo-ku--block{display:flex;width:100%;padding:.5em .7em}',
      '.innfo-ku-more{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--innfo-muted,#64748b);cursor:pointer}',
      '.innfo-ku-more:hover,.innfo-ku-more[aria-expanded=true]{color:var(--innfo-text,#0a0a0a);background:var(--innfo-surface-2,#f1f5f9)}',
      '.innfo-ku-actions{position:fixed;z-index:60;display:none;align-items:center;gap:.15em;padding:.2em;background:var(--innfo-surface,#fff);border:1px solid var(--innfo-border,#e5e5e5);border-radius:.4em;box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap}',
      '.innfo-ku-wrap[data-ku-open=true]>.innfo-ku-actions{display:inline-flex}',
      '.innfo-ku-action{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;border:0;background:transparent;cursor:pointer;color:var(--innfo-muted,#64748b)}',
      '.innfo-ku-action:hover{color:var(--innfo-text,#0a0a0a);background:var(--innfo-surface-2,#f1f5f9)}',
      // No mode gates: an edit only ever creates a draft, so the pencil is always
      // emitted and always live. Structure edits warn inside the modal instead.
      '.innfo-ku-change-pip{min-width:1.35em;height:1.35em;border-radius:999px;border:0;background:#b45309;color:#fff;font-size:.72rem;cursor:pointer}',
    ].join('')
    doc.head.appendChild(style)
  }

  function Ku(kind, ref, opts) {
    if (!KU_NATURE[kind]) throw new TypeError('Ku: unknown kind "' + kind + '"')
    opts = opts || {}
    var doc = resolveDoc(opts)
    ensureKuCss(doc)
    var desc = describeUnit(kind, ref, opts.index)
    var wrap = makeEl(doc, 'span', 'innfo-ku-wrap')
    var isBlock = opts.variant === 'block'
    var badge = makeEl(doc, isBlock ? 'div' : 'span', isBlock ? 'innfo-ku innfo-ku--block' : 'innfo-ku')
    badge.setAttribute('data-innfo-component', 'ku-unit')
    badge.setAttribute('data-ku-kind', desc.kind)
    badge.setAttribute('data-ku-nature', desc.nature)
    badge.setAttribute('data-ku-home', desc.home)
    badge.setAttribute('data-ku-address', desc.address)
    badge.setAttribute('data-concept-slot', String(desc.slot))
    if (desc.vtype) badge.setAttribute('data-ku-vtype', desc.vtype)
    if (ref && ref.field) badge.setAttribute('data-field', String(ref.field))
    if (ref && ref.row != null) badge.setAttribute('data-row', String(ref.row))
    if (ref && ref.col != null) badge.setAttribute('data-col', String(ref.col))
    if (ref && ref.id != null && kind === 'element') badge.setAttribute('data-element-id', String(ref.id))
    if (isBlock) {
      badge.setAttribute('data-ku-variant', 'block')
      if (opts.body) badge.appendChild(opts.body)
    } else {
      if (desc.icon) {
        var conceptIconEl = makeEl(doc, 'span', 'innfo-ku-icon')
        conceptIconEl.setAttribute('aria-hidden', 'true')
        conceptIconEl.innerHTML = icon(desc.icon, 13)
        badge.appendChild(conceptIconEl)
      }
      var labelEl = makeEl(doc, 'span', 'innfo-ku-label', desc.label)
      labelEl.setAttribute('title', desc.label)
      badge.appendChild(labelEl)
      if (opts.valueNode) {
        var valueEl = makeEl(doc, 'span', 'innfo-ku-value')
        valueEl.appendChild(opts.valueNode)
        badge.appendChild(valueEl)
      }
    }
    badge.setAttribute('aria-label', desc.nature + ', lives in ' + desc.home + ': ' + desc.label)
    wrap.appendChild(badge)

    // ONE affordance sits beside the badge; everything else floats below on demand.
    var more = makeEl(doc, 'button', 'innfo-ku-more')
    more.setAttribute('type', 'button')
    more.setAttribute('data-ku-more', 'true')
    more.setAttribute('aria-expanded', 'false')
    more.setAttribute('aria-label', 'Actions for ' + desc.label)
    more.innerHTML =
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9"/></svg>'
    wrap.setAttribute('data-ku-open', 'false')
    wrap.appendChild(more)

    // Action flyout (no inline space): info, reveal, citations (when there are any),
    // edit (only when the unit is editable).
    var actions = makeEl(doc, 'span', 'innfo-ku-actions')
    function actionButton(name, iconName, label, handler) {
      var b = makeEl(doc, 'button', 'innfo-ku-action')
      b.setAttribute('type', 'button')
      b.setAttribute('data-ku-action', name)
      b.setAttribute('aria-label', label)
      b.innerHTML = icon(iconName, 14)
      if (typeof handler === 'function') {
        b.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation()
          handler(desc)
        })
      }
      return b
    }
    actions.appendChild(actionButton('info', 'info', 'Unit info', opts.onInfo))
    actions.appendChild(actionButton('reveal', 'arrow-up-right', 'Reveal in context', opts.onReveal))
    var citations = ref && ref.citations && Array.isArray(ref.citations.sources) ? ref.citations.sources : null
    if (citations && citations.length) {
      actions.appendChild(
        actionButton('citations', 'cite-document', citations.length + ' citations', opts.onCitations),
      )
    }
    if (desc.editability !== 'none') {
      var editBtn = actionButton('edit', 'pencil', 'Edit unit', opts.onEdit)
      if (desc.editability === 'structure') editBtn.setAttribute('data-ku-structure', 'true')
      actions.appendChild(editBtn)
    }
    wrap.appendChild(actions)

    var changes = Number(opts.changes || (ref && ref.changes) || 0)
    if (changes > 0) {
      var pip = makeEl(doc, 'button', 'innfo-ku-change-pip', String(changes))
      pip.setAttribute('type', 'button')
      pip.setAttribute('data-innfo-component', 'ku-change-pip')
      pip.setAttribute('data-ku-address', desc.address)
      pip.setAttribute('aria-label', changes + ' pending changes on ' + desc.label)
      if (typeof opts.onChanges === 'function') {
        pip.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation()
          opts.onChanges(desc)
        })
      }
      wrap.appendChild(pip)
    }
    return wrap
  }

  // One delegated listener per document. Ku never owns review behaviour: it
  // only forwards (action, descriptor) to the host's onAction.
  function createKu(opts) {
    opts = opts || {}
    var doc = opts.doc || (typeof document !== 'undefined' ? document : null)
    if (!doc || typeof doc.addEventListener !== 'function') return { destroy: function () {} }
    function descriptorOf(node) {
      var wrap = node && node.closest ? node.closest('.innfo-ku-wrap') : null
      var badge = wrap ? wrap.querySelector('[data-innfo-component="ku-unit"]') : null
      if (!badge) return null
      var kind = badge.getAttribute('data-ku-kind') || ''
      var labelEl = badge.querySelector('.innfo-ku-label')
      var ref = {
        address: badge.getAttribute('data-ku-address') || '',
        label: labelEl ? labelEl.textContent : badge.getAttribute('aria-label') || '',
      }
      try {
        return describeUnit(kind, ref)
      } catch (e) {
        return null
      }
    }
    function closeFlyouts() {
      var open = doc.querySelectorAll('.innfo-ku-wrap[data-ku-open=true]')
      for (var i = 0; i < open.length; i++) {
        open[i].setAttribute('data-ku-open', 'false')
        var moreBtn = open[i].querySelector('[data-ku-more]')
        if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false')
      }
    }
    function onClick(ev) {
      var t = ev && ev.target
      if (!t || !t.closest) return
      // The "+" toggles the flyout; only one is open at a time.
      var moreEl = t.closest('[data-ku-more]')
      if (moreEl) {
        var owner = moreEl.closest('.innfo-ku-wrap')
        var wasOpen = !!(owner && owner.getAttribute('data-ku-open') === 'true')
        closeFlyouts()
        if (owner && !wasOpen) {
          owner.setAttribute('data-ku-open', 'true')
          moreEl.setAttribute('aria-expanded', 'true')
          // The flyout is position:fixed, so an `overflow` ancestor (a table wrapper)
          // can no longer clip it. Anchor it to the badge, clamped to the viewport.
          var fly = owner.querySelector('.innfo-ku-actions')
          if (fly && owner.getBoundingClientRect) {
            var rect = owner.getBoundingClientRect()
            var view = doc.defaultView
            var vw = view && view.innerWidth ? view.innerWidth : 0
            var fw = fly.getBoundingClientRect ? fly.getBoundingClientRect().width : 0
            var left = rect.left
            if (vw && fw && left + fw > vw - 8) left = Math.max(8, vw - fw - 8)
            fly.style.left = left + 'px'
            fly.style.top = rect.bottom + 5 + 'px'
          }
        }
        if (ev.preventDefault) ev.preventDefault()
        return
      }
      var actionEl = t.closest('[data-ku-action]')
      var pipEl = t.closest('[data-innfo-component="ku-change-pip"]')
      if (!actionEl && !pipEl) {
        closeFlyouts()
        return
      }
      closeFlyouts()
      var desc = descriptorOf(actionEl || pipEl)
      if (!desc) return
      var action = actionEl ? actionEl.getAttribute('data-ku-action') : 'changes'
      if (typeof opts.onAction === 'function') {
        if (ev.preventDefault) ev.preventDefault()
        opts.onAction(action, desc, ev)
      }
    }
    doc.addEventListener('click', onClick)
    return {
      destroy: function () {
        doc.removeEventListener('click', onClick)
      },
    }
  }

  // Address-keyed pending-change pips. `Ku` paints a pip only for the count it
  // was given at render time; this repaints pips across an existing tree keyed
  // by canonical address, so a host updates counts without re-rendering badges.
  // Activation is delegated (see `createKu`) unless `opts.onChanges` is given, in
  // which case the pip handles the click itself and stops it from bubbling.
  function setUnitChanges(root, countsByAddress, opts) {
    opts = opts || {}
    var doc = resolveDoc(opts)
    var host = root || doc
    if (!host || typeof host.querySelectorAll !== 'function') return
    var counts = countsByAddress || {}
    Array.prototype.forEach.call(
      host.querySelectorAll('[data-innfo-component="ku-unit"][data-ku-address]'),
      function (badge) {
        var address = badge.getAttribute('data-ku-address') || ''
        var n = Number(counts[address] || 0)
        var wrap = badge.parentNode || badge
        var existing =
          typeof wrap.querySelector === 'function'
            ? wrap.querySelector('[data-innfo-component="ku-change-pip"]')
            : null
        if (n > 0) {
          badge.setAttribute('data-ku-changes', String(n))
          if (existing) {
            existing.textContent = String(n)
            return
          }
          var pip = makeEl(doc, 'button', 'innfo-ku-change-pip', String(n))
          pip.setAttribute('type', 'button')
          pip.setAttribute('data-innfo-component', 'ku-change-pip')
          pip.setAttribute('data-ku-address', address)
          var labelEl = badge.querySelector('.innfo-ku-label')
          var label = labelEl ? labelEl.textContent : badge.getAttribute('aria-label') || address
          pip.setAttribute('aria-label', n + ' pending change' + (n === 1 ? '' : 's') + ' on ' + label)
          if (typeof opts.onChanges === 'function') {
            pip.addEventListener('click', function (ev) {
              if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation()
              opts.onChanges(address, badge)
            })
          }
          wrap.appendChild(pip)
        } else {
          badge.removeAttribute('data-ku-changes')
          if (existing && existing.parentNode) existing.parentNode.removeChild(existing)
        }
      },
    )
  }

  function KuInfoPanel(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
      throw new TypeError('KuInfoPanel: descriptor required')
    }
    var doc = resolveDoc(null)
    var dlg = makeEl(doc, 'dialog', 'innfo-ku-info-panel')
    dlg.setAttribute('data-innfo-component', 'ku-info-panel')
    dlg.setAttribute('role', 'dialog')
    var h = makeEl(doc, 'h2', 'innfo-ku-info-title', descriptor.label || descriptor.address)
    h.setAttribute('tabindex', '-1')
    dlg.appendChild(h)
    dlg.appendChild(
      makeEl(doc, 'p', 'innfo-ku-info-sub', descriptor.nature + ', lives in ' + descriptor.home),
    )
    var rows = [
      ['Kind', descriptor.kind],
      ['Nature', descriptor.nature],
      ['Lives in', descriptor.home],
      ['Address', descriptor.address],
      ['Location', descriptor.location || ''],
      ['Editability', descriptor.editability],
    ]
    var dl = makeEl(doc, 'dl', 'innfo-ku-info-list')
    rows.forEach(function (pair) {
      if (!pair[1]) return
      dl.appendChild(makeEl(doc, 'dt', 'innfo-ku-info-term', pair[0]))
      dl.appendChild(makeEl(doc, 'dd', 'innfo-ku-info-def', String(pair[1])))
    })
    dlg.appendChild(dl)
    var facts = descriptor.facts || {}
    Object.keys(facts).forEach(function (k) {
      if (facts[k] == null || facts[k] === '') return
      dl.appendChild(makeEl(doc, 'dt', 'innfo-ku-info-term', k))
      dl.appendChild(makeEl(doc, 'dd', 'innfo-ku-info-def', String(facts[k])))
    })
    return dlg
  }

  return {
    VERSION: UI_VERSION,
    COPY: COPY,
    TOKEN_VALUES: TOKEN_VALUES,
    TOKENS: TOKENS,
    generateTokenCss: generateTokenCss,
    ensureTokens: ensureTokens,
    setTheme: setTheme,
    icon: icon,
    slug: slug,
    conceptSlot: conceptSlot,
    tagSlot: tagSlot,
    describeUnit: describeUnit,
    createKu: createKu,
    setUnitChanges: setUnitChanges,
    Ku: Ku,
    KuInfoPanel: KuInfoPanel,
    resolveConceptIconName: resolveConceptIconName,
    ORIGIN_VARIANTS: ['error', 'agent', 'human', 'reviewer', 'document'],
    TagRow: TagRow,
    RelList: RelList,
    EditAnchor: EditAnchor,
    StatusBadge: StatusBadge,
    CitationIcon: CitationIcon,
    CitationIcons: CitationIcons,
    FieldRow: FieldRow,
    FieldValue: FieldValue,
    Markdown: Markdown,
    safeHref: safeHref,
    ElementCard: ElementCard,
    ElementMini: ElementMini,
    ElementPreview: ElementPreview,
    CITATION_ORIGIN_LABELS: CITATION_ORIGIN_LABELS,
    DraftList: DraftList,
    ChangeHistory: ChangeHistory,
    AnnotationPopover: AnnotationPopover,
    RailProgress: RailProgress,
    Toast: Toast,
    STATUS_LABELS: STATUS_LABELS,
    statusLabel: statusLabel,
    EditModal: EditModal,
    NewElementModal: NewElementModal,
    SankeyFlow: SankeyFlow,
    FieldStringWidget: FieldStringWidget,
    FieldNumberWidget: FieldNumberWidget,
    FieldBooleanWidget: FieldBooleanWidget,
    FieldSelectWidget: FieldSelectWidget,
    FieldMultiSelectWidget: FieldMultiSelectWidget,
    FieldReferenceWidget: FieldReferenceWidget,
    FieldMarkdownWidget: FieldMarkdownWidget,
    KpiGrid: KpiGrid,
    DataTable: DataTable,
    MatrixGrid: MatrixGrid,
    Timeline: Timeline,
    FilterSelect: FilterSelect,
    defineCustomElements: defineCustomElements,
  }
})
