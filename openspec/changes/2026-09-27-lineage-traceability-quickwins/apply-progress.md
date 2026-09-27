# Apply Progress: Lineage Traceability Quick Wins (Tanda A)

Batch 1 (first and only batch so far): all 4 items implemented, tested, and
committed on `dev` in the fixed order (A1 → A2 → A3 → A4).

## A1 — Lineage graph legibility (editor)

- [x] A1.1 Failing test written first (RED confirmed):
      `iNNfo/apps/innfo-editor/tests/component/FilePreviewModal.test.ts`
- [x] A1.2 Implemented in
      `iNNfo/apps/innfo-editor/src/components/editor/FilePreviewModal.vue`:
      Mermaid init directive (`useMaxWidth:false`) + `graph TD` scoped to the
      lineage code string only (`MermaidWidget.vue` untouched per design D1);
      wrapper changed from `flex justify-center overflow-x-auto` to
      `overflow-auto` + inner `w-max mx-auto` (D2); `showOutgoing` toggle,
      collapsed-by-default 4th-level outgoing relationships with `+N hidden`.
- [x] A1.3 Tests green: `npm test --workspace=@cognnitive/innfo-editor --
      FilePreviewModal.test.ts` → **9/9 passed**. `npm run typecheck
      --workspace=@cognnitive/innfo-editor` → clean.
- **Commit:** `ebde473` — feat(editor): render lineage graph at natural size
  with collapsible relationships

## A2 — Artifact staleness diagnostic (nn-trannsform)

- [x] A2.1 Failing tests written first (RED confirmed) in
      `skills/nn-trannsform/test/unit/test-lineage-sync.js` (subtests 2.3A–C).
- [x] A2.2 Implemented in `skills/nn-trannsform/scripts/lib/lineage-check.js`:
      split loop into known / drifted (→ `warnings`) / unknown (→ `errors`);
      updated JSDoc header. Confirmed `scripts/index.js:84-90` already exits 0
      on warnings-only (no code change needed there).
- [x] A2.3 Tests green: `node
      skills/nn-trannsform/test/unit/test-lineage-sync.js` → all assertions
      pass. Full suite `node test/run.js unit` (nn-trannsform) → **508
      passed, 0 failed**.
- **Commit:** `bba87ef` — feat(nn-trannsform): split lineage-check
  missing-model vs stale-version diagnostics

## A3 — Schema-typed citations wired into the graph (innfo-core)

- [x] A3.1 Failing tests written first (RED confirmed) at the
      `recursiveParse` level (NOT roundtrip-fidelity, per design.md):
      `iNNfo/packages/innfo-core/tests/attachSchemaTypedCitations.test.ts`.
- [x] A3.2 Implemented:
      - New `iNNfo/packages/innfo-core/src/schema/declaredField.ts`
        (`findDeclaredField`), exported via `schema/index.ts` + `src/index.ts`.
      - `validator/workspaceSources.ts`: `isCitationField` delegates to the
        helper, behavior unchanged.
      - `recursiveParser/normalize.ts`: `attachSourceCitations` untouched
        (byte-identical); new `attachSchemaTypedCitations(node, schema)`.
      - `recursiveParser/workspace.ts`: wired after the schema-stash line
        (~558), per design D3 (not inside `normalizeElementsIntoGraph`).
- [x] A3.3 Tests green:
      `attachSchemaTypedCitations.test.ts` (3/3), `workspaceSources.test.ts`
      (20/20), `citation-typing.test.ts` (8/8), `source-citations.test.ts`
      (30/30), `roundtrip-fidelity.test.ts` (3/3, regression gate, unchanged
      as expected). Full package: `npm test` → **867 passed, 1 skipped**.
      `npm run build` (tsc) → clean.
- **Commit:** `47f9e64` — feat(innfo-core): wire schema-typed citation fields
  into the relationship graph

## A4 — `resolve_sources` MCP tool (innfo-mcp)

- [x] A4.0 Rebuilt innfo-core before writing/running A4 tests (`npm run
      build --workspace=@cognnitive/innfo-core`, re-confirmed after the A3
      commit).
- [x] A4.1 Failing tests written first (RED confirmed):
      `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.spec.ts` — 8 cases:
      resolvable citation (excerpt + sha256), fieldName filter, dangling file
      (no throw), unknown anchor, explicit-fieldName schema-typed field
      (standalone, no A3 dependency), omitted-fieldName schema-typed field
      (local `parent_spec` template fixture mirroring `spec.spec.ts`'s
      `stubSpecChain`/`stubTemplateChain` pattern — no network fetch, no file
      writes), long-section truncation, short-section uncapped.
