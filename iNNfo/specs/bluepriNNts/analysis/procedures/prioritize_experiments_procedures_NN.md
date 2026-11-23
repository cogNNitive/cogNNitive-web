---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Prioritize Experiments Procedure"
---

# NN Work

## NN Work: Prioritize Experiments
slug:: prioritize-experiments
step_type:: task
condition:: An analysis model is loaded
input:: @active-analysis-model
output:: @prioritized-experiment-backlog
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Rank all validation experiments based on the criticality and uncertainty of the assumptions they validate.

## NN Work: Score Assumption Criticality
slug:: score-assumption-criticality
parent:: @prioritize-experiments
step_type:: task
next:: @rank-experiments-by-impact
condition:: Procedure starts
input:: @active-analysis-model
output:: @assumption-uncertainty-scores
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Evaluate assumption markers (`importance`, `certainty`, `priority`) to determine which hypotheses pose the greatest existential risk if false.

## NN Work: Rank Experiments by Impact
slug:: rank-experiments-by-impact
parent:: @prioritize-experiments
step_type:: task
condition:: Assumptions scored
input:: @assumption-uncertainty-scores
output:: @prioritized-experiment-backlog
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Order validation experiments using the experiments-assumptions matrix so high-leverage tests are executed first.

# NN Artifact

## NN Artifact: Active Analysis Model
slug:: active-analysis-model
type:: input
description:: The active level 3 strategic analysis model.

## NN Artifact: Assumption Uncertainty Scores
slug:: assumption-uncertainty-scores
type:: intermediate
description:: Calculated uncertainty rankings of model assumptions.

## NN Artifact: Prioritized Experiment Backlog
slug:: prioritized-experiment-backlog
type:: output
description:: Final ordered backlog of validation tests with expected evidence criteria.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent computing multi-factor prioritization matrices.

# NN Roles

## NN Roles: Product Strategist
slug:: product-strategist
type:: maintainer
description:: Manages the strategic discovery backlog and coordinates experiment execution.
