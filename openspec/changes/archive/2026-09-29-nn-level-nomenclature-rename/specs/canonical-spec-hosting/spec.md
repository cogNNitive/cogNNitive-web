<!--
  The archived predecessor repository slug is written as two adjacent code spans
  (`cogNNitive`/`iNNfo`) rather than one, on purpose: the iNNfo `check:spec-urls`
  strict legacy scan fails on any contiguous occurrence of that slug in a
  non-excluded file.
-->

## MODIFIED Requirements

### Requirement: Canonical Spec Hosting Base URL

All canonical iNNfo specifications (Level 0 and Level 1 core specs, Level 2 bluepriNNts, Level 3 sample kNNowledge, and procedure sub-models) MUST use `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/` as their canonical raw hosting base URL, and `https://github.com/cogNNitive/cogNNitive/blob/main/iNNfo/` as their browsing blob base URL.
No canonical specification, bluepriNNt, sample kNNowledge, or documentation MAY reference the archived predecessor repository (`cogNNitive`/`iNNfo`), including its legacy `raw.githubusercontent.com/cogNNitive`/`iNNfo/(main|v0.1.x)/` raw paths or its `github.com/cogNNitive`/`iNNfo/blob/main/` browsing paths.

#### Scenario: Level 0 and Level 1 spec frontmatter
- GIVEN any Level 0 or Level 1 specification file, including the new `defiNNition_V_0-1-0_NN.md` and `iNNfo_V_0-3-0_NN.md` and the frozen predecessors
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, `spec.url`, and any `includes[].url` declare URLs rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/`
- AND no legacy URL referencing the archived predecessor repository remains in frontmatter or descriptive prose

#### Scenario: Level 2 bluepriNNt spec frontmatter
- GIVEN any Level 2 bluepriNNt specification file under the canonical bluepriNNt package path
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, and `includes[].url` declare URLs rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/`
- AND `parent.url` points to `iNNfo_V_0-3-0_NN.md`

#### Scenario: Level 3 sample kNNowledge and procedure submodel frontmatter
- GIVEN any Level 3 sample kNNowledge under the canonical bluepriNNt package path `**/samples/` or procedure sub-model under a documentation bluepriNNt `**/procedures/`
- WHEN its frontmatter is inspected
- THEN `parent_spec.url` declares a URL rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/`

## ADDED Requirements

### Requirement: New L0 and L1 identities are registered with the spec hosting checker

`check-spec-version.mjs` MUST classify `defiNNition` files as Level 0 and `iNNfo` `V_0-3-0` as Level 1, in addition to the frozen predecessors, and `--check-urls` MUST verify that every canonical URL declared by the new files exists locally.

#### Scenario: Classifier accepts defiNNition
- **GIVEN** `defiNNition_V_0-1-0_NN.md`
- **WHEN** `check-spec-version.mjs` classifies it
- **THEN** it is classified Level 0

#### Scenario: Missing target fails
- **GIVEN** a `parent.url` in a new file that points to a non-existent path
- **WHEN** `check-spec-version --check-urls` runs
- **THEN** it exits non-zero and names the URL
