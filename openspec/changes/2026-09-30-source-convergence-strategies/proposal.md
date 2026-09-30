# Proposal: Source Convergence Strategies

## Why

Dynamic sources accumulate as immutable timestamped snapshots, but **nothing turns a
new snapshot into updated knowledge**. Today an agent or user must notice the new data
and hand-edit the model, which is exactly the manual work the pipeline is supposed to
remove. The tempting shortcut — append the new rows into a source, or overwrite the
file with corrected data — is unsafe: a source is a **citation target**
(`sources:: [file.md#heading]`), so mutating it silently rewrites what every existing
citation means, defeats the per-source archive, and disables the impact check.

The correct place to converge is the **knowledge model**, through an explicit,
reviewable procedure. This change makes that step first-class and declarative.

## What Changes

- **A declared convergence strategy per source family.** `cite-only` (default) |
  `upsert` (add new keys, flag changes) | `replace-values` (add new keys, replace
  changed values). Non-default strategies also declare a **`key`** (the identity
  column/field).
- **A deterministic delta proposal.** `nn-trannsform --converge <family>` computes the
  difference between the newest snapshot and its predecessor — added keys, changed
  values, removed keys, conflicts — and emits a **read-only proposal**. It never writes
  the model and never writes the source.
- **Applying is a normal reviewed mutation.** The proposal is applied through the
  existing agent-guided model mutation path (`apply_change` + `validate_model`) with a
  diff preview and a single version bump — the same shape as `apply_feedback`.
- **Sources stay immutable.** Convergence never writes to `sources/import/` or
  `sources/nn/`. A new drop is still an immutable snapshot; the model is what changes.
- **Idempotent.** Running `--converge` twice with the same snapshots yields an empty
  proposal the second time; a proposal already applied yields an empty proposal.

## Capabilities

### New Capabilities
- `source-convergence-strategies`: the declared `convergence`/`key` contract, the keyed
  delta engine, the read-only proposal, the apply-via-mutation path, and idempotence.

### Modified Capabilities
- None. `dynamic-sources-impact-check` keeps owning change detection; convergence is a
  downstream consumer of the snapshots it produces.

## Impact

### Affected areas
- `skills/nn-trannsform/scripts/` — a keyed delta engine and a `--converge` CLI mode,
  plus tests.
- `skills/nn-innfo/SKILL.md` — an apply procedure for a convergence proposal (reusing
  the feedback apply loop: diff preview → confirm → `apply_change` → single bump).
- The domaiNN source catalog entry — declare `convergence` and `key` per source family.
- `docs/innfo/documentation/import-modes.md` — move the convergence note from
  "roadmap" to shipped.

### Verification
- Unit: the delta engine reports added/changed/removed keys and conflicts against two
  fixtures; a missing or duplicate key aborts with a non-zero exit and no proposal;
  the same inputs produce a byte-identical proposal (idempotence).
- Unit: `--converge` leaves `sources/import/` and `sources/nn/` byte-unchanged.
- Behaviour: an applied proposal produces one model version bump and a clean
  `validate_model`.

### Rollback
Additive and read-only until applied. Revert the commits; no persisted workspace format
changes and no source files are ever mutated by the feature itself.

### Dependencies
- Builds on the per-source archive / snapshot series (`source-versioning-archive`) and
  the feedback-apply loop (`innfo-console-feedback`). No blocking dependency.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A bad key silently merges wrong rows | Med | require a unique, non-empty key; abort without it; proposal is reviewable before apply |
| Human and agent write the model at once | Low | the proposal is read-only; the single write path is the reviewed apply |
| Scope creep into a general ETL engine | Med | only keyed tabular upsert/replace; no arbitrary transforms |
| Applying to prose/unstructured sources | High | convergence applies only to keyed tabular families; prose stays `cite-only` |
| Removed keys delete data unintentionally | Med | default to **flag** removed keys; deletion is an explicit choice (open decision) |

### Success criteria
- [ ] A declared `upsert` family produces a delta proposal after a new snapshot.
- [ ] Applying it updates the model with a diff preview, one version bump, and a clean
      validation.
- [ ] `--converge` never mutates a source file.
- [ ] Re-running with unchanged snapshots yields an empty proposal.

### Out of scope
- In-place source mutation (rejected by design).
- Arbitrary transform/ETL pipelines.
- Automatic application without review.
- A conflict-resolution UI.

### Open decisions

| # | Decision | Options |
|---|---|---|
| 1 | Where `convergence`/`key` are declared | domaiNN manifest vs. source catalog entry |
| 2 | Removed keys | flag-only (default) vs. archive model elements |
| 3 | `upsert` vs. `replace-values` | conflict handling only, or different element lifecycle |
| 4 | Multi-column keys | single key only, or composite key |
