# Exploration: NN Level Nomenclature Rename

Change: `2026-09-29-nn-level-nomenclature-rename`
Phase: sdd-explore (read-only). Artifact store: openspec. Date: 2026-09-29

## Decisions taken by the maintainer (not re-litigated)

| Level / concept | Today | Target |
|---|---|---|
| Level 0 | `defiNNe` (`iNNfo/specs/defiNNe_V_0-1-0_NN.md`) | `defiNNition` |
| Level 1 | `iNNfo` | `iNNfo` (unchanged) |
| Level 2 | "Template" | `bluepriNNt` |
| Level 3 | "Model" | `kNNowledge` |
| Container | "Workspace" (L2 `workspace_spec_NN.md`, L3 `workspace_NN.md`) | `domaiNN` (rename, not a new concept) |

Versioning: no global reset. Renamed identities start at `V_0-1-0`; everything else only moves forward. Published `_V_x-y-z_` files are write-once; git tags are immutable. Prerequisite (console `artifact_blueprint.html` -> `artifact_shell.html`, manifest asset `innfo-console-blueprint` -> `innfo-console-shell`) is treated as done/in progress and is not planned here (visible in the working tree: modified `manifest/source.yaml`, `skills/nn-innfo/SKILL.md`, `feedback.schema.json`, `business/procedures/apply_feedback_NN.md`).

## Current State

### The hierarchy is encoded in five places
1. Prose: `defiNNe_V_0-1-0` "Hierarchy of Levels" table; `iNNfo_V_0-2-2` (51 "model", 67 "template" mentions; titled "Meta-template Specification").
2. Frontmatter identity: `level`, `parent:` (L1->L0 raw URL), `parent_spec {name,url}` (L2/L3), `model_version` (required, validated in `innfo-core/src/validator/content.ts`), `template_version`, `spec_version`, `spec_url`.
3. Paths/URLs: `iNNfo/specs/templates/<name>/spec_NN.md` (workspace is the outlier: `templates/workspace_spec_NN.md`); user workspaces `models/`, `specs/templates/<name>/V_x/`, `~/.agents/templates/`. Sample and user models pin `parent_spec.url` to `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/<name>/spec_NN.md` (main HEAD, not a tag; verified in `_samples_nn/models/*`).
4. Public API: 14 MCP tools in `iNNfo/packages/innfo-mcp/src/server.ts` (list_models, read_model, get_spec, get_template, validate_model, validate_model_url, validate_template, init_model, list_templates, hydrate_template, sync_workspace_manifest, check_workspace, list_template_procedures, list_template_skills). Env vars INNFO_MODELS_DIR, INNFO_GLOBAL_DIR, INNFO_SKILLS_DIR, INNFO_CACHE_DIR.
5. Distribution: `manifest/source.yaml` (`templates:`, `frozen_templates:`, `seam_dirs:`, `ref_key: templates`), tags `templates-v*` (resolver regex `^(templates-v|v)\d`), public catalog `iNNfo/specs/templates/catalog.json` (key `templates`, also served at cognnitive.com/innfo/templates/catalog.json and read by installed nn-preflight), `SHIPPED_TEMPLATE_VERSIONS` (`innfo-editor/src/config/samples.ts`).

### L2 is mutable-in-place; L0/L1 are write-once
L2 templates live at unversioned `spec_NN.md` and are versioned by frontmatter `template_version` (guard: `scripts/guard-template-immutability.js`). L0/L1 are filename-versioned and immutable. So L0/L1 renames are cheap (add a file, freeze the old); L2 path moves are expensive (HEAD URLs are the contract).

### A prior vocabulary decision conflicts
`iNNfo/specs/vocabulary.json` (V_0-2-0), living spec `openspec/specs/canonical-vocabulary/spec.md`, `docs/innfo/documentation/vocabulary.md` and guard `iNNfo/specs/scripts/test-vocabulary.js` pin **`app`** as canonical for L2 (`template` deprecated alias) and list `specs/templates/ -> specs/apps/` as a planned migration. Catalog titles already say "Analysis App". This change supersedes `app`: canonical-vocabulary becomes a MODIFIED capability and test-vocabulary.js is rewritten test-first. `openspec/backlog.md` section 3 already prescribes the split recommended here (low-risk vocabulary pass, then a high-risk identifier migration only with an alias layer).

