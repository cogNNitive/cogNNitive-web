# Video Script Skill Specification

## Purpose

Defines the cogNNitive-owned skill that authors VUS video scripts inside an iNNfo workspace. The skill, its VUS parser and its VUS specification all live inside this monorepo; the spec is vendored and pinned mechanically to a single in-repo file, with no dependency on any external repository.

## Requirements

### Requirement: Owned Skill With No External Dependency

The system MUST provide a cogNNitive-owned video-script skill under `skills/` (e.g. `skills/nn-video-script/`) that authors VUS scripts and understands iNNfo workspace structure (Series/Video registration). The skill MUST NOT depend on, fork from at run time, or reference any repository outside the monorepo. The parser and the VUS specification it uses MUST resolve from cogNNitive packages.

#### Scenario: Skill authors a script with no external repository
- GIVEN a workspace with a registered Video Element and its owning Series, and no external video repository present
- WHEN the skill authors a script for that Video
- THEN the script is written to the Video's own folder
- AND no external-repository path is referenced

#### Scenario: No external reference remains
- GIVEN the skill directory
- WHEN its files are inspected
- THEN they reference no repository outside cogNNitive

### Requirement: Self-Hosted Spec Pin

The skill MUST declare, and mechanically verify, a pinned VUS spec version that resolves to the vendored specification inside the monorepo (`iNNfo/packages/innfo-video-parser/specs/V_0-3-3.json`). The pin MUST NOT reference any external repository. The check MUST fail when the declared pin does not resolve to the vendored file or when its content has drifted, and MUST NOT require an environment variable pointing outside the monorepo.

#### Scenario: Pin check passes against the vendored copy
- GIVEN the skill's declared pin resolves to the vendored `V_0-3-3.json`
- WHEN the pin-validation check runs
- THEN it passes with zero warnings
- AND it succeeds with no external-checkout environment variable set

#### Scenario: Pin check fails on drift
- GIVEN a vendored spec whose content no longer matches the declared pin
- WHEN the pin-validation check runs
- THEN it fails, naming the hash mismatch as the reason

### Requirement: Internal Parser Resolution

`vus-parse.mjs` MUST resolve the VUS parser from the monorepo package (`@cognnitive/innfo-video-parser`) and MUST run to completion with no external-checkout environment variable set. It MUST NOT skip.

#### Scenario: Parse with no external checkout
- GIVEN no external-checkout environment variable is set
- WHEN `node scripts/vus-parse.mjs <script.md>` runs on a valid script
- THEN the parser executes
- AND it reports zero issues

### Requirement: No-Prose-Copy of VUS Syntax Facts

The skill's own documentation and prompts MUST NOT restate voice IDs, property names, or other VUS-syntax facts as literal prose. Every such fact MUST be resolved by reading the pinned spec file at run time.

#### Scenario: Voice ID resolved from the pinned spec
- GIVEN a script that needs a valid `voice_id`
- WHEN the skill selects a voice
- THEN it reads the value from the pinned `V_0-3-3.json`, never from a hardcoded list in its own prose

#### Scenario: Restated voice ID rejected in review
- GIVEN a skill document containing a literal voice-ID string not sourced from the pinned spec
- WHEN skill content is reviewed against this requirement
- THEN it is flagged as a no-prose-copy violation (the `English_Deep-VoicedGentleman` class of bug)
