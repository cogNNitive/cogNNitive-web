# Design: Video Asset & Programmatic Thumbnail Pipeline

## Architecture Overview

```
                        [ 1. Preproduction & Scripting ]
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
   [ Empty Set First ]                               [ Two-Phase Thumbnail ]
 1. Generate `set_scene.jpeg`                       1. Generate clean 16:9 base
    (strictly no people)                               (`thumbnail_[topic]_base.jpeg`)
 2. In-paint character avatars                          (No text, multi-ref faces)
    (`avatar_role_scene.jpeg`)                                  │
                                                                ▼
                                                    2. Programmatic Typography
                                                       (`render-thumbnail.mjs`)
                                                       • SVG Vector Template
                                                       • Sharp Composite Engine
                                                       • High-contrast stroke
                                                       • Brand badge pill
                                                                │
                                                                ▼
                                                    [ thumbnail_[topic].jpeg ]
                                                       (2560x1440 16:9 ready)
```

## Component Design

### 1. Programmatic Thumbnail Renderer (`skills/nn-video-script/scripts/render-thumbnail.mjs`)

#### Strategy: SVG Vector Template + Sharp Compositing
Rather than using heavy native Canvas libraries (which require Cairo/Pango compilation and cause Windows/CI failures), `render-thumbnail.mjs` generates an in-memory SVG markup string containing all typographic elements, drop shadows, strokes, and badges, and composites it over the resized base image using `sharp`:

```javascript
// Base image pipeline
const baseBuffer = await sharp(baseImagePath)
  .resize(targetWidth, targetHeight, { fit: 'cover' })
  .toBuffer();

// SVG Overlay definition
const svgOverlay = generateThumbnailSvg({
  width: targetWidth,
  height: targetHeight,
  title,
  subtitle,
  badge
});

// Final composite
await sharp(baseBuffer)
  .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
  .jpeg({ quality: 90 })
  .toFile(outputPath);
```

#### Visual Styling Details:
- **Title**: Font `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, Impact`, bold 800+, white fill with strong dark stroke (`stroke="#000000"` `stroke-width="12px"` `paint-order="stroke fill"` or multi-layered text) and drop-shadow filter to ensure 100% legibilidad on any background.
- **Subtitle**: Medium-bold sans-serif with subtle background backing or stroke, placed beneath the main title.
- **Badge**: Rounded translucent pill badge (e.g. `rgba(0, 0, 0, 0.7)` or theme color) with crisp uppercase text placed strategically at the top margin.
- **Layout**: Positioned carefully with safe margins to avoid YouTube player UI clipping (bottom-right timestamp overlay safe area).

### 2. Updates to Canonical Video Procedure (`generate_anydeo_script_NN.md`)

- Integrate the "Empty Set First" workflow into the preproduction/asset preparation step.
- Detail the Two-Phase Thumbnail process within the asset generation and finalization workflow.
- Standardize the naming conventions for all video assets.

### 3. Updates to `nn-video-script` Skill & References

- Add `skills/nn-video-script/references/thumbnail-and-asset-pipeline.md` detailing prompt engineering guidelines, negative prompts for empty sets, multi-reference facial in-painting, and thumbnail rendering usage.
- Update `skills/nn-video-script/SKILL.md` tooling reference table to include `render-thumbnail.mjs`.

### 4. Automated Testing

- Create `skills/nn-video-script/test/render-thumbnail.test.mjs`.
- Test CLI argument parsing, SVG template generation, text escaping (XML safety), and actual Sharp image compositing from synthetic base images.
