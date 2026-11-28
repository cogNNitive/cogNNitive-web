---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Documentation Blueprint"
---

# NN Procedure

## NN Procedure: Using the Documentation Blueprint
slug:: using-the-documentation-blueprint
summary:: Getting started with the Documentation blueprint: create the DocSite, structure its sections and pages, configure the navbar and assets, then generate the Docsify suite.
inputs_required:: @documentation-model
outputs_expected:: @docsify-suite

It starts when: You want to publish a documentation site from a model.

### NN Work: Create the DocSite
slug:: create-the-docsite
step_type:: task
next:: @structure-sections-and-pages
condition:: No documentation model exists yet
input:: @documentation-model
output:: @documentation-model
tool:: @console
executor:: human
scope:: internal
Add the `DocSite` element that anchors the site.

### NN Work: Structure Sections and Pages
slug:: structure-sections-and-pages
step_type:: task
next:: @configure-navbar-and-assets
condition:: DocSite created
input:: @documentation-model
output:: @documentation-model
tool:: @console
executor:: human
scope:: internal
Populate `Section` and `Page` elements in the order they should read.

### NN Work: Configure Navbar and Assets
slug:: configure-navbar-and-assets
step_type:: task
next:: @generate-the-docsify-suite
condition:: Pages defined
input:: @documentation-model
output:: @documentation-model
tool:: @console
executor:: human
scope:: internal
Add the `NavbarItem` and `Asset` elements the site needs.

### NN Work: Generate the Docsify Suite
slug:: generate-the-docsify-suite
step_type:: task
condition:: Site structure configured
input:: @documentation-model
output:: @docsify-suite
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `generate-docsify-suite` procedure to emit the publishable site.

# NN Artifact

## NN Artifact: Documentation Model
slug:: documentation-model
type:: input
description:: The active level 3 model built on the Documentation blueprint.

## NN Artifact: Docsify Suite
slug:: docsify-suite
type:: output
description:: Publishable documentation site (HTML, config, assets).

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent rendering the Docsify suite from the model.

# NN Roles

## NN Roles: Documentation Author
slug:: documentation-author
type:: author
description:: Owns the documentation model and its published output.
