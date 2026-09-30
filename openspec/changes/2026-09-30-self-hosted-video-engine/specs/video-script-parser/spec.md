# Delta for Video Script Parser

## ADDED Requirements

### Requirement: Vendored VUS Spec

The system MUST host the canonical VUS specification inside the monorepo under the
canonical spec hosting base, and MUST read it from there. No skill script or package MAY
resolve the VUS spec from `VIDGENN_ROOT` or from any external repository.

#### Scenario: Spec resolves internally with no external repo
- GIVEN a machine with no VidGeNN checkout and `VIDGENN_ROOT` unset
- WHEN `vus-spec.mjs voices` runs
- THEN it returns the voice list from the vendored spec
- AND it does not print a skip line

#### Scenario: Exactly one declared hash
- GIVEN the vendored spec and `manifest/source.yaml`
- WHEN the pin check runs
- THEN exactly one declared hash matches the vendored file
- AND no `external_specs` entry references another repository

### Requirement: Port Parser Behaviour

The package MUST expose `parse(text)` producing the same AST as the upstream
`@anydeo/core` VUS parser for the same input, and MUST apply the same semantic rules on
`validate(ast)`.

#### Scenario: Round-trip parity
- GIVEN an upstream corpus script
- WHEN it is parsed and re-serialized by the ported parser
- THEN the result matches the upstream snapshot

#### Scenario: Semantic validation parity
- GIVEN a script using a property outside its scope
- WHEN validated
- THEN the same diagnostic is produced as upstream

### Requirement: Self-Contained Package

The parser package MUST have no runtime dependency on `innV0/VidGeNN` or any source
outside the monorepo workspace.

#### Scenario: No external imports
- GIVEN the package's source tree
- WHEN its imports are inspected
- THEN none resolve outside the workspace
