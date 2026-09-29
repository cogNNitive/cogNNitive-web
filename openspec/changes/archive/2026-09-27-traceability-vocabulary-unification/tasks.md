# Tasks: Traceability Vocabulary Unification (Tanda B)

Structure follows `design.md`'s 4 work-unit ordering exactly. Each WU is committed
separately on `dev`. WU1-WU3 are ordinary work-unit commits. WU4 is a deliberately
isolated release unit with its own final commit(s) and does NOT get pushed to
`main` as part of `sdd-apply` (see WU4 closing note).

Legend: `[spec]` = requirement/scenario this task satisfies, from
`openspec/changes/2026-09-27-traceability-vocabulary-unification/specs/`.

---

## WU1 — Prose and vocabulary only (no code, no template/spec file, no version bump)

Can run fully in parallel internally (all items are independent file edits); no
tests required beyond link/spec-url checks, since nothing here is executable
code.

- [x] 1.1 Rename `docs/innfo/documentation/citations-provenance.md` →
      `docs/innfo/documentation/sources-citations-lineage.md`. Update the `#`
      title to drop "provenance" (target: "Sources, Citations & Lineage",
      matching the existing label design.md cites).
      `[spec: provenance-vocabulary → "Documentation uses only Source /
      Citation / Lineage" → Scenario: Provenance doc rewrite]`
- [x] 1.2 Update all 6 inbound linkers (8 lines) to the new filename/path:
      - `_sidebar.md:19`
      - `ai-index.yaml:80-81`
      - `offline-consoles.md:112`
      - `llms.txt:18`
      - `documentation_NN.md:148-149`
      - `skills/nn-trannsform/scripts/lib/scanner-core.js:119` (comment only —
        no behavior change)
      `[spec: provenance-vocabulary → Scenario: Provenance doc renamed and
      re-linked]`
- [x] 1.3 `skills/nn-trannsform/SKILL.md`: rename headings/prose —
      `:425` → `#### 3b. Mandatory Citations in Level 3 Models (Bloque 2)`;
      `:480` → `### 4. Citation & Lineage Protocol`; prose at `:484, :535,
      :536, :351`; drop the `--provenance` flag mention at `:294` (the flag
      itself stays a silent alias — no code change, see WU2 confirmation
      that `index.js:30,293` keeps accepting it); drop `user_input` at
      `:120`.
      `[spec: provenance-vocabulary → "Documentation uses only Source /
      Citation / Lineage"; source-normalization-pipeline → "user_input Is
      Not a Valid source_type"]`
- [x] 1.4 `skills/nn-innfo/SKILL.md`: `:59` →
      `## Canonical Source Taxonomy & Citation Contract`; drop `user_input`
      at `:75`; prose at `:348, :365, :379, :405, :476, :683, :799`.
      `[spec: same as 1.3]`
- [x] 1.5 `skills/nn-preflight/SKILL.md:88`, `skills/nn-start/SKILL.md:77`:
      drop `user_input` from prose, keep `inline:`/`chat:` prefixes
      documented as valid.
      `[spec: source-normalization-pipeline → "user_input Is Not a Valid
      source_type"]`
- [x] 1.6 Update the delta specs already staged in this change to reflect the
      prose-only scope (no code changes referenced): confirm
      `provenance-vocabulary/spec.md`, `source-normalization-pipeline/spec.md`
      wording doesn't imply code that WU1 doesn't ship. (No edit expected if
      current delta wording already matches — verify only.)
