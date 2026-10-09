---
level: 3
parent_spec:
  name: "procedures"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/procedures/spec_NN.md"
knowledge_version: "V_0-3-0"
title: "Generate cogNNitive Video Script Procedure"
---

> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).

# NN index

* [[Procedure]]
* [[Work]]
* [[Artifact]]
* [[Tools]]
* [[Roles]]

# NN Procedure

## NN Procedure: Generate Video Script
category:: transformation
summary:: Frame a Video from its bound Subject and Series, author and gate a cogNNitive Video script with the nn-video-script skill (installed at ~/.agents/skills/nn-video-script), register it, generate an asset generation and cost estimation plan (asset_plan.md), compile Remotion manifests and render headlessly via video-engine-cli.mjs, finalize and register the rendered assets, and conduct a closing conversation retrospective for continuous improvement.
inputs_required:: Subject Element (via sources::) and Series registry model
outputs_expected:: Registered Video Assets
executed_by:: Video Producer
procedure_model:: procedures/generate_video_script_procedures_NN.md

# NN Work

## NN Work: Generate Video Script Workflow
step_type:: task
next:: [[Frame the Script]]
condition:: A Subject and a Series are available for the Video
input:: [[Subject and Series Selection]]
output:: [[Registered Video Assets]], [[Improvement Recommendations]]
output_status:: verified
tool:: [[nn-video-script Skill]]
scope:: internal
Orchestrate script generation end to end: frame the video from its Subject and Series, author and validate cogNNitive Video scenes and layers, register the script, plan and estimate media asset generation costs into `asset_plan.md`, compile Remotion composition manifests and render headlessly via `video-engine-cli.mjs`, finalize and register the rendered assets, and conclude with a collaborative retrospective for continuous improvement.

## NN Work: Frame the Script
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Author Video Scenes]]
condition:: The Video's Subject and Series are both bound
input:: [[Subject and Series Selection]]
output:: [[Script Outline]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Bind exactly one Subject (via the owning Video's `sources::`) and exactly one Series. Stage any workspace-scope asset the script needs into the Series' own `shared/` folder by copy, never as a live reference. Derive the narrative outline from the Subject's cited sources and the Series' `series_rules.md` tone.

## NN Work: Author Video Scenes
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Validate Script]]
condition:: Outline is ready
input:: [[Script Outline]]
output:: [[Draft Script]]
output_status:: verified
tool:: [[nn-video-script Skill]]
scope:: internal
Copy the Series' `script_template.md` and fill every `{{slot}}<!-- slot: ... -->` pair with real content, following `references/series-template-convention.md` and `references/vus-authoring-notes.md`. Both the placeholder and its instruction comment must be gone from the emitted `script.md`. Never edit `script_template.md` itself.

## NN Work: Validate Script
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Register Script Artifact]]
condition:: Draft script is emitted
input:: [[Draft Script]]
output:: [[Validated Script]]
output_status:: verified
tool:: [[nn-video-script Skill]]
scope:: internal
Run `node ~/.agents/skills/nn-video-script/scripts/check-script.mjs <script.md> --series-root <series-dir>` first — the zero-unresolved-placeholder gate, the leftover-slot-comment check, the header check, and the no-upward-escape asset check, in that order — then run `node ~/.agents/skills/nn-video-script/scripts/remotion-scene-compiler.mjs <script.md>`. Either check failing stops the procedure before anything is registered.

