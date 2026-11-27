---
level: 3
parent_spec:
  name: "procedures_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Score Innovation Pipeline Procedure"
---

# NN Work

## NN Work: Score Innovation Pipeline
slug:: score-innovation-pipeline
step_type:: task
condition:: An innovation model is loaded
input:: @active-innovation-model
output:: @innovation-portfolio-scoring-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Evaluate all declared Opportunities and Initiatives across the innovation program to score feasibility, strategic impact, and lifecycle gate readiness.

## NN Work: Triage Opportunity Pipeline
slug:: triage-opportunity-pipeline
parent:: @score-innovation-pipeline
step_type:: task
next:: @score-active-initiatives
condition:: Procedure starts
input:: @active-innovation-model
output:: @prioritized-opportunities
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Examine opportunity statuses, proposer links, and target markets to rank incoming ideas by strategic alignment and urgency.

## NN Work: Score Active Initiatives
slug:: score-active-initiatives
parent:: @score-innovation-pipeline
step_type:: task
next:: @generate-portfolio-report
condition:: Opportunities triaged
input:: @prioritized-opportunities
output:: @initiative-health-scores
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Assess active initiative budgets, milestones, learnings, and decisions (Persevere / Pivot / Stop) across the portfolio.

## NN Work: Generate Portfolio Report
slug:: generate-portfolio-report
parent:: @score-innovation-pipeline
step_type:: task
condition:: Initiatives scored
input:: @initiative-health-scores
output:: @innovation-portfolio-scoring-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Format the innovation pipeline funnel, stage-gate progression, and resource allocation recommendations into an executive briefing.

# NN Artifact

## NN Artifact: Active Innovation Model
slug:: active-innovation-model
type:: input
description:: The active level 3 innovation model.

## NN Artifact: Prioritized Opportunities
slug:: prioritized-opportunities
type:: intermediate
description:: Evaluated funnel ranking of innovation opportunities.

## NN Artifact: Initiative Health Scores
slug:: initiative-health-scores
type:: intermediate
description:: Scoring of initiative progress and strategic milestones.

## NN Artifact: Innovation Portfolio Scoring Report
slug:: innovation-portfolio-scoring-report
type:: output
description:: Final portfolio evaluation report in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent computing stage-gate portfolio scores.

# NN Roles

## NN Roles: Innovation Program Director
slug:: innovation-program-director
type:: maintainer
description:: Directs the innovation strategy and allocates portfolio funding.
