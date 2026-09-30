# Source Convergence Strategies Specification

## Purpose

Make the step from "a new snapshot arrived" to "the knowledge model reflects it"
explicit, declarative, and reviewable — without ever mutating a source file. A source
family declares a convergence strategy; a deterministic command computes a keyed delta
proposal between the two newest snapshots; the proposal is applied through the normal
reviewed model-mutation path.

## Requirements

### Requirement: Declared Convergence Strategy

A source family MAY declare a convergence strategy: `cite-only` (default), `upsert`, or
`replace-values`. A non-default strategy MUST also declare a `key`. When no strategy is
declared, the system MUST behave as `cite-only` (snapshots accumulate; no proposal).

#### Scenario: Non-default strategy produces a proposal
- GIVEN a source family declaring `upsert` with `key:: video_id`
- AND a newer snapshot exists than the one last applied
- WHEN `node …/index.js --converge <family>` is run
- THEN a keyed delta proposal is emitted for review.

#### Scenario: Default is cite-only
- GIVEN a source family with no declared strategy
- WHEN `--converge` is run for it
- THEN no proposal is emitted.

### Requirement: Keyed Delta Proposal

The system MUST compute a deterministic delta between the two newest snapshots of a
family, reporting added keys, changed values, removed keys, and conflicts, with stable
ordering. It MUST reject a missing, empty, or duplicated `key` with a non-zero exit and
MUST emit no proposal in that case. By default, removed keys MUST be reported and not
acted upon.

#### Scenario: Added rows are reported
- GIVEN a newer snapshot containing a key absent from the previous snapshot
- WHEN the delta is computed
- THEN the key appears under `added`.

#### Scenario: Invalid key aborts
- GIVEN a snapshot whose declared `key` column has an empty or duplicated value
- WHEN `--converge` is run
- THEN it exits non-zero
- AND no proposal is written.

### Requirement: Read-Only Proposal

Computing a convergence proposal MUST NOT write to `sources/import/`, `sources/nn/`, or
any model file. Only an explicit, reviewed apply step MAY change the model.

#### Scenario: Proposal is read-only
- GIVEN any family with a computable delta
- WHEN `--converge` is run
- THEN `sources/import/` and `sources/nn/` are byte-unchanged
- AND no model file is modified.

### Requirement: Idempotent Proposal

Running the same convergence twice over unchanged snapshots MUST yield an empty proposal
the second time. A proposal already applied MUST NOT be re-applied.

#### Scenario: Second run is empty
- GIVEN a proposal computed over two snapshots
- WHEN `--converge` is run again with no new snapshot
- THEN the emitted proposal is empty.

### Requirement: Reviewed Application

Applying a convergence proposal MUST go through the reviewed model-mutation path — a
diff preview, explicit confirmation, `apply_change` per element, then `validate_model` —
and MUST produce exactly one model version bump.

#### Scenario: Apply bumps once and validates
- GIVEN a reviewed convergence proposal
- WHEN the user confirms the diff preview
- THEN the model is updated element by element
- AND `validate_model` passes
- AND the model version is bumped exactly once.
