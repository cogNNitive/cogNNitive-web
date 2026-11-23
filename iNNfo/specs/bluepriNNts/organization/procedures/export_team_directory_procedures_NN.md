---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
title: "Export Team Directory Procedure"
---

# NN Work

## NN Work: Export Team Directory
slug:: export-team-directory
step_type:: task
condition:: An organization model is loaded
input:: @active-organization-model
output:: @team-directory-markdown
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Compile all Person, Position, Role, and Skill elements from the active organization model into a human-readable team directory and accountability roster.

## NN Work: Extract Personnel Records
slug:: extract-personnel-records
parent:: @export-team-directory
step_type:: task
next:: @assemble-roster-markdown
condition:: Procedure starts
input:: @active-organization-model
output:: @personnel-records
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Iterate through all Person elements, resolving their `position_ref`, assumed Roles via the matrix, associated Skills, and direct contact/contribution details.

## NN Work: Assemble Roster Markdown
slug:: assemble-roster-markdown
parent:: @export-team-directory
step_type:: task
condition:: Personnel records extracted
input:: @personnel-records
output:: @team-directory-markdown
output_status:: verified
tool:: @ai-agent
executor:: agent
scope:: internal
Format the structured directory containing avatar previews, role summaries, compensation categories, and skill badges.

# NN Artifact

## NN Artifact: Active Organization Model
slug:: active-organization-model
type:: input
description:: The active level 3 organization model.

## NN Artifact: Personnel Records
slug:: personnel-records
type:: intermediate
description:: Parsed profile information for team members.

## NN Artifact: Team Directory Markdown
slug:: team-directory-markdown
type:: output
description:: Complete team roster in GitHub Flavored Markdown.

# NN Tools

## NN Tools: AI Agent
slug:: ai-agent
type:: automated
description:: Cognitive agent executing markdown compilation.

# NN Roles

## NN Roles: Organization Architect
slug:: organization-architect
type:: maintainer
description:: Maintains the structural accuracy of the enterprise roster.
