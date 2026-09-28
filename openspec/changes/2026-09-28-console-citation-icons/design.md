# Design: Console Citation Icons (Tanda C)

## Technical Approach

Origin classification is computed in exactly one place, `resolve-sources.ts`. The compile procedure copies that output verbatim into `el.citations`. The renderer only reads it. The icons and the dialog live in `innfo-runtime.js`, next to `renderRefDialog`, and reuse its markup. `render-model-viewer.js` only places buttons.

**Commit order on `dev`:** C1, then C2, C3, C4, then C5 (5a → tags → 5b). C1–C4 are ordinary work-unit commits. C5 is release-shaped, like Tanda B's WU4, and is **not pushed to `main` by `sdd-apply`** (see Rollout).

**Deviation from the proposal (C5 scope).** C2 and C3 *create* the new workspace-level files: `workspace/procedures/compile_model_console_NN.md` and `workspace/assets/model_console.html`. They are copies of the business originals plus the new behaviour. C5 then *deletes* the business procedure. C5 does not `git mv` it and edit it in place afterwards. The result is that C2–C4 never touch `business/spec_NN.md`, the file gated by the release process, and the old procedure keeps working until the release lands.

## Architecture Decisions

| # | Chosen | Rejected | Rationale |
|---|---|---|---|
| D1 | `KNOWN_AGENT_TOOL_IDS` and `AGENT_MODIFICATION_CONCEPT` are exported consts in `resolve-sources.ts` | A const in innfo-core `agentModification.ts`/`sourceRef.ts` | The proposal says classification lives only in the resolver, and it has a single consumer. Putting it in core would force an innfo-core rebuild and release for a list. The drift risk against the builder's heading text is closed by a contract test that classifies a real `buildAgentModificationBlock()` output. |
| D2 | Tool-id match normalises both sides: lowercase, strip non-`[a-z0-9]` | Exact, case-sensitive match | The convention is prose ("agent ids are tool names"). With normalisation, `Claude Code` still resolves to `agent`. |
| D3 | Classify from an anchor walk: self, then structural ancestors | Checking only the exact target heading | A citation to a sub-heading nested inside an Agent Modification block is still that block's content. |
| D4 | Precedence: Agent Modification (anchor-level) → `source_type: feedback` (file-level) → `document` | Reviewer first | An anchor signal is more specific than a file signal. The two never co-occur in practice. |
| D5 | **Open Q3: reviewer `author` comes from frontmatter `author` only; otherwise it is omitted** | Scraping `- **Author**:` from the `## NN Meta` body | Verified: `scanner-core.js:588-677` never passes `meta.author` into `extra.author` for `.json` feedback, and `incomingFields` is parsed only for `.md`. `generateSourceFrontmatter` therefore writes no `author:`, and the name exists only in body prose (`scanner-converters.js:408`). Scraping prose would reimplement the parser. The dialog shows the label **"Reviewer feedback"** with no name line. Reviewer names can be surfaced later by a separate nn-trannsform change that passes `extra.author = meta.author`, with zero resolver change. |
| D6 | **Open Q4: stays a non-goal.** Only a citation-typed field gets an icon. `precio` never inherits from `precio_source`. | Suffix convention (`<x>_source`) | The language defines no such convention. Inferring one would be a silent language extension. |
| D7 | Icons and dialog go in `innfo-runtime.js`: `svgIcon` entries plus `renderCitationDialog`, both exported. The renderer shows no icons when the runtime lacks them. | A parallel dialog or icons in the renderer | This is the `innfo-ref-dialog` pattern (`innfo-runtime.js:1420-1458`) and it avoids a second implementation. Degrading to "no icons" is identical to today's output. |
| D8 | One icon per *distinct variant* per field, ordered `error, agent, human, reviewer, document`. A click opens the whole field's list. | One icon per citation | This bounds header clutter when an element has many `sources`. |
| D9 | No new `needs[]` capability. Presence of `el.citations` is the gate. | A `field-citations` need | The data is optional and additive, and an absent key already renders exactly as today. |

## C1: `resolve-sources.ts`

**Heading lookup:**
1. `headings = extractHeadings(content)`.
2. `idx` is the first heading with `h.slug === ref.slug`. When `ref.unit?.kind === 'header'`, it must also satisfy `h.level === ref.unit.level`, the same match rule as `resolveHeaderUnit`.

