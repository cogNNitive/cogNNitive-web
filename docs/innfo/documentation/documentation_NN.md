---
level: 3
parent_spec:
  name: "documentation_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/documentation/spec_NN.md"
model_version: "V_0-2-0"
title: "iNNfo Technical Documentation Model"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[DocSite]]
* [[Section]]
* [[Page]]
* [[NavbarItem]]

# NN DocSite

## NN DocSite: iNNfo Documentation
site_title:: iNNfo Technical Documentation
site_description:: Specifications, core engine packages, visual modeler, and agent MCP integration.
base_path:: docs/innfo/documentation/
site_logo:: favicon.svg
repo_url:: https://github.com/cogNNitive/cogNNitive
nav_enabled:: true

# NN Section

## NN Section: Components
section_order:: 1
parent:: [[iNNfo Documentation]]

## NN Section: Architecture
section_order:: 2
parent:: [[iNNfo Documentation]]

## NN Section: Guides
section_order:: 3
parent:: [[iNNfo Documentation]]

## NN Section: Templates
section_order:: 4
parent:: [[iNNfo Documentation]]

## NN Section: Runtime & Internals
section_order:: 5
parent:: [[iNNfo Documentation]]

# NN Page

## NN Page: Home
title:: Home
source:: README.md
route:: README
order:: 1
parent:: [[iNNfo Documentation]]
description:: Documentation entry point and overview.

## NN Page: innfo-editor
title:: innfo-editor
source:: innfo-editor.md
route:: innfo-editor
order:: 10
parent:: [[Components]]
description:: Interactive browser-based graphical editor for iNNfo models.

## NN Page: innfo-core
title:: innfo-core
source:: innfo-core.md
route:: innfo-core
order:: 20
parent:: [[Components]]
description:: Core parser, resolver, validator, and AST engine.

## NN Page: innfo-mcp
title:: innfo-mcp
source:: innfo-mcp.md
route:: innfo-mcp
order:: 30
parent:: [[Components]]
description:: Model Context Protocol server exposing iNNfo capabilities to AI agents.

## NN Page: OpenCode Agent
title:: OpenCode Agent
source:: opencode-innfo-agent.md
route:: opencode-innfo-agent
order:: 40
parent:: [[Components]]
description:: Integration guide for OpenCode and Antigravity agent workflows.

## NN Page: Ecosystem
title:: Ecosystem
source:: ecosystem.md
route:: ecosystem
order:: 10
parent:: [[Architecture]]
description:: Holistic view of cogNNitive ecosystem layers (iNNfo engine, modeler app, agent skills).

## NN Page: Specifications
title:: Specifications
source:: specifications.md
route:: specifications
order:: 20
parent:: [[Architecture]]
description:: Formal specification of the iNNfo format and meta-template layers.

## NN Page: OKF Compatibility
title:: OKF Compatibility
source:: ecosystem.md
route:: ecosystem?id=open-knowledge-format-compatibility
order:: 30
parent:: [[Architecture]]
description:: Alignment and compatibility with the Open Knowledge Format standard.

## NN Page: Discipline Overlaps
title:: Discipline Overlaps
source:: discipline-overlaps.md
route:: discipline-overlaps
order:: 40
parent:: [[Architecture]]
description:: How cogNNitive overlaps with established disciplines — Model-Driven Engineering, Knowledge Management, Enterprise Architecture, Ontology Engineering, Docs as Code, and Personal Knowledge Management.

## NN Page: Integrations
title:: External Tooling & Integrations
source:: integrations.md
route:: integrations
order:: 50
parent:: [[Architecture]]
description:: Integration of independent external tools (MCP vs CLI), with the WaveSpeed image-generation case study.

## NN Page: Why cogNNitive
title:: Why cogNNitive
source:: value-proposition.md
route:: value-proposition
order:: 5
parent:: [[Guides]]
description:: The problem with chatting straight to a model, and the four pillars cogNNitive addresses — efficiency, traceability, review comfort, and no vendor lock-in.

## NN Page: Usage Guide
title:: Usage
source:: usage.md
route:: usage
order:: 10
parent:: [[Guides]]
description:: Practical workflow examples and CLI usage.

## NN Page: Relationships & Connections
title:: Relationships & Connections
source:: relationships.md
route:: relationships
order:: 20
parent:: [[Guides]]
description:: Graph relationships, bidirectional edges, and matrices in iNNfo.

