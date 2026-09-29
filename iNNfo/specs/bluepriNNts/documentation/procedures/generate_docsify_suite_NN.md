---
level: 3
parent_spec:
  name: "procedures_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/procedures_V_0-2-0_NN.md"
model_version: "V_0-1-0"
title: "Generate Docsify Suite Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Generate Complete Docsify Suite
step_type:: task
parent:: -
next:: -
condition:: Documentation model updated or site build triggered
input:: [[Documentation Model]]
output:: [[Verified Documentation Suite]]
output_status:: verified
tool:: [[Docsify Suite Generator Script]]
scope:: internal
Standard procedure to parse a documentation model, validate source markdown paths, and compile Docsify navigation (_sidebar.md, _navbar.md) and AI indexes (llms.txt, ai-index.yaml).

## NN Work: Verify Documentation Model
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: [[Audit Source Markdown Files]]
condition:: Execution begins
input:: [[Documentation Model]]
output:: [[Validated Model AST]]
output_status:: verified
tool:: [[iNNfo Core Validator]]
scope:: internal
Verify that documentation_NN.md conforms to documentation_V_0-2-0 and contains valid DocSite, Section, Page, NavbarItem, and Asset concepts.

## NN Work: Audit Source Markdown Files
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: [[Compile Sidebar Markdown]]
condition:: Model syntax is valid
input:: [[Validated Model AST]]
output:: [[File Audit Report]]
output_status:: verified
tool:: [[Docsify Suite Generator Script]]
scope:: internal
Inspect every Page element in the model and verify that the file referenced in the source field exists on the local filesystem.

## NN Work: Compile Sidebar Markdown
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: [[Compile Navbar Markdown]]
condition:: All source files exist
input:: [[File Audit Report]]
output:: [[Docsify Sidebar]]
output_status:: verified
tool:: [[Docsify Suite Generator Script]]
scope:: internal
Iterate through Sections and Pages in order, generating Markdown list items with labels and routes into _sidebar.md.

## NN Work: Compile Navbar Markdown
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: [[Compile AI Summary and Index]]
condition:: Sidebar generation complete
input:: [[Validated Model AST]]
output:: [[Docsify Navbar]]
output_status:: verified
tool:: [[Docsify Suite Generator Script]]
scope:: internal
Iterate through NavbarItem entities in order, formatting top-level navigation links and dropdown menus into _navbar.md.

## NN Work: Compile AI Summary and Index
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: [[Verify Output Suite]]
condition:: Navbar generation complete
input:: [[Validated Model AST]]
output:: [[AI Index and LLM Summary]]
output_status:: verified
tool:: [[Docsify Suite Generator Script]]
scope:: internal
Compile all DocSite descriptions, Sections, and Page summaries into machine-readable llms.txt and ai-index.yaml formats.

## NN Work: Verify Output Suite
parent:: [[Generate Complete Docsify Suite]]
step_type:: task
next:: -
condition:: All artifacts written
input:: [[Docsify Sidebar]]
output:: [[Verified Documentation Suite]]
output_status:: verified
tool:: [[Docsify Runtime Checker]]
scope:: internal
Ensure generated _sidebar.md and _navbar.md are non-empty, contain valid markdown syntax, and match expected site routes without dead links.

# NN Artifact

## NN Artifact: Documentation Model
type:: spec
format:: markdown
Authoritative level-3 model file (documentation_NN.md) conforming to the documentation template.

## NN Artifact: Validated Model AST
type:: data
format:: json
Parsed in-memory AST representing the documentation entities and field relationships.

## NN Artifact: File Audit Report
type:: log
format:: text
Filesystem resolution status confirming every source markdown file is present.

## NN Artifact: Docsify Sidebar
type:: config
format:: markdown
The generated _sidebar.md file consumed by Docsify to render the navigation menu.

## NN Artifact: Docsify Navbar
type:: config
format:: markdown
The generated _navbar.md file consumed by Docsify to render the top header navigation bar.

## NN Artifact: AI Index and LLM Summary
type:: config
format:: markdown
The generated llms.txt and ai-index.yaml files consumed by AI agents and LLMs.

## NN Artifact: Verified Documentation Suite
type:: report
format:: status
Confirmation of clean navigation tree without dead links or missing routes.
