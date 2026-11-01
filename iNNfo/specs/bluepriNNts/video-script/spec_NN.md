---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-5-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-5-0_NN.md"
blueprint_name: "video-script"
blueprint_version: "V_0-14-1"
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
    presenter: [asset, prompt, avatar]
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
* [[Preset]]

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

## NN Concept Definition: Preset
slug:: preset
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
description:: The episode's square master `<slug>_1920x1920.mp4`. Delivery formats are derived by `render-formats` and never modeled.

## NN Field Definition: thumbnail
concept:: Video
type:: image
description:: The episode's cover image, resolved under the owning model's directory.

## NN Field Definition: presets
concept:: [Video, Scene, Series, Video Defaults]
type:: select
multiple:: true
description:: Ordered list of Preset names that apply at this level, written as bare names such as `[Lucas, Studio Warm]` (no reference brackets). Each level's list sits directly under that level's explicit fields: the last Preset of a list wins, a level's explicit fields beat its own Presets, and lists are additive across levels. Optional.

## NN Field Definition: background_audio
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: file
description:: Background audio file for the Scene. Settable at Video, Scene, Preset, Series and Video Defaults through the Universal Parameter Cascade. Background audio is a Field and MUST NOT be modeled as a Layer.

## NN Field Definition: background_audio_volume
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Volume for the resolved `background_audio::` track (a number 0–1, e.g. `0.1`). Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: transition
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: select
options:: [fade, slide-left, slide-right, wipe, none]
description:: Transition into the Scene. Resolves through the Universal Parameter Cascade. Optional.

## NN Field Definition: frame
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Name of the frame document (`frames/<name>.md`) whose tokens style this Video, Scene, Series or domain. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: components
concept:: [Video, Preset, Series, Video Defaults]
type:: select
multiple:: true
description:: Keyed list of slot→component-name bindings (`slot=name`, e.g. `[lower-third=pill]`). Resolves per key through the Universal Parameter Cascade. Engine code names no component.

## NN Field Definition: sounds
concept:: [Video, Preset, Series, Video Defaults]
type:: select
multiple:: true
description:: Keyed list of engine-event→sound-name bindings (`event=name`, e.g. `[scene-boundary=whoosh]`). Resolves per key through the Universal Parameter Cascade. Engine code names no sound.

## NN Field Definition: avatar
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: file
description:: Image used as the presenter's source for a Scene whose presenter Layer declares no `asset::`. Resolves through the Universal Parameter Cascade, so it is settable at Video, Scene, Preset, Series and Video Defaults. Optional.

## NN Field Definition: intro
concept:: [Video, Preset, Series, Video Defaults]
type:: file
description:: Intro media reused by the episode's fixed first Scene. Resolves through the Universal Parameter Cascade. Optional; per episode, so not a Scene field.

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
description:: Overlay anchor inside the central safe square (the central 1080x1080 of the master).

## NN Field Definition: enter_animation
concept:: Layer
type:: string
description:: Enter motion of the Layer overlay. Optional.

## NN Field Definition: exit_animation
concept:: Layer
type:: string
description:: Exit motion of the Layer overlay. Optional.

## NN Field Definition: z_index
concept:: Layer
type:: string
description:: Paint order of the Layer as a numeric string (higher renders on top). Optional.

## NN Field Definition: avatar_model
concept:: [Layer, Scene, Video, Preset, Series, Video Defaults]
type:: string
description:: Avatar/lip-sync model id for a `presenter` Layer, or a cascade default (e.g. `wavespeed-ai/infinitetalk-fast`). Resolves through the Universal Parameter Cascade.

## NN Field Definition: avatar_resolution
concept:: Layer
type:: select
options:: [480p, 720p, 768p]
description:: Optional output resolution for a `presenter` avatar clip. The engine validates it against the model (Pruna accepts 480p/768p; InfiniTalk also 720p) and falls back to a model-appropriate default. Ignored by other Layer types.

## NN Field Definition: fit
concept:: [Layer, Scene, Video, Preset, Series, Video Defaults]
type:: select
options:: [cover, contain]
description:: How a media Layer (background, b-roll) fits its box. `cover` fills and crops; `contain` shows the whole asset with margins. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: voice
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Registered voice name or system voice used for TTS synthesis. Resolves through the Universal Parameter Cascade; a Preset supplies it unless a nearer level sets it. Part of the synthesized-audio cache identity.

## NN Field Definition: voice_model
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Provider model id used for TTS synthesis (e.g. `minimax/speech-2.8-hd`). Resolves through the Universal Parameter Cascade. Part of the synthesized-audio cache identity.

