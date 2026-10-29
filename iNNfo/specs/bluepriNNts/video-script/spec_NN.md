---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-5-0_NN.md"
blueprint_name: "video-script"
blueprint_version: "V_0-13-9"
title: "Video Script App"
relationship_types:
  hierarchy:
    enabled: true
    via: "index block"
  evaluable_matrix:
    enabled: false
  graph_edge:
    enabled: false
  sequence:
    enabled: false
validation:
  conditional_fields:
    presenter: [asset, prompt]
    background: [asset, prompt]
    b-roll: [asset, prompt]
    title: [text]
    lower-third: [text]
    quote: [text]
    caption: [text]
    brand: [asset]
    watermark: [text]
    animation: [asset]
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]
* [[Series]]
* [[Video Defaults]]
* [[Template]]

# NN Concept Definition

## NN Concept Definition: Video
slug:: video
icon:: clapperboard
type:: list
color:: blue
weight:: 100

## NN Concept Definition: Scene
slug:: scene
icon:: film
type:: list
color:: purple
weight:: 90

## NN Concept Definition: Layer
slug:: layer
icon:: layers
type:: list
color:: orange
weight:: 80

## NN Concept Definition: Template
slug:: template
icon:: file-cog
type:: list
color:: green
weight:: 70

## NN Concept Definition: Series
slug:: series
icon:: layers
type:: list
color:: teal
weight:: 60

## NN Concept Definition: Video Defaults
slug:: video-defaults
icon:: sliders-horizontal
type:: list
color:: gray
weight:: 50

# NN Field Definition

## NN Field Definition: tags
concept:: *
type:: select
multiple:: true
description:: Open vocabulary ad-hoc tags and classification labels.

## NN Field Definition: title
concept:: [Video, Series]
type:: string
description:: Human title of the Video or the Series. The engine derives the manifest compositionId from the Video's title.

<!-- Video record: the episode's catalogue and delivery. One L3 document of this blueprint is
     both the episode's record and its script. `slug` is the reserved identity, not declared here. -->

## NN Field Definition: description
concept:: Video
type:: markdown_inline
description:: What the episode is about, in one or two sentences.

## NN Field Definition: status
concept:: Video
type:: select
options:: [draft, scripting, rendering, published, archived]
description:: Lifecycle position of the episode.

## NN Field Definition: script
concept:: Video
type:: file
description:: The episode's script document, resolved under the owning model's directory.

## NN Field Definition: master
concept:: Video
type:: video
description:: The episode's rendered master, resolved under the owning model's directory. The vertical and horizontal variants are derived from it by the render-formats naming convention and MUST NOT be modelled as fields.

## NN Field Definition: thumbnail
concept:: Video
type:: image
description:: The episode's cover image, resolved under the owning model's directory.

## NN Field Definition: voice_id
concept:: Video
type:: string
description:: Identifier of the voice that narrates the episode.

## NN Field Definition: template
concept:: [Video, Scene, Series, Video Defaults]
type:: reference
target_concepts:: [Template]
description:: Reference to a Template instance (tool, voice, tts_model) shipped by the Series' L3 Template-data document, e.g. [[My Series :: Presenter Full]]. Settable at Video, Scene, Series and Video Defaults; the most specific level that sets it wins (see the Universal Parameter Cascade). Optional.

## NN Field Definition: music
concept:: [Scene, Series, Video Defaults]
type:: file
description:: Scene-level background music file. Music is a Scene field and MUST NOT be modeled as a Layer.

## NN Field Definition: music_volume
concept:: [Scene, Series, Video Defaults]
type:: string
description:: Background-music volume for the resolved `music::` track (a number 0–1, e.g. `0.1`). Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: transition
concept:: [Scene, Series, Video Defaults]
type:: select
options:: [fade, slide-left, slide-right, wipe, none]
description:: Transition into the Scene. Resolves through the Universal Parameter Cascade. Optional.

## NN Field Definition: frame
concept:: [Video, Scene, Series, Video Defaults]
type:: string
description:: Name of the frame document (`frames/<name>.md`) whose tokens style this Video, Scene, Series or domain. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: components
concept:: [Video, Series, Video Defaults]
type:: select
multiple:: true
description:: Keyed list of slot→component-name bindings (`slot=name`, e.g. `[lower-third=pill]`). Resolves per key through the Universal Parameter Cascade. Engine code names no component.

