---
level: 3
parent_spec:
  name: "procedures_V_0-3-3"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Visual Catalog Blueprint"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Work

## NN Work: Using the Visual Catalog Blueprint
step_type:: task
condition:: You want to curate a visual asset catalog
input:: [[Visual Catalog Model]]
output:: [[Ingested Catalog]]
tool:: [[Console]]
scope:: internal
Getting started with the Visual Catalog blueprint: create catalog entries, define their categories, attach evidence, then ingest the catalog.

## NN Work: Create Catalog Entries
parent:: [[Using the Visual Catalog Blueprint]]
step_type:: task
next:: [[Define Categories]]
condition:: No visual catalog model exists yet
input:: [[Visual Catalog Model]]
output:: [[Visual Catalog Model]]
tool:: [[Console]]
scope:: internal
Add `Entry` elements for each asset to catalog.

## NN Work: Define Categories
parent:: [[Using the Visual Catalog Blueprint]]
step_type:: task
next:: [[Attach Evidence]]
condition:: Entries created
input:: [[Visual Catalog Model]]
output:: [[Visual Catalog Model]]
tool:: [[Console]]
scope:: internal
Add the `Category` elements and assign every entry to one.

## NN Work: Attach Evidence
parent:: [[Using the Visual Catalog Blueprint]]
step_type:: task
next:: [[Ingest the Visual Catalog]]
condition:: Categories defined
input:: [[Visual Catalog Model]]
output:: [[Visual Catalog Model]]
tool:: [[Console]]
scope:: internal
Attach `Evidence` elements (source paths, hashes) backing each entry.

## NN Work: Ingest the Visual Catalog
parent:: [[Using the Visual Catalog Blueprint]]
step_type:: task
condition:: Entries, categories and evidence complete
input:: [[Visual Catalog Model]]
output:: [[Ingested Catalog]]
tool:: [[AI Agent]]
scope:: internal
Execute the `ingest-visual-catalog` procedure to normalize the assets and their provenance.

# NN Artifact

## NN Artifact: Visual Catalog Model
type:: input
description:: The active level 3 model built on the Visual Catalog blueprint.

## NN Artifact: Ingested Catalog
type:: output
description:: Normalized catalog with entries, categories and evidence.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent normalizing assets and recording provenance.

# NN Roles

## NN Roles: Catalog Curator
type:: author
description:: Owns the catalog taxonomy and evidence quality.
