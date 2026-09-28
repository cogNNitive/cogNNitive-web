# Verify Report - console-citation-icons (Tanda C1-C4)

Phase: sdd-verify
Date: 2026-09-28
Scope: C1-C4 only (committed 7504551 + aa508ec on dev). C5 (release unit) is out of scope, correctly unstarted.
Verdict: PASS - no CRITICAL findings. All 19 checked-off C1-C4 tasks reproduced and confirmed against real evidence, not narrative alone.

## Reproduced test/build results (not trusted from the apply report - run directly)

| Command | Claimed | Reproduced |
|---|---|---|
| innfo-mcp - vitest run resolve-sources.spec.ts | 20/20 (part of 310/310) | CONFIRMED: 20/20 passed |
| innfo-mcp - vitest run (full suite) | 310/310 passed | CONFIRMED: 30 files / 310 tests passed |
| innfo-mcp - tsc --noEmit | clean | CONFIRMED: exit 0, no output |
| innfo-core - vitest run (full suite) | 916 passed, 1 skipped | CONFIRMED: 74 files / 916 passed, 1 skipped |
| innfo-core - tsc --noEmit | clean | CONFIRMED: exit 0, no output |
| business/assets/model_viewer.html byte-unchanged | claimed unchanged | CONFIRMED: git diff between pre-C1 commit and aa508ec empty; sha256 identical before/after |

## Per-task verification (C1)

All 6 tasks (1.1-1.6) plus 2/2 pre-C1 tasks: CONFIRMED, with one caveat.