## NN Field Definition: voice_speed
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Playback rate the provider synthesizes the narration at (a number, e.g. `1.1` for 10% faster). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

## NN Field Definition: voice_emotion
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Delivery the provider synthesizes the narration with (e.g. `happy`, `neutral`). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

## NN Field Definition: voice_tone
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Free-form tone guidance for the author and the review console (e.g. `warm`, `authoritative`). Authoring guidance only: the engine never sends it to a provider, so it is not part of the cache key and never changes the synthesized audio.

## NN Field Definition: master_resolution
concept:: Video Defaults
type:: select
options:: [1920x1920]
description:: Pixel size of the single rendered master. Every delivery format is derived from it; no format is rendered on its own.

## NN Field Definition: image_model
concept:: [Video, Scene, Preset, Series, Video Defaults]
type:: string
description:: Provider model id used to synthesize image assets (e.g. `wavespeed-ai/z-image/turbo`). Resolves through the Universal Parameter Cascade.

# Video Script Blueprint

## A native iNNfo schema for a video script: one Video, its ordered Scenes, and each Scene's Layers

## Philosophy

A video script is not a bespoke text format. It IS a Level-3 iNNfo document governed
by this Level-2 blueprint. The blueprint defines every Concept and Field a script may
use, so the engine consumes a structured model from innfo-core `read_knowledge` and
never re-parses the script's markdown. The script should stay tool-agnostic by guidance:
voice ids, model ids and delivery settings SHOULD live in `Preset` elements or in the
scope documents (Series, domain Video Defaults), and a script MAY override them with the
cascade fields. Timing is never declared; duration and schedule are derived by the engine
from synthesized media.

## Structure

- **Video** — exactly one per document. Carries the human `title`. The engine derives the
  composition id from it. No versioning mechanism exists.
- **Scene** — child of Video. Order equals the order of the `# NN index` list; no `order::`
  field exists. Its free-form prose BODY is the narration, synthesized by TTS and timed
  by the engine. It owns its `Layer` children and may carry `background_audio::`,
  `transition::` and a `presets::` list.
- **Layer** — child of a Scene, never of the Video. Discriminated by a required `type::`
  select. The allowed fields depend on `type::` (see Conditional Fields).
- **Preset** — top-level Concept with no fields of its own. An element may carry only the
  Fields whose `concept::` lists `Preset`, plus the global `tags` and its reserved `slug`.
  Presets are defined in the script, in Series scope documents or in the domain
  `video-defaults_NN.md`, and are referenced by bare name from `presets::`.
- **Series** — a top-level Concept for a real series. The episode's nearest ancestor holding
  a scope document (`<s>_scope_NN.md` with frontmatter `scope: true`) supplies the `series`
  cascade level, plus `title`, `avatar` and `intro`. An episode outside a series folder has
  no `series` level.
- **Video Defaults** — a top-level Concept carrying every cascade parameter's baseline. The
  package ships one at `defaults/video-defaults_NN.md` (the `blueprint` level); a domain MAY
  copy it to its root as `video-defaults_NN.md` (the `domain` level).

## Conditional Fields

iNNfo Level 1 has no native conditional-required primitive; unknown `type::` values are
rejected natively by the Field Definition's `options::` select. Per-type required fields
are declared in the blueprint frontmatter under `validation.conditional_fields` (a `type::`
value → the required Field names) and enforced by the engine's pre-compile guard. A name
listed here is satisfied first by the Layer's own field and, when it is a cascade
parameter, by its resolved value through the Universal Parameter Cascade.

| `type::` | Required |
|----------|----------|
| `presenter` | `asset`, `prompt` or a cascaded `avatar` |
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
- Keep the script tool-agnostic by guidance, with voice and model values in Presets or scope
  documents and every override expressed as a cascade field.
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
episode's record — status, script, master and thumbnail.

### Description

One `## NN Video: <name>` element models one episode. Its `slug::` is the stable identity the
engine uses to name the output. The `title` feeds the derived manifest composition id. The record
fields — `description`, `status`, `script`, `master` and `thumbnail` — make the same
document both the episode's catalogue entry and its script, so an episode is modelled once. A
second Video element in the same document violates the one-video-per-script constraint.

### Methodologies

- Keep exactly one Video element; it is the single entry point of the document.
- Never add ordering, duration, or timing fields to the Video.
- Point `script`, `master` and `thumbnail` at one file each, resolved under the owning model's
  directory.
