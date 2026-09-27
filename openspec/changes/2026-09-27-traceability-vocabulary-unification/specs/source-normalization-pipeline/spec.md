# Spec: Source Normalization Pipeline — Synthetic Source Narrowing

## REMOVED Requirements

### Requirement: Synthetic Deliverable Ingestion

**Reason**: This requirement describes ingesting deliverables promoted from
`export/` into `sources/export/` as synthetic sources. That promotion
pipeline was never built; the only synthetic-source path that actually
exists and works is Feedback JSON Ingestion (`sources/import/feedback/*.json`,
already specified below). Carrying an unimplemented requirement in the spec
lets authors and reviewers believe `sources/export/` promotion is a supported
feature when it is not. "Synthetic source" is narrowed to mean, specifically,
ingested feedback JSON.

**Migration**: none. No workspace has ever emitted a promoted-deliverable
`is_synthetic: true` entry via this path (it was unimplemented), so there is
no existing data to migrate. Files that happen to live under
`sources/export/` continue to be scanned as ordinary (non-synthetic) input
by the existing Multi-Subtree Normalization Scanning requirement; only the
synthetic-ingestion behavior tied to that subtree is removed.

## ADDED Requirements

### Requirement: Synthetic Source Means Ingested Feedback JSON

The only recognized synthetic-source path is Feedback JSON Ingestion
(`sources/import/feedback/*.json`, normalized with `source_type: feedback`
and `is_synthetic: true`, per the Feedback JSON Ingestion requirement). No
other pipeline stage MAY mark a normalized source `is_synthetic: true`.
There is no `--promote` command or other mechanism for promoting a
deliverable in `export/` into a synthetic source, and none is planned as
part of this taxonomy.

#### Scenario: Only feedback JSON produces a synthetic source

- GIVEN the full set of normalized sources produced by a scan of a workspace
  containing files under `sources/import/`, `sources/export/`, and
  `sources/conversations/`
- WHEN the normalized outputs are inspected for `is_synthetic: true`
- THEN only the entries originating from `sources/import/feedback/*.json`
  carry `is_synthetic: true`
- AND no entry originating from `sources/export/` carries `is_synthetic: true`

### Requirement: `user_input` Is Not a Valid `source_type`

`source_type: user_input` MUST NOT appear anywhere in the source-type
taxonomy, in emitted frontmatter, or in code that classifies normalized
sources. What was previously described as user-input content is represented
via the conversation lifecycle (`source_type: conversation_transcript` and
related conversation types), which already captures what a user said.

#### Scenario: No normalized source is ever typed as user_input

- GIVEN any normalized source produced by the pipeline, regardless of origin
  subtree
- WHEN its frontmatter `source_type` is inspected
- THEN its value is never `user_input`

#### Scenario: User-authored content is represented as a conversation

- GIVEN content that originates from something a user said or wrote directly
  (as opposed to an ingested document)
- WHEN it is captured and normalized
- THEN it is represented under the conversation lifecycle with a
  conversation `source_type`, not a `user_input` `source_type`
