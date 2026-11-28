---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Visual Catalog Blueprint"
---

# NN Procedure

## NN Procedure: Using the Visual Catalog Blueprint
slug:: using-the-visual-catalog-blueprint
summary:: Getting started with the Visual Catalog blueprint: create catalog entries, define their categories, attach evidence, then ingest the catalog.
inputs_required:: @visual-catalog-model
outputs_expected:: @ingested-catalog

It starts when: You want to curate a visual asset catalog.

### NN Work: Create Catalog Entries
slug:: create-catalog-entries
step_type:: task
next:: @define-categories
condition:: No visual catalog model exists yet
input:: @visual-catalog-model
output:: @visual-catalog-model
tool:: @console
executor:: human
scope:: internal
Add `Entry` elements for each asset to catalog.

### NN Work: Define Categories
slug:: define-categories
step_type:: task
next:: @attach-evidence
condition:: Entries created
input:: @visual-catalog-model
output:: @visual-catalog-model
tool:: @console
executor:: human
scope:: internal
Add the `Category` elements and assign every entry to one.

### NN Work: Attach Evidence
slug:: attach-evidence
step_type:: task
next:: @ingest-the-visual-catalog
condition:: Categories defined
input:: @visual-catalog-model
output:: @visual-catalog-model
tool:: @console
executor:: human
scope:: internal
Attach `Evidence` elements (source paths, hashes) backing each entry.

### NN Work: Ingest the Visual Catalog
slug:: ingest-the-visual-catalog
step_type:: task
condition:: Entries, categories and evidence complete
input:: @visual-catalog-model
output:: @ingested-catalog
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `ingest-visual-catalog` procedure to normalize the assets and their provenance.

# NN Artifact

## NN Artifact: Visual Catalog Model
slug:: visual-catalog-model
type:: input
description:: The active level 3 model built on the Visual Catalog blueprint.

## NN Artifact: Ingested Catalog
slug:: ingested-catalog
type:: output
description:: Normalized catalog with entries, categories and evidence.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent normalizing assets and recording provenance.

# NN Roles

## NN Roles: Catalog Curator
slug:: catalog-curator
type:: author
description:: Owns the catalog taxonomy and evidence quality.
