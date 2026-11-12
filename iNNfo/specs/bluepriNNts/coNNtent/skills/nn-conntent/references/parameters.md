<!-- GENERATED from spec_NN.md by scripts/generate-video-parameters-doc.mjs. Do not edit by hand. -->

# Video Script Parameter Reference

Every Field the `coNNtent` blueprint defines, and the scopes where it can be written.
The authoritative definition is `spec_NN.md`; this page is its generated rendering.

## How scopes resolve

A parameter marked on several scopes is a **cascade parameter**: the nearest scope that sets it wins.

```text
layer > scene > video > kind > series > domain > blueprint
```

- **Defaults** is `video-defaults_NN.md`: the `domain` level, with the package copy as the `blueprint` level.
- **Series** is the episode's nearest `*_series_NN.md` (frontmatter `scope: true`).
- **Kind** is the `Scene Kind` element named by the scene's `kind::`; a `Libre` scene has no kind level.
- **Preset** is a named bundle of cascade parameters. A `presets` list is written at Defaults, Series, Scene Kind, Video or Scene (never on a Layer) and expands directly under that level, so a Preset beats the outer levels but never the explicit fields of the element that names it.
- A Preset column mark means the Field can be set inside a Preset.

Legend: ● can be written at this scope, · cannot.

## Parameters by scope

