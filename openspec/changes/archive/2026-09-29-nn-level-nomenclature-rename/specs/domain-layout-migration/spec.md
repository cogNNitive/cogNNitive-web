## ADDED Requirements

### Requirement: Legacy layout detection is read-only

nn-upgrade MUST detect a legacy domain without writing to it. Detection MUST recognise at least these signals: a legacy key in any frontmatter; `type:: model` in a bluepriNNt; a `models/` folder or `specs/templates/`; a `workspace*.md` or `*_base_NN.md` entrypoint without `domaiNN_NN.md`; a `parent_spec.url` containing `/specs/templates/`; and an L1 parent below `V_0-3-0`. Detection MUST use `detectLegacy` inside the quarantine module and MUST NOT reimplement it.

#### Scenario: Legacy domain detected
- **GIVEN** a domain with the legacy entrypoint, `models/` and `specs/templates/`
- **WHEN** detection runs
- **THEN** the domain is reported legacy with each matching signal listed
- **AND** the file tree is byte-identical afterwards

#### Scenario: Current domain not flagged
- **GIVEN** a domain in the V_0-3-0 layout
- **WHEN** detection runs
- **THEN** no legacy finding is reported

#### Scenario: Mixed layout is reported and blocks migration
- **GIVEN** a domain with both `kNNowledge/` and `models/`
- **WHEN** detection runs
- **THEN** the verdict is `mixed`
- **AND** the report lists the remaining legacy paths
- **AND** `planMigration` returns `status: blocked` and no consent prompt for writes is shown

### Requirement: The migration flow is ordered and consent-gated

The nn-upgrade legacy migration MUST run in this order: (1) detect, (2) dry-run with a report and no writes, (3) ask for consent, (4) out-of-tree backup, (5) language migration, (6) bluepriNNt schema migration, (7) validate, (8) restore from the backup on any failure. No step that writes MAY run before consent and a verified backup. The dry-run MUST print a `planHash`. The write run is `migrate-domain.js --apply --plan-hash <hash>`: it MUST re-plan, and MUST abort without writing when the new hash differs, because the tree changed since the dry-run. `planMigration` is pure: it builds the migrated tree in memory (both layers) and validates it before any write.

#### Scenario: Plan hash mismatch aborts
- **GIVEN** a dry-run that printed a `planHash`
- **AND** a domain file changed after the dry-run
- **WHEN** `--apply --plan-hash <hash>` runs
- **THEN** the re-plan yields a different hash
- **AND** the run aborts with no write

#### Scenario: Dry-run writes nothing
- **GIVEN** a legacy domain
- **WHEN** the dry-run completes
- **THEN** a report is shown
- **AND** every file in the domain and its parent directory is byte-identical to before

#### Scenario: Consent declined
- **GIVEN** the consent prompt
- **WHEN** the user declines
- **THEN** no file is written, moved or deleted

#### Scenario: Steps run in order
- **GIVEN** an accepted migration
- **WHEN** the run is traced
- **THEN** the backup exists before the first domain write
- **AND** language migration completes before schema migration starts
- **AND** validation runs after schema migration

### Requirement: The dry-run report is complete

The dry-run report MUST list: every file to be renamed, moved or rewritten; each custom bluepriNNt that receives only the language layer; each kNNowledge document that would fail validation; each bluepriNNt with no schema map; and the import-as-source alternative with a statement that it loses original identities and version continuity.

#### Scenario: Report enumerates changes and gaps
- **GIVEN** a domain with two custom bluepriNNts and one bluepriNNt without a schema map
- **WHEN** the dry-run report is produced
- **THEN** it names both custom bluepriNNts as language-only
- **AND** it names the unmapped bluepriNNt and offers import-as-source

### Requirement: The backup is out-of-tree and verified

