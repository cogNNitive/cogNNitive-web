# Sleek Dark Mode (Cyber & High Tech)

Estilo oscuro futurista de alto contraste. Canvas azul noche/carbón con acentos neón cian `#06B6D4` y violeta eléctrico `#8B5CF6`, ideal para dashboards técnicos, desarrolladores y herramientas SaaS.

## Core Tokens

```yaml
mode: HIGH_CONTRAST_DARK_MODE
palette:
  canvas_base: "#090D16"
  canvas_inert: "#131B2E"
  brand_primary: "#06B6D4"
  brand_secondary: "#8B5CF6"
  border_soft: "#1E293B"
  ink_primary: "#F8FAFC"
  ink_muted: "#94A3B8"
typography:
  sans_ui: "'Outfit', 'Inter', system-ui, sans-serif"
  serif_editorial: "'Space Grotesk', sans-serif"
  mono_technical: "'JetBrains Mono', 'Fira Code', monospace"
shadows:
  card: "0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)"
  glow: "0 0 20px rgba(6, 182, 212, 0.35)"
radii:
  sm: "6px"
  md: "10px"
  lg: "16px"
```

## Spacing Grid (8px Base)

| Token | px | Usage |
|-------|----|-------|
| space-xs | 4px | Badges de código, indicadores de estado |
| space-sm | 8px | Pistas de inputs, paddings compactos |
| space-md | 16px | Padding en paneles oscuros |
| space-lg | 24px | Separación de tarjetas de métricas |
| space-xl | 48px | Espaciado entre secciones |
| space-xxl | 64px | Encabezados de dashboards |

## Reglas de Aplicación

- **Canvas Principal**: `#090D16` con sutil resplandor cian/violeta radial en el fondo.
- **Paneles y Tarjetas**: Fondo `#131B2E` con borde `#1E293B` y sombra oscura profunda.
- **Botones Primarios**: Gradiente cian `#06B6D4` a violeta `#8B5CF6` con texto oscuro o blanco de alto contraste.
- **Detalles Neón**: Bordes activos e indicadores de foco con resplandor `0 0 12px rgba(6, 182, 212, 0.4)`.