### Resolution is name-first locally, URL-first on the network
`resolveParentChainNode` (`innfo-mcp/src/tools/resolver-node.ts`): local tiers resolve by `parent_spec.name` (workspace `specs/templates/<name>/V/`, flat `templates/`, `~/.agents/templates`, skills dir); only the network tier fetches the literal URL; the last tier is a built-in canonical fallback registry (`innfo-core/src/schema/canonical-registry.ts`, matches name OR URL). `fetchTemplatePackageFromRemote` hardcodes `iNNfo/specs/templates/<base>/` at ref `templates-v<version>` (and special-cases `workspace_spec_NN.md`). Entrypoint discovery (`innfo-core/src/recursiveParser/workspace.ts`) is prefix-based (`startsWith('workspace')`, fallback `workspace_01.md`, `workspace_NN.md`, `workspace.md`, plus `_base_<id>.md`). These are additive extension points.

## Blast Radius Map
Counts are rg line counts (excl. node_modules/.git/.claude); order-of-magnitude only. P = vocabulary/prose, I = identifier/path/URL/public API.

### R1 defiNNe -> defiNNition (L0): 202 lines / 56 files
(validation-baseline.json 50, archived openspec ~45, the 5 spec files, docs ~20, tests ~35, src 7)
- `defiNNe_V_0-1-0_NN.md` (I, write-once): never edited; add `defiNNition_V_0-1-0_NN.md`; old stays forever.
- `iNNfo_V_0-1-0..0-2-2` `parent:` (I, write-once): hardcode the defiNNe URL; old file must stay on main. A new iNNfo version points to defiNNition.
- `canonical-registry.ts:21` (I): embedded iNNfo spec with `parent:` URL.
- `resolver-node.ts:215`, `list-read.ts:46`, `metamodel.ts:7` (P): comments.
- `SpecResolverService.ts:125` (I): `slug === 'iNNfo' || slug === 'defiNNe'` must accept both.
- `scripts/check-spec-version.mjs:126` (I): classifier `includes('defiNNe')`.
- `iNNfo/validation-baseline.json` (I, generated): path-keyed; regenerate in-slice.
- Living specs (canonical-spec-hosting, template-release-tagging, workspace-template-upgrade), docs, `skills/nn-innfo/SKILL.md:290` (P).

### R2 Template -> bluepriNNt (L2): `specs/templates` in 1139 lines / 307 files
- Prose in docs/skills/UI (P). Exclusions stay: nn-trannsform `traNNsformations/`, Vue SFC `<template>`, generic English.
- `title:` of the 17 templates and catalog titles (P but versioned): needs `template_version` bump + `templates-v*` tag + manifest repin (guard + check-integrity Group 1c).
- `iNNfo/specs/templates/<name>/` folders (I): a move breaks every `parent_spec.url`, the 13 frozen CDN bundles (`docs/innfo/cdn/innfo-mcp-v0.2.4..v0.11.0`) and installed `~/.agents` MCPs.
- `templates-v*` tags, `ref_key: templates`, manifest `templates:`/`frozen_templates:`/`seam_dirs:` (I): tags immutable; keys parsed by `scripts/manifest/*`, `scripts/lib/channel-refs.js`, installed nn-preflight, skills-manager.
- `template_version`, `template_name` (I): read by `versionStatus.ts`, `useTemplateVersionNotice.ts`, guard, `sync-versions.mjs`, `check-parity.js`.
- MCP tools get/validate/list/hydrate_template, list_template_procedures, list_template_skills (I): 6 of 14; 453 references in 122 files, including procedures bundled in tag-pinned template packages (e.g. `business/procedures/apply_feedback_NN.md`) that will call the old names forever.
- `SHIPPED_TEMPLATE_VERSIONS`, `KNOWN_TEMPLATES`, `buildTemplateUrl` (I, internal): keys are slugs.
- `catalog.json` key `templates` and `templates/` Pages path (I): read by installed preflight (`preflight-check.js:56-58`).
- Living openspec: `template` in 53 of ~90 specs (563 lines), 16 `template-*` capability folders (P; do not rename folders, per Tanda B precedent).

