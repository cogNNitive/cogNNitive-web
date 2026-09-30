# Proposal: Retire the Legacy Quarantine After the Migration Window

## Status

**BLOCKED — do not apply.** This change MUST NOT run until every known legacy workspace
has been migrated through `nn-upgrade` and the maintainer has given written sign-off
(task 1.1). The legacy workspaces are the prerequisite: they are the only reason the
quarantine still exists. While the window is open, the quarantine module, its generated
bundles, `legacy-hint.ts`, `useLegacyDomain.ts`, the frozen fixture and the ledger
entries all stay, and every other change MUST keep respecting the ledger and write
guards. Trigger to unblock: all known workspaces migrated + written sign-off.

## Why

The `2026-09-29-nn-level-nomenclature-rename` change completed the migrate-first
cutover and released it: tooling reads and writes only iNNfo V_0-3-0 and the new
layout, and a legacy domaiNN is detected only to be routed to `nn-upgrade`. The
rename's final slice (S11) — deleting the quarantine module, its generated bundles,
the hint imports, the frozen fixture and the ledger entries — was deliberately
**deferred on 2026-09-30** so external users still on the legacy layout keep a working
migration path (`nn-upgrade` Flow A). The new layout shipped the same day; closing the
window now would strand every current user.

This change owns that deferred cleanup, so the rename change can be archived and the
remaining debt is tracked under its own measurable removal condition instead of living
as an unchecked tail inside a shipped change.

## What Changes

- **Close the migration window**, then delete the entire legacy quarantine:
  `iNNfo/packages/innfo-core/src/legacy/`, the two generated bundles
  (`legacy-detect.generated.cjs`, `legacy-migrate.generated.cjs`) and their build
  entries, `innfo-mcp/src/tools/legacy-hint.ts`, the editor `useLegacyDomain.ts`, the
  `./legacy` subpath export, the frozen legacy fixture (`tests/legacy/fixtures/`, with
  `LEGACY.md`) and the `legacy-ledger.yaml` entries and code markers.
- **Keep the guards.** The empty ledger, the ledger/marker guard and the legacy-write
  guard stay active so the old tokens cannot return.
- **Keep the escape hatch.** `nn-upgrade --import-as-source` still works when invoked
  explicitly; it is the only route left for a legacy workspace found after cleanup.
- **Release as a MINOR**, not a patch: removing the `./legacy` subpath export is
  technically breaking for internal consumers.

## Capabilities

### Modified Capabilities
- `legacy-quarantine`: the cleanup requirement's removal condition is reached and
  executed; the quarantine, its markers and its ledger entries are removed while the
  two guards remain.

## Impact

### Affected areas
- `iNNfo/packages/innfo-core` — delete `src/legacy/`, the `./legacy` export and the
  build entries.
- `iNNfo/packages/innfo-mcp` (`tools/legacy-hint.ts`), `iNNfo/apps/innfo-editor`
  (`useLegacyDomain.ts` + its bundle references).
- `skills/nn-preflight` / `skills/nn-upgrade` — drop the generated bundles and their
  wiring in `scripts/build-preflight-primitives.mjs` and `verify.js`.
- `legacy-ledger.yaml` — remove every entry; the file and both guards stay.
- Docs that mention legacy detection.

### Verification
- `rg "legacy:nn-rename/"` (excluding `openspec/**`) returns nothing.
- Core, MCP, editor and preflight suites pass; `verify.js` and `check-integrity.js`
  pass with an empty ledger and both guards green.
- `nn-upgrade --import-as-source` still runs when invoked explicitly.

### Rollback
Revert the cleanup commit; it restores the quarantine and the ledger entries. Nothing
in a workspace's persisted format changed.

### Dependencies
- **Trigger:** the migration window has elapsed and the maintainer gives written
  sign-off that all known workspaces are migrated. Until then, this change MUST NOT
  proceed.
- Supersedes the deferred S11 tail of `2026-09-29-nn-level-nomenclature-rename`
  (archived).

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cleanup runs while a legacy user still needs migration | Med | Blocked on maintainer sign-off; `--import-as-source` survives |
| `./legacy` export removal breaks an internal consumer | Low | MINOR bump; grep the import boundary test before merging |
| A stray marker or ledger entry survives and reddens the guard | Med | The ledger guard asserts one-to-one; run it after deletion |

### Success criteria
- [ ] Every quarantine file, bundle, import and marker is gone.
- [ ] `legacy-ledger.yaml` has zero entries and both guards are green.
- [ ] No legacy detection or migration hint exists anywhere in core, MCP, editor or
      preflight.
- [ ] `--import-as-source` still works when invoked explicitly.
- [ ] The release is a MINOR bump.
