---
level: 3
parent_spec:
  name: "procedures_V_0-8-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
blueprint_version: "V_0-32-6"
title: "Produce Video"
---


The entry point when a person asks for a video without naming the series or the scope. This
procedure is a router: it clarifies the goal, lists the series of the domaiNN through their
scope documents, reads the procedure the chosen series declares and hands the run off to it.
It never assumes or invents a parameter, writes no kNNowledge document and spends nothing:
every spend happens inside the procedure it hands off to, behind that procedure's own gates.
Each step declares its `executor`: `agent`, `engine` or `human` (a person deciding, or acting in the console section the step names).

# NN Procedure

## NN Procedure: Produce Video
slug:: produce-video
summary:: Ends in a started run of the procedure the chosen series declares, with its slots taken from that series' scope document.
outputs_expected:: @production-hand-off
level:: domaiNN

It starts when: Set up the Domain is applied. A person asked for a video.

### NN Work: Clarify the goal
slug:: clarify-the-goal
next:: [@list-the-series, @hand-off-to-create-a-series, @hand-off-to-produce-an-episode]
step_type:: decision
executor:: human
decision:: a new episode in an existing series (new-episode, the default), a new series (new-series), or producing an episode that already exists (existing-episode)
scope:: internal
Offer the default first. A new series hands off to `Create a Series` in
`usage_procedures_NN.md` and this procedure ends there. An existing episode hands off to
`Produce an Episode` with that episode.

### NN Work: List the series
slug:: list-the-series
next:: @choose-the-series
step_type:: task
condition:: outcome == new-episode
executor:: agent
produces:: the list of series of the domaiNN, one entry per scope document, each with its slug, `title` and `language`
scope:: internal
A series is found by its scope document: the one file under `series/<s>/` whose frontmatter
carries `scope: true`, canonically `<s>_coNNtent_NN.md`. Never list a series by its folder
name or by a file name alone: a folder without a scope document is not a series. Read the
series list from the documents every time; never from a list remembered from an earlier run.

### NN Work: Choose the series
slug:: choose-the-series
next:: @read-the-procedure-the-series-declares
step_type:: decision
executor:: human
decision:: the series the episode belongs to, from the listed series
scope:: internal
When the domaiNN has exactly one series, offer it as the default; the person still confirms it.

### NN Work: Read the procedure the series declares
slug:: read-the-procedure-the-series-declares
next:: @confirm-the-content-source
step_type:: task
executor:: agent
produces:: the id of the production procedure the series declares and the slot values its scope document fills
scope:: internal
Call `list_blueprint_procedures` with `path` set to the series folder: it lists every
procedure visible from there, nearest first, so a procedure the series ships under
`series/<s>/procedures/` shadows the bluepriNNt's procedure of the same id. The series
declares its production procedure either by shipping it there or by filling its slots under
`fills:` in its scope document (`fills: { <procedure-id>: { <slot>: <value> } }`). When the
series declares exactly one, that is the procedure. When it declares several, the person
picks one. When it declares none, offer the bluepriNNt's `draft-scene-visuals` as the default.

### NN Work: Confirm the content source
slug:: confirm-the-content-source
next:: @hand-off-to-the-declared-procedure
step_type:: decision
executor:: human
decision:: the story of the episode and its sources, already normalized in the domaiNN
scope:: internal
When the sources still have to be acquired, that work belongs to a procedure of the domaiNN
that acquires sources; run it first and come back with its normalized sources. This procedure
never fetches or selects sources itself.

### NN Work: Hand off to the declared procedure
slug:: hand-off-to-the-declared-procedure
step_type:: task
executor:: agent
produces:: a started run of the declared procedure, from `procedure_start` with its id and `path` set to the series folder
scope:: internal
`procedure_start` applies the scope document's fills and the slot defaults, and refuses a
missing required slot (`MISSING_REQUIRED_SLOT`) or an unknown procedure
(`PROCEDURE_NOT_FOUND`): on a refusal, ask the person for the missing value or the right
procedure and never invent one. From here the declared procedure owns the run, its reviews
and its spend gates; this router spends nothing.

### NN Work: Hand off to Create a Series
slug:: hand-off-to-create-a-series
step_type:: task
condition:: outcome == new-series
executor:: agent
produces:: a started run of `Create a Series`, the procedure of that name in `usage_procedures_NN.md`
scope:: internal
A new series is authored before any of its episodes: this procedure ends here, and the
`Create a Series` wizard decides what the series is. Ask for the next episode once it is applied.

### NN Work: Hand off to Produce an Episode
slug:: hand-off-to-produce-an-episode
step_type:: task
condition:: outcome == existing-episode
executor:: agent
produces:: a started run of `Produce an Episode`, the procedure of that name in `usage_procedures_NN.md`, with that episode as its `episode` slot
scope:: internal
The episode already exists, so there is no series to choose and no content to confirm: ask the
person which episode, by its folder, and never invent one. This procedure ends here.

# NN Artifact

## NN Artifact: Production Hand-off
slug:: production-hand-off
The started run of the procedure the chosen series declares, bound to that series' scope.
