# Tasks: NN Level Nomenclature Rename (full migration, migrate-first)

## How to apply

- At session start load `nn-dev-development` (`.agents/skills/nn-dev-development/SKILL.md`; the AGENTS.md mandate) and run its concurrency scan before any repo write.
- Branches: S0-S4 commit on `dev`. S5-S9b commit on the approved tracker branch `feat/nn-rename-tracker` (approval recorded in 1.1), with child branches per `chained-pr` / `feature-branch-chain` (child #1 targets the tracker, each later child targets the previous child branch). R, S10, S11 and T follow their own rows below.
- Conventional commits only, no AI attribution lines. Stage by explicit path. Never run `git add -A`, `git add .`, `git stash`, `git reset --hard`, `git clean` or `git checkout .` (the PreToolUse hook blocks them and the tree is shared).
- Strict TDD: every RED task is seen failing for the intended reason before its GREEN task starts.
- Task IDs are `<section>.<n>`. Section numbers are NOT slice numbers; use the table below. "Task 4.14" of `2026-09-27-traceability-vocabulary-unification` (task 1.7 below) is another change's ID.
- `[maintainer]` tasks are owned by the maintainer (tags, pins, sign-offs, merges to `main`); an agent prepares them but does not perform them.

| Section | Slice | Section | Slice |
|---|---|---|---|
| 1 | S0 | 10 | S7 |
| 2 | S1 | 11 | S8 |
| 3 | S2 | 12 | S9a (fixture and sample migration) |
| 4 | S3 | 13 | S9b (dogfood migration) |
| 5 | S4 | 14 | R (release) |
| 6 | S5 | 15 | S10 |
| 7 | S6a | 16 | S11 |
| 8 | S6b | 17 | T |
| 9 | S6c | | |

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~5,500-7,500 total hand-written (S3 copies large spec files; S9a/S9b are tool-generated) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | S0 -> S1 -> S2 -> S3 -> S4 (a/b/c) on `dev`; tracker `feat/nn-rename-tracker`: S5 -> S6a -> S6b -> S6c -> S7 (one PR) -> S8 -> S9a -> S9b (per domain group); R; S10; S11; T (per package) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Decisions pending before apply: (1) maintainer approves the tracker branch as the nn-dev-development section 2a "dedicated branch" exception (repo default is single-branch `dev`); (2) S3 file copies and S9a/S9b generated diffs are `size:exception`-style (reviewed by content equality / migration report, not line by line); (3) S7 is ONE PR (~700 changed lines excluding the `git mv`) because the immutability guard must see the move and the MINOR bumps atomically, so it also carries `size:exception`.

### Per-slice estimate

| Slice | Est. changed lines | Risk | Base branch |
|---|---|---|---|
| S0 | ~100 (already in working tree) | Low | `dev` |
| S1 | ~300 | Low | `dev` |
| S2 | ~300 | Low | `dev` |
| S3 | ~1,400 (mostly copied spec text; two new files) | High (size:exception, byte-equality reviewed) | `dev` |
| S4 | ~1,200 in 3 PRs (4a detector ~350, 4b language map + reader ~450, 4c schema maps + fixture copy ~400) | Medium each | `dev` |
| S5 | ~700 in 2 PRs (5a bundles + build script ~250, 5b migrate-domain + flow ~450) | Medium | tracker |
| S6a | ~450 | Medium | S5 branch |
| S6b | ~400 | Medium | S6a branch |
| S6c | ~350 | Low | S6b branch |
| S7 | ~700 in ONE PR excluding the `git mv` (3 commits: mechanical move; scripts + manifest keys; bumps, re-parent, maps, registration, domaiNN) | Medium (size:exception) | S6c branch |
| S8 | ~450 | Medium | S7 branch |
| S9a | generated; one PR per package group (core, mcp, editor, simulation) | High (exception, reviewed by migration report) | S8 branch |
| S9b | generated; one PR per domain group | High (exception, reviewed by migration report) | S9a branch |
| R | release chores, maintainer-owned | Low | tracker -> dev -> main |
| S10 | ~300 | Low | `dev` |
| S11 | ~700 deletions | Medium | `dev` |
| T | one PR per package, mechanical | Medium | `dev` |

### Suggested Work Units (feature-branch-chain)

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | S1-S4 additive groundwork | PRs on `dev` | Independent, additive; revert-safe |
| 2 | S5 migrator | PR #1, base = tracker | Migrator exists before any reader flips |
| 3 | S6a/b/c reader flips | PR #2..#4, each base = previous PR branch | Flip lands with unit tests on minimal fixtures; real fixtures move in S9a |
| 4 | S7 path move, keys, bumps | PR #5, base = previous | Move + bumps + key rename in one PR; registration in the same commit |
| 5 | S8 preflight + skills | PR #6, base = previous | Min-MCP pin, skills-manager |
| 6 | S9a fixture and sample migration | PR #7.. per package group | Needs domaiNN V_0-1-0 and bumped bluepriNNts from S7 |
| 7 | S9b dogfood migration | PR #8.. per domain group | Generated diffs |
| 8 | R release | tracker -> `dev` -> `git push origin dev:main` | Merge, then tag, then pin |
| 9 | S10, S11, T | PRs on `dev` | S11 only after maintainer sign-off |

### Gate commands (repo-verified; there is no `iNNfo/package.json`, workspaces live in the root `package.json`)

- Build core first: `npm --workspace=@cognnitive/innfo-core run build`. Typecheck: `npm run typecheck`. Tests: `npm test` (core, mcp, editor). Coverage: `npm run test:coverage`. Lint: `npm run lint`. Format: `npm run format:check` (informational, zero NEW drift only).
- Script and skill suites: `node scripts/verify.js`, `node scripts/check-integrity.js` (`npm run check:integrity`).
- Repo scripts: `npm run check:spec-version`, `npm run check:spec-urls`, `npm run check:versions`, `npm run check:samples`, `npm run sync:versions`. After S7 the catalog script is `scripts/blueprint-catalog.mjs` and the `sync:versions` / `check:versions` scripts call it.
- Journeys: `node simulation/run-all.mjs` (8 simulacro journeys).
- Manifest: `node scripts/manifest/validate-manifest.js --channel stable` (see the tracker gate policy for when it may run).

### Tracker gate policy

- **Tracker child PR (S5-S9b) minimum:** every test the PR adds or changes is green, `npm run typecheck` passes, and the PR states its known-red gates (listed under each tracker slice below). Known-red items must be fixable by a later tracker slice, never by a hidden skip.
- **Full Gate G** is REQUIRED green only at the tracker tip before R: (a) build core; (b) `npm test`; (c) `npm run typecheck`; (d) `node scripts/verify.js`; (e) `node scripts/check-integrity.js` including Group 1c tag-pin-freshness; (f) `npm run check:spec-urls` and `npm run check:spec-version`; (g) `npm run check:versions` and `npm run check:samples`; (h) `node simulation/run-all.mjs`; (i) rerun the preflight suites with empty `USERPROFILE` and `HOME`.
- **`validate-manifest --channel stable`** runs only after R's ordering (merge, then tag, then pin). It is not part of any pre-merge gate.
- **`dev` slices (S0-S4, S10, S11, T)** run full Gate G (without the manifest stable check) on each PR.
- Every slice re-audits `git status` for concurrent sessions before any git operation.

Note: the sdd-tasks 530-word budget cannot hold a 17-section, strict-TDD plan; tasks stay one line each.

## 1. S0 Prerequisite: console artifact_shell rename lands, tree clean

- [x] 1.1 [maintainer] Approve the tracker branch `feat/nn-rename-tracker` as the nn-dev-development section 2a exception; record the approval in the S5 PR body. (Approved by maintainer 2026-09-29.)
- [x] 1.2 Regenerate `docs/use/manifest.md` with `node scripts/manifest/generate-manifest.js --channel stable` (or `npm run sync:versions`) so it matches the pending `manifest/source.yaml` change; `--check` must pass.
- [x] 1.3 [maintainer] Commit on `dev` ONLY the console-shell set from `git status` plus the regenerated `docs/use/manifest.md`, staged by explicit path: `artifact_blueprint.html` -> `artifact_shell.html`, `console-blueprint.test.ts` -> `console-shell.test.ts`, `console-dom.test.ts`, `console-thinning.test.ts`, `metrics-console-slot.test.ts`, `iNNfo/specs/templates/{console/feedback.schema.json,business/procedures/apply_feedback_NN.md,metrics/procedures/create_timeline_NN.md,metrics/scripts/verify.harness.js}`, `manifest/source.yaml`, `openspec/specs/innfo-console-runtime/spec.md`, `scripts/export-console.mjs` + test, `skills/nn-innfo/SKILL.md`, `docs/innfo/documentation/offline-consoles.md`. Never stage this change's `openspec/changes/2026-09-29-nn-level-nomenclature-rename/` folder or any unrelated file; re-run `git status` first, since the list may have changed.
- [x] 1.4 [maintainer] Tag + repin that console release per nn-dev-release (merge first, then tag, then pin).
- [x] 1.5 Verify `git status` is clean and no concurrent agent holds the tree; run Gate G.
- [x] 1.6 Mark `2026-09-29-nn-identifier-full-migration` as superseded (note in its folder or archive it) so two changes do not own the same rename.
- [x] 1.7 Record the dependency checklist in the S5 PR: traceability task 4.14 (before S7), template-procedures-manifest landed (before S6b), three console/editor changes archived (before S6c), `video` and `design-presets` releases landed (before S7).
- [x] 1.8 Rollback note: S0 has no code from this change; nothing to revert.

## 2. S1 Glossary and vocabulary guard [canonical-vocabulary]

- [x] 2.1 RED: rewrite `iNNfo/specs/scripts/test-vocabulary.js` case-sensitive; assert `app` and `template` are deprecated aliases of bluepriNNt and new terms (defiNNition, bluepriNNt, kNNowledge, domaiNN, meta-bluepriNNt) exist. Scenario: `app` and `template` appear as deprecated aliases.
- [x] 2.2 RED: add a test that "knowledge unit" stays a distinct sense and that "N kNNowledge documents" is the plural form.
- [x] 2.3 RED: test the retired-identifier alias table: each entry (paths, keys including `target_template`, tool names, `INNFO_MODELS_DIR` -> `INNFO_DOMAIN_DIR` with "no fallback", tag namespace, entrypoint, `nn-workspace-git` -> `nn-domain-git`, capability-folder mapping) carries its replacement and is documentation only (no runtime consumer reads it).
- [x] 2.4 GREEN: update `iNNfo/specs/vocabulary.json` (retire `app`, alias `template`, add new canonical terms, sense boundaries and the retired-identifier alias table).
- [x] 2.5 GREEN: generate `docs/innfo/documentation/vocabulary.md` from `vocabulary.json` (script committed; drift-checked by `verify.js`); it lists every term with aliases and sense exclusions.
- [x] 2.6 Update the glossary and the openspec-capability-name mapping (capability folders keep their names, D13) in the `docs/innfo/` glossary page.
- [x] 2.7 `iNNfo/AGENTS.md` does not exist: add a pointer to `vocabulary.json` and the vocabulary page in the root `AGENTS.md` instead of creating that file.
- [x] 2.8 Run Gate G. Rollback: revert the commit (additive docs/tests).

## 3. S2 Legacy ledger and one-to-one guard [legacy-quarantine]

- [x] 3.1 RED: create `scripts/lib/legacy-ledger-guard.test.js` with fixture repos in a temp dir; one test per failure mode (marker without entry, entry without marker, marked file outside `paths`, `paths` item with no marker file, duplicate or malformed id). Each seen red first. The test builds marker strings by concatenation (never as one literal), so the test file carries no live marker; the guard also excludes its own test file and the contributor docs.
- [x] 3.2 RED: test that an empty ledger with zero markers passes and that `openspec/**`, the ledger file, the guard's own test file and the contributor docs are excluded from the scan.
- [x] 3.3 RED: test that an entry missing any required field (`id`, `what`, `paths`, `why`, `removal`, `owner`) fails and names the entry id, and that `version` other than `1` fails.
- [x] 3.4 RED: test that permanent history (a tag, a frozen CDN bundle, a `_V_` file, an archived change) listed in an entry's `paths` fails.
- [x] 3.5 GREEN: create `scripts/lib/legacy-ledger-guard.js` scanning `git ls-files` for `legacy:([a-z0-9-]+)/([a-z0-9-]+)`, with the exclusions above.
- [x] 3.6 Create `legacy-ledger.yaml` at the repo root (`version: 1`, `entries: []`).
- [x] 3.7 Wire the guard into `scripts/verify.js` and `scripts/check-integrity.js`; confirm a seeded stray marker turns verify red.
- [x] 3.8 Docs: describe the ledger/marker contract in the contributor docs (`docs/innfo` or `AGENTS.md` pointer); write the marker as the placeholder `legacy:<namespace>/<id>` so the docs carry no live marker.
- [x] 3.9 Run Gate G. Rollback: revert; starts empty so nothing depends on it.

## 4. S3 defiNNition and iNNfo V_0-3-0 (additive) [level-identity-succession, canonical-spec-hosting, template-release-tagging, model-primitive-type]

- [x] 4.1 Run `git tag -l "v0.*"` and record the output (D5). At planning time (2026-09-29) the latest is `v0.10.0` and nothing collides; re-run to confirm. No `v*` tag is cut for the L0/L1 files.
- [x] 4.2 RED: extend `scripts/check-spec-version` tests and `canonical-registry` tests: `defiNNition_V_0-1-0_NN.md` and `iNNfo_V_0-3-0_NN.md` are registered; `iNNfo_V_0-3-0` `parent:` points at defiNNition on `main`; frozen predecessors untouched.
- [x] 4.3 RED: test that `iNNfo_V_0-3-0` defines `knowledge_version`, `blueprint_version`, `blueprint_name`, `knowledge_dir`, `blueprints_dir`, the field type `knowledge` and the `target_blueprint` property (frozen `iNNfo_V_0-1-0` keeps `model` and `target_template`).
- [x] 4.4 RED: name-parser tests: `defiNNition_V_0-1-0_NN.md` and `domaiNN_NN.md` are not truncated or mis-split at the embedded `NN`; grammar-unchanged test: a `# NN Concept Definition` document parses exactly as under `iNNfo_V_0-2-2`.
- [x] 4.5 RED: unregistered-new-identity gate: a new iNNfo version file added without the editor default-version update makes the test suite or `check-spec-version` fail and name the identity; `SpecResolverService` resolves the slug `defiNNition`.
- [x] 4.6 GREEN: create `iNNfo/specs/defiNNition_V_0-1-0_NN.md` (frozen `defiNNe` content under the new noun, write-once).
- [x] 4.7 GREEN: create `iNNfo/specs/iNNfo_V_0-3-0_NN.md` with the new keys, keyword and headings; `parent:` = defiNNition URL on `main`.
- [x] 4.8 Register both in `canonical-registry.ts`, `SpecResolverService.ts`, editor `constants.ts` and `check-spec-version.mjs`; regenerate `validation-baseline.json`.
- [x] 4.9 Add a test asserting `canonical-registry.ts` embedded copies are byte-equal to the on-disk files.
- [x] 4.10 Docs: update `docs/innfo` language-version pages to list the new identities.
- [x] 4.11 Run Gate G (`check:spec-urls` scans `openspec/specs`; write repo slugs as split code spans). Rollback: revert; never delete a tagged `_V_` file.

## 5. S4 Quarantine module (unreleased core) [legacy-quarantine, versioned-document-grammar, domain-layout-migration]

- [x] 5.1 RED (4a): `innfo-core/tests/legacy/detect.test.ts` against a frozen legacy fixture; one test per D4 signal (including the legacy `*_base_NN.md` overview-root entrypoint, the `OVERVIEW_ROOT_RE` case in `recursiveParser/workspace.ts`), plus `current`, `legacy`, `mixed`, and a case-exact probe test (fake `readdir` returning a mis-cased name must fail).
- [x] 5.2 GREEN (4a): create `iNNfo/packages/innfo-core/src/legacy/{index,detect}.ts` with `DomainReader` and `detectLegacy`; every file carries `legacy:nn-rename/<id>`.
- [x] 5.3 Copy (not move) `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` to `iNNfo/packages/innfo-core/tests/legacy/fixtures/legacy-domain/` as the one frozen legacy domain (D9); add a `LEGACY.md` file carrying the ledger marker. The live copy stays in place for `simulacro-user-workspace.test.ts` until S9a.
- [x] 5.4 RED (4b): language-map tests: keys renamed with values kept (`model_version` -> `knowledge_version` value unchanged), `target_template` -> `target_blueprint`, `type:: model` -> `type:: knowledge`, `models/` -> `kNNowledge/`, `specs/templates/` -> `specs/bluepriNNts/`, `workspace_NN.md` -> `domaiNN_NN.md`, `parent_spec` repoint, L1->L0 re-parent, feedback and `export-meta` keys.
- [x] 5.5 GREEN (4b): create `legacy/reader.ts` and `legacy/language-map.ts`; `planMigration(reader, deps)` is pure and takes `deps = { targets, validate }` by injection (not the core validator that flips in S6a); it returns `ready | noop | blocked`, `ops`, `report`, `planHash`.
- [x] 5.6 RED/GREEN (4b): tests for `noop` on a migrated tree, `planHash` stability, `blocked` on invalid kNNowledge, custom-heading passthrough. They use minimal fixture targets under `tests/legacy/fixtures/targets/` and an injected stub validator, never real bluepriNNts or the core validator.
- [x] 5.7 RED (4c): schema-map tests: canonical heading = name in frozen `canonicalConcepts` for the pinned source version; custom headings untouched; `knowledgeBump: 'minor'`; blueprint with no map gets language layer only.
- [x] 5.8 GREEN (4c): create `legacy/schema-maps/<blueprint>.ts` per D12 typed shape, including the `workspace -> domaiNN` concept renames and wikilinks (fixture-target based; real maps for shipped bluepriNNts are completed in S7).
- [x] 5.9 Add the `./legacy` subpath export in `innfo-core/package.json` with a browser-safe entry (detect-only, no Node built-ins) for the editor build; add a vitest that only `legacy/`, MCP `tools/legacy-hint.ts`, editor `useLegacyDomain.ts` and build entries import it, and a test that the browser entry contains no `node:` import.
- [x] 5.10 Add ledger entries (`quarantine`, `detector`, `language-map`, `schema-maps`, `legacy-fixture`) with `removal: all-known-domains-migrated + maintainer-sign-off`; guard green.
- [x] 5.11 Docs: contributor note on the quarantine boundary. Run Gate G. Rollback: revert commits (unreleased, unimported).

## 6. S5 Migrator engine and nn-upgrade flow (tracker) [domain-layout-migration, legacy-import-as-source, workspace-template-upgrade]

- [x] 6.1 Create tracker branch `feat/nn-rename-tracker` from `dev` after 1.1 approval; re-audit the shared tree first.
- [x] 6.2 RED: extend the `build-preflight-primitives` test/`--check` so it expects two extra outputs; verify.js step 5 must go red when either bundle drifts.
- [x] 6.3 GREEN: generalise `scripts/build-preflight-primitives.mjs` to multi-entry; emit `skills/nn-preflight/scripts/lib/legacy-detect.generated.cjs` and `skills/nn-upgrade/scripts/lib/legacy-migrate.generated.cjs`, each carrying its ledger marker in the build BANNER (so the drift check covers it); extend verify.js step 5.
- [x] 6.4 Add ledger entries for both generated bundles.
- [x] 6.5 RED: `skills/nn-upgrade/scripts/migrate-domain.test.js` on a temp copy: dry-run writes nothing, `--apply --plan-hash` mismatch aborts, double run is `noop`, interrupted run (`failAfter` hook) offers `--restore`, restore with sha256 equality, domain without local specs, custom template language-only, invalid kNNowledge blocks. Uses the S4 minimal fixture targets and an injected stub validator.
- [x] 6.6 RED: migrator scenario tests: automated backup failure stops the run and shows the manual fallback (no domain write until confirmed); consent declined writes, moves and deletes nothing; `path::` references are rewritten so they still resolve; feedback JSON and `export-meta` keys migrate.
- [x] 6.7 RED: mapping-question rules: an additive schema change asks nothing; a removed, renamed or re-typed definition in use asks before that document changes.
- [x] 6.8 GREEN: create `skills/nn-upgrade/scripts/migrate-domain.js` (detect, dry-run, consent, full-tree out-of-tree backup + sha256 manifest verified, in-place apply with `journal.json`, restore); it owns all I/O and supplies the injected validator adapter.
- [x] 6.9 RED then GREEN: fix `skills/nn-upgrade/scripts/backup-workspace.js` to the same full-tree backup (root docs such as `domaiNN_NN.md` included); test that a root document is present in the backup; the version-upgrade flow uses it.
- [x] 6.10 RED then GREEN: import-as-source is offered after a validation failure that restores the domain, and for a bluepriNNt with no schema map, with the identity-loss statement; `--import-as-source --new-domain-dir` scaffolds a domaiNN, copies the legacy tree under `sources/`; test the result is a valid domaiNN with Source/Citation lineage path and the legacy domain is byte-identical; no core code and no ledger entry.
- [x] 6.11 Update `skills/nn-upgrade/SKILL.md`: two flows (layout migration, version upgrade), consent order, `legacy-layout` routing, min-MCP gate note, restore and import-as-source exit.
- [x] 6.12 Docs: `docs/skills` nn-upgrade page. Run the tracker child minimum (typecheck, S5 tests, `node scripts/verify.js` steps for the new bundles) plus the empty `USERPROFILE`/`HOME` rerun of the nn-upgrade suites. Known-red gates: none expected.
- [x] 6.13 Rollback: abandon or revert the tracker child PR; main untouched.

## 7. S6a Core flips to the new language and layout [versioned-document-grammar, workspace-entrypoint, workspace-entrypoint-resolution, workspace-directory-conventions, model-primitive-type, model-scaffold-robustness]

- [ ] 7.1 FIRST: inventory `rg -l "specs/templates|~/.agents/templates|INNFO_MODELS_DIR|models/"` (excluding `openspec/**`, `docs/innfo/cdn/**`, `.claude/worktrees/**`, `node_modules/**`, `temp/**`); commit the per-file result under this change as the per-slice checklist. Seed by area at planning time: `workspace_NN/**`, `_samples_nn/**` and `docs/cognitive_nn/use-cases/**` -> S9b; `simulation/**`, core/mcp/editor fixtures -> S9a; `skills/nn-preflight/**`, `skills/nn-upgrade/**`, `skills/nn-start|nn-innfo|nn-trannsform|nn-video-script|nn-design-presets/**` -> S8; `skills/nn-trannsform/scripts/**` and `skills/nn-trannsform/test/**` -> S8; `scripts/**` -> S7/S8; `iNNfo/packages/innfo-core/src/**` -> S6a; `iNNfo/packages/innfo-mcp/src/**` -> S6b; `iNNfo/apps/innfo-editor/src/**` -> S6c; docs -> the slice that owns the code.
- [ ] 7.2 RED: `layout.test.ts`: constants module exports `kNNowledge`, `bluepriNNts`, `domaiNN_NN.md`; case-exact probe rejects mis-cased folders (reported, not accepted); no path literals elsewhere.
- [ ] 7.3 RED: entrypoint tests: exact-name `domaiNN_NN.md`; look-alike files not entrypoints; legacy name (including `*_base_NN.md`) detected not loaded; `index.md` is NOT an entrypoint (warning + root scan); legacy frozen `workspace_spec` parent reported legacy.
- [ ] 7.4 RED: resolver tests for `innfo-core/src/resolver.ts` tiers (domain `specs/bluepriNNts/`, `~/.agents/bluepriNNts/`, skills bundled-blueprints dir): precedence holds; the retired locations (`<domain>/templates/`, `~/.agents/templates/`, skills `templates/`) are not searched and yield a legacy report.
- [ ] 7.5 RED: validator/parser tests: V_0-3-0 document with legacy key (`model_version`, `target_template`, ...) or `type:: model` fails with an explicit issue and value is not read; scaffolds write only new keys and `kNNowledge/`; `ConceptField.target_blueprint` is parsed, aliased and hashed.
- [ ] 7.6 GREEN: create `innfo-core/src/layout.ts`; update `resolver.ts` (tiers near lines 89, 101, 113, 129), `recursiveParser/workspace.ts`, `validator/content.ts`, `serializer.ts`, `types/parser.ts`, `agentModification.ts`, `schema/extract.ts`; keep raw-text round-trip identical.
- [ ] 7.7 GREEN: legacy input to core returns the migration hint via `detectLegacy`, never a parse error, no write.
- [ ] 7.8 Tests that consume real legacy fixtures (core corpus, `roundtrip-fidelity.test.ts`, `simulacro-user-workspace.test.ts`) are NOT edited here; list them as known-red until S9a. Unit tests here use small inline or new-layout fixtures.
- [ ] 7.9 Docs: `docs/innfo` parser and layout pages. Run the tracker child minimum. Known-red gates: core tests and `check:samples` that read real legacy fixtures or samples (cleared in S9a/S9b). Rollback: revert child PR on the tracker.

## 8. S6b MCP flips [mcp-tool-naming]

- [ ] 8.1 Verify `2026-09-27-template-procedures-manifest-and-discovery` has landed; stop if not.
- [ ] 8.2 RED: `innfo-mcp` tests: 13 tools renamed per D6, 4 kept (`get_spec`, `apply_change`, `query_units`, `resolve_sources`); old names respond "tool does not exist" and are not forwarded; envelope ids `innfo-<tool>@1`; args `knowledge_id`, `blueprint_url`, `domain`; list key `knowledge`.
- [ ] 8.3 RED: `INNFO_DOMAIN_DIR` honoured; `INNFO_MODELS_DIR` alone behaves as unset; `INNFO_GLOBAL_DIR` default `~/.agents/bluepriNNts`.
- [ ] 8.4 RED: resolver: regex `^blueprints-v\d+\.\d+\.\d+$` accepted, `templates-v0.17.0` rejected; `dirInRepo` is `iNNfo/specs/bluepriNNts/<base>` with no workspace special case; `ref` is required (no `templates-v<template_version>` default).
- [ ] 8.5 RED: every canonical tool on a legacy domain returns the legacy notice + nn-upgrade pointer, no read-through, no write; no `migrate_domain` tool registered.
- [ ] 8.6 RED: `findModelFile` (or its renamed equivalent) locates nested files recursively (`kNNowledge/subsystems/auth/tokens_NN.md` by name and by relative path); hydration without a version does not silently resolve the `domaiNN` name (versionless-hydrate refusal).
- [ ] 8.7 GREEN: update `innfo-mcp/src/server.ts`, `tools/*.ts`, `resolver-node.ts`; create `tools/legacy-hint.ts` (imports only `detectLegacy`); ledger entry for it.
- [ ] 8.8 Update the MCP `README.md` and tool descriptions to canonical names only (bluepriNNt procedures that name MCP tools are updated in S7 after the path move). MCP test fixtures that are real legacy domains migrate in S9a.
- [ ] 8.9 Docs: `docs/innfo` MCP tool reference. Run the tracker child minimum (rebuild innfo-core before trusting MCP tests). Known-red gates: MCP tests reading real legacy fixtures until S9a. Rollback: revert child PR.

## 9. S6c Editor flips [innfo-console-feedback, sample-workspaces]

- [ ] 9.1 Verify `2026-09-28-three-tier-consoles-and-asynchronous-review`, `2026-09-27-left-sidebar-editor-tree-and-header-views` and `2026-09-27-console-export-slots-and-standalone-pin` are archived; stop if not.
- [ ] 9.2 RED: editor tests (reset fake-indexeddb per test): legacy domain shows a banner with detector signals and the nn-upgrade command, no parse error, no in-app migration (D11); labels use domaiNN / kNNowledge / bluepriNNts.
- [ ] 9.3 RED: `FieldModel.vue`: hierarchical path `kNNowledge/Company_V_0-1-0/projects/alpha/business_01.md` for a concept element, sibling paths do not collide, concept-less fallback `kNNowledge/System_architecture_01.md`; scaffold frontmatter carries `knowledge_version`, `blueprint_name`, `level: 3` and no legacy token.
- [ ] 9.4 RED: console feedback and `export-meta` carry `knowledge` / `knowledge_version` (and `source_knowledge` / `source_knowledge_version`); no `model` keys; filename pattern `{Knowledge}_V_{version}_{slug}_feedback_{YYYYMMDD-HHMMSS}.json`; a legacy meta key is rejected by the schema.
- [ ] 9.5 RED: the editor build bundles the `./legacy` browser-safe entry with no Node built-ins (build smoke test).
- [ ] 9.6 GREEN: update editor views and labels, `config/samples.ts`, `constants.ts`, `scripts/export-console.mjs`, `feedback.schema.json`; create `useLegacyDomain.ts` (ledgered) on the browser-safe entry.
- [ ] 9.7 RED then GREEN: `scripts/sync-samples.mjs` (and `check:samples`) learn the new layout paths; regenerating the editor samples happens in S9a/S9b once their sources are migrated.
- [ ] 9.8 Docs: `docs/innfo` editor and console pages. Run the tracker child minimum. Known-red gates: `check:samples` and editor tests that load the real samples until S9a/S9b. Rollback: revert child PR.

## 10. S7 Path move, manifest keys, domaiNN bluepriNNt, bumps (ONE PR) [template-package-structure, domain-blueprint, manifest-governance, template-release-tagging, release-version-generation, template-immutability-guard, workspace-template-upgrade]

- [ ] 10.1 Verify traceability task 4.14 done and `video`/`design-presets` releases landed; stop if not.
- [ ] 10.2 RED: tests for `blueprint-catalog.mjs` (renamed from `template-catalog.mjs`), `sync-versions`, `guard-template-immutability.js`, `channel-refs.js`, `tag-pin-freshness.js` on new paths/keys: `blueprints:`, `frozen_blueprints:`, `key: blueprints`, catalog at `innfo/blueprints/catalog.json`, no mirror at `innfo/templates/catalog.json`, `ref_key: blueprints`, ref `blueprints-v0.18.0`; `tag-pin-freshness.js` `TEMPLATE_SPEC_RE` matches `iNNfo/specs/bluepriNNts/**/spec_NN.md` and not the old path; `sync-versions --check` fails on a bluepriNNt still carrying `template_version`.
- [ ] 10.3 RED: `scripts/manifest/{generate-manifest,validate-manifest,check-parity}.js` tests on the new keys and workflow key `knowledge` with `blueprint` field (no `model`/`template`); two renders byte-identical; `docs/use/manifest.md` and `docs/use/manifest-next.md` regenerate with `--check` on both channels.
- [ ] 10.4 RED: domaiNN blueprint tests: `bluepriNNts/domaiNN/spec_NN.md` defines domaiNN, kNNowledge (`type:: knowledge`), Tag; default dirs `kNNowledge/`, `specs/bluepriNNts/`; every shipped blueprint has MINOR bump, `blueprint_version`, re-parent to iNNfo V_0-3-0, and a schema map (a shipped blueprint without a map fails CI); unregistered blueprint folder fails the inventory guard.
- [ ] 10.5 RED: wizard workflow rebind: manifest `knowledge` workflow `blueprint` field points at `domaiNN` `V_0-1-0`; `iNNfo/packages/innfo-mcp/src/tools/spec.spec.ts` hydrate fixture pins the `domaiNN` name; hydrate writes `specs/bluepriNNts/domaiNN/V_0-1-0/`; the frozen `workspace` blueprint is listed under `frozen_blueprints:` and is not offered for new domaiNN creation.
- [ ] 10.6 GREEN (commit 1): `git mv iNNfo/specs/templates iNNfo/specs/bluepriNNts` as a single mechanical commit with no edits inside. In the SAME PR update `scripts/lib/tag-pin-freshness.js` `TEMPLATE_SPEC_RE`, `scripts/guard-template-immutability.js`, `scripts/build-docs.mjs` (catalog staging path to `innfo/blueprints/`) and `sync-samples.mjs` path references.
- [ ] 10.7 GREEN (commit 2): rename `scripts/template-catalog.mjs` to `scripts/blueprint-catalog.mjs` and update the `sync:versions` and `check:versions` npm scripts in the same task; flip `sync-versions.mjs`, `channel-refs.js`, `generate-manifest.js`, `validate-manifest.js`, `check-parity.js`, `manifest/source.yaml` (keys `blueprints:`, `frozen_blueprints:`, `key: blueprints`, workflow `knowledge`/`blueprint`) and `canonical-registry.ts`; regenerate `docs/use/manifest*.md`.
- [ ] 10.8 GREEN (commit 3): create `bluepriNNts/domaiNN/spec_NN.md`; bump and re-parent each shipped `spec_NN.md` (`blueprint_version` MINOR, L2->L1 tag pins kept, L1->L0 `parent:` at main, D5) and complete the real schema maps under `legacy/schema-maps/`; register `SHIPPED_TEMPLATE_VERSIONS` and manifest entries in the same commit; add the blueprint `skills/`/`samples/` re-parenting where present.
- [ ] 10.9 Update every `iNNfo/specs/bluepriNNts/*/procedures/*.md` that names MCP tools to the canonical names (new path, after the move); test that each referenced tool name is canonical.
- [ ] 10.10 Add test that frozen `workspace_spec` files remain and are not conformance targets; guard-template-immutability watches the new path and passes on the PR diff (move + bump atomic).
- [ ] 10.11 Docs: `docs/innfo` package structure, tagging and catalog pages; regenerate generated indexes. Run the tracker child minimum. Known-red gates: gates that read skill frontmatter (`bundled_templates`) until S8; `validate-manifest --channel stable` is NOT run here. Intermediate commits of this PR may be red; only the PR head must satisfy the child minimum.
- [ ] 10.12 Rollback: revert the child PR on the tracker; a `_V_` file is never deleted.

## 11. S8 Preflight, skills-manager, skill prose [preflight-freshness-reporting, workspace-template-upgrade]

- [ ] 11.1 RED: `nn-preflight` tests: reads new keys; `mcp-below-minimum` blocker with reinstall command below `min_version`, warning between min and pin; verdict `legacy-layout` routes to nn-upgrade only when MCP >= min; legacy detection via `legacy-detect.generated.cjs`; a legacy frontmatter key is reported as a signal and never read; freshness line and exit-code invariant hold under the new keys; a legacy-only manifest is reported unrecognised.
- [ ] 11.2 RED: preflight paths: `DEFAULT_BLUEPRINTS_DIR` is `~/.agents/bluepriNNts`, flag `--blueprints-dir` replaces `--templates-dir` (old flag unknown, no alias), and both catalog URLs (`innfo/blueprints/catalog.json` on Pages, `iNNfo/specs/bluepriNNts/catalog.json` raw) use the new paths.
- [ ] 11.3 RED: manifest scripts (`generate-manifest.js`, `validate-manifest.js`, `check-parity.js`) accept and validate `min_version` on the MCP entry (semver, `<=` pin; expected `0.12.0`, moves only on tool-surface breaks); `scripts/skills-manager.js` and `scripts/lib/skills-commands.js` read only the new manifest keys and `bundled_blueprints`.
- [ ] 11.4 GREEN: update `skills/nn-preflight/scripts/{preflight-check,upgrade-check}.js`, `scripts/skills-manager.js`, `scripts/lib/skills-commands.js`, the manifest scripts and `manifest/source.yaml` `min_version`; rename skill frontmatter `bundled_templates` to `bundled_blueprints` in every skill that declares it (lands with these parser flips).
- [ ] 11.5 Bump the `innfo-mcp` package version to `0.12.0` and run the repo's derived-version flow (`npm run sync:versions`; core version, dependency range and CDN manifest `latest` are generated, never hand-edited); stage the new CDN bundle for `0.12.0` (frozen bundles untouched).
- [ ] 11.6 Rename skill `nn-workspace-git` to `nn-domain-git`; update skill prose in `nn-innfo`, `nn-start`, `nn-upgrade`, `nn-trannsform` and the bundled bluepriNNt in `nn-innfo`.
- [ ] 11.7 Docs: `docs/skills`, `docs/use`. Run the tracker child minimum plus the empty `USERPROFILE`/`HOME` preflight rerun. Known-red gates: `check:versions` and CDN checks until R pins the refs (stated in the PR body).
- [ ] 11.8 Rollback: revert child PR on the tracker.

## 12. S9a Fixture and sample migration (needs domaiNN V_0-1-0 and the bumped bluepriNNts from S7) [sample-workspaces, domain-layout-migration]

- [ ] 12.1 Wire the released core validator into `migrate-domain.js` through the S4 injection seam (`deps.validate`, `deps.targets` hydrated from the S7 bluepriNNts); the final gate is still `validate_knowledge` via MCP.
- [ ] 12.2 Migrate through `migrate-domain.js` (dry-run report kept, consent, `--apply --plan-hash`, backup path kept) the fixtures core tests consume; update the `roundtrip-fidelity.test.ts` corpus.
- [ ] 12.3 Migrate the live `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` and update `simulacro-user-workspace.test.ts` to it; confirm the frozen copy at `tests/legacy/fixtures/legacy-domain/` is untouched and still the only migrator input.
- [ ] 12.4 Migrate the `innfo-mcp` fixtures that are real legacy domains; migrate the editor samples (`config/samples.ts` sources) and run `npm run sync:samples`.
- [ ] 12.5 Migrate `simulation/**` fixtures and journeys (`simulation/fixtures/acme`, `simulation/scenarios/06-workspace-manifest.mjs`) and regenerate `simulation/results/*`; run `node simulation/run-all.mjs` (8 journeys).
- [ ] 12.6 Confirm the known-red list from S6a/S6b/S6c is cleared: `npm test` (core, mcp, editor) is fully green on the S9a head.
- [ ] 12.7 Docs: `docs/innfo` fixture and simulation notes. Known-red gates: `check:samples` for the use-case samples until S9b. Rollback: restore from the nn-upgrade backup or git.

## 13. S9b Dogfood migration through nn-upgrade (one PR per domain group) [sample-workspaces, domain-layout-migration]

- [ ] 13.1 Correct the malformed frontmatter quoting in `workspace_NN/workspace_NN.md` before its dry-run (the dry-run stops on it).
- [ ] 13.2 For each group (`workspace_NN/`, `_samples_nn/`, the 4 use-case workspaces `docs/cognitive_nn/use-cases/{consulting-sales,freelance-designer,startup-founder,youtube-creator}`): run dry-run, keep the report, consent, `--apply --plan-hash`, keep the backup path.
- [ ] 13.3 Per group: validate with `validate_knowledge` (`domain: true`) and confirm byte-identical round-trip; language layer keeps values, only the schema layer bumps them (MINOR for shipped blueprints).
- [ ] 13.4 Run the 8 simulacro journeys (`simulation/run-all.mjs`) on each migrated domain; run `npm run sync:samples` then `npm run check:samples`.
- [ ] 13.5 Confirm the single frozen fixture under `innfo-core/tests/legacy/fixtures/` remains and no other frozen copy exists.
- [ ] 13.6 Docs: `docs/use` examples reference the new layout. Run the tracker child minimum. Rollback: restore from the nn-upgrade backup or git.

## 14. R Release from the tracker (maintainer-owned)

- [ ] 14.1 [maintainer] Merge `dev` into the tracker; re-audit the tree; run FULL Gate G on the tracker head (build core, `npm test`, `npm run typecheck`, `verify.js`, `check-integrity` including Group 1c tag-pin-freshness, `check:spec-urls`, `check:spec-version`, `check:versions`, `check:samples`, simulation journeys, empty `USERPROFILE`/`HOME` rerun).
- [ ] 14.2 [maintainer] Merge tracker -> `dev`; `git push origin dev:main` (merge commit; never a stash/reset on the shared tree).
- [ ] 14.3 [maintainer] Tag the merged SHA (merge first, then tag): `blueprints-v0.18.0`, `innfo-mcp-v0.12.0`, the Suite tag DERIVED by `channel-refs`/`sync-versions` (the next after the latest existing `v0.10.0`; do not hand-pick a number), `skills-v*`; never retag.
- [ ] 14.4 [maintainer] Pin refs and `min_version` (after the tags exist), regenerate manifest and CDN bundle; only now run `node scripts/manifest/validate-manifest.js --channel stable`, `check-integrity` (Group 1c tag-pin-freshness) and `npm run check:versions`.
- [ ] 14.5 [maintainer] Reinstall skills from R on the maintainer machine; confirm the deploy to Pages.
- [ ] 14.6 [maintainer] Open follow-up change `nn-nomenclature-commercial-web` (commercial web copy, llms.txt, ai-index.yaml).
- [ ] 14.7 Rollback: publish a follow-up release and run `migrate-domain.js --restore <backup>` per domain, or git.

## 15. S10 Legacy-write guard [legacy-quarantine]

- [ ] 15.1 RED: `scripts/lib/legacy-write-guard.test.js`: seeded legacy key (including `target_template`), `type:: model`, `specs/templates`, `workspace_NN.md`, lowercase `knowledge/` and `blueprints/` path literals each fail inside the scan scope outside the allowlist; out of scan scope: vocabulary files, docs, `SKILL.md` prose, tests, `openspec/**`, `docs/innfo/cdn/**`, frozen `_V_` files. Test strings are built by concatenation so the test file is not itself a hit.
- [ ] 15.2 RED: the Pages path `innfo/blueprints/catalog.json` does not trip the `blueprints/` token (explicit Pages path allowance); an unrelated `blueprints/` path literal in a runtime file still fails.
- [ ] 15.3 GREEN: create `scripts/lib/legacy-write-guard.js` (specific tokens, not the word "legacy"). Scan scope is runtime source only: `iNNfo/packages/*/src/**`, `iNNfo/apps/*/src/**`, `scripts/**` excluding tests, `skills/*/scripts/**`. Wire into `verify.js`.
- [ ] 15.4 Record the allowlist with a reason per entry (quarantine module, ledger paths, generated `*.generated.cjs` bundles, the Pages path allowance); an allowlist entry without a reason fails the guard.
- [ ] 15.5 Run the guard against the real tree (not only fixtures); fix each hit or add an allowlist entry with a recorded reason; the guard is green on the tree.
- [ ] 15.6 Docs: contributor note (scope, allowlist, how to add an entry). Run Gate G. Rollback: revert.

## 16. S11 Final cleanup after sign-off [legacy-quarantine]

- [ ] 16.1 [maintainer] Confirm all known workspaces are migrated and give written sign-off; stop otherwise.
- [ ] 16.2 RED: update tests to expect no `./legacy` export, no `detectLegacy`, no hint anywhere (core, MCP, editor, preflight), and `legacy-ledger.yaml` with zero entries plus both guards green; `--import-as-source` still works when invoked explicitly.
- [ ] 16.3 GREEN: delete `innfo-core/src/legacy/`, the two `*.generated.cjs` bundles and their build entries, `legacy-hint.ts`, `useLegacyDomain.ts`, migrator fixtures (including `LEGACY.md`) and the frozen legacy domain; remove the ledger entries and markers; remove the `./legacy` export.
- [ ] 16.4 Verify `rg "legacy:nn-rename/" -g '!openspec/**'` returns nothing (ledger-guard tests build markers by concatenation; the guard excludes its own test file and contributor docs, which use the placeholder form `legacy:<namespace>/<id>`); run Gate G.
- [ ] 16.5 [maintainer] Release core/MCP as a MINOR (not patch): merge, tag, pin.
- [ ] 16.6 Docs: remove legacy-detection mentions. Rollback: revert the cleanup commit (restores the quarantine and entries).

## 17. T Internal identifiers (mechanical, no behaviour change; one PR per package)

- [ ] 17.1 T-core: rename `ParsedModel`, `TemplateSchema`, `extractTemplateSchema`, `ModelDriver` and the `model.ts` / `model-checks.ts` names in `innfo-core`; because these are exported, this PR also updates import sites in `innfo-mcp` and `innfo-editor` (import lines only). Existing tests pass unchanged, no new behaviour; Gate G.
- [ ] 17.2 T-mcp: rename `findModelFile`, `model-io.ts`, `init-model.ts` and remaining `ParsedModel` uses in `innfo-mcp`; Gate G.
- [ ] 17.3 T-editor: rename `modelStore`, `useModelConcepts`, `ModelInfoPanel`, `FieldModel` and `SHIPPED_TEMPLATE_VERSIONS` (plus its consumers `useTemplateVersionNotice`, `config/samples.ts`) in `innfo-editor`; Gate G.
- [ ] 17.4 T-scripts/skills: mechanical renames in `scripts/**` and skill scripts (`TEMPLATE_SPEC_RE`, `DEFAULT_TEMPLATES_DIR`, `templatesDir` options, `provenance-model.js`); Gate G with empty `USERPROFILE`/`HOME`.
- [ ] 17.5 Rollback: revert per package; never mix with S-slices.