**`findEnclosingAgentModification(headings, idx)`:**
- Test `headings[idx]` itself first, then walk `j = idx-1 … 0`. Keep `level = headings[idx].level`. A heading with `headings[j].level < level` is an ancestor: test it, then set `level = headings[j].level`.
- The test is `h.concept?.trim().toLowerCase() === 'nn agent modification'`. `concept` is `headingSlugParts`' first-`:` split.
- Siblings and any heading after the target are never considered.

**`readAgentModificationAuthor(content, amHeading)`:**
- Take the lines from `amHeading.line + 1` to the first subsequent line matching `^#{1,6}\s`, which gives the block's own lines.
- Take the first match of `/^\s*author\s*::\s*(.*?)\s*$/i`.
- If the line is absent, empty or `_`, return `{origin:'agent', author:'unknown'}`. That covers blocks from before 2026-09-11 and unfilled markers.
- If the value is in `KNOWN_AGENT_TOOL_IDS`, return `{origin:'agent', author: value}`.
- Otherwise return `{origin:'human', author: value}`.

**`classifyOrigin(content, fm, ref)`:**
1. If the ref has a slug and the enclosing heading is an Agent Modification block, use the author rule above.
2. Else, if `fm?.source_type === 'feedback'`, return `reviewer`, with `author` set only when `fm.author` is a non-empty string.
3. Otherwise return `document`.

`resolveOneCitation(raw, field, resolver, modelPath)` gains the `field` parameter. Where each outcome gets its origin:
- `MALFORMED`, `DANGLING_FILE`, `MODEL_NOT_FOUND` and `ELEMENT_NOT_FOUND` get `origin:'document'`. For the last two, `field` is `input.fieldName ?? ''`.
- `UNKNOWN_ANCHOR` still runs step 2 of `classifyOrigin`, because the frontmatter is readable.

Also update the tool description string in `server.ts:476`.

```ts
export type CitationOrigin = 'agent' | 'human' | 'reviewer' | 'document'
export const AGENT_MODIFICATION_CONCEPT = 'NN Agent Modification'
export const KNOWN_AGENT_TOOL_IDS: readonly string[] = ['ClaudeCode', 'OpenCode', 'Antigravity']
export interface ResolvedCitation {
  path: string; anchor?: string; exists: boolean
  field: string; origin: CitationOrigin; author?: string
  excerpt?: string; truncated?: boolean; sha256?: string; version?: string
  error?: 'MALFORMED' | 'DANGLING_FILE' | 'UNKNOWN_ANCHOR' | 'ELEMENT_NOT_FOUND' | 'MODEL_NOT_FOUND'
}
```

## C2: Payload (new `workspace/procedures/compile_model_console_NN.md`)

The new procedure is a copy of the business procedure with these changes:
- The `Load Reference Shell` URL points at `workspace/assets/model_console.html`.
- A new step, **`Resolve Element Citations`**, sits between `Serialize Model Data` and `Inject Data into Shell`.
- `model_version` is `V_0-1-0`, because this is a new file.

The new step works as follows:
1. For each element, call `resolve_sources({model, elementId: el.name})` with `fieldName` omitted. The call takes the element **name**, not `el.id`, because `findElement` matches names case-insensitively.
2. If the call returns a single `MODEL_NOT_FOUND`/`ELEMENT_NOT_FOUND` entry, embed nothing for that element and report it in `Verify Output`.
3. Otherwise, group the entries by `field`, preserving order, and drop the `field` key from each entry, since it is now the map key.
4. If the result is empty, omit `citations` for that element.
5. Set `meta.citationsResolvedAt` (ISO) once.
6. If the `resolve_sources` tool is unavailable, omit both keys and report it.

`Inject Data into Shell` must escape `<` as `<` inside all injected JSON, because excerpts can contain `</script>`.

```json
"citations": { "sources": [ { "path": "sources/nn/conversations/s1_source.md", "anchor": "nn-agent-modification--update-field-…",
  "exists": true, "origin": "agent", "author": "ClaudeCode", "excerpt": "…", "truncated": true,
  "version": "V_0-1-0", "sha256": "…", "error": "UNKNOWN_ANCHOR" } ] }
```

