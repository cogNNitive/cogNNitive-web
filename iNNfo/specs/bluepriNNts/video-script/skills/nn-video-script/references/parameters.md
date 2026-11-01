<!-- GENERATED from spec_NN.md by scripts/generate-video-parameters-doc.mjs. Do not edit by hand. -->

# Video Script Parameter Reference

Every Field the `video-script` blueprint defines, and the scopes where it can be written.
The authoritative definition is `spec_NN.md`; this page is its generated rendering.

## How scopes resolve

A parameter marked on several scopes is a **cascade parameter**: the nearest scope that sets it wins.

```text
cli > layer > scene > video > series > domain > blueprint
```

- **Defaults** is `video-defaults_NN.md`: the `domain` level, with the package copy as the `blueprint` level.
- **Series** is the episode's nearest `*_scope_NN.md`.
- **Preset** is a named bundle of cascade parameters. A `presets` list is written at Defaults, Series, Video or Scene (never on a Layer) and expands directly under that level, so a Preset beats the outer levels but never the explicit fields of the element that names it.
- A Preset column mark means the Field can be set inside a Preset.

Legend: ● can be written at this scope, · cannot.

## Parameters by scope

| Parameter | Type | Values | Defaults | Series | Preset | Video | Scene | Layer |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `tags` | select (multi) | — | ● | ● | ● | ● | ● | ● |
| `title` | string | — | · | ● | · | ● | · | · |
| `description` | markdown_inline | — | · | · | · | ● | · | · |
| `status` | select | `draft`, `scripting`, `rendering`, `published`, `archived` | · | · | · | ● | · | · |
| `script` | file | — | · | · | · | ● | · | · |
| `master` | video | — | · | · | · | ● | · | · |
| `thumbnail` | image | — | · | · | · | ● | · | · |
| `presets` | select (multi) | — | ● | ● | · | ● | ● | · |
| `background_audio` | file | — | ● | ● | ● | ● | ● | · |
| `background_audio_volume` | string | — | ● | ● | ● | ● | ● | · |
| `transition` | select | `fade`, `slide-left`, `slide-right`, `wipe`, `none` | ● | ● | ● | ● | ● | · |
| `frame` | string | — | ● | ● | ● | ● | ● | · |
| `components` | select (multi) | — | ● | ● | ● | ● | · | · |
| `sounds` | select (multi) | — | ● | ● | ● | ● | · | · |
| `avatar` | file | — | ● | ● | ● | ● | ● | · |
| `intro` | file | — | ● | ● | ● | ● | · | · |
| `type` | select | `presenter`, `background`, `b-roll`, `title`, `lower-third`, `caption`, `brand`, `quote`, `watermark`, `animation` | · | · | · | · | · | ● |
| `asset` | file | — | · | · | · | · | · | ● |
| `prompt` | string | — | · | · | · | · | · | ● |
| `text` | markdown_inline | — | · | · | · | · | · | ● |
| `position` | select | `top`, `center`, `bottom`, `bottom-left`, `bottom-right` | · | · | · | · | · | ● |
| `enter_animation` | string | — | · | · | · | · | · | ● |
| `exit_animation` | string | — | · | · | · | · | · | ● |
| `z_index` | string | — | · | · | · | · | · | ● |
| `avatar_model` | string | — | ● | ● | ● | ● | ● | ● |
| `avatar_resolution` | select | `480p`, `720p`, `768p` | · | · | · | · | · | ● |
| `fit` | select | `cover`, `contain` | ● | ● | ● | ● | ● | ● |
| `voice` | string | — | ● | ● | ● | ● | ● | · |
| `voice_model` | string | — | ● | ● | ● | ● | ● | · |
| `voice_speed` | string | — | ● | ● | ● | ● | ● | · |
| `voice_emotion` | string | — | ● | ● | ● | ● | ● | · |
| `voice_tone` | string | — | ● | ● | ● | ● | ● | · |
| `master_resolution` | select | `1920x1920` | ● | · | · | · | · | · |
| `image_model` | string | — | ● | ● | ● | ● | ● | · |

## Required by Layer type

A Layer's `type::` decides which Fields it needs. At least one of the listed Fields must be present; a cascade parameter is satisfied by its resolved value.

| `type::` | Needs at least one of |
|---|---|
| `presenter` | `asset`, `prompt`, `avatar` |
| `background` | `asset`, `prompt` |
| `b-roll` | `asset`, `prompt` |
| `title` | `text` |
| `lower-third` | `text` |
| `quote` | `text` |
| `caption` | `text` |
| `brand` | `asset` |
| `watermark` | `text` |
| `animation` | `asset` |

## Parameter details

### `tags`

Open vocabulary ad-hoc tags and classification labels.

Settable at: every scope.

### `title`

Human title of the Video or the Series. The engine derives the manifest compositionId from the Video's title.

Settable at: `Video`, `Series`.

### `description`

What the episode is about, in one or two sentences.

Settable at: `Video`.

### `status`

Lifecycle position of the episode.

