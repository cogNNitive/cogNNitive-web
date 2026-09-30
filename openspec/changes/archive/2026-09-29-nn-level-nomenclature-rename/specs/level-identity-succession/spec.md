## ADDED Requirements

### Requirement: New level identities are write-once and start at V_0-1-0

The system SHALL publish three new identities: `defiNNition_V_0-1-0_NN.md` (Level 0), a new iNNfo language version `iNNfo_V_0-3-0_NN.md` (Level 1) whose parent is defiNNition, and the `domaiNN` bluepriNNt at `V_0-1-0` (Level 2). Renamed identities MUST start at `V_0-1-0`; the iNNfo language version continues the iNNfo sequence at `V_0-3-0`. Once published, each new `_V_` file MUST be treated as write-once.

#### Scenario: defiNNition exists as a new file
- **GIVEN** the repository after slice S3
- **WHEN** `iNNfo/specs/` is inspected
- **THEN** `defiNNition_V_0-1-0_NN.md` exists as a new file
- **AND** `defiNNe_V_0-1-0_NN.md` is byte-identical to its state before this change

#### Scenario: iNNfo V_0-3-0 descends from defiNNition
- **GIVEN** `iNNfo_V_0-3-0_NN.md`
- **WHEN** its frontmatter `parent:` is read
- **THEN** it points to `defiNNition_V_0-1-0_NN.md` and not to `defiNNe_V_0-1-0_NN.md`

#### Scenario: domaiNN bluepriNNt starts at V_0-1-0
- **GIVEN** the `domaiNN` bluepriNNt
- **WHEN** its `blueprint_version` key is read
- **THEN** the value is `V_0-1-0`
- **AND** its parent is iNNfo `V_0-3-0`

### Requirement: Predecessor identities are frozen permanent history

`defiNNe_V_0-1-0_NN.md`, `iNNfo_V_0-1-0` through `iNNfo_V_0-2-2`, and the `workspace_spec` bluepriNNt MUST remain on the default branch, unmodified and resolvable, as permanent history. Existing git tags, frozen CDN bundles, old write-once `_V_` files and archived openspec changes MUST NOT be edited or deleted by this change. They are not legacy debt.

#### Scenario: Frozen files are not edited
- **GIVEN** any predecessor `_V_` spec file
- **WHEN** the diff of this change is inspected
- **THEN** that file has no content change

#### Scenario: The frozen workspace spec is listed as frozen
- **GIVEN** the manifest after this change
- **WHEN** the frozen blueprint entries are read
- **THEN** the `workspace` bluepriNNt appears under the `frozen_blueprints:` key
- **AND** it is not offered for new domaiNN creation

### Requirement: New tooling resolves only the new identities

`innfo-core`, `innfo-mcp` and `innfo-editor` MUST resolve `defiNNition`, iNNfo `V_0-3-0` and the `domaiNN` bluepriNNt as the active identities. A document whose parent chain resolves to `defiNNe`, to an iNNfo version older than `V_0-3-0`, or to `workspace_spec` MUST be classified legacy and MUST NOT be parsed as current. The only code that MAY recognise the predecessor identities as inputs is the legacy quarantine module.

#### Scenario: Spec slug resolution accepts defiNNition
- **GIVEN** the spec resolver service
- **WHEN** it resolves the slug `defiNNition`
- **THEN** it returns the L0 spec

#### Scenario: Predecessor slug is reported as legacy
- **GIVEN** a document whose parent chain ends at `defiNNe`
- **WHEN** new tooling loads it
- **THEN** the result is a legacy classification with a migration hint
- **AND** no schema validation runs against the legacy chain

#### Scenario: Canonical registry carries the new identities
- **GIVEN** the embedded canonical fallback registry in `innfo-core`
- **WHEN** it is matched by name or URL for `iNNfo` `V_0-3-0`, `defiNNition` and `domaiNN`
- **THEN** each resolves to its embedded content

### Requirement: New identities are registered in the same commit

Every place that enumerates spec identities MUST be updated in the same commit that introduces the identity: the editor default iNNfo version constant, `canonical-registry.ts`, `check-spec-version.mjs`, `SHIPPED_TEMPLATE_VERSIONS` (renamed in the mechanical track as designed), the manifest entries and the regenerated `validation-baseline.json`. The texts embedded in `canonical-registry.ts` MUST be byte-equal to the on-disk `spec_NN.md` files they mirror, asserted by a test, so the embedded fallback cannot go stale after the path move.

#### Scenario: Embedded registry copy matches disk
- **GIVEN** a bluepriNNt text embedded in `canonical-registry.ts`
- **WHEN** it is compared with the corresponding on-disk `spec_NN.md`
- **THEN** the test passes only if the two are byte-identical

#### Scenario: Missing registration fails a gate
- **GIVEN** a new iNNfo version file added without an editor default-version update
- **WHEN** the test suite and `check-spec-version` run
- **THEN** at least one fails and names the unregistered identity

#### Scenario: Baseline regenerated with the additive slice
- **GIVEN** slice S3 adds `defiNNition_V_0-1-0_NN.md` and `iNNfo_V_0-3-0_NN.md`
- **WHEN** the slice is committed
- **THEN** `iNNfo/validation-baseline.json` is regenerated in that same slice

### Requirement: Level 1 primitives keep their names

The Level 1 primitives Concept Definition, Field Definition, Matrix Definition and Marker Definition, and their literal grammar headings (for example `# NN Concept Definition`), MUST NOT be renamed by this change. The L1 term "meta-template" becomes "meta-bluepriNNt" in prose only.

#### Scenario: Grammar tokens unchanged
- **GIVEN** `iNNfo_V_0-3-0_NN.md` and the parser
- **WHEN** a document uses `# NN Concept Definition`
- **THEN** it parses exactly as under `iNNfo_V_0-2-2`

#### Scenario: Names containing NN are never truncated
- **GIVEN** the spec-name parser and the filenames `defiNNition_V_0-1-0_NN.md` and `domaiNN_NN.md`
- **WHEN** they are tokenised
- **THEN** the stem is not truncated or mis-split at the embedded `NN`
- **AND** a test covers each name

### Requirement: New L0 and L1 files are not tagged individually

No `v0.1.0` or `v0.3.0` (or any other `v*`) tag MUST be cut for `defiNNition_V_0-1-0_NN.md` or `iNNfo_V_0-3-0_NN.md`, because the `v*` namespace belongs to iNNfo Suite releases. The write-once filename is the immutable identity of each file. The first Suite tag that contains the file (release R) is its release record, and `parent:` and `spec_url` URLs keep pointing at `main`, as they do today. No `innfo-spec-v*` namespace MUST be introduced. Before slice S3, `git tag -l "v0.*"` MUST be checked to confirm that no existing tag collides with the policy. Every `parent:` and `spec_url` URL declared by the new files MUST resolve to an existing file, and `check-spec-version --check-urls` MUST pass.

#### Scenario: No per-file tag
- **GIVEN** the repository after release R
- **WHEN** the tags are listed
- **THEN** no tag was created solely for `defiNNition_V_0-1-0_NN.md` or `iNNfo_V_0-3-0_NN.md`
- **AND** both files are contained in the release-R `v*` Suite tag

#### Scenario: URLs resolve
- **GIVEN** the new L0 and L1 files
- **WHEN** `check-spec-version --check-urls` runs
- **THEN** it exits 0
