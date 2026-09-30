## ADDED Requirements

### Requirement: Manifest and catalog use only the new keys

`manifest/source.yaml`, every rendered channel manifest, and the generated bluepriNNt catalog MUST use only the new keys: `blueprints:`, `frozen_blueprints:`, `key: blueprints` for the channel ref, and `bundled_blueprints:` in skill frontmatter. The legacy keys `templates:`, `frozen_templates:`, `key: templates` and `bundled_templates:` MUST NOT appear, and no mirror of the catalog MUST be served at the old catalog URLs.

#### Scenario: Legacy keys absent
- **GIVEN** the source manifest and the rendered stable and preview manifests
- **WHEN** they are searched for `templates:`, `frozen_templates:`, `key: templates` and `bundled_templates:`
- **THEN** none is found

#### Scenario: Generators and parsers agree
- **GIVEN** `validate-manifest --channel stable`, `check-integrity` and `channel-refs.js`
- **WHEN** they run on the new manifest
- **THEN** all pass and read the new keys

#### Scenario: No mirror at the old catalog URL
- **GIVEN** the generated docs output
- **WHEN** the old catalog path `innfo/templates/catalog.json` is looked up
- **THEN** no file is served there
- **AND** the catalog is served at `innfo/blueprints/catalog.json`

### Requirement: The manifest workflow key and field are renamed

In `manifest/source.yaml` the workflow key `model` MUST be `knowledge` and its `template` field MUST be `blueprint`. No reader of the old names MUST remain, because the manifest is regenerated.

#### Scenario: Workflow key renamed
- **GIVEN** the source manifest and the rendered manifests
- **WHEN** the workflow entries are read
- **THEN** the key is `knowledge` with a `blueprint` field
- **AND** no `model` workflow key or `template` field is found

### Requirement: The rendered manifest stays deterministic

The rendered manifest MUST remain a byte-identical function of its committed inputs after the key change, with no timestamp, counter or git-derived value.

#### Scenario: Two renders identical
- **GIVEN** no input change
- **WHEN** the stable manifest is rendered twice
- **THEN** both outputs are byte-identical

### Requirement: Manifest scripts understand the new keys and `min_version`

`scripts/manifest/generate-manifest.js`, `validate-manifest.js` and `check-parity.js` MUST read only the new keys and MUST accept a `min_version` field on the MCP entry: a semver value that is not greater than the pinned version. `docs/use/manifest.md` and `docs/use/manifest-next.md` MUST be regenerated (`--check` on both channels). `scripts/skills-manager.js` and `scripts/lib/skills-commands.js` MUST read only the new manifest keys and the skill frontmatter key `bundled_blueprints`; the frontmatter rename from `bundled_templates` MUST land in the same slice as those parser changes.

#### Scenario: min_version validated
- **GIVEN** an MCP manifest entry with `min_version` greater than its pinned version
- **WHEN** `validate-manifest.js` runs
- **THEN** it fails and names the entry

#### Scenario: min_version accepted and rendered
- **GIVEN** an MCP entry with `min_version: 0.12.0` and a pin at or above it
- **WHEN** the manifest is generated and checked
- **THEN** `min_version` is rendered deterministically and `check-parity.js` passes

#### Scenario: skills-manager reads the new keys only
- **GIVEN** a skill whose frontmatter declares `bundled_blueprints`
- **WHEN** `skills-manager.js` lists the skill's bundled bluepriNNts
- **THEN** it reads that key
- **AND** a skill that still declares `bundled_templates` is reported as not recognised
