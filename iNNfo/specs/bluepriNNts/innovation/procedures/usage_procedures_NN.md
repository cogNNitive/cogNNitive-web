---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Using the Innovation Blueprint"
---

# NN Procedure

## NN Procedure: Using the Innovation Blueprint
slug:: using-the-innovation-blueprint
summary:: Getting started with the Innovation blueprint: create a Program, capture Opportunities, shape Initiatives, then score the pipeline.
inputs_required:: @innovation-portfolio
outputs_expected:: @scored-pipeline

It starts when: You want to run and rank an innovation portfolio.

### NN Work: Create a Program
slug:: create-a-program
step_type:: task
next:: @capture-opportunities
condition:: No innovation model exists yet
input:: @innovation-portfolio
output:: @innovation-portfolio
tool:: @console
executor:: human
scope:: internal
Add the `Program` element that anchors the portfolio.

### NN Work: Capture Opportunities
slug:: capture-opportunities
step_type:: task
next:: @shape-initiatives
condition:: Program created
input:: @innovation-portfolio
output:: @innovation-portfolio
tool:: @console
executor:: human
scope:: internal
Add `Opportunity` elements and the `Person` elements who surface or sponsor them.

### NN Work: Shape Initiatives
slug:: shape-initiatives
step_type:: task
next:: @score-the-innovation-pipeline
condition:: Opportunities captured
input:: @innovation-portfolio
output:: @innovation-portfolio
tool:: @console
executor:: human
scope:: internal
Promote the strongest opportunities into `Initiative` elements with owners.

### NN Work: Score the Innovation Pipeline
slug:: score-the-innovation-pipeline
step_type:: task
condition:: Initiatives shaped
input:: @innovation-portfolio
output:: @scored-pipeline
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `score-innovation-pipeline` procedure to rank initiatives for investment.

# NN Artifact

## NN Artifact: Innovation Portfolio
slug:: innovation-portfolio
type:: input
description:: The active level 3 model built on the Innovation blueprint.

## NN Artifact: Scored Pipeline
slug:: scored-pipeline
type:: output
description:: Ranked set of initiatives with investment recommendations.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent scoring the pipeline against program goals.

# NN Roles

## NN Roles: Innovation Lead
slug:: innovation-lead
type:: author
description:: Owns the innovation program and its investment calls.
