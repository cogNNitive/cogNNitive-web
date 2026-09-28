# Proposal: Console Citation Icons (Tanda C)

## Intent

The generic model console shows values but not where they came from. The only provenance cue is one document-level `meta.sourceUrl` link. `resolve_sources` (Tanda A) already answers "where did this value come from?", but only inside an MCP session. A reviewer holding an offline console cannot tell whether a value came from a document, a person, or an AI agent. Tanda C bakes resolved citations into the console at compile time and marks each cited value with an icon, typed by origin, that opens a detail dialog.

## Scope

### In Scope
- **C1 Origin classification in `resolve_sources`.** Each `ResolvedCitation` gains `field` and `origin`, resolved per citation from the heading the `@` pointer targets. The file-level `is_synthetic` flag is not used.
  - `agent`: the anchor is a `## NN Agent Modification: …` heading. `author` is read from that block's `author::`, and `_` becomes `unknown`.
  - `reviewer`: the target frontmatter has `source_type: feedback`.
  - `document`: the default.
- **C2 Payload.** The compile procedure calls `resolve_sources` once per element and embeds the result as `el.citations: { "<citationFieldName>": ResolvedCitation[] }` plus `meta.citationsResolvedAt`. Nothing is resolved at runtime.
- **C3 Renderer.** `renderElement()` places icons as follows:
  - For `sources`-family fields, the icon goes on the element header.
  - For any other citation-typed field, the icon goes on that field's row.
  - The icon has one variant per origin, plus a warning variant for `error`.
  - It is inline SVG/CSS with no new dependency.
- **C4 Dialog.** Clicking an icon opens a native `<dialog id="innfo-citation-dialog">` with `showModal()`, following the existing `innfo-ref-dialog` pattern in `innfo-runtime.js` and `render-procedure-stepper.js`. It shows path, anchor, excerpt (with a truncation mark), author, version, sha256 and error.
- **C5 Relocation to the workspace level.**
  - `business/procedures/compile_model_viewer_NN.md` moves to `workspace/procedures/compile_model_console_NN.md`.
  - `business/assets/model_viewer.html` moves to `workspace/assets/model_console.html`.
  - The following must be updated: the `business/spec_NN.md` frontmatter and history prose, the business mirror in `canonical-registry.ts`, both `template_version` bumps with `SHIPPED_TEMPLATE_VERSIONS` registration, the rebuilt `innfo-console.bundle.js` plus a new `innfo-console-v*` pin, and the `templates-v*` tag and re-pin.
  - The old business shell stays unchanged for one cycle, because installed procedures fetch it from `main`.

### Out of Scope
- Anything else in the console's layout, and template-specific custom views.
- Tanda B WU4 work (the language spec, `V_0-2-2`). C needs no new syntax.
- Citation badges on individual matrix cells. The language has no per-cell citation grammar.
- Full validation of CSV-row citations. Row excerpts pass through as `resolve_sources` returns them, following the same boundary as the impact-checker fix.
- **Deduplicating the `apply_feedback` procedures.** The duplicate is `metrics/` against `business/apply_feedback_NN.md`, which differ only in the "Regenerate Console" step. `reconcile_artifact_feedback_NN.md` has a different purpose (DOCX review reconciliation). Folding the two needs its own template bumps, so it is deferred.

## Capabilities

### New Capabilities
- `console-field-citations`: the compile-time citation payload, the origin-typed icons, and the citation dialog in the generic model console.

### Modified Capabilities
- `citation-source-resolution`: adds `field`, `origin` and `author` to each result.
- `innfo-console-runtime`: the reference-asset path changes to `workspace/assets/model_console.html`, and the shell carries the citation dialog.

## Approach

Reuse, don't reimplement: the classification lives only in `resolve-sources.ts`, and the procedure copies its output verbatim. Commit order is C1, then C2/C3/C4, then C5 with its release ceremony last.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Removing the business shell breaks installed procedures that fetch it from `main` | High | Keep it for one cycle |
| The tag and re-pin are forgotten, or stacked on top of WU4's unmerged tag | Med | C5 runs after WU4 reaches `main` |
| An oversized payload from excerpts of up to 500 characters | Low | Same cap, and only cited fields carry excerpts |

## Rollback Plan

Revert each commit on its own. C2–C4 are additive: an element without `citations` renders exactly as today. If C5's tag has shipped, cut a follow-up tag instead of deleting it.

## Dependencies

- Tanda A (shipped).
- Tanda B WU4 must reach `main`. Its task 4.14 is still pending the maintainer merge.

## Success Criteria

- [ ] Every cited field shows an icon matching its origin, and the dialog content matches `resolve_sources` output.
- [ ] A console compiled without citations renders unchanged.
- [ ] Nothing references the business procedure path, and `check:integrity` and `validate-manifest` pass.

## Open Questions

1. ~~Human-authored plain headings have no clean signal.~~ **RESOLVED (user, 2026-09-28):** no signal is added. Plain headings without a resolvable Agent Modification block render as `document`. Do not guess a `user` category from absence of a signal.
2. ~~`author::` in an Agent Modification can be a human participant name.~~ **RESOLVED (user, 2026-09-28):** distinguish by the real `author::` value, not by "cited an Agent Modification block" alone. Requires a small known-tool-id list (`ClaudeCode`, `OpenCode`, `Antigravity`, extendable) in the resolver; a value NOT on that list renders as `human` (reviewer/user-style icon), not `agent`. sdd-design must place this list somewhere sensible in `resolve-sources.ts` (or a shared constant) and specify the exact icon/label used for the "known human name in an Agent Modification block" case, since it is distinct from both the AI-agent icon and the plain-document icon.
3. **Still open — investigate in sdd-design/sdd-spec:** does normalized feedback carry `meta.author` into its frontmatter? If not, `reviewer` citations have no name to show; design must state the fallback (no name shown vs. generic "Reviewer" label).
4. **Still open, but leaning resolved by omission:** no naming convention exists to badge a plain field (e.g. `precio`) from its citation-typed sibling field (e.g. `precio_source`). Proposal already scopes this out — only the citation-typed field itself gets an icon. sdd-design should confirm this stays a non-goal rather than silently deciding it.
