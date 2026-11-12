---
level: 3
parent_spec:
  name: "procedures_V_0-5-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Create a Character"
---

# NN Work

The file-level authoring guide for a coNNtent Character: the folder, its poses, its voice per
language and how a series or scene uses it. The `Define a Character` wizard in
`usage_procedures_NN.md` decides who the character is; this procedure states what is written
where. A character is used through the cascade fields `character`, `pose` and `background`
and through `avatar` Layers; it adds no field of its own to a document. Each step declares
exactly one tool: `agent`, `engine`, `console` or `human`. Engine commands are relative to the
installed `nn-conntent` skill folder (`skills/nn-conntent/` in the coNNtent bluepriNNt package).

## NN Work: Author a Character
step_type:: task
level:: domaiNN or series
condition:: Set up the Domain is applied. The character name is new at the chosen level.
output:: [[Character Folder]]
scope:: internal
Produces `library/characters/<slug>/` with `CHARACTER.md`, its avatar poses and a catalog Voice
for every language the character speaks.

## NN Work: Choose the slug and level
parent:: [[Author a Character]]
next:: [[Collect the source images]]
step_type:: decision
tool:: human
decision:: the character slug (kebab-case; it is the `character::` value) and whether it lives at the domaiNN (`library/characters/<slug>/`) or in one series (`series/<s>/library/characters/<slug>/`)
scope:: internal
A series-level character shadows a domaiNN-level one with the same slug.

## NN Work: Collect the source images
parent:: [[Author a Character]]
next:: [[Ask for a file path]]
step_type:: decision
tool:: human
decision:: the image file for each pose (for example `front`, `side`) and, optionally, each background
scope:: internal
Every pose is one image file on disk. A prompt-generated pose is produced first and saved as a
file before it becomes a pose.

## NN Work: Ask for a file path
parent:: [[Author a Character]]
next:: [[Clone or select a voice per language]]
step_type:: decision
tool:: human
decision:: the absolute file path of every image the person supplied in the chat
scope:: internal
An image pasted in the chat is not a file on disk, and no script can read it. When the person
supplies a photo in the chat, ask for the path of the original file (or ask them to save it and
give the path); never describe, recreate or guess the image instead.

## NN Work: Clone or select a voice per language
parent:: [[Author a Character]]
next:: [[Build the character folder]]
step_type:: task
tool:: engine
command:: node scripts/voice-clone.mjs <name> <sample-audio> --language <code> [--series <slug>]
scope:: internal
Run once per language, each with its own sample, or select an existing catalog Voice whose
`language` matches. The command writes a catalog Voice and never edits `CHARACTER.md`; the next
step records each Voice slug. A Voice of another language is refused for a slot; there is no
fallback voice. A re-clone of an
existing name needs `--force`, which the agent never assumes.

## NN Work: Build the character folder
parent:: [[Author a Character]]
next:: [[Use the character]]
step_type:: task
tool:: agent
produces:: `library/characters/<slug>/CHARACTER.md`, one image per pose in `avatars/<pose>.<ext>`, optional `backgrounds/<name>.<ext>`, and `voice/` holding the voice samples
scope:: internal
`CHARACTER.md` frontmatter declares `name` (equal to the folder slug), `voices` (a map of
ISO 639-1 language code to the Voice slug of the previous step), `default_pose` (a file name in
`avatars/` without extension), and optionally `avatar_model`, `avatar_resolution` and
`default_background` (a file name in `backgrounds/` without extension). The prose states the
speaking and narrative style, the things the character never says and a few examples: Plan an
Episode reads it before writing any narration. Copy the images from the paths the person gave;
never write a field the engine does not read (there is no `variant`).

## NN Work: Use the character
parent:: [[Author a Character]]
next:: [[Deliver the character proposal]]
step_type:: task
tool:: agent
produces:: `character:: <slug>` on the Series element (the host) or on a Scene (a guest), `pose::` and `background::` only where they differ from the defaults, and a `type:: avatar` Layer in each scene where the character speaks on screen (its required fields follow the bluepriNNt's Conditional Fields table)
scope:: internal
The character supplies the voice for the episode language, the pose and the avatar model through
the cascade. With a host character, leave `voice` and `avatar` out of every Preset. An
`avatar` Layer takes no `placement::`: `placement` is defined only for `media` Layers.

## NN Work: Deliver the character proposal
parent:: [[Author a Character]]
next:: [[Approve the character proposal]]
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` covering the catalog Voice entries and the `character` reference, plus one `produce_artifact` record with the sha256 of each created file
scope:: internal
Dry-apply it, then check one episode that uses the character with
`node scripts/produce.mjs <episode> --dry-run`: it reports the resolved voice, pose and avatar
image. The agent does not apply the changeset.

## NN Work: Approve the character proposal
parent:: [[Author a Character]]
step_type:: decision
tool:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
A character whose proposal is not applied is not used by any episode.
