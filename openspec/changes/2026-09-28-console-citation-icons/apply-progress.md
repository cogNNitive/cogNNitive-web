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

### Remaining Tasks

- [ ] C2 — Payload: `workspace/procedures/compile_model_console_NN.md` (tasks 2.1-2.4)
- [ ] C3 — Renderer: `render-model-viewer.js` (tasks 3.1-3.4)
- [ ] C4 — Runtime: `innfo-runtime.js` icons and dialog (tasks 4.1-4.5)
- [ ] C5 — Release unit, gated on `templates-v0.16.0` reaching `main` (tasks 5.0-5.12)

### Workload / PR Boundary

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

### Status

C1 complete (6/6 tasks, plus 2/2 pre-C1 confirmation tasks). Ready for the
next batch (C2-C4) in a separate `sdd-apply` session.
