# Morado Nazareno

Brand palette `#4D0E4E` with strict light mode, 8px grid, and clean editorial typography.

## Core Tokens

```yaml
mode: STRICT_LIGHT_MODE
palette:
  canvas_base: "#FFFFFF"
  canvas_inert: "#FAFAFC"
  brand_primary: "#4D0E4E"
  border_soft: "#F2F2F7"
  ink_primary: "#111112"
  ink_muted: "#636366"
typography:
  sans_ui: "Plus Jakarta Sans, Geist Sans, system-ui, sans-serif"
  serif_editorial: "Playfair Display, Georgia, serif"
  mono_technical: "Geist Mono, JetBrains Mono, monospace"
```

## Spacing Grid

| Token | px | Usage |
|-------|----|-------|
| space-xs | 4 | Labels, micro tags |
| space-sm | 8 | Text inside cards |
| space-md | 16 | Container gutters |
| space-lg | 24 | Row spacing |
| space-xl | 48 | Outer viewport margins |
| space-xxl | 64-96 | Section separators |

Max layout: `1280px` centered, min margin `24px` each side.

## Typography

| Style | Size | Weight | Line-height | Spacing |
|-------|------|--------|-------------|---------|
| H1 hero | 48px | 800 | 1.15 | -0.03em |
| H2 section | 32px | 700 | 1.25 | -0.02em |
| H3 subsection | 22px | 600 | 1.35 | -0.01em |
| Body | 16px | 400 | 1.6 | 0 |
| Caption | 13px | 500 | 1.4 | +0.01em |

- **Serif accent**: Playfair Display italic on one focal word per header
- **Mono**: Geist Mono 14px/1.5 for code

## Palette Mechanics

| Token | Hex | Rule |
|-------|-----|------|
| Canvas Base | #FFFFFF | Primary backdrop, no gray |
| Canvas Inert | #FAFAFC | Code blocks, card beds |
| Brand Primary | #4D0E4E | Headers, CTAs, nav selection |
| Border Soft | #F2F2F7 | 1px dividers, no shadows |
| Ink Primary | #111112 | Body text, headings |
| Ink Muted | #636366 | Labels, metadata |

## Layouts

### Commercial
- Flat white canvas, no grids or watermarks
- CTA: solid `#4D0E4E` bg with white text
- Secondary: 1px `#4D0E4E` outline
- Cards: white, `#F2F2F7` border, 8-12px radius

### Docsify
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

## Favicon

Generate `.ico` with 16, 32, 48px variants. Use `#4D0E4E` as bg or dominant accent. Simple geometric shape. Include PNG fallbacks and SVG option.

## Image Style Prompting

| Style | Description |
|-------|-------------|
| **Alpha** — Minimalist Flat Vector | 2D flat, no outlines, clean color fields over light bg |
| **Beta** — Corporate Doodle Line Art | Hand-drawn vector, uniform black ink, monochrome |
| **Gamma** — 3D Orthographic Isometric | 30° isometric, geometric blocks, bright gradients |
| **Delta** — Cell-Shaded Pop-Art | Comic style, black contour lines, flat colors + hard shading |
