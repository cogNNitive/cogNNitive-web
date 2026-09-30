# Video Template Specification (cogNNitive Video Migration Delta)

## Purpose

Updates the `video-template` capability to migrate procedural workflows and naming conventions from legacy external desktop software to internal conversational and CLI tooling provided by `cogNNitive Video`.

## Requirements

### Requirement: Video Generation Procedure Migration

The video production template MUST provide the video generation procedure under the canonical name `generate_video_script_NN.md`. This procedure MUST instruct and orchestrate script authoring, asset synthesis, composition generation, and video rendering using internal `cogNNitive Video` CLI tools instead of external desktop applications. The template MUST NOT ship any deprecated redirect procedure alongside it.

#### Scenario: Script-to-video workflow executed via cogNNitive Video CLI
- GIVEN a video project utilizing the `video` template
- WHEN the `generate_video_script_NN.md` procedure is executed
- THEN all asset generation, composition compilation, and rendering steps invoke cogNNitive Video CLI commands without prompting the user to open external desktop software

#### Scenario: No deprecated procedure is shipped
- GIVEN the video template's `procedures` list
- WHEN it is inspected
- THEN `generate-video-script` is the only script-generation procedure and no entry is marked deprecated

---

### Requirement: Naming Rebranding

All video template definitions, procedure instructions, element metadata, and documentation MUST use `cogNNitive Video` as the canonical capability brand, replacing the retired external product names.

#### Scenario: Verification of rebranded terminology across templates
- GIVEN video template files, skills, and procedure specifications
- WHEN inspected for legacy application branding
- THEN all active references reflect `cogNNitive Video` and no retired external product name remains (enforced by `scripts/lib/brand-purge-guard.js`)

#### Scenario: Script format and engine identification
- GIVEN generated video script artifacts and manifests
- WHEN inspected for generator engine metadata
- THEN the engine metadata identifies `cogNNitive Video` as the authoring and rendering system

---

### Requirement: Interactive Provider Consultation and Cost Gate

The `generate_video_script_NN.md` procedure MUST enforce an interactive consultation and cost approval gate prior to asset synthesis. The AI Agent MUST explain the tradeoffs among available image and voiceover providers and models, present an itemized per-scene cost breakdown and total estimated budget, and obtain explicit user approval before synthesizing assets or incurring credit spend.

#### Scenario: Pre-synthesis interactive approval gate
- GIVEN an authored and validated video script
- WHEN the procedure reaches the asset planning phase
- THEN the agent presents the provider options, explains tradeoffs, outputs the per-scene and total cost estimation, and awaits user confirmation before triggering asset compilation