| Parameter | Type | Values | Defaults | Series | Kind | Preset | Video | Scene | Layer | Variant | Chrome | Provider | Model | Voice |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `tags` | select (multi) | — | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| `title` | string | — | · | ● | · | · | ● | · | · | · | · | · | · | · |
| `description` | markdown_inline | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `status` | select | `idea`, `draft`, `approved`, `produced`, `failed_qa`, `delivered`, `archived` | · | · | · | · | ● | · | · | · | · | · | · | · |
| `script` | file | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `master` | video | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `delivered_version` | string | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `thumbnail` | image | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `translation_of` | string | — | · | · | · | · | ● | · | · | · | · | · | · | · |
| `kind` | select | — | · | · | · | · | · | ● | · | · | · | · | · | · |
| `review` | select | `approved`, `needs-change` | · | · | · | · | · | ● | · | · | · | · | · | · |
| `role` | string | — | · | · | ● | · | · | · | · | · | · | · | · | · |
| `narration` | select | `on`, `off` | · | · | ● | · | · | · | · | · | · | · | · | · |
| `max_duration` | number | — | · | · | ● | · | · | · | · | · | · | · | · | · |
| `fixed` | string | — | · | · | ● | · | · | · | · | · | · | · | · | · |
| `chrome` | select (multi) | `watermark`, `cta`, `bumper`, `music` | · | · | ● | · | · | · | · | · | · | · | · | · |
| `watermark` | markdown_inline | — | · | · | · | · | · | · | · | · | ● | · | · | · |
| `cta` | markdown_inline | — | · | · | · | · | · | · | · | · | ● | · | · | · |
| `bumper` | file | — | · | · | · | · | · | · | · | · | ● | · | · | · |
| `music` | file | — | · | · | · | · | · | · | · | · | ● | · | · | · |
| `presets` | select (multi) | — | ● | ● | ● | · | ● | ● | · | · | · | · | · | · |
| `background_audio` | file | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `background_audio_volume` | number | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `transition` | select | `fade`, `slide-left`, `slide-right`, `wipe`, `none` | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `frame` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `components` | select (multi) | — | ● | ● | · | ● | ● | · | · | · | · | · | · | · |
| `sounds` | select (multi) | — | ● | ● | · | ● | ● | · | · | · | · | · | · | · |
| `avatar` | file | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `character` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `pose` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `background` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `intro` | file | — | ● | ● | · | ● | ● | · | · | · | · | · | · | · |
| `type` | select | `avatar`, `media`, `text`, `animation` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `placement` | select | `full`, `inset` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `timing` | select | `scene`, `slot` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `style` | select | `title`, `lower-third`, `caption`, `watermark`, `quote` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `text_from` | select | `narration` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `asset` | file | — | · | · | ● | · | · | · | ● | · | · | · | · | · |
| `prompt` | string | — | · | · | · | · | · | · | ● | · | · | · | · | · |
| `text` | markdown_inline | — | · | · | · | · | · | · | ● | · | · | · | · | · |
| `position` | select | `top`, `center`, `bottom`, `bottom-left`, `bottom-right` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `enter_animation` | string | — | · | · | · | · | · | · | ● | · | · | · | · | · |
| `exit_animation` | string | — | · | · | · | · | · | · | ● | · | · | · | · | · |
| `z_index` | string | — | · | · | · | · | · | · | ● | · | · | · | · | · |
| `avatar_model` | string | — | ● | ● | · | ● | ● | ● | ● | · | · | · | · | · |
| `avatar_resolution` | select | `480p`, `720p`, `768p` | · | · | · | · | · | · | ● | · | · | · | · | · |
| `fit` | select | `cover`, `contain` | ● | ● | · | ● | ● | ● | ● | · | · | · | · | · |
| `voice` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `voice_model` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `voice_speed` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `voice_emotion` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `image_model` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `image_size` | string | — | ● | ● | · | ● | ● | ● | · | · | · | · | · | · |
| `language` | string | — | ● | ● | · | · | ● | · | · | · | ● | · | · | · |
| `budget` | number | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `daily_budget` | number | — | ● | · | · | · | · | · | · | · | · | · | · | · |
| `output_formats` | select (multi) | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `review_gates` | select (multi) | `script`, `preview` | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `captions` | select | `off`, `words`, `lines` | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `caption_model` | string | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `thumbnail_formats` | select (multi) | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `thumbnail_base` | file | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `thumbnail_title` | string | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `thumbnail_badge` | string | — | ● | ● | · | · | ● | · | · | · | · | · | · | · |
| `name` | string | — | · | · | · | · | · | · | · | · | · | ● | · | · |
| `api_base` | url | — | · | · | · | · | · | · | · | · | · | ● | · | · |
| `provider` | string | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `api_id` | string | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `capability` | select | `tts`, `image`, `avatar`, `video` | · | · | · | · | · | · | · | · | · | · | ● | · |
| `controls` | select (multi) | `speed`, `emotion`, `size`, `resolution` | · | · | · | · | · | · | · | · | · | · | ● | · |
| `sizes` | select (multi) | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `adapter` | string | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `price` | number | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `price_unit` | select | `per_1k_chars`, `per_image`, `per_second` | · | · | · | · | · | · | · | · | · | · | ● | · |
| `price_date` | string | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `price_source` | select | `blueprint`, `invoice` | · | · | · | · | · | · | · | · | · | · | ● | · |
| `stale_after_days` | number | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `allowed` | boolean | — | · | · | · | · | · | · | · | · | · | · | ● | · |
| `voice_id` | string | — | · | · | · | · | · | · | · | · | · | · | · | ● |

## Required by Layer type

A Layer's `type::` decides which Fields it needs. At least one of the listed Fields must be present; a cascade parameter is satisfied by its resolved value.

| `type::` | Needs at least one of |
|---|---|
| `avatar` | `asset`, `prompt` |
| `media` | `asset`, `prompt` |
| `text` | `text`, `text_from` |
| `animation` | `asset` |

## Parameter details

### `tags`

Open vocabulary ad-hoc tags and classification labels.

Settable at: every scope.

### `title`

Human title of the Video or the Series. The engine derives the manifest compositionId from the Video's title.

Settable at: `Video`, `Series`.

### `description`

What the episode is about, in one or two sentences. The agent writes it as part of the proposed changeset.

Settable at: `Video`.

### `status`

Lifecycle position of the episode, written by the engine or the user through a changeset. `idea` carries a title and linked Sources only.

Settable at: `Video`.

### `script`

The episode's script document, resolved under the owning model's directory.

Settable at: `Video`.

### `master`

The episode's master `<slug>_<W>x<H>.mp4`, sized by the first entry of `output_formats`. Delivery formats are derived from it and never modeled.

Settable at: `Video`.

### `delivered_version`

The delivery version the engine last assembled (`v1`, `v2`, ...). Written by the engine together with `status:: delivered`.

