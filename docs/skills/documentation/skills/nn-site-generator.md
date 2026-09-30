---
title: "nn-site-generator — Website Generation & Hydration"
description: "Create or edit websites, integrate analytics, add contact forms, and build Docsify documentation suites."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-site-generator
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-site-generator

**Skill**: `nn-site-generator` · **Role**: Website Generation & Hydration

Generates, edits, and hydrates static websites, landing pages, Docsify documentation portals, and interactive showcases inside `docs/`.

---

## 0. Activation Gate

Executes the canonical activation gate defined in [`nn-preflight`](skills/nn-preflight.md).

---

## 1. Functional Branches

When activated, `nn-site-generator` presents 5 branches:

### `[a]` New site — generate from scratch
Generates all essential web files inside `docs/`:
- Landing + about pages (HTML + Markdown twin)
- Favicon set, `robots.txt`, `sitemap.xml`
- AI readiness files: `llms.txt`, `ai-index.yaml`
- Optional Docsify documentation suite at `docs/documentation/`
- Optional interactive pipeline showcase

### `[b]` Edit site — modify pages, navigation, or styling
- **Direct conversation**: Describe changes directly.
- **Markdown twin sync**: Edit `.md` files, then synchronize to HTML.

### `[c]` Add analytics — integrate Umami
- Injects light-weight, privacy-focused tracking with custom event support.

### `[d]` Add contact — Google Forms embed or custom form
- Embeds responsive, styled contact mechanisms.

### `[e]` Add interactive showcase — Animated pipeline
- Embeds animated interactive pipelines and comparative before/after cards.

---

## 2. Design System Integration

All generated layouts apply tokens from [`nn-design-presets`](skills/nn-design-presets.md), featuring the **Morado Nazareno** brand palette (`#4D0E4E`), Plus Jakarta Sans typography, and an 8px spacing grid.
