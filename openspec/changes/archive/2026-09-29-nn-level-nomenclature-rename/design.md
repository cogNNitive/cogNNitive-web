# Design: NN Level Nomenclature Rename (full migration, migrate-first)

## Context

The proposal is authoritative for scope. This design grounds it in the current code:

- `innfo-mcp/src/server.ts` registers **17** tools in one `TOOL_REGISTRY`, not 14. The newer tools are `apply_change`, `query_units` and `resolve_sources`. Envelope ids follow the tool name (`innfo-<tool>@<major>`).
- `INNFO_MODELS_DIR` is the **domain root** (`ROOT_DIR`), not the models folder.
- The resolver (`resolver-node.ts`) resolves by name first: Tier 1 is `specs/templates/<name>/<V>/`, the global tier is `~/.agents/templates`, and the network package fetch is gated by `^(templates-v|v)\d` with `iNNfo/specs/templates/` hard-coded plus a `workspace` special case.
- Entrypoint discovery (`recursiveParser/workspace.ts`) matches on the prefix `startsWith('workspace')`, with fallbacks to `workspace_01.md`, `workspace_NN.md` and `workspace.md`.
- A document reaches its language version only through the parent chain: L3 `parent_spec` → L2 `parent_spec` (`iNNfo_V_x`) → L1 `parent` (defiNNe). No document declares the version directly.
- Preflight is plain CJS and already gets innfo-core logic from a **generated bundle**: `scripts/build-preflight-primitives.mjs` → `version-status.generated.cjs`. `verify.js` step 5 checks it for drift. This is the precedent for decision 7.
- `nn-upgrade/scripts/backup-workspace.js` copies only `models/`, `specs/`, `sources/nn/`, `procedures/` and `index.md`, so it misses `workspace_NN.md` and the other root documents. That is not safe enough for a rename migration.
- The template channel tag is a batch number (`templates-v0.17.0`), not a template version. `v<x>` tags are shared between iNNfo Suite releases and L0/L1 specs (`template-release-tagging` spec, line 13).
- `canonical-registry.ts` embeds full copies of the template texts, which is a stale-prone fallback.

## Goals / Non-Goals

**Goals:** one quarantined legacy module with a two-function interface; a migration that is atomic from the user's point of view (plan → backup → apply → validate → restore on failure); a ledger/marker guard that fails in both directions; a release where main never sees a half-flipped state.

**Non-Goals:** aliases and dual-read (the proposal forbids them); commercial web copy (follow-up change); renaming internal identifiers (track T).

## Decisions

All 13 decisions are **Confirmed by maintainer (2026-09-29)**.

### D1 Casing

| Option | Tradeoff |
|---|---|
| NN-cased folders and files, lowercase machine tokens | Keeps the brand on the surfaces users see (like `iNNfo/` and `traNNsformations/`). Risk: a mis-cased path works on NTFS/APFS but 404s on Linux CI and GitHub raw. |
| All lowercase (`blueprints/`, `knowledge/`) | Safest, but loses the brand and is inconsistent with the `iNNfo/` root. |
| NN everywhere, including keys | `kNNowledge_version` is hostile to agents and YAML habits. |

**Choice:**
- NN-cased: `iNNfo/specs/bluepriNNts/`, `kNNowledge/`, `specs/bluepriNNts/`, `~/.agents/bluepriNNts/` and `domaiNN_NN.md`.
- Lowercase: keys, the keyword, tool names, tags, env vars, manifest and catalog keys, and the Pages path `innfo/blueprints/catalog.json`.
- Required mitigations:
  - (a) Every path segment comes from one constants module in core (`layout.ts`). No literals elsewhere.
  - (b) A case-exact probe (`readdir` plus a strict `===` on the name) replaces `stat`/`existsSync` wherever layout is resolved, so Windows behaves like Linux and a mis-cased folder is reported, not silently accepted.
  - (c) The S10 write guard also rejects lowercase path literals `knowledge/` and `blueprints/`.
  - (d) CI runs on Linux.

