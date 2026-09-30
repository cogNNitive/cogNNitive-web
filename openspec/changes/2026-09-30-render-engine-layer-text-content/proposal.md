# Proposal: Scene compiler reads `layer_text_content` for text layers

## Why

The VUS spec `V_0-3-3` defines `layer_text_content` (a `layer_type: text`
field) as the text to display. The render engine's scene compiler
(`skills/nn-video-script/scripts/remotion-scene-compiler.mjs`) still reads the
non-existent `layer_generation_text` (and a legacy `text` fallback) when
building visual overlay props for `lowerThird`, `kineticTitle`, and
`conceptCallout`.

The canonical video samples were already migrated to `layer_text_content`
(`layer_generation_text` → `layer_text_content`, per the
`2026-09-30-self-hosted-video-engine` change). As a result, the compiler falls
back to `layer.name`, so callout/kicker text can arrive empty or wrong at the
render.

The maintainer's decision is: no backwards compatibility, no aliases, no
fallbacks. The compiler must read the canonical `layer_text_content` field and
stop reading `layer_generation_text` / `text`.

## What Changes

- `skills/nn-video-script/scripts/remotion-scene-compiler.mjs`: replace the six
  `layer_generation_text` reads (three overlay factories + three overlay call
  sites) with `layer_text_content`, and drop the legacy `text` fallback.
- `skills/nn-video-script/test/video-engine-cli.test.mjs`: the sample script
  still used `layer_generation_text`; update it to `layer_text_content`.

## Capabilities

### Modified Capabilities

- `cognnitive-video-engine`: the scene compiler now sources overlay text from
  the canonical `layer_text_content` VUS field.

## Impact

### Affected areas

- `skills/nn-video-script/scripts/remotion-scene-compiler.mjs`
- `skills/nn-video-script/test/video-engine-cli.test.mjs`
- `openspec/specs/cognnitive-video-engine/spec.md` (delta)

Touches `skills/**`, so it lands in the next `skills-v*` tag (does not belong
in `2026-09-30-self-hosted-video-engine`).

### Verification

- Unit: `scene-compiler.test.mjs` and `video-engine-cli.test.mjs` green.
- Render proof: a `conceptCallout` layer authored with `layer_text_content`
  yields `config.label` equal to that text (not `layer.name`).

### Rollback

Single-file compiler revert; the overlay factories revert cleanly.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A caller relied on the old `text` fallback | Low | No backwards-compat is the documented maintainer decision; samples already migrated |
| Overlay props now empty when a layer uses neither canonical nor explicit field | Low | Falls back to `layer.name` as before |

### Success criteria

- [ ] `layer_text_content` resolves in all three overlay factories and their call sites.
- [ ] `layer_generation_text` / `text` no longer appear in `remotion-scene-compiler.mjs`.
- [ ] `scene-compiler.test.mjs` and `video-engine-cli.test.mjs` pass.

### Out of scope

- VUS syntax itself.
- The `2026-09-30-self-hosted-video-engine` release/tag flow.