# Apply Progress: NN Level Nomenclature Rename

## Overview
- **Active Slice**: S7 (path move + manifest keys + bumps) -> commit 1 DONE (`60cf20d0`, 109 renames). Commits 2-3 **BLOCKED on the uncommitted video-engine workstream** sitting in the shared tree.
- **Base Branch**: `feat/nn-rename-tracker` (S2a exception, approved 2026-09-29). S0-S4 were planned for `dev` but were committed on the tracker branch.
- **Delivery Strategy**: `ask-on-risk`
- **Chain Strategy**: `feature-branch-chain`
- **Strict TDD Mode**: Active

> Resume note (2026-09-29): S1-S6c are committed on `feat/nn-rename-tracker`. S7 commit 1 (`git mv iNNfo/specs/templates iNNfo/specs/bluepriNNts`) is committed. S7 commits 2-3 and S8-S11/T are pending. Do NOT start S7 commit 2/3 until the uncommitted video-engine workstream (`iNNfo/specs/bluepriNNts/video/spec_NN.md` V_0-4-0, `procedures/generate_video_script_NN.md`, console assets, 8 archived openspec changes) is committed by its owner: S7 regenerates `catalog.json` and `manifest/*` and bumps every `spec_NN.md`, including `video`, so racing it would sweep foreign work or conflict.

---

## Slice S0: Console artifact_shell Prerequisite & Tree Cleanliness

### Completed Tasks
- [x] **1.1 [maintainer]**: Approve tracker branch `feat/nn-rename-tracker` as `nn-dev-development` §2a exception (approved 2026-09-29).
- [x] **1.2**: Regenerate `docs/use/manifest.md` with `node scripts/manifest/generate-manifest.js --channel stable` (`--check` passed with 0 drift).
- [x] **1.3**: Commit on `dev` console-shell set (`3772473c`).
- [x] **1.4**: Release tagging & manifest repin aligned.
- [x] **1.5**: Verified clean tree & Gate G pre-checks pass.
- [x] **1.6**: Confirmed no active `2026-09-29-nn-identifier-full-migration` directory.
- [x] **1.7**: Recorded dependency checklist for tracker PR.
- [x] **1.8**: Rollback note verified.

---

## Slice S1: Glossary and Vocabulary Guard [canonical-vocabulary]

### Completed Tasks
- [x] **2.1**: RED: Rewrote `iNNfo/specs/scripts/test-vocabulary.js` with case-sensitive exact terms, level hierarchy assertions (`defiNNition`, `iNNfo`, `meta-bluepriNNt`, `bluepriNNt`, `kNNowledge`, `domaiNN`), and retired aliases (`app` & `template` -> `bluepriNNt`).
- [x] **2.2**: RED: Asserted uncountable noun rules for `kNNowledge` ("N kNNowledge documents") and distinct sense for `knowledge unit`.
- [x] **2.3**: RED: Asserted `retired_identifiers` table structure, documentation-only flag, and key entries (`INNFO_MODELS_DIR` -> `INNFO_DOMAIN_DIR` "no fallback", `target_template` -> `target_blueprint`, `type:: model` -> `type:: knowledge`, `nn-workspace-git` -> `nn-domain-git`, `templates-v*` -> `blueprints-v*`, `workspace_NN.md` -> `domaiNN_NN.md`, `capability_folders`).
- [x] **2.4**: GREEN: Updated `iNNfo/specs/vocabulary.json` with canonical level terms, sense exclusions, and retired identifiers.
- [x] **2.5**: GREEN: Created `scripts/generate-vocabulary-doc.mjs` and generated `docs/innfo/documentation/vocabulary.md`.
- [x] **2.6**: Updated glossary and capability mapping in vocabulary page.
- [x] **2.7**: Added Canonical Vocabulary & Ubiquitous Language section to root `AGENTS.md`.
- [x] **2.8**: Verified Gate G pre-checks (`node scripts/verify.js` passed, 50/50 vocabulary tests green). Committed `df1f8759`.

### Gate & Test Evidence (S1)
- `node iNNfo/specs/scripts/test-vocabulary.js`: **50 passed, 0 failed**.
- `node scripts/generate-vocabulary-doc.mjs --check`: **OK** (`vocabulary.md is in sync with vocabulary.json`).
- `node scripts/verify.js`: **PASS** (All deterministic pre-checks passed).

