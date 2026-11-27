---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Generate Docsify Suite Procedure"
---

# NN Work

## NN Work: Generate Complete Docsify Suite
slug:: generate-complete-docsify-suite
step_type:: task
condition:: Documentation model updated or site build triggered
input:: @documentation-model
output:: @verified-documentation-suite
output_status:: verified
tool:: @docsify-suite-generator-script
executor:: agent
scope:: internal
Standard procedure to parse a documentation model, validate source markdown paths, and compile Docsify navigation (_sidebar.md, _navbar.md) and AI indexes (llms.txt, ai-index.yaml).

## NN Work: Verify Documentation Model
slug:: verify-documentation-model
parent:: @generate-complete-docsify-suite
step_type:: task
next:: @audit-source-markdown-files
condition:: Execution begins
input:: @documentation-model
output:: @validated-model-ast
output_status:: verified
tool:: @innfo-core-validator
executor:: agent
scope:: internal
Verify that documentation_NN.md conforms to documentation_V_0-2-0 and contains valid DocSite, Section, Page, NavbarItem, and Asset concepts.

## NN Work: Audit Source Markdown Files
slug:: audit-source-markdown-files
parent:: @generate-complete-docsify-suite
step_type:: task
next:: @compile-sidebar-markdown
condition:: Model syntax is valid
input:: @validated-model-ast
output:: @file-audit-report
output_status:: verified
tool:: @docsify-suite-generator-script
executor:: agent
scope:: internal
Inspect every Page element in the model and verify that the file referenced in the source field exists on the local filesystem.

## NN Work: Compile Sidebar Markdown
slug:: compile-sidebar-markdown
parent:: @generate-complete-docsify-suite
step_type:: task
next:: @compile-navbar-markdown
condition:: All source files exist
input:: @file-audit-report
output:: @docsify-sidebar
output_status:: verified
tool:: @docsify-suite-generator-script
executor:: agent
scope:: internal
Iterate through Sections and Pages in order, generating Markdown list items with labels and routes into _sidebar.md.

## NN Work: Compile Navbar Markdown
slug:: compile-navbar-markdown
parent:: @generate-complete-docsify-suite
step_type:: task
next:: @compile-ai-summary-and-index
condition:: Sidebar generation complete
input:: @validated-model-ast
output:: @docsify-navbar
output_status:: verified
tool:: @docsify-suite-generator-script
executor:: agent
scope:: internal
Iterate through NavbarItem entities in order, formatting top-level navigation links and dropdown menus into _navbar.md.

## NN Work: Compile AI Summary and Index
slug:: compile-ai-summary-and-index
parent:: @generate-complete-docsify-suite
step_type:: task
next:: @verify-output-suite
condition:: Navbar generation complete
input:: @validated-model-ast
output:: @ai-index-and-llm-summary
output_status:: verified
tool:: @docsify-suite-generator-script
executor:: agent
scope:: internal
Compile all DocSite descriptions, Sections, and Page summaries into machine-readable llms.txt and ai-index.yaml formats.

## NN Work: Verify Output Suite
slug:: verify-output-suite
parent:: @generate-complete-docsify-suite
step_type:: task
condition:: All artifacts written
input:: @docsify-sidebar
output:: @verified-documentation-suite
output_status:: verified
tool:: @docsify-runtime-checker
executor:: agent
scope:: internal
Ensure generated _sidebar.md and _navbar.md are non-empty, contain valid markdown syntax, and match expected site routes without dead links.

# NN Artifact

## NN Artifact: Documentation Model
slug:: documentation-model
type:: spec
format:: markdown
Authoritative level-3 model file (documentation_NN.md) conforming to the documentation template.

## NN Artifact: Validated Model AST
slug:: validated-model-ast
type:: data
format:: json
Parsed in-memory AST representing the documentation entities and field relationships.

## NN Artifact: File Audit Report
slug:: file-audit-report
type:: log
format:: text
Filesystem resolution status confirming every source markdown file is present.

## NN Artifact: Docsify Sidebar
slug:: docsify-sidebar
type:: config
format:: markdown
The generated _sidebar.md file consumed by Docsify to render the navigation menu.

## NN Artifact: Docsify Navbar
slug:: docsify-navbar
type:: config
format:: markdown
The generated _navbar.md file consumed by Docsify to render the top header navigation bar.

## NN Artifact: AI Index and LLM Summary
slug:: ai-index-and-llm-summary
type:: config
format:: markdown
The generated llms.txt and ai-index.yaml files consumed by AI agents and LLMs.

## NN Artifact: Verified Documentation Suite
slug:: verified-documentation-suite
type:: report
format:: status
Confirmation of clean navigation tree without dead links or missing routes.

# NN Tools

## NN Tools: iNNfo Core Validator
slug:: innfo-core-validator
scope:: internal
The iNNfo validator (nn-core, behind the MCP validate tools) that checks the documentation model against its bluepriNNt.

## NN Tools: Docsify Suite Generator Script
slug:: docsify-suite-generator-script
scope:: internal
The generator that reads a documentation model and writes _sidebar.md, _navbar.md, llms.txt and ai-index.yaml.

## NN Tools: Docsify Runtime Checker
slug:: docsify-runtime-checker
scope:: internal
The check that the generated navigation files are non-empty, well formed and free of dead links.
