## MODIFIED Requirements

### Requirement: Canonical Spec Hosting Base URL

All canonical iNNfo specifications MUST be hosted on the public distribution host rather
than on the repository that holds the source; this covers Level 1 core specs, Level 2
templates, Level 3 sample models, and procedure sub-models. The exact host is recorded by
open decision 2 of the `public-web-distribution` change (the public distribution
repository, or its same-origin Pages path). No canonical specification, template, sample
model, or documentation MAY reference a `raw.githubusercontent.com/cogNNitive/cogNNitive`
URL.

#### Scenario: Level 1 and defiNNe spec frontmatter
- GIVEN any Level 1 or defiNNe specification file
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, `spec.url`, and any `includes[].url` are rooted at the public distribution base URL

#### Scenario: Level 2 template spec frontmatter
- GIVEN any Level 2 template specification file
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, and `includes[].url` are rooted at the public distribution base URL

#### Scenario: Level 3 sample model and procedure submodel frontmatter
- GIVEN any Level 3 sample model or procedure sub-model
- WHEN its frontmatter is inspected
- THEN `parent_spec.url` is rooted at the public distribution base URL

### Requirement: Editor Runtime Spec Base Constant

The `innfo-editor` application MUST define a single shared constant `REMOTE_SPEC_BASE` in
`src/config/samples.ts` alongside `REMOTE_SAMPLE_BASE`, pointing to the public
distribution host. All editor components and views displaying or linking to canonical
specifications MUST consume `REMOTE_SPEC_BASE` rather than duplicating the URL string
literal.

#### Scenario: Editor displays canonical L1 spec link
- GIVEN the `ModelInfoPanel` or `StandaloneProcedureView` component in `innfo-editor`
- WHEN rendering links to the canonical specification
- THEN the link target is constructed using `REMOTE_SPEC_BASE`

### Requirement: Strict Repo-Wide Spec URL Checker

The CI URL validation script MUST verify that canonical URLs are rooted at the public
distribution host, MUST still verify local file existence for canonical URLs, and MUST
fail on any residual `raw.githubusercontent.com/cogNNitive/cogNNitive` reference in any
non-excluded file.

#### Scenario: Residual private raw reference fails
- GIVEN any non-excluded file containing a `raw.githubusercontent.com/cogNNitive/cogNNitive` URL
- WHEN `check-spec-urls` runs
- THEN it exits non-zero
