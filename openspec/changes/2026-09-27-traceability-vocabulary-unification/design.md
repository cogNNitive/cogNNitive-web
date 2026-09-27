# Design: Traceability Vocabulary Unification (Tanda B)

## Technical Approach

The change is mostly prose. The code touches only a few places, and everything lands on `dev` as four ordered work units (WU). The last unit is the only one that touches a template or spec file, a version, a tag or a pin.

The code is small:

- a separate `conflicts` field set in innfo-core, validated by the existing citation loop
- one read-side legacy-key warning
- the lineage builder reads artifact `sources:` frontmatter
- one generated report stops writing `derived_from`

All line numbers below were checked against the working tree on 2026-09-27.

### Corrections to proposal assumptions (verified)

| Assumption | Reality |
|---|---|
| `derived_from_inputs::` is defined in `workspace_spec_NN.md` | It is not there. It is defined in `iNNfo/specs/templates/artifacts/spec_NN.md:66-69` (`type:: string`) and in the **frozen** `cogNNitive/spec_NN.md:155`. |
| `cogNNitive` template must be migrated | It is listed under `frozen_templates` (`manifest/source.yaml:159-164`) and must stay byte-identical. It is excluded, and so is `base/samples/Ghostbusters_cogNNitive_NN.md`. |
| Something writes `derived_from_inputs` | Nothing does. Every occurrence is hand-authored catalog prose. The `apply-change.ts` cascade does not depend on the key name (0 matches). |
| Something writes Models-catalog `derived_from` | Nothing does, and no code reads it. Undeclared properties are ignored (`model-checks.ts:204-206`, `unknownProperty: 'ignore'`), so once the field is removed, legacy keys would be silently dropped unless something warns. |
| The only real `derived_from` writer on an artifact | `impact-checker.js:285` writes `derived_from: auditModelCitations`. This names a *process*, not an input. |
| `sources/export/` is "feedback" | Feedback is ingested from `sources/import/feedback/*.json` (`scanner-core.js:595`). `sources/export/` is a separate generic walk (`scanner-core.js:275-289`, `isSynthetic: true`). |

## Architecture Decisions

### D1 — Core language `iNNfo_V_0-2-2_NN.md` (patch)

**(b) Is the version bump required by the version machinery?** No.

- `sources::` has been in every core version with the same text: V_0-1-0:375, V_0-2-0:372, V_0-2-1:377. No version bump ever "reserved" it.
- The V_0-2-0→V_0-2-1 precedent is a patch release for a semantic addition (the `/sources/` workspace-root prefix).
- In code, reservation is not versioned. `SOURCE_FIELD_NAMES` (`sourceRef.ts:62`) is a constant, and the registry's `innfo` entry (`canonical-registry.ts:2289-2311`) still embeds **V_0-2-0** content with `version: 'V_0-2-0'`. Nothing checks features against the core version.
- The only thing that forces a new file is the write-once policy (`iNNfo_V_0-2-1_NN.md:710-713`).
- A heading rename alone would not justify a new version. Documenting `conflicts::` does, so the heading fix rides along with it.

**(a) Resulting versions:**

| Artifact | From → To |
|---|---|
| core spec | `iNNfo_V_0-2-1_NN.md` (frozen) → new `iNNfo_V_0-2-2_NN.md` |
| `workspace_spec_NN.md` `template_version` | `V_0-5-1` → `V_0-6-0` (field removed) |
| `artifacts/spec_NN.md` `template_version` | `V_0-1-0` → `V_0-2-0` (field renamed) |
| those two templates' `spec_version` + `parent_spec` | `V_0-2-1` → `V_0-2-2` |
| `manifest/source.yaml` `templates[workspace].version` (:82), `[artifacts].version` (:152) | `V_0-2-1` → `V_0-2-2` (this field means spec_version) |
| nn-trannsform / nn-innfo / nn-preflight / nn-start | `V_3-3-0→V_3-4-0` / `V_0-5-2→V_0-5-3` / `V_0-2-0→V_0-2-1` / `V_3-4-0→V_3-4-1` |
| channel refs (`source.yaml:221,224`) | skills `2.3.0→2.4.0`, templates `0.15.0→0.16.0` |

