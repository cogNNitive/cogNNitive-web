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

For design tokens the skill references [nn-design-presets](nn-design-presets.md) and its `presets/`
directory. The chosen preset supplies the palette, typography, and spacing applied to the generated
site, so every page shares one visual identity.

## Post-generation preview

After any change, the skill offers a local preview:

```powershell
npx serve docs -p 8080
```

## See also

- [nn-design-presets](nn-design-presets.md) — the visual tokens the generated site uses.
- [nn](nn.md) — the front controller whose `[r] Review & Deliverables` stage produces sites.
- [nn-sources](nn-sources.md) — the ingestion and citation skill.
