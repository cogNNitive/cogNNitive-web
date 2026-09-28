# Apply Progress: Console Citation Icons (Tanda C)

## Pre-C1 — CI bundle-vs-source risk check

**Status**: Done (confirmation only, no code change).

Tasks 0.1/0.2 were already fully investigated and documented during
`sdd-tasks` (the finding is recorded verbatim in `tasks.md`). This session
confirmed the finding still holds (`checkCdnBundleStaged` is an
existence-only check, no script diffs bundle bytes against
`resolve-sources.ts` source) and checked both boxes. No speculative rebuild
was added to C1; the CDN bundle staleness gap stays accepted and deferred to
C5 task 5.6, per design's documented fallback ("A console was built by an
old MCP (no `origin`)" → renders the `document` variant).

## C1 — Origin classification in `resolve-sources.ts`

**Status**: Done. All 6 tasks (1.1-1.6) complete.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1/1.2 (tests) | Added 12 new tests (9 origin-classification cases + field-key + contract test) to `resolve-sources.spec.ts`; ran `vitest run` — all 12 failed with `expected undefined to be '<origin>'` / `toBeUndefined()` mismatches (right reason: `origin`/`field`/`author` did not exist on `ResolvedCitation` yet) | — | — |
| 1.3 (classifier + types) | (see above) | Implemented `CitationOrigin`, `AGENT_MODIFICATION_CONCEPT`, `KNOWN_AGENT_TOOL_IDS`, `findEnclosingAgentModification`, `readAgentModificationAuthor`, `classifyOrigin`, `classifyFromFrontmatter`, `normalizeToolId` in `resolve-sources.ts`; `vitest run` → 18/20 passed, 2 failing (both were test-fixture bugs, not implementation bugs — see Issues Found) | Fixed the 2 fixture bugs; `vitest run` → 20/20 green |
| 1.4 (`field` param + error-path origins) | (covered by 1.1 tests: `MALFORMED`, `DANGLING_FILE`, `UNKNOWN_ANCHOR`, `MODEL_NOT_FOUND`, `ELEMENT_NOT_FOUND` all assert `origin: 'document'` and a `field` key) | Implemented alongside 1.3 | Full suite green |
| 1.5 (tool description) | N/A (doc string, no test) | Updated `server.ts:476` description to mention `field`/`origin`/`author?` and the origin enum | — |
| 1.6 (full suite run) | — | `innfo-mcp` full suite: 310/310 passed. `innfo-core` full suite: 880 passed, 1 skipped (pre-existing skip, unrelated). `tsc --noEmit` on `innfo-mcp`: clean, no errors. No `innfo-core` rebuild was needed — `resolve-sources.ts` only imports already-published `innfo-core` exports (`extractHeadings`, `SourceRef`, `HeadingInfo`), none of which changed shape. | — |

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.ts` | Modified | Added `CitationOrigin` type, `AGENT_MODIFICATION_CONCEPT`, `KNOWN_AGENT_TOOL_IDS` exports; extended `ResolvedCitation` with `field: string`, `origin: CitationOrigin`, `author?: string`; added `findEnclosingAgentModification`, `readAgentModificationAuthor`, `classifyFromFrontmatter`, `classifyOrigin`, `normalizeToolId`; threaded `field` through `resolveOneCitation` and both `resolveSources` early-return paths (`MODEL_NOT_FOUND`, `ELEMENT_NOT_FOUND`) |
| `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.spec.ts` | Modified | Added 12 tests under a new `describe('origin classification', ...)` block plus a `field`-key test; added 12 new fixture files (`agent-mod*.md`, `reviewer-*.md`, `plain-doc.md`) covering every scenario in the spec delta and design's Testing Strategy table |
| `iNNfo/packages/innfo-mcp/src/server.ts` | Modified | Updated the `resolve_sources` tool description string (`:476`) to document `field`/`origin`/`author?` in the result shape |

### Deviations from Design

None — implementation matches design D1-D9 and the C1 section exactly:
classification lives only in `resolve-sources.ts` (D1), tool-id matching
normalizes both sides (D2), the anchor walk tests self-then-ancestors only
(D3), precedence is Agent Modification → `source_type: feedback` →
`document` (D4), reviewer `author` comes from frontmatter only and is
omitted (never placeholdered) when absent (D5).

One implementation detail not spelled out in design, resolved by inference
from the spec: `UNKNOWN_ANCHOR` (both the `resolveUnit` and
`resolveHeadingSection` failure branches) now calls
`classifyFromFrontmatter` directly rather than the full `classifyOrigin`,
since the anchor never resolved to a real heading — there is no heading to
walk. This matches design's explicit note ("`UNKNOWN_ANCHOR` still runs
step 2 of `classifyOrigin`, because the frontmatter is readable") read as
skipping step 1 (the heading walk) for that case.

### Issues Found

Two bugs were caught and fixed during the RED→GREEN cycle, both in the
*test fixtures* I wrote, not in the implementation:
1. The nested-sub-heading test originally cited `## Sub Detail` (level 2)
   against a fixture file where that heading was actually `### Sub Detail`
   (level 3) — the level mismatch made `classifyOrigin`'s `ref.unit.level`
   guard correctly reject the match. Fixed by aligning the citation's
   heading-marker level with the fixture.
