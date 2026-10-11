---
level: 3
parent_spec:
  name: "procedures_V_0-3-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Innovation Blueprint"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Using the Innovation Blueprint
step_type:: task
condition:: You want to run and rank an innovation portfolio
input:: [[Innovation Portfolio]]
output:: [[Scored Pipeline]]
tool:: [[Console]]
scope:: internal
Getting started with the Innovation blueprint: create a Program, capture Opportunities, shape Initiatives, then score the pipeline.

## NN Work: Create a Program
parent:: [[Using the Innovation Blueprint]]
step_type:: task
next:: [[Capture Opportunities]]
condition:: No innovation model exists yet
input:: [[Innovation Portfolio]]
output:: [[Innovation Portfolio]]
tool:: [[Console]]
scope:: internal
Add the `Program` element that anchors the portfolio.

## NN Work: Capture Opportunities
parent:: [[Using the Innovation Blueprint]]
step_type:: task
next:: [[Shape Initiatives]]
condition:: Program created
input:: [[Innovation Portfolio]]
output:: [[Innovation Portfolio]]
tool:: [[Console]]
scope:: internal
Add `Opportunity` elements and the `Person` elements who surface or sponsor them.

## NN Work: Shape Initiatives
parent:: [[Using the Innovation Blueprint]]
step_type:: task
next:: [[Score the Innovation Pipeline]]
condition:: Opportunities captured
input:: [[Innovation Portfolio]]
output:: [[Innovation Portfolio]]
tool:: [[Console]]
scope:: internal
Promote the strongest opportunities into `Initiative` elements with owners.

## NN Work: Score the Innovation Pipeline
parent:: [[Using the Innovation Blueprint]]
step_type:: task
condition:: Initiatives shaped
input:: [[Innovation Portfolio]]
output:: [[Scored Pipeline]]
tool:: [[AI Agent]]
scope:: internal
Execute the `score-innovation-pipeline` procedure to rank initiatives for investment.

# NN Artifact

## NN Artifact: Innovation Portfolio
type:: input
description:: The active level 3 model built on the Innovation blueprint.

## NN Artifact: Scored Pipeline
type:: output
description:: Ranked set of initiatives with investment recommendations.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent scoring the pipeline against program goals.

# NN Roles

## NN Roles: Innovation Lead
type:: author
description:: Owns the innovation program and its investment calls.