### R3 Model -> kNNowledge (L3)
- Visible strings/docs/SKILL prose (P): editor 321 lines in 59 .vue files (ValidationReport 47, HomeView 36, LeftSidebar 29, ConsoleHubView 27, ModelInfoPanel 26, FieldModel 21). Rename user-visible strings only; internal identifiers (`modelStore`, `ParsedModel`, handlers) stay, documented as "code name" in the glossary.
- `model_version` (I): required by validator (`content.ts:183-201`), serializer (`serializer.ts:192`), `types/parser.ts:181`, agent modifications (`agentModification.ts:149`), console `export-meta`.
- `models/` folder (I): hardcoded in MCP (15 lines/8 files), core (9/4), editor (11/6), skills (81 lines/22 files), `INNFO_MODELS_DIR`. `models_dir` is declared in the workspace spec but code largely hardcodes `models/`.
- MCP list_models, read_model, init_model, validate_model, validate_model_url (I): 5 of 14.
- `type:: model` and primitive `model` (I, grammar): 46 lines in templates, `iNNfo_V_*` options list, `FieldModel.vue`, living spec `model-primitive-type` (43 template + 25 tool refs). L1 grammar keyword: renaming = language change.
- Feedback/console artifacts (I): `<Model>_V_<Version>_<user>_review.json`, `feedback.schema.json` (being modified now), `export-meta` (`model`, `model_version`), deep link `?view=editor&model=`; readers must accept legacy keys.
- Concept names `Models`, `Templates`, `Workspace` in `workspace_spec_NN.md` and every user `workspace_NN.md` (I, user data): "one name, one identity" => concept names are identities; changing them rewrites content, not frontmatter.

