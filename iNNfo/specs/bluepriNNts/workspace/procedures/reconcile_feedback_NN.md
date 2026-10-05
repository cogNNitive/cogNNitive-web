---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md"
knowledge_version: "V_0-2-0"
title: "Reconcile Console Feedback Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Tools]]
* [[Artifact]]

# NN Procedure

## NN Procedure: Reconcile Console Feedback
category:: transformation
summary:: Ingests reviewer feedback JSON exports conforming to `console/feedback.schema.json`, evaluates feedback staleness, previews itemized diffs, applies accepted changes via semantic mutations, validates model invariants, logs append-only verdicts to `feedback-ledger.jsonl`, bumps patch version, and regenerates canonical console artifacts.
inputs_required:: [[Feedback JSON]]
outputs_expected:: [[Regenerated Console]]
executed_by:: AI Agent
procedure_model:: procedures/reconcile_feedback_NN.md

# NN Work

## NN Work: Console Feedback Reconciliation Workflow
step_type:: task
condition:: Reviewer feedback JSON dropped in `sources/import/feedback/`
input:: [[Feedback JSON]]
output:: [[Regenerated Console]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
tags:: [procedure, console, feedback, reconciliation, ledger, mutations]
End-to-end reconciliation lifecycle: ingestion, staleness evaluation, diff preview, semantic mutations, invariant validation, append-only verdict ledger logging, version bump, and console re-compilation.

## NN Work: Step 1 - Ingest and Validate Feedback
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 2 - Evaluate Feedback Staleness]]
condition:: Reviewer feedback JSON loaded
input:: [[Feedback JSON]]
output:: [[Loaded Feedback]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
tags:: [ingestion, schema-validation, feedback]
Load feedback file from `sources/import/feedback/` and validate against `iNNfo/specs/bluepriNNts/console/feedback.schema.json`. Ensure `meta` contains `source_knowledge`, `source_knowledge_version`, `author`, `feedback_slug`, `exported_at`, and all `items` contain valid `id` (`fb-NNN`), `kind`, and `target`.

## NN Work: Step 2 - Evaluate Feedback Staleness
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 3 - Preview Diff and Triage Decisions]]
condition:: Feedback loaded and validated
input:: [[Loaded Feedback]]
output:: [[Staleness Report]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [staleness, evaluation, evaluate_feedback_items]
Invoke `evaluate_feedback_items` to evaluate item staleness and orphaned elements against the live model. The tool appends `stale` entries to `feedback-ledger.jsonl` idempotently before any mutations occur. If mismatch is detected, require explicit reviewer confirmation (`confirm_stale: true`) before proceeding.

## NN Work: Step 3 - Preview Diff and Triage Decisions
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: decision
next:: [[Step 4 - Apply Approved Mutations]]
condition:: Staleness cleared
input:: [[Loaded Feedback]]
output:: [[Diff Preview]]
output_status:: draft
tool:: [[AI Agent]]
scope:: internal
tags:: [diff, preview, triage, human-in-the-loop]
Render structured preview of all `pending` items showing original vs proposed values or comments. Solicit human approval per item. Mark accepted items for application and record rejected items.

## NN Work: Step 4 - Apply Approved Mutations
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 5 - Validate Model Invariants]]
condition:: Reviewer approved item triage
input:: [[Diff Preview]]
output:: [[Updated Model]]
output_status:: draft
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [mcp, apply_change, mutations]
Execute semantic mutation calls via `apply_change` for each approved item (`update_field`, `rename_element`, `set_marker`) with explicit `{ rationale, approved_by }`.

## NN Work: Step 5 - Validate Model Invariants
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 6 - Record Feedback Verdicts]]
condition:: Mutations applied
input:: [[Updated Model]]
output:: [[Validated Model]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [validation, validate_knowledge]
Run `validate_knowledge` on the updated model. Invariant validation precedes recording verdicts: on validation failure, abort with diagnostic report — abort path records no applied entry in the ledger.

## NN Work: Step 6 - Record Feedback Verdicts
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
next:: [[Step 7 - Bump Patch Version and Regenerate Console]]
condition:: Model validation passed
input:: [[Validated Model]]
output:: [[Feedback Verdict Ledger]]
output_status:: verified
tool:: [[iNNfo MCP Server]]
scope:: internal
tags:: [ledger, jsonl, record_feedback_verdict, audit-trail]
Invoke `record_feedback_verdict` to append one validated JSONL line per processed item to `feedback-ledger.jsonl` matching `{ v: 1, at: ISO_TIMESTAMP, source: { kind: "console-json", path, sha256 }, item: "fb-NNN", model_id, model_version, element_id, status: "applied"|"rejected", by }`.

## NN Work: Step 7 - Bump Patch Version and Regenerate Console
parent:: [[Console Feedback Reconciliation Workflow]]
step_type:: task
condition:: Verdicts recorded in ledger
input:: [[Validated Model]]
output:: [[Regenerated Console]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
tags:: [version-bump, export, console]
Perform single patch version bump on the model and invoke `scripts/export-console.mjs` to re-export `{Model}_V_{version}_console.html` using canonical `buildConsolePayload` with up-to-date `feedbackState`.

# NN Tools

## NN Tools: AI Agent
scope:: external
Orchestrates feedback ingestion, triage diff preview, and console compilation.

## NN Tools: iNNfo MCP Server
scope:: external
Provides `evaluate_feedback_items`, `record_feedback_verdict`, `apply_change`, `validate_knowledge`, and `build_console_payload` semantic tools.

# NN Artifact

## NN Artifact: Feedback JSON
format:: json
storage:: sources/import/feedback/
description:: Reviewer export conforming to `console/feedback.schema.json`.

## NN Artifact: Loaded Feedback
format:: json
storage:: session_context
description:: Validated in-memory feedback payload.

## NN Artifact: Staleness Report
format:: text
storage:: session_context
description:: Version and hash comparison report generated via `evaluate_feedback_items`.

## NN Artifact: Diff Preview
format:: markdown
storage:: session_context
description:: Structured original-vs-proposed diff preview for reviewer triage.

## NN Artifact: Updated Model
format:: iNNfo
storage:: kNNowledge/
description:: Model with accepted changes applied.

## NN Artifact: Validated Model
format:: iNNfo
storage:: kNNowledge/
description:: Model after passing semantic schema validation via `validate_knowledge`.

## NN Artifact: Feedback Verdict Ledger
format:: jsonl
storage:: feedback-ledger.jsonl
description:: Append-only JSONL verdict ledger at the domain root tracking effective status of all feedback items.

## NN Artifact: Regenerated Console
format:: html
storage:: export/{Model}_V_{version}_console/
description:: Canonical standalone console artifact generated from canonical shell and bundle.
