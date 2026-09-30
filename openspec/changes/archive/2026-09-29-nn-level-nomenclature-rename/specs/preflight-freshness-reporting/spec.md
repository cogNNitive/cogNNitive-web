## ADDED Requirements

### Requirement: Preflight reads only the new manifest and catalog keys

`preflight-check.js` MUST read the new manifest keys (`blueprints`, `frozen_blueprints`, `key: blueprints`) and the new catalog key `blueprints`. It MUST NOT parse the legacy keys. Skills-manager and preflight installed before release R are not supported and MUST be reinstalled from release R.

#### Scenario: New manifest parsed
- **GIVEN** the rendered manifest with the new keys
- **WHEN** `preflight-check.js` runs
- **THEN** it reports pins and bluepriNNt versions from the new keys

#### Scenario: Legacy key set is not read
- **GIVEN** a manifest that carries only the legacy keys
- **WHEN** `preflight-check.js` runs
- **THEN** it reports the manifest as unrecognised and does not fall back to the legacy keys

### Requirement: Preflight enforces a minimum MCP version before offering migration

The manifest MCP entry MUST carry a `min_version` field, set to the MCP minor that release R ships (expected `0.12.0`). `min_version` MUST move only when the tool surface breaks, whereas the pin moves on every release. Preflight MUST compare the installed MCP version against both. When the installed MCP is below `min_version`, preflight MUST report a blocker `mcp-below-minimum` with the reinstall command, MUST NOT offer the legacy migration, and MUST NOT let a new skill run silently against an MCP that lacks the canonical tool names. When the installed MCP is between `min_version` and the pin, preflight MUST report a warning. Legacy detection (bundled, local) MUST always run, but the route to nn-upgrade MUST be offered only once the MCP is at or above `min_version`, because the migration final gate calls `validate_knowledge`.

#### Scenario: MCP below minimum
- **GIVEN** an installed MCP older than `min_version`
- **WHEN** preflight runs
- **THEN** it reports the blocker `mcp-below-minimum`, the version gap, the required version and the reinstall command
- **AND** it does not offer migration
- **AND** legacy detection still runs

#### Scenario: MCP between minimum and pin
- **GIVEN** an installed MCP at or above `min_version` and below the pin
- **WHEN** preflight runs
- **THEN** it reports a warning and no blocker
- **AND** the route to nn-upgrade is offered for a legacy domain

#### Scenario: MCP at or above minimum
- **GIVEN** an installed MCP at the pin
- **WHEN** preflight runs
- **THEN** no version gap is reported

### Requirement: Preflight reports legacy domains without blocking

When run with a domain directory that is a legacy layout, preflight MUST report the domain as legacy, point to nn-upgrade, and MUST NOT change the exit code on that account. Preflight MUST reach legacy detection through the generated bundle `skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs`, built from the single quarantine detector, and MUST NOT hold a second copy of legacy knowledge.

#### Scenario: Legacy domain reported
- **GIVEN** a domain with the legacy entrypoint and `models/`
- **WHEN** preflight runs against it
- **THEN** it prints the legacy report with the nn-upgrade pointer
- **AND** the exit code is the same as it would be without the report

#### Scenario: Preflight tests do not depend on the host home directory
- **GIVEN** the preflight test suites
- **WHEN** they run with an empty `USERPROFILE` and `HOME`
- **THEN** they pass

### Requirement: The freshness signal keeps its contract under the new keys

The freshness line, its silent-omission behaviour and the exit-code invariant defined above MUST keep working when the manifest pins are read from the new keys.

#### Scenario: Freshness line under new keys
- **GIVEN** a manifest with the new keys and matching freshness data
- **WHEN** preflight runs
- **THEN** exactly one informational freshness line is printed per subsystem
- **AND** the exit code is unaffected

### Requirement: Preflight paths, flags and catalog URLs use the new names

`preflight-check.js` MUST default its global bluepriNNt directory to `~/.agents/bluepriNNts` (`DEFAULT_BLUEPRINTS_DIR`), MUST accept the flag `--blueprints-dir` in place of `--templates-dir` (the retired flag is unknown and has no alias), and MUST resolve both catalog URLs from the new paths: the Pages URL `innfo/blueprints/catalog.json` and the raw repository path `iNNfo/specs/bluepriNNts/catalog.json`. A legacy frontmatter key found in a domain MUST be reported as a legacy signal and MUST NOT be read as a value.

#### Scenario: New default directory and flag
- **GIVEN** preflight run without `--blueprints-dir`
- **WHEN** it resolves the global bluepriNNt directory
- **THEN** it uses `~/.agents/bluepriNNts`
- **AND** `--templates-dir` is rejected as an unknown flag

#### Scenario: Catalog URLs
- **GIVEN** preflight resolving the bluepriNNt catalog
- **WHEN** it builds its candidate URLs
- **THEN** both use the `blueprints` paths and none uses `templates`

#### Scenario: Legacy key reported, not read
- **GIVEN** a domain whose document carries `model_version`
- **WHEN** preflight runs against it
- **THEN** it reports the domain as legacy with that key among the signals
- **AND** it does not use the key's value for any classification
