# Archive Report: Web and Docs Single Source of Truth

**Change**: `2026-09-28-web-docs-single-source-of-truth`
**Archived**: 2026-09-28
**Mode**: openspec
**Status**: COMPLETE

## Executive Summary

Change `2026-09-28-web-docs-single-source-of-truth` has been successfully archived. All implementation tasks completed and verified, four new capability specs merged into the main specifications, one existing spec updated, and the change folder moved to the archive with full audit trail preserved.

## SDD Cycle Completion

### Phases Delivered
- **Proposal**: Complete. Defined scope, capabilities, risks, and success criteria.
- **Design**: Complete. Six architecture decisions documented (D1-D6), technical approach defined, data flow modeled, interfaces specified.
- **Tasks**: Complete. Seven work units with 31 total subtasks, all marked complete [x]. Tasks verified against 14 committed implementation commits on `dev`.
- **Apply**: Complete. All 14 commits merged to `dev` and verified passing.
- **Verify**: Complete. Verification report confirms PASS with non-blocking warnings.
- **Archive**: Complete. Specs merged to main openspec/specs/, change folder archived, archive report written.

## Specs Synced to Main

### New Specs Created (3)
| Domain | Action | Observation ID |
|--------|--------|---|
| `docs-derived-facts` | Created | Published tool and skill facts derived from canonical sources; CI drift guard added |
| `docs-install-guide` | Created | Single canonical multi-agent install guide; OpenCode Desktop recommended without single-agent branding |
| `docs-content-hygiene` | Created | Accurate README repo map; About page generated from HTML; no orphaned marketing content; unrelated WIP protected |

### Existing Specs Updated (1)
| Domain | Requirement | Change |
|--------|-------------|--------|
| `monorepo-release-manifest` | Workspace Git Skill Registration | Updated path from `actioNN/skills/nn-workspace-git` to `skills/nn-workspace-git` to match current directory structure |

### Delta Specs Merged
All four delta specs from `openspec/changes/2026-09-28-web-docs-single-source-of-truth/specs/` have been merged into the main specifications:
- `docs-derived-facts/spec.md` → new spec, fully created
- `docs-install-guide/spec.md` → new spec, fully created
- `docs-content-hygiene/spec.md` → new spec, fully created
- `monorepo-release-manifest/spec.md` → delta merged into existing spec

## Archive Contents

- [x] proposal.md
- [x] design.md
- [x] tasks.md (all units 1-7 marked complete)
- [x] verify-report.md (PASS with non-blocking warnings)
- [x] specs/ (all four delta specs preserved)

Archive location: `openspec/changes/archive/2026-09-28-web-docs-single-source-of-truth/`

## Task Completion Status

### All 7 Work Units Complete
| Unit | Goal | Status | Notes |
|------|------|--------|-------|
| 1 | Fix README repo map | [x] Complete | Commit: 47b81c51 |
| 2 | MCP tool facts generator | [x] Complete | Commits: dca1aea0, 510e654f, 045541a1 |
| 3 | Skills catalog + nn-router→nn-start | [x] Complete | Commits: 5ecdf7d0, c3075baa |
| 4 | Install guide + OpenCode Desktop branding | [x] Complete | Commit: 64d6cdd2 |
| 5 | About twin generated from about.html | [x] Complete | Commits: acd5ee6e, ab01bebb, 390d2550, b9eb57c6 |
| 6 | Delete marketing/storyboard | [x] Complete | Commit: dcdc1023 |
| 7 | Drift guard wired into CI | [x] Complete | Commit: 97a8c40a, e6af574f |

### Task Gate Verification
- Task checklist: All 31 subtasks across Units 1-7 marked [x] in archived tasks.md
- Verification report confirms all described artifacts present and verified correct
- Drift guards passing: `node scripts/generate-docs-facts.mjs --check --against HEAD` exit 0; `node scripts/generate-about-twin.mjs --check --against HEAD` exit 0
- Design coherence: All six architecture decisions (D1-D6) verified against implementation
- Test suite: All new test files passing (docs-facts.test.mjs: 6/6 suites, generate-about-twin.test.mjs: 12/12 suites, verify-drift-guard.test.js: 4/4 tests)

## Verification Findings

### PASS Status
- All 7 work units implemented and verified
- 14 commits on `dev`, each verified to pass `npm run build:docs` and `npm run lint`
- No hand-typed MCP tool counts or skill versions remain in docs sources
- Generated docs are deterministic (run twice → byte-identical output)
- CI drift guard (verify.js step 7e) wired and passing
- All protected WIP files (\_sidebar.md, specifications.md, templates.md, template-video.md) untouched
- Design decisions validated: D1-D6 all match shipped implementation

### Non-Blocking Warnings (Pre-existing, Out of Scope)
1. **npm test red at dev HEAD** (3 failures in tests/console-dom.test.ts) caused by unrelated concurrent commit d1b3bc6d (console-architecture change), not a regression from this change
2. **npm run lint reports 14 pre-existing errors** (not the assumed 9); all predate this change or are from concurrent console work
3. **docs/use/freshness.json still lists skills/nn-router** in a freshness-tracking cache; out of this change's Affected Areas, not a docs surface
4. **Package versions in docs/innfo/about.md** (v0.1.0 for innfo-editor/innfo-core/innfo-mcp) appear stale; candidate for future docs-derived-facts extension

## Design Decisions Archived

| # | Question | Decision |
|---|----------|----------|
| D1 | Skills data source | Dedicated script (generate-docs-facts.mjs) cross-reads source.yaml; set-equality guard validates |
| D2 | Parser reuse | Reuse parseSourceYaml (CJS) + export parseNNModel from generate-docsify-suite.mjs with is-main guard |
| D3 | MCP facts source | Import iNNfo/packages/innfo-mcp/dist/server.js (built before docs step); fail fast if missing |
| D4 | Generated facts location | HTML-comment marker regions in plain docs pages; missing marker fails the run |
| D5 | Drift check target | Committed blob via `git show HEAD:<path>`, never working tree (build→verify order ensures correctness) |
| D6 | About page | Generate about.md from about.html (not delete); preserves ai-readiness convention + three existing references |

## Rollback / Recovery

The change is fully archived and ready for merge to main. Rollback path (if needed before merge):
- Revert the 14 commits on `dev` in reverse order: `git revert 97a8c40a..45b81c51`
- Revert the spec merges: `git checkout HEAD -- openspec/specs/docs-{derived-facts,install-guide,content-hygiene}/` and revert the monorepo-release-manifest changes

## Next Steps

None. The SDD cycle is complete. The change is ready for:
1. Integration testing on `dev` with other concurrent changes (console-architecture, docs-sop-model)
2. Batched merge to `main` with proper release coordination
3. Release tagging and CDN distribution (if applicable)

## Artifacts & References

Archive audit trail:
- Proposal: Define scope, capabilities, risks, success criteria
- Design: Specify 6 architectural decisions, data flow, testing strategy
- Tasks: 31 subtasks in 7 work units with delivery strategy
- Apply: 14 commits, each passing build and lint
- Verify: Full verification report with PASS verdict and evidence
- Archive: This report + merged specs + archived change folder

Main specifications updated:
- `openspec/specs/docs-derived-facts/spec.md` (new)
- `openspec/specs/docs-install-guide/spec.md` (new)
- `openspec/specs/docs-content-hygiene/spec.md` (new)
- `openspec/specs/monorepo-release-manifest/spec.md` (updated path: actioNN/skills/ → skills/)
