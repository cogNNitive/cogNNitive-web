# Tasks: Console Citation Icons (Tanda C)

Structure follows `design.md`'s C1-C5 ordering exactly, same pattern as Tanda
B's WU1-WU4. C1-C4 are ordinary work-unit commits on `dev`. C5 is a deliberately
isolated release unit with its own final commit(s) and does **not** push to
`main` as part of `sdd-apply`. Commit order is fixed: **C1 → C2 → C3 → C4 → C5**.

Legend: `[spec]` = requirement this task satisfies, from
`openspec/changes/2026-09-28-console-citation-icons/specs/`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~520-720 total across C1-C5 |
| 400-line budget risk | High |
| Chained PRs recommended | N/A (single-`dev`-branch, no PRs) — translated to ordered work-unit commits |
| Suggested split | C1 → C2/C3/C4 combined feature commit → C5 (own commit set) |
| Delivery strategy | work-unit commits directly on `dev` (no PRs) |
| Chain strategy | not applicable — mirrors Tanda B's WU1-WU4 commit pattern |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Notes |
|------|------|-------|
| C1 | Origin classification in `resolve-sources.ts` | ~120-160 lines incl. spec test; standalone, testable without C2-C4 |
| C2+C3+C4 | Payload + renderer + runtime dialog | ~280-380 lines; C3/C4 are tightly coupled (icon click → dialog) so land together |
| C5 | Release: relocation, version bumps, tags | ~120-180 lines; gated on `templates-v0.16.0` reaching `main` |

Run `sdd-apply` across **at least 2 sessions/batches**: (1) C1, (2) C2-C4, with
C5 as its own separate batch once the WU4 precondition is confirmed. Each
individual commit stays close to or under ~400 lines; the sum across C1-C5
clearly exceeds it, consistent with Tanda B's WU4 precedent.

---

## Pre-C1: CI bundle-vs-source risk check (must run before C1 lands)

- [x] 0.1 Read `scripts/check-integrity.js` Group 2 and
      `scripts/lib/cdn-bundle-staged.js` to confirm whether any gate does a
      byte/hash comparison of `docs/innfo/cdn/innfo-mcp-v<version>.bundle.js`
      against `iNNfo/packages/innfo-mcp/src/**` source. **Confirmed during
      sdd-tasks**: `checkCdnBundleStaged` only asserts the staged bundle file
      *exists on disk* for the version currently declared in
      `iNNfo/packages/innfo-mcp/package.json` — it is a build-ordering
      existence check, not a content/hash diff. No script in `scripts/` or
      `scripts/manifest/` compares bundle bytes to `resolve-sources.ts`
      source. `validate-manifest.js`'s pinned-commit content check applies to
      the `templates` channel, not the mcp bundle.
- [x] 0.2 Because no CI gate forces a rebuild, and C1 does not bump
      `innfo-mcp`'s `package.json` version (that only happens in C5, task
      5a.5), C1 landing alone will NOT go red on `dev` even though the staged
      CDN bundle becomes content-stale relative to the new `origin`
      classification. Do not add a speculative rebuild step to C1 — record
      this as an accepted, scoped gap: the bundle stays stale (old
      `resolve_sources` behavior, no `origin`/`field`) until C5's task 5a.6
      rebuild, exactly as the design's "Old shell plus the new renderer" /
      "console built by an old MCP" fallback (`document` variant) already
      covers. `[design: "What Could Go Wrong" → "A console was built by an
      old MCP (no origin)"]`

---

## C1 — Origin classification in `resolve-sources.ts`

Sequential, strict TDD (write failing test, then implement). Rebuild
innfo-core first if any innfo-core type changed underneath this tool.

- [x] 1.1 Write failing tests in `resolve-sources.spec.ts`: known agent tool
      id (`ClaudeCode`, normalized `claude code`), `author:: _` → `unknown`,
      missing `author::` line, human name (`Maria Lopez`) → `origin: 'human'`,
      reviewer with `fm.author` present, reviewer with `fm.author` absent
      (no `author` key emitted), plain document heading, a sub-heading
      nested under an Agent Modification block → `agent`/`human` per its
      `author::`, a sibling heading of an Agent Modification block →
      `document`, dangling file → `document` with no throw, missing
      `sources/conversations/` directory → `document`, and that every
      returned entry carries a `field` key.
      `[spec: citation-source-resolution → "Citation origin classification";
      "Dangling file is reported without throwing"]`
- [x] 1.2 Write the contract test: paste a real `buildAgentModificationBlock()`
      output under its heading and run it through `classifyOrigin` /
      `readAgentModificationAuthor`, asserting the resolver's heading-text
      match (`'nn agent modification'`) and `author::` line regex still hit
      the builder's actual output. This guards the known-tool-id list against
      drifting from the block builder's heading/field text, per design D1.
      `[spec: citation-source-resolution → "Citation origin classification"]`
