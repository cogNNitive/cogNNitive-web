---
level: 3
parent_spec:
  name: "documentation_V_0-4-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/documentation/spec_NN.md"
knowledge_version: "V_0-4-0"
title: "cogNNitive Documentation"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN index

* [[DocSite]]
* [[Section]]
* [[Page]]
* [[NavbarItem]]

# NN DocSite

## NN DocSite: cogNNitive Documentation
slug:: cognnitive-documentation
site_title:: cogNNitive Documentation
site_description:: The canonical documentation for the cogNNitive ecosystem: the iNNfo specification chain, the nn-core engine, the nn-mcp server, the domain console, and the agent skills.
base_path:: docs/documentation/
site_logo:: ../logo.svg
repo_url:: https://github.com/cogNNitive/cogNNitive
nav_enabled:: true

# NN Section

## NN Section: Tutorials
slug:: tutorials
title:: 🚀 Tutorials
section_order:: 1
parent:: [[cogNNitive Documentation]]

## NN Section: How-To Guides
slug:: how-to
title:: 📖 How-To Guides
section_order:: 2
parent:: [[cogNNitive Documentation]]

## NN Section: Architecture & Concepts
slug:: concepts
title:: 💡 Architecture & Concepts
section_order:: 3
parent:: [[cogNNitive Documentation]]

## NN Section: Reference
slug:: reference
title:: 🛠 Reference
section_order:: 4
parent:: [[cogNNitive Documentation]]

## NN Section: Canonical Skills
slug:: skills
title:: ⚡ Agent Skills
section_order:: 5
parent:: [[cogNNitive Documentation]]

# NN Page

## NN Page: Home
slug:: home
title:: Home
source:: README.md
route:: README.md
order:: 1
parent:: [[cogNNitive Documentation]]
tags:: [docs, home, overview]

Entry point: what cogNNitive is, how this documentation is organized, and where to start.

## NN Page: Create your first domaiNN
slug:: first-domain
title:: Create your first domaiNN
source:: content/tutorials/first-domain.md
route:: content/tutorials/first-domain.md
order:: 10
parent:: [[Tutorials]]
tags:: [docs, tutorial, quickstart, domain]

A five-minute happy path from installing the ecosystem to a validated domaiNN.

## NN Page: Model a domain from scratch
slug:: domain-from-scratch
title:: Model a domain from scratch
source:: content/tutorials/domain-from-scratch.md
route:: content/tutorials/domain-from-scratch.md
order:: 20
parent:: [[Tutorials]]
tags:: [docs, tutorial, modeling, sources]

A hands-on walkthrough: scaffold a domaiNN, ingest a source, model it with citations, and read the lineage record.

## NN Page: Install and connect an AI agent
slug:: install-agent
title:: Install and connect an AI agent
source:: content/how-to/install-agent.md
route:: content/how-to/install-agent.md
order:: 10
parent:: [[How-To Guides]]
tags:: [docs, how-to, install, mcp, agents]

Register the nn-mcp server and download the agent skills into Claude Code, OpenCode, Antigravity, or Cursor.

## NN Page: Validate a domaiNN
slug:: validate-domain
title:: Validate a domaiNN
source:: content/how-to/validate-domain.md
route:: content/how-to/validate-domain.md
order:: 20
parent:: [[How-To Guides]]
tags:: [docs, how-to, validation, diagnostics]

Run the deterministic validator, read its diagnostics, and fix the common failures.

## NN Page: Import and cite sources
slug:: import-sources
title:: Import and cite sources
source:: content/how-to/import-sources.md
route:: content/how-to/import-sources.md
order:: 30
parent:: [[How-To Guides]]
tags:: [docs, how-to, sources, citations, sidecar]

Bring raw documents into a domaiNN and reference their headings from kNNowledge.

## NN Page: Cognitivize documents with sidecars
slug:: cognitivize
title:: Cognitivize documents with sidecars
source:: content/how-to/cognitivize.md
route:: content/how-to/cognitivize.md
order:: 40
parent:: [[How-To Guides]]
tags:: [docs, how-to, sidecar, hash, provenance]

Generate a sidecar that hashes a source and makes every heading a citable unit.

## NN Page: Use the domain console
slug:: domain-console
title:: Use the domain console
source:: content/how-to/domain-console.md
route:: content/how-to/domain-console.md
order:: 50
parent:: [[How-To Guides]]
tags:: [docs, how-to, console, review]

Generate and open the offline domain console to browse and review a domaiNN.

## NN Page: Review changesets
slug:: review-changesets
title:: Review changesets
source:: content/how-to/review-changesets.md
route:: content/how-to/review-changesets.md
order:: 60
parent:: [[How-To Guides]]
tags:: [docs, how-to, changeset, review, mutation]

