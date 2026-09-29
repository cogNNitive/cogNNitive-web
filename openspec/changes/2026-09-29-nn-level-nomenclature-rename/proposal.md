# Proposal: NN Level Nomenclature Rename (full migration, migrate-first)

## Why

The level hierarchy uses generic nouns (Template, Model, Workspace) that collide with each other, with ordinary English and with the short-lived `app` term. A vocabulary-only rename would leave every new document writing `template_version`, `model_version`, `type:: model` and `specs/templates/`, so the debt would grow with each new file. The maintainer controls every workspace that has ever been created, so the cheapest safe path is migrate-first. New tooling understands only the new language and layout. Legacy content is detected and migrated, never operated on. All legacy knowledge is quarantined in one registered module that is deleted once migration is complete.

## What Changes

- The vocabulary changes as follows. L0 `defiNNe` becomes defiNNition. L1 stays iNNfo, and its "meta-template" becomes "meta-bluepriNNt". L2 Template/`app` becomes bluepriNNt. L3 Model becomes kNNowledge: the word is uncountable, so write "N kNNowledge documents"; a "knowledge unit" stays a unit inside a kNNowledge. Workspace becomes domaiNN, which is a container, not a subject-area "domain". The L1 primitives (Concept, Field, Matrix and Marker Definition) are not renamed.
- `iNNfo/specs/vocabulary.json` retires `app` and `template` as deprecated aliases. `test-vocabulary.js` is rewritten test-first and searches case-sensitively.
- New write-once identities are added, each at V_0-1-0: `defiNNition_V_0-1-0_NN.md`, a new iNNfo language version `iNNfo_V_0-3-0_NN.md` (its parent is defiNNition), and a `domaiNN` bluepriNNt. The predecessors are frozen.
- iNNfo V_0-3-0 defines the keys `knowledge_version`, `blueprint_version`, `blueprint_name`, `knowledge_dir` and `blueprints_dir`, the field property `target_blueprint` (replacing `target_template`), and a new keyword that replaces `type:: model`. The core, MCP and editor read and write only this language.
- Every shipped bluepriNNt gets a MINOR bump (**BREAKING** in 0.x), is re-parented to iNNfo V_0-3-0, and ships a schema map from its last legacy version.
- The identifiers change as follows. Casing and the tag namespace were decided in design.md (D1, D2) and confirmed by the maintainer on 2026-09-29: NN-cased folders and files, lowercase machine tokens (keys, keyword, tool names, tags, env vars, manifest and catalog keys).

| Surface | Current | Target |
|---|---|---|
| Package path | `iNNfo/specs/templates/` | `iNNfo/specs/bluepriNNts/` |
| Domain spec | `templates/workspace_spec_NN.md` | `bluepriNNts/domaiNN/spec_NN.md` |
| User folders | `models/`, `specs/templates/`, `~/.agents/templates/` | `kNNowledge/`, `specs/bluepriNNts/`, `~/.agents/bluepriNNts/` |
| Entrypoint | `workspace_NN.md` | `domaiNN_NN.md` (exact-name match) |
| Manifest / catalog keys | `templates:`, `frozen_templates:`, `key: templates`, `bundled_templates:` | `blueprints:`, `frozen_blueprints:`, `key: blueprints`, `bundled_blueprints:` |
| Concept headings | `Workspace`, `Models`, `Templates` | `domaiNN`, `kNNowledge`, `bluepriNNts` |
| MCP tools (13 of 17) | `list_models`, `get_template`, `check_workspace`, ... | `list_knowledge`, `get_blueprint`, `check_domain`, ... (no aliases); `get_spec`, `apply_change`, `query_units` and `resolve_sources` are unchanged |
| Env var | `INNFO_MODELS_DIR` (the domain root) | `INNFO_DOMAIN_DIR` (no fallback); `INNFO_GLOBAL_DIR` defaults to `~/.agents/bluepriNNts` |
| Frontmatter and directory keys | `model_version`, `template_version`, `template_name`, `models_dir`, `templates_dir`, `target_template` | `knowledge_version`, `blueprint_version`, `blueprint_name`, `knowledge_dir`, `blueprints_dir`, `target_blueprint`; the keyword `type:: model` becomes `type:: knowledge` |
| Manifest workflow | `workflows[model].template` | `workflows[knowledge].blueprint` |
| Skill | `nn-workspace-git` | `nn-domain-git` (openspec capability folders keep their names) |
| Future tags | `templates-v*` | `blueprints-v<batch>`, continuing the batch sequence (first release `blueprints-v0.18.0`) |