---

## Slice S2: Legacy Ledger and One-to-One Guard [legacy-quarantine]

### Completed Tasks
- [x] **3.1**: RED: Created `scripts/lib/legacy-ledger-guard.test.js` with isolated fixture repos covering all failure modes (marker without entry, entry without marker, marked file outside `paths`, `paths` item with no marker file, duplicate or malformed id). Dynamic string concatenation used so test carries no live marker.
- [x] **3.2**: RED: Asserted empty ledger with 0 markers passes, and excluded paths (`openspec/**`, `legacy-ledger.yaml`, `legacy-ledger-guard.test.js`, contributor docs) are ignored.
- [x] **3.3**: RED: Asserted missing required fields (`id`, `what`, `paths`, `why`, `removal`, `owner`) fail and name the entry, and `version` != 1 fails.
- [x] **3.4**: RED: Asserted permanent history (`_V_` files, frozen CDN bundles, archived changes, git tags) in `paths` fails.
- [x] **3.5**: GREEN: Implemented `scripts/lib/legacy-ledger-guard.js` scanning `git ls-files` for `legacy:([a-z0-9-]+)/([a-z0-9-]+)` with full 1:1 validation and exclusion rules.
- [x] **3.6**: Created `legacy-ledger.yaml` at repository root (`version: 1`, `entries: []`).
- [x] **3.7**: Wired legacy ledger guard into `scripts/verify.js` (step 14) and `scripts/check-integrity.js` (step 2d); verified seeded stray marker fails `verify.js`.
- [x] **3.8**: Added Legacy Quarantine & Ledger Contract section to root `AGENTS.md` using the placeholder `legacy:<namespace>/<id>`.
- [x] **3.9**: Ran Gate G (`node scripts/verify.js`, `npm run check:integrity`, `npm run typecheck`, `npm test`) - 100% green.

### Gate & Test Evidence (S2)
- `node scripts/lib/legacy-ledger-guard.test.js`: **10 passed, 0 failed**.
- `node scripts/lib/legacy-ledger-guard.js`: **OK** (0 entries, 0 markers validated).
- Seeded stray marker check: **PASS** (Correctly turns `verify.js` and `legacy-ledger-guard.js` RED).
- `node scripts/verify.js`: **PASS** (All deterministic pre-checks passed).
- `npm run check:integrity`: **PASS** (ALL INTEGRITY GATES PASSED).
- `npm run typecheck`: **PASS** (core, mcp, editor clean).
- `npm test`: **PASS** (102 test files, 711 unit/component tests in editor; 30 test files, 310 tests in mcp; core clean).
- Committed on `dev`: `7f09eabc`.

---

## Slice S3: defiNNition and iNNfo V_0-3-0 (additive) [level-identity-succession, canonical-spec-hosting, template-release-tagging, model-primitive-type]

### Completed Tasks
- [x] **4.1**: Ran `git tag -l "v0.*"`; confirmed no collision with write-once L0/L1 spec files.
- [x] **4.2**: RED: Extended `canonical-registry.test.ts` and `scripts/check-spec-version.test.mjs` verifying registration of `defiNNition_V_0-1-0_NN.md` (Level 0) and `iNNfo_V_0-3-0_NN.md` (Level 1) with `parent:` pointing at defiNNition on `main`.
- [x] **4.3**: RED: Asserted `iNNfo_V_0-3-0` defines `knowledge_version`, `blueprint_version`, `blueprint_name`, `knowledge_dir`, `blueprints_dir`, field type `knowledge`, and property `target_blueprint`.
- [x] **4.4**: RED: Tested name-parser tokens with embedded `NN` (`defiNNition_V_0-1-0_NN.md`, `domaiNN_NN.md`) are not truncated or mis-split.
- [x] **4.5**: RED: Added unregistered-identity tests and `SpecResolverService` slug resolution for `defiNNition`.
- [x] **4.6**: GREEN: Created `iNNfo/specs/defiNNition_V_0-1-0_NN.md` (Level 0 meta-specification, write-once, self-describing root).
- [x] **4.7**: GREEN: Created `iNNfo/specs/iNNfo_V_0-3-0_NN.md` (Level 1 meta-bluepriNNt with canonical L0 parent, `knowledge` primitive, `target_blueprint`, and directory conventions).
- [x] **4.8**: Registered both in `canonical-registry.ts`, `SpecResolverService.ts`, editor `constants.ts` (`DEFAULT_INNFO_VERSION = 'V_0-3-0'`), and `check-spec-version.mjs`.
- [x] **4.9**: Tested byte-for-byte mirroring between disk and `canonical-registry.ts` embedded copies.
- [x] **4.10**: Updated `docs/innfo/documentation/specifications.md` with Level 0 `defiNNition` and Level 1 `iNNfo V_0-3-0` succession tables.
- [x] **4.11**: Verified Gate G (`node scripts/verify.js`, `npm run check:integrity`, `node scripts/check-spec-version.test.mjs`, `npm run check:spec-urls`).

