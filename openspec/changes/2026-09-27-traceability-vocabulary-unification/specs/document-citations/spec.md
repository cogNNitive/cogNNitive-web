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