No case-only rename happens: `templates` → `bluepriNNts` is a different word, so `core.ignorecase` does not come into play.

### D2 Tag namespace
**Choice:** `blueprints-v<batch>`, `ref_key: blueprints`. The batch number *continues* the old sequence (the first release is `blueprints-v0.18.0`), so there is never a same-numbered pair across the two namespaces. Resolver regex: `^blueprints-v\d+\.\d+\.\d+$`. `dirInRepo` is always `iNNfo/specs/bluepriNNts/<base>`, with no special case, because domaiNN is an ordinary folder.

**Rejected:** keeping `templates-v*`, which contradicts the vocabulary; restarting at `0.1.0`, which collides numerically with old tags.

### D3 Keyword and keys
**Choice:**
- `type:: model` → `type:: knowledge`. Grammar tokens are lowercase, like `type:: citation`.
- Key renames: `model_version` → `knowledge_version`, `template_version` → `blueprint_version`, `template_name` → `blueprint_name`, `models_dir` → `knowledge_dir`, `templates_dir` → `blueprints_dir`.
- **`target_template` decision:** the field-definition property `target_template` is renamed to `target_blueprint`, for consistency with the other renames (it names the Level-2 noun). The `model-primitive-type` spec follows. The frozen `iNNfo_V_0-1-0` keeps `target_template` as permanent history, and the language map converts it.
- **Manifest workflow decision:** in `manifest/source.yaml` the workflow key `model` becomes `knowledge` and its `template:` field becomes `blueprint` (as `manifest-governance` already specifies). The `workspace-entrypoint-resolution` spec follows: the wizard workflow is `workflows[knowledge].blueprint`, bound to the `domaiNN` bluepriNNt at `V_0-1-0`.
- **Unchanged:** `parent_spec`, `spec_version`, `spec_url`, `level`, `sources_dir`, `skills_dir`. None of them names a level noun, so renaming them would be churn.
- Manifest keys: `blueprints:`, `frozen_blueprints:`, `bundled_blueprints:`. Catalog key: `blueprints`. The catalog generator `scripts/template-catalog.mjs` becomes `scripts/blueprint-catalog.mjs` in S7, and the `sync:versions` / `check:versions` npm scripts change in the same task.

### D4 Language version resolution
**Choice:**
- **Normative:** the language version is the L1 at the end of the parent chain. No explicit key is added, because a second source would drift from the chain.
- **Legacy detection:** an offline structural fingerprint, not a chain resolution. Signals:
  - a legacy key in any frontmatter;
  - `type:: model` in a bluepriNNt;
  - `models/` or `specs/templates/` present;
  - a `workspace*.md` entrypoint without `domaiNN_NN.md`;
  - a `*_base_NN.md` overview-root entrypoint (`OVERVIEW_ROOT_RE` in `recursiveParser/workspace.ts`) without `domaiNN_NN.md`;
  - a `parent_spec.url` containing `/specs/templates/`;
  - an L1 parent below `V_0-3-0`.
- The `*_base_NN.md` name is a **legacy** detection signal only. The new layout recognises exactly one entrypoint name, `domaiNN_NN.md`.
- If both legacy and current signals are present, the verdict is `mixed`, and migration is blocked.

**Rationale:** preflight and the editor must detect legacy offline and cheaply, and a legacy document can point to a URL that still resolves.

### D5 iNNfo V_0-3-0 and tags
**Choice:** confirm `iNNfo_V_0-3-0_NN.md`: a MINOR bump in 0.x, which marks a breaking change. **Do not cut `v0.1.0` or `v0.3.0` tags for L0/L1 files.** `v*` already belongs to iNNfo Suite releases. `git tag -l "v0.*"` was checked on 2026-09-29: the latest is `v0.10.0` and nothing collides (re-run before S3). The write-once filename is the immutable identity. The first containing suite tag (release R) is the release record, and `parent:` URLs keep pointing at main, as they do today. The suite tag at R is **derived** by `channel-refs` / `sync-versions` (the next one after the latest existing `v0.10.0`), never chosen by hand. The `template-release-tagging` delta must amend line 13.

