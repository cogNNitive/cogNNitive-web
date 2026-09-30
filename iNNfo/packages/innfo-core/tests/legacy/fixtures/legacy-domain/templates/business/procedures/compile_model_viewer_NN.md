---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Compile Model Viewer Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Compile Model Viewer
step_type:: task
parent:: -
next:: -
condition:: A level 3 model conforming to this template is loaded
input:: [[Active Model]]
output:: [[Model Viewer HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Generate a single self-contained HTML file for read-only consultation of the active model: a left rail of concepts, an element list with expandable detail, navigable relationship links, and matrix grids. The agent only fills two embedded JSON blocks in the reference shell; it authors no layout markup.

## NN Work: Load Reference Shell
parent:: [[Compile Model Viewer]]
step_type:: task
next:: [[Resolve Model Schema]]
condition:: Procedure starts
input:: [[Model Viewer Reference Shell]]
output:: [[Loaded Shell]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Fetch the reference shell from `https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/assets/model_viewer.html` (all CSS inline; the vanilla-JS renderer lives in `console/render-model-viewer.js` loaded via static `<script src>` tags). It contains two empty blocks — `<script type="application/json" id="innfo-schema">` and `<script type="application/json" id="innfo-model">` — that this procedure populates.

## NN Work: Resolve Model Schema
parent:: [[Compile Model Viewer]]
step_type:: task
next:: [[Serialize Model Data]]
condition:: Reference shell is loaded
input:: [[Active Model]]
output:: [[Resolved Schema]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Resolve the model's `parent_spec` and every transitive `includes` (depth up to 10). Collect the union of Concept, Field, Marker, and Matrix Definitions into the `Resolved Schema` JSON shape (see [[Schema JSON Contract]]). Preserve the `NN index` concept order.

## NN Work: Serialize Model Data
parent:: [[Compile Model Viewer]]
step_type:: task
next:: [[Inject Data into Shell]]
condition:: Schema is resolved
input:: [[Active Model]]
output:: [[Model Data JSON]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Walk the active level 3 model. For each element emit `id` (slug of `concept` + `name`), `concept`, `name`, `description` prose, `fields` map, `markers` map, and `relations` (one entry per reference / model field value, with the resolved `target` id and `targetLabel`). Serialize every matrix as `rows`, `cols`, and a `cells` map. Fill `meta` from the model frontmatter (`title`, `template`, `modelVersion`, `sourceUrl`, `generated` timestamp). Conform to [[Model JSON Contract]].

## NN Work: Inject Data into Shell
parent:: [[Compile Model Viewer]]
step_type:: task
next:: [[Verify Output]]
condition:: Schema and model data are ready
input:: [[Loaded Shell]]
output:: [[Model Viewer HTML]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Write the `Resolved Schema` JSON verbatim into `<script type="application/json" id="innfo-schema">` and the `Model Data JSON` verbatim into `<script type="application/json" id="innfo-model">`. Declare the console capabilities in `<script type="application/json" id="innfo-config">` via `needs[]` (pins resolve through `console/needs-registry.json`). Reference the single-file console bundle (`console/innfo-console.bundle.js`, runtime + visuals + renderers) with static `<script src>` tags (CDN primary, mirror fallback — no `fetch()`, no `type=module`). Resolve the bundle pin (version/commit) from the `console-assets` entry in `docs/use/manifest.md`, and ship the vendored `innfo-console.bundle.js` next to the output for offline `file://` double-click. Change nothing else in the shell. Write the deliverable folder as `export/<Model>_V_<version>_console/` containing `<Model>_V_<version>_console.html` plus `innfo-console.bundle.js` — the folder is self-contained and portable (copy it anywhere).

## NN Work: Verify Output
parent:: [[Compile Model Viewer]]
step_type:: task
next:: -
condition:: Data injected
input:: [[Model Viewer HTML]]
output:: [[Verified Model Viewer]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Confirm: every concept in the model's `NN index` has a rail entry and a section; every element renders with its fields and markers; every `relations` target id exists among the serialized elements (no dangling links); every resolved matrix appears as a grid; the search box filters and the in-page relationship links resolve. Report any empty or broken section.

# NN Tools

## NN Tools: AI Agent
scope:: external
LLM agent (e.g. OpenCode Desktop) that resolves the schema, serializes the model, injects the two JSON blocks, and writes the output artifact.

# NN Artifact

## NN Artifact: Active Model
type:: spec
format:: markdown
The active level 3 model conforming to `business_V_0-2-3` (or any template that adopts this procedure), source of all data to serialize.

## NN Artifact: Model Viewer Reference Shell
type:: asset
format:: html
The static consultation shell at `iNNfo/specs/templates/business/assets/model_viewer.html`: inline CSS, two empty JSON blocks, and the template-agnostic renderer in `console/render-model-viewer.js` (UMD `window.InnfoModelViewer`, static script tags only) — it renders whatever schema and model data it is given.

## NN Artifact: Loaded Shell
type:: data
format:: html
In-memory copy of the reference shell ready for JSON injection.

## NN Artifact: Resolved Schema
type:: data
format:: json
Union of Concept / Field / Marker / Matrix Definitions from the model's parent template and its transitive includes. See [[Schema JSON Contract]].

## NN Artifact: Model Data JSON
type:: data
format:: json
The serialized model: `meta`, `elements` (with fields, markers, relations), and `matrices`. See [[Model JSON Contract]].

## NN Artifact: Model Viewer HTML
type:: deliverable
format:: html
The generated blueprint console (`innfo-config` needs[] plus `innfo-schema`/`innfo-model` slots, shared runtime via static script tags), saved as `<Model>_V_<version>_console.html`: a single-file, offline, read-only model consultation page.

## NN Artifact: Verified Model Viewer
type:: report
format:: status
Confirmation that every concept, element, relationship, and matrix rendered with no broken or empty section.

## NN Artifact: Schema JSON Contract
type:: spec
format:: json
```json
{
  "template": { "name": "business_V_0-2-3", "version": "V_0-2-3", "url": "https://raw.githubusercontent.com/..." },
  "concepts": [
    { "name": "Problems", "icon": "alert-triangle", "color": "red", "weight": 90, "type": "list" }
  ],
  "fields": [
    { "concept": "Problems", "name": "severity", "type": "select", "options": ["low", "high"] }
  ],
  "markers": [
    { "name": "importance", "icon": "star", "color": "amber" }
  ],
  "matrices": [
    { "name": "Problems-Value propositions", "source": "Problems", "target": "Value propositions", "values": ["Max", "High", "Medium", "Low"] }
  ]
}
```

## NN Artifact: Model JSON Contract
type:: spec
format:: json
```json
{
  "meta": {
    "title": "Ghostbusters",
    "template": "business_V_0-2-3",
    "modelVersion": "V_0-2-1",
    "sourceUrl": "https://raw.githubusercontent.com/...",
    "generated": "2026-09-07T20:00:00Z"
  },
  "elements": [
    {
      "id": "problems-paranormal-infestation",
      "concept": "Problems",
      "name": "Paranormal Infestation",
      "description": "Residential and commercial sites overrun by hostile spectral entities.",
      "fields": { "severity": "high" },
      "markers": { "importance": "High", "certainty": "Medium" },
      "relations": [
        { "field": "resolved_by", "target": "value-propositions-removal-service", "targetLabel": "Removal Service" }
      ]
    }
  ],
  "matrices": [
    {
      "name": "Problems-Value propositions",
      "rows": ["Paranormal Infestation"],
      "cols": ["Removal Service"],
      "cells": { "Paranormal Infestation": { "Removal Service": "Max" } }
    }
  ]
}
```
