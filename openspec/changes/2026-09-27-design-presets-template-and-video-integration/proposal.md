# Proposal: Design Presets Template and Video Integration

## Intent

Previously, visual design styles (palettes, fonts, illustration prompts, negative prompts) for videos were either described in unstructured Markdown files (`style_guide.md`) or confined to `skills/nn-design-presets/presets/*.md` strictly as Web/UI tokens. 

There was no structured, machine-queryable iNNfo Level-2 template for design presets that could:
1. Provide a single source of truth for visual identity across Web, UI, Video overlays, and Generative Illustration.
2. Allow `Video` elements or Series to reference a concrete, typed `preset:: [[PresetName]]`.
3. Enable `skills/nn-video-script` and Anydeo script authoring workflows to programmatically extract illustration prompt anchors, negative prompts, and title/subtitle typography tokens into `asset_plan.md` and Anydeo script layers.

## Scope

### In Scope

- **New Level-2 Template `design-presets`**: Define `iNNfo/specs/templates/design-presets/spec_NN.md` with parent `iNNfo_V_0-2-1` and concept `DesignPreset` containing typography (UI and video), palettes, generative illustration tokens (`illustration_prompt_anchor`, `illustration_negative_prompt`), and preview image fields.
- **Level-3 Canonical Sample**: Create `iNNfo/specs/templates/design-presets/samples/Ghostbusters_V_0-1-0_design-presets_NN.md` in the Ghostbusters Inc. universe with cohesive presets (`Ghostbusters Tech Noir`, `Retro Spengler Comic`, `Ecto Neon Glow`, `Clean Lab Editorial`).
- **Catalog & Manifest Distribution**: Register `design-presets` in `manifest/source.yaml` and regenerate `iNNfo/specs/templates/catalog.json`.
- **Video Template Extension**: Add `preset` field to `Video` concept in `iNNfo/specs/templates/video/spec_NN.md` and update `Ghostbusters_V_0-1-0_video_NN.md` to reference a preset.
- **Skill Integration**:
  - Update `skills/nn-design-presets/SKILL.md` to reference the structured `design-presets` template as its source of truth.
  - Update `skills/nn-video-script/SKILL.md` and `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` to detail how `preset::` is resolved when authoring Anydeo script typography and planning generative image assets in `asset_plan.md`.

### Out of Scope

- Changing Anydeo grammar or VUS specifications.
- Altering existing Level-2 templates other than `video` and adding `design-presets`.

## Capabilities

### New Capabilities

- `design-presets-template`: A standardized Level-2 template for multi-modal design tokens (Web, Video, Generative Illustration).
- `video-preset-binding`: Direct typed binding between Video elements/Series and design presets.

### Modified Capabilities

- `video-production-hierarchy`: Extended to consume design presets from the workspace or series model.
- `nn-design-presets`: Connected to the structured iNNfo template ecosystem.
- `nn-video-script`: Reads preset data for asset planning and typography styling.
