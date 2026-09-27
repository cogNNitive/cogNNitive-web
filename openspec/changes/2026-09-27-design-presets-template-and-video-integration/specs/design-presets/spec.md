# Capability Spec: `design-presets-template`

## Description
A structured iNNfo Level-2 template that defines multi-modal design tokens (web, video, illustration) as first-class, machine-queryable data entities.

## Requirements

### R1: Level 2 Template Definition
The template MUST be placed at `iNNfo/specs/templates/design-presets/spec_NN.md` with:
- `spec_version: "V_0-2-1"`
- `template_version: "V_0-1-0"`
- `level: 2`
- `parent_spec`: `iNNfo_V_0-2-1`

### R2: Concepts and Fields
The template MUST define:
- Concept `DesignPreset`
- Fields:
  - `name`: string
  - `description`: markdown_inline
  - `category`: select (`web`, `video`, `illustration`, `unified`)
  - `palette`: string
  - `typography_ui`: string
  - `typography_video_title`: string
  - `typography_video_subtitle`: string
  - `illustration_prompt_anchor`: string
  - `illustration_negative_prompt`: string
  - `sample_preview`: image

### R3: Canonical Sample
A canonical Level-3 sample MUST be provided under `iNNfo/specs/templates/design-presets/samples/Ghostbusters_V_0-1-0_design-presets_NN.md` compliant with the Ghostbusters Inc. sample universe.