Settable at: `Video`.

### `thumbnail`

The episode's cover image, resolved under the owning model's directory.

Settable at: `Video`.

### `translation_of`

For a translation episode, the slug of the original (`<slug>` in the same series, or `<series>/<slug>` across series). The original MUST exist, MUST NOT itself be a translation and MUST share the source; never points at itself. Video-only record field.

Settable at: `Video`.

### `kind`

Name of a Scene Kind declared by the Series, or the reserved value `Libre`. Required on every V_0-15-0 Scene; the engine validates it against the Series and offers no static options. A `Libre` scene takes no kind rules, presets or chrome, so it renders with no watermark, CTA, bumper or music.

Settable at: `Scene`.

### `review`

The reviewer's verdict on the scene. Every scene must be `approved` before the episode can reach `approved`; a reason is a changeset comment, never a field.

Settable at: `Scene`.

### `role`

Free-text role of the kind in the series format (for example `hook`, `news`, `wrap-up`). Orientative for the author, never enforced as an order.

Settable at: `Scene Kind`.

### `narration`

Whether scenes of this kind carry narration. With `on`, the measured narration sets the scene length and every `animation` Layer is trimmed or looped to it. `off` means no TTS request is made, a non-empty scene body is an error, and the scene takes its length from its media or animation.

Settable at: `Scene Kind`.

### `max_duration`

Maximum duration of a scene of this kind, in seconds. Compared with the estimate before spend and with the measured duration after TTS; an overrun is a warning, never a stop.

Settable at: `Scene Kind`.

### `fixed`

Placement of an engine-inserted scene: `none`, `first`, `last` or `after:<kind>` (after the first scene of that kind). The episode does not declare fixed scenes; the engine inserts them with the kind's `asset`.

Settable at: `Scene Kind`.

### `chrome`

Chrome items applied to every scene of this kind. Each item resolves from the `Chrome` element for the cascaded `language`.

Settable at: `Scene Kind`.

### `watermark`

Watermark text for this language, for example an AI-disclosure line.

Settable at: `Chrome`.

### `cta`

Call-to-action text for this language.

Settable at: `Chrome`.

### `bumper`

Series bumper media for this language, resolved as a logical name under `series/<s>/library/media/`.

Settable at: `Chrome`.

### `music`

Series music bed for this language, resolved as a logical name under `series/<s>/library/media/`. Retired on Scene and Preset, where `background_audio` is the only field.

Settable at: `Chrome`.

### `presets`

Ordered list of Preset names that apply at this level, written as bare names such as `[Lucas, Studio Warm]` (no reference brackets). Each level's list sits directly under that level's explicit fields: the last Preset of a list wins, a level's explicit fields beat its own Presets, and lists are additive across levels. Optional.

Settable at: `Video`, `Scene`, `Scene Kind`, `Series`, `Video Defaults`.

### `background_audio`

Background audio file for the Scene. Resolves through the Universal Parameter Cascade. Background audio is a Field and MUST NOT be modeled as a Layer.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `background_audio_volume`

Volume for the resolved `background_audio::` track (a number 0–1, e.g. `0.1`). Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `transition`

Transition into the Scene. Resolves through the Universal Parameter Cascade. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `frame`

Name of the frame folder (`library/frames/<name>/FRAME.md` at the episode, series, domain or package level) whose tokens style this Video, Scene, Series or domain. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `components`

Keyed list of slot→component-name bindings (`slot=name`, e.g. `[lower-third=pill]`). Resolves per key through the Universal Parameter Cascade. Engine code names no component.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `sounds`

Keyed list of engine-event→sound-name bindings (`event=name`, e.g. `[scene-boundary=whoosh]`). Resolves per key through the Universal Parameter Cascade. Engine code names no sound.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `avatar`

Image used as the source for an `avatar` Layer that declares no `asset::`. Resolves through the Universal Parameter Cascade. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `character`

Name of the active Character (a folder in `library/characters/` or `media/characters/`). Resolves through the Universal Parameter Cascade; a series sets its host, a scene can bring a guest. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `pose`