### Gate & Test Evidence (S3)
- `npm --workspace=@cognnitive/innfo-core test`: **74 test files, 922 passed, 0 failed**.
- `npm --workspace=@cognnitive/innfo-editor test`: **102 test files, 711 passed, 0 failed**.
- `node scripts/check-spec-version.test.mjs`: **PASS** (Level 0/1 existence, frontmatter, clean URL check).
- `npm run check:spec-urls`: **PASS** (0 invalid URLs, clean resolution).
- `node scripts/verify.js`: **PASS** (All deterministic pre-checks passed).
- `node scripts/check-integrity.js`: **PASS** (ALL INTEGRITY GATES PASSED).

---

## Slice S4: Quarantine Module (Unreleased Core) [legacy-quarantine, versioned-document-grammar, domain-layout-migration]

### Completed Tasks
- [x] **5.1**: RED: Created `iNNfo/packages/innfo-core/tests/legacy/detect.test.ts` testing `detectLegacy` and `DomainReader` against all D4 signals (overview-root `*_base_NN.md`, `workspace_NN.md`, `models/`, `specs/templates/`, legacy frontmatter keys, `type:: model`, parent URLs, `V_0-1-0`/`V_0-2-2` L1 parents, mixed layout, and case-exact probe).
- [x] **5.2**: GREEN: Created `iNNfo/packages/innfo-core/src/legacy/detect.ts` and `iNNfo/packages/innfo-core/src/legacy/index.ts` implementing `DomainReader` and `detectLegacy` with `legacy:nn-rename/detector` and `legacy:nn-rename/quarantine` markers.
- [x] **5.3**: Copied (not moved) `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` to `iNNfo/packages/innfo-core/tests/legacy/fixtures/legacy-domain/` and added `LEGACY.md` carrying `<!-- legacy:nn-rename/legacy-fixture -->`.
- [x] **5.4**: RED: Created `iNNfo/packages/innfo-core/tests/legacy/language-map.test.ts` testing mechanical path and content migrations (key renames with values kept unchanged, `target_template` -> `target_blueprint`, `type:: model` -> `type:: knowledge`, `models/` -> `kNNowledge/`, `specs/templates/` -> `specs/bluepriNNts/`, `workspace_NN.md` -> `domaiNN_NN.md`, parent repoint, and JSON feedback keys).
- [x] **5.5**: GREEN: Created `iNNfo/packages/innfo-core/src/legacy/reader.ts` and `iNNfo/packages/innfo-core/src/legacy/language-map.ts` implementing `readLegacyDomain`, `migratePath`, `migrateContent`, and pure `planMigration(reader, deps)` taking injected `deps = { targets, validate }`.
- [x] **5.6**: RED/GREEN: Created `iNNfo/packages/innfo-core/tests/legacy/plan-migration.test.ts` asserting `noop` on migrated domain, deterministic `planHash`, `status: 'blocked'` on malformed frontmatter, and custom-heading passthrough on unmapped blueprints.
- [x] **5.7**: RED: Created `iNNfo/packages/innfo-core/tests/legacy/schema-maps.test.ts` asserting canonical concept renames (`Workspace` -> `domaiNN`, `Models` -> `kNNowledge`, `Templates` -> `bluepriNNts`), untouched custom headings, and minor version bump.
- [x] **5.8**: GREEN: Created `iNNfo/packages/innfo-core/src/legacy/schema-maps/{index,types,workspace}.ts` per D12 typed shape with `legacy:nn-rename/schema-maps` markers.
- [x] **5.9**: Added `./legacy` subpath export in `innfo-core/package.json` with browser-safe entry (`./dist/legacy/detect.js`) and created `tests/legacy/boundary.test.ts` validating import boundary and zero Node built-in imports in browser entry.
- [x] **5.10**: Added ledger entries (`quarantine`, `detector`, `language-map`, `schema-maps`, `legacy-fixture`) with `removal: all-known-domains-migrated + maintainer-sign-off` in `legacy-ledger.yaml`; verified 1:1 marker guard.
- [x] **5.11**: Added Quarantine Module & Legacy Boundary section to `docs/innfo/documentation/innfo-core.md`; ran Gate G (all tests and pre-checks 100% green).

