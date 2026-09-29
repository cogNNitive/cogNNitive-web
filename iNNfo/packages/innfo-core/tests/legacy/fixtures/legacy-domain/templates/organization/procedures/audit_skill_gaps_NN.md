---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Audit Skill Gaps Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Audit Skill Gaps
step_type:: task
parent:: -
next:: -
condition:: An organization model is loaded
input:: [[Active Organization Model]]
output:: [[Skill Gap Analysis Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Analyze required organizational functions, active positions, and assigned persons against their declared skills to identify competency shortages and hiring/training needs.

## NN Work: Map Functions to Positions
parent:: [[Audit Skill Gaps]]
step_type:: task
next:: [[Evaluate Person Skills]]
condition:: Procedure starts
input:: [[Active Organization Model]]
output:: [[Position Function Mapping]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Examine the functions-positions matrix and positions-roles matrix to determine the complete functional coverage and accountability required for each seat.

## NN Work: Evaluate Person Skills
parent:: [[Audit Skill Gaps]]
step_type:: task
next:: [[Generate Gap Report]]
condition:: Position mapping complete
input:: [[Position Function Mapping]]
output:: [[Evaluated Competencies]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Compare the declared skills of persons currently occupying each position with the competencies necessary to execute assigned organizational functions.

## NN Work: Generate Gap Report
parent:: [[Audit Skill Gaps]]
step_type:: task
next:: -
condition:: Competency evaluation complete
input:: [[Evaluated Competencies]]
output:: [[Skill Gap Analysis Report]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Format the skill deficiencies, redundant coverage areas, and actionable recruitment/training recommendations into a structured Markdown audit report.

# NN Artifact

## NN Artifact: Active Organization Model
type:: input
description:: The level 3 organization model defining roles, positions, persons, and skills.

## NN Artifact: Position Function Mapping
type:: intermediate
description:: Intermediate matrix resolving responsibilities across seats.

## NN Artifact: Evaluated Competencies
type:: intermediate
description:: Scoring of individual skillsets against position requirements.

## NN Artifact: Skill Gap Analysis Report
type:: output
description:: Final comprehensive report listing missing competencies and hiring recommendations.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent capable of inspecting relational graphs and matrix intersections.

# NN Roles

## NN Roles: People Operations Lead
type:: reviewer
description:: Evaluates and confirms the resulting skill gap findings and approves workforce adjustments.
