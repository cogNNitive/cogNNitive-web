# Artifact Staleness Diagnostic Specification

## Purpose

Let `lineage-check.js` tell apart two distinct failure modes that were previously reported identically: a citation pointing at a model that does not exist, versus a citation pointing at a model that exists but whose recorded `model_version` has drifted from the artifact's current `model_version`.

## Requirements

### Requirement: Unknown model name stays an error

When a lineage artifact cites a model name that does not resolve to any model in the workspace, `lineage-check.js` MUST report this as an `error`-level diagnostic, unchanged from current behavior.

#### Scenario: Citation to a nonexistent model

- GIVEN a lineage artifact citing model `Nonexistent_Model`
- AND no model named `Nonexistent_Model` exists in the workspace
- WHEN `lineage-check.js` runs
- THEN it reports an `error` diagnostic naming the missing model
- AND exits non-zero

### Requirement: Version-drifted artifact is a distinct warning, not an error

When a lineage artifact cites a model that exists in the workspace, but the `model_version` recorded on the artifact differs from the model's current `model_version`, `lineage-check.js` MUST report this as a distinct `warning`-level staleness diagnostic. This staleness warning MUST NOT escalate to an `error` and MUST NOT cause a non-zero exit on its own.

#### Scenario: Version drift produces a staleness warning

- GIVEN a lineage artifact recording `model_version: "V_1-0-0"` for model `Business_Plan`
- AND `Business_Plan` currently exists at `model_version: "V_1-1-0"`
- WHEN `lineage-check.js` runs
- THEN it reports a `warning` diagnostic distinct from the missing-model error, naming the artifact, the model, and both versions
- AND the run exits zero when this is the only finding

#### Scenario: Staleness warning does not escalate under `--check`

- GIVEN a workspace with only a version-drifted artifact and no other findings
- WHEN `lineage-check.js --check` runs
- THEN the staleness warning is reported
- AND the exit code remains zero (the warning does not become an error)

#### Scenario: Missing model and staleness are reported independently

- GIVEN one artifact citing a nonexistent model and another artifact citing a version-drifted but existing model
- WHEN `lineage-check.js` runs
- THEN it reports one `error` diagnostic for the missing model
- AND one separate `warning` diagnostic for the version drift
