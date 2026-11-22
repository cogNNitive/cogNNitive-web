---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Produce Video"
---

# NN Work

The entry point when a person asks for a video without naming the series or the scope. This
procedure is a router: it clarifies the goal, lists the series of the domaiNN through their
scope documents, reads the procedure the chosen series declares and hands the run off to it.
It never assumes or invents a parameter, writes no kNNowledge document and spends nothing:
every spend happens inside the procedure it hands off to, behind that procedure's own gates.
Each step declares exactly one tool: `agent`, `engine`, `console` or `human`.

## NN Work: Produce Video
slug:: produce-video
step_type:: task
level:: domaiNN
condition:: Set up the Domain is applied. A person asked for a video.
output:: @production-hand-off
scope:: internal
Ends in a started run of the procedure the chosen series declares, with its slots taken from
that series' scope document.

## NN Work: Clarify the goal
slug:: clarify-the-goal
parent:: @produce-video
next:: @list-the-series
step_type:: decision
tool:: human
decision:: a new episode in an existing series (the default), a new series, or producing an episode that already exists
scope:: internal
Offer the default first. A new series hands off to `Create a Series` in
`usage_procedures_NN.md` and this procedure ends there. An existing episode hands off to
`Produce an Episode` with that episode.

## NN Work: List the series
slug:: list-the-series
parent:: @produce-video
next:: @choose-the-series
step_type:: task
tool:: agent
produces:: the list of series of the domaiNN, one entry per scope document, each with its slug, `title` and `language`
scope:: internal
A series is found by its scope document: the one file under `series/<s>/` whose frontmatter
carries `scope: true`, canonically `<s>_coNNtent_NN.md`. Never list a series by its folder
name or by a file name alone: a folder without a scope document is not a series. Read the
series list from the documents every time; never from a list remembered from an earlier run.

## NN Work: Choose the series
slug:: choose-the-series
parent:: @produce-video
next:: @read-the-procedure-the-series-declares
step_type:: decision
tool:: human
decision:: the series the episode belongs to, from the listed series
scope:: internal
When the domaiNN has exactly one series, offer it as the default; the person still confirms it.

## NN Work: Read the procedure the series declares
slug:: read-the-procedure-the-series-declares
parent:: @produce-video
next:: @confirm-the-content-source
step_type:: task
tool:: agent
produces:: the id of the production procedure the series declares and the slot values its scope document fills
scope:: internal
Call `list_blueprint_procedures` with `path` set to the series folder: it lists every
procedure visible from there, nearest first, so a procedure the series ships under
`series/<s>/procedures/` shadows the bluepriNNt's procedure of the same id. The series
declares its production procedure either by shipping it there or by filling its slots under
`fills:` in its scope document (`fills: { <procedure-id>: { <slot>: <value> } }`). When the
series declares exactly one, that is the procedure. When it declares several, the person
picks one. When it declares none, offer the bluepriNNt's `draft-scene-visuals` as the default.

## NN Work: Confirm the content source
slug:: confirm-the-content-source
parent:: @produce-video
next:: @hand-off-to-the-declared-procedure
step_type:: decision
tool:: human
decision:: the story of the episode and its sources, already normalized in the domaiNN
scope:: internal
When the sources still have to be acquired, that work belongs to a procedure of the domaiNN
that acquires sources; run it first and come back with its normalized sources. This procedure
never fetches or selects sources itself.

## NN Work: Hand off to the declared procedure
slug:: hand-off-to-the-declared-procedure
parent:: @produce-video
step_type:: task
tool:: agent
produces:: a started run of the declared procedure, from `procedure_start` with its id and `path` set to the series folder
scope:: internal
`procedure_start` applies the scope document's fills and the slot defaults, and refuses a
missing required slot (`MISSING_REQUIRED_SLOT`) or an unknown procedure
(`PROCEDURE_NOT_FOUND`): on a refusal, ask the person for the missing value or the right
procedure and never invent one. From here the declared procedure owns the run, its reviews
and its spend gates; this router spends nothing.

# NN Artifact

## NN Artifact: Production Hand-off
slug:: production-hand-off
The started run of the procedure the chosen series declares, bound to that series' scope.
