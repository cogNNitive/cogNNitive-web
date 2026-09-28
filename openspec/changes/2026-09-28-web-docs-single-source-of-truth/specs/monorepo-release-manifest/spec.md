# Delta for Monorepo Release Manifest

## MODIFIED Requirements

### Requirement: Workspace Git Skill Registration

At release time (the `chore(release)` commit that tags the skills channel,
precedent `73cbc64` for nn-upgrade — NOT in this feature change), the skills
section of `manifest/source.yaml` MUST declare `nn-workspace-git` with
`repo: cogNNitive/cogNNitive`, `path: skills/nn-workspace-git`, and
`ref_key: skills`. The entry MUST NOT reference any archived repository.
Registering in the feature change is FORBIDDEN: pre-release it breaks
`Validate Stable Manifest` (404 at the pinned tag) while omitting the regen
breaks `Doc Fresh` — both cannot pass before release tags exist.

(Previously: the requirement text and its scenario stated
`path: actioNN/skills/nn-workspace-git`, which no longer matches the working
tree — the skill now lives at `skills/nn-workspace-git`, not under a removed
`actioNN/` top-level directory.)

#### Scenario: Skill entry declaration

- GIVEN the skills section of `manifest/source.yaml`
- WHEN the `nn-workspace-git` entry is inspected
- THEN its `repo:` is `cogNNitive/cogNNitive`
- AND its `path:` is `skills/nn-workspace-git`

#### Scenario: Distribution stays unified

- GIVEN manifest validation of the skills section
- WHEN all skill entries are scanned
- THEN zero entries declare an archived repository