## NN Field Definition: sounds
concept:: [Video, Series, Video Defaults]
type:: select
multiple:: true
description:: Keyed list of engine-event→sound-name bindings (`event=name`, e.g. `[scene-boundary=whoosh]`). Resolves per key through the Universal Parameter Cascade. Engine code names no sound.

## NN Field Definition: presenter_asset
concept:: Series
type:: file
description:: Series-level presenter asset reused by its videos. Optional; Series-only, never cascaded.

## NN Field Definition: intro_asset
concept:: Series
type:: file
description:: Series-level intro asset reused by its videos. Optional; Series-only, never cascaded.

## NN Field Definition: type
concept:: Layer
type:: select
options:: [presenter, background, b-roll, title, lower-third, caption, brand, quote, watermark, animation]
description:: Required Layer discriminator. Allowed fields are conditional on this value. `watermark` renders a small persistent text notice (e.g. an AI-disclosure line). `animation` mounts an authored HyperFrames project as a sub-composition.

## NN Field Definition: asset
concept:: Layer
type:: file
description:: Source media file for a Layer (image or video), or the directory of an authored HyperFrames project for an `animation` Layer. Required for presenter, background, brand, b-roll, and animation.

## NN Field Definition: prompt
concept:: Layer
type:: string
description:: Media-synthesis prompt used when a Layer has no asset. Used by presenter, background, and b-roll.

## NN Field Definition: text
concept:: Layer
type:: markdown_inline
description:: Inline text for a Layer. Required for title, lower-third, quote, and caption.

## NN Field Definition: position
concept:: Layer
type:: select
options:: [top, center, bottom, bottom-left, bottom-right]
description:: Anchor position of the Layer. Optional.

## NN Field Definition: enter_animation
concept:: Layer
type:: string
description:: Enter motion of the Layer overlay. Optional.

## NN Field Definition: exit_animation
concept:: Layer
type:: string
description:: Exit motion of the Layer overlay. Optional.

## NN Field Definition: level
concept:: Layer
type:: string
description:: Paint order of the Layer as a numeric string (higher renders on top). Optional.

## NN Field Definition: avatar_model
concept:: [Layer, Series, Video Defaults]
type:: string
description:: Avatar/lip-sync model id for a `presenter` Layer, or a series/domain default (e.g. `wavespeed-ai/infinitetalk-fast`). Resolves through the Universal Parameter Cascade.

## NN Field Definition: avatar_resolution
concept:: Layer
type:: select
options:: [480p, 720p, 768p]
description:: Optional output resolution for a `presenter` avatar clip. The engine validates it against the model (Pruna accepts 480p/768p; InfiniTalk also 720p) and falls back to a model-appropriate default. Ignored by other Layer types.

## NN Field Definition: fit
concept:: [Layer, Series, Video Defaults]
type:: select
options:: [cover, contain]
description:: How a media Layer (background, b-roll) fits its box. `cover` fills and crops; `contain` shows the whole asset with margins. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: tool
concept:: Template
type:: select
options:: [wavespeed, replicate]
description:: Media provider used to synthesize the assets bound to this Template.

## NN Field Definition: voice
concept:: [Template, Series, Video Defaults]
type:: string
description:: Registered voice name or system voice used for TTS synthesis. Resolves through the Universal Parameter Cascade.

## NN Field Definition: tts_model
concept:: [Template, Series, Video Defaults]
type:: string
description:: Provider model id used for TTS synthesis (e.g. `minimax/speech-2.8-hd`). Resolves through the Universal Parameter Cascade. Part of the synthesized-audio cache identity.

## NN Field Definition: image_model
concept:: [Series, Video Defaults]
type:: string
description:: Provider model id used to synthesize image assets (e.g. `wavespeed-ai/z-image/turbo`). Resolves through the Universal Parameter Cascade.

## NN Field Definition: speed
concept:: Template
type:: string
description:: Playback rate the provider synthesizes the narration at (a number, e.g. `1.1` for 10% faster). Optional; when omitted the provider default applies. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

