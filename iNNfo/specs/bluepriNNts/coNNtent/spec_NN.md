---
spec_version: "V_0-5-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
level: 2
parent_spec:
  name: "iNNfo_V_0-7-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-7-0_NN.md"
blueprint_name: "coNNtent"
blueprint_version: "V_0-19-0"
title: "coNNtent App"
catalog: catalog/model-catalog_coNNtent_NN.md
procedures:
  - id: "create-series"
    name: "Create a Series"
    path: "procedures/create_series_procedures_NN.md"
  - id: "configure-cascade"
    name: "Configure Cascade Parameters"
    path: "procedures/configure_cascade_procedures_NN.md"
  - id: "create-character"
    name: "Create a Character"
    path: "procedures/create_character_procedures_NN.md"
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
    avatar: [asset, prompt]
    media: [asset, prompt]
    text: [text, text_from]
    animation: [asset]
gates:
  script: element
  preview: element
  budget: model
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]
* [[Series]]
  * [[Scene Kind]]
  * [[Chrome]]
* [[Video Defaults]]
* [[Preset]]
* [[Provider]]
  * [[Model]]
* [[Voice]]

# NN Concept Definition

## NN Concept Definition: Video
slug:: video
icon:: clapperboard
type:: list
color:: blue
weight:: 100
storage:: distributed
container:: Series
placement:: "{container}/episodes/{slug}/"

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
storage:: distributed
placement:: "series/{slug}/"

## NN Concept Definition: Scene Kind
slug:: scene-kind
icon:: layout-list
type:: list
color:: teal
weight:: 58

## NN Concept Definition: Chrome
slug:: chrome
icon:: frame
type:: list
color:: teal
weight:: 56

## NN Concept Definition: Video Defaults
slug:: video-defaults
icon:: sliders-horizontal
type:: list
color:: gray
weight:: 50

## NN Concept Definition: Provider
slug:: provider
icon:: plug
type:: list
color:: slate
weight:: 40

## NN Concept Definition: Model
slug:: model
icon:: cpu
type:: list
color:: slate
weight:: 38

## NN Concept Definition: Voice
slug:: voice
icon:: mic
type:: list
color:: slate
weight:: 36

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
description:: What the episode is about, in one or two sentences. The agent writes it as part of the proposed changeset.

## NN Field Definition: status
concept:: Video
type:: select
options:: [idea, draft, approved, produced, failed_qa, delivered, archived]
description:: Lifecycle position of the episode, written by the engine or the user through a changeset. `idea` carries a title and linked Sources only.

## NN Field Definition: script
concept:: Video
type:: file
description:: The episode's script document, resolved under the owning model's directory.

## NN Field Definition: master
concept:: Video
type:: video
description:: The episode's master `<slug>_<W>x<H>.mp4`, sized by the first entry of `output_formats`. Delivery formats are derived from it and never modeled.

## NN Field Definition: delivered_version
concept:: Video
type:: string
description:: The delivery version the engine last assembled (`v1`, `v2`, ...). Written by the engine together with `status:: delivered`.

## NN Field Definition: thumbnail
concept:: Video
type:: image
description:: The episode's cover image, resolved under the owning model's directory.

## NN Field Definition: translation_of
concept:: Video
scope:: record
type:: string
description:: For a translation episode, the slug of the original (`<slug>` in the same series, or `<series>/<slug>` across series). The original MUST exist, MUST NOT itself be a translation and MUST share the source; never points at itself. Video-only record field.

## NN Field Definition: kind
concept:: Scene
type:: select
description:: Name of a Scene Kind declared by the Series, or the reserved value `Libre`. Required on every V_0-15-0 Scene; the engine validates it against the Series and offers no static options. A `Libre` scene takes no kind rules, presets or chrome, so it renders with no watermark, CTA, bumper or music.

## NN Field Definition: review
concept:: Scene
type:: select
options:: [approved, needs-change]
description:: The reviewer's verdict on the scene. Every scene must be `approved` before the episode can reach `approved`; a reason is a changeset comment, never a field.

## NN Field Definition: role
concept:: Scene Kind
type:: string
description:: Free-text role of the kind in the series format (for example `hook`, `news`, `wrap-up`). Orientative for the author, never enforced as an order.

## NN Field Definition: narration
concept:: Scene Kind
type:: select
options:: [on, off]
description:: Whether scenes of this kind carry narration. With `on`, the measured narration sets the scene length and every `animation` Layer is trimmed or looped to it. `off` means no TTS request is made, a non-empty scene body is an error, and the scene takes its length from its media or animation.