- [x] 1.3 Implement in `resolve-sources.ts`: export
      `CitationOrigin`, `AGENT_MODIFICATION_CONCEPT = 'NN Agent Modification'`,
      `KNOWN_AGENT_TOOL_IDS = ['ClaudeCode', 'OpenCode', 'Antigravity']`, and
      the extended `ResolvedCitation` interface (`field`, `origin`, `author?`).
      Implement `findEnclosingAgentModification` (self then ancestor walk,
      siblings/descendants never considered), `readAgentModificationAuthor`
      (author-line regex, `_`/empty → `unknown`, known-list → `agent`,
      otherwise → `human`), and `classifyOrigin` with precedence: Agent
      Modification (anchor-level) → `fm.source_type === 'feedback'` → `document`.
      `[spec: citation-source-resolution → "Citation origin classification"]`
- [x] 1.4 Add the `field` parameter to `resolveOneCitation(raw, field,
      resolver, modelPath)`. Set `origin: 'document'` for `MALFORMED`,
      `DANGLING_FILE`, `MODEL_NOT_FOUND`, `ELEMENT_NOT_FOUND` outcomes; for
      the last two, `field = input.fieldName ?? ''`. `UNKNOWN_ANCHOR` still
      runs step 2 of `classifyOrigin` (frontmatter is readable).
      `[spec: citation-source-resolution → "resolve_sources resolves an
      element's citations"; "Dangling file is reported without throwing"]`
- [x] 1.5 Update the tool description string in `server.ts:476` to mention
      `field`/`origin`/`author` in the result shape.
- [x] 1.6 Run the resolve-sources test suite until green. Rebuild innfo-core
      first if `ResolvedCitation`/`CitationOrigin` moved there transitively.

---

## C2 — Payload: new `workspace/procedures/compile_model_console_NN.md`

- [x] 2.1 Create `workspace/procedures/compile_model_console_NN.md` as a copy
      of the business procedure (`business/procedures/compile_model_viewer_NN.md`)
      with `model_version: V_0-1-0` (new file), `Load Reference Shell`
      pointed at `workspace/assets/model_console.html`, and a new step
      **`Resolve Element Citations`** between `Serialize Model Data` and
      `Inject Data into Shell`. Do NOT touch `business/spec_NN.md` or the
      business procedure file in this commit — C5 deletes it later.
      `[spec: console-field-citations → "Compile-time citation payload";
      innfo-console-runtime → "Console compile procedure relocated to
      workspace level"]`
- [x] 2.2 Implement the `Resolve Element Citations` step: for each element,
      call `resolve_sources({model, elementId: el.name})` — **`el.name`, not
      the slug `id`** — with `fieldName` omitted. If the call returns a
      single `MODEL_NOT_FOUND`/`ELEMENT_NOT_FOUND` entry, embed nothing for
      that element and report it in `Verify Output`. Otherwise group entries
      by `field` (preserving order) into `el.citations: { "<field>":
      ResolvedCitation[] }`, **dropping the `field` key from each entry**
      since it becomes the map key. Omit `citations` entirely when the
      grouped result is empty. Set `meta.citationsResolvedAt` (ISO) once. If
      `resolve_sources` is unavailable, omit both keys and report it.
      `[spec: console-field-citations → "Compile-time citation payload" →
      Scenario: Citations embedded per element; Scenario: Document-level
      resolution timestamp]`
- [x] 2.3 In `Inject Data into Shell`, escape `<` as `<` inside all
      injected JSON (not just citation excerpts — the whole payload), so an
      excerpt containing the literal string `</script>` cannot break the
      page. Add a test case with an excerpt containing `</script>` and assert
      the injected `<script>` block parses and the literal string never
      appears unescaped.
      `[design: C2 → "Inject Data into Shell must escape < as <"]`
- [x] 2.4 Write/extend a compile-procedure-level test (or fixture-based
      assertion) covering: an element with a `sources` field and a
      `precio_source` field produces `el.citations.sources` and
      `el.citations.precio_source`; a compile run resolving at least one
      citation sets `meta.citationsResolvedAt`; a `resolve_sources` result
      grouped by `field` never re-includes the `field` key inside each entry.
      `[spec: console-field-citations → "Compile-time citation payload"]`

---

## C3 — Renderer: `render-model-viewer.js`

