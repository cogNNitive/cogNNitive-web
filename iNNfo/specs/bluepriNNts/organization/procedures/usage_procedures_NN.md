---
level: 3
parent_spec:
  name: "procedures_V_0-3-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the Organization Blueprint"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Using the Organization Blueprint
step_type:: task
condition:: You want to describe how a team or company is structured
input:: [[Organization Model]]
output:: [[Team Directory]]
tool:: [[Console]]
scope:: internal
Getting started with the Organization blueprint: create the Organization, add its roles, functions, positions, people and skills, then audit skill gaps and export the team directory.

## NN Work: Define the Organization
parent:: [[Using the Organization Blueprint]]
step_type:: task
next:: [[Add Roles, Functions and Positions]]
condition:: No organization model exists yet
input:: [[Organization Model]]
output:: [[Organization Model]]
tool:: [[Console]]
scope:: internal
Add the `Organization` element that anchors the model.

## NN Work: Add Roles, Functions and Positions
parent:: [[Using the Organization Blueprint]]
step_type:: task
next:: [[Add People and Skills]]
condition:: Organization element created
input:: [[Organization Model]]
output:: [[Organization Model]]
tool:: [[Console]]
scope:: internal
Populate the `Roles`, `Functions` and `Position` elements that describe the structure.

## NN Work: Add People and Skills
parent:: [[Using the Organization Blueprint]]
step_type:: task
next:: [[Audit Skill Gaps]]
condition:: Positions defined
input:: [[Organization Model]]
output:: [[Organization Model]]
tool:: [[Console]]
scope:: internal
Assign `Person` elements to positions and capture the required `Skills`.

## NN Work: Audit Skill Gaps
parent:: [[Using the Organization Blueprint]]
step_type:: task
next:: [[Export the Team Directory]]
condition:: People and skills captured
input:: [[Organization Model]]
output:: [[Skill Gap Report]]
tool:: [[AI Agent]]
scope:: internal
Execute the `audit-skill-gaps` procedure to flag missing or thin coverage per function.

## NN Work: Export the Team Directory
parent:: [[Using the Organization Blueprint]]
step_type:: task
condition:: Skill gaps reviewed
input:: [[Skill Gap Report]]
output:: [[Team Directory]]
tool:: [[AI Agent]]
scope:: internal
Execute the `export-team-directory` procedure to produce the shareable directory.

# NN Artifact

## NN Artifact: Organization Model
type:: input
description:: The active level 3 model built on the Organization blueprint.

## NN Artifact: Skill Gap Report
type:: intermediate
description:: Coverage analysis of required skills against assigned people.

## NN Artifact: Team Directory
type:: output
description:: Shareable directory of people, positions and functions.

# NN Tools

## NN Tools: Console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent computing skill coverage and assembling the directory.

# NN Roles

## NN Roles: Organization Author
type:: author
description:: Owns the organization model and its skill coverage decisions.
