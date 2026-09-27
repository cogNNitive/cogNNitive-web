# Tasks: Lineage Traceability Quick Wins (Tanda A)

## Delivery model

This repo has no per-feature branches or PRs in normal flow (single `dev`
integration branch, batched to `main`). "Stacked PRs" from `delivery_strategy:
auto-chain` / `chain_strategy: stacked-to-main` maps here to **ordered,
independently-revertable work-unit commits on `dev`**, one per item, each
carrying its own tests. Do not create branches. Commit order is fixed:
**A1 → A2 → A3 → A4**. A3 MUST land before A4 (A4's default field-selection
path needs A3's `findDeclaredField` export).

## Review Workload Forecast

| Item | Files touched | Rough changed-line estimate | Notes |
|---|---|---|---|
| A1 | `FilePreviewModal.vue` (+ its component test) | ~60-90 | Mermaid init line, toggle state, collapse/expand rendering branch, test assertions |
| A2 | `lineage-check.js` (+ unit test) | ~40-60 | Loop split into known/drifted/unknown branches, JSDoc update, new warning-path tests |
| A3 | `declaredField.ts` (new, small), `schema/index.ts`, `src/index.ts`, `workspaceSources.ts`, `normalize.ts`, `workspace.ts` (+ new + existing tests, roundtrip re-run) | ~90-130 | Small new helper file, one delegation edit, one new export function, one wiring call site, plus tests |
| A4 | `resolve-sources.ts` (new), `resolve-sources.spec.ts` (new), `server.ts` (registry wiring) | ~150-220 | New tool file is the bulk: field selection, ref parsing loop, excerpt capping, error taxonomy, plus a full spec file with 4+ fixture scenarios |
| **Total (all 4, if landed as one combined diff)** | | **~340-500** | |

- **Chained PRs recommended:** No — each item already lands as its own
  separate, independently-revertable commit per design.md's commit-order
  section; there is no single combined diff to split further. The "chained"
  intent is satisfied by the four ordered commits themselves, not by
  additional splitting within an item.
- **400-line budget risk:** Medium — no single item individually is likely to
  cross ~400 changed lines (A4 is the largest at an estimated ~150-220), but
  the four items summed are in the ~340-500 range, and A4's spec fixture
  (multiple scenarios: resolvable citation, dangling file, unknown anchor,
  schema-typed field with and without explicit `fieldName`) could push its
  own commit past 250-300 lines on its own if the fixture setup is verbose.
- **Decision needed before apply:** No — since delivery is per-item commits
  (not a single PR), the informal 400-line convention applies per commit, not
  to the sum of all four. Flagging Medium risk here is informational for the
  orchestrator; no split decision is required because the design already
  specifies one commit per item and none is forecast to individually exceed
  ~400 lines. Re-flag if A4's actual diff, once written, approaches that
  ceiling.

## Known accepted behavior (not a task)

Design decision D5 (A3): the graph selects a schema-typed citation field by
**union** — name in `SOURCE_FIELD_NAMES` OR declared type `citation` — rather
than "declared type wins." Consequence: a field named `source::` whose schema
declares it as something *other than* `citation` (e.g. `documentation`'s
`source::`) still reaches the graph today via the existing name-based path,
even though its declared type says it isn't a citation. This is called out
explicitly in design.md (D5) as intentional, because the proposal requires
the name-based path to stay unchanged. **Decision: accept as-is, not a
blocking task.** It predates this change and A3 does not alter it. If it
becomes a problem in practice, file it as a Tanda B/C follow-up (schema
"declared type wins" reconciliation), not as work here.

---

## A1 — Lineage graph legibility (editor)

Spec: `specs/lineage-graph-legibility/spec.md`. Requirements: natural-size
top-down render; 4th-level outgoing relationships collapsed by default with a
`+N hidden` toggle.

- [x] **A1.1** Write/extend the failing test first (strict TDD, red first):
  `iNNfo/apps/innfo-editor/tests/component/FilePreviewModal.test.ts`
  - Assert `lineageMermaidCode` starts with
    `%%{init: {"flowchart": {"useMaxWidth": false}}}%%` followed by `graph TD`.
  - Assert that when the 4th level exists and is collapsed, the code contains
    a `+N hidden` node and no `R_x_y` nodes for the hidden level.
  - Assert that activating the toggle re-renders with the 4th-level nodes and
    without the hidden count.
  - Assert no toggle appears when the deepest outgoing chain is only 3 levels.
- [x] **A1.2** Implement in
  `iNNfo/apps/innfo-editor/src/components/editor/FilePreviewModal.vue`:
  - Line ~493: change the Mermaid header lines to
    `['%%{init: {"flowchart": {"useMaxWidth": false}}}%%', 'graph TD']`.
  - Add `const showOutgoing = ref(false)` and a toggle control in the lineage
    view template.
  - Collapsed: compute `hidden = outRels.length` per citing node; when
    `hidden > 0`, emit `R_${idx}_more["+${hidden} hidden"]:::emptyNode` and
    edge `${nodeId} -.-> R_${idx}_more`.
  - Expanded: keep existing `slice(0, 3)`; if `outRels.length > 3`, append a
    `+${outRels.length-3} hidden` node.
  - Change the wrapper at line ~312 from
    `flex justify-center overflow-x-auto` to `overflow-auto` with an inner
    `w-max mx-auto` (per design D2), so the modal scrolls instead of clipping.
  - Per design D1, do NOT touch `MermaidWidget.vue` — the `useMaxWidth` flag
    is scoped via the init directive in the lineage code string only, not the
    global `mermaid.initialize` call.
- [x] **A1.3** Run:
  `npm test --workspace iNNfo/apps/innfo-editor -- FilePreviewModal.test.ts`
  (or the repo's equivalent vitest invocation for that package) until green.
- **Depends on:** nothing (independent).
- **Can run in parallel with:** A2 (and, in principle, A3/A4, but commit
  order on `dev` stays A1 → A2 → A3 → A4).
- **Rollback:** `git revert` this single commit. Purely additive/local to the
  editor component; no persisted data or cross-item coupling. Safe to revert
  alone at any time.

## A2 — Artifact staleness diagnostic (nn-trannsform)

Spec: `specs/artifact-staleness-diagnostic/spec.md`. Requirements: unknown
model name stays an `error`; version-drifted-but-existing model becomes a
distinct `warning` that does not escalate under `--check`.

- [x] **A2.1** Write/extend the failing test first:
  `skills/nn-trannsform/test/unit/test-lineage-sync.js`
  - Case: artifact cites a nonexistent model → 1 `error`, non-zero exit
    (unchanged behavior, regression-guard it).
  - Case: artifact cites an existing model with drifted `model_version` → 1
    `warning` (not error), naming artifact, model, both versions; exit zero
    when it's the only finding.
  - Case: `--check` with only a drifted artifact → warning reported, exit
    code remains zero.
  - Case: one missing-model artifact + one drifted artifact together →
    exactly one `error` and one separate `warning`, reported independently.
- [x] **A2.2** Implement in `skills/nn-trannsform/scripts/lib/lineage-check.js`,
  loop at lines ~43-52:
  1. If `models.some(m => ref === m.name || (m.model_version && ref ===
     \`${m.name} ${m.model_version}\`))`, ref is OK, report nothing.
  2. Else `known = models.filter(m => ref.startsWith(m.name + ' '))`; if
     non-empty, push to `warnings`:
     `Artifact "X" derives from "ref", but models/ has "<name>" at
     <versions|no model_version> — artifact may be stale.`
  3. Else keep the existing error text unchanged.
  - Update the JSDoc header (lines ~9-13) to describe the split.
  - Confirm (no code change expected) that `scripts/index.js:84-90` already
    exits 0 when there are only warnings — this is the mechanism that keeps
    the new warning from escalating.
- [x] **A2.3** Run:
  `node skills/nn-trannsform/test/unit/test-lineage-sync.js` (or the repo's
  standard test runner entrypoint for that suite) until green.
- **Depends on:** nothing (independent of A1, A3, A4).
- **Can run in parallel with:** A1.
- **Rollback:** `git revert` this single commit. The warning is additive and
  doesn't change exit-code semantics for existing error cases; safe to revert
  alone.

## A3 — Schema-typed citations wired into the relationship graph (innfo-core)

Spec: `specs/typed-source-references/spec.md` (MODIFIED requirement).
Extracts a shared `findDeclaredField` helper and wires schema-typed `type::
citation` fields into `node.sources` and the relationship graph, additively
alongside the existing name-based `SOURCE_FIELD_NAMES` path.

- [x] **A3.1** Write the failing tests first (strict TDD):
  - New/extended unit test at the `recursiveParser`/`normalize` level (NOT
    the round-trip test — per design.md, `roundtrip-fidelity.test.ts` only
    exercises `parseModel`→`serializeModel` and never touches
    `recursiveParse`/`attachSourceCitations`, so it cannot exercise this
    behavior and must not be used as evidence for it). Add this as a new test
    file/case alongside existing `normalize`/`workspaceSources` tests in
    `iNNfo/packages/innfo-core` (co-locate with existing normalize/workspace
    tests, e.g. a `normalize.test.ts` or `attachSchemaTypedCitations.test.ts`).
    Assert:
    - `recursiveParse` with a resolver that declares `precio_source` as
      `citation` fills `node.sources` and adds an `origin: 'source'`
      relationship for it.
    - A `sources`-named field produces no duplicate entry (union semantics,
      no double-counting).
    - With no schema present, nothing changes (existing behavior preserved).
    - Existing `workspaceSources` tests stay green (run them as a regression
      check, not as new coverage).
- [x] **A3.2** Implement:
  - Create `iNNfo/packages/innfo-core/src/schema/declaredField.ts` exporting
    `findDeclaredField(schema, conceptType, fieldName)`; export it via
    `schema/index.ts` and `src/index.ts`.
  - `iNNfo/packages/innfo-core/src/validator/workspaceSources.ts`:
    `isCitationField` delegates to the new helper; behavior unchanged.
  - `iNNfo/packages/innfo-core/src/recursiveParser/normalize.ts`: keep
    `attachSourceCitations(node)` byte-identical. Add new export
    `attachSchemaTypedCitations(node, schema)` that walks fields where
    `!SOURCE_FIELD_NAMES.has(name)` and
    `findDeclaredField(...)?.type === 'citation'`, appends to `node.sources`,
    and pushes `{targetId: ref.filePath, label: fieldName, origin: 'source'}`.
  - `iNNfo/packages/innfo-core/src/recursiveParser/workspace.ts`, after line
    ~558: for every `ctx.nodes` entry with `kind === 'element' && source.path
    === resolvedPath`, call `attachSchemaTypedCitations(node, schema)`. (Post
    a schema-stash pass, per design D3 — not inside
    `normalizeElementsIntoGraph`, which runs before `childNode.templateSchema`
    is set.)
- [x] **A3.3** Run the new normalize/recursiveParse-level test(s), the
  existing `workspaceSources` suite, AND
  `tests/roundtrip-fidelity.test.ts` as a regression gate (per design.md: it
  cannot exercise this feature, but it must stay green to prove A3 didn't
  perturb `parseModel`/`serializeModel`). Command:
  `npm test --workspace iNNfo/packages/innfo-core` (or the package's targeted
  vitest invocation covering `normalize`, `workspaceSources`, and
  `roundtrip-fidelity`).
- **Depends on:** nothing functionally, but must be committed before A4 per
  the fixed commit order.
- **Can run in parallel with:** A1, A2 (implementation-wise); commit order on
  `dev` still places it after both.
- **Rollback:** Reverting A3's commit **requires reverting A4 first, or
  keeping `findDeclaredField`** (per design.md's Migration/Rollout section) —
  A4 imports `findDeclaredField` from innfo-core's built `dist` for its
  omitted-`fieldName` path. If A3 must be reverted while A4 stays, keep
  `src/schema/declaredField.ts` and its exports in place (do not delete the
  helper) and revert only the `normalize.ts`/`workspace.ts`/
  `workspaceSources.ts` wiring changes.

## A4 — `resolve_sources` MCP tool (innfo-mcp)

Spec: `specs/citation-source-resolution/spec.md`. New read-only tool
`resolve_sources({model, elementId, fieldName?})`.

- [x] **A4.0** Before writing or trusting any A4 test, **rebuild
  innfo-core**: `npm run build --workspace iNNfo/packages/innfo-core` (or the
  repo's equivalent build command). innfo-mcp consumes innfo-core's built
  `dist`, not its source; per design.md's Interfaces section, `findDeclaredField`
  must be present in the built output before A4's omitted-`fieldName` path
  (which depends on A3) can be exercised or trusted. Do this every time
  before running A4 tests, including in CI/local re-runs after any innfo-core
  change.
- [x] **A4.1** Write the failing tests first:
  `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.spec.ts`, using the same
  temp-dir fixture shape as `query-units.spec.ts`. Cases:
  - A resolvable `@## Section` citation → excerpt ≤500 chars, `sha256` set.
  - A dangling file → `exists: false`, `error` set, no `excerpt`/`sha256`/
    `version`, and the call does not throw.
  - An unknown anchor within an existing file → `exists: true` for the file,
    `error` describing the unresolved anchor.
  - A schema-typed non-`sources` field, explicit `fieldName` given (works
    standalone, does not need A3).
  - A schema-typed non-`sources` field, **omitted** `fieldName` (needs A3's
    `findDeclaredField`) — build this fixture with a **local `parent_spec`
    template fixture**, per design.md's explicit note referencing
    `spec.spec.ts:154`, so schema resolution does not attempt a remote
    template fetch. Assert no network fetch occurs and no files are written.
  - Long section (2000 chars) truncates to ~500; short section (120 chars)
    returns in full, uncapped.
- [x] **A4.2** Implement `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.ts`:
  - `findModelFile` → `readModel`; find the element by name across
    `model.elements`.
  - Pick fields: `[fieldName]` when given. Otherwise, fields where
    `SOURCE_FIELD_NAMES` matches OR `findDeclaredField(schema, concept,
    f)?.type === 'citation'` (schema comes from `resolveTemplateWithCache` +
    `buildTemplateSchemaResolverFromCache`, per design D6 — not a full
    `recursiveParse`). When there is no schema, fall back to
    `SOURCE_FIELD_NAMES` only.
  - For each value from `splitSourceFieldValue`, parse with
    `parseKnowledgeUnitRef ?? parseSourceRef`, then
    `createWorkspaceSourceResolver(root)(ref.filePath, modelPath)`.
  - Excerpt: `ref.unit` set → `resolveUnit(content, ref)`; else `ref.slug` set
    → `resolveHeadingSection`. Cap at `EXCERPT_CHAR_CAP = 500`.
  - Frontmatter via innfo-core's `parseFrontmatter` (not
    `provenance-model.js`, which is CommonJS and unreachable from innfo-mcp
    per design D7); read `sha256` and `version ?? model_version`.
  - Export `EXCERPT_CHAR_CAP`, `ResolvedCitation`, `resolveSources` per the
    Interfaces section signatures in design.md.
- [x] **A4.3** Register the tool: add a `resolve_sources` entry to
  `TOOL_REGISTRY` in `iNNfo/packages/innfo-mcp/src/server.ts` (~line 88) and
  `handleResolveSources`, wrapping the result with
  `envelope('innfo-resolve-sources', …)`. Confirm `TOOL_COUNT` updates itself
  (no hardcoded count to bump).
- [x] **A4.4** Update/verify `server.spec.ts` covers the new tool count and
  that `resolve_sources` is listed.
- [x] **A4.5** Run, in order: rebuild innfo-core (A4.0, repeat if it changed
  since), then
  `npm test --workspace iNNfo/packages/innfo-mcp -- resolve-sources.spec.ts
  server.spec.ts` (or the package's targeted vitest invocation) until green.
- **Depends on:** A3 (hard dependency for the omitted-`fieldName` path via
  `findDeclaredField`; explicit `fieldName` calls work without A3, but the
  tool as a whole is specified and tested assuming A3 has landed).
- **Can run in parallel with:** nothing — must commit strictly after A3.
- **Rollback:** Revert this commit alone; it is additive (new file + registry
  entry) and touches no persisted data. Reverting A4 does not require
  reverting A3.

---

## Cross-cutting acceptance (from proposal.md Success Criteria)

- [x] A wide lineage graph is legible and scrolls; the 4th level is collapsed
  by default. (A1)
- [x] A version-drifted artifact gets the stale warning; an unknown model
  keeps the error. (A2)
- [x] `precio_source:: type:: citation` appears in `node.sources` and in the
  relationships; round-trip stays byte-identical. (A3)
- [x] `resolve_sources` spec covers a resolvable citation, a dangling file, an
  unknown anchor and a schema-typed field. (A4)