### R4 Workspace -> domaiNN: ~1057 lines/109 src files (core/mcp/editor) + 506 lines/40 skill files; `workspace_NN.md|workspace_spec` code refs 238 lines/62 files
- `workspace_NN.md` (I): `isWorkspaceManifest`, fallback list (`workspace.ts:145`), manifest `entrypoint` (`source.yaml:2`), nn-preflight (44), nn-upgrade `backup-workspace.js` (18), editor stores/sync/config, `workspaceId.ts`, nn-trannsform (22), nn-start.
- `workspace_spec_NN.md` (I): template_version V_0-6-0; special-cased in `fetchTemplatePackageFromRemote`, `canonical-registry.ts`, `template-catalog.mjs`, `sync-versions.mjs`, `tag-pin-freshness.js`, guard, bundled copy `skills/nn-innfo/templates/`. New `domaiNN` identity starts V_0-1-0; old stays under `frozen_templates:`.
- `models_dir`, `templates_dir`, `sources_dir`, `skills_dir` (I): user frontmatter/concept fields.
- MCP check_workspace, sync_workspace_manifest; `nn-workspace-git` skill dir (install identity); ~15 `workspace-*` capabilities (I).
- Generic "workspace" (npm workspaces, VS Code, git worktrees, IndexedDB editor workspace): needs an explicit exclusion list.
- Real workspaces to migrate (dogfooding): `workspace_NN/`, `_samples_nn/`, `docs/cognitive_nn/use-cases/*` (5), `simulation/fixtures/acme`. Note `workspace_NN/workspace_NN.md` frontmatter has broken quoting (`name: " workspace\`).

### Other consumers
- vocabulary.json/vocabulary.md/test-vocabulary.js: replaced/extended. Spec cites `iNNfo/AGENTS.md`, which does not exist (only root `AGENTS.md`).
- `docs/innfo/cdn/` frozen bundles stay; `build-docs.mjs` republishes CDN on each Pages deploy; generated `docs/llms.txt`, `ai-index.yaml`, `use/manifest*.md`.
- `simulation/` (8 journeys) and fixture `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion/**` (a full legacy workspace) are the legacy regression net; must NOT be rewritten.

## Approaches

| | A. Vocabulary-only | B. Versioned rename + aliases (staged) | C. Big bang |
|---|---|---|---|
| Idea | Rename terms in docs/specs/UI; keep all identifiers | New identities added, old frozen and resolvable; identifiers only added-to; both vocabularies accepted | Rename folders, tags, tools, keys, concepts, entrypoint at once |
| Pros | Zero resolution risk; matches existing "identifiers stable" contract; reversible per PR | Honors no-reset, write-once, immutable tags; old installs/CDN/skills keep working; user migration via nn-upgrade; additive extension points already exist | One vocabulary, no alias layer |
| Cons | Two vocabularies forever; cannot create `defiNNition_V_0-1-0` / `domaiNN` identities (misses stated intent); permanent doc debt | Dual surface during the window; legacy contract tests; more slices | Impossible for immutables (tags, frozen CDN bundles, HEAD URLs, tag-pinned procedures); 404s on every installed workspace unless old paths kept (= B); skill/MCP skew; thousands of lines; repeats known incidents |
| Effort | Medium | High (incremental) | Very High |

## Recommendation
Adopt **B, staged and scoped**, with A as slice 1:
1. Vocabulary first: glossary + supersede `app` + user-visible strings + guard test.
2. New identities additively: `defiNNition_V_0-1-0_NN.md`, a new iNNfo version pointing to it, `domaiNN` bluepriNNt/entrypoint; freeze `defiNNe_V_0-1-0`, old iNNfo versions, `workspace_spec`.
3. Additive code compatibility: accept both L0 slugs, both entrypoint names (exact-name match, not prefix), both concept names; optionally register new MCP tool aliases next to the 14 old names.
4. Defer to a separate, separately-approved change: physical moves (`specs/templates/`, `models/`), `templates:` manifest key, `templates-v*` namespace, frontmatter key renames, `type: model`, legacy-name removal. Rationale: only these are user-data-breaking and unrecoverable for old installs, and their value is cosmetic once the vocabulary layer exists.
5. Do not rename internal code identifiers; document them as "code name" in the glossary.

## Backward Compatibility (legacy contract)
- `parent_spec.url` -> `.../main/iNNfo/specs/templates/<name>/spec_NN.md`: path must keep serving on main HEAD (do not move; a frozen duplicate copy is drift-prone). Local tiers are name-first; the risk is the network tier, 13 frozen CDN bundles and the stale fallback registry.
- `parent:` in iNNfo V_0-1-0..0-2-2 -> `defiNNe_V_0-1-0`: file stays forever.
- `models/`, `*_dir` keys: unchanged now; if ever renamed, resolve the key first then legacy `models/`.
- `workspace_NN.md`, `workspace_01.md`, `workspace.md`, `workspace*_NN.md`: keep; add exact `domaiNN_NN.md`. Do NOT extend the prefix to `domain*`/`knowledge*` (mis-selects `Domain_Glossary_NN.md` etc.).
- `workspace_spec` as `parent_spec.name`: frozen but resolvable (`frozen_templates:`, canonical registry); preflight/`versionStatus.ts` must classify it "legacy, upgrade available", not "unlisted".
- Concept names `Workspace`/`Models`/`Templates`: cannot be silently accepted under new names ("one name, one identity"); needs declared aliases in the new bluepriNNt or nn-upgrade heading rewrite with backup.
- `model_version`, `template_version`: unchanged.
- MCP tool names: keep all 14 registered (old skills, bundled procedures, docs).
- `~/.agents` installs: old skill + new MCP must work; new skill + old MCP must not fail silently => manifest pins a minimum MCP and preflight reports it.
- Feedback JSON, `export-meta`, deep links: readers accept old keys forever.
- `catalog.json` `templates` key and Pages path: keep; add keys only.
- `validation-baseline.json`, tag-pin-freshness, check-integrity: adjust in the same slice.
- nn-upgrade today: consent, out-of-tree backup, schema impact diff, `parent_spec` repoint, `validate_model`, restore-on-failure, but only within one identity and never heading renames. Extending it (and preflight Tier-3 `upgrade-check.js`) is the core of slice S6.

## Linguistic and Semantic Risks (risks, not vetoes)
1. `kNNowledge` is uncountable: `Models` plural is used in `# NN Models`, `[[Models]]`, `models/`, catalog, UI counters, `list_models`. "kNNowledges" is wrong; needs a plural/count rule up front.
2. Collides with the existing "knowledge unit" (75 lines; `knowledge-unit-uri/query`, `unitResolve`, `queryUnits`); needs a sense boundary in the glossary.
3. `defiNNition` collides with the L1 primitives `Concept/Field/Matrix/Marker Definition` (116 lines per iNNfo spec, 345 in canonical-registry.ts, literal grammar `# NN Concept Definition`). Primitives are grammar tokens and must not be renamed. L0 title "The Definition of Definitions" becomes wordplay.
4. `domaiNN`: the workspace is a container (Models, Templates, Specs, Sources, Procedures, Artifacts, Skills, Tools, Tags), not a bounded subject area. "domain" is already used for subject areas in ~155 lines (including the current workspace_spec description and "Template Domain Consoles" in three-tier-consoles). A domaiNN is itself an L3 kNNowledge that contains kNNowledge; needs an explicit glossary line.
5. "blueprint" in the console layer (three-tier `innfo-runtime` / blueprint): the prerequisite frees the word; verify no leftovers. L1 "Meta-template" / "Metaplantilla Nivel 1" / `metaplantilla-specs.test.ts` need a target.
6. Third vocabulary in flight: `app` (2026-09-12) in catalog titles and nn-innfo copy; deprecation note must list both `app` and `template`.
7. Regex hygiene: new nouns contain `NN`. `parseSpecName` strips `/_(NN|FORMAT|F)$/i` (needs the underscore, so `domaiNN_NN.md` parses) but lowercases the base (`defiNNition` -> `definition`); add tests that names are never truncated or mis-tokenised.
8. Bilingual surface: SKILL triggers include `modelo`, `plantilla`; keep old, add new, both languages.
9. Case-insensitive grep cannot distinguish `defiNNition` from "definition"; the guard must search case-sensitively.

## Overlap / Conflict With In-Flight Changes
- Console shell rename (uncommitted, other session): shares `manifest/source.yaml`, `nn-innfo/SKILL.md`, `feedback.schema.json`, `business` and `metrics` procedures, `innfo-console-runtime` spec, `offline-consoles.md`. Hard prerequisite; start from a clean tree (shared checkout).
- `2026-09-27-traceability-vocabulary-unification`: implemented, task 4.14 (validate-manifest stable, tag/repin) open; touches `workspace_spec_NN.md` version, nn-innfo prose, `sources-citations-lineage.md`. Complete before S4/S5; reuse its zero-hit sweep and "don't rename capability folders" rule.
- `2026-09-28-three-tier-consoles-and-asynchronous-review`: uses "Template Domain Consoles", "Model / Custom Consoles", `<Model>_V_<Version>_<user>_review.json`. Archive first or cover with an S1 delta.
- `2026-09-27-template-procedures-manifest-and-discovery`: defines `list_template_procedures` discovery; build alias work on top, do not reopen.
- `2026-09-27-console-export-slots-and-standalone-pin`, `-left-sidebar-editor-tree-and-header-views`: archive before the editor label pass (LeftSidebar.vue 29 hits).
- `2026-09-28-remotion-video-scenes-pipeline`, `2026-09-27-design-presets-template-and-video-integration`: edit `video`/`design-presets` `spec_NN.md` versions; sequence title bumps after their releases.
- `2026-09-27-skills-manager-node-modules-preservation`: low; skills-manager reads `templates`/`ref_key` (touch point only if manifest keys are ever renamed).
- Living specs: `canonical-vocabulary` MODIFIED; `template-*` (16), `workspace-*` (~15), `model-*` (6): wording-only deltas.

## Release Implications
- check-integrity Group 1c (blocking): any diff in `skills/**` or `templates/**/spec_NN.md` must touch `manifest/source.yaml` in the same batch; the tag is a maintainer step. Title/prose edits in a template need a `template_version` bump (immutability guard), so a `templates-v*` tag and repin. Expect >= 2 `templates-v*` releases (titles; domaiNN) and 1 `skills-v*`.
- New L0 file is write-once; tag policy for L0/L1 is `v<version>` (template-release-tagging spec) while `parent:` URLs point at `main`; decision needed on a new `v*` tag.
- New iNNfo version registers in `DEFAULT_INNFO_VERSION` (editor `constants.ts`, currently stale V_0-2-1), `canonical-registry.ts`, `check-spec-version.mjs`, `SHIPPED_TEMPLATE_VERSIONS` (recurring registration gap, 5 recurrences).
- `SHIPPED_TEMPLATE_VERSIONS` gets a `domaiNN` key and keeps `workspace` (test `shipped-template-versions.test.ts`).
- MCP/core: versions derived (`sync-versions.mjs`, `channel-refs.js`); `innfo-mcp` 0.11.0 is the authored source. New tool aliases or entrypoint acceptance = minor bump of both, new CDN bundle `innfo-mcp-v0.12.0.bundle.js` (`cdn-bundle-staged.js`), `nn-innfo.mcp.version` repin. Skills using new names must require that version.
- Catalog: `template-catalog.mjs --check` (Group 4) and the verify.js Template Inventory Guard need the manifest entry for any new folder in the same change (PR #29 incident).
- `check-spec-version.mjs --check-urls` will catch moved/renamed specs on main.
- Generated docs drift (Group 7); Pages deploy is separate from tags.
- Per-slice gates: build innfo-core first, `check:spec-urls`, `check:spec-version`, `sync-versions --check`, empty USERPROFILE/HOME rerun for preflight tests.

## Suggested Slicing (chained PRs, target <400 changed lines each)
| Slice | Content | Size | Ships as |
|---|---|---|---|
| S0 | Prerequisite: console shell rename (other session) | n/a | own release |
| S1 | Glossary + guard, test-first: extend `vocabulary.json` (new canonical terms, deprecated aliases app/template/model/workspace/defiNNe, sense exclusions, "code name" column), rewrite `test-vocabulary.js`, `vocabulary.md`, MODIFIED `canonical-vocabulary` delta. No behaviour change | 150-250 | docs only |
| S2 | Prose pass docs + skills (nn-innfo, nn-start, nn-preflight, nn-upgrade, nn-trannsform, docs/**; SKILL triggers keep old + add new, both languages); split S2a docs / S2b skills | 300-400 each | `skills-v*` + repin |
| S3 | Editor visible strings only, split by view; after sidebar change archived | 300-400 | app build |
| S4 | L0/L1: add `defiNNition_V_0-1-0_NN.md`, new iNNfo version -> defiNNition, register in `canonical-registry.ts`, `SpecResolverService.ts` (both slugs), `check-spec-version.mjs`, baseline regen; old files untouched | 250-400 | `v*` per policy + repin |
| S5 | `domaiNN` bluepriNNt V_0-1-0 (new folder, manifest entry, catalog, SHIPPED_TEMPLATE_VERSIONS), `workspace_spec` under `frozen_templates:`, exact-name entrypoint `domaiNN_NN.md`, preflight legacy-identity classification, `check_workspace` accepts both; tests first with frozen legacy fixture | 350-400 + tests | `templates-v*` + MCP minor + CDN + repin |
| S6 | nn-upgrade identity migration (`workspace_spec` -> `domaiNN`, heading renames, backup/restore), preflight Tier-3 detection, migrate in-repo workspaces (dogfooding) | 300-400 | `skills-v*` |
| S7 (optional) | MCP alias tool names next to old ones, README/docs-facts regenerated, old names marked deprecated | 200-300 | MCP minor + CDN |
| Deferred | Physical moves, manifest key, tag namespace, frontmatter keys, `type: model`, legacy removal (own exploration + support-window policy) | n/a | n/a |

Ordering: S0 first; Tanda B 4.14 before S5; S1 before all; S4 before S5; S5 before S6; S3 after sidebar archive. Review Workload Guard: S2, S3, S5 are near 400 lines; chained PRs expected (`chained-pr` skill).

## Risks
1. Old-install breakage via raw HEAD URLs if `specs/templates/**` moves.
2. Skill/MCP version skew.
3. User-data rewrite of concept headings (backup, consent, restore, hand-edited files).
4. Entry-file mis-detection with prefix matching.
5. Blind find-and-replace hazards ("template": Vue SFC, nn-trannsform; "model": `type: model`, LLM-model usages; "workspace": npm/VS Code/git).
6. `type:: model` grammar keyword mistaken for vocabulary.
7. Recurring incident classes: unpinned manifest/tag (2026-09-24), unregistered SHIPPED_TEMPLATE_VERSIONS, new template folder without manifest entry, `_V_` edited in place, sdd-archive on haiku truncating artifacts, concurrent sessions on the shared tree.
8. `validation-baseline.json` churn (237 `specs/templates`, 50 `defiNNe` lines).
9. Drift returns without a guard asserting legacy nouns are absent from user-visible surfaces.
10. Generated public indexes (`llms.txt`, `ai-index.yaml`, `.well-known/ai-catalog.json`) must be regenerated, not hand-edited.

## Open Product Questions
1. Are `iNNfo/specs/templates/`, `models/`, the `templates:` key and `templates-v*` tags permanent, or must they change eventually (and with what support window for old paths)?
2. Is `domaiNN` a new identity restarting at V_0-1-0 (template `domaiNN`, entrypoint `domaiNN_NN.md`), or does `workspace_spec` continue with new concept names?
3. Plural/count rule for `kNNowledge` (UI copy, folder, tool names) and its relation to "knowledge unit".
4. MCP tool names: add aliases (with a deprecation date?) or keep the 14 names and only change descriptions?
5. Frontmatter keys (`model_version`, `template_version`, `template_name`) and the `type: model` keyword: stay stable or get versioned aliases in a new iNNfo language version?
6. Concept headings in user files (`# NN Workspace/Models/Templates`): rename (forces content migration) or keep and only relabel in UI?
7. Confirm container semantics of "domain" and whether existing subject-area uses of "domain" get reworded.
8. Confirm `app` (adopted 2026-09-12) is retired; `app` and `template` both become deprecated aliases of bluepriNNt.
9. L1 "meta-template" wording: becomes "meta-bluepriNNt"?
10. Spanish surface: brand tokens untranslated, or Spanish equivalents for triggers/copy?
11. Legacy support policy and preflight behaviour (warn, upgrade-with-consent, silent).
12. Delivery: `stacked-to-main` or `feature-branch-chain`, single tracker branch given the shared checkout.
13. Dogfooding: migrate `workspace_NN/`, `_samples_nn/`, the 5 use-case workspaces and `simulation/fixtures/acme` in this change (recommended), or leave them as legacy fixtures?

## Ready for Proposal
Yes, conditionally. Run the proposal question round for Q1, Q2, Q3 and Q6 first (they change the scope of S4-S6), and confirm the console shell rename and traceability Tanda B (task 4.14) have landed. Spec/design then: MODIFIED `canonical-vocabulary`; NEW capabilities for legacy-identity resolution (`workspace-entrypoint-resolution` delta), the `domaiNN` bluepriNNt, and nn-upgrade identity migration.

## Addendum (2026-09-29): pivot to full migration

The maintainer superseded Strategy B, and with it the parked follow-up `2026-09-29-nn-identifier-full-migration`. This change now performs the full identifier migration itself. The reasons:

- Local-first resolution. Resolver Tier 1 is `./specs/templates/<name>/<version>/`, hydrated inside the workspace (`innfo-mcp/src/tools/resolver-node.ts:336`).
- Network fetches use immutable tag refs. They go to `templates-v<version>` (`resolver-node.ts:686-690`), not to main. Old MCPs and the frozen CDN bundles keep resolving old versions whatever layout main has.
- The real breakage is limited to four cases:
  - (a) Installed preflight reads the catalog from `https://cognnitive.com/innfo/templates/catalog.json` and from raw `main/iNNfo/specs/templates/catalog.json` (`skills/nn-preflight/scripts/preflight-check.js:56-58`). Fix: a generated mirror at both old URLs.
  - (b) Workspaces without vendored specs resolve through the main-HEAD `parent_spec.url` (`_samples_nn` has no `specs/`). The in-repo ones are migrated in this change. External ones remain a recorded risk.
  - (c) An old MCP is asked for a new-layout version. Fix: preflight enforces a minimum MCP version before it offers migration.
  - (d) Found during the proposal: installed preflight also reads the rendered manifest from raw `main/docs/use/manifest.md` (`preflight-check.js:39`) and parses its `templates` key (`:112`, `:1138`, `:1256`). The render therefore has to keep emitting the legacy keys, or a legacy install cannot reach the upgrade.
- Under Strategy B, new domaiNN and kNNowledge documents would still write `template_version`, `model_version`, `type:: model` and `specs/templates/`. The maintainer judged that debt unacceptable.

The rest of this exploration stays as a historical record. Where it disagrees with the proposal, the proposal is authoritative.
