# Proposal: Traceability Vocabulary Unification (Tanda B)

## Intent

`provenance-vocabulary` tried to reduce the vocabulary to three nouns: Source, Citation and Lineage. It was never enforced. "provenance" still appears about 380 times, including in user-visible titles and prose. At least five keys still express the same "derived from" relationship: `sources::`, the Models catalog `derived_from`, the Artifacts catalog `derived_from_inputs::` (free text), the lineage record `derived_from`, and nothing at all on artifact frontmatter. Authors cannot tell which key to write, and the Models `derived_from` field can silently drift from the model's own `sources::`.

Rule to formalize: **"You write `sources`. The system computes Lineage. A Source is a file."**

## Scope

### In Scope
- **B1 Write side = `sources`.** Artifacts catalog `derived_from_inputs::` becomes `sources::`, using the same pointer-array grammar as elements. Any artifact MAY carry a new optional `sources:` frontmatter field with the same pointer syntax. This standardizes the field only.
- **B2 Remove the Models catalog `derived_from` field.** It is redundant with the model's own `sources::`, which `collectModels` already scrapes. `generated_by` stays.
- **B3 Read side = Lineage.** The lineage record keeps its computed `derived_from` key. Lineage is never authored.
- **B4 "provenance" leaves user-visible surfaces:**
  - doc titles and filenames: rename `docs/innfo/documentation/citations-provenance.md` to a "Sources & Lineage" name and fix its 6 inbound links (`_sidebar.md`, `llms.txt`, `ai-index.yaml`, `documentation_NN.md`, `offline-consoles.md`, `scanner-core.js` comment)
  - SKILL.md headings and prose (`nn-trannsform` §3b, `nn-innfo`)
  - error and warning strings
  - the core spec heading "Provenance & Traceability (sources)"

  Internal identifiers are renamed where that is cheap. Otherwise they are left as they are.
- **B5 `conflicts::`.** A reserved optional element property with the same grammar as `sources::`. It is validated by the existing citation validator and surfaces as a warning-level diagnostic.
- **B6 Source-type taxonomy.**
  - Drop `source_type: user_input`. It is never emitted, and its meaning folds into conversations.
  - Resolve the unpopulated `sources/export/` synthetic concept. There are two options, (a) and (b). sdd-design decides and should default to (b):
    - (a) a `--promote <artifact>` scanner command
    - (b) narrow "synthetic source" to ingested feedback JSON, and drop export-promotion as unimplemented
- **B7 `cited_works:` audit.** Clarify the prose wherever it could be confused with `sources::`.
- **B8 Version ceremony.** Covers the workspace template `template_version` bump (currently `V_0-5-1`), plus a core-language version if needed (see question 2). This is followed by a `templates-v*` tag and a `manifest/source.yaml` re-pin in the same batch.

### Out of Scope
- Refining per-field citations further. `typed-source-references` already shipped this.
- Moving the model-viewer procedure (Tanda C). Do not touch `compile_model_viewer_NN.md` or the console renderer.
- Citation version-pinning grammar.
- A conflict-resolution workflow and precedence/authority ranking. These stay ad hoc via `rationale::`.
- An artifact-citation renderer. The `resolve_sources` consumer of artifact `sources:` is future work.
- `editAttribution`. It is edit history, not a citation, and stays untouched.
- Renaming openspec capability folders (`provenance-vocabulary`, `*-provenance`). These names are internal and a rename would be churn.

## Capabilities

### New Capabilities
- `artifact-sources-field`: the Artifacts catalog `sources::` and the optional artifact frontmatter `sources:` use the element pointer grammar.
- `source-conflict-flag`: the reserved `conflicts::` property, validated with the citation validator and reported as a warning.

### Modified Capabilities
- `provenance-vocabulary`: "provenance" is banned on every user-visible surface, including the doc filename. There is one written derivation term (`sources`), and the Models `derived_from` field is removed. The status of the `references:` alias is decided here.
- `source-normalization-pipeline`: `user_input` is removed, and synthetic-source semantics follow whichever of (a)/(b) design picks.
- `lineage-record-sync`: artifact entries derive from `sources:` or `sources::` instead of `derived_from_inputs::` prose.

