## MODIFIED Requirements

### Requirement: Standardized Git Release Tag Naming Convention

bluepriNNt package releases and specification releases MUST use standardized Git tags to identify immutable release snapshots:
- bluepriNNt package releases made after this change MUST use the tag `blueprints-v<batch>`, where `<batch>` is a SemVer 2.0.0 batch number that continues the existing `templates-v*` sequence (the first release is `blueprints-v0.18.0`), so that no same-numbered pair exists across the two namespaces. The resolver accepts only `^blueprints-v\d+\.\d+\.\d+$`. Existing `templates-v*` tags are permanent history and MUST NOT be deleted, moved or retagged. A restart at `0.1.0` MUST NOT be used.
- Core framework (iNNfo Suite) releases MUST use the tag pattern `v<version>` (e.g. `v0.2.0`, `v1.0.0`). The new Level 1 (`iNNfo` `V_0-3-0`) and Level 0 (`defiNNition`, formerly `defiNNe`) files MUST NOT receive tags of their own: their write-once filename is the identity, and the first containing Suite tag is the release record. This amends the former rule that `v<x>` tags are shared between Suite releases and L0/L1 specs.
- Release tags MUST NOT omit the prefix or use ambiguous floating aliases (e.g. `latest`, `dev`).

#### Scenario: Creating a valid bluepriNNt package release tag
- GIVEN a bluepriNNt package batch `0.18.0` ready for release, following `templates-v0.17.0`
- WHEN a Git release tag is published for the bluepriNNts
- THEN the tag name MUST be `blueprints-v0.18.0`
- AND it points to an immutable commit snapshot containing the canonical bluepriNNt assets

#### Scenario: Old tags remain
- GIVEN the tag `templates-v0.3.0` published before this change
- WHEN the repository tags are listed after this change
- THEN it is still present and points to the same commit

#### Scenario: Creating a valid core meta-spec release tag
- GIVEN a core framework / meta-spec release for version `0.2.0`
- WHEN a Git release tag is published
- THEN the tag name MUST be `v0.2.0`
- AND it points to an immutable commit snapshot of the framework specifications

#### Scenario: Rejecting invalid or floating release tags
- GIVEN a release attempt using tag `latest` or the prefix `blueprints-v` without a semver string
- WHEN release validation checks the tag format
- THEN the tag is rejected as non-conforming

### Requirement: End-to-End Upstream Traceability across the Spec Hierarchy

Every Level 3 (L3) kNNowledge instance, Level 2 (L2) bluepriNNt specification, and Level 1 (L1) meta-spec MUST maintain verifiable upstream provenance references:
- L3 instances MUST reference their parent L2 bluepriNNt (via `parent_spec` plus, for the stable channel, a tag-pinned URL).
- L2 bluepriNNt packages MUST declare their upstream L1 framework dependency, pinned to an immutable `v<version>` Suite tag for stable releases (for iNNfo `V_0-3-0`, the first Suite tag that contains the file, release R).
- L1 meta-specifications MUST reference the foundational L0 ontology (`defiNNition` from iNNfo `V_0-3-0` onward; `defiNNe` for the frozen predecessors). For the new L0 and L1 files the `parent:` URL points at `main`, and the first containing Suite tag is the release record (no per-file tag exists).

The resolution and validation engine MUST be able to traverse this upstream chain (L3 → L2 → L1 → L0) to verify schema conformance and provenance integrity. The engine MUST treat a chain that ends at `defiNNe` as legacy.

#### Scenario: Full upstream provenance chain validation
- GIVEN an L3 kNNowledge referencing L2 bluepriNNt `business` at a release tag
- AND the L2 bluepriNNt declares conformance to L1 `iNNfo` `V_0-3-0` at the release-R Suite tag `v<version>`
- AND L1 `iNNfo` `V_0-3-0` declares derivation from L0 `defiNNition` through its `parent:` URL
- WHEN provenance validation traverses the upstream reference chain
- THEN every stable-channel L2 to L1 reference resolves to an immutable tag
- AND the L1 to L0 reference resolves to an existing file
- AND the lineage from L3 to L0 is validated as coherent and reproducible

#### Scenario: Detecting an unpinned upstream link in a stable lineage
- GIVEN an L2 bluepriNNt referencing an L1 meta-spec via a mutable branch URL (`.../main/...`) in a stable release
- WHEN upstream traceability verification runs
- THEN a validation warning or error identifies the unpinned upstream link

#### Scenario: Chain ending at defiNNe is legacy
- GIVEN an L1 meta-spec `iNNfo` `V_0-2-2` whose parent is `defiNNe`
- WHEN a kNNowledge governed by it is loaded by new tooling
- THEN the chain is classified legacy