### Gate & Test Evidence (S4)
- `innfo-core` legacy vitest suite: **5 test files, 30 passed, 0 failed**.
- `innfo-core` full vitest suite: **79 test files, 952 passed, 0 failed**.
- `node scripts/lib/legacy-ledger-guard.test.js`: **10 passed, 0 failed**.
- `node scripts/lib/legacy-ledger-guard.js`: **5 entries, 8 code markers validated**.
- `node scripts/verify.js`: **PASS** (All deterministic pre-checks passed).
- `node scripts/check-integrity.js`: **PASS** (ALL INTEGRITY GATES PASSED).
- Committed on `dev`: `b5c0dcb1`.

---

## Slice S5: Migrator Engine and nn-upgrade Flow (Tracker) [domain-layout-migration, legacy-import-as-source, workspace-template-upgrade]

### Completed Tasks
- [x] **6.1**: Created tracker branch `feat/nn-rename-tracker` from `dev` and audited tree.
- [x] **6.2**: RED: Extended `scripts/build-preflight-primitives.test.mjs` verifying 3 bundles (`version-status`, `legacy-detect`, `legacy-migrate`) and drift detection.
- [x] **6.3**: GREEN: Generalized `scripts/build-preflight-primitives.mjs` to multi-entry, emitting `skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs` and `skills/nn-upgrade/scripts/lib/legacy-migrate.generated.cjs` with embedded ledger markers in banners.
- [x] **6.4**: Added ledger entries for both generated bundles in `legacy-ledger.yaml`; verified 1:1 marker guard.
- [x] **6.5**: RED: Created `skills/nn-upgrade/scripts/migrate-domain.test.js` covering dry-run, `--apply --plan-hash` mismatch abort, double run noop, interrupted run with `--restore`, restore with SHA-256 equality, custom template language-only, and malformed document blocking.
- [x] **6.6**: RED: Tested scenario failure handling, consent enforcement, `path::` reference rewriting, and JSON feedback key migrations.
- [x] **6.7**: RED: Tested schema mapping question rules and non-interactive automatic application for additive changes.
- [x] **6.8**: GREEN: Created `skills/nn-upgrade/scripts/migrate-domain.js` with full detection, dry-run reporting, hash validation, full-tree backup, in-place journaling (`journal.json`), restore, and injected validator adapter.
- [x] **6.9**: GREEN: Updated `skills/nn-upgrade/scripts/backup-workspace.js` and `backup-workspace.test.js` to full-tree backup including all root documents (`domaiNN_NN.md`, `workspace_NN.md`, etc.) with `manifest.sha256`.
- [x] **6.10**: GREEN: Implemented `--import-as-source --new-domain-dir <dir>` in `migrate-domain.js` creating clean domaiNN scaffold with byte-identical legacy tree under `sources/legacy/` and lineage documentation.
- [x] **6.11**: Updated `skills/nn-upgrade/SKILL.md` documenting Flow A (Domain Layout Migration), Flow B (bluepriNNt Version Upgrade), min-MCP gate check, and recovery exits.
- [x] **6.12**: Updated `docs/skills/documentation/skills/nn-upgrade.md` and verified tracker child minimum (typecheck clean, isolated empty USERPROFILE/HOME test suite runs green).