- [x] A4.2 Implemented `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.ts`:
      `resolveSources(rootDir, {model, elementId, fieldName?})`, field
      selection via `SOURCE_FIELD_NAMES` ∪ `findDeclaredField(...).type ===
      'citation'` (schema from `resolveTemplateWithCache` +
      `buildTemplateSchemaResolverFromCache`, D6 — single-model read, not a
      full `recursiveParse`), citation resolution via
      `createWorkspaceSourceResolver`, excerpt via `resolveUnit`/
      `resolveHeadingSection` capped at `EXCERPT_CHAR_CAP = 500`, frontmatter
      via innfo-core's `parseFrontmatter` (D7). Exports `EXCERPT_CHAR_CAP`,
      `ResolvedCitation`, `resolveSources` per design's Interfaces section.
- [x] A4.3 Registered `resolve_sources` in `TOOL_REGISTRY`
      (`iNNfo/packages/innfo-mcp/src/server.ts`) + `handleResolveSources`,
      wrapped with `envelopeList('innfo-resolve-sources', 'citations', ...)`.
      `TOOL_COUNT` self-updates (no hardcoded count).
- [x] A4.4 `server.spec.ts` extended: new test asserting `resolve_sources` is
      listed; the existing tool-count test already derives from `TOOL_COUNT`/
      `toolDefinitions` (no literal to bump).
- [x] A4.5 Tests green, in order: rebuilt innfo-core, then
      `resolve-sources.spec.ts` → **8/8 passed**; `server.spec.ts` → **33/33
      passed**. Full package: `npm test` (innfo-mcp) → **297 passed**.
      `npm run typecheck` (innfo-mcp) → clean.
- **Commit:** `30ce4e6` — feat(innfo-mcp): add read-only resolve_sources tool

## Cross-cutting verification

- Repo-wide `npm run typecheck` (innfo-core build + innfo-mcp typecheck +
  innfo-editor vue-tsc) → clean, run after all 4 commits.
- No `git add -A`/`.` used; every commit staged explicit file lists.
- No commits made red; each item's own tests were run and green before
  committing.

## Fix-forward: A3 entrypoint gap (confirmed CRITICAL by fresh-context sdd-verify)

`sdd-verify` (adversarial fresh-context review) found that A3's wiring call in
`workspace.ts` (~lines 562-572) runs only inside the `while (queue.length > 0)`
worklist loop, gated on `node.source.path === resolvedPath` where
`resolvedPath` always comes from a queued submodel item. The entrypoint model
(`workspace_NN.md`/`index.md`) is registered via `parseAndRegisterModel`
*before* that loop starts and its own path never becomes a queued
`resolvedPath` — so `type:: citation` fields declared directly on elements of
the entrypoint model itself were never wired into `node.sources`/relationships,
only ones in submodels reached via the worklist. This contradicted the
generic (no entrypoint exception) wording in
`specs/typed-source-references/spec.md`, and the existing test suite didn't
catch it because all 3 original `attachSchemaTypedCitations.test.ts` cases put
the citation-typed element inside a submodel.

- **Gap closed:** added a second, additive call site in
  `iNNfo/packages/innfo-core/src/recursiveParser/workspace.ts`, right after
  `entrypointSchema` is computed and before the worklist loop starts, mirroring
  the exact post-schema-stash pattern already used inside the loop. Iterates
  `ctx.nodes` for `node.kind === 'element' && node.source.path ===
  entrypointPath` and calls `attachSchemaTypedCitations(node, entrypointSchema)`.
  Purely additive — the worklist loop and submodel handling are untouched.
- **Regression test added:** a 4th case in
  `attachSchemaTypedCitations.test.ts` using a `workspace_01.md` primary
  entrypoint (not a submodel) with a `precio_source:: citation` field declared
  directly on an entrypoint element, asserting it is wired into
  `node.sources`/relationships.
- **Tests re-run, all green:** `attachSchemaTypedCitations.test.ts` (4/4),
  `roundtrip-fidelity.test.ts` (3/3), `workspaceSources.test.ts` (20/20),
  `source-citations.test.ts` (30/30), `citation-typing.test.ts` (8/8). Full
  innfo-core suite: **868 passed, 1 skipped** (71 files). `npm run build`
  (tsc) → clean. innfo-mcp, rebuilt against the new innfo-core dist:
  `resolve-sources.spec.ts` (8/8), `server.spec.ts` (33/33).
- **Commit:** `fix(innfo-core): wire schema-typed citations for entrypoint
  elements` (fix-forward, not amended into `47f9e64`).

## Remaining work

None — all 4 tasks (A1–A4), the cross-cutting acceptance criteria from
proposal.md, and the entrypoint-gap fix-forward above are implemented, tested,
and committed. Ready for re-verification.