## NN Field Definition: max_duration
concept:: Scene Kind
type:: number
description:: Maximum duration of a scene of this kind, in seconds. Compared with the estimate before spend and with the measured duration after TTS; an overrun is a warning, never a stop.

## NN Field Definition: fixed
concept:: Scene Kind
type:: string
description:: Placement of an engine-inserted scene: `none`, `first`, `last` or `after:<kind>` (after the first scene of that kind). The episode does not declare fixed scenes; the engine inserts them with the kind's `asset`.

## NN Field Definition: chrome
concept:: Scene Kind
type:: select
multiple:: true
options:: [watermark, cta, bumper, music]
description:: Chrome items applied to every scene of this kind. Each item resolves from the `Chrome` element for the cascaded `language`.

## NN Field Definition: watermark
concept:: Chrome
type:: markdown_inline
description:: Watermark text for this language, for example an AI-disclosure line.

## NN Field Definition: cta
concept:: Chrome
type:: markdown_inline
description:: Call-to-action text for this language.

## NN Field Definition: bumper
concept:: Chrome
type:: file
description:: Series bumper media for this language, resolved as a logical name under `series/<s>/library/media/`.

## NN Field Definition: music
concept:: Chrome
type:: file
description:: Series music bed for this language, resolved as a logical name under `series/<s>/library/media/`. Retired on Scene and Preset, where `background_audio` is the only field.

## NN Field Definition: presets
concept:: [Video, Scene, Scene Kind, Series, Video Defaults]
  scope:: render
type:: select
multiple:: true
description:: Ordered list of Preset names that apply at this level, written as bare names such as `[Lucas, Studio Warm]` (no reference brackets). Each level's list sits directly under that level's explicit fields: the last Preset of a list wins, a level's explicit fields beat its own Presets, and lists are additive across levels. Optional.

## NN Field Definition: background_audio
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: file
description:: Background audio file for the Scene. Resolves through the Universal Parameter Cascade. Background audio is a Field and MUST NOT be modeled as a Layer.

## NN Field Definition: background_audio_volume
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: number
description:: Volume for the resolved `background_audio::` track (a number 0–1, e.g. `0.1`). Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: transition
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: select
options:: [fade, slide-left, slide-right, wipe, none]
description:: Transition into the Scene. Resolves through the Universal Parameter Cascade. Optional.

## NN Field Definition: frame
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Name of the frame folder (`library/frames/<name>/FRAME.md` at the episode, series, domain or package level) whose tokens style this Video, Scene, Series or domain. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: components
concept:: [Video, Preset, Series, Video Defaults]
  scope:: render
type:: select
multiple:: true
description:: Keyed list of slot→component-name bindings (`slot=name`, e.g. `[lower-third=pill]`). Resolves per key through the Universal Parameter Cascade. Engine code names no component.

## NN Field Definition: sounds
concept:: [Video, Preset, Series, Video Defaults]
  scope:: render
type:: select
multiple:: true
description:: Keyed list of engine-event→sound-name bindings (`event=name`, e.g. `[scene-boundary=whoosh]`). Resolves per key through the Universal Parameter Cascade. Engine code names no sound.

## NN Field Definition: avatar
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: file
description:: Image used as the source for an `avatar` Layer that declares no `asset::`. Resolves through the Universal Parameter Cascade. Optional.

## NN Field Definition: character
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Name of the active Character (a folder in `library/characters/` or `media/characters/`). Resolves through the Universal Parameter Cascade; a series sets its host, a scene can bring a guest. Optional.

## NN Field Definition: pose
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Avatar pose of the active Character: a file name in its `avatars/` without extension. Defaults to the Character's `default_pose`; requires an active `character`. Optional.

## NN Field Definition: background
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Background image of the active Character: a file name in its `backgrounds/` without extension. Defaults to the Character's `default_background`; requires an active `character`. Optional.

## NN Field Definition: intro
concept:: [Video, Preset, Series, Video Defaults]
  scope:: render
type:: file
description:: Intro media reused by the episode's fixed first Scene. Resolves through the Universal Parameter Cascade. Optional; per episode, so not a Scene field.

## NN Field Definition: type
concept:: Layer
type:: select
options:: [avatar, media, text, animation]
description:: Required Layer behaviour type. `avatar` is a lip-synced paid job; `media` is an image or a video; `text` is overlay text; `animation` mounts an authored HyperFrames project as a sub-composition. Appearance and visual components come from Presets, never from the type.

## NN Field Definition: placement
concept:: Layer
type:: select
options:: [full, inset]
description:: For a `media` Layer: `full` covers the frame, `inset` places it inside the safe area. Required on `media`.

