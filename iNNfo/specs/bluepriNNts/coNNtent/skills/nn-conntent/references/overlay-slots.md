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
object keyed by variable id). `b-roll` adds the cascaded `fit` as one CSS `object-fit` value: the
keyed `fit`'s `native` value when it is `cover` or `contain`, and `contain` for a treatment the
slot cannot draw (`blur`, `card`, `component:<name>`), so the whole asset stays visible.

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

## Layout: the safe area of each canvas

Every output format is its own project (`hyperframes/<W>x<H>/`), and its root declares the
canvas safe area as `--safe-top`, `--safe-right`, `--safe-bottom` and `--safe-left` in pixels
(`scripts/lib/safe-area.mjs`): the title-safe 10% of each side, and on a vertical canvas also
14% at the top and 35% at the bottom, clear of the platform interface bands. A component lays
its `#root` out on those variables (`top: var(--safe-top, 10%)` and so on) and keeps its own
percentages relative to that rectangle, so one component serves every format; it declares no
fixed `data-width`/`data-height`, and the render driver stamps the root with the canvas of the
project it is staged into. QA measures each overlay inside the same rectangle. Authored
animations read the same variables.

## The authored-animation mount contract

An authored project mounted by an `animation` Layer is a **sub-composition**, not a page: the
engine mounts it with `data-composition-src="authored/<id>/index.html"`. In that mount every rule
scoped to `#root` is dropped, so absolutely positioned children resolve against the viewport
instead of the composition. A project written as a standalone document — `#root { width: 1920px;
height: 1080px }` and markup inside it — therefore renders displaced and clipped, and nothing says
so until the QA layout check reports `text_occluded` or `content_overlap` after a full render.

The contract, which `resolveAnimations` checks before anything is spent:

- wrap the whole project in `<template>`: style, markup and scripts;
- anchor one explicit stage inside the template with a fixed pixel size and an absolute position,
  e.g. `<div class="stage" style="position:absolute;left:0;top:0;width:1920px;height:1080px">`;
- keep `data-composition-id`, `data-width`, `data-height`, `data-duration` and `data-fps` on the
  composition root — `resolveAnimations` reads the id and duration from there, and a project without
  them reports `animation project not found`.

A project with no `<template>` that sizes `#root` in pixels is refused by name
(`animation-mount-invalid`) instead of being rendered and diagnosed as a layout failure. A project
that declares no fixed size at all keeps working: a component-shaped project reads the canvas from
the `--safe-*` variables of the project it is staged into.

## Where a component lives

A component is a **folder**: `library/components/<name>/index.html`. The folder is named by the
`components` cascade parameter (`components:: [lower-third=pill]`) and found by the nearest-folder
walk — episode, then series, then domain, then this skill's `components/` fallback. A nearer folder
wins. A name set at any user level with no folder fails pre-compile with `MissingAssetError` naming
the name, the level and every path searched; a blueprint default with no folder is skipped with one
warning.

A **flat file** `library/components/<name>.html` is never read. An earlier revision of this page said
it was, and nothing warned when one existed: the file was simply ignored, so an author could edit it
forever with no effect. That shape is now refused by name (`component-shape-invalid`) with the folder
path it should have used, because the silent version of this mistake costs more than the error.

## Sound event keys

Sound effects are bound to engine events, never to a slot's name. The keys are: `video-start`,
`video-end`, `scene-boundary`, `overlay-enter.<slot>` and `overlay-exit.<slot>` for `title`,
`lower-third`, `caption`, `quote` and `watermark`, and `layer-enter.<type>` for `b-roll`,
`animation` and `presenter`. Sounds ride the root audio track (no `data-duration`). An event with
no resolved name is silent. See `references/folder-contract.md` for where `sounds/<name>.*` live.
