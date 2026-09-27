# Proposal: Lineage Traceability Quick Wins (Tanda A)

## Intent

Answering "where did this value come from?" is harder than it needs to be, even though the data already exists: the lineage graph shrinks until it is unreadable, stale artifacts are reported as missing models, schema-typed citation fields never reach the graph, and no MCP tool resolves a citation to its content. Tanda A closes these four gaps without touching the iNNfo language spec.

## Scope

### In Scope
- **A1** `innfo-editor`: the lineage Mermaid graph renders at its natural size (`flowchart.useMaxWidth: false`) and uses `graph TD`. The modal scrolls instead of shrinking the graph. A toggle collapses the outgoing-relationships level, and it is collapsed by default.
- **A2** `nn-trannsform` `lineage-check.js`: split check #2 into two cases. An unknown model name keeps the existing error. A known model with a different `model_version` gets a new distinct staleness **warning**.
- **A3** `innfo-core` `attachSourceCitations`: fields whose schema declares `type:: citation` populate `node.sources` and `origin: "source"` relationships. The existing name-based path (`SOURCE_FIELD_NAMES`) stays as it is.
- **A4** `innfo-mcp`: a new read-only `resolve_sources({model, elementId, fieldName?})` tool. It returns `{path, anchor, exists, excerpt?, sha256?, version?, error?}` for each citation and is built only from existing exports.

### Out of Scope
- Any edit to `iNNfo/specs/templates/**/spec_NN.md` or `iNNfo/specs/iNNfo_V_0-2-1_NN.md`, and any language/version bump.
- Renaming vocabulary (`derived_from_inputs`, `cited_works`, …). That is Tanda B.
- Moving the model-viewer compile procedure. That is Tanda C.
- Pan/zoom libraries, and a new staleness subsystem.

## Capabilities

### New Capabilities
- `lineage-graph-legibility`: the editor's lineage graph renders at its natural size, scrolls, lays out top-down and can collapse its 4th level.
- `artifact-staleness-diagnostic`: `lineage-check` tells a stale artifact (version drift) apart from a missing model.
- `citation-source-resolution`: the MCP `resolve_sources` tool resolves an element's citations to their file, excerpt and frontmatter.

### Modified Capabilities
- `typed-source-references`: the "Source fields are typed onto the graph" requirement now also covers fields whose schema type is `citation`, not only fields named `sources`.

## Approach

Reuse only, no new parsing logic:
- **A3** reuses the schema-type resolution behind `isCitationField` (`validator/workspaceSources.ts:79-89`).
- **A4** composes `readModel`/`parseModel`, `splitSourceFieldValue`, `parseSourceRef`, `createWorkspaceSourceResolver`, `resolveHeadingSection` and the shared frontmatter parser. It registers the same way `query_units` does.
- Tests are written first (strict TDD). A3 must re-run `tests/roundtrip-fidelity.test.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `iNNfo/apps/innfo-editor/src/shared/widgets/MermaidWidget.vue` | Modified | Mermaid config |
| `iNNfo/apps/innfo-editor/src/components/editor/FilePreviewModal.vue` | Modified | `graph TD` and the collapse toggle |
| `skills/nn-trannsform/scripts/lib/lineage-check.js` | Modified | Split stale vs. missing |
| `iNNfo/packages/innfo-core/src/recursiveParser/normalize.ts` | Modified | Schema-typed citations |
| `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.ts` (+ registry, spec test) | New | MCP tool |

## Delivery

- `delivery_strategy: auto-chain`, `chain_strategy: stacked-to-main`.
- **How this maps to this repo:** there is one integration branch, `dev`, merged to `main` in batches, with no feature branches or PRs. "Stacked" therefore means **ordered work-unit commits on `dev`**. Each commit covers one item, with its own tests and verification, and can be reverted on its own. sdd-tasks/apply MUST NOT create branches.
- A3 goes before A4, so that A4's default field selection can reuse it.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A3 changes the graph or round-trip output | Low | Round-trip guard plus a new unit test |
| The new A2 warning adds noise to existing workspaces | Med | Warning, not error |
| The A4 tool count or docs drift | Low | Update the tool count where `query_units` registered |
| Wide graphs push the modal into horizontal scroll | Low | Collapse enabled by default |

## Rollback Plan

Revert the item's own commit on `dev`. Every item is purely additive or locally scoped, and none of them changes persisted data.

## Dependencies

- None external. A4 depends softly on A3 and falls back to `SOURCE_FIELD_NAMES`.

## Success Criteria

- [ ] A wide lineage graph is legible and scrolls. The 4th level is collapsed by default.
- [ ] A version-drifted artifact gets the stale warning. An unknown model keeps the error.
- [ ] `precio_source:: type:: citation` appears in `node.sources` and in the relationships. Round-trip stays byte-identical.
- [ ] `resolve_sources` spec covers a resolvable citation, a dangling file, an unknown anchor and a schema-typed field.

## Proposal question round (for user review)

1. A2: should staleness stay a warning, or fail `--check` (error) once a workspace opts in?
2. A1: when the 4th level is collapsed, should the graph show a "+N hidden" count?
3. A4: should the returned excerpt be capped or truncated in length?
