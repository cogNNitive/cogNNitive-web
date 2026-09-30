# Video App Template

The **Video App Template** (`iNNfo/specs/bluepriNNts/video/spec_NN.md`) provides a unified schema for video scripting, asset management, automated voiceover synthesis (TTS), and digital talking avatar rendering powered by cogNNitive-video VUS (`V_0-3-3`).

---

## 1. Production Hierarchy

The video template models production across 4 structured levels:

1. **Workspace** — The root containing global shared assets.
2. **Subject** — The domain content, sources, and factual citations (`sources::`).
3. **Series** — The recurring format (`<Series>_V_x-y-z_video_NN.md`), rules (`series_rules.md`), and template (`script_template.md`).
4. **Video** — Individual episodes binding one Subject with one Series.

---

## 2. Audio & Voice Selection (TTS)

Video voiceover narration is handled via Text-to-Speech (TTS) models through supported cloud providers (Replicate and WaveSpeed).

### Supported TTS Models

| Provider | Model ID | Tier | Characteristics |
|---|---|---|---|
| **Replicate** | `replicate/minimax/speech-2.8-hd` | Cinematic | State-of-the-art prosody, rich vocal depth, high naturalism |
| **WaveSpeed** | `wavespeed/minimax/speech-2.5-hd-preview` | Fast Inference | Low-latency synthesis, emotional inflection support |

### Common Voice IDs

| Voice ID | Profile & Style | Best For |
|---|---|---|
| `Deep_Voice_Man` (`English_Deep-VoicedGentleman`) | Deep, authoritative, solemn | Documentaries, historical retrospectives |
| `Friendly_Person` (`English_FriendlyPerson`) | Balanced, warm, conversational | Product tours, onboarding guides, tutorials |
| `Wise_Woman` (`English_Wiselady`) | Composed, deliberate, articulate | Educational lessons, masterclasses |
| `Casual_Guy` (`English_CasualGuy`) | Informal, energetic, approachable | Podcasts, quick summaries, shorts |
| `Professional_Woman` (`English_ProfessionalLady`) | Clean, clear, executive | Corporate briefs, technical documentation |

---

## 3. Digital Talking Avatars

Talking avatar layers take a source portrait (`layer_asset_source`) and synchronize facial movements and lip gestures with the scene's audio narration.

| Model ID | Provider | Tier | Description |
|---|---|---|---|
| `replicate/wan-2.1-s2v` | Replicate | Cinematic | Speech-to-video diffusion model delivering high photorealism and natural head movements. |
| `wavespeed/infinitetalk` | WaveSpeed | Performance | Ultra-fast inference with realistic lip-sync and configurable face scaling. |

### Example VUS Script Snippet

```markdown
@ Scene 01 - Product Intro
- scene_tts_model: replicate/minimax/speech-2.8-hd
- scene_voice: Friendly_Person
- scene_content: "Welcome to the cogNNitive video production workflow."

@@ Presenter Avatar
- layer_type: talking_avatar
- layer_avatar_model: wavespeed/infinitetalk
- layer_asset_source: ./assets/presenter.jpg
- layer_level: 10
```

---

## 4. Benchmark Video Showcase

The sample video below demonstrates the audio clarity and facial lip-sync synchronization generated using the Video template across **Deep Voice Man**, **Friendly Person**, **Wise Woman**, and the **Wan 2.1** and **InfiniteTalk** avatar engines:

<video width="100%" controls>
  <source src="assets/video_benchmark_sample.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
