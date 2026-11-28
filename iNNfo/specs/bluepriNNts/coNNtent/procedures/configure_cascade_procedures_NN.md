---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
blueprint_version: "V_0-32-6"
title: "Configure Cascade Parameters"
---


How to set a render or delivery parameter at the right level of the Universal Parameter
Cascade (`layer > scene > video > kind > series > domain > blueprint`). Every field named
here is a Field Definition of the coNNtent bluepriNNt, and a field may be set only on the
concepts its `concept::` lists. Each step declares its `executor`: `agent`, `engine` or `human` (a person deciding, or acting in the console section the step names). Engine commands are relative to the installed `nn-conntent` skill
folder (`skills/nn-conntent/` in the coNNtent bluepriNNt package).

# NN Procedure

## NN Procedure: Configure Cascade Parameters
slug:: configure-cascade-parameters
summary:: Sets one or more cascade parameters at the domain, series or video scope and proves the resolved values with the engine's dry run.
outputs_expected:: @cascade-change
level:: domaiNN, series or episode

It starts when: Set up the Domain is applied. For the series or video scope, the Series document exists.

### NN Work: Choose the parameter and its scope
slug:: choose-the-parameter-and-its-scope
next:: @locate-the-scope-document
step_type:: decision
executor:: human
decision:: the parameter, its value, and the scope that should own it — domain (every series), series (every episode of one series) or video (one episode)
scope:: internal
Pick the outermost scope that is true for every episode it covers: a value repeated in every
episode belongs to the series, and a value repeated in every series belongs to the domain.
`daily_budget` is settable only at the domain scope. A Scene Kind contributes only its
`presets`, never a direct parameter.

### NN Work: Locate the scope document
slug:: locate-the-scope-document
next:: @write-the-value-or-the-preset
step_type:: task
executor:: agent
produces:: the target document and element — domain `video-defaults_NN.md` at the domaiNN root (its `Video Defaults` element), series `series/<series>/<series>_coNNtent_NN.md` (its `Series` element), or video `series/<series>/episodes/<episode>/<episode>_coNNtent_NN.md` (its `Video` element)
scope:: internal
When the domain `video-defaults_NN.md` is absent, copy the package `defaults/video-defaults_NN.md`
there unchanged first, then tune the copy. Never write a default into the package copy.

### NN Work: Write the value or the Preset
slug:: write-the-value-or-the-preset
next:: @approve-the-cascade-change
step_type:: task
executor:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` that sets the field on the target element, or adds a `## NN Preset: <name>` element and appends its bare name to that element's `presets::` list
scope:: internal
Use a Preset when the same bundle of values applies at more than one place; set the field
directly when it is one value at one level. A level's explicit fields beat its own Presets, the
last Preset of a list wins, and lists are additive across levels. A Preset that omits a
parameter does not reset it. Dry-apply the changeset; the agent does not apply it.

### NN Work: Approve the cascade change
slug:: approve-the-cascade-change
next:: @check-the-resolved-values
step_type:: decision
executor:: human
decision:: approve or reject the proposed changeset in the console (`Domain > Config` or `Series > Config`) or by replying OK
scope:: internal
Only an applied change takes effect. A changed voice, voice model, speed or emotion is part of
the synthesized-audio cache identity, so the next run re-synthesizes the narration it affects.

### NN Work: Check the resolved values
slug:: check-the-resolved-values
step_type:: task
executor:: engine
command:: node scripts/produce.mjs series/<series>/episodes/<episode>/<episode>_coNNtent_NN.md --dry-run
scope:: internal
Run it on one affected episode. It reports every resolved value
with its source trace, so the new value must appear with the intended scope as its source. A
nearer level that still overrides it is named there.

# NN Artifact

## NN Artifact: Cascade Change
slug:: cascade-change
