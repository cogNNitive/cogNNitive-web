---
level: 3
parent_spec:
  name: "procedures_V_0-3-3"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Analysis Blueprint"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor; [cogNNitive](https://cognnitive.com/innfo/) shows it in the domain console.

# NN Work

## NN Work: Using the Analysis Blueprint
step_type:: task
condition:: You want to stress-test the assumptions and risks behind a model
input:: [[Analysis Model]]
output:: [[Validated Analysis]]
tool:: [[Console]]
scope:: internal
Getting started with the Analysis blueprint: create an Analysis model, declare its assumptions, risks, keys and suggestions, then validate coherence and prioritise the experiments worth running.

## NN Work: Create the Analysis
parent:: [[Using the Analysis Blueprint]]
step_type:: task
next:: [[Declare Assumptions and Risks]]
condition:: No analysis model exists yet
input:: [[Analysis Model]]
output:: [[Analysis Model]]
tool:: [[Console]]
scope:: internal
Add an `Analysis` element and populate the `Assumptions`, `Risks`, `Keys` and `Suggestions` elements declared in the index.

## NN Work: Declare Assumptions and Risks
parent:: [[Using the Analysis Blueprint]]
step_type:: task
next:: [[Validate Coherence]]
condition:: Assumptions and risks are captured
input:: [[Analysis Model]]
output:: [[Assumptions Risk Map]]
tool:: [[AI Agent]]
scope:: internal
Map each assumption to the risks that would break it in the assumptions-risks matrix.

## NN Work: Validate Coherence
parent:: [[Using the Analysis Blueprint]]
step_type:: task
next:: [[Run the Coherence Audit]]
condition:: Assumptions risk map complete
input:: [[Assumptions Risk Map]]
output:: [[Validated Analysis]]
tool:: [[AI Agent]]
scope:: internal
Fill the validation coherence checks so every high-impact risk carries a mitigation or an experiment.

## NN Work: Run the Coherence Audit
parent:: [[Using the Analysis Blueprint]]
step_type:: task
next:: [[Prioritize Experiments]]
condition:: Coherence checks present
input:: [[Validated Analysis]]
output:: [[Strategic Coherence Audit]]
tool:: [[AI Agent]]
scope:: internal
Execute the `run-coherence-audit` procedure to surface orphaned risks and unverified assumptions.

## NN Work: Prioritize Experiments
parent:: [[Using the Analysis Blueprint]]
step_type:: task
condition:: Strategic coherence audit produced
input:: [[Strategic Coherence Audit]]
output:: [[Prioritized Experiments]]
tool:: [[AI Agent]]
scope:: internal
Execute the `prioritize-experiments` procedure to rank experiments by impact and uncertainty.

# NN Artifact

## NN Artifact: Analysis Model
type:: input
description:: The active level 3 model built on the Analysis blueprint.

## NN Artifact: Assumptions Risk Map
type:: intermediate
description:: Evaluated matrix intersections of risks threatening core assumptions.

## NN Artifact: Validated Analysis
type:: intermediate
description:: Analysis whose high-impact risks each carry a mitigation or experiment.

## NN Artifact: Strategic Coherence Audit
type:: intermediate
description:: Audit report of orphaned risks and unverified assumptions.

## NN Artifact: Prioritized Experiments
type:: output
description:: Experiments ranked by impact and uncertainty.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent verifying matrix completeness and drafting the audit.

# NN Roles

## NN Roles: Analysis Author
type:: author
description:: Owns the analysis model and signs off on its validation roadmap.