Other templates stay on V_0-2-1. Mixed spec_versions already exist. The "adopted L1" defaults stay on V_0-2-1 in this change (see Open Questions): `init-model.ts:234,241`, `serializer.ts:174`, editor `constants.ts:13` and `server.ts:345`.

**(c) Tags:** `templates-v0.16.0` and `skills-v2.4.0`. `innfo-mcp` is not released and its bundle is not rebuilt, so the MCP version square is untouched.

**V_0-2-2 content:**
- It is a copy of V_0-2-1, with its frontmatter `spec_version` and `spec_url` updated.
- Heading at :377 → `## Sources & Citations (sources, conflicts)`.
- Text at :379: "establishes traceability to source documents" → "cites the Source documents it derives from".
- After :386, add a `conflicts::` bullet with the same syntax, optionality and scoping as `sources::`. It flags Sources that contradict each other. Validators report it as a warning, and the resolution goes in `rationale::`.

### D2 — `references:` alias: no code change

- The alias exists only as a silent input alias in `scanner-core.js:117-124`.
- The lineage builder (`provenance-model.js`) reads neither `cited_works` nor `references`.
- So the living scenario "Legacy references still read… lineage builder… deprecation note in run log" (`provenance-vocabulary/spec.md:39-43`) was never implemented.
- The delta spec rewrites that scenario so it matches the scanner alias and drops the run-log claim. No code changes.

### D3 — Legacy `derived_from` / `derived_from_inputs`: read-side warning only

| Option | Tradeoff | Decision |
|---|---|---|
| Warn in the lineage builder | It never reads catalogs | Rejected |
| Warn in preflight | JavaScript only; the editor would not see it | Rejected |
| Warn in innfo-core `validateWorkspaceSources` | One place, used by both the editor and MCP; it already walks every element field | **Chosen** |

The rule lives in `workspaceSources.ts`, in the loop at :109-183.

- Trigger pairs:
  - `(any concept, derived_from_inputs)`
  - `(Models, derived_from)`
- Emit `warning LEGACY_DERIVATION_KEY` only when the resolved schema **declares the concept but not the field**.
- This keeps the lineage record quiet:
  - The frozen cogNNitive schema declares `ModelRecords` and not `Models`, so the builder's `# NN Models`/`derived_from` is skipped.
  - When no schema resolves, the rule skips the element too.
- Message: `"<key>" is deprecated — write "sources::" (pointer list); lineage is computed`.

On the write side, the only change is `impact-checker.js:285`: `derived_from:` → `generated_by:`.

### D4 — Synthetic sources: option (b), specs only

There are no code changes to `scanner-core.js` or `scanner-converters.js`. The `sources/export/` walk (:275-289) and the `derived_from:` passthrough for Source frontmatter (:85-88, :643-650) both stay.

The spec is narrowed as follows:
- `is_synthetic: true` is normative for feedback JSON.
- `sources/export/` is kept as a manual drop location that is still tolerated.
- There is no promotion command, and none is planned.

`user_input` is removed from the taxonomy prose. The code checks stay as a defensive legacy read, and each gets a one-line comment:
- `preflight-check.js:401-407`
- `scanner-core.js:550`

Rationale: those checks also cover the `inline:` and `chat:` prefixes, which remain valid. Removing the code would turn any legacy file into a false "dangling source".

### D5 — `conflicts::` is not added to `SOURCE_FIELD_NAMES`

- Adding it would feed `normalize.ts:31`, which would turn conflicts into `node.sources` and `origin:'source'` lineage edges. That would be wrong.
- Instead, add a new `CONFLICT_FIELD_NAMES = new Set(['conflicts'])` in `sourceRef.ts` after :62 and export it from `index.ts:87`.
- In `workspaceSources.ts:114`: `if (!isConflict && !isCitationField(...)) continue`. The reserved name wins over a declared type, and values follow the same KU_* path.
- If at least one pointer is valid, emit one `warning SRC_CONFLICT_FLAGGED` per element.

