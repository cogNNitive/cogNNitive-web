## ADDED Requirements

### Requirement: The version-bump guard watches the new package path and key

`scripts/guard-template-immutability.js` (the version-bump guard that replaced the retired file-cloning guard) MUST watch `spec_NN.md` files under `iNNfo/specs/bluepriNNts/` and MUST require that any content change increments the `blueprint_version` key against the base ref. It MUST NOT watch `iNNfo/specs/templates/` once that path no longer exists.

#### Scenario: Content change without bump fails
- **GIVEN** a change to `iNNfo/specs/bluepriNNts/business/spec_NN.md` without a `blueprint_version` increment
- **WHEN** the guard runs
- **THEN** it exits 1 naming the file

#### Scenario: Content change with bump passes
- **GIVEN** the same change with the `blueprint_version` key incremented
- **WHEN** the guard runs
- **THEN** it exits 0

### Requirement: The one-time path move is exempt from the path check only

A rename from the old package path to the new package path MUST NOT be reported as an error for the path change, but the moved file MUST still carry the MINOR bump required by this change and MUST use the new key name.

#### Scenario: Move with bump passes
- **GIVEN** a file renamed from the old path to the new path with its MINOR bump
- **WHEN** the guard runs
- **THEN** no error is reported

#### Scenario: Move without bump fails
- **GIVEN** a file renamed to the new path with unchanged version
- **WHEN** the guard runs
- **THEN** it exits 1

### Requirement: Fixture-driven guard runs cover the new path

Guard tests run with a `--diff-file` fixture MUST include entries for the new path and MUST fail on a seeded entry that still uses the old path.

#### Scenario: Old-path fixture entry
- **GIVEN** a fixture listing a modified file under the old package path
- **WHEN** the guard runs
- **THEN** it reports that the path is no longer canonical

### Requirement: The move and the MINOR bumps land in one pull request

The `git mv` of the package path and the MINOR bumps of every shipped bluepriNNt MUST land in the same pull request, so the guard evaluates the move together with the bump on the pull-request diff. The mechanical move commit MAY be red in isolation; the pull-request head MUST pass.

#### Scenario: Atomic move and bump
- **GIVEN** a pull request containing the mechanical move commit and the bump commits
- **WHEN** the guard runs on the pull-request diff against the base ref
- **THEN** it exits 0