- [x] 1.7 Run link/reference checks: `node scripts/check-spec-urls.js` (or
      repo's actual `check:spec-urls` script name) and any docsify link
      lint available, to confirm no dangling reference to the old filename
      remains.
      `[spec: provenance-vocabulary → Scenario: Provenance doc renamed and
      re-linked]`

---

## WU2 — Code, tests first (strict TDD)

Sequential: write/adjust the failing test for each item before the
implementation edit. Items 2.1-2.3 can be implemented in parallel by
different files since they touch disjoint modules; 2.4 depends on 2.1-2.2
existing first (workspaceSources.ts references `CONFLICT_FIELD_NAMES`).

- [x] 2.1 `iNNfo/packages/innfo-core/src/sourceRef.ts`: add
      `CONFLICT_FIELD_NAMES = new Set(['conflicts'])` after `:62`. Export it
      from `iNNfo/packages/innfo-core/src/index.ts:87`.
      Test first: extend `sourceRef.spec.ts` — assert
      `CONFLICT_FIELD_NAMES` contains exactly `'conflicts'`, and assert
      `SOURCE_FIELD_NAMES` is unchanged (`sourceRef.spec.ts:164-170` already
      pins this — do not let it regress).
      `[spec: document-citations → "conflicts:: Is a Reserved Element
      Property Validated Like sources::"]`
- [x] 2.2 `iNNfo/packages/innfo-core/src/validator/workspaceSources.ts`
      (loop at `:109-183`):
      - Implement D5: at `:114`, `if (!isConflict && !isCitationField(...))
        continue`, so `conflicts::` values follow the same KU_* validation
        path as `sources::` but are NEVER written into `SOURCE_FIELD_NAMES`
        / `normalize.ts` node.sources or relationship edges.
      - Emit one `warning SRC_CONFLICT_FLAGGED` per element with at least
        one valid `conflicts::` pointer.
      - Implement D3: emit `warning LEGACY_DERIVATION_KEY` for trigger pairs
        `(any concept, derived_from_inputs)` and `(Models, derived_from)`,
        ONLY when the resolved schema declares the concept but not the
        field (so the frozen `cogNNitive` schema — which declares
        `ModelRecords`, not `Models` — stays silent, and an unresolved
        schema stays silent). Message:
        `"<key>" is deprecated — write "sources::" (pointer list); lineage
        is computed`.
      - Drop "provenance" from the two message strings at `:67` and `:124`
        (e.g. "Queries are not valid citations").
      Tests first (add to the validator's existing spec file):
      - a malformed `conflicts::` pointer produces the same KU_* code a
        malformed `sources::` value would;
      - a valid `conflicts::` pointer produces `SRC_CONFLICT_FLAGGED` and
        no KU_* error;
      - a `conflicts::` pointer never appears in `node.sources` or in any
        relationship edge after normalization;
      - `LEGACY_DERIVATION_KEY` fires for a workspace Models entry carrying
        `derived_from` and for an Artifacts entry carrying
        `derived_from_inputs::`;
      - `LEGACY_DERIVATION_KEY` stays silent for the frozen cogNNitive
        `ModelRecords` schema and for an element with no resolved schema.
      `[spec: document-citations → all 4 scenarios; provenance-vocabulary →
      "Legacy Derivation Keys Are Deprecated Read-Only Aliases" → both
      scenarios]`
- [x] 2.3 `skills/nn-trannsform/scripts/lib/impact-checker.js:285`: change
      `lines.push('derived_from: auditModelCitations');` to
      `lines.push('generated_by: auditModelCitations');` — this is the one
      confirmed writer bug (verified against the current working tree:
      the line writes `derived_from` naming a *process*, not an input,
      which is semantically wrong per this change's vocabulary rule).
      Test first: update `test-impact-checker.js:109,121` to assert the
      generated report frontmatter carries `generated_by:` and never
      `derived_from:`.
      `[spec: provenance-vocabulary → "Single Written Derivation Term Is
      sources"]`
- [x] 2.4 `skills/nn-trannsform/scripts/lib/provenance-model.js`:
      `parseArtifactMeta` (`:404-436`) reads an optional frontmatter
      `sources:` list on artifacts; `collectArtifacts` (`:460-462`) prefers
      it over `model`/`model_version` when both are present.
      Test first: `test-lineage-sync.js` — an artifact with frontmatter
      `sources:` produces a lineage record `derived_from::` computed from
      that list; Models catalog lineage output stays byte-unchanged for
      inputs that don't use the new field.
      `[spec: provenance-vocabulary → "Artifact derivation is authored as
      sources" scenario]`
- [x] 2.5 Rename "provenance model" → "lineage record" and tag
      `provenance` → `lineage` in `skills/nn-trannsform/scripts/index.js:70,
      544`, `lib/bootstrap.js:27`, `scanner.js:143`. No behavior change —
      verify existing tests referencing the old tag/string are updated,
      not just the source.
      `[spec: provenance-vocabulary → "Documentation uses only Source /
      Citation / Lineage"]`
- [x] 2.6 `skills/nn-preflight/scripts/preflight-check.js:401-407`,
      `skills/nn-trannsform/scripts/lib/scanner-core.js:550`: add a
      one-line comment noting these `user_input`-adjacent checks are
      defensive legacy reads that also cover `inline:`/`chat:` (which
      remain valid) — no removal, no behavior change. Confirm no test
      currently asserts on `user_input` being rejected here in a way that
      would need updating.
      `[spec: source-normalization-pipeline → "user_input Is Not a Valid
      source_type"]`
- [x] 2.7 `skills/nn-innfo/SKILL.md`: document `conflicts::` (new prose,
      not a rename — additive to WU2 since it documents new validator
      behavior from 2.1-2.2).
      `[spec: document-citations]`
- [x] 2.8 Spec-only correction (no code): confirm design.md's D2 finding
      that the `references:` alias scenario needs a spec fix, not a code
      fix. Verified against the working tree: `scanner-core.js:117-124`
      silently aliases `references:` → `cited_works` on input with no
      logged deprecation note, and `provenance-model.js` (the lineage
      builder) reads neither key directly. This means the BASE spec's
      existing scenario at `openspec/specs/provenance-vocabulary/spec.md:
      39-43` ("Legacy references still read" — claims "the lineage builder
      parses it" and "a deprecation note in the run log") is aspirational
      and was never implemented. Add a MODIFIED Requirement to this
      change's `specs/provenance-vocabulary/spec.md` delta that supersedes
      that scenario: the alias is read by the scanner's input-normalization
      step (not the lineage builder), and no deprecation note is logged
      this cycle. Do not write new logging code to make the old scenario
      true — the spec was wrong, not the code.
      `[spec: provenance-vocabulary — new MODIFIED requirement to be added
      in this task, superseding the base spec's :39-43 scenario]`

---

## WU3 — Catalog / sample migration (non-template files only)

Sequential per file (each migration is a small, reviewable diff); the file
list below is exhaustive — verified by grep against the working tree, not
copied blindly from design.md.

**Explicitly excluded — do not touch:** `iNNfo/specs/templates/cogNNitive/spec_NN.md`
and `docs/innfo/samples/lifecycle-ghostbusters/... base/samples/Ghostbusters_cogNNitive_NN.md`
equivalents under the frozen `cogNNitive` template tree (`manifest/source.yaml`
`frozen_templates`, `:159-164`). These must stay byte-identical. Do not open
a task item against them, even a "read-only confirm" one, beyond the exclusion
check in 3.0.

- [x] 3.0 Grep-confirm the exhaustive file list before editing:
      `rg derived_from_inputs` and `rg "derived_from:"` (excluding
      `node_modules`, `openspec/changes/archive/**`, and the frozen
      `cogNNitive` tree) across the repo. Cross-check against the list
      below; if new hits appear that aren't in this list or in WU4's list,
      stop and re-derive design.md's assumptions before continuing.
- [x] 3.1 `_samples_nn/artifacts_NN.md:24,33` — replace
      `derived_from_inputs::` with `sources::` pointers where the value is a
      genuine resolvable pointer (map to `models/<file>_NN.md` or
      `sources/nn/<file>.md`); move to a new `summary::` field where the
      value is unresolvable free text (e.g. "iNNfo Language Specification").
      `[spec: provenance-vocabulary → "Artifact derivation is authored as
      sources"]`
- [x] 3.2 `workspace_NN/artifacts/artifacts_NN.md:24,33` — same migration
      rule as 3.1.
- [x] 3.3 `docs/cognitive_nn/use-cases/youtube-creator/artifacts_NN.md`,
      `docs/cognitive_nn/use-cases/freelance-designer/artifacts_NN.md`,
      `docs/cognitive_nn/use-cases/consulting-sales/artifacts_NN.md`,
      `docs/cognitive_nn/use-cases/startup-founder/artifacts_NN.md` — same
      migration rule as 3.1, applied to each of the 4 files.
- [x] 3.4 `docs/innfo/samples/lifecycle-ghostbusters/workspace/
      workspace_V_0-2-0_workspace_NN.md:50` — remove the Models catalog
      `derived_from::` field entirely (per B2 — Models derivation is read
      from the model's own `sources::`, not a separate field). Confirm this
      file is NOT part of the frozen `cogNNitive` sample tree before
      editing (it is a workspace-template sample, not the cogNNitive
      template).
- [x] 3.5 Run the WU2 lineage-sync test (`test-lineage-sync.js`) and any
      Models-catalog test against the migrated samples to confirm lineage
      output for models is unchanged (Success Criteria: "Lineage output is
      unchanged for models").
      `[spec: provenance-vocabulary → "Model derivation is read from
      sources, not a separate field"]`

Note for apply: `iNNfo/specs/templates/artifacts/spec_NN.md:66-69` (the
`derived_from_inputs::` field DEFINITION, `type:: string`) and
`iNNfo/specs/templates/workspace/procedures/reconcile_artifact_feedback_NN.md:83`
plus its `_samples_nn/procedures/` copy are template/spec files and belong to
WU4, not here — do not migrate them in WU3 even though they also match the
grep in 3.0.

---

## WU4 — Release unit (isolated, own final commit(s), does NOT push to main)

This is a version/tag/re-pin unit. Every item below must land as its own
reviewable commit sequence on `dev`, in the exact order design.md specifies
(4a before 4b, tag push before re-pin, re-pin before `dev`→`main` — and the
`dev`→`main` push itself is explicitly OUT of scope for this SDD change's
apply phase, see closing note).

- [x] 4.1 Create `iNNfo/specs/iNNfo_V_0-2-2_NN.md` as a copy-forward of
      `iNNfo_V_0-2-1_NN.md` (frozen — do not edit the V_0-2-1 file itself,
      per the write-once policy at `iNNfo_V_0-2-1_NN.md:710-713`):
      - update frontmatter `spec_version` and `spec_url`;
      - heading at `:377` → `## Sources & Citations (sources, conflicts)`;
      - text at `:379`: "establishes traceability to source documents" →
        "cites the Source documents it derives from";
      - after `:386`, add a `conflicts::` bullet with the same syntax,
        optionality, and scoping as `sources::`.
      `[spec: document-citations; provenance-vocabulary → Scenario:
      Core-language heading no longer says "Provenance"; template-release-
      tagging]`
- [x] 4.2 `iNNfo/specs/templates/workspace_spec_NN.md`: delete `:183-187`
      (the `derived_from` field definition); update `:160` comment and
      `:373` prose; bump `template_version` `V_0-5-1` → `V_0-6-0`; bump
      `spec_version`/`parent_spec` `V_0-2-1` → `V_0-2-2`.
- [x] 4.3 `iNNfo/specs/templates/artifacts/spec_NN.md`: rename the field
      definition at `:66-69` (verified location — NOT `workspace_spec_NN.md`,
      per design.md's correction) from `derived_from_inputs`, `type::
      string` to `sources`, `type:: citation`; update prose at `:87` and
      the sample line at `:118`; bump `template_version` `V_0-1-0` →
      `V_0-2-0`; bump `spec_version`/`parent_spec` `V_0-2-1` → `V_0-2-2`.
- [x] 4.4 `iNNfo/specs/templates/workspace/procedures/
      reconcile_artifact_feedback_NN.md:83` and its
      `_samples_nn/procedures/reconcile_artifact_feedback_NN.md` copy:
      update to `sources::`.
- [x] 4.5 `skills/nn-innfo/templates/workspace_spec_NN.md`: byte-copy of
      the new workspace template from 4.2. **Verified**: no automated check
      enforces byte parity here — `scripts/manifest/check-parity.js` only
      compares a template's declared version against
      `manifest/source.yaml`'s top-level `templates[]` entries (by path
      listed in the manifest), and `skills/nn-innfo/templates/
      workspace_spec_NN.md` is not one of those listed paths (only
      `skills/nn-innfo`'s own `SKILL.md` version is checked there).
      `scripts/guard-template-immutability.js` also does not reference this
      path. This answers design.md's open question: the byte-copy is a
      manual discipline, not machine-enforced — diff the two files by hand
      before committing.
- [x] 4.6 `iNNfo/packages/innfo-core/src/schema/canonical-registry.ts`:
      mirror `ARTIFACTS_SPEC_CONTENT` (`:415+`) and `WORKSPACE_SPEC_CONTENT`
      (`:760+`, remove `derived_from` at `:942`); add V_0-2-2 aliases at
      `:2301-2308`.
      Test: extend whatever registry test currently pins the V_0-2-0 entry
      content to also assert the new V_0-2-2 entry mirrors the updated
      templates exactly (no drift between the `.ts` mirror and the `.md`
      source files).
- [x] 4.7 Bump 4 × `SKILL.md` frontmatter versions:
      `nn-trannsform` `V_3-3-0` → `V_3-4-0`, `nn-innfo` `V_0-5-2` →
      `V_0-5-3`, `nn-preflight` `V_0-2-0` → `V_0-2-1`, `nn-start`
      `V_3-4-0` → `V_3-4-1`.
- [x] 4.8 `manifest/source.yaml`: bump `templates[workspace].version`
      (`:82`) and `templates[artifacts].version` (`:152`) from `V_0-2-1` to
      `V_0-2-2` (this field means `spec_version`, not `template_version` —
      confirmed by design.md's D1 correction; do not confuse the two axes).
      Do NOT bump this file's channel refs yet — that's step 4.13 (part of
      commit 4b, after the tag push, per the exact sequencing below).
- [x] 4.9 Regenerate: `npm run sync:versions` → `samples.ts`, both
      `catalog.json` files, `docs/use/manifest*.md`.
- [x] 4.10 **Commit 4a** (items 4.1-4.9 above) on `dev`. Run, in order:
      `node scripts/guard-template-immutability.js`,
      `npm run check:integrity`, `npm run check:spec-urls`,
      `node scripts/verify.js`. All must pass before proceeding.
- [x] 4.11 Cut annotated tags `templates-v0.16.0` and `skills-v2.4.0` on
      commit 4a. Push the tags.
      `[spec: template-release-tagging → "Version bump, tag, and re-pin
      land together"]`
- [x] 4.12 **Commit 4b**: bump `manifest/source.yaml` channel refs
      (`:221,224`): `skills` `2.3.0` → `2.4.0`, `templates` `0.15.0` →
      `0.16.0`.
- [x] 4.13 Run
      `GITHUB_TOKEN=$(gh auth token) node scripts/manifest/generate-manifest.js --channel stable`.
- [ ] 4.14 Run `validate-manifest.js --channel stable` inside a
      `git worktree add --detach` checkout (not the shared working tree —
      per this repo's concurrency rules). It must print OK on every axis.
      **NOT GREEN — cannot be green before the `dev`→`main` merge, which is
      out of scope for `sdd-apply`.** Run at `c365ba0` in a detached
      worktree: 29 violations, all of a single family — the pinned commit
      `5eec209` is `ahead` of `main` (`not reachable from main`,
      `content ... differs between pinned commit and main`,
      `404 at main` for the new `design-presets` path). No independent
      violation exists. Re-run after the maintainer-gated batch merge; see
      `apply-progress.md` § WU4.
      `[spec: template-release-tagging → "validate-manifest and
      check-integrity pass after the re-pin"]`
- [x] 4.15 Run `npm run check:integrity` again against the detached
      worktree to confirm the re-pin closes the loop (catches the exact
      failure mode `template-release-tagging`'s "Forgetting the re-pin is
      caught before merge" scenario describes, if it were ever forgotten).
      Passed: `ALL INTEGRITY GATES PASSED`, including Group 1c
      ("No unpinned skills/template changes detected"). Required
      replicating two gitignored/untracked local build artifacts into the
      worktree (CDN bundles; the nested
      `skills/nn-trannsform/node_modules`) — a clean checkout has neither,
      see `apply-progress.md` § WU4 for the caveat.
- [x] 4.16 **(added during apply — not in the original task list)**
      `iNNfo/specs/iNNfo_V_0-2-2_NN.md`: document `type:: citation` in the
      Field Definition `type` table (`:114`), the metaschema `options::`
      list, and a new "Citation Fields" paragraph. `citation` has existed
      in `parser.ts`'s `FIELD_TYPES` since
      `2026-09-13-document-fidelity-and-provenance-integrity` (AD-5) but was
      never documented in any L1 version; task 4.3 makes the `artifacts`
      template declare it, which surfaces the omission in the very spec
      version this change publishes. No tag or re-pin needed: the L1 spec
      is not under `iNNfo/specs/templates/` nor `skills/`
      (`scripts/lib/tag-pin-freshness.js` regexes), and its `spec_url`
      resolves from `main`.

**STOP — out of scope for this SDD change's apply phase**: design.md's
step 4 (`git push origin dev:main` in the same batch as 4a+4b) is NOT part
of `sdd-apply`. WU4 prepares and validates everything on `dev` and stops
after 4.15. Pushing `dev` → `main` is a separate, maintainer-gated step per
`nn-dev-development`'s batched-merge process (Section 4e) and must be
performed outside this change's automated apply.

Rollback: if WU4 is reverted before the tag is pushed (i.e., before 4.11),
drop the tag. If the tag has already shipped, cut a follow-up
`templates-v0.16.1` instead of deleting it.

---

## Cross-cutting / deferred (Open Questions from design.md — not part of this change's task list)

Do not action these as part of `sdd-apply`; they are explicitly deferred:
- Moving the "adopted L1" defaults to V_0-2-2 (`init-model.ts:234,241`,
  `serializer.ts:174`, editor `constants.ts:13`, `server.ts:345`) — deferred
  to a follow-up.
- `innfo-mcp` users only get `conflicts::` and the legacy warnings at the
  next `innfo-mcp` release (bundle rebuild) — accepted, not blocking.

---

## Review Workload Forecast

- **Chained PRs recommended**: N/A in the GitHub-PR sense — this repo uses a
  single-`dev`-branch batched-merge workflow, not per-slice PRs. Translated:
  WU1-WU3 land as three ordinary, independently-revertible work-unit commits
  on `dev`. WU4 is deliberately its own isolated final commit set, sequenced
  internally (4a tag-push before 4b re-pin), and does not merge to `main`
  within this change's `sdd-apply` — that push is a separate maintainer-
  gated step.
- **400-line budget risk**: High. WU4 alone touches 2 template spec files, 1
  new core-language spec file, a TypeScript schema mirror
  (`canonical-registry.ts`, two large content blocks), 4 SKILL.md frontmatter
  bumps, `manifest/source.yaml`, and several generated files
  (`samples.ts`, `catalog.json` × 2, `docs/use/manifest*.md`). WU3 alone
  touches 6 catalog/sample files. Combined, this change is large; if this
  were a GitHub-PR-chained repo it would clearly warrant splitting by WU.
  As-is, expect each work-unit commit (especially WU4's 4a) to individually
  exceed a typical 400-line single-PR budget once generated-file diffs are
  included.
- **Decision needed before apply**: Yes, but already resolved by proposal.md
  and design.md, not left open for `sdd-apply` to re-litigate: (1) synthetic
  sources = option (b), decided; (2) `conflicts::` lives in the core
  language, decided (D1); (3) `references:` alias stays one more cycle,
  spec-only correction, decided (D2/2.8); (4) legacy workspaces get a
  read-side warning, decided (D3). The only thing `sdd-apply` must actively
  gate on is the WU4 sequencing (4a fully green before tag push, tag push
  before re-pin, re-pin validated in a detached worktree before treating
  WU4 as done) and the explicit non-push-to-main boundary.
