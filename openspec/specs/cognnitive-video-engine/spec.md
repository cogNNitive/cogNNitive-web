# cogNNitive Video Engine Specification

## Purpose

Defines the programmatic rendering and media synthesis engine (`cognnitive-video-engine`) embedded into cogNNitive. It provides headless Remotion scene compilation, deterministic TTS and media synthesis caching, and command-line video rendering capabilities, eliminating external desktop application dependencies.

## Requirements

### Requirement: Programmatic Remotion Scene Compilation

The system MUST provide a scene compiler that transforms VUS / markdown video scripts into a valid Remotion Composition Manifest. The compiler MUST generate frame-accurate sequence tracks, transitions, lower-thirds (`lowerThirds`), kinetic typography titles (`kineticTitles`), and concept callouts (`conceptCallouts`).

#### Scenario: Compile multi-scene VUS script into Remotion composition manifest
- GIVEN a valid VUS script containing narrative scenes and visual cues
- WHEN the scene compiler processes the script
- THEN it produces a structured Remotion composition manifest containing ordered scene sequences, audio track bindings, transition descriptors, and overlay timing intervals

#### Scenario: Visual overlay components compiled with precise frame timings
- GIVEN a script specifying lower thirds, kinetic titles, and concept callouts
- WHEN the scene compiler compiles the script into the manifest
- THEN every visual overlay element contains calculated start frame, duration in frames, and component configuration matching the script definitions

---

### Requirement: Deterministic Media & TTS Asset Synthesis

The system MUST provide an asset synthesis pipeline for TTS voice narration and media asset retrieval. The pipeline MUST compute a SHA-256 hash of the input text/parameters and cache synthesized audio and media files. If an asset corresponding to the SHA-256 hash exists in the cache, the system MUST reuse the cached asset and skip re-synthesis.

#### Scenario: Cache hit avoids redundant TTS synthesis
- GIVEN an existing cached TTS narration file matching the SHA-256 hash of the scene's text and voice settings
- WHEN asset synthesis is requested for the scene
- THEN the system retrieves the existing cached audio file without invoking the TTS synthesis engine

#### Scenario: New asset synthesized and stored with content-derived hash
- GIVEN scene narration text or parameters not present in the cache
- WHEN asset synthesis is executed
- THEN the system synthesizes the audio, writes the result to the cache keyed by its SHA-256 hash, and links it in the scene composition

---

### Requirement: Headless Video Rendering CLI

The system MUST provide headless CLI commands that invoke the Remotion bundler and renderer to produce a finalized MP4 video file and calculate the exact total video duration and frame metrics.

#### Scenario: Headless CLI renders MP4 master video
- GIVEN a compiled Remotion composition manifest and validated synthesized assets
- WHEN the video render CLI is executed with master output parameters
- THEN it compiles the bundle headlessly, renders the full composition to an MP4 video file, and logs total rendered frames and execution time

#### Scenario: Total duration calculation and validation
- GIVEN a completed render job
- WHEN the CLI outputs the render summary
- THEN the reported total duration exactly matches the composition timeline duration derived from the individual scene sequence timings

---

### Requirement: Interactive Provider Consultation and Cost Estimation

The system MUST provide an asset cost estimator and provider pricing catalog (`asset-cost-estimator.mjs`). Prior to asset synthesis, the engine MUST calculate per-scene character counts, image layer requirements, unit pricing for selected image providers (WaveSpeed AI, Replicate, Local) and voiceover providers (ElevenLabs, OpenAI, Windows SAPI / Edge-TTS), and present an itemized per-scene and total budget estimation table for user approval.

#### Scenario: Script parsed and estimated by scene
- GIVEN a validated video script
- WHEN `asset-cost-estimator.mjs` is executed
- THEN it outputs an itemized table with per-scene durations, image counts, character counts, unit rates, and grand total in USD ($)

#### Scenario: Comparison across quality tiers
- GIVEN a script cost estimation
- WHEN the cost plan is generated
- THEN it includes a side-by-side comparison across Budget, Professional Studio, Cinema, and Offline/Free tiers detailing tradeoffs and estimated total costs
