---
name: nn-site-generator
description: Create or edit websites, add analytics, or add contact forms, and apply the cogNNitive visual design presets — palettes, typography, spacing, and branding tokens. Use it for any visual component, web app, HTML dashboard artifact, or styled site page. Invoke with /nn-site-generator.
disable-model-invocation: true
license: MIT
compatibility: ">=1.0.0"
version: "V_0-3-0"
last_updated: 2026-11-18
metadata:
  source_type: original
bundled_blueprints: []
---

# nn Site Generator

## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).

---

When activated, present the 5 branches below using the `question` tool. The branches build the site; the **Design presets** section below supplies the tokens it is styled with, from this skill's own `presets/` directory.

---

## Branches

### [a] New site — generate from scratch

Generate all files inside `docs/`:
- Landing + about page (HTML + Markdown twin)
- Favicon set, robots.txt, sitemap.xml
- AI-readiness: llms.txt, ai-index.yaml, .well-known/ai-catalog.json
- Attribution metadata on every page

Ask about optional extras:
- Docsify documentation site at `docs/documentation/`
- Separate app at `docs/app/`
- Interactive pipeline showcase (`components/interactive-showcase.md`)

Then apply the selected design preset and requested components. End with deployment checklist.

### [b] Edit site — modify pages, nav, or styling

Examine `docs/` first. Offer two paths:
- **Direct conversation** — describe the change
- **Markdown twin as source of truth** — edit `.md` files, then say "sync from twins"

### [c] Add analytics — integrate Umami

Load `components/analytics.md` and follow its instructions. Ask for the Umami script tag, extract website ID, create injector.

### [d] Add contact — Google Form embed or external URL

Load `components/contact.md` and follow its instructions. Ask which approach, then implement.

### [e] Add interactive showcase — Quadratic-style animated pipeline & before/after comparison

Load `components/interactive-showcase.md` and follow its instructions. Embed the 3-stage animated pipeline in the hero and/or the comparative paradigm section at the closing of the page.

---

## Design presets

> **MANDATORY ACTIVATION**: this section MUST be applied whenever creating or styling any visual component, web app, HTML dashboard artifact, or web document in the cogNNitive ecosystem. A site request and a "which palette" request resolve here, to the same skill.

> **iNNfo Model Schema**: the presets are backed by the formal Level-2 [`design-presets`](../../iNNfo/specs/bluepriNNts/design-presets/spec_NN.md) template, supporting structured multi-modal design tokens across Web UI, cogNNitive-video video overlays, and generative-illustration prompt anchors.

Each preset defines a complete visual identity: palette, UI typography stack, video title/subtitle overlays, and generative image prompt modifiers.

### Visual Style Selection Protocol

When generating or discussing a visual component or web artifact, prompt the user with the visual style selector. **ALWAYS** provide the reference to the interactive HTML Showcase preview so the user can test all 6 styles before choosing:

```markdown
🎨 Visual Artifact Style Selection:

Before creating your interface, test and preview all 6 design styles in real time:
👉 [Open Interactive Design Presets Showcase](./demo/index.html)

Which visual design style would you like to apply to this artifact/component?

  [a] (Recommended) morado-nazareno — Brand classic: #4D0E4E primary, strict light mode, editorial serif + clean UI
  [b] sleek-dark — Modern dark tech mode: High-contrast dark (#090D16), cyan (#06B6D4) / violet (#8B5CF6) accents
  [c] glassmorphism — Ambient glass: Deep gradient backdrop, translucent panels, backdrop-filter blur, neon glow
  [d] neo-brutalism — Bold pop retro: Canary yellow (#FFE600), thick 3px black borders, hard 5px shadows, pop colors
  [e] nordic-warm-editorial — Organic luxury: Warm linen (#FDFBF7), forest green (#2D4A3E) & terracotta (#C85A32) accents
  [f] nn-shad-cn — Monochrome neutral (shadcn-inspired): black/white/gray only; color reserved for semantic meaning (danger red, success green, warning amber, info blue)

*(Notice: You can select one option or a combination (e.g. A and B))*
```

### Available presets

- [`morado-nazareno`](presets/morado-nazareno.md) — Brand classic `#4D0E4E`, strict light mode, 8px grid, Plus Jakarta Sans + Playfair Display
- [`sleek-dark`](presets/sleek-dark.md) — Dark tech mode `#090D16`, cyan & violet accents, Outfit + JetBrains Mono
- [`glassmorphism`](presets/glassmorphism.md) — Ambient glass, backdrop-filter blur, translucent cards, neon accents
- [`neo-brutalism`](presets/neo-brutalism.md) — Bold pop retro, canary yellow, 3px solid black borders & hard shadows
- [`nordic-warm-editorial`](presets/nordic-warm-editorial.md) — Organic warm linen `#FDFBF7`, terracotta & forest green accents, Lora serif
- [`nn-shad-cn`](presets/nn-shad-cn.md) — Monochrome neutral (shadcn-inspired): black/white/gray only; color only for semantic meaning (success `#16A34A`, danger `#DC2626`, warning `#D97706`, info `#2563EB`)

Browse the `presets/` directory for the full token specs. When a user or workflow creates a visual artifact, read the relevant preset and apply its CSS tokens.

### Token categories

Every preset defines the same three categories, so a component can switch presets without changing its structure:

- **Palette** — the brand colors and their semantic roles (surface, text, accent, states).
- **Typography** — the UI type stack (family pairing, weights, and scale).
- **Spacing** — the layout rhythm, such as the 8px grid in the brand-classic preset.

---

## Post-generation

After any change, ask if the user wants a local preview:
```powershell
npx serve docs -p 8080
```