### D6 — Doc rename

- `docs/innfo/documentation/citations-provenance.md` → `sources-citations-lineage.md`. This matches the existing label "Sources, Citations & Lineage".
- There are 6 inbound files (8 lines): `_sidebar.md:19`, `ai-index.yaml:80-81`, `offline-consoles.md:112`, `llms.txt:18`, `documentation_NN.md:148-149`, `scanner-core.js:119`.
- The living spec `provenance-vocabulary/spec.md:11,19` is updated through the delta.
- No redirect stub: docsify hash routes have no server-side redirects, and a stub would keep "provenance" in a filename. Old bookmarks break (pre-1.0, accepted).

## Data Flow

    author ──sources::/conflicts::──> innfo-core validateWorkspaceSources
                                        ├─ KU_* (same grammar for both)
                                        ├─ SRC_CONFLICT_FLAGGED (warning)
                                        └─ LEGACY_DERIVATION_KEY (warning)
    export/<artifact> frontmatter sources: ──> provenance-model.parseArtifactMeta
                                        └─> lineage record  derived_from::  (computed, B3)

## File Changes (by work unit, in commit order)

**WU1 — prose and vocabulary. No template or spec file, no version change.**

| File | Change |
|---|---|
| `docs/innfo/documentation/citations-provenance.md` | Rename (D6), plus the 6 linkers |
| `skills/nn-trannsform/SKILL.md` | :425 → `#### 3b. Mandatory Citations in Level 3 Models (Bloque 2)`; :480 → `### 4. Citation & Lineage Protocol`; :484, :535, :536, :351 prose; :294 drop the `--provenance` mention (the flag stays as a silent alias, `index.js:30,293`); :120 drop `user_input` |
| `skills/nn-innfo/SKILL.md` | :59 → `## Canonical Source Taxonomy & Citation Contract`; :75 drop `user_input`; prose at :348, :365, :379, :405, :476, :683, :799 |
| `skills/nn-preflight/SKILL.md:88`, `skills/nn-start/SKILL.md:77` | Drop `user_input` and keep `inline:`/`chat:` |
| `openspec/changes/.../specs/*` | Deltas: `provenance-vocabulary`, `source-normalization-pipeline` (replace :51-63), `generic-source-integrity-audit` (:13 prose), `lineage-record-sync` |

**WU2 — code, tests first.**

| File | Change |
|---|---|
| `iNNfo/packages/innfo-core/src/sourceRef.ts`, `index.ts` | `CONFLICT_FIELD_NAMES` |
| `iNNfo/packages/innfo-core/src/validator/workspaceSources.ts` | D3 + D5; :67 and :124 messages drop "provenance" ("Queries are not valid citations") |
| `skills/nn-trannsform/scripts/lib/provenance-model.js` | `parseArtifactMeta` (:404-436) reads a frontmatter `sources:` list; `collectArtifacts` (:460-462) prefers it over model/model_version |
| `skills/nn-trannsform/scripts/lib/impact-checker.js:285` | `generated_by:` |
| `skills/nn-trannsform/scripts/index.js:70,544`, `lib/bootstrap.js:27`, `scanner.js:143` | "provenance model" → "lineage record"; tag `provenance` → `lineage` |
| `skills/nn-preflight/scripts/preflight-check.js:401`, `scanner-core.js:550` | Legacy comment (D4) |
| `skills/nn-innfo/SKILL.md` | Document `conflicts::` |

**WU3 — migrate non-template catalogs and samples.**

Replace `derived_from_inputs::` with `sources::` pointers in:
- `_samples_nn/artifacts_NN.md:24,33`
- `workspace_NN/artifacts/artifacts_NN.md:24,33`
- `docs/cognitive_nn/use-cases/{youtube-creator,startup-founder,freelance-designer,consulting-sales}/artifacts_NN.md`

