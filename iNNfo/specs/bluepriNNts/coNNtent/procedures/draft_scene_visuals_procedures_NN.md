---
level: 3
parent_spec:
  name: "procedures_V_0-6-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-2-0"
blueprint_version: "V_0-32-6"
title: "Draft Scene Visuals"
slots:
  - { name: series_profile, kind: value, required: false, step: split-the-story-into-single-visual-scenes, default: "Keep the structure and style the series document declares: its Scene Kinds, its fixed scenes and its premise." }
  - { name: presenter_recipe, kind: value, required: false, step: prepare-the-presenter-image, default: "Use the portrait of the active character, the same image for every presenter scene." }
---

# NN Work

A generic procedure that turns one chosen story into an episode of single-visual scenes,
drafted on real material only. Every scene is either a presenter scene (the presenter
speaking full screen) or a full-screen visual scene: a screenshot, an image with a discreet
animation, or a HyperFrames clip, always with the narration behind it. A visual is never laid
over the presenter. The visual material is captured and rendered first, and a media gate
stops the draft until every file exists, so the review is about material that already exists
and never about promises. A series adopts this procedure by filling its slots in the `fills:`
of its scope document, or replaces it by shipping its own `draft-scene-visuals` under
`series/<s>/procedures/`. Each step declares exactly one tool: `agent`, `engine`, `console`
or `human`.