Before the first write, the migration MUST create a timestamped backup of the full domain tree (excluding `.git` and `node_modules`) outside the domain directory, together with a sha256 manifest, and MUST verify the backup against that manifest. The backup MUST NOT reuse the partial `backup-workspace.js` scope, which misses the root documents. If automated backup fails, the manual fallback instruction MUST be shown and the migration MUST NOT continue until the backup is confirmed.

#### Scenario: Backup precedes writes
- **GIVEN** an accepted migration
- **WHEN** the backup step finishes
- **THEN** the backup path is outside the domain
- **AND** it contains every domain file, including `workspace_NN.md` and the other root documents, and its sha256 manifest verifies

#### Scenario: Backup failure stops the run
- **GIVEN** the automated backup fails
- **WHEN** the manual fallback is not confirmed
- **THEN** no domain file is written

### Requirement: Language migration is mechanical and never changes the version value

The language migration MUST apply the language migration map held in the quarantine module: rename the legacy keys to the canonical keys, replace the legacy keyword, rewrite the concept headings, move `models/` to `kNNowledge/` and `specs/templates/` to `specs/bluepriNNts/`, rename the legacy entrypoint to `domaiNN_NN.md`, repoint `parent_spec` to the new bluepriNNt identities, rewrite `path::` references so they still resolve, and rewrite the keys in feedback JSON and `export-meta`. The key renames are: `model_version` to `knowledge_version`, `template_version` to `blueprint_version`, `template_name` to `blueprint_name`, `models_dir` to `knowledge_dir` and `templates_dir` to `blueprints_dir`, plus the bluepriNNt field property `target_template` to `target_blueprint`; the keyword `type:: model` becomes `type:: knowledge`; `Workspace`, `Models` and `Templates` headings become `domaiNN`, `kNNowledge` and `bluepriNNts`, including their wikilinks. The `model_version` value MUST be kept unchanged by this step. A bluepriNNt with no schema map (a custom one) receives only this layer.

#### Scenario: Version value preserved by key rename
- **GIVEN** a kNNowledge document with `model_version: "0.3.1"`
- **WHEN** only the language migration is applied
- **THEN** `knowledge_version` holds `0.3.1`
- **AND** no `model_version` key remains

#### Scenario: Folders, entrypoint and references are consistent
- **GIVEN** a domain whose entrypoint references `models/core_NN.md`
- **WHEN** the language migration completes
- **THEN** the entrypoint is `domaiNN_NN.md`
- **AND** the reference points to the same file under `kNNowledge/`
- **AND** the reference resolves

#### Scenario: Feedback and export-meta keys migrate
- **GIVEN** a feedback JSON file with the legacy `source_model` and `source_model_version` keys
- **WHEN** the language migration runs
- **THEN** the file carries `source_knowledge` and `source_knowledge_version` with the same values

### Requirement: Schema migration bumps the version as nn-upgrade does today

The bluepriNNt schema migration MUST apply the per-bluepriNNt schema map from the document's last legacy bluepriNNt version to the new one, covering heading and field changes. Each map is typed data `legacy/schema-maps/<blueprint>.ts` with `{ blueprint, from: { versions[], canonicalConcepts[] }, to: { name, version }, concepts: { rename, remove }, fields: { rename, retype }, knowledgeBump: 'minor' }`. A heading MUST be treated as canonical if and only if its concept name is in the map's frozen `canonicalConcepts` for the pinned source version; every other heading is custom and MUST be left untouched. This works offline, with no fetch of old tags. The `workspace` to `domaiNN` map carries the concept renames Workspace/Models/Templates to domaiNN/kNNowledge/bluepriNNts, including their wikilinks. For every document that receives a schema migration, it MUST repoint `parent_spec` to the new bluepriNNt version and MUST bump the `knowledge_version` value by the bluepriNNt gap kind, exactly as the nn-upgrade skill bumps `model_version` today when it repoints a document to an adopted bluepriNNt version (`skills/nn-upgrade/SKILL.md`, Phase 4). Because every shipped bluepriNNt receives a MINOR bump in this change, every document governed by a shipped bluepriNNt receives at least a MINOR bump. Mapping questions MUST be asked only when the schema diff removes, renames or re-types a definition the document uses.

