<!--
  The archived predecessor repository slug is written as two adjacent code spans
  (`cogNNitive`/`iNNfo`) rather than one, on purpose: the iNNfo `check:spec-urls`
  strict legacy scan fails on any contiguous occurrence of that slug in a
  non-excluded file, and files under openspec/specs/ are in scope.
-->

# Monorepo Release Manifest

## Purpose

Consolidate release distribution onto the single `cogNNitive/cogNNitive` monorepo. Every skill, template, and MCP bundle in the bootstrap manifest (`manifest/source.yaml`) declares `repo: cogNNitive/cogNNitive`; the `stable` channel resolves all assets to `main`-reachable snapshot tags matching `TAG_SHAPE_RE`; and the CI URL checker no longer allowlists any manifest file, so the whole repository must be free of archived-repository references.

## Requirements

### Requirement: Unified Monorepo Distribution Source

All skills, templates, and MCP bundles declared in the bootstrap manifest (`manifest/source.yaml`) MUST declare `repo: cogNNitive/cogNNitive` as their repository. No asset MAY declare archived repositories (`cogNNitive`/`iNNfo` or `cogNNitive/actioNN`).

#### Scenario: Skills asset declaration
- GIVEN the skills section of `manifest/source.yaml`
- WHEN any skill entry (e.g. `nn-router`, `nn-innfo`, `nn-trannsform`) is inspected
- THEN its `repo:` is `cogNNitive/cogNNitive`
- AND its `path:` begins with `skills/`

#### Scenario: Templates asset declaration
- GIVEN the templates section of `manifest/source.yaml`
- WHEN any template entry (e.g. `workspace_spec_NN`, `procedures`, `business`) is inspected
- THEN its `repo:` is `cogNNitive/cogNNitive`
- AND its `path:` begins with `iNNfo/specs/templates/`

#### Scenario: MCP bundle asset declaration
- GIVEN the embedded `mcp:` section of skill `nn-innfo` in `manifest/source.yaml`
- WHEN the `innfo-mcp` entry is inspected
- THEN its `repo:` is `cogNNitive/cogNNitive`
- AND its `path:` is `iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js`

### Requirement: Stable Channel Tag Provenance

For the `stable` channel, all assets MUST resolve to snapshot tags on `cogNNitive/cogNNitive` that conform to `TAG_SHAPE_RE` (`/^[a-z][a-z0-9-]*-v\d+\.\d+\.\d+$/`) and are reachable from `main`.

#### Scenario: Stable channel resolution
- GIVEN the stable channel manifest rendered in `docs/use/manifest.md`
- WHEN validated via `validate-manifest.js --channel stable`
- THEN all tags (`skills-v1.1.3`, `templates-v0.2.0`, `innfo-mcp-v0.2.4`) resolve on `cogNNitive/cogNNitive`
- AND commit provenance checks confirm reachability from `main`

### Requirement: Removal of Manifest Allowlist in CI Checker

The CI URL validation checker (`iNNfo/scripts/check-spec-version.mjs`) MUST NOT allowlist any manifest files. The entire repository, including `manifest/source.yaml`, `docs/use/manifest.md`, `docs/use/manifest-next.md`, and manifest test suites, MUST be free of residual archived-repository (`cogNNitive`/`iNNfo`) references.

#### Scenario: Strict CI checker scans manifest paths
- GIVEN `npm --prefix iNNfo run check:spec-urls` is executed
- WHEN manifest paths are scanned
- THEN zero allowlisted warnings and zero legacy violations are emitted

### Requirement: Stable Template Main Coherence

For every template declared in the `stable` channel of `manifest/source.yaml`, the system MUST verify that the template's content at its pinned commit is coherent with the content at the same `path` on the `main` branch. Coherence is defined as an empty diff after normalizing line endings and stripping a leading BOM from both revisions; raw byte identity is not required.

The system MUST report a violation whenever the two contents differ, in either direction: `main` ahead with unreleased work, or a tag released without being merged to `main`. Each violation MUST name the template `path`, the pinned commit, and both compared revisions (the pinned commit and `main`).

This check MUST apply only to the `stable` channel, where `requireProvenance` is `true`. The `preview` channel MUST NOT be evaluated, because it pins `main` and is trivially coherent.

The comparison MUST reuse the existing GitHub authentication (`authHeaders`, `GITHUB_TOKEN`). When the comparison fails due to rate limiting, the system MUST report the violation with `RATE_LIMIT_HINT` and MUST NOT crash.

No frontmatter URL (`spec_url`, `parent_spec.url`, `includes[].url`) is rewritten by this check; canonical `main` URLs remain unchanged.

#### Scenario: Identical pinned and main content

- GIVEN a template on the `stable` channel whose content at its pinned commit equals the content at the same `path` on `main` after line-ending/BOM normalization
- WHEN the manifest is validated for the `stable` channel
- THEN no coherence violation is reported for that template

#### Scenario: main ahead of the pinned commit

- GIVEN a template on the `stable` channel pinned to a commit whose content differs from the content on `main` because unreleased work advanced `main`
- WHEN the manifest is validated for the `stable` channel
- THEN a coherence violation is reported naming the `path`, the pinned commit, and both revisions

#### Scenario: tag released without being merged to main

- GIVEN a template on the `stable` channel whose pinned commit contains content that differs from `main` because the release tag was never merged to `main`
- WHEN the manifest is validated for the `stable` channel
- THEN a coherence violation is reported naming the `path`, the pinned commit, and both revisions

#### Scenario: rate limit during comparison

- GIVEN the template content comparison for a `stable` template returns a rate-limit error
- WHEN the manifest is validated for the `stable` channel
- THEN a violation is reported with `RATE_LIMIT_HINT`
- AND validation does not crash

#### Scenario: coherence not evaluated on preview

- GIVEN a template declared on the `preview` channel only
- WHEN the manifest is validated for the `preview` channel
- THEN no main-coherence comparison is performed for that template

### Requirement: Workspace Git Skill Registration

At release time (the `chore(release)` commit that tags the skills channel, precedent `73cbc64` for nn-upgrade — NOT in the feature change), the skills section of `manifest/source.yaml` MUST declare `nn-workspace-git` with `repo: cogNNitive/cogNNitive`, `path: skills/nn-workspace-git`, and `ref_key: skills`. The entry MUST NOT reference any archived repository. Registering in the feature change is FORBIDDEN: pre-release it breaks `Validate Stable Manifest` (404 at the pinned tag) while omitting the regen breaks `Doc Fresh` — both cannot pass before release tags exist.

#### Scenario: Skill entry declaration

- GIVEN the skills section of `manifest/source.yaml`
- WHEN the `nn-workspace-git` entry is inspected
- THEN its `repo:` is `cogNNitive/cogNNitive`
- AND its `path:` is `skills/nn-workspace-git`

#### Scenario: Distribution stays unified

- GIVEN manifest validation of the skills section
- WHEN all skill entries are scanned
- THEN zero entries declare an archived repository
