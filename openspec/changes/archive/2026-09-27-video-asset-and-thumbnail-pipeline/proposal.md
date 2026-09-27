# Proposal: Video Asset & Programmatic Thumbnail Pipeline

## Intent

Production validation of generative video series (`iNNtrevistas`: *La Rueda*, *La Brújula*) revealed three recurring preproduction frictions:
1. **Background Contamination**: Generative diffusion models inject unwanted people or artifacts into empty interview sets if not forced to produce an empty scene first.
2. **Typographic Degradation in Thumbnails**: Direct diffusion generation of typography produces illegible, hallucinated, or unbranded text. Thumbnails require programmatic, deterministic typography composition over a clean visual base.
3. **Identity Preservation**: Thumbnails and avatar scenes require strict multi-reference facial and character anchoring.

This change standardizes the visual asset preproduction pipeline in cogNNitive's `video` template, updates the canonical video procedure `generate_anydeo_script_NN.md`, adds reference guidelines to `nn-video-script`, and ships a deterministic, portable CLI thumbnail renderer tool (`scripts/render-thumbnail.mjs`) powered by SVG templating and `sharp`.

## Scope

### In Scope

- **D1 · Precondition "Empty Set First"**:
  - Update `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` and `skills/nn-video-script/` references to enforce the empty environment / set generation before avatar or actor in-painting.
  - Standardize generic naming convention for environment backgrounds (`set_[scene].jpeg` / `set_[context].jpeg`) and character avatars (`avatar_[role]_[context].jpeg`).
- **D2 · Two-Phase Thumbnail Pipeline**:
  - **Phase A (Base Composition)**: Generate clean 16:9 base thumbnail image (`thumbnail_[topic]_base.jpeg`) with multi-reference facial anchoring and a strict prohibition of text in generative diffusion prompts.
  - **Phase B (Programmatic Typographic Overlay)**: Programmatically compose high-contrast, stroke-bordered title, subtitle/metadata, and brand badge pill over the base image at 2560x1440 resolution.
- **D3 · Thumbnail Rendering CLI Tool (`scripts/render-thumbnail.mjs`)**:
  - Build `skills/nn-video-script/scripts/render-thumbnail.mjs` using SVG template overlay + `sharp`.
  - Expose CLI flags: `--base <path>`, `--title <string>`, `--subtitle <string>`, `--out <path>`, `--badge <string>`, `--width <number>`, `--height <number>`.
  - Ensure zero native compilation issues on Windows and CI Linux.
- **D4 · Test Suite & Verification**:
  - Unit tests for `render-thumbnail.mjs` in `skills/nn-video-script/test/render-thumbnail.test.mjs`.
  - Documentation and authoring references in `skills/nn-video-script/references/thumbnail-and-asset-pipeline.md`.
  - Integration with pre-flight asset readiness checks where applicable.

### Out of Scope

- Live calls to third-party image generation APIs (diffusion models remain external tools executed by the Video Producer).
- Changing core Video Element schema fields (`title`, `description`, `script`, `thumbnail`, `voiceover`, `master`, `status`).

## Capabilities

### New Capabilities

- `video-asset-pipeline`: "Empty Set First" generation rule, multi-reference identity anchoring, and standardized canonical naming conventions for visual assets.
- `two-phase-thumbnail`: Deterministic two-phase thumbnail authoring and programmatic typography rendering via `render-thumbnail.mjs`.

## Dependencies

- Extends `video-script-skill`, `video-folder-contract`, and `video-production-hierarchy`.