## NN Work: Draft Scene Visuals
slug:: draft-scene-visuals
step_type:: task
level:: episode
condition:: A series exists and the episode exists at `series/<s>/episodes/<slug>/` with its `language`. The story is chosen and its sources are normalized in the domaiNN.
output:: @scene-visuals-draft
scope:: internal
Produces a sealed scene draft whose every visual scene points at a file that already exists
in the episode's `media/` folder. Producing the episode afterwards is the `Produce an
Episode` procedure of `usage_procedures_NN.md`.

## NN Work: Split the story into single-visual scenes
slug:: split-the-story-into-single-visual-scenes
parent:: @draft-scene-visuals
next:: @capture-the-clean-screenshots
step_type:: task
tool:: agent
produces:: the scene list: for each scene its Scene Kind, its narration, whether it is a presenter scene or a visual scene, and the visual subject of every visual scene
scope:: internal
One idea is one scene. A scene is entirely a presenter scene or entirely a visual scene: it
never lays a visual over the presenter. Every presenter scene and every visual scene carries
the narration behind it; a fixed scene the series declares carries none. {{slot:series_profile}}
Read the active character's `CHARACTER.md` prose before writing narration: it is binding.

## NN Work: Capture the clean screenshots
slug:: capture-the-clean-screenshots
parent:: @draft-scene-visuals
next:: @render-the-hyperframes-clips
step_type:: task
tool:: agent
produces:: one clean screenshot per visual scene that shows a source, saved in the episode's `media/` folder under a snake_case role name
scope:: internal
The visual material of a story is always a screenshot of the original page of its source,
never a generated image. A screenshot is clean when the cookie consent is accepted and no
banner, pop-up or overlay covers the content. A screenshot that already exists is reused as it
is and is not captured again.

## NN Work: Render the HyperFrames clips
slug:: render-the-hyperframes-clips
parent:: @draft-scene-visuals
next:: @prepare-the-presenter-image
step_type:: task
tool:: agent
produces:: one rendered HyperFrames clip per visual scene that needs an animation, in the episode's `media/` folder, with its project under `series/<s>/episodes/<slug>/animations/<project>/`
scope:: internal
A visual scene that needs an animation gets a HyperFrames project and is rendered to a clip
in the canvas of the primary output format. An image without an animation of its own gets a
discreet animation chosen deterministically from the scene slug. A clip that already exists is
reused as it is and is not rendered again, so it costs nothing.

## NN Work: Prepare the presenter image
slug:: prepare-the-presenter-image
parent:: @draft-scene-visuals
next:: @check-the-media-gate
step_type:: task
tool:: agent
produces:: the presenter image every presenter scene of the episode uses, in the episode's `media/` folder
scope:: internal
The presenter image is fixed before the draft so the review shows it with the rest of the
material. {{slot:presenter_recipe}} When the series has a host character, its character
folder supplies the portrait and no new image is made.

## NN Work: Check the media gate
slug:: check-the-media-gate
parent:: @draft-scene-visuals
next:: @draft-the-scenes
step_type:: task
tool:: agent
produces:: the confirmation that every visual scene and the presenter have their file in `media/`, or a stop that names each missing file and its scene
scope:: internal
The pre-draft gate. Before the agent writes the draft (the scene draft below, or the
draft JSON and its `build-draft-html.mjs` view in a domaiNN that still drafts that way), the
clean screenshots and the rendered HyperFrames clips of every visual scene must exist in the
episode's media folder: `series/<s>/episodes/<slug>/media/` in the coNNtent folder contract,
`assets/<slug>/media/` in a domaiNN still on the older layout. A missing file stops the
procedure here and names the file and its scene; go back to the capture or render step for
it. No draft is written while a file is missing, and nothing is spent by this check.

## NN Work: Draft the scenes
slug:: draft-the-scenes
parent:: @draft-scene-visuals
next:: @attribute-the-third-party-material
step_type:: task
tool:: agent
produces:: the scene draft: Scene Kinds, narration, and the layers of each scene, every visual layer naming an existing file of `media/` as its `asset::`
scope:: internal
A presenter scene carries the presenter layer and its overlays. A visual scene carries one
full-screen media layer pointing at the screenshot or clip the gate confirmed, and no
presenter. The narration body of every scene is clean prose: no `key:: value` line and no
heading inside it, because the voice would read it aloud. The draft carries no `status`,
`review::` or verdict.

## NN Work: Attribute the third-party material
slug:: attribute-the-third-party-material
parent:: @draft-scene-visuals
next:: @deliver-the-sealed-draft
step_type:: task
tool:: agent
produces:: a source lower-third on every scene that shows third-party material, and the attribution section of the episode's `description.md` with each source's author, date and permanent link
scope:: internal
Third-party material (an article screenshot, a chart, a press clip) is never published
without visible credit and a link. Without third-party material this step changes nothing.

## NN Work: Deliver the sealed draft
slug:: deliver-the-sealed-draft
parent:: @draft-scene-visuals
next:: @approve-the-draft
step_type:: task
tool:: agent
produces:: a sealed `proposed` changeset written with `writeProposedChangeset`, one `add_element` per Scene and Layer and an `evidence::` line per change
scope:: internal
Regeneration addresses the flagged scene only: a scene sent back with a reason is redrafted in
its own proposal (`Redraft the flagged scene`) and the untouched scenes are not reopened.

## NN Work: Approve the draft
slug:: approve-the-draft
parent:: @draft-scene-visuals
next:: [@hand-off-to-produce-an-episode, @redraft-the-flagged-scene]
step_type:: decision
tool:: human
decision:: approve the proposed changeset (approve), or send one scene back with a reason (send-back)
scope:: internal
The review is about real material: every screenshot, clip and the presenter image already
exist. The agent never approves and never applies the changeset. Approving applies it; a
scene sent back returns here once it is redrafted, and the runner bounds how many times the
draft is reviewed.

## NN Work: Hand off to Produce an Episode
slug:: hand-off-to-produce-an-episode
parent:: @draft-scene-visuals
step_type:: task
condition:: outcome == approve
tool:: agent
produces:: a started run of `Produce an Episode`, the procedure of that name in `usage_procedures_NN.md`, for this episode
scope:: internal
The approved changeset is applied, so the episode continues with `Produce an Episode`, where
the spend gates stay human. This procedure ends here.

## NN Work: Redraft the flagged scene
slug:: redraft-the-flagged-scene
parent:: @draft-scene-visuals
next:: @approve-the-draft
step_type:: task
condition:: outcome == send-back
tool:: agent
produces:: a sealed `proposed` changeset that redrafts only the scene sent back, following its reason, with an `evidence::` line per change
scope:: internal
Only the flagged scene is redrafted, on the material already in `media/`; the untouched
scenes are not reopened. A scene that needs new material goes through the capture or render
step for it before it is redrafted. The new proposal goes back to the approval.

# NN Artifact

## NN Artifact: Scene Visuals Draft
slug:: scene-visuals-draft
The sealed `proposed` changeset of the episode's scenes, each visual scene pointing at an
existing screenshot or clip in `media/`, approved by a human.
