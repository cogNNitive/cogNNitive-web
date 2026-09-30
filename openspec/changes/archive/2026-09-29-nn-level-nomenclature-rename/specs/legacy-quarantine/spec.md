## ADDED Requirements

### Requirement: Migrate-first is the only compatibility policy

New tooling MUST refuse legacy input except to detect it and to offer migration. The system MUST NOT provide tool-name aliases, a resolver fallback to legacy folders, dual-read in the editor or MCP, a catalog mirror at the old URLs, legacy keys in the rendered manifest, or an old-URL registry map.

#### Scenario: Resolver does not fall back
- **GIVEN** a domain containing only `models/` and `specs/templates/`
- **WHEN** the resolver looks for knowledge and bluepriNNts
- **THEN** it finds none in those folders
- **AND** it reports the domain as legacy

#### Scenario: Rendered manifest is new-key only
- **GIVEN** the rendered manifest
- **WHEN** it is searched for the legacy manifest keys
- **THEN** none is present

### Requirement: All legacy knowledge lives in one quarantine module

All legacy knowledge MUST live in `iNNfo/packages/innfo-core/src/legacy/`. The module MUST hold the legacy layout detector, the legacy reader for old iNNfo versions, keys and keyword, the language migration map, and the per-bluepriNNt schema maps. Only `legacy/` itself, the MCP `tools/legacy-hint.ts`, the editor `useLegacyDomain.ts` and the build entries of the generated bundles MAY import from it; the MCP and the editor MUST import only `detectLegacy`, through the subpath export `@cognnitive/innfo-core/legacy`. A core vitest MUST enforce this boundary. The internal seams (fingerprint, legacy reader, language map, schema maps) MUST NOT be exported. The `./legacy` export MUST provide a browser-safe entry (detect-only, no Node built-ins) that the editor build uses.

#### Scenario: Import outside the boundary fails
- **GIVEN** a parser or validator module that imports from `src/legacy/`
- **WHEN** the boundary check runs
- **THEN** it fails and names the importing file

#### Scenario: Migrator and detector may import
- **GIVEN** the migrator and the detector
- **WHEN** they import from `src/legacy/`
- **THEN** the boundary check passes

#### Scenario: Editor build uses a browser-safe entry
- **GIVEN** the `./legacy` subpath export
- **WHEN** the editor build bundles it
- **THEN** the bundle contains no Node built-in import (`node:` or bare built-in module names)
- **AND** a test asserts it

### Requirement: A legacy ledger records every piece of legacy code

A `legacy-ledger.yaml` file at the repository root MUST record one entry per piece of legacy code, each with `id` (kebab-case, unique), `what`, `paths` (files or globs), `why`, `removal` and `owner` (this change name), under a top-level `version: 1` and `entries:`. The removal condition MUST be "all-known-domains-migrated + maintainer-sign-off". The ledger MUST exist and be empty before any legacy code is added.

#### Scenario: Ledger starts empty
- **GIVEN** slice S2
- **WHEN** the ledger guard runs
- **THEN** it passes with zero entries and zero markers

#### Scenario: Entry fields required
- **GIVEN** a ledger entry with no removal condition
- **WHEN** the guard runs
- **THEN** it fails and names the entry id

### Requirement: Ledger entries and code markers are in one-to-one correspondence

Every piece of legacy code MUST carry a `legacy:nn-rename/<id>` marker; the marker grammar is `legacy:<namespace>/<id>` (regex `legacy:([a-z0-9-]+)/([a-z0-9-]+)`), with a generic namespace from day one. Generated bundles (`*.generated.cjs`) MUST carry their marker in the build banner, so the bundle drift check covers it, and the frozen legacy fixture MUST carry a `LEGACY.md` marker file. A guard (`scripts/lib/legacy-ledger-guard.js`, run by `verify.js`) MUST scan `git ls-files`, excluding `openspec/**`, the ledger itself, its own test file and the contributor docs that describe the marker (which write it as the placeholder `legacy:<namespace>/<id>`), and MUST fail when any of these holds: (1) a marker has no entry; (2) an entry has no marker; (3) a marked file is not covered by its entry's `paths`; (4) a `paths` item has no marker-bearing file; (5) an id is duplicated or malformed.

