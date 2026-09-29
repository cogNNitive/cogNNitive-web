---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Create Timeline Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Create Timeline
step_type:: task
parent:: -
next:: -
condition:: Workspace models available and the console activation gate is open
input:: [[Source Workspace Models]]
output:: [[Console HTML]]
output_status:: verified
tool:: [[AI Agent]]
Generate a standalone Timeline console from a workspace: analyze its models, agree a metric plan with the user, build (or complete) the L3 metrics model, check the console activation gate, snapshot the model into the innfo-model slots (meta + rows + pre-computed series-as-data), and verify headless with zero page errors. The procedure replaces the old version-and-archive step with the Apply Feedback loop (see [[Apply Feedback]]): the console is a frozen snapshot that only changes through reviewer feedback, never through manual re-versioning. RESOLUTION RECORD (code-as-slot): series-as-data was ADOPTED; the executable-logic slot (FORMULAS/DEPS/SERIES as JS inside the slot) was REJECTED because it breaks the two-slot contract, needs eval, and harms `file://` safety — this procedure contains no eval-based slot path.

## NN Work: Analyze Workspace Models
parent:: [[Create Timeline]]
step_type:: task
next:: [[Confirm Metric Plan]]
condition:: Procedure starts
input:: [[Source Workspace Models]]
output:: [[Metric Plan]]
output_status:: draft
tool:: [[AI Agent]]
Read the workspace index and its L3 models plus normalized sources. Extract every quantifiable fact (amounts, rates, counts, periods, horizons) and map each to proposed Metrics / Variables / Evolution / Scenario rows with per-row source references. Consolidate measured historical series (past months with actual values, typed as historical scenarios) alongside projection assumptions. Flag figures that are missing, ambiguous, or contradictory as open questions instead of inventing them.

## NN Work: Confirm Metric Plan
parent:: [[Create Timeline]]
step_type:: task
next:: [[Build Metrics Model]]
condition:: Metric plan drafted
input:: [[Metric Plan]]
output:: [[Metric Plan]]
output_status:: approved
tool:: [[AI Agent]]
Present the proposed rows, their source traceability, and the open questions. Proceed only with explicit user approval; adjust scope, row set, or horizons on request.

## NN Work: Build Metrics Model
parent:: [[Create Timeline]]
step_type:: task
next:: [[Check Activation Gate]]
condition:: Metric plan approved
input:: [[Metric Plan]]
output:: [[Metrics Model]]
output_status:: verified
tool:: [[AI Agent]]
Create the L3 metrics model from the approved plan (Metrics with metricType, Variables, Evolution rules, Scenarios, dependsOn references, evaluable matrices, is_variable / is_formula / is_derived markers). If a Metrics model already exists, review and complete it instead of creating a new one.

## NN Work: Check Activation Gate
parent:: [[Create Timeline]]
step_type:: task
next:: [[Extract Model Snapshot]]
condition:: Metrics model verified
input:: [[Console Runtime]]
output:: [[Gate Verdict]]
output_status:: verified
tool:: [[Verify Harness]]
Run the activation gate probe (`verify.harness.js --probe --root <folder> --file <console.html>`): the console runtime pins (`console/needs-registry.json` CDN + raw mirror) must be reachable AND the `file://` smoke load of the reference shell must pass with zero page errors AND the `charts` capability must be registered in `console/needs-registry.json`. If the gate is CLOSED (runtime pins unreachable, the `file://` smoke fails, or `charts` is not registered): STOP — no `*_console.html` is produced and the inline `timeline.html` stays canonical and untouched. Only an OPEN gate authorizes console generation. Until the gate opens, the inline dashboard remains the canonical artifact.

