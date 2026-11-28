---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
title: "Set up the Domain"
---

# NN Procedure

## NN Procedure: Set up the Domain
slug:: set-up-the-domain
summary:: The wizard that adopts the bluepriNNt on a domaiNN: layout check, defaults, catalog, voices, whisper, library and the managed gitignore block.
level:: domaiNN
outputs_expected:: @domain-setup-changeset
It starts when: A folder that will hold the domaiNN, the coNNtent bluepriNNt installed, and Node.js available. The folder has no legacy layout and does not already carry an applied setup.

### NN Work: Confirm the domaiNN root
slug:: confirm-the-domainn-root
next:: @adopt-the-blueprint-defaults
step_type:: task
executor:: agent
produces:: a folder-contract report: the confirmation, or one `legacy-layout` message per detected path
scope:: internal
Run the folder-contract check on the chosen root. Any legacy path (`series/<s>/assets/<slug>/`, a root or series `sounds/`, `components/` or `frames/`, `video-guard.json`, the old `video-ledger.jsonl`) stops setup: report every finding, name the new location each message gives, and propose a new folder instead of adapting the old one.

### NN Work: Adopt the blueprint defaults
slug:: adopt-the-blueprint-defaults
next:: @choose-the-domainn-defaults
step_type:: task
executor:: agent
produces:: `video-defaults_NN.md` at the domaiNN root, copied unchanged from the package `defaults/video-defaults_NN.md` when absent
scope:: internal
When the file already exists, leave it untouched; its values become the defaults the next step offers. The copy carries no `language` and no `budget`, so both are asked for.

### NN Work: Choose the domaiNN defaults
slug:: choose-the-domainn-defaults
next:: @check-the-provider-credentials
step_type:: decision
executor:: human
decision:: the `language`, `budget`, `daily_budget`, `review_gates`, models and `output_formats` of the domaiNN, answered one at a time
scope:: internal
For each item the agent offers the default derived from the current state of the domaiNN (for example `es` when the existing `video-defaults_NN.md` already sets `language: es`) and waits for the answer before asking the next question.

### NN Work: Check the provider credentials
slug:: check-the-provider-credentials
next:: @review-the-catalog-and-its-prices
step_type:: task
executor:: engine
command:: ~/.agents/skills/nn-conntent/scripts/ensure-hyperframes.mjs --check
scope:: internal
Verify the pinned HyperFrames CLI and GSAP and report the provider keys the bluepriNNt declares, naming any missing key. Nothing is installed and nothing is spent.

### NN Work: Review the catalog and its prices
slug:: review-the-catalog-and-its-prices
next:: @register-a-voice-per-language
step_type:: task
executor:: agent
produces:: a catalog summary with every model, voice and price the domaiNN may use, each price with its source and date
scope:: internal
Read the merged catalog (`model-catalog_coNNtent_NN.md` over the package catalog). A model the person wants and the catalog lacks is proposed as a `Model` element; the agent never invents a price.

### NN Work: Register a voice per language
slug:: register-a-voice-per-language
next:: @clone-the-chosen-voices
step_type:: decision
executor:: human
decision:: the voice for each language the domaiNN will produce in — clone a sample, or pick an existing Voice whose `language` matches
scope:: internal
At least one voice per chosen language. A Voice whose `language` differs from the slot it is offered for is refused and another is asked for. The wizard does not move to the proposal until every chosen language has a voice, or the person records the choice to defer.

### NN Work: Clone the chosen voices
slug:: clone-the-chosen-voices
next:: @check-whispercpp
step_type:: task
executor:: agent
produces:: one catalog Voice per voice the person chose to clone
scope:: internal
For each voice the person chose to clone, run `~/.agents/skills/nn-conntent/scripts/voice-clone.mjs <name> <sample-audio> --language <code>` once, with that voice's name, sample and language. The names, samples and languages are decided in the previous step, one per language, so they are never run parameters. Each clone writes a catalog Voice carrying its `language`. A re-clone of an existing name needs the explicit force flag, which the agent never assumes; the script refuses a name or a sample already cloned and ledgers every attempt, so a repeated call never pays twice.

### NN Work: Check whisper.cpp
slug:: check-whispercpp
next:: @decide-on-the-whisper-install
step_type:: task
executor:: engine
command:: ~/.agents/skills/nn-conntent/scripts/ensure-hyperframes.mjs --check
scope:: internal
Report whisper as present or missing; it is an optional prerequisite. When it is missing and the chosen `captions` is not `off`, raise the install offer before the proposal.

### NN Work: Decide on the whisper install
slug:: decide-on-the-whisper-install
next:: @create-the-library-skeleton
step_type:: decision
executor:: human
decision:: accept the consent-gated whisper.cpp installation, or decline and keep the warning that a run with captions on will stop
scope:: internal
One prompt lists what will be installed and the approximate download size. Nothing installs silently and the engine never installs as a side effect of `produce`. Declining leaves setup valid, and `captions:: off` remains a valid choice.

### NN Work: Create the library skeleton
slug:: create-the-library-skeleton
next:: @summarise-and-deliver-the-setup-proposal
step_type:: task
executor:: agent
produces:: `library/` with its six kind folders (`music/`, `sounds/`, `frames/`, `components/`, `characters/`, `media/`) and the managed `.gitignore` block
scope:: internal
Append the managed block (`.cognnitive/cache/`, `.cognnitive/video/`, `hyperframes/`, the animatic) and verify that `library/` is not ignored.

### NN Work: Summarise and deliver the setup proposal
slug:: summarise-and-deliver-the-setup-proposal
next:: @approve-the-setup-proposal
step_type:: task
executor:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset`, plus its dry-apply result
scope:: internal
Summarise every decision before proposing. The changeset carries `add_model` for `domaiNN_NN.md` when the folder has none, the `update_field` changes on the adopted Video Defaults, one `add_element` per catalog Voice, and one `produce_artifact` record with the sha256 of every file the wizard created. Dry-apply it against the workspace: it must pass before the person is asked to approve. The agent does not apply it.

### NN Work: Approve the setup proposal
slug:: approve-the-setup-proposal
step_type:: decision
executor:: human
decision:: approve or reject the proposed changeset in the console (`Domain > Config`) or by replying OK
scope:: internal
Applying the changeset is the engine's step and regenerates the console. Only an applied change makes the new defaults, voices and references take effect; a library item no applied change references is not used for rendering.

# NN Artifact

## NN Artifact: Domain Setup Changeset
slug:: domain-setup-changeset
