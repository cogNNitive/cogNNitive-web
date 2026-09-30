# Delta for Legacy Quarantine

## ADDED Requirements

### Requirement: The cleanup removes the quarantine after sign-off

The final cleanup MUST run only when all known workspaces are migrated and the
maintainer has signed off. It MUST delete the quarantine module, its markers, its
ledger entries and the migrator fixtures. The `./legacy` subpath export, the generated
bundles, `legacy-hint.ts` and `useLegacyDomain.ts` MUST be deleted too. Afterwards,
`rg "legacy:nn-rename/"` (excluding `openspec/**`) MUST return no result. The empty
ledger, the ledger guard and the write guard MUST be kept: the ledger guard then
asserts that no stray markers remain. The cleanup ships as a core/MCP MINOR release,
not a patch, because removing the `./legacy` export is technically breaking.

#### Scenario: Cleanup blocked without sign-off
- GIVEN at least one known workspace not migrated or no maintainer sign-off
- WHEN the cleanup slice is proposed
- THEN it does not proceed

#### Scenario: Cleanup result
- GIVEN the repository after the cleanup slice
- WHEN `rg "legacy:nn-rename/"` runs excluding `openspec/**`
- THEN it returns no match
- AND core, MCP and editor tests pass
- AND `legacy-ledger.yaml` exists with zero entries and both guards are green
- AND no legacy detection or migration hint exists anywhere in core, MCP, editor or preflight
- AND `nn-upgrade` still runs `--import-as-source` when the user invokes it explicitly for a legacy domain
- AND the release is a MINOR bump
