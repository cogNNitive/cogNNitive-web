---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Apply Feedback Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Apply Feedback
step_type:: task
parent:: -
next:: -
condition:: A reviewer feedback JSON conforming to `console/feedback.schema.json` is loaded
input:: [[Feedback JSON]]
output:: [[Regenerated Console]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Carry accepted reviewer items back into the active model with staleness protection and patch-bump versioning: check `source_model_version` against the live model, preview the diff, apply accepted items via `innfo-mcp apply_change` (one call per item), run `validate_model`, bump the patch version, and regenerate the stable-name console `{Model}_V_{version}_console.html`. Timestamped console copies are archive-only. Never auto-apply without reviewer confirmation of the preview.

## NN Work: Load Feedback
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Check Staleness]]
condition:: Procedure starts
input:: [[Feedback JSON]]
output:: [[Loaded Feedback]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Load the feedback file from `sources/import/feedback/` (normalized under `sources/nn/import/feedback/` via `nn-trannsform --scan`, citable with `sources::`). Validate it against `iNNfo/specs/templates/console/feedback.schema.json`: `meta` carries `source_model`, `source_model_version` (`V_x-y-z`), `artifact`, `artifact_version`, `exported_at` (ISO-8601 with seconds), `author`, `feedback_slug`, and `viewer`; every item carries `id` (`fb-NNN`), `kind` (`correction`|`comment`|`new`|`delete`), `target`, and `status`. Reject the file with a report when validation fails.

## NN Work: Check Staleness
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Preview Diff]]
condition:: Feedback loaded
input:: [[Loaded Feedback]]
output:: [[Staleness Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Compare `meta.source_model_version` to the live `model_version` of the active model. On mismatch, block and emit a staleness report naming both versions; proceed only after the reviewer explicitly confirms the stale base. On match, record fresh and continue.

## NN Work: Preview Diff
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Apply Accepted Items]]
condition:: Staleness cleared
input:: [[Loaded Feedback]]
output:: [[Diff Preview]]
output_status:: draft
tool:: [[AI Agent]]
scope:: internal
Render one preview entry per `pending` item: `id`, `kind`, target (`element_id`/`concept`/`element`/`field`/`matrix`), `original` vs `proposed` (or `comment` for comments and deletes). Present the preview and proceed only with explicit reviewer approval per item; mark declined items `rejected` in the working copy.

## NN Work: Apply Accepted Items
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Validate Model]]
condition:: Diff preview approved
input:: [[Diff Preview]]
output:: [[Updated Model]]
output_status:: draft
tool:: [[innfo-mcp apply_change]]
scope:: internal
Apply exactly one `apply_change` call per approved item with `{rationale, approved_by: "user"}`: `update_field{conceptName, elementName, fieldName, value}` for corrections, `rename_element{…, newName}` for renames, `set_marker{…, markerName}` for marker changes. Mark each applied item `applied` in the working copy.

## NN Work: Validate Model
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Bump Patch Version]]
condition:: Items applied
input:: [[Updated Model]]
output:: [[Validated Model]]
output_status:: verified
tool:: [[innfo-mcp validate_model]]
scope:: internal
Run `validate_model` on the updated model. On failure, abort the run with the validation report: no version bump and no console rewrite. On success, continue.

## NN Work: Bump Patch Version
parent:: [[Apply Feedback]]
step_type:: task
next:: [[Regenerate Console]]
condition:: Model validated
input:: [[Validated Model]]
output:: [[Versioned Model]]
output_status:: verified
tool:: [[innfo-mcp bump_version]]
scope:: internal
Run a single `bump_version{bump: "patch"}` after all items are applied and validated. Never bump per item and never bump when validation failed or the run aborted.

## NN Work: Regenerate Console
parent:: [[Apply Feedback]]
step_type:: task
next:: -
condition:: Patch version bumped
input:: [[Versioned Model]]
output:: [[Regenerated Console]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Regenerate the business consoles from `artifact_blueprint.html`: declare `needs[]` in `innfo-config` (pins resolve via `console/needs-registry.json`), populate the `innfo-schema`/`innfo-model` slots, reference the single-file console bundle via static script tags, and ship the vendored `innfo-console.bundle.js` next to the console for offline double-click. Save under the stable name `{Model}_V_{version}_console.html`; timestamped copies are archive-only.

# NN Tools

## NN Tools: AI Agent
scope:: external
LLM agent (e.g. OpenCode Desktop) that loads the feedback, renders the preview, routes each accepted item through `innfo-mcp`, and regenerates the console.

## NN Tools: innfo-mcp apply_change
scope:: external
Model mutation contract: `update_field`, `rename_element`, `set_marker`, each with `{rationale, approved_by}`. One call per accepted feedback item.

## NN Tools: innfo-mcp validate_model
scope:: external
Post-apply gate. Failure aborts the run with no bump and no console rewrite.

## NN Tools: innfo-mcp bump_version
scope:: external
Single `{bump: "patch"}` after successful validation of all applied items.

# NN Artifact

## NN Artifact: Feedback JSON
type:: spec
format:: json
Reviewer export conforming to `console/feedback.schema.json`, ingested via `sources/import/feedback/`.

## NN Artifact: Loaded Feedback
type:: data
format:: json
Validated in-memory feedback payload ready for the staleness check.

## NN Artifact: Staleness Report
type:: report
format:: status
Fresh confirmation or version-mismatch block naming pinned vs live `model_version`.

## NN Artifact: Diff Preview
type:: report
format:: markdown
Per-item original-vs-proposed preview awaiting reviewer approval.

## NN Artifact: Updated Model
type:: data
format:: markdown
Active model with approved items applied, pending validation.

## NN Artifact: Validated Model
type:: data
format:: markdown
Active model after a passing `validate_model` run.

## NN Artifact: Versioned Model
type:: data
format:: markdown
Active model after the single patch bump.

## NN Artifact: Regenerated Console
type:: deliverable
format:: html
Blueprint console saved as `{Model}_V_{version}_console.html` with the vendored runtime alongside.