## NN Field Definition: emotion
concept:: Template
type:: string
description:: Delivery the provider synthesizes the narration with (e.g. `happy`, `neutral`). Optional; when omitted the provider default applies. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

# Video Script Blueprint

## A native iNNfo schema for a video script: one Video, its ordered Scenes, and each Scene's Layers

## Philosophy

A video script is not a bespoke text format. It IS a Level-3 iNNfo document governed
by this Level-2 blueprint. The blueprint defines every Concept and Field a script may
use, so the engine consumes a structured model from innfo-core `read_knowledge` and
never re-parses the script's markdown. The model is tool-agnostic: no voice id, model
id, or resolution appears in the script — those values live in a Series' `Template`
instances and are referenced through `template::`. Timing is never declared; duration
and schedule are derived by the engine from synthesized media.

## Structure

- **Video** — exactly one per document. Carries the human `title`. The engine derives the
  composition id from it. No versioning mechanism exists.
- **Scene** — child of Video. Order equals the order of the `# NN index` list; no `order::`
  field exists. Its free-form prose BODY is the narration, synthesized by TTS and timed
  by the engine. It owns its `Layer` children and may carry `music::`, `transition::`, and
  a `template::` reference.
- **Layer** — child of a Scene, never of the Video. Discriminated by a required `type::`
  select. The allowed fields depend on `type::` (see Conditional Fields).
- **Template** — top-level Concept. Instances live in the Series' L3 Template-data document
  and carry `tool`, `voice`, `tts_model`, and optional `speed`/`emotion` delivery. A Scene
  references one through `template::`.
- **Series** — a top-level Concept for a real series. The episode's nearest ancestor holding a
  `series_NN.md` supplies the `series` cascade level, plus `title`, `presenter_asset` and
  `intro_asset`. An episode outside a series folder has no `series` level.
- **Video Defaults** — a top-level Concept carrying every cascade parameter's baseline. The
  package ships one at `defaults/video-defaults_NN.md` (the `blueprint` level); a domain MAY
  copy it to its root as `video-defaults_NN.md` (the `domain` level).

## Conditional Fields

iNNfo Level 1 has no native conditional-required primitive; unknown `type::` values are
rejected natively by the Field Definition's `options::` select. Per-type required fields
are declared in the blueprint frontmatter under `validation.conditional_fields` (a `type::`
value → the required Field names) and enforced by the engine's pre-compile guard:

| `type::` | Required |
|----------|----------|
| `presenter` | `asset` or `prompt` |
| `background` | `asset` or `prompt` |
| `b-roll` | `asset` or `prompt` |
| `title` | `text` |
| `lower-third` | `text` |
| `quote` | `text` |
| `caption` | `text` |
| `brand` | `asset` |
| `watermark` | `text` |
| `animation` | `asset` |

`caption` defaults to the owning Scene's body prose when `text` is omitted at the
guard's discretion.

## Objectives

- Provide a valid Level-2 blueprint usable as `parent_spec` for video scripts at Level 3.
- Model one Video per document, its ordered Scenes, and each Scene's Layers.
- Keep narration as the Scene prose body, never as a Field or Concept.
- Keep the script tool-agnostic by resolving tool/voice/tts_model through `template::`.
- Derive duration and timing from synthesized media; declare none.

## Reserved Identity

Every element carries the reserved immutable `slug::` as its first property line (L1 §2.5).
The engine derives stable ids (`scene_<slug>`, `layer_<slug>`) from it, never from display
names. `slug` is a reserved property of the iNNfo meta-template, not a Field Definition of
this blueprint.

# Concept Guidance Documentation

## Video

### Summary

The root Concept: exactly one Video element per script document, carrying the video `title` and the
episode's record — status, script, master, thumbnail and voice.

### Description

One `## NN Video: <name>` element models one episode. Its `slug::` is the stable identity the
engine uses to name the output. The `title` feeds the derived manifest composition id. The record
fields — `description`, `status`, `script`, `master`, `thumbnail` and `voice_id` — make the same
document both the episode's catalogue entry and its script, so an episode is modelled once. A
second Video element in the same document violates the one-video-per-script constraint.

### Methodologies

- Keep exactly one Video element; it is the single entry point of the document.
- Never add ordering, duration, or timing fields to the Video.
- Point `script`, `master` and `thumbnail` at one file each, resolved under the owning model's
  directory.