Every key except `field` is kept, because C4 displays each one. Nothing extra is embedded.

## C3/C4: Renderer, runtime, shell

**`render-model-viewer.js` → `renderElement()` (`:233-301`):**
- Header: after the markers loop (`:242-248`) and before the chevron (`:249`), merge the entries of `sources`/`source` keys (`SOURCES_FAMILY`, which mirrors `SOURCE_FIELD_NAMES`) and append `citationButtons('sources', merged)`.
- Field rows: inside the fields loop (`:271-275`), for each `k` with `citations[k]` that is not in `SOURCES_FAMILY`, append `citationButtons(k, citations[k])` to `tr.lastChild`.
- `citationButtons` is a module-level helper. It returns a `span.cite-icons` of `<button type="button" class="cite-icon cite-<variant>">`, with `aria-label`/`title` set to `"<Label>: <field>"`.
  - `variant = entry.error ? 'error' : (known origin ? origin : 'document')`. The fallback to `document` covers consoles built by an old MCP that lacks `origin`.
  - Its click handler calls `stopPropagation()`, because the head toggles open, and then `InnfoConsole.renderCitationDialog`.
  - It returns `null` when `InnfoConsole.renderCitationDialog`/`svgIcon` are missing.
- `matchesQuery` is unchanged.

**`innfo-runtime.js`:**
- Add these entries to `svgIcon` (`:888-899`), using the same stroke-SVG format and `innfo-icon` class as the existing entries:

  | Entry | Glyph | Label | Colour |
  |---|---|---|---|
  | `cite-agent` | bot | "AI agent" | violet |
  | `cite-human` | single user | "Human author" | blue |
  | `cite-reviewer` | message-square-check | "Reviewer feedback" | amber |
  | `cite-document` | file-text | "Document" | gray |
  | `cite-error` | alert-triangle | "Unresolved citation" | red |

  The human glyph and label are deliberately distinct from both the agent and document icons.
- Add `CITATION_ORIGIN_LABELS`.
- Add `renderCitationDialog(doc, fieldName, entries)` right after `renderRefDialog`:
  - It gets `#innfo-citation-dialog`, or creates it and appends it to `body`, so old shells still work.
  - It uses the same `innfo-ref-head`/`innfo-ref-close`/`innfo-ref-body`/`innfo-ref-tag`/`innfo-ref-fields` classes.
  - Each entry shows a tag (label, plus `· author` when present) and a `dl` of path, anchor, version, sha256 and error.
  - The excerpt goes in a `pre.innfo-cite-excerpt`, followed by `… (truncated)` when `truncated`.
  - All text goes through `el()`/`textContent`. There is never any `innerHTML` of citation data.
- Export `renderCitationDialog` and `svgIcon` in `PUBLIC_API`.

**`workspace/assets/model_console.html` (new, C3):** a copy of `business/assets/model_viewer.html` with these changes:
- Bundle `<script src>` tags (CDN `@innfo-console-v0.3.0`, updated in C5, plus the main mirror and vendored `./innfo-console.bundle.js`).
- A `<dialog id="innfo-citation-dialog" aria-label="Citation details">`.
- The `#innfo-ref-dialog` CSS block copied from `artifact_blueprint.html:283-352`, with each selector widened to `#innfo-ref-dialog, #innfo-citation-dialog`.
- `.cite-icon` and `.cite-*` colour rules.

`business/assets/model_viewer.html` stays **byte-unchanged**.

## C5: Release unit

**Precondition:** `git merge-base --is-ancestor templates-v0.16.0 origin/main` must succeed, meaning WU4 has reached `main`. If it fails, stop.

