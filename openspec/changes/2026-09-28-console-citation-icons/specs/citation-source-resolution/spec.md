# Delta for citation-source-resolution

## MODIFIED Requirements

### Requirement: `resolve_sources` resolves an element's citations

`innfo-mcp` MUST expose a read-only tool `resolve_sources` accepting `{model, elementId, fieldName?}`. When `fieldName` is omitted, it MUST resolve citations across all citation-typed fields on the element. The tool MUST return an array of results, one per citation reference found, each shaped as `{path, anchor, exists, field, origin, author?, excerpt?, sha256?, version?, error?}`.
(Previously: result shape was `{path, anchor, exists, excerpt?, sha256?, version?, error?}` with no `field`, `origin`, or `author`.)

#### Scenario: Resolving a valid citation

- GIVEN a model element with a citation-typed field pointing at `sources/nn/interview.md#clients`
- WHEN `resolve_sources` is called with that model and element id
- THEN the result array includes an entry with `path: "sources/nn/interview.md"`, `anchor: "clients"`, and `exists: true`

#### Scenario: Filtering by fieldName

- GIVEN a model element with two citation-typed fields, `sources` and `precio_source`
- WHEN `resolve_sources` is called with `fieldName: "precio_source"`
- THEN the result array only contains entries resolved from `precio_source`
- AND every entry's `field` is `"precio_source"`

#### Scenario: Unknown anchor within an existing file

- GIVEN a citation pointing at `sources/nn/report.md#nonexistent-heading`
- AND `sources/nn/report.md` exists but has no heading slugging to `nonexistent-heading`
- WHEN `resolve_sources` is called
- THEN the entry has `exists: true` for the file, and `error` describing the unresolved anchor

### Requirement: Dangling file is reported without throwing

When a citation references a file that does not exist on disk, `resolve_sources` MUST NOT throw. It MUST return an entry with `exists: false` and a descriptive `error`, omitting `excerpt`, `sha256`, and `version`. It MUST still populate `field`; `origin` MUST be `"document"` when no classification signal can be evaluated because the target file is unreachable.
(Previously: entry omitted `excerpt`, `sha256`, `version` on a dangling file, with no statement about `field`/`origin` since those did not exist.)

#### Scenario: Citation to a deleted source file

- GIVEN a citation-typed field value `sources/nn/deleted.md#intro`
- AND `sources/nn/deleted.md` does not exist
- WHEN `resolve_sources` is called
- THEN the entry has `exists: false`, `error` set, `origin: "document"`, and no `excerpt`, `sha256`, or `version`

### Requirement: Excerpt is capped at ~500 characters

When a citation resolves to an existing file and anchor, `resolve_sources` MUST include an `excerpt` of the referenced section's content, truncated to a maximum of approximately 500 characters.
(Previously: unchanged — carried forward verbatim.)

#### Scenario: Long section is truncated

- GIVEN a resolvable citation whose anchored section contains 2000 characters of content
- WHEN `resolve_sources` is called
- THEN the returned `excerpt` is capped at approximately 500 characters

#### Scenario: Short section is returned in full

- GIVEN a resolvable citation whose anchored section contains 120 characters of content
- WHEN `resolve_sources` is called
- THEN the returned `excerpt` contains the full 120 characters, uncapped

## ADDED Requirements

### Requirement: Citation origin classification

`resolve_sources` MUST classify each result's `origin` as `"agent"`, `"human"`, `"reviewer"`, or `"document"`, resolved per citation from the heading the `@` anchor targets. The file-level `is_synthetic` flag MUST NOT be used for this classification.

- `origin: "agent"` MUST be set when the anchor is a `## NN Agent Modification: …` heading AND that block's `author::` value matches a known-tool-id list maintained in the resolver (e.g. `ClaudeCode`, `OpenCode`, `Antigravity`). `author` MUST be set from `author::`; when `author::` is `_`, `author` MUST be `"unknown"`.
- `origin: "human"` MUST be set when the anchor is a `## NN Agent Modification: …` heading AND `author::` holds a value NOT on the known-tool-id list. `author` MUST be set to that literal value.
- `origin: "reviewer"` MUST be set when the target frontmatter has `source_type: feedback`. When that frontmatter has no author field, `author` MUST be omitted from the result rather than defaulted to a placeholder string.
- `origin: "document"` MUST be the default when none of the above signals apply, including a plain heading with no Agent Modification block. No `"user"` category MUST be inferred from the absence of a signal.

#### Scenario: Known agent tool id

- GIVEN a citation anchored at a `## NN Agent Modification: …` heading with `author:: ClaudeCode`
- WHEN `resolve_sources` is called
- THEN the entry has `origin: "agent"` and `author: "ClaudeCode"`

#### Scenario: Unrecognized name inside an Agent Modification block

- GIVEN a citation anchored at a `## NN Agent Modification: …` heading with `author:: Maria Lopez`
- WHEN `resolve_sources` is called
- THEN the entry has `origin: "human"` and `author: "Maria Lopez"`, not `"agent"`

#### Scenario: Reviewer feedback citation

- GIVEN a citation anchored in a file whose frontmatter has `source_type: feedback`
- WHEN `resolve_sources` is called
- THEN the entry has `origin: "reviewer"`

#### Scenario: Plain document heading

- GIVEN a citation anchored at a plain heading with no Agent Modification block and no `source_type: feedback` frontmatter
- WHEN `resolve_sources` is called
- THEN the entry has `origin: "document"`