## Approach

Reuse only:
- the citation validator (`isCitationField` and `parseSourceRef`) for artifact `sources` and for `conflicts::`
- `collectModels` for Models lineage

Migration touches `workspace_spec_NN.md`, `_samples_nn/`, `workspace_NN/artifacts/artifacts_NN.md` and the samples. Tests come first (strict TDD).

Commit order on `dev`:
1. Rename commits for code and docs.
2. The `conflicts::` validation commit.
3. A separate, final work unit for the spec version bump plus tag and re-pin.

sdd-tasks' Review Workload Forecast will likely recommend this split. The tag and re-pin must not be buried inside a large diff.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `iNNfo/specs/templates/workspace_spec_NN.md` | Modified | Remove `derived_from`; rename the artifact field to `sources`; version bump |
| `iNNfo/specs/iNNfo_V_0-2-1_NN.md` → possibly new `V_0-2-2` | New (conditional) | Heading rename, `conflicts::` |
| `skills/nn-trannsform/scripts/lib/{provenance-model,scanner-core}.js`, `SKILL.md` | Modified | Artifact `sources`, taxonomy, prose |
| `skills/nn-innfo/SKILL.md`, `skills/nn-preflight/**` | Modified | Prose, `user_input` |
| `iNNfo/packages/innfo-core` validator | Modified | `conflicts::` warning |
| `docs/innfo/documentation/citations-provenance.md` (+6 linkers) | Renamed | "Sources & Lineage" |
| `manifest/source.yaml`, the editor's `SHIPPED_TEMPLATE_VERSIONS` | Modified | Re-pin and registration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The tag and re-pin are forgotten, so `validate-manifest --channel stable` goes red on main (as in the 2026-09-24 incident) | High | A dedicated final work unit. sdd-tasks MUST list the tag, re-pin and `check-integrity` explicitly |
| `conflicts::` needs a new write-once core-language file. This triggers version registration across the editor, core and MCP | Med | Design decides where the field lives. Register the version in the same commit (`recurring-template-version-registration-gap`) |
| Existing workspaces still carry `derived_from` / `derived_from_inputs::` | Med | See question 4 |
| Removing the `references:` alias too early | Low | Keep it one more cycle unless design proves the release window has passed |
| The doc rename breaks links or `check:spec-urls` | Med | Update all 6 linkers and run the link and spec-url checks |

## Rollback Plan

Every work unit is its own revertible commit on `dev`. The version and tag unit goes last. If it has to be reverted before merging to main, do not push the tag. If the tag has already shipped, cut a follow-up `templates-v*` instead of deleting it.

## Dependencies

- Tanda A shipped (`citation-source-resolution`, `typed-source-references`).

## Success Criteria

- [ ] Zero user-visible "provenance" hits in docs, SKILL prose, and emitted messages.
- [ ] No authored `derived_from` or `derived_from_inputs` remains in templates or samples. Lineage output is unchanged for models.
- [ ] `conflicts::` with a bad pointer fails the same way a bad `sources::` does. A valid one yields a warning.
- [ ] `user_input` is absent from the taxonomy. The synthetic-source definition matches the code.
- [ ] `validate-manifest --channel stable` and `check-integrity` pass after the re-pin.

## Proposal question round (for user review)

1. **Synthetic sources:** (b) narrow the concept to feedback JSON (the default), or (a) add `--promote`?
2. **Where `conflicts::` lives:** reserve it in the core language, which needs a new `iNNfo_V_0-2-2_NN.md` that also fixes the "Provenance" heading, or only in the workspace template? The core option is cleaner but costs a language version.
3. **`references:` alias:** remove it now, or keep it one more release? The default assumption is to keep it.
4. **Legacy workspaces:** when a user's workspace still has `derived_from` or `derived_from_inputs::`, should it be silently ignored, trigger a warning, or be auto-migrated by the workspace-template-upgrade procedure?