## NN Page: Sources, Citations & Lineage
title:: Sources, Citations & Lineage
source:: sources-citations-lineage.md
route:: sources-citations-lineage
order:: 30
parent:: [[Guides]]
description:: How the pipeline tracks where knowledge comes from, with three terms — Source, Citation, Lineage.

## NN Page: Import Modes & Dynamic Sources
title:: Import Modes & Dynamic Sources
source:: import-modes.md
route:: import-modes
order:: 32
parent:: [[Guides]]
description:: How new files enter the base — one-off, snapshot series, watched folders, reviewer feedback — and how the impact check keeps living sources from silently breaking citations.

## NN Page: Lifecycle Walkthrough
title:: Lifecycle Walkthrough (Case Study)
source:: lifecycle-walkthrough.md
route:: lifecycle-walkthrough
order:: 35
parent:: [[Guides]]
description:: End-to-end walkthrough of the 3-phase knowledge lifecycle using the Ghostbusters Inc. sample workspace.

## NN Page: Tags & Open Taxonomy
title:: Tags & Open Taxonomy
source:: tags-and-taxonomy.md
route:: tags-and-taxonomy
order:: 40
parent:: [[Guides]]
description:: Cross-cutting categorization, centralized workspace taxonomies, and multi-dimensional view filtering.

## NN Page: Collaboration with Git
title:: Collaboration with Git
source:: collaboration-git.md
route:: collaboration-git
order:: 50
parent:: [[Guides]]
description:: Gated workspace-to-Git review workflow with private defaults, branch-per-change PR gates, version map, and offline backup.

## NN Page: Workspace Backup Strategies
title:: Workspace Backup Strategies
source:: workspace-backups.md
route:: workspace-backups
order:: 60
parent:: [[Guides]]
description:: Layered workspace safety model: user-led snapshots, out-of-tree migration backups, and the optional Git collaboration layer.

## NN Page: Templates Overview
title:: Overview
source:: templates.md
route:: templates
order:: 10
parent:: [[Templates]]
description:: Overview of the iNNfo Level 2 bluepriNNts (apps) that model knowledge for a domain.

## NN Page: Video App
title:: Video App
source:: template-video.md
route:: template-video
order:: 20
parent:: [[Templates]]
description:: The video production bluepriNNt and its generated scenes and artifacts.

## NN Page: Offline Consoles
title:: Offline Consoles
source:: offline-consoles.md
route:: offline-consoles
order:: 10
parent:: [[Runtime & Internals]]
description:: How generated consoles boot offline from file:// via static script tags and a vendored UMD bundle.

## NN Page: Console Needs & Visuals
title:: Console Needs & Visuals
source:: console-needs-and-visuals.md
route:: console-needs-and-visuals
order:: 20
parent:: [[Runtime & Internals]]
description:: Capability needs and app-driven concept color/icon in generated consoles.

## NN Page: Validator Behavior
title:: Validator Behavior
source:: validator-behavior.md
route:: validator-behavior
order:: 30
parent:: [[Runtime & Internals]]
description:: Deterministic validation, differential baseline_path output, version inference, and workspace-first resolution.

## NN Page: Live Model Preview
title:: Live Model Preview
source:: live-preview.md
route:: live-preview
order:: 40
parent:: [[Runtime & Internals]]
description:: The opt-in MCP loopback server and SSE change stream that turns the editor tab into a read-only live mirror of the agent's mutations.

# NN NavbarItem

## NN NavbarItem: Ecosistema
label:: 🌐 **Ecosistema**: cognnitive.com
url:: /
order:: 1
parent:: [[iNNfo Documentation]]

## NN NavbarItem: iNNfo Specs
label:: 📘 **iNNfo Specs & Engine**: cognnitive.com/innfo
url:: /innfo/documentation/
order:: 2
parent:: [[iNNfo Documentation]]

## NN NavbarItem: Agent Skills
label:: ⚡ **Agent Skills Catalog**: cognnitive.com/skills
url:: /skills/documentation/
order:: 3
parent:: [[iNNfo Documentation]]

## NN NavbarItem: iNNfo Modeler App
label:: 🛠️ **iNNfo Modeler App**: Abrir App
url:: /innfo/app/
order:: 4
parent:: [[iNNfo Documentation]]

## NN NavbarItem: Bootstrap
label:: 🚀 **Bootstrap**: Instalar en Agente
url:: /use
order:: 5
parent:: [[iNNfo Documentation]]
