---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-32-6"
title: "Plan an Episode"
---

# NN Procedure

## NN Procedure: Plan an Episode
slug:: plan-an-episode
summary:: The procedure that turns an idea into a sealed scene draft, reading the active character's prose first.
level:: episode
outputs_expected:: @sealed-scene-draft
It starts when: A series exists. The episode is not sealed yet, or one scene was sent back with a reason.

### NN Work: State the idea
slug:: state-the-idea
next:: @create-the-episode-with-its-language
step_type:: decision
executor:: human
decision:: the episode idea in one or two sentences and, for a translation, its `language` and the original `translation_of`
scope:: internal
The idea names the subject and the angle; the series supplies the format.

### NN Work: Create the episode with its language
slug:: create-the-episode-with-its-language
next:: @verify-the-translation-prerequisites
step_type:: task
executor:: agent
produces:: the episode identity (`slug`, `title`, `description`) with `language` set and, for a translation, `translation_of` pointing at the original
scope:: internal
The episode is created at `series/<s>/episodes/<slug>/`. An existing episode is never overwritten by this step.

### NN Work: Verify the translation prerequisites
slug:: verify-the-translation-prerequisites
next:: @read-the-character-prose
step_type:: task
executor:: agent
produces:: the confirmation, or a stop naming the missing Chrome or character voice
scope:: internal
Before any narration, a translation checks that the Chrome for its `language` exists and that the active character has a Voice for that language. A missing item stops the procedure and names it.

### NN Work: Read the character prose
slug:: read-the-character-prose
next:: @draft-the-scenes
step_type:: task
executor:: agent
produces:: the speaking and narrative rules the narration must follow
scope:: internal
Read `CHARACTER.md` for the active character — the host set by the series, plus any guest the scene brings. Its prose (speaking and narrative style, things never said, examples) is binding: the narration never uses a phrase the prose forbids.

### NN Work: Draft the scenes
slug:: draft-the-scenes
next:: @deliver-the-sealed-scene-draft
step_type:: task
executor:: agent
produces:: the scene draft: Scene Kinds, narration, layers and the Presets that apply
scope:: internal
Creative work only. The draft carries no `status`, `review::` or verdict; its content and the agent boundary are owned by `conntent-skill` "Draft Procedure Emits A Proposed Changeset".

### NN Work: Deliver the sealed scene draft
slug:: deliver-the-sealed-scene-draft
step_type:: task
executor:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset`, one `add_element` per Scene and Layer and an `evidence::` line per change
scope:: internal
Regeneration addresses the flagged scene only: a scene sent back with a reason is redrafted in its own proposal and the untouched scenes are not reopened.

# NN Artifact

## NN Artifact: Sealed Scene Draft
slug:: sealed-scene-draft
