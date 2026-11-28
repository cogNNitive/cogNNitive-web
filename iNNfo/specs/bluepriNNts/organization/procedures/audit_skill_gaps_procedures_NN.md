---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Audit Skill Gaps Procedure"
---

# NN Procedure

## NN Procedure: Audit Skill Gaps
slug:: audit-skill-gaps
summary:: Analyze required organizational functions, active positions, and assigned persons against their declared skills to identify competency shortages and hiring/training needs.
inputs_required:: @active-organization-model
outputs_expected:: @skill-gap-analysis-report

It starts when: An organization model is loaded.

### NN Work: Map Functions to Positions
slug:: map-functions-to-positions
step_type:: task
next:: @evaluate-person-skills
condition:: Procedure starts
input:: @active-organization-model
output:: @position-function-mapping
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Examine the functions-positions matrix and positions-roles matrix to determine the complete functional coverage and accountability required for each seat.

### NN Work: Evaluate Person Skills
slug:: evaluate-person-skills
step_type:: task
next:: @generate-gap-report
condition:: Position mapping complete
input:: @position-function-mapping
output:: @evaluated-competencies
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Compare the declared skills of persons currently occupying each position with the competencies necessary to execute assigned organizational functions.

### NN Work: Generate Gap Report
slug:: generate-gap-report
step_type:: task
condition:: Competency evaluation complete
input:: @evaluated-competencies
output:: @skill-gap-analysis-report
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Format the skill deficiencies, redundant coverage areas, and actionable recruitment/training recommendations into a structured Markdown audit report.

# NN Artifact

## NN Artifact: Active Organization Model
slug:: active-organization-model
type:: input
description:: The level 3 organization model defining roles, positions, persons, and skills.

## NN Artifact: Position Function Mapping
slug:: position-function-mapping
type:: intermediate
description:: Intermediate matrix resolving responsibilities across seats.

## NN Artifact: Evaluated Competencies
slug:: evaluated-competencies
type:: intermediate
description:: Scoring of individual skillsets against position requirements.

## NN Artifact: Skill Gap Analysis Report
slug:: skill-gap-analysis-report
type:: output
description:: Final comprehensive report listing missing competencies and hiring recommendations.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent capable of inspecting relational graphs and matrix intersections.

# NN Roles

## NN Roles: People Operations Lead
slug:: people-operations-lead
type:: reviewer
description:: Evaluates and confirms the resulting skill gap findings and approves workforce adjustments.