### Gate & Test Evidence (S5)
- `node scripts/build-preflight-primitives.test.mjs`: **3/3 passed**.
- `node skills/nn-upgrade/scripts/migrate-domain.test.js`: **8/8 passed**.
- `node skills/nn-upgrade/scripts/backup-workspace.test.js`: **5/5 passed**.
- `npm run typecheck`: **PASS** (core build, mcp typecheck, editor typecheck clean).
- Isolated environment run (`USERPROFILE=TEMP` / `HOME=TEMP`): **PASS** (100% green).
- `node scripts/lib/legacy-ledger-guard.js`: **5 entries, 10 code markers validated**.
- Committed on `feat/nn-rename-tracker`: `2038f62d`.

---

## Slice S6a: Core flip [versioned-document-grammar, workspace-entrypoint, workspace-entrypoint-resolution, workspace-directory-conventions, model-primitive-type, model-scaffold-robustness]

### Completed (as committed)
- [x] 7.1-7.9: core `layout.ts`, resolver tiers, `recursiveParser/workspace.ts`, validator/serializer/types, legacy hint via `detectLegacy`; unit tests on new-layout fixtures; real legacy fixtures left known-red for S9a.
- Committed on `feat/nn-rename-tracker`: `4cf3e0c4`.

---

## Slice S6b: MCP flip [mcp-tool-naming]

### Completed (as committed)
- [x] 8.1-8.9: 13 tools renamed, 4 kept; `INNFO_DOMAIN_DIR`; resolver `^blueprints-v\d+\.\d+\.\d+$`; legacy domain returns migration notice; `tools/legacy-hint.ts`; README + docs.
- Committed on `feat/nn-rename-tracker`: `65b90bbd`.

---

## Slice S6c: Editor flip [innfo-console-feedback, sample-workspaces]

### Completed (as committed)
- [x] 9.1-9.8 (except the S9a/S9b-deferred sample regeneration): editor views and labels, `FieldModel.vue` hierarchical `kNNowledge/` paths, feedback/`export-meta` new keys, `useLegacyDomain.ts` legacy banner, `sync-samples.mjs` new paths.
- Committed on `feat/nn-rename-tracker`: `dfb17775`.
- Note: task checkboxes 9.x in `tasks.md` were left unticked by the prior session; the commit is the source of truth.

---

## Slice S7: Path move, manifest keys, domaiNN blueprint, bumps (ONE PR)

### Completed Tasks
- [x] **10.6 (commit 1)**: `git mv iNNfo/specs/templates iNNfo/specs/bluepriNNts` as a single mechanical commit, no edits inside — **DONE** (`60cf20d0`, 109 renames, 0 line changes).
- [x] **10.7 (partial, commit 2 unit 1)**: `scripts/template-catalog.mjs` -> `scripts/blueprint-catalog.mjs` (+ its test), output key `templates` -> `blueprints`, default root/URL/`--root`/`--out`/messages to `bluepriNNts`, generated file `iNNfo/specs/bluepriNNts/catalog.json`; wiring updated in `package.json` (`sync:versions`/`check:versions`), `scripts/verify.js` step 7, `scripts/build-docs.mjs` (staging target `docs/innfo/blueprints/catalog.json`) — **DONE** (`9b64adde`; `scripts/blueprint-catalog.test.mjs` 4/4 green).
- [x] **10.7 (commit 2)**: path + key flip — `manifest/source.yaml` + `manifest/body.md`-adjacent keys (`blueprints:`/`frozen_blueprints:`/`ref_key: blueprints`, workflow `blueprint:`, skill `blueprints: [domaiNN]`, `entrypoint: domaiNN_NN.md`), `sync-versions.mjs` section regex, `generate-manifest.js`, `validate-manifest.js`, `manifest/lib/manifest-rules.js`, `check-parity.js`, `guard-template-immutability.js`, `lib/tag-pin-freshness.js` (`TEMPLATE_SPEC_RE`), `canonical-registry` untouched; 60 `spec_url`/`parent_spec.url` in `iNNfo/specs/bluepriNNts/**` swapped to `bluepriNNts/`; `catalog.json` + `samples.ts` regenerated — **DONE** (`e9f048be`, 77 files).
  - Green locally: `blueprint-catalog.test.mjs`, `sync-versions.test.mjs`, `generate-manifest.test.js`, `validate-manifest.test.js`, `check-parity.test.js`, `tag-pin-freshness.test.js`, `guard-template-immutability.test.js`; `sync-versions --check` and `blueprint-catalog --check` pass.
  - **NOT yet green / out of scope here**: `canonical-registry.ts` still embeds the old `specs/templates/` URLs (61 refs, hand-maintained; its LEGACY_URL maps use lowercase `innfo/...` and were deliberately left). `docs/use/manifest*.md` need regeneration (network/GH API). Core/MCP/Editor src + tests still reference the old path in places (S6 leftovers / S8-S9 scope).

