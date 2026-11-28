---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Generate Project Status Report Procedure"
---

# NN Procedure

## NN Procedure: Generate Project Status Report
slug:: generate-project-status-report
summary:: Synthesize milestone completion, active deliverable progress, open risks, and task assignments into an executive project health report.
inputs_required:: @active-projects-model
outputs_expected:: @project-status-report

It starts when: A projects model is loaded.

### NN Work: Aggregate Milestone Progress
slug:: aggregate-milestone-progress
step_type:: task
next:: @compile-health-dashboard
condition:: Procedure starts
input:: @active-projects-model
output:: @milestone-status-metrics
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Evaluate milestone completion markers (`completion`, `health`) and measure deliverable status against target schedule dates.

### NN Work: Compile Health Dashboard
slug:: compile-health-dashboard
step_type:: task
condition:: Milestone metrics compiled
input:: @milestone-status-metrics
output:: @project-status-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Format the milestone progress, open blockers, upcoming deadlines, and risk mitigation status into a structured Markdown executive briefing.

# NN Artifact

## NN Artifact: Active Projects Model
slug:: active-projects-model
type:: input
description:: The active level 3 projects model.

## NN Artifact: Milestone Status Metrics
slug:: milestone-status-metrics
type:: intermediate
description:: Quantitative summary of completed vs pending milestones.

## NN Artifact: Project Status Report
slug:: project-status-report
type:: output
description:: Final status briefing document in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent generating structured project analytics.

# NN Roles

## NN Roles: Delivery Lead
slug:: delivery-lead
type:: reviewer
description:: Signs off on project status briefings and communicates milestone progress.
