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
  KuBadge(data, opts?), KuActions(data, opts?),
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
| `FieldRow({ name, value, citations?, ref? }, { onRef?, onCite? })` | `ku-badge` (kind `field`) | `data-ku-kind="field"`, `data-field`; one `CitationIcon` per distinct origin in canonical order |
| `ElementCard({ id, name, conceptId?, description?, fields, markers? }, opts)` | `article` | `data-element-id`, `data-concept-id`, `data-open` |

### Knowledge-unit badges (`KuBadge`)

`KuBadge` is the single family for every knowledge unit: one grammar, one
presentation per canonical address. `data.kind` is one of `document`, `element`,
`concept`, `field`, `cell`, `marker`, `reference`. The badge shape encodes the kind
(`data-ku-kind`); the concept color encodes the concept (`data-concept-slot`,
1..12); the slug is the identity (`data-element-id` / `data-concept-id` /
`data-field` / `data-marker-id`). A `field` badge reads `name: value`; a `cell`
badge shows the value only; an `element` badge carries the concept-color border and
the concept icon; a `concept`/`document` badge carries a concept-tinted fill.

- `KuBadge({ kind, id?, name?, value?, label?, index?, color?, icon?, markerKind?, changes? }, opts?)`.
- `opts.onInfo` / `opts.onEdit` / `opts.onChanges` render the action cluster OUTSIDE
  the badge root (in `KuActions`), so an action is never nested inside a navigable
  badge; `opts.href` / `opts.onSelect` make the badge navigable when it has no action.
- `data.changes > 0` renders a count pip child (`ku-change-pip`) and sets
  `data-ku-changes`; the badge border reflects pending changes.

`KuActions({}, { onInfo?, onEdit? })` renders `data-innfo-component="ku-actions"`
with `[data-ku-action="info"]` and/or `[data-ku-action="edit"]`. The kit holds no
mode state: the edit control exists only because the caller passed `onEdit`.

`ElementCard` opts: `domId`, `collapsible`, `open`, `head[]` (into
`.innfo-card-head`), `body[]` (into `.innfo-card-body`), `concept` (concept
color/icon/index for the name badge), `onRef`, `onCite`.

## Tokens

`TOKEN_VALUES` holds a light and a dark value for every `--innfo-*` token:
surfaces (`--innfo-bg`/`-surface`/`-surface-2`), text (`--innfo-text`/`-muted`/
`-border`), `--innfo-accent`/`-link`/`-focus`, 12 `--innfo-concept-N` plus a
matching `--innfo-concept-N-bg` tint for tinted badge fills, status
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
  `[data-innfo-component=ku-badge][data-ku-kind=field][data-field]` inside it,
  `[data-innfo-component=concept-pill][data-concept-id]`, the `ku-actions` cluster
  (`[data-ku-action]`), the change pip (`[data-innfo-component=ku-change-pip]`),
  and the `.innfo-card-head` / `.innfo-card-body` containers.
- `TOKEN_VALUES`, `TEXT_PAIRS`, `StatusBadge` (with `stale`) and the review
  components are exported for the review UX layer.