**Rejected:** a new `innfo-spec-v*` namespace. Nothing resolves by it.

### D6 MCP tool names (13 renamed, 4 kept)

| Old | New |
|---|---|
| list_models / read_model / init_model | list_knowledge / read_knowledge / init_knowledge |
| validate_model / validate_model_url | validate_knowledge / validate_knowledge_url |
| get_template / validate_template / list_templates / hydrate_template | get_blueprint / validate_blueprint / list_blueprints / hydrate_blueprint |
| list_template_procedures / list_template_skills | list_blueprint_procedures / list_blueprint_skills |
| sync_workspace_manifest / check_workspace | sync_domain_manifest / check_domain |
| get_spec, apply_change, query_units, resolve_sources | unchanged |

- The name is singular because the noun is uncountable: `list_knowledge`, not `list_knowledges`.
- Argument and payload keys follow the D3 map: `model_id` → `knowledge_id`, `template_url` → `blueprint_url`, `workspace` → `domain`, and the list key `models` → `knowledge`.
- Envelope ids get the new names, at `@1`.
- Env var: **`INNFO_DOMAIN_DIR`**, which corrects the proposal's `INNFO_KNOWLEDGE_DIR` (the variable holds the root). The default of `INNFO_GLOBAL_DIR` becomes `~/.agents/bluepriNNts`.

### D7 Where the migrator runs
**Choice:**
- The logic lives in the core quarantine and reaches plain JS through a generated bundle. `build-preflight-primitives.mjs` is generalised to multi-entry:
  - `legacy/detect.ts` → `nn-preflight/scripts/lib/legacy-detect.generated.cjs`;
  - `legacy/index.ts` → `nn-upgrade/scripts/lib/legacy-migrate.generated.cjs`.
- `verify.js` step 5 drift-checks both, so there is one source and no second copy.
- The nn-upgrade script (`migrate-domain.js`) owns all I/O.
- The MCP and the editor import only `detectLegacy`, through the subpath export `@cognnitive/innfo-core/legacy`, to produce the migration hint.
- The `./legacy` export map has a **browser-safe entry** (detect-only, no Node built-ins) for the editor build, plus the Node entry for MCP and the bundles. A vitest asserts the browser entry has no `node:` import, and an editor build smoke test bundles it.
- `planMigration` receives its validator and target bluepriNNts **by injection** (`deps = { targets, validate }`), not from the core validator that flips in S6a. S4/S5 tests use minimal fixture targets and a stub validator; `migrate-domain.js` supplies the adapter, and the real core validator is wired through the seam in S9a, once the domaiNN V_0-1-0 spec and the bumped bluepriNNts exist (S7).

**Rejected:** a `migrate_domain` MCP tool. It would freeze legacy code into the immutable CDN bundles forever and put migration on the public tool surface.

### D8 Ledger
**Choice:** `legacy-ledger.yaml` at the repo root. It is a repo-wide contract, and its markers span core, skills, scripts and fixtures. Marker grammar: `legacy:<namespace>/<id>`, a generic namespace from day one. **After S11:** keep the empty ledger and both guards. The ledger guard then asserts that no stray markers remain, and the write guard stops the old tokens from coming back (exploration risk 9).

**Marker self-reference:** the guard's own tests build marker strings by concatenation, and the guard excludes its own test file and the contributor docs (which use the placeholder `legacy:<namespace>/<id>`), so `rg "legacy:nn-rename/"` after S11 finds nothing. Generated `*.generated.cjs` bundles carry the marker in the build banner (covered by the bundle drift check). The frozen legacy fixture carries a `LEGACY.md` marker file.

### D9 Fixtures
**Choice:**
- `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion` is consumed by `simulacro-user-workspace.test.ts` (it does not live under `simulation/`). In S4 a **frozen legacy copy** is made at `innfo-core/tests/legacy/fixtures/legacy-domain/` (with a `LEGACY.md` marker); it is ledgered and deleted in S11. The **live copy** is migrated through nn-upgrade and the test updated in S9a.
- The `simulation/` journeys and fixtures (`simulation/fixtures/acme`, the scenarios) are migrated in S9a. All real fixture, sample and journey migrations happen in S9a (after S7), because they need the domaiNN V_0-1-0 spec and the bumped bluepriNNts. The dogfood domains follow in S9b.