**5a**, one commit:
1. Delete `business/procedures/compile_model_viewer_NN.md`.
2. In `business/spec_NN.md`, drop the `compile-model-viewer` `procedures:` entry. The `model-viewer-shell` asset entry stays for the transition cycle. Add a history note, and bump `template_version` from `V_0-2-5` to `V_0-2-6`. `spec_version` stays, so `manifest/source.yaml` `templates[business].version` stays as well (the two-axes gotcha).
3. Mirror the change in `canonical-registry.ts:~2068`.
4. Bump the `innfo-console` `console_assets.version` from `0.3.0` to `0.4.0`, and set the shell CDN pin to `@innfo-console-v0.4.0`.
5. Bump `innfo-mcp` from `0.10.0` to `0.11.0`. This is an **addition to the proposal**: without it, installed MCPs never return `origin`.
6. Run `node scripts/build-console-bundle.mjs`, rebuild the innfo-mcp bundle, and run `npm run sync:versions`.
7. Update `docs/innfo/documentation/offline-consoles.md:102`.
8. Run the gates: `guard-template-immutability`, `check:integrity`, `check:spec-urls` and `verify.js`.

**Tags:** on 5a, cut and push `templates-v0.17.0`, `innfo-console-v0.4.0` and `innfo-mcp-v0.11.0`.

**5b:** bump the templates channel version to `0.17.0`, then run `generate-manifest --channel stable`. Run `validate-manifest` and `check:integrity` in a `git worktree add --detach` checkout. `validate-manifest` is expected red only for "not reachable from main".

**STOP.** `dev`→`main` is maintainer-gated and outside `sdd-apply`.

**Exemption:** `innfo-core/tests/fixtures/simulacro-refactorizacion/**` is a frozen snapshot. It keeps the old path and is excluded from the "no references remain" rule.

## What Could Go Wrong

| Case | Behaviour |
|---|---|
| (a) The `sources::` file has no Agent Modification blocks | The walk finds nothing, `fm.source_type` is absent, and the result is `document`. No throw. |
| (b) The anchor is a non-Agent-Modification heading in a promoted transcript, including a *sibling* of an Agent Modification block | Only self and ancestors are tested, so the result is `document`. |
| (c) No `sources/conversations/` or `sources/nn/conversations/` directory | Verified at `validate.ts:323-354`: `existsSync` fails, the resolver returns `{exists:false, parentExists:false}`, and the result is `DANGLING_FILE` + `document`. The procedure never enumerates that directory. Unqualified `conversations/…` resolves under `sources/nn/` (`resolveUnitPath`). |
| An excerpt contains `</script>` or HTML | `<` escaping at injection, and `textContent`-only rendering (the XSS test runs under the `jsdom` pragma). |
| A console was built by an old MCP (no `origin`) | Renders the `document` variant. |
| Old shell plus the new renderer through the `main` mirror | No `citations` key, so the output is unchanged. |
| Duplicate element names across concepts | `findElement` returns the first match, so citations can attach to the wrong element. This is a known limitation, left unfixed. |
| One `resolve_sources` call per element on large models | Each call re-reads the model and resolves the schema. Accepted for an offline compile. |

## Testing Strategy (strict TDD)

| Unit | Tests |
|---|---|
| C1 `resolve-sources.spec.ts` | agent (`ClaudeCode`, `claude code`), `_` → `unknown`, a missing `author::` line, human (`Maria Lopez`), reviewer with and without `fm.author`, plain document, a sub-heading under an Agent Modification block → `agent`, a sibling heading → `document`, dangling file and missing directory → `document`, a `field` on every entry, and a contract test that pastes a `buildAgentModificationBlock()` output under its heading. Rebuild innfo-core first. |
| C3/C4 `console-dom.test.ts` (new jsdom file for XSS) | No `citations` gives DOM identical to today. Sources show on the header, other fields on the row, variants dedupe, clicking opens `#innfo-citation-dialog` without toggling the element, `<img onerror>` in an excerpt stays inert, and the dialog is created when the shell lacks it. |
| Assets | Extend `console-renderers.test.ts`/`console-thinning.test.ts` to `model_console.html`, and assert that `model_viewer.html` is unchanged. |

## Non-Goals

- CSV-row citation validation (rows pass through as-is).
- Per-plain-field icon inference (D6).
- `apply_feedback_NN.md` deduplication.
- Any language-spec change.
- Per-matrix-cell badges.
- Adding `procedures:` frontmatter to `workspace_spec_NN.md`: workspace procedures stay undeclared, following the `compile_workspace_hub_NN.md` precedent.

## Open Questions

None blocking. For the tasks phase: confirm that no CI freshness check compares `bin/innfo-mcp.bundle.js` against the C1 source before 5a rebuilds it.
