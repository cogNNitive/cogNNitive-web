# Spec: Reserved `conflicts::` Property

## ADDED Requirements

### Requirement: `conflicts::` Is a Reserved Element Property Validated Like `sources::`

Any model element MAY carry an optional `conflicts::` property, using the
identical array-of-pointers syntax as `sources::` (the uniform
`<workspace-relative-path>.md#<heading-slug>` block identifier). A
`conflicts::` value MUST be validated by the same citation validator used for
`sources::` (`isCitationField` / `parseSourceRef`): a pointer that does not
resolve, or that uses a prohibited form such as a line-range anchor, MUST
produce the same explicit, non-silent diagnostic that an equivalent malformed
`sources::` value would produce. A valid `conflicts::` value MUST surface as
a warning-level diagnostic when present — never an error, and never silently
dropped. `conflicts::` carries no resolution, precedence, or authority-ranking
logic; that stays ad hoc via `rationale::` prose, out of scope for this
requirement.

#### Scenario: Valid conflicts pointer produces a warning

- GIVEN an element with `conflicts:: [sources/nn/report.md#finding-3]`
  pointing at a resolvable block
- WHEN validation runs
- THEN no malformed-citation diagnostic is produced
- AND a warning-level diagnostic is surfaced noting the element has a
  recorded conflict

#### Scenario: Malformed conflicts pointer fails exactly like a malformed sources pointer

- GIVEN an element with a `conflicts::` value referencing a nonexistent file
- WHEN validation runs
- THEN an explicit diagnostic identifying the malformed value is reported
- AND the diagnostic shape is the same one produced for an equivalent
  malformed `sources::` value

#### Scenario: Line-range anchor rejected in conflicts

- GIVEN an element with a `conflicts::` value using a line-range anchor form
- WHEN validation runs
- THEN the value is rejected with an explicit diagnostic, not silently
  accepted

#### Scenario: conflicts:: carries no precedence logic

- GIVEN two elements that each list the other in `conflicts::`
- WHEN validation and lineage synchronization run
- THEN both warnings are surfaced independently
- AND no automated resolution, precedence, or authority ranking is applied
  between the two elements

### Requirement: `type:: citation` Is Documented in the Core Language

`citation` MUST be listed as a Field Definition `type` in the core-language
version this change introduces — in the Field Definition property table and in
the metaschema `options::` enumeration — together with prose describing the
type's semantics. `type:: citation` is the declared-type form of a citation
field: its value is a pointer list to the Source documents the element derives
from, using the same bracketed
`[sources/nn/<filename>#<heading-slug>, ...]` grammar as the reserved
`sources::` property, and its values are subject to the same `KU_*` integrity
checks.

This requirement closes a documentation gap rather than introducing a
behavior: the parser has accepted `citation` as a field type since
`2026-09-13-document-fidelity-and-provenance-integrity` (AD-5), but no
published core-language version listed it. The gap became load-bearing here
because the `artifacts` template now declares `type:: citation` (see the
`Single Written Derivation Term Is sources` requirement), so the core-language
version this change ships would otherwise invoke a type it does not document.

#### Scenario: Core language lists the citation type

- GIVEN the core-language version introduced by this change
- WHEN its Field Definition `type` table and metaschema `options::` list are
  inspected
- THEN both include `citation`
- AND a prose paragraph describes the pointer grammar and validation of
  `type:: citation`
