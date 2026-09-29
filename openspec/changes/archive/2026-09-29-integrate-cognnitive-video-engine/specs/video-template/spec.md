# Video Template Specification (cogNNitive Video Migration Delta)

## Purpose

Updates the `video-template` capability to migrate procedural workflows and naming conventions from legacy external desktop software (VidGeNN / Anydeo) to internal conversational and CLI tooling provided by `cogNNitive Video`.

## Requirements

### Requirement: Video Generation Procedure Migration

The video production template MUST provide the video generation procedure under the canonical name `generate_video_script_NN.md`. This procedure MUST instruct and orchestrate script authoring, asset synthesis, composition generation, and video rendering using internal `cogNNitive Video` CLI tools instead of external desktop applications. Legacy references to `generate_anydeo_script_NN.md` MUST be deprecated and redirected to `generate_video_script_NN.md`.

#### Scenario: Script-to-video workflow executed via cogNNitive Video CLI
- GIVEN a video project utilizing the `video` template
- WHEN the `generate_video_script_NN.md` procedure is executed
- THEN all asset generation, composition compilation, and rendering steps invoke cogNNitive Video CLI commands without prompting the user to open external desktop software

#### Scenario: Deprecated procedure references redirected
- GIVEN a template or user invocation referencing `generate_anydeo_script_NN.md`
- WHEN the procedure is resolved
- THEN the system redirects execution to `generate_video_script_NN.md` with a deprecation notice

---

### Requirement: Naming Rebranding

All video template definitions, procedure instructions, element metadata, and documentation MUST use `cogNNitive Video` as the canonical capability brand, replacing legacy identifiers `Anydeo` and `VidGeNN`.

#### Scenario: Verification of rebranded terminology across templates
- GIVEN video template files, skills, and procedure specifications
- WHEN inspected for legacy application branding
- THEN all active references reflect `cogNNitive Video` and no unmapped `Anydeo` or `VidGeNN` terms remain

#### Scenario: Script format and engine identification
- GIVEN generated video script artifacts and manifests
- WHEN inspected for generator engine metadata
- THEN the engine metadata identifies `cogNNitive Video` as the authoring and rendering system
