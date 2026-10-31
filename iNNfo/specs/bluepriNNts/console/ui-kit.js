/* global module: writable */
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.nnUI = factory()
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
      '--nn-bg': '#fafafa',
      '--nn-surface': '#ffffff',
      '--nn-surface-2': '#f4f4f5',
      '--nn-text': '#0a0a0a',
      '--nn-muted': '#666666',
      '--nn-border': '#e5e5e5',
      '--nn-accent': '#171717',
      '--nn-link': '#171717',
      '--nn-focus': '#52525b',
      '--nn-concept-1': '#3b82f6',
      '--nn-concept-2': '#8b5cf6',
      '--nn-concept-3': '#14b8a6',
      '--nn-concept-4': '#f59e0b',
      '--nn-concept-5': '#ec4899',
      '--nn-concept-6': '#22c55e',
      '--nn-concept-7': '#f97316',
      '--nn-concept-8': '#6366f1',
      '--nn-concept-9': '#ef4444',
      '--nn-concept-10': '#eab308',
      '--nn-concept-11': '#a855f7',
      '--nn-concept-12': '#6b7280',
      '--nn-concept-1-bg': '#eff6ff',
      '--nn-concept-2-bg': '#f5f3ff',
      '--nn-concept-3-bg': '#f0fdfa',
      '--nn-concept-4-bg': '#fffbeb',
      '--nn-concept-5-bg': '#fdf2f8',
      '--nn-concept-6-bg': '#f0fdf4',
      '--nn-concept-7-bg': '#fff7ed',
      '--nn-concept-8-bg': '#eef2ff',
      '--nn-concept-9-bg': '#fef2f2',
      '--nn-concept-10-bg': '#fefce8',
      '--nn-concept-11-bg': '#faf5ff',
      '--nn-concept-12-bg': '#f9fafb',
      '--nn-status-pending': '#92400e',
      '--nn-status-applied': '#166534',
      '--nn-status-rejected': '#b91c1c',
      '--nn-status-stale': '#4b5563',
      '--nn-status-unsent': '#1e3a8a',
      '--nn-status-pending-bg': '#fef3c7',
      '--nn-status-applied-bg': '#dcfce7',
      '--nn-status-rejected-bg': '#fee2e2',
      '--nn-status-stale-bg': '#f3f4f6',
      '--nn-status-unsent-bg': '#dbeafe',
      '--nn-origin-agent': '#7c3aed',
      '--nn-origin-human': '#2563eb',
      '--nn-origin-reviewer': '#b45309',
      '--nn-origin-document': '#4b5563',
      '--nn-origin-error': '#dc2626',
      '--nn-radius-sm': '6px',
      '--nn-radius': '8px',
      '--nn-radius-lg': '10px',
      '--nn-fs-hero': '1.5rem',
      '--nn-fs-title': '1.25rem',
      '--nn-fs-body': '0.9375rem',
      '--nn-fs-caption': '0.8125rem',
      '--nn-fs-min': '0.75rem',
      '--nn-font':
        "Plus Jakarta Sans, Geist Sans, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      '--nn-mono': "Geist Mono, 'JetBrains Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
      '--nn-shadow': '0 1px 2px rgba(0, 0, 0, .06)',
    },
  }

  var TOKENS = Object.keys(TOKEN_VALUES.light)

  function declBlock(values) {
    return TOKENS.map(function (name) {
      return '  ' + name + ': ' + values[name] + ';'
    }).join('\n')
  }

  // Component CSS: every rule is scoped to a [data-nn-component] root so it
  // never leaks into a shell. C appends the review components here.
  var COMPONENT_CSS = [
    '[data-nn-component]{box-sizing:border-box}',
    '.nn-status-badge{display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2}',
    '.nn-concept-dot{width:.6em;height:.6em;border-radius:50%;background:var(--nn-muted);flex:0 0 auto}',
    '.nn-concept-count{color:var(--nn-muted)}',
    '.nn-element-origin{display:inline-flex;align-items:center;color:var(--nn-origin-document)}',
    '.nn-element-origin[data-origin=error]{color:var(--nn-origin-error)}',
    '.nn-element-origin[data-origin=agent]{color:var(--nn-origin-agent)}',
    '.nn-element-origin[data-origin=human]{color:var(--nn-origin-human)}',
    '.nn-element-origin[data-origin=reviewer]{color:var(--nn-origin-reviewer)}',
    '.nn-status-badge{border-radius:var(--nn-radius-sm);padding:.05em .5em;font-weight:600}',
    // The single per-row change-state signal: blue means a change that lives only
    // in this console and has not been submitted yet.
    '.nn-status-badge[data-status=local]{color:var(--nn-status-unsent);background:var(--nn-status-unsent-bg)}',
    '.nn-draft-list{list-style:none;margin:0;padding:0}',
    '.nn-draft-row{display:flex;align-items:baseline;gap:.5em;padding:.3em 0;border-bottom:1px solid var(--nn-border)}',
    '.nn-draft-kind{font-weight:600;color:var(--nn-muted)}',
    '.nn-draft-text{flex:1 1 auto}',
    '.nn-draft-target-changed{color:var(--nn-status-stale);font-size:.8rem}',
    '.nn-annotation-popover{border:1px solid var(--nn-border);border-radius:var(--nn-radius);background:var(--nn-surface);padding:.75em;box-shadow:var(--nn-shadow)}',
    '.nn-popover-original{color:var(--nn-muted)}',
    '.nn-popover-proposed{display:block;width:100%;font:inherit}',
    '.nn-rail-progress{color:var(--nn-muted);font-size:.75rem}',
    '.nn-new-element{appearance:none;border:1px solid var(--nn-border);background:var(--nn-surface);color:var(--nn-text);font:inherit;font-size:.82rem;font-weight:600;padding:6px 14px;border-radius:var(--nn-radius-sm);cursor:pointer}',
    '.nn-review-anchor{appearance:none;border:1px solid var(--nn-border);background:var(--nn-surface-2);color:var(--nn-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--nn-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease}',
    '.nn-review-anchor:hover{opacity:1;background:var(--nn-surface);border-color:var(--nn-focus)}',
    '[data-nn-component=element-card]:hover .nn-review-anchor{opacity:.85}',
    '.nn-review-anchor:focus-visible{outline:2px solid var(--nn-focus);outline-offset:1px;opacity:1}',
    '.nn-review-badges{display:inline-flex;gap:.3em;align-items:center;margin-left:.4em}',
    // The single change-state signal collapses every per-row change signal (the
    // local edit, the proposed changesets and the applied history) into one badge.
    // The per-state counts live in the badge tooltip.
    '.nn-change-state{font-size:.76rem;font-weight:700;border-radius:999px;padding:.05em .6em}',
    // Change toast: the feedback that a change was recorded but NOT applied. Fixed
    // to the bottom-right, temporary, dismissable; it never blocks the page. The
    // class is `nn-change-toast` so it never collides with the runtime's inline
    // error toast (`.nn-toast`, `[data-nn="toast"]`).
    '.nn-change-toast{position:fixed;right:1rem;bottom:1rem;z-index:90;display:flex;align-items:flex-start;gap:.6rem;max-width:22rem;padding:.75rem .9rem;background:var(--nn-surface);color:var(--nn-text);border:1px solid var(--nn-border);border-left:3px solid var(--nn-status-unsent);border-radius:var(--nn-radius);box-shadow:0 10px 32px rgba(0,0,0,.18)}',
    '.nn-change-toast-icon{flex:0 0 auto;display:inline-flex;color:var(--nn-status-unsent);margin-top:.1rem}',
    '.nn-change-toast-body{min-width:0}',
    '.nn-change-toast-title{display:block;font-weight:700;font-size:.85rem;margin-bottom:.15rem}',
    '.nn-change-toast-text{display:block;font-size:.8rem;line-height:1.4;color:var(--nn-muted)}',
    '.nn-change-toast-close{flex:0 0 auto;margin-left:auto;appearance:none;border:0;background:transparent;color:var(--nn-muted);font:inherit;font-size:1rem;line-height:1;cursor:pointer;padding:.05rem .2rem;border-radius:var(--nn-radius-sm)}',
    '.nn-change-toast-close:hover{color:var(--nn-text);background:var(--nn-surface-2)}',
    '@media (max-width:640px){.nn-change-toast{left:1rem;right:1rem;max-width:none}}',
    '.nn-popover-comment,.nn-popover-proposed{display:block;width:100%;font:inherit;box-sizing:border-box}',
    '@media (max-width:640px){.nn-annotation-popover{width:100%}.nn-new-element{width:100%}}',
    '.nn-edit-modal{border:1px solid var(--nn-border);border-radius:var(--nn-radius-lg);padding:0;max-width:760px;width:100%;max-height:86vh;overflow:auto;background:var(--nn-surface);color:var(--nn-text);box-shadow:0 12px 40px rgba(0,0,0,.15)}',
    '.nn-edit-modal::backdrop{background:rgba(0,0,0,.35)}',
    '.nn-edit-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--nn-border)}',
    '.nn-edit-modal-head h2{margin:0;font-size:1.05rem;font-weight:700}',
    '.nn-edit-modal-close{border:1px solid var(--nn-border);background:var(--nn-surface);color:var(--nn-muted);border-radius:var(--nn-radius-sm);width:28px;height:28px;cursor:pointer;font-size:1.1rem;font-weight:700;display:flex;align-items:center;justify-content:center}',
    '.nn-edit-modal-body{padding:20px}',
    '.nn-edit-mode-selector{display:flex;gap:8px;margin-bottom:16px}',
    '.nn-edit-mode-btn{padding:6px 14px;border:1px solid var(--nn-border);background:var(--nn-surface-2);color:var(--nn-text);border-radius:var(--nn-radius-sm);cursor:pointer;font:inherit;font-size:.85rem;font-weight:600}',
    '.nn-edit-mode-btn.active{background:var(--nn-accent);color:var(--nn-bg);border-color:var(--nn-accent)}',
    '.nn-edit-field-label{display:block;font-size:.82rem;font-weight:600;color:var(--nn-muted);margin-bottom:6px}',
    '.nn-edit-input,.nn-edit-select,.nn-edit-textarea{width:100%;padding:8px 10px;border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);background:var(--nn-surface);color:var(--nn-text);font:inherit;font-size:.88rem}',
    '.nn-edit-input:focus,.nn-edit-select:focus,.nn-edit-textarea:focus{outline:none;border-color:var(--nn-focus);box-shadow:0 0 0 2px rgba(37,99,235,.2)}',
    '.nn-edit-checkbox-label{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer}',
    '.nn-edit-multiselect{display:flex;flex-direction:column;gap:6px}',
    '.nn-edit-modal-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--nn-border);background:var(--nn-surface-2);border-radius:0 0 var(--nn-radius-lg) var(--nn-radius-lg)}',
    '.nn-edit-btn{padding:7px 16px;border-radius:var(--nn-radius-sm);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer}',
    '.nn-edit-btn-save{background:var(--nn-accent);color:var(--nn-bg);border:1px solid var(--nn-accent)}',
    '.nn-edit-btn-cancel{background:var(--nn-surface);color:var(--nn-text);border:1px solid var(--nn-border)}',
    '.nn-modal-tabs{display:flex;border-bottom:1px solid var(--nn-border);background:var(--nn-surface-2);padding:0 12px;gap:4px}',
    '.nn-modal-tab-btn{padding:8px 16px;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--nn-muted);font:inherit;font-size:.85rem;font-weight:600;cursor:pointer}',
    '.nn-modal-tab-btn.active{color:var(--nn-text);border-bottom-color:var(--nn-accent);background:var(--nn-surface)}',
    '.nn-modal-tab-panel{padding:20px}',
    '.nn-history-section{margin-bottom:16px}',
    '.nn-history-title{font-size:.85rem;font-weight:700;margin:0 0 8px;color:var(--nn-text)}',
    '.nn-history-item{padding:8px 10px;border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);background:var(--nn-surface-2);margin-bottom:6px;font-size:.82rem}',
    '.nn-history-meta{color:var(--nn-muted);font-size:.75rem;margin-bottom:3px}',
    '.nn-history-notes{font-weight:500;color:var(--nn-text)}',
    '.nn-history-empty{color:var(--nn-muted);font-size:.82rem;font-style:italic}',
    // Element-card redesign: hover-reveal edit anchors (same pattern as
    // .nn-review-anchor), QKUD chip, tags, relations.
    '.nn-edit-anchor{appearance:none;border:1px solid var(--nn-border);background:var(--nn-surface-2);color:var(--nn-text);font:inherit;font-size:.78rem;padding:.1em .45em;border-radius:var(--nn-radius-sm);cursor:pointer;margin-left:.4em;opacity:.35;transition:opacity .15s ease, background .15s ease;display:inline-flex;align-items:center;justify-content:center;min-width:1.9em;min-height:1.6em}',
    '.nn-edit-anchor:hover{opacity:1;background:var(--nn-surface);border-color:var(--nn-focus)}',
    '[data-nn-component=element-card]:hover .nn-edit-anchor{opacity:.85}',
    '.nn-edit-anchor:focus-visible{outline:2px solid var(--nn-focus);outline-offset:1px;opacity:1}',
    '.nn-qud{display:inline-flex;align-items:center;gap:.35em;font-family:var(--nn-mono);font-size:.75rem;color:var(--nn-muted);background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);padding:.15em .3em .15em .6em;max-width:100%;min-width:0}',
    // The KU-detail chip holds a long mono id; the wrapper must be able to
    // shrink below its content so a long id never widens the page on narrow
    // viewports (only .nn-qud-id itself truncates with an ellipsis).
    '.nn-qud-wrap{display:inline-flex;min-width:0;max-width:100%}',
    '.nn-qud-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
    '.nn-qud-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--nn-muted);font:inherit;padding:.1em .35em;border-radius:var(--nn-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.nn-qud-btn:hover{color:var(--nn-text);border-color:var(--nn-border);background:var(--nn-surface)}',
    '.nn-qud-detail{display:none;font-family:var(--nn-mono);font-size:.75rem;color:var(--nn-muted);background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);padding:.5em .7em;margin:.5em 0 0;word-break:break-all}',
    '[data-qud-open] .nn-qud-detail{display:block}',
    '.nn-card-path{font-family:var(--nn-mono);font-size:.75rem;color:var(--nn-muted);border-top:1px solid var(--nn-border);padding:.5em 0 0;margin:.7em 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.nn-tag-row{display:flex;gap:.4em;flex-wrap:wrap;align-items:center;margin:.6em 0 0}',
    '.nn-tag{display:inline-flex;align-items:center;gap:.3em;font-size:.78rem;background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);padding:.1em .3em .1em .55em}',
    '.nn-tag-remove{appearance:none;border:none;background:none;color:var(--nn-muted);font:inherit;cursor:pointer;display:inline-flex;padding:.1em;border-radius:4px}',
    '.nn-tag-remove:hover{color:var(--nn-status-rejected)}',
    '.nn-tag-add{appearance:none;border:1px dashed var(--nn-border);background:none;color:var(--nn-muted);font:inherit;font-size:.78rem;border-radius:var(--nn-radius-sm);padding:.1em .55em;cursor:pointer}',
    '.nn-tag-add:hover{color:var(--nn-link);border-color:var(--nn-link)}',
    '.nn-rel-list{list-style:none;margin:.6em 0 0;padding:0;display:flex;flex-direction:column;gap:.35em}',
    '.nn-rel-row{display:flex;align-items:center;gap:.5em;font-size:.85rem}',
    '.nn-rel-field{color:var(--nn-muted);font-size:.78rem;min-width:5em}',
    '.nn-rel-act{appearance:none;border:1px solid transparent;background:none;color:var(--nn-muted);font:inherit;cursor:pointer;display:inline-flex;padding:.15em;border-radius:4px;opacity:.45}',
    '.nn-rel-row:hover .nn-rel-act,.nn-rel-act:focus-visible{opacity:1}',
    '.nn-rel-act:hover{color:var(--nn-link);border-color:var(--nn-border)}',
    '.nn-rel-act.danger:hover{color:var(--nn-status-rejected)}',
    '.nn-rel-add{appearance:none;border:1px dashed var(--nn-border);background:none;color:var(--nn-muted);font:inherit;font-size:.78rem;border-radius:var(--nn-radius-sm);padding:.1em .55em;cursor:pointer;align-self:flex-start}',
    '.nn-rel-add:hover{color:var(--nn-link);border-color:var(--nn-link)}',
    '@media (max-width:640px){.nn-edit-anchor,.nn-qud-btn,.nn-rel-act{min-width:32px;min-height:32px}.nn-qud{font-size:.75rem}}',
    // Knowledge-unit badge family (Ku) + action cluster + change pip.
    '.nn-ku-unit{display:inline-flex;align-items:center;gap:.25em;max-width:100%}',
    '.nn-card-fields>.nn-ku-unit,.nn-card-fields>.nn-ku{flex:1 1 16rem;min-width:0}',
    '.nn-card-fields>.nn-ku[data-field-wide=true],.nn-card-fields>.nn-ku-unit:has([data-field-wide=true]){flex-basis:100%}',
    '.nn-ku{position:relative;display:inline-flex;align-items:center;gap:.35em;font:inherit;font-size:.82rem;line-height:1.2;border:0;border-radius:var(--nn-radius-sm);padding:.12em .5em;background:var(--nn-surface-2);color:var(--nn-text);max-width:100%;--c:var(--nn-concept-1);--cb:var(--nn-concept-1-bg)}',
    // Nature grammar (approved 2026-10-18): container = ONE border at 2x the line
    // width (no double border); structure = SOLID concept-coloured border + mono
    // (no dashed); content = NO border, the concept colour rides on the label and
    // the concept icon.
    '.nn-ku[data-ku-nature=container]{border:2px solid var(--nn-accent);background:var(--nn-surface)}',
    '.nn-ku[data-ku-nature=structure]{border:1.5px solid var(--c);font-family:ui-monospace,monospace;color:var(--nn-muted);background:var(--nn-surface)}',
    '.nn-ku[data-ku-nature=content]{border:0;background:var(--nn-surface-2)}',
    '.nn-ku-wrap{display:inline-flex;align-items:center;gap:.2em;position:relative;vertical-align:middle;max-width:100%}',
    '.nn-ku[data-ku-kind=field],.nn-ku[data-ku-kind=cell]{background:var(--nn-surface-2)}',
    // Element + concept/document badges read as card titles: slightly larger and
    // semibold so they anchor the hierarchy above their muted field rows.
    '.nn-ku[data-ku-kind=element],.nn-ku[data-ku-kind=concept],.nn-ku[data-ku-kind=document]{font-weight:600}',
    '.nn-ku[data-ku-kind=element]{font-size:.9rem}',
    '.nn-ku .nn-ku-label{color:var(--nn-muted)}',
    '.nn-ku .nn-ku-value{color:var(--nn-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.nn-field-citation{display:inline-flex;align-items:center;gap:.3em;min-width:0}',
    '.nn-ku .nn-ku-icon{display:inline-flex;color:var(--nn-muted);flex:0 0 auto}',
    // Content badges: NO border; the concept colour rides on the label/value and on
    // the concept icon (the icon of the concept the unit belongs to).
    '.nn-ku[data-ku-nature=content]>.nn-ku-label,.nn-ku[data-ku-nature=content]>.nn-ku-value{color:var(--c)}',
    '.nn-ku[data-ku-nature=content]>.nn-ku-icon{color:var(--c)}',
    // A Source is cited evidence: paper fill and neutral ink. It is never tinted by
    // the concept colour, even though it is a content unit.
    '.nn-ku[data-ku-home=source]>.nn-ku-label{color:var(--nn-muted)}',
    '.nn-ku[data-ku-home=source]>.nn-ku-value{color:var(--nn-text)}',
    '.nn-ku[data-ku-home=source] .nn-ku-icon{color:var(--nn-muted)}',
    // Field badges carry free text: under card fields they grow to fill the row,
    // while in tables/grids they remain compact inline-flex elements.
    '.nn-card-fields>.nn-ku-unit>.nn-ku[data-ku-kind=field],.nn-card-fields>.nn-ku[data-ku-kind=field]{flex:1 1 16em;align-items:flex-start;font-size:.92rem;line-height:1.5;padding:.4em .6em;gap:.45em}',
    '.nn-ku[data-ku-kind=field]{min-width:0;align-items:center;line-height:1.3}',
    '.nn-ku[data-ku-kind=field] .nn-ku-label{flex:0 0 auto;white-space:nowrap;font-weight:600}',
    '.nn-ku[data-ku-kind=field] .nn-ku-value{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;text-align:left}',
    '.nn-ku[data-ku-kind=field] .nn-ku-icon{margin-top:.18em}',
    '.nn-ku .nn-ku-values{display:inline-flex;flex-wrap:wrap;gap:.25em}',
    '.nn-ku .nn-ku-value-chip{display:inline-flex;align-items:center;border:1px solid var(--nn-border);border-radius:999px;padding:0 .5em;font-size:.85em}',
    // Field pairs read as TWO badges: the field NAME as its own chip and the VALUE
    // as its own chip. Only `FieldRow` marks its unit `data-ku-pair=field`; every
    // other `value` unit passes its text as the label and keeps the single badge.
    // Field edits belong to the admin/agent, not the console, so the name chip
    // carries no affordance of its own — the value badge keeps the `+` flyout.
    // `[data-ku-kind=value]` is repeated to out-specify the nature rules that
    // `ensureKuCss` injects in a later sheet at equal specificity.
    '.nn-ku[data-ku-pair=field][data-ku-kind=value]{flex:1 1 auto;background:transparent;border:0;gap:.3em;padding:0;align-items:center;min-width:0}',
    // The name chip is a FIXED column so every value in the sheet starts on the
    // same x. A name longer than the column ellipsizes; the chip keeps the `title`
    // `Ku` already set, so the full name stays reachable.
    '.nn-ku[data-ku-pair=field][data-ku-kind=value]>.nn-ku-label{box-sizing:content-box;flex:0 0 var(--nn-field-name-w,17ch);width:var(--nn-field-name-w,17ch);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--nn-mono);font-size:.76rem;font-weight:600;color:var(--nn-muted);background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:.35em;padding:.1em .45em}',
    '.nn-ku[data-ku-pair=field][data-ku-kind=value]>.nn-ku-icon{display:none}',
    '.nn-ku[data-ku-pair=field][data-ku-kind=value]>.nn-ku-value{min-width:0;color:var(--nn-text);background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:.35em;padding:.1em .45em}',
    '.nn-ku[data-ku-pair=field][data-ku-kind=value][data-field-empty=true]>.nn-ku-value{display:none}',
    // Long values (markdown / long_description) wrap instead of truncating.
    '.nn-ku[data-ku-pair=field][data-ku-kind=value][data-field-wide=true]{align-items:flex-start}',
    '.nn-ku[data-ku-pair=field][data-ku-kind=value][data-field-wide=true]>.nn-ku-value{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;text-align:left}',
    '.nn-ku[data-ku-changes]{border-style:dashed}',
    '.nn-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px}',
    '.nn-kpi-card{background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:var(--nn-radius);padding:14px 16px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--nn-shadow)}',
    '.nn-kpi-header{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.nn-kpi-value{font-size:1.4rem;font-weight:700;color:var(--nn-text);line-height:1.2}',
    '.nn-kpi-hint{font-size:.78rem;color:var(--nn-muted)}',
    // Data surfaces (Table / MatrixGrid / Timeline): one token-driven grid. The
    // scroll wrapper is the ONLY horizontal scroll port, so a wide matrix never
    // widens the page (the old bug: a missing Tailwind `overflow-x-auto`).
    '.nn-grid-scroll{max-width:100%;min-width:0;overflow:auto;border:1px solid var(--nn-border);border-radius:var(--nn-radius);background:var(--nn-surface)}',
    '.nn-grid-scroll+.nn-grid-scroll{margin-top:.6rem}',
    '.nn-grid{border-collapse:separate;border-spacing:0;width:100%;font-size:.82rem;color:var(--nn-text)}',
    '.nn-grid th,.nn-grid td{padding:.4em .65em;border-bottom:1px solid var(--nn-border);text-align:left;vertical-align:middle}',
    '.nn-grid thead th{position:sticky;top:0;z-index:2;background:var(--nn-surface-2);color:var(--nn-muted);font-weight:600;font-size:.75rem;white-space:nowrap}',
    '.nn-grid tbody tr:last-child>th,.nn-grid tbody tr:last-child>td{border-bottom:0}',
    '.nn-grid tbody tr:hover>td,.nn-grid tbody tr:hover>.nn-grid-rowhead{background:var(--nn-surface-2)}',
    '.nn-grid-cell--center{text-align:center}',
    '.nn-grid-cell--end{text-align:right}',
    '.nn-grid-corner,.nn-grid-rowhead{text-align:left;font-weight:600;color:var(--nn-text)}',
    '.nn-grid-empty{padding:1em .8em;color:var(--nn-muted);text-align:center}',
    // Pinned first column: the corner + every row header stick to the left edge
    // and rise above the horizontally scrolled cells.
    '.nn-grid-scroll[data-pin-first=true] .nn-grid-corner{position:sticky;left:0;z-index:3;background:var(--nn-surface-2)}',
    '.nn-grid-scroll[data-pin-first=true] .nn-grid-rowhead{position:sticky;left:0;z-index:1;background:var(--nn-surface)}',
    '.nn-grid-scroll[data-pin-first=true] .nn-grid tbody tr:nth-child(even)>.nn-grid-rowhead{background:var(--nn-surface-2)}',
    '.nn-grid-scroll[data-pin-first=true] .nn-grid tbody tr:hover>.nn-grid-rowhead{background:var(--nn-surface-2)}',
    // FilterSelect: the shared multi-select facet (state, months, tags).
    '.nn-filter{position:relative;display:inline-block}',
    '.nn-filter-summary{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;font:inherit;font-size:.8rem;font-weight:600;color:var(--nn-text);background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);cursor:pointer;list-style:none}',
    '.nn-filter[open] .nn-filter-summary{border-color:var(--nn-link)}',
    '.nn-filter-summary::-webkit-details-marker{display:none}',
    '.nn-filter-menu{position:absolute;top:calc(100% + 4px);left:0;z-index:50;min-width:220px;max-height:340px;overflow-y:auto;background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:var(--nn-radius);box-shadow:0 10px 25px -5px rgba(0,0,0,.15);padding:6px}',
    '.nn-filter-quick{display:flex;flex-wrap:wrap;gap:4px;padding:2px 4px 6px;margin-bottom:4px;border-bottom:1px solid var(--nn-border)}',
    '.nn-filter-quick button{appearance:none;border:1px solid var(--nn-border);background:var(--nn-surface);color:var(--nn-text);font:inherit;font-size:.72rem;padding:2px 8px;border-radius:999px;cursor:pointer}',
    '.nn-filter-quick button:hover{border-color:var(--nn-link);color:var(--nn-link)}',
    '.nn-filter-option{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--nn-radius-sm);font-size:.82rem;cursor:pointer}',
    '.nn-filter-option:hover{background:var(--nn-surface-2)}',
    '.nn-filter-option input{flex:0 0 auto}',
    '.nn-filter-option-label{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.nn-filter-option-count{font-family:var(--nn-mono);font-size:.72rem;color:var(--nn-muted)}',
    '.nn-ku-change-pip{position:absolute;top:-.5em;right:-.5em;min-width:1.2em;height:1.2em;padding:0 .25em;display:inline-flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;line-height:1;border-radius:999px;background:var(--nn-status-pending-bg);color:var(--nn-status-pending);border:1px solid var(--nn-status-pending);cursor:pointer}',
    // ONE affordance sits beside the badge: a borderless "+". The actions float
    // BELOW it on demand, so they take no inline space and never push a neighbour.
    '.nn-ku-more{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--nn-muted);cursor:pointer;flex:0 0 auto}',
    '.nn-ku-more:hover,.nn-ku-more[aria-expanded=true]{color:var(--nn-text);background:var(--nn-surface-2)}',
    '.nn-ku-more:focus-visible{outline:2px solid var(--nn-focus);outline-offset:1px}',
    '.nn-ku-actions{position:fixed;z-index:60;display:none;align-items:center;gap:.1em;padding:.2em;background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap}',
    '.nn-ku-wrap[data-ku-open=true]>.nn-ku-actions{display:inline-flex}',
    '.nn-ku-action{appearance:none;border:1px solid transparent;background:transparent;color:var(--nn-muted);font:inherit;padding:.1em .3em;border-radius:var(--nn-radius-sm);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px}',
    '.nn-ku-action:hover{color:var(--nn-text);border-color:var(--nn-border);background:var(--nn-surface-2)}',
    '.nn-ku-action[data-ku-action=edit]:hover{color:var(--nn-link)}',
    '.nn-ku-action:focus-visible{outline:2px solid var(--nn-focus);outline-offset:1px}',
    // Citation dialog: ONE CARD per cited source (was a flat list of siblings, so
    // you could not tell where one citation ended and the next began).
    '.nn-cite-list{display:grid;gap:.7rem}',
    '.nn-cite-card+.nn-cite-card{margin-top:.7rem}',
    '.nn-cite-card{border:1px solid var(--nn-border);border-left:4px solid var(--nn-origin-document);border-radius:var(--nn-radius);padding:.7rem .8rem;display:grid;gap:.5rem;background:var(--nn-surface)}',
    '.nn-cite-card[data-origin=agent]{border-left-color:var(--nn-origin-agent)}',
    '.nn-cite-card[data-origin=human]{border-left-color:var(--nn-origin-human)}',
    '.nn-cite-card[data-origin=reviewer]{border-left-color:var(--nn-origin-reviewer)}',
    '.nn-cite-card[data-origin=error]{border-left-color:var(--nn-origin-error)}',
    '.nn-cite-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}',
    '.nn-cite-prov{display:inline-flex;align-items:center;gap:.3rem;font-size:.76rem;color:var(--nn-muted)}',
    '.nn-cite-prov svg{width:13px;height:13px}',
    '.nn-cite-status{margin-left:auto;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.15em .5em;border-radius:999px;background:var(--nn-surface-2);color:var(--nn-muted)}',
    '.nn-cite-status.is-bad{background:var(--nn-origin-error);color:#fff}',
    '.nn-cite-meta{margin:0;display:grid;grid-template-columns:max-content minmax(0,1fr);gap:.25rem .6rem;font-size:.78rem}',
    '.nn-cite-meta dt{color:var(--nn-muted)}',
    '.nn-cite-meta dd{margin:0;overflow-wrap:anywhere;font-family:ui-monospace,monospace;font-size:.74rem}',
    '.nn-cite-excerpt{margin:0;padding:.5rem .6rem;background:var(--nn-surface-2);border-radius:var(--nn-radius-sm);font-family:ui-monospace,monospace;font-size:.74rem;line-height:1.45;white-space:pre-wrap;max-height:9em;overflow:auto}',
    '.nn-cite-open{justify-self:start;font-size:.78rem;font-weight:600;color:var(--nn-link)}',
    // Filter: the AND/OR segmented control and the two-step field facet.
    '.nn-op-toggle{display:inline-flex;align-items:center;border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);overflow:hidden}',
    '.nn-op-btn{appearance:none;border:0;background:transparent;color:var(--nn-muted);font:inherit;font-size:.68rem;font-weight:800;letter-spacing:.04em;padding:.1em .5em;cursor:pointer;text-transform:uppercase}',
    '.nn-op-btn:hover{background:var(--nn-surface-2);color:var(--nn-text)}',
    '.nn-op-btn.active{background:var(--nn-accent);color:var(--nn-surface)}',
    '.nn-facet-back{appearance:none;border:0;background:transparent;color:var(--nn-muted);font:inherit;font-size:.72rem;padding:.3em .5em;cursor:pointer;text-align:left;width:100%}',
    '.nn-facet-back:hover{color:var(--nn-text);background:var(--nn-surface-2)}',
    '.nn-facet-input{font:inherit;font-size:.78rem;padding:.25em .4em;border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);background:var(--nn-surface);color:var(--nn-text);width:100%}',
    // View tabs carry a TONE by where the view comes from: the three core views are
    // purple, a bluepriNNt view is blue, a domaiNN/user view is black.
    '.nn-view-tabs .nn-view-tab.tone-core{color:#6d28d9}',
    '.nn-view-tabs .nn-view-tab.tone-blueprint{color:#2563eb}',
    '.nn-view-tabs .nn-view-tab.tone-custom{color:var(--nn-text,#0a0a0a)}',
    // Structure warning inside the edit modal (the structure pencil is ungated).
    '.nn-edit-warn{display:flex;align-items:flex-start;gap:.6rem;padding:.7rem 1.25rem;border-bottom:1px solid var(--nn-status-pending);background:var(--nn-status-pending-bg);color:var(--nn-status-pending);font-size:.82rem;line-height:1.45}',
    '.nn-edit-warn-icon{flex:0 0 auto;display:inline-flex;margin-top:.1rem}',
    '.nn-edit-warn strong{display:block;margin-bottom:.15rem}',
    // "Proposing as ..." inside the edit modal (just-in-time identity).
    '.nn-propose-as{padding:.45rem 1.25rem;border-bottom:1px solid var(--nn-border);font-size:.78rem;color:var(--nn-muted)}',
    '.nn-propose-as[data-default=true]{color:var(--nn-status-pending);background:var(--nn-status-pending-bg)}',
    '.nn-card-fields{display:flex;flex-direction:column;gap:.45em;align-items:stretch;margin:.6em 0 0}',
    '.nn-card-desc-actions{margin-left:.4em}',
    // Element-card Dense Row (V01): a one-line bar (image chip, name, concept,
    // markers, field count, actions, chevron) over a collapsible body.
    // Scoped to the element-card so it wins over any shell-level card styles.
    '[data-nn-component=element-card] .nn-card-head{display:flex;align-items:center;gap:.5em;flex-wrap:wrap;cursor:pointer;min-width:0}',
    '[data-nn-component=element-card] .nn-card-badges{display:inline-flex;align-items:center;gap:.35em;min-width:0}',
    '[data-nn-component=element-card] .nn-card-badges .nn-ku{display:inline-flex;align-items:center}',
    '[data-nn-component=element-card] .nn-card-thumb{width:40px;height:40px;border-radius:7px;object-fit:cover;border:1.5px solid var(--nn-border);background:var(--nn-surface-2);flex:0 0 auto;display:block}',
    '.nn-field-image-wrap{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '[data-nn-component=element-card] .nn-card-thumb--empty,[data-nn-component=element-card] .nn-card-thumb--concept{display:inline-flex;align-items:center;justify-content:center;color:var(--card-concept-color,var(--nn-accent));background:var(--card-concept-bg,var(--nn-surface-2));border:1.5px solid var(--card-concept-color,var(--nn-border))}',
    '[data-nn-component=element-card] .nn-card-count{font-size:.75rem;font-weight:600;color:var(--nn-muted);background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:999px;padding:1px 8px;white-space:nowrap;flex:0 0 auto}',
    '[data-nn-component=element-card] .nn-card-toggle{appearance:none;border:1px solid transparent;background:transparent;color:var(--nn-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:.15em;border-radius:var(--nn-radius-sm);flex:0 0 auto}',
    '[data-nn-component=element-card] .nn-card-toggle:hover{color:var(--nn-text);border-color:var(--nn-border);background:var(--nn-surface)}',
    '[data-nn-component=element-card] .nn-card-toggle .nn-icon{transition:transform .15s ease}',
    '[data-nn-component=element-card][data-open=true] .nn-card-toggle .nn-icon{transform:rotate(180deg)}',
    '[data-nn-component=element-card][data-open=false] .nn-card-body{display:none}',
    '[data-nn-component=element-card][data-open=false] .nn-card-footer{display:none}',
    '[data-nn-component=element-card][data-open=true] .nn-card-collapsed-strip{display:none!important}',
    '[data-nn-component=element-card][data-open=true] .nn-card-summary-preview{display:none}',
    '[data-nn-component=element-card] .nn-card-summary-preview{font-size:.82rem;color:var(--nn-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:34ch;margin-left:.25em}',
    '[data-nn-component=element-card] .nn-card-status-pill{display:inline-flex;align-items:center;gap:.28em;font-size:.72rem;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--nn-status-applied-bg);color:var(--nn-status-applied);border:1px solid rgba(22,101,52,.22);white-space:nowrap}',
    '[data-nn-component=element-card] .nn-card-status-pill[data-status=draft],[data-nn-component=element-card] .nn-card-status-pill[data-status=pending]{background:var(--nn-status-pending-bg);color:var(--nn-status-pending);border-color:rgba(180,83,9,.22)}',
    '[data-nn-component=element-card] .nn-card-collapsed-strip{display:flex;align-items:center;justify-content:space-between;gap:.65em;padding:7px 12px;margin:8px -12px -10px -12px;background:var(--nn-surface-2);border-top:1px solid var(--nn-border);border-radius:0 0 var(--nn-radius) var(--nn-radius);flex-wrap:wrap}',
    '.nn-collapsed-strip-left,.nn-collapsed-strip-right{display:inline-flex;align-items:center;gap:.4em;flex-wrap:wrap;min-width:0}',
    '.nn-strip-group{display:inline-flex;align-items:center;gap:.35em;flex-wrap:wrap}',
    '.nn-strip-key{font-family:var(--nn-mono);font-size:.73rem;font-weight:600;color:var(--nn-muted);margin-right:.15em}',
    '.nn-obj-chips{display:inline-flex;align-items:center;gap:.35em;flex-wrap:wrap}',
    '.nn-obj-chip{display:inline-flex;align-items:center;border:1px solid var(--nn-border);border-radius:5px;overflow:hidden;font-family:var(--nn-mono);font-size:.73rem;line-height:1.25;background:var(--nn-surface)}',
    '.nn-obj-chip-k{padding:2px 6px;background:var(--nn-surface-2);color:var(--nn-muted);border-right:1px solid var(--nn-border);font-weight:500}',
    '.nn-obj-chip-v{padding:2px 6px;color:var(--nn-text);font-weight:600}',
    '.nn-obj-chip-v[data-bool=true]{color:var(--nn-status-applied)}',
    '.nn-strip-rel{display:inline-flex;align-items:center;gap:.25em;font-size:.75rem;font-weight:600;color:var(--nn-accent);background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:6px;padding:2px 8px;text-decoration:none;white-space:nowrap}',
    '.nn-strip-rel:hover{border-color:var(--nn-accent);background:var(--nn-surface-2)}',
    '.nn-file-pill{display:inline-flex;align-items:center;gap:.35em;background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:6px;padding:2px 8px;font-family:var(--nn-mono);font-size:.76rem;color:var(--nn-text)}',
    '.nn-file-pill-icon{display:inline-flex;color:var(--nn-accent)}',
    '.nn-file-pill-path{font-family:inherit;font-size:inherit;background:transparent;padding:0;border:none}',
    '.nn-markdown{display:block;font-size:.88rem;line-height:1.5;color:var(--nn-text);overflow-wrap:anywhere}',
    '.nn-markdown>:first-child{margin-top:0}',
    '.nn-markdown>:last-child{margin-bottom:0}',
    '.nn-markdown p{margin:.4em 0}',
    '.nn-markdown ul,.nn-markdown ol{margin:.4em 0;padding-left:1.4em}',
    '.nn-markdown .nn-md-heading{margin:.6em 0 .3em;font-size:1rem;font-weight:700}',
    '.nn-markdown code{font-family:var(--nn-mono);font-size:.82em;background:var(--nn-surface-2);border-radius:4px;padding:0 .3em}',
    '.nn-markdown a{color:var(--nn-link);text-decoration:underline}',
    '.nn-markdown .nn-md-quote{margin:.5em 0;padding:.2em .8em;border-left:1px solid var(--nn-border);color:var(--nn-muted)}',
    '.nn-markdown .nn-md-quote[data-callout]{border-left-color:var(--nn-accent);background:var(--nn-surface-2)}',
    '.nn-markdown .nn-md-callout-title{display:block;font-size:.72rem;letter-spacing:.04em;color:var(--nn-accent)}',
    '.nn-file-pill[data-knowledge-bound=true]{cursor:pointer}',
    '.nn-file-pill[data-knowledge-bound=true]:hover{border-color:var(--nn-accent)}',
    '.nn-tag[role=button]{cursor:pointer}',
    '.nn-tag[role=button]:hover{border-color:var(--nn-link)}',
    '.nn-card-meta-strip{display:flex;align-items:center;justify-content:space-between;gap:.5em;flex-wrap:wrap;padding:6px 10px;margin:.55em 0;background:var(--nn-surface-2);border:1px solid var(--nn-border);border-radius:6px}',
    '.nn-lineage-pill{display:inline-flex;align-items:center;gap:.3em;font-family:var(--nn-mono);font-size:.73rem;color:var(--nn-muted);background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:5px;padding:2px 7px}',
    '[data-nn-component=element-card] .nn-card-fields{display:flex;flex-direction:column;gap:0;align-items:stretch;margin:.6em 0 0;border:1px solid var(--nn-border);border-radius:var(--nn-radius-sm);overflow:hidden;background:var(--nn-surface)}',
    // One field per row: a hairline divides the rows and the padding gives the
    // list room to breathe (the container itself carried `gap:0` since the rows
    // used to draw their own separator, which no longer matched).
    '[data-nn-component=element-card] .nn-card-fields>.nn-ku-wrap{display:flex;align-items:flex-start;gap:.7em;padding:.6em .9em;border-bottom:1px solid var(--nn-border)}',
    '[data-nn-component=element-card] .nn-card-fields>.nn-ku-wrap:last-child{border-bottom:0}',
    // ElementMini (collection item): accent stripe + small thumb + name + optional meta. No fields.
    '.nn-mini{display:flex;align-items:center;gap:.5em;background:var(--nn-surface);border:1px solid var(--nn-border);border-left:1px solid var(--nn-border);border-radius:8px;padding:.32em .55em .32em .45em;min-width:0;max-width:100%;text-align:left}',
    'button.nn-mini,a.nn-mini{font:inherit;color:inherit;cursor:pointer;text-decoration:none}',
    '.nn-mini:hover{border-color:var(--nn-mini-accent,var(--nn-focus))}',
    '.nn-mini-thumb{width:20px;height:20px;border-radius:5px;flex:0 0 auto}',
    '.nn-mini-text{display:flex;flex-direction:column;min-width:0;flex:1 1 auto}',
    '.nn-mini-name{font-size:.8rem;font-weight:600;color:var(--nn-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.nn-mini-meta{font-size:.68rem;color:var(--nn-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.nn-mini>.nn-card-status-pill{flex:0 0 auto}',
    // ElementPreview (generic floating detail) + the mini's info affordance.
    '.nn-preview{position:fixed;z-index:60;width:clamp(26rem,60vw,52rem);max-width:calc(100vw - 1.5rem);max-height:calc(100vh - 1.5rem);overflow:auto;overscroll-behavior:contain;background:var(--nn-surface);border:1px solid var(--nn-border);border-radius:var(--nn-radius,10px);box-shadow:0 12px 32px rgba(0,0,0,.16);padding:.6rem .8rem}',
    '.nn-preview[hidden]{display:none}',
    '.nn-preview .nn-card{border:none;box-shadow:none;margin:0}',
    '.nn-mini-info{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:none;background:transparent;color:var(--nn-muted);cursor:pointer;border-radius:50%}',
    '.nn-mini-info:hover,.nn-mini-info[aria-expanded=true]{color:var(--nn-text);background:var(--nn-surface-2)}',
    '.nn-navbar-actions-group{display:inline-flex;align-items:center;gap:.5rem}',
    '.nn-navbar-action-btn{appearance:none;border:1px solid var(--nn-border);background:var(--nn-surface);color:var(--nn-text);font:inherit;font-size:.8rem;font-weight:600;padding:5px 12px;border-radius:var(--nn-radius-sm);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .15s ease,border-color .15s ease;line-height:1.2}',
    '.nn-navbar-action-btn:hover{background:var(--nn-surface-2);border-color:var(--nn-focus)}',
    '.nn-navbar-action-btn:focus-visible{outline:2px solid var(--nn-focus);outline-offset:1px}',
    '.nn-navbar-action-btn .nn-btn-icon{display:inline-flex;align-items:center;color:var(--nn-muted)}',
    '.nn-navbar-action-btn:hover .nn-btn-icon{color:var(--nn-text)}',
    '.nn-navbar-action-btn .nn-badge-count{margin-left:4px;font-size:.72rem;background:var(--nn-accent);color:var(--nn-bg);padding:1px 6px;border-radius:999px;font-weight:700}',
  ]
  for (var slot = 1; slot <= 12; slot++) {
    COMPONENT_CSS.push(
      '[data-concept-slot="' + slot + '"] .nn-concept-dot{background:var(--nn-concept-' + slot + ')}',
    )
  }
  for (var kslot = 1; kslot <= 12; kslot++) {
    COMPONENT_CSS.push(
      '[data-nn-component=element-card][data-concept-slot="' + kslot + '"]{--card-concept-color:var(--nn-concept-' + kslot + ');--card-concept-bg:var(--nn-concept-' + kslot + '-bg);border-left:4px solid var(--nn-concept-' + kslot + ')}',
      // The concept slot drives --c/--cb on the badge: content text + icon, the
      // structure border, and the concept/document tint all read from it.
      '[data-nn-component=ku-unit][data-concept-slot="' + kslot + '"]{--c:var(--nn-concept-' + kslot + ');--cb:var(--nn-concept-' + kslot + '-bg)}',
      '[data-nn-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=concept],[data-nn-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=document]{background:var(--nn-concept-' + kslot + '-bg);border-color:var(--nn-concept-' + kslot + ')}',
      '[data-nn-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=concept] .nn-ku-icon,[data-nn-component=ku-unit][data-concept-slot="' + kslot + '"][data-ku-kind=document] .nn-ku-icon{color:var(--nn-concept-' + kslot + ')}',
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

  var TOKENS_ATTR = 'data-nn-tokens'

  function ensureTokens(doc) {
    var d = doc || (typeof document !== 'undefined' ? document : null)
    if (!d || !d.head) throw new Error('nnUI.ensureTokens: no document')
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
    if (!d || !d.documentElement) throw new Error('nnUI.setTheme: no document')
    if (theme !== 'light' && theme !== null) {
      throw new TypeError('nnUI.setTheme: expected light|null')
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
  // of nn-runtime.js's former svgIcon.
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
      if (typeof nnIcons !== 'undefined' && typeof nnIcons.getSvg === 'function') {
        return nnIcons.getSvg(name, { size: s, class: 'nn-icon' + c })
      }
      return (
        '<svg class="nn-icon' +
        c +
        '" width="' +
        s +
        '" height="' +
        s +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
      )
    }
    return (
      '<svg class="nn-icon' +
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.TagRow: data required')
    var doc = resolveDoc(opts)
    var tags = Array.isArray(data.tags) ? data.tags : []
    var onTag = opts && typeof opts.onTag === 'function' ? opts.onTag : null
    var row = makeEl(doc, 'div', 'nn-tag-row')
    row.setAttribute('data-nn-component', 'tag-row')
    tags.forEach(function (t) {
      var tag = makeEl(doc, 'span', 'nn-tag')
      tag.setAttribute('data-tag', String(t))
      tag.setAttribute('data-concept-slot', String(tagSlot(t)))
      tag.appendChild(doc.createTextNode(String(t)))
      if (onTag) {
        tag.setAttribute('role', 'button')
        tag.setAttribute('tabindex', '0')
        tag.setAttribute('title', 'Filter by tag ' + String(t))
        tag.addEventListener('click', function (ev) {
          // The review +/x controls live inside the chip and keep their own action.
          var inner = ev && ev.target && typeof ev.target.closest === 'function' && ev.target.closest('[data-nn-ctl]')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.RelList: data required')
    var doc = resolveDoc(opts)
    var rels = Array.isArray(data.relations) ? data.relations : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var relModel = data.model || (opts && (opts.modelId || opts.model)) || 'model'
    var ul = makeEl(doc, 'ul', 'nn-rel-list')
    ul.setAttribute('data-nn-component', 'rel-list')
    rels.forEach(function (r) {
      if (!r || typeof r !== 'object') return
      var li = makeEl(doc, 'li', 'nn-rel-row')
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
    var btn = makeEl(doc, 'button', 'nn-edit-anchor')
    btn.setAttribute('data-nn-component', 'edit-anchor')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.StatusBadge: data required')
    if (STATUSES.indexOf(data.status) === -1) {
      throw new TypeError('nnUI.StatusBadge: unknown status "' + data.status + '"')
    }
    var doc = resolveDoc(null)
    var badge = makeEl(doc, 'span', 'nn-status-badge')
    badge.setAttribute('data-nn-component', 'status-badge')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.CitationIcon: data required')
    var doc = resolveDoc(opts)
    var variant = data.variant || 'document'
    var btn = makeEl(doc, 'button', 'cite-icon')
    btn.setAttribute('data-nn-component', 'citation-icon')
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
  // show), so `ElementCard` can append it to `.nn-card-head` via `opts.head`.
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
    var root = makeEl(doc, 'div', 'nn-markdown')
    root.setAttribute('data-nn-component', 'markdown')
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
        var h = makeEl(doc, 'h' + hm[1].length, 'nn-md-heading')
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
        var bq = makeEl(doc, 'blockquote', 'nn-md-quote')
        var co = /^\[!([A-Za-z]+)\]\s*$/.exec(quoted[0])
        if (co && MD_CALLOUTS.indexOf(co[1].toLowerCase()) !== -1) {
          bq.setAttribute('data-callout', co[1].toLowerCase())
          bq.appendChild(makeEl(doc, 'strong', 'nn-md-callout-title', co[1].toUpperCase()))
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
  // legacy aliases older payloads still emit. `reference` is resolved by FieldRow to
  // a Ku from data.ref; a field carrying resolved citations (`data.citations`) is
  // rendered by the citation value renderer (renderFieldCitation) — value plus the
  // clickable icon, as part of the VALUE. Value-shape renderers (boolean / list /
  // object / url) and shape heuristics (image / asset path) run regardless of the
  // declared type, matching the console's runtime-detected payloads.
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
    var b = makeEl(doc, 'span', 'nn-field-bool', d.value ? 'Yes' : 'No')
    b.setAttribute('data-value', d.value ? 'true' : 'false')
    return b
  }

  function renderFieldSelect(d, doc) {
    var v = d.value == null ? '' : String(d.value)
    if (!v.trim()) return null
    var pill = makeEl(doc, 'span', 'nn-field-select', v)
    pill.setAttribute('data-value', v)
    return pill
  }

  function renderFieldUrl(d, doc) {
    var a = makeEl(doc, 'a', 'nn-field-url', d.value)
    a.setAttribute('href', d.value)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
    return a
  }

  // A citation field's VALUE: the value text plus the clickable citation icon(s),
  // rendered as PART OF THE VALUE (inside the badge), not bolted onto the row. The
  // icon opens the citation through `onCite`. Driven by the resolved `citations`
  // (the export resolves every citation-typed field, including the reserved
  // `sources`), so it is a standard value renderer, not a per-case special.
  function renderFieldCitation(d, doc, opts) {
    var wrap = makeEl(doc, 'span', 'nn-field-citation')
    var text = fieldValueText(d.value)
    if (text) wrap.appendChild(makeEl(doc, 'span', 'nn-ku-value-text', text))
    var citations = Array.isArray(d.citations) ? d.citations : []
    if (citations.length) {
      var seen = {}
      var variants = citations.map(originVariantOf)
      ;['error', 'agent', 'human', 'reviewer', 'document'].forEach(function (v) {
        if (seen[v]) return
        seen[v] = true
        if (variants.indexOf(v) === -1) return
        var entry = null
        for (var i = 0; i < citations.length; i++) {
          if (originVariantOf(citations[i]) === v) {
            entry = citations[i]
            break
          }
        }
        wrap.appendChild(
          CitationIcon({ variant: v, field: d.name, value: d.value, entry: entry }, {
            onOpen: opts && opts.onCite ? opts.onCite : undefined,
          }),
        )
      })
    }
    return wrap
  }

  function renderFieldCode(d, doc) {
    return makeEl(doc, 'code', 'nn-field-code', d.value == null ? '' : String(d.value))
  }

  function renderFieldMarkdown(d, doc) {
    var node = Markdown(d.value, { doc: doc })
    node.className = 'nn-markdown nn-field-markdown'
    return node
  }

  function renderFieldList(d, doc) {
    return makeEl(doc, 'span', 'nn-ku-value nn-field-list', d.value.map(String).join(', '))
  }

  function renderFieldObject(d, doc) {
    var chipWrap = makeEl(doc, 'span', 'nn-ku-value nn-obj-chips')
    Object.keys(d.value).forEach(function (k) {
      var chip = makeEl(doc, 'span', 'nn-obj-chip')
      chip.appendChild(makeEl(doc, 'span', 'nn-obj-chip-k', k))
      var rawV = d.value[k]
      var vNode = makeEl(doc, 'span', 'nn-obj-chip-v', rawV == null ? '' : String(rawV))
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
    var imgWrap = makeEl(doc, 'span', 'nn-ku-value nn-field-image-wrap')
    var img = makeEl(doc, 'img', 'nn-field-image')
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
    imgWrap.appendChild(makeEl(doc, 'code', 'nn-file-pill-path', normImgPath))
    return imgWrap
  }

  function renderFieldFile(d, doc) {
    var raw = String(d.value == null ? '' : d.value)
      .replace(/^\[\[\s*/, '')
      .replace(/\s*\]\]$/, '')
    var cleanPath = normalizeAssetPath(raw)
    var filePill = makeEl(doc, 'span', 'nn-ku-value nn-file-pill')
    var fileIcon = makeEl(doc, 'span', 'nn-file-pill-icon')
    fileIcon.innerHTML = icon('cite-document', 12)
    filePill.appendChild(fileIcon)
    filePill.appendChild(makeEl(doc, 'code', 'nn-file-pill-path', cleanPath))
    return filePill
  }

  function renderFieldMedia(d, doc) {
    if (typeof d.value !== 'string' || !d.value.trim()) return null
    var src = normalizeAssetPath(d.value)
    // Only a relative path or an http(s) URL may become a media src; anything else
    // (javascript:, data:, ...) falls back to the plain text value.
    if (!safeHref(src)) return null
    var tag = String(d.type || '').toLowerCase() === 'audio' ? 'audio' : 'video'
    var media = makeEl(doc, tag, 'nn-field-media')
    media.setAttribute('controls', 'controls')
    media.setAttribute('src', src)
    media.setAttribute('preload', 'metadata')
    var wrap = makeEl(doc, 'span', 'nn-ku-value nn-field-media-wrap')
    wrap.appendChild(media)
    wrap.appendChild(makeEl(doc, 'code', 'nn-file-pill-path', src))
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

    // 2. A field carrying resolved citations is a citation: the value plus the
    // clickable citation icon(s), rendered as part of the value.
    if (Array.isArray(d.citations) && d.citations.length) {
      return renderFieldCitation(d, doc, opts)
    }

    // 3. Declared-type renderer.
    var byType = FIELD_RENDERERS[type]
    if (byType) {
      var typed = byType(d, doc, opts)
      if (typed) return typed
    }

    // 4. Shape heuristics for values with no declared (or recognized) type.
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

  // A field PAIR on an element: the field NAME and its VALUE, each rendered as
  // its own badge (a name chip + the `value` knowledge unit). The field's
  // definition unit lives in the table header / concept section, never here.
  // The unit is marked `data-ku-pair=field` so the two-badge grammar applies
  // here only: every other `value` unit (table cells, guide/doc fields, matrix
  // cells) passes its TEXT as `label`, so it must keep the single-badge look.
  function FieldRow(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.FieldRow: data required')
    var doc = resolveDoc(opts)
    var hasRef = !!(data.ref && data.ref.id)
    var inherited = data.inherited && data.inherited.from ? data.inherited : null
    var model = data.model || (opts && (opts.modelId || opts.model)) || 'model'
    var element = data.element || (opts && opts.element) || data.elementId || 'unit'
    var typedValue = hasRef ? null : FieldValue(data, opts)
    var valueNode = typedValue
    if (!valueNode) {
      valueNode = makeEl(doc, 'span', 'nn-ku-value-text', fieldValueText(data.value))
    }
    if (hasRef) {
      valueNode = makeEl(doc, 'span', 'nn-ku-value-text')
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
        var refBadge = refUnit.querySelector('[data-nn-component="ku-unit"]')
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
    var badge = wrap.querySelector('[data-nn-component="ku-unit"]')
    if (badge) {
      badge.setAttribute('data-ku-pair', 'field')
      badge.setAttribute('data-field', String(data.name == null ? '' : data.name))
      if (inherited) {
        badge.setAttribute('data-ku-inherited', String(inherited.from))
        badge.setAttribute('aria-label', 'content, inherited from ' + inherited.from + ': ' + label)
      }
      var hasValue =
        hasRef ||
        !!typedValue ||
        (Array.isArray(data.citations) && data.citations.length > 0) ||
        fieldValueText(data.value) !== ''
      if (!hasValue) badge.setAttribute('data-field-empty', 'true')
      var ftype = String(data.type || '').toLowerCase()
      if (
        ftype === 'markdown' ||
        ftype === 'markdown_inline' ||
        (typeof data.value === 'string' && data.value.length > 70)
      ) {
        badge.setAttribute('data-field-wide', 'true')
      }
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
      var ph = makeEl(doc, 'span', 'nn-card-thumb nn-card-thumb--concept nn-card-thumb--empty')
      ph.setAttribute('data-concept-icon', conceptIconName)
      ph.setAttribute('title', String(data.conceptId || 'Element'))
      ph.setAttribute('aria-hidden', 'true')
      ph.innerHTML = icon(conceptIconName, iconSize || 18)
      return ph
    }
    if (imageField) {
      var thumb = makeEl(doc, 'img', 'nn-card-thumb')
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
    _previewHost = makeEl(doc, 'div', 'nn-preview')
    _previewHost.setAttribute('data-nn-component', 'element-preview')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.ElementMini: data required')
    var doc = resolveDoc(opts)
    var tag = opts && opts.href ? 'a' : opts && opts.onSelect ? 'button' : 'div'
    var mini = makeEl(doc, tag, 'nn-mini')
    mini.setAttribute('data-nn-component', 'element-mini')
    mini.setAttribute('data-element-id', String(data.id == null ? '' : data.id))
    if (data.conceptId) mini.setAttribute('data-concept-id', String(data.conceptId))
    var conceptOpts = (opts && opts.concept) || {}
    var slot = conceptSlot({
      index: data.index != null ? data.index : conceptOpts.index,
      color: data.color || conceptOpts.color,
    })
    mini.setAttribute('data-concept-slot', String(slot))
    mini.style.setProperty('--nn-mini-accent', 'var(--nn-concept-' + slot + ')')
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
    thumb.classList.add('nn-mini-thumb')
    mini.appendChild(thumb)
    var badgesWrap = makeEl(doc, 'div', 'nn-card-badges')
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
      var metaEl = makeEl(doc, 'span', 'nn-mini-meta', String(data.meta))
      mini.appendChild(metaEl)
    }
    if (data.status) {
      var st = makeEl(doc, 'span', 'nn-card-status-pill')
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
        var info = makeEl(doc, 'button', 'nn-mini-info')
        info.setAttribute('type', 'button')
        info.setAttribute('data-nn-component', 'mini-info')
        info.setAttribute('aria-label', 'Show details')
        info.setAttribute('aria-expanded', 'false')
        info.innerHTML = icon('info', 13)
        info.addEventListener('click', function (ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation()
          if (ctl) ctl.togglePin()
          var host = doc.querySelector('[data-nn-component=element-preview]')
          info.setAttribute('aria-expanded', host && !host.hidden ? 'true' : 'false')
        })
        mini.appendChild(info)
      }
    }
    return mini
  }

  function ElementCard(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.ElementCard: data required')
    var doc = resolveDoc(opts)
    var card = makeEl(doc, 'article', 'nn-card')
    card.setAttribute('data-nn-component', 'element-card')
    card.setAttribute('data-element-id', String(data.id == null ? '' : data.id))
    if (data.conceptId) card.setAttribute('data-concept-id', String(data.conceptId))
    var open = !(opts && opts.open === false)
    card.setAttribute('data-open', open ? 'true' : 'false')
    if (opts && opts.domId) card.setAttribute('id', String(opts.domId))

    var fields = Array.isArray(data.fields) ? data.fields : []
    var collapsible = !(opts && opts.collapsible === false)
    var byId = (opts && opts.byId) || {}

    var head = makeEl(doc, 'header', 'nn-card-head')

    var conceptOpts = (opts && opts.concept) || {}
    if (data.conceptId || conceptOpts.index != null || conceptOpts.color) {
      card.setAttribute('data-concept-slot', String(conceptSlot(conceptOpts)))
    }
    var conceptIconName = resolveConceptIconName(data.conceptId, conceptOpts)

    head.appendChild(elementThumb(doc, data, conceptIconName, 18))
    var badgesWrap = makeEl(doc, 'div', 'nn-card-badges')
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
      var stPill = makeEl(doc, 'span', 'nn-card-status-pill')
      var stNorm = statusField.toLowerCase()
      stPill.setAttribute('data-status', stNorm)
      if (stNorm === 'reviewed' || stNorm === 'applied' || stNorm === 'completed' || stNorm === 'verified') {
        var chk = makeEl(doc, 'span', 'nn-status-pill-icon')
        chk.innerHTML = icon('check', 11)
        stPill.appendChild(chk)
      }
      stPill.appendChild(doc.createTextNode(statusField))
      head.appendChild(stPill)
    }

    if (summaryField) {
      var sumPrev = makeEl(doc, 'span', 'nn-card-summary-preview', summaryField)
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
          'nn-card-count',
          fields.length + ' ' + (fields.length === 1 ? 'field' : 'fields'),
        ),
      )
    }

    function setOpen(next) {
      open = next
      if (open) mountBody()
      card.setAttribute('data-open', open ? 'true' : 'false')
      var tg = head.querySelector('.nn-card-toggle')
      if (tg) tg.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    if (collapsible) {
      var toggle = makeEl(doc, 'button', 'nn-card-toggle')
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
      var stripLeft = makeEl(doc, 'div', 'nn-collapsed-strip-left')
      var stripRight = makeEl(doc, 'div', 'nn-collapsed-strip-right')

      // 1. Object fields (e.g., photo_metadata) rendered as inline key-value chip groups
      var objFields = bodyFields.filter(function (fr) {
        return fr && fr.value !== null && typeof fr.value === 'object' && !Array.isArray(fr.value)
      })
      objFields.forEach(function (fr) {
        var grp = makeEl(doc, 'span', 'nn-strip-group')
        grp.appendChild(makeEl(doc, 'span', 'nn-strip-key', fr.name + ':'))
        Object.keys(fr.value).forEach(function (k) {
          var chip = makeEl(doc, 'span', 'nn-obj-chip')
          chip.appendChild(makeEl(doc, 'span', 'nn-obj-chip-k', k))
          var rawV = fr.value[k]
          var vNode = makeEl(doc, 'span', 'nn-obj-chip-v', rawV == null ? '' : String(rawV))
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
          var chip = makeEl(doc, 'span', 'nn-obj-chip')
          chip.appendChild(makeEl(doc, 'span', 'nn-obj-chip-k', fr.name))
          chip.appendChild(makeEl(doc, 'span', 'nn-obj-chip-v', normalizeAssetPath(String(fr.value))))
          stripLeft.appendChild(chip)
        })
      }

      // 3. Outgoing relations rendered as Field KU chip + target-concept-colored Element KU pill
      if (relations && relations.length) {
        relations.slice(0, 3).forEach(function (r) {
          if (!r || typeof r !== 'object') return
          var tRec = r.target && byId[r.target] ? byId[r.target] : null
          var rLabel = r.targetLabel || (tRec && tRec.name) || r.target || '?'
          var relGroup = makeEl(doc, 'span', 'nn-strip-rel-group')
          if (r.field) {
            var fChip = makeEl(doc, 'span', 'nn-ku-field-chip nn-strip-rel-field', '~ ' + r.field)
            relGroup.appendChild(fChip)
          }
          var pill = makeEl(doc, 'a', 'nn-strip-rel')
          if (r.target) pill.setAttribute('href', '#el-' + r.target)
          var tConcept = r.targetConcept || (tRec && tRec.concept)
          var tSlot = r.targetSlot || (tRec && tRec._conceptSlot)
          var tHex = r.targetHexColor || (tRec && targetRecHex(tRec))
          if (tSlot) pill.setAttribute('data-concept-slot', String(tSlot))
          if (tHex) pill.style.setProperty('--pill-concept-color', String(tHex))
          if (tConcept || tSlot) {
            var tIco = makeEl(doc, 'span', 'nn-strip-rel-icon')
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
        var collapsedStrip = makeEl(doc, 'div', 'nn-card-collapsed-strip')
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

      var body = makeEl(doc, 'section', 'nn-card-body')
      // Model views show no change signal except the Unsent marker (added by the
      // review controller from the draft store). The applied history stays in the
      // card's Lineage tab, never as a meta-strip pill.
      if (data.description) body.appendChild(makeEl(doc, 'p', 'nn-card-desc', data.description))
      if (bodyFields.length) {
        var fieldRow = makeEl(doc, 'div', 'nn-card-fields')
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
        var outWrap = makeEl(doc, 'div', 'nn-card-outgoing')
        outWrap.appendChild(
          makeEl(doc, 'span', 'nn-card-outgoing-label', 'Outgoing relations (' + relations.length + ')'),
        )
        outWrap.appendChild(RelList({ relations: relations, byId: byId, model: unitModel }, { doc: doc }))
        body.appendChild(outWrap)
      }
      var incoming = Array.isArray(data.incomingRelations) ? data.incomingRelations : null
      if (incoming && incoming.length) {
        var incWrap = makeEl(doc, 'div', 'nn-card-incoming')
        incWrap.appendChild(
          makeEl(doc, 'span', 'nn-card-incoming-label', 'Incoming relations (' + incoming.length + ')'),
        )
        incWrap.appendChild(RelList({ relations: incoming, byId: byId, model: unitModel }, { doc: doc }))
        body.appendChild(incWrap)
      }
      card.appendChild(body)
      if (data.path) {
        var cardFooter = makeEl(doc, 'footer', 'nn-card-footer')
        if (data.path) cardFooter.appendChild(makeEl(doc, 'span', 'nn-card-path', data.path))
        card.appendChild(cardFooter)
      }
      var win = doc && (doc.defaultView || (doc.ownerDocument && doc.ownerDocument.defaultView))
      var CustomEv = (win && win.CustomEvent) || (typeof CustomEvent !== 'undefined' ? CustomEvent : null)
      if (CustomEv && typeof doc.dispatchEvent === 'function') {
        try {
          doc.dispatchEvent(new CustomEv('nn:rendered', { detail: { root: card } }))
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
    var li = makeEl(doc, 'li', 'nn-change-card card bg-base-100 border border-base-200 shadow-xs')
    li.setAttribute('data-nn-component', 'change-card')
    li.setAttribute('data-change-state', s.stateKind || 'unsent')
    if (s.draftId) li.setAttribute('data-draft-id', String(s.draftId))
    if (s.targetChanged) li.setAttribute('data-target-changed', 'true')

    var body = makeEl(doc, 'div', 'nn-change-card-body card-body p-4 flex flex-col gap-2')

    var head = makeEl(doc, 'div', 'nn-change-card-head flex items-center justify-between gap-3')
    head.appendChild(makeEl(doc, 'span', 'nn-change-card-title font-semibold text-sm', s.title || ''))
    if (s.stateKind === 'unsent' && typeof StatusBadge === 'function') {
      var badge = StatusBadge({ status: 'local', label: COPY.unsent })
      badge.classList.add('nn-change-card-badge')
      head.appendChild(badge)
    } else {
      var stateEl = makeEl(doc, 'span', 'nn-change-card-state text-xs font-semibold', s.stateText || '')
      if (s.stateKind === 'applied') stateEl.setAttribute('title', COPY.appliedHelp)
      head.appendChild(stateEl)
    }
    body.appendChild(head)

    if (s.targetNode) {
      var targetWrap = makeEl(doc, 'div', 'nn-change-card-target inline-flex items-center gap-1.5 flex-wrap text-sm')
      targetWrap.appendChild(s.targetNode)
      body.appendChild(targetWrap)
    }

    if (s.diff) body.appendChild(makeEl(doc, 'div', 'nn-change-card-diff text-sm', s.diff))

    var context = [s.author, s.date, s.stateText].filter(Boolean).join(' \u00b7 ')
    body.appendChild(makeEl(doc, 'div', 'nn-change-card-context text-xs opacity-70', context))

    if (s.note) body.appendChild(makeEl(doc, 'p', 'nn-change-card-note text-sm', s.note))
    if (s.resolution) body.appendChild(makeEl(doc, 'p', 'nn-change-card-resolution text-xs', s.resolution))
    if (s.sources) {
      var sourceList = Array.isArray(s.sources) ? s.sources : [s.sources]
      sourceList.forEach(function (src) {
        if (src == null || src === '') return
        var srcText = String(src)
        var srcEl = makeEl(doc, 'span', 'nn-change-card-source text-xs inline-flex items-center gap-1', srcText)
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
      body.appendChild(makeEl(doc, 'span', 'nn-change-card-stale text-xs', 'target changed'))
    }

    var actions = makeEl(doc, 'div', 'nn-change-card-actions flex items-center gap-2')
    if (s.elementId && opts && typeof opts.onGoTo === 'function') {
      var go = makeEl(doc, 'button', 'nn-change-goto btn btn-sm btn-ghost', COPY.goToElement)
      go.setAttribute('type', 'button')
      go.addEventListener('click', function () {
        opts.onGoTo(s.elementId)
      })
      actions.appendChild(go)
    }
    if (s.revertable && opts && typeof opts.onRevert === 'function') {
      var rev = makeEl(doc, 'button', 'nn-change-revert btn btn-sm btn-ghost', COPY.revert)
      rev.setAttribute('type', 'button')
      rev.addEventListener('click', function () {
        opts.onRevert(s.entry)
      })
      actions.appendChild(rev)
    }
    if (s.draftId && opts && typeof opts.onDiscard === 'function') {
      var dis = makeEl(doc, 'button', 'nn-change-discard btn btn-sm btn-ghost text-error', COPY.discard)
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.DraftList: data required')
    var doc = resolveDoc(opts)
    var drafts = Array.isArray(data.drafts) ? data.drafts : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'nn-draft-list nn-change-list flex flex-col gap-3 list-none p-0 m-0')
    ul.setAttribute('data-nn-component', 'draft-list')
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
      var targetNode = makeEl(doc, 'span', 'nn-draft-target inline-flex items-center gap-1.5')
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
        var arrowSpan = makeEl(doc, 'span', 'nn-draft-arrow text-xs opacity-60', '\u2192')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.ChangeHistory: data required')
    var doc = resolveDoc(opts)
    var changesets = Array.isArray(data.changes) ? data.changes : []
    var byId = data.byId && typeof data.byId === 'object' ? data.byId : {}
    var ul = makeEl(doc, 'ul', 'nn-change-history flex flex-col gap-3 list-none p-0 m-0')
    ul.setAttribute('data-nn-component', 'change-history')
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
    var input = makeEl(doc, 'input', 'nn-edit-input')
    input.setAttribute('type', type)
    if (value != null) input.value = String(value)
    input.setAttribute('data-nn-widget', type)
    return input
  }

  // A long or multi-line string has no single-line editor: it is edited in a
  // textarea and proposed verbatim (Edit Modal Value Type Safety, S3b P0-2).
  function FieldStringWidget(value, opts) {
    var str = value == null ? '' : String(value)
    if (str.indexOf('\n') !== -1 || str.length > 70) {
      var doc = resolveDoc(opts)
      var ta = makeEl(doc, 'textarea', 'nn-edit-textarea')
      ta.setAttribute('data-nn-widget', 'string')
      ta.setAttribute('rows', '4')
      ta.value = str
      return ta
    }
    var inp = FieldInput('text', value, opts)
    inp.setAttribute('data-nn-widget', 'string')
    return inp
  }

  function FieldNumberWidget(value, opts) {
    var inp = FieldInput('number', value, opts)
    inp.setAttribute('data-nn-widget', 'number')
    return inp
  }

  function FieldBooleanWidget(value, opts) {
    var doc = resolveDoc(opts)
    var label = makeEl(doc, 'label', 'nn-edit-checkbox-label')
    var input = makeEl(doc, 'input', 'nn-edit-checkbox')
    input.setAttribute('type', 'checkbox')
    input.setAttribute('data-nn-widget', 'boolean')
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
    var select = makeEl(doc, 'select', 'nn-edit-select')
    select.setAttribute('data-nn-widget', 'select')
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
    var wrap = makeEl(doc, 'div', 'nn-edit-multiselect')
    wrap.setAttribute('data-nn-widget', 'multiselect')
    var current = Array.isArray(values) ? values.map(String) : []
    var list = Array.isArray(options) ? options : []
    list.forEach(function (opt) {
      var label = makeEl(doc, 'label', 'nn-edit-checkbox-label')
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
    var wrap = makeEl(doc, 'div', 'nn-edit-reference')
    wrap.setAttribute('data-nn-widget', 'reference')
    var input = makeEl(doc, 'input', 'nn-edit-input')
    input.setAttribute('type', 'text')
    input.setAttribute('placeholder', 'Element name, e.g. [[Display Name]]')
    if (value != null) input.value = String(value)
    wrap.appendChild(input)

    var datalistId = 'nn-ref-list-' + Math.random().toString(36).slice(2, 8)
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
    var ta = makeEl(doc, 'textarea', 'nn-edit-textarea')
    ta.setAttribute('data-nn-widget', 'markdown')
    ta.setAttribute('rows', '6')
    if (value != null) ta.value = String(value)
    return ta
  }

  function EditModal(data, opts) {
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.EditModal: data required')
    var doc = resolveDoc(opts)
    var modal = makeEl(doc, 'dialog', 'nn-edit-modal')
    modal.setAttribute('data-nn-component', 'edit-modal')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')

    var head = makeEl(doc, 'div', 'nn-edit-modal-head')
    var title = makeEl(doc, 'h2', null, data.title || 'Edit Component')
    head.appendChild(title)
    var closeBtn = makeEl(doc, 'button', 'nn-edit-modal-close', '\u00D7')
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
      var structureWarn = makeEl(doc, 'div', 'nn-edit-warn')
      structureWarn.setAttribute('role', 'alert')
      var warnIcon = makeEl(doc, 'span', 'nn-edit-warn-icon')
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
      var cannotApply = makeEl(doc, 'div', 'nn-edit-warn')
      cannotApply.setAttribute('role', 'alert')
      var caIcon = makeEl(doc, 'span', 'nn-edit-warn-icon')
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
      var proposeAs = makeEl(doc, 'div', 'nn-propose-as')
      proposeAs.textContent = 'Proposing as ' + String(data.reviewer)
      if (data.reviewer === 'reviewer') {
        proposeAs.textContent = 'Proposing as "reviewer" (default) - set your identifier'
        proposeAs.setAttribute('data-default', 'true')
      }
      modal.appendChild(proposeAs)
    }

    // Unified Modal Navigation: Tabs (Edit vs Lineage)
    var navTabs = makeEl(doc, 'div', 'nn-modal-tabs')
    var tabBtnEdit = makeEl(doc, 'button', 'nn-modal-tab-btn active', 'Edit')
    tabBtnEdit.setAttribute('type', 'button')
    var tabBtnHistory = makeEl(doc, 'button', 'nn-modal-tab-btn', 'Changes')
    tabBtnHistory.setAttribute('type', 'button')
    var tabBtnConnections = makeEl(doc, 'button', 'nn-modal-tab-btn', 'Connections')
    tabBtnConnections.setAttribute('type', 'button')
    navTabs.appendChild(tabBtnEdit)
    navTabs.appendChild(tabBtnHistory)
    navTabs.appendChild(tabBtnConnections)
    modal.appendChild(navTabs)

    // Panel 1: Edit Form
    var panelEdit = makeEl(doc, 'div', 'nn-modal-tab-panel nn-edit-modal-body')
    panelEdit.setAttribute('data-tab', 'edit')

    // Mode Selector: Propose Value vs Comment (D15)
    var modeWrap = makeEl(doc, 'div', 'nn-edit-mode-selector')
    // commentOnly: there is no value to propose, so the mode is fixed and the
    // toggle is not offered. A list/object value keeps the toggle visible but
    // disables Propose: there is no list editor, only a comment (S3b P0-2).
    var commentOnly = Boolean(data.commentOnly)
    var valueIsContainer =
      Boolean(data.valueCommentOnly) || (data.value !== null && typeof data.value === 'object')
    var isComment = commentOnly || valueIsContainer || Boolean(data.isComment)
    var btnPropose = makeEl(doc, 'button', 'nn-edit-mode-btn' + (!isComment ? ' active' : ''), 'Propose value')
    var btnComment = makeEl(doc, 'button', 'nn-edit-mode-btn' + (isComment ? ' active' : ''), 'Comment')
    btnPropose.setAttribute('type', 'button')
    btnComment.setAttribute('type', 'button')
    modeWrap.appendChild(btnPropose)
    modeWrap.appendChild(btnComment)
    if (!commentOnly) panelEdit.appendChild(modeWrap)
    if (valueIsContainer) {
      btnPropose.disabled = true
      btnPropose.setAttribute('aria-disabled', 'true')
      panelEdit.appendChild(
        makeEl(doc, 'p', 'nn-edit-note', 'List and object values are proposed as a comment.'),
      )
    }

    var formPropose = makeEl(doc, 'div', 'nn-edit-form-propose')
    formPropose.style.display = isComment ? 'none' : 'block'

    var formComment = makeEl(doc, 'div', 'nn-edit-form-comment')
    formComment.style.display = isComment ? 'block' : 'none'
    var commentLabel = makeEl(doc, 'label', 'nn-edit-field-label', 'Reviewer Notes / Comment')
    var commentTa = makeEl(doc, 'textarea', 'nn-edit-textarea')
    commentTa.setAttribute('placeholder', 'Enter review comment or note...')
    if (data.comment != null) commentTa.value = String(data.comment)
    formComment.appendChild(commentLabel)
    formComment.appendChild(commentTa)

    btnPropose.addEventListener('click', function () {
      if (valueIsContainer) return
      isComment = false
      btnPropose.className = 'nn-edit-mode-btn active'
      btnComment.className = 'nn-edit-mode-btn'
      formPropose.style.display = 'block'
      formComment.style.display = 'none'
    })
    btnComment.addEventListener('click', function () {
      isComment = true
      btnComment.className = 'nn-edit-mode-btn active'
      btnPropose.className = 'nn-edit-mode-btn'
      formPropose.style.display = 'none'
      formComment.style.display = 'block'
    })

    // Field Editor in Propose mode
    var fieldsContainer = makeEl(doc, 'div', 'nn-edit-fields')
    var widgetRef = null
    var fieldType = data.type || 'string'
    var fieldLabel = makeEl(doc, 'label', 'nn-edit-field-label', data.fieldName ? data.fieldName : 'Value')
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
    var panelHistory = makeEl(doc, 'div', 'nn-modal-tab-panel nn-history-modal-body')
    panelHistory.setAttribute('data-tab', 'history')
    panelHistory.style.display = 'none'

    // Changes: the element's recorded change history, rendered as standard element
    // sheets (one ElementCard per change, newest first) so the modal matches the
    // central model view. The change's `evidence` is shown as a field.
    var histSection = makeEl(doc, 'div', 'nn-history-section')
    histSection.appendChild(makeEl(doc, 'h3', 'nn-history-title', 'Changes'))
    var historyItems = Array.isArray(data.history) ? data.history.slice() : []
    historyItems.sort(function (a, b) {
      return String((b && b.timestamp) || '').localeCompare(String((a && a.timestamp) || ''))
    })
    if (historyItems.length) {
      historyItems.forEach(function (h) {
        var changeFields = []
        var pushField = function (name, value) {
          if (value === undefined || value === null || value === '') return
          changeFields.push({ name: name, value: String(value) })
        }
        pushField('op', h.op)
        pushField('target', h.target)
        if (h.from !== undefined) changeFields.push({ name: 'from', value: String(h.from) })
        if (h.to !== undefined) changeFields.push({ name: 'to', value: String(h.to) })
        pushField('concept', h.concept)
        pushField('name', h.name)
        pushField('author', h.author)
        pushField('status', h.status)
        // Evidence is a citation: render it with the standard citation value widget
        // (value + clickable icon) so the icon opens the citation/unit.
        if (h.evidence) {
          changeFields.push({
            name: 'evidence',
            value: String(h.evidence),
            type: 'citation',
            citations: [
              h.evidenceCitation || {
                origin: 'document',
                path: String(h.evidence),
                exists: true,
                field: 'evidence',
              },
            ],
          })
        }
        pushField('applied_at', h.timestamp)
        pushField('notes', h.notes)
        pushField('resolution', h.resolution)
        histSection.appendChild(
          ElementCard(
            {
              id: h.id,
              conceptId: 'Change',
              concept: 'Change',
              name: cardTitle(h.op, h),
              fields: changeFields,
            },
            {
              doc: doc,
              collapsible: false,
              onCite: opts && typeof opts.onEvidence === 'function' ? opts.onEvidence : undefined,
            },
          ),
        )
      })
    } else {
      histSection.appendChild(
        makeEl(doc, 'div', 'nn-history-empty', 'No recorded changes for this element.'),
      )
    }
    panelHistory.appendChild(histSection)
    modal.appendChild(panelHistory)

    // Panel 3: Connections (Sankey-style relation flow)
    var panelConnections = makeEl(doc, 'div', 'nn-modal-tab-panel nn-connections-modal-body')
    panelConnections.setAttribute('data-tab', 'connections')
    panelConnections.style.display = 'none'
    panelConnections.appendChild(SankeyFlow(data.connections || {}, { doc: doc }))
    modal.appendChild(panelConnections)

    var actions = makeEl(doc, 'div', 'nn-edit-modal-actions')
    var saveBtn = makeEl(doc, 'button', 'nn-edit-btn nn-edit-btn-save', 'Save draft')
    saveBtn.setAttribute('type', 'button')
    var saveError = makeEl(doc, 'p', 'nn-edit-error')
    saveError.setAttribute('role', 'alert')
    saveError.style.display = 'none'

    // Tab switcher events
    var tabButtons = { edit: tabBtnEdit, history: tabBtnHistory, connections: tabBtnConnections }
    var tabPanels = { edit: panelEdit, history: panelHistory, connections: panelConnections }
    function showTab(name) {
      Object.keys(tabButtons).forEach(function (k) {
        tabButtons[k].className = 'nn-modal-tab-btn' + (k === name ? ' active' : '')
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
    var cancelBtn = makeEl(doc, 'button', 'nn-edit-btn nn-edit-btn-cancel', 'Cancel')
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
    if (!data || typeof data !== 'object') throw new TypeError('nnUI.NewElementModal: data required')
    var doc = resolveDoc(opts)
    var concepts = Array.isArray(data.concepts) ? data.concepts : []
    var modal = makeEl(doc, 'dialog', 'nn-edit-modal')
    modal.setAttribute('data-nn-component', 'new-element-modal')
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

    var head = makeEl(doc, 'div', 'nn-edit-modal-head')
    head.appendChild(makeEl(doc, 'h2', null, data.title || 'New element'))
    var closeBtn = makeEl(doc, 'button', 'nn-edit-modal-close', '\u00D7')
    closeBtn.setAttribute('type', 'button')
    closeBtn.addEventListener('click', cancel)
    head.appendChild(closeBtn)
    modal.appendChild(head)

    var body = makeEl(doc, 'div', 'nn-modal-tab-panel nn-edit-modal-body')

    var conceptLabel = makeEl(doc, 'label', 'nn-edit-field-label', 'Concept')
    var picker = makeEl(doc, 'select', 'nn-edit-select')
    picker.setAttribute('data-nn-role', 'concept')
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
      modelPicker = makeEl(doc, 'select', 'nn-edit-select')
      modelPicker.setAttribute('data-nn-role', 'model')
      models.forEach(function (m) {
        var mo = makeEl(doc, 'option', null, m.title || m.id)
        mo.value = String(m.id)
        modelPicker.appendChild(mo)
      })
      var preset = models.filter(function (m) {
        return String(m.id) === String(data.defaultModel)
      })[0]
      if (preset) modelPicker.value = String(preset.id)
      body.appendChild(makeEl(doc, 'label', 'nn-edit-field-label', 'Model'))
      body.appendChild(modelPicker)
    }
    body.appendChild(conceptLabel)
    body.appendChild(picker)

    var nameLabel = makeEl(doc, 'label', 'nn-edit-field-label', 'Name')
    var nameInput = FieldInput('text', '', opts)
    nameInput.setAttribute('data-nn-role', 'name')
    body.appendChild(nameLabel)
    body.appendChild(nameInput)

    var fieldsHost = makeEl(doc, 'div', 'nn-edit-fields')
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
      node.setAttribute('data-nn-field', def.name)
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
        fieldsHost.appendChild(makeEl(doc, 'label', 'nn-edit-field-label', def.name))
        fieldsHost.appendChild(w.node)
      })
    }
    picker.addEventListener('change', renderFields)

    var saveError = makeEl(doc, 'p', 'nn-edit-error')
    saveError.setAttribute('role', 'alert')
    saveError.style.display = 'none'
    modal.appendChild(saveError)

    var actions = makeEl(doc, 'div', 'nn-edit-modal-actions')
    var saveBtn = makeEl(doc, 'button', 'nn-edit-btn nn-edit-btn-save', 'Save draft')
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
    var cancelBtn = makeEl(doc, 'button', 'nn-edit-btn nn-edit-btn-cancel', 'Cancel')
    cancelBtn.setAttribute('type', 'button')
    cancelBtn.addEventListener('click', cancel)
    actions.appendChild(saveBtn)
    actions.appendChild(cancelBtn)
    modal.appendChild(actions)

    return modal
  }

  function AnnotationPopover(data, opts) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('nnUI.AnnotationPopover: data required')
    }
    var doc = resolveDoc(opts)
    var kinds = Array.isArray(data.kinds) && data.kinds.length ? data.kinds : ['comment']
    var hasCorrection = kinds.indexOf('correction') !== -1
    var pop = makeEl(doc, 'div', 'nn-annotation-popover')
    pop.setAttribute('data-nn-component', 'annotation-popover')
    pop.setAttribute('role', 'dialog')
    pop.setAttribute('aria-modal', 'true')
    pop.setAttribute('tabindex', '-1')
    pop.appendChild(makeEl(doc, 'p', 'nn-popover-label', data.label))
    kinds.forEach(function (k) {
      var b = makeEl(doc, 'button', 'nn-popover-kind', k)
      b.setAttribute('type', 'button')
      b.setAttribute('data-kind', k)
      pop.appendChild(b)
    })
    if (hasCorrection) {
      if (data.original != null) {
        pop.appendChild(makeEl(doc, 'span', 'nn-popover-original', String(data.original)))
      }
      pop.appendChild(makeEl(doc, 'textarea', 'nn-popover-proposed'))
    }
    var save = makeEl(doc, 'button', 'nn-popover-save', 'Save')
    save.setAttribute('type', 'button')
    save.addEventListener('click', function () {
      var payload = { kind: hasCorrection ? 'correction' : kinds[0] }
      if (hasCorrection) {
        var ta = pop.querySelector('textarea')
        payload.proposed = ta ? ta.value : ''
      }
      if (opts && typeof opts.onSave === 'function') opts.onSave(payload)
    })
    var cancel = makeEl(doc, 'button', 'nn-popover-cancel', 'Cancel')
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
    var wrap = makeEl(doc, 'div', 'nn-sankey')
    wrap.setAttribute('data-nn-component', 'sankey')
    if (!incoming.length && !outgoing.length) {
      wrap.appendChild(makeEl(doc, 'p', 'nn-sankey-empty', 'No relations recorded for this knowledge unit.'))
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
    svg.setAttribute('class', 'nn-sankey-svg')
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
      p.setAttribute('class', 'nn-sankey-link')
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
      var r = rect(x, nodeY(i), 'nn-sankey-node')
      if (link && link.label) {
        var title = doc.createElementNS(NS, 'title')
        title.textContent = String(link.label) + (link.field ? ' (' + link.field + ')' : '')
        r.appendChild(title)
      }
      svg.appendChild(r)
      svg.appendChild(label(x + 10, nodeY(i) + 21, truncate(link && link.label, 20), 'nn-sankey-label'))
      if (link && link.field) {
        svg.appendChild(label(x + colW - 8, nodeY(i) + 21, truncate(link.field, 12), 'nn-sankey-field', 'end'))
      }
    }
    incoming.forEach(function (link, i) {
      node(link, leftX, i)
    })
    outgoing.forEach(function (link, i) {
      node(link, rightX, i)
    })

    svg.appendChild(rect(centerX, centerY, 'nn-sankey-node nn-sankey-center'))
    svg.appendChild(
      label(centerX + colW / 2, centerY + 22, truncate(d.center || 'This unit', 26), 'nn-sankey-center-label', 'middle'),
    )

    wrap.appendChild(svg)
    return wrap
  }

  // Rail progress reads the change, not a review mark: `pending` is how many of the
  // concept's `total` elements carry a change that lives only in this console.
  function RailProgress(data) {
    if (!data || typeof data !== 'object') {
      throw new TypeError('nnUI.RailProgress: data required')
    }
    var total = Number(data.total)
    var pending = Number(data.pending)
    if (!isFinite(total) || !isFinite(pending)) {
      throw new TypeError('nnUI.RailProgress: numeric total and pending required')
    }
    var doc = resolveDoc(null)
    var span = makeEl(doc, 'span', 'nn-rail-progress')
    span.setAttribute('data-nn-component', 'rail-progress')
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
      throw new TypeError('nnUI.Toast: data required')
    }
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.Toast: doc is required')
    var toast = makeEl(doc, 'div', 'nn-change-toast')
    toast.setAttribute('data-nn-component', 'toast')
    toast.setAttribute('role', 'status')
    toast.setAttribute('aria-live', 'polite')
    var ico = makeEl(doc, 'span', 'nn-change-toast-icon')
    ico.setAttribute('aria-hidden', 'true')
    if (typeof icon === 'function') ico.innerHTML = icon('git-commit', 16)
    toast.appendChild(ico)
    var body = makeEl(doc, 'div', 'nn-change-toast-body')
    body.appendChild(makeEl(doc, 'strong', 'nn-change-toast-title', data.title || ''))
    body.appendChild(makeEl(doc, 'span', 'nn-change-toast-text', data.body || ''))
    toast.appendChild(body)
    var close = makeEl(doc, 'button', 'nn-change-toast-close', '\u00d7')
    close.setAttribute('type', 'button')
    close.setAttribute('aria-label', 'Dismiss')
    close.addEventListener('click', function () {
      if (typeof opts.onClose === 'function') opts.onClose()
    })
    toast.appendChild(close)
    return toast
  }

  // TopBarActions: Global navbar actions for in-place self-saving (Quine pattern)
  // and agent hand-off clipboard action (Copy Prompt for AI Agent).
  function TopBarActions(data, opts) {
    opts = opts || {}
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.TopBarActions: doc is required')
    var onSave = opts.onSave
    var onCopyPrompt = opts.onCopyPrompt
    var draftsCount = (data && data.draftsCount) || 0

    var htmlTag = (typeof html !== 'undefined' && html) || (typeof window !== 'undefined' && window.html) || (typeof globalThis !== 'undefined' && globalThis.html)
    var renderFn = (typeof render !== 'undefined' && render) || (typeof window !== 'undefined' && window.render) || (typeof globalThis !== 'undefined' && globalThis.render)

    var saveSvg = (typeof icon === 'function' ? icon('download', 14) : '') ||
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>'

    var promptSvg = (typeof icon === 'function' ? icon('sparkles', 14) : '') ||
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>'

    if (htmlTag && renderFn) {
      var container = doc.createElement('div')
      container.className = 'nn-navbar-actions-group'
      container.setAttribute('data-nn-component', 'navbar-actions')

      var vnode = htmlTag`
        <div class="nn-navbar-actions-inner" style="display:inline-flex;align-items:center;gap:8px;">
          <button
            type="button"
            class="nn-navbar-action-btn nn-btn-save"
            data-nn="save-snapshot"
            data-has-drafts=${draftsCount > 0 ? 'true' : 'false'}
            title="Save self-contained snapshot directly to file (Quine Pattern)"
            onClick=${function (e) {
              if (e && e.preventDefault) e.preventDefault()
              if (typeof onSave === 'function') onSave()
            }}
          >
            <span class="nn-btn-icon" dangerouslySetInnerHTML=${{ __html: saveSvg }}></span>
            <span>Save Snapshot</span>
            ${draftsCount > 0 ? htmlTag`<span class="nn-badge-count">${draftsCount}</span>` : ''}
          </button>
          <button
            type="button"
            class="nn-navbar-action-btn nn-btn-copy-prompt"
            data-nn="copy-agent-prompt"
            title="Copy structured changeset and instructions for AI assistant"
            onClick=${function (e) {
              if (e && e.preventDefault) e.preventDefault()
              if (typeof onCopyPrompt === 'function') onCopyPrompt()
            }}
          >
            <span class="nn-btn-icon" dangerouslySetInnerHTML=${{ __html: promptSvg }}></span>
            <span>Copy AI Prompt</span>
          </button>
        </div>
      `
      renderFn(vnode, container)
      return container
    }

    var wrap = makeEl(doc, 'div', 'nn-navbar-actions-group')
    wrap.setAttribute('data-nn-component', 'navbar-actions')

    var btnSave = makeEl(doc, 'button', 'nn-navbar-action-btn nn-btn-save')
    btnSave.setAttribute('type', 'button')
    btnSave.setAttribute('data-nn', 'save-snapshot')
    btnSave.setAttribute('data-has-drafts', draftsCount > 0 ? 'true' : 'false')
    btnSave.setAttribute('title', 'Save self-contained snapshot directly to file (Quine Pattern)')
    btnSave.innerHTML = '<span class="nn-btn-icon">' + saveSvg + '</span><span>Save Snapshot</span>'
    if (draftsCount > 0) {
      var badge = makeEl(doc, 'span', 'nn-badge-count', String(draftsCount))
      btnSave.appendChild(badge)
    }
    btnSave.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault()
      if (typeof onSave === 'function') onSave()
    })
    wrap.appendChild(btnSave)

    var btnCopy = makeEl(doc, 'button', 'nn-navbar-action-btn nn-btn-copy-prompt')
    btnCopy.setAttribute('type', 'button')
    btnCopy.setAttribute('data-nn', 'copy-agent-prompt')
    btnCopy.setAttribute('title', 'Copy structured changeset and instructions for AI assistant')
    btnCopy.innerHTML = '<span class="nn-btn-icon">' + promptSvg + '</span><span>Copy AI Prompt</span>'
    btnCopy.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault()
      if (typeof onCopyPrompt === 'function') onCopyPrompt()
    })
    wrap.appendChild(btnCopy)

    return wrap
  }

  /**
   * Registers <nn-ku> custom element in window.customElements when available.
   */
  function KpiGrid(data, opts) {
    if (!data || !Array.isArray(data.items)) {
      throw new TypeError('nnUI.KpiGrid: data.items must be an array')
    }
    var doc = (opts && opts.doc) || (typeof document !== 'undefined' ? document : null)
    if (!doc) throw new TypeError('nnUI.KpiGrid: doc is required')
    var grid = makeEl(doc, 'div', 'nn-kpi-grid')
    grid.setAttribute('data-nn-component', 'kpi-grid')
    data.items.forEach(function (item) {
      if (!item) return
      var card = makeEl(doc, 'div', 'nn-kpi-card')
      var header = makeEl(doc, 'div', 'nn-kpi-header')
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
      var val = makeEl(doc, 'div', 'nn-kpi-value', item.value != null ? String(item.value) : '0')
      card.appendChild(val)
      if (item.hint) card.appendChild(makeEl(doc, 'div', 'nn-kpi-hint', item.hint))
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
    if (align === 'center') return 'nn-grid-cell nn-grid-cell--center'
    if (align === 'end' || align === 'right') return 'nn-grid-cell nn-grid-cell--end'
    return 'nn-grid-cell'
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

    var scroll = makeEl(doc, 'div', 'nn-grid-scroll')
    scroll.setAttribute('data-nn-component', spec.component)
    if (spec.pinFirstColumn) scroll.setAttribute('data-pin-first', 'true')

    var table = makeEl(doc, 'table', 'nn-grid')
    if (hasRowHeader) table.setAttribute('data-has-row-header', 'true')

    var thead = doc.createElement('thead')
    var htr = doc.createElement('tr')
    if (hasRowHeader) {
      var corner = makeEl(doc, 'th', 'nn-grid-corner')
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
      var ec = makeEl(doc, 'td', 'nn-grid-empty')
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
          var rth = makeEl(doc, 'th', 'nn-grid-rowhead')
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
    if (!data || !Array.isArray(data.columns)) throw new TypeError('nnUI.DataTable: data.columns must be an array')
    if (!Array.isArray(data.rows)) throw new TypeError('nnUI.DataTable: data.rows must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.DataTable: doc is required')
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
    if (!data || !Array.isArray(data.columns)) throw new TypeError('nnUI.MatrixGrid: data.columns must be an array')
    if (!Array.isArray(data.rows)) throw new TypeError('nnUI.MatrixGrid: data.rows must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.MatrixGrid: doc is required')
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
    if (!data || !Array.isArray(data.periods)) throw new TypeError('nnUI.Timeline: data.periods must be an array')
    if (!Array.isArray(data.lanes)) throw new TypeError('nnUI.Timeline: data.lanes must be an array')
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.Timeline: doc is required')
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
      throw new TypeError('nnUI.FilterSelect: data.options must be an array')
    }
    var doc = resolveDoc(opts)
    if (!doc) throw new TypeError('nnUI.FilterSelect: doc is required')
    var options = normalizeFilterOptions(data.options)
    var selected = {}
    if (data.selected && !Array.isArray(data.selected) && typeof data.selected === 'object') {
      Object.keys(data.selected).forEach(function (k) { if (data.selected[k]) selected[k] = true })
    } else if (Array.isArray(data.selected)) {
      data.selected.forEach(function (v) { selected[v] = true })
    }
    options.forEach(function (o) { if (o.selected) selected[o.value] = true })
    var label = data.label != null ? String(data.label) : ''

    var root = makeEl(doc, 'details', 'nn-filter')
    root.setAttribute('data-nn-component', 'filter-select')
    var summary = makeEl(doc, 'summary', 'nn-filter-summary')
    summary.setAttribute('aria-label', label || 'Filter')
    root.appendChild(summary)
    var menu = makeEl(doc, 'div', 'nn-filter-menu')
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
      var quick = makeEl(doc, 'div', 'nn-filter-quick')
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
      var row = makeEl(doc, 'label', 'nn-filter-option')
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
      row.appendChild(makeEl(doc, 'span', 'nn-filter-option-label', o.label))
      if (o.count != null) row.appendChild(makeEl(doc, 'span', 'nn-filter-option-count', String(o.count)))
      menu.appendChild(row)
    })

    syncSummary()
    root.getSelection = selectedValues
    root.setSelection = setSelection
    return root
  }

  function defineCustomElements() {
    if (typeof window === 'undefined' || !window.customElements || window.customElements.get('nn-ku')) return
    try {
      function nnKu() {
        return Reflect.construct(HTMLElement, [], nnKu)
      }
      Object.setPrototypeOf(nnKu.prototype, HTMLElement.prototype)
      Object.setPrototypeOf(nnKu, HTMLElement)
      nnKu.prototype.connectedCallback = function () {
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
      window.customElements.define('nn-ku', nnKu)
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

  // D3: the nn:theme-change listener lives here (killed the runtime's
  // class-toggling version). Uses setTheme -> html[data-theme].
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.type === 'nn:theme-change') {
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

  // Change A: a unit's edit affordance derives from its model's declared
  // `ownership` (not a kind table). The host installs a resolver mapping a model
  // id to `'authored' | 'derived'`; a `derived` model offers no edit pencil. The
  // apply engine remains the final guard.
  var modelOwnership = null
  function setModelOwnership(fn) {
    modelOwnership = typeof fn === 'function' ? fn : null
  }
  function refModelId(ref) {
    if (!ref) return ''
    if (ref.model) return String(ref.model)
    var address = ref.address || ''
    if (!address || address.indexOf('specs/') === 0) return ''
    var at = address.indexOf('@')
    return at === -1 ? '' : address.slice(0, at)
  }
  function ownershipOfRef(ref) {
    if (!modelOwnership) return null
    var model = refModelId(ref)
    if (!model) return null
    try {
      return modelOwnership(model)
    } catch (e) {
      return null
    }
  }

  function addrApi() {
    return typeof window !== 'undefined' && window.nnAddress ? window.nnAddress : null
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
    // A `derived` model is read-only: no edit affordance regardless of kind.
    if (ownershipOfRef(ref) === 'derived') return 'none'
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
    // that concept's colour through --c in CSS). Section badges (a rail concept
    // entry, a facet, a guide reference) are concept-addressed too, so they carry
    // the same concept icon when the reference names a concept.
    if (nature === 'content' || (kind === 'section' && (ref.concept || ref.conceptId))) {
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
    style.setAttribute('data-nn-ku-css', '1')
    style.textContent = [
      ':root{--nn-source-paper:#fff7e6}',
      '.nn-ku-wrap{display:inline-flex;align-items:center;gap:.2em;position:relative;vertical-align:middle}',
      '.nn-ku{display:inline-flex;align-items:center;gap:.3em;border-radius:.4em;padding:.12em .5em;font-size:.82rem;line-height:1.4;background:var(--nn-surface-2,#f1f5f9);--c:var(--nn-concept-1,#3b82f6);--cb:var(--nn-concept-1-bg,#eff6ff)}',
      '.nn-ku[data-ku-nature=container]{border:2px solid var(--nn-accent,#0f172a);background:var(--nn-surface,#fff)}',
      '.nn-ku[data-ku-nature=structure]{border:1.5px solid var(--c);font-family:ui-monospace,monospace;color:var(--nn-muted,#64748b);background:var(--nn-surface,#fff)}',
      '.nn-ku[data-ku-nature=content]{border:0;background:var(--nn-surface-2,#f1f5f9)}',
      '.nn-ku[data-ku-nature=content]>.nn-ku-label,.nn-ku[data-ku-nature=content]>.nn-ku-value{color:var(--c)}',
      '.nn-ku[data-ku-nature=content]>.nn-ku-icon{color:var(--c)}',
      '.nn-ku[data-ku-home=source]{background:var(--nn-source-paper,#fff7e6)}',
      '.nn-ku[data-ku-home=source]>.nn-ku-label,.nn-ku[data-ku-home=source] .nn-ku-icon{color:var(--nn-muted,#64748b)}',
      '.nn-ku--block{display:flex;width:100%;padding:.5em .7em}',
      '.nn-ku-more{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;border:0;border-radius:999px;background:transparent;color:var(--nn-muted,#64748b);cursor:pointer}',
      '.nn-ku-more:hover,.nn-ku-more[aria-expanded=true]{color:var(--nn-text,#0a0a0a);background:var(--nn-surface-2,#f1f5f9)}',
      '.nn-ku-actions{position:fixed;z-index:60;display:none;align-items:center;gap:.15em;padding:.2em;background:var(--nn-surface,#fff);border:1px solid var(--nn-border,#e5e5e5);border-radius:.4em;box-shadow:0 8px 24px rgba(0,0,0,.18);white-space:nowrap}',
      '.nn-ku-wrap[data-ku-open=true]>.nn-ku-actions{display:inline-flex}',
      '.nn-ku-action{display:inline-flex;align-items:center;justify-content:center;min-width:24px;min-height:24px;border:0;background:transparent;cursor:pointer;color:var(--nn-muted,#64748b)}',
      '.nn-ku-action:hover{color:var(--nn-text,#0a0a0a);background:var(--nn-surface-2,#f1f5f9)}',
      // No mode gates: an edit only ever creates a draft, so the pencil is always
      // emitted and always live. Structure edits warn inside the modal instead.
      '.nn-ku-change-pip{min-width:1.35em;height:1.35em;border-radius:999px;border:0;background:#b45309;color:#fff;font-size:.72rem;cursor:pointer}',
    ].join('')
    doc.head.appendChild(style)
  }

  function Ku(kind, ref, opts) {
    if (!KU_NATURE[kind]) throw new TypeError('Ku: unknown kind "' + kind + '"')
    opts = opts || {}
    var doc = resolveDoc(opts)
    ensureKuCss(doc)
    var desc = describeUnit(kind, ref, opts.index)
    var wrap = makeEl(doc, 'span', 'nn-ku-wrap')
    var isBlock = opts.variant === 'block'
    var badge = makeEl(doc, isBlock ? 'div' : 'span', isBlock ? 'nn-ku nn-ku--block' : 'nn-ku')
    badge.setAttribute('data-nn-component', 'ku-unit')
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
        var conceptIconEl = makeEl(doc, 'span', 'nn-ku-icon')
        conceptIconEl.setAttribute('aria-hidden', 'true')
        conceptIconEl.innerHTML = icon(desc.icon, 13)
        badge.appendChild(conceptIconEl)
      }
      var labelEl = makeEl(doc, 'span', 'nn-ku-label', desc.label)
      labelEl.setAttribute('title', desc.label)
      badge.appendChild(labelEl)
      if (opts.valueNode) {
        var valueEl = makeEl(doc, 'span', 'nn-ku-value')
        valueEl.appendChild(opts.valueNode)
        badge.appendChild(valueEl)
      }
    }
    badge.setAttribute('aria-label', desc.nature + ', lives in ' + desc.home + ': ' + desc.label)
    wrap.appendChild(badge)

    // ONE affordance sits beside the badge; everything else floats below on demand.
    var more = makeEl(doc, 'button', 'nn-ku-more')
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
    var actions = makeEl(doc, 'span', 'nn-ku-actions')
    function actionButton(name, iconName, label, handler) {
      var b = makeEl(doc, 'button', 'nn-ku-action')
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
      var pip = makeEl(doc, 'button', 'nn-ku-change-pip', String(changes))
      pip.setAttribute('type', 'button')
      pip.setAttribute('data-nn-component', 'ku-change-pip')
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
      var wrap = node && node.closest ? node.closest('.nn-ku-wrap') : null
      var badge = wrap ? wrap.querySelector('[data-nn-component="ku-unit"]') : null
      if (!badge) return null
      var kind = badge.getAttribute('data-ku-kind') || ''
      var labelEl = badge.querySelector('.nn-ku-label')
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
      var open = doc.querySelectorAll('.nn-ku-wrap[data-ku-open=true]')
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
        var owner = moreEl.closest('.nn-ku-wrap')
        var wasOpen = !!(owner && owner.getAttribute('data-ku-open') === 'true')
        closeFlyouts()
        if (owner && !wasOpen) {
          owner.setAttribute('data-ku-open', 'true')
          moreEl.setAttribute('aria-expanded', 'true')
          // The flyout is position:fixed, so an `overflow` ancestor (a table wrapper)
          // can no longer clip it. Anchor it to the badge, clamped to the viewport.
          var fly = owner.querySelector('.nn-ku-actions')
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
      var pipEl = t.closest('[data-nn-component="ku-change-pip"]')
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
      host.querySelectorAll('[data-nn-component="ku-unit"][data-ku-address]'),
      function (badge) {
        var address = badge.getAttribute('data-ku-address') || ''
        var n = Number(counts[address] || 0)
        var wrap = badge.parentNode || badge
        var existing =
          typeof wrap.querySelector === 'function'
            ? wrap.querySelector('[data-nn-component="ku-change-pip"]')
            : null
        if (n > 0) {
          badge.setAttribute('data-ku-changes', String(n))
          if (existing) {
            existing.textContent = String(n)
            return
          }
          var pip = makeEl(doc, 'button', 'nn-ku-change-pip', String(n))
          pip.setAttribute('type', 'button')
          pip.setAttribute('data-nn-component', 'ku-change-pip')
          pip.setAttribute('data-ku-address', address)
          var labelEl = badge.querySelector('.nn-ku-label')
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
    var dlg = makeEl(doc, 'dialog', 'nn-ku-info-panel')
    dlg.setAttribute('data-nn-component', 'ku-info-panel')
    dlg.setAttribute('role', 'dialog')
    var h = makeEl(doc, 'h2', 'nn-ku-info-title', descriptor.label || descriptor.address)
    h.setAttribute('tabindex', '-1')
    dlg.appendChild(h)
    dlg.appendChild(
      makeEl(doc, 'p', 'nn-ku-info-sub', descriptor.nature + ', lives in ' + descriptor.home),
    )
    var rows = [
      ['Kind', descriptor.kind],
      ['Nature', descriptor.nature],
      ['Lives in', descriptor.home],
      ['Address', descriptor.address],
      ['Location', descriptor.location || ''],
      ['Editability', descriptor.editability],
    ]
    var dl = makeEl(doc, 'dl', 'nn-ku-info-list')
    rows.forEach(function (pair) {
      if (!pair[1]) return
      dl.appendChild(makeEl(doc, 'dt', 'nn-ku-info-term', pair[0]))
      dl.appendChild(makeEl(doc, 'dd', 'nn-ku-info-def', String(pair[1])))
    })
    dlg.appendChild(dl)
    var facts = descriptor.facts || {}
    Object.keys(facts).forEach(function (k) {
      if (facts[k] == null || facts[k] === '') return
      dl.appendChild(makeEl(doc, 'dt', 'nn-ku-info-term', k))
      dl.appendChild(makeEl(doc, 'dd', 'nn-ku-info-def', String(facts[k])))
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
    setModelOwnership: setModelOwnership,
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
    TopBarActions: TopBarActions,
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
