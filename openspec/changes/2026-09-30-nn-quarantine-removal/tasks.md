# Tasks: Retire the Legacy Quarantine After the Migration Window

## How to apply

- At session start load `nn-dev-development` (`.agents/skills/nn-dev-development/SKILL.md`; the AGENTS.md mandate) and run its concurrency scan before any repo write.
- Work lands on `dev`. Conventional commits only, no AI attribution. Stage by explicit path; never `git add -A` / `git add .` / `git stash` / `git reset --hard` / `git clean`.
- Strict TDD: every RED task is seen failing for the intended reason before its GREEN task starts.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 deletions |
| 400-line budget risk | Medium (mostly deletion) |
| Chained PRs recommended | No (one deletion PR) |
| Delivery strategy | single |
| Chain strategy | n/a |

Decision needed before apply: Yes - the maintainer sign-off in 1.1 gates the whole change.

---

## 1. Sign-off gate (blocking)

- [ ] 1.1 [maintainer] Confirm all known workspaces are migrated and give written sign-off; stop otherwise. `[legacy-quarantine:Requirement:The cleanup removes the quarantine after sign-off]`

## 2. Cleanup (TDD first)

- [ ] 2.1 **RED**: update tests to expect no `./legacy` export, no `detectLegacy`, no hint anywhere (core, MCP, editor, preflight); `legacy-ledger.yaml` with zero entries plus both guards green; `--import-as-source` still works when invoked explicitly. `[legacy-quarantine:Requirement:The cleanup removes the quarantine after sign-off]`
- [ ] 2.2 **GREEN**: delete `innfo-core/src/legacy/`, the two `*.generated.cjs` bundles and their build entries, `legacy-hint.ts`, `useLegacyDomain.ts`, the migrator fixtures (including `LEGACY.md`) and the frozen legacy domain; remove the ledger entries and markers; remove the `./legacy` export. `[legacy-quarantine:Requirement:The cleanup removes the quarantine after sign-off]`
- [ ] 2.3 Verify `rg "legacy:nn-rename/" -g '!openspec/**'` returns nothing; run Gate G. `[legacy-quarantine:Requirement:The cleanup removes the quarantine after sign-off]`

## 3. Docs & release

- [ ] 3.1 Docs: remove legacy-detection mentions from `docs/innfo`, `docs/skills` and `docs/use`.
- [ ] 3.2 [maintainer] Release core/MCP as a MINOR (not patch): merge, tag, pin.
- [ ] 3.3 Rollback: revert the cleanup commit (restores the quarantine and entries).

---

## Notes

- This change was extracted from the deferred S11 tail of `2026-09-29-nn-level-nomenclature-rename` (now archived) on 2026-09-30, so the rename change could close while the migration window stays open.
- The trigger is external: no code change is needed for 1.1 - it is a maintainer decision that the migration window has elapsed.
