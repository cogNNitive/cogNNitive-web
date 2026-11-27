---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Calculate Critical Path Procedure"
---

# NN Work

## NN Work: Calculate Critical Path
slug:: calculate-critical-path
step_type:: task
condition:: A projects model is loaded
input:: @active-projects-model
output:: @critical-path-analysis
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Traverse task dependency chains, deliverable milestones, and risk impacts to compute the critical path sequence and bottleneck points.

## NN Work: Build Dependency Graph
slug:: build-dependency-graph
parent:: @calculate-critical-path
step_type:: task
next:: @compute-path-durations
condition:: Procedure starts
input:: @active-projects-model
output:: @project-dependency-graph
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Parse all `depends_on` and `milestone_ref` references across Task and Deliverable elements to construct a directed acyclic dependency graph.

## NN Work: Compute Path Durations
slug:: compute-path-durations
parent:: @calculate-critical-path
step_type:: task
next:: @highlight-critical-risks
condition:: Dependency graph constructed
input:: @project-dependency-graph
output:: @schedule-sequences
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Calculate longest-path sequences across project phases to identify zero-slack activities that govern the final project delivery date.

## NN Work: Highlight Critical Risks
slug:: highlight-critical-risks
parent:: @calculate-critical-path
step_type:: task
condition:: Schedule sequences calculated
input:: @schedule-sequences
output:: @critical-path-analysis
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Cross-reference critical path tasks with the risks-milestones matrix and output an executive schedule risk summary with mitigation steps.

# NN Artifact

## NN Artifact: Active Projects Model
slug:: active-projects-model
type:: input
description:: The level 3 projects model containing project phases, tasks, and deliverables.

## NN Artifact: Project Dependency Graph
slug:: project-dependency-graph
type:: intermediate
description:: Resolved topological sequence of project activities.

## NN Artifact: Schedule Sequences
slug:: schedule-sequences
type:: intermediate
description:: Calculated phase durations and slack times.

## NN Artifact: Critical Path Analysis
slug:: critical-path-analysis
type:: output
description:: Final critical path schedule report in Markdown format.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent computing graph topological sorts and schedule slack.

# NN Roles

## NN Roles: Technical Project Lead
slug:: technical-project-lead
type:: maintainer
description:: Oversees project execution and enforces critical path schedule constraints.
