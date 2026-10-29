---
level: 3
parent_spec:
  name: "procedures_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Projects Blueprint"
---

# NN Work

## NN Work: Using the Projects Blueprint
step_type:: task
condition:: You want to plan and track delivery work
input:: [[Project Model]]
output:: [[Status Report]]
tool:: [[Console]]
scope:: internal
Getting started with the Projects blueprint: create the Project, plan phases and milestones, add deliverables and tasks, track risks, then compute the critical path and generate a status report.

## NN Work: Create the Project
parent:: [[Using the Projects Blueprint]]
step_type:: task
next:: [[Plan Phases and Milestones]]
condition:: No project model exists yet
input:: [[Project Model]]
output:: [[Project Model]]
tool:: [[Console]]
scope:: internal
Add the `Project` element that anchors the model.

## NN Work: Plan Phases and Milestones
parent:: [[Using the Projects Blueprint]]
step_type:: task
next:: [[Add Deliverables and Tasks]]
condition:: Project element created
input:: [[Project Model]]
output:: [[Project Model]]
tool:: [[Console]]
scope:: internal
Populate the `Phases` and nested `Milestone` elements.

## NN Work: Add Deliverables and Tasks
parent:: [[Using the Projects Blueprint]]
step_type:: task
next:: [[Track Risks]]
condition:: Phases and milestones planned
input:: [[Project Model]]
output:: [[Project Model]]
tool:: [[Console]]
scope:: internal
Capture `Deliverable` and `Task` elements and their dependencies.

## NN Work: Track Risks
parent:: [[Using the Projects Blueprint]]
step_type:: task
next:: [[Calculate the Critical Path]]
condition:: Tasks and dependencies present
input:: [[Project Model]]
output:: [[Project Model]]
tool:: [[Console]]
scope:: internal
Record `Risk` elements and assign owners from `Project roles`.

## NN Work: Calculate the Critical Path
parent:: [[Using the Projects Blueprint]]
step_type:: task
next:: [[Generate the Status Report]]
condition:: Task graph complete
input:: [[Project Model]]
output:: [[Critical Path]]
tool:: [[AI Agent]]
scope:: internal
Execute the `calculate-critical-path` procedure to identify the longest dependency chain.

## NN Work: Generate the Status Report
parent:: [[Using the Projects Blueprint]]
step_type:: task
condition:: Critical path computed
input:: [[Critical Path]]
output:: [[Status Report]]
tool:: [[AI Agent]]
scope:: internal
Execute the `generate-status-report` procedure to summarise progress and slippage.

# NN Artifact

## NN Artifact: Project Model
type:: input
description:: The active level 3 model built on the Projects blueprint.

## NN Artifact: Critical Path
type:: intermediate
description:: Longest dependency chain through the task graph.

## NN Artifact: Status Report
type:: output
description:: Progress and slippage summary for stakeholders.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent computing the critical path and drafting the report.

# NN Roles

## NN Roles: Project Manager
type:: author
description:: Owns the project plan and keeps the status report current.
