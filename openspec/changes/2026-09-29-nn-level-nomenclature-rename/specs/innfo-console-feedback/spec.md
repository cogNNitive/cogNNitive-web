## MODIFIED Requirements

### Requirement: Feedback JSON Schema

Export files MUST validate against the feedback schema. `meta` MUST carry `source_knowledge` and `source_knowledge_version` (replacing `source_model` and `source_model_version`, following the design D3 rename map; the version value is `V_x-y-z`), `artifact`, `artifact_version`, `exported_at` (ISO-8601 with seconds), `author`, `session_label`/`feedback_slug`, and `viewer`. Each `items[]` entry MUST carry `id` (`fb-NNN`), `kind` (`correction`|`comment`|`new`|`delete`), `target` (`element_id`/`concept`/`element`/`field`/`matrix`), `original`/`proposed`/`comment` as applicable, and `status` (`pending`|`applied`|`rejected`). Filenames MUST match `{Knowledge}_V_{version}_{slug}_feedback_{YYYYMMDD-HHMMSS}.json`. The legacy meta keys MUST be handled only by the language migration map and MUST NOT be accepted by the schema or by the export and apply tooling.

#### Scenario: Valid export validates

- GIVEN a console with draft suggestions and identifier `round-2`
- WHEN exported
- THEN the file validates, carries `source_knowledge` and `source_knowledge_version` and matches the filename pattern

#### Scenario: Malformed item rejected

- GIVEN an item with `kind: rewrite`
- WHEN validated
- THEN validation fails naming the offending `id`

#### Scenario: Legacy meta keys rejected by the schema

- GIVEN a feedback file whose `meta` carries `source_model` and `source_model_version`
- WHEN validated against the schema
- THEN validation fails naming the legacy keys
- AND the migration map is the only path that converts them

### Requirement: Apply Feedback Procedure

The procedure MUST check the source-knowledge version against the current kNNowledge document (staleness: block on mismatch until reviewer confirms), MUST render a diff preview, MUST apply accepted items via `innfo-mcp apply_change`, MUST run `validate_knowledge`, MUST bump the patch version, and MUST regenerate the stable-name console `{Knowledge}_V_{version}_console.html` (stem of the primary kNNowledge document). Timestamped copies SHALL be archive-only. The procedure MUST refer only to canonical tool names (`apply_change` is unchanged).

#### Scenario: Happy-path apply

- GIVEN fresh feedback with two `pending` corrections
- WHEN applied and approved
- THEN the kNNowledge document patch-bumps, validates, and the stable console regenerates

#### Scenario: Stale feedback blocked

- GIVEN feedback pinned to an older source-knowledge version
- WHEN applied
- THEN the run blocks with a staleness report until confirmed

#### Scenario: Failed validation aborts

- GIVEN applied items that break `validate_knowledge`
- WHEN validation runs
- THEN the run aborts with no version bump and no console rewrite

## ADDED Requirements

### Requirement: Console export-meta uses the new keys

The console `export-meta` payload MUST use the keys `knowledge` and `knowledge_version` (following the design D3 rename map). Old feedback files and old `export-meta` blocks MUST be converted only by the migration map.

#### Scenario: export-meta keys
- **GIVEN** a console generated after this change
- **WHEN** its `export-meta` is read
- **THEN** it carries `knowledge` and `knowledge_version` and no `model` or `model_version` key

#### Scenario: Old feedback file in a migrated domain
- **GIVEN** a feedback JSON file that was migrated by nn-upgrade
- **WHEN** it is validated
- **THEN** it passes the current schema
