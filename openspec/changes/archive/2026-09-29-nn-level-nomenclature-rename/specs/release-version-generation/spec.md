## ADDED Requirements

### Requirement: sync-versions targets the new keys and paths

`sync-versions` and the related generators (`blueprint-catalog.mjs`, `channel-refs.js`, `tag-pin-freshness`) MUST read and write only the new manifest keys and the new bluepriNNt package path. `--check` MUST fail when a legacy key or the old package path is still referenced by a generator input.

#### Scenario: Generation under the new keys
- **GIVEN** the migrated manifest
- **WHEN** `sync-versions --check` runs
- **THEN** it passes and reads blueprint versions from the `blueprint_version` key

#### Scenario: Legacy input fails the check
- **GIVEN** a bluepriNNt that still carries `template_version`
- **WHEN** `sync-versions --check` runs
- **THEN** it fails and names the file

### Requirement: Derived refs use the new tag namespace

For the bluepriNNt channel, the derived stable `ref` MUST be `<key>-v<version>` with `key: blueprints`, and the version is the batch number that continues the old sequence. A malformed version MUST still fail `--check`.

#### Scenario: Ref derivation
- **GIVEN** `{ key: blueprints, version: "0.18.0" }`
- **WHEN** the manifest is generated
- **THEN** the ref is `blueprints-v0.18.0`

### Requirement: The MCP version and CDN bundle follow the release unit

A release of the new-language MCP MUST bump the `innfo-mcp` minor version (expected `0.12.0`), regenerate the dependent versions from that single authored value, stage a new CDN bundle for that version, and set the manifest MCP entry `min_version` to that minor. Frozen bundles MUST NOT be modified. Release R MUST tag the merged SHA (after `git push origin dev:main`) with `blueprints-v0.18.0`, `innfo-mcp-v0.12.0`, the Suite tag derived by `channel-refs`/`sync-versions` (the next after the latest existing `v0.10.0`; never a hand-picked number) and `skills-v*`, then pin the refs and `min_version`, then regenerate the manifest and CDN bundle. The S11 cleanup release MUST be a MINOR release, not a patch.

#### Scenario: Release unit consistent
- **GIVEN** the MCP `package.json` version bumped for release R
- **WHEN** the generators run
- **THEN** the core version, dependency range, CDN manifest `latest`, stable ref and `min_version` agree
- **AND** the new CDN bundle file exists

### Requirement: The catalog generator and path-aware release scripts move with the package path

`scripts/template-catalog.mjs` MUST be renamed `scripts/blueprint-catalog.mjs`, and the `sync:versions` and `check:versions` npm scripts MUST call the new name in the same task. `scripts/lib/tag-pin-freshness.js` (`TEMPLATE_SPEC_RE`), `scripts/guard-template-immutability.js`, `scripts/build-docs.mjs` (catalog staging path `innfo/blueprints/`) and `scripts/sync-samples.mjs` MUST be updated in the same commit series as the `git mv` of the package path, so check-integrity Group 1c and the immutability guard never watch a path that no longer exists.

#### Scenario: Group 1c watches the new path
- **GIVEN** a change to `iNNfo/specs/bluepriNNts/business/spec_NN.md` without a new tag or a re-pin
- **WHEN** `check-integrity` runs
- **THEN** the tag-pin-freshness group fails
- **AND** a change under the retired `iNNfo/specs/templates/` path is not matched

#### Scenario: Renamed generator wired into the npm scripts
- **GIVEN** the root `package.json`
- **WHEN** `npm run sync:versions` and `npm run check:versions` run
- **THEN** they invoke `scripts/blueprint-catalog.mjs` and no reference to `template-catalog.mjs` remains

#### Scenario: Catalog staged at the new Pages path
- **GIVEN** `build-docs.mjs` output
- **WHEN** the catalog location is inspected
- **THEN** it is `innfo/blueprints/catalog.json` and nothing is staged at `innfo/templates/catalog.json`
