---
level: 3
parent_spec:
  name: "procedures_V_0-5-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Using the coNNtent Blueprint"
---

# NN Work

Six procedures carry a person from an empty folder to a delivered episode: Set up the
Domain, Define a Frame, Define a Character, Create a Series, Plan an Episode and Produce
an Episode. Each step declares exactly one tool: `agent` (the AI agent, which reads and
proposes), `engine` (a script under `~/.agents/skills/nn-conntent/scripts/`), `console`
(the domaiNN console) or `human` (the person's decision). There is no Deliver procedure:
delivery is the automatic last stage of Produce an Episode.

A kNNowledge document changes only through a changeset. The four setup procedures are
conversational wizards: they ask one decision at a time, offer the default the current
domaiNN already implies, summarise before proposing, and end in a sealed `proposed`
changeset that a human approves. Library files that are not kNNowledge documents may be
written by the wizard, but they stay inert until an applied changeset references them.

Three companion procedures state how the wizards' decisions are written, field by field:
`create_series_procedures_NN.md` (Series document, Scene Kind grammar, Chrome, Presets),
`configure_cascade_procedures_NN.md` (setting a parameter at the domain, series or video
scope) and `create_character_procedures_NN.md` (the character folder, poses and voices).

## NN Work: Set up the Domain
step_type:: task
level:: domaiNN
condition:: A folder that will hold the domaiNN, the coNNtent bluepriNNt installed, and Node.js available. The folder has no legacy layout and does not already carry an applied setup.
output:: [[Domain Setup Changeset]]
scope:: internal
The wizard that adopts the bluepriNNt on a domaiNN: layout check, defaults, catalog,
voices, whisper, library and the managed gitignore block.

## NN Work: Confirm the domaiNN root
parent:: [[Set up the Domain]]
next:: [[Adopt the blueprint defaults]]
step_type:: task
tool:: agent
produces:: a folder-contract report: the confirmation, or one `legacy-layout` message per detected path
scope:: internal
Run the folder-contract check on the chosen root. Any legacy path (`series/<s>/assets/<slug>/`, a root or series `sounds/`, `components/` or `frames/`, `video-guard.json`, the old `video-ledger.jsonl`) stops setup: report every finding, name the new location each message gives, and propose a new folder instead of adapting the old one.

## NN Work: Adopt the blueprint defaults
parent:: [[Set up the Domain]]
next:: [[Choose the domaiNN defaults]]
step_type:: task
tool:: agent
produces:: `video-defaults_NN.md` at the domaiNN root, copied unchanged from the package `defaults/video-defaults_NN.md` when absent
scope:: internal
When the file already exists, leave it untouched; its values become the defaults the next step offers. The copy carries no `language` and no `budget`, so both are asked for.

## NN Work: Choose the domaiNN defaults
parent:: [[Set up the Domain]]
next:: [[Check the provider credentials]]
step_type:: decision
tool:: human
decision:: the `language`, `budget`, `daily_budget`, `review_gates`, models and `output_formats` of the domaiNN, answered one at a time
scope:: internal
For each item the agent offers the default derived from the current state of the domaiNN (for example `es` when the existing `video-defaults_NN.md` already sets `language: es`) and waits for the answer before asking the next question.

## NN Work: Check the provider credentials
parent:: [[Set up the Domain]]
next:: [[Review the catalog and its prices]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/ensure-hyperframes.mjs --check
scope:: internal
Verify the pinned HyperFrames CLI and GSAP and report the provider keys the bluepriNNt declares, naming any missing key. Nothing is installed and nothing is spent.

## NN Work: Review the catalog and its prices
parent:: [[Set up the Domain]]
next:: [[Register a voice per language]]
step_type:: task
tool:: agent
produces:: a catalog summary with every model, voice and price the domaiNN may use, each price with its source and date
scope:: internal
Read the merged catalog (`model-catalog_coNNtent_NN.md` over the package catalog). A model the person wants and the catalog lacks is proposed as a `Model` element; the agent never invents a price.

## NN Work: Register a voice per language
parent:: [[Set up the Domain]]
next:: [[Clone the chosen voices]]
step_type:: decision
tool:: human
decision:: the voice for each language the domaiNN will produce in — clone a sample, or pick an existing Voice whose `language` matches
scope:: internal
At least one voice per chosen language. A Voice whose `language` differs from the slot it is offered for is refused and another is asked for. The wizard does not move to the proposal until every chosen language has a voice, or the person records the choice to defer.

## NN Work: Clone the chosen voices
parent:: [[Set up the Domain]]
next:: [[Check whisper.cpp]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/voice-clone.mjs <name> <sample-audio> --language <code>
scope:: internal
Each clone writes a catalog Voice carrying its `language`. A re-clone of an existing name needs the explicit force flag, which the agent never assumes.

## NN Work: Check whisper.cpp
parent:: [[Set up the Domain]]
next:: [[Decide on the whisper install]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/ensure-hyperframes.mjs --check
scope:: internal
Report whisper as present or missing; it is an optional prerequisite. When it is missing and the chosen `captions` is not `off`, raise the install offer before the proposal.

## NN Work: Decide on the whisper install
parent:: [[Set up the Domain]]
next:: [[Create the library skeleton]]
step_type:: decision
tool:: human
decision:: accept the consent-gated whisper.cpp installation, or decline and keep the warning that a run with captions on will stop
scope:: internal
One prompt lists what will be installed and the approximate download size. Nothing installs silently and the engine never installs as a side effect of `produce`. Declining leaves setup valid, and `captions:: off` remains a valid choice.

## NN Work: Create the library skeleton
parent:: [[Set up the Domain]]
next:: [[Summarise and deliver the setup proposal]]
step_type:: task
tool:: agent
produces:: `library/` with its six kind folders (`music/`, `sounds/`, `frames/`, `components/`, `characters/`, `media/`) and the managed `.gitignore` block
scope:: internal
Append the managed block (`.cognnitive/cache/`, `.cognnitive/video/`, `hyperframes/`, the animatic) and verify that `library/` is not ignored.

## NN Work: Summarise and deliver the setup proposal
parent:: [[Set up the Domain]]
next:: [[Approve the setup proposal]]
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset`, plus its dry-apply result
scope:: internal
Summarise every decision before proposing. The changeset carries `add_model` for `domaiNN_NN.md` when the folder has none, the `update_field` changes on the adopted Video Defaults, one `add_element` per catalog Voice, and one `produce_artifact` record with the sha256 of every file the wizard created. Dry-apply it against the workspace: it must pass before the person is asked to approve. The agent does not apply it.

## NN Work: Approve the setup proposal
parent:: [[Set up the Domain]]
step_type:: decision
tool:: human
decision:: approve or reject the proposed changeset in the console (`Domain > Config`) or by replying OK
scope:: internal
Applying the changeset is the engine's step and regenerates the console. Only an applied change makes the new defaults, voices and references take effect; a library item no applied change references is not used for rendering.

## NN Work: Define a Frame
step_type:: task
level:: domaiNN or series
condition:: Set up the Domain is applied. Optional: a series that ships no frame of its own renders with the package `neutral` frame.
output:: [[Frame Folder]]
scope:: internal
The wizard that produces `library/frames/<name>/FRAME.md` at the domaiNN or the series level.

## NN Work: Choose the frame level and source
parent:: [[Define a Frame]]
next:: [[Build the frame]]
step_type:: decision
tool:: human
decision:: the level (domaiNN or series) and the starting point — one of the thirteen HyperFrames frame presets, `hyperframes capture <url>`, or scratch
scope:: internal
A series-level frame lives in `series/<s>/library/frames/`; a domaiNN-level frame serves every series.

## NN Work: Build the frame
parent:: [[Define a Frame]]
next:: [[Preview the frame]]
step_type:: task
tool:: agent
produces:: `library/frames/<name>/FRAME.md` with normative frontmatter (`colors`, `typography`, `spacing`, `components`) and its intent prose
scope:: internal
Start from the preset tokens, the captured tokens or scratch. Add `caption-skin.html` beside the frame when it styles captions, and a `fonts/` folder when its typography names fonts. A frame is truth for colour and type, never for layout.

## NN Work: Preview the frame
parent:: [[Define a Frame]]
next:: [[Deliver the frame proposal]]
step_type:: decision
tool:: human
decision:: accept the preview, tune the tokens, or try another starting point
scope:: internal
The agent renders a sample overlay from the frame tokens so the preview shows the type and accents in use, not a swatch list.

## NN Work: Deliver the frame proposal
parent:: [[Define a Frame]]
next:: [[Approve the frame proposal]]
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` that names the frame and, when it becomes the default, the `frame` field at the chosen level
scope:: internal
One `produce_artifact` record with the sha256 of every created file (the frame, the skin, each font). Dry-apply it. The agent does not apply it.

## NN Work: Approve the frame proposal
parent:: [[Define a Frame]]
step_type:: decision
tool:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
The frame is referenced by rendering only after the change is applied.

## NN Work: Define a Character
step_type:: task
level:: domaiNN or series
condition:: Set up the Domain is applied. The series may not exist yet.
output:: [[Character Folder]]
scope:: internal
The wizard that produces `library/characters/<name>/` and the catalog Voice entries it needs.

## NN Work: Choose the character name and level
parent:: [[Define a Character]]
next:: [[Choose a voice per language]]
step_type:: decision
tool:: human
decision:: the name and whether the character belongs to the domaiNN or to a series
scope:: internal
The name is the `character::` value every series and scene will use.

## NN Work: Choose a voice per language
parent:: [[Define a Character]]
next:: [[Clone the character voices]]
step_type:: decision
tool:: human
decision:: for each language the character speaks, clone a sample or select an existing Voice whose `language` matches
scope:: internal
A Voice of language `en` offered for an `es` slot is refused and another is asked for. There is no fallback voice: a character that cannot speak the episode language stops the draft before any narration.

## NN Work: Clone the character voices
parent:: [[Define a Character]]
next:: [[Choose the appearance defaults]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/voice-clone.mjs <name> <sample-audio> --language <code>
scope:: internal
Each clone writes a catalog Voice carrying its `language`. One voice at a time, with its own sample, so each Voice is traceable to its recording.

## NN Work: Choose the appearance defaults
parent:: [[Define a Character]]
next:: [[Build the character folder]]
step_type:: decision
tool:: human
decision:: `default_pose`, `avatar_model`, `avatar_resolution` and `default_background` for the character
scope:: internal
These are the values a scene inherits when it sets `character::` without `pose::` or `background::`.

## NN Work: Build the character folder
parent:: [[Define a Character]]
next:: [[Deliver the character proposal]]
step_type:: task
tool:: agent
produces:: `CHARACTER.md` (frontmatter `voices: {<lang>: <Voice slug>}`, `default_pose`, `avatar_model`, `avatar_resolution`, `default_background`) plus `avatars/`, `backgrounds/`, `voice/`, and the prose
scope:: internal
The prose states the speaking and narrative style, the things the character never says, and a few examples. Plan an Episode reads it before writing any narration.

## NN Work: Deliver the character proposal
parent:: [[Define a Character]]
next:: [[Approve the character proposal]]
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset` covering the catalog Voice entries and the `character` reference
scope:: internal
One `produce_artifact` record with the sha256 of each created file. Dry-apply it. The agent does not apply it.

## NN Work: Approve the character proposal
parent:: [[Define a Character]]
step_type:: decision
tool:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
A character whose proposal is not applied is not used by any episode.

## NN Work: Create a Series
step_type:: task
level:: series
condition:: Set up the Domain is applied. A frame and a character are optional (the package `neutral` frame and no character are valid).
output:: [[Series Document]]
scope:: internal
The wizard that produces `series/<s>/<s>_coNNtent_NN.md` (Kinds, Chrome, Presets, `review_gates`, budgets) and a dry-run test episode.

## NN Work: Choose the series identity and language
parent:: [[Create a Series]]
next:: [[Choose the host character and the frame]]
step_type:: decision
tool:: human
decision:: the series slug, its title and its `language`
scope:: internal
The language drives the Chrome lookup, the voice check and the whisper model.

## NN Work: Choose the host character and the frame
parent:: [[Create a Series]]
next:: [[Define the Scene Kinds]]
step_type:: decision
tool:: human
decision:: the `character::` host and the `frame::` of the series, or the package defaults
scope:: internal
A scene may later bring a guest character, but the series has one host.

## NN Work: Define the Scene Kinds
parent:: [[Create a Series]]
next:: [[Write the Chrome for each language]]
step_type:: decision
tool:: human
decision:: one Scene Kind at a time — its role, maximum duration, narration on or off, Chrome slots, presets and direct fields
scope:: internal
Every episode declares a Kind per scene, or the reserved `Libre`.

## NN Work: Write the Chrome for each language
parent:: [[Create a Series]]
next:: [[Define the Presets]]
step_type:: decision
tool:: human
decision:: the watermark, CTA, bumper and music for every language the series produces in
scope:: internal
A series whose language is `es` needs `es` Chrome; the dry run fails and names the missing Chrome when it does not exist.

## NN Work: Define the Presets
parent:: [[Create a Series]]
next:: [[Choose the gates and the budgets]]
step_type:: decision
tool:: human
decision:: the ordered Preset lists for the series, each level's fields, and any scene or video override
scope:: internal
When the series has a host character, do not set `voice` or `avatar` in a Preset: setting them raises `CHARACTER_OVERRIDDEN`, and the warning is shown before the proposal.

## NN Work: Choose the gates and the budgets
parent:: [[Create a Series]]
next:: [[Deliver the series proposal]]
step_type:: decision
tool:: human
decision:: `review_gates` (default `[script, preview]`, `[]` for autopilot) and `budget`/`daily_budget`
scope:: internal
An unset `budget` means the budget gate always asks; set it when the series has a spending envelope.

## NN Work: Deliver the series proposal
parent:: [[Create a Series]]
next:: [[Approve the series proposal]]
step_type:: task
tool:: agent
produces:: one sealed `proposed` changeset written with `writeProposedChangeset` holding the series document and the dry-run test episode document
scope:: internal
One `add_element` per Scene Kind, Chrome and Preset, and one `produce_artifact` per created file. Dry-apply it. The agent does not apply it.

## NN Work: Approve the series proposal
parent:: [[Create a Series]]
next:: [[Run the dry-run test episode]]
step_type:: decision
tool:: human
decision:: approve or reject the proposed changeset in the console (`Series > Config`) or by replying OK
scope:: internal
Applying the changeset is the engine's step; the series and its test episode exist before the dry run.

## NN Work: Run the dry-run test episode
parent:: [[Create a Series]]
next:: [[Keep or discard the test episode]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs <episode> --dry-run
scope:: internal
Validation and the persisted plan only: no synthesis, no render, no spend, no ledger record. It reports every resolved value with its source trace, the library names and the files they resolved to, the Chrome and the voice found for the series language, and the plan estimate. A missing item fails and is named, and the procedure does not complete while the dry run fails.

## NN Work: Keep or discard the test episode
parent:: [[Create a Series]]
step_type:: decision
tool:: human
decision:: keep the test episode as the series' first episode, or discard it
scope:: internal
Keeping makes it the first episode and leaves it at `idea` or `draft`, with no spend. Discarding removes it through an engine changeset and leaves the series with no episodes. This is the last step.

## NN Work: Plan an Episode
step_type:: task
level:: episode
condition:: A series exists. The episode is not sealed yet, or one scene was sent back with a reason.
output:: [[Sealed Scene Draft]]
scope:: internal
The procedure that turns an idea into a sealed scene draft, reading the active character's prose first.

## NN Work: State the idea
parent:: [[Plan an Episode]]
next:: [[Create the episode with its language]]
step_type:: decision
tool:: human
decision:: the episode idea in one or two sentences and, for a translation, its `language` and the original `translation_of`
scope:: internal
The idea names the subject and the angle; the series supplies the format.

## NN Work: Create the episode with its language
parent:: [[Plan an Episode]]
next:: [[Verify the translation prerequisites]]
step_type:: task
tool:: agent
produces:: the episode identity (`slug`, `title`, `description`) with `language` set and, for a translation, `translation_of` pointing at the original
scope:: internal
The episode is created at `series/<s>/episodes/<slug>/`. An existing episode is never overwritten by this step.

## NN Work: Verify the translation prerequisites
parent:: [[Plan an Episode]]
next:: [[Read the character prose]]
step_type:: task
tool:: agent
produces:: the confirmation, or a stop naming the missing Chrome or character voice
scope:: internal
Before any narration, a translation checks that the Chrome for its `language` exists and that the active character has a Voice for that language. A missing item stops the procedure and names it.

## NN Work: Read the character prose
parent:: [[Plan an Episode]]
next:: [[Draft the scenes]]
step_type:: task
tool:: agent
produces:: the speaking and narrative rules the narration must follow
scope:: internal
Read `CHARACTER.md` for the active character — the host set by the series, plus any guest the scene brings. Its prose (speaking and narrative style, things never said, examples) is binding: the narration never uses a phrase the prose forbids.

## NN Work: Draft the scenes
parent:: [[Plan an Episode]]
next:: [[Deliver the sealed scene draft]]
step_type:: task
tool:: agent
produces:: the scene draft: Scene Kinds, narration, layers and the Presets that apply
scope:: internal
Creative work only. The draft carries no `status`, `master`, `review::` or verdict; its content and the agent boundary are owned by `conntent-skill` "Draft Procedure Emits A Proposed Changeset".

## NN Work: Deliver the sealed scene draft
parent:: [[Plan an Episode]]
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset`, one `add_element` per Scene and Layer and an `evidence::` line per change
scope:: internal
Regeneration addresses the flagged scene only: a scene sent back with a reason is redrafted in its own proposal and the untouched scenes are not reopened.

## NN Work: Produce an Episode
step_type:: task
level:: episode
condition:: A sealed scene draft exists, or a content change re-opened an episode. The gates declared by `review_gates` are open.
output:: [[Delivered Episode]]
scope:: internal
The procedure that runs the pipeline through its gates to a delivered episode.

## NN Work: Run produce to the script gate
parent:: [[Produce an Episode]]
next:: [[Review the script]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs <episode>
scope:: internal
`produce` is the only engine command this procedure runs. It applies pending human changesets, validates, plans, and stops at the first open gate. Exit `0` done, `10` an unsatisfied gate, `11` a spend stop no verdict can satisfy, `12` `failed_qa`, `1` any other named error. It regenerates the console data at every exit.

## NN Work: Review the script
parent:: [[Produce an Episode]]
next:: [[Decide the script verdicts]]
step_type:: task
tool:: console
section:: Episode > Review
scope:: internal
Each scene in order with its Kind, narration, the estimate against `budget`, and a verdict control. A reason is a changeset comment on the scene, never a field.

## NN Work: Decide the script verdicts
parent:: [[Produce an Episode]]
next:: [[Run produce to the preview gate]]
step_type:: decision
tool:: human
decision:: `approved` or `needs-change` with a reason for every scene
scope:: internal
The verdict is a `review_gate` changeset carrying the scene's `reviewed_hash`. Approvals happen in the console or by replying OK, and never by the agent.

## NN Work: Run produce to the preview gate
parent:: [[Produce an Episode]]
next:: [[Review the animatic]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs <episode>
scope:: internal
`produce` synthesizes TTS and images in parallel, aligns captions, builds the animatic, and stops at the `preview` gate. No avatar call is made before it.

## NN Work: Review the animatic
parent:: [[Produce an Episode]]
next:: [[Approve the avatar spend]]
step_type:: task
tool:: console
section:: Episode > Review
scope:: internal
The low-resolution animatic with real audio and the scene stills. A scene whose `reviewed_hash` no longer matches is refused with "content changed since you reviewed it; reopen the console".

## NN Work: Approve the avatar spend
parent:: [[Produce an Episode]]
next:: [[Run produce to delivered]]
step_type:: decision
tool:: human
decision:: approve the `preview` gate (each scene slice hash) or the `budget` gate (`plan_hash`) that `produce` lists
scope:: internal
With `preview` on, the preview approval authorizes the avatar spend and no second approval is asked. A `budget` gate appears only when the plan exceeds `budget`.

## NN Work: Run produce to delivered
parent:: [[Produce an Episode]]
next:: [[Read the result]]
step_type:: task
tool:: engine
command:: ~/.agents/skills/nn-conntent/scripts/produce.mjs <episode>
scope:: internal
`produce` synthesizes the avatars, compiles, links assets, renders, runs QA on the master and on the output set, derives the formats and thumbnails, writes the description, delivers under `deliveries/v<N>/`, and sets `status:: delivered`. Delivery is automatic once QA passes and is the final outcome of this run, not a step of its own.

## NN Work: Read the result
parent:: [[Produce an Episode]]
step_type:: task
tool:: console
section:: Episode > Status
scope:: internal
The lifecycle position, the QA result and the delivery version. When QA fails the episode is `failed_qa` (exit 12) and no delivery is assembled: read the failing checkpoint here, fix it, and run `produce` again. When a delivered episode changes, the first changed gate re-opens for the affected scenes and `produce` stops there again.

A gate absent from `review_gates` is skipped, and the stages around it still run in order.
With `review_gates:: []` and a plan within `budget`, the run reaches `delivered` with no human step. Every gate approval is a human `review_gate` changeset: the agent never approves and never invents a hash.
