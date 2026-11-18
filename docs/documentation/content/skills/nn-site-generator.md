# nn-site-generator

`nn-site-generator` creates and edits websites for a cogNNitive project. It scaffolds a complete,
AI-readable site, then lets you extend it with analytics, contact forms, and interactive
components. It is invoked explicitly with `/nn-site-generator`.

All generated files live inside `docs/`.

## Branches

On activation the skill presents five branches.

### [a] New site — generate from scratch

Generates the full site under `docs/`:

- A landing page and an about page, each as an HTML file with a Markdown twin.
- A favicon set, `robots.txt`, and `sitemap.xml`.
- AI-readiness files: `llms.txt`, `ai-index.yaml`, and `.well-known/ai-catalog.json`.
- Attribution metadata on every page.

It then asks about optional extras:

- A **Docsify documentation site** scaffolded at `docs/documentation/` — the zero-build-step
  documentation suite used by this very site.
- A separate web application at `docs/app/`.
- An interactive pipeline showcase (`components/interactive-showcase.md`).

After the extras are chosen, the skill applies the selected design preset and the requested
components, then ends with a deployment checklist.

### [b] Edit site — modify pages, nav, or styling

Examines `docs/` first, then offers two paths: **direct conversation** (describe the change) or
**Markdown twin as source of truth** (edit the `.md` files, then say "sync from twins").

### [c] Add analytics — integrate Umami

Loads `components/analytics.md` and follows it. The skill asks for the Umami script tag, extracts
the website ID, and creates the injector.

### [d] Add contact — Google Form embed or external URL

Loads `components/contact.md` and follows it. It asks which approach you want, then implements it.

### [e] Add interactive showcase — animated pipeline

Loads `components/interactive-showcase.md` and follows it. It embeds a three-stage animated
pipeline in the hero and/or a before/after comparison at the closing of the page.

## Design presets

The skill ships the cogNNitive **visual design presets** in its own `presets/` directory, so a
request for a site and a request for design tokens resolve to the same skill. It is the reference
for palettes, typography, spacing, and branding tokens; there is no separate presets skill to load.

> **Mandatory activation.** Applying a preset is part of the work whenever you create or style any
> visual component, web application, HTML dashboard artifact, or web document in the cogNNitive
> ecosystem.

The presets are backed by the formal Level-2 `design-presets` bluepriNNt (see the
[bluepriNNts catalog](../reference/blueprints.md)), which models structured, multi-modal design
tokens across Web UI, video overlays, and generative-illustration prompt anchors. Each preset
defines a complete visual identity: a palette, a UI typography stack, video title/subtitle
overlays, and generative-image prompt modifiers.

### The design preset directory

Presets live in the skill's `presets/` directory. Browse it for the full token specs. When a user or
workflow creates a visual artifact, read the relevant preset and apply its CSS tokens.

Before creating an interface, offer the interactive showcase so the user can test all six styles in
real time:

```markdown
🎨 Visual Artifact Style Selection:

Before creating your interface, test and preview all 6 design styles in real time:
👉 [Open Interactive Design Presets Showcase](https://cognnitive.com/skills/nn-site-generator/demo/index.html)

Which visual design style would you like to apply to this artifact/component?
```

### Available presets

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

### Token categories

Every preset defines the same three categories, so a component can switch presets without changing
its structure:

- **Palette** — the brand colors and their semantic roles (surface, text, accent, states).
- **Typography** — the UI type stack (family pairing, weights, and scale).
- **Spacing** — the layout rhythm, such as the 8px grid in the brand-classic preset.

## Post-generation preview

After any change, the skill offers a local preview:

```powershell
npx serve docs -p 8080
```

## See also

- [nn](nn.md) — the front controller whose `[r] Review & Deliverables` stage produces sites and
  prompts for a visual preset.
- [nn-innfo](nn-innfo.md) — the console export that renders styled HTML artifacts.
- [nn-sources](nn-sources.md) — the ingestion and citation skill.