## NN Work: Register Script Artifact
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Plan and Estimate Asset Generation]]
condition:: Script passed both validation checks
input:: [[Validated Script]]
output:: [[Registered Script Artifact]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Write the script write-once into the video's own folder — a new member `script_<UTC YYYYMMDDTHHmmssZ>.md` under `series/{series-slug}/assets/{video-slug}/` when the Video belongs to a Series, or under `{modelDir}/assets/{video-slug}/` for a standalone Video. Never overwrite an earlier script, and write nothing when the latest member has identical bytes. Set `script::` on the owning Video Element to the latest member, and set `status:: scripting`.

## NN Work: Plan and Estimate Asset Generation
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Compile Composition and Synthesize Assets]]
condition:: Script is registered and validated
input:: [[Registered Script Artifact]]
output:: [[Asset Generation and Cost Plan]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Before triggering synthesis of any image, video motion, audio/TTS, or multimodal asset, the AI agent MUST conduct an interactive provider consultation and cost approval gate:
1. **Visual Preproduction Standards**: Inventory every asset needed following `references/thumbnail-and-asset-pipeline.md` (Empty Set First for environments, Identity Anchoring for characters, Design Preset Resolution for visual anchors, and Two-Phase clean 16:9 base thumbnails).
2. **Interactive Provider & Model Consultation**: Present and explain the available provider options and models to the user:
   - **Image Generation Providers**: WaveSpeed AI (`wavespeed-ai/z-image/turbo`, `flux-schnell`, `flux-1-dev`), Replicate (`black-forest-labs/flux-schnell`, `flux-1-dev`), or Local SVG/Static Compositor, detailing quality, generation latency, and unit pricing.
   - **Voiceover / TTS Providers**: ElevenLabs (`eleven_multilingual_v2`, `eleven_turbo_v2`), OpenAI TTS (`tts-1`, `tts-1-hd`), or Windows SAPI / Edge-TTS (Local/Free), detailing voice realism, multi-language support, and per-thousand character pricing.
3. **Per-Scene & Total Cost Estimation**: Run `node ~/.agents/skills/nn-video-script/scripts/asset-cost-estimator.mjs <script.md> --out staging/video/{video-slug}/asset_plan.md` to compute exact character counts, scene by scene, and calculate:
   - Itemized per-scene cost (visual model cost + TTS voiceover cost).
   - Grand total estimated production budget ($ USD).
   - Comparison across Budget, Professional Studio, Cinema, and Offline/Free quality tiers.
   - Store the resulting plan write-once as a new member `assets/{video-slug}/asset_plan_<UTC YYYYMMDDTHHmmssZ>.md` (identical bytes write nothing; earlier plans stay untouched).
4. **Mandatory User Approval Gate**: Display the formatted cost and tier comparison table to the user and request explicit approval of the selected providers and estimated budget before executing any asset synthesis or spending API credits.

## NN Work: Compile Composition and Synthesize Assets
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Render Master Video]]
condition:: Script is registered and the latest asset plan is approved by the user
input:: [[Registered Script Artifact]], [[Asset Generation and Cost Plan]]
output:: [[Compiled Composition Manifest]]
output_status:: verified
tool:: [[cogNNitive Video Tool]]
scope:: internal
Execute `node ~/.agents/skills/nn-video-script/scripts/video-engine-cli.mjs compile <script.md> --output renders/{ref}/manifest.json`. The engine computes deterministic SHA-256 hashes, performs TTS audio and media synthesis with cache-first lookup under `.cognnitive/cache/video/`, aligns audio duration with Remotion timeline frames, and emits the typed `RemotionCompositionManifest`.

## NN Work: Render Master Video
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Compose Video Thumbnail]]
condition:: Composition manifest is compiled and assets are synthesized
input:: [[Compiled Composition Manifest]]
output:: [[Rendered Output]]
output_status:: verified
tool:: [[cogNNitive Video Tool]]
scope:: internal
Execute `node ~/.agents/skills/nn-video-script/scripts/video-engine-cli.mjs render renders/{ref}/manifest.json --output renders/{ref}/master.mp4`. The engine headlessly renders the Remotion composition to an MP4 master file and outputs summary execution metrics (duration, frames, render time, cache hits).

## NN Work: Compose Video Thumbnail
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Finalize Video Assets]]
condition:: Clean 16:9 base thumbnail is available
input:: [[Asset Generation and Cost Plan]]
output:: [[Composed Video Thumbnail]]
output_status:: verified
tool:: [[nn-video-script Skill]]
scope:: internal
Run `node ~/.agents/skills/nn-video-script/scripts/render-thumbnail.mjs --base <path> --title <title> [--subtitle <subt>] [--badge <badge>] --out <out>`. It programmatically composites bold high-contrast title, subtitle/metadata, and brand badge pill onto the clean base image at 2560x1440 resolution using SVG vector templating and sharp.

## NN Work: Finalize Video Assets
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Register Video Assets]]
condition:: A render is available under renders/
input:: [[Rendered Output]], [[Composed Video Thumbnail]]
output:: [[Finalized Video Assets]]
output_status:: verified
tool:: [[nn-video-script Skill]]
scope:: internal
Run `node ~/.agents/skills/nn-video-script/scripts/finalize-video.mjs --video-dir <dir> [--ref <r>] [--force-thumbnail]`. It picks `renders/{ref}/` (failing when several candidates exist and no `--ref` is given), copies `master`/`thumbnail`/`voiceover` into the video's own folder via a temp-file-then-rename, preserves an existing thumbnail unless `--force-thumbnail` is passed, skips a missing voiceover without error, and prints the field values to set. It never edits the model file itself.

## NN Work: Register Video Assets
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Prompt Web Portal Publication]]
condition:: Finalize has printed the field values to set
input:: [[Finalized Video Assets]]
output:: [[Registered Video Assets]]
output_status:: verified
tool:: [[File Editor]]
scope:: internal
Set `master::`, `thumbnail::`, and (when present) `voiceover::` on the owning Video Element using the values `finalize-video.mjs` printed, and set `status:: rendering`.