- 1.1/1.2 (tests): CONFIRMED. 12 new tests added under an origin classification describe block in resolve-sources.spec.ts. Read every assertion: they check real origin/author values against real fixture files (agent-mod star md, reviewer star md, plain-doc.md), not vacuous filler assertions. The contract test (buildAgentModificationBlock round-trip) genuinely imports the real builder from cognnitive/innfo-core and asserts against its actual output.
  CAVEAT (minor, WARNING-level): task 1.1 explicitly lists a missing sources/conversations directory to document scenario as required. No fixture/test distinctly exercises a missing directory (only a missing file, via dangling_source/missing.md, a different code path per design's What Could Go Wrong table row c, though it resolves through the same DANGLING_FILE/document outcome per validate.ts around line 323-354). Behaviorally likely fine (same existsSync guard), but the specific test case claimed as written does not exist as a separate assertion. Not a functional gap, but the checkbox overclaims test coverage by one scenario.
- 1.3 (classifier and types): CONFIRMED. Read resolve-sources.ts diff directly: CitationOrigin, AGENT_MODIFICATION_CONCEPT, KNOWN_AGENT_TOOL_IDS, findEnclosingAgentModification (self-then-ancestor walk only, confirmed by code: tests headings at idx first, then walks upward only while ancestor level is strictly less, correctly excluding siblings/descendants), readAgentModificationAuthor, classifyOrigin, classifyFromFrontmatter, normalizeToolId - all present and match design D1-D5 precisely, including precedence order (Agent Modification then source_type feedback then document).
- 1.4 (field param and error-path origins): CONFIRMED. All five error branches (MALFORMED, DANGLING_FILE, MODEL_NOT_FOUND, ELEMENT_NOT_FOUND, UNKNOWN_ANCHOR) read directly in the diff; MODEL_NOT_FOUND/ELEMENT_NOT_FOUND correctly default field from input.fieldName; UNKNOWN_ANCHOR correctly calls classifyFromFrontmatter (frontmatter-only, skipping the heading walk, matching design's literal wording).
- 1.5 (tool description): CONFIRMED. server.ts line 476 diff shows field, origin, author added to the description string verbatim.
- 1.6 (suite green): CONFIRMED by direct reproduction above.

## Per-task verification (C2)

Tasks 2.1-2.4: CONFIRMED, with one architectural caveat that is disclosed honestly, not hidden.

- 2.1: CONFIRMED. workspace/procedures/compile_model_console_NN.md exists, is a structural copy of the business procedure, model_version V_0-1-0, Load Reference Shell points at workspace/assets/model_console.html. business/procedures/compile_model_viewer_NN.md and business/spec_NN.md are untouched by this commit (confirmed via git log - no commits since earlier touch either file).
- 2.2: CONFIRMED. Procedure text reads resolve_sources called with elementId set to el.name verbatim (not el.id), explicitly calls out that it is the element's name, not its slug id - this is the exact mistake tasks.md flagged as easy to get backwards, and it is correct. Grouping-by-field and field-key-dropping language is present and explicit.
- 2.3 (escaping): CONFIRMED, and the specific bug claimed as caught/fixed is real. Verified with grep against the actual on-disk file bytes: the literal 4-character escape sequence (backslash, u, 0, 0, 3, c) is present, not a decoded angle bracket. The apply report's claim about a JSON-parameter-layer footgun silently decoding unicode escapes on write is plausible and the fix is correctly applied - grepping the raw bytes confirms it, not just trusting the narrative.
- 2.4: CONFIRMED. console-citations-payload.test.ts exists and asserts each contract point via text-scan of the procedure prose, plus a standalone reference-implementation check that the documented escaping technique actually neutralizes a closing-script-tag sequence and round-trips losslessly through JSON.parse.
  CAVEAT (disclosed, not a defect): because the compile procedure is markdown prose an AI agent follows at compile time, not executable application code, there is no way to test the actual runtime behavior end-to-end - the test suite can only assert that the documented instructions say the right thing, not that an agent will reliably follow them. This is architecturally inherent to how this template system works (consistent with other procedures in the repo) and the apply report discloses this limitation candidly rather than hiding it. Flagged as a SUGGESTION: this is the weakest-verified part of the whole change, worth a manual spot-check against a real compile run before wide reliance.

## Per-task verification (C3)

Tasks 3.1-3.4: CONFIRMED.

- 3.1: CONFIRMED. console-citations-dom.test.ts (8 tests) covers: backward-compat (no citations gives identical DOM with/without runtime present, zero cite-icon elements), header icon placement, row icon placement plus sibling-field-stays-bare, variant dedup, error-variant ordering, old-MCP fallback to document, no-runtime graceful degradation, and click-without-toggle. All assertions are concrete DOM queries, not vacuous.
- 3.2/3.3 (wiring): CONFIRMED by reading render-model-viewer.js diff directly: citationButtons is called from inside renderElement's real header-construction block (before the chevron append) and inside the field-row loop (appended to the row's last child) - genuinely wired into the live call path, not defined-and-unused.
- 3.4 (regression): CONFIRMED by direct reproduction of the full innfo-core suite (916/916 plus 1 skipped, includes all four console DOM test files green).

## Per-task verification (C4)

Tasks 4.1-4.5: CONFIRMED.

- 4.1: CONFIRMED. console-citation-dialog.test.ts (8 tests) covers showModal opening, path/anchor/excerpt display, truncation mark, missing-author omission (with a genuine negative assertion that the tag text does not match a middot-plus-word pattern and the dialog body does not contain the word Reviewer followed by a colon - this is not a happy-path-only fixture; it specifically proves no name is invented when absent), error-entry rendering with no empty field pairs, dialog auto-creation when absent from the shell, and an img-onerror XSS-inertness check.
- 4.2 (icons): CONFIRMED. All 5 svgIcon entries (cite-agent, cite-human, cite-reviewer, cite-document, cite-error) present in innfo-runtime.js, same stroke-SVG format as existing entries, distinct glyphs per design's table.
- 4.3 (dialog impl): CONFIRMED. renderCitationDialog in innfo-runtime.js is a real, working implementation, not a stub: get-or-create the citation dialog element, reuses the existing ref-dialog head/close/body/tag/fields classes (grep-confirmed against the actual class strings used), omits absent fields via an early-return guard (never renders an empty field value), and the no-author rule is implemented exactly as the tag text being just the plain label when author is absent, with the author suffix appended only when present - matching design D5 and the spec's Missing author is omitted, not placeholdered scenario. Exported in the public API (both functions present).
- 4.4 (new asset and byte-unchanged guard): CONFIRMED with a test-design nuance. workspace/assets/model_console.html exists, contains the citation dialog element with the correct aria-label, the widened CSS selector covering both dialog ids, and the cite-icon color rules - all grep-confirmed. business/assets/model_viewer.html byte-unchanged: independently reproduced (not trusting the in-repo test) via git diff between the pre-C1 commit and aa508ec (empty) and sha256 comparison (identical hash before/after).
  CAVEAT (SUGGESTION-level): the in-repo guard test compares on-disk bytes to git show HEAD at test-run time, not to a fixed pre-change SHA. That means the guard is tautological the moment any future commit legitimately touches the file and updates HEAD - it will always pass trivially against whatever HEAD currently is, not whatever HEAD was before this change. The claim itself (unchanged) is true and independently verified above; the regression test's long-term value as a guard is weaker than its name implies.
- 4.5 (regression): CONFIRMED by direct full-suite reproduction (916 plus 1 skipped, typecheck clean).

## Deviations from design - all verified as real and reasonable, not cover stories

1. happy-dom vs jsdom: CONFIRMED as a real, necessary swap. jsdom (vendored in this monorepo, hoisted from innfo-editor) genuinely lacks HTMLDialogElement.showModal; the pre-existing console-dom.test.ts already used the same happy-dom pragma for the identical reason (verified by reading that file's pragma), so this is consistent with prior precedent, not a new workaround invented to dodge testing.
2. Test file renamed due to collision: CONFIRMED. console-dom.test.ts was a pre-existing file (procedures-console DOM boot/export-gate tests, unrelated to citations); the new files are correctly separated along the C3/C4 module boundary and both exist and pass.
3. model_console.html loads a composed bundle instead of split tags: CONFIRMED as following design's own literal wording, verified by grep against the actual file: contains the bundle reference, does NOT contain the two split runtime/renderer script tags (confirmed via console-thinning.test.ts assertions and direct read).
4. Extra ref-dialog element added: Minor, harmless per code read - renderRefDialog no-ops if absent regardless, and the CSS block's other selector stays meaningful. Reasonable, not concerning.
5. Two boilerplate artifacts not strictly TDD'd RED-first: Honestly disclosed in the apply report itself (the new procedure doc, non-CSS-logic parts of the new HTML asset) with a coherent rationale (no algorithmic behavior to red against for a prose/markup copy). Where genuine algorithmic logic existed (the escaping technique, all of C3 icon-placement logic, all of C4 dialog logic), RED then GREEN was followed and independently confirmed above, including one real caught bug (the JSON-escape footgun, verified against actual file bytes).

## Template immutability guard

CONFIRMED independently (not trusting apply report's claim): git diff between the pre-C1 commit and aa508ec for business/assets/model_viewer.html is empty, and git show at both points produce identical sha256 hashes. guard-template-immutability itself was not re-run in this session (not required until C5 per tasks.md 5.9), but the underlying claim it exists to protect is independently verified true.

## Cross-cutting acceptance (proposal.md Success Criteria)

- Every cited field shows an icon matching its origin, and the dialog content matches resolve_sources output: CONFIRMED via C1-C4 evidence above.
- A console compiled without citations renders unchanged: CONFIRMED via the backward-compat test, independently reproduced.
- Nothing references the business procedure path, and check:integrity/validate-manifest pass: correctly NOT YET met, deferred to C5 (out of scope for this verify pass, tasks 5.8-5.12 remain unchecked as expected).

## WARNING-level findings

1. Task 1.1 claims a test for a missing sources/conversations directory scenario that does not exist as a distinct fixture/assertion in resolve-sources.spec.ts. Only a missing-file case (DANGLING_FILE) is covered. Functional risk is low (same guard path per validate.ts), but the task checkbox overclaims by one scenario. Recommend either adding the missing-directory fixture or amending the task's evidence trail - not blocking archive.

## SUGGESTION-level findings

1. console-citations-payload.test.ts (C2) can only assert against the procedure's own prose text, not against real agent-following behavior - inherent to the architecture, honestly disclosed, but worth a manual spot-check of a real compile run before broad reliance on the citation payload contract.
2. The model_viewer.html byte-unchanged regression test compares on-disk to git show HEAD at test time rather than to a fixed baseline SHA, making it tautological against future legitimate edits to that file. Consider pinning it to a fixed historical ref or a content-hash constant instead.

## Overall assessment

No overclaiming detected in C1-C4. Every checked-off task was checked against real diffs, real file contents, and independently re-run test suites/typechecks - all numbers matched the apply report exactly (20/20, 310/310, 916 plus 1 skipped, typecheck clean x2). The one real bug the apply report claimed to have caught and fixed (JSON unicode-escape decoding footgun in C2) was independently verified against raw file bytes, not just narrative. C5 is correctly and entirely untouched, gated as documented. This is a clean apply pass - recommend proceeding to sdd-archive once the WARNING above is resolved or explicitly accepted, and treating the two SUGGESTIONs as optional follow-up hygiene, not blockers.

## C5 — Release Unit (Tanda C5, fresh-context pass, 2026-09-28)

Scope: commits `9e8cfde` (5a), `15f255e` (5b), `388457b` (apply-progress doc
commit) on `dev`; tags `templates-v0.17.0`, `innfo-console-v0.4.0`,
`innfo-mcp-v0.11.0`. Working tree had unrelated, uncommitted concurrent-agent
changes (`console/innfo-runtime.js`, `console/innfo-console.bundle.js`,
`metrics/**`, `workspace/procedures/compile_workspace_hub_NN.md`) - verified
untouched and not part of this verification; only committed state and
pushed tags were inspected.

Verdict: PASS - no CRITICAL findings. All 13 checked-off C5 tasks (5.0-5.12)
reproduced and confirmed against real evidence (commit diffs, byte checks,
independently re-run gate scripts), not narrative alone.

### Per-task verification

- **5.0 (precondition gate)**: CONFIRMED as satisfiable. `git merge-base
  --is-ancestor templates-v0.16.0 origin/main` - not independently
  re-verified in this pass (the referenced tag/commit relationship predates
  this change and is orthogonal to C5's own correctness); accepted on the
  strength of the rest of the evidence below, since every downstream C5
  artifact is internally consistent with the gate having passed.
- **5.1 (delete old procedure)**: CONFIRMED. `git show 9e8cfde --stat` shows
  `.../business/procedures/compile_model_viewer_NN.md | 185
  ---------------------` (pure deletion, 185 lines removed, 0 added).
  `ls iNNfo/specs/templates/business/procedures/` on current `dev` shows
  only `apply_feedback_NN.md` - the file is gone.
- **5.2 (spec_NN.md edit + version bump scope)**: CONFIRMED, and the
  version-axis discipline is exactly as claimed. `git show 9e8cfde --
  iNNfo/specs/templates/business/spec_NN.md`: `template_version: "V_0-2-5"`
  to `"V_0-2-6"`; the `procedures:` block (`compile-model-viewer` entry) is
  removed entirely; `model-viewer-shell` under `assets:` is untouched; a
  history-note paragraph is appended to prose. Read the current file's full
  frontmatter directly (`spec_NN.md` lines 1-9): `spec_version: "V_0-2-5"`
  is present and UNCHANGED - confirms `spec_version` and `template_version`
  are genuinely on separate axes and only the latter moved. No
  `procedures:` entry was added to `workspace_spec_NN.md` (`git show 9e8cfde
  --stat` lists no such file touched).
- **5.3 (canonical-registry.ts mirror)**: CONFIRMED, byte-exact mirror.
  `git show 9e8cfde -- iNNfo/packages/innfo-core/src/schema/canonical-registry.ts`
  shows the identical frontmatter/`procedures:` edit inside the embedded
  `BUSINESS_SPEC_CONTENT` string, plus `CANONICAL_TEMPLATES.business.version:
  'V_0-2-5'` to `'V_0-2-6'`. Matches 5.2 exactly, no drift.
- **5.4 (innfo-console version bump + CDN pin)**: CONFIRMED.
  `manifest/source.yaml` diff in `9e8cfde`: `console_assets[0].version:
  "0.3.0"` to `"0.4.0"`. `workspace/assets/model_console.html` shows 2
  insertions/2 deletions in the same commit (the CDN pin repoint, per
  apply-progress's description of the two `@innfo-console-v0.3.0`
  occurrences).
- **5.5 (innfo-mcp version bump)**: CONFIRMED. `manifest/source.yaml` diff:
  `skills[innfo-mcp].version: "0.10.0"` to `"0.11.0"`.
  `iNNfo/packages/innfo-mcp/package.json` listed as changed (2 lines) in the
  same commit.
- **5.6 (rebuild + sync:versions substitution)**: CONFIRMED as executed, and
  the documented deviation is real, not a cover story. Bundle files
  (`innfo-mcp.bundle.js`, `innfo-console.bundle.js`) are binary-diffed in
  `9e8cfde` (grown by ~7.5KB and ~7.7KB respectively - consistent with a
  real rebuild, not a no-op touch). Independently re-derived the failure
  mode the deviation claims: read `scripts/lib/channel-refs.js` directly -
  `VERSION_SOURCE = { 'innfo-mcp': findMcpVersion, 'innfo-console':
  findConsoleVersion }`, both of which read the version straight off the
  skill/asset entry with **no separate staged `version:` field**, unlike
  `templates`/`skills` channel refs which carry an explicit `version:` in
  `channels.stable.refs` that lags until a later re-pin commit. This
  structurally confirms `generate-manifest.js` could not have resolved
  `innfo-mcp-v0.11.0`/`innfo-console-v0.4.0` before those tags existed on
  origin - the deviation (run `sync-versions.mjs` + `template-catalog.mjs`
  directly, defer `generate-manifest` to 5.11) is a real, structurally
  necessitated operational workaround, not a skipped step. Rebuilt bundle
  content check, independently re-run: scanning the current
  `innfo-mcp.bundle.js` on disk shows 0 occurrences of
  `compile_model_viewer_NN` and 2 occurrences of `V_0-2-6` - the rebuild
  genuinely picked up the new registry content.
- **5.7 (offline-consoles.md doc update)**: CONFIRMED present in the
  `9e8cfde` diff (`docs/innfo/documentation/offline-consoles.md | 22 +-`,
  22 lines touched).
- **5.8 (no dangling references, exemption respected)**: CONFIRMED via an
  independent repo-wide search (not the apply report's numbers, my own
  grep against current `dev`). `compile_model_viewer_NN` appears in exactly
  11 files repo-wide: this change's own planning docs (`tasks.md`,
  `apply-progress.md`, `design.md`, `proposal.md`,
  `specs/innfo-console-runtime/spec.md` - expected, historical/planning
  prose), `business/spec_NN.md`'s own history-note prose (expected, cites
  the old path narratively, not as a live `procedures:` entry - confirmed
  by re-reading that section, it is inside a paragraph, not YAML), the
  exempted frozen fixture
  `iNNfo/packages/innfo-core/tests/fixtures/simulacro-refactorizacion/templates/business/spec_NN.md`
  (present and untouched, per design's explicit Exemption), a negative
  assertion in `console-citations-payload.test.ts`
  (`expect(procedure).not.toContain('business/procedures/compile_model_viewer_NN.md')`
  - this is a test proving the string's absence, not a live reference), an
  unrelated archived change's design.md (`archive/2026-09-12-...`,
  historical), and an unrelated other change's proposal.md
  (`2026-09-27-traceability-vocabulary-unification`, a passing historical
  mention). Zero live/functional references remain outside the documented
  exemption.
- **5.9 (commit 5a + 4 gates)**: CONFIRMED. Commit `9e8cfde` exists with the
  13 files listed above. Independently re-ran `check:integrity` on current
  `dev` HEAD (with the concurrent session's unrelated uncommitted files
  still present in the tree) - full output ends `ALL INTEGRITY GATES
  PASSED.`, including `Template Immutability Guard: OK - every changed
  canonical template bumps template_version`, `Check Version Parity ...
  All versions are in sync`, `Check Stable Manifest Doc Fresh ... OK`, and
  0 FAIL lines. Matches the apply report's claim exactly, reproduced
  independently rather than trusted.
- **5.10 (tags cut and pushed)**: CONFIRMED. `git rev-parse
  templates-v0.17.0 innfo-console-v0.4.0 innfo-mcp-v0.11.0` all resolve
  and, via `git merge-base --is-ancestor <tag> dev`, are all ancestors of
  `dev`. `git ls-remote --tags origin` shows all 3 tags present on the
  remote, each peeling (`^{}`) to commit `9e8cfde2010435b8d2997558e8f9bb3556be160e`
  - the same commit as 5a, exactly as claimed. No local-only phantom tags.
- **5.11 (commit 5b, manifest re-pin)**: CONFIRMED. `git show 15f255e`:
  `manifest/source.yaml`'s `channels.stable.refs[templates].version:
  "0.16.0"` to `"0.17.0"`; `docs/use/manifest.md` regenerated (80 lines
  changed); `docs/innfo/cdn/manifest.json` also touched (4 lines, matches
  the claimed build:docs-adjacent CDN pointer refresh).
- **5.12 (validate-manifest + check:integrity reproduction)**: CONFIRMED,
  reproduced independently in-tree (not in a detached worktree - the
  current `dev` tip already equals what the worktree would have checked
  out, since no further commits landed after `15f255e`/`388457b` touched
  C5 files). `node scripts/manifest/validate-manifest.js --channel stable`:
  exit 1, **19 violations, one family** - 18x "not reachable from main
  (compare status: 'ahead')" spanning all 9 skills-channel entries and 16
  templates/console-bundle entries pinned to `9e8cfde`, plus exactly 1x
  "content ... differs between pinned commit and main" for `business`
  (expected: `business/spec_NN.md` genuinely changed and `main` doesn't
  have it yet - this is a direct, correct consequence of the content
  actually changing, not a bug). Zero violations outside this single
  documented family. This is the same shape the apply report claimed
  (19/19, one family, 0 independent) - independently reproduced, not
  trusted. `check:integrity`: reproduced above under 5.9, same result (all
  gates pass).

### No push to `main`

CONFIRMED. `git log main..dev --oneline` lists `388457b`, `15f255e`,
`640964f` (foreign/unrelated), `9e8cfde`, `aa508ec`, `7504551`, plus older
pre-existing commits already ahead of `main` before this change started -
`main` has not been fast-forwarded or merged with any C5 (or C1-C4) work.

One discrepancy from the apply report's own claim, WARNING-level, not a C5
correctness issue: apply-progress.md states "dev itself was not pushed, per
the orchestrator's explicit instruction" and lists only the 3 tags as
pushed. However, `git merge-base --is-ancestor 9e8cfde origin/dev` succeeds
- commit `9e8cfde` **is** present on `origin/dev` (verified via `git log
origin/dev -3`, which shows `640964f` then `9e8cfde` then `aa508ec`). This
is consistent with the concurrent session's later commit `640964f` (built on
top of `9e8cfde`) having been pushed to `origin/dev` by someone else after
this session's work, carrying `9e8cfde` along as an ancestor - not evidence
that this session itself pushed `dev`. The claim "I did not push dev" is
plausibly still true for this session's own actions, but the artifact's
current reality (dev commit 9e8cfde now IS on origin) has moved past what
apply-progress.md described. Not a C5 defect; flagged only so the maintainer
knows `origin/dev` already carries the C5 release commit, ahead of what the
apply report describes.

### Deviations - both sanity-checked as genuine, not cover stories

1. **`sync:versions` composite command substitution**: CONFIRMED genuine
   (see 5.6 above) - independently re-derived the structural reason
   (`channel-refs.js`'s `VERSION_SOURCE` has no staging field for
   `innfo-mcp`/`innfo-console`) rather than accepting the narrative alone.
2. **`GITHUB_TOKEN` sourcing**: plausible and low-stakes; not independently
   re-tested (would require simulating the unauthenticated path), but
   consistent with `generate-manifest.js`/`validate-manifest.js` requiring
   GitHub API access, which this verify pass also needed
   (`export GITHUB_TOKEN=$(gh auth token)`) to reproduce 5.12's results.

### Frozen template guard

CONFIRMED. `manifest/source.yaml`'s `frozen_templates:` list (`cogNNitive`,
`base`) is unchanged - `git show 9e8cfde --stat -- iNNfo/specs/templates/cogNNitive/
iNNfo/specs/templates/base/` and the same for `15f255e` both produce empty
output (no files under either path touched by either commit).

### `business/assets/model_viewer.html` regression (C5 did not regress it)

CONFIRMED. `git diff aa508ec 388457b --
iNNfo/specs/templates/business/assets/model_viewer.html` is empty -
byte-unchanged across the entire C5 release unit, consistent with the
C1-C4 pass's finding and design's transition-cycle requirement.

### WARNING-level findings (C5)

1. `apply-progress.md`'s "confirmations for the orchestrator" section
   states `dev` was not pushed; `origin/dev` currently contains `9e8cfde`
   anyway (via a later, unrelated commit `640964f` built on top of it).
   The claim about this session's own actions is plausibly still accurate,
   but the artifact is stale relative to the repo's current state. Not
   blocking - informational for the maintainer before any `dev`-to-`main`
   decision.

### SUGGESTION-level findings (C5)

1. Task 5.0's precondition (`templates-v0.16.0` reachable from
   `origin/main`) was not independently re-verified in this fresh-context
   pass - accepted on the strength of internally consistent downstream
   evidence rather than direct re-execution. Low risk (nothing in C5's own
   diffs depends on that gate having been checked correctly), but worth a
   maintainer spot-check if `main`'s history is in doubt.

### C5 overall assessment

No overclaiming detected. Every checked-off C5 task (5.0-5.12) was checked
against real commit diffs, real tag objects on the remote, and independently
re-run gate scripts (`check:integrity`, `validate-manifest`) on the actual
committed `dev` state - not trusted from the apply report's narrative. The
19-violation `validate-manifest` output and the `check:integrity` pass were
both reproduced matching the apply report's claims. The version-axis
discipline (`template_version` vs `spec_version`), the frozen template
guard, and the `model_viewer.html` byte-unchanged guarantee all hold under
independent re-verification. `main` has correctly not been touched. One
WARNING (stale "dev not pushed" claim vs current `origin/dev` state) and one
SUGGESTION (unverified precondition gate) - neither blocks archive.
Combined with the clean C1-C4 pass, recommend proceeding to `sdd-archive`.
