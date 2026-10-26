# nn-design-presets

`nn-design-presets` is the reference for cogNNitive **visual design presets** — palettes,
typography, spacing, and branding tokens. It is not a workflow skill: it is reference material the
agent loads on demand when generating or styling any visual artifact.

> **Mandatory activation.** This skill must be activated whenever creating or styling any visual
> component, web application, HTML dashboard artifact, or web document in the cogNNitive ecosystem.

The skill is backed by the formal Level-2 `design-presets` bluepriNNt (see the
[bluepriNNts catalog](../reference/blueprints.md)), which models structured, multi-modal design
tokens across Web UI, video overlays, and generative-illustration prompt anchors. Each preset defines a complete visual identity: a palette,
a UI typography stack, video title/subtitle overlays, and generative-image prompt modifiers.

## The design preset directory

Presets live in the skill's `presets/` directory. Browse it for the full token specs. When a user or
workflow creates a visual artifact, read the relevant preset and apply its CSS tokens.

Before creating an interface, offer the interactive showcase so the user can test all six styles in
real time:

```markdown
🎨 Visual Artifact Style Selection:

Before creating your interface, test and preview all 6 design styles in real time:
👉 [Open Interactive Design Presets Showcase](./demo/index.html)

Which visual design style would you like to apply to this artifact/component?
```

## Available presets

| Preset | Character | Palette highlights | Typography |
|---|---|---|---|
| `morado-nazareno` | Brand classic; strict light mode; 8px grid | Primary `#4D0E4E` | Plus Jakarta Sans + Playfair Display |
| `sleek-dark` | Modern dark tech mode | Background `#090D16`; cyan `#06B6D4` and violet `#8B5CF6` accents | Outfit + JetBrains Mono |
| `glassmorphism` | Ambient glass | Deep gradient backdrop, translucent panels, backdrop-filter blur, neon glow | — |
| `neo-brutalism` | Bold pop retro | Canary yellow `#FFE600`, thick 3px black borders, hard 5px shadows | — |
| `nordic-warm-editorial` | Organic luxury | Warm linen `#FDFBF7`, forest green `#2D4A3E`, terracotta `#C85A32` | Lora serif |
| `nn-shad-cn` | Monochrome neutral (shadcn-inspired) | Black/white/gray only; color reserved for semantics | — |

For `nn-shad-cn`, color carries meaning only: success `#16A34A`, danger `#DC2626`, warning
`#D97706`, info `#2563EB`.

## Token categories

Every preset defines the same three categories, so a component can switch presets without changing
its structure:

- **Palette** — the brand colors and their semantic roles (surface, text, accent, states).
- **Typography** — the UI type stack (family pairing, weights, and scale).
- **Spacing** — the layout rhythm, such as the 8px grid in the brand-classic preset.

## See also

- [nn-site-generator](nn-site-generator.md) — consumes these presets when generating a site.
- [nn-innfo](nn-innfo.md) — the console export that renders styled HTML artifacts.
- [nn](nn.md) — prompts for a visual preset when generating visual artifacts.
