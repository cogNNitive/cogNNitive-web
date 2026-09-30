# Console Needs & Visual Identity

What a generated console can do is **declared, not inferred**. A console opts into
capabilities by listing them in `innfo-config.needs[]`; the shared runtime reads
that list through `hasNeed()` and only wires the matching UI. Concept color and
icon are a separate concern: they are **data from the active app**, not a
hard-coded app palette.

---

## Needs registry (v0.1.0)

`console/needs-registry.json` declares the available needs and the runtime pins.

| Need | What it enables |
| :--- | :--- |
| `feedback-export` | Reviewer suggest/edit drafts in `localStorage` plus the Export modal (identifier gate, instructions, agent prompt, timestamped JSON download). |
| `concept-rail` | Left rail of app concepts with per-concept element counts. |
| `fulltext-search` | Search box filtering element names and field values. |
| `matrix-grids` | Matrix sections rendered as rows-by-columns tables from the model slots. |
| `hash-routing` | In-page relationship links resolving to element anchors via the location hash. |
| `reference-popup` | `reference`-typed values render as pills that open a detail dialog. |
| `document-view` | Generic readable-document renderer: builds a tree from parent/next fields and renders each root chain (root + steps with concept colors and step-type icons). |
| `guided-procedure` | Guided procedure execution (fsm-stepper): navigable tree of root `Work` elements and their step chains, with condition guards, I/O, tools, and role assignment. Carries `renderer: "procedure-stepper"`. |

### Opt-in and gating

- A console lists the needs it wants inside `#innfo-config`:

  ```json
  { "needs": ["concept-rail", "fulltext-search", "matrix-grids"] }
  ```

- `hasNeed(config, need)` returns `true` only when `config.needs` is an array that
  contains the need. A missing config or a missing `needs[]` array means no needs
  are enabled.
- Needs that are not listed are simply never matched — there is no implicit
  default set.

---

## Caveats: registry vs. what actually boots

Two mismatches are worth stating plainly.

- **The registry still pins pre-bundle files.** Its `runtime.cdn` / `fallback` /
  `vendored` entries point at `innfo-runtime.js`, and `renderers.*` list
  `render-model-viewer.js`, `render-procedure-stepper.js`, and `visuals.js`
  individually. The shipped shells, however, load the single
  `innfo-console.bundle.js`. The registry is therefore **not** a literal manifest
  of what the current shells load.
- **`guided-procedure` does not gate the stepper.** `render-procedure-stepper.js`
  auto-boots whenever its DOM anchors exist: `autoBoot()` checks for `#doc-title`
  and `#proc-tabs` and calls `boot()` if both are present. The
  `guided-procedure` entry carries a `renderer` hint, but the runtime need gate is
  not what starts the stepper — the anchors are.

---

## App-driven visual identity

Concept color and icon come from the **active app's concept definitions**
(`innfo-schema.concepts[].color` / `.icon`), never from the app's own palette. A
color is stored as a name (for example `blue`) and translated to a hex value by
the shared visuals module's `COLOR_HEX`.

| Surface | Resolver | Source |
| :--- | :--- | :--- |
| Editor | `useConceptVisuals.ts` `getConceptMeta()` → `{ icon, color }`; `resolveColor()` maps via `getHexColor()` | effective metamodel's `concepts` |
| Console (procedures) | `render-procedure-stepper.js` `conceptColor(name)` | `innfo-schema.concepts[]`, translated by `InnfoVisuals.getHexColor` |
| Console (runtime) | `innfo-runtime.js` builds `conceptColorByName` from `concepts[]` | same schema slot |

A concept with no declared color falls back rather than erroring — the console
uses `#171717`, the editor falls back to slate.

---

## Where the visual layer is not unified

The shared visuals module is **not** the single source of truth, and steps do not
use concept icons. These nuances matter when a color or icon looks wrong in one
surface but not another.

- **Steps use `step_type` icons, not concept icons.** `render-procedure-stepper.js`
  renders `STEP_TYPE_ICONS[step_type]` (`task`, `decision`, `event`) for step
  nodes. Concept color drives the concept rail and element tags, not the step
  icon.
- **`visuals.js` is not the only palette.** `render-model-viewer.js` ships its own
  `COLORS` map (with names such as `violet` and `gray`), and the editor duplicates
  the palette as `COLOR_HEX` in `useConceptVisuals.ts`. Three palettes exist and
  can drift; `visuals.js` mirrors the editor palette but is not imported by every
  renderer.