## NN Work: Extract Model Snapshot
parent:: [[Create Timeline]]
step_type:: task
next:: [[Map Dependency Graph]]
condition:: Activation gate open
input:: [[Metrics Model]]
output:: [[Model Data Block]]
output_status:: verified
tool:: [[AI Agent]]
Copy values (metricValue), units (metricUnit, variableUnit) and verbatim formula text (metricFormula) from the Level 3 model into the innfo-model snapshot. `meta` carries the required keys (model, model_version, source_model, generated_at, months, historyMonths, charts, slug, title, startMonth/startYear); `rows` mirror the model rows with growth `{ mode: fixed | compound | additive }` derived from the Evolution concept; rows with measured past carry `history: [v0, v1, ...]` so the console renders actuals distinctly from computed months. PRE-COMPUTE every chart as pure-JSON month arrays into `series{ "<chartId>": number[] }` — series-as-data: the runtime only renders, it never evaluates. Cap the projected horizon at 120 months (MONTHS_CAP in the verify harness). Scenario variants live in the model as variant rows; the console renders the single neutral flow.

## NN Work: Map Dependency Graph
parent:: [[Create Timeline]]
step_type:: task
next:: [[Build Console Shell]]
condition:: Snapshot extracted
input:: [[Metrics Model]]
output:: [[Model Data Block]]
output_status:: verified
tool:: [[AI Agent]]
Translate each dependsOn / evolution of the model into resolved relations on the serialized elements (field, target, targetLabel) so the console renders reference pills and dependency navigation. The union of the metrics-dependencies and metric-variables matrices feeds the relation set; no executable logic is added to the slots.

## NN Work: Build Console Shell
parent:: [[Create Timeline]]
step_type:: task
next:: [[Inject Model Snapshot]]
condition:: Dependencies mapped
input:: [[Timeline Layout]]
output:: [[Console HTML]]
output_status:: draft
tool:: [[AI Agent]]
Build the console from the thinned Timeline Layout asset (`../assets/timeline.html`): declare `needs[]` in `<script type="application/json" id="innfo-config">` using registered capabilities only — the pilot declares `charts` plus the minimal set (`concept-rail`, `fulltext-search`, `matrix-grids`, `hash-routing`, `reference-popup`), adding `feedback-export` only when the export UI is required (pins resolve through `console/needs-registry.json`, never hand-edit URLs). The `charts` capability is registered in the registry and rendered by the shared runtime (`renderCharts`, uPlot vendored inside the bundle); it is NOT a backlog item. Reference the single-file console bundle (`console/innfo-console.bundle.js`) with static `<script src>` tags (jsDelivr pin primary, raw mirror fallback — no `fetch()`, no `type=module`), and ship the vendored `innfo-console.bundle.js` next to the output for offline `file://` double-click. Change nothing else in the shell. Write the deliverable folder as `export/<Model>_V_<version>_console/` containing `<Model>_V_<version>_console.html` plus `innfo-console.bundle.js` — self-contained and portable.

## NN Work: Inject Model Snapshot
parent:: [[Create Timeline]]
step_type:: task
next:: [[Export Feedback Capability]]
condition:: Console shell built
input:: [[Model Data Block]]
output:: [[Console HTML]]
output_status:: draft
tool:: [[AI Agent]]
Write the resolved template schema JSON verbatim into `<script type="application/json" id="innfo-schema">` and the innfo-model snapshot JSON verbatim into `<script type="application/json" id="innfo-model">`. The visual system comes from the shared runtime renderer — no inline styling or layout authoring beyond the shell.

## NN Work: Export Feedback Capability
parent:: [[Create Timeline]]
step_type:: task
next:: [[Verify In Browser]]
condition:: Snapshot injected
input:: [[Console HTML]]
output:: [[Feedback JSON]]
output_status:: verified
tool:: [[AI Agent]]
Keep the `feedback-export` capability enabled so the reviewer can download a feedback JSON conforming to `console/feedback.schema.json` (`meta` carries source_model, source_model_version, artifact, artifact_version, exported_at, author, feedback_slug, viewer; items carry id `fb-NNN`, kind correction|comment|new|delete, target, status). The reviewer drops the export into `sources/import/feedback/`; `nn-trannsform --scan` normalizes it under `sources/nn/import/feedback/` and cites it.