## NN Work: Prompt Web Portal Publication
parent:: [[Generate Video Script Workflow]]
step_type:: task
next:: [[Conduct Closing Retrospective]]
condition:: Video assets are registered
input:: [[Registered Video Assets]]
output:: [[Web Publication Decision]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Prompt the user explicitly asking if they want to publish the video companion page and update the public web portal via the `Publish Video Web Portal` procedure (`procedures/publish_web_portal_procedures_NN.md`). If confirmed, proceed to generate or update the web portal in the `web/` directory.

## NN Work: Conduct Closing Retrospective
parent:: [[Generate Video Script Workflow]]
step_type:: task
condition:: Script drafting or video finalization session is complete
input:: [[Draft Script]], [[Validated Script]]
output:: [[Improvement Recommendations]]
output_status:: verified
tool:: [[AI Agent]]
scope:: internal
Conclude the authoring session by proactively asking the user if they want to analyze the entire conversation to extract learnings and suggest iterative improvements. If confirmed, evaluate prompt patterns, user adjustments, and narrative hurdles from the session to recommend concrete refinements to the Series rules (`series_rules.md`), script template (`script_template.md`), or agent authoring workflows.

# NN Artifact

## NN Artifact: Subject and Series Selection
type:: input
description:: The Subject Element (cited via the owning Video's sources::) and the Series registry model the Video belongs to.

## NN Artifact: Script Outline
type:: intermediate
description:: Ordered narrative beats framing the scenes to author, derived from the Subject's sources and the Series' series_rules.md.

## NN Artifact: Draft Script
type:: intermediate
description:: A script.md authored from the Series' script_template.md, before check-script.mjs and validation checks have run.

## NN Artifact: Validated Script
type:: intermediate
description:: A script.md that passed the zero-unresolved-placeholder/asset-escape gate and compiler validation.

## NN Artifact: Registered Script Artifact
type:: output
description:: The validated cogNNitive Video script stored in the video's own folder and referenced by the owning Video Element's script:: field, with status:: scripting.

## NN Artifact: Asset Generation and Cost Plan
type:: intermediate
description:: A write-once markdown document (family `asset_plan`, latest member current) stored in the video's own folder containing the itemized asset inventory, generation prompts/descriptions, assigned AI models and providers (Replicate, ElevenLabs, etc.), unit rates looked up from provider pricing pages, estimated costs per asset, and total projected generation budget.

## NN Artifact: Compiled Composition Manifest
type:: intermediate
description:: The Remotion composition manifest (manifest.json) emitted by video-engine-cli.mjs compile containing scene timeline tracks, audio bindings, visual overlays, and frame durations.

## NN Artifact: Rendered Output
type:: intermediate
description:: The master/thumbnail/voiceover files produced under renders/{ref}/ by video-engine-cli.mjs render, ready for promotion into the video's own folder.

## NN Artifact: Composed Video Thumbnail
type:: intermediate
description:: The 2560x1440 thumbnail image generated by render-thumbnail.mjs with programmatic typography and brand styling overlaid on the clean 16:9 base.

## NN Artifact: Finalized Video Assets
type:: intermediate
description:: The master/thumbnail/voiceover files copied out of renders/{ref}/ into the video's own folder by finalize-video.mjs, plus the field values it printed.

## NN Artifact: Registered Video Assets
type:: output
description:: The finalized assets referenced by the owning Video Element's master::, thumbnail::, and voiceover:: fields, with status:: rendering.

## NN Artifact: Web Publication Decision
type:: output
description:: User confirmation and intent to proceed with web portal generation and GitHub Pages publication.

## NN Artifact: Improvement Recommendations
type:: output
description:: Actionable suggestions for refining Series rules, script templates, or authoring workflows derived from analyzing the session conversation.

# NN Tools

## NN Tools: nn-video-script Skill
type:: automated
description:: The nn-video-script skill (embedded in this bluepriNNt, installed at ~/.agents/skills/nn-video-script) authoring (from script_template.md), gating (check-script.mjs, remotion-scene-compiler.mjs), and finalizing (finalize-video.mjs) script syntax inside a Series folder.

## NN Tools: cogNNitive Video Tool
type:: automated
description:: Embedded programmatic video compilation and headless Remotion rendering engine (~/.agents/skills/nn-video-script/scripts/video-engine-cli.mjs) with deterministic SHA-256 asset caching and frame-accurate timeline synthesis.

## NN Tools: AI Agent
type:: automated
description:: Cognitive agent framing the narrative outline from the Subject's cited sources and the Series' series_rules.md.

## NN Tools: File Editor
type:: automated
description:: Tool writing the emitted script and the finalized asset field values to the workspace and updating the owning Video Element (innfo-mcp).

# NN Roles

## NN Roles: Video Producer
type:: owner
description:: Owns the video's scope, approves the generated script and asset plan, and executes rendering via cogNNitive Video Engine.
