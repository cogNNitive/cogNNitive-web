---
spec_version: "V_0-4-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-4-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md"
blueprint_name: "video-script"
blueprint_version: "V_0-1-1"
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
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]
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

# NN Field Definition

## NN Field Definition: title
concept:: Video
type:: string
description:: Human title of the video. The engine derives the manifest compositionId from it.

## NN Field Definition: template
concept:: Scene
type:: reference
target_concepts:: [Template]
description:: Reference to a Template instance (tool, voice, model) shipped by the Series' L3 Template-data document, e.g. [[My Series :: Presenter Full]]. Optional.

## NN Field Definition: music
concept:: Scene
type:: file
description:: Scene-level background music file. Music is a Scene field and MUST NOT be modeled as a Layer.

## NN Field Definition: transition
concept:: Scene
type:: select
options:: [fade, slide-left, slide-right, wipe, none]
description:: Transition into the Scene. Optional.

## NN Field Definition: type
concept:: Layer
type:: select
options:: [presenter, background, b-roll, title, lower-third, caption, brand, quote]
description:: Required Layer discriminator. Allowed fields are conditional on this value.

## NN Field Definition: asset
concept:: Layer
type:: file
description:: Source media file for a Layer (image or video). Required for presenter, background, brand, and b-roll.

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

## NN Field Definition: tool
concept:: Template
type:: select
options:: [wavespeed, replicate, elevenlabs, edge-tts]
description:: Media provider used to synthesize the assets bound to this Template.

## NN Field Definition: voice
concept:: Template
type:: string
description:: Registered voice name or system voice used for TTS synthesis.

## NN Field Definition: model
concept:: Template
type:: string
description:: Provider model id used for TTS synthesis.

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
  and carry `tool`, `voice`, and `model`. A Scene references one through `template::`.

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

`caption` defaults to the owning Scene's body prose when `text` is omitted at the
guard's discretion.

## Objectives

- Provide a valid Level-2 blueprint usable as `parent_spec` for video scripts at Level 3.
- Model one Video per document, its ordered Scenes, and each Scene's Layers.
- Keep narration as the Scene prose body, never as a Field or Concept.
- Keep the script tool-agnostic by resolving tool/voice/model through `template::`.
- Derive duration and timing from synthesized media; declare none.

## Reserved Identity

Every element carries the reserved immutable `slug::` as its first property line (L1 §2.5).
The engine derives stable ids (`scene_<slug>`, `layer_<slug>`) from it, never from display
names. `slug` is a reserved property of the iNNfo meta-template, not a Field Definition of
this blueprint.

# Concept Guidance Documentation

## Video

### Summary

The root Concept: exactly one Video element per script document, carrying the video `title`.

### Description

One `## NN Video: <name>` element models one video. Its `slug::` is the stable identity the
engine uses to name the output. The `title` feeds the derived manifest composition id. A
second Video element in the same document violates the one-video-per-script constraint.

### Methodologies

- Keep exactly one Video element; it is the single entry point of the document.
- Never add ordering, duration, or timing fields to the Video.

### Prompts

- "Create a `Video` named `<title>` for this script."

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

One `## NN Layer: <name>` element models one visual or audio layer inside its Scene. The
required `type::` selects one of `presenter`, `background`, `b-roll`, `title`, `lower-third`,
`caption`, `brand`, or `quote`; any other value is rejected. The fields a Layer accepts are
conditional on `type::` per the Conditional Fields contract.

### Methodologies

- Nest each Layer under its Scene in the `# NN index`; never place a Layer at Video level.
- Provide `asset` or `prompt` for media Layers, and `text` for text Layers.
- Keep paint order in `level` when it matters.

### Prompts

- "Add a `Layer` of `type:: lower-third` with `text:: <caption>`."

## Template

### Summary

A tool-agnostic instance of provider configuration shipped by a Series' L3 Template document.

### Description

One `## NN Template: <name>` element carries `tool`, `voice`, and `model`. Instances live in
the Series' L3 Template-data document, not in the script. A Scene references one through the
`template::` reference field using the qualified cross-knowledge form
`[[<Document Title> :: <Template Name>]]`.

### Methodologies

- Keep voice and model ids only in Template instances, never in the script.
- Reference templates from Scenes with `template::`.

### Prompts

- "Set `template::` of `<scene>` to `[[<series> :: <template>]]`."
