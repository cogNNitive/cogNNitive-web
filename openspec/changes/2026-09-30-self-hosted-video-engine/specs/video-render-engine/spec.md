# Video Render Engine

## Purpose

Define the Node + FFmpeg engine that renders a validated Anydeo script plus its assets
into a `master` video inside the monorepo, replacing the external VidGeNN render step.

## Requirements

### Requirement: Internal Render Step

The video bluepriNNt's *Render Video* work MUST run inside the monorepo. No procedure,
skill, or tool entry MAY delegate rendering to an external engine.

#### Scenario: Render with no external engine
- GIVEN a registered, validated script
- WHEN rendering runs
- THEN `renders/{ref}/master.mp4` is produced
- AND no external renderer is invoked

### Requirement: Scene Planning

The engine MUST derive an ordered scene plan from the parsed AST, resolving every
file-backed layer to a path inside the video's own folder, and MUST reject any asset path
that escapes the series folder tree (the folder contract).

#### Scenario: Escape is rejected
- GIVEN a scene layer whose asset path climbs above the series folder
- WHEN planning runs
- THEN the engine fails and names the offending path

### Requirement: FFmpeg Composition

The engine MUST compose each scene with FFmpeg — image motion for effect layers
(`ken_burns`), text overlays for text layers, and layer compositing for avatar and video
layers — and MUST concatenate the scene clips into a single video track in script order.

#### Scenario: Background motion
- GIVEN a scene with a background image and `layer_effects: ken_burns`
- WHEN composed
- THEN the output clip shows continuous motion for the scene duration

#### Scenario: Ordered concat
- GIVEN scenes with video and image layers
- WHEN concatenated
- THEN the master plays every scene in script order

### Requirement: Audio Narration Muxing

The engine MUST synthesize per-scene narration through the scene's declared TTS model and
MUST mux it into a single audio track aligned to the scenes.

#### Scenario: Narration present in the master
- GIVEN scenes with narration text
- WHEN rendered
- THEN the master carries an audio track of non-zero duration

### Requirement: Provider Asset Ingestion

The engine MUST generate or fetch non-text assets (TTS audio, talking-avatar clips,
images) through the providers the script declares, honoring the declared model ids.

#### Scenario: Declared avatar model honored
- GIVEN a scene with `layer_avatar_model: wavespeed/infinitetalk`
- WHEN ingesting assets
- THEN the avatar clip is produced through that model

### Requirement: Rendered Master Artifact

The engine MUST write `master.mp4` under `renders/{ref}/` (ephemeral, gitignored) so the
existing finalize step can promote it into the video's own folder.

#### Scenario: Finalize consumes the render
- GIVEN a completed render
- WHEN `finalize-video.mjs --video-dir <dir>` runs
- THEN the master is copied into the video's own folder
