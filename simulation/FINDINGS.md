# Findings — code and user-flow analysis

Date: 2026-09-13 · Branch: `dev` @ `6e7481f` · Scope: whole monorepo, with emphasis
on the user-facing lifecycle and the last two weeks of change (442 commits since
2026-08-30).

Findings marked **[simulated]** were reproduced by `simulacro/` and appear in
`results/report.md`. Findings marked **[verified]** were confirmed by direct
inspection during this analysis. Findings marked **[audit]** come from a
read-only code audit and were not exercised end to end.

---

## Summary

The architecture is genuinely good. The layering is deliberate — one validation
entry point shared by editor and MCP, one Citation grammar shared by all three
surfaces, a mutation gate enforced in core rather than duplicated per consumer.
Swallowed errors are documented rather than hidden. That discipline is real and
it shows.

The problems are not architectural. They are at the **edges**: what the product
writes to disk, what it ships to a new user, and how it is packaged. Three of
them are serious enough to undermine the value proposition directly.

| # | Finding | Severity |
| --- | --- | --- |
| F-01 | Saving a model silently destroys matrix axis labels and reorders the document | Critical |
| F-02 | `innfo-core` cannot be imported from plain Node ESM | Critical |
| F-03 | The shipped sample workspace has 7 broken citations and no sources at all | Critical |
| F-04 | `dev` was red: template version registration drift (6th recurrence) | High |
| F-05 | CDN manifest pins stale versions for `workspace` and `business-model` | High |
| F-06 | Citation vocabulary keys on field NAME, ignoring the declared TYPE | High |
| F-07 | `add_element` silently creates phantom concepts in level-3 models | High |
| F-08 | Cross-model element identity fights the multi-model design | High |
| F-09 | Citations lose their human-readable heading text on first write-back | Medium |
| F-10 | A live spec asserts a MUST about a deleted file | Medium |
| F-11 | `npm run typecheck` does not typecheck `innfo-mcp` | Medium |
| F-12..F-18 | Editor flow friction and dead code | Medium / Low |

---

## Critical

### F-01 — Saving a model silently destroys matrix axis labels and reorders the document **[simulated]**

`parseModel` followed by `serializeModel` is not the identity on any shipped
sample. This is the path `innfo-mcp`'s `apply_change` takes on **every** agent
write (`iNNfo/packages/innfo-mcp/src/tools/model-io.ts:37`), and the path the
editor takes for any file the user has touched — its own serializer calls it the
"canonical (lossy path)" at
`iNNfo/apps/innfo-editor/src/model/recursiveSerializer.ts:163`.

Four distinct losses, measured across all 11 samples (scenario S03):

1. **Matrix axis labels are destroyed.** A header reading `Metrics \ Variables`
   comes back as `Row \ Col`. 31 matrices across 9 of 11 samples. Root cause:
   `parseModel` never populates `matrix.source` / `matrix.target` from the table
   header, so the serializer falls back to a generic placeholder. The
   `item-markers` matrix survives only because it is special-cased.
2. **Section order is reshuffled** in 5 of 11 samples — `# NN Analysis` moves
   from the top of the document to below the element sections.
3. **Bracketed list values are unwrapped** — `tags:: [market, seasonality]`
   becomes `tags:: market, seasonality`. 133 occurrences across 8 samples.
4. **Blank-line structure is stripped and properties get indented two spaces.**
   Every sample loses 4–12% of its lines.

And one file is not even a fixed point: `Ghostbusters_video-generator_NN.md`
gains two more spaces of indentation on **every** save, indefinitely.

Why this matters more than a cosmetic diff: the entire premise is that a model
is a plain-text file a human can read, diff and hand-edit. A one-field edit that
reorders the document, reindents every property and replaces the axis labels of
13 matrices produces a git diff nobody can review — and the axis labels are
**information the user typed that is now gone**.

**Fix:** make `parseModel` capture matrix axis labels into `source`/`target`
(this alone stops the data loss), then make round-trip fidelity a test:
`serializeModel(parseModel(x)) === x` for every file in `_samples_nn`.

### F-02 — `innfo-core` cannot be imported from plain Node ESM **[verified]**

```
import('@cognnitive/innfo-core')
→ ERR_UNSUPPORTED_DIR_IMPORT: .../dist/types
```

`iNNfo/packages/innfo-core/tsconfig.json:5` sets `moduleResolution: "bundler"`,
so `tsc` emits extensionless relative imports (`export * from './types'`). Node
ESM rejects those. The package nonetheless declares `"type": "module"` and
`"main": "./dist/index.js"`, advertising itself as a Node ESM library. It is
not one.

