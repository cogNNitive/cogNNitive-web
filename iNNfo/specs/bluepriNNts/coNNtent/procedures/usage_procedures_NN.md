---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-4-0"
blueprint_version: "V_0-32-6"
title: "Using the coNNtent Blueprint"
---

# NN Procedure

## NN Procedure: Using the coNNtent Blueprint
slug:: using-the-conntent-blueprint
summary:: Walks a person from an empty folder to a delivered episode through six procedures, each run on its own.
Six procedures carry a person from an empty folder to a delivered episode: Set up the
Domain, Define a Frame, Define a Character, Create a Series, Plan an Episode and Produce
an Episode. Each is its own procedure document, and each step of this guide calls one of
them. In those documents every step declares its `executor`: `agent` (the AI agent, which
reads, proposes, and runs a skill script once per value the run itself decided), `engine` (a
script under `~/.agents/skills/nn-conntent/scripts/`) or `human` (the person's decision, or
the person acting in the domaiNN console section the step names). There is no Deliver
procedure: delivery is the automatic last stage of Produce an Episode.

A kNNowledge document changes only through a changeset. The four setup procedures are
conversational wizards: they ask one decision at a time, offer the default the current
domaiNN already implies, summarise before proposing, and end in a sealed `proposed`
changeset that a human approves. Library files that are not kNNowledge documents may be
written by the wizard, but they stay inert until an applied changeset references them.

Three companion procedures state how the wizards' decisions are written, field by field:
`create_series_procedures_NN.md` (Series document, Scene Kind grammar, Chrome, Presets),
`configure_cascade_procedures_NN.md` (setting a parameter at the domain, series or video
scope) and `create_character_procedures_NN.md` (the character folder, poses and voices).
Two more are generic production procedures a series may adopt: `produce_video_procedures_NN.md`
(the router for a video request that names no series) and `draft_scene_visuals_procedures_NN.md`
(single-visual scenes drafted on real material, behind a media gate).

### NN Work: Set up the Domain
slug:: run-set-up-the-domain
call:: set_up_the_domain_procedures_NN.md
next:: @run-define-a-frame
Run Set up the Domain on its own procedure document; this guide only orders the six.

### NN Work: Define a Frame
slug:: run-define-a-frame
call:: define_a_frame_procedures_NN.md
next:: @run-define-a-character
Run Define a Frame on its own procedure document; this guide only orders the six.

### NN Work: Define a Character
slug:: run-define-a-character
call:: define_a_character_procedures_NN.md
next:: @run-create-a-series
Run Define a Character on its own procedure document; this guide only orders the six.

### NN Work: Create a Series
slug:: run-create-a-series
call:: create_a_series_procedures_NN.md
next:: @run-plan-an-episode
Run Create a Series on its own procedure document; this guide only orders the six.

### NN Work: Plan an Episode
slug:: run-plan-an-episode
call:: plan_an_episode_procedures_NN.md
next:: @run-produce-an-episode
Run Plan an Episode on its own procedure document; this guide only orders the six.

### NN Work: Produce an Episode
slug:: run-produce-an-episode
call:: produce_an_episode_procedures_NN.md
Run Produce an Episode on its own procedure document; this guide only orders the six.