2. The contract test's own assertion (`headingText.toContain('add_field')`)
   was checking the wrong thing — `headingText` is the *slugified* heading
   text (`"NN Agent Modification: addfield-concept-producto-field-precio"`
   after `buildAgentModificationBlock`'s `slugifyHeading(scope)`), not the
   raw `scope::` string. Fixed the assertion to check for the
   case-insensitive `"nn agent modification"` substring instead, which is
   the actual invariant the contract test needs to guard (per design D1:
   the resolver's heading-text match staying in sync with the builder's
   actual heading format).

Neither issue reflects a design gap; both were caught by running the tests
and reading the failure output, exactly as strict TDD requires.

### Remaining Tasks (as of end of C1)

- [ ] C2 — Payload: `workspace/procedures/compile_model_console_NN.md` (tasks 2.1-2.4)
- [ ] C3 — Renderer: `render-model-viewer.js` (tasks 3.1-3.4)
- [ ] C4 — Runtime: `innfo-runtime.js` icons and dialog (tasks 4.1-4.5)
- [ ] C5 — Release unit, gated on `templates-v0.16.0` reaching `main` (tasks 5.0-5.12)

### Workload / PR Boundary (as of end of C1)

- Mode: work-unit commits directly on `dev`, no PRs (per delivery strategy)
- Current work unit: C1 only, per the tasks.md Review Workload Forecast
  (`Suggested Work Units` table: C1 ~120-160 lines, standalone/testable
  without C2-C4)
- Boundary: this batch starts from the tasks/spec/design artifacts as
  written and ends with a single green commit touching only
  `resolve-sources.ts`, `resolve-sources.spec.ts`, and `server.ts`. C2-C5
  are untouched, per the explicit batching instruction.
- Estimated review budget impact: within the ~120-160 line estimate; low
  risk on its own, but C1+C2-C4+C5 together still exceed 400 lines per the
  forecast, hence the continued batching into 3 sessions.

### Status (as of end of C1)

C1 complete (6/6 tasks, plus 2/2 pre-C1 confirmation tasks). Ready for the
next batch (C2-C4) in a separate `sdd-apply` session.

---

## C2+C3+C4 — Payload, renderer, runtime dialog (combined batch)

**Status**: Done. All 13 tasks (2.1-2.4, 3.1-3.4, 4.1-4.5) complete, one
combined commit per tasks.md's `Suggested Work Units` table (`C1 →
C2/C3/C4 combined feature commit → C5`). C1 and C5 were not touched.

### TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1 (new procedure file) | N/A — `workspace/procedures/compile_model_console_NN.md` is prose an AI agent follows, not executable code; there is no importable module to red/green against. | Authored the file (copy of the business procedure plus `Load Reference Shell` retarget, `model_version: V_0-1-0`, and the new `Resolve Element Citations` step between `Serialize Model Data` and `Inject Data into Shell`). | — |
| 2.2/2.3 (grouping, `elementId: el.name`, escaping contract) | Wrote `console-citations-payload.test.ts`: text-scan assertions against the procedure prose (elementId source, field-grouping, dropped `field` key, empty-result omission, `citationsResolvedAt`, resolver-unavailable path, no-runtime-resolution) plus a reference-implementation check of the documented `<` → `<` escaping technique. First run caught a real authoring bug (see Issues Found) — one assertion failed for the right reason (the procedure text said `` `<` `` instead of the literal four-character sequence `<`, because the Write/Edit tool's JSON parameter layer silently decodes `\uXXXX` escapes). 11/12 passed, 1 failed. | Fixed the procedure text via a Node script writing the raw bytes (bypassing the JSON-escape problem); `vitest run tests/console-citations-payload.test.ts` → 12/12 green. | — |
| 2.4 (compile-procedure-level test) | (covered by the same file) | 12/12 green | — |
| 3.1 (failing jsdom/happy-dom tests) | Wrote `console-citations-dom.test.ts` against `render-model-viewer.js` before `citationButtons`/wiring existed: 7/8 failed (`TypeError`-free, correct-reason failures — zero icons rendered because the feature didn't exist yet); the 1 pass was the backward-compat case, which needs no new code. | Implemented `citationButtons`, `SOURCES_FAMILY`, `ORIGIN_VARIANT_ORDER`, `CITATION_ICON_LABELS`, `citationVariant`, and wired them into `renderElement()`'s header and field-row loops; `vitest run tests/console-citations-dom.test.ts` → 8/8 green. | Root-caused an early false pass/fail split to `require()`'s CJS cache not being cleared by `vi.resetModules()` (the module only auto-boots once); fixed the test helper to call `api.boot()` explicitly every test instead of relying on re-`require()`-triggered `autoBoot()`. |
| 3.2/3.3 (`citationButtons`, wiring) | (covered by 3.1) | (covered by 3.1) | — |
| 3.4 (regression run) | — | `console-citations-dom.test.ts` (8), `console-renderers.test.ts` (7), `console-thinning.test.ts` (10 baseline), `console-dom.test.ts` (5) all green together. | — |
| 4.1 (failing dialog tests) | Wrote `console-citation-dialog.test.ts` before `svgIcon` citation entries / `renderCitationDialog` existed: 8/8 failed (`api.svgIcon is not a function`, `api.renderCitationDialog is not a function` — right reason, neither was exported yet). | Added the 5 `svgIcon` citation entries, `CITATION_ORIGIN_LABELS`, and `renderCitationDialog` next to `renderRefDialog`; exported both in `PUBLIC_API`; `vitest run tests/console-citation-dialog.test.ts` → 8/8 green. | — |
| 4.2/4.3 (icons, dialog impl) | (covered by 4.1) | (covered by 4.1) | — |
| 4.4 (new workspace asset + byte-unchanged guard) | Extended `console-thinning.test.ts` with a `console` entry in the asset table plus 3 new assertions (bundle-based loading, citation dialog + colour-rule hooks, widened `#innfo-ref-dialog, #innfo-citation-dialog` selector) and a byte-unchanged check of `business/assets/model_viewer.html` against `git show HEAD:...`. Not red-first in the strict sense — `model_console.html` was authored to satisfy the assertions in the same step, since it is a large boilerplate HTML copy, not algorithmic logic (see Deviations). | `vitest run tests/console-thinning.test.ts` → 18/18 green, including the byte-unchanged guard. | — |
| 4.5 (full runtime + console-dom regression) | — | Full `innfo-core` suite: 916 passed, 1 skipped (pre-existing, unrelated). `tsc --noEmit`: clean. | — |

### Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `iNNfo/specs/templates/workspace/procedures/compile_model_console_NN.md` | Created | New procedure: copy of `business/procedures/compile_model_viewer_NN.md` retargeted at `workspace/assets/model_console.html`, plus the `Resolve Element Citations` step (calls `resolve_sources({model, elementId: el.name})`, groups by `field`, drops the `field` key, sets `meta.citationsResolvedAt`, reports gaps) and the `<` → `<` escaping instruction in `Inject Data into Shell`. `business/procedures/compile_model_viewer_NN.md` and `business/spec_NN.md` were NOT touched (C5 deletes/edits them later). |
| `iNNfo/specs/templates/console/render-model-viewer.js` | Modified | Added `SOURCES_FAMILY`, `ORIGIN_VARIANT_ORDER`, `CITATION_ICON_LABELS`, `citationVariant()`, `citationButtons(fieldName, entries)`; wired the header button (merged `sources`/`source` entries, inserted before the chevron) and per-field-row buttons (inside the `fkeys.forEach` loop, appended to `tr.lastChild`) into `renderElement()`. Degrades to no icons when `window.InnfoConsole.renderCitationDialog`/`svgIcon` are absent. |
| `iNNfo/specs/templates/console/innfo-runtime.js` | Modified | Added 5 `svgIcon` entries (`cite-agent`, `cite-human`, `cite-reviewer`, `cite-document`, `cite-error`), `CITATION_ORIGIN_LABELS`, and `renderCitationDialog(doc, fieldName, entries)` (get-or-create `#innfo-citation-dialog`, reuses `innfo-ref-*` classes, `dt`/`dd` fields omitted when absent, excerpt in `pre.innfo-cite-excerpt` with a `… (truncated)` suffix, all text via `el()`/`textContent`). Exported `renderCitationDialog` and `svgIcon` in `PUBLIC_API`. |
| `iNNfo/specs/templates/workspace/assets/model_console.html` | Created | Copy of `business/assets/model_viewer.html` retargeted to the shared `innfo-console.bundle.js` (CDN `@innfo-console-v0.3.0` + main mirror + vendored copy, per design — C5 cuts the tag), plus `<dialog id="innfo-citation-dialog">` (and `#innfo-ref-dialog`, for symmetry), the widened `#innfo-ref-dialog, #innfo-citation-dialog` CSS block copied from `artifact_blueprint.html`, `--radius-sm`/`--radius-lg` variables (needed by that CSS block, absent from the original `:root`), and `.cite-icon`/`.cite-*` colour rules. |
| `iNNfo/packages/innfo-core/tests/console-citations-payload.test.ts` | Created | Text-scan tests of the new procedure's C2 contract, plus a reference-implementation check of the documented `<`→`<` escaping technique (proves a `</script>` in an excerpt cannot break the shell and that `JSON.parse` round-trips losslessly). |
| `iNNfo/packages/innfo-core/tests/console-citations-dom.test.ts` | Created | happy-dom tests of `render-model-viewer.js` citation icon placement/dedup/ordering/click-through, and the no-`citations` backward-compat case. |
| `iNNfo/packages/innfo-core/tests/console-citation-dialog.test.ts` | Created | happy-dom tests of `innfo-runtime.js`'s new `svgIcon` entries and `renderCitationDialog` (creation-on-demand, path/anchor/excerpt, truncation mark, missing-author omission, error-entry rendering, `<img onerror>` inertness). |
| `iNNfo/packages/innfo-core/tests/console-thinning.test.ts` | Modified | Added `model_console.html` to the asset table, 4 new assertions for it, and a byte-unchanged guard for `business/assets/model_viewer.html` (`git show HEAD:...` vs on-disk). |

### Deviations from Design

1. **Test environment: happy-dom, not jsdom.** Design/tasks say "jsdom tests" for C3/C4. The jsdom version vendored in this monorepo (hoisted from `innfo-editor`'s `devDependencies`, v30) does not implement `HTMLDialogElement.showModal` (verified directly: `d.showModal()` throws `TypeError: d.showModal is not a function`). happy-dom does. All new C3/C4 DOM test files use the `// @vitest-environment happy-dom` pragma, matching the convention already established by the pre-existing `console-dom.test.ts` (also happy-dom, also for the same `showModal` reason, per that file's own docstring). No production code depends on the test-environment choice.
2. **New test file naming.** Design says "a new jsdom file for XSS" named `console-dom.test.ts`; that filename was already taken by a pre-existing, unrelated suite (the procedures-console DOM boot/export-gate tests). Used `console-citations-dom.test.ts` (C3, `render-model-viewer.js`) and `console-citation-dialog.test.ts` (C4, `innfo-runtime.js` dialog + icons) instead, split along the same C3/C4 module boundary the rest of the design already uses.
3. **`model_console.html` switches to the bundled runtime, not the split tags.** `business/assets/model_viewer.html` loads `innfo-runtime.js` and `render-model-viewer.js` as separate static `<script src>` tags. Design's C3/C4 section for the new asset explicitly says "Bundle `<script src>` tags (CDN `@innfo-console-v0.3.0`, ... plus the main mirror and vendored `./innfo-console.bundle.js`)" — i.e. the single composed bundle, the same pattern `metrics/assets/timeline.html` already uses. Followed that instruction literally; this is a deliberate design choice, not something I introduced.
4. **`#innfo-ref-dialog` element added to `model_console.html` even though `model_viewer.html` never declared one.** Design's widened-selector instruction (`#innfo-ref-dialog, #innfo-citation-dialog`) implies both ids are meaningful in this shell; declaring the ref-dialog element alongside the citation one is additive and harmless (`renderRefDialog` no-ops if the element is absent either way) and keeps the CSS block's other selector meaningful rather than dead.
5. **TDD strictness gap on prose/asset "tests" (2.1, 4.4's non-CSS-logic parts).** `compile_model_console_NN.md` and the boilerplate parts of `model_console.html` (CSS copy, script tags) are large blocks of copied/adapted prose or markup with no algorithmic behavior to red-first against — there is no code path to fail before the content exists. Their tests were written and run green in the same step the content was authored, not red-first. Where there WAS a genuine algorithmic contract to test first (the `<`→`<` escape technique in 2.2/2.3, all of C3's icon placement logic, all of C4's dialog logic), strict RED→GREEN was followed and is evidenced above — including one real authoring bug caught by the RED run in 2.2/2.3 (see Issues Found).

### Issues Found

1. **JSON-escape footgun in the Write/Edit tool parameter layer.** Writing the literal four-character sequence `<` (backslash, `u`, `0`, `0`, `3`, `c`) into a markdown file via the `Write`/`Edit` tools is not possible directly — both tools transmit `content`/`new_string` through a JSON layer, and `<` inside a JSON string is a standard Unicode escape that decodes to the single character `<` before the file is ever written. The first attempt silently produced the wrong text (a bare `<` instead of the escape sequence), and the `console-citations-payload.test.ts` RED run caught it immediately (1/12 failed, right reason). Fixed by writing the raw bytes with a small Node script (`String.fromCharCode(92) + "u003c"`) instead of going through Write/Edit for that specific span. Worth remembering for any future edit that needs to place a literal backslash-escape sequence in a file.
2. **`require()`'s CJS cache survives `vi.resetModules()`.** `render-model-viewer.js` self-boots once via `autoBoot()` at module load; calling `vi.resetModules()` between tests does not clear Node's `require.cache` (only Vitest's own module graph), so a second `require()` of the same path returned the already-booted module without re-rendering against the freshly reset DOM — 4 of 8 tests in `console-citations-dom.test.ts` failed non-deterministically for a reason unrelated to the feature under test. Fixed by calling the exported `boot()` function explicitly every test instead of relying on `autoBoot()` re-triggering.

### Remaining Tasks

- [ ] C5 — Release unit, gated on `templates-v0.16.0` reaching `main` (tasks 5.0-5.12)

### Workload / PR Boundary (C2+C3+C4 batch)

- Mode: work-unit commits directly on `dev`, no PRs.
- Current work unit: C2+C3+C4 combined, per tasks.md's `Suggested Work Units` table (`C1 → C2/C3/C4 combined feature commit → C5`).
- Boundary: this batch starts from the C1-complete state and ends with one
  commit touching the new procedure file, the new workspace asset, the two
  modified console renderer/runtime files, and their tests. C1 (already
  committed as `7504551`) and C5 are untouched.
- Estimated review budget impact: **exceeds the tasks.md estimate.**
  tasks.md forecast ~280-380 lines for C2+C3+C4; the actual diff is
  ~206 changed lines across 3 modified files plus ~1,167 lines of new
  files (2 large boilerplate copies — `model_console.html` at 337 lines and
  `compile_model_console_NN.md` at 218 lines, both near-verbatim structural
  copies of existing published files — plus 3 new test files at 612 lines
  combined), for roughly **1,373 total changed lines**. No GitHub PR review
  applies under this delivery strategy (direct commits to `dev`), so the
  400-line reviewer-cognitive-load guard does not block the commit, but a
  future maintainer reading `git diff` for this commit should expect a
  large diff dominated by copy-derived boilerplate and test scaffolding,
  not hand-authored logic bulk (the actual new logic — `citationButtons`,
  `renderCitationDialog`, `citationVariant`, `svgIcon` entries — is under
  200 lines).

### Status

C1 + C2 + C3 + C4 complete (19/19 non-C5 tasks, plus 2/2 pre-C1
confirmation tasks, plus 2/3 cross-cutting acceptance items that don't
depend on C5). Ready for the C5 batch (release unit) in a separate
`sdd-apply` session, gated on the `templates-v0.16.0` → `main` precondition
check tasks.md requires `sdd-apply` to run itself before starting any C5
task.
