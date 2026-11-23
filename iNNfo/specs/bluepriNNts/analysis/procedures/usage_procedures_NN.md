---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Using the Analysis Blueprint"
---

# NN Work

## NN Work: Using the Analysis Blueprint
slug:: using-the-analysis-blueprint
step_type:: task
condition:: You want to stress-test the assumptions and risks behind a model
input:: @analysis-model
output:: @validated-analysis
tool:: @console
executor:: human
scope:: internal
Getting started with the Analysis blueprint: create an Analysis model, declare its assumptions, risks, keys and suggestions, then validate coherence and prioritise the experiments worth running.

## NN Work: Create the Analysis
slug:: create-the-analysis
parent:: @using-the-analysis-blueprint
step_type:: task
next:: @declare-assumptions-and-risks
condition:: No analysis model exists yet
input:: @analysis-model
output:: @analysis-model
tool:: @console
executor:: human
scope:: internal
Add an `Analysis` element and populate the `Assumptions`, `Risks`, `Keys` and `Suggestions` elements declared in the index.

## NN Work: Declare Assumptions and Risks
slug:: declare-assumptions-and-risks
parent:: @using-the-analysis-blueprint
step_type:: task
next:: @validate-coherence
condition:: Assumptions and risks are captured
input:: @analysis-model
output:: @assumptions-risk-map
tool:: @ai-agent
executor:: agent
scope:: internal
Map each assumption to the risks that would break it in the assumptions-risks matrix.

## NN Work: Validate Coherence
slug:: validate-coherence
parent:: @using-the-analysis-blueprint
step_type:: task
next:: @run-the-coherence-audit
condition:: Assumptions risk map complete
input:: @assumptions-risk-map
output:: @validated-analysis
tool:: @ai-agent
executor:: agent
scope:: internal
Fill the validation coherence checks so every high-impact risk carries a mitigation or an experiment.

## NN Work: Run the Coherence Audit
slug:: run-the-coherence-audit
parent:: @using-the-analysis-blueprint
step_type:: task
next:: @prioritize-experiments
condition:: Coherence checks present
input:: @validated-analysis
output:: @strategic-coherence-audit
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `run-coherence-audit` procedure to surface orphaned risks and unverified assumptions.

## NN Work: Prioritize Experiments
slug:: prioritize-experiments
parent:: @using-the-analysis-blueprint
step_type:: task
condition:: Strategic coherence audit produced
input:: @strategic-coherence-audit
output:: @prioritized-experiments
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `prioritize-experiments` procedure to rank experiments by impact and uncertainty.

# NN Artifact

## NN Artifact: Analysis Model
slug:: analysis-model
type:: input
description:: The active level 3 model built on the Analysis blueprint.

## NN Artifact: Assumptions Risk Map
slug:: assumptions-risk-map
type:: intermediate
description:: Evaluated matrix intersections of risks threatening core assumptions.

## NN Artifact: Validated Analysis
slug:: validated-analysis
type:: intermediate
description:: Analysis whose high-impact risks each carry a mitigation or experiment.

## NN Artifact: Strategic Coherence Audit
slug:: strategic-coherence-audit
type:: intermediate
description:: Audit report of orphaned risks and unverified assumptions.

## NN Artifact: Prioritized Experiments
slug:: prioritized-experiments
type:: output
description:: Experiments ranked by impact and uncertainty.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent verifying matrix completeness and drafting the audit.

# NN Roles

## NN Roles: Analysis Author
slug:: analysis-author
type:: author
description:: Owns the analysis model and signs off on its validation roadmap.
