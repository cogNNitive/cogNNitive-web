# Apply Progress: NN Level Nomenclature Rename

## Overview
- **Active Slice**: S3 (defiNNition and iNNfo V_0-3-0 additive specifications) -> ready for commit
- **Base Branch**: `dev`
- **Delivery Strategy**: `ask-on-risk`
- **Chain Strategy**: `feature-branch-chain`
- **Strict TDD Mode**: Active

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