### D10 Minimum MCP
**Choice:**
- Add `min_version` to the manifest MCP entry and set it to the MCP minor that release R ships (expected `0.12.0`).
- `min_version` moves only when the tool surface breaks. The pin moves on every release.
- Preflight behaviour:
  - below min: **blocker** `mcp-below-minimum`, with the reinstall command;
  - between min and pin: warning.
- Legacy detection (bundled, local) always runs, but the route to nn-upgrade is offered only once the MCP is at or above min, because the final gate calls `validate_knowledge`.

### D11 Editor
**Choice:** no in-app migration. The editor shows a legacy banner with the detector signals and the nn-upgrade command.

**Rationale:** File System Access handles cannot write an out-of-tree backup, and in-app migration would ship the migrator in a deployed web bundle.

### D12 Schema maps
**Choice:**
- Maps are typed TS data in `legacy/schema-maps/<blueprint>.ts`:
  `{ blueprint, from: { versions[], canonicalConcepts[] }, to: { name, version }, concepts: { rename, remove }, fields: { rename, retype }, knowledgeBump: 'minor' }`.
- A heading is **canonical** if and only if its concept name is in the map's frozen `canonicalConcepts` for the pinned source version. Otherwise it is custom and left untouched.
- This works offline, with no fetch of old tags.
- The `workspace → domaiNN` map carries the concept renames Workspace/Models/Templates → domaiNN/kNNowledge/bluepriNNts, including their wikilinks. The language layer stays at grammar level: keys, keyword, paths, entrypoint, URL repoints, the L1 re-parent, and the feedback and `export-meta` keys.
- A bluepriNNt with no map (a custom one) gets only the language layer.

### D13 nn-workspace-git and capability folders
**Choice:** rename the skill to `nn-domain-git`.
- It is not in `manifest/source.yaml`, so no installs are distributed and renaming is cheap.
- Skill names are lowercase-only, so the NN brand cannot be expressed in the name.
- Keep the openspec capability folders, following the Tanda B precedent, and record the name mapping in the glossary.

### Maintainer rule: `model_version` → `knowledge_version`
- The language layer keeps the value.
- The schema layer bumps it by the bluepriNNt gap kind, as nn-upgrade does today (SKILL.md:99).

The proposal's success criterion "values unchanged" applies to the language layer only. Every shipped bluepriNNt gets a minor bump, so dogfood documents governed by shipped bluepriNNts *will* be bumped (aligned in the specs).

## Architecture

### Quarantine module (deep; two functions)

```ts
// iNNfo/packages/innfo-core/src/legacy/index.ts   legacy:nn-rename/quarantine
export interface DomainReader {             // adapters: Node fs (upgrade, preflight, MCP), editor ModelDriver
  list(dir: string): Promise<string[]>      // exact-case entry names
  read(path: string): Promise<string | null>
}
export function detectLegacy(r: DomainReader): Promise<
  { kind: 'current' } | { kind: 'legacy' | 'mixed'; signals: LegacySignal[]; hint: string }>
export interface PlanDeps {                 // injected: planMigration depends on neither the core validator nor real bluepriNNts
  targets: Record<string, { version: string; spec: string }>   // hydrated by the caller (hydrate_blueprint)
  validate(tree: MigratedTree, targets: PlanDeps['targets']): Problem[]
}
export function planMigration(r: DomainReader, deps: PlanDeps):
  Promise<{ status: 'ready' | 'noop' | 'blocked'; ops: Op[]; problems: Problem[];
            report: MigrationReport; planHash: string }>
// Op = { op: 'move'; from; to } | { op: 'write'; path; content }
```

