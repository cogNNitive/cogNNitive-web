# Tasks: Integrate cogNNitive Video Engine

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,200 - 1,500 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (3 sequential PRs recommended or phased commits) |
| Delivery strategy | ask-on-risk |
| Chain strategy | Phase 1 & 2 (Engine Core & Cache) -> Phase 3 (Procedures & Rebranding) -> Phase 4 (Verification & Tests) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: Phase 1 & 2 (Engine Core & Cache) -> Phase 3 (Procedures & Rebranding) -> Phase 4 (Verification & Tests)
400-line budget risk: High

---

## Phase 1: Engine Foundation & Remotion Compilation

- [x] 1.1 **Remotion Scene Compiler Module (`skills/nn-video-script/scripts/remotion-scene-compiler.mjs`)**: Implement `RemotionSceneCompiler` class transforming parsed VUS/markdown script tokens into a typed `RemotionCompositionManifest` with sequence tracks, transitions, frame calculations ($\text{frames} = \lceil\text{durationInSeconds} \times \text{FPS}\rceil$), cumulative frame offsets, and metadata. `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`
- [x] 1.2 **Visual Overlay Component Compilers (`skills/nn-video-script/scripts/remotion-scene-compiler.mjs`)**: Implement overlay generator helpers for `lowerThird`, `kineticTitle`, and `conceptCallout` tracks, calculating frame offsets, duration, styling themes, and component props. `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`
- [x] 1.3 **Video Engine CLI Core & Bundler (`skills/nn-video-script/scripts/video-engine-cli.mjs`)**: Implement headless CLI commands (`compile`, `render`, `preview`) integrating `@remotion/bundler` and `@remotion/renderer` to bundle Remotion compositions headlessly and emit MP4 files with execution summaries. `[cognnitive-video-engine:Requirement:Headless Video Rendering CLI]`
- [x] 1.4 **Pipeline Finalizer Update (`skills/nn-video-script/scripts/finalize-video.mjs`)**: Refactor `finalize-video.mjs` to invoke the internal `video-engine-cli.mjs` compiler and renderer instead of external desktop dependencies. `[cognnitive-video-engine:Requirement:Headless Video Rendering CLI]`

## Phase 2: Media Asset Synthesis & TTS Caching

- [x] 2.1 **Deterministic Cache Manager (`skills/nn-video-script/scripts/cache-manager.mjs`)**: Implement `CacheManager` with SHA-256 hash generation on normalized prompts/text, cache hit/miss queries, file persistence under `.cognnitive/cache/video/`, and subdirectory isolation (`tts/`, `images/`, `temp/`). `[cognnitive-video-engine:Requirement:Deterministic Media & TTS Asset Synthesis]`
- [x] 2.2 **TTS Audio Synthesis Integration (`skills/nn-video-script/scripts/asset-synthesizer.mjs`)**: Implement `AssetSynthesizer.synthesizeTTS` with cache-first lookup, ElevenLabs / Edge-TTS provider adapters, audio duration measurement via ffmpeg/ffprobe, and SHA-256 cache storage. `[cognnitive-video-engine:Requirement:Deterministic Media & TTS Asset Synthesis]`
- [x] 2.3 **Media & Motion Asset Fetcher (`skills/nn-video-script/scripts/asset-synthesizer.mjs`)**: Implement `AssetSynthesizer.resolveMedia` for image and motion background asset synthesis (Replicate / local provider fallback) with SHA-256 caching and aspect-ratio validation. `[cognnitive-video-engine:Requirement:Deterministic Media & TTS Asset Synthesis]`
- [x] 2.4 **Duration Measurement & Timeline Alignment**: Integrate audio duration probing with Remotion timeline frames calculation to guarantee zero audio clipping and automatic scene duration synchronization. `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`

## Phase 3: Template Procedures & Rebranding Migration

- [x] 3.1 **Canonical Video Generation Procedure (`iNNfo/specs/templates/video/procedures/generate_video_script_NN.md`)**: Create `generate_video_script_NN.md` as the canonical procedure defining conversational script authoring, asset synthesis, Remotion compilation, and headless rendering using `video-engine-cli.mjs`. `[video-template:Requirement:Video Generation Procedure Migration]`
- [x] 3.2 **Legacy Procedure Deprecation & Redirect (`iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md`)**: Refactor `generate_anydeo_script_NN.md` into a deprecation redirect pointing users and agent workflows directly to `generate_video_script_NN.md`. `[video-template:Requirement:Video Generation Procedure Migration]`
- [x] 3.3 **Video Template Specification Update (`iNNfo/specs/templates/video/spec_NN.md`)**: Update `spec_NN.md` to replace all references to VidGeNN / Anydeo with `cogNNitive Video`, document Remotion scene types, manifest contracts, and procedure mappings. `[video-template:Requirement:Naming Rebranding]`
- [x] 3.4 **Skill Rebranding & CLI Documentation (`skills/nn-video-script/SKILL.md`)**: Rebrand `SKILL.md` to `cogNNitive Video Script Engine`, document CLI commands (`compile`, `render`, `preview`), and remove legacy desktop app instructions. `[video-template:Requirement:Naming Rebranding]`

## Phase 4: Verification & Automated Tests

- [x] 4.1 **Remotion Scene Compiler Unit Tests (`skills/nn-video-script/test/scene-compiler.test.mjs`)**: Implement test suite verifying VUS-to-manifest compilation, accurate frame math, timeline continuity, overlay frame offsets, and error handling for invalid scene types. `[cognnitive-video-engine:Requirement:Programmatic Remotion Scene Compilation]`
- [x] 4.2 **Cache Manager & Hash Determinism Tests (`skills/nn-video-script/test/cache-manager.test.mjs`)**: Implement test suite verifying SHA-256 hash consistency across runs, cache hit avoidance of re-synthesis, cache misses, and directory isolation. `[cognnitive-video-engine:Requirement:Deterministic Media & TTS Asset Synthesis]`
- [x] 4.3 **Video Engine CLI & Render Integration Tests (`skills/nn-video-script/test/video-engine-cli.test.mjs`)**: Test CLI execution for `compile` and `render` commands on mock/sample scripts, validating output manifest structure, summary metrics, and MP4 generation. `[cognnitive-video-engine:Requirement:Headless Video Rendering CLI]`
- [x] 4.4 **Rebranding & Procedure Regression Scan**: Create automated test/lint asserting zero active occurrences of `Anydeo` or `VidGeNN` across active template procedures and verifying procedure redirection. `[video-template:Requirement:Naming Rebranding]`