Settable at: `Video`.

### `script`

The episode's script document, resolved under the owning model's directory.

Settable at: `Video`.

### `master`

The episode's square master `<slug>_1920x1920.mp4`. Delivery formats are derived by `render-formats` and never modeled.

Settable at: `Video`.

### `thumbnail`

The episode's cover image, resolved under the owning model's directory.

Settable at: `Video`.

### `presets`

Ordered list of Preset names that apply at this level, written as bare names such as `[Lucas, Studio Warm]` (no reference brackets). Each level's list sits directly under that level's explicit fields: the last Preset of a list wins, a level's explicit fields beat its own Presets, and lists are additive across levels. Optional.

Settable at: `Video`, `Scene`, `Series`, `Video Defaults`.

### `background_audio`

Background audio file for the Scene. Settable at Video, Scene, Preset, Series and Video Defaults through the Universal Parameter Cascade. Background audio is a Field and MUST NOT be modeled as a Layer.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `background_audio_volume`

Volume for the resolved `background_audio::` track (a number 0–1, e.g. `0.1`). Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `transition`

Transition into the Scene. Resolves through the Universal Parameter Cascade. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `frame`

Name of the frame document (`frames/<name>.md`) whose tokens style this Video, Scene, Series or domain. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `components`

Keyed list of slot→component-name bindings (`slot=name`, e.g. `[lower-third=pill]`). Resolves per key through the Universal Parameter Cascade. Engine code names no component.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `sounds`

Keyed list of engine-event→sound-name bindings (`event=name`, e.g. `[scene-boundary=whoosh]`). Resolves per key through the Universal Parameter Cascade. Engine code names no sound.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `avatar`

Image used as the presenter's source for a Scene whose presenter Layer declares no `asset::`. Resolves through the Universal Parameter Cascade, so it is settable at Video, Scene, Preset, Series and Video Defaults. Optional.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `intro`

Intro media reused by the episode's fixed first Scene. Resolves through the Universal Parameter Cascade. Optional; per episode, so not a Scene field.

Settable at: `Video`, `Preset`, `Series`, `Video Defaults`.

### `type`

Required Layer discriminator. Allowed fields are conditional on this value. `watermark` renders a small persistent text notice (e.g. an AI-disclosure line). `animation` mounts an authored HyperFrames project as a sub-composition.

Settable at: `Layer`.

### `asset`

Source media file for a Layer (image or video), or the directory of an authored HyperFrames project for an `animation` Layer. Required for presenter, background, brand, b-roll, and animation.

Settable at: `Layer`.

### `prompt`

Media-synthesis prompt used when a Layer has no asset. Used by presenter, background, and b-roll.

Settable at: `Layer`.

### `text`

Inline text for a Layer. Required for title, lower-third, quote, and caption.

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

Avatar/lip-sync model id for a `presenter` Layer, or a cascade default (e.g. `wavespeed-ai/infinitetalk-fast`). Resolves through the Universal Parameter Cascade.

Settable at: `Layer`, `Scene`, `Video`, `Preset`, `Series`, `Video Defaults`.

### `avatar_resolution`

Optional output resolution for a `presenter` avatar clip. The engine validates it against the model (Pruna accepts 480p/768p; InfiniTalk also 720p) and falls back to a model-appropriate default. Ignored by other Layer types.

Settable at: `Layer`.

### `fit`

How a media Layer (background, b-roll) fits its box. `cover` fills and crops; `contain` shows the whole asset with margins. Resolves through the Universal Parameter Cascade; when no level sets it the blueprint Video Defaults value applies.

Settable at: `Layer`, `Scene`, `Video`, `Preset`, `Series`, `Video Defaults`.

### `voice`

Registered voice name or system voice used for TTS synthesis. Resolves through the Universal Parameter Cascade; a Preset supplies it unless a nearer level sets it. Part of the synthesized-audio cache identity.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_model`

Provider model id used for TTS synthesis (e.g. `minimax/speech-2.8-hd`). Resolves through the Universal Parameter Cascade. Part of the synthesized-audio cache identity.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_speed`

Playback rate the provider synthesizes the narration at (a number, e.g. `1.1` for 10% faster). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_emotion`

Delivery the provider synthesizes the narration with (e.g. `happy`, `neutral`). Optional; when no level declares it the provider default applies and the value stays out of the cache key. Part of the synthesized-audio cache identity, so changing it re-synthesizes.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `voice_tone`

Free-form tone guidance for the author and the review console (e.g. `warm`, `authoritative`). Authoring guidance only: the engine never sends it to a provider, so it is not part of the cache key and never changes the synthesized audio.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.

### `master_resolution`

Pixel size of the single rendered master. Every delivery format is derived from it; no format is rendered on its own.

Settable at: `Video Defaults`.

### `image_model`

Provider model id used to synthesize image assets (e.g. `wavespeed-ai/z-image/turbo`). Resolves through the Universal Parameter Cascade.

Settable at: `Video`, `Scene`, `Preset`, `Series`, `Video Defaults`.
