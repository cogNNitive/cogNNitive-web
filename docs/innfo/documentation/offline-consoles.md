# Offline Console Artifacts

A generated console is a **frozen snapshot**: an HTML shell plus two JSON slots
(`#innfo-schema`, `#innfo-model`). The shell carries no inline runtime logic — a
shared UMD bundle is loaded through **static `<script>` tags only**: no server, no
`fetch()`, no `type="module"`. That is what lets a generated console run by
double-clicking the file from `file://`.

---

## How a console boots

1. The shell declares its capabilities in `#innfo-config` (`needs[]`) and embeds
   the schema and model JSON in the two slots.
2. **Three** static tags load the same bundle, in order:

   | Order | Source | Purpose |
   | :--- | :--- | :--- |
   | 1 | `cdn.jsdelivr.net` pinned to tag `innfo-console-v0.1.0` | Primary |
   | 2 | `raw.githubusercontent.com/…/main/…` | Mirror fallback |
   | 3 | `./innfo-console.bundle.js` (vendored next to the artifact) | Offline fallback |

3. **Offline**, the two remote tags fail to load and the **vendored third tag is
   what makes the double-click work**. Online, all three tags resolve and the
   bundle can execute up to three times: `boot(doc)` has no idempotency guard, so
   each execution re-runs it and re-attaches its `input` / `click` listeners
   (only the download button is guarded, via `data-innfo-bound`). The tags are
   **fallbacks**, not a mechanism that guarantees a single boot — do not assume
   re-execution is a strict no-op.

Two shells are canonical: `console/artifact_shell.html` and
`workspace/assets/model_console.html`. Both use the same three-tag boot and
declare the **same two JSON slots** (`#innfo-schema`, `#innfo-model`); what
differs is their DOM anchors — the console shell uses
`#innfo-banner` / `#innfo-rail` / `#innfo-search` / `#innfo-content` /
`#innfo-matrices` / `#innfo-export-modal`, and the model console uses
`#doc-title` / `#rail` (boots `InnfoModelViewer`, including per-field citation
icons and `#innfo-citation-dialog`). The procedures stepper is no longer a
shell: it is the registered `procedure` view
(`procedures/assets/console-view-procedure.js`), which builds its own scoped
DOM inside the view container and never uses global ids.

### What is in the bundle

`console/innfo-console.bundle.js` is a single self-contained file built from four
sources, concatenated in order:

| Order | Source | Global |
| :--- | :--- | :--- |
| 1 | `visuals.js` | `InnfoVisuals` |
| 2 | `innfo-runtime.js` | `InnfoConsole` |
| 3 | `render-model-viewer.js` | `InnfoModelViewer` |
| 4 | `render-procedure-stepper.js` | `InnfoProcedureStepper` |

---

## The `file://` invariant is test-enforced

`innfo-core/tests/console-shell.test.ts` pins the offline contract:

- the shell contains **no** `type="module"` and **no** `fetch(`;
- the UMD runtime and the single-file bundle keep the same no-fetch /
  no-module hygiene;
- the bundle **contains** all four globals (each asserted with `toContain`) and
  matches the `0.1.0` version stamp. The concatenation order is fixed by
  construction in `scripts/build-console-bundle.mjs`, but the test does **not**
  assert order.

If a change reintroduces a module import or a network fetch into a shell or the
bundle, this test fails.

---

## Distribution pinning is by tag + commit

The bundle is distributed as the `console-assets` block of the bootstrap
manifest and pinned by both a **tag** (`ref`) and a **40-char commit**:

| Artifact | Pins |
| :--- | :--- |
| `docs/use/manifest.md` (`console-assets`) | `version: "0.1.0"`, `ref: "innfo-console-v0.1.0"`, `commit`, and the raw `url` containing that commit |
| `manifest/source.yaml` (`console_assets` + `channels.stable.refs`) | the same tag under the `innfo-console` ref key |
| `scripts/manifest/lib/manifest-rules.js` | resolves a manifest ref to the declared commit (`checkRefResolvesInDeclaredRepo`), checks that a pinned URL contains that commit (`checkMcpUrlPinned`), and validates console assets via `validateConsoleAsset` (release provenance through `checkReleaseProvenance`) |

The stable channel requires a tag-shaped ref and verifies release provenance;
the preview channel tracks `main`.

> **Convention, not enforcement.** Not editing a published bundle in place is a
> **convention** applied by the release flow. The manifest rules validate that a
> console pin resolves and carries release provenance; the content-coherence
> check (`checkTemplateMainCoherence`) applies to **apps only**. None of
> these enforce write-once immutability on the published artifact. Treat
> immutability as a discipline, not a runtime guarantee.

---

## Older reference assets use the pre-bundle runtime

Not every HTML asset uses the three-tag bundle boot. The older reference shells
still load the pre-bundle `innfo-runtime.js` from the CDN and the mirror **only**
— no vendored third tag and no `innfo-console.bundle.js`:

| Asset | Runtime loaded |
| :--- | :--- |
| `business/assets/model_viewer.html` | `innfo-runtime.js` (CDN + mirror) |

Do not assume every artifact uses the bundle. `innfo-runtime.js` is a legacy
per-shell runtime, **not** the canonical runtime.

`business/assets/model_viewer.html` is superseded by the three-tag,
bundle-booted `workspace/assets/model_console.html` (`Compile Model
Console`), which also renders origin-typed citation icons per field. The old
shell stays byte-unchanged and reachable for one transition cycle; the
business template's `Compile Model Viewer` procedure that used to target it
was removed in `template_version` `V_0-2-6`.

---

## See also

- [Sources, Citations & Lineage](sources-citations-lineage) §5 — Git vs. the native
  semantic-versioning system: history/release anchors vs. the write-once
  per-artifact contract.
- [Collaboration with Git](collaboration-git) — the workspace-to-Git review layer
  and its version map.