#### Scenario: Marked file outside entry paths
- **GIVEN** a file with `legacy:nn-rename/x3` that is not covered by the `paths` of entry `x3`
- **WHEN** the guard runs
- **THEN** it fails and names the file and the entry

#### Scenario: Path with no marker-bearing file
- **GIVEN** an entry whose `paths` item matches no file carrying its marker
- **WHEN** the guard runs
- **THEN** it fails and names the entry and the path

#### Scenario: Duplicate or malformed id
- **GIVEN** two entries with the same id, or an id that is not kebab-case
- **WHEN** the guard runs
- **THEN** it fails and names the id

#### Scenario: Marker without entry
- **GIVEN** a source file with `legacy:nn-rename/x1` and no ledger entry `x1`
- **WHEN** check-integrity runs
- **THEN** it fails and names the marker and file

#### Scenario: Entry without marker
- **GIVEN** a ledger entry `x2` and no marker `x2` in the tree
- **WHEN** check-integrity runs
- **THEN** it fails and names the entry

#### Scenario: Matching pair passes
- **GIVEN** one entry and one marker with the same id
- **WHEN** check-integrity runs
- **THEN** the guard passes

#### Scenario: Guard tests carry no live marker
- **GIVEN** the guard's own test file
- **WHEN** it builds fixture markers
- **THEN** it builds each marker string by concatenation
- **AND** neither the test file nor the contributor docs count as marker-bearing files

### Requirement: A legacy-write guard blocks legacy tokens outside the quarantine

After the migration is released (slice S10), a CI guard (`scripts/lib/legacy-write-guard.js`) MUST fail when legacy tokens appear in runtime source outside the quarantine module and the allowlist. The guard MUST be token-based, not based on the word "legacy" (which already appears in unrelated core files). The tokens are: the legacy keys (`model_version`, `template_version`, `template_name`, `models_dir`, `templates_dir`, `target_template`), `type:: model`, `specs/templates`, `workspace_NN.md`, and the lowercase path literals `knowledge/` and `blueprints/`. The scan scope MUST be runtime source only: `iNNfo/packages/*/src/**`, `iNNfo/apps/*/src/**`, `scripts/**` (excluding tests) and `skills/*/scripts/**`. Vocabulary files, docs, `SKILL.md` prose, tests, `openspec/**`, `docs/innfo/cdn/**` and frozen `_V_` files are out of scan scope. Inside the scope an explicit allowlist MUST cover the quarantine module, the ledger paths and the generated bundles, each entry with a recorded reason (an entry without a reason MUST fail the guard). A Pages path allowance MUST keep `innfo/blueprints/catalog.json` from matching the `blueprints/` token. The guard MUST be run against the real tree, with every hit fixed or allowlisted with a reason. After the cleanup the write guard MUST remain active so the old tokens cannot return.

#### Scenario: Seeded violation fails
- **GIVEN** a runtime file that writes a legacy key name
- **WHEN** the guard runs
- **THEN** it fails and names the file and token

#### Scenario: Lowercase path literal fails
- **GIVEN** a runtime file that builds the path literal `knowledge/` or `blueprints/`
- **WHEN** the guard runs
- **THEN** it fails and names the file and token

#### Scenario: Out-of-scope files are not scanned
- **GIVEN** a frozen CDN bundle, a doc page, a `SKILL.md`, a test file and a frozen `_V_` spec that contain legacy names
- **WHEN** the guard runs
- **THEN** it does not fail for any of them

#### Scenario: Pages path is allowed
- **GIVEN** a runtime file that references `innfo/blueprints/catalog.json`
- **WHEN** the guard runs
- **THEN** it does not fail on the `blueprints/` token

