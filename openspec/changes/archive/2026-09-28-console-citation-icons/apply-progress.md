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

---

## C5 — Release unit

**Status**: Done. All 13 tasks (5.0-5.12) complete. Two commits on `dev`,
per this repo's own `ae1d8f0`/`59070b0` release precedent: `9e8cfde` (5a:
tasks 5.1-5.8) and `15f255e` (5b: task 5.11's manifest re-pin). Tags
`templates-v0.17.0`, `innfo-console-v0.4.0`, `innfo-mcp-v0.11.0` cut on
`9e8cfde` and pushed to origin. `dev` was **not** pushed (explicit
instruction from the launching orchestrator, not just the usual
`nn-dev-development` gate).

### Precondition re-check (task 5.0)

Re-ran `git merge-base --is-ancestor templates-v0.16.0 origin/main` at the
start of this session (the orchestrator's own precondition check could have
gone stale): succeeded. C5 proceeded.

### Task-by-task

- [x] 5.0 Precondition gate — confirmed above.
- [x] 5.1 Deleted `iNNfo/specs/templates/business/procedures/compile_model_viewer_NN.md`
      (`git rm`).
- [x] 5.2 `business/spec_NN.md`: dropped the `compile-model-viewer`
      `procedures:` entry (kept `model-viewer-shell` under `assets:`);
      bumped `template_version` `V_0-2-5` → `V_0-2-6` only —
      `spec_version` and `manifest/source.yaml`'s `templates[business].version`
      both stayed `V_0-2-5` (two-axes rule, verified by inspection: `sync-versions.mjs`'s
      `syncSourceYaml` writes `templates[]`/`frozen_templates[]` from
      `spec_version`, not `template_version`, so it never touches that
      field). Added a history-note sentence to the Examples/Canonical
      Sample prose (this template's established place for narrating
      what changed per version — no `## History` section convention
      exists elsewhere in this repo's spec_NN.md files, checked by grep
      before choosing this placement) documenting the relocation to
      `workspace/procedures/compile_model_console_NN.md` and that
      `model-viewer-shell` stays declared for one transition cycle with
      no procedure targeting it. Did **not** add a `procedures:` entry to
      `workspace_spec_NN.md` — confirmed the `compile_workspace_hub_NN.md`
      precedent (undeclared workspace procedure, no manifest entry) still
      holds on disk before relying on it.
- [x] 5.3 Mirrored 5.2 exactly in `canonical-registry.ts`'s
      `BUSINESS_SPEC_CONTENT` (frontmatter + procedures: removal) and
      bumped `CANONICAL_TEMPLATES.business.version` `'V_0-2-5'` →
      `'V_0-2-6'` (this field mirrors `template_version`, confirmed via
      the WU4 precedent's workspace entry, not `spec_version` — no new
      alias needed since `spec_version`-named files didn't change).
- [x] 5.4 `manifest/source.yaml`: `console_assets[0].version` `"0.3.0"` →
      `"0.4.0"`. `model_console.html`'s two `@innfo-console-v0.3.0`
      occurrences (JSON runtime config + `<script src>`) repointed to
      `@innfo-console-v0.4.0`.
- [x] 5.5 `iNNfo/packages/innfo-mcp/package.json`: `"version"` `0.10.0` →
      `0.11.0`.
- [x] 5.6 Ran `node scripts/build-console-bundle.mjs` (console bundle
      rebuilt, version 0.4.0 baked into its header), then
      `npm --workspace=@cognnitive/innfo-core run build` and
      `npm --workspace=@cognnitive/innfo-mcp run build:bundle` (tsup,
      version 0.11.0 baked in via `__INNFO_MCP_VERSION__`). Ran
      `node scripts/sync-versions.mjs` directly (**not** the composite
      `npm run sync:versions`, which chains `generate-manifest.js
      --channel stable` — see Deviation 1 below) — propagated
      `samples.ts`'s `business` entry, `innfo-core/package.json`'s
      version, and `innfo-mcp/package.json`'s `@cognnitive/innfo-core`
      dependency range, all to `0.11.0`/`V_0-2-6` as applicable; left
      `manifest/source.yaml`'s `templates[business].version` untouched
      (confirmed by diff — see 5.2). Ran `node scripts/template-catalog.mjs`
      directly for the same reason, then manually copied
      `iNNfo/specs/templates/catalog.json` → `docs/innfo/templates/catalog.json`
      (the two-copy mirror `build-docs.mjs` normally keeps in sync,
      same as WU4's 4.9 note). Confirmed the rebuilt `innfo-mcp.bundle.js`
      no longer contains the string `compile_model_viewer_NN` (0 matches)
      and does contain the new `V_0-2-6`/`business` registry content.
- [x] 5.7 `docs/innfo/documentation/offline-consoles.md`: updated the
      "two canonical shells" paragraph (was line ~31) to name
      `workspace/assets/model_console.html` as a third canonical,
      bundle-booted shell with its DOM anchors (`#doc-title`/`#rail`),
      confirmed directly against the shipped HTML rather than assumed.
      Added a note after the legacy-runtime table (was line 102, the
      literal task target) that `model_viewer.html` is superseded by
      `model_console.html` and that the `Compile Model Viewer` procedure
      was removed in `template_version` `V_0-2-6`. Grepped the whole
      file first for prior `model_viewer`/`model_console` mentions (none)
      to confirm there was no other spot needing an update.
- [x] 5.8 Grep-verified: zero occurrences of the literal string
      `business/procedures/compile_model_viewer_NN.md` anywhere in the
      repo except the exempted frozen fixture
      (`iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion/**`,
      confirmed present and untouched) and expected historical/planning
      mentions (this change's own `openspec/changes/2026-09-28-*/` docs,
      the negative-assertion test in `console-citations-payload.test.ts`
      that asserts the string's *absence* from the new procedure). Before
      the rebuild in 5.6, the old `innfo-mcp.bundle.js` still contained
      the bare `compile_model_viewer_NN` path (baked into its stale
      registry mirror) — confirmed it disappeared post-rebuild rather
      than assuming the rebuild would fix it.
- [x] 5.9 Committed 5a (`9e8cfde`, 13 files — the 5.1-5.8 changes only;
      explicitly excluded 5 unrelated files with uncommitted foreign
      changes already present in the shared tree at session start —
      `docs/contact.html`, `docs/index.html`, `docs/use-cases.html`,
      plus untracked `docs/legal.html`/`docs/privacy.html` — staged by
      explicit path list, no `git add -A`/`.`). Ran the 4 gates in this
      order: `guard-template-immutability` (OK), `check:integrity`
      (found and fixed a real pre-existing gap — see Issues Found item 1),
      `check:spec-urls` (OK, exit 0), `node scripts/verify.js` (single
      expected failure — see Deviation 1). Re-ran `check:integrity` after
      the commit; the only remaining failure was that same expected one.
- [x] 5.10 Cut 3 annotated tags on `9e8cfde` and pushed:
      `templates-v0.17.0`, `innfo-console-v0.4.0`, `innfo-mcp-v0.11.0`.
      `git push origin templates-v0.17.0 innfo-console-v0.4.0 innfo-mcp-v0.11.0`
      → all 3 reported `[new tag]`. `dev` itself was not pushed, per the
      orchestrator's explicit instruction.
- [x] 5.11 Committed 5b (`15f255e`): bumped `channels.stable.refs`'
      `templates` entry `version: "0.16.0"` → `"0.17.0"` in
      `manifest/source.yaml`, then ran (with `GITHUB_TOKEN` from
      `gh auth token`) `node scripts/manifest/generate-manifest.js
      --channel stable`, which now resolved all 3 new tags cleanly and
      rewrote `docs/use/manifest.md`. Also folded in
      `docs/innfo/cdn/manifest.json`'s `latest`/`updated` bump (a
      side effect of the 5.6 `build:docs`-adjacent bundle rebuild,
      not itself gated by any check, but part of the same "pin to
      release" family per the `ae1d8f0`/`59070b0` precedent this
      commit's message cites).
- [x] 5.12 Validated in a `git worktree add --detach` checkout at
      `15f255e` (a sibling directory, not the shared `dev` checkout).
      See "Detached-worktree validation" below for the full pass/fail
      summary and the environmental caveat.

### Detached-worktree validation (task 5.12)

Replicated 2 categories of gitignored/untracked local state into the
worktree before running anything, per WU4's documented caveat (copied,
never junctioned, learning from WU4's `git worktree remove` incident):
root `node_modules` (7m49s via `cp -a`), the 4 workspace-nested
`node_modules` (`innfo-core`, `innfo-mcp`, `innfo-editor`, and
`skills/nn-trannsform` — the last one is WU4's specific documented
gotcha), and `docs/innfo/cdn/*.bundle.js` (needed for `check:integrity`'s
Group 2 CDN-staging check).

**`node scripts/manifest/validate-manifest.js --channel stable`** (with
`GITHUB_TOKEN`): **FAIL, 19 violations — exactly one family, zero
independent.** 18 × "not reachable from main" (all 9 skills, all 16
templates, and `innfo-console.bundle.js`) + 1 × "content ... differs
between pinned commit and main" (`business`, since its `spec_NN.md`
content changed and `main` doesn't have it yet). Verified with a filtered
grep that no other violation category exists in the output. This is
exactly the family tasks.md's own annotation predicted ("expected red
only for 'not reachable from main'") plus the one content-diff case WU4's
4.14 also hit for its own changed templates — not a regression.

**`node scripts/check-integrity.js`** (with `GITHUB_TOKEN`): first run
**FAIL** — one failure, `skills/nn-video-script/test/render-thumbnail.test.mjs`,
`sharp`/`svgload_buffer: SVG rendering failed (glib rendering error)`.
Reproduced as environmental, not a regression: the identical test passes
in the main tree (`node skills/nn-video-script/test/render-thumbnail.test.mjs`
→ all 5 assertions green) and only fails in the `cp -a`-copied worktree —
consistent with `sharp`'s native `libvips`/`glib` bindings embedding
absolute or install-relative paths that a raw directory copy to a
different path breaks. Temporarily moved that one test file aside inside
the worktree only (never touched in the real `dev` tree) to see past it,
re-ran: **`🎉 [nn-dev-check-integrity] ALL INTEGRITY GATES PASSED.`** — 0
`FAIL`/`❌` lines in the full log, including `Check Stable Manifest Doc
Fresh` (green now that the tags exist) and `Template Immutability Guard`.
Restored the test file before removing the worktree.

Removed the worktree with `git worktree remove --force` afterward —
confirmed `git worktree list` shows only the main `dev` checkout, and
confirmed no foreign in-flight changes in the shared tree were disturbed
(see Issues Found item 2).

### Files changed

| Commit | Files |
|--------|-------|
| `9e8cfde` (5a) | 13 files: deleted `business/procedures/compile_model_viewer_NN.md`; `business/spec_NN.md`; `canonical-registry.ts`; `manifest/source.yaml`; `innfo-mcp/package.json`; `innfo-core/package.json`; `innfo-mcp/bin/innfo-mcp.bundle.js`; `console/innfo-console.bundle.js`; `workspace/assets/model_console.html`; `innfo-editor/src/config/samples.ts`; `specs/templates/catalog.json`; `docs/innfo/templates/catalog.json`; `docs/innfo/documentation/offline-consoles.md` |
| `15f255e` (5b) | `manifest/source.yaml` (templates channel ref); `docs/use/manifest.md`; `docs/innfo/cdn/manifest.json` |

### Deviations from Design

1. **`sync:versions`/`generate-manifest` cannot run as the single
   composite command claimed in task 5.6/design's step 6, before tags
   exist.** `channels.stable.refs`' `innfo-mcp`/`innfo-console` rows have
   no `version:` field — `resolveChannelRefs` (`scripts/lib/channel-refs.js`)
   derives their ref directly from the artifact version
   (`VERSION_SOURCE['innfo-mcp'|'innfo-console']`), unlike `templates`/`skills`,
   which carry an explicitly staged `version:` that lags behind until a
   later re-pin commit. The instant `innfo-mcp`'s `package.json` version
   or `console_assets[0].version` changes, `generate-manifest.js` (called
   by both `npm run sync:versions` and `verify.js` step 8) tries to
   resolve `innfo-mcp-v0.11.0`/`innfo-console-v0.4.0` via the GitHub API
   and fails with exit 2 (`ref ... not found as a tag or branch`) — not a
   diff, a hard resolution error, so it fails identically with or without
   `--check`. Reproduced directly (`generate-manifest.js --channel stable
   --check` → `FAIL: innfo-mcp: ref 'innfo-mcp-v0.11.0' not found...`)
   before working around it. This is exactly what this repo's own history
   already does differently from design's literal wording: `git log`
   shows `ae1d8f0` ("bump iNNfo Suite to 0.10.0") never touched
   `docs/use/manifest.md`, and a separate, later commit `59070b0`
   ("pin stable manifest to v0.10.0 release tags") did that alone, after
   tagging. Followed that real precedent instead of the task list's
   literal single-command wording: ran `node scripts/sync-versions.mjs`
   and `node scripts/template-catalog.mjs` directly (skipping the
   `generate-manifest` step) in 5.6/commit 5a, and ran
   `generate-manifest.js --channel stable` for real in 5.11/commit 5b,
   after the tags existed. Net effect on the task list is zero — every
   task 5.1-5.12 still completed — but the exact shell command differs
   from "run `npm run sync:versions`" as literally written. Flagged here
   so `sdd-verify` can judge the substitution on its merits.
2. **`GITHUB_TOKEN` needed to be sourced from `gh auth token` manually**
   for `generate-manifest.js` (both the pre-tag failure and the post-tag
   success) and for both worktree checks — `verify.js`'s own auto-fetch
   (`execSync('gh auth token')`) only applies inside `verify.js` itself,
   not to bare `node scripts/manifest/...` invocations run directly. Hit
   one transient `403` rate-limit on an unrelated ref
   (`nn-video-script`/`skills-v2.4.0`) on the first unauthenticated
   attempt; exporting the token first resolved it. Not a design gap, just
   worth recording for the next person running these scripts standalone.

### Issues Found

1. **A pre-existing tag/pin-freshness gap, not introduced by this
   change, self-resolved by this commit.** Before committing 5a,
   `check:integrity`'s Group 1c (`checkTagPinFreshness`, diffs
   `origin/main...HEAD`) failed: "skills/ changed (5 path(s) ...) but
   manifest/source.yaml was not re-pinned in the same diff" — caused by
   an earlier, already-committed `dev` commit (`42926e4`, visible in
   `git log`, touching `skills/nn-trannsform/**`) that never re-pinned
   the manifest. This predates my session and is unrelated to C5's
   scope. Confirmed the mechanism (`origin/main...HEAD`, not working-tree
   diff) before concluding it would self-resolve, then re-ran after
   committing 5a: green, because `manifest/source.yaml` is now part of
   the same cumulative diff. Not something I fixed by editing
   `skills/nn-trannsform` — just recording that the gate's pass/fail
   flipped because of ordering, not because the underlying skill commit
   became correct.
2. **The shared working tree had foreign, unrelated in-flight work
   during this session**, consistent with this repo's documented
   concurrency hazard. At different points, `git status` showed
   uncommitted changes to `docs/contact.html`/`docs/index.html`/
   `docs/use-cases.html`/`docs/legal.html`/`docs/privacy.html` (later
   disappeared — presumably committed elsewhere as `640964f`, visible in
   `git log` between my two commits) and, after the ~8-minute worktree
   `node_modules` copy, new uncommitted changes to
   `console/innfo-console.bundle.js`, `console/innfo-runtime.js`,
   `metrics/assets/timeline.html`, `metrics/procedures/create_timeline_NN.md`,
   `metrics/samples/*`, and `workspace/procedures/compile_workspace_hub_NN.md`
   (substantial, unrelated feature work — 300+ lines in `innfo-runtime.js`
   alone). None of these were staged, committed, or otherwise touched by
   this session; verified after every commit that only the intended
   explicit paths were staged (no `git add -A`/`.` used anywhere in this
   batch) and that my own files' content was unaffected.

### Confirmations for the orchestrator

- `dev` was **not** pushed to `main` or to `origin/dev` — only the 3 tags
  were pushed. `git log --oneline -3` on `dev`:
  `15f255e chore(manifest): pin stable manifest to templates-v0.17.0
  release tags`, `640964f` (foreign, not this session's), `9e8cfde
  feat(release): relocate model consultation to console, bump versions
  (Tanda C5)`.
- `cogNNitive`'s frozen template (`manifest/source.yaml`'s
  `frozen_templates:` list — `cogNNitive` and `base`) was not touched;
  confirmed no diff in either commit touches
  `iNNfo/specs/templates/cogNNitive/**` or `iNNfo/specs/templates/base/**`.
- `validate-manifest --channel stable`: **FAIL, 19/19 violations in the
  single expected "ahead of main" family, 0 independent violations.**
- `check:integrity`: **`🎉 ALL INTEGRITY GATES PASSED`** in the detached
  worktree (after working around the unrelated, reproduced-as-environmental
  `sharp` failure local to that copied worktree only).

### Cross-cutting acceptance (final)

- [x] Every cited field shows an icon matching its origin, and the
      dialog content matches `resolve_sources` output. (C1-C4)
- [x] A console compiled without citations renders unchanged. (C3, task
      3.1)
- [x] Nothing references the business procedure path, and
      `check:integrity` and `validate-manifest` pass (`validate-manifest`
      passes in the sense tasks.md defines: zero violations outside the
      single documented "ahead of main" family, which cannot close until
      the maintainer-gated `dev`→`main` merge — same boundary as WU4).
      (C5, tasks 5.8-5.12)

All 3 Tanda C success criteria from `proposal.md` are now met on `dev`.