Avatar pose of the active Character: a file name in its `avatars/` without extension. Defaults to the Character's `default_pose`; requires an active `character`. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `background`

Background image of the active Character: a file name in its `backgrounds/` without extension. Defaults to the Character's `default_background`; requires an active `character`. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `intro`

Intro media reused by the episode's fixed first Scene. Resolves through the Universal Parameter Cascade. Optional; per episode, so not a Scene field.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `type`

Required Layer behaviour type. `avatar` is a lip-synced paid job; `media` is an image or a video; `text` is overlay text; `animation` mounts an authored HyperFrames project as a sub-composition. Appearance and visual components come from Presets, never from the type.

Settable at: `Layer`.

### `placement`

For a `media` Layer: `full` covers the frame, `inset` places it inside the safe area. Required on `media`.

Settable at: `Layer`.

### `timing`

For a `media` Layer: `scene` spans the whole scene, `slot` occupies an overlay slot. Required on `media`.

Settable at: `Layer`.

### `style`

For a `text` Layer: the visual component to render. The component implementation resolves by name (`components/<style>`, a folder `library/components/<style>/` or `media/components/<style>/`, episode → series → domain → skill fallback), so a Series can restyle it without a new type.

Settable at: `Layer`.

### `text_from`

For a `text` Layer: the reserved value `narration` renders the owning Scene's body prose. Mutually exclusive with `text`.

Settable at: `Layer`.

### `asset`

Source media file for a Layer (image or video), the directory of an authored HyperFrames project for an `animation` Layer, or the media of a fixed Scene Kind. One of `asset` or `prompt` is required for `avatar` and `media` Layers.

Settable at: `Layer`, `Scene Kind`.

### `prompt`

Media-synthesis prompt used when a Layer has no asset. One of `asset` or `prompt` is required for `avatar` and `media` Layers.

Settable at: `Layer`.

### `text`

Inline text for a `text` Layer. One of `text` or `source` is required.

Settable at: `Layer`.

### `position`

Overlay anchor inside the central safe square (the central 1080x1080 of the master).

Settable at: `Layer`.

### `enter_animation`

Enter motion of the Layer overlay. Optional.

Settable at: `Layer`.

### `exit_animation`

Exit motion of the Layer overlay. Optional.

Settable at: `Layer`.

### `z_index`

Paint order of the Layer as a numeric string (higher renders on top). Optional.

Settable at: `Layer`.

### `avatar_model`

Avatar/lip-sync model id for an `avatar` Layer, or a cascade default (e.g. `wavespeed-ai/infinitetalk-fast`). Resolves through the Universal Parameter Cascade. The console picklist offers the merged catalog's allowed avatar models by `api_id`.

Settable at: `Layer`, `Scene`, `Video`, `Preset`, `Series`, `Video Defaults`.

### `avatar_resolution`

Optional output resolution for an `avatar` clip. The engine validates it against the model's declared `controls` and falls back to a model-appropriate default. Ignored by other Layer types.

Settable at: `Layer`.

### `fit`

How a `media` Layer fits its box. `cover` fills and crops; `contain` shows the whole asset with margins. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Layer`, `Scene`, `Video`, `Preset`, `Series`, `Video Defaults`.

### `voice`

Registered voice name or system voice used for TTS synthesis. Resolves through the Universal Parameter Cascade; a Preset supplies it unless a nearer level sets it. Part of the synthesized-audio cache identity. The console picklist offers the merged catalog's Voices by slug.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_model`

Provider model id used for TTS synthesis (e.g. `minimax/speech-2.8-hd`). Resolves through the Universal Parameter Cascade. Part of the synthesized-audio cache identity. The console picklist offers the merged catalog's allowed tts models by `api_id`.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_speed`

