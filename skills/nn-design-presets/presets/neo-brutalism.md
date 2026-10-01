# Neo-Brutalism (Bold Pop & Retro)

Estilo de alto impacto, desenfadado y lleno de energía. Utiliza bordes negros gruesos (`3px`), sombras duras desplazadas sin desenfoque (`5px 5px 0px #000`), colores saturados y tipografía mono/bold.

## Core Tokens

```yaml
mode: NEO_BRUTALIST_LIGHT
palette:
  canvas_base: "#FFFDF5"
  canvas_inert: "#FFE600"
  brand_primary: "#FFE600"
  brand_secondary: "#FF3366"
  accent_cyan: "#00F0FF"
  border_soft: "#000000"
  ink_primary: "#000000"
  ink_muted: "#222222"
typography:
  sans_ui: "'Space Grotesk', 'Syne', system-ui, sans-serif"
  serif_editorial: "'Syne', sans-serif"
  mono_technical: "'Space Mono', monospace"
shadows:
  card: "5px 5px 0px #000000"
  glow: "7px 7px 0px #000000"
radii:
  sm: "0px"
  md: "4px"
  lg: "8px"
borders:
  thick: "3px solid #000000"
```

## Spacing Grid (8px Base)

| Token | px | Usage |
|-------|----|-------|
| space-xs | 4px | Badges de alerta dura |
| space-sm | 8px | Botones tipo etiqueta retro |
| space-md | 16px | Padding interno de tarjetas neo-brutalistas |
| space-lg | 24px | Gutters de componentes |
| space-xl | 48px | Bloques de héroe |
| space-xxl | 64px | Separación extrema |

## Reglas de Aplicación

- **Bordes Obligatorios**: Todos los elementos interactivos, tarjetas y botones LLEVAN borde `3px solid #000000`.
- **Sombras Duras**: Sombras desplazadas `4px 4px 0px #000000` sin blur. Al presionar botones, la sombra disminuye a `1px 1px 0px #000000` simulando el click físico.
- **Paleta Pop Saturada**: Fondo crema `#FFFDF5`, botones amarillo canario `#FFE600`, magenta/rojo `#FF3366` o cian `#00F0FF`.
- **Esquinas Rectas o Semirectas**: `0px` o máximo `4px` para mantener el espíritu retro-computacional.
