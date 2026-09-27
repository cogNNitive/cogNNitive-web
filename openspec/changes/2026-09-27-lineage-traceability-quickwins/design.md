# Design: Lineage Traceability Quick Wins (Tanda A)

## Technical Approach

The four items are independent and each is local to one package. None of them changes the language spec or persisted data. Everything reuses existing exports. The one new shared seam is a declared-field-type helper in innfo-core, which A3 extracts and A4 consumes.

**Commit order on `dev`:** A1, A2, A3, A4. There are no branches. Each item is one work-unit commit that carries its own tests and can be reverted on its own. A3 must land before A4.

## Architecture Decisions

| # | Option chosen | Rejected | Rationale |
|---|---|---|---|
| D1 (A1) | Scope `useMaxWidth:false` to the lineage graph with a Mermaid init directive as the first line of `lineageMermaidCode` | Changing the global `mermaid.initialize` in `MermaidWidget.vue:38` | The `mermaid` object is a global singleton that every mermaid field in every model shares. A global flag would resize user diagrams too. `MermaidWidget.vue` stays **unchanged**, which departs from the proposal's list of affected areas. |
| D2 (A1) | Change the wrapper at `FilePreviewModal.vue:312` from `flex justify-center overflow-x-auto` to `overflow-auto` + inner `w-max mx-auto` | Keeping `justify-center` | A flex container centred with `justify-center` cuts its overflow off on the left, and the user cannot scroll to it. A natural-size graph would hit that. |
| D3 (A3) | Add a post-pass after the schema is stashed (`workspace.ts:556-559`) | Reading the schema inside `normalizeElementsIntoGraph` | `normalizeElementsIntoGraph` runs inside `parseAndRegisterModel` at line 543, **before** `childNode.templateSchema` is set. `extractTemplateSchema(parsed)` only sees the local metamodel, never the parent template of a level-3 model. |
| D4 (A3) | Extract `findDeclaredField(schema, conceptType, fieldName)` into `src/schema/declaredField.ts`. `isCitationField` calls it too. | Importing `isCitationField` | That function is private. Importing from `validator/` into `recursiveParser/` would also invert the layering. |
| D5 (A3) | The graph selects a field by **union**: its name is in `SOURCE_FIELD_NAMES` OR its declared type is `citation` | The validator's "declared type wins" rule | The proposal says the name-based path must not change. The consequence is that `documentation`'s `source::`, which is declared as a non-citation, still reaches the graph as it does today. |
| D6 (A4) | Read one file with `readModel`. The schema for the omitted-`fieldName` case comes from `resolveTemplateWithCache` + `buildTemplateSchemaResolverFromCache` | A full `recursiveParse` | A single-model read keeps the tool cheap. When there is no schema, it falls back to `SOURCE_FIELD_NAMES`. |
| D7 (A4) | Frontmatter is parsed with innfo-core's `parseFrontmatter` | `provenance-model.js` | That file is CommonJS under `skills/` and innfo-mcp cannot import it. Both read the same `sha256` key. |

## Item Designs

**A1** `FilePreviewModal.vue` (`lineageMermaidCode`, lines 479-555):
- Line 493 changes to `['%%{init: {"flowchart": {"useMaxWidth": false}}}%%', 'graph TD']`.
- Add `const showOutgoing = ref(false)`, with a toggle button in the lineage view.
- When collapsed, compute `hidden = outRels.length` for each citing node. If `hidden > 0`, emit `R_${idx}_more["+${hidden} hidden"]:::emptyNode` and the edge `${nodeId} -.-> R_${idx}_more`.
- When expanded, keep the existing `slice(0, 3)`. If `outRels.length > 3`, append a `+${outRels.length-3} hidden` node.

**A2** `lineage-check.js`, loop at lines 43-52. For each `ref`:
1. If `models.some(m => ref === m.name || (m.model_version && ref === \`${m.name} ${m.model_version}\`))`, the ref is ok and nothing is reported.
2. Otherwise, set `known = models.filter(m => ref.startsWith(m.name + ' '))`. If it is non-empty, push to **`warnings`**: `Artifact "X" derives from "ref", but models/ has "<name>" at <versions|no model_version> — artifact may be stale.`
3. Otherwise, keep the existing error text unchanged.

Also update the JSDoc header (lines 9-13). The CLI (`scripts/index.js:84-90`) already exits 0 when there are only warnings, so this never escalates to an error.

**A3** `normalize.ts`:
- `attachSourceCitations(node)` stays byte-identical.
- New export `attachSchemaTypedCitations(node, schema)`. It walks fields where `!SOURCE_FIELD_NAMES.has(name)` and `findDeclaredField(...)?.type === 'citation'`, which rules out double-counting with the name-based path. It **appends** to `node.sources` and pushes `{targetId: ref.filePath, label: fieldName, origin: 'source'}`.
- `workspace.ts`, after line 558: for every `ctx.nodes` entry with `kind === 'element' && source.path === resolvedPath`, call `attachSchemaTypedCitations(node, schema)`.

