---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-2-0"
title: "Compile Model Console Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Compile Model Console
step_type:: task
condition:: A level 3 model conforming to this template is loaded
input:: [[Active Model]]
output:: [[Model Console HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Generate a single self-contained HTML file for read-only consultation of the active model by delegating payload assembly to the `build_console_payload` tool and pasting the returned escaped slots verbatim into the reference shell.

## NN Work: Load Reference Shell
parent:: [[Compile Model Console]]
step_type:: task
next:: [[Build Console Payload]]
condition:: Procedure starts
input:: [[Model Console Reference Shell]]
output:: [[Loaded Shell]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Fetch or load the reference shell from `iNNfo/specs/bluepriNNts/workspace/assets/model_console.html` (or its hosted CDN twin). It contains two empty script blocks — `<script type="application/json" id="innfo-schema">` and `<script type="application/json" id="innfo-model">` — ready for payload injection.

## NN Work: Build Console Payload
parent:: [[Compile Model Console]]
step_type:: task
next:: [[Inject Slots into Shell]]
condition:: Reference shell is loaded
input:: [[Active Model]]
output:: [[Console Payload Result]]
output_status:: verified
tool:: [[Build Console Payload Tool]]
scope:: internal
Invoke the MCP tool `build_console_payload` with the active model document identifier (`model: "<model_id>"`). The tool delegates to the shared canonical builder in `@cognnitive/innfo-core`, resolving the schema from the model's blueprint parent and includes, compiling elements, relations, matrices, and field citations via the workspace source resolver, incorporating feedback ledger statuses, escaping `<` as `\u003c`, and returning `{ schemaSlot, modelSlot, outputPath, schemaSource, warnings }`.

## NN Work: Inject Slots into Shell
parent:: [[Compile Model Console]]
step_type:: task
next:: [[Verify Output]]
condition:: Payload slots are compiled
input:: [[Loaded Shell]]
output:: [[Model Console HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Paste the returned `schemaSlot` string verbatim into `<script type="application/json" id="innfo-schema">` and `modelSlot` verbatim into `<script type="application/json" id="innfo-model">`. Treat `outputPath` (`artifacts/<stem>_console/<stem>_console.html`) as the name of the console family and write the resulting document as a NEW suffixed member, `<stem>_console_<UTC YYYYMMDDTHHmmssZ>.html`, through the write-once primitive (`writeOnce`, or `scripts/export-console.mjs`, which uses it). Never overwrite an existing console: when the latest member already has identical bytes, write nothing; when the model changed, add a member and leave earlier consoles untouched.

## NN Work: Verify Output
parent:: [[Compile Model Console]]
step_type:: task
condition:: A new console member written, or the latest member is identical
input:: [[Model Console HTML]]
output:: [[Verified Model Console]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Confirm the latest member of the console family opens cleanly, correctly displaying all concepts, elements, relationships, matrices, and citations without unescaped script tags or broken references.

# NN Tools

## NN Tools: AI Agent
scope:: external
Orchestrating agent executing procedure steps.

## NN Tools: Build Console Payload Tool
scope:: internal
MCP tool `build_console_payload` providing authoritative, schema-validated, `<`-escaped payload slots and canonical output paths.

# NN Artifact

## NN Artifact: Active Model
type:: spec
format:: markdown
The active level 3 model document to be compiled into a console view.

## NN Artifact: Model Console Reference Shell
type:: asset
format:: html
The static HTML consultation shell containing layout, stylesheets, runtime script tags, and placeholder script blocks.

## NN Artifact: Loaded Shell
type:: data
format:: html
In-memory template shell awaiting slot injection.

## NN Artifact: Console Payload Result
type:: data
format:: json
Result payload containing `schemaSlot`, `modelSlot`, `outputPath`, `schemaSource`, and any diagnostic `warnings`.

## NN Artifact: Model Console HTML
type:: deliverable
format:: html
Self-contained HTML consultation file, written once as a suffixed member of the `outputPath` family.

## NN Artifact: Verified Model Console
type:: report
format:: status
Confirmation of successful generation and verification.