Also remove Models `derived_from::` from `docs/innfo/samples/lifecycle-ghostbusters/workspace/workspace_V_0-2-0_workspace_NN.md:50`.

**Value rule:** map each value to `models/<file>_NN.md` or `sources/nn/<file>.md`. If a value cannot be cited (for example "iNNfo Language Specification"), move it into `summary::` prose.

**WU4 — release unit. Must be last and isolated.**

| File | Change |
|---|---|
| `iNNfo/specs/iNNfo_V_0-2-2_NN.md` | Create (D1) |
| `iNNfo/specs/templates/workspace_spec_NN.md` | Delete :183-187; :160 comment and :373 prose; version bumps (D1) |
| `iNNfo/specs/templates/artifacts/spec_NN.md` | :66-69 → `sources`, `type:: citation`; :87 prose; :118 sample line; version bumps |
| `iNNfo/specs/templates/workspace/procedures/reconcile_artifact_feedback_NN.md:83` and the `_samples_nn/procedures/` copy | `sources::` |
| `skills/nn-innfo/templates/workspace_spec_NN.md` | Byte-copy of the new workspace template |
| `iNNfo/packages/innfo-core/src/schema/canonical-registry.ts` | Mirror `ARTIFACTS_SPEC_CONTENT` (:415+) and `WORKSPACE_SPEC_CONTENT` (:760+, `derived_from` at :942); add V_0-2-2 aliases at :2301-2308 |
| 4 × `SKILL.md` frontmatter, `manifest/source.yaml` | Versions (D1) |
| Generated files | `npm run sync:versions` → `samples.ts`, both `catalog.json` files, `docs/use/manifest*.md` |

## Migration / Rollout (WU4 sequence)

1. Commit 4a (the content above) on `dev`. Run `node scripts/guard-template-immutability.js`, `npm run check:integrity`, `npm run check:spec-urls` and `node scripts/verify.js`.
2. Tag 4a with annotated tags `templates-v0.16.0` and `skills-v2.4.0`, then push the tags.
3. Commit 4b: bump `source.yaml:221,224`, run `GITHUB_TOKEN=$(gh auth token) node scripts/manifest/generate-manifest.js --channel stable`, then run `validate-manifest.js --channel stable` in a `git worktree add --detach` checkout. It must print OK on **every** axis.
4. `git push origin dev:main` in the same batch. Do not let main see 4a without 4b.

Rollback: WU1-3 revert independently. If WU4 is reverted before the tag is pushed, drop the tag. If the tag has already shipped, cut `templates-v0.16.1`.

## Testing Strategy

| Layer | Test |
|---|---|
| innfo-core unit | A bad `conflicts::` pointer gives the same KU_* code as `sources::`; a valid one gives `SRC_CONFLICT_FLAGGED`; conflicts never appear in `node.sources` or relationships; `SOURCE_FIELD_NAMES` is unchanged (`sourceRef.spec.ts:164-170`); `LEGACY_DERIVATION_KEY` fires for workspace Models and Artifacts, and stays silent for the lineage record and for an unresolved schema |
| nn-trannsform | `test-lineage-sync.js`: artifact `sources:` → `derived_from::`; Models output byte-unchanged. `test-impact-checker.js:109,121` → `generated_by` |
| Release | verify.js, check-integrity, check:spec-urls, detached `validate-manifest --channel stable` |

## Open Questions

- [ ] Should the "adopted L1" defaults move to V_0-2-2 (init-model, serializer, editor, MCP description)? That touches about 6 sites and their tests. The design defers it to a follow-up.
- [ ] MCP users only get `conflicts::` and the legacy warnings at the next innfo-mcp release, when the bundle is rebuilt. Is that acceptable?
- [ ] Some WU3 values have no citable target (spec names). Confirm the "move to `summary::`" rule.
- [ ] Is `skills/nn-innfo/templates/workspace_spec_NN.md` byte-checked by `check-parity.js`? Tasks must verify this.