## NN Field Definition: timing
concept:: Layer
type:: select
options:: [scene, slot]
description:: For a `media` Layer: `scene` spans the whole scene, `slot` occupies an overlay slot. Required on `media`.

## NN Field Definition: style
concept:: Layer
type:: select
options:: [title, lower-third, caption, watermark, quote]
description:: For a `text` Layer: the visual component to render. The component implementation resolves by name (`components/<style>`, a folder `library/components/<style>/` or `media/components/<style>/`, episode → series → domain → skill fallback), so a Series can restyle it without a new type.

## NN Field Definition: text_from
concept:: Layer
type:: select
options:: [narration]
description:: For a `text` Layer: the reserved value `narration` renders the owning Scene's body prose. Mutually exclusive with `text`.

## NN Field Definition: asset
concept:: [Layer, Scene Kind]
type:: file
description:: Source media file for a Layer (image or video), the directory of an authored HyperFrames project for an `animation` Layer, or the media of a fixed Scene Kind. One of `asset` or `prompt` is required for `avatar` and `media` Layers.

## NN Field Definition: prompt
concept:: Layer
type:: string
description:: Media-synthesis prompt used when a Layer has no asset. One of `asset` or `prompt` is required for `avatar` and `media` Layers.

## NN Field Definition: text
concept:: Layer
type:: markdown_inline
description:: Inline text for a `text` Layer. One of `text` or `source` is required.

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
  scope:: render
type:: string
  options_from:: models:avatar
description:: Avatar/lip-sync model id for an `avatar` Layer, or a cascade default (e.g. `wavespeed-ai/infinitetalk-fast`). Resolves through the Universal Parameter Cascade. The console picklist offers the merged catalog's allowed avatar models by `api_id`.

## NN Field Definition: avatar_resolution
concept:: Layer
  scope:: render
type:: select
options:: [480p, 720p, 768p]
description:: Optional output resolution for an `avatar` clip. The engine validates it against the model's declared `controls` and falls back to a model-appropriate default. Ignored by other Layer types.

## NN Field Definition: fit
concept:: [Layer, Scene, Video, Preset, Series, Video Defaults]
  scope:: render
type:: select
options:: [cover, contain]
description:: How a `media` Layer fits its box. `cover` fills and crops; `contain` shows the whole asset with margins. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

## NN Field Definition: voice
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
  options_from:: voices
description:: Registered voice name or system voice used for TTS synthesis. Resolves through the Universal Parameter Cascade; a Preset supplies it unless a nearer level sets it. Part of the synthesized-audio cache identity. The console picklist offers the merged catalog's Voices by slug.

## NN Field Definition: voice_model
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
  options_from:: models:tts
description:: Provider model id used for TTS synthesis (e.g. `minimax/speech-2.8-hd`). Resolves through the Universal Parameter Cascade. Part of the synthesized-audio cache identity. The console picklist offers the merged catalog's allowed tts models by `api_id`.

## NN Field Definition: voice_speed
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Playback rate the provider synthesizes the narration at (a number, e.g. `1.1` for 10% faster). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

## NN Field Definition: voice_emotion
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Delivery the provider synthesizes the narration with (e.g. `happy`, `neutral`). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

## NN Field Definition: image_model
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
  options_from:: models:image
description:: Provider model id used to synthesize image assets (e.g. `wavespeed-ai/z-image/turbo`). Resolves through the Universal Parameter Cascade. The console picklist offers the merged catalog's allowed image models by `api_id`.

## NN Field Definition: image_size
concept:: [Video, Scene, Preset, Series, Video Defaults]
  scope:: render
type:: string
description:: Requested image size as `<W>x<H>`, validated against the resolved image Model's `sizes`. Part of the image cache key. Defaults to `1024x1024` in the blueprint Video Defaults.

## NN Field Definition: language
concept:: [Video, Series, Video Defaults, Chrome]
  scope:: video
type:: string
description:: Language code (for example `es`, `en`) driving voice selection, chrome text, narration rules and the description language. The blueprint ships no default: an unset language is a validation error.

## NN Field Definition: budget
concept:: [Video, Series, Video Defaults]
  scope:: video
type:: number
description:: Per-episode budget in the domaiNN's single currency. The blueprint ships no default: an unset budget always asks at the budget gate. An estimate within the budget is auto-approved.

## NN Field Definition: daily_budget
concept:: Video Defaults
  scope:: domain
type:: number
description:: Rolling 24-hour cap in the domaiNN's single currency. Settable only in a Video Defaults document (domain or blueprint level); the blueprint ships no default (no daily cap).

## NN Field Definition: output_formats
concept:: [Video, Series, Video Defaults]
  scope:: video
