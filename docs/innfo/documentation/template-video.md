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
| `watermark` | persistent text notice (e.g. AI disclosure) |

Ephemeral overlays (`quote`, `lower-third`, `b-roll`) are scheduled sequentially in list order, with configurable `enter_animation` / `exit_animation`.

Optional per-element fields (documents that omit them behave exactly as before):

| Field | On | Effect |
|---|---|---|
| `model::` | `presenter` Layer | Avatar / lip-sync model id for that Layer (default model when absent). It does not affect the TTS cache key. |
| `fit::` | `b-roll` Layer | `cover` (default) fills and crops; `contain` shows the whole asset with a margin on a rounded card, with a gentle zoom-in. |
| `music_volume::` | Scene | Volume (0-1) of the Scene's `music::` track; the engine default applies when absent. |

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

---

## 8. Rendering Engine, Assembly & Licensing

The engine compiles a Level-3 script into a composition manifest and renders it headlessly to MP4. Audio duration is measured with `@remotion/media-parser`; synthesized assets are content-addressed (SHA-256) and cached.

### 8.1 Rendering engine

The renderer is **Remotion**, a third-party, source-available product.

- The user installs it on **their own account** via `scripts/ensure-engine.mjs` (an idempotent, consent-gated `npm install`). cogNNitive does **not** bundle, distribute, or host Remotion.
- **Licensing follows the user of Remotion**, not cogNNitive. Remotion is **free for individuals and organizations of up to 3 people — automation included**. Larger organizations building automations need a Company License.
- Review the terms before commercial use: <https://www.remotion.dev/docs/license>.

### 8.2 Final clip assembly

When some segments are produced outside Remotion (pass-through or externally rendered clips), `scripts/assemble-video.mjs` joins an ordered list of clips into one master with the FFmpeg concat demuxer in **stream-copy** mode (`-f concat -c copy`, `+faststart`).

- This is **assembly only**: no re-encode and **no scene effects**. FFmpeg scene effects (e.g. `zoompan`, burned-in `.ass` captions) are out of scope — they produce glitching and are not used.
- Clips must already share video codec, resolution, and frame rate. An `ffprobe` precheck refuses a mismatched set with a named error before ffmpeg runs.

### 8.3 Format variants from a square master

When the same episode must ship in several aspect ratios and crop-fill would cut the square composition, `scripts/render-formats.mjs` derives the variants from a square master in a single post-process (no re-render):

```bash
node scripts/render-formats.mjs --master renders/{ref}/master_1080x1080.mp4 [--out-dir renders/{ref}] [--formats square,vertical,horizontal]
```

- It emits `<slug>_1080x1080.mp4` (a stream copy of the master), `<slug>_1080x1920.mp4` (vertical) and `<slug>_1920x1080.mp4` (horizontal), named by their dimensions.
- Each non-square variant shows the square **whole**, centered, over a Gaussian-blurred fill of the source; the audio is copied untouched and every output is remuxed with `+faststart`.
- The step re-encodes only the variant video — it never touches the square master (a master already named `<slug>_1080x1080.mp4` skips the square copy rather than overwriting itself). Pass `--dry-run` to print the ffmpeg filter graphs without writing anything.