Playback rate the provider synthesizes the narration at (a number, e.g. `1.1` for 10% faster). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_emotion`

Delivery the provider synthesizes the narration with (e.g. `happy`, `neutral`). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `image_model`

Provider model id used to synthesize image assets (e.g. `wavespeed-ai/z-image/turbo`). Resolves through the Universal Parameter Cascade. The console picklist offers the merged catalog's allowed image models by `api_id`.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `image_size`

Requested image size as `<W>x<H>`, validated against the resolved image Model's `sizes`. Part of the image cache key. Defaults to `1024x1024` in the blueprint Video Defaults.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `language`

Language code (for example `es`, `en`) driving voice selection, chrome text, narration rules and the description language. The blueprint ships no default: an unset language is a validation error.

Settable at: `Video`, `Series`, `Video Defaults`, `Chrome`.

### `budget`

Per-episode budget in the domaiNN's single currency. The blueprint ships no default: an unset budget always asks at the budget gate. An estimate within the budget is auto-approved.

Settable at: `Video`, `Series`, `Video Defaults`.

### `daily_budget`

Rolling 24-hour cap in the domaiNN's single currency. Settable only in a Video Defaults document (domain or blueprint level); the blueprint ships no default (no daily cap).

Settable at: `Video Defaults`.

### `output_formats`

Ordered list of delivery sizes as `<W>x<H>`. The first entry is the master size; the rest are derived from the master. Defaults to `[1920x1920, 1080x1920, 1920x1080, 1080x1080]`.

Settable at: `Video`, `Series`, `Video Defaults`.

### `review_gates`

The gates that stop the run before spend, in order. Defaults to `[script, preview]`. Replaces the retired single script-review flag.

Settable at: `Video`, `Series`, `Video Defaults`.

### `captions`

Caption mode: `off` produces no captions, `words` word-level timing, `lines` segment-level timing. Defaults to `off`.

Settable at: `Video`, `Series`, `Video Defaults`.

### `caption_model`

The transcript alignment model override. Defaults to the package model.

Settable at: `Video`, `Series`, `Video Defaults`.

### `thumbnail_formats`

Ordered thumbnail sizes as `<W>x<H>`. Defaults to `[2560x1440, 1080x1920]`.

Settable at: `Video`, `Series`, `Video Defaults`.

### `thumbnail_base`

A text-free clean composite used as the thumbnail base; defaults to the first scene still.

Settable at: `Video`, `Series`, `Video Defaults`.

### `thumbnail_title`

The title text drawn on the thumbnail; defaults to the Video `title`.

Settable at: `Video`, `Series`, `Video Defaults`.

### `thumbnail_badge`

An optional small badge drawn on the thumbnail; defaults to none.

Settable at: `Video`, `Series`, `Video Defaults`.

### `name`

Provider display name (for example `WaveSpeed`).

Settable at: `Provider`.

### `api_base`

Base URL the provider's API is called at.

Settable at: `Provider`.

### `provider`

Slug of the `Provider` element this Model belongs to.

Settable at: `Model`.

### `api_id`

Exact model id the provider expects in a request.

Settable at: `Model`.

### `capability`

What the Model produces. Capability is declared, never inferred from the id.

Settable at: `Model`.

### `controls`

Intent controls the Model declares. A non-default intent value for a control the Model does not declare fails at estimate, before any spend.

Settable at: `Model`.

### `sizes`

Image sizes the Model accepts, as `<W>x<H>` entries. `image_size` must be one of them.

Settable at: `Model`.

### `adapter`

Adapter id that translates intent fields into this provider's request parameters (`scripts/adapters/<id>.mjs`).

Settable at: `Model`.

### `price`

Unit price in the domaiNN's single currency, in the unit named by `price_unit`. Absent or unset blocks the run for an allowed model.

Settable at: `Model`.

### `price_unit`

Unit `price` is expressed in.

Settable at: `Model`.

### `price_date`

Date the price was observed (`YYYY-MM-DD`). Older than `stale_after_days` warns and never blocks.

Settable at: `Model`.

### `price_source`

Where the price came from. The domaiNN overlay sets `invoice` when it overrides the reference price.

Settable at: `Model`.

### `stale_after_days`

Days after `price_date` at which the price is considered stale. Defaults to 90.

Settable at: `Model`.

### `allowed`

Whether the domaiNN allows this Model. Declared in the domaiNN overlay; a model not allowed is refused before spend.

Settable at: `Model`.

### `voice_id`

The provider's own voice identifier, used verbatim in a TTS request.

Settable at: `Voice`.