- Never model a format variant: the vertical and horizontal masters and thumbnails are derived
  from `master` by the render-formats naming convention.

### Prompts

- "Create a `Video` named `<title>` for this script."
- "Set `status` of `<video>` to `published` and point `master` at its rendered file."

## Scene

### Summary

A child of Video: an ordered narrative unit whose free-form prose body is the narration.

### Description

One `## NN Scene: <name>` element models one scene. Its position is the position of its
entry in the `# NN index` list. The prose body after the `::` fields is the narration text,
synthesized by TTS and timed by the engine. A Scene owns its `Layer` children and may
declare `music::`, `transition::`, and a `template::` reference to a Series Template.

### Methodologies

- Write narration as the Scene body prose, never as a field.
- Order Scenes by the index list; never declare an `order::` field.
- Put background music on `music::`, never as a Layer.

### Prompts

- "Add a `Scene` named `<name>` with narration prose and a `template::` reference."

## Layer

### Summary

A child of a Scene, discriminated by a required `type::` select.

### Description

In Level-3 video script documents, each `Layer` element is authored as a nested `### NN Layer: <name>` heading directly inside its enclosing `## NN Scene:` element. The nested heading establishes syntactic ownership, automatically setting `parentSlug` to the parent Scene slug. Separate top-level `# NN Layer` sections are deprecated for new scripts (flat H2 sections remain supported for legacy backward compatibility).

The required `type::` selects one of `presenter`, `background`, `b-roll`, `title`, `lower-third`, `caption`, `brand`, `quote`, `watermark`, or `animation`; any other value is rejected. The fields a Layer accepts are conditional on `type::` per the Conditional Fields contract. An `animation` Layer carries an `asset::` pointing at an authored HyperFrames project and MUST NOT carry overlay text.

### Methodologies

- Author each Layer as a nested `### NN Layer: <name>` heading immediately after the parent Scene prose body.
- Never place a Layer at Video level.
- Provide `asset` or `prompt` for media Layers, and `text` for text Layers.
- Keep paint order in `level` when it matters.

### Prompts

- "Add a nested `### NN Layer:` of `type:: lower-third` with `text:: <caption>` inside the Scene."

## Template

### Summary

A tool-agnostic instance of provider configuration shipped by a Series' L3 Template document.

### Description

One `## NN Template: <name>` element carries `tool`, `voice`, `tts_model`, and optional
`speed`/`emotion` delivery. Instances live in
the Series' L3 Template-data document, not in the script. A Scene references one through the
`template::` reference field using the qualified cross-knowledge form
`[[<Document Title> :: <Template Name>]]`.

### Methodologies

- Keep voice and model ids only in Template instances, never in the script.
- Reference templates from Scenes with `template::`.

### Prompts

- "Set `template::` of `<scene>` to `[[<series> :: <template>]]`."

## Series

### Summary

A real series: the source of the `series` cascade level and of `title`, `presenter_asset` and `intro_asset`.

### Description

The episode's nearest ancestor holding a `series_NN.md` is its series root. That document's
fields supply the `series` level of the Universal Parameter Cascade; an episode outside a
series folder (or a marker at the domain root) has no `series` level. A series folder holds at
most one `series_NN.md`.

### Methodologies

- Keep series-wide values in `series_NN.md`, not copy-pasted into every Scene.
- Never treat the domain root as a series.

### Prompts

- "Create a `Series` named `<name>` with its default `transition::` and `template::`."

## Video Defaults

### Summary

The `Video Defaults` document: the `blueprint` and `domain` levels of the cascade.

### Description

One `## NN Video Defaults:` element carries every cascade parameter's baseline. The package
ships one at `defaults/video-defaults_NN.md` (the `blueprint` level). A domain MAY hold one at
its root as `video-defaults_NN.md` (the `domain` level); when absent the `domain` level is
skipped. Changing the package instance MUST bump `blueprint_version`.

### Methodologies

- Adopt the domain copy by copying the package document unchanged, then tune the copy.
- Never hardcode a default in engine code; it lives here.

### Prompts

- "Copy the package `defaults/video-defaults_NN.md` to the domain root and tune it."
