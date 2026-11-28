---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
title: "Create a Series"
---

# NN Procedure

## NN Procedure: Create a Series
slug:: create-a-series
summary:: The wizard that produces `series/<s>/<s>_coNNtent_NN.md` (Kinds, Chrome, Presets, `review_gates`, budgets) and a dry-run test episode.
level:: series
outputs_expected:: @series-document
It starts when: Set up the Domain is applied. A frame and a character are optional (the package `neutral` frame and no character are valid).

### NN Work: Choose the series identity and language
slug:: choose-the-series-identity-and-language
next:: @choose-the-host-character-and-the-frame
step_type:: decision
executor:: human
decision:: the series slug, its title and its `language`
scope:: internal
The language drives the Chrome lookup, the voice check and the whisper model.

### NN Work: Choose the host character and the frame
slug:: choose-the-host-character-and-the-frame
next:: @define-the-scene-kinds
step_type:: decision
executor:: human
decision:: the `character::` host and the `frame::` of the series, or the package defaults
scope:: internal
A scene may later bring a guest character, but the series has one host.

### NN Work: Define the Scene Kinds
slug:: define-the-scene-kinds
next:: @write-the-chrome-for-each-language
step_type:: decision
executor:: human
decision:: one Scene Kind at a time — its role, maximum duration, narration on or off, Chrome slots, presets and direct fields
scope:: internal
Every episode declares a Kind per scene, or the reserved `Libre`.

### NN Work: Write the Chrome for each language
slug:: write-the-chrome-for-each-language
next:: @define-the-presets
step_type:: decision
executor:: human
decision:: the watermark, CTA, bumper and music for every language the series produces in
scope:: internal
A series whose language is `es` needs `es` Chrome; the dry run fails and names the missing Chrome when it does not exist.

### NN Work: Define the Presets
slug:: define-the-presets
next:: @choose-the-gates-and-the-budgets
step_type:: decision
executor:: human
decision:: the ordered Preset lists for the series, each level's fields, and any scene or video override
scope:: internal
When the series has a host character, do not set `voice` or `avatar` in a Preset: setting them raises `CHARACTER_OVERRIDDEN`, and the warning is shown before the proposal.

### NN Work: Choose the gates and the budgets
slug:: choose-the-gates-and-the-budgets
next:: @deliver-the-series-proposal
step_type:: decision
executor:: human
decision:: `review_gates` (default `[script, preview]`, `[]` for autopilot) and `budget`/`daily_budget`
scope:: internal
An unset `budget` means the budget gate always asks; set it when the series has a spending envelope.

### NN Work: Deliver the series proposal
slug:: deliver-the-series-proposal
next:: @approve-the-series-proposal
step_type:: task
executor:: agent
produces:: one sealed `proposed` changeset written with `writeProposedChangeset` holding the series document and the dry-run test episode document
scope:: internal
One `add_element` per Scene Kind, Chrome and Preset, and one `produce_artifact` per created file. Dry-apply it. The agent does not apply it.

### NN Work: Approve the series proposal
slug:: approve-the-series-proposal
next:: @run-the-dry-run-test-episode
step_type:: decision
executor:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
Applying the changeset is the engine's step; the series and its test episode exist before the dry run.

### NN Work: Run the dry-run test episode
slug:: run-the-dry-run-test-episode
next:: @keep-or-discard-the-test-episode
step_type:: task
executor:: agent
produces:: the dry-run report of the test episode
scope:: internal
Run `~/.agents/skills/nn-conntent/scripts/produce.mjs <test-episode-dir> --dry-run` on the test episode the applied series proposal created; its path is known only inside the run, so it is not a run parameter. Validation and the persisted plan only: no synthesis, no render, no spend, no ledger record. It reports every resolved value with its source trace, the library names and the files they resolved to, the Chrome and the voice found for the series language, and the plan estimate. A missing item fails and is named, and the procedure does not complete while the dry run fails.

### NN Work: Keep or discard the test episode
slug:: keep-or-discard-the-test-episode
step_type:: decision
executor:: human
decision:: keep the test episode as the series' first episode, or discard it
scope:: internal
Keeping makes it the first episode and leaves it at `idea` or `draft`, with no spend. Discarding removes it through an engine changeset and leaves the series with no episodes. This is the last step.

# NN Artifact

## NN Artifact: Series Document
slug:: series-document