It is also genuinely ambiguous: both `dist/types.js` and `dist/types/` exist.

Every current consumer hides this — the editor resolves through Vite, the tests
through Vitest, `innfo-mcp` through tsup. All bundlers. The first third party to
run `npm i @cognnitive/innfo-core` and write a Node script hits a wall.
`simulacro/lib/core.mjs` documents the workaround it had to build.

**Fix:** `moduleResolution: "NodeNext"` with explicit `.js` extensions, or a
tsup build for this package too. Add a smoke test that imports the built package
in a plain Node process.

### F-03 — The shipped sample workspace has 7 broken citations and no sources **[simulated]**

`_samples_nn` is the SSOT for every template sample and the first thing a new
user opens. Today:

- `_samples_nn/sources/nn/` is **empty**.
- `_samples_nn/artifacts/` is **empty**, while `workspace_NN.md` registers
  `## NN Artifacts: Workspace Hub Dashboard` pointing at
  `artifacts/workspace_hub.html`.
- `Ghostbusters_documentation_NN.md` cites 7 source files that do not exist —
  7 `KU_DANGLING_FILE` **errors** on first open.
- Of 11 sample models, exactly **one** carries any `source::` field at all,
  even though 11 templates declare one.

Source traceability is the headline capability. The flagship demo does not
demonstrate it, and what it does show is broken. Fix the demo before anything
else on this list — it is the cheapest, highest-leverage item here.

---

## High

### F-04 — `dev` was red: template version registration drift **[verified, fixed]**

`npm test` on `dev` at `6e7481f` failed:

```
highest on-disk template_version for "business": expected 'V_0-2-5' to be 'V_0-2-4'
```

`6e7481f` bumped `iNNfo/specs/bluepriNNts/business/spec_NN.md` to `V_0-2-5` but
did not update `SHIPPED_TEMPLATE_VERSIONS` in
`iNNfo/apps/innfo-editor/src/config/samples.ts:36`.

**Fixed in this pass** (one-line bump); the suite is now 666 passing.

This is the **sixth** recurrence of the same class of miss. The real problem is
that `SHIPPED_TEMPLATE_VERSIONS` is a hand-maintained duplicate of a fact that
already lives on disk — a single-source-of-truth violation. `check:integrity`
runs a template-immutability guard that *does* catch a missing version bump, but
nothing checks this map; only the vitest suite does, which is too late.

**Fix:** generate the map at build time from `specs/templates/*/spec_NN.md` and
delete the hand-written one. That ends the recurrence permanently.

### F-05 — CDN manifest pins stale versions **[verified]**

`manifest/source.yaml` is what users install from. It currently disagrees with
what is on disk:

| template | on disk | `manifest/source.yaml` | `catalog.json` |
| --- | --- | --- | --- |
| `workspace` | `V_0-4-0` | `V_0-2-1` | `V_0-4-0` (ok) |
| `business-model` | `V_0-2-2` | `V_0-2-1` | `V_0-2-2` (ok) |
| `business` | `V_0-2-5` | `V_0-2-5` (ok) | `V_0-2-5` (ok) |

The `workspace` drift is two minor versions and came in with `8e9055e`
(polymorphic sources + HTML ingester) — a substantial feature whose manifest
entry never moved. It is invisible to the editor's own staleness notice because
`workspace_spec` is deliberately excluded from `SHIPPED_TEMPLATE_VERSIONS`
(`samples.ts:47-49`), so nothing catches it.

**Fix:** same as F-04 — derive the manifest versions from the specs, or add a
cross-check to `check:integrity`.

### F-06 — Citation vocabulary keys on field NAME, ignoring declared TYPE **[simulated]**

`SOURCE_FIELD_NAMES = new Set(['sources', 'source'])`
(`innfo-core/src/sourceRef.ts:62`) decides what is a provenance Citation purely
by field name. But the `documentation` template declares:

```
## NN Field Definition: source
concept:: Page
type:: markdown_file
description:: Workspace-relative path to the markdown content file.
```

That is a **content path**, not provenance. `validateWorkspaceSources` treats it
as a Citation anyway and reports 7 `KU_DANGLING_FILE` errors against the shipped
documentation sample — this is the mechanism behind F-03's dangling citations.

The system already has a real type system with `type:: reference | model |
markdown_file | url | …`. Keying the Citation vocabulary on the name instead
means any template that names a field `source` for any other purpose gets
false-positive errors it cannot suppress.

**Fix:** introduce a declared citation type (`type:: citation`) and key
`SOURCE_FIELD_NAMES` off the schema, keeping name-matching only as a fallback
for schemaless documents.