- Migrate-first. No tool-name aliases, no resolver fallback to legacy folders, no dual-read in the editor or MCP, no catalog mirror at the old URLs, no legacy keys in the rendered manifest and no old-URL registry map. When a tool meets a legacy domain, it reports that the domain is legacy and points to nn-upgrade.
- Quarantine. All legacy knowledge lives in `iNNfo/packages/innfo-core/src/legacy/`, and only the detector and the migrator use it. The migrator runs through generated bundles in nn-upgrade (`legacy-migrate.generated.cjs`, plus `legacy-detect.generated.cjs` for nn-preflight); there is no MCP migrate tool. The MCP and the editor import only `detectLegacy`, to produce the migration hint. The module holds:
  - the legacy layout detector;
  - the legacy reader for old iNNfo versions, keys and the old keyword;
  - the language migration map, covering keys, the keyword, headings, `models/` → `kNNowledge/`, `specs/templates/` → `specs/bluepriNNts/`, `workspace_NN.md` → `domaiNN_NN.md`, the `parent_spec` repoint, and the keys in feedback JSON and `export-meta`;
  - the per-bluepriNNt schema maps.
- Legacy ledger. `legacy-ledger.yaml` sits at the repo root (confirmed in design D8). Each entry records id, what, paths, why, removal condition and owning change. Every piece of legacy code carries a `legacy:nn-rename/<id>` marker. A new check-integrity guard enforces a one-to-one match between ledger entries and markers, so a marker without an entry fails, and so does an entry without a marker. The removal condition is "all known workspaces migrated + maintainer sign-off".
- The following are permanent history, not legacy debt: immutable git tags, frozen CDN bundles, old write-once `_V_` spec files and archived openspec changes. None of them is running code, and all of them stay.
- nn-upgrade migrates old kNNowledge in this order:
  1. Detect the legacy layout.
  2. Run a dry-run and show the report, with no writes.
  3. Ask for consent.
  4. Make an out-of-tree backup.
  5. Migrate the language: keys are renamed and values kept. The language migration never changes the `model_version` value: the key is renamed and the value is kept.
  6. Migrate the bluepriNNt schema through its map. This step bumps the version by the bluepriNNt gap kind, exactly as nn-upgrade does today (`skills/nn-upgrade/SKILL.md:99`). Every shipped bluepriNNt receives a MINOR bump in this change, so dogfood documents governed by shipped bluepriNNts WILL be bumped; custom bluepriNNts get no schema migration and no bump.
  7. Validate.
  8. On any failure, restore from the backup, so a migration is never partial.
- Migration edge cases:
  - Custom user templates get only the language layer; their custom headings are untouched.
  - For hand-edited or invalid kNNowledge, the dry-run reports the problems and the migration stops.
  - Domains without local specs fetch the new bluepriNNt by name.
- Fallback exit, "import as source". If a migration cannot validate, or a template has no map, nn-upgrade offers to create a NEW domaiNN. That domaiNN ingests the legacy workspace as a Source through the existing nn-trannsform ingestion, and re-derives kNNowledge with Source/Citation lineage. The tradeoff is that this is re-derivation, not migration: provenance is kept, but the original identities and version continuity are lost. The exit adds no new core code and is not legacy debt, so it survives the cleanup and is the only route left for any legacy workspace found after it.
- Dogfooding migrates `workspace_NN/`, `_samples_nn/` and the 4 use-case workspaces under `docs/cognitive_nn/use-cases/` (consulting-sales, freelance-designer, startup-founder, youtube-creator) through nn-upgrade.
- A final cleanup slice in this change deletes the quarantine module, its markers, its ledger entries and the migrator fixtures.
- The technical docs (`docs/innfo`, `docs/skills`, `docs/use` and the generated docs) are updated in each slice, together with the code that slice touches.
- The internal identifiers (`modelStore`, `ParsedModel`, `SHIPPED_TEMPLATE_VERSIONS`, ...) are renamed in a separate mechanical track that changes no behaviour.

