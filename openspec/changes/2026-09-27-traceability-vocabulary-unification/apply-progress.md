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

**Status**: Out of scope for this run (explicitly deferred per the
apply-phase instruction). Not started.

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
