---
level: 3
parent_spec:
  name: "procedures_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Documentation Blueprint"
---

# NN Work

## NN Work: Using the Documentation Blueprint
step_type:: task
condition:: You want to publish a documentation site from a model
input:: [[Documentation Model]]
output:: [[Docsify Suite]]
tool:: [[Console]]
scope:: internal
Getting started with the Documentation blueprint: create the DocSite, structure its sections and pages, configure the navbar and assets, then generate the Docsify suite.

## NN Work: Create the DocSite
parent:: [[Using the Documentation Blueprint]]
step_type:: task
next:: [[Structure Sections and Pages]]
condition:: No documentation model exists yet
input:: [[Documentation Model]]
output:: [[Documentation Model]]
tool:: [[Console]]
scope:: internal
Add the `DocSite` element that anchors the site.

## NN Work: Structure Sections and Pages
parent:: [[Using the Documentation Blueprint]]
step_type:: task
next:: [[Configure Navbar and Assets]]
condition:: DocSite created
input:: [[Documentation Model]]
output:: [[Documentation Model]]
tool:: [[Console]]
scope:: internal
Populate `Section` and `Page` elements in the order they should read.

## NN Work: Configure Navbar and Assets
parent:: [[Using the Documentation Blueprint]]
step_type:: task
next:: [[Generate the Docsify Suite]]
condition:: Pages defined
input:: [[Documentation Model]]
output:: [[Documentation Model]]
tool:: [[Console]]
scope:: internal
Add the `NavbarItem` and `Asset` elements the site needs.

## NN Work: Generate the Docsify Suite
parent:: [[Using the Documentation Blueprint]]
step_type:: task
condition:: Site structure configured
input:: [[Documentation Model]]
output:: [[Docsify Suite]]
tool:: [[AI Agent]]
scope:: internal
Execute the `generate-docsify-suite` procedure to emit the publishable site.

# NN Artifact

## NN Artifact: Documentation Model
type:: input
description:: The active level 3 model built on the Documentation blueprint.

## NN Artifact: Docsify Suite
type:: output
description:: Publishable documentation site (HTML, config, assets).

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent rendering the Docsify suite from the model.

# NN Roles

## NN Roles: Documentation Author
type:: author
description:: Owns the documentation model and its published output.