## Capabilities

### New Capabilities
- `level-identity-succession`: defiNNition, iNNfo V_0-3-0 and domaiNN succeed their frozen predecessors, which remain permanent history. New tooling resolves only the new identities.
- `versioned-document-grammar`: the V_0-3-0 keys, keyword and headings are the only form that tooling reads or writes. A document that resolves to an older language version is reported as legacy, with a migration hint.
- `domain-blueprint`: the domaiNN bluepriNNt V_0-1-0, covering its concepts, directory defaults and entrypoint.
- `mcp-tool-naming`: the new tool names are canonical and there are no aliases. A call against a legacy domain returns a migration hint.
- `domain-layout-migration`: the nn-upgrade flow, the language migration map, the per-bluepriNNt schema maps, restore-on-failure and the edge cases.
- `legacy-import-as-source`: the fallback exit, which re-derives a new domaiNN from a legacy workspace ingested as a Source.
- `legacy-quarantine`: the single legacy module, the ledger, the markers, the one-to-one integrity guard, the legacy-write guard and the removal condition.

### Modified Capabilities
- `canonical-vocabulary`: `app` is retired, and the new canonical terms and sense boundaries are added.
- `template-package-structure`: the canonical package path moves, and the domaiNN folder resolves the outlier.
- `canonical-spec-hosting`: registers defiNNition and iNNfo V_0-3-0.
- `template-release-tagging`: adds the new tag namespace. Old tags are permanent history.
- `manifest-governance`: new keys only.
- `workspace-directory-conventions`: `kNNowledge/` and `specs/bluepriNNts/` become the defaults, with no legacy fallback.
- `workspace-entrypoint`: `domaiNN_NN.md` is matched by exact name. Legacy names are only detected.
- `workspace-entrypoint-resolution`: the resolver tiers cover the new layout only.
- `workspace-template-upgrade`: a Tier-3 legacy detection routes to domain-layout migration.
- `model-primitive-type`: the new keyword replaces `type:: model`.
- `preflight-freshness-reporting`: reads the new keys, enforces a minimum MCP version and reports legacy domains.
- `template-immutability-guard`: watches the new path.
- `release-version-generation`: `sync-versions` targets the new keys and paths.
- `model-scaffold-robustness`: scaffolds write only the new keys and folder.
- `innfo-console-feedback`: `export-meta` and feedback use the new keys. The old keys are handled only by the migration map.
- `sample-workspaces`: the samples use the new layout.

## Impact

### Affected areas
- `iNNfo/specs/`: the vocabulary, the new L0/L1 files, and the `templates/` → `bluepriNNts/` move.
- `iNNfo/packages/innfo-core`: the parser, validator, serializer, `recursiveParser/workspace.ts` and `schema/canonical-registry.ts`, plus the new `src/legacy/`.
- `iNNfo/packages/innfo-mcp` (`server.ts`, `tools/resolver-node.ts`) and `iNNfo/packages/innfo-editor` (labels, `config/samples.ts`, `constants.ts`).
- `skills/nn-{innfo,start,preflight,upgrade,trannsform}`, `skills/nn-workspace-git` (renamed to `nn-domain-git`), `manifest/source.yaml`, `scripts/**` (check-integrity) and `legacy-ledger.yaml`.
- The technical docs `docs/innfo`, `docs/skills`, `docs/use` and the generated indexes.
- The dogfood domains.

### Slice plan (chained PRs, each under 400 lines, `feature-branch-chain`)