**A4** New file `innfo-mcp/src/tools/resolve-sources.ts`:
1. `findModelFile` → `readModel`. Find the element by name across `model.elements`.
2. Pick fields: `[fieldName]` when it is given. Otherwise, fields where `SOURCE_FIELD_NAMES` matches OR `findDeclaredField(schema, concept, f)?.type === 'citation'`.
3. For each value from `splitSourceFieldValue`, parse with `parseKnowledgeUnitRef ?? parseSourceRef`, then call `createWorkspaceSourceResolver(root)(ref.filePath, modelPath)`.
4. Excerpt: if `ref.unit` is set, use `resolveUnit(content, ref)`. Otherwise, if `ref.slug` is set, use `resolveHeadingSection`. Slice the lines and cap at `EXCERPT_CHAR_CAP = 500`.
5. Register a `resolve_sources` entry in `TOOL_REGISTRY` (`server.ts:88`) and add `handleResolveSources`, which wraps the result with `envelope('innfo-resolve-sources', …)`. `TOOL_COUNT` updates itself.

## Interfaces

```ts
// innfo-core/src/schema/declaredField.ts (exported via schema/index.ts and src/index.ts)
export function findDeclaredField(schema: TemplateSchema | undefined, conceptType: string | undefined, fieldName: string): { name: string; type: string } | undefined

// innfo-mcp/src/tools/resolve-sources.ts
export const EXCERPT_CHAR_CAP = 500
export interface ResolvedCitation {
  path: string; anchor?: string; exists: boolean
  excerpt?: string; truncated?: boolean; sha256?: string; version?: string // fm.version ?? fm.model_version
  error?: 'MALFORMED' | 'DANGLING_FILE' | 'UNKNOWN_ANCHOR' | 'ELEMENT_NOT_FOUND' | 'MODEL_NOT_FOUND'
}
export async function resolveSources(rootDir: string, input: { model: string; elementId: string; fieldName?: string }): Promise<ResolvedCitation[]>
```

**Dependency:** when `fieldName` is given, A4 works standalone and needs nothing from A3. When it is omitted, finding schema-typed fields needs A3's `findDeclaredField`. innfo-mcp consumes innfo-core's `dist`, so **rebuild innfo-core before running the A4 tests**.

## File Changes

| File | Action |
|---|---|
| `iNNfo/apps/innfo-editor/src/components/editor/FilePreviewModal.vue` | Modify (A1) |
| `iNNfo/apps/innfo-editor/tests/component/FilePreviewModal.test.ts` | Modify (A1) |
| `skills/nn-trannsform/scripts/lib/lineage-check.js` | Modify (A2) |
| `skills/nn-trannsform/test/unit/test-lineage-sync.js` | Modify (A2) |
| `iNNfo/packages/innfo-core/src/schema/declaredField.ts` (+ `schema/index.ts`, `src/index.ts`) | Create/Modify (A3) |
| `iNNfo/packages/innfo-core/src/validator/workspaceSources.ts` | Modify: `isCitationField` delegates to the helper, with unchanged behaviour (A3) |
| `iNNfo/packages/innfo-core/src/recursiveParser/normalize.ts`, `workspace.ts` | Modify (A3) |
| `iNNfo/packages/innfo-mcp/src/tools/resolve-sources.ts` + `.spec.ts`, `src/server.ts` | Create/Modify (A4) |

## Testing Strategy (strict TDD, red first)

| Item | Test |
|---|---|
| A1 | The code starts with the init directive and contains `graph TD`. When collapsed, it has a `+N hidden` node and no `R_x_y` nodes. The toggle shows the rel nodes. |
| A2 | A drifted version gives 1 warning and 0 errors. An unknown name keeps the existing error. An exact match reports nothing. |
| A3 | `recursiveParse` with a resolver that declares `precio_source` as `citation` fills `node.sources` and adds an `origin:'source'` relationship. A `sources`-named field produces no duplicate. With no schema, nothing changes. The existing `workspaceSources` tests stay green. |
| A3 guard | Re-run `tests/roundtrip-fidelity.test.ts`. It only exercises `parseModel`→`serializeModel` and never touches `recursiveParse`/`attachSourceCitations`, so A3 cannot reach it. It is re-run as a regression gate, not as evidence. |
| A4 | `resolve-sources.spec.ts`, with the same temp-dir fixture shape as `query-units.spec.ts`: a resolvable `@## Section` (excerpt ≤500, sha256), a dangling file, an unknown anchor, a schema-typed non-`sources` field (explicit `fieldName`, plus omitted `fieldName` with a local `parent_spec` template as in `spec.spec.ts:154`, and no fetch), and a check that no files are written. `server.spec.ts` covers the tool count and that the tool is listed. |

## Migration / Rollout

No migration is required. To roll back, revert that item's commit. The one ordering constraint is that reverting A3 requires reverting A4 first, or keeping `findDeclaredField`.

## Open Questions

None blocking.