Propose, review, and apply changesets — the supported way to mutate a domaiNN.

## NN Page: Sync lineage and back up a domaiNN
slug:: sync-and-backup
title:: Sync lineage and back up a domaiNN
source:: content/how-to/sync-and-backup.md
route:: content/how-to/sync-and-backup.md
order:: 70
parent:: [[How-To Guides]]
tags:: [docs, how-to, lineage, backup, drift]

Keep the lineage record in sync, detect drift, and back a domaiNN up safely.

## NN Page: Collaborate with Git
slug:: collaborate-git
title:: Collaborate with Git
source:: content/how-to/collaborate-git.md
route:: content/how-to/collaborate-git.md
order:: 80
parent:: [[How-To Guides]]
tags:: [docs, how-to, git, collaboration, review]

Use Git as an optional review and collaboration layer on top of a private domaiNN.

## NN Page: Execute a procedure
slug:: execute-procedure
title:: Execute a procedure
source:: content/how-to/execute-procedure.md
route:: content/how-to/execute-procedure.md
order:: 90
parent:: [[How-To Guides]]
tags:: [docs, how-to, procedures, execution]

Ask your agent to run a declared procedure and review its outputs.

## NN Page: The four levels
slug:: levels
title:: The four levels
source:: content/concepts/levels.md
route:: content/concepts/levels.md
order:: 10
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, levels, grammar]

The L0–L3 abstraction chain: defiNNition, iNNfo, bluepriNNt, kNNowledge — and the domaiNN container.

## NN Page: Ecosystem architecture
slug:: ecosystem
title:: Ecosystem architecture
source:: content/concepts/ecosystem.md
route:: content/concepts/ecosystem.md
order:: 20
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, ecosystem, architecture]

How the engine, the MCP server, the console, the skills, and the domains fit together.

## NN Page: The specification chain
slug:: specifications
title:: The specification chain
source:: content/concepts/specifications.md
route:: content/concepts/specifications.md
order:: 30
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, specifications, semver]

How a document resolves its parent chain and why every level is versioned.

## NN Page: Canonical vocabulary
slug:: vocabulary
title:: Canonical vocabulary
source:: content/vocabulary.md
route:: content/vocabulary.md
order:: 40
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, vocabulary, terms]

The canonical terms and the retired aliases they replace.

## NN Page: The knowledge lifecycle
slug:: knowledge-lifecycle
title:: The knowledge lifecycle
source:: content/concepts/knowledge-lifecycle.md
route:: content/concepts/knowledge-lifecycle.md
order:: 50
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, lifecycle, provenance]

How knowledge enters, is modelled, changed, and traced, end to end.

## NN Page: Sources, citations and lineage
slug:: sources-citations-lineage
title:: Sources, citations and lineage
source:: content/concepts/sources-citations-lineage.md
route:: content/concepts/sources-citations-lineage.md
order:: 60
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, sources, citations, lineage]

The three terms behind provenance: Source, Citation, and Lineage.

## NN Page: Tags and open taxonomy
slug:: tags-and-taxonomy
title:: Tags and open taxonomy
source:: content/concepts/tags-and-taxonomy.md
route:: content/concepts/tags-and-taxonomy.md
order:: 70
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, tags, taxonomy]

Cross-cutting classification with the ordinary `tags` Field — no reserved primitive.

## NN Page: Validator behavior
slug:: validator-behavior
title:: Validator behavior
source:: content/concepts/validator-behavior.md
route:: content/concepts/validator-behavior.md
order:: 80
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, validator, diagnostics]

Deterministic validation, severity, diagnostics, and resolution order.

## NN Page: Integrations and discipline overlaps
slug:: integrations
title:: Integrations and discipline overlaps
source:: content/concepts/integrations.md
route:: content/concepts/integrations.md
order:: 90
parent:: [[Architecture & Concepts]]
tags:: [docs, concept, integrations, disciplines]

MCP vs CLI, external tools, and where cogNNitive overlaps established disciplines.

## NN Page: MCP tools
slug:: mcp-tools
title:: MCP tools
source:: content/reference/mcp-tools.md
route:: content/reference/mcp-tools.md
order:: 10
parent:: [[Reference]]
tags:: [docs, reference, mcp, tools]

The tools the nn-mcp server exposes to AI agents.

## NN Page: bluepriNNts catalog
slug:: blueprints
title:: bluepriNNts catalog
source:: content/reference/blueprints.md
route:: content/reference/blueprints.md
order:: 20
parent:: [[Reference]]
tags:: [docs, reference, blueprints, catalog]

