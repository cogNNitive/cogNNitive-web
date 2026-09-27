# Delta for Typed Source References

## MODIFIED Requirements

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