#### Scenario: Version bumped by schema migration
- **GIVEN** a document at knowledge version `0.3.1` already carrying `knowledge_version` after language migration
- **WHEN** schema migration applies the map for its bluepriNNt
- **THEN** its version is bumped by the same rule nn-upgrade applied before this change
- **AND** `parent_spec` points to the new bluepriNNt version

#### Scenario: Additive schema change asks nothing
- **GIVEN** a map that only adds an optional field
- **WHEN** schema migration runs on a document that uses no removed or renamed definition
- **THEN** no mapping question is asked

#### Scenario: Removed definition in use asks a question
- **GIVEN** a map that removes a field the document uses
- **WHEN** schema migration runs
- **THEN** a mapping question is asked before that document is changed

### Requirement: Custom bluepriNNts receive the language layer only

A local specialisation bluepriNNt that is not in the catalog MUST receive only the language migration. Its custom headings and definitions MUST be left untouched, no schema map MUST be applied, and the `knowledge_version` value of documents governed only by it MUST NOT be bumped.

#### Scenario: Custom headings survive
- **GIVEN** a custom bluepriNNt with headings not defined by any canonical bluepriNNt
- **WHEN** the migration completes
- **THEN** those headings are byte-identical to before
- **AND** keys and folders are in the new language

### Requirement: Validation gates success and failure restores the backup

After both migration layers are applied, the agent MUST run `validate_knowledge` with `domain: true` through the MCP, and every migrated document MUST round-trip through the serializer. On any failure, the migration MUST restore the domain from the backup so that no partial state remains, and MUST report the backup path and the failing document.

#### Scenario: Failure restores the pre-migration state
- **GIVEN** a document that fails validation after schema migration
- **WHEN** the run ends
- **THEN** the domain is byte-identical to its pre-migration state
- **AND** the report names the failing document and the backup path

Each applied op MUST be journaled to `<backup>/journal.json`, and the journal MUST carry `committed: true` only after validation passes. Restore MUST remove the paths the journal shows as created, copy the backup back, and verify sha256 equality. The migration is applied in place (not by directory swap), because the domain may be a git root, open in the editor or held by a sync client.

#### Scenario: Interrupted run leaves no partial domain
- **GIVEN** a run interrupted after language migration and before validation (a journal without `committed: true`)
- **WHEN** nn-upgrade runs again on the domain
- **THEN** it offers `--restore` before doing anything else
- **AND** the domain is never accepted as migrated

#### Scenario: Restore is verified
- **GIVEN** a failed run with a journal
- **WHEN** `--restore <backup>` completes
- **THEN** the sha256 of every restored file equals the backup manifest
- **AND** no path created by the migration remains

#### Scenario: Migrated domain validates and round-trips
- **GIVEN** a successful migration
- **WHEN** the domain is validated and re-serialized
- **THEN** validation passes and the serializer output is byte-identical to the migrated files

### Requirement: A second run is a no-op

Running the migration on an already migrated domain MUST detect no legacy input, MUST write nothing, and MUST NOT bump any version.

#### Scenario: Double run
- **GIVEN** a domain that was migrated successfully
- **WHEN** nn-upgrade runs again
- **THEN** it reports the domain as current
- **AND** every file is byte-identical to before the second run

### Requirement: Invalid hand-edited input stops at the dry-run

If the dry-run finds a document that is invalid or hand-edited so that the map cannot be applied safely, the migration MUST stop after the report, MUST NOT ask for write consent, and MUST list the problems to fix. The dry-run MUST still be free of writes.

#### Scenario: Broken frontmatter stops the run
- **GIVEN** an entrypoint with malformed frontmatter quoting
- **WHEN** the dry-run runs
- **THEN** the report lists the problem
- **AND** the flow ends without a consent prompt for writes

