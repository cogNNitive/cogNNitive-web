# Typed Source References

## Purpose

Give cited sources first-class typed representation on the parsed model graph: one shared `parseSourceRef` / `slugifyHeading` implementation in `innfo-core` consumed by `innfo-editor` and `innfo-mcp`, a `SourceRef[]` array and `origin: "source"` relationships materialised on every `ModelNode` that declares a `sources` field, and a workspace-scoped validator (`validateWorkspaceSources`) that surfaces dangling files, missing heading slugs, and malformed references as diagnostics.

## Requirements

### Requirement: Single shared source-reference parser

`@cognnitive/innfo-core` MUST expose `parseSourceRef(value: string): SourceRef | null`
and `slugifyHeading(text: string): string`. `innfo-editor` and `innfo-mcp` MUST
consume these rather than defining their own. `innfo-editor/src/utils/sourceRef.ts`
MUST become a re-export of the core module with no independent logic.

#### Scenario: Editor and core agree on a slug

- GIVEN the heading text `Visión Estratégica`
- WHEN `slugifyHeading` is called in `innfo-core` and (via re-export) in `innfo-editor`
- THEN both return the identical string `vision-estrategica`

#### Scenario: Bare path resolves under sources/nn/

- GIVEN the value `clientA/report.md#market-overview`
- WHEN `parseSourceRef` is called
- THEN it returns `{ filePath: "sources/nn/clientA/report.md", fileName: "report.md", slug: "market-overview", kind: "source" }`

#### Scenario: Line-range anchor is rejected

- GIVEN the value `report.md#L12-L45`
- WHEN `parseSourceRef` is called
- THEN it returns `null`

#### Scenario: src-NNN wrapper is rejected

- GIVEN the value `src-007 report.md#intro`
- WHEN `parseSourceRef` is called
- THEN it returns `null`

#### Scenario: sources/original is not citable

- GIVEN the value `sources/original/report.pdf`
- WHEN `parseSourceRef` is called
- THEN it returns `null`

### Requirement: Source fields are typed onto the graph

When `recursiveParse` normalises an element that declares a field named `sources`
(case-insensitive, scalar or list), the resulting `ModelNode` MUST carry a
`sources: SourceRef[]` array holding every value that parsed as a reference, and
MUST emit one `Relationship` per ref with `origin: "source"` and `label:
"sources"`. Values that do not parse MUST NOT populate `node.sources` silently —
they surface as diagnostics (see workspace validation).

In addition to the name-based path above, any field whose schema declares
`type:: citation` MUST also be resolved the same way: its parsed value MUST be
appended to `node.sources` and MUST emit an `origin: "source"` relationship,
regardless of the field's name. The name-based path (`SOURCE_FIELD_NAMES`)
MUST remain unchanged and continues to apply independently — the two paths are
additive, not mutually exclusive.
(Previously: only fields literally named `sources`/`source` were typed onto the graph; schema-typed `citation` fields under other names were invisible to `node.sources` and the relationship graph.)

#### Scenario: Element with two source pointers

- GIVEN a Level 3 element with `sources:: [interview.md#clients, notes.md#priorities]`
- WHEN the model is parsed
- THEN the element's `ModelNode.sources` has two entries with `filePath`
  `sources/nn/interview.md` and `sources/nn/notes.md`
- AND the node has two relationships with `origin: "source"`

#### Scenario: Graph consumers skip source edges

- GIVEN a `ModelNode` with an `origin: "source"` relationship whose `targetId` is a path
- WHEN a consumer resolves relationship targets by node id
- THEN `origin: "source"` edges are skipped and cause no "dangling node" error

#### Scenario: Schema-typed citation field is typed onto the graph

- GIVEN a Level 3 element with a field `precio_source:: type:: citation` valued
  `sources/nn/pricing.md#q3-pricing`
- WHEN the model is parsed
- THEN the element's `ModelNode.sources` includes an entry with `filePath`
  `sources/nn/pricing.md`
- AND the node has a relationship with `origin: "source"` for that entry

#### Scenario: Round-trip stays byte-identical

- GIVEN a model containing both a `sources::` field and a schema-typed
  `type:: citation` field
- WHEN the model is parsed and re-serialized
- THEN `tests/roundtrip-fidelity.test.ts` confirms the output is byte-identical
  to the input

### Requirement: Workspace-scoped source validation

`innfo-core` MUST expose `validateWorkspaceSources(result, resolver)` returning
`ReferenceDiagnostic[]`. The `innfo-mcp` `validate` tool MUST call it with a
disk-backed resolver and include its diagnostics in the response.

#### Scenario: Dangling source file

- GIVEN a model element with `sources:: missing.md#intro`
- AND no file `sources/nn/missing.md` in the workspace
- WHEN `validateWorkspaceSources` runs
- THEN it emits an `error` diagnostic naming `sources/nn/missing.md`

#### Scenario: Missing heading slug

- GIVEN a model element with `sources:: report.md#nonexistent-heading`
- AND `sources/nn/report.md` exists but has no heading slugging to `nonexistent-heading`
- WHEN `validateWorkspaceSources` runs
- THEN it emits a `warning` diagnostic

#### Scenario: Malformed reference on a declared source field

- GIVEN a model element with `sources:: report.md#L10-L20`
- WHEN `validateWorkspaceSources` runs
- THEN it emits an `error` diagnostic explaining line ranges are not allowed

#### Scenario: MCP validate surfaces source diagnostics

- GIVEN a workspace passed to the `innfo-mcp` `validate` tool with a dangling `sources::`
- WHEN the tool runs
- THEN the returned diagnostics include the dangling-source `error`