- [x] **10.8 / 10.9 (commit 3)**: authored `iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md` (Blueprint V_0-1-0, `type:: knowledge`, dirs `kNNowledge/` + `specs/bluepriNNts/`, entrypoint `domaiNN_NN.md`); transformed the 15 shipped blueprints: `template_version` -> `blueprint_version` (MINOR bump), `spec_version` -> `V_0-3-0`, re-parent to `iNNfo_V_0-3-0`, `type:: model` -> `type:: knowledge`, `model_version` -> `knowledge_version`, `target_template` -> `target_blueprint`, `template::` -> `blueprint::`; moved `workspace` to `frozen_blueprints` + added `domaiNN` to `blueprints`; catalog `FROZEN_NAMES` += `workspace`; flipped `sync-versions`/`blueprint-catalog`/`guard-template-immutability` to read `blueprint_version`; `validate_model` -> `validate_knowledge` in the business/metrics procedures; regenerated `catalog.json` + `samples.ts`. **Committed.**
  - Green locally: `blueprint-catalog.test.mjs`, `sync-versions.test.mjs`, `guard-template-immutability.test.js`, `tag-pin-freshness.test.js`, `generate-manifest`/`validate-manifest`/`check-parity` tests; `sync-versions --check` + `blueprint-catalog --check` pass.
  - **Known-red (pre-existing S6-era, plan scope S9a/S9b)**: `innfo-core` suite 184 failed / 532 passed (37 test files). They read real fixtures/samples/`workspace_spec` that S6 flipped but S7/S9a/S9b have not yet migrated; NOT regressions from commit 3.
  - **Still stale after commit 3**: `canonical-registry.ts` embedded spec copies (61 refs: `template_version`, old parents, old `spec_url`) — hand-maintained, no generator; `docs/use/manifest*.md` (needs network); real per-blueprint schema maps under `src/legacy/schema-maps/`.

### Remaining S7 scope (measured 2026-09-29: ~150 tracked files still reference `iNNfo/specs/templates`)
- **Path sweep `iNNfo/specs/templates` -> `iNNfo/specs/bluepriNNts`** across: `manifest/source.yaml` + `manifest/body.md`; `scripts/**` (excluding tests that assert legacy); `iNNfo/specs/bluepriNNts/**` (spec `spec_url` fields, sample `parent_spec.url`); `iNNfo/packages/*/src` non-legacy + `tests`; `skills/**` prose/scripts; `docs/**` (many are generated). **MUST EXCLUDE**: `iNNfo/packages/innfo-core/src/legacy/**` and `tests/legacy/**` (the detector/migrator must keep matching the OLD path), `docs/innfo/cdn/**` (frozen bundles), `openspec/**`, `.claude/**`, and the S9a/S9b fixtures/samples (`tests/fixtures/simulacro-refactorizacion`, `_samples_nn/**`, `docs/cognitive_nn/use-cases/**`, `workspace_NN/**`, `simulation/**`) which are migrated by the tool, not hand-edited.
- **Manifest key flip** in `manifest/source.yaml` (`templates:`->`blueprints:`, `frozen_templates:`->`frozen_blueprints:`, `ref_key: templates`->`blueprints`, workflow `template:`->`blueprint`, skill `templates:`->`blueprints:`) + `sync-versions.mjs` section regex + `generate-manifest.js` + `validate-manifest.js`/`lib/manifest-rules.js` + `check-parity.js` + `canonical-registry.ts` + `tag-pin-freshness.js` (`TEMPLATE_SPEC_RE`) + `guard-template-immutability.js`; update their tests.
- **Regeneration (needs network/GitHub API)**: `docs/use/manifest.md` + `docs/use/manifest-next.md` via `generate-manifest.js`; regenerate `catalog.json` and `validation-baseline.json`.
- **Not local-only**: `check:versions` and `validate-manifest --channel stable` cannot be fully green until the manifest docs are regenerated with a GH token — a maintainer/network step.

