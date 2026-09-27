# Design: Design Presets Template and Video Integration

## Architecture Overview

```
+-------------------------------------------------------------+
|                      iNNfo Workspace                        |
|                                                             |
|   models/design_presets_NN.md                               |
|   (Instantiates Level-2 template: design-presets)           |
|   Contains DesignPreset elements:                           |
|     - [[Ghostbusters Tech Noir]]                            |
|     - [[Retro Spengler Comic]]                              |
|     - [[morado-nazareno]]                                   |
|                                                             |
|   +-----------------------------------------------------+   |
|   |                  Series / Video                     |   |
|   |                                                     |   |
|   |   ## NN Video: Recruitment Spot                     |   |
|   |   preset:: [[Ghostbusters Tech Noir]]               |   |
|   |   script:: script.md                                |   |
|   +--------------------------+--------------------------+   |
+------------------------------|------------------------------+
                               |
                               v
            +------------------------------------+
            |          nn-video-script           |
            |                                    |
            |   1. Reads Video.preset            |
            |   2. Injects typography into VUS   |
            |   3. Injects prompt anchors into   |
            |      asset_plan.md                 |
            +------------------------------------+
```

## 1. Concept and Field Model for `design-presets`

Parent Spec: `iNNfo_V_0-2-1`
Level: 2
Template Version: `V_0-1-0`

### Concept: `DesignPreset`
- `icon:: palette`
- `type:: category`
- `color:: purple`
- `weight:: 100`

### Fields on `DesignPreset`:
1. `name` (`type:: string`): Preset display name.
2. `description` (`type:: markdown_inline`): Summary of the aesthetic and target use case.
3. `category` (`type:: select`, `options:: [web, video, illustration, unified]`): Primary application scope.
4. `palette` (`type:: string`): Color palette tokens (primary, secondary, accent, surface, bg).
5. `typography_ui` (`type:: string`): Font families and sizing rules for web / dashboard components.
6. `typography_video_title` (`type:: string`): Font family, weight, and styling for video title overlays in Anydeo.
7. `typography_video_subtitle` (`type:: string`): Font family and style for subtitle / lower-third overlays.
8. `illustration_prompt_anchor` (`type:: string`): Standard positive prompt modifiers for generative image/illustration pipelines.
9. `illustration_negative_prompt` (`type:: string`): Negative prompt tokens to maintain visual consistency.
10. `sample_preview` (`type:: image`): Visual preview image of the preset.

## 2. Video Template Extension

In `iNNfo/specs/templates/video/spec_NN.md`:
- Add field:
```markdown
## NN Field Definition: preset
concept:: Video
type:: string
description:: Design preset reference (e.g. [[morado-nazareno]], [[Ghostbusters Tech Noir]]) defining visual typography and generative illustration anchors.
```

## 3. Workflow Integration

### Anydeo Script Generation & Asset Planning:
1. When `generate_anydeo_script_NN.md` procedure runs, the agent inspects the `Video` element.
2. If `preset:: [[<PresetName>]]` is present, the agent queries the `DesignPreset` element in the workspace.
3. In `asset_plan.md`, the positive and negative prompts for generated assets automatically append `illustration_prompt_anchor` and `illustration_negative_prompt`.
4. In `script.md`, Anydeo text overlay layers (`@@ text ...`) adopt `typography_video_title` and `typography_video_subtitle` styling.