| Slice | Content | Ships as |
|---|---|---|
| S0 | Prerequisite: the console `artifact_shell` rename lands and the tree is clean | tag + repin |
| S1 | Glossary and vocabulary guard, test-first | docs |
| S2 | `legacy-ledger.yaml` and the one-to-one ledger/marker guard in check-integrity (starts empty) | CI |
| S3 | defiNNition and iNNfo V_0-3-0 files, registries and baseline regeneration (additive). No `v*` tag is cut for these L0/L1 files (D5); the write-once filename is the identity | repin |
| S4 | Quarantine module: detector, legacy reader, language migration map, frozen legacy fixture, all of it ledgered | core (unreleased) |
| S5 | Migrator engine (generated bundles in nn-upgrade, `migrate-domain.js`; no MCP tool), the nn-upgrade flow and the import-as-source exit. `planMigration` takes its validator and targets by injection | tracker |
| S6a/b/c | Flip core / MCP / editor to the new language and layout only; new tool names, entrypoint and env var; legacy → migration hint; editor labels. Unit tests use small fixtures; real fixture migration waits for S9a | tracker |
| S7 | Path move, new manifest and catalog keys (`template-catalog.mjs` becomes `blueprint-catalog.mjs`), domaiNN bluepriNNt, minor bumps and re-parenting, schema maps, `SHIPPED_TEMPLATE_VERSIONS`, tag namespace. One PR, so the immutability guard sees the move and the bumps atomically | tracker |
| S8 | Preflight, skills-manager and skill prose move to the new names and locations; legacy detection routes to nn-upgrade; minimum-MCP pin; `innfo-mcp` `0.12.0` bump | tracker |
| S9a | Fixture and sample migration through nn-upgrade (core, MCP and editor fixtures, the live `simulacro-refactorizacion` copy, `simulation/**`); needs the S7 domaiNN spec and bumped bluepriNNts | tracker |
| S9b | Dogfood migration through nn-upgrade, one PR per domain group | tracker |
| R | S5–S9b are released as one unit from the tracker: MCP minor, CDN bundle, new tags (suite tag derived by the release tooling), repins, `skills-v*` | release |
| S10 | `legacy-write-guard`: blocks legacy tokens outside the quarantine, the ledger and the permanent-history allowlist | CI |
| S11 | Final cleanup after sign-off: delete the quarantine, its markers, its ledger entries and the migrator fixtures (the `./legacy` subpath export is removed, which is breaking for internal consumers). The empty ledger and both guards stay | core/MCP minor |
| T | Internal identifiers, one PR per package, never mixed with S-slices | none |

Choreography rules:
- The migrator exists before any reader flips.
- A reader flip and the migration of the fixtures and samples it consumes ship in the same release unit (the tracker): the flips land in S6, the real migrations in S9a/S9b, and nothing reaches `main` until both are green.
- Tracker gate policy: each child PR keeps the tests it adds or changes green and lists its known-red gates; full Gate G is required only at the tracker tip before R.
- Main never sees a half-flipped state.
- A release is merged, then tagged, then pinned.
- Registration (`SHIPPED_TEMPLATE_VERSIONS` and the manifest entries) goes in the same commit as the change that needs it.

### Follow-up change
`nn-nomenclature-commercial-web` updates the commercial web copy: `docs/index.html`, `use-cases.html/md`, the contact and legal pages, `llms.txt`, `ai-index.yaml` and, if affected, the sitemap. It ships right after release R, because it is positioning copy, not technical accuracy.

### Verification
- The migrator is tested on fixtures for a dry-run, a double run, an interrupted run and a restore, plus custom templates, invalid kNNowledge and domains without local specs.
- Migrated kNNowledge validates and round-trips; the language migration leaves `model_version` values unchanged (key renamed to `knowledge_version`), and only the schema migration bumps them. Because every shipped bluepriNNt gets a MINOR bump, dogfood documents governed by shipped bluepriNNts will be bumped.
- Import-as-source produces a valid domaiNN with lineage.
- Every dogfood domain passes the 8 simulacro journeys after migration.
- Legacy input to the MCP and the editor yields the migration hint, not a parse error.
- The ledger/marker guard and the write guard each fail on a seeded violation.
- Preflight suites are rerun with an empty `USERPROFILE` and `HOME`.
- NN-cased paths are tested for case sensitivity.
- The gates pass: `validate-manifest --channel stable`, `check-integrity`, `check:spec-urls`, `check-spec-version --check-urls`, `blueprint-catalog --check` (`template-catalog --check` until S7 renames it) and `sync-versions --check`; `validate-manifest --channel stable` runs only after release R's merge, tag and pin.

