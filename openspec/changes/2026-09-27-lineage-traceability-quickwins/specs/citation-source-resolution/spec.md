# Citation Source Resolution Specification

## Purpose

Give `innfo-mcp` clients a read-only tool that resolves an element's citations to their underlying file, anchor, and content, so "where did this value come from?" can be answered without manually tracing `sources::` values by hand.

## Requirements

### Requirement: `resolve_sources` resolves an element's citations

`innfo-mcp` MUST expose a read-only tool `resolve_sources` accepting `{model, elementId, fieldName?}`. When `fieldName` is omitted, it MUST resolve citations across all citation-typed fields on the element. The tool MUST return an array of results, one per citation reference found, each shaped as `{path, anchor, exists, excerpt?, sha256?, version?, error?}`.

#### Scenario: Resolving a valid citation

- GIVEN a model element with a citation-typed field pointing at `sources/nn/interview.md#clients`
- WHEN `resolve_sources` is called with that model and element id
- THEN the result array includes an entry with `path: "sources/nn/interview.md"`, `anchor: "clients"`, and `exists: true`

#### Scenario: Filtering by fieldName

- GIVEN a model element with two citation-typed fields, `sources` and `precio_source`
- WHEN `resolve_sources` is called with `fieldName: "precio_source"`
- THEN the result array only contains entries resolved from `precio_source`

#### Scenario: Unknown anchor within an existing file

- GIVEN a citation pointing at `sources/nn/report.md#nonexistent-heading`
- AND `sources/nn/report.md` exists but has no heading slugging to `nonexistent-heading`
- WHEN `resolve_sources` is called
- THEN the entry has `exists: true` for the file, and `error` describing the unresolved anchor

### Requirement: Dangling file is reported without throwing

When a citation references a file that does not exist on disk, `resolve_sources` MUST NOT throw. It MUST return an entry with `exists: false` and a descriptive `error`, omitting `excerpt`, `sha256`, and `version`.

#### Scenario: Citation to a deleted source file

- GIVEN a citation-typed field value `sources/nn/deleted.md#intro`
- AND `sources/nn/deleted.md` does not exist
- WHEN `resolve_sources` is called
- THEN the entry has `exists: false`, `error` set, and no `excerpt`, `sha256`, or `version`

### Requirement: Excerpt is capped at ~500 characters

When a citation resolves to an existing file and anchor, `resolve_sources` MUST include an `excerpt` of the referenced section's content, truncated to a maximum of approximately 500 characters.

#### Scenario: Long section is truncated

- GIVEN a resolvable citation whose anchored section contains 2000 characters of content
- WHEN `resolve_sources` is called
- THEN the returned `excerpt` is capped at approximately 500 characters

#### Scenario: Short section is returned in full

- GIVEN a resolvable citation whose anchored section contains 120 characters of content
- WHEN `resolve_sources` is called
- THEN the returned `excerpt` contains the full 120 characters, uncapped