The Level-2 bluepriNNts distributed with the ecosystem.

## NN Page: CLI and scripts
slug:: cli
title:: CLI and scripts
source:: content/reference/cli.md
route:: content/reference/cli.md
order:: 30
parent:: [[Reference]]
tags:: [docs, reference, cli, scripts]

The nn-sources CLI and the repository scripts that build and verify the ecosystem.

## NN Page: Glossary
slug:: glossary
title:: Glossary
source:: content/reference/glossary.md
route:: content/reference/glossary.md
order:: 40
parent:: [[Reference]]
tags:: [docs, reference, glossary]

Short definitions of the terms used across the documentation.

## NN Page: Agent skills overview
slug:: skills-overview
title:: Agent skills overview
source:: content/skills/README.md
route:: content/skills/README.md
order:: 2
parent:: [[cogNNitive Documentation]]
tags:: [docs, skills, overview]

What an agent skill is, how the ecosystem is composed, and how to install them.

## NN Page: nn
slug:: nn
title:: nn
source:: content/skills/nn.md
route:: content/skills/nn.md
order:: 10
parent:: [[Canonical Skills]]
tags:: [docs, skills, nn, front-controller]

The primary front controller and job-loop entry point.

## NN Page: nn-sources
slug:: nn-sources
title:: nn-sources
source:: content/skills/nn-sources.md
route:: content/skills/nn-sources.md
order:: 20
parent:: [[Canonical Skills]]
tags:: [docs, skills, sources, ingestion]

Document ingestion, normalization, and lineage synchronization.

## NN Page: nn-innfo
slug:: nn-innfo
title:: nn-innfo
source:: content/skills/nn-innfo.md
route:: content/skills/nn-innfo.md
order:: 30
parent:: [[Canonical Skills]]
tags:: [docs, skills, innfo, modeling, wizard]

Author, edit, and validate iNNfo knowledge with the Model Creation Wizard.

## NN Page: nn-preflight
slug:: nn-preflight
title:: nn-preflight
source:: content/skills/nn-preflight.md
route:: content/skills/nn-preflight.md
order:: 40
parent:: [[Canonical Skills]]
tags:: [docs, skills, preflight, readiness]

The environment readiness gate and skill-location reference.

## NN Page: nn-upgrade
slug:: nn-upgrade
title:: nn-upgrade
source:: content/skills/nn-upgrade.md
route:: content/skills/nn-upgrade.md
order:: 50
parent:: [[Canonical Skills]]
tags:: [docs, skills, upgrade, migration]

Consent-gated migration of a domaiNN to the latest bluepriNNts.

## NN Page: nn-site-generator
slug:: nn-site-generator
title:: nn-site-generator
source:: content/skills/nn-site-generator.md
route:: content/skills/nn-site-generator.md
order:: 60
parent:: [[Canonical Skills]]
tags:: [docs, skills, site-generator, web]

Website creation, analytics, and contact forms.

## NN Page: nn-design-presets
slug:: nn-design-presets
title:: nn-design-presets
source:: content/skills/nn-design-presets.md
route:: content/skills/nn-design-presets.md
order:: 70
parent:: [[Canonical Skills]]
tags:: [docs, skills, design, presets]

Visual design presets: palettes, typography, and spacing.

## NN Page: nn-skills-lifecycle
slug:: nn-skills-lifecycle
title:: nn-skills-lifecycle
source:: content/skills/nn-skills-lifecycle.md
route:: content/skills/nn-skills-lifecycle.md
order:: 80
parent:: [[Canonical Skills]]
tags:: [docs, skills, lifecycle, manifest]

Audit, update, and maintain cogNNitive skills.

## NN Page: Interaction flows
slug:: interaction-flows
title:: Interaction flows
source:: content/skills/interaction-flows.md
route:: content/skills/interaction-flows.md
order:: 95
parent:: [[Architecture & Concepts]]
tags:: [docs, skills, statechart, routing]

How the skills hand off to one another, from the `nn` entry point.

# NN NavbarItem

## NN NavbarItem: Website
slug:: website
label:: 🌐 **Website**: cognnitive.com
url:: https://cognnitive.com
order:: 1
parent:: [[cogNNitive Documentation]]

## NN NavbarItem: GitHub
slug:: github
label:: 🐙 **GitHub**: cogNNitive/cogNNitive
url:: https://github.com/cogNNitive/cogNNitive
order:: 2
parent:: [[cogNNitive Documentation]]

## NN NavbarItem: Bootstrap
slug:: bootstrap
label:: 🚀 **Bootstrap**: install in your agent
url:: /use
order:: 3
parent:: [[cogNNitive Documentation]]
