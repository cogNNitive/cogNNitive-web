---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Using the Organization Blueprint"
---

# NN Work

## NN Work: Using the Organization Blueprint
slug:: using-the-organization-blueprint
step_type:: task
condition:: You want to describe how a team or company is structured
input:: @organization-model
output:: @team-directory
tool:: @console
executor:: human
scope:: internal
Getting started with the Organization blueprint: create the Organization, add its roles, functions, positions, people and skills, then audit skill gaps and export the team directory.

## NN Work: Define the Organization
slug:: define-the-organization
parent:: @using-the-organization-blueprint
step_type:: task
next:: @add-roles-functions-and-positions
condition:: No organization model exists yet
input:: @organization-model
output:: @organization-model
tool:: @console
executor:: human
scope:: internal
Add the `Organization` element that anchors the model.

## NN Work: Add Roles, Functions and Positions
slug:: add-roles-functions-and-positions
parent:: @using-the-organization-blueprint
step_type:: task
next:: @add-people-and-skills
condition:: Organization element created
input:: @organization-model
output:: @organization-model
tool:: @console
executor:: human
scope:: internal
Populate the `Roles`, `Functions` and `Position` elements that describe the structure.

## NN Work: Add People and Skills
slug:: add-people-and-skills
parent:: @using-the-organization-blueprint
step_type:: task
next:: @audit-skill-gaps
condition:: Positions defined
input:: @organization-model
output:: @organization-model
tool:: @console
executor:: human
scope:: internal
Assign `Person` elements to positions and capture the required `Skills`.

## NN Work: Audit Skill Gaps
slug:: audit-skill-gaps
parent:: @using-the-organization-blueprint
step_type:: task
next:: @export-the-team-directory
condition:: People and skills captured
input:: @organization-model
output:: @skill-gap-report
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `audit-skill-gaps` procedure to flag missing or thin coverage per function.

## NN Work: Export the Team Directory
slug:: export-the-team-directory
parent:: @using-the-organization-blueprint
step_type:: task
condition:: Skill gaps reviewed
input:: @skill-gap-report
output:: @team-directory
tool:: @ai-agent
executor:: agent
scope:: internal
Execute the `export-team-directory` procedure to produce the shareable directory.

# NN Artifact

## NN Artifact: Organization Model
slug:: organization-model
type:: input
description:: The active level 3 model built on the Organization blueprint.

## NN Artifact: Skill Gap Report
slug:: skill-gap-report
type:: intermediate
description:: Coverage analysis of required skills against assigned people.

## NN Artifact: Team Directory
slug:: team-directory
type:: output
description:: Shareable directory of people, positions and functions.

# NN Tools

## NN Tools: Console
slug:: console
type:: manual
description:: The cogNNitive console used to author and inspect the model.

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent computing skill coverage and assembling the directory.

# NN Roles

## NN Roles: Organization Author
slug:: organization-author
type:: author
description:: Owns the organization model and its skill coverage decisions.
