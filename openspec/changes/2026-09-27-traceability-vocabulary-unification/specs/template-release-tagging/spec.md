# Spec: Coupled Version Bump for the Vocabulary Unification

## ADDED Requirements

### Requirement: Core-Language and Workspace-Template Version Bumps Ship as One Batch

When a change renames a core-language section heading or reserves a new
element-level property (as this vocabulary unification does, adding a new
`iNNfo_V_0-2-2_NN.md` core-language file), the core-language version bump and
the dependent workspace-template `template_version` bump MUST be released
together, in the same final work unit, followed immediately by:
1. a `templates-v<version>` tag (per the Standardized Git Release Tag Naming
   Convention) covering the updated workspace template, and
2. a `manifest/source.yaml` re-pin to the new tag.

This work unit MUST be committed separately from the rename/behavior commits
that precede it, and MUST NOT be split across multiple, unrelated PRs such
that the tag or the re-pin could be merged without the other. `sdd-tasks`
output for a change with this shape MUST list the tag, the re-pin, and
`check-integrity` as explicit, separately-checkable task items.

#### Scenario: Version bump, tag, and re-pin land together

- GIVEN a change that adds a new core-language file and bumps the workspace
  template's `template_version`
- WHEN the final work unit for that change is committed
- THEN the same work unit also cuts the corresponding `templates-v<version>`
  tag and updates `manifest/source.yaml` to pin it

#### Scenario: validate-manifest and check-integrity pass after the re-pin

- GIVEN the version bump, tag, and re-pin have landed as one batch
- WHEN `validate-manifest --channel stable` and `check-integrity` run
- THEN both pass, with no dangling reference to the pre-bump template version

#### Scenario: Forgetting the re-pin is caught before merge

- GIVEN a work unit that bumps `template_version` and cuts a
  `templates-v<version>` tag but does not update `manifest/source.yaml`
- WHEN `validate-manifest --channel stable` runs against `main`
- THEN it reports a violation naming the stale pinned reference, rather than
  silently passing
