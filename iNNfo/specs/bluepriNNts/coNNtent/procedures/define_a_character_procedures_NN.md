---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
title: "Define a Character"
---

# NN Procedure

## NN Procedure: Define a Character
slug:: define-a-character
summary:: The wizard that produces `library/characters/<name>/` and the catalog Voice entries it needs.
level:: domaiNN or series
outputs_expected:: @character-folder
It starts when: Set up the Domain is applied. The series may not exist yet.

### NN Work: Choose the character name and level
slug:: choose-the-character-name-and-level
next:: @choose-a-voice-per-language
step_type:: decision
executor:: human
decision:: the name and whether the character belongs to the domaiNN or to a series
scope:: internal
The name is the `character::` value every series and scene will use.

### NN Work: Choose a voice per language
slug:: choose-a-voice-per-language
next:: @clone-the-character-voices
step_type:: decision
executor:: human
decision:: for each language the character speaks, clone a sample or select an existing Voice whose `language` matches
scope:: internal
A Voice of language `en` offered for an `es` slot is refused and another is asked for. There is no fallback voice: a character that cannot speak the episode language stops the draft before any narration.

### NN Work: Clone the character voices
slug:: clone-the-character-voices
next:: @choose-the-appearance-defaults
step_type:: task
executor:: agent
produces:: one catalog Voice per voice the person chose to clone
scope:: internal
For each voice the person chose to clone, run `~/.agents/skills/nn-conntent/scripts/voice-clone.mjs <name> <sample-audio> --language <code>` once, with that voice's name, sample and language, decided in the previous step. Each clone writes a catalog Voice carrying its `language`. One voice at a time, with its own sample, so each Voice is traceable to its recording.

### NN Work: Choose the appearance defaults
slug:: choose-the-appearance-defaults
next:: @build-the-character-folder
step_type:: decision
executor:: human
decision:: `default_pose`, `avatar_model`, `avatar_resolution` and `default_background` for the character
scope:: internal
These are the values a scene inherits when it sets `character::` without `pose::` or `background::`.

### NN Work: Build the character folder
slug:: build-the-character-folder
next:: @deliver-the-character-proposal
step_type:: task
executor:: agent
produces:: `CHARACTER.md` (frontmatter `voices: {<lang>: <Voice slug>}`, `default_pose`, `avatar_model`, `avatar_resolution`, `default_background`) plus `avatars/`, `backgrounds/`, `voice/`, and the prose
scope:: internal
The prose states the speaking and narrative style, the things the character never says, and a few examples. Plan an Episode reads it before writing any narration.

### NN Work: Deliver the character proposal
slug:: deliver-the-character-proposal
next:: @approve-the-character-proposal
step_type:: task
executor:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` covering the catalog Voice entries and the `character` reference
scope:: internal
One `produce_artifact` record with the sha256 of each created file. Dry-apply it. The agent does not apply it.

### NN Work: Approve the character proposal
slug:: approve-the-character-proposal
step_type:: decision
executor:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
A character whose proposal is not applied is not used by any episode.

# NN Artifact

## NN Artifact: Character Folder
slug:: character-folder
