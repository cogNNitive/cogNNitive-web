---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Generate Project Status Report Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Generate Project Status Report
step_type:: task
parent:: -
next:: -
condition:: A projects model is loaded
input:: [[Active Projects Model]]
output:: [[Project Status Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Synthesize milestone completion, active deliverable progress, open risks, and task assignments into an executive project health report.

## NN Work: Aggregate Milestone Progress
parent:: [[Generate Project Status Report]]
step_type:: task
next:: [[Compile Health Dashboard]]
condition:: Procedure starts
input:: [[Active Projects Model]]
output:: [[Milestone Status Metrics]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Evaluate milestone completion markers (`completion`, `health`) and measure deliverable status against target schedule dates.

## NN Work: Compile Health Dashboard
parent:: [[Generate Project Status Report]]
step_type:: task
next:: -
condition:: Milestone metrics compiled
input:: [[Milestone Status Metrics]]
output:: [[Project Status Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Format the milestone progress, open blockers, upcoming deadlines, and risk mitigation status into a structured Markdown executive briefing.

# NN Artifact

## NN Artifact: Active Projects Model
type:: input
description:: The active level 3 projects model.

## NN Artifact: Milestone Status Metrics
type:: intermediate
description:: Quantitative summary of completed vs pending milestones.

## NN Artifact: Project Status Report
type:: output
description:: Final status briefing document in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent generating structured project analytics.

# NN Roles

## NN Roles: Delivery Lead
type:: reviewer
description:: Signs off on project status briefings and communicates milestone progress.
