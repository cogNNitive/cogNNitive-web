---
title: "nn-design-presets — cogNNitive Visual Design Presets"
description: "Reference for cogNNitive visual design presets — palettes, typography, spacing, and branding tokens."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-design-presets
generator: https://cognnitive.com/skills/nn-design-presets
---

# cogNNitive Design Presets

**Skill**: `nn-design-presets` · **Role**: Visual Design System Tokens

Defines visual identities, palettes, typography stacks, 8px spacing grids, shadows, and layout rules for web artifacts and documentation.

---

## 0. Activation Gate

Executes the canonical activation gate defined in [`nn-preflight`](skills/nn-preflight.md).

---

## 1. Morado Nazareno (Brand Classic)

Strict light mode with `#4D0E4E` brand primary, clean borders, and editorial typography.

### Core Tokens
```yaml
mode: STRICT_LIGHT_MODE
palette:
  canvas_base: "#FFFFFF"
  canvas_inert: "#FAFAFC"
  brand_primary: "#4D0E4E"
  brand_light: "#6A1B6B"
  brand_subtle: "#F6EEF6"
  border_soft: "#F2F2F7"
  ink_primary: "#111112"
  ink_muted: "#636366"
typography:
  sans_ui: "Plus Jakarta Sans, Geist Sans, system-ui, sans-serif"
  serif_editorial: "Playfair Display, Georgia, serif"
  mono_technical: "JetBrains Mono, Geist Mono, monospace"
```

### Docsify Configuration
```css
:root {
  --theme-color: #4D0E4E;
  --base-background: #FFFFFF;
  --textColor: #111112;
  --sidebar-background: #FFFFFF;
  --sidebar-border-color: #F2F2F7;
  --code-background: #FAFAFC;
  --code-color: #4D0E4E;
}
```

---

## 2. Spacing Grid (8px Base)

| Token | px | Usage |
| :--- | :--- | :--- |
| `space-xs` | 4px | Micro labels & tag badges |
| `space-sm` | 8px | Text inside cards |
| `space-md` | 16px | Container gutters |
| `space-lg` | 24px | Row & component spacing |
| `space-xl` | 48px | Viewport margins |
| `space-xxl` | 64–96px | Major section separators |

---

## 3. Alternative Presets Available

- **`sleek-dark`**: High-contrast dark mode (`#090D16`), cyan (`#06B6D4`) and violet (`#8B5CF6`) accents.
- **`glassmorphism`**: Translucent cards, backdrop blur, deep gradient backdrop.
- **`neo-brutalism`**: Canary yellow (`#FFE600`), 3px solid black borders, hard offset shadows.
- **`nordic-warm-editorial`**: Warm linen (`#FDFBF7`), forest green and terracotta accents.
