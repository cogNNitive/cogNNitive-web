---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Calculate Critical Path Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Calculate Critical Path
step_type:: task
parent:: -
next:: -
condition:: A projects model is loaded
input:: [[Active Projects Model]]
output:: [[Critical Path Analysis]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Traverse task dependency chains, deliverable milestones, and risk impacts to compute the critical path sequence and bottleneck points.

## NN Work: Build Dependency Graph
parent:: [[Calculate Critical Path]]
step_type:: task
next:: [[Compute Path Durations]]
condition:: Procedure starts
input:: [[Active Projects Model]]
output:: [[Project Dependency Graph]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Parse all `depends_on` and `milestone_ref` references across Task and Deliverable elements to construct a directed acyclic dependency graph.

## NN Work: Compute Path Durations
parent:: [[Calculate Critical Path]]
step_type:: task
next:: [[Highlight Critical Risks]]
condition:: Dependency graph constructed
input:: [[Project Dependency Graph]]
output:: [[Schedule Sequences]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Calculate longest-path sequences across project phases to identify zero-slack activities that govern the final project delivery date.

## NN Work: Highlight Critical Risks
parent:: [[Calculate Critical Path]]
step_type:: task
next:: -
condition:: Schedule sequences calculated
input:: [[Schedule Sequences]]
output:: [[Critical Path Analysis]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Cross-reference critical path tasks with the risks-milestones matrix and output an executive schedule risk summary with mitigation steps.

# NN Artifact

## NN Artifact: Active Projects Model
type:: input
description:: The level 3 projects model containing project phases, tasks, and deliverables.

## NN Artifact: Project Dependency Graph
type:: intermediate
description:: Resolved topological sequence of project activities.

## NN Artifact: Schedule Sequences
type:: intermediate
description:: Calculated phase durations and slack times.

## NN Artifact: Critical Path Analysis
type:: output
description:: Final critical path schedule report in Markdown format.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent computing graph topological sorts and schedule slack.

# NN Roles

## NN Roles: Technical Project Lead
type:: maintainer
description:: Oversees project execution and enforces critical path schedule constraints.
