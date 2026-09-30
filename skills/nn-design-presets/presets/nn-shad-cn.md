# NN Shad-CN (Monochrome Neutral)

shadcn/ui-inspired monochrome interface. Strict black / white / neutral-gray palette where color appears only for semantic meaning (destructive red, success green, warning amber, info blue). Faithful to the real shadcn/ui "neutral" base color: pure white canvas, near-black primary (`#171717`), hair-thin neutral borders, soft shadows, and restrained elevation. Two modes — light and dark — sharing the same token names.

## Core Tokens

Values align with the official shadcn/ui neutral base color (hex approx of the OKLCH tokens; see `ui.shadcn.com/docs/theming`):

```yaml
mode: MONOCHROME_DUAL_MODE
palette_light:
  bg_page: "#FFFFFF"       # background
  bg_surface: "#FFFFFF"    # card
  bg_inert: "#F4F4F5"      # muted / subtle surface
  bg_card: "#FFFFFF"
  brand_primary: "#171717" # primary (buttons) — near-black
  brand_hover: "#0A0A0A"
  border_color: "#E5E5E5"  # border / input
  border_soft: "#E5E5E5"
  ink_primary: "#0A0A0A"   # foreground
  ink_muted: "#737373"     # muted-foreground
  ink_faint: "#A1A1A1"
palette_dark:
  bg_page: "#0A0A0A"
  bg_surface: "#0A0A0A"
  bg_inert: "#27272A"
  bg_card: "#0A0A0A"
  brand_primary: "#E5E5E5" # primary (buttons) — near-white
  brand_hover: "#FAFAFA"
  border_color: "#27272A"
  border_soft: "#27272A"
  ink_primary: "#FAFAFA"
  ink_muted: "#A1A1A1"
  ink_faint: "#737373"
semantic:
  success: "#16A34A"   # positive / verified state only
  danger: "#E7000B"    # destructive / delete / failure (shadcn destructive)
  warning: "#D97706"   # warnings / pending attention only
  info: "#2563EB"      # informational links / highlights only
typography:
  sans_ui: "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif"
  mono_technical: "'JetBrains Mono', 'Fira Code', monospace"
shadows:
  card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)"
  focus: "0 0 0 2px rgba(10,10,10,0.25)"
radii:
  sm: "6px"
  md: "8px"
  lg: "10px"
```

## Spacing Grid (4px Base)

| Token | px | Usage |
|-------|----|-------|
| space-xs | 4px | Badges, dot indicators, inline gaps |
| space-sm | 8px | Input padding, compact chips |
| space-md | 12px | Card padding, tight rows |
| space-lg | 16px | Panel padding, section gaps |
| space-xl | 24px | Large section separation |
| space-xxl | 40px | Screen-level blocks, headers |

## Application Rules

- **Palette**: Mono only — pure white canvas, near-black primary, neutral borders. Semantic colors (`success`, `danger`, `warning`, `info`) appear ONLY for status signaling (verified badge, delete button, error state, link). No decorative color, no gradients, no neon, no glow.
- **Surfaces & Borders**: Hair-thin `1px` borders in neutral `#E5E5E5` (light). Cards are white with a quiet shadow; no blur, no strong elevation.
- **Buttons**: Primary is near-black (`#171717`) with white text (light mode). Destructive is always red. Outline and ghost variants share the same radii. Consistent height (~36px).
- **Focus & Keyboard**: 2px ring in ink on `:focus-visible`, never color. Every interactive control is keyboard-accessible with a visible focus ring.
- **Typography**: `Inter` for UI and prose; `JetBrains Mono` for tokens, ids, and code. Hierarchy comes from scale and spacing, not from color.
- **Status Semantics (the only color allowed)**:
  - `success`: verified / done → background `rgba(22,163,74,0.1)`, text `#16A34A`
  - `danger`: deletion, failure, destructive confirm → background `rgba(231,0,11,0.1)`, text `#E7000B`
  - `warning`: pending, manual gate, caution → background `rgba(217,119,6,0.1)`, text `#D97706`
  - `info`: links, highlights, informational pill → background `rgba(37,99,235,0.1)`, text `#2563EB`
  These are the ONLY places color may appear. Everything else stays in the neutral scale.