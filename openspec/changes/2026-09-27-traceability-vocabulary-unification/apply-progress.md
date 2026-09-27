# Apply Progress: Traceability Vocabulary Unification (Tanda B)

## WU1 — Prose and vocabulary only

**Status**: Done, including a fix-forward remainder closed in this run.

Prior session: 6 of 7 tasks (1.1, 1.2, 1.5-1.7 fully; 1.3/1.4 partially)
landed across commits `2464230`, `0ec15c3`: doc rename
(`citations-provenance.md` → `sources-citations-lineage.md`), 6 inbound
linkers updated, `nn-preflight`/`nn-start` SKILL.md `user_input` drops,
delta-spec wording verified, link/spec-url checks run.

A fresh-context `sdd-verify` pass found 4 residual "provenance" hits the
prior session's 1.3 task had missed in `skills/nn-trannsform/SKILL.md`
(frontmatter `description:`, "Watch Roots in Provenance Model" heading,
"register the batch in the provenance model" prose, "citations or
provenance markers" prose) plus a matched-pair doc gap not covered by any
task in this WU (`docs/index.md` + `docs/index.html`: "Ingestion &
Provenance" / "Extreme Traceability & Provenance" headings — confirmed
these are hand-maintained independently; `scripts/build-docs.mjs` only
stages the editor's built `dist/` into `docs/innfo/app/`, it does not
generate `docs/index.html` from `docs/index.md`, so both files were
edited directly, not regenerated). This run closed both gaps:
- `skills/nn-trannsform/SKILL.md`: all 4 occurrences reworded to
  Source/Citation/Lineage vocabulary ("mandatory Source frontmatter",
  "Declarative Watch Roots in the Lineage record", "register the batch in
  the Lineage record", "clean text without citations or lineage
  markers").
- `docs/index.md`: "provenance frontmatter" → "Source frontmatter";
  "cites its exact provenance" → "cites its exact lineage".
- `docs/index.html`: "Ingestion & Provenance" → "Ingestion & Lineage";
  "Extreme Traceability & Provenance" → "Extreme Traceability & Lineage"
  (heading + its HTML comment).

All 7 tasks (1.1-1.7) are now genuinely complete and marked `[x]` in
`tasks.md`.

## WU2 — Code, tests first (strict TDD)

**Status**: Done, including 4 tasks that were checked off by a prior
session without the code landing — closed in this run.

Tasks 2.1, 2.2, 2.3, 2.8 were genuinely complete per commits `7d51d68`
"feat(innfo-core): add conflicts:: and legacy-derivation-key diagnostics"
and `accc632` "fix(nn-trannsform): impact report frontmatter uses
generated_by": `CONFLICT_FIELD_NAMES` in `sourceRef.ts`/`index.ts`,
`workspaceSources.ts` D3+D5 (`SRC_CONFLICT_FLAGGED`,
`LEGACY_DERIVATION_KEY`, "provenance" dropped from message strings),
`impact-checker.js:285` → `generated_by:`, and the `references:` alias
spec-only correction. `tasks.md` now marks these `[x]` (it previously
showed `[ ]` despite the commits landing).

Tasks 2.4, 2.5, 2.6, 2.7 had NOT been implemented despite the prior
apply-progress claiming WU2 "Done" — closed in this run:
- **2.4**: `skills/nn-trannsform/scripts/lib/provenance-model.js` —
  added `parseFrontmatterSources()` (reads an artifact's YAML frontmatter
  `sources:` field, both flow-list `[a, b]` and block-list `- a\n- b`
  forms, plus an equivalent `sources` JSON array in the HTML
  `export-meta` block); `parseArtifactMeta()` now returns `sources`;
  `collectArtifacts()` prefers `meta.sources` over `model`/`model_version`
  when both are present. Added a new sub-test to
  `skills/nn-trannsform/test/unit/test-lineage-sync.js` covering an
  artifact with a `sources:` frontmatter field (asserts the rendered `# NN
  Artifacts` `derived_from::` comes from `sources:`, not `model`/
  `model_version`, and that Models-catalog lineage stays byte-unchanged).
- **2.5**: renamed "provenance model" → "lineage record" in
  `skills/nn-trannsform/scripts/index.js:70,544` (the CLI message
  `"Initialized cogNNitive provenance model at:"` → `"Initialized
  cogNNitive lineage record at:"`), `lib/bootstrap.js:27` ("Track
  provenance with" → "Track lineage with" in the generated README), and
  `scanner.js:143` (index-manifest `tags:` array `provenance` → `lineage`).
  Grepped `skills/nn-trannsform/test/` first — no test asserts on the old
  literal strings or the old tag value, so no test updates were needed.
- **2.6**: added a one-line defensive-legacy-read comment above the
  `source_type === 'user_input'` checks at
  `skills/nn-preflight/scripts/preflight-check.js:401-407` and
  `skills/nn-trannsform/scripts/lib/scanner-core.js:550`. No removal, no
  behavior change; confirmed no test in either skill's test tree asserts
  on `user_input` rejection at these sites.
- **2.7**: added a new numbered item (§4.10) to
  `skills/nn-innfo/SKILL.md`'s "Source Citation Protocol" section (right
  before the `sources::` section's closing `---`) documenting
  `conflicts::`: same pointer-array grammar as `sources::`, validated the
  same way, used to flag 2+ disagreeing Sources, never contributes to
  `node.sources`/Lineage edges, resolved manually via `rationale::`.

All 8 tasks (2.1-2.8) are now genuinely complete and marked `[x]` in
`tasks.md`.

### Verification run for this fix-forward
`node test/run.js unit` in `skills/nn-trannsform`: 511 passed, 0 failed
(includes the new task-2.4 test). Grep of `skills/nn-trannsform/test/`
and `skills/nn-preflight/` confirmed no test depends on the renamed
strings/tags touched by 2.5/2.6.

## WU3 — Catalog / sample migration (non-template files only)

**Status**: Done. Commit `f36db12` "refactor(traceability): migrate
catalog derived_from_inputs to sources (WU3)" on `dev`.

### Task completion
- [x] 3.0 Fresh repo-wide grep re-run (excluding `node_modules`,
  `openspec/changes/archive/**`, frozen `cogNNitive` tree). Confirmed the
  exhaustive candidate list matched design.md/tasks.md exactly — no new
  hits. One additional expected-and-excluded hit found:
  `_samples_nn/procedures/reconcile_artifact_feedback_NN.md:83` (WU4
  scope per tasks.md's explicit note, not touched).
- [x] 3.1 `_samples_nn/artifacts_NN.md` — both `derived_from_inputs::`
  values were genuine resolvable pointers, migrated to `sources::`:
  - `Ghostbusters Business Model` → `sources:: [models/Ghostbusters_business-model_NN.md]`
  - `NYC Paranormal Activity Report 1984` → `sources:: [sources/nn/nyc-paranormal-activity-report-1984.md]`
    (exact title match against the source file's `# NN` heading)
- [x] 3.2 `workspace_NN/artifacts/artifacts_NN.md` — both values were
  unresolvable spec-name prose (no single citable file target exists for
  "iNNfo Language Specification" or "Workspace Metamodel Specification"
  in this repo's own root workspace catalog — these are the literal
  examples design.md's Value Rule cites as non-citable). Moved into the
  existing mandatory `summary::` field as appended prose (not a duplicate
  key, since `summary` is `type:: string` per
  `iNNfo/specs/templates/artifacts/spec_NN.md:45-48`) and the
  `derived_from_inputs::` line was removed.
- [x] 3.3 4 use-case catalogs — all 5 `derived_from_inputs::` occurrences
  were genuine resolvable pointers (each use-case directory has exactly
  one matching `models/*_NN.md` file by filename semantics), migrated to
  `sources::`:
  - `youtube-creator` (×3, same value) → `sources:: [models/Episode_42_Battery_Tech_V_1-0-0_video_script_NN.md]`
  - `freelance-designer` → `sources:: [models/Client_Website_V_1-0-0_site_spec_NN.md]`
  - `consulting-sales` (×2) → `sources:: [models/Fintech_RFP_Response_V_1-0-0_commercial_NN.md]`,
    `sources:: [models/Consulting_Team_Matrix_V_1-0-0_organization_NN.md]`
  - `startup-founder` → `sources:: [models/SaaS_Founder_V_1-0-0_business_NN.md]`
- [x] 3.4 `docs/innfo/samples/lifecycle-ghostbusters/workspace/workspace_V_0-2-0_workspace_NN.md:50`
  — removed the Models catalog `derived_from::` line entirely (B2).
  Verified redundancy first: the three citations it listed
  (`commercial_pricing_memo.md#manhattan-commercial-rates`,
  `commercial_pricing_memo.md#hazardous-entanglement-surcharge`,
  `containment_debrief.md#nn-section--000001`) exactly match the three
  `sources::` values already present on the model's own elements in
  `docs/innfo/samples/lifecycle-ghostbusters/workspace/models/Ghostbusters_Operations_V_1-0-0_NN.md`.
- [x] 3.5 Ran `node test/unit/test-lineage-sync.js` in
  `skills/nn-trannsform` — all assertions pass, including
  "model entry carries model_ref + derived_from from sources::" and
  idempotent-rerun byte-identity checks. Models-catalog lineage output is
  unchanged.

### Files changed (commit `f36db12`)
| File | Migration |
|------|-----------|
| `_samples_nn/artifacts_NN.md` | 2× `derived_from_inputs::` → `sources::` |
| `workspace_NN/artifacts/artifacts_NN.md` | 2× `derived_from_inputs::` → appended `summary::` prose |
| `docs/cognitive_nn/use-cases/youtube-creator/artifacts_NN.md` | 3× `derived_from_inputs::` → `sources::` |
| `docs/cognitive_nn/use-cases/freelance-designer/artifacts_NN.md` | 1× `derived_from_inputs::` → `sources::` |
| `docs/cognitive_nn/use-cases/consulting-sales/artifacts_NN.md` | 2× `derived_from_inputs::` → `sources::` |
| `docs/cognitive_nn/use-cases/startup-founder/artifacts_NN.md` | 1× `derived_from_inputs::` → `sources::` |
| `docs/innfo/samples/lifecycle-ghostbusters/workspace/workspace_V_0-2-0_workspace_NN.md` | Removed redundant `derived_from::` line |

### Excluded / not migrated (with reason)
- `iNNfo/specs/templates/cogNNitive/spec_NN.md`,
  `iNNfo/specs/templates/base/samples/Ghostbusters_cogNNitive_NN.md` —
  frozen `cogNNitive` template tree (`manifest/source.yaml` `frozen_templates`),
  must stay byte-identical, never opened.
- `_samples_nn/procedures/reconcile_artifact_feedback_NN.md:83`,
  `iNNfo/specs/templates/workspace/procedures/reconcile_artifact_feedback_NN.md:83`,
  `iNNfo/specs/templates/artifacts/spec_NN.md:66-69,118` — template/spec
  field definitions, explicitly WU4 scope per tasks.md's note, not this
  run's concern.
- `iNNfo/packages/innfo-mcp/test/apply-change.test.ts`,
  `iNNfo/packages/innfo-core/tests/workspaceSources.test.ts` — test
  fixtures intentionally exercising the legacy key name (WU2's
  `LEGACY_DERIVATION_KEY` and cascade behavior); not catalog content.
- `iNNfo/packages/innfo-mcp/bin/innfo-mcp.bundle.js`,
  `iNNfo/packages/innfo-core/src/schema/canonical-registry.ts` —
  generated bundle / WU4's canonical-registry mirror; not hand-authored.
- `skills/nn-trannsform/scripts/lib/{scanner-core,provenance-model,lineage-check}.js`,
  their test fixtures, `docs/index.md`, `docs/index.html`,
  `docs/innfo/documentation/sources-citations-lineage.md`,
  `docs/innfo/documentation/lifecycle-walkthrough.md`,
  `docs/innfo/samples/lifecycle-ghostbusters/workspace/export/Paranormal_Containment_Brief_V_1-0-0.md` —
  all describe or produce the **computed** lineage-record `derived_from::`
  output (B3: "lineage record keeps its computed derived_from key; lineage
  is never authored"), not authored catalog input. Left untouched per
  scope.
- `openspec/specs/model-mutation-references/spec.md`,
  `openspec/specs/source-normalization-pipeline/spec.md` — living specs
  describing the cascade/normalization behavior around the legacy field
  name; spec-only, out of this change's file-migration scope (already
  covered by WU1/WU2's delta specs where relevant).

## WU4 — Release unit

**Status**: Applied on `dev`. Commits `5eec209` (4a), `c365ba0` (4b), plus
one flagged in-run addition `2b099f5` (4c). Tags `templates-v0.16.0` and
`skills-v2.4.0` cut on `5eec209` and pushed. `dev` pushed. **NOT merged to
`main`** — that push is maintainer-gated and explicitly out of this
change's apply phase.

### Commit 4a — `5eec209` (19 files)
- [x] 4.1 `iNNfo/specs/iNNfo_V_0-2-2_NN.md` created as a copy-forward of
  `V_0-2-1` (write-once: the V_0-2-1 file was not touched). Frontmatter
  `spec_version`/`spec_url` → V_0-2-2; heading `:377` →
  `## Sources & Citations (sources, conflicts)`; `:379` text →
  "cites the Source documents it derives from"; a `conflicts::` bullet
  added after `:386` with the same optionality/bracket-list grammar/scoping
  as `sources::`. Also updated the file's `## Self-Description`
  self-reference (`:926`) from `iNNfo_V_0-2-1_NN.md` to
  `iNNfo_V_0-2-2_NN.md` — the task list did not mention it, but leaving it
  would have made the new version claim to be the old one.
- [x] 4.2 `workspace_spec_NN.md`: `derived_from` Field Definition
  (`:183-187`) deleted; `:160` comment `inventory + provenance` →
  `inventory + lineage` (matched to WU1's house substitution);
  `:373` prose "immutable provenance links" → "immutable Source links";
  `template_version` V_0-5-1 → V_0-6-0; `spec_version`/`parent_spec`
  V_0-2-1 → V_0-2-2. `:370` "SHA-256 provenance hashes" left alone
  deliberately: it is the cryptographic term, it is outside the task list,
  and it survives in the sibling `import_and_*.md` procedures this change
  does not touch — editing it alone would have been isolated scope creep.
- [x] 4.3 `artifacts/spec_NN.md`: `derived_from_inputs` / `type:: string`
  → `sources` / `type:: citation`; description reworded to "Citations to
  the Source documents and domain models this artifact derives from";
  `:87` prose `(produced_by, derived_from_inputs)` → `(produced_by,
  sources)` and "trace output provenance" → "trace output lineage";
  `:118` sample line → `sources:: [sources/nn/source_document.md#section]`
  (pointer-array grammar, since the field is now `type:: citation`, not
  the old `[[Source Name]]` wikilink form); `template_version` V_0-1-0 →
  V_0-2-0; `spec_version`/`parent_spec` → V_0-2-2.
- [x] 4.4 `reconcile_artifact_feedback_NN.md:83` and its `_samples_nn`
  copy: `derived_from_inputs::` → `sources::`. The `:82` tag list
  (`[lineage, provenance, derived-from, dependencies]`) was left alone —
  not in the task list, and `provenance`/`derived-from` survive as tags on
  many untouched procedure files.
- [x] 4.5 `skills/nn-innfo/templates/workspace_spec_NN.md`: byte copy of
  the 4.2 file. Verified the two files were byte-identical *before* the
  edit (sha256 equal), then copied and confirmed sha256 equality after.
- [x] 4.6 `canonical-registry.ts`: `ARTIFACTS_SPEC_CONTENT` and
  `WORKSPACE_SPEC_CONTENT` mirrored to V_0-2-2 (including the
  `derived_from` deletion and the `sources`/`citation` rename); registry
  entry versions bumped (`workspace` V_0-5-1 → V_0-6-0, `artifacts`
  V_0-1-0 → V_0-2-0) with their version aliases added — the task list only
  named the two content blocks and the `innfo` aliases, but leaving the
  entry versions stale would have been drift against the very files being
  mirrored; `innfo` entry gained the V_0-2-2 alias set. `innfo`'s own
  `version: 'V_0-2-0'` and its embedded `INNFO_SPEC_CONTENT` were left as
  design.md's D1 explicitly documents (reservation is not versioned).
  Test: new `resolves the new V_0-2-2 core-language aliases` and
  `mirrors the workspace and artifacts V_0-2-2 templates without drift`
  (frontmatter + `## NN Field Definition:` name-set equality against the
  on-disk files) in `canonical-registry.test.ts`.
- [x] 4.7 4× `SKILL.md` frontmatter bumps: nn-trannsform V_3-3-0 → V_3-4-0,
  nn-innfo V_0-5-2 → V_0-5-3, nn-preflight V_0-2-0 → V_0-2-1,
  nn-start V_3-4-0 → V_3-4-1.
- [x] 4.8 `manifest/source.yaml`: `templates[workspace].version` (`:82`)
  and `templates[artifacts].version` (`:152`) V_0-2-1 → V_0-2-2 (this
  field is `spec_version`, not `template_version`).
- [x] 4.9 Regeneration. `npm run sync:versions` propagated the 4.7 skill
  versions into `manifest/source.yaml`'s `skills[]` and wrote `samples.ts`,
  `iNNfo/specs/templates/catalog.json`, `docs/use/manifest.md`. Two
  generated files the task list's wording ("both `catalog.json` files,
  `docs/use/manifest*.md`") implied but `sync:versions` does not cover were
  regenerated explicitly: `docs/innfo/templates/catalog.json` (a byte copy
  of the specs catalog, which `scripts/build-docs.mjs:107-114` does as one
  step of a much larger run — copied directly to avoid unrelated
  `cdn/manifest.json` timestamp and docsify-suite churn) and
  `docs/use/manifest-next.md` (the preview-channel rendering; needed
  `GITHUB_TOKEN`).
- [x] 4.10 Commit 4a. All four gates green in the shared tree:
  `guard-template-immutability.js` OK, `check:integrity` ALL PASSED,
  `check:spec-urls` OK, `verify.js` OK. `innfo-core` suite: 71 files / 880
  tests passed (1 skipped).
- [x] 4.11 Tags `templates-v0.16.0` + `skills-v2.4.0` created on `5eec209`
  and pushed. Note these also cover the **other session's** `9e77649`
  (design-presets template + video integration), which landed on `dev`
  without tags or a re-pin — one tag pair for one batch, as intended.
- [x] 4.12 Commit 4b (`c365ba0`): `manifest/source.yaml` channel refs
  skills 2.3.0 → 2.4.0, templates 0.15.0 → 0.16.0.
- [x] 4.13 `generate-manifest.js --channel stable` (with `GITHUB_TOKEN`)
  regenerated `docs/use/manifest.md`; refs and commits now resolve to
  `skills-v2.4.0` / `templates-v0.16.0` at `5eec209`.
- [ ] **4.14 NOT GREEN — by construction.** `validate-manifest.js --channel
  stable` was run in a `git worktree add --detach` checkout at `c365ba0`.
  It reports 29 violations, every one belonging to a single family caused
  by one fact: the pinned commit `5eec209` is `ahead` of `main`. The
  breakdown is 25 × `not reachable from main` (all 9 skills, all 16
  templates, and the console asset), 3 × `content ... differs between
  pinned commit and main` (workspace/video/artifacts) and 1 × `404 at main`
  (the brand-new `design-presets/spec_NN.md`) — 29 in total. A filtered
  re-run confirmed **no independent violation** (no missing tag, no hash
  mismatch, no schema error). This state cannot become green inside
  `sdd-apply`: it requires the `dev`→`main` push, which tasks.md itself
  declares out of scope and `nn-dev-development` §4e gates on the
  maintainer. Re-run post-merge.
  **Corrected by the verify pass**: this bullet originally said "for all 9
  skills + 16 templates + 1 console", which sums to 26, not the 25 actually
  reported — the aggregate 29 was right, the per-family prose was off by
  one.
- [x] 4.15 `check:integrity` in the detached worktree: `ALL INTEGRITY
  GATES PASSED`, including Group 1c ("No unpinned skills/template changes
  detected") — the group that catches the "forgot the re-pin" failure
  mode. Caveat: a clean checkout cannot satisfy this gate on its own. Two
  pieces of local state had to be replicated into the worktree because
  they are respectively gitignored and untracked — the
  `docs/innfo/cdn/*.bundle.js` bundles (Group 2) and the nested
  `skills/nn-trannsform/node_modules` (the nn-trannsform suite needs
  `minimist`, which is installed there, not at the root). With those
  absent the run fails for environmental reasons only (2 failures, both
  `Cannot find module 'minimist'`), which is worth knowing before anyone
  reads a red worktree run as a regression.
- [x] **4.16 (added during apply, not in the original task list)** —
  `iNNfo/specs/iNNfo_V_0-2-2_NN.md`: documented `type:: citation`. See
  "Risks / Notes" below for why this was in scope and why it needed no
  tag.

### Files changed
| Commit | Files |
|--------|-------|
| `5eec209` (4a) | 19 files: new `iNNfo_V_0-2-2_NN.md`; `workspace_spec_NN.md`; `artifacts/spec_NN.md`; 2× `reconcile_artifact_feedback_NN.md`; `skills/nn-innfo/templates/workspace_spec_NN.md`; `canonical-registry.ts` + 2 tests; 4× `SKILL.md`; `manifest/source.yaml`; `samples.ts`; 2× `catalog.json`; 2× `docs/use/manifest*.md` |
| `c365ba0` (4b) | `manifest/source.yaml`, `docs/use/manifest.md` |
| `2b099f5` (4c) | `iNNfo/specs/iNNfo_V_0-2-2_NN.md` |

### Risks / Notes
- **The `citation` type gap (task 4.16).** `type:: citation` has been a
  real field type in `iNNfo/packages/innfo-core/src/types/parser.ts`
  (`FIELD_TYPES`, added by `2026-09-13-document-fidelity-and-provenance-integrity`
  AD-5) since September, but **no** L1 spec version — V_0-1-0, V_0-2-0,
  V_0-2-1, or the new V_0-2-2 — ever listed it in the Field Definition
  `type` table or the metaschema `options::`. Nothing in code derives
  allowed types from that table (`FIELD_TYPES` is not imported anywhere),
  and the editor's widget handling is hardcoded, so it was a
  documentation/discoverability gap, not a functional break. It became
  worth closing here because 4.3 makes the `artifacts` template declare
  `type:: citation`, i.e. the spec version this change publishes would
  invoke a type it does not document. Fixing it required no tag and no
  re-pin: `scripts/lib/tag-pin-freshness.js` matches only `^skills\//` and
  `^iNNfo\/specs\/templates\/.*spec_NN\.md$`, and the L1 spec is covered
  by neither; its `spec_url` points at `main`, so the correction reaches
  consumers when the batch merges. **Flagged as a deliberate,
  out-of-task-list addition so `sdd-verify` can judge it on the merits.**
- **The `sdd-verify`-bait items above** — 4.2's `:370` decision, 4.4's
  `:82` tags, the registry entry-version bumps, and the two extra
  regenerated files — are all places where the task list was silent and a
  choice had to be made. Each is stated with its rationale so a fresh-context
  verifier can disagree explicitly rather than discover it.
- **Local-tree incident during this run (repaired).** To make the worktree
  `check:integrity` run whole, a Windows directory junction was created at
  `<worktree>/skills/nn-trannsform/node_modules` pointing at the real
  directory. `git worktree remove --force` then **traversed the junction
  and deleted the target's contents**, emptying
  `skills/nn-trannsform/node_modules` (mammoth, minimist, pdf-parse,
  prompts, xlsx). This surfaced as the main tree's nn-trannsform suite
  going 509/2-failed. Repaired with `npm install` in
  `skills/nn-trannsform` (45 entries restored, all 5 declared deps present)
  and `check:integrity` is green again. The directory is gitignored, so no
  tracked file was affected. Lesson: do not junction `node_modules` into a
  worktree that will be removed — copy it, or accept the environmental
  failures and say so.

## Risks / Notes
- WU2's commits (`7d51d68`, `accc632`) predate this run's `tasks.md`
  checkbox state; `tasks.md` 2.1-2.8 still show `[ ]` even though the
  code landed. This run intentionally did not touch WU2 checkboxes to
  respect its assigned WU3-only scope — flag for the next apply/verify
  pass to reconcile.
- The two `summary::` migrations (workspace_NN/artifacts/artifacts_NN.md)
  interpret design.md's "move it into `summary::` prose" as appending to
  the existing mandatory summary value rather than adding a duplicate
  `summary::` key, since the field spec (`artifacts/spec_NN.md:45-48`)
  defines `summary` as a single `type:: string` value. Flagged here in
  case sdd-verify wants to confirm this interpretation against the
  design's intent.

## WU4 — fresh-context `sdd-verify` outcome

A fresh-context verifier (no prior session history) was run against WU4 on
`469d894`, with instructions to treat every claim in this file as unverified
and to be blunt. Result: **WU4 is genuinely complete-and-correct on `dev`**,
with nothing that must be fixed before the `dev`→`main` merge.

- Verdicts: 4.1-4.13, 4.16 **VERIFIED**; 4.14 **VERIFIED as documented NOT
  GREEN** (reproduced independently: 29 violations, all one family, zero
  independent); 4.15 **PARTIAL** — the exact detached-worktree run was not
  reproducible under the read-only constraint, but its substance (Group 1c
  closes the loop) is covered by the `tag-pin-freshness` unit tests
  ("Template spec_NN.md change without manifest re-pin fails", etc.).
- The verifier independently confirmed: byte-parity of the 4.5 copy (sha256
  `EAF3E718…`, 14866 B both sides); both tags annotated on `origin` at
  `5eec209`; `generate-manifest --check` up to date on stable *and* preview;
  specs vs docs `catalog.json` byte-identical; 4 gates + 880-test innfo-core
  suite green.
- It **agreed with all six** scrutinised judgment calls (4.2's `:370`, 4.4's
  `:82`, the registry entry-version bumps, 4.16's citation documentation, the
  4.14 non-green state, and the drift test's value), with one caveat on the
  last — see below.
- Over-declarations found: two, both minor and both corrected above in this
  file — the 4.14 per-family arithmetic (26 → 25) and the `:376` line
  coordinate (→ `:370`). No claim was contradicted by the repo.

### Advisory 1 — `type:: citation` had no covering requirement (RESOLVED)
The verifier's concern was archive hygiene, not correctness: a shipped
behavior with no requirement in the deltas means `sdd-archive` would sync
something nothing asked for. Fixed by adding an ADDED requirement,
`type:: citation Is Documented in the Core Language`, plus a scenario, to
`specs/document-citations/spec.md`.

### Advisory 2 — the drift guard was weaker than its name (RESOLVED)
The new registry test only compared `## NN Field Definition:` **name sets**
plus the presence of `spec_version: "V_0-2-2"`, so a `type::` change (the
whole point of this WU) could slip through. The verifier proved
*name*-level non-vacuity by feeding the stale `9e77649` mirror; it also
showed a `type:: citation` → `type:: string` mutation still passed.
Fixed by extracting `name=type` pairs instead of bare names. Non-vacuity for
the *type* axis was then proven the same way: mutating the artifacts mirror to
`type:: string` makes the test fail
(`artifacts field name=type drift: expected [ 'format=select', … ] to deeply
equal …`), after which the mutation was reverted and the file confirmed
byte-identical to `HEAD`.

### Out of WU4's scope, flagged for the archive pass (not acted on)
The verifier noted residual "provenance" on surfaces the `provenance-vocabulary`
requirement targets but which belong to WU1, not WU4:
`docs/innfo/documentation/lifecycle-walkthrough.md:160` ("**Radical
Provenance**") and `docs/innfo/documentation/sources-citations-lineage.md:94`
(`buildProvenanceModel`). WU1/WU2/WU3 are already verified and out of this
pass's scope, so these were deliberately left untouched — recorded here so the
archive pass does not lose them.
