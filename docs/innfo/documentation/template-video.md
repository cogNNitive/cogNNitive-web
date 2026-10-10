# Video Script Blueprint

The **`video-script` blueprint** (`iNNfo/specs/bluepriNNts/video-script/spec_NN.md`) is the Level-2 schema for video scripting as native iNNfo knowledge. A video script is a Level-3 kNNowledge document that adopts this blueprint; there is no bespoke script format.

---

## 1. Model Hierarchy

The blueprint models production as a Concept hierarchy plus a top-level Template concept:

1. **Video** — the document root (exactly one per document; no versioning).
2. **Scene** — a child of Video. Its free-form **body prose is the narration**; there is no `narration` field.
3. **Layer** — a child of Scene, discriminated by its `type::` field (see §3).
4. **Template** — top-level; instances (tool, voice, model) live in the owning Series' Level-3 Template-data document and are referenced from a Scene via `template::`.

Order is list order: Scenes and Layers are compiled in the order they appear, with no declared `order::`/`index::` fields. Every element carries the reserved immutable `slug::` used to derive stable engine IDs.

---

## 2. Series

A Series is a blueprint that `includes: [video-script]` and adds only series-specific fields (for example `tone`, `sound_tags`), plus an L3 Template-data document that declares its `Template` instances. A script references a Template through a `template::` field:

```
template:: [[Series :: narrator-en]]
```

Voice and model are never declared inline in a script.

---

## 3. Layers and Overlays

Overlays are native Layer kinds, discriminated by `type::`. Text overlays carry their content in the Layer's `text::` field:

| `type::` | Rendered as |
|---|---|
| `presenter` | talking-avatar frame |
| `background` | scene background (image/video) |
| `b-roll` | B-Roll overlay |
| `title` | kinetic title |
| `lower-third` | lower-third overlay |
| `caption` | captions |
| `brand` | brand image layer |
| `quote` | quote overlay |

Ephemeral overlays (`quote`, `lower-third`, `b-roll`) are scheduled sequentially in list order, with configurable `enter_animation` / `exit_animation`.

---

## 4. Audio & Voice Synthesis

Narration prose (the Scene body) is synthesized via Text-to-Speech using the voice and model resolved from the Scene's `template::` instance. Timing is derived from the measured audio duration; a script never declares duration or timing.

Supported TTS providers:

| Provider | Model ID | Tier | Characteristics |
|---|---|---|---|
| **Replicate** | `replicate/minimax/speech-2.8-hd` | Cinematic | State-of-the-art prosody, rich vocal depth, high naturalism |
| **WaveSpeed** | `wavespeed/minimax/speech-2.5-hd-preview` | Fast Inference | Low-latency synthesis, emotional inflection support |

---

## 5. Digital Talking Avatars

A `presenter` Layer supplies a source portrait and synchronizes facial movement and lip gestures with the Scene's narration.

| Model ID | Provider | Tier | Description |
|---|---|---|---|
| `replicate/wan-2.1-s2v` | Replicate | Cinematic | Speech-to-video diffusion model delivering high photorealism and natural head movements. |
| `wavespeed/infinitetalk` | WaveSpeed | Performance | Ultra-fast inference with realistic lip-sync and configurable face scaling. |

---

## 6. Example Script Document

```markdown
# NN index
* [[Welcome Clip]]
  * [[Hook]]

# NN Video
## NN Video: Welcome Clip
slug:: welcome-clip
title:: Welcome Clip

# NN Scene
## NN Scene: Hook
slug:: hook
template:: [[Series :: narrator-en]]
music:: assets/theme.mp3

(the free-form prose body is the narration)

# NN Layer
## NN Layer: Narrator
slug:: narrator
type:: presenter
prompt:: talking avatar, medium shot
```

---

## 7. Benchmark Video Showcase

The sample video below demonstrates the audio clarity and facial lip-sync synchronization generated through the video-script pipeline across **Wan 2.1** and **InfiniteTalk** avatar engines:

<video width="100%" controls>
  <source src="assets/video_benchmark_sample.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