type:: select
multiple:: true
description:: Ordered list of delivery sizes as `<W>x<H>`. The first entry is the master size; the rest are derived from the master. Defaults to `[1920x1920, 1080x1920, 1920x1080, 1080x1080]`.

## NN Field Definition: review_gates
concept:: [Video, Series, Video Defaults]
scope:: video
type:: select
multiple:: true
options:: [script, preview]
description:: The gates that stop the run before spend, in order. Defaults to `[script, preview]`. Replaces the retired single script-review flag.

## NN Field Definition: captions
concept:: [Video, Series, Video Defaults]
scope:: render
type:: select
options:: [off, words, lines]
description:: Caption mode: `off` produces no captions, `words` word-level timing, `lines` segment-level timing. Defaults to `off`.

## NN Field Definition: caption_model
concept:: [Video, Series, Video Defaults]
scope:: render
type:: string
description:: The transcript alignment model override. Defaults to the package model.

## NN Field Definition: thumbnail_formats
concept:: [Video, Series, Video Defaults]
scope:: video
type:: select
multiple:: true
description:: Ordered thumbnail sizes as `<W>x<H>`. Defaults to `[2560x1440, 1080x1920]`.

## NN Field Definition: thumbnail_base
concept:: [Video, Series, Video Defaults]
scope:: video
type:: file
description:: A text-free clean composite used as the thumbnail base; defaults to the first scene still.

## NN Field Definition: thumbnail_title
concept:: [Video, Series, Video Defaults]
scope:: video
type:: string
description:: The title text drawn on the thumbnail; defaults to the Video `title`.

## NN Field Definition: thumbnail_badge
concept:: [Video, Series, Video Defaults]
scope:: video
type:: string
description:: An optional small badge drawn on the thumbnail; defaults to none.

## NN Field Definition: name
concept:: Provider
type:: string
description:: Provider display name (for example `WaveSpeed`).

## NN Field Definition: api_base
concept:: Provider
type:: url
description:: Base URL the provider's API is called at.

## NN Field Definition: provider
concept:: Model
type:: string
description:: Slug of the `Provider` element this Model belongs to.

## NN Field Definition: api_id
concept:: Model
type:: string
description:: Exact model id the provider expects in a request.

## NN Field Definition: capability
concept:: Model
type:: select
options:: [tts, image, avatar, video]
description:: What the Model produces. Capability is declared, never inferred from the id.

## NN Field Definition: controls
concept:: Model
type:: select
multiple:: true
options:: [speed, emotion, size, resolution]
description:: Intent controls the Model declares. A non-default intent value for a control the Model does not declare fails at estimate, before any spend.

## NN Field Definition: sizes
concept:: Model
type:: select
multiple:: true
description:: Image sizes the Model accepts, as `<W>x<H>` entries. `image_size` must be one of them.

## NN Field Definition: adapter
concept:: Model
type:: string
description:: Adapter id that translates intent fields into this provider's request parameters (`scripts/adapters/<id>.mjs`).

## NN Field Definition: price
concept:: Model
type:: number
description:: Unit price in the domaiNN's single currency, in the unit named by `price_unit`. Absent or unset blocks the run for an allowed model.

## NN Field Definition: price_unit
concept:: Model
type:: select
options:: [per_1k_chars, per_image, per_second]
description:: Unit `price` is expressed in.

## NN Field Definition: price_date
concept:: Model
type:: string
description:: Date the price was observed (`YYYY-MM-DD`). Older than `stale_after_days` warns and never blocks.

## NN Field Definition: price_source
concept:: Model
type:: select
options:: [blueprint, invoice]
description:: Where the price came from. The domaiNN overlay sets `invoice` when it overrides the reference price.

## NN Field Definition: stale_after_days
concept:: Model
type:: number
description:: Days after `price_date` at which the price is considered stale. Defaults to 90.

## NN Field Definition: allowed
concept:: Model
type:: boolean
description:: Whether the domaiNN allows this Model. Declared in the domaiNN overlay; a model not allowed is refused before spend.

## NN Field Definition: voice_id
concept:: Voice
type:: string
description:: The provider's own voice identifier, used verbatim in a TTS request.

# coNNtent Blueprint

## A native iNNfo schema for one episode: its record, its ordered Scenes, their Layers and the series format they follow

## Philosophy

An episode is not a bespoke text format. It IS a Level-3 iNNfo document governed by this
Level-2 blueprint. The blueprint defines every Concept and Field a document may use, so the
engine consumes a structured model from nn-core `parseKnowledge` and never re-parses the
document's markdown. The document stays tool-agnostic by guidance: voice ids, model ids and
delivery settings SHOULD live in `Preset` elements or in the scope documents (Series, domain
Video Defaults), and a document MAY override them with the cascade fields. Timing is never
declared; duration and schedule are derived by the engine from synthesized media. Changes
reach the document only through changesets applied by the apply engine.

