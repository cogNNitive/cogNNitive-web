---
level: 3
parent_spec:
  name: "procedures_V_0-2-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md"
model_version: "V_0-1-0"
title: "Export Team Directory Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN Work

## NN Work: Export Team Directory
step_type:: task
parent:: -
next:: -
condition:: An organization model is loaded
input:: [[Active Organization Model]]
output:: [[Team Directory Markdown]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Compile all Person, Position, Role, and Skill elements from the active organization model into a human-readable team directory and accountability roster.

## NN Work: Extract Personnel Records
parent:: [[Export Team Directory]]
step_type:: task
next:: [[Assemble Roster Markdown]]
condition:: Procedure starts
input:: [[Active Organization Model]]
output:: [[Personnel Records]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Iterate through all Person elements, resolving their `position_ref`, assumed Roles via the matrix, associated Skills, and direct contact/contribution details.

## NN Work: Assemble Roster Markdown
parent:: [[Export Team Directory]]
step_type:: task
next:: -
condition:: Personnel records extracted
input:: [[Personnel Records]]
output:: [[Team Directory Markdown]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Format the structured directory containing avatar previews, role summaries, compensation categories, and skill badges.

# NN Artifact

## NN Artifact: Active Organization Model
type:: input
description:: The active level 3 organization model.

## NN Artifact: Personnel Records
type:: intermediate
description:: Parsed profile information for team members.

## NN Artifact: Team Directory Markdown
type:: output
description:: Complete team roster in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent executing markdown compilation.

# NN Roles

## NN Roles: Organization Architect
type:: maintainer
description:: Maintains the structural accuracy of the enterprise roster.