- The internal seams are not exported and are tested through the interface: the fingerprint, the legacy reader, the language map and the schema maps.
- `planMigration` is pure. It builds the migrated tree in memory and validates it through the injected `deps.validate` against the injected `deps.targets`. Any failure becomes a `problem` and sets `status: blocked`.
- **Dependency inversion.** The quarantine never imports the core validator, which flips to the V_0-3-0 language in S6a. S4/S5 unit tests use minimal fixture targets under `tests/legacy/fixtures/targets/` and a stub validator. `migrate-domain.js` supplies the validator adapter; the real V_0-3-0 core validator and the hydrated S7 bluepriNNts are wired in during S9a, together with the real fixture migrations.
- Import boundary: only `legacy/`, the MCP `tools/legacy-hint.ts`, the editor `useLegacyDomain.ts` and the build entries may import it. A core vitest checks this, and the ledger records it.

### Migration pipeline (`skills/nn-upgrade/scripts/migrate-domain.js`)

```
detect ─► dry-run: planMigration → report + planHash (no writes)
       ─► consent: --apply --plan-hash <h> (re-plan; hash mismatch = tree changed → abort)
       ─► backup: FULL tree (excl. .git, node_modules) out-of-tree + sha256 manifest, verified
       ─► apply ops in place, journaling each op to <backup>/journal.json
       ─► gate: agent runs validate_knowledge(domain:true) via MCP
       ─► failure at any step → restore: remove journal-created paths, copy back, verify sha256
```

| Case | Behaviour |
|---|---|
| Double run | The plan is `noop`. |
| Interrupted run | A journal without `committed: true` makes the next run offer `--restore` before doing anything else. |
| Why in place rather than a directory swap | The domain may be a git root, open in the editor or held by a sync client. In-place edits keep git renames legible. |
| Import-as-source | `--import-as-source --new-domain-dir` scaffolds a domaiNN and copies the legacy tree under `sources/`. The agent then continues with nn-trannsform and nn-innfo. No core code is involved, and none of it is ledgered. |

### Ledger schema and guard (`scripts/lib/legacy-ledger-guard.js`, run by `verify.js`)

```yaml
version: 1
entries:
  - id: detector            # kebab-case, unique
    what: Legacy layout detector
    paths: [iNNfo/packages/innfo-core/src/legacy/detect.ts]   # files or globs
    why: MCP/editor/preflight must recognise legacy domains
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
```

The guard scans `git ls-files`, excluding `openspec/**` and the ledger itself, for `legacy:([a-z0-9-]+)/([a-z0-9-]+)`. It fails when any of the following holds:
1. a marker has no entry;
2. an entry has no marker;
3. a marked file is not covered by its entry's `paths`;
4. a `paths` item has no marker-bearing file;
5. an id is duplicated or malformed.

The S10 write guard is **token-based**: legacy keys (including `target_template`), `type:: model`, `specs/templates`, `workspace_NN.md` and the lowercase path literals. It is not based on the word "legacy", which already appears in 9 core files.

**Scan scope (runtime source only):** `iNNfo/packages/*/src/**`, `iNNfo/apps/*/src/**`, `scripts/**` (excluding tests) and `skills/*/scripts/**`. Out of scan scope: vocabulary files, docs, `SKILL.md` prose, tests, `openspec/**`, `docs/innfo/cdn/**` and frozen `_V_` files. Inside the scope an explicit allowlist covers the quarantine module, the ledger paths and the generated bundles, each entry with a recorded reason. A Pages path allowance keeps `innfo/blueprints/catalog.json` from tripping the `blueprints/` token. The guard is also run against the real tree (task 15.5), not only against fixtures.

## File Changes (per slice)

