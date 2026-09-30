---
name: nn-video-script
description: |
  iNNfo-native skill for authoring, compiling, and rendering cogNNitive Video scripts inside a workspace's Series/Video hierarchy. Supports Remotion scene compilation, deterministic SHA-256 asset caching, headless MP4 rendering, and thumbnail composition. Triggers: video script, cognnitive video, remotion video, series script, nn-video-script, {{slot}}, script_template.md, finalize video, render video script.
version: "V_0-2-0"
last_updated: 2026-09-29
license: MIT
vus_spec:
  version: "V_0-3-3"
  sha256: "d617aadcc85ad5816ca0b447e28032b14c1fc64bac65f550fa4149bd4f7cedda"
metadata:
  engine: "cogNNitive Video Engine"
  renderer: "Remotion Headless CLI"
---

# cogNNitive Video Script Engine Skill

Provides end-to-end video script authoring, deterministic TTS/media asset synthesis, Remotion scene compilation, and headless rendering for cogNNitive.

## 0. Activation Gate

Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check), same as every other cogNNitive skill.

## 1. Engine Architecture & Remotion Compilation

The video engine operates headlessly through programmatic modules:
- **Scene Compiler (`scripts/remotion-scene-compiler.mjs`)**: Compiles Markdown/VUS video scripts into frame-accurate Remotion Composition Manifests with sequence tracks, transitions, lower-thirds (`lowerThird`), kinetic titles (`kineticTitle`), and concept callouts (`conceptCallout`).
- **Deterministic Asset Cache (`scripts/cache-manager.mjs`)**: Content-addressed SHA-256 cache under `.cognnitive/cache/video/` with isolated subdirectories (`tts/`, `images/`, `temp/`).
- **Asset Synthesizer (`scripts/asset-synthesizer.mjs` / `scripts/tts-generator.mjs`)**: Synthesizes TTS voiceover tracks and image/motion assets, probing audio durations to guarantee zero audio clipping.
- **Video Engine CLI (`scripts/video-engine-cli.mjs`)**: Headless CLI providing `compile`, `render`, and `preview` commands.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, validating, compiling, rendering, and finalizing** one video's `script.md` inside a Series folder:

1. **Author** `script.md` from the Series' `script_template.md`, following the `{{slot}}` convention (`references/series-template-convention.md`) and syntax notes (`references/vus-authoring-notes.md`).
2. **Validate**:
   ```bash
   node scripts/check-script.mjs <script.md> --series-root <series-dir>
   ```
3. **Plan, Estimate & Consult Providers (Pre-Generation Gate)**:
   ```bash
   node scripts/asset-cost-estimator.mjs <script.md> --out assets/{video-slug}/asset_plan.md
   ```
   *Present provider options (WaveSpeed AI, Replicate, ElevenLabs, OpenAI, Local/Free), quality tiers, and itemized per-scene cost estimates to the user for explicit approval before proceeding.*
4. **Compile Composition & Synthesize Assets**:
   ```bash
   node scripts/video-engine-cli.mjs compile <script.md> --output renders/{ref}/manifest.json
   ```
5. **Render Master Video**:
   ```bash
   node scripts/video-engine-cli.mjs render renders/{ref}/manifest.json --output renders/{ref}/master.mp4
   ```
6. **Compose Video Thumbnail**:
   ```bash
   node scripts/render-thumbnail.mjs --base <path> --title <title> --out <out>
   ```
7. **Finalize**:
   ```bash
   node scripts/finalize-video.mjs --video-dir <video-dir> [--ref <r>] [--force-thumbnail]
   ```
8. **Closing Retrospective & Improvement Analysis**:
   After completing the script elaboration or rendering session, proactively prompt the user asking if they want to analyze the session's conversation to suggest concrete refinements for future episodes.

## 3. Tooling Reference

| Script | Purpose |
|---|---|
| `scripts/remotion-scene-compiler.mjs` | Compiles video scripts into Remotion composition manifests with calculated frame timings and overlay configs. |
| `scripts/cache-manager.mjs` | Deterministic SHA-256 asset cache manager under `.cognnitive/cache/video/`. |
| `scripts/asset-synthesizer.mjs` | Multi-provider TTS and media synthesis with audio duration probing and cache support. |
| `scripts/asset-cost-estimator.mjs` | Pre-generation provider options catalog, per-scene character/layer calculator, and production cost estimator. |
| `scripts/video-engine-cli.mjs` | Headless CLI for video compilation (`compile`), headless rendering (`render`), and local web preview (`preview`). |
| `scripts/check-script.mjs` | Zero-Unresolved-Placeholder Gate + No-Upward-Escape Rule. |
| `scripts/render-thumbnail.mjs` | Programmatic thumbnail compositor (SVG + Sharp) rendering high-contrast typography over clean 16:9 base images. |
| `scripts/finalize-video.mjs` | Promotes rendered `master`/`thumbnail`/`voiceover` out of `renders/<ref>/` into the video's own folder. |

Run any script with no arguments (or a bad one) to see its usage banner.
See `references/thumbnail-and-asset-pipeline.md` for visual preproduction guidelines.