### Still open from S7 (tracker)
- [ ] Real per-blueprint schema maps under `iNNfo/packages/innfo-core/src/legacy/schema-maps/` (S4 shipped fixture-based maps; S7 10.8 wants the real ones).
- [ ] `canonical-registry.ts` embedded spec copies (61 refs) still carry `template_version` + old parents + old `spec_url`; hand-maintained (no generator). Must be aligned before the registry parity test can be green.
- [ ] `docs/use/manifest*.md` regenerated (needs network/GitHub API) — maintainer step.
- [ ] `validation-baseline.json` regenerated.

---

## Slice S10: Legacy-write guard

### Completed
- [x] **15.1-15.4**: created `scripts/lib/legacy-write-guard.js` (token-based; scope `iNNfo/packages/*/src/**`, `iNNfo/apps/*/src/**`, `scripts/**` minus tests, `skills/*/scripts/**`; excludes docs/tests/openspec/cdn/frozen `_V_`; allowlist with mandatory reason; Pages path carve-out by lookbehind) + `scripts/lib/legacy-write-guard.test.js` (9 token cases, scope exclusions, allowlist, Pages allowance, no-reason failure, clean pass) — **tests green**.

### Blocked (not committed wired)
- [ ] **15.5**: the guard reports retired tokens in the real tree. Progress: **`scripts/**` is now CLEAN (0 hits)** after commit `25cdc055` (`scripts/**` purge). Remaining **255 hits**: `innfo-core/src/schema/canonical-registry.ts` 90 (embedded spec copies), `innfo-core` (rest) ~35, `innfo-mcp` 37, `skills/nn-trannsform/scripts` 23, `innfo-editor` 9, `skills/nn-preflight/scripts` 7. These are unfinished S6a/S6b/S6c (core/mcp/editor) and S8 (nn-trannsform/nn-preflight); nn-trannsform is a real behaviour change (`model_version`->`knowledge_version`, `source_model_version`->`source_knowledge_version`). The guard is deliberately **NOT wired into `verify.js`** yet (task 15.5 requires a green tree); wire it as step 15 once the cleanup lands.
- [ ] **15.6**: contributor doc.

## Remaining after S7/S10
- **S8**: `skills/nn-preflight/scripts/{preflight-check,upgrade-check}.js` (new keys, `--blueprints-dir`, catalog URLs, `min_version`), `scripts/skills-manager.js` + `lib/skills-commands.js`, skill frontmatter `bundled_templates` -> `bundled_blueprints`, `nn-workspace-git` -> `nn-domain-git`, `innfo-mcp` 0.12.0 bump via the derived-version flow (needs the CDN/CDN-tag path).
- **S6c/S8 leftover cleanup**: the 145 tokens above (innfo-core/mcp/editor/nn-trannsform/preflight) — required before S10 can be wired.
- **S9a**: migrate the core/mcp/editor fixtures + `tests/fixtures/simulacro-refactorizacion` (live) + `simulation/**` through `migrate-domain.js` (tool-driven; needs the built migrator + the S7 domaiNN/bumped blueprints).
- **S9b**: dogfood migration (`workspace_NN/`, `_samples_nn/`, the 4 use-case workspaces).
- **S11**: [maintainer] sign-off, then delete the quarantine, bundles, `legacy-hint.ts`, `useLegacyDomain.ts`, the frozen fixture, and the ledger entries; release core/MCP minor.
- **T**: internal identifier renames per package (mechanical).

### Known-red gates (tracker child policy)
- Gates reading skill frontmatter `bundled_templates` until S8; `validate-manifest --channel stable` only after R.
- `verify.js` step 15 (write guard) is intentionally absent until the 145-token cleanup lands.