## NN Work: Verify In Browser
parent:: [[Create Timeline]]
step_type:: task
next:: [[Apply Feedback]]
condition:: Console built
input:: [[Console HTML]]
output:: [[Verification Report]]
output_status:: verified
tool:: [[Verify Harness]]
Run the verify harness in static and render modes: `verify.harness.js --check-slots --file <console.html>` must pass (needs[] resolve through the registry, required meta keys present, series payloads pure data, zero inline-runtime blocks), then the `file://` render check must report zero pageerrors with a real render (banner text, concept rail, element cards, matrices when the model declares them, feedback-export button when declared). See the template verify harness.

## NN Work: Apply Feedback
parent:: [[Create Timeline]]
step_type:: task
next:: -
condition:: Verification report clean
input:: [[Verification Report]]
output:: [[Regenerated Console]]
output_status:: verified
tool:: [[innfo-mcp apply_change]]
Apply Feedback replaces the old Version-And-Archive step: the console is a frozen snapshot and only changes through the feedback loop. Run the Apply Feedback procedure (`../procedures/apply_feedback_NN.md`): staleness check (`meta.source_model_version` vs the live model — block with a report naming both versions until the reviewer confirms), diff preview per pending item, apply accepted items via `innfo-mcp apply_change` (one call per item), run `validate_model` (failure aborts the run: no version bump and no console rewrite), bump the patch version once, and regenerate the stable-name console `{Model}_V_{version}_console.html`. Timestamped console copies are archive-only.

# NN Artifact

## NN Artifact: Source Workspace Models
The workspace index plus the L3 models and normalized sources under analysis (figures, rates, periods).

## NN Artifact: Metric Plan
Proposed Metrics / Variables / Evolution / Scenario rows with per-row source traceability and open questions. Approved by the user before modeling.

## NN Artifact: Metrics Model
The Level 3 metrics model file with metric rows, formulas, dependencies and markers.

## NN Artifact: Console Runtime
The shared console bundle (`console/innfo-console.bundle.js`, UMD `window.InnfoConsole`) plus its pins in `console/needs-registry.json`. The activation gate probes this runtime before any console generation.

## NN Artifact: Gate Verdict
The `open | closed` outcome of the activation gate probe. `closed` keeps the inline dashboard canonical and produces no console.

## NN Artifact: Model Data Block
The innfo-model snapshot embedded in the artifact: `meta` (the 11 required keys), `rows` with model/derived provenance and growth rules, and the pre-computed pure-JSON `series{}` block. Single point to update when the model changes.

## NN Artifact: Timeline Layout
The thinned blueprint shell at `../assets/timeline.html`: `innfo-config needs[]` plus the `innfo-schema` / `innfo-model` slots and the static bundle tags. No inline runtime.

## NN Artifact: Console HTML
The standalone deliverable file (`<Model>_V_<version>_console.html`): slots only, shared runtime via static tags, vendored bundle next to the output.

## NN Artifact: Feedback JSON
Reviewer export conforming to `console/feedback.schema.json`, ingested via `sources/import/feedback/` and normalized by `nn-trannsform --scan`. Feeds the Apply Feedback loop.

## NN Artifact: Verification Report
Harness output: slot check results, `file://` render status, page errors. Zero pageerrors required.

## NN Artifact: Regenerated Console
Console rebuilt after an Apply Feedback run under the stable name `{Model}_V_{version}_console.html`; timestamped copies are archive-only.

# NN Tools

## NN Tools: AI Agent
scope:: internal
AI agent executing the technical steps and the headless verification.

## NN Tools: Shared Console Runtime
scope:: external
Single-file console bundle (runtime + visuals + renderers) loaded via static script tags; renders banner, rail, search, element cards, matrices, and the conditional feedback-export modal. Renders whatever schema and model data it is given; never evaluates series.

## NN Tools: Verify Harness
scope:: internal
Portable Node script (`scripts/verify.harness.js`) exposing the slot-contract helpers plus `--check-slots` (static validation, fail-fast naming), `--probe` (activation gate: runtime pins reachable + `file://` smoke), and the `file://` render check (zero pageerrors + real render). No absolute paths; Chromium resolved via PLAYWRIGHT_CORE / CHROME_EXE env with local install fallback.

