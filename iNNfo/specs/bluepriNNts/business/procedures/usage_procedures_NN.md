---
level: 3
parent_spec:
  name: "procedures_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Business Blueprint"
---

# NN Work

## NN Work: Using the Business Blueprint
step_type:: task
condition:: You want to describe a business end to end
input:: [[Business Model]]
output:: [[Validated Business Model]]
tool:: [[Console]]
scope:: internal
Getting started with the Business blueprint: describe the business, then compose its sub-models (Analysis, Organization, Projects, Metrics) and run the procedures those include.

## NN Work: Open the Business Model
parent:: [[Using the Business Blueprint]]
step_type:: task
next:: [[Describe the Business]]
condition:: No business model exists yet
input:: [[Business Model]]
output:: [[Business Model]]
tool:: [[Console]]
scope:: internal
Create a model on the Business blueprint; its index pulls in the business-model, analysis, organization, projects and metrics apps.

## NN Work: Describe the Business
parent:: [[Using the Business Blueprint]]
step_type:: task
next:: [[Model Organization and People]]
condition:: Business model created
input:: [[Business Model]]
output:: [[Business Model]]
tool:: [[Console]]
scope:: internal
Fill the business-model concepts: summary, market, value propositions, solutions, marketing, team, objectives, operations, finance and legal.

## NN Work: Model Organization and People
parent:: [[Using the Business Blueprint]]
step_type:: task
next:: [[Plan Projects]]
condition:: Business described
input:: [[Business Model]]
output:: [[Business Model]]
tool:: [[Console]]
scope:: internal
Populate the Organization concepts (roles, functions, positions, people, skills) inherited from the organization app.

## NN Work: Plan Projects
parent:: [[Using the Business Blueprint]]
step_type:: task
next:: [[Set Metrics and Goals]]
condition:: Organization modeled
input:: [[Business Model]]
output:: [[Business Model]]
tool:: [[Console]]
scope:: internal
Populate the Projects concepts (phases, milestones, deliverables, tasks, risks) inherited from the projects app.

## NN Work: Set Metrics and Goals
parent:: [[Using the Business Blueprint]]
step_type:: task
next:: [[Run Included Procedures]]
condition:: Projects planned
input:: [[Business Model]]
output:: [[Business Model]]
tool:: [[Console]]
scope:: internal
Populate the Metrics concepts (metrics, variables, evolution, scenario) and the goals matrix.

## NN Work: Run Included Procedures
parent:: [[Using the Business Blueprint]]
step_type:: task
condition:: Sub-models populated
input:: [[Business Model]]
output:: [[Validated Business Model]]
tool:: [[AI Agent]]
scope:: internal
Run the inherited procedures — `run-coherence-audit`, `prioritize-experiments`, `audit-skill-gaps`, `export-team-directory`, `calculate-critical-path`, `generate-status-report` — as the model matures.

# NN Artifact

## NN Artifact: Business Model
type:: input
description:: The active level 3 model built on the Business blueprint.

## NN Artifact: Validated Business Model
type:: output
description:: Business model whose sub-models are populated and whose procedures have run.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent running the inherited procedures across the sub-models.

# NN Roles

## NN Roles: Business Author
type:: author
description:: Owns the business model across all of its sub-models.
