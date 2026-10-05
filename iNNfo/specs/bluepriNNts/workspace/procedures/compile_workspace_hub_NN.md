---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Compile Workspace Console Hub Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Compile Workspace Hub
step_type:: task
condition:: Multi-model or single-model workspace initialized with index.md
input:: [[Workspace Root Directory]]
output:: [[Workspace Hub HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Generate a standalone HTML dashboard (`artifacts/workspace_hub_<UTC suffix>.html`) compiling all available models, domains, and generated canonical consoles in the workspace with embedded AI agent regeneration prompt generator.

## NN Work: Scan Workspace Manifest and Models
parent:: [[Compile Workspace Hub]]
step_type:: task
next:: [[Discover Artifact Consoles]]
condition:: Procedure starts
input:: [[Workspace Manifest]]
output:: [[Structured Workspace Catalog]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Parse the workspace root `index.md` / `workspace_NN.md` and scan `models/` to identify all declared Level 3 models, their parent templates (Business, Procedures, Organization, etc.), versions, and descriptions.

## NN Work: Discover Artifact Consoles
parent:: [[Compile Workspace Hub]]
step_type:: task
next:: [[Generate Hub Document]]
condition:: Workspace catalog structured
input:: [[Structured Workspace Catalog]]
output:: [[Aggregated Console Registry]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Inspect `artifacts/` to map existing generated canonical consoles to their respective models, using the latest member (by name order) of each `<stem>_console` family, and detect active vs pending artifact status.

## NN Work: Generate Hub Document
parent:: [[Compile Workspace Hub]]
step_type:: task
next:: [[Verify Workspace Hub]]
condition:: Console registry mapped
input:: [[Aggregated Console Registry]]
output:: [[Workspace Hub HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Assemble a responsive, standalone HTML portal adhering to cogNNitive Design Presets (Inter font, slate/indigo styling, responsive card grid, embedded live iframe viewer supporting Monoconsole dual-tab consoles, theme synchronization dispatcher passing `innfo:theme-change` postMessage events to iframes on dark/light toggle, and AI agent prompt generator for batch console regeneration). Write it write-once as a new member `artifacts/workspace_hub_<UTC YYYYMMDDTHHmmssZ>.html` (family `workspace_hub`): never overwrite an earlier hub, and write nothing when the latest member has identical bytes.

## NN Work: Verify Workspace Hub
parent:: [[Compile Workspace Hub]]
step_type:: task
condition:: Hub document generated
input:: [[Workspace Hub HTML]]
output:: [[Verified Workspace Hub]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Verify that the generated workspace hub links cleanly to all active models and consoles, handles missing consoles gracefully, propagates theme changes seamlessly to embedded iframes via `innfo:theme-change`, includes the agent prompt generator modal, and renders properly in offline `file://` mode.

# NN Tools

## NN Tools: AI Agent
scope:: external
LLM agent or build tool that executes the aggregation procedure and writes `artifacts/workspace_hub_<UTC suffix>.html`.

# NN Artifact

## NN Artifact: Workspace Root Directory
type:: spec
format:: directory
Root directory of the workspace containing `index.md`, `models/`, and `artifacts/`.

## NN Artifact: Workspace Manifest
type:: data
format:: markdown
The root `index.md` or `workspace_NN.md` describing the workspace structure.

## NN Artifact: Structured Workspace Catalog
type:: data
format:: json
Structured catalog of all discovered models, titles, templates, and metadata.

## NN Artifact: Aggregated Console Registry
type:: data
format:: json
Mapping of models to their generated canonical consoles.

## NN Artifact: Workspace Hub HTML
type:: deliverable
format:: html
Standalone responsive HTML portal (`artifacts/workspace_hub_<UTC suffix>.html`) providing the unified entry point and batch prompt generator for all workspace consoles.

## NN Artifact: Verified Workspace Hub
type:: report
format:: status
Confirmation of complete, validated workspace console hub generation.
