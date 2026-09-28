# Verification Report: Web and Docs Single Source of Truth

**Change**: `2026-09-28-web-docs-single-source-of-truth`
**Mode**: Full artifact set (proposal + design + tasks) - OpenSpec file store
**Date**: 2026-09-28
**Verdict**: PASS WITH WARNINGS

## Commit Attribution (dev is shared with concurrent maintainer sessions)

Identified by inspecting git log --oneline and git show --stat on each candidate, since the shared tree also carries unrelated concurrent work (console-architecture/review-workflow, a documentation SOP model change, a video-templates change).

Commits belonging to this change, oldest to newest:

| Commit | Subject | Unit |
|---|---|---|
| 47b81c51 | docs(readme): fix repository structure map | Unit 1 |
| dca1aea0 | feat(docs): implement docs-facts region helpers | Unit 2 |
| 510e654f | feat(docs): derive MCP tool facts from innfo-mcp registry | Unit 2 |
| 045541a1 | docs(mcp): remove stale explicit tool list from llms-full.txt | orchestrator fix 1 |
| 5ecdf7d0 | feat(docs): derive skills catalog from source.yaml | Unit 3 |
| c3075baa | feat(docs): derive skills catalog and rename nn-router to nn-start | Unit 3 |
| 64d6cdd2 | docs(install): consolidate multi-agent install guide and OpenCode Desktop branding | Unit 4 |
| acd5ee6e | docs(about): supersede D6, generate about.md from about.html | Unit 5 |
| ab01bebb | docs(about): generate about.md twin from about.html | Unit 5 |
| 390d2550 | docs(about): remove stale hardcoded MCP tool list from about.html | orchestrator fix 2 |
| b9eb57c6 | fix(docs): preserve line breaks and indentation in about.md tree diagram | orchestrator fix 3 |
| e6af574f | test(docs): fix missed skills-catalog fixture in generate-docs-facts CLI test | orchestrator fix 4 |
| dcdc1023 | chore(marketing): delete unpublished storyboard | Unit 6 |
| 97a8c40a | ci(verify): add docs-derived-facts and about-twin drift guard | Unit 7 |

Explicitly excluded (concurrent, unrelated to this change, confirmed via git show --stat): d1b3bc6d (console standardization), 2fe39528 (docs SOP model), 42511d03 (video templates nav).

## Guardrail Check - Protected Files Untouched

