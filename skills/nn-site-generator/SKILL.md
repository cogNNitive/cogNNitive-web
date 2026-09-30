---
name: nn-site-generator
description: Create or edit websites, add analytics, or add contact forms. Invoke with /nn-site-generator.
disable-model-invocation: true
license: MIT
compatibility: ">=1.0.0"
version: "V_0-2-0"
last_updated: 2026-09-03
metadata:
  source_type: original
bundled_blueprints: []
---

# nn Site Generator

## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).

---

When activated, present the 5 branches below using the `question` tool. For design tokens, reference the `nn-design-presets` skill and its `presets/` directory.

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

## Post-generation

After any change, ask if the user wants a local preview:
```powershell
npx serve docs -p 8080
```
