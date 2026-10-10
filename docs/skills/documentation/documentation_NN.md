---
level: 3
parent_spec:
  name: "documentation_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/documentation/spec_NN.md"
model_version: "V_0-2-0"
title: "Agent Skills Documentation Model"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[DocSite]]
* [[Section]]
* [[Page]]
* [[NavbarItem]]

# NN DocSite

## NN DocSite: Agent Skills Documentation
site_title:: Agent Skills Documentation
site_description:: Autonomous agent skills, deterministic statecharts, and transformation workflows for AI pair programming.
base_path:: docs/skills/documentation/
site_logo:: favicon.svg
repo_url:: https://github.com/cogNNitive/cogNNitive
nav_enabled:: true

# NN Section

## NN Section: Architecture
title:: Architecture & Flows
section_order:: 1
parent:: [[Agent Skills Documentation]]

## NN Section: Canonical Skills
title:: Canonical Skills
section_order:: 2
parent:: [[Agent Skills Documentation]]

## NN Section: Samples
title:: Samples
section_order:: 3
parent:: [[Agent Skills Documentation]]

# NN Page

## NN Page: Home
title:: Home
source:: README.md
route:: README.md
order:: 1
parent:: [[Agent Skills Documentation]]
tags:: [docs, home, overview]

Overview of the Agent Skills catalog, ecosystem philosophy, and agent setup guide.

## NN Page: Interaction Flows
title:: Interaction Flows & Statechart
source:: skills/interaction-flows.md
route:: skills/interaction-flows.md
order:: 10
parent:: [[Architecture]]
tags:: [docs, architecture, fsm, statechart, mermaid]

Deterministic finite state machine, decision transition matrix, and governance paths across cogNNitive skills from the "nn" entry point.

## NN Page: nn
title:: nn
source:: skills/nn.md
route:: skills/nn.md
order:: 5
parent:: [[Canonical Skills]]
tags:: [docs, skills, nn, front-controller, governance]

Primary Front Controller, ecosystem entry point, job loop navigation menu, system governance, and preflight readiness gate.


## NN Page: nn-preflight
title:: nn-preflight
source:: skills/nn-preflight.md
route:: skills/nn-preflight.md
order:: 20
parent:: [[Canonical Skills]]
tags:: [docs, skills, preflight, readiness, environment]

Environment readiness gate running deterministic Tier 1 and Tier 2 checks before specialized workflows execute.

## NN Page: nn-innfo
title:: nn-innfo
source:: skills/nn-innfo.md
route:: skills/nn-innfo.md
order:: 30
parent:: [[Canonical Skills]]
tags:: [docs, skills, innfo, modeling, wizard, mcp]

Semantic modeling assistant, schema validator, and conversational Model Creation Wizard (Template L2 to Model L3).

## NN Page: nn-sources
title:: nn-sources
source:: skills/nn-sources.md
route:: skills/nn-sources.md
order:: 40
parent:: [[Canonical Skills]]
tags:: [docs, skills, sources, ingestion, provenance]

Multi-modal document ingestion, Markdown normalization with mandatory sidecar provenance, and domaiNN lineage synchronization.

## NN Page: nn-site-generator
title:: nn-site-generator
source:: skills/nn-site-generator.md
route:: skills/nn-site-generator.md
order:: 50
parent:: [[Canonical Skills]]
tags:: [docs, skills, sitegen, web, docsify]

Static website generator, layout hydrator, Umami analytics integrator, and Docsify suite scaffolder.

## NN Page: nn-skills-lifecycle
title:: nn-skills-lifecycle
source:: skills/nn-skills-lifecycle.md
route:: skills/nn-skills-lifecycle.md
order:: 60
parent:: [[Canonical Skills]]
tags:: [docs, skills, lifecycle, manifest, steward]

Skill lifecycle management, bootstrap manifest pinning, lockfile auditing, and synchronization.

## NN Page: nn-design-presets
title:: nn-design-presets
source:: skills/nn-design-presets.md
route:: skills/nn-design-presets.md
order:: 70
parent:: [[Canonical Skills]]
tags:: [docs, skills, design, presets, morado-nazareno]

Visual design system tokens, typography scales, 8px grid, and Docsify style presets for Morado Nazareno (#4D0E4E).

## NN Page: nn-upgrade
title:: nn-upgrade
source:: skills/nn-upgrade.md
route:: skills/nn-upgrade.md
order:: 80
parent:: [[Canonical Skills]]
tags:: [docs, skills, upgrade, migration, templates]

Guided, consent-gated migration of a workspace to the latest adopted iNNfo Level-2 templates.

## NN Page: Sample Workflows
title:: Sample Workflows
source:: sample-workflows.md
route:: sample-workflows.md
order:: 10
parent:: [[Samples]]
tags:: [docs, samples, recipes]

Ready-to-run sample transformation recipes and demonstrations.

# NN NavbarItem

## NN NavbarItem: Ecosystem
label:: 🌐 **Ecosystem**: cognnitive.com
url:: /
order:: 1
parent:: [[Agent Skills Documentation]]

## NN NavbarItem: iNNfo Specs
label:: 📘 **iNNfo Specs & Engine**: cognnitive.com/innfo
url:: /innfo/documentation/
order:: 2
parent:: [[Agent Skills Documentation]]

## NN NavbarItem: Agent Skills
label:: ⚡ **Agent Skills Catalog**: cognnitive.com/skills
url:: /skills/documentation/
order:: 3
parent:: [[Agent Skills Documentation]]

## NN NavbarItem: iNNfo Modeler App
label:: 🛠️ **iNNfo Modeler App**: Open App
url:: /innfo/app/
order:: 4
parent:: [[Agent Skills Documentation]]

## NN NavbarItem: Bootstrap
label:: 🚀 **Bootstrap**: Install in Agent
url:: /use
order:: 5
parent:: [[Agent Skills Documentation]]
