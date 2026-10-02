# Console UI Kit (`InnfoUI`)

`ui-kit.js` is the single source of truth for console **design tokens** and
**presentational components**. It is one UMD source in the console bundle
(global `InnfoUI`) and ships **before** `innfo-runtime.js` and
`render-model-viewer.js`, which consume it through UMD factory injection.

- Tokens are injected once as `<style data-innfo-tokens="<VERSION>">`.
- Theming is driven solely by `data-theme` on `<html>` (`light` / `dark` / absent
  = follow the OS). There is no `.dark` class mechanism.
- Components create DOM, keep no module state, and write text via `textContent`.
  No shadow DOM.

## Public API

```js
InnfoUI = {
  VERSION,
  TOKEN_VALUES,          // { light: {...}, dark: {...} }
  TOKENS,                // token names
  generateTokenCss(values?) -> string,
  ensureTokens(doc?) -> HTMLStyleElement,
  setTheme(doc, 'light' | 'dark' | null),
  icon(name, size?, cls?) -> string,
  slug(s) -> string,
  conceptSlot({ index, color? }) -> 1..12,
  ORIGIN_VARIANTS,       // ['error','agent','human','reviewer','document']
  CITATION_ORIGIN_LABELS,
  ConceptPill(data, opts?), ElementPill(data, opts?), MarkerChip(data), StatusBadge(data),
  CitationIcon(data, opts?), FieldRow(data, opts?), ElementCard(data, opts?),
}
```

Every component root carries `data-innfo-component="<kebab-name>"`. Invalid
`data` throws `TypeError('InnfoUI.<Name>: <reason>')`.

### Components

| Component | Root | Key `data-*` |
|---|---|---|
| `ConceptPill({ id, label, index, color?, count? }, { onSelect? })` | `button` (or `span` when no `onSelect`) | `data-concept-id`, `data-concept-slot` |
| `ElementPill({ id, label, origin? }, { href?, onSelect? })` | `a` / `button` / `span` | `data-element-id`; origin icon child `[data-origin]` |
| `MarkerChip({ id, label, kind, value? })` | `span` | `data-marker-id`, `data-kind` |
| `StatusBadge({ status, count? })` | `span` | `data-status` (`pending`\|`applied`\|`rejected`\|`stale`) |
| `CitationIcon({ variant, field }, { onOpen? })` | `button` | `data-origin`, `data-field`; click stops propagation |
| `FieldRow({ name, value, citations?, ref? }, { onRef?, onCite? })` | `div` | `data-field`; one `CitationIcon` per distinct origin in canonical order |
| `ElementCard({ id, name, conceptId?, description?, fields, markers? }, opts)` | `article` | `data-element-id`, `data-concept-id`, `data-open` |

`ElementCard` opts: `domId`, `collapsible`, `open`, `head[]` (into
`.innfo-card-head`), `body[]` (into `.innfo-card-body`), `onRef`, `onCite`.

## Tokens

`TOKEN_VALUES` holds a light and a dark value for every `--innfo-*` token:
surfaces (`--innfo-bg`/`-surface`/`-surface-2`), text (`--innfo-text`/`-muted`/
`-border`), `--innfo-accent`/`-link`/`-focus`, 12 `--innfo-concept-N`, status
(`--innfo-status-{pending,applied,rejected,stale}` + `-bg`), origin
(`--innfo-origin-{agent,human,reviewer,document,error}`), radii, `--innfo-font`,
`--innfo-mono`, `--innfo-shadow`. `generateTokenCss` is the only place the CSS is
produced; nothing is hand-written twice.

**Contrast**: status foregrounds meet WCAG AA (>= 4.5:1) against their own `-bg`
in both themes, the allowed text pairs meet 4.5:1, and origin icons meet 3:1 on
`--innfo-surface`. These are enforced by `console-ui-kit-contrast.test.ts` with an
independent luminance function. Light `--innfo-muted` is **not** allowed on
`--innfo-surface-2` (chips use `--innfo-text`).

## Build and check

```bash
npm run build:console        # regenerate the committed bundle
npm run check:console-bundle # fail (exit 1) on drift between sources and bundle
```

`scripts/lib/console-bundle.js` owns `SOURCES`, composition and the drift check;
`scripts/build-console-bundle.mjs` is a thin entry. The drift suite
(`console-bundle.test.js`) asserts the bundle equals a fresh build, that one
altered byte fails and names the file, and that the bundle contains no `fetch(`
and no `type=module`.

Shells must consume `var(--innfo-*)` and hold **no** `:root` color literals;
`scripts/lib/console-shell-guard.js#findRootColorDeclarations` enforces this for
every discovered console shell.

## Frozen copies

The export/sample console bundles under `metrics/samples/`,
`procedures/**/export/**`, and the test fixtures (`simulacro-refactorizacion`,
`legacy-domain`) are **permanent history**. They keep their own inlined CSS, are
never migrated to tokens, and are excluded from the shell guard (it skips
`/samples/` and `/export/`).

## Hand-off to review UX

- One card commit point per renderer: `InnfoConsole.refresh` -> `mountElementCards`
  and the viewer's `render()`.
- Stable hooks: `[data-innfo-component=element-card][data-element-id]`,
  `[data-innfo-component=field-row][data-field]` inside it,
  `[data-innfo-component=concept-pill][data-concept-id]`, and the
  `.innfo-card-head` / `.innfo-card-body` containers.
- `TOKEN_VALUES`, `TEXT_PAIRS`, `StatusBadge` (with `stale`) and the review
  components are exported for the review UX layer.
