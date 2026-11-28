---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Projects Blueprint"
---

# NN Procedure

## NN Procedure: Using the Projects Blueprint
slug:: using-the-projects-blueprint
summary:: Getting started with the Projects blueprint: create the Project, plan phases and milestones, add deliverables and tasks, track risks, then compute the critical path and generate a status report.
inputs_required:: @project-model
outputs_expected:: @status-report

It starts when: You want to plan and track delivery work.

### NN Work: Create the Project
slug:: create-the-project
step_type:: task
next:: @plan-phases-and-milestones
condition:: No project model exists yet
input:: @project-model
output:: @project-model
tool:: @console
executor:: human
scope:: internal
Add the `Project` element that anchors the model.

### NN Work: Plan Phases and Milestones
slug:: plan-phases-and-milestones
step_type:: task
next:: @add-deliverables-and-tasks
condition:: Project element created
input:: @project-model
output:: @project-model
tool:: @console
executor:: human
scope:: internal
Populate the `Phases` and nested `Milestone` elements.

### NN Work: Add Deliverables and Tasks
slug:: add-deliverables-and-tasks
step_type:: task
next:: @track-risks
condition:: Phases and milestones planned
input:: @project-model
output:: @project-model
tool:: @console
executor:: human
scope:: internal
Capture `Deliverable` and `Task` elements and their dependencies.

### NN Work: Track Risks
slug:: track-risks
step_type:: task
next:: @calculate-the-critical-path
condition:: Tasks and dependencies present
input:: @project-model
output:: @project-model
tool:: @console
executor:: human
scope:: internal
Record `Risk` elements and assign owners from `Project roles`.

### NN Work: Calculate the Critical Path
slug:: calculate-the-critical-path
step_type:: task
next:: @generate-the-status-report
condition:: Task graph complete
input:: @project-model
output:: @critical-path
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `calculate-critical-path` procedure to identify the longest dependency chain.

### NN Work: Generate the Status Report
slug:: generate-the-status-report
step_type:: task
condition:: Critical path computed
input:: @critical-path
output:: @status-report
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `generate-status-report` procedure to summarise progress and slippage.

# NN Artifact

## NN Artifact: Project Model
slug:: project-model
type:: input
description:: The active level 3 model built on the Projects blueprint.

## NN Artifact: Critical Path
slug:: critical-path
type:: intermediate
description:: Longest dependency chain through the task graph.

## NN Artifact: Status Report
slug:: status-report
type:: output
description:: Progress and slippage summary for stakeholders.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent computing the critical path and drafting the report.

# NN Roles

## NN Roles: Project Manager
slug:: project-manager
type:: author
description:: Owns the project plan and keeps the status report current.