- [x] 3.1 Write failing jsdom tests in a new `console-dom.test.ts`: no
      `citations` on an element gives DOM identical to today (backward
      compatibility); a `sources`-family citation renders its icon on the
      element header; a non-`sources` citation-typed field renders its icon
      on that field's row and the plain sibling field (e.g. `precio`) shows
      no icon; multiple entries for the same field with the same variant
      dedupe to one icon; a `<img onerror>` payload inside an excerpt stays
      inert when rendered (XSS guard, jsdom pragma).
      `[spec: console-field-citations → "Backward-compatible rendering";
      "Origin-typed citation icons" → all 4 scenarios]`
- [x] 3.2 Implement `citationButtons(fieldName, entries)` as a module-level
      helper in `render-model-viewer.js`: returns `span.cite-icons` of
      `<button type="button" class="cite-icon cite-<variant>">` per distinct
      variant, ordered `error, agent, human, reviewer, document`; `variant =
      entry.error ? 'error' : (known origin ? origin : 'document')` (old-MCP
      fallback); `aria-label`/`title` = `"<Label>: <field>"`; click handler
      calls `stopPropagation()` then `InnfoConsole.renderCitationDialog`;
      returns `null` when `InnfoConsole.renderCitationDialog`/`svgIcon` are
      missing.
      `[spec: console-field-citations → "Origin-typed citation icons"]`
- [x] 3.3 Wire `citationButtons` into `renderElement()` (`:233-301`): after
      the markers loop and before the chevron, merge `sources`/`source` keys
      (`SOURCES_FAMILY`) and append the header button; inside the fields loop,
      for each `k` with `citations[k]` not in `SOURCES_FAMILY`, append the
      button to `tr.lastChild`. Leave `matchesQuery` unchanged.
- [x] 3.4 Run the new `console-dom.test.ts` plus existing
      `console-renderers.test.ts`/`console-thinning.test.ts` until green.

---

## C4 — Runtime: `innfo-runtime.js` icons and dialog

- [x] 4.1 Write failing tests: clicking a citation icon opens
      `#innfo-citation-dialog` via `showModal()` without toggling the
      element open; the dialog shows path/anchor/excerpt for the clicked
      entry; a truncated excerpt shows a visible truncation mark; a missing
      `author` renders no author line and no generic "Reviewer" placeholder;
      an error entry shows the error message with no empty placeholders for
      the omitted `excerpt`/`sha256`/`version`; the dialog element is created
      and appended to `body` when the shell lacks it.
      `[spec: console-field-citations → "Native citation detail dialog" →
      all 4 scenarios]`
- [x] 4.2 Add `svgIcon` entries (`cite-agent`, `cite-human`, `cite-reviewer`,
      `cite-document`, `cite-error`) per design's glyph/label/colour table,
      same stroke-SVG format and `innfo-icon` class as existing entries. Add
      `CITATION_ORIGIN_LABELS`.
      `[spec: console-field-citations → "Origin-typed citation icons" →
      Scenario: Human origin distinguishable from agent and document]`
- [x] 4.3 Implement `renderCitationDialog(doc, fieldName, entries)` next to
      `renderRefDialog`: get-or-create `#innfo-citation-dialog`; reuse
      `innfo-ref-head`/`innfo-ref-close`/`innfo-ref-body`/`innfo-ref-tag`/
      `innfo-ref-fields` classes; each entry shows a tag (label, plus
      `· author` only when `author` is present) and a `dl` of path, anchor,
      version, sha256, error — each field omitted entirely when absent, never
      placeholdered; excerpt in `pre.innfo-cite-excerpt` followed by
      `… (truncated)` when `truncated`; all text through `el()`/`textContent`,
      never `innerHTML` of citation data. Export `renderCitationDialog` and
      `svgIcon` in `PUBLIC_API`.
      `[spec: console-field-citations → "Native citation detail dialog"]`
- [x] 4.4 Create `workspace/assets/model_console.html` (copy of
      `business/assets/model_viewer.html`) with: bundle `<script src>` tags
      pointing at the existing `@innfo-console-v0.3.0` CDN pin (C5 bumps it),
      a `<dialog id="innfo-citation-dialog" aria-label="Citation details">`,
      the `#innfo-ref-dialog` CSS block copied from
      `artifact_blueprint.html:283-352` with selectors widened to
      `#innfo-ref-dialog, #innfo-citation-dialog`, and `.cite-icon`/`.cite-*`
      colour rules. Confirm `business/assets/model_viewer.html` stays
      byte-unchanged (add/extend a test asserting this).
      `[spec: innfo-console-runtime → "No Duplicated Inline Runtime" →
      Scenario: New workspace-level asset renders citations; Scenario: Old
      business shell still resolves during the transition cycle]`
