---
level: 3
parent_spec:
  name: "procedures_V_0-5-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Create a Series"
---

# NN Work

The field-level authoring guide for a coNNtent Series document. The `Create a Series`
wizard in `usage_procedures_NN.md` decides what the series is; this procedure states how
each decision is written so the document validates against the coNNtent bluepriNNt. Every
field named here is a Field Definition of the bluepriNNt: never write a field the bluepriNNt
does not define. Each step declares exactly one tool: `agent`, `engine`, `console` or
`human`. Engine commands are relative to the installed `nn-conntent` skill folder
(`skills/nn-conntent/` in the coNNtent bluepriNNt package).

## NN Work: Author a Series
step_type:: task
level:: series
condition:: Set up the Domain is applied. The series slug is new in the domaiNN.
output:: [[Series Document]]
scope:: internal
Produces the Series anchor `series/<s>/<s>_coNNtent_NN.md` with its premise, its folders,
its Scene Kinds, its Chrome per language and its Presets, proven by the engine's
pre-compile guard on a test episode.

## NN Work: State the premise
parent:: [[Author a Series]]
next:: [[Create the series folders]]
step_type:: decision
tool:: human
decision:: the series slug, its `title`, its `language`, and its premise in two or three sentences (subject, audience, tone)
scope:: internal
The premise is prose in the Series element body; it guides every episode the agent drafts.
The slug is kebab-case and unique in the domaiNN: it names the folder and the anchor file.

## NN Work: Create the series folders
parent:: [[Author a Series]]
next:: [[Write the Series element]]
step_type:: task
tool:: agent
produces:: `series/<s>/` holding `episodes/` (one folder per episode, `series/<s>/episodes/<slug>/`) and `library/` (shared series media such as the bumper, the music bed and logos, under `library/<kind>/`)
scope:: internal
Episodes never live under `series/<s>/assets/`: that layout is legacy and the folder-contract
check rejects it. Chrome media resolve as logical names under `series/<s>/library/media/`.

## NN Work: Write the Series element
parent:: [[Author a Series]]
next:: [[Declare the Scene Kinds]]
step_type:: task
tool:: agent
produces:: the anchor `series/<s>/<s>_coNNtent_NN.md` with frontmatter `level: 3`, `scope: true` and `title`, and one `## NN Series: <title>` element carrying `slug::`, `title::`, `language::` and any series-level cascade field (`character`, `frame`, `presets`, `voice`, `budget`, `output_formats`, `review_gates`, `captions`)
scope:: internal
The engine recognises the anchor by `scope: true`, never by file name, and a series folder
holds at most one. Legacy names (`series_NN.md`, `<s>_scope_NN.md`) anchor nothing. When the
series has a host character, set `character::` here and leave `voice` and `avatar` out of
every Preset.

## NN Work: Declare the Scene Kinds
parent:: [[Author a Series]]
next:: [[Write the Chrome for each language]]
step_type:: task
tool:: agent
produces:: one `## NN Scene Kind: <name>` element per kind, each with `slug::`, `role::`, `narration::` (`on` or `off`), `max_duration::`, `fixed::`, `chrome::` and `presets::`
scope:: internal
The grammar of a kind, field by field. `fixed` is `none`, `first`, `last` or `after:<kind>`
(after the first scene of that kind). When `fixed` is not `none`, `asset::` is required: it is
the media the engine inserts, and the episode never declares that scene. `chrome` lists any of
`watermark`, `cta`, `bumper`, `music`. `presets` is the kind's only cascade contribution: a kind
carries no other cascade parameter. With `narration:: on` the narration sets the scene length;
with `narration:: off` the body must be empty and the scene takes its length from its media or
animation. Declare every kind the series uses here: an episode never invents a kind, and the
reserved `Libre` (which takes no chrome, so no watermark) is the only escape hatch.

## NN Work: Write the Chrome for each language
parent:: [[Author a Series]]
next:: [[Define the series Presets]]
step_type:: task
tool:: agent
produces:: one `## NN Chrome: <language>` element per language the series publishes in, each with `slug::`, `language::` and the `watermark::`, `cta::`, `bumper::` and `music::` items the kinds list
scope:: internal
When a kind lists a chrome item that the Chrome element for the resolved language does not
declare, the run fails before spend and names the item and the language.

## NN Work: Define the series Presets
parent:: [[Author a Series]]
next:: [[Validate with the pre-compile guard]]
step_type:: task
tool:: agent
produces:: zero or more `## NN Preset: <name>` elements after the Series section, each carrying only fields whose `concept::` lists `Preset` (for example `voice_model`, `transition`, `frame`, `fit`, `components`, `sounds`, `background_audio`)
scope:: internal
A Preset has no fields of its own and owns no Layers. Reference it by bare name in an ordered
list (`presets:: [Studio Warm]`); the last Preset of a list wins and an element's explicit
fields beat its own Presets.

## NN Work: Validate with the pre-compile guard
parent:: [[Author a Series]]
next:: [[Fix the reported findings]]
step_type:: task
tool:: engine
command:: node scripts/produce.mjs series/<s>/episodes/<test-episode>/<test-episode>_coNNtent_NN.md --dry-run
scope:: internal
The engine's pre-compile guard is the series validator: it resolves the cascade, checks every
kind, Chrome and Preset the test episode uses, and reports the plan estimate. No synthesis,
render, spend or ledger record happens. Preflight does not validate a series grammar, so a green
preflight is not proof.

## NN Work: Fix the reported findings
parent:: [[Author a Series]]
step_type:: decision
tool:: human
decision:: accept the series once the dry run passes, or change the kind, Chrome or Preset each finding names and run the dry run again
scope:: internal
The procedure does not complete while the dry run fails. Accepted changes reach the domaiNN
through a sealed `proposed` changeset that a human approves, as in the `Create a Series` wizard.