### Rollback
- S1–S4 are additive. Revert the commit; a tagged `_V_` file or tag is never deleted.
- Before release R, abandon or revert the tracker branch; main is untouched.
- After release R, publish a follow-up release and restore the domains from the nn-upgrade backups or with git.
- S11: revert the cleanup commit, which brings back the quarantine and the ledger entries.
- T: revert per package.

### Dependencies
- S0 must land and the tree must be clean.
- `2026-09-27-traceability-vocabulary-unification` task 4.14 must be done before S7.
- `2026-09-27-template-procedures-manifest-and-discovery` must land before S6b.
- These must be archived before S6c: `2026-09-28-three-tier-consoles-and-asynchronous-review`, `2026-09-27-left-sidebar-editor-tree-and-header-views` and `2026-09-27-console-export-slots-and-standalone-pin`.
- The `video` and `design-presets` releases must land before S7.
- This change supersedes `2026-09-29-nn-identifier-full-migration`.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Accepted: external or unknown installs break, since only maintainer-owned workspaces are supported | n/a | None, by decision |
| Accepted: the maintainer's installed old preflight and skills-manager cannot parse the new manifest | High | Reinstall the skills from release R (one-time) |
| Accepted: the commercial site uses the old terms until `nn-nomenclature-commercial-web` ships | High | Ship it right after R |
| A migration corrupts data, citations or links | Med | Dry-run, backup, validation, restore; never a partial migration |
| Legacy knowledge leaks outside the quarantine | Med | The one-to-one ledger/marker guard and the legacy-write guard |
| The cleanup never happens and the ledger rots | Med | A measurable removal condition; S11 is in scope |
| Import-as-source loses identities | Med | Offered only as an exit, and stated in the dry-run |
| The tracker unit is hard to review | Med | Per-package child PRs under 400 lines each |
| NN-cased paths on case-insensitive file systems; a blind replace hits other senses of the words | Med | Casing decided in design; cross-platform tests; a case-sensitive guard and an exclusion list |
| A forgotten repin, a registration gap or concurrent sessions on the shared tree | High | A tag + repin work unit; same-commit registration |

### Success criteria
- [ ] Tooling reads and writes only iNNfo V_0-3-0 and the new layout, and reports legacy domains with a migration hint.
- [ ] Every dogfood domain is migrated through nn-upgrade and validates; the language migration keeps each `model_version` value under the new `knowledge_version` key and only the schema migration bumps it (MINOR gap for every shipped bluepriNNt).
- [ ] The import-as-source exit produces a valid domaiNN with lineage.
- [ ] The ledger/marker guard and the write guard are green.
- [ ] After S11, the quarantine module and its ledger entries are gone and `rg "legacy:nn-rename/"` (excluding `openspec/**`) returns nothing.

### Open decisions for design
All 13 decisions below were resolved in `design.md` and confirmed by the maintainer on 2026-09-29. They are kept here as the original question list.

1. Casing for paths and folders: `bluepriNNts/` and `kNNowledge/`, or lowercase.
2. Tag namespace: `blueprints-v*` or keep `templates-v*`.
3. Spelling of the keyword, and the final key names.
4. How a document's language version is resolved, which drives legacy detection.
5. Confirm V_0-3-0 and the `v*` tag policy for the new L0/L1 files.
6. Final MCP tool names.
7. Where the migrator runs (an MCP tool or an nn-upgrade script), and how preflight, which is plain JS, reaches the core detector without a second legacy copy.
8. Where the ledger lives and its format. After S11, keep the file and guard as empty infrastructure or remove them.
9. `simulation/fixtures/**` and `simulacro-refactorizacion/**`: migrate them to the new layout, or keep a frozen copy only as migrator fixtures that are deleted in S11. Recommended: migrate the journeys and keep one frozen copy under the quarantine tests.
10. The minimum MCP version, and how preflight behaves below it.
11. Whether the editor offers migration in the app or only points to nn-upgrade.
12. The format of the per-bluepriNNt schema maps, and how custom headings are distinguished from canonical ones.
13. The `nn-workspace-git` install identity, and the policy for openspec capability folders (default: keep them).
