---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Prioritize Experiments Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Prioritize Experiments
step_type:: task
parent:: -
next:: -
condition:: An analysis model is loaded
input:: [[Active Analysis Model]]
output:: [[Prioritized Experiment Backlog]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Rank all validation experiments based on the criticality and uncertainty of the assumptions they validate.

## NN Work: Score Assumption Criticality
parent:: [[Prioritize Experiments]]
step_type:: task
next:: [[Rank Experiments by Impact]]
condition:: Procedure starts
input:: [[Active Analysis Model]]
output:: [[Assumption Uncertainty Scores]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Evaluate assumption markers (`importance`, `certainty`, `priority`) to determine which hypotheses pose the greatest existential risk if false.

## NN Work: Rank Experiments by Impact
parent:: [[Prioritize Experiments]]
step_type:: task
next:: -
condition:: Assumptions scored
input:: [[Assumption Uncertainty Scores]]
output:: [[Prioritized Experiment Backlog]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Order validation experiments using the experiments-assumptions matrix so high-leverage tests are executed first.

# NN Artifact

## NN Artifact: Active Analysis Model
type:: input
description:: The active level 3 strategic analysis model.

## NN Artifact: Assumption Uncertainty Scores
type:: intermediate
description:: Calculated uncertainty rankings of model assumptions.

## NN Artifact: Prioritized Experiment Backlog
type:: output
description:: Final ordered backlog of validation tests with expected evidence criteria.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent computing multi-factor prioritization matrices.

# NN Roles

## NN Roles: Product Strategist
type:: maintainer
description:: Manages the strategic discovery backlog and coordinates experiment execution.