## Structure

- **Video** — a distributed concept: one Video instance model per episode, at
  `series/<s>/episodes/<slug>/<slug>_coNNtent_NN.md`, holding exactly one Video element.
  Carries the episode record (`status`, `script`, `master`, `thumbnail`, `translation_of`),
  the human `title` and the pinned `blueprint_version` in the document frontmatter.
- **Scene** — child of Video. Order equals the order of the `# NN index` list; no `order::`
  field exists. Its free-form prose BODY is the narration, synthesized by TTS and timed by
  the engine. The body is TTS input verbatim, so it is continuous prose: a line break inside
  a sentence reaches the voice as a pause. It states a required `kind::` and may carry `review::`, `presets::` and the
  cascade fields.
- **Layer** — child of a Scene, never of the Video. Discriminated by the required `type::`
  with exactly four values: `avatar`, `media`, `text`, `animation`.
- **Library** — the package ships the reusable folders `library/frames/<name>/FRAME.md`
  (frame tokens), `library/components/<name>/{COMPONENT.md,index.html,preview.mp4}` (the
  component portfolio base set) and `library/characters/<name>/CHARACTER.md` (characters),
  plus the slot contracts in `skills/nn-conntent/slots/<slot>.html`; a domaiNN or series
  root may shadow any of them under its own `library/`, and an episode under `media/`.
  Component `index.html` files never reference a network URL, so rendering is offline.
- **Scene Kind** — element of the Series: the grammar of one kind of scene (role,
  narration, limits, fixed placement, chrome, presets).
- **Chrome** — element of the Series, one per language: series-level wallpaper (watermark,
  CTA, bumper, music) applied by kind.
- **Preset** — top-level Concept with no fields of its own. An element may carry only the
  Fields whose `concept::` lists `Preset`, plus the global `tags` and its reserved `slug`.
- **Series** — a distributed concept: one Series instance model per series, at
  `series/<s>/<s>_coNNtent_NN.md`. That model IS the scope document: it carries frontmatter
  `scope: true` and supplies the `series` cascade level, the Scene Kinds and the Chrome
  elements. The engine recognises it by `scope: true`, never by file name.
- **Video Defaults** — the `blueprint` and `domain` cascade levels; the only place where
  `daily_budget` is settable.
- **Provider**, **Model**, **Voice** — the catalog schema. The package ships one reference
  catalog instance; a domaiNN adds an overlay that allowlists models and overrides prices.

## Universal Parameter Cascade

Every parameter valid at more than one level resolves through one resolver, most specific
first:

```
layer > scene > video > kind > series > domain > blueprint
```

