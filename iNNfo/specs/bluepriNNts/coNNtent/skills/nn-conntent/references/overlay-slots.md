# Overlay Slots (D1)

An overlay renders by mounting, as a **root-level host** with global times, the component whose
name the `components` cascade resolves for its slot. The engine emits no overlay markup or CSS of
its own: the component owns its look and layout.

The **fallback** for a slot is `components/<slot>.html`, shipped by this skill. Its
`data-composition-variables` list **IS the slot contract**: a resolved component MUST declare a
superset of it, or emission fails with `SlotContractError: slot "<slot>": <path> missing
variables: <names>`.

## Slots and variables

Every slot declares `text`, `src`, `position`, `enter`, `exit`, `font` and `accent`; `b-roll` also
declares `fit`. The host passes the overlay's `text`/`src`/`position` and its `enter`/`exit`
animations, plus the cascaded `frame`'s `font` and `accent`, as `data-variable-values` (a JSON
object keyed by variable id). `b-roll` adds the cascaded `fit`.

| Slot (`type::`) | Manifest `type` | Variables | Registry hint |
| --- | --- | --- | --- |
| `title` | `kineticTitle` | text, src, position, enter, exit, font, accent | `kinetic-type` / a text-stagger title |
| `lower-third` | `lowerThird` | text, src, position, enter, exit, font, accent | `lower-third` |
| `caption` | `captions` | text, src, position, enter, exit, font, accent | `caption` / a static credit |
| `quote` | `quote` | text, src, position, enter, exit, font, accent | `quote` card |
| `watermark` | `watermark` | text, src, position, enter, exit, font, accent | `watermark` notice |
| `b-roll` | `broll` | text, src, position, enter, exit, font, accent, **fit** | `media-clip` (no motion) |

A component binds text and media without script (`data-var-text="text"`, `data-var-src="src"`) and
reads `font`, `accent` and `fit` in CSS (`var(--font, Inter)`, `var(--accent, #7c3aed)`,
`var(--fit, cover)`).

## Where a component lives

A component is named by the `components` cascade parameter (`components:: [lower-third=pill]`) and
found as `components/<name>.html` by the nearest-folder walk — episode, then series, then domain,
then this skill's `components/` fallback. A nearer file wins. A name set at any user level with no
file fails pre-compile with `MissingAssetError` naming the name, the level and every path searched;
a blueprint default with no file is skipped with one warning.

## Sound event keys

Sound effects are bound to engine events, never to a slot's name. The keys are: `video-start`,
`video-end`, `scene-boundary`, `overlay-enter.<slot>` and `overlay-exit.<slot>` for `title`,
`lower-third`, `caption`, `quote` and `watermark`, and `layer-enter.<type>` for `b-roll`,
`animation` and `presenter`. Sounds ride the root audio track (no `data-duration`). An event with
no resolved name is silent. See `references/folder-contract.md` for where `sounds/<name>.*` live.
