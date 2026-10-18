# Console UI Kit (`InnfoUI`)

`ui-kit.js` is the single source of truth for console **design tokens** and
**presentational components**. It is one UMD source in the console bundle
(global `InnfoUI`) and ships **before** `innfo-runtime.js`, which consumes it
through UMD factory injection.

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
  StatusBadge(data), CitationIcon(data, opts?),
  Toast(data, opts?), RailProgress(data),
  describeUnit(kind, ref, index?) -> descriptor,
  Ku(kind, ref, opts?) -> span.innfo-ku-wrap,
  createKu({ doc, onAction }) -> { destroy },
  KuInfoPanel(descriptor) -> dialog,
  FieldRow(data, opts?), ElementCard(data, opts?),
  DraftList(data, opts?), RelList(data, opts?),
  KpiGrid(data, opts?), defineCustomElements(doc?),
  DataTable(data, opts?), MatrixGrid(data, opts?), Timeline(data, opts?),
  FilterSelect(data, opts?),
}
```

Every component root carries `data-innfo-component="<kebab-name>"`. Invalid
`data` throws `TypeError('InnfoUI.<Name>: <reason>')`.

### Components

| Component | Root | Key `data-*` |
|---|---|---|
| `Ku(kind, ref, { variant?, body? })` | `span.innfo-ku-wrap` > `[data-innfo-component="ku-unit"]` | `data-ku-kind`, `data-ku-nature`, `data-ku-home`, `data-ku-address`; action cluster is a sibling `.innfo-ku-actions` |
| `describeUnit(kind, ref, index?)` | pure descriptor | `{ kind, nature, home, address, label, slot, vtype?, editability, facts }` |
| `KuInfoPanel(descriptor)` | `dialog[data-innfo-component="ku-info-panel"]` | focus moves to the heading; Escape restores focus |
| `StatusBadge({ status, count?, label?, title? })` | `span` | `data-status` (`local`\|`proposed`\|`applied`\|`conflict`); `label` sets the visible word, `title` the tooltip |
| `Toast({ title, body }, { onClose })` | `div.innfo-change-toast` | `data-innfo-component="toast"`, `role="status"`; dismiss control calls `onClose` |
| `RailProgress({ total, pending })` | `span.innfo-rail-progress` | `data-total`, `data-pending`; text `pending/total` |
| `CitationIcon({ variant, field }, { onOpen? })` | `button` | `data-origin`, `data-field`; click stops propagation |
| `FieldRow({ name, value, citations?, ref?, inherited? }, { model?, element?, onRef?, onCite? })` | `ku-unit` (kind `value`) | `data-ku-kind="value"`, `data-field`; inherited values render `inherited from <Concept>` with editability `none` |
| `ElementCard({ id, name, conceptId?, description?, fields, inherited? }, opts)` | `article` | `data-element-id`, `data-concept-id`, `data-open`; name is an `element` unit, fields are `value` units |
| `DraftList({ drafts, byId }, { modelId })` / `RelList({ relations, byId }, { modelId })` | `ul` | each chip is a `ku-unit` addressed by canonical address |
| `KpiGrid({ items: [{ label, value, concept?, hint? }] }, { doc? })` | `div.innfo-kpi-grid` | `data-innfo-component="kpi-grid"`; responsive grid of KPI cards |
| `DataTable({ columns, rows, emptyText? }, { doc, modelId?, onEdit?, onSelect? })` | `div.innfo-grid-scroll` | `data-innfo-component="data-table"`; element-oriented columns (`kind: 'element' \| 'field' \| 'text'`) |
| `MatrixGrid({ rowHeader?, columns, rows, pinFirstColumn?, emptyText? }, { doc })` | `div.innfo-grid-scroll` | `data-innfo-component="matrix-grid"`, `data-pin-first`; rows × columns of arbitrary cells |
| `Timeline({ rowHeader?, periods, lanes, pinFirstColumn?, emptyText? }, { doc })` | `div.innfo-grid-scroll` | `data-innfo-component="timeline"`, `data-pin-first`; a matrix whose columns are periods |
| `FilterSelect({ label, options, selected?, quick? }, { doc, onChange? })` | `details.innfo-filter` | `data-innfo-component="filter-select"`; multi-select checkbox facet with quick actions |

### FilterSelect: the reusable facet

`FilterSelect` is the same control the console filter bar uses for
Models / Concepts / Fields, packaged so any view can drop it in (state, months,
tags) instead of hand-rolling a menu. It is a token-styled `<details>` facet:

- `options`: `[{ value, label, count?, selected? }]` (a bare string is allowed
  and becomes both value and label).
- initial `selected` is a `{ value: true }` map or a `[value]` array; per-option
  `selected: true` also counts.
- the summary reads `label: todos (n)`, `label: ninguno`, `label: <one>` or
  `label: k/n` as the selection changes.
- `quick`: `[{ label, values }]` buttons; `values` is an array, or `'all'` /
  omitted for "select everything".
- `onChange(values)` fires with the next selection (an array of values) on every
  user toggle and quick action. The element also exposes `getSelection()` and
  `setSelection(values, silent?)` for programmatic control.


### Data surfaces: one grid, three façades

`DataTable`, `MatrixGrid` and `Timeline` are the same object at three zoom levels — a
grid of cells addressed by `(row, column)` with a sticky header row and an
optional sticky first column. ONE internal builder (`buildGrid`) paints all
three; the public functions only adapt their input shape, so layout, sticky
behaviour, empty state and cell coercion live in a single place.

- **Cell values** may be a DOM node (a renderer returned one) or a primitive.
  Strings are written with `textContent` — never `innerHTML`.
- **Row shape**: `{ key?, header?, cell?, cells? }`. `header` may be a string,
  a DOM node, or `(row, i) => node|string`; the cell is `cells[col.key]`, a
  `(col, rowIndex, colIndex) => node|string` function, or nothing.
- **`DataTable`** renders an element: `columns[].kind` is `'element'` (a canonical
  `Ku` element badge, clickable when `onEdit`/`onSelect` is given), `'field'` /
  `'value'` (the declared field value via `FieldValue`, falling back to its
  text), or anything else (plain text). It is the shape the `table` scaffold
  template already calls.
- **`MatrixGrid`** and **`Timeline`** share the row-header + pinned-first-column
  path; `Timeline` only relabels the columns as periods and centres them.
- **Horizontal scroll is owned by the component** (`.innfo-grid-scroll` carries
  `overflow:auto`, `max-width:100%`, `min-width:0`). A wide matrix never widens
  the page — do NOT wrap these in a Tailwind `overflow-x-auto`, which the
  bundle does not ship.

Domain views and the `table` scaffold template use these instead of
hand-rolled `<table>` markup. When a view needs a legend, a filter toolbar or a
summary line, it renders them as siblings above the returned surface.


### Declarative Web Components

When running in browser contexts, `ui-kit.js` registers a legacy `<innfo-ku>`
custom element that delegates to `Ku`:
- `<innfo-ku kind="value" model="m" name="horas" label="120"></innfo-ku>`
- `<innfo-ku kind="element" model="m" id="el-1" label="Bootcamp"></innfo-ku>`

### View Scaffolding CLI

Use `export-console.mjs` to scaffold new views for domains or blueprints:
```bash
# Domain custom view (<workspaceRoot>/consoles/views/<slug>.js)
node scripts/export-console.mjs <workspaceRoot> --new-view mi-resumen --template table --title "Mi Resumen"