The fold runs outermost to innermost: blueprint (`defaults/video-defaults_NN.md` in the
package), domain (`video-defaults_NN.md` at the domaiNN root), series (the Series document),
kind (the `Scene Kind` element named by the scene's `kind::`), video, scene. A layer holds
explicit fields only. There is no `cli` level: no command-line flag supplies a parameter.
Each of domain, series, kind, video and scene MAY list `presets`, expanded directly before
that level's explicit node; a Scene Kind contributes only its expanded `presets`. A `Libre`
scene contributes no kind node.

## Narration and Scene Duration

A scene body is the TTS input. Write it as continuous prose: never break a line inside a
sentence, because the synthesized voice reads a hard line break as a pause and the audio
cuts mid-sentence. Separate sentences or paragraphs only where a pause is intended.

Timing is never declared; the scene length comes from one source, chosen by the kind's
`narration`:

- **`narration:: on`** — the measured narration sets the scene length. An `animation` Layer never stretches the scene: a longer animation is
  trimmed and a shorter one is looped to the narration length. `max_duration` is compared
  with that narration length.
- **`narration:: off`** — no narration exists, so the scene takes its length from its media
  or animation.

A `Libre` scene has no kind and therefore no `narration` setting of its own: it follows
`narration:: on` when its body carries narration and `narration:: off` when the body is empty.

## Review Iteration

Review state is derived, never stored. Each verdict is a `review_gate` changeset for one
`(scene, gate)` pair and carries that scene's content hash. Editing a scene changes its hash,
so only that scene's verdict stops counting and only that scene returns to review; every
other scene keeps its approval. A text fix therefore reopens one scene, not the episode.
`review_gates:: []` on the Series or Video turns the gates off entirely (autopilot); it is
not a draft mode, because with it nothing stops before spend except the budget gate.

## Animatic and Avatars

The animatic built before the `preview` gate shows each `avatar` Layer as its static source
image, on purpose. Talking avatars are the costliest call, so they are synthesized only after
the `preview` gate is approved; the animatic exists to review narration, timing and visuals
before that spend. A static avatar in the animatic is expected, not a defect.

## Conditional Fields

iNNfo Level 1 has no native conditional-required primitive; an unknown `type::` value is
rejected natively by the Field Definition's `options::` select. Per-type required fields are
declared in the blueprint frontmatter under `validation.conditional_fields` (a `type::`
value → an OR group of Field names) and enforced by the engine's pre-compile guard. A name
listed here is satisfied by the Layer's own field and, when it is a cascade parameter, by its
resolved value through the Universal Parameter Cascade.

| `type::` | Required (one of) |
|----------|-------------------|
| `avatar` | `asset` or `prompt` |
| `media` | `asset` or `prompt` |
| `text` | `text` or `text_from` |
| `animation` | `asset` |

`avatar_model` is never required: it has a blueprint default. `style` is required on `text`
and `placement`/`timing` on `media` through their Field Definitions, not through this table.

## Objectives

- Provide a valid Level-2 blueprint usable as `parent_spec` for episode documents at Level 3.
- Model one Video per document, its ordered Scenes, each Scene's Layers.
- Keep narration as the Scene prose body, never as a Field or Concept.
- State exactly four Layer behaviour types and keep appearance in Presets.
- Model the series format once, in the Series document, as Scene Kinds and Chrome.
- Keep voice, model and price knowledge in the catalog, never in engine code.
- Keep timing underived in the model: duration and schedule come from synthesized media.

## Reserved Identity

Every element carries the reserved immutable `slug::` as its first property line (L1 §2.5).
The engine derives stable ids (`scene_<slug>`, `layer_<slug>`) from it, never from display
names. `slug` is a reserved property of the iNNfo meta-template, not a Field Definition of
this blueprint.

## Removed Fields

The retired names `template`, `tool`, `tts_model`, `speed`, `emotion`, `music_volume`,
`presenter_asset`, `intro_asset`, `voice_tone`, `scene_duration`, `scene_tts_model` and
`master_resolution` MUST NOT be defined. `level` and `model` are retired on Layer;
`voice_id` is retired on Video; the Layer and type names `presenter`, `talking_avatar` and
`talking-avatar` MUST NOT exist as a value or alias. `music` is retired on Scene and Preset
and valid only on `Chrome`. A document using a retired name fails validation with no alias,
and the error names the replacement when one exists.

# Concept Guidance Documentation

## Video

### Summary

The root Concept: exactly one Video element per Video instance model, carrying the episode
record and the script.

### Description

One `## NN Video: <name>` element models one episode. Its `slug::` is the stable identity the
engine uses to name the output. The record fields — `description`, `status`, `script`,
`master`, `thumbnail` and `translation_of` — make the same document both the
episode's catalogue entry and its script. The document frontmatter pins
`blueprint_version: V_0-15-0`; `produce` refuses any other pin. A second Video element in
the same document violates the one-video-per-script constraint.

### Methodologies

- Keep exactly one Video element per instance model; it is the single entry point of the
  document.
- Never add ordering, duration or timing fields to the Video.
- Point `script`, `master` and `thumbnail` at one file each, resolved under the owning
  model's directory.
- Never model a format variant: every delivery file and thumbnail is derived from `master`.

### Prompts

- "Create a `Video` named `<title>` for this script and pin `blueprint_version: V_0-17-0`."
- "Produce `<video>`; the engine sets `delivered` after a passing QA and a new `deliveries/v<N>/`."

## Scene

### Summary

A child of Video: an ordered narrative unit whose free-form prose body is the narration.

### Description

One `## NN Scene: <name>` element models one scene. Its position is the position of its entry
in the `# NN index` list. The prose body after the `::` fields is the narration text,
synthesized by TTS and timed by the engine. Every V_0-15-0 Scene states `kind::` with a kind
declared by its Series or the reserved `Libre`. A scene owns its `Layer`
children and may declare `review::`, `presets::` and cascade fields.

### Methodologies

- Write narration as the Scene body prose, never as a field.
- Keep each sentence on one line: the body is TTS input, and a mid-sentence line break is
  synthesized as a pause.
- State the kind on every scene; use `Libre` only when the series format does not fit.
- Order Scenes by the index list; never declare an `order::` field.
- Put background audio on `background_audio::`, never as a Layer.
- Write the narration as the scene body. Alternatives are edited in place by the reviewer, never stored as a second copy.

### Prompts

- "Add a `Scene` named `<name>` with `kind:: <kind>`, narration prose and a `presets::` list."
- "Rewrite the narration of `<scene>` in place."

## Layer

### Summary

A child of a Scene, discriminated by the required `type::` select with four behaviour types.

### Description

In Level-3 documents each `Layer` is authored as a nested `### NN Layer: <name>` heading
directly inside its enclosing `## NN Scene:` element. The nested heading establishes
syntactic ownership, setting `parentSlug` to the parent Scene slug. Separate top-level
`# NN Layer` sections are deprecated for new documents.

The required `type::` selects `avatar`, `media`, `text` or `animation`; any other value is
rejected with the four accepted types named and no alias. The fields a Layer accepts are
conditional on `type::`. A `media` Layer declares `placement::` and `timing::`. A `text`
Layer declares `style::` and exactly one of `text::` or `text_from:: narration`. An `animation`
Layer carries an `asset::` pointing at an authored HyperFrames project. Appearance — colour,
typography, motion, shadow — comes from a Preset or from the named component, never from the
type.

### Methodologies

- Author each Layer as a nested `### NN Layer: <name>` heading immediately after the parent
  Scene prose body.
- Never place a Layer at Video level.
- Provide `asset` or `prompt` for `avatar` and `media`; `text` or `source` for `text`;
  `asset` for `animation`.
- Keep paint order in `z_index` when it matters.

### Prompts

- "Add a nested `### NN Layer:` with `type:: text`, `style:: lower-third` and `text:: <caption>`."
- "Add a `type:: media` Layer with `placement:: full` and `timing:: scene`."

## Preset

### Summary

A named bundle of cascade parameters, defined in a scope document or in the document.

### Description

One `## NN Preset: <name>` element carries only cascade parameters — `voice`, `voice_model`,
`voice_speed`, `voice_emotion`, `avatar`, `avatar_model`, `intro`, `image_model`,
`image_size`, `background_audio`, `background_audio_volume`, `transition`, `frame`, `fit`,
`components` and `sounds` — plus the global `tags` and its reserved `slug`. A Preset has no
fields of its own and owns no Layers. Presets are also how appearance reaches a `text` or
`media` Layer. An element references Presets with an ordered list of bare names,
`presets:: [Lucas, Studio Warm]`.

Lookup is one order for every reference: the document, then the Series chain from innermost
to outermost scope document, then the domain `video-defaults_NN.md`; the first match wins,
and a nearer definition shadows an outer one. Within a level the last Preset of the list
wins; an element's explicit fields always beat its own Presets.

### Methodologies

- Put provider and delivery configuration in a Preset, not copy-pasted into every Scene.
- Reference Presets by bare name; never write `[[…]]` or `::` inside the list.
- Remember that a Preset that omits a parameter does not reset it.

### Prompts

- "Define a `Preset` named `<name>` with `voice::` and `voice_model::`."
- "Add `presets:: [<name>]` to this Scene."

## Series

### Summary

A real series: the source of the `series` cascade level, and the only place that declares
the format's Scene Kinds and Chrome.

### Description

The episode's nearest ancestor holding a Series instance model — a `_NN.md` file with
frontmatter `scope: true`, canonically `<s>_coNNtent_NN.md` — is its series root. That
document supplies the `series` level of the Universal Parameter Cascade, the `Scene Kind`
elements, the `Chrome` elements (one per language) and the series-level `language`, `budget`
and `output_formats`. An episode outside a series folder (or a marker at the domain root)
has no `series` level. A series folder holds at most one Series document. Legacy markers
such as `series_NN.md` and the older `<s>_scope_NN.md` name anchor nothing and supply no
kinds.

### Methodologies

- Keep series-wide values in the Series document, not copy-pasted into every Scene.
- Declare every kind the series uses once, with its role and limits.
- Declare one Chrome element per language the series publishes in.
- Never treat the domain root as a series.

### Prompts

- "Create a `Series` named `<name>` with kinds `Gancho`, `Noticia`, `Cierre` and an `es` chrome."

## Scene Kind

### Summary

An element of the Series that states what one kind of scene is and which rules apply.

### Description

One `## NN Scene Kind: <name>` element declares `role`, `narration` (`on`/`off`),
`max_duration`, `fixed` (`none`, `first`, `last` or `after:<kind>`), the fixed
scene's `asset`, a `chrome` list and `presets`. A Scene Kind carries no other cascade
parameter: its only cascade contribution is its expanded `presets`. The series structure is
orientative — an episode may reorder, remove or repeat scenes of any kind. A kind whose
`fixed` is not `none` describes a scene the engine inserts; the episode does not declare it.
The reserved name `Libre` is not a kind element: it inherits no kind rules, no kind presets
and no kind chrome, and contributes no cascade node. Because chrome is applied by kind, a
`Libre` scene renders with no watermark, CTA, bumper or music; when the series discloses AI
use through its watermark, use a declared kind instead. The series declares every kind:
an episode never invents one, and `Libre` is the only escape hatch.

### Methodologies

- Give every kind a role; the role guides the agent, it is not an order.
- Set `narration:: off` for silent scenes (bumper, title card) so no TTS is requested.
- Use `fixed` for bumpers and outros instead of asking every episode to declare them.
- Keep `max_duration` realistic: with `narration:: on` the scene length is the narration
  length, and an `animation` Layer is trimmed or looped to it, never the reverse.

### Prompts

- "Declare a `Scene Kind` named `Intro` with `narration:: off`, `fixed:: first` and an `asset::`."
- "Cap the `Gancho` kind at twelve seconds."

## Chrome

### Summary

One element per language holding the series wallpaper applied by kind.

### Description

One `## NN Chrome: <language>` element declares `language` and any of `watermark`, `cta`,
`bumper` and `music`; its media resolve as logical names under `series/<s>/library/media/`. A kind's `chrome` list
names the items applied to its scenes. When a kind lists an item and no Chrome element for
the resolved language declares it, the run fails before spend naming the item and the
language.

### Methodologies

- Declare the chrome text once per language, not per episode.
- Keep the media in `series/<s>/library/media/`, never inside an episode.
- Remember that the episode's `language` selects the element.

### Prompts

- "Add a `Chrome` element for `es` with `watermark:: generado con IA` and a `bumper::`."

## Video Defaults

### Summary

The `Video Defaults` document: the `blueprint` and `domain` levels of the cascade.

### Description

One `## NN Video Defaults:` element carries every cascade parameter's baseline. The package
ships one at `defaults/video-defaults_NN.md` (the `blueprint` level). A domain MAY hold one
at its root as `video-defaults_NN.md` (the `domain` level); when absent the `domain` level is
skipped. The package instance declares no `budget` and no `language`: an unset budget always
asks at the budget gate and an unset language is a validation error. `daily_budget` is
settable only here. Changing the package instance MUST bump `blueprint_version`. A domain
copy MAY define Presets after its `Video Defaults` section.

### Methodologies

- Adopt the domain copy by copying the package document unchanged, then tune the copy.
- Never hardcode a default in engine code; it lives here.
- Never add a `budget` or `language` default to the package instance.

### Prompts

- "Copy the package `defaults/video-defaults_NN.md` to the domain root and tune it."
- "Declare `language:: es` and `budget:: 1.5` in the domaiNN copy."

## Provider

### Summary

A provider the catalog can call, with the base URL of its API.

### Description

One `## NN Provider: <name>` element declares `name` and `api_base`. Providers exist so a
`Model` names the service it belongs to without repeating a URL per model.

### Methodologies

- Declare each provider once in the catalog, or in the domaiNN overlay when the provider is new.
- Never put credentials in the catalog; they live in the environment.

### Prompts

- "Add a `Provider` named `WaveSpeed` with `api_base:: https://api.wavespeed.ai`."

## Model

### Summary

One callable model: capability, declared controls, adapter and price.

### Description

One `## NN Model: <slug>` element declares `provider`, `api_id`, `capability`
(`tts`/`image`/`avatar`/`video`), `controls`, `sizes` (image models), `adapter`, `price`,
`price_unit`, `price_date` and `status`. The domaiNN overlay declares the same element with
`allowed`, an invoice `price`, `price_date` and `price_source:: invoice`; merging is per
Model slug and the overlay wins. A Model defined only in the overlay must declare every
field and name an existing adapter. Capability is declared, never inferred from the id.

### Methodologies

- Ship reference prices with their date; never hide a price in code.
- Declare the controls the model really supports; an undeclared control fails at estimate.
- Override prices in the domaiNN overlay with invoice values, not in the reference catalog.

### Prompts

- "Add a `Model` named `wavespeed-ai/z-image/turbo` with `capability:: image` and its price."
- "Override the invoice price of `<model>` in the domaiNN overlay."

## Voice

### Summary

A provider voice the catalog can resolve by name for a language.

### Description

One `## NN Voice: <name>` element declares `model` (the TTS Model slug), `voice_id` and
`language`. A document references a voice by name through the `voice::` cascade field.

### Methodologies

- Declare one Voice per provider voice id and language.
- Never paste a provider voice id into a document; reference the Voice name.

### Prompts

- "Add a `Voice` named `lucas-es` with `model:: minimax/speech-2.8-hd` and `language:: es`."
