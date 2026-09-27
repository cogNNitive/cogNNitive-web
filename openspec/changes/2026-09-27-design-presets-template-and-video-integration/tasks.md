# Tasks: Design Presets Template and Video Integration

## Batch 1: Template & Samples Implementation
- [x] 1.1 Create `iNNfo/specs/templates/design-presets/spec_NN.md` with Level-2 specification for `DesignPreset`.
- [x] 1.2 Create canonical sample `iNNfo/specs/templates/design-presets/samples/Ghostbusters_V_0-1-0_design-presets_NN.md`.
- [x] 1.3 Add `preset` field to `iNNfo/specs/templates/video/spec_NN.md` and bump template version if required.
- [x] 1.4 Update `iNNfo/specs/templates/video/samples/Ghostbusters_V_0-1-0_video_NN.md` with `preset:: [[Ghostbusters Tech Noir]]`.

## Batch 2: Manifest & Distribution Sync
- [x] 2.1 Register `design-presets` template in `manifest/source.yaml`.
- [x] 2.2 Regenerate `iNNfo/specs/templates/catalog.json` via `node scripts/template-catalog.mjs`.

## Batch 3: Skill Integration & Documentation
- [x] 3.1 Update `skills/nn-design-presets/SKILL.md` to reference the structured `design-presets` template.
- [x] 3.2 Update `skills/nn-video-script/SKILL.md` and `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` with preset resolution steps.

## Batch 4: Verification & Integrity Gate
- [x] 4.1 Run `npm run sync:versions` / `node scripts/template-catalog.mjs` to ensure zero drift.
- [x] 4.2 Run `node scripts/verify.js` and `npm run check:versions` to validate all integrity gates.