# Blueprint view (<blueprintDir>/assets/console-view-<slug>.js)
node scripts/export-console.mjs <workspaceRoot> --new-view timeline --blueprint metrics --template kpi
```
Templates: `table` (default), `kpi`, `blank`.

### Knowledge units (`Ku`)

`Ku` is the single builder for every knowledge unit: one grammar, one presentation
per canonical address. Allowed kinds: `domain`, `document`, `section`, `element`,
`value`, `concept`, `field`, `matrix`, `source`. Every badge carries
`data-ku-kind`, `data-ku-nature` (`container` / `structure` / `content`),
`data-ku-home` (`domain` / `blueprint` / `knowledge` / `source`) and
`data-ku-address` (parsed by `innfo-core`'s `parseUnitAddress`).

- `Ku(kind, ref, { variant?, body? })`: `ref` carries the identity facts
  (`model`, `family`, `id`, `concept`, `name`, `field`, `element`, `row`, `col`,
  `address`). Sections and definitions are prefixed with `concept:` / `matrix:`;
  element, value and cell addresses stay equal to changeset `target::`.
- Visual grammar: container = double border, structure = dashed + mono, content =
  solid, source = warm `--innfo-source-paper` fill, concept identity via slots.
- The action cluster (`span.innfo-ku-actions`) is always OUTSIDE the badge root.
  Info is always present; edit appears when `describeUnit(...).editability !== 'none'`.
  CSS hides edit under `html:not([data-innfo-review=on])` and structure pencils
  under `html:not([data-innfo-structure=on])`.
- `createKu({ doc, onAction })` installs ONE delegated listener per document and
  forwards `(action, descriptor)`; the kit owns no review state.
- A pending-change pip (`button[data-innfo-component="ku-change-pip"]`) sits beside
  the badge and is keyed by canonical address (`data-ku-changes` holds the count).

`ElementCard` opts: `domId`, `collapsible`, `open`, `head[]` (into
`.innfo-card-head`), `body[]` (into `.innfo-card-body`), `concept` (concept
color/icon/index for the name badge), `onRef`, `onCite`.

### Edit modal widgets (`EditModal`)

`EditModal(data, { doc, onSave, onCancel })` is the one shared value editor (the
review controller owns it). It never changes the type of the value it edits:

- `type: 'number'` → `input[type=number]`; Save proposes `Number(input)`. An
  empty or non-finite input shows an inline error (`.innfo-edit-error`) and does
  not call `onSave`.
- `type: 'select'` → `select[data-innfo-widget=select]` whose first option is
  blank (value `""`). When the current value is not among `options`, one extra
  option carrying it is added and selected, marked `data-not-in-options="true"`,
  so an unchanged save proposes the original value.
- `type: 'boolean'` / `'multiselect'` / `'reference'` / `'markdown'` keep their
  dedicated widgets (`data-innfo-widget`).
- a string containing a newline **or** longer than 70 characters edits in a
  `textarea` and is proposed verbatim; other strings keep the single-line input.
- an array or object value opens the modal comment-only: the Propose control is
  disabled, a note (`List and object values are proposed as a comment.`) is
  shown, and the value is never `String()`-coerced or passed to a text control.
  A `commentOnly` target (an element-level comment) hides the mode toggle
  entirely instead.

### Read rendering of declared field types (`FieldValue`)

The caller resolves the declared type from (concept, field) and passes it as `type`.

- `select` renders a pill (`.innfo-field-select`, `data-value`); an empty value renders nothing.
  The edit modal offers exactly the declared options plus the blank option and the preserved
  current value.
- `image` / `video` / `audio` render a preview or a native player followed by the path. A media
  `src` is set only for a relative path or an `http(s)` URL; any other value (`javascript:`,
  `data:`, ...) is shown as text.
- `knowledge` renders a document pill. It is clickable only when the caller passes
  `opts.onKnowledge` (and `opts.isKnowledgeBound(value)` returns true); the runtime binds it to the
  `model:` filter of the model the value names. An unbound pill is inert; the console never
  creates or binds a model.
- `reference` edits against the same model's elements, narrowed to the field's
  `target_concepts` when declared, and always proposes `[[Display Name]]`.

### Markdown (`InnfoUI.Markdown`)

`Markdown(text, { doc })` renders a fixed subset by building DOM nodes only; it never parses
markup, so raw HTML is shown as text. `markdown` and `markdown_inline` fields use it;
`markdown_file` stays a path pill.

Supported subset: `#`-`######` headings, `-`/`*`/`+` and `1.` lists, `> ` block quotes and
`> [!NOTE]`-style callouts (NOTE, TIP, IMPORTANT, WARNING, CAUTION), paragraphs with line breaks,
`**strong**`, `*em*` / `_em_`, `` `code` `` and `[text](url)`. A link is an `a` (with
`target="_blank"` and `rel="noopener noreferrer"`) only for `http(s)` or a relative path; control
characters, `//` and `\` prefixes and every other scheme render the whole `[text](url)` as text.
Anything else (tables, images, nested lists, HTML) is literal text, so nothing is lost.
`InnfoUI.safeHref(url)` exposes the same link check.

### Tags and the filter

`ElementCard` renders `TagRow` from `element.tags` only when it is non-empty (the review
controller adds its own row for "+ tag" on untagged cards). With `opts.onTag` each chip is a
button; the runtime wires it to add `tag:<t>` to the active filter.

`element.tags` is the only tag source (a field merely named `tags` is not one). Filter facets
combine as follows:

| Token | Meaning |
|---|---|
| `tag:a tag:b` | AND, exact and case-insensitive: the element carries both |
| `tag-any:a tag-any:b` | OR group: the element carries at least one |
| `concept:` / `model:` (repeated) | OR within the facet |
| different facets, text | AND |

The search box tooltip states the asymmetry (tags narrow, concepts and models widen).

### Open original

A citation entry with an `href` (written by `export-console.mjs`, relative to the console file)
shows an "Open original" link in the citation dialog when the `href` is a relative path or an
`http(s)` URL. Error entries and unsafe hrefs show none; there is no preview, code or lineage mode
for the file.

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
`procedures/**/export/**`, and the test fixtures (`simulacro-refactorizacion`) are **permanent history**. They keep their own inlined CSS, are
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