- [x] 4.5 Run the runtime + console-dom test suites until green, and
      re-confirm 3.1's backward-compatibility case (no `citations` → DOM
      unchanged) still passes with the runtime wired in.

---

## C5 — Release unit (isolated, own final commit(s), does NOT push to `main`)

**Precondition — checked during sdd-tasks, not yet confirmed ready:**
`git merge-base --is-ancestor templates-v0.16.0 origin/main` could not be run
in this session (no shell/Bash tool available to the tasks-phase agent). This
task list treats C5 as **gated/blocked pending that check**, not silently
ready. `sdd-apply` MUST run this check itself before starting any C5 task and
STOP with a blocker report if it fails.

- [ ] 5.0 **GATE**: run `git merge-base --is-ancestor templates-v0.16.0
      origin/main`. If it fails (non-zero exit), STOP — do not start any
      other C5 task. Report the blocker and wait for Tanda B WU4 to reach
      `main`.
      `[design: C5 → "Precondition"]`
- [ ] 5.1 Delete `business/procedures/compile_model_viewer_NN.md`.
      `[spec: innfo-console-runtime → "Console compile procedure relocated to
      workspace level" → Scenario: No dangling references to the old
      procedure path]`
- [ ] 5.2 In `business/spec_NN.md`: drop the `compile-model-viewer`
      `procedures:` entry (keep the `model-viewer-shell` asset entry for the
      transition cycle); add a history note; bump `template_version`
      `V_0-2-5` → `V_0-2-6` only. Do NOT bump `spec_version` — `manifest/
      source.yaml`'s `templates[business].version` stays unchanged (the
      two-axes rule, same as the `compile_workspace_hub` precedent). Do NOT
      add a `procedures:` entry to `workspace_spec_NN.md` — workspace
      procedures stay undeclared per that same precedent.
      `[design: "What to change" table; Non-Goals → "Adding procedures:
      frontmatter to workspace_spec_NN.md"]`
- [ ] 5.3 Mirror the `business/spec_NN.md` change in
      `canonical-registry.ts:~2068`.
- [ ] 5.4 Bump `innfo-console`'s `console_assets.version` `0.3.0` → `0.4.0`
      in the relevant manifest/registry location; set the shell CDN pin to
      `@innfo-console-v0.4.0` in `workspace/assets/model_console.html`.
- [ ] 5.5 Bump `innfo-mcp` from `0.10.0` to `0.11.0` (addition beyond the
      proposal — without it, installed MCPs never return `origin`).
- [ ] 5.6 Run `node scripts/build-console-bundle.mjs`, rebuild the innfo-mcp
      bundle, and run `npm run sync:versions`. This is the deferred bundle
      rebuild flagged in task 0.2 — it lands here, in C5, not C1.
- [ ] 5.7 Update `docs/innfo/documentation/offline-consoles.md:102`.
- [ ] 5.8 Grep-verify no reference to
      `business/procedures/compile_model_viewer_NN.md` remains anywhere,
      **excluding** the frozen fixture
      `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion/**`
      (keeps the old path deliberately, per design's Exemption).
      `[spec: innfo-console-runtime → Scenario: No dangling references to the
      old procedure path]`
- [ ] 5.9 **Commit 5a** (tasks 5.1-5.8). Run, in order:
      `guard-template-immutability`, `check:integrity`, `check:spec-urls`,
      `verify.js`. All must pass before proceeding.
- [ ] 5.10 Cut and push annotated tags `templates-v0.17.0`,
      `innfo-console-v0.4.0`, `innfo-mcp-v0.11.0` on commit 5a.
- [ ] 5.11 **Commit 5b**: bump the templates channel version to `0.17.0` in
      `manifest/source.yaml`, then run `generate-manifest --channel stable`.
- [ ] 5.12 Run `validate-manifest` and `check:integrity` inside a
      `git worktree add --detach` checkout (not the shared working tree).
      `validate-manifest` is expected red only for "not reachable from
      main" — any other violation is a real blocker.

**STOP.** `dev` → `main` is maintainer-gated and outside `sdd-apply`, same
boundary as Tanda B's WU4.

Rollback: revert each commit independently. C2-C4 are additive — an element
without `citations` renders unchanged. If C5's tags have already shipped, cut
a follow-up tag instead of deleting it.

---

## Cross-cutting acceptance (from proposal.md Success Criteria)

- [x] Every cited field shows an icon matching its origin, and the dialog
      content matches `resolve_sources` output. (C1-C4)
- [x] A console compiled without citations renders unchanged. (C3, task 3.1)
- [ ] Nothing references the business procedure path, and `check:integrity`
      and `validate-manifest` pass. (C5, tasks 5.8-5.12)