### F-07 — `add_element` silently creates phantom concepts in level-3 models **[simulated]**

```js
applyMutation(level3Model, 'add_element', { conceptName: 'Rsiks', ... }, schema)
// → { success: true }
// → model.elements now has: Assumptions, Risks, Keys, Rsiks
```

`addElement` (`innfo-core/src/mutate.ts:271`) does
`model.elements.get(conceptName) ?? []` and writes, without ever consulting the
`schema` parameter it was handed. A typo'd concept name from an agent creates a
new concept inside a level-3 model — precisely what the level-2 gate
(`mutate.ts:130`) exists to prevent. Validation catches it later as "unknown
concept", but by then the mutation has already been applied and, through
`apply_change`, written to disk.

The gate is correct in principle and well-argued in its comment. It just has a
hole: `add_concept` is blocked, while `add_element` with an unknown concept
achieves the same thing by the back door.

**Fix:** when a schema is supplied, reject `add_element` for a concept the
schema does not declare, with a did-you-mean on close matches.

### F-08 — Cross-model element identity fights the multi-model design **[simulated]**

Opening `_samples_nn` produces **40 parse issues**, 24 of them of this shape:

> Element "Dr. Peter Venkman" appears in both "Ghostbusters_business" and
> "Ghostbusters_organization" — consider renaming to
> "Dr. Peter Venkman (Ghostbusters_organization)"

The same person appearing in the organization model and the business model is
not a mistake — it is the entire point of a multi-model workspace, and the
`[[Model :: Element]]` qualified-reference syntax exists specifically to
disambiguate it. The identity registry reads it as a collision and advises the
user to rename a human being once per model they appear in.

The remaining 16 are slug collisions inside `Ghostbusters_business_NN.md` alone.

Either the flagship workspace is modelled wrong, or the heuristic is. Either
way, a new user's first impression is 40 warnings telling them to mangle their
own naming.

**Fix (product decision, not a bug fix):** decide whether shared element
identity across models is legal. If it is, downgrade the cross-model case to
`info` and drop the rename advice. If it is not, fix the sample workspace and
say so in the spec.

---

## Medium

### F-09 — Citations lose their human-readable heading text **[simulated]**

A user writes `sources:: [market-report-2026.md@## Q4 Outlook]`. After one
agent write-back it reads
`sources:: [sources/nn/market-report-2026.md@##q4-outlook]`.

The pointer still resolves — `serializeKnowledgeUnitRef` is structurally stable,
and S01 confirms that. But `unit.text` is overwritten with the slug, so the
citation no longer echoes the heading it points at. In a format whose whole
argument is human readability, that is a real regression on the most
human-facing string in the document.

**Fix:** serialize `unit.text` verbatim and derive the slug on read.

### F-10 — A live spec asserts a MUST about a deleted file **[verified]**

`6e7481f` retired `business/assets/master.html` cleanly — file, procedure,
frontmatter, catalog and manifest all moved together. Good work. But
`openspec/specs/innfo-console-runtime/spec.md:43` is a **living** spec that
still says:

> The three reference assets (`business/assets/master.html`, `model_viewer.html`,
> `metrics/assets/projections.html`) MUST thin onto the blueprint.

Lower severity, same cause: `openspec/specs/template-package-structure/spec.md:13`
uses it as an illustrative example, `docs/innfo/documentation/offline-consoles.md`
has a table row for it, and `iNNfo/specs/bluepriNNts/business-model/spec_NN.md:541`
names it in a field description. Archived changes referencing it are history and
are fine as they are.

### F-11 — `npm run typecheck` does not typecheck `innfo-mcp` **[verified]**

`package.json:19` delegates to `iNNfo`'s `typecheck`, which builds `innfo-core`
and runs `vue-tsc` on the editor. `innfo-mcp` — the entire agent-facing surface
— is never typechecked by the root command. Its tests run, but type errors in
untested paths pass silently.

### F-12 — Every model-tree click costs 1.1s of animation **[audit]**

`LeftSidebar.vue:945-974` defines an "Ultra Lenta Slide Horizontal Transition"
at 1.1s. `selectModelHeader` (`:548-552`) always calls `uiStore.focusModel()`,
which forces the transition on the single most common navigation action. The
`toggleModel()` call in the same handler is dead code — `isModelExpanded()`
(`:711`) short-circuits to `true` in focused mode, so expanding a model inline
without leaving the overview is now unreachable.

### F-13 — Two independent model-parsing pipelines **[audit]**

The File System Access path goes through `modelStore.parseFromHandle`; the
`webkitdirectory` fallback (Firefox/Safari) re-implements parsing inline in
`HomeView.vue:311-355`, skipping workspace-index building and cross-model
reference validation. It also stores a `null` handle in history
(`HomeView.vue:346`, via an `as unknown as any` cast), so those workspaces can
never be reopened.

