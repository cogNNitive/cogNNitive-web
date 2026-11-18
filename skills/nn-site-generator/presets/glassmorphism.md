# Minimalist Glassmorphic (Ambient Glass)

Estilo etéreo y sofisticado basado en capas translúcidas, desenfoque de fondo (*backdrop-filter*) y gradientes suaves. Aporta una sensación premium, ligera e inmersiva.

## Core Tokens

```yaml
mode: AMBIENT_GLASS_MODE
palette:
  canvas_base: "linear-gradient(135deg, #0b091a 0%, #161233 50%, #0d1b2a 100%)"
  canvas_inert: "rgba(255, 255, 255, 0.05)"
  brand_primary: "#EC4899"
  brand_secondary: "#3B82F6"
  border_soft: "rgba(255, 255, 255, 0.12)"
  ink_primary: "#FFFFFF"
  ink_muted: "rgba(255, 255, 255, 0.7)"
typography:
  sans_ui: "'Plus Jakarta Sans', system-ui, sans-serif"
  serif_editorial: "'Space Grotesk', sans-serif"
  mono_technical: "'Fira Code', monospace"
shadows:
  card: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
  glow: "0 0 25px rgba(236, 72, 153, 0.3)"
radii:
  sm: "8px"
  md: "16px"
  lg: "24px"
effects:
  backdrop_blur: "blur(16px) saturate(180%)"
```

## Spacing Grid (8px Base)

| Token | px | Usage |
|-------|----|-------|
| space-xs | 4px | Tags de cristal |
| space-sm | 10px | Padding interno tarjetas traslúcidas |
| space-md | 20px | Separación de tarjetas flotantes |
| space-lg | 32px | Contenedores modales |
| space-xl | 48px | Secciones héroe |
| space-xxl | 80px | Márgenes exteriores |

## Reglas de Aplicación

- **Canvas Principal**: Fondo oscuro con gradiente vibrante inmersivo y micropartículas o esferas de luz de fondo.
- **Paneles y Tarjetas**: Relleno `rgba(255, 255, 255, 0.06)`, `backdrop-filter: blur(16px)`, y borde traslúcido `1px solid rgba(255, 255, 255, 0.15)`.
- **Botones**: Gradiente translúcido brillante rosa `#EC4899` a azul `#3B82F6` con brillo en hover.
- **Bordes con Gradiente**: Efectos de destello en los bordes superiores de las tarjetas.