#### Scenario: Allowlist entry needs a reason
- **GIVEN** an allowlist entry without a recorded reason
- **WHEN** the guard runs
- **THEN** it fails and names the entry

#### Scenario: Guard is green on the real tree
- **GIVEN** the repository at slice S10
- **WHEN** the guard runs against the real tree
- **THEN** it passes, and every allowlisted hit carries a recorded reason

### Requirement: Legacy test fixtures are frozen and confined

Exactly one frozen legacy domain, a copy of `simulacro-refactorizacion` made from `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion`, MUST be kept as migrator test input at `iNNfo/packages/innfo-core/tests/legacy/fixtures/legacy-domain/`, carrying a `LEGACY.md` marker file. It MUST be ledgered and deleted with the migrator fixtures at cleanup. The live copy consumed by `simulacro-user-workspace.test.ts` MUST be migrated through nn-upgrade in slice S9a and the test updated. The `simulation/` journeys and fixtures MUST be migrated through nn-upgrade in slice S9a and MUST NOT be kept as frozen copies. Minimal fixture targets used by the quarantine unit tests MAY live under `tests/legacy/fixtures/targets/`.

#### Scenario: Fixture is input, not runtime
- **GIVEN** the frozen legacy fixture
- **WHEN** the runtime tests for core, MCP and editor run
- **THEN** none of them loads the fixture as a supported layout

#### Scenario: Live copy migrated, frozen copy kept
- **GIVEN** the repository after slice S9a
- **WHEN** the two `simulacro-refactorizacion` locations are inspected
- **THEN** the live copy under `tests/fixtures/` is in the new layout and `simulacro-user-workspace.test.ts` passes against it
- **AND** the frozen copy under `tests/legacy/fixtures/legacy-domain/` is still in the legacy layout

### Requirement: The cleanup removes the quarantine after sign-off

The final cleanup slice MUST run only when all known workspaces are migrated and the maintainer has signed off. It MUST delete the quarantine module, its markers, its ledger entries and the migrator fixtures. The `./legacy` subpath export, the generated bundles, `legacy-hint.ts` and `useLegacyDomain.ts` MUST be deleted too. Afterwards, `rg "legacy:nn-rename/"` (excluding `openspec/**`) MUST return no result. The empty ledger, the ledger guard and the write guard MUST be kept: the ledger guard then asserts that no stray markers remain. The cleanup ships as a core/MCP MINOR release, not a patch, because removing the `./legacy` export is technically breaking.

#### Scenario: Cleanup blocked without sign-off
- **GIVEN** at least one known workspace not migrated or no maintainer sign-off
- **WHEN** the cleanup slice is proposed
- **THEN** it does not proceed

#### Scenario: Cleanup result
- **GIVEN** the repository after the cleanup slice
- **WHEN** `rg "legacy:nn-rename/"` runs excluding `openspec/**`
- **THEN** it returns no match (the ledger-guard tests build markers by concatenation and the contributor docs use the placeholder form, so neither is a hit)
- **AND** core, MCP and editor tests pass
- **AND** `legacy-ledger.yaml` exists with zero entries and both guards are green
- **AND** no legacy detection or migration hint exists anywhere in core, MCP, editor or preflight
- **AND** nn-upgrade still runs `--import-as-source` when the user invokes it explicitly for a legacy domain
- **AND** the release is a MINOR bump

### Requirement: Permanent history is not legacy debt

Immutable git tags, frozen CDN bundles, old write-once `_V_` spec files and archived openspec changes MUST NOT be ledgered, MUST NOT carry markers, and MUST NOT be removed by the cleanup.

#### Scenario: Not ledgered
- **GIVEN** the ledger after slice S4
- **WHEN** its paths are read
- **THEN** no entry lists a tag, a frozen bundle, a `_V_` file or an archived change