## NN Tools: innfo-mcp apply_change
scope:: external
Model mutation contract: `update_field`, `rename_element`, `set_marker`, each with `{rationale, approved_by}`. One call per accepted feedback item.

## NN Tools: innfo-mcp validate_model
scope:: external
Post-apply gate. Failure aborts the run with no bump and no console rewrite.

## NN Tools: innfo-mcp bump_version
scope:: external
Single `{bump: "patch"}` after successful validation of all applied items.

## NN Tools: nn-trannsform --scan
scope:: external
Feedback ingestion: normalizes reviewer feedback JSONs from `sources/import/feedback/` into `sources/nn/import/feedback/` with citations.

# NN Roles

## NN Roles: Agent
scope:: internal
AI agent responsible for technical execution and headless verification.

## NN Roles: User
scope:: external
User responsible for providing the model, reviewing artifact aesthetics, and approving each version.

# NN matrices: work-roles matrix
| Work \ Roles | Agent | User |
| :--- | :--- | :--- |
| Analyze Workspace Models | Responsible | Consulted |
| Confirm Metric Plan | Responsible | Accountable |
| Build Metrics Model | Responsible | Accountable |
| Check Activation Gate | Responsible | Informed |
| Extract Model Snapshot | Responsible | Accountable |
| Map Dependency Graph | Responsible | Informed |
| Build Console Shell | Responsible | Informed |
| Inject Model Snapshot | Responsible | Informed |
| Export Feedback Capability | Responsible | Informed |
| Verify In Browser | Responsible | Informed |
| Apply Feedback | Responsible | Accountable |

# NN matrices: work-tools matrix
| Work \ Tools | AI Agent | Shared Console Runtime | Verify Harness | innfo-mcp apply_change | innfo-mcp validate_model | innfo-mcp bump_version | nn-trannsform --scan |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Analyze Workspace Models | Uses | - | - | - | - | - | - |
| Confirm Metric Plan | Uses | - | - | - | - | - | - |
| Build Metrics Model | Uses | - | - | - | - | - | - |
| Check Activation Gate | Uses | Uses | Uses | - | - | - | - |
| Extract Model Snapshot | Uses | - | - | - | - | - | - |
| Map Dependency Graph | Uses | - | - | - | - | - | - |
| Build Console Shell | Uses | Uses | - | - | - | - | - |
| Inject Model Snapshot | Uses | - | - | - | - | - | - |
| Export Feedback Capability | Uses | - | - | - | - | - | Uses |
| Verify In Browser | - | - | Uses | - | - | - | - |
| Apply Feedback | - | - | - | Uses | Uses | Uses | - |

# NN matrices: work-artifacts matrix
| Work \ Artifact | Source Workspace Models | Metric Plan | Metrics Model | Console Runtime | Gate Verdict | Model Data Block | Timeline Layout | Console HTML | Feedback JSON | Verification Report | Regenerated Console |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Analyze Workspace Models | Reviews | Creates | - | - | - | - | - | - | - | - | - |
| Confirm Metric Plan | - | Reviews | - | - | - | - | - | - | - | - | - |
| Build Metrics Model | - | Reviews | Creates | - | - | - | - | - | - | - | - |
| Check Activation Gate | - | - | - | Reviews | Creates | - | - | - | - | - | - |
| Extract Model Snapshot | - | - | Reviews | - | - | Creates | - | - | - | - | - |
| Map Dependency Graph | - | - | Reviews | - | - | Modifies | - | - | - | - | - |
| Build Console Shell | - | - | - | - | - | Reviews | Reviews | Creates | - | - | - |
| Inject Model Snapshot | - | - | - | - | - | Reviews | - | Modifies | - | - | - |
| Export Feedback Capability | - | - | - | - | - | - | - | Reviews | Creates | - | - |
| Verify In Browser | - | - | - | - | - | - | - | Reviews | - | Creates | - |
| Apply Feedback | - | - | - | - | - | Reviews | - | Modifies | Reviews | Reviews | Creates |