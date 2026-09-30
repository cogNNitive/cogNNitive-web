## MODIFIED Requirements

### Requirement: Canonical Source Layout (repository `main`)

bluepriNNt packages in the source repository MUST use canonical unversioned filenames under the canonical bluepriNNt package path `iNNfo/specs/bluepriNNts/<blueprint-name>/`:
- The primary Level 2 specification MUST be named `spec_NN.md`. The root domain bluepriNNt is `domaiNN/spec_NN.md`; the former `workspace_spec_NN.md` outlier MUST NOT exist.
- `procedures/`, `samples/`, and `assets/` (static layouts / media, e.g. `assets/model_viewer.html`) MUST also use unversioned filenames; `skills/` MAY carry agent skill manifests.
- Source paths MUST NOT encode a semantic version. The authoritative version MUST be declared in frontmatter as the `blueprint_version` key (`V_x-y-z` or dotted `x.y.z`).

#### Scenario: Canonical source bluepriNNt on `main`
- GIVEN the `business` bluepriNNt on `main`
- WHEN it is stored at `<blueprint package path>/business/spec_NN.md`
- THEN the file carries the `blueprint_version` key in its frontmatter
- AND no `_V_x-y-z_` token appears in the path

#### Scenario: Old package path is gone
- GIVEN the repository after slice S7
- WHEN `iNNfo/specs/templates/` is looked up
- THEN it does not exist
- AND every shipped bluepriNNt is under the canonical package path

### Requirement: Standardized Hydrated Package Directory Layout

When hydrated into a local domaiNN or global user cache, bluepriNNt packages MUST be written into a versioned directory `specs/bluepriNNts/<blueprint-name>/<version>/` (NN-cased folder, matched case-exactly) containing the canonical package assets (`spec_NN.md`, and — when present upstream — `procedures/`, `samples/`, `assets/`, `skills/`). An alias `<name>_V_<version>_NN.md` MUST accompany `spec_NN.md` so parsed name-based references (`parent_spec: "<name>_V_<version>"`) resolve.

#### Scenario: Validating hydrated package directory structure
- GIVEN a hydrated bluepriNNt package for `business` version `V_0-2-1`
- WHEN the package is stored at `specs/bluepriNNts/business/V_0-2-1/`
- THEN `spec_NN.md` is present as the main Level 2 specification
- AND the alias `business_V_0-2-1_NN.md` is present alongside it
- AND subdirectories `samples/`, `procedures/`, and `assets/` store any upstream package assets

#### Scenario: Legacy flat templates are not resolved
- GIVEN a domaiNN containing a flat file at `./templates/business_V_0-1-0_NN.md` and no `specs/bluepriNNts/business/V_0-1-0/`
- WHEN the resolver looks for `business` `V_0-1-0`
- THEN it does not resolve the flat file
- AND the domain is reported legacy with a migration hint

### Requirement: Multi-Tier Local Cache and Resolution Precedence

bluepriNNt resolution MUST traverse local and global locations in deterministic order:
1. Domain package directory: `./specs/bluepriNNts/<name>/<version>/`
2. Global user cache: `~/.agents/bluepriNNts/<name>/<version>/`
3. Installed skill directories that bundle bluepriNNts (the directory named by the `bundled_blueprints` key): `~/.agents/skills/*/<bundled-blueprints-dir>/<name>/<version>/`

The former workspace flat fallback (`./templates/` and the flat `./specs/` form) and the former `~/.agents/templates/` cache MUST NOT be searched.

#### Scenario: Resolving bluepriNNt from domain package directory first
- GIVEN a bluepriNNt available in both `./specs/bluepriNNts/business/V_0-2-0/` and `~/.agents/bluepriNNts/business/V_0-2-0/`
- WHEN `innfo-core` or `innfo-mcp` resolves `business` `V_0-2-0`
- THEN the domain package version is selected

#### Scenario: Resolution fallback to global user cache
- GIVEN a bluepriNNt `projects` `V_0-2-0` that is absent in the current domaiNN
- BUT present in `~/.agents/bluepriNNts/projects/V_0-2-0/`
- WHEN resolution is executed
- THEN the global user cache directory is returned

#### Scenario: Resolution from installed skill package
- GIVEN a bluepriNNt embedded within an installed skill's bundled-blueprints directory
- WHEN it is absent in the domaiNN and the global cache
- THEN it is located and loaded from the skill path

#### Scenario: Retired locations are not searched
- GIVEN a bluepriNNt present only at `~/.agents/templates/projects/V_0-2-0/`
- WHEN resolution is executed
- THEN it is not found there

### Requirement: Immutable Atomic Hydration and Remote Fetching

When a requested bluepriNNt package is not available locally, `innfo-mcp` MUST download and extract the remote package into `specs/bluepriNNts/<name>/<version>/` using an atomic directory swap operation. Once populated, versioned package directories MUST be treated as immutable write-once caches.

#### Scenario: Atomic remote download and package extraction
- GIVEN a remote bluepriNNt URL under the canonical package path at a release ref
- WHEN `innfo-mcp` fetches the missing package
- THEN package contents are downloaded into a temporary staging directory
- AND atomically renamed to `specs/bluepriNNts/business/V_0-2-0/` upon completion

#### Scenario: Write-once immutability enforcement
- GIVEN an existing local package directory at `specs/bluepriNNts/business/V_0-2-0/`
- WHEN a fetch operation is requested for the same version
- THEN existing cached contents are preserved without redundant re-downloading or accidental modification

## ADDED Requirements

### Requirement: Every shipped bluepriNNt is re-parented, bumped and mapped

Every shipped bluepriNNt MUST receive a MINOR bump of its blueprint version, MUST declare iNNfo `V_0-3-0` as its parent, and MUST ship a schema map from its last legacy version. A bluepriNNt without a map MUST NOT ship.

#### Scenario: Shipped bluepriNNt complete
- **GIVEN** any shipped bluepriNNt after slice S7
- **WHEN** its frontmatter and the schema maps are inspected
- **THEN** its version is a MINOR bump of the prior version, its parent is iNNfo `V_0-3-0`, and a map from its last legacy version exists

#### Scenario: Missing map fails CI
- **GIVEN** a shipped bluepriNNt with no schema map
- **WHEN** the verification gates run
- **THEN** a gate fails and names the bluepriNNt
