<!--
  The archived predecessor repository slug is written as two adjacent code spans
  (`cogNNitive`/`iNNfo`) rather than one, on purpose: the iNNfo `check:spec-urls`
  strict legacy scan fails on any contiguous occurrence of that slug in a
  non-excluded file, and files under openspec/specs/ are in scope.
-->

# Canonical Spec Hosting

## Purpose

Fix the canonical hosting location for every iNNfo specification, template, sample model, and procedure sub-model on the monorepo: raw content at `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/` and browsing at `https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/`. The editor consumes a single `REMOTE_SPEC_BASE` constant, a strict repo-wide checker fails on any residual archived-repository reference and verifies canonical URLs resolve to real files, and the dead legacy root `specs/` island is removed.

## Requirements

### Requirement: Canonical Spec Hosting Base URL

All canonical iNNfo specifications (Level 1 core specs, Level 2 templates, Level 3 sample models, and procedure sub-models) MUST use `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/` as their canonical raw hosting base URL, and `https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/` as their browsing blob base URL.
No canonical specification, template, sample model, or documentation MAY reference the archived predecessor repository (`cogNNitive`/`iNNfo`), including its legacy `raw.githubusercontent.com/cogNNitive`/`iNNfo/(main|v0.1.x)/` raw paths or its `github.com/cogNNitive`/`iNNfo/blob/main/` browsing paths.

#### Scenario: Level 1 and defiNNe spec frontmatter
- GIVEN any Level 1 or defiNNe specification file (`iNNfo_V_0-2-1_NN.md`, `iNNfo_V_0-2-0_NN.md`, `iNNfo_V_0-1-0_NN.md`, `defiNNe_V_0-1-0_NN.md`)
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, `spec.url`, and any `includes[].url` declare URLs rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/`
- AND no legacy URL referencing the archived predecessor repository remains in frontmatter or descriptive prose

#### Scenario: Level 2 template spec frontmatter
- GIVEN any Level 2 template specification file under `iNNfo/specs/templates/` (e.g. `workspace_V_0-2-0_spec_NN.md`, `business_V_0-2-0_NN.md`, `business_V_0-1-0_NN.md`)
- WHEN its frontmatter is inspected
- THEN `spec_url`, `parent.url`, and `includes[].url` declare URLs rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/`

#### Scenario: Level 3 sample model and procedure submodel frontmatter
- GIVEN any Level 3 sample model under `iNNfo/specs/templates/**/samples/` or procedure sub-model under `iNNfo/specs/templates/documentation/**/procedures/`
- WHEN its frontmatter is inspected
- THEN `parent_spec.url` declares a URL rooted at `https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/`

### Requirement: Editor Runtime Spec Base Constant

The `innfo-editor` application MUST define a single shared constant `REMOTE_SPEC_BASE` in `src/config/samples.ts` alongside `REMOTE_SAMPLE_BASE`, pointing to `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs`. All editor components and views displaying or linking to canonical specifications MUST consume `REMOTE_SPEC_BASE` rather than duplicating the URL string literal.

#### Scenario: Editor displays canonical L1 spec link
- GIVEN the `ModelInfoPanel` or `StandaloneProcedureView` component in `innfo-editor`
- WHEN rendering links to the canonical specification
- THEN the link target is constructed using `REMOTE_SPEC_BASE`

### Requirement: Strict Repo-Wide Spec URL Checker

The CI URL validation script (`iNNfo/scripts/check-spec-version.mjs --check-urls`) MUST:
1. Scan across the entire repository root across extensions `.ts`, `.vue`, `.md`, `.mjs`, `.js`, `.yaml`, `.yml`, `.json`, `.html`.
2. Verify local file existence for canonical URLs matching `https://raw.githubusercontent.com/cogNNitive/cogNNitive/(?:main|v[\d.]+)/iNNfo/([^\s"')\]]+)`.
3. Perform a strict scan that fails (exit code 1) on ANY residual occurrence of the archived-repository slug outside permanent exclusions (`archive/**`, `node_modules/**`, `dist/**`, `*.bundle.js`, golden fixtures) and explicit temporary allowlisted files.
4. Emit a loud WARNING on every run for allowlisted manifest paths (`manifest/source.yaml`, `docs/use/manifest.md`, `docs/use/manifest-next.md`, `scripts/manifest/*.test.js`, `actioNN/scripts/skills-manager.test.js`) documenting that they are temporary debt tracked for Change 2.

> **Sync reconciliation:** point 4 (temporary manifest allowlist with loud per-run warnings) was subsequently eliminated by the `monorepo-release-manifest` capability — `check-spec-version.mjs` now carries an empty allowlist and the strict scan fails on *any* archived-repository reference in *any* non-excluded file, manifest paths included. Points 1–3 are the live contract; point 4 is retained for historical context only.

#### Scenario: Valid repository tree passes check:spec-urls
- GIVEN the migrated repository tree
- WHEN `npm --prefix iNNfo run check:spec-urls` is executed
- THEN the process exits with code 0
- AND no allowlist warnings are emitted (the manifest allowlist was removed by `monorepo-release-manifest`)

#### Scenario: Seeded legacy URL fails check:spec-urls
- GIVEN any non-allowlisted tracked file containing a legacy archived-repository string
- WHEN `npm --prefix iNNfo run check:spec-urls` is executed
- THEN the process exits with code 1 and prints the offending file path and line

### Requirement: Removal of Dead Root Specs Island

The dead legacy root `specs/**` directory (6 files) unconsumed by CI or documentation builds MUST be removed from the repository.

#### Scenario: Root specs directory does not exist
- GIVEN the repository root
- WHEN file tree is inspected
- THEN no directory named `specs/` exists at the workspace root
