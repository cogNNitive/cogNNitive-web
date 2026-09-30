# Proposal: Integrate cogNNitive Video Engine

## Intent

Absorb VidGeNN core rendering and media synthesis capabilities into cogNNitive as first-class 'cogNNitive Video' tools and procedures. This eliminates external Tauri desktop app / manual UI form friction by replacing them with conversational AI workflows and programmatic Remotion rendering directly orchestrated by cogNNitive.

## Scope

### In Scope

- **Remotion Scene Compilation & Rendering**: Port VidGeNN's `RemotionSceneCompiler` and rendering pipeline into modular cogNNitive Video CLI/tooling.
- **Media & TTS Generation Services**: Integrate text-to-speech (TTS) and media asset generation scripts with deterministic content-hash caching.
- **Template Procedures Migration**: Update video template procedures (migrating `generate_anydeo_script_NN.md` to `generate_video_script_NN.md`) to invoke internal cogNNitive Video tools rather than relying on external desktop software.
- **Rebranding & Vocabulary Alignment**: Unify naming conventions across skills, templates, and specs by replacing legacy VidGeNN / Anydeo references with `cogNNitive Video`.
- **Automated Verification**: Add tests verifying scene composition, TTS caching, and render tool execution.

### Out of Scope

- Tauri desktop application shell, Rust backend binaries, and client UI forms/sliders.
- Real-time video preview UI inside the web console.
- Third-party cloud hosting infrastructure for video streaming.

## Capabilities

### New Capabilities

- `cognnitive-video-engine`: CLI tooling and programmatic Remotion pipeline for scene compilation, TTS synthesis, asset caching, and video rendering.

### Modified Capabilities

- `video-template`: Updated video production hierarchy, skills, and procedures referencing cogNNitive Video tooling instead of external VidGeNN/Anydeo desktop tooling.

## Affected Areas

- `skills/nn-video-script/` and associated video generation scripts/tools.
- `iNNfo/specs/templates/video/` procedures and templates.
- `openspec/specs/` video-related specs and documentation references.

## Risks & Mitigation

- **Rendering Performance / Node Dependencies**: Remotion bundling and rendering require ffmpeg and Node.js dependencies. *Mitigation*: Bundle headless CLI scripts with clear preflight dependency checks.
- **Breaking Legacy Script Workflows**: Changing procedure names or command signatures. *Mitigation*: Provide procedure redirects / clear deprecation mapping from `generate_anydeo_script_NN.md` to `generate_video_script_NN.md`.

## Rollback Plan

Revert the change branch/commit, restoring the legacy `generate_anydeo_script_NN.md` procedure and removing the `cognnitive-video-engine` tool packages.

## Success Criteria

1. `generate_video_script_NN.md` executes end-to-end video synthesis via cogNNitive Video tools without external desktop app dependencies.
2. Programmatic Remotion scene compilation renders valid MP4 videos with synchronized TTS audio and deterministic asset caching.
3. All references to VidGeNN / Anydeo in active video template skills and procedures are cleanly updated to cogNNitive Video.
