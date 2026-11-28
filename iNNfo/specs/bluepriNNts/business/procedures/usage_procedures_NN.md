---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Business Blueprint"
---

# NN Procedure

## NN Procedure: Using the Business Blueprint
slug:: using-the-business-blueprint
summary:: Getting started with the Business blueprint: describe the business, then compose its sub-models (Analysis, Organization, Projects, Metrics) and run the procedures those include.
inputs_required:: @business-model
outputs_expected:: @validated-business-model

It starts when: You want to describe a business end to end.

### NN Work: Open the Business Model
slug:: open-the-business-model
step_type:: task
next:: @describe-the-business
condition:: No business model exists yet
input:: @business-model
output:: @business-model
tool:: @console
executor:: human
scope:: internal
Create a model on the Business blueprint; its index pulls in the business-model, analysis, organization, projects and metrics apps.

### NN Work: Describe the Business
slug:: describe-the-business
step_type:: task
next:: @model-organization-and-people
condition:: Business model created
input:: @business-model
output:: @business-model
tool:: @console
executor:: human
scope:: internal
Fill the business-model concepts: summary, market, value propositions, solutions, marketing, team, objectives, operations, finance and legal.

### NN Work: Model Organization and People
slug:: model-organization-and-people
step_type:: task
next:: @plan-projects
condition:: Business described
input:: @business-model
output:: @business-model
tool:: @console
executor:: human
scope:: internal
Populate the Organization concepts (roles, functions, positions, people, skills) inherited from the organization app.

### NN Work: Plan Projects
slug:: plan-projects
step_type:: task
next:: @set-metrics-and-goals
condition:: Organization modeled
input:: @business-model
output:: @business-model
tool:: @console
executor:: human
scope:: internal
Populate the Projects concepts (phases, milestones, deliverables, tasks, risks) inherited from the projects app.

### NN Work: Set Metrics and Goals
slug:: set-metrics-and-goals
step_type:: task
next:: @run-included-procedures
condition:: Projects planned
input:: @business-model
output:: @business-model
tool:: @console
executor:: human
scope:: internal
Populate the Metrics concepts (metrics, variables, evolution, scenario) and the goals matrix.

### NN Work: Run Included Procedures
slug:: run-included-procedures
step_type:: task
condition:: Sub-models populated
input:: @business-model
output:: @validated-business-model
tool:: @ai-agent
executor:: agent
scope:: internal
Run the inherited procedures — `run-coherence-audit`, `prioritize-experiments`, `audit-skill-gaps`, `export-team-directory`, `calculate-critical-path`, `generate-status-report` — as the model matures.

# NN Artifact

## NN Artifact: Business Model
slug:: business-model
type:: input
description:: The active level 3 model built on the Business blueprint.

## NN Artifact: Validated Business Model
slug:: validated-business-model
type:: output
description:: Business model whose sub-models are populated and whose procedures have run.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent running the inherited procedures across the sub-models.

# NN Roles

## NN Roles: Business Author
slug:: business-author
type:: author
description:: Owns the business model across all of its sub-models.