| Slice | Files |
|---|---|
| S2 | `legacy-ledger.yaml` (C), `scripts/lib/legacy-ledger-guard.js` + test (C), `scripts/verify.js` (M) |
| S3 | `iNNfo/specs/defiNNition_V_0-1-0_NN.md`, `iNNfo_V_0-3-0_NN.md` (C); `canonical-registry.ts`, `SpecResolverService.ts`, `check-spec-version.mjs`, editor `constants.ts`, `validation-baseline.json` (M) |
| S4 | `innfo-core/src/legacy/{index,detect,reader,language-map}.ts`, `schema-maps/*.ts`, `tests/legacy/**` (C, including the frozen copy `tests/legacy/fixtures/legacy-domain/` + `LEGACY.md` and `fixtures/targets/`); `package.json` `./legacy` export with a browser-safe entry (M); ledger entries |
| S5 | `build-preflight-primitives.mjs` (M), both `*.generated.cjs` (C), `nn-upgrade/scripts/migrate-domain.js` + test (C), `backup-workspace.js`, `nn-upgrade/SKILL.md` (M) |
| S6a | core `layout.ts` (C), `resolver.ts` (tiers), `recursiveParser/workspace.ts`, `validator/content.ts`, `serializer.ts`, `types/parser.ts`, `schema/extract.ts`, `agentModification.ts` (M); the per-file inventory checklist |
| S6b | `innfo-mcp/src/server.ts`, `tools/*.ts`, `resolver-node.ts`, `README.md`, `tools/legacy-hint.ts` (C/M) |
| S6c | editor views and labels, `FieldModel.vue`, `useLegacyDomain.ts` (C), `config/samples.ts`, `constants.ts`, `scripts/sync-samples.mjs` (M) |
| S7 (one PR) | `git mv iNNfo/specs/templates iNNfo/specs/bluepriNNts`; `bluepriNNts/domaiNN/spec_NN.md` (C); every `spec_NN.md` gets a minor bump and a re-parent; `manifest/source.yaml`, `scripts/template-catalog.mjs` → `blueprint-catalog.mjs` (+ npm scripts), `build-docs.mjs`, `sync-versions.mjs`, `guard-template-immutability.js`, `channel-refs.js`, `tag-pin-freshness.js` (`TEMPLATE_SPEC_RE`), `manifest/{generate,validate,check-parity}`, `canonical-registry.ts`, `spec.spec.ts`, procedures that name MCP tools (M); `docs/use/manifest*.md` regenerated |
| S8 | `nn-preflight/scripts/{preflight-check,upgrade-check}.js` (`DEFAULT_BLUEPRINTS_DIR`, `--blueprints-dir`, catalog URLs), `scripts/skills-manager.js`, `scripts/lib/skills-commands.js`, skill frontmatter `bundled_blueprints`, `min_version`, `innfo-mcp` `0.12.0` bump via the derived-version flow, skill prose, `nn-innfo` bundled bluepriNNt, `nn-workspace-git` → `nn-domain-git` |
| S9a | core, MCP and editor fixtures and samples, `tests/fixtures/simulacro-refactorizacion` (live copy) + `simulacro-user-workspace.test.ts`, `simulation/**` (migrated by the tool; the diff is generated) |
| S9b | `workspace_NN/`, `_samples_nn/`, the 4 use-case workspaces under `docs/cognitive_nn/use-cases/` (migrated by the tool; the diff is generated) |
| S10 | `scripts/lib/legacy-write-guard.js` + test (C) |
| S11 | delete `src/legacy/`, the generated bundles, `legacy-hint.ts`, `useLegacyDomain.ts` and the fixture; empty the ledger |

## Testing Strategy (strict TDD; root `npm test` for core/mcp/editor, Node test runner for skills/scripts; there is no `iNNfo/package.json`)

