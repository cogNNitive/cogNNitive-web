## MODIFIED Requirements

### Requirement: Template Catalog Artifact

A Level-2 bluepriNNt catalog MUST exist as a committed, machine-readable JSON file at `iNNfo/specs/bluepriNNts/catalog.json`. For every canonical bluepriNNt discovered in that tree, the catalog MUST record:

- `name` — the canonical bluepriNNt name (e.g. `business`, `domaiNN`, `documentation`).
- `versions` — the published immutable versions found on disk, each with its blueprint version and the exact `spec_url` used to pin a kNNowledge document to it.
- `adopted` — the published version with the highest blueprint version; this is the version an upgrade targets.

The catalog MUST use the new catalog key `blueprints` (not `templates`). The catalog MUST be produced by a deterministic generator (`scripts/blueprint-catalog.mjs`). The generator MUST exit non-zero with a drift report when invoked with `--check` and the committed `catalog.json` is stale. The catalog MUST NOT include local/specialization bluepriNNts that are not canonical, and MUST NOT list frozen predecessors such as `workspace` as adopted.

#### Scenario: Generator produces and validates the catalog
- GIVEN the canonical bluepriNNts `business` `V_0-2-0` and `V_0-1-0` in the specs tree
- WHEN `scripts/blueprint-catalog.mjs` runs without `--check`
- THEN it writes `catalog.json` where `business.versions` contains both versions
- AND `business.adopted == "V_0-2-0"`

#### Scenario: Drift is detected
- GIVEN a committed `catalog.json` that is missing a newly added bluepriNNt version
- WHEN `scripts/blueprint-catalog.mjs --check` runs
- THEN it exits non-zero and reports the stale entries

#### Scenario: New key only
- GIVEN the generated catalog
- WHEN its top-level keys are read
- THEN it carries `blueprints` and not `templates`

### Requirement: Tier-3 Upgrade Detection Scan

The preflight runner MUST detect bluepriNNt upgrades for a domaiNN without mutating it. When `preflight-check.js` is invoked with `--workspace-dir`, it SHALL:

1. Detect whether the directory is a legacy layout, through the bundled detector `nn-preflight/scripts/lib/legacy-detect.generated.cjs`. If so (verdict `legacy` or `mixed`), it MUST classify the domain `legacy-layout`, report the migration hint pointing to nn-upgrade, and stop per-document classification. The route to nn-upgrade MUST be offered only when the installed MCP is at or above the pinned `min_version` (see `preflight-freshness-reporting`).
2. Otherwise discover all Level-3 kNNowledge documents in the domaiNN (from the knowledge directory and the root).
3. Read each document's `parent_spec.url` (or `spec_url`).
4. Match the bluepriNNt basename against the committed catalog.
5. Classify the document against the catalog's `adopted` version:

   - `current` — the document's bluepriNNt version equals the catalog `adopted` version.
   - `upgrade-available` — a newer published version exists and is the `adopted` version; the bump gap (`major` / `minor` / `patch` per `defiNNition` §7) MUST be reported.
   - `ahead` — the document is pinned to a published version newer than the catalog `adopted` version.
   - `unlisted` — the bluepriNNt is not in the catalog (e.g. a local specialization).

The detection scan MUST be non-mutating and MUST NOT flip the preflight exit code to a blocker. An available upgrade or a legacy-layout classification SHALL be reported as an informational/actionable item, not a blocker. If the catalog cannot be resolved, the scan MUST degrade to an `offline` notice rather than fail the run.

#### Scenario: Document is current
- GIVEN a kNNowledge document pinned to the catalog `adopted` version of `business`
- WHEN the Tier-3 scan runs
- THEN the document is classified `current`
- AND no upgrade is offered

#### Scenario: Document has an upgrade available
- GIVEN a document pinned to `business` `V_0-1-0`
- AND the catalog `adopted` version of `business` is `V_0-2-0`
- WHEN the Tier-3 scan runs
- THEN the document is classified `upgrade-available`
- AND the gap is reported as `minor`
- AND the preflight exit code stays `0`

#### Scenario: Legacy layout routes to migration
- GIVEN a directory with the legacy entrypoint and `models/`
- WHEN the Tier-3 scan runs
- THEN the domain is classified `legacy-layout`
- AND the report points to the domain layout migration in nn-upgrade
- AND the preflight exit code stays `0`

#### Scenario: Catalog is offline
- GIVEN a domaiNN whose catalog cannot be resolved
- WHEN the Tier-3 scan runs
- THEN the scan reports an `offline` notice
- AND does not classify documents as upgrade-available or current

### Requirement: nn-upgrade Guided Migration Skill

The skill `nn-upgrade` MUST own two consent-gated flows: the same-language bluepriNNt version upgrade described here, and the legacy domain layout migration defined by the `domain-layout-migration` capability. The bluepriNNt version upgrade flow MUST, in order:

1. **Detect** — run the Tier-3 upgrade scan and present the per-document classification. A `legacy-layout` result MUST route to the legacy domain layout migration instead of continuing this flow.
2. **Inform & consent** — present `[a] (Recommended) Upgrade / [b] Continue` before any mutation. Consent is mandatory; no file is written without it.
3. **Backup** — create a timestamped backup **outside** the domaiNN (a sibling backup directory or a zip archive). The backup MUST be the same full-tree backup as the layout migration (the whole domain tree excluding `.git` and `node_modules`, with a verified sha256 manifest); `nn-upgrade/scripts/backup-workspace.js` MUST be fixed to cover the full tree, including root documents such as `domaiNN_NN.md`. A manual-backup fallback instruction MUST be shown when the automated backup is unavailable.
4. **Impact analysis** — for each document to migrate, compare the pinned bluepriNNt against the adopted one. Mapping questions MUST be asked **only** when the schema diff removes, renames, or re-types a Concept/Field/Matrix/Marker that the document actually uses. No mapping question MAY be asked for additive or unchanged definitions.
5. **Migrate** — hydrate the adopted bluepriNNt package into the domaiNN (write-once, leaving the pinned frozen bluepriNNt intact), repoint the document's `parent_spec` to the adopted version, bump its `knowledge_version` value, apply the agreed mappings, and re-validate every migrated document through `innfo-mcp`.
6. **Confirm** — present a before/after report (version, gap, mapping decisions, and validation outcome) and close the flow.

The skill MUST NOT touch local specialization bluepriNNts as version-upgrade targets; it MUST report them `unlisted` and direct them to the documented backlog guidance.

#### Scenario: Consent before any mutation
- GIVEN a document classified `upgrade-available`
- WHEN the user runs the `nn-upgrade` flow
- THEN the skill presents `[a] Upgrade / [b] Continue`
- AND no file is written until the user chooses `[a]`

#### Scenario: Backup precedes migration
- GIVEN a user choosing to upgrade
- WHEN the migration phase begins
- THEN a timestamped backup outside the domaiNN is created
- AND every migrated document is re-validated before the flow reports success

#### Scenario: Mapping question is only asked on real impact
- GIVEN a pinned bluepriNNt `V_0-1-0` where the adopted `V_0-2-0` only **adds** a new optional Field
- WHEN the migration runs for a document using no removed/renamed/re-typed definition
- THEN no mapping question is asked
- AND the document is repointed and re-validated

#### Scenario: Legacy layout is not handled by the version-upgrade flow
- GIVEN a domain classified `legacy-layout`
- WHEN the user runs nn-upgrade
- THEN the legacy domain layout migration starts with a dry-run
- AND the version-upgrade steps are not applied