### Requirement: Domains without local specs fetch the new bluepriNNt by name

For a domain that has no vendored `specs/templates/`, the migration MUST obtain the new bluepriNNt by name through the canonical resolver and hydrate it with `hydrate_blueprint` into `specs/bluepriNNts/`, and MUST NOT depend on the legacy `parent_spec.url` on the default branch resolving. The caller MUST hydrate the targets before planning, and pass them to `planMigration` as `targets: Record<string, { version, spec }>`.

#### Scenario: Hydration by name
- **GIVEN** a legacy domain without local specs
- **WHEN** schema migration needs the target bluepriNNt
- **THEN** it is fetched by name and hydrated write-once into `specs/bluepriNNts/`

### Requirement: Unmigratable input is routed to import-as-source

When a domain cannot validate after migration or contains a bluepriNNt with no schema map, nn-upgrade MUST leave the domain restored and unmodified, and MUST offer the import-as-source exit defined by `legacy-import-as-source`.

#### Scenario: Offer after failure
- **GIVEN** a migration that fails validation and is restored
- **WHEN** the report is shown
- **THEN** import-as-source is offered as an alternative

### Requirement: The migrator runs from generated bundles in nn-upgrade

The migration logic (`legacy/index.ts`, exposing `detectLegacy` and `planMigration`) MUST live only in the core quarantine module. It MUST reach plain JavaScript through generated bundles produced by `scripts/build-preflight-primitives.mjs` in multi-entry mode: `legacy/detect.ts` to `skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs`, and `legacy/index.ts` to `skills/nn-upgrade/scripts/lib/legacy-migrate.generated.cjs`. `verify.js` step 5 MUST drift-check both bundles. `skills/nn-upgrade/scripts/migrate-domain.js` MUST own all I/O. No `migrate_domain` MCP tool MUST exist. The editor MUST NOT migrate in-app: it MUST show a legacy banner with the detector signals and the nn-upgrade command.

#### Scenario: No duplicate legacy knowledge
- **GIVEN** preflight and nn-upgrade
- **WHEN** the repository is searched for legacy key tables
- **THEN** they exist only in the quarantine module and its two generated bundles

#### Scenario: Bundle drift is detected
- **GIVEN** a change to `legacy/detect.ts` without regenerating `legacy-detect.generated.cjs`
- **WHEN** `verify.js` step 5 runs
- **THEN** it fails and names the stale bundle

#### Scenario: Editor points to nn-upgrade
- **GIVEN** the editor opening a legacy domain
- **WHEN** loading completes
- **THEN** it shows the detector signals and the nn-upgrade command
- **AND** it offers no in-app migration

### Requirement: planMigration receives its validator and targets by injection

`planMigration` MUST take its validator and its target bluepriNNt specs as injected dependencies (`deps = { targets, validate }`) and MUST NOT import the core validator, which flips to the V_0-3-0 language in slice S6a. The quarantine unit tests of slices S4 and S5 MUST use minimal fixture targets under the quarantine test fixtures and a stub validator. `migrate-domain.js` MUST supply the validator adapter; the real V_0-3-0 core validator and the hydrated shipped bluepriNNts MUST be wired through this seam only when the real fixtures are migrated (slice S9a).

#### Scenario: Migrator tests do not depend on the core validator
- **GIVEN** the S4 and S5 migrator tests
- **WHEN** the core validator changes to the V_0-3-0 language
- **THEN** those tests are unaffected because they inject a stub validator and fixture targets

#### Scenario: Real validator wired through the seam
- **GIVEN** slice S9a with the domaiNN `V_0-1-0` bluepriNNt and the bumped shipped bluepriNNts available
- **WHEN** a real fixture domain is planned
- **THEN** `deps.validate` is the released core validator and `deps.targets` are the hydrated bluepriNNts