| Layer | What | How |
|---|---|---|
| Unit | fingerprint signals, `mixed`, `noop`, `planHash` stability, custom-heading passthrough, blocked on invalid kNNowledge | vitest against the frozen legacy fixture |
| Unit | ledger guard: all 5 failure modes; write guard: seeded token | fixture repos under a temp dir; each assertion must be seen red first |
| Unit | case-exact probe | a fake `readdir` returning `Kknowledge` must fail |
| Integration | dry-run, apply, double run, interrupted run (`failAfter` fault hook), restore with sha256 equality, domain without local specs | `migrate-domain.test.js` on a temp copy |
| Integration | migrated corpus round-trips byte-identically; legacy input to the MCP and the editor gives the hint | extend `roundtrip-fidelity.test.ts`; MCP server tests |
| Regression | the 8 simulacro journeys on every migrated dogfood domain; preflight suites rerun with an empty `USERPROFILE`/`HOME` | `simulation/run-all.mjs` |
| Gates | `verify.js` (build-preflight-primitives `--check`, ledger, catalog), `check:integrity` (Group 1c tag-pin-freshness), `check:spec-urls`, `check:versions`, `check:samples`; `validate-manifest --channel stable` only after R | tracker child minimum per PR; full Gate G at the tracker tip (see tasks.md "Tracker gate policy") |

## Migration Plan / Rollout

1. S1–S4 land on `dev` as additive work.
2. Create tracker branch `feat/nn-rename-tracker` from `dev`. S5–S9b follow `feature-branch-chain`: child PR #1 targets the tracker, and each later child targets the previous one. Each child stays under 400 lines, except S7 (one PR, so the immutability guard sees the move and the MINOR bumps atomically; `size:exception`). S9a/S9b diffs are generated and are reviewed by the migration report, not line by line. Order: S5, S6a, S6b, S6c, S7, S8, S9a (fixtures and samples), S9b (dogfood).
   - **Tracker gate policy.** Each tracker child keeps the tests it adds or changes green, passes typecheck and lists its known-red gates. Tests that read real legacy fixtures stay known-red from S6a until S9a. Full Gate G (`verify.js`, `check-integrity` with Group 1c tag-pin-freshness, simulation journeys, `check:versions`, `check:samples`) is required green only at the tracker tip before R. `validate-manifest --channel stable` runs only after R's merge → tag → pin ordering.
3. Merge `dev` into the tracker regularly.
4. Release R: tracker → `dev` → `git push origin dev:main` → tag the merged SHA (`blueprints-v0.18.0`, `innfo-mcp-v0.12.0`, the suite tag derived by `channel-refs`/`sync-versions` after the latest `v0.10.0`, `skills-v*`) → pin the refs and `min_version` → regenerate the manifest and CDN bundle. The `innfo-mcp` `0.12.0` bump is authored in S8 through the derived-version flow.
5. S10, then S11 after sign-off.

**Rollback:** before R, abandon the tracker. After R, publish a follow-up release and run `migrate-domain.js --restore <backup>` per domain, or use git. S11 is reverted as a single commit.

## Risks / Trade-offs

- A mis-cased path passes on Windows → mitigated by the constants module, the case-exact probe, Linux CI and the write guard.
- The generated bundles drift from core → caught by the `verify.js` step 5 `--check`.
- Tests that read real legacy fixtures are red on the tracker between S6a and S9a → accepted and listed per child PR (tracker gate policy); full Gate G is required only at the tracker tip, and nothing merges to `main` before that.
- The tracker diverges from a busy `dev` → merge `dev` in regularly, and re-audit the shared tree before every git operation.
- The `canonical-registry.ts` embedded copies go stale after the move → add a test that asserts byte equality with the on-disk `spec_NN.md`.
- Removing the `./legacy` export in S11 is technically breaking → accepted because the only consumers are internal. S11 ships as a core/MCP minor, not the proposal's "patch".
- `rg "legacy:nn-rename/"` in the success criterion must exclude `openspec/**`.
- The old `backup-workspace.js` misses root files → the migration always uses the full-tree backup.
- The existing default ref `templates-v<template_version>` in `fetchTemplatePackageFromRemote` is wrong, because the channel tag is a batch number → make `ref` required in S6b.

## Open Questions

All resolved.

- [x] The maintainer confirms D1–D13 (confirmed 2026-09-29).
- [x] Verify the existing `v0.*` tags before S3 (D5): checked, the latest is `v0.10.0` and no collision exists. Task 4.1 re-runs it at S3 time.
- [x] The specs align the `knowledge_version` bump rule and `INNFO_DOMAIN_DIR`, which differed from the proposal text (spec alignment done).
