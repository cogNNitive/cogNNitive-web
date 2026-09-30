## MODIFIED Requirements

### Requirement: Owned Skill With No External Dependency

The system MUST provide a cogNNitive-owned video-script skill under `skills/` that authors
Anydeo VUS scripts and understands iNNfo workspace structure (Series/Video registration).
The skill MUST NOT depend on, fork from at run time, or reference any repository outside
the monorepo. The parser and the VUS specification it uses MUST resolve from cogNNitive
packages.

#### Scenario: Skill authors a script with no external repository
- GIVEN a workspace with a registered Video Element and its owning Series, and no
  external video repository present
- WHEN the skill authors a script for that Video
- THEN the script is written to the Video's own folder
- AND no external-repository path is referenced

#### Scenario: No external reference remains
- GIVEN the skill directory
- WHEN its files are inspected
- THEN they reference no repository outside cogNNitive

### Requirement: Self-Hosted Spec Pin

The skill MUST declare, and mechanically verify, a pinned VUS spec version that resolves
to the vendored specification inside the monorepo. The pin MUST NOT reference any
external repository. The check MUST fail when the declared pin does not resolve to the
vendored file or when its content has drifted, and MUST NOT require an environment
variable pointing outside the monorepo.

#### Scenario: Pin check passes against the vendored copy
- GIVEN the skill's declared pin resolves to the vendored `V_0-3-3.json`
- WHEN the pin-validation check runs
- THEN it passes with zero warnings
- AND it succeeds with `VIDGENN_ROOT` unset

#### Scenario: Pin check fails on drift
- GIVEN a vendored spec whose content no longer matches the declared pin
- WHEN the pin-validation check runs
- THEN it fails, naming the hash mismatch as the reason

## ADDED Requirements

### Requirement: Internal Parser Resolution

`vus-parse.mjs` MUST resolve the VUS parser from the monorepo package and MUST run to
completion when `VIDGENN_ROOT` is unset. It MUST NOT skip.

#### Scenario: Parse without VIDGENN_ROOT
- GIVEN `VIDGENN_ROOT` is unset
- WHEN `node scripts/vus-parse.mjs <script.md>` runs on a valid script
- THEN the parser executes
- AND it reports zero issues