- Never model a format variant: the vertical, horizontal and square delivery files and the
  thumbnails are derived from `master` by the render-formats naming convention.

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
declare `background_audio::`, `transition::` and a `presets::` list.

### Methodologies

- Write narration as the Scene body prose, never as a field.
- Order Scenes by the index list; never declare an `order::` field.
- Put background audio on `background_audio::`, never as a Layer.

### Prompts

- "Add a `Scene` named `<name>` with narration prose and a `presets::` list."

## Layer

### Summary

A child of a Scene, discriminated by a required `type::` select.

### Description

In Level-3 video script documents, each `Layer` element is authored as a nested `### NN Layer: <name>` heading directly inside its enclosing `## NN Scene:` element. The nested heading establishes syntactic ownership, automatically setting `parentSlug` to the parent Scene slug. Separate top-level `# NN Layer` sections are deprecated for new scripts (flat H2 sections remain supported for legacy backward compatibility).

The required `type::` selects one of `presenter`, `background`, `b-roll`, `title`, `lower-third`, `caption`, `brand`, `quote`, `watermark`, or `animation`; any other value is rejected. The fields a Layer accepts are conditional on `type::` per the Conditional Fields contract. An `animation` Layer carries an `asset::` pointing at an authored HyperFrames project and MUST NOT carry overlay text.

### Methodologies

- Author each Layer as a nested `### NN Layer: <name>` heading immediately after the parent Scene prose body.
- Never place a Layer at Video level.
- Provide `asset` or `prompt` for media Layers, and `text` for text Layers; a presenter may
  instead rely on the cascaded `avatar`.
- Keep paint order in `z_index` when it matters.

### Prompts

- "Add a nested `### NN Layer:` of `type:: lower-third` with `text:: <caption>` inside the Scene."

## Preset

### Summary

A named bundle of cascade parameters, defined in a scope document or in the script.

### Description

One `## NN Preset: <name>` element carries only cascade parameters — `voice`, `voice_model`,
`voice_speed`, `voice_emotion`, `voice_tone`, `avatar`, `avatar_model`, `intro`, `image_model`,
`background_audio`, `background_audio_volume`, `transition`, `frame`, `fit`, `components` and
`sounds` — plus the global `tags` and its reserved `slug`. A Preset has no fields of its own and
owns no Layers. An element references Presets with an ordered list of bare names,
`presets:: [Lucas, Studio Warm]`.

Lookup is one order for every reference: the script, then the Series chain from innermost to
outermost scope document, then the domain `video-defaults_NN.md`; the first match wins, and a
nearer definition shadows an outer one. Within a level the last Preset of the list wins; an
element's explicit fields always beat its own Presets.

### Methodologies

- Put provider and delivery configuration in a Preset, not copy-pasted into every Scene.
- Reference Presets by bare name; never write `[[…]]` or `::` inside the list.
- Remember that a Preset that omits a parameter does not reset it.

### Prompts

- "Define a `Preset` named `<name>` with `voice::` and `voice_model::`."
- "Add `presets:: [<name>]` to this Scene."

## Series

### Summary

A real series: the source of the `series` cascade level and of `title`, `avatar` and `intro`.

### Description

The episode's nearest ancestor holding a scope document — a `_NN.md` file with frontmatter
`scope: true`, canonically `<s>_scope_NN.md` — is its series root. That document's fields supply
the `series` level of the Universal Parameter Cascade; an episode outside a series folder (or a
marker at the domain root) has no `series` level. A series folder holds at most one scope
document. Legacy markers such as `series_NN.md` anchor nothing.

### Methodologies

- Keep series-wide values in the scope document, not copy-pasted into every Scene.
- Never treat the domain root as a series.

### Prompts

- "Create a `Series` named `<name>` with its default `transition::` and `presets::`."

## Video Defaults

### Summary

The `Video Defaults` document: the `blueprint` and `domain` levels of the cascade.

### Description

One `## NN Video Defaults:` element carries every cascade parameter's baseline. The package
ships one at `defaults/video-defaults_NN.md` (the `blueprint` level). A domain MAY hold one at
its root as `video-defaults_NN.md` (the `domain` level); when absent the `domain` level is
skipped. Changing the package instance MUST bump `blueprint_version`. A domain copy MAY define
Presets after its `Video Defaults` section.

### Methodologies

- Adopt the domain copy by copying the package document unchanged, then tune the copy.
- Never hardcode a default in engine code; it lives here.

### Prompts

- "Copy the package `defaults/video-defaults_NN.md` to the domain root and tune it."