### F-14 — Two IndexedDB persistence mechanisms, one of them write-only **[audit]**

`IndexedDbWorkspaceRepository` stores a single handle under `workspaceRoot` on
every open; its read path `workspaceStore.recoverHandle()` has **zero callers**.
`historyStore.ts:10-30` independently re-implements the same DB open/upgrade
logic for the multi-entry store the app actually uses. Session-state restore is
dead along with `recoverHandle`.

### F-15 — Full-workspace revalidation on every element rename **[audit]**

`modelStore.renameElementNode` does an O(all nodes × all fields) reference scan
and then calls `validateModel()` (`modelStore.ts:671`), which re-validates every
root in the workspace synchronously on the main thread. Routine field edits are
cheap; renames are unexpectedly heavy.

### F-16 — Console "Open External" is broken in the primary flow **[audit]**

`ConsoleHubView.vue:174` sets `href` to a bare relative path
(`artifacts/workspace_hub.html`). For a local folder opened through the File
System Access API, that resolves against the app URL and 404s. It only works in
hosted/sample mode.

### F-17 — `reachability.ts` is unreachable **[audit]**

`innfo-mcp/src/tools/reachability.ts` implements `calculateSpecReachability` and
`pruneOrphanedSpecs` (~300 lines, unit-tested, re-exported from the `mutate`
barrel) but neither is registered in `TOOL_REGISTRY` nor called internally. It
is either abandoned work or a missing tool.

### F-18 — There is no in-app "import a source" affordance **[audit]**

`sources::` fields resolve only against files already present in the opened
folder. No drag-and-drop, no "add a source" action. Ingestion lives entirely in
the agent/CLI procedures. That may be intentional, but the editor is where a
user forms the expectation, and the gap is invisible until they go looking.

---

## Low

- `ModelInfoPanel.vue:97` hardcodes a description of the procedure-FSM viewer
  removed in `96a9232`; it is now shown for the only remaining extension, where
  it is factually wrong.
- `src/composables/useFileSystem.ts` has no importers outside its own test,
  while `HomeView.vue:193-209` re-implements its directory walk.
- `innfo-core/src/schema/canonical-registry.ts` is 2116 lines of hand-maintained
  template markdown mirroring `iNNfo/specs/bluepriNNts/*` with no sync check.
- `validateWorkspaceReferences(result)` throws a raw
  `TypeError: Cannot read properties of undefined (reading 'nodeSchema')` when
  the required `WorkspaceIndex` argument is omitted.
- `OpenCodePromptModal.vue:151` uses deprecated `document.execCommand('copy')`.

---

## What is working well

Worth saying plainly, because it is the majority of the code:

- **The level-2/level-3 authoring gate holds.** S04 is fully green:
  `add_concept`, `add_field` and `set_marker` are all refused on a level-3 model
  and all succeed on a level-2 template, and a model smuggling inline schema
  through frontmatter is rejected by validation.
- **Tabular ingestion and row-level citations are solid.** S05 is fully green,
  including deleted-row detection, duplicate-key detection reported once per
  file, and the refusal of line-range anchors as provenance.
- **Manifest reconciliation is correct and conservative.** S06 is green: a no-op
  reconcile returns a byte-identical document, tool-written entries carry an
  explicit ownership marker, and human-owned entries are never rewritten.
- **Failed mutations are atomic.** An unknown op leaves the document
  byte-identical (S02) — the clone-then-assign discipline in `mutate.ts:82-101`
  works exactly as documented.
- **Citation diagnostics are precise and actionable.** Deleting a source file,
  renaming a cited heading, and citing a query each produce a distinct,
  correctly severity-graded code with a usable fix hint (S01).
- **`sources/original/` is genuinely non-citable**, enforced at the parser.
- **The MCP self-heal loop is real.** A stale template cache warning points at
  `check_workspace`, and `check_workspace` actually rehydrates.

---

## Suggested order of work

1. **F-03** — fix the shipped sample workspace. Cheapest, most visible.
2. **F-01** — capture matrix axis labels in the parser; add the round-trip test.
3. **F-04 / F-05** — generate `SHIPPED_TEMPLATE_VERSIONS` and the manifest
   versions from the specs. Ends a six-times-recurring class of bug.
4. **F-02** — fix the module format and add a plain-Node import smoke test.
5. **F-07** — close the `add_element` hole in the authoring gate.
6. **F-06 / F-08** — the two product decisions. Neither is a quick fix; both
   shape what the format means.