git show --stat on all 14 commits above confirms none touched docs/innfo/documentation/{_sidebar.md,specifications.md,templates.md,template-video.md}, docs/innfo/documentation/assets/**, or iNNfo/specs/templates/console/**. The console files ARE touched, but only by the excluded concurrent commit d1b3bc6d, which belongs to a different change. PASS.

## Drift Guard - Runtime Evidence

    $ node scripts/generate-docs-facts.mjs --check --against HEAD
    OK: docs/innfo/documentation/innfo-mcp.md is up to date (17 tools)
    OK: docs/skills/documentation/README.md is up to date (9 skills)
    exit 0

    $ node scripts/generate-about-twin.mjs --check --against HEAD
    OK: docs/innfo/about.md is up to date
    exit 0

Both pass clean against the current dev HEAD. PASS.

## Fact Accuracy Cross-Checks

- MCP tool count: iNNfo/packages/innfo-mcp/src/server.ts TOOL_REGISTRY has 17 tool entries (confirmed by direct enumeration: 18 name: occurrences total, 1 of which is the server metadata name at line 70, leaving 17 tool definitions). docs/innfo/documentation/innfo-mcp.md generated region says "17 tools" with 17 table rows. Match. PASS.
- Skills catalog: manifest/source.yaml lists 9 entries under skills: (nn-start, nn-trannsform, nn-innfo, nn-preflight, nn-upgrade, nn-site-generator, nn-design-presets, nn-skills-lifecycle, nn-video-script) - no nn-router, includes nn-video-script. Generated region in docs/skills/documentation/README.md reports "9 skills" and matches the same set (verified via --check passing, which byte-compares the render). Match. PASS.
- nn-router residue: no live doc pages reference nn-router any more. docs/skills/documentation/skills/nn-start.md and nn-video-script.md exist; nn-router.md is gone. The only remaining string hits are inside test fixtures (intentional negative-case data for the rename/drift detectors) and one unrelated docs/use/freshness.json skill-freshness cache - out of this change's scope, not a docs surface. PASS (freshness.json flagged as SUGGESTION below, not a blocker).
- "for OpenCode" / "Built for OpenCode" wording: none of the exclusive-branding phrasing remains in docs/skills/index.html, docs/skills/documentation/README.md, or installing-ai-agents.md; all now read "Claude Code, Cursor, Antigravity, Codex, and OpenCode Desktop (recommended)" or equivalent. Two unrelated hits remain (docs/use/manifest.md:244, docs/use/manifest-next.md:250, headed "For opencode CLI / agents without agent-web-bootstrap") - these describe a specific CLI invocation path, not exclusive branding, and are outside this change's Affected Areas. PASS, unrelated hits noted as SUGGESTION.
- about.md: exists, is generated (not orphaned) - --check --against HEAD confirms it matches what generate-about-twin.mjs would produce from about.html right now. The architecture tree diagram renders as a fenced code block with preserved indentation (the b9eb57c6 fix works as intended). PASS.
- marketing/storyboard/: directory confirmed absent from the working tree. PASS.
- scripts/verify.js drift-guard wiring: step "Docs-Derived Facts Drift Guard (against HEAD)" (checkDocsFactsDriftAtRef) runs both generate-docs-facts.mjs --check --against HEAD and generate-about-twin.mjs --check --against HEAD and exits 1 naming the stale file/generator on failure. Confirmed wired and gated on process exit. PASS.
- Build order: scripts/build-docs.mjs calls generate-docs-facts.mjs (write mode) then generate-about-twin.mjs, both before the two generate-docsify-suite.mjs invocations - matches design D5's build-before-verify contract. PASS.

## Task Completion

Units 1-6 (tasks 1.1-6.4): all checked [x] in tasks.md, and code inspection confirms the described artifacts exist and behave as described (see above).

Unit 7 (7.1-7.6): tasks.md shows all six items checked [x] in the current HEAD. All work is committed and verified at HEAD; the isolated fixture tests pass.

PASS.

## Test Suite Evidence

    $ npm run typecheck        -> clean, 0 errors (innfo-core build, innfo-mcp tsc, innfo-editor vue-tsc)
    $ node scripts/lib/docs-facts.test.mjs           -> 6/6 suites pass, exit 0
    $ node scripts/generate-docs-facts.test.mjs      -> all CLI fixture tests pass, exit 0
    $ node scripts/generate-about-twin.test.mjs      -> 12/12 suites pass, exit 0
    $ node scripts/verify-drift-guard.test.js        -> 4/4 tests pass, exit 0

    $ npm test  (root workspace test, vitest across innfo-core)
    Test Files  1 failed | 73 passed (74)
    Tests       3 failed | 913 passed | 1 skipped (917)
    FAIL tests/console-dom.test.ts - innfo-console export gate (3 assertions)

WARNING: npm test does not exit clean at the current dev HEAD. Root-caused: the 3 failures are all in tests/console-dom.test.ts (innfo-console - export gate), asserting export-gate filename/pending-count behavior. iNNfo/specs/templates/console/innfo-runtime.js - the source these tests exercise - was rewritten by the concurrent, unrelated commit d1b3bc6d feat(console): standardize 3-tier consoles and asynchronous review workflow, which belongs to a different in-flight SDD change (console-architecture / review-workflow) and is explicitly excluded from this change's commit list above. None of this change's 14 commits touch iNNfo/specs/templates/console/**, iNNfo/packages/innfo-core/tests/console-dom.test.ts, or any console runtime file. This is not a regression introduced by web-docs-single-source-of-truth, but it does mean the shared dev branch is currently red on npm test, and this must be surfaced to whoever owns the console-architecture change before either change is archived or merged to main.

    $ npm run lint
    462 problems (14 errors, 448 warnings)

WARNING (contradicts a premise in the task brief): the brief states "9 lint errors preexistentes documentados en tasks.md no cuentan como regresion," but tasks.md for this change contains no such documentation (grepped - zero hits for "lint"/"preexist"/"eslint"), and the actual current error count at HEAD is 14, not 9. All 14 errors are in two files this change never touches: iNNfo/packages/innfo-mcp/src/tools/spec.ts (3 errors, last modified by ab8d734c, long before this change started) and iNNfo/specs/templates/console/innfo-runtime.js (11 errors, introduced by the same concurrent d1b3bc6d console commit implicated in the test failures above). None of these errors are a regression caused by this change's 14 commits - confirmed via git show --stat on each. The "9 errors" figure in the brief appears to be stale or refers to a different snapshot; reporting this discrepancy rather than assuming the number without verifying it.

## Correctness / Design Coherence

All 6 architecture decisions (D1-D6) in design.md match the shipped implementation:
- D1: cross-read in dedicated script (generate-docs-facts.mjs), set-equality guard present (checkSkillPageSet).
- D2: parseSourceYaml reused; parseNNModel exported from generate-docsify-suite.mjs with an is-main guard.
- D3: imports iNNfo/packages/innfo-mcp/dist/server.js (build already runs it first).
- D4: HTML-comment marker regions confirmed in both target files.
- D5: verify.js checks against git show HEAD:<path>, never the working tree (confirmed by reading the drift-guard call site and comments).
- D6 (superseded, correctly): about.md is generated from about.html, not deleted; the three existing cross-references (about.html:13, llms.txt:9, ai-index.yaml:21) were left unmodified as designed.

No design deviations found.

## Issues Summary

### WARNING
1. npm test is red at the current shared dev HEAD (3 failures, tests/console-dom.test.ts), caused by an unrelated concurrent commit (d1b3bc6d, console-architecture/review-workflow change) - not a regression from this change, but must be flagged to whoever archives/merges next, since a shared-tree merge to main would carry it.
2. npm run lint reports 14 pre-existing errors, not the 9 the task brief assumed; all 14 predate or are external to this change's commits (verified via git show --stat, no overlap with this change's files). Recommend correcting the "9" figure wherever it's recorded (it was not actually found in tasks.md).

### SUGGESTION
1. docs/use/freshness.json still lists skills/nn-router/SKILL.md in a freshness-tracking cache. Out of this change's Affected Areas, but will drift further if not refreshed.
2. docs/use/manifest.md:244 and docs/use/manifest-next.md:250 still read "For opencode CLI / agents without agent-web-bootstrap" - not exclusive branding (describes a CLI scenario), but worth a pass if a future change tightens install-guide wording further.
3. docs/innfo/about.md still shows package versions as v0.1.0 for innfo-editor/innfo-core/innfo-mcp - likely stale relative to the actual shipped versions; not part of this change's scope (not a "fact" in the proposal's drift table), but a candidate for a future docs-derived-facts extension.

## Final Verdict

PASS. All drift guards, fact-accuracy cross-checks, and design decisions verified correct and passing at HEAD. All tasks marked complete. The two WARNINGs are pre-existing/concurrent-work issues outside this change's blast radius but should be communicated to the maintainer before any merge to main.
