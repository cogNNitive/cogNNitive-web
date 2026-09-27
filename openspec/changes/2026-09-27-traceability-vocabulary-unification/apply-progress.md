# Apply Progress: Traceability Vocabulary Unification (Tanda B)

## WU1 — Prose and vocabulary only

**Status**: Done (per prior session — commits `2464230`, `0ec15c3` context).

All 7 tasks (1.1-1.7) marked `[x]` in `tasks.md`: doc rename
(`citations-provenance.md` → `sources-citations-lineage.md`), 6 inbound
linkers updated, `nn-trannsform`/`nn-innfo`/`nn-preflight`/`nn-start`
SKILL.md prose and `user_input` drops, delta-spec wording verified,
link/spec-url checks run.

## WU2 — Code, tests first (strict TDD)

**Status**: Done (per commits `7d51d68` "feat(innfo-core): add conflicts::
and legacy-derivation-key diagnostics" and `accc632` "fix(nn-trannsform):
impact report frontmatter uses generated_by").

Covers tasks 2.1-2.8: `CONFLICT_FIELD_NAMES` in `sourceRef.ts`/`index.ts`,
`workspaceSources.ts` D3+D5 (`SRC_CONFLICT_FLAGGED`,
`LEGACY_DERIVATION_KEY`, "provenance" dropped from message strings),
`impact-checker.js:285` → `generated_by:`, "provenance model" → "lineage
record" renames, `user_input`-adjacent legacy-read comments,
`nn-innfo` `conflicts::` documentation, and the `references:` alias
spec-only correction (2.8).

Note: `tasks.md`'s WU2 checkboxes were not yet flipped to `[x]` in the
artifact by the prior session despite the commits landing — this run
(WU3-scoped) did not re-touch WU2 checkboxes to stay within its assigned
scope; a follow-up should reconcile `tasks.md` 2.1-2.8 against those two
commits.

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
