---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Score Innovation Pipeline Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Score Innovation Pipeline
step_type:: task
parent:: -
next:: -
condition:: An innovation model is loaded
input:: [[Active Innovation Model]]
output:: [[Innovation Portfolio Scoring Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Evaluate all declared Opportunities and Initiatives across the innovation program to score feasibility, strategic impact, and lifecycle gate readiness.

## NN Work: Triage Opportunity Pipeline
parent:: [[Score Innovation Pipeline]]
step_type:: task
next:: [[Score Active Initiatives]]
condition:: Procedure starts
input:: [[Active Innovation Model]]
output:: [[Prioritized Opportunities]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Examine opportunity statuses, proposer links, and target markets to rank incoming ideas by strategic alignment and urgency.

## NN Work: Score Active Initiatives
parent:: [[Score Innovation Pipeline]]
step_type:: task
next:: [[Generate Portfolio Report]]
condition:: Opportunities triaged
input:: [[Prioritized Opportunities]]
output:: [[Initiative Health Scores]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Assess active initiative budgets, milestones, learnings, and decisions (Persevere / Pivot / Stop) across the portfolio.

## NN Work: Generate Portfolio Report
parent:: [[Score Innovation Pipeline]]
step_type:: task
next:: -
condition:: Initiatives scored
input:: [[Initiative Health Scores]]
output:: [[Innovation Portfolio Scoring Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Format the innovation pipeline funnel, stage-gate progression, and resource allocation recommendations into an executive briefing.

# NN Artifact

## NN Artifact: Active Innovation Model
type:: input
description:: The active level 3 innovation model.

## NN Artifact: Prioritized Opportunities
type:: intermediate
description:: Evaluated funnel ranking of innovation opportunities.

## NN Artifact: Initiative Health Scores
type:: intermediate
description:: Scoring of initiative progress and strategic milestones.

## NN Artifact: Innovation Portfolio Scoring Report
type:: output
description:: Final portfolio evaluation report in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent computing stage-gate portfolio scores.

# NN Roles

## NN Roles: Innovation Program Director
type:: maintainer
description:: Directs the innovation strategy and allocates portfolio funding.
